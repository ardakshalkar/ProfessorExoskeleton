/**
 * Standing: each student's class percentile per assessment, and in class
 * against at home (BACKLOG E38, STN-1 and STN-2).
 *
 *     node --experimental-strip-types --test test/standing.test.ts
 */

import { strict as assert } from "node:assert";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { MIN_CLASS, setSetting, settingOf, standingProfile } from "../src/standing.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const sample: any = new Workspace(ROOT, "flag").findRun(RUN);

const STUDENTS = ["STUDENT-S1", "STUDENT-S2", "STUDENT-S3", "STUDENT-S4", "STUDENT-S5", "STUDENT-S6"];

/**
 * The sample's course with its run's assessments and work replaced: each
 * assessment out of 10 on one criterion, `marks[id][i]` the decided score of
 * `STUDENTS[i]`, `null` for nothing handed in.
 */
const course = (
  assessments: { id: string; type: string; setting?: string; delivery?: string; due: string; concepts?: string[] }[],
  marks: Record<string, (number | null)[]>,
) => {
  const b: any = structuredClone(sample);
  b.enrollments = STUDENTS.map((student_id, i) => ({
    enrollment_id: `ENR-T${i}`,
    course_version_id: RUN,
    student_id,
    role: "student",
    status: "active",
  }));
  b.assessments = assessments.map((a) => ({
    assessment_id: a.id,
    course_version_id: RUN,
    title: a.id,
    type: a.type,
    ...(a.setting ? { setting: a.setting } : {}),
    ...(a.delivery ? { delivery: a.delivery } : {}),
    maximum_score: 10,
    due_at: a.due,
    rubric_id: `RUBRIC-${a.id}`,
    rubric: {
      rubric_id: `RUBRIC-${a.id}`,
      criteria: [{ criterion_id: `CRIT-${a.id}`, rubric_id: `RUBRIC-${a.id}`, title: "All", maximum_score: 10, concepts: a.concepts ?? [`CONCEPT-${a.id}`] }],
    },
  }));
  b.submissions = [];
  b.evaluations = [];
  b.item_responses = [];
  b.integrity_cases = [];
  for (const a of assessments) {
    STUDENTS.forEach((student_id, i) => {
      const score = marks[a.id]![i];
      if (score === null || score === undefined) return;
      const submission_id = `SUB-${a.id}-${i}`;
      b.submissions.push({ submission_id, assessment_id: a.id, student_id, status: "submitted", attempt: 1, files: [] });
      b.evaluations.push({
        evaluation_id: `EVAL-${a.id}-${i}`,
        submission_id,
        criterion_id: `CRIT-${a.id}`,
        professor_decision: { score },
        status: "approved",
      });
    });
  }
  return b;
};

const TWO_EACH = [
  { id: "Q-1", type: "quiz", setting: "supervised", due: "2026-09-10T09:00:00+05:00" },
  { id: "Q-2", type: "quiz", setting: "supervised", due: "2026-09-24T09:00:00+05:00" },
  { id: "H-1", type: "assignment", due: "2026-09-17T09:00:00+05:00" },
  { id: "H-2", type: "assignment", due: "2026-10-01T09:00:00+05:00" },
];

const of = (profile: any, id: string) => profile.students.find((s: any) => s.student_id === id);

test("settingOf: the professor's word, else delivery, else type; a quiz alone is unknown", () => {
  assert.deepEqual(settingOf({ type: "quiz", setting: "unsupervised", delivery: "paper_exam" }).source, "recorded");
  assert.equal(settingOf({ type: "quiz", setting: "unsupervised", delivery: "paper_exam" }).setting, "unsupervised");
  assert.equal(settingOf({ type: "quiz" }).setting, null);
  assert.equal(settingOf({ type: "quiz", delivery: "paper_exam" }).setting, "supervised");
  assert.equal(settingOf({ type: "quiz", delivery: "canvas_upload" }).setting, "unsupervised");
  // A take-home exam: delivery outranks type.
  assert.equal(settingOf({ type: "exam", delivery: "canvas_upload" }).setting, "unsupervised");
  assert.equal(settingOf({ type: "exam" }).setting, "supervised");
  assert.equal(settingOf({ type: "assignment", delivery: "instructor_collected" }).setting, "unsupervised");
  assert.equal(settingOf({ type: "participation", delivery: "paper_exam" }).setting, null);
});

test("percentiles: the middle of the class, and a range where marks tie", () => {
  const p = standingProfile(course(TWO_EACH, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [10, 10, 10, 10, 10, 10], "H-2": [10, 10, 10, 10, 10, 10] }), RUN);
  const top = of(p, "STUDENT-S6").entries;
  const q = top.find((e: any) => e.assessment_id === "Q-1");
  assert.equal(q.percentile, 91.7);
  assert.equal(q.low, 83.3);
  assert.equal(q.high, 100);
  const h = top.find((e: any) => e.assessment_id === "H-1");
  assert.deepEqual([h.low, h.percentile, h.high], [0, 50, 100]);
  // Ordered by date, quiz and homework interleaved.
  assert.deepEqual(top.map((e: any) => e.assessment_id), ["Q-1", "H-1", "Q-2", "H-2"]);
});

test("a tie at full marks is no gap: top in class with full homework is not weaker at home", () => {
  const p = standingProfile(course(TWO_EACH, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [10, 10, 10, 10, 10, 10], "H-2": [10, 10, 10, 10, 10, 10] }), RUN);
  for (const s of p.students) assert.equal(s.gap, 0, s.student_id);
});

test("the gap: stronger in class is negative, stronger at home positive", () => {
  const p = standingProfile(
    course(TWO_EACH, {
      "Q-1": [1, 2, 3, 4, 5, 9],
      "Q-2": [9, 2, 3, 4, 5, 1],
      "H-1": [1, 2, 3, 4, 5, 6],
      "H-2": [1, 2, 3, 4, 5, 6],
    }),
    RUN,
  );
  const s1 = of(p, "STUDENT-S1");
  const s6 = of(p, "STUDENT-S6");
  // S1: half top, half bottom in class; bottom at home.
  assert.ok(s1.gap < 0);
  // S6: the same in class; top at home.
  assert.ok(s6.gap > 0);
  assert.equal(s1.supervised.count, 2);
  assert.equal(s1.unsupervised.count, 2);
});

test("one assessment a side is not enough to compare", () => {
  const p = standingProfile(course(TWO_EACH.slice(0, 3), { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [6, 5, 4, 3, 2, 1] }), RUN);
  for (const s of p.students) assert.equal(s.gap, null);
});

test("work not handed in is left out, even when the policy makes it 0", () => {
  const b = course(TWO_EACH, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [null, 2, 3, 4, 5, 6], "H-2": [null, 2, 3, 4, 5, 6] });
  const version = b.versions.find((v: any) => v.course_version_id === RUN);
  version.grading_scheme = { ...(version.grading_scheme ?? {}), missing_work: "zero" };
  const p = standingProfile(b, RUN, { now: Date.parse("2026-12-01T00:00:00+05:00") });
  const s1 = of(p, "STUDENT-S1");
  assert.equal(s1.unsupervised.count, 0);
  assert.equal(s1.gap, null);
  assert.deepEqual(s1.left_out.map((l: any) => l.why), ["not handed in", "not handed in"]);
  // And the zeros do not count among the class's marks either: S2 is now the bottom of five.
  assert.equal(of(p, "STUDENT-S2").entries.find((e: any) => e.assessment_id === "H-1").low, 0);
});

test("a mark an upheld integrity case decided is left out", () => {
  const b = course(TWO_EACH, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [1, 2, 3, 4, 5, 10], "H-2": [1, 2, 3, 4, 5, 6] });
  b.integrity_cases = [
    { case_id: "INTEGRITY-1", course_version_id: RUN, student_id: "STUDENT-S6", assessments: ["H-1"], state: "upheld", outcome: "zero" },
  ];
  const s6 = of(standingProfile(b, RUN), "STUDENT-S6");
  assert.ok(!s6.entries.some((e: any) => e.assessment_id === "H-1"));
  assert.deepEqual(s6.left_out, [{ assessment_id: "H-1", why: "integrity case INTEGRITY-1" }]);
});

test(`fewer than ${MIN_CLASS} marked papers: no percentile, and a note says so`, () => {
  const p = standingProfile(course(TWO_EACH, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, null, null, null, null], "H-1": [1, 2, 3, 4, 5, 6], "H-2": [1, 2, 3, 4, 5, 6] }), RUN);
  assert.equal(p.assessments.find((a) => a.assessment_id === "Q-2")!.counted, false);
  assert.ok(!p.students.some((s) => s.entries.some((e) => e.assessment_id === "Q-2")));
  assert.ok(p.notes.some((n) => n.includes("Q-2")));
});

test("a quiz of unknown setting sits on neither side, and the profile says how to record it", () => {
  const unknown = TWO_EACH.map((a) => (a.type === "quiz" ? { ...a, setting: undefined } : a));
  const p = standingProfile(course(unknown, { "Q-1": [1, 2, 3, 4, 5, 6], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [1, 2, 3, 4, 5, 6], "H-2": [1, 2, 3, 4, 5, 6] }), RUN);
  assert.deepEqual(p.unknown_setting, ["Q-1", "Q-2"]);
  assert.equal(of(p, "STUDENT-S1").supervised.count, 0);
  assert.ok(p.notes.some((n) => n.includes("ainar assessment setting")));
  assert.deepEqual(p.assessments.find((a) => a.assessment_id === "Q-1")!.concepts, ["CONCEPT-Q-1"]);
});

const SHARED = TWO_EACH.map((a) => ({ ...a, concepts: ["CONCEPT-A"] }));
const REVERSED_ON_Q2 = {
  "Q-1": [6, 5, 4, 3, 2, 1],
  "Q-2": [1, 2, 3, 4, 5, 6],
  "H-1": [6, 5, 4, 3, 2, 1],
  "H-2": [6, 5, 4, 3, 2, 1],
};

test("a mark far above the student's other work on the same concepts is out of line, whatever its setting", () => {
  const p = standingProfile(course(SHARED, REVERSED_ON_Q2), RUN);
  const s6 = of(p, "STUDENT-S6");
  assert.equal(s6.checked, 4);
  assert.equal(s6.out_of_line.length, 1);
  const [mark] = s6.out_of_line;
  assert.equal(mark.assessment_id, "Q-2");
  assert.equal(mark.setting, "supervised");
  assert.ok(mark.distance >= 30);
  assert.deepEqual(mark.concepts, ["CONCEPT-A"]);
  assert.deepEqual(mark.against, ["H-1", "H-2", "Q-1"]);
  // And the reverse is out of line too, below.
  assert.ok(of(p, "STUDENT-S1").out_of_line[0].distance <= -30);
  // A student in the middle everywhere is not.
  assert.deepEqual(of(p, "STUDENT-S4").out_of_line, []);
});

test("a mark is only set against work that shares its concepts, and enough of it", () => {
  // Nothing shared: each assessment on a concept of its own.
  const apart = standingProfile(course(TWO_EACH, REVERSED_ON_Q2), RUN);
  for (const s of apart.students) assert.equal(s.checked, 0);
  // One other assessment on the concept is not enough to hold a mark against.
  const two = SHARED.filter((a) => a.id === "Q-1" || a.id === "Q-2");
  for (const s of standingProfile(course(two, REVERSED_ON_Q2), RUN).students) assert.equal(s.checked, 0);
});

test("ties at full marks on the other work give a mark room before it is out of line", () => {
  const p = standingProfile(
    course(SHARED, { "Q-1": [6, 5, 4, 3, 2, 1], "Q-2": [1, 2, 3, 4, 5, 6], "H-1": [10, 10, 10, 10, 10, 10], "H-2": [10, 10, 10, 10, 10, 10] }),
    RUN,
  );
  assert.deepEqual(of(p, "STUDENT-S6").out_of_line, []);
});

test("setSetting records, leaves an unchanged one alone, clears, and refuses another run's assessment", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-setting-"));
  cpSync(join(ROOT, "courses"), join(root, "courses"), { recursive: true });
  const load = () => new Workspace(root, "flag").findRun(RUN) as any;
  const id = load().assessments.find((a: any) => a.course_version_id === RUN && a.type === "quiz")?.assessment_id
    ?? load().assessments.find((a: any) => a.course_version_id === RUN).assessment_id;

  const written = setSetting({ root, bundle: load(), runId: RUN, assessmentIds: [id], setting: "supervised" });
  assert.equal(written.length, 1);
  assert.match(readFileSync(written[0]!, "utf-8"), /setting: supervised/);
  assert.equal(load().assessments.find((a: any) => a.assessment_id === id).setting, "supervised");
  assert.deepEqual(setSetting({ root, bundle: load(), runId: RUN, assessmentIds: [id], setting: "supervised" }), []);

  setSetting({ root, bundle: load(), runId: RUN, assessmentIds: [id], setting: null });
  assert.equal(load().assessments.find((a: any) => a.assessment_id === id).setting ?? null, null);

  assert.throws(() => setSetting({ root, bundle: load(), runId: RUN, assessmentIds: ["ASSESSMENT-NOPE"], setting: "supervised" }), /not assessments of/);
  assert.throws(() => setSetting({ root, bundle: load(), runId: RUN, assessmentIds: [id], setting: "proctored" as any }), /supervised or unsupervised/);
});
