// The rules every road follows (server/roads.js, server/previews.js), with
// roads made up here: two presses, only the previewed keys, each key once
// (a preview may go in parts), fifteen minutes, `again` when a send cannot go, and a road that
// writes only into the run may run in one press.

import { test } from "node:test";
import assert from "node:assert/strict";

import { PREVIEW_MS, recall, remember } from "../server/previews.js";
import { previewOn, sendOn } from "../server/roads.js";

let run = 0;
const nextRun = () => "RUN-TEST-" + ++run;

/** A road that records what it was asked to send. */
const fakeRoad = (id, { live = true, keys = ["a", "b"], recheck = null, planError = null } = {}) => {
  const road = {
    id,
    service: "fake",
    label: id,
    live,
    enabled: true,
    sent: [],
    plans: 0,
    async plan() {
      road.plans += 1;
      if (planError) return { error: planError };
      return { preview: { keys }, keys, snapshot: { at: road.plans } };
    },
    async send(ctx, snapshot, chosen) {
      road.sent.push({ snapshot, chosen });
      return { results: [{ kind: "fake", ok: true, command: "send " + chosen.join(","), output: "" }] };
    },
  };
  if (recheck) road.recheck = recheck;
  return road;
};

const preview = (roads, runId, body = {}) => previewOn({ roads, elsewhere: [] }, null, null, runId, body);
const send = (roads, runId, body) => sendOn({ roads }, null, null, runId, Object.assign({ confirm: true }, body));

test("a send goes from its preview, with only the keys the preview offered", async () => {
  const runId = nextRun();
  const road = fakeRoad("canvas");
  const shown = await preview([road], runId);
  assert.equal(shown.roads[0].ok, true);
  assert.deepEqual(shown.roads[0].keys, ["a", "b"]);
  const sent = await send([road], runId, { keys: { canvas: ["a", "zzz"] } });
  assert.equal(sent.again, false);
  assert.deepEqual(road.sent, [{ snapshot: { at: 1 }, chosen: ["a"] }]);
  assert.equal(road.plans, 1, "the send did not ask again");
});

test("a preview is sent from in parts, each key once; a key sent already is told to check again", async () => {
  const runId = nextRun();
  const road = fakeRoad("canvas");
  await preview([road], runId);
  await send([road], runId, { keys: { canvas: ["a"] } });
  const second = await send([road], runId, { keys: { canvas: ["a"] } });
  assert.equal(second.again, true);
  assert.equal(second.results[0].again, true);
  assert.match(second.results[0].output, /sent already/);
  const third = await send([road], runId, { keys: { canvas: ["b"] } });
  assert.equal(third.again, false);
  assert.deepEqual(
    road.sent.map((entry) => [entry.snapshot.at, entry.chosen]),
    [
      [1, ["a"]],
      [1, ["b"]],
    ],
    "both parts went from the one preview",
  );
  assert.equal(road.plans, 1);
  const spent = await send([road], runId, { keys: { canvas: ["b"] } });
  assert.match(spent.results[0].output, /no check to send from/, "with every key sent the preview is gone");
});

test("two presses from one preview, the second while the first is out, send each key once", async () => {
  const runId = nextRun();
  let release;
  const road = fakeRoad("canvas", { recheck: () => new Promise((resolve) => (release = () => resolve(null))) });
  await preview([road], runId);
  const first = send([road], runId, { keys: { canvas: ["a"] } });
  const second = await send([road], runId, { keys: { canvas: ["a"] } });
  release();
  await first;
  assert.deepEqual(road.sent.map((entry) => entry.chosen), [["a"]]);
  assert.match(second.results[0].output, /sent already/);
});

test("a send the far side stopped gives its keys back to the preview", async () => {
  const runId = nextRun();
  let moved = { error: "Canvas did not answer." };
  const road = fakeRoad("canvas", { recheck: async () => moved });
  await preview([road], runId);
  const stopped = await send([road], runId, { keys: { canvas: ["a"] } });
  assert.match(stopped.results[0].output, /did not answer/);
  moved = null;
  await send([road], runId, { keys: { canvas: ["a"] } });
  assert.deepEqual(road.sent.map((entry) => entry.chosen), [["a"]]);
});

test("no preview — as after a reload of server/ — answers again, and sends nothing", async () => {
  const road = fakeRoad("canvas");
  const sent = await send([road], nextRun(), { keys: { canvas: ["a"] } });
  assert.equal(sent.again, true);
  assert.match(sent.results[0].output, /Check again/);
  assert.equal(road.sent.length, 0);
});

test("a preview older than fifteen minutes is refused with again", () => {
  const runId = nextRun();
  remember(runId, "canvas", ["a"], {});
  const realNow = Date.now;
  Date.now = () => realNow() + PREVIEW_MS + 1000;
  try {
    const got = recall(runId, "canvas");
    assert.match(got.again, /15 minutes/);
  } finally {
    Date.now = realNow;
  }
});

test("a far side that moved since the preview answers again; a read that failed answers its error", async () => {
  const runId = nextRun();
  const moved = fakeRoad("sheet", { recheck: async () => ({ again: "The sheet changed since the preview. Preview again." }) });
  const broken = fakeRoad("other", { recheck: async () => ({ error: "Google refused the sign-in." }) });
  await preview([moved, broken], runId);
  const sent = await send([moved, broken], runId, { keys: { sheet: ["a"], other: ["a"] } });
  assert.deepEqual(
    sent.results.map((entry) => [entry.road, entry.again]),
    [
      ["sheet", true],
      ["other", false],
    ],
  );
  assert.equal(moved.sent.length + broken.sent.length, 0);
});

test("one road that cannot go does not stop the others", async () => {
  const runId = nextRun();
  const fresh = fakeRoad("canvas");
  const lost = fakeRoad("sheet");
  await preview([fresh], runId, { roads: ["canvas"] });
  const sent = await send([fresh, lost], runId, { keys: { canvas: ["a"], sheet: ["a"] } });
  assert.equal(fresh.sent.length, 1);
  assert.equal(lost.sent.length, 0);
  assert.equal(sent.again, true);
});

test("a live road never runs in one press; a road that writes only into the run may", async () => {
  const live = fakeRoad("canvas");
  const local = fakeRoad("sheet", { live: false, keys: ["sheet"] });
  const runId = nextRun();
  const sent = await send([live, local], runId, { direct: true, keys: { canvas: ["a"], sheet: ["sheet"] } });
  assert.equal(live.sent.length, 0);
  assert.deepEqual(local.sent[0].chosen, ["sheet"]);
  assert.equal(sent.results.find((entry) => entry.road === "canvas").again, true);
});

test("a road whose plan fails says why and keeps nothing to send from", async () => {
  const runId = nextRun();
  const road = fakeRoad("sheet", { planError: "There is no downloaded copy of the sheet yet." });
  const shown = await preview([road], runId);
  assert.equal(shown.roads[0].ok, false);
  assert.match(shown.roads[0].error, /no downloaded copy/);
  const sent = await send([road], runId, { keys: { sheet: ["a"] } });
  assert.equal(sent.again, true);
});

test("Sync all previews the enabled roads; a named road is previewed alone", async () => {
  const runId = nextRun();
  const on = fakeRoad("canvas");
  const off = Object.assign(fakeRoad("sheet"), { enabled: false });
  const all = await preview([on, off], runId);
  assert.deepEqual(all.roads.map((road) => road.id), ["canvas"]);
  const one = await preview([on, off], runId, { roads: ["sheet"] });
  assert.deepEqual(one.roads.map((road) => road.id), ["sheet"]);
});
