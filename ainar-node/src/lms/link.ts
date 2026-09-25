/**
 * Writing a Canvas assignment id into the record that owns it.
 *
 * Two callers, one implementation, and the split between them is the point:
 *
 * * **`ainar lms assignment-push`** creates an assignment and gets back a
 *   number only Canvas knows. A number nobody writes down is a number the next
 *   push cannot use, so it is recorded the moment Canvas returns it.
 * * **`dsh-professor-pane`'s Links tab** records a pairing a professor chose
 *   from a list.
 *
 * The pane owns everything about *its* request — that the run exists, that the
 * assessment belongs to it, that a subgroup is one the run actually has, that
 * an id is the number the API takes — because that is validation of an
 * untrusted browser payload and belongs where the payload arrives. What it
 * does not own is the editing, and this file is why: the two used to hold
 * separate copies of the file search, the multi-document refusal and the CRLF
 * handling, and a rule that lives in two places is a rule that will eventually
 * be true in one of them.
 *
 * ## What a value means
 *
 * Per assessment, exactly three shapes, and each clears the other key so a run
 * can move between one Canvas course and several without leaving a stale
 * pairing behind:
 *
 * * a string — `canvas_assignment_id`, for a run with one Canvas course;
 * * an object — `canvas_assignments`, a subgroup-to-id mapping, **replacing**
 *   whatever was there. Wholesale rather than merged because the pane sends
 *   what is on screen, and a merge would make "I removed CS-402" impossible to
 *   express. A caller that means to keep the others reads them first and sends
 *   them back — `assignment-push` does exactly that.
 * * `null` — remove both, which is how a pairing is undone.
 *
 * ## Why it is allowed to edit these files at all
 *
 * Files `ainar approve` writes carry "Machine-managed — change these through
 * approval, not by hand", and this edits them. The line that makes it
 * defensible: approval is a gate on *decisions* — what a student was given,
 * what an outcome claims — and a Canvas assignment id is neither. It is a
 * pointer at another system, it carries no academic content, it changes when
 * somebody rebuilds a Canvas shell, and nothing about it is a judgement
 * anybody should have to re-accept. Every other field is left as it was.
 *
 * Edited through `yaml`'s document API rather than by re-dumping the parsed
 * object: these files are hand-authored and full of comments explaining why a
 * weight is what it is, and a round trip through `parse` and `dump` would
 * silently delete every one of them.
 */

import { type EditResult, editRecords } from "../record-edit.ts";
import { CANVAS_ASSIGNMENTS_KEY, CANVAS_ASSIGNMENT_KEY, LMS_EXTENSION } from "./index.ts";

/** One assessment's linkage: a single id, a subgroup mapping, or nothing. */
export type AssignmentLink = string | Record<string, string> | null;

/** Kept as the name two callers already import. */
export type LinkResult = EditResult;

/**
 * Remove a key only if it is there.
 *
 * `deleteIn` throws "Expected YAML collection at extensions" when a parent on
 * the path does not exist, which is the ordinary case: most assessments have
 * no `extensions` block at all until the first pairing is written. Asking
 * first turns that into the no-op it should always have been.
 */
const clearIn = (node: any, path: string[]): void => {
  if (node.hasIn(path)) node.deleteIn(path);
};

/**
 * Record the linkage, and say which files changed.
 *
 * Throws rather than returning a partial result: half-written linkage is worse
 * than none, because the half that landed looks like the whole. Every refusal
 * happens before any file is opened for writing, so a throw means nothing was
 * touched.
 *
 * The ids are written as NUMBERS. Either loads — `str()` in `index.ts`
 * stringifies whatever it finds — but a quoted one would not match what a
 * professor writes by hand, and a file whose shape depends on who last touched
 * it is a file that diffs badly.
 */
export const writeAssessmentLinks = (
  root: string,
  courseId: string,
  links: Map<string, AssignmentLink> | Record<string, AssignmentLink>,
): LinkResult => {
  const wanted = links instanceof Map ? links : new Map(Object.entries(links));

  // Finding the file, refusing a multi-document one, editing through the YAML
  // document API and keeping the line endings are `record-edit.ts`'s, because
  // `ainar publish` re-stamps a document the same way and a rule about
  // rewriting a professor's records that lives in two places is a rule that
  // will eventually be true in one of them. What stays here is what a value
  // MEANS: three shapes, each clearing the other key.
  const edits = new Map<string, (node: any) => void>();
  for (const [id, value] of wanted) {
    edits.set(id, (node) => {
      const single = ["extensions", LMS_EXTENSION, CANVAS_ASSIGNMENT_KEY];
      const perGroup = ["extensions", LMS_EXTENSION, CANVAS_ASSIGNMENTS_KEY];
      if (value === null) {
        clearIn(node, perGroup);
        clearIn(node, single);
        return;
      }
      if (typeof value === "object") {
        clearIn(node, single);
        // Cleared before it is rebuilt, which is what makes the mapping
        // WHOLESALE: a subgroup left out of `value` is a subgroup unbound.
        clearIn(node, perGroup);
        for (const [group, assignmentId] of Object.entries(value)) {
          node.setIn([...perGroup, group], Number(assignmentId));
        }
        return;
      }
      clearIn(node, perGroup);
      node.setIn(single, Number(value));
    });
  }

  return editRecords({
    root,
    courseId,
    patterns: ["assessments.yaml", "assessments/*.yaml"],
    idField: "assessment_id",
    collection: "assessments",
    edits,
  });
};
