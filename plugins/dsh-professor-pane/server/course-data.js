/**
 * What course mode is drawn from, for one request: the outline payload with the
 * pane's material links and record paths on it, and for the reading asked for,
 * the private figures, each piece of work's status, and Planning's locks.
 *
 * One assembly for both ways course mode is drawn — the page the server renders
 * (`/view/course`, server/course-mode.js) and the JSON the React view renders
 * (`/api/course`, client/course/) — so the two cannot be fed differently.
 *
 * Everything here is computed on the host, the side of the wall where figures
 * may be made: the browser draws them and counts nothing.
 */

import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";

import { withMaterialLinks } from "./materials.js";
import { planLocks } from "./plan-writes.js";
import { assessmentStatus } from "./week-status.js";
import { loadedRun, viewPayload, withRecordPaths } from "./workspace.js";

export const COURSE_MODES = ["term", "planning", "teaching", "evidence"];

/**
 * @param c - the route's context: `req`, `url`, `runId`, `workspace`, `root`.
 * @returns `{ data, mode, student, dark, withDrafts, evidence, status, locks, graph, focus }`.
 */
export const courseModeData = ({ req, url, runId, workspace, root }) => {
  const withDrafts = url.searchParams.get("drafts") === "1";
  const dark = url.searchParams.get("dark") === "1";
  let data = viewPayload(workspace, "course_outline", runId, url.searchParams.get("date"), withDrafts).payload;
  const host = req.headers.host;
  data = withMaterialLinks(
    data,
    host ? `http://${host}` : "",
    url.searchParams.get("session") ?? "",
    workspace,
    dark,
    withDrafts,
  );
  const run = data?.run ?? {};
  if (run.course_id && run.term) {
    data = withRecordPaths(
      data,
      root,
      run.course_id,
      run.term,
      [
        ...(data.weeks ?? []).flatMap((week) => week.undated ?? []),
        ...(data.unplaced?.assessments ?? []),
      ],
    );
  }
  // Four readings of the same term. `planning` and `term` are structure
  // only. `teaching` adds class figures — a concept's class mean, what has
  // been handed in, the open signals — and `evidence` gives them for every
  // week, so those two alone read the private payloads, and only when
  // asked for by name.
  const mode = COURSE_MODES.includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : "term";
  let evidence = null;
  if (mode === "teaching") {
    const on = url.searchParams.get("date");
    const progress = viewPayload(workspace, "class_progress", runId, on, withDrafts).payload;
    const inbox = viewPayload(workspace, "action_inbox", runId, on, withDrafts).payload;
    const concepts = {};
    for (const c of progress.concepts ?? []) {
      concepts[c.concept_id] = { class_mean: c.class_mean ?? null, coverage: c.coverage ?? null };
    }
    const handedIn = {};
    for (const a of inbox.assessments ?? []) {
      handedIn[a.assessment_id] = { enrolled: a.enrolled ?? null, received: a.submissions_received ?? null };
    }
    // The signal's sentence and nothing that names a student: this text is
    // drawn, and a pseudonym is the most a page in this pane carries.
    const signals = (inbox.open_signals ?? []).map((s) => ({ description: s.description ?? "" }));
    evidence = { concepts, handed_in: handedIn, signals };
  }
  // How each week went, from approved evidence only — drafts are never
  // asked for here, whatever the toggle says. Figures are the payloads'
  // own, copied by id; grouping them under weeks is the page's, and no
  // mean, sum or share is made here. Class-level signals only: one about
  // a single student is not an aggregate, and this page names nobody.
  if (mode === "evidence") {
    const on = url.searchParams.get("date");
    const progress = viewPayload(workspace, "class_progress", runId, on, false).payload;
    const book = viewPayload(workspace, "gradebook", runId, on, false).payload;
    const inbox = viewPayload(workspace, "action_inbox", runId, on, false).payload;
    const concepts = {};
    for (const c of progress.concepts ?? []) {
      concepts[c.concept_id] = { class_mean: c.class_mean ?? null, coverage: c.coverage ?? null };
    }
    const work = {};
    for (const a of book.assessments ?? []) {
      const s = a.summary ?? {};
      work[a.assessment_id] = {
        maximum: a.maximum ?? null,
        enrolled: s.enrolled ?? null,
        submitted: s.submitted ?? null,
        not_submitted: s.not_submitted ?? null,
        graded: s.graded ?? null,
        partially_graded: s.partially_graded ?? null,
        mean: s.mean ?? null,
        median: s.median ?? null,
      };
    }
    const signals = (inbox.open_signals ?? [])
      .filter((s) => !s.student_id)
      .map((s) => ({ description: s.description ?? "", severity: s.severity ?? null, concepts: s.concepts ?? [] }));
    evidence = { concepts, work, signals };
  }
  // Where each piece of graded work stands — grading, Canvas, a pile, the
  // defences — for its chip: Teaching and All weeks, never the student
  // preview. Read with drafts included, as the windows it opens read it.
  const student = mode !== "teaching" && mode !== "evidence" && url.searchParams.get("student") === "1";
  let status = null;
  if (mode !== "planning" && !student) {
    try {
      let submissions = null;
      try {
        submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
      } catch {
        submissions = null;
      }
      status = assessmentStatus({
        bundle: loadedRun(workspace, runId).bundle,
        runId,
        root,
        submissions,
        ledger: Ledger.load(runId),
      });
    } catch {
      status = null;
    }
  }
  // Planning's guardrail on work with results: which work, never whose —
  // the page says only that it is locked. The taught weeks the page reads
  // off the outline's own `when`. `plan-writes.js` enforces both on every
  // write.
  let locks = null;
  // Planning's concept map: each concept's prerequisites and related concepts,
  // by id, so a topic's concepts can be drawn against the topics they lean on
  // and the ones that lean on them. The outline names a module's concepts but
  // not their edges, and its payload is held to the Python engine's fixtures.
  let graph = null;
  if (mode === "planning") {
    try {
      const bundle = loadedRun(workspace, runId).bundle;
      locks = { results: [...planLocks(bundle, runId).results] };
      graph = {};
      for (const c of bundle.concepts ?? []) {
        if (withDrafts || c.approval !== "draft") {
          graph[c.concept_id] = { title: c.title ?? null, prerequisites: c.prerequisites ?? [], related: c.related ?? [] };
        }
      }
    } catch {
      locks = null;
      graph = null;
    }
  }
  // The week Teaching was last stepped to, kept by course mode.
  const focus = /^\d{1,2}$/.test(url.searchParams.get("week") ?? "") ? Number(url.searchParams.get("week")) : null;
  return { data, mode, student, dark, withDrafts, evidence, status, locks, graph, focus };
};
