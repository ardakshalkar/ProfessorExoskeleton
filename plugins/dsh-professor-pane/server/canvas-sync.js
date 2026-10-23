/**
 * Where this run and Canvas differ, Sync all, and settling one difference.
 *
 * The differences are `lms check`'s — the check the pane already keeps
 * running (`/api/canvas/check`), which since 2026-10-22 says for each one
 * which side moved since the last sync (`ainar-node/src/lms/canvas-diff.ts`).
 * Nothing here compares anything itself: it reads that answer, and every
 * press is `ainar lms …`, for `runPublish`'s reason.
 *
 * Sync all is two presses, as every write to Canvas in this pane is. The
 * first asks Canvas again and answers with exactly what would go and come;
 * the second sends those rows and no others — each push names its students
 * (`--student`) or fields (`--field`), and a row that changed in between is
 * not overwritten, because a push without `--overwrite-drift` never is.
 * Conflicts, and grades or definitions Canvas changed, are left: each is the
 * professor's, one at a time, with "keep AINAR" (a send, previewed) or "keep
 * Canvas" (`lms keep`, a note in the ledger; nothing sent).
 */

import { syncAllPlan, tallyDifferences } from "@ainar/core/src/lms/canvas-diff.ts";

import { amendCanvasCheck, canvasCheckState, lastCanvasCheck, runCanvasCheck, runScans } from "./actions.js";
import { rosterPeople } from "./workspace.js";

/** How old the previewed check may be when its Send is pressed. */
const PREVIEW_MS = 15 * 60 * 1000;

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

/**
 * `{confirm: false}` asks Canvas (a fresh check) and answers with the
 * preview; `{confirm: true, keys}` sends the previewed rows named in `keys`.
 */
export const canvasSyncAll = async (root, runId, body) => {
  const names = body.names === true;
  if (body.confirm !== true) {
    const state = await runCanvasCheck(root, runId);
    if (!state.value) return { error: state.error || "Canvas gave no answer." };
    if (!Array.isArray(state.value.differences)) return { error: "This check has no differences in it; restart the harness so it runs the new `lms check`." };
    return { checkedAt: state.at, preview: previewOf(state.value, names) };
  }

  const last = lastCanvasCheck(runId);
  if (!last || last.running) return { error: "Preview again: the check behind the preview is not there any more." };
  if (Date.now() - Date.parse(last.at) > PREVIEW_MS) return { error: "The preview is more than 15 minutes old. Preview again." };
  const wanted = new Set(Array.isArray(body.keys) ? body.keys.map(String) : []);
  // Students Canvas no longer lists are noted whatever was chosen: the note
  // drops nobody, so it needs no choosing.
  const absent = syncAllPlan(last.value.differences).absent;
  if (!wanted.size && !absent.length) return { error: "Nothing was chosen to send." };
  const plan = syncAllPlan(last.value.differences.filter((entry) => wanted.has(entry.key)));

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
  return { confirmed: true, results, check: after };
};

/**
 * One difference, settled. `keep: "canvas"` pins it (`lms keep`), and sends
 * nothing. `keep: "ainar"` sends AINAR's value over Canvas's — previewed
 * first, `confirm: true` to send — with `--overwrite-drift` for that one row.
 */
export const canvasResolve = async (root, runId, body) => {
  const last = lastCanvasCheck(runId);
  if (!last || !Array.isArray(last.value.differences)) return { error: "Check Canvas first: there is no comparison to settle." };
  const entry = last.value.differences.find((item) => item.key === String(body.key || ""));
  if (!entry) return { error: "That difference is not in the last check any more. Check again." };
  if (entry.kind === "roster") return { error: "The class list is settled by its sync, not row by row." };
  const row = entry.student_id ? ["--student", entry.student_id] : ["--field", entry.field];

  if (body.keep === "canvas") {
    const result = await runScans(
      ["lms", "keep", runId, ...where(entry), ...row, "--ours", entry.pin_ours, "--canvas", entry.pin_theirs],
      root,
    );
    if (result.ok) settle(runId, last.value, entry.key, true);
    return { ok: result.ok, kept: "canvas", output: result.output, command: result.command };
  }
  if (body.keep !== "ainar") return { error: "Keep which: ainar or canvas." };
  if (entry.ours === null && entry.kind === "grades") return { error: "There is no mark here to send." };
  const preview =
    (entry.kind === "grades" ? (entry.name || entry.student_id) + " in " + (entry.title || entry.assessment_id) : (entry.title || entry.assessment_id) + " · " + entry.field) +
    (entry.group ? " (" + entry.group + ")" : "") +
    ": Canvas has " +
    (entry.theirs ?? "nothing") +
    ", and would get " +
    entry.ours +
    ".";
  if (body.confirm !== true) return { preview };
  const args =
    entry.kind === "grades"
      ? ["lms", "push", runId, "--target", "canvas-api", ...where(entry), ...row, "--overwrite-drift", "--confirm"]
      : ["lms", "assignment-push", runId, ...where(entry), ...row, "--overwrite-drift", "--confirm"];
  const result = await runScans(args, root);
  if (result.ok) settle(runId, last.value, entry.key, false);
  return { ok: result.ok, kept: "ainar", output: result.output, command: result.command };
};

/** The settled row out of the last answer, so the list redraws without asking Canvas. */
const settle = (runId, value, key, kept) => {
  const differences = value.differences.filter((entry) => entry.key !== key);
  amendCanvasCheck(
    runId,
    Object.assign({}, value, { differences, tally: tallyDifferences(differences), kept: (value.kept || 0) + (kept ? 1 : 0) }),
  );
};
