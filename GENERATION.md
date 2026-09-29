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
  DRAFT            courses/<COURSE>/…      src/approval.ts — AGENT_WRITABLE, and its omissions
                   approval: draft         src/records-write.ts — RECORD_FILES, upsert by id
     |
     v
  ===== GATE ===== the professor changes   src/approval.ts — isApproved, approvedView
                   the word                (an evaluation: professor_decision beside
                                           the ai_suggestion). No command does it
     |
     v
  RECORD           courses/<COURSE>/       vendor/datalayer/schema/ — 28 schemas
                   accepted records only   what every builder below reads
     |
     v
  BUILD            record -> intermediate  src/slides/, src/page.ts, bin/exam-paper.ts
     |
     v
  ==== REFUSAL === answer keys, student names, unapproved files   src/safety.ts
     |
     v
  RENDER           intermediate -> bytes   src/slides/render.ts, bin/render-exam.ts
     |
     v
  OUTPUT           dist/, output/<DECK>/   never in git. An artefact that becomes
                   courses/<C>/materials/  a record lives beside the course
```

Five properties hold at the same places every time, and they are the reason the
shape is worth naming:

| Where | What holds | Enforced in |
| --- | --- | --- |
| Draft | An agent may propose 16 collections and no others. Not outcomes, not capabilities, not enrollments — and since 2026-09-05 not concepts or modules either, because the structure of a course is the professor's own authoring. Each proposal is written into the course file its collection belongs in, with its final identifier, marked `approval: draft` (an evaluation `status: suggested`, an intervention `status: proposed`). | `src/approval.ts` (`AGENT_WRITABLE`), `src/records-write.ts` |
| Gate | Nothing a person has not accepted reaches a student. Accepting is changing the word — `approval: draft` to `approved`, or a `professor_decision` with `decided_by` and `decided_at` beside a grade's `ai_suggestion` — and it is visible in a diff. No command performs it: `ainar approve` was removed on 2026-09-29, and `ainar publish` approves nothing. A record with no `approval` field is approved, which is what keeps hand-authored courses reading as they did. | `src/approval.ts`, `src/validate.ts` |
| Build | Every builder that could publish reads `approvedView` — accepted records only. The page, the gradebook, extract-evidence, the roll-up and the LMS push never see a draft; `publish` names the drafts it left out, and refuses a homework or Canvas publication of an assessment still marked draft. | `src/page.ts`, `src/publish.ts`, `src/gradebook.ts` |
| Refusal | The answer-key scan before publication has no override. A file that names students is refused a path inside the workspace. | `src/safety.ts`, `src/lms/base.ts` |
| Output | Build products go to `dist/` or `output/<DECK>/`. An artefact meant to become a record — a recorded deck's own render, from `ainar deck render` or `materials build`, a printed paper — is written beside the course under `materials/<DECK>/` instead, because a `storage_key` with no scheme is a path in this repository and a record may not point at a build directory. The YAML under `courses/` is written through one emitter that upserts by id and keeps a hand-authored file's comments, which is what keeps it diffable. | every command, `src/records-write.ts` |

**Build and render are separate on purpose.** The build half has the opinions and
no I/O, so it is testable without a course on disk; the render half does I/O and
calls a third-party writer, which is not worth a test. `src/slides/deck.ts` says this
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

**Read it this way.** If a skill ends by writing YAML marked `approval: draft`
into the course, it is on the record path and everything in §1 applies to it. If it ends by handing the
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
courses/<C>/documents/generated.yaml         a Document with a storage_key under
   |                                         courses/<C>/materials/<DECK>/, marked
   |                                         approval: draft. Nothing moves later
   v
the professor changes the word               approval: approved — or leaves it, and
   |                                         the page leaves the deck out
   v
ainar deck render --document DOC-nnnn       renders a draft like any other, and
   |   (or FILE.md, or materials build)      refuses a storage_key that is not markdown
   |   splitSlides / parseBlocks             src/slides/deck.ts — Marp's ---
   |                                         convention, so the same file is a deck
   |                                         in a Marp previewer and a deck here
   |   checkDeck                             src/slides/check.ts — the .plan.yaml
   |                                         beside the deck is the contract: count,
   |                                         order and title must agree, and a
   |                                         mismatch EXITS rather than reordering
   |                                         either one. Also the mode's approval
   |                                         gate, figure credits (plan, then the
   |                                         Document), alt text, density
   |   placeFor                              where it may write, decided once
   v
courses/<C>/materials/<DECK>/<DECK>.pptx     a course deck, accepted or draft, beside its markdown —
output/<DECK>/<DECK>[-draft].pptx            anything else, and every --draft.
   |                                         Rasterized PNGs: output/<DECK>/ always.
   |                                         pptxgenjs + sharp, from ainar-node's
   |                                         optionalDependencies — reading a
   |                                         course should not need a native
   |                                         image library
   +-- --pdf -> LibreOffice (src/pdf.ts)     a conversion of THIS deck, so the PDF
                                             cannot disagree with the .pptx. With
                                             no LibreOffice the .pptx is still
                                             written and the PDF reported, with why
```

There were two renderers here until 2026-09-29: `bin/render-deck.ts`, which the
diagram above used to describe and which nothing in the pipeline called, and the
slides plugin's `pres render`, which built every deck the course recorded. They
disagreed about fonts, layouts and where output went. The plugin's engine won —
it is what the records were built with, so keeping it changed no deck — and
moved to `src/slides/`, taking render-deck's gate, credit lookup and PDF
conversion with it. `render-deck` and `pres render` remain as aliases.

Two other doors open onto the same output.

- **`bin/build-deck.ts`** runs a hand-written deck script that draws by
  coordinate. The script imports nothing and default-exports
  `build({ deck, C, W, H })`; the kit is handed in, because the kit lives in this
  checkout and the script lives in the professor's course folder and neither can
  find the other. This is how the seven CSS-4007 decks are built.
- **`ainar materials build RUN`** runs the producers a course declares in its own
  `materials.yaml`, converts what needs converting, reads the result back to
  describe it, and writes its `Document` records into the course, marked
  `approval: draft`, through the same schema and emitter every writer uses — a
  rebuild replaces its record and keeps whatever approval it had. It exists because those three acts had drifted apart in a real
  course: seven decks from seven scripts, PDFs converted once by a person, and
  `Document` records written by an eighth script that knew nothing of the schema
  — which is how a field the model does not define got into a record and made the
  loader drop a document silently, for a month.
- **`ainar materials import RUN FILE.pptx --as DOC-nnnn`** is the mirror. It reads
  a finished deck somebody else made and proposes what is in it, matched against
  the course's **own** concept vocabulary, so an import cannot introduce a
  concept. An invented one would fail `validate`, and what it proposes is
  written marked `approval: draft`, for the professor to accept.

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
courses/<COURSE>/{assessments,items,item-models}/generated.yaml
   |                                         marked approval: draft. ainar validate
   |                                         refuses here, not later: a choice item
   |                                         with no correct option, duplicate
   |                                         option labels, two correct answers on
   |                                         a single-choice item
   v
the professor changes the word               approval: approved. An approved
   |                                         assessment resting on a draft item or
   |                                         brief is approval.depends_on_draft
   v
courses/<COURSE>/{assessments,items}/        accepted
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
   |    courses/<C>/documents/generated.yaml
   |       |                                 one Document per format, marked
   |       |                                 approval: draft, through the same
   |       v                                 documentRecord and emitter
   |    the professor accepts it             `ainar materials build` writes with,
   |       |                                 and then adds their own line:
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
control. Each printing is therefore also described as a `Document` and written
into the course marked `approval: draft`; a reprint replaces its own record —
new checksum, same approval. The last hop is the professor's and is printed
rather than performed, because the assessment's `instructions_document_id` is
the professor's own record — the same shape `homework publish` uses when it
hands back `extensions.github.template_repo`. `--no-register` prints without
proposing anything, and a paper written outside the workspace says why it
cannot be a record instead of writing a `storage_key` that would fail
`document.missing_file`.

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

The five properties above are unchanged; the gate *step* has moved twice.

Every pipeline here used to end at a file plus a sentence telling the professor
to go and run something else — `ainar approve` in a terminal before a deck could
appear on a page, and then the publishing command after it. Two programs for one
intention, and the first of them typed from memory. On 2026-09-21 `ainar
publish` folded the two together for documents and resources, promoting them out
of the drafts folder on the confirming press. On 2026-09-29 the drafts folder and
`ainar approve` went, and publishing stopped approving anything: accepting a
material is now changing one word in its record, and a publish that also
approved was two decisions behind one button.

```
  ainar publish {page|telegram|homework|canvas}     src/publish.ts
     |
     +-- no --confirm: the plan                     the target's own read.
     |      what it would publish                   Writes nothing, anywhere
     |      what it would hold back or refuse
     |      Not published — N draft(s)              records still marked
     |                                              approval: draft it left out
     |
     +-- --confirm:
            buildCoursePage / publishHomework / runLms / sendAnnouncement
               over approvedView — accepted records only
```

**Why publishing accepts nothing.** Pressing *publish* having read the plan is
a decision about whether students see what the professor has accepted, not about
whether a draft is right — still less about whether a suggested score is. So a
draft of any kind, a deck as much as an evaluation, is named in the plan and left
out; `publish homework` and `publish canvas` refuse an assessment still marked
draft outright. Pinned by `test/publish.test.ts`.

**The minor change, which is the commonest one.** A material that was already a
record could not, under the old gate, be approved again — `approve.collision`
refused the identifier — so for a long time the only sanctioned way to fix a word
was a new `Document` with `supersedes` set, which nothing in the code reads. What actually happens is that
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

`--rebuild` closes the loop. `materials.yaml` already declares what produces
what — a producer carries `document_id`, `source_document_id` and `produces`,
and writes its artefact under the course's own `materials/`, which is where a
recorded `storage_key` points. What was missing was the join: freshness knew
`DOC-4499` was stale and the manifest is keyed by producer id, so the professor
was left to work out which of their seven scripts made that PDF. `producerFor`
is that lookup, matching both halves of a producer because it is usually the
PDF that goes stale. A course declaring no producer for the file is told so
rather than handed a command that cannot help.

The same commit takes `extensions.rendered_from` seriously. `materials.ts` had
already said the stem convention is what that field exists to replace, and it
is written by whatever made the file rather than reconstructed later — so where
it is present it decides, and the stem is the fallback for materials made
before anything wrote it. That is not pedantry: `week-06-notes.txt` built from
`MODULE-06-slides.md` shares no stem with its source, and the convention cannot
see that pair at all.

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

**One press for everywhere it already went.** `publish update RUN` reads the
ledger's destinations for the run and revisits each — the page, the Canvas
briefs, the starter repositories — oldest first, which is the order they fell
behind in. It never publishes anywhere for the first time: that set is what has
already been sent, so an update cannot surprise a class with something they were
never given. A destination that fails is reported and the loop goes on, because
a fan-out that stopped at the first failure would leave some destinations
current, some not, and no list of which. `runAssignment` throws rather than
returning a code when a run names no Canvas course, so the loop catches throws
too — a single publication re-throws, since there is nothing to carry on to.

Telegram is excluded from that set by `UPDATABLE` and named in the plan rather
than dropped: a page is derived from the course and an announcement is what the
professor typed, so there is nothing to re-derive it from. What exists instead
is `publish telegram --edit`, which edits the message already in the channel
using the id the ledger kept — never the default, because a second announcement
is the ordinary case and silently rewriting the first would destroy something
students had read.

**The small change, and the read it starts with.** Everything above answers
*what follows an edit*; `src/impact.ts` answers *what am I about to edit* — one
document's file, whether it is a draft or a record, whether the file still
matches the record, what was rendered from it, what points at it, and where it
has already gone. `ainar impact DOC-4410` prints that and nothing else: it
writes nothing, reaches nothing, and recommends rather than performs. Its
`What follows` lines are assembled from the same facts as the report above
them, which is the property worth keeping — an agent reads those lines out, so
a step that appears when the report does not justify it is a wrong instruction
rather than a cosmetic bug.

That read is the routing this needed. Before it, *fix this word on slide 4* had
no cheaper answer than re-running `make-materials`, because the four facts
required to do less were in four places; the skill that now owns the decision
is `/revise`, and its table is four rows: the content of a material (edit the
file), a field of a record (no file exists, so say which line), an item (both),
and something that is not a revision at all.

Two consequences worth knowing:

- **Producing twice records once.** Every writer upserts by id, so building a
  material again, or reprinting a paper, replaces its record and keeps whatever
  approval it had, rather than adding a second record that would collide.
- **The pane and the skill are this command.** `POST /professor-pane/api/publish`
  spawns it, and the `/publish` skill runs it. Neither reimplements a step,
  because two implementations of one publication would sooner or later disagree.

## 5. Views of the course

The remaining outputs share the shape but skip the drafting half: they read an
already-approved record and write a file.

| Command | Reads | Writes | The rule that governs it |
| --- | --- | --- | --- |
| `ainar page RUN` | the plan — weeks, meetings, rooms, weights | `dist/pages/<RUN>/` | The only output written for a public URL. Material files are **copied, never transformed**, and only after the answer-key scan. A record marked `approval: draft` is not published; anything unreadable as text is held back rather than published unscanned, and said so in the report. |
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
| A skill wrote something the loader refuses | Draft | `src/approval.ts` — is the collection in `AGENT_WRITABLE` at all, and does `RECORD_FILES` give it a file? |
| A material or assessment is missing from the page or refused by `publish` | Gate | It is still marked `approval: draft`. The plan names it; `ainar drafts RUN` lists everything waiting. `approval.depends_on_draft` from `validate` is an approved record resting on one |
| A deck renders but disagrees with its plan | Build | `checkContract` in `src/slides/deck.ts` — one of the two was edited after the other. A recorded `presentation_plan` that has drifted is a warning: the record describes an older deck |
| A slide runs off the page | Build | `deck fit`, which lays the deck out with the renderer itself. Without pptxgenjs and sharp it says ESTIMATED, and a slide holding an image is then an upper bound |
| The `.pptx` appears and the PDF does not | Render | `src/pdf.ts` says why: not found (`SOFFICE_PATH` overrides), or its exit code and first stderr line. A PDF older than the run is never taken for its output |
| `deck render --document` refuses a document | Build | Its `storage_key` is the `.pptx` rather than the markdown |
| A paper prints a total that looks wrong | Build | It does not silently fix one. The warning on stderr is the disagreement |
| A material is missing from the published page | Refusal | The answer-key scan, or a file held back as unreadable. The report names which |

---

Written 2026-09-20 against the tree at that date. The five properties in §1 are
the part worth keeping true; the arrows are the part that will move.
