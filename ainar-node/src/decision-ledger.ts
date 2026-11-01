/**
 * The decision ledger (GRD-3): every professor's decision the CLI writes is
 * also noted under `~/.ainar/decisions/<COURSE>.jsonl`, outside the
 * repository, so a decision that appears in `records/` without passing
 * through a decision-writing command shows.
 *
 * The CLI's guard (src/press.ts) holds the commands; this is what is left
 * when a file is written by hand: `status: approved` with a `decided_by` and
 * `decided_at` of its own looks like any other decision to the validator.
 * `ainar decisions audit RUN` names every decided evaluation the ledger does not
 * know. Under DSH's sandbox an assistant cannot add to the ledger without the
 * professor approving a write to `~/.ainar`; elsewhere, adding to it is a
 * deliberate act, not a slip.
 *
 * The ledger is this machine's. A course decided on another machine, or before
 * the ledger existed, is adopted once with `ainar decisions adopt RUN`, which is
 * the professor's word like any decision and is held by the same guard.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { CourseBundle } from "./bundle.ts";

export const decisionsDir = (base: string | null = null): string =>
  base ?? process.env.AINAR_DECISIONS_DIR ?? join(homedir(), ".ainar", "decisions");

const ledgerFile = (courseId: string, base: string | null): string => join(decisionsDir(base), `${courseId}.jsonl`);

/** A decided evaluation: approved or overridden, with the professor's decision on it. */
const decided = (evaluation: any): boolean =>
  (evaluation?.status === "approved" || evaluation?.status === "overridden") && Boolean(evaluation?.professor_decision);

const keyOf = (evaluationId: string, decidedAt: unknown): string => `${evaluationId}@${String(decidedAt ?? "")}`;

/**
 * Note the decided ones among `evaluations`, as just written by `how` (the
 * command). Returns how many were noted.
 */
export const recordDecisions = (courseId: string, evaluations: any[], how: string, base: string | null = null): number => {
  const lines = evaluations.filter(decided).map((evaluation) =>
    JSON.stringify({
      evaluation_id: evaluation.evaluation_id,
      decided_at: evaluation.professor_decision.decided_at ?? null,
      score: evaluation.professor_decision.score ?? null,
      how,
      noted_at: new Date().toISOString(),
    }),
  );
  if (!lines.length) return 0;
  mkdirSync(decisionsDir(base), { recursive: true });
  appendFileSync(ledgerFile(courseId, base), lines.join("\n") + "\n");
  return lines.length;
};

/** Every decision the ledger knows for a course, as `evaluation_id@decided_at`. */
export const knownDecisions = (courseId: string, base: string | null = null): Set<string> => {
  const file = ledgerFile(courseId, base);
  const known = new Set<string>();
  if (!existsSync(file)) return known;
  for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      known.add(keyOf(entry.evaluation_id, entry.decided_at));
    } catch {
      // A torn last line from an interrupted write is not a decision.
    }
  }
  return known;
};

export interface Audit {
  course_id: string;
  ledger: boolean;
  decided: number;
  unknown: { evaluation_id: string; submission_id: string; decided_by: string | null; decided_at: string | null }[];
}

/** The course's decided evaluations the ledger does not know. */
export const auditDecisions = (bundle: CourseBundle, base: string | null = null): Audit => {
  const courseId = (bundle.course as { course_id: string }).course_id;
  const known = knownDecisions(courseId, base);
  const all = ((bundle.evaluations ?? []) as any[]).filter(decided);
  return {
    course_id: courseId,
    ledger: existsSync(ledgerFile(courseId, base)),
    decided: all.length,
    unknown: all
      .filter((evaluation) => !known.has(keyOf(evaluation.evaluation_id, evaluation.professor_decision.decided_at)))
      .map((evaluation) => ({
        evaluation_id: evaluation.evaluation_id,
        submission_id: evaluation.submission_id,
        decided_by: evaluation.professor_decision.decided_by ?? null,
        decided_at: evaluation.professor_decision.decided_at ?? null,
      })),
  };
};
