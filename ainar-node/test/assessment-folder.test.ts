/**
 * An assessment's own folder (STORAGE.md §5): the loader reads the record, its
 * items and its item models out of `assessments/<ID>/`, refuses a record filed
 * under the wrong assessment, and the writer puts new records there.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCourse } from "../src/loader.ts";
import { candidateFiles } from "../src/record-edit.ts";
import { writeRecords } from "../src/records-write.ts";

const RUN = "CSS-4008-2026-FALL";

const workspace = (): { root: string; courseDir: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-folder-"));
  const courseDir = join(root, "courses", "CSS-4008");
  mkdirSync(courseDir, { recursive: true });
  writeFileSync(join(courseDir, "course.yaml"), "course_id: CSS-4008\ntitle: Artificial Intelligence\n");
  return { root, courseDir };
};

const put = (courseDir: string, path: string, text: string): void => {
  mkdirSync(join(courseDir, path, ".."), { recursive: true });
  writeFileSync(join(courseDir, path), text);
};

const assessment = (id: string) =>
  `assessment_id: ${id}\ncourse_version_id: ${RUN}\ntitle: Quiz\ntype: quiz\napproval: draft\n`;

const item = (id: string, owner: string) =>
  `  - item_id: ${id}\n    assessment_id: ${owner}\n    type: short_answer\n    prompt: Why?\n`;

test("the loader reads an assessment, its items and its item models from the assessment's folder", () => {
  const { root, courseDir } = workspace();
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/assessment.yaml", assessment("ASSESSMENT-QUIZ-01"));
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/items.yaml", "items:\n" + item("ITEM-Q1-01", "ASSESSMENT-QUIZ-01"));
  put(
    courseDir,
    "assessments/ASSESSMENT-QUIZ-01/src/item-models.yaml",
    "item_models:\n  - item_model_id: ITEM-MODEL-Q1\n    course_version_id: " + RUN +
      "\n    title: Why\n    outcome_id: LO-01\n    cognitive_level: understand\n    evidence_requirements: [a reason]\n    task_structure: [explain]\n",
  );
  // Material in the folder is not record: none of these is read.
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/keys/marking.yaml", "not: a record\n");
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/starter/config.yaml", "also: not a record\n");

  const { bundle, issues } = loadCourse(courseDir, root);
  assert.deepEqual(issues.errors, []);
  assert.deepEqual(bundle!.assessments.map((a: any) => a.assessment_id), ["ASSESSMENT-QUIZ-01"]);
  assert.deepEqual(bundle!.items.map((i: any) => i.item_id), ["ITEM-Q1-01"]);
  assert.deepEqual(bundle!.item_models.map((m: any) => m.item_model_id), ["ITEM-MODEL-Q1"]);
});

test("the flat files an older course uses are still read beside the folders", () => {
  const { root, courseDir } = workspace();
  put(courseDir, "assessments/01-quiz.yaml", assessment("ASSESSMENT-01"));
  put(courseDir, "assessments/ASSESSMENT-QUIZ-02/assessment.yaml", assessment("ASSESSMENT-QUIZ-02"));
  const { bundle } = loadCourse(courseDir, root);
  assert.deepEqual(
    bundle!.assessments.map((a: any) => a.assessment_id).sort(),
    ["ASSESSMENT-01", "ASSESSMENT-QUIZ-02"],
  );
});

test("an item filed in another assessment's folder is refused, not read", () => {
  const { root, courseDir } = workspace();
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/assessment.yaml", assessment("ASSESSMENT-QUIZ-01"));
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/items.yaml", "items:\n" + item("ITEM-Q2-01", "ASSESSMENT-QUIZ-02"));
  const { bundle, issues } = loadCourse(courseDir, root);
  assert.deepEqual(bundle!.items, []);
  assert.deepEqual(issues.errors.map((issue: any) => issue.code), ["assessment.folder_mismatch"]);
});

test("an assessment record in a folder not named for it is refused", () => {
  const { root, courseDir } = workspace();
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/assessment.yaml", assessment("ASSESSMENT-QUIZ-09"));
  const { bundle, issues } = loadCourse(courseDir, root);
  assert.deepEqual(bundle!.assessments, []);
  assert.deepEqual(issues.errors.map((issue: any) => issue.code), ["assessment.folder_mismatch"]);
});

test("the writer puts an assessment and its items into the assessment's folder", () => {
  const { root, courseDir } = workspace();
  const written = writeRecords(courseDir, {
    assessments: [
      { assessment_id: "ASSESSMENT-QUIZ-01", course_version_id: RUN, title: "Quiz", type: "quiz", approval: "draft" },
    ],
    items: [
      { item_id: "ITEM-Q1-01", assessment_id: "ASSESSMENT-QUIZ-01", type: "short_answer", prompt: "Why?", approval: "draft" },
      { item_id: "ITEM-Q2-01", assessment_id: "ASSESSMENT-QUIZ-02", type: "short_answer", prompt: "How?", approval: "draft" },
    ],
  });
  assert.deepEqual(written.sort(), [
    join(courseDir, "assessments", "ASSESSMENT-QUIZ-01", "assessment.yaml"),
    join(courseDir, "assessments", "ASSESSMENT-QUIZ-01", "items.yaml"),
    join(courseDir, "assessments", "ASSESSMENT-QUIZ-02", "items.yaml"),
  ].sort());
  const { bundle, issues } = loadCourse(courseDir, root);
  assert.deepEqual(issues.errors, []);
  assert.equal(bundle!.items.length, 2);
});

test("an item model is placed only when the caller says which assessment it serves", () => {
  const { courseDir } = workspace();
  const model = {
    item_model_id: "ITEM-MODEL-Q1",
    course_version_id: RUN,
    title: "Why",
    outcome_id: "LO-01",
    cognitive_level: "understand",
    evidence_requirements: ["a reason"],
    task_structure: ["explain"],
    approval: "draft",
  };
  assert.throws(() => writeRecords(courseDir, { item_models: [model] }), /assessmentId/);
  const [path] = writeRecords(courseDir, { item_models: [model] }, { assessmentId: "ASSESSMENT-QUIZ-01" });
  assert.equal(path, join(courseDir, "assessments", "ASSESSMENT-QUIZ-01", "src", "item-models.yaml"));
});

test("a record without an assessment id is refused before anything is written", () => {
  const { courseDir } = workspace();
  assert.throws(
    () =>
      writeRecords(courseDir, {
        items: [
          { item_id: "ITEM-A", assessment_id: "ASSESSMENT-QUIZ-01", type: "essay", prompt: "a" },
          { item_id: "ITEM-B", type: "essay", prompt: "b" },
        ],
      }),
    /assessment_id/,
  );
  assert.equal(existsSync(join(courseDir, "assessments")), false);
});

test("candidateFiles follows a * in a directory segment, and skips files it matches there", () => {
  const { root, courseDir } = workspace();
  put(courseDir, "assessments/ASSESSMENT-QUIZ-01/items.yaml", "items: []\n");
  put(courseDir, "assessments/01-quiz.yaml", assessment("ASSESSMENT-01"));
  assert.deepEqual(candidateFiles(root, "CSS-4008", ["assessments/*/items.yaml"]), [
    join(courseDir, "assessments", "ASSESSMENT-QUIZ-01", "items.yaml"),
  ]);
});
