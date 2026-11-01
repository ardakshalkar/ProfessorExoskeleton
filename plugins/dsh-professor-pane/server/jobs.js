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
 *   /api/jobs/ID` until it is finished.
 * * **inline** — the short spawned writes (placing a paper, filing
 *   recordings). The request waits for its answer as it always has, while
 *   what it waits behind is seconds.
 *
 * A press whose keys are taken joins the queue (JOB-8), never a refusal:
 * jobs on one key run one after another in the order they were pressed, and
 * background jobs on different keys side by side up to a cap (`CAP`), so two
 * piles do not fight for the machine or the model's rate limit. An inline
 * press that would wait behind a long job is answered at once with the job,
 * `queued`, and followed like a background one. Pressing a background job
 * that is already waiting is a no-op: the press gets the waiting job. A
 * waiting job can be cancelled; it then never starts.
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

import { randomBytes, timingSafeEqual } from "node:crypto";
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
  waiters: [], // { job, keys, counts, urgent, grant, resolve }, in the order they asked
});
// Added after the table first existed: a harness running since then has a
// table without it, and a reload must not fail on that.
STATE.stamps ??= new Map(); // root -> area -> how many times it has moved
STATE.pending ??= []; // saved waiting jobs a previous harness left, until their workspace is asked for (JOB-9)
// The pane's per-start secret (JOB-10): a press that starts or stops work
// carries it. New with each harness process, kept across a reload.
STATE.token ??= randomBytes(24).toString("hex");

export const jobsDir = () => (process.env.AINAR_JOBS_DIR ? resolve(process.env.AINAR_JOBS_DIR) : join(homedir(), ".ainar", "jobs"));

/** What a job's file holds: enough to list it and to start it again. */
const SAVED = [
  "id", "pid", "root", "runId", "kind", "label", "subject", "params", "keys", "background", "queued",
  "state", "pressedAt", "startedAt", "finishedAt", "inputs", "heldBecause", "output", "result", "progress", "continuedBy",
];

/**
 * Kept on disk: background jobs, and the short ones queued behind them —
 * the ones a page follows, and the ones a restart must not drop (JOB-9).
 */
const save = (job) => {
  if (!job.background && !job.queued) return;
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
 * The jobs on disk, into the table, once per process. One that was running
 * when its harness went away was cut short: `interrupted`. One that was
 * still waiting is queued again, in the order it was pressed, the first
 * time its workspace is asked for (`resumeSaved`) — the kinds need the
 * workspace to start. One whose harness is still running — a second
 * harness on this machine — is that harness's, and left alone.
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
        if (job.state === "waiting" && job.params) {
          STATE.pending.push(job);
          continue;
        }
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
  STATE.pending.sort((a, b) => ((a.pressedAt ?? a.startedAt) < (b.pressedAt ?? b.startedAt) ? -1 : 1));
  forget();
};

/**
 * The waiting jobs a previous harness left for this workspace, queued
 * again in the order they were pressed, each under its old id so a page
 * that followed it finds it. `start(c, kind, params, resume)` is
 * server/job-kinds.js `startKind`. One that cannot start again — its kind
 * gone, its parameters no longer accepted — is kept as failed, saying why.
 * Once per workspace per process; resolves when every one is queued.
 */
export const resumeSaved = async (c, start) => {
  const mine = STATE.pending.filter((job) => job.root === c.root);
  if (!mine.length) return;
  STATE.pending = STATE.pending.filter((job) => job.root !== c.root);
  for (const saved of mine) {
    const started = await start({ ...c, runId: saved.runId }, saved.kind, saved.params, {
      id: saved.id,
      pressedAt: saved.pressedAt ?? saved.startedAt,
      inputs: saved.inputs ?? null,
    });
    if (started.error) {
      Object.assign(saved, { state: "failed", finishedAt: new Date().toISOString(), result: { error: `Not queued again after a restart: ${started.error}` } });
      STATE.jobs.set(saved.id, saved);
      save(saved);
    }
  }
  stamp(c.root, "jobs");
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

/**
 * How many background jobs run at once (`AINAR_JOBS_CAP`, default 2): each
 * is a CLI child, most of them asking the model, so a third waits its turn.
 * Inline jobs are seconds and are not counted.
 */
const CAP = () => Math.max(1, Number(process.env.AINAR_JOBS_CAP) || 2);
const slotsTaken = () => [...STATE.jobs.values()].filter((job) => job.slot).length;

/**
 * Whether a waiter can have its keys now: all of them free, none wanted by
 * a waiter that asked before it (`claimed`), and a slot when it counts. A
 * running job's later key (`urgent`) asks only that the key be free — it
 * holds keys already, and making it queue behind a job that waits for those
 * would wait for ever.
 */
const admissible = (waiter, claimed) =>
  free(waiter.keys) &&
  (waiter.urgent || (!waiter.keys.some((key) => claimed.has(key)) && (!waiter.counts || slotsTaken() < CAP())));

/** The keys the waiting jobs have asked for, in order: what a newcomer queues behind. */
const claimedKeys = () => new Set(STATE.waiters.filter((waiter) => !waiter.urgent).flatMap((waiter) => waiter.keys));

/**
 * All of `keys` for `job`, when it can have them; waits in the queue
 * otherwise. `counts` takes a background slot with them; `onGrant` runs the
 * moment they are granted, before anything else is let in.
 */
const take = (job, keys, { counts = false, urgent = false, onGrant = null } = {}) => {
  const wanted = [...new Set(keys)].filter((key) => STATE.holders.get(key) !== job.id).sort();
  const grant = () => {
    for (const key of wanted) STATE.holders.set(key, job.id);
    job.keys = [...new Set([...job.keys, ...wanted])].sort();
    if (counts) job.slot = true;
    if (onGrant) onGrant();
  };
  const waiter = { job, keys: wanted, counts, urgent, grant };
  if (admissible(waiter, urgent ? new Set() : claimedKeys())) {
    grant();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiter.resolve = resolve;
    // A running job's later key goes ahead of the presses still waiting.
    if (urgent) STATE.waiters.unshift(waiter);
    else STATE.waiters.push(waiter);
  });
};

/** Let in each waiter that can now have its keys, in the order they asked. */
const pump = () => {
  const claimed = new Set();
  for (let i = 0; i < STATE.waiters.length; ) {
    const waiter = STATE.waiters[i];
    // A waiter left by a harness from before JOB-8 grants inside its resolve.
    if (!waiter.grant ? free(waiter.keys) : admissible(waiter, claimed)) {
      STATE.waiters.splice(i, 1);
      waiter.grant?.();
      waiter.resolve();
    } else {
      if (!waiter.urgent) for (const key of waiter.keys) claimed.add(key);
      i += 1;
    }
  }
};

const release = (job) => {
  for (const key of job.keys) if (STATE.holders.get(key) === job.id) STATE.holders.delete(key);
  job.slot = false;
  pump();
};

/**
 * What a waiting job waits for: the job holding one of its keys, or the
 * waiting one ahead of it on a key — `{ job }` — or a slot, `{ slots }`.
 */
const blockerOf = (job) => {
  const waiter = STATE.waiters.find((entry) => entry.job === job);
  if (!waiter) return null;
  const holder = holderOf(waiter.keys);
  if (holder && holder !== job) return { job: holder };
  const ahead = STATE.waiters
    .slice(0, STATE.waiters.indexOf(waiter))
    .find((entry) => !entry.urgent && entry.job && entry.keys.some((key) => waiter.keys.includes(key)));
  if (ahead) return { job: ahead.job };
  return waiter.counts ? { slots: CAP() } : null;
};

/** "Reading Quiz 1", or "a free turn (2 long jobs are running)"; null when not waiting. */
const waitingFor = (job) => {
  if (job.state !== "waiting") return null;
  const blocker = blockerOf(job);
  if (!blocker) return null;
  return blocker.job ? blocker.job.label : `a free turn (${blocker.slots} long ${blocker.slots === 1 ? "job is" : "jobs are"} running)`;
};

/** Whether what `job` waits behind is long: a background job, or one queued behind one, or a slot. */
const waitsLong = (job) => {
  const blocker = blockerOf(job);
  return Boolean(blocker) && (Boolean(blocker.slots) || Boolean(blocker.job.background) || Boolean(blocker.job.queued));
};

const forget = () => {
  const finished = [...STATE.jobs.values()].filter((job) => job.finishedAt);
  for (const job of finished.slice(0, Math.max(0, finished.length - KEEP))) {
    STATE.jobs.delete(job.id);
    if (job.background || job.queued) rmSync(join(jobsDir(), `${job.id}.json`), { force: true });
  }
};

/**
 * A cut-short job a page follows — background, or queued behind one — that
 * has not been continued yet. `held` is one whose plan changed while it
 * waited (JOB-9); Continue runs it on the plan as it is now.
 */
const CUT_SHORT = ["interrupted", "cancelled", "failed", "held"];
const continuable = (job) => Boolean(job.params) && Boolean(job.background || job.queued) && CUT_SHORT.includes(job.state) && !job.continuedBy;

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
    queued: Boolean(job.queued),
    state: job.state,
    waitingFor: waitingFor(job),
    heldBecause: job.heldBecause ?? null,
    pressedAt: job.pressedAt ?? job.startedAt,
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

/** The sentence a refused desk edit gets (routes/defence.js); jobs queue instead. */
export const refusal = (holder) =>
  `${holder.label} is running (since ${new Date(holder.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}). ` +
  "Press again once it has finished.";

/**
 * Start a job. `work(job)` does it and returns the answer the route would
 * have sent (`{ ok, exitCode, command, output }` from `runScans`, or
 * `{ error }`); it may `job.say(text)` as it goes and `await job.take(keys)`
 * for a key it needs only later (a read's records file, at the end).
 *
 * Resolves at once to `{ job, done }`, `done` being the answer: the job is
 * `running` when it could have its keys, else `waiting` in the queue.
 *
 * `params` are what server/job-kinds.js needs to start the same kind again
 * (Continue), and what makes two presses the same job: a background job
 * with these `params` already waiting is the answer, not a second one.
 * `work` hands any child it spawns to `job.adopt`, so Cancel can kill it,
 * and stops early when `job.cancelled`.
 *
 * `inputs` — `{ read(), changed }` — is what the work depends on that the
 * professor looked at before pressing (a pile's plan): read when pressed and
 * again when the job is let in, and a job that waited while it changed is
 * `held`, with `changed` as the reason, instead of being run (JOB-9).
 * `log(type, job)` hears `started`, `finished` and `cancelled`
 * (server/job-kinds.js writes them to the course's events). `resume` is a
 * saved waiting job a restart queues again: its id, when it was pressed,
 * and the inputs it saw then.
 */
export const startJob = async ({
  root, runId, kind, label, subject = null, params = null, keys, background = false, progress = null,
  inputs = null, log = null, resume = null, work,
}) => {
  if (params) {
    const same = JSON.stringify(params);
    for (const waiting of STATE.jobs.values()) {
      if (waiting.state === "waiting" && waiting.root === root && waiting.runId === runId && waiting.kind === kind && JSON.stringify(waiting.params) === same) {
        return { job: waiting, done: waiting.done };
      }
    }
  }
  STATE.seq += 1;
  const now = new Date().toISOString();
  const job = {
    id: resume?.id ?? `job-${Date.now().toString(36)}-${STATE.seq}`,
    pid: process.pid,
    root,
    runId,
    kind,
    label,
    subject,
    params,
    keys: [],
    background,
    // Brought back by a restart, a short job has nobody waiting on its
    // request any more: it is followed by its id, as a queued one is.
    queued: Boolean(resume) && !background,
    state: "waiting",
    pressedAt: resume?.pressedAt ?? now,
    startedAt: now,
    finishedAt: null,
    inputs: resume ? resume.inputs : inputs ? inputs.read() : null,
    heldBecause: null,
    output: "",
    result: null,
    progress: progress && { done: 0, total: null, unit: progress.unit },
  };
  job.log = (type) => log?.(type, job);
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
  job.take = (more) => take(job, more, { urgent: true });
  job.adopt = (child) => {
    job.child = child;
    if (job.cancelled) child.kill();
  };
  STATE.jobs.set(job.id, job);
  stamp(root, "jobs");
  const admitted = take(job, keys, {
    counts: background,
    onGrant: () => {
      // What it was pressed on changed while it waited: held, not run.
      if (inputs && job.inputs !== null && (job.waited || resume) && inputs.read() !== job.inputs) {
        job.heldBecause = inputs.changed;
        return;
      }
      job.state = "running";
      job.startedAt = new Date().toISOString();
      save(job);
      job.log("started");
      // Let in from the queue: the pages listing it as waiting redraw.
      if (job.waited) stamp(root, "jobs");
    },
  });
  if (job.state === "waiting") {
    job.waited = true;
    // Waiting behind something long, an inline press is answered with the job.
    if (!background) job.queued = job.queued || waitsLong(job);
    // On disk while it waits, so a restart queues it again (JOB-9).
    save(job);
  }
  job.done = admitted
    .then(() =>
      job.heldBecause
        ? { error: job.heldBecause }
        : // Cancelled while it waited: it never ran, and says so.
          job.state === "waiting"
          ? { error: `${label} was cancelled before it started.` }
          : work(job),
    )
    .catch((error) => ({ error: String(error?.message ?? error) }))
    .then((result) => {
      job.result = result;
      job.state = job.heldBecause
        ? "held"
        : job.cancelled
          ? "cancelled"
          : result && !result.error && result.ok !== false
            ? "done"
            : "failed";
      job.finishedAt = new Date().toISOString();
      job.child = null;
      save(job);
      job.log("finished");
      release(job);
      forget();
      // What it wrote is in the private folder, which the revision walk does
      // not see: its area moves here, so the views that read it redraw.
      stamp(root, "jobs", kind.split("-")[0]);
      return result;
    });
  return { job, done: job.done };
};

/**
 * Answer the press that started a job: the job itself, at once, when it
 * runs in the background or is queued behind something long; else its
 * answer, when it has one.
 */
export const answerJob = (res, starting) =>
  Promise.resolve(starting)
    .then((started) => {
      if (started.error) return sendJson(res, 200, { error: started.error });
      if (started.job.background || started.job.queued) return sendJson(res, 200, { job: publicJob(started.job) });
      return started.done.then((result) => sendJson(res, 200, result));
    })
    .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));

/**
 * Cancel a job of this workspace. A waiting one leaves the queue and never
 * starts. A running background one has its child killed, and finishes as
 * `cancelled` with what it had done; its stores are written whole, so what
 * was written stays and nothing is half-written.
 */
export const cancelJob = (root, id) => {
  const job = STATE.jobs.get(id);
  if (!job || job.root !== root) return { error: "No such job." };
  if (job.finishedAt) return { error: `${job.label} has already finished.` };
  if (job.state === "waiting") {
    const at = STATE.waiters.findIndex((waiter) => waiter.job === job);
    if (at < 0) return { error: `${job.label} is starting; cancel it once it runs.` };
    const [waiter] = STATE.waiters.splice(at, 1);
    job.cancelled = true;
    job.log?.("cancelled");
    waiter.resolve();
    // What queued behind it on its keys may go now.
    pump();
    return { job: publicJob(job) };
  }
  if (!job.background) return { error: "Only background work can be cancelled; this one takes seconds." };
  job.cancelled = true;
  job.log?.("cancelled");
  job.child?.kill();
  save(job);
  return { job: publicJob(job) };
};

/**
 * Start a cut-short job again — interrupted by a restart, cancelled,
 * failed, or held — with the parameters it was started with, through
 * `start(c, kind, params)` (server/job-kinds.js `startKind`), so it is
 * checked as a fresh press is. Each kind skips what is already done, so
 * only the rest runs; a held one runs on the plan as it is now.
 */
export const continueJob = (c, id, start) => {
  const job = STATE.jobs.get(id);
  if (!job || job.root !== c.root) return Promise.resolve({ error: "No such job." });
  if (!continuable(job)) return Promise.resolve({ error: `${job.label} cannot be continued.` });
  return Promise.resolve(start({ workspace: c.workspace, root: c.root, runId: job.runId }, job.kind, job.params ?? {})).then((started) => {
    if (started.job) {
      job.continuedBy = started.job.id;
      save(job);
    }
    return started;
  });
};

/**
 * Whether a request comes from the pane's own page (JOB-10): the browser
 * says it is same-origin, and, when `withToken`, it carries this harness's
 * per-start token. Asked by every press that starts work, and (GRD-3) by
 * every route that decides a grade or sends one. A page on another site, a document the pane shows (in a
 * sandboxed frame, so its origin is "null"), or a press saved from a
 * previous start does not. The sentence why, or null.
 *
 * What it cannot stop is a process on this machine that forges the headers
 * and reads the token: against that, the kinds table is the guarantee —
 * such a request can still only start known work with checked parameters.
 */
export const notFromThePane = (req, withToken = true) => {
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin") return "Work is started from the pane's own page, not from another site or a shown document.";
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let host = null;
    try {
      host = origin === "null" ? null : new URL(origin).host;
    } catch {
      host = null;
    }
    if (!host || host !== req.headers.host) return "Work is started from the pane's own page, not from another site or a shown document.";
  }
  if (!withToken) return null;
  const sent = Buffer.from(String(req.headers["x-pane-token"] ?? ""));
  const mine = Buffer.from(STATE.token);
  if (sent.length !== mine.length || !timingSafeEqual(sent, mine)) {
    return "This page was opened before the harness last started. Reload it, then press again.";
  }
  return null;
};

/** The per-start token, for the pane's page to send back (`GET /api/jobs/token`). */
export const paneToken = () => STATE.token;

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
