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
- **2026-10-09 — syncs.** `CourseVersion.syncs`, a list of `Sync`: every road
  between a run and a service outside it (Canvas, Google Sheets, Telegram,
  GitHub), in one vocabulary — `role` (source / target / both), `stream`,
  `match` (link, code, key:…, name, name:one-word, tried in order), `unsure`
  (hold / ask), `write`, `remove`, `conflict`, `map`, `anchors`. Optional:
  a run without it is unchanged. Inserted as text into `course_version` and the
  bundle — the definitions in sorted position, `syncs` last among the run's
  properties — so no existing byte moved; a parse-and-dump round trip would
  have turned every `1.0` into `1`. Which student a row is never appears here:
  links are private, in `~/.ainar/links/`.
- **2026-10-15 — the policy lock.** `locked` on `GradingScheme`: the professor
  froze the division of the grade, and writers of components, weights or
  `Assessment.component` refuse until it is unlocked. Each change to the
  scheme, the lock included, keeps the state it replaced in the scheme's
  `extensions.history` — the same convention as an evaluation's — so no new
  property was needed for the log. Inserted as text after `description`.
- **2026-10-22 — the curve.** `Assessment.curve` (`ScoreCurve`: `kind: power`,
  `anchor`, `exponent`, who decided it and when). Each student's total `t`
  becomes `maximum_score × (t / anchor) ^ exponent`, capped at the maximum. The
  criterion decisions are not edited and stay the evidence; the gradebook
  applies the curve after totalling, and every score downstream of it (block
  totals, Canvas, sheets) is the curved one. `anchor` above `maximum_score` or
  `exponent` above 1 would lower a mark and is refused. Inserted as text: the
  definition in sorted position, `curve` after `design`, in `assessment` and
  the bundle.
- **2026-10-22 — students a curve passes over.** `ScoreCurve.exclude`, a list
  of student ids whose total counts as marked — an integrity case, a retake
  marked on its own terms — with the reason in `note`. Inserted as text after
  `exponent`, in `assessment` and the bundle.
- **2026-10-22 — integrity cases.** A new entity, `integrity_case`
  (`IntegrityCase`: one student, the assessments it concerns, `state` open /
  cleared / upheld, an `outcome` — no_penalty, adjusted, zero, voided — set
  only when upheld, who opened and decided it and when, a private `note`).
  Opened and decided by the professor alone; read by the gradebook, which
  holds an open case's mark, zeroes or voids an upheld one, and keeps any case
  not cleared off the curve. Its own file was written from the zod model by a
  one-off script; in the bundle the three definitions were inserted as text
  before `Intervention` and `integrity_cases` after `interventions`. A bundle
  payload leaves `integrity_cases` out when it is empty, so a course without a
  case serialises exactly as before.
- **2026-10-23 — Canvas presence.** `Enrollment.lms` (`LmsPresence`:
  `in_course`, `since`, `note`): what the last `roster sync` found in the LMS
  course. A student Canvas no longer lists is noted `in_course: false` on the
  day it is first seen, and stays active unless the professor drops them; one
  who comes back is noted `in_course: true` with the day. Optional: an
  enrollment no sync has seen missing is unchanged. Inserted as text — the
  definition before `Module` in the bundle and after `EnrollmentStatus` in
  `enrollment`, `lms` after `group` in both. The SQL table has no column for
  it; `sqlgen` carries it in `extensions.lms`.

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
