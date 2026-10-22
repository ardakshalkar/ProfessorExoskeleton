import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { assessmentsOf, runById } from "../src/bundle.ts";
import { gradeRows } from "../src/gradebook.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { Directory } from "../src/lms/base.ts";
import { type LmsArgs, runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import { Ledger } from "../src/lms/ledger.ts";
import { RosterStore } from "../src/roster.ts";

/**
 * `lms check`: what Canvas holds, asked of Canvas rather than of the ledger.
 * Canvas wins where it agrees â€” a mark it holds at the decided value is noted
 * as applied â€” and a value changed in Canvas is reported, never adopted.
 * Nothing is posted.
 */

const ROOT = resolve(process.cwd(), "..", "workspace");
const RUN = "CSS-4008-2026-FALL";

const PEOPLE = {
  "STUDENT-JNG7SN": { institutional_id: "20231023", name: "Aigerim T.", email: "a.t@example.edu" },
  "STUDENT-K4QM2X": { institutional_id: "20231024", name: "Bekzat K.", email: "b.k@example.edu" },
  "STUDENT-R7TB5D": { institutional_id: "20231025", name: "Dana S.", email: "d.s@example.edu" },
} as any;
const CANVAS_USER: Record<string, number> = { "STUDENT-JNG7SN": 5001, "STUDENT-K4QM2X": 5002, "STUDENT-R7TB5D": 5003 };

const scratch = () => mkdtempSync(join(tmpdir(), "ainar-check-"));
const response = (status: number, body: unknown): Response => ({ status, body: JSON.stringify(body), headers: {} });

/** The fixture course, with one assessment linked to Canvas course 1, assignment 2. */
const linkedBundle = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  const bundle = loadCourse(dir, ROOT).bundle! as any;
  const run = runById(bundle).get(RUN);
  run.extensions = { ...(run.extensions ?? {}), lms: { canvas_course_id: "1" } };
  const assessments = assessmentsOf(bundle, RUN);
  const marked = assessments.find((entry: any) =>
    (gradeRows(bundle, RUN, { assessmentId: entry.assessment_id }).get(entry.assessment_id) ?? []).some(
      (row) => row.score !== null && CANVAS_USER[row.student_id],
    ),
  )!;
  for (const entry of assessments as any[]) {
    if (entry.extensions?.lms) delete entry.extensions.lms.canvas_assignment_id;
  }
  marked.extensions = { ...(marked.extensions ?? {}), lms: { canvas_assignment_id: "2" } };
  const rows = (gradeRows(bundle, RUN, { assessmentId: marked.assessment_id }).get(marked.assessment_id) ?? []).filter(
    (row) => row.score !== null && CANVAS_USER[row.student_id],
  );
  return { bundle, assessment: marked, rows };
};

const args = (syncDir: string, assessment: string): LmsArgs =>
  ({
    subcommand: "check",
    run: RUN,
    assessment,
    target: "canvas-api",
    by: "sis-id",
    source: null,
    column: null,
    out: null,
    tab: null,
    sheet: null,
    canvasUrl: "https://canvas.example.edu",
    canvasCourse: null,
    canvasAssignment: null,
    group: null,
    connection: null,
    connections: join(scratch(), "none.json"),
    rosterDir: scratch(),
    syncDir,
    // The fixture's one mark is partial; the existing lms tests read it the same way.
    allowPartial: true,
    withNames: false,
    noComments: true,
    comments: false,
    confirm: false,
    dryRun: false,
    quiet: false,
    json: true,
    overwriteDrift: false,
    summary: false,
    allTabs: false,
  }) as LmsArgs;

/** Run `lms check` against a Canvas that holds `held` for the one marked student. */
const check = async (held: (score: number) => number, sent?: (score: number) => number, whole = false) => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const { bundle, assessment, rows } = linkedBundle();
  assert.ok(rows.length >= 1, "the fixture has a marked student");
  const row = rows[0]!;
  const transport = new RecordedTransport({
    "GET /api/v1/courses/1/assignments/2": response(200, {
      id: 2,
      name: assessment.title,
      points_possible: Number(assessment.maximum_score),
      published: true,
    }),
    "GET /api/v1/courses/1/users": response(
      200,
      Object.entries(PEOPLE).map(([id, person]: [string, any]) => ({ id: CANVAS_USER[id], sis_user_id: person.institutional_id })),
    ),
    "GET /api/v1/courses/1/assignments/2/submissions": response(200, [
      { user_id: CANVAS_USER[row.student_id], score: held(row.score!), workflow_state: "graded" },
    ]),
  });
  const syncDir = scratch();
  // What this machine last saw Canvas hold: the baseline of the comparison.
  if (sent) {
    const ledger = Ledger.load(RUN, syncDir);
    ledger.record("canvas-api", assessment.assessment_id, [{ student_id: row.student_id, score: sent(row.score!), maximum: null }], {
      at: "2026-10-01T10:00:00+05:00",
      state: "applied",
    });
    ledger.save();
  }
  const lines: string[] = [];
  await runLms({ ...args(syncDir, assessment.assessment_id), assessment: whole ? null : assessment.assessment_id }, bundle, ROOT, {
    out: (line) => lines.push(line),
    transport,
    directory: new Directory(new RosterStore(scratch(), PEOPLE), Buffer.from("a-fixed-salt", "utf-8")),
  });
  const answer = JSON.parse(lines.join("\n"));
  const cell = answer.assessments.find((entry: any) => entry.assessment_id === assessment.assessment_id).groups[0];
  const noted = Ledger.load(RUN, syncDir).prepared("canvas-api", assessment.assessment_id);
  return { cell, noted, row, transport, answer };
};

test("lms check says which side moved: Canvas alone is a pull, both is a conflict, ours alone a push", async () => {
  const mine = (cell: any, student: string) => cell.differences.find((entry: any) => entry.student_id === student);

  const pulled = await check((score) => score - 5, (score) => score);
  assert.equal(pulled.cell.ok, true, pulled.cell.error);
  assert.deepEqual(
    [mine(pulled.cell, pulled.row.student_id).direction, mine(pulled.cell, pulled.row.student_id).changed],
    ["pull", "canvas"],
  );

  const both = await check((score) => score - 5, (score) => score - 1);
  assert.equal(mine(both.cell, both.row.student_id).direction, "conflict");

  // The whole run, which is when the class list is compared too.
  const pushed = await check((score) => score - 1, (score) => score - 1, true);
  assert.equal(mine(pushed.cell, pushed.row.student_id).direction, "push");
  assert.equal(pushed.answer.tally.grades.push >= 1, true);
  assert.equal(pushed.answer.roster.ok, true, pushed.answer.roster.error);
  assert.equal(
    pushed.answer.differences.some((entry: any) => entry.kind === "roster" && entry.student_id === pushed.row.student_id),
    false,
    "a student Canvas enrols and this run has is no class-list difference",
  );
  assert.deepEqual(pushed.answer.differences, pushed.answer.assessments.flatMap((entry: any) => entry.groups.flatMap((g: any) => g.differences)));

  const same = await check((score) => score, (score) => score);
  assert.equal(mine(same.cell, same.row.student_id), undefined, "agreeing is no difference");
  for (const run of [pulled, both, pushed, same]) assert.equal(run.transport.bodies("POST").length, 0, "nothing is posted");
});

test("lms push --student sends exactly the named rows — what Sync all previewed, and nobody else", async () => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const push = async (students: string[]) => {
    const { bundle, assessment, rows } = linkedBundle();
    const transport = new RecordedTransport({
      "GET /api/v1/courses/1/assignments/2": response(200, { id: 2, name: assessment.title, points_possible: Number(assessment.maximum_score), published: true }),
      "GET /api/v1/courses/1/users": response(
        200,
        Object.entries(PEOPLE).map(([id, person]: [string, any]) => ({ id: CANVAS_USER[id], sis_user_id: person.institutional_id })),
      ),
      "GET /api/v1/courses/1/assignments/2/submissions": response(200, []),
      "POST /api/v1/courses/1/assignments/2/submissions/update_grades": response(200, { id: "77", workflow_state: "queued" }),
      "GET /api/v1/progress/77": response(200, { id: "77", workflow_state: "completed" }),
    });
    await runLms({ ...args(scratch(), assessment.assessment_id), subcommand: "push", confirm: true, json: false, students }, bundle, ROOT, {
      out: () => {},
      transport,
      directory: new Directory(new RosterStore(scratch(), PEOPLE), Buffer.from("a-fixed-salt", "utf-8")),
      sleep: async () => {},
    });
    return { transport, row: rows[0]! };
  };
  const nobody = await push(["STUDENT-NOBODY"]);
  assert.equal(nobody.transport.bodies("POST").length, 0, "a student not in the plan sends nothing");
  const one = await push([linkedBundle().rows[0]!.student_id]);
  const bodies = one.transport.bodies("POST");
  assert.equal(bodies.length, 1);
  assert.match(bodies[0]!, new RegExp(`grade_data%5B${CANVAS_USER[one.row.student_id]}%5D`));
  for (const [student, user] of Object.entries(CANVAS_USER)) {
    if (student !== one.row.student_id) assert.equal(bodies[0]!.includes(`grade_data%5B${user}%5D`), false, `${student} was not named`);
  }
});

test("lms check notes a mark Canvas already holds at the decided value", async () => {
  const { cell, noted, row, transport } = await check((score) => score);
  assert.equal(cell.ok, true, cell.error);
  assert.equal(cell.recorded, 1);
  assert.deepEqual(cell.edited, []);
  assert.equal(noted[row.student_id], row.score, "noted at Canvas's value");
  assert.equal(transport.bodies("POST").length, 0, "nothing is posted");
});

test("lms check reports a value changed in Canvas and never adopts it", async () => {
  const { cell, noted, row, transport } = await check((score) => score - 5);
  assert.equal(cell.ok, true, cell.error);
  assert.equal(cell.recorded, 0);
  assert.deepEqual(cell.edited, [{ student_id: row.student_id, in_canvas: row.score! - 5, here: row.score }]);
  assert.equal(noted[row.student_id], undefined, "an edit in Canvas is never noted as ours");
  assert.equal(transport.bodies("POST").length, 0, "nothing is posted");
});
