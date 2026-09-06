# Grading contract

## Inputs and scope

Load only the requested assessment, its rubric and answer material, and the
submission or explicitly requested batch. A single-student task must not load a
whole roster. Rubrics and assessment material are internal; submissions,
evaluations, and student evidence are restricted.

Restricted records remain in memory. Do not cache them, copy them into a course
tree, create debug dumps, or write them to a repository. If an identified
student report must be saved, use the professor's private output location.

## Criterion evaluation

For every criterion:

1. State the observable claim about the work.
2. Cite a tight evidence location or short excerpt from the submission.
3. Match that evidence to the rubric descriptor; do not infer unobserved intent.
4. Suggest a bounded score and confidence.
5. Explain uncertainty, missing material, or rubric ambiguity.

Do not assess personality, accent, confidence of delivery, writing style, or
other traits unless the rubric validly and explicitly assesses a related
observable performance. Never use an AI-detector score as evidence of
misconduct or authorship.

## Suggestions and decisions

An `ai_suggestion` is never a grade. Only a professor can create the official
`professor_decision`, stamp `decided_by` and `decided_at`, and move status to
`approved` or `overridden`. Preserve both sides when they differ.

Never aggregate suggested scores into a total shown as a grade. A total may use
only complete, stamped professor decisions. Feedback sent to a student must be
grounded in approved decisions; draft feedback from suggestions must remain
clearly marked for professor review.

## Batch calibration and moderation

Before grading a batch, apply the rubric to a small, diverse calibration sample
and let the professor resolve ambiguous interpretations. Then grade with the
same criterion order and evidence standard. Periodically recheck boundary cases
and review low-confidence, outlier, missing-evidence, and override-heavy cases.

Distribution statistics are prompts for review, not targets. Never curve or
change an individual decision merely to make a distribution look normal.
