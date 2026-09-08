/**
 * Check the Node port against the fixtures the Python engine produced.
 *
 *     node --experimental-strip-types bin/golden-check.ts [workspace-root]
 *
 * Phase 1 covers `<course>/bundle.json` only; the rest arrive with Phase 2 and
 * are reported as pending rather than passing, because a port that silently
 * skips what it has not implemented is worse than one that fails.
 *
 * Comparison is **structural, not byte-for-byte.** The plan originally said
 * bytes; that was wrong and this is the correction. Python writes an integral
 * float as `5.0` and JSON.stringify writes `5` — the same number, a different
 * string. Contorting either side to agree on the text would be checking the
 * serialiser rather than the logic. So both are parsed and compared by value,
 * with array order significant and object key order not.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { assessmentsOf, bundlePayload, courseContext, enrollmentsOf } from "../src/bundle.ts";
import { calibrationPayload, pendingPayload, rubricPayload } from "../src/grading.ts";
import { blueprintPayload } from "../src/blueprint.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { alignmentMarkdown, syllabusMarkdown } from "../src/report.ts";
import { inboxPayload } from "../src/inbox.ts";
import { outlinePayload } from "../src/outline.ts";
import { dashboardPayload, studentRecord } from "../src/progress.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { validatePayload } from "../src/validate.ts";

const root = resolve(process.argv[2] ?? join(import.meta.dirname, "..", ".."));
const golden = join(root, "golden");

/** Deep equality with numeric comparison. Returns the first path that differs. */
const difference = (left: unknown, right: unknown, path = ""): string | null => {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return `${path}: array vs non-array`;
    if (left.length !== right.length) {
      return `${path}: ${left.length} item(s) here, ${right.length} in the fixture`;
    }
    for (let index = 0; index < left.length; index += 1) {
      const found = difference(left[index], right[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    const ours = Object.keys(left as object).sort();
    const theirs = Object.keys(right as object).sort();
    const missing = theirs.filter((key) => !ours.includes(key));
    const extra = ours.filter((key) => !theirs.includes(key));
    if (missing.length) return `${path}: missing ${missing.join(", ")}`;
    if (extra.length) return `${path}: unexpected ${extra.join(", ")}`;
    for (const key of theirs) {
      const found = difference(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
      );
      if (found) return found;
    }
    return null;
  }

  if (typeof left === "number" && typeof right === "number") {
    return Object.is(left, right) || Math.abs(left - right) < 1e-9
      ? null
      : `${path}: ${left} here, ${right} in the fixture`;
  }

  return left === right
    ? null
    : `${path}: ${JSON.stringify(left)} here, ${JSON.stringify(right)} in the fixture`;
};

/** The midpoint of a run — the same pin `ainar/golden.py` uses. */
const midpoint = (start: string, end: string): string => {
  const days = Math.floor((Date.parse(end) - Date.parse(start)) / 86_400_000);
  return new Date(Date.parse(start) + Math.floor(days / 2) * 86_400_000).toISOString().slice(0, 10);
};

let checked = 0;
let failed = 0;

/**
 * Line endings are normalised before comparing, and that is not a loosening.
 *
 * These fixtures are stored with LF and this repository is checked out with
 * `core.autocrlf=true`, so on Windows every markdown fixture arrives with CRLF
 * and every line differs at column one. Python never saw it: `Path.read_text`
 * translates on read, which is why upstream's checker could compare the strings
 * directly. `readFileSync` does not translate, so the translation is done here.
 *
 * What it costs: this checker can no longer tell a real line-ending change from
 * a checkout artefact. Nothing here produces `\r` — every writer in `src/` emits
 * `\n` — so there is no real one to miss, and the alternative was two fixtures
 * that failed on every Windows machine and told the reader nothing.
 */
const lf = (text: string): string => text.replace(/\r\n/g, "\n");

const compareText = (relative: string, produced: string): void => {
  const fixture = join(golden, relative);
  if (!existsSync(fixture)) return;
  checked += 1;
  const expected = lf(readFileSync(fixture, "utf-8"));
  if (lf(produced) === expected) {
    console.log(`ok    ${relative}`);
    return;
  }
  failed += 1;
  const ours = produced.split("\n");
  const theirs = expected.split("\n");
  const at = ours.findIndex((line, index) => line !== theirs[index]);
  console.log(`FAIL  ${relative}`);
  console.log(`        line ${at + 1}:`);
  console.log(`          here:    ${JSON.stringify(ours[at])}`);
  console.log(`          fixture: ${JSON.stringify(theirs[at])}`);
};

const compare = (relative: string, produced: unknown): void => {
  const fixture = join(golden, relative);
  if (!existsSync(fixture)) return;
  checked += 1;
  const found = difference(produced, JSON.parse(readFileSync(fixture, "utf-8")));
  if (found) {
    failed += 1;
    console.log(`FAIL  ${relative}\n        ${found}`);
  } else {
    console.log(`ok    ${relative}`);
  }
};

for (const courseDir of discoverCourses(root)) {
  const courseId = courseDir.split(/[\\/]/).pop()!;
  const { bundle, issues } = loadCourse(courseDir, root);

  if (!bundle) {
    checked += 1;
    failed += 1;
    console.log(`FAIL  ${courseId} — did not load`);
    for (const issue of issues.errors.slice(0, 5)) console.log(`        ${issue.code}: ${issue.message}`);
    continue;
  }

  compare(`${courseId}/bundle.json`, bundlePayload(bundle));
  compare(`${courseId}/validate.json`, validatePayload(bundle));

  for (const run of bundle.versions as any[]) {
    const base = `${courseId}/${run.term}`;
    const on = midpoint(run.start_date, run.end_date);
    compare(`${base}/course_context.json`, courseContext(bundle, run.course_version_id, on));
    compare(`${base}/course_outline.json`, outlinePayload(bundle, run.course_version_id, on));
    compare(`${base}/pending_judgements.json`, pendingPayload(bundle, run.course_version_id));
    compare(`${base}/action_inbox.json`, inboxPayload(bundle, run.course_version_id, on));
    compare(`${base}/calibration.json`, calibrationPayload(bundle, run.course_version_id));

    compare(`${base}/class_progress.json`, dashboardPayload(bundle, run.course_version_id));
    compare(`${base}/assessment_blueprint.json`, blueprintPayload(bundle, run.course_version_id));
    compare(`${base}/gradebook.json`, gradebookPayload(bundle, run.course_version_id));
    compareText(`${base}/syllabus.md`, syllabusMarkdown(bundle, run.course_version_id));
    compareText(`${base}/alignment_report.md`, alignmentMarkdown(bundle, run.course_version_id));

    for (const enrollment of enrollmentsOf(bundle, run.course_version_id) as any[]) {
      const id = enrollment.student_id;
      compare(`${base}/student-${id}.json`, studentRecord(bundle, run.course_version_id, id));
    }

    for (const assessment of assessmentsOf(bundle, run.course_version_id) as any[]) {
      const id = assessment.assessment_id;
      compare(`${base}/assessment_rubric-${id}.json`, rubricPayload(bundle, id));
      compare(`${base}/gradebook-${id}.json`, gradebookPayload(bundle, run.course_version_id, { assessmentId: id }));
    }
  }
}

// `list_courses` and `validate_course` deliberately differ from their fixtures:
// both carry a coverage object the Python server has no need for, because the
// Python validator is complete and this one is not. Matching the fixtures would
// mean dropping the only field that says so — and for `validate_course`, whose
// whole payload is the issue list, a shorter list than Python's with nothing to
// explain the gap is the worst thing this port could return.
const pending = [
  "list_courses (reports partial-validator coverage the fixture has no field for)",
  "validate_course (same, and its issue list is as partial as the validator)",
];
console.log(`\n${checked - failed}/${checked} fixture(s) reproduced`);
console.log(`still pending: ${pending.join(", ")}`);

process.exit(failed ? 1 : 0);
