---
name: design-assessment
description: Draft an assignment, quiz, exam or project against the outcomes it should measure — assessment, rubric criteria and concept-tagged items together, built from a coverage blueprint and the professor's constraints. Use when the user asks to create, design, write or generate an assignment, homework, quiz, midterm, exam, test or project brief. An exam that already exists — set, printed or sat, whose questions only need recording — is /import-assessment instead.
stage: design
requires: [outcomes, concepts]
produces: [assessments, items, item_models, documents]
writes: drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write into the course, where the record belongs — the file for its
>   collection under `courses/<COURSE>/`, with its real identifier — and mark
>   every record you write `approval: draft` (a grade: `status: suggested`).
>   Materials go in `materials/<MATERIAL>/`. Nothing is moved afterwards, and
>   nothing student-facing reads a draft.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Artefacts that serve an existing claim you may draft; that is the
>   job. Concepts and modules may be **proposed** from source material the
>   professor supplied, with `extensions.proposal.source` naming where each came
>   from — proposed, not invented, and inert until approved.
> - **Never accept your own work,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Do not write `approval: approved`, a
>   `professor_decision`, or an approved status: accepting a draft, or posting a
>   grade a student can see, is the one place a human enters. Say what is
>   waiting instead. `ainar publish … --confirm` publishes only what the
>   professor has accepted; only `/publish` runs it, and only on the
>   professor's explicit instruction in that request.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE>`, and fix every error.
> - Never recompute by hand what a command does exactly — `score-items`,
>   `gradebook`, `extract-evidence`, `roll-up`, `calibration`, `lms plan`.
>
> These are the whole of it. Nothing outside this directory carries
> them, so treat them as the agreement itself rather than a summary of one.

# Design an assessment

**Needs:** a course in YAML. Partial without the CLI — coverage figures become hand counts.

You draft the task, the rubric and the questions. You do **not** decide what the
course teaches or what it is worth. Outcomes, concepts and weights come from the
professor; you build the instrument that measures them.

`templates/` beside this skill holds the shapes: `assessment-draft.yaml` for §3,
and a choice of student-facing document for §4 and §5 — a brief, an exam paper, a
starter README. Read `templates.yaml`, show the professor the choice, and use
what they pick; with no preference, use the default and say which it was. Each
student-facing template carries §6's list at the top of the file, because that is
the check that cannot be undone afterwards. `references/templates.md` has the
convention.

## 1. Get the blueprint

```bash
bin/ainar blueprint CSS-4008-2026-FALL --outcomes LO-01,LO-02 --through MODULE-08 --weight 0.30 --marks 100
```

Read it before writing anything. It tells you:

- **`target_outcomes`** — with `suggested_marks`, allocated in proportion to
  declared outcome weight. Follow the allocation unless the professor overrode
  it, and say so if you deviate.
- **`current_share_of_grade`** — what each outcome already carries. An outcome
  at 27% when it declares 30% needs less from you than one sitting at 8%.
- **`concepts_in_scope`** — with `existing_items`, `observed_success_rate` and
  `flagged`. This is where the design gets made:
  - `existing_items: 0` and never assessed → the gap this assessment should
    close.
  - `observed_success_rate` low and `flagged: true` → worth probing again, with
    a *different* question, not the same one reworded.
  - Already covered by three items with a high success rate → do not spend
    marks here.
- **`never_assessed`** — call these out to the professor explicitly, even if you
  cannot cover them all.
- **`weighting.total_if_added`** — if this is not 1.0, say so in your report.
  The professor may intend to reweight something else, but they must know.

## 2. Ask what it is for, and what it covers

The blueprint tells you what the course has *under-assessed*. It does not tell
you what this assessment is *for*, and those are different questions — a
diagnostic quiz in week 2 and a summative midterm in week 8 can cover identical
concepts and share nothing else. Ask before drafting anything.

**Ask the purpose first**, because everything else follows from it:

> What is this assessment for — finding out what they already know, checking
> whether the last three weeks landed, or establishing what they achieved? The
> first two work better with no weight; the third needs one.

`references/assessment-design.md` has the four purposes and what each means in
this model. The one worth naming out loud: a **formative** assessment with no
weight still produces evidence through `extract-evidence`, so "this doesn't
count towards the grade" and "this is worth doing" are not in tension here.

**Then ask the topics.** Propose, do not decide:

> From the blueprint, the concepts with the weakest coverage through week 8 are
> CONCEPT-NEURAL-NETWORKS (never assessed) and CONCEPT-TRAIN-TEST-SPLIT (0.33
> success rate, worth probing with a different question). Shall this cover those,
> or did you have a different scope in mind?

Wait for an answer. What an assessment covers is a claim about what matters
enough to be measured, and the blueprint's arithmetic is an input to that
decision rather than the decision itself. A professor may deliberately leave a
concept for the final, or want the exam to revisit something that went fine.
**Never pick the topics from the coverage numbers alone and present the result as
finished.**

**Then ask its shape**, because a single task and a graded sequence are different
instruments and the model records the difference:

> One task, or several of increasing difficulty? And does it want a preparation
> question before the work, or a follow-up after it?

What those map to on each item:

- **`difficulty: easy | medium | complex`** — what you *intended*, which is not the
  same as the success rate `ainar score-items` observes. Declare it and the
  validator compares the two: `item.difficulty_mismatch` fires when an item
  declared easy is failed by half the class, or a complex one is passed by
  everybody and so discriminates between nobody.
- **`role: preparation | main | followup`** — where the item sits. `main` is the
  default and needs no thought.
- **A preparation question may carry `maximum_score: 0`.** It is the only place in
  the model where zero is allowed, and it is what "record the answer, do not grade
  it" looks like. `ainar extract-evidence` skips preparation items entirely: a
  wrong answer to a readiness check asked *before* teaching is the expected and
  useful result, and recording it as failure to demonstrate the concept would
  misread the reason for asking.

Only declare a difficulty the professor actually stated or agreed. Guessing that a
question is "medium" adds a claim nobody made, and it will be compared against
real responses later.

Then the rest, in one round — ask only for what you cannot infer:

- Type: assignment, quiz, exam, project, presentation, oral defence
- Weight and total marks, if not already given to `blueprint`
- Duration, and the item mix for a timed exam
- How students hand it in, and where: a Canvas upload, a forked GitHub
  repository, a notebook, a paper booklet in a room, an oral defence with no
  artefact at all. This decides which tooling can reach it later — `lms push`
  needs a Canvas assignment id, `import-graded-exam` needs the paper question
  map, and an oral defence produces no file for anything to attach to.
- Due date

If the professor gives their own criteria — "I want a criterion on code
quality", "no multiple choice", "must include an oral defence" — those override
the blueprint's suggestions. Follow them, and note any coverage they cost.

Before drafting, resolve preferences in this order: `preferences/defaults.yaml`,
the professor's local `.ainar/preferences.yaml` when present, the course's
`preferences.yaml` when present, then instructions in the current task. A task
instruction wins. An explicit preference always wins over an inferred one.
Preferences shape the instrument; they never supply an outcome, criterion,
weight or other course claim.

## 3. Draft it

Write each record into the course file its collection belongs in, under
`courses/<COURSE>/`: the assessment with its rubric in
`assessments/generated.yaml`, the items in `items/generated.yaml`, the item
models in `item-models/generated.yaml`. Use the real identifier the record will
keep, and mark every one `approval: draft`. The shapes, shown together:

```yaml
assessments:
  - assessment_id: ASSESSMENT-06
    approval: draft
    course_run_id: CSS-4008-2026-FALL
    title: Midterm Examination
    type: exam
    description: >-
      Closed-book, 90 minutes, covering weeks 1-8.
    module_id: MODULE-08
    maximum_score: 100
    weight: 0.30
    due_at: 2026-11-05T14:00:00+05:00
    outcomes: [LO-01, LO-02]
    submission_type: [text]
    settings:
      duration_minutes: 90
      closed_book: true
    design:
      purpose: summative midterm
      duration_minutes: 90
      target_item_count: 6
      cells:
        - outcome_id: LO-01
          cognitive_level: apply
          difficulty: medium
          item_type: short_answer
          item_count: 2
          marks: 40
        - outcome_id: LO-02
          cognitive_level: analyze
          difficulty: complex
          item_type: practical
          item_count: 4
          marks: 60
    rubric:
      rubric_id: RUBRIC-06
      title: Midterm rubric
      criteria:
        - criterion_id: CRIT-06-01
          rubric_id: RUBRIC-06
          title: Problem formulation and method families
          maximum_score: 40
          outcome_id: LO-01
          concepts: [CONCEPT-AI-PROBLEM-TYPES, CONCEPT-SEARCH]
          levels:
            - score: 40
              description: Formulation correct and justified against problem structure.
            - score: 24
              description: Formulation correct, justification thin.
            - score: 8
              description: Formulation incorrect or unjustified.

item_models:
  - item_model_id: ITEM-MODEL-OVERFITTING-DIAGNOSIS
    approval: draft
    course_version_id: CSS-4008-2026-FALL
    title: Diagnose generalisation failure from evaluation evidence
    outcome_id: LO-02
    concepts: [CONCEPT-OVERFITTING, CONCEPT-TRAIN-TEST-SPLIT]
    cognitive_level: analyze
    evidence_requirements:
      - distinguishes training performance from held-out performance
      - identifies overfitting as the supported diagnosis
    task_structure:
      - present training and held-out evidence
      - ask for the best-supported diagnosis
      - require a justification
    scenario_variables:
      domain: [healthcare, education, retail]
      metric: [accuracy, f1, mean_absolute_error]
    difficulty_features:
      easy: {irrelevant_details: 0, competing_causes: 1}
      complex: {irrelevant_details: 3, competing_causes: 4}
    misconceptions: [CONCEPT-TRAIN-TEST-SPLIT]
    answer_requirements: [diagnosis, evidence-based justification]
    allowed_item_types: [multiple_choice, short_answer]

items:
  - item_id: ITEM-06-01
    approval: draft
    assessment_id: ASSESSMENT-06
    item_model_id: ITEM-MODEL-OVERFITTING-DIAGNOSIS
    number: 1
    type: multiple_choice
    prompt: >-
      A model scores 0.94 on the data it was fitted to and 0.61 on data held
      back. Which statement is best supported?
    maximum_score: 10
    outcome_id: LO-02
    criterion_id: CRIT-06-02
    concepts: [CONCEPT-OVERFITTING, CONCEPT-TRAIN-TEST-SPLIT]
    options:
      - label: a
        text: The model has learned the training sample rather than the pattern.
        correct: true
      - label: b
        text: The held-out set must be harder than the training set.
        indicates_misconception_of: CONCEPT-TRAIN-TEST-SPLIT
        note: Attributes the gap to the data rather than to the model.
```

The identifiers are the final ones from the start, including the rubric and
criteria — nothing is renamed on approval, so an item pointing at `CRIT-06-02`
already points where it always will. What makes the record a draft is its
`approval: draft`, not its name. The rubric and its criteria sit inside the
assessment and go with its `approval`.

Arithmetic the validator will check, so get it right:

- criterion `maximum_score` values sum to the assessment `maximum_score`;
- item `maximum_score` values sum to it too, if you write items;
- every item's `criterion_id` belongs to *this* assessment's rubric;
- no score above a criterion or item maximum.
- blueprint-cell marks sum to the assessment maximum, and their item counts sum
  to `target_item_count`;
- every generated instance naming `item_model_id` stays within that model's
  outcome, concepts, cognitive intent and allowed item types.

Do not create an item model merely to paraphrase one question. Create one when
several controlled instances should measure the same construct—for equivalent
exam forms, later reuse, or systematic variation of difficulty. The model owns
the construct and evidence; the item owns the actual wording and answer.

## 4. Write the brief students actually read

The YAML is the model; it is not a document anybody can be handed. Write the
brief as markdown straight into the course, in its own material folder
`courses/<COURSE>/materials/<MATERIAL>/`, and register it as a `Document` in
`documents/generated.yaml`, marked `approval: draft`:

```yaml
documents:
  - document_id: DOC-A06-BRIEF
    approval: draft
    title: Midterm 2 — assignment brief
    storage_key: courses/CSS-4008/materials/midterm-2-brief/midterm-2-brief.md
    mime_type: text/markdown
    course_run_id: CSS-4008-2026-FALL
    generated_by:
      produced_by: design-assessment-skill
      model_id: claude-opus-5
      prompt_version: design-assessment/v1
      input_refs: [ASSESSMENT-06, LO-02, LO-04]
      created_at: 2026-08-13T10:00:00+05:00
```

Then set `instructions_document_id: DOC-A06-BRIEF` on the assessment, so the
model knows which document is the brief rather than leaving the link implicit.

Markdown, not `.docx` or `.pdf`: it diffs, it reviews, and it converts afterwards.
The file stays where you wrote it — nothing moves it on approval, so the
`storage_key` is final from the start. Never write `size_bytes` or `checksum`
yourself; they are computed from the file.

What the brief contains: the task, what to hand in, when, how it is marked. **The
rubric goes in it** — a criterion a student cannot read before starting is a
criterion they cannot aim at, and the level descriptions are the most useful thing
you can give them. What it must never contain is in §6.

## 5. Scaffold the repository, if the work arrives as one

When `delivery: github_repo`, students need something to fork. Build the starter
repository as files on disk, under `homework/<slug>/` at the workspace root:

```
homework/hw3-retrieval-over-a-corpus/
  README.md          the brief, or a short version of it linking to the document
  .gitignore         for the language the work is in
  src/ or notebooks/ whatever the task needs, with the parts students fill in
  tests/             only if the task is checked by tests students may run
```

The slug is short, lowercase and says what the work is — `hw1-llm-apis-and-tokenizers`,
`hw2-json-grant-assistant` — because it becomes the repository name students see,
and `ASSESSMENT-06` means nothing to them.

`homework/` is not `courses/`, and that is deliberate. The assessment *record* is
still a draft in `assessments/generated.yaml`, marked `approval: draft` like
everything else; the starter repository is not a record but the material itself,
it outlives the draft, and it gets adapted for the next offering rather than
rewritten. Build it where it will live.

Then **stop, and hand over the commands.** Creating a repository is an outward
facing act — the moment it exists, it has a URL that can be found — and it belongs
to a person for the same reason accepting a draft and `lms push --target
canvas-api` do. Never run `gh repo create`, `git push`, `gh api`, or anything that publishes.

```bash
cd homework/hw3-retrieval-over-a-corpus
gh repo create narxoz-css4007/hw3-retrieval-over-a-corpus --public --source=. --push
```

Say plainly what that does: it creates the repository, public, and pushes. It is
**not** marked as a GitHub template, and never offer `gh repo edit --template`:
students **fork** it, keep their fork **public**, and hand in the fork's link.
They do not press "Use this template", do not make a private copy, and do not add
the professor as a collaborator. Public is what lets them fork it at all — say
that it is also public to next year's cohort, and that a fork is public too, so a
key or password a student commits is published with it.

`bin/ainar homework publish <ASSESSMENT_ID>` does the same thing from the record,
and the professor's pane has a button for it. Both plan first and write only on
`--confirm`, and both refuse if the starter files contain an answer key. Offer the
command; do not run it.

Once it exists, they record it on the assessment, both halves — where it lives on
their machine and where it lives for students — so the model can find the files
without being told again:

```yaml
extensions:
  github:
    local_path: homework/hw3-retrieval-over-a-corpus
    template_repo: narxoz-css4007/hw3-retrieval-over-a-corpus
```

Write `local_path` when you scaffold, even before the repository exists — it is
the folder you just built, and it is true whether or not anything was published.

Ask them whether it needs a `LICENSE`, and do not choose one. What students may do
with the starter code, and what they may do with their own answer afterwards, is a
policy question about their course.

## 6. What never goes in a student-facing file

The assessment model holds things written for the marker, and the brief and the
repository are read by the class. Every one of these is a way to hand out the
answer:

- **`answer_key` on any item.** Not in the README, not in a comment, not in a test
  fixture, not in a solutions file "for later".
- **`indicates_misconception_of` and its `note`.** Those name the wrong answer a
  student is expected to be tempted by, which tells them which one it is.
- **`marking_guidance`.** Written to make two markers agree, not to be read by the
  person being marked.
- **Any solution, reference implementation or worked answer**, however clearly
  labelled as a solution.
- **A student's name**, anywhere, including in an example or a test fixture.

Before reporting, re-read every file you wrote in §4 and §5 against that list. This
is the one check in this skill whose failure cannot be undone: a repository that
briefly contained the answer key contained it in the git history too, and a student
who forked it in that window has it.

## 7. Check it

```bash
bin/ainar validate CSS-4008
```

Drafts are validated in place like any other record. Expect
`approval.depends_on_draft` if an approved assessment rests on items you drafted —
it clears when the professor accepts them. Expect a `weight.sum` warning if the run's weights no longer total 1.0 — do not
silence it by adjusting an existing assessment's weight. That is the
professor's call. Report it.

## 8. Hand over

Give the user a coverage table: outcome, marks allocated, which criteria and
items serve it. Then, separately:

- concepts in scope you did **not** assess, and why;
- anything from `never_assessed` still uncovered;
- the resulting total weight if it is not 1.0;
- the brief, the repository scaffold if you built one, and the commands that
  publish them — with a sentence on what each command does before it runs.

Say explicitly that nothing has been published. Name what is marked
`approval: draft` and where — the assessment in `assessments/generated.yaml`, the
items in `items/generated.yaml`, the brief's Document in
`documents/generated.yaml` — and say that they accept each by changing
`approval: draft` to `approval: approved` (or deleting the line), and reject one
by deleting the record. `bin/ainar drafts CSS-4008-2026-FALL` lists everything
waiting. The repository exists only as files on disk, and no student can see any
of it: student-facing outputs skip drafts, and the repository waits for the
commands they run themselves.

**Never write `approval: approved` yourself.**

## Without the CLI

The instrument still gets drafted normally. What you lose is `ainar blueprint`,
which is the arithmetic that stops an exam over-sampling whatever is easiest to
write questions about.

You can read declared weights from `outcomes.yaml` and every existing
assessment from `assessments/`. You can add the weights up and state the sum —
say the total plainly, and if adding yours takes it past 1.0, report that and
stop rather than adjusting anything.

What each outcome **already carries** means totalling marks across every rubric
criterion in the run. Count it if the run is small, show your working, and call
it a hand count rather than a figure. Never present it as `ainar blueprint`
would — that command is exact and your count is not.

Concepts that have never been assessed you can find by reading: list the
concepts, list what the items and criteria name, subtract.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **The template gives the shape; the professor picks it.** From `templates/`
  beside this skill. `weight` stays `TODO` in the draft however finished the rest
  of it looks.
- **Measure existing outcomes; never add one.** If the assessment the professor
  describes cannot be mapped to an existing outcome, say which outcome is
  missing and stop. That is a syllabus change.
- **The purpose and the scope come from the professor.** What an assessment is
  for, and which topics it covers, are decisions the blueprint informs and does
  not make. Propose both from the coverage data, then wait. A finished-looking
  draft built on topics nobody chose is the failure this skill is most likely to
  produce, because it looks like exactly the right answer.
- **This model is criterion-referenced and cannot curve.** Nothing takes a class
  distribution as input, by design. If a professor asks for marks scaled to a
  target mean, say the model has no facility for it rather than approximating one.
- **Never publish anything.** No `gh repo create`, no `git push`, no `gh api`, no
  Canvas or Moodle or Notion write, with or without a flag saying it is fine.
  Prepare the files, print the command, say what it will do, and stop. A brief a
  student can read is the same act as a grade a student can see.
- **Nothing written for the marker reaches the class.** §6 is the list, and it is
  the one failure in this skill that cannot be taken back.
- **Every criterion names `outcome_id`.** A criterion without one produces
  marks and no evidence, which defeats the point of writing it.
- **Tag every item with concepts.** An untagged item cannot inform diagnosis,
  and the whole reason for item-level data is diagnosis.
- **Write distractors that mean something.** Where the data shows a real
  misconception, build an option for it and set
  `indicates_misconception_of`. A distractor nobody would pick teaches nothing.
- **Do not re-ask a question that already exists.** Check `already_assessed_by`
  and read the existing items before writing new ones.
- **Do not set the weight yourself.** Take it from the professor. If they have
  not said, write `TODO` and ask — a weight is a claim about what matters.
- **Do not invent context.** No fabricated datasets, citations, company names
  or scenarios presented as real. A constructed scenario is fine when it reads
  as constructed.
- **An exam you cannot fit in the time is a bad exam.** For timed assessments,
  state your estimate of how long the paper takes and check it against the
  duration.
