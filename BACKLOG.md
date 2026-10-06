# Backlog

[`FUTURE.md`](FUTURE.md) argues the direction. This is the same thirteen aspects
cut into work items, so they can be ordered, cut, or handed to somebody — plus
`E14` onwards, which arrived after that document was written and have no
section in it yet. `E25` holds the items first dictated in chat.

Nothing here is scheduled. The ranks are a proposal to argue with, not a plan.

**Sizes.** `S` — hours, one sitting. `M` — a day to three. `L` — a week or
more. `XL` — multi-week, and probably wants splitting before it is started.

**Reading a line.** `ID` · what it is · `size` · what it waits on. A task with
`decision` instead of a size is not work — it is an answer somebody has to give,
and it usually costs an hour and unblocks a week.

**Epic ranks** are my suggestion and are explained under
[Suggested order](#suggested-order) at the end. Prioritising by cutting is more
useful here than prioritising by sorting: there is more written down below than
is worth building.

---

## E3 · Token usage — [§3](FUTURE.md#3-token-usage-measure-then-cut)

> **Rank 1.** Nothing measures this today, so every claim anyone makes about it
> — including every claim in `FUTURE.md` — is unfalsifiable. Cheap to start.

- [ ] **TOK-1** Per-run token accounting: attribute a run's tokens to skill
      prompt, tool results, course record, and conversation. `M` · depends: —
- [ ] **TOK-2** Baseline the five commonest flows (open a session, prepare a
      lesson, grade a batch, draft an assessment, build a page) and check the
      numbers in. `S` · depends: TOK-1
- [ ] **TOK-3** `SKILL.md` diet across both trees — the file is the decision
      procedure, everything else moves to `references/`. Forty files, largest
      3,400 words; do it per tree, not per file. `M` · depends: TOK-2
- [ ] **TOK-4** Field projection on the read tools — a `fields` argument on the
      sixteen tools in `ainar-node/src/tools/index.ts`. `M` · depends: —
- [ ] **TOK-5** Summary-with-drill-down for `gradebook`, `class_progress` and
      `student`, so one concept does not serialize every student. `M` ·
      depends: TOK-4
- [ ] **TOK-6** Record digest per run, and a prompt-cache key derived from it,
      so a second question about an unchanged course does not re-send it. `M` ·
      depends: —
- [ ] **TOK-7** Replace the persona's unconditional `validate` + `inbox` at
      session start with a digest check that re-sweeps only on change. `S` ·
      depends: TOK-6
- [ ] **TOK-8** Model routing policy: extraction and classification off the
      drafting model. Write the policy first, wire it second. `M` · depends:
      TOK-2
- [ ] **TOK-9** A check that fails when a skill asks the model to compute
      something `ainar` already computes. Speculative — may not be expressible.
      `M` · depends: TOK-3

## E9 · Provenance on drafts — [§9](FUTURE.md#9-trust-provenance-on-every-draft)

> **Rank 2.** Cheap now, expensive to backfill, and both E6 and E8 are dead
> without it. The single highest-leverage small thing on this page.

- [ ] **PRV-1** Provenance block on the draft schema: model, skill and version,
      evidence identifiers cited, timestamp. `ainar-node/src/approval.ts` holds
      the draft contract (`AGENT_WRITABLE`). `S` · depends: —
- [ ] **PRV-2** Skills write it. One shared template line rather than forty
      bespoke ones. `M` · depends: PRV-1
- [ ] **PRV-3** It stays on the record when the professor accepts it and when a
      writer rebuilds it, rather than being dropped — `ainar-node/src/records-write.ts`,
      around `upsertRecords` and `writeRecords`, which already keep `approval`
      on a rebuild. `M` · depends: PRV-1
- [ ] **PRV-4** A validator check: an accepted record either carries provenance
      or is marked professor-authored. Nothing anonymous. `S` · depends: PRV-3

## E4 · The record — [§4](FUTURE.md#4-the-record-readiness-history-a-real-backing-store)

> **Rank 3.** `readiness` is the best-specified task in this document: the exact
> output is already checked in, and porting it turns a red fixture green.

- [ ] **REC-1** Port `readiness` into `ainar-node/src/inbox.ts`. The shape is
      fully pinned by
      `workspace/golden/CSS-4008/2026-FALL/action_inbox.json:103` — `checklist`,
      `by_importance`, `next_step`, `phase`, `stages`, `reminders`,
      `has_student_work`, each item carrying `importance`, `timing`, `kind` and
      the `next` skill to run. `M` · depends: —
- [ ] **REC-2** `npm run golden` green on `action_inbox.json`. `S` · depends:
      REC-1
- [ ] **REC-3** Settle `course_outline.json`: the code is ahead of the fixture
      by four deliberate additions now — `description`, `github` and
      `instructions_document_id` on an assessment, and `gaps` on every week and
      in `totals` since UI-0 — so regenerate it once and say so in the commit,
      rather than leaving a golden file that disagrees. Regenerating makes it
      the Node port's own output rather than Python's, which is the trade this
      item is for taking. `S` · depends: —
- [ ] **REC-4** Multi-term comparison — the same concept, the same assessment,
      two offerings, what moved. `L` · depends: REC-5, REC-6
- [ ] **REC-5** Read path into `archive/<TERM>/` so a retired term is
      comparable without being unarchived. `M` · depends: —
- [ ] **REC-6** Record versioning, so two offerings written a year apart can be
      compared without one of them being wrong. `M` · depends: —
- [ ] **REC-7** Decide whether Postgres becomes the backing store or stays an
      export target. Today it is an optional route in `src/store/postgres.ts`
      and the answer is implied rather than taken. `decision` · blocks: INT-8

## E1 · Interface: two modes — [§1](FUTURE.md#1-interface-two-modes-not-one-column)

> **Rank 4.** The biggest item here and the one most likely to decide whether
> anyone else uses this. The first three tasks are worth doing even if course
> mode never happens. The concept these are cut from:
> [`COURSE-MODE.md`](plugins/dsh-professor-pane/COURSE-MODE.md), which answers
> UI-5 by argument (reuse the widget documents) and adds one task the list
> below does not have — the Gaps overlay, worth building in the 300px column
> before any of this.

- [x] **UI-0** Gaps as an overlay on Week by week, in the column as it is:
      `weeks[].gaps` computed in `ainar-node/src/outline.ts`, the Checklist's
      four questions drawn as the colour of each week rather than as a page of
      their own. Useful before course mode exists, and the step that proves
      whether the merge makes a week legible. `M` · depends: —
      Landed with `sections.gaps` as the one opt-*in* section flag, so the
      public page draws none of it; the Checklist's Slides column now reads the
      same field instead of answering the question twice. `test/outline.test.ts`
      is new, and the two halves — the page draws none, a view that asks gets
      them — are pinned in `page.test.ts` and `widgets.test.ts`.
- [ ] **UI-1** Spec the context packet: for every pane button, what the press
      should carry — run, view, sub-view, selected record. This is a table, not
      code, and it is the task the rest depends on. `S` · depends: —
- [ ] **UI-2** Widen the pane→session envelope. Today `sendFollowUpMessage` in
      `plugins/dsh-professor-pane/index.js` posts `{source, kind:'ask',
      prompt}` — one string. Add a `context` object beside the prompt. `M` ·
      depends: UI-1
- [ ] **UI-3** Turn the packet into the turn's opening context on the harness
      side, so a press stops producing a prompt the agent must interpret from
      nothing. `M` · depends: UI-2
- [ ] **UI-4** Verify the persona's "do not open with two sweeps when the turn
      carries a specific request" rule actually fires on a pane press. It is
      written in `agent.cordis.yml` and may never have been exercised. `S` ·
      depends: UI-3
- [ ] **UI-5** Decide whether course mode reuses the widget documents or needs
      a second renderer. A spike against one view, not a discussion.
      `decision` · depends: —
- [ ] **UI-6** Layout state — `chat` or `course` — persisted per workspace.
      First UI state in this project that outlives a session. `M` · depends:
      UI-5
- [ ] **UI-7** Course mode: outline, students and progress as the full-width
      page. `L` · depends: UI-6
- [ ] **UI-8** Chat as a button opening over the course, the way `MaterialModal`
      opens a deck over the harness. `M` · depends: UI-7
- [ ] **UI-9** Addressable views, so switching mode keeps your place. `M` ·
      depends: UI-7
- [ ] **UI-10** Second pass on `lib/client.js` — 4,171 lines before a second
      layout lands on it. Not a rewrite; a read and a list. `S` · depends: UI-5

## E13 · Privacy on screen — [§13](FUTURE.md#13-privacy-under-observation)

> **Rank 5, but ships inside E1.** Separated here only so it is visible; as a
> follow-up change nobody does it.

- [ ] **PRI-1** Presentation toggle that pseudonymizes every view that names a
      student. `M` · depends: UI-7
- [ ] **PRI-2** Default toward it when the window is large or the session is
      new. `S` · depends: PRI-1
- [ ] **PRI-3** Audit which outputs carry real names today — dashboards, reports,
      LMS exports — and check the list against what the toggle covers. `S` ·
      depends: —

## E6 · Grading and calibration — [§6](FUTURE.md#6-grading-calibration-and-the-line-that-does-not-move)

> **Rank 6.** GRD-1 needs no new data and answers the question a professor asks
> before trusting any of this.

- [ ] **GRD-1** Agreement report over already-approved evaluations: per
      criterion, how did the suggestion compare to the decision, with the
      disagreements listed rather than averaged. `M` · depends: —
- [ ] **GRD-2** Confidence calibration — does a confidence of 0.8 mean eight in
      ten? Until this exists the number is decoration. `M` · depends: GRD-1
- [ ] **GRD-3** Test the invariant directly: no path in any interface can
      approve an evaluation or push a grade. Cheap, and it is the constraint
      everything else is checked against. `S` · depends: —
- [ ] **GRD-4** Second-grader mode. `L` · depends: GRD-1
- [ ] **GRD-5** Comparison against last year's distribution. `M` · depends:
      REC-4

## E8 · Evaluating the assistant — [§8](FUTURE.md#8-evaluating-the-assistant-not-just-the-read-layer)

> **Rank 7.** EVA-1 is a few hours of work whose payoff arrives in six months.
> That is exactly why it should be done now rather than when the payoff is
> wanted.

- [ ] **EVA-1** Record the outcome at the moment the professor accepts: accepted
      unchanged, accepted edited, rejected (the draft deleted) — with the
      draft's provenance beside it. `M` ·
      depends: PRV-3
- [ ] **EVA-2** `ainar acceptance` — the rate per skill over a term. `S` ·
      depends: EVA-1
- [ ] **EVA-3** Golden fixtures for the drafting skills, on the model of the
      validator's 98 mutations. Speculative: it is not obvious what a correct
      draft even is. `L` · depends: EVA-2
- [ ] **EVA-4** Run a term without touching it, then read it. Not a task — a
      deliberate wait, written down so it is not mistaken for neglect. `—` ·
      depends: EVA-2

## E5 · Teaching material — [§5](FUTURE.md#5-teaching-material-the-professors-own-template)

> **Rank 8.** The salvage is a known list against a known target, so it is the
> lowest-risk work here. Templates are not.

- [ ] **MAT-1** Salvage the five checks the renderer lacks: alt text, flat
      sibling figure path, unused figure, missing required visual, emphasis
      inside a list. `M` · depends: —
- [ ] **MAT-2** Salvage the thirty teaching beats. `M` · depends: —
- [ ] **MAT-3** Salvage the seven craft references. `S` · depends: —
- [ ] **MAT-4** Confirm the excluded list stayed excluded — no
      `plan.yaml`-as-contract, no `source.ts`, and not the old `toPdf` that
      ignores the exit code. `S` · depends: MAT-1
- [ ] **MAT-5** Render through a template the professor brings from their
      faculty. `L` · depends: MAT-4
- [ ] **MAT-6** Smoke test against two or three real faculty templates, because
      one template proves nothing about the next. `M` · depends: MAT-5

## E11 · Install and CI — [§11](FUTURE.md#11-installation-the-professor-is-not-a-developer)

> **Rank 9 — but INS-1 is rank 1.** CI is not a phase; it is the thing that
> makes every other result mean something. There is no `.github/` today.

- [ ] **INS-1** CI on Linux and Windows running `npm test` in both packages.
      Every green result so far is one machine. `M` · depends: —
- [ ] **INS-2** `npm run check` green, including the golden half. `S` ·
      depends: REC-2, REC-3, INS-1
- [ ] **INS-3** Install without `--legacy-peer-deps`. The flag is not optional
      today: without it npm spends eight-plus minutes and a gigabyte and does
      not converge. Probably means pinning or vendoring the peer graph. `L` ·
      depends: INS-1
- [ ] **INS-4** Remove the manual second `npm install`. `M` · depends: INS-3
- [ ] **INS-5** Rename `bin/sample`, a leftover from what this repository
      started as. Touches the README, `deploy/`, and muscle memory. `S` ·
      depends: —
- [ ] **INS-6** An install a professor can follow without reading a paragraph
      about npm's peer resolver. `M` · depends: INS-4

## E2 · Integrations — [§2](FUTURE.md#2-integrations-one-shape-applied-outward)

> **Rank 10.** Deliberately low. Each of these is real work justified by a real
> user, and none of it is justified by a hypothetical one — except INT-1, which
> is cheap and stops the shape being rediscovered.

- [ ] **INT-1** Write the contract down: `plan` is read-only and free, `diff` is
      three-way against a recorded ledger, `push` needs `--confirm` and never
      runs from an agent turn, drift is reported and left alone. `S` ·
      depends: —
- [ ] **INT-2** Lift the ledger and drift machinery out of `src/lms/ledger.ts`
      into something a second integration can use. `M` · depends: INT-1
- [ ] **INT-3** Decide what a meeting is to a calendar consumer — one event per
      meeting, per week, or per deadline. `decision` · depends: —
- [ ] **INT-4** Calendar feed: the term plan already holds real dates and
      nothing reads them. Small enough that the contract is what gets tested.
      `M` · depends: INT-2, INT-3
- [ ] **INT-5** Credentials audit in one place — what this run is wired to and
      what it is not. The pane's Integrations tab already shows part of it. `S`
      · depends: —
- [ ] **INT-6** Canvas live write-back behind `--confirm`, drift reported. `L` ·
      depends: INT-2
- [ ] **INT-7** Moodle equivalent. `L` · depends: INT-6
- [ ] **INT-8** GitHub Classroom against `workspace/homework/<slug>/`, with a
      roster join that cannot leak names. `M` · depends: INT-2
- [ ] **INT-9** Supabase/Postgres mirror as a supported route. The first place
      student data lives off the machine, so it waits on a decision rather than
      on work. `L` · depends: REC-7, STU-1

## E12 · Language and institutional fit — [§12](FUTURE.md#12-language-and-institutional-fit)

> **Rank 11.** The two audits are cheap and are worth doing early even if
> nothing follows them, because the answer is probably "in more places than
> expected" and that changes the estimate.

- [ ] **LNG-1** Audit where a language is assumed — skills, templates, deck
      grammars, the persona. `S` · depends: —
- [ ] **LNG-2** Audit where a grading scale, credit system or marking convention
      is assumed. `S` · depends: —
- [ ] **LNG-3** Workspace-level locale and scale configuration. `M` · depends:
      LNG-1, LNG-2
- [ ] **LNG-4** Material generation honours it without being asked each time.
      `M` · depends: LNG-3
- [ ] **LNG-5** Produce the example course's materials in Russian and in Kazakh
      as the test. `M` · depends: LNG-4

## E10 · Deployment — [§10](FUTURE.md#10-deployment-more-than-one-professor)

> **Rank 12.** Waits for a second professor who actually wants an account.
> DEP-1 is worth doing before that, because the writing-down is the deliverable.

- [ ] **DEP-1** Stand it up for two accounts on one machine and write down what
      broke. `M` · depends: —
- [ ] **DEP-2** Fix what DEP-1 finds. Unsizable until it exists. `?` ·
      depends: DEP-1
- [ ] **DEP-3** Document the identity-provider contract the institution has to
      satisfy, since that half is theirs. `S` · depends: DEP-1
- [ ] **DEP-4** Exercise the trust fence against a second user's workspace —
      the failure mode must be a refused login, not another person's gradebook.
      `M` · depends: DEP-1

## E7 · Students — [§7](FUTURE.md#7-students-the-axis-that-is-empty-on-purpose)

> **Rank: unranked, and first.** Not because it is urgent but because it is a
> decision, it costs an hour, and it gates two other epics. Leaving it open is
> itself a choice, just not a recorded one.

- [ ] **STU-1** Write the one-page position: student-facing or not. If yes,
      read-only first, and what the professor controls. `decision` · blocks:
      INT-9, PRI scope, and how much E2 is worth
- [ ] **STU-2** Read-only student view spec. `M` · depends: STU-1
- [ ] **STU-3** Consent and data-boundary note — the boundary does not have to
      exist today because nothing leaves the machine, and that stops being true
      the moment this does. `M` · depends: STU-1

## E14 · Quizzes can be multi-variant — no `FUTURE.md` section yet

> **Rank: unranked, and deliberately outside the order below.** Written down
> because this gap sits between two halves that each already look as though they
> handle it, which is how a gap survives a review.
>
> The record already has the question family: `ItemModel` carries
> `scenario_variables`, `difficulty_features` and `allowed_item_types`, every
> `AssessmentItem` can name an `item_model_id`, and
> [`workspace/courses/CSS-4008/item-models/`](workspace/courses/CSS-4008/item-models/)
> has a worked one. The prose skills already have a variant policy —
> `design-exam` §5 specifies families and variants, `make-exam` §6 forbids
> generating them by paraphrase, and its `references/quality-checks.md` lists
> what makes two of them equivalent.
>
> Everything *between* those two halves is missing. Nothing instantiates a model
> into items — `scenario_variables` is stored, exported, written to SQL and read
> by no code. Nothing in the model says which variant a student sat.
> `bin/exam-paper.ts` prints exactly one paper per assessment, and
> `ainar score-items` compares a response to exactly one key. So a professor can
> today *describe* a four-variant quiz in the record and still print one paper
> from it.

- [ ] **VAR-1** Decide what a variant IS in the record: a sibling assessment, a
      `variant` field on `AssessmentItem`, or a grouping over the existing
      `item_model_id`. Everything below changes shape with the answer, and
      guessing it is how a schema acquires two ways to say the same thing.
      `decision` · blocks: VAR-2 … VAR-6
- [ ] **VAR-2** Instantiate an `ItemModel` into items: bind the scenario
      variables, apply one `difficulty_features` profile, emit numbered items as
      records marked `approval: draft`, through the same schema and writer
      (`writeRecords`) every other generator uses. `M` · depends: VAR-1
- [ ] **VAR-3** Variant identity on the paper and on the submission, so a script
      can be marked against the key it was actually sat under. Without this the
      rest of the epic is a way to print papers nobody can grade. `M` ·
      depends: VAR-1
- [x] **VAR-4** `exam-paper.ts --variants N` — N student papers per assessment,
      each carrying its variant where a marker will look for it, and still
      carrying no key. `S` · depends: VAR-3
      *Done 2026-10-04 as `ainar paper render` (and `exam-paper.ts`), on
      `import-paper`'s convention rather than a count: one paper per
      `extensions.variant` found on the items, shared items on every paper,
      `Variant X` leading the header, `--variant V` for one. Rendered in process
      — the spawned renderer needed a pipe a DSH sandbox refuses. The pane's
      chip opens every version in one overlay, tabs or side by side.*
- [ ] **VAR-5** `score-items` against a per-variant key, including the
      misconception tally, which is only meaningful per variant. `M` ·
      depends: VAR-3
- [ ] **VAR-6** An equivalence report rather than a promise: per variant, the
      concepts, cognitive levels, marks and item types it covers, with the
      differences listed rather than averaged. `make-exam` asks a person to
      assert equivalence; most of what it asks is computable from the record.
      `M` · depends: VAR-2
- [ ] **VAR-7** Feed `bin/export-exam-lms.ts` from the record. It requires
      `correctOptions` on every choice question and `exam-paper.ts` strips the
      key on purpose, so nothing in this repository produces JSON it will accept
      — the only files with that field are its own tests. Either a keyed export
      that is explicitly not the student paper, or say in the README that the
      exporter is fed by hand. `S` · depends: —

## E15 · The to-do list: what each thing is owed, and what is done — no `FUTURE.md` section yet

> **Rank: unranked.** Asked for on 2026-09-30. The system works out what to do,
> checks what has been done, and the professor sees both in the UI.
>
> Every piece of work in a course has a lifecycle. An assignment goes: drafted →
> accepted → published (course page, Telegram, Canvas) → deadline passes →
> submissions in → graded (every evaluation decided) → grades synced to the LMS
> → feedback returned. Today each of those facts is recorded somewhere — the
> `approval` word, the publication ledger (`Publication` in
> `ainar-node/src/lms/ledger.ts`), the deadline on the assessment, the
> evaluations' `status` beside `professor_decision`, the LMS ledger for a grade
> push — but nothing reads them in a row. So "did I post homework 3 to Telegram,
> and has it been graded?" means reading five places.
>
> **The design choice that matters: ticks are computed, not typed.** A list the
> professor ticks by hand is one more place to be wrong. A list computed from the
> record cannot drift from it: "published to Telegram" is ticked because the
> ledger has the post, with its date. Only the few steps nothing can see
> ("announced in lecture") get a hand tick, stored as the professor's own fact
> with a date.
>
> **The line holds.** The list may say "graded: 12 of 30 decided" and point at
> `/grade-batch`. It never ticks "graded" itself, because accepting is the
> professor's edit. Push steps (Canvas, Telegram) show the command and are never
> run from the list.
>
> **Nearest kin:** REC-1. `readiness` already answers "what to build next" for
> the course's *structure* (outcomes, concepts, weeks, materials), and its
> vocabulary (`importance`, `timing: due_now | soon | overdue`, `next` skill) is
> what this should speak. Its `reminders` array is empty in every fixture and may
> be where some of this goes. The grade-sync step connects to grading by the
> professor (history, and sync behind `--confirm`).

- [ ] **TODO-1** Write the lifecycles down as a table: for each kind of item
      (assessment, a week's material, an announcement, the run itself), its
      steps; which steps apply given the run's wiring (no Telegram channel means
      no Telegram step); and the evidence that ticks each one. A table, not
      code, and the rest depends on it. `S` · depends: —
- [ ] **TODO-2** `ainar todo <run>`: for each item, every step as `done` /
      `due` / `overdue` / `blocked` / `n/a`, each `done` with its evidence (which
      ledger entry, which record, when). Read-only and deterministic, with no
      model turn. `M` · depends: TODO-1, and share vocabulary with REC-1
- [ ] **TODO-3** Done, then changed: a step reopens when what it recorded has
      moved on, for example an assignment posted to Telegram whose deadline was
      edited afterwards. `publish update` and `src/freshness.ts` already compare
      against the ledger; reuse them. `M` · depends: TODO-2
- [ ] **TODO-4** Hand ticks for steps nothing can see: a record the professor
      writes (what, when, an optional note), with no drafted half. `S` ·
      depends: TODO-1
- [ ] **TODO-5** The pane view: the list per run, grouped by item or by date,
      each open step carrying the button that moves it forward (the skill or
      command). A press should carry the item, which is UI-1's context packet.
      `M` · depends: TODO-2, UI-1
- [ ] **TODO-6** A `todo` MCP tool, and `/action-inbox` reads it instead of
      working the same answer out again. `S` · depends: TODO-2
- [ ] **TODO-7** Items that should exist and don't ("the plan says an
      assignment every fortnight; weeks 9–10 have none"). That belongs to
      `readiness`. Decide whether it goes into REC-1 or into this list, and
      don't build it in both. `decision` · depends: —

> **Added 2026-09-30: something that already happened, postponing, and
> cancelling.** A quiz is often held on paper in class, or a homework is
> collected outside the system, and none of it leaves a trace the list can see.
> Without that trace the list would nag about a quiz that was sat last Tuesday.
> This applies to every kind of item (quiz, homework, lab, midterm), not only
> quizzes. Two buttons belong on every open item as well: **Postpone** and
> **Cancel**.
>
> What is in the record today: `Assessment` has `opens_at` and `due_at` and no
> state at all, so it cannot say "held on 24 Sep" or "cancelled".
> `ActionItem` (`ainar-node/src/model/harness.ts`) has `pending | in_progress |
> done | dismissed` and no postponed. Its default `available_actions` still
> offers `approve`, which predates approval-is-a-field and should go.
>
> A postpone or a cancel is not a small edit, because of what hangs off it.
> Postponing moves `due_at`, and anything already published with the old date
> is now wrong. That is TODO-3's job, and the list should say "re-announce on
> Telegram" rather than stay quiet. Cancelling an assessment that carries weight
> breaks the grading policy's sum, so the button has to ask where the weight
> goes (spread over the rest, onto one other assessment, or excused), and the
> validator has to agree afterwards. Both are the professor's own decisions, so
> they are professor-authored with no draft stage. Both stay on the record as
> history, with the old date or the old state, when, and an optional reason,
> the way grade changes are kept.

- [ ] **TODO-8** A held state on an assessment: `held_at`, how it was held
      (`in_class | paper | outside_system | lms`), and an optional note. Once
      set, the steps up to "sat" read as done, and the list moves on to "collect
      or scan submissions" (`/grade-scans`) and "grade". `S` · depends: TODO-1
- [ ] **TODO-9** A **Mark as already held** control on each quiz or assessment
      row in the pane: pick the date, pick how, save. It is the professor's own
      fact, so the pane may write it, like LMS ids. `S` · depends: TODO-8,
      TODO-5
- [ ] **TODO-10** **Postpone**: a new date (and optionally a reason), with the
      old one kept in history. The list then shows every publication the move
      made stale (page, Telegram, Canvas), each with its re-publish command, and
      never re-sends anything itself. `M` · depends: TODO-3, TODO-5
- [ ] **TODO-11** **Cancel**: a `cancelled` state with a date and a reason. For
      an assessment with weight, a choice of where the weight goes, checked by
      the validator. Its remaining steps turn to `n/a`, and the steps already
      published turn into "announce the cancellation". `M` · depends: TODO-8,
      TODO-5
- [ ] **TODO-12** Bring `ActionItem` in line: add `postponed` (with a new
      `due_at`) and `cancelled`, and drop `approve` from
      `available_actions`. Or retire the record in favour of TODO-2's computed
      list. Decide this first, because having both is two lists. `decision` ·
      depends: TODO-1

## E16 · A task list for each student, drawn on the concept graph — no `FUTURE.md` section yet

> **Rank: unranked. The professor's half can start now; the student's half is
> gated on STU-1.** Asked for on 2026-09-30. Each student has a list of what
> they still have to do, shown as a graph. The professor can view it and add to
> it, and the student gets a path through the course that is their own.
>
> E15 asks what the *course* still owes. This asks what one *student* still
> owes, and what would help them.
>
> **Most of the record already exists.** `StudentConceptState` holds each
> student's state per concept (`not_observed` … `needs_review`) with its
> evidence. The concept graph has its prerequisite edges. `StudentSignal` holds
> what `/find-gaps` noticed. `Intervention` (in `ainar-node/src/model/learning.ts`)
> is already a per-student task in all but name: `student_id`, `type`,
> `description`, `proposed_by`, `approved_by`, and a status running `proposed →
> approved → scheduled → completed | cancelled`. Only
> `workspace/courses/CSS-4008/samples/interventions.yaml` writes one, and no
> view draws them.
>
> **The graph is the course's concept graph, coloured for one student.** Each
> node is coloured by that student's state. The student's tasks hang off the
> node they serve: the course's own assessments, plus the extras made for this
> student. The frontier is the concepts whose prerequisites are demonstrated
> and that the student hasn't demonstrated yet. That is "what to do next",
> computed from the graph. A task on a concept whose prerequisite is
> `needs_review` is drawn as blocked, and the prerequisite is drawn as the
> thing to do first. `/student-dashboard` already draws capability levels and
> the prerequisites under each gap, so this extends it rather than starting
> over.
>
> **Who writes what.** When the professor adds an item, it is their own record
> and has no draft stage. When the system proposes an item (from a signal, a
> low score, or a stalled frontier), it is a draft: `approval: draft`, carrying
> the evidence it cites. It reaches a student only after the professor accepts
> it. Personalising what a student is told to do is a judgement about that
> student, so it sits on the same side of the line as a grade.
>
> **Privacy.** The records key on the pseudonym and never on a name. Views that
> name a student follow `/student-report`'s rule and are written outside the
> repository. PRI-1's presentation toggle has to cover this view.

- [ ] **STP-1** Decide whether a student's task *is* an `Intervention`, perhaps
      with `concept_ids` and a due date added, or a new collection. It probably
      is one: a second record for "something this student should do" is how the
      schema ends up saying it twice. `decision` · blocks: STP-2 … STP-6
- [ ] **STP-2** `ainar student-path <run> <student>`: the concept graph with this
      student's states, the frontier, blocked tasks, and every task on its node.
      Read-only and deterministic. `M` · depends: STP-1
- [ ] **STP-3** The graph view in the pane: open it from a student's row, see
      the coloured graph and the list beside it, and add a task on a node. The
      press carries the student and the concept (UI-1). `M` · depends: STP-2,
      UI-1
- [ ] **STP-4** Proposals: `/find-gaps` writes a draft task beside each signal
      it raises, for example a revisit exercise on the prerequisite or a
      targeted practice set. Always marked `approval: draft`, with its evidence
      and provenance (PRV-1). `M` · depends: STP-1, PRV-1
- [ ] **STP-5** Closing a task from the record: a task on a concept is done when
      new evidence moves that concept's state, not when someone ticks it. This
      is E15's "computed, not typed" rule applied to one student. Keep
      `effectiveness_note` for what the professor thought of it. `M` ·
      depends: STP-2, TODO-2
- [ ] **STP-6** The same graph across a class: which frontier nodes most
      students are stuck on. That points at the course, not the student, so it
      feeds `/prepare-lesson`. `S` · depends: STP-2
- [ ] **STP-6b** Postpone, Cancel and Mark as already done on a student's task,
      as E15 does for the course's items (TODO-9 … TODO-11). `Intervention`
      already has `cancelled` and `scheduled_at`. Postponing moves
      `scheduled_at` and keeps the old one. A task done outside the system
      needs the professor's note, because no evidence will arrive to close it.
      `S` · depends: STP-3, TODO-10
- [ ] **STP-7** The student's side: they see their own graph and their accepted
      tasks, and nothing else. Read-only first, pseudonymous, and only the
      professor decides what appears. `L` · depends: STU-1, STU-2, STU-3

## E17 · One change history for every professor edit — no `FUTURE.md` section yet

> **Rank: first of E17–E24, because it makes three other epics smaller.**
> Proposed 2026-09-30. Four items each describe their own "what changed, when,
> and why": grade changes (E25's GRH), postpone and cancel (TODO-10, TODO-11),
> a student task's postponement (STP-6b), and provenance on drafts (E9). Built
> separately, that is four histories that disagree.
>
> The record already has the shape. `CourseEvent` in
> `ainar-node/src/model/harness.ts` has `event_type`, `entity_type`,
> `entity_id`, `occurred_at` and a free `payload`. Nothing in the real course
> writes one (`recent_events` is empty in its inbox).

- [ ] **HIS-1** Decide what an edit event carries: record and field, the old
      and new value, who, when, and an optional reason. Decide whether it is a
      `CourseEvent` or a separate log. `decision` · blocks: HIS-2 … HIS-4
- [ ] **HIS-2** Every professor-side write (the pane, `ainar` commands,
      accepting a draft by changing `approval`) appends one. An edit made by
      hand in a YAML file is caught on the next load by comparing against the
      last known version, as `freshness.ts` already does for materials. `M` ·
      depends: HIS-1
- [ ] **HIS-3** `ainar history <record>`, plus a History tab on any record in
      the pane. `S` · depends: HIS-2
- [ ] **HIS-4** Re-point GRH-1, TODO-10, TODO-11 and STP-6b at this, and cut
      their own history halves. EVA-1's "accepted unchanged / edited / rejected"
      becomes a query over it. `S` · depends: HIS-2

## E18 · Tell the professor, don't wait to be asked — no `FUTURE.md` section yet

> **Rank: second.** Proposed 2026-09-30. E15 computes what is owed, but a list
> nobody opens changes nothing. A digest sent to the professor, never to
> students: "Quiz 3 is in 5 days and has no questions; HW2's results are not
> entered; the Final Project (40%) has no rubric."

- [ ] **NOT-1** `ainar digest <run> [--since D]`: what became due, overdue,
      stale or newly done since the last digest, ordered by weight times days
      left (see NOT-4). Read-only. `S` · depends: TODO-2
- [ ] **NOT-2** Delivery to the professor's own private channel (a Telegram
      chat with the bot, or email), on a schedule the professor sets. It is a
      message to the professor, not a publication, so it never goes to the
      course channel. `M` · depends: NOT-1
- [ ] **NOT-3** Quiet rules: nothing new means no message, and the same item is
      not repeated daily unless it got worse. `S` · depends: NOT-2
- [ ] **NOT-4** Importance scaled by weight and time left, so a 40% project
      with no rubric eleven weeks out outranks a 0.57% quiz with no questions
      next week only when it should. Share this with REC-1's `importance`
      rather than inventing a second one. `S` · depends: TODO-2

## E19 · Tick things from the phone after class — no `FUTURE.md` section yet

> **Rank: third, with E18.** Proposed 2026-09-30. "Mark as already held"
> (TODO-9) happens right after a lecture, away from the laptop. The same bot as
> NOT-2, talking only to the professor, answers with buttons: *Quiz 2 held
> today? ✅ held · postpone · cancel*.

- [ ] **MOB-1** Inline buttons on digest items for the professor's own facts
      (held, postpone, cancel, hand tick). Each one writes the same record the
      pane would, and an event through HIS-2. `M` · depends: NOT-2, TODO-8,
      HIS-2
- [ ] **MOB-2** The bot answers only the professor's own chat id, and says so
      when anyone else writes to it. It never accepts a grade or a draft; those
      stay at the desk. `S` · depends: MOB-1
- [ ] **MOB-3** Voice notes to the bot ("Quiz 3 moved to Thursday"), turned
      into a *proposed* change the professor confirms with one button. This
      shares its transcription with AUD-1. `M` · depends: MOB-1, AUD-1

## E20 · A teaching team — no `FUTURE.md` section yet

> **Rank: unranked.** Proposed 2026-09-30. Every record assumes one professor
> (the real course has one user for 74 students). `ActionItem` already has
> `assigned_to` and a `delegate` action that nothing uses.

- [ ] **TEA-1** Roles on a run: instructor and teaching assistant. For each
      role, what it may write. A TA may enter scores and hand ticks, and may
      never accept an evaluation or a draft. `decision` · depends: —
- [ ] **TEA-2** Assign a to-do item or a grading batch to a person, and see it
      on their list. `M` · depends: TEA-1, TODO-2
- [ ] **TEA-3** Test the line, as GRD-3 does for the agent: no TA path can
      accept a grade. `S` · depends: TEA-1

## E21 · Getting results back to students — no `FUTURE.md` section yet

> **Rank: after E17.** Proposed 2026-09-30. E15's lifecycle ends at "feedback
> returned", and no epic produces it. It should be per student, from accepted
> evaluations only, and private to that student, never the course channel.

- [ ] **FBK-1** Draft each student's feedback from their accepted criterion
      decisions and cited evidence: what they earned, where, and the next thing
      to work on (from E16's frontier once it exists). Marked `approval: draft`.
      `M` · depends: —
- [ ] **FBK-2** Delivery routes: a comment on the student's homework fork, a
      Canvas submission comment, or a private file. Plan, then `--confirm`, as
      every publication is. `M` · depends: FBK-1, INT-1
- [ ] **FBK-3** "Feedback returned" becomes a step E15 can see. `S` · depends:
      FBK-2, TODO-2

## E22 · Next year's course from this year's — no `FUTURE.md` section yet

> **Rank: before summer 2027.** Proposed 2026-09-30. REC-4 and REC-5 compare two
> terms, but nothing creates the next one.

- [ ] **ROL-1** `ainar new run --from <run>`: copy modules, meetings and
      assessments with their dates shifted to the new term's calendar, reset
      every `approval` to `draft`, and leave student data behind. `M` ·
      depends: —
- [ ] **ROL-2** Carry over the changes `/course-reflection` recommended as
      to-do items on the new run. `S` · depends: ROL-1, TODO-2
- [ ] **ROL-3** Report what the shift could not place: holidays, a week that
      disappeared, two assessments that now collide. `S` · depends: ROL-1

## E23 · Homework integrity across forks — no `FUTURE.md` section yet

> **Rank: unranked.** Proposed 2026-09-30. Homework repos are public forks, so a
> class's submissions are already in one place, in the open. The output is a
> signal for the professor with the evidence beside it. The system never makes
> an accusation, and nothing is said to a student by the system.

- [ ] **ITG-1** Similarity across a class's forks for one assignment,
      excluding the starter code, as `StudentSignal` records marked
      `approval: draft`. `M` · depends: INT-8
- [ ] **ITG-2** The pair view: the two submissions side by side, the shared
      parts marked, and commit times. `M` · depends: ITG-1

## E24 · A question bank across quizzes and years — no `FUTURE.md` section yet

> **Rank: with E14.** Proposed 2026-09-30. Fourteen quizzes a term, and the
> answer keys already keep surplus questions (for example
> `QUIZ-02-surplus-items.md`) that nothing can find again.

- [ ] **QB-1** Questions reusable by concept, cognitive level and item type,
      across quizzes and across runs, with the history of where each was used
      and how it performed. `M` · depends: VAR-1
- [ ] **QB-2** Draw a quiz from the bank for a week's concepts, avoiding
      questions this class has already seen. `M` · depends: QB-1
- [ ] **QB-3** Import the surplus files into the bank. `S` · depends: QB-1

## E25 · Carried in from the chat backlog (2026-09-29)

> Items dictated as "for future tasks" before they had a place here. Moved in on
> 2026-09-30 so that this file is the one list.

- AUD-1 (student audio answers) moved to [E26](#e26--one-assessment-several-ways-to-answer-it--no-futuremd-section-yet)
  on 2026-09-30. The ID is unchanged, so MOB-3 still points at it.
- [ ] **DL-1** Datalayer: fewer big files, split by parts. Research whether that
      is actually easier to use before committing. `decision` · depends: —
- [x] **MF-1** Per-material folders: the result file up front, its assets in
      subfolders. Done 2026-09-29 (`ainar organize-materials`), and the real
      course was migrated.
- [ ] **JEV-1** Jev's alternative (from Stanford and Carnegie Mellon), brought
      into decision making. Scope still to be written down. `decision` ·
      depends: —
- [ ] **TOP-1** Topic generation: show the generated md files' content while
      they are being generated, so the professor can judge each one as it
      lands. `M` · depends: —
- [ ] **GRH-1** Grading by the professor, in chat or with a button in the UI.
      Every grade change is remembered (what, when, optional reason, the
      criterion), as history and never an overwrite. The history itself is
      E17. `M` · depends: HIS-2
- [ ] **GRH-2** Sync a grade to Canvas, Moodle and the course site as an
      explicit, confirmed step. A grade pushed to an LMS can't be recalled.
      `M` · depends: GRH-1, INT-6

## E26 · One assessment, several ways to answer it — no `FUTURE.md` section yet

> **Rank: unranked.** Proposed 2026-09-30. An assessment should accept more
> than one way of answering: a file, a homework fork, a recorded audio answer,
> or a live spoken exchange with the system. The late rule and the rubric
> should apply to all of them the same way. The system may also ask the student
> questions about their own homework.
>
> Some of this is already recorded and used by nothing.
> `submission_type` is already a list (`[pdf, notebook]` on ASSESSMENT-02 of
> CSS-4008). `settings.allow_late_submission` and
> `settings.late_penalty_per_day` are stored, exported to the bundle and SQL,
> and read by no code. `gradebook.ts` picks the counting attempt by
> `submitted_at` and never compares it to `due_at`. So a late report is scored
> as if it were on time.
>
> Every score produced here, whether live or afterwards, is an `Evaluation`
> marked `approval: draft`. That includes a late penalty. The professor accepts
> it, as GRD-3 already requires.

**Several ways to submit**

- [ ] **ASM-1** Decide what "several possibilities" means in the record. Is it
      one assessment with a list of allowed modes, all graded on one rubric? Or
      is it sibling assessments where the student picks one (a written report
      *or* an oral defence)? Or a required pair (code plus a short oral check)?
      The answer also settles whether a rubric criterion can be marked as
      applying to some modes only. `decision` · blocks: ASM-2, AUD-2, VIV-1
- [ ] **ASM-2** Name the modes in the schema: `file`, `repo`, `audio`, `live`.
      Each submission carries the mode it came in by, and the brief and the
      course page say which modes are open. `S` · depends: ASM-1

**Late submission**

- [ ] **LAT-1** Decide the late policy shape. The current field is per day.
      Real policies also have a grace period (for example 15 minutes), a cap
      ("at most 50% off"), a hard cutoff after which nothing is accepted, a
      per-student extension, and a rule for hours versus calendar days. Decide
      which of these the schema holds, and whether the course-level grading
      policy sets a default that an assessment can override. `decision` ·
      blocks: LAT-2 … LAT-4
- [ ] **LAT-2** Compute lateness from `submitted_at` against `due_at` plus any
      extension, in the course's time zone. For a homework fork, use the time
      of the last commit before the hand-in (or the time the fork's hand-in tag
      was pushed), and not the time we pulled it. `M` · depends: LAT-1
- [ ] **LAT-3** Apply the penalty in `gradebook.ts` as its own visible line on
      the evaluation: raw score, penalty, final score, and the rule that
      produced it. Never apply it silently to the raw score. It is a draft like
      the rest of the grade. `M` · depends: LAT-2
- [ ] **LAT-4** Extensions and waivers: the professor grants one to a student
      for an assessment, with an optional reason, recorded through HIS-2 so it
      shows in the history. The late list in E15 honours it. `S` · depends:
      LAT-1, HIS-2

**Audio answers, graded afterwards**

- [ ] **AUD-1** Student audio answers: record, transcribe, and evaluate against
      the rubric like any other submission. The transcript is the evidence that
      grading cites, with timestamps into the recording so the professor can
      listen to the exact moment. `L` · depends: —
- [ ] **AUD-2** Where the recording comes from: an upload, a Telegram voice
      message to the course bot, or a browser recorder on the course page.
      Decide which one first. `decision` · depends: ASM-1
- [ ] **AUD-3** Language and accents. The real course is not English-only
      (see E12), so measure transcription errors on real samples before the
      grader is trusted with them. A low-confidence stretch of the transcript is
      flagged for the professor and never scored silently. `M` · depends:
      AUD-1, LNG-1

**Live oral answers, scored in real time**

- [ ] **LIV-1** A live session: the student speaks, the system transcribes as
      they go, asks the next question, and keeps a running draft score per
      criterion. The draft score is shown to the professor only, never to the
      student during the session. `L` · depends: AUD-1, ASM-2
- [ ] **LIV-2** Decide what "real time" is allowed to decide. Proposal: live
      scoring only chooses the next question. The score that counts is produced
      afterwards from the full recording by the same path as AUD-1, and the
      professor accepts it. `decision` · depends: —
- [ ] **LIV-3** Keep the whole session (audio, transcript, the questions asked
      and why each was chosen) as the submission. A regrade or an appeal can
      then replay it. `M` · depends: LIV-1

**The system asks the student about their homework**

- [ ] **VIV-1** Generate follow-up questions from the student's own
      submission: "why did you drop these rows?", "what happens to your split if
      the data were sorted by date?". The questions are tied to rubric criteria
      and to concepts, so an answer is evidence for a criterion and not a
      general impression. `M` · depends: ASM-1
- [ ] **VIV-2** Delivery: in writing (a comment on the fork, a Canvas comment),
      or spoken, through LIV-1. The student's answers become part of the same
      submission. `M` · depends: VIV-1, FBK-2 or LIV-1
- [ ] **VIV-3** Use it as an authorship check next to E23. A student who cannot
      explain their own code becomes a `StudentSignal` for the professor, with
      the question and the answer beside it. As in E23, the system never makes
      an accusation. `S` · depends: VIV-2, ITG-1
- [ ] **VIV-4** Ask the professor first. Before any question goes to a student,
      the professor sees the proposed questions for the class and can edit or
      cut them. The whole batch is marked `approval: draft`. `S` · depends:
      VIV-1

**The defence desk: one student at a time, in the browser**

> Dictated 2026-10-06. The professor opens a student's submission, which opens
> their repository. They press *Start defence*. The system reads the code and
> prepares questions, then opens with the first one ("explain homework 1"),
> listens, transcribes the answer and keeps the transcript. The professor can
> press *Follow-up*, which transcribes again, and at the end the system
> proposes a grade. All of this happens in the browser, inside the pane. A
> second mode takes recordings the professor uploads and analyses them alone,
> after showing what the transcription will cost.

- [x] **DEF-1** Keep the link a student handed in. Canvas returns it as the
      submission's `url` for `online_url` work (`code_repo` maps there), and
      `submissionsFromApi` drops it. Store it on the `Submission` so that "open
      their repo" has something to open. `S` · depends: — Done 2026-10-06:
      `Submission.url`; `lms import-submissions --target canvas-api` also fills
      it in on submissions recorded before it existed.
- [x] **DEF-2** Read the student's repository: a shallow clone into the private
      folder, pinned to the commit read, so the questions and the grade cite one
      version of the code. `S` · depends: DEF-1 Done 2026-10-06: `ainar defence
      prepare`, a blobless clone in `~/.ainar/submissions/…/defence/`, pinned to
      the last commit before `submitted_at`, run by the pane in its own process.
- [x] **DEF-3** The defence desk in the pane: per student, the repository link,
      *Start defence*, and the draft questions from VIV-1, which the professor
      can edit or cut (VIV-4) before asking any of them. `M` · depends: DEF-2,
      VIV-1 Done 2026-10-06, under each submission in Students. The session's
      own model drafts the questions (`/defend-submission`), and
      `ainar defence questions` checks and writes them to
      `output/<RUN>/defence/` — the sandbox cannot write `~/.ainar`. Editing is
      in that file for now; editing from the pane is open.
- [ ] **DEF-4** Microphone in the pane: record per question, transcribe, save
      the audio and a timestamped transcript as part of the student's
      `oral_defense` submission. *Follow-up* asks the agent for the next
      question from what was just said. `L` · depends: DEF-3, AUD-1, LIV-2
- [ ] **DEF-5** The proposed grade from the whole session, by the AUD-1 path,
      as an `Evaluation` marked `approval: draft` citing transcript timestamps.
      `M` · depends: DEF-4
- [ ] **DEF-6** Batch mode: upload recordings, see the total minutes and the
      transcription cost per provider before anything is sent, then confirm.
      Each recording is matched to a student and graded as DEF-5 does.
      `M` · depends: AUD-1, AUD-2

## E27 · Spreadsheets both ways: Google Sheets and Excel — no `FUTURE.md` section yet

> **Rank: unranked.** Proposed 2026-09-30. Half of this exists, and it goes one
> way only. `ainar lms push --target sheets-api` (`src/lms/sheets.ts`) writes
> the gradebook into a Google Sheet. It reads the tab first and refuses to
> overwrite a cell it did not write. `--target sheet` (`src/lms/sheet.ts`) writes
> a CSV with the same layout (`grid.ts`). Three things are missing. Nothing
> reads the sheet back. Nothing writes a real `.xlsx`. And nothing reaches Excel
> on OneDrive, which is where the real course workspace already lives.
>
> The rule from `sheets.ts` stays: the sheet is a view, and the record is the
> source of truth. A value typed into the sheet becomes a *proposed* change the
> professor accepts. It never becomes a grade silently.

- [ ] **SHT-1** Decide what syncs besides grades. Candidates: the roster, hand
      ticks and attendance (E15), extensions (LAT-4), and item-level scores
      entered by hand for paper exams. For each one, decide whether the sheet
      may propose changes to it or only display it. `decision` · blocks: SHT-3
- [ ] **SHT-2** Native `.xlsx` output from the same `grid.ts` table: one tab per
      assessment plus the summary tab, with criteria as columns, comments beside
      them, and formulas left out on purpose so that nothing drifts from the
      record. `M` · depends: —
- [ ] **SHT-3** Pull: read the Sheet (or an `.xlsx` the professor saved) and
      compare it against the ledger. Every cell that changed since our last push
      becomes a proposed change, showing its old value, its new value, the cell
      and the criterion. The professor accepts them through GRH-1, so each one
      shows up in the history (HIS-2). `M` · depends: SHT-1, INT-2, GRH-1
- [ ] **SHT-4** Excel on OneDrive and SharePoint through Microsoft Graph: the
      same plan, diff and `--confirm` push as `sheets-api`, and the same pull as
      SHT-3. Authentication goes through `connections/`, beside the Sheets key.
      `L` · depends: SHT-2, SHT-3, INT-1
- [ ] **SHT-5** Conflicts: a cell edited in the sheet *and* changed in the
      record since the last sync. Report both values and choose neither, as
      Canvas drift is handled today. `S` · depends: SHT-3
- [ ] **SHT-6** A sheet the professor already keeps. Map its columns onto
      students and criteria once, save the mapping to the run, and reuse it.
      Nobody should have to adopt our layout to get sync. `M` · depends: SHT-3

## E28 · Grading in the pane, question by question — no `FUTURE.md` section yet

> **Rank: in progress.** Proposed and started 2026-10-02, on Quiz 1 of CSS-4007
> (61 papers placed, 4 short-answer questions, no rubric). The Scans tab drew
> Identify and Match in full and offered a chat prompt for the rest, so the
> rubric, every mark and every acceptance happened in chat and in YAML.
>
> **The line moved, on purpose.** Until now the pane had no route that wrote a
> `professor_decision`. Here it does, because the press *is* the professor
> deciding. The invariant GRD-3 tests is unchanged: nothing writes a decision
> unless a person pressed for it. An **Accept all** button is allowed (decided
> 2026-10-02). What keeps it honest is the history, not a missing button: every
> decision records whether it was made one card at a time or in bulk, and a
> changed decision keeps the one it replaced.
>
> **Grade by question, not by student.** One rubric in mind at a time, and
> answers that say the same thing sit together. The grouping by meaning is the
> assistant's judgement, so it is kept as a draft in the private folder
> (`groups.yaml` beside the scans), where the pane can draw it and the professor
> can move it.

- [x] **GRA-1** `groups.yaml`: the assistant's grouping of a question's
      answers by meaning, each group with a proposed score and a label, kept
      in the private folder. `/import-assessment` §7 writes it with the
      rubric. `S` · depends: —
- [x] **GRA-2** `ainar grade status|decide|move|accept-rubric|points-only`. One
      write path for the CLI and the pane. `decide` writes
      `professor_decision` with `decided_by`/`decided_at`, sets `approved` or
      `overridden` against the suggestion, keeps the group's suggestion as
      `ai_suggestion`, and pushes any earlier decision onto
      `extensions.history`. `M` · depends: GRA-1
- [x] **GRA-3** The Rubric step in the pane: levels with the groups placed
      under them, move a group to another level, accept the rubric. Or skip
      the rubric and grade by points only. `M` · depends: GRA-2
- [x] **GRA-4** The Grade step in the pane: one question at a time, groups
      with their answer cards (the page image, the text as read, the
      confidence, the suggestion), 0…max buttons, a comment, Accept group,
      Accept all. `M` · depends: GRA-2
- [x] **GRA-11** Several rubrics proposed over one grouping — always one from
      the marking scheme the exam already carries (`marking_guidance`, the key),
      one from what the class wrote — compared per question in the pane by the
      class mean and the count at each level; chosen per question
      (`grade choose`), then accepted. Done 2026-10-02. `M` · depends: GRA-3
- [x] **GRA-13** Rethink while grading: the rubric open beside the cards, a
      group moved re-suggests at once, the assistant asked to revise adds a
      proposal the view picks up live, applied with marks kept and the ones
      that now disagree flagged and re-markable in one press. Marks shown as
      badges with a per-question picture, no dashes. Done 2026-10-02. `M` ·
      depends: GRA-11
- [ ] **GRA-12** Mark one question by points while others use a rubric
      (`points-only --item`). Today points-only is all questions or none.
      `S` · depends: GRA-11
- [ ] **GRA-5** Edit a level's wording and points in the pane, and split or
      merge groups (moving one answer between groups). Today the wording is
      changed in chat. `M` · depends: GRA-3
- [ ] **GRA-6** Where on the page each answer is. Ask the reader for a region
      per answer (`scans read` already bands the page), and crop to it instead
      of drawing the whole page. `M` · depends: —
- [ ] **GRA-7** Fix a misread in place: edit the transcript text from the card,
      which rewrites the transcript and the ItemResponse. A correction of fact,
      not a grade. `S` · depends: GRA-4
- [ ] **GRA-8** After the last question: the score distribution per question,
      the papers with a changed mark, then the gradebook and `lms push` as an
      explicit, previewed step (GRH-2). `M` · depends: GRA-4, GRH-2
- [ ] **GRA-9** Feedback to each student from the decisions and comments, as
      drafts for E21. `M` · depends: GRA-4
- [ ] **GRA-10** Fold `extensions.history` into E17's one history when HIS-1
      decides its shape. `S` · depends: HIS-1

## E29 · Agentic vision for reading exams — no `FUTURE.md` section yet

> **Rank: research first.** Raised 2026-10-03. Gemini's newer vision work runs
> as a loop rather than one look: the model plans, zooms or crops with code,
> looks again, and only then answers; and its video understanding reads long
> footage with timestamps. Nothing in the harness uses Gemini today, and
> `scans read` reads each page in one pass. The question is whether that loop
> reads handwriting better than one pass, and whether video can stand in for
> a scanner.
>
> **The line does not move.** Whatever reads the page produces a transcript and
> a confidence, as `scans read` does now. It never writes a score or a
> `professor_decision`; grading stays on the GRA path.

- [ ] **VIS-1** Research note: what Gemini's agentic vision and video
      understanding actually do (the think–act–observe loop, code-execution
      crops, frame sampling, timestamps), which models and APIs carry it, the
      cost per page and per minute of video, and the data terms for student
      work. Written to `docs/`, sources cited. `S` · depends: —
- [ ] **VIS-2** Benchmark against what we have: the Quiz 1 scans of CSS-4007
      (61 papers, transcripts already checked by the professor) read again by
      an agentic loop, compared on misreads per answer and on how well the
      confidence flags the bad ones. The answer decides the rest of the epic.
      `M` · depends: VIS-1
- [ ] **VIS-3** A zoom-and-reread pass on low-confidence answers only: crop to
      the answer's region, read again, keep both readings when they disagree.
      Shares its regions with GRA-6. `M` · depends: VIS-2, GRA-6
- [ ] **VIS-4** A phone video of the stack instead of a scanner: the professor
      films the papers being turned, the reader picks the sharpest frame per
      page and hands pages to `grade-scans` as if scanned. `L` · depends: VIS-2
- [ ] **VIS-5** Video answers: a recorded presentation or oral defence read
      with timestamps, so each rubric criterion cites the moment it rests on.
      Belongs with E26's oral answers. `L` · depends: VIS-1, E26
- [ ] **VIS-6** `decision` Which provider reads student work. A second model
      vendor means a second data agreement and a second key in
      `connections/`; decide only if VIS-2 shows it reads better. · depends: VIS-2

---

## Suggested order

Four decisions and five tasks are worth doing before anything else on this page.

**The decisions, in an afternoon.** STU-1 (student-facing or not), REC-7
(Postgres as store or as export), UI-5 (one renderer or two), INT-3 (what a
calendar event is). Each gates work that is much larger than the decision.

**The five tasks.**

1. **INS-1** — CI on two platforms. Everything below is measured on one machine
   until this exists.
2. **TOK-1** — token accounting. Makes the efficiency work falsifiable.
3. **PRV-1** — the provenance block. Hours now, weeks later.
4. **REC-1** — port `readiness`. Fully specified by a checked-in fixture, and
   turns a red result green.
5. **UI-1** — spec the context packet. A table, and the whole of E1 rests on it.

**Then the largest bet:** UI-2 → UI-3 → UI-7 → UI-8, with PRI-1 inside it.

**Cheap things that can be picked up between anything:** GRD-3, INS-5, LNG-1,
LNG-2, INT-1, INT-5, PRI-3, REC-3.

**Deliberately not now:** INT-6, INT-7, INT-9, EVA-3, GRD-4, MAT-5, DEP-2.
Each waits on a real user asking for it. If one is started anyway, the question
to answer first is who asked.
