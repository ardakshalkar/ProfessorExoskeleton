/**
 * The assignment itself, not the grades on it.
 *
 * Everything else under `lms/` moves *values* — a score per student. This moves
 * the *definition*: name, points, dates, what may be handed in, and the brief
 * students read. Until it existed, Canvas and this workspace held two
 * independent descriptions of the same assignment joined by nothing but an id,
 * and the only way to notice they disagreed was for a student to ask.
 *
 * ## One direction, and drift reported rather than resolved
 *
 * This pushes out. It never edits the model from Canvas. The reason is the
 * project's spine: a record in `courses/` is something a person authored and
 * `ainar approve` promoted, and a background sync that rewrote a due date
 * because somebody moved it in a Canvas UI would be the system deciding
 * something.
 *
 * So the same four verdicts `base.ts` uses for a cell are used here for a
 * field, and for the same reason:
 *
 * * `new` — Canvas has no assignment yet, or holds nothing in this field
 * * `unchanged` — it already says what we say
 * * `change` — it matches what we last sent, so the difference is ours to push
 * * `drift` — it matches neither, so **a person edited it in Canvas**
 *
 * Drift is refused by default. Overwriting it would erase a colleague's
 * correction, or the professor's own half-hour in the Canvas UI.
 *
 * ## Only the fields this workspace has an opinion about
 *
 * A PUT carrying every field would push our *silence* over whatever was set in
 * Canvas — `grading_type`, `assignment_group_id`, peer review settings, the
 * position in the list. None of those exist in this model, so none of them are
 * sent, and `writeAssignment` is handed only the fields that actually differ.
 * A field the model does not describe is a field Canvas keeps.
 *
 * ## Several subgroups, one definition
 *
 * `lms push` is deliberately one subgroup per invocation: each cohort has
 * different marks, so two subgroups is two pushes. This is the opposite case.
 * The *definition* is identical for every subgroup — same title, same points,
 * same brief — so fanning out is not a convenience but the thing that keeps
 * CS-401 and CS-402 from drifting apart. `--group` narrows it to one when a
 * professor wants that; the default is every Canvas course the run names.
 */

import { readFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { renderMarkdown } from "../markdown.ts";

/** What we ask Canvas to hold. `null` means "this workspace says nothing". */
export interface AssignmentSpec {
  name: string;
  points_possible: number | null;
  due_at: string | null;
  unlock_at: string | null;
  submission_types: string[];
  allowed_extensions: string[];
  description: string | null;
}

export type FieldAction = "new" | "unchanged" | "change" | "drift";

export interface FieldPlan {
  field: string;
  action: FieldAction;
  desired: string | null;
  current: string | null;
  reason: string | null;
}

export interface AssignmentPlan {
  course_version_id: string;
  assessment_id: string;
  group: string | null;
  canvas_course_id: string;
  canvas_assignment_id: string | null;
  /** `create` when Canvas has no assignment for this assessment yet. */
  operation: "create" | "update";
  fields: FieldPlan[];
  /**
   * The form body `writeAssignment` would receive, drift excluded.
   *
   * A string array is a field Canvas takes as a repeated key; `writeAssignment`
   * is what turns it into one.
   */
  send: Record<string, string | string[]>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// The model's vocabulary, in Canvas's
// ---------------------------------------------------------------------------

/**
 * `SubmissionFormat` to Canvas's `submission_types`.
 *
 * Canvas's list is about the CHANNEL — how work arrives — while ours is about
 * the SHAPE it arrives in, so the mapping is many-to-one and lossy in that
 * direction on purpose. Four of our formats are all "a file is uploaded"; what
 * distinguishes them is `allowed_extensions`, which is the other half of this
 * table.
 *
 * `oral_defense` maps to `on_paper` rather than to nothing: Canvas needs a
 * column to hang a grade on, and `on_paper` is its name for work that happened
 * somewhere other than the browser. Mapping it to `none` would make the
 * assignment ungradeable, which is the one thing it must not be.
 */
const CANVAS_SUBMISSION_TYPE: Record<string, string> = {
  pdf: "online_upload",
  docx: "online_upload",
  pptx: "online_upload",
  notebook: "online_upload",
  image: "online_upload",
  audio: "media_recording",
  video: "media_recording",
  code_repo: "online_url",
  url: "online_url",
  text: "online_text_entry",
  oral_defense: "on_paper",
};

/** The file extensions each uploadable format actually arrives as. */
const UPLOAD_EXTENSIONS: Record<string, string[]> = {
  pdf: ["pdf"],
  docx: ["docx", "doc"],
  pptx: ["pptx", "ppt"],
  notebook: ["ipynb"],
  image: ["png", "jpg", "jpeg", "gif", "webp"],
};

const unique = (values: string[]): string[] => [...new Set(values)];

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

/**
 * The assignment description Canvas should hold: the brief, as HTML.
 *
 * Rendered through the same `renderMarkdown` the pane serves a brief with, so
 * what the class reads in Canvas and what the professor reads in the pane are
 * one document rendered once. A second renderer here would eventually disagree
 * with that one about a table.
 *
 * Returns null — meaning "say nothing about the description" — in every case
 * where the brief cannot be read with certainty: no `instructions_document_id`,
 * no such document, a `storage_key` with a scheme (the bytes are in object
 * storage and this process has no route to them), a path climbing out of the
 * workspace, or a file that is recorded and not on disk. Null is not a failure
 * here; it means Canvas keeps whatever description it has, which is the right
 * outcome when we cannot say what the brief is.
 */
export const briefHtml = (
  bundle: any,
  assessment: any,
  root: string,
): { html: string | null; note: string | null } => {
  const documentId = assessment?.instructions_document_id;
  if (!documentId) {
    return {
      html: null,
      note:
        `${assessment.assessment_id} has no instructions_document_id, so its Canvas ` +
        "description is left as it is. Write the brief and register it as a Document " +
        "to have it published with the assignment.",
    };
  }

  const record = (bundle.documents as any[] | undefined)?.find(
    (row) => row.document_id === documentId,
  );
  if (!record) return { html: null, note: `${documentId} is named but is not a Document here.` };

  const key = String(record.storage_key ?? "");
  if (!key || key.includes("://")) {
    return {
      html: null,
      note: `${documentId} is stored outside this repository (${key || "no storage_key"}), so its text cannot be sent.`,
    };
  }

  // The same containment `sendMaterial` applies in the pane, for the same
  // reason: a key climbing out with `..` is a record that should not have
  // validated, and this is the second place that becomes untrue rather than
  // the first.
  const full = isAbsolute(key) ? resolve(key) : resolve(root, key);
  if (!full.startsWith(resolve(root) + sep)) {
    return { html: null, note: `${documentId} resolves outside the workspace.` };
  }

  // The format decides before the filesystem does. Whether a `.docx` is on
  // disk is beside the point — it is a container rather than text, and it
  // could not be a description either way. Asking the record first also keeps
  // this from reading a binary file into memory to learn nothing.
  const extension = (key.split(".").pop() ?? "").toLowerCase();
  const TEXTUAL = ["md", "markdown", "txt", "html", "htm"];
  if (!TEXTUAL.includes(extension)) {
    return {
      html: null,
      note: `${documentId} is a .${extension}, which is not text this can send as a description.`,
    };
  }

  let text: string;
  try {
    text = readFileSync(full, "utf-8");
  } catch {
    return { html: null, note: `${key} is recorded but not on disk.` };
  }

  // HTML goes as it is; markdown is what `design-assessment` writes, and is
  // rendered through the renderer the pane serves the same brief with.
  if (extension === "html" || extension === "htm") return { html: text, note: null };
  return { html: renderMarkdown(text), note: null };
};

// ---------------------------------------------------------------------------
// The spec
// ---------------------------------------------------------------------------

/** What Canvas should hold for this assessment. */
export const specFor = (assessment: any, description: string | null): AssignmentSpec => {
  const formats: string[] = Array.isArray(assessment.submission_type)
    ? assessment.submission_type
    : [];
  const types = unique(
    formats.map((format) => CANVAS_SUBMISSION_TYPE[format]).filter(Boolean) as string[],
  ).sort();
  const extensions = types.includes("online_upload")
    ? unique(formats.flatMap((format) => UPLOAD_EXTENSIONS[format] ?? [])).sort()
    : [];

  return {
    name: String(assessment.title ?? assessment.assessment_id),
    points_possible:
      typeof assessment.maximum_score === "number" ? assessment.maximum_score : null,
    due_at: assessment.due_at ?? null,
    unlock_at: assessment.opens_at ?? null,
    submission_types: types,
    allowed_extensions: extensions,
    description,
  };
};

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Two datetimes are the same moment, whatever they are written as.
 *
 * We send `2026-10-06T23:59:00+05:00`; Canvas hands back `2026-10-06T18:59:00Z`.
 * String comparison calls those different and would report drift on every run
 * forever, which is the fastest way to teach somebody to ignore a drift report.
 */
const sameInstant = (left: string | null, right: string | null): boolean => {
  if (left === null || right === null) return left === right;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (Number.isNaN(a) || Number.isNaN(b)) return left === right;
  return a === b;
};

/**
 * Description equality, on the text rather than on the markup.
 *
 * Canvas does not store the HTML it is given. It rewrites links, adds its own
 * attributes and reorders others, so the description that comes back is never
 * byte-equal to the one that went out. Comparing the markup would mean every
 * assignment drifted the instant it was pushed.
 *
 * So both sides are reduced to their visible text — tags stripped, entities
 * left alone, whitespace collapsed — and compared on that. It is a weaker test
 * and it is the true one: what matters is whether the class is reading
 * different words, not whether Canvas rewrote an anchor.
 */
export const descriptionText = (html: string | null): string | null => {
  if (html === null) return null;
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const sameNumber = (left: number | null, right: number | null): boolean => {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= 0.001;
};

/**
 * One field's verdict. `base.ts`'s `classify`, for a value that is not a score.
 *
 * The shape is deliberately identical: what we want, what the target holds,
 * what we last sent. Drift is the case the whole mechanism exists for.
 */
const classifyField = (
  same: (a: any, b: any) => boolean,
  desired: any,
  current: any,
  prepared: any,
  hasPrepared: boolean,
): [FieldAction, string | null] => {
  if (current === null || current === undefined || current === "") return ["new", null];
  if (same(desired, current)) return ["unchanged", null];
  if (hasPrepared && same(prepared, current)) return ["change", null];
  return [
    "drift",
    hasPrepared
      ? "Canvas holds something this workspace did not put there"
      : "Canvas already holds a value and this workspace has never written this field",
  ];
};

const show = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
};

export interface PlanAssignmentOptions {
  courseVersionId: string;
  assessmentId: string;
  group: string | null;
  canvasCourseId: string;
  canvasAssignmentId: string | null;
  spec: AssignmentSpec;
  /** The assignment as Canvas has it, or null when there is none. */
  current: Record<string, any> | null;
  /** What this workspace last sent for it, from the ledger. */
  prepared: Partial<AssignmentSpec> | null;
  notes?: string[];
}

/** What one push would do to one Canvas course, and why. */
export const planAssignment = ({
  courseVersionId,
  assessmentId,
  group,
  canvasCourseId,
  canvasAssignmentId,
  spec,
  current,
  prepared,
  notes = [],
}: PlanAssignmentOptions): AssignmentPlan => {
  const plan: AssignmentPlan = {
    course_version_id: courseVersionId,
    assessment_id: assessmentId,
    group,
    canvas_course_id: canvasCourseId,
    canvas_assignment_id: canvasAssignmentId,
    operation: current ? "update" : "create",
    fields: [],
    send: {},
    notes: [...notes],
  };

  const held = current ?? {};
  const last = prepared ?? {};
  const known = prepared !== null;

  /**
   * One field, compared and — unless it drifted — queued to send.
   *
   * `encode` returns the form value; returning null means "nothing to send",
   * which is how a field the model says nothing about stays Canvas's.
   */
  const field = (
    name: string,
    desired: any,
    currentValue: any,
    preparedValue: any,
    same: (a: any, b: any) => boolean,
    encode: (value: any) => Record<string, string | string[]> | null,
  ): void => {
    if (desired === null || desired === undefined || (Array.isArray(desired) && !desired.length)) {
      return;
    }
    const [action, reason] = classifyField(same, desired, currentValue, preparedValue, known);
    plan.fields.push({
      field: name,
      action,
      desired: show(desired),
      current: show(currentValue),
      reason,
    });
    if (action === "unchanged" || action === "drift") return;
    const encoded = encode(desired);
    if (encoded) Object.assign(plan.send, encoded);
  };

  const same = (a: any, b: any) => a === b;
  const sameList = (a: string[], b: string[]) =>
    Array.isArray(a) && Array.isArray(b) && [...a].sort().join("|") === [...b].sort().join("|");

  field("name", spec.name, held.name ?? null, last.name ?? null, same, (value) => ({
    name: String(value),
  }));
  field(
    "points_possible",
    spec.points_possible,
    typeof held.points_possible === "number" ? held.points_possible : null,
    last.points_possible ?? null,
    sameNumber,
    (value) => ({ points_possible: String(value) }),
  );
  field("due_at", spec.due_at, held.due_at ?? null, last.due_at ?? null, sameInstant, (value) => ({
    due_at: String(value),
  }));
  field(
    "unlock_at",
    spec.unlock_at,
    held.unlock_at ?? null,
    last.unlock_at ?? null,
    sameInstant,
    (value) => ({ unlock_at: String(value) }),
  );
  field(
    "submission_types",
    spec.submission_types,
    Array.isArray(held.submission_types) ? held.submission_types : null,
    last.submission_types ?? null,
    sameList,
    // The list travels as a list. Joining it would reach Canvas as one
    // unknown submission type; `writeAssignment` repeats the key.
    (value: string[]) => ({ submission_types: value }),
  );
  field(
    "allowed_extensions",
    spec.allowed_extensions,
    Array.isArray(held.allowed_extensions) ? held.allowed_extensions : null,
    last.allowed_extensions ?? null,
    sameList,
    (value: string[]) => ({ allowed_extensions: value }),
  );
  field(
    "description",
    spec.description,
    held.description ?? null,
    last.description ?? null,
    (a, b) => descriptionText(a) === descriptionText(b),
    (value) => ({ description: String(value) }),
  );

  return plan;
};

/** Whether anything would actually be written. */
export const willWrite = (plan: AssignmentPlan): boolean =>
  plan.operation === "create" || Object.keys(plan.send).length > 0;

/** The fields a person has edited in Canvas, which this refuses to overwrite. */
export const drifted = (plan: AssignmentPlan): FieldPlan[] =>
  plan.fields.filter((row) => row.action === "drift");
