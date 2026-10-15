/**
 * The professor's check of a homework against its own rubric, at the defence.
 *
 * A defence asks, criterion by criterion, whether the student can stand behind
 * what they handed in. The professor says so per criterion — `confirmed`,
 * `partly` or `not_confirmed` — and that word changes the mark:
 *
 *   confirmed      the written mark stands
 *   partly         the profile's `marking.defence.partial_factor` of the written
 *                  mark (half unless changed), unless the professor gives a score
 *   not_confirmed  0, unless the professor gives a score
 *
 * The written mark is the decision the criterion had before any defence — the
 * grade sheet's, the pane's — and it is never lost: the decision it replaces
 * goes into `extensions.history`, as every replaced decision does
 * (`decideGrades`), and `clear` puts it back. A defence decision is
 * `decided_via: defence`, which the grade sheet's sync leaves alone.
 *
 * Nothing here is a suggestion. The word and the score are the professor's;
 * an agent only runs this when the professor has said them.
 */

import type { CourseBundle } from "./bundle.ts";
import { allRubrics } from "./bundle.ts";
import { evaluationId } from "./grade-board.ts";
import { activeProfile } from "./profile.ts";

export const DEFENCE_VIA = "defence";

export type DefenceCheck = "confirmed" | "partly" | "not_confirmed";
export const DEFENCE_CHECKS: readonly DefenceCheck[] = ["confirmed", "partly", "not_confirmed"];

export interface CheckMark {
  criterion: string;
  /** `clear` takes the defence back and restores the written mark. */
  outcome: DefenceCheck | "clear";
  /** Overrides the score the outcome would give. */
  score?: number | null;
}

export interface CheckResult {
  /** Evaluations to upsert with `writeRecords`. */
  evaluations: any[];
  /** Evaluations the defence created and `clear` takes away entirely. */
  removed: string[];
  /** One line per criterion, for the terminal. */
  said: string[];
}

const round = (value: number): number => Math.round(value * 100) / 100;

const SAID: Record<DefenceCheck, string> = {
  confirmed: "confirmed at the defence",
  partly: "partly confirmed at the defence",
  not_confirmed: "not confirmed at the defence",
};

/** The decision a criterion had before the defence, or null when it had none. */
export const writtenDecision = (evaluation: any): { decision: any; via: string | null; at: number } | null => {
  if (!evaluation) return null;
  const decided = ["approved", "overridden"].includes(evaluation.status) ? evaluation.professor_decision : null;
  const via = (evaluation.extensions?.decided_via as string | undefined) ?? null;
  if (decided && via !== DEFENCE_VIA) return { decision: decided, via, at: -1 };
  const history: any[] = Array.isArray(evaluation.extensions?.history) ? evaluation.extensions.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.via !== DEFENCE_VIA) return { decision: history[index], via: history[index]?.via ?? null, at: index };
  }
  return null;
};

/** The criteria of an assessment's rubric, by id. */
export const criteriaOf = (bundle: CourseBundle, assessmentId: string): Map<string, any> => {
  const assessment = (bundle.assessments as any[]).find((entry) => entry.assessment_id === assessmentId);
  if (!assessment) throw new Error(`no assessment ${assessmentId}`);
  const rubric = assessment.rubric ?? allRubrics(bundle).get(assessment.rubric_id ?? "");
  if (!rubric || !Array.isArray(rubric.criteria) || !rubric.criteria.length) {
    throw new Error(`${assessmentId} has no rubric: a defence is checked against its criteria`);
  }
  return new Map(rubric.criteria.map((criterion: any) => [String(criterion.criterion_id), criterion]));
};

export const checkDefence = (options: {
  bundle: CourseBundle;
  submission: any;
  marks: CheckMark[];
  by: string;
  at: string;
}): CheckResult => {
  const { bundle, submission, marks, by, at } = options;
  if (!/^USER-[A-Z0-9][A-Z0-9-]*$/.test(by)) {
    throw new Error(`a decision says who made it: ${by || "nobody"} is not a USER- id (the run lists no instructor?)`);
  }
  const criteria = criteriaOf(bundle, submission.assessment_id);
  const evaluations = (bundle.evaluations as any[]) ?? [];
  const result: CheckResult = { evaluations: [], removed: [], said: [] };
  const seen = new Set<string>();

  // Every mark is checked before any is returned: a list either holds or is refused.
  for (const mark of marks) {
    const criterion = criteria.get(mark.criterion);
    if (!criterion) {
      throw new Error(`${mark.criterion} is not a criterion of ${submission.assessment_id} (${[...criteria.keys()].join(", ")})`);
    }
    if (seen.has(mark.criterion)) throw new Error(`${mark.criterion} is marked twice in one list`);
    seen.add(mark.criterion);
    if (mark.outcome !== "clear" && !DEFENCE_CHECKS.includes(mark.outcome)) {
      throw new Error(`${mark.outcome} is not confirmed, partly, not_confirmed or clear`);
    }
    const maximum = Number(criterion.maximum_score);
    if (mark.score != null && (!Number.isFinite(mark.score) || mark.score < 0 || mark.score > maximum)) {
      throw new Error(`${mark.criterion}: ${mark.score} is outside 0–${maximum}`);
    }

    const before =
      evaluations.find((entry) => entry.submission_id === submission.submission_id && entry.criterion_id === mark.criterion) ??
      null;
    const id = before?.evaluation_id ?? evaluationId(submission.student_id, mark.criterion);
    const written = writtenDecision(before);
    const extensions: Record<string, unknown> = { ...(before?.extensions ?? {}) };
    const history: any[] = Array.isArray(extensions.history) ? [...(extensions.history as any[])] : [];

    if (mark.outcome === "clear") {
      if (!before || before.extensions?.decided_via !== DEFENCE_VIA) {
        result.said.push(`${mark.criterion}: no defence mark to clear`);
        continue;
      }
      if (!written) {
        // The defence made this evaluation's only decision.
        if (before.ai_suggestion) {
          delete extensions.decided_via;
          const left = history.filter((entry) => entry?.via !== DEFENCE_VIA);
          if (left.length) extensions.history = left;
          else delete extensions.history;
          const { professor_decision: _dropped, extensions: _old, ...rest } = before;
          result.evaluations.push({ ...rest, status: "suggested", ...(Object.keys(extensions).length ? { extensions } : {}) });
        } else {
          result.removed.push(id);
        }
        result.said.push(`${mark.criterion}: defence cleared, no mark before it`);
        continue;
      }
      const restored = { ...written.decision };
      const via = restored.via ?? written.via;
      const status = restored.status;
      delete restored.via;
      delete restored.status;
      const left = written.at >= 0 ? history.slice(0, written.at) : history;
      if (left.length) extensions.history = left;
      else delete extensions.history;
      if (via) extensions.decided_via = via;
      else delete extensions.decided_via;
      result.evaluations.push({
        evaluation_id: id,
        submission_id: submission.submission_id,
        criterion_id: mark.criterion,
        ...(before.ai_suggestion ? { ai_suggestion: before.ai_suggestion } : {}),
        professor_decision: Object.fromEntries(Object.entries(restored).filter(([, value]) => value != null)),
        status:
          status ??
          (before.ai_suggestion && Number(before.ai_suggestion.score) !== Number(restored.score) ? "overridden" : "approved"),
        ...(Object.keys(extensions).length ? { extensions } : {}),
      });
      result.said.push(`${mark.criterion}: defence cleared, back to ${restored.score}`);
      continue;
    }

    const base = written ? Number(written.decision.score) : null;
    let score: number;
    if (mark.score != null) score = round(mark.score);
    else if (mark.outcome === "not_confirmed") score = 0;
    else if (base == null) {
      throw new Error(`${mark.criterion} has no mark yet, so "${mark.outcome}" needs a --score (0–${maximum})`);
    } else score = mark.outcome === "partly" ? round(base * activeProfile().marking.defence.partial_factor) : base;

    const previous = before && ["approved", "overridden"].includes(before.status) ? before.professor_decision : null;
    if (previous && before.extensions?.decided_via === DEFENCE_VIA && previous.defence === mark.outcome && Number(previous.score) === score) {
      result.said.push(`${mark.criterion}: already ${mark.outcome}, ${score}`);
      continue;
    }
    if (previous) {
      history.push({
        score: previous.score,
        comment: previous.comment ?? null,
        decided_by: previous.decided_by ?? null,
        decided_at: previous.decided_at ?? null,
        via: (before.extensions?.decided_via as string | undefined) ?? null,
        // What `clear` restores, beside the mark.
        status: before.status,
        ...(previous.defence ? { defence: previous.defence } : {}),
      });
      extensions.history = history;
    }
    extensions.decided_via = DEFENCE_VIA;
    const comment = SAID[mark.outcome] + (base != null ? ` (written ${base})` : "");
    result.evaluations.push({
      evaluation_id: id,
      submission_id: submission.submission_id,
      criterion_id: mark.criterion,
      ...(before?.ai_suggestion ? { ai_suggestion: before.ai_suggestion } : {}),
      professor_decision: { score, comment, decided_by: by, decided_at: at, defence: mark.outcome },
      status: before?.ai_suggestion && Number(before.ai_suggestion.score) !== score ? "overridden" : "approved",
      extensions,
    });
    result.said.push(`${mark.criterion}: ${mark.outcome.replace("_", " ")}, ${base != null ? `${base} → ` : ""}${score} of ${maximum}`);
  }
  return result;
};
