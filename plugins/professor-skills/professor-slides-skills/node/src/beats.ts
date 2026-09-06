/**
 * The beat library, indexed instead of read.
 *
 * There are twenty-nine beats in `beats/`, forty lines each. Choosing one used
 * to mean reading `references/teaching-beats.md` for how to choose and then
 * `beats/README.md` for the index and then the file — about fourteen hundred
 * words to arrive at a name.
 *
 * Almost all of that is spent on beats that were never in contention. So this
 * reads the front matter of every beat and prints one line each: the id, the
 * family, how many slides it implies, and the teaching job in one sentence.
 * That is enough to select. The chosen beat's file is then read in full, and
 * only it — which is what the library was always supposed to cost.
 *
 * The `sequence` steps of a beat are the part that becomes slides, so
 * `pres beats <id>` prints them as a compact ladder as well as handing over the
 * YAML. Nothing here interprets a beat; it is a catalogue, not a planner.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export interface BeatStep {
  step?: string;
  intent?: string;
  archetype?: string;
  density?: string;
  note?: string;
}

export interface BeatFile {
  beat: string;
  name?: string;
  family?: string;
  purpose?: string;
  best_for?: string[];
  avoid_when?: string[];
  slides?: number;
  sequence?: BeatStep[];
  visual_rules?: Record<string, unknown>;
  ask_the_professor?: Array<{ condition?: string; question?: string }>;
  exit_condition?: string;
  transition?: string;
}

/**
 * Where `beats/` is.
 *
 * `PRES_BEATS_DIR` wins, for a test or an unusual layout. Then
 * `CLAUDE_PLUGIN_ROOT`, which the plugin loader sets. Then the directory two up
 * from this file, which is where it sits in the repository and in an installed
 * plugin alike — so the CLI works when it is run by hand with no plugin
 * environment at all.
 */
export function beatsDirectory(): string | null {
  const explicit = process.env.PRES_BEATS_DIR;
  if (explicit && existsSync(explicit)) return resolve(explicit);

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const candidate = join(pluginRoot, "beats");
    if (existsSync(candidate)) return candidate;
  }

  // src/ -> node/ -> the plugin root.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, "..", "..", "beats");
  return existsSync(candidate) ? resolve(candidate) : null;
}

const cache = new Map<string, BeatFile[]>();

/** Every beat, front matter parsed, in family then id order. */
export function loadBeats(directory: string | null = beatsDirectory()): BeatFile[] {
  if (!directory) return [];
  const cached = cache.get(directory);
  if (cached) return cached;

  const beats: BeatFile[] = [];
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
    const path = join(directory, name);
    let parsed: unknown;
    try {
      parsed = parseYaml(readFileSync(path, "utf8").replace(/^﻿/, ""));
    } catch {
      // A beat file that does not parse is worth skipping rather than fatal:
      // one broken file should not make the catalogue unavailable.
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const beat = parsed as BeatFile;
    if (!beat.beat) beat.beat = name.replace(/\.(ya?ml)$/, "");
    beats.push(beat);
  }
  cache.set(directory, beats);
  return beats;
}

/** For tests, which write beats into a temporary directory. */
export const forgetBeats = (): void => void cache.clear();

export const findBeat = (id: string, beats = loadBeats()): BeatFile | null =>
  beats.find((beat) => beat.beat === id) ?? null;

export const families = (beats = loadBeats()): string[] =>
  [...new Set(beats.map((beat) => beat.family ?? "unfiled"))];

/** The first sentence of a `purpose`, which is written as one anyway. */
const oneLine = (text: string | undefined): string =>
  String(text ?? "").replace(/\s+/g, " ").trim();

export interface CatalogueOptions {
  family?: string;
  /** A phase name, which maps onto the families sharing its vocabulary. */
  phase?: string;
}

/**
 * Phases and beat families are two vocabularies over the same thing, so a
 * caller who has chosen a phase can ask for its beats without having to know
 * which families belong to it.
 */
const PHASE_FAMILIES: Record<string, string[]> = {
  orient: ["orient"],
  create_need: ["create_need"],
  build_understanding: ["introduce_concept", "explain_mechanism"],
  formalize: ["formalize", "algorithm"],
  use_or_test: ["apply", "evidence", "student_thinking"],
  integrate: ["integrate"],
};

export function selectBeats(options: CatalogueOptions = {}, beats = loadBeats()): BeatFile[] {
  let wanted: string[] | null = null;
  if (options.family) wanted = [options.family];
  else if (options.phase) wanted = PHASE_FAMILIES[options.phase] ?? [options.phase];
  if (!wanted) return beats;
  const set = new Set(wanted);
  return beats.filter((beat) => set.has(beat.family ?? "unfiled"));
}

/**
 * The catalogue: one line per beat, grouped by family.
 *
 * Columns rather than prose because it is read to choose from, and a column of
 * slide counts is how a planner notices that four beats will not fit in a
 * fifty-minute session.
 */
export function describeCatalogue(beats: BeatFile[], options: CatalogueOptions = {}): string {
  if (!beats.length) {
    return "no beats found. Set PRES_BEATS_DIR, or check that beats/ came with the plugin.";
  }
  const grouped = new Map<string, BeatFile[]>();
  for (const beat of beats) {
    const family = beat.family ?? "unfiled";
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family)!.push(beat);
  }

  const lines: string[] = [];
  const heading = options.family
    ? `beats in ${options.family}`
    : options.phase
      ? `beats for the ${options.phase} phase`
      : `${beats.length} beats — id · slides · the teaching job`;
  lines.push(heading);

  for (const [family, entries] of grouped) {
    lines.push("");
    lines.push(`${family}:`);
    for (const beat of entries) {
      const slides = beat.slides === undefined ? " ?" : String(beat.slides).padStart(2, " ");
      lines.push(`  ${beat.beat.padEnd(34)} ${slides}  ${oneLine(beat.purpose)}`);
    }
  }
  lines.push("");
  lines.push("`pres beats <id>` for one in full. Read only the ones you are using.");
  return lines.join("\n");
}

/** One beat, as the ladder it implies plus the fields that constrain it. */
export function describeBeat(beat: BeatFile): string {
  const lines = [
    `${beat.beat} — ${beat.name ?? beat.beat}`,
    `family: ${beat.family ?? "unfiled"} · slides: ${beat.slides ?? "?"}`,
    "",
    `purpose: ${oneLine(beat.purpose)}`,
  ];
  if (beat.best_for?.length) {
    lines.push("best for:");
    for (const item of beat.best_for) lines.push(`  ${oneLine(item)}`);
  }
  if (beat.avoid_when?.length) {
    lines.push("avoid when:");
    for (const item of beat.avoid_when) lines.push(`  ${oneLine(item)}`);
  }
  if (beat.sequence?.length) {
    lines.push("");
    lines.push("sequence — these become the slides:");
    for (const [index, step] of beat.sequence.entries()) {
      const shape = [step.intent, step.archetype, step.density].filter(Boolean).join(" · ");
      lines.push(`  ${index + 1}. ${oneLine(step.step)}`);
      lines.push(`     ${shape}`);
      if (step.note) lines.push(`     note: ${oneLine(step.note)}`);
    }
  }
  if (beat.visual_rules && Object.keys(beat.visual_rules).length) {
    lines.push("");
    lines.push("visual rules:");
    for (const [key, value] of Object.entries(beat.visual_rules)) {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }
  if (beat.ask_the_professor?.length) {
    lines.push("");
    lines.push("ask the professor, only when the condition holds:");
    for (const entry of beat.ask_the_professor) {
      lines.push(`  if ${oneLine(entry.condition)}`);
      lines.push(`    ${oneLine(entry.question)}`);
    }
  }
  if (beat.exit_condition) {
    lines.push("");
    lines.push(`exit: ${oneLine(beat.exit_condition)}`);
  }
  if (beat.transition) lines.push(`transition: ${oneLine(beat.transition)}`);
  return lines.join("\n");
}

/**
 * Whether the beat chains the grammars ship actually name beats that exist.
 *
 * A default pointing at a beat nobody wrote is worse than no default: it sends
 * a planner to read a file that is not there and then to invent one. Checked by
 * a test rather than at runtime.
 */
export function missingFromLibrary(chain: string[], beats = loadBeats()): string[] {
  const known = new Set(beats.map((beat) => beat.beat));
  return chain.filter((id) => !known.has(id));
}
