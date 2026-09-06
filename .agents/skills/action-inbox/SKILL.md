---
name: action-inbox
description: Assemble a prioritised list of what needs the professor's attention in a course run — grades awaiting approval, missing submissions, open signals, deadlines — and, for a course that has not started, where it stands structurally and what to build next. Use when the user asks what needs their attention, what is pending, what they should do next, where a course stands, how complete it is, what is still missing, wants their inbox or a status check on a course. Asking what to teach next for one session is /prepare-lesson; where students are struggling is /find-gaps; what other universities cover is /find-ideas.
stage: analyse
requires: []
produces: [action_items]
writes: drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write to `work/<RUN_ID>/`, never into `courses/`. Draft identifiers carry a
>   `-DRAFT-` segment so they cannot be mistaken for records.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Artefacts that serve an existing claim you may draft; that is the
>   job. Concepts and modules may be **proposed** from source material the
>   professor supplied, with `extensions.proposal.source` naming where each came
>   from — proposed, not invented, and inert until approved.
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

# Build the action inbox

**Needs:** a course in YAML. Partial without the CLI — the list is read by hand.

You are the action-inbox agent. Everything the exoskeleton wants from the
professor arrives here, and each item must say what produced it. An item with
no traceable source is noise, and noise is how an inbox dies.

Two questions arrive here. Mid-term the professor is asking what needs
deciding. In August, or the week a course is being built, they are asking what
to build next — and a course with no students has no pending decisions, so the
inbox proper is empty and answers nothing. Both are below.

## 1. Get the state

```bash
bin/ainar inbox CSS-4008-2026-FALL --date 2026-10-18
```

That returns, already joined:

- `readiness` — how far the course has been built, and the next move
- `pending_evaluations` — suggestions with no professor decision, grouped by
  assessment, with the low-confidence ones listed individually
- `assessments` — status (`upcoming`, `due_soon`, `closed`), submissions
  received against students enrolled, and who is missing
- `open_signals` — with severity, evidence count, and whether an intervention
  already exists
- `interventions_awaiting_approval`
- `recent_events`
- `existing_action_items` — what is already in the inbox

Add `--drafts work/<RUN_ID>` to include unapproved agent output.

## 2. Read the ladder before deciding anything

`readiness` holds nine rungs in dependency order — `outcomes`, `concepts`,
`modules`, `schedule`, `assessments`, `weights`, `rubrics`, `roster`,
`materials` — with `next_step` already set to the first unfinished one and
`has_student_work` saying which question this run is asking.

Every rung carries a `state` (`ready`, `partial`, `missing`), a `detail` with
the counts, and a `kind` that says whose move it is:

| `kind` | What you may do |
| --- | --- |
| `claim` | Report the gap and ask. `outcomes` and `weights` are the professor's sentences, and no phrasing of the question makes them yours |
| `draft` | Propose it with the skill named in `next`, into `work/` for approval |
| `command` | Run it, or show it to them if it touches identities |

**The counts in `detail` are computed. Copy them; never recount.** A number you
worked out by hand will disagree with the command eventually, and then the
professor has two figures and no way to tell which is real.

### How much each gap matters, and whether it is late

The rungs say what is unfinished. A professor in week three is asking which of
those is a problem *now*, and `readiness` answers that with two fields on every
rung and three lists beside them. All of it is computed from the run's own
dates — **do not re-rank it, and do not promote something because it reads
urgently.** "Do not invent urgency" is only enforceable because the urgency is
in the data.

`phase` says where they are standing: `state` is `before`, `running` or
`finished`, and `week` is the teaching week counted from the run's `start_date`.
Before the term it is `null`, because week zero is not a week.

| Field | What it says |
| --- | --- |
| `importance` | `required` — the term cannot run: nobody can be told when to turn up, what they are marked on, or be graded at all. `advisable` — the course runs but the exoskeleton cannot do its job. `optional` — worth doing, not yet worth doing now |
| `timing` | `overdue`, `due_now` (within a week), `soon` (within three), `later`. `null` when no date was given — a course is late against its own dates or against nothing |

`checklist` is every unfinished thing as one flat list, already ordered with
overdue-and-required first. `by_importance` is the same set in three tiers.
Report from these rather than from `stages`, because a rung and a single week
are not comparable until they sit in one ordering.

`reminders` is the narrow list: `overdue` **and** `required`. That is the answer
to "am I behind?", and it is deliberately smaller than the checklist — an
overdue concept map is a real gap and not an emergency, and mixing the two is
how a professor learns to stop reading the list. If `reminders` is empty, say
so; do not restock it from the tier below.

`materials` is the one rung that reports per week, in `items`, because "you are
in week three and week three has nothing" cannot be said by a single state. Each
item carries its own `importance`, and it decays with distance: the week being
taught is `required`, a fortnight out is `advisable`, and beyond that `optional`.
**A `later` week with no material is not a finding.** Being ahead of the class
was never the goal, and listing nine future weeks as gaps buries the one that
matters.

**When `has_student_work` is `false`**, lead the report with the ladder rather
than with an empty list of pending decisions. Say where the course stands, what
the next move is, and whose it is. Create **one** ActionItem for `next_step` —
not one per unfinished rung, which is nine items for a course that needs one
decision — and only when it is something the professor acts on now.

**When it is `true`**, the pending decisions lead and the ladder goes at the
end, in one line, and only for the rungs that are not `ready`. A `partial`
`materials` rung mid-term is a course being taught a week at a time, not a
problem: mention it if the next session has nothing, and otherwise leave it.

A rung that is `missing` under a `ready` one below it is worth saying out loud
either way — assessments carrying no rubric while the roster is imported is a
term that will reach its first deadline with nothing to mark against.

## 3. Decide what deserves a slot

Not everything true is worth an item. Create one when there is an action the
professor can actually take, and skip it otherwise.

**Prioritise by consequence, not by count.**

| Priority | Typical case |
| --- | --- |
| `urgent` | A deadline passes within 24h with nothing prepared; a grade release is blocked |
| `high` | Grades awaiting approval on a closed assessment; a `high` severity signal with no intervention |
| `medium` | Missing submissions after a deadline; an intervention awaiting approval; a `medium` signal |
| `low` | Upcoming deadlines more than a week out; a single low-severity observation |

Merge aggressively. "Review 24 suggested grades for ASSESSMENT-04" is one item,
not 24. One item per student per criterion is a broken inbox.

Check `existing_action_items` first. If an item already covers the situation,
do not create a duplicate — say it is already there.

## 4. Write the drafts

`templates/` beside this skill holds the two shapes this reports in — a running
course and a course that has not started — plus `action-items-draft.yaml` for the
records behind it. The ladder decides which: with no student work, `pre-term.md`
is the honest one. Show the professor the choice where it is not obvious.
`references/templates.md` has the convention.

Write to `work/<RUN_ID>/action-items-draft.yaml`:

```yaml
action_items:
  - action_id: ACTION-DRAFT-001
    course_run_id: CSS-4008-2026-FALL
    assigned_to: USER-ARD-A01
    type: review_grades
    title: Review 1 suggested grade for the Model Evaluation Assignment
    description: >-
      EVAL-6002 (CRIT-04-03, diagnosis of overfitting) has no decision yet.
      Confidence 0.64.
    priority: high
    source_event_id: EVENT-882
    source_refs: [ASSESSMENT-04, EVAL-6002]
    status: pending
    due_at: 2026-10-20T17:00:00+05:00
    available_actions: [review, approve, dismiss]
    provenance:
      produced_by: action-inbox-skill
      model_id: claude-opus-5
      workflow_version: claude-code/prototype
      prompt_version: action-inbox/v1
      input_refs: [EVENT-882, EVAL-6002]
      created_at: 2026-10-18T09:00:00+05:00
```

A `next_step` from the ladder is written the same way, sourced to the rung it
came from and to nothing else:

```yaml
  - action_id: ACTION-DRAFT-002
    course_run_id: CSS-4008-2026-FALL
    assigned_to: USER-ARD-A01
    type: build_course
    title: State the four learning outcomes for the run
    description: >-
      readiness.outcomes is partial — 0 of 1 outcomes stated. Everything
      downstream attaches to these, and they have to be the professor's own
      words. /onboard-course records them once they are stated.
    priority: high
    source_refs: [readiness:outcomes]
    status: pending
    available_actions: [review, dismiss]
```

There is no `approve` on that one: nothing has been drafted to approve, and the
item exists to ask a question. Do not give it a `due_at` the professor did not
set — a structural step has no deadline in the data, and inventing one is
inventing urgency.

Set `available_actions` to what actually applies. An item with nothing to
approve should not offer `approve`.

Use `due_at` for when the professor should act, which is usually earlier than
the thing it concerns.

## 5. Check it

```bash
bin/ainar validate CSS-4008 --drafts work/CSS-4008-2026-FALL
```

An unknown `source_event_id`, an unknown assignee or a duplicate identifier
fails here.

## 6. Report

Show the inbox as a short ordered list — priority, title, one line of why now.
Put the count and the total time it plausibly represents at the top. If
nothing needs attention, say that plainly rather than manufacturing items.

Then the ladder, as a table of the rungs that are not `ready` — stage, what
`detail` says, `importance`, `timing`, and the move — with the `claim` rungs
marked as questions for them rather than work you can do. Order it the way
`checklist` already is. On a course with no student work this comes first and is
most of the answer: name the one next step, say why that rung and not a later
one, and say what it unblocks.

Lead with `phase` in a clause, not a section — "you are in week 3 of 16" — and
if `reminders` is non-empty, put it directly under that, as the shortest list on
the page. Group the rest under `required`, `good to have` and `not yet`, using
`by_importance` verbatim. A professor who reads only the first two lines should
learn the two things that are already costing them something.

**Never report a course as further along than the ladder says.** A `ready`
count is what the files hold, not a judgement that the content is any good —
`ainar alignment` and `validate`'s warnings are where that lives, and a rung
being `ready` never means those have nothing to say.

**Do not run `ainar approve` yourself.** Offer it:

```bash
bin/ainar approve work/CSS-4008-2026-FALL --as USER-ARD-A01
```

## Without the CLI

Build the list by reading: due dates from `versions/<TERM>/assessments/`, compared
against today; submissions present in `records/` against the enrollment list;
open signals from `records/signals.yaml`.

That is a cross-product, so keep it small and honest — work through one
assessment at a time, and say how you counted. If the class is large enough
that you are not confident in the count, say that instead of producing a
confident list. A wrong inbox is worse than a short one, because its whole
value is that the professor can trust it is complete.

Never state a student's total or standing here; that needs `ainar gradebook`.

The ladder is the part that survives best without the CLI, because it is
presence rather than arithmetic: whether `outcomes.yaml` still says `TODO`,
whether `concepts.yaml` has anything in it, whether `versions/<TERM>/`
has activities and assessments, whether any assessment carries a `weight`,
whether `enrollments.yaml` has rows. Walk it in the same order and stop at the
first gap — that is the next step, and it is the same answer the command gives.
Say the counts are read rather than computed, and do not report a rung as
`ready` on a file you did not open.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **Every item names its source.** `source_event_id` where an event caused it,
  `source_refs` otherwise. An item the professor cannot trace back is one they
  will learn to ignore.
- **One item per decision, not per record.** Group by assessment, by concept,
  by deadline — whatever matches the single action the professor will take.
- **Never assign a grade or approve anything.** Items ask; they do not act.
- **Do not invent urgency.** Priority comes from deadlines and severity in the
  data, not from wanting the item read.
- **An empty inbox is a valid result** for a term in motion. Report it as good
  news. For a course with no student work it is not a result at all — answer
  from the ladder instead.
- **A gap named is not a gap filled.** The ladder says `outcomes` is missing; it
  never says what the outcome should be, and `weights` missing is a question for
  the professor, never a number you supply.
- **Respect what is already there.** Existing pending items are the professor's
  working state; do not restate or reorder them without saying so.
