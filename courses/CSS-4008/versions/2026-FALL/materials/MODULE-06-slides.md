---
marp: true
title: Model Evaluation and Overfitting
module: MODULE-06
course_run: CSS-4008-2026-FALL
outcomes: [LO-02, LO-04]
concepts: [CONCEPT-MODEL-EVALUATION, CONCEPT-OVERFITTING]
generated_by: make-materials-skill
---

# Model Evaluation and Overfitting

CSS-4008 · Week 6 · ACT-0601

Serves **LO-02** (implement and evaluate a model) and **LO-04** (design and
evaluate an AI solution).

---

## Where we are

You can already split data (week 5) and train a supervised model (week 4).

Today: deciding whether the number your model reports means anything.

> Prerequisite check — CONCEPT-TRAIN-TEST-SPLIT. Two of three students on the
> foundations quiz chose the answer that reads memorisation as generalisation
> (ITEM-01-02). Five minutes on this before moving on.

![One dataset split three ways: training data at 60% fits the parameters,
validation at 20% chooses the model, and a sealed test set at 20% is opened once
to report the number. Any decision made by looking at the test set makes it
training data.](MODULE-06-slides-fig-01-split.svg)

---

## A number without a procedure is not a result

```
train accuracy 0.98
test  accuracy 0.71
```

Three questions before you believe either figure:

1. Was the test set touched during training or tuning?
2. Does the metric match what failure costs?
3. Would someone else get the same number from your description?

---

## Choosing a metric

| Situation | Accuracy misleads because | Prefer |
| --- | --- | --- |
| 2% of patients need ICU | Predicting "no" always scores 98% | Recall, PR-AUC |
| False alarms are expensive | Treats both errors alike | Precision |
| Ranking, not deciding | Throws away the ordering | ROC-AUC |

**CONCEPT-MODEL-EVALUATION**: the metric is part of the claim, not a detail
after it.

---

## Overfitting

**CONCEPT-OVERFITTING** — the model performs well on training data and poorly
on data it has not seen.

It is not a bug in the code. It is the model describing the sample instead of
the thing the sample came from.

Depends on CONCEPT-TRAIN-TEST-SPLIT: without honestly held-out data, you
cannot detect it at all.

---

## Diagnosing it

The gap between training and held-out performance is the signal.

- Gap grows as capacity grows → overfitting
- Both scores low → underfitting, a different problem
- Held-out score better than training → you have a leak, go and find it

Next week: regularization, which is what you do about it.

---

## Check for understanding

1. Your test accuracy improved after you tuned on the test set. What is wrong
   with that number?
2. A classmate reports 99% accuracy on a task where 99% of labels are one
   class. What do you ask them?
3. Training and test scores are both 0.62. Is this overfitting?

---

## For the lab (ACT-0602)

Bring the model you trained in week 5.

You will produce the train/test gap for two model capacities and say, in one
sentence each, what the gap tells you.

Materials: RES-441 (these slides), RES-442 (starter notebook)
