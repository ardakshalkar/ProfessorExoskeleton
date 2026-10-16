/**
 * Routes: publish. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { runPublish } from "../actions.js";
import { readBody, sendJson } from "../http.js";

export const routes = [
  // `/api/homework/publish` was here and is gone. It spawned
  // `ainar homework publish`, which `/api/publish` with `target: homework`
  // now does — plus the promotion of the brief, which is the half that used
  // to send the professor to a terminal. Two publishing routes in one web
  // server, one of them narrower, is how a button ends up doing less than
  // the button beside it for reasons nobody can see. `git log -S` has it.
  {
    paths: ["/api/publish"],
    handle(c) {
      const { req, res, runId, root } = c;
      // POST only, for `/api/publish`'s reason and one of its own: with
      // `confirm` this both writes to `courses/` and puts something in front of
      // students, and neither is a thing a prefetch should be able to start.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "publish is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(res, 200, { error: "The request body must be an object." });
          }
          return runPublish(res, root, runId, String(body.target ?? ""), body);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  {
    paths: ["/api/approve"],
    handle(c) {
      const { res } = c;
      // Removed on 2026-09-29, with `ainar approve`. Answered rather than
      // left to fall through, so an older client says why its button is gone.
      return sendJson(res, 410, {
        error:
          "Approval is no longer a command. Drafts live in the course marked " +
          "`approval: draft`; accept one by changing that word in its record.",
      });
    },
  },
];
