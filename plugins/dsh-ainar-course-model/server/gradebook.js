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
 *    exportable; never submitted → `score: null`, never 0.
 * 3. Nothing is rescaled. Criteria summing to 90 against a maximum of 100
 *    blocks the row rather than stretching it.
 * 4. Only the professor's words travel. Row comments come from
 *    `professor_decision.comment` alone.
 */
import { allRubrics, assessmentsOf, enrolledIn, itemsOf, runById } from "./bundle.js";
import { roundHalfEven } from "./grading.js";
export const GRADEBOOK_VERSION = "gradebook/2026.08.1";
const TOLERANCE = 0.01;
const DECIDED = new Set(["approved", "overridden"]);
const NOT_HANDED_IN = new Set(["missing", "withdrawn"]);
const GRADED_ROLES = new Set(["student", "auditor"]);
/** Python's `%g`: shortest representation, no trailing zeros. */
const g = (value) => String(Number(value.toPrecision(6)));
const criterion = (source, extra = {}) => ({
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
const fromItems = (spec, items, responses) => {
    const resolved = criterion(spec);
    const itemMaximum = items.reduce((sum, item) => sum + item.maximum_score, 0);
    const scored = items
        .map((item) => responses.get(item.item_id))
        .filter((response) => response && response.score !== null && response.score !== undefined);
    if (scored.length < items.length) {
        resolved.note = `${scored.length} of ${items.length} items scored — the rest need a human`;
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
export const resolveCriterion = (spec, evaluations, items, responses) => {
    const evaluation = evaluations.get(spec.criterion_id);
    const decision = evaluation && DECIDED.has(evaluation.status) ? evaluation.professor_decision : null;
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
        }
        else if (items.length) {
            resolved.note = "items were scored too; the decision takes precedence";
        }
        return resolved;
    }
    if (items.length)
        return fromItems(spec, items, responses);
    return criterion(spec, { note: "no professor decision" });
};
/** The attempt that counts: highest attempt, then latest timestamp. */
const latestSubmission = (submissions) => {
    const live = submissions.filter((s) => !NOT_HANDED_IN.has(s.status));
    if (!live.length)
        return null;
    return live.reduce((best, s) => {
        const key = (x) => [x.attempt, x.submitted_at ? Date.parse(x.submitted_at) : 0];
        const [ba, bt] = key(best);
        const [sa, st] = key(s);
        return sa > ba || (sa === ba && st > bt) ? s : best;
    });
};
const assessmentIssues = (assessment, criteria) => {
    if (!criteria.length)
        return ["assessment has no rubric criteria, so there is nothing to total"];
    const total = criteria.reduce((sum, c) => sum + c.maximum_score, 0);
    if (Math.abs(total - assessment.maximum_score) > TOLERANCE) {
        return [
            `criteria sum to ${g(total)} but maximum_score is ${g(assessment.maximum_score)} — ` +
                "no score is exported until these agree, because the alternative is a silent rescale",
        ];
    }
    return [];
};
const percent = (row) => row.score === null || !row.maximum ? null : roundHalfEven((row.score / row.maximum) * 100, 1);
const exportable = (row) => row.score !== null && !row.blocked.length;
const rowAsDict = (row) => ({
    student_id: row.student_id,
    assessment_id: row.assessment_id,
    submission_id: row.submission_id,
    status: row.status,
    score: row.score,
    maximum: row.maximum,
    percent: percent(row),
    comment: row.comment,
    exportable: exportable(row),
    blocked: [...row.blocked],
    criteria: row.criteria.map((c) => ({ ...c })),
});
export const gradeRows = (b, courseVersionId, options = {}) => {
    const { assessmentId = null, allowPartial = false, groups = null } = options;
    const assessments = assessmentsOf(b, courseVersionId).filter((a) => assessmentId === null || a.assessment_id === assessmentId);
    const students = enrolledIn(b, courseVersionId, { roles: GRADED_ROLES, groups })
        .map((e) => e.student_id)
        .sort();
    const bySubmission = new Map();
    for (const evaluation of b.evaluations) {
        const table = bySubmission.get(evaluation.submission_id) ?? new Map();
        table.set(evaluation.criterion_id, evaluation);
        bySubmission.set(evaluation.submission_id, table);
    }
    const responsesBySubmission = new Map();
    for (const response of b.item_responses) {
        const table = responsesBySubmission.get(response.submission_id) ?? new Map();
        table.set(response.item_id, response);
        responsesBySubmission.set(response.submission_id, table);
    }
    const out = new Map();
    for (const assessment of assessments) {
        const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
        const criteria = rubric ? [...rubric.criteria] : [];
        const itemsByCriterion = new Map();
        for (const item of itemsOf(b, assessment.assessment_id)) {
            if (!item.criterion_id)
                continue;
            itemsByCriterion.set(item.criterion_id, [...(itemsByCriterion.get(item.criterion_id) ?? []), item]);
        }
        const structural = assessmentIssues(assessment, criteria);
        const submissionsByStudent = new Map();
        for (const submission of b.submissions) {
            if (submission.assessment_id !== assessment.assessment_id)
                continue;
            submissionsByStudent.set(submission.student_id, [
                ...(submissionsByStudent.get(submission.student_id) ?? []),
                submission,
            ]);
        }
        const rows = [];
        for (const studentId of students) {
            const row = {
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
            const submission = latestSubmission(submissionsByStudent.get(studentId) ?? []);
            if (!submission) {
                row.blocked.push("no submission");
                rows.push(row);
                continue;
            }
            row.submission_id = submission.submission_id;
            if (!criteria.length) {
                row.status = "no_rubric";
                rows.push(row);
                continue;
            }
            const evaluations = bySubmission.get(submission.submission_id) ?? new Map();
            const responses = responsesBySubmission.get(submission.submission_id) ?? new Map();
            row.criteria = criteria.map((spec) => resolveCriterion(spec, evaluations, itemsByCriterion.get(spec.criterion_id) ?? [], responses));
            const usable = row.criteria.filter((c) => c.score !== null);
            const unusable = row.criteria.filter((c) => c.status === "unusable");
            const undecided = row.criteria.filter((c) => c.status === "missing");
            if (unusable.length) {
                row.blocked.push(...unusable.filter((c) => c.note).map((c) => `${c.criterion_id}: ${c.note}`));
            }
            if (undecided.length) {
                row.status = "partially_graded";
                if (!allowPartial) {
                    row.blocked.push(`${undecided.length} of ${row.criteria.length} criteria undecided: ` +
                        undecided.map((c) => c.criterion_id).join(", "));
                }
            }
            else if (!unusable.length) {
                row.status = "graded";
            }
            if (usable.length) {
                row.score = roundHalfEven(usable.reduce((sum, c) => sum + c.score, 0), 2);
            }
            const comments = row.criteria.filter((c) => c.comment).map((c) => `${c.title}: ${c.comment}`);
            row.comment = comments.length ? comments.join("\n") : null;
            rows.push(row);
        }
        out.set(assessment.assessment_id, rows);
    }
    return out;
};
/** The shape of the batch, over graded rows **only** — a blank is not a zero. */
const distribution = (rows) => {
    const scores = rows
        .filter((row) => row.status === "graded" && row.score !== null)
        .map((row) => row.score);
    const sorted = [...scores].sort((a, b2) => a - b2);
    const middle = sorted.length
        ? sorted.length % 2
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : null;
    return {
        enrolled: rows.length,
        submitted: rows.filter((row) => row.submission_id).length,
        graded: rows.filter((row) => row.status === "graded").length,
        partially_graded: rows.filter((row) => row.status === "partially_graded").length,
        not_submitted: rows.filter((row) => row.status === "not_submitted").length,
        exportable: rows.filter(exportable).length,
        n_scored: scores.length,
        mean: scores.length ? roundHalfEven(scores.reduce((a, b2) => a + b2, 0) / scores.length, 2) : null,
        median: middle === null ? null : roundHalfEven(middle, 2),
        minimum: scores.length ? Math.min(...scores) : null,
        maximum: scores.length ? Math.max(...scores) : null,
    };
};
/** Weighted standing as a share of what has been graded. Never a final grade. */
const totals = (b, courseVersionId, rowsByAssessment) => {
    const assessments = new Map(assessmentsOf(b, courseVersionId).map((a) => [a.assessment_id, a]));
    const perStudent = new Map();
    for (const [assessmentId, rows] of rowsByAssessment) {
        const assessment = assessments.get(assessmentId);
        if (!assessment || assessment.weight === null || assessment.weight === undefined)
            continue;
        for (const row of rows) {
            let entry = perStudent.get(row.student_id);
            if (!entry) {
                entry = {
                    student_id: row.student_id,
                    earned_weighted: 0.0,
                    weight_graded: 0.0,
                    assessments_counted: [],
                    assessments_outstanding: [],
                };
                perStudent.set(row.student_id, entry);
            }
            if (row.status === "graded" && row.score !== null && row.maximum) {
                entry.earned_weighted += (row.score / row.maximum) * assessment.weight;
                entry.weight_graded += assessment.weight;
                entry.assessments_counted.push(assessmentId);
            }
            else {
                entry.assessments_outstanding.push(assessmentId);
            }
        }
    }
    return [...perStudent.values()]
        .sort((a, c) => a.student_id.localeCompare(c.student_id))
        .map((entry) => ({
        ...entry,
        earned_weighted: roundHalfEven(entry.earned_weighted, 4),
        weight_graded: roundHalfEven(entry.weight_graded, 4),
        percent_of_graded: entry.weight_graded
            ? roundHalfEven((entry.earned_weighted / entry.weight_graded) * 100, 1)
            : null,
        complete: !entry.assessments_outstanding.length,
    }));
};
export const gradebookPayload = (b, courseVersionId, options = {}) => {
    const { assessmentId = null, allowPartial = false } = options;
    const groups = (options.groups ?? []).map((group) => group.trim()).filter(Boolean);
    const run = runById(b).get(courseVersionId);
    const rowsByAssessment = gradeRows(b, courseVersionId, { assessmentId, allowPartial, groups });
    const assessments = new Map(assessmentsOf(b, courseVersionId).map((a) => [a.assessment_id, a]));
    const payloadAssessments = [...rowsByAssessment.entries()].map(([aid, rows]) => {
        const assessment = assessments.get(aid);
        const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
        return {
            assessment_id: aid,
            title: assessment.title,
            type: assessment.type,
            weight: assessment.weight ?? null,
            maximum: assessment.maximum_score,
            due_at: assessment.due_at ?? null,
            criteria: (rubric?.criteria ?? []).map((c) => ({
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
    if (assessmentId !== null) {
        notes.push(`Only ${assessmentId} is in scope, so the totals cover that assessment ` +
            "alone — 'complete' does not mean the course is fully graded.");
    }
    if (groups.length) {
        notes.push(`Only group ${groups.join(", ")} is in scope. Every count here is that ` +
            "subgroup's, not the class's.");
    }
    return {
        run: { id: courseVersionId, title: b.course.title, term: run.term },
        generated_by: GRADEBOOK_VERSION,
        allow_partial: allowPartial,
        scope: { assessment_id: assessmentId, ...(groups.length ? { groups } : {}), assessments_counted: [...rowsByAssessment.keys()].sort() },
        assessments: payloadAssessments,
        totals: totals(b, courseVersionId, rowsByAssessment),
        notes,
    };
};
