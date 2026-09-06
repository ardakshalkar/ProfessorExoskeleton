/**
 * Learning-state entities: what the student demonstrated, and what follows.
 * Ported from `ainar/model/learning.py`.
 */
import { z } from "zod";
export declare const LearningEvidence: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    evidence_id: z.ZodString;
    student_id: z.ZodString;
    course_version_id: z.ZodString;
    source_type: z.ZodString;
    source_id: z.ZodString;
    outcome_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    capability_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concept_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    demonstrated_level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    verified_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    recorded_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    course_version_id: string;
    student_id: string;
    evidence_id: string;
    source_type: string;
    source_id: string;
    outcome_id?: string | null | undefined;
    concept_id?: string | null | undefined;
    capability_id?: string | null | undefined;
    confidence?: number | null | undefined;
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    demonstrated_level?: number | null | undefined;
    verified_by?: string | null | undefined;
    recorded_at?: string | null | undefined;
}, {
    course_version_id: string;
    student_id: string;
    evidence_id: string;
    source_type: string;
    source_id: string;
    extensions?: Record<string, unknown> | undefined;
    outcome_id?: string | null | undefined;
    concept_id?: string | null | undefined;
    capability_id?: string | null | undefined;
    confidence?: number | null | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    demonstrated_level?: number | null | undefined;
    verified_by?: string | null | undefined;
    recorded_at?: string | Date | null | undefined;
}>;
export declare const StudentConceptState: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    student_id: z.ZodString;
    concept_id: z.ZodString;
    course_version_id: z.ZodString;
    state: z.ZodDefault<z.ZodEnum<["not_observed", "introduced", "developing", "demonstrated", "consistently_demonstrated", "needs_review"]>>;
    mastery_estimate: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    evidence_ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    last_updated_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    concept_id: string;
    course_version_id: string;
    student_id: string;
    state: "not_observed" | "introduced" | "developing" | "demonstrated" | "consistently_demonstrated" | "needs_review";
    evidence_ids: string[];
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    mastery_estimate?: number | null | undefined;
    last_updated_at?: string | null | undefined;
}, {
    concept_id: string;
    course_version_id: string;
    student_id: string;
    extensions?: Record<string, unknown> | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    state?: "not_observed" | "introduced" | "developing" | "demonstrated" | "consistently_demonstrated" | "needs_review" | undefined;
    mastery_estimate?: number | null | undefined;
    evidence_ids?: string[] | undefined;
    last_updated_at?: string | Date | null | undefined;
}>;
export declare const StudentCapabilityState: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    student_id: z.ZodString;
    capability_id: z.ZodString;
    course_version_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    source_count: z.ZodDefault<z.ZodNumber>;
    evidence_ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    verified_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_updated_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    capability_id: string;
    student_id: string;
    evidence_ids: string[];
    source_count: number;
    level?: number | null | undefined;
    course_version_id?: string | null | undefined;
    confidence?: number | null | undefined;
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    verified_by?: string | null | undefined;
    last_updated_at?: string | null | undefined;
}, {
    capability_id: string;
    student_id: string;
    extensions?: Record<string, unknown> | undefined;
    level?: number | null | undefined;
    course_version_id?: string | null | undefined;
    confidence?: number | null | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    verified_by?: string | null | undefined;
    evidence_ids?: string[] | undefined;
    last_updated_at?: string | Date | null | undefined;
    source_count?: number | undefined;
}>;
export declare const StudentSignal: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    signal_id: z.ZodString;
    student_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    course_version_id: z.ZodString;
    type: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    description: z.ZodString;
    evidence_ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["open", "acknowledged", "resolved", "dismissed"]>>;
    detected_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    provenance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }>>>;
}, "strict", z.ZodTypeAny, {
    type: string;
    status: "open" | "acknowledged" | "resolved" | "dismissed";
    extensions: Record<string, unknown>;
    description: string;
    concepts: string[];
    course_version_id: string;
    evidence_ids: string[];
    signal_id: string;
    severity: "medium" | "low" | "high";
    student_id?: string | null | undefined;
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    detected_at?: string | null | undefined;
}, {
    type: string;
    description: string;
    course_version_id: string;
    signal_id: string;
    status?: "open" | "acknowledged" | "resolved" | "dismissed" | undefined;
    extensions?: Record<string, unknown> | undefined;
    concepts?: string[] | undefined;
    student_id?: string | null | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    evidence_ids?: string[] | undefined;
    severity?: "medium" | "low" | "high" | undefined;
    detected_at?: string | Date | null | undefined;
}>;
export declare const Intervention: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    intervention_id: z.ZodString;
    signal_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    student_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    course_version_id: z.ZodString;
    type: z.ZodString;
    description: z.ZodString;
    proposed_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    approved_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<["proposed", "approved", "scheduled", "completed", "cancelled"]>>;
    scheduled_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    completed_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    effectiveness_note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    type: string;
    status: "approved" | "scheduled" | "completed" | "cancelled" | "proposed";
    extensions: Record<string, unknown>;
    description: string;
    course_version_id: string;
    intervention_id: string;
    student_id?: string | null | undefined;
    approved_by?: string | null | undefined;
    scheduled_at?: string | null | undefined;
    signal_id?: string | null | undefined;
    proposed_by?: string | null | undefined;
    completed_at?: string | null | undefined;
    effectiveness_note?: string | null | undefined;
}, {
    type: string;
    description: string;
    course_version_id: string;
    intervention_id: string;
    status?: "approved" | "scheduled" | "completed" | "cancelled" | "proposed" | undefined;
    extensions?: Record<string, unknown> | undefined;
    student_id?: string | null | undefined;
    approved_by?: string | null | undefined;
    scheduled_at?: string | Date | null | undefined;
    signal_id?: string | null | undefined;
    proposed_by?: string | null | undefined;
    completed_at?: string | Date | null | undefined;
    effectiveness_note?: string | null | undefined;
}>;
