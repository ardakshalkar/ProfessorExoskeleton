import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { evaluationId } from "../src/grade-board.ts";
import { DEFAULT_MARKS, type SheetConfig, planSync, sheetRows } from "../src/grade-sheet.ts";
import { Sync } from "../src/model/sync.ts";
import { RosterStore } from "../src/roster.ts";
import { runSync } from "../src/sync/command.ts";
import { LinkTable, nameLinkKey } from "../src/sync/links.ts";
import { matchRow } from "../src/sync/match.ts";
import { decide, reconcile } from "../src/sync/reconcile.ts";
import { impliedSyncs, syncsOf, writtenForm } from "../src/sync/registry.ts";
import { runMarksSync } from "../src/sync/sheet-marks.ts";
import { validate } from "../src/validate.ts";

const RUN = "CSS-1-2026-FALL";
const AT = "2026-10-09T12:00:00+05:00";
const temp = () => mkdtempSync(join(tmpdir(), "ainar-sync-"));

const store = () =>
  new RosterStore("unused", {
    "STUDENT-AAAAAA": { name: "Ерменбаева Индира Болатовна" },
    "STUDENT-BBBBBB": { name: "Ostanin Artem" },
    "STUDENT-CCCCCC": { name: "Nurlanova Aigerim" },
  });
const enrolled = new Set(["STUDENT-AAAAAA", "STUDENT-BBBBBB", "STUDENT-CCCCCC"]);

const context = (links: LinkTable, unsure: "hold" | "ask" = "hold") => ({
  syncId: "hw-sheet",
  steps: ["link", "code", "name", "name:one-word"] as any,
  unsure,
  links,
  store: store(),
  salt: null,
  enrolled,
  at: AT,
});

// --------------------------------------------------------------------------
// Three values
// --------------------------------------------------------------------------

test("two-way: whichever side changed since the last sync wins, and both changing is held", () => {
  assert.equal(decide("k", "LT", "T", "T", "both").verdict, "send");
  assert.equal(decide("k", "T", "T", "LT", "both").verdict, "take");
  assert.equal(decide("k", "LT", "T", "LLT", "both").verdict, "conflict");
  assert.equal(decide("k", "LT", "T", "LT", "both").verdict, "same");
});

test("a first sync fills an empty side and holds two different values", () => {
  assert.equal(decide("k", "T", null, "", "both").verdict, "send");
  assert.equal(decide("k", "", null, "T", "both").verdict, "take");
  assert.equal(decide("k", "T", null, "LT", "both").verdict, "conflict");
});

test("a one-way sync never moves a value against itself", () => {
  // A target's far side edited by hand is drift, never taken in.
  assert.equal(decide("k", "80", "80", "75", "target").verdict, "drift");
  // A source never sends what changed in the course.
  assert.equal(decide("k", "LT", "T", "T", "source").verdict, "same");
});

test("a conflict rule settles what refuse would hold", () => {
  assert.equal(decide("k", "LT", "T", "LLT", "both", "course-wins").verdict, "send");
  assert.equal(decide("k", "LT", "T", "LLT", "both", "remote-wins").verdict, "take");
  assert.equal(decide("k", "LT", null, "", "both", "fill-blanks").verdict, "send");
  const all = reconcile({ a: "1", b: "2" }, { a: "1", b: "1" }, { a: "3", b: "1" }, "both");
  assert.deepEqual(all.map((entry) => entry.verdict), ["take", "send"]);
});

// --------------------------------------------------------------------------
// The matcher
// --------------------------------------------------------------------------

test("a sure name is placed and remembered as a link", () => {
  const links = new LinkTable("(memory)", RUN);
  const outcome = matchRow({ label: "Yermenbayeva Indira", name: "Yermenbayeva Indira" }, context(links));
  assert.deepEqual(outcome, { status: "placed", student: "STUDENT-AAAAAA", how: "words" });
  assert.equal(links.get("hw-sheet", nameLinkKey("Yermenbayeva Indira"))!.student, "STUDENT-AAAAAA");
  // Next time it is found by the link.
  assert.equal((matchRow({ label: "x", name: "Yermenbayeva Indira" }, context(links)) as any).how, "link");
});

test("a close spelling is held for review under unsure: hold, and listed under ask", () => {
  const links = new LinkTable("(memory)", RUN);
  const held = matchRow({ label: "Ostanin Artym", line: 7, name: "Ostanin Artym" }, context(links));
  assert.equal(held.status, "held");
  assert.equal((held as any).candidates[0].student, "STUDENT-BBBBBB");
  assert.equal(links.queued("hw-sheet").length, 1);
  assert.equal(links.queued("hw-sheet")[0]![1].line, 7);

  const asked = matchRow({ label: "Ostanin Artym", name: "Ostanin Artym" }, context(new LinkTable("(memory)", RUN), "ask"));
  assert.deepEqual(asked, { status: "check", student: "STUDENT-BBBBBB", how: "close" });
});

test("one written word is held too, and a confirmed link then places it", () => {
  const links = new LinkTable("(memory)", RUN);
  assert.equal(matchRow({ label: "Aigerim", name: "Aigerim" }, context(links)).status, "held");
  links.set("hw-sheet", nameLinkKey("Aigerim"), { student: "STUDENT-CCCCCC", how: "confirmed", at: AT });
  assert.deepEqual(matchRow({ label: "Aigerim", name: "Aigerim" }, context(links)), {
    status: "placed",
    student: "STUDENT-CCCCCC",
    how: "link",
  });
  assert.equal(links.queued("hw-sheet").length, 0);
});

test("a link to someone no longer enrolled is held, not followed", () => {
  const links = new LinkTable("(memory)", RUN);
  links.set("hw-sheet", nameLinkKey("Old Name"), { student: "STUDENT-ZZZZZZ", how: "pinned", at: AT });
  const outcome = matchRow({ label: "Old Name", name: "Old Name" }, context(links));
  assert.equal(outcome.status, "held");
  assert.match((outcome as any).problem, /not enrolled/);
});

test("a row that carries its code is placed by it", () => {
  const links = new LinkTable("(memory)", RUN);
  const outcome = matchRow({ label: "row", code: "STUDENT-BBBBBB" }, context(links));
  assert.equal((outcome as any).student, "STUDENT-BBBBBB");
});

// --------------------------------------------------------------------------
// The marks sheet on the shared matcher
// --------------------------------------------------------------------------

const config: SheetConfig = {
  run: RUN,
  url: null,
  tab: null,
  name_column: "Name",
  flag_column: null,
  columns: { "1Task": "ASSESSMENT-HW1" },
  marks: DEFAULT_MARKS,
  students: {},
};

const bundle = (submissions: any[] = [], evaluations: any[] = []) => ({
  assessments: [
    {
      assessment_id: "ASSESSMENT-HW1",
      course_version_id: RUN,
      rubric: { rubric_id: "RUBRIC-HW1", criteria: [{ criterion_id: "CRIT-HW1-A", maximum_score: 2 }] },
    },
  ],
  rubrics: [],
  submissions,
  evaluations,
});

const plan = (grid: string[][], options: Record<string, unknown> = {}, b = bundle()) =>
  planSync({
    rows: sheetRows(grid, config),
    config,
    bundle: b,
    runId: RUN,
    store: store(),
    salt: null,
    enrolled,
    decidedBy: "USER-1",
    decidedAt: AT,
    ...options,
  });

test("an unsure name in the sheet is held and queued, and writes nothing for that row", () => {
  const links = new LinkTable("(memory)", RUN);
  const result = plan([["Name", "1Task"], ["Ostanin Artym", "T"], ["Nurlanova Aigerim", "LT"]], { links });
  assert.equal(result.placed.length, 1);
  assert.equal(result.queued, 1);
  assert.equal(result.submissions.length, 1);
  assert.match(result.problems[0]!.problem, /close spelling of STUDENT-BBBBBB/);
});

test("two-way: a grade decided in the pane goes into an empty cell", () => {
  const pane = [
    { submission_id: "SUB-X", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-CCCCCC", status: "submitted", extensions: {} },
  ];
  const decided = [
    {
      evaluation_id: evaluationId("STUDENT-CCCCCC", "CRIT-HW1-A"),
      submission_id: "SUB-X",
      criterion_id: "CRIT-HW1-A",
      professor_decision: { score: 2 },
    },
  ];
  const result = plan([["Name", "1Task"], ["Nurlanova Aigerim", ""]], { role: "both" }, bundle(pane, decided));
  assert.deepEqual(result.writeBack, [{ line: 2, column: "1Task", student: "STUDENT-CCCCCC", word: "T" }]);
  // A source sync never writes back.
  assert.deepEqual(plan([["Name", "1Task"], ["Nurlanova Aigerim", ""]], {}, bundle(pane, decided)).writeBack, []);
});

test("two-way: a pane grade no mark word fits is left alone rather than guessed", () => {
  const pane = [
    { submission_id: "SUB-X", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-CCCCCC", status: "submitted", extensions: {} },
  ];
  const decided = [
    { evaluation_id: evaluationId("STUDENT-CCCCCC", "CRIT-HW1-A"), submission_id: "SUB-X", criterion_id: "CRIT-HW1-A", professor_decision: { score: 1.3 } },
  ];
  const result = plan([["Name", "1Task"], ["Nurlanova Aigerim", ""]], { role: "both" }, bundle(pane, decided));
  assert.deepEqual(result.writeBack, []);
});

test("two-way: the sheet's own change since the last sync is taken, the course's is sent, both is held", () => {
  const first = plan([["Name", "1Task"], ["Nurlanova Aigerim", "T"]], { role: "both" });
  const wrote = bundle(first.submissions, first.evaluations);
  const base = { "STUDENT-CCCCCC|ASSESSMENT-HW1": "T" };

  const taken = plan([["Name", "1Task"], ["Nurlanova Aigerim", "LT"]], { role: "both", base }, wrote);
  assert.equal(taken.writeBack.length, 0);
  assert.equal((taken.submissions[0] as any).extensions.mark, "LT");

  // The course moved to LLT (its own record says so) while the sheet still says T: send.
  const moved = bundle(
    first.submissions.map((entry) => ({ ...entry, extensions: { ...(entry.extensions as any), mark: "LLT" } })),
    first.evaluations,
  );
  const sent = plan([["Name", "1Task"], ["Nurlanova Aigerim", "T"]], { role: "both", base }, moved);
  assert.deepEqual(sent.writeBack.map((cell) => cell.word), ["LLT"]);
  assert.deepEqual(sent.remove, { submissions: [], evaluations: [] });

  // Both moved, differently: held, and nothing is taken back.
  const both = plan([["Name", "1Task"], ["Nurlanova Aigerim", "LT"]], { role: "both", base }, moved);
  assert.equal(both.writeBack.length, 0);
  assert.match(both.problems[0]!.problem, /both changed/);
  assert.deepEqual(both.remove, { submissions: [], evaluations: [] });
});

test("a renamed header is still found by its anchor", () => {
  const anchors = { columns: new Map([[0, "name"], [1, "ASSESSMENT-HW1"]]), rows: new Map([[1, "a1b2c3"]]) };
  const rows = sheetRows([["ФИО", "Task 1"], ["Nurlanova Aigerim", "T"]], config, anchors);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.cells["1Task"], "T");
  assert.equal(rows[0]!.anchor, "a1b2c3");
});

test("an anchored row is found by its anchor even with the name erased", () => {
  const links = new LinkTable("(memory)", RUN);
  links.set("hw-sheet", "anchor:a1b2c3", { student: "STUDENT-CCCCCC", how: "anchor", at: AT });
  const anchors = { columns: new Map([[0, "name"], [1, "ASSESSMENT-HW1"]]), rows: new Map([[1, "a1b2c3"]]) };
  const result = planSync({
    rows: sheetRows([["Name", "1Task"], ["", "LT"]], config, anchors),
    config,
    bundle: bundle(),
    runId: RUN,
    store: store(),
    salt: null,
    enrolled,
    decidedBy: null,
    decidedAt: AT,
    links,
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.placed[0]!.student, "STUDENT-CCCCCC");
});

// --------------------------------------------------------------------------
// The registry, the validator and the command
// --------------------------------------------------------------------------

const runBundle = (run: Record<string, unknown>) =>
  ({
    course: { course_id: "CSS-1" },
    outcomes: [],
    concepts: [],
    concept_edges: [],
    capabilities: [],
    modules: [],
    users: [],
    versions: [{ course_version_id: RUN, course_id: "CSS-1", term: "2026-FALL", ...run }],
    enrollments: [],
    activities: [],
    documents: [],
    resources: [],
    assessments: [{ assessment_id: "ASSESSMENT-HW1", course_version_id: RUN, title: "HW1" }],
    rubrics: [],
    items: [],
    item_models: [],
    submissions: [],
    item_responses: [],
    evaluations: [],
    evidence: [],
    concept_states: [],
    capability_states: [],
    signals: [],
    interventions: [],
    events: [],
    action_items: [],
  }) as any;

test("older settings are read as implied syncs, and a written one replaces its implied twin", () => {
  const sheets = temp();
  writeFileSync(join(sheets, `${RUN}.json`), JSON.stringify({ url: "1AbC", columns: { "1Task": "ASSESSMENT-HW1" } }));
  const run = { extensions: { lms: { canvas_course_id: 3312, sheet_id: "1XyZ" } } };
  const implied = impliedSyncs(runBundle(run), RUN, { sheetsDir: sheets }).map((sync) => sync.sync_id);
  assert.deepEqual(implied, ["canvas-roster", "canvas-submissions", "canvas-grades", "canvas-assignment", "gradebook-copy", "hw-sheet"]);

  const written = Sync.parse({ sync_id: "marks", service: "sheets", role: "both", stream: "marks", map: { columns: { "1Task": "ASSESSMENT-HW1" } } });
  const all = syncsOf(runBundle({ ...run, syncs: [written] }), RUN, { sheetsDir: sheets });
  assert.ok(all.some((sync) => sync.sync_id === "marks" && !sync.implied));
  // `marks` is sheets·marks·both; the implied hw-sheet is sheets·marks·source, a different road, so both remain.
  assert.ok(all.some((sync) => sync.sync_id === "hw-sheet" && sync.implied));
});

test("the written form leaves defaults out", () => {
  const sync = Sync.parse({ sync_id: "x", service: "canvas", role: "target", stream: "grades", conflict: "refuse", unsure: "ask" });
  assert.deepEqual(writtenForm(sync as any), { sync_id: "x", service: "canvas", role: "target", stream: "grades", unsure: "ask" });
});

test("validate: a duplicate id, an unknown assessment and an unsupported road are reported", () => {
  const syncs = [
    { sync_id: "hw", service: "sheets", role: "source", stream: "marks", where: { sheet: "1" }, map: { columns: { A: "ASSESSMENT-NOPE" } } },
    { sync_id: "hw", service: "moodle", role: "target", stream: "grades" },
  ];
  const codes = validate(runBundle({ syncs })).items.map((issue) => issue.code);
  assert.ok(codes.includes("sync.duplicate"));
  assert.ok(codes.includes("sync.map"));
  assert.ok(codes.includes("sync.unsupported"));
});

const args = (over: Record<string, unknown>) =>
  ({
    subcommand: "list",
    run: RUN,
    sync: null,
    extra: [],
    confirm: false,
    dryRun: false,
    json: false,
    all: false,
    line: null,
    name: null,
    to: null,
    unlink: false,
    from: null,
    rosterDir: temp(),
    linksDir: temp(),
    passthrough: [],
    ...over,
  }) as any;

test("sync run refuses to change Canvas without --confirm, and plan hands over to lms plan", async () => {
  const run = { syncs: [{ sync_id: "canvas-grades", service: "canvas", role: "target", stream: "grades", connection: "narxoz" }] };
  const lines: unknown[] = [];
  const calls: string[][] = [];
  const deps = { out: (line: unknown) => lines.push(line), delegate: (argv: string[]) => (calls.push(argv), 0) };
  const refused = await runSync(args({ subcommand: "run", sync: "canvas-grades" }), runBundle(run), "/nowhere", deps);
  assert.equal(refused, 1);
  assert.equal(calls.length, 0);

  await runSync(args({ subcommand: "plan", sync: "canvas-grades", passthrough: ["--assessment", "ASSESSMENT-HW1"] }), runBundle(run), "/nowhere", deps);
  assert.deepEqual(calls[0], ["lms", "plan", RUN, "--target", "canvas-api", "--connection", "narxoz", "--assessment", "ASSESSMENT-HW1"]);
});

/** A Google Sheets client that keeps the sheet in memory and records what was written. */
class FakeSheets {
  grid: string[][];
  rowAnchors = new Map<number, string>();
  columnAnchors = new Map<number, string>();
  cells: { range: string; value: string }[] = [];
  constructor(grid: string[][]) {
    this.grid = grid;
  }
  async tabs() {
    return [{ title: "Homework", sheetId: 42 }];
  }
  async read() {
    return this.grid;
  }
  async anchors() {
    return { rows: new Map(this.rowAnchors), columns: new Map(this.columnAnchors) };
  }
  async addAnchors(_id: string, _sheet: number, anchors: { dimension: string; index: number; value: string }[]) {
    for (const anchor of anchors) (anchor.dimension === "ROWS" ? this.rowAnchors : this.columnAnchors).set(anchor.index, anchor.value);
  }
  async writeCells(_id: string, cells: { range: string; value: string }[]) {
    this.cells.push(...cells);
    return cells.length;
  }
}

test("a two-way anchored sheet: matched once by name, then by anchor after the name and header change", async () => {
  const root = temp();
  const rosterDir = temp();
  const linksDir = temp();
  const syncDir = temp();
  writeFileSync(join(rosterDir, "people.json"), JSON.stringify({ version: 1, people: store().people }));
  const course = runBundle({});
  course.versions[0].instructors = ["USER-1"];
  course.enrollments = [...enrolled].map((student) => ({ course_version_id: RUN, student_id: student, role: "student", status: "active" }));
  course.assessments = bundle().assessments;
  const sync = {
    ...Sync.parse({
      sync_id: "hw",
      service: "sheets",
      role: "both",
      stream: "marks",
      where: { sheet: "1AbC", tab: "Homework" },
      match: ["link", "name"],
      anchors: true,
      map: { columns: { "1Task": "ASSESSMENT-HW1" } },
    }),
  } as any;
  const sheet = new FakeSheets([["Name", "1Task"], ["Nurlanova Aigerim", "T"]]);
  const lines: unknown[] = [];
  const common = {
    bundle: course,
    runId: RUN,
    root,
    sync,
    rosterDirectory: rosterDir,
    linksDirectory: linksDir,
    syncDirectory: syncDir,
    sheetsDirectory: temp(),
    out: (line: unknown) => lines.push(line),
    client: sheet as any,
  };
  const first = await runMarksSync({ ...common, dryRun: false });
  assert.equal(first.plan.placed.length, 1);
  assert.equal(first.wrote.anchors, 3); // the name column, the 1Task column, the row
  const tag = sheet.rowAnchors.get(1)!;
  assert.equal(LinkTable.load(RUN, linksDir).get("hw", `anchor:${tag}`)!.student, "STUDENT-CCCCCC");

  // What the first run wrote is what the course holds now.
  course.submissions = first.plan.submissions;
  course.evaluations = first.plan.evaluations;

  // Someone retypes the name and renames the header. The anchors still say who and what.
  sheet.grid = [["ФИО", "Task 1"], ["A. N.", "LT"]];
  const second = await runMarksSync({ ...common, dryRun: true });
  assert.deepEqual(second.plan.problems, []);
  assert.equal(second.plan.placed[0]!.student, "STUDENT-CCCCCC");
  assert.equal((second.plan.submissions[0] as any).extensions.mark, "LT");
});

test("sync migrate writes the implied syncs into version.yaml and keeps its comments", async () => {
  const root = temp();
  const dir = join(root, "courses", "CSS-1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "version.yaml"),
    `# the one live run\ncourse_version_id: ${RUN}\ncourse_id: CSS-1\nterm: 2026-FALL\nstart_date: 2026-09-01\nend_date: 2026-12-20\nextensions:\n  lms:\n    canvas_course_id: 3312 # Narxoz shell\n`,
  );
  const course = runBundle({ extensions: { lms: { canvas_course_id: 3312 } } });
  const lines: unknown[] = [];
  await runSync(args({ subcommand: "migrate" }), course, root, { out: (line: unknown) => lines.push(line) });
  const text = readFileSync(join(dir, "version.yaml"), "utf-8");
  assert.match(text, /# the one live run/);
  assert.match(text, /# Narxoz shell/);
  assert.match(text, /sync_id: canvas-grades/);
  const parsed = parse(text);
  assert.equal(parsed.syncs.length, 4);
  for (const entry of parsed.syncs) Sync.parse(entry);
});

test("sync link and confirm write the private link table", async () => {
  const linksDir = temp();
  const run = { syncs: [{ sync_id: "hw", service: "sheets", role: "source", stream: "marks", map: { columns: { "1Task": "ASSESSMENT-HW1" } } }] };
  const deps = { out: () => {} };
  await runSync(args({ subcommand: "link", sync: "hw", extra: ["A. Nurlanova=STUDENT-CCCCCC"], linksDir }), runBundle(run), "/nowhere", deps);
  assert.equal(LinkTable.load(RUN, linksDir).get("hw", nameLinkKey("A. Nurlanova"))!.student, "STUDENT-CCCCCC");

  const table = LinkTable.load(RUN, linksDir);
  table.queue("hw", nameLinkKey("Ostanin Artym"), {
    label: "Ostanin Artym",
    line: 7,
    candidates: [{ student: "STUDENT-BBBBBB", match: "close" }],
    why: "a close spelling",
    at: AT,
  });
  table.save();
  await runSync(args({ subcommand: "confirm", sync: "hw", line: 7, linksDir }), runBundle(run), "/nowhere", deps);
  const after = LinkTable.load(RUN, linksDir);
  assert.equal(after.get("hw", nameLinkKey("Ostanin Artym"))!.how, "confirmed");
  assert.equal(after.queued("hw").length, 0);
});
