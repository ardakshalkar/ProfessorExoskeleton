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
      into something a second integration can use. `M` · depends: INT-1 ·
      done together with MOD-2 (E33), the adapter interface it belongs to
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

- [x] **LNG-1** Audit where a language is assumed — skills, templates, deck
      grammars, the persona. Done 2026-10-15 (read-only). 14 places, almost all
      hard-wired. The pane's English UI (about 25k lines, no i18n layer) is the
      largest. Others that matter:
      - the persona has no rule for what language to reply in;
      - `<html lang="en">` is hard-coded on the course page, the dashboard and
        the student screen;
      - deck text-fit is tuned for Latin letters, so Cyrillic overflow is
        under-estimated (`slides/deck.ts`);
      - Russian and Kazakh word lists are hard-wired in `roster`, `paper-import`,
        `scans`, `recordings`, `lms/command`, `grading-policy`, `scan-read` and
        `defence`. They work for en/ru/kk and silently fail for any fourth
        language.

      `vendor/datalayer/preferences/defaults.yaml` `language.default` is the
      only language key, and only the pane reads it.
      Row-level audit: `C:\Users\Ardak Shalkar\AppData\Roaming\Claude\side-session-notes\local_489dbda1-e970-4b6a-b7d0-53646899f573\lng-1-2-audit.md` (52 rows: language 14, timezone 9, grading 13,
      institution 9, credits/term 7). LNG-1's rows are L1-L14; MOD-1 closed none
      of them (L2 only gained a neutral `locale.timezone` sibling; UI i18n L7 is LNG-3).
- [x] **LNG-2** Audit where a grading scale, credit system or marking convention
      is assumed. Done 2026-10-15 (read-only). It found 37 places: 9 timezone, 13
      grading, 9 institution, 7 credits/term. There are no letter grades, GPA or
      pass marks anywhere, so a "scale" would be new work rather than a refactor.
      The hard-wired ones that cost most:
      - `records-write.ts:101,111`: falls back to `Asia/Almaty`, and to +05:00
        when `Intl` fails;
      - `PRESETS` and the type-to-block `WORK` routing (`grading-policy.ts`);
      - final detection by title words, in English and Russian
        (`grading-policy.ts:180`);
      - exactly two periods, split at the first midterm (`boundaryOf`);
      - plan-term seeds 30/30/40 midterm shells and writes a "Narxoz policy"
        note into the record;
      - the `narxoz.instructure.com` hint (`lms/canvas-api.ts:192`);
      - course ids and term ids fixed to `XXX-0000` and
        `YYYY-FALL|SPRING|SUMMER|WINTER`;
      - "6 credits" with no credit system;
      - a 15-week term offered as the default.

      The "professor" preference layer is read from four different paths, and
      the run layer's documented path is not the one the code reads
      (`server/preferences.js:148`).
      Same audit (timezone 9, grading 13, institution 9, credits/term 7). MOD-1
      has closed T1, T2, T5, T6, G1, G3, G6, G7 and G4 partly (the boundary rule,
      not the two-period shape). Open: T3, T4, T7-T9, G2, G5, G8-G13, I1-I9, C1-C7.
- [ ] **LNG-6** Date arithmetic in UTC. `grading-policy.ts:194`, `bundle.ts:292`,
      `outline.ts:44` and `validate.ts:1004` compare dates in UTC rather than in
      the run's timezone, so a date can land in the wrong week or period by up
      to a day at a term boundary. This is a correctness bug, not a
      configuration gap, and can be fixed before MOD-1. `S` · depends: —
- [ ] **LNG-3** Workspace-level locale and scale configuration. `M` · depends:
      LNG-1, LNG-2 · the code side is spelled out in MOD-1 (E33)
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
- [x] **DEF-4** Microphone in the pane: record per question, transcribe, save
      the audio and a timestamped transcript as part of the student's
      `oral_defense` submission. *Follow-up* asks the agent for the next
      question from what was just said. `L` · depends: DEF-3, AUD-1, LIV-2
      Done 2026-10-06 without live scoring, so LIV-2 did not have to be
      settled first. The defence desk (Students → Open defence desk) records
      each take into `~/.ainar/submissions/…/defence/answers/` and transcribes
      it in the pane's process through a `transcription` connection
      (`src/transcribe.ts`: `openai` protocol for OpenAI, Groq and self-hosted
      Whisper; `elevenlabs` for Scribe). Takes are kept, never overwritten,
      and a low-confidence stretch is highlighted. *Follow-up* appends one
      question via `/defend-submission … follow-up on Qn`. Still open: the
      session is not yet a `Submission` record with `oral_defense` format —
      that comes with DEF-5, which needs the transcript as cited evidence.
- [ ] **TRN-1** Confirm the course's transcription provider from a measured
      sample (AUD-3): ten real answers in Kazakh and Russian through Scribe
      and a Kazakh Whisper (TRN-2), word error rate counted by hand. Scribe
      (`scribe_v2`) is the default meanwhile, set 2026-10-06. `decision` ·
      depends: DEF-4
- [ ] **TRN-2** A Kazakh Whisper on a machine of our own, so voices need not
      leave campus. Candidates from Hugging Face:
      `abilmansplus/whisper-turbo-ksc2` (9.2% WER, KSC2 test),
      `olzhasAl/whisper-large-v3-tulpar` (10.6%, KSC),
      `shyngys879/kazakh-whisper-large-v3-turbo` (11.8%, FLEURS), and
      `KRASR/kazakh-russian-asr-whisper-small-full-ft` for mixed Kazakh and
      Russian. Served by an OpenAI-compatible Whisper server (speaches takes
      CTranslate2 models, so a Transformers checkpoint is converted once with
      `ct2-transformers-converter`). Nothing in ainar-node changes. Two modes,
      decided 2026-10-06:
      * **Local machine** — the server in Docker on the professor's laptop,
        `connections add whisper-local --provider openai --base-url
        http://127.0.0.1:8000/v1`, no key. Without a GPU, the turbo or small
        models only; a 1-minute answer must come back in seconds, not a minute.
      * **University server, if needed** — the same container on the
        `deploy/` host, bound to 127.0.0.1 like every harness there. Harnesses
        on that host reach it on loopback with no key and the voice never
        leaves the server; a professor whose harness runs on a laptop reaches
        it through Caddy, behind the same authentication, with a token of its
        own (`--token-env AINAR_WHISPER_TOKEN`).
      `M` · depends: —
- [ ] **TRN-3** An ordered fallback instead of one default:
      `defaults.transcription: ["whisper-local", "whisper-narxoz", "scribe"]`,
      tried in order when one is unreachable. A fallback never moves a voice
      somewhere less private without saying so: the desk header names the
      chain, and each take records the connection that actually heard it.
      `S` · depends: TRN-2

**The agentic desk: it listens, and moves on by itself**

> Dictated 2026-10-06: a mode where the system listens immediately. The
> professor starts the defence and the desk runs it: it puts a question up,
> listens, notices when the student has finished, transcribes, decides
> what to ask next, and asks it. The professor watches, and can step in
> at any point. The model that decides is the session's own: a pane plugin
> can inject the harness's `llm` service and call the session's current
> model route directly, as `dsh-session-title-llm` does. That means no chat
> turn per question, and every call is recorded in the session log.
>
> What it may decide is LIV-2's line: only the next question. The grade
> is produced afterwards from the whole recording, and the professor
> accepts it (DEF-5).

- [x] **AGT-1** Hands-free turn-taking, with no model in the loop: the
      microphone stays open, voice activity detection in the browser ends a
      take after about 2.5 s of silence following speech (or a key press, or a
      3-minute cap), the take is transcribed, and the desk advances to the
      next prepared question. On its own, this already saves pressing Record
      and Stop. `M` · depends: DEF-4 Done 2026-10-06: *Start hands-free* on the
      desk; Space ends an answer, Skip drops it, Pause keeps it and releases
      the microphone. The detector is `turnStep` in the pane's client: a
      learnt noise floor, 0.4 s of speech to start, and the first 0.8 s of a
      take ignored so the tail of the last answer is not the next one. It is
      tested in `plugins/dsh-professor-pane/test/`, and `npm run desk` there
      serves the desk alone with a scripted voice. **Known limit:** a voice
      that is not the student's counts. A professor reading the question
      aloud is heard as the answer, so hands-free asks for the question to be
      read off the screen until AGT-4 (student screen) and AGT-6 (two voices).
      With AGT-4 the student reads the question on their own screen, or hears
      it read aloud before listening starts, so the professor need not speak.
      Since AGT-6 their interjections are theirs: hold P while speaking.
- [x] **AGT-2** The model chooses the next question. After each answer it
      gets the questions, the rubric criteria, everything said so far and
      the code digest (a fixed prefix, so it is cached and cheap to resend).
      It answers: a follow-up (written), the next prepared question, or
      *done* (every criterion has evidence, or the time budget is spent), with
      one line of reason. Called through `ctx.llm.stream` on the session's
      route, `purpose: "defence-next"`. `M` · depends: AGT-1, plugin `llm`
      inject Done 2026-10-06. The pane injects `llm`, `sessions` and
      `agentDefaultModel` (each optional) and reads the route from the
      session's request header, as the title plugin does. `purpose` is left
      unset because the harness's union admits only its own two values.
      `decideNext` in `src/defence.ts` checks the reply: a follow-up goes
      through `checkQuestions` and is appended, a `next` must name a
      prepared question still to ask, and follow-ups stop two deep. Anything
      unusable, or no model at all, falls back to the next prepared question
      with a note, so the defence never stalls on the model.
- [x] **AGT-3** The professor's veto: the next question shows as *asking in
      5 s* with **Ask now · Skip · Edit · Pause**. Silence is consent; any
      press takes over. Pause stops the loop and leaves the microphone off.
      `S` · depends: AGT-2 Done 2026-10-06. Editing holds the countdown; every
      choice and override is kept in `session.yaml` under `decisions` (the
      AGT-7 record; consent is still open). A *model chooses* switch turns
      the model off, and the desk then walks the prepared questions.
- [x] **AGT-4** The student's screen: a second window, opened for the
      projector or a second monitor, showing the current question and a
      recording light, and nothing else: no draft scores, no reasons, no
      remaining questions (LIV-1). Optionally the question read aloud
      (`speechSynthesis`, or ElevenLabs voices where a Kazakh voice is
      wanted). `S` · depends: AGT-1 Done 2026-10-06: *Open student screen* on
      the desk opens `server/student-screen.js`, a page that fetches nothing and
      is told what to show over a BroadcastChannel: the question by number,
      and whether it is recording. Between questions it shows only "the next
      question is coming", since the proposal may still be edited or skipped.
      *Read each question aloud there* uses the browser's `speechSynthesis`, and
      the desk starts listening only after the screen reports it has finished
      speaking (or after a reading-time timeout). A heartbeat every 2 s tells
      the desk when the screen has been closed. ElevenLabs voices for Kazakh
      are still open.
- [x] **AGT-5** Live captions, not only at the end of an answer: Scribe v2
      Realtime over a WebSocket (about $0.39/hr), or the local server's
      streaming route. They let AGT-2 start deciding before the student
      stops, which turns a 6–10 s gap into 2–4 s. `M` · depends: AGT-2
      Done 2026-10-06, the provider-agnostic way first. A second recorder on
      the same microphone restarts every 5 s, so each piece is a whole file
      any connection reads. A piece in which someone spoke (and the professor
      was not holding P) goes to `/api/defence/caption`, and the caption
      appears under the live panel about a second after the piece ends.
      `captionAudio` needs consent, keeps nothing, and removes its temporary
      file whatever happens. The take's own transcript is still the one that
      counts. Each answer is transcribed twice (on Scribe, about $0.22/hr
      more), and a switch turns captions off.
- [x] **AGT-8** True streaming captions where the provider has them: Scribe v2
      Realtime through a single-use token the server mints, so the key never
      reaches the browser; PCM through an AudioWorklet. Captions word by
      word instead of every five seconds, and AGT-2 able to start choosing
      before the answer ends. `M` · depends: AGT-5 Done 2026-10-06, captions
      only. For each take the pane asks ElevenLabs for a single-use token
      (`POST /v1/single-use-token/realtime_scribe`, spent on connecting, void
      after 15 minutes) and hands the browser a socket URL with the token in
      it; the key stays on the server. The browser streams 16 kHz 16-bit PCM
      (a ScriptProcessor, not an AudioWorklet, which would need a module URL
      the harness may refuse) and shows partial and committed text as it
      comes. It sends silence while the professor holds P. Anything short of
      a stream (a provider that cannot stream, no key, a socket refused or
      failing) falls back to AGT-5's five-second pieces for that take.
      Tested with a mock socket on the desk test page. Not yet tried against
      the real ElevenLabs endpoint, or inside the harness, whose page may
      forbid outside sockets; the fallback covers that.
- [ ] **AGT-9** Let AGT-2 start choosing while the student is still talking:
      when a streamed sentence is committed and a pause begins, ask the
      model on the words so far, and drop the choice if the student goes on.
      Turns the 6–10 s gap into 2–4 s. `S` · depends: AGT-8
- [x] **AGT-10** A stage for the defence: the current question, one big
      button and the live transcript in the foreground, with the AI's
      questions, proposals and controls folded into a drawer at the bottom.
      The student screen shows their own words under the question as they
      speak. `S` · depends: AGT-8 Done 2026-10-06. The big button does
      whatever comes next: start hands-free, end the answer, stop a take, ask
      the proposed question, or open consent. Its dots draw a microphone at
      rest and an equalizer while listening. The drawer folds while
      recording and opens when the model proposes. A Stage/List switch keeps
      the old layout, and the choice is remembered. The student screen shows
      captions only for the question it is showing, and only while it is
      being answered. Tested on the desk test page with the mock socket.
- [x] **AGT-11** Two modes, the whole defence first. *Whole defence* (the
      default) records the whole conversation in one take and transcribes it
      live. Space or the big button marks each new question, and *Asking
      this* beside a prepared question marks that one and puts it on the
      student's screen. Pause leaves the gap out of the recording, the
      stream and the times. Once transcribed, the session's model divides
      the take into its questions, with the marks as hints, not cuts
      (`/api/defence/split`, `checkSplit`). With no model, or a reply that is
      no use, the marks alone make the split. The split is
      `approval: draft` until *These are right*. The evidence then shows each
      part under the question it asked or the criterion it was about. The
      citations stay `[Q0 take k @ s]`, so grading is unchanged.
      *Question by question* is AGT-1's hands-free mode, as before. Skip,
      Pause and hold to speak now sit in a row beside the big button, and
      the drawer strip no longer repeats them. `M` · depends: DEF-7, AGT-8
      Done 2026-10-07. Tested by unit tests (`defence-split.test.ts`) and on
      the desk test page with the scripted voice and the mock socket. Not
      yet tried with a real microphone, a real Scribe key, a real model or
      inside the harness. A Scribe realtime session's length limit is
      unchecked against a 20-minute defence.
- [ ] **AGT-12** Move a split's boundaries by hand: drag a part's start on the
      transcript, or change which question a part asked, before *These are
      right*. `S` · depends: AGT-11
- [ ] **AGT-13** Undo for Skip on the stage: "Skipped · Undo" for a few
      seconds, now that Skip sits next to End answer. `S` · depends: AGT-11
- [x] **AGT-6** Two voices, one microphone. The professor will interject, so
      diarize (Scribe has it) and keep the professor's words out of the
      student's evidence. A take where the speakers could not be separated
      is flagged, not cited. `S` · depends: AGT-1 Done 2026-10-06, two ways
      at once. **Hold P** (or the hold-to-speak button) while speaking: the
      stretch goes with the take, and the end-of-answer detector waits while
      it is held, so an interjection neither ends the answer nor starts it.
      **Scribe separates the voices** (`diarize`), and `labelSpeakers` takes
      the student to be the voice that spoke most in their own answer. When
      two voices spoke about as much (the second at 40% or more), the take is
      marked *unclear*, shown with a warning and never cited. Without
      separation (Whisper), only marked stretches are the professor's and the
      take says the rest was assumed to be the student's. `studentWords` is
      what DEF-5 must grade from, and the next-question prompt already shows
      the professor's words as `[professor: …]`. Not done: OpenAI's
      diarizing transcription model, and a local diarizer (pyannote) for
      TRN-2.
- [x] **AGT-7** Consent and the record. The defence starts only after the
      professor confirms the student agreed to be recorded, and that
      confirmation is in `session.yaml`. Every decision the loop makes
      (what it asked, why, what the professor overrode) goes there too, so
      an appeal replays the whole exchange (LIV-3). `S` · depends: AGT-2
      Done 2026-10-06. The server writes the statement from the transcription
      provider that is configured, naming it even while its key is missing, so
      the student is never told their voice stays here when it would not. The
      desk shows the statement, and so does the student's screen. Nothing
      records until the professor confirms *The student agreed*: `saveAnswer`
      refuses a take without consent and writes no bytes. *The student
      withdraws* (two steps) stops at once and drops the take in progress
      unsent. Earlier takes are kept and marked `withdrawn`, and deleting them
      stays the professor's decision. `ainar defence replay` prints the
      exchange in order: consent, each choice and its reason, overrides, and
      every take with whose words were whose. Each take now records when
      listening began (`asked_at`).
- [x] **DEF-5** The proposed grade from the whole session, by the AUD-1 path,
      as an `Evaluation` marked `approval: draft` citing transcript timestamps.
      `M` · depends: DEF-4 Done 2026-10-06. *Propose the grade* on the desk asks the
      session's model (`/defend-submission … — propose the grade`). It reads
      `ainar defence evidence`: the rubric with its levels and the student's
      own words by criterion, each marked `[Qn take k @ s]`, with the
      professor's interjections, withdrawn takes and unclear voices left out.
      `ainar defence grade --from` checks the proposal before writing. A score
      outside the range is refused, not clamped. An oral citation must be the
      student speaking in a citable take, with its quote in those words. A
      code citation must be a file of the commit read. A mark left with no
      citation has its confidence lowered. One `status: suggested` evaluation
      per criterion is written on the **homework's own submission**, under
      the id the other grading paths give that student and criterion
      (`evaluationId`), so the gradebook sees one evaluation, not two. An
      undecided suggestion is replaced; a decided one is left untouched and
      named. Whether a defence may instead be an assessment of its own is
      still ASM-1. They arrive in the inbox's pending evaluations like any
      suggestion.
- [x] **DEF-6** Batch mode: upload recordings, see the total minutes and the
      transcription cost per provider before anything is sent, then confirm.
      Each recording is matched to a student and graded as DEF-5 does.
      `M` · depends: AUD-1, AUD-2 Done 2026-10-06. Upload kind *Recorded oral
      defences* puts files in `~/.ainar/submissions/<RUN>/_recordings/`,
      renamed `rec-<sha>` like scans. The *Recorded defences* dialog runs
      `ainar defence batch` in the pane's process:
      * **plan** reads each length here (ffprobe, else the WAV or M4A header),
        matches by pseudonym, number or name with the scans' `identify`,
        holds two recordings of one student, and quotes every transcription
        connection;
      * **apply** needs the professor to confirm the students agreed, writes
        that as each one's consent, and files each recording as the student's
        `Q0`;
      * **transcribe** quotes, and sends only with `--confirm`.
      Grading is the desk's *Propose the grade*, per student.
- [x] **DEF-7** The whole defence in one recording. Dictated 2026-10-06: the
      professor presses defence, records, asks as they go, and it is all one
      audio. On the desk, *Record the whole defence* records `Q0` with no cap,
      and P still marks the professor. Such a take is never labelled by "who
      spoke most": it stays *unclear* until the professor's voice is known
      from a P stretch or from *"…" is me* on the desk, which relabels it
      with no provider call. A provider that does not separate voices
      (Whisper) leaves an unmarked whole defence uncitable, and says to use
      Scribe. The evidence shows it as the dialogue it was: the professor's
      questions for context, the student's answers citable. The same path
      serves recordings uploaded with DEF-6.
- [x] **DEF-8** The dots. Dictated 2026-10-06, from dotsui.dev: while
      listening, the desk shows `DotSwarm` from `dots-swarm` (MIT). It is a
      microphone while waiting, an equalizer that quickens with the voice
      while the student speaks, a thought bubble while the next question is
      chosen, then pause or check. It is bundled once into
      `plugins/dsh-professor-pane/vendor/` by `vendor/build-dots.mjs`
      against the harness's own React (a shared instance, or hooks break),
      loaded only when a desk opens, with nothing shown if it fails. The
      package is `0.1.0-alpha`: a rebuild after an upgrade is one command.

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

## E30 · "Connect Google": Sheets access a professor can set up alone — no `FUTURE.md` section yet

> **Rank: next after E27's SHT-3.** Raised 2026-10-10, when a harness session
> was asked to read the CSS-4007 grade sheet "with the Google Drive connector"
> and could not: a dsh session has no such connector, its sandbox blocks
> outbound TLS, and `loadCredentials` (`src/lms/sheets.ts`) found no token, no
> service-account key and no sheets connection. The stopgap shipped the same
> day: the Syncs card links Google's `/export?format=csv` in the professor's own
> browser and takes the downloaded file as a drop, checked by `sync plan` before
> it replaces the copy. That works for any sheet but is two steps every time.
> A service-account key or an access token is a developer's task, not a
> professor's.
>
> **The shape.** OAuth for an installed app: the pane opens Google's sign-in,
> Google redirects to the pane's own localhost address, and the refresh token is
> kept in `~/.ainar` (the pane's server can write there; the dsh sandbox
> cannot). Scope `drive.file` plus the **Google Picker**: the app sees only the
> sheets the professor picks, it is a non-sensitive scope (no Google
> verification and no "unverified app" screen), and it still allows the writes
> a two-way sync needs. Grades go from Google to the professor's machine with no
> server of ours in between.
>
> **Not this:** "Publish to web" links (grades become public), and one shared
> service account across installs (every copy carries a key that reads every
> professor's shared sheets).

- [ ] **GAU-1** One-time setup, as the developer: a Google Cloud project, an
      OAuth client of type "Desktop", a consent screen with a privacy-policy
      link, published **In production**. "Testing" status expires refresh
      tokens every 7 days. The client ID ships in the harness; a desktop
      client's secret is not a secret, and PKCE is used anyway. `S` · depends: —
  2026-10-13: a Desktop client exists in the *Professors Harness* project,
  consent screen in **Testing** (7-day refresh tokens), scopes still the
  service account's two. Not yet shipped in the harness: each machine reads
  `~/.ainar/google-client.json` (`AINAR_GOOGLE_CLIENT` overrides).
- [x] **GAU-2** The sign-in in the pane: a Connect button in Integrations →
      Credentials, a loopback redirect to the pane's server, PKCE, the refresh
      token saved as a `sheets` connection with an `oauth` credential in
      `connections.json` (token value in the managed store, never in the
      registry), and Disconnect, which revokes it. `M` · depends: GAU-1
      Done 2026-10-13: `src/connections/google.ts`; the pane's
      `server/google.js` answers `/api/google/{start,callback,disconnect}`
      ahead of workspace resolution; `connections add --credential oauth
      --account`, and a new `connections remove`. The redirect is always
      `127.0.0.1:<the pane's port>`, so a pane reached through Caddy or the
      Cloudflare tunnel refuses with a sentence — Connect works only on the
      machine the harness runs on until a hosted redirect exists.
- [x] **GAU-3** `loadCredentials` learns the `oauth` credential: exchange the
      refresh token for an access token, cache it until expiry, and report a
      revoked grant as "Reconnect Google in Integrations", not as an HTTP code.
      Probe support in `connections/probe.ts`. `S` · depends: GAU-2
      Done 2026-10-13: `OAuthRefresh` in `lms/sheets.ts`, cached module-wide
      by refresh-token digest; `test/google.test.ts`.
- [ ] **GAU-4** The Google Picker when a sync's sheet is set or changed, so the
      chosen sheet is the one `drive.file` grants. A sheet linked before
      connecting asks to be picked once. `M` · depends: GAU-2
- [ ] **GAU-5** The live read runs in the pane's server, not in the session.
      Check that `sync plan`/`run`, spawned by the pane, reach Google from where
      the pane runs; if the dsh sandbox blocks them too, the pane reads the
      sheet and passes `--from`. Then the Syncs card loses its download and drop
      steps whenever Google is connected (they stay as the fallback for
      universities that block third-party apps). `S` · depends: GAU-3

---

## E31 · Private files off the machine: one archive, several connectors — no `FUTURE.md` section yet

> **Raised 2026-10-13.** Everything private and heavy — scans
> (`scans.ts`), defence audio (`recordings.ts`, the desk), forks — lives only
> in `~/.ainar/submissions/<RUN>/`. Records point at it with `private://…`
> refs (`scans.ts:83`, `bin/ainar.ts:3334`), and nothing turns a ref back
> into a file anywhere but this laptop. Nothing backs it up, and a term of
> recorded defences fills a disk.
>
> **Decided with Ardak the same day.** *Archive plus on-demand:* `~/.ainar`
> stays the working copy; files are pushed to a store, a finished run's local
> copies can be evicted, and a `private://` ref is fetched back when a tool
> needs it. Offline grading keeps working and no reader changes until it
> meets a missing file. *Encryption per connector:* a flag on each
> connection, not a global default. *Connectors:* a folder, S3-compatible and
> Google Drive.
>
> **The shape.** A `storage` connection type in the existing registry
> (`connections/index.ts`): where and which variable holds the secret, never
> the secret. A driver only moves bytes (`put`, `get`, `head`, `list`);
> hashing, encryption and the manifest are ours and identical across drivers.
> Which run goes to which store is a `syncs:` entry (`service: storage`,
> `role: target`, `stream: private-files`), the same road every other
> integration takes. What was pushed, its checksum and whether it is still
> local is `~/.ainar/archive/<RUN>.json`, beside the links and the ledger.
>
> **Why Drive goes through rclone first.** Drive's API is a few REST calls.
> What costs is the token: E30's OAuth client, consent screen and loopback
> sign-in. rclone already does that sign-in (`rclone config`, scope
> `drive.file`) and the same binary covers OneDrive, Dropbox and SFTP, so
> one wrapper buys them all. The native Drive driver waits for E30.
>
> **Not this:** files under the course workspace (a OneDrive folder is a
> fine target, the workspace is not; the folder driver refuses any path
> inside it), names-bearing files on an unencrypted store, and a store as
> the only copy of something not yet verified there.

- [ ] **STO-1** `storage` connection type: `driver` (`folder` | `s3` |
      `rclone`), `path` / `bucket` + `prefix` + `region` + `baseUrl` (R2,
      MinIO, Oracle) / `remote`, `encrypt: true|false`, `keyEnv`; S3 secret
      via `tokenEnv` as now. `probe.ts` writes, reads back and deletes a
      marker object. `S` · depends: —
- [ ] **STO-2** `ainar files status|push RUN [--dry-run]`: walk the run's
      private tree, hash, upload what the store lacks, write the manifest;
      idempotent, resumable, and a `syncs:` entry names the connection.
      STORAGE.md gains `~/.ainar/archive/` in §3 and the road in §7. `M` ·
      depends: STO-1
- [ ] **STO-3** Folder driver: any mounted path — external disk, NAS, a
      OneDrive or Dropbox synced folder (which is OneDrive with no API work).
      Atomic write by rename. `S` · depends: STO-1
- [ ] **STO-4** S3 driver, native: SigV4 over `fetch`, no SDK; multipart
      above 64 MB (a scan batch reaches 200 MB). Tested against MinIO. `M` ·
      depends: STO-1
- [ ] **STO-5** Encryption, when the connection says so: AES-256-GCM in
      chunks so a 200 MB file streams, the key in the managed credential
      store via `keyEnv`, its fingerprint in the manifest so a wrong key is
      named as a wrong key. `push` refuses a names-bearing file (`_inbox/`,
      `uploads.json`, `plan.yaml`) to an unencrypted store. `M` · depends:
      STO-2
- [ ] **STO-6** One resolver: `resolvePrivate(ref)` returns a local path,
      fetching and verifying the checksum when the file is gone. `scans.ts`,
      `defence.ts`, `recordings.ts` and the pane's `scans.js` /
      `defence-desk.js` read through it. `M` · depends: STO-2
- [ ] **STO-7** `ainar files evict RUN`: drop local copies the manifest
      shows verified on the store; never an unfiled `_inbox/` item;
      `archive-run` offers it. `S` · depends: STO-6
- [ ] **STO-8** rclone driver: any configured remote — Drive, OneDrive,
      Dropbox, SFTP — through `rclone rcat` / `cat` / `lsjson`, rclone found
      on `PATH`, `doctor` saying how to install it when it is not. `S` ·
      depends: STO-1
- [ ] **STO-9** Storage in the pane's Integrations: each store, per run what
      is local, archived and evicted in bytes, and Push as the professor's
      press after a dry-run preview — student files leaving the machine is
      theirs to send. `M` · depends: STO-2
- [ ] **STO-10** Native Drive driver on E30's OAuth, for a professor who
      cannot install rclone: resumable upload, an app folder under
      `drive.file`. `M` · depends: GAU-3, STO-1
- [ ] **STO-11** Retention: `ainar files purge RUN --confirm` deletes a run's
      private files everywhere once the institution's keeping period is
      over, and writes that it did to `records/events.yaml`. `S` · depends:
      STO-2

## E32 · Background sync: Canvas and the grade sheet checked with nobody looking — no `FUTURE.md` section yet

> **Rank: with E18, sharing its scheduler.** Proposed 2026-10-14. Today every
> sync is started by the open pane: opening the Gradebook runs `lms check`
> (what Canvas holds), the pane asks every five minutes whether the grade
> sheet changed, and a send is a press. With the browser closed nothing is
> checked, so a Canvas job that finished late, a grade changed in Canvas by
> hand, or new marks in the sheet wait until the professor next opens the
> pane — and the first open after a restart costs a 20-second check. The work
> already runs on the backend (the harness server spawning `ainar`); what is
> missing is something that starts it on a schedule. It reads, and notes what
> it read; it never sends anything students see.

- [ ] **BGS-1** Where the schedule lives: the harness server while it runs on
      the professor's machine, the OS scheduler (Task Scheduler / cron calling
      the CLI), or the deployed server (`deploy/oracle`, the Cloudflare
      container) so it runs with the laptop shut. Probably all three behind one
      command, BGS-2, with the deployed server the one that matters.
      `decision`
- [ ] **BGS-2** `ainar sync tick [RUN | --all]`: one unattended pass doing what
      opening the pane does — `lms check` per run (Canvas wins where it agrees,
      hand edits reported), and for each grade-sheet sync whose watcher says
      the sheet changed, the same pull the Syncs press runs, with unsure
      matches held for the professor as they are now. Reads and local notes
      only. `M` · depends: BGS-1
- [ ] **BGS-3** The scheduler: per-run interval (default hourly) and quiet
      hours; one pass at a time per run, sharing a lock with the pane's own
      check so the two never run together; back off on a Canvas rate limit or
      Google's quota instead of retrying into it. `M` · depends: BGS-1, BGS-2
- [ ] **BGS-4** The last check kept on disk, beside the ledger in
      `~/.ainar/sync/`, not in the server's memory as `/api/canvas/check`
      keeps it now — so the pane opens on the last background result, and a
      restart costs nothing. `S` · depends: BGS-2
- [ ] **BGS-5** "While you were away": a notice in the pane like the
      grade-sheet one — *HW1: 44 marks confirmed in Canvas · Quiz 1: 2 grades
      changed in Canvas by hand · grade sheet: 5 new marks* — and the same lines
      handed to the digest (NOT-1) so they reach the phone. `S` · depends:
      BGS-4
- [ ] **BGS-6** Credentials without a browser: the Canvas token and Google's
      refresh token usable by an unattended process, from the deployed
      server's own connection registry; an expired or revoked one stops that
      run's tick and says so in the pane and the digest, once, rather than
      failing every hour. `M` · depends: BGS-1, GAU-3
- [ ] **BGS-7** Never sends: a tick runs only read actions (`lms-check`,
      sheet check and pull — `INTEGRATION_READ` in `execution.ts`) and a test
      fails if it spawns a push. Grades to Canvas and anything students see
      stay the professor's press. `S` · depends: BGS-2
- [ ] **BGS-8** Background sync in Integrations, per run: on or off, interval,
      last and next pass, and the last error in words. `S` · depends: BGS-3

## E33 · Changeable for the next professor: five seams in the code — partly [§12](FUTURE.md#12-language-and-institutional-fit), partly [STORAGE §10](STORAGE.md#10-where-the-code-differs-today)

> **Rank: before anyone outside this course is onboarded.** Proposed
> 2026-10-15, from an architecture review. The course *data* is already
> modular: a new assessment, rubric, week or grading preset is a record or an
> array entry. What is not modular is everything a course is *connected to* —
> institution, LMS, sync target — and the two places that grew by accretion,
> the CLI and the pane server. Each item below names one seam where a request
> from a professor elsewhere would today cost edits in many files. Several
> overlap existing epics and are written so they land there, not twice.

- [ ] **MOD-1** An institution / professor profile. Timezone, language,
      grading scale and the default grading presets come from workspace
      configuration instead of code: `Asia/Almaty` is the built-in default in
      four places (`model/delivery.ts:96`, `records-write.ts:101`,
      `scaffold.ts:94`, `sql/schema.sql:181`); the ВСК/РК presets are the
      shipped `PRESETS` (`grading-policy.ts:108`) and their strings appear in
      the pane (`client/gradebook.js` — "ВСК is out of 100", the assistant's
      examples); `vendor/datalayer/schema/preference_profile.schema.json`
      (scope `system | professor | course | task`) exists and nothing in
      `ainar-node` reads it. Presets become a profile's list, with ВСК the
      Narxoz profile's, not the product's. **This is the code side of
      [§12](FUTURE.md#12-language-and-institutional-fit)**: it is LNG-3 made
      concrete and should be done as LNG-3, after LNG-1 and LNG-2 have counted
      the places. `M` · depends: LNG-1, LNG-2

      The audit (2026-10-15) proposes this shape.
      - **One reader.** A new `ainar-node/src/profile.ts`, used by the CLI, the
        pane (in place of `server/preferences.js`'s own copy) and the skills
        (through the CLI). `ainar-node` has no preference reader today.
      - **Layers.** system → institution → professor → course → run → task. A
        run's own recorded values (timezone, dates) beat any default. The
        institution layer is the one that is new.
      - **Institution packs** ship with the harness, e.g. `profiles/narxoz.yaml`
        holding the ВСК/РК presets, `Asia/Almaty`, 15 weeks, the T/LT/LLT
        marks and the id pattern. A workspace opts in with
        `institution: narxoz`, so ВСК stops being the product's default.
      - **Keys:**
        - `locale.{language, ui, reply_language, timezone, week_start, lexicon}`
        - `calendar.{terms, teaching_weeks, meetings, periods}`
        - `credits.{system, default, hours_per_credit}`
        - `grading.{presets, default_preset, scale, rounding, final_matchers}`
        - `marking.{late_marks, defence.partial_factor}`
        - `display.bands`
        - `ids.course_pattern`, `print.page_size`, `lms.canvas.base_url`,
          `homework.github_org`
      - **Carrier.** `preference_profile.schema.json` can carry the scalar
        keys. It needs three changes:
        - an `institution` value in `scope`, which forks the vendored schema;
        - a resolver that merges nested objects;
        - a structured file of its own for `grading.presets`, because the
          pane's option walker cannot edit arrays.
      - **Order.** Do the six costly hard-wired items first: the timezone
        fallback, `PRESETS`, final detection, `boundaryOf`, `DEFAULT_MARKS`
        (already overridable per run) and the plan-term 30/30/40 seed. Pane UI
        strings are a separate, larger i18n job and stay out of MOD-1.
      **Done on `claude/mod1-profile-89c00e` (2026-10-15).** `profile.ts`
      (resolver, six layers, `ainar profile`); `profiles/narxoz.yaml`; neutral
      `locale.timezone`, `grading.{final_matchers, period_boundary, presets}`
      and `marking.defence.partial_factor` in the system defaults; the timezone
      sites, `PRESETS`, `isFinal`, `boundaryOf`, `DEFAULT_MARKS` →
      `defaultMarks()` and the defence "partly" factor read the profile; the
      pane's run layer now lives at `versions/<TERM>/preferences.yaml`.
      **Transition:** a workspace that names no `institution:` gets `narxoz`
      (`LEGACY_INSTITUTION`, reported as `legacy-default`) so the course is
      unchanged; the course workspace should add `institution: narxoz` to its
      professor preferences, then the constant goes.
      **Left:** the plan-term 30/30/40 seed and other skill prose (G10, G11,
      T7, T8, C3, I2, I7: skills must call `ainar profile`); `sql/schema.sql`
      and the three vendored schema timezone defaults; `calendar.*`,
      `credits.*`, `locale.{lexicon,week_start}`, `display.bands`,
      `ids.*`, `print.page_size`, `lms.canvas.base_url`, `grading.scale` and
      `rounding` keys (unread today); `grading.default_preset`; scaffold's
      `language: [en]` / credits 6; the persona slot (L1); T9 run-zone date
      arithmetic; the pane's own Narxoz example strings (G9, L14). UI-string
      i18n (L7) stays out. A professor-layer edit mid-session reaches the CLI
      on its next call and the pane on its next request.
- [ ] **MOD-2** An LMS adapter interface. Targets are a closed list
      (`lms/index.ts:74`) and `lms/command.ts` (2,200 lines) branches on
      `"canvas-api"` and its siblings throughout; Canvas keys are read straight
      from `extensions.lms`; `validate.ts:1509–1560` re-declares the target list
      and the sheet-tab helpers on purpose. Extract one interface — plan,
      directory, push, check, assignment link — with Canvas and Sheets as its
      first two implementations, and let the validator ask the registry instead
      of copying it. Moodle (INT-7) then becomes one new file. Shares its ledger
      half with INT-2 and should be done with it. `L` · depends: INT-1
- [x] **MOD-3a** One road for grade arithmetic in the pane (2026-10-15).
      `server/students.js` recomputed weighted standing beside `gradebook.ts`;
      it now reads `finalRange(payload, student)` from `gradebook.ts`, which
      derives floor, ceiling, open and pace from the payload's own `totals`
      (kept out of the payload, which the golden fixtures hold to Python). The
      two hand-kept assessment-type tables (`students.js`, `grading-view.js`)
      had drifted — one listed `homework`/`lab`/`midterm`/`final`, which the
      model never allows, the other lacked `oral_defense` — and are now
      `ASSESSMENT_KINDS` in `src/assessment-kinds.ts`, keyed by the model's
      `AssessmentType`. Tests: `test/final-range.test.ts`.
- [x] **MOD-3b** One road for writes from the pane. Some spawn `ainar`, others
      call core functions in-process (`grading-writes.js`, `plan-writes.js`).
      Pick one per kind of write and say why; the record-edit path is likely
      the right one for small field edits, the CLI for anything that pushes.
      `S`–`M` · depends: —
      *Done 2026-10-16.* The rule is the header of
      `plugins/dsh-professor-pane/server/run-record.js`: a field of a record
      goes through `record-edit.ts` in process; anything that reaches past
      this machine or runs long spawns the CLI; a file that is not a record is
      written by the module that owns it. The four run-record writers that
      opened `version.yaml` with their own YAML code (`lms-writes.js` ×3,
      `grading-writes.js`) now go through `editRunRecord` — byte-identical
      output on copies of the real and the sample record, and the grading
      smoke test's final record identical but for timestamps. Two findings,
      both open: re-emitting the document re-wraps long lines, so one Canvas
      setting rewrites ~40 lines of the real `version.yaml` (it did before
      too; `record-edit.ts` wants a narrower nested edit); and clearing a key
      under an absent `extensions` threw — `clearIn` now guards it.
- [ ] **MOD-4** A command registry for the CLI. `bin/ainar.ts` is ~4,900 lines:
      a hand-written `HELP` string and a 46-case `switch` with whole subsystems
      inline (`defence` ~690 lines, `scans`, `roster`, `publish`,
      `import-paper`). Each command becomes a module exporting its name, help
      and `run(args)`, as `lms`, `connections` and `sync` already half do; help
      is generated from the registry. The same move for the pane's `index.js`
      (~75 `if (path === …)` branches, integration setup and the defence flow
      inline) — a route table of handlers in `server/`. Only three tests spawn
      the CLI today; the registry is where a smoke test per command becomes
      cheap. `L` · depends: —
      *The pane half is done (2026-10-16):* `server/router.js` is the table,
      the routes are `server/routes/<area>.js`, and `index.js` is the plugin
      plus a dev reload, so a server edit needs no harness restart. The CLI
      half is open.
- [ ] **MOD-5** One collection registry. A new record type is edited into
      `model/*.ts`, `bundle.ts` `COLLECTION_SCHEMAS`, `loader.ts` `COLLECTIONS`,
      `schema.ts` `SCHEMA_MODELS`, `validate.ts` `ID_FIELDS`, `sqlgen.ts`,
      `sql/schema.sql`, and the vendor JSON Schema by hand — which already
      drifts from zod (`vendor/datalayer/schema/README.md`). One declaration
      per collection (model, file globs, id field, table) from which the rest
      derive, and `ainar schema` able to regenerate the vendor JSON. **Lands
      before the loader half of [STORAGE §10](STORAGE.md#10-where-the-code-differs-today)**
      (`approval` on Concept/Module, `generated.yaml`, `publications`,
      `provenance` everywhere), since each of those is otherwise another
      eight-place edit. Sync targets have the same shape in miniature —
      `RUNNABLE_SYNCS` in `validate.ts:1689` copies `sync/command.ts`, and
      `sync/registry.ts` hard-codes Canvas and Sheets — and fold into MOD-2's
      registry. `M` · depends: —
      *Registry done 2026-10-16:* `ainar-node/src/collections.ts` declares
      each collection once — model, files, id field, entity name, whether an
      agent may write it — and `bundle.ts`, `loader.ts`, `schema.ts`,
      `approval.ts` and `validate.ts` derive their tables from it under the
      names they always had. The two id tables had drifted; the duplicate
      check now covers `rubrics`, `item_models` and `item_responses` too
      (neither course has duplicates). Golden, the 98 mutations and
      `validate` on both courses unchanged; `test/collections.test.ts` holds
      the registry to the models and the vendor files. **Still open:** the
      vendor JSON regeneration (`ENTITY_NAMES` is the half `ainar schema`
      needs; the envelope and `preference_profile` are not done), and
      `sqlgen.ts`/`schema.sql`, which stay hand-written by design.

## E34 · Long work in the background and queued, and pages that open at once — no `FUTURE.md` section yet

> **Rank: before the next exam pile.** Proposed 2026-10-22. Reading a pile of
> scans (`scans read` + `scans record`) and transcribing recorded defences
> (`defence batch transcribe`) each hold one HTTP request open for up to 30
> minutes (`routes/scans.js:69`, `routes/defence.js:93`, through `runScans`
> in `server/actions.js`). The server itself is not blocked — the CLI is an
> async child process — but the *page* is: the scans view sets `busy` and
> every other step's button goes dead (`client/scans.js:31`), the defence
> batch dialog cannot be closed while it runs (`client/upload.js`), and a
> reload or a second tab forgets that anything is running. What actually
> keeps two writers apart today lives only in that client state; the server
> holds no lock. Separately, pages in the pane are slow to appear after a
> click, cause not yet measured. Added 2026-10-22: work that conflicts waits
> in a queue rather than being refused, and the runner accepts only known
> kinds of job from the pane (JOB-8 – JOB-11).

- [ ] **JOB-1** What is secured, written down. One table: every pane action
      that writes the private folder or the run's records, what it rewrites
      (one student's transcript, the whole plan, `version.yaml`, a take), and
      what keeps a second writer out today — client `busy`, the placements
      queue (`client/scans-queue.js`), nothing. Mark which pairs really
      conflict (read vs. apply rewriting the same plan) and which are only
      blocked because the button shared a `busy` (read vs. opening the
      grading cards, vs. another assessment's pile, vs. the gradebook). This
      decides JOB-2's lock keys. `S` · depends: —
- [ ] **JOB-2** A server-side job runner. `POST` starts the job and returns a
      job id at once; the CLI child runs on in the harness process; `GET
      /api/jobs` lists running and recent jobs with their progress and
      output. Locks are per key from JOB-1 (e.g. `scans-plan:<run>:<assessment>`,
      `defence:<run>:<assessment>`), held by the server, so a second tab or a
      reload sees the same lock and a conflicting press is refused with
      "Reading is running for Quiz 1" instead of being raced. `M` · depends:
      JOB-1
- [ ] **JOB-3** Progress, not a spinner. `scans read` and `defence batch
      transcribe` print a line per student/take; the runner turns those into
      *12 of 48 read* and the pane shows it in the step strip and the
      navigator, and on reopening the page. Finished jobs say what they did
      (the same `readSummary`) and bump the revision so the views refresh.
      `S` · depends: JOB-2
- [ ] **JOB-4** The pane un-blocked. Only the presses JOB-1 marks as
      conflicting wait for a running job; everything else — other steps,
      grading cards, another assessment, other pages — stays usable. The
      defence batch dialog closes while transcription runs on. The live
      per-take transcription on the desk (`routes/defence.js:352`) stays
      inline: it is seconds, and the desk needs the text back. `S` · depends:
      JOB-2
- [ ] **JOB-5** Survive a restart. A job's state is kept on disk under
      `~/.ainar/jobs/`; a harness restart marks a running job as interrupted
      (its partial transcripts are already on disk — `scans read` writes per
      student) and offers "continue", which re-runs only what is missing.
      Cancel kills the child. `S` · depends: JOB-2
- [ ] **JOB-6** Measure why pages load late. Time each page from click to
      drawn: the server-side cost of each `/api/*` read (bundle load and
      validation per request, `loadedRun`, scans status walking the private
      folder, `lms check` on Gradebook open), the client waiting on more than
      one fetch in series, and the revision tick refetching everything. A
      table of the five slowest, with the cause of each. `S` · depends: —
- [ ] **JOB-7** Fix what JOB-6 finds. Likely candidates: cache the loaded
      bundle per run keyed by file mtimes instead of reloading per request;
      draw the page from the last answer while the fresh one loads
      (stale-while-revalidate, as `client/data.js`'s watcher half does);
      fetch a page's reads in parallel; move anything that calls out
      (`lms check`) behind the page, not in front of it. Target: a page
      shows something within 300 ms of the click. `M` · depends: JOB-6
- [ ] **JOB-8** Queued, not refused. A press that conflicts with a running job
      (JOB-1's lock keys) joins that key's queue instead of being turned away:
      *Apply placements — waiting for Reading (Quiz 1)*. Jobs on one key run
      one after another in the order pressed; jobs on different keys run side
      by side up to a cap (default 2 CLI children, so two piles do not fight
      for the machine or the model's rate limit). The queue is in the job
      page and the navigator: waiting, running, done, with cancel on a
      waiting job and on a running one. Replaces JOB-2's "refused" for
      everything except a press of the very job that is already queued,
      which is a no-op. `M` · depends: JOB-2
- [ ] **JOB-9** The queue survives. Waiting jobs are written to
      `~/.ainar/jobs/` with the running ones (JOB-5), so a restart resumes
      the queue in order rather than dropping it; a job whose inputs changed
      while it waited (the plan it would apply was rewritten) is held with
      the reason in words, not run on stale data. `S` · depends: JOB-5, JOB-8
- [ ] **JOB-10** Secured: only known work, only from the pane. The runner
      takes a job *kind* from a fixed table (`scans-read`, `scans-record`,
      `defence-transcribe`, `sync-tick`, …) with checked arguments, never a
      command line, so nothing a page, a file or the assistant writes can
      start an arbitrary process. `POST /api/jobs` needs the pane's per-start
      token and a same-origin request; a job runs with the harness's own
      sandbox roots (see the DSH note on fixed roots) and writes only under
      its run's folders. Kinds that send anything students see (Canvas push,
      publish, Telegram) are not queueable at all — they stay the professor's
      press, as BGS-7 holds for background sync. Every job's start, finish,
      cancel and who pressed it go to `records/events.yaml`. A test fails if
      an unlisted kind or a send kind is accepted. `M` · depends: JOB-2
- [ ] **JOB-11** One runner for everything long. Background sync's tick
      (BGS-2/BGS-3) and E18's scheduled digest enqueue into this runner as
      ordinary jobs instead of keeping a scheduler and a lock of their own,
      so a scheduled tick and a professor's press on the same run wait for
      each other. `S` · depends: JOB-8, BGS-2

## E35 · Exam grading as one designed process, upload to close — no `FUTURE.md` section yet

> **Rank: after E34, before the next exam pile.** Proposed 2026-10-22. Every
> piece of grading an exam exists (E28, E29, integrity cases, exam reports,
> the Canvas push), but the process they make up is written down nowhere. The
> Scans view's seven-stage strip — identify, match, read, rubric, grade,
> approve, canvas — is a hardcoded array (`stagesOf`, `server/scans.js:160`)
> with a `switch` for the headline (`nowOf`, `:266`). Importing the questions,
> checking reads, moderation, reports, feedback and integrity sit outside it,
> and the assistant learns the order from prose in three skills
> (`import-assessment`, `grade-scans`, `grade-batch`).
>
> **The process, as proposed.** Nine stages, each with an owner, what it
> reads, what it leaves behind, and what counts as done:
>
> | Stage | Who | Done when |
> |---|---|---|
> | 1 Intake | professor uploads; assistant names the assessment and variants | the pile is filed under an assessment the professor confirmed |
> | 2 Paper | assistant (`/import-assessment`) | items and key exist, accepted |
> | 3 Split & match | pane; professor at the Match desk | every paper is placed or set aside |
> | 4 Read | pane job (E34) | every placed paper has a transcript |
> | 5 Check reads | professor, low-confidence answers only | no answer below the threshold is unconfirmed |
> | 6 Rubric | assistant proposes (GRA-11); professor picks | each question has an accepted rubric or is points-only |
> | 7 Mark | professor, by question, over the assistant's groups | every answer has a `professor_decision` |
> | 8 Moderate | professor (a second marker once E20 exists) | the sample is reviewed, borderlines looked at |
> | 9 Release | pane, previewed | gradebook, Canvas, reports and feedback sent, or held on purpose |
>
> Integrity is a **side lane**, open from any stage, never a step in the line:
> opening a case holds that one student's mark and nothing else. **Close**
> after release feeds item analysis to E24's question bank and notes to
> `/course-reflection`.
>
> **Going back is part of the design.** A misread corrected at stage 5 after
> marking, or a rubric changed at stage 7, marks every later result that
> depended on it as stale, and the strip shows the earliest stale stage — it
> does not pretend the line only runs forward. GRA-13 already does this for
> rubric changes inside one view.
>
> **The press stays honest under bulk.** Review of AI output is weaker than it
> looks: expert reviewers accept wrongly harsh decisions more readily when told
> an AI made them, and errors are missed more when many answers are reviewed at
> once (both under Sources in WF-1). "Accept all" stays (decided 2026-10-02),
> but stage 8 is where that is paid for.

- [x] **EXM-1** The process written out: the table above as a page in `docs/`,
      every stage with its CLI command, pane route, skill, records read and
      written, and done-rule, taken from what the code does today. Corrections
      to the table come from writing it. Done 2026-10-22:
      [`docs/EXAM-GRADING.md`](docs/EXAM-GRADING.md). It corrects three
      things: Mark is one stage (the strip's Grade and Approve finish on the
      same press); Paper must gate Read (Read passes with zero expected
      answers); "done" must mean released — the strip ends on a clean Canvas
      ledger whatever reports, feedback or open integrity cases say. `S` ·
      depends: —
- [ ] **EXM-2** Stage 5, Check reads: a queue of the answers `scans read` was
      least sure of, sorted by confidence, each card with the crop (GRA-6) and
      the text, confirm or fix (GRA-7). The strip does not reach Rubric until
      the queue is empty or the professor skips it on purpose. `M` · depends:
      GRA-6, GRA-7
- [ ] **EXM-3** Stage 8, Moderate. A sample drawn by the pane — the top and
      bottom of each question's spread, every paper within a point of a grade
      boundary, every group accepted in bulk — shown **without** the
      assistant's suggestion first; the professor marks, then sees the
      suggestion and where they disagree. Recorded as the moderation of that
      assessment, with the disagreement rate. `M` · depends: GRA-8
- [ ] **EXM-4** A harsh-mark check before release: every answer the
      professor scored below the assistant's group suggestion *and* below the
      group's mean is listed once, since that is the error reviewers miss
      most. `S` · depends: EXM-3
- [ ] **EXM-5** Stale stages: a change upstream (transcript, rubric, key,
      variant) marks dependent decisions stale, and the strip and the Grade
      view say which and how many. Re-mark in one press, as GRA-13 does for
      rubrics. `M` · depends: WF-3
- [ ] **EXM-6** Release as one previewed stage: gradebook diff, Canvas plan,
      reports and feedback drafts (GRA-9) side by side, sent together or
      each held. Folds in GRA-8. `M` · depends: GRA-8, GRA-9
- [ ] **EXM-7** Close: per-item difficulty and discrimination to E24, the
      moderation numbers and the rubric changes to a dated note
      `/course-reflection` reads. `S` · depends: EXM-3, E24
- [ ] **EXM-8** `decision` Which stages a course may turn off (Check reads on
      an all-choice quiz, Moderate on a 5% quiz), and whether moderation can
      ever be skipped on a final exam. · depends: EXM-1
- [ ] **EXM-9** Re-expressed in E36: exam grading is the first process the
      definition carries, and the Scans strip is drawn from it. `M` ·
      depends: WF-3

## E36 · Every process as data, drawn by one UI and read by the assistant — no `FUTURE.md` section yet

> **Rank: research first, then E35 as the first case.** Proposed 2026-10-22.
> The pane runs at least nine multi-step processes — exam grading, oral
> defence, homework forks, roster and Canvas syncs, publish, term planning,
> materials, onboarding, course readiness — and none shares machinery: the
> Scans strip is one hardcoded array, the defence desk keeps a local `phase`,
> readiness is a checklist, the rest are a button and a route. Each new
> process means a new strip, a new "what's next" headline, and another
> paragraph of order inside a skill for the assistant to follow.
>
> **What the research says, short.** WF-1 writes it out with sources.
>
> - *Fixed flow or case.* BPMN models predictable work as a flowchart; CMMN
>   models knowledge work as a **case** — a case file, tasks that become
>   available when their conditions hold, and discretionary tasks the worker
>   chooses at run time. Teaching is the second kind: the professor decides
>   the order more often than the process does. So the model is a case file
>   (the run's records) plus stages that *become available*, not a line
>   that forces the next box.
> - *State is derived, not stored.* Statecharts (XState) are the clean way
>   to drive a stepper UI, but storing "current step" beside the records
>   would make a second truth. The stage is computed from the records, as
>   `stagesOf` does and as "approval is a field" decided for drafts.
> - *Long waits on a person.* Durable-execution engines (Temporal; LangGraph's
>   `interrupt`; Cloudflare Workflows' approvals) pause a run until a human
>   answers and survive restarts. Here the wait is already durable — it is
>   the files — so only the long machine steps need a runner, which is E34.
>   No engine is adopted.
> - *Where the human goes.* Put a checkpoint where the cost of an error is
>   higher than the cost of a person; route by confidence so only the unsure
>   cases are reviewed; review in groups with bulk actions; record what the
>   AI proposed, what the person changed, and who pressed. E28 already
>   does all four for marks; the definition makes them a property of every
>   process.
> - *AI-drawn interfaces.* Generative-UI specs (A2UI, carried over AG-UI)
>   let an agent describe a view in JSON that the app renders from its own
>   component catalog, validated before it is drawn. The safe half of that
>   applies here: the assistant may *propose* a process or a view as data
>   against a schema; it never writes pane code or HTML.
>
> **The line does not move.** A process definition says who acts at each
> stage. It never makes an assistant stage write a `professor_decision`, and
> it never runs an outward step (Canvas, Telegram, a report) without the
> professor's press. The definitions live in the harness, not in a course
> workspace.

- [x] **WF-1** Research note in `docs/`: BPMN vs CMMN and case management,
      statecharts for UI flows, durable execution and human waits (Temporal,
      LangGraph interrupts, Cloudflare Workflows), human-in-the-loop review
      patterns and approval fatigue, automation bias in AI-assisted grading,
      university marking and moderation practice (blind vs open second
      marking, check marking, sample moderation), and generative-UI specs
      (A2UI/AG-UI). Each ends with what it means for this harness. Sources
      cited. Done 2026-10-22: [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) —
      a case, not a flowchart; state computed, never stored; no workflow
      engine; bulk acceptance owes a blind sample. `S` · depends: —
- [ ] **WF-2** The schema: a process is YAML in the harness
      (`ainar-node/processes/<id>.yaml`) with stages, each giving `actor`
      (`pane` | `assistant` | `professor`), `available_when` and `done_when`
      as predicates over the run's records and private folder, `action` (a
      CLI command for the pane, a `/skill` prompt for the session, a view to
      open for the professor), `gate` (needs a press), `outward` (leaves the
      machine), `optional`, and what makes a later stage stale. Side lanes
      and discretionary stages are first-class. A JSON Schema validates it.
      `M` · depends: WF-1
- [ ] **WF-3** The engine: one function `processStatus(run, process, scope)`
      returning each stage's state (unavailable, available, running, waiting
      on whom, done, stale) and the one headline "now" — the general form of
      `stagesOf` and `nowOf`. Golden test: on the CSS-4007 Quiz 1 run it
      gives the same strip `stagesOf` gives today. `M` · depends: WF-2
- [ ] **WF-4** One strip component in the pane, drawn from WF-3, used by the
      Scans view first and then by any process: stages, the "now" card with
      its action, side lanes, stale markers, and where a running job (E34)
      is. `M` · depends: WF-3, JOB-2
- [ ] **WF-5** The assistant reads it: an MCP tool `process_status` on the
      course model, so a skill asks "where is this assessment and what is
      mine to do" instead of carrying the order in prose. The skills keep
      the judgement and lose the sequence. `S` · depends: WF-3
- [ ] **WF-6** Every stage waiting on the professor, across every process
      and run, feeds one list — the same list as E15's to-do and
      `/action-inbox`, and E18's notices. `M` · depends: WF-3, E15
- [ ] **WF-7** Port the others one at a time, each a definition plus a
      golden test, retiring its ad-hoc state: oral defence, homework forks,
      publish, roster sync, term planning, onboarding, readiness. Stop when
      one does not fit, and change the schema rather than special-casing.
      `L` · depends: WF-4
- [ ] **WF-8** Per-course settings, not per-course files: a course turns
      optional stages on or off (EXM-8's answer, double marking once E20
      exists) from the pane. The professor never edits YAML. `S` · depends:
      WF-7
- [ ] **WF-9** The assistant drafts a process: told "for the project I want
      a proposal, a check-in, a demo and peer review", it writes a definition
      against WF-2's schema, validated before it is shown, drawn as a strip
      for the professor to accept. Generate, validate, then draw — never
      code. `M` · depends: WF-7
- [ ] **WF-10** `decision` Whether a process definition belongs to the
      harness only, or a course may carry its own once WF-9 exists. · depends:
      WF-9

---

## E37 · Today: the landing, and every action with one home — no `FUTURE.md` section yet

> **Rank: high — it is the first screen.** Proposed 2026-10-23 from
> [`docs/PROFESSOR-JOURNEY.md`](docs/PROFESSOR-JOURNEY.md) §10–§11, which
> lists the portal's ~50 actions and where each should start. The centre opens
> on a chat's empty page; the professor's three questions on arrival — *where
> are we, what is waiting on me, what goes out next* — are spread between the
> navigator and places they have to open.
>
> **The shape.** Sorted by what triggers them, the actions fall into four
> kinds: the calendar (~20%), something waiting (~30%), curiosity (~30%),
> rare setup (~20%). So the landing is **Today**, three bands and nothing
> else:
>
> - **Now** — this week, today's meetings, the next thing due or going out;
>   its content changes with the phase of the term.
> - **Waiting** — one list across every kind, ordered by urgency, with snooze.
> - **Pulse** — counts that open a place: concepts below threshold, concepts
>   with no evidence, the hand-in rate, and the **sync strip**.
>
> Every action has exactly one home — a week, an assessment, a student, the
> concepts, or Course settings. Today never hosts an action; it surfaces one,
> as a link into its home, when its trigger fires. The chat's field at the
> foot of every place becomes a **command field**: it matches actions and
> objects first and hands anything else to the assistant with the place as
> context.
>
> **The line does not move.** Today and Pulse only read. Nothing outward runs
> without the professor's press after a preview; the sync rules stay in
> `ainar sync`. The Concepts grid is private, follows Names / Pseudonyms, and
> never reaches a page a student sees.

- [x] **HOME-1** The `today` document: one host read that assembles what the
      navigator, `action_inbox`, `week-status`, the syncs document and
      `class_progress` totals already carry. It picks fields and computes no
      new figure, as `/api/navigator` does. Done 2026-10-23:
      `server/today.js` behind `GET /api/today` — Now (the navigator's week,
      next due, the phase from the run's dates), Waiting (week gaps this week
      and next, suggested marks, held papers, unsure sync rows, Google
      reconnect, drafts by collection, open integrity cases, class signals —
      one urgency order), Pulse (concepts under Evidence's 60%, concepts with
      no evidence, the last hand-in, one sync chip per service). Each band
      fails alone. `M` · depends: —
- [x] **HOME-2** Today as the landing: the centre opens on it, not on the
      empty chat page; the chat's field stays at its foot. Done 2026-10-23:
      `client/today.js` as course mode's first view and the navigator's first
      place; a chat with nothing asked in it opens on Today once per session
      (`pane.js`), a chat with messages stays a chat. Every row and tile opens
      its place — Grade and Scans over course mode, the rest as views.
      Since RIBBONS R10 (2026-10-23), × and Escape return to Today from any
      other place and close course mode only from Today. `M` · depends:
      HOME-1
- [ ] **HOME-3** The phase, computed from the run's dates and records, never
      stored: *before term* (Now is a readiness list — T1, T4, T7),
      *teaching* (this week), *closing* (the close checklist, EXM's Close at
      run level), *after* (reflection). `S` · depends: HOME-1
- [ ] **HOME-4** Waiting as one list across kinds — marks suggested, papers
      held, drafts, states marked `needs_review`, unsure sync rows, expired
      accounts — in one urgency order: overdue → due today → blocks students
      → blocks the assistant → the rest. An item leaves when the records say
      it is done. Until WF-6 / TODO-6 exist it merges today's sources; then it
      reads them. `M` · depends: HOME-1
- [ ] **HOME-5** Snooze: "not until <date>" on a waiting item, kept with the
      run's private state, not on the record. Not TODO-10's postpone, which
      moves a date students see. `S` · depends: HOME-4
- [x] **HOME-6** The sync strip: one chip per service (Canvas, Sheets,
      GitHub, Telegram) — last run, direction, waiting count, an expired
      warning — from `server/syncs.js`. **Sync all** opens one preview of
      every road, grouped by service and direction, then one Send for
      everything outward, through `ainar sync … --confirm`. BGS-4 makes
      "last run" true without a press. Done 2026-10-23: the strip is on
      Today (HOME-1). `server/sync-all.js` behind `POST /api/sync-all` asks
      Canvas (`canvasSyncAll`'s fresh check) and every grade sheet (`sync plan
      --json`, the downloaded copy when Google cannot be read) at once, and
      answers *comes in* / *goes out — students see it* / *left for you* /
      *not in Sync all*; one Send does the previewed Canvas rows and the
      sheets that move. Starter repositories, announcements and hand-ins
      stay per item and are named as such. The preview was run on CSS-4007
      (9 s); **the Send has not been pressed** — it would send 107 marks.
      `M` · depends: HOME-1
- [x] **HOME-7** Sync out of settings: Course settings keeps connect,
      reconnect and which roads exist; Preview / Run / the waiting rows move
      to the view the strip opens. Course mode's header line opens the same
      view. Done 2026-10-23: course mode's **Sync** view (also a navigator
      place) holds Sync all, Canvas differences (without their own Sync all),
      the class list, each grade sheet's Preview / Run and the names to
      confirm. The Canvas and Sheets cards say where it went and link there;
      without a Sync view to point at (`onOpenSync` absent) they draw their
      syncs as before. The GitHub card keeps its per-homework push — a
      publication, not a sync. `S` · depends: HOME-6
- [x] **HOME-8** The Concepts grid as the Concepts place: concepts down,
      students across, coloured by the six `concept_state` values, the
      evidence count in each cell, a row for `concepts_with_no_evidence`,
      filters by subgroup, week, state and low evidence. A cell opens the
      items and marks behind it. Check first that `class_progress` carries
      per-student cells; if not, extend it in `progress.ts`, not in the view.
      Done 2026-10-23: `class_progress` already carried them, so nothing in
      the model changed. `server/concepts-grid.js` (`/api/concepts-grid`,
      `/cell`) adds the teaching week, the subgroup and — in Names mode — the
      name; `client/concepts.js` draws it. On CSS-4007 no `concept_state` is
      recorded (0 of 5,427 cells), so the colour is the evidence's mean in
      the dashboard's five bands, a dot marks a recorded state, pale is one
      piece of evidence, dashed is none. Filters: All / To revisit (under
      60%) / Not assessed, week, subgroup, find a student. A cell opens each
      piece of evidence — assessment, criterion, score; a row opens the
      class's spread and who is under the line, with *Ask why*
      (`/find-gaps`) and *Plan a revisit* (`/prepare-lesson`); a column opens
      the student's concepts, weakest first, with *Write a report*
      (`/student-report`). Names / Pseudonyms and the drafts switch apply.
      `M` · depends: —
- [x] **HOME-9** Three doors into the grid: a student's column from Students
      (replacing `/student-dashboard` as the only way to see one student's
      concepts), a concept's row from a week's concept chip, and Evidence's
      week. Done 2026-10-23: *Concepts* in a student's opened row on
      Students; every concept chip on Teaching and All weeks (a word only
      under Preview as student); *By student* under a week's concepts in
      Evidence. All three are one message, `kind: "concepts"`. `S` ·
      depends: HOME-8
- [ ] **HOME-10** The Pulse band: concepts under the threshold, concepts with
      no evidence, the hand-in rate of the last thing due, and the sync strip
      — each a count that opens its place. `S` · depends: HOME-6, HOME-8
- [ ] **HOME-11** The action catalogue as data: PROFESSOR-JOURNEY §9's table
      as a file in the harness — id, the words a professor would type, the
      home it opens, whether it is outward. Today and the command field read
      it, so an action's home is declared once. WF-2's stage `action` points
      into it. `S` · depends: —
- [ ] **HOME-12** The command field: the foot field matches the catalogue and
      the run's objects ("sync canvas", "week 7", a student, "release quiz
      3") as the professor types, Enter opens the match; no match goes to the
      session carrying the place as the context packet. `M` · depends:
      HOME-11, UI-1
- [ ] **HOME-13** The navigator: *Tasks* becomes *Waiting* and opens HOME-4's
      list in full; Course settings stays at the foot. `S` · depends: HOME-4
- [x] **HOME-14** `decision` Is Today a place in the navigator beside Weeks,
      or what course mode opens on when no place is asked for? Decided
      2026-10-23: both a place (first, above Weeks) and the landing of an
      empty chat; course mode's own default reading is unchanged. · depends: —

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

**Before a second professor:** MOD-3a is done (2026-10-15); MOD-3b and the
MOD-5 registry are done (2026-10-16), so the STORAGE §10 loader work is now a
one-place edit per collection. Then MOD-1 now that LNG-1 and LNG-2 have run
(LNG-6, the UTC date bug, is small and can go first). MOD-2 and
MOD-4 are large and wait for the request that needs them (a second LMS; a
command that cannot be found in `bin/ainar.ts`).

**Processes (E35, E36):** EXM-1 and WF-1 are both `S` and can run before any
code — together they settle whether E36's schema is worth building or E35 is
better done in the Scans view alone. If it is: WF-2 → WF-3 (golden on Quiz 1)
→ EXM-9, then the other processes one by one.

**The landing (E37):** HOME-14 first (an hour), then HOME-1 → HOME-2 → HOME-6
and HOME-8 — each worth having if the rest never lands. HOME-4 grows into
WF-6 rather than competing with it.

**Deliberately not now:** INT-6, INT-7, INT-9, EVA-3, GRD-4, MAT-5, DEP-2.
Each waits on a real user asking for it. If one is started anyway, the question
to answer first is who asked.
