# AINAR course model — DeepSeek Harness bundle

Fourteen read-only tools over a course workspace, registered natively rather
than bridged over MCP.

```bash
dsh plugin --profile <name> add ./dsh-ainar-course-model
```

## Which workspace answers

Two sources, in this order, per call:

1. **The workspace the session is standing in** — the nearest directory at or
   above `exec.agent.session.header.cwd` that holds a `courses/` directory. That
   is the folder the professor picked in the host, and the same field
   `@deepseek-ai/dsh-tool-fs` reads to decide where `read_file` looks.
2. **`AINAR_WORKSPACE`** — for a caller with no session, or one standing outside
   any course repository.

Standing beats the variable, which is the order `ainar`'s own CLI argues for:
standing inside a course repository means that repository, the way `git` works
from a subdirectory. A professor with the variable set who opens a second course
folder means the one they opened, and a tool that quietly answered about the
other would be the worst kind of correct — every number valid-looking and about
the wrong course.

So the variable is optional, and useful when nobody is standing anywhere. Point
it at the folder that **contains** your `courses/` directory — not at a course,
and not at unmodelled material:

```bash
export AINAR_WORKSPACE=/path/to/workspace
```

Both are resolved per call rather than at load, so setting the variable, or
switching workspaces in the host, does not need a restart.

## Why not MCP

`@deepseek-ai/dsh-mcp-client` would mount `python -m ainar mcp` with one row of
config and no code at all, and for the Python engine that is still the better
route.

It bridges the Tools capability only. Resources are deferred, and everything
this server puts behind Resources is the widgets — the per-tool views under
`vendor/ainar/mcp/widget-assets/`. Over the bridge they are not degraded, they are
absent, and neither end says so. `defineTool` has `presentationMeta` to carry
them; the bridge has nowhere to put them.

The cost, stated plainly: this runs the TypeScript port in `node/`, not the
Python `ainar/`. The port is complete and held to Python's behaviour by
`tests/test_yaml_parity.py` and `tests/test_approve_parity.py`, but Python
remains authoritative and a divergence would surface here first.

## What it will not do

Every tool reads. None writes, approves, pushes a grade, or touches a
credential — there is no tool here that could, which is a property of the list
in `ainar-node/src/tools/index.ts` rather than a promise made by this bundle.

Approval stays where it always is: a person running `ainar approve`.

## Where the model is

Not here. `index.js` is the wiring — the tool definitions, the config schema and
the patch row — and it imports `@ainar/core`, the package in `ainar-node/`.

Until 2026-09-16 this bundle carried its own copy of that model: 38 files and
8,396 lines of JavaScript under `server/`, emitted once by `python
plugin/build.py --target dsh` in ProfessorHarness. That builder is not in this
repository and cannot be run from it, so the copy was maintained by hand — three
of its files said so in their own comments — and it had fallen behind: no
`measureDeck`, no `checkSlides`, no `roster` or `homework` at all, and it
resolved a different major version of Zod than the source it mirrored.

Both copies were checked against each other before the second was deleted: the
same 94 validator codes, and identical issue lists on all 98 mutations in
`workspace/golden/validator/`. It was a faithful translation. It was also a second one,
and nothing checked that it stayed faithful.

Node strips types on import, so the source is imported directly and there is no
build step to go stale.
