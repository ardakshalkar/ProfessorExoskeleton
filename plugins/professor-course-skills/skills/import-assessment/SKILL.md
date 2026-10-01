---
name: import-assessment
description: Bring an exam or quiz that already exists into the course — work out from the scanned covers which assessment it is and ask the professor to confirm, ask about variants, store its questions as markdown with the professor's answer key, and, once the answers are read, group what students wrote and propose a rubric for the written questions. Use when scans arrive for an assessment the course has no record of or no questions for, when the user uploads a question paper or an exam they already gave, asks to import, record or add an existing exam, quiz or test, or asks which quiz a scan is. Writing a new exam from the course's outcomes is /design-assessment instead.
stage: assess
requires: [enrollments]
produces: [assessments, items, documents]
writes: drafts
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write into the course, where the record belongs — the file for its
>   collection under `courses/<COURSE>/`, with its real identifier — and mark
>   every record you write `approval: draft` (a grade: `status: suggested`).
>   Nothing is moved afterwards, and nothing student-facing reads a draft.
> - **The paper is the professor's. Copy it, never compose it.** The questions,
>   their marks and the answer key come from the paper and from the professor —
>   word for word, marks as printed, the key as given. Never work out a key from
>   what most of the class wrote, never fill in a mark the paper does not print,
>   and never invent an outcome or a weight: leave them empty and say so.
> - **A rubric here is proposed from evidence, not invented.** One criterion per
>   written question, its maximum the marks printed on the paper, its levels
>   described from the answers students actually gave, each with how many gave
>   it. Proposed, marked draft, and nothing is graded against it until the
>   professor has answered.
> - **Never accept your own work.** Do not write `approval: approved`, a
>   `professor_decision`, or an approved status.
> - **No student name, email or institutional number in any file under the
>   workspace,** and none in your report — name a paper by its file and pages.
>   A cover page is read for which exam it is; who wrote it is `/grade-scans`'s.
> - Before reporting anything: `bin/ainar validate <COURSE>`, and fix every error.
> - Never do by hand what a command does exactly — ranking the run's
>   assessments, deriving items from the paper, grouping identical answers.

# Import an existing exam

`/design-assessment` writes an exam that does not exist yet. This is the
opposite case: the professor set the paper, the class sat it, a pile of scans
came back — and the course either does not know which assessment it is, or
knows the assessment but has none of its questions. Without the questions, a
scan has nothing to be read against.

```
uploaded PDFs ──► <RUN>/_inbox/ ──identify──► "is it Quiz 3?" ──yes──► scans file ──► /grade-scans
                  (unfiled)        (ranked)        │                       ▲
                                                   └─ new, or no questions ┘
                                                      variants? paper.md + key.md
                                                      import-paper ──► items (draft)
                                    /grade-scans reads the answers ──► scans answers
                                                                          │
                                         rubric proposed from the groups ◄┘ ──► professor ──► /grade-batch
```

## 1. Which exam is this?

Uploads whose assessment nobody has named go to the run's unfiled inbox,
`~/.ainar/submissions/<RUN>/_inbox/` (or under `AINAR_SUBMISSIONS_DIR`).
Copy them there if the professor pointed you at them.

**Read the first page or two of each PDF** (Read with `pages: "1-2"`) — only
what is printed: the course code, the title (`Quiz 3`, `Midterm 1`,
`Контрольная работа №2`), a date, a version mark (`Variant A`, `Вариант 2`).
Do not write down anything handwritten, and never the name on the cover.

Then rank the run's assessments against what you read:

```bash
bin/ainar scans identify CSS-4008-2026-FALL --title "Quiz 3 Classification" --date 2026-10-20
```

```
  0.77  ASSESSMENT-QUIZ-03  Quiz 3 — Classification (quiz)  NO QUESTIONS  due 2026-10-21
        shares "quiz", "3", "classification" with the cover; sat on paper
  0.21  ASSESSMENT-QUIZ-02  Quiz 2 — Regression (quiz)  8 question(s)
        shares "quiz" with the cover; its number (2) is not the cover's (3)
```

**Ask; do not decide.** Put the top candidates to the professor as a question
(AskUserQuestion): the best two or three, each with its question count, and
"a new assessment" as the last option. Say what you read on the cover that
points at your first choice. A pile filed under the wrong assessment puts every
student's answers against someone else's questions.

Their answer decides the path:

| Answer | Next |
| --- | --- |
| an assessment that **has** its questions | `scans file RUN FILE --assessment A`, then hand back to `/grade-scans` |
| an assessment with **no questions** | §2, against that assessment's id |
| **a new assessment** | §2, with a new id: `ASSESSMENT-<SHORT>` from the title (`QUIZ-03`, `MID-1`) — confirm it with them |

## 2. Variants

Ask before writing anything, because every item id depends on it:

> Did everyone sit the same paper, or were there versions? If there were — how
> many, and how is the version marked on the paper?

Check what they say against the covers you read: a cover saying `Variant B` on
an exam the professor calls single-version is worth one more question. Then
read the variant off each cover later, in `/grade-scans`; it is never guessed.

## 3. The questions, as markdown

**Prefer the professor's own file.** Ask for the question paper they printed —
a `.docx`, a PDF, the source they wrote it in. Its text is exact; text read off a
scan is not. If there is no file, use a clean printed question sheet from the
pile (often a page of its own, which `/grade-scans` will `skip`), and only as a
last resort the printed questions on a student's paper — the printed text, never
the handwriting.

Write one markdown file per variant. Anywhere is fine — `import-paper` puts it
in the assessment's folder — but the shape is exact:

```markdown
---
variant: A                          # only when there are versions
---
# Quiz 3 — Classification           # anything before question 1 is the header

Closed book. 30 minutes.

## 1. (2 marks)
Which of these is a supervised task?
- (a) Clustering
- (b) Classification

## 2. (5 marks) {essay}
Explain overfitting, with an example.
```

- A question is a `##` heading starting with its number (`## 3.`,
  `## Question 3`, `## Задание 3`). A section heading uses `#`, or no number.
- **Marks on the heading**, in parentheses or brackets, as printed. A paper that
  does not print them: ask the professor. `import-paper` refuses a question with
  no marks rather than assume one.
- Options: `(a) …`, `a) …` or `a. …`, bulleted or not. Labels are read
  lowercase, which is how transcripts write them.
- `{type}` when the obvious one is wrong: `{essay}`, `{numeric}`, `{code}`,
  `{short_answer}`. Options make a choice item; two options True/False make
  `true_false`; a key with two answers makes `multiple_select`.
- Word for word. Formulas in plain LaTeX. A figure you cannot copy: write
  `[figure: what it shows]` and tell the professor it is a placeholder.

## 4. The key

**The answers are the professor's.** Ask for their key — a file, a photo of the
marked paper, or typed in chat — and write it down as given:

```markdown
## Variant A
1. b
3. a, c
## 2
A model fits noise in the training data and does worse on unseen data.
## Variant B
1. a
```

A choice question needs its answer: without one, `import-paper` writes nothing
and lists what is missing. A written question's model answer is optional — if
there is none, §7 is where it gets asked for.

Never read a key off the students' answers, however lopsided they are. A class
that converged on one option may have converged on the wrong one; that is a
finding for the professor, and it is `score-items` that reports it.

## 5. Import

```bash
bin/ainar import-paper CSS-4008-2026-FALL --assessment ASSESSMENT-QUIZ-03 \
  --paper quiz3-A.md --paper quiz3-B.md --key quiz3-key.md \
  --title "Quiz 3 — Classification" --type quiz --dry-run
```

Read what it says — questions and marks per variant, totals that disagree, a key
naming an option that is not on the paper — and fix the markdown, not the
output. Then run it without `--dry-run`. It writes:

- `assessments/<ID>/<SHORT>-student[-A].md` — the papers, registered as Documents;
- `assessments/<ID>/keys/<SHORT>-key.md` — the key, which nothing publishes;
- `assessments/<ID>/items.yaml` — derived; **correct a question by editing the
  paper and importing again**, never by editing the items. A re-import keeps a
  question's criterion, concepts and outcome;
- for a new exam, `assessment.yaml` — `delivery: paper_exam`, `maximum_score`
  from the paper, and `weight` and `outcomes` empty, which are the professor's.

`--title` only for a new assessment, as printed on the paper. Everything is
`approval: draft`. Then `bin/ainar validate <COURSE>`.

## 6. Back to the scans

```bash
bin/ainar scans file CSS-4008-2026-FALL scanner-0042.pdf --assessment ASSESSMENT-QUIZ-03
```

for every PDF of this exam, and hand over to `/grade-scans` from its step 1:
plan, apply, read the answers, `scans record`. The choice items are then
`score-items`'s. Come back here for the written ones.

## 7. A rubric, from what the class wrote

Once the answers are recorded:

```bash
bin/ainar scans answers CSS-4008-2026-FALL --assessment ASSESSMENT-QUIZ-03 --json
```

lists every question with its answers, identical ones collapsed and counted,
blanks counted separately, pseudonyms only. That collapse is exact; the rest is
yours. For each **written** question:

1. **Group by meaning.** Merge the answers that say the same thing in different
   words. Name each group by what it does: *names overfitting and gives a train /
   test gap example*; *defines it, no example*; *confuses it with underfitting*;
   *off the question*. Keep the count of each.
2. **Propose a criterion.** `CRIT-<SHORT>-<NN>` (with variants:
   `CRIT-<SHORT>-<V>-<NN>`, unless the professor says two versions' question N
   test the same thing — then one criterion serves both). Title: what the
   question checks. `maximum_score`: the question's marks, from the paper.
   Never more, never fewer.
3. **Levels from the groups**, top to bottom, ending at 0. Each level's
   description says what an answer at that level contains, in terms a second
   marker could apply without you — and beside it, how many answers fell there
   ("9 of 24"). A level no answer reached is still worth having if the marks
   imply it; a group that fits no level is a level you are missing.
4. **Use the model answer** from the key, where there is one, to set the top
   level — and say where the class's best answers differ from it.

Show the professor the whole proposal at once, compactly — per question: the
criterion, its levels with counts, and the one or two groups you were least sure
how to place. Ask what to change. Ask the outcome each criterion measures; do
not pick it.

Then write it:

- the rubric into the assessment, `assessments/<ID>/assessment.yaml` — inline
  `rubric: { rubric_id: RUBRIC-<SHORT>, criteria: [...] }`, each criterion with
  `rubric_id`, `title`, `maximum_score`, `levels`;
- each written item's `criterion_id`, in `items.yaml` — the one field you add
  there by hand, and the one a re-import keeps;
- the assessment's `approval: draft`. If it was already accepted, the rubric is a
  change to it, so it goes back to draft — say so in your report.

Validate. A criterion whose items do not add up to its maximum is a warning that
means a mark is wrong somewhere; fix it before grading.

## 8. Hand over

Once the professor has answered on the rubric, the written items go to
`/grade-batch`. Report:

- which assessment the pile was, and what the professor confirmed;
- questions and marks per variant, and anything in the paper you could not copy
  exactly (a figure, an illegible line);
- what still needs the professor: the weight, the outcomes, any model answer
  that was missing, each record still `approval: draft` (`bin/ainar drafts <RUN>`);
- for the rubric: per question, how the answers spread across the levels, and
  the groups you placed with least confidence.

## Rules

- **Never file a scan under an assessment the professor has not confirmed.**
- **Never guess a variant, a mark or an answer.** Ask.
- **The paper markdown is the source of the items.** Fix the paper and re-import.
- **The key is the professor's.** Never derive it from the class.
- **A level describes an answer, never a student.** No names, no comparisons to
  classmates, no claims about effort.
- **Nothing is graded against a rubric the professor has not answered on.**
