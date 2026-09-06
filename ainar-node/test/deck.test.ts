/**
 * The deck renderer's judgement, separated from its I/O.
 *
 * Two things here are worth a test and the rest of `bin/render-deck.ts` is not.
 * The first is that the markdown a professor actually writes parses into the
 * blocks the renderer expects — a deck whose numbered list silently became a
 * paragraph is not a crash, it is a slide that looks wrong in the lecture
 * theatre. The second is the contract: it exists to stop a deck being rendered
 * from a plan that no longer describes it, so a check that passes when it should
 * fail is worse than no check.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CONTENT_WIDTH,
  LAYOUT,
  checkContract,
  columnWidths,
  creditFor,
  measureDeck,
  parseBlocks,
  slideTitle,
  splitSlides,
  textHeight,
  type Plan,
} from "../src/deck.ts";

const DECK = `---
marp: true
title: Model Evaluation
---

# Model Evaluation

CSS-4008 · Week 6

---

## Where we are

Today: whether the number means anything.

> Prerequisite check — CONCEPT-TRAIN-TEST-SPLIT. Two of three students
> chose the wrong answer.

![One dataset split three ways, with the test set
sealed](MODULE-06-slides-fig-01-split.svg)

---

## Choosing a metric

| Situation | Accuracy misleads because | Prefer |
| --- | --- | --- |
| 2% need ICU | Predicting "no" scores 98% | Recall |

1. Was the test set touched?
2. Does the metric match what failure costs?
`;

const slides = splitSlides(DECK).map(parseBlocks);

test("front matter is metadata, and the rules between blocks are slides", () => {
  assert.equal(slides.length, 3);
  // The front matter's own closing `---` must not open a slide of its own.
  assert.equal(slides[0]![0]!.kind, "heading");
});

test("a wrapped image is one image, not two lines of prose", () => {
  const image = slides[1]!.find((block) => block.kind === "image");
  assert.ok(image && image.kind === "image");
  assert.equal(image.src, "MODULE-06-slides-fig-01-split.svg");
  // The alt text is what a screen reader gets, so the wrap must not survive it.
  assert.equal(image.alt, "One dataset split three ways, with the test set sealed");
});

test("a blockquote is one callout, and a table drops its separator row", () => {
  const quote = slides[1]!.find((block) => block.kind === "quote");
  assert.ok(quote && quote.kind === "quote");
  assert.match(quote.text, /^Prerequisite check .* wrong answer\.$/);

  const table = slides[2]!.find((block) => block.kind === "table");
  assert.ok(table && table.kind === "table");
  assert.equal(table.rows.length, 2); // header + one row, no `| --- |`
});

test("a numbered list stays ordered", () => {
  const list = slides[2]!.find((block) => block.kind === "list");
  assert.ok(list && list.kind === "list");
  assert.equal(list.ordered, true);
  assert.equal(list.items.length, 2);
});

test("a slide's title is its heading", () => {
  assert.equal(slideTitle(slides[1]!), "Where we are");
});

const plan = (titles: string[], extra: Partial<Plan> = {}): Plan => ({
  slides: titles.map((title, index) => ({ number: index + 1, title })),
  ...extra,
});

test("a plan that describes the deck raises nothing", () => {
  const problems = checkContract(
    slides,
    plan(["Model Evaluation", "Where we are", "Choosing a metric"]),
  );
  assert.deepEqual(problems, []);
});

test("a slide inserted into the markdown is caught, not absorbed", () => {
  const problems = checkContract(slides, plan(["Model Evaluation", "Where we are"]));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /2 slide\(s\), the markdown has 3/);
});

test("two slides swapped are caught even though the set is identical", () => {
  // The failure a count check cannot see: same slides, wrong order, and every
  // speaker note now attached to the wrong slide.
  const problems = checkContract(
    slides,
    plan(["Model Evaluation", "Choosing a metric", "Where we are"]),
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0]!, /slide 2: the plan says "Choosing a metric"/);
});

test("a retitled slide is caught, but rewrapping and case are not a mismatch", () => {
  assert.equal(
    checkContract(slides, plan(["Model Evaluation", "where   we\nare", "Choosing a metric"])).length,
    0,
  );
  assert.equal(
    checkContract(slides, plan(["Model Evaluation", "Where we were", "Choosing a metric"])).length,
    1,
  );
});

test("more slides than the plan allows is a problem in itself", () => {
  const problems = checkContract(
    slides,
    plan(["Model Evaluation", "Where we are", "Choosing a metric"], { max_slides: 2 }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /3 slides, but the plan allows 2/);
});

test("a figure this repository drew carries no credit line", () => {
  assert.equal(creditFor(undefined, "fig.svg"), null);
  assert.equal(creditFor({ title: "drawn here" }, "fig.svg"), null);
});

test("a found image without its attribution stops the render", () => {
  // The failure this exists to prevent is silent: the deck builds, the lecture
  // happens, and the licence was never satisfied.
  assert.throws(
    () =>
      creditFor(
        { extensions: { image_source: { provider: "openverse", source_url: "https://x/y" } } },
        "fig-02.jpg",
      ),
    /attribution/,
  );
  assert.throws(
    () => creditFor({ extensions: { image_source: { attribution: "   " } } }, "fig-02.jpg"),
    /attribution/,
  );
});

test("a found image with its attribution puts the credit on the slide", () => {
  const credit = creditFor(
    { extensions: { image_source: { attribution: '"Histograms" by yuriy, CC BY 2.0' } } },
    "fig-02.jpg",
  );
  assert.equal(credit, '"Histograms" by yuriy, CC BY 2.0');
});

test("a generated illustration says on the slide that it was generated", () => {
  const credit = creditFor({ extensions: { image_prompt: { model: "some-image-model" } } }, "fig.png");
  assert.match(credit!, /generated with some-image-model/);
  assert.match(credit!, /Not a photograph or a measurement/);
});

test("columns are proportional to their content but never vanish", () => {
  const widths = columnWidths(
    [
      ["Situation", "Accuracy misleads because", "Prefer"],
      ["2% of patients need ICU", "Predicting \"no\" always scores 98%", "Recall"],
    ],
    12,
  );
  assert.equal(widths.length, 3);
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 12) < 0.001);
  assert.ok(widths[1]! > widths[2]!, "the widest column should get the most room");
  assert.ok(widths[2]! > 12 / (3 * 2.5) - 0.001, "no column below its floor");
});

// --------------------------------------------------------------------------
// Measuring — the half `ainar deck fit` and the renderer now share
// --------------------------------------------------------------------------

test("a slide's bottom is where its last block ends, not where the next would start", () => {
  // One paragraph on an ordinary slide: bottom is start + that paragraph, with
  // no trailing gap. The gap belongs between blocks, and counting it would
  // report every full slide as overflowing by exactly one gap.
  const [slide] = measureDeck("## Section\n\nA short line.");
  const paragraph = textHeight("A short line.", 17, CONTENT_WIDTH);
  assert.equal(slide!.bottom, Number((LAYOUT.start + paragraph).toFixed(2)));
  assert.equal(slide!.fits, true);
  assert.equal(slide!.approximate, false);
});

test("a section heading restarts the column rather than consuming height", () => {
  // The renderer draws an h2 at a fixed y and resets the cursor. A measurer
  // treating it as flow height would report every sectioned slide as taller
  // than it is, and long decks are nothing but sectioned slides.
  const withHeading = measureDeck("## A heading\n\nSame line.")[0]!;
  const without = measureDeck("Same line.")[0]!;
  assert.equal(withHeading.bottom, without.bottom);
});

test("an overflowing slide says by how much", () => {
  const long = Array.from({ length: 40 }, (_, i) => `- item number ${i} with enough words to wrap`).join("\n");
  const slide = measureDeck(`## Long\n\n${long}`)[0]!;
  assert.equal(slide.fits, false);
  assert.ok(slide.overflow > 0, "an overflow should be positive");
  assert.equal(slide.bottom - LAYOUT.floor > 0, true);
});

test("a slide holding an image is a bound, not a measurement", () => {
  // The renderer shrinks a picture to the space left, so its height is only
  // known once the file is read. Reporting that as a fact is how a fit check
  // starts lying.
  const slide = measureDeck("## With a picture\n\n![alt](chart.png)")[0]!;
  assert.equal(slide.approximate, true);
});

test("the fit check and the renderer measure with one set of numbers", () => {
  // The whole point of the extraction. If a block's height is ever computed in
  // `bin/render-deck.ts` again, `blockHeight` stops being the single answer and
  // `deck fit` becomes a second opinion — which is what it was written to
  // replace.
  const source = readFileSync(new URL("../bin/render-deck.ts", import.meta.url), "utf-8");
  assert.ok(!/const height = textHeight\(/.test(source), "render-deck computes a height itself");
  assert.ok(!/const SLIDE_W = 13\.33/.test(source), "render-deck carries its own page width");
  assert.ok(source.includes("blockHeight"), "render-deck should call the shared measurement");
});
