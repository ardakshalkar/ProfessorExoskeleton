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
> - Write to `work/<RUN_ID>/`, never into `courses/`. Draft identifiers carry a
>   `-DRAFT-` segment so they cannot be mistaken for records.
> - **Claims come from the professor.** Never invent a learning outcome, a
>   rubric criterion or an assessment weight — write `TODO` and say what is
>   missing. Artefacts that serve an existing claim you may draft; that is the
>   job. Concepts and modules may be **proposed** from source material the
>   professor supplied, with `extensions.proposal.source` naming where each came
>   from — proposed, not invented, and inert until approved.
> - **Never run `ainar approve`,** and never `ainar lms push --target canvas-api`
>   or `--target sheets-api`. Approving your own suggestion, or posting a grade a
>   student can see, is the one place a human enters. Show the command instead.
> - **No student name, email or institutional number in any file,** including a
>   grading comment or a lesson brief. Write the identifier.
> - Before reporting anything: `bin/ainar validate <COURSE> --drafts
>   work/<RUN_ID>`, and fix every error.
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

For a slide deck, plan before rendering. Resolve presentation preferences from
`preferences/defaults.yaml`, local `.ainar/preferences.yaml`, an optional
course `preferences.yaml`, and finally the current task. Record the resulting
audience, style, duration, outcome coverage and slide sequence in the Document's
`presentation_plan`; do not bury those decisions only in prose.

Write to `work/<RUN_ID>/materials/`. Use **markdown**, not binary formats:
markdown diffs, reviews and converts. Slides use Marp front matter so they
render as a deck.

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
`documents.yaml`, which are a worked example of a figure.

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
command — never only the picture. Figures live flat beside the deck, named after
it, and are linked as siblings so the link survives approval:

```markdown
![Training data, validation data and a held-out test set never touched during
tuning](MODULE-06-slides-fig-01-split.svg)
```

Never draw a chart of this class's performance that no command produced, and
never draw one of external data you cannot cite. `references/presentation-graphics.md`
has the five kinds of graphic, the naming and linking conventions, and the
accessibility rules — read it before adding the first figure.

`.pptx` comes later, in step 7, from the *approved* markdown.

## 4. Register it

In the same directory, write `documents-draft.yaml`:

```yaml
documents:
  - document_id: DOC-DRAFT-0601
    title: Model evaluation and overfitting — slides
    storage_key: work/CSS-4008-2026-FALL/materials/MODULE-06-slides.md
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
  - resource_id: RES-DRAFT-0601
    title: Model evaluation and overfitting — slides
    kind: slides
    course_run_id: CSS-4008-2026-FALL
    document_id: DOC-DRAFT-0601
    concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
    required: true
```

**Every figure is its own `Document` too** — same file, `mime_type:
image/svg+xml`, no `Resource` of its own. An unregistered figure is one approval
never moves, so the approved deck ends up pointing at a file left behind in
gitignored `work/`.

Do **not** compute `size_bytes` or `checksum` — approval fills those in from
the file itself. Do not write `storage_key` pointing into `courses/`; approval
moves the file there.

If the material replaces an earlier version, set `supersedes` to the document
it replaces rather than overwriting it.

## 5. Check it

```bash
bin/ainar validate CSS-4008 --drafts work/CSS-4008-2026-FALL
```

## 6. Hand over

Summarise what you wrote in three or four lines — which module, which concepts
covered, what you handled from class state, and anything you deliberately left
out. Then:

> ```bash
> bin/ainar approve work/CSS-4008-2026-FALL --as USER-ARD-A01
> ```
>
> Approval moves the material into `courses/.../materials/`, stamps its size
> and checksum, and registers the document and resource.

**Never run `ainar approve` yourself.**

Say that the deck can be rendered to `.pptx` once approved, and stop there. Do
not render as a flourish.

## 7. Render it — only after approval

Markdown is the source; `.pptx` is a rendering of it, and the two must never
compete for authority. So the render reads the file **approval put in
`courses/`**, never the draft in `work/`. A deck rendered from a proposal looks
finished, and a professor opening it in PowerPoint has no way to see that nobody
approved what is inside it.

Writing the file is yours to do — like `lms push --target canvas-csv`, it
produces something inert until a person presents it. One command does it:

```bash
node --experimental-strip-types node/bin/render-deck.ts \
    --course-version CSS-4008-2026-FALL --document DOC-4410 --pdf
```

It reads the approved markdown, the `presentation_plan` on its `Document` and
the figures beside it, and writes `output/<COURSE_VERSION_ID>/<DOCUMENT_ID>.pptx`
— plus the PDF with `--pdf`, converted from that same deck by LibreOffice rather
than rendered a second time. `output/` is gitignored deliberately: built binaries
belong on the professor's disk, not in a repository whose value is that its
contents diff. Rasterized PNGs go there too, and nowhere else.

**Do not do this by hand.** Four rules are enforced in that command rather than
left to judgement, and each of them is a mistake this skill made before it
existed:

- **A document still in `work/` is refused.** A deck rendered from a proposal
  looks finished once it is open in PowerPoint.
- **The plan is the contract.** Slide count, order and titles must match the
  markdown, or it exits and says where. One of the two was edited after the
  other; which is wrong is the professor's question. Nothing reorders slides to
  make them agree.
- **Attribution is enforced.** A figure whose `Document` records an
  `image_source` without an attribution line stops the render.
- **Overflow is reported.** Any slide running past the bottom margin is named.

Then look at the PDF. The first render usually has a real defect or two —
misjudged image height, a list that lost its numbering — and they are obvious in
the pages and invisible in the source.

If the deck needs a picture you did not draw,
`node/bin/find-image.ts` searches openly-licensed images and prints the
`Document` draft carrying the licence and credit. Read the "Images you did not
draw" section of `references/presentation-graphics.md` first: what may be
searched, what must be drawn, and why a generated illustration is captioned as
one.

A `required_visual` with no figure beside it is not left blank and shrugged at.
**Write the prompt that would produce it** onto the figure's `Document`, under
`extensions.image_prompt`, and report that the slide is waiting on an image. The
prompt is language work, so writing it is yours; running it is the professor's,
with whatever generator they have. `render-deck` then captions the result as a
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
the four checks above runs — not the approval gate, not the plan match, not
attribution, not overflow.

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
draft entirely** — approval computes them from the file, and a hand-written
sha256 is worse than an absent one. And say which shared misconceptions you
worked from, or that you had none: without recorded item responses the material
is grounded in the course design rather than in what the class showed.

Step 6 is unaffected — rendering needs the `pptx` skill and the approved
markdown, not the CLI. What it does need is for approval to have happened, which
by hand means the professor moved the file into `courses/.../materials/`
themselves. A file still sitting in `work/` is not approved, however finished it
reads, and is not what you render. One thing gets harder: a chart of class
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
