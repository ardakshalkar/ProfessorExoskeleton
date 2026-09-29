/**
 * The slide engine's judgement — the one renderer, since 2026-09-29.
 *
 * Ported from the tests of `render-deck`'s checks (`deck.test.ts`), which ran
 * against a module no longer used, onto the engine every recorded deck is
 * built with. The slides plugin this engine came from had no tests at all, so
 * this is also the first coverage its gates have had.
 *
 * Every check here exists to stop a deck that looks finished and is not; a
 * check that passes when it should fail is worse than no check.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDeck } from "../src/slides/check.ts";
import { checkContract, parseBlocks, splitSlides, type Plan } from "../src/slides/deck.ts";
import { creditForFigure } from "../src/slides/plan.ts";
import { canRender, placeFor, renderDeck } from "../src/slides/render.ts";
import { recordedFigures } from "../src/slides/recorded.ts";
import type { CourseBundle } from "../src/bundle.ts";
import { toPdf } from "../src/pdf.ts";

// --- the contract -----------------------------------------------------------

const DECK = `---
marp: true
---

# Model Evaluation

CSS-4008 · Week 6

---

## Where we are

Today: whether the number means anything.

---

## Choosing a metric

1. Was the test set touched?
`;

const slides = splitSlides(DECK).map(parseBlocks);
const plan = (titles: string[], extra: Partial<Plan> = {}): Plan => ({
  slides: titles.map((title, index) => ({ number: index + 1, title })),
  ...extra,
});

test("a plan that describes the deck raises nothing", () => {
  assert.deepEqual(checkContract(slides, plan(["Model Evaluation", "Where we are", "Choosing a metric"])), []);
});

test("a slide inserted into the markdown is caught, not absorbed", () => {
  const problems = checkContract(slides, plan(["Model Evaluation", "Where we are"]));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /2 slide\(s\), the markdown has 3/);
});

test("two slides swapped are caught even though the set is identical", () => {
  // Same slides, wrong order, and every speaker note on the wrong slide.
  const problems = checkContract(slides, plan(["Model Evaluation", "Choosing a metric", "Where we are"]));
  assert.equal(problems.length, 2);
  assert.match(problems[0]!, /slide 2: the plan says "Choosing a metric"/);
});

test("more slides than the plan allows is a problem in itself", () => {
  const problems = checkContract(
    slides,
    plan(["Model Evaluation", "Where we are", "Choosing a metric"], { max_slides: 2 }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /3 slides, but the plan allows 2/);
});

// --- credits ----------------------------------------------------------------

test("a figure this repository drew carries no credit line", () => {
  assert.equal(creditForFigure(undefined, "fig.svg"), null);
});

test("a found image without its attribution stops the render", () => {
  // Silent otherwise: the deck builds, the lecture happens, the licence was
  // never satisfied.
  assert.throws(
    () => creditForFigure({ image_source: { provider: "openverse", source_url: "https://x/y" } } as any, "fig-02.jpg"),
    /attribution/,
  );
});

test("a generated illustration says on the slide that it was generated", () => {
  const credit = creditForFigure({ image_prompt: { model: "some-image-model" } } as any, "fig.png");
  assert.match(credit!, /generated with some-image-model/);
  assert.match(credit!, /Not a photograph or a measurement/);
});

// --- the checks, on a deck on disk -----------------------------------------

/** A workspace with one recorded deck folder, and a draft one in work/. */
const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "slides-"));
  const recorded = join(root, "courses", "CSS-4008", "materials", "MODULE-06-slides");
  const draft = join(root, "work", "CSS-4008-2026-FALL", "materials", "MODULE-07-slides");
  mkdirSync(join(recorded, "figures"), { recursive: true });
  mkdirSync(draft, { recursive: true });
  return { root, recorded, draft };
};

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#dbe4f0"/></svg>';

/** One deck with one slide, its plan beside it, and any figures it names. */
const deckAt = (
  dir: string,
  body: string,
  options: { figures?: string[]; planned?: Record<string, unknown>; planFigures?: Record<string, unknown> } = {},
): string => {
  const name = dir.split(/[\\/]/).pop()!;
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `## Figure\n\n${body}\n`);
  for (const figure of options.figures ?? []) {
    mkdirSync(join(dir, figure, ".."), { recursive: true });
    writeFileSync(join(dir, figure), SVG);
  }
  const slide = { number: 1, title: "Figure", ...options.planned };
  const figures = options.planFigures ? { figures: options.planFigures } : {};
  writeFileSync(
    join(dir, `${name}.plan.yaml`),
    JSON.stringify({ mode: "standard", slides: [slide], ...figures }),
  );
  return path;
};

const seriousIn = (deck: string, options = {}) =>
  checkDeck(deck, options).problems.filter((problem) => problem.severity !== "note");

test("a picture with no alt text stops the render", () => {
  const { recorded } = workspace();
  const problems = seriousIn(deckAt(recorded, "![](figures/chart.svg)", { figures: ["figures/chart.svg"] }));
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.severity, "error");
  assert.match(problems[0]!.message, /has no alt text/);
});

test("a figure that leaves the deck's folder stops the render", () => {
  const { recorded } = workspace();
  for (const src of ["../chart.svg", "figures/../../chart.svg", "/tmp/chart.svg", "C:/x/chart.svg"]) {
    const problems = seriousIn(deckAt(recorded, `![a chart](${src})`));
    assert.ok(
      problems.some((problem) => problem.severity === "error" && /leaves the deck's folder/.test(problem.message)),
      src,
    );
  }
});

test("a figure in the deck's own figures/ folder raises nothing", () => {
  // A material is a folder since 2026-09-29, and `figures/` is where they live.
  const { recorded } = workspace();
  assert.deepEqual(seriousIn(deckAt(recorded, "![a chart](figures/fig-01.svg)", { figures: ["figures/fig-01.svg"] })), []);
});

test("a linked figure that is not there stops the render", () => {
  const { recorded } = workspace();
  const problems = seriousIn(deckAt(recorded, "![a chart](figures/gone.svg)"));
  assert.match(problems[0]!.message, /linked but not beside the deck/);
});

test("emphasis inside a list is a warning, not a refusal", () => {
  const { recorded } = workspace();
  const problems = seriousIn(deckAt(recorded, "- a **bold** word\n- plain"));
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.severity, "warning");
  assert.match(problems[0]!.message, /1 list item\(s\) use bold, italic or code/);
});

test("a planned visual that the deck does not carry is named", () => {
  const { recorded } = workspace();
  const problems = seriousIn(deckAt(recorded, "Just prose.", { planned: { required_visual: "the split" } }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.message, /planned with a visual \("the split"\)/);
});

test("a deck with no plan beside it is refused, and says how to make one", () => {
  const { recorded } = workspace();
  const deck = join(recorded, "loose.md");
  writeFileSync(deck, "## A slide\n");
  assert.throws(() => checkDeck(deck), /no .*plan\.yaml beside it/);
});

// --- credits from the course record ----------------------------------------

test("a Document's credit covers a picture the plan does not credit", () => {
  // `find-image` registers a found picture as a Document. A deck whose credit
  // lives only there used to be enforced by render-deck and nothing else.
  const { recorded } = workspace();
  const deck = deckAt(recorded, "![a histogram](figures/found.jpg)", { figures: ["figures/found.jpg"] });
  const missing = { "figures/found.jpg": { image_source: { provider: "openverse" } } } as any;
  assert.ok(seriousIn(deck, { figures: missing }).some((problem) => /attribution/.test(problem.message)));
  const credited = { "figures/found.jpg": { image_source: { attribution: '"Histograms" by yuriy, CC BY 2.0' } } } as any;
  assert.deepEqual(seriousIn(deck, { figures: credited }), []);
});

test("the plan's own credit wins over the Document's", () => {
  const { recorded } = workspace();
  const deck = deckAt(recorded, "![a histogram](figures/found.jpg)", {
    figures: ["figures/found.jpg"],
    planFigures: { "figures/found.jpg": { image_source: { attribution: "from the plan" } } },
  });
  const checked = checkDeck(deck, { figures: { "figures/found.jpg": { image_source: { attribution: "from the record" } } } as any });
  assert.equal(creditForFigure(checked.figures["figures/found.jpg"], "x"), "from the plan");
});

test("Document credits are keyed by the path the deck links them by", () => {
  const { root, recorded } = workspace();
  const bundle = {
    documents: [
      {
        document_id: "DOC-FIG-01",
        storage_key: "courses/CSS-4008/materials/MODULE-06-slides/figures/found.jpg",
        extensions: { image_source: { attribution: "by someone, CC BY" } },
      },
      // Elsewhere in the course: not this deck's to credit.
      { document_id: "DOC-FIG-02", storage_key: "courses/CSS-4008/materials/other/x.jpg", extensions: { image_source: { attribution: "a" } } },
      { document_id: "DOC-DECK", storage_key: "courses/CSS-4008/materials/MODULE-06-slides/MODULE-06-slides.md" },
    ],
  } as unknown as CourseBundle;
  const figures = recordedFigures(bundle, root, join(recorded, "MODULE-06-slides.md"));
  assert.deepEqual(Object.keys(figures), ["figures/found.jpg"]);
});

test("a recorded plan that has drifted is said, not refused", () => {
  // Decks are revised and re-rendered on purpose; the record's copy of the
  // plan is a snapshot. Two of five in the first course had drifted.
  const { recorded } = workspace();
  const deck = deckAt(recorded, "Just prose.");
  const problems = seriousIn(deck, { recordPlan: { slides: [{ number: 1, title: "Figure" }, { number: 2, title: "Gone" }] } });
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.severity, "warning");
  assert.match(problems[0]!.message, /recorded presentation_plan describes an older deck/);
});

// --- where a render goes ----------------------------------------------------

test("a recorded deck renders beside its markdown, its pictures to output/", () => {
  const { root, recorded } = workspace();
  const place = placeFor(join(recorded, "MODULE-06-slides.md"));
  assert.equal(place.recorded, true);
  assert.equal(place.outDir, recorded);
  assert.equal(place.assetsDir, join(root, "output", "MODULE-06-slides"));
});

test("a draft of a recorded deck, and a deck in work/, go to output/<deck>/", () => {
  const { root, recorded, draft } = workspace();
  assert.equal(placeFor(join(recorded, "MODULE-06-slides.md"), { draft: true }).outDir, join(root, "output", "MODULE-06-slides"));
  const work = placeFor(join(draft, "MODULE-07-slides.md"));
  assert.equal(work.recorded, false);
  assert.equal(work.outDir, join(root, "output", "MODULE-07-slides"));
});

test("nothing but a recorded deck's own render is written inside courses/", () => {
  const { root, recorded, draft } = workspace();
  // A draft pointed into the course.
  assert.throws(() => placeFor(join(draft, "MODULE-07-slides.md"), { outDir: recorded }), /refusing to write/);
  // A recorded deck's --draft into its own folder.
  assert.throws(() => placeFor(join(recorded, "MODULE-06-slides.md"), { draft: true, outDir: recorded }), /refusing/);
  // A recorded deck into somebody else's folder.
  assert.throws(
    () => placeFor(join(recorded, "MODULE-06-slides.md"), { outDir: join(root, "courses", "CSS-4008") }),
    /refusing/,
  );
});

test("the workspace is found from the deck, not from where the command ran", () => {
  const { root, draft } = workspace();
  assert.equal(placeFor(join(draft, "MODULE-07-slides.md")).assetsDir, join(root, "output", "MODULE-07-slides"));
});

// --- the PDF ------------------------------------------------------------------

test("a converter that fails is reported, and an older PDF is not taken for its output", () => {
  // Node stands in for LibreOffice: it rejects `--headless` and exits non-zero,
  // which is the case the old converter reported as success when a PDF from an
  // earlier run was lying where it looked.
  const dir = mkdtempSync(join(tmpdir(), "pdf-"));
  const pptx = join(dir, "deck.pptx");
  writeFileSync(pptx, "not really a deck");
  writeFileSync(join(dir, "deck.pdf"), "from last week");
  const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  utimesSync(join(dir, "deck.pdf"), lastWeek, lastWeek);
  const before = process.env.SOFFICE_PATH;
  process.env.SOFFICE_PATH = process.execPath;
  try {
    const result = toPdf(pptx, dir);
    assert.ok("error" in result, "a failed conversion must not come back as a PDF");
    assert.match(result.error, /exit \d+/);
    assert.match(result.error, /from an earlier run/);
  } finally {
    if (before === undefined) delete process.env.SOFFICE_PATH;
    else process.env.SOFFICE_PATH = before;
  }
});

// --- one real render, where this machine can ---------------------------------

test("a render writes the deck, measures every slide, and keeps pictures out of the course", { skip: !canRender() && "pptxgenjs and sharp are not installed" }, async () => {
  const { root, recorded } = workspace();
  const deck = deckAt(recorded, "![a chart](figures/fig-01.svg)\n\nOne line under it.", { figures: ["figures/fig-01.svg"] });
  const result = await renderDeck(deck);
  assert.equal(result.pptx, join(recorded, "MODULE-06-slides.pptx"));
  assert.ok(existsSync(result.pptx));
  assert.equal(result.measured.length, 1);
  assert.ok(result.measured[0]!.bottom > 1.6 && result.measured[0]!.bottom <= 7.0);
  assert.ok(existsSync(join(root, "output", "MODULE-06-slides", "figures", "fig-01.png")));
  // The deck's folder holds what it held, plus the one file asked for.
  assert.deepEqual(readdirSync(recorded).sort(), ["MODULE-06-slides.md", "MODULE-06-slides.plan.yaml", "MODULE-06-slides.pptx", "figures"]);
  assert.deepEqual(readdirSync(join(recorded, "figures")), ["fig-01.svg"]);
});
