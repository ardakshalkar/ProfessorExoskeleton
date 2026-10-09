/**
 * Who a row on the far side is: one matcher for every sync.
 *
 * The steps are the sync's `match` list, tried in order, and the answer is one
 * of three — the same three every road reports:
 *
 * * **placed** — sure. Saved as a link, so the next sync finds them by `link`.
 * * **check** — a close spelling or a single word, under `unsure: ask`:
 *   written, and listed for a person to look at.
 * * **held** — not written. Either nothing fits, or two people do, or the
 *   match was unsure under `unsure: hold`; then it waits in the review queue
 *   with its candidates until `ainar sync confirm` or `ainar sync link`.
 *
 * Names are matched by `identify` in `scans.ts`, the matcher scans and the
 * Canvas class list already use, so a name means the same thing on every road.
 * What this adds is the order, the memory and the queue — the pattern record
 * linkage settled on long ago: link what is sure, refuse what is not, and send
 * the band in between to a person rather than choosing (Fellegi–Sunter's
 * clerical review; Ed-Fi's "do not automate the selection").
 */

import type { RosterStore } from "../roster.ts";
import { identify, nameCandidates } from "../scans.ts";
import { type Candidate, type LinkTable, anchorLinkKey, nameLinkKey } from "./links.ts";

export type MatchStep =
  | "link" | "anchor" | "code" | "key:sis-id" | "key:login" | "key:email" | "key:number" | "name" | "name:one-word";

export interface RowIdentity {
  /** How the row reads to a person: the name as written, a file name. */
  label: string;
  line?: number | null;
  name?: string | null;
  number?: string | null;
  /** A cell that may hold `STUDENT-…`. */
  code?: string | null;
  /** The invisible tag on the row, when the sync anchors. */
  anchor?: string | null;
  /** An identifier the roster may hold, with its kind. */
  key?: { kind: "sis-id" | "login" | "email"; value: string } | null;
}

export type Outcome =
  | { status: "placed"; student: string; how: string }
  | { status: "check"; student: string; how: string }
  | { status: "held"; problem: string; candidates: Candidate[]; queued: boolean };

export interface MatchContext {
  syncId: string;
  steps: MatchStep[];
  unsure: "hold" | "ask";
  links: LinkTable;
  store: RosterStore;
  salt: Uint8Array | null;
  enrolled: Set<string>;
  at: string;
}

/** What a sync matches by when it does not say. */
export const DEFAULT_STEPS: MatchStep[] = ["link", "code", "name"];

const CODE = /\bSTUDENT-[A-Z0-9]{4,}\b/;

const lookupKey = (store: RosterStore, kind: "sis-id" | "login" | "email", value: string): string | null => {
  const wanted = value.trim();
  if (!wanted) return null;
  const lower = wanted.toLowerCase();
  for (const [student, person] of Object.entries(store.people)) {
    const p = person as Record<string, unknown>;
    if (kind === "sis-id" && (p.institutional_id === wanted || p.sis_user_id === wanted)) return student;
    if (kind === "login" && String(p.login_id ?? "").toLowerCase() === lower) return student;
    if (kind === "email" && (String(p.email ?? "").toLowerCase() === lower || String(p.login_id ?? "").toLowerCase() === lower)) {
      return student;
    }
  }
  return null;
};

/** The keys a row may be linked under, strongest first. */
export const rowKeys = (row: RowIdentity): string[] => [
  ...(row.anchor ? [anchorLinkKey(row.anchor)] : []),
  ...(row.name && row.name.trim() ? [nameLinkKey(row.name)] : []),
];

/**
 * Match one row, and remember what was learnt in `context.links`.
 *
 * Nothing is saved to disk here; the caller saves the table when the sync
 * actually runs, so a dry run leaves no trace.
 */
export const matchRow = (row: RowIdentity, context: MatchContext): Outcome => {
  const { syncId, steps, links, enrolled } = context;
  const keys = rowKeys(row);
  const remember = (student: string, how: string): void => {
    for (const key of keys) {
      const existing = links.get(syncId, key);
      if (existing?.student === student) continue;
      if (existing && ["confirmed", "pinned"].includes(existing.how)) continue; // a person's word stands
      links.set(syncId, key, { student, how, at: context.at, label: row.label });
    }
  };
  const enrolledOrHeld = (student: string, how: string): Outcome =>
    enrolled.has(student)
      ? { status: "placed", student, how }
      : { status: "held", problem: `linked to ${student}, who is not enrolled in this run`, candidates: [], queued: false };

  const partial = steps.includes("name:one-word");
  let nameTried = false;
  let lastProblem: string | null = null;

  for (const step of steps) {
    if (step === "link" || step === "anchor") {
      const candidates = step === "anchor" ? keys.filter((key) => key.startsWith("anchor:")) : keys;
      for (const key of candidates) {
        const link = links.get(syncId, key);
        if (!link) continue;
        const outcome = enrolledOrHeld(link.student, "link");
        // An anchor found by name the first time is tied to the name's link too.
        if (outcome.status === "placed") remember(link.student, link.how);
        return outcome;
      }
      continue;
    }
    if (step === "code") {
      const found = row.code ? CODE.exec(row.code)?.[0] : null;
      if (!found) continue;
      const outcome = enrolledOrHeld(found, "code");
      if (outcome.status === "placed") remember(found, "code");
      return outcome;
    }
    if (step === "key:number") {
      if (!row.number) continue;
      const identity = identify({ number: row.number } as any, { store: context.store, salt: context.salt, enrolled });
      if ("student" in identity) {
        remember(identity.student, "key");
        return { status: "placed", student: identity.student, how: "key" };
      }
      lastProblem = identity.problem;
      continue;
    }
    if (step.startsWith("key:")) {
      const kind = step.slice(4) as "sis-id" | "login" | "email";
      if (!row.key || row.key.kind !== kind) continue;
      const student = lookupKey(context.store, kind, row.key.value);
      if (!student) {
        lastProblem = `no student in the roster has that ${kind}`;
        continue;
      }
      const outcome = enrolledOrHeld(student, "key");
      if (outcome.status === "placed") remember(student, "key");
      return outcome;
    }
    if (step === "name" || step === "name:one-word") {
      if (nameTried || !row.name || !row.name.trim()) continue;
      nameTried = true;
      const identity = identify({ name: row.name } as any, {
        store: context.store,
        salt: context.salt,
        enrolled,
        partial,
      });
      if ("problem" in identity) {
        lastProblem = identity.problem;
        continue;
      }
      const match = (identity as { match?: string }).match;
      if (match !== "close" && match !== "partial") {
        remember(identity.student, match ?? "name");
        return { status: "placed", student: identity.student, how: match ?? "name" };
      }
      if (context.unsure === "ask") return { status: "check", student: identity.student, how: match };
      const others = nameCandidates(row.name, { store: context.store, enrolled })
        .filter((candidate) => candidate.student !== identity.student)
        .map((candidate) => ({ student: candidate.student, match: `distance ${candidate.distance}` }));
      return held(row, context, {
        problem: `${match === "close" ? "a close spelling" : "only one word"} of ${identity.student} — confirm it, or link someone else`,
        candidates: [{ student: identity.student, match }, ...others],
      });
    }
  }

  if (!keys.length && !row.code && !row.number && !row.key) {
    return { status: "held", problem: "nothing on the row to match on", candidates: [], queued: false };
  }
  const near = row.name
    ? nameCandidates(row.name, { store: context.store, enrolled }).map((candidate) => ({
        student: candidate.student,
        match: `distance ${candidate.distance}`,
      }))
    : [];
  return held(row, context, { problem: lastProblem ?? "the row matches no enrolled student", candidates: near });
};

/** Hold a row, and queue it for review when there is a key to review it under. */
const held = (
  row: RowIdentity,
  context: MatchContext,
  { problem, candidates }: { problem: string; candidates: Candidate[] },
): Outcome => {
  const key = rowKeys(row)[0] ?? null;
  if (key && candidates.length) {
    context.links.queue(context.syncId, key, {
      label: row.label,
      line: row.line ?? null,
      candidates,
      why: problem,
      at: context.at,
    });
  }
  return { status: "held", problem, candidates, queued: Boolean(key && candidates.length) };
};
