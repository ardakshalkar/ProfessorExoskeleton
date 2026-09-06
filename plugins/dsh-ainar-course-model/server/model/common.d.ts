/**
 * Identifier patterns, enums and the base every entity extends.
 *
 * Ported from `ainar/model/common.py`. Three properties from the Python side
 * have to survive the translation, and each is easy to lose quietly:
 *
 * 1. `extra="forbid"` becomes `.strict()`. A typo in authored YAML is a loud
 *    error, not an ignored key — so `entity()` applies it rather than leaving
 *    it to each schema to remember.
 * 2. Identifier patterns are anchored at both ends. `^…$`, always.
 * 3. Timestamps are timezone-aware. JavaScript's `Date` cannot tell a naive
 *    string from an aware one, so the offset is checked before parsing and the
 *    original text is kept — see `awareDatetime`.
 */
import { z } from "zod";
/** Anchored at both ends, exactly as `_id()` does in Python. */
export declare const id: (pattern: string) => z.ZodString;
export declare const CourseId: z.ZodString;
export declare const CourseVersionId: z.ZodString;
export declare const TermId: z.ZodString;
export declare const OutcomeId: z.ZodString;
export declare const ConceptId: z.ZodString;
export declare const CapabilityId: z.ZodString;
export declare const ModuleId: z.ZodString;
export declare const ActivityId: z.ZodString;
export declare const AssessmentId: z.ZodString;
export declare const RubricId: z.ZodString;
export declare const CriterionId: z.ZodString;
export declare const ItemId: z.ZodString;
export declare const ItemModelId: z.ZodString;
export declare const ResponseId: z.ZodString;
export declare const ResourceId: z.ZodString;
export declare const DocumentId: z.ZodString;
export declare const UserId: z.ZodString;
export declare const StudentId: z.ZodString;
export declare const EnrollmentId: z.ZodString;
export declare const SubmissionId: z.ZodString;
export declare const EvaluationId: z.ZodString;
export declare const EvidenceId: z.ZodString;
export declare const SignalId: z.ZodString;
export declare const InterventionId: z.ZodString;
export declare const ActionId: z.ZodString;
export declare const EventId: z.ZodString;
export declare const Weight: z.ZodNumber;
export declare const Confidence: z.ZodNumber;
export declare const awareDatetime: () => z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
export declare const plainDate: () => z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
export declare const CourseStatus: z.ZodEnum<["draft", "active", "retired"]>;
export declare const VersionStatus: z.ZodEnum<["draft", "in_review", "approved", "superseded"]>;
export declare const RunStatus: z.ZodEnum<["planned", "scheduled", "running", "completed", "cancelled"]>;
export declare const CognitiveLevel: z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>;
export declare const ConceptRelationship: z.ZodEnum<["prerequisite_of", "related_to", "part_of", "refines"]>;
export declare const ActivityType: z.ZodEnum<["lecture", "lab", "seminar", "discussion", "reading", "exercise", "project_work", "field_work", "review", "other"]>;
export declare const AssessmentType: z.ZodEnum<["assignment", "quiz", "exam", "project", "presentation", "oral_defense", "participation", "other"]>;
export declare const ItemType: z.ZodEnum<["multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "essay", "code", "practical", "other"]>;
export declare const CHOICE_ITEM_TYPES: Set<string>;
export declare const SubmissionFormat: z.ZodEnum<["pdf", "docx", "pptx", "notebook", "code_repo", "audio", "video", "image", "url", "text", "oral_defense"]>;
/** How hard an item is *meant* to be, as against the rate score-items observes. */
export declare const ItemDifficulty: z.ZodEnum<["easy", "medium", "complex"]>;
/** Where an item sits relative to its task. `preparation` is skipped by extract-evidence. */
export declare const ItemRole: z.ZodEnum<["preparation", "main", "followup"]>;
/** Where the work arrives, as against what shape it is in. See DeliveryChannel in Python. */
export declare const DeliveryChannel: z.ZodEnum<["canvas_upload", "github_repo", "paper_exam", "oral_defense", "presentation", "instructor_collected", "other"]>;
export declare const SubmissionStatus: z.ZodEnum<["missing", "draft", "submitted", "late", "resubmitted", "withdrawn"]>;
export declare const EvaluationStatus: z.ZodEnum<["suggested", "in_review", "approved", "overridden"]>;
export declare const ConceptStateValue: z.ZodEnum<["not_observed", "introduced", "developing", "demonstrated", "consistently_demonstrated", "needs_review"]>;
export declare const Severity: z.ZodEnum<["low", "medium", "high"]>;
export declare const SignalStatus: z.ZodEnum<["open", "acknowledged", "resolved", "dismissed"]>;
export declare const InterventionStatus: z.ZodEnum<["proposed", "approved", "scheduled", "completed", "cancelled"]>;
export declare const Priority: z.ZodEnum<["low", "medium", "high", "urgent"]>;
export declare const ActionStatus: z.ZodEnum<["pending", "in_progress", "done", "dismissed"]>;
export declare const EnrollmentRole: z.ZodEnum<["student", "auditor", "instructor", "teaching_assistant", "observer"]>;
export declare const EnrollmentStatus: z.ZodEnum<["active", "dropped", "completed", "pending"]>;
export declare const ResourceKind: z.ZodEnum<["slides", "reading", "dataset", "notebook", "video", "link", "textbook_chapter", "tool", "other"]>;
/** Whitespace-stripped strings, as `str_strip_whitespace=True` does. */
export declare const trimmed: z.ZodEffects<z.ZodString, string, string>;
/**
 * Every canonical entity: unknown keys refused, `extensions` always present.
 *
 * `.strict()` is the whole of `extra="forbid"`, and applying it here rather
 * than per-schema is deliberate — one schema forgetting it would lose the
 * property for that entity with nothing to show for it.
 */
export declare const entity: <T extends z.ZodRawShape>(shape: T) => z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & T, "strict", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & T>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & T> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const Provenance: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    produced_by: z.ZodString;
    model_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflow_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    prompt_version: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    input_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    created_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
}, "strict", z.ZodTypeAny, {
    produced_by: string;
    input_refs: string[];
    extensions: Record<string, unknown>;
    model_id?: string | null | undefined;
    workflow_version?: string | null | undefined;
    prompt_version?: string | null | undefined;
    created_at?: string | null | undefined;
}, {
    produced_by: string;
    model_id?: string | null | undefined;
    workflow_version?: string | null | undefined;
    prompt_version?: string | null | undefined;
    input_refs?: string[] | undefined;
    created_at?: string | Date | null | undefined;
    extensions?: Record<string, unknown> | undefined;
}>;
export declare const EvidenceRef: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    text_reference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    document_id?: string | null | undefined;
    location?: string | null | undefined;
    text_reference?: string | null | undefined;
    source_ref?: string | null | undefined;
}, {
    extensions?: Record<string, unknown> | undefined;
    document_id?: string | null | undefined;
    location?: string | null | undefined;
    text_reference?: string | null | undefined;
    source_ref?: string | null | undefined;
}>;
