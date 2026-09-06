/**
 * Slide primitives for hand-built decks. Ported from `deck_kit.py`.
 *
 * The CSS-4007 decks were not rendered from markdown. Each week is a script
 * that draws its slides by coordinate — `build-week5-pptx.py` and its six
 * siblings — over a shared kit, and `render-deck.ts` was never in that path.
 * That is why weeks 5, 6 and 7 have no markdown to re-render from: the script
 * IS the source.
 *
 * It worked, and it had one problem: the scripts are Python, in a project where
 * nothing else is, sitting inside `courses/` — so the course record depends on
 * a toolchain the project does not otherwise carry. This is the same kit over
 * `pptxgenjs`, which `render-deck.ts` already loads.
 *
 * ## The canvas, and why the numbers carry over unchanged
 *
 * Everything is in **slide-pixels on a 1280×720 canvas**, exactly as the Python
 * kit's docstring says, so a coordinate copied out of a build script means the
 * same thing here. Two conversions do the work:
 *
 *   - **Position and size.** python-pptx counts EMU and `px()` multiplied by
 *     9525 to get there. pptxgenjs counts inches, so this divides by 96 —
 *     9525 EMU per pixel and 914400 EMU per inch are the same statement.
 *   - **Font size.** A size here is in those slide-pixels too, and both kits
 *     turn it into points at ×0.75 (96 px/in against 72 pt/in). A `size: 24`
 *     is 18pt in either.
 *
 * 1280 px is 13.333in and 720 px is 7.5in, which is pptxgenjs's own
 * `LAYOUT_WIDE`. The layout is still set explicitly: a default that happened to
 * match would silently stop matching.
 *
 * ## What is deliberately not here
 *
 * The seven per-week scripts. They are this course's content — its words, its
 * measured figures, its argument — and content belongs in the course workspace,
 * not in the harness. This is the part that is the same for every deck anyone
 * builds.
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * `pptxgenjs`, from wherever the renderer finds it.
 *
 * Same rule as `bin/render-deck.ts`: it is not a dependency of the course model,
 * because reading a course should not require a presentation library.
 */
const loadPptxgen = (): any => {
  const root = process.env.DECK_RENDERER_NODE_MODULES
    ? resolve(process.env.DECK_RENDERER_NODE_MODULES)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "node_modules");
  try {
    return require(resolve(root, "pptxgenjs"));
  } catch (error) {
    throw new Error(
      "Cannot load pptxgenjs. Run `npm install pptxgenjs` in ainar-node, or set " +
        `DECK_RENDERER_NODE_MODULES to a directory containing it.\n${String(error)}`,
    );
  }
};

/** The canvas, in slide-pixels. */
export const W = 1280;
export const H = 720;

/**
 * The house palette, as pptxgenjs wants it: six hex digits, no `#`.
 *
 * The same eleven names and the same eleven values as `deck_kit.py`'s `C`, so a
 * script that said `C.muted` still says `C.muted`.
 */
export const C = {
  ink: "111111",
  muted: "59636E",
  line: "B8BCC4",
  panel: "EDEDED",
  pale: "EAF5FB",
  accent: "3D8DFF",
  accent2: "6DCBF4",
  draft: "8C3518",
  white: "FFFFFF",
  code_bg: "F4F4F4",
} as const;

/** Slide-pixels to inches. pptxgenjs positions in inches. */
export const px = (n: number): number => n / 96;

/** Slide-pixels to points, the way both kits size a font. */
export const fs = (n: number): number => n * 0.75;

export type Align = "left" | "center" | "right";
export type Anchor = "top" | "middle" | "bottom";

export interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: Align;
  anchor?: Anchor;
  font?: string;
  spacing?: number;
}

export interface RectOptions {
  fill?: string | null;
  line?: string | null;
  lineWidth?: number;
  shape?: string;
}

/**
 * One deck, and the handful of verbs that draw on it.
 *
 * A class rather than free functions taking a slide, because pptxgenjs keeps
 * the shape type enum on the presentation instance: `pres.ShapeType.rect` is
 * only reachable once there is a `pres`. The Python kit could pass
 * `MSO_SHAPE.RECTANGLE` around as a module constant; this cannot.
 */
export class Deck {
  readonly pres: any;
  private readonly gen: any;

  constructor() {
    this.gen = loadPptxgen();
    this.pres = new this.gen();
    // Before any slide is added, or every coordinate below is measured against
    // the wrong page.
    this.pres.defineLayout({ name: "DECK_KIT", width: px(W), height: px(H) });
    this.pres.layout = "DECK_KIT";
  }

  /** A slide with nothing on it — `prs.slide_layouts[6]` in the Python kit. */
  blank(): any {
    return this.pres.addSlide();
  }

  /** A filled or outlined box. `fill: null` means no fill, as in the original. */
  rect(
    slide: any,
    left: number,
    top: number,
    width: number,
    height: number,
    options: RectOptions = {},
  ): void {
    const shape = options.shape ?? this.pres.ShapeType.rect;
    const draw: Record<string, unknown> = {
      x: px(left),
      y: px(top),
      w: px(width),
      h: px(height),
    };
    draw.fill = options.fill == null ? { type: "none" } : { color: options.fill };
    draw.line =
      options.line == null
        ? { type: "none" }
        : { color: options.line, width: fs(options.lineWidth ?? 1) };
    slide.addShape(shape, draw);
  }

  /** A right-pointing arrow, defaulting to the second accent. */
  arrow(
    slide: any,
    left: number,
    top: number,
    width: number,
    height: number,
    options: { fill?: string; shape?: string } = {},
  ): void {
    this.rect(slide, left, top, width, height, {
      fill: options.fill ?? C.accent2,
      shape: options.shape ?? this.pres.ShapeType.rightArrow,
    });
  }

  /**
   * A text box. A string is split on newlines; a list is taken as given.
   *
   * Every line is its own paragraph with its own spacing, which is what the
   * Python kit does by calling `add_paragraph` per line rather than putting
   * newlines in one run.
   */
  text(
    slide: any,
    body: string | string[],
    left: number,
    top: number,
    width: number,
    height: number,
    options: TextOptions = {},
  ): void {
    const lines = typeof body === "string" ? body.split("\n") : [...body];
    const runs = lines.map((line, index) => ({
      text: line,
      options: { breakLine: index < lines.length - 1 },
    }));
    slide.addText(runs, {
      x: px(left),
      y: px(top),
      w: px(width),
      h: px(height),
      fontSize: fs(options.size ?? 24),
      bold: options.bold ?? false,
      color: options.color ?? C.ink,
      fontFace: options.font ?? "Arial",
      align: options.align ?? "left",
      valign: options.anchor ?? "top",
      lineSpacingMultiple: options.spacing ?? 1.0,
      // The Python kit zeroes all four margins; pptxgenjs takes one number for
      // all four, and 0 is the same statement.
      margin: 0,
      wrap: true,
    });
  }

  /**
   * Bulleted lines.
   *
   * The bullet is a literal `•` and two spaces, not the format's own bullet
   * property — copied from the Python kit deliberately, because the two do not
   * indent identically and a deck half in each would show it.
   */
  bullets(
    slide: any,
    items: string[],
    left: number,
    top: number,
    width: number,
    height: number,
    options: { size?: number; color?: string; spacing?: number } = {},
  ): void {
    this.text(
      slide,
      items.map((item) => `•  ${item}`),
      left,
      top,
      width,
      height,
      { size: options.size ?? 25, color: options.color, spacing: options.spacing ?? 1.35 },
    );
  }

  /** A monospaced block on its own panel. */
  code(
    slide: any,
    body: string | string[],
    left: number,
    top: number,
    width: number,
    height: number,
    options: { size?: number } = {},
  ): void {
    this.rect(slide, left, top, width, height, { fill: C.code_bg, line: C.line });
    this.text(slide, body, left + 22, top + 16, width - 44, height - 32, {
      size: options.size ?? 22,
      font: "Consolas",
      spacing: 1.25,
    });
  }

  /** The furniture every content slide carries: banner, section, title, rule, page. */
  chrome(slide: any, title: string, page: number | string, section: string): void {
    this.rect(slide, 0, 0, W, 24, { fill: C.draft });
    this.text(slide, "DRAFT · NOT APPROVED", 42, 3, 300, 18, {
      size: 13,
      bold: true,
      color: C.white,
      anchor: "middle",
    });
    this.text(slide, section, 42, 40, 500, 26, { size: 15, bold: true, color: C.muted });
    this.text(slide, title, 42, 70, 1188, 72, { size: 47, bold: true });
    this.rect(slide, 42, 154, 1196, 1, { fill: C.line });
    this.text(slide, String(page), 1120, 676, 116, 20, {
      size: 13,
      color: C.muted,
      align: "right",
    });
  }

  /**
   * Speaker notes, headed `[Sources]`.
   *
   * The default is not a placeholder to be filled in later — it is the claim
   * that this slide asserts nothing it did not derive itself, which is a
   * different statement from having forgotten to cite.
   */
  notes(slide: any, lines?: string[]): void {
    const body = lines?.length
      ? lines
      : ["Course-authored draft source; no external source on this slide."];
    slide.addNotes(["[Sources]", ...body.map((line) => `- ${line}`)].join("\n"));
  }

  /** A table with a dark header row. `values[0]` is that header. */
  table(
    slide: any,
    values: (string | number)[][],
    left: number,
    top: number,
    width: number,
    height: number,
    colWidths: number[],
    options: {
      headSize?: number;
      bodySize?: number;
      firstColBold?: boolean;
      monoCols?: number[];
    } = {},
  ): void {
    const headSize = options.headSize ?? 18;
    const bodySize = options.bodySize ?? 17;
    const mono = new Set(options.monoCols ?? []);
    const rowHeight = height / values.length;

    const rows = values.map((row, r) =>
      row.map((value, c) => ({
        text: String(value),
        options: {
          fontFace: r > 0 && mono.has(c) ? "Consolas" : "Arial",
          fontSize: fs(r === 0 ? headSize : bodySize),
          bold: r === 0 || (options.firstColBold === true && c === 0),
          color: r === 0 ? C.white : C.ink,
          fill: { color: r === 0 ? C.ink : C.white },
          valign: "middle",
        },
      })),
    );

    slide.addTable(rows, {
      x: px(left),
      y: px(top),
      w: px(width),
      colW: colWidths.map(px),
      rowH: px(rowHeight),
      // 10 slide-pixels left and right, 2 top and bottom, as the Python kit
      // sets per cell. pptxgenjs takes points, in [top, right, bottom, left].
      margin: [fs(2), fs(10), fs(2), fs(10)],
      border: { type: "solid", color: C.line, pt: 1 },
      autoPage: false,
    });
  }

  /** Write the deck. Returns the path pptxgenjs reports. */
  async write(file: string): Promise<string> {
    await this.pres.writeFile({ fileName: file });
    return file;
  }
}
