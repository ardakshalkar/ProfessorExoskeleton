---
marp: true
title: Model evaluation and overfitting
module: MODULE-06
course_version: CSS-4008-2026-FALL
outcomes: [LO-02, LO-04]
concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
generated_by: build-presentation-skill
---

# Model evaluation and overfitting

MODULE-06 · CSS-4008 2026-FALL · 5 October

---

## Where we are

![Three modules left to right. Module 5, splitting data, is marked done. Module
6, evaluation and overfitting, is marked as where the course is now. Module 7,
closing the gap, is marked next. The arrow out of module 5 carries the score they
reported.](MODULE-06-slides-fig-03-arc-now.svg)

You can split a dataset and report a number. Today is what that number is, and
is not, evidence for — building on CONCEPT-TRAIN-TEST-SPLIT from MODULE-05.

---

## The number that meant nothing

Last week: 0.97, measured on the rows the model had just been fitted to.

A score on the data you fitted to answers *did this model memorise these rows*.
It did. That is what fitting is.

---

## Three sets, and what each one is for

![Training data used to fit the model, validation data used to choose between
models, and a test set held back and never touched during
tuning](MODULE-06-slides-fig-01-split.svg)

---

## Overfitting, stated precisely

**Overfitting** is not "the score is too high". It is a model having captured
structure that is in *this sample* and not in the population it was drawn from.

A model can overfit at 0.62 and generalise at 0.97. The number alone tells you
nothing; the pair of numbers tells you a great deal.

`CONCEPT-OVERFITTING`

---

## Reading two curves

![Two schematic plots of error against training epochs. In run A the training
curve falls to near zero while the validation curve turns upward part way along,
so the gap between them widens. In run B both curves fall together and flatten
close to one another, at a worse error than run A
reached.](MODULE-06-slides-fig-02-curves.svg)

The step people trip on is asking *which error is lower*. That is not the
diagnostic. The diagnostic is **which way the gap is moving**.

---

## Which score do you believe?

| Reported | What was measured on | Believe it? |
| --- | --- | --- |
| Accuracy after training | the rows the model was fitted to | No — this is memorisation |
| Best accuracy across 40 configurations | the validation set | No — you selected on it |
| Accuracy of the chosen model | a test set touched once | Yes, with its interval |

The middle row is the one that catches people, and it catches published papers
too. Choosing among forty models by validation score makes the validation score
a thing you optimised, which makes it a training score in every sense that
matters.

`CONCEPT-MODEL-EVALUATION`

---

## Check yourself

1. A classmate reports 0.99 accuracy. What is the first question you ask them,
   and what answer would make the number meaningless?
2. Training error 0.02, validation error 0.31, and the validation curve has been
   rising for ten epochs. Is this overfitting, underfitting, or not determinable
   from what you have been told?

---

## Next

![The same three modules as the opening slide, with the marker moved: modules 5
and 6 are both marked done, and module 7, closing the gap, is now marked as
where the course goes next.](MODULE-06-slides-fig-04-arc-next.svg)

Before MODULE-07: the starter notebook (RES-442), through the first checkpoint.
