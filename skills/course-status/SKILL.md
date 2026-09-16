---
name: course-status
description: Report where every course stands right now by reading both the Supabase database and the AINAR workspace at once — the connection, whether the schema is loaded, each course and run, what is waiting on the professor, and what the database is missing relative to the workspace. Use at the start of a session, when the professor asks how things stand across their courses, whether the database is up to date, whether Supabase is reachable, or what needs them without naming a course. A prioritised inbox for ONE named run is /action-inbox; this is the view across all of them and the only one that reads the database.
stage: orient
requires: []
produces: []
writes: nothing
---

> **Non-negotiables.** This skill reads. It writes nothing anywhere.
>
> - `exo status` is read-only against both stores. `exo db init` and `exo db
>   push` write to the professor's Supabase project and are **not** part of this
>   skill. Never run them because the status suggested them; report the
>   suggestion and let the professor ask.
> - Real students are in this data. Report pseudonyms as pseudonyms.

## What this is for

The first question of a session is *where am I*, and answering it needs both
stores. The workspace is authoritative on what a course says; Supabase is what
the student-facing application can see. They drift, and the drift is invisible
from either one alone.

Run it before asking the professor what they want. The answer is usually already
in the status.

## Do this

`exo status` is a Python command, and **this project does not run Python**. It
has no TypeScript equivalent, because half of what it reports is the Supabase
side and the port covers only the workspace. So the status is assembled from two
commands instead:

```bash
bin/ainar validate
```

```bash
bin/ainar inbox <RUN_ID>
```

The first walks every course in the workspace and prints its error and warning
counts; the second is what is waiting on the professor in one run. Between them
they cover points 2, 3 and 4 below.

**Point 1 is genuinely missing.** Neither command knows whether Supabase is
reachable or whether its schema is loaded. Say that you cannot see the database
rather than reporting it as absent — an unknown and a "no" are different answers,
and the professor can do a full day's work without it either way.

Read them, then tell the professor:

1. **Whether the database is there.** Connected or not, schema loaded or not. If
   Supabase is unreachable the workspace half still works — say so rather than
   reporting a failure, because the professor can do a full day's work without
   the database.
2. **Where each course stands**, named. They teach several; a bare number is
   ambiguous.
3. **What is waiting**, in the report's own order: grades to decide, submissions
   outstanding, open signals, interventions to approve.
4. **What is next to build**, from `Next to build` — the stage, and the skill the
   report names for it.

For the structured form, when you need to compute rather than relay: `bin/ainar
inbox <RUN_ID>` already prints JSON, and `bin/ainar class-progress <RUN_ID>` and
`bin/ainar gradebook <RUN_ID>` are the other two payloads worth reading whole.

There is no `--brief`. When the professor asked about one thing, run `inbox` for
that run alone rather than summarising a workspace-wide report.

`--date YYYY-MM-DD` computes readiness as of another day. Without it each run
clamps today into its own term, so a run starting next month reports its first
week rather than week zero.

## Reading the two sources

| The report says | It means |
| --- | --- |
| `(workspace only)` | Authored, never pushed. The application cannot see it. |
| `(database only)` | In Supabase with nothing authoring it — usually a course whose YAML lives in another workspace. Do not offer to delete it. |
| `NOT YET IN THE DATABASE` | The drift list. Each line is a course or run the professor may want to push. |
| `schema absent` | The project is empty. `exo db init` writes the schema — the professor's call, not yours. |

## What not to do

Do not re-derive the counts from the tools. `action_inbox`, `gradebook` and
`class_progress` read the workspace only, so re-computing a number this report
took from Supabase will produce a different one and neither will be wrong.

Do not treat `unreachable` as a reason to stop. Report it, name the likely cause
the report gives, and carry on with the workspace.

## Then

- One run needs a prioritised, actionable list → `/action-inbox`
- The professor wants to see it rather than read it → `/course-dashboard`
- A stage is unfinished and they want to fill it → the skill `Next to build` names
