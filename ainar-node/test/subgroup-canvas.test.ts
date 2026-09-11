import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  canvasAssignmentFor,
  canvasAssignments,
  canvasCourseFor,
  canvasCourses,
  isPerSubgroup,
} from "../src/lms/index.ts";
import { validate } from "../src/validate.ts";
import type { CourseBundle } from "../src/bundle.ts";

/**
 * A run taught to two subgroups in two separate Canvas courses.
 *
 * The shape exists because one offering at this university is often two Canvas
 * shells rather than one shell with two sections: separate enrolments,
 * separate assignments, separately numbered. The danger it introduces is
 * specific and is what these tests are about — a push that picks the wrong one
 * of the two puts one cohort's marks in the other cohort's gradebook, where
 * they look plausible.
 */

const lms = (extensions: Record<string, unknown>) => ({ extensions: { lms: extensions } });

// -------------------------------------------------------------- the accessors

test("a run with one Canvas course answers the same for every subgroup", () => {
  const run = lms({ canvas_course_id: "88219" });
  assert.equal(isPerSubgroup(run), false);
  assert.equal(canvasCourseFor(run, "CS-401"), "88219");
  assert.equal(canvasCourseFor(run, "CS-402"), "88219");
  assert.equal(canvasCourseFor(run, null), "88219");
});

test("a run with a course per subgroup answers per subgroup", () => {
  const run = lms({ canvas_courses: { "CS-401": "88219", "CS-402": "88220" } });
  assert.equal(isPerSubgroup(run), true);
  assert.equal(canvasCourseFor(run, "CS-401"), "88219");
  assert.equal(canvasCourseFor(run, "CS-402"), "88220");
  assert.deepEqual([...canvasCourses(run).keys()].sort(), ["CS-401", "CS-402"]);
});

test("a subgroup missing from the mapping gets nothing, never a neighbour's course", () => {
  // The half-configured case, and the one worth being strict about. Falling
  // back to some other subgroup's course here would push CS-403's marks into
  // CS-401's gradebook, where nothing about them looks wrong.
  const run = lms({ canvas_courses: { "CS-401": "88219" } });
  assert.equal(canvasCourseFor(run, "CS-403"), null);
});

test("naming no subgroup against a per-subgroup run resolves to nothing", () => {
  const run = lms({ canvas_courses: { "CS-401": "88219", "CS-402": "88220" } });
  assert.equal(
    canvasCourseFor(run, null),
    null,
    "there is no single answer, so there must not be one",
  );
});

test("assignments follow the same rule, one level down", () => {
  const single = lms({ canvas_assignment_id: "90218" });
  assert.equal(canvasAssignmentFor(single, "CS-401"), "90218");

  const perGroup = lms({ canvas_assignments: { "CS-401": "90218", "CS-402": "90455" } });
  assert.equal(canvasAssignmentFor(perGroup, "CS-401"), "90218");
  assert.equal(canvasAssignmentFor(perGroup, "CS-402"), "90455");
  assert.equal(canvasAssignmentFor(perGroup, "CS-403"), null);
  assert.equal(canvasAssignments(perGroup).size, 2);
});

test("a mapping that is not a mapping reads as absent rather than throwing", () => {
  assert.equal(canvasCourses(lms({ canvas_courses: "88219" })).size, 0);
  assert.equal(canvasCourses(lms({ canvas_courses: ["88219"] })).size, 0);
  assert.equal(canvasCourses({}).size, 0);
});

// -------------------------------------------------------------- the validator

/**
 * A bundle with one run, two subgroups, and nothing else.
 *
 * Every collection is present and empty, in the shape `validate.test.ts` uses:
 * the validator walks all of them, and a missing key fails on the walk rather
 * than on the rule under test.
 */
const bundleWith = (
  runExtensions: Record<string, unknown>,
  assessmentExtensions: Record<string, unknown> | null = null,
): CourseBundle =>
  ({
    course: { course_id: "C" },
    outcomes: [],
    concepts: [],
    concept_edges: [],
    capabilities: [],
    modules: [],
    users: [],
    versions: [
      {
        course_version_id: "C-2026",
        course_id: "C",
        term: "2026",
        extensions: { lms: runExtensions },
      },
    ],
    enrollments: [
      {
        course_version_id: "C-2026",
        student_id: "STUDENT-A",
        role: "student",
        status: "active",
        group: "CS-401",
      },
      {
        course_version_id: "C-2026",
        student_id: "STUDENT-B",
        role: "student",
        status: "active",
        group: "CS-402",
      },
    ],
    activities: [],
    documents: [],
    resources: [],
    assessments: assessmentExtensions
      ? [
          {
            assessment_id: "ASSESSMENT-01",
            course_version_id: "C-2026",
            title: "One",
            extensions: { lms: assessmentExtensions },
          },
        ]
      : [],
    rubrics: [],
    items: [],
    item_models: [],
    submissions: [],
    item_responses: [],
    evaluations: [],
    evidence: [],
    concept_states: [],
    capability_states: [],
    signals: [],
    interventions: [],
    events: [],
    action_items: [],
  }) as unknown as CourseBundle;

/** Just the codes, so a test says what it means without matching prose. */
const codesFrom = (bundle: CourseBundle): string[] =>
  validate(bundle).items.map((issue) => issue.code);

test("setting both course forms is refused rather than resolved by precedence", () => {
  const codes = codesFrom(
    bundleWith({ canvas_course_id: "88219", canvas_courses: { "CS-401": "88220" } }),
  );
  assert.ok(codes.includes("lms.both_course_forms"));
});

test("a subgroup the run does not have is an error, not a silent no-op", () => {
  const codes = codesFrom(bundleWith({ canvas_courses: { "CS-999": "88219" } }));
  assert.ok(codes.includes("lms.unknown_subgroup"));
});

test("a non-numeric id in the mapping is caught the same as a scalar one", () => {
  const codes = codesFrom(bundleWith({ canvas_courses: { "CS-401": "canvas-88219" } }));
  assert.ok(codes.includes("lms.malformed"));
});

test("a subgroup left out of a mapping that exists is a warning", () => {
  const issues = validate(bundleWith({ canvas_courses: { "CS-401": "88219" } })).items;
  const found = issues.find((issue) => issue.code === "lms.unmapped_subgroup")!;
  assert.ok(found, "CS-402 has nowhere to be pushed and that has to be said");
  assert.match(found.message, /CS-402/);
  assert.equal(found.level, "warning", "a gap to fill, not a record to reject");
});

test("a single assignment id under a per-subgroup run is refused", () => {
  // Each Canvas course numbers its assignments independently, so one id
  // cannot address both. Left alone, this would send every cohort's marks to
  // one column in whichever course happened to own that number.
  const codes = codesFrom(
    bundleWith({ canvas_courses: { "CS-401": "88219", "CS-402": "88220" } }, { canvas_assignment_id: "90218" }),
  );
  assert.ok(codes.includes("lms.malformed"));
});

test("the same assignment number in two different courses is not a duplicate", () => {
  // Two shells numbering their first assignment `1` is ordinary. The old
  // check keyed on the number alone and would have called this a collision.
  const codes = codesFrom(
    bundleWith(
      { canvas_courses: { "CS-401": "88219", "CS-402": "88220" } },
      { canvas_assignments: { "CS-401": "1", "CS-402": "1" } },
    ),
  );
  assert.ok(!codes.includes("lms.duplicate_link"), codes.join(", "));
});

test("a fully mapped per-subgroup run raises nothing about its subgroups", () => {
  const codes = codesFrom(
    bundleWith(
      { canvas_courses: { "CS-401": "88219", "CS-402": "88220" } },
      { canvas_assignments: { "CS-401": "90218", "CS-402": "90455" } },
    ),
  );
  for (const code of ["lms.both_course_forms", "lms.unknown_subgroup", "lms.unmapped_subgroup", "lms.malformed"]) {
    assert.ok(!codes.includes(code), `${code} fired on a correct record: ${codes.join(", ")}`);
  }
});
