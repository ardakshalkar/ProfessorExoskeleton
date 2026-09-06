/**
 * The run as a term plan. Ported from `ainar/outline.py`.
 *
 * Read that module's docstring for why placement works the way it does — a
 * meeting sits in its module's week and an assessment in the week its deadline
 * falls in. What is worth saying twice is the arithmetic, because it is the only
 * part that can differ between the two languages:
 *
 * - **Days are counted in UTC.** `daysBetween` parses both ends at midnight Z,
 *   so a run that starts in Almaty is not one week off because the machine
 *   running this is west of it.
 * - **A local date is the first ten characters of the timestamp**, not what
 *   `new Date(...)` says. Python's `datetime.date()` on an aware datetime gives
 *   the date in that datetime's own offset; slicing gives the same answer and
 *   `report.ts` already relies on it for due dates.
 */
import { type CourseBundle } from "./bundle.ts";
/** How placement works, carried in the payload so a surface can print it. */
export declare const PLACEMENT: string;
export declare const outlinePayload: (b: CourseBundle, courseVersionId: string, on: string) => Record<string, unknown>;
