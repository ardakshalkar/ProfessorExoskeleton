/**
 * Proposals for the grading policy: what the assistant hands the professor.
 *
 * The professor asks for a change in words in the pane's policy editor. The
 * session — the only place judgement runs — reads the course and answers with
 * a whole policy, not prose, through `ainar grading propose`. That command is
 * the only way a proposal is recorded, and it records nothing it has not
 * checked: the same `readProposal` the editor's write uses, and the same
 * impact, so a proposal with a broken structure goes back to the session as an
 * error instead of reaching the professor.
 *
 * A proposal is not a change. It sits in the run record under
 * `grading_scheme.extensions.proposals`, newest last, until the professor
 * loads it into the editor and applies it (which clears the list, since every
 * proposal was made against the policy just replaced) or discards it. Kept in
 * the record rather than a private file so the session can read back what it
 * proposed before, and so git has the conversation along with the outcome.
 */

import { createHash } from "node:crypto";

import { runById, type CourseBundle } from "./bundle.ts";
import { policyBase, policyImpact, readProposal, stripped, type Proposal } from "./grading-policy.ts";
import { COLLECTIONS } from "./loader.ts";
import { editRecords } from "./record-edit.ts";

export interface ProposalEntry {
  id: string;
  at: string;
  /** The professor's words, as the pane sent them. */
  request: string | null;
  /** The assistant's reasons, in a few sentences. */
  note: string | null;
  by: string | null;
  /** The policy it was made against, so the pane can say when it is stale. */
  base: string;
  summary: string[];
  proposal: { components: Record<string, unknown>[]; points: number | null; assignments: Proposal["assignments"] };
}

const where = (root: string, run: any) => ({
  root,
  courseId: run.course_id,
  patterns: COLLECTIONS.versions,
  idField: "course_version_id",
  collection: "versions",
});

export const proposalsOf = (bundle: CourseBundle, runId: string): ProposalEntry[] => {
  const run = runById(bundle).get(runId) as any;
  const list = run?.grading_scheme?.extensions?.proposals;
  return Array.isArray(list) ? list : [];
};

/**
 * Check a proposal and record it. Throws, writing nothing, when the policy is
 * locked, when the proposal does not parse, when it would not hold together,
 * or when it changes nothing.
 */
export const recordProposal = (
  root: string,
  bundle: CourseBundle,
  runId: string,
  raw: unknown,
  { note = null, request = null, by = null, at = new Date().toISOString() }: { note?: string | null; request?: string | null; by?: string | null; at?: string } = {},
): { entry: ProposalEntry; written: string[] } => {
  const run = runById(bundle).get(runId) as any;
  if (!run) throw new Error(`no course run '${runId}'`);
  if (run.grading_scheme?.locked === true) {
    throw new Error("the grading policy is locked; the professor unlocks it in the Gradebook before anything can be proposed");
  }
  const proposal = readProposal(bundle, runId, raw);
  const impact = policyImpact(bundle, runId, proposal);
  if (impact.errors.length) {
    throw new Error(`the proposal would not hold together: ${impact.errors.map((issue) => `${issue.location ?? ""} ${issue.message}`.trim()).join("; ")}`);
  }
  if (impact.nothing) throw new Error("the proposal changes nothing against the current policy");

  const body = { components: proposal.components.map(stripped), points: proposal.points, assignments: proposal.assignments };
  const entry: ProposalEntry = {
    id: "P-" + createHash("sha256").update(at + JSON.stringify(body)).digest("hex").slice(0, 8).toUpperCase(),
    at,
    request: clip(request, 1000),
    note: clip(note, 2000),
    by: clip(by, 80),
    base: policyBase(bundle, runId),
    summary: impact.summary,
    proposal: body,
  };
  const result = editRecords({
    ...where(root, run),
    edits: new Map([
      [
        runId,
        (node: any) => {
          const list = node.getIn(["grading_scheme", "extensions", "proposals"]);
          const items = list && Array.isArray(list.items) ? list.toJSON() : [];
          node.setIn(["grading_scheme", "extensions", "proposals"], [...items, entry]);
        },
      ],
    ]),
  });
  return { entry, written: result.written };
};

/** Take one proposal back, or all of them (`id` null). */
export const dropProposals = (root: string, bundle: CourseBundle, runId: string, id: string | null): { dropped: number; written: string[] } => {
  const run = runById(bundle).get(runId) as any;
  if (!run) throw new Error(`no course run '${runId}'`);
  const before = proposalsOf(bundle, runId);
  const kept = id === null ? [] : before.filter((entry) => entry.id !== id);
  if (kept.length === before.length) return { dropped: 0, written: [] };
  const result = editRecords({
    ...where(root, run),
    edits: new Map([
      [
        runId,
        (node: any) => {
          if (kept.length) node.setIn(["grading_scheme", "extensions", "proposals"], kept);
          else node.deleteIn(["grading_scheme", "extensions", "proposals"]);
        },
      ],
    ]),
  });
  return { dropped: before.length - kept.length, written: result.written };
};

const clip = (value: string | null | undefined, length: number): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, length) : null;
};
