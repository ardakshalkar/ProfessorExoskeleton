# Why pane pages load late

[`BACKLOG.md` JOB-6](../BACKLOG.md#e34--long-work-in-the-background-and-queued-and-pages-that-open-at-once--no-futuremd-section-yet).
Measured 2026-11-01 on the real course (CSS-4007-2026-FALL, the *AI Course
2026 v1* workspace on OneDrive: 397 files under `courses/`, 81 students),
harness on port 3081, code at `9b77097`. JOB-7 fixes what this finds; its
target is a page that shows something within 300 ms of the click.

`P` is `plugins/dsh-professor-pane`.

## How it was measured

- **Click to drawn**, in the browser: the hash changed, then the page counted
  as drawn once no `/professor-pane/` request was in flight and no
  "Reading…/Loading…" placeholder was on screen for 400 ms. Each request's
  start and duration from the browser's resource timings. Every place in the
  sidebar, visited twice: the first visit after the pane opened, then again.
- **Server cost**, without the browser: `P/test/reads-timing.mjs` calls the
  router directly, warm (after the course is parsed), four times per read, and
  counts how often each read asks the course store whether the course moved.
  `PROFILE_OUT=…` adds a CPU profile of the warm calls alone.

## Every place, click to drawn

| Place | First visit | Again | Reads (server ms, warm) |
|---|---|---|---|
| **Sync** | **10.1 s** | 0.28 s | `roads` 7 786 (first) / 57; then a refetch of 15 reads |
| **Students** | **0.99 s** | 0.69 s | `view/students` 470–930, a 5.5 MB page |
| **Files** | **0.91 s** | 0.78 s | `files` 740–860 |
| **Today** | 0.50 s | **0.66 s** | `today` 380–630 |
| **Waiting** | 0.41 s | 0.44 s | `today` 360–390 (the same document) |
| Course settings | 0.38 s | 0.22 s | four reads in parallel, slowest `syncs` 150–270 |
| Concepts | 0.09 s | 0.23 s | `concepts-grid` 75–90 |
| Materials | 0.17 s | 0.11 s | `view/assessments` 50 |
| Weeks | 0.13 s | 0.03 s | `course` 45–70 |
| Gradebook | 0.10 s | 0.09 s | `view/gradebook` 40–60 |

Not on the list because it is not a place but is under every place: the
sidebar's `navigator`, 175–185 ms, asked again on every change anywhere. And
the Scans window (`api/scans`, 570–600 ms every time), which is Files' cause.

The pages wait on one read each, not on reads in series: where a page asks
for several (Course settings, Sync) they start together. The time is in the
server, and in what the client asks again after a change.

## The five slowest, and why

### 1. Sync, first visit after the pane opens — 7.8 to 10 s

The page's plan (`POST /api/roads`) reuses a Canvas check under fifteen
minutes old (`P/server/canvas-sync.js`), and the pane starts one the moment it
opens (`P/client/canvas-check.js`, `open`). Until that check is done, the
plan waits for it. A check is `ainar lms check` in a child process: **about
30 s** on this course — 3 s to import the CLI, 3.5 s to parse the course
(the same `scans status` that only reads costs 6.5 s), the rest Canvas's API
across three Canvas courses. Visited again with a fresh check: 57 ms.

When the check ends, `wrote(sessionId, ["canvas"])` bumps the `canvas` tag —
and `bump` in `P/client/data.js` bumps `"*"` with every tag. Every reader that
follows everything (the navigator, the course, Today, Recent, the command
index) asks again at once, with Sync's own readers: **15 reads in parallel,
each 0.8–2.2 s** because they queue behind each other in one process. That
storm adds about 2 s to Sync and lands on whatever page is open when a check
finishes — which, with the pane checking every five minutes, is any page.

### 2. Students — 0.7 to 1.0 s, every visit

`/view/students` builds the whole class as one HTML document, **5.5 MB**, on
every request, with nothing kept between requests (470–510 ms warm; 930 ms on
the first). About a third of the server time is each student's defence read from
the private folder — `defenceReader` (`P/server/defence-desk.js:99`) parses
the pin, the questions and `session.yaml` for every student, and the reader is
made per request; the rest is building per-student markup
(`student` → `workPanel` → `itemLine`, `P/server/students.js:1401–1506`). Then
the browser parses 5.5 MB into the frame.

### 3. Files — 0.8 to 0.9 s, every visit (and the Scans window, 0.6 s)

`filesDocument` (`P/server/files.js:146`) calls `scanPiles`, which parses
every transcript of every pile (`scanStatus` and `lowConfidence`, three
quarters of the time), and `secondsOf` parses every student's defence
`session.yaml` (about a sixth). **`keptScanPiles` already exists**
(`P/server/scans.js:534`) — kept per course version and private-files
fingerprint, used by the navigator and Today — but `filesDocument` and
`scansDocument` (`P/server/scans.js:575`) call the uncached `scanPiles`
directly. Nothing in either answer changes until those files do.

### 4. Today and Waiting — 0.4 to 0.66 s, every visit

`/api/today` asks the course store **11 times** per request whether the
course moved, and each ask is a walk of `courses/` — every file and folder
stat'ed (`newestMtime`, `ainar-node/src/store/course.ts:22`), **20 ms** on this
OneDrive folder. That is about 220 of Today's 380 ms. The asks come from
`loadedRun`, `runsDocument`, `viewPayload` and the navigator inside Today,
each loading the course for itself. The rest is the navigator's own document
inside Today (about 130 ms of its work besides the walks) and
`unpublishedDocument` (about 95 ms). Waiting draws from the same document.

### 5. The sidebar — 175 ms, on every change anywhere

`/api/navigator` takes 175–185 ms, 5 of its walks (about 110 ms). It follows
`"*"`, so it is asked again on every revision move and every tag — every
Canvas check, every write the pane makes, every save the assistant makes —
and in the storm under 1 it took 0.75–1.2 s. A sidebar that redraws on every
change elsewhere pays this each time.

## Also seen

- **A cold start parses the course for 5–6.4 s** before anything answers.
  `P/server/prewarm.js` does that work ahead of the first page; a page asked
  for during it waits for it.
- **The pane checks Canvas on every open** however fresh the last check, and
  then every five minutes: 30 s of a CLI child each time, and a storm at the
  end of each.
- **Every spawned command pays 6.5 s before it starts**: imports and the
  course parse. Placing one paper, deciding one grade or marking one defence
  from the pane costs that each time.

## After JOB-7 (2026-11-01)

What changed, and the same measures again (same course, same machine). Every
answer is byte-identical to before, compared read by read.

| Fix | Where | Before → after (warm, server) |
|---|---|---|
| The store watches `courses/<id>` and walks it only after a change it saw, a course write by this process (`store/written.ts`, bumped by `record-edit.ts` and `records-write.ts`), or 30 s of quiet | `ainar-node/src/store/course.ts`, `{ watch: true }` from `P/server/workspace.js` | Today 380 → 185 ms, sidebar 178 → 90 ms |
| Files kept per course version and private-files fingerprint; Files and Scans use `keptScanPiles` | `P/server/files.js`, `P/server/scans.js` | Files 750 → 57 ms, Scans 570 → 75 ms |
| The class list's defence reader kept per fingerprint; one fingerprint per request; the standing profile and shared answers kept per course version | `P/server/defence-desk.js`, `P/server/routes/views.js`, `P/server/standing-view.js` | Students 490 → 200 ms |
| A Canvas check bumps `canvas` only when it found something other than the last one | `P/client/canvas-check.js` | no storm every five minutes |

Click to content in the browser, first visit / again: Sync 65 / 54 ms (it
always drew at once with "Checking Canvas…" — the 10 s above was the plan
arriving, which still waits for the check), Today 211 / 239, Waiting 211 /
264, Files 285 / 107, Concepts 182 / 214, Students **711 / 563**, the rest
under 90.

**Still over 300 ms: Students.** Its server half is 200 ms; the rest is the
browser taking in a 5.5 MB page. Sending the class without every student's
whole panel is the remaining fix (5 below), and a larger one than this job.
**Still a storm once:** the first check after a harness start has no answer
to compare with, so it moves `canvas` and everything reads again — once.

## What JOB-7 should change, in order

1. Keep the store's answer to "did the course move" for the revision's own
   second (`REVISION_TTL_MS`) instead of walking `courses/` per `load` — or
   load once per request. Today about −220 ms, the sidebar about −100 ms.
2. `filesDocument` and `scansDocument` use `keptScanPiles`, and the defence
   seconds are kept on the same fingerprint. Files about −700 ms, Scans about
   −500 ms.
3. A tag bump does not bump `"*"`; the navigator and Today follow the areas
   they read (`P/client/data.js` `AREAS`). The `canvas` tag moves only what
   draws Canvas. Ends the storm.
4. Sync draws from the ledger at once and shows the plan when the check
   lands, instead of holding the page for it.
5. Students: keep the defence reader per private-files fingerprint, and send
   the class without every student's whole panel — the 5.5 MB is the
   cost twice, on the server and in the browser.
