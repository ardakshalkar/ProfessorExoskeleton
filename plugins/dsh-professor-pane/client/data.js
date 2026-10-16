/**
 * What changed, and who has to read again.
 *
 * Until 2026-10-16 the pane had one counter. Any write — a date moved, a
 * credential stored, an outside edit seen on disk — bumped it, and every view
 * keyed on it refetched or remounted at once: frames went blank and lost their
 * scroll, panels nobody was looking at asked the server again. This replaces
 * the counter with a version per *area*, and each reader follows the areas it
 * reads.
 *
 * WHERE AREAS COME FROM
 * ---------------------
 * Two places:
 *
 * * **The course files.** `/api/revision` fingerprints every YAML under
 *   `courses/`, and also per area — the first folder or file under each
 *   course: `assessments`, `modules`, `activities`, `records`, `version`, … —
 *   plus `defence` (server/workspace.js). One watcher per session polls it and
 *   bumps exactly the areas whose fingerprint moved, whoever moved them: the
 *   pane, the assistant, an editor.
 * * **Tags** for what the pane writes outside those files: `integrations`
 *   (connections, credentials, Canvas links), `syncs`, `scans`, `files`,
 *   `preferences`, `grading`, `defence`. A write names its tag.
 *
 * After its own write the pane calls `wrote(tags)`: the tags are bumped and the
 * revision is asked at once (`fresh`, past the server's one-second cache), so
 * what the write changed on disk is redrawn now, and the next poll finds
 * nothing new rather than redrawing it a second time.
 *
 * READING
 * -------
 * `useVersion(areas)` is a number that moves when any of those areas does —
 * put it in a URL or an effect's dependencies, as the `revision` props always
 * were. `"*"` follows everything. A reader keeps its last answer on screen
 * while it asks again: nothing here blanks a view to refresh it.
 *
 * The store is module-level, so the pane and the sidebar navigator — two React
 * roots in two seats — share one watcher and one set of versions.
 */

import { React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

// ---------------------------------------------------------------- store

/** area or tag -> how many times it has moved; "*" is any move at all. */
const versions = new Map();
const listeners = new Set();

const bump = (areas) => {
  if (!areas.length) return;
  for (const area of new Set(areas)) versions.set(area, (versions.get(area) ?? 0) + 1);
  versions.set("*", (versions.get("*") ?? 0) + 1);
  for (const listener of listeners) listener();
};

const versionOf = (areas) => {
  if (areas.includes("*")) return versions.get("*") ?? 0;
  let sum = 0;
  for (const area of areas) sum += versions.get(area) ?? 0;
  return sum;
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * A number that moves when any of `areas` does. Pass the same areas every
 * render; `["*"]` follows everything.
 */
export function useVersion(areas) {
  const key = areas.join(",");
  const read = React.useCallback(() => versionOf(key.split(",")), [key]);
  return React.useSyncExternalStore(subscribe, read, read);
}

// -------------------------------------------------------------- watcher

/** How often to ask whether the course files have moved. */
const POLL_MS = 2500;

/**
 * One watcher per session id, shared by every component that mounts it.
 *
 * Three things it deliberately does not do, as the poll it replaces did not:
 * fire on the first answer (that only sets the baseline), poll a hidden tab
 * (becoming visible checks at once — the case worth catching), or treat a
 * failed request as a change (a harness restarting would redraw everything).
 */
const watchers = new Map();

const watcherFor = (sessionId) => {
  if (watchers.has(sessionId)) return watchers.get(sessionId);
  const url = scoped(BASE + "/api/revision", sessionId);
  const watcher = { users: 0, seen: null, timer: null, inflight: null };

  watcher.check = (fresh = false) => {
    if (watcher.inflight && !fresh) return watcher.inflight;
    const asked = fetch(url + (fresh ? "&fresh=1" : ""), { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((value) => {
        if (!value || typeof value.revision !== "string") return;
        const before = watcher.seen;
        watcher.seen = value;
        if (before === null || before.revision === value.revision) return;
        // A server without areas, or an answer that cannot be compared: all.
        if (!value.areas || !before.areas) return bump(["*"]);
        const moved = [];
        for (const area of new Set([...Object.keys(before.areas), ...Object.keys(value.areas)])) {
          if (before.areas[area] !== value.areas[area]) moved.push(area);
        }
        bump(moved.length ? moved : ["*"]);
      })
      .catch(() => {
        // The harness restarting, or the workspace briefly unreadable.
      })
      .finally(() => {
        if (watcher.inflight === asked) watcher.inflight = null;
      });
    watcher.inflight = asked;
    return asked;
  };

  const start = () => {
    if (watcher.timer === null) watcher.timer = setInterval(() => watcher.check(), POLL_MS);
  };
  const stop = () => {
    if (watcher.timer !== null) clearInterval(watcher.timer);
    watcher.timer = null;
  };
  watcher.onVisibility = () => {
    if (document.visibilityState === "visible") {
      watcher.check();
      start();
    } else {
      stop();
    }
  };
  watcher.mount = () => {
    watcher.users += 1;
    if (watcher.users === 1) {
      watcher.onVisibility();
      document.addEventListener("visibilitychange", watcher.onVisibility);
    }
  };
  watcher.unmount = () => {
    watcher.users -= 1;
    if (watcher.users > 0) return;
    stop();
    document.removeEventListener("visibilitychange", watcher.onVisibility);
    watchers.delete(sessionId);
  };
  watchers.set(sessionId, watcher);
  return watcher;
};

/** Watch the session's course files until the returned function is called. */
export function watchSession(sessionId) {
  const watcher = watcherFor(sessionId);
  watcher.mount();
  return () => watcher.unmount();
}

/** Keep the session's course files watched while this component is mounted. */
export function useWorkspaceWatch(sessionId) {
  React.useEffect(() => (sessionId ? watchSession(sessionId) : undefined), [sessionId]);
}

/** The version of `areas` now, outside a render. */
export const versionNow = (areas) => versionOf(areas);

/**
 * After the pane's own write: bump `tags` (what it wrote outside the course
 * files), and ask the revision now for what it wrote inside them.
 */
export function wrote(sessionId, tags = []) {
  bump(tags);
  const watcher = sessionId ? watchers.get(sessionId) : null;
  if (watcher) return watcher.check(true);
  // Nobody watching (a page outside the pane): nothing reads the areas, so
  // everything that might is told.
  bump(["*"]);
  return Promise.resolve();
}

// ---------------------------------------------------------------- areas

/**
 * What each reader follows, in one place. A reader of the weeks, the inspector
 * or the navigator reads across the whole course, so it follows everything;
 * the settings and the work queues follow their own areas and tags.
 */
export const AREAS = {
  everything: ["*"],
  integrations: ["integrations", "version", "course", "assessments"],
  syncs: ["syncs", "records", "assessments", "integrations"],
  marks: ["records", "assessments", "syncs", "integrations", "grading"],
  grading: ["grading", "version", "assessments", "records"],
  files: ["files", "scans", "defence", "records"],
  scans: ["scans", "files", "records", "assessments"],
  grade: ["records", "assessments", "items", "grading"],
};
