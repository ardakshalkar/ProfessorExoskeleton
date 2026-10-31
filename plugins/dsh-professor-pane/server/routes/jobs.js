/**
 * Routes: jobs (JOB-2, JOB-5). What the runner in server/jobs.js is doing
 * and has done, for this workspace: `GET /api/jobs?run=` lists them, newest
 * first; `GET /api/jobs/ID` is one, which a page asks after until it is
 * finished. Two presses act on one: `POST /api/jobs/ID/cancel` and
 * `POST /api/jobs/ID/continue` — the second starting the same kind again
 * from server/job-kinds.js, never anything the request names.
 */

import { sendJson } from "../http.js";
import { KINDS } from "../job-kinds.js";
import { answerJob, cancelJob, continueJob, jobById, listJobs } from "../jobs.js";

export const routes = [
  {
    paths: ["/api/jobs"],
    prefixes: ["/api/jobs/"],
    handle(c) {
      const { req, res, path, runId, root } = c;
      if (path === "/api/jobs") return sendJson(res, 200, { jobs: listJobs(root, runId) });
      const [id, action] = path.slice("/api/jobs/".length).split("/");
      if (action) {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        if (action === "cancel") return sendJson(res, 200, cancelJob(root, id));
        if (action === "continue") {
          return continueJob(c, id, KINDS)
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
