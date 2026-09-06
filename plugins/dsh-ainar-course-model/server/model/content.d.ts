/**
 * The content group: the files behind the course.
 * Ported from `ainar/model/content.py`.
 */
import { z } from "zod";
export declare const SlideSpecification: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    number: z.ZodNumber;
    type: z.ZodString;
    title: z.ZodString;
    minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    required_visual: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    number: number;
    type: string;
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    outcomes: string[];
    purpose?: string | null | undefined;
    minutes?: number | null | undefined;
    required_visual?: string | null | undefined;
}, {
    number: number;
    type: string;
    title: string;
    extensions?: Record<string, unknown> | undefined;
    concepts?: string[] | undefined;
    outcomes?: string[] | undefined;
    purpose?: string | null | undefined;
    minutes?: number | null | undefined;
    required_visual?: string | null | undefined;
}>;
export declare const PresentationPlan: z.ZodEffects<z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    audience: z.ZodString;
    style: z.ZodString;
    duration_minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_slides: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    slides: z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        number: z.ZodNumber;
        type: z.ZodString;
        title: z.ZodString;
        minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        required_visual: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        number: number;
        type: string;
        extensions: Record<string, unknown>;
        title: string;
        concepts: string[];
        outcomes: string[];
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }, {
        number: number;
        type: string;
        title: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    slides: {
        number: number;
        type: string;
        extensions: Record<string, unknown>;
        title: string;
        concepts: string[];
        outcomes: string[];
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }[];
    extensions: Record<string, unknown>;
    concepts: string[];
    outcomes: string[];
    audience: string;
    style: string;
    duration_minutes?: number | null | undefined;
    max_slides?: number | null | undefined;
}, {
    slides: {
        number: number;
        type: string;
        title: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }[];
    audience: string;
    style: string;
    extensions?: Record<string, unknown> | undefined;
    concepts?: string[] | undefined;
    outcomes?: string[] | undefined;
    duration_minutes?: number | null | undefined;
    max_slides?: number | null | undefined;
}>, {
    slides: {
        number: number;
        type: string;
        extensions: Record<string, unknown>;
        title: string;
        concepts: string[];
        outcomes: string[];
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }[];
    extensions: Record<string, unknown>;
    concepts: string[];
    outcomes: string[];
    audience: string;
    style: string;
    duration_minutes?: number | null | undefined;
    max_slides?: number | null | undefined;
}, {
    slides: {
        number: number;
        type: string;
        title: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        purpose?: string | null | undefined;
        minutes?: number | null | undefined;
        required_visual?: string | null | undefined;
    }[];
    audience: string;
    style: string;
    extensions?: Record<string, unknown> | undefined;
    concepts?: string[] | undefined;
    outcomes?: string[] | undefined;
    duration_minutes?: number | null | undefined;
    max_slides?: number | null | undefined;
}>;
export declare const Document: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    document_id: z.ZodString;
    title: z.ZodString;
    storage_key: z.ZodString;
    mime_type: z.ZodString;
    original_filename: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    size_bytes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    checksum: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    uploaded_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    course_version_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    course_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    module_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    version: z.ZodDefault<z.ZodNumber>;
    supersedes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    generated_by: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    presentation_plan: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        audience: z.ZodString;
        style: z.ZodString;
        duration_minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max_slides: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        slides: z.ZodArray<z.ZodObject<{
            extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        } & {
            number: z.ZodNumber;
            type: z.ZodString;
            title: z.ZodString;
            minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            required_visual: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            number: number;
            type: string;
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            outcomes: string[];
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }, {
            number: number;
            type: string;
            title: string;
            extensions?: Record<string, unknown> | undefined;
            concepts?: string[] | undefined;
            outcomes?: string[] | undefined;
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        slides: {
            number: number;
            type: string;
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            outcomes: string[];
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        extensions: Record<string, unknown>;
        concepts: string[];
        outcomes: string[];
        audience: string;
        style: string;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    }, {
        slides: {
            number: number;
            type: string;
            title: string;
            extensions?: Record<string, unknown> | undefined;
            concepts?: string[] | undefined;
            outcomes?: string[] | undefined;
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        audience: string;
        style: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    }>, {
        slides: {
            number: number;
            type: string;
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            outcomes: string[];
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        extensions: Record<string, unknown>;
        concepts: string[];
        outcomes: string[];
        audience: string;
        style: string;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    }, {
        slides: {
            number: number;
            type: string;
            title: string;
            extensions?: Record<string, unknown> | undefined;
            concepts?: string[] | undefined;
            outcomes?: string[] | undefined;
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        audience: string;
        style: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    document_id: string;
    title: string;
    concepts: string[];
    storage_key: string;
    mime_type: string;
    version: number;
    created_at?: string | null | undefined;
    course_id?: string | null | undefined;
    module_id?: string | null | undefined;
    course_version_id?: string | null | undefined;
    original_filename?: string | null | undefined;
    size_bytes?: number | null | undefined;
    checksum?: string | null | undefined;
    uploaded_by?: string | null | undefined;
    supersedes?: string | null | undefined;
    generated_by?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    presentation_plan?: {
        slides: {
            number: number;
            type: string;
            extensions: Record<string, unknown>;
            title: string;
            concepts: string[];
            outcomes: string[];
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        extensions: Record<string, unknown>;
        concepts: string[];
        outcomes: string[];
        audience: string;
        style: string;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    } | null | undefined;
}, {
    document_id: string;
    title: string;
    storage_key: string;
    mime_type: string;
    created_at?: string | Date | null | undefined;
    extensions?: Record<string, unknown> | undefined;
    course_id?: string | null | undefined;
    concepts?: string[] | undefined;
    module_id?: string | null | undefined;
    course_version_id?: string | null | undefined;
    original_filename?: string | null | undefined;
    size_bytes?: number | null | undefined;
    checksum?: string | null | undefined;
    uploaded_by?: string | null | undefined;
    version?: number | undefined;
    supersedes?: string | null | undefined;
    generated_by?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    presentation_plan?: {
        slides: {
            number: number;
            type: string;
            title: string;
            extensions?: Record<string, unknown> | undefined;
            concepts?: string[] | undefined;
            outcomes?: string[] | undefined;
            purpose?: string | null | undefined;
            minutes?: number | null | undefined;
            required_visual?: string | null | undefined;
        }[];
        audience: string;
        style: string;
        extensions?: Record<string, unknown> | undefined;
        concepts?: string[] | undefined;
        outcomes?: string[] | undefined;
        duration_minutes?: number | null | undefined;
        max_slides?: number | null | undefined;
    } | null | undefined;
}>;
