# Schemas

Twenty-eight JSON Schemas, one per entity plus the bundle. They are generated
from the pydantic model in ProfessorHarness (`ainar/model/`) and copied here
byte-for-byte:

```bash
# in ProfessorHarness
ainar schema --out ../ProfessorSkills/DataLayer/schema
```

The copies are not edited. A change to the model lands there, is regenerated,
and arrives here; editing a schema by hand produces a contract the model does
not honour, which is the failure this arrangement exists to prevent.

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
