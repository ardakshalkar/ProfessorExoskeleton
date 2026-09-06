/**
 * Slide markdown, and the contract between a deck and its plan.
 *
 * The parsing and the checking live here rather than in `bin/render-deck.ts`
 * because they are the part with opinions: what counts as a slide, what a
 * slide's title is, and when a `presentation_plan` no longer describes the
 * markdown it was written for. The binary does I/O and calls pptxgenjs, which
 * is not worth a test; this is.
 *
 * Nothing here touches the filesystem or the model — it takes strings and a
 * plain plan object, so `test/deck.test.ts` can exercise every branch without a
 * course on disk.
 */

import { convertInline, displayMath, latexToUnicode } from "./math.ts";

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "math"; text: string; source: string; unconverted: string[] }
  | { kind: "image"; alt: string; src: string };

/** One planned slide, as much of `SlideSpecification` as the check needs. */
export type PlannedSlide = {
  number: number;
  title: string;
  minutes?: number | null;
  purpose?: string | null;
};

export type Plan = {
  slides: PlannedSlide[];
  max_slides?: number | null;
};

/**
 * Front matter, then everything between the `---` rules, is one slide each.
 *
 * Marp's own convention, so the same file is a deck in a Marp previewer and a
 * deck here.
 */
export function splitSlides(markdown: string): string[] {
  const text = markdown.replace(/\r\n/g, "\n");
  const closing = text.startsWith("---\n") ? text.indexOf("\n---\n", 3) : -1;
  const body = closing >= 0 ? text.slice(closing + 5) : text;
  return body
    .split(/\n---\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function parseBlocks(slide: string): Block[] {
  const lines = slide.split("\n");
  const blocks: Block[] = [];
  const paragraph: string[] = [];
  let index = 0;

  const flush = (): void => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    paragraph.length = 0;
    if (!text) return;
    // An image's alt text wraps across lines in the source, so match the joined
    // paragraph rather than any single line of it.
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(text);
    if (image) {
      blocks.push({ kind: "image", alt: image[1]!.replace(/\s+/g, " "), src: image[2]! });
      return;
    }
    // A paragraph that is nothing but display maths becomes a block of its own,
    // so the renderer can centre it and set it larger than body copy.
    const display = displayMath(text);
    if (display !== null) {
      const converted = latexToUnicode(display);
      blocks.push({
        kind: "math",
        text: converted.text,
        source: display,
        unconverted: converted.unconverted,
      });
      return;
    }
    // Inline maths is converted where it stands, so `\(x_1\)` reads as x₁ in
    // the middle of a sentence rather than as its own source code.
    const inline = convertInline(text);
    blocks.push({ kind: "paragraph", text: inline.text });
  };

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      flush();
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.startsWith("```")) {
        code.push(lines[index]!);
        index += 1;
      }
      index += 1; // the closing fence
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (index < lines.length && lines[index]!.startsWith("|")) {
        const cells = lines[index]!.split("|").slice(1, -1).map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      blocks.push({ kind: "table", rows });
      continue;
    }

    if (line.startsWith(">")) {
      flush();
      const quote: string[] = [];
      while (index < lines.length && lines[index]!.startsWith(">")) {
        quote.push(lines[index]!.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ").replace(/\s+/g, " ").trim() });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index]!;
        const next = ordered ? /^\d+\.\s+(.*)$/.exec(current) : /^[-*]\s+(.*)$/.exec(current);
        if (next) {
          items.push(next[1]!.trim());
          index += 1;
        } else if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`; // a wrapped item
          index += 1;
        } else break;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  flush();
  return blocks;
}

/**
 * Inline markers stripped, for comparing and for text that carries no runs.
 *
 * Paired markers only. The parent's version stripped every `**` and backtick it
 * found, which also ate a lone asterisk in `2 * 3`; matching pairs leaves that
 * alone and removes emphasis wherever it really is emphasis.
 */
export const plain = (text: string): string =>
  unescape(
    text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1"),
  );

/**
 * Markdown backslash escapes, resolved.
 *
 * A footnote marker written `0.75\*` is an author saying "a literal asterisk,
 * not emphasis". Leaving the backslash in placed it on the slide, where in a
 * table of prices it reads as a typo rather than as a footnote.
 */
export const unescape = (text: string): string =>
  text.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1");

/** The title a slide shows: its first heading, or failing that its first line. */
export function slideTitle(blocks: Block[]): string {
  for (const block of blocks) {
    if (block.kind === "heading") return block.text;
  }
  for (const block of blocks) {
    if (block.kind === "paragraph") return plain(block.text);
  }
  return "";
}

const normalise = (value: string): string =>
  plain(value).toLowerCase().replace(/[\s ]+/g, " ").trim();

/**
 * Where the plan and the markdown disagree — empty when they do not.
 *
 * Deliberately no tolerance and no repair. A plan that no longer matches its
 * deck means one of the two was edited after the other, and which one is wrong
 * is the professor's question, not a renderer's.
 */
export function checkContract(slides: Block[][], plan: Plan): string[] {
  const problems: string[] = [];
  const planned = [...plan.slides].sort((a, b) => a.number - b.number);

  if (planned.length !== slides.length) {
    problems.push(`the plan has ${planned.length} slide(s), the markdown has ${slides.length}`);
  }
  const shared = Math.min(planned.length, slides.length);
  for (let index = 0; index < shared; index += 1) {
    const expected = planned[index]!.title;
    const actual = slideTitle(slides[index]!);
    if (normalise(expected) !== normalise(actual)) {
      problems.push(`slide ${index + 1}: the plan says "${expected}", the markdown says "${actual}"`);
    }
  }
  if (plan.max_slides && slides.length > plan.max_slides) {
    problems.push(`${slides.length} slides, but the plan allows ${plan.max_slides}`);
  }
  return problems;
}

/**
 * The credit a picture must carry on the slide, or null when it needs none.
 *
 * A figure drawn in this repository needs nothing. One found through
 * `find-image` carries `extensions.image_source`, and a Creative Commons licence
 * that requires attribution is not satisfied by a note in someone's memory — so
 * a document claiming a source without an attribution line stops the render
 * rather than producing a deck that infringes quietly.
 *
 * A generated illustration is labelled as generated, for the same reason its alt
 * text says so: a picture is read as evidence unless it says otherwise, and the
 * one on the screen behind a lecturer is read hardest.
 */
export function creditFor(document: any, src: string): string | null {
  const source = document?.extensions?.image_source;
  if (source) {
    const credit = String(source.attribution ?? "").trim();
    if (!credit) {
      throw new Error(
        `${src} records a source (${source.source_url ?? source.provider ?? "unknown"}) but no ` +
        "attribution.\nThe licence is a condition of using it — add " +
        "extensions.image_source.attribution\nto its Document, or take the picture off the slide.",
      );
    }
    return credit;
  }
  const prompt = document?.extensions?.image_prompt;
  if (prompt) {
    const model = String(prompt.model ?? "an image model");
    return `Illustration generated with ${model}. Not a photograph or a measurement.`;
  }
  return null;
}

/**
 * How wide one character is, as a fraction of the font size.
 *
 * The proportional default is a blend across the body font. Monospace is
 * genuinely wider — Courier New advances 0.6em for every glyph, narrow ones
 * included — and using the proportional figure for it under-counts the lines in
 * a code block, which is how a code block ends up taller than the panel drawn
 * behind it.
 */
export const CHAR_WIDTH = { proportional: 0.45, mono: 0.57 } as const;

/**
 * How many characters fit on one line of the given width.
 *
 * Font sizes are points and there are 72 points to the inch. The version this
 * was ported from divided by 96 — a pixels-per-inch figure — and compensated
 * with a character width tuned until the body font looked right. That fitted
 * one font and silently mis-measured every other, which is how an 18pt
 * monospace block came to be drawn shorter than the text inside it.
 *
 * The widths are deliberately a few per cent above the true advance (Courier
 * New is exactly 0.6em; Calibri averages about 0.42). Over-estimating costs an
 * overflow warning nobody needed. Under-estimating prints the next block on top
 * of this one, and does it invisibly.
 */
export const charsPerLine = (width: number, fontSize: number, charWidth: number): number =>
  Math.max(4, Math.floor((width * 72) / (fontSize * charWidth)));

/**
 * Roughly how tall wrapped text will be, in inches.
 *
 * An estimate, not a measurement: the fonts are rendered by PowerPoint, not
 * here. It flows blocks down the slide and warns when one runs past the bottom
 * margin, so erring tall is the safe direction — an over-estimate costs a
 * warning nobody needed, an under-estimate costs a slide where two blocks are
 * printed on top of each other.
 */
export function textHeight(
  text: string,
  fontSize: number,
  width: number,
  lineFactor = 1.35,
  charWidth: number = CHAR_WIDTH.proportional,
): number {
  const perLine = charsPerLine(width, fontSize, charWidth);
  const lines = text
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return (lines * fontSize * lineFactor) / 72;
}

/**
 * Padding inside a table cell, both sides, in inches.
 *
 * Generous on purpose. PowerPoint applies its own cell inset on top of whatever
 * the writer asks for, and a column measured to the exact width of its longest
 * word comes out one pixel short and breaks the word anyway.
 */
const CELL_PADDING = 0.34;

/**
 * How much wider bold text is than regular, at the same size.
 *
 * The header row is bold, and measuring it as regular is how "Language" ends up
 * as "Languag / e" — the column is sized for the word it holds in a weight it
 * is not set in.
 */
const BOLD_FACTOR = 1.12;

/**
 * The widest unbreakable word in a column, in inches, with the header row
 * measured as bold.
 */
function widestWord(rows: string[][], column: number, fontSize: number, charWidth: number): number {
  let widest = fontSize * charWidth; // one character, so a column is never zero
  rows.forEach((row, index) => {
    const weight = index === 0 ? BOLD_FACTOR : 1;
    for (const word of plain(row[column] ?? "").split(/\s+/)) {
      widest = Math.max(widest, word.length * fontSize * charWidth * weight);
    }
  });
  return widest / 72;
}

/**
 * Column widths proportional to the longest cell, but never below what the
 * column's longest *word* needs.
 *
 * Proportional alone is not enough, and the failure is ugly rather than subtle.
 * Give six columns one 79-character headline and five short ones, and the
 * headline's weight starves the rest: "Language" comes out as "Langu / age",
 * broken mid-word, because PowerPoint will break inside a word rather than
 * overflow the cell. So each column gets a floor it cannot be pushed under, and
 * only the slack above those floors is shared out by weight.
 *
 * If the floors alone exceed the table width there is nothing to be done — the
 * words do not fit — so they are scaled down together and the caller is left to
 * notice.
 */
export function columnWidths(
  rows: string[][],
  total: number,
  fontSize = 15,
  charWidth: number = CHAR_WIDTH.proportional,
): number[] {
  const columns = rows[0]?.length ?? 0;
  if (!columns) return [];

  const floors = new Array(columns).fill(0).map(
    (_, column) => widestWord(rows, column, fontSize, charWidth) + CELL_PADDING,
  );
  const floorSum = floors.reduce((sum, width) => sum + width, 0);
  if (floorSum >= total) return floors.map((width) => (width / floorSum) * total);

  const weights = new Array(columns).fill(0).map((_, column) =>
    Math.max(6, ...rows.map((row) => plain(row[column] ?? "").length)),
  );

  // Pinning and then rescaling would push a pinned column back under its floor,
  // so pinned columns are fixed and only the rest share what is left.
  const widths = new Array<number>(columns).fill(0);
  const pinned = new Set<number>();
  for (let pass = 0; pass <= columns; pass += 1) {
    const free = weights.map((_, column) => column).filter((column) => !pinned.has(column));
    const remaining = total - [...pinned].reduce((sum, column) => sum + floors[column]!, 0);
    const freeWeight = free.reduce((sum, column) => sum + weights[column]!, 0) || 1;
    let pinnedThisPass = false;
    for (const column of free) {
      widths[column] = (weights[column]! / freeWeight) * remaining;
      if (widths[column]! < floors[column]!) {
        pinned.add(column);
        pinnedThisPass = true;
      }
    }
    for (const column of pinned) widths[column] = floors[column]!;
    if (!pinnedThisPass) break;
  }
  return widths;
}

/**
 * How tall each row will actually be once its cells wrap.
 *
 * A fixed row height is a lie the moment one cell needs two lines: the table
 * grows downwards and whatever the renderer placed under it is overprinted.
 * That is the same class of bug as an under-counted code block, and it is
 * invisible in the markdown.
 */
export function tableRowHeights(
  rows: string[][],
  widths: number[],
  fontSize = 15,
  charWidth: number = CHAR_WIDTH.proportional,
  minimum = 0.62,
): number[] {
  return rows.map((row) => {
    const lines = Math.max(
      1,
      ...row.map((cell, column) => {
        const width = (widths[column] ?? 1) - CELL_PADDING;
        return Math.ceil(plain(cell ?? "").length / charsPerLine(width, fontSize, charWidth));
      }),
    );
    return Math.max(minimum, (lines * fontSize * 1.35) / 72 + CELL_PADDING);
  });
}
