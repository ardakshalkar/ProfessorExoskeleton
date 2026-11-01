/**
 * What is waiting for the professor, assembled from the record.
 * Ported from `ainar/inbox.py`.
 */

import { drafts } from "./approval.ts";
import {
  activitiesOf,
  allRubrics,
  assessmentById,
  assessmentsOf,
  criterionById,
  enrolledIn,
  itemsOf,
  modulesOf,
  outcomesOf,
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

  // Integrity cases still open: each holds a mark until the professor decides
  // it. The note is not carried — the inbox is read by the session's model.
  const openCases = (((b as any).integrity_cases ?? []) as any[])
    .filter((entry) => entry.course_version_id === courseVersionId && (entry.state ?? "open") === "open" && inScope(entry.student_id))
    .map((entry) => ({
      case_id: entry.case_id,
      student_id: entry.student_id,
      assessments: entry.assessments,
      opened_at: entry.opened_at ?? null,
    }));

  const waiting = drafts(b).filter(
    (draft) => draft.collection !== "evaluations" && draft.collection !== "interventions",
  );

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
    // The whole run, not the subgroup: what is left to build is the course's.
    readiness: readiness(b, courseVersionId, on),
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
    // Everything else an agent wrote that nobody has accepted — materials,
    // meetings, assessments, items, signals — read off the course, where the
    // drafts now live. Grades and interventions are above, in their own
    // sections. Present only when there is one, like `groups`.
    ...(waiting.length ? { drafts_awaiting_approval: waiting } : {}),
    // Present only when there is one, so a run without cases reads as inbox.py's.
    ...(openCases.length ? { open_integrity_cases: openCases } : {}),
  };
};

// ------------------------------------------------------------------ readiness
//
// Mid-term the professor asks what needs deciding; before the term they ask
// what to build, and the list of pending decisions is empty for a course that
// has none. `readiness` answers the second, so an empty inbox is never the
// whole answer. Ported from `readiness` in `ainar/inbox.py`.

const PLACEHOLDER = "TODO";

/**
 * Dependency order, not importance. A rung is worth building only once the one
 * above it exists, so the first unfinished rung is the next real move.
 */
const LADDER = [
  "outcomes",
  "concepts",
  "modules",
  "schedule",
  "assessments",
  "weights",
  "rubrics",
  "roster",
  "materials",
] as const;
type Stage = (typeof LADDER)[number];

/**
 * How much a rung matters, if it is unfinished. `required` — the term cannot
 * run: students cannot be told when to turn up, what they are marked on, or
 * have their work graded at all. `advisable` — the course runs, but the
 * exoskeleton cannot do its job. `optional` — worth doing, not yet worth doing
 * now. Fixed, and deliberately not the professor's to state in a file: it
 * describes the machinery, not the course.
 */
const IMPORTANCE: Record<Stage, string> = {
  outcomes: "required",
  concepts: "advisable",
  modules: "advisable",
  schedule: "required",
  assessments: "required",
  weights: "required",
  rubrics: "required",
  roster: "required",
  materials: "advisable",
};

/**
 * When a rung stops being preparation and becomes a problem. The syllabus goes
 * out on day one, so what a student reads there is due `before_start`; a
 * rubric can follow the syllabus but not the marking; a class list is needed
 * once there is a class; material is due a week at a time.
 */
const DUE: Record<Stage, string> = {
  outcomes: "before_start",
  concepts: "before_start",
  modules: "before_start",
  schedule: "before_start",
  assessments: "before_start",
  weights: "before_start",
  rubrics: "first_assessment",
  roster: "first_week",
  materials: "rolling",
};

/** Inside this many days of a deadline, a thing is worth starting. */
const SOON_DAYS = 21;
const DAYS_IN_WEEK = 7;

const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** `ainar new` writes `TODO` wherever a professor still has to say something. */
const isPlaceholder = (title: unknown): boolean =>
  typeof title === "string" && title.trim().toUpperCase() === PLACEHOLDER;

/**
 * One rung of the ladder. `kind` says whose move it is: a `claim` is the
 * professor's to state and no agent may fill it, a `draft` may be proposed into
 * the course marked `approval: draft`, a `command` is arithmetic.
 */
const rung = (stage: Stage, state: string, detail: string, kind: string, step: string): Record<string, any> => ({
  stage,
  state,
  detail,
  kind,
  next: state === "ready" ? null : step,
});

const stateOf = (present: boolean, complete: boolean): string =>
  !present ? "missing" : complete ? "ready" : "partial";

/**
 * Where in the term the professor is standing. `week` counts from 1 on the
 * first day of teaching; before the term it is null, because week zero is not
 * a week.
 */
export const termPhase = (start: string, end: string, on: string): Record<string, unknown> => {
  if (on < start) return { state: "before", week: null, days_to_start: daysBetween(on, start) };
  const weeks = Math.max(1, Math.floor(daysBetween(start, end) / DAYS_IN_WEEK) + 1);
  if (on > end) return { state: "finished", week: null, weeks };
  return { state: "running", week: Math.floor(daysBetween(start, on) / DAYS_IN_WEEK) + 1, weeks };
};

/**
 * How a single deadline reads from today. `due_now` is a week wide, because
 * these take an evening and the professor reads this list once a week.
 */
const timingOf = (deadline: string | null, on: string): string | null => {
  if (deadline === null) return null;
  if (on > deadline) return "overdue";
  const days = daysBetween(on, deadline);
  if (days <= DAYS_IN_WEEK) return "due_now";
  if (days <= SOON_DAYS) return "soon";
  return "later";
};

const deadlineOf = (stage: Stage, start: string, firstAssessment: string | null): string | null => {
  const when = DUE[stage];
  if (when === "before_start") return start;
  if (when === "first_week") return addDays(start, DAYS_IN_WEEK);
  // No assessment dated yet means the syllabus is the deadline: a rubric nobody
  // can see is not better than one nobody wrote.
  if (when === "first_assessment") return firstAssessment ?? start;
  return null;
};

/** Overdue and required first: the only combination already costing something. */
const TIMING_RANK: Record<string, number> = { overdue: 0, due_now: 1, soon: 2, later: 3 };
const IMPORTANCE_RANK: Record<string, number> = { required: 0, advisable: 1, optional: 2 };

const byRank = (a: Record<string, any>, c: Record<string, any>): number =>
  (TIMING_RANK[a.timing] ?? 4) - (TIMING_RANK[c.timing] ?? 4) ||
  (IMPORTANCE_RANK[a.importance] ?? 3) - (IMPORTANCE_RANK[c.importance] ?? 3) ||
  (a.position ?? 0) - (c.position ?? 0);

/**
 * How far the course has been built, and what to do next.
 *
 * With `on` given, every unfinished rung also carries how much it matters and
 * whether the term has passed the point where it should have been done.
 * Without it there is no calendar to read, so `timing` is null throughout
 * rather than guessed — a course is late against its own dates or against
 * nothing.
 *
 * Naming a gap is not filling it. This reports that an outcome is missing and
 * who has to state it; it never says what the outcome should be, and it never
 * proposes a weight.
 */
export const readiness = (b: CourseBundle, courseVersionId: string, on: string | null = null): Record<string, unknown> => {
  const courseId = b.course.course_id as string;
  const assessments = assessmentsOf(b, courseVersionId);
  const assessmentIds = new Set(assessments.map((a) => a.assessment_id as string));
  const submissions = (b.submissions as any[]).filter((s) => assessmentIds.has(s.assessment_id));
  const stages: Record<string, any>[] = [];

  // Outcomes carry the evidence of every later term, so a guessed one is the
  // mistake that costs most to find. It stays the professor's sentence.
  const outcomes = outcomesOf(b, courseId);
  const todo = outcomes.filter((outcome) => isPlaceholder(outcome.title));
  stages.push(
    rung(
      "outcomes",
      stateOf(outcomes.length > 0, !todo.length),
      outcomes.length
        ? `${outcomes.length - todo.length} of ${outcomes.length} outcomes stated`
        : "no learning outcomes authored",
      "claim",
      "/onboard-course — ask for them in the professor's own words",
    ),
  );

  const concepts = (b.concepts as any[]).filter((concept) => concept.course_id === courseId);
  const blank = concepts.filter((concept) => isPlaceholder(concept.title));
  // A prerequisite is written either on the concept or as a standalone edge,
  // and a map with neither is a list of topics rather than a structure.
  const edges =
    concepts.reduce((sum, concept) => sum + (concept.prerequisites ?? []).length, 0) +
    ((b as any).concept_edges ?? []).length;
  stages.push(
    rung(
      "concepts",
      stateOf(concepts.length > 0, !blank.length),
      concepts.length
        ? `${concepts.length - blank.length} of ${concepts.length} concepts named, ${edges} prerequisite edges`
        : "no concept map",
      "draft",
      "/propose-concepts — from a syllabus or teaching material they supply",
    ),
  );

  const modules = modulesOf(b, courseId);
  const unnamed = modules.filter((module) => isPlaceholder(module.title));
  stages.push(
    rung(
      "modules",
      stateOf(modules.length > 0, !unnamed.length),
      modules.length ? `${modules.length - unnamed.length} of ${modules.length} weeks named` : "no weekly modules",
      "draft",
      "/plan-term",
    ),
  );

  const activities = activitiesOf(b, courseVersionId);
  const undated = activities.filter((activity) => !activity.scheduled_at);
  stages.push(
    rung(
      "schedule",
      stateOf(activities.length > 0, !undated.length),
      activities.length ? `${activities.length} meetings, ${undated.length} without a date` : "no meetings scheduled",
      "draft",
      "/plan-term",
    ),
  );

  // The scaffold ships one `TODO` assessment so the run validates, and every
  // rung below this counts only the real ones — a placeholder that weighs 1.0
  // would otherwise report a course with no assessments as fully weighted.
  const real = assessments.filter((assessment) => !isPlaceholder(assessment.title));
  stages.push(
    rung(
      "assessments",
      stateOf(assessments.length > 0, real.length > 0 && real.length === assessments.length),
      assessments.length ? `${real.length} of ${assessments.length} assessments named` : "nothing assessed yet",
      "draft",
      "/plan-term for the midterm and final shells, /design-assessment for the instrument",
    ),
  );

  // A weight is a claim. Anything missing here is a question for the
  // professor, not a gap to close.
  const unweighted = real.filter((a) => a.weight === null || a.weight === undefined);
  const total = real.reduce((sum, a) => sum + (a.weight ?? 0), 0);
  const weightsDetail = !real.length
    ? "no assessments to weight yet"
    : unweighted.length
      ? `${unweighted.length} of ${real.length} assessments carry no weight`
      : `weights sum to ${total.toFixed(3)}`;
  stages.push(
    rung(
      "weights",
      stateOf(real.length > 0 && !unweighted.length, Math.abs(total - 1) <= 0.001),
      weightsDetail,
      "claim",
      "ask the professor — never choose a weight",
    ),
  );

  // An assessment with neither a rubric nor items cannot be marked at all; a
  // criterion naming no outcome produces marks but no evidence, which is the
  // quieter failure of the two.
  const rubrics = allRubrics(b);
  const marked = new Map(
    real.map((a) => [a.assessment_id as string, a.rubric ?? (a.rubric_id ? rubrics.get(a.rubric_id) ?? null : null)]),
  );
  const unmarkable = real.filter((a) => !marked.get(a.assessment_id) && !itemsOf(b, a.assessment_id).length);
  const orphans = [...marked.values()]
    .filter(Boolean)
    .flatMap((rubric) => (rubric.criteria ?? []) as any[])
    .filter((criterion) => !criterion.outcome_id);
  const rubricDetail = !real.length
    ? "no assessments to mark yet"
    : unmarkable.length
      ? `${unmarkable.length} assessments have neither a rubric nor items`
      : orphans.length
        ? `${orphans.length} criteria name no outcome, so they produce no evidence`
        : `${real.length} assessments are markable`;
  stages.push(
    rung(
      "rubrics",
      stateOf(real.length > 0 && !unmarkable.length, !orphans.length),
      rubricDetail,
      "draft",
      "/design-assessment",
    ),
  );

  const students = enrolledIn(b, courseVersionId);
  stages.push(
    rung(
      "roster",
      stateOf(students.length > 0, true),
      students.length ? `${students.length} students enrolled` : "no class list imported",
      "command",
      `ainar roster import <export.csv> --course-version ${courseVersionId}`,
    ),
  );

  // Material is the one rung that is partial for most of a healthy term: it is
  // drafted a week at a time, and being ahead of the class is not the goal.
  const covered = new Set<string>([
    ...(b.documents as any[]).filter((document) => document.module_id).map((document) => document.module_id),
    ...activities.filter((a) => a.module_id && a.resources?.length).map((a) => a.module_id),
  ]);
  const taught = modules.filter((module) => covered.has(module.module_id));
  stages.push(
    rung(
      "materials",
      stateOf(taught.length > 0, modules.length > 0 && taught.length === modules.length),
      modules.length ? `${taught.length} of ${modules.length} modules have material` : "no modules to teach yet",
      "draft",
      "/make-materials, or /prepare-lesson for the next session",
    ),
  );

  // Importance is fixed per rung; timing comes from the run's own dates. Both
  // are computed here rather than left to the agent: "do not invent urgency"
  // is only enforceable if the urgency is in the data.
  const run = runById(b).get(courseVersionId) as any;
  const dated = real.filter((a) => a.due_at).map((a) => (a.due_at as string).slice(0, 10)).sort();
  const firstAssessment = dated[0] ?? null;
  const phase = on ? termPhase(run.start_date, run.end_date, on) : null;

  stages.forEach((entry, position) => {
    entry.position = position;
    entry.importance = IMPORTANCE[entry.stage as Stage];
    entry.due = DUE[entry.stage as Stage];
    entry.timing =
      on !== null && entry.stage !== "materials"
        ? timingOf(deadlineOf(entry.stage, run.start_date, firstAssessment), on)
        : null;
  });

  // Material reports per week, because that is the only way "you are in week 3
  // and week 3 has nothing" can be said at all. Its importance decays with
  // distance: week nine in week one is `optional` and not a gap.
  const materials = stages[LADDER.indexOf("materials")]!;
  const items = [...modules]
    .sort(
      (a, c) =>
        (a.week || 0) - (c.week || 0) || (a.order || 0) - (c.order || 0) || a.module_id.localeCompare(c.module_id),
    )
    .filter((module) => !covered.has(module.module_id))
    .map((module) => {
      let timing: string | null = null;
      if (on !== null && module.week !== null && module.week !== undefined) {
        const opens = addDays(run.start_date, (module.week - 1) * DAYS_IN_WEEK);
        const closes = addDays(opens, DAYS_IN_WEEK - 1);
        // The week the class is in is `due_now`: nothing is late yet, and it is
        // not a week away either.
        timing = on > closes ? "overdue" : on >= opens ? "due_now" : timingOf(opens, on);
      }
      return {
        id: module.module_id,
        label: module.week ? `week ${module.week}` : module.module_id,
        title: isPlaceholder(module.title) ? null : module.title,
        detail: "no slides, handout or resource for this week",
        timing,
        // A week being taught needs its material; a week a month away does not,
        // and calling both `advisable` says neither.
        importance:
          timing === "overdue" || timing === "due_now" ? "required" : timing === "soon" ? "advisable" : "optional",
        position: module.week || 0,
        next: "/make-materials, or /prepare-lesson if it is the next session",
      };
    });
  materials.items = items;
  materials.timing =
    items
      .map((item) => item.timing)
      .filter((timing): timing is string => timing !== null)
      .sort((a, c) => TIMING_RANK[a]! - TIMING_RANK[c]!)[0] ?? null;

  const unfinished = stages.filter((entry) => entry.state !== "ready");

  // One flat list, because the question is "which of these first" and a rung
  // is not comparable to a week until they sit in the same ordering.
  const checklist: Record<string, any>[] = [
    ...unfinished
      .filter((entry) => entry.stage !== "materials")
      .map((entry) => ({
        id: entry.stage,
        label: entry.stage,
        detail: entry.detail,
        importance: entry.importance,
        timing: entry.timing,
        kind: entry.kind,
        next: entry.next,
        position: entry.position,
      })),
    ...items.map((item) => ({ ...item, kind: "draft" })),
  ].sort(byRank);

  return {
    has_student_work: submissions.length > 0,
    phase,
    stages,
    unfinished: unfinished.length,
    next_step: unfinished[0] ?? null,
    checklist,
    // What a professor asked "am I behind?" should be shown, and nothing else.
    // An empty list is an answer; a long one is not a licence to reorder it.
    reminders: checklist.filter((entry) => entry.timing === "overdue" && entry.importance === "required"),
    by_importance: Object.fromEntries(
      ["required", "advisable", "optional"].map((level) => [
        level,
        checklist.filter((entry) => entry.importance === level).map((entry) => entry.id),
      ]),
    ),
  };
};