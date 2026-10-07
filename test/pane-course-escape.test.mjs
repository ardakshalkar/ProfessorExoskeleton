/**
 * Course mode's Escape, innermost first: a window opened on top of it owns
 * the key, then an open drawer closes, and only then does course mode.
 *
 *     node --test test/pane-course-escape.test.mjs
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { courseModeEscape } from "../plugins/dsh-professor-pane/client/course-escape.js";

test("a window on top keeps Escape, drawer or not", () => {
  assert.equal(courseModeEscape({ covered: true, drawer: null }), "none");
  assert.equal(courseModeEscape({ covered: true, drawer: "students" }), "none");
});

test("an open drawer closes before course mode does", () => {
  for (const drawer of ["students", "gradebook", "tasks"]) {
    assert.equal(courseModeEscape({ covered: false, drawer }), "drawer");
  }
});

test("with nothing open over it, course mode closes", () => {
  assert.equal(courseModeEscape({ covered: false, drawer: null }), "close");
});