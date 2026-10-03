/**
 * An assignment already in Canvas: `lms assignments` finds it, `lms link`
 * records it.
 *
 *     node --experimental-strip-types --test test/assignment-link-existing.test.ts
 *
 * The case a professor meets when Quiz 1 was made by hand in Canvas before the
 * course model knew about it. Creating it again would give the class two Quiz 1
 * columns, so the list suggests and the professor confirms; the link writes the
 * id into the course and touches nothing in Canvas.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";

const response = (status: number, body: unknown): Response => ({ status, body: JSON.stringify(body), headers: {} });

const bundle = (assessmentExtensions: any = {}) => ({
  course: { course_id: "CSS-4007", title: "AI" },
  versions: [
    {
      course_version_id: "CSS-4007-2026-FALL",
      course_id: "CSS-4007",
      term: "2026-FALL",
      extensions: { lms: { canvas_courses: { "ENG-8": 7434, "ENG-9": 8870 } } },
    },
  ],
  assessments: [
    {
      assessment_id: "ASSESSMENT-QUIZ-01",
      course_version_id: "CSS-4007-2026-FALL",
      title: "Quiz 1 - on Weeks 1-3",
      maximum_score: 10,
      extensions: assessmentExtensions,
    },
  ],
  documents: [],
  rubrics: [],
  items: [],
});

const args = (overrides: Record<string, unknown>): any => ({
  subcommand: "assignments",
  run: "CSS-4007-2026-FALL",
  assessment: "ASSESSMENT-QUIZ-01",
  target: "canvas-csv",
  by: "sis-id",
  source: null, column: null, out: null, tab: null, sheet: null,
  canvasUrl: "https://canvas.example.edu",
  canvasCourse: null, canvasAssignment: null, group: null,
  connection: null, connections: null, rosterDir: null, syncDir: null,
  allowPartial: false, withNames: false, noComments: false, comments: false,
  confirm: false, dryRun: false, quiet: false, json: false, overwriteDrift: false,
  summary: false, allTabs: false,
  ...overrides,
});

const drive = async (b: any, overrides: Record<string, unknown>, responses: Record<string, Response>, root = process.cwd()) => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const lines: string[] = [];
  const transport = new RecordedTransport(responses);
  await runLms(args(overrides), b, root, { out: (line) => lines.push(line), transport });
  return { lines, transport };
};

const LISTS = {
  "GET /api/v1/courses/7434/assignments": response(200, [
    { id: 501, name: "Quiz #1", points_possible: 10, due_at: "2026-09-21T04:00:00Z" },
    { id: 502, name: "Quiz 2", points_possible: 10 },
    { id: 503, name: "HW1", points_possible: 100 },
  ]),
  "GET /api/v1/courses/8870/assignments": response(200, [{ id: 601, name: "Lab 3", points_possible: 20 }]),
};

test("the list suggests the assignment that is the same quiz, and says why", async () => {
  const { lines, transport } = await drive(bundle(), {}, LISTS);
  assert.ok(lines.some((line) => line.includes('likely 501 "Quiz #1" — both are quiz 1, 10 points on both')), lines.join("\n"));
  assert.ok(lines.some((line) => line.includes("nothing here looks like it")), "ENG-9 has no quiz 1");
  assert.deepEqual(transport.calls.map(([method]) => method), ["GET", "GET"], "only reads");
});

test("an assignment already linked to another assessment is not suggested", async () => {
  const b = bundle();
  b.assessments.push({
    assessment_id: "ASSESSMENT-QUIZ-99",
    course_version_id: "CSS-4007-2026-FALL",
    title: "Quiz 1 retake",
    maximum_score: 10,
    extensions: { lms: { canvas_assignments: { "ENG-8": 501 } } },
  });
  const { lines } = await drive(b, { group: "ENG-8" }, LISTS);
  assert.ok(lines.some((line) => line.includes("← ASSESSMENT-QUIZ-99")));
  assert.ok(!lines.some((line) => line.includes("likely 501")));
});

test("link reads the assignment, writes its id for that subgroup, and keeps the others", async () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-link-"));
  mkdirSync(join(root, "courses", "CSS-4007"), { recursive: true });
  const path = join(root, "courses", "CSS-4007", "assessments.yaml");
  writeFileSync(
    path,
    [
      "assessments:",
      "  - assessment_id: ASSESSMENT-QUIZ-01",
      "    title: Quiz 1 - on Weeks 1-3",
      "    extensions:",
      "      lms:",
      "        canvas_assignments:",
      "          ENG-9: 601",
      "",
    ].join("\n"),
  );
  const { lines, transport } = await drive(
    bundle({ lms: { canvas_assignments: { "ENG-9": 601 } } }),
    { subcommand: "link", group: "ENG-8", canvasAssignment: "501" },
    { "GET /api/v1/courses/7434/assignments/501": response(200, { id: 501, name: "Quiz #1", points_possible: 10 }) },
    root,
  );
  const written = readFileSync(path, "utf-8");
  assert.match(written, /ENG-8: 501/);
  assert.match(written, /ENG-9: 601/, "the other subgroup stays linked");
  assert.deepEqual(transport.calls.map(([method]) => method), ["GET"], "nothing is written to Canvas");
  assert.ok(lines.some((line) => line.includes('assignment 501 "Quiz #1"')));
});

test("link refuses an id Canvas cannot return, and writes nothing", async () => {
  await assert.rejects(
    () =>
      drive(bundle(), { subcommand: "link", group: "ENG-8", canvasAssignment: "999" }, {
        "GET /api/v1/courses/7434/assignments/999": response(404, { errors: [] }),
      }),
    /has no assignment 999/,
  );
});

test("link on a run of several courses needs --group", async () => {
  await assert.rejects(() => drive(bundle(), { subcommand: "link", canvasAssignment: "501" }, {}), /name one with --group/);
});
