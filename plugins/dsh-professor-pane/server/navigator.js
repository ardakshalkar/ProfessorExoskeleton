/**
 * The course navigator's one read: what the left sidebar says about a course.
 *
 * The sidebar is the professor's "where am I" — which course, which week, what
 * is waiting — and it is drawn on every screen, so this is deliberately small:
 * the run the navigator stands on, the current week as the outline payload
 * already has it, the next week anything falls due in, two counts that
 * payloads already carry, and each scan pile's held papers as the Scans tab
 * counts them. No figure is computed here that another document did not
 * already hold; the navigator picks fields, it does not add them up.
 *
 * Which halves:
 *
 * * The week and the gaps are read over the RECORD — what a student may be
 *   shown — because "this week has no deck" is a fact about the course as
 *   accepted, and the Weeks place opens on the record too.
 * * The grading count is read over the whole course, drafts included, because
 *   what waits for the professor's judgement is exactly the suggested half:
 *   over the record it is always zero.
 */

import { scanStandings } from "./scans.js";
import { loadedRun, runsDocument, viewPayload } from "./workspace.js";

/** Today in the machine's calendar, as the ISO date the run's dates are. */
const today = () => {
  const now = new Date();
  return (
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0")
  );
};

/**
 * The run to stand on: the one asked for, else the one under way today, else
 * the first. A workspace usually holds one run; the rule only matters when it
 * holds a finished one beside a running one, and then today's is the answer.
 */
const pickRun = (courses, asked) => {
  const all = [];
  for (const course of courses) {
    for (const run of course.runs) all.push({ course, run });
  }
  if (!all.length) return null;
  const date = today();
  return (
    all.find((entry) => entry.run.run_id === asked) ||
    all.find((entry) => entry.run.start_date && entry.run.end_date && date >= entry.run.start_date && date <= entry.run.end_date) ||
    all[0]
  );
};

/** A meeting as one sidebar line: what, when, where, and whether its deck exists. */
const meetingLine = (meeting) => ({
  title: meeting.title,
  type: meeting.type,
  on: meeting.on,
  location: meeting.location,
  deck: (meeting.resources || []).some((resource) => resource.kind === "slides"),
});

/** A piece of work as one sidebar line. */
const workLine = (entry) => ({
  assessment_id: entry.assessment_id,
  title: entry.title,
  type: entry.type,
  due_on: entry.due_on ?? null,
});

/**
 * @param workspace - the course workspace the session stands in.
 * @param root - its folder, which `runsDocument` reports back.
 * @param askedRun - `?run=`, when the sidebar already knows which.
 * @param askedWeek - `?week=`, for the right column's focus on a week the
 *   professor stepped to in Teaching; absent, the current one.
 */
export const navigatorDocument = (workspace, root, askedRun, askedWeek = null) => {
  const runs = runsDocument(workspace, root);
  const courses = runs.courses.map((course) => ({
    course_id: course.course_id,
    title: course.title,
    runs: course.runs.map((run) => ({
      run_id: run.run_id,
      term: run.term,
      start_date: run.start_date,
      end_date: run.end_date,
    })),
  }));
  const picked = pickRun(courses, askedRun);
  if (picked === null) return { courses, run: null };

  const runId = picked.run.run_id;
  const outline = viewPayload(workspace, "course_outline", runId, undefined, false).payload;
  const weeks = Array.isArray(outline.weeks) ? outline.weeks : [];
  const asked = Number(askedWeek);
  const current =
    (Number.isInteger(asked) && asked > 0 ? weeks.find((week) => week.week === asked) : null) ||
    weeks.find((week) => week.when === "current") ||
    null;
  // The first week from this one on that has anything falling due in it —
  // "nothing due this week" is only useful beside when the next thing is.
  const next = weeks.find((week) => week.when !== "past" && week.due.length > 0) || null;

  let grading = null;
  try {
    const inbox = viewPayload(workspace, "action_inbox", runId, undefined, true).payload;
    grading = {
      pending: inbox.pending_evaluations ? inbox.pending_evaluations.total : 0,
      signals: Array.isArray(inbox.open_signals) ? inbox.open_signals.length : 0,
    };
  } catch {
    // The inbox failing must not cost the professor the week; the badge is
    // simply absent.
    grading = null;
  }

  // Scanned papers placed on nobody, pile by pile: until each is, whoever
  // wrote it reads as missing everywhere else in the pane. The Scans tab's
  // own lane count, so the sidebar and the tab cannot disagree.
  let held = [];
  try {
    const { bundle } = loadedRun(workspace, runId);
    const titles = new Map((bundle.assessments ?? []).map((entry) => [entry.assessment_id, entry.title ?? entry.assessment_id]));
    held = [...scanStandings(bundle, runId, root).entries()]
      .filter(([, standing]) => standing.lanes.held > 0)
      .map(([assessmentId, standing]) => ({ assessment_id: assessmentId, title: titles.get(assessmentId) ?? assessmentId, held: standing.lanes.held }));
  } catch {
    held = [];
  }

  return {
    courses,
    run: {
      run_id: runId,
      course_id: picked.course.course_id,
      title: picked.course.title,
      term: picked.run.term,
      start_date: picked.run.start_date,
      end_date: picked.run.end_date,
      current_week: outline.current_week ?? null,
      weeks: outline.totals ? outline.totals.weeks : weeks.length,
    },
    week: current && {
      week: current.week,
      starts_on: current.starts_on,
      ends_on: current.ends_on,
      modules: current.modules.map((module) => module.title),
      meetings: current.meetings.map(meetingLine),
      due: current.due.map(workLine),
    },
    next_due: next && next !== current ? { week: next.week, due: next.due.map(workLine) } : null,
    gaps: outline.totals && outline.totals.gaps ? outline.totals.gaps.weeks : 0,
    grading,
    held,
  };
};
