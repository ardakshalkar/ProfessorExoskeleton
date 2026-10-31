// The job runner (server/jobs.js): locks per store key, a background holder
// refuses, an inline one is waited for, the table outlives a reload, and a
// background job outlives a restart, can be cancelled and continued.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "/tmp/jobs-test-" + process.pid;

// Never the professor's own ~/.ainar/jobs: set before the runner is imported,
// with one job a harness that is gone left running.
const DIR = mkdtempSync(join(tmpdir(), "pane-jobs-"));
process.env.AINAR_JOBS_DIR = DIR;
mkdirSync(DIR, { recursive: true });
writeFileSync(
  join(DIR, "job-left-1.json"),
  JSON.stringify({
    id: "job-left-1", pid: 2147483646, root: ROOT, runId: "RUN-R", kind: "scans-read", label: "Reading Quiz 9",
    subject: "Q9", params: { assessmentId: "Q9" }, keys: ["pile:RUN-R:Q9"], background: true, state: "running",
    startedAt: "2026-10-31T10:00:00.000Z", finishedAt: null, output: "read STUDENT-A\n",
    progress: { done: 12, total: 48, unit: "read" },
  }),
);

const { cancelJob, continueJob, holderOf, jobAreas, jobById, listJobs, pileKey, progressText, recordsKey, startJob } = await import(
  "../server/jobs.js"
);

/** A piece of work that finishes when told to. */
const gate = () => {
  let open;
  const opened = new Promise((resolve) => (open = resolve));
  return { open, work: (result = { ok: true, output: "done" }) => () => opened.then(() => result) };
};

test("a background job is refused to a second press on its key, and frees it when done", async () => {
  const reading = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-read", label: "Reading Quiz 1", subject: "Q1",
    keys: [pileKey("RUN-A", "Q1")], background: true, work: reading.work(),
  });
  assert.equal(first.job.state, "running");
  assert.equal(holderOf([pileKey("RUN-A", "Q1")]).id, first.job.id);

  const second = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-assign", label: "Placing papers on Quiz 1",
    keys: [pileKey("RUN-A", "Q1"), recordsKey("C", "submissions")], work: () => ({ ok: true }),
  });
  assert.equal(second.refused.id, first.job.id);

  // Another pile is not held up.
  const other = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-assign", label: "Placing papers on Quiz 2",
    keys: [pileKey("RUN-A", "Q2"), recordsKey("C", "submissions")], work: () => ({ ok: true }),
  });
  assert.deepEqual(await other.done, { ok: true });

  reading.open();
  await first.done;
  assert.equal(jobById(ROOT, first.job.id).state, "done");
  assert.equal(holderOf([pileKey("RUN-A", "Q1")]), null);
});

test("an inline job waits for another inline holder rather than being refused", async () => {
  const placing = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-B", kind: "scans-assign", label: "Placing", keys: [recordsKey("D", "submissions")], work: placing.work(),
  });
  const order = [];
  const secondStarting = startJob({
    root: ROOT, runId: "RUN-B", kind: "defence-mark", label: "Marking", keys: [recordsKey("D", "submissions")],
    work: () => (order.push("second"), { ok: true }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(order, []);
  order.push("first");
  placing.open();
  const second = await secondStarting;
  await second.done;
  assert.deepEqual(order, ["first", "second"]);
  await first.done;
});

test("a job takes a later key when it needs it, and a failure is a finished job", async () => {
  const started = await startJob({
    root: ROOT, runId: "RUN-C", kind: "scans-read", label: "Reading", keys: [pileKey("RUN-C", "Q1")], background: true,
    work: async (job) => {
      job.say("read STUDENT-1\n");
      await job.take([recordsKey("E", "item_responses")]);
      assert.ok(job.keys.includes(recordsKey("E", "item_responses")));
      return { ok: false, exitCode: 1, output: "no" };
    },
  });
  await started.done;
  const job = jobById(ROOT, started.job.id);
  assert.equal(job.state, "failed");
  assert.match(job.output, /STUDENT-1/);
  assert.equal(holderOf([recordsKey("E", "item_responses")]), null);
  assert.equal(job.root, undefined, "no workspace path leaves the server");
});

test("progress is counted from whole lines, cut wherever the chunks fall", async () => {
  const reading = gate();
  const before = jobAreas(ROOT);
  const started = await startJob({
    root: ROOT, runId: "RUN-D", kind: "scans-read", label: "Reading", keys: [pileKey("RUN-D", "Q1")], background: true,
    progress: { unit: "read", total: /^reading (\d+) /, step: /^\s+(read|partly read|unparsed|failed)\s+STUDENT-/ },
    work: async (job) => {
      job.say("reading 3 ASSESSMENT-Q1 paper(s) with m, effort low\n  read        STUD");
      job.say("ENT-A  12s\n  partly read STUDENT-B  9s\n");
      return reading.work()();
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(jobById(ROOT, started.job.id).progress, { done: 2, total: 3, unit: "read" });
  assert.equal(progressText(jobById(ROOT, started.job.id)), "2 of 3 read");
  assert.equal(jobAreas(ROOT).jobs, (before.jobs ?? 0) + 1, "a start moves `jobs`");
  reading.open();
  await started.done;
  assert.equal(jobAreas(ROOT).scans, (before.scans ?? 0) + 1, "a finished read moves `scans`");
  assert.equal(jobAreas(ROOT).jobs, (before.jobs ?? 0) + 2);
  assert.equal(progressText({ progress: null }), null);
});

test("a job its harness left running comes back interrupted, holding nothing, and can be continued", async () => {
  const left = jobById(ROOT, "job-left-1");
  assert.equal(left.state, "interrupted");
  assert.ok(left.finishedAt);
  assert.equal(left.continuable, true);
  assert.equal(progressText(left), "12 of 48 read");
  assert.equal(holderOf([pileKey("RUN-R", "Q9")]), null);
  assert.equal(JSON.parse(readFileSync(join(DIR, "job-left-1.json"), "utf-8")).state, "interrupted", "and says so on disk");

  const started = [];
  const KINDS = {
    "scans-read": (c, params) => {
      started.push({ runId: c.runId, params });
      return startJob({
        root: c.root, runId: c.runId, kind: "scans-read", label: "Reading Quiz 9", subject: params.assessmentId,
        params, keys: [pileKey(c.runId, params.assessmentId)], background: true, work: () => ({ ok: true }),
      });
    },
  };
  const again = await continueJob({ root: ROOT, workspace: null }, "job-left-1", KINDS);
  assert.deepEqual(started, [{ runId: "RUN-R", params: { assessmentId: "Q9" } }]);
  await again.done;
  assert.equal(jobById(ROOT, "job-left-1").continuedBy, again.job.id);
  assert.equal(jobById(ROOT, "job-left-1").continuable, false, "continued once, not twice");
  assert.match((await continueJob({ root: ROOT }, "job-left-1", KINDS)).error, /cannot be continued/);
  assert.match((await continueJob({ root: "/elsewhere" }, "job-left-1", KINDS)).error, /No such job/);
  assert.ok(existsSync(join(DIR, `${again.job.id}.json`)), "a background job is kept on disk");
});

test("cancel kills the child, and the job finishes cancelled and continuable", async () => {
  const started = await startJob({
    root: ROOT, runId: "RUN-K", kind: "defence-transcribe", label: "Transcribing", subject: "A1",
    params: { assessmentId: "A1" }, keys: ["defence:RUN-K:A1:S1"], background: true,
    work: (job) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
        job.adopt(child);
        child.on("exit", (code, signal) => resolve({ ok: false, exitCode: code, output: `ended by ${signal}` }));
      }),
  });
  assert.match(cancelJob(ROOT, "nope").error, /No such job/);
  assert.equal(cancelJob(ROOT, started.job.id).job.id, started.job.id);
  await started.done;
  const job = jobById(ROOT, started.job.id);
  assert.equal(job.state, "cancelled");
  assert.equal(job.continuable, true);
  assert.equal(holderOf(["defence:RUN-K:A1:S1"]), null);
  assert.match(cancelJob(ROOT, started.job.id).error, /already finished/);
});

test("jobs are per workspace and per run, and the table is shared across imports", async () => {
  assert.ok(listJobs(ROOT, "RUN-A").every((job) => job.runId === "RUN-A"));
  assert.deepEqual(listJobs("/elsewhere"), []);
  const again = await import("../server/jobs.js?second-generation");
  assert.equal(again.listJobs(ROOT).length, listJobs(ROOT).length);
});
