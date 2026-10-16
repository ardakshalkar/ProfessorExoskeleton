/**
 * Routes: plan. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { readBody, sendJson } from "../http.js";
import { writeAssessmentDates, writeTopicMoves } from "../plan-writes.js";

export const routes = [
  /**
   * A piece of graded work's two dates, from Planning's drag and its form.
   *
   * The body is `{assessment, opens_at, due_at}`, each date a timestamp with
   * its offset; an empty `opens_at` clears it. `writeAssessmentDates` says
   * why the pane may write this and how.
   */
  {
    paths: ["/api/plan/dates"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "setting dates is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The dates body is not JSON." });
          }
          return sendJson(res, 200, writeAssessmentDates(workspace, root, runId, body));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * A topic moved to another week, from Planning's drag and its form: the
   * module's `week` and its meetings' dates, and the other topic's too when
   * the two swap. `writeTopicMoves` checks and writes.
   */
  {
    paths: ["/api/plan/topic"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "moving a topic is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The topic body is not JSON." });
          }
          return sendJson(res, 200, writeTopicMoves(workspace, root, runId, body));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
