/**
 * Placing scanned papers, one `scans assign` at a time, however fast they
 * are pressed.
 *
 * Each placement is the CLI reading the pile's plan.yaml, writing `student:`
 * beside one paper and applying the plan — a few seconds, and nothing locks
 * the plan. Two at once would each read the plan before the other wrote it,
 * and one placement would be lost. The Scans tab used to refuse a second
 * press until the first came back; now a press joins this line and the
 * papers are placed in the order they were pressed.
 *
 * One line for the whole page: the Scans tab and the Students view's exam
 * window both feed it, so a paper placed from either never overlaps one
 * placed from the other. A paper already waiting is not added twice.
 */

import { React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/** One paper of one pile: what makes two presses the same placement. */
export const placementKey = (assessment, file, pages) => assessment + "|" + (file || "") + "|" + pages;

const waiting = [];
let running = null;
let snapshot = { running: null, queued: [] };
const listeners = new Set();

const publish = () => {
  snapshot = { running: running ? running.key : null, queued: waiting.map((job) => job.key) };
  for (const listener of listeners) listener(snapshot);
};

const pump = () => {
  if (running || !waiting.length) return;
  running = waiting.shift();
  publish();
  const job = running;
  fetch(
    scoped(
      BASE + "/api/scans/assign?run=" + encodeURIComponent(job.runId) + "&assessment=" + encodeURIComponent(job.assessment),
      job.sessionId,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ pages: job.pages, file: job.file }, job.answer)),
    },
  )
    .then((response) => response.json())
    .catch((error) => ({ error: String(error) }))
    .then((result) => {
      running = null;
      publish();
      try {
        if (job.onDone) job.onDone(result);
      } finally {
        pump();
      }
    });
};

/**
 * Add a placement to the line: `{ runId, sessionId, assessment, file, pages,
 * answer: { student } | { skip }, onDone(result) }`. False when that paper is
 * already waiting or being placed.
 */
export function enqueuePlacement(job) {
  const key = placementKey(job.assessment, job.file, job.pages);
  if ((running && running.key === key) || waiting.some((entry) => entry.key === key)) return false;
  waiting.push(Object.assign({}, job, { key }));
  publish();
  pump();
  return true;
}

/** The line now: `{ running: key|null, queued: [key] }`. */
export const placementsNow = () => snapshot;

/** Whether anything is being placed or waits to be. */
export const placementsWaiting = (state = snapshot) => state.running !== null || state.queued.length > 0;

/** The line as it stands — `{ running: key|null, queued: [key] }` — kept current. */
export function usePlacements() {
  const [state, setState] = React.useState(snapshot);
  React.useEffect(() => {
    listeners.add(setState);
    setState(snapshot);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

/** Follow the line outside a component; returns the way to stop. */
export function onPlacements(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
