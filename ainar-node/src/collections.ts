/**
 * Every kind of record a course holds, declared once.
 *
 * Until 2026-10-16 a new record type was edited by hand into the bundle's
 * schemas (`bundle.ts`), the loader's file patterns (`loader.ts`), the entity
 * table (`schema.ts`), what an agent may write (`approval.ts`) and two id-field
 * tables (`approval.ts`, `validate.ts`) — and the two id tables had already
 * drifted, each missing collections the other had. Each of those is now derived
 * from the list below, under the name it always had, so no caller changed.
 *
 * What a collection declares:
 *
 * * `model` — the zod schema each entry is validated against.
 * * `files` — where in a course folder its records are read from and written
 *   to, as the loader's globs (`*` within one path segment, no `**`).
 * * `id` — the field that names a record, or `null` for a collection keyed by
 *   a pair (`concept_edges`, the two student-state collections).
 * * `entity` — the entity's own name, as the vendor JSON Schemas name their
 *   files (`learning_outcome`, where the collection is `outcomes`).
 * * `agent` — whether an agent may write it into a course at all. The
 *   omissions are the point: what a course teaches, its outcomes and who is
 *   enrolled are the professor's own (see `approval.ts`).
 *
 * The order is the bundle's: the loader reads in it, and a payload lists
 * collections in it.
 *
 * Not derived from here, deliberately: `sql/schema.sql` is a hand-written
 * contract with the application, and `sqlgen.ts` maps each collection to its
 * tables with code of its own — a list cannot say what a join table is.
 */

import type { z } from "zod";
import { Capability, Concept, ConceptEdge, Course, LearningOutcome, Module } from "./model/academic.ts";
import { Assessment, AssessmentItem, Evaluation, IntegrityCase, ItemModel, ItemResponse, Rubric, Submission } from "./model/assessment.ts";
import { Document } from "./model/content.ts";
import { CourseVersion, Enrollment, LearningActivity, Resource, User } from "./model/delivery.ts";
import { ActionItem, CourseEvent } from "./model/harness.ts";
import {
  Intervention,
  LearningEvidence,
  StudentCapabilityState,
  StudentConceptState,
  StudentSignal,
} from "./model/learning.ts";

/**
 * The files inside `assessments/<ASSESSMENT_ID>/`. Everything else in that
 * folder — the papers, `keys/`, `starter/`, `src/figures/` — is material, not
 * record, and no pattern here reaches it.
 */
export const ASSESSMENT_FILE = "assessments/*/assessment.yaml";
export const ASSESSMENT_ITEMS = "assessments/*/items.yaml";
export const ASSESSMENT_ITEM_MODELS = "assessments/*/src/item-models.yaml";

/** Where the records of a collection written by tools rather than typed live (STORAGE.md). */
const records = (stem: string): string[] => [`samples/${stem}*.yaml`, `records/${stem}*.yaml`];

export interface CollectionSpec {
  model: z.ZodTypeAny;
  files: string[];
  id: string | null;
  entity: string;
  agent: boolean;
}

const spec = <M extends z.ZodTypeAny, A extends boolean = false>(
  model: M,
  files: string[],
  id: string | null,
  entity: string,
  agent: A = false as A,
) => ({ model, files, id, entity, agent });

export const COLLECTION_SPECS = {
  outcomes: spec(LearningOutcome, ["outcomes.yaml", "outcomes/*.yaml"], "outcome_id", "learning_outcome"),
  concepts: spec(Concept, ["concepts.yaml", "concepts/*.yaml"], "concept_id", "concept"),
  concept_edges: spec(ConceptEdge, ["concept-edges.yaml"], null, "concept_edge"),
  capabilities: spec(Capability, ["capabilities.yaml"], "capability_id", "capability"),
  modules: spec(Module, ["modules.yaml", "modules/*.yaml"], "module_id", "module"),
  users: spec(User, ["people/users.yaml", "people/*.yaml"], "user_id", "user"),
  versions: spec(CourseVersion, ["version.yaml"], "course_version_id", "course_version"),
  enrollments: spec(Enrollment, ["enrollments.yaml"], "enrollment_id", "enrollment"),
  activities: spec(LearningActivity, ["activities.yaml", "activities/*.yaml"], "activity_id", "learning_activity", true),
  documents: spec(Document, ["documents.yaml", "documents/*.yaml", "samples/documents*.yaml"], "document_id", "document", true),
  resources: spec(Resource, ["resources.yaml", "resources/*.yaml"], "resource_id", "resource", true),
  // An assessment's own folder (STORAGE.md §5) is read beside the flat files
  // courses written before it, which stay valid until they are moved.
  assessments: spec(Assessment, ["assessments.yaml", "assessments/*.yaml", ASSESSMENT_FILE], "assessment_id", "assessment", true),
  rubrics: spec(Rubric, ["rubrics.yaml", "rubrics/*.yaml"], "rubric_id", "rubric"),
  items: spec(AssessmentItem, ["items.yaml", "items/*.yaml", "assessments/items/*.yaml", ASSESSMENT_ITEMS], "item_id", "assessment_item", true),
  item_models: spec(ItemModel, ["item-models.yaml", "item-models/*.yaml", ASSESSMENT_ITEM_MODELS], "item_model_id", "item_model", true),
  submissions: spec(Submission, records("submissions"), "submission_id", "submission", true),
  item_responses: spec(ItemResponse, records("item-responses"), "response_id", "item_response", true),
  evaluations: spec(Evaluation, records("evaluations"), "evaluation_id", "evaluation", true),
  evidence: spec(LearningEvidence, records("evidence"), "evidence_id", "learning_evidence", true),
  concept_states: spec(StudentConceptState, records("concept-states"), null, "student_concept_state", true),
  capability_states: spec(StudentCapabilityState, records("capability-states"), null, "student_capability_state", true),
  signals: spec(StudentSignal, records("signals"), "signal_id", "student_signal", true),
  interventions: spec(Intervention, records("interventions"), "intervention_id", "intervention", true),
  // The professor's alone: an agent never opens or decides one (model/assessment.ts).
  integrity_cases: spec(IntegrityCase, records("integrity"), "case_id", "integrity_case"),
  events: spec(CourseEvent, records("events"), "event_id", "course_event", true),
  action_items: spec(ActionItem, records("action-items"), "action_id", "action_item", true),
} as const;

export type CollectionName = keyof typeof COLLECTION_SPECS;
type Specs = typeof COLLECTION_SPECS;

export const COLLECTION_NAMES = Object.keys(COLLECTION_SPECS) as CollectionName[];

/** The course record itself is one entity, not a collection: one per course folder. */
export const COURSE_MODEL = Course;

// ---------------------------------------------------------------- derived

const pick = <V>(read: (spec: CollectionSpec) => V) =>
  Object.fromEntries(COLLECTION_NAMES.map((name) => [name, read(COLLECTION_SPECS[name])]));

/** Every list on the bundle, with the schema that validates its entries. */
export const COLLECTION_SCHEMAS = pick((s) => s.model) as { [K in CollectionName]: Specs[K]["model"] };

/** One list on the bundle and the files it is read from. */
export const COLLECTION_FILES = pick((s) => s.files) as Record<CollectionName, string[]>;

/** The identifier field of each collection that has one. */
export const COLLECTION_ID_FIELDS = Object.fromEntries(
  COLLECTION_NAMES.filter((name) => COLLECTION_SPECS[name].id !== null).map((name) => [name, COLLECTION_SPECS[name].id as string]),
) as Partial<Record<CollectionName, string>>;

type AgentNames = { [K in CollectionName]: Specs[K]["agent"] extends true ? K : never }[CollectionName];

/** What an agent may write into a course, keyed by collection, in bundle order. */
export const AGENT_COLLECTIONS = Object.fromEntries(
  COLLECTION_NAMES.filter((name) => COLLECTION_SPECS[name].agent).map((name) => [name, COLLECTION_SPECS[name].model]),
) as { [K in AgentNames]: Specs[K]["model"] };

/** The entity name of each collection, as the vendor JSON Schemas name their files. */
export const ENTITY_NAMES = Object.fromEntries([
  ["course", "course"],
  ...COLLECTION_NAMES.map((name) => [name, COLLECTION_SPECS[name].entity]),
]) as Record<CollectionName | "course", string>;
