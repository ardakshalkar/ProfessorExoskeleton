/**
 * What was prepared for a gradebook, kept outside the repository. Ported from
 * `ainar/lms/ledger.py`.
 *
 * Two gradebooks are maintained by hand here — Canvas and a spreadsheet — so the
 * same score exists in three places: the decisions in this workspace, and the two
 * copies. The ledger is what makes the difference between them answerable.
 *
 * It records what was *prepared*, not what landed. Writing a CSV is not the same
 * act as uploading it, and pretending otherwise would make the ledger lie the
 * first time a file is written and forgotten. So an entry means "this workspace
 * produced this value on this date", and a later export is what confirms it
 * arrived.
 *
 * It lives beside the roster, in `~/.ainar/sync/`, for the same reason: it holds
 * gradebook values and target-side identifiers, which is the copy of the grade of
 * record. The repository never holds those.
 *
 * ## One cosmetic difference from the Python file
 *
 * Python wrote `"score": 20.0`; this writes `"score": 20`, because JavaScript
 * has one number type and the ledger's values are not schema-backed the way a
 * record's are. Both parse back to the same number in both languages, and every
 * read compares numerically — `prepared()` feeds `classify`, which subtracts —
 * so a ledger written by either implementation is read correctly by the other.
 *
 * ## `content` and `pushed` are carried, not used
 *
 * Upstream this file is shared with `ainar notion`, which is not ported: `entries`
 * holds a number per student per assessment, `content` holds prose per Notion page
 * and `pushed` holds the block ids a push put there. Both are loaded and written
 * back untouched, so a professor whose ledger already has them keeps them — a
 * writer that dropped every key it did not understand would silently destroy the
 * record of what was published, and the first symptom would be `notion push`
 * re-adding blocks that are already on the page.
 */

import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * 2 added `content`, 3 added `pushed`, 4 added `assignments`. Older files load
 * unchanged, and a file written by 4 is read by 3 with the assignment half
 * ignored — which costs one spurious `drift` report on the first push after a
 * downgrade, and loses nothing.
 */
export const STORE_VERSION = 4;

const HEADER_NOTE =
  "Prepared gradebook values, written by `ainar lms push`, and the Notion " +
  "content last seen by `ainar notion pull`. 'prepared' means a file was " +
  "produced — not that anyone uploaded it. Outside the repository on purpose: " +
  "the gradebook half holds values that belong to the LMS and the SIS.";

export const syncDir = (explicit?: string | null): string => {
  if (explicit) return resolve(explicit);
  const fromEnv = process.env.AINAR_SYNC_DIR;
  if (fromEnv) return resolve(fromEnv);
  return join(homedir(), ".ainar", "sync");
};

const key = (target: string, assessmentId: string, studentId: string): string =>
  `${target}|${assessmentId}|${studentId}`;

/** No target in the key: an assignment definition only ever goes to Canvas. */
const assignmentKey = (assessmentId: string, canvasCourseId: string): string =>
  `${assessmentId}|${canvasCourseId}`;

export interface Entry {
  score: number;
  maximum: number | null;
  state: string;
  at: string;
  file: string | null;
}

/**
 * The assignment definition last sent to one Canvas course.
 *
 * Kept for exactly one purpose: telling `change` from `drift`. Without it,
 * every field Canvas holds that differs from ours is indistinguishable from a
 * field a colleague edited, so the first push would either refuse everything or
 * overwrite everything. With it, the question "did we put that there?" has an
 * answer.
 *
 * Keyed by Canvas COURSE as well as assessment, because a run taught to two
 * subgroups is two assignments with two separate histories — CS-402's title may
 * have been edited in Canvas while CS-401's was not.
 */
export interface AssignmentEntry {
  /** The spec as sent: `name`, `points_possible`, `due_at`, and so on. */
  spec: Record<string, unknown>;
  canvas_assignment_id: string;
  at: string;
}

/** One run's sync state: gradebook values prepared, plus whatever else it holds. */
export class Ledger {
  path: string;
  entries: Record<string, Entry> = {};
  content: Record<string, unknown> = {};
  pushed: Record<string, unknown> = {};
  assignments: Record<string, AssignmentEntry> = {};

  constructor(path: string) {
    this.path = path;
  }

  static load(courseVersionId: string, directory?: string | null): Ledger {
    const path = join(syncDir(directory), `${courseVersionId}.json`);
    const ledger = new Ledger(path);
    try {
      if (!statSync(path).isFile()) return ledger;
    } catch {
      return ledger;
    }
    const payload = JSON.parse(readFileSync(path, "utf-8"));
    ledger.entries = payload.entries ?? {};
    ledger.content = payload.content ?? {};
    ledger.pushed = payload.pushed ?? {};
    ledger.assignments = payload.assignments ?? {};
    return ledger;
  }

  /** The last value prepared for each student, for one target. */
  prepared(target: string, assessmentId: string): Record<string, number> {
    const prefix = `${target}|${assessmentId}|`;
    const found: Record<string, number> = {};
    for (const [entryKey, entry] of Object.entries(this.entries)) {
      if (!entryKey.startsWith(prefix)) continue;
      if (entry.score === null || entry.score === undefined) continue;
      found[entryKey.slice(prefix.length)] = entry.score;
    }
    return found;
  }

  /**
   * Note what a push did. Returns how many entries were touched.
   *
   * `state` is the distinction the whole file exists for. A CSV target can only
   * ever say `prepared` — a file was written, and whether anyone uploaded it is
   * unknown here. The API may say `applied`, because Canvas confirmed the job
   * completed. Nothing else is allowed to claim that.
   */
  record(
    target: string,
    assessmentId: string,
    rows: { student_id: string; score: number | null; maximum: number | null }[],
    { at, out = null, state = "prepared" }: { at: string; out?: string | null; state?: string },
  ): number {
    if (state !== "prepared" && state !== "applied") {
      throw new Error(`unknown ledger state '${state}'`);
    }
    let touched = 0;
    for (const row of rows) {
      if (row.score === null) continue;
      this.entries[key(target, assessmentId, row.student_id)] = {
        score: row.score,
        maximum: row.maximum,
        state,
        at,
        file: out,
      };
      touched += 1;
    }
    return touched;
  }

  /** What we last sent for one assessment in one Canvas course, or null. */
  preparedAssignment(assessmentId: string, canvasCourseId: string): AssignmentEntry | null {
    return this.assignments[assignmentKey(assessmentId, canvasCourseId)] ?? null;
  }

  /**
   * Note what an assignment push sent.
   *
   * Only ever called after Canvas returned the assignment, so unlike the
   * gradebook half there is no `prepared` versus `applied` distinction to
   * draw: an assignment write either came back or threw.
   */
  recordAssignment(
    assessmentId: string,
    canvasCourseId: string,
    canvasAssignmentId: string,
    spec: Record<string, unknown>,
    at: string,
  ): void {
    this.assignments[assignmentKey(assessmentId, canvasCourseId)] = {
      spec,
      canvas_assignment_id: canvasAssignmentId,
      at,
    };
  }

  save(): string {
    mkdirSync(dirname(this.path), { recursive: true });
    const payload = {
      version: STORE_VERSION,
      note: HEADER_NOTE,
      content: this.content,
      entries: this.entries,
      assignments: this.assignments,
      pushed: this.pushed,
    };
    writeFileSync(this.path, sortedJson(payload) + "\n", { encoding: "utf-8" });
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // A filesystem without POSIX permissions. Nothing to do about it, and the
      // ledger is still outside the repository, which is the part that matters.
    }
    return this.path;
  }
}

/** `json.dumps(..., indent=2, sort_keys=True)`. */
const sortedJson = (value: unknown): string => {
  const sortKeys = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(sortKeys);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const name of Object.keys(node as Record<string, unknown>).sort()) {
        out[name] = sortKeys((node as Record<string, unknown>)[name]);
      }
      return out;
    }
    return node;
  };
  return JSON.stringify(sortKeys(value), null, 2);
};
