/**
 * Where AINAR and Canvas disagree, and which side moved.
 *
 * `lms check` already asks Canvas what it holds; this module turns each place
 * the two disagree into a difference with a direction, using the same three
 * values `sync/reconcile.ts` compares — ours, theirs, and the value as last
 * synced:
 *
 *     only AINAR changed   → push     (Sync all sends it)
 *     only Canvas changed  → pull     (never written over a decision: held,
 *                                      or for the class list, imported)
 *     both changed         → conflict (held; the professor keeps one side)
 *     neither can say      → held     (a person Canvas lists that matches
 *                                      nobody surely, a mark not ready to send)
 *
 * The baselines are the ledger's (`~/.ainar/sync/RUN.json`), not new ones: a
 * mark's is what this machine last saw Canvas hold or sent it
 * (`entries["canvas-api|A|S"]`), a definition's is the spec last sent
 * (`assignments`). A mark or field the professor settled with "keep Canvas" is
 * pinned under `syncs["canvas-keep"]` with both sides as they stood: the two
 * may then differ without being a difference, and whichever side moves after
 * that is the one that changed.
 *
 * Definitions count only once this machine has sent one. An assignment made
 * by hand in Canvas and never described from here differs from its record in
 * every field, and none of that is a change anybody made since a sync.
 */

import { createHash } from "node:crypto";

import { roundHalfEven } from "../grading.ts";
import { decide } from "../sync/reconcile.ts";
import type { PlanRow } from "./base.ts";
import type { AssignmentPlan } from "./assignment.ts";
import type { Ledger } from "./ledger.ts";
import type { SyncMatch } from "./roster-sync.ts";

export type DiffKind = "grades" | "assignments" | "roster";
export type Direction = "push" | "pull" | "conflict" | "held";

/** Which side moved since the last sync, in the words the pane shows. */
export type Changed = "ainar" | "canvas" | "both" | "unknown";

export interface Difference {
  kind: DiffKind;
  /** Stable across checks: what a "keep" names and Sync all's preview lists. */
  key: string;
  direction: Direction;
  changed: Changed;
  assessment_id: string | null;
  title: string | null;
  /** The run's subgroup whose Canvas course this is; null for a run that is one course. */
  group: string | null;
  canvas_course: string | null;
  student_id: string | null;
  field: string | null;
  ours: string | null;
  theirs: string | null;
  /** The value as last synced, when there is one. */
  base: string | null;
  reason: string | null;
  /** The two sides as a "keep Canvas" pin records them — `lms keep --ours/--canvas`. */
  pin_ours: string;
  pin_theirs: string;
}

const LONG = 160;

/**
 * A value as a pin holds it: itself, or a digest when it is long — a brief's
 * HTML is compared, not carried through a command line.
 */
export const pinForm = (text: string): string =>
  text.length > LONG ? "sha256:" + createHash("sha256").update(text).digest("hex").slice(0, 32) : text;

/** A value as the pane shows it: a long one cut short. */
const shown = (text: string): string | null => (text === "" ? null : text.length > LONG ? text.slice(0, LONG - 1) + "…" : text);

/** The ledger's `syncs` id the "keep Canvas" pins live under. */
export const KEEP_SYNC = "canvas-keep";

export interface Pin {
  ours: string;
  theirs: string;
  at: string;
}

export const gradeKey = (assessmentId: string, group: string | null, studentId: string): string =>
  `grade|${assessmentId}|${group ?? ""}|${studentId}`;

export const fieldKey = (assessmentId: string, group: string | null, field: string): string =>
  `field|${assessmentId}|${group ?? ""}|${field}`;

export const rosterKey = (group: string | null, who: string): string => `roster|${group ?? ""}|${who}`;

export const pinsOf = (ledger: Ledger): Map<string, Pin> => {
  const pins = new Map<string, Pin>();
  for (const [key, raw] of Object.entries(ledger.synced(KEEP_SYNC))) {
    try {
      const pin = JSON.parse(raw);
      if (pin && typeof pin.ours === "string" && typeof pin.theirs === "string") pins.set(key, pin);
    } catch {
      // A pin this version cannot read is no pin: the row shows again.
    }
  }
  return pins;
};

/** Pin a difference as the professor settled it: Canvas's value stays, and so does ours. */
export const keepCanvas = (ledger: Ledger, key: string, ours: string, theirs: string, at: string): void => {
  ledger.recordSynced(KEEP_SYNC, { [key]: JSON.stringify({ ours: pinForm(ours), theirs: pinForm(theirs), at }) });
};

/** Forget a pin — the two sides agree again, or the professor kept AINAR's. */
export const dropPin = (ledger: Ledger, key: string): void => {
  ledger.recordSynced(KEEP_SYNC, { [key]: null });
};

/**
 * What became of the pins a comparison met: `kept` still differ as the
 * professor left them, `agreed` no longer differ at all and can be dropped.
 */
export interface PinNotes {
  kept: Set<string>;
  agreed: Set<string>;
}

const notePin = (notes: PinNotes | undefined, key: string, pin: Pin | null, ours: string, theirs: string): void => {
  if (!notes || !pin) return;
  if (ours === theirs) notes.agreed.add(key);
  else if (pinForm(ours) === pin.ours && pinForm(theirs) === pin.theirs) notes.kept.add(key);
};

const changedFor = (direction: Direction): Changed =>
  direction === "push" ? "ainar" : direction === "pull" ? "canvas" : direction === "conflict" ? "both" : "unknown";

/**
 * One value's direction, or null when there is nothing to do.
 *
 * Without a pin this is `reconcile.decide` for a two-way sync: the base is
 * one value both sides shared. With one, each side has its own baseline —
 * what it held when the professor kept Canvas's — and is compared with that.
 */
export const directionOf = (
  ours: string,
  theirs: string,
  base: string | null,
  pin: Pin | null = null,
): Direction | null => {
  if (ours === theirs) return null;
  if (pin) {
    const oursMoved = pinForm(ours) !== pin.ours;
    const theirsMoved = pinForm(theirs) !== pin.theirs;
    if (!oursMoved && !theirsMoved) return null;
    return oursMoved && theirsMoved ? "conflict" : oursMoved ? "push" : "pull";
  }
  const verdict = decide("", ours, base, theirs, "both").verdict;
  return verdict === "send" ? "push" : verdict === "take" ? "pull" : verdict === "conflict" ? "conflict" : null;
};

/** A score as the two sides are compared: two places, `""` for none. */
export const scoreText = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "" : String(roundHalfEven(value, 2));

const orNull = (text: string): string | null => (text === "" ? null : text);

/**
 * One assessment's marks in one Canvas course.
 *
 * `rows` is `lms plan`'s, on Canvas's scale; `current` what Canvas holds per
 * student, `excused` who it holds as EX; `prepared` the ledger's last value.
 * A row the plan could not place in Canvas is not compared — the class list
 * half says why.
 */
export const gradeDifferences = (input: {
  assessmentId: string;
  title: string | null;
  group: string | null;
  canvasCourse: string | null;
  rows: PlanRow[];
  current: Record<string, number | null>;
  excused: ReadonlySet<string>;
  prepared: Record<string, number>;
  pins: Map<string, Pin>;
  notes?: PinNotes;
}): Difference[] => {
  const found: Difference[] = [];
  for (const row of input.rows) {
    if (row.action === "unmatched") continue;
    const student = row.student_id;
    const theirs = input.excused.has(student) ? "EX" : scoreText(input.current[student]);
    const ours = row.action === "excuse" ? "EX" : row.action === "skip" ? "" : scoreText(row.score);
    const base = student in input.prepared ? scoreText(input.prepared[student]) : null;
    const key = gradeKey(input.assessmentId, input.group, student);
    const pin = input.pins.get(key) ?? null;
    notePin(input.notes, key, pin, ours, theirs);
    let direction = directionOf(ours, theirs, base, pin);
    if (direction === null) continue;
    let reason: string | null = null;
    // Nothing of ours to send: the mark here is not ready, or was taken back.
    if (direction === "push" && ours === "") {
      direction = "held";
      reason = row.reason ?? "no mark here to send";
    } else if (row.action === "skip") {
      reason = row.reason;
    } else if (direction === "pull") {
      reason = "changed in Canvas; a Canvas total is not split into criteria here";
    }
    found.push({
      kind: "grades",
      key,
      direction,
      changed: ours === "" && direction === "held" ? "unknown" : changedFor(direction),
      assessment_id: input.assessmentId,
      title: input.title,
      group: input.group,
      canvas_course: input.canvasCourse,
      student_id: student,
      field: null,
      ours: orNull(ours),
      theirs: orNull(theirs),
      base,
      reason,
      pin_ours: pinForm(ours),
      pin_theirs: pinForm(theirs),
    });
  }
  return found;
};

/**
 * One assessment's definition in one Canvas course, from `planAssignment`.
 * Only a definition this machine has sent has a baseline; `null` otherwise.
 */
export const assignmentDifferences = (input: {
  plan: AssignmentPlan;
  title: string | null;
  sent: boolean;
  pins: Map<string, Pin>;
  notes?: PinNotes;
}): Difference[] => {
  if (!input.sent) return [];
  const { plan } = input;
  const found: Difference[] = [];
  for (const row of plan.fields) {
    const key = fieldKey(plan.assessment_id, plan.group, row.field);
    const pin = input.pins.get(key) ?? null;
    const ours = row.desired ?? "";
    const theirs = row.current ?? "";
    if (row.action === "unchanged") {
      if (pin && input.notes) input.notes.agreed.add(key);
      continue;
    }
    notePin(input.notes, key, pin, ours, theirs);
    let direction: Direction | null;
    if (pin) direction = directionOf(ours, theirs, null, pin);
    else if (row.action === "drift") direction = row.ours_changed ? "conflict" : "pull";
    else direction = "push";
    if (direction === null) continue;
    found.push({
      kind: "assignments",
      key,
      direction,
      changed: changedFor(direction),
      assessment_id: plan.assessment_id,
      title: input.title,
      group: plan.group,
      canvas_course: plan.canvas_course_id,
      student_id: null,
      field: row.field,
      ours: shown(ours),
      theirs: shown(theirs),
      base: null,
      pin_ours: pinForm(ours),
      pin_theirs: pinForm(theirs),
      reason: direction === "pull" ? "edited in Canvas; the record is not changed from here" : row.reason,
    });
  }
  return found;
};

/**
 * The class list: Canvas is its source (`roster sync`), so a person Canvas
 * has and this run does not is a pull, and one this run has that Canvas does
 * not is held — nothing here can enrol anybody in Canvas, and marking them
 * dropped is the professor's call. A Canvas student nobody is surely is held
 * too: unsure matches wait for a person.
 */
export const rosterDifferences = (input: {
  matches: SyncMatch[];
  /** Active enrollments of this run: student → subgroup ("" for none). */
  enrolled: Map<string, string>;
  /** The subgroups whose Canvas course was read; null for a run that is one course. */
  groups: (string | null)[];
  /** Student → the day a roster sync first found them missing (`Enrollment.lms`). */
  missingSince?: Map<string, string>;
}): Difference[] => {
  const found: Difference[] = [];
  const base = (fields: Partial<Difference> & { key: string; direction: Direction }): Difference => ({
    kind: "roster",
    changed: changedFor(fields.direction),
    assessment_id: null,
    title: null,
    group: null,
    canvas_course: null,
    student_id: null,
    field: null,
    ours: null,
    theirs: null,
    base: null,
    reason: null,
    pin_ours: "",
    pin_theirs: "",
    ...fields,
  });
  const placed = new Set<string>();
  for (const match of input.matches) {
    if (!match.student) {
      found.push(
        base({
          key: rosterKey(match.group, `canvas:${match.canvasId}`),
          direction: "held",
          group: match.group,
          theirs: `Canvas user ${match.canvasId}`,
          reason: `Canvas user ${match.canvasId} ${match.problem ?? "could not be placed"}`,
        }),
      );
      continue;
    }
    placed.add(match.student);
    const here = input.enrolled.get(match.student);
    if (here === undefined) {
      found.push(
        base({
          key: rosterKey(match.group, match.student),
          direction: "pull",
          group: match.group,
          student_id: match.student,
          theirs: match.group ?? "enrolled",
          reason: match.how === "new" ? "new in Canvas" : "in Canvas, not active in this run",
        }),
      );
    } else if (match.group && here !== match.group) {
      found.push(
        base({
          key: rosterKey(match.group, match.student),
          direction: "pull",
          group: match.group,
          student_id: match.student,
          ours: here || null,
          theirs: match.group,
          reason: `in ${match.group}'s Canvas course, ${here ? `in ${here}` : "in no subgroup"} here`,
        }),
      );
    } else if (input.missingSince?.has(match.student)) {
      // Noted missing by an earlier sync and listed again: the note is turned
      // round by the next `roster sync`, which is what taking this does.
      found.push(
        base({
          key: rosterKey(match.group, match.student),
          direction: "pull",
          group: match.group,
          student_id: match.student,
          ours: "not in Canvas",
          theirs: match.group ?? "enrolled",
          reason: `back in Canvas; missing since ${input.missingSince.get(match.student)}`,
        }),
      );
    }
  }
  const read = new Set(input.groups.map((group) => group ?? ""));
  for (const [student, group] of input.enrolled) {
    if (placed.has(student)) continue;
    // Only a course that was read can say who is missing from it.
    if (!read.has(group) && !read.has("")) continue;
    const since = input.missingSince?.get(student);
    found.push(
      base({
        key: rosterKey(group || null, student),
        direction: "held",
        group: group || null,
        student_id: student,
        ours: group || "enrolled",
        // The day it was noted, as last synced. Without one, no sync has
        // written it on the student yet: Sync all does.
        base: since ?? null,
        reason: since ? `enrolled here, not in the Canvas course since ${since}` : "enrolled here, not in the Canvas course",
      }),
    );
  }
  return found;
};

export type Tally = Record<DiffKind, Record<Direction, number>>;

export const tallyDifferences = (differences: Difference[]): Tally => {
  const empty = (): Record<Direction, number> => ({ push: 0, pull: 0, conflict: 0, held: 0 });
  const tally: Tally = { grades: empty(), assignments: empty(), roster: empty() };
  for (const difference of differences) tally[difference.kind][difference.direction] += 1;
  return tally;
};

/**
 * What Sync all does with a set of differences: the one-sided ones it can
 * apply, and the rest it leaves. A grade or definition Canvas changed is held
 * like a conflict — applying it would mean writing over a professor's decision
 * — but stays labelled as Canvas's change.
 */
export const syncAllPlan = (differences: Difference[]) => {
  const send = differences.filter((entry) => entry.direction === "push" && entry.kind !== "roster");
  const take = differences.filter((entry) => entry.direction === "pull" && entry.kind === "roster");
  const held = differences.filter((entry) => !send.includes(entry) && !take.includes(entry));
  /** In this run, not in Canvas, and not yet noted on the student: a sync writes the note, and drops nobody. */
  const absent = held.filter((entry) => entry.kind === "roster" && entry.student_id && entry.base === null);
  /** The pushes, one command each: an assessment in one Canvas course. */
  const batches = new Map<string, { kind: DiffKind; assessment_id: string; group: string | null; students: string[]; fields: string[] }>();
  for (const entry of send) {
    const id = `${entry.kind}|${entry.assessment_id}|${entry.group ?? ""}`;
    const batch = batches.get(id) ?? { kind: entry.kind, assessment_id: entry.assessment_id!, group: entry.group, students: [], fields: [] };
    if (entry.student_id) batch.students.push(entry.student_id);
    if (entry.field) batch.fields.push(entry.field);
    batches.set(id, batch);
  }
  return { send, take, held, absent, batches: [...batches.values()] };
};
