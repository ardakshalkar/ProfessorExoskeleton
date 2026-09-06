---
name: build-presentation
description: Fill a presentation outline in — write every slide as Marp markdown, draw the diagrams as SVG, build the tables, find or prompt for the images that are not drawn, and generate the render contract beside the deck. Use when the user asks to write, fill in, build or make the slides for an outline that already exists, or to turn an approved plan into an actual deck. Planning the session and its sequence first is /outline-presentation; producing the .pptx and PDF afterwards is /render-presentation; doing the whole job at the depth it needs is /make-presentation.
stage: build
requires: [outline]
produces: [deck, figures, plan]
writes: drafts
---

# Build the presentation

You write the slides the outline planned. You do not re-plan the session: the
outline is what was agreed to, and a deck that quietly reorders it is a deck
nobody approved. If the session should be different, say so and stop.

## 1. The gate, which depends on the mode

```bash
pres outline check work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.outline.yaml
```

- **The professor asked to approve first, or this is a deep-mode session** —
  `status` must be `approved` before you write a slide. `draft` means stop and
  report what the outline says.
- **Standard mode** — a draft outline is normal and you proceed. It was written
  for this request; the professor asked for a deck.

You may set `status: approved` yourself **only** on an explicit instruction in
the current request — "approve it and build the deck" — and then stamp
`approved_by` and `approved_at`. Never on your own initiative, never because the
outline reads as finished, never carried over from an earlier conversation.

If the professor edited the outline since it was checked, check it again. An
outline whose slide list changed after approval is an outline whose approval was
for a different session.

## 2. Reload the course, if there is one

```bash
pres context --course CSS-4008 --module MODULE-06 --brief
```

The outline names concepts, outcomes and references by identifier; you need their
content to write the slides. In deep mode drop `--brief`. Skip it entirely if you
already have the context in this conversation — reloading it is the step standard
mode omits.

## 3. Write the deck

`work/<COURSE_VERSION_ID>/presentations/<DECK>.md`, in **markdown, not a binary
format**: markdown diffs, reviews and converts, and a professor can see in a diff
that the slide claiming three questions now claims four.

```markdown
---
marp: true
title: Model evaluation and overfitting
module: MODULE-06
course_version: CSS-4008-2026-FALL
outcomes: [LO-02, LO-04]
concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
generated_by: build-presentation-skill
---
```

Then one slide per `---`, in the outline's order, **with the outline's titles**.
The titles are the render contract. `purpose` and `minutes` become the speaker
notes at render time, so they do not go on the slide.

`templates/` beside this skill holds the deck shapes; read `templates.yaml` and
use the one the outline's `style` names.
`${CLAUDE_PLUGIN_ROOT}/examples/MODULE-06/` is a complete worked set — outline,
deck, figures and generated plan. Read it before writing your first one.

### Write each slide as its archetype

```bash
pres archetypes                    # the eighteen, as a table
pres archetypes --name roadmap     # one, with what to write
```

The archetype is not decoration on the plan: it says what the slide is allowed
to contain, and `pres check` reads it. Those two commands replace reading
`references/visual-grammar.md`, which is there for the reasoning.

The ones most often got wrong: `roadmap` is the map *drawn*, with the words as
labels on it. `question` and `activity` carry the question and **nothing else** —
no answer, no explanation, and that is an error rather than a warning.
`single_visual` says what to notice, never what the room can already see. On a
diagram the labels sit on the parts they name — never "Box A means…" underneath.
`data_evidence` puts the claim in the headline. `algorithm` and `derivation` let
the formal object dominate with interpretation *beside* it.

Two fields change what you write: **`visual_anchor`** means other slides reuse
this picture — draw it once, link the same file, move the emphasis.
**`delivery_dependency: high`** means the slide is deliberately incomplete
without the professor talking over it; do not fill it in.

### Ask what the slide looks like drawn, before writing a word of it

**Drawing is the default. Prose is the exception, and the exception needs a
reason** — and "I could describe it in words" is not that reason. Almost anything
can be described in words; the question is whether describing it beats showing it.

Left to itself an agent writes prose every time, because prose is what it is
fluent in, and the deck ends up with whatever pictures survived rather than the
ones the content deserved.

**A bulleted list of pipeline stages is a diagram somebody declined to draw.** So
is a numbered list of steps, a paragraph comparing two approaches, and a sentence
describing what a structure contains.

Draw it when the content is a sequence, interacting parts, a comparison, a
structure, a before-and-after, an object with named parts, or a citable quantity.
Leave it as text when it is a definition, a question, a primary source, a bare
claim, a source line, or an equation.

### The words

```bash
pres rules writing
```

The three that change a deck most. **A headline asserts; it does not name a
topic** — "Kazakh costs 1.75× English for the same news", not "Cost analysis".
This is the best-evidenced finding in slide design. **Sentence case**, headlines
and body alike. **Every list parallel** — all verbs or all noun phrases, never
mixed.

Then: one thing per slide; the module's own identifiers where the structure
matters; the example worked through; real questions on the check slides; fit,
because `pres check` warns about a slide running past the bottom margin. And keep
emphasis out of bullets — bold, italic and code render as plain text inside a
bulleted item, because a bullet and mixed formatting cannot share a line through
this renderer.

## 4. Make the pictures

```bash
pres rules figures
```

The short version: **a diagram you draw** is most figures on a teaching deck and
is the good case — hand-authored SVG, from structure the course already claims.
**A table** is markdown in the deck, never a picture of a table. **A chart of
this class's data** does not exist here, because nothing reads student records;
the slide says it in words. **A chart of external data** needs a citable source,
cited on the slide. **An image you did not draw** comes from
`pres find-image --search "…"`, which brings the attribution with it. **An
illustration nobody has** gets a written prompt and a slide reported as waiting;
running the generator is the professor's.

Figures live **flat beside the deck**, named after it, linked as siblings:

```markdown
![Training data, validation data and a held-out test set never touched during
tuning](MODULE-06-slides-fig-01-split.svg)
```

Alt text on every one, saying what the picture *asserts* rather than captioning
the filename. Colour never the only channel: label the lines, vary the dash, name
the regions. `references/presentation-graphics.md` has the reasoning, and
`references/typography.md` covers the title slide's composed picture — which is
named in the outline's `title_slide`, not linked from the markdown.

## 5. Generate the render contract

```bash
pres plan build work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.md --mode standard
```

**Do not write `<deck>.plan.yaml` by hand.** Every field in it is a copy of one
in the outline or the markdown — slide numbers, titles, minutes, purposes,
archetypes, densities, text roles, required visuals, the figure list — and
copying them by hand is how a plan ends up describing the deck as it was two
edits ago. The command projects them, and keeps any figure attribution the plan
already held, because `find-image` wrote that and nothing else knows it.

`--mode` is `fast`, `standard` or `deep`, and it decides the approval gate.
`--approval required` adds the gate inside standard mode, for a professor who
asked to approve before rendering.

## 6. Check it

```bash
pres check work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.md
```

The approval gate for this deck's mode, the plan matching the markdown in count,
order and title, every linked figure present beside the deck, alt text on all of
them, an attribution line for every claimed source, formulas that converted, and
every planned visual either present or reported.

Fix what it names. If it says the plan is out of date, run `pres plan build`
again — the plan is a projection, so a mismatch asks whether the *deck* is still
what was agreed to.

## 7. Hand over

Three or four lines: which module, which concepts covered, what you drew and what
is waiting on an image, anything left out, where the course came from, and — if
the deck was built in a mode with no approval gate — that nobody has reviewed the
plan. Say the deck can be rendered once they are happy with it, and stop. Do not
render as a flourish; that is `/render-presentation`.

## Rules

- **The outline is the contract.** Same slides, same order, same titles.
- **Never approve an outline on your own initiative.**
- **Serve the claims, never add them.** No new outcome, concept, prerequisite or
  criterion.
- **Markdown, not binaries.** What you write is the thing that generates the
  picture — an SVG, a manim scene — never only the picture.
- **Do not invent sources.** No citations, statistics, dataset descriptions or
  quotations that are not in the material you were given.
- **No chart a command did not produce and no chart you cannot cite.**
- **Alt text on every figure, and colour never the only channel.**
- **No answer key on a slide**, and no student name, email or number anywhere —
  including in a filename or an axis label.
- **The plan is generated, never typed.**
- **Say what you generated.** `generated_by` is not optional.
