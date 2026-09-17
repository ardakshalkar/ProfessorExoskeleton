/**
 * The two things `workspace/golden/validator/` structurally cannot check.
 *
 * The corpus is the real oracle for the validator: 98 mutations, each breaking
 * the example course one way, each recording what `validate.py` said. It covers
 * every one of the 94 codes but two properties of the port itself, and both are
 * here because a check nobody has seen fire is a check that does not work.
 *
 * 1. **`document.missing_file` needs a filesystem.** The corpus validates an
 *    in-memory bundle with no `root`, so the file-existence branch is never
 *    entered there. Python has the same shape — `validate(bundle)` without a root
 *    skips it — which is why it has to be exercised somewhere else rather than
 *    quietly counted as covered.
 * 2. **The code list must equal what `validate.py` can emit.** `TOTAL_CODES` is a
 *    number shown to a professor as "94 of 94 checks", and a claim like that has
 *    to be checked against the other implementation, not maintained by hand.
 *    `tests/test_validate.py` does that from the Python side; this asserts the
 *    list here is sorted and free of duplicates, which is what makes the count
 *    mean what it says.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { IMPLEMENTED, TOTAL_CODES, coverage, validate } from "../src/validate.ts";
import type { CourseBundle } from "../src/bundle.ts";

/** A bundle holding one document and nothing else. */
const withDocument = (storageKey: string): CourseBundle =>
  ({
    course: { course_id: "CSS-4008" },
    outcomes: [],
    concepts: [],
    concept_edges: [],
    capabilities: [],
    modules: [],
    users: [],
    versions: [],
    enrollments: [],
    activities: [],
    documents: [
      { document_id: "DOC-1", storage_key: storageKey, concepts: [] },
    ],
    resources: [],
    assessments: [],
    rubrics: [],
    items: [],
    item_models: [],
    submissions: [],
    item_responses: [],
    evaluations: [],
    evidence: [],
    concept_states: [],
    capability_states: [],
    signals: [],
    interventions: [],
    events: [],
    action_items: [],
  }) as unknown as CourseBundle;

const codesOf = (bundle: CourseBundle, root?: string): string[] =>
  validate(bundle, { root }).items.map((issue) => issue.code);

test("a storage_key pointing at nothing is an error when a root is given", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-validate-"));
  const codes = codesOf(withDocument("materials/missing.md"), root);
  assert.ok(codes.includes("document.missing_file"), codes.join(", "));
});

test("a storage_key pointing at a real file is not", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-validate-"));
  mkdirSync(join(root, "materials"));
  writeFileSync(join(root, "materials", "present.md"), "# slides\n");
  const codes = codesOf(withDocument("materials/present.md"), root);
  assert.ok(!codes.includes("document.missing_file"), codes.join(", "));
});

test("without a root the file check is skipped rather than guessed at", () => {
  // The corpus relies on this: it validates in memory and must not see the code.
  const codes = codesOf(withDocument("materials/missing.md"));
  assert.ok(!codes.includes("document.missing_file"), codes.join(", "));
});

test("an object:// key is not a path in this repository", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-validate-"));
  const codes = codesOf(withDocument("object://bucket/slides.md"), root);
  assert.ok(!codes.includes("document.missing_file"), codes.join(", "));
});

test("a directory at the storage key is not a file", () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-validate-"));
  mkdirSync(join(root, "materials"));
  const codes = codesOf(withDocument("materials"), root);
  assert.ok(codes.includes("document.missing_file"), codes.join(", "));
});

test("the code list is sorted, unique, and the length TOTAL_CODES claims", () => {
  assert.deepEqual([...IMPLEMENTED].sort(), [...IMPLEMENTED], "IMPLEMENTED is not sorted");
  assert.equal(new Set(IMPLEMENTED).size, IMPLEMENTED.length, "IMPLEMENTED repeats a code");
  assert.equal(IMPLEMENTED.length, TOTAL_CODES);
});

test("coverage says the set is complete only when it is", () => {
  const reported = coverage();
  assert.equal(reported.implemented, reported.total);
  assert.match(reported.note, /94 of 94 checks, the complete set/);
});
