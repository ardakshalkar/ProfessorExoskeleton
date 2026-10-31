/**
 * The job runner (JOB-2): work that spawns `ainar` and writes the private
 * folder or the course's records, with the locks that keep two writers apart.
 *
 * A lock names a STORE, not an action — `pile:RUN:A`, `records:C:submissions`
 * — as docs/JOBS.md settles; a job declares every key it writes and takes
 * them all at once. Two kinds of job hold them:
 *
 * * **background** — the long ones (reading a pile, transcribing a batch).
 *   The press is answered at once with the job; the page asks `GET
 *   /api/jobs/ID` until it is finished. A press that needs a key one of these
 *   holds is refused with what is running, not raced.
 * * **inline** — the short spawned writes (placing a paper, filing
 *   recordings). The request waits for its answer as it always has; one that
 *   needs a key another inline job holds waits its turn — seconds — and only
 *   a background holder refuses it.
 *
 * The table lives on `globalThis`, not in this module: `index.js` re-imports
 * everything under `server/` on a save, and a half-hour read must not be
 * forgotten — its locks with it — because a file was edited while it ran.
 * It is per process: a second harness, a terminal, and the assistant's own
 * `ainar` are not seen here (docs/JOBS.md, *Open questions*).
 *
 * A background job is also kept on disk, one file per job in
 * `~/.ainar/jobs/` (`AINAR_JOBS_DIR`), so a harness restart does not forget
 * it (JOB-5): one that was running when its harness went away is marked
 * `interrupted`, with what it had done, and can be continued. It can be
 * cancelled, which kills its child; the stores it writes are written whole
 * (ainar-node/src/write-file.ts), so a kill leaves no half a file.
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { sendJson } from "./http.js";

const SYMBOL = Symbol.for("professor-pane.jobs");
// The first import in this process: the jobs on disk are read once, here.
const FIRST = !globalThis[SYMBOL];
const STATE = (globalThis[SYMBOL] ??= {
  seq: 0,
  jobs: new Map(), // id -> job, running and the last finished ones
  holders: new Map(), // key -> job id
  waiters: [], // { keys, resolve }, in the order they asked
});
// Added after the table first existed: a harness running since then has a
// table without it, and a reload must not fail on that.
STATE.stamps ??= new Map(); // root -> area -> how many times it has moved

export const jobsDir = () => (process.env.AINAR_JOBS_DIR ? resolve(process.env.AINAR_JOBS_DIR) : join(homedir(), ".ainar", "jobs"));

/** What a job's file holds: enough to list it and to start it again. */
const SAVED = [
  "id", "pid", "root", "runId", "kind", "label", "subject", "params", "keys", "background",
  "state", "startedAt", "finishedAt", "output", "result", "progress", "continuedBy",
];

const save = (job) => {
  if (!job.background) return;
  job.savedAt = Date.now();
  try {
    mkdirSync(jobsDir(), { recursive: true });
    const path = join(jobsDir(), `${job.id}.json`);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(SAVED.map((field) => [field, job[field] ?? null])), null, 1));
    renameSync(temporary, path);
  } catch {
    // A job not saved is still running; it is only forgotten by a restart.
  }
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

/**
 * The jobs on disk, into the table, once per process. One whose harness is
 * gone was cut short: `interrupted`. One whose harness is still running — a
 * second harness on this machine — is that harness's, and left alone.
 */
const loadSaved = () => {
  let names = [];
  try {
    names = readdirSync(jobsDir()).filter((name) => name.endsWith(".json"));
  } catch {
    return;
  }
  const loaded = [];
  for (const name of names) {
    try {
      const job = JSON.parse(readFileSync(join(jobsDir(), name), "utf-8"));
      if (!job || !job.id || !job.root) continue;
      if (!job.finishedAt) {
        if (job.pid && job.pid !== process.pid && alive(job.pid)) continue;
        job.state = "interrupted";
        job.finishedAt = new Date().toISOString();
        save(job);
      }
      loaded.push(job);
    } catch {
      // A file that does not read is not a job.
    }
  }
  for (const job of loaded.sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))) STATE.jobs.set(job.id, job);
  forget();
};

/** How many finished jobs are kept for `GET /api/jobs`. */
const KEEP = 40;
/** How much of a job's output is kept while it runs. */
const OUTPUT_LIMIT = 64 * 1024;

export const pileKey = (runId, assessmentId) => `pile:${runId}:${assessmentId}`;
export const recordsKey = (courseId, collection) => `records:${courseId}:${collection}`;
export const recordingsKey = (runId) => `recordings:${runId}`;
export const defenceKey = (runId, assessmentId, studentId) => `defence:${runId}:${assessmentId}:${studentId}`;
export const reportsKey = (runId, assessmentId) => `reports:${runId}:${assessmentId}`;

/** The job holding any of these keys, or null. */
export const holderOf = (keys) => {
  for (const key of keys) {
    const id = STATE.holders.get(key);
    if (id) return STATE.jobs.get(id) ?? null;
  }
  return null;
};

const free = (keys) => keys.every((key) => !STATE.holders.has(key));

/** All of `keys` for `job`, when every one is free; waits otherwise. */
const take = (job, keys) => {
  const wanted = [...new Set(keys)].filter((key) => STATE.holders.get(key) !== job.id).sort();
  const grant = () => {
    for (const key of wanted) STATE.holders.set(key, job.id);
    job.keys = [...new Set([...job.keys, ...wanted])].sort();
  };
  if (free(wanted)) {
    grant();
    return Promise.resolve();
  }
  return new Promise((resolve) => STATE.waiters.push({ keys: wanted, resolve: () => (grant(), resolve()) }));
};

const release = (job) => {
  for (const key of job.keys) if (STATE.holders.get(key) === job.id) STATE.holders.delete(key);
  // Waiters in the order they asked; each that can now have all its keys does.
  for (let i = 0; i < STATE.waiters.length; ) {
    const waiter = STATE.waiters[i];
    if (free(waiter.keys)) {
      STATE.waiters.splice(i, 1);
      waiter.resolve();
    } else i += 1;
  }
};

const forget = () => {
  const finished = [...STATE.jobs.values()].filter((job) => job.finishedAt);
  for (const job of finished.slice(0, Math.max(0, finished.length - KEEP))) {
    STATE.jobs.delete(job.id);
    if (job.background) rmSync(join(jobsDir(), `${job.id}.json`), { force: true });
  }
};

/** A cut-short background job that has not been continued yet. */
const CUT_SHORT = ["interrupted", "cancelled", "failed"];
const continuable = (job) => Boolean(job.background) && CUT_SHORT.includes(job.state) && !job.continuedBy;

/** A job as the page sees it: no workspace path, no promise. */
export const publicJob = (job) =>
  job && {
    id: job.id,
    kind: job.kind,
    label: job.label,
    runId: job.runId,
    subject: job.subject,
    keys: job.keys,
    background: job.background,
    state: job.state,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    output: job.output,
    result: job.result,
    progress: job.progress,
    continuedBy: job.continuedBy ?? null,
    continuable: continuable(job),
  };

/**
 * How far a job has got, in words: "12 of 48 read", or "12 read" before the
 * count is known; null for a job that does not count.
 */
export const progressText = (job) => {
  const progress = job && job.progress;
  if (!progress) return null;
  return progress.total === null ? `${progress.done} ${progress.unit}` : `${progress.done} of ${progress.total} ${progress.unit}`;
};

/**
 * What jobs add to the revision (server/workspace.js), per area: `jobs`
 * moves when one starts or finishes, `scans` or `defence` when one of that
 * kind finishes. Counters, not contents: never per line, so a running read
 * does not redraw the pane every poll.
 */
export const jobAreas = (root) => Object.fromEntries(STATE.stamps.get(root) ?? []);

const stamp = (root, ...areas) => {
  if (!STATE.stamps.has(root)) STATE.stamps.set(root, new Map());
  const counts = STATE.stamps.get(root);
  for (const area of areas) counts.set(area, (counts.get(area) ?? 0) + 1);
};

/** The sentence a refused press gets. */
export const refusal = (holder) =>
  `${holder.label} is running (since ${new Date(holder.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}). ` +
  "Press again once it has finished.";

/**
 * Start a job. `work(job)` does it and returns the answer the route would
 * have sent (`{ ok, exitCode, command, output }` from `runScans`, or
 * `{ error }`); it may `job.say(text)` as it goes and `await job.take(keys)`
 * for a key it needs only later (a read's records file, at the end).
 *
 * Resolves to `{ refused }`, the holder, when a background job has one of
 * the keys; else to `{ job, done }`, `done` being the answer.
 *
 * `params` are what server/job-kinds.js needs to start the same kind again
 * (Continue); `work` hands any child it spawns to `job.adopt`, so Cancel
 * can kill it, and stops early when `job.cancelled`.
 */
export const startJob = async ({ root, runId, kind, label, subject = null, params = null, keys, background = false, progress = null, work }) => {
  const holder = holderOf(keys);
  if (holder && holder.background) return { refused: holder };
  STATE.seq += 1;
  const job = {
    id: `job-${Date.now().toString(36)}-${STATE.seq}`,
    pid: process.pid,
    root,
    runId,
    kind,
    label,
    subject,
    params,
    keys: [],
    background,
    state: "waiting",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    output: "",
    result: null,
    progress: progress && { done: 0, total: null, unit: progress.unit },
  };
  // Whole lines only are counted: output arrives in chunks that can cut one.
  let partial = "";
  job.say = (text) => {
    job.output = (job.output + String(text)).slice(-OUTPUT_LIMIT);
    if (!progress) return;
    const lines = (partial + String(text)).split("\n");
    partial = lines.pop();
    for (const line of lines) {
      const total = progress.total.exec(line);
      if (total) job.progress.total = Number(total[1]);
      else if (progress.step.test(line)) job.progress.done += 1;
    }
    // On disk every few seconds, so a restart knows how far it had got.
    if (Date.now() - (job.savedAt ?? 0) > 3000) save(job);
  };
  job.take = (more) => take(job, more);
  job.adopt = (child) => {
    job.child = child;
    if (job.cancelled) child.kill();
  };
  STATE.jobs.set(job.id, job);
  stamp(root, "jobs");
  await take(job, keys);
  job.state = "running";
  save(job);
  const done = Promise.resolve()
    .then(() => work(job))
    .catch((error) => ({ error: String(error?.message ?? error) }))
    .then((result) => {
      job.result = result;
      job.state = job.cancelled ? "cancelled" : result && !result.error && result.ok !== false ? "done" : "failed";
      job.finishedAt = new Date().toISOString();
      job.child = null;
      save(job);
      release(job);
      forget();
      // What it wrote is in the private folder, which the revision walk does
      // not see: its area moves here, so the views that read it redraw.
      stamp(root, "jobs", kind.split("-")[0]);
      return result;
    });
  return { job, done };
};

/**
 * Answer the press that started a job: the refusal; the job itself, at once,
 * when it runs in the background; else its answer, when it has one.
 */
export const answerJob = (res, starting) =>
  Promise.resolve(starting)
    .then((started) => {
      if (started.refused) return sendJson(res, 200, { error: refusal(started.refused), busy: publicJob(started.refused) });
      if (started.job.background) return sendJson(res, 200, { job: publicJob(started.job) });
      return started.done.then((result) => sendJson(res, 200, result));
    })
    .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));

/**
 * Cancel a running background job of this workspace: its child is killed,
 * and it finishes as `cancelled` with what it had done. Its stores are
 * written whole, so what was written stays and nothing is half-written.
 */
export const cancelJob = (root, id) => {
  const job = STATE.jobs.get(id);
  if (!job || job.root !== root) return { error: "No such job." };
  if (!job.background) return { error: "Only background work can be cancelled; this one takes seconds." };
  if (job.finishedAt) return { error: `${job.label} has already finished.` };
  job.cancelled = true;
  job.child?.kill();
  save(job);
  return { job: publicJob(job) };
};

/**
 * Start a cut-short job again — interrupted by a restart, cancelled, or
 * failed — from `kinds` (server/job-kinds.js), with the parameters it was
 * started with. Each kind skips what is already done, so only the rest runs.
 */
export const continueJob = (c, id, kinds) => {
  const job = STATE.jobs.get(id);
  if (!job || job.root !== c.root) return Promise.resolve({ error: "No such job." });
  if (!continuable(job) || !kinds[job.kind]) return Promise.resolve({ error: `${job.label} cannot be continued.` });
  return Promise.resolve(kinds[job.kind]({ workspace: c.workspace, root: c.root, runId: job.runId }, job.params ?? {})).then((started) => {
    if (started.job) {
      job.continuedBy = started.job.id;
      save(job);
    }
    return started;
  });
};

/** This workspace's jobs, newest first; `runId` narrows them to one run. */
export const listJobs = (root, runId = "") =>
  [...STATE.jobs.values()]
    .filter((job) => job.root === root && (!runId || job.runId === runId))
    .reverse()
    .map(publicJob);

/** One of this workspace's jobs, or null. */
export const jobById = (root, id) => {
  const job = STATE.jobs.get(id);
  return job && job.root === root ? publicJob(job) : null;
};

// Last, once everything above is defined: the jobs a previous harness left.
if (FIRST) loadSaved();
