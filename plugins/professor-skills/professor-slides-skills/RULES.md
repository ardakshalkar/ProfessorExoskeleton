# The rules, and why each one exists

Every skill in this plugin repeats these in short form. Here is the reasoning,
because a rule whose purpose is understood survives contact with an unusual case
and a rule that is merely memorised does not.

These are not style preferences. Each one closes a way this tooling could put a
wrong claim, an unlawful picture, or a real person's name in front of a class.

## Claims come from the professor; artefacts may be drafted

The line is not "never generate anything". It is **who gets to decide what the
course claims**.

A **claim** is a statement about what students must learn or how they are
judged: learning outcomes, concepts and their prerequisites, the order they are
taught in, what an assessment measures. These come from the professor's material
only. If something is missing, write `TODO` and say what is missing.

A plausible-sounding invented learning outcome is worse than a blank one,
because it will end up on a slide, in front of a class, attached to real
teaching, and nobody will remember it was guessed.

An **artefact** — a slide, a diagram, a worked example, a table — serves claims
the course already makes. Those are draftable, and drafting them is the whole
point of this plugin.

The line runs through the middle of an outline, which is why `pres outline
check` refuses a slide covering a concept the module does not claim. It is not
a formatting check. It is the boundary.

## Approval is a fact in a file, and only a professor puts it there

There is no approval CLI here. The record is an outline's `status`, and it moves
to `approved` only when the professor says so — by editing the file, or by
telling an agent to in the current request, in which case `approved_by` and
`approved_at` record who and when.

Never on an agent's own initiative. Never because the outline reads as finished.
Never carried over from an earlier conversation. And an outline edited after
approval is an outline whose approval was for a different session — re-check it.

**Whether that record is a gate depends on the deck**, and the deck's own
generated plan says which. `deep` mode, and anything built with
`--approval required`, will not render until the outline is `approved`. `fast`
and `standard` will, because in those modes the professor asked for slides and
that request *is* the agreement. A plan naming no mode at all requires approval,
which is every deck built before modes existed.

The gate used to be universal, and universal was wrong in one direction only. It
is exactly right for a deck somebody asked to review before it was written. For
"make five slides explaining RAG" it is obstruction — and a professor made to
approve an outline they never asked for learns to type `status: approved` without
reading it, which costs the gate everything it was for. A safety mechanism people
route around has been removed, slowly.

What is not negotiable is **saying which of those happened**. `pres check` and
`pres render` print the deck's mode and whether an approval stands behind it, and
a skill handing over a file repeats it. That refusal, and that sentence, both
exist because a `.pptx` looks identical whether or not anybody agreed to what is
inside it.

## The plan is generated, so nothing has two homes

`<deck>.plan.yaml` is written by `pres plan build` and by nothing else. Every
field in it — slide numbers, titles, minutes, purposes, archetypes, densities,
text roles, required visuals, the figure list — was already stated in the outline
or in the deck markdown, and a copy is a second thing to keep true.

The rule underneath: **judgement is the model's, bookkeeping is the code's.** An
agent choosing an archetype is doing the work this plugin exists for. An agent
retyping that archetype into a second file is doing work a program does without
making a mistake at slide fourteen.

So a fact has exactly one home. The session's shape is the outline's. What is on
a slide is the markdown's. The plan is a projection of both, and the only thing
it holds that neither source does is a figure's licence metadata — preserved
across regeneration, because `pres find-image` wrote it and nothing else knows
it. A hand-edited plan is a plan that will be overwritten, and `pres check`
reports one that has fallen behind rather than letting a stale contract pass.

## The source says where it came from

Three places hold a course, and a fallback is an excellent way to hide a
failure. A database link that is merely unreachable, silently followed by a
course directory last pulled in March, produces a deck built from March's
outcomes that is indistinguishable from a correct one.

So every attempt that did not answer is recorded, and every report says which
source produced the course. If the connection was made without verifying the
server's certificate, that is said too.

## Markdown is the source; the deck is a rendering of it

Markdown diffs. A professor can see in a diff that the slide claiming three
questions now claims four. A `.pptx` cannot be reviewed that way, so it is never
the source and never re-enters the working directory — it goes to gitignored
`output/`.

The same rule reaches pictures: **what you commit is the thing that generates
the picture**, never only the picture. An SVG, a manim scene, a table in
markdown. The PNG is a render.

And the plan is a contract, not a suggestion. When it stops matching the deck,
one of the two was edited after the other, and which is wrong is the
professor's question. Nothing here reorders slides to make them agree.

## The teaching decides the shape, not a layout rota

The failure this plugin is built against is not an ugly deck. It is *title and
three bullets, fifteen times* — a deck where every slide is individually
defensible and the cognitive operation never changed while the material did.

The fix is not a rule against repeating a layout; that rule is actively harmful,
because repeating a shape is exactly right while the learner's task is the same.
The fix is to name the task separately from the representation, so that the
variation follows from the teaching:

> Not "make slide 4 look different." **"Slide 4 has a different pedagogical
> job."**

Which is why planning runs deck grammar → teaching beat → slide intent → visual
archetype, and why a beat has to say what is true for the learner when it ends.
A beat with no `exit_understanding` cannot tell whether its slides are the right
ones, and neither can anybody reading it.

## Some slides are supposed to look empty

Three cases where a generator's instinct is exactly wrong, and where the check
therefore refuses rather than suggests:

- **A question slide.** The whitespace and the missing answer are the
  instructional function. An `explanation` or `takeaway` role there is an
  error — the only grammar violation in the plugin that is.
- **A photograph.** Text beside evidence directs attention; it does not
  describe what the room can already see. Three sentences saying what three
  maps depict is three sentences of duplicated slide.
- **A slide that needs the professor.** `delivery_dependency: high` says the
  interpretation is spoken, which is normal university teaching. Filling it in
  is not a favour.

And one that is wrong in the other direction: **text-only slides are
legitimate**. The rule is never *every slide needs an image*, it is *every
slide needs an information carrier*, and sometimes the carrier is prose. A long
primary source being analysed is not a wall of text; a long generated
explanation is.

## A picture is read as evidence even when the sentence beside it hedges

Which is why the five kinds of graphic are told apart by where their authority
comes from, and why three of them are refusals waiting to happen:

- **No chart of class data that no command produced.** This plugin does not read
  student records, deliberately, so there is no such command and there is no
  such chart. The slide says what it needs to say in words. A hand-plotted bar
  chart of marks somebody totalled is the worst artefact in the set, because a
  chart is not audited.
- **No chart of external data without a citable source.** "Do not invent
  sources" does not relax because the invention is a shape rather than a
  sentence.
- **No generated image where a reader will take it for data.** No invented
  screenshots of results, no plausible plots as background. A generated
  illustration is captioned as generated, at render time, automatically.

## Attribution is enforced, not remembered

A found image carries its licence, its source URL and the exact line that must
appear under it. A figure claiming a source without that line stops the render.

This is not pedantry about credit. It is that the alternative failure is silent:
the deck builds, the lecture happens, and the licence was never satisfied.

Check what `by-sa` costs before choosing it — share-alike reaches the
adaptation, and a slide that annotates one may have to carry the same licence.

## Accessibility is not a later pass

Alt text on every figure, and it is not a caption of the filename: it says what
the picture asserts. It is what a screen reader gets, what a student reading on
a phone gets, and what survives when the SVG is lost. `pres check` refuses an
empty one.

Colour is never the only channel. A red/green distinction is invisible to part
of every cohort and to every projector with a tired lamp.

## Two things a slide must never contain

An **answer key or correct-option marker** for an item still in use. A slide
that names the item a misconception came from is fine and is good teaching; a
slide that shows the key is not, and a picture is where it will be missed,
because nobody greps a PNG.

And **no student name, email or institutional number** — in the text, in a
picture, in the alt text, in a filename, or in an axis label. Write the
identifier.

## Say what was generated, and what was assumed

`generated_by` is not optional. A professor presenting these slides should be
able to see they were drafted by an agent, with which model, from which inputs.

The same honesty applies to gaps. No network, so no survey of how the topic is
taught elsewhere. No prerequisites recorded, so the opening slide is an
assumption. No LibreOffice, so the PDF is a second rendering rather than a
picture of the deck. Each of those is a fact about the artefact, and each
belongs in the hand-over rather than in the professor's eventual surprise.
