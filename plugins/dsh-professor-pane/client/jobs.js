/**
 * Following a job the server runs in the background (server/jobs.js).
 *
 * A long press — reading a pile, transcribing a batch — is answered at once
 * with `{ job }`; the answer the press used to wait for comes from asking
 * after the job until it has finished. Everything else answers as before,
 * so a caller can put `followJob` after any press's JSON.
 */

import { BASE, scoped } from "./tabs.js";

const EVERY = 2000;

const ask = (path, sessionId) =>
  fetch(scoped(BASE + path, sessionId), { cache: "no-store", headers: { accept: "application/json" } }).then((response) =>
    response.json(),
  );

/**
 * The press's final answer: `answer` itself, or — when it is a job — the
 * job's result once it has finished. `onJob(job)` hears each time it is
 * asked after, for a page that shows the running output.
 */
export const followJob = (answer, sessionId, onJob) => {
  if (!answer || !answer.job) return Promise.resolve(answer);
  return new Promise((resolve) => {
    const poll = (job) => {
      if (onJob) onJob(job);
      if (job.state === "done" || job.state === "failed") {
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

/** The run's job of this kind on this subject that has not finished, or null — for a page opened while it runs. */
export const runningJob = (runId, sessionId, kind, subject) =>
  ask("/api/jobs?run=" + encodeURIComponent(runId), sessionId)
    .then(
      (value) =>
        (value.jobs || []).find(
          (job) => job.kind === kind && (!subject || job.subject === subject) && (job.state === "running" || job.state === "waiting"),
        ) || null,
    )
    .catch(() => null);
