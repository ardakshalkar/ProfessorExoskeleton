# Activity package contract

Read this reference for STANDARD and ASSURANCE work.

## Depth

| Depth | Produce |
| --- | --- |
| **SKETCH** | Only the requested fragment or concise brief |
| **STANDARD** | Student artifact, professor guide, and a DataLayer-shaped activity proposal when required identifiers are known |
| **ASSURANCE** | STANDARD plus explicit, relevant validation and any requested approval gate |

An explicit depth wins. Otherwise use SKETCH for focused work, STANDARD for a
complete activity, and ASSURANCE only for high-stakes, safety-critical,
multi-variant, formal-review, or explicit deep work. Depth changes design and
validation effort, not student workload or difficulty.

## Grounding

Use, in order:

1. the professor's request, supplied materials, policies, and constraints;
2. the resolved course version, module, outcomes, concepts, activities, and
   resources from Professor DataLayer;
3. clearly labelled assumptions.

When DataLayer is present, locate the workspace through `PROFESSOR_WORKSPACE`
or by walking upward for `courses/` beside `datalayer.yaml`. Read the registry,
pin its supported major `format_version`, resolve sources in registry order,
never guess among terms, and report provenance.

Load only the public and internal course-design entities needed for the task.
Never load enrollments, submissions, evaluations, evidence, student states,
signals, or interventions.

## Design chain

```text
learning outcome -> observable evidence -> activity structure
-> scaffolding and autonomy -> feedback or assessment
-> student artifact + professor guide
```

A variant changes surface context while preserving evidence, workload,
cognitive demand, and scoring. A level changes performance demand. Do not
confuse them. For summative work, prefer a common core with progressively
challenging sections unless policy permits different standards.

## Output

At SKETCH depth, answer directly and create no directory unless asked. At
STANDARD or ASSURANCE depth, write under:

```text
work/assignments/<COURSE_ID>/<TERM>/<ACTIVITY_ID>/
  student.md
  professor.md
  activity.yaml
```

Omit unknown path segments rather than inventing them. Emit `activity.yaml`
only when `activity_id` and `course_version_id` are known. Otherwise produce
the human artifacts and state which identifier is unresolved. Never guess a
term when several course versions exist.

Map the proposal to DataLayer's `LearningActivity` schema. Use its normal
`outcomes`, `concepts`, `resources`, `preparation`, and duration fields.
Put plugin-specific metadata under `extensions.assignment`. Keep stable IDs and
do not move a proposal into the canonical course tree without explicit approval.

At ASSURANCE depth, validate alignment and workload plus only the relevant
accessibility, integrity, safety, and variant-equivalence concerns. If the
professor requested approval first, stop at the design. Never approve it on
their behalf.

## Quality gate

- Every task elicits evidence for a named outcome or stated aim.
- Workload fits the known time.
- Instructions, deliverables, permitted resources, AI policy, and feedback are
  clear where relevant.
- The student artifact contains no key or private teaching notes.
- The professor guide contains expected evidence, misconceptions, timing,
  interventions, and evaluation guidance appropriate to the activity.
- Course facts, citations, policies, and safety claims are never invented.
- Assumptions and deliberate omissions are visible.

