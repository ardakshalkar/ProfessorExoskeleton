/**
 * Academic-integrity cases: the professor's decision about a paper, read by
 * the gradebook after totalling and by the Canvas push — and never by a
 * student, beyond the mark it leaves.
 *
 *     node --experimental-strip-types --test test/integrity.test.ts
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { allRubrics, bundlePayload, enrolledIn } from "../src/bundle.ts";
import { gradeRows, gradebookPayload } from "../src/gradebook.ts";
import { decideCase, governingCase, openCase } from "../src/integrity.ts";
import { CanvasClient } from "../src/lms/canvas-api.ts";
import { RecordedTransport } from "../src/lms/http.ts";
import { IntegrityCase } from "../src/model/assessment.ts";
import { validate } from "../src/validate.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const ID = "ASSESSMENT-04";
const AT = "2026-10-22T12:00:00+05:00";

/** The sample with two papers on ASSESSMENT-04, every criterion decided: one at a quarter, one at a half. */
const sample: any = (() => {
  const b: any = structuredClone(new Workspace(ROOT, "flag").findRun(RUN));
  const record = b.assessments.find((a: any) => a.assessment_id === ID);
  const students = enrolledIn(b, RUN, { roles: new Set(["student"]) }).slice(0, 2);
  students.forEach((enrolment: any, i: number) => {
    const submission = `SUB-CASE-${i + 1}`;
    b.submissions.push({ submission_id: submission, assessment_id: ID, student_id: enrolment.student_id, submitted_at: "2026-10-01T09:00:00+05:00", attempt: 9 });
    for (const criterion of allRubrics(b).get(record.rubric_id).criteria) {
      b.evaluations.push({
        evaluation_id: `EVAL-CASE-${i + 1}-${criterion.criterion_id}`,
        submission_id: submission,
        criterion_id: criterion.criterion_id,
        status: "approved",
        professor_decision: { score: (criterion.maximum_score * (i + 1)) / 4, comment: "see me", decided_by: "USER-T", decided_at: "2026-10-02T09:00:00+05:00" },
      });
    }
  });
  b.integrity_cases ??= [];
  return b;
})();
const [ONE, TWO] = enrolledIn(sample, RUN, { roles: new Set(["student"]) }).slice(0, 2).map((e: any) => e.student_id as string);

const withCase = (fields: Record<string, unknown>, base: any = sample) => {
  const b: any = structuredClone(base);
  b.integrity_cases.push({
    case_id: "INTEGRITY-001",
    course_version_id: RUN,
    student_id: ONE,
    assessments: [ID],
    submissions: ["SUB-CASE-1"],
    state: "open",
    opened_by: "USER-T",
    opened_at: AT,
    note: "same wrong derivation as another paper, line for line",
    ...fields,
  });
  return b;
};
const rowOf = (b: any, student = ONE) => gradeRows(b, RUN, { assessmentId: ID }).get(ID)!.find((row) => row.student_id === student)!;
const totalOf = (b: any, student = ONE) => (gradebookPayload(b, RUN).totals as any[]).find((t) => t.student_id === student);
const codes = (b: any): string[] => {
  const list: any = validate(b);
  return [...(list.errors ?? []), ...(list.warnings ?? [])].map((issue: any) => issue.code);
};

test("the model: an upheld case says its outcome, and only an upheld one has one", () => {
  const base = { case_id: "INTEGRITY-001", course_version_id: RUN, student_id: ONE, assessments: [ID] };
  assert.equal(IntegrityCase.safeParse(base).success, true);
  assert.equal(IntegrityCase.safeParse({ ...base, state: "upheld" }).success, false);
  assert.equal(IntegrityCase.safeParse({ ...base, state: "upheld", outcome: "zero" }).success, true);
  assert.equal(IntegrityCase.safeParse({ ...base, state: "cleared", outcome: "zero" }).success, false);
  assert.equal(IntegrityCase.safeParse({ ...base, assessments: [] }).success, false);
  assert.equal(IntegrityCase.safeParse({ ...base, state: "suspected" }).success, false);
});

test("no case: the row is as it was, with no integrity field", () => {
  const row = rowOf(sample);
  assert.equal(row.status, "graded");
  assert.equal(row.integrity, undefined);
  assert.ok(!("integrity_cases" in bundlePayload({ ...sample, integrity_cases: [] })), "an empty collection stays out of the payload");
});

test("open: the mark is held, not exported, outstanding in the total, and its comment withheld", () => {
  const b = withCase({});
  const row = rowOf(b);
  assert.equal(row.status, "held");
  assert.ok(row.score !== null, "the professor still sees what it was marked");
  assert.equal(row.comment, null);
  assert.ok(row.blocked.some((reason) => reason.includes("INTEGRITY-001")));
  assert.ok(!row.blocked.some((reason) => reason.includes("derivation")), "the note never enters the row");
  assert.deepEqual(row.integrity, { case_id: "INTEGRITY-001", state: "open", outcome: null });
  const total = totalOf(b);
  assert.ok(total.assessments_outstanding.includes(ID));
  assert.ok(!total.assessments_counted.includes(ID));
  assert.equal(rowOf(b, TWO).status, "graded", "the other student is untouched");
});

test("cleared: the mark counts as marked", () => {
  const b = withCase({ state: "cleared", decided_by: "USER-T", decided_at: AT });
  const row = rowOf(b);
  assert.equal(row.status, "graded");
  assert.equal(row.score, rowOf(sample).score);
  assert.equal(row.comment, rowOf(sample).comment);
});

test("upheld zero: the score is 0 and is exported; voided: out of the total altogether", () => {
  const zero = withCase({ state: "upheld", outcome: "zero", decided_by: "USER-T", decided_at: AT });
  const zrow = rowOf(zero);
  assert.equal(zrow.status, "graded");
  assert.equal(zrow.score, 0);
  assert.deepEqual(zrow.blocked, []);
  assert.ok(totalOf(zero).assessments_counted.includes(ID));

  const voided = withCase({ state: "upheld", outcome: "voided", decided_by: "USER-T", decided_at: AT });
  const vrow = rowOf(voided);
  assert.equal(vrow.status, "voided");
  assert.equal(vrow.score, null);
  const total = totalOf(voided);
  assert.ok(!total.assessments_counted.includes(ID));
  assert.ok(!total.assessments_outstanding.includes(ID));
});

test("a case not cleared keeps the paper off the curve; a cleared one does not", () => {
  const curve = { kind: "power", anchor: 50, exponent: 0.5, decided_by: "USER-T", decided_at: AT };
  const curvedSample: any = structuredClone(sample);
  curvedSample.assessments.find((a: any) => a.assessment_id === ID).curve = curve;
  const raw = rowOf(sample).score;
  assert.notEqual(rowOf(curvedSample).score, raw, "the curve moves the mark with no case");
  const upheld = withCase({ state: "upheld", outcome: "no_penalty", decided_by: "USER-T", decided_at: AT }, curvedSample);
  assert.equal(rowOf(upheld).score, raw);
  assert.equal(rowOf(upheld).raw_score, undefined);
  const cleared = withCase({ state: "cleared", decided_by: "USER-T", decided_at: AT }, curvedSample);
  assert.equal(rowOf(cleared).score, rowOf(curvedSample).score);
});

test("an open case outranks a later upheld one on the same work", () => {
  const cases = [
    { case_id: "INTEGRITY-001", student_id: ONE, assessments: [ID], state: "upheld", outcome: "zero", decided_at: "2026-10-23T00:00:00+05:00" },
    { case_id: "INTEGRITY-002", student_id: ONE, assessments: [ID], state: "open", opened_at: "2026-10-01T00:00:00+05:00" },
  ];
  assert.equal(governingCase(cases, ONE, ID).case_id, "INTEGRITY-002");
  assert.equal(governingCase(cases, TWO, ID), null);
});

test("validate: a decided case is signed, and names only this student's papers", () => {
  assert.ok(!codes(withCase({})).some((code) => code.startsWith("integrity.")));
  assert.ok(codes(withCase({ state: "cleared" })).includes("integrity.unsigned"));
  assert.ok(codes(withCase({ submissions: ["SUB-CASE-2"] })).includes("integrity.someone_elses_paper"));
  assert.ok(codes(withCase({ assessments: ["ASSESSMENT-NOPE"] })).includes("ref.assessment"));
});

test("open and decide write records/integrity.yaml, keeping the history", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-integrity-"));
  try {
    const b: any = structuredClone(sample);
    const opened = openCase({ root, bundle: b, runId: RUN, studentId: ONE, assessmentIds: [ID], note: "private", by: "USER-T", at: AT });
    assert.equal(opened.caseId, "INTEGRITY-001");
    const file = join(root, "courses", String(b.course.course_id), "records", "integrity.yaml");
    const written = (parse(readFileSync(file, "utf-8")) as any).integrity_cases;
    assert.equal(written.length, 1);
    // Every paper the student handed in for it, the earlier attempt too.
    assert.ok(written[0].submissions.includes("SUB-CASE-1"));
    assert.ok(written[0].submissions.every((id: string) => b.submissions.find((s: any) => s.submission_id === id)?.student_id === ONE));

    b.integrity_cases.push(IntegrityCase.parse(written[0]));
    assert.throws(() => openCase({ root, bundle: b, runId: RUN, studentId: ONE, assessmentIds: [ID], by: "USER-T", at: AT }), /already open/);
    assert.throws(() => decideCase({ root, bundle: b, runId: RUN, caseId: "INTEGRITY-001", state: "upheld", by: "USER-T", at: AT }), /says what it does/);

    const decided = decideCase({ root, bundle: b, runId: RUN, caseId: "INTEGRITY-001", state: "upheld", outcome: "voided", by: "USER-T", at: AT });
    assert.equal(decided.record.outcome, "voided");
    const after = (parse(readFileSync(file, "utf-8")) as any).integrity_cases;
    assert.equal(after.length, 1);
    assert.equal(after[0].state, "upheld");
    assert.equal(after[0].note, "private");
    assert.equal(after[0].extensions.history[0].state, "open");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Canvas: a voided mark is sent as excuse, with no grade and no comment", async () => {
  const transport = new RecordedTransport({
    "POST /api/v1/courses/1/assignments/2/submissions/update_grades": { status: 200, headers: {}, body: '{"id": 1, "workflow_state": "queued"}' },
  });
  const client = new CanvasClient({ base_url: "https://canvas.example.edu", token: "secret" }, transport);
  await client.updateGrades("1", "2", new Map<string, [number | null, string | null]>([["10", [null, null]], ["11", [7.5, null]]]));
  const fields = new URLSearchParams(transport.calls[0]![2] ?? "");
  assert.equal(fields.get("grade_data[10][excuse]"), "true");
  assert.equal(fields.get("grade_data[10][posted_grade]"), null);
  assert.equal(fields.get("grade_data[11][posted_grade]"), "7.5");
  assert.equal(fields.get("grade_data[11][excuse]"), null);
});
