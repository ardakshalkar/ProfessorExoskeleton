# dsh-professor-pane

The right column of the DeepSeek Harness, as the professor's visualization pane.

Six buttons across the top of it — **Course outline**, **Students**,
**Progress**, **Tasks**, **Preferences**, **Integrations** — and under most of
them a segmented row of sub-views. The header names the run and its term dates,
and offers a picker when the workspace holds more than one offering.

| Button | What it draws | Where it comes from |
| --- | --- | --- |
| Course outline | The term plan a student reads: outcomes, the assessment table with declared weights, then week by week with each week's module, meetings and deadlines. Every piece of graded work carries a link to the brief students read, or says it has none — and every week says what it is still waiting for | `course_outline` |
| Students | The class list by subgroup, named or pseudonymous, with each student's marks so far, and under each row what they actually handed in | the enrollments, `gradebook` for the marks, and the run's submissions and item responses |
| Progress · Concepts | Concepts in teaching order against students by pseudonym, with the mean proportion of marks earned on evidence tagged with each | `class_progress` |
| Progress · Gradebook | One score per student per assessment, from approved decisions only, with the rows that must not be exported and the reason for each | `gradebook` |
| Tasks | Work with no date and a button that sets one, grades awaiting approval, outstanding submissions, open signals, interventions | `action_inbox` |
| Preferences | The DataLayer preference layers, each with its own file path and its own values | the preference files |
| Integrations | What this run is wired to outside the workspace, and what it is not: the gradebook target, the Canvas course and host, the spreadsheet, which credentials are present, and which Canvas section feeds which subgroup | the run record, `lms.toml`, `connections.json`, the environment |

## Course mode

**Course mode**, beside Publish in the header, opens the whole term over the
harness: one grid, week 1 to week N, in three columns — **Lecture** (each
meeting with its own materials, the deck first), **Graded work** (one column,
the type on the chip and the weight in bold) and **Outcomes** (what the week's
module teaches, and in green what work falling due in it assesses). It is step
four of [`COURSE-MODE.md`](COURSE-MODE.md), designed in
[`prototype/`](prototype/README.md) first.

Every hole on it is a press that names what it starts — *Draft deck*, *Plan
module*, *Check date*, *Set weight*, *Write brief*, *Set dates* — and sends a
prompt naming the week, the module and the records into the open session. The
overlay then closes, so the professor lands on the turn they started: the
conversation is underneath, not replaced, which is the "chat as a button" half.
Holes are ranked by the payload's `weeks[].urgency` — this week and next
filled, later outlined, weeks already taught grey — and the strip counts them
the same way from `totals.gaps_by_urgency`. Runs of two or more unplanned weeks
fold into one band; work with no date goes in a card before week 1.

Three readings, switched in its header, opening on **Teaching** while the run
is under way (today between its start and end dates) and on **Planning**
otherwise:

* **Planning** — does the term hold together. The weights by kind of work
  against 100%, the faults as sentences with one press each (weeks with no
  topic, runs of weeks nothing graded touches, work with no dates, weights that
  do not add up), and one row per week with its topic and the graded work as
  lanes from the week it opens to the week it is due. Structure only.
* **Teaching** — this week between the last and the next. The week in focus
  (meetings and materials, a date off its week in plain words, the missing
  deck, what is due with how much is handed in, and *Revisit first*: concepts
  from the two weeks before under a 60% class mean, and the open signals),
  with its neighbours either side and ‹ › through the term. The only reading
  that carries class figures — it reads `class_progress` and `action_inbox`
  as well as the outline, says it is private, and offers no student preview.
* **All weeks** — the three-column term table described above.

It shares the pane's Record / + drafts state, and adds **Preview as student**:
the record alone with no hole drawn, which is what `ainar page` publishes.
Escape, the backdrop or × closes it; a deck opened from it lands on top of it
and closes first.

Why a page of the pane's own rather than the widget: the widget is one column
by construction — it is what ChatGPT and Claude Desktop draw beside a reply,
and what the public page renders — and the layout declares no full-width seat,
so this takes the material overlay's idiom. `lib/course-mode.js` draws it on
the host, from the same payload with the same material links, into the same
sandboxed frame, sending the same two messages (`ask`, `view`).

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

## Scans

A scanned pile goes through six steps — Identify, Match, Read, Rubric, Grade,
Approve — and each is already a command or a skill. The tab says where a pile
stands and whose move it is, as a bar of six with the one that is yours in
amber, and draws one step in full: **Match**, because who a paper belongs to is
the one question only the professor can answer. The others are the
assistant's to draft, so when one of them is next the tab offers a press that
asks it, with the prompt already written.

Match has two lanes. **Check** holds the papers placed on a close spelling
(`match: close`): Confirm pins the student, Someone else picks from the class.
**Held** holds the ones not placed: the nearest students as one-press answers,
the whole class in a picker, and Not a student. Every card shows the top of
the paper — the printed title and the Name line — because a transcription the
professor cannot see is one they are asked to trust. `j`/`k` move between
cards and Enter takes the first answer.

Every answer goes through `ainar scans assign`, which writes `student:` (or
`skip:`) into the plan and places the paper by the same rules `scans apply`
places every paper. Moving a paper that was placed on the wrong student takes
that placement back first — the folder is kept aside in `_inbox/_unplaced/`,
the submission and its drafted answers are removed, and what was read off the
paper follows it to the right student. It is refused once there is an
evaluation on it: then it is a grade to reconsider, not a placement to undo.

**Review all name matches** opens every correspondence at once, as big cards
over the conversation: the name line, the name as read, the roster name. Two
sections. *Matched by name* is every paper the roster placed and nobody has
confirmed, close spellings first; each starts as "them", and pressing a card
turns it to "not them". *Suggested* is every held paper with a nearest student;
each starts as "leave held", and pressing turns it to "them". One press —
Confirm 44, or Confirm 43 · reject 1 — sends the whole list to `scans assign
--assignments`, which checks it whole and applies once. A rejected paper keeps
`not: [STUDENT-…]` in the plan: the name no longer places it and that student
is never suggested for it again, so it waits in Held for the professor to name.

On Pseudonyms the cards keep their buttons but drop the written names and the
crops, because the crop *is* the handwritten name, and the review is not offered.

### Grading, question by question

**Grade the answers** appears in the Scans tab once one answer is recorded,
and opens over the conversation (`GradeBoard` in `lib/client.js`, the payload
in `lib/grade.js`, which is `ainar grade status --json` with names added).
Questions are tabs across the top, each with how many of its answers are
decided. What the body draws depends on where the rubric stands:

* **No rubric** — the question, its marking guidance, and every answer as
  read. Ask the assistant to propose rubrics: it groups the answers into
  `groups.yaml` beside the scans and proposes two or three rubrics over those
  groups (`/import-assessment` §7) — one from the marking scheme the exam
  already carries, one from what the class wrote. Or ask for just one, or
  **Grade by points only**, which writes one criterion per question worth its
  marks, accepted.
* **Rubrics proposed** — per question, the proposals side by side: each one's
  levels, how many answers it puts at each, and the class mean it would give.
  **Use for Q1** writes that proposal as Q1's criterion (`grade choose`);
  **Use for every question** does them all. Questions can come from different
  proposals. The rubric is a draft until accepted, and a question that already
  has marks decided cannot have its rubric swapped.
* **Rubric proposed** — the levels top down, each with the groups of answers
  the assistant placed there and their counts; an unsure group is outlined.
  Open a group to read its answers; move it with its select (`grade move`).
  **Accept rubric** turns the assessment's `approval: draft` into `approved`.
* **Rubric accepted** — the question opens with its picture: per mark, how
  many answers sit there (decided in green, still only suggested in grey) and
  the class mean. Each group is headed by the mark it is at. Each card carries
  its mark as a badge — green with a tick once decided, grey "suggested"
  before — then the answer as read, the reading's confidence and note, and a
  row of marks (the levels, or 0…max in halves for a short question). No
  dashes: unsure is a word, not an outline.

  **Rubric and rethink** opens the rubric beside the page while grading. Move
  a group to another mark and every suggestion in it, the picture and the mean
  recalculate. Type what should change and **Ask the assistant to rethink**:
  it adds a revision as a new proposal in `groups.yaml`, which the view polls
  (`/api/grade/stamp`) and shows as soon as it is written — with what it would
  move, how many suggestions change and how many decided marks it would
  disagree with. **Use this** applies and accepts it in one press
  (`grade choose --keep-marks --accept`). Decided marks stay; each one the
  rubric now suggests differently says so, with *Give N*, and the picture
  offers **Re-mark all N at the rubric's suggestion** — every old mark kept
  in its history. On the right, the page of the answer in focus, large
  enough to read the handwriting; press it to enlarge. Then blanks, then
  papers not read yet — which are never suggested a zero. `j`/`k` move, a
  digit gives that mark, Enter takes the suggestion on an undecided answer
  (on a decided one it only moves on), and each moves to the next undecided
  answer. Each group has **Accept N**; the foot has **Accept all** for the
  question and for every question.

Every mark is `ainar grade decide`, spawned like `scans assign`. It writes
`professor_decision` with `decided_by` (the run's first instructor) and
`decided_at`, sets `approved` or `overridden` against the suggestion, keeps
the group's suggestion as `ai_suggestion` so agreement can be measured later,
and records `extensions.decided_via` — `one`, `group` or `all`. A decision it
changes is moved onto `extensions.history`, never overwritten. Accept all is
allowed (2026-10-02); the history is what keeps it honest.

On Pseudonyms the first page is drawn from below the name line — the same two
inches the name crop shows — and the cards carry pseudonyms.

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

It spawns `ainar lms assignment-plan` / `assignment-push`, the way the Publish
button spawns `ainar publish`, and for the same reason: what counts as drift,
which fields this model has an opinion about, and how a created assignment's id
is written back into `courses/` all live in `ainar-node/src/lms/`, and a second
implementation in the plugin would have its own idea of all three. The LMS
write layer is deliberately absent from the course model's tools, which are a
read-only surface.

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

`POST` only, like `/api/publish` — a plan makes Canvas answer, and that is not
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

## The Publish button

Beside the course title in the header, on every tab, whenever the pane has an
offering to be about. It is there rather than in the six buttons because every
other control in this header chooses what to **look at**, and this is the only
thing in the pane whose result somebody outside this machine ever sees.

One dialog, five buttons — **Course page**, **Telegram**, **Homework repo**,
**Canvas brief**, and **Update everywhere** — over the whole pane rather than
beside the list, the shape the homework publish already had and for its reason:
a plan runs to twenty lines and a three-hundred-pixel column turned it into a
sliver reported as "the button doesn't do anything".

**Update everywhere** is the fifth and it is a mode rather than a place: every
destination this run has already been published to, and no new ones. It is the
answer to having edited one deck and not remembering which four places it
reached. An announcement is listed there and skipped, because nothing can
re-derive the words you typed — under the announcement box there is a checkbox
that corrects the last message in the channel instead of posting a second one,
off by default and deliberately so.

Two presses per target, and the first is the one worth naming. It runs
`ainar publish <target>` with no `--confirm`, which reads and writes nothing —
not to `courses/`, not to GitHub, not to a channel — and prints **what it would
publish**, what it would hold back, and **the drafts it would leave out**. Only
then does the red button appear, and it says what it will do rather than
"Publish": *Write the page*, *Send to the channel*, *Publish to GitHub*, *Send
to Canvas*. Editing anything — the target, the assessment, a word of an
announcement — throws the plan away, so the red button can never send something
other than what was read.

**Publishing approves nothing.** A deck drafted an hour ago is a `Document` in
the course marked `approval: draft`, and `ainar publish` leaves it out and names
it — *Not published — 1 draft(s) nobody has approved yet*. Getting it onto the
page is the professor changing that word in its record and pressing again; the
pane has no control that does it for them. (From 2026-09-21 to 2026-09-29 the
confirming press promoted drafted documents and resources out of `work/` on the
way; that went with `ainar approve`.) `publish homework` and `publish canvas`
refuse an assessment still marked draft.

**And it notices what you edited.** A material changed in place since it was
recorded — the commonest change there is, and the one that used to need a new
identifier nobody wanted to write — appears in the plan as *DOC-4410 changed
since it was recorded*, and the publishing press brings the record back into
line with the file. A rendering whose source changed and which nobody rebuilt is
held back rather than published as a picture of the old text, and keeps being
reported until it is rebuilt. `ainar-node/src/freshness.ts` has the two rules
that were found by running it.

**And it knows whether this is the first time.** The plan opens with
`Last published … to …` and the materials that have moved since, or says that
nothing has been published here before. That memory is the run's sync ledger in
`~/.ainar/sync/`, which is where `lms push` already keeps what it sent — the
pane reads none of it directly; it is in the CLI's output, like everything else
in this dialog.

What it cannot be made to do: accept a draft of any kind, a deck or a grade.
See `runPublish` in `index.js`, and `ainar-node/src/publish.ts` for why a
publish that also approved was two decisions behind one button.

The announcement box is the only thing in the pane a professor composes rather
than picks, and it is sent as typed: the command composes nothing, and the plan
shows the channel's own name — from Telegram, not from the record — before
anything can be sent, because a chat id is unreadable and a message sent to last
term's channel cannot be recalled.

## Record, and record + drafts

A second control sits on the right of the segmented row: **Record** and
**+ drafts**.

A course is one bundle read two ways. Everything lives in `courses/`, and each
record says whether anyone has accepted it: `approval: draft` (a grade
`status: suggested`) is what the skills proposed and nobody has accepted yet; no
`approval`, or `approval: approved`, is the professor's own. A pane that showed
only the accepted half would report a course as nearly empty while fifteen weeks
of proposals sat in the same files.

- **Record** answers *what may a student be shown, and what may an LMS be given*.
  It is `approvedView` — the course model's own filter, the one the page, the
  gradebook and the LMS push read — so what appears here is what they would see.
- **+ drafts** answers *what does the course look like as it stands, every
  proposal included*. The view carries a banner saying some of it has not been
  accepted, and the outline marks each drafted meeting, resource or assessment
  from the payload's `draft: true`.

It is off by default, and the pane never blends the two silently. Drafts are
validated in place, with everything else, by `ainar validate <COURSE>`.

An offering that does not load is not rescued by either half. A `version.yaml`
with no `start_date` has no run for a module to be placed in, and the pane
reports the loader's error like any other.

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
| `POST /professor-pane/api/publish?run=` | plan or perform one publication; body is `{target, assessment, repo, group, message, edit, confirm}`. Without `confirm` it reads and writes nothing |
| `POST /professor-pane/api/approve` | gone since 2026-09-29: answers 410 and says where approval went |
| `GET /professor-pane/api/revision?session=` | a hash over every YAML under `courses/`, for the pane's refresh poll |
| `GET /professor-pane/api/scans?run=&assessment=&names=` | the Scans tab: the run's scanned piles, the six steps with how far each has got, every planned paper with its lane and candidates. Written and roster names only with `names=1` |
| `GET /professor-pane/api/scans/crop?run=&assessment=&file=&pages=` | the top of a paper's first page — the name line — as PNG, drawn by `pdftoppm` and kept in the private `_inbox/_crops/` |
| `POST /professor-pane/api/scans/assign?run=&assessment=` | say who papers are; body is one `{pages, file, student \| reject \| skip}`, or `{papers: [...]}` of them from the review. Spawns `ainar scans assign --assignments` |
| `POST /professor-pane/api/scans/apply?run=&assessment=` | spawn `ainar scans apply` again, after a hand edit of the plan |
| `GET /professor-pane/api/grade?run=&assessment=&names=` | the Grade view: per written question its criterion and levels, its groups, and every answer with its reading, suggestion and decision. Names only with `names=1` |
| `GET /professor-pane/api/grade/page?run=&assessment=&student=&page=&names=` | one page of a student's scan as PNG, kept in their private `_pages/`; without `names=1` page 1 starts below the name line |
| `POST /professor-pane/api/grade/decide?run=&assessment=` | the professor's marks; body is `{decisions: [{student, item, score, comment?}], via: one\|group\|all}`. Spawns `ainar grade decide` |
| `POST /professor-pane/api/grade/move?run=&assessment=` | a group to a level, `{item, group, score}`, or one answer to a group, `{item, student, to}`. Spawns `ainar grade move` |
| `POST /professor-pane/api/grade/choose?run=&assessment=` | one of the proposed rubrics for one question or all, `{proposal, item?}`. Spawns `ainar grade choose` |
| `POST /professor-pane/api/grade/accept-rubric?run=&assessment=` | the rubric accepted. Spawns `ainar grade accept-rubric` |
| `POST /professor-pane/api/grade/points-only?run=&assessment=` | no written rubric: one criterion per question. Spawns `ainar grade points-only` |
| `GET /professor-pane/view/<outline\|progress\|gradebook\|tasks>?run=&dark=&drafts=` | one widget document with its payload embedded |
| `GET /professor-pane/view/checklist?run=&dark=` | what is not finished, drawn here — no widget behind it, and no `drafts=` |
| `GET /professor-pane/view/course?run=&dark=&drafts=&student=&mode=` | course mode, drawn here: `mode=planning` (structure), `mode=teaching` (this week, with class figures), otherwise the three-column term table; `student=1` draws the record alone, no hole, and is ignored for teaching |

`drafts=1` computes the payload over the whole course, drafts included; without
it the payload is computed over `approvedView`. The response says which in
`x-professor-pane-drafts` (`merged` or `record-only`) — a header rather than a
payload field, because the payload goes into a widget document shared with two
other hosts and has no place to print it. `x-professor-pane-draft-issues` is
still read by the client, but there is no draft directory to fail to load any
more, so it is not sent.

Every view behind them is a read — `callTool` is read-only by construction —
and four routes are not:

* `POST /api/publish` spawns `ainar publish`, which publishes what the
  professor has accepted and names the drafts it left out.
* `POST /api/preferences` writes a preference layer.
* `POST /api/canvas/selection` writes `extensions.lms.canvas_sections`.
* `POST /api/canvas/catalogue` writes nothing here, but is the one route that
  reaches off this machine.

The Scans and Grade writes (`/api/scans/assign|apply`, `/api/grade/…`) spawn
the CLI and are described with their tabs above.

**None of the four above is an approval path.** Accepting a record is the
professor changing `approval: draft` in its file, or writing their
`professor_decision` beside a grade's suggestion. `/api/approve`, which once
spawned `ainar approve`, was removed with that command on 2026-09-29 and
answers 410. **The Grade view is the deliberate exception (2026-10-02):** its
marks and its Accept rubric are the professor deciding, so they write the
decision — through `ainar grade`, which stamps who and when, records whether
it was one answer, a group or Accept all, and keeps any decision it replaces.
The assistant has no tool that calls them, and the professor preset tells it
never to run `grade decide` or `grade accept-rubric` without the professor's
word in that turn. A preference is not a claim about a student — it is how the professor wants the
skills to behave. And a Canvas section id is a fact about the professor's own
LMS that only they know: no skill drafts it and no agent can propose it, so it
has no drafted half for anyone to accept, and refusing it would only mean the
fact stays settable by hand-editing YAML.

`/api/publish` is the case that tests that sentence, so it is worth being exact.
It approves nothing: every record still marked draft is left out and named in
the plan, and that is enforced inside `ainar publish`, so no argument this route
could send would change it. A pane that could accept a deck or a *grade* on its
own would be a second path, and there is no route that does.

Every write goes through the model's own emitter or the comment-preserving
parser, because a professor also edits these files by hand and a file the pane
saved must not be distinguishable from one they wrote:

* `/api/preferences` uses `yaml-out`'s `dump`, the one every record writer uses
  and the one held to PyYAML byte for byte. It owns its file whole.
* `/api/canvas/selection` does not own its file at all — `version.yaml` opens
  with a comment explaining the version/run merge — so it goes through `yaml`'s
  `parseDocument`, replaces one key, and writes the rest back untouched, line
  endings included. Nothing in it can reach `start_date`, `status` or
  `instructors`.

`POST` on the Canvas catalogue even though it is a read, for the reason
`/api/publish` is POST: it spends the professor's API quota and sends a
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

`workspaceRootFor` is imported from `@ainar/core/src/workspace.ts` rather
than written here, and that is the point: the course tools
resolve through the same function, so the tools and this pane cannot name
different courses on the same screen. It was briefly a twelve-line twin, kept in
step by hand, which is a bad trade for twelve lines — the drift would not have
been an error but a wrong number.

## What a week is still waiting for

The questions the Checklist asks of the course, asked of each week and drawn
on it: a press under the week's title that says what it starts — *Plan
module*, *Draft deck*, *Check date*, *Set weight* — with the model's own
sentence behind it, and a tally under the strip ranked by when the holes bite:
*4 this week or next · 8 later · 6 in weeks taught*.

Since 2026-10-01 each chip is a button, not a label: it asks, naming the week,
the run, the module and the records, exactly as the "set date" press always
did. The rank is `weeks[].urgency` and the tally `totals.gaps_by_urgency`, both
from `outline.ts`. *Check date* is the fifth question, `misdated`: a meeting
drawn under its module's week while its own date is outside that week — four
lectures on CSS-4008, whose run-weeks start on a Tuesday while its lectures move
to Mondays. The model names them and moves nothing; which fact is wrong is the
professor's to say. On this surface only, runs of two or more unplanned weeks
fold into one band, undated work moves to a card above week 1, and graded work
is ink rather than red, because here red means missing.

The chips come from `weeks[].gaps` on the outline payload, computed in
`ainar-node/src/outline.ts`. The view neither counts nor decides: a gap names
the records it is about, and the rule that a week with no meeting is **not**
missing a deck lives with the model, beside the placement rules it belongs
with. The Checklist's Slides column now reads the same field rather than
answering the question a second time, so the chip on week nine and the row
about week nine cannot disagree — which is the failure a checklist beside a
plan exists to avoid.

Two of the four are not chips, because they are already on the week in plainer
words. A week with no module says **Unplanned** in its own header, and a piece
of work with no deadline already carries `no date` and the button that starts
the conversation which sets one. The tally counts all four, so it can read
higher than the chips on screen: six unplanned weeks and eight without a deck
is fourteen weeks waiting on something, and all fourteen say so.

**The public page draws none of it.** `sections.gaps` is the one section flag
that is opt-*in* — every other defaults to shown, because a surface that says
nothing is a chat client with nowhere else to put it, while a surface that says
nothing is also `ainar page`. What the professor has not written yet is a fact
about the course and not about anybody in the class, which is what lets it ride
on a shared payload at all; it is still nobody's business on a page written for
students. `page.test.ts` pins that, and `widgets.test.ts` pins the other half —
that a view which asks does get them.

## The Checklist

Under **Tasks**, beside Pending and Ready — Ready being what is marked
`approval: draft`, collection by collection, against how many of each are
already accepted. It answers the four questions a
course still being built raises, and it answers them together because a
professor asks them together:

| Section | The question |
| --- | --- |
| What is not created | outcomes, modules, meetings, assessments, rubrics, an instructor, a roster — how many of each, and how many weeks hold a module |
| Deadlines | which graded work carries no due date |
| Weights | do the declared weights come to 100%, and which assessments carry none |
| Slides | week by week: a deck in the course, a deck only proposed, or no deck |

Two things it does not do.

**It computes no figure of its own**, and since the weeks began drawing their
own gaps it does not decide one either: whether a week is still missing its
deck is `weeks[].gaps`, so the Slides column and the chip on that week are one
answer read twice. What stays here is the record/draft split, which needs two
payloads the model only ever sees one of. The weights are `course_outline`'s own
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
amber for what nobody has written, blue for what is written and still marked
`approval: draft` — so a setting that hid one half would remove the answer
rather than narrow it.

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
over the whole course, drafts included — and the key is that same revision hash. So the cache is
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
