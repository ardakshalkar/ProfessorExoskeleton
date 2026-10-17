/**
 * Routes: course mode's data, for the React view (client/course/).
 *
 * The same assembly the server-rendered page is drawn from (server/course-data.js),
 * as JSON. The browser draws it and counts nothing; the figures in it were made
 * here.
 */

import { courseModeData } from "../course-data.js";
import { sendJson } from "../http.js";

export const routes = [
  {
    paths: ["/api/course"],
    handle(c) {
      const { res, runId } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const { data, mode, student, withDrafts, evidence, status, locks, graph, focus } = courseModeData(c);
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      return sendJson(res, 200, { data, mode, student, drafts: withDrafts, evidence, status, locks, graph, focus });
    },
  },
];
