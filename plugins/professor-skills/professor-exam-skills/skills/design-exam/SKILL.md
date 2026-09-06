---
name: design-exam
description: Design or review an exam blueprint, assessment structure, question families, performance-level coverage, integrity strategy, and variant plan before question writing. Use for high-stakes exams, accreditation evidence, approval-first workflows, complex multi-variant assessments, or when the professor explicitly asks for an exam blueprint or design review.
---

# Design an exam

Produce the smallest defensible blueprint. This skill is not a prerequisite for
ordinary question writing; `make-exam` handles that directly.

## 1. Establish the assessment contract

Recover or state:

- purpose and stakes;
- course outcomes or topics;
- cohort and prior learning;
- duration, marks, delivery mode, and permitted resources;
- grading scale and required performance descriptors;
- accommodations and institutional constraints;
- number of variants and integrity risks.

Ask only about a missing constraint that would change the design materially.
Label all other assumptions.

## 2. Define evidence before format

For each outcome, state what observable student work would demonstrate it. Then
choose an item form that elicits that evidence. Topic coverage alone is not
alignment.

Use a compact blueprint table:

| Outcome/topic | Evidence sought | Performance range | Item role | Marks | Minutes |
| --- | --- | --- | --- | ---: | ---: |

Check that weight reflects importance rather than ease of marking.

## 3. Choose an exam composition

Use only as much structure as the evidence needs. Common compositions include:

- coverage grid;
- breadth then depth;
- scaffolded problem;
- evidence interpretation;
- design/build/refine;
- proof or derivation set;
- practical artifact;
- resource-rich investigation.

An exam may combine compositions. Name the choice and explain it in one or two
sentences, not an essay.

## 4. Map performance levels

Describe D/C/B/A or the supplied scale through increasing quality of evidence.
Check that the exam gives students a plausible route to each grade without
making grade levels synonymous with particular topics.

Prefer a common paper spanning the intended range. Use different leveled papers
only when the governing policy calls for them, and then document comparability.

## 5. Specify question families and variants

For every family record:

- invariant evidence and reasoning structure;
- variable slots;
- solution template and rubric;
- expected time and difficulty dimensions;
- acceptable methods, common errors, and follow-through;
- equivalence checks.

Surface changes do not establish equivalence. Each instance must be solved and
checked for the same number of substantive decisions, similar workload, and the
same marking interpretation.

## 6. Add integrity by design

Use an explicit threat model only where relevant: peer copying, collusion,
remote help, unauthorized resources, AI outsourcing, question leakage, or
impersonation.

Prefer competence verification over detector scores. Choose proportionate
controls such as equivalent variants, process evidence, oral spot checks,
personalized stimuli, or controlled resources. State the permitted AI policy.

## 7. Produce and stop at the right boundary

Copy or adapt this skill's packaged `assets/exam-blueprint.yaml`, omitting
question wording unless the user asked for it. Include:

- blueprint and mark/time totals;
- performance-level coverage;
- question-family plan;
- integrity and variant policies;
- validation checklist;
- assumptions and decisions requiring approval.

If approval was requested, stop after the blueprint. Never mark your own design
as approved. Otherwise continue to `make-exam` only when the user requested the
complete exam.

## Rules

- Evidence first, item format second.
- One source of truth for generation and grading.
- Do not invent outcomes, policies, citations, or validation evidence.
- Do not equate difficulty with obscurity, excessive speed, or irrelevant
  reading load.
- Record deliberate omissions; unrecorded omissions look accidental.
- Keep the blueprint compact enough for a professor to review quickly.
