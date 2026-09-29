/**
 * Whether a person stands behind a record — the one rule, in one place.
 *
 * Since 2026-09-29 there is no second place for a proposal to live. An agent
 * writes a record straight into the course file its collection belongs in, and
 * the record itself says whether it has been accepted:
 *
 * * most collections carry `approval: draft | approved`;
 * * an evaluation says it with `status` — `suggested` or `in_review` is a
 *   draft, `approved` or `overridden` is a decision, and the decision sits
 *   beside the AI suggestion rather than on top of it;
 * * an intervention says it with `status` — `proposed` is a draft.
 *
 * A record with no `approval` is approved. Anything typed into `courses/` by
 * hand is the professor's own, and every course written before this rule still
 * reads the way it did. The cost of that default is that an agent which forgets
 * the field publishes its work, which is why every generator in this package
 * writes it explicitly and every skill says to.
 *
 * What replaced `ainar approve` is nothing: the professor changes the word.
 * The change is visible in a diff, and the validator still refuses a decided
 * evaluation that does not say who decided it and when.
 */

import type { CourseBundle } from "./bundle.ts";
import {
  Assessment,
  AssessmentItem,
  Evaluation,
  ItemModel,
  ItemResponse,
  Submission,
} from "./model/assessment.ts";
import { Document } from "./model/content.ts";
import { LearningActivity, Resource } from "./model/delivery.ts";
import { ActionItem, CourseEvent } from "./model/harness.ts";
import {
  Intervention,
  LearningEvidence,
  StudentCapabilityState,
  StudentConceptState,
  StudentSignal,
} from "./model/learning.ts";

/**
 * What an agent may write into a course, keyed by collection.
 *
 * The omissions are the point: no `outcomes`, no `capabilities`, no
 * `enrollments`, and — since 2026-09-05 — no `concepts` or `modules`. What a
 * course teaches and in which week is the professor's own authoring. An
 * invented learning outcome is the mistake that costs most to find late,
 * because student evidence attaches to it.
 */
export const AGENT_WRITABLE = {
  activities: LearningActivity,
  documents: Document,
  resources: Resource,
  assessments: Assessment,
  items: AssessmentItem,
  item_models: ItemModel,
  submissions: Submission,
  item_responses: ItemResponse,
  evaluations: Evaluation,
  evidence: LearningEvidence,
  concept_states: StudentConceptState,
  capability_states: StudentCapabilityState,
  signals: StudentSignal,
  interventions: Intervention,
  events: CourseEvent,
  action_items: ActionItem,
} as const;

export type WritableCollection = keyof typeof AGENT_WRITABLE;

/** The identifier field of each collection that has one. */
export const ID_FIELDS: Record<string, string> = {
  concepts: "concept_id",
  modules: "module_id",
  activities: "activity_id",
  documents: "document_id",
  resources: "resource_id",
  assessments: "assessment_id",
  items: "item_id",
  item_models: "item_model_id",
  submissions: "submission_id",
  item_responses: "response_id",
  evaluations: "evaluation_id",
  evidence: "evidence_id",
  signals: "signal_id",
  interventions: "intervention_id",
  events: "event_id",
  action_items: "action_id",
};

/**
 * Collections whose records can be drafts. Submissions are not: a pulled
 * submission is a fact about what a student handed in, not anybody's judgement.
 */
export const APPROVABLE: readonly string[] = Object.keys(AGENT_WRITABLE).filter(
  (collection) => collection !== "submissions",
);

const DECIDED_EVALUATION = new Set(["approved", "overridden"]);
const UNAPPROVED_INTERVENTION = new Set(["proposed"]);

type Record_ = Record<string, unknown>;

/** Does a person stand behind this record? */
export const isApproved = (collection: string, record: Record_): boolean => {
  if (collection === "evaluations") return DECIDED_EVALUATION.has(record.status as string);
  if (collection === "interventions") {
    return !UNAPPROVED_INTERVENTION.has((record.status as string | undefined) ?? "proposed");
  }
  return record.approval !== "draft";
};

/** How a record is named in a list — its id, or its key for the state collections. */
export const recordLabel = (collection: string, record: Record_): string => {
  const field = ID_FIELDS[collection];
  if (field && typeof record[field] === "string") return record[field] as string;
  if (collection === "concept_states") return `${record.student_id} × ${record.concept_id}`;
  if (collection === "capability_states") return `${record.student_id} × ${record.capability_id}`;
  return collection;
};

export interface Draft {
  collection: string;
  id: string;
  title?: string;
}

/** Every record in the bundle nobody has accepted yet, in collection order. */
export const drafts = (bundle: CourseBundle): Draft[] => {
  const found: Draft[] = [];
  const collections = bundle as unknown as Record<string, Record_[] | undefined>;
  for (const collection of APPROVABLE) {
    for (const record of collections[collection] ?? []) {
      if (isApproved(collection, record)) continue;
      const title = typeof record.title === "string" ? record.title : undefined;
      found.push({ collection, id: recordLabel(collection, record), ...(title ? { title } : {}) });
    }
  }
  return found;
};

/**
 * The bundle as a student may see it: every draft removed.
 *
 * Evaluations are the exception in what "removed" means. A suggested grade is a
 * record of work in progress the professor's own views need, but nothing
 * student-facing reads it, and the readers that do already select decided
 * ones — so this drops them too, and a reader that forgot to filter cannot
 * publish one.
 */
export const approvedView = (bundle: CourseBundle): CourseBundle => {
  const view = structuredClone(bundle) as unknown as Record<string, unknown>;
  for (const collection of APPROVABLE) {
    const records = view[collection];
    if (!Array.isArray(records)) continue;
    view[collection] = (records as Record_[]).filter((record) => isApproved(collection, record));
  }
  return view as unknown as CourseBundle;
};

/** A copy of the bundle with extra records appended, for validating before a write. */
export const withRecords = (
  bundle: CourseBundle,
  extra: Partial<Record<string, Record_[]>>,
): CourseBundle => {
  const merged = structuredClone(bundle) as unknown as Record<string, unknown[]>;
  for (const [name, records] of Object.entries(extra)) {
    if (!records?.length) continue;
    merged[name] = [...((merged[name] as unknown[]) ?? []), ...records];
  }
  return merged as unknown as CourseBundle;
};
