/**
 * The two files that stand between a module and a rendered deck.
 *
 * **The outline** (`<deck>.outline.yaml`) is the argument of the session before
 * any of it is written: the arc, the slide sequence, and an honest statement of
 * what it covers and what it leaves out. It carries a `status`, and that status
 * is the whole approval mechanism here — there is no `ainar approve` in a
 * standalone plugin, so the gate has to be a fact in a file the professor can
 * read and edit.
 *
 * **The plan** (`<deck>.plan.yaml`) is the render contract: the approved slide
 * sequence plus what every figure needs in order to be shown lawfully. It is
 * the standalone replacement for the parent's `Document.presentation_plan`, and
 * `pres render` reads it rather than trusting whoever is driving.
 *
 * They are separate because they answer to different people. The outline is
 * reviewed by a professor; the plan is enforced by a program. Merging them
 * would mean either a professor reading licence metadata or a renderer trusting
 * prose.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DECK_ARCHETYPES, OUTPUT_MODES } from "./archetypes.ts";
import type { ModuleContext } from "./context.ts";
import { critiqueDeck } from "./critique.ts";
import type { Plan, PlannedSlide } from "./deck.ts";

export const APPROVED = "approved";
export const DRAFT = "draft";

export interface OutlineSlide extends PlannedSlide {
  /** Free-text kind, kept for readability. `intent` and `archetype` are checked. */
  type?: string;
  /** What the learner is doing here. See `archetypes.ts`. */
  intent?: string;
  /** How that information is represented. One of the eighteen. */
  archetype?: string;
  /**
   * Where the archetype came from.
   *
   * `inferred` means `pres plan build` guessed it from the shape of the
   * markdown, because a FAST deck has no outline describing its slides. The
   * density checks skip a guessed archetype: a warning derived from a guess is
   * a warning about the guess, and a professor who reads one of those learns to
   * ignore the others.
   */
  archetype_source?: "outline" | "inferred";
  /** What each piece of text on the slide is doing. */
  text_roles?: string[];
  density?: string;
  outcomes?: string[];
  concepts?: string[];
  /** A picture the slide needs; the build step must produce it or say why not. */
  required_visual?: string;
  /**
   * A visual reused across several slides, named so the deck can highlight
   * parts of it rather than drawing a new picture each time.
   */
  visual_anchor?: string;
  /** Which part of the anchor this slide brings forward. */
  focus?: string;
  /** `high` means the slide is deliberately incomplete without the professor. */
  delivery_dependency?: string;
  /** Resource identifiers this slide is grounded in. */
  sources?: string[];
}

/**
 * A teaching beat: two to seven slides that do one teaching job.
 *
 * The unit that was missing. A section planned as a list of slides produces
 * slides that are individually reasonable and collectively inert; a section
 * planned as beats has to say what each stretch of it accomplishes, and the
 * slide shapes then follow from that rather than from a layout rota.
 */
export interface Beat {
  /** The beat's identifier in `beats/`, when it came from the library. */
  beat?: string;
  goal?: string;
  /** What the room is wondering when the beat starts. */
  entry_question?: string;
  /** What is true for the learner when it ends. */
  exit_understanding?: string;
  /** The question that hands over to the next beat. */
  transition_question?: string;
  /** Slide numbers this beat covers, in order. */
  slides?: number[];
}

export interface Arc {
  starts_from?: string;
  argues?: string;
  turn?: string;
  leaves_them_able_to?: string;
}

export interface Outline {
  outline_version?: number;
  deck: string;
  title: string;
  course_id?: string;
  course_version_id?: string;
  module_id?: string;
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  presentation?: {
    audience?: string;
    style?: string;
    language?: string;
    duration_minutes?: number;
    max_slides?: number;
    /** conceptual_lecture, technical_lecture, seminar, workshop, course_intro … */
    deck_archetype?: string;
    /** teaching, handout or hybrid — they are different artefacts. */
    output_mode?: string;
    /** Which representation ladder applies. See `references/deck-grammars.md`. */
    discipline?: string;
  };
  arc?: Arc;
  /** The session as teaching jobs, each covering a stretch of the slides. */
  beats?: Beat[];
  outcomes?: string[];
  concepts?: string[];
  slides: OutlineSlide[];
  /** Tolerated at the top level as well as under `presentation:`. */
  max_slides?: number;
  /**
   * What the title slide carries besides its words.
   *
   * Here rather than only in the plan because the plan is generated, and a
   * professor pointing at a photograph or an institutional mark is making a
   * decision, not doing bookkeeping. `pres plan build` carries it across; a
   * value already in a hand-written plan is preserved too, so nothing that
   * worked before stops working.
   */
  title_slide?: {
    image?: string;
    image_alt?: string;
    logo?: string;
    logo_alt?: string;
  };
  /** Slide numbers, bottom right. On unless this says otherwise. */
  slide_numbers?: boolean;
  coverage?: {
    outcomes_served?: string[];
    concepts_covered?: string[];
    concepts_omitted?: Array<{ concept: string; why: string }>;
  };
  generated_by?: Record<string, unknown>;
}

export interface FigureRecord {
  title?: string;
  alt?: string;
  image_source?: {
    provider?: string;
    source_url?: string;
    license?: string;
    attribution?: string;
  };
  image_prompt?: {
    model?: string;
    prompt?: string;
    generated?: boolean;
  };
}

export interface DeckPlan extends Plan {
  plan_version?: number;
  deck: string;
  title: string;
  /**
   * The execution depth this deck was produced at. See `route.ts`.
   *
   * It is recorded rather than inferred because it decides the approval gate,
   * and a gate whose strictness depends on how somebody phrased a request three
   * days ago is not a gate. The plan says which harness ran, the render prints
   * it, and a professor holding the .pptx can tell whether anybody agreed to
   * what is in it.
   *
   * Absent means the plan predates modes, and an absent mode requires approval —
   * every deck built before this field existed went through that gate.
   */
  mode?: "fast" | "standard" | "deep";
  /**
   * Whether a professor's approval is a condition of rendering this deck.
   *
   * `required` is DEEP and anything a professor asked to approve first.
   * `not_required` is FAST and STANDARD, where the request for a deck *is* the
   * agreement — they asked for slides, not for a plan to review. `given`
   * records an approval that has happened.
   */
  approval?: "not_required" | "required" | "given";
  /** Written by `pres plan build`. A hand-edited plan is a plan that will be overwritten. */
  generated?: boolean;
  /** The outline this was built from, relative to the plan file. */
  outline?: string;
  /** Mirrored from the outline when the deck was built. */
  status?: string;
  /**
   * Slide numbers, bottom right. On unless this says otherwise.
   *
   * Worth having by default: it is how a student writes "slide 23" in their
   * notes and asks about it next week, and how a colleague reviewing the deck
   * says which slide they mean.
   */
  slide_numbers?: boolean;
  /**
   * What the title slide carries besides its words.
   *
   * Both are files beside the deck, named by the professor. Neither is ever
   * searched for or invented: a decorative title image is fine and is the one
   * place the figure rules allow a picture that carries no information, but an
   * institutional mark is a trademark question rather than a licence one, and
   * this plugin answers neither. It places the mark somebody pointed it at.
   *
   * An `image` that came from `pres find-image` needs its `figures` entry like
   * any other found picture, and its attribution is enforced the same way.
   */
  title_slide?: {
    image?: string;
    image_alt?: string;
    logo?: string;
    logo_alt?: string;
  };
  slides: OutlineSlide[];
  figures?: Record<string, FigureRecord>;
}

const readYaml = (path: string): Record<string, unknown> => {
  const parsed = parseYaml(readFileSync(path, "utf8").replace(/^﻿/, ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} is empty or is not a mapping.`);
  }
  return parsed as Record<string, unknown>;
};

export function loadOutline(path: string): Outline {
  const document = readYaml(path) as unknown as Outline;
  if (!Array.isArray(document.slides)) {
    throw new Error(`${path} has no slides: — an outline without a sequence is a title and a hope.`);
  }
  return document;
}

export function loadPlan(path: string): DeckPlan {
  const document = readYaml(path) as unknown as DeckPlan;
  if (!Array.isArray(document.slides)) throw new Error(`${path} has no slides:`);
  return document;
}

/** `<deck>.md` → `<deck>.plan.yaml` beside it. */
export const planPathFor = (deckPath: string): string =>
  join(dirname(deckPath), `${basename(deckPath).replace(/\.md$/i, "")}.plan.yaml`);

/** `<deck>.md` → `<deck>.outline.yaml` beside it. */
export const outlinePathFor = (deckPath: string): string =>
  join(dirname(deckPath), `${basename(deckPath).replace(/\.md$/i, "")}.outline.yaml`);

export const isApproved = (record: { status?: string } | null | undefined): boolean =>
  (record?.status ?? DRAFT).toLowerCase() === APPROVED;

/**
 * Whether this deck may not be rendered until a professor has said so.
 *
 * The approval gate was universal and that was wrong in one direction only: it
 * is exactly right for a deck somebody asked to review before it was written,
 * and pure obstruction for "make five slides explaining RAG", where the request
 * was for slides. A professor who has to approve an outline they never asked for
 * is a professor who learns to type `status: approved` without reading it, which
 * costs the gate everything it was for.
 *
 * So the gate is per-deck and the plan carries the answer. What must never
 * happen is a *silent* downgrade: a deck whose approval was not required still
 * says so, in the plan and in the render's output, because a .pptx looks
 * identical either way.
 */
export function approvalRequired(plan: { mode?: string; approval?: string } | null | undefined): boolean {
  const declared = plan?.approval;
  if (declared === "required") return true;
  if (declared === "not_required" || declared === "given") return false;
  const mode = plan?.mode;
  // No mode and no approval field: a plan from before either existed. Those
  // decks were all built through the gate, so they keep it.
  return !(mode === "fast" || mode === "standard");
}

export interface Problem {
  /**
   * `note` is neither wrong nor suspicious — it is a fact about the deck worth
   * printing. "Built in fast mode, with no outline and no approval gate" is the
   * case it exists for: reporting it as a warning trains professors to ignore
   * warnings, and not reporting it at all hides the one thing that distinguishes
   * a deck nobody reviewed from one somebody did.
   */
  severity: "error" | "warning" | "note";
  message: string;
}

const error = (message: string): Problem => ({ severity: "error", message });
const warning = (message: string): Problem => ({ severity: "warning", message });

/**
 * Whether an outline is internally sound, and whether it is honest about the
 * module it claims to serve.
 *
 * With no context — a flat course, or a deck that is not a module's — only the
 * first half runs. The second half is the one that matters: an outline may not
 * cover a concept the module does not claim, because that is the professor's
 * decision and not an outline's, and it may not quietly drop one the module
 * does claim without saying so.
 */
export function checkOutline(outline: Outline, context?: ModuleContext | null): Problem[] {
  const problems: Problem[] = [];
  const slides = outline.slides ?? [];

  if (!slides.length) problems.push(error("the outline has no slides"));

  // The visual grammar and the deck read as a sequence. Kept in `critique.ts`
  // because it answers a different question — not "is this outline sound" but
  // "does this sequence teach" — and because every finding there is a strong
  // default about teaching rather than a fact about the course.
  problems.push(...critiqueDeck(outline));

  const deckArchetype = outline.presentation?.deck_archetype;
  if (deckArchetype && !(DECK_ARCHETYPES as readonly string[]).includes(deckArchetype)) {
    problems.push(warning(
      `'${deckArchetype}' is not a deck archetype (${DECK_ARCHETYPES.join(", ")})`,
    ));
  }
  const outputMode = outline.presentation?.output_mode;
  if (outputMode && !(OUTPUT_MODES as readonly string[]).includes(outputMode)) {
    problems.push(warning(`'${outputMode}' is not an output mode (${OUTPUT_MODES.join(", ")})`));
  }

  // Numbering: unique and contiguous from 1, because the plan's numbers are how
  // a render failure names the slide that is wrong.
  const numbers = slides.map((slide) => slide.number);
  const seen = new Set<number>();
  for (const number of numbers) {
    if (typeof number !== "number") {
      problems.push(error(`a slide has no number: ${JSON.stringify(number)}`));
      continue;
    }
    if (seen.has(number)) problems.push(error(`slide number ${number} appears more than once`));
    seen.add(number);
  }
  for (let expected = 1; expected <= slides.length; expected += 1) {
    if (!seen.has(expected)) problems.push(error(`no slide numbered ${expected}`));
  }

  for (const slide of slides) {
    if (!slide.title || !String(slide.title).trim()) {
      problems.push(error(`slide ${slide.number} has no title, and the title is what the render contract matches on`));
    }
    if (!slide.purpose) {
      problems.push(warning(`slide ${slide.number} has no purpose — it becomes the speaker note, and a slide with no purpose usually has none`));
    }
  }

  const maxSlides = outline.presentation?.max_slides ?? outline.max_slides;
  if (maxSlides && slides.length > maxSlides) {
    problems.push(error(`${slides.length} slides, but the plan allows ${maxSlides}`));
  }

  // Timing. A tolerance rather than an equality: the minutes are an estimate,
  // and a plan that has to sum exactly invites padding a number to satisfy it.
  const duration = outline.presentation?.duration_minutes;
  const planned = slides.reduce((total, slide) => total + (slide.minutes ?? 0), 0);
  if (duration) {
    if (planned === 0) {
      problems.push(warning(`no slide carries minutes, so nothing checks the deck against its ${duration}-minute session`));
    } else if (planned > duration * 1.1) {
      problems.push(error(`the slides plan ${planned} minutes for a ${duration}-minute session`));
    } else if (planned < duration * 0.7) {
      problems.push(warning(`the slides plan ${planned} minutes of a ${duration}-minute session — either it is thin or the minutes are not filled in`));
    }
  }

  if (!context) return problems;

  const moduleConcepts = new Set(context.module.concepts);
  const moduleOutcomes = new Set(context.module.outcomes);
  const references = new Set(context.references.map((reference) => reference.resource_id));

  const covered = new Set<string>();
  const served = new Set<string>();
  for (const slide of slides) {
    for (const id of slide.concepts ?? []) {
      covered.add(id);
      if (!moduleConcepts.has(id)) {
        problems.push(error(
          `slide ${slide.number} covers ${id}, which ${context.module.module_id} does not claim. ` +
          "Adding a concept to a module is the professor's decision, not an outline's.",
        ));
      }
    }
    for (const id of slide.outcomes ?? []) {
      served.add(id);
      if (!moduleOutcomes.has(id)) {
        problems.push(error(`slide ${slide.number} claims to serve ${id}, which ${context.module.module_id} does not name`));
      }
    }
    for (const id of slide.sources ?? []) {
      if (!references.has(id)) {
        problems.push(error(`slide ${slide.number} cites ${id}, which is not a reference for this module's concepts`));
      }
    }
  }

  // An omission is fine and is often right. An unrecorded omission is not: it
  // is indistinguishable from having forgotten.
  const declared = new Set((outline.coverage?.concepts_omitted ?? []).map((entry) => entry.concept));
  for (const id of moduleConcepts) {
    if (covered.has(id) || declared.has(id)) continue;
    problems.push(error(
      `${id} is claimed by ${context.module.module_id} but no slide covers it and coverage.concepts_omitted does not mention it`,
    ));
  }
  for (const entry of outline.coverage?.concepts_omitted ?? []) {
    if (!entry.why || !String(entry.why).trim()) {
      problems.push(error(`coverage.concepts_omitted lists ${entry.concept} with no reason`));
    }
  }
  for (const id of moduleOutcomes) {
    if (!served.has(id)) {
      problems.push(warning(`no slide is tagged with ${id}, which ${context.module.module_id} serves`));
    }
  }

  if (!outline.arc || !Object.values(outline.arc).some((value) => value && String(value).trim())) {
    problems.push(warning("the outline has no arc — a slide list without one is a list of topics"));
  }
  return problems;
}

/**
 * The credit a picture must carry on the slide, or null when it needs none.
 *
 * Same rule as the parent's `creditFor`, reading the plan's figure record
 * instead of a `Document`: a Creative Commons licence that requires attribution
 * is not satisfied by a note in someone's memory, so a figure claiming a source
 * without an attribution line stops the render rather than producing a deck
 * that infringes quietly. A generated illustration is labelled as generated,
 * because a picture behind a lecturer is read as evidence unless it says
 * otherwise.
 */
export function creditForFigure(figure: FigureRecord | undefined, src: string): string | null {
  const source = figure?.image_source;
  if (source) {
    const credit = String(source.attribution ?? "").trim();
    if (!credit) {
      throw new Error(
        `${src} records a source (${source.source_url ?? source.provider ?? "unknown"}) but no attribution.\n` +
        "The licence is a condition of using it — add figures[...].image_source.attribution to the\n" +
        "plan, or take the picture off the slide.",
      );
    }
    return credit;
  }
  const prompt = figure?.image_prompt;
  if (prompt) {
    const model = String(prompt.model ?? "an image model");
    return `Illustration generated with ${model}. Not a photograph or a measurement.`;
  }
  return null;
}

/** The outline a plan was built from, when it can be found beside it. */
export function outlineBehind(planPath: string, plan: DeckPlan): Outline | null {
  const candidate = plan.outline
    ? join(dirname(planPath), plan.outline)
    : planPath.replace(/\.plan\.yaml$/i, ".outline.yaml");
  return existsSync(candidate) ? loadOutline(candidate) : null;
}
