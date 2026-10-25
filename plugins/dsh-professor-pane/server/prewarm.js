/**
 * The first page's reads, done before anybody asks for them.
 *
 * A fresh process, or a fresh generation of these modules after a save,
 * starts with every cache empty, and the pane's first load then paid for all
 * of it at once: the course parsed from YAML (4.7 s on CSS-4007's 7.3 MB),
 * then the views computed from it — about ten seconds before Today drew.
 * `index.js` calls `prewarm` when the route goes live and when a new
 * generation loads, and the same reads the first page would make are made
 * here: every course of every workspace open in the sidebar (and
 * AINAR_WORKSPACE's), then for the run the navigator would stand on, the
 * sidebar, Today, the right column's recent changes and Weeks' Teaching
 * reading. What they leave behind is exactly what a request would have left:
 * the store's parse and the caches in workspace.js and scans.js.
 *
 * One step per turn of the event loop, so a request that arrives meanwhile is
 * answered between two steps rather than after all of them. A step that
 * throws is skipped — this only saves time, and the request that needs the
 * same read will meet the same error and say it. Nothing here writes.
 */

import { useWorkspaceProfile } from "@ainar/core/src/profile.ts";
import { Workspace, workspaceRootFor } from "@ainar/core/src/workspace.ts";

import { courseModeData } from "./course-data.js";
import { recentDocument } from "./inspector.js";
import { navigatorDocument } from "./navigator.js";
import { todayDocument } from "./today.js";
import { storeFor } from "./workspace.js";

/** Every course workspace root this process may be asked about. */
const rootsOf = (registry) => {
  const roots = new Set();
  try {
    for (const workspace of registry?.list() ?? []) {
      const root = workspaceRootFor(workspace.path);
      if (root) roots.add(root);
    }
  } catch {
    // A registry that cannot list yet: AINAR_WORKSPACE alone, if set.
  }
  const configured = (process.env.AINAR_WORKSPACE ?? "").trim();
  const fallback = configured ? workspaceRootFor(configured) : null;
  if (fallback) roots.add(fallback);
  return [...roots];
};

/** The steps for one workspace: its courses, then its landing run's views. */
const stepsFor = (root) => {
  const workspace = new Workspace(storeFor(root), "session");
  const steps = workspace.courseIds().map((courseId) => () => workspace.load(courseId));
  let runId = null;
  steps.push(() => {
    runId = navigatorDocument(workspace, root, null).run?.run_id ?? null;
  });
  steps.push(() => runId && todayDocument(workspace, root, runId));
  steps.push(() => recentDocument(workspace, root));
  steps.push(
    () =>
      runId &&
      courseModeData({
        req: { headers: {} },
        url: new URL("http://localhost/api/course?mode=teaching&drafts=1"),
        runId,
        workspace,
        root,
      }),
  );
  // Each step stands in the workspace's own profile, as a request does: a
  // request between two steps may have set another.
  return steps.map((step) => () => {
    useWorkspaceProfile({ root });
    step();
  });
};

/**
 * Warm every open workspace, one step per turn. Returns a promise that
 * settles when it is done, with what it did and how long it took, for the
 * log; it never rejects.
 */
export const prewarm = ({ registry } = {}) =>
  new Promise((done) => {
    const started = Date.now();
    const roots = rootsOf(registry);
    const queue = [];
    for (const root of roots) {
      // Listing a workspace's courses is a read of its own; a root that
      // cannot be listed is skipped like a step that throws.
      try {
        queue.push(...stepsFor(root));
      } catch {
        continue;
      }
    }
    let failed = 0;
    const next = () => {
      const step = queue.shift();
      if (!step) return done({ roots: roots.length, failed, ms: Date.now() - started });
      try {
        step();
      } catch {
        failed += 1;
      }
      setImmediate(next);
    };
    setImmediate(next);
  });
