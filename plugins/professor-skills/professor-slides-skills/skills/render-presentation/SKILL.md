---
name: render-presentation
description: Turn a finished presentation into the files a professor actually presents — a PowerPoint deck with real editable shapes and speaker notes, and a PDF converted from that same deck. Use when the user asks to render, export, build or produce a .pptx, a PowerPoint, a PDF or slides from markdown that already exists. Writing the slides in the first place is /build-presentation.
stage: publish
requires: [deck, plan]
produces: [pptx, pdf]
writes: output
---

# Render the presentation

**Needs:** a deck with its generated plan beside it. Rendering needs `pptxgenjs`
and `sharp`; the PDF needs LibreOffice.

```bash
pres render work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.md --pdf
```

It reads the markdown, the plan beside it and the figures beside that, and writes
`output/<DECK>.pptx` — plus the PDF with `--pdf`, converted from that same deck by
LibreOffice rather than rendered a second time.

`output/` is gitignored deliberately: built binaries belong on the professor's
disk, not in a directory whose value is that its contents diff. The rasterized
PNGs go there too.

If there is no plan, or the plan is stale, generate it rather than writing one:

```bash
pres plan build DECK.md --mode standard
```

## Four things are enforced, not left to judgement

Each is a mistake this made before the check existed.

- **A deck that needed approval and has none is refused.** Whether it needed
  approval is a fact on the plan: `deep` mode and anything built
  `--approval required` needs an approved outline; `fast` and `standard` do not,
  because the request for slides was the agreement. A plan naming no mode at all
  is treated as needing approval — those are the decks built before modes
  existed. **The render always says which of these it was**, and you repeat that
  when you hand the file over: a `.pptx` looks identical either way, and nothing
  inside it says whether anybody agreed to what is in it.
- **The plan is the contract.** Slide count, order and titles must match the
  markdown, or it exits and says where. Nothing reorders slides to agree. The
  plan is generated, so the fix is `pres plan build` — and then the real question,
  which is whether the *deck* is still what was agreed to.
- **Attribution is enforced.** A figure recording a source without an attribution
  line stops the render. The failure it prevents is the silent kind: the deck
  builds, the lecture happens, and the licence was never satisfied.
- **Overflow is reported.** Any slide running past the bottom margin is named,
  with how far over it goes. Whatever falls below is not clipped or marked — it is
  simply not on the slide.

If the render refuses, report what it said and stop. Do not edit the deck or the
plan to make it succeed.

## Then look at it

The first render usually has a real defect or two — a misjudged image height, a
list that lost its numbering, a table that wrapped badly. They are obvious in the
pages and invisible in the source. Open the PDF and read it before handing it
over.

## The draft deck, for the pictures that do not exist yet

A slide planned with a figure and lacking one is invisible: the deck renders, the
prose fills the space, and the hole is a line in a YAML file nobody opens.

```bash
pres render DECK.md --pdf --draft
```

Two decks, one command — the one you present, and `<name>-draft.pptx` beside it in
which every planned-but-undrawn visual is a dashed card carrying what the outline
said the picture must show and the prompt that would produce it. Every draft slide
is marked `DRAFT` and it is written under its own name, so it can never be handed
out by mistake or overwrite the deck you present. Read them side by side; the gap
is the work list.

**It does not call an image model, and that is on purpose.** Writing the prompt is
language work and is yours; running it belongs to whatever generator the professor
already uses. A professor who wants the draft filled in sets `PRES_IMAGE_COMMAND`
— `references/rendering-fallbacks.md` has the shape and the failure modes.
Anything so generated is captioned **"Generated illustration. Not a photograph or
a measurement."**, stays in the draft deck until the professor decides it is true,
and is never linked into the deck markdown on their behalf.

## When a dependency is missing

Say which, and hand over what is honest about being a substitute.
`${CLAUDE_PLUGIN_ROOT}/references/rendering-fallbacks.md` has the commands and
what each one costs. The short version: Marp can render the markdown straight to
PDF with only a browser, and that is a *second rendering* rather than a picture of
this deck — fine for reading through, wrong for anything presented. Marp's
`.pptx` is worse than it looks: each slide is a flat image, nothing in it can be
edited, and none of the four checks above runs.

## Afterwards

The `.pptx` is not registered anywhere and is not a second source. It is
reproducible from the markdown at any time, and a second artefact with a second
checksum leaves the professor with two decks and no way to tell which one was
approved.

If they then edit the deck in PowerPoint, **report that as drift and leave it**.
The edited slide may well be the better one, and folding it back into the markdown
is their call.

## Timing

```bash
pres render DECK.md --pdf --timing
```

Prints where the seconds went — checks, pptx, PDF conversion — to stderr. Local
only; nothing is sent anywhere.

## Rules

- **Render into gitignored `output/`,** and only when asked.
- **Say what the file is.** Which mode built it, and whether an approval stands
  behind it.
- **Never edit the deck or the plan to make a render succeed.** A refusal is
  information.
- **Say which renderer produced the file** when it was not `pres render`, and what
  that costs.
- **Do not register the render** as a source of anything.
- **Report drift, do not reconcile it.**
- **A generated picture stays in the draft deck** until the professor has looked
  at it, is captioned as generated wherever it appears, and is never linked into
  the markdown on their behalf.
