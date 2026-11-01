/**
 * `readiness` in the inbox (src/inbox.ts): the cases the golden fixture does
 * not reach. The fixture pins a run in its eighth week with every rung built
 * but material; these pin the term before it starts, no calendar at all, and
 * the rungs that a scaffold's `TODO` leaves unfinished.
 *
 *     node --experimental-strip-types --test test/readiness.test.ts
 */

import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { test } from "node:test";

import { runById } from "../src/bundle.ts";
import { readiness, termPhase } from "../src/inbox.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";

const ROOT = resolve(process.cwd(), "..", "workspace");
const RUN = "CSS-4008-2026-FALL";

const sample = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle! as any;
};

test("before the term there is no week, and the days to the start are counted", () => {
  assert.deepEqual(termPhase("2026-09-01", "2026-12-20", "2026-08-25"), { state: "before", week: null, days_to_start: 7 });
  assert.deepEqual(termPhase("2026-09-01", "2026-12-20", "2026-09-07"), { state: "running", week: 1, weeks: 16 });
  assert.deepEqual(termPhase("2026-09-01", "2026-12-20", "2026-09-08"), { state: "running", week: 2, weeks: 16 });
  assert.deepEqual(termPhase("2026-09-01", "2026-12-20", "2026-12-21"), { state: "finished", week: null, weeks: 16 });
});

test("with no date there is no calendar to read, so nothing is late", () => {
  const ready = readiness(sample(), RUN) as any;
  assert.equal(ready.phase, null);
  for (const stage of ready.stages) assert.equal(stage.timing, null);
  assert.deepEqual(ready.reminders, []);
  // Still ordered, still tiered: importance does not need a date.
  assert.deepEqual(ready.by_importance.optional, ["MODULE-08", "MODULE-11"]);
});

test("a week before the start, the syllabus rungs are due now and future weeks are not gaps", () => {
  const b = sample();
  const start = (runById(b).get(RUN) as any).start_date as string;
  const on = new Date(Date.parse(start) - 7 * 86_400_000).toISOString().slice(0, 10);
  const ready = readiness(b, RUN, on) as any;
  assert.equal(ready.phase.state, "before");
  assert.equal(ready.stages.find((stage: any) => stage.stage === "outcomes").timing, "due_now");
  for (const item of ready.stages.find((stage: any) => stage.stage === "materials").items) {
    assert.notEqual(item.importance, "required", `${item.id} is weeks away`);
  }
});

test("a TODO outcome is partial, a claim, and the professor's to state", () => {
  const b = sample();
  b.outcomes = b.outcomes.map((outcome: any, index: number) => (index === 0 ? { ...outcome, title: "TODO" } : outcome));
  const start = (runById(b).get(RUN) as any).start_date as string;
  const ready = readiness(b, RUN, start) as any;
  const outcomes = ready.stages[0];
  assert.equal(outcomes.state, "partial");
  assert.equal(outcomes.kind, "claim");
  assert.match(outcomes.detail, /^\d+ of \d+ outcomes stated$/);
  assert.equal(ready.next_step.stage, "outcomes");
  assert.equal(ready.checklist[0].id, "outcomes");
});

test("an assessment with no weight is never given one", () => {
  const b = sample();
  b.assessments = b.assessments.map((assessment: any, index: number) =>
    index === 0 ? { ...assessment, weight: null } : assessment,
  );
  const weights = (readiness(b, RUN) as any).stages.find((stage: any) => stage.stage === "weights");
  assert.equal(weights.state, "missing");
  assert.match(weights.detail, /carry no weight/);
  assert.equal(weights.next, "ask the professor — never choose a weight");
});
