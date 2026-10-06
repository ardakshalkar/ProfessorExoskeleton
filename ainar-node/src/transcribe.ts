/**
 * Speech to text, through whichever provider the professor has configured.
 *
 * BACKLOG E26: AUD-1 and DEF-4. A spoken answer is recorded in the pane and
 * sent here; what comes back is the transcript the grade will cite, with
 * timestamps into the recording so the professor can listen to the moment a
 * claim was made.
 *
 * ## Providers are connections
 *
 * A `transcription` connection in `connections.json` (see `connections/`):
 * where, which model, the NAME of the variable holding the key, and the price
 * per minute the batch preview quotes. Two wire protocols cover the field:
 *
 * * **`openai`** — `POST {baseUrl}/audio/transcriptions`, multipart. OpenAI
 *   itself (`whisper-1`, `gpt-4o-transcribe`), Groq (`whisper-large-v3`), and
 *   every self-hosted Whisper server (speaches, faster-whisper-server,
 *   LocalAI) answer it, so a machine that must keep students' voices on
 *   campus points `baseUrl` at `http://localhost:8000/v1` and nothing leaves.
 * * **`elevenlabs`** — Scribe, `POST https://api.elevenlabs.io/v1/speech-to-text`.
 *   On FLEURS Kazakh it reads at about 8% WER against Whisper large-v3's 39%,
 *   which for a course not taught in English is the difference that matters.
 *   The default since 2026-10-06 (`scribe_v2`).
 *
 * Stock Whisper is weak on Kazakh, but Kazakh fine-tunes of it on Hugging Face
 * close most of that gap — `abilmansplus/whisper-turbo-ksc2` (9.2% WER on
 * KSC2), `olzhasAl/whisper-large-v3-tulpar`, `shyngys879/kazakh-whisper-large-v3-turbo`,
 * and `KRASR/kazakh-russian-asr-whisper-small-full-ft` for students who mix
 * the two languages. Served by a local Whisper server they are the `openai`
 * protocol like any other, with nothing leaving the machine (BACKLOG TRN-2).
 *
 * ## What is never trusted
 *
 * A stretch the provider was unsure of is marked `confidence: low`, from the
 * provider's own log-probabilities where it gives them, and is never scored
 * silently (AUD-3). A provider that returns no timestamps — `gpt-4o-transcribe`
 * gives text only — yields one segment spanning the answer, and says so.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  type Connection,
  explainMissing,
  findConnection,
  loadRegistry,
  tokenFor,
  tokenPresent,
  usable,
} from "./connections/index.ts";

export interface Segment {
  start: number;
  end: number;
  text: string;
  confidence?: "low";
  /** The provider's own label for a voice (`speaker_0`), where it separates voices. */
  speaker_id?: string;
  /** Whose words these are, as `labelSpeakers` decided (AGT-6). Only `student` is evidence. */
  speaker?: "student" | "professor" | "unknown";
}

/**
 * How the voices in a take were told apart (AGT-6).
 *
 * * `diarized` — the provider separated the voices, and the student is the
 *   one who spoke most in their own answer;
 * * `marked` — no separation from the provider, but the professor held the
 *   speak key while talking, so those stretches are theirs;
 * * `assumed` — neither: every word is taken for the student's, and the take
 *   says so rather than claiming a separation it did not make.
 *
 * `unclear` is a take whose voices could not be told apart with any
 * confidence. It is kept and shown, and never cited as the student's.
 */
export interface Speakers {
  method: "diarized" | "marked" | "assumed";
  unclear: boolean;
  note?: string;
}

export interface Transcript {
  text: string;
  language: string | null;
  seconds: number | null;
  segments: Segment[];
  /** False when the provider gave no timestamps and the one segment is the whole answer. */
  timed: boolean;
  speakers?: Speakers;
  provider: string;
  model: string;
  at: string;
  cost_usd: number | null;
}

export interface TranscriberConfig {
  provider: "openai" | "elevenlabs";
  model: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  pricePerMinute?: number | null;
}

export interface Audio {
  path: string;
  mime: string;
  /** Known to the recorder; used for the cost when the provider does not say. */
  seconds?: number | null;
}

export interface Hints {
  /** ISO 639-1, `kk`, `ru`, `en`. Left out, the provider detects it. */
  language?: string | null;
  /** Words the answer is likely to use — the question, names from the code. */
  prompt?: string | null;
}

export type Transcriber = (audio: Audio, hints?: Hints) => Promise<Transcript>;

export const DEFAULT_BASE: Record<TranscriberConfig["provider"], string> = {
  openai: "https://api.openai.com/v1",
  elevenlabs: "https://api.elevenlabs.io/v1",
};

const LOW_LOGPROB = -1;

const cost = (config: TranscriberConfig, seconds: number | null): number | null =>
  typeof config.pricePerMinute === "number" && typeof seconds === "number"
    ? Math.round(config.pricePerMinute * (seconds / 60) * 1e6) / 1e6
    : null;

const form = (audio: Audio, field: string, fields: Record<string, string | null | undefined>): FormData => {
  const body = new FormData();
  body.append(field, new Blob([readFileSync(audio.path)], { type: audio.mime }), basename(audio.path));
  for (const [key, value] of Object.entries(fields)) if (value) body.append(key, value);
  return body;
};

const failure = async (provider: string, response: Response): Promise<Error> =>
  new Error(`${provider} answered ${response.status}: ${(await response.text()).slice(0, 300)}`);

/** Retry a 429 or a 5xx three times; anything else is the answer. */
const post = async (call: typeof fetch, url: string, init: () => RequestInit): Promise<Response> => {
  for (let attempt = 1; ; attempt += 1) {
    const response = await call(url, init());
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await new Promise((done) => setTimeout(done, 1500 * attempt));
      continue;
    }
    return response;
  }
};

// --------------------------------------------------------------------------
// OpenAI's protocol: OpenAI, Groq, self-hosted Whisper
// --------------------------------------------------------------------------

/** One segment of `verbose_json`, unsure when Whisper says so in either of its two ways. */
const openaiSegment = (segment: any): Segment => {
  const unsure =
    (typeof segment.avg_logprob === "number" && segment.avg_logprob < LOW_LOGPROB) ||
    (typeof segment.no_speech_prob === "number" && segment.no_speech_prob > 0.5);
  return {
    start: Number(segment.start ?? 0),
    end: Number(segment.end ?? 0),
    text: String(segment.text ?? "").trim(),
    ...(unsure ? { confidence: "low" as const } : {}),
  };
};

export const openaiTranscriber = (config: TranscriberConfig, call: typeof fetch = fetch): Transcriber =>
  async (audio, hints = {}) => {
    const url = `${(config.baseUrl || DEFAULT_BASE.openai).replace(/\/+$/, "")}/audio/transcriptions`;
    const headers = config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : undefined;
    const request = (format: string) => () => ({
      method: "POST",
      headers,
      body: form(audio, "file", {
        model: config.model,
        response_format: format,
        language: hints.language,
        prompt: hints.prompt,
      }),
    });
    let response = await post(call, url, request("verbose_json"));
    // `gpt-4o-transcribe` and its kin accept `json` and `text` only.
    let verbose = true;
    if (response.status === 400) {
      const said = await response.clone().text();
      if (/response_format|verbose_json/i.test(said)) {
        verbose = false;
        response = await post(call, url, request("json"));
      }
    }
    if (!response.ok) throw await failure("the transcription endpoint", response);
    const json: any = await response.json();
    const text = String(json.text ?? "").trim();
    const seconds = typeof json.duration === "number" ? json.duration : (audio.seconds ?? null);
    const segments: Segment[] =
      verbose && Array.isArray(json.segments) && json.segments.length
        ? json.segments.map(openaiSegment)
        : [{ start: 0, end: seconds ?? 0, text }];
    return {
      text,
      language: json.language ?? hints.language ?? null,
      seconds,
      segments,
      timed: verbose && Array.isArray(json.segments) && json.segments.length > 0,
      provider: "openai",
      model: config.model,
      at: new Date().toISOString(),
      cost_usd: cost(config, seconds),
    };
  };

// --------------------------------------------------------------------------
// ElevenLabs Scribe
// --------------------------------------------------------------------------

/**
 * Scribe's words, joined into segments a person can listen to: a sentence, or
 * twelve seconds, whichever ends first — and always a new segment when the
 * voice changes, so no segment mixes the professor's words with the student's.
 * A segment is unsure when its words' mean log-probability is.
 */
export const wordsToSegments = (words: any[]): Segment[] => {
  const segments: Segment[] = [];
  let current: { start: number; end: number; parts: string[]; logprobs: number[]; speaker: string | null } | null = null;
  const close = (): void => {
    if (!current) return;
    const text = current.parts.join("").replace(/\s+/g, " ").trim();
    if (text) {
      const mean = current.logprobs.length
        ? current.logprobs.reduce((a, b) => a + b, 0) / current.logprobs.length
        : 0;
      segments.push({
        start: current.start,
        end: current.end,
        text,
        ...(mean < LOW_LOGPROB ? { confidence: "low" as const } : {}),
        ...(current.speaker ? { speaker_id: current.speaker } : {}),
      });
    }
    current = null;
  };
  for (const word of words) {
    if (word?.type === "audio_event") continue;
    const text = String(word?.text ?? "");
    if (word?.type === "spacing") {
      if (current) current.parts.push(text);
      continue;
    }
    const start = Number(word?.start ?? 0);
    const end = Number(word?.end ?? start);
    const speaker = typeof word?.speaker_id === "string" ? word.speaker_id : null;
    if (current && speaker !== current.speaker) close();
    if (!current) current = { start, end, parts: [], logprobs: [], speaker };
    current.parts.push(text);
    current.end = end;
    if (typeof word?.logprob === "number") current.logprobs.push(word.logprob);
    if (/[.!?…]$/.test(text.trim()) || current.end - current.start >= 12) close();
  }
  close();
  return segments;
};

export const elevenlabsTranscriber = (config: TranscriberConfig, call: typeof fetch = fetch): Transcriber =>
  async (audio, hints = {}) => {
    const url = `${(config.baseUrl || DEFAULT_BASE.elevenlabs).replace(/\/+$/, "")}/speech-to-text`;
    const response = await post(call, url, () => ({
      method: "POST",
      headers: config.apiKey ? { "xi-api-key": config.apiKey } : undefined,
      body: form(audio, "file", {
        model_id: config.model,
        language_code: hints.language,
        timestamps_granularity: "word",
        tag_audio_events: "false",
        // Separate the voices: the professor will interject (AGT-6).
        diarize: "true",
      }),
    }));
    if (!response.ok) throw await failure("ElevenLabs", response);
    const json: any = await response.json();
    const words = Array.isArray(json.words) ? json.words : [];
    const last = [...words].reverse().find((word: any) => typeof word?.end === "number");
    const seconds = audio.seconds ?? (last ? Number(last.end) : null);
    const text = String(json.text ?? "").trim();
    const segments = words.length ? wordsToSegments(words) : [{ start: 0, end: seconds ?? 0, text }];
    return {
      text,
      language: json.language_code ?? hints.language ?? null,
      seconds,
      segments,
      timed: words.length > 0,
      provider: "elevenlabs",
      model: config.model,
      at: new Date().toISOString(),
      cost_usd: cost(config, seconds),
    };
  };

export const transcriber = (config: TranscriberConfig, call: typeof fetch = fetch): Transcriber =>
  config.provider === "elevenlabs" ? elevenlabsTranscriber(config, call) : openaiTranscriber(config, call);

/**
 * The configured `transcription` connection as a transcriber config.
 *
 * The named one, else the registry's default for the type, else the only one.
 * Throws with the registry's own explanation when there is none, and when the
 * one there is cannot be used. A missing key is fine for a loopback endpoint —
 * a Whisper server on this machine asks for none.
 */
export const configFromRegistry = (name?: string | null, registryFile?: string | null): {
  config: TranscriberConfig;
  connection: Connection;
} => {
  const registry = loadRegistry(registryFile);
  const connection = findConnection(registry, { name, type: "transcription" });
  if (!connection) throw new Error(explainMissing(registry, "transcription"));
  if (!usable(connection)) {
    throw new Error(
      `${connection.name} cannot be used: ` +
        connection.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join("; "),
    );
  }
  const local = !!connection.baseUrl && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connection.baseUrl);
  return {
    connection,
    config: {
      provider: connection.provider as TranscriberConfig["provider"],
      model: connection.model!,
      baseUrl: connection.baseUrl,
      apiKey: local && !tokenPresent(connection) ? null : tokenFor(connection),
      pricePerMinute: connection.pricePerMinute,
    },
  };
};

/**
 * The transcription connection as it is configured, whether or not it can be
 * used right now. What the student is told about where their voice goes
 * (AGT-7) must name the provider that is set up, even while its key is
 * missing — a missing key is the professor's problem to fix, not a reason to
 * tell the student the recording stays on the machine. Null when there is no
 * transcription connection at all.
 */
export const describeTranscription = (registryFile?: string | null): {
  name: string;
  provider: string;
  model: string;
  local: boolean;
  pricePerMinute: number | null;
  /** Why it cannot transcribe yet, if it cannot. */
  problem: string | null;
} | null => {
  const registry = loadRegistry(registryFile);
  const connection = findConnection(registry, { type: "transcription" });
  if (!connection) return null;
  const local = !!connection.baseUrl && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connection.baseUrl);
  let problem: string | null = null;
  try {
    configFromRegistry(connection.name, registryFile);
  } catch (error) {
    problem = (error as Error).message;
  }
  return {
    name: connection.name,
    provider: connection.provider ?? "?",
    model: connection.model ?? "?",
    local,
    pricePerMinute: connection.pricePerMinute,
    problem,
  };
};

/** What a batch of this many seconds would cost on this connection, or null when it has no price. */
export const estimate = (pricePerMinute: number | null | undefined, seconds: number): number | null =>
  typeof pricePerMinute === "number" ? Math.round(pricePerMinute * (seconds / 60) * 100) / 100 : null;

// --------------------------------------------------------------------------
// Whose words (AGT-6)
// --------------------------------------------------------------------------

/** Seconds from the start of a take, `[from, to]`. */
export type Range = [number, number];

/**
 * When the second voice in a take spoke at least this share of the time,
 * which of the two is the student is not clear enough to cite either.
 */
export const UNCLEAR_SHARE = 0.4;

/**
 * Decide whose each segment is: the student's, the professor's, or unknown.
 *
 * `professor` is the stretches the professor marked by holding the speak key.
 * A segment at least half inside one is theirs, whatever else is known.
 *
 * Where the provider separated voices, the student is the voice that spoke
 * most in their own answer, not counting any voice heard while the
 * professor was marked as speaking. With two voices the other one is the
 * professor, who interjected without pressing the key. With three or more,
 * the rest are unknown. When the second voice spoke nearly as much as the
 * first, the take is marked `unclear`: it is kept, and never cited.
 *
 * Where the provider did not separate voices, only the marked stretches are
 * the professor's and the rest is assumed to be the student's, and the take
 * says it was assumed. An untimed transcript cannot have marked stretches cut
 * out of it, so marking one makes the take unclear.
 */
export const labelSpeakers = (transcript: Transcript, professor: Range[] = []): Transcript => {
  const length = (segment: Segment): number => Math.max(0, segment.end - segment.start);
  const marked = transcript.segments.map((segment) => {
    if (!professor.length || !transcript.timed) return false;
    const overlap = professor.reduce(
      (sum, [from, to]) => sum + Math.max(0, Math.min(to, segment.end) - Math.max(from, segment.start)),
      0,
    );
    return overlap / Math.max(length(segment), 0.001) >= 0.5;
  });

  if (!transcript.timed) {
    const unclear = professor.length > 0;
    return {
      ...transcript,
      segments: transcript.segments.map((segment) => ({ ...segment, speaker: unclear ? ("unknown" as const) : ("student" as const) })),
      speakers: {
        method: "assumed",
        unclear,
        ...(unclear
          ? { note: "this model gives no timestamps, so the professor's marked words cannot be cut out of the answer" }
          : { note: "this model does not separate voices; every word is taken for the student's" }),
      },
    };
  }

  const ids = transcript.segments.map((segment) => segment.speaker_id).filter((id): id is string => !!id);
  if (!ids.length) {
    return {
      ...transcript,
      segments: transcript.segments.map((segment, at) => ({
        ...segment,
        speaker: marked[at] ? ("professor" as const) : ("student" as const),
      })),
      speakers: professor.length
        ? { method: "marked", unclear: false }
        : { method: "assumed", unclear: false, note: "no voices were separated and none marked; every word is taken for the student's" },
    };
  }

  const professorIds = new Set(transcript.segments.filter((segment, at) => marked[at] && segment.speaker_id).map((s) => s.speaker_id!));
  const time = new Map<string, number>();
  transcript.segments.forEach((segment, at) => {
    if (!segment.speaker_id || marked[at] || professorIds.has(segment.speaker_id)) return;
    time.set(segment.speaker_id, (time.get(segment.speaker_id) ?? 0) + length(segment));
  });
  const ranked = [...time].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, seconds]) => sum + seconds, 0);
  const student = ranked[0]?.[0] ?? null;
  const second = ranked[1]?.[1] ?? 0;
  const others = ranked.length + professorIds.size <= 2 ? ("professor" as const) : ("unknown" as const);

  let note: string | undefined;
  if (!student) note = "only the professor's voice was heard";
  else if (total > 0 && second / total >= UNCLEAR_SHARE) {
    note = `two voices spoke about as much (${Math.round((ranked[0]![1] / total) * 100)}% and ${Math.round((second / total) * 100)}%), so which is the student's is not clear`;
  }
  return {
    ...transcript,
    segments: transcript.segments.map((segment, at) => ({
      ...segment,
      speaker:
        marked[at] || (segment.speaker_id && professorIds.has(segment.speaker_id))
          ? ("professor" as const)
          : !segment.speaker_id
            ? ("unknown" as const)
            : segment.speaker_id === student
              ? ("student" as const)
              : others,
    })),
    speakers: { method: "diarized", unclear: !!note, ...(note ? { note } : {}) },
  };
};

/**
 * The student's words in a take, for anything that treats them as evidence:
 * the next-question prompt now, the grade later. Null for a take whose voices
 * are unclear. A transcript from before voices were labelled is all theirs.
 */
export const studentWords = (transcript: Transcript | null): Segment[] | null => {
  if (!transcript) return null;
  if (transcript.speakers?.unclear) return null;
  return transcript.segments.filter((segment) => !segment.speaker || segment.speaker === "student");
};
