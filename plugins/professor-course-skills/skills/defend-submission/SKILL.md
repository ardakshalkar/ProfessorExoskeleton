---
name: defend-submission
description: Draft the questions for one student's oral defence of their homework — read the repository they handed in, pinned to the commit at the hand-in, against the brief and the rubric, and write an opening question and probes into their own code, each tied to a criterion and to the lines it is about, as drafts the professor edits before asking. Use when the pane's Start defence button sends `/defend-submission ASSESSMENT RUN STUDENT`, or the user asks to prepare a defence, a viva, an oral check or questions about a student's code.
stage: assess
requires: [assessments, submissions]
produces: [defence questions]
writes: drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Every question is `approval: draft`. The professor reads, edits or cuts
>   them before asking any. Never mark one approved.
> - **You never grade and you never accuse.** A question is a question. If
>   the code looks copied, write the question that would tell — never a
>   sentence saying so.
> - **No student name** anywhere: the identifier only.
> - Write the questions with `ainar defence questions`, not by hand: it checks
>   every criterion and every cited line against the code you were shown.

# Prepare an oral defence

**Arguments:** `ASSESSMENT RUN STUDENT`, in that order — what the pane sends.

## 1. Read the code

```bash
bin/ainar defence code RUN --assessment ASSESSMENT --student STUDENT
```

It prints the brief, the rubric criteria and the repository as handed in,
every line numbered. If it says *not cloned yet*, the pane's press did not
finish: say so and stop — `defence prepare` runs in the pane, because it
writes the private folder and this session cannot.

Read all of it. Notice what the student chose: how the data is loaded and
split, which model and why, what is tested, what is hard-coded, what is
unusual, what does not match the brief. Note what the digest lists as *not
shown* — never ask about a file you did not read.

If the commit line says the fork has moved on since, or that every commit came
after the hand-in, tell the professor in one sentence; it matters at a
defence.

## 2. Draft the questions

Six by default; the professor may ask for more or fewer.

- **Q1 is the opening**: ask the student to explain, in their own words, what
  their homework does and how it is organised. No evidence needed.
- **Every other question is a probe into this student's code**: a specific
  choice, why it works, what would change if an input changed, a line that
  looks wrong or unusual. Name the function, variable or notebook cell so the
  student can find it on screen.
- Prefer questions the author answers easily and someone who copied the code
  cannot.
- Spread them across the rubric criteria. `criterion_id` is the one the answer
  is evidence for, from the digest's list only; null when none fits.
- `evidence`: the file and the line range the question is about, as numbered
  in the digest.
- `why`: one sentence for the professor — what a good answer shows, or what
  the code suggests the student may not understand.
- Spoken language, one question at a time, no compound questions. The
  language of the brief.

## 3. Write them

Put them in a JSON file under the workspace's `output/` (the session can write
there; it cannot write `~/.ainar`):

```json
{"questions": [
  {"kind": "opening", "text": "…", "criterion_id": null, "why": "…", "evidence": []},
  {"kind": "probe", "text": "…", "criterion_id": "CRIT-…", "why": "…",
   "evidence": [{"path": "train.py", "lines": "12-30"}]}
]}
```

```bash
bin/ainar defence questions RUN --assessment ASSESSMENT --student STUDENT --from output/defence-draft.json --by "<your model name>"
```

It numbers them, marks each `approval: draft`, and writes
`output/RUN/defence/ASSESSMENT/STUDENT.yaml`, which the pane shows under the
student's submission. Anything it dropped — a criterion the rubric does not
have, a citation of unseen lines — it prints; fix the question and write
again with `--force`. Without `--force` it refuses to overwrite questions
already there, because the professor may have edited them.

## 4. Hand over

Reply with the questions as the professor will ask them, numbered, each with
its criterion and one line of why. Say they are drafts in the pane under the
student's submission. Do not grade anything.

## A follow-up: `… — follow-up on Qn`

The defence desk sends this when the professor wants one more question about
an answer the student just gave. The professor is mid-defence with the student
in front of them: be quick, and write **one** question.

```bash
bin/ainar defence session RUN --assessment ASSESSMENT --student STUDENT
```

It prints every question with what the student said, timestamped. A stretch
marked LOW CONFIDENCE is what the transcriber was unsure of: do not build the
follow-up on a word there. Run `defence code` as well if the answer points at
code you need to see again.

Ask about the gap in **this** answer: the claim they made and did not justify,
the step they skipped, the thing they said that the code does not do. Do not
repeat a question already asked. Then:

```json
{"questions": [{"text": "…", "follows": "Qn", "criterion_id": "CRIT-…", "why": "…", "evidence": []}]}
```

```bash
bin/ainar defence questions RUN --assessment ASSESSMENT --student STUDENT --from output/defence-follow-up.json --append
```

It is numbered after the others and appears on the desk. Reply with the
question alone and one line of why. Never `--force` once the student has
answered: the command refuses, because the answers would then point at
different questions.
