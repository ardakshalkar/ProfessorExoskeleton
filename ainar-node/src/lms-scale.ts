/**
 * What a score is out of when it leaves for an LMS.
 *
 * A score is recorded here out of the assessment's own `maximum_score` — the
 * quiz is out of 10 because it has ten marks. The LMS may count it otherwise:
 *
 *     scheme points 100        the course is out of 100: a 10% assignment
 *                              is out of 10, whatever its own maximum
 *     ВСК1 points 100, w 0.30  the block is out of 100: a quiz worth 0.06
 *                              of the course inside it is out of 20
 *     neither                  the raw score, out of maximum_score
 *
 * The nearest block above the assessment that has `points` decides; the
 * scheme's `points` is the fallback; with neither the scale is the identity.
 * Only the edges use this — what is sent to Canvas and what the gradebook says
 * a block is worth — so a decision is never stored rescaled.
 */

import { roundHalfEven } from "./grading.ts";

export interface LmsScale {
  /** What the LMS has this assessment out of. */
  maximum: number;
  /** LMS score = recorded score × factor. */
  factor: number;
  basis: "assessment" | "component" | "course";
  /** The block whose `points` set the scale, when one did. */
  component_id: string | null;
  /** One line saying where `maximum` came from. */
  why: string;
  /** Why no scale could be worked out, when it could not. Nothing should be sent then. */
  problem: string | null;
}

/** Python's `%g`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/** Rounded the way the gradebook rounds: four places, half to even. */
export const toLms = (score: number, scale: LmsScale): number => roundHalfEven(score * scale.factor, 4);

export const lmsScale = (run: any, assessment: any): LmsScale => {
  const maximum = Number(assessment.maximum_score);
  const scheme = run?.grading_scheme ?? null;
  const raw: LmsScale = {
    maximum,
    factor: 1,
    basis: "assessment",
    component_id: null,
    why: `out of its own maximum_score, ${g(maximum)}`,
    problem: null,
  };
  if (!scheme) return raw;

  const byId = new Map<string, any>(((scheme.components ?? []) as any[]).map((c) => [c.component_id, c]));
  let scaler: any = null;
  const seen = new Set<string>();
  for (let at = assessment.component ?? null; at && byId.has(at) && !seen.has(at); at = byId.get(at).parent ?? null) {
    seen.add(at);
    if (byId.get(at).points != null) {
      scaler = byId.get(at);
      break;
    }
  }
  if (!scaler && scheme.points == null) return raw;

  const weight = assessment.weight;
  const failed = (problem: string): LmsScale => ({ ...raw, problem });
  if (weight == null) {
    return failed(
      `${assessment.assessment_id} has no weight, so there is no telling what it is out of ` +
        `in ${scaler ? `${scaler.component_id}'s ${g(scaler.points)}` : `the course's ${g(scheme.points)}`}`,
    );
  }
  if (!(maximum > 0)) return failed(`${assessment.assessment_id} has no maximum_score to scale from`);

  let out: number;
  let why: string;
  if (scaler) {
    if (!(scaler.weight > 0)) {
      return failed(`${scaler.component_id} has weight 0, so nothing in it has a share of its ${g(scaler.points)}`);
    }
    out = (weight / scaler.weight) * scaler.points;
    why =
      `${scaler.component_id} (${scaler.title}) is out of ${g(scaler.points)}; this is ` +
      `${g(weight * 100)}% of its ${g(scaler.weight * 100)}%`;
  } else {
    out = weight * scheme.points;
    why = `the course is out of ${g(scheme.points)}; this is ${g(weight * 100)}% of it`;
  }
  out = roundHalfEven(out, 4);
  if (!(out > 0)) return failed(`${assessment.assessment_id} has weight 0, so it is out of nothing in the LMS`);
  return {
    maximum: out,
    factor: out / maximum,
    basis: scaler ? "component" : "course",
    component_id: scaler?.component_id ?? null,
    why,
    problem: null,
  };
};

/** Whether the LMS sees a different number from the one recorded. */
export const rescales = (scale: LmsScale): boolean => Math.abs(scale.factor - 1) > 1e-9;
