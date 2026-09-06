/**
 * Design-time entities: what is taught, and how it is structured.
 * Ported from `ainar/model/academic.py`.
 */
import { z } from "zod";
export declare const Course: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    course_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    credits: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    language: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["draft", "active", "retired"]>>;
    owner: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "draft" | "active" | "retired";
    extensions: Record<string, unknown>;
    course_id: string;
    title: string;
    language: string[];
    description?: string | null | undefined;
    credits?: number | null | undefined;
    department?: string | null | undefined;
    owner?: string | null | undefined;
}, {
    course_id: string;
    title: string;
    status?: "draft" | "active" | "retired" | undefined;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    credits?: number | null | undefined;
    department?: string | null | undefined;
    language?: string[] | undefined;
    owner?: string | null | undefined;
}>;
export declare const LearningOutcome: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    outcome_id: z.ZodString;
    course_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    level: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create"]>, "many">>, ("remember" | "understand" | "apply" | "analyze" | "evaluate" | "create")[], unknown>;
    weight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    course_id: string;
    title: string;
    outcome_id: string;
    level: ("remember" | "understand" | "apply" | "analyze" | "evaluate" | "create")[];
    capabilities: string[];
    concepts: string[];
    description?: string | null | undefined;
    weight?: number | null | undefined;
}, {
    course_id: string;
    title: string;
    outcome_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    level?: unknown;
    weight?: number | null | undefined;
    capabilities?: string[] | undefined;
    concepts?: string[] | undefined;
}>;
export declare const Concept: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    concept_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    course_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    prerequisites: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    related: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    title: string;
    concept_id: string;
    prerequisites: string[];
    related: string[];
    aliases: string[];
    course_id?: string | null | undefined;
    description?: string | null | undefined;
}, {
    title: string;
    concept_id: string;
    extensions?: Record<string, unknown> | undefined;
    course_id?: string | null | undefined;
    description?: string | null | undefined;
    prerequisites?: string[] | undefined;
    related?: string[] | undefined;
    aliases?: string[] | undefined;
}>;
export declare const ConceptEdge: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    source_concept_id: z.ZodString;
    target_concept_id: z.ZodString;
    relationship_type: z.ZodEnum<["prerequisite_of", "related_to", "part_of", "refines"]>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    source_concept_id: string;
    target_concept_id: string;
    relationship_type: "prerequisite_of" | "related_to" | "part_of" | "refines";
    note?: string | null | undefined;
}, {
    source_concept_id: string;
    target_concept_id: string;
    relationship_type: "prerequisite_of" | "related_to" | "part_of" | "refines";
    extensions?: Record<string, unknown> | undefined;
    note?: string | null | undefined;
}>;
export declare const CapabilityLevel: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    level: z.ZodNumber;
    description: z.ZodString;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    description: string;
    level: number;
}, {
    description: string;
    level: number;
    extensions?: Record<string, unknown> | undefined;
}>;
export declare const Capability: z.ZodEffects<z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    capability_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    levels: z.ZodDefault<z.ZodArray<z.ZodObject<{
        extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        level: z.ZodNumber;
        description: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        extensions: Record<string, unknown>;
        description: string;
        level: number;
    }, {
        description: string;
        level: number;
        extensions?: Record<string, unknown> | undefined;
    }>, "many">>;
    domain: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    title: string;
    capability_id: string;
    levels: {
        extensions: Record<string, unknown>;
        description: string;
        level: number;
    }[];
    description?: string | null | undefined;
    domain?: string | null | undefined;
}, {
    title: string;
    capability_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    levels?: {
        description: string;
        level: number;
        extensions?: Record<string, unknown> | undefined;
    }[] | undefined;
    domain?: string | null | undefined;
}>, {
    extensions: Record<string, unknown>;
    title: string;
    capability_id: string;
    levels: {
        extensions: Record<string, unknown>;
        description: string;
        level: number;
    }[];
    description?: string | null | undefined;
    domain?: string | null | undefined;
}, {
    title: string;
    capability_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    levels?: {
        description: string;
        level: number;
        extensions?: Record<string, unknown> | undefined;
    }[] | undefined;
    domain?: string | null | undefined;
}>;
export declare const Module: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    module_id: z.ZodString;
    course_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    week: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    order: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    estimated_hours: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    course_id: string;
    title: string;
    concepts: string[];
    module_id: string;
    outcomes: string[];
    description?: string | null | undefined;
    week?: number | null | undefined;
    order?: number | null | undefined;
    estimated_hours?: number | null | undefined;
}, {
    course_id: string;
    title: string;
    module_id: string;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    concepts?: string[] | undefined;
    week?: number | null | undefined;
    order?: number | null | undefined;
    outcomes?: string[] | undefined;
    estimated_hours?: number | null | undefined;
}>;
