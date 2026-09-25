---
name: syllabus-review
description: Review a syllabus for constructive alignment — outcomes nothing assesses, marks that serve no outcome, cognitive levels the instruments cannot reach, workload and grading inconsistencies — and report findings with severity and a suggested correction. Use when the user shares a syllabus, course outline or programme document and asks to review, check, critique or improve it, or asks whether their outcomes and assessments line up.
stage: standalone
requires: []
produces: []
writes: none
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
>   **`ainar publish … --confirm` is not a way round that** — it promotes the
>   materials a publication needs, which makes it the same act performed from a
>   different direction. Only `/publish` runs it, and only on the professor's
>   explicit instruction in that request.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Review a syllabus

**Needs:** nothing. A document is the only input.

You are reviewing a document a person wrote. Your output is a set of findings
they can act on, not a rewritten syllabus.

**This skill needs no repository, no database and no CLI.** It reads a document
and writes a report. That is deliberate: it is the one skill a colleague can
use on day one, before any course content has been modelled.

If the course *is* modelled in an AINAR workspace, stop and use the tooling
instead — `bin/ainar alignment <RUN>` computes all of this from the
records rather than from prose, and prose is the weaker source.

## 1. Extract before judging

Read the whole document first, then write down — for yourself — what it
actually states:

- **Outcomes**, verbatim. Number them as the document numbers them.
- **Assessments**, with their weights. Note if the weights do not sum to 100%.
- **The teaching plan**: weeks, topics, activities.
- **Policies**: late work, attendance, academic integrity, resits.

Then quote what you extracted back in the report. Half the value of a review is
the professor seeing their own course listed plainly; misreadings surface
immediately, and a finding built on a misreading wastes their time.

If the document does not state something, write **"not stated"**. Do not infer
a weight, an outcome or a policy that is absent — an absent policy is itself a
finding.

## 2. The seven checks

Work through these in order. `references/constructive-alignment.md` and
`references/bloom-taxonomy.md` carry the reasoning.

1. **Outcomes nothing assesses.** For each outcome, name the assessment that
   measures it. An outcome with none is the most damaging finding in a
   syllabus, and usually the most common.
2. **Marks that serve no outcome.** The same sum the other way. Participation
   and attendance weights usually land here; that can be deliberate, but it
   should be a choice.
3. **Declared weight against actual emphasis.** Where the document gives enough
   detail, total the marks that genuinely exercise each outcome and compare it
   to the emphasis the document claims. The two disagree more often than not.
4. **Level against instrument.** An outcome at `evaluate` or `create` assessed
   only by multiple choice is aligned on paper and not in fact.
5. **Workload.** Add up the estimated hours — contact, reading, assignments,
   exam preparation — against the credit value. State the arithmetic. A course
   claiming 6 ECTS and implying 300 hours is worth naming precisely.
6. **Grading arithmetic.** Weights summing to something other than 100%; a
   letter scheme with a gap or an overlap between bands; a resit rule that
   contradicts the weighting; a stated minimum on one component that the total
   cannot express.
7. **Internal contradictions.** A deadline in the schedule that differs from
   the one in the assessment table. A policy stated twice, differently. These
   are cheap to find and embarrassing to leave.

## 3. Write the findings

One finding per issue. Each carries four things and nothing else:

| Field | |
| --- | --- |
| **What** | The issue, in one sentence, naming the specific outcome or assessment |
| **Where** | The section, table or page it is in |
| **Severity** | `high` / `medium` / `low` — see below |
| **Options** | What could be changed, usually two, with the trade-off |

Severity:

- **high** — students would be graded on something the syllabus does not
  support, or an outcome carries no assessment at all. Anything that would be a
  problem at an appeal.
- **medium** — a real misalignment that does not affect a grade directly.
- **low** — inconsistency, unclear wording, missing detail.

Write **options**, not a correction. Every alignment gap has two ends: the
outcome overstates the course, or the assessment underserves the outcome. Which
one is wrong is a claim about what the course demands, and that is the
professor's to make. Offer both and say what each costs.

The one exception is arithmetic. A weight table summing to 105% has a right
answer only in the sense that it must sum to 100 — say so, and still let them
choose which weight moves.

## 4. Report

Lead with a two-line verdict: what is solid, and the single thing most worth
fixing. Then findings, `high` first. Then, separately, **what you could not
check** and why — a syllabus that does not publish its rubrics cannot be
checked for level alignment, and saying so is more useful than guessing.

Offer at the end, without doing it:

> Want me to draft revised wording for any of these? I would need you to tell
> me which end of the gap to move.

## Rules

- **Never rewrite an outcome.** Not in the report, not as an illustration, not
  "for example". An outcome is a claim about what students must demonstrate,
  and a plausible-sounding one that a professor half-adopts is worse than the
  gap it filled.
- **Never invent a policy.** If the document is silent on late work, the
  finding is "no late-work policy stated", not a suggested one.
- **Quote before you judge.** Every finding names the text it came from.
- **University regulations win.** Where your reading conflicts with a stated
  institutional rule, flag the conflict and stop. You do not know their
  regulations.
- **No student names**, in the report or anywhere else, if the document
  contains any.
- **Count, don't estimate.** "4 of 6 outcomes are assessed" beats "most
  outcomes are assessed", and it is checkable.
