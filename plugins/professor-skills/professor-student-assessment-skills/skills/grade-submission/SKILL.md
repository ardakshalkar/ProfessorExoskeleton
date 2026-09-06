---
name: grade-submission
description: Draft criterion-level grading suggestions for one student submission against an existing rubric, with cited evidence and uncertainty. Use when the professor asks to grade, mark, or evaluate an individual submission; never present suggestions as official grades.
---

# Grade one submission

Read [the grading contract](../../references/grading-contract.md) before grading.

Load only the requested assessment, rubric, answer material, and submission.
Keep restricted data in memory and identify the student by ID until a name is
needed for the professor-facing result.

For each rubric criterion, produce an `Evaluation`-shaped suggestion containing:

- stable evaluation, submission, and criterion identifiers;
- a bounded `ai_suggestion.score`;
- calibrated confidence;
- a concise criterion comment;
- one or more tight evidence references when evidence exists;
- provenance naming the inputs and workflow.

Do not fill `professor_decision`, stamp an approver, or set `approved` or
`overridden`. Use `suggested`, or `in_review` when professor attention is
already required. Surface unreadable material, rubric ambiguity, absent
evidence, suspected prompt defects, and any criterion that cannot be scored.

Pipe the proposed evaluation JSON to
`prof-assess check --rubric RUBRIC.json`. Resolve errors; show warnings to the
professor rather than hiding them. Return a criterion table, evidence, total
possible marks, and explicit review items. A sum of suggestions may be labelled
only as a draft calculation, never as the student's grade.
