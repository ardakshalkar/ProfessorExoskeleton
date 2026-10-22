/**
 * What work not handed in gets: `ainar grading missing-work`.
 *
 * The rule is the professor's (`MissingWork`): `blank` leaves the mark empty,
 * `zero` gives 0 once the due date has passed. It is set for the whole run on
 * `grading_scheme.missing_work`, and an assessment can say otherwise on its
 * own `missing_work` — a final project nobody should get 0 on before it is
 * defended, a quiz that was optional. Clearing an assessment's rule puts it
 * back on the run's.
 *
 * It moves every total a missing student has, so it is part of the grading
 * policy: refused while the policy is locked, and each change of the run's
 * rule is a line in `grading_scheme.extensions.history`. That line carries
 * `was`, not `before`, so the pane does not offer to restore it as if it were
 * a change of blocks and weights.
 *
 * Written through the document API, so comments and the rest of each record
 * stay as they were.
 */

import { assessmentsOf, runById, type CourseBundle } from "./bundle.ts";
import { COLLECTIONS } from "./loader.ts";
import { MissingWork } from "./model/common.ts";
import { editRecords } from "./record-edit.ts";

export type MissingWorkRule = "blank" | "zero";

export const setMissingWork = (options: {
  root: string;
  bundle: CourseBundle;
  runId: string;
  /** One assessment's own rule; absent, the run's. */
  assessmentId?: string | null;
  /** `null` clears: an assessment goes back to the run's rule, the run to `blank`. */
  rule: MissingWorkRule | null;
  at: string;
  by?: string | null;
  note?: string | null;
}): string[] => {
  const { root, bundle, runId, assessmentId = null, rule, at, by = null, note = null } = options;
  if (rule !== null && !MissingWork.safeParse(rule).success) throw new Error(`missing work is blank or zero, not '${rule}'`);
  const run = runById(bundle).get(runId) as any;
  if (!run) throw new Error(`no course run '${runId}'`);
  if (run.grading_scheme?.locked === true) {
    throw new Error("the grading policy is locked; unlock it in the Gradebook first. Nothing was written.");
  }
  const courseId = String((bundle.course as any).course_id);

  if (assessmentId) {
    const assessment = assessmentsOf(bundle, runId).find((entry: any) => entry.assessment_id === assessmentId) as any;
    if (!assessment) throw new Error(`${assessmentId} is not an assessment of ${runId}`);
    if ((assessment.missing_work ?? null) === rule) return [];
    return editRecords({
      root,
      courseId,
      patterns: COLLECTIONS.assessments,
      idField: "assessment_id",
      collection: "assessments",
      edits: new Map([
        [
          assessmentId,
          (node: any) => {
            if (rule) node.set("missing_work", rule);
            else if (node.has("missing_work")) node.delete("missing_work");
          },
        ],
      ]),
    }).written;
  }

  const was = run.grading_scheme?.missing_work ?? null;
  if (was === rule) return [];
  const entry: Record<string, unknown> = {
    at,
    action: "missing_work",
    summary: [`Work not handed in: ${rule ?? "blank"} once due (was ${was ?? "blank"}).`],
    was,
  };
  if (by) entry.by = by;
  if (note) entry.note = note;
  return editRecords({
    root,
    courseId,
    patterns: COLLECTIONS.versions,
    idField: "course_version_id",
    collection: "versions",
    edits: new Map([
      [
        runId,
        (node: any, document: any) => {
          if (rule) node.setIn(["grading_scheme", "missing_work"], rule);
          else if (node.hasIn(["grading_scheme", "missing_work"])) node.deleteIn(["grading_scheme", "missing_work"]);
          const list = node.getIn(["grading_scheme", "extensions", "history"]);
          if (list && Array.isArray(list.items)) list.items.push(document.createNode(entry));
          else node.setIn(["grading_scheme", "extensions", "history"], document.createNode([entry]));
        },
      ],
    ]),
  }).written;
};
