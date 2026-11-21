# The widget documents

Plain files, read by **two** servers: `ainar/mcp/widgets.py` and
`node/src/tools/widgets.ts`. Neither owns them.

That is the only reason this directory exists. A widget is about three hundred
lines of CSS and JavaScript, and the alternative was those lines living inside a
Python string *and* inside a TypeScript string, where they would disagree within
a month and nobody would notice until a professor saw two different grids. Here
they are one copy, in files an editor will highlight and a linter will read.

| File | What it is |
| --- | --- |
| `manifest.json` | Which widgets exist, what each renders, the MIME type, the bands |
| `shell.css` | The whole style sheet, shared by all four |
| `runtime.js` | The host contract: read the payload, paint, re-paint, wire buttons |
| `template.js` | The template language: escaped `{{ paths }}`, `{% if %}`, `{% for %}`, and no way to ask for raw output |
| `course-outline.tmpl` | The **structure** of the term plan — which sections it has, in what order |
| `course-outline.js` | `function view(d)` for the term plan: the values `course-outline.tmpl` arranges |
| `class-progress.js` | `function view(d)` for the concept grid |
| `gradebook.js` | `function view(d)` for the gradebook |
| `action-inbox.js` | `function view(d)` for the inbox |

## This is the only copy, and it was not always

`widgets.ts` tries three paths and this directory is the first, so it wins
everywhere this repository runs — a checkout, the plugin reaching the model
through `node_modules/@ainar/core` (a link to `ainar-node/`, and Node resolves
the link before it works out where it is), and the container, whose Dockerfile
copies the whole tree.

Copies also sat under `ainar-node/` and `plugins/dsh-ainar-course-model/` until
2026-09-17, when resolving the candidate list against the real paths showed
nothing could reach either one. Editing a widget meant editing three files and
remembering to, which is a cost with no payer. `PROVENANCE.md` has the argument.

The third candidate — the assets beside a compiled core — is still in
`widgets.ts`, because that is what a `.mcpb` or dsh bundle looks like. Those
builders **copy** these files in. Do not commit their output back here.

## How a document is assembled

Both servers concatenate the same things in the same order:

```
<div id="root"></div><style> shell.css </style><script>
const BANDS = …;      // from manifest.json
const TEMPLATE = "…"; // the .tmpl, where the view uses one
…template.js…        // the interpreter, only where there is a TEMPLATE
…view.js…            // defines function view(d)
…runtime.js…         // calls view(d), and must come last
</script>
```

The order is load-bearing: `runtime.js` calls `view` and reads `BANDS`, so both
have to exist by the time it runs. A widget declares its template with
`structure` in `manifest.json`; the three that do not still concatenate strings
and their documents carry no interpreter.

The template is embedded through `js_string` (`jsString` on the Node side), which
is deliberately neither `json.dumps` nor `JSON.stringify` — Python escapes
non-ASCII by default and ECMAScript never does, so a `·` in a template would make
the two documents differ. `<` becomes `<` for the reason `page.py` gives
about the payload: `</script>` inside a string literal would end the element.

## Why a template, and why not Twig

The markup used to be inside `course-outline.js`, which meant the structure of
the public page was readable only by reading JavaScript and editable only by
editing it. Moving it to a file makes the arrangement something a professor can
hold — `ainar page --structure` renders theirs — while the view, the payload and
the escaping stay exactly where they were.

It is not Twig, Handlebars or Nunjucks, and the reason is the one feature all
three have: `|raw`, `{{{ }}}`, a triple-stash — some way to put text into the
document as markup. `tests/test_page.py` asserts against the rendered bytes that
nothing in the payload reaches the HTML parser as markup, and an escape hatch
would turn that into a statement about nobody having used it yet. There is no
hatch: `{{{` is a parse error, and there are no expressions, filters or calls
either, because a template that could compute could compute a figure no command
produced. `tests/test_mcp_widgets.py` compares the two
servers' output byte for byte, so getting this wrong in one of them fails rather
than drifts.

## Rules these files are held to

Enforced by `tests/test_mcp_widgets.py`, and each is there for a reason written
up in `docs/chatgpt-app.md`:

- **A view computes nothing.** Every figure comes from the payload, because
  `CLAUDE.md` says every figure comes from a command. All number formatting is
  `pct` and `pctWhole` in `runtime.js`, so a view containing `Math.round`,
  `reduce(` or `+=` fails the suite.
- **A blank is never a zero.** `0%` and never-assessed get different cells,
  colours and hover text. The same rule twice over on the outline: a week with
  no module says it is unplanned, and a weight nobody set says so rather than
  printing 0%.
- **No network.** No `http://`, no `fetch`, no `<img>`. A component runs under a
  CSP with an empty allow-list, and one that needed a host would simply fail to
  load. A structure passed in from outside is checked for the same things before
  it is embedded — see `UNSAFE_MARKUP` in `ainar/templates.py`.
- **No student's name.** Pseudonyms only, here as everywhere.
- **No `callTool`.** Buttons ask the model a question via
  `sendFollowUpMessage`. The server is read-only and the UI does not get to
  widen it.

## Editing one

Change the file, then:

```bash
python -m pytest tests/test_mcp_widgets.py tests/test_templates.py -q
```

The template language has its own tests on the Node side, where it runs:

```bash
cd node && node --experimental-strip-types --test test/widgets.test.ts
```

That executes each document against the payload its tool really returns, so a
missing bracket or a field read off the wrong nesting level fails there rather
than in front of a professor. It needs Node on `PATH` and skips without it —
`node/bin/prerender-widget.mjs` is the stub host it uses, and the same one
`ainar page` uses to prerender the public page.

Nothing here is generated. Do not add a build step; the point is that both
servers read the same bytes off disk.
