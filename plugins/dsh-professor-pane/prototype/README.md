# The course-mode prototype

A working page, not a mockup: the arrangement argued for in
[`COURSE-MODE.md`](../COURSE-MODE.md), driven by the real example course through
the same payloads the pane reads.

```bash
node --experimental-strip-types plugins/dsh-professor-pane/prototype/build.mjs
```

That writes `course-mode-prototype.html` beside these files. Open it in a
browser. The output is **not committed** — it is ~300KB of derived bytes that
would churn on every course edit — and `build.mjs` names the path it wrote.

## The two files

| File | What it is |
| --- | --- |
| `proto.html` | The page. Hand-edited; this is where design changes go. |
| `build.mjs` | Reads the course, computes what a view may not, and substitutes three markers into `proto.html`. |

The three markers, all replaced at build time:

* `__COURSE_DATA__` — the outline, the class, the inbox and the todos, as one
  JSON blob in a `<script type="application/json">`. Every figure on the page
  is counted here, never in a view.
* `__TEMPLATE_JS__` — `vendor/ainar/mcp/widget-assets/template.js`, verbatim.
  Not a copy of the interpreter: the interpreter.
* `__PANE_DOC__` — the document `dsh-professor-pane` serves into its 300px
  frame today, embedded in chat mode so the two arrangements can be compared
  side by side rather than described.

## What it is for

Three questions this repository had open, answered by building rather than by
arguing:

**`UI-1`, the context packet.** Press any week, meeting, assessment, student or
todo and the bar at the foot shows the structured thing that press would carry
into a turn. It is the item the rest of course mode depends on, and it is much
easier to judge on screen than in a table.

**`UI-5`, whether course mode reuses the widget documents.** The week card here
is a `.tmpl` rendered by the shipped interpreter, with clicks crossing the
boundary the way `runtime.js` already does it — `data-pick` and `data-id` on the
element, one delegated listener on the container. It appears to hold. The
structure and the appearance are both swappable from inside the page, which is
the same pair a professor already chooses with `ainar page --structure compact
--template print`.

**Where it would mount.** The shipped `dsh-client-ui-layout` declares four
seats — `sidebar`, `conversation`, `details`, `shell.overlay` — and no
full-width one. Its README claims a `conversation.empty` that appears nowhere in
the bundle, which is the negative result recorded in `4db9b4f`. So course mode
is either the conversation slot or `shell.overlay`. The prototype states the
choice and does not take it.

## What is real, and what is not

Real, and read from `workspace/courses/CSS-4008/`: the weeks, modules, meetings
with their rooms, materials, assessments with weights and rubric counts, the
concept evidence, the gradebook rows with the reasons a mark cannot be exported,
and the action inbox.

Not real, and labelled on screen wherever it appears:

* **The three student names** are fixtures invented for the prototype. The
  bundle holds one user — the instructor — because a student in this model is a
  pseudonymous identifier and nothing else. In the harness they resolve from
  `~/.ainar/roster/people.json`, are held for one response, and never enter a
  payload. The amber rule appears whenever names are showing, the identifier
  stays under each name, and the context packet carries the pseudonym alone.
* **The three drafts** are invented for the prototype. Since 2026-09-29 a draft
  is a record in the course marked `approval: draft`, and the example course
  holds no drafted module, deck or assessment, so `build.mjs` supplies three
  shaped like such records — ordinary ids (`MODULE-10`, `RES-0202`,
  `ASSESSMENT-06`), each carrying `approval: draft`.
* **The conversation** in chat mode, and the replies in the chat overlay. The
  page reaches no model.

## What the build checks

`build.mjs` warns, and the page draws a **Check date** hole, wherever a
meeting's date falls outside the week it is drawn in. The outline places a
meeting on its module's week first and on its own date only as a fallback, so
the two can disagree. On CSS-4008 they do four times: the run starts on Tuesday
1 September, its weeks run Tuesday to Monday, and from week 6 the lectures are
on Mondays — the last day of the run-week before their module's. Which fact is
wrong is the professor's to say; the build moves nothing.

## The page, part by part

These notes used to sit at the foot of the page. They are for whoever reviews
the design; the page itself carries one line saying what is real.

**Three sections, because a professor asks three questions.** *Course outline*
is what the course is. *Students' progress* is how the class is doing. *Todos*
is what is waiting — `action_inbox` plus the structural holes, ordered by the
priority the record carries. A stored `review_grades` action and the live count
of pending suggestions for the same assessment are one todo; the live count wins.

**The outline, grouped by week, meeting, graded work or quizzes.** By week is
the term table. *Preview as student* shows the record alone — no draft, no hole
— which is what `ainar page` publishes. Without it the drafts and the holes are
drawn in.

**Three columns.** *Lecture* is every meeting the week holds, with its own
materials nested under it, because a resource belongs to an activity rather than
to a week; the deck hole sits once at the foot. *Graded work* is everything the
`AssessmentType` enum holds, the type said on the chip and the weight in bold
beside it. *Outcomes* is the LO ids the week serves — *taught* by its module,
*assessed* (green) by work falling due in it — which is the column that makes
alignment visible week by week. Other columns the record could fill: Prepare
before (`activity.preparation`), Hours (`module.estimated_hours`), Handed in
(private, so it belongs under Students), Subgroup, Source outline.

**A hole is a verb.** Every gap chip says what pressing it does — *Draft
deck*, *Plan module*, *Set dates*, *Write brief*, *Check date*, each led by the icon of what is missing — and the
press opens the conversation with the packet already in it. Holes are ranked by
when they bite: this week and next filled, later outlined, weeks already taught
grey. A hole a draft already stands in for is not drawn. Runs of two or more
unplanned weeks fold into one band; work with no date goes in a card before
week 1.

**Students.** One glyph per mark: ● graded, ◐ criteria decided, ○ missing, · not
due, ⚠ a rubric that is inconsistent. Why a mark cannot be exported is the
cell's title. Rows are ordered by who needs the professor first — open signals,
missing work, a broken rubric, criteria left to decide — counted, not judged.

**Names are fixtures, and the page says so while they show.** The amber rule
appears whenever names are on, because this gets screen-shared and projected.
The identifier stays under each name. The packet carries the pseudonym alone
whichever way the toggle is set. The default here is Pseudonyms — the opposite
of the harness — because a page like this one can be shared with a link.

**It is templated.** The week card is a `.tmpl` rendered by
`vendor/ainar/mcp/widget-assets/template.js`, embedded verbatim: escaped
`{{ paths }}`, `{% if %}`, `{% for %}`, no raw output. The ⋯ menu picks the
structure and the appearance — the same two halves as `ainar page --structure
--template` — and *Show the template editor* opens the source; break it and the
parse error is reported rather than rendered.

**Nothing here settles a judgement.** A draft is accepted by changing
`approval: draft` in its record; a grade is decided by the professor's
`professor_decision` beside the suggestion. The page points at both and changes
neither.
