/**
 * Routes: views. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { BY_TOOL } from "@ainar/core/src/tools/widgets.ts";
import { checklistDocument, readyDocument } from "../checklist.js";
import { courseModeData } from "../course-data.js";
import { courseModeDocument } from "../course-mode.js";
import {
  assessmentsDocument,
  examsDocument,
  gradingDocument,
  slidesDocument,
} from "../course-views.js";
import { defenceReader, forksReader } from "../defence-desk.js";
import { send, sendErrorPage } from "../http.js";
import { withMaterialLinks } from "../materials.js";
import { widgetDocument } from "../page.js";
import { scanStandings } from "../scans.js";
import { studentsDocument } from "../students.js";
import {
  payload,
  rosterDir,
  viewPayload,
  VIEWS,
  withRecordPaths,
  withStudentNames,
} from "../workspace.js";

export const routes = [
  // The two views with no widget behind them. Checked before the widget
  // lookup because `BY_TOOL` has nothing to give them: their content is
  // assembled here, from the run record and from the work directory.
  {
    views: ["assessments","slides","exams"],
    handle(c) {
      const { req, res, url, runId, view, workspace, root } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      const withDrafts = url.searchParams.get("drafts") === "1";
      const on = url.searchParams.get("date");
      const host = req.headers.host;
      const session = url.searchParams.get("session") ?? "";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "assessments"
          ? assessmentsDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              on,
              host ? `http://${host}` : "",
              session,
            )
          : view === "slides"
            ? slidesDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              )
            : examsDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              ),
      );
    },
  },
  // The class list. No drafts toggle: enrollments are not agent-writable
  // and carry no approval, so there is never a drafted half of this view, and a
  // toggle that changed nothing would suggest otherwise.
  {
    views: ["students"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        studentsDocument(
          workspace,
          runId,
          url.searchParams.get("dark") === "1",
          // Opt-in per request. The pane asks for names only when the professor
          // has pressed for them, so a route replayed from a log or a history
          // entry without the parameter renders pseudonyms.
          url.searchParams.get("names") === "1",
          req.headers.host ? `http://${req.headers.host}` : "",
          url.searchParams.get("session") ?? "",
          defenceReader(root, runId),
          forksReader(root, runId),
          (bundle) => scanStandings(bundle, runId, root, rosterDir()),
        ),
      );
    },
  },
  // The Checklist. No drafts toggle, for `ready`'s reason and one more of its
  // own: this view IS the record-against-drafts comparison — every row says
  // which half a thing is in — so a setting that removed one half would
  // remove the answer rather than narrow it.
  {
    views: ["checklist"],
    handle(c) {
      const { res, url, runId, workspace, root } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        checklistDocument(workspace, root, runId, url.searchParams.get("dark") === "1"),
      );
    },
  },
  {
    views: ["grading","ready"],
    handle(c) {
      const { res, url, runId, view, workspace, root } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      // `grading` honours the drafts toggle, because a drafted assessment
      // carries a weight and changes the scheme. `ready` does not take it:
      // it lists the drafts whatever the toggle says — that IS the drafted
      // half, and a "Record" setting that emptied it would be answering a
      // question nobody asked.
      const withDrafts = url.searchParams.get("drafts") === "1";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "grading"
          ? gradingDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              url.searchParams.get("date"),
            )
          : readyDocument(workspace, root, runId, dark),
      );
    },
  },
  // Course mode: the term plan as a page, over the harness. The outline
  // payload exactly as the Weeks tab gets it — same drafts rule, same
  // material links, same record paths — drawn by the pane in three columns
  // rather than by the one-column widget. See `server/course-mode.js`.
  {
    views: ["course"],
    handle(c) {
      const { res, runId } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const { data, mode, student, dark, withDrafts, evidence, status, locks, focus } = courseModeData(c);
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        courseModeDocument(data, { dark, student, mode, evidence, status, locks, focus }),
      );
    },
  },
  {
    widgets: true,
    handle(c) {
      const { req, res, url, runId, view, workspace, root } = c;
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const tool = VIEWS[view].tool;
      const widget = BY_TOOL.get(tool);
      if (!widget) return sendErrorPage(res, `no widget is bound to ${tool}`);
      // `drafts=1` is the whole course, drafts included; without it the view
      // is what has been accepted. The header says which, because the document
      // is a widget shared with two other hosts and has no place to print it;
      // the pane reads the header and says so in its own chrome.
      const withDrafts = url.searchParams.get("drafts") === "1";
      // The four views with an accepted-only form go through `viewPayload`; any
      // other tool has only the one answer, over the whole course.
      const filtered = ["course_outline", "class_progress", "gradebook", "action_inbox"].includes(tool);
      let data = filtered
        ? viewPayload(workspace, tool, runId, url.searchParams.get("date"), withDrafts).payload
        : payload(workspace, tool, { course_version_id: runId });
      const noted = [];
      // Only the outline carries resources; the other views have none to link.
      if (view === "outline") {
        const host = req.headers.host;
        data = withMaterialLinks(
          data,
          host ? `http://${host}` : "",
          url.searchParams.get("session") ?? "",
          workspace,
          url.searchParams.get("dark") === "1",
          withDrafts,
        );
        const run = data?.run ?? {};
        if (run.course_id && run.term) {
          data = withRecordPaths(
            data,
            root,
            run.course_id,
            run.term,
            (data.weeks ?? []).flatMap((week) => week.undated ?? []),
          );
        }
        // The week view is the weeks. Assessments and the grading policy are
        // two tabs of their own now, and rendering them here as well put a
        // table and a policy note between the professor and what they opened
        // this tab for. The widget keeps both by default — a chat client has no
        // tabs to move them to — so the pane has to ask.
        //
        // `gaps` is the one asked for rather than kept, and the asymmetry is
        // deliberate: every other section defaults to shown, while the gaps
        // default to hidden because the surface that says nothing is `ainar
        // page`. This is a professor's view, so it asks.
        data = {
          ...data,
          sections: { assessments: false, grading: false, header: false, gaps: true },
        };
      }
      if (view === "tasks") {
        // Where each dateless assessment lives, so the widget's "set dates"
        // button can name the record instead of a directory. The inbox payload
        // carries no `course_id` — only the run's own id and term — so the
        // course is read off the bundle rather than parsed out of the run id,
        // which is a convention and not a guarantee.
        let courseId = null;
        try {
          courseId = workspace.findRun(runId)?.course?.course_id ?? null;
        } catch {
          // The payload built, so the run is real; without the bundle the
          // prompt falls back to telling the model to grep for the id.
          courseId = null;
        }
        const term = data?.run?.term ?? null;
        if (courseId && term) {
          data = withRecordPaths(
            data,
            root,
            courseId,
            term,
            (data.assessments ?? []).filter((row) => !row.due_at),
          );
        }
        // Names on the inbox, and nowhere else a widget is served. Opt-in per
        // request exactly as the class list is, so a URL replayed without the
        // parameter renders pseudonyms.
        if (url.searchParams.get("names") === "1") data = withStudentNames(data);
      }
      const dark = url.searchParams.get("dark") === "1";
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      if (noted.length) {
        res.setHeader(
          "x-professor-pane-draft-issues",
          // One header line, so it survives a header value's own rules: no
          // newlines, and nothing outside Latin-1. A code and a location are
          // both identifiers, and the message is dropped rather than mangled.
          encodeURIComponent(
            noted
              .map((issue) => `${issue.level}:${issue.code}${issue.location ? " " + issue.location : ""}`)
              .join(" | "),
          ),
        );
      }
      return send(res, 200, "text/html; charset=utf-8", widgetDocument(widget, data, dark));
    },
  },
];
