// GRD-3, the pane's half: no road the assistant has into the pane can decide a
// grade or send one. A grade is decided by `ainar grade decide` (or `defence
// mark`), which the pane spawns only from the professor's press; it reaches
// Canvas only by `lms push --confirm`, which the pane spawns only when the
// press said `confirm: true`. Each test is named for the road it holds, so a
// guard taken out fails the test that names it. The CLI's own roads are in
// ainar-node/test/invariant.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.AINAR_JOBS_DIR = mkdtempSync(join(tmpdir(), "pane-grd3-jobs-"));

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "..", "server");
process.env.AINAR_WORKSPACE = resolve(HERE, "..", "..", "..", "workspace");

const { KINDS, SEND_KINDS, startKind } = await import("../server/job-kinds.js");
const { EDITABLE, writeRecordFields } = await import("../server/record-fields.js");
const { handle } = await import("../server/router.js");
const { stepArgs, STEPS } = await import("../../dsh-professor-scan-steps/index.js");

const c = { root: "/nowhere", runId: "RUN-K", workspace: null };
const RUN = "CSS-4008-2026-FALL";

/** Every file under server/, with its text. */
const serverFiles = () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".js")) files.push({ name: path.slice(SERVER.length + 1).replace(/\\/g, "/"), text: readFileSync(path, "utf-8") });
    }
  };
  walk(SERVER);
  return files;
};

/** One request through the route table, answered into a plain object. */
const ask = (method, path) =>
  new Promise((done) => {
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end(body) {
        done({ status: this.status, body: JSON.parse(String(body)) });
      },
    };
    handle({ method, url: `/professor-pane${path}`, headers: {} }, res, { registry: { list: () => [] } });
  });

// --------------------------------------------------------------------------
// The job kinds: server/job-kinds.js
// --------------------------------------------------------------------------

test("job kinds: a grade decision or a Canvas push is never a kind, and asking for one is refused", async () => {
  for (const kind of ["canvas-push", "grades-send"]) {
    assert.ok(SEND_KINDS.includes(kind), `${kind} is a send kind`);
    assert.match((await startKind(c, kind, { assessmentId: "Q1" })).error, /reaches students/);
  }
  for (const kind of ["grade-decide", "grade", "lms-push", "lms", "sync-run", "send-reports", "defence-mark"]) {
    assert.equal(Object.hasOwn(KINDS, kind), false, `${kind} must not be a kind`);
    assert.match((await startKind(c, kind, { assessmentId: "Q1" })).error, /No such kind of work/, kind);
  }
});

test("job kinds: every kind runs `scans` or `defence batch`, never `grade`, `lms`, `sync` or `publish`", () => {
  const text = readFileSync(join(SERVER, "job-kinds.js"), "utf-8");
  const commands = [...text.matchAll(/(?:runScans\(\s*|const args = )\[\s*"([a-z-]+)"(?:,\s*"([a-z-]+)")?/g)].map((match) => match.slice(1).filter(Boolean).join(" "));
  assert.ok(commands.length >= 4, "the kinds' command lines were found");
  for (const command of commands) assert.match(command, /^(scans|defence batch)\b/, `a kind runs ${command}`);
  // `placing` builds its args with a ternary; it is scans either way.
  assert.match(text, /const args = \["scans", kind === "scans-assign" \? "assign" : "apply"/);
});

// --------------------------------------------------------------------------
// The assistant's tool into the harness: plugins/dsh-professor-scan-steps
// --------------------------------------------------------------------------

test("scan_pile: runs a scans step and nothing else", () => {
  assert.deepEqual(STEPS, ["status", "file", "plan", "names", "apply"]);
  for (const step of ["decide", "push", "assign", "read", "record", "grade"]) {
    assert.ok(stepArgs({ step, run: RUN, assessment: "ASSESSMENT-01" }) instanceof Error, step);
  }
  for (const step of STEPS) {
    const args = stepArgs({ step, run: RUN, assessment: "ASSESSMENT-01", file: "scan-1.pdf" });
    assert.deepEqual(args.slice(0, 2), ["scans", step]);
  }
});

// --------------------------------------------------------------------------
// The routes: server/routes/
// --------------------------------------------------------------------------

test("/api/record: no evaluation is editable, and no approval, status or decision field on anything", () => {
  for (const [kind, spec] of Object.entries(EDITABLE)) {
    assert.notEqual(spec.collection, "evaluations", `${kind} edits evaluations`);
    for (const field of ["approval", "status", "professor_decision", "decided_by", "decided_at", "score"]) {
      assert.equal(Object.hasOwn(spec.fields, field), false, `${kind}.${field} is editable from the page`);
    }
  }
  const asked = writeRecordFields(null, "/nowhere", RUN, { kind: "evaluation", id: "EVAL-X", fields: { status: "approved" } });
  assert.match(asked.error, /not something this page edits/);
});

/**
 * Which server files spawn a command that writes a professor_decision. Pinned:
 * a new one fails here until it is read and added, with the press it answers.
 *
 *   routes/grade.js     /api/grade/decide       `grade decide`, a card's, a group's or Accept all's press
 *   routes/defence.js   /api/defence/mark       `defence mark`, Confirmed / Partly / Not confirmed
 */
test("routes: only the Grade view's decide and the defence marks spawn a command that decides a grade", () => {
  const deciders = serverFiles()
    .filter(({ text }) => /\["grade",\s*sub\b|"grade",\s*"decide"|"defence",\s*"mark"/.test(text))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(deciders, ["routes/defence.js", "routes/grade.js"]);
  const grade = readFileSync(join(SERVER, "routes", "grade.js"), "utf-8");
  assert.match(grade, /const WRITES = \["\/api\/grade\/decide",/);
  assert.match(grade, /if \(WRITES\.includes\(path\)\) \{\s*if \(req\.method !== "POST"\)/, "a decide answers only a POST");
});

test("/api/grade/decide: a GET decides nothing", async () => {
  const answer = await ask("GET", `/api/grade/decide?run=${RUN}&assessment=ASSESSMENT-01`);
  assert.deepEqual(answer.body, { error: "This is a POST." });
});

/**
 * Which server files spawn `lms push` (grades to Canvas) or `lms send-reports`
 * (each student's marked report to Canvas), and the guard each has. Pinned
 * like the deciders above.
 */
const PUSHES = {
  // /api/canvas/marks: a plan unless the press said confirm.
  "actions.js": [/const confirm = body\.confirm === true;/, /\["lms", confirm \? "push" : "plan",/, /if \(confirm\) args\.push\("--confirm"\)/],
  // Sync all's send, and keeping AINAR's side of one difference.
  "canvas-sync.js": [/body\.keep === "ainar" && body\.confirm === true/],
  // /api/roads: previews unless confirm, and sendRoads is the only caller of the batch push.
  "routes/syncs.js": [/body\.confirm === true \? await sendRoads\(/],
  // /api/reports/send: the plan unless confirm.
  "routes/reports.js": [/\.\.\.\(body\.confirm === true \? \["--confirm"\] : \[\]\)/],
  // /api/syncs run: refused on a live sync without confirm, and --confirm only with it.
  "syncs.js": [/if \(action === "run" && isLive\(sync\) && !confirm\)/, /if \(action === "run" && confirm\) args\.push\("--confirm"\)/],
};

test("routes: a grade reaches Canvas only behind the press's confirm: true", () => {
  const pushers = serverFiles()
    .filter(({ text }) => /"lms",\s*(?:"push"|confirm \? "push"|"send-reports")|\["sync",\s*action\b/.test(text) || /sendRoads\(/.test(text))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(pushers, Object.keys(PUSHES).sort());
  for (const [name, guards] of Object.entries(PUSHES)) {
    const text = readFileSync(join(SERVER, name), "utf-8");
    for (const guard of guards) assert.match(text, guard, `${name} lost its guard`);
  }
});

test("/api/canvas/marks: a GET pushes nothing", async () => {
  const answer = await ask("GET", `/api/canvas/marks?run=${RUN}`);
  assert.equal(answer.status, 405);
});

/**
 * HOLE, not fixed here (GRD-3 says test, not redesign). The routes that decide
 * a grade (/api/grade/decide, /api/defence/mark) and send one (/api/canvas/marks,
 * /api/roads, /api/canvas/resolve, /api/reports/send) check the method and the
 * body's `confirm`, but not where the request came from. `notFromThePane`
 * (server/jobs.js), which the job, scans and defence-batch routes ask, is not
 * asked here — so a POST from any process on this machine that can reach the
 * harness's loopback port, the assistant's shell among them if its sandbox
 * lets it connect, is answered as the professor's press. And `notFromThePane`
 * would not settle it alone: GET /api/jobs/token hands the token to a request
 * that sends no Origin and no Sec-Fetch-Site, which is what curl sends.
 */
test.todo("/api/grade/decide, /api/defence/mark and the Canvas sends refuse a request that is not from the pane's own page");
