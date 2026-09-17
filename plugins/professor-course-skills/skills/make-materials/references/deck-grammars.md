# Deck grammars

What sequence teaches this topic, before any beat is chosen. The top of the
three taxonomies in `visual-grammar.md`.

## Six phases every grammar is a weighting of

```text
1. ORIENT              where are we?
        ↓
2. CREATE NEED         why should I care, what is the problem?
        ↓
3. BUILD UNDERSTANDING concrete → visual → explanatory
        ↓
4. FORMALIZE           definition, model, equation, rule, framework
        ↓
5. USE / TEST          example, comparison, evidence, activity
        ↓
6. INTEGRATE           what does this mean, how does it connect?
```

The phases are surprisingly reusable. The **proportions are not**: history might
spend most of a session in evidence and interpretation, mathematics most of one
in formalisation, design oscillating between example and abstraction, a
practical course mostly in use and test.

Which is why there is no generic `explanation_deck`.

## Representation ladders by discipline

| Discipline | Ladder |
| --- | --- |
| **CS / algorithms** | problem → intuition → pseudocode → example → complexity → alternative → comparison |
| **Mathematics** | motivation → definition → proposition → derivation → consequence → example |
| **Physics** | phenomenon → schematic → model → equation → prediction → experiment |
| **Biology** | phenomenon → structure → annotated structure → mechanism → process → consequence |
| **Economics** | question → assumptions → model → proposition → proof or graph → interpretation |
| **Psychology** | question → phenomenon → theory → experiment → result → interpretation |
| **History** | framing question → artifact → observation → comparison → context → interpretation |
| **Design / architecture** | provocation → precedent → example → abstraction → rule → exploration → critique |
| **Business / case** | situation → decision problem → evidence → framework → alternatives → trade-off → recommendation |
| **Law** | problem or case → rule → source → application → exception → conclusion |

Set `presentation.discipline` in the outline and the ladder is the default order
of beats. It is a starting point, not a constraint — a mathematics session that
opens on a phenomenon is often the better mathematics session.

## Humanities run on a different rhythm

Worth stating separately because a generator trained on technical decks gets it
wrong. A humanities beat is often:

```text
QUESTION → RAW ARTIFACT → SECOND ARTIFACT → COMPARE → CONTEXT → INTERPRETATION
```

and some slides in it contain nothing but the artifact and its identification.

The interpretation frequently does not need to be printed at all — the professor
supplies it. That is not an omission, it is university teaching, and the outline
should say so:

```yaml
delivery_dependency: high
```

meaning *this slide is deliberately incomplete without the narration*. The check
warns if such a slide survives into `output_mode: handout`, where there is no
narration to complete it.

## Design and visual fields alternate

Inspiration and formalisation, repeatedly:

```text
provocation → example → example → pattern recognition
           → abstraction → formal rule → exploration → interpretation
```

A quotation may dominate one slide and an artwork the next. The visual variety
is not decoration — the epistemic activity is changing.

## Deck archetypes

`presentation.deck_archetype` picks the grammar:

| Archetype | Shape |
| --- | --- |
| `conceptual_lecture` | the six phases, weighted towards build-understanding and integrate |
| `technical_lecture` | weighted towards formalize and use/test; expect derivations and algorithms |
| `seminar` | a reading is the object; evidence and interpretation dominate; the discussion is the content |
| `workshop` | task blocks with checkpoints; slides punctuate the work rather than fill it |
| `case_session` | situation → evidence → framework → alternatives → recommendation |
| `course_intro` | its own grammar, below |
| `revision` | synthesis-heavy; almost entirely integrate and use/test |

### `course_intro` is not a lecture

It has a grammar of its own and should not contaminate the conceptual one:

```text
WHY THIS COURSE
      ↓
WHAT YOU WILL LEARN
      ↓
HOW THE COURSE WORKS
      ↓
LEARNING ACTIVITIES
      ↓
TIMELINE
      ↓
ASSESSMENT
      ↓
RESPONSIBILITIES
      ↓
NEXT ACTIONS
```

## Output mode: teaching, handout, hybrid

The same content is a different artefact depending on whether the professor is
standing next to it.

| | `teaching` | `handout` |
| --- | --- | --- |
| text | less | more context |
| reveal | progressive | final state |
| questions | no answers shown | answers or pointers |
| definitions | may be spoken | preserved on the slide |
| diagrams | built up | complete |
| narration | expected | unavailable |

`hybrid` is the practical default and is what the templates assume. Set it
explicitly when it matters: a deck published to students who missed the class is
a handout whatever it was written as, and `delivery_dependency: high` slides in
it are holes.

## When to ask the professor a question

The planning agent should not hand over a form. It should build a structure,
find where it is genuinely uncertain, and ask only there.

> **Ask a question only when its answer can materially change the learning
> sequence, content depth, evidence, or representation.**

Bad, because none of these changes the teaching:

```text
What colour scheme?    How many slides?    Do you want diagrams?
```

Good, because the answer selects different beats:

```text
Should students leave able to explain reinforcement learning conceptually,
or able to implement Q-learning?
```

Two questions always earn their place because nothing else can supply them:
**audience** and **duration**. A third earns it whenever the course record is
silent: **what do students reliably get wrong here?** — several beats are much
weaker without a real misconception, and inventing one teaches nothing.

Everything after that should be automatic.

## The whole-deck critique

Run before handing the deck over. `pres outline check` does the mechanical part;
these are the questions behind the warnings it prints.

- Are there too many text-only slides in succession?
- Are there five near-identical slides in a row?
- Is a diagram introduced before anything explains why it matters?
- Are the images evidence, or decoration?
- Do any question slides accidentally reveal their answers?
- Are labels close to the objects they name?
- Are dense derivations broken into teachable steps?
- Does visual complexity rise with conceptual complexity?
- Does each section alternate explanation, example and student cognition?
- Does every beat hand over to the next one?
- Is there a point where the learner's position gets restored?

The last one is the most often missed, and the cheapest to fix.
