# Pictures on slides

Reference material for `/build-presentation`. Adapted from the same file in
ProfessorHarness; the rules are unchanged, the mechanics point at `pres` and at
the deck's plan file instead of at a course repository.

## The constraint everything else follows from

Markdown is the source of truth because it diffs — a professor can see that the
slide claiming three questions now claims four. A picture is a binary and does
not diff, so every graphic here is either **text that becomes a picture** (an
SVG, a manim scene, a chart spec) or it is **not the source** (a PNG rasterized
at render time, a `.pptx`).

The rule that follows: *what you commit is the thing that generates the picture,
never only the picture.*

## Five kinds of graphic, told apart by where their authority comes from

The failure mode is specific: **a picture is read as evidence even when the
sentence next to it hedges.**

| Kind | Example | Where it comes from |
| --- | --- | --- |
| **Diagram** | an annotated train/validation/test split; a prerequisite chain; a pipeline | you draw it, from structure the course already claims |
| **Chart of course data** | this class's success rate per concept | a command, unchanged — and this plugin has none |
| **Chart of external data** | a published benchmark, a dataset's class balance | the source material the professor gave you, cited on the slide |
| **Animation** | gradient descent stepping downhill | a manim scene you write |
| **Decorative** | a photograph, a title-slide image | anywhere, and it carries no information |

Three of those rows are refusals waiting to happen:

- **A chart of course data you computed yourself is a hand-totalled gradebook in
  the medium least likely to be questioned.** This plugin reads a course's
  design, not its student records — deliberately — so there is no command that
  produces such a chart. Which means the slide says so in words and carries no
  chart. Not an estimate, not an illustrative example with plausible bars.
- **A chart of external data with no citable source does not get drawn.** "Do
  not invent sources" does not relax because the invention is a shape rather
  than a sentence. A plausible accuracy curve with no data behind it is the
  single most quotable thing you can put in front of a class.
- **A generated decorative image must not sit where a reader will take it for
  data.** No invented screenshots of results, no fake plots as background, no
  diagram of a system the course has not described. Its alt text says it is
  illustrative.

And one that is not about truth but about the room: **colour is never the only
channel.** A red/green distinction is invisible to part of every cohort and to
every projector with a tired lamp. Label the lines, vary the dash, name the
regions.

## Where the files live

Figures live **flat beside the deck**, named after it, linked as siblings:

```text
work/CSS-4008-2026-FALL/presentations/
  MODULE-06-slides.md
  MODULE-06-slides.outline.yaml
  MODULE-06-slides.plan.yaml
  MODULE-06-slides-fig-01-split.svg
  MODULE-06-slides-fig-02-gap.svg
  MODULE-06-slides-fig-03-descent.py     # a manim scene, not its video
```

```markdown
![Training data, validation data and a held-out test set never touched during
tuning](MODULE-06-slides-fig-01-split.svg)
```

A sibling-relative link survives being moved anywhere as a set. A `figures/`
prefix does not survive being flattened, and it breaks silently, in a deck
nobody opens until the lecture. `pres check` refuses a link with a slash in it
for that reason.

The alt text is not optional and is not a caption of the filename. It says what
the picture *asserts*, because it is what a screen reader gets, what a student
reading the markdown on a phone gets, and what you will thank yourself for when
the SVG is lost. `pres check` refuses an empty one.

## Registering a figure

Every figure gets an entry in the deck's plan file. A figure you drew needs only
its title and alt text; a figure you did not draw needs the record that makes it
lawful to show.

```yaml
figures:
  MODULE-06-slides-fig-01-split.svg:
    title: Train, validation and test split
    alt: Training data, validation data and a held-out test set never touched during tuning
```

## Images you did not draw

Two ways to get a picture you did not author, and they fail differently.

### Searching for one

```bash
pres find-image --search "confusion matrix"
```

Searches Openverse — Creative Commons and public-domain works across Wikimedia,
Flickr and others — and prints, for each result, **what the licence actually
lets a lecture do**. The default filter is commercial-and-modification use,
because a university lecture is a commercial context under most readings and a
slide crops and annotates. `--any-licence` widens it and labels what you get; a
NoDerivatives image is refused at download rather than warned about, because a
slide always crops it.

```bash
pres find-image --search "confusion matrix" --pick 2 \
    --into work/CSS-4008-2026-FALL/presentations \
    --name MODULE-06-slides-fig-02-matrix
```

The file lands beside the deck and the tool prints the plan entry that carries
its origin:

```yaml
figures:
  MODULE-06-slides-fig-02-matrix.jpg:
    title: Confusion matrix
    alt: "TODO — say what a student who cannot see it would need to know"
    image_source:
      provider: openverse
      source_url: https://commons.wikimedia.org/w/index.php?curid=100443030
      license: CC-BY-SA-4.0
      attribution: '"Confusion matrix" by Pirehelokan is licensed under CC BY-SA 4.0.'
```

**Attribution is enforced, not remembered.** `pres render` prints that line under
the picture, and refuses to build the deck at all if a figure claims a source
without one. The failure it exists to prevent is the silent kind: the deck
builds, the lecture happens, and the licence was never satisfied.

Note what `by-sa` costs before choosing it — share-alike reaches the adaptation,
so a slide that annotates one may have to carry the same licence. `cc0` and
`pdm` results have no such condition and are usually the better pick for
teaching material a faculty may want to reuse.

### Prompting for one

There is no image generator wired into this plugin, and that is not the gap it
looks like: the prompt is language work, so writing it is the agent's job and
running it is the professor's, with whatever tool they have. What the plugin
holds is the record.

A usable prompt for a slide is *specific about the thing, silent about the
truth*. Describe subject, framing, palette and what must not appear; never ask
for numbers, axes, labelled data, screenshots of results, or anything a reader
could mistake for a measurement:

> A wide, uncluttered photograph of an empty university lecture theatre seen
> from the back row, morning light, muted slate and pale blue tones, no people,
> no text, no charts or diagrams anywhere in frame. Leave the right third plain
> for overlaid text.

The negative half is the load-bearing half. An image model asked for "a machine
learning results dashboard" will produce plausible axes and invented numbers,
and a student cannot tell that from a real result at ten metres.

Record it on the figure:

```yaml
figures:
  MODULE-06-slides-fig-04-theatre.png:
    title: An empty lecture theatre
    alt: An empty lecture theatre seen from the back row. Illustrative; not a measurement.
    image_prompt:
      model: <the model the professor ran>
      prompt: "A wide, uncluttered photograph of an empty lecture theatre …"
      generated: true
```

`pres render` then captions it *"Illustration generated with …. Not a photograph
or a measurement."* — the same reason the alt text says so. A generated picture
without that label is the one mistake in this section that survives into a
student's notes.

A planned visual with no figure beside it is not left blank and shrugged at.
Write the prompt onto the figure record and report that the slide is waiting on
an image; `pres check` warns about it by name.

Then render the draft — `pres render DECK.md --draft` writes a second deck in
which each of those holes is a card carrying the requirement and the prompt, so
the list of pictures still to make is a thing you can page through rather than a
field in a YAML file. See the render skill for `PRES_IMAGE_COMMAND`.

### What neither mechanism may be used for

- **Anything that asserts.** A found chart of someone else's results, or a
  generated one of nobody's, is a claim about the world arriving on a slide with
  none of the checks a claim gets.
- **A person.** No student, no identifiable individual, generated or found.
- **A logo or a mark**, institutional or commercial, without the professor
  saying so — trademark is a separate question from licence and this plugin
  answers neither.

## Rendering

`pres render` reads three things — the markdown, the plan beside it, and the
figures beside that — and writes into `output/`, which is gitignored. Nothing it
produces re-enters the source directory.

**SVG rasterizes at render time**, at twice its placed size, and the PNG goes to
`output/` with the deck. The PNG is never committed and never registered: it is
regenerable from an SVG that is.

**Manim renders to MP4** and needs ffmpeg (and LaTeX for typeset formulae), so
treat it as optional. The scene `.py` is the committed source; the video goes to
`output/`. If the dependencies are missing, render the final frame as a still or
fall back to an SVG diagram, and say which happened — never silently ship a deck
with a hole where the animation was.

## Two things a figure must never contain

An **answer key or correct-option marker**, and anything written for the
**marker** rather than the student. A slide that names the item a misconception
came from is fine and is good teaching; a slide that shows the key to an item
still in use is not, and a picture is where it will be missed, because nobody
greps a PNG.

And no student name, email or institutional number — in the picture, in the alt
text, in the filename, or in a chart's axis labels.
