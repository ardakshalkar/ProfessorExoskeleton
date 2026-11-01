/**
 * PRV-1: every kind of record that can be a draft can say where it came from —
 * in the zod model the loader validates against, in the vendored JSON Schemas
 * other readers of a course use, and through the one reader in `approval.ts`.
 *
 *     node --experimental-strip-types --test test/provenance.test.ts
 */

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { APPROVABLE, provenanceOf } from "../src/approval.ts";
import { COLLECTION_SPECS, type CollectionName } from "../src/collections.ts";
import { shapeOf } from "../src/schema.ts";

const VENDOR = resolve(process.cwd(), "..", "vendor", "datalayer", "schema");

/** Where each collection keeps it: on the record, unless named here. */
const ELSEWHERE: Record<string, string> = { evaluations: "ai_suggestion", documents: "generated_by" };

const PROVENANCE = {
  produced_by: "/design-assessment",
  workflow_version: "2026.11.1",
  model_id: "deepseek-chat",
  input_refs: ["LO-03", "EVIDENCE-0042"],
  created_at: "2026-11-01T10:00:00+05:00",
};

test("every collection that can hold a draft has a field for its provenance", () => {
  for (const collection of APPROVABLE) {
    const fields = (shapeOf(collection) ?? []).map((field) => field.name);
    const field = ELSEWHERE[collection] ?? "provenance";
    assert.ok(fields.includes(field), `${collection} has no ${field}`);
  }
});

test("the vendored JSON Schemas say the same as the model", () => {
  const bundle = JSON.parse(readFileSync(resolve(VENDOR, "course-bundle.schema.json"), "utf-8"));
  for (const collection of APPROVABLE) {
    const field = ELSEWHERE[collection] ?? "provenance";
    const name = (bundle.properties[collection].items.$ref as string).split("/").pop()!;
    assert.ok(bundle.$defs[name].properties[field], `course-bundle.schema.json's ${name} has no ${field}`);
    // Not every entity has a file of its own: capability states never had one.
    const file = resolve(VENDOR, `${COLLECTION_SPECS[collection as CollectionName].entity}.schema.json`);
    if (!existsSync(file)) continue;
    assert.ok(JSON.parse(readFileSync(file, "utf-8")).properties[field], `${file} has no ${field}`);
  }
});

test("an assessment written with provenance loads with it", () => {
  const parsed = COLLECTION_SPECS.assessments.model.parse({
    assessment_id: "ASSESSMENT-09",
    approval: "draft",
    course_version_id: "CSS-4008-2026-FALL",
    title: "Midterm",
    type: "exam",
    provenance: PROVENANCE,
  }) as any;
  assert.equal(parsed.provenance.produced_by, "/design-assessment");
  assert.deepEqual(parsed.provenance.input_refs, ["LO-03", "EVIDENCE-0042"]);
});

test("provenance names who produced it; an anonymous block is refused", () => {
  assert.throws(() =>
    COLLECTION_SPECS.activities.model.parse({
      activity_id: "ACT-1",
      course_version_id: "CSS-4008-2026-FALL",
      type: "lecture",
      title: "Week 1",
      provenance: { model_id: "deepseek-chat" },
    }),
  );
});

test("provenanceOf reads all three spellings, and null where nothing was said", () => {
  assert.equal(provenanceOf("assessments", { provenance: PROVENANCE }), PROVENANCE);
  assert.equal(provenanceOf("evaluations", { ai_suggestion: { provenance: PROVENANCE } }), PROVENANCE);
  assert.equal(provenanceOf("documents", { generated_by: PROVENANCE }), PROVENANCE);
  assert.equal(provenanceOf("assessments", { title: "typed by hand" }), null);
  assert.equal(provenanceOf("evaluations", { ai_suggestion: null }), null);
});
