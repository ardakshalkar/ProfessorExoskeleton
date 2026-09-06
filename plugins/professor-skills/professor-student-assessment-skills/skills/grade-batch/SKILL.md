---
name: grade-batch
description: Draft rubric-based grading suggestions for an explicitly scoped batch of submissions with calibration and consistency checks. Use when the professor asks to grade a class batch or multiple submissions; never auto-approve, publish, or curve grades.
---

# Grade a batch

Read [the grading contract](../../references/grading-contract.md) before loading
student work.

Confirm the assessment and explicit batch scope. Load only that assessment's
rubric, answer material, and requested submissions. Do not expand a partial
batch to the whole roster. Keep all restricted records in memory.

1. Check that the rubric is usable and every criterion has a maximum score.
2. Select a small, diverse calibration sample without using student identity as
   a quality signal. Apply the rubric criterion by criterion.
3. Ask the professor to resolve material rubric ambiguities before continuing.
4. Grade the remainder in a stable criterion order, citing evidence and recording
   confidence for every suggestion.
5. Recheck boundary cases and run the in-memory JSON through
   `prof-assess audit --rubric RUBRIC.json`.

Return suggestions and an action list for errors, low confidence, missing
evidence, incomplete coverage, and possible consistency problems. Distribution
statistics describe complete professor decisions only; never curve suggestions
or optimize scores toward a desired distribution. Do not approve or publish.
