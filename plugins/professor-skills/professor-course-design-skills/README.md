# Professor Course Design Skills

Two standalone skills for creating and reviewing aligned courses.

- `design-course` turns purpose and observable learning outcomes into evidence,
  concepts, prerequisites, modules, activities, assessments, and a project
  spine.
- `review-course` audits an existing design and proposes the smallest useful
  repairs.

Both accept `SKETCH`, `STANDARD`, or `ASSURANCE`. Explicit depth always wins;
otherwise the skill chooses proportionally. The default for a complete course
is `STANDARD`.

## Data boundary

The plugin contributes course-design judgment, not a second data model.
`STANDARD` and `ASSURANCE` output use the sibling Professor DataLayer entity
names, identifiers, YAML layout, and `extensions` mechanism. The schemas remain
in DataLayer and are not bundled here.

Proposals are written under `work/course-design/<COURSE_ID>/`. They move into
`courses/<COURSE_ID>/` only after the professor explicitly approves them.
Restricted student records are never read or written.

There is no CLI, dependency install, hook, database requirement, or mandatory
web research.
