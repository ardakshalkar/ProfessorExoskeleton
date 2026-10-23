# Grading an exam, upload to close

[`BACKLOG.md` EXM-1](../BACKLOG.md#e35--exam-grading-as-one-designed-process-upload-to-close--no-futuremd-section-yet).
What the code does today when a pile of paper exams is graded, stage by stage,
with the parts the process is missing marked as gaps. Written 2026-10-22 from
the code at `9f59580`; when the code and this page disagree, the code is right
and this page is stale.

[`PIPELINES.md`](../PIPELINES.md) tells the same story without file paths;
[`docs/WORKFLOWS.md`](WORKFLOWS.md) is the research on how to turn this into
one definition every process can use.

`P` below is `plugins/dsh-professor-pane`. Every CLI command is
`ainar-node/bin/ainar.ts`; every pane write spawns that same CLI through
`runScans` in `P/server/actions.js`, so the pane and the terminal have one
write path.

---

## The stages at a glance

| # | Stage | Who | In the strip today | Done when |
|---|---|---|---|---|
| 1 | Intake | professor uploads; assistant names it | Identify (always done) | the pile is filed under an assessment the professor confirmed |
| 2 | Paper | assistant | — | items and key exist, accepted |
| 3 | Split & match | pane; professor at the Match desk | Match | every paper placed or set aside |
| 4 | Read | pane | Read | every placed paper has a transcript and its answers are recorded |
| 5 | Check reads | professor | — (*gap*) | no low-confidence answer is unconfirmed |
| 6 | Rubric | assistant proposes; professor chooses | Rubric | each question has an accepted rubric, or is points-only |
| 7 | Mark | professor, by question | Grade, Approve | every answer has a `professor_decision` |
| 8 | Moderate | professor | — (*gap*) | the sample is reviewed |
| 9 | Release | pane, previewed | Canvas (marks only) | marks, reports and feedback sent, or held on purpose |
| — | Integrity | professor | — (side lane) | each open case decided |
| — | Close | pane + assistant | — (*gap*) | item analysis and notes written |

The strip is `stagesOf` in `P/server/scans.js:160`: seven stages, `identify`
`match` `read` `rubric` `grade` `approve` `canvas` (`STEP_IDS`, `:361`). Each
stage's done-rule is written inline in that function, and the headline under
the strip ("Read and record the answers", whose turn, which button) is a
`switch` in `nowOf` (`:266`). The current stage is the first one not done,
with one exception: once any paper is placed, Match stops being current even
if papers are still held (`:232` — Quiz 2 of CSS-4007 sat with 49 papers
placed and none read because one clash kept Match current). The same stages
are read again by `P/server/assessment-window.js` and `P/server/week-status.js`.

---

## 1 · Intake

**What happens.** The professor drops PDFs on the pane (`P/client/upload.js`,
`POST /api/upload` in `P/server/routes/core.js:63`). They land in
`~/.ainar/submissions/<RUN>/_inbox/`. The pane then queues a prompt in the
session: `/import-assessment` §1, then `/grade-scans`.

**Who judges.** The assistant reads the covers and asks the professor which
assessment the pile is and whether it has variants
(`import-assessment/SKILL.md` "1. Which exam is this?", "2. Variants"). It
files the pile with `scans identify|file` (`ainar.ts`, `scans` subcommands).
The sandbox cannot write `~/.ainar`, so the assistant runs these through the
harness tool `scan_pile` (`plugins/dsh-professor-scan-steps/index.js`).

**Leaves behind.** The pile under its assessment; `_inbox/plan.yaml`
(`ainar-node/src/scans.ts`).

**In the strip.** `identify` is always `done: true` — the pile only appears in
the Scans view once it is filed. Nothing shows a pile that was uploaded and
not yet identified.

## 2 · Paper

**What happens.** If the course has no questions for this assessment, the
assistant writes them as markdown with the professor's key and imports them:
`import-paper RUN --assessment --paper` (`import-assessment` §3–5). Items are
written as `approval: draft`.

**Gap.** Not a stage in the strip. A pile whose assessment has no items still
shows Match and Read as the next steps; the reader then has nothing to record
answers against, and `responses >= expected` in Read's done-rule is satisfied
by `expected = 0`.

## 3 · Split & match

**What happens.** `scans plan|names|apply|assign` split the batch into one
paper per student and match each to the roster (`grade-scans/SKILL.md`). The
professor places what the names could not: the Match desk in
`P/client/scans.js`, `POST /api/scans/assign|apply`
(`P/server/routes/scans.js:83`), with presses queued in
`P/client/scans-queue.js` so two are never in flight at once.

**Leaves behind.** Per student, in the private folder:
`<STUDENT>/scan.pdf`, `scan.json`; a Submission record.

**Done-rule today.** No paper in the `held` or `check` lane, and at least one
paper (`scans.js:175`).

## 4 · Read

**What happens.** One press, Read & record (`POST /api/scans/read`,
`P/server/routes/scans.js:64`). It runs `scans read` — the vision model,
called from inside the CLI, not from the session — then `scans record`, which
writes every answer as an ItemResponse draft and scores choice items
(`score-items`). The request is held open for up to 30 minutes and the
Scans view's other buttons are dead while it runs (E34).

**Leaves behind.** `<STUDENT>/transcript.yaml` with a confidence per answer;
`records/item-responses*`.

**Done-rule today.** Every placed paper transcribed and every expected answer
recorded (`scans.js:183`). The count of low-confidence answers is computed and
shown in the detail line — `· 7 low confidence` — and has no effect on the
stage.

## 5 · Check reads — *gap*

Nothing makes the professor look at a misread before marking it. A
low-confidence answer is drawn on its grading card like any other; a wrong
transcript is found, if at all, while marking, and corrected in chat (GRA-7
would fix it from the card). EXM-2 proposes the stage: a queue of the
least-confident answers, cropped to their region (GRA-6), confirm or fix, and
Rubric not current until the queue is empty or skipped on purpose.

## 6 · Rubric

**What happens.** The assistant groups each question's answers by meaning and
proposes several rubrics over the grouping — always one from the marking key,
one from what the class wrote (`import-assessment` §7, GRA-1, GRA-11). The
pane asks for it with `STEP_PROMPTS.rubric`
(`P/shared/course-words.js:181`): `/import-assessment <id> <run> — propose
the rubric`. The professor compares the proposals per question in the Grade
view (`P/client/grade-board.js`) by class mean and count per level, chooses,
and accepts (`POST /api/grade/choose|accept-rubric|points-only`,
`P/server/routes/grade.js:160`). Asking the assistant to revise adds a
proposal the view picks up live (GRA-13).

**Leaves behind.** `groups.yaml` beside the scans, with the groups, labels,
proposed scores and `proposals` (`ainar-node/src/grade-board.ts`); the rubric
on the assessment, `approval: draft` until accepted.

**Done-rule today.** The rubric (or the assessment carrying an inline rubric)
is no longer `draft` (`scans.js:167`). Points-only counts as accepted.

## 7 · Mark

**What happens.** One question at a time, groups of answer cards with the
page, the text as read, the confidence and the suggestion; 0…max buttons, a
comment, Accept group, Accept all (`POST /api/grade/decide|move`). The
assistant can draft criterion-level suggestions for long answers:
`STEP_PROMPTS.grade` → `/grade-batch <id> <run>`
(`grade-batch/SKILL.md`, `grade-submission/SKILL.md`). A group moved
re-suggests at once; a rubric changed after marking flags the marks that now
disagree (GRA-13).

**Leaves behind.** Evaluation records (`records/evaluations*`), each with
`ai_suggestion`, `professor_decision`, `decided_by`, `decided_at`, `approved`
or `overridden`, whether it was decided one card at a time or in bulk, and
the earlier decision pushed onto `extensions.history`.

**In the strip — two stages for one.** `grade` is done when every placed paper
has an evaluation; `approve` is done when every evaluation has a
`professor_decision` (`scans.js:199`, `:205`). In the Grade view these are
the same press, so for a short-answer exam graded in the pane the two stages
finish together. They differ only when `/grade-batch` writes suggestions that
wait for a decision — then `STEP_PROMPTS.approve` asks the assistant which
are still waiting, least confident first.

**Also here.** A curve (`/api/grade/curve`, `grade.js:88`) is applied in the
Grade view and is not a stage.

## 8 · Moderate — *gap*

Nothing samples the marking for a second look. "Accept all" is allowed
(decided 2026-10-02) and recorded as a bulk decision, but nothing reads that
record back. The research in [`WORKFLOWS.md`](WORKFLOWS.md#5-automation-bias-in-ai-assisted-grading)
is why this matters most for bulk and for harsh marks. EXM-3 proposes the
stage (a sample marked before the suggestion is shown); EXM-4 the harsh-mark
check.

## 9 · Release

**What happens, in three separate places.**

- **Marks to Canvas.** The Canvas stage's own button (`P/client/marks.js`,
  `POST /api/canvas/marks`, `P/server/routes/canvas.js:267`) runs `lms plan`
  to preview and `lms push` to send, through `runMarksPush`
  (`P/server/actions.js`). The ledger of what was sent is in `~/.ainar/sync/`.
  Done when every ready mark is sent and none changed since (`scans.js:212`).
- **The gradebook.** `gradebook` (`ainar-node/src/gradebook.ts`) under the
  policy edited in the Gradebook view; a policy change goes through
  `/grading-proposal`. Not a stage — it updates whenever the evaluations do.
- **Exam reports.** A PDF per student, made and sent to Canvas from the pane
  (`POST /api/reports/make|send`, `P/server/routes/reports.js`), running
  `report exam` and `lms send-reports`. Not a stage: the strip says "Every
  step is done" whether reports were sent or not.

**Gap.** Feedback to each student from the decisions and comments (GRA-9) does
not exist. EXM-6 proposes one release stage that previews all three and the
feedback side by side.

## Integrity — a side lane

Opened on any assessment line, handed in or not (`POST /api/grade/integrity`,
`P/server/routes/grade.js:119`, `integrity open|decide|list`). A case holds,
zeroes or voids one student's mark, takes it off the curve and sends EX to
Canvas. Cases are in `records/integrity.yaml`, evidence in
`~/.ainar/integrity/<RUN>/` (`ainar-node/src/integrity.ts`). No skill opens or
decides a case; the pane writes it in its own process with preset answers.

It is right that this is not a stage: it is not something every exam passes
through. **Gap:** the strip does not show an open case, and an assessment with
one open case still reads "Every step is done" once its other marks are sent.

## Close — *gap*

Nothing happens after the marks are out. Per-item difficulty exists in the
course dashboard skill but is not written anywhere the question bank (E24) or
`/course-reflection` reads. EXM-7.

---

## What this page corrects in the E35 proposal

Writing the stages out against the code changed three things in the table in
`BACKLOG.md`:

1. **Mark is two stages in the strip today, and should be one.** `grade` and
   `approve` count different things (an evaluation exists; it is decided) but
   in the pane they finish on the same press. The proposal's single Mark stage
   is right; the definition (EXM-9) should keep "suggested, not decided" as a
   count inside it, not a stage of its own.
2. **Paper must gate Read.** Read's done-rule passes with zero expected
   answers. A pile without items should stop at Paper.
3. **"Done" must mean released, not sent to Canvas.** The final headline is
   drawn when the Canvas ledger is clean, regardless of reports, feedback or
   open integrity cases.

## Where each stage's logic lives today

| Concern | Place |
|---|---|
| Stage list, done-rules, current stage | `P/server/scans.js` `stagesOf` (`:160`) |
| Headline, whose turn, which action | `P/server/scans.js` `nowOf` (`:266`) |
| Prompts handed to the session | `P/shared/course-words.js` `STEP_PROMPTS` (`:181`), `P/client/upload.js`, `P/client/grade-board.js` |
| The order, as told to the assistant | `import-assessment`, `grade-scans`, `grade-batch` `SKILL.md` |
| Stages read elsewhere | `P/server/assessment-window.js`, `P/server/week-status.js`, `P/server/files.js` |
| Writes | the CLI only, through `runScans` / `runMarksPush` in `P/server/actions.js`, or `scan_pile` for the assistant |
