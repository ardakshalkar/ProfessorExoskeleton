import assert from "node:assert/strict";
import { test } from "node:test";
import { exporterFor, moodleXml, qtiAssessmentXml, qtiManifestXml, validateLmsExam } from "../src/lms-export.ts";

const exam = validateLmsExam({
  title: "Sample Exam",
  questions: [
    { number: 1, marks: 2, prompt: "Pick <one>.", options: [{ label: "A", text: "No" }, { label: "B", text: "Yes" }], correctOptions: ["B"] },
    { number: 2, marks: 3, prompt: "Explain why." },
  ],
});

test("Moodle XML contains scored choice and manual essay questions", () => {
  const xml = moodleXml(exam);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.equal((xml.match(/<question type=/g) ?? []).length, 2);
  assert.match(xml, /<answer fraction="100"/);
  assert.match(xml, /<question type="essay">/);
  assert.doesNotMatch(xml, /Instructions|assessment policy/i);
});

test("QTI 1.2 assessment identifies Canvas-compatible question types", () => {
  const xml = qtiAssessmentXml(exam);
  assert.match(xml, /ims_qtiasiv1p2/);
  assert.match(xml, /multiple_choice_question/);
  assert.match(xml, /essay_question/);
  assert.match(xml, /<varequal respident="response">B<\/varequal>/);
  assert.match(qtiManifestXml(exam), /imsqti_xmlv1p2/);
});

test("QTI exporter creates a ZIP archive", () => {
  const artifact = exporterFor("canvas-qti").export(exam);
  assert.equal(artifact.mediaType, "application/zip");
  assert.deepEqual(Array.from(artifact.data.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
});

test("choice questions require an explicit valid answer key", () => {
  assert.throws(() => validateLmsExam({ questions: [{ number: 1, prompt: "Pick", options: [{ label: "A", text: "A" }] }] }), /correctOptions/);
  assert.throws(() => validateLmsExam({ questions: [{ number: 1, prompt: "Pick", options: [{ label: "A", text: "A" }], correctOptions: ["B"] }] }), /does not match/);
});
