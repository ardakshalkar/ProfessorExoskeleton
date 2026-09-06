/**
 * What a new assessment should cover, before anyone writes a question.
 * Ported from `ainar/blueprint.py`.
 *
 * `outcomeGradeShare` comes from `ainar/report.py` and lands here for now
 * because it is the only part of that module `blueprint` needs; it moves to
 * `report.ts` when that is ported.
 */

import {
  allRubrics,
  assessmentsOf,
  conceptById,
  itemById,
  moduleById,
  modulesOf,
  outcomesOf,
  runById,
  type CourseBundle,
} from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";

/**
 * What fraction of the final grade each outcome actually carries.
 *
 * From rubric criteria, not from the assessment's declared outcome list: a
 * criterion worth 25 of 100 on an assessment weighted 0.20 puts 5% of the final
 * grade on the outcome it measures. Assessments whose criteria name no outcome
 * contribute nothing, which is the honest answer.
 */
export const outcomeGradeShare = (b: CourseBundle, courseVersionId: string): Map<string, number> => {
  const share = new Map<string, number>();
  for (const assessment of assessmentsOf(b, courseVersionId)) {
    if (assessment.weight === null || assessment.weight === undefined) continue;
    const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
    if (!rubric || !rubric.criteria.length) continue;
    const total =
      rubric.criteria.reduce((sum: number, c: any) => sum + c.maximum_score, 0) ||
      assessment.maximum_score;
    for (const criterion of rubric.criteria) {
      if (!criterion.outcome_id) continue;
      const added = assessment.weight * (criterion.maximum_score / total);
      share.set(criterion.outcome_id, (share.get(criterion.outcome_id) ?? 0) + added);
    }
  }
  return share;
};

const scopeWeek = (b: CourseBundle, through: string | null | undefined): number | null => {
  if (through === null || through === undefined) return null;
  if (/^\d+$/.test(through)) return Number.parseInt(through, 10);
  const module = moduleById(b).get(through) as any;
  return module ? (module.week ?? null) : null;
};

const push = <T>(table: Map<string, T[]>, key: string, value: T): void => {
  table.set(key, [...(table.get(key) ?? []), value]);
};

export const blueprintPayload = (
  b: CourseBundle,
  courseVersionId: string,
  options: {
    outcomes?: string[];
    weight?: number | null;
    through?: string | null;
    marks?: number;
  } = {},
): Record<string, unknown> => {
  const { outcomes: requested, weight = null, through = null, marks = 100.0 } = options;
  const run = runById(b).get(courseVersionId) as any;
  const versionId = run.course_version_id;
  const allOutcomes = new Map(outcomesOf(b, (b.course as any).course_id).map((o) => [o.outcome_id as string, o]));
  const concepts = conceptById(b);
  const share = outcomeGradeShare(b, courseVersionId);

  const lastWeek = scopeWeek(b, through);
  const scopeModules = modulesOf(b, (b.course as any).course_id).filter(
    (module) => lastWeek === null || (module.week ?? 0) <= lastWeek,
  );

  const scopeConcepts: string[] = [];
  const taughtIn = new Map<string, string[]>();
  const moduleOutcomes = new Map<string, string[]>();
  for (const module of scopeModules) {
    for (const conceptId of module.concepts as string[]) {
      if (!scopeConcepts.includes(conceptId)) scopeConcepts.push(conceptId);
      push(taughtIn, conceptId, module.module_id);
    }
    for (const outcomeId of module.outcomes as string[]) push(moduleOutcomes, outcomeId, module.module_id);
  }

  const targetIds = (requested ?? [...allOutcomes.keys()].filter((id) => moduleOutcomes.has(id)))
    .filter((id) => allOutcomes.has(id));

  // Existing coverage, per concept.
  const assessedBy = new Map<string, string[]>();
  for (const rubric of allRubrics(b).values()) {
    for (const criterion of rubric.criteria ?? []) {
      for (const conceptId of criterion.concepts as string[]) push(assessedBy, conceptId, criterion.criterion_id);
    }
  }
  const itemCount = new Map<string, number>();
  for (const item of b.items as any[]) {
    for (const conceptId of item.concepts as string[]) {
      push(assessedBy, conceptId, item.item_id);
      itemCount.set(conceptId, (itemCount.get(conceptId) ?? 0) + 1);
    }
  }

  // Observed difficulty, from item responses and from recorded states.
  const attempts = new Map<string, number[]>();
  const items = itemById(b);
  for (const response of b.item_responses as any[]) {
    const item = items.get(response.item_id) as any;
    if (!item || response.score === null || response.score === undefined) continue;
    // An unmarked item has nothing to divide by, and a preparation question was
    // never meant to say how well the concept is held. Skipped, not counted as 0.
    if (item.maximum_score === 0 || item.role === "preparation") continue;
    for (const conceptId of item.concepts as string[]) {
      push(attempts, conceptId, response.score / item.maximum_score);
    }
  }
  const weakStates = new Set(
    (b.concept_states as any[])
      .filter(
        (state) =>
          state.course_version_id === courseVersionId && ["developing", "needs_review"].includes(state.state),
      )
      .map((state) => state.concept_id as string),
  );
  const signalled = new Set(
    (b.signals as any[])
      .filter((signal) => signal.course_version_id === courseVersionId && signal.status === "open")
      .flatMap((signal) => signal.concepts as string[]),
  );

  // Suggested mark allocation, proportional to declared outcome weight.
  const weights = new Map(targetIds.map((id) => [id, (allOutcomes.get(id) as any).weight ?? 0]));
  const totalWeight = [...weights.values()].reduce((a, b2) => a + b2, 0);
  const allocation = new Map(
    [...weights.entries()].map(([id, value]) => [
      id,
      totalWeight ? roundHalfEven(marks * (value / totalWeight), 1) : null,
    ]),
  );

  const declared = assessmentsOf(b, courseVersionId).reduce((sum, a) => sum + (a.weight ?? 0), 0);

  return {
    run: { id: courseVersionId, title: b.course.title, course_version_id: versionId },
    scope: {
      through,
      last_week: lastWeek,
      modules: scopeModules.map((m) => ({
        module_id: m.module_id,
        title: m.title,
        week: m.week ?? null,
      })),
    },
    target_outcomes: targetIds.map((outcomeId) => {
      const outcome = allOutcomes.get(outcomeId) as any;
      return {
        outcome_id: outcomeId,
        title: outcome.title,
        level: outcome.level,
        declared_weight: outcome.weight ?? null,
        current_share_of_grade: roundHalfEven(share.get(outcomeId) ?? 0, 3),
        taught_in: moduleOutcomes.get(outcomeId) ?? [],
        suggested_marks: allocation.get(outcomeId) ?? null,
      };
    }),
    concepts_in_scope: scopeConcepts.map((conceptId) => {
      const concept = concepts.get(conceptId) as any;
      const tried = attempts.get(conceptId);
      return {
        concept_id: conceptId,
        title: concept?.title ?? null,
        prerequisites: concept?.prerequisites ?? [],
        taught_in: taughtIn.get(conceptId) ?? [],
        already_assessed_by: assessedBy.get(conceptId) ?? [],
        existing_items: itemCount.get(conceptId) ?? 0,
        observed_success_rate: tried?.length
          ? roundHalfEven(tried.reduce((a, b2) => a + b2, 0) / tried.length, 2)
          : null,
        flagged: weakStates.has(conceptId) || signalled.has(conceptId),
      };
    }),
    never_assessed: scopeConcepts.filter((conceptId) => !assessedBy.get(conceptId)?.length),
    weighting: {
      total_marks: marks,
      proposed_weight: weight,
      existing_assessments: assessmentsOf(b, courseVersionId).map((a) => ({
        assessment_id: a.assessment_id,
        title: a.title,
        type: a.type,
        weight: a.weight ?? null,
      })),
      declared_total: roundHalfEven(declared, 3),
      total_if_added: roundHalfEven(declared + (weight ?? 0), 3),
    },
  };
};
