/**
 * One home per item: an older link lands where the thing now lives, and the
 * gradebook widget leads to the Grade window.
 *
 *     node --test test/places.test.mjs
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { widgetDocument } from "../server/page.js";
import { ACTIONS } from "../shared/actions.js";
import { resolveRequest, SUB_ALIASES } from "../shared/places.js";

test("each folded part lands in the place that is its home now", () => {
  assert.deepEqual(resolveRequest({ view: "materials", sub: "grading", n: 1 }), { view: "gradebook", sub: "policy", n: 1 });
  assert.deepEqual(resolveRequest({ view: "gradebook", sub: "canvas", n: 2 }), { view: "syncs", focus: "marks", n: 2 });
  assert.deepEqual(resolveRequest({ view: "tasks", sub: "unpublished", n: 3 }), { view: "syncs", focus: "marks", n: 3 });
  assert.deepEqual(resolveRequest({ view: "tasks", sub: "tasks", n: 4 }), { view: "tasks", sub: "waiting", kind: "marks", n: 4 });
});

test("a request for a part that still exists, and the old view names, are left as they were", () => {
  assert.deepEqual(resolveRequest({ view: "gradebook", sub: "policy" }), { view: "gradebook", sub: "policy" });
  assert.deepEqual(resolveRequest({ view: "integrations" }), { view: "settings", sub: "integrations" });
  assert.deepEqual(resolveRequest({ mode: "teaching", week: 7 }), { mode: "teaching", week: 7 });
  assert.equal(resolveRequest(null), null);
});

test("nothing in the command field opens a folded part", () => {
  const folded = new Set(Object.keys(SUB_ALIASES));
  for (const action of ACTIONS) {
    const open = action.do && action.do.open;
    if (open && open.view) assert.ok(!folded.has(open.view + "/" + open.sub), action.id + " opens " + open.view + "/" + open.sub);
  }
});

test("the gradebook widget, and only it, gets the way into the Grade window", () => {
  const widget = { html: () => '<div class="tabs"></div>' };
  const graded = widgetDocument(widget, {}, false, { grade: true });
  assert.match(graded, /data-grade-open/);
  assert.match(graded, /kind: 'grade'/);
  assert.doesNotMatch(widgetDocument(widget, {}, false), /data-grade-open/);
});
