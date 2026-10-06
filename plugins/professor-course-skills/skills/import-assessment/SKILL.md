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
> - **A rubric here is proposed from evidence, not invented** — from the
>   marking scheme the exam already carries, and from the answers students
>   actually gave. Usually two or three of them, side by side, for the professor
>   to choose between; one criterion per written question, its maximum the
>   marks printed on the paper. Nothing is graded against any of them until the
>   professor has chosen and accepted one.
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

## Where to start

The pane calls this skill in one line — `/import-assessment ASSESSMENT RUN — what`
— and leaves the how to this file. Do not wait to be told where the pile
stands: `bin/ainar scans status RUN --assessment A` and
`bin/ainar grade status RUN --assessment A` say it. Then:

| Asked | Do |
| --- | --- |
| nothing, or a scan of an exam the course does not know | §1 onwards |
| *propose the rubric* | §7: group, then two or three proposals |
| *propose one rubric* | §7: group, then a single proposal |
| *rethink the rubric for Qn (ITEM-…) as `ID`: what to change* | §7, **Rethinking one question** |

If the answers are not recorded yet, say so and stop: reading them is the
pane's **Read & record** button (`scans read`, then `scans record`), not yours.

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

To print it again from the record — a reprint, or a clean PDF of a paper that
only exists as a scan — run `bin/ainar paper render <ASSESSMENT>`: one PDF and
DOCX per variant, no key, no browser, no process the sandbox would refuse. Never
render a paper through headless Chrome, Edge or LibreOffice.

## 6. Back to the scans

```bash
bin/ainar scans file CSS-4008-2026-FALL scanner-0042.pdf --assessment ASSESSMENT-QUIZ-03
```

for every PDF of this exam, and hand over to `/grade-scans` from its step 1:
plan, apply, read the answers, `scans record`. The choice items are then
`score-items`'s. Come back here for the written ones.

## 7. Rubrics, from the marking key and from what the class wrote

Once the answers are recorded:

```bash
bin/ainar scans answers CSS-4008-2026-FALL --assessment ASSESSMENT-QUIZ-03 --json
```

lists every question with its answers, identical ones collapsed and counted,
blanks counted separately, pseudonyms only. That collapse is exact; the rest is
yours. Two things, kept apart: **what the answers say** (the grouping, one for
the class) and **what each is worth** (a rubric, of which you propose several).

**Check first whether a marking scheme already exists.** An exam generated in
this project usually carries one — each item's `marking_guidance`, and the
key in `assessments/<ID>/keys/`. Quiz 1 of CSS-4007 has a full scheme there
and no rubric record. That scheme is the professor's; it is the first proposal,
not something to improve on quietly.

1. **Group by meaning**, per written question. Merge the answers that say the
   same thing in different words. Name each group by what it does: *names
   overfitting and gives a train / test gap example*; *defines it, no example*;
   *confuses it with underfitting*; *off the question*. A group is about content,
   not marks — the same groups serve every proposal.
2. **Propose two or three rubrics over those groups** — each one, per question,
   a set of levels and the level each group sits at:
   - **"From your marking key"** whenever the items carry `marking_guidance` or
     the key has a scheme: its levels are that scheme, split into levels as
     written (1 for the cause + 1 for a consequence → 2 / 1 / 0; Q4's parts
     added up, halves included). Nothing added that the scheme does not say.
   - **"From what the class wrote"**: levels drawn from the groups — what the
     answers actually contain, where the class went beyond or around the key.
   - A third only when it differs in a way worth choosing between — stricter,
     kinder on a common partial answer, half marks — never a near-copy.

   Each level's description says what an answer at that level contains, in
   terms a second marker could apply without you. Every proposal has a level at
   the question's full marks and one at 0, and no level above the marks. Say
   in the proposal's `summary`, in a sentence, how it differs from the others.
   Proposals that would mark the class the same way are one proposal.
3. **Mark what you are unsure of**: in a proposal, the groups you could not
   place with confidence (`unsure`, by their position in the question's list).

Write all of it in the private folder beside the scans,
`~/.ainar/submissions/<RUN>/<ASSESSMENT>/groups.yaml` (the folder `scans status`
prints). Every answered student of every written question in exactly one group;
a blank answer in none. `scores` is one entry per group, in the groups' order:

```yaml
assessment_id: ASSESSMENT-QUIZ-03
proposed_by: <the model you are>
created_at: '2026-10-02T15:00:00+05:00'
items:
  - item_id: ITEM-Q3-02
    groups:
      - label: names overfitting and gives a train/test gap example
        students: [STUDENT-4F2A7Q, STUDENT-9KX2PL]
      - label: defines it, no example
        students: [STUDENT-B7Q1ZZ]
      - label: confuses it with underfitting
        students: [STUDENT-QQ81AB]
proposals:
  - id: key
    title: From your marking key
    summary: 1 mark for the definition, 1 for an example that shows the gap.
    items:
      - item_id: ITEM-Q3-02
        title: Overfitting, defined and shown
        levels:
          - {score: 2, description: Defines it and gives a train/test gap example}
          - {score: 1, description: Defines it without an example, or the reverse}
          - {score: 0, description: Neither, or describes underfitting}
        scores: [2, 1, 0]
        unsure: [1]
  - id: class
    title: From what the class wrote
    summary: Treats the common "defines it, no example" as worth the full mark when the definition names unseen data.
    items:
      - item_id: ITEM-Q3-02
        levels: [...]
        scores: [2, 2, 0]
```

Pseudonyms only. **Write nothing into the course for the rubric** — no
`rubric` on the assessment, no `criterion_id` on the items. The professor's
choice does that: `ainar grade choose` writes the chosen proposal's levels as
that question's criterion, with the item's `outcome_id` and `concepts`, and
puts the assessment to `approval: draft` until they accept it. Then run

```bash
bin/ainar grade status RUN --assessment A
```

which reads it all back — each proposal's class mean and how many answers it
puts at each level — and reports a student in two groups, a score that is not
one of the proposal's levels, or a proposal with no full-marks level. Fix every
problem it lists.

Then hand it to the professor: **the pane's Scans tab → Grade the answers**
shows, per question, the proposals side by side — levels, how many answers
each puts there, the class mean — with **Use for Q1** and **Use for every
question**. They can mix: Q1 from the key, Q4 from the class. What they chose
then opens as a draft they can adjust (move a group to another level) and
accept. In chat, say per question how the proposals differ in effect ("the key
gives the class a mean of 0.9 of 2, the class-based one 1.7, because 20
answers name morphology without the vocabulary"), and the groups you were least
sure how to place. Ask the outcome a criterion measures if the item had none.

**Rethinking one question.** The professor read the proposals for one
question and says what to change; the message names the question, its item and
the id to give the new proposal. Keep `groups.yaml`'s groups as they are — if a
group must split, append the new group at the end of that question's groups,
move its students there, and append a score for it to every existing proposal.
Then add one proposal with the given id, a title saying what changed and a
one-sentence summary, covering that item only: its levels and a score per
group. Write nothing into the course. Run `grade status` and fix what it lists;
the professor compares and applies it in the Grade view.

## 8. Hand over

Once the professor has accepted the rubric, they grade in the same view: each
group's answers as cards beside the page, the group's score as the suggestion,
a mark per card, Accept per group, or Accept all. Every press is
`ainar grade decide`, which writes the `professor_decision` — never write one
yourself, and never run `grade decide` or `grade accept-rubric` unless the
professor has told you the marks or the decision in so many words. Answers that
need more than a group's score — a long written answer, a criterion with parts —
go to `/grade-batch`, whose per-answer suggestions the view shows the same way.
Report:

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
