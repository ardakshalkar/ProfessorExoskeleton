/**
 * The one write Planning makes: a piece of graded work's two dates.
 *
 * Planning lets the professor drag a bar to another week and settle the day
 * in a small form. What arrives here is that form — an assessment and the two
 * timestamps it should now carry — and nothing that was computed on the way.
 *
 * WHY THE PANE MAY WRITE THIS
 * ---------------------------
 * `opens_at` and `due_at` are not a draft's claim waiting to be accepted. They
 * are the professor's own decision, made by their own hand on the page, the
 * same way a Canvas id is theirs to record (`lms-writes.js`). Until now the
 * only route to them was asking the session to edit YAML, which is a model
 * spending a turn on a deterministic change. Every other field of the record
 * is left exactly as it was, `approval` included: moving a draft's dates does
 * not accept the draft.
 *
 * HOW
 * ---
 * Through `setRecordFields`, the text edit that changes one line and proves it
 * landed before writing, so a hand-authored assessment keeps its comments and
 * its wrapping. Clearing an opening date has to delete a key, which only the
 * document API can do, so that one case goes through `editRecords`.
 */

import { activitiesOf, assessmentsOf, modulesOf, runById } from "@ainar/core/src/bundle.ts";
import { COLLECTIONS } from "@ainar/core/src/loader.ts";
import { editRecords, setRecordFields } from "@ainar/core/src/record-edit.ts";

import { loadedRun } from "./workspace.js";

// What `awareDatetime` accepts in the model, narrowed to what the form sends:
// minutes, optional seconds, and an offset. A naive time is refused here for
// the model's own reason — it would mean a different instant on every machine.
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

/** `2026-10-05T23:59+05:00` as `2026-10-05T23:59:00+05:00`, the shape the records use. */
const normalised = (value) => value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-])/, "$1:00$2");

/**
 * What Planning may not move, and why: the guardrails the page draws and
 * these writes enforce again, so a page left open since yesterday cannot
 * get past them.
 *
 * Work with results — any submission recorded against it — keeps its dates:
 * students worked to them, and the grades were made against them. And a
 * week already taught is history: no date in it moves, and nothing moves
 * into it. A week is taught once the week of today has begun after it, on
 * the outline's own count of seven days from the start date.
 *
 * `taughtBefore` is that boundary as a calendar date: a date earlier than it
 * lies in a week already taught. Null before the term has begun.
 */
export const planLocks = (bundle, runId, today = new Date().toISOString().slice(0, 10)) => {
  const run = runById(bundle).get(runId);
  const results = new Set(
    (bundle.submissions ?? []).map((submission) => submission.assessment_id).filter(Boolean),
  );
  let taughtBefore = null;
  let currentWeek = 0;
  if (run?.start_date && today >= run.start_date) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${run.start_date}T00:00:00Z`)) / 86_400_000);
    currentWeek = Math.floor(days / 7) + 1;
    taughtBefore = new Date(Date.parse(`${run.start_date}T00:00:00Z`) + (currentWeek - 1) * 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  return { results, taughtBefore, currentWeek };
};

// The calendar date a stamp names, in its own offset.
const dayOf = (stamp) => (stamp ? String(stamp).slice(0, 10) : null);
const taught = (locks, stamp) => Boolean(locks.taughtBefore && stamp && dayOf(stamp) < locks.taughtBefore);

export const writeAssessmentDates = (workspace, root, runId, body) => {
  const assessmentId = String(body?.assessment ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) return { error: "Not an assessment id." };

  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  const record = assessmentsOf(bundle, runId).find((entry) => entry.assessment_id === assessmentId);
  if (!record) return { error: `${assessmentId} is not an assessment of ${runId}.` };

  const read = (key) => {
    const value = body?.[key];
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const text = String(value).trim();
    if (!STAMP.test(text)) throw new Error(`'${text}' is not a date with a time and an offset.`);
    if (Number.isNaN(Date.parse(text))) throw new Error(`'${text}' is not a real date.`);
    return normalised(text);
  };
  let opens;
  let due;
  try {
    opens = read("opens_at");
    due = read("due_at");
  } catch (error) {
    return { error: String(error.message) };
  }
  // A due date is what puts work on the calendar at all; without one the bar
  // has nowhere to end, and "undated" is already how the page says that.
  if (!due) return { error: `${assessmentId} needs a due date.` };
  if (opens && Date.parse(opens) > Date.parse(due)) {
    return { error: "It would open after it is due. Nothing was written." };
  }
  const locks = planLocks(bundle, runId);
  if (locks.results.has(assessmentId)) {
    return { error: `${assessmentId} already has results; its dates stay as they are. Nothing was written.` };
  }
  // Only a date that changes is held to the taught weeks: work that opened
  // last week may still have its due date moved.
  const same = (a, b) => (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);
  for (const [key, next] of [["opens_at", opens], ["due_at", due]]) {
    const was = record[key] ?? null;
    if (same(was, next)) continue;
    if (taught(locks, was)) {
      return { error: `Its ${key === "due_at" ? "due date" : "opening"} is in a week already taught. Nothing was written.` };
    }
    if (taught(locks, next)) {
      return { error: `That would put its ${key === "due_at" ? "due date" : "opening"} in a week already taught. Nothing was written.` };
    }
  }

  const where = {
    root,
    courseId: run.course_id,
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
  };
  const fields = { due_at: due };
  if (opens) fields.opens_at = opens;
  try {
    const result = setRecordFields({ ...where, edits: new Map([[assessmentId, fields]]) });
    if (!opens && record.opens_at) {
      editRecords({
        ...where,
        edits: new Map([[assessmentId, (node) => node.has("opens_at") && node.delete("opens_at")]]),
      });
    }
    return { written: result.count > 0, assessment: assessmentId, opens_at: opens, due_at: due };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};

/**
 * A topic moved to another week: the module's `week`, and the dates of the
 * meetings that teach it.
 *
 * A module carries one number and its meetings carry their own timestamps,
 * so moving the number alone would leave every meeting dated in the week it
 * left — the outline would draw them under the new week and flag each one as
 * misdated. The form sends both halves together, and so does a swap: the body
 * is `{moves: [{module, week, meetings: [{activity, scheduled_at}]}]}`, one
 * entry per topic, at most two.
 *
 * Every entry is checked before anything is written: the module is this
 * course's, the week is one of this run's, each meeting is this run's and
 * teaches that module. Meetings are the professor's schedule rather than a
 * draft's claim, for the same reason the work's dates are (`writeAssessmentDates`).
 */
export const writeTopicMoves = (workspace, root, runId, body) => {
  const moves = Array.isArray(body?.moves) ? body.moves : null;
  if (!moves || moves.length === 0 || moves.length > 2) return { error: "Nothing to move, or more than a swap." };

  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  // The outline's own count: a week per seven days, the last one short.
  const span = Math.round((Date.parse(`${run.end_date}T00:00:00Z`) - Date.parse(`${run.start_date}T00:00:00Z`)) / 86_400_000);
  const totalWeeks = Math.floor(span / 7) + 1;
  const modules = new Map(modulesOf(bundle, run.course_id).map((m) => [m.module_id, m]));
  const activities = new Map(activitiesOf(bundle, runId).map((a) => [a.activity_id, a]));

  const locks = planLocks(bundle, runId);
  const weeks = new Map();
  const stamps = new Map();
  for (const move of moves) {
    const moduleId = String(move?.module ?? "").trim();
    if (!modules.has(moduleId)) return { error: `${moduleId || "That"} is not a module of ${run.course_id}.` };
    if (weeks.has(moduleId)) return { error: `${moduleId} is moved twice.` };
    const week = Number(move.week);
    if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
      return { error: `Week ${move.week} is not a week of ${runId}, which has ${totalWeeks}.` };
    }
    const from = Number(modules.get(moduleId).week);
    if (from !== week && Number.isInteger(from) && from < locks.currentWeek) {
      return { error: `${moduleId} is in week ${from}, already taught. Nothing was written.` };
    }
    if (from !== week && week < locks.currentWeek) {
      return { error: `Week ${week} is already taught; nothing moves into it. Nothing was written.` };
    }
    weeks.set(moduleId, week);
    for (const entry of Array.isArray(move.meetings) ? move.meetings : []) {
      const activityId = String(entry?.activity ?? "").trim();
      const activity = activities.get(activityId);
      if (!activity) return { error: `${activityId || "That"} is not a meeting of ${runId}.` };
      if (activity.module_id !== moduleId) return { error: `${activityId} does not teach ${moduleId}.` };
      const text = String(entry.scheduled_at ?? "").trim();
      if (!STAMP.test(text) || Number.isNaN(Date.parse(text))) {
        return { error: `'${text}' is not a date with a time and an offset.` };
      }
      if (Date.parse(text) !== Date.parse(activity.scheduled_at ?? "") && (taught(locks, activity.scheduled_at) || taught(locks, text))) {
        return { error: `${activityId} would move into or out of a week already taught. Nothing was written.` };
      }
      stamps.set(activityId, { scheduled_at: normalised(text) });
    }
  }

  try {
    const moved = setRecordFields({
      root,
      courseId: run.course_id,
      patterns: COLLECTIONS.modules,
      idField: "module_id",
      collection: "modules",
      edits: new Map([...weeks].map(([id, week]) => [id, { week }])),
    });
    const met = setRecordFields({
      root,
      courseId: run.course_id,
      patterns: COLLECTIONS.activities,
      idField: "activity_id",
      collection: "activities",
      edits: stamps,
    });
    return { written: true, modules: moved.count, meetings: met.count };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};
