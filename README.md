# A sample DeepSeek Harness plugin, and a host that runs it

Two halves, and the second one exists so the first can be seen working:

| | |
| --- | --- |
| [`plugins/dsh-sample/`](plugins/dsh-sample/) | The plugin. Two tools, one optional HTTP route, one config schema, and the patch row that mounts it. |
| everything else | A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) host, composed to mount exactly that one plugin and nothing of its own. |

The host holds no logic. It is a profile, a launcher and a dependency list — the
smallest arrangement in which `bin\sample` opens a browser UI with the sample
plugin's tools live in it.

## Run it

Requires Node 22+.

```bash
npm install --legacy-peer-deps
```

The flag is not optional. Without it npm's peer resolver spends eight-plus
minutes and about a gigabyte on this graph — sixty-odd `@deepseek-ai` packages,
all on rc versions — and does not converge. With it, npm converges in a couple
of minutes but silently skips every peer, and dsh will not boot without them; so
the peers dsh's own tree declares are listed as direct dependencies in
[`package.json`](package.json). That is the whole reason a sample's dependency
list is this long.

```bash
bin\sample
```

`bin/sample` is the same thing for git-bash, WSL, macOS and Linux. Both set
`DSH_HOME` to this project's `.dsh` — which is the one thing that has to be true
before dsh boots, and a silent failure if it is not — and then hand every
remaining argument to dsh.

Argument order matters once you start passing flags: dsh's own
(`--patch`, `--dump-config`, `--no-open`'s siblings) must come before the app's,
because everything after the first app argument goes to the app. `--patch` after
`--no-open` is reported as `unknown option '--patch'`.

Two dsh flags are worth knowing while working on a plugin:

```bash
bin\sample --dump-config                    # the composed tree, annotated by layer
bin\sample --patch ./experiment.yml         # one more overlay, on top of the profile's
```

`--dump-config` is the fastest way to answer "is my row actually mounted, and
whose value won" without booting anything:

```
# == dsh-sample, patched by …\.dsh\profiles\sample\cordis.patch.yml
- id: sample
  name: dsh-sample
  config:
    greeting: dsh-sample is mounted, and this greeting comes from the profile.
    maxBytes: 262144
    route: true
```

The harness comes up at `http://127.0.0.1:3080`. A model is only needed to talk
to an agent; the two checks below need none.

## Confirm the plugin is actually mounted

The route, which needs no model and no session:

```bash
curl http://127.0.0.1:3080/sample/health
```

```json
{"ok":true,"plugin":"dsh-sample","tools":["sample_ping","sample_read_stats"],
 "greeting":"dsh-sample is mounted, and this greeting comes from the profile.",
 "maxBytes":262144,"uptimeSeconds":12}
```

Two things are worth reading in that response rather than skimmed. The tool
names are the ones the model can now call. And the greeting is the one from
[`.dsh/profiles/sample/cordis.patch.yml`](.dsh/profiles/sample/cordis.patch.yml),
not the default in the plugin — which is the four-layer config arrangement
working: the plugin ships defaults and knows nothing about this machine, and the
profile makes the choices.

Then, in a session, ask the agent to call `sample_ping`, or open a folder as a
workspace and ask it for `sample_read_stats` on a file inside it.

The tools themselves need none of this to test:

```bash
npm test
```

That runs against a bare Node — no harness, no profile, no model, not even the
install — because `lib/tools.js` takes `defineTool` as an argument rather than
importing it. What it cannot check is whether the parameter and output schemas
are legal DSL: the real `defineTool` enforces those at registration, so
`bin\sample` coming up at all is the other half of the coverage.

## Layout

```
bin/sample[.cmd]              the front door: set DSH_HOME, then exec dsh
plugins/dsh-sample/           the plugin — start here
  index.js                    the wiring: name, inject, Config, apply
  lib/tools.js                the two tool definitions
  cordis.patch.yml            the loader row; without it nothing runs
.dsh/profiles/sample/
  package.json                dsh.profile.bundles — the mount order
  cordis.yml                  the profile root: empty, and it stays empty
  cordis.patch.yml            the layer to EDIT: config for the rows above
test/tools.test.mjs           the tools, tested against a bare Node
.env.example                  the credential, and the model selection
package.json                  the pinned harness, and the peers npm skips
```

## How the pieces find each other

Worth knowing before changing anything, because three of the four steps fail
silently when they are wrong.

1. **`package.json` → the plugin.** The project depends on
   `plugins/dsh-sample` with a `file:` spec. A copy would work too, but then
   `cordis.patch.yml` could not name the package.
2. **`dsh.bundle.patch` → `cordis.patch.yml`.** This is what makes an installed
   package a *bundle*. A package without it is just a package.
3. **`dsh.profile.bundles` → the mount order.** `dsh-base`, then
   `dsh-web-app`, then `dsh-sample`. Each contributes its patch as one layer, in
   that order.
4. **The loader row names the package, not a path** — which is what lets Node
   resolution find the code from wherever the profile lives.

Four config layers then resolve on top of each other, weakest first: the
bundle's own patch, the profile's patch, `$DSH_HOME/cordis.patch.yml`, and
anything passed as `--patch`. A patch entry replaces the targeted row's **whole**
`config`, so restate every key you want.

## Writing your own from this

Copy `plugins/dsh-sample/` to `plugins/dsh-yourthing/`, then:

- rename the package in its `package.json`, and the `id`/`name` in its
  `cordis.patch.yml`
- add it to `dependencies` in the project `package.json` as
  `"dsh-yourthing": "file:./plugins/dsh-yourthing"`
- add it to `dsh.profile.bundles` in `.dsh/profiles/sample/package.json`
- `npm install --legacy-peer-deps` again, so the `file:` link exists

The plugin's own [README](plugins/dsh-sample/README.md) has the table of things
that are **fatal at registration** — `required: false`, an explicit object
schema without `additionalProperties`, `defineTool` read off `ctx.tools`, a
`cordis.patch.yml` that is a mapping instead of an array. Each of those takes
down the whole harness rather than the one plugin, so it is a short table worth
reading once.

## Mounting it in another host

Nothing here is specific to this host. To mount the plugin in an existing dsh
project — the sibling `ProfessorExoskeletonDHS`, say — copy
`plugins/dsh-sample/` into that project's `plugins/`, add the `file:` dependency
and the bundle to the profile that should carry it, and reinstall. The plugin
imports nothing from this project.

One caveat if you go that route on Windows: `dsh plugin add` forwards to pnpm,
and pnpm cannot resolve a `file:`/`link:` spec whose absolute path contains a
space. Under a home directory like `C:\Users\Ardak Shalkar` that rules it out —
make the plugin a dependency of the **project** and install with npm, which is
what both this host and the sibling do, and which is why the profile's own
`dependencies` is empty.

## The credential

`.env` is read by dsh itself, as one layer of its credentials seam — the
launcher deliberately does not export the key into the environment. The process
environment is the top layer of that seam and the only one that is read-only by
design, so a key promoted there would show on the Models page as
`writable: false` and the UI would refuse to change it. Only the two model
variables, which are not secrets, are passed through.
