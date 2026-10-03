/**
 * The grading policy drawn from the run's scheme: plugins/dsh-professor-pane/lib/grading-view.js
 *
 *     node --test test/pane-grading-view.test.mjs
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { schemeHtml } from "../plugins/dsh-professor-pane/lib/grading-view.js";

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

test("no scheme, no drawing — the flat list stays the view", () => {
  assert.equal(schemeHtml({ run: {}, assessments }), null);
});

test("each block says what is in it, grouped by kind, and whether it adds up", () => {
  const html = schemeHtml({ run: run(), assessments, graded: new Set(["ASSESSMENT-QUIZ-01"]) });
  assert.match(html, /Quizzes ×3 · 4%.*1\.33% each/);
  assert.match(html, /Homework ×4 · 16%.*4% each/);
  assert.match(html, /adds up to 30% ✓/, "ВСК1: 4 + 16 + 10");
  assert.match(html, /adds up to 10% of 30%/, "ВСК2 holds only Midterm 2 here");
  assert.match(html, /1 of 8 with marks/);
  assert.match(html, /Quiz 1 <span class="dim">09\.21<\/span> ✓/);
});

test("Canvas mapping is said per block, and the course missing it is named", () => {
  const html = schemeHtml({ run: run(), assessments });
  assert.match(html, /Canvas group mapped in all 2 courses/);
  assert.match(html, /Canvas group not mapped in B/);
  assert.match(html, /Canvas group not mapped in A, B/);
});

test("what counts in no block is drawn, not hidden", () => {
  const html = schemeHtml({ run: run(), assessments });
  assert.match(html, /In no block/);
  assert.match(html, /Stray essay/);
});

test("a nested block is drawn inside its parent", () => {
  const nested = run();
  nested.grading_scheme.components.push({ component_id: "HW1-BLOCK", title: "ВСК1 homework", weight: 0.16, parent: "VSK1" });
  const html = schemeHtml({
    run: nested,
    assessments: assessments.map((a) => (a.type === "assignment" && a.component === "VSK1" ? { ...a, component: "HW1-BLOCK" } : a)),
  });
  assert.match(html, /ВСК1 homework/);
  assert.match(html, /margin-left:14px/);
  assert.match(html, /adds up to 30% ✓/, "the parent counts its child's weight");
});
