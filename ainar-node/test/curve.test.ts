/**
 * A curve on an assessment: the professor's own stretch of the totals, applied
 * by the gradebook after totalling, with the criterion decisions untouched.
 *
 *     node --experimental-strip-types --test test/curve.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { allRubrics, enrolledIn } from "../src/bundle.ts";
import { curved, gradeRows, gradebookPayload } from "../src/gradebook.ts";
import { Assessment } from "../src/model/assessment.ts";
import { validate } from "../src/validate.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const ID = "ASSESSMENT-04";

/** The sample with two more papers on ASSESSMENT-04, every criterion decided: one at a quarter, one at a half. */
const sample: any = (() => {
  const b: any = structuredClone(new Workspace(ROOT, "flag").findRun(RUN));
  const record = b.assessments.find((a: any) => a.assessment_id === ID);
  // A late attempt is the one that counts, whatever the student handed in before.
  const students = enrolledIn(b, RUN, { roles: new Set(["student"]) }).slice(0, 2);
  students.forEach((enrolment: any, i: number) => {
    const submission = `SUB-CURVE-${i + 1}`;
    b.submissions.push({ submission_id: submission, assessment_id: ID, student_id: enrolment.student_id, submitted_at: "2026-10-01T09:00:00+05:00", attempt: 9 });
    for (const criterion of allRubrics(b).get(record.rubric_id).criteria) {
      b.evaluations.push({
        evaluation_id: `EVAL-CURVE-${i + 1}-${criterion.criterion_id}`,
        submission_id: submission,
        criterion_id: criterion.criterion_id,
        status: "approved",
        professor_decision: { score: (criterion.maximum_score * (i + 1)) / 4, decided_by: "USER-T", decided_at: "2026-10-02T09:00:00+05:00" },
      });
    }
  });
  return b;
})();

/** ASSESSMENT-04's graded rows as they stand, before any curve. */
const target = (() => {
  const graded = gradeRows(sample, RUN, { assessmentId: ID }).get(ID)!.filter((row) => row.status === "graded" && row.score !== null);
  assert.ok(graded.length >= 2, "two graded papers on ASSESSMENT-04");
  return { id: ID, graded };
})();
const top = Math.max(...target.graded.map((row) => row.score as number));
const maximum = (sample.assessments as any[]).find((a) => a.assessment_id === target.id).maximum_score as number;

const SQRT = { kind: "power", anchor: top, exponent: 0.5, decided_by: "USER-ASHALKAR", decided_at: "2026-10-22T12:00:00+05:00" };

const withCurve = (curve: any) => {
  const b: any = structuredClone(sample);
  b.assessments.find((a: any) => a.assessment_id === target.id).curve = curve;
  return b;
};

const codes = (b: any): string[] => {
  const list: any = validate(b);
  return [...(list.errors ?? []), ...(list.warnings ?? [])].map((issue: any) => issue.code);
};

test("the formula: the anchor becomes full marks, nothing passes the maximum, zero stays zero", () => {
  assert.equal(curved(62, { anchor: 62, exponent: 0.5 }, 100), 100);
  assert.equal(curved(80, { anchor: 62, exponent: 0.5 }, 100), 100);
  assert.equal(curved(0, { anchor: 62, exponent: 0.5 }, 100), 0);
  assert.equal(curved(15.5, { anchor: 62, exponent: 0.5 }, 100), 50);
  assert.equal(curved(31, { anchor: 62, exponent: 1 }, 100), 50);
});

test("the model takes a curve and refuses one that would lower a mark", () => {
  const base = (sample.assessments as any[]).find((a) => a.assessment_id === target.id);
  assert.equal(Assessment.safeParse({ ...base, curve: SQRT }).success, true);
  assert.equal(Assessment.safeParse({ ...base, curve: { ...SQRT, exponent: 1.5 } }).success, false);
  assert.equal(Assessment.safeParse({ ...base, curve: { ...SQRT, anchor: maximum + 1 } }).success, false);
  assert.equal(Assessment.safeParse({ ...base, curve: { ...SQRT, kind: "bell" } }).success, false);
});

test("the gradebook curves the total and keeps the raw total beside it", () => {
  const rows = gradeRows(withCurve(SQRT), RUN, { assessmentId: target.id }).get(target.id)!;
  for (const before of target.graded) {
    const row = rows.find((r) => r.student_id === before.student_id)!;
    assert.equal(row.raw_score, before.score);
    assert.equal(row.score, curved(before.score as number, SQRT, maximum));
    assert.ok((row.score as number) >= (before.score as number), "a curve never lowers a mark");
    // The decisions themselves are untouched.
    assert.deepEqual(row.criteria, before.criteria);
  }
  const best = rows.find((r) => r.raw_score === top)!;
  assert.equal(best.score, maximum);
});

test("the payload shows the curve, the curved summary, and the raw one beside it", () => {
  const payload: any = gradebookPayload(withCurve(SQRT), RUN, { assessmentId: target.id });
  const entry = payload.assessments[0];
  assert.equal(entry.curve.applied, true);
  assert.equal(entry.summary.maximum, maximum);
  assert.equal(entry.summary.raw.maximum, top);
  assert.ok(entry.summary.mean > entry.summary.raw.mean);
  assert.ok(payload.notes.some((note: string) => note.includes("curved")));
  // Totals count the curved score.
  const row = entry.rows.find((r: any) => r.raw_score === top);
  assert.equal(row.score, maximum);
});

test("a draft curve is shown but not applied", () => {
  const payload: any = gradebookPayload(withCurve({ ...SQRT, approval: "draft" }), RUN, { assessmentId: target.id });
  const entry = payload.assessments[0];
  assert.equal(entry.curve.applied, false);
  assert.equal(entry.summary.raw, undefined);
  assert.ok(entry.rows.every((r: any) => !("raw_score" in r)));
});

test("no curve, no change: the payload is the one the golden fixtures hold", () => {
  assert.deepEqual(gradebookPayload(structuredClone(sample), RUN), gradebookPayload(sample, RUN));
  const payload: any = gradebookPayload(sample, RUN);
  for (const entry of payload.assessments) {
    assert.equal("curve" in entry, false);
    assert.equal("raw" in entry.summary, false);
  }
});

test("validate warns on an unsigned curve and on totals the anchor has fallen below", () => {
  assert.deepEqual(codes(withCurve(SQRT)).filter((c) => c.startsWith("grading.curve")), []);
  const unsigned = { ...SQRT, decided_by: null, decided_at: null };
  assert.ok(codes(withCurve(unsigned)).includes("grading.curve_unsigned"));
  const low = { ...SQRT, anchor: Math.max(0.5, top - 0.5) };
  assert.ok(codes(withCurve(low)).includes("grading.curve_caps"));
  // A draft curve is not in force, so neither fires.
  assert.deepEqual(codes(withCurve({ ...unsigned, anchor: low.anchor, approval: "draft" })).filter((c) => c.startsWith("grading.curve")), []);
});
