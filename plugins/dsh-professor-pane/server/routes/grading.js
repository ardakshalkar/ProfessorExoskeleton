/**
 * Routes: grading. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import {
  discardGradingProposal,
  gradebookChanges,
  gradingImpact,
  gradingPolicy,
  historyProposal,
  writeGradingLock,
  writeGradingPolicy,
} from "../grading-writes.js";
import { readBody, sendJson } from "../http.js";

export const routes = [
  /**
   * The grading policy from the Gradebook. A read; an impact, which writes
   * nothing; the change itself; and the lock. `grading-writes.js` says why
   * the pane may write it and what guards the write.
   */
  {
    paths: ["/api/grading/policy"],
    handle(c) {
      const { res, runId, workspace, root } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(res, 200, gradingPolicy(workspace, runId, root));
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
  {
    paths: ["/api/grading/history"],
    handle(c) {
      const { res, url, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(res, 200, historyProposal(workspace, runId, url.searchParams.get("index")));
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
  {
    paths: ["/api/gradebook/changes"],
    handle(c) {
      const { res, url, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(res, 200, gradebookChanges(workspace, runId, { names: url.searchParams.get("names") === "1" }));
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
  {
    paths: ["/api/grading/impact","/api/grading/apply","/api/grading/lock","/api/grading/discard"],
    handle(c) {
      const { req, res, path, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "the grading policy is POST only here" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The body is not JSON." });
          }
          const answer =
            path === "/api/grading/impact"
              ? gradingImpact(workspace, runId, body)
              : path === "/api/grading/apply"
                ? writeGradingPolicy(workspace, root, runId, body)
                : path === "/api/grading/discard"
                  ? discardGradingProposal(workspace, root, runId, body)
                  : writeGradingLock(workspace, root, runId, body);
          return sendJson(res, 200, answer);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
