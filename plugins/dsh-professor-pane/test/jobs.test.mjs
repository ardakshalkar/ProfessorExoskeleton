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

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("a press on a background job's key is queued behind it, not refused, and runs when it is done", async () => {
  const reading = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-read", label: "Reading Quiz 1", subject: "Q1",
    keys: [pileKey("RUN-A", "Q1")], background: true, work: reading.work(),
  });
  assert.equal(first.job.state, "running");
  assert.equal(holderOf([pileKey("RUN-A", "Q1")]).id, first.job.id);

  const ran = [];
  const second = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-apply", label: "Apply placements",
    keys: [pileKey("RUN-A", "Q1"), recordsKey("C", "submissions")], work: () => (ran.push("apply"), { ok: true }),
  });
  assert.equal(second.job.state, "waiting");
  assert.equal(second.job.queued, true, "an inline press behind a long job is answered with the job");
  assert.equal(jobById(ROOT, second.job.id).waitingFor, "Reading Quiz 1");

  // Another pile is not held up, though it shares nothing with the queued apply but the records.
  const other = await startJob({
    root: ROOT, runId: "RUN-A", kind: "scans-assign", label: "Placing papers on Quiz 2",
    keys: [pileKey("RUN-A", "Q2")], work: () => ({ ok: true }),
  });
  assert.deepEqual(await other.done, { ok: true });
  assert.deepEqual(ran, []);

  reading.open();
  await first.done;
  assert.deepEqual(await second.done, { ok: true });
  assert.deepEqual(ran, ["apply"]);
  assert.equal(jobById(ROOT, first.job.id).state, "done");
  assert.equal(jobById(ROOT, second.job.id).state, "done");
  assert.equal(holderOf([pileKey("RUN-A", "Q1")]), null);
});

test("jobs on one key run in the order pressed, and a later press does not jump the queue", async () => {
  const reading = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-O", kind: "scans-read", label: "Reading", keys: [pileKey("RUN-O", "Q1")], background: true, work: reading.work(),
  });
  const order = [];
  const a = await startJob({
    root: ROOT, runId: "RUN-O", kind: "scans-apply", label: "A", keys: [pileKey("RUN-O", "Q1"), recordsKey("O", "submissions")],
    work: () => (order.push("A"), { ok: true }),
  });
  // Its key is free, but A asked for it first.
  const b = await startJob({
    root: ROOT, runId: "RUN-O", kind: "defence-mark", label: "B", keys: [recordsKey("O", "submissions")],
    work: () => (order.push("B"), { ok: true }),
  });
  assert.equal(b.job.state, "waiting");
  assert.equal(jobById(ROOT, b.job.id).waitingFor, "A");
  assert.equal(b.job.queued, true, "behind a job that is itself queued behind a long one");
  await tick();
  assert.deepEqual(order, []);
  reading.open();
  await Promise.all([first.done, a.done, b.done]);
  assert.deepEqual(order, ["A", "B"]);
});

test("background jobs on different keys run side by side up to the cap; the next waits for a turn", async () => {
  const gates = [gate(), gate(), gate()];
  const jobs = [];
  for (const [i, g] of gates.entries()) {
    jobs.push(
      await startJob({
        root: ROOT, runId: "RUN-P", kind: "scans-read", label: `Reading Q${i}`, subject: `Q${i}`, params: { assessmentId: `Q${i}` },
        keys: [pileKey("RUN-P", `Q${i}`)], background: true, work: g.work(),
      }),
    );
  }
  assert.deepEqual(jobs.map((started) => started.job.state), ["running", "running", "waiting"]);
  assert.match(jobById(ROOT, jobs[2].job.id).waitingFor, /a free turn \(2 long jobs are running\)/);
  // An inline job is not counted against the cap.
  const inline = await startJob({ root: ROOT, runId: "RUN-P", kind: "scans-assign", label: "Placing", keys: [recordsKey("P", "x")], work: () => ({ ok: true }) });
  assert.deepEqual(await inline.done, { ok: true });

  gates[1].open();
  await jobs[1].done;
  assert.equal(jobs[2].job.state, "running");
  gates[0].open();
  gates[2].open();
  await Promise.all([jobs[0].done, jobs[2].done]);
});

test("pressing a waiting job again is a no-op, and a waiting job can be cancelled before it starts", async () => {
  const reading = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-Q", kind: "scans-read", label: "Reading Quiz 1", subject: "Q1", params: { assessmentId: "Q1" },
    keys: [pileKey("RUN-Q", "Q1")], background: true, work: reading.work(),
  });
  let runs = 0;
  const press = () =>
    startJob({
      root: ROOT, runId: "RUN-Q", kind: "scans-read", label: "Reading Quiz 1 again", subject: "Q1", params: { assessmentId: "Q1" },
      keys: [pileKey("RUN-Q", "Q1")], background: true, work: () => (runs++, { ok: true }),
    });
  const queued = await press();
  assert.equal(queued.job.state, "waiting", "the running read is not the same press: a second one queues");
  const again = await press();
  assert.equal(again.job.id, queued.job.id, "a press of the job already waiting is that job");
  assert.equal(listJobs(ROOT, "RUN-Q").length, 2);

  const after = await startJob({
    root: ROOT, runId: "RUN-Q", kind: "scans-apply", label: "Apply", keys: [pileKey("RUN-Q", "Q1")], work: () => ({ ok: true }),
  });
  assert.equal(jobById(ROOT, after.job.id).waitingFor, "Reading Quiz 1");

  assert.equal(cancelJob(ROOT, queued.job.id).job.id, queued.job.id);
  assert.match((await queued.done).error, /cancelled before it started/);
  assert.equal(jobById(ROOT, queued.job.id).state, "cancelled");
  assert.equal(runs, 0);
  assert.equal(jobById(ROOT, after.job.id).waitingFor, "Reading Quiz 1", "what queued behind it moves up");

  // An inline waiting job can be cancelled too.
  assert.equal(cancelJob(ROOT, after.job.id).job.id, after.job.id);
  assert.match((await after.done).error, /cancelled before it started/);
  reading.open();
  await first.done;
  assert.equal(holderOf([pileKey("RUN-Q", "Q1")]), null);
});

test("a running job's later key goes ahead of a press waiting on its first key", async () => {
  const reading = gate();
  const first = await startJob({
    root: ROOT, runId: "RUN-U", kind: "scans-read", label: "Reading", keys: [pileKey("RUN-U", "Q1")], background: true,
    work: async (job) => {
      await reading.work()();
      await job.take([recordsKey("U", "item_responses")]);
      return { ok: true };
    },
  });
  const waiting = await startJob({
    root: ROOT, runId: "RUN-U", kind: "scans-apply", label: "Apply",
    keys: [pileKey("RUN-U", "Q1"), recordsKey("U", "item_responses")], work: () => ({ ok: true }),
  });
  reading.open();
  assert.deepEqual(await first.done, { ok: true });
  assert.deepEqual(await waiting.done, { ok: true });
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
