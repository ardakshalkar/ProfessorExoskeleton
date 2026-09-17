# Teaching beats

The planning unit. `beats/` holds the library; this is how to choose between
them and put them together.

## Why the unit is not the slide

Plan a section as slides and you get:

```text
Slide 8  — definition
Slide 9  — diagram
Slide 10 — example
```

Three defensible slides that do not teach, because nothing in the plan says what
the stretch was *for*. Plan it as a beat and you get:

```text
BEAT: introduce a new concept
problem → intuition → definition → example → check
```

Same slides. Now they have a reason to be in that order, and the next beat has
something to follow.

A **teaching beat** is two to seven slides that do one teaching job. It is not a
template: two beats of the same kind, in different sessions, produce different
slides.

## The representation ladder

The strongest deck-level pattern in real teaching is that a good lecture does
not explain a concept once. It moves through representations as understanding
deepens:

```text
QUESTION / PROBLEM
   ↓
CONCRETE EXAMPLE
   ↓
VISUAL REPRESENTATION
   ↓
ANNOTATED REPRESENTATION
   ↓
ABSTRACTION
   ↓
FORMALISM  (equation, algorithm, rule)
   ↓
APPLICATION
   ↓
CHECK / SYNTHESIS
```

So the planning question is never *what layout comes next*. It is:

> **What representation should the student encounter next?**

Different disciplines climb this ladder differently —
`deck-grammars.md` has the per-discipline versions.

## Choosing beats

Work down, not up. Learning goal → phase → beat → slides.

1. **What should students be able to do afterwards?** Explain it, or use it?
   Those two answers select different beats, and this is the one question always
   worth asking the professor.
2. **Which phase is this stretch of the session in?** Orient, create need, build
   understanding, formalize, use/test, integrate.
3. **Pick the beat from that family.** `beats/README.md` indexes them.
4. **Read that beat's file.** Its `sequence` becomes the outline's slides; its
   `visual_rules` constrain the pictures; its `ask_the_professor` entries fire
   only when their condition holds.

A section is normally two to four beats. A ninety-minute lecture is normally
five to nine.

## The four beats most sessions need

- **A create-need beat first.** Professors and generators both jump straight to
  definitions. `problem-before-solution` is the default; `contradiction-surprise`
  and `before-after` are stronger where the material allows them.
- **An introduce-concept or explain-mechanism beat** as the body.
- **A student-thinking beat.** `predict-reveal-explain` is the highest-value
  beat in the library and the one most often skipped.
- **`story-so-far`** before the next idea starts.

## Reset beats matter more than they look

Dense sequences need moments that restore the learner's conceptual position:
*today's plan · story so far · what have we learned · the really big picture ·
a section break*.

```text
DENSE EXPLANATION
DENSE EXPLANATION
FORMALIZATION
EXAMPLE
        ↓
    RESET / SYNTHESIS
        ↓
    NEXT CONCEPT
```

Insert them for the right reason. Not *"we have not had a summary for a while"*
but *"the learner needs their position back before another idea is introduced"*.
`pres outline check` warns after nine slides of new material with no reset,
which is a proxy for that, not a substitute for it.

## Reuse the visual anchor

The single most valuable rule for generated decks. Consider:

```text
slide 1: complete RAG diagram
slide 2: a new retrieval diagram
slide 3: a new embeddings diagram
slide 4: a new vector-DB diagram
```

Visually varied. Pedagogically worse — the student spends each slide re-learning
a layout instead of learning the addition. The stronger sequence keeps one
picture and moves the emphasis:

```text
the RAG architecture
   ↓ highlight the query
   ↓ highlight the embedding
   ↓ highlight the vector store
   ↓ highlight retrieval
   ↓ highlight context injection
the whole pipeline again
```

In the outline:

```yaml
visual_anchor: rag_pipeline
focus: retrieval
```

The rule underneath it:

> Keep the representation stable while the concept is stable. Change
> representation when the student's cognitive task changes.

That produces good visual rhythm on its own, without any rule against repeating
a layout. `pres outline check` flags an anchor used on only one slide — that is
a figure that was going to be redrawn.

## Beat transitions

Presentation generators almost never model this, and it is what separates a
lecture from a set of mini-lectures sharing a title page. Every beat carries:

```yaml
entry_question:       what the room is wondering when it starts
exit_understanding:   what is true for the learner when it ends
transition_question:  the question that hands over to the next beat
```

The last slide of *"why do we need retrieval?"* should set up *"how does it
work?"*:

> We now know that external knowledge can help.
> But how does the right information actually reach the model?

`pres outline check` warns on a beat with no `transition_question` before
another beat, and on a beat with no `exit_understanding` — the latter because it
is the only field that says whether the beat's slides are the right ones.

## A worked selection

> *"Make me a 75-minute lecture on Transformers for second-year CS students.
> They know neural networks but not attention."*

| Section | Beat |
| --- | --- |
| Why Transformers? | `problem-before-solution` |
| The sequence-modelling problem | `contradiction-surprise` |
| Attention, intuitively | `intuition-to-definition` |
| Q, K and V | `component-interaction-mechanism` |
| Self-attention | `follow-one-object` |
| The attention equation | `observation-model-equation` |
| Multi-head attention | `build-progressively` |
| The full architecture | `zoom-in-zoom-out` |
| An example | `execution-trace` |
| Against CNNs and RNNs | `compare-alternatives` |
| Check | `predict-reveal-explain` |
| Close | `story-so-far` |

The deck has a pedagogical rhythm before a single slide is written, and the
visual variation is already implied by the beats rather than imposed on them
afterwards.

## Writing a beat into the outline

```yaml
beats:
  - beat: problem-before-solution
    goal: make the room want the concept
    entry_question: Why does a model that scored 0.97 fail on new data?
    exit_understanding: >-
      The student can say what problem held-out evaluation solves.
    transition_question: So what should we measure instead?
    slides: [2, 3, 4]
```

The slide numbers are how the beat and the slide list stay connected. Every
slide should belong to exactly one beat.
