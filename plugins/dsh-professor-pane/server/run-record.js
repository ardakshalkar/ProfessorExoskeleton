/**
 * Edits to the run record (`version.yaml`), the pane's one road for them.
 *
 * WHICH ROAD A WRITE FROM THE PANE TAKES (MOD-3b)
 * -----------------------------------------------
 * * **A field of a record** — dates on an assessment, a module's week, the
 *   grading scheme, a Canvas link on the run — goes through the core's record
 *   editor in process (`@ainar/core/src/record-edit.ts`): it finds the record
 *   by its id rather than by a guessed filename, keeps the file's comments and
 *   line endings, and refuses before writing anything. `setRecordFields` for a
 *   top-level scalar, which changes that one line and nothing else;
 *   `editRecords` — here, `editRunRecord` — for anything nested or deleted.
 * * **Anything that reaches past this machine, or runs long** — publishing,
 *   pushing marks or a definition to Canvas, reading scans, grading — spawns
 *   the CLI (`server/actions.js`), so the pane and a terminal do the very same
 *   thing and the pane's server never holds a third party's half-finished
 *   request.
 * * **Files that are not records** — preference layers, an upload, a sync's
 *   incoming sheet — are written by the module that owns that file, because no
 *   record editor knows their shape.
 *
 * Until 2026-10-16 the run record was the exception: four writers in
 * `lms-writes.js` and `grading-writes.js` each opened `version.yaml` with their
 * own YAML code and wrote it back themselves. Run against copies of the real
 * course's record and the sample's, the record editor produces byte-identical
 * files for the same edits, so moving them here changed nothing on disk.
 */

import { relative, sep } from "node:path";

import { COLLECTIONS } from "@ainar/core/src/loader.ts";
import { editRecords } from "@ainar/core/src/record-edit.ts";

/**
 * Apply `edit(node, document)` to the run's record and write it.
 *
 * @returns the record's path, relative to the workspace root.
 * @throws when the run cannot be located or the edit cannot be made safely —
 *   always before anything is written.
 */
export const editRunRecord = (root, run, edit) => {
  if (!run.course_id || !run.term) {
    throw new Error(`${run.course_version_id} carries no course_id and term, so its record cannot be located.`);
  }
  const result = editRecords({
    root,
    courseId: run.course_id,
    patterns: COLLECTIONS.versions,
    idField: "course_version_id",
    collection: "versions",
    edits: new Map([[run.course_version_id, edit]]),
  });
  const path = result.written[0];
  if (!path) throw new Error(`${run.course_version_id} was not written: no record of it was found under courses/${run.course_id}/.`);
  return relative(root, path).split(sep).join("/");
};

const emptied = (node) => Boolean(node) && Array.isArray(node.items) && node.items.length === 0;

/**
 * Remove `path` from a record, and the mappings it leaves empty on the way up:
 * absent and "set to nothing" are different facts about a record, so clearing
 * the last value under `extensions.lms` leaves the record saying nothing about
 * it at all. A path that is not there is already cleared.
 */
export const clearIn = (node, path) => {
  if (!node.hasIn(path)) return;
  node.deleteIn(path);
  for (let depth = path.length - 1; depth > 0; depth -= 1) {
    const parent = path.slice(0, depth);
    if (emptied(node.getIn(parent))) node.deleteIn(parent);
  }
};
