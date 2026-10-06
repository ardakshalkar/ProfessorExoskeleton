import { test } from "node:test";
import assert from "node:assert/strict";
import { type Segment, type Transcript, labelSpeakers, studentWords, wordsToSegments } from "../src/transcribe.ts";
import { nextPrompt, type Answer } from "../src/defence.ts";

const transcript = (segments: Segment[], timed = true): Transcript => ({
  text: segments.map((s) => s.text).join(" "), language: "en", seconds: 30, segments, timed,
  provider: "elevenlabs", model: "scribe_v2", at: "t", cost_usd: null,
});
const seg = (start: number, end: number, text: string, speaker_id?: string): Segment => ({ start, end, text, ...(speaker_id ? { speaker_id } : {}) });

test("Scribe's words start a new segment when the voice changes", () => {
  const segments = wordsToSegments([
    { text: "I", start: 0, end: 0.2, type: "word", speaker_id: "speaker_0" },
    { text: " ", type: "spacing", speaker_id: "speaker_0" },
    { text: "split", start: 0.2, end: 0.6, type: "word", speaker_id: "speaker_0" },
    { text: "Why?", start: 0.8, end: 1.1, type: "word", speaker_id: "speaker_1" },
    { text: "Because", start: 1.4, end: 1.9, type: "word", speaker_id: "speaker_0" },
  ]);
  assert.deepEqual(segments.map((s) => [s.text, s.speaker_id]), [["I split", "speaker_0"], ["Why?", "speaker_1"], ["Because", "speaker_0"]]);
});

test("with two voices, the one who spoke most is the student and the other is the professor", () => {
  const out = labelSpeakers(transcript([
    seg(0, 12, "I split the data by date because the rows are ordered.", "speaker_0"),
    seg(12, 14, "Ordered by what?", "speaker_1"),
    seg(14, 22, "By the timestamp column, so the test set is the future.", "speaker_0"),
  ]));
  assert.deepEqual(out.segments.map((s) => s.speaker), ["student", "professor", "student"]);
  assert.deepEqual(out.speakers, { method: "diarized", unclear: false });
  assert.deepEqual(studentWords(out)!.map((s) => s.start), [0, 14]);
});

test("a voice heard while the professor held the key is the professor's, even if it spoke most", () => {
  const out = labelSpeakers(
    transcript([seg(0, 10, "Let me rephrase the question for you, slowly.", "speaker_1"), seg(10, 16, "It is a random forest.", "speaker_0")]),
    [[0, 10.2]],
  );
  assert.deepEqual(out.segments.map((s) => s.speaker), ["professor", "student"]);
  assert.equal(out.speakers!.unclear, false);
});

test("two voices speaking about as much make the take unclear, and none of it is cited", () => {
  const out = labelSpeakers(transcript([seg(0, 10, "a", "speaker_0"), seg(10, 18, "b", "speaker_1")]));
  assert.equal(out.speakers!.unclear, true);
  assert.match(out.speakers!.note!, /56% and 44%/);
  assert.equal(studentWords(out), null);
});

test("a third voice is unknown, not the professor", () => {
  const out = labelSpeakers(transcript([seg(0, 20, "answer", "speaker_0"), seg(20, 22, "door", "speaker_1"), seg(22, 23, "cough", "speaker_2")]));
  assert.deepEqual(out.segments.map((s) => s.speaker), ["student", "unknown", "unknown"]);
});

test("without separated voices, the marked stretches are the professor's and the rest the student's", () => {
  const out = labelSpeakers(transcript([seg(0, 5, "It trains a model."), seg(5, 8, "Which one?"), seg(8, 12, "Logistic regression.")]), [[5, 8]]);
  assert.deepEqual(out.segments.map((s) => s.speaker), ["student", "professor", "student"]);
  assert.deepEqual(out.speakers, { method: "marked", unclear: false });
});

test("nothing separated and nothing marked is said to be an assumption", () => {
  const out = labelSpeakers(transcript([seg(0, 5, "x")]));
  assert.equal(out.speakers!.method, "assumed");
  assert.equal(out.speakers!.unclear, false);
});

test("an untimed transcript cannot have the professor's words cut out, so a marked one is unclear", () => {
  const out = labelSpeakers(transcript([seg(0, 30, "everything")], false), [[3, 5]]);
  assert.equal(out.speakers!.unclear, true);
  assert.equal(out.segments[0]!.speaker, "unknown");
  assert.equal(labelSpeakers(transcript([seg(0, 30, "everything")], false)).speakers!.unclear, false);
});

test("the next-question prompt never presents the professor's words as the answer", () => {
  const answer: Answer = {
    question_id: "Q1", take: 1, audio: "a", mime: "audio/webm", recorded_at: "t", seconds: 22,
    transcript: labelSpeakers(transcript([seg(0, 12, "I split by date.", "speaker_0"), seg(12, 14, "Ordered by what?", "speaker_1"), seg(14, 22, "By timestamp.", "speaker_0")])),
  };
  const text = nextPrompt({ digest: "", questions: [{ id: "Q1", kind: "opening", text: "Explain.", criterion_id: null, why: "", evidence: [], approval: "draft" }], answers: [answer], after: "Q1" });
  assert.match(text, /I split by date\. \[professor: Ordered by what\?\] By timestamp\./);
});
