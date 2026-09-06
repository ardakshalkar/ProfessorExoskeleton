#!/usr/bin/env node

/**
 * Render an approved slide deck to `.pptx`, and optionally to PDF.
 *
 *     node --experimental-strip-types bin/render-deck.ts \
 *       --course-version CSS-4008-2026-FALL --document DOC-4410 --pdf
 *
 * This is step 6 of `/make-materials` made mechanical. The markdown is the
 * source and the deck is a rendering of it, so three things are checked here
 * rather than trusted to whoever is driving:
 *
 *   - **The document must be approved.** A `storage_key` under `work/` is a
 *     proposal, and a proposal rendered to `.pptx` looks exactly like a finished
 *     deck once it is open in PowerPoint.
 *   - **The plan is the contract.** If a `presentation_plan` is present, its
 *     slides must match the markdown in count, order and title. A mismatch means
 *     one of the two was edited after the other, so this exits rather than
 *     reordering anything to make them agree — see `src/deck.ts`.
 *   - **Nothing is written inside the repository's content.** Output goes to
 *     `output/<COURSE_VERSION_ID>/`, which is gitignored: built binaries belong
 *     on the professor's disk, not in a repository whose value is that its
 *     contents diff.
 *
 * `pptxgenjs` and `sharp` are loaded the way `render-exam.ts` loads `docx` and
 * `pdf-lib` — from `node/node_modules` or `DECK_RENDERER_NODE_MODULES`. They are
 * not dependencies of `@ainar/core`, because reading a course should not require
 * a native image library:
 *
 *     cd node && npm install pptxgenjs sharp
 *
 * PDF conversion shells out to LibreOffice, so the PDF is a conversion of this
 * exact deck rather than a second renderer's idea of it. Without LibreOffice the
 * `.pptx` is still written and the PDF is reported as skipped.
 */

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { documentById } from "../src/bundle.ts";
import {
  checkContract,
  columnWidths,
  creditFor,
  parseBlocks,
  plain,
  splitSlides,
  textHeight,
  type Block,
  type Plan,
} from "../src/deck.ts";
import { Workspace } from "../src/mcp/workspace.ts";

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function loadDependency(name: string): any {
  const root = process.env.DECK_RENDERER_NODE_MODULES
    ? resolve(process.env.DECK_RENDERER_NODE_MODULES)
    : resolve(scriptDirectory, "..", "node_modules");
  try {
    return require(join(root, name));
  } catch (error) {
    throw new Error(
      `Cannot load ${name}. Run \`cd node && npm install pptxgenjs sharp\`, or set ` +
      `DECK_RENDERER_NODE_MODULES to a directory containing it.\n${String(error)}`,
    );
  }
}

// --- the house palette ------------------------------------------------------
// One restrained set rather than a per-deck choice: these decks are the same
// course seen week after week, and a palette that changes with the topic reads
// as a different course.
const INK = "1F2933";
const MUTED = "52616B";
const PRIMARY = "4A5F7A";
const LIGHT = "DBE4F0";
const PAPER = "FFFFFF";
const RULE = "C6CED6";
const CODE_BG = "F2F4F7";
const CODE_LINE = "E2E7ED";

const HEAD_FONT = "Cambria";
const BODY_FONT = "Calibri";
const MONO_FONT = "Courier New";

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.7;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const FLOOR = SLIDE_H - 0.5; // the 0.5" bottom margin, enforced rather than hoped for

/** `**bold**` and `` `code` `` into pptxgenjs runs; everything else is plain. */
function runs(text: string, base: Record<string, unknown>): unknown[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**")) return { text: part.slice(2, -2), options: { ...base, bold: true } };
      if (part.startsWith("`")) return { text: part.slice(1, -1), options: { ...base, fontFace: MONO_FONT } };
      return { text: part, options: { ...base } };
    });
}

async function render(
  slides: Block[][],
  plan: Plan | null,
  context: {
    materialsDir: string;
    outDir: string;
    documentId: string;
    title: string;
    figures: Map<string, any>;
  },
): Promise<{ file: string; warnings: string[] }> {
  const pptxgen = loadDependency("pptxgenjs");
  const sharp = loadDependency("sharp");
  const warnings: string[] = [];

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // before any slide is added, or coordinates lie
  pres.author = "make-materials-skill";
  pres.title = context.title;

  const noteFor = (index: number): string | null => {
    const spec = plan?.slides?.find((slide) => slide.number === index + 1);
    if (!spec) return null;
    const minutes = spec.minutes ? `${spec.minutes} min` : null;
    return [minutes, spec.purpose].filter(Boolean).join(" — ") || null;
  };

  for (const [index, blocks] of slides.entries()) {
    const heading = blocks.find((block) => block.kind === "heading");
    const isTitleSlide = index === 0 && heading?.kind === "heading" && heading.level === 1;
    const slide = pres.addSlide();
    slide.background = { color: isTitleSlide ? INK : PAPER };

    let cursor = 1.6;
    // Where the last block actually ends, as against where the next one would
    // start. Without the distinction every full slide reports an overflow of
    // exactly one inter-block gap.
    let bottom = cursor;
    const advance = (height: number, gap = 0.3): void => {
      bottom = cursor + height;
      cursor = bottom + gap;
    };

    if (isTitleSlide) {
      cursor = 1.9;
      for (const block of blocks) {
        if (block.kind === "heading") {
          const height = textHeight(block.text, 46, 9.0, 1.15);
          slide.addText(block.text, {
            x: MARGIN, y: cursor, w: 9.6, h: height,
            fontFace: HEAD_FONT, fontSize: 46, bold: true, color: PAPER,
            lineSpacingMultiple: 1.05, margin: 0,
          });
          advance(height, 0.5);
        } else if (block.kind === "paragraph") {
          const height = textHeight(block.text, 16, 10.0);
          slide.addText(runs(block.text, { color: LIGHT }), {
            x: MARGIN, y: cursor, w: 10.0, h: height,
            fontFace: BODY_FONT, fontSize: 16, margin: 0,
          });
          advance(height, 0.28);
        }
      }
      const note = noteFor(index);
      if (note) slide.addNotes(note);
      continue;
    }

    for (const block of blocks) {
      switch (block.kind) {
        case "heading": {
          slide.addText(block.text, {
            x: MARGIN, y: 0.45, w: CONTENT_W, h: 0.8,
            fontFace: HEAD_FONT, fontSize: 34, bold: true, color: INK, margin: 0,
          });
          slide.addShape(pres.ShapeType.line, {
            x: MARGIN, y: 1.32, w: CONTENT_W, h: 0,
            line: { color: RULE, width: 1 },
          });
          cursor = 1.6;
          bottom = cursor;
          break;
        }

        case "paragraph": {
          const height = textHeight(block.text, 17, CONTENT_W);
          slide.addText(runs(block.text, { color: INK }), {
            x: MARGIN, y: cursor, w: CONTENT_W, h: height,
            fontFace: BODY_FONT, fontSize: 17, lineSpacingMultiple: 1.15, margin: 0,
          });
          advance(height);
          break;
        }

        case "quote": {
          const height = textHeight(block.text, 15, CONTENT_W - 0.6) + 0.4;
          slide.addShape(pres.ShapeType.roundRect, {
            x: MARGIN, y: cursor, w: CONTENT_W, h: height,
            fill: { color: LIGHT }, line: { color: LIGHT }, rectRadius: 0.06,
          });
          slide.addText(runs(block.text, { color: INK }), {
            x: MARGIN + 0.3, y: cursor + 0.2, w: CONTENT_W - 0.6, h: height - 0.4,
            fontFace: BODY_FONT, fontSize: 15, lineSpacingMultiple: 1.15, margin: 0,
          });
          advance(height);
          break;
        }

        case "code": {
          const height = textHeight(block.text, 18, 5.4, 1.4) + 0.4;
          slide.addShape(pres.ShapeType.roundRect, {
            x: MARGIN, y: cursor, w: 6.0, h: height,
            fill: { color: CODE_BG }, line: { color: CODE_LINE }, rectRadius: 0.06,
          });
          slide.addText(block.text, {
            x: MARGIN + 0.3, y: cursor + 0.2, w: 5.4, h: height - 0.4,
            fontFace: MONO_FONT, fontSize: 18, color: INK, lineSpacingMultiple: 1.25, margin: 0,
          });
          advance(height);
          break;
        }

        case "list": {
          // pptxgenjs restarts numbering at 1 for every paragraph unless each
          // one says where it sits in the sequence.
          const body = block.items.map((item, position) => ({
            text: plain(item),
            options: {
              color: INK,
              bullet: block.ordered ? { type: "number", startAt: position + 1 } : true,
              breakLine: position < block.items.length - 1,
            },
          }));
          const height =
            block.items.reduce((total, item) => total + textHeight(item, 17, CONTENT_W - 0.6), 0) +
            block.items.length * 0.16;
          slide.addText(body, {
            x: MARGIN + 0.15, y: cursor, w: CONTENT_W - 0.3, h: height,
            fontFace: BODY_FONT, fontSize: 17, margin: 0,
            paraSpaceAfter: 14, lineSpacingMultiple: 1.15,
          });
          advance(height);
          break;
        }

        case "table": {
          const [header, ...body] = block.rows;
          if (!header) break;
          const width = CONTENT_W - 0.4;
          const rows = [
            header.map((cell) => ({
              text: plain(cell),
              options: { bold: true, color: PAPER, fill: { color: PRIMARY }, fontSize: 15 },
            })),
            ...body.map((row) =>
              row.map((cell) => ({ text: plain(cell), options: { color: INK, fontSize: 15 } })),
            ),
          ];
          const rowHeight = 0.62;
          slide.addTable(rows, {
            x: MARGIN, y: cursor, w: width,
            colW: columnWidths(block.rows, width),
            fontFace: BODY_FONT, border: { type: "solid", color: CODE_LINE, pt: 1 },
            rowH: rowHeight, valign: "middle", margin: 0.12, fill: { color: PAPER },
          });
          advance(rows.length * rowHeight, 0.35);
          break;
        }

        case "image": {
          const source = join(context.materialsDir, block.src);
          if (!existsSync(source)) {
            warnings.push(`slide ${index + 1}: ${block.src} is missing; left off the slide`);
            break;
          }
          // The SVG is the committed source; the PNG is a render, and it goes to
          // output/ with the deck rather than back into the course.
          const placedW = Math.min(CONTENT_W * 0.75, 8.6);
          const png = join(
            context.outDir,
            `${context.documentId}-${block.src.replace(/\.[^.]+$/, "")}.png`,
          );
          const credit = creditFor(context.figures.get(source), block.src);
          const creditH = credit ? 0.3 : 0;
          const meta = await sharp(source)
            .resize({ width: Math.round(placedW * 96 * 2) }) // 2x its placed size
            .png()
            .toFile(png);
          let width = placedW;
          let height = width * (meta.height / meta.width);
          const available = FLOOR - cursor - creditH;
          if (height > available) {
            height = available;
            width = height * (meta.width / meta.height);
          }
          slide.addImage({
            path: png,
            x: (SLIDE_W - width) / 2, y: cursor, w: width, h: height,
            altText: block.alt,
          });
          if (credit) {
            slide.addText(credit, {
              x: (SLIDE_W - width) / 2, y: cursor + height + 0.04, w: width, h: 0.22,
              fontFace: BODY_FONT, fontSize: 10, color: MUTED, margin: 0,
            });
          }
          advance(height + creditH);
          break;
        }
      }
    }

    if (bottom > FLOOR) {
      warnings.push(
        `slide ${index + 1} runs to ${bottom.toFixed(2)}" of ${FLOOR}" — shorten it or split it`,
      );
    }

    const note = noteFor(index);
    if (note) slide.addNotes(note);
  }

  const file = join(context.outDir, `${context.documentId}.pptx`);
  await pres.writeFile({ fileName: file });
  return { file, warnings };
}

const SOFFICE = [
  process.env.SOFFICE_PATH,
  "soffice",
  "C:/Program Files/LibreOffice/program/soffice.exe",
  "/usr/bin/soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
].filter(Boolean) as string[];

function toPdf(pptx: string, outDir: string): string | null {
  for (const binary of SOFFICE) {
    const result = spawnSync(
      binary,
      ["--headless", "--convert-to", "pdf", "--outdir", outDir, pptx],
      { encoding: "utf8" },
    );
    if (result.error) continue;
    const pdf = pptx.replace(/\.pptx$/, ".pdf");
    if (existsSync(pdf)) return pdf;
  }
  return null;
}

// --- main -------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const USAGE = `render-deck — an approved deck to .pptx

  --course-version RUN   the run owning the document (required)
  --document DOC         the Document to render (required)
  --root DIR             the workspace (default: the current directory)
  --out DIR              where to write (default: <root>/output/<RUN>)
  --pdf                  also convert with LibreOffice

The markdown is the source. This renders the approved file in courses/, checks
it against the document's presentation_plan, and writes only to output/.`;

async function main(): Promise<void> {
  if (has("help") || !flag("course-version") || !flag("document")) {
    console.log(USAGE);
    process.exit(has("help") ? 0 : 1);
  }

  const root = resolve(flag("root") ?? process.cwd());
  const courseVersionId = flag("course-version")!;
  const documentId = flag("document")!;

  const bundle = new Workspace(root).findRun(courseVersionId);
  const document = documentById(bundle).get(documentId) as any;
  if (!document) throw new Error(`no document '${documentId}' in ${courseVersionId}`);

  const storageKey: string = document.storage_key;
  if (storageKey.includes("://")) {
    throw new Error(
      `${documentId} lives in object storage (${storageKey}); there is no file here to render`,
    );
  }
  if (/^work[\\/]/.test(storageKey)) {
    throw new Error(
      `${documentId} is still a draft (${storageKey}).\n` +
      "A deck rendered from work/ looks finished and nobody approved what is inside it.\n" +
      `Approve it first: python -m ainar approve work/${courseVersionId} --as <USER>`,
    );
  }
  const sourcePath = resolve(root, storageKey);
  if (!existsSync(sourcePath)) throw new Error(`${storageKey} does not exist`);

  const slides = splitSlides(await readFile(sourcePath, "utf8")).map(parseBlocks);
  if (!slides.length) throw new Error(`${storageKey} has no slides`);

  const plan: Plan | null = document.presentation_plan ?? null;
  if (plan) {
    const problems = checkContract(slides, plan);
    if (problems.length) {
      console.error(`${documentId}: the plan and the markdown disagree.\n`);
      for (const problem of problems) console.error(`  ${problem}`);
      console.error(
        "\nOne of the two was edited after the other, so this deck is not the one that was\n" +
        "approved. Fix whichever is wrong — nothing here reorders slides to make them agree.",
      );
      process.exit(1);
    }
  } else {
    console.warn(
      `${documentId} has no presentation_plan, so nothing checked the deck's structure ` +
      "and the slides carry no speaker notes.",
    );
  }

  const outDir = resolve(flag("out") ?? join(root, "output", courseVersionId));
  if (outDir === resolve(root, "courses") || outDir.startsWith(resolve(root, "courses") + sep)) {
    throw new Error("refusing to write a rendered binary inside courses/");
  }
  await mkdir(outDir, { recursive: true });

  // Every repository-held document by absolute path, so a figure on a slide can
  // be matched back to the record carrying its licence.
  const figures = new Map<string, any>();
  for (const [, record] of documentById(bundle) as Map<string, any>) {
    if (!record.storage_key.includes("://")) {
      figures.set(resolve(root, record.storage_key), record);
    }
  }

  const { file, warnings } = await render(slides, plan, {
    materialsDir: dirname(sourcePath),
    outDir,
    documentId,
    title: document.title,
    figures,
  });
  console.log(`wrote ${file}`);

  if (has("pdf")) {
    const pdf = toPdf(file, outDir);
    if (pdf) console.log(`wrote ${pdf}`);
    else console.warn("LibreOffice not found — the .pptx is written, the PDF is not. Set SOFFICE_PATH.");
  }

  for (const warning of warnings) console.warn(`  ${warning}`);
}

main().catch((error) => {
  console.error(String((error as Error).message ?? error));
  process.exitCode = 1;
});
