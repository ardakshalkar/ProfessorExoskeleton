/**
 * Routes: grade. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { runScans } from "../actions.js";
import { answerPage, gradeDocument, groupsStamp } from "../grade.js";
import { readBody, send, sendJson } from "../http.js";
import { loadedRun, rosterDir } from "../workspace.js";

export const routes = [
  /**
   * Grading a written exam, question by question — see server/grade.js. One
   * read, one picture, four writes.
   *
   * The writes spawn `ainar grade …`, as Scans spawns `ainar scans …`. One of
   * them, `decide`, writes a professor_decision: this is the pane's one
   * route that records a grade, and it does so only because the professor
   * pressed — a card, a group's Accept, or Accept all, which the CLI keeps
   * beside the decision as `decided_via`. A decision it replaces is kept in
   * the evaluation's history. Nothing here pushes a grade anywhere.
   */
  {
    paths: ["/api/grade"],
    prefixes: ["/api/grade/"],
    handle(c) {
      const { req, res, url, path, runId, view, workspace, root } = c;
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (!/^[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: assessmentId ? `${assessmentId} is not an assessment id.` : "No assessment given." });
      }
      let submissions;
      try {
        submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/grade") {
        try {
          return sendJson(
            res,
            200,
            gradeDocument({
              loaded: loadedRun(workspace, runId),
              runId,
              submissions,
              rosterDirectory: rosterDir(),
              assessmentId,
              names: url.searchParams.get("names") === "1",
            }),
          );
        } catch (error) {
          return sendJson(res, 200, { error: String(error?.message ?? error) });
        }
      }
      // When the grouping last changed. groups.yaml is private, so the course's
      // revision poll never sees the assistant rewrite it; the Grade view asks
      // this instead, and reloads when it moves.
      if (path === "/api/grade/stamp") {
        try {
          return sendJson(res, 200, { groups: groupsStamp({ submissions, runId, assessmentId }) });
        } catch (error) {
          return sendJson(res, 200, { error: String(error?.message ?? error) });
        }
      }
      if (path === "/api/grade/page") {
        try {
          const png = answerPage({
            submissions,
            runId,
            assessmentId,
            student: url.searchParams.get("student") ?? "",
            page: url.searchParams.get("page") ?? "1",
            names: url.searchParams.get("names") === "1",
          });
          return send(res, 200, "image/png", png);
        } catch (error) {
          return send(res, 404, "text/plain; charset=utf-8", String(error?.message ?? error));
        }
      }
      const WRITES = ["/api/grade/decide", "/api/grade/move", "/api/grade/choose", "/api/grade/accept-rubric", "/api/grade/points-only"];
      if (WRITES.includes(path)) {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        loadedRun(workspace, runId); // the run has to be this workspace's
        return readBody(req)
          .then((text) => {
            const body = text ? JSON.parse(text) : {};
            const sub = path.slice("/api/grade/".length);
            const args = ["grade", sub, runId, "--assessment", assessmentId];
            const itemId = (value) => {
              if (!/^ITEM-[A-Z0-9][A-Z0-9-]*$/.test(String(value))) throw new Error("Not a question id.");
              return String(value);
            };
            const pseudonym = (value) => {
              if (!/^STUDENT-[A-Z0-9]+$/.test(String(value))) throw new Error("Not a pseudonym.");
              return String(value);
            };
            const score = (value) => {
              const number = Number(value);
              if (!Number.isFinite(number) || number < 0 || number > 1000) throw new Error("Not a score.");
              return number;
            };
            if (sub === "decide") {
              const list = Array.isArray(body.decisions) ? body.decisions : [];
              if (!list.length || list.length > 2000) throw new Error("No marks given.");
              const decisions = list.map((entry) => ({
                student: pseudonym(entry.student),
                item: itemId(entry.item),
                score: score(entry.score),
                ...(entry.comment ? { comment: String(entry.comment).slice(0, 2000) } : {}),
              }));
              const via = ["one", "group", "all"].includes(body.via) ? body.via : "one";
              args.push("--decisions", JSON.stringify(decisions), "--via", via);
            } else if (sub === "choose") {
              if (!/^[A-Za-z0-9][\w-]{0,30}$/.test(String(body.proposal ?? ""))) throw new Error("Not a proposal id.");
              args.push("--proposal", String(body.proposal));
              if (Array.isArray(body.items) && body.items.length) args.push("--item", body.items.map(itemId).join(","));
              else if (body.item) args.push("--item", itemId(body.item));
              if (body.keepMarks === true) args.push("--keep-marks");
              if (body.accept === true) args.push("--accept");
            } else if (sub === "move") {
              args.push("--item", itemId(body.item));
              if (body.student) {
                args.push("--student", pseudonym(body.student));
                if (body.to === null || body.to === undefined) args.push("--ungroup");
                else args.push("--to", String(Math.trunc(score(body.to)) + 1));
              } else {
                args.push("--group", String(Math.trunc(score(body.group)) + 1));
                if (body.score === null || body.score === undefined) args.push("--unscored");
                else args.push("--score", String(score(body.score)));
              }
            }
            return runScans(args, root).then((result) => sendJson(res, 200, result));
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return sendJson(res, 200, { error: `no route ${path}` });
    },
  },
];
