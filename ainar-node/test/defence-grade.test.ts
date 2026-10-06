import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkDefenceGrade,
  defenceEvaluations,
  defenceEvidence,
  type Answer,
  type GradingCriterion,
  type Question,
  type Session,
} from "../src/defence.ts";
import { evaluationId } from "../src/grade-board.ts";

const CRITERIA: GradingCriterion[] = [
  { criterion_id: "CRIT-HW1-SPLIT", title: "Train/test split", maximum_score: 10, levels: [{ score: 10, description: "Justified" }, { score: 5, description: "Asserted" }] },
  { criterion_id: "CRIT-HW1-EVAL", title: "Evaluation", maximum_score: 5 },
];
const QUESTIONS: Question[] = [
  { id: "Q1", kind: "opening", text: "Walk me through it.", criterion_id: null, why: "", evidence: [], approval: "draft" },
  { id: "Q2", kind: "probe", text: "Why split at row 80?", criterion_id: "CRIT-HW1-SPLIT", why: "", evidence: [], approval: "draft" },
];
const take = (id: string, segments: any[], extra: Partial<Answer> = {}): Answer => ({
  question_id: id, take: 1, audio: `answers/${id}-1.webm`, mime: "audio/webm", recorded_at: "t", seconds: 20,
  transcript: { text: "", language: "en", seconds: 20, timed: true, provider: "elevenlabs", model: "scribe_v2", at: "t", cost_usd: null, segments, speakers: { method: "diarized", unclear: false } },
  ...extra,
});
const SESSION: Session = {
  submission_id: "SUB-JNG7SN-HW1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN",
  consent: { agreed: true, at: "2026-10-06T10:00:00Z", statement: "s", provider: "scribe" },
  answers: [
    take("Q1", [{ start: 0, end: 6, text: "It trains a model on the sales data.", speaker: "student" }]),
    take("Q2", [
      { start: 0, end: 8, text: "Because the rows are ordered by date, so the last fifth is the future.", speaker: "student" },
      { start: 8, end: 10, text: "And if they were shuffled?", speaker: "professor" },
      { start: 10, end: 16, text: "Then the test set would leak.", speaker: "student", confidence: "low" },
    ]),
    take("Q1", [{ start: 0, end: 4, text: "Withdrawn words.", speaker: "student" }], { take: 2, audio: "answers/Q1-2.webm", withdrawn: true }),
  ],
};
const sourceRef = (audio: string) => `private://submissions/RUN/ASSESSMENT-HW1/STUDENT-JNG7SN/defence/${audio}`;
const files = [{ path: "train.py", text: "", lines: 30 }];

test("the evidence groups the student's own words by criterion, citable to the second, and lists what is not citable", () => {
  const text = defenceEvidence({ title: "Homework 1", assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-JNG7SN", criteria: CRITERIA, questions: QUESTIONS, session: SESSION });
  assert.match(text, /- CRIT-HW1-SPLIT: Train\/test split \(out of 10\)\n {4}10: Justified/);
  assert.match(text, /### CRIT-HW1-SPLIT Train\/test split\nQ2: Why split at row 80\?\n {2}\[Q2 take 1 @ 0\.0s\] Because the rows are ordered/);
  assert.doesNotMatch(text, /And if they were shuffled/);
  assert.match(text, /\[Q2 take 1 @ 10\.0s\] Then the test set would leak\. {3}\(unsure transcription — listen before citing\)/);
  assert.match(text, /### CRIT-HW1-EVAL Evaluation\n {2}\(no question was asked for this criterion\)/);
  assert.match(text, /## Not citable\n- Q1 take 2: consent withdrawn/);
});

test("a proposed grade is checked: rubric, range, and citations of the student's own words only", () => {
  const { proposed, notes } = checkDefenceGrade(
    {
      criteria: [
        {
          criterion_id: "CRIT-HW1-SPLIT", score: 8, confidence: 0.7, comment: "Justified the split by the ordering.",
          evidence: [
            { question: "Q2", take: 1, at: 3.2, quote: "the rows are ordered by date" },
            { question: "Q2", take: 1, at: 9, quote: "shuffled" },
            { question: "Q2", take: 1, at: 2, quote: "a random forest" },
            { question: "Q1", take: 2, at: 1 },
            { path: "train.py", lines: "3-4" },
            { path: "secret.py", lines: "1" },
          ],
        },
        { criterion_id: "CRIT-HW1-EVAL", score: 7, comment: "x" },
        { criterion_id: "CRIT-NOPE", score: 1 },
      ],
    },
    { criteria: CRITERIA, session: SESSION, files, sourceRef },
  );
  assert.equal(proposed.length, 1);
  const split = proposed[0]!;
  assert.deepEqual(split.evidence, [
    { location: "Q2 take 1 @ 0.0–8.0s", text_reference: "the rows are ordered by date", source_ref: sourceRef("answers/Q2-1.webm") },
    { location: "train.py:3-4", text_reference: null, source_ref: null },
  ]);
  assert.ok(notes.some((n) => /Q2 take 1 @ 9s is not the student speaking/.test(n)), "the professor's words are not citable");
  assert.ok(notes.some((n) => /"a random forest" is not what was said/.test(n)));
  assert.ok(notes.some((n) => /Q1 take 2 @ 1s is not the student speaking in a citable take/.test(n)), "a withdrawn take is not citable");
  assert.ok(notes.some((n) => /secret\.py:1 is not in the code read/.test(n)));
  assert.ok(notes.some((n) => /CRIT-HW1-EVAL: 7 is not a score out of 5/.test(n)), "out of range is refused, not clamped");
  assert.ok(notes.some((n) => /CRIT-NOPE is not in the rubric/.test(n)));
});

test("a mark resting on no surviving citation is kept with its confidence lowered", () => {
  const { proposed, notes } = checkDefenceGrade(
    { criteria: [{ criterion_id: "CRIT-HW1-EVAL", score: 4, confidence: 0.9, comment: "Seemed fine.", evidence: [] }] },
    { criteria: CRITERIA, session: SESSION, files, sourceRef },
  );
  assert.equal(proposed[0]!.confidence, 0.3);
  assert.ok(notes.some((n) => /no citation survived/.test(n)));
});

test("evaluations land on the homework's submission with the shared id, and a decided one is left alone", () => {
  const proposed = [
    { criterion_id: "CRIT-HW1-SPLIT", score: 8, confidence: 0.7, comment: "c", evidence: [] },
    { criterion_id: "CRIT-HW1-EVAL", score: 3, confidence: null, comment: "d", evidence: [] },
  ];
  const existing = [
    { evaluation_id: evaluationId("STUDENT-JNG7SN", "CRIT-HW1-SPLIT"), submission_id: "SUB-JNG7SN-HW1", criterion_id: "CRIT-HW1-SPLIT", status: "suggested", ai_suggestion: { score: 5 } },
    { evaluation_id: "EVAL-OTHER", submission_id: "SUB-JNG7SN-HW1", criterion_id: "CRIT-HW1-EVAL", status: "approved", professor_decision: { score: 4 } },
  ];
  const { evaluations, decided } = defenceEvaluations({
    proposed, submission_id: "SUB-JNG7SN-HW1", student_id: "STUDENT-JNG7SN", existing,
    provenance: { produced_by: "defend-submission-skill", model_id: "deepseek-v4-pro", created_at: "2026-10-06T12:00:00+05:00", input_refs: ["SUB-JNG7SN-HW1"] },
  });
  assert.deepEqual(decided, ["CRIT-HW1-EVAL"]);
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0].evaluation_id, "EVAL-JNG7SN-HW1-SPLIT");
  assert.equal(evaluations[0].status, "suggested");
  assert.equal(evaluations[0].ai_suggestion.score, 8);
  assert.equal(evaluations[0].ai_suggestion.provenance.prompt_version, "defend-submission/grade/v1");
  assert.equal("professor_decision" in evaluations[0], false);
});
