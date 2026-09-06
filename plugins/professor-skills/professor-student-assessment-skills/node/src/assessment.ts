import type { Evaluation, Issue, Rubric, RubricCriterion } from "./types.ts";

const approvedStatuses = new Set(["approved", "overridden"]);

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function criterionMap(rubric: Rubric): Map<string, RubricCriterion> {
  if (!Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    throw new Error("rubric must contain at least one criterion");
  }
  const map = new Map<string, RubricCriterion>();
  for (const criterion of rubric.criteria) {
    if (!criterion || typeof criterion.criterion_id !== "string" || !finiteNumber(criterion.maximum_score) || criterion.maximum_score <= 0) {
      throw new Error("each rubric criterion needs criterion_id and positive maximum_score");
    }
    if (map.has(criterion.criterion_id)) throw new Error(`duplicate rubric criterion ${criterion.criterion_id}`);
    map.set(criterion.criterion_id, criterion);
  }
  return map;
}

function issueFor(evaluation: Evaluation, severity: Issue["severity"], code: string, message: string): Issue {
  return {
    severity,
    code,
    evaluationId: evaluation.evaluation_id,
    submissionId: evaluation.submission_id,
    criterionId: evaluation.criterion_id,
    message,
  };
}

export function checkEvaluations(rubric: Rubric, evaluations: Evaluation[], confidenceThreshold = 0.8): Issue[] {
  const criteria = criterionMap(rubric);
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    if (!evaluation || typeof evaluation.evaluation_id !== "string" || typeof evaluation.submission_id !== "string" || typeof evaluation.criterion_id !== "string") {
      issues.push({ severity: "error", code: "INVALID_IDENTITY", message: "evaluation needs evaluation_id, submission_id, and criterion_id" });
      continue;
    }
    const key = `${evaluation.submission_id}\u0000${evaluation.criterion_id}`;
    if (seen.has(key)) issues.push(issueFor(evaluation, "error", "DUPLICATE_CRITERION", "submission has more than one evaluation for this criterion"));
    seen.add(key);
    const criterion = criteria.get(evaluation.criterion_id);
    if (!criterion) {
      issues.push(issueFor(evaluation, "error", "UNKNOWN_CRITERION", "criterion is not present in the rubric"));
      continue;
    }
    const suggestion = evaluation.ai_suggestion;
    if (suggestion) {
      if (!finiteNumber(suggestion.score) || suggestion.score < 0 || suggestion.score > criterion.maximum_score) {
        issues.push(issueFor(evaluation, "error", "SUGGESTION_SCORE_RANGE", `AI suggestion must be between 0 and ${criterion.maximum_score}`));
      }
      if (suggestion.confidence != null && (!finiteNumber(suggestion.confidence) || suggestion.confidence < 0 || suggestion.confidence > 1)) {
        issues.push(issueFor(evaluation, "error", "CONFIDENCE_RANGE", "confidence must be between 0 and 1"));
      } else if (suggestion.confidence != null && suggestion.confidence < confidenceThreshold) {
        issues.push(issueFor(evaluation, "warning", "LOW_CONFIDENCE", `confidence is below ${confidenceThreshold}`));
      }
      if (!Array.isArray(suggestion.evidence) || suggestion.evidence.length === 0) {
        issues.push(issueFor(evaluation, "warning", "MISSING_EVIDENCE", "AI suggestion has no evidence reference"));
      }
    }
    const status = evaluation.status ?? "suggested";
    const decision = evaluation.professor_decision;
    if (approvedStatuses.has(status)) {
      if (!decision) {
        issues.push(issueFor(evaluation, "error", "MISSING_DECISION", `${status} evaluation needs professor_decision`));
      } else {
        if (!finiteNumber(decision.score) || decision.score < 0 || decision.score > criterion.maximum_score) {
          issues.push(issueFor(evaluation, "error", "DECISION_SCORE_RANGE", `professor decision must be between 0 and ${criterion.maximum_score}`));
        }
        if (!decision.decided_by || !decision.decided_at) {
          issues.push(issueFor(evaluation, "error", "MISSING_DECISION_STAMP", `${status} evaluation needs decided_by and decided_at`));
        } else if (Number.isNaN(Date.parse(decision.decided_at))) {
          issues.push(issueFor(evaluation, "error", "INVALID_DECISION_TIME", "decided_at must be an ISO-compatible date-time"));
        }
      }
    } else if (decision?.decided_by || decision?.decided_at) {
      issues.push(issueFor(evaluation, "warning", "UNOFFICIAL_STAMP", "non-approved evaluation carries a decision stamp"));
    }
  }
  return issues;
}

export interface OfficialSummary {
  submissionId: string;
  status: "complete" | "pending";
  approvedSubtotal: number;
  officialScore: number | null;
  maximumScore: number;
  approvedCriteria: string[];
  pendingCriteria: string[];
}

export function officialSummaries(rubric: Rubric, evaluations: Evaluation[]): OfficialSummary[] {
  const criteria = criterionMap(rubric);
  const grouped = new Map<string, Evaluation[]>();
  for (const evaluation of evaluations) {
    if (typeof evaluation.submission_id !== "string") continue;
    const group = grouped.get(evaluation.submission_id) ?? [];
    group.push(evaluation);
    grouped.set(evaluation.submission_id, group);
  }
  const maximumScore = [...criteria.values()].reduce((sum, criterion) => sum + criterion.maximum_score, 0);
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([submissionId, group]) => {
    const official = new Map<string, number>();
    for (const evaluation of group) {
      if (!criteria.has(evaluation.criterion_id)) continue;
      if (!approvedStatuses.has(evaluation.status ?? "suggested")) continue;
      const decision = evaluation.professor_decision;
      if (!decision?.decided_by || !decision.decided_at || !finiteNumber(decision.score)) continue;
      official.set(evaluation.criterion_id, decision.score);
    }
    const approvedCriteria = [...official.keys()].sort();
    const pendingCriteria = [...criteria.keys()].filter((id) => !official.has(id)).sort();
    const approvedSubtotal = [...official.values()].reduce((sum, score) => sum + score, 0);
    return {
      submissionId,
      status: pendingCriteria.length === 0 ? "complete" : "pending",
      approvedSubtotal,
      officialScore: pendingCriteria.length === 0 ? approvedSubtotal : null,
      maximumScore,
      approvedCriteria,
      pendingCriteria,
    };
  });
}

export function auditBatch(rubric: Rubric, evaluations: Evaluation[], confidenceThreshold = 0.8) {
  const issues = checkEvaluations(rubric, evaluations, confidenceThreshold);
  const summaries = officialSummaries(rubric, evaluations);
  const completed = summaries.filter((summary) => summary.status === "complete");
  const scores = completed.map((summary) => summary.officialScore!).sort((a, b) => a - b);
  const mean = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const middle = Math.floor(scores.length / 2);
  const median = scores.length === 0 ? null : scores.length % 2 ? scores[middle]! : (scores[middle - 1]! + scores[middle]!) / 2;
  return {
    rubricId: rubric.rubric_id,
    submissionCount: summaries.length,
    completeDecisionCount: completed.length,
    pendingSubmissionIds: summaries.filter((summary) => summary.status === "pending").map((summary) => summary.submissionId),
    officialScoreStatistics: {
      basis: "complete stamped professor decisions only",
      count: scores.length,
      mean,
      median,
      minimum: scores[0] ?? null,
      maximum: scores.at(-1) ?? null,
    },
    issueCounts: {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
    issues,
  };
}
