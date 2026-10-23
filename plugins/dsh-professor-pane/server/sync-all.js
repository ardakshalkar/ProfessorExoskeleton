/**
 * Sync all, across every road a press can bring into step: Canvas (marks and
 * definitions out, the class list in) and each grade sheet (marks in). One
 * preview, then one Send. BACKLOG E37 HOME-6; docs/PROFESSOR-JOURNEY.md §8.
 *
 * Nothing new decides anything here. Canvas is `canvasSyncAll` — its fresh
 * check, its plan of one-sided rows, its 15-minute rule — and a sheet is
 * `runSyncAction` — `ainar sync plan` and `run`, with the downloaded copy when
 * this machine cannot read Google, and `--confirm` where the sync is live.
 * This file only puts them under one pair of presses and says, per road, what
 * comes in, what goes out and what is left for the professor.
 *
 * Not in Sync all, and said so: starter repositories and announcements are
 * publications, one assessment or one message at a time (Publish); hand-ins
 * from Canvas are read per assessment, on its Canvas row.
 */

import { syncsOf } from "@ainar/core/src/sync/registry.ts";

import { canvasSyncAll } from "./canvas-sync.js";
import { runSyncAction } from "./syncs.js";
import { loadedRun } from "./workspace.js";

const isMarksSheet = (sync) => sync.service === "sheets" && sync.stream === "marks";

/** Roads Sync all leaves alone, and where each is done instead. */
const ELSEWHERE = {
  "github|repo": "Starter repositories are published one homework at a time, from Publish.",
  "telegram|announcement": "Announcements are written and sent from Publish.",
  "canvas|submissions": "Hand-ins are read per assessment, on its row in the Canvas card.",
  "sheets|grades": "The gradebook copy is written from Publish.",
};

/** The one JSON object in a command's output, which may carry a warning line around it. */
const jsonOf = (output) => {
  const start = String(output || "").indexOf("{");
  const end = String(output || "").lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return null;
  }
};

/** A sheet plan's changes as counts: marks added, changed, taken back. */
const countsOf = (changes) => {
  const counts = { added: 0, changed: 0, removed: 0 };
  for (const change of changes || []) {
    if (change.from === null && change.score_from === null) counts.added += 1;
    else if (change.to === null && change.score_to === null) counts.removed += 1;
    else counts.changed += 1;
  }
  return counts;
};

/** The run's roads, split into what Sync all moves and what it does not. */
const roadsOf = (workspace, runId) => {
  const { bundle } = loadedRun(workspace, runId);
  const all = syncsOf(bundle, runId).filter((sync) => sync.enabled !== false);
  return {
    canvas: all.some((sync) => sync.service === "canvas" && (sync.stream === "grades" || sync.stream === "roster" || sync.stream === "assignment")),
    sheets: all.filter(isMarksSheet),
    elsewhere: all
      .filter((sync) => ELSEWHERE[sync.service + "|" + sync.stream])
      .map((sync) => ({ id: sync.sync_id, service: sync.service, why: ELSEWHERE[sync.service + "|" + sync.stream] })),
  };
};

/** One sheet, planned: what would come in, what waits, or why it cannot be read. */
const planSheet = async (workspace, root, runId, sync, names) => {
  // A machine with no Google login plans from the copy the professor
  // downloaded; `runSyncAction` refuses with the reason when there is none.
  let answer = await runSyncAction(workspace, root, runId, { action: "plan", sync: sync.sync_id, json: true, names });
  let from = null;
  if (answer.error && /no Google login/.test(answer.error)) {
    answer = await runSyncAction(workspace, root, runId, { action: "plan", sync: sync.sync_id, json: true, names, from: "export" });
    from = "export";
  }
  if (answer.error) return { id: sync.sync_id, ok: false, error: answer.error, reconnect: Boolean(answer.reconnect) };
  const plan = jsonOf(answer.output);
  if (!answer.ok || !plan) {
    return { id: sync.sync_id, ok: false, error: answer.output || "The sheet gave no answer.", reconnect: Boolean(answer.reconnect) };
  }
  const counts = countsOf(plan.changes);
  return {
    id: sync.sync_id,
    ok: true,
    from,
    live: sync.role === "both" || Boolean(sync.anchors),
    rows: plan.rows ?? null,
    placed: Array.isArray(plan.placed) ? plan.placed.length : 0,
    held: plan.queued ?? 0,
    problems: Array.isArray(plan.problems) ? plan.problems.length : 0,
    ...counts,
    moves: counts.added + counts.changed + counts.removed,
  };
};

/**
 * `{ confirm: false }`: ask every road, write nothing, and answer with what
 * each would do. `{ confirm: true, canvas: [keys], sheets: [ids] }`: do what
 * was previewed — the Canvas rows named, and the sheets named — and nothing
 * else.
 */
export const syncAll = async (workspace, root, runId, body) => {
  const names = body.names === true;
  const roads = roadsOf(workspace, runId);

  if (body.confirm !== true) {
    // Canvas and the sheets are asked at once: each is a separate process,
    // and a professor waiting on Sync all waits for the slowest, not the sum.
    const [canvas, ...sheets] = await Promise.all([
      roads.canvas ? canvasSyncAll(root, runId, { confirm: false, names }) : Promise.resolve(null),
      ...roads.sheets.map((sync) => planSheet(workspace, root, runId, sync, names)),
    ]);
    return {
      previewedAt: new Date().toISOString(),
      canvas: canvas && (canvas.error ? { error: canvas.error } : { checkedAt: canvas.checkedAt, ...canvas.preview }),
      sheets,
      elsewhere: roads.elsewhere,
    };
  }

  const results = [];
  const keys = Array.isArray(body.canvas) ? body.canvas.map(String) : [];
  if (roads.canvas && keys.length) {
    const sent = await canvasSyncAll(root, runId, { confirm: true, keys, names });
    if (sent.error) results.push({ road: "canvas", ok: false, output: sent.error });
    else for (const entry of sent.results) results.push({ road: "canvas", ok: entry.ok, command: entry.command, output: entry.output });
  }
  const wanted = new Set(Array.isArray(body.sheets) ? body.sheets.map(String) : []);
  for (const sync of roads.sheets.filter((entry) => wanted.has(entry.sync_id))) {
    const from = body.from && body.from[sync.sync_id] === "export" ? "export" : undefined;
    const live = sync.role === "both" || Boolean(sync.anchors);
    const answer = await runSyncAction(workspace, root, runId, { action: "run", sync: sync.sync_id, names, from, confirm: live });
    results.push({ road: sync.sync_id, ok: Boolean(answer.ok) && !answer.error, command: answer.command, output: answer.error || answer.output || "" });
  }
  if (!results.length) return { error: "Nothing was chosen to sync." };
  return { confirmed: true, results };
};
