# The beat library

A **teaching beat** is not a slide template. It is a short pedagogical
sequence — usually two to seven slides — that does one teaching job.

The difference matters because of what a generator does without it. Planning
"slide 8: definition, slide 9: diagram, slide 10: example" produces slides that
are individually reasonable and collectively inert. Planning "introduce a new
concept: problem → intuition → definition → example → check" produces the same
slides with a reason for their order, and the visual variation then follows from
the teaching rather than from a rule against repeating a layout.

Each file here is one beat. Nothing loads all of them, and nothing needs to:

```bash
pres beats                             # one line each: id, family, slides, the job
pres beats --phase build_understanding # the candidates for one phase
pres beats problem-before-solution     # exactly the one you chose, in full
```

That is the cheap path and the one STANDARD mode takes. The catalogue is enough
to select from; the file is read only for the beat actually being used.
`references/teaching-beats.md` is *how to choose* — the representation ladder, the
four beats most sessions need, why reset beats matter more than they look — and is
worth reading once rather than once per deck. DEEP mode reads it.

## The families

| Family | Beats |
| --- | --- |
| **orient** | open-lecture, preview-lecture, start-section, reconnect-prior-knowledge |
| **create_need** | problem-before-solution, contradiction-surprise, before-after |
| **introduce_concept** | intuition-to-definition, definition-to-non-example, build-progressively |
| **explain_mechanism** | component-interaction-mechanism, follow-one-object, zoom-in-zoom-out |
| **formalize** | observation-model-equation, derive-step-by-step, theorem-proposition |
| **algorithm** | naive-then-improved, code-walkthrough, execution-trace |
| **evidence** | claim-evidence-interpretation, analyze-artifact, compare-evidence |
| **apply** | case-to-concept, concept-to-case, worked-example |
| **student_thinking** | predict-reveal-explain, diagnose-misconception, compare-alternatives |
| **integrate** | story-so-far |

## The fields

- `purpose` — the teaching job, in one sentence.
- `best_for` / `avoid_when` — when to reach for it, and when not to.
- `sequence` — the steps, each with an `intent` and an `archetype`. This is
  what becomes the outline's slides.
- `visual_rules` — what the beat needs of its pictures. `reuse_visual_anchor`
  is the important one: it says to build one diagram up rather than draw five.
- `ask_the_professor` — questions worth asking, each with the condition that
  makes it worth asking. A question whose answer cannot change the sequence,
  the depth, the evidence or the representation is not worth asking.
- `exit_condition` — what is true for the learner when the beat ends. This is
  the field that says whether the slides in it are the right ones.
- `transition` — how it hands over to the next beat.

## Composing them

A section is normally two to four beats. A ninety-minute lecture is normally
five to nine. A beat with no `transition` into the next one leaves a deck that
is a set of mini-lectures sharing a title page — `pres outline check` says so.
