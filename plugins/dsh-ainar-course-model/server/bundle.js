/**
 * All canonical records belonging to one course. Ported from `ainar/bundle.py`.
 *
 * Only the collections and the serialisation are here. The indexes and derived
 * views (`course_context`, `assessments_of`, …) arrive with Phase 2 — see
 * `docs/node-migration.md`.
 */
import { Capability, Concept, ConceptEdge, LearningOutcome, Module } from "./model/academic.js";
import { Assessment, AssessmentItem, Evaluation, ItemModel, ItemResponse, Rubric, Submission } from "./model/assessment.js";
import { Document } from "./model/content.js";
import { CourseVersion, Enrollment, LearningActivity, Resource, User } from "./model/delivery.js";
import { ActionItem, CourseEvent } from "./model/harness.js";
import { Intervention, LearningEvidence, StudentCapabilityState, StudentConceptState, StudentSignal, } from "./model/learning.js";
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
};
export const COLLECTION_NAMES = Object.keys(COLLECTION_SCHEMAS);
/**
 * Drop nulls, recursively — pydantic's `model_dump(exclude_none=True)`.
 *
 * Empty objects and empty arrays are **kept**: `extensions: {}` and
 * `related: []` both appear in the fixtures, and dropping either would be a
 * different document.
 */
export const dropNulls = (value) => {
    if (Array.isArray(value))
        return value.map(dropNulls);
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            if (inner === null || inner === undefined)
                continue;
            out[key] = dropNulls(inner);
        }
        return out;
    }
    return value;
};
/** The canonical bundle as plain JSON-ready data. Mirrors `export.bundle_payload`. */
export const bundlePayload = (bundle) => ({
    format: "ainar.course-bundle",
    format_version: "1",
    course_id: bundle.course.course_id,
    ...dropNulls(bundle),
});
// --------------------------------------------------------------------------
// Indexes and selections
// --------------------------------------------------------------------------
const index = (items, key) => new Map(items.map((item) => [item[key], item]));
export const versionById = (b) => index(b.versions, "course_version_id");
export const outcomeById = (b) => index(b.outcomes, "outcome_id");
export const conceptById = (b) => index(b.concepts, "concept_id");
export const capabilityById = (b) => index(b.capabilities, "capability_id");
export const moduleById = (b) => index(b.modules, "module_id");
export const runById = (b) => index(b.versions, "course_version_id");
export const assessmentById = (b) => index(b.assessments, "assessment_id");
export const resourceById = (b) => index(b.resources, "resource_id");
export const documentById = (b) => index(b.documents, "document_id");
export const userById = (b) => index(b.users, "user_id");
export const itemById = (b) => index(b.items, "item_id");
export const itemModelById = (b) => index(b.item_models, "item_model_id");
/** Standalone rubrics plus rubrics defined inline on assessments. */
export const allRubrics = (b) => {
    const rubrics = index(b.rubrics, "rubric_id");
    for (const assessment of b.assessments) {
        if (assessment.rubric)
            rubrics.set(assessment.rubric.rubric_id, assessment.rubric);
    }
    return rubrics;
};
export const criterionById = (b) => {
    const found = new Map();
    for (const rubric of allRubrics(b).values()) {
        for (const criterion of rubric.criteria ?? [])
            found.set(criterion.criterion_id, criterion);
    }
    return found;
};
export const itemsOf = (b, assessmentId) => b.items
    .filter((item) => item.assessment_id === assessmentId)
    .sort((a, c) => (a.number ?? 0) - (c.number ?? 0) || a.item_id.localeCompare(c.item_id));
export const latestVersion = (b) => b.versions.reduce((best, version) => (best === null || version.version > best.version ? version : best), null);
export const modulesOf = (b, courseId) => b.modules
    .filter((module) => module.course_id === courseId)
    .sort((a, c) => (a.week ?? a.order ?? 0) - (c.week ?? c.order ?? 0) || a.module_id.localeCompare(c.module_id));
export const outcomesOf = (b, courseId) => b.outcomes.filter((outcome) => outcome.course_id === courseId);
export const assessmentsOf = (b, courseVersionId) => b.assessments.filter((assessment) => assessment.course_version_id === courseVersionId);
export const activitiesOf = (b, courseVersionId) => b.activities
    .filter((activity) => activity.course_version_id === courseVersionId)
    .sort((a, c) => {
    // Unscheduled last, then by time, then by id — as the Python sort key does.
    if (!a.scheduled_at !== !c.scheduled_at)
        return a.scheduled_at ? -1 : 1;
    const byTime = (a.scheduled_at ?? "").localeCompare(c.scheduled_at ?? "");
    return byTime || a.activity_id.localeCompare(c.activity_id);
});
export const enrollmentsOf = (b, courseVersionId) => b.enrollments.filter((enrollment) => enrollment.course_version_id === courseVersionId);
const daysBetween = (from, to) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** The module whose week contains `on`, counted from the run's start date. */
export const currentModule = (b, courseVersionId, on) => {
    const run = runById(b).get(courseVersionId);
    if (!run)
        return null;
    const week = Math.floor(daysBetween(run.start_date, on) / 7) + 1;
    return modulesOf(b, b.course.course_id).find((module) => module.week === week) ?? null;
};
// --------------------------------------------------------------- context document
/**
 * The compact Course Context object the agents read.
 * Mirrors `CourseBundle.course_context`.
 */
export const courseContext = (b, courseVersionId, on) => {
    const run = runById(b).get(courseVersionId);
    const versionId = run.course_version_id;
    const module = currentModule(b, courseVersionId, on);
    const students = enrollmentsOf(b, courseVersionId).filter((enrollment) => ["student", "auditor"].includes(enrollment.role) && enrollment.status === "active");
    const openSignals = b.signals.filter((signal) => signal.course_version_id === courseVersionId && signal.status === "open");
    const pendingActions = b.action_items.filter((action) => action.course_version_id === courseVersionId && action.status === "pending");
    const runAssessments = assessmentsOf(b, courseVersionId);
    const assessmentIds = new Set(runAssessments.map((assessment) => assessment.assessment_id));
    const submissionIds = new Set(b.submissions
        .filter((submission) => assessmentIds.has(submission.assessment_id))
        .map((submission) => submission.submission_id));
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
            outcomes: outcomesOf(b, b.course.course_id).map((outcome) => ({
                id: outcome.outcome_id,
                title: outcome.title,
                level: outcome.level,
                weight: outcome.weight ?? null,
            })),
            concepts: b.concepts.map((concept) => ({
                id: concept.concept_id,
                title: concept.title,
                prerequisites: concept.prerequisites,
            })),
            capabilities: b.capabilities.map((capability) => ({
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
