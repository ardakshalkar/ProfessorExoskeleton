/**
 * Which way each value should go, given three of them.
 *
 * Two values — ours and theirs — cannot tell a change we made from a change a
 * person made on the far side; every sync tool that writes into something a
 * human also edits keeps a third, the value as last synced (kubectl's
 * last-applied, Census's mirror state, Canvas's SIS stickiness). This module is
 * that comparison, once, for every role:
 *
 *     ours   base   theirs   →
 *     a      a      a          same
 *     b      a      a          send      (we changed it)
 *     a      a      b          take      (they changed it)
 *     b      a      c          conflict  (both did; `conflict` decides)
 *     b      a      b          same      (both did, the same way)
 *
 * `base` absent is the first sync: equal values are `same`, one side empty
 * goes to the other, and two different values are a conflict — nobody can say
 * which came first. A `source` never sends and a `target` never takes; what a
 * one-way sync would have taken is reported as `drift`, the far side edited
 * against the direction the data runs.
 *
 * Values are strings, the form both sides can be compared in; empty string is
 * "nothing there".
 */

export type Role = "source" | "target" | "both";
export type ConflictRule = "refuse" | "course-wins" | "remote-wins" | "fill-blanks";

export type Verdict = "same" | "send" | "take" | "conflict" | "drift";

export interface Decision {
  key: string;
  verdict: Verdict;
  ours: string;
  base: string | null;
  theirs: string;
  /** For a conflict the rule settled, which side won. */
  resolvedBy?: string;
}

const blank = (value: string | null | undefined): boolean => value === null || value === undefined || value === "";

const settle = (
  decision: Decision,
  rule: ConflictRule,
): Decision => {
  const { ours, theirs } = decision;
  if (rule === "course-wins") return { ...decision, verdict: "send", resolvedBy: "course-wins" };
  if (rule === "remote-wins") return { ...decision, verdict: "take", resolvedBy: "remote-wins" };
  if (rule === "fill-blanks") {
    if (blank(theirs)) return { ...decision, verdict: "send", resolvedBy: "fill-blanks" };
    if (blank(ours)) return { ...decision, verdict: "take", resolvedBy: "fill-blanks" };
  }
  return { ...decision, verdict: "conflict" };
};

/** One value. */
export const decide = (
  key: string,
  ours: string,
  base: string | null | undefined,
  theirs: string,
  role: Role,
  rule: ConflictRule = "refuse",
): Decision => {
  const decision: Decision = { key, verdict: "same", ours, base: base ?? null, theirs };
  if (ours === theirs) return decision;

  let verdict: Verdict;
  if (base === null || base === undefined) {
    verdict = blank(theirs) ? "send" : blank(ours) ? "take" : "conflict";
  } else if (theirs === base) {
    verdict = "send";
  } else if (ours === base) {
    verdict = "take";
  } else {
    verdict = "conflict";
  }

  // Direction: a one-way sync cannot move a value against itself.
  if (role === "source" && verdict === "send") return { ...decision, verdict: "same" };
  if (role === "target" && verdict === "take") return { ...decision, verdict: "drift" };
  if (role === "target" && verdict === "conflict") {
    const settled = settle({ ...decision, verdict }, rule);
    return settled.verdict === "take" ? { ...settled, verdict: "drift" } : settled;
  }
  if (role === "source" && verdict === "conflict") {
    const settled = settle({ ...decision, verdict }, rule);
    return settled.verdict === "send" ? { ...settled, verdict: "same" } : settled;
  }
  if (verdict === "conflict") return settle({ ...decision, verdict }, rule);
  return { ...decision, verdict };
};

/** Every key either side or the base knows. */
export const reconcile = (
  ours: Record<string, string>,
  base: Record<string, string>,
  theirs: Record<string, string>,
  role: Role,
  rule: ConflictRule = "refuse",
): Decision[] => {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(base), ...Object.keys(theirs)])].sort();
  return keys
    .map((key) => decide(key, ours[key] ?? "", base[key], theirs[key] ?? "", role, rule))
    .filter((decision) => decision.verdict !== "same" || decision.ours !== "");
};

export const tally = (decisions: Decision[]): Record<Verdict, number> => {
  const counts: Record<Verdict, number> = { same: 0, send: 0, take: 0, conflict: 0, drift: 0 };
  for (const decision of decisions) counts[decision.verdict] += 1;
  return counts;
};
