/**
 * Deterministic scoring of choice items, and what the wrong answers reveal.
 * Ported from `ainar/scoring.py`.
 *
 * A thirty-question multiple-choice paper across twenty-seven students is eight
 * hundred and ten judgements, every one of which is a comparison against an
 * answer key already written down. Nothing here needs a language model, and
 * putting one in the path would only add a failure mode.
 *
 * What the model *does* add is the second half: an option tagged
 * `indicates_misconception_of` turns "twelve students chose (b)" into a
 * statement about what twelve students believe.
 *
 * The responses are plain objects rather than parsed `ItemResponse` records, on
 * purpose: this rewrites a draft file in place, and anything the schema would
 * have dropped or defaulted on the way in would be written back as though the
 * author had asked for it.
 */

import { CHOICE_ITEM_TYPES } from "./model/common.ts";

/** One option, and how many students picked it. */
export interface OptionTally {
  label: string;
  text: string;
  correct: boolean;
  chose: number;
  misconception: string | null;
  note: string | null;
}

/** What one item's responses came to. */
export interface ItemStats {
  item_id: string;
  prompt: string;
  maximum_score: number;
  responses: number;
  correct: number;
  options: OptionTally[];
}

export interface ScoringResult {
  scored: string[];
  alreadyScored: string[];
  unscorable: string[];
  /** Insertion-ordered; the CLI sorts by item id when it prints. */
  stats: Map<string, ItemStats>;
}

export const emptyResult = (): ScoringResult => ({
  scored: [],
  alreadyScored: [],
  unscorable: [],
  stats: new Map(),
});

/**
 * The share who got it right, to two places, or null if nobody answered.
 *
 * Python rounds with banker's rounding and JavaScript does not, so this is
 * written out rather than left to `toFixed`. Two decimals on a ratio of small
 * integers lands on a .xx5 boundary often enough to matter — 3/8 is 0.375.
 */
export const successRate = (stats: ItemStats): number | null =>
  stats.responses ? round2(stats.correct / stats.responses) : null;

/** The wrong answer more students chose than any other. */
export const dominantMisconception = (stats: ItemStats): OptionTally | null => {
  const wrong = stats.options.filter((option) => !option.correct && option.chose);
  if (!wrong.length) return null;
  // `max` in Python keeps the FIRST of equal keys; `reduce` with `>` does too.
  return wrong.reduce((best, option) => (option.chose > best.chose ? option : best));
};

/**
 * `round(value, 2)`, as Python does it.
 *
 * Two things `Math.round(value * 100) / 100` gets wrong, and both show up in a
 * class of twenty-seven:
 *
 * 1. **Ties go to even, not away from zero.** 3 correct out of 8 is 0.375, and
 *    Python answers 0.38 while `Math.round` also answers 0.38 — but 0.125
 *    becomes 0.12 in Python and 0.13 here. Whichever is "right", a dashboard
 *    and a gradebook that disagree about the same cohort is the bug.
 * 2. **`value * 100` is not the value.** Python rounds the decimal expansion of
 *    the double it actually holds; 2.675 is stored as 2.67499999999999982…, so
 *    Python answers 2.67. Multiplying first lands on 267.50000000000003 and
 *    rounds the other way.
 *
 * So this rounds the expansion rather than the arithmetic. Twenty decimals is
 * more than enough: a genuine tie at two places means the value is a multiple
 * of 1/8, which terminates after three.
 */
const round2 = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const [whole = "0", frac = ""] = Math.abs(value).toFixed(20).split(".");
  const rest = frac.slice(2);
  let scaled = Number(whole + frac.slice(0, 2).padEnd(2, "0"));

  const first = rest.charCodeAt(0) - 48;
  if (first > 5) scaled += 1;
  else if (first === 5) {
    if (/[1-9]/.test(rest.slice(1))) scaled += 1;
    else if (scaled % 2 === 1) scaled += 1;
  }
  return (sign * scaled) / 100;
};

/** What this response is worth, and whether it counts as correct. */
const award = (
  item: AnyItem,
  chosen: string[],
  partial: boolean,
): { score: number; correct: boolean } => {
  const correctLabels = new Set(
    item.options.filter((option) => option.correct).map((option) => option.label),
  );
  const picked = new Set(chosen);
  const exactlyRight =
    picked.size === correctLabels.size && [...picked].every((label) => correctLabels.has(label));

  if (exactlyRight) return { score: item.maximum_score, correct: true };
  if (!partial || item.type !== "multiple_select") return { score: 0, correct: false };

  // Partial credit, only where selecting several answers is the point:
  // right picks count, wrong picks cancel them, never below zero.
  const hits = [...picked].filter((label) => correctLabels.has(label)).length;
  const misses = picked.size - hits;
  const share = correctLabels.size ? Math.max(0, (hits - misses) / correctLabels.size) : 0;
  return { score: round2(item.maximum_score * share), correct: false };
};

/** The parts of an `AssessmentItem` this module reads. */
interface AnyItem {
  item_id: string;
  prompt: string;
  type: string;
  maximum_score: number;
  options: {
    label: string;
    text: string;
    correct: boolean;
    indicates_misconception_of?: string | null;
    note?: string | null;
  }[];
}

export interface ScoreOptions {
  /** Partial credit on `multiple_select` items. */
  partial?: boolean;
  /** Overwrite a score that is already there. */
  rescore?: boolean;
}

/**
 * Fill in `score` and `correct` on choice responses, in place.
 *
 * `responses` is mutated — the caller holds the whole parsed document and
 * writes it back, so anything it holds besides the responses survives.
 */
export const scoreChoiceItems = (
  responses: Record<string, any>[],
  items: Map<string, AnyItem>,
  { partial = false, rescore = false }: ScoreOptions = {},
): ScoringResult => {
  const result = emptyResult();

  for (const response of responses) {
    const itemId = response.item_id as string | undefined;
    const item = itemId === undefined ? undefined : items.get(itemId);
    const responseId = (response.response_id as string | undefined) ?? "?";

    if (item === undefined) {
      result.unscorable.push(`${responseId}: unknown item ${itemId}`);
      continue;
    }

    let stats = result.stats.get(item.item_id);
    if (stats === undefined) {
      stats = {
        item_id: item.item_id,
        prompt: item.prompt,
        maximum_score: item.maximum_score,
        responses: 0,
        correct: 0,
        options: item.options.map((option) => ({
          label: option.label,
          text: option.text,
          correct: option.correct,
          chose: 0,
          misconception: option.indicates_misconception_of ?? null,
          note: option.note ?? null,
        })),
      };
      result.stats.set(item.item_id, stats);
    }

    if (!CHOICE_ITEM_TYPES.has(item.type) || !item.options.length) {
      result.unscorable.push(`${responseId}: ${itemId} is a ${item.type} item — needs a human`);
      continue;
    }
    if (response.score !== null && response.score !== undefined && !rescore) {
      result.alreadyScored.push(responseId);
      continue;
    }

    const chosen: string[] = [...((response.chosen_options as string[] | null) ?? [])];
    if (!chosen.length) {
      result.unscorable.push(`${responseId}: no option chosen`);
      continue;
    }

    const known = new Set(item.options.map((option) => option.label));
    const unknown = chosen.filter((label) => !known.has(label));
    if (unknown.length) {
      result.unscorable.push(
        `${responseId}: option(s) ${unknown.join(", ")} not defined on ${itemId}`,
      );
      continue;
    }

    const { score, correct } = award(item, chosen, partial);
    response.score = score;
    response.correct = correct;
    response.scored_by = "auto";
    result.scored.push(responseId);

    stats.responses += 1;
    stats.correct += correct ? 1 : 0;
    for (const tally of stats.options) {
      if (chosen.includes(tally.label)) tally.chose += 1;
    }
  }

  return result;
};
