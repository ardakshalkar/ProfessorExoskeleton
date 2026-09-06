/**
 * What must be true before a deck is rendered.
 *
 * These run without pptxgenjs, without sharp and without LibreOffice, so a
 * professor can check a deck on a machine that cannot build one — and so the
 * build skill can check its own work before handing over. `pres render` runs
 * the same function; there is one definition of "this deck is renderable" and
 * both paths use it.
 *
 * Every check here is a mistake that was made before it existed. That is the
 * only reason a check is here rather than left to judgement.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkContract, parseBlocks, splitSlides, type Block } from "./deck.ts";
import { checkDensity } from "./density.ts";
import {
  approvalRequired,
  creditForFigure,
  isApproved,
  loadPlan,
  outlineBehind,
  outlinePathFor,
  planPathFor,
  type DeckPlan,
  type Outline,
  type Problem,
} from "./plan.ts";
import { compilePlan } from "./compile.ts";
import { timedSync } from "./timing.ts";

export interface DeckCheck {
  deck: string;
  planPath: string;
  plan: DeckPlan;
  outline: Outline | null;
  slides: Block[][];
  problems: Problem[];
}

const error = (message: string): Problem => ({ severity: "error", message });
const warning = (message: string): Problem => ({ severity: "warning", message });
const note = (message: string): Problem => ({ severity: "note", message });

/**
 * Read a deck and everything that governs it, and say what is wrong.
 *
 * Missing files throw; anything else is a `Problem`, because a caller that
 * wants to print all of them should not be stopped by the first.
 */
export function checkDeck(deckPath: string): DeckCheck {
  if (!existsSync(deckPath)) throw new Error(`${deckPath} does not exist`);
  const planPath = planPathFor(deckPath);
  if (!existsSync(planPath)) {
    throw new Error(
      `${deckPath} has no ${planPath} beside it.\n` +
      "The plan is the render contract: without it nothing checks the deck's structure, the\n" +
      "slides carry no speaker notes, and no figure's licence is enforced. Build the deck with\n" +
      "/build-presentation, which writes both.",
    );
  }

  const plan = loadPlan(planPath);
  const outline = outlineBehind(planPath, plan);
  const slides = splitSlides(readFileSync(deckPath, "utf8")).map(parseBlocks);
  const problems: Problem[] = [];

  if (!slides.length) problems.push(error(`${deckPath} has no slides`));

  // --- the approval gate ---------------------------------------------------
  // In the parent this was "the document must not still be in work/". Here the
  // outline's own status is the record of a professor's decision — but whether
  // that decision is a *condition* of rendering depends on the deck's mode, and
  // the plan says which. See `approvalRequired`.
  //
  // What does not depend on the mode is saying so. A deck nobody reviewed looks
  // identical to one somebody did once it is open in PowerPoint, so every path
  // through here leaves a line in the report.
  const mode = plan.mode ?? "deep (assumed — the plan names no mode)";
  const gated = approvalRequired(plan);

  if (outline) {
    if (isApproved(outline)) {
      problems.push(note(`the outline behind this deck is approved (mode: ${mode})`));
    } else if (gated) {
      problems.push(error(
        `the outline behind this deck is '${outline.status ?? "draft"}', not approved, and this\n` +
        `  deck's mode (${mode}) requires approval before it renders.\n` +
        "  Nobody has agreed to what is in it. Approval is the professor's to give — they set\n" +
        "  status: approved in the outline, or say so explicitly.",
      ));
    } else {
      problems.push(note(
        `built in ${mode} mode from an outline nobody explicitly approved (status: ` +
        `${outline.status ?? "draft"}) — which is what ${mode} mode means: the request for a\n` +
        "  deck was the agreement. Say so when handing the file over.",
      ));
    }
  } else if (gated) {
    problems.push(error(
      `no outline beside ${planPath}, and this deck's mode (${mode}) requires an approved one.\n` +
      "  Either write the outline with /outline-presentation, or rebuild the plan in a mode\n" +
      "  that does not need one: pres plan build DECK.md --mode standard.",
    ));
  } else {
    problems.push(note(
      `built in ${mode} mode with no outline, so nothing records a professor's approval —\n` +
      `  which is what ${mode} mode means. Say so when handing the file over.`,
    ));
  }

  // --- the plan is the contract -------------------------------------------
  // No tolerance and no repair *here*. A plan that no longer matched its deck
  // used to mean an afternoon working out which of the two was edited after the
  // other; now the plan is generated, so a mismatch means it was not
  // regenerated, and the message says the command.
  const mismatches = checkContract(slides, plan);
  for (const mismatch of mismatches) problems.push(error(mismatch));
  if (mismatches.length && plan.generated) {
    problems.push(error(
      "this plan was generated from the deck, and the deck has changed since. Run\n" +
      `  pres plan build ${deckPath}\n` +
      "  — then check that the outline still describes the session. The plan is a projection,\n" +
      "  so what a mismatch really asks is whether the *deck* is still what was agreed to.",
    ));
  }

  // --- the generated plan is stale ----------------------------------------
  // The contract check compares count, order and title. A generated plan can be
  // out of date in ways that check cannot see: a figure added to a slide, a
  // minutes field changed in the outline. Recompiling costs one parse of a file
  // already read, and a stale plan is how a figure ends up on a slide with
  // nothing checking its licence.
  if (plan.generated) {
    try {
      const fresh = timedSync("plan freshness", () =>
        compilePlan(deckPath, readFileSync(deckPath, "utf8"), {
          outline,
          ...(outline ? { outlinePath: outlinePathFor(deckPath) } : {}),
          existing: plan,
          ...(plan.mode ? { mode: plan.mode } : {}),
          infer: !outline,
        }));
      if (fresh.changed) {
        problems.push(warning(
          "the generated plan is out of date — the deck or the outline changed after it was " +
          `built. Run: pres plan build ${deckPath}`,
        ));
      }
    } catch {
      // A deck that cannot be recompiled has a real problem, and every other
      // check in this function is better placed to name it.
    }
  }

  // --- mathematics that did not convert ------------------------------------
  // A formula is read as authoritative and nobody proofreads the projector, so
  // a half-converted one is worse than none at all. This is an error rather
  // than a warning for that reason: the deck does not build until the professor
  // either simplifies the expression or draws it as a figure.
  for (const [index, blocks] of slides.entries()) {
    for (const block of blocks) {
      if (block.kind !== "math" || !block.unconverted.length) continue;
      problems.push(error(
        `slide ${index + 1}: ${block.unconverted.join(", ")} has no text equivalent, so the formula ` +
        `would go up mangled.\n  Source: ${block.source}\n  Either write it in a form Unicode can ` +
        "set, or draw it as a figure and link it like any other picture.",
      ));
    }
  }

  // --- emphasis that will not survive the render ---------------------------
  // PowerPoint can hold a bold word inside a bulleted line; pptxgenjs cannot
  // write one without losing the bullet (see the list case in `render.ts`), so
  // the renderer drops the emphasis and keeps the bullet. Naming it here is the
  // difference between a decision and a surprise.
  for (const [index, blocks] of slides.entries()) {
    for (const block of blocks) {
      if (block.kind !== "list") continue;
      const emphasised = block.items.filter((item) => /\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`/.test(item));
      if (emphasised.length) {
        problems.push(warning(
          `slide ${index + 1}: ${emphasised.length} list item(s) use bold, italic or code, which renders ` +
          "as plain text — a bulleted line cannot carry both a bullet and mixed formatting. Move the " +
          "emphasis into a paragraph, or accept the plain rendering.",
        ));
      }
    }
  }

  // --- the archetype the slide was planned as -----------------------------
  // The plan declares a density band and a set of text roles for every slide,
  // and until this ran nothing compared either against the markdown. A slide
  // could be planned sparse and ship five paragraphs, and the deck built clean.
  problems.push(...timedSync("density", () => checkDensity(slides, plan)));

  // --- figures -------------------------------------------------------------
  const materialsDir = dirname(deckPath);
  const figures = plan.figures ?? {};
  const used = new Set<string>();

  for (const [index, blocks] of slides.entries()) {
    for (const block of blocks) {
      if (block.kind !== "image") continue;
      used.add(block.src);
      if (!existsSync(join(materialsDir, block.src))) {
        problems.push(error(`slide ${index + 1}: ${block.src} is linked but not beside the deck`));
      }
      if (block.src.includes("/") || block.src.includes("\\")) {
        problems.push(error(
          `slide ${index + 1}: ${block.src} is not a sibling path. Figures live flat beside the deck; ` +
          "a subdirectory link breaks silently in a deck nobody opens until the lecture.",
        ));
      }
      if (!block.alt.trim()) {
        problems.push(error(
          `slide ${index + 1}: ${block.src} has no alt text. Slides are read by people who cannot see them.`,
        ));
      }
      try {
        creditForFigure(figures[block.src], block.src);
      } catch (failure) {
        problems.push(error(String((failure as Error).message ?? failure)));
      }
    }
  }

  for (const name of Object.keys(figures)) {
    if (!used.has(name)) {
      problems.push(warning(`the plan records figure ${name}, but no slide links it`));
    }
  }

  // --- visuals the outline asked for and the deck does not have ------------
  for (const slide of plan.slides ?? []) {
    if (!slide.required_visual) continue;
    const blocks = slides[slide.number - 1] ?? [];
    if (!blocks.some((block) => block.kind === "image")) {
      problems.push(warning(
        `slide ${slide.number} was planned with a visual ("${slide.required_visual}") and has none. ` +
        "Either draw it, record the prompt that would produce it, or take the requirement off the plan.",
      ));
    }
  }

  return { deck: deckPath, planPath, plan, outline, slides, problems };
}

export const errorsIn = (problems: Problem[]): Problem[] =>
  problems.filter((problem) => problem.severity === "error");

export const warningsIn = (problems: Problem[]): Problem[] =>
  problems.filter((problem) => problem.severity === "warning");

/** Checks as a report, most serious first. */
export function describeProblems(problems: Problem[]): string {
  if (!problems.length) return "No problems found.";
  const order = { error: 0, warning: 1, note: 2 } as const;
  const label = { error: "error  ", warning: "warning", note: "note   " } as const;
  return [...problems]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((problem) => `  ${label[problem.severity]}  ${problem.message}`)
    .join("\n");
}
