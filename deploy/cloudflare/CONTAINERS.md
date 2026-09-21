# One harness per professor, on Cloudflare Containers

The other file in this directory, [`README.md`](README.md), puts the harness on
a Linux server you run and uses Cloudflare only for the route and the identity.
This one puts the harness *inside* Cloudflare, as a Container image started by a
Worker. It exists because the account has Containers on it and the question was
asked; it is not obviously the better of the two, and the section at the bottom
says plainly where it is worse.

## The route

```text
browser
  → Cloudflare Access              who are you
  → Worker                         verifies the token, picks the instance
  → Durable Object                 one per professor
  → container instance             its own VM
       ├ Caddy        0.0.0.0:8080 the only thing that may speak to the harness
       └ dsh        127.0.0.1:3101 the harness
            └ $DSH_HOME on R2, mounted with FUSE
```

Four of those five hops exist for a reason the harness itself states.

**Caddy is in the container, not around it.** `dsh-web-app` refuses
`--host 0.0.0.0` outright, because binding wider would expose remote code
execution to the network. A Cloudflare Container is reached on a published port,
which is by definition not loopback. So the published port belongs to Caddy, and
Caddy rewrites `Host` and `Origin` to `127.0.0.1:3101` — the same substitution
[`Caddyfile.example`](Caddyfile.example) makes on a server, and load-bearing for
the same reason: the fence table in [`../README.md`](../README.md) shows that
rewriting only one of the two headers is `403` on everything.

**The Durable Object is the tenancy.** `../README.md` explains at length why one
process with logins in it is not available: the workspace registry has no owner
field, and a login page cannot be added from a plugin. On a server the split is
Unix accounts. Here it is the Durable Object id, derived from the Access
identity, and each object owns one container instance which Cloudflare runs in
its own VM. That is a stronger boundary than a Unix account, and it is why
nothing inside the container knows about tenancy at all.

**The Worker fails closed.** A request with no valid Access token does not reach
a container. This is the whole of the authentication story, and it is the reason
`workers_dev` is `false` in the Wrangler config: the Worker would answer `401`
on a workers.dev hostname anyway, but an Access application is attached to a
hostname, and a second hostname is one more thing that has to stay configured
correctly forever.

## The part that is actually hard: disk

Cloudflare is unambiguous about this, in the
[Containers FAQ](https://developers.cloudflare.com/containers/faq/):

> All disk is ephemeral. When a Container instance goes to sleep, the next time
> it is started, it will have a fresh disk as defined by its container image.

Containers sleep after inactivity — `sleepAfter` is `30m` here. A harness whose
state lived on that disk would lose a professor's sessions, their drafts and
their roster the first time it idled out overnight, and would do it silently.
Snapshots are listed as coming soon and are not available. So the durable half
of a home is on R2, mounted with FUSE.

### Why the split is inverted from the obvious one

The obvious arrangement is a local home with `sessions/` and `storages/`
symlinked out to R2. It is wrong, and wrong in a way that costs a credential
before anyone notices.

dsh writes through `dsh-atomic-write`: temporary file, then `rename(2)` onto the
destination. **Renaming onto a symlink replaces the symlink**, not the file it
points at. `.credentials.yaml` would be durable right up until the first time
the Models page wrote it, and local and doomed from then on.

So `$DSH_HOME` *is* on R2, and the two rebuildable directories are linked **out**
of it onto local disk:

| | where | why |
|---|---|---|
| `sessions/`, `storages/` | R2 | the work. Renames stay inside R2. |
| `.credentials.yaml`, `.env` | R2 | written by rename; see above |
| `courses/` | R2 | the workspace a session opens in |
| `~/.ainar/` | R2 | the private roster — names, student numbers, and the HMAC salt the pseudonyms derive from |
| `profiles/` | local | mirrored from the checkout every boot, then filled by the harness with several hundred `node_modules` links |
| `.agent-presets/` | local | same: links back to the checkout, rewritten every boot |

That durable list is the same one `../README.md` names under *Backing up* as the
things actually worth keeping. The two local ones are exactly the link farm that
file warns about — hundreds of symlinks, which is both the slowest thing you can
ask an object store for and the part of POSIX a FUSE adapter emulates least
well. They are rebuilt from the image on every start, so there is nothing to
keep.

`start.sh` refuses to boot if the mount is missing or not writable, because a
harness booted onto an unmounted directory writes a full home to ephemeral disk
and reports perfect health while doing it.

## What you need before starting

- **Workers Paid**, which is what carries Containers.
- **An R2 bucket** for the homes, and an **R2 API token** with object read and
  write on it. The token is S3-compatible credentials — an access key id and a
  secret — not an account API token.
- **A domain** in the account and the hostname the professors will use.
- **A Zero Trust Access application** on that whole hostname, with a policy
  allowing exactly the people who should have a shell, and its **AUD tag**.
- **Docker**, to build the image. Wrangler shells out to it.

## Standing it up

```bash
# 1. The bucket.
npx wrangler r2 bucket create professor-exoskeleton-homes

# 2. The Worker's dependencies.
cd deploy/cloudflare/worker && npm install
```

Then edit `wrangler.jsonc`, which has four `EDIT` markers: the route hostname,
`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `R2_ACCOUNT_ID`.

```bash
# 3. The R2 credentials, as secrets rather than vars.
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY

# 4. Build and deploy. The image build runs npm install inside the container,
#    so the first one is slow.
npx wrangler deploy
```

In Zero Trust, create the **Self-hosted** Access application for the hostname
before the first sign-in, not after.

### Checking it actually worked

The first test is the one that matters, and it is the same one
`../README.md` ends on.

```bash
# No credentials: must be Access's sign-in, or 401. If this is ever 200,
# stop and find out why before anyone else is told the address.
curl -sS -o /dev/null -w '%{http_code}\n' https://professor.prof-exo.com/

# A forged identity header, which the Worker must ignore in favour of the
# token it verifies: 401.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'X-DSH-Professor-Slug: someone-else' https://professor.prof-exo.com/
```

Then sign in as an allowed professor and check, in this order: the page loads,
the **Models** page answers rather than `403` (that is the loopback rewrite
working), a session opens, and the professor pane redraws over WebSocket.

The one that proves the R2 split: **start a session, write something, wait out
`sleepAfter`, come back.** The session must still be there. If it is not, the
mount is not doing what this file claims and nothing else here matters.

```bash
# What the container actually did on boot.
npx wrangler tail
```

## What this does not do, and you should know before relying on it

- **It is deployed, and it has never served a professor.** As of 2026-09-17 the
  Worker is live on `professor.prof-exo.com` (version
  `97515984-4abe-494c-8c33-7110d324df48`), the image is in the account registry,
  and the container application
  `professor-exoskeleton-professorharness` exists on `standard-1`. Cloudflare
  Access protects it through the app *Professor Exoskeleton* in team
  `morning-bar-3c02`, default-deny with one Allow policy naming a single email.
  Measured against it: an unauthenticated `GET /` is a `302` to
  `morning-bar-3c02.cloudflareaccess.com/cdn-cgi/access/login/…` carrying the
  configured AUD, so Access is enforcing ahead of the Worker; before Access
  existed the same request was the Worker's own `401`, including one carrying a
  forged `X-DSH-Professor-Slug`.

  **It then served a real session.** Measured over 122 tail events on
  2026-09-17: 121 responses, all `200`, no exceptions — `/`, the client bundle,
  every `@deepseek-ai/dsh-client-*` plugin module, and the API
  (`agentPreset.list`, `dynamicCordisRunner/inventory`). Two conclusions follow
  that nothing else could give. R2 mounted **and is writable**, because
  `start.sh` write-probes and exits rather than boot otherwise. And the Caddy
  rewrite works, because `agentPreset.list` is one of the methods
  `../README.md` pins to loopback with no configuration able to lift it — over a
  public hostname it answered `200` rather than `403`.

  Still unproven, in this order: **WebSocket** — zero upgrades appeared in that
  capture, so session updates and the professor pane are untested; that the
  professor preset finds its thirty-five skills in Cloudflare's runtime rather
  than only in local Docker; and the one that matters most, **that a session
  survives a sleep**. Until that last one answers, treat the R2 split as
  plausible rather than demonstrated.
- **FUSE is not a filesystem.** Cloudflare's own warning is that you should not
  expect SSD-like performance, and the deeper issue is that object storage has
  no atomic rename — `tigrisfs` emulates one. dsh's atomic writes are therefore
  atomic by emulation, not by the kernel. A crash or an OOM between a write and
  its rename can leave a session file torn. This is the single largest
  reservation about the whole arrangement, and it is why `../README.md`'s server
  deployment is still the more conservative choice.
- **Every message is object-store I/O.** Sessions are written as the
  conversation goes. On a server that is a local SSD write; here it is a
  round trip to R2. Expect it to be slower, and expect batch grading — which
  writes a great deal — to be where that is felt.
- **An OOM is a data event, not just a restart.** `standard-1` is 4 GiB. Running
  out of memory restarts the instance, and a restart is a fresh disk. Anything
  not yet flushed to R2 is gone. Watch memory before raising `max_instances`.
- **The container runs as root.** Acceptable because the VM holds exactly one
  professor and is the isolation boundary, but it is weaker than the Unix
  account the server deployment gets, and it is the first thing to fix if this
  ever holds two.
- **Cost is per awake instance.** `sleepAfter` is 30 minutes. Lower it and
  professors wait through a cold start more often; raise it and you pay for idle
  containers. There is no free position.
- **Nothing limits what a session can do once inside.** The agent has bash. That
  is the product working as designed, and it is why the Access policy is the
  security control and not a convenience.
- **No CI covers this.** Same honest statement as `../README.md`: this is a
  Dockerfile, a shell script, two configuration files and a Worker.
