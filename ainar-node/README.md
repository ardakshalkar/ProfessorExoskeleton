# The AINAR model in TypeScript

Phases 1–3 of [docs/node-migration.md](../docs/node-migration.md): the model,
the loader, every read module, and the MCP server.

```bash
python ../plugin/build.py --target mcpb   # -> dist/ainar-course-model.mcpb, one-click
```

**23 of the 23 golden fixtures reproduced**, and all 98 validator mutations.
`list_courses` is the one payload that deliberately differs: it carries a
coverage object the Python server has no field for.

```bash
npm install
npm run check      # the property tests, then the golden check
```

`ainar/` remains authoritative. Nothing here is used by anything yet, and
nothing imports across the two trees.

## What is here

| | Ported from | |
| --- | --- | --- |
| `src/model/*.ts` | `ainar/model/` | 7 modules of zod schemas |
| `src/issues.ts` | `ainar/issues.py` | |
| `src/bundle.ts` | `ainar/bundle.py` | collections, serialisation, indexes, selections, `courseContext` |
| `src/loader.ts` | `ainar/loader.py` | globbing, YAML, shared-record pulling |
| `src/grading.ts` | `ainar/grading.py` | `rubricPayload`, `pendingPayload`, `calibrationPayload` |
| `src/inbox.ts` | `ainar/inbox.py` | `inboxPayload` |
| `src/progress.ts` | `ainar/progress.py` | `studentRecord`, `dashboardPayload` |
| `src/blueprint.ts` | `ainar/blueprint.py` | `blueprintPayload`, `outcomeGradeShare` |
| `src/gradebook.ts` | `ainar/gradebook.py` | `gradeRows`, `gradebookPayload` — the four refusals |
| `src/report.ts` | `ainar/report.py` | `syllabusMarkdown`, `alignmentMarkdown` |
| `src/tools/index.ts` | `ainar/mcp/tools.py` | the fourteen tools, and `WITHHELD` |
| `src/workspace.ts` | `ainar/mcp/tools.py` | course loading, cached per process |
| `bin/server.ts` | `ainar/mcp/server.py` | local stdio MCP on the official SDK |
| `bin/http-server.ts` | — | remote Streamable HTTP MCP over PostgreSQL read models |
| `bin/golden-check.ts` | — | compares the port against `workspace/golden/` |

### `src/mcp/` is protocol, and only protocol

The Python layout put the tool list, the widgets and the course loading under
`ainar/mcp/`, because MCP was the only way anything reached them. It is not any
more: `dsh-ainar-course-model` registers the same `TOOLS` natively on the
DeepSeek Harness tool registry, `dsh-professor-pane` serves the widget documents
over HTTP, and `bin/ainar` — a CLI, with no protocol anywhere near it — resolves
a course through `workspace.ts`. Four consumers, one of which speaks MCP.

So the directory holds what is actually MCP and nothing else:

| | |
| --- | --- |
| `src/mcp/server.ts` | `tools/list`, `tools/call`, `resources/list`, `resources/read` |
| `src/mcp/oauth.ts`, `src/mcp/http-auth.ts` | who may open the remote server |
| `src/mcp/telegram-tool.ts` | an `AuthInfo`-gated tool, shared backend only |

and what every host reads sits where any of them can reach it without importing
through a protocol it does not speak: `src/tools/` for the catalogue and its
widget documents, `src/store/` for the YAML and PostgreSQL backings, and
`src/workspace.ts` for which course is being asked about.

Three things here are **not** ports, and live in Node because their libraries do:

| | | |
| --- | --- | --- |
| `bin/render-exam.ts` | — | a question-only exam as DOCX or PDF |
| `bin/render-deck.ts`, `src/deck.ts` | — | an approved deck as `.pptx`, checked against its `presentation_plan` |
| `bin/find-image.ts` | — | an openly-licensed image, with its licence and credit recorded |

They write files, but only into `output/` and `work/`, never into `courses/`.

One thing here *does* write into `courses/`: `bin/ainar.ts approve`, ported in
Phase 6 of `docs/node-migration.md`. It is the one file in this package that is
not a surface over already-verified code, so it is held by a differential oracle
instead — `tests/test_approve_parity.py` runs both gates over the same drafts and
compares the trees byte for byte, and `tests/test_yaml_parity.py` holds
`src/yaml-out.ts` to PyYAML's output scalar by scalar. It prints its validator
coverage on every run, because the refusal is what makes it a gate — since
Phase 4 that is all 94 of `validate.py`'s checks, held there by the 98
mutations in `workspace/golden/validator/`.

The line that has not moved: **grades, pseudonyms and anything a student can see
stay Python's** — `lms`, `roster` and `notion push` are refused by name.

`render-deck` and `find-image` need `pptxgenjs` and `sharp`, which are
`optionalDependencies` — reading a course must not depend on a native image
library, and `npm run check` passes without them. `--pdf` shells out to
LibreOffice so the PDF is a conversion of that same deck rather than a second
renderer's idea of it.

```bash
npm run render-deck -- --course-version CSS-4008-2026-FALL --document DOC-4410 --pdf
npm run find-image -- --search "confusion matrix"
```

## How a port is proved

```bash
npm run golden
```

```
ok    CSS-4008/bundle.json

1/1 bundle fixture(s) reproduced
pending (Phase 2): course_context, assessment_rubric, …
```

The fixtures come from the Python engine (`python -m ainar golden`), so the
definition of "faithful" is generated rather than authored. What Phase 2 has
not implemented is listed as **pending** rather than passing — a port that
silently skips what it has not done is worse than one that fails.

### Structural comparison, not byte-for-byte

The plan originally said bytes. That was wrong, and this is the correction.

Python writes an integral float as `5.0`; `JSON.stringify` writes `5`. Same
number, different text. Making either side agree on the text would be testing
the serialiser rather than the logic, so both sides are parsed and compared by
value — **array order significant, object key order not**.

## The three properties that do not show up in a fixture

A fixture only proves the port handles input that already loaded. It cannot
show what gets *refused*, and refusing is half of what the model is for. So
`test/properties.test.ts` covers:

- **`extra="forbid"` → `.strict()`.** A typo in authored YAML is a loud error.
  Applied inside `entity()` rather than per-schema, because one schema
  forgetting it would lose the property silently for that entity.
- **Anchored identifiers.** `MODULE-6` and `xMODULE-06x` are both refused; an
  unanchored regex would accept the second.
- **Timezone-aware timestamps.** A naive value is refused, and the offset the
  professor wrote comes back unchanged. A JS `Date` would normalise `+05:00` to
  UTC and print `Z` — changing the value and differing from every fixture — so
  `awareDatetime` validates and keeps the string.

## Two things ported that are not obvious from the field lists

Both are Python `@model_validator`s, invisible in a schema translation, and
each was caught by the golden check rather than by reading:

- **`Assessment`** fills `rubric_id` from an inline rubric, and refuses a
  contradiction. Without it every assessment carrying an inline rubric loses
  its `rubric_id` — which is exactly how the first golden run failed.
- **`AssessmentItem`** refuses duplicate option labels, a choice item with no
  correct option, and more than one correct option on a single-answer item.

And one that is not a validator at all: **Python's `round()` is banker's
rounding.** `round(0.125, 2)` is `0.12` where `Math.round` gives `0.13`, and
`calibrationPayload` rounds every agreement rate — so `roundHalfEven` matches
it. On this course the two agree; on some other course they would not, which is
the worst kind of difference to ship.

## Two ways to run it

`--experimental-strip-types` runs the TypeScript directly, which is why imports
carry `.ts` extensions — no build for development. `npx tsc` compiles to
`dist/` for the bundle, with `rewriteRelativeImportExtensions` turning those
back into `.js`.

One thing type-stripping cannot do is a constructor parameter property
(`constructor(readonly root: string)`), because that needs code generation
rather than erasure. `Workspace` writes the field out longhand.

## Remote PostgreSQL MCP

The remote process has the same portable tools and widgets as local stdio, and
may add backend-only integrations such as `publish_telegram`; the `CourseStore`,
transport and credential boundary change. See
[`docs/hybrid-execution.md`](../docs/hybrid-execution.md) for the boundary and
deployment variables. The minimal local launch is:

```powershell
$env:DATABASE_URL = "postgresql://localhost/ainar"
$env:AINAR_OAUTH_ISSUER = "https://auth.example.edu"
$env:AINAR_OAUTH_JWKS_URI = "https://auth.example.edu/.well-known/jwks.json"
$env:AINAR_MCP_RESOURCE = "https://mcp.example.edu/mcp"
npm run mcp:http
```

To enable Telegram, also set `AINAR_TELEGRAM_BOT_TOKEN` in the backend secret
manager, add `integrations:publish` to `AINAR_OAUTH_REQUIRED_SCOPES`, and map a
run in `delivery.telegram_channels`. The token is never accepted as a tool
argument or local plugin variable.
