/**
 * A place in course mode as a URL fragment, and back: shared/route.js
 *
 *     node --test test/route.test.mjs
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { hashToPlace, placeToHash, ROUTES } from "../shared/route.js";

test("every place and part survives the trip to a URL and back", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    const parts = route.parts ? Object.values(route.parts) : [null];
    for (const part of parts) {
      const place = route.mode ? { mode: part } : route.parts ? { view: route.view, sub: part } : { view: route.view };
      const hash = placeToHash(place);
      assert.ok(hash.startsWith("#/" + name), hash);
      assert.deepEqual(hashToPlace(hash), place, hash);
    }
  }
});

test("the URL speaks the navigator's words", () => {
  assert.equal(placeToHash({ view: "tasks", sub: "waiting" }), "#/waiting/everything");
  assert.equal(placeToHash({ view: "syncs" }), "#/sync");
  assert.equal(placeToHash({ mode: "term" }), "#/weeks/all");
  assert.equal(placeToHash({ view: "gradebook" }), "#/gradebook/marks", "a place with parts names its default");
  assert.equal(placeToHash(null), "");
  assert.equal(placeToHash({ view: "nowhere" }), "");
});

test("what a place carries rides in the query, and comes back typed", () => {
  const place = { mode: "teaching", week: 7 };
  assert.equal(placeToHash(place), "#/weeks/teaching?week=7");
  assert.deepEqual(hashToPlace("#/weeks/teaching?week=7"), place);
  assert.deepEqual(hashToPlace("#/concepts?student=STUDENT-3BCIXS"), { view: "concepts", student: "STUDENT-3BCIXS" });
  assert.deepEqual(hashToPlace("#/waiting/everything?kind=marks"), { view: "tasks", sub: "waiting", kind: "marks" });
  assert.deepEqual(hashToPlace("#/sync?focus=marks"), { view: "syncs", focus: "marks" });
});

test("the windows over a place ride with it", () => {
  const graded = { view: "gradebook", sub: "marks", grade: "ASSESSMENT-HW-06" };
  assert.equal(placeToHash(graded), "#/gradebook/marks?grade=ASSESSMENT-HW-06");
  assert.deepEqual(hashToPlace(placeToHash(graded)), graded);
  const desk = { view: "students", desk: { assessment: "ASSESSMENT-HW-04", student: "STUDENT-3BCIXS" } };
  assert.equal(placeToHash(desk), "#/students?desk=ASSESSMENT-HW-04%3ASTUDENT-3BCIXS");
  assert.deepEqual(hashToPlace(placeToHash(desk)), desk);
});

test("an old link lands where the thing lives now", () => {
  assert.deepEqual(hashToPlace("#/materials/grading"), { view: "gradebook", sub: "policy" });
  assert.deepEqual(hashToPlace("#/gradebook/canvas"), { view: "syncs", focus: "marks" });
  assert.deepEqual(hashToPlace("#/tasks/tasks"), { view: "tasks", sub: "waiting", kind: "marks" });
  assert.deepEqual(hashToPlace("#/syncs"), { view: "syncs" });
});

test("a fragment that names no place, or carries junk, is not followed", () => {
  assert.equal(hashToPlace(""), null);
  assert.equal(hashToPlace("#section-2"), null);
  assert.equal(hashToPlace("#/nowhere"), null);
  assert.deepEqual(hashToPlace("#/weeks/teaching?week=nine&grade=<script>&student=%E0%A4%A"), { mode: "teaching" });
  assert.deepEqual(hashToPlace("#/gradebook/nonsense"), { view: "gradebook", sub: "marks" });
});
