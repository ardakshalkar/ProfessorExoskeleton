/**
 * The range a student's course can still land in, and the one table of
 * assessment kinds — both moved out of the pane so a screen cannot do its own
 * arithmetic over grades (BACKLOG MOD-3).
 *
 *     node --experimental-strip-types --test test/final-range.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ASSESSMENT_KINDS, assessmentKind } from "../src/assessment-kinds.ts";
import { finalRange, gradebookPayload } from "../src/gradebook.ts";
import { AssessmentType } from "../src/model/common.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const sample = new Workspace(ROOT, "flag").findRun(RUN);

const close = (a: number | null, b: number, why: string) => {
  assert.ok(a !== null && Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
};

test("the range is the payload's own totals over the course weight", () => {
  const book: any = gradebookPayload(sample, RUN, {});
  const courseWeight = book.assessments
    .filter((a: any) => typeof a.weight === "number" && a.weight > 0)
    .reduce((sum: number, a: any) => sum + a.weight, 0);
  assert.ok(courseWeight > 0, "the sample carries weights");
  assert.ok(book.totals.length > 0, "the sample has students to total");
  for (const row of book.totals) {
    const range = finalRange(book, row.student_id);
    close(range.floor, (row.earned_weighted / courseWeight) * 100, "floor");
    close(range.ceiling, ((row.earned_weighted + courseWeight - row.weight_graded) / courseWeight) * 100, "ceiling");
    close(range.open, ((courseWeight - row.weight_graded) / courseWeight) * 100, "open");
    if (row.weight_graded) close(range.share, row.earned_weighted / row.weight_graded, "share");
    else assert.equal(range.share, null);
    assert.ok(range.floor! <= range.ceiling!, "floor never above ceiling");
  }
});

test("hand-built: half graded at 80% leaves 40 – 90", () => {
  const book = {
    assessments: [{ weight: 0.5 }, { weight: 0.5 }, { weight: 0 }, { weight: null }],
    totals: [{ student_id: "S1", earned_weighted: 0.4, weight_graded: 0.5 }],
  };
  const range = finalRange(book, "S1");
  close(range.floor, 40, "floor");
  close(range.ceiling, 90, "ceiling");
  close(range.open, 50, "open");
  close(range.share, 0.8, "share");
});

test("a student the gradebook did not total is all open, not all failed", () => {
  const range = finalRange({ assessments: [{ weight: 1 }], totals: [] }, "NOBODY");
  assert.deepEqual(range, { floor: 0, ceiling: 100, open: 100, share: null });
});

test("nothing weighted is no range at all", () => {
  const range = finalRange({ assessments: [{ weight: null }], totals: [] }, "S1");
  assert.deepEqual(range, { floor: null, ceiling: null, open: null, share: null });
});

test("every assessment type the model allows has exactly one kind", () => {
  const types = ASSESSMENT_KINDS.map((kind) => kind.type);
  assert.deepEqual([...types].sort(), [...AssessmentType.options].sort());
  assert.equal(new Set(types).size, types.length);
});

test("an unknown type falls back to its own name, an absent one to Other", () => {
  assert.equal(assessmentKind("quiz").many, "Quizzes");
  assert.equal(assessmentKind("seminar").one, "seminar");
  assert.equal(assessmentKind(null).one, "Other");
});
