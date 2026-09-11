/**
 * One run, several Canvas courses: what `lms assignment-push` reaches.
 *
 *     node --experimental-strip-types --test test/assignment-subgroups.test.ts
 *
 * A course taught to CS-401 and CS-402 is usually two Canvas shells rather than
 * one shell with two sections — separate enrolments, separate assignments,
 * separate ids. `lms push` handles that by refusing to run without `--group`,
 * because each cohort's MARKS are different data.
 *
 * The definition is the opposite case and this file is the argument for it: the
 * title, the points and the brief are the same for both halves of one class, so
 * a push that reached one course and not the other is how the two halves end up
 * being told different things. The default is every course the run names.
 *
 * Driven through `runLms` rather than through the planner, because the fan-out
 * lives in the command and the thing worth pinning is the set of HTTP requests
 * that actually leave.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";

const response = (status: number, body: string): Response => ({ status, body, headers: {} });

/** A bundle with only what the assignment path reads. */
const bundleWith = (runExtensions: any, assessmentExtensions: any = {}) => ({
  course: { course_id: "CSS-4008", title: "AI" },
  versions: [
    {
      course_version_id: "CSS-4008-2026-FALL",
      course_id: "CSS-4008",
      term: "2026-FALL",
      extensions: runExtensions,
    },
  ],
  assessments: [
    {
      assessment_id: "ASSESSMENT-02",
      course_version_id: "CSS-4008-2026-FALL",
      title: "Data Preparation Report",
      maximum_score: 100,
      due_at: "2026-10-06T23:59:00+05:00",
      submission_type: ["pdf"],
      extensions: assessmentExtensions,
    },
  ],
  documents: [],
  rubrics: [],
  items: [],
});

const args = (overrides: Record<string, unknown> = {}): any => ({
  subcommand: "assignment-plan",
  run: "CSS-4008-2026-FALL",
  assessment: "ASSESSMENT-02",
  target: "canvas-csv",
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
  connections: null,
  rosterDir: null,
  syncDir: null,
  allowPartial: false,
  withNames: false,
  noComments: false,
  comments: false,
  confirm: false,
  dryRun: false,
  quiet: false,
  json: false,
  overwriteDrift: false,
  summary: false,
  allTabs: false,
  ...overrides,
});

/** Run the command against canned Canvas responses; return the lines and calls. */
const drive = async (
  bundle: any,
  overrides: Record<string, unknown> = {},
  responses = {},
  root = process.cwd(),
) => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const lines: string[] = [];
  const transport = new RecordedTransport(responses);
  await runLms(args(overrides), bundle as any, root, {
    out: (line) => lines.push(line),
    transport,
  });
  return { lines, transport };
};

/**
 * A workspace a created assignment's id can be written back into.
 *
 * A push that creates needs somewhere to record the number Canvas gave it —
 * without one it refuses, which is itself correct and is covered in
 * `assignment-link.test.ts`. These tests are about the request, so they get a
 * real file to land in.
 */
const linkable = (): { root: string; path: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-push-"));
  const dir = join(root, "courses", "CSS-4008", "versions", "2026-FALL");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "assessments.yaml");
  writeFileSync(
    path,
    ["assessments:", "  - assessment_id: ASSESSMENT-02", "    title: Data Preparation Report", ""].join(
      "\n",
    ),
    "utf-8",
  );
  return { root, path };
};

const GET_ONE = {
  "GET /api/v1/courses/3312/assignments/90218": response(
    200,
    '{"id":90218,"name":"Data Preparation Report","points_possible":100,' +
      '"due_at":"2026-10-06T18:59:00Z","submission_types":["online_upload"]}',
  ),
  "GET /api/v1/courses/3313/assignments/90219": response(
    200,
    '{"id":90219,"name":"Data Preparation Report","points_possible":100,' +
      '"due_at":"2026-10-06T18:59:00Z","submission_types":["online_upload"]}',
  ),
};

// --------------------------------------------------------------- one course

test("one Canvas course: one plan, no --group needed", async () => {
  const { lines } = await drive(bundleWith({ lms: { canvas_course_id: 3312 } }));
  assert.equal(lines.filter((line) => line.startsWith("course 3312")).length, 1);
});

test("--group on a run with one Canvas course is refused rather than ignored", async () => {
  await assert.rejects(
    () => drive(bundleWith({ lms: { canvas_course_id: 3312 } }), { group: "CS-401" }),
    /names a split that does not exist/,
  );
});

// ------------------------------------------------------------ many subgroups

test("a course per subgroup fans out to every one of them", async () => {
  const { lines, transport } = await drive(
    bundleWith(
      { lms: { canvas_courses: { "CS-401": 3312, "CS-402": 3313 } } },
      { lms: { canvas_assignments: { "CS-401": 90218, "CS-402": 90219 } } },
    ),
    {},
    GET_ONE,
  );
  assert.equal(lines.filter((line) => line.startsWith("CS-401 · course 3312")).length, 1);
  assert.equal(lines.filter((line) => line.startsWith("CS-402 · course 3313")).length, 1);
  // One read per course, and nothing written by a plan.
  assert.equal(transport.calls.length, 2);
  assert.deepEqual(
    transport.calls.map(([method]) => method),
    ["GET", "GET"],
  );
});

test("--group narrows the fan-out to one subgroup", async () => {
  const { lines, transport } = await drive(
    bundleWith(
      { lms: { canvas_courses: { "CS-401": 3312, "CS-402": 3313 } } },
      { lms: { canvas_assignments: { "CS-401": 90218, "CS-402": 90219 } } },
    ),
    { group: "CS-402" },
    GET_ONE,
  );
  assert.equal(lines.some((line) => line.startsWith("CS-402 · course 3313")), true);
  assert.equal(lines.some((line) => line.startsWith("CS-401")), false);
  assert.equal(transport.calls.length, 1);
});

test("a subgroup with no Canvas course is named, not skipped", async () => {
  await assert.rejects(
    () =>
      drive(bundleWith({ lms: { canvas_courses: { "CS-401": 3312 } } }), { group: "CS-409" }),
    /no Canvas course for CS-409/,
  );
});

test("a subgroup linked to no assignment yet is a create, beside one that exists", async () => {
  // The half-configured case: CS-401 was pushed last term, CS-402 is new.
  const { lines, transport } = await drive(
    bundleWith(
      { lms: { canvas_courses: { "CS-401": 3312, "CS-402": 3313 } } },
      { lms: { canvas_assignments: { "CS-401": 90218 } } },
    ),
    {},
    GET_ONE,
  );
  assert.equal(lines.some((line) => line.includes("would CREATE a new assignment")), true);
  assert.equal(lines.some((line) => line.startsWith("CS-401 · course 3312 — assignment 90218")), true);
  // Only the linked one is read; there is nothing to read for the other.
  assert.equal(transport.calls.length, 1);
});

// --------------------------------------------------------------------- gates

test("a push without --confirm is refused", async () => {
  await assert.rejects(
    () =>
      drive(bundleWith({ lms: { canvas_course_id: 3312 } }), { subcommand: "assignment-push" }),
    /Re-run with --confirm/,
  );
});

test("no Canvas course anywhere is a sentence, not a crash", async () => {
  await assert.rejects(
    () => drive(bundleWith({})),
    /no Canvas course recorded/,
  );
});

test("an assessment that is not in the run is refused by name", async () => {
  await assert.rejects(
    () => drive(bundleWith({ lms: { canvas_course_id: 3312 } }), { assessment: "ASSESSMENT-99" }),
    /ASSESSMENT-99 is not an assessment of/,
  );
});

test("a linked assignment Canvas cannot return stops the push", async () => {
  // Creating a second assignment because the first could not be read would
  // leave the class with two of the same thing.
  await assert.rejects(
    () =>
      drive(
        bundleWith(
          { lms: { canvas_course_id: 3312 } },
          { lms: { canvas_assignment_id: 90218 } },
        ),
        {},
        { "GET /api/v1/courses/3312/assignments/90218": response(404, '{"errors":[]}') },
      ),
    /which could not be read/,
  );
});

// ------------------------------------------------------------- the wire

test("a list reaches Canvas as a repeated key, not as an indexed one", async () => {
  // `assignment[submission_types][]` said once per entry. Rails reads a
  // repeated key as a list and `assignment[submission_types][0]` as a mapping
  // keyed "0", which Canvas rejects as an unknown submission type — and the
  // symptom is an assignment nobody can hand anything in to.
  const { transport } = await drive(
    bundleWith({ lms: { canvas_course_id: 3312 } }),
    { subcommand: "assignment-push", confirm: true },
    { "POST /api/v1/courses/3312/assignments": response(200, '{"id":90400}') },
    linkable().root,
  );
  const [method, , body] = transport.calls.at(-1)!;
  assert.equal(method, "POST");
  assert.match(body!, /assignment%5Bsubmission_types%5D%5B%5D=online_upload/);
  assert.equal(body!.includes("submission_types%5B0%5D"), false);
});

test("a created assignment's id is reported back", async () => {
  const { root, path } = linkable();
  const { lines } = await drive(
    bundleWith({ lms: { canvas_course_id: 3312 } }),
    { subcommand: "assignment-push", confirm: true },
    { "POST /api/v1/courses/3312/assignments": response(200, '{"id":90400}') },
    root,
  );
  assert.equal(
    lines.some((line) => line.includes("created assignment 90400")),
    true,
  );
  // And written down, so the next push updates rather than creating a second.
  assert.match(readFileSync(path, "utf-8"), /canvas_assignment_id: 90400/);
});

test("creating one subgroup's assignment does not unbind the other", async () => {
  // The writer replaces the mapping wholesale — that is what lets a pairing be
  // removed — so a push that creates CS-402 has to send CS-401 back with it.
  // Getting this wrong silently unbinds a subgroup that was working.
  const { root, path } = linkable();
  await drive(
    bundleWith(
      { lms: { canvas_courses: { "CS-401": 3312, "CS-402": 3313 } } },
      { lms: { canvas_assignments: { "CS-401": 90218 } } },
    ),
    { subcommand: "assignment-push", confirm: true },
    Object.assign({}, GET_ONE, {
      "POST /api/v1/courses/3313/assignments": response(200, '{"id":90500}'),
      "PUT /api/v1/courses/3312/assignments/90218": response(200, '{"id":90218}'),
    }),
    root,
  );
  const written = readFileSync(path, "utf-8");
  assert.match(written, /CS-401: 90218/);
  assert.match(written, /CS-402: 90500/);
});
