# Course design quality checks

Run only checks supported by the available design. Missing evidence is
`unknown`, not automatically `failed`.

## Alignment checks

- Every outcome has at least one credible evidence source.
- Every summative assessment maps to one or more outcomes.
- Assessment demand meets, rather than falls below, the outcome verb.
- Every rubric criterion maps to an outcome or programme capability.
- Core content supports an outcome, assessment, project, or prerequisite.

## Sequence checks

- The concept prerequisite graph has no cycle.
- A dependent concept is not expected before its prerequisites.
- An outcome is not assessed before relevant instruction and practice.
- Important outcomes include reinforcement or independent application before
  summative assessment.
- Long gaps between introduction and reuse are surfaced.

## Content checks

- Must/should/could classification matches actual dependencies.
- Target depth matches required performance.
- Tool-specific content is an example, not the conceptual spine.
- Common misconceptions are addressed where they threaten later performance.
- Optional enrichment is visibly optional.

## Project checks

- The final project integrates multiple outcomes.
- Project requirements are taught or explicitly listed as prerequisites.
- Milestones distribute proposal, prototype, evaluation, feedback, and final
  performance across the course.
- The rubric rewards course outcomes rather than presentation polish alone.

## Workload checks

- Known credit-to-workload rules are cited rather than guessed.
- Weekly workload includes contact, preparation, practice, assessment, and
  project work.
- Assessment deadlines and project milestones do not create avoidable spikes.

## DataLayer checks

- Files follow globs declared in `datalayer.yaml`.
- Entity ids match schema patterns and references resolve.
- Duplicate ids are errors, never last-one-wins merges.
- A course with several terms has an explicitly selected version.
- Additional rationale appears under `extensions`, not as unknown core fields.
- Proposals remain under `work/course-design/` until explicit approval.
- Restricted student data never appears in the course tree or review output.
