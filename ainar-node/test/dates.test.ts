/**
 * LNG-6: a stamp's day is the run's day. `2026-09-07T20:00:00Z` is 01:00 on
 * the 8th in Almaty — the first day of week 2 of a run starting Tuesday 1
 * September — and reading the date off the stamp's text put it in week 1.
 *
 *     node --experimental-strip-types --test test/dates.test.ts
 */

import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { test } from "node:test";

import { localDate, startOfDay } from "../src/dates.ts";
import { inboxPayload } from "../src/inbox.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { outlinePayload } from "../src/outline.ts";
import { validatePayload } from "../src/validate.ts";

const ROOT = resolve(process.cwd(), "..", "workspace");
const RUN = "CSS-4008-2026-FALL"; // Asia/Almaty, 2026-09-01 .. 2026-12-20
const LATE_UTC = "2026-09-07T20:00:00Z";

const sample = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle! as any;
};

/** The sample with its first assessment due at `due_at`. */
const dueAt = (due_at: string) => {
  const b = sample();
  b.assessments = b.assessments.map((assessment: any, index: number) =>
    index === 0 ? { ...assessment, opens_at: null, due_at } : assessment,
  );
  return { b, id: b.assessments[0].assessment_id as string };
};

test("a stamp's day is read in the run's zone, not off its text", () => {
  assert.equal(localDate(LATE_UTC, "Asia/Almaty"), "2026-09-08");
  assert.equal(localDate("2026-09-07T23:59:00+05:00", "Asia/Almaty"), "2026-09-07");
  assert.equal(localDate(LATE_UTC, "UTC"), "2026-09-07");
  // West of Greenwich the other way: 02:00Z on the 8th is still the 7th in New York.
  assert.equal(localDate("2026-09-08T02:00:00Z", "America/New_York"), "2026-09-07");
  // Not a stamp at all: read off its text rather than lost.
  assert.equal(localDate("2026-09-07", "Asia/Almaty"), "2026-09-07");
});

test("a local day starts at local midnight, also across a daylight-saving change", () => {
  assert.equal(new Date(startOfDay("2026-09-08", "Asia/Almaty")).toISOString(), "2026-09-07T19:00:00.000Z");
  assert.equal(new Date(startOfDay("2026-09-08", "UTC")).toISOString(), "2026-09-08T00:00:00.000Z");
  // New York leaves daylight saving on 1 November 2026: midnight that day is still EDT.
  assert.equal(new Date(startOfDay("2026-11-01", "America/New_York")).toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(new Date(startOfDay("2026-11-02", "America/New_York")).toISOString(), "2026-11-02T05:00:00.000Z");
});

test("the outline puts a deadline written in UTC in the run's week", () => {
  const { b, id } = dueAt(LATE_UTC);
  const outline = outlinePayload(b, RUN, "2026-09-02") as any;
  const weekOf = outline.weeks.find((week: any) => week.due.some((entry: any) => entry.assessment_id === id));
  assert.equal(weekOf.number ?? weekOf.week, 2);
  const entry = weekOf.due.find((row: any) => row.assessment_id === id);
  assert.equal(entry.due_on, "2026-09-08");
});

test("the inbox and validate read the same day", () => {
  // Due 01:00 on the 8th in Almaty: on the 8th it is not yet closed.
  const { b, id } = dueAt(LATE_UTC);
  const inbox = inboxPayload(b, RUN, "2026-09-08") as any;
  assert.notEqual(inbox.assessments.find((row: any) => row.assessment_id === id).status, "closed");

  // Due 20:00 UTC on the run's last day is 01:00 the next day in Almaty: outside the run.
  const late = dueAt("2026-12-20T20:00:00Z");
  assert.ok(
    JSON.stringify(validatePayload(late.b)).includes("due 2026-12-21, outside the run window"),
    "validate reads the run's day",
  );
});

test("opens after due is judged on instants, not on how the text sorts", () => {
  const b = sample();
  // 09:00 in Almaty opens before 05:00Z (10:00 in Almaty), though "T09" sorts after "T05".
  b.assessments = b.assessments.map((assessment: any, index: number) =>
    index === 0 ? { ...assessment, opens_at: "2026-09-07T09:00:00+05:00", due_at: "2026-09-07T05:00:00Z" } : assessment,
  );
  assert.ok(!JSON.stringify(validatePayload(b)).includes("opens_at is after due_at"));
});
