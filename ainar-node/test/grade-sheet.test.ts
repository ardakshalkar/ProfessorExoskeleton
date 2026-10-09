import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_MARKS, type SheetConfig, applyFlags, planSync, sheetRows } from "../src/grade-sheet.ts";
import { RosterStore } from "../src/roster.ts";

const RUN = "CSS-1-2026-FALL";
const config: SheetConfig = {
  run: RUN,
  url: null,
  tab: null,
  name_column: "Name",
  flag_column: "Note",
  columns: { "1Task": "ASSESSMENT-HW1" },
  marks: DEFAULT_MARKS,
  students: {},
};

const bundle = (submissions: any[] = [], evaluations: any[] = []) => ({
  assessments: [
    {
      assessment_id: "ASSESSMENT-HW1",
      course_version_id: RUN,
      rubric: {
        rubric_id: "RUBRIC-HW1",
        criteria: [
          { criterion_id: "CRIT-HW1-EASY", maximum_score: 1 },
          { criterion_id: "CRIT-HW1-HARD", maximum_score: 1.5 },
        ],
      },
    },
  ],
  rubrics: [],
  submissions,
  evaluations,
});

const store = () =>
  new RosterStore("unused", {
    "STUDENT-AAAAAA": { name: "Ерменбаева Индира Болатовна" },
    "STUDENT-BBBBBB": { name: "Ostanin Artem" },
  });
const enrolled = new Set(["STUDENT-AAAAAA", "STUDENT-BBBBBB"]);

const grid = (a: string, b: string) => [
  ["", "", ""],
  ["Name", "Note", "1Task"],
  ["Yermenbayeva Indira", "🚲", a],
  ["Artem Ostanin", "", b],
];

const plan = (rows: string[][], b = bundle()) =>
  planSync({
    rows: sheetRows(rows, config),
    config,
    bundle: b,
    runId: RUN,
    store: store(),
    salt: null,
    enrolled,
    decidedBy: "INSTRUCTOR-1",
    decidedAt: "2026-10-07T12:00:00+05:00",
  });

test("a mark becomes a submission and a decision on every criterion, scaled", () => {
  const result = plan(grid("LT", "T"));
  assert.deepEqual(result.problems, []);
  assert.equal(result.placed.length, 2);
  assert.equal(result.submissions.length, 2);
  const late = result.submissions.find((entry) => entry.student_id === "STUDENT-AAAAAA")!;
  assert.equal(late.status, "late");
  assert.equal((late.extensions as any).source, "grade-sheet");
  const scores = result.evaluations
    .filter((entry) => entry.submission_id === late.submission_id)
    .map((entry) => (entry.professor_decision as any).score);
  assert.deepEqual(scores, [0.8, 1.2]);
  assert.ok(result.evaluations.every((entry) => entry.status === "approved"));
  assert.deepEqual(result.flags, { "STUDENT-AAAAAA": "🚲" });
});

test("running again over what it wrote changes nothing", () => {
  const first = plan(grid("LT", "T"));
  const again = plan(grid("LT", "T"), bundle(first.submissions, first.evaluations));
  assert.equal(again.submissions.length, 0);
  assert.equal(again.evaluations.length, 0);
  assert.equal(again.unchanged, 4);
  assert.deepEqual(again.remove, { submissions: [], evaluations: [] });
  assert.deepEqual(again.kept, []);
});

test("an emptied cell takes back only what the sheet wrote", () => {
  const first = plan(grid("LT", "T"));
  const again = plan(grid("", "T"), bundle(first.submissions, first.evaluations));
  assert.equal(again.remove.submissions.length, 1);
  assert.equal(again.remove.evaluations.length, 2);
});

test("work recorded elsewhere, or graded in the pane, is never overridden", () => {
  const canvas = { submission_id: "SUB-X", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-BBBBBB", extensions: {} };
  const result = plan(grid("T", "T"), bundle([canvas]));
  assert.equal(result.submissions.length, 1);
  assert.match(result.problems[0]!.problem, /from elsewhere/);
  // And what was not the sheet's is not taken back when its cell empties.
  assert.deepEqual(plan(grid("T", ""), bundle([canvas])).remove.submissions, []);
});

test("a row with marks and no name is held and said, not dropped", () => {
  const rows = [...grid("T", "T"), ["", "", "LT"]];
  const result = plan(rows);
  assert.equal(result.placed.length, 2);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0]!.line, 5);
  assert.match(result.problems[0]!.problem, /no name in "Name", but it has LT under 1Task/);
});

test("a row with neither name nor marks is passed over quietly", () => {
  const rows = [...grid("T", "T"), ["", "", ""], ["", "🚲", ""]];
  assert.equal(sheetRows(rows, config).length, 2);
  assert.deepEqual(plan(rows).problems, []);
});

test("a name that stops matching keeps the grades it already had", () => {
  const first = plan(grid("LT", "T"));
  const misspelt = grid("LT", "T");
  misspelt[2]![0] = "Zzz Qqq";
  const again = plan(misspelt, bundle(first.submissions, first.evaluations));
  assert.equal(again.problems.length, 1);
  assert.deepEqual(again.remove, { submissions: [], evaluations: [] });
  assert.equal(again.kept.length, 1);
  // An emptied name is the same case.
  misspelt[2]![0] = "";
  const emptied = plan(misspelt, bundle(first.submissions, first.evaluations));
  assert.deepEqual(emptied.remove, { submissions: [], evaluations: [] });
  assert.equal(emptied.kept.length, 1);
});

test("a placed student whose cell empties still loses it while another row is held", () => {
  const first = plan(grid("LT", "T"));
  const rows = [...grid("LT", ""), ["", "", "T"]];
  const again = plan(rows, bundle(first.submissions, first.evaluations));
  assert.equal(again.remove.submissions.length, 1);
  assert.equal(again.remove.evaluations.length, 2);
  assert.deepEqual(again.kept, []);
});

test("a mark the settings do not know is held, not guessed", () => {
  const result = plan(grid("X", "T"));
  assert.match(result.problems[0]!.problem, /not a mark/);
});

test("a flag goes into the roster under the run, and comes off again", () => {
  const people = store();
  assert.equal(applyFlags(people, RUN, ["STUDENT-AAAAAA"], { "STUDENT-AAAAAA": "🚲" }), 1);
  assert.deepEqual(people.people["STUDENT-AAAAAA"]!.sheet_flags, { [RUN]: "🚲" });
  assert.equal(applyFlags(people, RUN, ["STUDENT-AAAAAA"], {}), 1);
  assert.equal(people.people["STUDENT-AAAAAA"]!.sheet_flags, undefined);
});
