/**
 * When and how each grade changed, read back out of the evaluations.
 *
 * Nothing is kept twice. Every writer of a decision — the pane's Grade view
 * (`decideGrades`), the grade sheet's sync (`planSync`), the defence's rubric
 * check (`checkDefence`) — puts the decision it replaces into the evaluation's
 * `extensions.history` and marks the new one with `decided_via`. Read in order,
 * history then the current decision is the life of one mark, and each step of
 * it is a change: from what, to what, when, by whom and by which road.
 *
 * What is not here: a mark the grade sheet took back when its cell was
 * emptied, since that removes the evaluation and its history with it — git
 * has that one — and a suggestion nobody decided, which is not a grade.
 */

import type { CourseBundle } from "./bundle.ts";
import { allRubrics, assessmentsOf } from "./bundle.ts";
import type { Grid } from "./lms/grid.ts";
import { STUDENT } from "./lms/grid.ts";

export interface GradeChange {
  at: string | null;
  student_id: string;
  assessment_id: string;
  criterion_id: string;
  criterion: string;
  maximum: number | null;
  /** Null for the first decision on the criterion. */
  from: number | null;
  to: number;
  /** The road: pane, group, accept all, grade sheet, defence, or by hand. */
  how: string;
  defence: string | null;
  by: string | null;
  comment: string | null;
  evaluation_id: string;
}

const HOW: Record<string, string> = {
  one: "pane",
  group: "pane, group",
  all: "pane, accept all",
  "grade-sheet": "grade sheet",
  defence: "defence",
};
export const howOf = (via: string | null | undefined): string => (via ? (HOW[via] ?? via) : "by hand");

export const gradeChanges = (
  bundle: CourseBundle,
  runId: string,
  { assessment, student }: { assessment?: string; student?: string } = {},
): GradeChange[] => {
  const assessments = new Map(assessmentsOf(bundle, runId).map((entry: any) => [entry.assessment_id as string, entry]));
  const submissions = new Map(((bundle.submissions as any[]) ?? []).map((entry) => [entry.submission_id as string, entry]));
  const rubrics = allRubrics(bundle);
  const criteria = new Map<string, any>();
  for (const entry of assessments.values()) {
    const rubric = entry.rubric ?? rubrics.get(entry.rubric_id ?? "");
    for (const criterion of rubric?.criteria ?? []) criteria.set(criterion.criterion_id, criterion);
  }

  const changes: GradeChange[] = [];
  for (const evaluation of (bundle.evaluations as any[]) ?? []) {
    const submission = submissions.get(evaluation.submission_id);
    if (!submission || !assessments.has(submission.assessment_id)) continue;
    if (assessment && submission.assessment_id !== assessment) continue;
    if (student && submission.student_id !== student) continue;
    const history: any[] = Array.isArray(evaluation.extensions?.history) ? evaluation.extensions.history : [];
    const decided = ["approved", "overridden"].includes(evaluation.status) && evaluation.professor_decision;
    const steps = [
      ...history.map((entry) => ({ ...entry })),
      ...(decided ? [{ ...evaluation.professor_decision, via: evaluation.extensions?.decided_via ?? null }] : []),
    ].filter((step) => step && step.score != null && Number.isFinite(Number(step.score)));
    const criterion = criteria.get(evaluation.criterion_id);
    let from: number | null = null;
    for (const step of steps) {
      const to = Number(step.score);
      changes.push({
        at: step.decided_at ? String(step.decided_at) : null,
        student_id: submission.student_id,
        assessment_id: submission.assessment_id,
        criterion_id: evaluation.criterion_id,
        criterion: String(criterion?.title ?? evaluation.criterion_id),
        maximum: criterion?.maximum_score != null ? Number(criterion.maximum_score) : null,
        from,
        to,
        how: howOf(step.via),
        defence: step.defence ?? null,
        by: step.decided_by ?? null,
        comment: step.comment ?? null,
        evaluation_id: evaluation.evaluation_id,
      });
      from = to;
    }
  }
  // Oldest first, as a log reads; an undated decision (typed by hand, before
  // stamps were required) first of all, since it can only be the earliest.
  const when = (change: GradeChange) => (change.at ? Date.parse(change.at) : -Infinity);
  return changes.sort(
    (left, right) =>
      when(left) - when(right) ||
      left.student_id.localeCompare(right.student_id) ||
      left.criterion_id.localeCompare(right.criterion_id),
  );
};

/** Only the steps that moved a mark — a first decision, or a different score. */
export const realChanges = (changes: GradeChange[]): GradeChange[] =>
  changes.filter((change) => change.from === null || change.from !== change.to);

const shown = (value: number | null): string => (value === null ? "" : String(Math.round(value * 100) / 100));

/** The Grade changes tab: one row per change, newest first, as a log is read in a sheet. */
export const changesGrid = (changes: GradeChange[], { names = {} }: { names?: Record<string, string> } = {}): Grid => {
  const rows = [...changes].reverse();
  return {
    header: [STUDENT, "name", "when", "assessment", "criterion", "from", "to", "of", "how", "defence", "by", "comment"],
    lead: [],
    rows: rows.map((change) => [
      change.student_id,
      names[change.student_id] ?? "",
      change.at ?? "",
      change.assessment_id,
      change.criterion,
      shown(change.from),
      shown(change.to),
      shown(change.maximum),
      change.how,
      change.defence ? change.defence.replace("_", " ") : "",
      change.by ?? "",
      change.comment ?? "",
    ]),
    students: rows.map((change) => change.student_id),
    note: null,
  };
};
