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

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] }
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
    if (image) blocks.push({ kind: "image", alt: image[1]!.replace(/\s+/g, " "), src: image[2]! });
    else blocks.push({ kind: "paragraph", text });
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

/** Inline markers stripped, for comparing and for text that carries no runs. */
export const plain = (text: string): string => text.replace(/\*\*|`/g, "");

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
 * Roughly how tall wrapped text will be, in inches.
 *
 * An estimate, not a measurement: the fonts are rendered by PowerPoint, not
 * here. It only flows blocks down the slide and warns when one runs past the
 * bottom margin, so erring tall is the safe direction.
 */
export function textHeight(text: string, fontSize: number, width: number, lineFactor = 1.35): number {
  const perLine = Math.max(8, Math.floor((width * 96) / (fontSize * 0.52)));
  const lines = text
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return (lines * fontSize * lineFactor) / 72;
}

/**
 * Column widths proportional to the longest cell in each column.
 *
 * Equal thirds put "Prefer" and "Accuracy misleads because" in the same width,
 * which wraps one and leaves the other half empty. Clamped so a single long
 * cell cannot squeeze its neighbours to nothing.
 */
export function columnWidths(rows: string[][], total: number): number[] {
  const columns = rows[0]?.length ?? 0;
  if (!columns) return [];
  const weights = new Array(columns).fill(0).map((_, column) =>
    Math.max(6, ...rows.map((row) => plain(row[column] ?? "").length)),
  );
  const floor = total / (columns * 2.5); // no column below 40% of an even share

  // Clamping and then rescaling would push a clamped column back under its
  // floor, so the short columns are pinned and only the rest share what is left.
  const widths = new Array<number>(columns).fill(0);
  const pinned = new Set<number>();
  for (let pass = 0; pass <= columns; pass += 1) {
    const free = weights.map((_, column) => column).filter((column) => !pinned.has(column));
    const remaining = total - pinned.size * floor;
    const freeWeight = free.reduce((sum, column) => sum + weights[column]!, 0) || 1;
    let pinnedThisPass = false;
    for (const column of free) {
      widths[column] = (weights[column]! / freeWeight) * remaining;
      if (widths[column]! < floor) {
        pinned.add(column);
        pinnedThisPass = true;
      }
    }
    for (const column of pinned) widths[column] = floor;
    if (!pinnedThisPass) break;
  }
  return widths;
}

/**
 * The slide, in inches, and how far down a block pushes the next one.
 *
 * These were constants inside `bin/render-deck.ts`, which meant the only way to
 * answer "will this fit" was to read the renderer and do its arithmetic by
 * hand. An agent did exactly that on 2026-09-06 — "let me read the exact
 * textHeight formula so I can compute what actually fits" — and arithmetic done
 * in a model's head is expensive, unverifiable, and wrong the moment a font
 * size changes here.
 *
 * So the measuring is a function, the renderer calls it for its own heights,
 * and `ainar deck fit` calls the same one. They cannot disagree: there is one
 * copy of the numbers and both sides read it.
 *
 * It is still an ESTIMATE. PowerPoint renders the fonts, not this, and
 * `textHeight` says as much. Erring tall is the safe direction.
 */
export const LAYOUT = {
  slideWidth: 13.33,
  slideHeight: 7.5,
  margin: 0.7,
  /** The bottom margin, enforced rather than hoped for. */
  floor: 7.5 - 0.5,
  /** Where the first block of an ordinary slide starts. */
  start: 1.6,
  /** Where the first block of the title slide starts. */
  titleStart: 1.9,
  /** Between one block and the next, unless the block says otherwise. */
  gap: 0.3,
  tableRowHeight: 0.62,
} as const;

export const CONTENT_WIDTH = LAYOUT.slideWidth - LAYOUT.margin * 2;

/**
 * How tall one block is, and how much space follows it.
 *
 * `heading` at level 2 or more is the section rule: the renderer draws it at a
 * fixed y and resets the cursor, so it consumes no flow height and instead
 * *restarts* the column. That is why the return carries `resets` rather than a
 * height — a measurer that treated it as height would report every sectioned
 * slide as overflowing.
 *
 * An image is the one kind whose height depends on the file, which this cannot
 * read. It is reported as `unknown`, and the renderer's own rule — shrink to
 * the space left — means such a slide never overflows on the image's account.
 */
export function blockHeight(
  block: Block,
  options: { title?: boolean; cursor?: number } = {},
): { height: number; gap: number; resets?: number; unknown?: boolean } {
  const cursor = options.cursor ?? LAYOUT.start;
  if (options.title) {
    if (block.kind === "heading") return { height: textHeight(block.text, 46, 9.0, 1.15), gap: LAYOUT.gap };
    if (block.kind === "paragraph") return { height: textHeight(block.text, 16, 10.0), gap: LAYOUT.gap };
  }
  switch (block.kind) {
    case "heading":
      // Drawn at a fixed y; the column starts again beneath it.
      return { height: 0, gap: 0, resets: LAYOUT.start };
    case "paragraph":
      return { height: textHeight(block.text, 17, CONTENT_WIDTH), gap: LAYOUT.gap };
    case "quote":
      return { height: textHeight(block.text, 15, CONTENT_WIDTH - 0.6) + 0.4, gap: LAYOUT.gap };
    case "code":
      return { height: textHeight(block.text, 18, 5.4, 1.4) + 0.4, gap: LAYOUT.gap };
    case "list":
      return {
        height:
          block.items.reduce((total, item) => total + textHeight(item, 17, CONTENT_WIDTH - 0.6), 0) +
          block.items.length * 0.16,
        gap: LAYOUT.gap,
      };
    case "table":
      return { height: block.rows.length * LAYOUT.tableRowHeight, gap: 0.35 };
    case "image":
      // Shrunk to what is left, so it fills the rest and never overruns.
      return { height: Math.max(0, LAYOUT.floor - cursor), gap: LAYOUT.gap, unknown: true };
    default:
      return { height: 0, gap: 0 };
  }
}

export type Measured = {
  /** 1-based, as a person counts slides. */
  slide: number;
  title: string;
  bottom: number;
  floor: number;
  overflow: number;
  fits: boolean;
  /** True when an image made the answer a guess rather than an estimate. */
  approximate: boolean;
  blocks: { kind: string; at: number; height: number; text: string }[];
};

/** Flow one slide's blocks down the page and say where the last one ends. */
export function measureSlide(blocks: Block[], index = 0): Measured {
  const isTitle = index === 0 && blocks[0]?.kind === "heading" && blocks[0].level === 1;
  let cursor: number = isTitle ? LAYOUT.titleStart : LAYOUT.start;
  let bottom = cursor;
  let approximate = false;
  const rows: Measured["blocks"] = [];

  for (const block of blocks) {
    const measure = blockHeight(block, { title: isTitle, cursor });
    if (measure.resets !== undefined) {
      cursor = measure.resets;
      bottom = cursor;
      rows.push({ kind: block.kind, at: 0.45, height: 0.8, text: slideTitle([block]) });
      continue;
    }
    if (measure.unknown) approximate = true;
    rows.push({
      kind: block.kind,
      at: Number(cursor.toFixed(2)),
      height: Number(measure.height.toFixed(2)),
      text: (block as any).text ?? (block as any).alt ?? `${(block as any).items?.length ?? (block as any).rows?.length ?? 0} rows`,
    });
    bottom = cursor + measure.height;
    cursor = bottom + measure.gap;
  }

  const over = bottom - LAYOUT.floor;
  return {
    slide: index + 1,
    title: slideTitle(blocks),
    bottom: Number(bottom.toFixed(2)),
    floor: LAYOUT.floor,
    overflow: Number(Math.max(0, over).toFixed(2)),
    fits: over <= 0,
    approximate,
    blocks: rows,
  };
}

/** Every slide in a markdown deck, measured. */
export function measureDeck(markdown: string): Measured[] {
  return splitSlides(markdown).map((slide, index) => measureSlide(parseBlocks(slide), index));
}
