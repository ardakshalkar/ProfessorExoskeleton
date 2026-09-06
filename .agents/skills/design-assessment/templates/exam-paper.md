<!--
  STUDENTS SIT THIS PAPER.

  The paper carries questions and marks. It does not carry answers. No
  `answer_key`, no marked correct option, no `marking_guidance`, no
  `indicates_misconception_of` or its note — those live on the items in the model
  and reach the marker through `ainar score-items` and the rubric, never through
  this file.

  Marks per question come from the criteria. The paper's own weight in the course
  is a claim: recorded, or TODO and a question for the professor.

  Fill every {{ slot }}. Delete this comment.
-->

# {{ COURSE_ID }} {{ course title }} — {{ paper title }}

**{{ term }} · {{ YYYY-MM-DD }} · {{ duration }} minutes ·
{{ total }} marks**

## Instructions

- Answer {{ which questions — all, or n of m }}.
- {{ Permitted materials, as the course records them. If nothing is recorded,
  write TODO and ask; an exam's rules are not a detail to improvise. }}
- Write your {{ student number }} on every sheet. {{ Never a name. }}

---

## Section A — {{ section title }} ({{ n }} marks)

<!-- One block per question. `{{ ITEM-ID }}` keeps the paper and the model
     connected, which is what lets `ainar score-items` report on it afterwards.
     Choice options are listed in a fixed order and NOTHING marks the right one. -->

**A1.** ({{ n }} marks) {{ the question }}

- A. {{ option }}
- B. {{ option }}
- C. {{ option }}
- D. {{ option }}

`{{ ITEM-ID }}`

**A2.** ({{ n }} marks) {{ the question }}

`{{ ITEM-ID }}`

---

## Section B — {{ section title }} ({{ n }} marks)

**B1.** ({{ n }} marks) {{ the question }}

{{ If the question expects work to be shown, say so here in what the student is
asked to produce — not in a note about how it will be marked. }}

`{{ ITEM-ID }}`

---

## Section C — {{ section title }} ({{ n }} marks)

**C1.** ({{ n }} marks) {{ the question }}

`{{ ITEM-ID }}`

---

*Total {{ total }} marks. Drafted from {{ ASSESSMENT-ID }} on {{ YYYY-MM-DD }};
not in force until the professor approves it.*
