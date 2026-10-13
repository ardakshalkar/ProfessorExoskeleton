---
name: ainar-records
description: How a record gets into an AINAR course — every record is written straight into the course file its collection belongs in, with its final identifier, marked `approval: draft` until the professor accepts it; which collections are the professor's own authoring; and what an agent may never write. Use before writing, drafting, approving or editing any YAML in a course workspace, and whenever a draft is refused.
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

Since 2026-09-29 the answer is shorter. There is no drafts folder beside the
course, no `-DRAFT-` marker in an identifier, and no approve command. A draft is
a word in the record. The rule is stated once, in the header of
`ainar-node/src/approval.ts`.

## One path

**Write the record into the course, marked `approval: draft`.** Every
collection an agent may write goes into the file it belongs in, under
`courses/<COURSE>/`, with its real, final identifier. The list is
`AGENT_WRITABLE` in `ainar-node/src/approval.ts`, and where each one lands is
`RECORD_FILES` in `ainar-node/src/records-write.ts`:

    activities         activities/generated.yaml
    documents          documents/generated.yaml
    resources          resources/generated.yaml
    assessments        assessments/<ASSESSMENT_ID>/assessment.yaml
    items              assessments/<ASSESSMENT_ID>/items.yaml
    item_models        assessments/<ASSESSMENT_ID>/src/item-models.yaml
    submissions        records/submissions.yaml
    item_responses     records/item-responses.yaml
    evaluations        records/evaluations.yaml
    evidence           records/evidence.yaml
    concept_states     records/concept-states.yaml
    capability_states  records/capability-states.yaml
    signals            records/signals.yaml
    interventions      records/interventions.yaml
    events             records/events.yaml
    action_items       records/action-items.yaml

```yaml
assessments:
  - assessment_id: ASSESSMENT-HW-02
    course_version_id: CSS-4007-2026-FALL
    title: HW2 — Retrieval over the course corpus
    type: assignment
    weight: 0.04
    module_id: MODULE-04
    approval: draft
```

An assessment is a folder named by its id: the record, its items, its printed
papers at the top, `keys/` for answer keys, `starter/` for a homework's starter
repository, and everything that makes them under `src/`. An item filed in
another assessment's folder is refused (`assessment.folder_mismatch`).
`STORAGE.md` at the repository root has the whole layout.

Material files go straight into `courses/<COURSE>/materials/<MATERIAL>/`, and
their Document points there. Nothing is moved afterwards: the record you wrote
is the record, and accepting it changes one word.

Two collections say it with `status` instead of `approval`:

- **An evaluation** is written `status: suggested`, with the grade in
  `ai_suggestion`. It becomes a decision when a `professor_decision` — score,
  comment, `decided_by`, `decided_at` — is added **beside** the suggestion,
  never over it, and the status becomes `approved` or `overridden`.
  `ainar validate` refuses a decided grade without `decided_by` and
  `decided_at`.
- **An intervention** is written `status: proposed`, and stays that until the
  professor approves it (which needs `approved_by`).

**Writers upsert by id.** Writing a record whose id is already in the course
replaces it rather than adding a second one; a rebuild of the same material
keeps whatever approval it had. A record that already lives in a hand-authored
file is edited there, field by field, so its comments survive. That is also how
a change to an existing record works — a due date, a weight, a title: edit it
where it is and say what you changed.

**The professor's own authoring.** `concepts`, `modules`, `outcomes` are the
professor's description of what the course teaches, and nothing writes them on
anybody's behalf. Edit the YAML in `courses/` only when asked, and say what you
changed.

**Facts, not proposals.** Submissions pulled from Canvas by
`lms import-submissions` are what students handed in. They are written straight
to `records/submissions.yaml` as `SUB-<student>-<assessment>` with no
`approval` field.

**The professor's word on a defence.** Whether a student defended a homework
orally is a field on that submission, `defence: defended | not_defended`
(absent: not held yet, or not asked). When the professor *tells you* in chat —
"STUDENT-3BCIXS defended HW2", "HW4: STUDENT-X did not defend" — record it
with the CLI, never by hand:

```bash
<cli> defence mark <RUN> --assessment <ASSESSMENT_ID> --student <STUDENT_ID> --outcome defended|not_defended|clear --root "<workspace>"
```

The defence can also be checked **against the homework's own rubric**, and
that changes the grade. Per criterion the professor says `confirmed` (the
written mark stands), `partly` (half of it, or the points they name) or
`not_confirmed` (0, or the points they name):

```bash
<cli> defence mark <RUN> --assessment <A> --student <S> --criterion <CRIT>[,<CRIT>…] --outcome confirmed|partly|not_confirmed|clear [--score N] --root "<workspace>"
```

It writes the evaluation's `professor_decision` with `defence:` set and
`decided_via: defence`; the written mark goes into `extensions.history`, and
`clear` restores it. The grade sheet's sync leaves such a mark alone. Name the
criteria from `<cli> rubric <A>`; "partly on the second one, 1 point" is
`--criterion <that id> --outcome partly --score 1`. Read the lines it prints
back to the professor — old mark → new mark per criterion.

A student who **forked and showed the professor** without handing in through
Canvas has no link to defend from. When the professor gives you the fork:

```bash
<cli> defence fork <RUN> --assessment <A> --student <S> --url https://github.com/OWNER/REPO --root "<workspace>"
```

It puts the link on their submission, or files one under the id the grade
sheet uses (so the sheet adopts it). With no hand-in time, a defence clones the
fork as it is now. The pane does the same from *Fork link* / *Add a fork*.

Several students: one command each. Resolve "HW2" to its `ASSESSMENT-…` id
from the run's assessments. Students are named by their `STUDENT-…` code; a
real name is not yours to look up (`roster whois` is private), so if the
professor gives a name, ask for the code — or point them to the Students view
in the pane, where each homework has **Defended / Not defended** buttons that
write the same field. This is recording what the professor said, not deciding:
never set it on your own reading of a defence session or a transcript.

## What the field means

- **No `approval` field is approved.** Anything typed into `courses/` by hand is
  the professor's own, and every course written before the rule still reads the
  way it did. The cost of that default is that a record you forget to mark is
  published as though accepted — so **always write `approval: draft`**.
- **The professor accepts** by changing the word to `approved` (for a grade, by
  adding the `professor_decision`), and **rejects** by deleting the record. The
  change is visible in a diff.
- **Everything student-facing reads accepted records only** — the course page,
  the gradebook, extract-evidence, the roll-up, the LMS push. A draft is in the
  course but nobody downstream sees it. `ainar publish` lists the drafts it left
  out, and refuses a homework or Canvas publication of an assessment still
  marked draft.

## Checking what you wrote

```bash
<cli> validate <COURSE> --root "<workspace>"
<cli> drafts <RUN> --root "<workspace>"
```

`validate` checks drafts in place, with everything else. A refusal is the
record's fault, not the command's: read the field it named. The warning
`approval.depends_on_draft` means an approved record rests on one still marked
draft — an approved assessment whose items or brief are drafts, say — and the
professor should accept the dependency or hold the record back.

`ainar drafts [RUN]` lists what is waiting, per collection, and `ainar inbox`
carries it as `drafts_awaiting_approval` whenever there is any. Say plainly what
you wrote, into which files, and that it is waiting for the professor.

## Who accepts

**Not you.** Never write `approval: approved`, a `professor_decision`, or an
approved status (`approved`, `overridden`, an approved intervention) — not on
your own work, not on anyone's. Accepting is the professor's act, and the only
thing that makes a proposal a record. The one way a decision reaches the
course through you is `defence mark`, when the professor has just told you, in
their own words, what the defence showed — you are typing their decision, not
making one, and you never infer it. An older skill that says to run
`ainar approve` is out of date: the command is gone and only prints a message
saying so.

What is also not yours, and was never yours, is anything that **leaves the
machine** — `lms push`, Canvas, Moodle, Telegram, Supabase — unless the
professor has explicitly told you to send that thing. `ainar publish … --confirm`
publishes only what the professor has already accepted, and only `/publish`
runs it. A record can be undone; a grade in front of a student cannot be
recalled.
