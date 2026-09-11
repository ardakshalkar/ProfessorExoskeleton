# Running this for more than one professor

The harness this project is built on is a single-user program. Not by accident,
and not as a gap someone forgot to close — it says so, in three separate places,
each time as a decision:

- `dsh-host-webserver` lists **"No TLS, auth, or origin policy"** under deferred
  work, and notes that binding a non-loopback address exposes the server to that
  network.
- `dsh-client-connection` guards `/api` with a `Host`-header check, and then
  states that the fence is a reachability policy and **explicitly not
  authentication**. Its most privileged methods stay loopback-only *"until a
  real authentication layer exists."*
- `dsh-web-app` refuses `--host 0.0.0.0` outright, with the reason in the error
  text: it would expose remote code execution to the network.

That last one is the whole problem in one line. A session carries `bash`.
Reaching the API is a shell on the machine. So there is no version of this where
authentication is a nice-to-have bolted on later: it is the only thing standing
between a browser and a shell, and it has to be correct before anything is
reachable at all.

This directory is that layer. It does not patch the harness, and it does not
pretend the harness grew a user model. It puts the boundary where the harness's
own design assumes it already is — outside the process.

## The shape

One harness process per professor. Each one:

- runs as **its own Unix account**,
- has **its own `DSH_HOME`**, which is where the sessions, the workspace
  registry, the settings and the API key all live,
- binds **its own loopback port**, reachable from nothing but this machine,
- and is fronted by **one authenticating proxy** that decides who is asking and
  routes them to their own port and no one else's.

The checkout is shared and read-only: one installation, one version of the
course model, one `npm install`. The `sample` profile and the `professor` agent
preset are linked into each home from it, file by file, because a preset *is* a
composition and carries the same trust as shell access — that belongs to the
deployment, not to whoever can write to their own home. A professor who wants
their own overrides has a seam for it, `$DSH_HOME/cordis.patch.yml`, which the
launcher applies after the profile's layer.

```
                 ┌──────────────┐
   browser  ───▶ │    Caddy     │  TLS, and who are you
                 └──────┬───────┘
                        │  127.0.0.1 only
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    dsh@ardak       dsh@aigerim     dsh@nurlan
    :3101           :3102           :3103
    user ardak      user aigerim    user nurlan
    /srv/dsh/ardak  /srv/dsh/aig…   /srv/dsh/nur…
        │               │               │
        └───────────────┴───────────────┘
                shared read-only checkout
                /srv/professor-exoskeleton
```

### A home is mostly links, and that matters for rm and tar

`/srv/dsh/<name>` looks like a self-contained directory and is not one. Three
kinds of link point out of it into the shared checkout:

- `profiles/sample/*` and `.agent-presets/professor/*` — one link per
  composition file, written by `dsh-user`.
- `profiles/sample/node_modules` and `.agent-presets/professor/node_modules` —
  one link each, also `dsh-user`, and the reason the profile's plugins resolve
  at all (see the long comment in that script).
- `profiles/node_modules/**` — **one link per package, several hundred of
  them**, written by the harness itself on first boot. Nobody here asks for it;
  it is how the profile's dependency tree is materialised, and it appears the
  first time a home is booted.

None of that is a problem between professors — every link is inside one home and
points at a read-only checkout. It matters to whatever runs *over* a home:

- **Deleting.** `rm -rf /srv/dsh/<name>` is safe on Linux, which never follows a
  symlink during recursive removal. Be more careful with anything that does:
  `find -delete` after a `find -L`, an rsync with `--copy-links`, a file manager,
  or a cleanup script written on Windows, where these are junctions rather than
  symlinks and not every tool treats them the same way.
- **Backing up.** A naive `tar` stores the links, which restores fine onto a
  machine that still has the checkout at the same path and restores a pile of
  dangling links anywhere else. `tar -h` / `rsync -L` dereferences instead and
  writes a full copy of `node_modules` per professor, which is not what you
  want either. The things actually worth keeping are `sessions/`, `storages/`,
  `.credentials.yaml`, `.env`, and `courses/`; back those up by name and let the
  links be rebuilt by the next boot.
- **Measuring.** `du -sh /srv/dsh/<name>` counts the checkout through the links
  and reports something close to the installation size. `du -sh --exclude=node_modules`
  or `du -shx` is the number you meant.

Deleting a home's links is never destructive: `dsh-user` rebuilds every one of
them on the next start, and the harness rebuilds its own.

### Why not one process with logins in it

Because the pieces a multi-tenant harness would need are not seams that exist.
`ctx.workspaceRegistry` — the thing the sidebar calls a workspace — stores
`{path, title, sessionIds}` with no owner field, `list()` returns every record,
and all of them hang off one `DSH_HOME` alongside one credential store. It is a
grouping, not a tenancy.

And a login page could not be added from a plugin even if the model existed.
`/api` is owned by the connection plugin; `registerFallback` takes a single
owner and `frontend-static` already holds it. A plugin can register its own
prefix beside them and nothing more. It would be a login screen guarding
nothing.

The process boundary, on the other hand, already separates everything that
matters, including one thing specific to this project: the private roster —
names, student numbers, and the HMAC salt the pseudonyms derive from — lives at
`~/.ainar/roster`, outside the checkout and per OS account. Share a Unix account
between two professors and you have merged their students into one identity
space. Give them separate accounts and the split is free and enforced by the
kernel rather than by this code.

## The trust fence, and the one real decision

The harness checks `/api` requests like this: the `Host` header must be a
loopback authority or a declared `trustedHosts` entry, and any attached `Origin`
must equal it. A further set of methods — the whole settings and credentials
plane, agent-preset reads, the native file dialogs, `llm.discoverModels` — must
pass that same check **with an empty trust list**, which means loopback and
nothing else.

Put a proxy on a public hostname in front of that and you have to choose:

**Present it as loopback** (what `deploy/Caddyfile` does by default). The proxy
rewrites `Host` and `Origin` to the upstream's `127.0.0.1:<port>`. Everything
works, Models page included. What you give up is the DNS-rebinding defence —
which exists to stop a *browser* being tricked into reaching a loopback server
nobody authenticated, and which is doing a job the proxy now does properly, for
requests that have already proven who they are. This is a substitution, and it
is only valid while the proxy is the sole route to the port. Bind the harness to
`0.0.0.0`, or open the port at the firewall, and it stops being one.

**Or declare the public authority** — `trustedHosts: ['dsh.example.edu']` on the
`connection` row in the profile patch. The fence stays intact. Ordinary use
works, and Settings, Models and agent-preset reads answer `403` forever, because
those are pinned to loopback by name and no configuration lifts that. Each
professor's API key then goes into their `.dsh/.env` by hand.

The default here is the first, because a professor who cannot reach the Models
page cannot set their own key, and the deployment ends up with one shared key in
a file — which is worse on exactly the axis the fence was protecting.

### Measured, not assumed

Against a harness booted by `dsh-user` on 127.0.0.1:3101, with no `trustedHosts`
configured:

| request | answer |
|---|---|
| `GET /` | `200` |
| `POST /api/session.list`, `Host: evil.example` | `403` |
| `POST /api/session.list`, `Host: dsh.example.edu` | `403` |
| …with `Origin: https://dsh.example.edu` too — **a proxy that forwards headers unchanged** | `403` |
| …with **both** headers rewritten to `127.0.0.1:3101` | `200` |
| `POST /api/settings.describe`, both rewritten — the privileged plane | `200` |
| Host rewritten but **Origin left alone** | `403` |
| `sec-fetch-site: cross-site` | `403` |
| `GET /professor-pane/`, `Host: evil.example` | **`200`** |

Three things to take from that. A proxy that does not rewrite gets `403` on
everything, so the `header_up` lines are load-bearing rather than decorative.
Rewriting only `Host` is *also* `403` — both headers or neither. And the last
row is the one to remember: the pane has no fence of its own, and answers a
request the `/api` fence would have refused. Nothing on that port may be left
reachable without the proxy in front.

## What is in this directory

| | |
|---|---|
| `dsh-user` | Boots one professor's harness. `bin/sample` with the per-person home. Provisions on every start, so a restart repairs a half-built home. |
| `provision-user.sh` | Root-side: the account, the home, the port entry, the service. Idempotent, `--dry-run` to read it first. |
| `users.conf.example` | Name → loopback port. Copy to `users.conf`, which is untracked because it names real people on a real machine. |
| `dsh@.service` | systemd template. `dsh@ardak` is the professor, the account and the home, all from the instance name. |
| `Caddyfile` | TLS, authentication, and the map from an authenticated name to that person's port. |

## Standing it up

Assumes a Linux host, the checkout at `/srv/professor-exoskeleton`, and homes
under `/srv/dsh`. Both paths are marked `EDIT` where they appear.

```bash
# 1. The checkout, once, shared.
git clone <this repo> /srv/professor-exoskeleton
cd /srv/professor-exoskeleton && npm install --legacy-peer-deps

# 2. The port table.
cp deploy/users.conf.example deploy/users.conf

# 3. The unit template, once.
cp deploy/dsh@.service /etc/systemd/system/dsh@.service
$EDITOR /etc/systemd/system/dsh@.service    # the two marked paths
systemctl daemon-reload

# 4. Each professor. Read it first, then run it.
deploy/provision-user.sh ardak 3101 --dry-run
sudo deploy/provision-user.sh ardak 3101

# 5. The front door.
cp deploy/Caddyfile /etc/caddy/Caddyfile
$EDITOR /etc/caddy/Caddyfile               # hostname, one auth block, the map
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

### Checking it actually worked

```bash
# The home is built and the port is what you think it is.
sudo -u ardak deploy/dsh-user ardak --check

# The service is up and the harness printed its URL line.
systemctl status dsh@ardak
journalctl -u dsh@ardak -n 20

# It answers on loopback...
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3101/        # 200

# ...and the fence is still a fence: a forged Host is refused.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'Host: evil.example' http://127.0.0.1:3101/api/session.list        # 403

# Nothing but loopback is listening.
ss -ltnp | grep 310                                                     # 127.0.0.1 only

# Through the front door, without credentials.
curl -sS -o /dev/null -w '%{http_code}\n' https://dsh.example.edu/      # 401
```

The last one is the test that matters. If it is ever `200`, stop and find out
why before anyone else is told the address.

## What this does not do, and you should know before relying on it

- **Half of it has been run, and the other half has not.** `dsh-user` was
  exercised: it provisions a home, boots a harness on its own port under its own
  `DSH_HOME`, and the fence table below was measured against that running
  process. What has *not* been run is everything that needs a Linux server —
  Caddy, systemd, oauth2-proxy, two professors at once, and the Unix accounts
  that make the split real. Treat the first deployment as the test, and work
  through *Checking it actually worked* rather than assuming.
- **Identity is yours.** `basic_auth` is included so the routing can be proven
  in an afternoon; it is a shared secret per person with no revocation beyond
  editing a file. The `forward_auth` block against oauth2-proxy is the one to
  finish, and wiring oauth2-proxy to the university's OIDC is not something this
  repository can do for you.
- **Nothing here limits what a session can do once it is inside.** The agent has
  bash as that professor. That is the product working as designed, and it is why
  the Unix account matters more than any of the systemd hardening in the unit.
- **Resource limits are absent.** Three professors running batch grading at once
  are three Node processes and their model traffic on one box, with nothing
  arbitrating. `MemoryMax=` in the unit is the place to start if that bites.
- **Backups are not addressed.** `/srv/dsh/<name>` holds the sessions, the
  drafts and the private roster. It is the only copy. Read *A home is mostly
  links* before pointing a backup tool at it — what you want is a handful of
  named directories, not the whole tree.
- **No CI covers this.** The rest of the repository is tested; this directory is
  five configuration files and two shell scripts, and the honest statement is
  that a syntax check is all that has run.
