---
name: outline-presentation
description: Plan a presentation before writing it — find the course, choose the teaching sequence that suits the discipline, and draft an outline saying how the topics evolve, which learning outcomes and concepts each slide serves, how each slide represents its information, and what is deliberately left out, for the professor to approve. Use when the user asks to outline, plan or structure a lecture, talk, seminar or slide deck, asks what a session should cover or in what order, or names a week or module to prepare slides for. Filling an approved outline in with slides is /build-presentation; doing the whole job at the depth it needs is /make-presentation.
stage: design
requires: [course]
produces: [outline]
writes: drafts
---

# Outline a presentation

You plan the session. You do not write it, and you do not decide what the course
teaches. If the session would need a concept or outcome the course does not have,
stop and say which — that is the professor's decision.

**Order: learning goal → deck grammar → teaching beats → slides.** Never
straight to slides. A section turned directly into a slide list produces slides
that are individually reasonable and collectively inert, which is the commonest
defect in generated teaching material.

**Depth.** An outline is worth different amounts of work depending on the
session. If you were sent here by `/make-presentation` you already have a mode;
otherwise:

```bash
pres route "<the request>"
```

- **standard** — the compact outline below. Write it, check it, and proceed to
  the deck unless the professor asked to approve first.
- **deep** — `${CLAUDE_PLUGIN_ROOT}/references/deep-workflow.md`, steps 1–10, in
  full: provenance, full context, published treatments, beats written out,
  coverage analysis, and the professor's approval before anything is written.

## 1. Bound the session

```bash
pres source --course CSS-4008
pres context --course CSS-4008 --module MODULE-06 --brief
```

The provenance line from the first goes in your report: a deck built from a
course directory while the professor believed they were on the shared database
looks identical to a correct one. `--source local` skips the network,
`--source database` refuses to fall back, `--timing` says where the time went.

The context is everything the outline may be built from and deliberately nothing
else — the module's outcomes and concepts, its prerequisites, the previous
module, the scheduled meeting's type and duration, and the references for these
concepts. Drop `--brief` for the full descriptions. `--date 2026-10-05` finds the
module scheduled that day.

With no course at all: `${CLAUDE_PLUGIN_ROOT}/references/working-without-a-course.md`.

## 2. Ask only what changes the plan

> **Ask a question only when its answer can materially change the learning
> sequence, content depth, evidence, or representation.**

Colour scheme, slide count and "do you want diagrams" change none of those.
These do: **audience** and **duration**, which nothing else can supply; **the
depth of the goal** — able to explain it, or able to use it, because those select
different beats; and **the misconception**, when the course record has none.

Preferences resolve in order: `${CLAUDE_PLUGIN_ROOT}/preferences/defaults.yaml`,
`.pres/preferences.yaml`, a course `preferences.yaml`, then what they just said.
Say which defaults you took.

## 3. Grammar, arc, beats

```bash
pres grammar --deck technical_lecture --discipline "computer science"
```

That prints the phase spine, a default beat chain and the discipline's
representation ladder. It is the compact form of
`references/deck-grammars.md` — read the reference only when the reasoning is
what you need.

Choose `deck_archetype`, `discipline` and `output_mode`. A course introduction is
not a lecture and must not borrow a lecture's grammar. A `teaching` deck and a
`handout` are different artefacts; `hybrid` is the practical default.

Write the **arc** before any beat:

```yaml
arc:
  starts_from: they can split a dataset and report an accuracy (MODULE-05)
  argues: a score measured on data you tuned against is not evidence of anything
  turn: the model that scored 0.97 in week 5 scores 0.61 on data it has not seen
  leaves_them_able_to: say which of two reported accuracies is trustworthy, and why
```

If you cannot write `argues` as a claim rather than a topic, the session does not
yet have a point. Say so instead of producing slides.

Then the beats. `pres beats --phase build_understanding` lists candidates one
line each; `pres beats <id>` opens exactly one, and only when you need its
sequence. Most sessions want a **create-need** beat first, a **build** or
**mechanism** beat as the body, a **student-thinking** beat —
`predict-reveal-explain` is the highest-value beat in the library and the most
often skipped — and **`story-so-far`** before the next idea starts. Two to four
beats a section; five to nine for a ninety-minute lecture.

In standard mode a named chain is enough: `beats: [problem-before-solution,
intuition-to-definition, predict-reveal-explain, story-so-far]`. In deep mode
each beat is written out with its `entry_question`, `exit_understanding` and
`transition_question`.

## 4. The slides

Every slide names what the learner is *doing* (`intent`) and how the information
is *represented* (`archetype`). They are different questions, and keeping them
apart is what makes the visual variation follow from the teaching rather than
from a rule against repeating a layout.

```yaml
slides:
  - number: 4
    intent: build_intuition
    archetype: annotated_object
    title: Three sets, and what each one is for
    minutes: 12
    purpose: make the tuning/held-out distinction concrete before naming it
    density: sparse
    text_roles: [label, annotation]
    visual_anchor: evaluation_split
    required_visual: annotated train / validation / test split
    outcomes: [LO-02]
    concepts: [CONCEPT-MODEL-EVALUATION]
```

`pres archetypes` is the table of eighteen; `pres archetypes --name roadmap` is
one in detail. `pres rules visual` is the rules that decide what a slide is.
The four that change an outline most:

- **Decide to draw here, not later.** Set `required_visual` whenever the drawn
  version beats the sentence — a sequence, interacting parts, a comparison, a
  structure, a before-and-after, an annotated object, a citable quantity.
  Changing the plan costs a line; changing a written deck costs the slide. An
  outline that reaches the build step with almost no `required_visual` comes back
  almost entirely prose.
- **Reuse the visual anchor.** One diagram with the emphasis moving beats five
  unrelated diagrams. Set `visual_anchor` and `focus`.
- **A question or activity slide carries no answer and no explanation.** The
  whitespace and the missing answer are the teaching, and this is the one grammar
  violation that is an error rather than a warning.
- **Draw the orientation.** `roadmap` is a dominant-visual archetype: "last time
  / today / builds on" as three bullets makes the room rebuild the map from a
  description of it, every week.

## 5. Coverage, honestly

```yaml
coverage:
  outcomes_served: [LO-02, LO-04]
  concepts_covered: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
  concepts_omitted:
    - concept: CONCEPT-REGULARIZATION
      why: introduced properly in MODULE-07; named here only as what comes next
```

An omission is often right; a hundred minutes does not hold four concepts. An
*unrecorded* omission is indistinguishable from having forgotten. The harder rule
is the reverse: **the outline may not add a concept the module does not claim.**

## 6. Check it, then hand over

```bash
pres outline check work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.outline.yaml
```

Soundness — numbering, timing, `max_slides`, concepts inside the module, outcomes
traceable, references real, omissions declared — plus the whole-deck critique:
identical archetypes in a row, text-only runs, a diagram arriving before anything
creates the need for it, no reset in nine slides of new material, an anchor used
once, a deck that never asks the room anything, beats that do not hand over.
Warnings are strong defaults about teaching, not facts about the course. Fix each
or say why not.

Report in a few lines: where the course came from, the arc, the beats and why
those, what is covered, what is deliberately left out, what you assumed.

**Leave `status: draft`.** Approval is the professor's, in every mode. In deep
mode it is also a gate — `pres check` and `pres render` refuse a deck whose plan
was built `--mode deep` from an unapproved outline. In standard mode it is a
record rather than a gate, and you proceed to the deck.

## Rules

- **Plan goal → grammar → beats → slides.** Never straight to slides.
- **Serve the claims, never add them.** No new outcome, concept, prerequisite or
  criterion. If the session needs one, say which and stop.
- **Stay inside the module.** An outline that wanders into next week's concepts
  breaks the prerequisite ordering the course rests on.
- **Do not invent sources**, and do not invent a misconception. An example you
  construct yourself is fine and is labelled as such.
- **Ask only what changes the plan.**
- **Say where it came from** — the provenance line, and any source that shaped
  the sequence, with its URL.
- **Never approve your own outline.**
