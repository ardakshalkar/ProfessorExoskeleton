/**
 * Learning-state entities: what the student demonstrated, and what follows.
 * Ported from `ainar/model/learning.py`.
 */

import { z } from "zod";
import {
  CapabilityId,
  ConceptId,
  ConceptStateValue,
  Confidence,
  CourseVersionId,
  EvidenceId,
  InterventionId,
  InterventionStatus,
  OutcomeId,
  Provenance,
  Severity,
  SignalId,
  SignalStatus,
  StudentId,
  UserId,
  awareDatetime,
  entity,
} from "./common.ts";

export const LearningEvidence = entity({
  evidence_id: EvidenceId,
  student_id: StudentId,
  course_version_id: CourseVersionId,
  source_type: z.string(),
  source_id: z.string(),
  outcome_id: OutcomeId.nullish(),
  capability_id: CapabilityId.nullish(),
  concept_id: ConceptId.nullish(),
  demonstrated_level: z.number().int().min(0).nullish(),
  confidence: Confidence.nullish(),
  verified_by: UserId.nullish(),
  recorded_at: awareDatetime().nullish(),
  provenance: Provenance.nullish(),
});

export const StudentConceptState = entity({
  student_id: StudentId,
  concept_id: ConceptId,
  course_version_id: CourseVersionId,
  state: ConceptStateValue.default("not_observed"),
  mastery_estimate: Confidence.nullish(),
  evidence_ids: z.array(EvidenceId).default([]),
  last_updated_at: awareDatetime().nullish(),
  provenance: Provenance.nullish(),
});

export const StudentCapabilityState = entity({
  student_id: StudentId,
  capability_id: CapabilityId,
  course_version_id: CourseVersionId.nullish(),
  level: z.number().int().min(0).nullish(),
  source_count: z.number().int().min(0).default(0),
  evidence_ids: z.array(EvidenceId).default([]),
  confidence: Confidence.nullish(),
  verified_by: UserId.nullish(),
  last_updated_at: awareDatetime().nullish(),
  provenance: Provenance.nullish(),
});

export const StudentSignal = entity({
  signal_id: SignalId,
  student_id: StudentId.nullish(),
  course_version_id: CourseVersionId,
  type: z.string(),
  severity: Severity.default("medium"),
  description: z.string(),
  evidence_ids: z.array(EvidenceId).default([]),
  concepts: z.array(ConceptId).default([]),
  status: SignalStatus.default("open"),
  detected_at: awareDatetime().nullish(),
  provenance: Provenance.nullish(),
});

export const Intervention = entity({
  intervention_id: InterventionId,
  signal_id: SignalId.nullish(),
  student_id: StudentId.nullish(),
  course_version_id: CourseVersionId,
  type: z.string(),
  description: z.string(),
  proposed_by: z.string().nullish(),
  approved_by: UserId.nullish(),
  status: InterventionStatus.default("proposed"),
  scheduled_at: awareDatetime().nullish(),
  completed_at: awareDatetime().nullish(),
  effectiveness_note: z.string().nullish(),
});
