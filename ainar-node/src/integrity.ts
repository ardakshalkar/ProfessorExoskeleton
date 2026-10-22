/**
 * Academic-integrity cases: `ainar integrity`, and the pane's Integrity tab
 * and drawer, which spawn it.
 *
 * A case is the professor's decision about a person (see `IntegrityCase`), so
 * every write here is one they made — opened from a student's hand-in, then
 * cleared or upheld with an outcome. Nothing in this package opens one on its
 * own, and nothing here says anything to a student: the gradebook reads a case
 * to hold, zero or void a mark, and the Canvas push sends only that mark (or
 * EX), never the case or its note.
 *
 * Cases are written to `records/integrity.yaml` under pseudonyms. Anything
 * that names someone — the papers side by side, notes of the meeting — goes
 * under `~/.ainar/integrity/<RUN>/`, outside the repository.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { assessmentsOf, enrolledIn, type CourseBundle } from "./bundle.ts";
import { IntegrityCase } from "./model/assessment.ts";
import { writeRecords } from "./records-write.ts";

export type IntegrityState = "open" | "cleared" | "upheld";
export type IntegrityOutcome = "no_penalty" | "adjusted" | "zero" | "voided";

export const STATES: readonly IntegrityState[] = ["open", "cleared", "upheld"];
export const OUTCOMES: readonly IntegrityOutcome[] = ["no_penalty", "adjusted", "zero", "voided"];

/** Where the evidence of one run's cases is kept: outside the repository. */
export const integrityDir = (runId: string, base: string | null = null): string =>
  join(base ?? process.env.AINAR_INTEGRITY_DIR ?? join(homedir(), ".ainar", "integrity"), runId);

/** Every case of one run. */
export const casesOf = (b: CourseBundle, runId: string): any[] =>
  (((b as any).integrity_cases ?? []) as any[]).filter((entry) => entry.course_version_id === runId);

const latest = (cases: any[]): any | null =>
  cases.reduce(
    (best, entry) =>
      !best || String(entry.decided_at ?? entry.opened_at ?? "") > String(best.decided_at ?? best.opened_at ?? "") ? entry : best,
    null,
  );

/**
 * The case that decides one student's mark on one assessment, or null.
 *
 * An open case wins over everything — a mark under question is held — then
 * the latest upheld, then the latest cleared, which is the same as none.
 */
export const governingCase = (cases: any[], studentId: string, assessmentId: string): any | null => {
  const mine = cases.filter(
    (entry) => entry.student_id === studentId && ((entry.assessments as string[]) ?? []).includes(assessmentId),
  );
  if (!mine.length) return null;
  return (
    latest(mine.filter((entry) => (entry.state ?? "open") === "open")) ??
    latest(mine.filter((entry) => entry.state === "upheld")) ??
    latest(mine.filter((entry) => entry.state === "cleared"))
  );
};

/** `student|assessment` → its governing case, for every pair one touches. */
export const caseIndex = (b: CourseBundle, runId: string): Map<string, any> => {
  const cases = casesOf(b, runId);
  const index = new Map<string, any>();
  for (const entry of cases) {
    for (const assessmentId of (entry.assessments as string[]) ?? []) {
      const key = `${entry.student_id}|${assessmentId}`;
      if (!index.has(key)) index.set(key, governingCase(cases, entry.student_id, assessmentId));
    }
  }
  return index;
};

/** The next free id across every run in the bundle: INTEGRITY-001, -002, … */
export const nextCaseId = (b: CourseBundle): string => {
  const taken = new Set((((b as any).integrity_cases ?? []) as any[]).map((entry) => entry.case_id as string));
  for (let n = taken.size + 1; ; n += 1) {
    const id = `INTEGRITY-${String(n).padStart(3, "0")}`;
    if (!taken.has(id)) return id;
  }
};

const courseDirOf = (root: string, b: CourseBundle): string => join(root, "courses", String((b.course as any).course_id));

const checked = (record: Record<string, unknown>): Record<string, unknown> => {
  const parsed = IntegrityCase.safeParse(record);
  if (!parsed.success) {
    throw new Error(`not a case: ${parsed.error.issues.map((issue) => (issue.path.join(".") + " " + issue.message).trim()).join("; ")}`);
  }
  return record;
};

/**
 * Open a case on one student's work. Refused before anything is written: an
 * assessment not in the run, a student not enrolled in it, or a case already
 * open on the same work — a second would hold the same mark twice.
 */
export const openCase = (options: {
  root: string;
  bundle: CourseBundle;
  runId: string;
  studentId: string;
  assessmentIds: string[];
  note?: string | null;
  signalId?: string | null;
  by: string;
  at: string;
}): { caseId: string; written: string[] } => {
  const { root, bundle, runId, studentId, by, at } = options;
  const assessmentIds = [...new Set(options.assessmentIds)].sort();
  if (!assessmentIds.length) throw new Error("a case concerns at least one assessment");
  const known = new Set(assessmentsOf(bundle, runId).map((entry: any) => entry.assessment_id as string));
  const strangers = assessmentIds.filter((id) => !known.has(id));
  if (strangers.length) throw new Error(`not an assessment of ${runId}: ${strangers.join(", ")}`);
  if (!enrolledIn(bundle, runId).some((entry: any) => entry.student_id === studentId)) {
    throw new Error(`${studentId} is not enrolled in ${runId}`);
  }
  const cases = casesOf(bundle, runId);
  const already = assessmentIds
    .map((id) => governingCase(cases, studentId, id))
    .find((entry) => entry && (entry.state ?? "open") === "open");
  if (already) throw new Error(`${already.case_id} is already open on this work — decide it, or add to its note`);

  const submissions = ((bundle.submissions ?? []) as any[])
    .filter((entry) => entry.student_id === studentId && assessmentIds.includes(entry.assessment_id))
    .map((entry) => entry.submission_id as string)
    .sort();
  const caseId = nextCaseId(bundle);
  const record = checked({
    case_id: caseId,
    course_version_id: runId,
    student_id: studentId,
    assessments: assessmentIds,
    ...(submissions.length ? { submissions } : {}),
    state: "open",
    ...(options.signalId ? { signal_id: options.signalId } : {}),
    opened_by: by || null,
    opened_at: at,
    ...(options.note ? { note: options.note } : {}),
  });
  return { caseId, written: writeRecords(courseDirOf(root, bundle), { integrity_cases: [record] }) };
};

/**
 * Decide a case — clear it, uphold it with an outcome — or put it back to
 * open. The note, when given, replaces the one it had; the opening stays.
 */
export const decideCase = (options: {
  root: string;
  bundle: CourseBundle;
  runId: string;
  caseId: string;
  state: IntegrityState;
  outcome?: IntegrityOutcome | null;
  note?: string | null;
  by: string;
  at: string;
}): { record: Record<string, unknown>; written: string[] } => {
  const { root, bundle, runId, caseId, state, by, at } = options;
  const existing = casesOf(bundle, runId).find((entry) => entry.case_id === caseId);
  if (!existing) throw new Error(`${caseId} is not a case of ${runId}`);
  if (!STATES.includes(state)) throw new Error(`a case is ${STATES.join(", ")}, not ${state}`);
  const outcome = state === "upheld" ? options.outcome ?? null : null;
  if (state === "upheld" && (!outcome || !OUTCOMES.includes(outcome))) {
    throw new Error(`an upheld case says what it does to the mark: ${OUTCOMES.join(", ")}`);
  }
  const { outcome: _o, decided_by: _b, decided_at: _a, extensions, ...kept } = existing;
  const note = options.note === undefined ? existing.note : options.note || null;
  const record = checked({
    ...kept,
    state,
    ...(outcome ? { outcome } : {}),
    ...(state === "open" ? {} : { decided_by: by || null, decided_at: at }),
    note,
    // What it was before, kept beside it as an evaluation keeps its history.
    extensions: {
      ...(extensions ?? {}),
      history: [
        ...(((extensions ?? {}).history as unknown[]) ?? []),
        {
          state: existing.state ?? "open",
          ...(existing.outcome ? { outcome: existing.outcome } : {}),
          ...(existing.decided_by ? { decided_by: existing.decided_by } : {}),
          ...(existing.decided_at ? { decided_at: existing.decided_at } : {}),
          replaced_at: at,
        },
      ],
    },
  });
  if (record.note === null || record.note === undefined) delete record.note;
  return { record, written: writeRecords(courseDirOf(root, bundle), { integrity_cases: [record] }) };
};

/** How a case reads in one line, for the CLI and the pane — never for a student. */
export const describeCase = (entry: any): string => {
  const state = entry.state ?? "open";
  const said =
    state === "open"
      ? "open — the mark is held"
      : state === "cleared"
        ? "cleared — the mark counts as marked"
        : {
            no_penalty: "upheld, no penalty — the mark counts, off the curve",
            adjusted: "upheld, mark adjusted — the decided mark counts, off the curve",
            zero: "upheld — the mark is 0",
            voided: "upheld — voided, out of the student's total (excused in Canvas)",
          }[entry.outcome as IntegrityOutcome] ?? "upheld";
  return `${entry.case_id} ${entry.student_id} on ${((entry.assessments as string[]) ?? []).join(", ")}: ${said}`;
};
