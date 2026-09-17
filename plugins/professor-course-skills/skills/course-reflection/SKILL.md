---
name: course-reflection
description: Work through a structured end-of-term reflection on a course that has finished — what the evidence says worked, what did not, and what to change next time — producing a dated note the professor can act on and compare against next year. Use when the user asks to reflect on a term, review how a course went, do a post-mortem or retrospective on teaching, or plan changes for next time.
stage: standalone
requires: []
produces: []
writes: prose
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

# Reflect on a term

**Needs:** nothing. Richer with a modelled course, but it does not require one.

The end of a course is when the evidence is richest and the memory is shortest.
This skill turns both into a dated note, so that next August there is something
better than a recollection.

**Two modes.** With an AINAR workspace, the evidence is already there and you
should read it. Without one, this is a structured interview — it needs no
repository, no database and no CLI, and it is worth doing anyway.

## 1. Gather what the term actually showed

With a workspace:

```bash
bin/ainar dashboard CSS-4008-2026-FALL
```

```bash
bin/ainar alignment CSS-4008-2026-FALL
```

```bash
bin/ainar calibration CSS-4008-2026-FALL
```

Read, in this order:

- **Concepts with no evidence at all.** These are gaps in the assessment plan,
  not in the class. They are the finding a professor is least likely to have
  noticed and most able to fix.
- **Concepts where the class did badly**, and what sits underneath them in the
  prerequisite graph. A weak concept whose prerequisite is also weak is a
  sequencing problem; one whose prerequisites are solid is a teaching problem
  with that concept itself. Different fixes.
- **Shared misconceptions in the item data.** A distractor two thirds of the
  class chose is a teaching finding.
- **Declared weight against actual share**, from the alignment report.
- **Criteria with low marker agreement**, from calibration — those are rubric
  wording problems, surfaced by data rather than by opinion.

Without a workspace, ask for whatever exists: the gradebook, the exam paper,
the score distribution, student feedback.

## 2. Ask what the data cannot say

The evidence covers what was assessed. Most of what went wrong was not. Ask,
one at a time, and wait for the answer:

- Which session did not land, and what did you notice in the room?
- Where did you run out of time, and what got dropped?
- Which assignment was worth marking, and which one did you regret setting?
- What did students ask repeatedly in office hours or after class?
- What did you change mid-term, and did it work?
- What would you not do again?

Ask these as questions, not as a form. If an answer opens something, follow it
before moving on.

## 3. Separate the three kinds of change

This is the part that makes the note useful rather than cathartic. Every
proposed change belongs in exactly one bucket:

| Bucket | Means | Cost |
| --- | --- | --- |
| **Delivery** | Same course, taught differently — order, pacing, examples, an added lab | You can do it alone, next term |
| **Instrument** | Same claims, measured differently — a rewritten rubric criterion, a replaced exam question, a new assignment brief | Yours, but it needs drafting time |
| **Claim** | The course now demands something different — an outcome added, dropped or reworded, a weight moved, a concept added to the graph | Usually needs approval, and it invalidates comparison with previous terms |

A reflection that puts everything in the third bucket produces no change,
because nothing that large gets done in August. Push hard on what can be fixed
in the first two.

Say explicitly which changes would break year-on-year comparison. Rewording an
outcome is sometimes right and always costly — student evidence points at that
identifier, and the model keeps the id precisely so the wording can change
without orphaning it.

## 4. Write the note

Write to `work/<RUN_ID>/reflection-<TERM>.md`, or beside the course if there is
no workspace. Never into `courses/` — a reflection is the professor's, not a
record of what the course claims.

`templates/` beside this skill holds two shapes: the full note, and a one-page
version for the week when the alternative is not writing one at all. Read
`templates.yaml`, offer both, and use what they pick. They are markdown files and
nothing else, so they work with no repository and no CLI.
`references/templates.md` has the convention.

```markdown
# CSS-4008, Fall 2026 — reflection
*Written 2026-12-20. 27 students, 4 assessments, 11 concepts.*

## What the evidence showed
...

## What I noticed that the evidence does not hold
...

## Changes for next term
### Delivery
- [ ] ...
### Instrument
- [ ] ...
### Claims — needs a decision
- [ ] ...

## Deliberately not changing
...

## To check this time next year
- Did CONCEPT-TRAIN-TEST-SPLIT improve after moving it before week 4?
```

The last two sections carry most of the value. **"Deliberately not changing"**
stops the same argument being had again next year. **"To check next year"**
turns a change into a hypothesis with a test, which is the difference between
iterating and thrashing.

## 5. Hand over

If any change is a claim — a new outcome, a moved weight, an added concept —
name it as a decision the professor has to make, and say which tool drafts it
once they have (`/propose-concepts` for a concept, `/design-assessment` for an
instrument). Do not draft it inside the reflection.

## Rules

- **No student names.** Not in a quote from feedback, not in an example of work.
  If they paste a comment naming a student, strip it.
- **A blank is not a bad result.** A concept with no evidence was never
  assessed. Say it in those words; reading it as a low score is the single
  easiest way to misjudge a class.
- **Do not rank the students**, and do not characterise the cohort ("weak
  year"). The unit of reflection is the course.
- **Small n is small n.** With 27 students, a 4-point difference between two
  assessments is not a finding. Say so.
- **The professor's account outranks the data on anything the data did not
  measure**, and the data outranks recollection on anything it did. Say which
  you are using for each finding.
