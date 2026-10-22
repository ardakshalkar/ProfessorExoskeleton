/**
 * The Canvas card's differences: plugins/dsh-professor-pane/client/canvas-diff-count.js
 *
 *     node --test test/pane-canvas-diff.test.mjs
 *
 * The card counts what `lms check` found per kind (marks, definitions, the
 * class list) and per direction, and says how many Sync all can apply itself:
 * marks and definitions only AINAR changed, and students only Canvas has.
 * Everything else waits for the professor.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { applicable, diffSummary } from "../plugins/dsh-professor-pane/client/canvas-diff-count.js";

const difference = (kind, direction, extra = {}) => ({ kind, direction, key: kind + "|" + direction + "|" + Math.random(), ...extra });

test("counts per kind and per direction, and what Sync all applies", () => {
  const summary = diffSummary({
    kept: 2,
    differences: [
      // Quiz 3: marked here, not sent yet.
      ...Array.from({ length: 52 }, () => difference("grades", "push")),
      difference("grades", "pull"),
      difference("grades", "conflict"),
      difference("grades", "held"),
      difference("assignments", "push"),
      difference("assignments", "pull"),
      difference("roster", "pull"),
      difference("roster", "held"),
    ],
  });
  assert.equal(summary.total, 59);
  assert.deepEqual(summary.kinds.grades, { push: 52, pull: 1, conflict: 1, held: 1, total: 55 });
  assert.deepEqual(summary.kinds.assignments, { push: 1, pull: 1, conflict: 0, held: 0, total: 2 });
  assert.deepEqual(summary.kinds.roster, { push: 0, pull: 1, conflict: 0, held: 1, total: 2 });
  assert.deepEqual(summary.directions, { push: 53, pull: 3, conflict: 1, held: 2, total: 59 });
  assert.equal(summary.applicable, 54, "52 marks and 1 definition field to Canvas, 1 newcomer in");
  assert.equal(summary.kept, 2);
});

test("a mark Canvas changed is the professor's, a newcomer in Canvas is not", () => {
  assert.equal(applicable(difference("grades", "pull")), false);
  assert.equal(applicable(difference("assignments", "pull")), false);
  assert.equal(applicable(difference("roster", "pull")), true);
  assert.equal(applicable(difference("grades", "conflict")), false);
  assert.equal(applicable(difference("roster", "held")), false);
});

test("no check, or one from before differences were counted, is no summary", () => {
  assert.equal(diffSummary(null), null);
  assert.equal(diffSummary({ state: "none", differences: null }), null);
  assert.equal(diffSummary({ outdated: true }), null);
  assert.deepEqual(diffSummary({ differences: [] }).directions, { push: 0, pull: 0, conflict: 0, held: 0, total: 0 });
});
