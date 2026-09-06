/**
 * The plan, compiled rather than transcribed.
 *
 * `<deck>.plan.yaml` used to be written by hand — by an agent, slide by slide,
 * copying the number, the title, the minutes, the purpose and the archetype out
 * of the outline it had just written, and the figure list out of the markdown it
 * had just written. Every one of those fields already existed somewhere else.
 * Copying them bought nothing and cost two things: tokens, and a second source
 * of truth that drifts. The commonest render failure in this plugin was a plan
 * whose slide 14 said what slide 13 said, because a slide got inserted and
 * twenty-four numbers did not.
 *
 * So the plan is generated. The rule the whole file rests on:
 *
 *     LLM for judgement. Code for bookkeeping.
 *
 * Which means:
 *
 *   **the outline** is authoritative for the session — its sequence, minutes,
 *   purposes, intents, archetypes, coverage. Judgement.
 *
 *   **the deck markdown** is authoritative for what is on a slide, including
 *   its title and which figures it links. Judgement.
 *
 *   **the plan** is authoritative for nothing. It is a projection of those two,
 *   plus the one thing neither can hold: the licence metadata a found or
 *   generated picture carries, which is preserved across regeneration because
 *   `find-image` wrote it and nothing else knows it.
 *
 * A plan that is a projection can be regenerated at any time, which turns
 * "the plan no longer matches the deck" from a render failure into a command.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseBlocks, slideTitle, splitSlides, type Block } from "./deck.ts";
import type { Mode } from "./route.ts";
import {
  loadOutline,
  loadPlan,
  outlinePathFor,
  planPathFor,
  type DeckPlan,
  type Outline,
  type OutlineSlide,
} from "./plan.ts";

/** Whether a deck's mode means a professor has to have agreed to it first. */
export type Approval = "not_required" | "required" | "given";

/** The plan fields that are copies of an outline field, and nothing else. */
const CARRIED_FROM_OUTLINE = [
  "minutes",
  "purpose",
  "intent",
  "archetype",
  "density",
  "text_roles",
  "required_visual",
  "visual_anchor",
  "focus",
  "delivery_dependency",
  "outcomes",
  "concepts",
  "sources",
  "type",
] as const;

export interface CompileOptions {
  /** The outline, when there is one. FAST decks have none, by design. */
  outline?: Outline | null;
  /** Path to that outline, so the plan can name it relatively. */
  outlinePath?: string;
  /** The plan as it stands, whose licence metadata is preserved. */
  existing?: DeckPlan | null;
  mode?: Mode;
  approval?: Approval;
  /**
   * Whether to guess an archetype for a slide the outline does not describe.
   *
   * On for a FAST deck, which has no outline at all and would otherwise render
   * every slide as flowed body copy — a question slide included. Guesses are
   * marked, and the density checks skip a marked slide: a warning derived from
   * a guess is a warning about the guess.
   */
  infer?: boolean;
}

export interface Compiled {
  plan: DeckPlan;
  /** Anything the compilation could not do, or did by guessing. */
  warnings: string[];
  /** Whether this differs from the plan already on disk. */
  changed: boolean;
}

/**
 * An archetype from the shape of the markdown, for a deck with no outline.
 *
 * Conservative on purpose: five high-confidence cases and then silence. A wrong
 * archetype is worse than none, because the renderer lays the slide out from it
 * and the density check measures against it. Anything ambiguous is left unset,
 * and an unset archetype means "flow it like body copy", which is the safe
 * default rather than a lie.
 */
export function inferArchetype(blocks: Block[], title: string, position: number): string | null {
  // The title slide is composed by the renderer, not flowed, and giving it an
  // archetype would make the check measure the deck's front matter.
  if (position === 0) return null;
  if (/\?\s*$/.test(title.trim())) return "question";
  const kinds = new Set(blocks.map((block) => block.kind));
  const images = blocks.filter((block) => block.kind === "image").length;
  if (kinds.has("code")) return "algorithm";
  if (kinds.has("table")) return "structured_comparison";
  if (kinds.has("math")) return "derivation";
  if (images >= 2) return "visual_comparison";
  if (images === 1 && !kinds.has("list") && !kinds.has("table") && !kinds.has("code")) {
    return "single_visual";
  }
  return null;
}

const relative = (from: string, to: string): string =>
  dirname(to) === dirname(from) ? basename(to) : to;

/**
 * Compile a plan for a deck.
 *
 * Pure apart from reading the markdown the caller already handed over: no
 * writing, so a caller can diff it against what is on disk before deciding.
 */
export function compilePlan(deckPath: string, markdown: string, options: CompileOptions = {}): Compiled {
  const warnings: string[] = [];
  const slides = splitSlides(markdown).map(parseBlocks);
  const outline = options.outline ?? null;
  const existing = options.existing ?? null;

  if (!slides.length) {
    throw new Error(
      `${deckPath} has no slides. Marp splits on a \`---\` rule between slides; a deck with only ` +
      "front matter has nothing to compile a plan from.",
    );
  }

  const outlineSlides = new Map<number, OutlineSlide>();
  for (const slide of outline?.slides ?? []) {
    if (typeof slide.number === "number") outlineSlides.set(slide.number, slide);
  }
  if (outline && outline.slides.length !== slides.length) {
    warnings.push(
      `the outline plans ${outline.slides.length} slide(s) and the markdown has ${slides.length}. ` +
      "The plan follows the markdown, because that is what renders — but one of the two was " +
      "changed after the other, and which one is right is the professor's question.",
    );
  }

  const planned: OutlineSlide[] = [];
  const inferred: number[] = [];

  for (const [index, blocks] of slides.entries()) {
    const number = index + 1;
    const title = slideTitle(blocks);
    const slide: OutlineSlide = { number, title };
    const source = outlineSlides.get(number);

    if (source) {
      // Titles come from the markdown, always. The markdown is what goes on the
      // screen, so a plan that carried the outline's wording would enforce a
      // contract against a title nobody will ever see.
      if (title && source.title && normalise(title) !== normalise(source.title)) {
        warnings.push(
          `slide ${number}: the outline says "${source.title}", the markdown says "${title}". ` +
          "The plan records the markdown. If the outline is the one that was approved, change the deck.",
        );
      }
      // Field-by-field rather than a spread: the list is the definition of
      // "what the plan copies", and a spread would silently start carrying any
      // field somebody adds to an outline, including ones that belong to the
      // professor's review rather than to the render.
      const from = source as unknown as Record<string, unknown>;
      const onto = slide as unknown as Record<string, unknown>;
      for (const field of CARRIED_FROM_OUTLINE) {
        const value = from[field];
        if (value !== undefined && value !== null) onto[field] = value;
      }
    } else if (options.infer) {
      const guess = inferArchetype(blocks, title, index);
      if (guess) {
        slide.archetype = guess;
        slide.archetype_source = "inferred";
        inferred.push(number);
      }
    }

    if (!title) {
      warnings.push(
        `slide ${number} has no heading, so the render contract has nothing to match on. ` +
        "Give it a `#` or `##` title.",
      );
    }
    planned.push(slide);
  }

  if (inferred.length) {
    warnings.push(
      `archetypes were guessed from the markdown for slide(s) ${inferred.join(", ")}, because there ` +
      "is no outline describing them. The density checks skip a guessed archetype.",
    );
  }

  // --- figures -------------------------------------------------------------
  // The deck's own image links are the list. An entry already in the plan is
  // kept whole, because it may carry the licence and attribution that
  // `find-image` wrote and nothing else can reconstruct.
  const figures: NonNullable<DeckPlan["figures"]> = {};
  const previous = existing?.figures ?? {};
  for (const blocks of slides) {
    for (const block of blocks) {
      if (block.kind !== "image") continue;
      if (figures[block.src]) continue;
      const kept = previous[block.src];
      figures[block.src] = kept
        ? { ...kept, ...(kept.alt ? {} : { alt: block.alt }) }
        : { title: titleFromFilename(block.src), alt: block.alt };
    }
  }
  for (const [name, record] of Object.entries(previous)) {
    if (figures[name]) continue;
    // A recorded figure nothing links any more. Kept rather than dropped when
    // it carries licence metadata: deleting the only record of an attribution
    // is not a thing a bookkeeping step gets to do.
    if (record.image_source || record.image_prompt) {
      figures[name] = record;
      warnings.push(
        `the plan records ${name}, which no slide links. Its attribution was kept — remove the ` +
        "entry by hand if the picture is really gone.",
      );
    }
  }

  const mode = options.mode ?? existing?.mode;
  const approval = options.approval ?? existing?.approval ?? defaultApproval(mode);

  const plan: DeckPlan = {
    plan_version: 1,
    generated: true,
    deck: basename(deckPath),
    title: outline?.title ?? frontMatterTitle(markdown) ?? basename(deckPath).replace(/\.md$/i, ""),
    ...(mode ? { mode } : {}),
    approval,
    ...(options.outlinePath ? { outline: relative(deckPath, options.outlinePath) } : {}),
    ...(outline?.status ? { status: outline.status } : {}),
    ...(maxSlides(outline) ? { max_slides: maxSlides(outline)! } : {}),
    // The outline is where a professor's decision lives; a value in a
    // hand-written plan is honoured behind it, so a deck that predates this
    // keeps its title picture across the first regeneration.
    ...(outline?.slide_numbers !== undefined
      ? { slide_numbers: outline.slide_numbers }
      : existing?.slide_numbers !== undefined
        ? { slide_numbers: existing.slide_numbers }
        : {}),
    ...(outline?.title_slide
      ? { title_slide: outline.title_slide }
      : existing?.title_slide
        ? { title_slide: existing.title_slide }
        : {}),
    slides: planned,
    ...(Object.keys(figures).length ? { figures } : {}),
  };

  const changed = !existing || !sameAs(existing, plan);
  return { plan, warnings, changed };
}

const maxSlides = (outline: Outline | null): number | undefined =>
  outline?.presentation?.max_slides ?? outline?.max_slides ?? undefined;

/**
 * What approval a mode implies when nothing says otherwise.
 *
 * A plan with no mode at all is a plan written before modes existed, and those
 * decks were all built through the approval gate. So the absence of a mode means
 * approval is required — the conservative reading, and the one that keeps every
 * deck already on disk behaving exactly as it did.
 */
export const defaultApproval = (mode: Mode | undefined): Approval =>
  mode === "fast" || mode === "standard" ? "not_required" : "required";

const normalise = (text: string): string => text.trim().replace(/\s+/g, " ").toLowerCase();

/** `MODULE-06-slides-fig-01-split.svg` → `Split`. A starting point, not a caption. */
function titleFromFilename(src: string): string {
  const stem = basename(src).replace(/\.[a-z0-9]+$/i, "");
  const tail = /(?:fig|figure)-\d+-(.+)$/i.exec(stem);
  const words = (tail?.[1] ?? stem).replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : stem;
}

/** `title:` from the deck's YAML front matter, when it has one. */
function frontMatterTitle(markdown: string): string | null {
  const text = markdown.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 3);
  if (end < 0) return null;
  const found = /^title:\s*(.+)$/m.exec(text.slice(4, end));
  return found ? found[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

/** Whether two plans say the same thing, ignoring key order. */
const sameAs = (a: DeckPlan, b: DeckPlan): boolean =>
  JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      if (inner === undefined) continue;
      out[key] = sortKeys(inner);
    }
    return out;
  }
  return value;
}

const HEADER = [
  "# Generated by `pres plan build`. Do not edit by hand.",
  "#",
  "# Every field here is a projection of two files that are edited: the deck markdown",
  "# beside this one, and the outline it was built from. Change one of those and run",
  "# `pres plan build` again. The one exception is figure licence metadata — an",
  "# attribution written by `pres find-image` is preserved across regeneration,",
  "# because nothing else knows it.",
  "",
].join("\n");

export function planToYaml(plan: DeckPlan): string {
  return `${HEADER}${stringifyYaml(plan, { lineWidth: 92 })}`;
}

export interface BuildPlanResult extends Compiled {
  planPath: string;
  wrote: boolean;
}

/**
 * Read the deck, find its outline, compile the plan and write it.
 *
 * The one entry point the CLI needs. `dryRun` compiles without writing, which
 * is what a check wants when it is asking "is the plan on disk still right".
 */
export function buildPlan(
  deckPath: string,
  options: CompileOptions & { dryRun?: boolean; outlinePath?: string } = {},
): BuildPlanResult {
  if (!existsSync(deckPath)) throw new Error(`${deckPath} does not exist`);
  const markdown = readFileSync(deckPath, "utf8");
  const planPath = planPathFor(deckPath);

  const candidate = options.outlinePath ?? outlinePathFor(deckPath);
  const hasOutline = options.outline !== undefined ? options.outline !== null : existsSync(candidate);
  const outline = options.outline !== undefined
    ? options.outline
    : hasOutline ? loadOutline(candidate) : null;

  // A plan that cannot be read is treated as absent rather than fatal. The whole
  // point of generating it is that it is disposable: refusing to rebuild a
  // corrupt one would leave the professor with a broken file and no command that
  // fixes it. The one thing lost is any figure attribution it held, and that is
  // worth saying out loud.
  let existing: DeckPlan | null = null;
  const unreadable: string[] = [];
  if (options.existing !== undefined) {
    existing = options.existing;
  } else if (existsSync(planPath)) {
    try {
      existing = loadPlan(planPath);
    } catch (error) {
      const why = String((error as Error).message ?? error).split(/\r?\n/)[0];
      unreadable.push(
        `${planPath} could not be read (${why}), so it is being rebuilt from scratch. Any figure ` +
        "attribution it held is gone — check the figures block against `pres find-image` output " +
        "if the deck uses found images.",
      );
    }
  }

  const mode = options.mode ?? existing?.mode;
  const compiled = compilePlan(deckPath, markdown, {
    ...options,
    outline,
    ...(outline ? { outlinePath: candidate } : {}),
    existing,
    ...(mode ? { mode } : {}),
    // A deck with no outline has nothing describing its slides, so guessing is
    // the only way its question slides get laid out as questions.
    infer: options.infer ?? !outline,
  });

  const result = { ...compiled, warnings: [...unreadable, ...compiled.warnings], planPath };
  if (options.dryRun) return { ...result, wrote: false };
  writeFileSync(planPath, planToYaml(result.plan), "utf8");
  return { ...result, wrote: true };
}
