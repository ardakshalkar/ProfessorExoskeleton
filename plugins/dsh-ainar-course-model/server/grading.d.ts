/**
 * Grading at class scale. Ported from `ainar/grading.py`.
 *
 * `calibrationPayload` is the one that only works because suggestions and
 * decisions are stored side by side and neither overwrites the other — so it
 * counts only `approved` and `overridden` evaluations that carried both.
 */
import { type CourseBundle } from "./bundle.ts";
/**
 * Python's `round()` is banker's rounding — `round(0.125, 2)` is `0.12`, not
 * `0.13`. Matching it matters: an agreement rate is compared against a fixture.
 */
export declare const roundHalfEven: (value: number, digits: number) => number;
/** One assessment with its rubric and items resolved, for a grading agent. */
export declare const rubricPayload: (b: CourseBundle, assessmentId: string) => Record<string, unknown> | null;
/** What is left to grade — one submission times one criterion is one judgement. */
export declare const pendingPayload: (b: CourseBundle, courseVersionId: string, assessmentId?: string) => Record<string, unknown>;
/** How closely the grading agent tracks the professor, per criterion. */
export declare const calibrationPayload: (b: CourseBundle, courseVersionId: string) => Record<string, unknown>;
