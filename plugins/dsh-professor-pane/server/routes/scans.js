/**
 * Routes: scans. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { runScans } from "../actions.js";
import { readBody, send, sendJson } from "../http.js";
import { assessmentOf, KINDS } from "../job-kinds.js";
import { answerJob, pileKey, recordsKey, startJob } from "../jobs.js";
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
      if (path === "/api/scans/read") {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        if (!assessmentId) return sendJson(res, 200, { error: "No assessment given." });
        return answerJob(res, KINDS["scans-read"](c, { assessmentId }));
      }
      if (path === "/api/scans/assign" || path === "/api/scans/apply") {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        if (!assessmentId) return sendJson(res, 200, { error: "No assessment given." });
        const pile = assessmentOf(workspace, runId, assessmentId); // the run has to be this workspace's
        return readBody(req)
          .then((text) => {
            const body = text ? JSON.parse(text) : {};
            const args = ["scans", path.endsWith("assign") ? "assign" : "apply", runId, "--assessment", assessmentId];
            if (path.endsWith("assign")) {
              // One answer, or `papers: [...]` from the review's Confirm — sent
              // to the CLI as one list, so it is checked whole and applied once.
              const answers = (Array.isArray(body.papers) ? body.papers : [body]).map((entry) => {
                const pages = String(entry.pages ?? "");
                if (!/^[\d ,-]{1,40}$/.test(pages)) throw new Error("No paper given.");
                const answer = { pages };
                if (entry.file) {
                  if (!/^[\w.-]+\.pdf$/i.test(String(entry.file))) throw new Error("Not a scan's file name.");
                  answer.file = String(entry.file);
                }
                const pseudonym = (value) => {
                  if (!/^STUDENT-[A-Z0-9]+$/.test(String(value))) throw new Error("Not a pseudonym.");
                  return String(value);
                };
                if (entry.student) answer.student = pseudonym(entry.student);
                else if (entry.reject) answer.reject = pseudonym(entry.reject);
                else if (entry.skip) answer.skip = String(entry.skip).slice(0, 200);
                else throw new Error("Say who the paper is, who it is not, or that it is nobody's.");
                return answer;
              });
              if (!answers.length || answers.length > 500) throw new Error("No papers given.");
              args.push("--assignments", JSON.stringify(answers));
            }
            // Short, so inline: it waits for another placement's second on the
            // course's records. Pressed while the pile is being read, it is
            // queued behind the read and answered with the job (JOB-8).
            return answerJob(
              res,
              startJob({
                root,
                runId,
                kind: path.endsWith("assign") ? "scans-assign" : "scans-apply",
                label: `Placing papers on ${pile.title}`,
                subject: assessmentId,
                keys: [
                  pileKey(runId, assessmentId),
                  recordsKey(pile.courseId, "submissions"),
                  recordsKey(pile.courseId, "item_responses"),
                ],
                work: () => runScans(args, root),
              }),
            );
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return sendJson(res, 200, { error: `no route ${path}` });
    },
  },
];
