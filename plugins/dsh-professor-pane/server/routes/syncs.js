/**
 * Routes: syncs. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { readBody, sendJson } from "../http.js";
import {
  copyFromUpload,
  marksActivity,
  runSyncAction,
  sheetChecks,
  syncsDocument,
  UPLOAD_LIMIT as SHEET_UPLOAD_LIMIT,
} from "../syncs.js";
import { syncAll } from "../sync-all.js";

export const routes = [
  // The Syncs view: every road to a service outside the run, and the
  // matches waiting for the professor. Read here; every press is
  // `ainar sync …` — see server/syncs.js.
  {
    paths: ["/api/syncs"],
    handle(c) {
      const { res, url, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return sendJson(res, 200, syncsDocument(workspace, runId, { names: url.searchParams.get("names") === "1" }));
    },
  },
  // Whether each grade sheet changed in Google since its last sync. Reads
  // the sheet and Drive's last-changed time; writes nothing.
  {
    paths: ["/api/sheet-check"],
    handle(c) {
      const { res, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return sheetChecks(workspace, runId)
        .then((value) => sendJson(res, 200, value))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // What the grade sheets brought in, run by run: the pane's notice and the
  // Gradebook's "Last added". A read of the sync ledger on this machine.
  {
    paths: ["/api/marks-activity"],
    handle(c) {
      const { res, url, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(res, 200, marksActivity(workspace, runId, { names: url.searchParams.get("names") === "1" }));
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
  // POST only, for `/api/publish`'s reason: a run can reach Canvas or a
  // sheet, and a confirm writes the private link table.
  {
    paths: ["/api/syncs/action"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "a sync action is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await runSyncAction(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // Sync all across Canvas and the grade sheets: a preview, then one Send.
  // POST both ways — the preview asks Canvas and Google. See server/sync-all.js.
  {
    paths: ["/api/sync-all"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "Sync all is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await syncAll(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // A grade sheet the professor downloaded and dropped on its card. The one
  // write here that is not `ainar sync …`: it keeps the file as the run's
  // copy, and only after a `sync plan` has read it — see copyFromUpload.
  {
    paths: ["/api/syncs/copy"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "a sheet copy is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req, SHEET_UPLOAD_LIMIT)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await copyFromUpload(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
