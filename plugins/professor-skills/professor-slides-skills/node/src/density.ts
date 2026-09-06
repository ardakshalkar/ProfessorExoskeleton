/**
 * Does the slide keep the promise its archetype made?
 *
 * The plan says what each slide is — `roadmap`, `worked_example`, `question` —
 * and every archetype carries a density band and a set of text roles. Until
 * this file existed, nothing ever compared that declaration against the
 * markdown. A slide could be planned `roadmap` (sparse, headline and labels)
 * and ship five paragraphs, and `pres check` would say "No problems found."
 *
 * That is the exact shape of the defect this catches, found by reading a real
 * deck: slide 2 planned as a roadmap, seventy-eight words of prose, no picture,
 * and every sentence *about* an artifact that could have been shown instead —
 * on the slide immediately before one that did show it, correctly, in the same
 * deck. Nothing was broken. Everything checked. The slide was still wrong.
 *
 * Two things are measured, and only what the archetype itself declares:
 *
 *   **the band**  words carried as prose, against `DENSITY[archetype.density]`
 *   **the roles** paragraphs of explanation where the archetype asked for labels
 *
 * Both are warnings, never errors. The bands are documented as generation
 * defaults rather than limits — density is intrinsic to some content, and a
 * derivation is dense because derivations are — so this reports and the
 * professor decides. What it must not do is stay quiet.
 */

import { ARCHETYPES, DENSITY, type Density } from "./archetypes.ts";
import { plain, type Block } from "./deck.ts";
import type { DeckPlan, Problem } from "./plan.ts";

/**
 * How far past the band's top a slide may go before it is worth saying.
 *
 * The bands overlap deliberately and their upper edge is a soft one, so warning
 * at the exact number would fire on slides nobody would call overfull. Half
 * again is the point where a `sparse` slide has stopped being sparse in any
 * sense a reader would recognise: 25 words becomes 38, which is already two
 * full sentences more than "a question, a claim, an artifact with its label".
 */
const SLACK = 1.5;

/** A paragraph long enough to be explaining rather than labelling. */
const PROSE_WORDS = 12;

/** The roles that mean "this archetype expects continuous prose". */
const PROSE_ROLES = new Set(["explanation", "evidence", "claim", "question", "instruction"]);

const words = (text: string): number => {
  const stripped = plain(text).trim();
  return stripped ? stripped.split(/\s+/).length : 0;
};

/**
 * The words a slide asks the audience to *read*, and the long paragraphs.
 *
 * Code, tables, formulas and alt text are excluded. They are objects, not
 * prose: a code block is dense because the code is, and counting it would tell
 * a programming lecture it talks too much for containing programs. The slide's
 * own title is excluded for the same reason — every slide has one.
 */
export function measureText(blocks: Block[]): { words: number; paragraphs: number } {
  let total = 0;
  let paragraphs = 0;
  let firstHeading = true;
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
        // The first heading is the slide title, which the renderer draws as the
        // title. A second one is a sub-heading, and it is text on the slide.
        if (firstHeading) firstHeading = false;
        else total += words(block.text);
        break;
      case "paragraph":
      case "quote": {
        const count = words(block.text);
        total += count;
        if (count >= PROSE_WORDS) paragraphs += 1;
        break;
      }
      case "list":
        for (const item of block.items) {
          const count = words(item);
          total += count;
          if (count >= PROSE_WORDS) paragraphs += 1;
        }
        break;
      default:
        break;
    }
  }
  return { words: total, paragraphs };
}

/**
 * Every slide carrying more text than the archetype it was planned as.
 *
 * Silent for a slide with no archetype, or one naming an archetype the
 * vocabulary does not have — `pres outline check` already reports that, and
 * two complaints about one typo is one too many.
 */
export function checkDensity(slides: Block[][], plan: DeckPlan): Problem[] {
  const problems: Problem[] = [];

  for (const spec of plan.slides ?? []) {
    // Not the title slide. It is composed rather than flowed, its shape is a
    // kicker, a title and one sentence by design, and the renderer already
    // warns when it carries more. Measuring it here says a correct title slide
    // is overfull, which teaches the professor to ignore the warning.
    if (spec.number === 1) continue;
    // Not a guessed archetype either. `pres plan build` infers one for a deck
    // with no outline, from the shape of the markdown, so the renderer can set a
    // question slide as a question — but measuring the slide against a guess
    // produces a warning about the guess, and a professor who reads one of those
    // learns to ignore the rest. A declared archetype is a promise; an inferred
    // one is a convenience.
    if (spec.archetype_source === "inferred") continue;
    const archetype = spec.archetype ? ARCHETYPES[spec.archetype] : undefined;
    if (!archetype) continue;
    const blocks = slides[spec.number - 1];
    if (!blocks) continue;

    // A slide may declare its own band, and when it does that is the promise
    // to measure against. The archetype's density is a default for generation,
    // not a ceiling on what the professor is allowed to plan — an exit ticket
    // carrying four questions is a dense `activity` on purpose, and it says so
    // in the outline. Overriding it is an explicit, recorded decision; the
    // silence that follows is the decision being honoured, not a check evaded.
    const declared = spec.density as Density | undefined;
    const band = (declared && DENSITY[declared]) || DENSITY[archetype.density];
    const named = (declared && DENSITY[declared]) ? declared : archetype.density;
    const measured = measureText(blocks);
    const ceiling = Math.round(band.words[1] * SLACK);
    if (measured.words <= ceiling) continue;

    // Whether the archetype wanted prose at all changes what the professor
    // should do about it, so it changes the sentence.
    const wantsProse = archetype.roles.some((role) => PROSE_ROLES.has(role));
    const drawn = blocks.some((block) => block.kind === "image");

    const remedy = wantsProse
      ? "Cut it, or split it: past this much text the audience is reading instead of listening."
      : `A ${spec.archetype} carries ${archetype.roles.join(" and ")} text — the words label the ` +
        "picture, they do not replace it. If the sentences are the slide, either draw what they " +
        "describe and let them become labels, or plan the slide as the archetype it actually is.";

    problems.push({
      severity: "warning",
      message:
        `slide ${spec.number} is planned '${spec.archetype}' (${named}: ` +
        `${band.words[0]}–${band.words[1]} words) and carries ${measured.words}` +
        (measured.paragraphs > 1 ? ` in ${measured.paragraphs} paragraphs` : "") +
        (drawn ? ", alongside its figure" : ", with nothing drawn") +
        `.\n  ${remedy}`,
    });
  }

  return problems;
}
