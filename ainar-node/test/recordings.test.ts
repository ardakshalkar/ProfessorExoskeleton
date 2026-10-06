import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  costTable,
  mp4Seconds,
  nameFromFile,
  planLength,
  planRecordings,
  wavSeconds,
  writeRecordingPlan,
} from "../src/recordings.ts";
import { RosterStore } from "../src/roster.ts";
import { labelSpeakers, type Transcript } from "../src/transcribe.ts";
import {
  WHOLE_DEFENCE,
  assignVoices,
  defenceEvidence,
  defencePlace,
  ensureWholeDefence,
  readDefence,
  readSession,
  writeSession,
} from "../src/defence.ts";

const wav = (seconds: number, rate = 8000): Buffer => {
  const data = Math.round(seconds * rate * 2);
  const buffer = Buffer.alloc(44 + data);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + data, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(data, 40);
  return buffer;
};

const m4a = (seconds: number, timescale = 44100): Buffer => {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, "ascii");
    return Buffer.concat([head, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(Math.round(seconds * timescale), 16);
  return Buffer.concat([box("ftyp", Buffer.from("M4A isom")), box("moov", box("mvhd", mvhd))]);
};

test("a recording's length is read from its own header when there is no ffprobe", () => {
  assert.equal(wavSeconds(wav(2.5)), 2.5);
  assert.equal(mp4Seconds(m4a(125)), 125);
  assert.equal(wavSeconds(Buffer.from("not audio at all, really not")), null);
});

test("who a recording is, from what it was called", () => {
  assert.deepEqual(nameFromFile("STUDENT-JNG7SN defence 2026-10-06.m4a"), { student: "STUDENT-JNG7SN" });
  assert.deepEqual(nameFromFile("221045678_hw1.m4a"), { number: "221045678" });
  assert.deepEqual(nameFromFile("Айгерим Нурланова — защита 12-30.m4a"), { name: "Айгерим Нурланова —" .replace(" —", "") });
  assert.deepEqual(nameFromFile("Recording 20261006 1430.m4a"), {});
});

const roster = () =>
  new RosterStore(mkdtempSync(join(tmpdir(), "roster-")), {
    "STUDENT-AAAAAA": { name: "Aigerim Nurlanova" } as any,
    "STUDENT-BBBBBB": { name: "Daniyar Seitkali" } as any,
  });

test("the plan places recordings by name or pseudonym, keeps the professor's placements, and holds two of one student", () => {
  const inbox = mkdtempSync(join(tmpdir(), "rec-"));
  for (const file of ["rec-1.m4a", "rec-2.wav", "rec-3.m4a", "rec-4.m4a", "notes.txt"]) writeFileSync(join(inbox, file), "x");
  writeFileSync(
    join(inbox, "uploads.json"),
    JSON.stringify([
      { file: "rec-1.m4a", original: "Aigerim Nurlanova defence.m4a" },
      { file: "rec-2.wav", original: "STUDENT-BBBBBB.wav" },
      { file: "rec-3.m4a", original: "Unknown Person.m4a" },
      { file: "rec-4.m4a", original: "Seitkali Daniyar hw1.m4a" },
    ]),
  );
  const enrolled = new Set(["STUDENT-AAAAAA", "STUDENT-BBBBBB"]);
  const seconds = (path: string) => (path.endsWith("rec-3.m4a") ? null : 60);
  const plan = planRecordings({ inbox, runId: "RUN", assessmentId: "ASSESSMENT-HW1", store: roster(), salt: null, enrolled, seconds });
  const by = Object.fromEntries(plan.entries.map((e) => [e.file, e]));
  assert.equal(plan.entries.length, 4, "only audio is a recording");
  assert.equal(by["rec-1.m4a"].student, "STUDENT-AAAAAA");
  assert.match(by["rec-2.wav"].problem!, /more than one recording/);
  assert.match(by["rec-4.m4a"].problem!, /more than one recording/);
  assert.ok(by["rec-3.m4a"].problem);

  // The professor skips one of the two and places the unknown one.
  writeRecordingPlan(inbox, {
    ...plan,
    entries: plan.entries.map((e) =>
      e.file === "rec-4.m4a" ? { ...e, skip: "a test recording" } : e.file === "rec-3.m4a" ? { ...e, student: "STUDENT-AAAAAA" } : e,
    ),
  });
  const again = planRecordings({ inbox, runId: "RUN", assessmentId: "ASSESSMENT-HW1", store: roster(), salt: null, enrolled, seconds });
  const now = Object.fromEntries(again.entries.map((e) => [e.file, e]));
  assert.equal(now["rec-4.m4a"].skip, "a test recording");
  assert.equal(now["rec-2.wav"].student, "STUDENT-BBBBBB");
  assert.match(now["rec-1.m4a"].problem!, /more than one recording/, "two placed on one student are held again");
});

test("the bill counts what would be sent, and shows what placing the rest would add", () => {
  const length = planLength({
    run: "R",
    assessment: "A",
    entries: [
      { file: "a", original: "a", seconds: 120, student: "STUDENT-A" },
      { file: "b", original: "b", seconds: null, student: "STUDENT-B" },
      { file: "c", original: "c", seconds: 60, problem: "?" },
      { file: "d", original: "d", seconds: 600, skip: "no" },
      { file: "e", original: "e", seconds: 600, student: "STUDENT-E", filed: "x" },
    ],
  });
  assert.deepEqual(length, { seconds: 120, unknown: 1, files: 2, unplaced: 1, unplacedSeconds: 60 });
});

test("the cost is quoted on every transcription connection configured; a local one is free", () => {
  const file = join(mkdtempSync(join(tmpdir(), "reg-")), "connections.json");
  writeFileSync(
    file,
    JSON.stringify({
      connections: {
        scribe: { type: "transcription", provider: "elevenlabs", model: "scribe_v2", pricePerMinute: 0.0037 },
        campus: { type: "transcription", provider: "openai", model: "ksc2", baseUrl: "http://127.0.0.1:8000/v1", pricePerMinute: 0.5 },
        canvas: { type: "canvas", baseUrl: "https://canvas.example.edu" },
      },
      defaults: { transcription: "scribe" },
    }),
  );
  const lines = costTable(74 * 10 * 60, file);
  assert.deepEqual(
    lines.map((l) => [l.connection, l.cost, l.default, l.local]),
    [["campus", 0, false, true], ["scribe", 2.74, true, false]],
  );
});

const whole = (segments: any[]): Transcript => ({
  text: "", language: "en", seconds: 30, timed: true, provider: "elevenlabs", model: "scribe_v2", at: "t", cost_usd: null, segments,
});
const DIALOGUE = [
  { start: 0, end: 4, text: "Tell me why you split by date.", speaker_id: "speaker_0" },
  { start: 4, end: 14, text: "Because the rows are ordered, so the last fifth is the future.", speaker_id: "speaker_1" },
  { start: 14, end: 17, text: "And if you shuffled?", speaker_id: "speaker_0" },
  { start: 17, end: 25, text: "Then the model would see tomorrow while learning about today.", speaker_id: "speaker_1" },
];

test("a whole defence is unclear until the professor's voice is known — by P, or by saying which it is", () => {
  const guessed = labelSpeakers(whole(DIALOGUE), [], { wholeDefence: true });
  assert.equal(guessed.speakers!.unclear, true);
  assert.match(guessed.speakers!.note!, /say which voice is yours/);

  const marked = labelSpeakers(whole(DIALOGUE), [[0, 4]], { wholeDefence: true });
  assert.equal(marked.speakers!.unclear, false);
  assert.deepEqual(marked.segments.map((s) => s.speaker), ["professor", "student", "professor", "student"]);

  const told = labelSpeakers(whole(DIALOGUE), [], { wholeDefence: true, professorVoices: ["speaker_0"] });
  assert.equal(told.speakers!.unclear, false);
  assert.deepEqual(told.speakers!.professor_voices, ["speaker_0"]);
  assert.deepEqual(told.segments.map((s) => s.speaker), ["professor", "student", "professor", "student"]);
});

test("a whole defence with no voices separated and nothing marked is never cited", () => {
  const plain = labelSpeakers(whole(DIALOGUE.map(({ speaker_id, ...rest }) => rest)), [], { wholeDefence: true });
  assert.equal(plain.speakers!.unclear, true);
  assert.match(plain.speakers!.note!, /does not separate voices/);
});

test("Q0 is made for a defence recorded in one piece; 'this voice is me' relabels it; the evidence is the dialogue", () => {
  const place = defencePlace(mkdtempSync(join(tmpdir(), "subs-")), mkdtempSync(join(tmpdir(), "ws-")), "RUN", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  const ids = { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN" };
  const questions = ensureWholeDefence(place.questions, ids, { url: "https://github.com/a/b", commit: "c" });
  assert.deepEqual(questions.map((q) => [q.id, q.kind]), [[WHOLE_DEFENCE, "whole"]]);
  assert.equal(ensureWholeDefence(place.questions, ids, { url: "", commit: "" }).length, 1, "made once");

  mkdirSync(place.dir, { recursive: true });
  writeSession(place.session, {
    ...ids,
    consent: { agreed: true, at: "t", statement: "s", provider: null },
    answers: [{
      question_id: WHOLE_DEFENCE, take: 1, audio: "answers/Q0-1.m4a", mime: "audio/mp4", recorded_at: "t", seconds: 25,
      transcript: labelSpeakers(whole(DIALOGUE), [], { wholeDefence: true }),
    }],
  });
  assert.throws(() => assignVoices(place, WHOLE_DEFENCE, 1, ["speaker_9"]), /not a voice in this take/);
  assignVoices(place, WHOLE_DEFENCE, 1, ["speaker_0"]);
  const labelled = readSession(place.session)!.answers[0]!.transcript!;
  assert.equal(labelled.speakers!.unclear, false);

  const text = defenceEvidence({
    title: "HW1", assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-JNG7SN",
    criteria: [{ criterion_id: "CRIT-1", title: "Split", maximum_score: 10 }],
    questions: readDefence(place.questions)!.questions,
    session: readSession(place.session),
  });
  assert.match(text, /\(professor asks, @ 0\.0s\) Tell me why you split by date\.\n {2}\[Q0 take 1 @ 4\.0s\] Because the rows are ordered/);
});
