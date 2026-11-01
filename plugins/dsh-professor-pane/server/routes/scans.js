/**
 * Routes: scans. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { readBody, send, sendJson } from "../http.js";
import { startKind } from "../job-kinds.js";
import { answerJob, notFromThePane } from "../jobs.js";
import { paperCrop, scansDocument } from "../scans.js";
import { loadedRun, rosterDir } from "../workspace.js";

export const routes = [
  {
    paths: ["/api/scans"],
    prefixes: ["/api/scans/"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root, harness } = c;
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
      if (path === "/api/scans") {
        return sendJson(
          res,
          200,
          scansDocument({
            loaded: loadedRun(workspace, runId),
            runId,
            submissions,
            root,
            rosterDirectory: rosterDir(),
            assessmentId,
            names: url.searchParams.get("names") === "1",
          }),
        );
      }
      if (path === "/api/scans/crop") {
        try {
          const png = paperCrop({
            submissions,
            runId,
            assessmentId,
            file: url.searchParams.get("file") ?? "",
            pages: url.searchParams.get("pages") ?? "",
            whole: url.searchParams.has("whole") ? Number(url.searchParams.get("whole")) : null,
          });
          return send(res, 200, "image/png", png);
        } catch (error) {
          return send(res, 404, "text/plain; charset=utf-8", String(error?.message ?? error));
        }
      }
      // Reading and recording the answers involve no judgement: `scans read`
      // then `scans record`, run here rather than asked of the assistant. Here
      // they run in the harness's process, which can write the private
      // folder; the assistant's sandbox cannot, and would ask for each call.
      // A pile takes minutes, so it is a background job (server/job-kinds.js):
      // the press is answered at once and the page follows the job.
      // A press that starts work: from the pane's page only (JOB-10), and
      // only as a kind in server/job-kinds.js, which checks what it is sent.
      if (path === "/api/scans/read" || path === "/api/scans/assign" || path === "/api/scans/apply") {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        const why = notFromThePane(req);
        if (why) return sendJson(res, 200, { error: why, token: true });
        if (!assessmentId) return sendJson(res, 200, { error: "No assessment given." });
        if (path === "/api/scans/read") return answerJob(res, startKind(c, "scans-read", { assessmentId }));
        return readBody(req)
          .then((text) => {
            const body = text ? JSON.parse(text) : {};
            // One answer, or `papers: [...]` from the review's Confirm — sent
            // to the CLI as one list, so it is checked whole and applied once.
            // Pressed while the pile is being read, either is queued behind
            // the read and answered with the job (JOB-8).
            return path.endsWith("assign")
              ? answerJob(res, startKind(c, "scans-assign", { assessmentId, papers: Array.isArray(body.papers) ? body.papers : [body] }))
              : answerJob(res, startKind(c, "scans-apply", { assessmentId }));
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return sendJson(res, 200, { error: `no route ${path}` });
    },
  },
];
