/**
 * Routes: one course item's editable fields, read and written. See
 * server/record-fields.js for which items and fields, and why those.
 */

import { readBody, sendJson } from "../http.js";
import { readRecord, writeRecordFields } from "../record-fields.js";

export const routes = [
  /**
   * GET `?kind=assessment&id=ASSESSMENT-HW4` — the item and its fields, for
   * the dialog. POST `{kind, id, fields}` — set them; an inline title edit
   * and the dialog's Save both arrive here.
   */
  {
    paths: ["/api/record"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      if (req.method === "GET") {
        return sendJson(res, 200, readRecord(workspace, runId, { kind: url.searchParams.get("kind"), id: url.searchParams.get("id") }));
      }
      if (req.method !== "POST") return sendJson(res, 405, { error: "GET or POST" });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The body is not JSON." });
          }
          return sendJson(res, 200, writeRecordFields(workspace, root, runId, body));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
