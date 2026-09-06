/**
 * Documents generated from the canonical model. Ported from `ainar/report.py`.
 *
 * These are the only text outputs, so they are compared as strings rather than
 * structurally — every space, dash and pipe is part of the fixture. Two Python
 * formatting habits carry the risk:
 *
 * - `f"{value:g}"` — shortest form, no trailing zeros: `25`, not `25.0`.
 * - `f"{value * 100:.0f}%"` — fixed to zero decimals, and Python's format spec
 *   rounds half to **even**, so `0.125 * 100` prints `12%`.
 */
import { type CourseBundle } from "./bundle.ts";
export declare const syllabusMarkdown: (b: CourseBundle, courseVersionId: string) => string;
export declare const alignmentMarkdown: (b: CourseBundle, courseVersionId: string) => string;
