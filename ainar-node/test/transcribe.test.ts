import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configFromRegistry,
  elevenlabsTranscriber,
  estimate,
  openaiTranscriber,
  wordsToSegments,
} from "../src/transcribe.ts";
import {
  audioExtension,
  checkQuestions,
  defencePlace,
  readSession,
  saveAnswer,
  transcribeTake,
  type Question,
} from "../src/defence.ts";
import { connectionAsJson, readConnection } from "../src/connections/index.ts";

const audioFile = (): string => {
  const path = join(mkdtempSync(join(tmpdir(), "audio-")), "a.webm");
  writeFileSync(path, Buffer.from([1, 2, 3]));
  return path;
};

/** A fetch that answers from a list and records each request's url and form fields. */
const fakeFetch = (replies: { status: number; body: unknown }[]) => {
  const seen: { url: string; fields: Record<string, string>; headers: any }[] = [];
  const call = (async (url: string, init: any) => {
    const fields: Record<string, string> = {};
    for (const [key, value] of (init.body as FormData).entries()) {
      fields[key] = typeof value === "string" ? value : `<file ${(value as File).name}>`;
    }
    seen.push({ url, fields, headers: init.headers });
    const reply = replies.shift()!;
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status });
  }) as unknown as typeof fetch;
  return { call, seen };
};

test("the OpenAI protocol asks for segments, and flags the ones Whisper was unsure of", async () => {
  const { call, seen } = fakeFetch([
    {
      status: 200,
      body: {
        text: "I split by date. Because leakage.",
        language: "english",
        duration: 6.2,
        segments: [
          { start: 0, end: 3.1, text: " I split by date.", avg_logprob: -0.2, no_speech_prob: 0.01 },
          { start: 3.1, end: 6.2, text: " Because leakage.", avg_logprob: -1.4, no_speech_prob: 0.02 },
        ],
      },
    },
  ]);
  const transcript = await openaiTranscriber(
    { provider: "openai", model: "whisper-large-v3", baseUrl: "https://api.groq.com/openai/v1", apiKey: "k", pricePerMinute: 0.0019 },
    call,
  )({ path: audioFile(), mime: "audio/webm" }, { language: "en", prompt: "Why split by date?" });
  assert.equal(seen[0]!.url, "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.equal(seen[0]!.fields.response_format, "verbose_json");
  assert.equal(seen[0]!.fields.language, "en");
  assert.equal(seen[0]!.fields.prompt, "Why split by date?");
  assert.equal(seen[0]!.headers.authorization, "Bearer k");
  assert.equal(transcript.timed, true);
  assert.deepEqual(transcript.segments.map((s) => s.confidence ?? "ok"), ["ok", "low"]);
  assert.equal(transcript.seconds, 6.2);
  assert.equal(transcript.cost_usd, 0.000196);
});

test("a model that will not give segments is asked again for plain json, and says it is untimed", async () => {
  const { call, seen } = fakeFetch([
    { status: 400, body: { error: { message: "response_format 'verbose_json' is not compatible with gpt-4o-transcribe" } } },
    { status: 200, body: { text: "Hello." } },
  ]);
  const transcript = await openaiTranscriber({ provider: "openai", model: "gpt-4o-transcribe", apiKey: "k" }, call)({
    path: audioFile(),
    mime: "audio/webm",
    seconds: 4,
  });
  assert.equal(seen[1]!.fields.response_format, "json");
  assert.equal(transcript.timed, false);
  assert.deepEqual(transcript.segments, [{ start: 0, end: 4, text: "Hello." }]);
});

test("a local Whisper server is sent no key", async () => {
  const { call, seen } = fakeFetch([{ status: 200, body: { text: "x", segments: [] } }]);
  await openaiTranscriber({ provider: "openai", model: "large-v3", baseUrl: "http://localhost:8000/v1", apiKey: null }, call)({
    path: audioFile(),
    mime: "audio/webm",
  });
  assert.equal(seen[0]!.headers, undefined);
});

test("Scribe's words become sentences, unsure where their log-probabilities are", () => {
  const segments = wordsToSegments([
    { text: "Мен", start: 0, end: 0.4, type: "word", logprob: -0.1 },
    { text: " ", type: "spacing" },
    { text: "бөлдім.", start: 0.4, end: 1.0, type: "word", logprob: -0.2 },
    { text: "(laughs)", start: 1, end: 1.2, type: "audio_event" },
    { text: "Себебі", start: 1.3, end: 1.9, type: "word", logprob: -2.5 },
    { text: " ", type: "spacing" },
    { text: "leakage", start: 1.9, end: 2.5, type: "word", logprob: -1.8 },
  ]);
  assert.deepEqual(segments, [
    { start: 0, end: 1, text: "Мен бөлдім." },
    { start: 1.3, end: 2.5, text: "Себебі leakage", confidence: "low" },
  ]);
});

test("Scribe is asked for word timestamps, with its own key header", async () => {
  const { call, seen } = fakeFetch([
    { status: 200, body: { text: "Иә.", language_code: "kaz", words: [{ text: "Иә.", start: 0, end: 0.5, type: "word" }] } },
  ]);
  const transcript = await elevenlabsTranscriber({ provider: "elevenlabs", model: "scribe_v1", apiKey: "xi" }, call)(
    { path: audioFile(), mime: "audio/webm" },
    { language: "kk" },
  );
  assert.equal(seen[0]!.url, "https://api.elevenlabs.io/v1/speech-to-text");
  assert.equal(seen[0]!.headers["xi-api-key"], "xi");
  assert.equal(seen[0]!.fields.model_id, "scribe_v1");
  assert.equal(seen[0]!.fields.language_code, "kk");
  assert.equal(seen[0]!.fields.timestamps_granularity, "word");
  assert.equal(transcript.language, "kaz");
  assert.equal(transcript.seconds, 0.5);
});

test("a provider's refusal is an error naming it", async () => {
  const { call } = fakeFetch([{ status: 401, body: "bad key" }]);
  await assert.rejects(
    elevenlabsTranscriber({ provider: "elevenlabs", model: "scribe_v1", apiKey: "x" }, call)({ path: audioFile(), mime: "audio/webm" }),
    /ElevenLabs answered 401: bad key/,
  );
});

test("a transcription connection needs a provider and a model, and says when it has no price", () => {
  const bad = readConnection("stt", { type: "transcription" });
  assert.deepEqual(bad.issues.map((i) => i.code).sort(), ["bad_provider", "no_model", "no_price"]);
  const good = readConnection("groq", {
    type: "transcription",
    provider: "openai",
    model: "whisper-large-v3",
    baseUrl: "https://api.groq.com/openai/v1",
    pricePerMinute: 0.00185,
  });
  assert.deepEqual(good.issues, []);
  assert.equal(good.tokenEnv, "AINAR_TRANSCRIPTION_TOKEN");
});

test("writing a connection back keeps what its type carries: a GitHub owner, a transcription model and price", () => {
  const github = connectionAsJson(readConnection("gh", { type: "github", owner: "narxoz-ai" }));
  assert.equal(github.owner, "narxoz-ai");
  const stt = connectionAsJson(
    readConnection("scribe", { type: "transcription", provider: "elevenlabs", model: "scribe_v1", pricePerMinute: 0.0067 }),
  );
  assert.deepEqual([stt.provider, stt.model, stt.pricePerMinute], ["elevenlabs", "scribe_v1", 0.0067]);
});

test("the registry's transcription connection becomes a config; a local one needs no key", () => {
  const file = join(mkdtempSync(join(tmpdir(), "reg-")), "connections.json");
  writeFileSync(
    file,
    JSON.stringify({
      connections: {
        campus: {
          type: "transcription",
          provider: "openai",
          model: "large-v3",
          baseUrl: "http://localhost:8000/v1",
          tokenEnv: "AINAR_TEST_UNSET_TOKEN",
          pricePerMinute: 0,
        },
      },
    }),
  );
  const { config, connection } = configFromRegistry(null, file);
  assert.equal(connection.name, "campus");
  assert.equal(config.apiKey, null);
  assert.equal(config.baseUrl, "http://localhost:8000/v1");
});

test("the cost of a batch is quoted from the connection's price, or not at all", () => {
  assert.equal(estimate(0.006, 30 * 60), 0.18);
  assert.equal(estimate(null, 600), null);
});

// ------------------------------------------------------------------ answers

const QUESTIONS: Question[] = [
  { id: "Q1", kind: "opening", text: "Walk me through it.", criterion_id: null, why: "", evidence: [], approval: "draft" },
  { id: "Q2", kind: "probe", text: "Why split at row 80?", criterion_id: null, why: "", evidence: [{ path: "train.py", lines: "3" }], approval: "draft" },
];

test("a follow-up is numbered after the questions there, and must follow one of them", () => {
  const { questions, notes } = checkQuestions(
    { questions: [{ text: "And if the rows were shuffled?", follows: "Q2" }, { text: "Odd one", follows: "Q9" }] },
    [],
    [],
    QUESTIONS,
  );
  assert.deepEqual(questions.map((q) => [q.id, q.kind, q.follows]), [["Q3", "follow_up", "Q2"], ["Q4", "probe", undefined]]);
  assert.match(notes[0]!, /Q4: follows Q9/);
});

test("browser recordings and phone files are kept; anything else is refused", () => {
  assert.equal(audioExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(audioExtension("audio/mp4"), "m4a");
  assert.equal(audioExtension("video/webm"), null);
});

test("every take is kept, numbered, and a failed transcription leaves the recording and the reason", async () => {
  const place = defencePlace(mkdtempSync(join(tmpdir(), "subs-")), "/ws", "RUN", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  const ids = { submission_id: "SUB-1", assessment_id: "ASSESSMENT-HW1", student_id: "STUDENT-JNG7SN" };
  const first = saveAnswer({ place, ids, questionId: "Q2", bytes: Buffer.from("a"), mime: "audio/webm;codecs=opus", seconds: 12.34 });
  const second = saveAnswer({ place, ids, questionId: "Q2", bytes: Buffer.from("b"), mime: "audio/webm", seconds: 3 });
  assert.equal(first.answer.audio, "answers/Q2-1.webm");
  assert.equal(second.answer.take, 2);
  assert.equal(first.answer.seconds, 12.3);
  assert.equal(readFileSync(first.path, "utf-8"), "a");
  assert.throws(() => saveAnswer({ place, ids, questionId: "../x", bytes: Buffer.from(""), mime: "audio/webm" }), /not a question id/);

  const failed = await transcribeTake({
    place,
    answer: first.answer,
    transcribe: async () => {
      throw new Error("no credit");
    },
  });
  assert.equal(failed.error, "no credit");

  const heard = await transcribeTake({
    place,
    answer: first.answer,
    question: QUESTIONS[1],
    transcribe: async (_audio, hints) => {
      assert.equal(hints?.prompt, "Why split at row 80? train.py");
      return {
        text: "Because.", language: "en", seconds: 12.3, segments: [{ start: 0, end: 12.3, text: "Because." }],
        timed: true, provider: "openai", model: "m", at: "t", cost_usd: null,
      };
    },
  });
  assert.equal(heard.transcript!.text, "Because.");
  assert.equal(heard.error, undefined);
  const session = readSession(place.session)!;
  assert.deepEqual(session.answers.map((a) => [a.question_id, a.take, !!a.transcript]), [["Q2", 1, true], ["Q2", 2, false]]);
});
