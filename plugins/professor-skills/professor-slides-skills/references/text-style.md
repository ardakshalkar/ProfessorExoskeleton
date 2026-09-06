# How to write the words on a slide

`visual-grammar.md` says what each slide's text is *for* — its role and its
density. This says how to write it.

## The single highest-return change: a headline that asserts

Almost every generated deck, and most human ones, give a slide a **topic**:

> Placer Deposits

An assertion-evidence headline gives it a **claim**:

> Placer deposits arise from the erosion of lode deposits

This is not a style preference; it is the best-evidenced finding in slide
design. In controlled comparisons, audiences shown assertion headlines scored
higher on recall, higher on understanding, higher on higher-order questions, and
were still ahead on a delayed quiz a week later.

The mechanism is worth understanding, because it explains why the effect is so
large. A topic headline says *what area we are in* and leaves the audience to
work out what they are supposed to conclude — usually from a bullet list, while
the speaker is talking over it. An assertion headline states the conclusion, and
the rest of the slide becomes evidence for it. The audience knows what they are
looking at, and the speaker has somewhere to land.

It also improves the deck before it is written. A professor forced to state each
slide's claim as a sentence discovers which slides have no claim, and those are
exactly the slides worth cutting.

**Write the headline as a sentence.** It may run to two lines; that is fine and
far better than a noun phrase.

| Instead of | Write |
| --- | --- |
| Tokenization | A tokenizer maps text to integer IDs, and back |
| Cost Analysis | Kazakh costs 1.75× English for the same news |
| Overfitting | The gap between the curves is the diagnostic, not either number |
| Results | Accuracy drops sharply beyond 8K tokens |

The last one is the general rule for any slide carrying a chart: **the headline
carries the claim, the chart carries the evidence.** "Accuracy by context
length" describes the axes, which the audience can already see.

## Sentence case, not Title Case

For headlines *and* body text.

We read words partly by their outline — their so-called bouma shape — and we
have seen almost every word far more often in lower case than with a capital.
Title Case flattens those outlines into a row of similar rectangles and is
measurably slower to read. On a slide, read at distance and in a hurry, that
cost is real.

Sentence case also stops fighting the assertion rule: a headline that is a
sentence should be capitalised like one.

ALL CAPS is worse again, for the same reason plus a shouting problem. Reserve it
for a two-word label inside a diagram, if at all.

## Parallel structure in every list

Every item in a list should be the same grammatical shape — all starting with a
verb, or all noun phrases, or all full sentences. Never a mixture.

```text
Bad                                Good
- Choosing a metric                - Choose a metric that matches the task
- The data must be split           - Split the data before tuning anything
- Reporting honestly               - Report the held-out score, not the best one
```

The failure is not really grammatical. A reader who hits an item that breaks the
pattern spends a moment resolving the break, and that moment comes out of the
attention they were giving the content. Parallelism does not make a list more
memorable; breaking it makes the list less.

Two rules that follow:

- **A list of one item is not a list.** Write it as a sentence.
- **A list of eight is not a list either.** It is a wall. Group it, or cut it.

## Cut the words the room does not need

Slide text is read, not spoken, and it competes with the speaker. Every word on
the slide is a word the audience reads instead of listening.

- **No full sentences in bullets** unless the sentence *is* the point. "Choose a
  metric that matches the task" beats "It is important that you choose a metric
  which is appropriate for the task at hand".
- **No leading "The", "A", "There are"** where the item survives without them.
- **Do not narrate the visual.** If the slide shows three maps, the text says
  what to notice about them, never that there are three maps.
- **No sentence that only exists to introduce the next slide.** Say it aloud.

## Where the emphasis goes

Bold carries one idea per slide, at most. Bold on four phrases marks nothing.

Italic is for a term being introduced, a title, or a word being used in an
unusual sense — not for emphasis, which italics do weakly at projector distance.

And a constraint of this renderer rather than of typography: **emphasis inside a
bulleted line renders as plain text.** PowerPoint cannot be given a bullet and
mixed formatting in the same line through this toolchain, so the bullet wins and
the bold is dropped. `pres check` names any item where that happened. If a word
in a list must be emphasised, the sentence probably wants to be a paragraph.

## Numbers, units and identifiers

- **Round to what the claim needs.** 1.75× not 1.7532×. The precision that
  matters goes in the notes or the handout.
- **Keep the unit with the number**, and keep it the same across a table.
- **Concept and outcome identifiers** (`CONCEPT-OVERFITTING`, `LO-02`) belong on
  the slide only where the structure is the point. They are for the course
  model; students do not read them.

## Language

The deck's language is a preference, and it is resolved before writing. What is
worth saying here is that a technical term the students will meet in English
should appear in English at least once, whatever the deck's language — the
literature they go on to read will use it.

## What this looks like as a checklist

Before handing a deck over:

- Does every headline state a claim rather than name a topic?
- Is everything in sentence case?
- Is every list parallel, and between two and five items?
- Does any text describe something the audience can already see?
- Is bold doing one job per slide?
- Would each slide still make sense to a student who reads it a week later
  without you in the room — or is it marked `delivery_dependency: high` because
  it deliberately would not?

## Sources

- [How the Design of Headlines in Presentation Slides Affects Audience Retention — Alley et al., Penn State](https://www.writing.engr.psu.edu/ae_headlines.pdf)
- [Assertion-Evidence Slides Appear to Lead to Better Comprehension and Recall of More Complex Concepts — ASEE](https://peer.asee.org/assertion-evidence-slides-appear-to-lead-to-better-comprehension-and-recall-of-more-complex-concepts.pdf)
- [In PowerPoint, It's the Headline that Makes the Difference — WashU Center for Teaching and Learning](https://ctl.wustl.edu/in-powerpoint-its-the-headline-that-makes-the-difference/)
- [Slide Title Guidelines: Use Assertions, Not Topics — Six Minutes](https://sixminutes.dlugan.com/assertion-evidence-design-presentation-slides/)
- [Slide headlines: Title Case, ALL CAPS, or Sentence case? — Dave Paradi](https://www.linkedin.com/pulse/slide-headlines-title-case-all-caps-sentence-heres-what-dave-paradi)
- [Parallel Structure — The Secret to Beautiful Bullet Points](https://erinwrightwriting.com/parallel-construction-the-secret-to-beautiful-bullet-points/)
- [Parallel Structure with Vertical Lists — Get It Write](https://getitwriteonline.com/parallel-structure-vertical-lists/)
