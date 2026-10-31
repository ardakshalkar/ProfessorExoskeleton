/**
 * Routes: jobs (JOB-2). What the runner in server/jobs.js is doing and has
 * done, for this workspace: `GET /api/jobs?run=` lists them, newest first;
 * `GET /api/jobs/ID` is one, which a page asks after until it is finished.
 * Read only — a job is started by the press that needs it, never here.
 */

import { sendJson } from "../http.js";
import { jobById, listJobs } from "../jobs.js";

export const routes = [
  {
    paths: ["/api/jobs"],
    prefixes: ["/api/jobs/"],
    handle(c) {
      const { res, path, runId, root } = c;
      if (path === "/api/jobs") return sendJson(res, 200, { jobs: listJobs(root, runId) });
      const job = jobById(root, path.slice("/api/jobs/".length));
      return sendJson(res, 200, job ? { job } : { error: "No such job: it finished long ago, or the harness was restarted." });
    },
  },
];
