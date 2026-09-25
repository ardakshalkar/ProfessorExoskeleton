# Pictures on slides, and turning a deck into `.pptx`

Reference material for `/make-materials`. The skill says markdown is the source
and rendering happens after approval; this file is how that works when the deck
needs a picture, and which tool does which job.

## The constraint everything else follows from

Markdown is the source of truth because it diffs — a professor can see in a pull
request that the slide claiming three questions now claims four. A picture is a
binary and does not diff, so every graphic here is either **text that becomes a
picture** (SVG, a manim scene, a chart spec) or it is **not the source** (a PNG
rasterized at render time, a `.pptx`).

The rule that follows: *what you commit is the thing that generates the picture,
never only the picture.*

## Five kinds of graphic, told apart by where their authority comes from

This is the same line the whole repository runs on — a claim versus an artefact
serving one — applied to figures. The failure mode is specific: **a picture is
read as evidence even when the sentence next to it hedges.**

| Kind | Example | Where it comes from | Tool |
| --- | --- | --- | --- |
| **Diagram** | annotated train/validation/test split; a prerequisite chain; a pipeline | you draw it, from structure the course already claims | hand-authored SVG — the `artifact-diagramming` skill carries the craft |
| **Chart of course data** | this class's success rate per concept, marks per outcome | an `ainar` command, unchanged | `ainar gradebook --json`, `alignment`, `blueprint`; the `dataviz` skill for the marks and palette |
| **Chart of external data** | a published benchmark, a dataset's class balance | the source material the professor gave you, cited on the slide | same, plus the citation |
| **Animation** | gradient descent stepping downhill; a sort running | a manim scene you write | manim → MP4, embedded at render |
| **Decorative** | a photograph, a title-slide image | anywhere, and it carries no information | keep it away from numbers |

Three of those rows are refusals waiting to happen, and they should be:

- **A chart of course data you computed yourself is the same mistake as a hand
  totalled gradebook**, and worse, because a bar chart is not audited. If no
  command produces the figure, the slide says so in words and carries no chart.
- **A chart of external data with no citable source does not get drawn.** "Do not
  invent sources" does not relax because the invention is a shape rather than a
  sentence. A plausible accuracy curve with no data behind it is the single most
  quotable thing you can put in front of a class.
- **A generated decorative image must not sit where a reader will take it for
  data** — no invented screenshots of results, no fake plots as background, no
  diagram of a system the course has not described. Its alt text says it is
  illustrative.

And one that is not about truth but about the room: **colour is never the only
channel.** A red/green distinction is invisible to part of every cohort and to
every projector with a tired lamp. Label the lines, vary the dash, name the
regions.

## Where the files live

Approval flattens: `stage_documents` moves each document to
`materials/<filename>`, by name, with no subdirectory. So figures live **flat
beside the deck** and are named after it, and the markdown links to them as
siblings:

```text
work/CSS-4008-2026-FALL/materials/
  MODULE-06-slides.md
  MODULE-06-slides-fig-01-split.svg
  MODULE-06-slides-fig-02-gap.svg
  MODULE-06-slides-fig-03-descent.py     # a manim scene, not its video
```

```markdown
![Training data, validation data and a held-out test set never touched during
tuning](MODULE-06-slides-fig-01-split.svg)
```

A sibling-relative link survives the move into
`courses/<C>/materials/` unchanged, because both directories are
flat. An absolute or `figures/`-prefixed path does not — it breaks on approval,
and it breaks silently, in a deck nobody opens until the lecture.

The alt text is not optional and is not a caption of the filename. It says what
the picture asserts, because it is what a screen reader gets, what a student
reading the markdown on a phone gets, and what you will thank yourself for when
the SVG is lost.

## Registering a figure

Each figure is its own `Document`, in the same `documents-draft.yaml`. No
`Resource` — the deck has one, and the figure serves the deck:

```yaml
documents:
  - document_id: DOC-DRAFT-0602
    title: Train, validation and test split
    storage_key: work/CSS-4008-2026-FALL/materials/MODULE-06-slides-fig-01-split.svg
    mime_type: image/svg+xml
    course_version_id: CSS-4008-2026-FALL
    module_id: MODULE-06
    concepts: [CONCEPT-TRAIN-TEST-SPLIT]
    generated_by:
      produced_by: make-materials-skill
      model_id: claude-opus-5
      workflow_version: claude-code/prototype
      prompt_version: make-materials/v1
      input_refs: [MODULE-06, CONCEPT-TRAIN-TEST-SPLIT]
      created_at: 2026-09-28T10:52:00+05:00
```

An unregistered figure is a file `ainar validate` never checks and approval never
moves, so it stays in gitignored `work/` and the approved deck points at nothing.
As everywhere else: no `size_bytes`, no `checksum` — approval computes both.

A figure that answers a `required_visual` in the `presentation_plan` should carry
the same words in its `title`, so the two can be matched by eye.

## Images you did not draw

Two ways to get a picture you did not author, and they fail differently.

### Searching for one

```bash
node --experimental-strip-types node/bin/find-image.ts --search "confusion matrix"
```

Searches Openverse — Creative Commons and public-domain works across Wikimedia,
Flickr and others — and prints, for each result, **what the licence actually lets
a lecture do**. The default filter is commercial-and-modification use, because a
university lecture is a commercial context under most readings and a slide crops
and annotates. `--any-licence` widens it and labels what you get; a
NoDerivatives image is refused at download rather than warned about, because a
slide always crops it.

```bash
node --experimental-strip-types node/bin/find-image.ts --search "confusion matrix" \
    --pick 2 --course-version CSS-4008-2026-FALL --name MODULE-06-slides-fig-02-matrix
```

The file lands in `work/<COURSE_VERSION_ID>/materials/` — a found image is a
proposal like anything else — and the tool prints the `Document` draft that
carries its origin:

```yaml
    extensions:
      image_source:
        provider: openverse
        source_url: https://commons.wikimedia.org/w/index.php?curid=100443030
        license: CC-BY-SA-4.0
        attribution: '"Confusion matrix" by Pirehelokan is licensed under CC BY-SA 4.0.'
```

**Attribution is enforced, not remembered.** `render-deck` prints that line under
the picture, and refuses to build the deck at all if a document claims a source
without one. The failure it exists to prevent is the silent kind: the deck
builds, the lecture happens, and the licence was never satisfied.

Note what `by-sa` costs before choosing it — share-alike reaches the adaptation,
so a slide that annotates one may have to carry the same licence. `cc0` and
`pdm` results have no such condition, and are usually the better pick for
teaching material a faculty may want to reuse.

### Prompting for one

There is no image generator wired into this repository, and that is not the
gap it looks like: the prompt is language work, so writing it is the agent's
job and running it is the professor's, with whatever tool they have. What the
repository holds is the record.

A usable prompt for a slide is *specific about the thing, silent about the
truth*. Describe subject, framing, palette and what must not appear; never ask
for numbers, axes, labelled data, screenshots of results, or anything a reader
could mistake for a measurement:

> A wide, uncluttered photograph of an empty university lecture theatre seen from
> the back row, morning light, muted slate and pale blue tones, no people, no
> text, no charts or diagrams anywhere in frame. Leave the right third plain for
> overlaid text.

The negative half is the load-bearing half. An image model asked for "a machine
learning results dashboard" will produce plausible axes and invented numbers,
and a student cannot tell that from a real result at ten metres.

Record it on the figure's `Document`:

```yaml
    extensions:
      image_prompt:
        model: <the model the professor ran>
        prompt: "A wide, uncluttered photograph of an empty lecture theatre …"
        generated: true
```

`render-deck` then captions it *"Illustration generated with …. Not a photograph
or a measurement."* — the same reason the alt text says so. A generated picture
without that label is the one mistake in this section that survives into a
student's notes.

### What neither mechanism may be used for

- **Anything that asserts.** A found chart of someone else's results, or a
  generated one of nobody's, is a claim about the world arriving on a slide with
  none of the checks a claim gets. If the slide needs a chart of this class, it
  comes from an `ainar` command or the slide says so in words.
- **A person.** No student, no identifiable individual, generated or found.
- **A logo or a mark**, institutional or commercial, without the professor
  saying so — trademark is a separate question from licence and this repository
  answers neither.

## Rendering, after approval

The render reads three things — the approved markdown, the `presentation_plan`
on its `Document`, and the figures beside it — and writes one file into
gitignored `output/`. Nothing it produces re-enters `courses/`.

**Use the `pptx` skill.** It builds real shapes and real text boxes, which is
what makes the deck editable by the professor afterwards — the point of handing
over a `.pptx` at all.

Marp is the fallback, and it is a worse one for a reason worth knowing:
`marp-cli --pptx` produces a deck whose slides are **rendered images**, so
nothing in it can be edited or reused; `--pptx-editable` drives LibreOffice, is
experimental, and is known to wrap text in boxes it sizes badly. Reach for it
when the `pptx` skill is not installed, and say which you used.

Mapping, when you drive the `pptx` skill:

| In the source | Becomes |
| --- | --- |
| Marp front matter | deck metadata; not a slide |
| `---` between blocks | the slide boundary |
| leading `#` / `##` | the slide title |
| `![alt](file.svg)` | a picture, with `alt` as its alt text |
| `presentation_plan.slides[].minutes` and `purpose` | speaker notes |
| `presentation_plan.slides[].required_visual` with no image | a labelled placeholder box, never an invented figure |

**SVG rasterizes at render time.** PowerPoint has handled SVG since 2016 but
`python-pptx` places raster images reliably, so convert to PNG on the way in —
at presentation scale, 2× the placed size — and write the PNG into `output/`
beside the deck. The PNG is never committed and never registered: it is
regenerable from an SVG that is.

**Manim renders to MP4** and needs ffmpeg (and LaTeX for typeset formulae), so
treat it as optional. The scene `.py` is the committed source; the video goes to
`output/`. If the dependencies are missing, render the final frame as a still,
or fall back to the SVG diagram, and say in the hand-over which happened —
never silently ship a deck with a hole where the animation was.

## Two things a figure must never contain

The same pair as everywhere: an **answer key or correct-option marker**, and
anything written for the **marker** — `marking_guidance`,
`indicates_misconception_of` and its `note`. A slide that names the item a
misconception came from is fine and is good teaching; the slide that shows the
key to an item still in use is not, and a picture is where it will be missed,
because nobody greps a PNG.

And no student name, email or institutional number — in the picture, in the alt
text, in the filename, or in a chart's axis labels. Write the identifier.
