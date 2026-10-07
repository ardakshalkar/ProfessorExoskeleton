/**
 * Course mode's Escape, innermost first: a window opened on top of it owns
 * the key, and only then does course mode close.
 *
 *     node --test test/pane-course-escape.test.mjs
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { courseModeEscape } from "../plugins/dsh-professor-pane/client/course-escape.js";

test("a window on top keeps Escape", () => {
  assert.equal(courseModeEscape({ covered: true }), "none");
});

test("with nothing open over it, course mode closes", () => {
  assert.equal(courseModeEscape({ covered: false }), "close");
});
