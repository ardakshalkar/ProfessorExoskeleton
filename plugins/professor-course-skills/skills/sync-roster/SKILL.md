---
name: sync-roster
description: Re-import a run's students from Canvas — read every Canvas course the run is taught in, match each student to the roster already imported, add the ones who are new, and report who could not be placed and who is in the roster but not in Canvas. Use when the professor asks to re-import, sync, refresh or update the students, the class list or the roster, says someone is in Canvas but not on the roster, asks who joined or left, or a scan or a push names a student nobody is enrolled as. The first import of a class from the registrar's file is `bin/ainar roster import FILE.csv`; this is every one after it.
stage: setup
requires: [enrollments]
produces: [enrollments]
writes: courses/<COURSE>/enrollments.yaml, and ~/.ainar/roster (outside the workspace)
---

> **Non-negotiables.**
>
> - **One command does this.** Do not search `ainar-node/`, the plugins or git
>   history for how; it is all below.
> - **Never read `~/.ainar/roster/`, `connections.json` or the credentials
>   file.** The command reads them. What it prints is pseudonyms, Canvas user
>   ids and counts, and that is all you need and all you report.
> - **Dry run first, every time**, and show the professor its summary before the
>   real run. The real run writes the roster outside your sandbox, so it asks
>   for approval — that is expected, not a failure to work around.
> - **Nobody is marked dropped** unless the professor asks for `--drop-absent`
>   in this turn.

## Do this

```bash
bin/ainar roster sync --run <RUN> --dry-run
```

Read the summary and tell the professor, in this order:

1. **The counts per Canvas course** — the first lines.
2. **How they matched** — `matched N by recorded link, N by id, N by name, N by
   a close spelling; N new`. After the first sync nearly everyone is `recorded
   link`; that is the healthy state.
3. **`check` lines** — a close spelling: the matcher is fairly sure, not
   certain. Give the Canvas user id and the pseudonym, and suggest
   `bin/ainar roster whois STUDENT-…` *in their own terminal* to confirm.
4. **`left out` lines** — a student who fits two people, or who is the same
   person as another Canvas user (one student in two shells). These are NOT
   added. Each is settled by the professor with `--link`.
5. **`newly enrolled`** — who will be added.
6. **`absent, left active`** — on the roster, not in any Canvas course read.
   Usually a student who has not been added to Canvas yet, or has left. Name
   the count and leave them; dropping is the professor's call.

Then, when the professor says go:

```bash
bin/ainar roster sync --run <RUN>
```

and report the two `wrote` lines. The command validates the course afterwards;
an error there is worth reading out whole.

## The flags

| Flag | When |
| --- | --- |
| `--group G` | Only one subgroup's Canvas course. Absence is then judged only within G. |
| `--link CANVAS_ID=STUDENT-X` | The professor has said who a `left out` or `check` student is. Repeat it for several. The link is kept, so it is said once. |
| `--drop-absent` | Only when the professor asks for it in this turn: marks `absent` students `status: dropped`. Nothing is ever deleted. |
| `--connection NAME` | A second Canvas. Normally the registry's default is right. |

## When it refuses

- **`no Canvas token`** — the professor saves one in the Course pane's
  connections, or exports the variable it names. Never ask them to paste it in
  chat.
- **`has no Canvas course recorded`** — the run needs
  `extensions.lms.canvas_course_id`, or `canvas_courses` for a course per
  subgroup. That is a record edit, as a draft, through `/ainar-records`.
- **A 401/403** — the token belongs to someone who cannot see the course's
  People page.

## Then

- A scan paper that named nobody → re-run `scans apply` for that assessment.
- The pane's Students tab reloads by itself; nothing else needs refreshing.
