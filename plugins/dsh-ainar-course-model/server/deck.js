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
/**
 * Front matter, then everything between the `---` rules, is one slide each.
 *
 * Marp's own convention, so the same file is a deck in a Marp previewer and a
 * deck here.
 */
export function splitSlides(markdown) {
    const text = markdown.replace(/\r\n/g, "\n");
    const closing = text.startsWith("---\n") ? text.indexOf("\n---\n", 3) : -1;
    const body = closing >= 0 ? text.slice(closing + 5) : text;
    return body
        .split(/\n---\n/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}
export function parseBlocks(slide) {
    const lines = slide.split("\n");
    const blocks = [];
    const paragraph = [];
    let index = 0;
    const flush = () => {
        if (!paragraph.length)
            return;
        const text = paragraph.join(" ").trim();
        paragraph.length = 0;
        if (!text)
            return;
        // An image's alt text wraps across lines in the source, so match the joined
        // paragraph rather than any single line of it.
        const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(text);
        if (image)
            blocks.push({ kind: "image", alt: image[1].replace(/\s+/g, " "), src: image[2] });
        else
            blocks.push({ kind: "paragraph", text });
    };
    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
            flush();
            index += 1;
            continue;
        }
        if (line.startsWith("```")) {
            flush();
            const code = [];
            index += 1;
            while (index < lines.length && !lines[index].startsWith("```")) {
                code.push(lines[index]);
                index += 1;
            }
            index += 1; // the closing fence
            blocks.push({ kind: "code", text: code.join("\n") });
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            flush();
            blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
            index += 1;
            continue;
        }
        if (line.startsWith("|")) {
            flush();
            const rows = [];
            while (index < lines.length && lines[index].startsWith("|")) {
                const cells = lines[index].split("|").slice(1, -1).map((cell) => cell.trim());
                if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell)))
                    rows.push(cells);
                index += 1;
            }
            blocks.push({ kind: "table", rows });
            continue;
        }
        if (line.startsWith(">")) {
            flush();
            const quote = [];
            while (index < lines.length && lines[index].startsWith(">")) {
                quote.push(lines[index].replace(/^>\s?/, ""));
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
            const items = [];
            while (index < lines.length) {
                const current = lines[index];
                const next = ordered ? /^\d+\.\s+(.*)$/.exec(current) : /^[-*]\s+(.*)$/.exec(current);
                if (next) {
                    items.push(next[1].trim());
                    index += 1;
                }
                else if (/^\s{2,}\S/.test(current) && items.length) {
                    items[items.length - 1] += ` ${current.trim()}`; // a wrapped item
                    index += 1;
                }
                else
                    break;
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
export const plain = (text) => text.replace(/\*\*|`/g, "");
/** The title a slide shows: its first heading, or failing that its first line. */
export function slideTitle(blocks) {
    for (const block of blocks) {
        if (block.kind === "heading")
            return block.text;
    }
    for (const block of blocks) {
        if (block.kind === "paragraph")
            return plain(block.text);
    }
    return "";
}
const normalise = (value) => plain(value).toLowerCase().replace(/[\s ]+/g, " ").trim();
/**
 * Where the plan and the markdown disagree — empty when they do not.
 *
 * Deliberately no tolerance and no repair. A plan that no longer matches its
 * deck means one of the two was edited after the other, and which one is wrong
 * is the professor's question, not a renderer's.
 */
export function checkContract(slides, plan) {
    const problems = [];
    const planned = [...plan.slides].sort((a, b) => a.number - b.number);
    if (planned.length !== slides.length) {
        problems.push(`the plan has ${planned.length} slide(s), the markdown has ${slides.length}`);
    }
    const shared = Math.min(planned.length, slides.length);
    for (let index = 0; index < shared; index += 1) {
        const expected = planned[index].title;
        const actual = slideTitle(slides[index]);
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
export function creditFor(document, src) {
    const source = document?.extensions?.image_source;
    if (source) {
        const credit = String(source.attribution ?? "").trim();
        if (!credit) {
            throw new Error(`${src} records a source (${source.source_url ?? source.provider ?? "unknown"}) but no ` +
                "attribution.\nThe licence is a condition of using it — add " +
                "extensions.image_source.attribution\nto its Document, or take the picture off the slide.");
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
export function textHeight(text, fontSize, width, lineFactor = 1.35) {
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
export function columnWidths(rows, total) {
    const columns = rows[0]?.length ?? 0;
    if (!columns)
        return [];
    const weights = new Array(columns).fill(0).map((_, column) => Math.max(6, ...rows.map((row) => plain(row[column] ?? "").length)));
    const floor = total / (columns * 2.5); // no column below 40% of an even share
    // Clamping and then rescaling would push a clamped column back under its
    // floor, so the short columns are pinned and only the rest share what is left.
    const widths = new Array(columns).fill(0);
    const pinned = new Set();
    for (let pass = 0; pass <= columns; pass += 1) {
        const free = weights.map((_, column) => column).filter((column) => !pinned.has(column));
        const remaining = total - pinned.size * floor;
        const freeWeight = free.reduce((sum, column) => sum + weights[column], 0) || 1;
        let pinnedThisPass = false;
        for (const column of free) {
            widths[column] = (weights[column] / freeWeight) * remaining;
            if (widths[column] < floor) {
                pinned.add(column);
                pinnedThisPass = true;
            }
        }
        for (const column of pinned)
            widths[column] = floor;
        if (!pinnedThisPass)
            break;
    }
    return widths;
}
