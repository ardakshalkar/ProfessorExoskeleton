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
export type Block = {
    kind: "heading";
    level: number;
    text: string;
} | {
    kind: "paragraph";
    text: string;
} | {
    kind: "quote";
    text: string;
} | {
    kind: "code";
    text: string;
} | {
    kind: "list";
    ordered: boolean;
    items: string[];
} | {
    kind: "table";
    rows: string[][];
} | {
    kind: "image";
    alt: string;
    src: string;
};
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
export declare function splitSlides(markdown: string): string[];
export declare function parseBlocks(slide: string): Block[];
/** Inline markers stripped, for comparing and for text that carries no runs. */
export declare const plain: (text: string) => string;
/** The title a slide shows: its first heading, or failing that its first line. */
export declare function slideTitle(blocks: Block[]): string;
/**
 * Where the plan and the markdown disagree — empty when they do not.
 *
 * Deliberately no tolerance and no repair. A plan that no longer matches its
 * deck means one of the two was edited after the other, and which one is wrong
 * is the professor's question, not a renderer's.
 */
export declare function checkContract(slides: Block[][], plan: Plan): string[];
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
export declare function creditFor(document: any, src: string): string | null;
/**
 * Roughly how tall wrapped text will be, in inches.
 *
 * An estimate, not a measurement: the fonts are rendered by PowerPoint, not
 * here. It only flows blocks down the slide and warns when one runs past the
 * bottom margin, so erring tall is the safe direction.
 */
export declare function textHeight(text: string, fontSize: number, width: number, lineFactor?: number): number;
/**
 * Column widths proportional to the longest cell in each column.
 *
 * Equal thirds put "Prefer" and "Accuracy misleads because" in the same width,
 * which wraps one and leaves the other half empty. Clamped so a single long
 * cell cannot squeeze its neighbours to nothing.
 */
export declare function columnWidths(rows: string[][], total: number): number[];
