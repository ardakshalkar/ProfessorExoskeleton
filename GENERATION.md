# How anything gets generated

Three things in this project produce a file somebody opens: **teaching material**
(a deck, a handout), **an assessment paper** (a quiz, an exam), and **a view of
the course** (the students' page, the professor's dashboard, an export). They
were built at different times by different hands and they read as three
unrelated pipelines. They are not. They are one shape, three times.

This document is that shape, and then each of the three against it. It describes
what the code does today — where a stage is missing, it says so rather than
drawing it.

---

## 1. The one shape

```
  PROPOSE          a skill drafts          plugins/*/skills/*/SKILL.md
     |
     v
  DRAFT            work/<RUN>/*.yaml       src/drafts.ts  — DRAFTABLE, and its omissions
     |
     v
  ===== GATE ===== ainar approve           src/approve.ts — validate, strip -DRAFT-, write
                   ainar publish           the same gate (runApproval), narrowed to
                                           documents + resources, then the publication
     |
     v
  RECORD           courses/<COURSE>/       vendor/datalayer/schema/ — 28 schemas
     |
     v
  BUILD            record -> intermediate  src/deck.ts, src/page.ts, bin/exam-paper.ts
     |
     v
  ==== REFUSAL === answer keys, student names, unapproved files   src/safety.ts
     |
     v
  RENDER           intermediate -> bytes   bin/render-deck.ts, bin/render-exam.ts
     |
     v
  OUTPUT           dist/, output/<RUN>/    never in git. An artefact that becomes
                   courses/<C>/materials/  a record lives beside the course
```

Five properties hold at the same places every time, and they are the reason the
shape is worth naming:

| Where | What holds | Enforced in |
| --- | --- | --- |
| Draft | An agent may propose 16 collections and no others. Not outcomes, not capabilities, not enrollments — and since 2026-09-05 not concepts or modules either, because the structure of a course is the professor's own authoring. | `src/drafts.ts` |
| Gate | Nothing is a record until a person promotes it. The promotion is visible in a diff, because the `-DRAFT-` marker comes out of the identifier. Two commands perform it and they are one implementation — `runApproval`: `ainar approve`, over everything, and `ainar publish`, over the documents and resources one publication needs. A judgement about a student has one path and it is the first. | `src/approve.ts`, `src/publish.ts` |
| Build | An unapproved file has a `storage_key` under `work/`, and every builder that could publish one checks. | `src/page.ts`, `bin/render-deck.ts` |
| Refusal | The answer-key scan before publication has no override. A file that names students is refused a path inside the workspace. | `src/safety.ts`, `src/lms/base.ts` |
| Output | Build products go to `dist/` or `output/<RUN>/`. An artefact meant to become a record — a deck from `materials build`, a printed paper — is written beside the course under `materials/` instead, because a `storage_key` with no scheme is a path in this repository and a record may not point at a build directory. The YAML under `courses/` is still written by `approve` alone, which is what keeps it diffable. | every command |

**Build and render are separate on purpose.** The build half has the opinions and
no I/O, so it is testable without a course on disk; the render half does I/O and
calls a third-party writer, which is not worth a test. `src/deck.ts` says this
about itself and `src/lms-export.ts` is the same split. When you want to know
*why* a document came out the way it did, read the `src/` half; when you want to
know why it did not come out at all, read the `bin/` half.

---

## 2. Who owns which layer

```
plugins/
  professor-course-skills/skills/     20 skills, WELDED to the record
    design-assessment/                  -> drafts assessments, items, item models
    make-materials/                     -> drafts documents + slide markdown
    course-page/  course-dashboard/     -> call the CLI, never re-render
  professor-skills/*/skills/          19 skills, STANDALONE, no record
    professor-exam-skills/              design-exam, make-exam
    professor-slides-skills/            outline-, make-, build-, render-presentation
    professor-assignment-skills/        make-homework, -lab, -practice, -seminar

ainar-node/
  src/     the model, the checks, the builders   — tested
  bin/     the CLI and the renderers             — I/O and third-party writers
```

The two skill trees are the most confusing thing in this repository, and the
confusion is historical rather than designed. `professor-skills/` was a spin-off
of `/make-materials` that deliberately cut the dependency on a course record so
it could install on its own — its own README says so. The harness has since
absorbed it, which makes it a dead branch, but a dead branch holding work the
live one lacks: thirty teaching beats, seven craft references, and five checks
the renderer does not have. That salvage is `MAT-1` … `MAT-3` in
[`BACKLOG.md`](BACKLOG.md), and until it is done, deleting the tree loses
something.

**Read it this way.** If a skill ends by writing YAML into `work/`, it is on the
record path and everything in §1 applies to it. If it ends by handing the
professor prose, it is on the standalone path and the gate never sees it.

---

## 3. Slides

```
/make-materials                              a skill drafts slide markdown
   |
   +-- ainar deck fit FILE.md                src/layout.ts — will it overflow?
   |                                         an estimate: PowerPoint sets the type,
   |                                         and a slide holding an image reports
   |                                         an upper bound, not a fact
   v
work/<RUN>/documents.yaml                    a Document with a storage_key
   |
   v
ainar approve                                the storage_key leaves work/
   |
   v
bin/render-deck.ts --document DOC-nnnn       refuses an unapproved document
   |   splitSlides / parseBlocks             src/deck.ts — Marp's --- convention,
   |                                         so the same file is a deck in a Marp
   |                                         previewer and a deck here
   |   checkContract                         presentation_plan vs markdown: count,
   |                                         order and title must agree, and a
   |                                         mismatch EXITS rather than reordering
   |                                         either one to make them agree
   v
output/<COURSE_VERSION_ID>/*.pptx            pptxgenjs + sharp, loaded from
   |                                         node/node_modules — not dependencies
   |                                         of @ainar/core, because reading a
   |                                         course should not need a native
   |                                         image library
   +-- --pdf -> LibreOffice                  a conversion of THIS deck, so the PDF
                                             cannot disagree with the .pptx. With
                                             no LibreOffice the .pptx is still
                                             written and the PDF reported skipped
```

Two other doors open onto the same output.

- **`bin/build-deck.ts`** runs a hand-written deck script that draws by
  coordinate. The script imports nothing and default-exports
  `build({ deck, C, W, H })`; the kit is handed in, because the kit lives in this
  checkout and the script lives in the professor's course folder and neither can
  find the other. This is how the seven CSS-4007 decks are built.
- **`ainar materials build RUN`** runs the producers a course declares in its own
  `materials.yaml`, converts what needs converting, reads the result back to
  describe it, and writes **one** draft through the same schema and emitter
  `approve` uses. It exists because those three acts had drifted apart in a real
  course: seven decks from seven scripts, PDFs converted once by a person, and
  `Document` records written by an eighth script that knew nothing of the schema
  — which is how a field the model does not define got into a record and made the
  loader drop a document silently, for a month.
- **`ainar materials import RUN FILE.pptx --as DOC-nnnn`** is the mirror. It reads
  a finished deck somebody else made and proposes what is in it, matched against
  the course's **own** concept vocabulary, so an import cannot introduce a
  concept. An invented one would fail `validate`, and `approve` writes nothing
  when validation fails.

---

## 4. Quizzes and papers

```
ainar blueprint RUN                          src/blueprint.ts — what a new
   |                                         assessment SHOULD cover, before
   |                                         anyone writes a question
   v
/design-assessment                           a skill drafts the assessment,
   |                                         its items, and its item models
   v
work/<RUN>/{assessments,items,item-models}.yaml
   |
   v
ainar approve                                the schemas refuse here, not later:
   |                                         a choice item with no correct option,
   |                                         duplicate option labels, two correct
   |                                         answers on a single-choice item
   v
courses/<COURSE>/{assessments,items}/
   |
   +--> bin/exam-paper.ts --assessment ID    role: main items only, sorted by
   |       |                                 number. An unnumbered one stops the
   |       |                                 run rather than printing at an
   |       |                                 arbitrary position. Items totalling
   |       |                                 something other than the declared
   |       |                                 maximum is WARNED, never rescaled —
   |       |                                 the record is the professor's
   |       v
   |    <stem>-paper.json                    the question paper, and deliberately
   |       |                                 NOT the key: answer_key and
   |       |                                 marking_guidance are read and dropped
   |       v
   |    bin/render-exam.ts                   docx + pdf-lib, both of them writers
   |       |                                 rather than converters — which is why
   |       v                                 this path needs no LibreOffice and
   |    <stem>-student.docx / .pdf           the materials path does
   |       |                                 written into courses/<COURSE>/
   |       |                                 materials/, beside the decks, because
   |       |                                 a storage_key is a path in this
   |       v                                 repository
   |    work/<RUN>/documents-<stem>-paper.yaml
   |       |                                 one Document per format, through the
   |       |                                 same documentRecord and emitter
   |       v                                 `ainar materials build` writes with
   |    ainar approve                        and then the professor's own line:
   |       |                                 instructions_document_id: DOC-…
   |       v
   |    the pane's Exams tab opens it        `Paper` is that field. Unrecorded, a
   |                                         printed paper reads as `no brief`
   |
   +--> ainar score-items                    src/scoring.ts — 810 judgements on a
   |                                         30-question paper across 27 students,
   |                                         every one a comparison against a key
   |                                         already written down. No model in the
   |                                         path; one would only add a failure
   |                                         mode. What the model does add is the
   |                                         second half: an option tagged
   |                                         indicates_misconception_of turns
   |                                         "twelve chose (b)" into a statement
   |                                         about what twelve students believe
   |
   +--> bin/export-exam-lms.ts               Moodle XML, Canvas QTI, QTI 1.2.
                                             --publish is refused on purpose:
                                             export a file, review it, import it
                                             by hand
```

`exam-paper.ts` spawns `render-exam.ts` rather than importing it, because the
renderer exports nothing and calls `main()` at module scope. Spawning reuses the
renderer exactly as it is tested instead of forking a second copy of it, which is
the mistake [`PROVENANCE.md`](PROVENANCE.md) records for the slides plugin.

**A paper nobody recorded is a file, not a record.** The printing half used to
end at the filesystem, and the pane's Exams tab draws its `Paper` row off the
assessment's `instructions_document_id` — so a paper that existed and was never
registered read as `no brief`, which is a wrong claim rather than a missing
control. Each printing is therefore also described as a `Document` and written as
a draft, and nothing here writes to `courses/`: approval stays the only way in.
The last hop is the professor's and is printed rather than performed, because an
approved `Assessment` cannot be restated by a draft — `approve.collision` refuses
the identifier — which is the same shape `homework publish` uses when it hands
back `extensions.github.template_repo`. `--no-register` prints without proposing
anything, and a paper written outside the workspace says why it cannot be a
record instead of drafting a `storage_key` that would fail `document.missing_file`.

**Two gaps on this path, both now in [`BACKLOG.md`](BACKLOG.md).**

- `export-exam-lms.ts` requires `correctOptions` on every choice question, and
  `exam-paper.ts` strips the key on purpose — so **nothing in this repository
  produces JSON the exporter will accept** for a choice item. The only files
  carrying that field are its own tests. (`VAR-7`)
- `ItemModel` — `scenario_variables`, `difficulty_features`, `allowed_item_types`
  — is the question family, and **nothing instantiates it**. It is stored,
  exported, written to SQL and read by no code that produces an item. A
  multi-variant quiz can therefore be fully described in the record today, and
  exactly one paper can be printed from it. (`E14`)

---

## 4a. Publishing, and where the gate went

The five properties above are unchanged; one *step* moved, on 2026-09-21.

Every pipeline here used to end at a file plus a sentence telling the professor
to go and run something else — `ainar approve` in a terminal before a deck could
appear on a page, and then the publishing command after it. Two programs for one
intention, and the first of them typed from memory.

`ainar publish` is those two acts in one, per target:

```
  ainar publish {page|telegram|homework|canvas}     src/publish.ts
     |
     +-- no --confirm: the plan                     pendingMaterials + the target's
     |      what it would promote                   own read. Writes nothing, anywhere
     |      what it would then publish
     |      what it would hold back or refuse
     |
     +-- --confirm:
            runApproval(collections = documents, resources)   src/approve.ts
               the SAME order: load, promote, stage, validate, write
            re-read the record                      the deck promoted a moment ago is
               |                                    the one the page has to carry
               v
            buildCoursePage / publishHomework / runLms / sendAnnouncement
```

**Why the line is at documents and resources.** An artefact is a thing the
professor is publishing; pressing *publish* having read what would go out **is**
the act of standing behind it. An `Evaluation` is a judgement about a person, and
nothing about that press says whether a suggested score is right. So the drafted
evaluation sitting in the same `work/<RUN>/` is reported as *left alone* and
stays a proposal — enforced by the `collections` argument, not by anybody's care,
and pinned by `test/publish.test.ts`.

**The minor change, which is the commonest one.** A material that is already a
record cannot be re-approved — `approve.collision` refuses the identifier — so
for a long time the only sanctioned way to fix a word was a new `Document` with
`supersedes` set, which nothing in the code reads. What actually happens is that
the professor edits the file in place, and until 2026-09-21 nothing noticed:
`validate` checks a checksum's *format* and never compares it to the file.

`src/freshness.ts` closes that. Every publication compares each repository-held
material against its recorded checksum and sorts what it finds:

```
  changed     a source edited since it was recorded        -> re-stamp, version + 1
  rebuilt     a rendering regenerated after its source     -> re-stamp, version + 1
  drifted     a rendering edited on its own                -> re-stamp, and say so
  stale       a rendering whose source changed and which   -> HELD BACK from the
              was not rebuilt                                 page, and the source
                                                              is NOT re-stamped
  unstamped   no checksum was ever recorded                -> stamp it, no version
```

Two rules in there were found by running it rather than by thinking about it.
**A source with a stale rendering is not re-stamped**, because re-stamping it
would make the rendering stop looking stale and the next publication would copy
a PDF of the old text having warned exactly once. And **a rendering counts as
rebuilt when its own bytes moved**, because without that the first rule
deadlocks: the source is never recorded, so the rendering is stale forever.

The write goes through `setRecordFields` rather than the YAML document API, and
that is measured too: re-emitting a parsed document re-wraps scalars and re-pads
flow sequences, so stamping two checksums rewrote twenty-four lines of a
professor's file. The line-level writer changes the lines it means to and parses
the result to prove it landed.

**And what was sent, which the record cannot hold.** The record says what the
course *is*; it has no field for what left the machine, when, or to which
channel — so a page rebuilt from an unchanged record is indistinguishable from
a page nobody ever built. `Ledger` in `src/lms/ledger.ts` gained a fifth
section, `publications`, beside the gradebook values and the Canvas assignment
specs it already keeps for the same run in the same file. One entry per
destination — the last, not a history — carrying where it went, when, what came
back, and the checksum of every material that went with it:

```
  Last published 2026-09-19T14:02:00+05:00 to dist/pages/CSS-4008-2026-FALL.
    1 thing(s) have changed since:
      DOC-4410 changed since then — Model evaluation and overfitting — slides
```

Checksum against checksum, so the answer names the files rather than saying
that something moved. It is outside the repository for the reason the rest of
that file is: this is what **one machine** sent, not a fact about the course.
Canvas is the exception and writes nothing new — `assignments` already records
the spec sent and the id returned, per assessment per course, and that is the
entry `assignment-plan` reads to tell a change from drift. A second copy would
be a second answer to "what did we send".

Two consequences worth knowing:

- **Publishing twice publishes twice.** `approve` never removes a draft, so a
  second press would promote the same identifier again and collide. A draft
  whose promoted id is already in the record is rejected from the approval and
  reported as `already DOC-9001 — left as it is`.
- **The pane and the skill are this command.** `POST /professor-pane/api/publish`
  spawns it, and the `/publish` skill runs it. Neither reimplements a step, for
  the reason `src/approve.ts` gives about two gates disagreeing.

## 5. Views of the course

The remaining outputs share the shape but skip the drafting half: they read an
already-approved record and write a file.

| Command | Reads | Writes | The rule that governs it |
| --- | --- | --- | --- |
| `ainar page RUN` | the plan — weeks, meetings, rooms, weights | `dist/pages/<RUN>/` | The only output written for a public URL. Material files are **copied, never transformed**, and only after the answer-key scan. A `storage_key` under `work/` is not published; anything unreadable as text is held back rather than published unscanned, and said so in the report. |
| `ainar dashboard RUN` | marks | `dist/<COURSE>/<RUN>-progress.html` | The private opposite. Students by pseudonym. The tests assert that these figures cannot appear on the page above. |
| `ainar export` | everything | `dist/bundle.json`, one context document per run | Plain JSON. Nothing here writes to a database. |
| `ainar sql` | everything | `dist/import.sql` | Idempotent, and pinned line by line to a 655-line golden file. |
| `ainar lms push` | the gradebook | a CSV, or a live API with `--confirm` | Names, numbers and emails are joined in from the private roster at the moment of export and never written back. A file that names students is refused a path inside the workspace. |

`ainar page` is **the widget, not a second renderer**:
`vendor/ainar/mcp/widget-assets/` holds one copy of the view and
`bin/prerender-widget.mjs` runs it against the payload, so what a professor hosts
and what a model draws beside its own answer cannot become two renderings of one
course.

A **template** can be chosen for the page and for the dashboards
(`src/templates.ts`), and its limits are the design. A template changes how
output looks and never what it says: it carries no figure, no total, no outcome,
no weight, because a template that could add a block could add a block derived
from student work. A style sheet containing `<` is refused rather than escaped,
since the page embeds it inside `<style>`.

---

## 6. Reading this when something breaks

| Symptom | Layer | Where to look |
| --- | --- | --- |
| A skill wrote something the loader refuses | Draft | `src/drafts.ts` — is the collection in `DRAFTABLE` at all? |
| `approve` refuses | Gate | It prints its coverage every run. This gate implements a subset of the 94 checks, and a narrower refusal is a narrower gate |
| A deck renders but disagrees with its plan | Build | `checkContract` in `src/deck.ts` — one of the two was edited after the other |
| A slide runs off the page | Build | `deck fit`. A slide holding an image reports an upper bound, so "may overflow" means may |
| The `.pptx` appears and the PDF does not | Render | LibreOffice was not found. `SOFFICE` overrides the search |
| `render-deck` refuses a document | Gate | Its `storage_key` is still under `work/` |
| A paper prints a total that looks wrong | Build | It does not silently fix one. The warning on stderr is the disagreement |
| A material is missing from the published page | Refusal | The answer-key scan, or a file held back as unreadable. The report names which |

---

Written 2026-09-20 against the tree at that date. The five properties in §1 are
the part worth keeping true; the arrows are the part that will move.
