---
name: plan-term
description: Turn a course's concepts into a week-by-week term plan — modules, the lecture and practice meetings for each week with real dates, and shells for the midterms and the final — as drafts for the professor to approve. Use when the user asks to plan a term or semester, lay out the weeks, build a weekly schedule or course calendar, asks how many weeks a course should have, or asks where the midterms and final should go. Extracting the concepts and prerequisites themselves out of source material is /propose-concepts first.
stage: design
requires: [concepts]
produces: [modules, activities, assessments]
writes: records, drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - **Modules go straight into `courses/`** with final identifiers — the week
>   structure is the professor's own authoring, and `modules` is no longer a
>   draftable collection. Meetings and assessments still go to `work/<RUN_ID>/`
>   with a `-DRAFT-` segment, so they cannot be mistaken for records.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Modules you now write into the record directly, which raises the
>   bar rather than lowering it: nothing stands between your file and the course,
>   so the shape you report in §3 and the professor's answer to it are the whole
>   safeguard. Meetings and assessment shells are still artefacts and still wait
>   for approval.
> - **Never run `ainar approve`,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Approving your own suggestion, or posting a grade a
>   student can see, is the one place a human enters. Show the command instead.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Plan a term

**Needs:** a course in YAML with concepts, and a run with `start_date` and
`end_date`. Reads the CLI for the calendar and the coverage arithmetic; says
below what to do without it.

You are laying a concept map onto a calendar. The concepts already say what the
course teaches — that claim was made and approved before you arrived. What you
add is *when*, which is the part that can be wrong thirty times from one
mistake.

Three things this drafts, and they are not the same kind of thing:

- **Modules** — a claim, and written straight into `courses/`. Nothing stands
  between your file and the course, so every one must be traceable to something
  the professor said or supplied, and the count goes past them first.
- **Meetings** (`activities`) — the calendar. A `LearningActivity` makes no
  claim about what students must learn; the module it belongs to already made
  that one. This is why it is draftable, and why the checks on it are about
  dates rather than about pedagogy.
- **Assessment shells** — the midterms and the final. The instrument is an
  artefact. The **weight** is a claim, and §5 says exactly how far you may go.

## 1. Read what exists

```bash
bin/ainar context CSS-4008-2026-FALL
```

```bash
bin/ainar stats CSS-4008
```

You need four things before asking anything:

- the run's `start_date` and `end_date`, from `versions/<TERM>/version.yaml`
- the `course_version_id` every module you draft must name
- the approved concepts, **in prerequisite order** — a term plan that teaches a
  concept before its prerequisite is the one failure here that ruins the gap
  analysis later
- what the run already has: modules, activities and assessments. A run with
  eight weeks already planned is being **extended**, and re-drafting week 3 is
  how a term ends up with two week 3s.

If the course has no concepts yet, stop and say so. Run `/propose-concepts`
first; planning weeks around concepts nobody approved means the plan has to be
redone when they are.

## 2. Ask the shape of the term

Ask, and do not proceed on a guess. Offer the local default explicitly, because
it is right most of the time here and saying it out loud is faster than an open
question:

> Kazakhstan universities usually run **15 teaching weeks with two meetings a
> week — one lecture and one practice** — which gives 30 meetings. Is that this
> course, or does it differ?

Then the pattern, which the model has nowhere to store yet and you cannot
derive:

> Which days and times? For example, lecture Tuesday 10:00 for 100 minutes and
> practice Thursday 14:00 for 150 minutes. And the rooms, if you know them.

Four answers you need: **weeks**, **meetings per week and their types**,
**weekday and time for each**, **duration**. Rooms are optional — leave
`location` out rather than inventing one.

Do not ask about holidays. Derive the dates, then let §4 report any meeting that
looks wrong and let the professor move it; a list of public holidays you half
remember is worse than arithmetic they can check.

## 3. Derive the calendar, then say what you got

Week 1 is the week containing `start_date`, anchored on its **Monday** — a term
opening on a Tuesday still has that Tuesday in week 1. Week *n* is *n−1* weeks
after that anchor. Every datetime carries `+05:00` unless the run's `timezone`
says otherwise.

Report the shape before writing anything:

> 15 weeks from Mon 31 Aug 2026. Lectures Tue 10:00, practices Thu 14:00.
> Week 1 is 1–3 Sep, week 15 is 8–10 Dec, and the run ends 20 Dec — so the
> exam period is the week of 15 Dec. 30 meetings, 12 concepts across 15
> weeks. Shall I draft that?

Wait for an answer. Then check your own arithmetic against three things, because
each is a whole-plan error rather than a single wrong row:

- **The last week must land inside the run.** If week 15 falls after
  `end_date`, either the run is shorter than 15 weeks or `start_date` is wrong.
  Say which you think it is and ask.
- **No two meetings at the same instant.** Two slots colliding means the week
  increment is wrong, and it will be wrong for every week after it.
- **Concepts in prerequisite order.** Walk the graph: a concept must not appear
  in an earlier week than anything it requires.

## 4. Write the plan

**Two destinations, not one.** Since 2026-09-05 the modules and the meetings
part company:

| What | Where | Identifier |
| --- | --- | --- |
| `modules` | `courses/<COURSE_ID>/modules.yaml` — the record | `MODULE-07`, no draft marker |
| `activities`, `assessments` | `work/<RUN_ID>/term-plan-draft.yaml` | `ACT-DRAFT-…`, awaiting approval |

The week structure is the professor's own authoring and goes straight in; what
carries a mark waits. A `modules:` key in a file under `work/` is refused with
`draft.collection`, so writing them together no longer works.

Read `modules.yaml` before writing it and keep what is there — an overwrite
loses hand-authored weeks.

Modules, into the record:

```yaml
modules:
  - module_id: MODULE-07
    course_id: CSS-4008
    title: Optimisation
    week: 7
    concepts: [CONCEPT-LOSS-FUNCTIONS, CONCEPT-GRADIENT-DESCENT]
    estimated_hours: 4.2
    # No `extensions.proposal` here: a proposal with no approval beside it
    # raises `claim.unapproved_proposal`, and these are not claims any more.
    # Say where the week came from in `description` if it is worth recording.
```

Meetings and assessments, into `work/<RUN_ID>/term-plan-draft.yaml`:

```yaml
activities:
  - activity_id: ACT-DRAFT-0701
    course_run_id: CSS-4008-2026-FALL
    module_id: MODULE-07
    type: lecture
    title: Optimisation by gradient descent
    scheduled_at: 2026-10-13T10:00:00+05:00
    duration_minutes: 100
    concepts: [CONCEPT-GRADIENT-DESCENT]
    extensions:
      proposal: { ... }

  - activity_id: ACT-DRAFT-0702
    course_run_id: CSS-4008-2026-FALL
    module_id: MODULE-07
    type: lab
    title: Tuning a learning rate
    scheduled_at: 2026-10-15T14:00:00+05:00
    duration_minutes: 150
    concepts: [CONCEPT-GRADIENT-DESCENT]
    extensions:
      proposal: { ... }
```

Rules for the draft:

- **`ACT-DRAFT-<week><slot>`** — `ACT-DRAFT-0701` is week 7, first meeting. The
  same two-digit-week convention the authored file uses, so approved meetings
  sort with the ones already there.
- **A meeting names the module it teaches.** A meeting with no `module_id`
  produces a warning, and rightly: nothing links it to what is taught. Leave it
  off only for a revision or consultation slot, and say so in the report.
- **`concepts` on a meeting is a subset of its module's.** Never a concept the
  module does not carry, and never one the approved graph does not have.
- **`estimated_hours` is derived** from the durations you were given, not
  guessed. 100 + 150 minutes is 4.2 hours.
- **Titles are the concept's language**, not new phrasing you preferred. If you
  cannot title a meeting from the concept and the source material, leave the
  title as the concept's own name and say so.
- **`preparation` only if the material supports it.** An invented reading is an
  instruction to a student that no one wrote.
- **Never fill a week for the sake of symmetry.** 12 concepts across 15 weeks
  means three weeks with no new concept. Say that in the report and let the
  professor decide whether those are revision, project time, or a sign the
  concept map is thin. Padding is the one thing here that looks like work and is
  not.

## 5. The midterms and the final

Draft three assessment shells. Their **placement** follows the calendar and is
yours to propose; their **weight** is a claim about how students are judged, and
this is the one place this skill proposes one:

```yaml
assessments:
  - assessment_id: ASSESSMENT-DRAFT-MT1
    course_run_id: CSS-4008-2026-FALL
    title: Midterm 1
    type: exam
    module_id: MODULE-07
    maximum_score: 100
    weight: 0.3
    due_at: 2026-10-15T14:00:00+05:00
    extensions:
      proposal:
        proposed_by: plan-term-skill
        source: >-
          Narxoz policy — midterm 1: 30, midterm 2: 30, final: 40. Institutional
          policy, not a claim from this course's material.
        weight_is_a_convention: true
```

**The split is 30 / 30 / 40** — midterm 1, midterm 2, final. That is Narxoz
policy, which is why it may be proposed at all: it is a source rather than a
guess. It is still not a statement about *this* course, and a professor may
depart from it.

The conditions on that, and none of them is optional:

- **Propose a split only when these three are the whole scheme.** Read the run's
  existing assessments. If any already carries a weight, propose **no** weight
  at all — leave the field out, and ask. Three weights that make the run sum to
  1.6 are not a proposal, they are arithmetic you can already see is wrong.
- **`weight_is_a_convention: true` on every one of them.** It is the flag that
  says a human never chose this number for this course.
- **Say it first in the report**, before anything else, in one sentence: *these
  three weights are Narxoz policy and not from your material; change them before
  approving if this course differs.* A weight that reaches `courses/` unexamined
  becomes the divisor in `ainar alignment` and the grade share in
  `ainar gradebook`.
- **No rubric, no criteria.** Those are claims and they are not yours. Say the
  shells need rubrics and point at `/design-assessment`.
- **Placement**: midterm 1 after the week that closes the first block of
  concepts, midterm 2 after the second, the final in the exam period after the
  last teaching week. Say which week each lands in and why that week.

Where the final falls after `end_date`, say so rather than moving it inside —
the run's dates may be the thing that is wrong.

## 6. Check it

```bash
bin/ainar validate CSS-4008 --drafts work/CSS-4008-2026-FALL
```

Five codes matter here and every one is a real planning error:

- `schedule.slot_clash` — two meetings at the same instant. The week increment
  is wrong; every week after it is wrong too.
- `schedule.week_mismatch` — a meeting falls in a different week of the run from
  the module it teaches. Either the pattern is off by a week or the module's
  `week` is.
- `schedule.outside_run` — a meeting or a due date past the run's end.
- `schedule.no_module` — expected for a revision slot, a mistake anywhere else.
- `weight.sum` — the run's weights no longer total 1.0. **Report it. Never
  rebalance another assessment to absorb it.**

Fix every error. Report every warning.

## 7. Report, then hand over

In this order:

1. **The weight sentence from §5**, first, if you proposed weights at all.
2. **The calendar**: week 1's dates, week *n*'s dates, the total meeting count,
   and any week that lands oddly.
3. **The weeks table**: week, module title, concepts introduced, meetings. This
   is what the professor actually reads.
4. **Weeks with no new concept**, named, with what you think they are for.
5. **Judgement calls**: every place you chose which week a concept belongs to
   when the material did not say, and every prerequisite edge that forced an
   ordering.
6. **What is still missing**: rubrics for the three assessments, outcomes on the
   modules if the course has outcomes you could not map, rooms.

Then stop. **Do not run `ainar approve` yourself.**

```bash
bin/ainar approve work/CSS-4008-2026-FALL --as USER-ARD-A01
```

Tell them to edit first — move a week, change the weights, delete the meetings
for a week they teach differently — and that `--only` and `--reject` approve a
subset. Approved modules land in `versions/<vN>/modules/approved.yaml`; approved
meetings land in `versions/<TERM>/activities/generated.yaml`, beside the authored
schedule rather than inside it.

Also give them the snippet to paste into `run.yaml`, so next term is one
question shorter:

```yaml
extensions:
  schedule:
    weeks: 15
    meetings:
      - {type: lecture, weekday: tuesday, time: "10:00", duration_minutes: 100}
      - {type: lab, weekday: thursday, time: "14:00", duration_minutes: 150}
```

`run` is not a draftable collection, so you cannot write that yourself — which
is correct. It is the professor's own timetable.

## Without the CLI

This degrades further than most, because the calendar is arithmetic and the
concept order is a graph you can read.

Read `versions/<TERM>/version.yaml` for `start_date`, `end_date` and `timezone`, and
`versions/<vN>/concepts.yaml` for the graph. Then derive the dates by hand and do
these four checks yourself, because they are the ones that matter and all four
are catchable by reading:

- **Prerequisite order.** Trace every edge; no concept before something it
  requires.
- **Week arithmetic.** Anchor on the Monday of the run's opening week. Check the
  last week against `end_date`.
- **Slot collisions.** Two meetings must not share a datetime.
- **Weight sum.** Add the run's existing assessment weights to anything you
  propose. If it is not 1.0, propose no weights.

Read `versions/<TERM>/activities.yaml` in full first — a run with meetings already
in it is being extended, and a duplicate `activity_id` is refused on load.

Report all four as checked, and say plainly that the rest of `ainar validate`
did not run.

`references/working-without-the-cli.md` carries the file layout, the identifier
patterns and how approval works by hand. Read it before starting.

## Rules

- **The calendar is yours to derive; the term's shape is not.** Weeks per term
  and meetings per week come from the professor, every time. The 15×2 default is
  a question you ask, never an assumption you act on.
- **A concept the approved graph does not hold does not get scheduled.** If a
  week needs a concept that is not there, say so and point at
  `/propose-concepts`. Do not draft the concept here.
- **Never renumber.** A run being extended keeps its existing `MODULE-*` and
  `ACT-*` identifiers. Add; do not tidy.
- **Weights are a convention you flag, not a decision you make.** Everything in
  §5 applies whether or not anyone reads the report.
- **No student names anywhere**, including in a meeting title or a preparation
  note.
