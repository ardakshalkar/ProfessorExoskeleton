/**
 * What a change to a topic or a piece of graded work leaves behind: the ids
 * are followed and nothing else, so the sample's own references are the
 * answer, and an id from another course is not an item of this run.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { describeRecordImpact, recordImpact } from "../src/record-impact.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const bundle = new Workspace(SAMPLE).findRun(RUN);

test("a topic: its concepts, outcomes, meetings, materials and graded work", () => {
  const found = recordImpact(bundle, RUN, "module", "MODULE-06")!;
  assert.equal(found.title, "Model Evaluation and Overfitting");
  const kinds = found.groups.map((g) => g.kind);
  assert.deepEqual(kinds.slice(0, 3), ["concepts", "outcomes", "meetings"]);
  const ids = (kind: string) => found.groups.find((g) => g.kind === kind)!.entries.map((e) => e.id);
  assert.deepEqual(ids("concepts"), ["CONCEPT-MODEL-EVALUATION", "CONCEPT-OVERFITTING"]);
  assert.deepEqual(ids("outcomes"), ["LO-02", "LO-04"]);
  assert.equal(ids("meetings").length, 2);
  assert.ok(kinds.includes("assessments"));
  assert.ok(describeRecordImpact(found).some((line) => line.includes("CONCEPT-OVERFITTING")));
});

test("graded work: the topic it belongs to", () => {
  const work = bundle.assessments.find((a: any) => a.module_id === "MODULE-06" && a.course_version_id === RUN) as any;
  const found = recordImpact(bundle, RUN, "assessment", work.assessment_id)!;
  assert.equal(found.groups[0]!.kind, "topic");
  assert.equal(found.groups[0]!.entries[0]!.id, "MODULE-06");
});

test("an id that is not this run's is no item", () => {
  assert.equal(recordImpact(bundle, RUN, "module", "MODULE-NOPE"), null);
  assert.equal(recordImpact(bundle, RUN, "assessment", "ASSESSMENT-NOPE"), null);
  assert.equal(recordImpact(bundle, "NO-RUN", "module", "MODULE-06"), null);
});
