---
name: design-course
description: Design or revise a university course, syllabus, course map, learning outcomes, concept graph, weekly modules, assessment plan, or final project at selectable depth. Use when a professor asks to create, decompose, sequence, or substantially redesign a course. Starts from observable performance and produces Professor DataLayer-shaped proposals for complete courses.
---

# Design a course

Build the smallest course design that answers the request. Weeks are derived
from learning, not filled with unrelated topics.

## 1. Choose the depth

| Depth | Use when | Produce |
| --- | --- | --- |
| **SKETCH** | an idea, short course, focused decomposition, or early discussion | concise brief or requested component |
| **STANDARD** | a complete course or substantial redesign | aligned proposal plus DataLayer-shaped course tree |
| **ASSURANCE** | accreditation, programme approval, high stakes, several contributors, or explicit approval-first/deep work | staged design, rationale and full validation |

An explicit `SKETCH`, `STANDARD`, or `ASSURANCE` wins. Otherwise use SKETCH for
a focused answer, STANDARD for a complete course, and ASSURANCE only when the
risk requires it. Never make research or formal approval a hidden prerequisite.

## 2. Ground the design

Use, in order:

1. purpose, outcomes, constraints, materials, and policies supplied by the
   professor;
2. public and internal course-design data in the current project;
3. clearly labelled assumptions.

Do not invent institutional policy, programme outcomes, credit rules, dates, or
approval. Ask only when different answers would materially change the design.
Browse only when the user asks for research or current external rules matter.

## 3. Design backward from performance

Use this chain:

```text
course purpose
-> observable course learning outcomes
-> evidence that would demonstrate each outcome
-> required capabilities, concepts and procedures
-> prerequisites
-> priority and target depth
-> modules and I/R/M/A progression
-> activities, formative checks, assessments and project milestones
```

For every outcome, identify an observable performance, its context, and the
quality criteria. Bloom levels describe cognitive demand; they do not replace
the performance statement.

For every candidate concept, ask: **what breaks if this is removed?** Classify
it:

- **must** — an outcome, assessment, or integrated project cannot be achieved;
- **should** — materially improves transfer or professional competence;
- **could** — useful enrichment and the first material cut when time is tight.

Keep concepts separate from tools and products. Teach semantic retrieval;
demonstrate it with a current library. Record prerequisites explicitly.

Choose a target depth for each concept: `aware`, `understand`, `apply`,
`analyze`, or `master`. High-leverage prerequisites and concepts reused across
later modules deserve more depth than isolated detail.

## 4. SKETCH

Answer directly or adapt `assets/course-brief.md`. Include only what makes the
idea reviewable: purpose, audience, outcomes, core concepts, rough sequence,
assessment evidence, project idea, assumptions, and unresolved decisions.

Do not create a directory tree unless the user asks for files.

## 5. STANDARD

Create a compact course map in memory, then prepare the proposal under:

```text
work/course-design/<COURSE_ID>/
```

Read `references/datalayer-output.md` before writing files. Use the packaged
`assets/course-brief.md` for the human-review entry point.

At minimum, a complete proposal contains:

```text
course-brief.md
course.yaml
outcomes.yaml
concepts.yaml
modules.yaml
```

Add a term version, scheduled activities, assessments, rubrics, resources, or
documents only when the request and known facts support them. Do not create
empty files to make the tree look complete.

Use DataLayer `extensions.course_design` for rationale not represented in the
core schemas:

- outcome evidence and knowledge dimensions;
- concept priority, target depth, supports, required-for links, and rationale;
- module-level `introduced`, `reinforced`, `mastered`, and `assessed` outcome
  lists;
- project milestones or deliberate omissions.

The proposal is not an approved course. Move or rewrite it into
`courses/<COURSE_ID>/` only after explicit professor approval.

## 6. ASSURANCE

Use two reviewable stages:

1. purpose, constraints, outcomes, evidence, and integrated project;
2. concept graph, sequence, modules, activities, and assessment plan.

If approval-first was requested, stop after stage 1 and wait. Never mark your
own proposal approved.

In addition to STANDARD, include:

- rationale for every must/should concept;
- prerequisite graph and high-leverage concepts;
- outcome-by-module I/R/M/A map;
- assessment blueprint showing evidence and cognitive level;
- project milestones distributed across the course;
- workload totals and explicit omissions;
- a completed alignment review using the `review-course` checks.

## 7. Quality gate

Before handoff, verify:

- every outcome is observable and has credible evidence;
- every must concept supports an outcome, assessment, or project requirement;
- prerequisite order is acyclic and teachable;
- important outcomes progress beyond introduction before assessment;
- students practice the kind of performance they will be assessed on;
- exams and projects complement one another;
- the final project is prepared through milestones, not introduced at the end;
- estimated workload fits the known credits and calendar;
- omitted or optional material is visible.

Fix clear defects. Report assumptions, provenance, selected depth, and decisions
that still belong to the professor.

## Rules

- Start from required performance, not a textbook contents page.
- Do not infer that appearing on a slide makes content assessable.
- Do not use product names as the conceptual spine of a course.
- Do not write restricted student data or synthetic records that resemble real
  students.
- Stable ids survive title edits; all references use ids.
- Nothing absent from the source becomes a plausible-looking fact.
