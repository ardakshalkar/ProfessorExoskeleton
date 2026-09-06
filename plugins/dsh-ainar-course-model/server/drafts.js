/**
 * Reading agent proposals out of `work/`. Ported from `ainar/loader.py`.
 *
 * `DRAFTABLE` is the whole list of what an agent may propose, and the omissions
 * are the point: no `outcomes`, no `capabilities`, no `enrollments`. A learning
 * outcome is what student evidence attaches to, so an invented one is the
 * mistake that costs most to find late — the loader refuses it in a draft file
 * rather than trusting a skill to decline.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
import { MERGE_KEYS } from "./loader.js";
import { Concept, Module } from "./model/academic.js";
import { Assessment, AssessmentItem, Evaluation, ItemModel, ItemResponse, Submission, } from "./model/assessment.js";
import { Document } from "./model/content.js";
import { LearningActivity, Resource } from "./model/delivery.js";
import { ActionItem, CourseEvent } from "./model/harness.js";
import { Intervention, LearningEvidence, StudentCapabilityState, StudentConceptState, StudentSignal, } from "./model/learning.js";
/** What may appear in a draft file, keyed by its top-level YAML key. */
export const DRAFTABLE = {
    // `concepts` and `modules` removed on 2026-09-05, to match
    // `ainar-node/src/drafts.ts`. The course's structure is the professor's to
    // author directly in `courses/`; only what reaches a student waits for
    // approval.
    //
    // Edited in the BUILT copy because this plugin is vendored as output, with
    // no build step in this checkout. The source of truth is
    // `ainar-node/src/drafts.ts`, and the two must be changed together: the CLI
    // reads that one and the professor's pane reads this one, so a change to
    // either alone means `bin/ainar` refusing a draft file the pane accepted.
    activities: LearningActivity,
    documents: Document,
    resources: Resource,
    assessments: Assessment,
    items: AssessmentItem,
    item_models: ItemModel,
    submissions: Submission,
    item_responses: ItemResponse,
    evaluations: Evaluation,
    evidence: LearningEvidence,
    concept_states: StudentConceptState,
    capability_states: StudentCapabilityState,
    signals: StudentSignal,
    interventions: Intervention,
    events: CourseEvent,
    action_items: ActionItem,
};
const empty = () => Object.fromEntries(Object.keys(DRAFTABLE).map((key) => [key, []]));
/**
 * `_SIDECARS` in `loader.py`: the files `pres` writes beside a deck's markdown.
 *
 * `plan.ts` resolves each as `dirname(deck) + basename + suffix`, so they cannot
 * be moved out of a drafts directory without the presentation tooling losing
 * them — which is why the rule is the suffix rather than the path.
 */
const SIDECARS = [".plan.yaml", ".outline.yaml"];
/**
 * Every `.yaml`/`.yml` under `directory`, recursively, in sorted order —
 * skipping what a tool left behind rather than what somebody proposed.
 *
 * `_machinery` in `loader.py` is the rule, and this had none of it: a
 * dot-directory, a `node_modules`, and a deck sidecar were all read as drafts
 * and reported as undraftable collections. Python skipped them and this did
 * not, so `ainar validate` said a workspace was clean while the pane serving
 * the same files listed a hundred and sixteen errors against it.
 */
const draftFiles = (directory) => {
    const found = [];
    const walk = (path) => {
        for (const entry of readdirSync(path).sort()) {
            const full = join(path, entry);
            if (statSync(full).isDirectory()) {
                // `relative.parts[:-1]` in Python: a directory on the way down, never
                // the drafts root itself, which `walk` is only ever handed.
                if (entry !== "node_modules" && !entry.startsWith("."))
                    walk(full);
            }
            else if (/\.ya?ml$/.test(entry) && !SIDECARS.some((s) => entry.endsWith(s))) {
                found.push(full);
            }
        }
    };
    walk(directory);
    // Python sorts the union of two rglob results, which orders by full path.
    return found.sort();
};
/**
 * The first zod error, rendered the way `_format_validation_error` renders it:
 * the record's index, the field path, and what was wrong with it.
 */
const formatError = (error, path, index, collection, issues) => {
    for (const problem of error.issues) {
        const where = problem.path.length ? problem.path.join(".") : "(record)";
        issues.error("draft.invalid", `${collection}[${index}].${where}: ${problem.message}`, path);
    }
};
/**
 * Load every draft file in a directory, dispatched by top-level key.
 *
 * One file may hold several collections, which is why a draft is keyed rather
 * than named by its filename.
 */
export const loadDrafts = (directory, issues) => {
    const drafted = empty();
    let stat;
    try {
        stat = statSync(directory);
    }
    catch {
        issues.error("draft.missing", "drafts directory not found", directory);
        return drafted;
    }
    if (!stat.isDirectory()) {
        issues.error("draft.missing", "drafts directory not found", directory);
        return drafted;
    }
    const paths = draftFiles(directory);
    if (!paths.length)
        issues.warn("draft.empty", "no draft files found", directory);
    for (const path of paths) {
        let documents;
        try {
            documents = parseAllDocuments(readFileSync(path, "utf-8"), MERGE_KEYS);
        }
        catch (error) {
            issues.error("draft.unreadable", String(error.message), path);
            continue;
        }
        for (const document of documents) {
            const value = document.toJS({ mapAsMap: false });
            if (value === null || value === undefined)
                continue;
            if (typeof value !== "object" || Array.isArray(value)) {
                issues.error("draft.shape", "a draft file must be a mapping of collection name to records", path);
                continue;
            }
            for (const [key, entries] of Object.entries(value)) {
                const model = DRAFTABLE[key];
                if (model === undefined) {
                    issues.error("draft.collection", `'${key}' is not a draftable collection; expected one of ` +
                        Object.keys(DRAFTABLE).sort().join(", "), path);
                    continue;
                }
                if (!Array.isArray(entries)) {
                    issues.error("draft.shape", `${key} must be a list of records`, path);
                    continue;
                }
                entries.forEach((entry, index) => {
                    const parsed = model.safeParse(entry);
                    if (parsed.success) {
                        drafted[key].push(parsed.data);
                    }
                    else {
                        formatError(parsed.error, path, index, key, issues);
                    }
                });
            }
        }
    }
    return drafted;
};
/** A copy of the bundle with drafted records appended, for validation. */
export const mergeDrafts = (bundle, drafted) => {
    const merged = structuredClone(bundle);
    for (const [name, records] of Object.entries(drafted)) {
        if (!records?.length)
            continue;
        merged[name] = [...(merged[name] ?? []), ...records];
    }
    return merged;
};
