/**
 * What one student demonstrated, and where the class stands.
 * Ported from `ainar/progress.py`.
 *
 * The distinction the whole thing rests on: a **blank** is a concept nothing
 * assessed, and is not a zero. It stays `null` here and is counted separately
 * in `concepts_with_no_evidence`.
 */
import { type CourseBundle } from "./bundle.ts";
/** Everything the course knows about one student, with sources attached. */
export declare const studentRecord: (b: CourseBundle, courseVersionId: string, studentId: string) => Record<string, unknown>;
/** The class as a grid: concepts in teaching order against students. */
export declare const dashboardPayload: (b: CourseBundle, courseVersionId: string) => Record<string, unknown>;
