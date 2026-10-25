/**
 * What the Gradebook's policy card says about each block beyond its weight:
 * plugins/dsh-professor-pane/server/grading-view.js
 *
 *     node --test test/pane-grading-view.test.mjs
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { schemeFacts } from "../plugins/dsh-professor-pane/server/grading-view.js";

const run = (extra = {}) => ({
  grading_scheme: {
    components: [
      { component_id: "VSK1", title: "ВСК 1", weight: 0.3 },
      { component_id: "VSK2", title: "ВСК 2", weight: 0.3 },
      { component_id: "FINAL", title: "Final", weight: 0.4 },
    ],
  },
  extensions: { lms: { canvas_courses: { A: 1, B: 2 }, canvas_assignment_groups: { VSK1: { A: 11, B: 21 }, VSK2: { A: 12 } } } },
  ...extra,
});

const q = (n, component, weight = 0.04 / 3) => ({
  assessment_id: `ASSESSMENT-QUIZ-0${n}`, title: `Quiz ${n}`, type: "quiz", weight, component, due_at: `2026-09-2${n}T09:00:00+05:00`,
});
const assessments = [
  q(1, "VSK1"), q(2, "VSK1"), q(3, "VSK1"),
  ...[1, 2, 3, 4].map((n) => ({ assessment_id: `ASSESSMENT-HW-0${n}`, title: `HW${n}`, type: "assignment", weight: 0.04, component: "VSK1" })),
  { assessment_id: "ASSESSMENT-MT1", title: "Midterm 1", type: "exam", weight: 0.1, component: "VSK1" },
  { assessment_id: "ASSESSMENT-MT2", title: "Midterm 2", type: "exam", weight: 0.1, component: "VSK2" },
  { assessment_id: "ASSESSMENT-FP", title: "Final Project", type: "project", weight: 0.4, component: "FINAL" },
  { assessment_id: "ASSESSMENT-STRAY", title: "Stray essay", type: "assignment", weight: 0.2 },
];

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("no scheme, no facts — the card draws the flat weights", () => {
  assert.equal(schemeFacts({ run: {}, assessments }), null);
});

test("each block says what kinds of work are in it, with the per-item share when even", () => {
  const blocks = schemeFacts({ run: run(), assessments });
  const kinds = Object.fromEntries(blocks.VSK1.kinds.map((kind) => [kind.type, kind]));
  assert.equal(kinds.quiz.label, "Quizzes ×3");
  close(kinds.quiz.weight, 0.04);
  close(kinds.quiz.each, 0.04 / 3);
  assert.equal(kinds.assignment.label, "Homework ×4");
  close(kinds.assignment.each, 0.04);
  assert.equal(blocks.VSK2.kinds[0].label, "Midterm 2", "one item goes by its own title");
  assert.equal(blocks.VSK2.kinds[0].each, null);
  assert.deepEqual(blocks.VSK1.kinds.map((kind) => kind.type), ["assignment", "exam", "quiz"], "biggest share first");
});

test("dates spanned and marks in, per block", () => {
  const blocks = schemeFacts({ run: run(), assessments, graded: new Set(["ASSESSMENT-QUIZ-01"]) });
  assert.equal(blocks.VSK1.from, "2026-09-21T09:00:00+05:00");
  assert.equal(blocks.VSK1.to, "2026-09-23T09:00:00+05:00");
  assert.equal(blocks.VSK1.marked, 1);
  assert.equal(blocks.VSK1.total, 8);
  assert.equal(blocks.FINAL.from, null, "no dates yet");
});

test("Canvas mapping is said per block, and the course missing it is named", () => {
  const blocks = schemeFacts({ run: run(), assessments });
  assert.deepEqual(blocks.VSK1.canvas, { courses: ["A", "B"], missing: [] });
  assert.deepEqual(blocks.VSK2.canvas.missing, ["B"]);
  assert.deepEqual(blocks.FINAL.canvas.missing, ["A", "B"]);
  assert.equal(schemeFacts({ run: { ...run(), extensions: {} }, assessments }).VSK1.canvas, null, "no Canvas, no question");
});

test("a nested block's members count in its parent's bar", () => {
  const nested = run();
  nested.grading_scheme.components.push({ component_id: "HW1-BLOCK", title: "ВСК1 homework", weight: 0.16, parent: "VSK1" });
  const blocks = schemeFacts({
    run: nested,
    assessments: assessments.map((a) => (a.type === "assignment" && a.component === "VSK1" ? { ...a, component: "HW1-BLOCK" } : a)),
  });
  assert.ok(!blocks.VSK1.kinds.some((kind) => kind.type === "assignment"), "the parent's own members only");
  assert.ok(blocks.VSK1.parts.some((part) => part.type === "assignment"), "the bar counts the child's");
  assert.equal(blocks["HW1-BLOCK"].total, 4);
});
