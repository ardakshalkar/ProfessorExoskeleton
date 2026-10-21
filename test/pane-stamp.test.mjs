/**
 * How the student pages print a time (`stamp` in `server/page.js`).
 *
 * 1. **A `Z` is the professor's clock.** A recording, a hand-in, a sync is a
 *    moment this machine wrote down in UTC; it reads in local time.
 * 2. **An offset is the course's claim.** A deadline at `+05:00` prints as
 *    written, whatever timezone the machine is in.
 *
 *     node --test test/pane-stamp.test.mjs
 */

// Before any Date is made: Almaty, +05:00, no daylight saving.
process.env.TZ = "Asia/Almaty";

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { stamp } from "../plugins/dsh-professor-pane/server/page.js";

test("a UTC moment prints in local time", () => {
  assert.equal(stamp("2026-10-20T04:54:00.501Z"), "2026-10-20 09:54");
  assert.equal(stamp("2026-10-20T21:30:00Z"), "2026-10-21 02:30");
});

test("a time with an offset prints as written", () => {
  assert.equal(stamp("2026-09-18T09:00:00+05:00"), "2026-09-18 09:00");
  assert.equal(stamp("2026-09-18T09:00:00-04:00"), "2026-09-18 09:00");
});

test("a date, or nothing, is left alone", () => {
  assert.equal(stamp("2026-09-18"), "2026-09-18");
  assert.equal(stamp(""), "");
  assert.equal(stamp(null), "");
});
