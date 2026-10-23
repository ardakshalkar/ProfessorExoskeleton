// Today's Now band by the phase of the term (server/today.js, BACKLOG HOME-3):
// what is missing before the term, what must be true to close it after.

import { test } from "node:test";
import assert from "node:assert/strict";

import { closingOf, readinessOf } from "../server/today.js";

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

test("before the term: an empty course is not ready, and says where each line is fixed", () => {
  const list = byId(readinessOf({ outline: { weeks: [], totals: { gaps: { module: 3, deadline: 1, weight: 0 } } }, enrolled: 0, syncs: { syncs: [] } }));
  assert.equal(list.outcomes.done, false);
  assert.equal(list.concepts.done, false);
  assert.equal(list.topics.done, false);
  assert.equal(list.topics.detail, "3 weeks without one");
  assert.equal(list.deadlines.done, false);
  assert.equal(list.weights.done, true);
  assert.equal(list.roster.done, false);
  assert.equal(list.canvas.done, false);
  assert.deepEqual(list.concepts.do, { fill: "/propose-concepts {run} " });
});

test("before the term: a planned course is ready", () => {
  const outline = {
    outcomes: [{ outcome_id: "LO-1" }],
    weeks: [{ week: 1, meetings: [{ activity_id: "A" }], gaps: [], modules: [{ concepts: [{ id: "C-1" }] }] }],
    totals: { gaps: { module: 0, deadline: 0, weight: 0 } },
  };
  const syncs = { syncs: [{ service: "canvas", enabled: true }] };
  assert.ok(readinessOf({ outline, enrolled: 30, syncs }).every((item) => item.done));
});

test("after the term: what is still open is not done; reflection and archive are the professor's", () => {
  const list = byId(
    closingOf({
      inbox: { pending_evaluations: { total: 2 }, open_integrity_cases: [], drafts_awaiting_approval: [{}, {}] },
      unpublished: { marks: [{ canvas: { unsent: 5, changed: 1 } }] },
      held: [],
    }),
  );
  assert.equal(list.decided.done, false);
  assert.equal(list.decided.detail, "2 suggestions waiting");
  assert.equal(list.sent.done, false);
  assert.equal(list.sent.detail, "6 marks Canvas does not have");
  assert.equal(list.sent.outward, true);
  assert.equal(list.integrity.done, true);
  assert.equal(list.papers.done, true);
  assert.equal(list.drafts.done, false);
  assert.equal(list.reflect.done, null);
  assert.equal(list.archive.done, null);
});
