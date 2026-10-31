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
 */

import { sendJson } from "./http.js";

const STATE = (globalThis[Symbol.for("professor-pane.jobs")] ??= {
  seq: 0,
  jobs: new Map(), // id -> job, running and the last finished ones
  holders: new Map(), // key -> job id
  waiters: [], // { keys, resolve }, in the order they asked
});

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
  for (const job of finished.slice(0, Math.max(0, finished.length - KEEP))) STATE.jobs.delete(job.id);
};

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
 */
export const startJob = async ({ root, runId, kind, label, subject = null, keys, background = false, work }) => {
  const holder = holderOf(keys);
  if (holder && holder.background) return { refused: holder };
  STATE.seq += 1;
  const job = {
    id: `job-${Date.now().toString(36)}-${STATE.seq}`,
    root,
    runId,
    kind,
    label,
    subject,
    keys: [],
    background,
    state: "waiting",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    output: "",
    result: null,
  };
  job.say = (text) => {
    job.output = (job.output + String(text)).slice(-OUTPUT_LIMIT);
  };
  job.take = (more) => take(job, more);
  STATE.jobs.set(job.id, job);
  await take(job, keys);
  job.state = "running";
  const done = Promise.resolve()
    .then(() => work(job))
    .catch((error) => ({ error: String(error?.message ?? error) }))
    .then((result) => {
      job.result = result;
      job.state = result && !result.error && result.ok !== false ? "done" : "failed";
      job.finishedAt = new Date().toISOString();
      release(job);
      forget();
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
