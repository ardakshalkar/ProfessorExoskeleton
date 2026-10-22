/**
 * Routes: canvas. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { canvasCheckState, runAssignmentPush, runCanvasCheck, runMarksPush } from "../actions.js";
import { canvasDifferences, canvasResolve, canvasSyncAll } from "../canvas-sync.js";
import { canvasAssignmentList, canvasCourseList } from "../connections.js";
import { readBody, sendJson } from "../http.js";
import {
  canvasSettings,
  integrationsAnswer,
  integrationsDocument,
  resolveCredential,
} from "../integrations.js";
import {
  canvasCatalogue,
  recordAssessmentLinks,
  writeCanvasCourses,
  writeCanvasSelection,
} from "../lms-writes.js";

export const routes = [
  /**
   * The professor's own Canvas courses, so a subgroup is bound by name.
   *
   * POST for `canvasCatalogue`'s reason: it spends the professor's API quota
   * and sends their token, so it happens when they press for it and never
   * because a URL was visited.
   */
  {
    paths: ["/api/canvas/courses"],
    handle(c) {
      const { req, res, runId, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas courses is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, {
          error: "No Canvas host is configured yet. Set one up above first.",
        });
      }
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then(async (token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Paste one into the ${settings.tokenEnv} field first.`,
            });
          }
          return sendJson(res, 200, { courses: await canvasCourseList(settings.host, usable) });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * The assignments of one Canvas course, for the binder below.
   *
   * Takes the course id rather than deriving it: with a Canvas course per
   * subgroup there are several, and the caller is binding one subgroup at a
   * time. POST for `canvasCatalogue`'s reason — it spends the professor's
   * quota and sends their token.
   */
  {
    paths: ["/api/canvas/assignments"],
    handle(c) {
      const { req, res, runId, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas assignments is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, { error: "No Canvas host is configured yet." });
      }
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          const courseId = String(body.courseId ?? "").trim();
          if (!/^[0-9]+$/.test(courseId)) {
            return sendJson(res, 200, { error: "A numeric Canvas course id is needed." });
          }
          const token = await resolveCredential(credentials.service, settings.tokenEnv);
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Set ${settings.tokenEnv} first.`,
            });
          }
          return sendJson(res, 200, {
            courseId,
            assignments: await canvasAssignmentList(settings.host, usable, courseId),
          });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * Bind assessments to Canvas assignments.
   *
   * The body is `{links: {ASSESSMENT-01: "90218" | {CS-401: "90218"}}}` —
   * a string for a run that is one Canvas course, a mapping for one that is
   * several. An entry set to null clears the linkage.
   *
   * Writes into the assessment records, which is the one place in this pane
   * that edits a machine-managed record file. `recordAssessmentLinks` states
   * why that is defensible; the short version is that a Canvas id is a
   * pointer, not a decision.
   */
  {
    paths: ["/api/canvas/assignment-map"],
    handle(c) {
      const { req, res, runId, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the assignment mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = recordAssessmentLinks(workspace, root, runId, body.links);
          if (result.error) return sendJson(res, 200, result);
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * Bind each subgroup to its Canvas course.
   *
   * Writes `extensions.lms.canvas_courses` into the run record, which is
   * what `ainar lms push --group` reads. Unlike `canvas_sections` beside it,
   * this mapping is not decorative: with it set, a push refuses to run
   * without `--group` and carries only that subgroup's students.
   */
  {
    paths: ["/api/canvas/course-map"],
    handle(c) {
      const { req, res, runId, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the subgroup mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = writeCanvasCourses(workspace, root, runId, body.mapping);
          if (result.error) return sendJson(res, 200, result);

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // The live Canvas read, and the one outbound request in this plugin. POST
  // for `canvasCatalogue`'s reason: it spends the professor's API quota and
  // sends their token, so it happens when they press for it and never
  // because a URL was visited.
  {
    paths: ["/api/canvas/catalogue"],
    handle(c) {
      const { req, res, runId, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas catalogue is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const document = integrationsDocument(workspace, root, runId);
      const settings = canvasSettings();
      // Every precondition named separately, because "it did not work" is the
      // one answer this tab must never give: each of these is a different file
      // to go and edit.
      if (!document.canvasCourse.usable) {
        return sendJson(res, 200, {
          error: document.canvasCourse.fromColumn
            ? `This run's Canvas course is recorded as ${document.canvasCourse.fromColumn}, ` +
              "which is a handle rather than the numeric id the API takes. The number is in " +
              "the Canvas course URL; record it as `extensions.lms.canvas_course_id`."
            : "This run has no Canvas course id. It goes on the run record as " +
              "`extensions.lms.canvas_course_id`, and the number is in the Canvas course URL.",
        });
      }
      if (!settings.host) {
        return sendJson(res, 200, {
          error:
            "No Canvas host is configured. Either export AINAR_CANVAS_URL, or write " +
            `${settings.configPath} with a [canvas] table naming base_url.`,
        });
      }
      // Through the seam first, then what this process can see for itself.
      // `canvasSettings` reads `process.env`, which is only one of the two
      // layers a token can now live in — without this, a token the professor
      // had just saved in the field below would be reported missing by the
      // button beside it.
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then((token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error:
                `No Canvas token. Paste one into the ${settings.tokenEnv} field above, or ` +
                `export ${settings.tokenEnv} in your shell. Canvas → Account → Settings → ` +
                "New Access Token. It can change grades, so keep it out of the repository.",
            });
          }
          return canvasCatalogue(document.canvasCourse.id, settings.host, usable).then((result) =>
            sendJson(res, 200, result),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // The save. POST for `/api/publish`'s reason and one more of its own: this
  // is the only route in the pane that writes to `courses/`.
  {
    paths: ["/api/canvas/assignment"],
    handle(c) {
      const { req, res, runId, root } = c;
      // POST only, for `/api/publish`'s reason: this one reaches outside the
      // machine, and with `--confirm` it changes what a class can see.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "assignment is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(res, 200, { error: "The request body must be an object." });
          }
          return runAssignmentPush(res, root, runId, body);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // The marks. POST only: a plan makes Canvas answer, and a push changes what
  // every student in the class sees.
  {
    paths: ["/api/canvas/marks"],
    handle(c) {
      const { req, res, runId, workspace, root } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "marks are POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await runMarksPush(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // What Canvas holds for the whole run. GET answers from the last check on
  // this server at once; POST runs a check (reads Canvas, notes in the
  // ledger what Canvas already holds) and answers when it is done.
  {
    paths: ["/api/canvas/check"],
    handle(c) {
      const { req, res, runId, root } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      if (req.method === "GET") return sendJson(res, 200, canvasCheckState(runId));
      if (req.method !== "POST") return sendJson(res, 405, { error: "GET the last check, or POST to run one" });
      return runCanvasCheck(root, runId)
        .then((state) => sendJson(res, 200, state))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // Where the run and Canvas differ, from the last check: a read of this
  // server's memory, so GET.
  {
    paths: ["/api/canvas/differences"],
    handle(c) {
      const { res, url, runId } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return sendJson(res, 200, canvasDifferences(runId, { names: url.searchParams.get("names") === "1" }));
    },
  },
  // Sync all: POST for `/api/canvas/marks`' reason — the preview asks Canvas,
  // and the send changes what students see.
  {
    paths: ["/api/canvas/sync-all"],
    handle(c) {
      const { req, res, runId, root } = c;
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
          return sendJson(res, 200, await canvasSyncAll(root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // One difference settled: keep AINAR's (a send) or Canvas's (a note here).
  {
    paths: ["/api/canvas/resolve"],
    handle(c) {
      const { req, res, runId, root } = c;
      if (req.method !== "POST") return sendJson(res, 405, { error: "settling a difference is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await canvasResolve(root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  {
    paths: ["/api/canvas/selection"],
    handle(c) {
      const { req, res, runId, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas selection is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The selection body is not JSON." });
          }
          const result = writeCanvasSelection(workspace, root, runId, body.selections);
          if (result.error) return sendJson(res, 200, result);
          // The record as it now is, in the same response, for
          // `/api/preferences`' reason: the form is drawn from this, so
          // re-reading here is what makes a Save show the file rather than the
          // browser's memory of what was ticked.
          // The whole answer travels with every redraw, or saving a selection
          // would blank the credential and status blocks the browser half
          // draws from it.
          return integrationsAnswer(workspace, root, runId, credentials, { saved: result }).then(
            (answer) => sendJson(res, 200, answer),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
