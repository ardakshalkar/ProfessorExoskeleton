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
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse } from "yaml";
import { allRubrics, criterionById } from "./bundle.js";
import { DRAFTABLE } from "./drafts.js";
import { dump } from "./yaml-out.js";
export const DRAFT_MARKER = "-DRAFT-";
/**
 * Where each collection lands, relative to the course directory.
 *
 * Runtime records go to `records/`. Documents and resources go beside their
 * authored counterparts but in a separate `generated.yaml` — writing YAML back
 * into a hand-authored file would strip its comments and reformat it.
 *
 * Concepts and modules are not here: they belong to the course, not to a
 * semester, and are no longer approvable at all.
 */
export const RECORD_FILES = {
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
// `CLAIM_FILES`, `approveClaim` and `CLAIM_HEADER` were removed on 2026-09-05,
// when concepts and modules left DRAFTABLE and became the professor's to author
// directly. Kept in step with `ainar-node/src/approve.ts` by hand — this is the
// BUILT copy the pane reads, and the two must change together.
const MATERIALS_DIR = "materials";
export const ID_FIELDS = {
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
/** `EVAL-DRAFT-9081-0401` becomes `EVAL-9081-0401`. */
export const promoteIdentifier = (value) => value.includes(DRAFT_MARKER) ? value.replace(DRAFT_MARKER, "-") : value;
/** Replace every draft identifier anywhere in a record, at any depth. */
const rewrite = (node, idMap) => {
    if (typeof node === "string")
        return idMap.get(node) ?? node;
    if (Array.isArray(node))
        return node.map((item) => rewrite(item, idMap));
    if (node !== null && typeof node === "object") {
        return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, rewrite(value, idMap)]));
    }
    return node;
};
// --------------------------------------------------------------------------
// Timestamps
// --------------------------------------------------------------------------
/**
 * `datetime.now(run_timezone(...)).replace(microsecond=0).isoformat()`.
 *
 * The offset comes from the run's own `timezone`, falling back to Asia/Almaty
 * the way Python's does — a stamp is the record of when a person decided, so a
 * silent UTC substitution would misreport it by five hours.
 */
export const decidedAt = (timezone, now = new Date()) => {
    const zone = timezone || "Asia/Almaty";
    let offsetMinutes;
    try {
        const format = new Intl.DateTimeFormat("en-US", {
            timeZone: zone,
            timeZoneName: "longOffset",
        });
        const part = format.formatToParts(now).find((entry) => entry.type === "timeZoneName")?.value;
        const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
        offsetMinutes = match
            ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
            : 300;
    }
    catch {
        offsetMinutes = 300; // +05:00, the same fallback `run_timezone` uses
    }
    const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
    const pad = (value, width = 2) => String(value).padStart(width, "0");
    const sign = offsetMinutes < 0 ? "-" : "+";
    const magnitude = Math.abs(offsetMinutes);
    return (`${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
        `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}` +
        `${sign}${pad(Math.floor(magnitude / 60))}:${pad(magnitude % 60)}`);
};
export const total = (approval) => [...approval.records.values()].reduce((sum, items) => sum + items.length, 0);
const existingIdentifiers = (bundle) => {
    const found = new Set();
    for (const [collection, field] of Object.entries(ID_FIELDS)) {
        for (const record of (bundle[collection] ?? [])) {
            const value = record[field];
            if (typeof value === "string")
                found.add(value);
        }
    }
    for (const id of allRubrics(bundle).keys())
        found.add(id);
    for (const id of criterionById(bundle).keys())
        found.add(id);
    return found;
};
/** Add the professor's decision beside the suggestion, never over it. */
const approveEvaluation = (data, approver, stamp, approval, issues) => {
    const identifier = data.evaluation_id ?? "?";
    const suggestion = data.ai_suggestion;
    const decision = data.professor_decision;
    if (decision === null || decision === undefined) {
        if (suggestion === null || suggestion === undefined || suggestion.score === null || suggestion.score === undefined) {
            issues.error("approve.nothing_to_approve", "evaluation has neither a suggestion to accept nor a decision", identifier);
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
    if (decision.decided_by === undefined)
        decision.decided_by = approver;
    if (decision.decided_at === undefined)
        decision.decided_at = stamp;
    if (suggestion !== null && suggestion !== undefined && suggestion.score !== decision.score) {
        data.status = "overridden";
        approval.notes.push(`${identifier}: professor set ${decision.score} against the suggested ${suggestion.score}`);
    }
    else {
        data.status = "approved";
    }
    return data;
};
const approveIntervention = (data, approver) => {
    if (data.status === undefined || data.status === null || data.status === "proposed") {
        data.status = "approved";
    }
    if (data.approved_by === undefined)
        data.approved_by = approver;
    return data;
};
/** Turn drafted proposals into records a person stands behind. */
export const approveDrafts = (bundle, drafted, options) => {
    const approval = { records: new Map(), idMap: new Map(), skipped: [], notes: [] };
    const { approver, decidedAt: stamp, issues, only, reject } = options;
    const selected = new Map();
    for (const [collection, records] of Object.entries(drafted)) {
        const field = ID_FIELDS[collection];
        const keep = [];
        for (const record of records) {
            const identifier = field ? record[field] : undefined;
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
        if (keep.length)
            selected.set(collection, keep);
    }
    for (const [collection, records] of selected) {
        const field = ID_FIELDS[collection];
        if (!field)
            continue;
        for (const record of records) {
            const identifier = record[field];
            approval.idMap.set(identifier, promoteIdentifier(identifier));
            // A rubric and its criteria live inside the assessment, so their draft
            // identifiers need promoting too — and items elsewhere in the same batch
            // point at those criteria.
            const rubric = record.rubric;
            if (rubric) {
                const rubricId = rubric.rubric_id;
                approval.idMap.set(rubricId, promoteIdentifier(rubricId));
                for (const criterion of rubric.criteria ?? []) {
                    const criterionId = criterion.criterion_id;
                    approval.idMap.set(criterionId, promoteIdentifier(criterionId));
                }
            }
        }
    }
    const existing = existingIdentifiers(bundle);
    for (const [draftId, realId] of approval.idMap) {
        if (existing.has(realId)) {
            issues.error("approve.collision", `${draftId} would become ${realId}, which already exists`, draftId);
        }
    }
    for (const [collection, records] of selected) {
        const model = DRAFTABLE[collection];
        const promoted = [];
        for (const record of records) {
            let data = rewrite(structuredClone(record), approval.idMap);
            if (collection === "evaluations") {
                data = approveEvaluation(data, approver, stamp, approval, issues);
            }
            else if (collection === "interventions") {
                data = approveIntervention(data, approver);
            }
            if (data === null)
                continue;
            const parsed = model.safeParse(data);
            if (!parsed.success) {
                issues.error("approve.invalid", parsed.error.issues.map((problem) => `${problem.path.join(".")}: ${problem.message}`).join("; "), data[ID_FIELDS[collection] ?? ""] ?? collection);
                continue;
            }
            promoted.push(parsed.data);
        }
        if (promoted.length)
            approval.records.set(collection, promoted);
    }
    return approval;
};
// --------------------------------------------------------------------------
// Documents
// --------------------------------------------------------------------------
/** Repository-relative keys have no scheme; object-storage keys use `://`. */
export const isRepoKey = (storageKey) => !storageKey.includes("://");
/**
 * Move approved material out of `work/` and stamp size and checksum.
 *
 * Size and checksum are computed here rather than asked of the agent, because an
 * agent hand-writing a sha256 is an invitation to error.
 */
export const stageDocuments = (approval, options) => {
    const { root, runDir, issues, dryRun = false } = options;
    for (const document of approval.records.get("documents") ?? []) {
        const storageKey = document.storage_key;
        if (!isRepoKey(storageKey))
            continue;
        const source = resolve(root, storageKey);
        if (!existsSync(source) || !statSync(source).isFile()) {
            issues.error("document.missing_file", `storage_key points at ${storageKey}, which does not exist`, document.document_id);
            continue;
        }
        let destination = source;
        const parts = relative(root, source).split(/[\\/]/);
        if (parts[0] === "work") {
            destination = join(runDir, MATERIALS_DIR, basename(source));
            if (existsSync(destination) && !dryRun) {
                issues.error("document.collision", `${relative(root, destination).split(/[\\/]/).join("/")} already exists`, document.document_id);
                continue;
            }
            if (!dryRun) {
                mkdirSync(dirname(destination), { recursive: true });
                writeFileSync(destination, readFileSync(source));
                unlinkSync(source);
            }
            approval.notes.push(`${document.document_id}: material moved to ` +
                relative(root, destination).split(/[\\/]/).join("/"));
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
export const tidy = (node) => {
    if (Array.isArray(node))
        return node.map(tidy);
    if (node === null || typeof node !== "object")
        return node;
    const cleaned = {};
    for (const [key, value] of Object.entries(node)) {
        const isEmptyExtensions = key === "extensions" &&
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0;
        if (!isEmptyExtensions)
            cleaned[key] = tidy(value);
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
export const floatPaths = (schema, prefix = [], seen = new Set()) => {
    const found = new Set();
    if (seen.has(schema))
        return found;
    seen.add(schema);
    const def = schema._def;
    if (!def)
        return found;
    const inner = def.innerType ??
        def.schema ??
        def.type;
    const typeName = def.typeName;
    if (typeName === "ZodNumber") {
        const checks = def.checks ?? [];
        if (!checks.some((check) => check.kind === "int"))
            found.add(prefix.join("."));
        return found;
    }
    if (typeName === "ZodObject") {
        const shape = schema.shape;
        for (const [key, child] of Object.entries(shape)) {
            for (const path of floatPaths(child, [...prefix, key], seen))
                found.add(path);
        }
        return found;
    }
    if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
        const options = def.options ?? [];
        const list = Array.isArray(options) ? options : [...options.values()];
        for (const option of list) {
            for (const path of floatPaths(option, prefix, seen))
                found.add(path);
        }
        return found;
    }
    if (inner) {
        // ZodArray keeps its element in `type`, and an array adds no path segment —
        // the emitter indexes by key, not by position.
        for (const path of floatPaths(inner, prefix, seen))
            found.add(path);
    }
    return found;
};
const loadExisting = (path, collection) => {
    if (!existsSync(path))
        return [];
    const document = parse(readFileSync(path, "utf-8")) ?? {};
    if (Array.isArray(document))
        return [...document];
    if (typeof document === "object") {
        const value = document[collection];
        return Array.isArray(value) ? [...value] : [];
    }
    return [];
};
export const HEADER = "# Written by `ainar approve`.\n" +
    "#\n" +
    "# Every entry was proposed by an agent and accepted by a person. AI\n" +
    "# suggestions are preserved beside the decisions that superseded them.\n" +
    "# Machine-managed — change these through approval, not by hand.\n\n";
const append = (path, collection, items, header) => {
    mkdirSync(dirname(path), { recursive: true });
    const payload = loadExisting(path, collection);
    payload.push(...items.map((item) => tidy(item)));
    const schema = DRAFTABLE[collection];
    const floats = schema ? floatPaths(schema, [collection]) : new Set();
    const body = dump({ [collection]: payload }, (path_) => floats.has(path_.join(".")));
    writeFileSync(path, header + body, { encoding: "utf-8" });
    return path;
};
/**
 * Append approved records to their destination, one file per collection.
 *
 * Everything approvable lands in the course directory, so that is the only
 * destination there is.
 */
export const writeRecords = (runDir, approval) => {
    const written = [];
    for (const [collection, items] of approval.records) {
        const file = RECORD_FILES[collection];
        if (file === undefined) {
            throw new Error(`${collection} has no destination in RECORD_FILES, so it cannot be approved. ` +
                "Add one, or take the collection out of DRAFTABLE.");
        }
        written.push(append(join(runDir, file), collection, items, HEADER));
    }
    return written;
};
