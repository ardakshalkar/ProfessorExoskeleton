# How an outline earns its sequence

Reference material for `/outline-presentation`. The skill says to write the arc
before the slides; this is why, and what a good one looks like.

The arc is one layer of the plan, not the whole of it. Underneath it sit the
beats (`teaching-beats.md`), and underneath those the per-slide grammar
(`visual-grammar.md`). The arc is what the session *argues*; the beats are how
that argument is built.

## The failure this exists to prevent

Ask for a lecture on model evaluation and you get, reliably, eight slides:
*What is evaluation · Accuracy · Precision and recall · F1 · The confusion
matrix · Cross-validation · Overfitting · Summary*. Every slide is correct. The
deck is useless, and it is useless in a way that is hard to see, because nothing
in it is wrong.

What it is missing is a **claim**. There is no sentence the lecture is trying to
make true in the room, so there is nothing for the order to serve, so the order
is the order of a textbook's index. Students take notes and learn a vocabulary.

An outline with an arc has an answer to *why this slide, after that one*. That
answer is the only thing standing between a deck and a list of topics, and it is
much easier to fix at the outline stage than after twenty-four slides are
written.

## The four fields

```yaml
arc:
  starts_from: what they can already do, from the previous module
  argues: the one claim this session makes true
  turn: the moment the obvious answer stops working
  leaves_them_able_to: what they can do at the end that they could not at the start
```

**`starts_from`** is read off the previous module, not off hope. If the previous
module taught train-test separation, that is where this one starts. A session
that starts from something the course has not taught is a session that loses
half the room in the first ten minutes, and the prerequisite list in
`pres context` is exactly the material for getting this right.

**`argues`** is one sentence, and it is a claim rather than a topic. Not "model
evaluation"; *"a high score on data you tuned against is not evidence of
anything."* If you cannot write this sentence, the session does not yet have a
point, and the honest move is to say so rather than to produce slides.

**`turn`** is where the session earns its length. Something the students
currently believe stops working. It is almost always the same place the
misconception lives, which is why the misconception is worth finding before
writing anything.

**`leaves_them_able_to`** is a capability, not a feeling. "Can say which of two
reported accuracies is trustworthy and why" — something a check-for-understanding
slide can actually check.

## Ordering: three shapes that work

**Problem first.** Open with a case where the obvious approach fails, then build
the machinery that fixes it. Strongest when the misconception is common, because
the students supply the wrong answer themselves and the correction lands on
their own reasoning rather than on a slide.

**Chronological build.** Each concept is a prerequisite of the next, and the
order is forced. Safe, and the right choice when the material genuinely is a
chain. Risky when it is not: an arbitrary order presented as a chain reads as
arbitrary.

**Contrast.** Two approaches side by side, then the criterion for choosing. Good
for a session whose point is judgement rather than mechanism.

What does not work is *definitions first*. A definition given before the problem
it solves is a definition with nothing to attach to, and it is the default shape
of every generated deck.

## Timing, honestly

The minutes on the outline are what makes it checkable against a real session,
and they are the field most often filled in to satisfy the check rather than to
describe the lecture. Two rules keep them honest:

- **A concept slide is five to eight minutes, not two.** A deck whose slides
  average three minutes is a deck that will run over, every time.
- **Leave the last ten minutes alone.** Checks for understanding, questions and
  the thing you did not get to. A plan that fills the full hundred minutes has
  planned for a room with no questions in it.

`pres outline check` refuses a plan that overruns by more than ten per cent, and
warns at under seventy — the second is usually a plan whose minutes were never
filled in rather than a session that is genuinely short.

## Coverage, and saying what you left out

The module claims certain concepts. The outline either covers them or records
which it is dropping and why:

```yaml
coverage:
  concepts_omitted:
    - concept: CONCEPT-REGULARIZATION
      why: introduced properly in MODULE-07; named here only as what comes next
```

An omission is often the right call — a hundred minutes does not hold four
concepts. An *unrecorded* omission is indistinguishable from having forgotten,
and the check treats it as an error for that reason.

The reverse is a harder rule and a more important one: **the outline may not add
a concept the module does not claim.** What a course teaches is the professor's
decision, and a deck is not where it gets made. If the session genuinely needs a
concept the module does not have, say which, and stop.

## Where to look before writing

A worked example that has survived a decade of lectures beats one invented this
morning, and the commonest defect in generated material is not error — it is
that the explanation has no idea which step students actually trip on.

Read two or three published treatments of the module's concepts properly rather
than skimming eight, and come back with **insight, not text**: the order they
introduce things in, the analogy they reach for, the misconception they spend
time on. That last one is the expensive knowledge.

Never copy. Not slide text, not problem statements, not figures, not an exercise
with the numbers changed. Material from another institution is evidence about
the subject, not authority over this course, and its licence is theirs. Where a
source shaped what you wrote, say so in the report, with the URL.
