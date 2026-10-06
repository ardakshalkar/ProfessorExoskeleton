import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Answer,
  type Question,
  briefText,
  decideNext,
  defencePlace,
  editQuestion,
  nextPrompt,
  overrideDecision,
  readDefence,
  readSession,
  recordDecision,
  writeDefence,
} from "../src/defence.ts";

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id, kind: "probe", text: `Question ${id}?`, criterion_id: null, why: "", evidence: [], approval: "draft", ...extra,
});
const QUESTIONS = [q("Q1", { kind: "opening" }), q("Q2", { criterion_id: "CRIT-SPLIT" }), q("Q3")];
const heard = (id: string, text: string, low = false): Answer => ({
  question_id: id, take: 1, audio: `answers/${id}-1.webm`, mime: "audio/webm", recorded_at: "t", seconds: 5,
  transcript: {
    text, language: "en", seconds: 5, timed: true, provider: "openai", model: "m", at: "t", cost_usd: null,
    segments: [{ start: 0, end: 5, text, ...(low ? { confidence: "low" as const } : {}) }],
  },
});
const CONTEXT = {
  questions: QUESTIONS,
  answers: [heard("Q1", "It trains a model."), heard("Q2", "Because the rows are ordered.")],
  criteria: [{ criterion_id: "CRIT-SPLIT", title: "Split" }],
  files: [{ path: "train.py", text: "1│ x", lines: 20 }],
  after: "Q2",
  by: "deepseek/deepseek-v4-pro",
  at: "2026-10-06T12:00:00Z",
};

test("a follow-up is checked like any question, numbered after the rest, and follows the answer just given", () => {
  const { decision, followUp } = decideNext(
    '```json\n{"action":"follow_up","text":"Ordered by what?","criterion_id":"CRIT-SPLIT","why":"The ordering was asserted, not shown."}\n```',
    CONTEXT,
  );
  assert.equal(decision.action, "follow_up");
  assert.equal(decision.question_id, "Q4");
  assert.equal(decision.why, "The ordering was asserted, not shown.");
  assert.deepEqual([followUp!.id, followUp!.kind, followUp!.follows, followUp!.criterion_id], ["Q4", "follow_up", "Q2", "CRIT-SPLIT"]);
});

test("next must name a prepared question still to ask; anything else falls back to the first one, with a note", () => {
  assert.equal(decideNext('{"action":"next","question_id":"Q3","why":"x"}', CONTEXT).decision.question_id, "Q3");
  const wrong = decideNext('{"action":"next","question_id":"Q1","why":"x"}', CONTEXT).decision;
  assert.equal(wrong.question_id, "Q3");
  assert.match(wrong.notes![0]!, /Q1, which is not a prepared question still to ask/);
});

test("a reply that is not a choice does not stop the defence", () => {
  const { decision } = decideNext("I think the student did well!", CONTEXT);
  assert.deepEqual([decision.action, decision.question_id], ["next", "Q3"]);
  assert.match(decision.notes![0]!, /not a choice/);
});

test("with nothing left to ask, an unusable reply ends the defence", () => {
  const { decision } = decideNext("??", { ...CONTEXT, answers: [...CONTEXT.answers, heard("Q3", "x")] });
  assert.deepEqual([decision.action, decision.question_id], ["done", null]);
});

test("follow-ups stop two deep, and the desk moves on", () => {
  const deep = [...QUESTIONS, q("Q4", { kind: "follow_up", follows: "Q2" }), q("Q5", { kind: "follow_up", follows: "Q4" })];
  const { decision, followUp } = decideNext('{"action":"follow_up","text":"And then?","why":"x"}', {
    ...CONTEXT,
    questions: deep,
    answers: [...CONTEXT.answers, heard("Q4", "a"), heard("Q5", "b")],
    after: "Q5",
  });
  assert.equal(followUp, null);
  assert.deepEqual([decision.action, decision.question_id], ["next", "Q3"]);
  assert.match(decision.notes![0]!, /2 follow-ups deep/);
});

test("the prompt carries the code first, then what was said, with the unsure stretches marked", () => {
  const text = nextPrompt({
    digest: "# DIGEST",
    questions: QUESTIONS,
    answers: [heard("Q1", "It trains a model."), heard("Q2", "rows are sorted", true)],
    after: "Q2",
  });
  assert.ok(text.startsWith("# DIGEST"));
  assert.match(text, /Q2 \[CRIT-SPLIT\]: Question Q2\?\n {2}\[unsure: rows are sorted\]/);
  assert.match(text, /Q3: Question Q3\?\n {2}\(not asked yet\)/);
  assert.match(text, /just answered Q2\.\nPrepared questions not asked yet: Q3\./);
});

test("decisions and the professor's overrides are kept in the session, and an edit changes the question", () => {
  const place = defencePlace(mkdtempSync(join(tmpdir(), "subs-")), mkdtempSync(join(tmpdir(), "ws-")), "RUN", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  const ids = { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN" };
  const first = recordDecision(place, ids, { after: "Q1", action: "next", question_id: "Q2", why: "x", by: "m", at: "t" });
  const second = recordDecision(place, ids, { after: "Q2", action: "next", question_id: "Q3", why: "y", by: "m", at: "t" });
  overrideDecision(place, second, "skip");
  assert.deepEqual([first, second], [0, 1]);
  assert.deepEqual(readSession(place.session)!.decisions!.map((d) => d.overridden ?? null), [null, "skip"]);

  writeDefence(place.questions, { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN", repo: { url: "u", commit: "c" }, questions: QUESTIONS });
  editQuestion(place.questions, "Q3", "  Why accuracy and not F1?  ");
  assert.equal(readDefence(place.questions)!.questions[2]!.text, "Why accuracy and not F1?");
  assert.throws(() => editQuestion(place.questions, "Q9", "x"), /no question Q9/);
});

test("the brief is the course's markdown file when there is one, else the description", () => {
  const root = mkdtempSync(join(tmpdir(), "ws-"));
  writeFileSync(join(root, "brief.md"), "# Do the thing");
  const documents = [{ document_id: "DOC-1", storage_key: "brief.md" }, { document_id: "DOC-2", storage_key: "object://x.pdf" }];
  assert.equal(briefText(root, documents, { instructions_document_id: "DOC-1" }), "# Do the thing");
  assert.equal(briefText(root, documents, { instructions_document_id: "DOC-2", description: "Short." }), "Short.");
});
