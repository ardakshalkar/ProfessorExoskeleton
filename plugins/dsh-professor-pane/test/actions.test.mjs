// The command field's matcher (shared/actions.js): what a professor types,
// and what it should offer first.

import { test } from "node:test";
import assert from "node:assert/strict";

import { ACTIONS, matchCommand } from "../shared/actions.js";

const INDEX = {
  weeks: [{ week: 7, title: "Agents" }, { week: 8, title: "MCP, skills, plugins" }],
  students: [{ id: "STUDENT-BJEH4I", name: "Bahytkali Ulbosyn" }, { id: "STUDENT-3BCIXS", name: null }],
  assessments: [{ id: "ASSESSMENT-QUIZ-03", title: "Quiz 3 - Weeks 4-5" }],
  concepts: [{ id: "CONCEPT-CONTEXT-WINDOW", title: "The context window" }],
};

test("every action has an id, a label and one way to do it", () => {
  const ids = new Set();
  for (const action of ACTIONS) {
    assert.ok(action.id && !ids.has(action.id), "unique id " + action.id);
    ids.add(action.id);
    assert.ok(action.label);
    assert.equal(Object.keys(action.do).length, 1, action.id);
    assert.ok(["open", "fill", "press"].includes(Object.keys(action.do)[0]), action.id);
  }
});

test("a week by its number is exact", () => {
  const [first] = matchCommand("week 7", INDEX);
  assert.equal(first.kind, "week");
  assert.equal(first.exact, true);
  assert.deepEqual(first.do, { open: { mode: "teaching", week: 7 } });
  assert.equal(matchCommand("w8", INDEX)[0].label, "Week 8 · MCP, skills, plugins");
});

test("an action by its words, outward ones marked", () => {
  assert.equal(matchCommand("sync all", INDEX)[0].label, "Sync all");
  assert.equal(matchCommand("sync all", INDEX)[0].exact, true);
  const release = matchCommand("send marks", INDEX)[0];
  assert.equal(release.label, "Send marks to Canvas");
  assert.equal(release.outward, true);
});

test("a student by name or by code; an assessment and a concept by title", () => {
  assert.equal(matchCommand("bahyt", INDEX)[0].do.open.student, "STUDENT-BJEH4I");
  assert.equal(matchCommand("STUDENT-3BCIXS", INDEX)[0].exact, true);
  assert.equal(matchCommand("quiz 3", INDEX)[0].do.open.grade, "ASSESSMENT-QUIZ-03");
  assert.equal(matchCommand("context window", INDEX)[0].do.open.concept, "CONCEPT-CONTEXT-WINDOW");
});

test("a question is not an exact match, so Enter still asks the assistant", () => {
  const found = matchCommand("why did week 7 go badly", INDEX);
  assert.ok(found.every((entry) => !entry.exact));
});

test("a skill is filled with the run, never sent", () => {
  const prepare = matchCommand("prepare lesson", INDEX)[0];
  assert.equal(prepare.do.fill, "/prepare-lesson {run} ");
  assert.equal(prepare.hint, "/prepare-lesson");
});
