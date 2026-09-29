/**
 * Writing records into the course, where they stay.
 *
 * Everything here used to live in `approve.ts`, because approval was the only
 * thing that wrote records. Since 2026-09-29 there is no approval step: an
 * agent, a generator or a derivation writes into the file a collection belongs
 * in, and a record an agent proposed carries `approval: draft` until the
 * professor changes it (see `approval.ts`). What remains is the mechanics of
 * writing well — where each collection lands, the emitter that keeps floats
 * floats, and an upsert, so producing the same material twice replaces its
 * record instead of adding a second one.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { AGENT_WRITABLE, ID_FIELDS } from "./approval.ts";
import { COLLECTIONS } from "./loader.ts";
import { candidateFiles, editRecords } from "./record-edit.ts";
import { dump } from "./yaml-out.ts";

/**
 * Where each collection lands, relative to the course directory.
 *
 * Runtime records go to `records/`. Documents and resources go beside their
 * authored counterparts but in a separate `generated.yaml` — writing YAML back
 * into a hand-authored file would strip its comments and reformat it.
 *
 * Concepts and modules are not here: the professor authors them into
 * `courses/` directly, and nothing writes them on anybody's behalf.
 */
export const RECORD_FILES: Record<string, string> = {
  activities: "activities/generated.yaml",
  documents: "documents/generated.yaml",
  resources: "resources/generated.yaml",
  assessments: "assessments/generated.yaml",
  items: "items/generated.yaml",
  item_models: "item-models/generated.yaml",
  submissions: "records/submissions.yaml",
  item_responses: "records/item-responses.yaml",
  evaluations: "records/evaluations.yaml",
  evidence: "records/evidence.yaml",
  concept_states: "records/concept-states.yaml",
  capability_states: "records/capability-states.yaml",
  signals: "records/signals.yaml",
  interventions: "records/interventions.yaml",
  events: "records/events.yaml",
  action_items: "records/action-items.yaml",
};

type Record_ = Record<string, unknown>;

// --------------------------------------------------------------------------
// Timestamps
// --------------------------------------------------------------------------

/**
 * A run's UTC offset in minutes — `run_timezone(...)`, resolved once.
 *
 * Exported because more than one place needs the same answer: the lms ledger
 * stamps a push with it, and `lms.pull` converts Canvas's UTC timestamps into
 * it. Two mechanisms for one question is how two records of the same moment end
 * up an hour apart.
 */
export const zoneOffsetMinutes = (timezone: string | undefined, now: Date = new Date()): number => {
  const zone = timezone || "Asia/Almaty";
  try {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    });
    const part = format.formatToParts(now).find((entry) => entry.type === "timeZoneName")?.value;
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
    return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 300;
  } catch {
    return 300; // +05:00, the same fallback `run_timezone` uses
  }
};

/**
 * `datetime.now(run_timezone(...)).replace(microsecond=0).isoformat()`.
 *
 * The offset comes from the run's own `timezone`, falling back to Asia/Almaty —
 * a stamp is the record of when something happened, so a silent UTC
 * substitution would misreport it by five hours.
 */
export const decidedAt = (timezone: string | undefined, now: Date = new Date()): string => {
  const offsetMinutes = zoneOffsetMinutes(timezone, now);
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
  const sign = offsetMinutes < 0 ? "-" : "+";
  const magnitude = Math.abs(offsetMinutes);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(magnitude / 60))}:${pad(magnitude % 60)}`
  );
};

// --------------------------------------------------------------------------
// Materials
// --------------------------------------------------------------------------

/** Repository-relative keys have no scheme; object-storage keys use `://`. */
export const isRepoKey = (storageKey: string): boolean => !storageKey.includes("://");

/**
 * Size and checksum for a document whose file is in the repository.
 *
 * Computed rather than asked of the agent, because an agent hand-writing a
 * sha256 is an invitation to error. Returns false when the file is not there,
 * so the caller can say so instead of recording a checksum of nothing.
 */
export const stampDocument = (document: Record_, root: string): boolean => {
  const storageKey = document.storage_key as string | undefined;
  if (!storageKey || !isRepoKey(storageKey)) return true;
  const path = join(root, storageKey);
  if (!existsSync(path)) return false;
  const payload = readFileSync(path);
  document.size_bytes = payload.length;
  document.checksum = "sha256:" + createHash("sha256").update(payload).digest("hex");
  if (document.original_filename === null || document.original_filename === undefined) {
    document.original_filename = basename(path);
  }
  return true;
};

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

/**
 * Drop empty `extensions` maps and sink the rest to the end of a record.
 *
 * Purely for the humans who read `records/` in a diff — an `extensions: {}` on
 * every nested object buries the fields that matter.
 */
export const tidy = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(tidy);
  if (node === null || typeof node !== "object") return node;
  const cleaned: Record_ = {};
  for (const [key, value] of Object.entries(node as Record_)) {
    const isEmptyExtensions =
      key === "extensions" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as object).length === 0;
    if (!isEmptyExtensions) cleaned[key] = tidy(value);
  }
  if ("extensions" in cleaned) {
    const extensions = cleaned.extensions;
    delete cleaned.extensions;
    cleaned.extensions = extensions;
  }
  return cleaned;
};

/**
 * Which numbers in this collection are floats.
 *
 * Pydantic decided by the declared field type, so a `score: 8` was written back
 * as `8.0`. The zod schemas carry the same distinction — `z.number()` against
 * `z.number().int()` — so the paths are read off the schema rather than off the
 * value.
 */
export const floatPaths = (schema: z.ZodTypeAny, prefix: string[] = [], seen = new Set<z.ZodTypeAny>()): Set<string> => {
  const found = new Set<string>();
  if (seen.has(schema)) return found;
  seen.add(schema);

  const def = (schema as { _def?: Record<string, unknown> })._def;
  if (!def) return found;

  const inner =
    (def.innerType as z.ZodTypeAny | undefined) ??
    (def.schema as z.ZodTypeAny | undefined) ??
    (def.type as z.ZodTypeAny | undefined);

  const typeName = def.typeName as string | undefined;

  if (typeName === "ZodNumber") {
    const checks = (def.checks as { kind: string }[] | undefined) ?? [];
    if (!checks.some((check) => check.kind === "int")) found.add(prefix.join("."));
    return found;
  }

  if (typeName === "ZodObject") {
    const shape = (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
    for (const [key, child] of Object.entries(shape)) {
      for (const path of floatPaths(child, [...prefix, key], seen)) found.add(path);
    }
    return found;
  }

  if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
    const options = (def.options as z.ZodTypeAny[] | Map<unknown, z.ZodTypeAny>) ?? [];
    const list = Array.isArray(options) ? options : [...options.values()];
    for (const option of list) {
      for (const path of floatPaths(option, prefix, seen)) found.add(path);
    }
    return found;
  }

  if (inner) {
    // ZodArray keeps its element in `type`, and an array adds no path segment —
    // the emitter indexes by key, not by position.
    for (const path of floatPaths(inner, prefix, seen)) found.add(path);
  }
  return found;
};

const loadExisting = (path: string, collection: string): unknown[] => {
  if (!existsSync(path)) return [];
  const document = parse(readFileSync(path, "utf-8")) ?? {};
  if (Array.isArray(document)) return [...document];
  if (typeof document === "object") {
    const value = (document as Record_)[collection];
    return Array.isArray(value) ? [...value] : [];
  }
  return [];
};

export const HEADER =
  "# Written by ainar.\n" +
  "#\n" +
  "# A record marked `approval: draft` (an evaluation: `status: suggested`) is a\n" +
  "# proposal nobody has accepted yet. Nothing student-facing reads it. To accept\n" +
  "# one, change the word — for an evaluation, add the professor_decision with\n" +
  "# decided_by and decided_at beside the ai_suggestion, never over it.\n\n";

/**
 * Write records into one collection's file, replacing any with the same id.
 *
 * Upsert rather than append: generating a material again, or reprinting a
 * paper, describes the same thing again, and a second record of it would
 * collide. A replaced record keeps its place in the file, so the diff is the
 * change and nothing else.
 *
 * `keepApproval` is for a regeneration: re-rendering a deck the professor
 * already accepted is the same material built again, not a new proposal, so the
 * replaced record keeps whatever `approval` it had — including none, which is
 * approved. A new record is written as given.
 */
export const upsertRecords = (
  path: string,
  collection: string,
  items: Record_[],
  options: { keepApproval?: boolean } = {},
): string => {
  mkdirSync(dirname(path), { recursive: true });
  const payload = loadExisting(path, collection);
  const field = ID_FIELDS[collection];
  for (const item of items) {
    const identifier = field ? item[field] : undefined;
    const at =
      identifier === undefined
        ? -1
        : payload.findIndex((entry) => (entry as Record_ | null)?.[field!] === identifier);
    let record = item;
    if (at >= 0 && options.keepApproval) {
      const previous = (payload[at] as Record_ | null)?.approval;
      const { approval: _dropped, ...rest } = item;
      record = previous === undefined ? rest : { ...rest, approval: previous };
    }
    const cleaned = tidy(record);
    if (at >= 0) payload[at] = cleaned;
    else payload.push(cleaned);
  }

  const schema = (AGENT_WRITABLE as Record<string, z.ZodTypeAny>)[collection];
  const floats = schema ? floatPaths(schema, [collection]) : new Set<string>();
  const body = dump({ [collection]: payload }, (path_) => floats.has(path_.join(".")));

  writeFileSync(path, HEADER + body, { encoding: "utf-8" });
  return path;
};

/**
 * Which of these records already live in a file other than `target` — a
 * hand-authored `documents.yaml`, say — keyed by id.
 *
 * Found by reading the loader's own patterns, so this looks exactly where the
 * record could have been read from. Replacing such a record in `generated.yaml`
 * would leave two records with one id; it is edited where it is instead.
 */
const elsewhere = (
  courseDir: string,
  collection: string,
  target: string,
  items: Record_[],
): Set<string> => {
  const field = ID_FIELDS[collection];
  const patterns = COLLECTIONS[collection as keyof typeof COLLECTIONS];
  const found = new Set<string>();
  if (!field || !patterns) return found;
  const wanted = new Set(
    items.map((item) => item[field]).filter((id): id is string => typeof id === "string"),
  );
  if (!wanted.size) return found;
  const root = dirname(dirname(courseDir));
  for (const path of candidateFiles(root, basename(courseDir), patterns)) {
    if (resolve(path) === resolve(target) || !existsSync(path)) continue;
    for (const entry of loadExisting(path, collection)) {
      const id = (entry as Record_ | null)?.[field];
      if (typeof id === "string" && wanted.has(id)) found.add(id);
    }
  }
  return found;
};

/**
 * Write records into the course directory, one file per collection.
 *
 * A new record goes to its collection's file in `RECORD_FILES`. One that
 * already exists is replaced where it is, which for a hand-authored file means
 * field by field through `record-edit.ts`, so the comments around it survive.
 *
 * Returns the files written. A collection with no destination is refused
 * loudly rather than written to a path spelled "undefined".
 */
export const writeRecords = (
  courseDir: string,
  records: Iterable<[string, Record_[]]> | Record<string, Record_[]>,
  options: { keepApproval?: boolean } = {},
): string[] => {
  const entries =
    Symbol.iterator in Object(records)
      ? [...(records as Iterable<[string, Record_[]]>)]
      : Object.entries(records as Record<string, Record_[]>);
  const written: string[] = [];
  for (const [collection, items] of entries) {
    if (!items.length) continue;
    const file = RECORD_FILES[collection];
    if (file === undefined) {
      throw new Error(
        `${collection} has no destination in RECORD_FILES, so it cannot be written. ` +
          "Add one, or take the collection out of AGENT_WRITABLE.",
      );
    }
    const target = join(courseDir, file);
    const field = ID_FIELDS[collection];
    const inPlace = elsewhere(courseDir, collection, target, items);
    const here = items.filter((item) => !field || !inPlace.has(item[field] as string));
    const there = items.filter((item) => field && inPlace.has(item[field] as string));

    if (there.length) {
      const edits = new Map<string, (node: any) => void>();
      for (const item of there) {
        const cleaned = tidy(item) as Record_;
        edits.set(cleaned[field!] as string, (node) => {
          for (const [key, value] of Object.entries(cleaned)) {
            if (key === "approval" && options.keepApproval) continue;
            node.set(key, value);
          }
        });
      }
      const result = editRecords({
        root: dirname(dirname(courseDir)),
        courseId: basename(courseDir),
        patterns: COLLECTIONS[collection as keyof typeof COLLECTIONS],
        idField: field!,
        collection,
        edits,
      });
      written.push(...result.written);
    }
    if (here.length) written.push(upsertRecords(target, collection, here, options));
  }
  return written;
};
