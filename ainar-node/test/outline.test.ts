/**
 * The term plan's gaps: the four questions asked of one week.
 *
 * `weeks[].gaps` is what lets a professor's view colour a week by what is
 * missing from it instead of sending them to a checklist in another tab. The
 * rules worth pinning are the ones that were decided rather than fallen into:
 *
 * 1. **A week with no meeting is not missing a deck.** There is no class to
 *    write one for, and a gap there would report "nothing is scheduled" twice.
 * 2. **One piece of work is one fault.** An assessment that opens and falls due
 *    in the same week appears in two of the week's lists and must be named once.
 * 3. **A gap names records.** `ids` is what makes it something a professor can
 *    act on rather than a number.
 * 4. **The tally is weeks, not faults.** `totals.gaps.weeks` counts weeks
 *    holding at least one, because a strip printing the sum of the columns
 *    would claim more weeks than the run has.
 *
 * The fixture is synthetic on purpose: the sample course is nearly complete, so
 * the states worth testing — undated work, unweighted work — do not occur in it.
 *
 *     node --experimental-strip-types --test test/outline.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { outlinePayload } from "../src/outline.ts";
import type { CourseBundle } from "../src/bundle.ts";

const RUN = "CSS-4008-2026-FALL";
/** Six weeks: 2026-09-01 is a Tuesday and the run ends on a Monday. */
const ON = "2026-09-10";

const activity = (id: string, moduleId: string, resources: string[]) => ({
  activity_id: id,
  course_version_id: RUN,
  module_id: moduleId,
  type: "lecture",
  title: id,
  scheduled_at: "2026-09-08T10:00:00+05:00",
  group: null,
  outcomes: [],
  concepts: [],
  resources,
});

const assessment = (id: string, extra: object) => ({
  assessment_id: id,
  course_version_id: RUN,
  title: id,
  type: "assignment",
  maximum_score: 10,
  submission_type: "file",
  outcomes: [],
  ...extra,
});

/**
 * Two planned weeks and four empty ones, with one of each fault in it:
 * week 1 teaches with a deck and carries work nobody has dated, week 2 teaches
 * without a deck and carries work nobody has weighted.
 */
const fixture = (): CourseBundle =>
  ({
    course: { course_id: "CSS-4008", title: "Test", language: "en" },
    outcomes: [],
    concepts: [],
    concept_edges: [],
    capabilities: [],
    modules: [
      { module_id: "M-1", course_id: "CSS-4008", week: 1, concepts: [], outcomes: [] },
      { module_id: "M-2", course_id: "CSS-4008", week: 2, concepts: [], outcomes: [] },
    ],
    users: [],
    versions: [
      {
        course_version_id: RUN,
        course_id: "CSS-4008",
        term: "2026-FALL",
        start_date: "2026-09-01",
        end_date: "2026-10-12",
        instructors: [],
        status: "running",
      },
    ],
    enrollments: [],
    activities: [activity("ACT-1", "M-1", ["RES-DECK"]), activity("ACT-2", "M-2", [])],
    documents: [],
    resources: [
      { resource_id: "RES-DECK", title: "Week 1", kind: "slides", required: false, url: "a.pdf" },
    ],
    assessments: [
      // Dated and weighted, in week 2. The week's only complaint is the deck.
      assessment("ASM-FINE", {
        module_id: "M-2",
        weight: 0.5,
        due_at: "2026-09-10T23:59:00+05:00",
      }),
      // Opens and falls due inside week 2, so it is in two of that week's lists.
      assessment("ASM-NOWEIGHT", {
        module_id: "M-2",
        weight: null,
        opens_at: "2026-09-08T09:00:00+05:00",
        due_at: "2026-09-11T23:59:00+05:00",
      }),
      // No dates at all: placed on its module's week and reported as undated.
      assessment("ASM-UNDATED", { module_id: "M-1", weight: 0.5 }),
    ],
    rubrics: [],
    items: [],
    item_models: [],
    submissions: [],
    responses: [],
    evaluations: [],
    decisions: [],
    evidence: [],
    concept_states: [],
    signals: [],
    interventions: [],
    action_items: [],
  }) as unknown as CourseBundle;

const plan = () => outlinePayload(fixture(), RUN, ON) as Record<string, any>;

const kindsOf = (week: Record<string, any>): string[] =>
  (week.gaps as Record<string, unknown>[]).map((gap) => String(gap.kind));

const gapOf = (week: Record<string, any>, kind: string): Record<string, any> | undefined =>
  (week.gaps as Record<string, any>[]).find((gap) => gap.kind === kind);

test("every week carries a gaps list, empty or not", () => {
  for (const week of plan().weeks) {
    assert.ok(Array.isArray(week.gaps), `week ${week.week} has no gaps list`);
  }
});

test("a week that meets with a deck is not missing one", () => {
  const [first] = plan().weeks;
  assert.equal(kindsOf(first).includes("deck"), false);
});

test("a week that meets without a deck is", () => {
  const second = plan().weeks[1];
  assert.deepEqual(kindsOf(second).sort(), ["deck", "weight"]);
  assert.deepEqual(gapOf(second, "deck")!.ids, ["ACT-2"]);
});

test("a week with no meeting is not missing a deck, only a module", () => {
  // Weeks three to six teach nothing. Counting a deck there would report the
  // same hole twice: once as unplanned, once as an absent deck for no class.
  for (const week of plan().weeks.slice(2)) {
    assert.deepEqual(kindsOf(week), ["module"], `week ${week.week}`);
  }
});

test("work with no deadline is named on the week its module teaches", () => {
  const [first] = plan().weeks;
  assert.deepEqual(kindsOf(first), ["deadline"]);
  assert.deepEqual(gapOf(first, "deadline")!.ids, ["ASM-UNDATED"]);
  assert.match(gapOf(first, "deadline")!.note, /ASM-UNDATED carries no deadline/);
});

test("work that opens and falls due in one week is one fault, not two", () => {
  const second = plan().weeks[1];
  assert.deepEqual(gapOf(second, "weight")!.ids, ["ASM-NOWEIGHT"]);
});

test("the tally counts weeks, not faults", () => {
  const { gaps } = plan().totals;
  // Six weeks, every one of them waiting on something — but one week carries
  // two, so the columns add up to more than the run has weeks.
  assert.equal(gaps.weeks, 6);
  assert.deepEqual(
    { module: gaps.module, deck: gaps.deck, deadline: gaps.deadline, weight: gaps.weight },
    { module: 4, deck: 1, deadline: 1, weight: 1 },
  );
});

test("a gap says what is wrong in a sentence, and nothing about a student", () => {
  for (const week of plan().weeks) {
    for (const gap of week.gaps) {
      assert.ok(String(gap.note).length > 20, `${gap.kind} has no note`);
      assert.ok(Array.isArray(gap.ids), `${gap.kind} has no ids`);
      // Pseudonyms are the only way a student appears anywhere in this model,
      // and this document is the one a student may be shown.
      assert.equal(/STUDENT-/.test(String(gap.note)), false);
    }
  }
});
