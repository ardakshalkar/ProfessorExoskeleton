---
name: review-course
description: Review a syllabus, curriculum map, course proposal, weekly plan, assessment scheme, or final project for constructive alignment, sequencing, coverage, workload, and DataLayer consistency. Use when a professor asks to audit, critique, validate, compare, or improve an existing course design.
---

# Review a course

Find the few issues that most affect whether students can achieve and
demonstrate the outcomes. Do not redesign the course unless asked.

## 1. Choose the depth

| Depth | Use when | Review |
| --- | --- | --- |
| **SKETCH** | quick critique or one component | the requested question and highest-impact issues |
| **STANDARD** | normal syllabus or complete proposal | full alignment, sequence, assessment, project, and workload checks |
| **ASSURANCE** | accreditation, approval, high stakes, or explicit deep review | traceable evidence table, DataLayer validation, and prioritized repair plan |

An explicit depth wins. Otherwise use SKETCH for a narrow question and STANDARD
for a complete course. ASSURANCE is never automatic merely because more detail
is possible.

## 2. Establish the review basis

State what was reviewed, selected depth, available constraints, and provenance.
Distinguish absent information from a defect. Never infer institutional rules,
student characteristics, or approval status.

When reviewing a DataLayer course tree, read `references/quality-checks.md` and
use the sibling `datalayer.yaml` for schemas, ids, globs, sensitivity, source
resolution, and term selection. Do not load restricted student records.

## 3. Trace the learning chain

For each course outcome, trace:

```text
observable performance
-> evidence
-> concepts and prerequisites
-> modules and practice
-> assessment or project criterion
```

Then trace backward from every assessment and major content block to an
outcome. Report broken links rather than filling them with guesses.

## 4. Run proportional checks

### Outcomes and evidence

- Outcomes describe observable student performance.
- Evidence matches the outcome's cognitive demand.
- Outcome weight reflects course importance.

### Content and sequence

- Every core concept has a reason to exist.
- Must/should/could decisions are credible.
- Concepts are not merely product or vendor names.
- Prerequisites appear before dependent work.
- High-leverage concepts are reinforced and reused.

### Progression and practice

- Important outcomes progress through introduction, reinforcement, mastery, and
  assessment as appropriate.
- The course does not repeatedly introduce without independent performance.
- Students practice before being assessed in the same kind of work.
- Important learning is spaced rather than taught once and abandoned.

### Assessment and project

- Assessment samples outcomes deliberately rather than copying slide topics.
- Exams and projects cover complementary forms of evidence.
- The integrated project genuinely requires several outcomes.
- Project milestones prepare students before the final submission.
- Rubric criteria link to outcomes or capabilities.

### Feasibility

- Weekly and total workload fit known credits and calendar.
- Contact, practice, assessment, feedback, and project time are plausible.
- Optional content is the first material cut when time is tight.

## 5. Report by impact

Use this order:

1. **Blocking** — students are assessed without preparation, required outcomes
   have no evidence, prerequisite order is impossible, or workload cannot fit.
2. **Material** — weak progression, orphan core content, underweighted outcomes,
   or a project that arrives too late.
3. **Refinement** — clearer wording, consolidation, or optional enrichment.

For each finding provide: evidence from the design, why it matters, and the
smallest practical repair. Adapt `assets/alignment-review.md` for STANDARD or
ASSURANCE reviews.

## 6. Stop at the right boundary

Fix files only when the user asked for revision. Otherwise provide the review
without mutating the course. Never mark a proposal approved or claim validation
against students unless that evidence exists.
