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

import { assessmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { COLLECTIONS } from "@ainar/core/src/loader.ts";
import { editRecords, setRecordFields } from "@ainar/core/src/record-edit.ts";

import { loadedRun } from "./workspace.js";

// What `awareDatetime` accepts in the model, narrowed to what the form sends:
// minutes, optional seconds, and an offset. A naive time is refused here for
// the model's own reason — it would mean a different instant on every machine.
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

/** `2026-10-05T23:59+05:00` as `2026-10-05T23:59:00+05:00`, the shape the records use. */
const normalised = (value) => value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-])/, "$1:00$2");

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
