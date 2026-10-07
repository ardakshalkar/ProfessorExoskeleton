import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  approveSplit,
  checkDefenceGrade,
  checkSplit,
  defenceEvidence,
  defencePlace,
  partOf,
  readSession,
  recordConsent,
  recordSplit,
  replay,
  saveAnswer,
  splitFromMarks,
  splitPrompt,
  type Answer,
  type GradingCriterion,
  type Question,
  type Session,
} from "../src/defence.ts";

const CRITERIA: GradingCriterion[] = [
  { criterion_id: "CRIT-HW1-SPLIT", title: "Train/test split", maximum_score: 10 },
  { criterion_id: "CRIT-HW1-EVAL", title: "Evaluation", maximum_score: 5 },
];
const QUESTIONS: Question[] = [
  { id: "Q0", kind: "whole", text: "The whole defence.", criterion_id: null, why: "", evidence: [], approval: "draft" },
  { id: "Q1", kind: "opening", text: "Walk me through it.", criterion_id: null, why: "", evidence: [], approval: "draft" },
  { id: "Q2", kind: "probe", text: "Why split at row 80?", criterion_id: "CRIT-HW1-SPLIT", why: "", evidence: [], approval: "draft" },
];
const WHOLE: Answer = {
  question_id: "Q0", take: 1, audio: "answers/Q0-1.webm", mime: "audio/webm", recorded_at: "2026-10-07T10:00:00Z", seconds: 60,
  marks: [{ at: 21 }, { at: 41, question_id: "Q2" }],
  transcript: {
    text: "", language: "en", seconds: 60, timed: true, provider: "elevenlabs", model: "scribe_v2", at: "t", cost_usd: null,
    speakers: { method: "diarized", unclear: false },
    segments: [
      { start: 0, end: 4, text: "Hello, shall we start?", speaker: "professor" },
      { start: 20, end: 24, text: "Walk me through your homework.", speaker: "professor" },
      { start: 24, end: 38, text: "It trains a model on the sales data.", speaker: "student" },
      { start: 40, end: 44, text: "Why did you split at row eighty?", speaker: "professor" },
      { start: 44, end: 58, text: "Because the rows are ordered by date.", speaker: "student" },
    ],
  },
};
const at = "2026-10-07T10:02:00Z";
const context = { answer: WHOLE, questions: QUESTIONS, criteria: CRITERIA, by: "test/model", at };

test("the model's parts are kept in order, inside the take, with a prepared question's criterion filled in", () => {
  const split = checkSplit(
    '```json\n{"parts": [{"start": 40, "end": 70, "asked": "Why row 80", "question_id": "Q2", "criterion_id": null}, {"start": 20, "end": 45, "asked": "Walk me through it", "question_id": "Q1", "criterion_id": null}]}\n```',
    context,
  );
  assert.deepEqual(
    split.parts.map((part) => [part.question_id, part.start, part.end, part.criterion_id]),
    [["Q1", 20, 40, null], ["Q2", 40, 60, "CRIT-HW1-SPLIT"]],
  );
  assert.equal(split.approval, "draft");
  assert.equal(split.by, "test/model");
  assert.equal(split.notes, undefined);
});

test("what the desk does not have is unset with a note, and a press the split disagrees with is named", () => {
  const split = checkSplit(
    { parts: [{ start: 20, end: 60, asked: "x", question_id: "Q9", criterion_id: "CRIT-NOPE" }] },
    context,
  );
  assert.equal(split.parts[0]!.question_id, null);
  assert.equal(split.parts[0]!.criterion_id, null);
  assert.ok(split.notes!.some((note) => /Q9 is not a prepared question/.test(note)));
  assert.ok(split.notes!.some((note) => /CRIT-NOPE is not in the rubric/.test(note)));
  assert.ok(split.notes!.some((note) => /you picked Q2 at 0:41, but the split puts no prepared question there/.test(note)));
});

test("a reply that is no use falls back to the professor's presses", () => {
  const split = checkSplit("I could not do it", context);
  assert.equal(split.by, "your presses, without a model");
  assert.deepEqual(split.parts.map((part) => [part.question_id, part.start, part.end, part.criterion_id]), [[null, 21, 41, null], ["Q2", 41, 60, "CRIT-HW1-SPLIT"]]);
  assert.match(split.notes![0]!, /not a split/);
  const none = splitFromMarks({ answer: { ...WHOLE, marks: [] }, questions: QUESTIONS, at });
  assert.equal(none.parts.length, 0);
  assert.match(none.notes![0]!, /stays one piece/);
});

test("the prompt carries the prepared questions, the presses and the timed dialogue", () => {
  const prompt = splitPrompt({ answer: WHOLE, questions: QUESTIONS, criteria: CRITERIA });
  assert.match(prompt, /Q2 \[CRIT-HW1-SPLIT\]: Why split at row 80\?/);
  assert.doesNotMatch(prompt, /Q0 /);
  assert.match(prompt, /41\.0s — they picked Q2/);
  assert.match(prompt, /\[44\.0–58\.0\] STUDENT: Because the rows are ordered by date\./);
});

test("a split takes each part's words under its criterion, and citations stay those of the take", () => {
  const session: Session = {
    submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN",
    consent: { agreed: true, at: "2026-10-07T09:59:00Z", statement: "s", provider: "scribe" },
    answers: [WHOLE],
    splits: [checkSplit({ parts: [{ start: 20, end: 40, asked: "Walk me through it", question_id: "Q1" }, { start: 40, end: 60, asked: "Why row 80", question_id: "Q2" }] }, context)],
  };
  const text = defenceEvidence({ title: "Homework 1", assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-JNG7SN", criteria: CRITERIA, questions: QUESTIONS, session });
  // A part asking a prepared question is shown under it, in place of "nothing citable".
  assert.match(
    text,
    /### CRIT-HW1-SPLIT Train\/test split\nQ2: Why split at row 80\?\n {2}Q0 take 1, part 2 \(split proposed by test\/model, not yet checked\): the professor asked "Why row 80"\n {2}\(professor asks, @ 40\.0s\) Why did you split at row eighty\?\n {2}\[Q0 take 1 @ 44\.0s\] Because the rows are ordered by date\.\n\n/,
  );
  assert.match(text, /### CRIT-HW1-EVAL Evaluation\n {2}\(no question was asked for this criterion\)/);
  // Outside every part: the greeting stays in Q0's own dialogue.
  assert.match(text, /Q0: The whole defence\.\n {2}\(professor asks, @ 0\.0s\) Hello, shall we start\?\nQ1: Walk me through it\.\n {2}Q0 take 1, part 1 [^\n]*\n[^\n]*\n {2}\[Q0 take 1 @ 24\.0s\] It trains a model/);
  assert.doesNotMatch(text, /nothing citable/);
  // Asked off the list: under the criterion the split gave it.
  const offList = defenceEvidence({
    title: "Homework 1", assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-JNG7SN", criteria: CRITERIA, questions: QUESTIONS,
    session: { ...session, splits: [{ ...session.splits![0]!, parts: [{ question_id: null, asked: "How did you evaluate it", criterion_id: "CRIT-HW1-EVAL", start: 40, end: 60 }] }] },
  });
  assert.match(offList, /### CRIT-HW1-EVAL Evaluation\n {2}Q0 take 1, part 1 [^\n]*"How did you evaluate it"\n/);
  const { proposed } = checkDefenceGrade(
    { criteria: [{ criterion_id: "CRIT-HW1-SPLIT", score: 8, evidence: [{ question: "Q0", take: 1, at: 50, quote: "ordered by date" }] }] },
    { criteria: CRITERIA, session, files: [], sourceRef: (audio) => audio },
  );
  assert.equal(proposed[0]!.evidence[0]!.location, "Q0 take 1 @ 44.0–58.0s");
});

test("a segment belongs to the part holding its middle", () => {
  const parts = [{ question_id: null, asked: "", criterion_id: null, start: 10, end: 20 }];
  assert.equal(partOf(parts, { start: 8, end: 14, text: "" }), 0);
  assert.equal(partOf(parts, { start: 17, end: 30, text: "" }), null);
});

test("presses are kept on the take; a split replaces the last one of its take, is approved by the professor, and is in the replay", () => {
  const place = defencePlace(mkdtempSync(join(tmpdir(), "subs-")), mkdtempSync(join(tmpdir(), "ws-")), "RUN", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  const ids = { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN" };
  recordConsent(place, ids, { agreed: true, at: "2026-10-07T09:59:00Z", statement: "s", provider: "scribe" });
  const { answer } = saveAnswer({ place, ids, questionId: "Q0", bytes: Buffer.from("x"), mime: "audio/webm", seconds: 60, marks: [{ at: 21 }, { at: 41, question_id: "Q2" }] });
  assert.deepEqual(answer.marks, [{ at: 21 }, { at: 41, question_id: "Q2" }]);
  assert.throws(() => recordSplit(place, { ...splitFromMarks({ answer, questions: QUESTIONS, at }), take: 2 }), /no take 2 of Q0/);
  recordSplit(place, splitFromMarks({ answer, questions: QUESTIONS, at }));
  recordSplit(place, splitFromMarks({ answer, questions: QUESTIONS, at: "2026-10-07T10:03:00Z" }));
  assert.equal(readSession(place.session)!.splits!.length, 1);
  approveSplit(place, "Q0", 1);
  const session = readSession(place.session)!;
  assert.equal(session.splits![0]!.approval, "approved");
  const entry = replay(session, QUESTIONS).find((item) => item.kind === "split")!;
  assert.match(entry.text, /Q0 take 1 divided into 2 question\(s\) by your presses, without a model, checked by the professor: 21s "question 1, as marked"; 41s "Why split at row 80\?" \(Q2\)/);
  assert.throws(() => approveSplit(place, "Q0", 3), /has not been split/);
});
