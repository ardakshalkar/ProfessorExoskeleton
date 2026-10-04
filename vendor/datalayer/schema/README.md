# Schemas

Twenty-eight JSON Schemas, one per entity plus the bundle. They are **generated**,
not authored: `python -m ainar schema` wrote them from the pydantic model in
ProfessorHarness, and they were copied here byte-for-byte.

**Nothing in this repository regenerates them today, and the reason is worth
knowing before you try.** `bin/ainar schema --out <dir>` exists and writes JSON
Schema from the zod model in `ainar-node/src/model/` — the same model in the
language this project runs — but it names its files after *collections*
(`items.schema.json`) where these are named after *entities*
(`assessment_item.schema.json`), it does not emit the `course-bundle` envelope,
and it has no `preference_profile` because `ainar/preferences.py` was not part
of the port. Pointing it at this directory would leave twenty-six new files
beside the twenty-eight already here rather than replacing them.

So: do not edit one by hand, and do not regenerate them with the command that
looks like it would. A change belongs in `ainar-node/src/model/`; closing the
gap means teaching `src/schema.ts` the entity names and the envelope, which is
about an afternoon and has not been done.

**Carried forward since, from the zod model rather than by hand-writing them:**

- **2026-10-03 — the grading scheme.** `CourseVersion.grading_scheme`
  (`GradingScheme`, a list of `GradingComponent`s: id, title, weight in the
  whole grade, optional `parent`) and `Assessment.component`. The JSON was taken
  from what `bin/ainar schema` emits for those fields, restyled to these files'
  conventions, and inserted into `course_version`, `assessment` and the bundle;
  nothing else in those files changed. It is how an institution's own division
  of the final grade — Narxoz's ВСК1 30 / ВСК2 30 / Final 40, a category split,
  terms within a year — is stated once and read by the gradebook, `validate` and
  the Canvas sync.
- **2026-10-04 — the LMS scale.** `points` on `GradingScheme` and on
  `GradingComponent`: what the course, or a block, is out of in the LMS. ВСК1
  with `points: 100` puts a quiz worth 6% of the course inside its 30% out of 20
  in Canvas; a scheme with `points: 100` puts every assessment out of its share
  of a hundred. Marks stay recorded out of `maximum_score`; only what is sent
  and the gradebook's block totals are converted. `components` may now be empty,
  so a course with no blocks can still say it is out of 100.

## Conventions

**`additionalProperties: false`.** A misspelled field is an error, not a field
that silently does nothing. The escape hatch is `extensions`, an open object on
every entity, for faculty-specific fields the core model deliberately does not
grow.

**Optional fields are `anyOf: [<type>, null]` with `default: null`,** which is
what pydantic emits for `X | None`. A consumer should treat explicit `null` and
absent as the same thing: not stated.

**Identifier patterns are inline,** anchored, and repeated wherever the id
appears. `^LO-[0-9]{2,3}$` on the outcome and on every reference to one, so a
typo is caught at the reference as well as at the definition.

**No `$id` and no cross-file `$ref`.** Each file stands alone, and
`course-bundle.schema.json` inlines every definition under `$defs`. That makes
the bundle the one file to hand to a validator that cannot resolve remote
references — which is most of them, in most CI setups.

## What is where

| file | validates |
| --- | --- |
| `course-bundle.schema.json` | the whole normalised course, and every entity under `$defs` |
| `<entity>.schema.json` | one entity, in the single-entity YAML form |
| `preference_profile.schema.json` | one settings layer — see [../docs/settings.md](../docs/settings.md) |

Two notes on the edges:

- **`StudentCapabilityState` has no standalone file.** Its definition lives in
  `course-bundle.schema.json#/$defs/StudentCapabilityState`, and
  `datalayer.yaml` points there.
- **`course_run.schema.json` is legacy.** A run and a version were two records
  once; they are one now, and `course_version.schema.json` is the live one. The
  file is kept only so that an older export still validates.

## Validating

One entity:

```bash
check-jsonschema --schemafile schema/course.schema.json courses/CSS-4008/course.yaml
```

A whole course, after loading — the check worth running in CI, because it is the
only one that sees the cross-references:

```bash
check-jsonschema --schemafile schema/course-bundle.schema.json build/CSS-4008.bundle.json
```

A list-form or wrapper-form YAML file holds many entities; validate each entry
against the entity schema, or let a loader assemble the bundle and validate that.
