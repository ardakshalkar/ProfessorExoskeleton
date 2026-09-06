/**
 * What a new assessment should cover, before anyone writes a question.
 * Ported from `ainar/blueprint.py`.
 *
 * `outcomeGradeShare` comes from `ainar/report.py` and lands here for now
 * because it is the only part of that module `blueprint` needs; it moves to
 * `report.ts` when that is ported.
 */
import { type CourseBundle } from "./bundle.ts";
/**
 * What fraction of the final grade each outcome actually carries.
 *
 * From rubric criteria, not from the assessment's declared outcome list: a
 * criterion worth 25 of 100 on an assessment weighted 0.20 puts 5% of the final
 * grade on the outcome it measures. Assessments whose criteria name no outcome
 * contribute nothing, which is the honest answer.
 */
export declare const outcomeGradeShare: (b: CourseBundle, courseVersionId: string) => Map<string, number>;
export declare const blueprintPayload: (b: CourseBundle, courseVersionId: string, options?: {
    outcomes?: string[];
    weight?: number | null;
    through?: string | null;
    marks?: number;
}) => Record<string, unknown>;
