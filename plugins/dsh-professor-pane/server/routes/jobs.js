/**
 * Routes: jobs (JOB-2, JOB-5, JOB-10). What the runner in server/jobs.js is
 * doing and has done, for this workspace: `GET /api/jobs?run=` lists them,
 * newest first; `GET /api/jobs/ID` is one, which a page asks after until it
 * is finished. Two presses act on one: `POST /api/jobs/ID/cancel` and
 * `POST /api/jobs/ID/continue` — the second starting the same kind again
 * through server/job-kinds.js, never anything the request names.
 *
 * `GET /api/jobs/token` hands the pane's page this harness's per-start
 * token, which every press that starts or stops work sends back; only a
 * request the browser marks same-origin gets it.
 */

import { sendJson } from "../http.js";
import { startKind } from "../job-kinds.js";
import { answerJob, cancelJob, continueJob, jobById, listJobs, notFromThePane, paneToken } from "../jobs.js";

export const routes = [
  {
    paths: ["/api/jobs", "/api/jobs/token"],
    prefixes: ["/api/jobs/"],
    handle(c) {
      const { req, res, path, runId, root } = c;
      if (path === "/api/jobs") return sendJson(res, 200, { jobs: listJobs(root, runId) });
      if (path === "/api/jobs/token") {
        // Stricter than a press: the browser must say same-origin, not merely not say otherwise.
        if (req.headers["sec-fetch-site"] !== "same-origin") return sendJson(res, 200, { error: "Only the pane's own page is given the token." });
        const why = notFromThePane(req, false);
        return sendJson(res, 200, why ? { error: why } : { token: paneToken() });
      }
      const [id, action] = path.slice("/api/jobs/".length).split("/");
      if (action) {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        const why = notFromThePane(req);
        if (why) return sendJson(res, 200, { error: why, token: true });
        if (action === "cancel") return sendJson(res, 200, cancelJob(root, id));
        if (action === "continue") {
          return continueJob(c, id, startKind)
            .then((started) => (started.error ? sendJson(res, 200, started) : answerJob(res, started)))
            .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
        }
        return sendJson(res, 200, { error: `no route ${path}` });
      }
      const job = jobById(root, id);
      return sendJson(res, 200, job ? { job } : { error: "No such job: it finished long ago, or its record was cleared." });
    },
  },
];
