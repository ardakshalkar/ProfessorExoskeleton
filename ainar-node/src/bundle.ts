/**
 * All canonical records belonging to one course. Ported from `ainar/bundle.py`.
 *
 * Only the collections and the serialisation are here. The indexes and derived
 * views (`course_context`, `assessments_of`, …) arrive with Phase 2 — see
 * `docs/node-migration.md`.
 */

import { z } from "zod";
import { Capability, Concept, ConceptEdge, Course, LearningOutcome, Module } from "./model/academic.ts";
import { Assessment, AssessmentItem, Evaluation, ItemModel, ItemResponse, Rubric, Submission } from "./model/assessment.ts";
import { Document } from "./model/content.ts";
import { CourseVersion, Enrollment, LearningActivity, Resource, User } from "./model/delivery.ts";
import { ActionItem, CourseEvent } from "./model/harness.ts";
import {
  Intervention,
  LearningEvidence,
  StudentCapabilityState,
  StudentConceptState,
  StudentSignal,
} from "./model/learning.ts";

/** Every list on the bundle, with the schema that validates its entries. */
export const COLLECTION_SCHEMAS = {
  outcomes: LearningOutcome,
  concepts: Concept,
  concept_edges: ConceptEdge,
  capabilities: Capability,
  modules: Module,
  users: User,
  versions: CourseVersion,
  enrollments: Enrollment,
  activities: LearningActivity,
  documents: Document,
  resources: Resource,
  assessments: Assessment,
  rubrics: Rubric,
  items: AssessmentItem,
  item_models: ItemModel,
  submissions: Submission,
  item_responses: ItemResponse,
  evaluations: Evaluation,
  evidence: LearningEvidence,
  concept_states: StudentConceptState,
  capability_states: StudentCapabilityState,
  signals: StudentSignal,
  interventions: Intervention,
  events: CourseEvent,
  action_items: ActionItem,
} as const;

export type CollectionName = keyof typeof COLLECTION_SCHEMAS;

export const COLLECTION_NAMES = Object.keys(COLLECTION_SCHEMAS) as CollectionName[];

export interface CourseBundle {
  course: z.infer<typeof Course>;
  outcomes: unknown[];
  concepts: unknown[];
  concept_edges: unknown[];
  capabilities: unknown[];
  modules: unknown[];
  users: unknown[];
  versions: unknown[];
  enrollments: unknown[];
  activities: unknown[];
  documents: unknown[];
  resources: unknown[];
  assessments: unknown[];
  rubrics: unknown[];
  items: unknown[];
  item_models: unknown[];
  submissions: unknown[];
  item_responses: unknown[];
  evaluations: unknown[];
  evidence: unknown[];
  concept_states: unknown[];
  capability_states: unknown[];
  signals: unknown[];
  interventions: unknown[];
  events: unknown[];
  action_items: unknown[];
}

/**
 * Drop nulls, recursively — pydantic's `model_dump(exclude_none=True)`.
 *
 * Empty objects and empty arrays are **kept**: `extensions: {}` and
 * `related: []` both appear in the fixtures, and dropping either would be a
 * different document.
 */
export const dropNulls = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (inner === null || inner === undefined) continue;
      out[key] = dropNulls(inner);
    }
    return out;
  }
  return value;
};

/** The canonical bundle as plain JSON-ready data. Mirrors `export.bundle_payload`. */
export const bundlePayload = (bundle: CourseBundle): Record<string, unknown> => ({
  format: "ainar.course-bundle",
  format_version: "1",
  course_id: bundle.course.course_id,
  ...(dropNulls(bundle) as Record<string, unknown>),
});

// --------------------------------------------------------------------------
// Indexes and selections
// --------------------------------------------------------------------------

const index = <T>(items: T[], key: string): Map<string, T> =>
  new Map(items.map((item) => [(item as any)[key] as string, item]));

export const versionById = (b: CourseBundle) => index(b.versions as any[], "course_version_id");
export const outcomeById = (b: CourseBundle) => index(b.outcomes as any[], "outcome_id");
export const conceptById = (b: CourseBundle) => index(b.concepts as any[], "concept_id");
export const capabilityById = (b: CourseBundle) => index(b.capabilities as any[], "capability_id");
export const moduleById = (b: CourseBundle) => index(b.modules as any[], "module_id");
export const runById = (b: CourseBundle) => index(b.versions as any[], "course_version_id");
export const assessmentById = (b: CourseBundle) => index(b.assessments as any[], "assessment_id");
export const resourceById = (b: CourseBundle) => index(b.resources as any[], "resource_id");
export const documentById = (b: CourseBundle) => index(b.documents as any[], "document_id");
export const userById = (b: CourseBundle) => index(b.users as any[], "user_id");
export const itemById = (b: CourseBundle) => index(b.items as any[], "item_id");
export const itemModelById = (b: CourseBundle) => index(b.item_models as any[], "item_model_id");

/** Standalone rubrics plus rubrics defined inline on assessments. */
export const allRubrics = (b: CourseBundle): Map<string, any> => {
  const rubrics = index(b.rubrics as any[], "rubric_id");
  for (const assessment of b.assessments as any[]) {
    if (assessment.rubric) rubrics.set(assessment.rubric.rubric_id, assessment.rubric);
  }
  return rubrics;
};

export const criterionById = (b: CourseBundle): Map<string, any> => {
  const found = new Map<string, any>();
  for (const rubric of allRubrics(b).values()) {
    for (const criterion of rubric.criteria ?? []) found.set(criterion.criterion_id, criterion);
  }
  return found;
};

export const itemsOf = (b: CourseBundle, assessmentId: string): any[] =>
  (b.items as any[])
    .filter((item) => item.assessment_id === assessmentId)
    .sort((a, c) => (a.number ?? 0) - (c.number ?? 0) || a.item_id.localeCompare(c.item_id));

export const latestVersion = (b: CourseBundle): any | null =>
  (b.versions as any[]).reduce<any | null>(
    (best, version) => (best === null || version.version > best.version ? version : best),
    null,
  );

export const modulesOf = (b: CourseBundle, courseId: string): any[] =>
  (b.modules as any[])
    .filter((module) => module.course_id === courseId)
    .sort(
      (a, c) =>
        (a.week ?? a.order ?? 0) - (c.week ?? c.order ?? 0) || a.module_id.localeCompare(c.module_id),
    );

export const outcomesOf = (b: CourseBundle, courseId: string): any[] =>
  (b.outcomes as any[]).filter((outcome) => outcome.course_id === courseId);

export const assessmentsOf = (b: CourseBundle, courseVersionId: string): any[] =>
  (b.assessments as any[]).filter((assessment) => assessment.course_version_id === courseVersionId);

export const activitiesOf = (b: CourseBundle, courseVersionId: string): any[] =>
  (b.activities as any[])
    .filter((activity) => activity.course_version_id === courseVersionId)
    .sort((a, c) => {
      // Unscheduled last, then by time, then by id — as the Python sort key does.
      if (!a.scheduled_at !== !c.scheduled_at) return a.scheduled_at ? -1 : 1;
      const byTime = (a.scheduled_at ?? "").localeCompare(c.scheduled_at ?? "");
      return byTime || a.activity_id.localeCompare(c.activity_id);
    });

export const enrollmentsOf = (b: CourseBundle, courseVersionId: string): any[] =>
  (b.enrollments as any[]).filter((enrollment) => enrollment.course_version_id === courseVersionId);

// ------------------------------------------------------------------- subgroups

/**
 * Subgroups, and the one place that decides what a subgroup view contains.
 *
 * A course taught in subgroups meets each of them separately, and the numbers
 * a professor wants are per subgroup: this Tuesday lab's gradebook, this
 * subgroup's progress. `Enrollment.group` and `LearningActivity.group` carry
 * the label; these three functions are what read it, so `gradebook`,
 * `class-progress` and `inbox` cannot drift into three different ideas of what
 * "group CS-01" means.
 *
 * An empty or absent list means the whole run, everywhere. That is what makes
 * the filter additive: every existing caller passes nothing and sees exactly
 * what it saw before.
 */

/** The roles a class-level report is about. An instructor is not in the class. */
export const ROSTER_ROLES: ReadonlySet<string> = new Set(["student", "auditor"]);

const asSet = (groups: readonly string[] | null | undefined): Set<string> | null => {
  const named = (groups ?? []).map((group) => group.trim()).filter(Boolean);
  return named.length ? new Set(named) : null;
};

/** A run's active enrollments, optionally narrowed to one or more subgroups. */
export const enrolledIn = (
  b: CourseBundle,
  courseVersionId: string,
  options: { roles?: ReadonlySet<string>; groups?: readonly string[] | null } = {},
): any[] => {
  const roles = options.roles ?? ROSTER_ROLES;
  const groups = asSet(options.groups);
  return enrollmentsOf(b, courseVersionId).filter(
    (enrollment) =>
      roles.has(enrollment.role) &&
      enrollment.status === "active" &&
      (groups === null || groups.has(String(enrollment.group ?? "").trim())),
  );
};

/**
 * A run's activities, optionally narrowed to one or more subgroups.
 *
 * An activity with no group is a meeting of the whole run, so it belongs in
 * every subgroup's view — a lecture both subgroups attend does not disappear
 * because you asked about one of them. Only a meeting labelled for a different
 * subgroup is filtered out.
 */
export const activitiesFor = (
  b: CourseBundle,
  courseVersionId: string,
  groups?: readonly string[] | null,
): any[] => {
  const wanted = asSet(groups);
  if (wanted === null) return activitiesOf(b, courseVersionId);
  return activitiesOf(b, courseVersionId).filter((activity) => {
    const group = String(activity.group ?? "").trim();
    return group === "" || wanted.has(group);
  });
};

/** Every subgroup label a run actually uses, from enrollments and meetings alike. */
export const groupsOf = (b: CourseBundle, courseVersionId: string): string[] => {
  const labels = new Set<string>();
  for (const enrollment of enrollmentsOf(b, courseVersionId)) {
    const group = String(enrollment.group ?? "").trim();
    if (group) labels.add(group);
  }
  for (const activity of activitiesOf(b, courseVersionId)) {
    const group = String(activity.group ?? "").trim();
    if (group) labels.add(group);
  }
  return [...labels].sort();
};

/**
 * Refuse a subgroup this run has never heard of.
 *
 * Without this a typo — `CS-1` for `CS-01` — is not an error but an empty
 * class: every count reads zero, every list is blank, and nothing says why.
 * Callers that accept a group from a person should run it through here first.
 */
export const requireGroups = (
  b: CourseBundle,
  courseVersionId: string,
  groups: readonly string[] | null | undefined,
): string[] => {
  const named = (groups ?? []).map((group) => group.trim()).filter(Boolean);
  if (!named.length) return [];
  const known = groupsOf(b, courseVersionId);
  const unknown = named.filter((group) => !known.includes(group));
  if (unknown.length) {
    throw new Error(
      `${courseVersionId} has no group ${unknown.map((group) => `'${group}'`).join(", ")}. ` +
        (known.length
          ? `Groups in this run: ${known.join(", ")}`
          : "This run has no subgroups: no enrollment or activity carries a group."),
    );
  }
  return named;
};

const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The module whose week contains `on`, counted from the run's start date. */
export const currentModule = (b: CourseBundle, courseVersionId: string, on: string): any | null => {
  const run = runById(b).get(courseVersionId);
  if (!run) return null;
  const week = Math.floor(daysBetween((run as any).start_date, on) / 7) + 1;
  return modulesOf(b, (b.course as any).course_id).find((module) => module.week === week) ?? null;
};

// --------------------------------------------------------------- context document

/**
 * The compact Course Context object the agents read.
 * Mirrors `CourseBundle.course_context`.
 */
export const courseContext = (b: CourseBundle, courseVersionId: string, on: string): Record<string, unknown> => {
  const run = runById(b).get(courseVersionId) as any;
  const versionId = run.course_version_id;
  const module = currentModule(b, courseVersionId, on) as any;

  const students = enrollmentsOf(b, courseVersionId).filter(
    (enrollment) =>
      ["student", "auditor"].includes(enrollment.role) && enrollment.status === "active",
  );
  const openSignals = (b.signals as any[]).filter(
    (signal) => signal.course_version_id === courseVersionId && signal.status === "open",
  );
  const pendingActions = (b.action_items as any[]).filter(
    (action) => action.course_version_id === courseVersionId && action.status === "pending",
  );
  const runAssessments = assessmentsOf(b, courseVersionId);
  const assessmentIds = new Set(runAssessments.map((assessment) => assessment.assessment_id));
  const submissionIds = new Set(
    (b.submissions as any[])
      .filter((submission) => assessmentIds.has(submission.assessment_id))
      .map((submission) => submission.submission_id),
  );

  return {
    course_run: {
      id: run.course_version_id,
      course_id: b.course.course_id,
      title: b.course.title,
      term: run.term,
      course_version_id: versionId,
      instructors: run.instructors,
      start_date: run.start_date,
      end_date: run.end_date,
    },
    learning_model: {
      outcomes: outcomesOf(b, (b.course as any).course_id).map((outcome) => ({
        id: outcome.outcome_id,
        title: outcome.title,
        level: outcome.level,
        weight: outcome.weight ?? null,
      })),
      concepts: (b.concepts as any[]).map((concept) => ({
        id: concept.concept_id,
        title: concept.title,
        prerequisites: concept.prerequisites,
      })),
      capabilities: (b.capabilities as any[]).map((capability) => ({
        id: capability.capability_id,
        title: capability.title,
      })),
    },
    current_module: module
      ? {
          id: module.module_id,
          title: module.title,
          week: module.week ?? null,
          outcomes: module.outcomes,
          concepts: module.concepts,
        }
      : null,
    active_assessments: runAssessments
      .filter((assessment) => !assessment.due_at || assessment.due_at.slice(0, 10) >= on)
      .map((assessment) => ({
        id: assessment.assessment_id,
        title: assessment.title,
        type: assessment.type,
        weight: assessment.weight ?? null,
        due_at: assessment.due_at ?? null,
        outcomes: assessment.outcomes,
      })),
    class_state: {
      enrolled_students: students.length,
      submissions_received: submissionIds.size,
      open_signals: openSignals.length,
      pending_professor_actions: pendingActions.length,
    },
    generated_for_date: on,
  };
};
