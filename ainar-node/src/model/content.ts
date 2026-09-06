/**
 * The content group: the files behind the course.
 * Ported from `ainar/model/content.py`.
 */

import { z } from "zod";
import {
  CourseId,
  ConceptId,
  CourseVersionId,
  DocumentId,
  ModuleId,
  OutcomeId,
  Provenance,
  UserId,
  awareDatetime,
  entity,
} from "./common.ts";

export const SlideSpecification = entity({
  number: z.number().int().min(1),
  type: z.string(),
  title: z.string(),
  minutes: z.number().gt(0).nullish(),
  purpose: z.string().nullish(),
  outcomes: z.array(OutcomeId).default([]),
  concepts: z.array(ConceptId).default([]),
  required_visual: z.string().nullish(),
});

export const PresentationPlan = entity({
  audience: z.string(),
  style: z.string(),
  duration_minutes: z.number().int().gt(0).nullish(),
  max_slides: z.number().int().min(1).nullish(),
  outcomes: z.array(OutcomeId).default([]),
  concepts: z.array(ConceptId).default([]),
  slides: z.array(SlideSpecification).min(1),
}).superRefine((value, ctx) => {
  const numbers = value.slides.map((slide) => slide.number);
  if (new Set(numbers).size !== numbers.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "slide numbers must be unique" });
  }
});

export const Document = entity({
  document_id: DocumentId,
  title: z.string(),
  storage_key: z.string(),
  mime_type: z.string(),
  original_filename: z.string().nullish(),
  size_bytes: z.number().int().min(0).nullish(),
  checksum: z.string().nullish(),
  uploaded_by: UserId.nullish(),
  created_at: awareDatetime().nullish(),

  course_version_id: CourseVersionId.nullish(),
  course_id: CourseId.nullish(),
  module_id: ModuleId.nullish(),
  concepts: z.array(ConceptId).default([]),

  version: z.number().int().min(1).default(1),
  supersedes: DocumentId.nullish(),
  generated_by: Provenance.nullish(),
  presentation_plan: PresentationPlan.nullish(),
});
