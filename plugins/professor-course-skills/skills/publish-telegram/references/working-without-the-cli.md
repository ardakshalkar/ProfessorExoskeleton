# Working without the CLI

Every skill here works when the `ainar` package is installed. Most of them also
work without it — you keep the same files in the same layout, and a model reads
them directly instead of asking a command.

What you lose is not memory. It is **checking and arithmetic**. This file says
exactly what that costs and how to work anyway.

## 1. The files go in the same place, always

This matters more than anything else here. Whatever you write without the CLI
must be exactly what the CLI would later expect, so that installing it is an
upgrade rather than a migration.

Pick a folder — anywhere; `~/courses/` is fine — and inside it:

```
<COURSE_ID>/                        e.g. CSS-4008
  course.yaml                       identity: id, title, credits, department
  people/users.yaml                 staff only, never students
  outcomes.yaml                     what a student must demonstrate
  concepts.yaml                     knowledge structure + prerequisites
  modules.yaml                      teaching weeks
  version.yaml                      the one semester this workspace holds
  activities.yaml                   lectures, labs, seminars
  resources.yaml                    teaching material metadata
  enrollments.yaml                  pseudonyms only
  assessments/*.yaml                assessments with inline rubrics
  items/*.yaml                      concept-tagged questions
  materials/*.md                    slides, handouts
  records/*.yaml                    the actual semester
homework/<slug>/                    starter repositories students fork
imports/<label>/                    material brought in from outside
work/<RUN_ID>/                      drafts — proposals, not content
archive/<TERM>/                     offerings that have finished
```

Outcomes, concepts and modules sit at the **course** root and carry `course_id`,
not `course_version_id`: an outcome outlives the term that first taught it, and
student evidence from an earlier semester points at `LO-01`. One offering is one
`version.yaml` beside `course.yaml` — there is no separate version record, no
`runs/` directory and no term directory, because a workspace holds one run of
one course. A finished offering moves to `archive/<TERM>/` at the workspace
root. See `docs/version-run-merge.md`.

Identifiers are permanent and follow fixed patterns:

| Kind | Pattern | Example |
| --- | --- | --- |
| Course | `AAA-9999` | `CSS-4008` |
| Course offering | `<course>-<YYYY>-<TERM>` | `CSS-4008-2026-FALL` |
| Outcome | `LO-nn` | `LO-04` |
| Concept | `CONCEPT-SLUG` | `CONCEPT-OVERFITTING` |
| Module | `MODULE-nn` | `MODULE-06` |
| Assessment / Rubric / Criterion | `ASSESSMENT-…` / `RUBRIC-…` / `CRIT-…` | `CRIT-04-01` |
| Staff / Student | `USER-…` / `STUDENT-…` | `USER-ARD-A01` |

Terms are `FALL`, `SPRING`, `SUMMER`, `WINTER`. Timestamps are timezone-aware —
`2026-10-15T23:59:00+05:00`, never naive. Any YAML file may hold one entity, a
bare list, or a mapping keyed by the collection name (`outcomes:`, `modules:`).

**Never write a student's name, email or institutional number into any of these
files** — not in a grading comment, not in a signal description, not in a source
citation. Write the identifier.

## 2. What to read instead of which command

| Instead of | Read |
| --- | --- |
| `ainar context <RUN>` | `course.yaml`, the version's `outcomes/concepts/modules`, and the run's `run/activities/resources` |
| `ainar rubric <ASSESSMENT>` | `assessments/*.yaml` — the rubric is inline — plus any `items/*.yaml` naming that assessment |
| `ainar stats` | count the entries |
| `ainar student <ID>` | `records/*.yaml` and `samples/*.yaml`, filtered to that identifier |
| `ainar inbox <RUN>` | assessment due dates in `assessments/`, plus whatever is missing from `records/` |
| `ainar blueprint <RUN>` | `outcomes.yaml` for declared weights, `assessments/` for what exists, `concepts.yaml` for what is taught |

Read the **whole** file, not a grep. These files reference each other by
identifier, and half of what a command gives you is the resolution of those
references.

## 3. What you may compute, and what you must not

Some of what the CLI does is judgement a model does well. Some of it is
arithmetic over many rows, where a model quietly miscounts and nothing looks
wrong. The difference matters more here than anywhere else in these skills.

**You may work out by reading:**

- which outcome an assessment claims to measure
- which concepts a module introduces, and what they depend on
- what a student's submission does and does not show against a criterion
- which distractor a class converged on, when the responses are in front of you
  and you count them one by one and state the count

**You must not compute by hand, ever:**

| Not this | Because |
| --- | --- |
| A student's total for an assessment | `ainar gradebook` refuses four ways — only decisions count, a blank is not a zero, nothing is rescaled, only the professor's comment travels. A total computed by hand has none of those refusals. |
| Choice items scored against an answer key | `ainar score-items` is a comparison, done identically 810 times. A model doing it introduces error and adds nothing. |
| Evidence derived from decisions | `ainar extract-evidence` is deterministic. Faking it puts invented evidence under a real capability map. |
| Capability states | `ainar roll-up` reads evidence. Without evidence there is nothing to roll up. |
| Agreement between suggestions and decisions | `ainar calibration` compares recorded pairs. Estimating it defeats the purpose of recording them. |

When a skill needs one of these, say so and stop. The sentence to use:

> This needs `ainar <command>`, which does arithmetic I should not do by hand —
> a total I work out myself would not carry the refusals that make it safe to
> show a student. Install the package, or work this part out yourself.

That is not a failure of the skill. Producing a number that looks official and
was guessed at is the failure.

## 4. Checking what you can, by reading

`ainar validate` runs about forty checks. Reading catches maybe eight of them,
and these eight are worth doing every time — they are the ones that go wrong
most often when content is written by hand:

| Check | What it looks like | Its real code |
| --- | --- | --- |
| An identifier referenced but never defined | a module lists `LO-07`; `outcomes.yaml` stops at `LO-06` | `ref.*` |
| The same identifier defined twice | two `CRIT-04-01` in different files | `id.duplicate` |
| Two concepts naming one idea | "Holdout" and "Train-test separation" | `concept.duplicate_name` |
| A prerequisite cycle | A needs B, B needs A. Trace them; the graphs are small | `graph.cycle` |
| A concept that is its own prerequisite | a copy-paste slip | `graph.self_loop` |
| Assessment weights not summing to 1.0 | add them up and say the total | `weight.sum` |
| A rubric criterion with no `outcome_id` | produces marks but no evidence | `criterion.no_outcome` |
| A naive timestamp | `2026-10-15T23:59:00` with no `+05:00` | `time.naive` |

Report what you checked **and what you could not**. Say it plainly:

> I checked references, duplicate identifiers and the prerequisite graph by
> reading. I did not check score bands against rubric maximums, item totals
> against criteria, coverage, or storage keys — `ainar validate` does about
> forty checks and reading catches eight.

Never say "validated". You did not validate; you read.

## 5. Approval, with no `ainar approve`

The gate does not disappear. It becomes manual, which is slower and exactly as
binding.

An agent writes drafts to `work/<RUN_ID>/`, with `-DRAFT-` in every identifier.
To approve, **you**:

1. Read the draft and edit anything you disagree with.
2. Remove the `-DRAFT-` segment from each identifier you are keeping —
   `CONCEPT-DRAFT-OVERFITTING` becomes `CONCEPT-OVERFITTING` — and fix every
   reference to it in the same batch.
3. Move the entries into the right file under `courses/`.
4. Delete the draft.

For anything with a suggestion in it, add your decision **beside** the
suggestion, never over it:

```yaml
ai_suggestion:
  score: 15
  confidence: 0.71
  comment: Method is appropriate, justification thin.
professor_decision:
  score: 25
  comment: The split is defined in cell 4 of the notebook.
  decided_by: USER-ARD-A01
  decided_at: 2026-10-19T14:10:00+05:00
status: overridden
```

`approved` when you accept the suggested score, `overridden` when you change it.
With the CLI those last three fields are stamped for you; here you write them.

Keeping both halves is what later makes `ainar calibration` able to tell you
where the agent drifts — so it is worth the typing even before the package
exists.

**An agent never does any of this.** It writes the draft and stops.

## 6. When the package arrives

Point it at the folder and run:

```bash
bin/ainar validate
```

It will find things. That is the checker doing its job on content nobody had a
checker for — not a verdict on the work. Fix the errors it names; read the
warnings, since a warning is usually a real gap in the course design rather
than a formatting complaint.

Then the parts that were unavailable become available with no migration:
`ainar score-items`, `ainar gradebook`, `ainar extract-evidence`, `ainar
roll-up`, `ainar dashboard`, `ainar calibration`.
