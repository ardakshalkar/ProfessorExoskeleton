# Where everything is stored

One page that answers "where does this go?" for every file a course has. It is
the target the code and the skills are brought to; where the code does
something else today, the last section says so. A skill that writes a file
points here instead of restating the rule.

[`PIPELINES.md`](PIPELINES.md) is what happens when you ask for something;
[`GENERATION.md`](GENERATION.md) traces the code. This is only about place.

---

## 1. Four kinds of file, and what each carries

Every record in a course is exactly one of these. The kind decides whether it
can be a draft.

| Kind | Who writes it | State field | Example |
| --- | --- | --- | --- |
| **Authored** | the professor, by hand | none — it is theirs | `course.yaml`, `outcomes.yaml` |
| **Proposed** | an agent or a generator | `approval: draft` → `approved` | a term plan, a quiz, a deck's Document |
| **Fact** | an import from outside | none, never a draft | a submission pulled from Canvas |
| **Derived** | the harness, recomputed | none, never edited by hand | evidence, concept states |

Two collections keep their own state word, because the word carries more than
yes/no:

- **Evaluation** — `status: suggested` (draft) → `approved` or `overridden`,
  with the `professor_decision` written *beside* the `ai_suggestion`, never
  over it.
- Everything else proposed, interventions included, uses `approval`.

**Rules for the state field**

1. A record with no `approval` is approved. That is safe only for files a
   person types, so **every record in a `generated.yaml`, an assessment folder
   or `records/` must carry its state explicitly**; `validate` refuses one that
   does not.
2. Only the professor writes `approval: approved`, a `professor_decision`, or
   an approved status. An agent never does, on anyone's work.
3. **A changed record is a new proposal.** When an agent or a generator rewrites
   an approved record and its content changes, `approval` goes back to `draft`.
   A byte-identical rebuild keeps it. For a material, "content" is the
   checksum of its source `.md`.
4. Rejecting is deleting the record.

---

## 2. Three placement rules

1. **A list collection** lives in `<collection>.yaml` when the professor types
   it, and in `<collection>/generated.yaml` when a tool writes it. Accepting a
   record never moves it. A record id appears in one file only
   (`id.duplicate`).
2. **Anything with parts is a folder named by its id** — a material under
   `materials/<MATERIAL>/`, an assessment under `assessments/<ASSESSMENT_ID>/`.
   **The top of the folder holds only what you open or hand out.** Everything
   that makes it — figures, scripts, data, plans, intermediates — is under
   `src/`. Answer keys are under `keys/`.
3. **Anything about a student is pseudonymous and under `records/`.** A real
   name, a GitHub username or a student's own files never enter the
   repository; they live under `~/.ainar/`.

---

## 3. The whole tree

```
workspace/                                  the folder that contains courses/
├─ courses/
│  └─ CSS-4008/                             folder name == course_id
│     ├─ course.yaml                        authored
│     ├─ version.yaml                       authored — the one live run
│     ├─ outcomes.yaml                      authored — never proposed by an agent
│     ├─ capabilities.yaml                  authored (optional; or shared/)
│     ├─ concepts.yaml                      authored
│     ├─ concepts/generated.yaml            proposed
│     ├─ concept-edges.yaml                 authored (optional)
│     ├─ modules.yaml                       authored
│     ├─ modules/generated.yaml             proposed
│     ├─ people/users.yaml                  authored — staff only
│     ├─ enrollments.yaml                   fact — pseudonyms, from roster import
│     ├─ activities.yaml                    authored
│     ├─ activities/generated.yaml          proposed
│     ├─ resources.yaml                     authored
│     ├─ resources/generated.yaml           proposed
│     ├─ documents.yaml                     authored
│     ├─ documents/generated.yaml           proposed
│     ├─ preferences.yaml                   authored (optional)
│     │
│     ├─ materials/
│     │  ├─ materials.yaml                  authored (optional) — producers
│     │  └─ <MATERIAL>/                     one folder per material (§4)
│     │
│     ├─ assessments/
│     │  └─ <ASSESSMENT_ID>/                one folder per assessment (§5)
│     │
│     └─ records/                           everything about students
│        ├─ submissions.yaml                fact
│        ├─ item-responses.yaml             fact
│        ├─ evaluations.yaml                proposed — status field
│        ├─ evidence.yaml                   derived
│        ├─ concept-states.yaml             derived
│        ├─ capability-states.yaml          derived
│        ├─ signals.yaml                    proposed
│        ├─ interventions.yaml              proposed
│        ├─ action-items.yaml               proposed
│        ├─ events.yaml                     fact
│        └─ publications.yaml               fact — what was sent where, when
│
├─ shared/                                  authored — concepts, capabilities, users
│                                           used by more than one course
├─ golden/                                  test fixtures, incl. sample records
├─ dist/                                    gitignored — built for publishing:
│  ├─ pages/<RUN>/                          the course page
│  └─ <COURSE>/bundle.json                  exports
├─ output/                                  gitignored — scratch and private views:
│  ├─ <MATERIAL>/                           render intermediates, --draft renders
│  └─ <RUN>/                                dashboards, reflections, lesson briefs
└─ archive/<TERM>/<COURSE>/                 a finished run, moved by archive-run

~/.ainar/                                   outside the repository
├─ roster/                                  salt, people.json — names ↔ STUDENT-…
├─ sync/                                    LMS and Telegram ledger (ids, tokens)
├─ submissions/<RUN>/<ASSESSMENT>/
│  ├─ _inbox/                               scans as you upload them, before matching
│  └─ <STUDENT>/                            one student's work: a fork, an upload, a scan

└─ reports/<RUN>/                           anything with a real name in it
```

Nothing else lives under `courses/`. In particular there is no `samples/`, no
`concepts/approved.yaml`, no `modules/approved.yaml`, no loose files in
`materials/`, no `run.yaml`, no `versions/`, no `work/`.

---

## 4. A material folder

```
materials/MODULE-06-slides/
├─ MODULE-06-slides.md          the text you edit
├─ MODULE-06-slides.pptx        what you present
├─ MODULE-06-slides.pdf         what you upload
└─ src/
   ├─ plan.yaml                 slide-by-slide plan (written by `ainar deck plan`)
   ├─ outline.yaml              the argument, before slides exist (deep mode)
   ├─ figures/fig-01-split.svg  every picture the deck links
   ├─ build/fig-01-split.py     the script that produced a figure
   └─ data/split-sizes.csv      measured numbers and notes behind it
```

- **The folder name is the material's stem**, and every file at the top is
  `<stem>.<ext>`. A handout is the same shape: `WEEK-03-handout.md` and its
  `.pdf`.
- **One Document per material**, in `documents/generated.yaml`, whose
  `storage_key` is the `.md`. The `.pptx` and `.pdf` are derived renders: they
  carry no record of their own, and are known to be fresh by comparing the
  source checksum they were rendered from.
- **The deck links figures relative to itself**: `src/figures/fig-01-split.svg`.
- **Render writes the `.pptx` and `.pdf` to the top of the folder**, and only
  there. A `--draft` render (placeholder figures) and every rasterised
  intermediate go to `output/<MATERIAL>/`, never into the course.
- A draft material is in the same place as an approved one; the Document's
  `approval` is the only difference. Publishing reads approved Documents only.

```yaml
# documents/generated.yaml
documents:
  - document_id: DOC-4410
    approval: draft
    title: Module 6 — Train/test splits
    storage_key: courses/CSS-4008/materials/MODULE-06-slides/MODULE-06-slides.md
    mime_type: text/markdown
    course_version_id: CSS-4008-2026-FALL
    module_id: MODULE-06
    checksum: sha256:9f2c…
    provenance: { produced_by: make-materials, created_at: 2026-09-30T12:00:00+05:00 }
```

---

## 5. An assessment folder

Everything about one assessment — its record, its questions, the papers you
print, its answer key and, for homework, the repository students fork — is in
one folder named by its id.

```
assessments/ASSESSMENT-QUIZ-01/
├─ assessment.yaml              the record, rubric inline
├─ items.yaml                   its questions
├─ QUIZ-01-student.pdf          what you print or upload
├─ QUIZ-01-student.docx
├─ keys/                        never published, never copied to a page
│  ├─ QUIZ-01-key.pdf           the paper with answers marked
│  └─ QUIZ-01-marking-guide.md  how open answers are scored
└─ src/
   ├─ item-models.yaml          the item models the questions came from
   ├─ QUIZ-01-paper.json        the intermediate the renderer builds
   └─ figures/q03-confusion-matrix.png
```

```
assessments/ASSESSMENT-HW-02/
├─ assessment.yaml
├─ HW-02-brief.md               the brief students read
├─ HW-02-brief.pdf
├─ starter/                     exactly what students fork — no .git in it
│  ├─ README.md
│  ├─ .gitignore
│  ├─ src/
│  └─ data/
├─ keys/
│  └─ HW-02-marking-guide.md
└─ src/
   └─ figures/
```

**Names.** The folder is the `assessment_id`. Files at the top are
`<SHORT>-<variant>.<ext>`, where `<SHORT>` is the id without `ASSESSMENT-`
(`QUIZ-01`, `HW-02`) and the variant is `student`, `brief`, `key` or
`marking-guide`.

**What is in which file**

| File | Holds | Kind |
| --- | --- | --- |
| `assessment.yaml` | one Assessment, rubric inline | authored or proposed |
| `items.yaml` | the Items whose `assessment_id` is this folder's | authored or proposed |
| `src/item-models.yaml` | the ItemModels those items use | authored or proposed |
| `HW-02-brief.md` | registered as a Document; `instructions_document_id` points to it | proposed |
| student papers | each printing registered as a Document (`DOC-QUIZ-01-PAPER-PDF`), so the pane can open it and `instructions_document_id` can name it | proposed |
| keys | derived renders of the record, never registered, never published | derived |

A record in this folder must name this folder's assessment
(`assessment_id` / the folder name agree), and carries its `approval`
explicitly (§1 rule 1).

**`keys/`.** The course page, `publish`, the LMS push and every student-facing
reader skip it. `publish` refuses a file whose path contains `/keys/`.

**`starter/`.** It is material, not a repository: it has no `.git`. The
assessment records where it is and where it goes:

```yaml
# assessments/ASSESSMENT-HW-02/assessment.yaml
assessment_id: ASSESSMENT-HW-02
approval: draft
course_version_id: CSS-4008-2026-FALL
title: HW2 — Retrieval over the course corpus
type: assignment
module_id: MODULE-04
weight: null                    # the professor sets it
due_at: 2026-10-20T23:59:00+05:00
outcomes: [LO-02]
delivery: github_repo
instructions_document_id: DOC-HW-02-BRIEF
rubric:
  rubric_id: RUBRIC-HW-02
  title: HW2 rubric
  criteria:
    - criterion_id: CRIT-HW-02-1
      title: Retrieval quality is measured, not asserted
      maximum_score: 10
      outcome_id: LO-02
extensions:
  github:
    local_path: courses/CSS-4008/assessments/ASSESSMENT-HW-02/starter
    repo: narxoz-css4008/hw2-retrieval        # public; students fork it
provenance: { produced_by: design-assessment, created_at: 2026-09-30T11:00:00+05:00 }
```

`ainar publish homework` copies `starter/` into a temporary clone and pushes
from there. Nobody runs `git init` or `gh repo create --source=.` inside the
course. The repository is public and is not a template; students fork it and
keep the fork public.

**Students' forks**, when pulled for grading, are cloned to
`~/.ainar/submissions/<RUN>/<ASSESSMENT>/<STUDENT>/` and never into the
workspace — a fork carries a GitHub username. The course keeps only the fact:

```yaml
# records/submissions.yaml
submissions:
  - submission_id: SUB-STUDENT-4F2A-ASSESSMENT-HW-02
    assessment_id: ASSESSMENT-HW-02
    student_id: STUDENT-4F2A
    submitted_at: 2026-10-20T22:41:00+05:00
    status: submitted
    note: fork at commit 3e1f9ab
```

### Scanned papers, for grading

A handwritten exam comes back as a scan. The scan carries names and
handwriting, so it never enters the repository; what the course keeps is the
pseudonymous record of it.

```
~/.ainar/submissions/CSS-4008-2026-FALL/ASSESSMENT-MIDTERM/
├─ _inbox/                        you drop the PDFs here — one per student, or one
│  └─ midterm-batch-1.pdf         for the whole pile; nothing here is graded yet
└─ STUDENT-4F2A/                  after matching: one folder per student
   ├─ scan.pdf                    that student's pages, split out of the batch
   ├─ pages/p01.png …             one image per page, what grading reads
   └─ transcript.md               the answers read off the pages, per question
```

1. **Upload** into `_inbox/`. Nothing else happens until the next step.
2. **Match.** Each paper's cover page (the name or student number written on
   it) is looked up in `~/.ainar/roster/` and becomes a pseudonym. The pages
   move into `<STUDENT>/`. A paper that matches nobody, or matches two, stays in
   `_inbox/` and is listed for you — never guessed.
3. **Record.** For each matched paper the course gets a fact in
   `records/submissions.yaml` — `SUB-<STUDENT>-<ASSESSMENT>`, no file path, no
   name. The scan's place follows from the id, so the record needs none.
4. **Grade.** `/grade-batch` reads `pages/` and `transcript.md` against the
   assessment's items and rubric, and writes `status: suggested` evaluations.
   Evidence points into the scan by reference, never by copying it:

```yaml
# records/evaluations.yaml
evaluations:
  - evaluation_id: EVAL-SUB-4F2A-MIDTERM-3
    submission_id: SUB-STUDENT-4F2A-ASSESSMENT-MIDTERM
    criterion_id: CRIT-MIDTERM-3
    status: suggested
    ai_suggestion:
      score: 4
      confidence: 0.55              # handwriting read with doubt says so
      comment: Correct gradient, learning rate not discussed.
      evidence:
        - source_ref: private://submissions/ASSESSMENT-MIDTERM/STUDENT-4F2A/scan.pdf
          location: "p.3, question 3"
```

What goes back to students (the graded paper, feedback naming them) is written
under `~/.ainar/reports/<RUN>/`, never into the course.

---

## 6. Records about students

Everything under `records/` uses pseudonyms (`STUDENT-XXXXXX`) only.

```yaml
# records/evaluations.yaml — a grade: suggestion and decision side by side
evaluations:
  - evaluation_id: EVAL-SUB-4F2A-HW-02-1
    submission_id: SUB-STUDENT-4F2A-ASSESSMENT-HW-02
    criterion_id: CRIT-HW-02-1
    status: approved                  # an agent writes: suggested
    ai_suggestion:
      score: 5
      confidence: 0.7
      comment: Reports recall@5 but on the training queries.
    professor_decision:               # the professor's, never an agent's
      score: 6
      decided_by: USER-ARD-A01
      decided_at: 2026-10-22T18:10:00+05:00
```

```yaml
# records/evidence.yaml — derived from approved grades; no approval field
evidence:
  - evidence_id: EV-4F2A-HW-02-1
    student_id: STUDENT-4F2A
    course_version_id: CSS-4008-2026-FALL
    source_type: evaluation
    source_id: EVAL-SUB-4F2A-HW-02-1
    outcome_id: LO-02
    demonstrated_level: 2
    provenance: { produced_by: extract-evidence, created_at: 2026-10-22T18:15:00+05:00 }
```

```yaml
# records/publications.yaml — the public half of the private ledger
publications:
  - publication_id: PUB-0012
    course_version_id: CSS-4008-2026-FALL
    target: telegram                  # page | telegram | canvas | homework
    subject: ASSESSMENT-HW-02
    checksum: sha256:4be1…            # what was sent; a later edit reads as stale
    published_at: 2026-10-06T09:00:00+05:00
```

Chat ids, tokens and LMS ids stay in `~/.ainar/sync/`.

---

## 7. Every collection in one table

| Collection | Authored in | Tool writes to | Kind | State |
| --- | --- | --- | --- | --- |
| course | `course.yaml` | — | authored | — |
| course version (run) | `version.yaml` | — | authored | — |
| outcomes | `outcomes.yaml` | — (never) | authored | — |
| capabilities | `capabilities.yaml`, `shared/` | — (never) | authored | — |
| concepts | `concepts.yaml` | `concepts/generated.yaml` | authored / proposed | `approval` |
| concept edges | `concept-edges.yaml` | — | authored | — |
| modules | `modules.yaml` | `modules/generated.yaml` | authored / proposed | `approval` |
| users | `people/users.yaml` | — | authored | — |
| enrollments | — | `enrollments.yaml` (roster import) | fact | — |
| activities | `activities.yaml` | `activities/generated.yaml` | authored / proposed | `approval` |
| resources | `resources.yaml` | `resources/generated.yaml` | authored / proposed | `approval` |
| documents | `documents.yaml` | `documents/generated.yaml` | authored / proposed | `approval` |
| assessments | `assessments/<ID>/assessment.yaml` | same | authored / proposed | `approval` |
| items | `assessments/<ID>/items.yaml` | same | authored / proposed | `approval` |
| item models | `assessments/<ID>/src/item-models.yaml` | same | authored / proposed | `approval` |
| submissions | — | `records/submissions.yaml` | fact | — |
| item responses | — | `records/item-responses.yaml` | fact | — |
| evaluations | — | `records/evaluations.yaml` | proposed | `status` |
| evidence | — | `records/evidence.yaml` | derived | — |
| concept states | — | `records/concept-states.yaml` | derived | — |
| capability states | — | `records/capability-states.yaml` | derived | — |
| signals | — | `records/signals.yaml` | proposed | `approval` |
| interventions | — | `records/interventions.yaml` | proposed | `approval` |
| action items | — | `records/action-items.yaml` | proposed | `approval` |
| events | — | `records/events.yaml` | fact | — |
| publications | — | `records/publications.yaml` | fact | — |

---

## 8. Identifiers, the run, provenance

- **The run field is `course_version_id`**, spelled that way in every record
  and every skill, pattern `<COURSE>-<YYYY>-<FALL|SPRING|SUMMER|WINTER>`.
  `course_run_id` exists only as a SQL column name.
- **One live run per course folder.** When a term ends, `archive-run` moves
  every run-scoped file — assessment folders, activities, resources,
  `records/` — to `archive/<TERM>/<COURSE>/`. Course-level files (outcomes,
  concepts, modules, materials) stay.
- **An id is final when it is written.** No `-DRAFT-` marker in any
  collection; the patterns in `model/common.ts` refuse one everywhere.
- **Provenance is one field, `provenance`**, on every record a tool writes:
  `produced_by`, `model_id`, `workflow_version`, `prompt_version`,
  `input_refs`, `created_at`. It replaces `extensions.proposal` and
  `source_note`, and Document's `generated_by` is read as the same thing.

---

## 9. What each reader may see

| Reader | Reads |
| --- | --- |
| course page, `publish`, LMS push, Telegram | approved records; top-level files of approved folders; never `src/`, never `keys/` |
| gradebook, extract-evidence, roll-up | decided evaluations and approved records |
| the professor's dashboard, the pane | everything, drafts included; writes views to `output/` |
| student report, student dashboard | pseudonymous records, joined with `~/.ainar/roster/`; writes to `~/.ainar/reports/` |

---

## 10. Where the code differs today

What has to change to meet this page, by area. Until each lands, the code's
behaviour wins and the skill says so.

**Loader and schema**

- ~~Read the assessment folder; refuse a record filed under another
  assessment (`assessment.folder_mismatch`)~~ — done; the flat files are
  still read beside it until the example course moves.
- Allow `approval` on Concept and Module; read `concepts/generated.yaml` and
  `modules/generated.yaml`.
- Stop loading `samples/`; move the example course's samples into `golden/`.
- Remove `approval` from ItemResponse, LearningEvidence, StudentConceptState,
  StudentCapabilityState, CourseEvent. Add it to Intervention; drop the
  "no status means proposed" rule.
- Refuse `-DRAFT-` in every id pattern, not only `ModuleId`.
- Add `provenance` to every proposable entity; drop `extensions.proposal` and
  `claim.unapproved_proposal`.
- New collection: `publications`.

**Validator**

- Refuse a record without an explicit state in a `generated.yaml`, an
  assessment folder or `records/`.
- Refuse a file under `keys/` referenced by a student-facing record.

**Writers**

- ~~`records-write.ts`: assessments, items and item models go into the
  assessment's folder~~ — done (an item model needs the caller to name its
  assessment). Still to do: an upsert that changes content resets `approval`
  to `draft` (today `materials.ts:18` keeps it).
- ~~`exam-paper`: write papers to `assessments/<ID>/`, the JSON to `src/`~~
  — done. Still to do: the answer key into `keys/` (`exam-paper` does not
  print a key at all yet).
- Scanned papers: a new `ainar scans` step that splits a batch in `_inbox/`,
  matches covers against the roster, writes `records/submissions.yaml`, and
  hands the pages to `/grade-batch`. Nothing of it exists yet.
- `ainar deck plan`: new command that writes `src/plan.yaml`.
- Deck check and render: plan, outline and figures under `src/`.
  `organize-materials` migrates existing decks into this shape.
- `materials build`: stop registering `.pptx`/`.pdf` as Documents.
- `homework`: `local_path` points at `assessments/<ID>/starter`;
  `extensions.github.template_repo` becomes `repo`.
- `dashboard`: default output `output/<RUN>/`, not `dist/`.
- `publish`: write `records/publications.yaml` beside the private ledger;
  refuse anything under `keys/`.
- `archive-run`: move assessment folders, `rubrics*`, `items*`,
  `item-models*` along with the rest.

**Skills** — every skill's shared preamble points here, and:

- `course_run_id` → `course_version_id` (plan-term, design-assessment,
  make-materials, action-inbox, find-gaps, and their templates).
- propose-concepts, plan-term: write to `concepts/generated.yaml`,
  `modules/generated.yaml` with `approval: draft`.
- design-assessment: the assessment folder, `starter/`, `keys/`; no
  `gh repo create --source=.`; `weight: null`, never `TODO`.
- grade-batch: pull forks to `~/.ainar/submissions/…`.
- student-report, student-dashboard, course-dashboard: `ainar student <RUN>
  <STUDENT>`; output locations from §9.
- The `professor-skills` plugin (slides, design-course, make-homework/lab/…):
  retire, or move onto this model.

**The example course** `workspace/courses/CSS-4008` is migrated to this shape
last, so it is the worked example of this page.
