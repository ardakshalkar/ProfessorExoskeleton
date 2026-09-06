---
name: moderate-grading
description: Audit criterion-level evaluations for rubric coverage, score bounds, evidence, confidence, consistency, and valid professor decision stamps. Use for grading moderation, second marking, quality assurance, or reviewing a completed assessment batch.
---

# Moderate grading

Read [the grading contract](../../references/grading-contract.md). Moderation
checks decisions; it does not silently replace them.

Scope the review to the requested assessment and cohort or sample. Run
restricted evaluations through stdin:

```sh
prof-assess check --rubric RUBRIC.json
prof-assess audit --rubric RUBRIC.json --confidence 0.8
```

Examine all structural errors, missing criteria, low-confidence suggestions,
missing evidence, overrides, boundary cases, and unusually large differences
between suggestion and decision. Compare like work under the same criterion;
do not treat score distribution, student identity, or writing fluency as proof
of inconsistency.

Report findings as review items with affected submission/criterion IDs and the
evidence needed to resolve them. Recommend a score change only when the rubric
and submission evidence support it. Preserve the original suggestion and
professor decision; any new official decision must be made and stamped by the
professor.
