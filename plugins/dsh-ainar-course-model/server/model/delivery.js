/**
 * Delivery-time entities: one semester of a course.
 * Ported from `ainar/model/delivery.py`.
 */
import { z } from "zod";
import { CourseId, ActivityId, ActivityType, ConceptId, CourseVersionId, DocumentId, EnrollmentId, EnrollmentRole, EnrollmentStatus, ModuleId, OutcomeId, ResourceId, ResourceKind, RunStatus, StudentId, TermId, UserId, awareDatetime, entity, plainDate, } from "./common.js";
export const User = entity({
    user_id: UserId,
    display_name: z.string(),
    email: z.string().nullish(),
    role: z.string().nullish(),
    external_ids: z.record(z.string(), z.string()).default({}),
});
export const CourseVersion = entity({
    course_version_id: CourseVersionId,
    course_id: CourseId,
    term: TermId,
    start_date: plainDate(),
    end_date: plainDate(),
    instructors: z.array(UserId).default([]),
    assistants: z.array(UserId).default([]),
    timezone: z.string().default("Asia/Almaty"),
    status: RunStatus.default("planned"),
    lms_course_id: z.string().nullish(),
    section: z.string().nullish(),
    expected_enrollment: z.number().int().min(0).nullish(),
    approved_by: z.string().nullish(),
    syllabus_document_id: DocumentId.nullish(),
    notes: z.string().nullish(),
});
export const Enrollment = entity({
    enrollment_id: EnrollmentId,
    course_version_id: CourseVersionId,
    student_id: StudentId,
    role: EnrollmentRole.default("student"),
    status: EnrollmentStatus.default("active"),
    group: z.string().nullish(),
});
export const Resource = entity({
    resource_id: ResourceId,
    title: z.string(),
    kind: ResourceKind.default("other"),
    course_version_id: CourseVersionId.nullish(),
    course_id: CourseId.nullish(),
    document_id: DocumentId.nullish(),
    url: z.string().nullish(),
    concepts: z.array(ConceptId).default([]),
    description: z.string().nullish(),
    required: z.boolean().default(false),
});
export const LearningActivity = entity({
    activity_id: ActivityId,
    course_version_id: CourseVersionId,
    module_id: ModuleId.nullish(),
    type: ActivityType,
    title: z.string(),
    description: z.string().nullish(),
    scheduled_at: awareDatetime().nullish(),
    duration_minutes: z.number().int().min(0).nullish(),
    location: z.string().nullish(),
    outcomes: z.array(OutcomeId).default([]),
    concepts: z.array(ConceptId).default([]),
    resources: z.array(ResourceId).default([]),
    preparation: z.string().nullish(),
});
