# dsh-sample

A DeepSeek Harness plugin with nothing in it but the contract.

Two tools, one optional HTTP route, one config schema, and the patch file that
mounts the whole thing. Some 440 lines, most of them comments, and the comments
are the point — each records a rule that is invisible until you break it.

```
index.js            the wiring: name, inject, Config, apply
lib/tools.js        the two tool definitions
cordis.patch.yml    the loader row — without this, nothing here runs
package.json        `dsh.bundle.patch` names that file
```

The tools are tested without a harness — `npm test` in the project root runs
[`test/tools.test.mjs`](../../test/tools.test.mjs) against a bare Node, which is
why `lib/tools.js` takes `defineTool` as an argument rather than importing it.

## The five things a plugin is

```js
export const name = "sample"                 // what the loader calls this fiber
export const inject = ["tools"]              // services it cannot start without
export const Config = z.object({ ... })      // schema for its loader row's config
export function apply(ctx, config) { ... }   // the body: register, return nothing
```

…plus `dsh.bundle.patch` in `package.json`, pointing at `cordis.patch.yml`.
That last one is what turns an installed package into a mounted plugin. Without
it the code is correct and never runs.

## The tools

| tool | what it does |
| --- | --- |
| `sample_ping` | Reports that the plugin is mounted, its configured greeting, the workspace the session is standing in, and the host's clock. |
| `sample_read_stats` | Counts lines, words and the commonest words in a UTF-8 file inside the open workspace. |

Both are read-only, and both are `isConcurrencySafe`.

## The route

`GET /sample/health` returns the mount's config, its tool names and an uptime.

It is registered through `ctx.inject(["webServer"], …)` inside `apply` rather
than by listing `webServer` in the module's `inject`, and that difference is
deliberate: a plugin that statically injects a service its deployment does not
compose **never activates at all**. Waiting for the server inside `apply` means
a headless profile mounts the two tools and simply never gets a route — inert,
not broken.

## Things that are fatal at registration

Not "one parameter is wrong" — a plugin that fails to apply fails the whole
tree, and the harness does not come up.

| Written | What happens |
| --- | --- |
| `required: false` on a parameter | Rejected: *required must be true when present*. Emit the key or omit it. |
| `description: undefined` | Rejected: *description annotation must be lossless JSON data*. |
| `{ type: "object" }` with no `additionalProperties` | Rejected. Every explicit DSL object must declare it. |
| `defineTool` read off `ctx.tools` | `defineTool is not a function`. It is a module export of `@deepseek-ai/dsh-tools`. |
| `cordis.patch.yml` as a bare `insert:` mapping | *overlay … must be a top-level YAML array of loader patch entries* — a boot failure for the host, not a bundle that mounts nothing. |
| A `config:` value that violates `Config` | The host does not boot. What you get is *plugin tree failed to load … loader entries failed to apply* wrapping a nested `AggregateError`, which does not name the field — so suspect the row you last edited. |

And one that is not fatal, just quietly lossy: an `array` output schema with no
`items`. The element type reaches the model as a bare array and the type the
tool declared is thrown away on the way out.

## Config

Every field has a default, so the loader row may carry no `config:` at all.

| field | default | meaning |
| --- | --- | --- |
| `greeting` | `dsh-sample is mounted.` | What `sample_ping` says. |
| `maxBytes` | `1048576` | Largest file `sample_read_stats` will read. |
| `route` | `true` | Whether `/sample/health` is registered. |

Overridden per profile, not here — see
[`.dsh/profiles/sample/cordis.patch.yml`](../../.dsh/profiles/sample/cordis.patch.yml).
Four layers resolve on top of each other, weakest first: this bundle's patch,
then the profile's, then `$DSH_HOME/cordis.patch.yml`, then `--patch`. A patch
entry replaces the targeted row's **whole** `config`, so restate every key you
want and not only the one you are changing.

## Dependencies

None. `@deepseek-ai/dsh-tools` and `@deepseek-ai/schemastery` are imported at
runtime and resolved from the host's `node_modules` — they are the harness this
plugin is mounted into, not libraries it may pin a version of.
