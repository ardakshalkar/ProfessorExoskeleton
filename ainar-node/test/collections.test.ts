/**
 * The collection registry (src/collections.ts) against what it declares.
 *
 * The tables it replaced each said one thing about a collection, by hand, in a
 * place of its own, and two of them had drifted apart. These hold the one
 * declaration to the models and the vendor schemas it names, so the next drift
 * is a failing test rather than a quiet disagreement.
 */

import { strict as assert } from "node:assert";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AGENT_WRITABLE, ID_FIELDS } from "../src/approval.ts";
import { COLLECTION_SCHEMAS, COLLECTION_NAMES } from "../src/bundle.ts";
import { COLLECTION_SPECS, ENTITY_NAMES } from "../src/collections.ts";
import { COLLECTIONS } from "../src/loader.ts";
import { SCHEMA_MODELS } from "../src/schema.ts";

/** The object a model validates, whatever it is wrapped in. */
const shapeOf = (model: any): Record<string, unknown> => {
  let inner = model;
  for (let i = 0; i < 6 && inner && !inner.shape; i += 1) inner = inner._def?.schema ?? inner._def?.innerType ?? inner._def?.in;
  return (typeof inner?.shape === "function" ? inner.shape() : inner?.shape) ?? {};
};

test("every declared id is a field of its model", () => {
  for (const [name, spec] of Object.entries(COLLECTION_SPECS)) {
    if (spec.id === null) continue;
    assert.ok(spec.id in shapeOf(spec.model), `${name}: ${spec.id} is not a field of its model`);
  }
});

test("only the collections keyed by a pair have no id", () => {
  const without = Object.entries(COLLECTION_SPECS)
    .filter(([, spec]) => spec.id === null)
    .map(([name]) => name)
    .sort();
  assert.deepEqual(without, ["capability_states", "concept_edges", "concept_states"]);
});

test("the derived tables all list the same collections, in the bundle's order", () => {
  assert.deepEqual(Object.keys(COLLECTION_SCHEMAS), COLLECTION_NAMES);
  assert.deepEqual(Object.keys(COLLECTIONS), COLLECTION_NAMES);
  assert.deepEqual(Object.keys(SCHEMA_MODELS).filter((name) => name !== "course"), COLLECTION_NAMES);
  for (const name of Object.keys(ID_FIELDS)) assert.ok(COLLECTION_NAMES.includes(name as never), name);
});

test("what an agent may write is exactly what it was", () => {
  assert.deepEqual(Object.keys(AGENT_WRITABLE), [
    "activities",
    "documents",
    "resources",
    "assessments",
    "items",
    "item_models",
    "submissions",
    "item_responses",
    "evaluations",
    "evidence",
    "concept_states",
    "capability_states",
    "signals",
    "interventions",
    "events",
    "action_items",
  ]);
});

test("every entity name is a vendor schema, but the one the vendor never had", () => {
  const vendor = fileURLToPath(new URL("../../vendor/datalayer/schema/", import.meta.url));
  const files = new Set(readdirSync(vendor).filter((f) => f.endsWith(".schema.json")).map((f) => f.replace(".schema.json", "")));
  const missing = Object.values(ENTITY_NAMES).filter((entity) => !files.has(entity)).sort();
  // The capability states were added to the model after the vendor schemas
  // were last generated (vendor/datalayer/schema/README.md).
  assert.deepEqual(missing, ["student_capability_state"]);
});
