/**
 * Design-time entities: what is taught, and how it is structured.
 * Ported from `ainar/model/academic.py`.
 */
import { z } from "zod";
import { CapabilityId, CognitiveLevel, ConceptId, ConceptRelationship, CourseId, CourseStatus, ModuleId, OutcomeId, UserId, Weight, entity, } from "./common.js";
export const Course = entity({
    course_id: CourseId,
    title: z.string(),
    description: z.string().nullish(),
    credits: z.number().min(0).nullish(),
    department: z.string().nullish(),
    language: z.array(z.string()).default(["en"]),
    status: CourseStatus.default("active"),
    owner: UserId.nullish(),
});
/** `level: apply-analyze` is shorthand for `[apply, analyze]`. */
const cognitiveLevels = z.preprocess((value) => (typeof value === "string" ? value.split("-").filter(Boolean) : value), z.array(CognitiveLevel).default([]));
export const LearningOutcome = entity({
    outcome_id: OutcomeId,
    course_id: CourseId,
    title: z.string(),
    description: z.string().nullish(),
    level: cognitiveLevels,
    weight: Weight.nullish(),
    capabilities: z.array(CapabilityId).default([]),
    concepts: z.array(ConceptId).default([]),
});
export const Concept = entity({
    concept_id: ConceptId,
    title: z.string(),
    description: z.string().nullish(),
    course_id: CourseId.nullish(),
    prerequisites: z.array(ConceptId).default([]),
    related: z.array(ConceptId).default([]),
    aliases: z.array(z.string()).default([]),
});
export const ConceptEdge = entity({
    source_concept_id: ConceptId,
    target_concept_id: ConceptId,
    relationship_type: ConceptRelationship,
    note: z.string().nullish(),
});
export const CapabilityLevel = entity({
    level: z.number().int().min(1),
    description: z.string(),
});
export const Capability = entity({
    capability_id: CapabilityId,
    title: z.string(),
    description: z.string().nullish(),
    levels: z.array(CapabilityLevel).default([]),
    domain: z.string().nullish(),
}).refine((value) => {
    const numbers = value.levels.map((entry) => entry.level);
    const ascending = numbers.every((n, i) => i === 0 || n > numbers[i - 1]);
    return ascending;
}, { message: "capability levels must be unique and in ascending order" });
export const Module = entity({
    module_id: ModuleId,
    course_id: CourseId,
    title: z.string(),
    description: z.string().nullish(),
    week: z.number().int().min(1).nullish(),
    order: z.number().int().min(1).nullish(),
    outcomes: z.array(OutcomeId).default([]),
    concepts: z.array(ConceptId).default([]),
    estimated_hours: z.number().min(0).nullish(),
});
