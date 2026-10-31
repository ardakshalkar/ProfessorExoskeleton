# What the pane writes, and what keeps two writers apart

[`BACKLOG.md` JOB-1](../BACKLOG.md#e34--long-work-in-the-background-and-queued-and-pages-that-open-at-once--no-futuremd-section-yet).
Every pane action that writes the private folder or a run's records, what it
rewrites, what keeps a second writer out today, and which pairs really
conflict. It decides JOB-2's lock keys. Written 2026-10-30 from the code at
`2565661`; when the code and this page disagree, the code is right and this
page is stale.

`P` is `plugins/dsh-professor-pane`. `SUB` is the private submissions folder,
`~/.ainar/submissions` unless `AINAR_SUBMISSIONS_DIR` says otherwise
(`ainar-node/src/scans.ts:58`). `C` is a course id and `courses/C/records/` is
**per course, shared by all its runs** (`records-write.ts:48-58`). A "spawn" is
`runScans` or `execFile` in `P/server/actions.js`: a child `ainar` that loads
the whole course before it starts, so even a quick one is seconds.

---

## The short answer

1. **The server holds one lock**: the per-run `lms check`, where a second
   request joins the first (`P/server/actions.js:358`). Everything else is
   guarded in the browser, per component, per window — or not at all.
2. **The real conflicts are over files, not actions.** Most of them are on
   whole-file read-modify-write stores that many actions share:
   `records/*.yaml`, a run's sync ledger, `version.yaml`, an assessment's
   record. A lock per *action* ("Reading is running") is the wrong grain; a
   lock per *file a job writes* is the right one, and a job takes all of its
   keys at once.
3. **The long jobs are mostly private and narrow.** `scans read` spends its
   30 minutes writing only inside one pile's folders; the run-wide records
   file is touched for a second at the end (`scans record`). Split the job
   in two and the long half blocks almost nothing.
4. **Three things are not the pane's to lock.** The assistant session runs
   the same `ainar` and writes the same files; a second harness or a
   terminal does too. Server locks make the pane honest with itself; only a
   lock in the write helpers would cover the session (see *Open questions*).

---

## The stores

Where conflicts actually happen. "RMW" is read-modify-write of the whole
file: two writers that overlap lose the first one's change.

| Store | Path | Written by | How | Window |
|---|---|---|---|---|
| Scan pile | `SUB/RUN/A/_inbox/plan.yaml`, `SUB/RUN/A/STUDENT-*/` (`scan.pdf`, `transcript.yaml`, `reading.json`), `SUB/RUN/A/_inbox/_render/` | scans apply, assign, read | plan: RMW (`scans.ts:249`); folders moved aside with `renameSync` (`scans.ts:962`); transcript RMW per student (`scan-read.ts:397`) | read: up to 30 min, target list fixed at start (`scan-read.ts:463`) |
| Recordings inbox | `SUB/RUN/_recordings/plan.yaml` — **one per run, naming one assessment** | defence batch plan, apply | RMW (`recordings.ts:195`); apply renames files to `done/` | seconds |
| Defence session | `SUB/RUN/A/STUDENT/defence/session.yaml`, `answers/` | desk (answer, consent, voices, split, override), batch apply, batch transcribe | RMW (`defence.ts:614`, `setTranscript` `:685`) | read-to-write is synchronous: milliseconds |
| Course records | `courses/C/records/{submissions,item-responses,evaluations,evidence,integrity}.yaml` | scans apply/assign/record, grade decide, defence mark, sheet sync run, integrity | RMW of the collection (`upsertRecords` `records-write.ts:290`, `removeRecords` `:330`); built from the bundle the CLI loaded at start | seconds (CLI start to write) |
| Assessment record | `courses/C/assessments/A/assessment.yaml` or a hand-written file | canvas link/create, close, missing-work, setting, dates, record, grading apply, curve, rubric choose/accept/points-only, publish canvas | RMW through `editRecords` (`record-edit.ts:113`) or `setRecordFields` (`:258`) | in-process: instant; spawned: seconds |
| Run record | `courses/C/versions/TERM/version.yaml` | canvas course-map, selection, grading apply/lock/discard, integrations setup (sheets), syncs migrate/map; the session's `grading propose` | RMW (`run-record.js:41` → `editRecords`) | instant, except when spawned |
| Sync ledger | `~/.ainar/sync/RUN.json` | every Canvas and sheet command: lms check, plan, push, assignment-push, keep, publish, sync plan/run/map | **loaded at command start, saved whole at the end, network in between** (`ledger.ts:232`, `:414`) | seconds to minutes — the widest |
| Link table | `~/.ainar/links/RUN.json` | sync confirm, plan, run; roads | loaded at start, saved at end (`sync/links.ts:107`, `:196`) | seconds |
| Roster store | `~/.ainar/roster/`, `versions/TERM/enrollments.yaml` | roster sync (from roads send), sheet run | load/save (`roster.ts:208`, `:217`) | seconds |
| Grading groups | `SUB/RUN/A/groups.yaml` | grade move, choose; the session's `/grade-batch` | RMW (`grade-board.ts:123`) | seconds |
| Reports | `~/.ainar/reports/RUN/A/` (PDFs, `report.json`, `sent.json`) | reports make (replaces PDFs), reports send (reads them, RMW `sent.json` per student) | rm + rename; RMW | make: ~1 min per 60 students; send: minutes |
| Connections | `~/.ainar/connections.json`, credential store | integrations setup, Google callback/disconnect | RMW (`connections/index.ts:552`) | seconds |
| Pane state | `~/.ainar/pane/RUN.json`, `SUB/RUN/*/uploads.json` | snooze, upload | RMW, snooze via tmp + rename | instant |

Only snooze, the upload's `.part` rename and the sheet copy use tmp + rename.
Nothing else is atomic on disk, so a crash mid-write can also truncate.

---

## Every write, and its guard today

Grouped by what it touches. **Guard** is what stops a second press today:
*client* means a React flag in one component of one window — gone on
navigation, on reload, and invisible to a second tab.

### Long (minutes) — the jobs E34 is for

| Action | Endpoint → command | Rewrites | Guard today |
|---|---|---|---|
| Read and record a pile | `POST /api/scans/read` → `scans read` (30 min timeout) then `scans record` (`P/server/routes/scans.js:64`) | read: pile folders, `_render/`; record: `records/item-responses.yaml` | client `busy` in the Scans view (`P/client/scans.js:27`), which also waits for the placements line |
| Transcribe recorded defences | `POST /api/defence/batch?step=transcribe&confirm=1` → `defence batch transcribe` (30 min) | each filed student's `session.yaml` | client `busy` in the dialog, which cannot be closed (`P/client/upload.js:106`, `:168`) |
| Exam reports | `POST /api/reports/make` → `report exam` (15 min) | `~/.ainar/reports/RUN/A/` | none |
| Send reports | `POST /api/reports/send` → `lms send-reports` | `sent.json`; Canvas comments, **students see them** | a `window.confirm`, nothing else |
| Sync all | `POST /api/roads` send | ledger, links, roster, `records/evaluations.yaml`, `records/submissions.yaml`; Canvas and Sheets, **students see them** | "each key once" in `P/server/previews.js` — checked before the send and spent after it (`P/server/roads.js:154`, `:176`), so it is not a lock |
| Canvas check | `POST /api/canvas/check` → `lms check` | ledger | **server: a second request joins the first** (`actions.js:358`) — the only one |

### Seconds — spawned, short

| Action | Endpoint → command | Rewrites | Guard today |
|---|---|---|---|
| Place one paper | `POST /api/scans/assign` → `scans assign` | pile plan + folders; `records/submissions.yaml`, `records/item-responses.yaml` (taking a placement back) | client line, one at a time across the whole page and every assessment (`P/client/scans-queue.js`) |
| Re-apply / confirm all / review | `POST /api/scans/apply`, `/assign` with `papers` | same | client `busy`; waits for the line |
| Defence batch plan / apply | `POST /api/defence/batch?step=plan\|apply` | `SUB/RUN/_recordings/plan.yaml`; apply also each student's `session.yaml` and moves the files | client `busy` in the dialog |
| Start a defence | `POST /api/defence/prepare` → `defence prepare` | `SUB/RUN/A/S/defence/` (clone, `pin.yaml`) | none |
| Defended / criterion mark | `POST /api/defence/mark` → `defence mark` | `records/submissions.yaml` or `records/evaluations.yaml` | none |
| Fork link | `POST /api/defence/fork` → `defence fork` (in person: in-process) | `records/submissions.yaml` | none |
| Find forks | `POST /api/homework/forks` → `homework forks` | beside the submissions | none |
| Grade decide | `POST /api/grade/decide` → `grade decide` | `records/evaluations.yaml`, then `records/evidence.yaml` | client `busy` per grading window |
| Grade move / choose / accept / points-only | `POST /api/grade/*` | `groups.yaml`; assessment record (rubric); items | client `busy` |
| Curve | `POST /api/grade/curve` → `curve` | assessment record | none |
| Marks to Canvas | `POST /api/canvas/marks` → `lms plan\|push` per Canvas course | ledger; **students see them** | client `phase` |
| Definition to Canvas | `POST /api/canvas/assignment` → `lms assignment-plan\|push` | ledger, assessment record on create; **students see it** | client `phase` |
| Resolve a difference | `POST /api/canvas/resolve` | ledger; Canvas on "keep ours" | server forgets the snapshot before sending (`canvas-sync.js:168`) |
| Close submissions | `POST /api/assessment/close` → in-process + `lms assignment-push --field lock_at` | assessment record, ledger; **students can no longer hand in** | none |
| Publish | `POST /api/publish` → `publish …` | ledger, `dist/pages/RUN/`, records; GitHub, Telegram, Canvas — **all student-facing** | client `busy` |
| Sheet sync | `POST /api/syncs/action` → `sync migrate\|confirm\|map\|plan\|run` | `version.yaml`, links, ledger; run: `records/evaluations.yaml`, `records/submissions.yaml`, roster | client `busy` |
| Sheet drop | `POST /api/syncs/copy` | `~/.ainar/sheets/RUN.incoming.csv` (one name per run), then plan | client `busy` |
| Connections | `POST /api/integrations/setup`, Google callback/disconnect | `connections.json`, credentials, `version.yaml` | client `saving` |

### Instant — in the harness's own process

Grading policy apply/lock/discard (`version.yaml`, assessment records; apply
has an optimistic `base` check, `grading-writes.js:156`), Canvas course-map,
selection and assignment-map (`version.yaml`, assessment record), plan dates
and topic moves, record fields, assessment setting, missing-work rule,
integrity open/decide (`records/integrity.yaml`), preferences (whole-file
overwrite with the form), snooze, upload, and the defence desk's live writes
(answer, consent, voices, split, override).

These are synchronous from read to write with no `await` in between, so two of
them cannot interleave inside the harness. Their races are with spawned
children and with the session — never with each other.

---

## Which pairs really conflict

**Real** — the two would corrupt, lose or double something. **Shared busy**
— they only wait because a button shared a flag.

| # | Pair | Verdict | Why |
|---|---|---|---|
| 1 | `scans read` × `scans apply` / `assign`, same pile | **Real** | assign moves a student's folder aside and may place another paper at the same path (`scans.ts:962`); read fixed its targets at the start, so it writes one paper's transcript into another's folder, or fails on a vanished one |
| 2 | `scans read` × `scans read`, same pile | **Real** | both send every unread paper to the model — double the cost — and both write the transcripts |
| 3 | `scans record` (any pile) × `scans apply`/`assign` (any pile) × `grade decide` × `defence mark` × sheet `sync run` × roads send, **same course** | **Real** | all RMW the course's `records/*.yaml` from a bundle loaded at their start; pile and run do not separate them. Short (seconds), but every grading day has several |
| 4 | `scans read` × grading cards, gradebook, another pile, another page | Shared busy | read writes only inside its pile. Today the Scans view blocks everything while it runs; navigating away drops the flag, so it blocks nothing and protects nothing |
| 5 | Placements on pile A × placements on pile B | **Real**, by accident | the page's one line was meant for one plan; across piles it is what keeps `records/submissions.yaml` from losing a write. Keep it per course, not per pile |
| 6 | `defence batch transcribe` × the same, same assessment | **Real** | double spend at the provider |
| 7 | `defence batch plan`/`apply` for A × the same for B, same run | **Real** | one recordings plan per run, naming one assessment; B's plan replaces A's, and A's apply then refuses |
| 8 | `defence batch transcribe` × the desk on the same student | **Real, narrow** | both RMW `session.yaml`, but each re-reads just before writing — milliseconds. The wider problem is consent: see *Bugs* 4 |
| 9 | `defence batch transcribe` × the desk on another student, the dialog's Close, any other page | Shared busy | nothing shared |
| 10 | Any two Canvas or sheet commands on the same run (check, plan, push, assignment-push, keep, publish, close, sync plan/run/map, roads) | **Real, widest** | each loads the ledger at start and saves it whole at the end with network calls between; the later save drops the earlier one's notes. Only check × check is joined today |
| 11 | Two roads sends from one preview | **Real** | the once-per-key check is not atomic (*Bugs* 3); students can be sent marks twice |
| 12 | `reports make` × `reports send`, same assessment | **Real** | send attaches PDFs that make is deleting and replacing |
| 13 | grade move/choose × the session's `/grade-batch`, same assessment | **Real** | both RMW `groups.yaml`; the server cannot see the session |
| 14 | Any `version.yaml` or assessment-record writer × another, same run | Real only across processes | in-process writers serialise; a spawned one (syncs map, curve, rubric) or the session can interleave. Seconds |
| 15 | Upload × anything | Neither | adds a new file under a fresh name; the next plan picks it up |

---

## Lock keys for JOB-2

A key names a **store**, not an action. A job declares every key it writes,
takes them all at once or waits (all-or-nothing, sorted, so no deadlock), and
releases them when its child exits.

| Key | Store |
|---|---|
| `pile:RUN:A` | the scan pile's plan and folders |
| `recordings:RUN` | the run's recordings inbox and plan |
| `defence:RUN:A:S` | one student's defence folder |
| `records:C:COLLECTION` | one `courses/C/records/*.yaml` |
| `assessment:C:A` | one assessment record |
| `version:RUN` | the run record |
| `ledger:RUN` | the sync ledger — and with it, Canvas for this run |
| `links:RUN` | the link table |
| `roster` | the roster store (machine-wide) |
| `groups:RUN:A` | grading groups |
| `reports:RUN:A` | the reports folder |
| `connections` | the connection registry and credentials |

The long jobs, and what they take:

| Job kind | Keys | Notes |
|---|---|---|
| `scans-read` | `pile:RUN:A` | 30 min; then queues `scans-record` |
| `scans-record` | `pile:RUN:A`, `records:C:item_responses` | seconds |
| `scans-assign`, `scans-apply` | `pile:RUN:A`, `records:C:submissions`, `records:C:item_responses` | the client line becomes a server queue on these keys |
| `defence-batch-plan`, `-apply` | `recordings:RUN` (+ `defence:RUN:A:S` for each filed on apply) | |
| `defence-transcribe` | `defence:RUN:A:S` for each student due | the desk refuses or waits only for those students |
| `grade-decide` | `records:C:evaluations`, `records:C:evidence` | |
| `defence-mark` | `records:C:submissions` or `records:C:evaluations` | |
| `reports-make`, `reports-send` | `reports:RUN:A` (+ `ledger:RUN` for send) | |
| anything that reaches Canvas or Sheets | `ledger:RUN` (+ `links:RUN`, the records it writes) | serialises all of a run's Canvas traffic, which the ledger needs anyway |
| `sync-tick` (BGS) | as its sync | JOB-11 |

So: reading Quiz 1 holds only `pile:RUN:QUIZ-1` for its half hour. Grading
cards, another pile, the gradebook and every other page stay usable (JOB-4).
Placing papers on Quiz 1 waits; placing on Quiz 2 does not, except for the
second it spends writing `records:C:submissions`.

The in-process writers keep running inline but check the keys: the desk's
live take waits on `defence:RUN:A:S`, a policy apply on `version:RUN`. They
need no queue of their own — they are instant — only the refusal "Transcribing
is running for this student".

---

## Bugs found while tracing

Read from the code, not run. Each is small and separate from E34. **All
four fixed 2026-10-30**: the call takes the three arguments; `publish`
notes its publications on a ledger read again at the end; Sync all spends a
preview's keys before it awaits anything and gives them back if the far side
stopped it; `transcribeTake` reads consent itself. Tests for 3 and 4 in
`P/test/roads.test.mjs` and `ainar-node/test/transcribe.test.ts`.

1. **Linking a Canvas assignment from the pane always fails.**
   `P/server/lms-writes.js:270` calls
   `writeAssessmentLinks(root, run.course_id, run.term, wanted)`, but the
   function takes `(root, courseId, links)` (`ainar-node/src/lms/link.ts:86`).
   The term string arrives as `links`, and `editRecords` refuses it. Hit by
   `/api/canvas/assignment-map` and by `/api/canvas/marks` with `link`.
2. **`publish canvas --confirm` drops its own ledger entry.** `ainar publish`
   loads the ledger (`ainar.ts:2055`), the canvas branch calls `runLms`
   (`:2325`), which loads and saves its own copy with the new assignment
   (`lms/command.ts:1659`, `:1791`), and the outer `ledger.save()`
   (`ainar.ts:2430`) then writes the stale `assignments` back. Same in an
   `update` fan-out that includes Canvas. This is pair 10 inside one process.
3. **Sync all can send twice.** `sendOn` reads "already sent" before
   `await road.send` and marks it sent after (`P/server/roads.js:154`, `:174`,
   `:176`), so two overlapping presses from one preview both go out.
4. **Batch transcription does not re-check consent.** `defence batch
   transcribe` lists the due takes at the start (`ainar.ts:3681`) and
   `transcribeTake` sends each without reading consent again
   (`defence.ts:716`); the live caption does check (`:1710`). A student who
   withdraws while the batch runs still has their recording sent. Once jobs
   can wait in a queue (JOB-8), the gap is longer; JOB-9's "inputs changed
   while it waited" must include consent, and the check belongs in
   `transcribeTake` itself.

---

## Open questions for JOB-2

- **The session.** The assistant runs `ainar` in its own process and writes
  the same stores. Server locks cannot see it. The cheap cover is a lock file
  per store taken inside the write helpers (`upsertRecords`, `editRecords`,
  `Ledger.load`…`save`, `writePlan`, `writeSession`), with the same key names
  as above, so the server's locks and the CLI's agree. Without it, pairs 3,
  10, 13 and 14 stay open whenever the session writes.
- **The ledger window.** Holding `ledger:RUN` for a whole Canvas command is
  safe but serialises Sync all against a check. Re-reading and merging the
  ledger at save would shorten it; that is a ledger change, not a runner one.
- **Atomic writes.** One tmp + rename helper used by every RMW store above
  would stop a crash or a killed child (JOB-5's Cancel) from truncating a
  records file. Worth doing before Cancel exists.
