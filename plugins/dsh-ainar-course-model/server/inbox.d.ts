/**
 * What is waiting for the professor, assembled from the record.
 * Ported from `ainar/inbox.py`.
 */
import { type CourseBundle } from "./bundle.ts";
export declare const inboxPayload: (b: CourseBundle, courseVersionId: string, on: string) => Record<string, unknown>;
