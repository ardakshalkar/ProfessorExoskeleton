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

The opposite failure is quieter: **motivation with no definition at all.** The
problem is built, the name arrives, and the deck moves straight on to the
architecture without ever saying in one sentence what the thing *is*. Week 8's
MCP deck did this — six slides of M × N, the name in the title and the
outcome, and "Model Context Protocol, an open standard for connecting AI
applications to tools and data" nowhere. Two rules close it:

- **The slide that names the concept defines it** — one plain sentence: an
  acronym spelled out, the kind of thing it is, what it connects or does.
  Where it came from (who published it, when) belongs here too when it is
  part of what the concept is.
- **A term the title or the agenda uses before that slide gets a gloss
  there** — a few words, not the definition. The room reads the title first,
  and a student who does not know the acronym should not wait six slides to
  find out what the lecture is about.

## Every concept gets an instance, not only a definition

The two rules above can be met by a deck with no example in it at all, and the
week 8 deck was: MCP defined, a skill defined, a plugin defined, each in one
good sentence — and not one real skill shown, not one plugin named, not one
call to a server people actually use. The rebuild that added the three
definitions paid for them by cutting slides, and what it cut was the room an
example needed. A definition with no instance is a word to memorise; a room
that has seen the thing can reconstruct the definition from it.

So the outline carries, for every concept the module claims, the example that
will teach it:

```yaml
examples:
  - concept: CONCEPT-REUSABLE-SKILLS
    instance: this course's own /prepare-lesson skill — its SKILL.md frontmatter
      and first steps, shown as it is
    depiction: the folder it lives in, drawn, with the description highlighted
    non_example: a single tool call that looks up a grade — one action, no procedure
```

`instance` is the concrete thing, shown before the name (`concreteness fading`:
start concrete, fade to a drawing, then to the definition — Fyfe, McNeil, Son
and Goldstone, *Educational Psychology Review* 26, 2014). `depiction` is the
intermediate picture, often the slide's figure. `non_example` is the nearest
thing that is *not* it, which is what makes the boundary of a definition
visible. A concept with no `instance` in the outline is not planned yet.

**Prefer instances the course already owns.** A generator avoids naming real
products because it cannot vouch for their current details, and the result is
abstraction. A course workspace is full of real, citable instances that need no
such caution: its own skills (`.claude/skills/`, the plugin's `skills/`), its own
MCP server and the JSON it returns, its own harness as a plugin, its own data
files, last week's homework. Show those, as they are. An external product is
fine when its documentation was read this session and is cited on the slide.

`examples` is read by you and the professor, not by the check — nothing in
`ainar deck check` enforces it, so the discipline is yours.

## Timing, honestly

The minutes on the outline are what makes it checkable against a real session,
and they are the field most often filled in to satisfy the check rather than to
describe the lecture. Two rules keep them honest:

- **A concept is five to eight minutes, spread over several slides** — the
  instance, the definition, a contrast or build, a check — not one slide held
  for five minutes. Real decks run a little over a minute a slide (`real-decks.md`);
  a plan that gives a concept one slide has left no room for its example.
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
than skimming eight. Come back with the order they introduce things in, the
analogy they reach for, the misconception they spend time on — that last one is
the expensive knowledge — and, unless the professor has said not to, the
material itself where it is good: an explanation, a worked example, an exercise,
a figure.

What you take is raw material for **this** arc, not a deck to transplant. The
order it appears in, the beats around it, the identifiers and the notation are
this course's. Their sequence is evidence about the subject, not authority over
the session, so a copied example goes where this arc needs it, not where their
lecture had it. Credit every piece you take with its URL and licence in the
report, and on the slide itself where it is used verbatim.
