/**
 * Work not handed in: blank unless the professor's policy says zero, and then
 * only once the due date has passed.
 *
 *     node --experimental-strip-types --test test/missing-work.test.ts
 */

import { strict as assert } from "node:assert";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { runById } from "../src/bundle.ts";
import { buildPlan } from "../src/lms/base.ts";
import { exportable, gradeRows, gradebookPayload, missingWorkOf } from "../src/gradebook.ts";
import { setMissingWork } from "../src/missing-work.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const ID = "ASSESSMENT-02";
const DUE = "2026-10-01T09:00:00+05:00";
const AFTER = Date.parse("2026-10-02T00:00:00+05:00");
const BEFORE = Date.parse("2026-09-30T00:00:00+05:00");

const sample: any = new Workspace(ROOT, "flag").findRun(RUN);

/** The sample with ASSESSMENT-02 due on DUE and the given rules in place. */
const course = (run: "blank" | "zero" | null, own: "blank" | "zero" | null = null, due: string | null = DUE) => {
  const b: any = structuredClone(sample);
  const record = b.assessments.find((a: any) => a.assessment_id === ID);
  record.due_at = due;
  if (own) record.missing_work = own;
  const version = runById(b).get(RUN) as any;
  if (run) version.grading_scheme = { ...(version.grading_scheme ?? {}), missing_work: run };
  return b;
};

const missing = (b: any, now: number) =>
  gradeRows(b, RUN, { assessmentId: ID, now }).get(ID)!.filter((row) => row.status === "not_submitted");

test("the sample has work not handed in on ASSESSMENT-02", () => {
  assert.ok(missing(course(null), AFTER).length >= 1);
});

test("absent a rule, work not handed in stays blank and is not sent", () => {
  for (const row of missing(course(null), AFTER)) {
    assert.equal(row.score, null);
    assert.deepEqual(row.blocked, ["no submission"]);
    assert.equal(exportable(row), false);
  }
});

test("zero, past due: a 0 that is sent and counted, still marked as not handed in", () => {
  const b = course("zero");
  const rows = missing(b, AFTER);
  for (const row of rows) {
    assert.equal(row.score, 0);
    assert.deepEqual(row.blocked, []);
    assert.equal(exportable(row), true);
  }
  const payload: any = gradebookPayload(b, RUN, { assessmentId: ID });
  const summary = payload.assessments[0].summary;
  assert.equal(summary.zeroed, rows.length);
  assert.equal(summary.not_submitted, rows.length);
  // The mean is over marked papers, not the zeros.
  assert.equal(summary.mean, (gradebookPayload(course(null), RUN, { assessmentId: ID }) as any).assessments[0].summary.mean);
  for (const row of rows) {
    const total = payload.totals.find((t: any) => t.student_id === row.student_id);
    assert.ok(total.assessments_counted.includes(ID));
    assert.ok(!total.assessments_outstanding.includes(ID));
  }
  assert.ok(payload.notes.some((note: string) => note.includes("missing-work policy of zero")));
});

test("zero, before the due date or with no due date: not missing yet, so blank", () => {
  for (const row of missing(course("zero"), BEFORE)) assert.equal(row.score, null);
  for (const row of missing(course("zero", null, null), AFTER)) assert.equal(row.score, null);
});

test("an assessment's own rule wins over the run's, either way", () => {
  for (const row of missing(course("zero", "blank"), AFTER)) assert.equal(row.score, null);
  for (const row of missing(course(null, "zero"), AFTER)) assert.equal(row.score, 0);
  assert.equal(missingWorkOf({ grading_scheme: { missing_work: "zero" } }, { missing_work: "blank" }), "blank");
  assert.equal(missingWorkOf({}, {}), "blank");
});

test("an open integrity case still holds a zero", () => {
  const b = course("zero");
  const student = missing(b, AFTER)[0]!.student_id;
  b.integrity_cases = [
    ...(b.integrity_cases ?? []),
    { case_id: "INTEGRITY-900", course_version_id: RUN, student_id: student, assessments: [ID], state: "open", opened_at: "2026-10-03T09:00:00+05:00" },
  ];
  const row = gradeRows(b, RUN, { assessmentId: ID, now: AFTER }).get(ID)!.find((r) => r.student_id === student)!;
  assert.equal(row.status, "held");
  assert.equal(exportable(row), false);
});

test("the push plan sends the zero as a new mark", () => {
  const rows = gradeRows(course("zero"), RUN, { assessmentId: ID, now: AFTER }).get(ID)!;
  const plan = buildPlan({ courseVersionId: RUN, assessmentId: ID, target: "csv", rows, directory: null, requireIdentity: false });
  const student = missing(course("zero"), AFTER)[0]!.student_id;
  const line = plan.rows.find((r) => r.student_id === student)!;
  assert.equal(line.action, "new");
  assert.equal(line.score, 0);
});

test("setMissingWork writes the run's rule with a history line, an assessment's own, and refuses a locked policy", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-missing-"));
  cpSync(join(ROOT, "courses"), join(root, "courses"), { recursive: true });
  const load = () => new Workspace(root, "flag").findRun(RUN) as any;

  const runFiles = setMissingWork({ root, bundle: load(), runId: RUN, rule: "zero", at: "2026-10-22T12:00:00+05:00", by: "USER-T" });
  assert.equal(runFiles.length, 1);
  const scheme = (runById(load()).get(RUN) as any).grading_scheme;
  assert.equal(scheme.missing_work, "zero");
  const last = scheme.extensions.history.at(-1);
  assert.equal(last.action, "missing_work");
  assert.equal(last.was, null);
  assert.equal(last.before, undefined, "not offered as a restorable policy change");
  assert.deepEqual(setMissingWork({ root, bundle: load(), runId: RUN, rule: "zero", at: "2026-10-22T12:00:00+05:00" }), []);

  const own = setMissingWork({ root, bundle: load(), runId: RUN, assessmentId: ID, rule: "blank", at: "2026-10-22T12:00:00+05:00" });
  assert.match(readFileSync(own[0]!, "utf-8"), /missing_work: blank/);
  setMissingWork({ root, bundle: load(), runId: RUN, assessmentId: ID, rule: null, at: "2026-10-22T12:00:00+05:00" });
  assert.equal(load().assessments.find((a: any) => a.assessment_id === ID).missing_work ?? null, null);

  const locked: any = load();
  (runById(locked).get(RUN) as any).grading_scheme.locked = true;
  assert.throws(() => setMissingWork({ root, bundle: locked, runId: RUN, rule: "blank", at: "2026-10-22T12:00:00+05:00" }), /locked/);
});
