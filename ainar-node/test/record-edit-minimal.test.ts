/**
 * An edit to one field of a record changes that field and nothing else.
 *
 *     node --experimental-strip-types --test test/record-edit-minimal.test.ts
 *
 * Adding `component: VSK1` to a quiz once rewrote 280 of its lines: every list
 * re-indented and every long description re-folded. A professor reviewing that
 * diff cannot see the one line that changed.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COLLECTIONS } from "../src/loader.ts";
import { editRecords } from "../src/record-edit.ts";
import { AGENT_WRITABLE } from "../src/approval.ts";
import { HEADER, floatPaths } from "../src/records-write.ts";
import { dump } from "../src/yaml-out.ts";

const changedLines = (before: string, after: string): number => {
  const a = before.split("\n");
  const b = after.split("\n");
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return Math.max(a.length, b.length) - i - j;
};

const course = (text: string) => {
  const root = mkdtempSync(join(tmpdir(), "ainar-edit-"));
  const dir = join(root, "courses", "CSS-4007");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "assessments.yaml");
  writeFileSync(path, text, "utf-8");
  return { root, path };
};

const edit = (root: string, change: (node: any) => void) =>
  editRecords({
    root,
    courseId: "CSS-4007",
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
    edits: new Map([["ASSESSMENT-QUIZ-01", change]]),
  });

const record = {
  assessment_id: "ASSESSMENT-QUIZ-01",
  course_version_id: "CSS-4007-2026-FALL",
  title: "Quiz 1",
  type: "quiz",
  description:
    "Week 1 material (tokens, tokenization, next-token prediction, sampling, cost), Week 2 material as taught " +
    "(attention in simple contexts and the embedding row behind it) and Week 3 material (system instructions).",
  maximum_score: 10,
  weight: 0.0133,
  outcomes: ["LO-01", "LO-02"],
};

test("a file the record writer wrote changes by exactly the field added", () => {
  // Written the way `records-write.ts` writes it: floats where the schema says.
  const floats = floatPaths((AGENT_WRITABLE as any).assessments, ["assessments"]);
  const original = HEADER + dump({ assessments: [record] }, (path) => floats.has(path.join(".")));
  const { root, path } = course(original);
  edit(root, (node) => node.set("component", "VSK1"));
  const after = readFileSync(path, "utf-8");
  assert.equal(changedLines(original, after), 1, after);
  assert.match(after, /^ {2}component: VSK1$/m);
});

test("a hand-authored file keeps its comments and its list indentation", () => {
  const original = [
    "# Quiz 1, written by hand.",
    "assessments:",
    "# the first quiz",
    "- assessment_id: ASSESSMENT-QUIZ-01",
    "  title: Quiz 1",
    "  outcomes:",
    "  - LO-01",
    "  - LO-02",
    "",
  ].join("\n");
  const { root, path } = course(original);
  edit(root, (node) => node.set("component", "VSK1"));
  const after = readFileSync(path, "utf-8");
  assert.match(after, /# Quiz 1, written by hand\./);
  assert.match(after, /# the first quiz/);
  assert.match(after, /^ {2}- LO-01$/m, "the list stays at its key's column");
  assert.equal(changedLines(original, after), 1, after);
});
