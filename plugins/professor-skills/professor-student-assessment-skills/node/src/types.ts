export interface RubricCriterion {
  criterion_id: string;
  title: string;
  maximum_score: number;
  weight?: number | null;
  outcome_id?: string | null;
  capability_id?: string | null;
  concepts?: string[];
}

export interface Rubric {
  rubric_id: string;
  title?: string | null;
  criteria?: RubricCriterion[];
}

export interface EvidenceRef {
  document_id?: string | null;
  location?: string | null;
  text_reference?: string | null;
  source_ref?: string | null;
}

export interface AiSuggestion {
  score: number;
  confidence?: number | null;
  comment?: string | null;
  evidence?: EvidenceRef[];
}

export interface ProfessorDecision {
  score: number;
  comment?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
}

export type EvaluationStatus = "suggested" | "in_review" | "approved" | "overridden";

export interface Evaluation {
  evaluation_id: string;
  submission_id: string;
  criterion_id: string;
  ai_suggestion?: AiSuggestion | null;
  professor_decision?: ProfessorDecision | null;
  status?: EvaluationStatus;
}

export interface Issue {
  severity: "error" | "warning";
  code: string;
  evaluationId?: string;
  submissionId?: string;
  criterionId?: string;
  message: string;
}
