/**
 * Routes: files. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { filesDocument, filesFolder } from "../files.js";
import { sendJson } from "../http.js";
import { loadedRun } from "../workspace.js";

export const routes = [
  // Files: the run's scans and recordings, where they live and how much
  // there is (GET), and that folder opened in the file manager (POST
  // /reveal). The folder is built here from the run and a checked id;
  // a path never comes from the request.
  {
    paths: ["/api/files","/api/files/reveal"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (assessmentId && !/^[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: `${assessmentId} is not an assessment id.` });
      }
      let submissions;
      try {
        submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/files") {
        try {
          return sendJson(res, 200, filesDocument({ bundle: loadedRun(workspace, runId).bundle, runId, submissions }));
        } catch (error) {
          return sendJson(res, 200, { error: String(error?.message ?? error) });
        }
      }
      if (req.method !== "POST") return sendJson(res, 405, { error: "reveal is POST only" });
      const folder = filesFolder(submissions, runId, assessmentId);
      if (!existsSync(folder)) return sendJson(res, 200, { error: "Nothing is stored for this yet, so there is no folder to open." });
      // The file manager of the machine this server runs on — which is the
      // professor's own only when the pane is served locally.
      const opener = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
      // explorer.exe exits 1 even when it opened the folder, so its exit is not the answer.
      execFile(opener, [folder], () => {});
      return sendJson(res, 200, { ok: true, folder });
    },
  },
];
