# The visual grammar

How one slide should be shaped, and why the answer is not a layout.

`node/src/archetypes.ts` is the machine-readable version of everything here and
is what `pres outline check` enforces. This file is the reasoning.

## Three taxonomies, kept apart

```text
DECK GRAMMAR        what sequence teaches this topic     → deck-grammars.md
      ↓
SLIDE INTENT        what is the learner doing here
      ↓
VISUAL ARCHETYPE    how should that be represented       → this file
```

Collapsing them is the failure mode. A generator that goes from "section"
straight to "slide" produces title-and-three-bullets fifteen times over, and
every one of those slides is individually defensible. What is wrong is that the
cognitive operation never changed while the material did.

Naming the intent separately from the representation is also what removes the
need for a rule like *never repeat a layout*. That rule is actively harmful —
repeating a shape is exactly right while the learner's task is the same. The
variation should come from the teaching:

> Not "make slide 4 look different." **"Slide 4 has a different pedagogical job."**

## The eighteen archetypes

| # | Archetype | Dominant element | Typical text | Composition |
| --- | --- | --- | --- | --- |
| 1 | `section_opener` | title or image | 3–12 words | full image or large title |
| 2 | `roadmap` | the map itself | short labels on it | a sequence or map, drawn |
| 3 | `big_idea` | a statement | one claim | large text |
| 4 | `definition` | a term | definition + one example | term → meaning → example |
| 5 | `question` | a question | almost none | large question + whitespace |
| 6 | `single_visual` | photo, artifact, map | identification + what to notice | the visual dominates |
| 7 | `visual_comparison` | 2–4 visuals | parallel labels | side by side, equal weight |
| 8 | `annotated_object` | photo or diagram | labels attached directly | central visual + callouts |
| 9 | `process` | a sequence diagram | short step labels | left→right or top→bottom |
| 10 | `system_diagram` | a mechanism | component names + relationships | network or architecture |
| 11 | `worked_example` | an example | steps + result | problem → steps → answer |
| 12 | `derivation` | equations | setup + interpretation | progressive vertical reasoning |
| 13 | `algorithm` | code or pseudocode | annotation + explanation | code dominates |
| 14 | `data_evidence` | a chart | conclusion headline + annotations | chart dominates |
| 15 | `structured_comparison` | table or matrix | terse cells | dimensions × alternatives |
| 16 | `primary_source` | document or quotation | excerpt + interpretation | source + question |
| 17 | `activity` | question or problem | instructions | extremely sparse |
| 18 | `synthesis` | relationships | 3–5 ideas | diagram or map |

## A photograph and a diagram are not the same object

This is the strongest single rule here.

**A photograph, artifact or map is evidence.** The text beside it should direct
attention and interpret. It must not describe what the student can already see.
A slide comparing three historical maps needs three identifying labels and a
question — not three sentences saying that the first map shows Istanbul.

> When the visual is evidence, text directs attention. It does not narrate the
> obvious.

**A diagram is the explanation**, not an illustration of one. Which means the
labels belong on the parts they name:

```text
if archetype is a diagram:
    direct labels          → yes
    a bullet glossary      → no
    emphasise relationships → yes
```

The shape to avoid:

```text
[complex diagram]

• Box A means …
• Box B means …
• Arrow C means …
```

If the words can sit next to A, B and C, they should.

## Two images imply a relationship, and three imply a different one

Before putting more than one picture on a slide, answer: *why are there several,
and what relationship should the learner discover?*

| How many | Usually means |
| --- | --- |
| one | inspect, identify, experience |
| two | compare · before/after · cause/consequence · theory/reality · source/interpretation · macro/detail |
| three or four | categories · progression · alternative cases · multiple examples |

If the honest answer is "they make the slide look better", use one.

## Equations, code and formulas are visual objects

An equation is not text that happens to have symbols in it — it is a visual
reasoning object with a structure the eye follows:

```text
CLAIM
  equation 1
     ↓ transformation
  equation 2
     ↓
  RESULT
Interpretation: one sentence
```

And it should usually be built rather than shown: assumptions, then the
equation, then the manipulation, then the result, then what it means.

Code and pseudocode work the same way, and both are best in the pattern
**formal representation beside its interpretation**:

```text
┌──────────────────────┬─────────────────────┐
│ ALGORITHM            │ WHY THIS STEP WORKS │
│   while …            │   the angle becomes │
│     if …             │   …                 │
└──────────────────────┴─────────────────────┘
```

Never as prose bullets — *"initialise weights / pick an input / check the
prediction / update"* — when the pseudocode says it more precisely in less
space. The same pattern serves chemical formulas, logical notation, statistical
models and legal provisions.

## Whitespace on a question slide is the teaching

A clicker question is a question, its options, and a great deal of empty space.
That is not a poorly designed slide; the emptiness is the instructional
function, and so is the missing answer.

```yaml
archetype: question
visual_density: low
explanation: none
answer: hidden
whitespace: intentional
```

A generator's instinct on seeing unused space is to fill it. `pres outline
check` treats an `explanation` or `takeaway` text role on a `question` or
`activity` slide as an **error** for this reason — it is the one place in the
grammar where a warning is not enough.

## Draw first, write second

**Drawing is the default. Prose is the exception, and the exception needs a
reason.**

That is a deliberate reversal. Left to itself an agent reaches for prose every
time, because prose is what it is fluent in, and the result is a deck where the
pictures are whatever survived rather than whatever the content deserved. One
real lecture deck measured against this carried a drawn figure on **7% of its
slides** and was words-only on 36%.

So the question is asked in the other order. Before writing a sentence for a
slide, ask: **what would this look like drawn?** The sentence stays only when
the honest answer is "worse than the sentence" — and "I could describe it in
words" is not that answer. Almost anything can be described in words; the
question is whether describing it is better than showing it.

`pres outline check` measures this at the deck level and reports an outline
where more than half the slides are carried by prose, or where nothing is drawn
at all. A slide counts as carried when it plans a picture *or* when its
archetype is an object in its own right — a code block, a derivation, a
comparison matrix are all things the eye reads as structure. Counting pictures
alone would tell a programming lecture it was prose-heavy for being a
programming lecture.

**Draw it when the content is:**

| Shape | What to draw |
| --- | --- |
| A sequence or pipeline | boxes left-to-right, arrows, short step labels |
| Parts and how they interact | a system diagram, labels on the parts |
| A comparison of two or three things | them side by side, at equal weight, parallel labels |
| A quantity, a proportion, a spread | a chart — from a source you can cite |
| A structure, hierarchy or dependency | a tree or a graph |
| A before and after | the pair, same scale, same crop |
| A thing with named parts | the object, annotated in place |
| A process the learner will follow | the steps as a diagram, not as a numbered list |

That table covers most of a technical lecture. A bulleted list of four pipeline
stages is a diagram somebody declined to draw.

**Leave it as text when the content is:**

- a **definition** — the words are the thing
- a **question** to the room, where whitespace is the point
- a **primary source** being analysed
- a **claim** that needs no evidence beyond itself
- a **source or attribution** line
- an **equation** — already a visual object, and set as one

**And never draw** what you cannot ground: a chart of this class's results that
no command produced, a chart of external data with no citable source, a diagram
of a system the course has not described. Those stay words, and say so.

## The opening is where prose costs most

The part of a deck a generator most reliably leaves as words is its first three
slides, and it is the worst place to leave them. Measured across four real
lecture decks from one course: not one had a figure on slide 1, and one of them
opened with five prose slides in a row.

The reason is not laziness, it is that the opening's content looks verbal and
is not. **Every question an opening answers is positional** — where are we, what
do you already have, where does this go, what is out of scope. Position in a
structure is the one thing prose is worst at and a picture is best at. So

```text
- Last time: you split a dataset and trained a model on part of it
- Today: what that number is, and is not, evidence for
- Builds on CONCEPT-TRAIN-TEST-SPLIT, taught in MODULE-05
```

asks the room to rebuild the course's shape from a description of it, in week
after week after week. That is why `roadmap` is a **dominant-visual** archetype:
its dominant element is structure, structure is a picture, and the words on it
are labels rather than a substitute.

**Orientation cannot be premature**, and this is worth saying because the rule
against it gets over-applied here. A mechanism drawn before the problem it
solves is a mechanism nobody has a reason to follow — but orientation *is* the
need-creation, so the rule does not reach it. Drawing the map first is not the
error that rule guards against.

Two things follow that no other rule in this file covers.

**The opening figure should be the same figure every week.** One course arc,
drawn once, re-linked with the marker moved — that is what `visual_anchor` and
`focus` are for, and it is better teaching than a fresh drawing, because
recognition is cheaper for the learner than reading. It is also the difference
between a living slide 2 that costs one drawing and one that costs a drawing
every week, which is the difference between a rule that holds and a rule that
lapses in week 4.

**The title slide takes an image, not a diagram.** Its picture is named in the
plan as `title_slide.image` — see `typography.md` — and it is the one picture in
a deck allowed to carry no information, because a title slide is an identity
card. A mechanism there shows the payoff before anything has asked the question.

`pres outline check` reports an opening run of orienting slides that draws
nothing, and a deck whose first picture arrives after slide 4. Both are
warnings, and both exist because every other measure in this file is
position-blind: a prose slide at 2 and a prose slide at 22 count the same, and
they do not cost the same.

Administrivia is the other half of this. Logistics, office hours and credit
arrangements are legitimately text and legitimately in the deck — at the end, or
in the handout. One of the four decks measured above spends fifty-four words of
its first two minutes on them.

## Text-only slides are legitimate

The correction that needs correcting. Some material is about establishing
distinctions in language, and a slide of prose is the right carrier for it.

Never encode *every slide needs an image*. Encode:

> **Every slide needs an information carrier.** Sometimes the carrier is text.

`visual_required: false` is a valid decision. What the check does watch for is
three text-carried slides in a row, which is usually an oversight rather than a
choice.

## Long text is not the problem; generated long text is

A large passage of Alberti on an architecture slide is a primary object of
study. A large passage of explanation written by a generator is filler. So:

```text
long_text == bad                              wrong
long explanatory prose written by generator   usually bad
long primary-source passage being analysed    potentially exactly right
```

That is why `primary_source` is its own archetype with `density: dense`.

## Classify what the text does, not how much there is

Ten roles. Each archetype allows some and not others, and the check reads that
from `archetypes.ts`.

| Role | The question it answers |
| --- | --- |
| `headline` | what is this slide about? |
| `claim` | what should I believe or understand? |
| `label` | what is this? |
| `annotation` | what should I notice here? |
| `explanation` | why or how does it work? |
| `evidence` | what supports the claim? |
| `instruction` | what should I do? |
| `question` | what should I think about? |
| `source` | where did this come from? |
| `takeaway` | what must I remember? |

This is far more robust than "maximum five bullets", which cannot tell five
bullets of generated explanation from five parallel labels on a comparison.

## Density is a mode, not a limit

Text density varies enormously by discipline, so a universal word cap is wrong
in both directions.

| Mode | Rough words | For |
| --- | --- | --- |
| `sparse` | 5–25 | a question, a claim, an artifact and its label |
| `moderate` | 20–50 | the common case: a concept and its explanation |
| `dense` | 40–120 | only where the density is intrinsic — a derivation, an algorithm, a source passage — and then with strong visual structure |

**These are generation defaults, not measurements.** The intuition behind them
comes from published lecture-slide corpora — MLP, LectureBank, LecSlides-370K —
which report medians in the twenties of words for general educational slides and
substantially higher for technical ones. Those figures reached this file
secondhand and have not been verified here; treat them as the reason the bands
differ rather than as numbers to quote to a class.


### What checks it, and what it means when it fires

`pres check` compares the markdown against the band the slide's archetype
declares, and warns at half again over the top of it — 38 words on a `sparse`
slide, 75 on a `moderate` one. Half again, rather than the exact number, because
the bands overlap on purpose and warning at the edge would fire on slides nobody
would call overfull.

It is a warning and it will stay one. Density is intrinsic to some content, and
the professor is the one who knows whether this is that.

**What it means depends on what the archetype asked for**, so the message
differs. When the archetype's roles include explanation or evidence, prose is
what it is for, and too much of it means *cut or split*. When the roles are
headline and label — `roadmap`, `section_opener`, `visual_comparison` — the
words were meant to label a picture, so too much of them usually means **the
picture was never drawn**. The sentences ended up carrying what a drawing should
have, and the remedy is to draw it and let them shrink back into labels.

That second case is the one worth knowing by sight. It found this, in a real
deck:

> Slide 2, planned `roadmap`, 78 words in five blocks, nothing drawn. Three
> bullets each describing something concrete — a prompt as tokens, a chat as
> resent history — on the slide immediately before one that showed its material
> properly, in the same deck, by the same hand.

Nothing was broken. Every other check passed. The slide was still wrong, and the
fix was to draw the thing the sentences were describing.

## And one rule that is not about truth but about the room

**Colour is never the only channel.** A red/green distinction is invisible to
part of every cohort and to every projector with a tired lamp. Label the lines,
vary the dash, name the regions.
