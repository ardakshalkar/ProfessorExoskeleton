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
 *
 * ## A block adds up to its points on the page
 *
 * Canvas shows points to two decimals, and students add up what they see. A
 * ВСК1 of one 10% midterm, four 4% homeworks and three 1.33% quizzes is
 * 33.3333 + 4 × 13.3333 + 3 × 4.4444 — which Canvas shows as 99.97. So when
 * the run's assessments are given, a block is apportioned in whole cents by
 * largest remainder: each member gets its share rounded down, and the cents
 * left over go to the largest remainders (ties to the earlier id), so the
 * block is 33.33 + 4 × 13.33 + 3 × 4.45 = 100.00. Only a block whose members'
 * shares already add up to its points is apportioned; one still being filled
 * in is rounded member by member. Without the run's assessments the share is
 * rounded to four places on its own, as it always was.
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

/** The nearest block above the assessment that sets `points`, or null for the scheme's own. */
const scalerOf = (scheme: any, assessment: any): any => {
  const byId = new Map<string, any>(((scheme.components ?? []) as any[]).map((c) => [c.component_id, c]));
  const seen = new Set<string>();
  for (let at = assessment.component ?? null; at && byId.has(at) && !seen.has(at); at = byId.get(at).parent ?? null) {
    seen.add(at);
    if (byId.get(at).points != null) return byId.get(at);
  }
  return null;
};

/**
 * The block's points in whole cents, by largest remainder, keyed by assessment
 * id — or null when the members' shares do not add up to the block's points.
 */
const apportioned = (scheme: any, scaler: any, peers: readonly any[]): Map<string, number> | null => {
  const total: number = scaler ? scaler.points : scheme.points;
  const share = (a: any): number => (scaler ? (a.weight / scaler.weight) * scaler.points : a.weight * scheme.points);
  const members = peers
    .filter((a) => a.weight != null && a.weight > 0 && (scalerOf(scheme, a)?.component_id ?? null) === (scaler?.component_id ?? null))
    .map((a) => ({ id: String(a.assessment_id), cents: share(a) * 100 }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const wanted = Math.round(total * 100);
  if (!members.length || Math.abs(members.reduce((sum, m) => sum + m.cents, 0) - wanted) > 1e-6) return null;
  const floors = members.map((m) => ({ ...m, floor: Math.floor(m.cents + 1e-6) }));
  let left = wanted - floors.reduce((sum, m) => sum + m.floor, 0);
  const byRemainder = [...floors].sort((a, b) => b.cents - b.floor - (a.cents - a.floor) || a.id.localeCompare(b.id));
  const extra = new Set<string>();
  for (const m of byRemainder) {
    if (left <= 0) break;
    extra.add(m.id);
    left -= 1;
  }
  return new Map(floors.map((m) => [m.id, (m.floor + (extra.has(m.id) ? 1 : 0)) / 100]));
};

export const lmsScale = (run: any, assessment: any, peers?: readonly any[]): LmsScale => {
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

  const scaler = scalerOf(scheme, assessment);
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
  const cents = peers ? apportioned(scheme, scaler, peers)?.get(String(assessment.assessment_id)) : undefined;
  out = cents ?? roundHalfEven(out, 4);
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
