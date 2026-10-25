/**
 * Where this run and Canvas differ, Sync all, and settling one difference.
 *
 * The differences are `lms check`'s — the check the pane already keeps
 * running (`/api/canvas/check`), which since 2026-10-22 says for each one
 * which side moved since the last sync (`ainar-node/src/lms/canvas-diff.ts`).
 * Nothing here compares anything itself: it reads that answer, and every
 * press is `ainar lms …`, for `runPublish`'s reason.
 *
 * Canvas is a road (server/roads.js): Sync all and the Canvas card's own Sync
 * all are `canvasRoad`. Its plan asks Canvas again and answers with exactly
 * what would go and come; its send sends those rows and no others — each push
 * names its students (`--student`) or fields (`--field`), and a row that
 * changed in between is not overwritten, because a push without
 * `--overwrite-drift` never is. Conflicts, and grades or definitions Canvas
 * changed, are left: each is the professor's, one at a time, with "keep
 * AINAR" (a send, previewed, from its own snapshot) or "keep Canvas"
 * (`lms keep`, a note in the ledger; nothing sent).
 */

import { syncAllPlan, tallyDifferences } from "@ainar/core/src/lms/canvas-diff.ts";

import { amendCanvasCheck, canvasCheckState, lastCanvasCheck, runCanvasCheck, runScans } from "./actions.js";
import { recall, remember } from "./previews.js";
import { rosterPeople } from "./workspace.js";

const named = (differences, names) => {
  const people = names ? rosterPeople() : null;
  return differences.map((entry) =>
    Object.assign({}, entry, {
      name: people && entry.student_id && people[entry.student_id] ? String(people[entry.student_id].name || "") || null : null,
    }),
  );
};

/** The last check's differences, ready to draw. A check from before differences existed says so. */
export const canvasDifferences = (runId, { names = false } = {}) => {
  const state = canvasCheckState(runId);
  const value = state.value;
  if (!value) return { state: state.state, at: state.at || null, error: state.error || null, differences: null };
  if (!Array.isArray(value.differences)) {
    return { state: state.state, at: state.at, error: null, differences: null, outdated: true };
  }
  return {
    state: state.state,
    at: state.at,
    error: state.error || null,
    differences: named(value.differences, names),
    tally: value.tally || tallyDifferences(value.differences),
    kept: value.kept || 0,
    roster: value.roster || null,
  };
};

/** One difference's flags for an `lms` command: the assessment, the course, the row. */
const where = (entry) => {
  const args = ["--assessment", entry.assessment_id];
  if (entry.group) args.push("--group", entry.group);
  return args;
};

/** What Sync all would do, from a check made just now. */
const previewOf = (value, names) => {
  const plan = syncAllPlan(value.differences || []);
  return {
    send: named(plan.send, names),
    take: named(plan.take, names),
    held: named(plan.held, names),
    absent: named(plan.absent, names),
    batches: plan.batches,
  };
};

/** Canvas as a road: marks and definitions out, the class list in. */
export const canvasRoad = {
  id: "canvas",
  service: "canvas",
  label: "Canvas",
  live: true,
  /** A fresh check; the preview is what Sync all would apply of its differences. */
  async plan({ root, runId, names }) {
    const state = await runCanvasCheck(root, runId);
    if (!state.value) return { error: state.error || "Canvas gave no answer." };
    if (!Array.isArray(state.value.differences)) return { error: "This check has no differences in it; restart the harness so it runs the new `lms check`." };
    const preview = Object.assign({ checkedAt: state.at }, previewOf(state.value, names));
    return { preview, keys: preview.send.concat(preview.take).map((entry) => entry.key), snapshot: state.value };
  },
  send: (ctx, value, keys) => sendCanvas(ctx, value, keys),
};

/** The previewed rows named in `keys`, sent; then Canvas asked again. */
const sendCanvas = async ({ root, runId }, value, keys) => {
  const wanted = new Set(keys);
  // Students Canvas no longer lists are noted whatever was chosen: the note
  // drops nobody, so it needs no choosing.
  const absent = syncAllPlan(value.differences).absent;
  if (!wanted.size && !absent.length) return { error: "Nothing was chosen to send." };
  const plan = syncAllPlan(value.differences.filter((entry) => wanted.has(entry.key)));

  const results = [];
  for (const batch of plan.batches) {
    const args =
      batch.kind === "grades"
        ? ["lms", "push", runId, "--target", "canvas-api", ...where(batch), "--student", batch.students.join(","), "--confirm"]
        : ["lms", "assignment-push", runId, ...where(batch), "--field", batch.fields.join(","), "--confirm"];
    const result = await runScans(args, root);
    results.push({
      kind: batch.kind,
      assessment: batch.assessment_id,
      group: batch.group,
      count: batch.kind === "grades" ? batch.students.length : batch.fields.length,
      ok: result.ok,
      command: result.command,
      output: result.output || result.error || "",
    });
  }
  // The class list comes in as `roster sync` brings it, which is every
  // newcomer Canvas has, and every student back in it after a removal: the
  // preview listed them all. It also runs for a student Canvas no longer
  // lists — nobody is dropped, but each gets a dated note on their
  // enrollment that they are not in Canvas.
  if (plan.take.length || absent.length) {
    const result = await runScans(["roster", "sync", "--run", runId], root);
    results.push({
      kind: "roster",
      assessment: null,
      group: null,
      count: plan.take.length + absent.length,
      ok: result.ok,
      command: result.command,
      output: result.output || result.error || "",
    });
  }
  // What it all came to, asked of Canvas again.
  const after = await runCanvasCheck(root, runId);
  return { results, after };
};

/**
 * One difference, settled. `keep: "canvas"` pins it (`lms keep`), and sends
 * nothing. `keep: "ainar"` sends AINAR's value over Canvas's — previewed
 * first, `confirm: true` to send — with `--overwrite-drift` for that one row.
 * The send goes from the row its preview showed (server/previews.js), under
 * the roads' rules: fifteen minutes, one send, `again` when it cannot.
 */
export const canvasResolve = async (root, runId, body) => {
  const key = String(body.key || "");
  if (body.keep === "ainar" && body.confirm === true) {
    const got = recall(runId, "canvas-row:" + key);
    if (got.again) return { error: got.again, again: true };
    const entry = got.last.snapshot;
    const args =
      entry.kind === "grades"
        ? ["lms", "push", runId, "--target", "canvas-api", ...where(entry), ...rowOf(entry), "--overwrite-drift", "--confirm"]
        : ["lms", "assignment-push", runId, ...where(entry), ...rowOf(entry), "--overwrite-drift", "--confirm"];
    const result = await runScans(args, root);
    if (result.ok) settle(runId, entry.key, false);
    return { ok: result.ok, kept: "ainar", output: result.output, command: result.command };
  }

  const last = lastCanvasCheck(runId);
  if (!last || !Array.isArray(last.value.differences)) return { error: "Check Canvas first: there is no comparison to settle." };
  const entry = last.value.differences.find((item) => item.key === key);
  if (!entry) return { error: "That difference is not in the last check any more. Check again." };
  if (entry.kind === "roster") return { error: "The class list is settled by its sync, not row by row." };

  if (body.keep === "canvas") {
    const result = await runScans(
      ["lms", "keep", runId, ...where(entry), ...rowOf(entry), "--ours", entry.pin_ours, "--canvas", entry.pin_theirs],
      root,
    );
    if (result.ok) settle(runId, entry.key, true);
    return { ok: result.ok, kept: "canvas", output: result.output, command: result.command };
  }
  if (body.keep !== "ainar") return { error: "Keep which: ainar or canvas." };
  if (entry.ours === null && entry.kind === "grades") return { error: "There is no mark here to send." };
  remember(runId, "canvas-row:" + entry.key, [entry.key], entry);
  const [shown] = named([entry], body.names === true);
  const preview =
    (entry.kind === "grades" ? (shown.name || entry.student_id) + " in " + (entry.title || entry.assessment_id) : (entry.title || entry.assessment_id) + " · " + entry.field) +
    (entry.group ? " (" + entry.group + ")" : "") +
    ": Canvas has " +
    (entry.theirs ?? "nothing") +
    ", and would get " +
    entry.ours +
    ".";
  return { preview };
};

/** The one row of a difference: its student, or its definition field. */
const rowOf = (entry) => (entry.student_id ? ["--student", entry.student_id] : ["--field", entry.field]);

/** The settled row out of the last answer, so the list redraws without asking Canvas. */
const settle = (runId, key, kept) => {
  const last = lastCanvasCheck(runId);
  if (!last || !Array.isArray(last.value.differences)) return;
  const value = last.value;
  const differences = value.differences.filter((entry) => entry.key !== key);
  amendCanvasCheck(
    runId,
    Object.assign({}, value, { differences, tally: tallyDifferences(differences), kept: (value.kept || 0) + (kept ? 1 : 0) }),
  );
};
