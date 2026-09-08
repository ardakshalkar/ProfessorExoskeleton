/**
 * The Canvas gradebook CSV, read and written. Ported from `ainar/lms/canvas.py`.
 *
 * Canvas will import a gradebook CSV, which means grades can leave this
 * workspace with no API token and no request to IT. Three properties of that
 * format decide the whole design:
 *
 * **The assignment column carries the assignment id.** `Model Evaluation (90218)`
 * updates assignment 90218. The same header *without* the id creates a brand new
 * assignment, so a typo silently produces a duplicate column and a second set of
 * grades. This module therefore refuses to write a column it cannot put an id on.
 *
 * **A blank cell is left alone, not zeroed.** That is what makes a partial upload
 * safe: a student whose grading is not finished keeps whatever Canvas already
 * had. It is also why nothing here ever writes 0 to mean "not marked".
 *
 * **Matching is by id, not by name.** Canvas joins on its own `ID` column, with
 * `SIS User ID` and `SIS Login ID` as the human-meaningful keys. So the correct
 * way to build an upload is to start from a fresh export: its identity columns
 * are exactly what Canvas expects back, and its existing values are what lets
 * drift be detected at all.
 */

import { basename } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { type Directory, type MatchKey, type PushPlan, writable } from "./base.ts";
import { csvText, parseCsvDicts } from "./csv.ts";

/** Columns Canvas writes before the assignments, in this order. */
export const IDENTITY_COLUMNS = ["Student", "ID", "SIS User ID", "SIS Login ID", "Section"];

/** Rows in an export that are not students. */
const NON_STUDENT_ROWS = new Set(["points possible", "manual posting", "test student", ""]);

/** Trailing columns Canvas computes; never sent back. */
const COMPUTED =
  /^(Current|Final|Unposted Current|Unposted Final)\s+(Score|Grade|Points)$|\s(Current|Final)\s+(Score|Grade|Points)$/;

const ASSIGNMENT_ID = /\((\d+)\)\s*$/;

/** What the match key is called in the export. */
export const KEY_COLUMNS: Record<MatchKey, string> = {
  "sis-id": "SIS User ID",
  login: "SIS Login ID",
  email: "SIS Login ID",
};

/** A gradebook export, split into the parts an upload needs. */
export interface CanvasExport {
  fieldnames: string[];
  students: Record<string, string>[];
  points_possible: Record<string, string>;
  path: string | null;
}

/** Assignment id to column header, for every column that carries one. */
export const assignmentColumns = (
  exported: CanvasExport,
): Map<string, string> => {
  const found = new Map<string, string>();
  for (const column of exported.fieldnames) {
    const match = ASSIGNMENT_ID.exec(column ?? "");
    if (match && !COMPUTED.test(column)) found.set(match[1]!, column);
  }
  return found;
};

export const columnFor = (exported: CanvasExport, assignmentId: string): string | null =>
  assignmentColumns(exported).get(String(assignmentId)) ?? null;

/**
 * Read a Canvas gradebook export.
 *
 * The second row of an export is `Points Possible` rather than a student, and
 * newer exports add a `Manual Posting` row. Both are metadata and are kept out of
 * the student list.
 */
export const readExport = (path: string): CanvasExport => {
  const { fieldnames, rows } = parseCsvDicts(readFileSync(path, "utf-8"));
  if (!fieldnames.length) {
    throw new Error(`${path} is empty — is it really a Canvas gradebook export?`);
  }

  const exported: CanvasExport = {
    fieldnames: fieldnames.map((name) => name ?? ""),
    students: [],
    points_possible: {},
    path,
  };

  for (const row of rows) {
    const label = (row.Student ?? "").trim().toLowerCase();
    if (label === "points possible") {
      exported.points_possible = { ...row };
      continue;
    }
    if (NON_STUDENT_ROWS.has(label)) continue;
    exported.students.push({ ...row });
  }

  if (!exported.fieldnames.includes("ID")) {
    throw new Error(
      `${path} has no 'ID' column, so Canvas could not match the rows back. ` +
        "Export the gradebook from Canvas (Grades → Export) and use that file.",
    );
  }
  return exported;
};

/** A Canvas cell as a number, or null when it holds no grade. */
export const cellNumber = (value: string): number | null => {
  const cleaned = (value ?? "").trim();
  // EX = excused.
  if (!cleaned || ["N/A", "-", "EX"].includes(cleaned.toUpperCase())) return null;
  const parsed = Number(cleaned);
  // A letter grade or a comment; not something to compare.
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * What Canvas holds now, keyed by pseudonym.
 *
 * Returns the scores and the export rows that could not be matched to anyone in
 * the roster — usually a late enrollment, occasionally a course the roster was
 * never imported for.
 */
export const currentScores = (
  exported: CanvasExport,
  column: string,
  directory: Directory,
  by: MatchKey,
): { scores: Record<string, number | null>; unknown: string[] } => {
  const keyColumn = KEY_COLUMNS[by];
  if (!exported.fieldnames.includes(keyColumn)) {
    throw new Error(
      `the export has no '${keyColumn}' column, which --by ${by} needs. ` +
        `Columns present: ${exported.fieldnames.filter(Boolean).join(", ")}`,
    );
  }

  const scores: Record<string, number | null> = {};
  const unknown: string[] = [];
  for (const row of exported.students) {
    const studentId = directory.pseudonymFor(row[keyColumn] ?? "", by);
    if (studentId === null) {
      unknown.push(row.ID || row[keyColumn] || "?");
      continue;
    }
    scores[studentId] = cellNumber(row[column] ?? "");
  }
  return { scores, unknown };
};

/**
 * Which planned row this export row belongs to.
 *
 * The plan already carries each student's identity, so the join is a lookup
 * rather than a second derivation — and it keeps the salt out of the writing path
 * entirely.
 */
const pseudonymOf = (
  source: Record<string, string>,
  keyColumn: string,
  plan: PushPlan,
): string | null => {
  const wanted = (source[keyColumn] ?? "").trim().toLowerCase();
  if (!wanted) return null;
  for (const row of plan.rows) {
    if (!row.identity) continue;
    for (const value of [row.identity.institutional_id, row.identity.email]) {
      if (value && value.trim().toLowerCase() === wanted) return row.student_id;
    }
  }
  return null;
};

/** Python's `%g`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/**
 * Write the upload file: identity columns, plus the one assignment column.
 *
 * Only rows the plan writes get a value. Everyone else is present with a blank
 * cell, which Canvas leaves untouched — that is deliberate, and it is what makes
 * uploading a half-graded assessment safe.
 */
export const writeImport = (
  plan: PushPlan,
  exported: CanvasExport,
  column: string,
  path: string,
  by: MatchKey = "sis-id",
): number => {
  if (!ASSIGNMENT_ID.test(column)) {
    throw new Error(
      `refusing to write the column '${column}': it carries no Canvas assignment ` +
        "id, and Canvas would create a new assignment rather than updating the " +
        "existing one. Use a column from a real export, or set " +
        "extensions.lms.canvas_assignment_id on the assessment.",
    );
  }

  const keyColumn = KEY_COLUMNS[by];
  const planned = new Map(writable(plan).map((row) => [row.student_id, row]));
  const header = [...IDENTITY_COLUMNS.filter((name) => exported.fieldnames.includes(name)), column];

  let written = 0;
  const rows: string[][] = [];
  for (const source of exported.students) {
    const line = header.map((name) => (name === column ? "" : (source[name] ?? "")));
    const studentId = pseudonymOf(source, keyColumn, plan);
    const candidate = studentId ? planned.get(studentId) : undefined;
    if (candidate && candidate.score !== null) {
      line[line.length - 1] = g(candidate.score);
      written += 1;
    }
    rows.push(line);
  }

  const points = exported.points_possible[column] ?? "";
  const table: string[][] = [header];
  if (points) {
    const blank = header.map(() => "");
    blank[0] = "    Points Possible";
    blank[blank.length - 1] = points;
    table.push(blank);
  }
  table.push(...rows);
  writeFileSync(path, csvText(table), { encoding: "utf-8" });
  return written;
};

export const planSummaryNote = (exported: CanvasExport, column: string): string =>
  `Column '${column}' of ${exported.path ? basename(exported.path) : "the export"} — ` +
  "blank cells are left as Canvas has them, never set to zero.";
