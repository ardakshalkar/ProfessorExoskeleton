/**
 * Routes: exam reports — making them, sending them, and serving the PDFs to
 * the overlay. See ainar-node/src/exam-report.ts.
 *
 * Making spawns `ainar report exam`, sending `ainar lms send-reports`, as the
 * other writes spawn the CLI. Sending is two presses: the first asks for the
 * plan (`confirm` false) and the browser half shows it; only the second, with
 * `confirm` true, reaches Canvas. The PDFs are served from the private folder
 * outside the workspace; a report names a student, and it reaches the
 * professor's own browser on a loopback port and nowhere else.
 */

import { existsSync, readFileSync } from "node:fs";

import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { reportPlace, reportsDir } from "@ainar/core/src/report-place.ts";

import { runScans } from "../actions.js";
import { readBody, send, sendJson } from "../http.js";
import { loadedRun } from "../workspace.js";

const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const STUDENT = /^STUDENT-[A-Z0-9][A-Z0-9-]*$/;

export const routes = [
  {
    paths: ["/api/reports/make", "/api/reports/send", "/api/reports/file"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root } = c;
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (!ID.test(runId) || !ID.test(assessmentId)) return sendJson(res, 200, { error: "Not a run or an assessment id." });
      const base = reportsDir(null);
      try {
        refuseInsideRepo(base, root);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      const place = reportPlace(base, runId, assessmentId);

      if (path === "/api/reports/file") {
        const who = url.searchParams.get("student") ?? "class";
        if (who !== "class" && !STUDENT.test(who)) return send(res, 404, "text/plain; charset=utf-8", "not a pseudonym");
        const file = who === "class" ? place.classPdf : place.studentPdf(who);
        if (!existsSync(file)) return send(res, 404, "text/plain; charset=utf-8", "no report yet — make the reports first");
        return send(res, 200, "application/pdf", readFileSync(file));
      }

      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      loadedRun(workspace, runId); // the run has to be this workspace's
      return readBody(req, 64 * 1024)
        .then((text) => {
          const body = text ? JSON.parse(text) : {};
          const students = (Array.isArray(body.students) ? body.students : []).map(String);
          if (students.some((id) => !STUDENT.test(id))) throw new Error("Not a pseudonym.");
          const only = students.length ? ["--student", students.join(",")] : [];
          if (path === "/api/reports/make") {
            // A class of sixty is about a minute of LibreOffice.
            return runScans(["report", "exam", runId, "--assessment", assessmentId, ...only], root, 15 * 60 * 1000);
          }
          return runScans(
            ["lms", "send-reports", runId, "--assessment", assessmentId, ...only, ...(body.again === true ? ["--again"] : []), ...(body.confirm === true ? ["--confirm"] : [])],
            root,
            15 * 60 * 1000,
          );
        })
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
