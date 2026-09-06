# When a render dependency is missing

`pres render` needs `pptxgenjs` and `sharp`, and the PDF additionally needs
LibreOffice. When one of them is not there, there is usually something you can
hand over — and the whole value of handing it over is saying precisely what it is
and is not.

```bash
cd node && npm install pptxgenjs sharp
```

is the fix for the first two, and is worth offering before any substitute.

## No LibreOffice, and a PDF is wanted for review

Marp renders straight to PDF and needs only a browser:

```bash
npx @marp-team/marp-cli work/CSS-4008-2026-FALL/presentations/MODULE-06-slides.md --pdf --pdf-outlines -o output/MODULE-06-slides-review.pdf
```

Say what it is: a **second rendering of the markdown**, not a conversion of the
deck. Fine for reading through and checking the words; wrong for anything
presented or handed out, because it is not the same document the professor will
open in PowerPoint.

`SOFFICE_PATH` points at a LibreOffice binary in an unusual place, and is the
better answer when one is installed.

## No `pptxgenjs` or `sharp`

Marp will write a `.pptx` and it is worse than it looks:

```bash
npx @marp-team/marp-cli work/.../MODULE-06-slides.md --pptx -o output/MODULE-06-slides.pptx
```

Each slide is a flat image. Nothing in it can be edited or reused — no text to
fix, no shape to move, no speaker notes — and **none of the four checks runs**:
no approval gate, no plan contract, no attribution enforcement, no overflow
report. A professor who wanted an editable deck has been handed a slideshow of
pictures.

Both Marp routes need a Chromium-based browser or Firefox, which Marp drives
through puppeteer-core.

Neither is the renderer. Both are what you offer while saying so.

## Filling a draft deck's placeholders with a generator

`pres render --draft` writes the prompt onto the card rather than calling an image
model. A professor who does want it filled in points `PRES_IMAGE_COMMAND` at a
command taking `{prompt}` and `{out}`:

```bash
PRES_IMAGE_COMMAND='mytool --prompt {prompt} --out {out}' pres render DECK.md --draft
```

Quote any part with spaces in it; the template is split the way a shell splits it.
A command that fails, or that does not write the file it was asked for, **leaves
the placeholder standing and says so** — a draft that quietly shipped an empty
slot would be worse than one showing the hole.

Anything generated this way is captioned "Generated illustration. Not a photograph
or a measurement." on the slide, because a picture behind a lecturer is read as
evidence unless it says otherwise. It stays in the draft deck until the professor
has looked at it and decided it is true, and it is never linked into the deck
markdown on their behalf.
