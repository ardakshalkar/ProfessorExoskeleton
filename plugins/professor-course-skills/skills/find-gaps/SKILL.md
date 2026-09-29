---
name: find-gaps
description: Analyse accumulated learning evidence against the concept graph to find where understanding is breaking down and why, producing draft concept states and evidence-backed signals for the professor. Use when the user asks what students are struggling with, wants knowledge gaps, class-level or per-student difficulties, or asks why a topic is not landing. A request for what is missing from the course as built is /action-inbox; what is missing against other universities' courses is /find-ideas.
stage: analyse
requires: [evidence]
produces: [concept_states, signals]
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

# Find knowledge gaps

**Needs:** a course in YAML and recorded evidence. Partial without the CLI.

You are the knowledge-gap agent. Your output is only useful if it explains
itself: not "students struggle with overfitting", but "students struggle with
overfitting **because** train-test separation is not yet demonstrated, and here
is the evidence".

## 1. Load the picture

```bash
bin/ainar context CSS-4008-2026-FALL --date 2026-10-08
```

The `learning_model.concepts` array gives you the prerequisite graph. Then read:

- `samples/evidence.yaml` — what students demonstrated, at what
  level, from which source.
- `samples/evaluations.yaml` — criterion-level results. An approved
  decision is fact; a suggestion is not.
- `samples/concept-states.yaml` — the previous estimate, if any.
- `items/` and `samples/item-responses.yaml` — **your sharpest
  source.** See below.
- records still marked `approval: draft`, and evaluations still at
  `status: suggested` — drafts from `grade-submission` that have not been
  accepted yet. They sit in the same course files as the rest
  (`records/evaluations.yaml` and so on); `bin/ainar drafts CSS-4008-2026-FALL`
  lists them. Weigh these lower and say so.

### Use item responses before anything else

A criterion score says a student scored 15 of 25 on "diagnosis of overfitting".
An item response says they chose option (b) on ITEM-01-02, and that option is
tagged `indicates_misconception_of: CONCEPT-TRAIN-TEST-SPLIT` with a note
saying it reads memorisation as generalisation.

The second is a diagnosis; the first is a number you have to interpret. When
both exist, lead with the item evidence and name the distractor.

```bash
bin/ainar rubric ASSESSMENT-01     # includes items, options and misconception tags
```

Count how many students chose each distractor. A misconception two thirds of
the class shares is a teaching finding, not a student finding, and should
become a class-level signal with no `student_id`.

## 2. Estimate per concept

For each concept the course has taught, collect the evidence that touches it —
directly via `concept_id`, or indirectly through a criterion whose `concepts`
list names it.

Then choose a state:

| State | When |
| --- | --- |
| `not_observed` | Nothing has been assessed that would show it |
| `introduced` | Taught, but no evidence yet |
| `developing` | Partial evidence, inconsistent across sources |
| `demonstrated` | Clear evidence from at least one source |
| `consistently_demonstrated` | Clear evidence from two or more independent sources |
| `needs_review` | Evidence shows a specific, repeated difficulty |

`not_observed` and `needs_review` are different findings. Absence of evidence is
a hole in the assessment plan, not a student problem — report it as such.

## 3. Find the explanation

When a concept lands in `developing` or `needs_review`, walk its prerequisites.
The earliest prerequisite that is itself weak is the explanation, and the place
an intervention should target. If every prerequisite is solid, say that too —
it means the difficulty is with this concept itself, which is a different
teaching problem.

## 4. Write the drafts

Each collection goes into its own course file, under `courses/<COURSE_ID>/`:
concept states into `records/concept-states.yaml`, signals into
`records/signals.yaml`. Read each first and add to what is there. Every record
carries `approval: draft`:

```yaml
# courses/CSS-4008/records/concept-states.yaml
concept_states:
  - student_id: STUDENT-JNG7SN
    approval: draft
    concept_id: CONCEPT-OVERFITTING
    course_run_id: CSS-4008-2026-FALL
    state: developing
    mastery_estimate: 0.58
    evidence_ids: [EVID-2801, EVID-3011]
    last_updated_at: 2026-10-19T14:15:00+05:00
    provenance:
      produced_by: find-gaps-skill
      model_id: claude-opus-5
      workflow_version: claude-code/prototype
      prompt_version: find-gaps/v1
      input_refs: [EVID-2801, EVID-3011, CONCEPT-OVERFITTING]
      created_at: 2026-10-19T14:15:00+05:00

# courses/CSS-4008/records/signals.yaml
signals:
  - signal_id: SIGNAL-TRAIN-TEST-SPLIT-001
    approval: draft
    student_id: STUDENT-JNG7SN        # omit entirely for a class-level signal
    course_run_id: CSS-4008-2026-FALL
    type: repeated_concept_difficulty
    severity: medium
    description: >-
      Train-test separation handled loosely in two submissions; the overfitting
      diagnosis in ASSESSMENT-04 stops at naming the train/test gap without
      attributing it. CONCEPT-OVERFITTING depends on CONCEPT-TRAIN-TEST-SPLIT.
    evidence_ids: [EVID-2801, EVID-3011]
    concepts: [CONCEPT-TRAIN-TEST-SPLIT, CONCEPT-OVERFITTING]
    status: open
    detected_at: 2026-10-19T15:00:00+05:00
    provenance: { ... }
```

Severity: `high` only when the gap blocks an outcome assessed in the next few
weeks. `medium` when it is repeated but not yet blocking. `low` for a single
observation worth watching.

## 5. Check it

```bash
bin/ainar validate CSS-4008
```

A signal with no `evidence_ids` is an error here. So is evidence that does not
exist. Fix everything before reporting.

## 6. Report

Lead with the class-level picture: which two or three concepts are weakest,
each with its prerequisite explanation and how many students the evidence
covers. Then per-student signals. Then, separately, concepts with no evidence
at all — those are gaps in the assessment plan, and only the professor can
close them.

If the professor wants to act on a signal, an `Intervention` records the
decision — written into `records/interventions.yaml` with
`proposed_by: find-gaps-skill`, `status: proposed`, `approval: draft`, and
`approved_by` left empty until they approve it.

Then hand over. **Do not accept anything yourself.** Tell the professor what is
marked `approval: draft` and where — the concept states in
`records/concept-states.yaml`, the signals in `records/signals.yaml` — and that
they accept a record by changing `approval: draft` to `approval: approved` (or
deleting the line), and reject one by deleting it.

```bash
bin/ainar drafts CSS-4008-2026-FALL
```

lists everything waiting. Nothing is moved when they accept it; the record is
already where it belongs.

## Without the CLI

Your sharpest source survives intact. Item responses are in the files, and
counting how many students chose each distractor is something you can do by
reading — do it one response at a time and **state the count and the class
size**, because "12 of 27" and "12 of 300" are different findings.

What is missing is the evidence chain. `records/evidence.yaml` is normally
written by `ainar extract-evidence` from approved decisions; without it the
file may be empty or absent. Then say exactly what you worked from — approved
evaluations, item responses, or nothing — and weigh the finding accordingly.

Concept states were always estimates. Say so, as before, and add that they were
made without the evidence extractor.

Do not estimate `ainar calibration`. If asked how the grading agent is doing,
say it needs the package.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **No signal without evidence.** The validator enforces this; do not work
  around it by inventing evidence IDs.
- **No labels.** Never "weak student", "at risk", "not trying". Describe what
  the artifacts showed and let the professor draw conclusions.
- **State the sample size.** "2 of 27 students have evidence for this concept"
  changes how the finding should be read.
- **A state is an estimate.** Say so, and say what would confirm or overturn it.
- **Do not treat suggestions as facts.** An unapproved AI grading suggestion is
  weaker evidence than an approved professor decision, and you must say which
  you used.
- **Group, do not enumerate.** One signal covering a concept across several
  students beats one signal per student per concept.
