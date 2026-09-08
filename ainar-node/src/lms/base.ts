/**
 * What every gradebook target needs, and the join that makes it possible.
 * Ported from `ainar/lms/base.py`.
 *
 * A target — Canvas, a spreadsheet, later an API — receives one score per student
 * per assessment. This module holds the two things none of them can avoid:
 *
 * **The identity join.** Every gradebook keys on a real person: a student number,
 * a login, an email. This repository holds only pseudonyms, and the mapping lives
 * outside it. So the join happens here, in memory, at the moment of export, from
 * the private roster store. Nothing that passes through this module is ever
 * written back into the workspace.
 *
 * **The four-way decision per row.** Given what the decisions say, what the
 * target currently holds, and what we last prepared for it, a cell is new,
 * unchanged, a change we own, or drift — somebody edited it in the target by
 * hand. The last case is the one that matters: overwriting it silently would
 * erase a colleague's correction, or the professor's own.
 */

import { resolve, sep } from "node:path";
import { type GradeRow, exportable } from "../gradebook.ts";
import { RosterStore, loadSalt, pseudonym, rosterDir } from "../roster.ts";

/** How a target's rows are matched to ours. */
export const MATCH_KEYS = ["sis-id", "login", "email"] as const;
export type MatchKey = (typeof MATCH_KEYS)[number];

export const TOLERANCE = 0.01;

/** One real person, held in memory only. */
export interface Identity {
  student_id: string;
  institutional_id: string | null;
  name: string | null;
  email: string | null;
}

/**
 * The pseudonym join, read from the private roster store.
 *
 * Two directions, and they are not symmetrical. A student number resolves
 * through the store when it knows the person, and by derivation —
 * `pseudonym(id, salt)` — when it does not, so a late enrollment still joins
 * correctly. An email or login can only be looked up, because a pseudonym is not
 * derived from either.
 *
 * The store comes first on purpose: it is the record of who someone is, and
 * derivation is a convenience that agrees with it for anyone imported under the
 * current salt.
 */
export class Directory {
  store: RosterStore;
  salt: Buffer;
  private byInstitutional: Map<string, string>;
  private byEmail: Map<string, string>;

  constructor(store: RosterStore, salt: Buffer) {
    this.store = store;
    this.salt = salt;
    this.byInstitutional = store.byInstitutionalId();
    this.byEmail = new Map();
    for (const [studentId, person] of Object.entries(store.people)) {
      const email = (person.email ?? "").trim().toLowerCase();
      if (email) this.byEmail.set(email, studentId);
    }
  }

  static open(explicit?: string | null): Directory {
    const directory = rosterDir(explicit);
    let salt: Buffer;
    try {
      salt = loadSalt(directory, { create: false });
    } catch (error) {
      // Never create one here: a fresh salt would produce pseudonyms that match
      // nothing, and the export would silently name nobody.
      throw new Error(
        `${(error as Error).message}\nWithout the roster there is no way to say which ` +
          "person a pseudonym is, so no gradebook file can be written.",
      );
    }
    return new Directory(RosterStore.load(directory), salt);
  }

  pseudonymFor(value: string, by: MatchKey): string | null {
    const cleaned = (value ?? "").trim();
    if (!cleaned) return null;
    if (by === "sis-id") {
      return this.byInstitutional.get(cleaned) ?? pseudonym(cleaned, this.salt);
    }
    if (by === "login" || by === "email") return this.byEmail.get(cleaned.toLowerCase()) ?? null;
    throw new Error(`unknown match key '${by}'`);
  }

  identity(studentId: string): Identity | null {
    const person = this.store.whois(studentId);
    if (person === null || person === undefined) return null;
    return {
      student_id: studentId,
      institutional_id: person.institutional_id ?? null,
      name: person.name ?? null,
      email: person.email ?? null,
    };
  }
}

// --------------------------------------------------------------------------
// The plan
// --------------------------------------------------------------------------

/** A row that will be written. */
export const WRITES = new Set(["new", "change"]);

export type Action = "new" | "change" | "unchanged" | "drift" | "skip" | "unmatched";

/** One student's cell in one target, and what should happen to it. */
export interface PlanRow {
  student_id: string;
  action: Action;
  score: number | null;
  maximum: number | null;
  comment: string | null;
  current: number | null;
  last_prepared: number | null;
  identity: Identity | null;
  reason: string | null;
}

export const writes = (row: PlanRow): boolean => WRITES.has(row.action);

export const rowAsDict = (row: PlanRow): Record<string, unknown> => ({
  student_id: row.student_id,
  action: row.action,
  score: row.score,
  maximum: row.maximum,
  current: row.current,
  last_prepared: row.last_prepared,
  reason: row.reason,
  has_identity: row.identity !== null,
});

/** Everything that would happen, before anything happens. */
export interface PushPlan {
  course_version_id: string;
  assessment_id: string;
  target: string;
  rows: PlanRow[];
  unknown_in_target: string[];
  notes: string[];
}

export const writable = (plan: PushPlan): PlanRow[] => plan.rows.filter(writes);

export const drift = (plan: PushPlan): PlanRow[] =>
  plan.rows.filter((row) => row.action === "drift");

export const counts = (plan: PushPlan): Record<string, number> => {
  const found: Record<string, number> = {};
  for (const row of plan.rows) found[row.action] = (found[row.action] ?? 0) + 1;
  return found;
};

export const planAsDict = (plan: PushPlan): Record<string, unknown> => ({
  run: plan.course_version_id,
  assessment_id: plan.assessment_id,
  target: plan.target,
  counts: counts(plan),
  unknown_in_target: [...plan.unknown_in_target],
  rows: plan.rows.map(rowAsDict),
  notes: [...plan.notes],
});

/**
 * What should happen to one cell, and why.
 *
 * Drift is the case worth being careful about: the target disagrees with us *and*
 * with what we last prepared, which means a human changed it there. The only safe
 * default is to report it and write nothing.
 */
export const classify = (
  score: number | null,
  current: number | null | undefined,
  lastPrepared: number | null | undefined,
): [Action, string | null] => {
  if (current === null || current === undefined) return ["new", null];
  if (score !== null && Math.abs(current - score) <= TOLERANCE) return ["unchanged", null];
  if (lastPrepared !== null && lastPrepared !== undefined && Math.abs(current - lastPrepared) <= TOLERANCE) {
    return ["change", null];
  }
  return ["drift", `the target holds ${num(current)}, which this workspace did not put there`];
};

/** Python's `%g`. Kept local so this module does not depend on the gradebook's. */
const num = (value: number): string => String(Number(value.toPrecision(6)));

export interface BuildPlanOptions {
  courseVersionId: string;
  assessmentId: string;
  target: string;
  rows: Iterable<GradeRow>;
  directory: Directory | null;
  current?: Record<string, number | null>;
  prepared?: Record<string, number>;
  requireIdentity?: boolean;
}

/** Turn gradebook rows into a plan against one target's current state. */
export const buildPlan = ({
  courseVersionId,
  assessmentId,
  target,
  rows,
  directory,
  current = {},
  prepared = {},
  requireIdentity = true,
}: BuildPlanOptions): PushPlan => {
  const plan: PushPlan = {
    course_version_id: courseVersionId,
    assessment_id: assessmentId,
    target,
    rows: [],
    unknown_in_target: [],
    notes: [],
  };

  for (const row of rows) {
    const identity = directory ? directory.identity(row.student_id) : null;

    if (!exportable(row)) {
      plan.rows.push({
        student_id: row.student_id,
        action: "skip",
        score: row.score,
        maximum: row.maximum,
        comment: null,
        current: null,
        last_prepared: null,
        identity,
        reason: row.blocked.join("; ") || `status ${row.status}`,
      });
      continue;
    }

    if (requireIdentity && identity === null) {
      plan.rows.push({
        student_id: row.student_id,
        action: "unmatched",
        score: row.score,
        maximum: row.maximum,
        comment: null,
        current: null,
        last_prepared: null,
        identity: null,
        reason:
          "not in the roster store, so there is no way to say which person this " +
          "is — run `ainar roster import`",
      });
      continue;
    }

    const [action, reason] = classify(
      row.score,
      current[row.student_id],
      prepared[row.student_id],
    );
    plan.rows.push({
      student_id: row.student_id,
      action,
      score: row.score,
      maximum: row.maximum,
      comment: row.comment,
      current: current[row.student_id] ?? null,
      last_prepared: prepared[row.student_id] ?? null,
      identity,
      reason,
    });
  }

  plan.rows.sort((left, right) =>
    left.action === right.action
      ? left.student_id.localeCompare(right.student_id)
      : left.action.localeCompare(right.action),
  );
  return plan;
};

/** Every file a target writes names people. None may land in the workspace. */
export const refuseInside = (path: string, root: string): void => {
  const resolved = resolve(path);
  const base = resolve(root);
  if (resolved === base || resolved.startsWith(base + sep)) {
    throw new Error(
      `refusing to write ${resolved}, which is inside the workspace. A gradebook ` +
        "file names real students; choose a path outside the repository.",
    );
  }
};
