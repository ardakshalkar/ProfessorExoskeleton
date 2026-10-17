/**
 * The fields of a course item the professor may change from the page: a
 * topic's title, a homework's or a quiz's title and description, a meeting's
 * title and room.
 *
 * WHY A TABLE AND NOT A ROUTE PER FIELD
 * -------------------------------------
 * Course mode edits the same few facts from three readings and two shapes —
 * in place on a title, and in a dialog that shows the whole item. Each of
 * those is the same question to the server: *set these fields on this record*.
 * So the server holds one table, `EDITABLE`, of which kinds of item may be
 * changed and which of their fields, and the page asks it what to draw
 * (`readRecord`) before it writes (`writeRecordFields`). A field added to the
 * table appears in the dialog with no client change; a field not in it cannot
 * be written however the request is made.
 *
 * WHAT IS LEFT OUT, DELIBERATELY
 * ------------------------------
 * * **`approval`.** Renaming a draft does not accept it; accepting is the
 *   professor changing that word in the record (COURSE-MODE.md).
 * * **Dates and weeks.** They have their own writes with their own guardrails
 *   (`plan-writes.js`): taught weeks and work with results stay where they are.
 * * **Weights, components, outcomes, rubrics.** A weight is half of a policy
 *   that has to add up, and the rest are judgements the skills propose as
 *   drafts. They stay with the session.
 *
 * HOW
 * ---
 * The record editor in process, the road `run-record.js` describes. A one-line
 * value goes through `setRecordFields`, which changes that line and nothing
 * else and checks it landed; a value over several lines, a cleared field, or a
 * line the text edit cannot place safely (a title that was written as a block)
 * goes through `editRecords`. Either refuses before writing.
 */

import { activitiesOf, assessmentsOf, modulesOf, runById } from "@ainar/core/src/bundle.ts";
import { COLLECTIONS } from "@ainar/core/src/loader.ts";
import { editRecords, setRecordFields } from "@ainar/core/src/record-edit.ts";

import { loadedRun } from "./workspace.js";

/** One line, never empty: a title. */
const TITLE = { shape: "line", required: true, max: 200 };
/** One line, or nothing: a room. */
const LINE = { shape: "line", required: false, max: 200 };
/** Prose over several lines, or nothing. */
const TEXT = { shape: "text", required: false, max: 4000 };

/**
 * Which items the page may change, and which of their fields.
 *
 * `of(bundle, run)` lists the records of that kind this run may edit — a
 * module of the run's course, an assessment or a meeting of the run itself —
 * so an id from another course is refused as unknown rather than written.
 */
export const EDITABLE = {
  module: {
    word: "Topic",
    collection: "modules",
    idField: "module_id",
    of: (bundle, run) => modulesOf(bundle, run.course_id),
    fields: { title: { ...TITLE, label: "Title" }, description: { ...TEXT, label: "Description" } },
  },
  assessment: {
    word: "Graded work",
    collection: "assessments",
    idField: "assessment_id",
    of: (bundle, run) => assessmentsOf(bundle, run.course_version_id),
    fields: { title: { ...TITLE, label: "Title" }, description: { ...TEXT, label: "Description" } },
  },
  activity: {
    word: "Meeting",
    collection: "activities",
    idField: "activity_id",
    of: (bundle, run) => activitiesOf(bundle, run.course_version_id),
    fields: {
      title: { ...TITLE, label: "Title" },
      location: { ...LINE, label: "Room" },
      description: { ...TEXT, label: "Description" },
    },
  },
};

/** The kind, the run and the record, or the sentence that says why not. */
const locate = (workspace, runId, kind, id) => {
  const spec = EDITABLE[kind];
  if (!spec) return { error: `'${kind}' is not something this page edits.` };
  const recordId = String(id ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(recordId)) return { error: "Not a record id." };
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  const record = spec.of(bundle, run).find((entry) => entry[spec.idField] === recordId);
  if (!record) return { error: `${recordId} is not a ${spec.word.toLowerCase()} of ${runId}.` };
  return { spec, run, record, recordId };
};

/** What the dialog draws: the item, and each field it may change with its value. */
export const readRecord = (workspace, runId, query) => {
  const found = locate(workspace, runId, query.kind, query.id);
  if (found.error) return found;
  const { spec, record, recordId } = found;
  return {
    kind: query.kind,
    id: recordId,
    word: spec.word,
    draft: record.approval === "draft",
    fields: Object.entries(spec.fields).map(([name, field]) => ({
      name,
      label: field.label,
      shape: field.shape,
      required: field.required,
      max: field.max,
      value: record[name] ?? "",
    })),
  };
};

/**
 * Set `fields` on one record: `{kind, id, fields: {title: "…"}}`. Only the
 * fields the table names, each checked against its shape; an empty value
 * clears a field that may be empty. Unchanged fields are not written.
 */
export const writeRecordFields = (workspace, root, runId, body) => {
  const found = locate(workspace, runId, body?.kind, body?.id);
  if (found.error) return found;
  const { spec, run, record, recordId } = found;
  const asked = body?.fields && typeof body.fields === "object" ? body.fields : null;
  if (!asked || !Object.keys(asked).length) return { error: "No field to change." };

  const set = {};
  const cleared = [];
  for (const [name, raw] of Object.entries(asked)) {
    const field = spec.fields[name];
    if (!field) return { error: `${name} is not a field this page changes on a ${spec.word.toLowerCase()}.` };
    if (raw !== null && typeof raw !== "string") return { error: `${field.label} is not text.` };
    const value = field.shape === "line" ? String(raw ?? "").trim() : String(raw ?? "").replace(/\r\n/g, "\n").replace(/\s+$/, "");
    if (field.shape === "line" && /[\r\n]/.test(value)) return { error: `${field.label} is one line.` };
    if (value.length > field.max) return { error: `${field.label} is longer than ${field.max} characters.` };
    if (!value) {
      if (field.required) return { error: `${field.label} cannot be empty.` };
      if (record[name] !== undefined && record[name] !== null && record[name] !== "") cleared.push(name);
      continue;
    }
    if (String(record[name] ?? "") !== value) set[name] = value;
  }
  if (!Object.keys(set).length && !cleared.length) return { written: false, kind: body.kind, id: recordId };

  const where = {
    root,
    courseId: run.course_id,
    patterns: COLLECTIONS[spec.collection],
    idField: spec.idField,
    collection: spec.collection,
  };
  // One-line values as a text edit; the rest, and any the text edit refuses,
  // through the document.
  const lines = Object.fromEntries(Object.entries(set).filter(([, value]) => !value.includes("\n")));
  const blocks = Object.fromEntries(Object.entries(set).filter(([, value]) => value.includes("\n")));
  try {
    if (Object.keys(lines).length) {
      try {
        setRecordFields({ ...where, edits: new Map([[recordId, lines]]) });
      } catch {
        Object.assign(blocks, lines);
      }
    }
    if (Object.keys(blocks).length || cleared.length) {
      editRecords({
        ...where,
        edits: new Map([
          [
            recordId,
            (node, document) => {
              for (const [name, value] of Object.entries(blocks)) {
                const scalar = document.createNode(value);
                if (value.includes("\n")) scalar.type = "BLOCK_LITERAL";
                node.set(name, scalar);
              }
              for (const name of cleared) node.delete(name);
            },
          ],
        ]),
      });
    }
    return { written: true, kind: body.kind, id: recordId, fields: { ...set, ...Object.fromEntries(cleared.map((name) => [name, ""])) } };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};
