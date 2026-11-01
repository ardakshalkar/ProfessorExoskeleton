# The context packet

The spec for [`BACKLOG.md`](../../BACKLOG.md) UI-1: for every control in the
pane that sends something to the session or starts work, what it sends today
and what it should carry, so the assistant never has to ask "which one?". It is
a table, not code. UI-2 builds the envelope it describes, UI-3 turns it into
the turn's opening context, and TODO-5, STP-3 and HOME-12 each wait on a press
that carries its record.

Read on 2026-11-01, against the sources in `client/`, `client/course/`,
`server/`, `shared/` and `vendor/ainar/mcp/widget-assets/`. The bundle
`lib/client.js` was not read. Line numbers drift; the label and the file are
the stable part.

## How a press reaches the session today

There is one road, and it carries one string.

* **`ask(text)`**, made per session in `client/main.js:68`:
  `session.prompt([{ type: "text", text }], "queue")`. It queues a turn and
  never steers a running one. Everything that "asks the assistant" ends here.
* **`mention(text)`**, `client/main.js:94`: appends the text to the composer's
  draft and sends nothing. The professor finishes the sentence.
* **`fresh`**, `pane.js:987` (`startChatWith`): a new chat, with
  `{ mode, draft, compose: true, run }` carried into the new place's composer.
  This is the only press that carries anything structured, and that structure
  goes to the new chat's pane, not to the session.
* **Frames.** The vendored widgets call `window.openai.sendFollowUpMessage`,
  which `server/page.js:80` turns into
  `postMessage({ source: "professor-pane", kind: "ask", prompt })`. Served
  pages (Students, the exam window, course mode's server twin) post the same
  `ask` from a `data-ask` attribute. `client/pane.js:322` hands `data.prompt`
  to `ask` unchanged. Every other posted `kind` (`grade`, `scans`, `upload`,
  `publish`, `concepts`, `syncs`, `defence*`, `setting`, `curve`, …) is handled
  in the pane and never reaches the session. The one exception is `defence`,
  which reaches it after a server round trip.

So UI-2's own wording needs one correction. The `{source, kind: 'ask', prompt}`
envelope is posted from `server/page.js` (and from the served pages'
`data-ask` handlers), not from `index.js`. The place the packet must survive
to is `ask` in `client/main.js`, because that is where the string becomes a
turn.

**The place already exists and is thrown away.** `placeNow()`
(`client/materials.js:501`) builds `{ view | mode, sub, week, student, concept,
focus, kind }` on every move, and `shared/route.js` writes it into the URL with
the open windows (`grade`, `scans`, `desk`). It goes to the URL and the
navigator and nowhere else. The only place-words any message carries are the
composer's suffix, `(Asked from course mode — Weeks · Teaching, run R.)`: the
crumb's labels, not its ids.

## The packet

```text
{ prompt, context }

context = {
  v: 1,                       always · this spec's version
  control: "outline.gap.deck",always · which control, a stable id (column "Control id" below)
  intent: "ask",              always · "ask" | "mention" | "fresh"
  run: "CSS-4007-2026-FALL",  always · the run the pane is on, even when the prompt names it
  place: { … },               always · placeNow() as it is, plus the open windows
  layer: "record",            always · "record" | "drafts": the Drafts switch
  names: "pseudonyms",        always · "names" | "pseudonyms": what was on screen
  preview: false,             course mode only · Preview as student

  subject: { kind, id },      per control · the one record the press is about
  related: [{ kind, id }],    per control · other records the press names
  gap: { kind, tier },        gap chips only · deck | module | misdated | weight | brief | dates
  step: "grade",              scan-pile presses only · the pile step on screen
  seen: { … }                 per control, optional · a figure the professor was looking at
}
```

**`place`** is `shared/route.js`'s shape and nothing new: `view` *or* `mode`
(`planning`, `teaching`, `evidence`, `term`), `sub`, and whichever of `week`,
`student`, `concept`, `focus`, `kind` the place holds, plus the windows over it
(`grade`, `scans`, `desk: { assessment, student }`). A press inside a window
(the Grade window, Scans, the defence desk, Upload, Publish) still carries the
place under the window, so the session knows both. Reusing `placeToHash`'s
vocabulary means the packet and a link can never disagree, and the session can
be told "the professor is at `#/weeks/teaching?week=7`" as one fact.

**`subject.kind`** is one of: `run`, `week`, `module`, `meeting`, `assessment`,
`item` (a question of an assessment), `submission` (`{ assessment, student }`),
`student`, `concept`, `signal`, `action` (an inbox action), `proposal` (a
rubric proposal or a grading-policy proposal), `document`, `resource`, `file`
(a workspace path), `pile` (the scans of an assessment), `policy`.

Rules the packet keeps:

1. **Ids, never names.** A student is `STUDENT-3BCIXS` even in Names mode,
   which the pane's own prompts already hold to ("Pseudonyms and ids only",
   `shared/course-words.js:179`). `names` says what was on screen, so the
   session can answer in kind. It is not a licence to send names.
2. **The packet does not replace the prompt.** The prompt stays the sentence
   (the skill, the question, "change nothing until I say"). The packet is what
   the sentence would otherwise have had to spell out, and what a session
   would otherwise have to search for. Where today's prompt carries an id and
   the packet carries the same id, the packet wins if the two disagree.
3. **`seen` is optional and small.** A figure is carried only when the prompt
   is about it (a class mean of 41% on "Ask why"), and never instead of the
   session reading the record. The pane computes no figure, and a figure in
   the packet is one the pane was given.
4. **A press with no session-facing half carries no packet.** A route that
   writes a record (`/api/grade/decide`, `/api/plan/dates`, …) already names
   its ids in the query and the body, and the session never sees it. Those are
   listed in the second table only for completeness.

## Table 1: controls that reach the session

55 controls. "Sends today" reconstructs the prompt, with interpolated values in
`<>`. "Should carry" lists what goes in `context` beyond the always-present
fields (`run`, `place`, `layer`, `names`, `intent`, `control`). "Gap" is what
the assistant would have to ask or search for today.

### Course mode (`client/course/`, `client/materials.js`)

Course mode's server page (`server/course-mode.js`) draws the same controls
from the same `shared/course-words.js` templates. Since 2026-10-16 it is only
a standalone tab and a test reference, so its twins are not rows. Their lines
are given in the gap column where the twin differs.

| # | Place | Control (label) | Control id | File:line | Sends today | Should carry | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | All weeks · lecture cell | Check date (gap chip) | `term.gap.misdated` | `course/term.jsx:113` | `promptFor("misdated")`: `<activity_id> is drawn under week <n> of <run> (<module_id>, "<title>"), but its date falls outside that week…` | `subject: meeting`; `related: [week, module]`; `gap: {misdated, tier}`; `seen: { scheduled_at, week_start, week_end }` | The meeting's date and the week's bounds are on screen and not sent, so the first step is reading them back. |
| 2 | All weeks · graded-work cell | Write brief | `term.gap.brief` | `course/term.jsx:139` | `<assessment_id> in week <n> of <run> (<module_id>, …) has no brief students can read. Draft one … with /design-assessment…` | `subject: assessment`; `related: [week, module]`; `gap: {brief, tier}` | Small: the ids are in the words. Missing: the place, and whether the assessment is itself a draft. |
| 3 | All weeks · week head | Plan module | `term.gap.module` | `course/term.jsx:174` | `Week <n> of <run> has no module. Propose what it should teach, given the weeks either side…` | `subject: week`; `related: [module of week n−1, module of week n+1, assessments due in week n]`; `gap` | "The weeks either side" is a search. The neighbouring module ids are on screen. |
| 4 | All weeks · week head | Set weight | `term.gap.weight` | `course/term.jsx:174` | `What should <assessment ids> in week <n> … be worth? The weight is mine to set; propose one and wait.` | `subject: week`; `related: [assessment…]`; `gap`; `seen: { weights by kind, grading note }` | The current weights and the policy's note are on screen in Planning, not here, and not sent. |
| 5 | All weeks · week head | Prepare | `term.prepare` | `course/term.jsx:177` | `For week <n> of <run> (<first module_id>), what should I teach and what should I revisit first?` | `subject: week`; `related: [every module, concepts, meetings, assessments of the week]` | Only the first module of a week that has several. No concept, meeting or assessment ids. |
| 6 | All weeks · lecture cell | Draft deck | `term.gap.deck` | `course/term.jsx:195` | `Draft the slides for week <n> of <run> (<module_id>, "<title>") with /make-materials. It meets in <meeting ids>…` | `subject: week`; `related: [module, meetings]`; `gap` | First module only. Otherwise the best-carried press in the pane. |
| 7 | All weeks · band of empty weeks | Plan weeks a–z | `term.band.plan` | `course/term.jsx:251` | `Weeks <a>–<z> of <run> have no module. Propose what they should teach, given what comes before them and what falls due in them…` | `subject: { kind: week, id: [a…z] }`; `related: [module before a, module after z, assessments due in a…z]` | "What comes before" and "what falls due" are both searches. |
| 8 | All weeks · "not on the calendar" lead | Set dates | `term.lead.dates` | `course/term.jsx:286` | `datesPrompt`: `…what are the open and due dates for <assessment_id> ("<title>")? … set opens_at and due_at on the <id> entry in <source_file \| courses/<course>/versions/<term>/assessments/ (grep for the id)>…` | `subject: assessment`; `related: [module, its week]`; `gap: {dates}`; `seen: { source_file }` | **No run id** in the words. The module's week is only in the tooltip. The fallback names a directory `withRecordPaths` never searches (see open question 6). |
| 9 | Teaching · focus and side cards | Draft slides | `teaching.gap.deck` | `course/teaching.jsx:44` | `promptFor("deck")`, as row 6 | as row 6, plus `place.week` (the focus week) | Nothing says whether it was the focus or a Before/After side card. |
| 10 | Teaching · focus | Check date | `teaching.gap.misdated` | `course/teaching.jsx:177` | as row 1 | as row 1 | as row 1 |
| 11 | Teaching · focus | Prepare this week | `teaching.prepare` | `course/teaching.jsx:199` | `For week <n> of <run> (<first module_id>), what should I teach…? The class is weakest on <concept TITLES>.` | `subject: week`; `related: [modules, concepts to revisit (ids), meetings, assessments]`; `seen: { class mean per concept }` | **Concepts by title, not id.** First module only. The class means behind "weakest" are on screen. |
| 12 | Evidence · week head | Why did this week go wrong? | `evidence.why` | `course/evidence.jsx:81` | `In week <n> of <run> (<first module_id>), the class is weakest on <concept ids>. Read the approved evidence…` | `subject: week`; `related: [concepts, assessments due that week, signals]`; `layer` (always record here) | The assessments due that week and their figures are on the card. Signal ids are not sent. |
| 13 | Any reading · status line under a work chip | Ask the assistant (scan step) | `status.scans.ask` | `course/parts.jsx:313` | `STEP_PROMPTS[step]` (built in `server/week-status.js:119`): `/import-assessment <A> <run> — propose the rubric` or `/grade-batch <A> <run>` | `subject: pile` (`{ assessment }`); `step`; `related: [week]` | The pile's step is chosen and then dropped. |
| 14 | Planning · faults | Plan week N / Plan these weeks | `planning.fault.module` | `course/planning.jsx:1118` (fault at `:810`) | `<Week N \| Weeks a–z> of <run> has/have no module. Propose…` | as row 7 | as row 7 |
| 15 | Planning · faults | Suggest an assessment | `planning.fault.unassessed` | `course/planning.jsx:1118` (fault at `:824`) | `Weeks <a>–<z> of <run> have no graded work opening, running or falling due. Should something be assessed there…` | `subject: week[a…z]`; `related: [modules of those weeks, their outcomes]` | The modules of those weeks are not named. |
| 16 | Planning · faults | Fix the weights | `planning.fault.weights` | `course/planning.jsx:1118` (fault at `:836`) | `The weights in <run> do not settle the grading policy: <grading.note> Propose a correction and wait.` | `subject: policy`; `related: [unweighted assessments]`; `seen: { weight per kind, total }` | The per-kind totals and the unweighted ids are in the weight cards beside it. |
| 17 | Planning · undated tray | ★ → This chat / New chat | `planning.star.work` | `course/planning.jsx:1142` | mention or fresh: `<assessment_id> “<title>” (<type>[, due <d>]) in <run>` | `subject: assessment`; `gap: {dates}` | The words do not say why it is in the tray (no date). |
| 18 | Planning · topic cell | ★ beside the module | `planning.star.module` | `course/planning.jsx:1226` (and `:1239`) | mention or fresh: `<module_id> “<title>” (week <n>) in <run>` | `subject: module`; `related: [week, concepts]` | Small. Missing: draft or record, taught or locked. |
| 19 | Planning · lane bar | ★ beside the bar | `planning.star.bar` | `course/planning.jsx:1292` | mention or fresh: as row 17 | `subject: assessment`; `seen: { opens_at, due_at, weight, locked }` | The opening date, weight and lock are on the bar. |
| 20 | Planning · project line | ★ | `planning.star.project` | `course/planning.jsx:1344` | mention or fresh: as row 17 | `subject: assessment`; `related: [weeks spanned]` | The span of weeks. |
| 21 | Planning · concept map dialog | ★ beside a concept | `planning.star.concept` | `course/planning.jsx:561` | mention or fresh: `<concept_id> “<title>” (a concept of <module_id> “<title>”, …, week <n>) in <run>` | `subject: concept`; `related: [module, prerequisite and dependent concepts]` | Builds-on and leads-to are drawn and not sent. |
| 22 | Any reading · inline title editor | Save + check ✦ | `edit.inline.check` | `course/edit.jsx:174` (prompt `:62`, sent `:93`) | `/revise I changed <kind> <id> in <run> from the course page. It is already saved:` + `<field>: “old” → “new”` + `ainar impact <id>` lines | `subject: <kind> <id>`; `seen: { field, before, after }`; `place` | Where the edit was made (week, reading). The diff is in the words, which is right. |
| 23 | Edit dialog | Save + check ✦ | `edit.dialog.check` | `course/edit.jsx:372` | as row 22, one line per changed field | as row 22 | as row 22 |
| 24 | Edit dialog | Ask ("Anything else about it — the weight, the rubric…") | `edit.dialog.ask` | `course/edit.jsx:394` (prompt `:313`) | `About <id> (“<title>”) in <run>: <typed text>` | `subject: <kind> <id>`; `layer`; `place` | **The record's kind is not sent**, nor whether it is a draft (the dialog's head shows it). |
| 25 | Material overlay over any place | Ask about this ↩ | `material.mention` | `client/materials.js:1614` (`mentionOf`, `:228`) | mention: `<document or assessment id> ("<label>")[, built from <source>]` | `subject: document \| resource \| assessment`; `related: [the paper of `papers` on screen, module, week]` | **No run.** Which version among an exam's papers is open is not sent. |
| 26 | Foot of any place | Composer (Enter, ↑) | `composer.send` | `client/materials.js:1339` | `<typed text>\n\n(Asked from course mode — <crumb labels>, run <run>.)` | `place` in full; `subject` when the place has one (`week`, `student`, `concept`, an open window's assessment) | **The place as labels, not ids.** No week, no concept or student door, no open window, no drafts layer. This is HOME-12's "still the place's words". |
| 27 | Today · Now checklist | Ask the assistant… | `today.fill` | `client/today.js:120` → `materials.js:698` | puts `/<skill> <run> ` in the composer (from `shared/actions.js`); nothing is sent until the professor presses Enter | `subject: { kind: "action", id: <checklist item id> }` carried into the composer's send | The checklist item (its id, its detail) is lost between the fill and the send. |

### The pane's own views (`client/*.js`)

| # | Place | Control (label) | Control id | File:line | Sends today | Should carry | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 28 | Concepts · concept panel | Ask why | `concepts.why` | `client/concepts.js:200` | `/find-gaps <run> — why is <title> (<concept_id>) not landing? Class mean <pct>, <covered> of <n> students observed, <k> under <threshold>.` | `subject: concept`; `related: [students under the threshold], [the concept's week]`; `place.week`, group filter; `seen` (as today's words) | The students under the threshold are on screen, and the session must find them again. The active week or group filter is not sent. |
| 29 | Concepts · concept panel | Plan a revisit | `concepts.revisit` | `client/concepts.js:214` | `/prepare-lesson <run> — plan how to revisit <title> (<concept_id>) in the next session.` | `subject: concept`; `related: [next meeting id, its week]` | "The next session" is a search the pane could answer. |
| 30 | Concepts · student panel | Write a report | `concepts.report` | `client/concepts.js:260` | `/student-report <run> <student_id>` | `subject: student`; `related: [weakest concepts shown]`; `place.concept` (where they came from) | Fine for the skill. The concept the professor came from is lost. |
| 31 | Inspector · recent changes | change line (mention) | `inspector.change` | `client/inspector.js:143` | mention: `<workspace path>` | `subject: file`; `related: [{ kind, id } of the record in the file]`; `layer` | **A path only**: no record id, no run, no draft flag. |
| 32 | Gradebook · Policy · change dialog | Ask the assistant to check | `policy.review` | `client/gradebook.js:829` (`reviewPrompt`, `:849`) | `I am about to change the grading policy of <run>… Proposed blocks: <tree> Filing: <…> Counted impact: <…> Check what the counts cannot…` | `subject: policy`; `related: [proposal id if one was loaded, preset or restore point]`; `seen: { base }` | The proposal or preset it started from and the policy's `base` revision. The draft itself is in the words. |
| 33 | Gradebook · Policy · ✦ Assistant | Ask | `policy.assistant` | `client/gradebook.js:1536` (`assistantPrompt`, `:1388`) | `/grading-proposal <run> — <request>` + the fast-path command + assessment titles + the editor's policy as JSON | as row 32, plus earlier proposal ids in the thread | The thread's earlier proposals. |
| 34 | Grade window · question with no rubric | Ask the assistant to propose rubrics | `grade.rubric.propose` | `client/grade-board.js:406` (`ask`, `:253`) | `/import-assessment <A> <run> — propose the rubric` | `subject: item` (`{ assessment, item_id }`); `related: [other items without a rubric]`; `place.grade` | **The question on screen is not sent.** |
| 35 | Grade window · no rubric | Just one rubric | `grade.rubric.one` | `client/grade-board.js:412` | `/import-assessment <A> <run> — propose one rubric` | as row 34 | as row 34 |
| 36 | Grade window · rubric panel | Ask the assistant to rethink Q<n> | `grade.rubric.rethink` | `client/grade-board.js:885` (`rethinkPrompt`, `:786`) | `/import-assessment <A> <run> — rethink the rubric for <Q> (<item_id>) as rev-<k>: <text>` | `subject: item`; `related: [chosen proposal id, other proposal ids, the answer or student in focus]` | Which proposal is chosen now. |
| 37 | Defence desk · question row | Follow-up question | `desk.followup` | `client/defence-views.js:542` → `defence-desk.js:704` | `/defend-submission <A> <run> <S> — follow-up on <question_id>` | `subject: submission`; `related: [question, latest take]`; `place.desk` | Which take. |
| 38 | Defence desk · grade row | Propose the grade | `desk.propose` | `client/defence-views.js:244` → `defence-desk.js:708` | `/defend-submission <A> <run> <S> — propose the grade` | `subject: submission`; `related: [usable takes]` | Which takes are usable, whether the split was approved. |
| 39 | Canvas marks drawer (Gradebook Send…, Scans, Sync, Send marks, Canvas card) | Ask the assistant to link <title> | `canvas.link` | `client/marks.js:636` (`askToLink`, `:489`) | `Link <A> (<title>) to its Canvas assignment in each course that has none yet: <group (Canvas course <id>)…>` + four `bin/ainar lms …` steps | `subject: assessment`; `related: [groups without a link]`; `place` (which of the five hosts) | Which host view it came from. The ids are in the words. |
| 40 | Scans · now card | Ask the assistant / …for suggestions | `scans.now.ask` | `client/scans.js:632` (`now.ask` from `server/scans.js:318`, `:327`) | `STEP_PROMPTS[now.ask]`, as row 13 | `subject: pile`; `step`; `seen: { placed, read, graded, decided }`; `related: [items without a rubric]` | The step's counts and which items lack a rubric. |
| 41 | Upload dialog | Upload and send to chat | `upload.send` | `client/upload.js:581` (`uploadPrompt`, `:57`) | POST `/api/upload` per file, then `I uploaded <n> scanned exam PDFs for <A> (<run>)… <paths>` or, with no assessment, `…Work out which assessment they are and ask me…` | `subject: assessment` when known; `related: [{ kind: file, id: path }…]`; `place` (where the dialog was opened from) | **From the header there is no assessment.** The place under the dialog (an assessment's Grade window, a week) often names it. |
| 42 | Students · Start defence (`kind: "defence"`) | Draft questions / Draft again | `students.defence` | `server/students.js:834` → `client/pane.js:707` → `server/routes/defence.js:433` | POST `/api/defence/prepare`, then `/defend-submission <A> <run> <S>` (on failure: `… — the clone failed: <last lines>`) | `subject: submission`; `related: [fork url, pinned commit, existing questions]` | The fork and the commit the clone used. |

### Served documents and vendored widgets

Relayed verbatim through `client/pane.js:322`. The widgets are byte-for-byte
the documents ChatGPT gets (`vendor/ainar/mcp/widget-assets/`), so they cannot
be edited for the pane. The packet for these must be built on the pane's side
of the frame, from `data-ask`'s sibling attributes or from a `context` field
`sendFollowUpMessage` already ignores. See open question 2.

| # | Place | Control (label) | Control id | File:line | Sends today | Should carry | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 43 | Tasks widget · Awaiting your decision | show | `inbox.pending` | `widget-assets/action-inbox.js:79` | `For <run> <A>, show me what is still to grade with the pending_judgements tool.` | `subject: assessment`; `seen: { pending, low_confidence }` | Small. |
| 44 | Tasks widget · Not ready to run | set dates | `inbox.dates` | `widget-assets/action-inbox.js:124` (`datePrompt`, `:46`) | the dates prompt, naming `<source_file>` or, failing that, "the assessment record for <run>" | `subject: assessment`; `gap: {dates}` | **No run id when `source_file` resolved.** |
| 45 | Tasks widget · Not ready to run | design | `inbox.design` | `widget-assets/action-inbox.js:128` (`gradingPrompt`, `:37`) | `Run /design-assessment for <A> ("<title>") in <run>. It has no rubric criteria and no items…` | `subject: assessment`; `gap: {brief}` | The other holes on the same row (no weight, no due date). |
| 46 | Tasks widget · Open signals | advise | `inbox.signal` | `widget-assets/action-inbox.js:200` | `In <run>, what should I do about signal <signal_id> for <student_id>?` | `subject: signal`; `related: [student]` | Small. |
| 47 | Progress widget | why? | `progress.why` | `widget-assets/class-progress.js:21` | `In <run>, what does the evidence say about <concept TITLE>? Use the class_progress and student tools.` | `subject: concept` (id) | **Concept by title only.** |
| 48 | Gradebook widget · note | explain the blocks | `gradebook.blocks` | `widget-assets/gradebook.js:64` | `For <run> <A>, which rows are blocked from export and what would fix each one?` | `subject: assessment`; `related: [blocked students]` | The blocked rows and their reasons are on screen. |
| 49 | Outline widget · lead card | Set dates | `outline.lead.dates` | `widget-assets/course-outline.tmpl:59` (`course-outline.js:126`) | the dates prompt; run never named | as row 8 | as row 8 |
| 50 | Outline widget · band | Plan weeks a–b | `outline.band.plan` | `widget-assets/course-outline.tmpl:81` | as row 7 | as row 7 | as row 7 |
| 51 | Outline widget · week head | Plan module / Draft deck / Check date / Set weight | `outline.gap.<kind>` | `widget-assets/course-outline.tmpl:85` (`gapAsk`, `course-outline.js:96`) | the same four texts as `promptFor` | as rows 1, 3, 4, 6 | as rows 1, 3, 4, 6 |
| 52 | Outline widget · current week | Prepare → | `outline.prepare` | `widget-assets/course-outline.tmpl:85` | `For week <n> of <run>, what should I teach and what should I revisit first?` | as row 5 | **No module id**, where course mode's twin has one. |
| 53 | Outline widget · undated item (gaps off; not in the pane) | set date | `outline.item.dates` | `widget-assets/course-outline.tmpl:103` | the dates prompt | as row 8 | as row 8 |
| 54 | Outline widget · footer | syllabus | `outline.syllabus` | `widget-assets/course-outline.tmpl:157` | `Show me the syllabus for <run>.` | nothing beyond the always-present fields | None. |
| 55 | Students · hand-in drawer | Ask to regrade | `students.regrade` | `server/students.js:1188` (note appended at `:2759`) | `/grade-submission <A> <run> <S> — regrade the whole paper…` + `; the professor's note on how: <note>` | `subject: submission`; `related: [submission_id, the pile and version]`; `seen: { current total }` | Which version of the paper (a variant, a re-upload). |

## Table 2: presses that start work and do not reach the session

These need no packet (rule 4): each names its ids in the request, and the
answer lands in the pane. They are listed so that UI-2 can see the whole
surface, and because three of them sit one press away from an ask and should
hand their ids on when they do.

| Family | Controls (file) | Route | Carries | Note |
| --- | --- | --- | --- | --- |
| Scans pile | Read and record, Re-apply the plan, Confirm all weak matches, the match desk's picks, Confirm, Spoiled copy, Not a student, Cancel, Continue reading (`scans.js`, `scans-queue.js`); "This is …" in the exam window (`pane.js:740`) | `pressWork` `/api/scans/read`, `/apply`, `/assign`; `/api/jobs/<id>/cancel`, `/continue` | `run`, `assessment`, `{ file, pages, student \| skip }` | Complete. |
| Recorded defences | Plan…, File them…, Quote…, Send them and transcribe, Cancel, Continue sending (`upload.js:254`–`:314`) | `pressWork` `/api/defence/batch?step=` | `run`, `assessment`, `step` | Complete. |
| Grade window | Use for Qn, Use for every question, Use "…" for …, Use this, Grade by points only, Accept rubric, the group select, Give X, score buttons, comment, Re-mark all, Accept N at X, Accept all (`grade-board.js`) | `/api/grade/choose`, `/points-only`, `/accept-rubric`, `/move`, `/decide` | `run`, `assessment`, `{ proposal, item(s), student, score }` | Complete. "Grade by points only" does not carry the item on screen, and needs none. |
| Grading policy | Lock, Unlock, a preset, the live impact, Apply change, Discard (`gradebook.js`) | `/api/grading/lock`, `/impact`, `/apply`, `/discard` | `run`, the proposal, `base`, `note` | Apply does not record which proposal it came from. That matters for provenance (E9), not for the packet. |
| Canvas marks and assignments | Check Canvas, Send N marks, Link…, Create it in…, Preview creating it (`marks.js`); Preview / Send to Canvas, Choose…, Save, Fetch from Canvas (`canvas-card.js`, `integration-parts.js`) | `/api/canvas/marks`, `/assignments`, `/assignment`, `/assignment-map`, `/catalogue`, `/selection`, `/courses`, `/course-map`, `/check` | `run`, `assessment`, `group`, `confirm` | Complete. |
| Syncs and roads | Check again, Send…, Send N, Send all, Bring in the class list, Send to Canvas / Keep AINAR / Keep Canvas, Sync all…, Preview, Send, Run, Read it, drop a CSV, Confirm (`sync-view.js`, `canvas-diff.js`, `road-flow.js`, `syncs.js`) | `/api/roads`, `/api/canvas/resolve`, `/api/syncs/action`, `/api/syncs/copy` | `run`, `keys`, `sync`, `assessment`, `confirm` | Complete. |
| Settings | Save in settings, a secret's save and remove, disconnect, provider setup, Save to this layer (`integrations.js`, `integration-parts.js`, `preferences.js`) | `/api/syncs/action`, `/api/credentials`, `/api/google/disconnect`, `/api/integrations/setup`, `/api/preferences` | the setting | Not about a run's records. |
| Course mode writes | Planning's Save (dates, topic moves), the title editor's Save, the edit dialog's Save (`planning.jsx:264`, `:356`; `edit.jsx:170`, `:368`) | `/api/plan/dates`, `/api/plan/topic`, `/api/record` | `run`, `{ assessment, opens_at, due_at }`, `{ moves }`, `{ kind, id, fields }` | Complete. "Save + check" (rows 22–23) is the one that goes on to ask. |
| Students and exam window | Defended / Not defended, rubric check, In class / At home, Apply curve, Give 0 / Leave blank, Close it, Make the reports, Send to students, Open a case, Decide, the fork picker, Find their fork, Audio defence (`server/students.js`, `server/assessment-window.js`, `server/standing-view.js`, relayed by `pane.js:345`–`:705`) | `/api/defence/mark`, `/fork`, `/api/assessment/setting`, `/missing-work`, `/close`, `/api/grade/curve`, `/integrity`, `/api/reports/make`, `/send`, `/api/homework/forks` | `run` (the pane's current one), `assessment`, `student`, the outcome | **The posted message carries no run.** The pane adds its current run. Harmless while the pane has one run on screen, and the first thing to break if a frame outlives a run switch (open question 4). |
| Defence desk | The student agreed / did not agree / Stop, Record the whole defence, Start hands-free, Save and ask, Ask now, Skip, Pause, Record answer, Stop, These are right, Divide again, a voice (`defence-views.js`, `defence-desk.js`, `defence-captions.js`) | `/api/defence/consent`, `/whole`, `/next`, `/override`, `/answer`, `/split`, `/voices`, `/realtime`, `/caption` | `run`, `assessment`, `student`, `question`, `take` | Complete. |
| Elsewhere | Folder (`files.js:113`), snooze (`today.js:311`), Check what would be published / Publish (`publish.js:217` → `pane.js:932`) | `/api/files/reveal`, `/api/today/snooze`, `/api/publish` | `run`, the item, `{ target, assessment, … }` | Complete. |

Presses that only open a place (`grade`, `scans`, `upload`, `publish`,
`concepts`, `syncs`, `view`, Waiting's rows in `server/today.js:92`) send
nothing anywhere. Two of them drop what they knew: Waiting's week item opens
Planning without its week (`today.js:105`), and its action item opens Waiting
without the action's id (`today.js:241`). That is a place gap, for UI-9, not a
packet gap.

## The gaps, by size

1. **No press carries the place.** All 55 rows send a string. `placeNow()`
   and the open windows exist on every press and reach only the URL. View,
   sub-view, week, the Drafts layer, Names/Pseudonyms and the open window are
   absent from every message. The composer (row 26), the one control built to
   say where it was asked from, says it in crumb labels.
2. **Records on screen are sent by title, by first-of-several, or not at
   all.** Concepts by title: rows 11 and 47. The first module of a
   multi-module week only: rows 5, 6, 9, 11, 12. The question in front of the
   professor dropped: rows 34 and 35. The students under the threshold
   dropped: row 28. A path instead of a record: row 31. No assessment from
   Upload's header although the place under it names one: row 41. No run in
   the dates prompt or the material mention: rows 8, 25, 44, 49. No record
   kind in the edit dialog's Ask: row 24.
3. **The prompt is the only contract, and it is written three times.** The
   week's asks are built in `shared/course-words.js` (course mode), again in
   `server/course-mode.js` (its server twin), and again in the vendored
   `course-outline.js` (the widget). The copies already differ: the widget's
   Prepare drops the module id (row 52), and the dates prompt's fallback
   directory (`courses/<course>/versions/<term>/assessments/`) is not the one
   `withRecordPaths` (`server/workspace.js:283`) searches
   (`courses/<course>/assessments.yaml`, `courses/<course>/assessments/*.yaml`).
   A structured packet stops a fourth copy from drifting the same way.

Smaller: `mention` and `fresh` (rows 17–21, 25, 31) carry less than `ask`,
although they are the presses where the professor writes the question and the
pane should do the naming. `STEP_PROMPTS.approve` exists and nothing selects
it. The checklist's `next` skill (`ainar-node/src/inbox.ts:362`) is computed
and no pane control sends it.

## Open questions

1. **Where the packet is read.** UI-3 says "the turn's opening context". Two
   ways: a fenced block appended to the text (works today in every host, is
   visible in the transcript, costs tokens on every press), or a field beside
   the text that the harness turns into a system note (invisible, needs a DSH
   change outside this repo). The first is buildable inside this repo and
   testable by UI-4. The second is cleaner. A decision for UI-2.
2. **The widgets.** They cannot change, and `sendFollowUpMessage({ prompt })`
   is their whole voice. The pane can build the packet for them from what it
   knows (its run, its place, the frame's view) but not the subject, which
   only the widget knows. Either the subject is parsed back out of the
   prompt's ids (fragile, but the ids are there), or the vendored runtime
   gains an optional `context` argument that ChatGPT ignores. That change
   would be upstream in `ainar`, not in this repo.
3. **`seen`: carry the figure or not?** Carrying the class mean the
   professor saw lets the session answer about the same number. Not carrying
   it keeps one source of truth, and the session reads it fresh. The rule
   above says carry only what the prompt is about. Whether even that is worth
   its tokens is for TOK-1 to measure.
4. **A frame across a run switch.** Every posted `kind` relies on the pane's
   current run, not the frame's. Should every posted message carry `run`, and
   the pane refuse a mismatch? Cheap, and it is the packet's `run` applied to
   the second table.
5. **Names mode.** The packet sends ids only. Should a press made in Names
   mode say so (`names: "names"`) so the session answers with names, or is
   that a leak into the transcript the projector rule (E13) should forbid?
6. **The dates fallback path.** Is `courses/<course>/versions/<term>/assessments/`
   a layout that exists (STORAGE.md), or a stale name? If stale, it is a bug
   today, independent of the packet. If it exists, `withRecordPaths` should
   search it.
7. **Control ids.** Stable ids (`term.gap.deck`) let UI-4 and TOK-1 count
   presses by control. They also make one more name to keep in step with the
   code. Generate them from the file and the label, or write them by hand?
