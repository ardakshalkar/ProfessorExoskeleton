/**
 * Reading a course directory into a bundle. Ported from `ainar/loader.py`.
 *
 * The glob patterns are the contract with the layout and are copied across
 * verbatim — a course that loads in Python must load identically here, and a
 * pattern quietly dropped would mean a collection that is silently empty.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { parseAllDocuments } from "yaml";
import { COLLECTION_SCHEMAS } from "./bundle.js";
import { IssueList } from "./issues.js";
import { Capability, Concept, Course } from "./model/academic.js";
import { User } from "./model/delivery.js";
/** One list on the bundle and the files it is read from. */
// >>> BEGIN generated from DataLayer - do not edit
//
// Projected from DataLayer 1.0 by `python -m exo setup`.
// The registry is the contract; this is a copy of it that needs no YAML
// parser at boot. Edit datalayer.yaml and re-run setup, never this block.
//
// Three channels, and the difference between them is the whole point:
//   COLLECTIONS  what the registry says a professor authors here
//   FIXTURES     samples/ - synthetic records, loaded and announced
//   FORBIDDEN    restricted data in the tree, which storage.md forbids
//                outright. Reported, never read.
const DATALAYER = {
    format_version: "1.0",
    entities: {
        outcomes: { entity: "learning_outcome", storage: "yaml", sensitivity: "public" },
        concepts: { entity: "concept", storage: "yaml", sensitivity: "public" },
        concept_edges: { entity: "concept_edge", storage: "yaml", sensitivity: "public" },
        capabilities: { entity: "capability", storage: "yaml", sensitivity: "public" },
        modules: { entity: "module", storage: "yaml", sensitivity: "public" },
        users: { entity: "user", storage: "yaml", sensitivity: "internal" },
        versions: { entity: "course_version", storage: "yaml", sensitivity: "public" },
        enrollments: { entity: "enrollment", storage: "supabase", sensitivity: "restricted" },
        activities: { entity: "learning_activity", storage: "yaml", sensitivity: "public" },
        documents: { entity: "document", storage: "yaml", sensitivity: "internal" },
        resources: { entity: "resource", storage: "yaml", sensitivity: "public" },
        assessments: { entity: "assessment", storage: "yaml", sensitivity: "internal" },
        rubrics: { entity: "rubric", storage: "yaml", sensitivity: "internal" },
        items: { entity: "assessment_item", storage: "yaml", sensitivity: "internal" },
        item_models: { entity: "item_model", storage: "yaml", sensitivity: "internal" },
        submissions: { entity: "submission", storage: "supabase", sensitivity: "restricted" },
        item_responses: { entity: "item_response", storage: "supabase", sensitivity: "restricted" },
        evaluations: { entity: "evaluation", storage: "supabase", sensitivity: "restricted" },
        evidence: { entity: "learning_evidence", storage: "supabase", sensitivity: "restricted" },
        concept_states: { entity: "student_concept_state", storage: "supabase", sensitivity: "restricted" },
        capability_states: { entity: "student_capability_state", storage: "supabase", sensitivity: "restricted" },
        signals: { entity: "student_signal", storage: "supabase", sensitivity: "restricted" },
        interventions: { entity: "intervention", storage: "supabase", sensitivity: "restricted" },
        events: { entity: "course_event", storage: "supabase", sensitivity: "internal" },
        action_items: { entity: "action_item", storage: "supabase", sensitivity: "internal" },
    },
};

const COLLECTIONS = {
    outcomes: ["outcomes.yaml", "outcomes/*.yaml"],
    concepts: ["concepts.yaml", "concepts/*.yaml"],
    concept_edges: ["concept-edges.yaml"],
    capabilities: ["capabilities.yaml"],
    modules: ["modules.yaml", "modules/*.yaml"],
    users: ["people/users.yaml", "people/*.yaml"],
    versions: ["versions/*/version.yaml"],
    enrollments: ["versions/*/enrollments.yaml"],
    activities: ["versions/*/activities.yaml", "versions/*/activities/*.yaml"],
    documents: ["versions/*/documents.yaml", "versions/*/documents/*.yaml"],
    resources: ["versions/*/resources.yaml", "versions/*/resources/*.yaml"],
    assessments: ["versions/*/assessments.yaml", "versions/*/assessments/*.yaml"],
    rubrics: ["versions/*/rubrics.yaml", "versions/*/rubrics/*.yaml"],
    items: ["versions/*/items.yaml", "versions/*/items/*.yaml", "versions/*/assessments/items/*.yaml"],
    item_models: ["versions/*/item-models.yaml", "versions/*/item-models/*.yaml"],
    submissions: [],
    item_responses: [],
    evaluations: [],
    evidence: [],
    concept_states: [],
    capability_states: [],
    signals: [],
    interventions: [],
    events: [],
    action_items: [],
};

const FIXTURES = {
    enrollments: ["versions/*/samples/enrollments*.yaml"],
    documents: ["versions/*/samples/documents*.yaml"],
    submissions: ["versions/*/samples/submissions*.yaml"],
    item_responses: ["versions/*/samples/item-responses*.yaml"],
    evaluations: ["versions/*/samples/evaluations*.yaml"],
    evidence: ["versions/*/samples/evidence*.yaml"],
    concept_states: ["versions/*/samples/concept-states*.yaml"],
    capability_states: ["versions/*/samples/capability-states*.yaml"],
    signals: ["versions/*/samples/signals*.yaml"],
    interventions: ["versions/*/samples/interventions*.yaml"],
    events: ["versions/*/samples/events*.yaml", "versions/*/records/events*.yaml"],
    action_items: ["versions/*/samples/action-items*.yaml", "versions/*/records/action-items*.yaml"],
};

const FORBIDDEN = {
    enrollments: ["versions/*/records/enrollments*.yaml"],
    submissions: ["versions/*/records/submissions*.yaml"],
    item_responses: ["versions/*/records/item-responses*.yaml"],
    evaluations: ["versions/*/records/evaluations*.yaml"],
    evidence: ["versions/*/records/evidence*.yaml"],
    concept_states: ["versions/*/records/concept-states*.yaml"],
    capability_states: ["versions/*/records/capability-states*.yaml"],
    signals: ["versions/*/records/signals*.yaml"],
    interventions: ["versions/*/records/interventions*.yaml"],
};

/** Collections naming a real student. Loading one is always worth saying. */
const RESTRICTED = new Set(["enrollments", "submissions", "item_responses", "evaluations", "evidence", "concept_states", "capability_states", "signals", "interventions"]);

const SHARED_CONCEPTS = "shared/concepts.yaml";
const SHARED_CAPABILITIES = "shared/capabilities.yaml";
const SHARED_USERS = "shared/users.yaml";

/**
 * One collection, read through the sensitivity class the registry gives it.
 *
 * The forbidden sweep runs first and runs even when the collection loads
 * nothing, because the point is to report the file's existence. Its contents
 * are deliberately not read: a bundle carrying the row is a bundle that can
 * serialise it into a prompt, a log or a widget, and the reason the file is
 * refused is that it should not have been on this disk at all.
 */
const readCollection = (base, name, schema, issues) => {
    for (const pattern of FORBIDDEN[name] ?? []) {
        for (const path of glob(base, pattern)) {
            issues.error(
                "storage.forbidden",
                `${name} identifies a student and belongs only in Supabase; `
                    + `this file is in the course tree and was NOT read. `
                    + `Move it out of the repository.`,
                path,
            );
        }
    }
    const authored = readInto(base, name, COLLECTIONS[name] ?? [], schema, issues);
    const fixtures = readInto(base, name, FIXTURES[name] ?? [], schema, issues);
    if (fixtures.length && RESTRICTED.has(name)) {
        issues.warn(
            "storage.fixture",
            `${fixtures.length} ${name} read from samples/ - synthetic fixtures, `
                + `not the roster. Real ${name} come from Supabase.`,
        );
    }
    return [...authored, ...fixtures];
};
// <<< END generated from DataLayer
// --------------------------------------------------------------------------
// Globbing
// --------------------------------------------------------------------------
/** `*` matches within one path segment, as `Path.glob` does. No `**`. */
const toRegExp = (pattern) => new RegExp("^" +
    pattern
        .split("/")
        .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
        .join("/") +
    "$");
const walk = (base) => {
    const found = [];
    const visit = (directory) => {
        let entries;
        try {
            entries = readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = join(directory, entry.name);
            if (entry.isDirectory())
                visit(full);
            else
                found.push(full);
        }
    };
    visit(base);
    return found;
};
const glob = (base, pattern) => {
    const expression = toRegExp(pattern);
    return walk(base)
        .filter((path) => expression.test(relative(base, path).split(sep).join(posix.sep)))
        .sort();
};
// --------------------------------------------------------------------------
// YAML reading
// --------------------------------------------------------------------------
/**
 * Resolve `<<: *anchor` the way `yaml.safe_load_all` does.
 *
 * Merge keys are YAML 1.1. PyYAML expands them with no option asked for, and
 * `yaml`'s default 1.2 core schema leaves `<<` as a literal key — so a file
 * every authoring tool writes and Python reads came back here with a mapping
 * under `"<<"` and the merged fields missing. A real `documents-draft.yaml`
 * hangs its figure provenance off one anchor; the port rejected three records
 * as `generated_by.produced_by: Required` while Python approved the same file.
 *
 * It must be passed at PARSE time. `toJS({ merge: true })` is accepted and does
 * nothing, which is the version of this bug that looks fixed.
 */
export const MERGE_KEYS = { merge: true };
const documents = (path, issues) => {
    let raw;
    try {
        raw = readFileSync(path, "utf-8");
    }
    catch (error) {
        issues.error("file.unreadable", String(error), path);
        return [];
    }
    try {
        return parseAllDocuments(raw, MERGE_KEYS)
            .map((document) => document.toJS({ mapAsMap: false }))
            .filter((value) => value !== null && value !== undefined);
    }
    catch (error) {
        issues.error("yaml.invalid", `cannot parse YAML: ${error}`, path);
        return [];
    }
};
/** Normalise one YAML document into a list of entity mappings. */
const entries = (document, collection, path, issues) => {
    let candidates;
    if (Array.isArray(document)) {
        candidates = document;
    }
    else if (document && typeof document === "object") {
        const keys = Object.keys(document);
        const inner = document[collection];
        candidates = keys.length === 1 && keys[0] === collection && Array.isArray(inner) ? inner : [document];
    }
    else {
        issues.error("yaml.shape", `expected a mapping or list, got ${typeof document}`, path);
        return [];
    }
    const found = [];
    candidates.forEach((candidate, index) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            issues.error("yaml.shape", `entry ${index} is not a mapping`, path);
            return;
        }
        found.push(candidate);
    });
    return found;
};
const report = (error, path, issues) => {
    for (const detail of error.issues) {
        const where = detail.path.map(String).join(".") || "<root>";
        issues.error("schema.invalid", `${where}: ${detail.message}`, path);
    }
};
const readInto = (base, name, patterns, schema, issues) => {
    const seen = new Set();
    const loaded = [];
    for (const pattern of patterns) {
        for (const path of glob(base, pattern)) {
            if (seen.has(path) || !statSync(path).isFile())
                continue;
            seen.add(path);
            for (const document of documents(path, issues)) {
                for (const entry of entries(document, name, path, issues)) {
                    const result = schema.safeParse(entry);
                    if (result.success)
                        loaded.push(result.data);
                    else
                        report(result.error, path, issues);
                }
            }
        }
    }
    return loaded;
};
const readShared = (root, relativePath, schema, issues) => {
    const path = join(root, relativePath);
    try {
        if (!statSync(path).isFile())
            return [];
    }
    catch {
        return [];
    }
    const name = relativePath.split("/").pop().replace(/\.yaml$/, "");
    const loaded = [];
    for (const document of documents(path, issues)) {
        for (const entry of entries(document, name, path, issues)) {
            const result = schema.safeParse(entry);
            if (result.success)
                loaded.push(result.data);
            else
                report(result.error, path, issues);
        }
    }
    return loaded;
};
// --------------------------------------------------------------------------
// Shared records
// --------------------------------------------------------------------------
const referencedConcepts = (data) => {
    const referenced = new Set();
    const add = (values) => values?.forEach((value) => referenced.add(value));
    for (const module of data.modules ?? [])
        add(module.concepts);
    for (const outcome of data.outcomes ?? [])
        add(outcome.concepts);
    for (const activity of data.activities ?? [])
        add(activity.concepts);
    for (const resource of data.resources ?? [])
        add(resource.concepts);
    for (const concept of data.concepts ?? []) {
        add(concept.prerequisites);
        add(concept.related);
    }
    for (const itemModel of data.item_models ?? []) {
        add(itemModel.concepts);
        add(itemModel.misconceptions);
    }
    return referenced;
};
const referencedCapabilities = (data) => {
    const referenced = new Set();
    for (const outcome of data.outcomes ?? [])
        outcome.capabilities?.forEach((c) => referenced.add(c));
    const fromRubric = (rubric) => {
        for (const criterion of rubric?.criteria ?? []) {
            if (criterion.capability_id)
                referenced.add(criterion.capability_id);
        }
    };
    for (const assessment of data.assessments ?? [])
        if (assessment.rubric)
            fromRubric(assessment.rubric);
    for (const rubric of data.rubrics ?? [])
        fromRubric(rubric);
    for (const itemModel of data.item_models ?? []) {
        if (itemModel.capability_id)
            referenced.add(itemModel.capability_id);
    }
    return referenced;
};
/** Add referenced shared concepts, following prerequisite edges transitively. */
const pullSharedConcepts = (local, shared, wanted) => {
    const have = new Set(local.map((concept) => concept.concept_id));
    const byId = new Map(shared.map((concept) => [concept.concept_id, concept]));
    const pending = [...wanted].filter((id) => !have.has(id) && byId.has(id));
    const added = [];
    while (pending.length) {
        const conceptId = pending.pop();
        if (have.has(conceptId))
            continue;
        const concept = byId.get(conceptId);
        have.add(conceptId);
        added.push(concept);
        for (const neighbour of [...(concept.prerequisites ?? []), ...(concept.related ?? [])]) {
            if (!have.has(neighbour) && byId.has(neighbour))
                pending.push(neighbour);
        }
    }
    return [...local, ...added];
};
/** Course directories under `courses/`, in identifier order. */
export const discoverCourses = (root) => {
    const coursesDir = join(root, "courses");
    let entries;
    try {
        entries = readdirSync(coursesDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(coursesDir, entry.name))
        .filter((path) => {
        try {
            return statSync(join(path, "course.yaml")).isFile();
        }
        catch {
            return false;
        }
    })
        .sort();
};
export const loadCourse = (courseDir, root) => {
    const issues = new IssueList();
    const courseFile = join(courseDir, "course.yaml");
    try {
        if (!statSync(courseFile).isFile())
            throw new Error();
    }
    catch {
        issues.error("course.missing", "course.yaml not found", courseDir);
        return { bundle: null, issues };
    }
    let course = null;
    for (const document of documents(courseFile, issues)) {
        for (const entry of entries(document, "course", courseFile, issues)) {
            const result = Course.safeParse(entry);
            if (result.success)
                course = result.data;
            else
                report(result.error, courseFile, issues);
        }
    }
    if (!course)
        return { bundle: null, issues };
    const data = {};
    for (const [name, schema] of Object.entries(COLLECTION_SCHEMAS)) {
        data[name] = readCollection(courseDir, name, schema, issues);
    }
    const sharedConcepts = readShared(root, SHARED_CONCEPTS, Concept, issues);
    const sharedCapabilities = readShared(root, SHARED_CAPABILITIES, Capability, issues);
    const sharedUsers = readShared(root, SHARED_USERS, User, issues);
    if (sharedConcepts.length) {
        data.concepts = pullSharedConcepts(data.concepts, sharedConcepts, referencedConcepts(data));
    }
    if (sharedCapabilities.length) {
        const have = new Set(data.capabilities.map((capability) => capability.capability_id));
        const wanted = referencedCapabilities(data);
        data.capabilities = [
            ...data.capabilities,
            ...sharedCapabilities.filter((capability) => wanted.has(capability.capability_id) && !have.has(capability.capability_id)),
        ];
    }
    if (sharedUsers.length) {
        const have = new Set(data.users.map((user) => user.user_id));
        data.users = [...data.users, ...sharedUsers.filter((user) => !have.has(user.user_id))];
    }
    return { bundle: { course, ...data }, issues };
};
