---
name: grade-batch
description: Grade a whole class's submissions for one assessment — score choice items deterministically, draft criterion-level suggestions for the rest, and report which few need the professor's attention first. Use when the user asks to grade a batch, a folder of submissions, the whole class, all the exams, or everyone's homework.
stage: assess
requires: [assessments, submissions, item_responses]
produces: [evaluations]
writes: drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write into the course, where the record belongs — the file for its
>   collection under `courses/<COURSE>/`, with its real identifier — and mark
>   every record you write `approval: draft` (a grade: `status: suggested`).
>   Materials go in `materials/<MATERIAL>/`. Nothing is moved afterwards, and
>   nothing student-facing reads a draft.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Artefacts that serve an existing claim you may draft; that is the
>   job. Concepts and modules may be **proposed** from source material the
>   professor supplied, with `extensions.proposal.source` naming where each came
>   from — proposed, not invented, and inert until approved.
> - **Never accept your own work,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Do not write `approval: approved`, a
>   `professor_decision`, or an approved status: accepting a draft, or posting a
>   grade a student can see, is the one place a human enters. Say what is
>   waiting instead. `ainar publish … --confirm` publishes only what the
>   professor has accepted; only `/publish` runs it, and only on the
>   professor's explicit instruction in that request.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Grade a whole class

**Needs:** a course in YAML. Partial without the CLI — it will not score choice items.

Grading one submission is `/grade-submission`. Grading twenty-seven is a
different job: most of the work is mechanical, most of the remainder is
routine, and the professor's attention should land on the few that are neither.

Your output is still only suggestions. Nothing here approves anything.

**Paper exams that came back as scans start at `/grade-scans`,** which splits
the pile, matches it to the roster and records the answers read off the pages;
it hands the written items back here.

**A written item with no criterion, or a criterion with no levels, is not
graded here.** There is nothing to match a passage to. `/import-assessment` §7
proposes the criterion from what the class wrote (`scans answers`), the
professor answers, and then it comes back.

## 1. Find the work

```bash
bin/ainar pending CSS-4008-2026-FALL --assessment ASSESSMENT-04
```

```
ASSESSMENT-04  Model Evaluation Assignment
  24 of 27 submitted  ·  12/96 judgements done
  scored by items (no grading needed): CRIT-04-01
  missing: STUDENT-A3F9K2, STUDENT-TOG73A, STUDENT-EYDHRB
    SUB-9081  STUDENT-JNG7SN  -> CRIT-04-02, CRIT-04-04
```

One submission times one criterion is one judgement. Grade only what is listed
as remaining — re-grading something already evaluated creates a duplicate
identifier, which `ainar validate` refuses.

Report the missing submissions to the professor early. They are a different
kind of problem and are often more urgent than the grading.

## 2. Score what does not need you

If the assessment has choice items, score them first:

```bash
bin/ainar score-items CSS-4008-2026-FALL
```

This compares `chosen_options` against the answer key, scoring the item
responses in the course's `records/item-responses*.yaml` in place and marking
what it scored `approval: draft`. It is deterministic —
do not do this work yourself, and do not second-guess its output. It also
prints item difficulty and, for each item, which wrong answer the class
converged on:

```
ITEM-01-02  9/27 correct  (33%)
    14 chose (b) — reads as a misconception of CONCEPT-TRAIN-TEST-SPLIT
```

Carry that into your report. A misconception half the class shares is a
teaching finding, not twenty-seven individual ones.

## 3. Grade the rest

For each remaining judgement, follow `/grade-submission`: read the artifact,
match the passage to a defined rubric level, cite a location, set confidence
honestly.

Two things change at batch scale:

- **Grade criterion by criterion, not submission by submission**, where the
  work allows it. Holding one criterion's rubric in mind across twenty-four
  submissions gives more consistent scores than switching criteria every time.
- **Do not let the batch drift.** If you find yourself awarding the middle band
  to everything, stop and re-read the level descriptions. A distribution with
  no spread usually means the criterion is not discriminating, which is worth
  telling the professor.

Write every evaluation into the course's `records/evaluations.yaml`, with its
real identifier `EVAL-<submission digits>-<criterion digits>` and
`status: suggested`.

## 4. Check it

```bash
bin/ainar validate CSS-4008
```

Suggestions and drafts are validated in place like any other record.

## 5. Report

Lead with the shape of the batch, not with a list of scores:

- how many judgements you produced, and how many still need a human;
- score distribution per criterion — a criterion where everyone scored the same
  is a finding;
- **the submissions to look at first**: low confidence, or a score that sits far
  from the rest of the class, or an artifact you could not read;
- shared misconceptions from the item data;
- missing submissions.

Then hand over. **Never write a `professor_decision` or an approved status
yourself.**

> The suggestions are in `courses/CSS-4008/records/evaluations.yaml`, each
> `status: suggested`; the scored item responses are in
> `records/item-responses*.yaml`, marked `approval: draft`. To accept an
> evaluation, add a `professor_decision` beside its `ai_suggestion` — `score`,
> `comment`, `decided_by`, `decided_at` — and set `status: approved` (same score)
> or `overridden` (changed score). To accept an item response, change
> `approval: draft` to `approval: approved`, or delete the line.
> `bin/ainar drafts CSS-4008-2026-FALL` lists everything still waiting; the
> gradebook and `extract-evidence` skip it until then. Afterwards:
>
> ```bash
> bin/ainar extract-evidence --course-version CSS-4008-2026-FALL
> ```

## 6. Afterwards

Once a batch has been approved, the agreement between your suggestions and the
professor's decisions is measurable:

```bash
bin/ainar calibration CSS-4008-2026-FALL
```

Offer this after a large batch. A criterion with a low agreement rate usually
means its level descriptions are too vague to apply consistently — that is a
rubric problem worth raising, not evidence that grading should stop.

## Without the CLI

This skill degrades least, and one part of it refuses outright.

**Choice items: do not score them.** `ainar score-items` compares answers to a
key, identically, hundreds of times. A model doing that arithmetic adds error
and nothing else, and the resulting numbers would look exactly as official as
correct ones. Say:

> The choice items in this assessment need `ainar score-items`. I have not
> scored them — a mark I work out by hand would not be safe to show a student.
> Install the package, or mark them yourself.

**Judgement criteria: grade them normally**, reading the rubric from the
assessment file. Work criterion by criterion across submissions, as above,
since consistency is the reason for that order and it does not depend on the
CLI.

**The pending list**: work out what is missing by reading `records/` against
the enrollments, one assessment at a time, and say you did it by reading.

**Totals, evidence, calibration**: unavailable. Do not estimate any of them.
Report the shape of the batch qualitatively instead — which submissions to open
first, and why.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **Never write `professor_decision`. Never set `status` to anything but
  `suggested`.** Volume does not change this.
- **Never total a grade**, per student or per class.
- **Do not compare students to each other in a comment.** Distribution belongs
  in your report to the professor, never in a record attached to one student.
- **Never name a student.** Identifiers only, in every comment and every
  summary — see the roster rules in CLAUDE.md.
- **Every suggestion still needs cited evidence with a location.** Batch size
  is not a reason to drop the citation; it is the reason the citation matters.
- **Flag rather than guess.** If ten submissions are unreadable, say so and
  grade the rest. A batch that is 80% done and honest beats one that is 100%
  done and partly invented.
