# dsh-professor-pane

The right column of the DeepSeek Harness, as the professor's visualization pane.

Six buttons across the top of it — **Course outline**, **Students**,
**Progress**, **Tasks**, **Preferences**, **Integrations** — and under most of
them a segmented row of sub-views. The header names the run and its term dates,
and offers a picker when the workspace holds more than one offering.

| Button | What it draws | Where it comes from |
| --- | --- | --- |
| Course outline | The term plan a student reads: outcomes, the assessment table with declared weights, then week by week with each week's module, meetings and deadlines. Every piece of graded work carries a link to the brief students read, or says it has none | `course_outline` |
| Students | The class list by subgroup, named or pseudonymous, with each student's marks so far, and under each row what they actually handed in | the enrollments, `gradebook` for the marks, and the run's submissions and item responses |
| Progress · Concepts | Concepts in teaching order against students by pseudonym, with the mean proportion of marks earned on evidence tagged with each | `class_progress` |
| Progress · Gradebook | One score per student per assessment, from approved decisions only, with the rows that must not be exported and the reason for each | `gradebook` |
| Tasks | Work with no date and a button that sets one, grades awaiting approval, outstanding submissions, open signals, interventions | `action_inbox` |
| Preferences | The DataLayer preference layers, each with its own file path and its own values | the preference files |
| Integrations | What this run is wired to outside the workspace, and what it is not: the gradebook target, the Canvas course and host, the spreadsheet, which credentials are present, and which Canvas section feeds which subgroup | the run record, `lms.toml`, `connections.json`, the environment |

## Opening a deck, or a homework brief

A slide deck, a handout, an exam paper or the brief for a piece of homework
opens **over the harness**, not in another browser tab: a full-page overlay
with the document in it, closed with `Escape`, with the backdrop, or with the
×. The pane is three hundred pixels wide and a slide is 4:3; nothing about
reading one belongs in a column, which is the whole argument for the overlay.

Where the links are:

* the `PDF` chip on a week's deck, the `open` beside a reading, and the rows
  under **Course outline · Slides**;
* an `open` chip under the weight and the date on every row of **Course
  outline · Assessments**, and a **Paper** row on each of **Course outline ·
  Exams** — this is the assessment's `instructions_document_id`, the brief
  students read, and a piece of graded work that has none says `no brief` in
  the same amber the pane uses for a missing weight. Work a student cannot
  start is a hole worth drawing, not a field worth leaving blank;
* the same link on the assessment chips in the week-by-week view, including on
  work with no deadline — which is usually the work whose brief you are
  looking for.

What still opens a tab, deliberately:

* **A format the browser will not paint.** A `.pptx` and a `.docx` are
  downloads everywhere this runs, and an overlay of one would be a blank panel
  called a slide deck. The showable list is `pdf`, `html`, `svg`, the image
  formats, plain text, and markdown; `sendMaterial` serves the rest exactly as
  before. The overlay's own header keeps an **Open in a tab** link for the case
  where a format turns out to be a download after all.
* **A material hosted somewhere else.** An external reading keeps its own URL
  and its own tab. The overlay frames one thing only: this app's `/file` route,
  checked in `materialUrl` on the browser side, so a URL arriving from a
  sandboxed document cannot point the frame anywhere else.
* **A modified click.** Ctrl, cmd, shift and middle clicks are left alone, so
  "open in a new tab" still means what it says.

How the frame is sandboxed depends on the format, and the reason is measured
rather than chosen. A frame with an opaque origin — `sandbox` without
`allow-same-origin`, which is how the widget frames are delivered — cannot load
a same-origin URL at all: the request fails as `ERR_BLOCKED_BY_CLIENT` and the
panel stays blank. And the PDF viewer and the image viewer are documents of the
browser's own, which a sandbox stops even when the origin matches.

So a **PDF or an image** is framed with no sandbox, which costs nothing:
neither can execute anything, and the PDF viewer has a sandbox of its own.
Everything else — HTML, SVG, plain text — is framed with `allow-same-origin`
and therefore **without** `allow-scripts`, because a workspace may hold an HTML
handout downloaded from anywhere and a script in one has no business running
with the professor's session. Scripts off is what makes that safe; the
same-origin grant only makes it load. The table is in `MaterialModal`.

### Markdown is rendered, not served

`.md` is on the showable list, and it was not before. The reason it was
excluded stopped being true rather than being overruled: Chrome downloads
`text/markdown` whatever the file contains, so `/file` no longer sends one. A
markdown document is rendered to HTML there — `lib/markdown.js` — and served as
HTML, which the browser paints.

This matters more than it sounds like it should, because markdown is what this
project writes. `make-materials` produces a deck as Marp markdown;
`design-assessment` writes the brief students read as markdown beside the YAML,
and says why in as many words. Before this, the sample course's only deck and
every drafted brief were files the professor could reach and not read.

The renderer is a deliberate subset — headings, both kinds of list, fenced
code, tables, blockquotes, rules, and inline code, links, images and emphasis —
and not a markdown implementation. No dependency was added for one. What has to
render is material this project's own skills wrote to their own templates, and
the failure mode of a construct it does not know is a line that reads as its
own source rather than a page that breaks. `test/pane-markdown.test.mjs` pins
it, including the two failures that matter: a document that renders as
something other than what it says, and a document that renders as markup it did
not ask for. A brief may be a file downloaded from anywhere, so its text is
escaped before anything marks it up, and a `javascript:` link keeps its words
and loses its anchor.

A YAML front-matter block at the top is dropped, and a later `---` is a rule —
which is what makes a Marp deck read as a document rather than as its own
source. A rendered page is framed `allow-same-origin` and therefore **without**
`allow-scripts`, the same as any other HTML document this serves.

The same widget served to ChatGPT or Claude Desktop is unchanged. The host
offers `openMaterial` or it does not, and `runtime.js` intercepts a click only
where it does — a capability, not a flag on the payload, so there is no second
code path in the view.

## What a student handed in

A mark says how much of the course someone has been assessed on. It does not
say what they wrote, and that is the question a professor asks when a mark
looks wrong. So each row of the class list carries a press — **3 submissions**
— that opens that person's work underneath it.

What is in there, per submission: when it was handed in, its status and attempt
where either is not the ordinary one, the professor's own note on it, then
**every answer** — the question as the student saw it, the option they chose
with that option's own text, the paragraph they typed, and the score with
whether it was marked correct. Then the files.

`chosen_options: [b]` is unreadable without the option's text, and a paragraph
of `raw_response` is unreadable without the question above it. Both halves or
neither.

### It opens closed, and that is not a detail

This pane gets screen-shared and thrown at lecture-hall projectors — the whole
reason the class list has a `Pseudonyms` press and a coloured rule when names
are showing. A view that unfolded every student's written answers on load would
put a room's work on the wall behind the lecturer. So every panel starts
`hidden`, one press opens one person, and `.row.work[hidden]` is declared
**after** `.row.work` on purpose: the two selectors score the same, the later
one wins, and with them the other way round every panel was open on load.

Rendered inline rather than fetched when pressed, and that is forced rather
than chosen. These documents are delivered into a frame with an opaque origin,
which may neither navigate itself nor `fetch`. There is no "load it when
pressed" available in here.

### Files, and the ones that are not here

A submission's file gets the same `open` chip a brief does, and opens in the
same overlay — but only when the document's `storage_key` is relative to the
repository. A key carrying a scheme says `held outside the workspace` instead.

That is the model's decision, not this view's omission.
`versions/<TERM>/samples/documents.yaml` says it in as many words: the bytes of
student work live in object storage and never in this repository, and student
work is referenced by pseudonymous identifier and nothing else. `sendMaterial`
refuses any key with a scheme, and a dead `open` link that returned a sentence
about object storage would be worse than no link at all.

A professor who does keep submissions under the course workspace gets the
overlay for nothing: a repository-relative key is served by the route a deck is
served by, and a PDF, an image, a text file or a markdown report paints in the
frame.

## Integrations

The tab exists because the facts are scattered. A professor asking "will a push
reach Canvas" has to know that the target is on the run record, that the course
id is on the run record **or** in its `extensions` and that `ainar lms push`
reads only one of the two, that the host is in a TOML file beside the roster,
that the token is an environment variable, and that Telegram is in a JSON file
under a different dot-directory again. Four of those are invisible from every
other tab.

Three sub-views: **Targets** (where an approved grade would go, and what
students would be told), **Credentials** (which of five environment variables
and three files hold something), and **Links** (the Canvas sections, and each
assessment's Canvas column).

**No credential is ever drawn.** Presence, the variable's name, the layer it
comes from, and the path it would be read from — never a value.
`/api/integrations` sends booleans; there is no field on the payload that could
carry a token. The Canvas *host* is drawn, because a hostname is not a secret
and a course id pointing at the wrong instance is precisely the failure this
tab is for.

### Typing a token in

**Credentials** has a field per variable the run's connections name. What is
typed there goes through `ctx.credentials` into the harness's managed store —
the same one the Models page writes API keys to — and never into a file in this
repository. The field is write-only in the strong sense: no route returns a
value, nothing pre-fills the box, and the box is cleared on every outcome,
success or refusal.

Three rules the route holds to, each for a reason worth keeping:

- **Only variables the registry names.** Anything else would make a
  browser-reachable route into a general-purpose writer for any environment
  variable on the machine.
- **A refusal is passed through, not smoothed over.** The credential seam
  rejects a write underneath a read-only layer, because a value exported in the
  launching shell would keep shadowing what was saved. The field is disabled in
  that case, with the reason beside it, rather than swallowing what is typed.
- **The pane degrades rather than disappears.** The seam is reached through a
  nested `ctx.inject` fiber, not the plugin's own `inject`, so a composition
  with no credential provider loses the field and keeps the outline, the inbox
  and the class list.

Chat is not one of the two places. A token pasted into a conversation is in the
transcript, the context window and the provider's request; the skills say to
refuse it and to tell the professor to reissue.

### Sending a definition to Canvas

**Links** ends with the one control in this pane that changes something a class
can see: it sends an assessment's *definition* — title, points, dates, what may
be handed in, and the brief as the Canvas description. Not the marks; those are
`ainar lms push` and are not reachable from here at all.

It spawns `ainar lms assignment-plan` / `assignment-push`, the way the approval
strip spawns `ainar approve`, and for the same reason: what counts as drift,
which fields this model has an opinion about, and how a created assignment's id
is written back into `courses/` all live in `ainar-node/src/lms/`, and a second
implementation in the plugin would have its own idea of all three. The LMS
write layer is deliberately absent from `dsh-ainar-course-model/server/`, which
is a read-only tool surface.

Four rules, each of which is the reason a button is shaped the way it is:

* **Preview first, always.** The red **Send to Canvas** button does not exist
  until a plan has come back. A professor who has not read what would change
  cannot send it, and changing the assessment or the subgroup throws the plan
  away so the red button can never send something other than what was read.
* **The plan names the host.** `Canvas: https://…` is its first line, because
  the host comes from a registry in the professor's home directory rather than
  from the course record — so which Canvas this is about is a fact to state,
  not one to leave the reader assuming.
* **Drift needs its own press.** A field somebody edited in Canvas is reported
  and left alone. Replacing it is a checkbox that appears only when the plan
  actually found drift, is refused by the route unless the same request is a
  send, and is cleared after every send so it cannot carry into the next one.
* **Every subgroup by default.** The selector opens on *Every subgroup*, which
  is what the command does: one definition serves the whole class, and a send
  that reached CS-401 and not CS-402 is how two halves end up being told
  different things.

`POST` only, like `/api/approve` — a plan makes Canvas answer, and that is not
something a prefetch or a replayed history entry should be able to fire.

### Selecting the Canvas sections

**Links** offers a `Fetch from Canvas` button. Pressing it reads
`GET /sections` and `GET /groups` for the run's Canvas course — the only
outbound request anywhere in this plugin — and lists what came back, each
labelled as a section or a student group, with its Canvas id and student count.
Ticking one records it; where the run has subgroups, a picker beside it says
which subgroup that section feeds, or leaves it feeding the whole run.

Saving writes `extensions.lms.canvas_sections` on the run record:

```yaml
extensions:
  lms:
    canvas_sections:
      - id: "9021"
        kind: section
        name: CSS-4008 Lecture 1
        group: CS-401
```

A list rather than a map keyed by subgroup, because a run taught as one cohort
would have no key to write under, and two Canvas sections feeding one subgroup
is ordinary. `group` absent means the whole run.

Unticking everything **removes** the key rather than writing an empty list, and
takes the emptied `lms:` and `extensions:` with it — so a run that was never
wired to Canvas reads exactly as it did before the tab was opened.

## Record, and record + drafts

A second control sits on the right of the segmented row: **Record** and
**+ drafts**.

A course lives in two halves. `courses/` is the record — what a person or `ainar
approve` wrote. `work/<RUN>/` is what the skills proposed and nobody has
accepted. Both are real, and a pane that showed only the first would report a
course as nearly empty while fifteen weeks of it sat one directory away.

- **Record** answers *what may a student be shown, and what may an LMS be given*.
- **+ drafts** answers *what would the term look like if every proposal were
  accepted*. The view carries a banner naming the directory it merged and saying
  nothing in it has been accepted.

It is off by default, and the pane never blends the two silently. The merge is
`loadDrafts` + `mergeDrafts` — the course model's own pair, the one behind `ainar
validate <COURSE> --drafts work/<RUN>` — so what appears here is what that
command validates, `DRAFTABLE`'s refusal of drafted outcomes, capabilities and
enrollments included.

`versions` is not draftable, so this cannot rescue an offering that does not
load. A `version.yaml` with no `start_date` has no run for a merged module to be
placed in, and the pane reports the loader's error like any other.

## Why there is no view code in here

`dsh-ainar-course-model` already ships four widget documents, assembled from
`widget-assets/` and bound to those four tools. Every MCP host that knows the
`ui` extension renders them; DSH does not, because `presentationMeta` is that
contract and DSH has no renderer for it. In that plugin's own words they are
"inert, not broken".

So this pane does not draw a term plan. It serves that plugin's document at a
URL with the payload already inside it, and puts the document in a frame. The
outline a professor sees here is byte for byte the one ChatGPT and Claude
Desktop get, from the same files, and there is no second implementation to
drift. The rules those files are held to — a view computes nothing, a blank is
never a zero, no network, no student's name, no `callTool` — hold here for free
because it is the same code.

What is drawn in this package is what no tool returns. The class list, the
Checklist, the assessment, slide and exam tables and the grading policy are
assembled in `index.js` and served as plain pages into the same frame.
Preferences and Integrations are drawn in `lib/client.js` instead, and the
reason is narrower than "no tool returns them": both carry a **form**, and the
frame is delivered as `srcdoc` without `allow-same-origin`, so a document
inside it has an opaque origin and cannot call back to the routes a Save needs.

## The two halves

```
index.js        host: one prefix route, /professor-pane
lib/client.js   browser: the pane, hand-written in the module loader's own form
cordis.patch.yml  the loader entry that makes both of the above load
```

`lib/client.js` is **not built**. Every client half under
`node_modules/@deepseek-ai` is a `window.__ModuleLoader__.load({ id, factory })`
registration, so that shape is the loader's contract rather than anybody's
private bundler artefact, and one file of plain ES2020 using
`React.createElement` is cheaper to keep true than a tsdown config this project
would otherwise not have. Add the bundler when this outgrows a few hundred
lines, not before.

### The routes

| Path | Answers |
| --- | --- |
| `GET /professor-pane/api/runs` | every course and offering in `AINAR_WORKSPACE` |
| `GET /professor-pane/api/preferences?course=&term=` | the preference layers, and the schema of what may be set |
| `POST /professor-pane/api/preferences?course=&term=` | write one layer; body is `{scope, values}` |
| `GET /professor-pane/api/integrations?run=` | what this run is wired to: target, Canvas course and host, spreadsheet, credential presence, per-assessment links, subgroups, recorded sections |
| `POST /professor-pane/api/credentials?run=` | store one credential; body is `{ref, value}`, an empty value clears it. Write-only: the response carries presence, never a value |
| `POST /professor-pane/api/canvas/catalogue?run=` | ask Canvas for this course's sections and student groups |
| `POST /professor-pane/api/canvas/selection?run=` | write `extensions.lms.canvas_sections`; body is `{selections}` |
| `GET /professor-pane/api/revision?session=` | a hash over every YAML under `courses/` and `work/`, for the pane's refresh poll |
| `GET /professor-pane/view/<outline\|progress\|gradebook\|tasks>?run=&dark=&drafts=` | one widget document with its payload embedded |
| `GET /professor-pane/view/checklist?run=&dark=` | what is not finished, drawn here — no widget behind it, and no `drafts=` |

`drafts=1` merges `work/<RUN>/` before computing the payload. The response says
what it did in `x-professor-pane-drafts` and reports the draft loader's own
complaints in `x-professor-pane-draft-issues`, percent-encoded on one line —
headers rather than payload fields, because the payload goes into a widget
document shared with two other hosts and has no place to print them.

Every view behind them is a read — `callTool` is read-only by construction —
and four routes are not:

* `POST /api/approve` spawns the CLI rather than reimplementing the gate.
* `POST /api/preferences` writes a preference layer.
* `POST /api/canvas/selection` writes `extensions.lms.canvas_sections`.
* `POST /api/canvas/catalogue` writes nothing here, but is the one route that
  reaches off this machine.

**None of them is an approval path**, which is the property that matters.
`AGENTS.md` says there is one and the professor runs it: `/api/approve` IS that
command, run as it would be run in a terminal, `--dry-run` until a preview has
been read. A preference is not a claim about a student — it is how the professor
wants the skills to behave. And a Canvas section id is a fact about the
professor's own LMS that only they know: no skill drafts it and no agent can
propose it, so it has no drafted half for `ainar approve` to promote, and
refusing it would only mean the fact stays settable by hand-editing YAML. A pane
that could accept a *grade* on its own would be the second path, and there is
still no route that does.

Every write goes through the model's own emitter or the comment-preserving
parser, because a professor also edits these files by hand and a file the pane
saved must not be distinguishable from one they wrote:

* `/api/preferences` uses `yaml-out`'s `dump`, the one `approve` uses and the
  one held to PyYAML byte for byte. It owns its file whole.
* `/api/canvas/selection` does not own its file at all — `version.yaml` opens
  with a comment explaining the version/run merge — so it goes through `yaml`'s
  `parseDocument`, replaces one key, and writes the rest back untouched, line
  endings included. Nothing in it can reach `start_date`, `status` or
  `instructors`.

`POST` on the Canvas catalogue even though it is a read, for the reason
`/api/approve` is POST: it spends the professor's API quota and sends a
grade-changing token, and a side effect behind a `GET` is one a link, a
prefetch, a refresh or a replayed history entry can fire without anybody having
decided to. Pressing `Fetch from Canvas` is deciding to.

### Which workspace a request is about

`?session=<id>` on every request, and the host turns that into a directory
through `ctx.workspaceRegistry` — so the pane follows the workspace picked in
the sidebar, and **no path ever crosses from the browser**. A `workspace=<path>`
parameter would have been fewer lines and a standing invitation to read any
directory on the machine by crafting one request, since these routes open YAML
and print it. A session id resolves only to a folder the professor registered.

The order is `ainar`'s own, with the session standing in for the professor's
working directory:

1. the nearest directory at or above the session's workspace holding `courses/`
2. `AINAR_WORKSPACE`
3. neither — and the failure names both, because either would fix it

Resolved per request, so switching workspaces in the sidebar, or exporting the
variable, needs no restart.

`workspaceRootFor` is imported from `dsh-ainar-course-model/server/mcp/
workspace.js` rather than written here, and that is the point: the course tools
resolve through the same function, so the tools and this pane cannot name
different courses on the same screen. It was briefly a twelve-line twin, kept in
step by hand, which is a bad trade for twelve lines — the drift would not have
been an error but a wrong number.

## The Checklist

Under **Tasks**, beside Pending and Ready. It answers the four questions a
course still being built raises, and it answers them together because a
professor asks them together:

| Section | The question |
| --- | --- |
| What is not created | outcomes, modules, meetings, assessments, rubrics, an instructor, a roster — how many of each, and how many weeks hold a module |
| Deadlines | which graded work carries no due date |
| Weights | do the declared weights come to 100%, and which assessments carry none |
| Slides | week by week: a deck in the course, a deck only proposed, or no deck |

Two things it does not do.

**It computes no figure of its own.** The weights are `course_outline`'s own
`grading` section — `total_weight`, `unweighted`, `complete`, and the sentence
the model writes when something is wrong, which names the assessments at fault
in a way a percentage cannot. The counts are the payload's `totals`. This is
not fastidiousness: an earlier `gradingDocument` did the arithmetic itself,
forgot that `weight` is a fraction of one, and reported a correct scheme as
"1%, not 100". A checklist that said *incomplete* while the Grading policy tab
one press away said *100%* would be the worst version of that bug, because the
professor would have no way to tell which half was lying.

**It takes no Record / + drafts toggle**, for `ready`'s reason and one of its
own: this view *is* the comparison. Every row says which half a thing is in —
amber for what nobody has written, blue for what is written and waiting for
`ainar approve` — so a setting that hid one half would remove the answer rather
than narrow it.

## Names, and where they are allowed

Two tabs can name a student — the class list and **Tasks** — and both draw the
same pair of buttons: **Names** and **Pseudonyms**. Names are the default, at
the professor's instruction; `Pseudonyms` is one press away for a projector.

The resolution is the same on both: `~/.ainar/roster/people.json`, read here,
held for the length of one response. `names=1` is sent only by those two tabs
and only affirmatively, so a URL replayed without it renders pseudonyms.

Tasks is the one place the pane puts a real name inside a WIDGET document —
`withStudentNames` adds a `people` map to the `action_inbox` payload before it
is embedded, and `action-inbox.js` falls back to the pseudonym when the field
is absent, which is what every other host sees. What is looked up is only the
ids already on the page, so a class of two hundred with three missing
submissions puts three names in the document.

Two things stay pseudonymous even there: the identifier under a row, because it
is what `whois`, the gradebook and a bug report all use; and the text of an
`ask` button, because that is a prompt going to a model and the model should
work in the record's own vocabulary.

There is no coloured band on Tasks, because the pane does not write inside a
widget. The warning there is the amber on the `Names` button itself, which is in
the pane's chrome and is the control that turns it off.

A long list of missing students is folded: two are named, the rest sit hidden in
the same document behind an `…` that opens them in place. Nothing is fetched on
press — the payload already carries them.

## What is computed once, and what is computed again

Three caches, none of which changes when a re-read happens — only what is
thrown away between requests.

**The course parse, per workspace root.** `YamlCourseStore` already stamps each
loaded course with the newest mtime under its directory and re-reads only when
that moves; `Workspace`'s own header explains why, since a course takes about a
second to parse. That cache was doing nothing here, because `resolveWorkspace`
built a `new Workspace(root)` per request and therefore a new store with an
empty map. The **store** is now kept per root and a fresh `Workspace` is built
around it, which keeps `origin` honest — it is only used to word the advice in
a "no workspace" error, and that advice differs by how the root was reached.
Measured on the sample course, one `course_outline` request went from 177ms to
23ms; a real course has more files.

**The revision hash, for one second.** `/api/revision` is polled every 2500ms
and the Checklist now keys its cache off the same hash, so a poll landing beside
a frame reload used to walk the tree twice for an answer that cannot have
changed between them. The window is well under the poll interval, so the poll
still gets a fresh walk every time it asks.

**The Checklist report, per revision.** It is the most expensive thing in
`index.js` — it builds the outline payload twice, once over the record and once
over the merge — and the key is that same revision hash. So the cache is
exactly as fresh as the pane itself: the hash that tells the browser to reload
the frame is the hash that invalidates what the frame is about to be served,
and there is no window in which the pane redraws and gets the previous answer.
The report is data, not HTML, because `dark` varies per request and the numbers
do not.

## Two things worth knowing before you change it

**It shadows the tool-call inspector.** `details` is a `single` slot and
`ui-conversation` already registers its tool-call inspector there at the default
priority 0. Registering at -1 wins (lowest renders), which means that inspector
is not reachable while this pane is loaded. Today that costs nothing: the only
thing that opens it is the `openDetails(target)` action handed to
`conversation.chat.node` registrants, and no shipped registrant calls it — the
panel is unreachable in the running harness either way, and the same data is in
the trajectory view. If a future DSH wires a "view details" control up, the
`priority: -1` in `lib/client.js` is the one line to reconsider.

**The frame is fed by `srcdoc`, not `src`.** The sandbox is `allow-scripts` and
deliberately not `allow-same-origin` — the widgets declare an empty CSP
allow-list and need no origin privileges, and granting both would be theatre
since a frame with both can remove its own sandbox attribute. Navigating such a
frame to a URL is the part that gets stopped: it fails with
`ERR_BLOCKED_BY_CLIENT` and the frame stays blank, while the identical document
in `srcdoc` under the identical sandbox paints, runs its script, and can
`postMessage` back. So the pane fetches the document — a plain same-origin read
— and hands it over. Nothing about the sandbox or the document had to be
relaxed.

## Opening it

The pane needs room. The layout's concession chain keeps the conversation column
at 640px and closes details rather than squeezing it, so with the sidebar open
(280px) the window has to be at least **1220px** wide for the pane to appear at
all; with the sidebar collapsed to its rail, 996px is enough. On a narrower
window the button appears to do nothing — the panel opens and is immediately
conceded back to zero width.

There is a **Course** button in the session header, beside the agent preset,
because nothing in the shipped harness opens the details column on its own.

## Installing

It is a `file:` dependency of the project, not of the profile, for the reason
`dsh-ainar-course-model`'s own `package.json` gives: pnpm cannot resolve a
`file:` spec whose absolute path contains a space. `npm install` in the project
root links it; the profile's `package.json` lists it as a bundle so its patch
layer applies.

```bash
npm install --legacy-peer-deps
```

Unlike `plugins/dsh-ainar-course-model` and `plugins/professor-skills`, this
directory is **not** vendored from anywhere — `exo setup` does not overwrite it,
and this is the place to edit it.
