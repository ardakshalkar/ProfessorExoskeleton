/**
 * Writing a Canvas assignment id back into the record that earned it.
 *
 *     node --experimental-strip-types --test test/assignment-link.test.ts
 *
 * This is the only part of `lms` that writes into `courses/`, which makes it
 * the part worth being careful about. Two properties matter more than the
 * feature itself:
 *
 * * **comments survive.** These files are hand-authored and the comments carry
 *   the reasoning — why a weight is what it is, what a professor still owes.
 *   A round trip through parse-and-dump would delete every one of them, and
 *   nobody would notice until they went looking for the note.
 * * **a second subgroup does not erase the first.** Linking CS-402 must leave
 *   CS-401's id where it is.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeAssessmentLinks } from "../src/lms/link.ts";

const FILE = `# Every assessment of the run.
#
# The weight is the professor's claim and nobody else's.

assessments:
  - assessment_id: ASSESSMENT-02
    course_version_id: CSS-4008-2026-FALL
    title: Data Preparation Report
    type: assignment
    # 15% because the report carries LO-03 on its own.
    weight: 0.15
    maximum_score: 100

  - assessment_id: ASSESSMENT-04
    course_version_id: CSS-4008-2026-FALL
    title: Model Evaluation Assignment
    type: assignment
    weight: 0.2
    maximum_score: 100
`;

/** A workspace holding one assessments file, and the path to it. */
const workspace = (contents = FILE): { root: string; path: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-link-"));
  const dir = join(root, "courses", "CSS-4008", "versions", "2026-FALL");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "assessments.yaml");
  writeFileSync(path, contents, "utf-8");
  return { root, path };
};

test("a run with one Canvas course gets the singular key", () => {
  const { root, path } = workspace();
  const result = writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  assert.equal(result.count, 1);
  const written = readFileSync(path, "utf-8");
  assert.match(written, /canvas_assignment_id: 90218/);
  assert.equal(written.includes("canvas_assignments:"), false);
});

test("every comment in the file survives the write", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  const written = readFileSync(path, "utf-8");
  assert.match(written, /# Every assessment of the run\./);
  assert.match(written, /# The weight is the professor's claim and nobody else's\./);
  assert.match(written, /# 15% because the report carries LO-03 on its own\./);
});

test("an assessment nobody linked is left exactly as it was", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  const written = readFileSync(path, "utf-8");
  const four = written.slice(written.indexOf("ASSESSMENT-04"));
  assert.equal(four.includes("canvas"), false);
});

test("a second subgroup does not erase the first", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218" },
  });
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218", "CS-402": "90219" },
  });
  const written = readFileSync(path, "utf-8");
  assert.match(written, /CS-401: 90218/);
  assert.match(written, /CS-402: 90219/);
});

test("both subgroups in one call land in one map", () => {
  const { root, path } = workspace();
  const result = writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218", "CS-402": "90219" },
  });
  assert.equal(result.count, 1);
  assert.equal(result.written.length, 1);
  const written = readFileSync(path, "utf-8");
  assert.equal((written.match(/canvas_assignments:/g) ?? []).length, 1);
});

test("the id is written as a number, the way a hand-authored record has it", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  // Quoted would still load — `str()` in `lms/index.ts` stringifies either —
  // but it would not match what a professor writes by hand, and a file whose
  // shape depends on who last touched it is a file that diffs badly.
  assert.match(readFileSync(path, "utf-8"), /canvas_assignment_id: 90218\s*$/m);
});

test("an assessment in no file is named, and nothing is written", () => {
  const { root, path } = workspace();
  const before = readFileSync(path, "utf-8");
  assert.throws(
    () =>
      writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-99": "1" }),
    /ASSESSMENT-99/,
  );
  assert.equal(readFileSync(path, "utf-8"), before);
});

test("a multi-document file is refused rather than truncated", () => {
  const { root, path } = workspace(FILE + "\n---\nassessments: []\n");
  const before = readFileSync(path, "utf-8");
  assert.throws(
    () =>
      writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" }),
    /more than one YAML document/,
  );
  assert.equal(readFileSync(path, "utf-8"), before);
});

test("the per-assessment directory layout is found too", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-link-"));
  const dir = join(root, "courses", "CSS-4008", "versions", "2026-FALL", "assessments");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "assessment-02.yaml");
  writeFileSync(
    path,
    "assessment_id: ASSESSMENT-02\ntitle: Data Preparation Report\nmaximum_score: 100\n",
    "utf-8",
  );
  const result = writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  assert.equal(result.count, 1);
  assert.match(readFileSync(path, "utf-8"), /canvas_assignment_id: 90218/);
});

test("CRLF survives, so the next diff is one line and not the file", () => {
  const { root, path } = workspace(FILE.replace(/\n/g, "\r\n"));
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  const written = readFileSync(path, "utf-8");
  assert.equal(written.includes("\r\n"), true);
  assert.equal(/[^\r]\n/.test(written), false);
});

// ------------------------------------------ what only the pane used to have

test("null removes a pairing, and both keys with it", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": null });
  const written = readFileSync(path, "utf-8");
  assert.equal(written.includes("canvas_assignment_id"), false);
  assert.equal(written.includes("canvas_assignments"), false);
  // The rest of the record is untouched — this clears a pointer, not a decision.
  assert.match(written, /weight: 0\.15/);
  assert.match(written, /# 15% because the report carries LO-03 on its own\./);
});

test("a mapping replaces the whole mapping, so a subgroup can be unbound", () => {
  // Wholesale is what makes "I removed CS-402" expressible at all. A merge
  // would leave it there forever.
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218", "CS-402": "90219" },
  });
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218" },
  });
  const written = readFileSync(path, "utf-8");
  assert.match(written, /CS-401: 90218/);
  assert.equal(written.includes("CS-402"), false);
});

test("moving from one Canvas course to several clears the singular key", () => {
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218", "CS-402": "90219" },
  });
  const written = readFileSync(path, "utf-8");
  assert.equal(written.includes("canvas_assignment_id"), false);
  assert.match(written, /canvas_assignments:/);
});

test("and back again clears the mapping", () => {
  // Both directions, because a stale key of either kind is a pairing that
  // still reads as true to `canvasAssignmentFor`.
  const { root, path } = workspace();
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": { "CS-401": "90218" },
  });
  writeAssessmentLinks(root, "CSS-4008", "2026-FALL", { "ASSESSMENT-02": "90218" });
  const written = readFileSync(path, "utf-8");
  assert.equal(written.includes("canvas_assignments"), false);
  assert.match(written, /canvas_assignment_id: 90218/);
});

test("two assessments in one call are one file rewrite", () => {
  const { root, path } = workspace();
  const result = writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {
    "ASSESSMENT-02": "90218",
    "ASSESSMENT-04": "90219",
  });
  assert.equal(result.count, 2);
  assert.equal(result.written.length, 1);
  assert.match(readFileSync(path, "utf-8"), /canvas_assignment_id: 90219/);
});

test("nothing to write is not an error", () => {
  const { root } = workspace();
  assert.deepEqual(writeAssessmentLinks(root, "CSS-4008", "2026-FALL", {}), {
    written: [],
    count: 0,
  });
});
