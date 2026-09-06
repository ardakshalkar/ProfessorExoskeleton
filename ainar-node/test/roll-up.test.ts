import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ROLL_UP_WORKFLOW, rollUpCapabilities } from "../src/progress.ts";

/**
 * `rollUpCapabilities` reads three collections off the bundle — `evidence`,
 * `capability_states` — and nothing else, so a literal is a complete input.
 * Constructing one keeps each test's premise on screen, which matters more here
 * than in most tests: every assertion below is a claim about what Python's
 * `roll_up_capabilities` does with the same records, and a reader has to be able
 * to check the claim against `ainar/progress.py` without loading a fixture.
 */
const bundleWith = (evidence: unknown[], capabilityStates: unknown[] = []) =>
  ({ evidence, capability_states: capabilityStates }) as never;

const evidence = (over: Record<string, unknown> = {}) => ({
  evidence_id: "EV-1",
  student_id: "STU-1",
  course_version_id: "C-2026-FALL",
  source_type: "evaluation",
  source_id: "EVAL-1",
  capability_id: "CAP-1",
  demonstrated_level: 2,
  recorded_at: "2026-09-01T10:00:00+06:00",
  ...over,
});

test("the level claimed is the highest demonstrated, not the latest", () => {
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-1", demonstrated_level: 3 }),
      evidence({ evidence_id: "EV-2", demonstrated_level: 1, source_id: "EVAL-2" }),
    ]),
    "C-2026-FALL",
  );
  assert.equal(produced.length, 1);
  assert.equal(produced[0]!.level, 3);
});

test("source_count counts distinct sources, not records", () => {
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-1", source_id: "EVAL-1" }),
      evidence({ evidence_id: "EV-2", source_id: "EVAL-1" }),
      evidence({ evidence_id: "EV-3", source_id: "EVAL-2" }),
    ]),
    "C-2026-FALL",
  );
  assert.equal(produced[0]!.source_count, 2, "two sources behind three records");
  assert.deepEqual(produced[0]!.evidence_ids, ["EV-1", "EV-2", "EV-3"]);
});

test("evidence naming no capability is ignored", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence({ capability_id: null, outcome_id: "OUT-1" })]),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, []);
});

test("evidence from another run is ignored", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence({ course_version_id: "C-2025-FALL" })]),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, []);
});

test("a capability that already has a state is left alone", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence()], [{ student_id: "STU-1", capability_id: "CAP-1" }]),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, [], "this derives what is missing; it does not overwrite");
});

test("one state per (student, capability) pair, ordered by the pair", () => {
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-3", student_id: "STU-2", capability_id: "CAP-1" }),
      evidence({ evidence_id: "EV-1", student_id: "STU-1", capability_id: "CAP-2" }),
      evidence({ evidence_id: "EV-2", student_id: "STU-1", capability_id: "CAP-1" }),
    ]),
    "C-2026-FALL",
  );
  assert.deepEqual(
    produced.map((state) => [state.student_id, state.capability_id]),
    [
      ["STU-1", "CAP-1"],
      ["STU-1", "CAP-2"],
      ["STU-2", "CAP-1"],
    ],
    "sorted, because the order is part of what a parity fixture compares",
  );
});

test("last_updated_at is the latest INSTANT, not the largest string", () => {
  // The regression this exists for. Both stamps are the same day, and as text
  // "2026-09-01T09:00:00+06:00" sorts after "2026-09-01T04:00:00Z" — while
  // being three hours EARLIER as an instant (03:00Z against 04:00Z). Python
  // compares aware datetimes, so it picks the Z one; a lexicographic max here
  // would not, and the disagreement would be invisible in any fixture whose
  // records all share one offset.
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-1", recorded_at: "2026-09-01T09:00:00+06:00" }),
      evidence({ evidence_id: "EV-2", source_id: "EVAL-2", recorded_at: "2026-09-01T04:00:00Z" }),
    ]),
    "C-2026-FALL",
  );
  assert.equal(produced[0]!.last_updated_at, "2026-09-01T04:00:00Z");
});

test("the recorded stamp is preserved verbatim, offset included", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence({ recorded_at: "2026-09-01T10:00:00+06:00" })]),
    "C-2026-FALL",
  );
  assert.equal(
    produced[0]!.last_updated_at,
    "2026-09-01T10:00:00+06:00",
    "re-serialising would rewrite the professor's offset for no reason",
  );
});

test("with no recorded_at anywhere, `now` stands in", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence({ recorded_at: null })]),
    "C-2026-FALL",
    "2026-09-04T12:00:00+06:00",
  );
  assert.equal(produced[0]!.last_updated_at, "2026-09-04T12:00:00+06:00");
});

test("provenance names the workflow and every input", () => {
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-2" }),
      evidence({ evidence_id: "EV-1", source_id: "EVAL-2" }),
    ]),
    "C-2026-FALL",
    "2026-09-04T12:00:00+06:00",
  );
  assert.deepEqual(produced[0]!.provenance, {
    produced_by: "capability-roll-up",
    workflow_version: ROLL_UP_WORKFLOW,
    input_refs: ["EV-1", "EV-2"],
    created_at: "2026-09-04T12:00:00+06:00",
  });
});

test("extensions record what was seen, deduplicated and sorted numerically", () => {
  const produced = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-1", demonstrated_level: 10 }),
      evidence({ evidence_id: "EV-2", demonstrated_level: 2, source_id: "EVAL-2" }),
      evidence({ evidence_id: "EV-3", demonstrated_level: 2, source_id: "EVAL-3" }),
    ]),
    "C-2026-FALL",
  );
  // Numeric, not lexicographic: [2, 10], never [10, 2].
  assert.deepEqual(produced[0]!.extensions, {
    levels_seen: [2, 10],
    sources: ["EVAL-1", "EVAL-2", "EVAL-3"],
  });
});

test("evidence with no level at all claims no level", () => {
  const produced = rollUpCapabilities(
    bundleWith([evidence({ demonstrated_level: null })]),
    "C-2026-FALL",
  );
  assert.equal(produced[0]!.level, null);
  assert.deepEqual((produced[0]!.extensions as { levels_seen: number[] }).levels_seen, []);
});

test("verified_by takes the first verifier present, and is null with none", () => {
  const withVerifier = rollUpCapabilities(
    bundleWith([
      evidence({ evidence_id: "EV-1", verified_by: null }),
      evidence({ evidence_id: "EV-2", source_id: "EVAL-2", verified_by: "USER-1" }),
    ]),
    "C-2026-FALL",
  );
  assert.equal(withVerifier[0]!.verified_by, "USER-1");

  const without = rollUpCapabilities(bundleWith([evidence()]), "C-2026-FALL");
  assert.equal(without[0]!.verified_by, null);
});
