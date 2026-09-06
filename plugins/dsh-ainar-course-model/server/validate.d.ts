/**
 * Referential integrity and coverage checks. A **complete** port of
 * `ainar/validate.py` — all 94 codes, as of Phase 4 of `docs/node-migration.md`.
 *
 * It was partial for a long time and said so, because a validator that silently
 * checks half of what the professor thinks it checks is worse than one that
 * admits the gap. `coverage()` still exists and still reports the ratio; it now
 * reports 94 of 94, and `tests/test_validate.py` fails if `validate.py` grows a
 * code this file has not.
 *
 * **Every check is verified against `golden/validator/`**, a corpus that breaks
 * the example course one way at a time and records what `validate.py` said. That
 * is the whole safety argument: 98 mutations, one per failure mode, and message
 * text is part of the contract — the fixtures compare it exactly. A check with no
 * mutation behind it is a check nobody has seen fire, so it does not belong here.
 *
 * Two classes of bug the corpus caught that review would not have:
 *
 * * `[]` is falsy in Python and truthy in JavaScript, so `if not outcome.level`
 *   and `if (!outcome.level)` disagree about an outcome with no cognitive level.
 * * `_check_items` and `_check_runtime` both emit `ref.assessment` with different
 *   wording. Porting one site and registering the code hid the other.
 *
 * `document.missing_file` is the one check the corpus structurally cannot reach —
 * it needs a filesystem and the corpus validates an in-memory bundle. It is
 * covered by `test/validate.test.ts` instead.
 */
import { type CourseBundle } from "./bundle.ts";
import { IssueList, type Issue } from "./issues.ts";
/** Every code `validate.py` can emit. Kept sorted; `TOTAL_CODES` is its length. */
export declare const IMPLEMENTED: readonly ["assessment.design_count", "assessment.design_marks", "assessment.design_scope", "assessment.no_rubric", "assessment.no_submission_type", "capability.level_out_of_range", "capability.unevidenced", "claim.unapproved_proposal", "concept.duplicate_name", "coverage.unassessed_outcome", "coverage.untaught_concept", "coverage.untaught_outcome", "coverage.unused_capability", "criterion.no_outcome", "date.order", "delivery.contradiction", "delivery.unreachable", "document.checksum", "document.duplicate_key", "document.missing_file", "enrollment.duplicate", "evaluation.pending_override", "evaluation.unapproved", "evaluation.unstamped", "evidence.untargeted", "graph.cycle", "graph.self_loop", "id.convention", "id.duplicate", "id.unapproved_draft", "intervention.unapproved", "item.criterion_score_mismatch", "item.difficulty_mismatch", "item.model_mismatch", "item.no_concepts", "item.no_options", "item.number_clash", "item.score_mismatch", "item.unmarked", "lms.duplicate_link", "lms.duplicate_tab", "lms.malformed", "lms.partial_links", "lms.sheet_url", "lms.tab_without_sheet", "lms.unsupported_target", "module.no_outcomes", "module.week_clash", "notion.database_url", "notion.malformed", "notion.partial", "notion.unknown_key", "outcome.level", "presentation.duration", "presentation.slide_limit", "privacy.identifier", "provenance.missing", "ref.assessment", "ref.capability", "ref.concept", "ref.course", "ref.course_run", "ref.course_version", "ref.criterion", "ref.document", "ref.event", "ref.evidence", "ref.item", "ref.item_model", "ref.module", "ref.option", "ref.outcome", "ref.resource", "ref.rubric", "ref.signal", "ref.submission", "ref.user", "ref.version_mismatch", "resource.no_location", "response.student_mismatch", "rubric.empty", "rubric.score_mismatch", "run.no_assessments", "run.no_instructor", "schedule.no_module", "schedule.outside_run", "schedule.slot_clash", "schedule.week_mismatch", "score.out_of_range", "signal.no_evidence", "version.missing", "version.no_outcomes", "weight.partial", "weight.sum"];
/** `validate.py`'s total, asserted against it by `tests/test_validate.py`. */
export declare const TOTAL_CODES = 94;
export declare const coverage: () => {
    implemented: 94;
    total: number;
    note: string;
};
export declare const validate: (b: CourseBundle, options?: {
    draftsMerged?: boolean;
    root?: string;
}) => IssueList;
/** The fixture shape: issues sorted the way `ainar golden` sorts them. */
export declare const validatePayload: (b: CourseBundle) => {
    issues: Issue[];
};
