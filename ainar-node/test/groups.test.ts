/**
 * Subgroups: the one filter three reports share.
 *
 * A course taught in subgroups meets each of them at a different time, and
 * before `LearningActivity.group` existed the model could not say which
 * meeting belonged to whom. These tests hold the two decisions that make the
 * filter usable rather than merely present:
 *
 * 1. **An unlabelled thing belongs to everyone.** A lecture both subgroups
 *    attend carries no group, and must not vanish from either one's plan.
 *    Passing no groups at all is the same statement about the whole run, which
 *    is what keeps the filter additive for every caller that predates it.
 * 2. **A group the run does not have is a refusal.** The alternative is an
 *    empty class: every count reads zero and nothing says why.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  activitiesFor,
  enrolledIn,
  groupsOf,
  requireGroups,
  type CourseBundle,
} from "../src/bundle.ts";
import { dashboardPayload } from "../src/progress.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { inboxPayload } from "../src/inbox.ts";

const RUN = "CSS-4008-2026-FALL";

const enrollment = (id: string, group: string | null, extra: object = {}) => ({
  enrollment_id: `ENR-${id}`,
  course_version_id: RUN,
  student_id: id,
  role: "student",
  status: "active",
  group,
  ...extra,
});

const activity = (id: string, group: string | null) => ({
  activity_id: id,
  course_version_id: RUN,
  type: "lab",
  title: id,
  scheduled_at: "2026-09-08T10:00:00+05:00",
  group,
  outcomes: [],
  concepts: [],
  resources: [],
});

/** Two subgroups, a lecture both attend, and one assessment two students sat. */
const fixture = (): CourseBundle =>
  ({
    course: { course_id: "CSS-4008", title: "Test" },
    outcomes: [],
    concepts: [{ concept_id: "C-1", title: "One", prerequisites: [] }],
    concept_edges: [],
    capabilities: [],
    modules: [
      { module_id: "M-1", course_id: "CSS-4008", week: 1, concepts: ["C-1"], outcomes: [] },
    ],
    users: [],
    versions: [
      {
        course_version_id: RUN,
        course_id: "CSS-4008",
        term: "2026-FALL",
        start_date: "2026-09-01",
        end_date: "2026-12-20",
        instructors: [],
        status: "running",
      },
    ],
    enrollments: [
      enrollment("STUDENT-AAA", "CS-01"),
      enrollment("STUDENT-BBB", "CS-01"),
      enrollment("STUDENT-CCC", "CS-02"),
      enrollment("STUDENT-DDD", "CS-02", { status: "dropped" }),
      enrollment("STUDENT-EEE", null),
    ],
    activities: [
      activity("ACT-LECTURE", null),
      activity("ACT-LAB-1", "CS-01"),
      activity("ACT-LAB-2", "CS-02"),
    ],
    documents: [],
    resources: [],
    assessments: [
      {
        assessment_id: "ASM-1",
        course_version_id: RUN,
        title: "Homework 1",
        type: "homework",
        maximum_score: 10,
        weight: 1.0,
        due_at: "2026-09-20T23:59:00+05:00",
        outcomes: [],
      },
    ],
    rubrics: [],
    items: [],
    item_models: [],
    submissions: [
      {
        submission_id: "SUB-A",
        assessment_id: "ASM-1",
        student_id: "STUDENT-AAA",
        attempt: 1,
        status: "submitted",
      },
      {
        submission_id: "SUB-C",
        assessment_id: "ASM-1",
        student_id: "STUDENT-CCC",
        attempt: 1,
        status: "submitted",
      },
    ],
    item_responses: [],
    evaluations: [
      {
        evaluation_id: "EV-A",
        submission_id: "SUB-A",
        criterion_id: "CR-1",
        status: "suggested",
        professor_decision: null,
      },
      {
        evaluation_id: "EV-C",
        submission_id: "SUB-C",
        criterion_id: "CR-1",
        status: "suggested",
        professor_decision: null,
      },
    ],
    evidence: [],
    concept_states: [],
    capability_states: [],
    signals: [
      {
        signal_id: "SIG-A",
        course_version_id: RUN,
        student_id: "STUDENT-AAA",
        status: "open",
        type: "gap",
        severity: "high",
        description: "",
        concepts: [],
        evidence_ids: [],
      },
      {
        signal_id: "SIG-CLASS",
        course_version_id: RUN,
        student_id: null,
        status: "open",
        type: "gap",
        severity: "low",
        description: "",
        concepts: [],
        evidence_ids: [],
      },
    ],
    interventions: [],
    events: [],
    action_items: [],
  }) as unknown as CourseBundle;

// --------------------------------------------------------------------------
// The primitives
// --------------------------------------------------------------------------

test("no groups means the whole run, which is what every older caller sends", () => {
  const b = fixture();
  assert.equal(enrolledIn(b, RUN).length, 4, "four active, the dropped one excluded");
  assert.equal(enrolledIn(b, RUN, { groups: [] }).length, 4);
  assert.equal(enrolledIn(b, RUN, { groups: null }).length, 4);
  assert.equal(activitiesFor(b, RUN).length, 3);
});

test("a subgroup narrows the class but keeps what everyone attends", () => {
  const b = fixture();
  assert.deepEqual(
    enrolledIn(b, RUN, { groups: ["CS-01"] }).map((e) => e.student_id),
    ["STUDENT-AAA", "STUDENT-BBB"],
  );
  // The lecture carries no group, so it is in this subgroup's plan too; only
  // the other subgroup's lab drops out. The order is `activitiesOf`'s — by
  // time, then by id — and filtering does not disturb it.
  assert.deepEqual(
    activitiesFor(b, RUN, ["CS-01"]).map((a) => a.activity_id),
    ["ACT-LAB-1", "ACT-LECTURE"],
  );
});

test("a dropped student is in no subgroup", () => {
  const b = fixture();
  assert.deepEqual(
    enrolledIn(b, RUN, { groups: ["CS-02"] }).map((e) => e.student_id),
    ["STUDENT-CCC"],
  );
});

test("the run's groups come from enrollments and meetings alike", () => {
  assert.deepEqual(groupsOf(fixture(), RUN), ["CS-01", "CS-02"]);

  // A subgroup that exists only as a meeting still counts: it is a label
  // `--group` has to accept.
  const meetingOnly = fixture();
  (meetingOnly.activities as unknown[]).push(activity("ACT-LAB-3", "CS-03"));
  assert.deepEqual(groupsOf(meetingOnly, RUN), ["CS-01", "CS-02", "CS-03"]);
});

test("a group the run does not have is refused, naming the ones it does", () => {
  const b = fixture();
  assert.deepEqual(requireGroups(b, RUN, ["CS-01"]), ["CS-01"]);
  assert.deepEqual(requireGroups(b, RUN, []), [], "nothing asked for is not an error");
  assert.throws(
    () => requireGroups(b, RUN, ["CS-1"]),
    /has no group 'CS-1'.*Groups in this run: CS-01, CS-02/s,
  );
});

test("a run with no subgroups says so rather than listing nothing", () => {
  const b = fixture();
  for (const entry of b.enrollments as Record<string, unknown>[]) entry.group = null;
  for (const entry of b.activities as Record<string, unknown>[]) entry.group = null;
  assert.throws(() => requireGroups(b, RUN, ["CS-01"]), /has no subgroups/);
});

// --------------------------------------------------------------------------
// The three reports
// --------------------------------------------------------------------------

/**
 * An unnarrowed payload must not gain a key.
 *
 * `workspace/golden/` compares these payloads against what the Python modules emit, key
 * for key, and a `groups: []` that is always present is a parity break for
 * every caller that never asked about subgroups. Absence is the whole run;
 * the key appears only when it is a real filter.
 */
test("the whole run carries no groups key at all", () => {
  const b = fixture();
  for (const payload of [
    dashboardPayload(b, RUN),
    inboxPayload(b, RUN, "2026-09-25"),
  ] as Record<string, unknown>[]) {
    assert.ok(!("groups" in payload), "an unnarrowed payload gained a key");
  }
  const gradebook = gradebookPayload(b, RUN) as any;
  assert.ok(!("groups" in gradebook.scope), "an unnarrowed gradebook scope gained a key");
});

test("class-progress counts one subgroup, and says which", () => {
  const b = fixture();
  const all = dashboardPayload(b, RUN) as any;
  assert.equal(all.totals.students, 4);

  const one = dashboardPayload(b, RUN, { groups: ["CS-01"] }) as any;
  assert.deepEqual(one.students, ["STUDENT-AAA", "STUDENT-BBB"]);
  assert.deepEqual(one.groups, ["CS-01"]);
});

test("the gradebook grades one subgroup, and warns that the totals are its own", () => {
  const one = gradebookPayload(fixture(), RUN, { groups: ["CS-01"] }) as any;
  assert.deepEqual(one.scope.groups, ["CS-01"]);
  const rows = one.assessments[0].rows as { student_id: string }[];
  assert.deepEqual(
    rows.map((row) => row.student_id),
    ["STUDENT-AAA", "STUDENT-BBB"],
  );
  assert.ok(
    (one.notes as string[]).some((note) => note.includes("not the class's")),
    "a subgroup's gradebook says it is one",
  );
});

test("a subgroup's inbox holds that subgroup's work, not the class's", () => {
  const b = fixture();
  const all = inboxPayload(b, RUN, "2026-09-25") as any;
  assert.equal(all.pending_evaluations.total, 2);
  assert.equal(all.run.enrolled_students, 4);

  const one = inboxPayload(b, RUN, "2026-09-25", { groups: ["CS-01"] }) as any;
  assert.deepEqual(one.groups, ["CS-01"]);
  assert.equal(one.run.enrolled_students, 2);
  // STUDENT-CCC's ungraded submission belongs to the other subgroup's pile.
  assert.equal(one.pending_evaluations.total, 1);
  // STUDENT-BBB never handed in, and the deadline has passed.
  assert.deepEqual(one.assessments[0].missing, ["STUDENT-BBB"]);
  assert.equal(one.assessments[0].submissions_received, 1);
});

test("a class-wide signal reaches every subgroup; one about a student, only theirs", () => {
  const one = inboxPayload(fixture(), RUN, "2026-09-25", { groups: ["CS-02"] }) as any;
  assert.deepEqual(
    (one.open_signals as { signal_id: string }[]).map((signal) => signal.signal_id),
    ["SIG-CLASS"],
    "STUDENT-AAA is in CS-01, so their signal is not CS-02's problem",
  );
});
