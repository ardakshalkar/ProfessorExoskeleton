/**
 * What each assessment type is called on a screen, in the order a class list
 * reads them: homework first, the big pieces after, the rest last.
 *
 * One table, keyed by the model's own `AssessmentType`, so a type the model
 * adds is a compile-time gap here rather than a silent "Other" in one view and
 * a different label in the next. The pane drew two of these by hand, and they
 * had drifted: one listed types the model never allows (`homework`, `lab`,
 * `midterm`, `final`), the other lacked `oral_defense`.
 */

import type { z } from "zod";

import { AssessmentType } from "./model/common.ts";

export type AssessmentTypeName = z.infer<typeof AssessmentType>;

export interface AssessmentKind {
  type: AssessmentTypeName;
  /** One of them: "Quiz", "Homework". */
  one: string;
  /** A column of them: "Quizzes", "Homework". */
  many: string;
}

const LABELS: Record<AssessmentTypeName, { one: string; many: string }> = {
  assignment: { one: "Homework", many: "Homework" },
  quiz: { one: "Quiz", many: "Quizzes" },
  exam: { one: "Exam", many: "Exams" },
  project: { one: "Project", many: "Projects" },
  presentation: { one: "Presentation", many: "Presentations" },
  oral_defense: { one: "Defence", many: "Defences" },
  participation: { one: "Participation", many: "Participation" },
  other: { one: "Other", many: "Other" },
};

/** Every type the model allows, in the reading order of `LABELS` above. */
export const ASSESSMENT_KINDS: readonly AssessmentKind[] = (Object.keys(LABELS) as AssessmentTypeName[]).map(
  (type) => ({ type, ...LABELS[type] }),
);

/** The kind for a type, or an "Other"-shaped kind naming whatever came in. */
export const assessmentKind = (type: string | null | undefined): AssessmentKind =>
  ASSESSMENT_KINDS.find((kind) => kind.type === type) ?? {
    type: (type ?? "other") as AssessmentTypeName,
    one: type || "Other",
    many: type || "Other",
  };
