/**
 * Deriving learning evidence from approved results.
 * Ported from `ainar/evidence.py`.
 *
 * This is deliberately mechanical. Given a professor's decision on a criterion
 * that names an outcome, the fact that the student demonstrated that outcome at
 * that level is arithmetic, not judgement — so it is a command, not an agent.
 * An LLM in this path could only introduce error.
 *
 * What is *not* mechanical stays out: reading a submission and concluding a
 * student understands something the rubric never asked about is an inference,
 * and belongs to an agent whose output goes through approval like everything
 * else.
 *
 * Three things in here are parity hazards rather than translations, and each is
 * commented where it happens: Python's `round` is banker's rounding, Python's
 * `None` equality is not JavaScript's `undefined` equality, and Python's
 * `str.replace(old, new, 1)` is bounded where a JavaScript regex replace would
 * not be.
 */

import { assessmentById, criterionById, itemById, type CourseBundle } from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";

export const EVIDENCE_WORKFLOW = "evidence/extract-1";

/**
 * Which rubric band a score falls in, counting from 1 at the bottom.
 *
 * The loop keeps the LAST band whose threshold the score reaches rather than
 * breaking at the first — which is what makes a score above every threshold
 * land in the top band rather than the bottom one.
 */
const band = (criterion: any, score: number): number | null => {
  const levels = (criterion.levels ?? []) as { score: number }[];
  if (levels.length === 0) return null;
  const ascending = [...levels].sort((a, b) => a.score - b.score);
  let found: number | null = null;
  ascending.forEach((level, index) => {
    if (score >= level.score) found = index + 1;
  });
  return found;
};

/**
 * The target tuple, with every absent id spelled the same way.
 *
 * The parity hazard: Python compares `None == None` and gets `True`, so an
 * existing record with no `concept_id` matches a candidate with no `concept_id`.
 * In TypeScript those two fields may be `null` on one record and `undefined` on
 * the other — `nullish()` in the schema permits both, and which one appears
 * depends on whether the key was absent from the YAML or present and empty.
 * `undefined === null` is `false`, so without this normalisation the duplicate
 * check would quietly stop recognising duplicates and `extract-evidence` would
 * re-derive records a person already has.
 */
/**
 * A record with its absent fields OMITTED rather than set to null.
 *
 * This is `model_dump(mode="json", exclude_none=True)`, which is how
 * `ainar/approve.py` serialises every record it writes — and it has to be done
 * here, at construction, because the Node write path has no equivalent step.
 * `tidy()` in `approve.ts` drops only empty `extensions` and reorders; the YAML
 * emitter then writes ` null` for anything still holding one.
 *
 * The ground truth is a written record: `records/evidence.yaml` in a real course
 * has zero nulls in it, and `demonstrated_level`, `confidence` and `verified_by`
 * are simply absent from the entries that have none. A port that wrote
 * `confidence: null` there would produce a file that differs from Python's on
 * every single record while validating perfectly and looking almost right.
 *
 * Key order is preserved, because the emitter writes keys in insertion order and
 * the parity fixtures compare the written bytes.
 *
 * Applied to the record and to `provenance` — both are models, and pydantic's
 * `exclude_none` recurses into nested models. It is deliberately NOT applied to
 * `extensions`, which is a free-form dict: `exclude_none` does not reach inside
 * one, so a `correct: None` in there does reach the file as null, and an empty
 * `misconceptions: []` stays an empty list rather than vanishing.
 */
const compact = <T extends Record<string, unknown>>(record: T): T => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  return out as T;
};

const targetKey = (record: any): string =>
  JSON.stringify([
    record.student_id ?? null,
    record.source_id ?? null,
    record.outcome_id ?? null,
    record.capability_id ?? null,
    record.concept_id ?? null,
  ]);

/**
 * Evidence a person already recorded for the same thing.
 *
 * Two ways to already exist: the same `evidence_id`, or the same target tuple
 * from the same source. The second is the one that matters — a professor who
 * recorded the evidence by hand used their own id, and re-deriving it under
 * ours would leave the course holding the same fact twice.
 *
 * Built once per extraction rather than scanned per candidate: Python's
 * `_already_recorded` walks `bundle.evidence` for every candidate, which is the
 * same answer at O(n·m). The sets are the same comparison, done once.
 */
const recordedAlready = (b: CourseBundle) => {
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const existing of b.evidence as any[]) {
    ids.add(existing.evidence_id);
    targets.add(targetKey(existing));
  }
  return (candidate: any): boolean =>
    ids.has(candidate.evidence_id) || targets.has(targetKey(candidate));
};

/**
 * One evidence record per approved criterion decision that names a target.
 *
 * A criterion with no `outcome_id` and no `capability_id` produces nothing here
 * — which is the "marks but no evidence" warning made concrete.
 */
export const evidenceFromEvaluations = (
  b: CourseBundle,
  courseVersionId: string,
): Record<string, unknown>[] => {
  const criteria = criterionById(b);
  const assessments = assessmentById(b);
  const submissions = new Map(
    (b.submissions as any[]).map((submission) => [submission.submission_id, submission]),
  );
  const already = recordedAlready(b);
  const produced: Record<string, unknown>[] = [];

  for (const evaluation of b.evaluations as any[]) {
    const decision = evaluation.professor_decision;
    if (decision === null || decision === undefined) continue;
    if (!["approved", "overridden"].includes(evaluation.status)) continue;

    const submission = submissions.get(evaluation.submission_id);
    const criterion = criteria.get(evaluation.criterion_id);
    if (submission === undefined || criterion === undefined) continue;

    const assessment = assessments.get(submission.assessment_id);
    if (assessment === undefined || assessment.course_version_id !== courseVersionId) continue;
    if (
      (criterion.outcome_id ?? null) === null &&
      (criterion.capability_id ?? null) === null
    ) {
      continue;
    }

    const candidate = compact({
      // Bounded replacement, like Python's `replace(old, new, 1)`. A string
      // first argument replaces only the first occurrence in JavaScript too;
      // a regex would need /g withheld and is easy to get wrong later.
      evidence_id: String(evaluation.evaluation_id).replace("EVAL-", "EVID-"),
      student_id: submission.student_id,
      course_version_id: courseVersionId,
      source_type: "assessment",
      source_id: submission.submission_id,
      outcome_id: criterion.outcome_id,
      capability_id: criterion.capability_id,
      demonstrated_level: band(criterion, decision.score),
      verified_by: decision.decided_by,
      recorded_at: decision.decided_at,
      provenance: compact({
        produced_by: "evidence-extractor",
        workflow_version: EVIDENCE_WORKFLOW,
        input_refs: [evaluation.evaluation_id, evaluation.criterion_id, submission.submission_id],
        created_at: decision.decided_at,
      }),
      extensions: {
        score: decision.score,
        maximum_score: criterion.maximum_score,
        // Banker's rounding, because Python's `round` is. `Math.round` breaks
        // ties upward, so a proportion landing exactly on a half at the third
        // decimal would differ from the Python record by 0.001 — and the
        // gradebook reads this field.
        proportion: roundHalfEven(decision.score / criterion.maximum_score, 3),
        criterion_id: criterion.criterion_id,
        assessment_id: assessment.assessment_id,
      },
    });

    if (!already(candidate)) produced.push(candidate);
  }
  return produced;
};

/**
 * Concept-level evidence from scored items.
 *
 * Deliberately thin: a single question is weak evidence, so no
 * `demonstrated_level` is asserted. The score and whether it was correct go in
 * `extensions`, and interpreting a run of them into a concept state is the gap
 * agent's job, not this function's.
 */
export const evidenceFromItemResponses = (
  b: CourseBundle,
  courseVersionId: string,
): Record<string, unknown>[] => {
  const items = itemById(b);
  const assessments = assessmentById(b);
  const submissions = new Map(
    (b.submissions as any[]).map((submission) => [submission.submission_id, submission]),
  );
  const already = recordedAlready(b);
  const produced: Record<string, unknown>[] = [];

  for (const response of b.item_responses as any[]) {
    if (response.score === null || response.score === undefined) continue;

    const item = items.get(response.item_id);
    const submission = submissions.get(response.submission_id);
    if (item === undefined || submission === undefined) continue;
    const concepts = (item.concepts ?? []) as string[];
    if (concepts.length === 0) continue;

    // A preparation question is asked before the work, to find out whether the
    // class is ready. A wrong answer there is an expected and useful result, so
    // deriving "did not demonstrate this concept" from it would misread the
    // reason it was asked. An unmarked item has no proportion to derive at all.
    if (item.role === "preparation" || item.maximum_score === 0) continue;

    const assessment = assessments.get(item.assessment_id);
    if (assessment === undefined || assessment.course_version_id !== courseVersionId) continue;

    const proportion = roundHalfEven(response.score / item.maximum_score, 3);
    const stem = String(response.response_id).replace("RESP-", "");
    const chosen = (response.chosen_options ?? []) as string[];
    const scoredBy = response.scored_by;

    concepts.forEach((conceptId, offset) => {
      const candidate = compact({
        evidence_id: `EVID-${stem}-${offset + 1}`,
        student_id: response.student_id,
        course_version_id: courseVersionId,
        source_type: "assessment_item",
        source_id: response.response_id,
        outcome_id: item.outcome_id,
        concept_id: conceptId,
        // Python passes `confidence=None` explicitly and `exclude_none` then
        // drops it. `compact` is what does the dropping here — the key is
        // written out so the reader can see the field was considered and
        // deliberately not asserted, which is the point the Python makes too.
        confidence: null,
        // Only a person verifies. An auto-scorer writes its own name here, and
        // `USER-` is what tells the two apart.
        verified_by:
          typeof scoredBy === "string" && scoredBy.startsWith("USER-") ? scoredBy : null,
        recorded_at: response.responded_at,
        provenance: compact({
          produced_by: "evidence-extractor",
          workflow_version: EVIDENCE_WORKFLOW,
          input_refs: [response.response_id, item.item_id],
          created_at: response.responded_at,
        }),
        extensions: {
          score: response.score,
          maximum_score: item.maximum_score,
          proportion,
          correct: response.correct ?? null,
          item_id: item.item_id,
          chosen_options: chosen,
          misconceptions: ((item.options ?? []) as any[])
            .filter(
              (option) =>
                chosen.includes(option.label) &&
                (option.indicates_misconception_of ?? null) !== null,
            )
            .map((option) => option.indicates_misconception_of),
        },
      });

      if (!already(candidate)) produced.push(candidate);
    });
  }
  return produced;
};

/**
 * Both derivations, evaluations first.
 *
 * The order is not cosmetic: it is the order the records are written in, and
 * the parity fixtures compare written trees.
 */
export const extractEvidence = (
  b: CourseBundle,
  courseVersionId: string,
): Record<string, unknown>[] => [
  ...evidenceFromEvaluations(b, courseVersionId),
  ...evidenceFromItemResponses(b, courseVersionId),
];
