# Choosing and building an assessment

Reference material. `bin/ainar blueprint <RUN>` does the arithmetic for a
course in this model — what to cover, what is over-assessed, what has never
been measured. This file is the judgement that sits around it.

## What kind of assessment this is

Two questions come before the instrument, and they are different questions.

**What is it for?** The standard division is by purpose, not by format — the same
quiz is a different assessment depending on when it runs and what happens to the
mark.

| Kind | Runs | Purpose | In this model |
| --- | --- | --- | --- |
| Diagnostic | before teaching | find what students already know and already misunderstand | concept-tagged choice items; `ainar score-items` reports what the class converged on, and `/find-gaps` reads it |
| Formative | during teaching | reveal, in time to act, what is not landing | an assessment with **no weight** — it produces evidence through `extract-evidence` without touching the grade |
| Summative | at the end of a block | establish what was achieved | an assessment with a `weight`, which is what `ainar gradebook` totals |
| Ipsative | across the term | compare a student to their own earlier performance | `StudentConceptState` and capability levels over time; `ainar student` shows the trajectory rather than the rank |

The formative row is the one worth noticing. A weightless assessment is not a
weaker assessment here — it is the one whose whole return is diagnosis, and the
model supports it directly: evidence is derived from decided criteria regardless
of weight, so a formative quiz builds the concept map without moving anyone's
grade. Asking a professor "should this count?" is asking whether it is formative
or summative, and it is their answer.

**Against what is it judged?** Criterion-referenced means judged against a stated
standard; norm-referenced means judged against the other students.

**This model is criterion-referenced by construction.** A `RubricCriterion` has
level descriptions and a `maximum_score`, and nothing anywhere takes a class
distribution as input. There is no curve, no percentile, no scaling to a target
mean — `ainar gradebook` refuses even to rescale a criterion set that does not
sum to the assessment maximum. If a professor asks for a curve, that is a request
the model cannot serve, and saying so is the honest answer.

One more distinction worth having language for: **authentic** assessment asks for
the thing the outcome actually names — a working notebook, a defended design, a
report someone would act on — rather than a proxy for it under exam conditions.
It costs more to mark and it is the only kind that reaches `create` on the
cognitive scale. The instrument table below is roughly ordered by it.

## Choosing the instrument

| Instrument | Reaches | Costs | Good when |
| --- | --- | --- | --- |
| Choice items | up to `apply`, diagnostically | cheap to mark, expensive to write well | you want per-concept diagnosis across a whole class |
| Short answer | `understand`–`analyze` | marking scales with class size | you need reasoning, not recognition |
| Problem set | `apply`–`analyze` | moderate | procedures with a right answer and visible working |
| Report or essay | `analyze`–`evaluate` | high, and inconsistent without a rubric | judgement that has to be defended |
| Project | `create` | highest, hardest to compare across students | the outcome genuinely is an artefact |
| Oral defence | `evaluate`–`create` | high per student, near-impossible to fake | you need to know the work is theirs |

Two practical notes. **Choice items are the only instrument that scales
diagnosis** — thirty tagged items across twenty-seven students is 810 data
points about which concept failed, and no other instrument gives that. And
**the marking cost is the real constraint**: an instrument you cannot mark
consistently by week 12 produces noise, and noisy evidence is worse than less
evidence.

## Writing a choice item that diagnoses

The point of an item is not that a student gets it right. It is that *how they
got it wrong* tells you something. So every distractor should be a specific
misconception somebody actually holds:

```yaml
options:
  - label: b
    text: It is valid, because the model still had to learn the pattern.
    indicates_misconception_of: CONCEPT-TRAIN-TEST-SPLIT
    note: Memorisation being read as generalisation.
```

A distractor nobody would choose is a wasted quarter of the item. If you cannot
name the misconception a distractor encodes, replace it.

Tag every item with the concepts it exercises and the outcome it serves.
Untagged items produce a percentage; tagged items produce a diagnosis.

## Writing a rubric criterion

A criterion is a claim about what is being judged, so its wording matters as
much as its weight.

- **Name the outcome.** A criterion with no `outcome_id` produces marks but no
  evidence and no capability map — which defeats the point of the model.
- **Describe levels by what is observable**, not by adverbs. "Identifies the
  train/test leak and attributes the performance gap to it" is applicable;
  "excellent understanding of evaluation" is not, and two markers will not
  agree on it.
- **A criterion whose markers disagree is a rubric problem**, not a marker
  problem. `ainar calibration` surfaces exactly this: a criterion with a low
  agreement rate between the grading agent and the professor is usually one
  whose level descriptions are too vague to apply.
- **Four bands is usually enough.** Six bands means two of them never get used.

## Weight is a claim

Never choose a weight for a professor. If adding an assessment makes the run's
weights stop summing to 1.0, report it and stop — reweighting something else to
absorb it changes what the course claims about its own priorities.

## The blueprint comes first

Designing by intuition over-samples whatever is easiest to write questions
about. Before writing a single question, know:

- how many marks each outcome should carry, from its declared weight;
- what each outcome **already** carries across existing assessments;
- which concepts have never been assessed at all;
- which concepts were assessed and went badly — those want a *different*
  question, not the same one again.

## Related

- [bloom-taxonomy.md](bloom-taxonomy.md)
- [constructive-alignment.md](constructive-alignment.md)
