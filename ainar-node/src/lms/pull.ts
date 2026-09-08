/**
 * Reading a Canvas export back, as proposals rather than records. Ported from
 * `ainar/lms/pull.py`.
 *
 * What comes out of Canvas is *who has work there*. `/grade-batch` needs a
 * `Submission` record for each of them, and typing those by hand for twenty-seven
 * students is the sort of transcription this workspace exists to remove.
 *
 * Two limits, both deliberate:
 *
 * **No timestamp is invented.** A gradebook export does not say when a student
 * submitted, and `submitted_at` is optional. Filling it with the due date would be
 * a fabricated fact about a student, so the field is left out and the note says
 * where the record came from.
 *
 * **Item responses are not attempted here.** Those live in Canvas's quiz Student
 * Analysis report, whose column layout varies by question type and cannot be
 * guessed at safely — a wrong column mapping would attribute one student's answer
 * to another's concept diagnosis. That wants a real report to build against.
 *
 * The API pull is the better of the two, and for one reason: Canvas knows when the
 * work was handed in, so `submitted_at` is read rather than left out.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dump } from "../yaml-out.ts";
import { type Directory, type MatchKey } from "./base.ts";
import { type CanvasExport, KEY_COLUMNS, cellNumber } from "./canvas.ts";

const DRAFT_MARKER = "DRAFT";

/** `SUB-DRAFT-JNG7SN-04` — the marker makes the origin unmistakable. */
export const draftSubmissionId = (studentId: string, assessmentId: string): string => {
  const student = studentId.startsWith("STUDENT-") ? studentId.slice("STUDENT-".length) : studentId;
  const assessment = assessmentId.startsWith("ASSESSMENT-")
    ? assessmentId.slice("ASSESSMENT-".length)
    : assessmentId;
  return `SUB-${DRAFT_MARKER}-${student}-${assessment}`;
};

export interface PullResult {
  drafts: Record<string, any>[];
  already: string[];
  unmatched: string[];
}

export interface PullOptions {
  assessmentId: string;
  enrolled?: Iterable<string> | null;
  known?: Iterable<string> | null;
}

/**
 * Draft `Submission` records for students Canvas has work for.
 *
 * Returns the drafts, the pseudonyms skipped because a submission already exists,
 * and the export rows that matched nobody in the roster.
 */
export const submissionsFromExport = (
  exported: CanvasExport,
  column: string,
  directory: Directory,
  by: MatchKey,
  { assessmentId, enrolled = null, known = null }: PullOptions,
): PullResult => {
  const keyColumn = KEY_COLUMNS[by];
  if (!exported.fieldnames.includes(keyColumn)) {
    throw new Error(`the export has no '${keyColumn}' column, which --by ${by} needs.`);
  }

  const enrolledSet = enrolled === null ? null : new Set(enrolled);
  const knownSet = new Set(known ?? []);
  const drafts: Record<string, any>[] = [];
  const already: string[] = [];
  const unmatched: string[] = [];

  for (const row of exported.students) {
    // Nothing in Canvas for this student on this assessment.
    if (cellNumber(row[column] ?? "") === null) continue;
    const studentId = directory.pseudonymFor(row[keyColumn] ?? "", by);
    if (studentId === null) {
      unmatched.push(row.ID || "?");
      continue;
    }
    if (enrolledSet !== null && !enrolledSet.has(studentId)) {
      unmatched.push(studentId);
      continue;
    }
    if (knownSet.has(studentId)) {
      already.push(studentId);
      continue;
    }
    drafts.push({
      submission_id: draftSubmissionId(studentId, assessmentId),
      assessment_id: assessmentId,
      student_id: studentId,
      status: "submitted",
      note:
        "Presence inferred from a Canvas gradebook export; Canvas holds " +
        "a value for this student on this assessment. No submission time " +
        "was available, so none is recorded.",
    });
  }

  return { drafts, already: already.sort(), unmatched: [...new Set(unmatched)].sort() };
};

/**
 * Canvas timestamps are UTC with a `Z`. House style is the run's offset.
 *
 * The offset is given as minutes rather than a timezone object: `decidedAt` in
 * `approve.ts` already resolves a run's zone that way, and doing it twice with
 * two different mechanisms is how two records of the same moment end up an hour
 * apart.
 */
export const submittedAt = (value: string | null | undefined, offsetMinutes: number): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const shifted = new Date(parsed.getTime() + offsetMinutes * 60_000);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  return shifted.toISOString().replace(/\.\d+Z$/, "").replace("Z", "") + offset;
};

/**
 * Draft `Submission` records from Canvas's own submission list.
 *
 * Only work that was actually handed in. An unsubmitted placeholder — Canvas
 * creates one per student per assignment — is not a submission, and an excused
 * student has nothing to grade.
 */
export const submissionsFromApi = (
  submissions: Record<string, any>[],
  userToStudent: Map<string, string>,
  { assessmentId, enrolled = null, known = null }: PullOptions,
  offsetMinutes: number,
): PullResult => {
  const byUser = new Map([...userToStudent].map(([studentId, userId]) => [userId, studentId]));
  const enrolledSet = enrolled === null ? null : new Set(enrolled);
  const knownSet = new Set(known ?? []);

  const drafts: Record<string, any>[] = [];
  const already: string[] = [];
  const unmatched: string[] = [];

  for (const submission of submissions) {
    if (submission.excused) continue;
    if (submission.workflow_state === "unsubmitted") continue;
    if (!submission.submitted_at) continue;

    const studentId = byUser.get(String(submission.user_id));
    if (studentId === undefined) {
      unmatched.push(String(submission.user_id ?? "?"));
      continue;
    }
    if (enrolledSet !== null && !enrolledSet.has(studentId)) {
      unmatched.push(studentId);
      continue;
    }
    if (knownSet.has(studentId)) {
      already.push(studentId);
      continue;
    }

    const draft: Record<string, any> = {
      submission_id: draftSubmissionId(studentId, assessmentId),
      assessment_id: assessmentId,
      student_id: studentId,
      status: submission.late ? "late" : "submitted",
      attempt: Number(submission.attempt || 1),
    };
    const stamped = submittedAt(submission.submitted_at, offsetMinutes);
    if (stamped) draft.submitted_at = stamped;
    const attachments = (submission.attachments ?? []) as unknown[];
    draft.note =
      "From the Canvas API. " +
      (attachments.length
        ? `${attachments.length} file(s) are attached in Canvas; the bytes stay ` +
          "there and are not referenced here."
        : "No attached files.");
    drafts.push(draft);
  }

  return { drafts, already: already.sort(), unmatched: [...new Set(unmatched)].sort() };
};

/** Write the proposals where `validate --drafts` will find them. */
export const writeDrafts = (drafts: Record<string, any>[], path: string): string => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    "# Proposed submission records, from a Canvas gradebook export.\n" +
      "#\n" +
      "# Not records. Check them, then approve:\n" +
      "#   ainar validate <COURSE> --drafts work/<COURSE_VERSION_ID>\n" +
      "#   ainar approve work/<COURSE_VERSION_ID> --as USER-...\n\n" +
      dump({ submissions: drafts }),
    { encoding: "utf-8" },
  );
  return path;
};
