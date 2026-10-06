/**
 * Recorded defences uploaded in a batch (BACKLOG E26, DEF-6).
 *
 * Not every defence happens at the desk. A professor who recorded the
 * defences on a phone, or in a room the harness was not in, uploads the
 * files afterwards, and they go the way scanned papers go:
 *
 *     ~/.ainar/submissions/<RUN>/_recordings/
 *       rec-<sha10>.<ext>   the files, renamed by their content — a name in a
 *                           filename must not travel into a chat message
 *       uploads.json        what each was called, privately
 *       plan.yaml           which student each one is, and how long it runs
 *       done/               a recording already filed
 *
 * Three steps, each the professor's to take:
 *
 * 1. **plan** — read each file's length here, without sending it anywhere;
 *    match it to a student from what the file was called (a pseudonym, a
 *    student number, or a name, matched the way a scanned cover is, by
 *    `identify`); and price the whole batch on every transcription connection
 *    configured. Nothing leaves the machine.
 * 2. **apply** — file each matched recording as a take of that student's
 *    defence, under the question `Q0`, "the recorded defence". The professor
 *    confirms the students agreed to be recorded, and that is written as each
 *    student's consent, with a statement saying the recording was made
 *    outside the desk (AGT-7).
 * 3. **transcribe** — without `--confirm` it says what it would cost and
 *    stops; with it, the recordings are sent. Then the grade is proposed for
 *    each student as DEF-5 proposes it.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { parse, stringify } from "yaml";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadRegistry } from "./connections/index.ts";
import { type RosterStore } from "./roster.ts";
import { identify } from "./scans.ts";
import { estimate } from "./transcribe.ts";

// --------------------------------------------------------------------------
// Where, and what
// --------------------------------------------------------------------------

export const recordingsInbox = (submissions: string, runId: string): string => join(submissions, runId, "_recordings");

/** The audio a recording is accepted in, with the type the transcription takes it as. */
export const RECORDING_TYPES: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
};

/** The question a whole uploaded recording answers: there were no takes per question. */
export const RECORDED_QUESTION = "Q0";

// --------------------------------------------------------------------------
// How long
// --------------------------------------------------------------------------

/** A WAV file's length, from its header: data bytes over bytes per second. */
export const wavSeconds = (bytes: Buffer): number | null => {
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") return null;
  let byteRate = 0;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = bytes.readUInt32LE(at + 16);
    if (id === "data") return byteRate ? size / byteRate : null;
    at += 8 + size + (size % 2);
  }
  return null;
};

/** An MP4 or M4A file's length, from the movie header (`moov/mvhd`): duration over timescale. */
export const mp4Seconds = (bytes: Buffer): number | null => {
  const find = (from: number, to: number, type: string): [number, number] | null => {
    for (let at = from; at + 8 <= to; ) {
      let size = bytes.readUInt32BE(at);
      const kind = bytes.toString("ascii", at + 4, at + 8);
      let header = 8;
      if (size === 1) {
        size = Number(bytes.readBigUInt64BE(at + 8));
        header = 16;
      } else if (size === 0) size = to - at;
      if (size < header) return null;
      if (kind === type) return [at + header, at + size];
      at += size;
    }
    return null;
  };
  const moov = find(0, bytes.length, "moov");
  const mvhd = moov && find(moov[0], moov[1], "mvhd");
  if (!mvhd) return null;
  const version = bytes.readUInt8(mvhd[0]);
  const timescale = version === 1 ? bytes.readUInt32BE(mvhd[0] + 20) : bytes.readUInt32BE(mvhd[0] + 12);
  const duration = version === 1 ? Number(bytes.readBigUInt64BE(mvhd[0] + 24)) : bytes.readUInt32BE(mvhd[0] + 16);
  return timescale ? duration / timescale : null;
};

/**
 * A recording's length in seconds, read on this machine: `ffprobe` when it is
 * installed, else the file's own header for WAV and M4A. Null when neither can
 * say — the cost of that file is then unknown, and the plan says so rather
 * than guess.
 */
export const audioSeconds = (path: string, probe: typeof spawnSync = spawnSync): number | null => {
  try {
    const result = probe("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], {
      encoding: "utf-8",
      timeout: 20000,
    });
    const seconds = Number(String(result.stdout ?? "").trim());
    if (result.status === 0 && Number.isFinite(seconds) && seconds > 0) return seconds;
  } catch {
    // No ffprobe: fall through to the headers.
  }
  try {
    const bytes = readFileSync(path);
    const extension = extname(path).toLowerCase();
    if (extension === ".wav") return wavSeconds(bytes);
    if (extension === ".m4a" || extension === ".mp4") return mp4Seconds(bytes);
  } catch {
    return null;
  }
  return null;
};

// --------------------------------------------------------------------------
// Whose
// --------------------------------------------------------------------------

/**
 * Who a recording is, as far as its original filename says: a pseudonym, a
 * student number (five or more digits), or the words left once the usual
 * filler of a recording's name — dates, times, "defence", "recording",
 * "hw1" — is set aside.
 */
export const nameFromFile = (original: string): { student?: string; number?: string; name?: string } => {
  const stem = original.replace(/\.[A-Za-z0-9]+$/, "");
  const pseudonym = /STUDENT-[A-Z2-7]{4,}/.exec(stem.toUpperCase());
  if (pseudonym) return { student: pseudonym[0] };
  const number = /(?:^|[^0-9])(\d{5,12})(?:[^0-9]|$)/.exec(stem);
  if (number && !/^(19|20)\d{6}$/.test(number[1]!)) return { number: number[1]! };
  const FILLER = /^(defen[cs]e|zashchita|защита|qorgau|қорғау|recording|record|rec|audio|voice|voice ?memo|new|hw\d*|homework\d*|lab\d*|oral|viva|final|v\d+|copy|\d+)$/i;
  const words = stem
    .replace(/\d{4}[-_.]\d{2}[-_.]\d{2}|\d{2}[-_.]\d{2}[-_.]\d{4}|\d{1,2}[-_.:]\d{2}([-_.:]\d{2})?/g, " ")
    .split(/[\s_.\-()[\],]+/u)
    .filter((word) => word && !FILLER.test(word) && /\p{L}/u.test(word));
  return words.length ? { name: words.join(" ") } : {};
};

export interface RecordingEntry {
  file: string;
  original: string;
  seconds: number | null;
  student?: string;
  /** How a name was matched, when not word for word. */
  match?: string;
  problem?: string;
  /** The professor's: leave this recording out, and why. */
  skip?: string;
  /** Set by apply: where it went. */
  filed?: string;
}

export interface RecordingPlan {
  run: string;
  assessment: string;
  entries: RecordingEntry[];
}

const PLAN_HEADER =
  "# PRIVATE — uploaded recordings of oral defences, and whose each is. Names may\n" +
  "# be in `original`, so this lives here, outside the repository.\n" +
  "#\n" +
  "# Put `student: STUDENT-…` on an entry the plan could not place, or\n" +
  "# `skip: <why>` on one that is not a defence. `seconds` was read on this\n" +
  "# machine; nothing has been sent anywhere. `ainar defence batch apply` files\n" +
  "# each placed recording as that student's defence.\n\n";

export const planFile = (inbox: string): string => join(inbox, "plan.yaml");

export const readRecordingPlan = (inbox: string): RecordingPlan | null => {
  const path = planFile(inbox);
  if (!existsSync(path)) return null;
  const value = parse(readFileSync(path, "utf-8"));
  return value && Array.isArray(value.entries) ? (value as RecordingPlan) : null;
};

export const writeRecordingPlan = (inbox: string, plan: RecordingPlan): void => {
  mkdirSync(inbox, { recursive: true });
  writeFileSync(planFile(inbox), PLAN_HEADER + stringify(plan, { lineWidth: 0 }), "utf-8");
};

/**
 * The plan: every recording in the inbox, its length, and whose it is. What
 * the professor already settled in an earlier plan — a `student:` they wrote,
 * a `skip:` — is kept; everything else is worked out again.
 */
export const planRecordings = (context: {
  inbox: string;
  runId: string;
  assessmentId: string;
  store: RosterStore;
  salt: Uint8Array | null;
  enrolled: Set<string>;
  seconds?: (path: string) => number | null;
}): RecordingPlan => {
  const previous = readRecordingPlan(context.inbox);
  const kept = new Map((previous?.entries ?? []).map((entry) => [entry.file, entry]));
  let originals: Record<string, string> = {};
  try {
    const ledger = JSON.parse(readFileSync(join(context.inbox, "uploads.json"), "utf-8"));
    if (Array.isArray(ledger)) originals = Object.fromEntries(ledger.map((entry: any) => [entry.file, entry.original]));
  } catch {
    // Copied in by hand: the file's own name is all there is.
  }
  const files = existsSync(context.inbox)
    ? readdirSync(context.inbox).filter((file) => RECORDING_TYPES[extname(file).toLowerCase()]).sort()
    : [];
  const measure = context.seconds ?? audioSeconds;
  const entries = files.map((file): RecordingEntry => {
    const before = kept.get(file);
    const original = originals[file] ?? file;
    const seconds = before?.seconds ?? measure(join(context.inbox, file));
    if (before?.skip) return { file, original, seconds, skip: before.skip };
    const said = before?.student ? { student: before.student } : nameFromFile(original);
    const identity = identify({ pages: "1", ...said }, { store: context.store, salt: context.salt, enrolled: context.enrolled, partial: true });
    return "student" in identity
      ? { file, original, seconds, student: identity.student, ...(identity.match ? { match: identity.match } : {}) }
      : { file, original, seconds, problem: identity.problem };
  });
  // Two recordings of one student: both are held, as two papers are.
  const count = new Map<string, number>();
  for (const entry of entries) if (entry.student) count.set(entry.student, (count.get(entry.student) ?? 0) + 1);
  for (const entry of entries) {
    if (entry.student && count.get(entry.student)! > 1) {
      entry.problem = `${entry.student} has more than one recording here — skip: the one that is not the defence`;
      delete entry.student;
    }
  }
  return { run: context.runId, assessment: context.assessmentId, entries };
};

// --------------------------------------------------------------------------
// What it would cost
// --------------------------------------------------------------------------

export interface CostLine {
  connection: string;
  provider: string;
  model: string;
  local: boolean;
  pricePerMinute: number | null;
  cost: number | null;
  default: boolean;
}

/**
 * What transcribing these recordings would cost on each transcription
 * connection configured — the professor chooses with the bill in front of
 * them. A connection with no price says so; a local server costs nothing.
 */
export const costTable = (seconds: number, registryFile?: string | null): CostLine[] => {
  const registry = loadRegistry(registryFile);
  return registry.connections
    .filter((connection) => connection.type === "transcription")
    .map((connection) => {
      const local = !!connection.baseUrl && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connection.baseUrl);
      return {
        connection: connection.name,
        provider: connection.provider ?? "?",
        model: connection.model ?? "?",
        local,
        pricePerMinute: connection.pricePerMinute,
        cost: local ? 0 : estimate(connection.pricePerMinute, seconds),
        default: registry.defaults.transcription === connection.name,
      };
    });
};

/**
 * What would be sent if the batch were filed now: the placed recordings not
 * yet filed. The unplaced ones are counted apart, with their minutes, so the
 * professor sees what placing them would add to the bill.
 */
export const planLength = (plan: RecordingPlan): {
  seconds: number;
  unknown: number;
  files: number;
  unplaced: number;
  unplacedSeconds: number;
} => {
  const waiting = plan.entries.filter((entry) => !entry.skip && !entry.filed);
  const placed = waiting.filter((entry) => entry.student);
  const unplaced = waiting.filter((entry) => !entry.student);
  return {
    seconds: placed.reduce((sum, entry) => sum + (entry.seconds ?? 0), 0),
    unknown: placed.filter((entry) => entry.seconds === null).length,
    files: placed.length,
    unplaced: unplaced.length,
    unplacedSeconds: unplaced.reduce((sum, entry) => sum + (entry.seconds ?? 0), 0),
  };
};

/** What the student is told was recorded, for a defence the desk did not record. */
export const batchStatement = (statement: string): string =>
  `${statement} This defence was recorded outside the defence desk and uploaded afterwards; the professor confirms the student agreed to it.`;
