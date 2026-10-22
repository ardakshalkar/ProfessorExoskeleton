/**
 * Criterion decisions to an assessment score, and nothing more clever.
 * Ported from `ainar/gradebook.py`.
 *
 * The four refusals are the whole module, and each one fails **silently** if
 * mistranslated — a wrong total looks exactly like a right total. They are:
 *
 * 1. Only decisions count. `approved`/`overridden`, read from
 *    `professor_decision`. A suggestion never becomes a grade.
 * 2. A missing judgement is not a zero. Undecided → `partially_graded`, not
 *    exportable; never submitted → `score: null`, never 0 — unless the
 *    professor's policy says so (`missing_work: zero`, `missingWorkOf`), and
 *    then only once the due date has passed.
 * 3. Nothing is rescaled silently. Criteria summing to 90 against a maximum of
 *    100 blocks the row rather than stretching it. The one stretch is the
 *    professor's own: an assessment's `curve`, applied to the total after
 *    totalling, with the raw total kept beside it as `raw_score`.
 * 4. Only the professor's words travel. Row comments come from
 *    `professor_decision.comment` alone.
 *
 * One more decision is read after totalling: an academic-integrity case on the
 * student's work (`src/integrity.ts`). Open, it holds the row (`held`, not
 * exportable, counted as outstanding); upheld, `zero` makes the score 0 and
 * `voided` takes the assessment out of the student's total. Any case not
 * cleared keeps the student off the curve. A row a case touches says so in
 * `integrity`, and loses its comment — the case is never a student's to read
 * through a feedback field.
 */

import {
  allRubrics,
  assessmentsOf,
  enrolledIn,
  itemsOf,
  runById,
  type CourseBundle,
} from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";
import { caseIndex } from "./integrity.ts";
import { lmsScale, rescales } from "./lms-scale.ts";

export const GRADEBOOK_VERSION = "gradebook/2026.08.1";
const TOLERANCE = 0.01;
const DECIDED = new Set(["approved", "overridden"]);
const NOT_HANDED_IN = new Set(["missing", "withdrawn"]);
const GRADED_ROLES = new Set(["student", "auditor"]);

export interface CriterionScore {
  criterion_id: string;
  title: string;
  maximum: number;
  score: number | null;
  source: string | null;
  status: string;
  comment: string | null;
  note: string | null;
}

export interface GradeRow {
  student_id: string;
  assessment_id: string;
  maximum: number;
  submission_id: string | null;
  status: string;
  /** What counts: the curved total when the assessment has a curve. */
  score: number | null;
  /** The criteria's own total, set only when a curve was applied to it. */
  raw_score?: number | null;
  criteria: CriterionScore[];
  comment: string | null;
  blocked: string[];
  /** The integrity case deciding this mark, when there is one. */
  integrity?: { case_id: string; state: string; outcome: string | null };
}

/**
 * What a case does to a totalled row. Cleared, nothing. The reason is never
 * written into the row: `blocked` names the case by id, for the professor.
 */
const settle = (row: GradeRow, integrity: any | null): GradeRow => {
  if (!integrity) return row;
  const state = integrity.state ?? "open";
  row.integrity = { case_id: integrity.case_id, state, outcome: integrity.outcome ?? null };
  if (state === "cleared") return row;
  row.comment = null;
  if (state === "open") {
    row.status = "held";
    row.blocked.push(`integrity case ${integrity.case_id} is open — the mark is held until it is decided`);
  } else if (integrity.outcome === "zero") {
    row.status = "graded";
    row.score = 0;
    delete row.raw_score;
    row.blocked = [];
  } else if (integrity.outcome === "voided") {
    row.status = "voided";
    row.score = null;
    delete row.raw_score;
    row.blocked = [`voided by integrity case ${integrity.case_id}`];
  }
  return row;
};

/** Python's `%g`: shortest representation, no trailing zeros. */
export const g = (value: number): string => String(Number(value.toPrecision(6)));

const criterion = (source: any, extra: Partial<CriterionScore> = {}): CriterionScore => ({
  criterion_id: source.criterion_id,
  title: source.title,
  maximum: source.maximum_score,
  score: null,
  source: null,
  status: "missing",
  comment: null,
  note: null,
  ...extra,
});

const fromItems = (
  spec: any,
  items: any[],
  responses: Map<string, any>,
): CriterionScore => {
  const resolved = criterion(spec);
  const itemMaximum = items.reduce((sum, item) => sum + item.maximum_score, 0);
  const present = items
    .map((item) => responses.get(item.item_id))
    .filter((response) => response && response.score !== null && response.score !== undefined);
  // A score nobody has accepted is not a grade. `score-items` marks what it
  // scores `approval: draft`, and it counts here once the professor says so.
  const drafted = present.filter((response) => response.approval === "draft");
  const scored = present.filter((response) => response.approval !== "draft");

  if (scored.length < items.length) {
    resolved.note = drafted.length
      ? `${scored.length} of ${items.length} items scored and approved — ` +
        `${drafted.length} scored but still marked approval: draft`
      : `${scored.length} of ${items.length} items scored — the rest need a human`;
    return resolved;
  }
  if (Math.abs(itemMaximum - spec.maximum_score) > TOLERANCE) {
    resolved.status = "unusable";
    resolved.note =
      `items sum to ${g(itemMaximum)} but the criterion maximum is ${g(spec.maximum_score)}, ` +
      "so an item-derived score is on the wrong scale — fix one of the two rather than rescaling";
    return resolved;
  }
  resolved.score = roundHalfEven(scored.reduce((sum, r) => sum + r.score, 0), 2);
  resolved.source = "items";
  resolved.status = "scored";
  return resolved;
};

/** A decision always wins: a human looked at the work. */
export const resolveCriterion = (
  spec: any,
  evaluations: Map<string, any>,
  items: any[],
  responses: Map<string, any>,
): CriterionScore => {
  const evaluation = evaluations.get(spec.criterion_id);
  const decision =
    evaluation && DECIDED.has(evaluation.status) ? evaluation.professor_decision : null;

  if (decision) {
    const resolved = criterion(spec, {
      score: decision.score,
      source: "decision",
      status: "decided",
      comment: decision.comment ?? null,
    });
    if (decision.score > spec.maximum_score + TOLERANCE) {
      resolved.status = "unusable";
      resolved.note = `decided score ${g(decision.score)} exceeds the criterion maximum ${g(spec.maximum_score)}`;
    } else if (items.length) {
      resolved.note = "items were scored too; the decision takes precedence";
    }
    return resolved;
  }

  if (items.length) return fromItems(spec, items, responses);
  return criterion(spec, { note: "no professor decision" });
};

/** The attempt that counts: highest attempt, then latest timestamp. */
const latestSubmission = (submissions: any[]): any | null => {
  const live = submissions.filter((s) => !NOT_HANDED_IN.has(s.status));
  if (!live.length) return null;
  return live.reduce((best, s) => {
    const key = (x: any) => [x.attempt, x.submitted_at ? Date.parse(x.submitted_at) : 0];
    const [ba, bt] = key(best);
    const [sa, st] = key(s);
    return sa > ba || (sa === ba && st > bt) ? s : best;
  });
};

const assessmentIssues = (assessment: any, criteria: any[]): string[] => {
  if (!criteria.length) return ["assessment has no rubric criteria, so there is nothing to total"];
  const total = criteria.reduce((sum, c) => sum + c.maximum_score, 0);
  if (Math.abs(total - assessment.maximum_score) > TOLERANCE) {
    return [
      `criteria sum to ${g(total)} but maximum_score is ${g(assessment.maximum_score)} — ` +
        "no score is exported until these agree, because the alternative is a silent rescale",
    ];
  }
  return [];
};

/** The assessment's curve when it is in force — a curve still `approval: draft` is not. */
export const curveOf = (assessment: any): any | null =>
  assessment?.curve && assessment.curve.approval !== "draft" ? assessment.curve : null;

/**
 * The rule for work not handed in: the assessment's own, else the run's,
 * else `blank`. A zero is the professor's decision, written in the policy;
 * nothing here infers one.
 */
export const missingWorkOf = (run: any, assessment: any): "blank" | "zero" =>
  (assessment?.missing_work ?? run?.grading_scheme?.missing_work ?? "blank") === "zero" ? "zero" : "blank";

/** Whether the work is missing rather than not due yet: no due date, never. */
const pastDue = (assessment: any, now: number): boolean => {
  const due = assessment?.due_at ? Date.parse(assessment.due_at) : NaN;
  return Number.isFinite(due) && due < now;
};

/** `maximum × (raw / anchor) ^ exponent`, never above the maximum. */
export const curved = (raw: number, curve: any, maximum: number): number =>
  roundHalfEven(Math.min(maximum, maximum * Math.pow(Math.max(0, raw) / curve.anchor, curve.exponent)), 2);

export const percent = (row: GradeRow): number | null =>
  row.score === null || !row.maximum ? null : roundHalfEven((row.score / row.maximum) * 100, 1);

export const exportable = (row: GradeRow): boolean => row.score !== null && !row.blocked.length;

const rowAsDict = (row: GradeRow): Record<string, unknown> => ({
  student_id: row.student_id,
  assessment_id: row.assessment_id,
  submission_id: row.submission_id,
  status: row.status,
  score: row.score,
  ...(row.raw_score !== undefined ? { raw_score: row.raw_score } : {}),
  maximum: row.maximum,
  percent: percent(row),
  comment: row.comment,
  exportable: exportable(row),
  blocked: [...row.blocked],
  criteria: row.criteria.map((c) => ({ ...c })),
  ...(row.integrity ? { integrity: { ...row.integrity } } : {}),
});

export const gradeRows = (
  b: CourseBundle,
  courseVersionId: string,
  options: {
    assessmentId?: string | null;
    allowPartial?: boolean;
    groups?: readonly string[] | null;
    /** The moment a due date is measured against; tests pin it. */
    now?: number;
  } = {},
): Map<string, GradeRow[]> => {
  const { assessmentId = null, allowPartial = false, groups = null, now = Date.now() } = options;
  const run = runById(b).get(courseVersionId) as any;
  const assessments = assessmentsOf(b, courseVersionId).filter(
    (a) => assessmentId === null || a.assessment_id === assessmentId,
  );
  const students = enrolledIn(b, courseVersionId, { roles: GRADED_ROLES, groups })
    .map((e) => e.student_id as string)
    .sort();

  const bySubmission = new Map<string, Map<string, any>>();
  for (const evaluation of b.evaluations as any[]) {
    const table = bySubmission.get(evaluation.submission_id) ?? new Map();
    table.set(evaluation.criterion_id, evaluation);
    bySubmission.set(evaluation.submission_id, table);
  }
  const responsesBySubmission = new Map<string, Map<string, any>>();
  for (const response of b.item_responses as any[]) {
    const table = responsesBySubmission.get(response.submission_id) ?? new Map();
    table.set(response.item_id, response);
    responsesBySubmission.set(response.submission_id, table);
  }
  const cases = caseIndex(b, courseVersionId);

  const out = new Map<string, GradeRow[]>();
  for (const assessment of assessments) {
    const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
    const criteria: any[] = rubric ? [...rubric.criteria] : [];
    const itemsByCriterion = new Map<string, any[]>();
    for (const item of itemsOf(b, assessment.assessment_id)) {
      if (!item.criterion_id) continue;
      itemsByCriterion.set(item.criterion_id, [...(itemsByCriterion.get(item.criterion_id) ?? []), item]);
    }
    const structural = assessmentIssues(assessment, criteria);
    const curve = curveOf(assessment);
    const zeroMissing = missingWorkOf(run, assessment) === "zero" && pastDue(assessment, now);

    const submissionsByStudent = new Map<string, any[]>();
    for (const submission of b.submissions as any[]) {
      if (submission.assessment_id !== assessment.assessment_id) continue;
      submissionsByStudent.set(submission.student_id, [
        ...(submissionsByStudent.get(submission.student_id) ?? []),
        submission,
      ]);
    }

    const rows: GradeRow[] = [];
    for (const studentId of students) {
      const row: GradeRow = {
        student_id: studentId,
        assessment_id: assessment.assessment_id,
        maximum: assessment.maximum_score,
        submission_id: null,
        status: "not_submitted",
        score: null,
        criteria: [],
        comment: null,
        blocked: [...structural],
      };
      const integrity = cases.get(`${studentId}|${assessment.assessment_id}`) ?? null;
      // A case not cleared takes the paper off the curve: it counts as marked.
      const offCurve = (curve?.exclude ?? []).includes(studentId) || (integrity !== null && integrity.state !== "cleared");

      const submission = latestSubmission(submissionsByStudent.get(studentId) ?? []);
      if (!submission) {
        // Status stays `not_submitted`, so every count still says who handed
        // nothing in; the 0 is what the policy gives it, and it is sent. A
        // structural problem still blocks it, like any other score.
        if (zeroMissing) row.score = 0;
        else row.blocked.push("no submission");
        rows.push(settle(row, integrity));
        continue;
      }

      row.submission_id = submission.submission_id;
      if (!criteria.length) {
        row.status = "no_rubric";
        rows.push(settle(row, integrity));
        continue;
      }

      const evaluations = bySubmission.get(submission.submission_id) ?? new Map();
      const responses = responsesBySubmission.get(submission.submission_id) ?? new Map();
      row.criteria = criteria.map((spec) =>
        resolveCriterion(spec, evaluations, itemsByCriterion.get(spec.criterion_id) ?? [], responses),
      );

      const usable = row.criteria.filter((c) => c.score !== null);
      const unusable = row.criteria.filter((c) => c.status === "unusable");
      const undecided = row.criteria.filter((c) => c.status === "missing");

      if (unusable.length) {
        row.blocked.push(...unusable.filter((c) => c.note).map((c) => `${c.criterion_id}: ${c.note}`));
      }
      if (undecided.length) {
        row.status = "partially_graded";
        if (!allowPartial) {
          row.blocked.push(
            `${undecided.length} of ${row.criteria.length} criteria undecided: ` +
              undecided.map((c) => c.criterion_id).join(", "),
          );
        }
      } else if (!unusable.length) {
        row.status = "graded";
      }

      if (usable.length) {
        row.score = roundHalfEven(usable.reduce((sum, c) => sum + (c.score as number), 0), 2);
        if (curve && !offCurve) {
          row.raw_score = row.score;
          row.score = curved(row.score, curve, row.maximum);
        }
      }
      const comments = row.criteria.filter((c) => c.comment).map((c) => `${c.title}: ${c.comment}`);
      row.comment = comments.length ? comments.join("\n") : null;
      rows.push(settle(row, integrity));
    }

    out.set(assessment.assessment_id, rows);
  }
  return out;
};

/** The shape of the batch, over graded rows **only** — a blank is not a zero. */
const shape = (scores: number[]) => {
  const sorted = [...scores].sort((a, b2) => a - b2);
  const middle = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]!
      : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
    : null;
  return {
    mean: scores.length ? roundHalfEven(scores.reduce((a, b2) => a + b2, 0) / scores.length, 2) : null,
    median: middle === null ? null : roundHalfEven(middle, 2),
    minimum: scores.length ? Math.min(...scores) : null,
    maximum: scores.length ? Math.max(...scores) : null,
  };
};

const distribution = (rows: GradeRow[]): Record<string, unknown> => {
  const graded = rows.filter((row) => row.status === "graded" && row.score !== null);
  const scores = graded.map((row) => row.score as number);
  const curvedRows = graded.some((row) => row.raw_score !== undefined);
  const held = rows.filter((row) => row.status === "held").length;
  const voided = rows.filter((row) => row.status === "voided").length;
  const zeroed = rows.filter((row) => row.status === "not_submitted" && row.score === 0).length;

  return {
    enrolled: rows.length,
    submitted: rows.filter((row) => row.submission_id).length,
    graded: rows.filter((row) => row.status === "graded").length,
    partially_graded: rows.filter((row) => row.status === "partially_graded").length,
    not_submitted: rows.filter((row) => row.status === "not_submitted").length,
    exportable: rows.filter(exportable).length,
    n_scored: scores.length,
    ...shape(scores),
    // The same papers before the curve, so its effect is never out of sight.
    ...(curvedRows ? { raw: shape(graded.map((row) => (row.raw_score ?? row.score) as number)) } : {}),
    // Only when a case touches the assessment, so a course without one reads as it did.
    ...(held ? { held } : {}),
    ...(voided ? { voided } : {}),
    // Not handed in and given 0 by the policy; the mean above is over marked papers only.
    ...(zeroed ? { zeroed } : {}),
  };
};

/** Weighted standing as a share of what has been graded. Never a final grade. */
const totals = (
  b: CourseBundle,
  courseVersionId: string,
  rowsByAssessment: Map<string, GradeRow[]>,
): unknown[] => {
  const assessments = new Map(assessmentsOf(b, courseVersionId).map((a) => [a.assessment_id as string, a]));
  const perStudent = new Map<string, any>();

  // The grading scheme, when the run has one: each assessment counts in its
  // component and in every component above it, so ВСК1's line includes the
  // homework block nested inside it.
  const scheme = (runById(b).get(courseVersionId) as any)?.grading_scheme ?? null;
  const components = (scheme?.components ?? []) as any[];
  const parentOf = new Map(components.map((c) => [c.component_id as string, (c.parent ?? null) as string | null]));
  const chain = (componentId: string | null | undefined): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (let at = componentId ?? null; at && parentOf.has(at) && !seen.has(at); at = parentOf.get(at) ?? null) {
      seen.add(at);
      out.push(at);
    }
    return out;
  };
  const bucket = (entry: any, componentId: string) => {
    entry.components[componentId] ??= { earned_weighted: 0, weight_graded: 0, counted: 0, outstanding: 0 };
    return entry.components[componentId];
  };

  for (const [assessmentId, rows] of rowsByAssessment) {
    const assessment = assessments.get(assessmentId) as any;
    if (!assessment || assessment.weight === null || assessment.weight === undefined) continue;
    for (const row of rows) {
      let entry = perStudent.get(row.student_id);
      if (!entry) {
        entry = {
          student_id: row.student_id,
          earned_weighted: 0.0,
          weight_graded: 0.0,
          assessments_counted: [],
          assessments_outstanding: [],
          components: {},
        };
        perStudent.set(row.student_id, entry);
      }
      const within = chain(assessment.component);
      // Voided by an integrity case: out of this student's total altogether,
      // neither counted nor waited for.
      if (row.status === "voided") continue;
      // A 0 the missing-work policy gave counts like any mark.
      const counts = row.status === "graded" || (row.status === "not_submitted" && !row.blocked.length);
      if (counts && row.score !== null && row.maximum) {
        const earned = (row.score / row.maximum) * assessment.weight;
        entry.earned_weighted += earned;
        entry.weight_graded += assessment.weight;
        entry.assessments_counted.push(assessmentId);
        for (const componentId of within) {
          const into = bucket(entry, componentId);
          into.earned_weighted += earned;
          into.weight_graded += assessment.weight;
          into.counted += 1;
        }
      } else {
        entry.assessments_outstanding.push(assessmentId);
        for (const componentId of within) bucket(entry, componentId).outstanding += 1;
      }
    }
  }

  return [...perStudent.values()]
    .sort((a, c) => a.student_id.localeCompare(c.student_id))
    .map(({ components: byComponent, ...entry }) => ({
      ...entry,
      earned_weighted: roundHalfEven(entry.earned_weighted, 4),
      weight_graded: roundHalfEven(entry.weight_graded, 4),
      percent_of_graded: entry.weight_graded
        ? roundHalfEven((entry.earned_weighted / entry.weight_graded) * 100, 1)
        : null,
      complete: !entry.assessments_outstanding.length,
      // The course on the institution's scale, when the scheme gives it one:
      // earned so far out of `points`, not a share of what was graded.
      ...(scheme?.points != null
        ? { points: scheme.points, score: roundHalfEven(entry.earned_weighted * scheme.points, 2) }
        : {}),
      // In the scheme's own order, and only when the run has a scheme — a
      // component nothing was graded in yet still gets its line, with nulls.
      ...(components.length
        ? {
            components: components.map((component) => {
              const got = byComponent[component.component_id] ?? { earned_weighted: 0, weight_graded: 0, counted: 0, outstanding: 0 };
              return {
                component_id: component.component_id,
                title: component.title,
                weight: component.weight,
                earned_weighted: roundHalfEven(got.earned_weighted, 4),
                weight_graded: roundHalfEven(got.weight_graded, 4),
                percent_of_graded: got.weight_graded
                  ? roundHalfEven((got.earned_weighted / got.weight_graded) * 100, 1)
                  : null,
                complete: got.counted > 0 && got.outstanding === 0,
                // ВСК1 out of 100, as the institution's journal takes it.
                ...(component.points != null && component.weight > 0
                  ? {
                      points: component.points,
                      score: roundHalfEven((got.earned_weighted / component.weight) * component.points, 2),
                    }
                  : {}),
              };
            }),
          }
        : {}),
    }));
};

const lmsOut = (run: any, assessment: any, peers: readonly any[]): Record<string, unknown> => {
  const scale = lmsScale(run, assessment, peers);
  if (scale.problem) return { lms: { maximum: null, problem: scale.problem } };
  return rescales(scale) ? { lms: { maximum: scale.maximum, factor: roundHalfEven(scale.factor, 6), why: scale.why } } : {};
};

export const gradebookPayload = (
  b: CourseBundle,
  courseVersionId: string,
  options: {
    assessmentId?: string | null;
    allowPartial?: boolean;
    groups?: readonly string[] | null;
  } = {},
): Record<string, unknown> => {
  const { assessmentId = null, allowPartial = false } = options;
  const groups = (options.groups ?? []).map((group) => group.trim()).filter(Boolean);
  const run = runById(b).get(courseVersionId) as any;
  const rowsByAssessment = gradeRows(b, courseVersionId, { assessmentId, allowPartial, groups });
  const assessments = new Map(assessmentsOf(b, courseVersionId).map((a) => [a.assessment_id as string, a]));

  const payloadAssessments = [...rowsByAssessment.entries()].map(([aid, rows]) => {
    const assessment = assessments.get(aid) as any;
    const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
    return {
      assessment_id: aid,
      title: assessment.title,
      type: assessment.type,
      weight: assessment.weight ?? null,
      component: assessment.component ?? null,
      maximum: assessment.maximum_score,
      // What the LMS has it out of, when the grading scheme rescales it.
      ...(lmsOut(run, assessment, [...assessments.values()])),
      ...(assessment.curve ? { curve: { ...assessment.curve, applied: curveOf(assessment) !== null } } : {}),
      due_at: assessment.due_at ?? null,
      criteria: (rubric?.criteria ?? []).map((c: any) => ({
        criterion_id: c.criterion_id,
        title: c.title,
        maximum: c.maximum_score,
        outcome_id: c.outcome_id ?? null,
      })),
      issues: assessmentIssues(assessment, rubric ? [...rubric.criteria] : []),
      summary: distribution(rows),
      rows: rows.map(rowAsDict),
    };
  });

  const notes = [
    "Scores come from professor decisions only. An ai_suggestion is never " +
      "counted, whatever its confidence.",
    "A blank is not a zero: a row with no submission or an undecided " +
      "criterion carries no score and is not exportable.",
    "percent_of_graded is a share of the assessments graded so far, not a " +
      "final grade. No letter grade is computed — a grading scheme is a claim " +
      "and this model has no field for one.",
  ];
  const scheme = run?.grading_scheme;
  if (scheme?.points != null || (scheme?.components ?? []).some((c: any) => c.points != null)) {
    notes.push(
      "A total's `score` is earned so far out of the block's (or the course's) " +
        "`points`, the scale the institution's journal takes; it grows as more is " +
        "graded, so it is final only when `complete`. An assessment's `lms.maximum` " +
        "is what Canvas has it out of; the marks here stay out of `maximum`.",
    );
  }
  const curvedIds = payloadAssessments.filter((a) => curveOf(assessments.get(a.assessment_id))).map((a) => a.assessment_id);
  if (curvedIds.length) {
    notes.push(
      `${curvedIds.join(", ")} ${curvedIds.length === 1 ? "is" : "are"} curved: a row's \`score\` is the ` +
        "curved total and the one every total and export uses; `raw_score` is what the criteria add up to.",
    );
  }
  const zeroedIds = payloadAssessments.filter((a: any) => a.summary.zeroed).map((a) => a.assessment_id);
  if (zeroedIds.length) {
    notes.push(
      `${zeroedIds.join(", ")} ${zeroedIds.length === 1 ? "is" : "are"} past due under a missing-work policy of ` +
        "zero: a row with no submission scores 0, counts in the totals and is exported; the summary's mean is " +
        "over marked papers only, and `zeroed` says how many were given 0.",
    );
  }
  const touched = payloadAssessments.flatMap((a) => a.rows).filter((row: any) => row.integrity);
  if (touched.length) {
    notes.push(
      `${touched.length} mark(s) are decided by an integrity case (a row's \`integrity\`): an open case holds ` +
        "the mark, upheld `zero` makes it 0, upheld `voided` takes the assessment out of that student's total, " +
        "and any case not cleared keeps the paper off the curve.",
    );
  }
  if (assessmentId !== null) {
    notes.push(
      `Only ${assessmentId} is in scope, so the totals cover that assessment ` +
        "alone — 'complete' does not mean the course is fully graded.",
    );
  }
  if (groups.length) {
    notes.push(
      `Only group ${groups.join(", ")} is in scope. Every count here is that ` +
        "subgroup's, not the class's.",
    );
  }

  return {
    run: { id: courseVersionId, title: b.course.title, term: run.term },
    generated_by: GRADEBOOK_VERSION,
    allow_partial: allowPartial,
    scope: {
      assessment_id: assessmentId,
      ...(groups.length ? { groups } : {}),
      assessments_counted: [...rowsByAssessment.keys()].sort(),
    },
    assessments: payloadAssessments,
    totals: totals(b, courseVersionId, rowsByAssessment),
    notes,
  };
};

/**
 * Where one student's course can still end, read off a payload's own totals.
 *
 * The floor is every assessment not yet graded at nothing, the ceiling every
 * one at full marks; `share` is the pace — the student's share of what has
 * been graded. All three come from the row `totals` already computed, so a
 * screen that draws a range cannot disagree with the gradebook it sits beside.
 * Kept out of the payload itself: the payload is held word for word to the
 * Python gradebook by the golden fixtures.
 *
 * Percent of the whole course weight. A student with no totals row (nothing
 * weighted, or a role the gradebook does not total) is all open: 0 – 100.
 * `null` throughout when nothing in the run carries a weight.
 */
export const finalRange = (
  payload: any,
  studentId: string,
): { floor: number | null; ceiling: number | null; open: number | null; share: number | null } => {
  const courseWeight = ((payload?.assessments ?? []) as any[])
    .filter((a) => typeof a.weight === "number" && a.weight > 0)
    .reduce((sum, a) => sum + a.weight, 0);
  const row = ((payload?.totals ?? []) as any[]).find((t) => t.student_id === studentId);
  const earned = row?.earned_weighted ?? 0;
  const graded = row?.weight_graded ?? 0;
  if (!courseWeight) return { floor: null, ceiling: null, open: null, share: graded ? earned / graded : null };
  const open = courseWeight - graded;
  return {
    floor: (earned / courseWeight) * 100,
    ceiling: ((earned + open) / courseWeight) * 100,
    open: (open / courseWeight) * 100,
    share: graded ? earned / graded : null,
  };
};
