# The deep workflow

The rigorous pass, in full. This was the plugin's only workflow, and it is the
right one for a session somebody has to get right: a new lecture, a topic whose
sequencing is genuinely uncertain, material other instructors will teach from,
anything an accreditation panel reads, a long deck, or a professor who asked to
approve the plan before a slide is written.

It is expensive on purpose. `pres route` sends you here only when there is a
concrete reason, and STANDARD is the default precisely so that this is not paid
for every request.

Plan in this order, and not in any other: **learning goal → deck grammar →
teaching beats → slides**. Going straight from a section to a list of slides
produces slides that are individually reasonable and collectively inert, which
is the single commonest defect in generated teaching material.

Paths below are written from `${CLAUDE_PLUGIN_ROOT}`. If that variable is empty —
the skills were copied into `~/.claude/skills/` rather than installed — the same
files sit at the root of the `professor-slides-skills` directory.

---

## 1. Find the course, and say where it came from

```bash
pres source --course CSS-4008
```

Read the provenance line and carry it into your report. A deck built from a
course directory while the professor believed they were working against the
shared database is a deck built from the wrong term's outcomes, and it looks
identical to a correct one. `references/course-source.md` has the resolution
order and what each failure means.

`--source database` refuses to fall back, which is what you want when the shared
copy is the only acceptable one. `--timing` says where the seconds went.

Then bound the session:

```bash
pres context --course CSS-4008 --module MODULE-06
```

Without `--brief`, deliberately: this is the mode that reads the descriptions.
It is everything the outline may be built from and nothing else:

- **The module** — its outcomes and concepts. These bound what the session may
  cover and what it may claim to serve.
- **Prerequisites**, each with the module that introduced it.
- **The previous module** — what the opening builds on.
- **The scheduled meeting** — its type and duration set the shape.
- **The references** for these concepts — readings, book chapters, course pages.

With no module named, `pres context --date 2026-10-05` finds the one scheduled
that day.

## 2. Settle the goal, and ask only what changes the plan

Resolve preferences in order: `preferences/defaults.yaml`, `.pres/preferences.yaml`,
a course `preferences.yaml`, then what the professor just said. Say which
defaults you took.

Then ask — and the rule for asking is narrow:

> **Ask a question only when its answer can materially change the learning
> sequence, content depth, evidence, or representation.**

"What colour scheme? How many slides? Do you want diagrams?" change none of
those and should never be asked. These do:

- **Audience** and **duration**. Never defaulted; nothing else can supply them.
- **The depth of the goal.** *"Should students leave able to explain this, or
  able to use it?"* Those select different beats.
- **The misconception**, when the course record has none. *"What do students
  reliably get wrong here?"* Several beats are much weaker without a real one,
  and inventing one teaches nothing.

## 3. See how it is taught elsewhere

A worked example that has survived a decade of lectures beats one invented this
morning, and the commonest defect in generated material is not error — it is
that the explanation has no idea which step students actually trip on.

Read two or three published treatments properly rather than skimming eight, and
come back with **insight, not text**: the order they introduce the ideas in, the
analogy they reach for, the misconception they spend time on.

**Never copy.** Not slide text, not problem statements, not figures, not an
exercise with the numbers changed. Where a source shaped the sequence, say so in
the report, with the URL. Skip this step rather than shortening it when the
professor gave you their own material, or when there is no network — and in the
second case say so rather than implying the survey happened.

## 4. Choose the deck grammar

`references/deck-grammars.md` for the reasoning; `pres grammar` for the answer.
Three decisions, all of which go in the outline:

- **`deck_archetype`** — `conceptual_lecture`, `technical_lecture`, `seminar`,
  `workshop`, `case_session`, `course_intro`, `revision`. A course
  introduction is not a lecture and must not borrow a lecture's grammar.
- **`discipline`** — which representation ladder applies. A history session
  climbs *artifact → observation → comparison → context → interpretation*; a
  physics one climbs *phenomenon → schematic → model → equation → prediction*.
  Using one generic shape for both is how a humanities deck ends up with
  definitions and bullet points.
- **`output_mode`** — `teaching`, `handout` or `hybrid`. A teaching deck can be
  sparse because the professor is standing next to it; the same file read by a
  student who missed the class is a different artefact.

## 5. Write the arc

Before any beat. `references/outline-craft.md` is the craft.

```yaml
arc:
  starts_from: they can split a dataset and report an accuracy (MODULE-05)
  argues: a score measured on data you tuned against is not evidence of anything
  turn: the model that scored 0.97 in week 5 scores 0.61 on data it has not seen
  leaves_them_able_to: say which of two reported accuracies is trustworthy, and why
```

If you cannot write `argues` as a claim rather than a topic, the session does
not yet have a point. Say so instead of producing slides.

## 6. Choose the beats

`references/teaching-beats.md` for how to choose; `pres beats` for the
catalogue; `pres beats <id>` for the ones you pick, and no others.

A **teaching beat** is two to seven slides that do one teaching job. A section is
normally two to four beats; a ninety-minute lecture five to nine.

Most sessions want at least: a **create-need** beat first (professors and
generators both jump straight to definitions), a **build** or **mechanism** beat
as the body, a **student-thinking** beat — `predict-reveal-explain` is the
highest-value beat in the library and the most often skipped — and
**`story-so-far`** before the next idea starts.

In DEEP mode every beat is written out, not named in a chain:

```yaml
beats:
  - beat: problem-before-solution
    goal: make the room want held-out evaluation before it is named
    entry_question: Why does a model that scored 0.97 fail on new data?
    exit_understanding: >-
      The student can say what problem held-out evaluation solves.
    transition_question: So what should we measure instead?
    slides: [2, 3, 4]
```

`exit_understanding` is the field that says whether the beat's slides are the
right ones. `transition_question` is what stops the deck being a set of
mini-lectures sharing a title page.

## 7. Then the slides

The beats' `sequence` steps become the slides. Each one names what the learner
is doing and how the information is represented — those are different questions,
and keeping them apart is what makes the visual variation follow from the
teaching rather than from a rule against repeating a layout.

```yaml
slides:
  - number: 2
    intent: create_need
    archetype: question
    title: When a high score is not evidence
    minutes: 8
    purpose: surface the train/test misconception using their own week-5 result
    text_roles: [question]
    density: sparse
    outcomes: [LO-02]
    concepts: [CONCEPT-MODEL-EVALUATION]
    sources: [RES-441]

  - number: 4
    intent: build_intuition
    archetype: annotated_object
    title: Three sets, and what each one is for
    minutes: 12
    purpose: make the tuning/held-out distinction concrete before naming it
    text_roles: [label, annotation]
    density: sparse
    visual_anchor: evaluation_split
    required_visual: annotated train / validation / test split
```

`references/visual-grammar.md` has the eighteen archetypes in full;
`pres archetypes` is the table. The rules that matter most:

- **A photograph is evidence; a diagram is the explanation.** Text beside a
  photograph directs attention — it never describes what the room can already
  see. Labels on a diagram sit on the parts they name, not in a bullet glossary
  underneath.
- **Two images imply a relationship.** Say which. If the honest answer is "they
  look nice", use one.
- **Whitespace on a question slide is the teaching**, and so is the missing
  answer. `pres outline check` refuses an `explanation` or `takeaway` role on a
  `question` or `activity` slide — it is the one grammar violation that is an
  error rather than a warning.
- **Decide to draw here, not later.** For each slide ask what it would look like
  drawn, and set `required_visual` whenever the answer is better than the
  sentence — a sequence, interacting parts, a comparison, a structure, a
  before-and-after, an annotated object, a quantity you can cite. This is the
  cheap moment to decide it: changing the plan costs a line, changing a written
  deck costs the slide. A deck that reaches the build step with almost no
  `required_visual` will come back almost entirely prose.
- **Text-only slides are legitimate.** Never *every slide needs an image*;
  always *every slide needs an information carrier* — and the carrier is a
  picture more often than a first draft assumes.
- **Draw the orientation.** Every question the opening answers is positional —
  where are we, what do you already have, where does this go — and position
  described in sentences makes the room rebuild the map from a description of
  it, every week. `roadmap` is a dominant-visual archetype for this reason, and
  the check reports an opening that draws nothing. Orientation cannot be
  premature: the rule against a diagram arriving before the need for it does not
  reach the orient phase, because orientation *is* the need-creation. Keep
  administrivia out of it — legitimate, and not in the first five minutes.
- **Reuse the visual anchor.** One diagram with the emphasis moving beats five
  unrelated diagrams, every time. Set `visual_anchor` and `focus`. The opening
  map is where this pays for itself: one course arc, re-linked each week with the
  marker moved, is better teaching than a fresh drawing and costs one drawing.
- **Density is a mode**, not a word cap: `sparse`, `moderate`, `dense`.
- **Mark `delivery_dependency: high`** on a slide that is deliberately
  incomplete without the professor talking over it. That is normal teaching and
  a hole in a handout.

## 8. Then coverage, honestly

```yaml
coverage:
  outcomes_served: [LO-02, LO-04]
  concepts_covered: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
  concepts_omitted:
    - concept: CONCEPT-REGULARIZATION
      why: introduced properly in MODULE-07; named here only as what comes next
```

An omission is often right — a hundred minutes does not hold four concepts. An
*unrecorded* omission is indistinguishable from having forgotten, and is an
error. The reverse is the harder rule: **the outline may not add a concept the
module does not claim.** Say which one the session needs, and stop.

## 9. Check it

```bash
pres outline check work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.outline.yaml
```

Two things run. The **soundness** checks — numbering, timing, `max_slides`,
concepts inside the module, outcomes traceable, references real, omissions
declared. And the **whole-deck critique**: identical archetypes in a row,
text-only runs, a diagram arriving before anything creates the need for it, no
reset in nine slides of new material, a visual anchor used once, a deck that
never asks the room anything, beats that do not hand over.

Those are warnings, deliberately — they are strong defaults about teaching, not
facts about the course. Read each one and either fix it or say why not.

## 10. Hand over — and stop

Report, in a few lines: where the course came from, the arc, the beats and why
those, which outcomes and concepts are covered, what is deliberately left out,
and anything you had to assume.

Then ask for approval, and stop there.

**Leave `status: draft`.** In DEEP mode the status is a gate: `pres check` and
`pres render` refuse a deck whose plan was built with `--mode deep` and whose
outline is not approved. It moves to `approved` when the professor says so.
Never on your own initiative, and never because the outline looks finished.

You may set `status: approved` yourself **only** on an explicit instruction in
the current request — "approve it and build the deck" — and when you do, stamp
`approved_by` and `approved_at` with who said so and when. Never carried over
from an earlier conversation.

---

## 11. Then build it

Re-run `pres context` — the outline names concepts, outcomes and references by
identifier and you need their content to write the slides. Then the build skill's
procedure applies in full: write each slide as its archetype, ask what every
slide looks like drawn before writing a word of its prose, make the pictures
under the rules in `references/presentation-graphics.md`, write the words under
`references/text-style.md`.

```bash
pres plan build DECK.md --mode deep
pres check DECK.md
```

`pres plan build` generates the render contract from the outline and the
markdown. It is not written by hand in any mode.

If the professor has edited the outline since it was checked, re-run the check
before building. An outline whose slide list changed after approval is an outline
whose approval was for a different session.

## 12. QA, render, inspect

```bash
pres render DECK.md --pdf --draft
```

`--draft` writes a second deck beside the first in which every planned-but-undrawn
visual is a dashed card carrying what the outline said the picture must show. Read
the two side by side; the gap is the work list.

Then open the PDF and read it. The first render usually has a real defect or two —
a misjudged image height, a list that lost its numbering, a table that wrapped
badly. They are obvious in the pages and invisible in the source.
