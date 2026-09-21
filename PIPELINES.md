# What happens when you ask for something

In plain terms: what the system does between your sentence and the thing you
wanted. One page, no schemas.

[`GENERATION.md`](GENERATION.md) is the same story told to a programmer, with
the file paths and the places a stage is missing. This one is for reading once.

---

## The shape every request has

```
  you ask  ->  it drafts  ->  YOU DECIDE  ->  it publishes
```

Four beats, every time, for a quiz or a deck or a term plan. The third beat is a
person and cannot be skipped. Everything else is the machine doing legwork.

**Where things sit while that happens:**

| Place | What it means |
| --- | --- |
| `work/<RUN>/` | proposals. Nobody has agreed to any of it. Ids carry `-DRAFT-` |
| `courses/<COURSE>/` | the record. This is the course. You put things here |
| `dist/` and `output/` | files built out of the record — a page, a deck, a paper. Throwaway, rebuildable |

A proposal becomes a record in exactly two ways, and both are you:

- **`ainar approve`** — promotes anything, including a grade. You run it.
- **Publish** (the button, the `/publish` skill, or `ainar publish`) — promotes
  only the **materials** the publication needs (decks, handouts, briefs), then
  publishes. Never a grade.

---

## Make a quiz or an exam

```
  "make a quiz on weeks 1-3"
        |
        v
  blueprint          what SHOULD this cover, before anyone writes a question
        |            (which outcomes are under-assessed, which concepts are due)
        v
  it drafts          the quiz, its questions, the marking key, the rubric,
        |            and the brief students read  ->  work/<RUN>/
        v
  it checks          validate: every question serves a criterion, options add up,
        |            no question with two right answers
        v
  YOU READ IT        the coverage table, what it did NOT assess, what is missing
        |
        v
  YOU APPROVE        bin/ainar approve work/<RUN> --as USER-…
        |            (or press Publish, which promotes the brief for you)
        v
  print it           exam-paper -> the question paper, WITHOUT the answers
        |            render-exam -> .docx and .pdf beside the course
        v
  hand it out        on paper, or as a Canvas assignment, or on the course page
```

Two things worth knowing: the answer key is **dropped** when the paper is built,
not hidden — it is not in the file at all. And the quiz can be printed once from
the record but not yet regenerated in five variants; that is a known gap.

## Make slides or a handout

```
  "slides for week 7"
        |
        v
  it reads           the module, its concepts, what the outcomes claim
        |
        v
  it writes          markdown slides + a plan of what each slide is  ->  work/<RUN>/
        |
        v
  deck fit           will each slide actually fit on the page?
        |
        v
  YOU READ IT        and edit the markdown, it is yours
        |
        v
  YOU APPROVE        approve, or press Publish
        |
        v
  render             .pptx, and a .pdf of that same deck
        |
        v
  it appears         on the course page, and as a chip in the pane
```

The renderer refuses a deck whose slides disagree with its plan, rather than
quietly reordering one to match the other.

## Plan the term

```
  "plan the semester"  ->  it reads the concepts  ->  drafts weeks, meetings,
  dates, rooms, and shells for the midterms and final  ->  you correct it
  ->  you approve  ->  the calendar is the course
```

Before this there is usually **"read my syllabus"**, which proposes the concept
map — what the course teaches and what has to come before what.

## Grade a batch

```
  90 submissions
        |
        v
  score              multiple choice and anything with a recorded answer:
        |            scored by comparison, no model involved, no guessing
        v
  suggest            everything else: a suggested score per criterion, with the
        |            quoted evidence and how confident it is  ->  work/<RUN>/
        v
  it tells you       which few to look at first — low confidence, odd scores,
        |            unreadable files — and what the class got wrong together
        v
  YOU DECIDE         every score. Change one by writing your own beside it
        |
        v
  YOU APPROVE        approve  — this is the one that can never be a button
        |
        v
  evidence           the approved marks become evidence, evidence becomes
                     "what this student can do", which feeds the next question
```

**Nothing in any screen can approve a grade.** Not the pane, not a skill, not
publishing. That is the single rule the whole design is built around.

## See how it is going

```
  "how is the class doing"   ->  dashboard   ->  marks, by pseudonym, private
  "where are they stuck"     ->  find gaps   ->  concepts with weak evidence,
                                                 and a guess at why
  "how is Aisha doing"       ->  report      ->  written from recorded evidence
                                                 only, saved outside the repo
  "what needs me"            ->  inbox       ->  grades waiting, work with no
                                                 deadline, weeks with no deck
```

These read; they do not change the course. The private ones stay private: the
students' page and the marks dashboard are deliberate opposites and the tests
check that no figure from one can reach the other.

## Publish something students see

```
  press Publish (or ask in chat, or run `ainar publish`)
        |
        v
  FIRST PRESS        a plan. Writes nothing, anywhere. It says:
        |              - which drafted materials it would promote
        |              - what it would then publish
        |              - what it would hold back, and why
        v
  YOU READ IT
        |
        v
  SECOND PRESS       promotes those materials into the course record,
                     then publishes
```

Four things it can publish:

| | what reaches whom |
| --- | --- |
| **Course page** | the week plan and the approved materials, as a static site to host |
| **Telegram** | one plain-text announcement to the class channel. It cannot be recalled |
| **Homework repo** | the starter repository on GitHub, public so students can fork it |
| **Canvas brief** | an assessment's title, points, dates and brief. Never the marks |

Before anything is copied to a public page it is scanned for answers, and a file
that carries one is refused. There is no flag to turn that off.

**It remembers where things went.** The second time you publish something, the
plan does not pretend to be the first:

```
Last published 2026-09-19T14:02:00+05:00 to dist/pages/CSS-4008-2026-FALL.
  1 thing(s) have changed since:
    DOC-4410 changed since then — Model evaluation and overfitting — slides
```

So *publish* and *update* stop being the same word. That memory lives outside
the course, in `~/.ainar/sync/`, beside the one that already remembers what was
sent to the gradebook — it is what **this machine** sent, not a fact about the
course, so it does not belong in the files you commit.

## Fix a typo and publish again

You do not need a new id, a new version number, or any of the machinery. Open
the file where it lives, fix the word, save, and press Publish again.

```
  you edit week-07-slides.md
        |
        v
  the plan says       "DOC-4410 changed since it was recorded"
        |             and, if a PDF was rendered from it:
        |             "DOC-4499 was rendered from it — held back"
        v
  you press publish   the record is brought up to date with the file,
                      and version 1 becomes version 2
```

Two things it will not do, both on purpose:

- **It will not publish a PDF made from the old text.** If you changed the
  slides but have not rebuilt the PDF, the PDF is held back and the page goes
  out without it. Rebuild it and publish again, and both go.
- **It will not quietly forget.** Until you rebuild that PDF, every publication
  keeps telling you. The change to the slides is not written into the record
  either, because recording it would make the old PDF look current.

The old version of the file is not lost — materials live in git, so `git show`
has it. What the record gains is a version number that says how many times you
have changed this.

## Announce something

```
  "tell them homework 3 is open"
        |
        v
  it drafts the exact words, from the record: title, deadline, weight
        |
        v
  you read the message as students will read it
        |
        v
  you say "send it"  ->  it goes to the channel  ->  and it is gone, permanently
```

It refuses to send a message containing an answer, or naming a student.

---

## The two decisions that are always yours

1. **A judgement about a person** — a grade, a concept someone has or has not
   understood, an intervention. `ainar approve`, run by you, and nothing else.
2. **Something a student will see** — the page, the announcement, the
   repository, the Canvas brief. The second press, after reading the plan.

Everything else the system will do for you.

## What it will never do on its own

- approve its own suggestion;
- publish a draft as though it were finished;
- invent a deadline, a weight or an outcome — it writes `TODO` and says so;
- put a student's name in a file, or in anything students read;
- push a grade into Canvas or a spreadsheet;
- recompute by hand something a command already computes exactly.

## Where to read more

- [`README.md`](README.md) — what exists, what does not, and the commands.
- [`GENERATION.md`](GENERATION.md) — the same pipelines with the code paths, and
  where each one is still missing a stage.
- [`plugins/dsh-professor-pane/README.md`](plugins/dsh-professor-pane/README.md)
  — the pane: what every button draws, and which of its routes can write.
