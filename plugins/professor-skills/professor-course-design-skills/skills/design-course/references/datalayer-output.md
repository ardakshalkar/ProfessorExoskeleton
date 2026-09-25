# DataLayer output contract

Use the sibling Professor DataLayer as the authority. Locate `datalayer.yaml`,
pin its supported major `format_version`, and read entity schemas and YAML globs
from it. Do not copy schemas into this plugin.

## Read boundary

Course design may read only the records it needs: course, learning outcomes,
concepts, concept edges, capabilities, modules, the selected course version,
activities, resources, assessments, rubrics, items, item models, documents, and
resolved settings. Never load enrollments, submissions, evaluations, evidence,
student states, signals, or interventions for course creation.

When an existing course is resolved, follow DataLayer source and provenance
rules. Never guess among several terms.

## Proposal layout

Write unapproved work under:

```text
work/course-design/<COURSE_ID>/
  course-brief.md
  course.yaml
  outcomes.yaml
  concepts.yaml
  concept-edges.yaml             only when non-prerequisite edges are needed
  capabilities.yaml              only when programme capabilities are supplied
  modules.yaml
  
    version.yaml                 only when real term dates are known
    activities.yaml              only when scheduled events are requested
    assessments.yaml             only when assessment records are requested
    rubrics.yaml                 only when separate reusable rubrics are needed
    resources.yaml               only when resources are known
    documents.yaml               only when files are created or supplied
```

Use the collection wrapper form (`outcomes:`, `concepts:`, `modules:`) for
files people will edit frequently. Do not create empty collections.

## Course-design rationale in `extensions`

DataLayer schemas permit faculty-specific fields only through `extensions`.
Store design rationale there, for example:

```yaml
concepts:
  - concept_id: CONCEPT-RETRIEVAL-EVALUATION
    course_id: AI-4008
    title: Retrieval evaluation
    prerequisites: [CONCEPT-RELEVANCE]
    extensions:
      course_design:
        priority: must
        target_depth: master
        supports: [LO-03, LO-04]
        required_for: [ASSESSMENT-FINAL-PROJECT, ASSESSMENT-FINAL-EXAM]
        rationale: >-
          Students must distinguish retrieval failure from generation failure.
```

For module progression:

```yaml
extensions:
  course_design:
    introduced: [LO-01]
    reinforced: [LO-02]
    mastered: []
    assessed: []
```

Core semantic references still use the schema's normal fields. Never hide an
outcome link in `extensions` when an `outcomes` field exists.

## Approval boundary

A proposal under `work/` is not a course entity and must be labelled as such.
Learning outcomes and capabilities are written to the canonical course tree
only after explicit professor approval. Do not invent approval metadata.
