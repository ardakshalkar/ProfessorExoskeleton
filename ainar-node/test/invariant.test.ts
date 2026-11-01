/**
 * GRD-3: the line that does not move, tested where an agent could cross it.
 *
 * An evaluation is decided only when the professor's decision is written
 * beside the suggestion and its `status` becomes `approved` or `overridden`
 * (src/approval.ts). A grade reaches Canvas only on the professor's own press:
 * in the pane, or `--confirm` typed at the CLI. These tests take each road an
 * agent has into this package and check that it can do neither — one test per
 * road, named for it, so a guard taken out fails the test that names it.
 *
 * The pane's roads (its job kinds and its routes) are pinned in
 * plugins/dsh-professor-pane/test/invariant.test.mjs.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { assessmentsOf, runById } from "../src/bundle.ts";
import { checkDefenceGrade, defenceEvaluations } from "../src/defence.ts";
import { gradeRows } from "../src/gradebook.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { Directory } from "../src/lms/base.ts";
import { type LmsArgs, runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import { createAinarMcpServer } from "../src/mcp/server.ts";
import { RosterStore } from "../src/roster.ts";
import { TOOLS, WITHHELD, callTool } from "../src/tools/index.ts";
import { validate } from "../src/validate.ts";
import { Workspace } from "../src/workspace.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const ROOT = resolve(PACKAGE, "..", "workspace");
const RUN = "CSS-4008-2026-FALL";

const scratch = (): string => mkdtempSync(join(tmpdir(), "ainar-grd3-"));

const sampleBundle = (): any => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle!;
};

/** Every file under `dir` and its hash, so a write anywhere shows. */
const snapshot = (dir: string): Map<string, string> => {
  const files = new Map<string, string>();
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(dir, path), createHash("sha256").update(readFileSync(path)).digest("hex"));
    }
  };
  walk(dir);
  return files;
};

// --------------------------------------------------------------------------
// The MCP tools: src/tools/index.ts, served by src/mcp/server.ts
// --------------------------------------------------------------------------

/**
 * Pinned by name, not by pattern: a seventeenth tool is a change to the line,
 * and whoever adds one should have to come here and say why it is safe.
 */
const READERS = [
  "list_courses",
  "course_context",
  "course_outline",
  "validate_course",
  "assessment_rubric",
  "pending_judgements",
  "gradebook",
  "assessment_blueprint",
  "student",
  "class_progress",
  "action_inbox",
  "calibration",
  "syllabus",
  "alignment_report",
  "model_schema",
  "course_stats",
];

test("MCP tools: the list is the sixteen readers, and approve and lms push are withheld", () => {
  assert.deepEqual(TOOLS.map((tool) => tool.name), READERS);
  assert.ok(WITHHELD.approve, "approve is recorded as withheld, with its reason");
  assert.ok(WITHHELD["lms push"], "lms push is recorded as withheld, with its reason");
  for (const name of ["approve", "lms push", "lms_push", "decide", "grade_decide"]) {
    const result = callTool(new Workspace(ROOT), name, { course_version_id: RUN });
    assert.equal(result.isError, true, `${name} answered as a tool`);
    assert.match(result.content[0]!.text, /read-only/);
  }
});

test("MCP tools: every tool, called with every argument it takes, leaves the workspace as it was", () => {
  const root = scratch();
  cpSync(ROOT, root, { recursive: true });
  const bundle = sampleBundle();
  const args = {
    course_version_id: RUN,
    course_id: "CSS-4008",
    assessment_id: assessmentsOf(bundle, RUN)[0]!.assessment_id,
    student_id: (bundle.enrollments as any[]).find((entry) => entry.course_version_id === RUN)?.student_id,
    entity: "Evaluation",
  };
  const before = snapshot(root);
  for (const tool of TOOLS) {
    try {
      callTool(new Workspace(root), tool.name, args);
    } catch {
      // A tool that throws on these arguments is still a tool that must not write.
    }
  }
  assert.deepEqual(snapshot(root), before, "a tool changed the workspace");
});

test("MCP server: lists exactly the readers, and a call to approve is refused", async () => {
  const server = createAinarMcpServer(new Workspace(ROOT));
  const client = new Client({ name: "grd3", version: "0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), READERS, "the server adds no tool of its own without a shared backend");
    const refused = (await client.callTool({ name: "approve", arguments: { course_version_id: RUN } })) as any;
    assert.equal(refused.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

// --------------------------------------------------------------------------
// The record writers: src/records-write.ts and the commands that call it
// --------------------------------------------------------------------------

/**
 * `writeRecords` writes what it is handed; it has no opinion on status. What
 * keeps a decision out of an agent's write is that the callers handing it
 * evaluations are few, and each is the professor's (or keeps the agent's to
 * `suggested`). This pins the callers. A new one fails here until someone
 * reads it and adds it, with the reason.
 *
 *   bin/ainar.ts             grade decide        the professor's marks (the pane's press spawns it)
 *                            defence mark        the professor's word on a defence, typed for them
 *                            defence grade       the model's proposal, written `suggested` (next test)
 *   src/sync/sheet-marks.ts  sync run           the professor's own grade sheet, read back
 */
const EVALUATION_WRITERS: Record<string, number> = { "bin/ainar.ts": 3, "src/sync/sheet-marks.ts": 1 };

test("record writers: only the known commands hand evaluations to writeRecords", () => {
  const found: Record<string, number> = {};
  const files = [
    join(PACKAGE, "bin", "ainar.ts"),
    ...(readdirSync(join(PACKAGE, "src"), { recursive: true }) as string[])
      .filter((name) => name.endsWith(".ts"))
      .map((name) => join(PACKAGE, "src", name)),
  ];
  for (const path of files) {
    const lines = readFileSync(path, "utf-8").split(/\r?\n/);
    lines.forEach((line, at) => {
      if (!/\bwriteRecords\(/.test(line) || /^\s*(\*|\/\/)/.test(line) || /export const writeRecords/.test(line)) return;
      // The call's first line, and the next when the object opens on this one.
      const call = line.trimEnd().endsWith("{") ? line + lines[at + 1] : line;
      if (!/\bevaluations\b/.test(call)) return;
      const name = relative(PACKAGE, path).replace(/\\/g, "/");
      found[name] = (found[name] ?? 0) + 1;
    });
  }
  assert.deepEqual(found, EVALUATION_WRITERS);
});

test("defence grade --from: the model's JSON is written suggested, never as a decision", () => {
  const criteria = [
    { criterion_id: "CRIT-A", maximum_score: 4 },
    { criterion_id: "CRIT-B", maximum_score: 4 },
  ] as any[];
  // What a model trying to decide would send: a status, a decision, decided_by.
  const reply = {
    status: "approved",
    professor_decision: { score: 4, decided_by: "USER-PROF", decided_at: "2026-11-01T10:00:00+05:00" },
    criteria: [
      {
        criterion_id: "CRIT-A",
        score: 3,
        comment: "clear",
        status: "approved",
        professor_decision: { score: 4, decided_by: "USER-PROF", decided_at: "2026-11-01T10:00:00+05:00" },
      },
      { criterion_id: "CRIT-B", score: 2, status: "overridden" },
    ],
  };
  const { proposed } = checkDefenceGrade(reply, { criteria, session: null, files: [], sourceRef: (audio) => audio });
  const existing = [
    // CRIT-B already decided by the professor: the proposal must leave it alone.
    {
      evaluation_id: "EVAL-X",
      submission_id: "SUB-1",
      criterion_id: "CRIT-B",
      status: "approved",
      professor_decision: { score: 1, decided_by: "USER-PROF", decided_at: "2026-10-01T10:00:00+05:00" },
    },
  ];
  const { evaluations, decided } = defenceEvaluations({
    proposed,
    submission_id: "SUB-1",
    student_id: "STUDENT-ABC123",
    existing,
    provenance: { produced_by: "defend-submission-skill", model_id: null, created_at: "2026-11-01T10:00:00+05:00", input_refs: [] },
  });
  assert.deepEqual(decided, ["CRIT-B"], "a decided criterion is not overwritten");
  assert.equal(evaluations.length, 1);
  for (const evaluation of evaluations) {
    assert.equal(evaluation.status, "suggested");
    assert.equal("professor_decision" in evaluation, false, "no decision travels from the model's reply");
  }
});

test("validate: a decided evaluation that does not say who decided and when is refused", () => {
  const codes = (decision: unknown): string[] => {
    const bundle = sampleBundle();
    const evaluation = (bundle.evaluations as any[]).find((entry) => entry.status === "suggested") ?? bundle.evaluations[0];
    assert.ok(evaluation, "the sample course has an evaluation");
    evaluation.status = "approved";
    if (decision === undefined) delete evaluation.professor_decision;
    else evaluation.professor_decision = decision;
    return validate(bundle, { root: ROOT }).items.filter((issue) => issue.level === "error").map((issue) => issue.code);
  };
  assert.ok(codes(undefined).includes("evaluation.unapproved"), "approved with no decision");
  assert.ok(codes({ score: 1 }).includes("evaluation.unstamped"), "a decision with no decided_by or decided_at");
  assert.ok(codes({ score: 1, decided_by: "USER-PROF" }).includes("evaluation.unstamped"), "no decided_at");
});

// --------------------------------------------------------------------------
// ainar lms push: src/lms/command.ts
// --------------------------------------------------------------------------

const PEOPLE = {
  "STUDENT-JNG7SN": { institutional_id: "20231023", name: "Aigerim T.", email: "a.t@example.edu" },
  "STUDENT-K4QM2X": { institutional_id: "20231024", name: "Bekzat K.", email: "b.k@example.edu" },
  "STUDENT-R7TB5D": { institutional_id: "20231025", name: "Dana S.", email: "d.s@example.edu" },
} as any;
const CANVAS_USER: Record<string, number> = { "STUDENT-JNG7SN": 5001, "STUDENT-K4QM2X": 5002, "STUDENT-R7TB5D": 5003 };
const response = (status: number, body: unknown): Response => ({ status, body: JSON.stringify(body), headers: {} });

/** `lms push --target canvas-api` on the sample course, against a Canvas that records what it is sent. */
const pushToCanvas = async (confirm: boolean): Promise<RecordedTransport> => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const bundle = sampleBundle();
  runById(bundle).get(RUN)!.extensions = { lms: { canvas_course_id: "1" } };
  const assessment = (assessmentsOf(bundle, RUN) as any[]).find((entry) =>
    (gradeRows(bundle, RUN, { assessmentId: entry.assessment_id }).get(entry.assessment_id) ?? []).some(
      (row) => row.score !== null && CANVAS_USER[row.student_id],
    ),
  )!;
  for (const entry of assessmentsOf(bundle, RUN) as any[]) if (entry.extensions?.lms) delete entry.extensions.lms.canvas_assignment_id;
  assessment.extensions = { ...(assessment.extensions ?? {}), lms: { canvas_assignment_id: "2" } };
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
  const args = {
    subcommand: "push",
    run: RUN,
    assessment: assessment.assessment_id,
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
    syncDir: scratch(),
    allowPartial: true,
    withNames: false,
    noComments: true,
    comments: false,
    confirm,
    dryRun: false,
    quiet: false,
    json: false,
    overwriteDrift: false,
    summary: false,
    allTabs: false,
  } as LmsArgs;
  await runLms(args, bundle, ROOT, {
    out: () => {},
    transport,
    directory: new Directory(new RosterStore(scratch(), PEOPLE), Buffer.from("a-fixed-salt", "utf-8")),
    sleep: async () => {},
  });
  return transport;
};

test("lms push --target canvas-api: without --confirm nothing is posted", async () => {
  const unconfirmed = await pushToCanvas(false);
  assert.equal(unconfirmed.bodies("POST").length, 0, "a grade was posted without --confirm");
  // The same push confirmed does post, so the silence above is the guard's and
  // not a Canvas this fixture never reaches.
  const confirmed = await pushToCanvas(true);
  assert.equal(confirmed.bodies("POST").length, 1);
});

// --------------------------------------------------------------------------
// What these tests cannot hold
// --------------------------------------------------------------------------

/**
 * HOLE, not fixed here (GRD-3 says test, not redesign). The CLI is a
 * professor's surface, and an agent's shell can run it: nothing in the
 * process tells a terminal the professor typed into from a command the
 * session's model ran. These write a decision or send a grade with no check
 * but the words in the skills (`ainar-records`, `publish`: "never"):
 *
 *   ainar grade decide RUN --assessment A --decisions '[…]'   writes professor_decision
 *   ainar defence mark RUN … --criterion C --outcome …        writes professor_decision
 *   ainar lms push RUN --target canvas-api --confirm          posts grades to Canvas
 *   ainar sync run RUN SYNC --confirm                         the same, through a sync
 *
 * And below the CLI, an agent with file access can write `status: approved`
 * with a decided_by and decided_at of its own into records/evaluations.yaml;
 * the validator checks the stamp is there, not who wrote it. What catches that
 * today is the diff. The test to write, once there is something to pin: a
 * decision-writing command run without the professor's mark on it is refused.
 */
test.todo("CLI: grade decide, defence mark --criterion, lms push --confirm and sync run --confirm refuse when run from an agent's shell");
