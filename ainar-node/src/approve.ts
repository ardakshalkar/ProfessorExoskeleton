/**
 * Promoting agent proposals into the record. Ported from `ainar/approve.py`.
 *
 * Agents write drafts to `work/`. Nothing an agent writes is a record until a
 * person approves it, and approval is a distinct, traceable act:
 *
 * * an `ai_suggestion` gains a `professor_decision` beside it — never on top of
 *   it;
 * * a proposed intervention gains an approver;
 * * the `-DRAFT-` marker is stripped from the identifier, which is what makes
 *   the promotion visible in a diff.
 *
 * **This is a second implementation of the one gate**, which is a cost the port
 * has to earn rather than assume. `docs/node-migration.md` argued for keeping it
 * in Python precisely because two gates can disagree; what makes a second one
 * defensible is that the disagreement is *checked* —
 * `tests/test_approve_parity.py` runs both against the same drafts and compares
 * the resulting trees byte for byte, and `tests/test_yaml_parity.py` compares
 * the emitters scalar by scalar. Neither the promotion rules nor the file layout
 * live here twice by review; they live here twice by fixture.
 *
 * What is **not** equivalent, and must be said on every run rather than
 * discovered: the Python gate refuses to write when the merged bundle fails any
 * of `validate.py`'s 94 checks, and this one can only run the subset
 * `src/validate.ts` implements. The refusal is the gate. A narrower refusal is a
 * narrower gate, so `bin/ainar.ts approve` prints its coverage every time.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { CourseBundle } from "./bundle.ts";
import { allRubrics, criterionById } from "./bundle.ts";
import { DRAFTABLE, type DraftCollection, type Drafted, loadDrafts, mergeDrafts } from "./drafts.ts";
import { IssueList, describe } from "./issues.ts";
import { coverage, validate } from "./validate.ts";
import { dump } from "./yaml-out.ts";

export const DRAFT_MARKER = "-DRAFT-";

/**
 * Where each collection lands, relative to the course directory.
 *
 * Runtime records go to `records/`. Documents and resources go beside their
 * authored counterparts but in a separate `generated.yaml` — writing YAML back
 * into a hand-authored file would strip its comments and reformat it.
 *
 * Concepts and modules are not here, and no longer anywhere: they belong to the
 * course rather than to a semester, and since 2026-09-05 the professor authors
 * them into `courses/` directly instead of approving them. A collection missing
 * from this map cannot be approved at all — `writeRecords` says so rather than
 * writing to an undefined path.
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

/**
 * `CLAIM_FILES` was here, and is gone.
 *
 * It routed the two *claim* collections — `concepts` and `modules` — to
 * `courses/<COURSE>/concepts/approved.yaml` and `modules/approved.yaml`, at the
 * level of the course rather than the semester, because a claim about what a
 * course teaches outlives the run that proposed it. `approveClaim` stamped
 * `extensions.approval` on each, and `CLAIM_HEADER` explained the file.
 *
 * All of it went on 2026-09-05, when concepts and modules left `DRAFTABLE`.
 * They are authored straight into `courses/` now, so nothing can reach an
 * approval that would need a claim file, and an empty map guarding three
 * unreachable branches reads like a feature that still exists.
 *
 * `git log -S CLAIM_FILES` has the whole of it if the policy is ever reversed.
 * What would need restoring: this map, `approveClaim`, `CLAIM_HEADER`, the
 * `courseDir` option on `writeRecords`, and the two entries in `DRAFTABLE`.
 */

const MATERIALS_DIR = "materials";

export const ID_FIELDS: Record<string, string> = {
  concepts: "concept_id",
  modules: "module_id",
  activities: "activity_id",
  documents: "document_id",
  resources: "resource_id",
  assessments: "assessment_id",
  items: "item_id",
  item_models: "item_model_id",
  submissions: "submission_id",
  item_responses: "response_id",
  evaluations: "evaluation_id",
  evidence: "evidence_id",
  signals: "signal_id",
  interventions: "intervention_id",
  events: "event_id",
  action_items: "action_id",
};

type Record_ = Record<string, unknown>;

/** `EVAL-DRAFT-9081-0401` becomes `EVAL-9081-0401`. */
export const promoteIdentifier = (value: string): string =>
  value.includes(DRAFT_MARKER) ? value.replace(DRAFT_MARKER, "-") : value;

/** Replace every draft identifier anywhere in a record, at any depth. */
const rewrite = (node: unknown, idMap: Map<string, string>): unknown => {
  if (typeof node === "string") return idMap.get(node) ?? node;
  if (Array.isArray(node)) return node.map((item) => rewrite(item, idMap));
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record_).map(([key, value]) => [key, rewrite(value, idMap)]),
    );
  }
  return node;
};

// --------------------------------------------------------------------------
// Timestamps
// --------------------------------------------------------------------------

/**
 * A run's UTC offset in minutes — `run_timezone(...)`, resolved once.
 *
 * Exported because two other places need the same answer: the lms ledger stamps
 * a push with it, and `lms.pull` converts Canvas's UTC timestamps into it. Two
 * mechanisms for one question is how two records of the same moment end up an
 * hour apart.
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
 * The offset comes from the run's own `timezone`, falling back to Asia/Almaty
 * the way Python's does — a stamp is the record of when a person decided, so a
 * silent UTC substitution would misreport it by five hours.
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
// The approval pass
// --------------------------------------------------------------------------

export interface Approval {
  records: Map<string, Record_[]>;
  idMap: Map<string, string>;
  skipped: string[];
  notes: string[];
}

export const total = (approval: Approval): number =>
  [...approval.records.values()].reduce((sum, items) => sum + items.length, 0);

const existingIdentifiers = (bundle: CourseBundle): Set<string> => {
  const found = new Set<string>();
  for (const [collection, field] of Object.entries(ID_FIELDS)) {
    for (const record of ((bundle as unknown as Record<string, Record_[]>)[collection] ?? [])) {
      const value = record[field];
      if (typeof value === "string") found.add(value);
    }
  }
  for (const id of allRubrics(bundle).keys()) found.add(id);
  for (const id of criterionById(bundle).keys()) found.add(id);
  return found;
};

/** Add the professor's decision beside the suggestion, never over it. */
const approveEvaluation = (
  data: Record_,
  approver: string,
  stamp: string,
  approval: Approval,
  issues: IssueList,
): Record_ | null => {
  const identifier = (data.evaluation_id as string) ?? "?";
  const suggestion = data.ai_suggestion as Record_ | undefined | null;
  const decision = data.professor_decision as Record_ | undefined | null;

  if (decision === null || decision === undefined) {
    if (suggestion === null || suggestion === undefined || suggestion.score === null || suggestion.score === undefined) {
      issues.error(
        "approve.nothing_to_approve",
        "evaluation has neither a suggestion to accept nor a decision",
        identifier,
      );
      return null;
    }
    data.professor_decision = {
      score: suggestion.score,
      comment: "Accepted the suggested score without change.",
      decided_by: approver,
      decided_at: stamp,
    };
    data.status = "approved";
    return data;
  }

  if (decision.decided_by === undefined) decision.decided_by = approver;
  if (decision.decided_at === undefined) decision.decided_at = stamp;
  if (suggestion !== null && suggestion !== undefined && suggestion.score !== decision.score) {
    data.status = "overridden";
    approval.notes.push(
      `${identifier}: professor set ${decision.score} against the suggested ${suggestion.score}`,
    );
  } else {
    data.status = "approved";
  }
  return data;
};

const approveIntervention = (data: Record_, approver: string): Record_ => {
  if (data.status === undefined || data.status === null || data.status === "proposed") {
    data.status = "approved";
  }
  if (data.approved_by === undefined) data.approved_by = approver;
  return data;
};

/** Turn drafted proposals into records a person stands behind. */
export const approveDrafts = (
  bundle: CourseBundle,
  drafted: Drafted,
  options: {
    approver: string;
    decidedAt: string;
    issues: IssueList;
    only?: Set<string>;
    reject?: Set<string>;
  },
): Approval => {
  const approval: Approval = { records: new Map(), idMap: new Map(), skipped: [], notes: [] };
  const { approver, decidedAt: stamp, issues, only, reject } = options;

  const selected = new Map<string, Record_[]>();
  for (const [collection, records] of Object.entries(drafted)) {
    const field = ID_FIELDS[collection];
    const keep: Record_[] = [];
    for (const record of records) {
      const identifier = field ? (record[field] as string | undefined) : undefined;
      if (identifier && reject?.has(identifier)) {
        approval.skipped.push(identifier);
        continue;
      }
      if (identifier && only && !only.has(identifier)) {
        approval.skipped.push(identifier);
        continue;
      }
      keep.push(record);
    }
    if (keep.length) selected.set(collection, keep);
  }

  for (const [collection, records] of selected) {
    const field = ID_FIELDS[collection];
    if (!field) continue;
    for (const record of records) {
      const identifier = record[field] as string;
      approval.idMap.set(identifier, promoteIdentifier(identifier));
      // A rubric and its criteria live inside the assessment, so their draft
      // identifiers need promoting too — and items elsewhere in the same batch
      // point at those criteria.
      const rubric = record.rubric as Record_ | undefined | null;
      if (rubric) {
        const rubricId = rubric.rubric_id as string;
        approval.idMap.set(rubricId, promoteIdentifier(rubricId));
        for (const criterion of (rubric.criteria as Record_[] | undefined) ?? []) {
          const criterionId = criterion.criterion_id as string;
          approval.idMap.set(criterionId, promoteIdentifier(criterionId));
        }
      }
    }
  }

  const existing = existingIdentifiers(bundle);
  for (const [draftId, realId] of approval.idMap) {
    if (existing.has(realId)) {
      issues.error(
        "approve.collision",
        `${draftId} would become ${realId}, which already exists`,
        draftId,
      );
    }
  }

  for (const [collection, records] of selected) {
    const model = (DRAFTABLE as Record<string, z.ZodTypeAny>)[collection];
    // A collection nothing can draft has no model to validate against. Reached
    // only by a caller building `Drafted` by hand — `loadDrafts` refuses these
    // at the file — and it used to crash here with "Cannot read properties of
    // undefined (reading 'safeParse')", which says nothing about the cause.
    if (model === undefined) {
      issues.error(
        "approve.not_draftable",
        `${collection} is not a draftable collection, so it cannot be approved. ` +
          "The professor authors it into courses/ directly.",
        collection,
      );
      continue;
    }
    const promoted: Record_[] = [];
    for (const record of records) {
      let data = rewrite(structuredClone(record), approval.idMap) as Record_ | null;
      if (collection === "evaluations") {
        data = approveEvaluation(data as Record_, approver, stamp, approval, issues);
      } else if (collection === "interventions") {
        data = approveIntervention(data as Record_, approver);
      }
      if (data === null) continue;
      const parsed = model.safeParse(data);
      if (!parsed.success) {
        issues.error(
          "approve.invalid",
          parsed.error.issues.map((problem) => `${problem.path.join(".")}: ${problem.message}`).join("; "),
          (data[ID_FIELDS[collection] ?? ""] as string) ?? collection,
        );
        continue;
      }
      promoted.push(parsed.data as Record_);
    }
    if (promoted.length) approval.records.set(collection, promoted);
  }

  return approval;
};

// --------------------------------------------------------------------------
// Documents
// --------------------------------------------------------------------------

/** Repository-relative keys have no scheme; object-storage keys use `://`. */
export const isRepoKey = (storageKey: string): boolean => !storageKey.includes("://");

/**
 * Move approved material out of `work/` and stamp size and checksum.
 *
 * Size and checksum are computed here rather than asked of the agent, because an
 * agent hand-writing a sha256 is an invitation to error.
 */
/**
 * Returns the ids of the documents whose material this MOVED, or — under
 * `dryRun` — would have moved.
 *
 * The return value exists for the rehearsal. A dry run rewrites `storage_key`
 * to the destination like a real one, because the caller validates the record
 * it is about to write and that record carries the new key; but it does not
 * copy the file, so validating afterwards reports `document.missing_file` for
 * every staged material. That made `--dry-run` unusable on any approval
 * containing documents: a preview that always ends in a wall of errors teaches
 * a professor to ignore it, which is worse than having no preview.
 *
 * Naming the documents is enough for the caller to tell that artefact apart
 * from a real missing file. It is deliberately the ids and not a boolean: a
 * document whose SOURCE is missing errors above and is never added here, so it
 * still reaches the caller as the genuine failure it is.
 */
export const stageDocuments = (
  approval: Approval,
  options: { root: string; courseDir: string; issues: IssueList; dryRun?: boolean },
): string[] => {
  const { root, courseDir, issues, dryRun = false } = options;
  const staged: string[] = [];
  for (const document of approval.records.get("documents") ?? []) {
    const storageKey = document.storage_key as string;
    if (!isRepoKey(storageKey)) continue;

    const source = resolve(root, storageKey);
    if (!existsSync(source) || !statSync(source).isFile()) {
      issues.error(
        "document.missing_file",
        `storage_key points at ${storageKey}, which does not exist`,
        document.document_id as string,
      );
      continue;
    }

    let destination = source;
    const parts = relative(root, source).split(/[\\/]/);
    if (parts[0] === "work") {
      destination = join(courseDir, MATERIALS_DIR, basename(source));
      if (existsSync(destination) && !dryRun) {
        issues.error(
          "document.collision",
          `${relative(root, destination).split(/[\\/]/).join("/")} already exists`,
          document.document_id as string,
        );
        continue;
      }
      if (!dryRun) {
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, readFileSync(source));
        unlinkSync(source);
      }
      staged.push(document.document_id as string);
      approval.notes.push(
        `${document.document_id}: material ${dryRun ? "would move" : "moved"} to ` +
          relative(root, destination).split(/[\\/]/).join("/"),
      );
    }

    const readable = existsSync(destination) && statSync(destination).isFile() ? destination : source;
    const payload = readFileSync(readable);
    document.storage_key = relative(root, destination).split(/[\\/]/).join("/");
    document.size_bytes = payload.length;
    document.checksum = "sha256:" + createHash("sha256").update(payload).digest("hex");
    if (document.original_filename === null || document.original_filename === undefined) {
      document.original_filename = basename(readable);
    }
  }
  return staged;
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
 * Pydantic decides by the declared field type, so a `score: 8` in a draft is
 * written back as `8.0`. The zod schemas carry the same distinction —
 * `z.number()` against `z.number().int()` — so the paths are read off the schema
 * rather than off the value, which is the only way to agree with pydantic.
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
  "# Written by `ainar approve`.\n" +
  "#\n" +
  "# Every entry was proposed by an agent and accepted by a person. AI\n" +
  "# suggestions are preserved beside the decisions that superseded them.\n" +
  "# Machine-managed — change these through approval, not by hand.\n\n";

const append = (path: string, collection: string, items: Record_[], header: string): string => {
  mkdirSync(dirname(path), { recursive: true });
  const payload = loadExisting(path, collection);
  payload.push(...items.map((item) => tidy(item)));

  const schema = (DRAFTABLE as Record<string, z.ZodTypeAny>)[collection];
  const floats = schema ? floatPaths(schema, [collection]) : new Set<string>();
  const body = dump({ [collection]: payload }, (path_) => floats.has(path_.join(".")));

  writeFileSync(path, header + body, { encoding: "utf-8" });
  return path;
};

/**
 * Append approved records to their destination, one file per collection.
 *
 * Everything approvable lands in the course directory, which since the term
 * stopped being a directory level is the only destination there is.
 */
export const writeRecords = (courseDir: string, approval: Approval): string[] => {
  const written: string[] = [];
  for (const [collection, items] of approval.records) {
    const file = RECORD_FILES[collection];
    // Loud rather than `join(courseDir, undefined)`, which is how a collection
    // added to `DRAFTABLE` and forgotten here would write to a path spelled
    // "undefined" and look like it had worked.
    if (file === undefined) {
      throw new Error(
        `${collection} has no destination in RECORD_FILES, so it cannot be approved. ` +
          "Add one, or take the collection out of DRAFTABLE.",
      );
    }
    written.push(append(join(courseDir, file), collection, items, HEADER));
  }
  return written;
};

// --------------------------------------------------------------------------
// The gate, as one call
// --------------------------------------------------------------------------

/**
 * Load drafts, approve them, stage their materials, validate the merge, write.
 *
 * **This exists so that there is one order of operations and not two.** The
 * sequence used to live only in `bin/ainar.ts`'s `approve` case, which was fine
 * while approval had exactly one caller. It has three now — the CLI, the pane's
 * button, and `ainar publish`, which promotes the materials a publication needs
 * — and the failure mode of copying the order into each of them is not a
 * crash: it is a course record that validates and is still wrong, because one
 * copy validated before staging or wrote before validating.
 *
 * The order is the gate:
 *
 * 1. the drafts load, or nothing happens at all;
 * 2. identifiers are promoted and decisions stamped (`approveDrafts`);
 * 3. materials move out of `work/` and gain size and checksum;
 * 4. the MERGED bundle is validated — the record as it would be, not the
 *    drafts on their own;
 * 5. only then is anything written.
 *
 * `collections` is the one addition, and it is the whole of what makes
 * `ainar publish` safe: given `["documents", "resources"]`, a drafted
 * evaluation sitting in the same directory is not promoted, not validated
 * against, and named in `leftAlone` so the caller can say so. A judgement about
 * a student is promoted by `ainar approve` and by nothing else.
 */
export interface ApprovalOutcome {
  /** False when the drafts did not load, or the merge did not validate. */
  ok: boolean;
  approval: Approval;
  /** The documents whose material moved, or would have moved under `dryRun`. */
  staged: string[];
  /** What happened, in the order it happened. The CLI prints these verbatim. */
  lines: string[];
  /** Why it refused. Empty when `ok`. */
  errors: string[];
  /** Files written. Empty under `dryRun`. */
  written: string[];
  /** Draft collections this call was not allowed to promote, and their counts. */
  leftAlone: Map<string, number>;
}

export const runApproval = (options: {
  bundle: CourseBundle;
  draftsDir: string;
  courseDir: string;
  root: string;
  approver: string;
  timezone?: string;
  only?: Set<string>;
  reject?: Set<string>;
  collections?: readonly string[];
  dryRun?: boolean;
  now?: Date;
}): ApprovalOutcome => {
  const { bundle, courseDir, root, approver, only, reject, dryRun = false } = options;
  const draftsDir = resolve(options.draftsDir);
  const lines: string[] = [];
  const leftAlone = new Map<string, number>();
  const issues = new IssueList();

  const empty = (): Approval => ({ records: new Map(), idMap: new Map(), skipped: [], notes: [] });
  const refused = (approval: Approval, staged: string[] = []): ApprovalOutcome => ({
    ok: false,
    approval,
    staged,
    lines,
    errors: issues.errors.map((issue) => describe(issue)),
    written: [],
    leftAlone,
  });

  const loaded = loadDrafts(draftsDir, issues);
  if (issues.errors.length) {
    lines.push("the drafts do not load cleanly; nothing was approved");
    return refused(empty());
  }

  // The restriction, applied before anything is promoted rather than after —
  // a collection this call may not write is a collection it does not reason
  // about at all.
  let drafted = loaded;
  if (options.collections) {
    const allowed = new Set(options.collections);
    const kept: Record<string, unknown[]> = {};
    for (const [collection, records] of Object.entries(loaded)) {
      const entries = records as unknown[];
      if (allowed.has(collection)) kept[collection] = entries;
      else if (entries.length) leftAlone.set(collection, entries.length);
    }
    drafted = kept as Drafted;
  }

  const stamp = decidedAt(options.timezone, options.now ?? new Date());
  const approval = approveDrafts(bundle, drafted, {
    approver,
    decidedAt: stamp,
    issues,
    only,
    reject,
  });

  if (total(approval) === 0 && !issues.errors.length) {
    lines.push("nothing to approve");
    for (const [collection, count] of leftAlone) {
      lines.push(`  ${count} draft(s) in ${collection} left alone — this command does not promote them`);
    }
    return { ok: true, approval, staged: [], lines, errors: [], written: [], leftAlone };
  }

  lines.push(`Approving as ${approver} at ${stamp}\n`);
  for (const [collection, items] of approval.records) {
    const field = ID_FIELDS[collection]!;
    lines.push(`  ${collection}:`);
    for (const item of items) {
      const promotedId = item[field] as string;
      const original =
        [...approval.idMap.entries()].find(([, value]) => value === promotedId)?.[0] ?? promotedId;
      lines.push(`    ${original}  ->  ${promotedId}`);
    }
  }
  for (const [collection, count] of leftAlone) {
    lines.push(`\n  left alone: ${count} draft(s) in ${collection} — this command does not promote them`);
  }
  for (const note of approval.notes) lines.push(`\n  note: ${note}`);
  if (approval.skipped.length) lines.push(`\n  skipped: ${[...approval.skipped].sort().join(", ")}`);

  const staged = stageDocuments(approval, { root, courseDir, issues, dryRun });
  const merged = mergeDrafts(bundle, Object.fromEntries(approval.records));

  // A dry run rewrites every staged `storage_key` to its destination but copies
  // nothing, so the validator then reports each of those materials as a missing
  // file. That is the rehearsal's own shadow, not a fault in the drafts: the
  // same approval run for real copies the file first and passes.
  //
  // Only that one code, and only for the documents `stageDocuments` said it
  // would move, is dropped. A document whose SOURCE is missing never enters that
  // list, so it still fails here — which is the case a preview exists to catch.
  const found = validate(merged, { root });
  const stagedIds = new Set(staged);
  issues.extend(
    dryRun
      ? found.items.filter(
          (issue) =>
            !(
              issue.code === "document.missing_file" &&
              issue.location != null &&
              stagedIds.has(issue.location)
            ),
        )
      : found,
  );
  if (issues.errors.length) {
    lines.push("\nvalidation of the approved records failed; nothing was written");
    return refused(approval, staged);
  }

  // Printed on every run rather than left to be discovered. The refusal *is* the
  // gate, so its width is the one number that says how much this gate is worth.
  const { implemented, total: allChecks } = coverage();
  lines.push(
    `\nchecked against ${implemented} of ${allChecks} validator checks` +
      (implemented === allChecks ? "" : " — `python -m ainar validate` is the complete set"),
  );

  if (dryRun) {
    lines.push(
      "\ndry run — nothing written" +
        (staged.length
          ? `, and ${staged.length} material(s) not copied. The real run copies them first.`
          : ""),
    );
    return { ok: true, approval, staged, lines, errors: [], written: [], leftAlone };
  }

  const written = writeRecords(courseDir, approval);
  for (const path of written) {
    lines.push(`wrote ${relative(root, path).split(/[\/]/).join("/")}`);
  }
  lines.push(`\n${total(approval)} record(s) approved.`);
  return { ok: true, approval, staged, lines, errors: [], written, leftAlone };
};
