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
const ask = (method, path, headers = {}) =>
  new Promise((done) => {
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end(body) {
        done({ status: this.status, body: JSON.parse(String(body)) });
      },
    };
    handle({ method, url: `/professor-pane${path}`, headers }, res, { registry: { list: () => [] } });
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
 * The routes that decide a grade and the ones that send one also ask where the
 * press came from (`notFromThePane`, server/jobs.js): the pane's own page, with
 * this start's token. A POST from elsewhere on this machine — curl from the
 * assistant's shell, which sends no Origin, no Sec-Fetch-Site and no token — is
 * refused before its body is read, as is a page on another site and a page
 * left open across a restart. Every grade writer and every pusher pinned above
 * answers through one of these.
 */
const PRESSES = [
  `/api/grade/decide?run=${RUN}&assessment=ASSESSMENT-01`,
  `/api/defence/mark?run=${RUN}&assessment=ASSESSMENT-01&student=STUDENT-001&outcome=defended`,
  `/api/canvas/marks?run=${RUN}`,
  `/api/canvas/resolve?run=${RUN}`,
  `/api/roads?run=${RUN}`,
  `/api/syncs/action?run=${RUN}`,
  `/api/reports/send?run=${RUN}&assessment=ASSESSMENT-01`,
  `/api/reports/make?run=${RUN}&assessment=ASSESSMENT-01`,
];

test("the grade and send routes refuse a POST that is not the pane's own page's press", async () => {
  const pane = { host: "localhost:3080", origin: "http://localhost:3080", "sec-fetch-site": "same-origin" };
  const strangers = {
    "curl, with nothing": {},
    "another site": { ...pane, origin: "http://evil.example", "sec-fetch-site": "cross-site" },
    "the pane, before a restart": { ...pane, "x-pane-token": "0".repeat(48) },
  };
  for (const path of PRESSES) {
    for (const [who, headers] of Object.entries(strangers)) {
      const answer = await ask("POST", path, headers);
      assert.equal(answer.body.token, true, `${path} answered ${who}: ${JSON.stringify(answer.body)}`);
      assert.match(answer.body.error, /pane's own page|Reload it/, `${path}, ${who}`);
    }
  }
});

test("/api/jobs/token: the token goes only to a request the browser marks same-origin", async () => {
  assert.equal((await ask("GET", "/api/jobs/token")).body.token, undefined, "curl gets no token");
  const cross = await ask("GET", "/api/jobs/token", { host: "localhost:3080", "sec-fetch-site": "cross-site" });
  assert.equal(cross.body.token, undefined);
  const own = await ask("GET", "/api/jobs/token", { host: "localhost:3080", origin: "http://localhost:3080", "sec-fetch-site": "same-origin" });
  assert.match(own.body.token, /^[0-9a-f]{48}$/);
});

/**
 * What these guards cannot stop, said plainly: a process on this machine that
 * forges Sec-Fetch-Site and Origin, asks for the token, and sends it back.
 * Nothing served on loopback can tell that process from the browser. Against
 * it stand the assistant's sandbox, which may not reach the port, and the
 * skills' rule that the assistant never decides or sends a grade.
 */
