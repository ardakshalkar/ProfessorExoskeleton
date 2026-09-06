---
name: make-presentation
description: Make a presentation at the depth the request actually needs — a few slides written straight out, a course session planned compactly and built, or a full instructional-design pass with research and a professor's approval before anything is written. Use when the user asks for slides, a deck, a lecture, a talk or a presentation and has not asked for one particular stage. Planning only is /outline-presentation, writing an approved outline is /build-presentation, producing the .pptx and PDF is /render-presentation.
stage: orchestrate
produces: [deck, plan, pptx]
writes: drafts
---

# Make a presentation

Three depths. Pick one, do that one, and do not do the others' work.

```bash
pres route "<the request, in their words>"
```

One call. It prints the mode, why, the steps, what to read and what is
deliberately skipped. Follow it. Do not deliberate about the mode — if the
professor said `fast`, `standard` or `deep`, pass `--mode`, and that is the end
of it.

| | For | Costs |
| --- | --- | --- |
| **FAST** | a few slides, notes to turn into a deck, something exploratory | one file, three commands |
| **STANDARD** | the default: a real session, for a real class | a compact outline, then the deck |
| **DEEP** | a new lecture, research, accreditation, reuse, 20+ slides, or approval wanted first | the full workflow |

The point is not that FAST is sloppy. **The same rules about teaching apply in
all three.** What changes is how much of the reasoning becomes a file.

## FAST

Write the deck. Nothing before it.

```bash
pres plan build DECK.md --mode fast     # generates the render contract
pres check DECK.md
```

No research. No outline file. No approval gate — the request for slides *was*
the agreement, and `pres check` says so in a note, which you repeat when you hand
the file over.

No course probing either, unless they named a course. If they did, ask for the
copy on this machine and skip the network entirely:

```bash
pres context --course CSS-4008 --module MODULE-06 --brief --source local
```

The provenance line still says the database was skipped and why, so a five-slide
deck built off a local copy is never mistaken for one built off the shared one.
Drop `--source local` if the shared copy is the point.

Still true, because it is what makes the deck good rather than what makes it
slow:

- **Assertion headlines.** "Retrieval puts the answer in the prompt, not in the
  weights", never "Retrieval".
- **One claim per slide.** Two claims is two slides.
- **Draw what is drawable.** A bulleted list of pipeline stages is a diagram you
  declined to draw. Hand-authored SVG beside the deck, alt text on every one.
- **A question slide carries the question and nothing else.**
- **Create the need before naming the thing.** Even in five slides: problem,
  then idea, then how, then what it costs.
- **Cite or do not claim.** No statistic, dataset or quotation you cannot cite.

`pres rules` prints these in full if you want them in hand. `pres rules writing`
is the shortest useful subset.

## STANDARD — the default

```bash
pres context --course CSS-4008 --module MODULE-06 --brief   # skip if no course
pres grammar --deck technical_lecture                        # phases + a beat chain
```

`pres grammar` gives you the phase spine and a default beat chain for that kind
of session, plus the discipline's representation ladder with `--discipline`. It
replaces reading `deck-grammars.md`. `pres beats --phase build_understanding`
lists candidates one line each; `pres beats <id>` opens exactly one, and only
when you actually need its sequence.

Then write a **compact outline** — `<deck>.outline.yaml`, and compact means
these fields and not the rest:

```yaml
outline_version: 1
deck: MODULE-06-slides
title: Model evaluation and overfitting
course_id: CSS-4008
module_id: MODULE-06
status: draft
presentation:
  duration_minutes: 100
  deck_archetype: technical_lecture
  discipline: computer science
  output_mode: hybrid
arc:
  argues: a score measured on data you tuned against is not evidence of anything
  turn: the model that scored 0.97 in week 5 scores 0.61 on data it has not seen
  leaves_them_able_to: say which of two reported accuracies is trustworthy, and why
beats: [problem-before-solution, intuition-to-definition, predict-reveal-explain, story-so-far]
slides:
  - number: 2
    intent: create_need
    archetype: question
    title: When a high score is not evidence
    minutes: 8
    purpose: surface the train/test misconception using their own week-5 result
    concepts: [CONCEPT-MODEL-EVALUATION]
coverage:
  concepts_omitted:
    - concept: CONCEPT-REGULARIZATION
      why: introduced properly in MODULE-07; named here only as what comes next
```

A named beat chain instead of a beat block per beat. `intent` and `archetype` on
every slide, because those are what make the deck vary with the teaching rather
than with a layout rota. `coverage.concepts_omitted` with a reason, because an
unrecorded omission is indistinguishable from having forgotten.

```bash
pres outline check work/.../MODULE-06-slides.outline.yaml
```

Then **proceed**. Do not stop for approval — they asked for a deck.

Write the slides, draw the figures, then:

```bash
pres plan build DECK.md --mode standard
pres check DECK.md
```

If they *did* ask to approve first, stop after the outline check and pass
`--approval required` when you eventually build the plan.

## DEEP

`${CLAUDE_PLUGIN_ROOT}/references/deep-workflow.md` is the procedure, in full.
Read it, then run it: provenance, full context, published treatments, deck
grammar, the beat library, slide-level intent, coverage analysis, **the
professor's approval before anything is written**, then the deck, the QA and the
render.

Do not compress it. A professor in DEEP mode asked for the rigour.

## All three

- **Serve the claims, never add them.** No new outcome, concept, prerequisite or
  criterion. If the session needs one, say which and stop.
- **Say where the course came from.** `pres source` prints a provenance line and
  it goes in your report. A deck built from a course directory while they
  believed they were on the shared database looks identical to a correct one.
- **Never approve your own outline.** `status: approved` is the professor's,
  including in STANDARD, where it is not a gate but is still a record.
- **`pres plan build` writes the plan. You never do.** Every field in it is a
  copy of one in the outline or the markdown. Editing it by hand creates the
  second source of truth this plugin was built to remove.
- **Render only when asked.** `/render-presentation`, or
  `pres render DECK.md --pdf`. Then read the PDF.
- **Say what you generated.** `generated_by` in the deck's front matter.
