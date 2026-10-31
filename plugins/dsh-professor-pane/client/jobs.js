/**
 * Following a job the server runs in the background (server/jobs.js).
 *
 * A long press — reading a pile, transcribing a batch — is answered at once
 * with `{ job }`; the answer the press used to wait for comes from asking
 * after the job until it has finished. Everything else answers as before,
 * so a caller can put `followJob` after any press's JSON.
 */

import { React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

const EVERY = 2000;

const ask = (path, sessionId) =>
  fetch(scoped(BASE + path, sessionId), { cache: "no-store", headers: { accept: "application/json" } }).then((response) =>
    response.json(),
  );

/**
 * The press's final answer: `answer` itself, or — when it is a job — the
 * job's result once it has finished. `onJob(job)` hears each time it is
 * asked after, for a page that shows the running output or the count.
 * `alive()`, when it turns false — the view was closed — stops the asking
 * and resolves to null; the job runs on, and the view finds it again.
 */
export const followJob = (answer, sessionId, onJob, alive) => {
  if (!answer || !answer.job) return Promise.resolve(answer);
  return new Promise((resolve) => {
    const poll = (job) => {
      if (alive && !alive()) {
        resolve(null);
        return;
      }
      if (onJob) onJob(job);
      // Done, failed, cancelled, or interrupted by a restart: finished.
      if (job.finishedAt) {
        resolve(job.result || { error: "The job finished without an answer." });
        return;
      }
      setTimeout(() => {
        ask("/api/jobs/" + encodeURIComponent(job.id), sessionId)
          .then((value) => (value.job ? poll(value.job) : resolve({ error: value.error || "The job is gone." })))
          // A missed answer (the harness reloading) is asked again, not a failure.
          .catch(() => poll(job));
      }, EVERY);
    };
    poll(answer.job);
  });
};

/** "12 of 48 read", as server/jobs.js `progressText` says it; null for a job that does not count. */
export const progressText = (job) => {
  const progress = job && job.progress;
  if (!progress) return null;
  return progress.total === null ? progress.done + " " + progress.unit : progress.done + " of " + progress.total + " " + progress.unit;
};

/** How long a finished background job stays listed, saying what it did. */
const RECENT_MS = 15 * 60 * 1000;

/**
 * The run's background jobs — running, waiting, and finished in the last
 * quarter hour — asked again when `version` moves, and every few seconds
 * while one runs, so its count goes up without the revision moving.
 */
export function useRunJobs(runId, sessionId, version) {
  const [jobs, setJobs] = React.useState([]);
  React.useEffect(() => {
    if (!runId || !sessionId) return undefined;
    let live = true;
    let timer = null;
    const load = () =>
      ask("/api/jobs?run=" + encodeURIComponent(runId), sessionId)
        .then((value) => {
          if (!live) return;
          const now = Date.now();
          const shown = (value.jobs || []).filter(
            (job) => job.background && (!job.finishedAt || now - Date.parse(job.finishedAt) < RECENT_MS),
          );
          setJobs(shown);
          if (shown.some((job) => !job.finishedAt)) timer = setTimeout(load, EVERY);
        })
        .catch(() => {
          if (live) timer = setTimeout(load, EVERY * 5);
        });
    load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [runId, sessionId, version]);
  return jobs;
}

/**
 * The run's latest job of this kind (on this subject, when given), finished
 * or not, or null — for a page opened while one runs, or after one was cut
 * short and can be continued.
 */
export const lastJob = (runId, sessionId, kind, subject) =>
  ask("/api/jobs?run=" + encodeURIComponent(runId), sessionId)
    .then((value) => (value.jobs || []).find((job) => job.kind === kind && (!subject || job.subject === subject)) || null)
    .catch(() => null);

const press = (path, sessionId) =>
  fetch(scoped(BASE + path, sessionId), { method: "POST", headers: { accept: "application/json" } })
    .then((response) => response.json())
    .catch((error) => ({ error: String(error) }));

/** Cancel a running job: `{ job }`, or `{ error }`. Its follower sees it finish. */
export const cancelJob = (id, sessionId) => press("/api/jobs/" + encodeURIComponent(id) + "/cancel", sessionId);

/** Start a cut-short job's kind again: `{ job }` (the new one), or `{ error }`. */
export const continueJob = (id, sessionId) => press("/api/jobs/" + encodeURIComponent(id) + "/continue", sessionId);

/** What a cut-short job's state is called. */
export const CUT_SHORT_WORDS = { interrupted: "was interrupted by a restart", cancelled: "was cancelled", failed: "failed" };
