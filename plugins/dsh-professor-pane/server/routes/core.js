/**
 * Routes: core. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { sendJson } from "../http.js";
import { recentDocument } from "../inspector.js";
import { navigatorDocument } from "../navigator.js";
import { todayDocument } from "../today.js";
import { cellEvidence, conceptsGrid } from "../concepts-grid.js";
import { unpublishedDocument } from "../unpublished.js";
import { checkUpload, receiveFile, storeUpload, uploadFolder } from "../upload.js";
import { loadedRun, revisionDocument, runsDocument } from "../workspace.js";

export const routes = [
  {
    paths: ["/api/runs"],
    handle(c) {
      const { res, workspace, root } = c;
      return sendJson(res, 200, runsDocument(workspace, root));
    },
  },
  {
    paths: ["/api/revision"],
    handle(c) {
      const { res, url, root } = c;
      return sendJson(res, 200, revisionDocument(root, url.searchParams.get("fresh") === "1"));
    },
  },
  // The left sidebar's course block: the run, this week, the counts on its
  // places. See server/navigator.js for which half each figure is read over.
  {
    paths: ["/api/navigator"],
    handle(c) {
      const { res, url, runId, workspace, root } = c;
      return sendJson(res, 200, navigatorDocument(workspace, root, runId, url.searchParams.get("week")));
    },
  },
  // Today, the landing: Now, Waiting and Pulse. See server/today.js.
  {
    paths: ["/api/today"],
    handle(c) {
      const { res, runId, workspace, root } = c;
      return sendJson(res, 200, todayDocument(workspace, root, runId));
    },
  },
  // The Concepts place: concept × student, and the evidence behind a cell.
  // Names only when asked for, as the class list; see server/concepts-grid.js.
  {
    paths: ["/api/concepts-grid", "/api/concepts-grid/cell"],
    handle(c) {
      const { res, url, runId, workspace } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const drafts = url.searchParams.get("drafts") === "1";
      try {
        if (url.pathname.endsWith("/cell")) {
          const student = String(url.searchParams.get("student") || "");
          const concept = String(url.searchParams.get("concept") || "");
          if (!/^STUDENT-[A-Z0-9]+$/.test(student) || !/^[A-Z0-9][A-Z0-9-]*$/.test(concept)) {
            return sendJson(res, 200, { error: "Which student and which concept?" });
          }
          return sendJson(res, 200, cellEvidence(workspace, runId, student, concept, { drafts }));
        }
        return sendJson(res, 200, conceptsGrid(workspace, runId, { names: url.searchParams.get("names") === "1", drafts }));
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
  // The right column's recent changes and draft count; see server/inspector.js.
  {
    paths: ["/api/recent"],
    handle(c) {
      const { res, root } = c;
      return sendJson(res, 200, recentDocument(root));
    },
  },
  /**
   * One file, as the raw request body: `?run=&kind=scans|paper&name=`.
   *
   * Raw rather than multipart, one file a request, because the browser half
   * sends a `File` as it is and a multipart parser is a dependency this
   * plugin would otherwise not have. The destination is never the caller's:
   * `kind` picks one of two folders under the private submissions directory,
   * and `name` is only ever the original filename, reduced to a safe one (a
   * scan's is replaced outright — see server/upload.js for why).
   *
   * The run has to be one this workspace has, so a request cannot make a
   * folder for a course run nobody opened. The answer is where the file is,
   * which the browser half then puts in a message to the agent.
   */
  {
    paths: ["/api/upload"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "An upload is a POST." });
      const kind = url.searchParams.get("kind") ?? "";
      const original = url.searchParams.get("name") ?? "";
      const refused = checkUpload(kind, original);
      if (refused) return sendJson(res, 200, { error: refused });
      const known = (runsDocument(workspace, root).courses ?? []).some((course) =>
        (course.runs ?? []).some((run) => run.run_id === runId),
      );
      if (!known) return sendJson(res, 200, { error: `This workspace has no course run ${runId || "(none given)"}.` });
      let folder;
      try {
        const submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
        folder = uploadFolder(submissions, runId, kind);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return receiveFile(req, folder)
        .then((received) =>
          sendJson(res, 200, {
            ok: true,
            kind,
            run: runId,
            folder,
            ...storeUpload({ kind, folder, original, received, now: new Date().toISOString() }),
          }),
        )
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * Paper exams — see server/scans.js. One read, one picture, two writes.
   *
   * The writes spawn the CLI, as Publish does: `scans assign` says who one
   * paper is (taking back a wrong placement first), then places it by the
   * same rules `scans apply` places every paper. None of them is an approval
   * path — a paper handed in is a fact, its answers stay `approval: draft`,
   * and a placement with an evaluation on it is refused, not undone.
   */
  /**
   * What is not out yet — see server/unpublished.js. A read of local files
   * only: the gradebook, the sync ledger, the record's drafts and the
   * checksums of what was last published. Canvas is not asked.
   */
  {
    paths: ["/api/unpublished"],
    handle(c) {
      const { res, runId, workspace, root } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(
          res,
          200,
          unpublishedDocument({ bundle: loadedRun(workspace, runId).bundle, runId, root, ledger: Ledger.load(runId) }),
        );
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    },
  },
];
