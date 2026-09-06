/**
 * Identifier patterns, enums and the base every entity extends.
 *
 * Ported from `ainar/model/common.py`. Three properties from the Python side
 * have to survive the translation, and each is easy to lose quietly:
 *
 * 1. `extra="forbid"` becomes `.strict()`. A typo in authored YAML is a loud
 *    error, not an ignored key — so `entity()` applies it rather than leaving
 *    it to each schema to remember.
 * 2. Identifier patterns are anchored at both ends. `^…$`, always.
 * 3. Timestamps are timezone-aware. JavaScript's `Date` cannot tell a naive
 *    string from an aware one, so the offset is checked before parsing and the
 *    original text is kept — see `awareDatetime`.
 */
import { z } from "zod";
// --------------------------------------------------------------------------
// Identifier patterns
// --------------------------------------------------------------------------
const COURSE = "[A-Z][A-Z0-9]{1,7}-[0-9]{3,5}";
const TERM = "[0-9]{4}-(?:FALL|SPRING|SUMMER|WINTER)";
/** Anchored at both ends, exactly as `_id()` does in Python. */
export const id = (pattern) => z.string().regex(new RegExp(`^${pattern}$`));
export const CourseId = id(COURSE);
export const CourseVersionId = id(`${COURSE}-${TERM}`);
export const TermId = id(TERM);
export const OutcomeId = id("LO-[0-9]{2,3}");
export const ConceptId = id("CONCEPT-[A-Z0-9][A-Z0-9-]*");
export const CapabilityId = id("CAP-[A-Z0-9][A-Z0-9-]*");
export const ModuleId = id("MODULE-(?:DRAFT-)?[0-9]{2,3}");
export const ActivityId = id("ACT-[A-Z0-9][A-Z0-9-]*");
export const AssessmentId = id("ASSESSMENT-[A-Z0-9][A-Z0-9-]*");
export const RubricId = id("RUBRIC-[A-Z0-9][A-Z0-9-]*");
export const CriterionId = id("CRIT-[A-Z0-9][A-Z0-9-]*");
export const ItemId = id("ITEM-[A-Z0-9][A-Z0-9-]*");
export const ItemModelId = id("ITEM-MODEL-[A-Z0-9][A-Z0-9-]*");
export const ResponseId = id("RESP-[A-Z0-9][A-Z0-9-]*");
export const ResourceId = id("RES-[A-Z0-9][A-Z0-9-]*");
export const DocumentId = id("DOC-[A-Z0-9][A-Z0-9-]*");
export const UserId = id("USER-[A-Z0-9][A-Z0-9-]*");
export const StudentId = id("STUDENT-[A-Z0-9][A-Z0-9-]*");
export const EnrollmentId = id("ENR-[A-Z0-9][A-Z0-9-]*");
export const SubmissionId = id("SUB-[A-Z0-9][A-Z0-9-]*");
export const EvaluationId = id("EVAL-[A-Z0-9][A-Z0-9-]*");
export const EvidenceId = id("EVID-[A-Z0-9][A-Z0-9-]*");
export const SignalId = id("SIGNAL-[A-Z0-9][A-Z0-9-]*");
export const InterventionId = id("INT-[A-Z0-9][A-Z0-9-]*");
export const ActionId = id("ACTION-[A-Z0-9][A-Z0-9-]*");
export const EventId = id("EVENT-[A-Z0-9][A-Z0-9-]*");
export const Weight = z.number().min(0).max(1);
export const Confidence = z.number().min(0).max(1);
// --------------------------------------------------------------------------
// Dates and times
// --------------------------------------------------------------------------
/**
 * A timezone-aware timestamp, kept as the string it arrived as.
 *
 * Python's `AwareDatetime` rejects a naive value outright and `model_dump`
 * round-trips the original offset — `2026-10-15T23:59:00+05:00` stays in
 * `+05:00`, it does not become UTC. A JS `Date` would silently normalise to
 * UTC and print `Z`, which changes the value the professor wrote and would
 * differ from every golden fixture.
 *
 * So this validates and returns the string.
 */
const AWARE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
export const awareDatetime = () => z.union([z.string(), z.date()]).transform((value, ctx) => {
    const text = value instanceof Date ? value.toISOString() : value.trim();
    if (!AWARE.test(text)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `timestamp must carry a UTC offset, got '${text}'`,
        });
        return z.NEVER;
    }
    return text.replace(" ", "T");
});
/** A plain date, kept as `YYYY-MM-DD`. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const plainDate = () => z.union([z.string(), z.date()]).transform((value, ctx) => {
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : value.trim();
    if (!DATE.test(text)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `date must be YYYY-MM-DD, got '${text}'` });
        return z.NEVER;
    }
    return text;
});
// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const CourseStatus = z.enum(["draft", "active", "retired"]);
export const VersionStatus = z.enum(["draft", "in_review", "approved", "superseded"]);
export const RunStatus = z.enum(["planned", "scheduled", "running", "completed", "cancelled"]);
export const CognitiveLevel = z.enum([
    "remember", "understand", "apply", "analyze", "evaluate", "create",
]);
export const ConceptRelationship = z.enum([
    "prerequisite_of", "related_to", "part_of", "refines",
]);
export const ActivityType = z.enum([
    "lecture", "lab", "seminar", "discussion", "reading", "exercise",
    "project_work", "field_work", "review", "other",
]);
export const AssessmentType = z.enum([
    "assignment", "quiz", "exam", "project", "presentation", "oral_defense",
    "participation", "other",
]);
export const ItemType = z.enum([
    "multiple_choice", "multiple_select", "true_false", "short_answer",
    "numeric", "essay", "code", "practical", "other",
]);
export const CHOICE_ITEM_TYPES = new Set(["multiple_choice", "multiple_select", "true_false"]);
export const SubmissionFormat = z.enum([
    "pdf", "docx", "pptx", "notebook", "code_repo", "audio", "video", "image",
    "url", "text", "oral_defense",
]);
/** How hard an item is *meant* to be, as against the rate score-items observes. */
export const ItemDifficulty = z.enum(["easy", "medium", "complex"]);
/** Where an item sits relative to its task. `preparation` is skipped by extract-evidence. */
export const ItemRole = z.enum(["preparation", "main", "followup"]);
/** Where the work arrives, as against what shape it is in. See DeliveryChannel in Python. */
export const DeliveryChannel = z.enum([
    "canvas_upload", "github_repo", "paper_exam", "oral_defense", "presentation",
    "instructor_collected", "other",
]);
export const SubmissionStatus = z.enum([
    "missing", "draft", "submitted", "late", "resubmitted", "withdrawn",
]);
export const EvaluationStatus = z.enum(["suggested", "in_review", "approved", "overridden"]);
export const ConceptStateValue = z.enum([
    "not_observed", "introduced", "developing", "demonstrated",
    "consistently_demonstrated", "needs_review",
]);
export const Severity = z.enum(["low", "medium", "high"]);
export const SignalStatus = z.enum(["open", "acknowledged", "resolved", "dismissed"]);
export const InterventionStatus = z.enum([
    "proposed", "approved", "scheduled", "completed", "cancelled",
]);
export const Priority = z.enum(["low", "medium", "high", "urgent"]);
export const ActionStatus = z.enum(["pending", "in_progress", "done", "dismissed"]);
export const EnrollmentRole = z.enum([
    "student", "auditor", "instructor", "teaching_assistant", "observer",
]);
export const EnrollmentStatus = z.enum(["active", "dropped", "completed", "pending"]);
export const ResourceKind = z.enum([
    "slides", "reading", "dataset", "notebook", "video", "link",
    "textbook_chapter", "tool", "other",
]);
// --------------------------------------------------------------------------
// The base
// --------------------------------------------------------------------------
/** Whitespace-stripped strings, as `str_strip_whitespace=True` does. */
export const trimmed = z.string().transform((value) => value.trim());
/**
 * Every canonical entity: unknown keys refused, `extensions` always present.
 *
 * `.strict()` is the whole of `extra="forbid"`, and applying it here rather
 * than per-schema is deliberate — one schema forgetting it would lose the
 * property for that entity with nothing to show for it.
 */
export const entity = (shape) => z
    .object({
    extensions: z.record(z.string(), z.unknown()).default({}),
    ...shape,
})
    .strict();
export const Provenance = entity({
    produced_by: z.string(),
    model_id: z.string().nullish(),
    workflow_version: z.string().nullish(),
    prompt_version: z.string().nullish(),
    input_refs: z.array(z.string()).default([]),
    created_at: awareDatetime().nullish(),
});
export const EvidenceRef = entity({
    document_id: DocumentId.nullish(),
    location: z.string().nullish(),
    text_reference: z.string().nullish(),
    source_ref: z.string().nullish(),
});
