/**
 * The grading policy from the Gradebook: read it, say what a change would do,
 * and write the change — guarded.
 *
 * WHY THE PANE MAY WRITE THIS, AND WHY IT IS GUARDED
 * --------------------------------------------------
 * How the grade is divided is the professor's decision, like a due date
 * (`plan-writes.js`), so there is no draft stage. Unlike a due date it moves
 * numbers somebody else has already seen: every student's block totals, and
 * what an assessment is out of in Canvas, where marks may already sit on the
 * old scale. So a write here takes four things a date move does not:
 *
 * - **The base it was made against** (`policyBase`). A proposal built before
 *   the session, another window, or a hand edit changed the policy is refused
 *   rather than undoing that change.
 * - **No lock.** `grading_scheme.locked` freezes the policy; unlocking is its
 *   own press and its own line in the history.
 * - **No structural errors in the result.** The impact runs the validator on
 *   the course as it would be; a cycle or a block that does not exist is not
 *   written.
 * - **Acknowledgement**, when the change moves a student's total or touches an
 *   assessment Canvas already has marks for. The page shows those first.
 *
 * Every write keeps what it replaced in `grading_scheme.extensions.history`,
 * which the Gradebook's "Last changes" reads back and can restore from.
 */

import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { assessmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { COLLECTIONS } from "@ainar/core/src/loader.ts";
import { editRecords, setRecordFields } from "@ainar/core/src/record-edit.ts";
import {
  currentProposal,
  fromPreset,
  historyEntry,
  policyBase,
  policyDocument,
  policyImpact,
  readProposal,
  stripped,
} from "@ainar/core/src/grading-policy.ts";
import { gradeChanges, realChanges } from "@ainar/core/src/grade-changes.ts";
import { dropProposals, proposalsOf } from "@ainar/core/src/grading-proposals.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";

import { editRunRecord } from "./run-record.js";
import { marksActivity } from "./syncs.js";
import { loadedRun, rosterPeople } from "./workspace.js";

/** How many marks Canvas has confirmed, per assessment: the ledger `canvasMarks` reads. */
const sentCounts = (bundle, runId) => {
  const ledger = Ledger.load(runId);
  return new Map(
    assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id, Object.keys(ledger.prepared("canvas-api", entry.assessment_id)).length]),
  );
};

/** This repository's CLI, the one the session runs: `bin/ainar`, or `bin\ainar.cmd` on Windows. */
const AINAR_CLI = join(fileURLToPath(new URL("../../../bin/", import.meta.url)), process.platform === "win32" ? "ainar.cmd" : "ainar");

/**
 * The exact command that records a proposal for this run, with the
 * workspace root filled in — handed to the session with each request, so it
 * spends no steps finding the CLI or the workspace. FILE, WORDS and WHY are
 * the session's to fill.
 */
const proposeCommand = (root, runId) =>
  (process.platform === "win32" ? "& " : "") + `"${AINAR_CLI}" grading propose ${runId} --root "${root}" --file FILE --request "WORDS" --note "WHY"`;

export const gradingPolicy = (workspace, runId, root = null) => {
  const { bundle } = loadedRun(workspace, runId);
  const doc = policyDocument(bundle, runId);
  const sent = sentCounts(bundle, runId);
  doc.assessments = doc.assessments.map((entry) => ({ ...entry, sent: sent.get(entry.assessment_id) ?? 0 }));
  // The assistant's proposals, newest last, each marked stale when the policy
  // moved since it was made (grading-proposals.ts).
  doc.proposals = proposalsOf(bundle, runId).map((entry) => ({ ...entry, stale: entry.base !== doc.base }));
  if (root) doc.propose_command = proposeCommand(root, runId);
  return doc;
};

/** Take one of the assistant's proposals back; `all` takes every one. */
export const discardGradingProposal = (workspace, root, runId, body) => {
  const { bundle } = loadedRun(workspace, runId);
  const id = body?.all === true ? null : String(body?.id ?? "").trim();
  if (id !== null && !/^P-[0-9A-F]{8}$/.test(id)) return { error: "Not a proposal id." };
  try {
    return { written: true, ...dropProposals(root, bundle, runId, id) };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};

/**
 * What a proposal — or a preset laid over the course — would change. A
 * preset answers with the proposal it built too, so the page can show it in
 * the editor and the professor adjusts from there.
 */
export const gradingImpact = (workspace, runId, body) => {
  const { bundle } = loadedRun(workspace, runId);
  let proposal;
  try {
    proposal = body?.preset ? fromPreset(bundle, runId, String(body.preset)) : readProposal(bundle, runId, body?.proposal);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
  const impact = policyImpact(bundle, runId, proposal, { sent: sentCounts(bundle, runId) });
  if (body?.names) {
    const people = rosterPeople();
    for (const row of impact.students.rows) row.name = people?.[row.student_id]?.name ?? null;
  }
  return { proposal, impact };
};

/** Append one entry to `grading_scheme.extensions.history`, creating the path when it is absent. */
const pushHistory = (node, document, entry) => {
  const list = node.getIn(["grading_scheme", "extensions", "history"]);
  if (list && Array.isArray(list.items)) list.items.push(document.createNode(entry));
  else node.setIn(["grading_scheme", "extensions", "history"], document.createNode([entry]));
};

export const writeGradingPolicy = (workspace, root, runId, body) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (run.grading_scheme?.locked === true) return { error: "The grading policy is locked. Unlock it first; nothing was written." };
  if (String(body?.base ?? "") !== policyBase(bundle, runId)) {
    return { error: "The policy changed since this edit began — by the session, another window or a hand edit. Reload it and make the change again; nothing was written.", stale: true };
  }
  let proposal;
  try {
    proposal = readProposal(bundle, runId, body?.proposal);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
  const impact = policyImpact(bundle, runId, proposal, { sent: sentCounts(bundle, runId) });
  if (impact.nothing) return { error: "Nothing changes; nothing was written." };
  if (impact.errors.length) return { error: `The policy would not hold together: ${impact.errors[0].message}. Nothing was written.`, impact };
  if (impact.weighty && body?.acknowledged !== true) {
    return { error: "This moves students' totals, marks Canvas already has, or the blocks Canvas groups hang on. Read the impact and confirm.", impact, needs_ack: true };
  }

  if (!run.course_id || !run.term) return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  const entry = historyEntry(bundle, runId, {
    at: new Date().toISOString(),
    action: "change",
    summary: impact.summary,
    by: typeof body?.by === "string" ? body.by : null,
  });
  if (typeof body?.note === "string" && body.note.trim()) entry.note = body.note.trim().slice(0, 500);
  // The run record's half, applied when it is written, after the assessments.
  const policy = (node, document) => {
    node.setIn(["grading_scheme", "components"], document.createNode(proposal.components.map(stripped)));
    if (proposal.points == null) node.deleteIn(["grading_scheme", "points"]);
    else node.setIn(["grading_scheme", "points"], proposal.points);
    pushHistory(node, document, entry);
    // Every pending proposal was made against the policy this replaces.
    node.deleteIn(["grading_scheme", "extensions", "proposals"]);
  };

  // The assessments: block and weight, one scalar each; a cleared one is a deleted key.
  const before = currentProposal(bundle, runId);
  const sets = new Map();
  const clears = new Map();
  for (const [id, next] of Object.entries(proposal.assignments)) {
    const was = before.assignments[id];
    if (!was) continue;
    const fields = {};
    const gone = [];
    if ((was.component ?? null) !== (next.component ?? null)) {
      if (next.component) fields.component = next.component;
      else gone.push("component");
    }
    if (Math.abs(Number(was.weight ?? -1) - Number(next.weight ?? -1)) > 1e-12) {
      if (next.weight != null) fields.weight = next.weight;
      else gone.push("weight");
    }
    if (Object.keys(fields).length) sets.set(id, fields);
    if (gone.length) clears.set(id, gone);
  }
  const where = {
    root,
    courseId: run.course_id,
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
  };
  try {
    const set = setRecordFields({ ...where, edits: sets });
    if (clears.size) {
      editRecords({
        ...where,
        edits: new Map([...clears].map(([id, keys]) => [id, (node) => keys.forEach((key) => node.has(key) && node.delete(key))])),
      });
    }
    const path = editRunRecord(root, run, policy);
    return { written: true, path, assessments: set.count + clears.size, summary: impact.summary };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};

/** Lock or unlock the policy: one field and one history line, against the same base. */
export const writeGradingLock = (workspace, root, runId, body) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  const locking = body?.locked === true;
  if ((run.grading_scheme?.locked === true) === locking) return { error: locking ? "It is already locked." : "It is not locked." };
  if (!locking && String(body?.confirm ?? "").trim().toUpperCase() !== "UNLOCK") {
    return { error: "Type UNLOCK to unlock the grading policy." };
  }
  const reason = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const entry = historyEntry(bundle, runId, {
    at: new Date().toISOString(),
    action: locking ? "lock" : "unlock",
    summary: [locking ? "Policy locked." : "Policy unlocked."],
  });
  if (reason) entry.note = reason;
  try {
    const path = editRunRecord(root, run, (node, document) => {
      if (locking) node.setIn(["grading_scheme", "locked"], true);
      else node.deleteIn(["grading_scheme", "locked"]);
      pushHistory(node, document, entry);
    });
    return { written: true, path, locked: locking };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};

/**
 * The Gradebook's left pane: everything that changed a grade or the policy,
 * newest first. Three sources, nothing kept twice — the policy's own history,
 * each decided mark's history (`grade-changes.ts`), and what the grade sheet
 * brought in (`marksActivity`, the sync ledger).
 */
export const gradebookChanges = (workspace, runId, { names = false, limit = 80 } = {}) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  const people = names ? rosterPeople() : null;
  const nameOf = (student) => people?.[student]?.name ?? null;
  const titles = new Map(assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id, entry.title ?? entry.assessment_id]));
  const events = [];

  const history = run?.grading_scheme?.extensions?.history;
  (Array.isArray(history) ? history : []).forEach((entry, index) => {
    events.push({
      kind: "policy",
      at: entry.at ?? null,
      action: entry.action ?? "change",
      summary: Array.isArray(entry.summary) ? entry.summary : [],
      note: entry.note ?? null,
      by: entry.by ?? null,
      index,
      restorable: Boolean(entry.before),
    });
  });

  // A decision touches one criterion; a pass over a paper decides several at
  // once. Folded per student, assessment and minute, so a paper is one line.
  const folded = new Map();
  for (const change of realChanges(gradeChanges(bundle, runId))) {
    const key = `${change.student_id}|${change.assessment_id}|${String(change.at ?? "").slice(0, 16)}|${change.how}`;
    let line = folded.get(key);
    if (!line) {
      line = {
        kind: "grade",
        at: change.at,
        student: change.student_id,
        name: nameOf(change.student_id),
        assessment: change.assessment_id,
        title: titles.get(change.assessment_id) ?? change.assessment_id,
        how: change.how,
        by: change.by,
        first: true,
        criteria: [],
      };
      folded.set(key, line);
    }
    line.criteria.push({ criterion: change.criterion, from: change.from, to: change.to, of: change.maximum });
    if (change.from !== null) line.first = false;
  }
  events.push(...folded.values());

  try {
    for (const event of marksActivity(workspace, runId, { names, limit: 20 }).events) {
      events.push({
        kind: "sheet",
        at: event.at,
        added: event.added,
        changed: event.changed,
        removed: event.removed,
        read: event.read,
        changes: event.changes.slice(0, 12).map((change) => ({
          student: change.student,
          name: change.name,
          title: change.title,
          from: change.from,
          to: change.to,
          score_from: change.score_from,
          score_to: change.score_to,
        })),
        more: Math.max(0, event.changes.length - 12),
      });
    }
  } catch {
    // No ledger on this machine: the other two sources still answer.
  }

  const time = (event) => (event.at ? Date.parse(event.at) : -Infinity);
  events.sort((a, b) => time(b) - time(a));
  return { run: runId, names: Boolean(people), events: events.slice(0, limit), total: events.length };
};

/** The state a history entry replaced, as a proposal the page can load into the editor. */
export const historyProposal = (workspace, runId, index) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  const entry = run?.grading_scheme?.extensions?.history?.[Number(index)];
  if (!entry?.before) return { error: "That change kept nothing to restore." };
  return { proposal: entry.before, at: entry.at ?? null };
};
