/**
 * Criterion decisions to an assessment score, and nothing more clever.
 * Ported from `ainar/gradebook.py`.
 *
 * The four refusals are the whole module, and each one fails **silently** if
 * mistranslated — a wrong total looks exactly like a right total. They are:
 *
 * 1. Only decisions count. `approved`/`overridden`, read from
 *    `professor_decision`. A suggestion never becomes a grade.
 * 2. A missing judgement is not a zero. Undecided → `partially_graded`, not
 *    exportable; never submitted → `score: null`, never 0.
 * 3. Nothing is rescaled. Criteria summing to 90 against a maximum of 100
 *    blocks the row rather than stretching it.
 * 4. Only the professor's words travel. Row comments come from
 *    `professor_decision.comment` alone.
 */
import { type CourseBundle } from "./bundle.ts";
export declare const GRADEBOOK_VERSION = "gradebook/2026.08.1";
export interface CriterionScore {
    criterion_id: string;
    title: string;
    maximum: number;
    score: number | null;
    source: string | null;
    status: string;
    comment: string | null;
    note: string | null;
}
export interface GradeRow {
    student_id: string;
    assessment_id: string;
    maximum: number;
    submission_id: string | null;
    status: string;
    score: number | null;
    criteria: CriterionScore[];
    comment: string | null;
    blocked: string[];
}
/** A decision always wins: a human looked at the work. */
export declare const resolveCriterion: (spec: any, evaluations: Map<string, any>, items: any[], responses: Map<string, any>) => CriterionScore;
export declare const gradeRows: (b: CourseBundle, courseVersionId: string, options?: {
    assessmentId?: string | null;
    allowPartial?: boolean;
}) => Map<string, GradeRow[]>;
export declare const gradebookPayload: (b: CourseBundle, courseVersionId: string, options?: {
    assessmentId?: string | null;
    allowPartial?: boolean;
}) => Record<string, unknown>;
