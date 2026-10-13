import { test } from "node:test";
import assert from "node:assert/strict";
import { changesGrid, gradeChanges, realChanges } from "../src/grade-changes.ts";

const RUN = "CSS-1-2026-FALL";
const bundle = (evaluations: any[]): any => ({
  assessments: [
    {
      assessment_id: "ASSESSMENT-HW4",
      course_version_id: RUN,
      rubric: { rubric_id: "RUBRIC-HW4", criteria: [{ criterion_id: "CRIT-HW4-A", title: "Split", maximum_score: 4 }] },
    },
    { assessment_id: "ASSESSMENT-OTHER", course_version_id: "CSS-1-2025-FALL" },
  ],
  rubrics: [],
  submissions: [
    { submission_id: "SUB-AAA-HW4", assessment_id: "ASSESSMENT-HW4", student_id: "STUDENT-AAA" },
    { submission_id: "SUB-AAA-OLD", assessment_id: "ASSESSMENT-OTHER", student_id: "STUDENT-AAA" },
  ],
  evaluations,
});

const sheet = { score: 4, comment: "Grade sheet: T", decided_by: "USER-P", decided_at: "2026-10-07T17:54:00+05:00", via: "grade-sheet" };
const defenceChecked = {
  evaluation_id: "EVAL-AAA-HW4-A",
  submission_id: "SUB-AAA-HW4",
  criterion_id: "CRIT-HW4-A",
  status: "approved",
  professor_decision: { score: 2, comment: "partly", decided_by: "USER-P", decided_at: "2026-10-12T10:00:00+05:00", defence: "partly" },
  extensions: { decided_via: "defence", history: [sheet] },
};

test("history and the current decision read as a chain of changes, oldest first", () => {
  const changes = gradeChanges(bundle([defenceChecked]), RUN);
  assert.deepEqual(
    changes.map((change) => [change.from, change.to, change.how, change.defence]),
    [
      [null, 4, "grade sheet", null],
      [4, 2, "defence", "partly"],
    ],
  );
  assert.equal(changes[1]!.criterion, "Split");
  assert.equal(changes[1]!.maximum, 4);
});

test("only this run's assessments, and a decision that kept the score is not a change", () => {
  const same = { ...defenceChecked, professor_decision: { ...defenceChecked.professor_decision, score: 4 } };
  const other = { ...defenceChecked, evaluation_id: "EVAL-OLD", submission_id: "SUB-AAA-OLD" };
  const every = gradeChanges(bundle([same, other]), RUN);
  assert.equal(every.length, 2);
  assert.equal(realChanges(every).length, 1);
  assert.equal(gradeChanges(bundle([defenceChecked]), RUN, { student: "STUDENT-BBB" }).length, 0);
});

test("the sheet's tab lists the newest change first, with the name when there is one", () => {
  const grid = changesGrid(gradeChanges(bundle([defenceChecked]), RUN), { names: { "STUDENT-AAA": "A. Student" } });
  assert.equal(grid.header[0], "student");
  assert.deepEqual(grid.rows[0]!.slice(0, 2), ["STUDENT-AAA", "A. Student"]);
  assert.deepEqual(grid.rows[0]!.slice(5, 10), ["4", "2", "4", "defence", "partly"]);
  assert.equal(grid.rows[1]![8], "grade sheet");
});
