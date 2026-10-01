---
name: grade-scans
description: Take scanned paper exams — one PDF per student or one batch PDF of the whole class, with or without variants — split them into one paper per student, match each to the roster, read the answers off the pages, and hand them to grading. Use when the user uploads, drops or points at scanned exams, scans, a PDF of handwritten papers, a scanner batch, or asks to grade paper exams, quizzes or midterms that were written by hand.
stage: assess
requires: [assessments, items, enrollments]
produces: [submissions, item_responses]
writes: records
---

> **Non-negotiables.** This skill proposes; a person decides.
>
> - Write into the course, where the record belongs — the file for its
>   collection under `courses/<COURSE>/`, with its real identifier — and mark
>   every record you write `approval: draft` (a grade: `status: suggested`).
>   Nothing is moved afterwards, and nothing student-facing reads a draft.
> - **Never accept your own work.** Do not write `approval: approved`, a
>   `professor_decision`, or an approved status.
> - **No student name, email or institutional number in any file under the
>   workspace,** and none in your report either — name a paper by its file and
>   page range, or by its pseudonym. Names live only in the private folder.
> - Before reporting anything: `bin/ainar validate <COURSE>`, and fix every error.
> - Never do by hand what a command does exactly — splitting, matching a number
>   to the roster, `score-items`.

# Grade scanned paper exams

A scan carries names and handwriting, so it never enters the repository. It
lives in the private submissions folder — `~/.ainar/submissions/<RUN>/<ASSESSMENT>/`
(or `AINAR_SUBMISSIONS_DIR`) — and the course gets only pseudonymous records.
`STORAGE.md` has the layout; `ainar-node/src/scans.ts` has the rules.

The work is two passes, and they are kept apart on purpose: **first read what
is on the page, then grade it.** A reader who is also grading starts seeing the
answer they expect.

```
_inbox/*.pdf ──plan──► _inbox/plan.yaml ──apply──► <STUDENT>/scan.pdf + transcript.yaml
                        (you fill: pages,           + records/submissions.yaml
                         who, variant)                         │
                                                  you read ◄───┘
                                                  transcript.yaml ──record──► records/item-responses.yaml
                                                                                   │
                                                          score-items (choice) ◄───┤
                                                          /grade-batch (written) ◄─┘
```

## 0. Which exam, and where things stand

**If nobody has said which assessment the pile is** — "here are the scans, grade
them" — it goes to the run's unfiled inbox, `~/.ainar/submissions/<RUN>/_inbox/`,
and `/import-assessment` §1 works it out: read the covers, `scans identify`,
ask the professor, `scans file`. Never pick the assessment yourself.

Once it is filed:

```bash
bin/ainar scans status CSS-4008-2026-FALL --assessment ASSESSMENT-MIDTERM
```

It says how many PDFs are in the inbox, how many papers are planned, placed and
transcribed, and who has no scan yet. Start every session here: the pipeline is
resumable, and each step only does what is still waiting.

**Before anything else, check the assessment has its questions recorded** —
`questions N` in the status. No items means nothing to transcribe against, and
`scans plan` refuses: the exam already exists, so its questions are imported
from the paper, not designed — `/import-assessment` §2–§5, then come back. An
exam with versions has each version-specific item marked
`extensions: { variant: A }` (shared questions carry no variant); `status`
prints the variants it found.

## 1. Choose the workflow from what arrived

Put the PDFs in `_inbox/` (ask the professor to, or copy them there if they
point you at them). Then pick the shape that matches the pile:

| What arrived | Plan with | Then |
| --- | --- | --- |
| **One PDF per student** | `scans plan RUN --assessment A --per-file` | read each file's first page for the name or number |
| **One batch, every paper the same length** | `--pages-per-student N` | check the first page of every proposed range is a cover |
| **One batch, papers of different lengths** | `scans plan RUN --assessment A` (no shape) | read the pages, find each cover, write the ranges |
| **Several batches** (sections scanned separately, a late paper) | run `plan` again after each arrives | it adds new files and keeps what you wrote |
| **A rescan of one student** | drop the new PDF in, `--per-file` | `apply --replace` for that student |

**Duplex scans.** A double-sided scan puts both sides in the PDF, so a
two-sheet exam is 4 pages: `--pages-per-student 4`. Back sides that are blank
still count.

**Fixed length is a guess, not a fact.** A student who asked for an extra sheet
shifts every paper after them by a page. Before applying a fixed split, read the
first page of each range; the first range whose first page is not a cover is
where the drift starts — fix the ranges from there.

## 2. Fill the plan

`_inbox/plan.yaml` is private. One entry per paper:

```yaml
sources:
  - file: midterm-batch-1.pdf
    page_count: 61
    papers:
      - pages: 1
        skip: question sheet          # a page that is nobody's: its own entry
      - pages: 2-5
        number: "220103456"           # as written on the cover, in quotes
        variant: A                    # as printed on the cover
      - pages: 6-9
        name: <as written>            # when there is no number
        variant: B
        rotate: { "8": 180 }          # a page scanned upside down
```

Read pages with the Read tool on the PDF (`pages: "1-5"`; at most 20 a call).
For a large batch read the likely covers first, not every page.

- **Who.** Prefer the student number: it resolves exactly. A name is matched
  against the enrolled students with case, punctuation and word order ignored,
  and must match exactly one. If you cannot read either, leave both out and
  write a `note` — `apply` will hold that paper and say why. **Never** guess a
  student, and never look names up in the roster yourself to "help" a match.
- **Variant.** Read it off the cover. If the cover does not say, compare the
  first question with each variant's items and write a `note` saying you did —
  and tell the professor, because a wrong variant grades a paper against
  someone else's questions.
- **Every page, exactly once.** Blank sheets, a question sheet, a seating list:
  each is an entry with `skip:`. `apply` refuses a file whose pages do not add
  up, rather than splitting it by a wrong range.

## 3. Apply

```bash
bin/ainar scans apply CSS-4008-2026-FALL --assessment ASSESSMENT-MIDTERM --dry-run
bin/ainar scans apply CSS-4008-2026-FALL --assessment ASSESSMENT-MIDTERM
```

For each paper that resolves: `<STUDENT>/scan.pdf` (its pages, turned where you
said), `scan.json`, a `transcript.yaml` to fill, and a Submission in the course
(`records/submissions.yaml`, pseudonymous, no approval — a paper handed in is a
fact). A batch every page of which is placed moves to `_inbox/done/`.

A paper that does not resolve — nobody matches, two people match, two papers
resolve to one student, a student already has a different scan — stays in the
plan with a `problem:` beside it. Fix what you can from the pages; the rest is
the professor's: tell them which file and which pages, never the name.

## 4. Read the answers

Fill `<STUDENT>/transcript.yaml` for every placed student. It already lists the
questions of that student's variant, in order. For each:

- **Choice items:** `chosen: [b]` — the options marked. Two marked, or one
  crossed out and another circled: write what you see in `note`, put the final
  one in `chosen` if it is clear, and `confidence: low` if it is not.
- **Written items:** `text:` the answer as written — word for word, not
  corrected, not summarised. Formulas in plain LaTeX (`$\delta = 0.05$`). A
  struck-through passage goes in `note`, not in `text`.
- **Nothing written:** `blank: true`. Only when the space is really empty — a
  wrong answer is not a blank.
- **`page`** — the page of `scan.pdf` (1-based) where the answer is, and
  **`confidence`** — `high`, `medium`, or `low` when the handwriting is
  uncertain. Low is not a failure; it is the list the professor looks at first.
- Set `read_by` to the model you are.

Do not grade while reading. Do not skip a question because it looks easy.

```bash
bin/ainar scans record CSS-4008-2026-FALL --assessment ASSESSMENT-MIDTERM
```

A complete transcript becomes ItemResponses marked `approval: draft` — a model
read that handwriting. An incomplete one is held whole and listed with the
questions still unread; an option that is not on the paper, or a question from
another variant, is refused.

## 5. Grade

```bash
bin/ainar score-items CSS-4008-2026-FALL
```

scores the choice items against the key — never score them yourself. A written
question with no rubric criterion yet — always the case for an imported exam —
gets one proposed from the class's answers first: `/import-assessment` §7,
`scans answers`, and the professor's reply. Then the
written items, by `/grade-batch`: criterion by criterion, from the recorded
`raw_response`, checked against the page itself when the transcript was `low`.
Cite the scan by reference, never by copying it:

```yaml
evidence:
  - source_ref: private://submissions/CSS-4008-2026-FALL/ASSESSMENT-MIDTERM/STUDENT-4F2A7Q/scan.pdf
    location: "p.3, question 3"
```

(the `ref` on the student's submission is that path.)

## 6. Report

- papers placed, and papers waiting — by file and pages, with the problem;
- enrolled students with no scan;
- answers read with low confidence (`scans record` lists them), and any
  variant you inferred rather than read;
- what `score-items` found (difficulty, a shared wrong answer);
- then `/grade-batch`'s report for the written items.

Hand over plainly: the item responses are `approval: draft`, the evaluations
`status: suggested`; `bin/ainar drafts CSS-4008-2026-FALL` lists them.

## Rules

- **Scans, page images and transcripts stay in the private folder.** Nothing
  from them is copied into `courses/` except what `scans` itself writes.
- **Never guess an identity or a variant.** A paper held is a paper the
  professor can place in a minute; a paper placed under the wrong student is a
  grade on someone else's record.
- **A transcript is what is on the page,** not what the student meant.
- **Never name a student** in a file under the workspace or in your report.
