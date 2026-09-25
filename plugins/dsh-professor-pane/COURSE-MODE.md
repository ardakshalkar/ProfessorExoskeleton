# Course mode

A concept, not a specification of something built. It answers two questions
together because the second is unanswerable without the first: **what does the
right column actually show today**, and **what would the course look like if it
were the page rather than the panel**.

[`FUTURE.md` §1](../../FUTURE.md#1-interface-two-modes-not-one-column) argues
for two modes in four paragraphs. This is the long form of the second one, and
where the two disagree this is the later thought.

## Part one — what is in the column now

Six buttons, sixteen views, two crosscutting toggles and an overlay.

| Button | Sub-views | Answers | Whose view |
| --- | --- | --- | --- |
| Course outline | Week by week · Grading policy · Assessments · Slides · Exams | what the course *is* | the **student's** |
| Students | — | who is in it and what they handed in | the professor's |
| Progress | Concepts · Gradebook | how it is going | the professor's |
| Tasks | Pending · Ready · Checklist | what is waiting for you | the professor's |
| Preferences | — | what the skills assume | the machine's |
| Integrations | Status · Targets · Credentials · Links | what this is wired to | the machine's |

Crosscutting: **Record / + drafts** (which half of the course), **Names /
Pseudonyms** (whether a projector is in the room). Over the top of all of it,
`MaterialModal` — a deck, a brief, an exam paper, full-page.

Five things are worth saying plainly about that table.

**It draws six of the sixteen read tools.** `index.js` calls `course_outline`,
`action_inbox`, `class_progress`, `gradebook`, `student` and `list_courses`.
Nothing in the pane draws `alignment_report`, `validate_course`, `syllabus`,
`assessment_blueprint`, `calibration`, `course_stats` or `assessment_rubric` —
and the first two are the project's own argument for existing. A professor can
see which week has no deck and cannot see which outcome nothing assesses, or
that the course carries three referential errors, without asking the agent.

**A third of the column is setup.** Preferences and Integrations are five of the
sixteen views, for facts a professor settles once a term and then never looks
at. They earn the space on the day the Canvas push does not work and cost it
every other day. In three hundred pixels that is the most expensive real estate
in the product.

**The first button is not the professor's view.** Its own hint says *Student's
view*, and that is true and deliberate — it is the same widget document ChatGPT
gets, byte for byte, which is the property the whole `widget-assets/`
arrangement exists to protect. But it means the thing a professor presses first
is a page written for somebody else, and every professor-only fact about the
same week — is there a deck, is the deadline set, did anybody hand it in — is
somewhere else in the column.

**Four views describe the same week and no two of them are the same object.**
*Week by week* holds the plan, *Week by week · + drafts* holds the proposal,
*Checklist · Slides* holds the deck per week, *Course outline · Assessments*
holds the dates and weights, *Tasks · Pending* holds the work with no date. A
professor asking "is week seven ready to teach" visits four of those and holds
the answer in their head. The week is the unit they think in, and no view is
keyed on it end to end.

**The escapes are the admission.** A deck opens *over* the harness because a
slide is 4:3 and the column is 300px. A button that needs to change something
sends a prompt instead, because the pane may not write course structure — and
that restraint is right, but it means the column's answer to every hole it
draws is to describe the hole to somebody else. Both are the same finding: the
object the professor came to look at does not fit in the column, and the column
knows it.

None of this is an argument that the pane is wrong. It is an argument that it
has been correctly built as a **reference column beside a conversation**, and
that a professor clicking through their own course wants the opposite
arrangement.

## Part two — the course as the page

One mode, one name. *Course mode* is the mode; the **outline is its page**. The
term plan is the only top-level structure, and everything the professor needs
hangs off a week.

### The spine

A column of week cards, week 1 to week N, with today marked. Each card carries,
in this order: the module taught that week and its concepts, the meetings with
their real dates and rooms, the assessments that open or fall due, the deck and
the readings.

That is `course_outline`'s payload exactly, and no new tool.

What changes is where the holes go. Today "on no week of this run" — unplaced
modules, meetings with no date, work with no deadline — sits at the foot of the
document, which is the one place a professor planning a week will not look. On
the spine it sits **at the top**, before week 1, as the first card: *four things
are not on the calendar yet*. A hole is the most actionable object in the
document and it should be the first one.

### Four overlays, one spine

The same weeks, repainted. Radio-selected, never blended silently — the rule
Record / + drafts already holds.

| Overlay | The week card shows | Source |
| --- | --- | --- |
| **Plan** | the record: what a student may be shown, what an LMS may be given | `course_outline` over `courses/` |
| **Proposed** | the same, with drafted modules, meetings and assessments in place and in blue, each with the approval affordance beside it | `course_outline` over the `loadDrafts` + `mergeDrafts` pair |
| **Gaps** | the week coloured by what is missing from it: no module, no deadline, no weight, no deck | the Checklist report, re-keyed by week |
| **Evidence** | how it actually went: what was due that week, how many handed it in, how the concepts taught that week are landing | `gradebook` and `class_progress`, re-keyed by week |

**Gaps is the merge that matters most.** Today the Checklist is a list of things
that are elsewhere; as an overlay it is the colour of the spine, and its four
counts become a tally in the header rather than a page of their own. "Is week
seven ready" stops being four views and becomes one glance. If only one thing
in this document gets built, it is this one — and it is worth building in the
300px column first, where it is still useful.

**Evidence is the view that exists nowhere today.** Progress is keyed on
concepts, the gradebook on assessments, and the professor thinks in weeks. The
week that went wrong is a fact currently assembled by hand from two grids.

### One action grammar, and only one

Every object on the spine — a week, a module, a meeting, an assessment, a deck,
a concept, a hole — carries the same three affordances and never a fourth.

* **Open.** Read the thing. This is `MaterialModal`, already built, already
  correct about formats and sandboxes.
* **Ask.** Send the *context packet* and a prompt into the session; chat opens
  over the page the way a deck opens over the harness today. A press on week
  seven's missing deck sends `{run, view: 'outline', week: 7, module_id, kind:
  'deck-missing'}` and the agent runs `make-materials` without the professor
  typing a week number or a module id. This is `UI-1` through `UI-3` in
  [`BACKLOG.md`](../../BACKLOG.md), and course mode is what makes them worth
  building: in chat mode a packet saves a sentence of typing, on the spine it is
  the entire interaction.
* **Approve.** Only on a drafted object, only ever by spawning `ainar approve`
  the way `POST /api/approve` already does, `--dry-run` until a preview has been
  read.

  Since 2026-09-21 there is a fourth on the header rather than on the spine, and
  it is the one that made the third rarer: **Publish** runs
  `ainar publish <target>`, which performs that same gate over the documents and
  resources one publication needs and then publishes. On the spine it would be a
  week-level affordance — *put week seven in front of the class* — and the
  argument for building it as chrome first is that a publication is about the
  run, not about a week.

The deadline button that exists today is the pattern, and it is already better
than it looks: it does not write the date, it hands the model *which file holds
that assessment id*, found by scanning rather than guessed. Course mode
generalises that button, it does not replace it.

**The line that does not move.** Nothing here settles a judgement about a
student. A mark never becomes final on this page; there is no route that could,
and the reason is the one `AGENTS.md` gives — there is one approval path and the
professor runs it.

### The one concession to direct editing

Three facts have no drafted half: a meeting's room, a week's title, a deadline
the professor has just decided. No skill proposes them, so `ainar approve` has
nothing to promote, and refusing them only means they stay editable by
hand-editing YAML. That is the argument `extensions.lms.canvas_sections`
already won.

So: **those three are editable in place**, through the comment-preserving
`parseDocument` path `/api/canvas/selection` uses — replace one key, write the
rest back untouched, line endings included, because a professor also edits these
files by hand and a file the pane saved must not be distinguishable from one
they wrote.

The cost, plainly: it is the first route in this project that writes course
*structure*, and the failure mode is a file coming back reordered and a
professor losing a comment they wrote. Start with the deadline alone — it is
unambiguous, the Checklist already counts it, and Tasks already has a button
for it.

Everything with a drafted half keeps going through the agent, because a draft
the professor reads and promotes is a better record of a decision than a field
that silently changed.

### Chat as a button

The conversation collapses to a rail. Pressing it opens over the page, carrying
the packet for whatever is selected — `Escape` closes it, the same gesture the
material overlay already teaches. The mode is remembered per workspace, which
makes it the first UI state in this project that outlives a session.

A pleasant side effect: course mode has no 1220px floor. The pane needs the
window wide enough to survive the layout's concession chain; a page does not.

## The wall, and why it stays

`course_outline`'s description says it in as many words: *no figure derived from
student work appears*. That wall is the design — one document is what a student
may be shown and what `ainar page` publishes, the other is marks and is private,
and `dashboard` and `page` are deliberate opposites.

So the four overlays are not four overlays in the same document:

* **Plan, Proposed and Gaps** are layers on the outline document. Plan and
  Proposed already are. Gaps is a professor-only colouring of a student page,
  which is safe because it adds no figure — it says *this week has no deck*,
  which is a fact about the course, not about anyone in it.
* **Evidence is a different document on the same spine.** It carries marks. An
  overlay that put a class mean inside the widget served as the public course
  page would be the first crack in the one wall this project has held
  everywhere else.

That decision also answers `UI-5` — *does course mode reuse the widget documents
or need a second renderer* — **reuse**, for the spine. The widget already gains
behaviour by host capability rather than by payload flag: `runtime.js`
intercepts a material click only where the host offers `openMaterial`. Selection
works the same way — the document emits a selection over `postMessage`, the pane
chrome listens, and ChatGPT gets the identical bytes with nobody listening and
nothing changed. The overlays, the chrome and every button live outside the
frame.

What that costs: the Gaps colouring needs `weeks[].gaps` on the outline payload,
computed in `ainar-node/src/outline.ts` rather than in the view, because a view
computes nothing. That is a good place for it — `ainar page` and the Checklist
both stop deriving it themselves, and the Checklist's cache exists today
precisely because it builds the outline payload twice.

## What this does not fix

* **Preferences and Integrations.** They do not belong on the spine and they do
  not become a page. They are a settings screen, and course mode is the
  occasion to move them out of the six buttons rather than to redraw them.
* **The six-of-sixteen problem.** Alignment and validation still have no view.
  A week card can carry *this week's assessment measures no outcome* once
  `alignment_report` is drawn somewhere; the spine is where it would go, and it
  is not part of this concept's first cut.
* **`lib/client.js` at 4,171 lines.** A second layout lands on it either way.
  Read it and list what it does before, not after.

## Sequence

The order is chosen so that each step is worth having if the next one never
happens.

1. ~~**Gaps as an overlay in the existing 300px column**~~ — **done.**
   `weeks[].gaps` and `totals.gaps` are computed in `outline.ts`, the week draws
   a dashed chip for each and the strip carries the tally, and the Checklist's
   Slides column reads the same field rather than deciding a second time.
   `sections.gaps` turned out to want the opposite default from every other
   section — opt-in, because the surface that asks for nothing is the public
   page. Two of the four questions stayed as words rather than chips, because
   the week already said them: **Unplanned**, and `no date` beside the button
   that sets one.
2. **The context packet** — `UI-1` and `UI-2`, used in chat mode first, so a
   press stops producing a prompt the agent must interpret from nothing.
3. **Selection in the widget over `postMessage`**, gated on a host capability.
   Small, and it is the whole of the `UI-5` question answered by doing it once.
4. **The spine as a page**, chat as a button, mode persisted per workspace.
5. **Evidence**, as its own document.
6. **Deadline editable in place.** Last, deliberately: it is the only step that
   writes, and it should land when everything around it is settled.
