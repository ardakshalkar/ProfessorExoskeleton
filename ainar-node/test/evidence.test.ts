import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EVIDENCE_WORKFLOW,
  evidenceFromEvaluations,
  evidenceFromItemResponses,
  extractEvidence,
} from "../src/evidence.ts";

/**
 * These build bundle literals rather than loading fixtures, for the reason
 * `roll-up.test.ts` gives: every assertion is a claim about what
 * `ainar/evidence.py` does with the same records, and a reader has to be able to
 * check the claim against that file without loading anything.
 *
 * `criterionById` reads criteria out of `rubrics`, not off a top-level
 * collection, so a criterion has to be nested in a rubric to be found at all.
 */
const bundle = (over: Record<string, unknown> = {}) =>
  ({
    course: { course_id: "C" },
    outcomes: [],
    concepts: [],
    capabilities: [],
    rubrics: [],
    items: [],
    assessments: [],
    submissions: [],
    item_responses: [],
    evaluations: [],
    evidence: [],
    ...over,
  }) as never;

const rubricWith = (criterion: Record<string, unknown>) => ({
  rubric_id: "RUB-1",
  criteria: [
    {
      criterion_id: "CRIT-1",
      maximum_score: 10,
      outcome_id: "OUT-1",
      capability_id: null,
      levels: [{ score: 0 }, { score: 5 }, { score: 8 }],
      ...criterion,
    },
  ],
});

const assessment = { assessment_id: "ASSESS-1", course_version_id: "C-2026-FALL" };
const submission = {
  submission_id: "SUB-1",
  student_id: "STU-1",
  assessment_id: "ASSESS-1",
};
const evaluation = (over: Record<string, unknown> = {}) => ({
  evaluation_id: "EVAL-1",
  submission_id: "SUB-1",
  criterion_id: "CRIT-1",
  status: "approved",
  professor_decision: { score: 8, decided_by: "USER-1", decided_at: "2026-09-01T10:00:00+06:00" },
  ...over,
});

const fromEvaluation = (over: Record<string, unknown> = {}, criterion = {}) =>
  evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith(criterion)],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation(over)],
      ...(over["bundle"] as object),
    }),
    "C-2026-FALL",
  );

// ── evidence from evaluations ───────────────────────────────────────────────

test("an approved decision naming an outcome becomes one evidence record", () => {
  const produced = fromEvaluation();
  assert.equal(produced.length, 1);
  const record = produced[0]!;
  assert.equal(record.evidence_id, "EVID-1", "EVAL- becomes EVID-");
  assert.equal(record.student_id, "STU-1");
  assert.equal(record.source_type, "assessment");
  assert.equal(record.source_id, "SUB-1");
  assert.equal(record.outcome_id, "OUT-1");
  assert.equal(record.verified_by, "USER-1");
  assert.equal(record.recorded_at, "2026-09-01T10:00:00+06:00");
});

test("only the first EVAL- is rewritten", () => {
  // Python's `replace(old, new, 1)` is bounded. An id that contains the token
  // twice must keep the second one.
  const produced = fromEvaluation({ evaluation_id: "EVAL-1-EVAL-2" });
  assert.equal(produced[0]!.evidence_id, "EVID-1-EVAL-2");
});

test("a status that is neither approved nor overridden produces nothing", () => {
  for (const status of ["draft", "pending", "rejected"]) {
    assert.deepEqual(fromEvaluation({ status }), [], status);
  }
  assert.equal(fromEvaluation({ status: "overridden" }).length, 1, "overridden counts");
});

test("an evaluation with no professor decision produces nothing", () => {
  assert.deepEqual(fromEvaluation({ professor_decision: null }), []);
});

test("a criterion naming neither outcome nor capability produces nothing", () => {
  // "marks but no evidence", made concrete.
  assert.deepEqual(fromEvaluation({}, { outcome_id: null, capability_id: null }), []);
});

test("a criterion naming only a capability still produces evidence", () => {
  const produced = fromEvaluation({}, { outcome_id: null, capability_id: "CAP-1" });
  assert.equal(produced.length, 1);
  assert.equal(produced[0]!.capability_id, "CAP-1");
  assert.ok(!("outcome_id" in produced[0]!), "an absent outcome is omitted, not null");
});

test("the band is the highest level the score reaches, counting from 1", () => {
  const level = (score: number) => fromEvaluation({ professor_decision: { score } })[0]!.demonstrated_level;
  assert.equal(level(0), 1, "the bottom band, not zero");
  assert.equal(level(4), 1);
  assert.equal(level(5), 2, "exactly on a threshold reaches it");
  assert.equal(level(7), 2);
  assert.equal(level(8), 3);
  assert.equal(level(10), 3, "above every threshold is the top band, not the bottom");
});

test("a criterion with no levels asserts no band", () => {
  const produced = fromEvaluation({}, { levels: [] });
  assert.ok(!("demonstrated_level" in produced[0]!), "no levels means the field is absent");
});

test("levels are banded by score order, not by the order they were written", () => {
  const produced = fromEvaluation(
    { professor_decision: { score: 5 } },
    { levels: [{ score: 8 }, { score: 0 }, { score: 5 }] },
  );
  assert.equal(produced[0]!.demonstrated_level, 2);
});

test("proportion uses banker's rounding, as Python's round does", () => {
  // 0.0625 at three decimals: the digit dropped is exactly a half, and the one
  // before it is even, so half-even keeps it. Math.round would give 0.063.
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({ maximum_score: 800 })],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation({ professor_decision: { score: 50 } })],
    }),
    "C-2026-FALL",
  );
  assert.equal((produced[0]!.extensions as { proportion: number }).proportion, 0.062);
});

test("an evaluation for another run is ignored", () => {
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [{ ...assessment, course_version_id: "C-2025-FALL" }],
      submissions: [submission],
      evaluations: [evaluation()],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, []);
});

test("an evaluation whose submission or criterion is missing is skipped", () => {
  const noSubmission = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [],
      evaluations: [evaluation()],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(noSubmission, []);

  const noCriterion = evidenceFromEvaluations(
    bundle({
      rubrics: [],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(noCriterion, []);
});

test("provenance names the workflow and all three inputs", () => {
  const produced = fromEvaluation();
  assert.deepEqual(produced[0]!.provenance, {
    produced_by: "evidence-extractor",
    workflow_version: EVIDENCE_WORKFLOW,
    input_refs: ["EVAL-1", "CRIT-1", "SUB-1"],
    created_at: "2026-09-01T10:00:00+06:00",
  });
});

// ── the duplicate check ─────────────────────────────────────────────────────

test("evidence already recorded under our own id is not derived twice", () => {
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
      evidence: [{ evidence_id: "EVID-1", student_id: "OTHER", source_id: "OTHER" }],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, []);
});

test("evidence a person recorded by hand for the same target is not duplicated", () => {
  // The professor used their own id, so only the target tuple can catch it.
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
      evidence: [
        {
          evidence_id: "EVID-HAND-WRITTEN",
          student_id: "STU-1",
          source_id: "SUB-1",
          outcome_id: "OUT-1",
          capability_id: null,
          concept_id: null,
        },
      ],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, []);
});

test("an absent id and a null id are the same absence", () => {
  // The parity hazard this port had to handle: Python compares None to None and
  // matches. Here the existing record simply OMITS capability_id and concept_id
  // where the candidate has them as null, so a strict === would miss the
  // duplicate and re-derive a record the professor already has.
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
      evidence: [
        { evidence_id: "EVID-OTHER", student_id: "STU-1", source_id: "SUB-1", outcome_id: "OUT-1" },
      ],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(produced, [], "undefined and null must compare equal here");
});

test("evidence for a different target from the same source is still derived", () => {
  const produced = evidenceFromEvaluations(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
      evidence: [
        {
          evidence_id: "EVID-OTHER",
          student_id: "STU-1",
          source_id: "SUB-1",
          outcome_id: "OUT-DIFFERENT",
        },
      ],
    }),
    "C-2026-FALL",
  );
  assert.equal(produced.length, 1, "a different outcome is a different fact");
});

// ── evidence from item responses ────────────────────────────────────────────

const item = (over: Record<string, unknown> = {}) => ({
  item_id: "ITEM-1",
  assessment_id: "ASSESS-1",
  maximum_score: 4,
  role: "main",
  concepts: ["CON-1"],
  outcome_id: "OUT-1",
  options: [],
  ...over,
});

const response = (over: Record<string, unknown> = {}) => ({
  response_id: "RESP-1",
  submission_id: "SUB-1",
  student_id: "STU-1",
  item_id: "ITEM-1",
  score: 3,
  correct: true,
  chosen_options: [],
  scored_by: "USER-1",
  responded_at: "2026-09-02T09:00:00+06:00",
  ...over,
});

const fromResponse = (responseOver = {}, itemOver = {}) =>
  evidenceFromItemResponses(
    bundle({
      assessments: [assessment],
      submissions: [submission],
      items: [item(itemOver)],
      item_responses: [response(responseOver)],
    }),
    "C-2026-FALL",
  );

test("a scored item response becomes concept-level evidence with no level asserted", () => {
  const produced = fromResponse();
  assert.equal(produced.length, 1);
  const record = produced[0]!;
  assert.equal(record.evidence_id, "EVID-1-1", "RESP- stripped, concept index appended");
  assert.equal(record.source_type, "assessment_item");
  assert.equal(record.concept_id, "CON-1");
  assert.equal(
    record.demonstrated_level,
    undefined,
    "one question is weak evidence: no level is claimed at all",
  );
});

test("one record per concept the item names, numbered from 1", () => {
  const produced = fromResponse({}, { concepts: ["CON-1", "CON-2", "CON-3"] });
  assert.deepEqual(
    produced.map((record) => [record.evidence_id, record.concept_id]),
    [
      ["EVID-1-1", "CON-1"],
      ["EVID-1-2", "CON-2"],
      ["EVID-1-3", "CON-3"],
    ],
  );
});

test("an unscored response produces nothing", () => {
  assert.deepEqual(fromResponse({ score: null }), []);
});

test("an item naming no concept produces nothing", () => {
  assert.deepEqual(fromResponse({}, { concepts: [] }), []);
});

test("a preparation item produces nothing", () => {
  // Asked before the work to find out whether the class is ready. A wrong answer
  // is an expected, useful result — not a failure to demonstrate a concept.
  assert.deepEqual(fromResponse({}, { role: "preparation" }), []);
});

test("an unmarked item produces nothing, because there is no proportion", () => {
  assert.deepEqual(fromResponse({}, { maximum_score: 0 }), []);
});

test("only a person verifies: an auto-scorer does not", () => {
  assert.equal(fromResponse({ scored_by: "USER-7" })[0]!.verified_by, "USER-7");
  assert.ok(!("verified_by" in fromResponse({ scored_by: "AUTO-SCORER" })[0]!));
  assert.ok(!("verified_by" in fromResponse({ scored_by: null })[0]!));
});

test("misconceptions come from the options the student actually chose", () => {
  const produced = fromResponse(
    { chosen_options: ["B", "C"] },
    {
      options: [
        { label: "A", indicates_misconception_of: "CON-A" },
        { label: "B", indicates_misconception_of: "CON-B" },
        { label: "C", indicates_misconception_of: null },
        { label: "D", indicates_misconception_of: "CON-D" },
      ],
    },
  );
  const extensions = produced[0]!.extensions as { misconceptions: string[] };
  assert.deepEqual(
    extensions.misconceptions,
    ["CON-B"],
    "A and D were not chosen; C was chosen but indicates nothing",
  );
});

test("proportion of an item response is rounded to three places", () => {
  const extensions = fromResponse({ score: 1 }, { maximum_score: 3 })[0]!.extensions as {
    proportion: number;
  };
  assert.equal(extensions.proportion, 0.333);
});

// ── both together ──────────────────────────────────────────────────────────

test("a derived record carries no nulls at all", () => {
  // The ground truth this is held to: `records/evidence.yaml` in a real course,
  // written by `ainar approve`, contains zero nulls. Python drops them with
  // `model_dump(exclude_none=True)`; the Node write path has no such step, so
  // the record has to arrive without them. A `confidence: null` here would
  // differ from Python on every record while validating perfectly.
  const records = extractEvidence(
    bundle({
      rubrics: [rubricWith({ capability_id: null, levels: [] })],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation({ professor_decision: { score: 8 } })],
      items: [item({ outcome_id: null })],
      item_responses: [response({ scored_by: "AUTO", responded_at: null })],
    }),
    "C-2026-FALL",
  );
  assert.ok(records.length >= 2, "both branches produced something to check");
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      // `extensions` is a free-form dict: `exclude_none` does not reach inside
      // one, so a null in there is faithful and is not checked.
      if (key === "extensions") continue;
      assert.notEqual(value, null, `${record.evidence_id}.${key} should be absent, not null`);
    }
    for (const [key, value] of Object.entries(record.provenance as object)) {
      assert.notEqual(value, null, `${record.evidence_id}.provenance.${key}`);
    }
  }
});

test("an empty misconceptions list is written as a list, not dropped", () => {
  // It is a list rather than None, so `exclude_none` keeps it — and the real
  // record file has `misconceptions: []` on entries with none.
  const extensions = fromResponse()[0]!.extensions as { misconceptions: string[] };
  assert.deepEqual(extensions.misconceptions, []);
});

test("extract runs evaluations first, then item responses", () => {
  const produced = extractEvidence(
    bundle({
      rubrics: [rubricWith({})],
      assessments: [assessment],
      submissions: [submission],
      evaluations: [evaluation()],
      items: [item()],
      item_responses: [response()],
    }),
    "C-2026-FALL",
  );
  assert.deepEqual(
    produced.map((record) => record.source_type),
    ["assessment", "assessment_item"],
    "the order is the order records are written, and fixtures compare trees",
  );
});
