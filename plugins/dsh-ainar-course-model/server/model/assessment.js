/**
 * How learning is measured: assessments, rubrics, criteria, items, evaluations.
 * Ported from `ainar/model/assessment.py`.
 *
 * `Evaluation` is the one to read carefully: `ai_suggestion` and
 * `professor_decision` sit beside each other and neither replaces the other.
 */
import { z } from "zod";
import { AssessmentId, AssessmentType, CapabilityId, ConceptId, Confidence, CourseVersionId, CriterionId, DeliveryChannel, DocumentId, ItemDifficulty, ItemRole, EvaluationId, EvaluationStatus, EvidenceRef, ItemId, ItemModelId, CHOICE_ITEM_TYPES, ItemType, ModuleId, OutcomeId, Provenance, ResponseId, RubricId, StudentId, SubmissionFormat, SubmissionId, SubmissionStatus, UserId, Weight, CognitiveLevel, awareDatetime, entity, } from "./common.js";
export const AssessmentBlueprintCell = entity({
    outcome_id: OutcomeId,
    cognitive_level: CognitiveLevel,
    difficulty: ItemDifficulty,
    item_type: ItemType,
    item_count: z.number().int().min(1),
    marks: z.number().gt(0),
});
export const AssessmentDesign = entity({
    purpose: z.string(),
    duration_minutes: z.number().int().gt(0).nullish(),
    target_item_count: z.number().int().min(1).nullish(),
    cells: z.array(AssessmentBlueprintCell).default([]),
    constraints: z.record(z.string(), z.unknown()).default({}),
});
const ScenarioValue = z.union([z.string(), z.number()]);
export const ItemModel = entity({
    item_model_id: ItemModelId,
    course_version_id: CourseVersionId,
    title: z.string(),
    outcome_id: OutcomeId.nullish(),
    capability_id: CapabilityId.nullish(),
    concepts: z.array(ConceptId).default([]),
    cognitive_level: CognitiveLevel,
    evidence_requirements: z.array(z.string()).min(1),
    task_structure: z.array(z.string()).min(1),
    scenario_variables: z.record(z.string(), z.array(ScenarioValue)).default({}),
    difficulty_features: z.record(z.string(), z.record(z.string(), ScenarioValue)).default({}),
    misconceptions: z.array(ConceptId).default([]),
    answer_requirements: z.array(z.string()).default([]),
    allowed_item_types: z.array(ItemType).default([]),
}).superRefine((value, ctx) => {
    if (!value.outcome_id && !value.capability_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "an item model must name an outcome_id or capability_id" });
    }
});
export const CriterionLevel = entity({
    score: z.number().min(0),
    label: z.string().nullish(),
    description: z.string(),
});
export const RubricCriterion = entity({
    criterion_id: CriterionId,
    rubric_id: RubricId,
    title: z.string(),
    description: z.string().nullish(),
    maximum_score: z.number().gt(0),
    weight: Weight.nullish(),
    outcome_id: OutcomeId.nullish(),
    capability_id: CapabilityId.nullish(),
    concepts: z.array(z.string()).default([]),
    levels: z.array(CriterionLevel).default([]),
});
export const Rubric = entity({
    rubric_id: RubricId,
    title: z.string().nullish(),
    description: z.string().nullish(),
    criteria: z.array(RubricCriterion).default([]),
});
export const Assessment = entity({
    assessment_id: AssessmentId,
    course_version_id: CourseVersionId,
    title: z.string(),
    type: AssessmentType,
    description: z.string().nullish(),
    module_id: ModuleId.nullish(),
    maximum_score: z.number().gt(0).default(100),
    weight: Weight.nullish(),
    opens_at: awareDatetime().nullish(),
    due_at: awareDatetime().nullish(),
    outcomes: z.array(OutcomeId).default([]),
    rubric_id: RubricId.nullish(),
    rubric: Rubric.nullish(),
    submission_type: z.array(SubmissionFormat).default([]),
    delivery: DeliveryChannel.nullish(),
    instructions_document_id: DocumentId.nullish(),
    settings: z.record(z.string(), z.unknown()).default({}),
    design: AssessmentDesign.nullish(),
})
    // An inline rubric fills in `rubric_id`, and contradicting it is an error.
    // Ported from `_rubric_consistency`; without it every assessment carrying an
    // inline rubric loses its `rubric_id` in the payload.
    .superRefine((value, ctx) => {
    if (value.rubric && value.rubric_id && value.rubric_id !== value.rubric.rubric_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${value.assessment_id}: rubric_id ${value.rubric_id} does not match inline rubric ${value.rubric.rubric_id}`,
        });
    }
})
    .transform((value) => {
    if (value.rubric && !value.rubric_id) {
        return { ...value, rubric_id: value.rubric.rubric_id };
    }
    return value;
});
export const ItemOption = entity({
    label: z.string(),
    text: z.string(),
    correct: z.boolean().default(false),
    indicates_misconception_of: ConceptId.nullish(),
    note: z.string().nullish(),
});
export const AssessmentItem = entity({
    item_id: ItemId,
    assessment_id: AssessmentId,
    item_model_id: ItemModelId.nullish(),
    type: ItemType,
    prompt: z.string(),
    number: z.number().int().min(1).nullish(),
    // `0` is allowed, and is how an unmarked question is written — typically a
    // `preparation` item whose answer is worth recording and whose marks are not
    // the point. Anything dividing by this has to guard for it.
    maximum_score: z.number().gte(0).default(1),
    role: ItemRole.default("main"),
    difficulty: ItemDifficulty.nullish(),
    outcome_id: OutcomeId.nullish(),
    criterion_id: CriterionId.nullish(),
    concepts: z.array(ConceptId).default([]),
    options: z.array(ItemOption).default([]),
    answer_key: z.string().nullish(),
    marking_guidance: z.string().nullish(),
})
    // Ported from `_choice_items_need_an_answer`. An unanswerable choice item is
    // one that `ainar score-items` would have to guess at, so it is refused here.
    .superRefine((value, ctx) => {
    const fail = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.item_id}: ${message}` });
    const labels = value.options.map((option) => option.label);
    const duplicates = [...new Set(labels.filter((label, i) => labels.indexOf(label) !== i))].sort();
    if (duplicates.length)
        fail(`duplicate option labels ${JSON.stringify(duplicates)}`);
    if (value.options.length && CHOICE_ITEM_TYPES.has(value.type)) {
        const correct = value.options.filter((option) => option.correct).length;
        if (!correct)
            fail("no option is marked correct");
        else if (value.type !== "multiple_select" && correct > 1) {
            fail(`${correct} options marked correct on a ${value.type} item`);
        }
    }
});
export const ItemResponse = entity({
    response_id: ResponseId,
    submission_id: SubmissionId,
    item_id: ItemId,
    student_id: StudentId,
    chosen_options: z.array(z.string()).default([]),
    raw_response: z.string().nullish(),
    score: z.number().min(0).nullish(),
    correct: z.boolean().nullish(),
    scored_by: z.string().nullish(),
    responded_at: awareDatetime().nullish(),
});
export const SubmissionFile = entity({
    document_id: DocumentId,
    type: SubmissionFormat,
});
export const Submission = entity({
    submission_id: SubmissionId,
    assessment_id: AssessmentId,
    student_id: StudentId,
    submitted_at: awareDatetime().nullish(),
    files: z.array(SubmissionFile).default([]),
    status: SubmissionStatus.default("submitted"),
    attempt: z.number().int().min(1).default(1),
    note: z.string().nullish(),
});
export const AiSuggestion = entity({
    score: z.number(),
    confidence: Confidence.nullish(),
    comment: z.string().nullish(),
    evidence: z.array(EvidenceRef).default([]),
    provenance: Provenance.nullish(),
});
export const ProfessorDecision = entity({
    score: z.number(),
    comment: z.string().nullish(),
    decided_by: UserId.nullish(),
    decided_at: awareDatetime().nullish(),
});
export const Evaluation = entity({
    evaluation_id: EvaluationId,
    submission_id: SubmissionId,
    criterion_id: CriterionId,
    ai_suggestion: AiSuggestion.nullish(),
    professor_decision: ProfessorDecision.nullish(),
    status: EvaluationStatus.default("suggested"),
});
