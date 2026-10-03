/**
 * Delivery-time entities: one semester of a course.
 * Ported from `ainar/model/delivery.py`.
 */

import { z } from "zod";
import {
  Approval,
  CourseId,
  ActivityId,
  ActivityType,
  ComponentId,
  ConceptId,
  CourseVersionId,
  DocumentId,
  EnrollmentId,
  EnrollmentRole,
  EnrollmentStatus,
  ModuleId,
  OutcomeId,
  ResourceId,
  ResourceKind,
  RunStatus,
  StudentId,
  TermId,
  UserId,
  Weight,
  awareDatetime,
  entity,
  plainDate,
} from "./common.ts";

export const User = entity({
  user_id: UserId,
  display_name: z.string(),
  email: z.string().nullish(),
  role: z.string().nullish(),
  external_ids: z.record(z.string(), z.string()).default({}),
});

/**
 * One block of the final grade: Narxoz's ВСК1 at 30%, a "Homework" category at
 * 25%, a "First half" period. `weight` is its share of the WHOLE grade, the
 * same unit an assessment's `weight` is in, so a block's members add up to it
 * and the top-level blocks add up to 1. `parent` nests a block inside another —
 * "ВСК1 = homework 10% + midterm 20%" is three components, two of them with
 * `parent: VSK1` — so any depth an institution uses is one list.
 */
export const GradingComponent = entity({
  component_id: ComponentId,
  title: z.string(),
  weight: Weight,
  parent: ComponentId.nullish(),
  description: z.string().nullish(),
});

/**
 * How this run's final grade is divided, when the institution divides it.
 * Absent, the grade is the flat sum of assessment weights, as it always was.
 */
export const GradingScheme = entity({
  components: z.array(GradingComponent).min(1),
  description: z.string().nullish(),
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
  grading_scheme: GradingScheme.nullish(),
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
  approval: Approval.optional(),
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
  approval: Approval.optional(),
  course_version_id: CourseVersionId,
  module_id: ModuleId.nullish(),
  type: ActivityType,
  title: z.string(),
  description: z.string().nullish(),
  scheduled_at: awareDatetime().nullish(),
  duration_minutes: z.number().int().min(0).nullish(),
  location: z.string().nullish(),
  /**
   * Which subgroup this meeting is for, matching `Enrollment.group`.
   *
   * A course taught in subgroups holds one activity per subgroup per session —
   * the same lab at two different times — and before this field there was no
   * way to say which was which except by writing it into the title. Null means
   * the whole run meets, which is what every activity written before this
   * field existed means.
   */
  group: z.string().nullish(),
  outcomes: z.array(OutcomeId).default([]),
  concepts: z.array(ConceptId).default([]),
  resources: z.array(ResourceId).default([]),
  preparation: z.string().nullish(),
});
