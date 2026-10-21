/**
 * What Canvas holds for a run — `/api/canvas/check` — asked once for the
 * whole pane rather than by the Gradebook alone.
 *
 * Until 2026-10-20 the check ran only when Progress · Gradebook opened, so the
 * Canvas card, the Grade view and the rest drew from a ledger nobody had
 * corrected from Canvas since the Gradebook was last looked at. Now the pane
 * keeps the run checked (`useCanvasWatch`) whichever page is open, and any
 * view can show the answer (`useCanvasCheck`).
 *
 * The check writes nothing to Canvas; it notes in the ledger the marks Canvas
 * already holds, so when one finishes the `canvas` tag is bumped and every
 * reader that follows it (client/data.js AREAS) reads again.
 */

import { React } from "./react.js";
import { BASE, scoped } from "./tabs.js";
import { wrote } from "./data.js";

/** How old a check of Canvas may be before the pane asks again. */
const FRESH_MS = 5 * 60 * 1000;
/** How often an open, visible pane looks at whether its check went stale. */
const LOOK_MS = 60 * 1000;

/** runId -> { phase: loading|running|ready, value }, replaced on every change. */
const runs = new Map();
/** runId -> the components drawing it. */
const listeners = new Map();

const LOADING = { phase: "loading", value: null };

const entryFor = (runId) => runs.get(runId) || LOADING;

const set = (runId, next) => {
  runs.set(runId, Object.assign({}, entryFor(runId), next));
  for (const listener of listeners.get(runId) || []) listener();
};

const urlFor = (runId, sessionId) => scoped(BASE + "/api/canvas/check?run=" + encodeURIComponent(runId), sessionId);

const stale = (answer) => !answer || answer.state !== "ready" || !answer.at || Date.now() - Date.parse(answer.at) > FRESH_MS;

/** Run a check now. One at a time per run; the server joins a second to the first too. */
const run = (runId, sessionId) => {
  const entry = entryFor(runId);
  if (entry.phase === "running") return;
  set(runId, { phase: "running" });
  fetch(urlFor(runId, sessionId), { method: "POST", headers: { accept: "application/json" } })
    .then((response) => response.json())
    .then((answer) => {
      set(runId, { phase: "ready", value: answer });
      wrote(sessionId, ["canvas"]);
    })
    .catch((error) => set(runId, { phase: "ready", value: { error: String(error) } }));
};

/** Check if the last answer — this pane's, or failing that the server's — is stale. */
const refresh = (runId, sessionId) => {
  const entry = entryFor(runId);
  if (entry.phase === "running") return;
  if (entry.phase === "ready" && entry.value && !entry.value.error) {
    if (stale(entry.value)) run(runId, sessionId);
    return;
  }
  fetch(urlFor(runId, sessionId), { headers: { accept: "application/json" } })
    .then((response) => response.json())
    .then((answer) => {
      if (answer.state === "running") return run(runId, sessionId);
      set(runId, { phase: "ready", value: answer });
      if (stale(answer)) run(runId, sessionId);
    })
    .catch(() => run(runId, sessionId));
};

/**
 * Keep `runId` checked against Canvas while this is mounted: at once, on
 * coming back to a hidden pane, and every minute it stays open, each time
 * only if the last check is more than five minutes old.
 */
export function useCanvasWatch(runId, sessionId) {
  React.useEffect(() => {
    if (!runId) return undefined;
    const look = () => document.visibilityState === "visible" && refresh(runId, sessionId);
    look();
    const timer = setInterval(look, LOOK_MS);
    document.addEventListener("visibilitychange", look);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, [runId, sessionId]);
}

/**
 * The run's last check, `{ phase, value }`, and a function that checks again
 * now. Starts a check itself if the pane is not watching this run.
 */
export function useCanvasCheck(runId, sessionId) {
  const subscribe = React.useCallback(
    (listener) => {
      if (!runId) return () => {};
      if (!listeners.has(runId)) listeners.set(runId, new Set());
      listeners.get(runId).add(listener);
      return () => listeners.get(runId).delete(listener);
    },
    [runId],
  );
  const read = React.useCallback(() => (runId ? entryFor(runId) : LOADING), [runId]);
  const state = React.useSyncExternalStore(subscribe, read, read);
  React.useEffect(() => {
    if (runId) refresh(runId, sessionId);
  }, [runId, sessionId]);
  const again = React.useCallback(() => runId && run(runId, sessionId), [runId, sessionId]);
  return [state, again];
}
