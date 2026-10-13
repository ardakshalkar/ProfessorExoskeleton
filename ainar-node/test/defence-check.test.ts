import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDefence, writtenDecision } from "../src/defence-check.ts";

const submission = { submission_id: "SUB-AAA-HW4", assessment_id: "ASSESSMENT-HW4", student_id: "STUDENT-AAA" };
const sheetMark = (criterion: string, score: number) => ({
  evaluation_id: `EVAL-AAA-${criterion.slice(5)}`,
  submission_id: submission.submission_id,
  criterion_id: criterion,
  professor_decision: { score, comment: "Grade sheet: T (handed in), ×1", decided_by: "USER-PROF", decided_at: "2026-10-07T17:54:06+05:00" },
  status: "approved",
  extensions: { decided_via: "grade-sheet" },
});
const bundleWith = (evaluations: any[]): any => ({
  assessments: [{ assessment_id: "ASSESSMENT-HW4", rubric_id: "RUBRIC-HW4" }],
  rubrics: [
    {
      rubric_id: "RUBRIC-HW4",
      criteria: [
        { criterion_id: "CRIT-HW4-A", maximum_score: 4 },
        { criterion_id: "CRIT-HW4-B", maximum_score: 2 },
      ],
    },
  ],
  evaluations,
});
const at = "2026-10-12T10:00:00+05:00";

test("confirmed keeps the written mark, partly halves it, not confirmed is 0", () => {
  const bundle = bundleWith([sheetMark("CRIT-HW4-A", 4), sheetMark("CRIT-HW4-B", 2)]);
  const one = (criterion: string, outcome: any) =>
    checkDefence({ bundle, submission, marks: [{ criterion, outcome }], by: "USER-PROF", at }).evaluations[0];
  assert.equal(one("CRIT-HW4-A", "confirmed").professor_decision.score, 4);
  assert.equal(one("CRIT-HW4-A", "partly").professor_decision.score, 2);
  const not = one("CRIT-HW4-B", "not_confirmed");
  assert.equal(not.professor_decision.score, 0);
  assert.equal(not.professor_decision.defence, "not_confirmed");
  assert.equal(not.extensions.decided_via, "defence");
  assert.equal(not.extensions.history[0].via, "grade-sheet");
  assert.equal(not.extensions.history[0].score, 2);
});

test("a score given overrides the outcome's, inside the criterion's range", () => {
  const bundle = bundleWith([sheetMark("CRIT-HW4-A", 4)]);
  const done = checkDefence({ bundle, submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "partly", score: 3 }], by: "USER-PROF", at });
  assert.equal(done.evaluations[0].professor_decision.score, 3);
  assert.throws(
    () => checkDefence({ bundle, submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "partly", score: 5 }], by: "USER-PROF", at }),
    /outside 0–4/,
  );
});

test("a second defence mark still counts from the written mark, and clear restores it", () => {
  const first = checkDefence({
    bundle: bundleWith([sheetMark("CRIT-HW4-A", 4)]),
    submission,
    marks: [{ criterion: "CRIT-HW4-A", outcome: "not_confirmed" }],
    by: "USER-PROF",
    at,
  }).evaluations[0];
  const second = checkDefence({ bundle: bundleWith([first]), submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "partly" }], by: "USER-PROF", at })
    .evaluations[0];
  assert.equal(second.professor_decision.score, 2, "half of the written 4, not of the defence's 0");
  assert.equal(writtenDecision(second)?.decision.score, 4);

  const cleared = checkDefence({ bundle: bundleWith([second]), submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "clear" }], by: "USER-PROF", at })
    .evaluations[0];
  assert.equal(cleared.professor_decision.score, 4);
  assert.equal(cleared.professor_decision.comment, "Grade sheet: T (handed in), ×1");
  assert.equal(cleared.professor_decision.defence, undefined);
  assert.equal(cleared.extensions.decided_via, "grade-sheet");
  assert.equal(cleared.extensions.history, undefined);
  assert.equal(cleared.status, "approved");
});

test("an ungraded criterion needs a score unless it was not confirmed, and clear then removes it", () => {
  const bundle = bundleWith([]);
  assert.throws(
    () => checkDefence({ bundle, submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "confirmed" }], by: "USER-PROF", at }),
    /no mark yet/,
  );
  const made = checkDefence({ bundle, submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "not_confirmed" }], by: "USER-PROF", at })
    .evaluations[0];
  assert.equal(made.evaluation_id, "EVAL-AAA-HW4-A");
  assert.equal(made.professor_decision.score, 0);
  const cleared = checkDefence({ bundle: bundleWith([made]), submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "clear" }], by: "USER-PROF", at });
  assert.deepEqual(cleared.removed, ["EVAL-AAA-HW4-A"]);
});

test("a criterion outside the rubric, or no instructor, is refused before anything is written", () => {
  const bundle = bundleWith([sheetMark("CRIT-HW4-A", 4)]);
  assert.throws(
    () =>
      checkDefence({
        bundle,
        submission,
        marks: [{ criterion: "CRIT-HW4-A", outcome: "confirmed" }, { criterion: "CRIT-OTHER", outcome: "confirmed" }],
        by: "USER-PROF",
        at,
      }),
    /not a criterion of ASSESSMENT-HW4/,
  );
  assert.throws(() => checkDefence({ bundle, submission, marks: [{ criterion: "CRIT-HW4-A", outcome: "confirmed" }], by: "", at }), /USER- id/);
});
