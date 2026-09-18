# Backlog

[`FUTURE.md`](FUTURE.md) argues the direction. This is the same thirteen aspects
cut into work items, so they can be ordered, cut, or handed to somebody.

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
      evidence identifiers cited, timestamp. `ainar-node/src/drafts.ts` holds
      the draft contract. `S` · depends: —
- [ ] **PRV-2** Skills write it. One shared template line rather than forty
      bespoke ones. `M` · depends: PRV-1
- [ ] **PRV-3** `approve` carries it onto the promoted record rather than
      dropping it — `ainar-node/src/approve.ts`, around `approveDrafts` and
      `writeRecords`. `M` · depends: PRV-1
- [ ] **PRV-4** A validator check: a promoted record either carries provenance
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

- [ ] **EVA-1** Record the outcome at `ainar approve`: promoted unchanged,
      promoted edited, rejected — with the draft's provenance beside it. `M` ·
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
