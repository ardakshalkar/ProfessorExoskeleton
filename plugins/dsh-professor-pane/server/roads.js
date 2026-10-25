/**
 * Roads: the connections a press brings into step with a service outside the
 * run, in one shape. Sync all (client/sync-view.js) and each service's own
 * card (Canvas's differences, a grade sheet's card) go through here, so a
 * preview, a send, a refusal and a retry mean the same thing on every road.
 * BACKLOG E33 MOD-6; docs/PROFESSOR-JOURNEY.md §8.
 *
 * A road is an object a service module exports:
 *
 *   id        "canvas", or the sync id of a grade sheet
 *   service   "canvas" | "sheets"
 *   label     what the professor calls it
 *   live      whether a send changes what other people see; a live road
 *             sends only from a preview, never in one press
 *   enabled   whether Sync all moves it
 *   plan(ctx)                  read only. `{ preview, keys, snapshot }`, or
 *                              `{ error, reconnect? }`. `keys` are what a
 *                              send may name; `snapshot` is what it sends from.
 *   recheck(ctx, snapshot)     optional, just before a send: null when the far
 *                              side is still as previewed, `{ again }` when it
 *                              moved, `{ error }` when it could not be read.
 *   send(ctx, snapshot, keys)  `{ results: [{ kind, ok, command, output }],
 *                              after? }`, or `{ error }`.
 *
 * `ctx` is `{ workspace, root, runId, names, from }`. Every write still spawns
 * `ainar`, for `runPublish`'s reason; a road only says which commands, from
 * which snapshot.
 *
 * The rules, here once rather than per service:
 *
 * * Two presses. A preview remembers its snapshot (server/previews.js); a
 *   send recalls it, so it sends what the professor read and not what a
 *   background check found since.
 * * Only the previewed keys. A key the preview did not offer is dropped.
 * * Fifteen minutes, one send. An older preview, or none (a reload of
 *   server/ empties it), answers `again: true`, and the pane offers Preview
 *   again.
 * * A road that writes only into the run (`live: false`) may be run in one
 *   press (`direct`): it is planned and sent at once, as Run always was.
 *
 * Not roads, and why — `ELSEWHERE` below. Telegram and GitHub are
 * publications: each send is one thing the professor composed or chose (a
 * message, one homework's starter repository), previewed by `ainar publish`
 * without `--confirm` and sent with it (server/actions.js `runPublish`).
 * There is no far side to compare and nothing to bring into step, so there
 * are no keys and no differences; and Sync all must never be the press that
 * posts an announcement or opens a repository. They keep their two presses
 * and `--confirm` where they are, in Publish.
 */

import { syncsOf } from "@ainar/core/src/sync/registry.ts";

import { canvasRoad } from "./canvas-sync.js";
import { recall, remember } from "./previews.js";
import { isMarksSheet, sheetRoad } from "./syncs.js";
import { loadedRun } from "./workspace.js";

/** Syncs that are not roads, and where each is done instead. */
const ELSEWHERE = {
  "github|repo": "Starter repositories are published one homework at a time, from Publish.",
  "telegram|announcement": "Announcements are written and sent from Publish.",
  "canvas|submissions": "Hand-ins are read per assessment, on its Canvas row.",
  "sheets|grades": "The gradebook copy is written from Publish.",
};

const CANVAS_STREAMS = ["grades", "roster", "assignment"];

/** The run's roads, Canvas first, and its syncs that are not roads. */
export const roadsOf = (workspace, runId) => {
  const { bundle } = loadedRun(workspace, runId);
  const all = syncsOf(bundle, runId);
  const roads = [];
  const canvas = all.filter((sync) => sync.service === "canvas" && CANVAS_STREAMS.includes(sync.stream));
  if (canvas.length) roads.push(Object.assign({}, canvasRoad, { enabled: canvas.some((sync) => sync.enabled !== false) }));
  for (const sync of all.filter(isMarksSheet)) roads.push(sheetRoad(sync));
  const elsewhere = all
    .filter((sync) => sync.enabled !== false && ELSEWHERE[sync.service + "|" + sync.stream])
    .map((sync) => ({ id: sync.sync_id, service: sync.service, why: ELSEWHERE[sync.service + "|" + sync.stream] }));
  return { roads, elsewhere };
};

const contextOf = (workspace, root, runId, body, road) => ({
  workspace,
  root,
  runId,
  names: body.names === true,
  from: body.from && typeof body.from === "object" ? body.from[road.id] : body.from,
});

const failure = (error) => String((error && error.message) || error);

/**
 * Preview: ask each road, write nothing outside the run, remember what each
 * showed. `roads` names some (a service's card); without it, every road Sync
 * all moves. Roads are asked at once — each is its own process, and a
 * professor waiting on Sync all waits for the slowest, not the sum.
 */
export const previewRoads = (workspace, root, runId, body) => previewOn(roadsOf(workspace, runId), workspace, root, runId, body);

/** `previewRoads` over roads given rather than read from the run: the rules alone, for a test. */
export const previewOn = async ({ roads, elsewhere }, workspace, root, runId, body) => {
  const named = Array.isArray(body.roads) ? body.roads.map(String) : null;
  const wanted = named ? roads.filter((road) => named.includes(road.id)) : roads.filter((road) => road.enabled);
  if (!wanted.length) return { error: named ? `${runId} has no road ${named.join(", ")}.` : "No road here moves with Sync all." };
  const answers = await Promise.all(
    wanted.map(async (road) => {
      const head = { id: road.id, service: road.service, label: road.label, live: road.live };
      let planned;
      try {
        planned = await road.plan(contextOf(workspace, root, runId, body, road));
      } catch (error) {
        planned = { error: failure(error) };
      }
      if (planned.error) return Object.assign(head, { ok: false, error: planned.error, reconnect: Boolean(planned.reconnect) });
      const at = remember(runId, road.id, planned.keys, planned.snapshot);
      return Object.assign(head, { ok: true, at, keys: planned.keys, preview: planned.preview });
    }),
  );
  return { previewedAt: new Date().toISOString(), roads: answers, elsewhere: named ? [] : elsewhere };
};

/**
 * Send: `keys: { roadId: [key, …] }`, each road from its own preview and only
 * the keys it offered. A road that cannot go ahead says so in its result,
 * with `again` when a new preview is the way on; the others still go.
 */
export const sendRoads = (workspace, root, runId, body) => sendOn(roadsOf(workspace, runId), workspace, root, runId, body);

/** `sendRoads` over roads given rather than read from the run. */
export const sendOn = async ({ roads }, workspace, root, runId, body) => {
  const chosen = body.keys && typeof body.keys === "object" && !Array.isArray(body.keys) ? body.keys : {};
  const unknown = Object.keys(chosen).filter((id) => !roads.some((road) => road.id === id));
  if (!Object.keys(chosen).length) return { error: "Nothing was chosen to send." };
  if (unknown.length) return { error: `${runId} has no road ${unknown.join(", ")}.` };

  const results = [];
  const after = {};
  const refused = (road, output, again = false) => results.push({ road: road.id, ok: false, again, output });
  for (const road of roads.filter((entry) => Object.hasOwn(chosen, entry.id))) {
    const ctx = contextOf(workspace, root, runId, body, road);
    let last;
    if (body.direct === true && !road.live) {
      // Run in one press: planned now, so the snapshot is as fresh as it gets.
      const planned = await road.plan(ctx).catch((error) => ({ error: failure(error) }));
      if (planned.error) {
        refused(road, planned.error);
        continue;
      }
      last = { keys: planned.keys, snapshot: planned.snapshot };
    } else {
      const got = recall(runId, road.id);
      if (got.again) {
        refused(road, got.again, true);
        continue;
      }
      last = got.last;
      if (road.recheck) {
        const moved = await road.recheck(ctx, last.snapshot).catch((error) => ({ error: failure(error) }));
        if (moved) {
          refused(road, moved.again || moved.error, Boolean(moved.again));
          continue;
        }
      }
    }
    const keys = (Array.isArray(chosen[road.id]) ? chosen[road.id] : []).map(String).filter((key) => last.keys.includes(key));
    const sent = await road.send(ctx, last.snapshot, body.direct === true && !road.live ? last.keys : keys).catch((error) => ({ error: failure(error) }));
    if (sent.error) refused(road, sent.error);
    else for (const entry of sent.results) results.push(Object.assign({ road: road.id }, entry));
    if (sent.after) after[road.id] = sent.after;
  }
  return { confirmed: true, results, after, again: results.some((entry) => entry.again) };
};
