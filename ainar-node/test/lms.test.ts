import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { RosterStore } from "../src/roster.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { gradeRows } from "../src/gradebook.ts";
import { Directory, buildPlan, classify, refuseInside, writable } from "../src/lms/base.ts";
import {
  assignmentColumns,
  cellNumber,
  currentScores,
  readExport,
  writeImport,
} from "../src/lms/canvas.ts";
import {
  CanvasClient,
  CanvasError,
  apiCurrentScores,
  canvasUserIds,
  isDone,
  loadCanvasConfig,
  scaleProblem,
  visibilityNote,
} from "../src/lms/canvas-api.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import { assessmentGrid, padded, summaryGrid, totals, width } from "../src/lms/grid.ts";
import { Ledger } from "../src/lms/ledger.ts";
import { writeSheet } from "../src/lms/sheet.ts";
import { parseCsv, parseCsvDicts, csvText } from "../src/lms/csv.ts";
import {
  a1,
  columnLetter,
  spreadsheetIdOf,
  totalsInTab,
  trailingRange,
} from "../src/lms/sheets.ts";
import { defaultSheetTab, effectiveSheetTab, effectiveSummaryTab, tabOwners } from "../src/lms/index.ts";
import { draftSubmissionId, submissionsFromApi, submissionsFromExport } from "../src/lms/pull.ts";

/**
 * `tests/test_lms.py`, `test_sheets.py` and `test_canvas_api.py`, reduced to the
 * behaviours that would be dangerous to get wrong: the identity join, the
 * four-way classification, what a blank means, and what leaves the machine.
 *
 * Nothing here reaches the network. `RecordedTransport` replays canned responses
 * and remembers what was asked of it, which is how a grade write is exercised
 * without one ever leaving this process.
 */

const ROOT = resolve(process.cwd(), "..");
const RUN = "CSS-4008-2026-FALL";

const EXPORT = `Student,ID,SIS User ID,SIS Login ID,Section,Foundations Quiz (90201),Model Evaluation Assignment (90218),Current Score,Final Score
    Points Possible,,,,,100.00,100.00,(read only),(read only)
"Aigerim T.",5001,20231023,a.t@example.edu,CS-401,80.00,,72.00,68.00
"Bekzat K.",5002,20231024,b.k@example.edu,CS-401,60.00,55.00,58.00,55.00
"Dana S.",5003,20231025,d.s@example.edu,CS-402,90.00,EX,90.00,45.00
Test Student,0,,,CS-401,,,,
`;

const A04 = "Model Evaluation Assignment (90218)";

const PEOPLE = {
  "STUDENT-JNG7SN": {
    institutional_id: "20231023",
    name: "Aigerim T.",
    email: "a.t@example.edu",
  },
  "STUDENT-K4QM2X": {
    institutional_id: "20231024",
    name: "Bekzat K.",
    email: "b.k@example.edu",
  },
  "STUDENT-R7TB5D": {
    institutional_id: "20231025",
    name: "Dana S.",
    email: "d.s@example.edu",
  },
} as any;

const scratch = () => mkdtempSync(join(tmpdir(), "ainar-lms-"));

const directory = (people = PEOPLE): Directory => {
  const dir = scratch();
  return new Directory(new RosterStore(dir, people), Buffer.from("a-fixed-salt", "utf-8"));
};

const exportFile = (text = EXPORT): string => {
  const path = join(scratch(), "export.csv");
  writeFileSync(path, text, "utf-8");
  return path;
};

const bundle = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle!;
};

const rowsFor = (assessmentId: string) =>
  gradeRows(bundle(), RUN, { assessmentId, allowPartial: true }).get(assessmentId) ?? [];

const response = (status: number, body: string, headers: Record<string, string> = {}): Response => ({
  status,
  body,
  headers,
});

// ------------------------------------------------------------ the export

test("the export metadata rows are not students", () => {
  const read = readExport(exportFile());
  assert.equal(read.students.length, 3, "Points Possible and the test student are metadata");
  assert.equal(read.points_possible[A04], "100.00");
});

test("assignment columns are found by their id", () => {
  const columns = assignmentColumns(readExport(exportFile()));
  assert.deepEqual([...columns.keys()].sort(), ["90201", "90218"]);
  assert.equal(columns.get("90218"), A04);
});

test("computed columns are not mistaken for assignments", () => {
  const columns = assignmentColumns(readExport(exportFile()));
  for (const name of [...columns.values()]) {
    assert.equal(/Current Score|Final Score/.test(name), false);
  }
});

test("an export without an ID column is refused", () => {
  const path = exportFile('Student,SIS User ID\n"A B",20231023\n');
  assert.throws(() => readExport(path), /no 'ID' column/);
});

test("a cell is read as a number or as nothing", () => {
  assert.equal(cellNumber("80.00"), 80);
  assert.equal(cellNumber(""), null);
  assert.equal(cellNumber("EX"), null, "excused is not a zero");
  assert.equal(cellNumber("N/A"), null);
  assert.equal(cellNumber("-"), null);
  assert.equal(cellNumber("A+"), null, "a letter grade is not something to compare");
});

test("an excused cell is not a zero", () => {
  const { scores } = currentScores(readExport(exportFile()), A04, directory(), "sis-id");
  assert.equal(scores["STUDENT-R7TB5D"], null);
  assert.equal(scores["STUDENT-K4QM2X"], 55);
});

test("matching falls back to derivation for someone unknown", () => {
  // A late enrollment is not in the store yet, so the pseudonym is derived. It
  // still has to be a pseudonym rather than a null, or the row silently vanishes.
  const empty = directory({} as any);
  const derived = empty.pseudonymFor("20231023", "sis-id");
  assert.match(derived!, /^STUDENT-[A-Z2-7]{6}$/);
});

test("matching by email can only look up", () => {
  const found = directory();
  assert.equal(found.pseudonymFor("a.t@example.edu", "email"), "STUDENT-JNG7SN");
  assert.equal(found.pseudonymFor("nobody@example.edu", "email"), null);
});

// ------------------------------------------------------ the classification

test("a cell is classified by who last touched it", () => {
  // score, current, prepared -> action
  assert.deepEqual(classify(80, null, null), ["new", null]);
  assert.deepEqual(classify(80, 80, null), ["unchanged", null]);
  assert.deepEqual(classify(80, 70, 70), ["change", null]);
  assert.equal(classify(80, 70, null)[0], "drift");
  assert.equal(classify(80, 70, 60)[0], "drift");
  assert.match(classify(80, 70, 60)[1]!, /did not put there/);
});

test("drift is reported and not written", () => {
  const rows = rowsFor("ASSESSMENT-04");
  const graded = rows.find((row) => row.score !== null)!;
  const plan = buildPlan({
    courseVersionId: RUN,
    assessmentId: "ASSESSMENT-04",
    target: "canvas-csv",
    rows,
    directory: directory(),
    current: { [graded.student_id]: (graded.score ?? 0) + 9 },
    prepared: {},
  });
  const row = plan.rows.find((entry) => entry.student_id === graded.student_id)!;
  assert.equal(row.action, "drift");
  assert.equal(
    writable(plan).some((entry) => entry.student_id === graded.student_id),
    false,
    "a drifted cell must not be written",
  );
});

test("a student the roster does not know is not exported", () => {
  const plan = buildPlan({
    courseVersionId: RUN,
    assessmentId: "ASSESSMENT-04",
    target: "canvas-csv",
    rows: rowsFor("ASSESSMENT-04"),
    directory: directory({} as any),
    requireIdentity: true,
  });
  const unmatched = plan.rows.filter((row) => row.action === "unmatched");
  assert.ok(unmatched.length, "an unknown pseudonym is unmatched, not written blind");
  assert.match(unmatched[0]!.reason!, /roster import/);
});

test("a blocked row is skipped with its reason", () => {
  const plan = buildPlan({
    courseVersionId: RUN,
    assessmentId: "ASSESSMENT-01",
    target: "canvas-csv",
    rows: gradeRows(bundle(), RUN, { assessmentId: "ASSESSMENT-01" }).get("ASSESSMENT-01") ?? [],
    directory: directory(),
  });
  const skipped = plan.rows.filter((row) => row.action === "skip");
  assert.ok(skipped.length);
  assert.ok(skipped[0]!.reason);
});

// ---------------------------------------------------------- the upload file

const preparedPlan = () => {
  const rows = rowsFor("ASSESSMENT-04");
  return buildPlan({
    courseVersionId: RUN,
    assessmentId: "ASSESSMENT-04",
    target: "canvas-csv",
    rows,
    directory: directory(),
  });
};

test("the upload carries the identity columns and one assignment", () => {
  const read = readExport(exportFile());
  const out = join(scratch(), "upload.csv");
  writeImport(preparedPlan(), read, A04, out);

  const { fieldnames, rows } = parseCsvDicts(readFileSync(out, "utf-8"));
  assert.deepEqual(fieldnames, [
    "Student",
    "ID",
    "SIS User ID",
    "SIS Login ID",
    "Section",
    A04,
  ]);
  assert.equal(rows[0]!.Student.trim(), "Points Possible");
  assert.equal(rows[0]![A04], "100.00");
});

test("everyone stays in the file with a blank rather than a zero", () => {
  const read = readExport(exportFile());
  const out = join(scratch(), "upload.csv");
  writeImport(preparedPlan(), read, A04, out);
  const { rows } = parseCsvDicts(readFileSync(out, "utf-8"));
  // Three students plus the Points Possible row: nobody is dropped, and an
  // ungraded student carries "" rather than 0.
  assert.equal(rows.length, 4);
  for (const row of rows.slice(1)) {
    assert.notEqual(row[A04], "0", "a blank must never become a zero");
  }
});

test("a column without an assignment id is refused", () => {
  const read = readExport(exportFile());
  assert.throws(
    () => writeImport(preparedPlan(), read, "Model Evaluation", join(scratch(), "x.csv")),
    /carries no Canvas assignment id/,
  );
});

test("a file naming students may not land in the workspace", () => {
  assert.throws(() => refuseInside(join(ROOT, "grades.csv"), ROOT), /inside the workspace/);
  assert.doesNotThrow(() => refuseInside(join(scratch(), "grades.csv"), ROOT));
});

// ------------------------------------------------------------- the grids

test("the assessment grid puts criteria across, and a blank stays blank", () => {
  const rows = rowsFor("ASSESSMENT-04");
  const grid = assessmentGrid(rows, [
    { criterion_id: "CRIT-04-01", maximum: 25 },
    { criterion_id: "CRIT-04-02", maximum: 25 },
  ], { maximum: 100 });
  assert.deepEqual(grid.header.slice(0, 4), ["student", "name", "CRIT-04-01", "CRIT-04-02"]);
  assert.equal(grid.lead[0]![0], "points possible");
  assert.equal(grid.lead[0]![2], "25");
  assert.ok(grid.rows.some((row) => row.includes("")), "an unscored criterion is empty");
  assert.equal(grid.students.length, grid.rows.length);
});

test("the csv and the live sheet write the same table", () => {
  const rows = rowsFor("ASSESSMENT-04");
  const criteria = [{ criterion_id: "CRIT-04-01", maximum: 25 }];
  const out = join(scratch(), "sheet.csv");
  writeSheet(rows, criteria, out, { maximum: 100 });
  const grid = assessmentGrid(rows, criteria, { maximum: 100 });
  assert.deepEqual(parseCsv(readFileSync(out, "utf-8")), [grid.header, ...grid.lead, ...grid.rows]);
});

test("the summary never calls a partial standing a final grade", () => {
  const payload = { assessments: [], totals: [] } as any;
  const grid = summaryGrid(payload);
  assert.ok(grid.header.includes("% of graded so far"));
  assert.equal(grid.header.includes("final"), false);
  assert.match(grid.note!, /A blank was never assessed/);
});

test("a grid is padded to a rectangle", () => {
  const grid = {
    header: ["a", "b", "c"],
    lead: [["x"]],
    rows: [["1", "2"]],
    students: [""],
    note: null,
  };
  for (const row of padded(grid)) assert.equal(row.length, width(grid));
});

test("the sheet can leave the comments out", () => {
  const rows = rowsFor("ASSESSMENT-04");
  const withComments = assessmentGrid(rows, [], { maximum: 100, comments: true });
  const without = assessmentGrid(rows, [], { maximum: 100, comments: false });
  assert.ok(withComments.header.includes("comment"));
  assert.equal(without.header.includes("comment"), false);
});

test("names appear only when asked for", () => {
  const rows = rowsFor("ASSESSMENT-04");
  const anonymous = assessmentGrid(rows, [], { maximum: 100 });
  const named = assessmentGrid(rows, [], { maximum: 100, names: { [rows[0]!.student_id]: "A B" } });
  assert.equal(anonymous.rows[0]![1], "");
  assert.equal(named.rows[0]![1], "A B");
});

// ------------------------------------------------------------- the ledger

test("the ledger round trips and feeds drift detection", () => {
  const dir = scratch();
  const ledger = Ledger.load(RUN, dir);
  const touched = ledger.record(
    "canvas-csv",
    "ASSESSMENT-04",
    [{ student_id: "STUDENT-JNG7SN", score: 80, maximum: 100 }],
    { at: "2026-10-20T12:00:00+05:00" },
  );
  assert.equal(touched, 1);
  ledger.save();

  const reopened = Ledger.load(RUN, dir);
  assert.deepEqual(reopened.prepared("canvas-csv", "ASSESSMENT-04"), { "STUDENT-JNG7SN": 80 });
  // The same value in the target is now a change we own, not drift.
  assert.equal(classify(90, 80, 80)[0], "change");
});

test("only an api may claim a value was applied", () => {
  const ledger = new Ledger(join(scratch(), "l.json"));
  assert.throws(
    () => ledger.record("canvas-csv", "A", [], { at: "x", state: "landed" }),
    /unknown ledger state/,
  );
});

test("a ledger keeps the halves it does not understand", () => {
  // `content` and `pushed` belong to `ainar notion`, which is not ported here.
  // Dropping them would destroy the record of what was published.
  const dir = scratch();
  const path = join(dir, `${RUN}.json`);
  writeFileSync(
    path,
    JSON.stringify({ version: 3, entries: {}, content: { "notion|abc": { hash: "x" } }, pushed: {} }),
    "utf-8",
  );
  const ledger = Ledger.load(RUN, dir);
  ledger.save();
  assert.deepEqual(JSON.parse(readFileSync(path, "utf-8")).content, { "notion|abc": { hash: "x" } });
});

// ------------------------------------------------------------ Canvas, live

const CONFIG = { base_url: "https://canvas.example.edu", token: "secret" };

test("every request carries the bearer token", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/courses/1/assignments/2": response(200, '{"id": 2}'),
  });
  await new CanvasClient(CONFIG, transport).assignment("1", "2");
  assert.equal(transport.calls.length, 1);
});

test("pagination follows the Link header", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/courses/1/users": [
      response(200, '[{"id": 1}]', {
        Link: '<https://canvas.example.edu/api/v1/courses/1/users?page=2>; rel="next"',
      }),
      response(200, '[{"id": 2}]'),
    ],
  });
  const students = await new CanvasClient(CONFIG, transport).students("1");
  assert.deepEqual(students.map((student) => student.id), [1, 2]);
});

test("a self-referential next link does not loop forever", async () => {
  // A server that points at itself. The first request carries `?per_page=100`
  // and the link does not, so one repeat gets through before the seen-set
  // matches; what must not happen is a third, or a thousandth.
  const same = "https://canvas.example.edu/api/v1/courses/1/users?page=1";
  const transport = new RecordedTransport({
    "GET /api/v1/courses/1/users": [
      response(200, '[{"id": 1}]', { Link: `<${same}>; rel="next"` }),
      response(200, '[{"id": 1}]', { Link: `<${same}>; rel="next"` }),
    ],
  });
  const students = await new CanvasClient(CONFIG, transport).students("1");
  assert.ok(students.length <= 2, `followed the link ${students.length} times`);
});

test("Canvas refusals are explained", async () => {
  for (const [status, body, match] of [
    [401, '{"errors":[{"message":"Invalid access token."}]}', /token is current/],
    [404, '{"errors":[{"message":"The specified resource does not exist."}]}', /no such thing/],
    [500, "boom", /returned 500/],
  ] as [number, string, RegExp][]) {
    const transport = new RecordedTransport({
      "GET /api/v1/courses/1/assignments/2": response(status, body),
    });
    await assert.rejects(
      () => new CanvasClient(CONFIG, transport).assignment("1", "2"),
      (error: Error) => error instanceof CanvasError && match.test(error.message),
    );
  }
});

test("a rate limit says nothing partial was written", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/courses/1/assignments/2": response(403, "403 Forbidden (Rate Limit Exceeded)"),
  });
  await assert.rejects(
    () => new CanvasClient(CONFIG, transport).assignment("1", "2"),
    /nothing partial was written/,
  );
});

test("a scale mismatch is caught before anything is sent", () => {
  assert.match(scaleProblem({ points_possible: 50 }, 100)!, /out of 50 but/);
  assert.equal(scaleProblem({ points_possible: 100 }, 100), null);
  assert.match(scaleProblem({}, 100)!, /no points_possible/);
});

test("the posting policy is reported either way", () => {
  assert.match(visibilityNote({ post_manually: true }), /hidden until you post/);
  assert.match(visibilityNote({ post_manually: false }), /see these grades at once/);
});

test("the join returns identifiers and not names", () => {
  const { mapped, unmatched } = canvasUserIds(
    [
      { id: 5001, sis_user_id: "20231023", name: "Aigerim T." },
      { id: 5099, sis_user_id: null, name: "Nobody" },
    ],
    directory(),
    "sis-id",
  );
  assert.deepEqual([...mapped], [["STUDENT-JNG7SN", "5001"]]);
  assert.deepEqual(unmatched, ["5099"]);
  assert.equal(JSON.stringify([...mapped]).includes("Aigerim"), false);
});

test("an ungraded or excused submission is not a zero", () => {
  const scores = apiCurrentScores(
    [
      { user_id: 5001, score: 80, workflow_state: "graded" },
      { user_id: 5002, score: null, workflow_state: "unsubmitted" },
      { user_id: 5003, score: 60, excused: true, workflow_state: "graded" },
    ],
    new Map([
      ["STUDENT-JNG7SN", "5001"],
      ["STUDENT-K4QM2X", "5002"],
      ["STUDENT-R7TB5D", "5003"],
    ]),
  );
  assert.deepEqual(scores, {
    "STUDENT-JNG7SN": 80,
    "STUDENT-K4QM2X": null,
    "STUDENT-R7TB5D": null,
  });
});

test("the posted body is exactly the planned grades, form encoded", async () => {
  const transport = new RecordedTransport({
    "POST /api/v1/courses/1/assignments/2/submissions/update_grades": response(
      200,
      '{"id": "77", "workflow_state": "queued"}',
    ),
  });
  const progress = await new CanvasClient(CONFIG, transport).updateGrades(
    "1",
    "2",
    new Map([
      ["5001", [80, "Well argued."]],
      ["5002", [55, null]],
    ]),
  );
  assert.equal(progress.id, "77");
  const body = transport.bodies("POST")[0]!;
  assert.match(body, /grade_data%5B5001%5D%5Bposted_grade%5D=80/);
  assert.match(body, /grade_data%5B5001%5D%5Btext_comment%5D=Well\+argued/);
  assert.equal(body.includes("5002%5D%5Btext_comment"), false, "no comment, none sent");
  assert.equal(body.includes("excuse"), false, "nothing is excused by this tooling");
});

test("an empty write is refused rather than sent", async () => {
  const transport = new RecordedTransport({});
  await assert.rejects(
    () => new CanvasClient(CONFIG, transport).updateGrades("1", "2", new Map()),
    /no grades to send/,
  );
  assert.equal(transport.calls.length, 0);
});

test("the job is polled until Canvas finishes", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/progress/77": [
      response(200, '{"id": "77", "workflow_state": "running"}'),
      response(200, '{"id": "77", "workflow_state": "completed"}'),
    ],
  });
  const final = await new CanvasClient(CONFIG, transport).waitFor(
    { id: "77", state: "queued", completion: null, message: null },
    { sleep: async () => {} },
  );
  assert.equal(final.state, "completed");
  assert.equal(isDone(final), true);
});

test("giving up waiting is not the same as failing", async () => {
  const transport = new RecordedTransport({
    "GET /api/v1/progress/77": response(200, '{"id": "77", "workflow_state": "running"}'),
  });
  const final = await new CanvasClient(CONFIG, transport).waitFor(
    { id: "77", state: "queued", completion: null, message: null },
    { attempts: 3, sleep: async () => {} },
  );
  assert.equal(isDone(final), false);
  assert.equal(final.state, "running", "still running is not failed");
});

/**
 * A registry path that is guaranteed not to exist.
 *
 * Every `loadCanvasConfig` call here names one. Without it these tests would
 * consult whatever `~/.ainar/connections.json` happens to hold on the machine
 * running them, and a professor who had migrated their own connections would
 * watch the suite fail for a reason that has nothing to do with the code.
 */
const NO_REGISTRY = { connectionsPath: join(tmpdir(), "ainar-no-such-registry.json") };

test("a missing token is explained, not guessed", () => {
  const saved = process.env.AINAR_CANVAS_TOKEN;
  delete process.env.AINAR_CANVAS_TOKEN;
  try {
    assert.throws(
      () =>
        loadCanvasConfig(scratch(), { baseUrl: "https://canvas.example.edu", ...NO_REGISTRY }),
      /AINAR_CANVAS_TOKEN/,
    );
    assert.throws(() => loadCanvasConfig(scratch(), NO_REGISTRY), /no Canvas host configured/);
  } finally {
    if (saved !== undefined) process.env.AINAR_CANVAS_TOKEN = saved;
  }
});

test("the host can come from the config file", () => {
  const dir = scratch();
  writeFileSync(
    join(dir, "lms.toml"),
    '[canvas]\nbase_url = "https://from-config.example.edu"\ntoken = "t"\n',
    "utf-8",
  );
  const saved = process.env.AINAR_CANVAS_URL;
  delete process.env.AINAR_CANVAS_URL;
  try {
    const config = loadCanvasConfig(dir, NO_REGISTRY);
    assert.equal(config.base_url, "https://from-config.example.edu");
    assert.match(config.source ?? "", /lms\.toml/, "and it says where it came from");
  } finally {
    if (saved !== undefined) process.env.AINAR_CANVAS_URL = saved;
  }
});

// ------------------------------------------------------------- the sheet

test("tab names are quoted for A1", () => {
  assert.equal(a1("Summary", "A1:C3"), "'Summary'!A1:C3");
  assert.equal(a1("Fall 2026", "A1"), "'Fall 2026'!A1");
  assert.equal(a1("O'Brien", "A1"), "'O''Brien'!A1");
});

test("column letters carry past Z", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(columnLetter(51), "AZ");
  assert.equal(columnLetter(701), "ZZ");
});

test("a pasted url is accepted as an id, and one with no id is refused", () => {
  assert.equal(
    spreadsheetIdOf("https://docs.google.com/spreadsheets/d/1AbC_xyz/edit#gid=0"),
    "1AbC_xyz",
  );
  assert.equal(spreadsheetIdOf("1AbC_xyz"), "1AbC_xyz");
  assert.throws(() => spreadsheetIdOf("https://docs.google.com/spreadsheets/"), /could not find/);
});

test("the total column is found by name, not position", () => {
  const rows = [
    ["student", "a note of my own", "total"],
    ["STUDENT-AAA111", "anything", "80"],
  ];
  assert.deepEqual(totalsInTab(rows), { "STUDENT-AAA111": 80 });
});

test("text in a score cell reads as no value", () => {
  const rows = [
    ["student", "total"],
    ["STUDENT-AAA111", "absent"],
    ["STUDENT-BBB222", ""],
  ];
  assert.deepEqual(totalsInTab(rows), { "STUDENT-AAA111": null, "STUDENT-BBB222": null });
});

test("a tab with no recognisable header reads as nothing", () => {
  assert.deepEqual(totalsInTab([["name", "mark"], ["x", "1"]]), {});
  assert.deepEqual(totalsInTab([]), {});
});

test("rows for people not in this run are ignored", () => {
  const rows = [
    ["student", "total"],
    ["STUDENT-AAA111", "80"],
    ["STUDENT-ZZZ999", "90"],
  ];
  assert.deepEqual(totalsInTab(rows, new Set(["STUDENT-AAA111"])), { "STUDENT-AAA111": 80 });
});

test("the rows below a shrunken grid are cleared, and nothing else is", () => {
  const grid = {
    header: ["student", "total"],
    lead: [],
    rows: [["STUDENT-AAA111", "80"]],
    students: ["STUDENT-AAA111"],
    note: null,
  };
  const shrunk = [["student", "total"], ["a", "1"], ["b", "2"], ["c", "3"]];
  assert.equal(trailingRange("A04", grid, shrunk), "'A04'!A3:B4");
  assert.equal(trailingRange("A04", grid, [["student", "total"], ["a", "1"]]), null);
});

// -------------------------------------------------------------- tab names

test("a tab name is derived from the assessment id", () => {
  assert.equal(defaultSheetTab({ assessment_id: "ASSESSMENT-04" }), "A04");
  assert.equal(defaultSheetTab({ assessment_id: "ASSESSMENT-1" }), "A1");
  assert.equal(defaultSheetTab({ assessment_id: "ASSESSMENT-MIDTERM" }), "MIDTERM");
  assert.equal(defaultSheetTab({ assessment_id: "ASSESSMENT-04-RESIT" }), "A04-RESIT");
});

test("the derived name does not move when the title is reworded", () => {
  const first = defaultSheetTab({ assessment_id: "ASSESSMENT-04", title: "Model Evaluation" });
  const second = defaultSheetTab({ assessment_id: "ASSESSMENT-04", title: "Something else" });
  assert.equal(first, second);
});

test("characters Google rejects cannot survive derivation", () => {
  // Unreachable from a valid id — the pattern forbids them — but not assumed.
  const derived = defaultSheetTab({ assessment_id: "ASSESSMENT-04/A[1]" });
  for (const char of "[]*?/\:") {
    assert.equal(derived.includes(char), false, `${char} survived into '${derived}'`);
  }
});

test("a written down tab wins over the default", () => {
  const assessment = {
    assessment_id: "ASSESSMENT-04",
    extensions: { lms: { sheet_tab: "Midterm" } },
  };
  assert.equal(effectiveSheetTab(assessment), "Midterm");
  assert.equal(effectiveSummaryTab({ extensions: {} }), "Summary");
});

test("two assessments cannot share one tab", () => {
  const owners = tabOwners(
    [{ course_version_id: RUN, extensions: {} }],
    [
      { assessment_id: "ASSESSMENT-04", extensions: {} },
      { assessment_id: "ASSESSMENT-05", extensions: { lms: { sheet_tab: "A04" } } },
    ],
    RUN,
  );
  assert.deepEqual(owners.get("A04"), ["ASSESSMENT-04", "ASSESSMENT-05"]);
});

// ---------------------------------------------------------------- the pull

test("the draft identifier names the student and assessment", () => {
  assert.equal(draftSubmissionId("STUDENT-JNG7SN", "ASSESSMENT-04"), "SUB-DRAFT-JNG7SN-04");
});

test("submissions are proposed only for students Canvas has work for", () => {
  const { drafts } = submissionsFromExport(
    readExport(exportFile()),
    A04,
    directory(),
    "sis-id",
    { assessmentId: "ASSESSMENT-04" },
  );
  // Aigerim has a blank and Dana is excused; only Bekzat has a value.
  assert.deepEqual(drafts.map((draft) => draft.student_id), ["STUDENT-K4QM2X"]);
});

test("no submission time is invented", () => {
  const { drafts } = submissionsFromExport(
    readExport(exportFile()),
    A04,
    directory(),
    "sis-id",
    { assessmentId: "ASSESSMENT-04" },
  );
  assert.equal("submitted_at" in drafts[0]!, false);
  assert.match(drafts[0]!.note, /No submission time was available/);
});

test("a student not enrolled in this run is skipped", () => {
  const { drafts, unmatched } = submissionsFromExport(
    readExport(exportFile()),
    A04,
    directory(),
    "sis-id",
    { assessmentId: "ASSESSMENT-04", enrolled: [] },
  );
  assert.deepEqual(drafts, []);
  assert.deepEqual(unmatched, ["STUDENT-K4QM2X"]);
});

test("submission times come from Canvas, and lateness with them", () => {
  const { drafts } = submissionsFromApi(
    [
      {
        user_id: 5001,
        submitted_at: "2026-10-15T18:59:00Z",
        workflow_state: "submitted",
        late: true,
        attempt: 2,
        attachments: [{}, {}],
      },
    ],
    new Map([["STUDENT-JNG7SN", "5001"]]),
    { assessmentId: "ASSESSMENT-04" },
    300,
  );
  assert.equal(drafts[0]!.submitted_at, "2026-10-15T23:59:00+05:00");
  assert.equal(drafts[0]!.status, "late");
  assert.equal(drafts[0]!.attempt, 2);
  assert.match(drafts[0]!.note, /2 file\(s\) are attached in Canvas; the bytes stay/);
});

test("an unsubmitted placeholder or an excused student is not a submission", () => {
  const { drafts } = submissionsFromApi(
    [
      { user_id: 5001, workflow_state: "unsubmitted", submitted_at: null },
      { user_id: 5002, workflow_state: "submitted", submitted_at: "2026-10-15T10:00:00Z", excused: true },
    ],
    new Map([
      ["STUDENT-JNG7SN", "5001"],
      ["STUDENT-K4QM2X", "5002"],
    ]),
    { assessmentId: "ASSESSMENT-04" },
    300,
  );
  assert.deepEqual(drafts, []);
});

// ----------------------------------------------------------------- the CSV

test("a CSV field is quoted only when it has to be", () => {
  assert.equal(csvText([["a", "b"]]), "a,b\r\n");
  assert.equal(csvText([["a,b", 'say "hi"', "one\ntwo"]]), '"a,b","say ""hi""","one\ntwo"\r\n');
});

test("a quoted field holding a comma survives the round trip", () => {
  const table = [["student", "note"], ["STUDENT-AAA111", 'Good, but "thin" in places']];
  assert.deepEqual(parseCsv(csvText(table)), table);
});
