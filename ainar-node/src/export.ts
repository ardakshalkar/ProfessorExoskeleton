/**
 * Export authored content into the artefacts the application consumes.
 * Ported from `ainar/export.py`.
 *
 * Nothing here writes to a database. The output is plain JSON: one canonical
 * bundle per course, plus a Course Context document per run. JSON Schema for the
 * model itself is the third artefact Python wrote from this module, and in this
 * tree it already had a home — `src/schema.ts`, behind `ainar schema` — so it is
 * not duplicated here.
 *
 * `bundle_payload` also already existed, in `bundle.ts`, because the MCP course
 * store serves it. This module is the file-writing half only.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CourseBundle, allRubrics, bundlePayload, courseContext, criterionById } from "./bundle.ts";

/**
 * One JSON file, as `_write_json` wrote it: two-space indent, a trailing
 * newline, non-ASCII left alone.
 *
 * `JSON.stringify` does not escape non-ASCII, which is `ensure_ascii=False`, and
 * it preserves insertion order, which is `sort_keys=False`.
 */
const writeJson = (path: string, payload: unknown): string => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf-8" });
  return path;
};

/**
 * The reference date a run's context document is written for.
 *
 * `max(start, min(today, end))` — today while the run is on, and otherwise the
 * nearer end of it, so an export of a finished course is the course as it ended
 * rather than a document about a date it never reached.
 */
export const referenceDate = (run: { start_date: string; end_date: string }, today: string): string =>
  today < run.start_date ? run.start_date : today > run.end_date ? run.end_date : today;

/** Write `bundle.json` and one context document per run. */
export const exportBundle = (
  bundle: CourseBundle,
  outDir: string,
  today: string = new Date().toISOString().slice(0, 10),
): string[] => {
  const courseId = (bundle.course as any).course_id as string;
  const written = [writeJson(join(outDir, courseId, "bundle.json"), bundlePayload(bundle))];

  for (const run of bundle.versions as any[]) {
    written.push(
      writeJson(
        join(outDir, courseId, "context", `${run.course_version_id}.json`),
        courseContext(bundle, run.course_version_id, referenceDate(run, today)),
      ),
    );
  }
  return written;
};

/**
 * Counts per collection, for a quick sense of how complete the content is.
 *
 * The design collections are always present, even at zero — a course with no
 * outcomes should read as `outcomes: 0` rather than as a missing key. The
 * runtime ones appear only when they have something in them, which is how an
 * unstarted run reads as a design document rather than as an empty class.
 */
export const bundleStats = (bundle: CourseBundle): Record<string, number> => {
  const counts: Record<string, number> = {
    versions: bundle.versions.length,
    outcomes: bundle.outcomes.length,
    concepts: bundle.concepts.length,
    capabilities: bundle.capabilities.length,
    modules: bundle.modules.length,
    runs: bundle.versions.length,
    enrollments: bundle.enrollments.length,
    activities: bundle.activities.length,
    documents: bundle.documents.length,
    resources: bundle.resources.length,
    assessments: bundle.assessments.length,
    rubrics: allRubrics(bundle).size,
    item_models: bundle.item_models.length,
    criteria: criterionById(bundle).size,
    items: bundle.items.length,
  };

  const runtime: Record<string, number> = {
    submissions: bundle.submissions.length,
    item_responses: bundle.item_responses.length,
    evaluations: bundle.evaluations.length,
    evidence: bundle.evidence.length,
    signals: bundle.signals.length,
    interventions: bundle.interventions.length,
    events: bundle.events.length,
    action_items: bundle.action_items.length,
  };
  for (const [name, value] of Object.entries(runtime)) if (value) counts[name] = value;
  return counts;
};
