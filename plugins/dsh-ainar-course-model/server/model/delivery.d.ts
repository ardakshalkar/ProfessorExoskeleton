/**
 * Delivery-time entities: one semester of a course.
 * Ported from `ainar/model/delivery.py`.
 */
import { z } from "zod";
export declare const User: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    user_id: z.ZodString;
    display_name: z.ZodString;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    role: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    external_ids: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    user_id: string;
    display_name: string;
    external_ids: Record<string, string>;
    role?: string | null | undefined;
    email?: string | null | undefined;
}, {
    user_id: string;
    display_name: string;
    extensions?: Record<string, unknown> | undefined;
    role?: string | null | undefined;
    email?: string | null | undefined;
    external_ids?: Record<string, string> | undefined;
}>;
export declare const CourseVersion: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    course_version_id: z.ZodString;
    course_id: z.ZodString;
    term: z.ZodString;
    start_date: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
    end_date: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
    instructors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    assistants: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    timezone: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["planned", "scheduled", "running", "completed", "cancelled"]>>;
    lms_course_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    section: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expected_enrollment: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    approved_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    syllabus_document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "planned" | "scheduled" | "running" | "completed" | "cancelled";
    extensions: Record<string, unknown>;
    course_id: string;
    course_version_id: string;
    term: string;
    start_date: string;
    end_date: string;
    instructors: string[];
    assistants: string[];
    timezone: string;
    lms_course_id?: string | null | undefined;
    section?: string | null | undefined;
    expected_enrollment?: number | null | undefined;
    approved_by?: string | null | undefined;
    syllabus_document_id?: string | null | undefined;
    notes?: string | null | undefined;
}, {
    course_id: string;
    course_version_id: string;
    term: string;
    start_date: string | Date;
    end_date: string | Date;
    status?: "planned" | "scheduled" | "running" | "completed" | "cancelled" | undefined;
    extensions?: Record<string, unknown> | undefined;
    instructors?: string[] | undefined;
    assistants?: string[] | undefined;
    timezone?: string | undefined;
    lms_course_id?: string | null | undefined;
    section?: string | null | undefined;
    expected_enrollment?: number | null | undefined;
    approved_by?: string | null | undefined;
    syllabus_document_id?: string | null | undefined;
    notes?: string | null | undefined;
}>;
export declare const Enrollment: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    enrollment_id: z.ZodString;
    course_version_id: z.ZodString;
    student_id: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["student", "auditor", "instructor", "teaching_assistant", "observer"]>>;
    status: z.ZodDefault<z.ZodEnum<["active", "dropped", "completed", "pending"]>>;
    group: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "active" | "completed" | "pending" | "dropped";
    extensions: Record<string, unknown>;
    course_version_id: string;
    role: "student" | "auditor" | "instructor" | "teaching_assistant" | "observer";
    student_id: string;
    enrollment_id: string;
    group?: string | null | undefined;
}, {
    course_version_id: string;
    student_id: string;
    enrollment_id: string;
    status?: "active" | "completed" | "pending" | "dropped" | undefined;
    extensions?: Record<string, unknown> | undefined;
    role?: "student" | "auditor" | "instructor" | "teaching_assistant" | "observer" | undefined;
    group?: string | null | undefined;
}>;
export declare const Resource: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    resource_id: z.ZodString;
    title: z.ZodString;
    kind: z.ZodDefault<z.ZodEnum<["slides", "reading", "dataset", "notebook", "video", "link", "textbook_chapter", "tool", "other"]>>;
    course_version_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    course_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    document_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    required: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    resource_id: string;
    kind: "reading" | "other" | "notebook" | "video" | "slides" | "dataset" | "link" | "textbook_chapter" | "tool";
    required: boolean;
    url?: string | null | undefined;
    document_id?: string | null | undefined;
    course_id?: string | null | undefined;
    description?: string | null | undefined;
    course_version_id?: string | null | undefined;
}, {
    title: string;
    resource_id: string;
    url?: string | null | undefined;
    extensions?: Record<string, unknown> | undefined;
    document_id?: string | null | undefined;
    course_id?: string | null | undefined;
    description?: string | null | undefined;
    concepts?: string[] | undefined;
    course_version_id?: string | null | undefined;
    kind?: "reading" | "other" | "notebook" | "video" | "slides" | "dataset" | "link" | "textbook_chapter" | "tool" | undefined;
    required?: boolean | undefined;
}>;
export declare const LearningActivity: z.ZodObject<{
    extensions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    activity_id: z.ZodString;
    course_version_id: z.ZodString;
    module_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodEnum<["lecture", "lab", "seminar", "discussion", "reading", "exercise", "project_work", "field_work", "review", "other"]>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scheduled_at: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>>>;
    duration_minutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concepts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    resources: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    preparation: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    type: "lecture" | "lab" | "seminar" | "discussion" | "reading" | "exercise" | "project_work" | "field_work" | "review" | "other";
    extensions: Record<string, unknown>;
    title: string;
    concepts: string[];
    outcomes: string[];
    course_version_id: string;
    activity_id: string;
    resources: string[];
    preparation?: string | null | undefined;
    location?: string | null | undefined;
    description?: string | null | undefined;
    module_id?: string | null | undefined;
    duration_minutes?: number | null | undefined;
    scheduled_at?: string | null | undefined;
}, {
    type: "lecture" | "lab" | "seminar" | "discussion" | "reading" | "exercise" | "project_work" | "field_work" | "review" | "other";
    title: string;
    course_version_id: string;
    activity_id: string;
    preparation?: string | null | undefined;
    extensions?: Record<string, unknown> | undefined;
    location?: string | null | undefined;
    description?: string | null | undefined;
    concepts?: string[] | undefined;
    module_id?: string | null | undefined;
    outcomes?: string[] | undefined;
    duration_minutes?: number | null | undefined;
    scheduled_at?: string | Date | null | undefined;
    resources?: string[] | undefined;
}>;
