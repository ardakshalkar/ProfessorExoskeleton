/**
 * The three properties a port of the model is most likely to lose quietly.
 *
 * The golden check proves the port produces the same output for *valid* input.
 * These prove it refuses the same *invalid* input — which no fixture can show,
 * because a fixture is by definition something that loaded.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Concept, Module } from "../src/model/academic.ts";
import { CourseEvent } from "../src/model/harness.ts";

const module = (module_id: string) =>
  Module.safeParse({ module_id, course_id: "CSS-4008", title: "t" });

const event = (occurred_at: string) =>
  CourseEvent.safeParse({
    event_id: "EVENT-1",
    event_type: "x",
    course_version_id: "CSS-4008-2026-FALL",
    occurred_at,
  });

test("a typo in authored YAML is an error, not an ignored key", () => {
  // `extra="forbid"` in Python; `.strict()` here. Applied by `entity()` so no
  // schema can forget it.
  assert.equal(Concept.safeParse({ concept_id: "CONCEPT-X", titel: "oops" }).success, false);
  assert.equal(Concept.safeParse({ concept_id: "CONCEPT-X", title: "ok" }).success, true);
});

test("identifier patterns are anchored at both ends", () => {
  assert.equal(module("MODULE-06").success, true);
  assert.equal(module("MODULE-DRAFT-06").success, true);
  assert.equal(module("MODULE-6").success, false, "one digit — the pattern wants two");
  assert.equal(module("xMODULE-06x").success, false, "an unanchored regex would accept this");
});

test("a timestamp without an offset is refused", () => {
  assert.equal(event("2026-10-15T23:59:00").success, false);
  assert.equal(event("2026-10-15T23:59:00+05:00").success, true);
});

test("the offset a professor wrote is what comes back", () => {
  // A JS `Date` would normalise +05:00 to UTC and print `Z`, changing the value
  // and differing from every fixture. So the string is kept.
  const parsed = event("2026-10-15T23:59:00+05:00");
  assert.equal(parsed.success, true);
  assert.equal((parsed as any).data.occurred_at, "2026-10-15T23:59:00+05:00");
});
