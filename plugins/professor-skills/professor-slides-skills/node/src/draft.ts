/**
 * The draft deck: the same slides, with the pictures that do not exist yet
 * standing in for themselves.
 *
 * `pres render` builds the deck you present. `pres render --draft` builds a
 * second one beside it in which every planned-but-undrawn visual appears as a
 * card carrying what it is meant to show and the prompt that would produce it.
 * Flip between the two and the gap is the list of figures still to make.
 *
 * **It does not call an image model, and that is deliberate rather than a gap.**
 * The plugin has no image provider and should not acquire one: writing the
 * prompt is language work and belongs to the agent, running it is the
 * professor's and belongs to whatever tool they already pay for. What this adds
 * is the hand-off — the prompt on the slide, where the hole is, instead of
 * buried in a YAML file.
 *
 * If you *do* want the draft filled in automatically, point `PRES_IMAGE_COMMAND`
 * at something that turns a prompt into a file and it will be used. That keeps
 * the plugin ignorant of any particular provider, which is the only way it can
 * stay honest about what it is putting on a slide.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DeckPlan, OutlineSlide } from "./plan.ts";
import type { Block } from "./deck.ts";

/** A visual the plan asked for that the deck does not yet contain. */
export interface MissingVisual {
  slide: number;
  /** What the outline said the picture must show. */
  required: string;
  /** The prompt recorded for it, when the build step wrote one. */
  prompt?: string;
  /** A file a configured generator produced for it, if any. */
  generated?: string;
}

/**
 * Every slide whose plan asks for a picture and whose markdown has none.
 *
 * A slide that already carries a figure is not missing one, whatever the plan
 * says — the plan records the intention and the markdown records the fact.
 */
export function missingVisuals(slides: Block[][], plan: DeckPlan): MissingVisual[] {
  const out: MissingVisual[] = [];
  for (const [index, blocks] of slides.entries()) {
    const spec: OutlineSlide | undefined = plan.slides?.find((s) => s.number === index + 1);
    if (!spec?.required_visual) continue;
    if (blocks.some((block) => block.kind === "image")) continue;
    const prompt = plan.figures?.[`slide-${index + 1}`]?.image_prompt?.prompt;
    out.push({
      slide: index + 1,
      required: spec.required_visual,
      ...(prompt ? { prompt } : {}),
    });
  }
  return out;
}

/**
 * The configured command, split into words, honouring quotes.
 *
 * Not a plain split on whitespace: a course lives at a path like
 * `C:/Users/Ardak Shalkar/Documents/AI Course 2026/…`, and splitting that on
 * spaces turns one executable into four arguments and the command silently
 * produces nothing. Quote what has spaces in it and it survives.
 */
export function tokenize(template: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  for (const character of template) {
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (started) out.push(current);
      current = "";
      started = false;
      continue;
    }
    current += character;
    started = true;
  }
  if (started) out.push(current);
  return out;
}

/** `{prompt}` and `{out}` in the configured command, filled in. */
const fill = (template: string, prompt: string, file: string): string[] =>
  tokenize(template).map((part) => part.replaceAll("{prompt}", prompt).replaceAll("{out}", file));

/**
 * Ask a configured generator for each missing picture.
 *
 * Silent and harmless when `PRES_IMAGE_COMMAND` is unset, which is the default
 * and the expected case. A command that fails, or that does not produce the
 * file it was asked for, leaves the placeholder in place and says so — a draft
 * that quietly shipped an empty slot would be worse than one that shows the
 * hole.
 */
export function generateMissing(
  missing: MissingVisual[],
  outDir: string,
  name: string,
): { filled: MissingVisual[]; warnings: string[] } {
  const template = process.env.PRES_IMAGE_COMMAND;
  if (!template || !missing.length) return { filled: missing, warnings: [] };

  const warnings: string[] = [];
  const filled = missing.map((visual) => {
    // The description is the fallback prompt: it is what the outline said the
    // picture must show, which is exactly what a generator needs to hear.
    const prompt = visual.prompt ?? visual.required;
    const file = join(outDir, `${name}-draft-slide-${visual.slide}.png`);
    const [command, ...args] = fill(template, prompt, file);
    if (!command) return visual;
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.error || !existsSync(file)) {
      warnings.push(
        `slide ${visual.slide}: PRES_IMAGE_COMMAND produced no image` +
        `${result.error ? ` (${String(result.error.message).split("\n")[0]})` : ""}; ` +
        "the draft shows the placeholder instead",
      );
      return visual;
    }
    return { ...visual, generated: file };
  });
  return { filled, warnings };
}

/** What the hand-over should say about the draft that was just written. */
export function describeDraft(missing: MissingVisual[]): string {
  if (!missing.length) return "Every planned visual is drawn; the draft matches the deck.";
  const generated = missing.filter((visual) => visual.generated).length;
  const lines = [
    `${missing.length} planned visual(s) are not drawn yet` +
    (generated ? `, ${generated} filled by PRES_IMAGE_COMMAND` : "") + ":",
  ];
  for (const visual of missing) {
    lines.push(`  slide ${visual.slide}: ${visual.required}${visual.generated ? "  [generated]" : ""}`);
  }
  if (!generated) {
    lines.push(
      "",
      "Each placeholder carries the prompt that would produce it. Run them through whatever",
      "generator you use, drop the files beside the deck, and link them from the slide — or set",
      "PRES_IMAGE_COMMAND to a command taking {prompt} and {out} and the draft will fill itself.",
    );
  }
  return lines.join("\n");
}
