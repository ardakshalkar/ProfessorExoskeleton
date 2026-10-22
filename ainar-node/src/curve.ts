/**
 * Setting an assessment's curve, and taking it off: `ainar curve`, and the
 * pane's Curve section, which spawns it.
 *
 * The curve is the professor's decision (see `ScoreCurve`), so it is written
 * in force and signed — `decided_by`, `decided_at` — and the gradebook applies
 * it from then on. The criterion decisions are never touched: taking the curve
 * off puts every total back to what the criteria add up to.
 *
 * Written through the document API, so the professor's comments and the rest
 * of the record stay as they were.
 */

import { assessmentsOf, enrolledIn, type CourseBundle } from "./bundle.ts";
import { COLLECTIONS } from "./loader.ts";
import { ScoreCurve } from "./model/assessment.ts";
import { editRecords } from "./record-edit.ts";

export interface CurveSettings {
  anchor: number;
  exponent: number;
  /** Students the curve passes over; their total counts as marked. */
  exclude?: string[];
  note?: string | null;
  by: string;
  at: string;
}

/**
 * Put `settings` on the assessment, replacing any curve it had, or take the
 * curve off with `null`. Refused before anything is written: an assessment
 * not in the run, a curve that would lower a mark, a student not enrolled.
 */
export const setCurve = (options: {
  root: string;
  bundle: CourseBundle;
  runId: string;
  assessmentId: string;
  settings: CurveSettings | null;
}): string[] => {
  const { root, bundle, runId, assessmentId, settings } = options;
  const assessment = assessmentsOf(bundle, runId).find((entry: any) => entry.assessment_id === assessmentId) as any;
  if (!assessment) throw new Error(`${assessmentId} is not an assessment of ${runId}`);

  let curve: any = null;
  if (settings) {
    const enrolled = new Set(enrolledIn(bundle, runId).map((entry: any) => entry.student_id));
    const exclude = [...new Set(settings.exclude ?? [])].sort();
    const strangers = exclude.filter((id) => !enrolled.has(id));
    if (strangers.length) throw new Error(`not enrolled in ${runId}: ${strangers.join(", ")}`);
    curve = {
      kind: "power",
      anchor: settings.anchor,
      exponent: settings.exponent,
      ...(exclude.length ? { exclude } : {}),
      decided_by: settings.by || null,
      decided_at: settings.at,
      ...(settings.note ? { note: settings.note } : {}),
    };
    const parsed = ScoreCurve.safeParse(curve);
    if (!parsed.success) throw new Error(`not a curve: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`);
    if (curve.anchor > assessment.maximum_score) {
      throw new Error(`the anchor ${curve.anchor} is above ${assessmentId}'s maximum ${assessment.maximum_score}, so the curve would lower marks`);
    }
  } else if (!assessment.curve) {
    return [];
  }

  return editRecords({
    root,
    courseId: String((bundle.course as any).course_id),
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
    edits: new Map([
      [
        assessmentId,
        (node: any) => {
          if (curve) node.set("curve", curve);
          else if (node.has("curve")) node.delete("curve");
        },
      ],
    ]),
  }).written;
};
