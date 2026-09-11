/**
 * What is waiting for the professor, assembled from the record.
 * Ported from `ainar/inbox.py`.
 */

import {
  allRubrics,
  assessmentById,
  assessmentsOf,
  criterionById,
  enrolledIn,
  itemsOf,
  runById,
  type CourseBundle,
} from "./bundle.ts";

const LOW_CONFIDENCE = 0.6;
const DUE_SOON_DAYS = 7;

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const inboxPayload = (
  b: CourseBundle,
  courseVersionId: string,
  on: string,
  options: { groups?: readonly string[] | null } = {},
): Record<string, unknown> => {
  const groups = (options.groups ?? []).map((group) => group.trim()).filter(Boolean);
  const run = runById(b).get(courseVersionId) as any;
  const assessments = assessmentsOf(b, courseVersionId);
  const assessmentIds = new Set(assessments.map((a) => a.assessment_id as string));
  const submissions = (b.submissions as any[]).filter((s) => assessmentIds.has(s.assessment_id));
  const criteria = criterionById(b);
  const rubrics = allRubrics(b);
  const submissionById = new Map(submissions.map((s) => [s.submission_id as string, s]));

  const activeStudents = new Set(
    enrolledIn(b, courseVersionId, { groups }).map((e) => e.student_id as string),
  );

  /*
   * Narrowing to a subgroup narrows the work as well as the class.
   *
   * `enrolled` and `missing` come off `activeStudents`, so they follow the
   * filter on their own. Pending evaluations do not — they hang off
   * submissions, which name a student but not a group — so a subgroup's inbox
   * would otherwise report the whole class's ungraded pile beside its own
   * three missing submissions, which is worse than not filtering at all.
   */
  const inScope = (studentId: string): boolean =>
    !groups.length || activeStudents.has(studentId);

  // ------------------------------------------------------------ evaluations
  const pending = (b.evaluations as any[]).filter(
    (evaluation) =>
      submissionById.has(evaluation.submission_id) &&
      !evaluation.professor_decision &&
      inScope(submissionById.get(evaluation.submission_id)!.student_id as string),
  );

  const byAssessment = new Map<string, Record<string, unknown>>();
  for (const evaluation of pending) {
    const assessmentId = submissionById.get(evaluation.submission_id)!.assessment_id as string;
    let entry = byAssessment.get(assessmentId);
    if (!entry) {
      entry = { assessment_id: assessmentId, title: "", pending: 0, low_confidence: 0 };
      byAssessment.set(assessmentId, entry);
    }
    (entry.pending as number) = (entry.pending as number) + 1;
    const confidence = evaluation.ai_suggestion?.confidence ?? null;
    if (confidence !== null && confidence < LOW_CONFIDENCE) {
      (entry.low_confidence as number) = (entry.low_confidence as number) + 1;
    }
  }
  for (const entry of byAssessment.values()) {
    const assessment = assessmentById(b).get(entry.assessment_id as string) as any;
    entry.title = assessment ? assessment.title : "";
  }

  const lowConfidence = pending
    .filter(
      (evaluation) =>
        evaluation.ai_suggestion &&
        evaluation.ai_suggestion.confidence !== null &&
        evaluation.ai_suggestion.confidence !== undefined &&
        evaluation.ai_suggestion.confidence < LOW_CONFIDENCE,
    )
    .map((evaluation) => {
      const criterion = criteria.get(evaluation.criterion_id);
      return {
        evaluation_id: evaluation.evaluation_id,
        submission_id: evaluation.submission_id,
        criterion_id: evaluation.criterion_id,
        criterion_title: criterion ? criterion.title : null,
        suggested_score: evaluation.ai_suggestion?.score ?? null,
        maximum_score: criterion ? criterion.maximum_score : null,
        confidence: evaluation.ai_suggestion?.confidence ?? null,
        comment: evaluation.ai_suggestion?.comment ?? null,
      };
    });

  // -------------------------------------------------------------- deadlines
  const assessmentState = assessments.map((assessment) => {
    const rubric = assessment.rubric_id ? rubrics.get(assessment.rubric_id) : assessment.rubric;
    const received = new Set(
      submissions
        .filter((s) => s.assessment_id === assessment.assessment_id && inScope(s.student_id))
        .map((s) => s.student_id as string),
    );
    const due = assessment.due_at ? (assessment.due_at as string).slice(0, 10) : null;
    let status: string;
    if (due === null) status = "undated";
    else if (due < on) status = "closed";
    else if (daysBetween(on, due) <= DUE_SOON_DAYS) status = "due_soon";
    else status = "upcoming";

    return {
      assessment_id: assessment.assessment_id,
      title: assessment.title,
      type: assessment.type,
      weight: assessment.weight ?? null,
      due_at: assessment.due_at ?? null,
      // How much there is to grade WITH, which is not the same question as how
      // it is graded. A quiz is scored from its items and needs no rubric; an
      // assignment a person reads needs criteria and has no items. Publishing
      // both counts lets a reader say "nothing can mark this" without the view
      // guessing which of the two a given type ought to have — the mistake that
      // would flag ten perfectly gradeable quizzes as unfinished.
      // Whether a rubric exists, not what it says.
      //
      // The same field, computed the same way, as `outline`'s `assessmentEntry`
      // — deliberately, because the inbox and the term plan must not disagree
      // about whether a piece of work can be marked at all. An assessment with
      // no criteria cannot be graded by anybody, model or professor, so it
      // belongs on the list of what is not ready rather than only in a survey
      // one tab away.
      criteria: rubric ? ((rubric.criteria ?? []) as unknown[]).length : 0,
      items: itemsOf(b, assessment.assessment_id as string).length,
      status,
      enrolled: activeStudents.size,
      submissions_received: received.size,
      // Nobody is late for a deadline nobody set.
      //
      // `missing` was every active student for any status but `upcoming`, which
      // swept `undated` in with `closed`: work whose dates the professor has not
      // chosen yet was reported as a whole class failing to hand it in, and on a
      // run of seventy-four that was seventy-four names in one row. An undated
      // assessment has not been assigned, so nothing about it is outstanding —
      // what it needs is a date, which the inbox now asks for in its own
      // section rather than as an accusation in this one.
      missing:
        status === "upcoming" || status === "undated"
          ? []
          : [...activeStudents].filter((s) => !received.has(s)).sort(),
    };
  });

  // ---------------------------------------------------------------- signals
  // A signal or an intervention with no student is about the class, so it
  // belongs in every subgroup's inbox. One naming a student belongs only in
  // theirs.
  const openSignals = (b.signals as any[])
    .filter(
      (signal) =>
        signal.course_version_id === courseVersionId &&
        signal.status === "open" &&
        (!signal.student_id || inScope(signal.student_id)),
    )
    .map((signal) => ({
      signal_id: signal.signal_id,
      student_id: signal.student_id ?? null,
      type: signal.type,
      severity: signal.severity,
      description: signal.description,
      concepts: signal.concepts,
      evidence_count: signal.evidence_ids.length,
      detected_at: signal.detected_at ?? null,
      has_intervention: (b.interventions as any[]).some(
        (intervention) => intervention.signal_id === signal.signal_id,
      ),
    }));

  const awaitingApproval = (b.interventions as any[])
    .filter(
      (intervention) =>
        intervention.course_version_id === courseVersionId &&
        intervention.status === "proposed" &&
        (!intervention.student_id || inScope(intervention.student_id)),
    )
    .map((intervention) => ({
      intervention_id: intervention.intervention_id,
      signal_id: intervention.signal_id ?? null,
      student_id: intervention.student_id ?? null,
      type: intervention.type,
      description: intervention.description,
      proposed_by: intervention.proposed_by ?? null,
      scheduled_at: intervention.scheduled_at ?? null,
    }));

  // ----------------------------------------------------------------- events
  // Timestamps are ISO strings carrying their offset, so a lexical sort would
  // order `+05:00` against `Z` wrongly. Compare the instants.
  const events = (b.events as any[])
    .filter((event) => event.course_version_id === courseVersionId)
    .sort((a, c) => Date.parse(c.occurred_at) - Date.parse(a.occurred_at));

  const existing = (b.action_items as any[])
    .filter((action) => action.course_version_id === courseVersionId)
    .map((action) => ({
      action_id: action.action_id,
      type: action.type,
      title: action.title,
      priority: action.priority,
      status: action.status,
      due_at: action.due_at ?? null,
      source_event_id: action.source_event_id ?? null,
    }));

  return {
    run: {
      id: courseVersionId,
      title: b.course.title,
      term: run.term,
      instructors: run.instructors,
      enrolled_students: activeStudents.size,
    },
    // Present only when it is a real filter; absence is the whole run, and is
    // what keeps an unnarrowed payload identical to inbox.py's.
    ...(groups.length ? { groups } : {}),
    as_of: on,
    pending_evaluations: {
      total: pending.length,
      by_assessment: [...byAssessment.values()].sort(
        (a, c) => (c.pending as number) - (a.pending as number),
      ),
      low_confidence: lowConfidence,
    },
    assessments: assessmentState,
    open_signals: openSignals,
    interventions_awaiting_approval: awaitingApproval,
    recent_events: events.slice(0, 20).map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      entity_id: event.entity_id ?? null,
      occurred_at: event.occurred_at,
      payload: event.payload,
    })),
    existing_action_items: existing,
  };
};
