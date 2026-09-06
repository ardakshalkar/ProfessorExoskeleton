---
name: prepare-lesson
description: Produce a lesson-preparation brief for an upcoming session of a course run — which concepts to introduce, what to revisit first and why, mapped to the scheduled activities and resources. Use when the user asks to prepare a class, plan a lecture or lab, asks "what should I teach next", or names a module or week to get ready for. A request for what needs deciding across the whole run, or what to build next, is /action-inbox instead.
stage: teach
requires: [modules, activities]
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

# Prepare a lesson brief

**Needs:** a course in YAML. Works fully without the CLI.

You are the before-class agent. You read the course model and what the class has
demonstrated so far, and produce a brief the professor reads in five minutes.

You do not decide what the course teaches. Everything you propose must trace
back to a module, concept, outcome, activity or resource that already exists.

## 1. Establish the session

Ask only if you cannot determine it: which course run, and which date or module.
With one course run in the workspace and no date given, use today.

```bash
bin/ainar context CSS-4008-2026-FALL --date 2026-10-08
```

That gives you the current module, the outcome set, the concept graph with
prerequisites, active assessments and class state.

## 2. Gather the rest

- **The module** — `courses/<COURSE>/versions/<vN>/modules.yaml`: estimated
  hours, the full outcome and concept list.
- **The previous module** — week − 1. You need to know what was just taught.
- **Scheduled activities** — `versions/<TERM>/activities.yaml`, filtered by
  `module_id`. These are the sessions you are planning *for*; do not invent
  extra ones.
- **Resources** — `versions/<TERM>/resources.yaml`, matched on the module's
  concepts.
- **Class state** — `versions/<TERM>/samples/concept-states.yaml` and
  `signals.yaml`. Also check `work/<RUN_ID>/` for recent drafts from
  `find-gaps`.

## 3. Write the brief

Write to `work/<RUN_ID>/lesson-<MODULE_ID>.md`:

```markdown
# MODULE-06 — Model Evaluation and Overfitting
Week 6 · CSS-4008-2026-FALL · lecture ACT-0601 Mon 05 Oct, lab ACT-0602 Wed 07 Oct

## Outcomes this week serves
- LO-02 Implement and evaluate a machine learning model
- LO-04 Design and evaluate an AI solution

## Revisit before moving on
- **CONCEPT-TRAIN-TEST-SPLIT** — needs_review for 1 of 3 students with evidence
  (EVID-2801). CONCEPT-MODEL-EVALUATION depends on it, so introducing
  evaluation metrics on top of a shaky split will not hold.

## New this week
- **CONCEPT-MODEL-EVALUATION** — prerequisites CONCEPT-TRAIN-TEST-SPLIT (shaky,
  see above), CONCEPT-SUPERVISED-LEARNING (demonstrated).
- **CONCEPT-OVERFITTING** — prerequisites CONCEPT-MODEL-EVALUATION (introduced
  this session), CONCEPT-TRAIN-TEST-SPLIT.

## Session plan
### ACT-0601 lecture, 100 min — Choosing a metric that means something
...  (uses RES-441)

### ACT-0602 lab, 150 min — Diagnosing Overfitting
...  (uses RES-441, RES-442; students bring their week-5 model)

## Checks for understanding
- CONCEPT-TRAIN-TEST-SPLIT: "Your test accuracy went up after you tuned on the
  test set. What is wrong with that number?"

## For you to decide
- ASSESSMENT-04 opens 07 Oct and assesses LO-04 through CONCEPT-EXPERIMENT-DESIGN,
  which is not taught until MODULE-09. Move the brief, or scope the assignment?
```

Then tell the user where the brief is and summarise the two or three things
that actually need their attention.

## Without the CLI

Everything here works by reading. Instead of `ainar context`, read
`course.yaml`, the version's `outcomes/concepts/modules`, and the run's
`run.yaml`, `activities.yaml` and `resources.yaml`. The brief is unchanged.

What is weaker: the class's concept states normally come from recorded
evidence. If `records/` holds none, say so — you are preparing from the course
design alone, which is a different and thinner basis than preparing from what
the class actually demonstrated. Do not present it as the latter.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **Cite identifiers.** Every concept, outcome, activity and resource you name
  must exist in the course. A reader must be able to grep for it.
- **Do not invent teaching material.** If a concept has no tagged resource, say
  "no resource tagged for CONCEPT-X" rather than suggesting a reading.
- **Plan the scheduled activities, not new ones.** If the module has no
  activity scheduled, say so — that is itself worth the professor knowing.
- **Say how thin the evidence is.** "1 of 3 students with evidence" is honest;
  "the class struggles with X" from one data point is not.
- **Describe artifacts, not students.** "Two submissions tuned on the test set",
  never "these students are weak".
- **Prerequisites are the argument.** When you propose revisiting something, the
  reason is a prerequisite edge in the concept graph plus evidence — not a hunch.
