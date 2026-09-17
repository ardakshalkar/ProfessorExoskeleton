/**
 * Referential integrity and coverage checks. A **complete** port of
 * `ainar/validate.py` — all 94 codes, as of Phase 4 of `docs/node-migration.md`.
 *
 * It was partial for a long time and said so, because a validator that silently
 * checks half of what the professor thinks it checks is worse than one that
 * admits the gap. `coverage()` still exists and still reports the ratio; it now
 * reports 94 of 94, and `tests/test_validate.py` fails if `validate.py` grows a
 * code this file has not.
 *
 * **Every check is verified against `workspace/golden/validator/`**, a corpus that breaks
 * the example course one way at a time and records what `validate.py` said. That
 * is the whole safety argument: 98 mutations, one per failure mode, and message
 * text is part of the contract — the fixtures compare it exactly. A check with no
 * mutation behind it is a check nobody has seen fire, so it does not belong here.
 *
 * Two classes of bug the corpus caught that review would not have:
 *
 * * `[]` is falsy in Python and truthy in JavaScript, so `if not outcome.level`
 *   and `if (!outcome.level)` disagree about an outcome with no cognitive level.
 * * `_check_items` and `_check_runtime` both emit `ref.assessment` with different
 *   wording. Porting one site and registering the code hid the other.
 *
 * `document.missing_file` is the one check the corpus structurally cannot reach —
 * it needs a filesystem and the corpus validates an in-memory bundle. It is
 * covered by `test/validate.test.ts` instead.
 */

import {
  allRubrics,
  assessmentById,
  assessmentsOf,
  capabilityById,
  conceptById,
  criterionById,
  documentById,
  groupsOf,
  itemById,
  moduleById,
  modulesOf,
  outcomesOf,
  resourceById,
  itemModelById,
  itemsOf,
  outcomeById,
  runById,
  userById,
  type CourseBundle,
} from "./bundle.ts";
import { statSync } from "node:fs";
import { join } from "node:path";
import { IssueList, type Issue } from "./issues.ts";

/** Whether a repository-relative storage key names an existing file. */
const isFile = (root: string, key: string): boolean => {
  try {
    return statSync(join(root, key)).isFile();
  } catch {
    return false;
  }
};

/** Every code `validate.py` can emit. Kept sorted; `TOTAL_CODES` is its length. */
export const IMPLEMENTED = [
  "assessment.design_count",
  "assessment.design_marks",
  "assessment.design_scope",
  "assessment.no_rubric",
  "assessment.no_submission_type",
  "capability.level_out_of_range",
  "capability.unevidenced",
  "claim.unapproved_proposal",
  "concept.duplicate_name",
  "coverage.unassessed_outcome",
  "coverage.untaught_concept",
  "coverage.untaught_outcome",
  "coverage.unused_capability",
  "criterion.no_outcome",
  "date.order",
  "delivery.contradiction",
  "delivery.unreachable",
  "document.checksum",
  "document.duplicate_key",
  "document.missing_file",
  "enrollment.duplicate",
  "evaluation.pending_override",
  "evaluation.unapproved",
  "evaluation.unstamped",
  "evidence.untargeted",
  "graph.cycle",
  "graph.self_loop",
  "id.convention",
  "id.duplicate",
  "id.unapproved_draft",
  "intervention.unapproved",
  "item.criterion_score_mismatch",
  "item.difficulty_mismatch",
  "item.model_mismatch",
  "item.no_concepts",
  "item.no_options",
  "item.number_clash",
  "item.score_mismatch",
  "item.unmarked",
  "lms.duplicate_link",
  "lms.duplicate_tab",
  "lms.malformed",
  "lms.partial_links",
  "lms.sheet_url",
  "lms.tab_without_sheet",
  "lms.unsupported_target",
  "module.no_outcomes",
  "module.week_clash",
  "notion.database_url",
  "notion.malformed",
  "notion.partial",
  "notion.unknown_key",
  "outcome.level",
  "presentation.duration",
  "presentation.slide_limit",
  "privacy.identifier",
  "provenance.missing",
  "ref.assessment",
  "ref.capability",
  "ref.concept",
  "ref.course",
  "ref.course_run",
  "ref.course_version",
  "ref.criterion",
  "ref.document",
  "ref.event",
  "ref.evidence",
  "ref.item",
  "ref.item_model",
  "ref.module",
  "ref.option",
  "ref.outcome",
  "ref.resource",
  "ref.rubric",
  "ref.signal",
  "ref.submission",
  "ref.user",
  "ref.version_mismatch",
  "resource.no_location",
  "response.student_mismatch",
  "rubric.empty",
  "rubric.score_mismatch",
  "run.no_assessments",
  "run.no_instructor",
  "schedule.no_module",
  "schedule.outside_run",
  "schedule.slot_clash",
  "schedule.week_mismatch",
  "score.out_of_range",
  "signal.no_evidence",
  "version.missing",
  "version.no_outcomes",
  "weight.partial",
  "weight.sum",
] as const;

/** `validate.py`'s total, asserted against it by `tests/test_validate.py`. */
export const TOTAL_CODES = 94;

/**
 * Checks this port has and `validate.py` never did. Kept sorted.
 *
 * Separate from `IMPLEMENTED` on purpose, and the separation is the point.
 * `IMPLEMENTED` is not a list of what this file happens to check — it is the
 * claim that the port lost nothing, and the 98 mutations in
 * `workspace/golden/validator/` are what hold it there. Folding a new check into it
 * would turn "94 of 94" from a guarantee into a tautology: a number that
 * counts itself and can never be short.
 *
 * So a check added here is added here, and `coverage()` reports the two
 * numbers separately. None of these can fire on the golden corpus — every one
 * needs `canvas_courses`, which no fixture has — so `validator-check.ts`
 * continues to compare like for like.
 */
export const ADDED = [
  "lms.both_course_forms",
  "lms.unknown_subgroup",
  "lms.unmapped_subgroup",
] as const;

export const coverage = () => ({
  implemented: IMPLEMENTED.length,
  total: TOTAL_CODES,
  added: ADDED.length,
  note:
    `${IMPLEMENTED.length} of ${TOTAL_CODES} checks` +
    (IMPLEMENTED.length === TOTAL_CODES
      ? ", the complete set. Held to `validate.py` by the 98 mutations in `workspace/golden/validator/`."
      : ". The rest are not implemented; this number is the gate, so it is printed rather than assumed.") +
    (ADDED.length
      ? ` Plus ${ADDED.length} check${ADDED.length === 1 ? "" : "s"} added beyond it: ` +
        `${ADDED.join(", ")}.`
      : ""),
});

/** `WEIGHT_TOLERANCE` in `validate.py`. */
const WEIGHT_TOLERANCE = 0.001;

/** Python prints a float as `999.0`, not `999`. */
const f = (value: number): string => (Number.isInteger(value) ? `${value}.0` : String(value));

/** Python's `f"{value:g}"`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/** Values appearing more than once, in first-seen order — Python's `_duplicates`. */
const duplicates = (values: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([value]) => value);
};

const index = (records: any[], field: string): Map<string, any> =>
  new Map(records.map((record) => [record[field] as string, record]));

const ID_FIELDS: [collection: string, field: string][] = [
  ["outcomes", "outcome_id"],
  ["concepts", "concept_id"],
  ["capabilities", "capability_id"],
  ["modules", "module_id"],
  ["versions", "course_version_id"],
  ["activities", "activity_id"],
  ["assessments", "assessment_id"],
  ["items", "item_id"],
  ["documents", "document_id"],
  ["resources", "resource_id"],
  ["submissions", "submission_id"],
  ["evaluations", "evaluation_id"],
  ["evidence", "evidence_id"],
  ["signals", "signal_id"],
  ["interventions", "intervention_id"],
  ["events", "event_id"],
  ["action_items", "action_id"],
  ["enrollments", "enrollment_id"],
  ["users", "user_id"],
];

const checkDuplicates = (b: CourseBundle, issues: IssueList): void => {
  for (const [collection, field] of ID_FIELDS) {
    const seen = new Set<string>();
    for (const record of (b as any)[collection] as any[]) {
      const identifier = record[field];
      if (seen.has(identifier)) {
        issues.error("id.duplicate", `${collection}: identifier defined more than once`, identifier);
      }
      seen.add(identifier);
    }
  }
};

const checkConcepts = (b: CourseBundle, issues: IssueList): void => {
  const known = conceptById(b);
  for (const concept of b.concepts as any[]) {
    for (const neighbour of concept.prerequisites as string[]) {
      if (!known.has(neighbour)) {
        issues.error("ref.concept", `unknown prerequisite ${neighbour}`, concept.concept_id);
      } else if (neighbour === concept.concept_id) {
        issues.error("graph.self_loop", "concept is its own prerequisite", concept.concept_id);
      }
    }
    for (const neighbour of concept.related as string[]) {
      if (!known.has(neighbour)) {
        issues.error("ref.concept", `unknown related concept ${neighbour}`, concept.concept_id);
      }
    }
  }

  // Two concepts naming one thing fragment the graph silently.
  const seen = new Map<string, string>();
  for (const concept of b.concepts as any[]) {
    for (const name of [concept.title, ...(concept.aliases as string[])]) {
      const key = String(name).toLowerCase().split(/\s+/).join(" ");
      const first = seen.get(key);
      if (first === undefined) seen.set(key, concept.concept_id);
      else if (first !== concept.concept_id) {
        issues.warn(
          "concept.duplicate_name",
          `'${name}' already names ${first}; if they are the same concept, merge them and keep one identifier`,
          concept.concept_id,
        );
      }
    }
  }

  checkCycles(b, issues);
};

/** Prerequisite edges must form a DAG, or gap explanations loop forever. */
const checkCycles = (b: CourseBundle, issues: IssueList): void => {
  const graph = new Map<string, string[]>((b.concepts as any[]).map((c) => [c.concept_id, []]));
  for (const concept of b.concepts as any[]) {
    for (const prerequisite of concept.prerequisites as string[]) {
      graph.get(prerequisite)?.push(concept.concept_id);
    }
  }
  for (const edge of b.concept_edges as any[]) {
    if (edge.relationship_type !== "prerequisite_of") continue;
    if (graph.has(edge.source_concept_id) && graph.has(edge.target_concept_id)) {
      graph.get(edge.source_concept_id)!.push(edge.target_concept_id);
    }
  }

  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map<string, number>([...graph.keys()].map((k) => [k, WHITE]));
  const reported = new Set<string>();

  const visit = (node: string, path: string[]): void => {
    colour.set(node, GREY);
    path.push(node);
    for (const successor of graph.get(node)!) {
      if (colour.get(successor) === GREY) {
        const cycle = [...path.slice(path.indexOf(successor)), successor];
        const key = [...new Set(cycle)].sort().join("\u0000");
        if (!reported.has(key)) {
          reported.add(key);
          issues.error("graph.cycle", `prerequisite cycle: ${cycle.join(" -> ")}`, cycle[0]);
        }
      } else if (colour.get(successor) === WHITE) {
        visit(successor, path);
      }
    }
    path.pop();
    colour.set(node, BLACK);
  };

  for (const node of graph.keys()) if (colour.get(node) === WHITE) visit(node, []);
};

/**
 * Outcomes are referenced from four places, not one.
 *
 * Implementing only the criterion case passed the example course and failed
 * two mutations — modules, activities and assessments all name outcomes too.
 * The corpus caught it; reading had not.
 */
/**
 * A presentation plan names outcomes and concepts, and so can name missing ones.
 *
 * Added because the mutation corpus caught it: a deck's plan was the fourth
 * place an outcome id appears, and this port knew about three. The plan is
 * metadata on a `Document`, which is why it was easy to miss — but a slide
 * pointing at an outcome the course dropped is exactly the stale reference this
 * check exists for.
 */
const checkPresentationPlans = (b: CourseBundle, issues: IssueList): void => {
  const outcomes = outcomeById(b);
  const concepts = conceptById(b);

  for (const document of b.documents as any[]) {
    const plan = document.presentation_plan;
    if (!plan) continue;
    const where = document.document_id;

    const refs = (holder: any): void => {
      for (const outcomeId of (holder.outcomes ?? []) as string[]) {
        if (!outcomes.has(outcomeId)) {
          issues.error("ref.outcome", `unknown outcome ${outcomeId}`, where);
        }
      }
      for (const conceptId of (holder.concepts ?? []) as string[]) {
        if (!concepts.has(conceptId)) {
          issues.error("ref.concept", `unknown concept ${conceptId}`, where);
        }
      }
    };

    refs(plan);
    if (plan.max_slides != null && plan.slides.length > plan.max_slides) {
      issues.warn(
        "presentation.slide_limit",
        `plan contains ${plan.slides.length} slides but max_slides is ${plan.max_slides}`,
        where,
      );
    }
    const planned = (plan.slides as any[]).reduce((total, slide) => total + (slide.minutes ?? 0), 0);
    if (plan.duration_minutes != null && planned) {
      if (Math.abs(planned - plan.duration_minutes) > Math.max(5, plan.duration_minutes * 0.1)) {
        issues.warn(
          "presentation.duration",
          `slide timings total ${g(planned)} minutes but deck duration is ${plan.duration_minutes}`,
          where,
        );
      }
    }
    for (const slide of plan.slides as any[]) refs(slide);
  }
};

const checkAssessments = (b: CourseBundle, issues: IssueList): void => {
  const runs = runById(b);
  const outcomes = outcomeById(b);
  const capabilities = capabilityById(b);
  const concepts = conceptById(b);
  const modules = moduleById(b);
  const rubrics = allRubrics(b);

  for (const assessment of b.assessments as any[]) {
    const run = runs.get(assessment.course_version_id);
    if (run === undefined) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${assessment.course_version_id}`,
        assessment.assessment_id,
      );
      continue;
    }
    for (const outcomeId of (assessment.outcomes as string[]) ?? []) {
      if (!outcomes.has(outcomeId)) {
        issues.error("ref.outcome", `unknown outcome ${outcomeId}`, assessment.assessment_id);
      }
    }
    if (assessment.module_id && !modules.has(assessment.module_id)) {
      issues.error("ref.module", `unknown module ${assessment.module_id}`, assessment.assessment_id);
    }
    if (assessment.due_at) {
      const due = String(assessment.due_at).slice(0, 10);
      if (!(run.start_date <= due && due <= run.end_date)) {
        issues.warn(
          "schedule.outside_run",
          `due ${due}, outside the run window`,
          assessment.assessment_id,
        );
      }
    }
    if (assessment.opens_at && assessment.due_at && assessment.opens_at > assessment.due_at) {
      issues.error("date.order", "opens_at is after due_at", assessment.assessment_id);
    }
    if (!((assessment.submission_type as string[]) ?? []).length) {
      issues.warn("assessment.no_submission_type", "no submission type declared", assessment.assessment_id);
    }

    const design = assessment.design;
    if (design != null) {
      const declared = new Set((assessment.outcomes as string[]) ?? []);
      for (const cell of (design.cells as any[]) ?? []) {
        if (!outcomes.has(cell.outcome_id)) {
          issues.error(
            "ref.outcome",
            `blueprint cell names unknown outcome ${cell.outcome_id}`,
            assessment.assessment_id,
          );
        } else if (!declared.has(cell.outcome_id)) {
          issues.warn(
            "assessment.design_scope",
            `blueprint cell names ${cell.outcome_id}, which the assessment does not declare`,
            assessment.assessment_id,
          );
        }
      }
      if (((design.cells as any[]) ?? []).length) {
        const marks = (design.cells as any[]).reduce((sum, cell) => sum + (cell.marks as number), 0);
        if (Math.abs(marks - assessment.maximum_score) > 0.01) {
          issues.warn(
            "assessment.design_marks",
            `blueprint cells allocate ${g(marks)} marks but maximum_score is ` +
              `${g(assessment.maximum_score)}`,
            assessment.assessment_id,
          );
        }
        const count = (design.cells as any[]).reduce(
          (sum, cell) => sum + (cell.item_count as number),
          0,
        );
        if (design.target_item_count != null && count !== design.target_item_count) {
          issues.warn(
            "assessment.design_count",
            `blueprint cells request ${count} items but target_item_count is ` +
              `${design.target_item_count}`,
            assessment.assessment_id,
          );
        }
      }
    }

    const rubric = assessment.rubric_id ? rubrics.get(assessment.rubric_id) : undefined;
    if (assessment.rubric_id && rubric === undefined) {
      issues.error("ref.rubric", `unknown rubric ${assessment.rubric_id}`, assessment.assessment_id);
    } else if (rubric === undefined) {
      issues.warn(
        "assessment.no_rubric",
        "no rubric — criterion-level grading and evidence are not possible",
        assessment.assessment_id,
      );
    } else if (((rubric.criteria as any[]) ?? []).length) {
      const total = (rubric.criteria as any[]).reduce(
        (sum, criterion) => sum + (criterion.maximum_score as number),
        0,
      );
      if (Math.abs(total - assessment.maximum_score) > 0.01) {
        issues.warn(
          "rubric.score_mismatch",
          `criteria sum to ${g(total)} but maximum_score is ${g(assessment.maximum_score)}`,
          assessment.assessment_id,
        );
      }
    }
  }

  for (const rubric of rubrics.values()) {
    if (!((rubric.criteria as any[]) ?? []).length) {
      issues.warn("rubric.empty", "rubric has no criteria", rubric.rubric_id);
    }
    for (const criterion of (rubric.criteria as any[]) ?? []) {
      if (criterion.rubric_id !== rubric.rubric_id) {
        issues.error(
          "ref.rubric",
          `criterion declares rubric_id ${criterion.rubric_id}, found in ${rubric.rubric_id}`,
          criterion.criterion_id,
        );
      }
      if (criterion.outcome_id == null) {
        issues.warn(
          "criterion.no_outcome",
          "criterion is not linked to a learning outcome, so it produces marks but no evidence",
          criterion.criterion_id,
        );
      } else if (!outcomes.has(criterion.outcome_id)) {
        issues.error("ref.outcome", `unknown outcome ${criterion.outcome_id}`, criterion.criterion_id);
      }
      if (criterion.capability_id && !capabilities.has(criterion.capability_id)) {
        issues.error(
          "ref.capability",
          `unknown capability ${criterion.capability_id}`,
          criterion.criterion_id,
        );
      }
      for (const conceptId of (criterion.concepts as string[]) ?? []) {
        if (!concepts.has(conceptId)) {
          issues.error("ref.concept", `unknown concept ${conceptId}`, criterion.criterion_id);
        }
      }
    }
  }

  for (const run of b.versions as any[]) {
    const assessments = assessmentsOf(b, run.course_version_id);
    if (!assessments.length) {
      issues.warn("run.no_assessments", "course run has no assessments", run.course_version_id);
      continue;
    }
    const weighted = assessments.filter((a) => a.weight != null);
    if (weighted.length && weighted.length === assessments.length) {
      const total = weighted.reduce((sum, a) => sum + (a.weight as number), 0);
      if (Math.abs(total - 1.0) > WEIGHT_TOLERANCE) {
        issues.warn(
          "weight.sum",
          `assessment weights sum to ${total.toFixed(3)}, expected 1.0`,
          run.course_version_id,
        );
      }
    } else if (weighted.length) {
      issues.warn(
        "weight.partial",
        `${weighted.length} of ${assessments.length} assessments declare a weight`,
        run.course_version_id,
      );
    }
  }
};

/**
 * One offering per term, and it must say which course and term it is.
 *
 * The `-v<n>` identifier went with the version/run merge: a version is now a
 * semester, so what is checked is that the identifier agrees with the term.
 */
const checkVersions = (b: CourseBundle, issues: IssueList): void => {
  const courseId = (b.course as any).course_id as string;
  if (!(b.versions as any[]).length) {
    issues.error("version.missing", "course has no offering", courseId);
  }
  for (const version of b.versions as any[]) {
    if (version.course_id !== courseId) {
      issues.error(
        "ref.course",
        `course_id ${version.course_id} does not match ${courseId}`,
        version.course_version_id,
      );
    }
    const expected = `${version.course_id}-${version.term}`;
    if (version.course_version_id !== expected) {
      issues.error("id.convention", `course_version_id should be '${expected}'`, version.course_version_id);
    }
    if (version.end_date < version.start_date) {
      issues.error("date.order", "end_date precedes start_date", version.course_version_id);
    }
  }
};

/** A concept scoped to a course that is not this one. */
const checkConceptOwnership = (b: CourseBundle, issues: IssueList): void => {
  const courseId = (b.course as any).course_id as string;
  for (const concept of b.concepts as any[]) {
    if (concept.course_id && concept.course_id !== courseId) {
      issues.error("ref.course_version", `unknown course_id ${concept.course_id}`, concept.concept_id);
    }
  }
  for (const edge of b.concept_edges as any[]) {
    const known = conceptById(b);
    for (const endpoint of [edge.source_concept_id, edge.target_concept_id]) {
      if (!known.has(endpoint)) {
        issues.error(
          "ref.concept",
          `unknown concept ${endpoint} in ${edge.relationship_type} edge`,
          `${edge.source_concept_id}->${edge.target_concept_id}`,
        );
      }
    }
  }
};

const checkOutcomes = (b: CourseBundle, issues: IssueList): void => {
  const courseId = (b.course as any).course_id as string;
  const concepts = conceptById(b);
  const capabilities = capabilityById(b);

  for (const outcome of b.outcomes as any[]) {
    if (outcome.course_id !== courseId) {
      issues.error("ref.course_version", `unknown course_id ${outcome.course_id}`, outcome.outcome_id);
    }
    for (const conceptId of (outcome.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, outcome.outcome_id);
      }
    }
    for (const capabilityId of (outcome.capabilities as string[]) ?? []) {
      if (!capabilities.has(capabilityId)) {
        issues.error("ref.capability", `unknown capability ${capabilityId}`, outcome.outcome_id);
      }
    }
    // `level` is a list of cognitive levels, and Python's `if not outcome.level`
    // is false for an empty one. `[]` is truthy in JavaScript, so the length is
    // what has to be tested — the mutation corpus caught this.
    if (!((outcome.level as unknown[]) ?? []).length) {
      issues.warn("outcome.level", "no cognitive level declared", outcome.outcome_id);
    }
  }

  for (const version of b.versions as any[]) {
    const outcomes = outcomesOf(b, courseId);
    if (!outcomes.length) {
      issues.warn(
        "version.no_outcomes",
        "course version has no learning outcomes",
        version.course_version_id,
      );
      continue;
    }
    const weighted = outcomes.filter((o) => o.weight != null);
    if (weighted.length && weighted.length === outcomes.length) {
      const total = weighted.reduce((sum, o) => sum + (o.weight as number), 0);
      if (Math.abs(total - 1.0) > WEIGHT_TOLERANCE) {
        issues.warn(
          "weight.sum",
          `outcome weights sum to ${total.toFixed(3)}, expected 1.0`,
          version.course_version_id,
        );
      }
    } else if (weighted.length) {
      issues.warn(
        "weight.partial",
        `${weighted.length} of ${outcomes.length} outcomes declare a weight`,
        version.course_version_id,
      );
    }
  }
};

const checkModules = (b: CourseBundle, issues: IssueList): void => {
  const courseId = (b.course as any).course_id as string;
  const outcomes = outcomeById(b);
  const concepts = conceptById(b);

  for (const module of b.modules as any[]) {
    if (module.course_id !== courseId) {
      issues.error("ref.course_version", `unknown course_id ${module.course_id}`, module.module_id);
    }
    for (const outcomeId of (module.outcomes as string[]) ?? []) {
      const outcome = outcomes.get(outcomeId);
      if (outcome === undefined) {
        issues.error("ref.outcome", `unknown outcome ${outcomeId}`, module.module_id);
      } else if (outcome.course_id !== module.course_id) {
        issues.error(
          "ref.version_mismatch",
          `outcome ${outcomeId} belongs to ${outcome.course_id}`,
          module.module_id,
        );
      }
    }
    for (const conceptId of (module.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, module.module_id);
      }
    }
    if (!((module.outcomes as string[]) ?? []).length) {
      issues.warn("module.no_outcomes", "module addresses no learning outcome", module.module_id);
    }
  }

  for (const version of b.versions as any[]) {
    const weeks = modulesOf(b, courseId)
      .filter((m) => m.week)
      .map((m) => String(m.week));
    for (const duplicate of duplicates(weeks)) {
      issues.warn(
        "module.week_clash",
        `more than one module is scheduled in week ${duplicate}`,
        version.course_version_id,
      );
    }
  }
};

const checkRuns = (b: CourseBundle, issues: IssueList): void => {
  const courseId = (b.course as any).course_id as string;
  const runs = runById(b);
  const users = userById(b);

  for (const run of b.versions as any[]) {
    if (!run.course_version_id.startsWith(`${courseId}-`)) {
      issues.error(
        "id.convention",
        `course_version_id must start with ${courseId}-`,
        run.course_version_id,
      );
    }
    if (run.course_version_id !== `${courseId}-${run.term}`) {
      issues.error(
        "id.convention",
        `course_version_id does not match term ${run.term}`,
        run.course_version_id,
      );
    }
    if (run.end_date < run.start_date) {
      issues.error("date.order", "end_date precedes start_date", run.course_version_id);
    }
    if (!((run.instructors as string[]) ?? []).length) {
      issues.warn("run.no_instructor", "course run has no instructor", run.course_version_id);
    }
    for (const userId of [
      ...(((run.instructors as string[]) ?? [])),
      ...(((run.assistants as string[]) ?? [])),
    ]) {
      if (!users.has(userId)) {
        issues.error("ref.user", `unknown user ${userId}`, run.course_version_id);
      }
    }
  }

  const seen = new Set<string>();
  for (const enrollment of b.enrollments as any[]) {
    if (!runs.has(enrollment.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${enrollment.course_version_id}`,
        enrollment.enrollment_id,
      );
    }
    const key = `${enrollment.course_version_id}\u0000${enrollment.student_id}`;
    if (seen.has(key)) {
      issues.error(
        "enrollment.duplicate",
        `${enrollment.student_id} is enrolled twice in ${enrollment.course_version_id}`,
        enrollment.enrollment_id,
      );
    }
    seen.add(key);
  }
};

/**
 * What `ainar roster import` produces: base32 over the HMAC of the student
 * number, six characters.
 *
 * A numeric branch used to be allowed so the example course would validate — but
 * `STUDENT-20231234` is precisely the shape of a real institutional number, so
 * the exemption whitelisted the one thing this check exists to catch.
 */
const PSEUDONYM = /^STUDENT-[A-Z2-7]{6}$/;

/**
 * Student identifiers must not carry identity.
 *
 * Reported once per identifier rather than once per record: a real name in the
 * roster would otherwise produce one warning per submission, per response and
 * per piece of evidence, burying everything else.
 */
const checkStudentIdentifiers = (b: CourseBundle, issues: IssueList): void => {
  const sources: [student: string, where: string][] = [
    ...(b.enrollments as any[]).map((e) => [e.student_id, e.enrollment_id] as [string, string]),
    ...(b.submissions as any[]).map((s) => [s.student_id, s.submission_id] as [string, string]),
    ...(b.item_responses as any[]).map((r) => [r.student_id, r.response_id] as [string, string]),
    ...(b.evidence as any[]).map((e) => [e.student_id, e.evidence_id] as [string, string]),
    ...(b.signals as any[])
      .filter((s) => s.student_id)
      .map((s) => [s.student_id, s.signal_id] as [string, string]),
    ...(b.interventions as any[])
      .filter((i) => i.student_id)
      .map((i) => [i.student_id, i.intervention_id] as [string, string]),
    ...(b.concept_states as any[]).map(
      (c) => [c.student_id, `${c.student_id}/${c.concept_id}`] as [string, string],
    ),
  ];

  const seen = new Set<string>();
  for (const [studentId, where] of sources) {
    if (seen.has(studentId) || PSEUDONYM.test(studentId)) continue;
    seen.add(studentId);
    issues.warn(
      "privacy.identifier",
      `'${studentId}' does not look pseudonymous — student identifiers should come from ` +
        "`ainar roster import`, which keeps names outside this repository",
      where,
    );
  }
};

/**
 * Which week of the run a datetime falls in, counting from week 1.
 *
 * Anchored on the Monday of the run's opening week rather than on `start_date`
 * itself, so a term starting on a Tuesday still puts that Tuesday and the Friday
 * after it in week 1.
 */
const teachingWeek = (run: any, moment: string): number => {
  const start = new Date(`${run.start_date}T00:00:00Z`);
  // Python's `weekday()` is Monday=0; JS `getUTCDay()` is Sunday=0.
  const weekday = (start.getUTCDay() + 6) % 7;
  const anchor = new Date(start.getTime() - weekday * 86_400_000);
  const day = new Date(`${moment.slice(0, 10)}T00:00:00Z`);
  return Math.floor((day.getTime() - anchor.getTime()) / (7 * 86_400_000)) + 1;
};

const checkActivities = (b: CourseBundle, issues: IssueList): void => {
  const runs = runById(b);
  const modules = moduleById(b);
  const outcomes = outcomeById(b);
  const concepts = conceptById(b);
  const resources = resourceById(b);
  // A term plan arrives as thirty meetings derived from one weekday pattern, so
  // an off-by-one in that arithmetic lands two of them on the same instant.
  const slots = new Map<string, string>();

  for (const activity of b.activities as any[]) {
    const run = runs.get(activity.course_version_id);
    if (run === undefined) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${activity.course_version_id}`,
        activity.activity_id,
      );
      continue;
    }
    if (activity.module_id && !modules.has(activity.module_id)) {
      issues.error("ref.module", `unknown module ${activity.module_id}`, activity.activity_id);
    }
    for (const outcomeId of (activity.outcomes as string[]) ?? []) {
      if (!outcomes.has(outcomeId)) {
        issues.error("ref.outcome", `unknown outcome ${outcomeId}`, activity.activity_id);
      }
    }
    for (const conceptId of (activity.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, activity.activity_id);
      }
    }
    for (const resourceId of (activity.resources as string[]) ?? []) {
      if (!resources.has(resourceId)) {
        issues.error("ref.resource", `unknown resource ${resourceId}`, activity.activity_id);
      }
    }
    if (activity.module_id == null) {
      issues.warn(
        "schedule.no_module",
        "meeting names no module, so nothing links it to what is taught " +
          "(deliberate for a revision or consultation slot)",
        activity.activity_id,
      );
    }
    if (activity.scheduled_at) {
      const scheduled = String(activity.scheduled_at).slice(0, 10);
      if (!(run.start_date <= scheduled && scheduled <= run.end_date)) {
        issues.warn(
          "schedule.outside_run",
          `scheduled ${scheduled}, outside ${run.start_date}..${run.end_date}`,
          activity.activity_id,
        );
      }
      const slot = `${activity.course_version_id}\u0000${activity.scheduled_at}`;
      const clash = slots.get(slot);
      if (clash !== undefined) {
        issues.warn(
          "schedule.slot_clash",
          `starts at the same moment as ${clash} in the same run`,
          activity.activity_id,
        );
      } else {
        slots.set(slot, activity.activity_id);
      }
      const module = activity.module_id ? modules.get(activity.module_id) : undefined;
      if (module !== undefined && module.week != null) {
        const taught = teachingWeek(run, String(activity.scheduled_at));
        if (taught !== module.week) {
          issues.warn(
            "schedule.week_mismatch",
            `falls in week ${taught} of the run but teaches ${module.module_id}, which is ` +
              `week ${module.week} (a holiday shifting the calendar is a fair reason)`,
            activity.activity_id,
          );
        }
      }
    }
  }
};

/** Reusable item models must stay inside the course design they serve. */
const checkItemModels = (b: CourseBundle, issues: IssueList): void => {
  const outcomes = outcomeById(b);
  const capabilities = capabilityById(b);
  const concepts = conceptById(b);
  const runs = runById(b);

  for (const model of b.item_models as any[]) {
    if (!runs.has(model.course_version_id)) {
      issues.error(
        "ref.course_version",
        `unknown course_version_id ${model.course_version_id}`,
        model.item_model_id,
      );
    }
    if (model.outcome_id && !outcomes.has(model.outcome_id)) {
      issues.error("ref.outcome", `unknown outcome ${model.outcome_id}`, model.item_model_id);
    }
    if (model.capability_id && !capabilities.has(model.capability_id)) {
      issues.error(
        "ref.capability",
        `unknown capability ${model.capability_id}`,
        model.item_model_id,
      );
    }
    for (const conceptId of [
      ...((model.concepts as string[]) ?? []),
      ...((model.misconceptions as string[]) ?? []),
    ]) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, model.item_model_id);
      }
    }
  }
};

/** How many responses an item needs before its declared difficulty is judged. */
const DIFFICULTY_SAMPLE = 5;

/** Python's `f"{rate:.0%}"`, which rounds half to even. */
const percent = (rate: number): string => {
  const scaled = rate * 100;
  const floor = Math.floor(scaled);
  const remainder = scaled - floor;
  let rounded: number;
  if (Math.abs(remainder - 0.5) < 1e-9) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }
  return `${rounded}%`;
};

/**
 * `role` and `difficulty`: what the professor said an item would be.
 *
 * `difficulty` exists to be checked against what happened, and this is the check.
 * An item declared `easy` that half the class fails is either badly worded or a
 * topic that did not land, and the success rate is only surprising if somebody
 * wrote down what they expected.
 */
const checkItemIntent = (b: CourseBundle, issues: IssueList): void => {
  const items = itemById(b);
  const observed = new Map<string, number[]>();
  for (const response of b.item_responses as any[]) {
    const item = items.get(response.item_id);
    if (item === undefined || response.score == null || item.maximum_score === 0) continue;
    const rates = observed.get(item.item_id) ?? [];
    rates.push(response.score / item.maximum_score);
    observed.set(item.item_id, rates);
  }

  for (const item of b.items as any[]) {
    if (item.maximum_score === 0 && item.role !== "preparation") {
      issues.warn(
        "item.unmarked",
        `carries no marks but its role is '${item.role}', so it can never contribute to a ` +
          "score — set a maximum, or mark it as a preparation item if that is what it is",
        item.item_id,
      );
    }

    const scores = observed.get(item.item_id) ?? [];
    if (item.difficulty == null || scores.length < DIFFICULTY_SAMPLE) continue;
    const rate = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    if (item.difficulty === "easy" && rate < 0.5) {
      issues.warn(
        "item.difficulty_mismatch",
        `declared easy but ${percent(rate)} of ${scores.length} responses scored — ` +
          "either the wording or the teaching, not the students",
        item.item_id,
      );
    } else if (item.difficulty === "complex" && rate > 0.9) {
      issues.warn(
        "item.difficulty_mismatch",
        `declared complex but ${percent(rate)} of ${scores.length} responses scored, ` +
          "so it is not discriminating between students",
        item.item_id,
      );
    }
  }
};

/** Submission formats that describe a file. An oral defence produces none of them. */
const FILE_FORMATS = new Set([
  "pdf",
  "docx",
  "pptx",
  "notebook",
  "code_repo",
  "audio",
  "video",
  "image",
]);

const LMS_EXTENSION = "lms";
const CANVAS_ASSIGNMENT_KEY = "canvas_assignment_id";

/**
 * `delivery` against the configuration each channel needs to work.
 *
 * This is why `delivery` is a core field and not an extension: naming the channel
 * is only worth doing if something checks the channel can actually be reached.
 * Each warning names a command that would otherwise fail at the point it matters
 * most — the day the grades are due.
 */
const checkDelivery = (b: CourseBundle, issues: IssueList): void => {
  const canvasId = (assessment: any): unknown => {
    const found = (assessment.extensions ?? {})[LMS_EXTENSION];
    return found && typeof found === "object" ? found[CANVAS_ASSIGNMENT_KEY] : undefined;
  };

  for (const run of b.versions as any[]) {
    const assessments = assessmentsOf(b, run.course_version_id);
    // Only complain about a missing Canvas id when Canvas is in use for this run.
    // A course that exports nothing needs no ids, and a warning on every
    // assessment would teach the reader to ignore the code.
    const canvasInUse = assessments.some((a) => canvasId(a) != null);

    for (const assessment of assessments) {
      const where = assessment.assessment_id;
      if (assessment.delivery == null) continue;
      const channel = assessment.delivery;

      if (channel === "canvas_upload" && canvasInUse && canvasId(assessment) == null) {
        issues.warn(
          "delivery.unreachable",
          "arrives as a Canvas upload but has no " +
            `extensions.${LMS_EXTENSION}.${CANVAS_ASSIGNMENT_KEY}, so \`lms push\` cannot ` +
            "write its column",
          where,
        );
      }

      if (channel === "paper_exam") {
        const paper = (assessment.extensions ?? {}).paper;
        const questions = paper && typeof paper === "object" ? paper.questions : undefined;
        if (!questions || !(questions as unknown[]).length) {
          issues.warn(
            "delivery.unreachable",
            "is sat on paper but has no extensions.paper.questions, so `exam-setup` and " +
              "`import-graded-exam` cannot map a question to a criterion",
            where,
          );
        }
      }

      if (channel === "oral_defense") {
        const files = ((assessment.submission_type as string[]) ?? [])
          .filter((format) => FILE_FORMATS.has(format))
          .sort();
        if (files.length) {
          issues.warn(
            "delivery.contradiction",
            `arrives as an oral defence but declares ${files.join(", ")} as a submission ` +
              "format — one of the two is wrong",
            where,
          );
        }
      }
    }
  }
};

/**
 * Documents, and every reference that points at one.
 *
 * `root` is optional the way it is in Python: without it the file-existence check
 * is skipped rather than guessed at. The mutation corpus validates without a root,
 * so `document.missing_file` is covered by `test/validate.test.ts` instead.
 */
const checkDocuments = (b: CourseBundle, issues: IssueList, root?: string): void => {
  const known = documentById(b);
  const runs = runById(b);
  const modules = moduleById(b);
  const concepts = conceptById(b);

  const keys = new Map<string, string>();
  for (const document of b.documents as any[]) {
    if (keys.has(document.storage_key)) {
      issues.error(
        "document.duplicate_key",
        `storage_key is already used by ${keys.get(document.storage_key)}`,
        document.document_id,
      );
    }
    keys.set(document.storage_key, document.document_id);

    if (document.supersedes && !known.has(document.supersedes)) {
      issues.error("ref.document", `unknown document ${document.supersedes}`, document.document_id);
    }
    if (document.course_version_id && !runs.has(document.course_version_id)) {
      // Python reports both codes here: the run and the version were separate
      // records before the merge and the two checks were never collapsed.
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${document.course_version_id}`,
        document.document_id,
      );
      issues.error(
        "ref.course_version",
        `unknown course_version_id ${document.course_version_id}`,
        document.document_id,
      );
    }
    if (document.module_id && !modules.has(document.module_id)) {
      issues.error("ref.module", `unknown module ${document.module_id}`, document.document_id);
    }
    for (const conceptId of (document.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, document.document_id);
      }
    }
    if (document.checksum && !String(document.checksum).startsWith("sha256:")) {
      issues.warn(
        "document.checksum",
        "checksum should be prefixed with the algorithm, e.g. 'sha256:'",
        document.document_id,
      );
    }
    if (root !== undefined && !String(document.storage_key).includes("://")) {
      if (!isFile(root, document.storage_key)) {
        issues.error(
          "document.missing_file",
          `${document.storage_key} does not exist — a storage_key with no scheme is a path ` +
            "in this repository; use 'object://…' for object storage",
          document.document_id,
        );
      }
    }
  }

  // Every reference to a document, from anywhere.
  const referenced: [documentId: string, where: string][] = [];
  for (const resource of b.resources as any[]) {
    if (resource.document_id) referenced.push([resource.document_id, resource.resource_id]);
  }
  for (const submission of b.submissions as any[]) {
    for (const file of (submission.files as any[]) ?? []) {
      referenced.push([file.document_id, submission.submission_id]);
    }
  }
  for (const assessment of b.assessments as any[]) {
    if (assessment.instructions_document_id) {
      referenced.push([assessment.instructions_document_id, assessment.assessment_id]);
    }
  }
  for (const version of b.versions as any[]) {
    if (version.syllabus_document_id) {
      referenced.push([version.syllabus_document_id, version.course_version_id]);
    }
  }
  for (const evaluation of b.evaluations as any[]) {
    if (evaluation.ai_suggestion) {
      for (const reference of (evaluation.ai_suggestion.evidence as any[]) ?? []) {
        if (reference.document_id) {
          referenced.push([reference.document_id, evaluation.evaluation_id]);
        }
      }
    }
  }

  for (const [documentId, where] of referenced) {
    if (!known.has(documentId)) {
      issues.warn(
        "ref.document",
        `${documentId} is not registered — add it to documents.yaml, or leave it if the ` +
          "application owns the file",
        where,
      );
    }
  }
};

const checkResources = (b: CourseBundle, issues: IssueList): void => {
  const runs = runById(b);
  const concepts = conceptById(b);
  for (const resource of b.resources as any[]) {
    if (resource.course_version_id && !runs.has(resource.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${resource.course_version_id}`,
        resource.resource_id,
      );
      issues.error(
        "ref.course_version",
        `unknown course_version_id ${resource.course_version_id}`,
        resource.resource_id,
      );
    }
    for (const conceptId of (resource.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, resource.resource_id);
      }
    }
    if (resource.document_id == null && resource.url == null) {
      issues.warn(
        "resource.no_location",
        "resource has neither a document_id nor a url",
        resource.resource_id,
      );
    }
  }
};

/** The design chain: outcome -> concept -> activity -> criterion -> evidence. */
const checkCoverage = (b: CourseBundle, issues: IssueList): void => {
  const assessedOutcomes = new Set<string>();
  for (const rubric of allRubrics(b).values()) {
    for (const criterion of (rubric.criteria as any[]) ?? []) {
      if (criterion.outcome_id) assessedOutcomes.add(criterion.outcome_id);
    }
  }
  for (const assessment of b.assessments as any[]) {
    for (const outcomeId of (assessment.outcomes as string[]) ?? []) {
      assessedOutcomes.add(outcomeId);
    }
  }
  for (const item of b.items as any[]) {
    if (item.outcome_id) assessedOutcomes.add(item.outcome_id);
  }

  const taughtOutcomes = new Set<string>();
  for (const module of b.modules as any[]) {
    for (const outcomeId of (module.outcomes as string[]) ?? []) taughtOutcomes.add(outcomeId);
  }
  for (const activity of b.activities as any[]) {
    for (const outcomeId of (activity.outcomes as string[]) ?? []) taughtOutcomes.add(outcomeId);
  }

  for (const outcome of b.outcomes as any[]) {
    if (!taughtOutcomes.has(outcome.outcome_id)) {
      issues.warn(
        "coverage.untaught_outcome",
        "no module or activity addresses this outcome",
        outcome.outcome_id,
      );
    }
    if (!assessedOutcomes.has(outcome.outcome_id)) {
      issues.warn(
        "coverage.unassessed_outcome",
        "no assessment or rubric criterion measures this outcome",
        outcome.outcome_id,
      );
    }
  }

  const taughtConcepts = new Set<string>();
  for (const module of b.modules as any[]) {
    for (const conceptId of (module.concepts as string[]) ?? []) taughtConcepts.add(conceptId);
  }
  for (const activity of b.activities as any[]) {
    for (const conceptId of (activity.concepts as string[]) ?? []) taughtConcepts.add(conceptId);
  }
  for (const concept of b.concepts as any[]) {
    if (!taughtConcepts.has(concept.concept_id)) {
      issues.warn(
        "coverage.untaught_concept",
        "no module or activity teaches this concept",
        concept.concept_id,
      );
    }
  }

  const usedCapabilities = new Set<string>();
  for (const rubric of allRubrics(b).values()) {
    for (const criterion of (rubric.criteria as any[]) ?? []) {
      if (criterion.capability_id) usedCapabilities.add(criterion.capability_id);
    }
  }
  for (const outcome of b.outcomes as any[]) {
    for (const capabilityId of (outcome.capabilities as string[]) ?? []) {
      usedCapabilities.add(capabilityId);
    }
  }
  for (const capability of b.capabilities as any[]) {
    if (!usedCapabilities.has(capability.capability_id)) {
      issues.warn(
        "coverage.unused_capability",
        "no outcome or criterion contributes to this capability",
        capability.capability_id,
      );
    }
  }
};

// --------------------------------------------------------------------------
// LMS and Notion linkage
// --------------------------------------------------------------------------
//
// Nothing in this section is required — a course with no linkage is fine. But a
// *wrong* link sends grades to the wrong column, which is worse than no link at
// all, so the shape is checked. Constants are duplicated from `ainar/lms/` and
// `ainar/notion/` rather than imported: those modules hold credentials and
// network code, and the validator holds neither.

const CANVAS_COURSE_KEY = "canvas_course_id";
const CANVAS_COURSES_KEY = "canvas_courses";
const CANVAS_ASSIGNMENTS_KEY = "canvas_assignments";
const TARGET_KEY = "target";
const SHEET_ID_KEY = "sheet_id";
const SHEET_TAB_KEY = "sheet_tab";
const TARGETS = ["canvas-csv", "canvas-api", "sheet-csv", "sheets-api"];

/** Characters Google Sheets will not accept in a tab name. */
const FORBIDDEN_IN_TAB = new Set("[]*?/\\:".split(""));
const MAX_TAB_LENGTH = 100;
const SUMMARY_TAB = "Summary";

const NOTION_EXTENSION = "notion";
/** Every database `notion pull` knows how to read. */
const NOTION_DATABASES = ["topics_database_id", "assignments_database_id", "grading_database_id"];

const lmsString = (entity: any, key: string): string | null => {
  const found = (entity.extensions ?? {})[LMS_EXTENSION];
  if (!found || typeof found !== "object") return null;
  const value = found[key];
  return value == null ? null : String(value);
};

const sanitiseTab = (name: string): string => {
  const cleaned = [...name].map((char) => (FORBIDDEN_IN_TAB.has(char) ? "-" : char)).join("").trim();
  return cleaned.slice(0, MAX_TAB_LENGTH) || "Sheet";
};

/**
 * A tab name derived from the assessment id: `ASSESSMENT-04` becomes `A04`.
 *
 * From the id, deliberately, and never from the title: a tab name is the key the
 * next push finds the tab by, so it has to be as stable as the thing it names.
 */
const defaultSheetTab = (assessment: any): string => {
  const remainder = String(assessment.assessment_id).replace(/^ASSESSMENT-/, "");
  if (!remainder) return sanitiseTab(assessment.assessment_id);
  return sanitiseTab(/^\d/.test(remainder) ? `A${remainder}` : remainder);
};

const effectiveSheetTab = (assessment: any): string =>
  lmsString(assessment, SHEET_TAB_KEY) ?? defaultSheetTab(assessment);

const effectiveSummaryTab = (run: any): string => lmsString(run, SHEET_TAB_KEY) ?? SUMMARY_TAB;

/** Which entities want which tab, defaults included. */
const tabOwners = (b: CourseBundle, courseVersionId: string): Map<string, string[]> => {
  const owners = new Map<string, string[]>();
  const add = (tab: string, owner: string): void => {
    owners.set(tab, [...(owners.get(tab) ?? []), owner]);
  };
  const run = runById(b).get(courseVersionId);
  if (run !== undefined) add(effectiveSummaryTab(run), `${courseVersionId} (summary)`);
  for (const assessment of assessmentsOf(b, courseVersionId)) {
    add(effectiveSheetTab(assessment), assessment.assessment_id);
  }
  return owners;
};

/** Python's `type(found).__name__` for the values YAML can produce. */
const typeName = (value: unknown): string => {
  if (value === null) return "NoneType";
  if (Array.isArray(value)) return "list";
  if (typeof value === "string") return "str";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  return "dict";
};

/**
 * The spreadsheet a run writes to, and the tabs inside it.
 *
 * Tab names are derived from identifiers unless one is written down, so the check
 * is over the **effective** names: an explicit `sheet_tab: A05` on one assessment
 * collides with the name another derives, and each push rewrites a tab whole, so
 * two claimants means one silently erases the other.
 */
const checkSheetLinks = (
  b: CourseBundle,
  run: any,
  courseLink: Record<string, unknown>,
  issues: IssueList,
): void => {
  const spreadsheet = courseLink[SHEET_ID_KEY];
  if (
    spreadsheet != null &&
    (String(spreadsheet).includes("docs.google.com") || String(spreadsheet).startsWith("http"))
  ) {
    issues.warn(
      "lms.sheet_url",
      `${SHEET_ID_KEY} holds a URL; the id alone — the part between /d/ and /edit — is what ` +
        "the API wants and what survives a moved document",
      run.course_version_id,
    );
  }

  // A derived name cannot be malformed — the identifier patterns already forbid
  // everything Google rejects. One written down by hand can be, and mangling it
  // silently would put the marks in a tab nobody named.
  const entities: [entity: any, location: string][] = [
    [run, run.course_version_id],
    ...assessmentsOf(b, run.course_version_id).map(
      (a) => [a, a.assessment_id] as [any, string],
    ),
  ];
  for (const [entity, location] of entities) {
    const written = lmsString(entity, SHEET_TAB_KEY);
    if (written === null) continue;
    const bad = [...new Set([...written].filter((char) => FORBIDDEN_IN_TAB.has(char)))].sort();
    if (bad.length) {
      issues.error(
        "lms.malformed",
        `${SHEET_TAB_KEY} '${written}' contains ${bad.join(" ")}, which Google Sheets will ` +
          "not accept in a tab name",
        location,
      );
    } else if (written.length > MAX_TAB_LENGTH) {
      issues.error(
        "lms.malformed",
        `${SHEET_TAB_KEY} is ${written.length} characters; Google Sheets allows ${MAX_TAB_LENGTH}`,
        location,
      );
    }
    // Only a tab someone wrote down can be pointless. A derived one costs nothing
    // and would otherwise warn on every assessment of every course.
    if (spreadsheet == null && entity !== run) {
      issues.warn(
        "lms.tab_without_sheet",
        `names a sheet tab '${written}' but ${run.course_version_id} has no ${SHEET_ID_KEY}, ` +
          "so there is no spreadsheet to write it into",
        location,
      );
    }
  }

  const owners = tabOwners(b, run.course_version_id);
  for (const tab of [...owners.keys()].sort()) {
    const claimants = owners.get(tab)!;
    if (claimants.length > 1) {
      issues.error(
        "lms.duplicate_tab",
        `tab '${tab}' is claimed by ${claimants.join(", ")}; each push rewrites a tab whole, ` +
          `so one would erase the other. Set extensions.lms.${SHEET_TAB_KEY} on one of them`,
        run.course_version_id,
      );
    }
  }

  // Two runs sharing one spreadsheet share its tab namespace, and derived names
  // repeat across runs by design — A04 in the autumn is A04 again in the spring.
  if (spreadsheet != null) {
    const ours = new Set(owners.keys());
    for (const other of b.versions as any[]) {
      if (other.course_version_id >= run.course_version_id) continue; // report once, from the later run
      if (lmsString(other, SHEET_ID_KEY) !== String(spreadsheet)) continue;
      const theirs = new Set(tabOwners(b, other.course_version_id).keys());
      const shared = [...ours].filter((tab) => theirs.has(tab)).sort();
      if (shared.length) {
        issues.error(
          "lms.duplicate_tab",
          `shares spreadsheet ${spreadsheet} with ${other.course_version_id} and both write ` +
            `${shared.join(", ")}. Use a spreadsheet per run, or set ` +
            `extensions.lms.${SHEET_TAB_KEY} to tell them apart`,
          run.course_version_id,
        );
      }
    }
  }
};

/**
 * The `extensions.lms` mapping that points an assessment at its Canvas column.
 *
 * A shared assignment id is an error: two assessments writing to one Canvas
 * column would silently overwrite each other.
 */
const checkLmsLinks = (b: CourseBundle, issues: IssueList): void => {
  const linkage = (entity: any, location: string): Record<string, unknown> => {
    const found = (entity.extensions ?? {})[LMS_EXTENSION];
    if (found == null) return {};
    if (typeof found !== "object" || Array.isArray(found)) {
      issues.error(
        "lms.malformed",
        `extensions.${LMS_EXTENSION} must be a mapping, not ${typeName(found)}`,
        location,
      );
      return {};
    }
    return found as Record<string, unknown>;
  };

  for (const run of b.versions as any[]) {
    const courseLink = linkage(run, run.course_version_id);

    // A target the professor named at onboarding, which this workspace may or may
    // not be able to reach. Saying so is the point: a setting that looks effective
    // and is not is worse than no setting.
    const target = courseLink[TARGET_KEY];
    if (target != null && !TARGETS.includes(String(target))) {
      // `notion` stays on this list now that `ainar notion push` exists, because
      // this message is about where *grades* can go and push publishes course
      // content. Dropping the warning would let `target: notion` read as a
      // working gradebook route.
      const extra =
        String(target) === "notion"
          ? " `ainar notion push` publishes course content to Notion, not grades."
          : "";
      issues.warn(
        "lms.unsupported_target",
        `'${target}' is recorded as this run's target, and nothing here can push grades to ` +
          `it. Supported: ${TARGETS.join(", ")}. Export a file and upload it by hand until ` +
          `an adapter exists.${extra}`,
        run.course_version_id,
      );
    }

    const courseId = courseLink[CANVAS_COURSE_KEY];
    if (courseId != null && !/^\d+$/.test(String(courseId))) {
      issues.error(
        "lms.malformed",
        `${CANVAS_COURSE_KEY} should be the numeric Canvas course id, not '${courseId}'`,
        run.course_version_id,
      );
    }

    // The subgroups this run actually has. A mapping keyed by anything else is
    // a typo binding a Canvas course to a cohort that does not exist, and at
    // push time it would read as "that subgroup has no Canvas course".
    const subgroups = groupsOf(b, run.course_version_id);

    /**
     * A `subgroup -> numeric id` mapping, checked and returned.
     *
     * Shared by the run's courses and each assessment's assignments, because
     * the three ways to get it wrong are the same for both: not a mapping, an
     * id that is not a number, and a subgroup label this run never had.
     */
    const readSubgroupMap = (
      holder: Record<string, unknown>,
      key: string,
      where: string,
      what: string,
    ): Map<string, string> => {
      const found = holder[key];
      const out = new Map<string, string>();
      if (found == null) return out;
      if (typeof found !== "object" || Array.isArray(found)) {
        issues.error(
          "lms.malformed",
          `extensions.lms.${key} must be a mapping of subgroup to ${what}, not ` +
            `${typeName(found)}`,
          where,
        );
        return out;
      }
      for (const [group, value] of Object.entries(found as Record<string, unknown>)) {
        if (!subgroups.includes(group)) {
          issues.error(
            "lms.unknown_subgroup",
            `${key} names the subgroup '${group}', which this run does not have. ` +
              (subgroups.length ? `It has: ${subgroups.join(", ")}` : "It has no subgroups"),
            where,
          );
          continue;
        }
        if (!/^\d+$/.test(String(value))) {
          issues.error(
            "lms.malformed",
            `${key}.${group} should be the numeric ${what}, not '${value}'`,
            where,
          );
          continue;
        }
        out.set(group, String(value));
      }
      return out;
    };

    const perGroupCourses = readSubgroupMap(
      courseLink,
      CANVAS_COURSES_KEY,
      run.course_version_id,
      "Canvas course id",
    );

    // One question, one answer. A run carrying both forms has two, and which
    // a push would use is not something to settle by precedence when the cost
    // of choosing wrong is one subgroup's marks in another cohort's course.
    if (courseId != null && courseLink[CANVAS_COURSES_KEY] != null) {
      issues.error(
        "lms.both_course_forms",
        `this run sets both ${CANVAS_COURSE_KEY} and ${CANVAS_COURSES_KEY}. Keep the ` +
          "first when the whole run is one Canvas course, the second when each " +
          "subgroup has its own — not both",
        run.course_version_id,
      );
    }

    if (perGroupCourses.size) {
      const missing = subgroups.filter((group) => !perGroupCourses.has(group)).sort();
      if (missing.length) {
        issues.warn(
          "lms.unmapped_subgroup",
          `${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no Canvas ` +
            `course in ${CANVAS_COURSES_KEY}, so nothing can be pushed for ` +
            `${missing.length === 1 ? "it" : "them"}`,
          run.course_version_id,
        );
      }
    }

    const assessments = assessmentsOf(b, run.course_version_id);
    // Keyed by `<course>:<assignment>`, because with a Canvas course per
    // subgroup the same assignment NUMBER can legitimately appear twice — two
    // shells number their assignments independently. What cannot happen twice
    // is one column in one course.
    const seen = new Map<string, string>();
    const linked: string[] = [];

    const claim = (courseKey: string, assignmentId: string, assessmentId: string): void => {
      const key = `${courseKey}:${assignmentId}`;
      const owner = seen.get(key);
      if (owner !== undefined && owner !== assessmentId) {
        issues.error(
          "lms.duplicate_link",
          `Canvas assignment ${assignmentId}` +
            (courseKey === "*" ? "" : ` in course ${courseKey}`) +
            ` is already claimed by ${owner}; two assessments cannot share one ` +
            "gradebook column",
          assessmentId,
        );
      } else {
        seen.set(key, assessmentId);
      }
    };

    for (const assessment of assessments) {
      const found = linkage(assessment, assessment.assessment_id);

      const perGroupAssignments = readSubgroupMap(
        found,
        CANVAS_ASSIGNMENTS_KEY,
        assessment.assessment_id,
        "Canvas assignment id",
      );
      if (perGroupAssignments.size) {
        linked.push(assessment.assessment_id);
        for (const [group, assignmentId] of perGroupAssignments) {
          claim(
            perGroupCourses.get(group) ?? String(courseId ?? "*"),
            assignmentId,
            assessment.assessment_id,
          );
        }
        const missing = subgroups.filter((group) => !perGroupAssignments.has(group)).sort();
        if (missing.length) {
          issues.warn(
            "lms.unmapped_subgroup",
            `${assessment.assessment_id} has no Canvas assignment for ${missing.join(", ")}`,
            assessment.assessment_id,
          );
        }
        continue;
      }

      const assignmentId = found[CANVAS_ASSIGNMENT_KEY];
      if (assignmentId == null) continue;
      if (!/^\d+$/.test(String(assignmentId))) {
        issues.error(
          "lms.malformed",
          `${CANVAS_ASSIGNMENT_KEY} should be the numeric Canvas assignment id, not ` +
            `'${assignmentId}'`,
          assessment.assessment_id,
        );
        continue;
      }
      // A single assignment id under a per-subgroup run would send every
      // cohort's marks to one column, in whichever course that id lives in.
      if (perGroupCourses.size) {
        issues.error(
          "lms.malformed",
          `${assessment.assessment_id} has a single ${CANVAS_ASSIGNMENT_KEY}, but this ` +
            "run has a Canvas course per subgroup. Each course numbers its " +
            `assignments separately, so this needs ${CANVAS_ASSIGNMENTS_KEY} keyed by ` +
            "subgroup",
          assessment.assessment_id,
        );
        continue;
      }
      linked.push(assessment.assessment_id);
      claim(String(courseId ?? "*"), String(assignmentId), assessment.assessment_id);
    }

    if (linked.length && linked.length < assessments.length) {
      const unlinked = assessments
        .filter((a) => !linked.includes(a.assessment_id))
        .map((a) => a.assessment_id)
        .sort();
      issues.warn(
        "lms.partial_links",
        `${linked.length} of ${assessments.length} assessments are linked to Canvas; ` +
          `${unlinked.join(", ")} cannot be exported by id`,
        run.course_version_id,
      );
    }

    checkSheetLinks(b, run, courseLink, issues);
  }
};

/** Notion ids appear both dashed and bare; comparing them is easier with the dashes gone. */
const normaliseNotionId = (value: string): string => value.replace(/-/g, "").trim().toLowerCase();

/**
 * The `extensions.notion` mapping that says which databases a run was pulled from.
 *
 * Nothing here can send a grade anywhere — the Notion path is read-only. What a
 * wrong id costs is a 404 at the point the professor wanted the pull, so the shape
 * is checked and a URL pasted in place of an id is caught, which is the mistake
 * that actually happens.
 */
const checkNotionLinks = (b: CourseBundle, issues: IssueList): void => {
  for (const run of b.versions as any[]) {
    const found = (run.extensions ?? {})[NOTION_EXTENSION];
    if (found == null) continue;
    if (typeof found !== "object" || Array.isArray(found)) {
      issues.error(
        "notion.malformed",
        `extensions.${NOTION_EXTENSION} must be a mapping, not ${typeName(found)}`,
        run.course_version_id,
      );
      continue;
    }
    const mapping = found as Record<string, unknown>;

    const unknown = Object.keys(mapping)
      .filter((key) => !NOTION_DATABASES.includes(key))
      .sort();
    if (unknown.length) {
      issues.warn(
        "notion.unknown_key",
        `nothing reads ${unknown.join(", ")}; expected ${[...NOTION_DATABASES].sort().join(", ")}`,
        run.course_version_id,
      );
    }

    for (const key of NOTION_DATABASES) {
      const value = mapping[key];
      if (value == null) continue;
      const asText = String(value);
      if (asText.includes("notion.so") || asText.startsWith("http")) {
        issues.warn(
          "notion.database_url",
          `${key} holds a URL; the id alone — the 32 characters before the '?v=' — is what ` +
            "the API wants",
          run.course_version_id,
        );
        continue;
      }
      const bare = normaliseNotionId(asText);
      if (bare.length !== 32 || ![...bare].every((char) => "0123456789abcdef".includes(char))) {
        issues.error(
          "notion.malformed",
          `${key} should be a 32-character Notion id, not '${asText}'`,
          run.course_version_id,
        );
      }
    }

    const missing = NOTION_DATABASES.filter((key) => !mapping[key]);
    if (missing.length && missing.length < NOTION_DATABASES.length) {
      issues.warn(
        "notion.partial",
        `${[...missing].sort().join(", ")} not recorded; \`notion pull\` reads what is there ` +
          "and reports the rest as absent",
        run.course_version_id,
      );
    }
  }
};

/**
 * Items and item responses. A faithful port of `_check_items`.
 *
 * "Items are optional, but an item that cannot be traced is worse than none."
 */
const checkItems = (b: CourseBundle, issues: IssueList): void => {
  const assessments = assessmentById(b);
  const outcomes = outcomeById(b);
  const concepts = conceptById(b);
  const rubrics = allRubrics(b);
  const criteria = criterionById(b);
  const itemModels = itemModelById(b);

  for (const item of b.items as any[]) {
    const assessment = assessments.get(item.assessment_id);
    if (assessment === undefined) {
      issues.error("ref.assessment", `unknown assessment ${item.assessment_id}`, item.item_id);
      continue;
    }

    if (item.item_model_id) {
      const model = itemModels.get(item.item_model_id);
      if (model === undefined) {
        issues.error("ref.item_model", `unknown item model ${item.item_model_id}`, item.item_id);
      } else {
        if (model.course_version_id !== assessment.course_version_id) {
          issues.error(
            "item.model_mismatch",
            `item model belongs to ${model.course_version_id}, not ${assessment.course_version_id}`,
            item.item_id,
          );
        }
        if (
          ((model.allowed_item_types as string[]) ?? []).length &&
          !(model.allowed_item_types as string[]).includes(item.type)
        ) {
          issues.warn(
            "item.model_mismatch",
            `${item.type} is not allowed by ${item.item_model_id}`,
            item.item_id,
          );
        }
        if (model.outcome_id && item.outcome_id !== model.outcome_id) {
          issues.warn(
            "item.model_mismatch",
            `item outcome ${item.outcome_id} differs from model outcome ${model.outcome_id}`,
            item.item_id,
          );
        }
        const tagged = new Set((item.concepts as string[]) ?? []);
        const missing = ((model.concepts as string[]) ?? []).filter((c) => !tagged.has(c)).sort();
        if (missing.length) {
          issues.warn(
            "item.model_mismatch",
            "item omits model concepts " + missing.join(", "),
            item.item_id,
          );
        }
      }
    }

    if (item.outcome_id && !outcomes.has(item.outcome_id)) {
      issues.error("ref.outcome", `unknown outcome ${item.outcome_id}`, item.item_id);
    }

    if (item.criterion_id) {
      if (!criteria.has(item.criterion_id)) {
        issues.error("ref.criterion", `unknown criterion ${item.criterion_id}`, item.item_id);
      } else {
        const rubric = assessment.rubric_id ? rubrics.get(assessment.rubric_id) : undefined;
        const owned = new Set(
          rubric ? ((rubric.criteria as any[]) ?? []).map((c) => c.criterion_id as string) : [],
        );
        if (!owned.has(item.criterion_id)) {
          issues.error(
            "ref.rubric",
            `criterion ${item.criterion_id} does not belong to the rubric of ${item.assessment_id}`,
            item.item_id,
          );
        }
      }
    }

    for (const conceptId of (item.concepts as string[]) ?? []) {
      if (!concepts.has(conceptId)) {
        issues.error("ref.concept", `unknown concept ${conceptId}`, item.item_id);
      }
    }
    for (const option of (item.options as any[]) ?? []) {
      const target = option.indicates_misconception_of;
      if (target && !concepts.has(target)) {
        issues.error(
          "ref.concept",
          `option '${option.label}' points at unknown concept ${target}`,
          item.item_id,
        );
      }
    }

    if (!((item.concepts as string[]) ?? []).length) {
      issues.warn(
        "item.no_concepts",
        "item is not tagged with any concept, so it cannot inform diagnosis",
        item.item_id,
      );
    }
    if (
      ["multiple_choice", "multiple_select", "true_false"].includes(item.type) &&
      !((item.options as any[]) ?? []).length
    ) {
      issues.warn("item.no_options", `${item.type} item has no options`, item.item_id);
    }
  }

  for (const assessment of b.assessments as any[]) {
    const items = itemsOf(b, assessment.assessment_id);
    if (!items.length) continue;

    const total = items.reduce((sum, item) => sum + (item.maximum_score as number), 0);
    if (Math.abs(total - assessment.maximum_score) > 0.01) {
      issues.warn(
        "item.score_mismatch",
        `items sum to ${g(total)} but maximum_score is ${g(assessment.maximum_score)}`,
        assessment.assessment_id,
      );
    }

    const numbers = items.filter((item) => item.number != null).map((item) => String(item.number));
    for (const duplicate of duplicates(numbers)) {
      issues.warn(
        "item.number_clash",
        `more than one item is numbered ${duplicate}`,
        assessment.assessment_id,
      );
    }

    // Items that feed a criterion have to add up to it. Otherwise the criterion
    // score derived from them is on a different scale from the criterion, and
    // totalling the rubric silently rescales the marks — which is how a student
    // ends up with a grade nobody intended.
    const perCriterion = new Map<string, number>();
    for (const item of items) {
      if (item.criterion_id) {
        perCriterion.set(
          item.criterion_id,
          (perCriterion.get(item.criterion_id) ?? 0) + (item.maximum_score as number),
        );
      }
    }
    for (const criterionId of [...perCriterion.keys()].sort()) {
      const criterion = criteria.get(criterionId);
      if (criterion === undefined) continue;
      const itemTotal = perCriterion.get(criterionId)!;
      if (Math.abs(itemTotal - criterion.maximum_score) > 0.01) {
        issues.warn(
          "item.criterion_score_mismatch",
          `items feeding this criterion sum to ${g(itemTotal)} but its maximum_score is ` +
            `${g(criterion.maximum_score)}, so an item-derived score would need rescaling`,
          criterionId,
        );
      }
    }
  }

  const items = itemById(b);
  const submissions = index(b.submissions as any[], "submission_id");
  for (const response of b.item_responses as any[]) {
    const item = items.get(response.item_id);
    const submission = submissions.get(response.submission_id);
    if (item === undefined) {
      issues.error("ref.item", `unknown item ${response.item_id}`, response.response_id);
    }
    if (submission === undefined) {
      issues.error(
        "ref.submission",
        `unknown submission ${response.submission_id}`,
        response.response_id,
      );
    }
    if (item !== undefined && submission !== undefined) {
      if (item.assessment_id !== submission.assessment_id) {
        issues.error(
          "ref.assessment",
          `item belongs to ${item.assessment_id} but the submission is for ` +
            `${submission.assessment_id}`,
          response.response_id,
        );
      }
      if (response.student_id !== submission.student_id) {
        issues.error(
          "response.student_mismatch",
          `response is for ${response.student_id} but ${response.submission_id} belongs to ` +
            `${submission.student_id}`,
          response.response_id,
        );
      }
    }
    if (item !== undefined) {
      if (response.score != null && response.score > item.maximum_score) {
        issues.error(
          "score.out_of_range",
          `score ${f(response.score)} exceeds item maximum ${f(item.maximum_score)}`,
          response.response_id,
        );
      }
      const labels = new Set(((item.options as any[]) ?? []).map((o) => o.label as string));
      for (const chosen of (response.chosen_options as string[]) ?? []) {
        if (labels.size && !labels.has(chosen)) {
          issues.error(
            "ref.option",
            `option '${chosen}' is not defined on ${item.item_id}`,
            response.response_id,
          );
        }
      }
    }
  }
};

/**
 * The runtime records: submissions, evaluations, evidence, states, signals,
 * interventions, events and the inbox. A faithful port of `_check_runtime`.
 *
 * These are the records `approve` writes, which makes them the ones the gate has
 * most reason to check before writing them.
 */
const checkRuntime = (b: CourseBundle, issues: IssueList): void => {
  const assessments = assessmentById(b);
  const submissions = index(b.submissions as any[], "submission_id");
  const criteria = criterionById(b);
  const outcomes = outcomeById(b);
  const capabilities = capabilityById(b);
  const concepts = conceptById(b);
  const runs = runById(b);
  const users = userById(b);
  const evidenceIds = new Set((b.evidence as any[]).map((e) => e.evidence_id as string));
  const signalIds = new Set((b.signals as any[]).map((s) => s.signal_id as string));
  const eventIds = new Set((b.events as any[]).map((e) => e.event_id as string));

  for (const submission of b.submissions as any[]) {
    if (!assessments.has(submission.assessment_id)) {
      issues.error(
        "ref.assessment",
        `unknown assessment ${submission.assessment_id}`,
        submission.submission_id,
      );
    }
  }

  for (const evaluation of b.evaluations as any[]) {
    if (!submissions.has(evaluation.submission_id)) {
      issues.error(
        "ref.submission",
        `unknown submission ${evaluation.submission_id}`,
        evaluation.evaluation_id,
      );
    }
    if (!criteria.has(evaluation.criterion_id)) {
      issues.error(
        "ref.criterion",
        `unknown criterion ${evaluation.criterion_id}`,
        evaluation.evaluation_id,
      );
    } else {
      const maximum = criteria.get(evaluation.criterion_id)!.maximum_score as number;
      for (const [label, side] of [
        ["ai_suggestion", evaluation.ai_suggestion],
        ["professor_decision", evaluation.professor_decision],
      ] as const) {
        if (side != null && side.score > maximum) {
          issues.error(
            "score.out_of_range",
            `${label} score ${f(side.score)} exceeds criterion maximum ${f(maximum)}`,
            evaluation.evaluation_id,
          );
        }
      }
    }

    const decided = ["approved", "overridden"].includes(evaluation.status);
    const decision = evaluation.professor_decision;
    if (decided && decision == null) {
      issues.error(
        "evaluation.unapproved",
        `status is ${evaluation.status} but there is no professor decision`,
        evaluation.evaluation_id,
      );
    } else if (decided) {
      // Both may be missing, and Python joins them with " or " rather than
      // reporting only the first — the professor needs to know what to add.
      const missing = (
        [
          ["decided_by", decision.decided_by],
          ["decided_at", decision.decided_at],
        ] as const
      )
        .filter(([, value]) => value == null)
        .map(([name]) => name);
      if (missing.length) {
        issues.error(
          "evaluation.unstamped",
          `status is ${evaluation.status} but the decision has no ${missing.join(" or ")} — ` +
            "approve it with `ainar approve` rather than editing by hand",
          evaluation.evaluation_id,
        );
      }
    } else if (decision != null) {
      issues.warn(
        "evaluation.pending_override",
        "a professor decision is present but the evaluation is not approved yet",
        evaluation.evaluation_id,
      );
    }
    if (evaluation.ai_suggestion && evaluation.ai_suggestion.provenance == null) {
      issues.warn("provenance.missing", "AI suggestion has no provenance", evaluation.evaluation_id);
    }
  }

  for (const item of b.evidence as any[]) {
    if (!runs.has(item.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${item.course_version_id}`,
        item.evidence_id,
      );
    }
    if (item.outcome_id && !outcomes.has(item.outcome_id)) {
      issues.error("ref.outcome", `unknown outcome ${item.outcome_id}`, item.evidence_id);
    }
    if (item.capability_id && !capabilities.has(item.capability_id)) {
      issues.error("ref.capability", `unknown capability ${item.capability_id}`, item.evidence_id);
    }
    if (item.concept_id && !concepts.has(item.concept_id)) {
      issues.error("ref.concept", `unknown concept ${item.concept_id}`, item.evidence_id);
    }
    if (!item.outcome_id && !item.capability_id && !item.concept_id) {
      issues.error(
        "evidence.untargeted",
        "evidence must name an outcome, capability or concept",
        item.evidence_id,
      );
    }
  }

  for (const state of b.concept_states as any[]) {
    const where = `${state.student_id}/${state.concept_id}`;
    if (!concepts.has(state.concept_id)) {
      issues.error("ref.concept", `unknown concept ${state.concept_id}`, where);
    }
    for (const reference of (state.evidence_ids as string[]) ?? []) {
      if (!evidenceIds.has(reference)) {
        issues.error("ref.evidence", `unknown evidence ${reference}`, where);
      }
    }
  }

  for (const state of b.capability_states as any[]) {
    const where = `${state.student_id}/${state.capability_id}`;
    if (!capabilities.has(state.capability_id)) {
      issues.error("ref.capability", `unknown capability ${state.capability_id}`, where);
    }
    if (state.course_version_id && !runs.has(state.course_version_id)) {
      issues.error("ref.course_run", `unknown course_version_id ${state.course_version_id}`, where);
    }
    for (const reference of (state.evidence_ids as string[]) ?? []) {
      if (!evidenceIds.has(reference)) {
        issues.error("ref.evidence", `unknown evidence ${reference}`, where);
      }
    }
    if (state.level != null && !((state.evidence_ids as string[]) ?? []).length) {
      issues.error(
        "capability.unevidenced",
        "a capability level with no evidence behind it is an assertion, not an estimate",
        where,
      );
    }
    const capability = capabilities.get(state.capability_id);
    if (capability && ((capability.levels as any[]) ?? []).length && state.level != null) {
      const highest = Math.max(
        ...(capability.levels as any[]).map((level) => level.level as number),
      );
      if (state.level > highest) {
        issues.error(
          "capability.level_out_of_range",
          `level ${state.level} exceeds the ${highest} levels defined for ${state.capability_id}`,
          where,
        );
      }
    }
  }

  for (const signal of b.signals as any[]) {
    if (!runs.has(signal.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${signal.course_version_id}`,
        signal.signal_id,
      );
    }
    for (const reference of (signal.evidence_ids as string[]) ?? []) {
      if (!evidenceIds.has(reference)) {
        issues.error("ref.evidence", `unknown evidence ${reference}`, signal.signal_id);
      }
    }
    if (!((signal.evidence_ids as string[]) ?? []).length) {
      issues.error(
        "signal.no_evidence",
        "a signal without evidence is an unexplained label",
        signal.signal_id,
      );
    }
  }

  for (const intervention of b.interventions as any[]) {
    if (!runs.has(intervention.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${intervention.course_version_id}`,
        intervention.intervention_id,
      );
    }
    if (intervention.signal_id && !signalIds.has(intervention.signal_id)) {
      issues.error(
        "ref.signal",
        `unknown signal ${intervention.signal_id}`,
        intervention.intervention_id,
      );
    }
    if (
      ["approved", "scheduled", "completed"].includes(intervention.status) &&
      !intervention.approved_by
    ) {
      issues.error(
        "intervention.unapproved",
        `status is ${intervention.status} but approved_by is empty`,
        intervention.intervention_id,
      );
    }
  }

  for (const event of b.events as any[]) {
    if (!runs.has(event.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${event.course_version_id}`,
        event.event_id,
      );
    }
  }

  for (const action of b.action_items as any[]) {
    if (!runs.has(action.course_version_id)) {
      issues.error(
        "ref.course_run",
        `unknown course_version_id ${action.course_version_id}`,
        action.action_id,
      );
    }
    if (!users.has(action.assigned_to)) {
      issues.error("ref.user", `unknown user ${action.assigned_to}`, action.action_id);
    }
    if (action.source_event_id && !eventIds.has(action.source_event_id)) {
      issues.error("ref.event", `unknown event ${action.source_event_id}`, action.action_id);
    }
  }
};

const checkNoDrafts = (b: CourseBundle, issues: IssueList): void => {
  for (const [collection, field] of ID_FIELDS) {
    for (const record of (b as any)[collection] as any[]) {
      if (String(record[field]).includes("-DRAFT-")) {
        issues.warn(
          "id.unapproved_draft",
          `${collection}: draft identifier in the course record — approve it with ` +
            "`ainar approve` rather than copying it",
          record[field],
        );
      }
    }
  }

  for (const [name, field] of [
    ["concepts", "concept_id"],
    ["modules", "module_id"],
  ] as const) {
    for (const record of (b as any)[name] as any[]) {
      const extensions = record.extensions ?? {};
      if ("proposal" in extensions && !("approval" in extensions)) {
        issues.warn(
          "claim.unapproved_proposal",
          `${name.slice(0, -1)} was proposed by an agent but carries no approval stamp — ` +
            "promote it with `ainar approve` rather than copying it",
          record[field],
        );
      }
    }
  }
};

export const validate = (
  b: CourseBundle,
  options: { draftsMerged?: boolean; root?: string } = {},
): IssueList => {
  const issues = new IssueList();
  checkDocuments(b, issues, options.root);
  checkDuplicates(b, issues);
  checkVersions(b, issues);
  checkConcepts(b, issues);
  checkConceptOwnership(b, issues);
  checkOutcomes(b, issues);
  checkModules(b, issues);
  checkRuns(b, issues);
  checkActivities(b, issues);
  checkPresentationPlans(b, issues);
  checkAssessments(b, issues);
  checkItemModels(b, issues);
  checkItems(b, issues);
  checkItemIntent(b, issues);
  checkDelivery(b, issues);
  checkLmsLinks(b, issues);
  checkNotionLinks(b, issues);
  checkResources(b, issues);
  checkRuntime(b, issues);
  checkStudentIdentifiers(b, issues);
  checkCoverage(b, issues);
  if (!options.draftsMerged) checkNoDrafts(b, issues);
  return issues;
};

/** The fixture shape: issues sorted the way `ainar golden` sorts them. */
export const validatePayload = (b: CourseBundle): { issues: Issue[] } => ({
  issues: [...validate(b).items].sort(
    (a, c) =>
      a.code.localeCompare(c.code) ||
      (a.location ?? "").localeCompare(c.location ?? "") ||
      a.message.localeCompare(c.message),
  ),
});
