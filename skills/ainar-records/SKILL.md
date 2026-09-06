---
name: ainar-records
description: How a record gets into an AINAR course — which collections are written straight into courses/, which are drafted under work/ and promoted by `ainar approve`, and which changes are neither. Use before writing, drafting, approving or editing any YAML in a course workspace, and whenever a draft is refused.
stage: any
writes: drafts
---

# Getting a record into the course

This is the mechanism, for any course in any workspace. What belongs to one
course — where its CLI lives, what is already recorded, what is still missing —
is in that workspace's own `AGENTS.md`.

It is written down because it once cost twelve minutes: on 2026-09-06 a model
answered "may I write this directly, and if not, how do I draft it" by grepping
this project's own TypeScript seven times and reading six of its files. The
answer had been the same all along.

## Three paths, not two

**Straight into `courses/`.** `concepts`, `modules`, `outcomes`. These are the
professor's own description of what the course teaches. Edit the YAML and say
what you changed.

**Through `work/` and `approve`.** Everything else. The list is `DRAFTABLE` in
`ainar-node/src/drafts.ts` and it is exactly:

    activities        documents         resources         assessments
    items             item_models       submissions       item_responses
    evaluations       evidence          concept_states    capability_states
    signals           interventions     events            action_items

These are the things a student meets, which is why they wait.

**Neither.** Changing a field on a record that already exists — a due date, a
weight, a title. There is no draft that means "set `due_at` on
ASSESSMENT-HW1", because `mergeDrafts` only ever *appends*: a draft carrying an
existing id produces a second record, not an edited one. Edit `courses/`
directly and say what you changed. A course workspace under git makes that
reviewable, which is the property the draft system was protecting.

## Drafting, step by step

**1. Write a file under `work/<COURSE_VERSION_ID>/`.** Any name ending `.yaml`
or `.yml`, at any depth — every one of them is read, so the layout is yours.
The top level is a mapping of collection name to a list of records:

```yaml
assessments:
  - assessment_id: ASSESSMENT-DRAFT-HW-02
    course_version_id: CSS-4007-2026-FALL
    title: HW2 — Retrieval over the course corpus
    type: assignment
    weight: 0.04
    module_id: MODULE-04
```

A file that is a list rather than a mapping is refused with `draft.shape`. A
collection name that is not in the table above is refused with
`approve.not_draftable` — that is the first path, not this one.

**2. Put `-DRAFT-` in every identifier you mint.** `approve` strips it on
promotion. That is what makes a promotion legible in a diff, and the Course
pane badges anything still carrying it as a proposal.

**3. Rehearse.**

```bash
<cli> approve "<workspace>/work/<RUN>" --as <USER-ID> --root "<workspace>" --dry-run
```

It validates the *merged* bundle — record plus drafts — and writes nothing.
A refusal here is the draft's fault, not the command's: read the field it named.

**4. Run it for real** by dropping `--dry-run`. `--only ID,ID` promotes a
subset; `--reject ID,ID` holds one back. Records land in
`versions/<term>/<collection>/generated.yaml`.

Then say plainly what you promoted, out of which directory, and which
identifiers lost their marker.

**5. Delete the draft you just promoted.** A consumed draft left in `work/` is
promoted *again* on the next run, as a second record with a fresh id. This is
the step that gets skipped, and the duplicate it makes is quiet.

## When approve refuses

| what it says | what it means |
|---|---|
| `approve.not_draftable` | The collection is one of the three that go straight into `courses/`. Do not draft it — edit the record. |
| a validation error naming a field | The merged bundle does not pass. Fix the draft. Nothing was written: `approve` validates before it writes. |
| `draft.empty` | No YAML in that directory. Usually the file went somewhere else. |
| `draft.unreadable` | The YAML does not parse. The message carries the parser's own complaint. |

## Who may run it

**You may.** Run `--dry-run` first and report what changed.

Some skills carry a line reading *"Never run `ainar approve`"*. That is an
earlier policy from a host where approval was the one act reserved to a person.
It has been superseded: approval writes to the professor's own disk, where it
can be read, diffed and undone. Nothing about it reaches a student.

What is still not yours, and the reason the distinction exists at all, is
anything that **leaves the machine** — `lms push`, Canvas, Moodle, Telegram,
Supabase. A record can be undone; a grade in front of a student cannot be
recalled.
