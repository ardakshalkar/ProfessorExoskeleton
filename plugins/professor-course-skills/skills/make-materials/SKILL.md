---
name: make-materials
description: Draft teaching material for a module — lecture slides, handouts, lab notebooks, worked examples — grounded in the module's concepts and outcomes, and registered as Documents and Resources for the professor to approve, then rendered to PowerPoint once approved. Use when the user asks to generate, write or draft slides, a lecture, a handout, lab material, a worked example, or teaching materials for a week or module, or asks to turn approved slides into a .pptx or PowerPoint deck.
stage: design
requires: [modules, concepts]
produces: [documents, resources]
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

# Draft teaching material

**Needs:** a course in YAML. Works fully without the CLI. Rendering to `.pptx`
additionally needs the `pptx` skill; the markdown is complete without it.

You write the artefacts that serve claims the course already makes. You do not
add claims. If the material you would need to write requires a concept or
outcome the course does not have, stop and say so — that is the professor's
decision, not yours.

## 1. Ground the material

```bash
bin/ainar context CSS-4008-2026-FALL --date 2026-10-05
```

Then read, and use all of it:

- **The module** in `modules.yaml` — its outcomes, its concepts,
  its estimated hours. These bound what the material may cover.
- **Prerequisites** of each concept, from the graph in the context document.
  Material that assumes a prerequisite the class has not demonstrated is
  material that will not land.
- **The previous module** — what was taught last week is what you build on.
- **The scheduled activity** in `activities.yaml` — its type and duration set
  the shape. A 100-minute lecture and a 150-minute lab are not the same
  artefact.
- **Existing resources** for the same concepts. Do not duplicate them; refer
  to them by identifier.
- **Class state** — `samples/concept-states.yaml`, open signals, and item
  responses. A shared misconception in the data belongs in the material, as a
  five-minute correction before the new content.

## 2. See how it is taught elsewhere

Before writing, spend a few minutes on how other people teach this. A worked
example that has survived a decade of lectures beats one invented this morning,
and the commonest defect in generated material is not error — it is that the
explanation has no idea which step students actually trip on.

Search for teaching material on the module's concepts: published lecture notes,
course pages, textbook chapters, conference tutorials. Read two or three
properly rather than skimming eight.

What to come back with is **insight, not text**:

- the order they introduce the ideas in, and where that differs from ours
- the worked example or analogy they reach for, and what it makes concrete
- the misconception they spend time on — that is the expensive knowledge
- what they leave out

**Never copy.** Not slide text, not problem statements, not figures, not an
exercise with the numbers changed. This is the same rule `/find-ideas` runs
under and for the same reason: material from another institution is evidence
about the subject, not authority over this course, and its licence is theirs.
Write the explanation yourself, in this course's identifiers and this course's
sequence.

Where a source shaped what you wrote, say so — in the report, with the URL. A
professor asked "where did this example come from" should not have to guess.

Two cases where this step is skipped rather than shortened: the professor gave
you their own material to work from, in which case that is the source and
looking further is a distraction; or no network is available, in which case say
so in the report rather than pretending the survey happened.

Material handed over is often handed over by being dropped in `imports/` rather
than named in the conversation, so look there before surveying the web. Name the
file you used.

If the answer that comes back is bigger than one lecture — a different syllabus
shape, a topic we do not cover at all — that is `/find-ideas`, not this. Report
it and stop; adopting it is the professor's decision and `/propose-concepts`
runs on that decision.

## 3. Write it

`templates/` beside this skill holds the three shapes this produces — a Marp
deck, a handout, a lab notebook — with `document-draft.yaml` for the records that
register whichever you write. Read `templates.yaml`, show the professor the list,
and use what they pick; with no preference, use the default and say which it was.
The scheduled activity usually settles it, and a 100-minute lecture and a
150-minute lab are not the same artefact. `references/templates.md` has the
convention.

Fill every `{{ slot }}` and delete the sections you do not need. Do not
restructure one: the check-for-understanding slide and the "where we are" opener
are in the template because they are the parts a deck loses first.

**Before filling a deck template in, choose the teaching sequence.** A template
is a shape; what goes in it is a decision about how the session moves. The
planning layer moved here from `professor-slides-skills` on 2026-09-16 and is
what stops the failure it was written against: title and three bullets, fifteen
times, every slide individually defensible and the cognitive operation never
changing while the material does.

- `beats/` — 29 teaching beats, each two to seven slides doing one teaching job,
  with the family and phase it belongs to. A ninety-minute lecture is normally
  five to nine of them. Read `references/teaching-beats.md` for how to choose,
  then read only the beats you picked.
- `references/deck-grammars.md` — the shapes a whole deck can take.
- `references/outline-craft.md` — how to write the arc before any beat: what the
  session argues, not what it covers. If you cannot state the argument as a
  claim rather than a topic, the session does not yet have a point; say so
  instead of producing slides.
- `references/visual-grammar.md` — what each slide's text is *for*, its role and
  density; `references/text-style.md` for how to write it; and
  `references/typography.md` for what the renderer sets and why.

For a slide deck, plan before rendering. Resolve presentation preferences from
`preferences/defaults.yaml`, local `.ainar/preferences.yaml`, an optional
course `preferences.yaml`, and finally the current task. Record the resulting
audience, style, duration, outcome coverage and slide sequence in the Document's
`presentation_plan`; do not bury those decisions only in prose.

Write straight into the course, to `courses/<COURSE>/materials/<MATERIAL>/` —
**one folder per material**, named for its main file, with the result on top and
everything that made it underneath:

```text
courses/CSS-4008/materials/MODULE-06-slides/
  MODULE-06-slides.md          the result: what the professor opens
  figures/                     fig-01-split.svg, fig-02-gap.svg, found images
  build/                       scripts that produce a figure or a file
```

The professor opens the folder and sees the deck; the artefacts are in folders
they only open on purpose. This is where the material lives for good — nothing
moves it afterwards. What keeps it from students until the professor accepts it
is its record, marked `approval: draft` (§4), not where the file sits. A file
written straight into `materials/` with no folder of its own still works, but it
is the old layout — do not start new material that way. A course that already has a flat `materials/`
is regrouped by `ainar organize-materials <COURSE> --dry-run` (then without the
flag): it moves each deck, its sidecars, figures and scripts into one folder,
rewrites every recorded path and figure link, and reports what it would not
guess at.

Use **markdown**, not binary formats: markdown diffs, reviews and converts.
Slides use Marp front matter so they render as a deck.

```markdown
---
marp: true
title: Model Evaluation and Overfitting
module: MODULE-06
course_run: CSS-4008-2026-FALL
outcomes: [LO-02, LO-04]
concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
generated_by: make-materials-skill
---
```

`courses/CSS-4008/materials/MODULE-06-slides.md` is a worked
example of the shape — read it before writing your first deck, along with
`MODULE-06-slides-fig-01-split.svg` beside it and the `DOC-4411` record in
`documents.yaml`, which are a worked example of a figure. (That sample
predates folders and sits flat; new material follows the folder layout above.)

What good material does here:

- **Opens by placing the session** in the sequence: what students can already
  do, what today adds.
- **Names concepts by identifier** where the structure matters, so the
  material and the model stay connected.
- **Handles the known weakness first.** If item responses show a shared
  misconception, correct it explicitly and early, and say which item revealed
  it.
- **Ends with checks for understanding**, one per new concept, phrased as a
  question a student answers rather than a topic they nod at.

**Pictures follow the same rule as prose.** What you write is the thing that
generates the picture — an SVG, a manim scene, a chart built from an `ainar`
command — never only the picture. Figures live in the deck folder's `figures/`,
and are linked relative to the deck so the link holds wherever the course is
checked out:

```markdown
![Training data, validation data and a held-out test set never touched during
tuning](figures/fig-01-split.svg)
```

Never draw a chart of this class's performance that no command produced, and
never draw one of external data you cannot cite. `references/presentation-graphics.md`
has the five kinds of graphic, the naming and linking conventions, and the
accessibility rules — read it before adding the first figure.

`.pptx` comes later, in step 7, from the *approved* markdown.

## 4. Register it

Write the records into the course, marked `approval: draft`: the Document in
`courses/<COURSE>/documents/generated.yaml`, the Resource in
`courses/<COURSE>/resources/generated.yaml`. (If the course already holds these
records elsewhere — a hand-authored `documents.yaml` — edit them there.)

```yaml
documents:
  - document_id: DOC-0601
    approval: draft
    title: Model evaluation and overfitting — slides
    storage_key: courses/CSS-4008/materials/MODULE-06-slides/MODULE-06-slides.md
    mime_type: text/markdown
    course_run_id: CSS-4008-2026-FALL
    module_id: MODULE-06
    concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
    generated_by:
      produced_by: make-materials-skill
      model_id: claude-opus-5
      workflow_version: claude-code/prototype
      prompt_version: make-materials/v1
      input_refs: [MODULE-06, LO-02, LO-04, SIGNAL-772]
      created_at: 2026-09-28T10:52:00+05:00
    presentation_plan:
      audience: second-year students
      style: lecture
      duration_minutes: 100
      max_slides: 24
      outcomes: [LO-02, LO-04]
      concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
      slides:
        - number: 1
          type: hook
          title: When a high score is not evidence
          minutes: 5
          purpose: surface the shared train/test misconception
          concepts: [CONCEPT-MODEL-EVALUATION]
        - number: 2
          type: concept
          title: Training evidence versus held-out evidence
          minutes: 8
          outcomes: [LO-02]
          concepts: [CONCEPT-TRAIN-TEST-SPLIT]
          required_visual: annotated train-validation-test split

resources:
  - resource_id: RES-0601
    approval: draft
    title: Model evaluation and overfitting — slides
    kind: slides
    course_run_id: CSS-4008-2026-FALL
    document_id: DOC-0601
    concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
    required: true
```

The identifiers are the final ones and the `storage_key` is the file's real
place in the course — nothing renames or moves either when the professor
accepts it.

**Every figure is its own `Document` too** — same file, `mime_type:
image/svg+xml`, no `Resource` of its own, also `approval: draft`. An
unregistered figure is a file `ainar validate` never checks and the course record
knows nothing about — no credit, no alt text, no approval of its own.

Do **not** compute `size_bytes` or `checksum` — those are computed from the
file itself, and a hand-written one is worse than none.

If the material replaces an earlier version, set `supersedes` to the document
it replaces rather than overwriting it.

**A correction is not a replacement.** Fixing a word, a figure or a slide in
something that already exists is `/revise`: the file is edited in place, no new
identifier is written, and the record catches up when it is published. Reach
for `supersedes` only when this genuinely is a different material standing in
for an old one — a rewritten handout, not a corrected one.

## 5. Check it

```bash
bin/ainar validate CSS-4008
```

Drafts are validated in place like any other record.

## 6. Hand over

Summarise what you wrote in three or four lines — which module, which concepts
covered, what you handled from class state, and anything you deliberately left
out. Then say what is waiting and where:

> The deck is in `courses/CSS-4008/materials/MODULE-06-slides/`. `DOC-0601`, its
> figures' Documents, and `RES-0601` are in `documents/generated.yaml` and
> `resources/generated.yaml`, marked `approval: draft`. To accept one, change
> `approval: draft` to `approval: approved` (or delete the line); to reject one,
> delete the record. `bin/ainar drafts CSS-4008-2026-FALL` lists everything
> waiting. Until then the course page and `ainar publish` leave them out.

**Never write `approval: approved` yourself.**

Say that the deck can be rendered to `.pptx` once approved, and stop there. Do
not render as a flourish.

## 7. Render it — only after approval

Markdown is the source; `.pptx` is a rendering of it, and the two must never
compete for authority. So render the deck once its Document is **accepted** —
no longer `approval: draft` — not while it is still a proposal. A deck rendered
from a proposal looks finished, and a professor opening it in PowerPoint has no
way to see that nobody approved what is inside it. The draft lives in the course
and the command will render it in place; what keeps it from students is its
record, so waiting is your discipline here, not the command's.

Writing the file is yours to do — like `lms push --target canvas-csv`, it
produces something inert until a person presents it. One command does it:

```bash
ainar deck render --document DOC-4410 --course-version CSS-4008-2026-FALL --pdf
```

It reads the deck's markdown, the `.plan.yaml` beside it, the figures in its
folder and — from the course record — the figure credits on `Document`s and the
`presentation_plan`, and writes `<DECK>.pptx` into the deck's own folder,
`courses/<C>/materials/<DECK>/`, where its rendering is recorded — plus the PDF
with `--pdf`, converted from that same deck by LibreOffice rather than rendered
a second time. Rasterized PNGs go to the gitignored `output/<DECK>/`, and
nowhere else. For a deck the course builds from `materials.yaml`,
`ainar materials build` is the same render with its Document record written
into `documents/generated.yaml` after it, marked `approval: draft` (a rebuild
keeps an already-accepted record accepted).

To look at a deck that is still a draft, render it with `--draft`: it goes to
`output/<DECK>/`, marked DRAFT on every slide, and nothing lands beside the
markdown.

**Do not do this by hand.** Four rules are enforced in that command rather than
left to judgement, and each of them is a mistake this skill made before it
existed:

- **Nothing but a recorded deck's own render goes into `courses/`.** A `--draft`
  render, with its placeholder figures, is refused there.
- **The plan is the contract.** Slide count, order and titles must match the
  markdown, or it exits and says where. One of the two was edited after the
  other; which is wrong is the professor's question. Nothing reorders slides to
  make them agree. A `presentation_plan` on the record that has fallen behind
  the deck is reported, not refused — the record needs re-registering.
- **Attribution is enforced.** A figure whose plan entry or `Document` records an
  `image_source` without an attribution line stops the render.
- **Overflow is reported.** Any slide running past the bottom margin is named.
  `ainar deck fit DECK.md` answers the same question before rendering, with the
  renderer's own layout.

Then look at the PDF. The first render usually has a real defect or two —
misjudged image height, a list that lost its numbering — and they are obvious in
the pages and invisible in the source.

If the deck needs a picture you did not draw,
`ainar-node/bin/find-image.ts` searches openly-licensed images and prints the
`Document` draft carrying the licence and credit. Read the "Images you did not
draw" section of `references/presentation-graphics.md` first: what may be
searched, what must be drawn, and why a generated illustration is captioned as
one.

A `required_visual` with no figure beside it is not left blank and shrugged at.
**Write the prompt that would produce it** onto the figure's `Document`, under
`extensions.image_prompt`, and report that the slide is waiting on an image. The
prompt is language work, so writing it is yours; running it is the professor's,
with whatever generator they have. `ainar deck render` then captions the result as a
generated illustration, which is the half that must not be forgotten.

`references/presentation-graphics.md` has the record shape and, more
importantly, how to write one: *specific about the thing, silent about the
truth*. The negative half of the prompt is the load-bearing half — no numbers,
no axes, no labelled data, no screenshots of results. An image model asked for
"a machine learning results dashboard" returns plausible axes and invented
numbers, and a student cannot tell that from a real result at ten metres.

Which is why this applies to illustrations only. **A chart is never prompted and
never generated** — if the slide needs a chart of this class, it comes from an
`ainar` command, and if there is no command for it the slide says so in words.
Same for a person, and for any logo or mark. Those three stay unfilled and
reported.

Do not register the render as a `Document`. It is reproducible from the markdown
at any time, and a second artefact with a second checksum leaves the professor
with two decks and no way to tell which one the model knows about. If they then
edit the deck in PowerPoint, **report that as drift and leave it** — the edited
slide may well be the better one, and folding it back into the markdown is their
call, not yours.

The renderer needs `pptxgenjs` and `sharp` (`cd node && npm install pptxgenjs
sharp`). `--pdf` additionally needs LibreOffice, and that dependency is chosen
rather than inherited: LibreOffice *converts this exact deck*, so the PDF is a
picture of what the professor will present. Anything that renders the markdown a
second time produces a different document that merely looks the same, and then
there are two PDFs and no way to say which one the slides are.

Missing either, say which, and hand over what is honest about being a substitute:

**No LibreOffice, PDF wanted for review.** Marp renders straight to PDF and needs
only a browser, no LibreOffice at all. It is a second rendering of the markdown,
not a conversion of the deck — fine for reading through and checking the words,
wrong for anything presented or handed out. Say that when you hand it over:

> ```bash
> npx @marp-team/marp-cli courses/CSS-4008/materials/MODULE-06-slides.md --pdf --pdf-outlines -o output/CSS-4008-2026-FALL/DOC-4410-review.pdf
> ```

**No `pptxgenjs` or `sharp`.** Marp will write a `.pptx`, and it is worse than it
looks: each slide is a flat image, so nothing in it can be edited, and none of
the checks above runs — not the plan match, not attribution, not overflow.

> ```bash
> npx @marp-team/marp-cli courses/CSS-4008/materials/MODULE-06-slides.md --pptx -o output/CSS-4008-2026-FALL/DOC-4410.pptx
> ```

Both need a Chromium-based browser or Firefox, which Marp drives through
puppeteer-core. Neither is the renderer; both are what you offer while saying so.

## Without the CLI

Read the module, its concepts and their prerequisites, and the scheduled
activity from the files directly rather than from `ainar context`. Draft the
markdown exactly as described above.

Two things change. **Leave `size_bytes` and `checksum` out of the `Document`
draft entirely** — they are computed from the file, and a hand-written
sha256 is worse than an absent one. And say which shared misconceptions you
worked from, or that you had none: without recorded item responses the material
is grounded in the course design rather than in what the class showed.

Step 6 is unaffected — rendering needs the `pptx` skill and the approved
markdown, not the CLI. What it does need is for approval to have happened, which
by hand means the professor changed the Document's `approval: draft` to
`approval: approved`, or deleted the line. A Document still marked
`approval: draft` is not approved, however finished it reads, and is not what
you render. One thing gets harder: a chart of class
performance has no `ainar gradebook` behind it, so there is no chart. Say that
rather than drawing one from numbers you totalled.

`references/working-without-the-cli.md` carries the file layout, the identifier patterns, the read-based checks and how approval works by hand. Read it before starting.

## Rules

- **The template gives the shape; the professor picks it.** From `templates/`
  beside this skill. A slot with nothing to put in it is deleted or answered
  honestly, never filled with a plausible sentence.
- **Serve the claims, never add them.** No new outcome, concept, prerequisite
  or assessment criterion. If the material needs one, say which and stop.
- **Stay inside the module.** Material that wanders into next week's concepts
  breaks the prerequisite ordering the whole model rests on.
- **Do not invent sources.** No citations, statistics, dataset descriptions or
  quotations that are not in the course material you were given. A worked
  example you construct yourself is fine and should be labelled as such.
- **Do not duplicate an existing resource.** Reference it.
- **Say what you generated.** `generated_by` is not optional. A professor
  presenting these slides should be able to see they were drafted by an agent.
- **Markdown, not binaries.** The source of truth must be reviewable in a diff.
  What you commit is what generates a picture — an SVG, a manim scene, a chart
  built from a command — never only the picture.
- **Plan, then render.** Slide numbers are unique, timings approximately fill
  the session, the plan stays within `max_slides`, and every new concept is
  traceable to the module and an outcome.
- **Render after approval, never before,** and into gitignored `output/`. A
  `.pptx` built from a draft is a proposal wearing the clothes of a finished
  deck.
- **No figure a command did not produce and you cannot cite.** A hand-plotted
  chart of this class's marks is the hand-totalled gradebook again, in the medium
  least likely to be questioned. If the figure has no source, the slide says so
  in words.
- **Alt text on every figure, and colour never the only channel.** Slides are
  read by people who cannot see them and projected by lamps that cannot show
  red.
