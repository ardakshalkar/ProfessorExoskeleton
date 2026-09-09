# dsh-professor-pane

The right column of the DeepSeek Harness, as the professor's visualization pane.

Four buttons across the top of it — **Course outline**, **Progress**, **Tasks**,
**Preferences** — and under Progress a second pair, **Concepts** and
**Gradebook**. The header names the run and its term dates, and offers a picker
when the workspace holds more than one offering.

| Button | What it draws | Where it comes from |
| --- | --- | --- |
| Course outline | The term plan a student reads: outcomes, the assessment table with declared weights, then week by week with each week's module, meetings and deadlines | `course_outline` |
| Progress · Concepts | Concepts in teaching order against students by pseudonym, with the mean proportion of marks earned on evidence tagged with each | `class_progress` |
| Progress · Gradebook | One score per student per assessment, from approved decisions only, with the rows that must not be exported and the reason for each | `gradebook` |
| Tasks | Grades awaiting approval, outstanding submissions, open signals, interventions, upcoming deadlines | `action_inbox` |
| Preferences | The DataLayer preference layers, each with its own file path and its own values | the preference files |

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

Preferences is the one view drawn in this package, because no tool returns
preferences.

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
| `GET /professor-pane/api/preferences?course=&term=` | the preference layers |
| `GET /professor-pane/api/revision?session=` | a hash over every YAML under `courses/` and `work/`, for the pane's refresh poll |
| `GET /professor-pane/view/<outline\|progress\|gradebook\|tasks>?run=&dark=&drafts=` | one widget document with its payload embedded |
| `GET /professor-pane/view/checklist?run=&dark=` | what is not finished, drawn here — no widget behind it, and no `drafts=` |

`drafts=1` merges `work/<RUN>/` before computing the payload. The response says
what it did in `x-professor-pane-drafts` and reports the draft loader's own
complaints in `x-professor-pane-draft-issues`, percent-encoded on one line —
headers rather than payload fields, because the payload goes into a widget
document shared with two other hosts and has no place to print them.

Everything behind them is a read. `callTool` is read-only by construction and
the preference files are opened with `readFileSync`; there is no write verb in
`index.js` and no place to add one. A pane that could approve a grade would be a
second approval path, and `AGENTS.md` says there is one and the professor runs
it.

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
