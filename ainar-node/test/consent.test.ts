import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { describeTranscription } from "../src/transcribe.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captionAudio,
  consentGiven,
  consentStatement,
  defencePlace,
  readSession,
  recordConsent,
  recordDecision,
  replay,
  saveAnswer,
  setTranscript,
  withdrawConsent,
  type Question,
} from "../src/defence.ts";

const fresh = () => {
  const place = defencePlace(mkdtempSync(join(tmpdir(), "subs-")), mkdtempSync(join(tmpdir(), "ws-")), "RUN", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  const ids = { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN" };
  return { place, ids };
};
const take = (place: any, ids: any, questionId = "Q1", askedAt?: string) =>
  saveAnswer({ place, ids, questionId, bytes: Buffer.from("x"), mime: "audio/webm", seconds: 4, askedAt, now: new Date("2026-10-06T10:05:00Z") });

test("nothing is recorded before the student has agreed, and no file is written", () => {
  const { place, ids } = fresh();
  assert.throws(() => take(place, ids), /no recorded consent/);
  assert.equal(existsSync(join(place.dir, "answers", "Q1-1.webm")), false);
  recordConsent(place, ids, { agreed: false, at: "2026-10-06T10:00:00Z", statement: "s", provider: null });
  assert.throws(() => take(place, ids), /no recorded consent/);
});

test("once agreed, takes are kept; once withdrawn, nothing more is, and what was is marked", () => {
  const { place, ids } = fresh();
  recordConsent(place, ids, { agreed: true, at: "2026-10-06T10:00:00Z", statement: "s", provider: "scribe" });
  assert.equal(consentGiven(readSession(place.session)), true);
  take(place, ids);
  withdrawConsent(place, "2026-10-06T10:06:00Z");
  assert.equal(consentGiven(readSession(place.session)), false);
  assert.throws(() => take(place, ids, "Q2"), /withdrew consent/);
  const session = readSession(place.session)!;
  assert.deepEqual(session.answers.map((a) => [a.question_id, a.withdrawn]), [["Q1", true]]);
  assert.ok(existsSync(join(place.dir, "answers", "Q1-1.webm")), "the recording is kept; deleting it is the professor's call");
});

test("the statement says where the voice goes, from the provider actually configured", () => {
  assert.match(consentStatement({ name: "scribe", provider: "elevenlabs", model: "scribe_v2", local: false }), /sent to ElevenLabs \(scribe, scribe_v2\)/);
  assert.match(consentStatement({ name: "whisper-local", provider: "openai", model: "whisper-turbo-ksc2", local: true }), /on this machine \(whisper-turbo-ksc2\) and do not leave it/);
  assert.match(consentStatement(null), /No transcription service is set up yet/);
  assert.match(consentStatement(null), /You may ask to stop at any time/);
});

test("a live caption needs consent, and leaves nothing behind — even when the provider fails", async () => {
  const { place, ids } = fresh();
  const bytes = Buffer.from("opus");
  const seen: string[] = [];
  const transcribe = async (audio: { path: string }) => {
    seen.push(audio.path);
    assert.ok(existsSync(audio.path), "the piece is on disk while it is transcribed");
    return { text: "it trains a model", language: "en", seconds: 5, segments: [{ start: 0, end: 5, text: "it trains a model" }], timed: true, provider: "p", model: "m", at: "t", cost_usd: null };
  };
  await assert.rejects(captionAudio({ place, bytes, mime: "audio/webm", transcribe }), /no recorded consent/);
  recordConsent(place, ids, { agreed: true, at: "t", statement: "s", provider: null });
  const caption = await captionAudio({ place, bytes, mime: "audio/webm;codecs=opus", transcribe });
  assert.equal(caption.text, "it trains a model");
  assert.equal(existsSync(seen[0]!), false, "the piece is removed");
  await assert.rejects(
    captionAudio({ place, bytes, mime: "audio/webm", transcribe: async (audio) => { seen.push(audio.path); throw new Error("provider down"); } }),
    /provider down/,
  );
  assert.equal(existsSync(seen[1]!), false, "removed when the provider fails too");
  assert.equal(readSession(place.session)!.answers.length, 0, "a caption is not a take");
});

test("a provider set up without its key is still the one named: the student is not told their voice stays here", () => {
  const file = join(mkdtempSync(join(tmpdir(), "reg-")), "connections.json");
  writeFileSync(file, JSON.stringify({ connections: { scribe: { type: "transcription", provider: "elevenlabs", model: "scribe_v2", tokenEnv: "AINAR_TEST_NEVER_SET" } } }));
  const described = describeTranscription(file)!;
  assert.equal(described.name, "scribe");
  assert.match(described.problem!, /no credential/);
  assert.match(consentStatement(described), /sent to ElevenLabs \(scribe, scribe_v2\)/);
  assert.equal(describeTranscription(join(tmpdir(), "no-such-registry.json")), null);
});

test("the replay tells the exchange in order: consent, why each question came, overrides, what was said", () => {
  const { place, ids } = fresh();
  const questions: Question[] = [
    { id: "Q1", kind: "opening", text: "Walk me through it.", criterion_id: null, why: "", evidence: [], approval: "draft" },
    { id: "Q2", kind: "follow_up", follows: "Q1", text: "Which model?", criterion_id: null, why: "", evidence: [], approval: "draft" },
  ];
  recordConsent(place, ids, { agreed: true, at: "2026-10-06T10:00:00Z", statement: "Recorded and sent to ElevenLabs.", provider: "scribe" });
  const first = take(place, ids, "Q1", "2026-10-06T10:01:00Z").answer;
  setTranscript(place, "Q1", first.take, {
    transcript: {
      text: "", language: "en", seconds: 4, timed: true, provider: "elevenlabs", model: "scribe_v2", at: "t", cost_usd: null,
      segments: [{ start: 0, end: 2, text: "It trains a model.", speaker: "student" }, { start: 2, end: 3, text: "Which?", speaker: "professor" }],
      speakers: { method: "diarized", unclear: false },
    },
  });
  recordDecision(place, ids, { after: "Q1", action: "follow_up", question_id: "Q2", why: "No model named.", by: "deepseek/deepseek-v4-pro", at: "2026-10-06T10:02:00Z", overridden: "edit" });
  withdrawConsent(place, "2026-10-06T10:03:00Z");

  const entries = replay(readSession(place.session), questions);
  assert.deepEqual(entries.map((e) => e.kind), ["consent", "answer", "decision", "withdrawn"]);
  assert.match(entries[0]!.text, /agreed to be recorded, having been told: "Recorded and sent to ElevenLabs\."/);
  assert.match(entries[1]!.text, /Q1 take 1, 4s \[WITHDRAWN\] \(answers\/Q1-1\.webm\): It trains a model\. \[professor: Which\?\]/);
  assert.match(entries[2]!.text, /After Q1, deepseek\/deepseek-v4-pro wrote a follow-up, Q2: "Which model\?" — No model named\. Then the professor reworded it\./);
});
