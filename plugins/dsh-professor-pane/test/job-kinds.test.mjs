// The kinds table (server/job-kinds.js, JOB-10): only listed work starts,
// nothing that reaches students is ever queued, parameters are checked, no
// route goes around the table, and what ran is recorded in the course.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

process.env.AINAR_JOBS_DIR = mkdtempSync(join(tmpdir(), "pane-kinds-jobs-"));

const { KINDS, SEND_KINDS, logTo, startKind } = await import("../server/job-kinds.js");

const HERE = dirname(fileURLToPath(import.meta.url));
const c = { root: "/nowhere", runId: "RUN-K", workspace: null };

test("a kind that is not in the table is refused, whatever it is called", async () => {
  for (const kind of ["shell", "constructor", "__proto__", "toString", "scans-read; rm -rf /", ""]) {
    assert.match((await startKind(c, kind, { assessmentId: "Q1" })).error, /No such kind of work/, kind);
  }
});

test("nothing that reaches students is a kind, and asking for one is refused", async () => {
  for (const kind of SEND_KINDS) {
    assert.equal(Object.hasOwn(KINDS, kind), false, `${kind} must not be a kind`);
    assert.match((await startKind(c, kind, {})).error, /reaches students/);
  }
  for (const kind of Object.keys(KINDS)) {
    assert.doesNotMatch(kind, /canvas|publish|telegram|send|push|github/, `${kind} sounds like it sends`);
  }
});

test("parameters are checked before anything starts", async () => {
  assert.match((await startKind(c, "scans-read", {})).error, /No assessment/);
  assert.match((await startKind(c, "scans-read", { assessmentId: "../../etc" })).error, /No assessment/);
  assert.match((await startKind(c, "scans-assign", { assessmentId: "Q1", papers: [] })).error, /No papers/);
  assert.match((await startKind(c, "scans-assign", { assessmentId: "Q1", papers: [{ pages: "1-3; whoami" }] })).error, /No paper given/);
  assert.match(
    (await startKind(c, "scans-assign", { assessmentId: "Q1", papers: [{ pages: "1-3", file: "../x.pdf", student: "STUDENT-A" }] })).error,
    /scan's file name/,
  );
  assert.match((await startKind(c, "scans-assign", { assessmentId: "Q1", papers: [{ pages: "1-3", student: "Bob" }] })).error, /pseudonym/);
  assert.equal(KINDS["defence-batch-apply"].check({ assessmentId: "ASSESSMENT-A", consent: "1" }).consent, false, "consent is true or nothing");
  assert.deepEqual(KINDS["scans-apply"].check({ assessmentId: "Q1", extra: "--anything" }), { assessmentId: "Q1" }, "what is not asked for is dropped");
});

test("no route starts work around the table", () => {
  const routes = join(HERE, "..", "server", "routes");
  for (const name of readdirSync(routes)) {
    const text = readFileSync(join(routes, name), "utf-8");
    assert.doesNotMatch(text, /\bstartJob\s*\(/, `${name} calls startJob directly; go through startKind`);
  }
});

test("a job's start, finish and cancel are written to the course's events, with who pressed it", () => {
  const root = mkdtempSync(join(tmpdir(), "pane-kinds-root-"));
  const log = logTo({ root }, { courseId: "CSS-1", title: "Quiz 1", timezone: "UTC" });
  const job = { id: "job-abc-1", runId: "CSS-1-2026-FALL", kind: "scans-read", label: "Reading Quiz 1", params: { assessmentId: "Q1" }, state: "running" };
  log("started", job);
  job.state = "done";
  log("finished", job);
  const events = parse(readFileSync(join(root, "courses", "CSS-1", "records", "events.yaml"), "utf-8"));
  const list = Array.isArray(events) ? events : events.events;
  assert.deepEqual(list.map((event) => event.event_id), ["EVENT-JOB-ABC-1-STARTED", "EVENT-JOB-ABC-1-FINISHED"]);
  assert.equal(list[0].event_type, "job_started");
  assert.equal(list[0].course_version_id, "CSS-1-2026-FALL");
  assert.equal(list[0].payload.pressed_by, "professor, in the pane");
  assert.deepEqual(list[0].payload.params, { assessmentId: "Q1" });
  assert.equal(list[1].payload.state, "done");
});
