/**
 * Harness entities: how the exoskeleton reacts and what it asks of the professor.
 * Ported from `ainar/model/harness.py`.
 */
import { z } from "zod";
export declare const CourseEvent: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    event_id: z.ZodString;
    event_type: z.ZodString;
    course_version_id: z.ZodString;
    entity_type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    entity_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    occurred_at: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    course_version_id: string;
    event_id: string;
    event_type: string;
    occurred_at: string;
    payload: Record<string, unknown>;
    entity_type?: string | null | undefined;
    entity_id?: string | null | undefined;
}, {
    course_version_id: string;
    event_id: string;
    event_type: string;
    occurred_at: string | Date;
    extensions?: Record<string, unknown> | undefined;
    entity_type?: string | null | undefined;
    entity_id?: string | null | undefined;
    payload?: Record<string, unknown> | undefined;
}>;
export declare const ActionItem: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    action_id: z.ZodString;
    course_version_id: z.ZodString;
    assigned_to: z.ZodString;
    type: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
    source_event_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["pending", "in_progress", "done", "dismissed"]>>;
    due_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    available_actions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
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
    status: "dismissed" | "pending" | "in_progress" | "done";
    extensions: Record<string, unknown>;
    title: string;
    course_version_id: string;
    action_id: string;
    assigned_to: string;
    priority: "medium" | "low" | "high" | "urgent";
    source_refs: string[];
    available_actions: string[];
    description?: string | null | undefined;
    due_at?: string | null | undefined;
    provenance?: {
        produced_by: string;
        input_refs: string[];
        extensions: Record<string, unknown>;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        created_at?: string | null | undefined;
    } | null | undefined;
    source_event_id?: string | null | undefined;
}, {
    type: string;
    title: string;
    course_version_id: string;
    action_id: string;
    assigned_to: string;
    status?: "dismissed" | "pending" | "in_progress" | "done" | undefined;
    extensions?: Record<string, unknown> | undefined;
    description?: string | null | undefined;
    due_at?: string | Date | null | undefined;
    provenance?: {
        produced_by: string;
        model_id?: string | null | undefined;
        workflow_version?: string | null | undefined;
        prompt_version?: string | null | undefined;
        input_refs?: string[] | undefined;
        created_at?: string | Date | null | undefined;
        extensions?: Record<string, unknown> | undefined;
    } | null | undefined;
    priority?: "medium" | "low" | "high" | "urgent" | undefined;
    source_event_id?: string | null | undefined;
    source_refs?: string[] | undefined;
    available_actions?: string[] | undefined;
}>;
