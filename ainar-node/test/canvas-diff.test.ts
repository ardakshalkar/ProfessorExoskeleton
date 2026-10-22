import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { PlanRow } from "../src/lms/base.ts";
import type { AssignmentPlan } from "../src/lms/assignment.ts";
import {
  type PinNotes,
  assignmentDifferences,
  directionOf,
  gradeDifferences,
  gradeKey,
  keepCanvas,
  pinForm,
  pinsOf,
  rosterDifferences,
  syncAllPlan,
  tallyDifferences,
} from "../src/lms/canvas-diff.ts";
import { Ledger } from "../src/lms/ledger.ts";

/**
 * Where AINAR and Canvas disagree, and which side moved since the last sync:
 * only AINAR → push, only Canvas → pull, both → conflict, and agreement is no
 * difference at all. A "keep Canvas" pin lets the two differ on purpose.
 */

test("direction: one side moved, both moved, or neither", () => {
  // ours, theirs, base
  assert.equal(directionOf("8", "8", "6"), null, "agreeing is no difference, whatever the base");
  assert.equal(directionOf("9", "8", "8"), "push", "only AINAR changed");
  assert.equal(directionOf("8", "6", "8"), "pull", "only Canvas changed");
  assert.equal(directionOf("9", "6", "8"), "conflict", "both changed");
});

test("direction with no baseline: one side blank goes to the other, two values conflict", () => {
  assert.equal(directionOf("8", "", null), "push", "Canvas has nothing yet — the Quiz 3 case");
  assert.equal(directionOf("", "7", null), "pull", "only Canvas has a mark");
  assert.equal(directionOf("8", "7", null), "conflict", "nobody can say which came first");
});

test("a pin keeps a chosen difference quiet until either side moves", () => {
  const pin = { ours: "8", theirs: "6", at: "2026-10-22" };
  assert.equal(directionOf("8", "6", "8", pin), null, "kept as Canvas has it");
  assert.equal(directionOf("9", "6", "8", pin), "push", "the decision here changed since");
  assert.equal(directionOf("8", "5", "8", pin), "pull", "Canvas changed again");
  assert.equal(directionOf("9", "5", "8", pin), "conflict");
});

const row = (student_id: string, score: number | null, action: PlanRow["action"] = "change", reason: string | null = null): PlanRow => ({
  student_id,
  action,
  score,
  maximum: 10,
  comment: null,
  current: null,
  last_prepared: null,
  identity: null,
  reason,
});

test("grades: each row classified against Canvas and the ledger's last value", () => {
  const notes: PinNotes = { kept: new Set(), agreed: new Set() };
  const found = gradeDifferences({
    assessmentId: "ASSESSMENT-Q3",
    title: "Quiz 3",
    group: "ENG-8",
    canvasCourse: "101",
    rows: [
      row("STUDENT-SAME01", 8),
      row("STUDENT-PUSH01", 9),
      row("STUDENT-NEW001", 7),
      row("STUDENT-PULL01", 8),
      row("STUDENT-BOTH01", 9),
      row("STUDENT-HELD01", null, "skip", "1 of 3 criteria undecided"),
      row("STUDENT-GONE01", null, "unmatched"),
      row("STUDENT-VOID01", null, "excuse"),
    ],
    current: {
      "STUDENT-SAME01": 8,
      "STUDENT-PUSH01": 8,
      "STUDENT-PULL01": 6,
      "STUDENT-BOTH01": 6,
      "STUDENT-HELD01": 5,
      "STUDENT-GONE01": 4,
      "STUDENT-VOID01": 3,
    },
    excused: new Set(),
    prepared: {
      "STUDENT-SAME01": 8,
      "STUDENT-PUSH01": 8,
      "STUDENT-PULL01": 8,
      "STUDENT-BOTH01": 8,
      "STUDENT-HELD01": 5,
      // The mark sent before an integrity case voided it.
      "STUDENT-VOID01": 3,
    },
    pins: new Map(),
    notes,
  });
  const by = Object.fromEntries(found.map((entry) => [entry.student_id, entry]));
  assert.equal(by["STUDENT-SAME01"], undefined, "unchanged is not a difference");
  assert.equal(by["STUDENT-GONE01"], undefined, "a row Canvas cannot place is the class list's business");
  assert.deepEqual(
    [by["STUDENT-PUSH01"]!.direction, by["STUDENT-PUSH01"]!.changed, by["STUDENT-PUSH01"]!.ours, by["STUDENT-PUSH01"]!.theirs],
    ["push", "ainar", "9", "8"],
  );
  assert.equal(by["STUDENT-NEW001"]!.direction, "push", "Canvas has no mark yet");
  assert.deepEqual([by["STUDENT-PULL01"]!.direction, by["STUDENT-PULL01"]!.changed], ["pull", "canvas"]);
  assert.deepEqual([by["STUDENT-BOTH01"]!.direction, by["STUDENT-BOTH01"]!.changed], ["conflict", "both"]);
  assert.equal(by["STUDENT-HELD01"]!.direction, "held", "Canvas has what we sent, but nothing here is ready to replace it");
  assert.equal(by["STUDENT-HELD01"]!.reason, "1 of 3 criteria undecided");
  assert.deepEqual([by["STUDENT-VOID01"]!.direction, by["STUDENT-VOID01"]!.ours], ["push", "EX"], "a voided mark goes as excused");
  assert.equal(by["STUDENT-PUSH01"]!.key, gradeKey("ASSESSMENT-Q3", "ENG-8", "STUDENT-PUSH01"));

  const tally = tallyDifferences(found);
  assert.deepEqual(tally.grades, { push: 3, pull: 1, conflict: 1, held: 1 });
});

test("keep Canvas: pinned in the ledger, quiet while it holds, dropped once the two agree", () => {
  const ledger = Ledger.load("RUN-X", mkdtempSync(join(tmpdir(), "ainar-diff-")));
  const key = gradeKey("ASSESSMENT-Q3", null, "STUDENT-PULL01");
  keepCanvas(ledger, key, "8", "6", "2026-10-22T10:00:00+05:00");
  const pins = pinsOf(ledger);
  const compare = (ours: number, theirs: number) => {
    const notes: PinNotes = { kept: new Set(), agreed: new Set() };
    const found = gradeDifferences({
      assessmentId: "ASSESSMENT-Q3",
      title: null,
      group: null,
      canvasCourse: "1",
      rows: [row("STUDENT-PULL01", ours)],
      current: { "STUDENT-PULL01": theirs },
      excused: new Set(),
      prepared: { "STUDENT-PULL01": 8 },
      pins,
      notes,
    });
    return { found, notes };
  };
  const kept = compare(8, 6);
  assert.deepEqual(kept.found, [], "kept as Canvas has it");
  assert.deepEqual([...kept.notes.kept], [key]);
  assert.equal(compare(9, 6).found[0]!.direction, "push", "re-decided here after keeping");
  assert.deepEqual([...compare(6, 6).notes.agreed], [key], "the two agree now: the pin can go");
});

const fieldPlan = (fields: AssignmentPlan["fields"]): AssignmentPlan => ({
  course_version_id: "RUN-X",
  assessment_id: "ASSESSMENT-Q3",
  group: null,
  canvas_course_id: "1",
  canvas_assignment_id: "2",
  operation: "update",
  fields,
  send: {},
  notes: [],
});

test("definitions: drift splits into Canvas's change and both sides', and nothing counts before a first send", () => {
  const plan = fieldPlan([
    { field: "name", action: "unchanged", desired: "Quiz 3", current: "Quiz 3", reason: null, ours_changed: false },
    { field: "points_possible", action: "change", desired: "10", current: "5", reason: null, ours_changed: true },
    { field: "due_at", action: "drift", desired: "2026-10-20T18:00:00Z", current: "2026-10-21T18:00:00Z", reason: "edited", ours_changed: false },
    { field: "description", action: "drift", desired: "<p>new</p>", current: "<p>theirs</p>", reason: "edited", ours_changed: true },
  ]);
  const found = assignmentDifferences({ plan, title: "Quiz 3", sent: true, pins: new Map() });
  assert.deepEqual(
    found.map((entry) => [entry.field, entry.direction]),
    [
      ["points_possible", "push"],
      ["due_at", "pull"],
      ["description", "conflict"],
    ],
  );
  assert.deepEqual(assignmentDifferences({ plan, title: "Quiz 3", sent: false, pins: new Map() }), []);
  const long = "x".repeat(400);
  assert.match(pinForm(long), /^sha256:/, "a long value is pinned by digest, not carried");
  assert.equal(pinForm("Quiz 3"), "Quiz 3");
});

test("class list: Canvas is the source — new people come in, people only here and unsure matches are held", () => {
  const found = rosterDifferences({
    matches: [
      { group: "ENG-8", canvasId: "1", student: "STUDENT-KEPT01", how: "linked", institutionalId: "1", user: {} },
      { group: "ENG-9", canvasId: "2", student: "STUDENT-MOVE01", how: "id", institutionalId: "2", user: {} },
      { group: "ENG-8", canvasId: "3", student: "STUDENT-NEW001", how: "new", institutionalId: "3", user: {} },
      { group: "ENG-8", canvasId: "4", student: null, how: null, institutionalId: null, user: {}, problem: "has the name of two people" },
    ],
    enrolled: new Map([
      ["STUDENT-KEPT01", "ENG-8"],
      ["STUDENT-MOVE01", "ENG-8"],
      ["STUDENT-ONLY01", "ENG-8"],
    ]),
    groups: ["ENG-8", "ENG-9"],
  });
  assert.deepEqual(
    found.map((entry) => [entry.student_id ?? entry.theirs, entry.direction]),
    [
      ["STUDENT-MOVE01", "pull"],
      ["STUDENT-NEW001", "pull"],
      ["Canvas user 4", "held"],
      ["STUDENT-ONLY01", "held"],
    ],
  );
});

test("Sync all applies only the one-sided differences, batched per assessment and course", () => {
  const grades = gradeDifferences({
    assessmentId: "ASSESSMENT-Q3",
    title: "Quiz 3",
    group: "ENG-8",
    canvasCourse: "101",
    rows: [row("STUDENT-A00001", 9), row("STUDENT-B00001", 7), row("STUDENT-C00001", 9)],
    current: { "STUDENT-A00001": 8, "STUDENT-C00001": 6 },
    excused: new Set(),
    prepared: { "STUDENT-A00001": 8, "STUDENT-C00001": 8 },
    pins: new Map(),
  });
  const roster = rosterDifferences({
    matches: [{ group: "ENG-8", canvasId: "3", student: "STUDENT-NEW001", how: "new", institutionalId: "3", user: {} }],
    enrolled: new Map(),
    groups: ["ENG-8"],
  });
  const plan = syncAllPlan([...grades, ...roster]);
  assert.deepEqual(plan.send.map((entry) => entry.student_id), ["STUDENT-A00001", "STUDENT-B00001"]);
  assert.deepEqual(plan.take.map((entry) => entry.student_id), ["STUDENT-NEW001"]);
  assert.deepEqual(plan.held.map((entry) => [entry.student_id, entry.direction]), [["STUDENT-C00001", "conflict"]]);
  assert.deepEqual(plan.batches, [
    { kind: "grades", assessment_id: "ASSESSMENT-Q3", group: "ENG-8", students: ["STUDENT-A00001", "STUDENT-B00001"], fields: [] },
  ]);
});
