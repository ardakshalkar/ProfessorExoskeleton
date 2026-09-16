# Type on a lecture slide

Why the renderer sets what it sets, and what to change it to if you disagree.

## The constraint that decides everything

**A deck is typeset twice: once on your laptop, once on the machine in the
room.** If a font is missing on the second one, PowerPoint substitutes — and a
substituted font has different metrics, so the text reflows, lines that fitted
now wrap, and the slide you checked is not the slide on the wall. You find out
with a room full of people watching.

So the question is never "which is the nicest typeface". It is **which good
typeface is already installed on both machines**. Everything below follows from
that.

Font embedding exists in PowerPoint but is unreliable across platforms and
inflates the file; it is not something to rely on for a weekly lecture.

## What the renderer uses

| Role | Face | Why |
| --- | --- | --- |
| Titles | **Cambria** | Ships with Windows and with Office for Mac. A serif title against a sans body separates the two levels without needing a second colour or a rule. |
| Body | **Calibri** | Still installed everywhere. Aptos replaced it as the Office default in January 2024, but Aptos substitutes on older installs — exactly the risk a lecture deck cannot take. |
| Code | **Consolas** | Ships with Windows and with Office for Mac. |
| Maths | Cambria | Set as text, centred and larger. See below. |

## Why the code font changed

The renderer used **Courier New**, and it is a poor choice for a projected
slide for three separate reasons:

- **Low x-height and thin strokes.** It was drawn to imitate a typewriter, and
  at the back of a room the thin stems disappear — especially against the light
  panel the renderer draws behind code.
- **A 0.6em advance**, the widest of any common monospace. Every line of code is
  about a tenth wider than it needs to be, so less fits and more wraps.
- **Weak character disambiguation** — the qualities that matter in code, `0`
  against `O` and `1` against `l` against `I`, are not strongly differentiated.

**Consolas** fixes all three: a taller x-height, real stroke weight, a 0.55em
advance, and a slashed zero. It ships with Windows and with Microsoft Office for
Mac, so it is as safe as Courier New in practice while being far better to read.

### If you want something more modern

**Cascadia Mono** is Microsoft's current terminal face — cleaner than Consolas,
with the ligature-free variant being the right one for slides (ligatures turn
`!=` into a glyph students have not met). It ships with Windows Terminal and
Visual Studio, *not* with Windows itself, so a lecture-room PC may not have it.

**JetBrains Mono** and **Fira Code** are excellent and installed nowhere by
default.

Any of them is a one-line change in `node/src/render.ts` (`MONO_FONT`) — but if
you change it, change `CHAR_WIDTH.mono` in `node/src/deck.ts` to match, or the
height estimator will mis-measure every code block. Consolas is 0.55em; the
value used is 0.57, deliberately a little conservative.

## The estimator, and why the widths matter

The renderer flows blocks down the slide, which means it has to know how tall
each one will be *before* PowerPoint sets it. It estimates from the character
count, the point size and a per-font character width.

That estimate decides where the **next** block goes. So an under-estimate does
not produce a slightly-wrong gap — it prints the next block on top of this one.
The widths in `CHAR_WIDTH` are therefore set a few per cent above the true
advance: over-estimating costs a warning nobody needed, under-estimating costs a
broken slide.

The figures were calibrated against a real render: 5.4″ of 18pt Courier New
holds exactly 35 characters, and 11.93″ of 17pt Calibri holds about 121.

## Mathematics

There is no TeX in this plugin. `\(…\)`, `\[…\]` and `$…$` are converted to
Unicode — `P(x_t \mid x_1,\ldots,x_{t-1})` becomes `P(xₜ | x₁,…,xₜ₋₁)` — and set
centred in the title face, larger than body copy.

This covers what actually appears on a lecture slide: conditional probabilities,
cost formulas, sums, ratios, Greek. It does **not** cover stacked fractions,
matrices, integrals with limits above and below, or aligned environments.

Where a command has no text equivalent, `pres check` **refuses the deck** and
names the command. That is deliberate and it is an error rather than a warning:
a formula is read as authoritative, nobody proofreads the projector, and a
half-converted formula is worse than an absent one. The two honest ways out are
to write the expression in a form Unicode can set, or to draw it as a figure and
link it like any other picture.

## The title slide

It is the one slide with no content to flow, so it is composed rather than
flowed. The convention for an identity card is settled, and three tiers is the
whole of it:

| Tier | What | Set as |
| --- | --- | --- |
| kicker | course, unit, week | 14pt sans, bold, letterspaced, dimmed |
| title | the session | 46pt serif, bold, white — it must dominate |
| — | a short rule | 2.4in, the one accent colour in the deck |
| body | one sentence: what the session leaves them able to do | 18pt sans, light |

Three points behind that shape:

- **The title dominates by size, weight *and* contrast**, not size alone. Set
  three lines at the same weight and colour and the audience has to read all
  three to find out which one matters.
- **The identity line goes above the title**, not below it. That is where a
  reader looks for context, and it lets the title be the largest thing on the
  slide without a competing line underneath.
- **The block sits above centre**, on the upper third rather than dead middle:
  the optical centre of a block is above its geometric one, so centring it
  exactly reads as slightly low.

What the renderer takes from the markdown: the `#` heading is the title, the
**first** paragraph is the kicker, and the rest is the body. So write the course
line first and the objective second.

A title slide carrying more than that is warned about. A title, an identity
line and one sentence is the whole job; anything else belongs on the slide
after it.

### A picture and a mark

Both optional, both named in the plan, both files beside the deck:

```yaml
title_slide:
  image: MODULE-06-title.jpg
  image_alt: An empty lecture theatre seen from the back row.
  logo: sdu-logo.png
  logo_alt: SDU University logo.
```

The image bleeds down the right of the slide, cover-cropped so it never
distorts, and the text column narrows to suit — the title drops from 56pt to
48pt and still dominates. The logo sits bottom left at half an inch tall, sized
by height so a wide mark and a square one both look deliberate.

**Neither is ever searched for or invented by the skill.** A decorative title
image is fine — it is the one place the figure rules allow a picture that
carries no information — and `pres find-image` will find you an openly-licensed
one, with its attribution enforced on the title slide exactly as anywhere else.

A **logo is different and the rule is stricter**: an institutional or commercial
mark is a trademark question rather than a licence one, and this plugin answers
neither. It will place a mark you point it at, from a file you supply. It will
not go and find your university's logo, because whether you may put it on a deck
is not a question a search result can answer.

## Sizes, for reference

| | Size | |
| --- | --- | --- |
| Title slide heading | 46pt | on the dark ground |
| Slide title | 34pt | with a rule under it |
| Sub-heading | 21pt | in the primary colour, tighter to the text below it |
| Body | 17pt | |
| Display maths | 24pt | centred |
| Code | 18pt | on a light panel |
| Table | 15pt | header row bold |
| Question / big idea | 30pt | the archetype layouts, set large with whitespace |
| Figure credit | 10pt | muted |

## Sources

- [9 PowerPoint fonts that work in ALL versions of PowerPoint — Nuts & Bolts](https://nutsandboltsspeedtraining.com/tutorials/safe-fonts-powerpoint)
- [New font in Microsoft 365: goodbye Calibri, hello Aptos](https://www.empowersuite.com/en/blog/aptos-font-in-microsoft-365)
- [Aptos vs Calibri: Microsoft's New Default Font Compared](https://madegooddesigns.com/aptos-vs-calibri/)
- [13 Best Fonts for Coding](https://snappify.com/blog/best-fonts-for-coding)
- [25 Best Coding Fonts for Developers in 2026](https://lexingtonthemes.com/blog/best-coding-fonts-2026)
- [Title Slide PowerPoint: Design, Layout, and Best Practices — Deckary](https://deckary.com/blog/title-slide-powerpoint)
- [PowerPoint Title Slide Examples — SlideModel](https://slidemodel.com/powerpoint-title-slide-examples/)
- [Lecture Presentation Slides — Sheridan Center, Brown University](https://sheridan.brown.edu/resources/classroom-practices/lecture-presentation-slides)
- [Slide Layout, and the rule of thirds — Lumen Learning](https://courses.lumenlearning.com/wm-publicspeaking/chapter/slide-layout/)
