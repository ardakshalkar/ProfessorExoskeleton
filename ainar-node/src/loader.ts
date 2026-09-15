/**
 * Reading a course directory into a bundle. Ported from `ainar/loader.py`.
 *
 * The glob patterns are the contract with the layout, and a pattern quietly
 * dropped would mean a collection that is silently empty.
 *
 * They no longer match Python's. Every pattern below used to begin
 * `versions/<TERM>/`, because a course directory was a container of offerings
 * and the term was a directory level. A workspace holds one run of one course,
 * so that level said the same thing in every path it appeared in and bought
 * nothing; `version.yaml` now sits beside `course.yaml` and still carries the
 * term. `ainar migrate-layout` moves an old tree, and `archive/<TERM>/` at the
 * workspace root — outside `courses/`, so outside every glob here — is where a
 * finished offering goes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { parseAllDocuments } from "yaml";
import { z } from "zod";
import { COLLECTION_SCHEMAS, type CollectionName, type CourseBundle } from "./bundle.ts";
import { IssueList } from "./issues.ts";
import { Capability, Concept, Course } from "./model/academic.ts";
import { User } from "./model/delivery.ts";

/** One list on the bundle and the files it is read from. */
const COLLECTIONS: Record<CollectionName, string[]> = {
  outcomes: ["outcomes.yaml", "outcomes/*.yaml"],
  concepts: ["concepts.yaml", "concepts/*.yaml"],
  concept_edges: ["concept-edges.yaml"],
  capabilities: ["capabilities.yaml"],
  modules: ["modules.yaml", "modules/*.yaml"],
  users: ["people/users.yaml", "people/*.yaml"],
  versions: ["version.yaml"],
  enrollments: ["enrollments.yaml"],
  activities: ["activities.yaml", "activities/*.yaml"],
  documents: ["documents.yaml", "documents/*.yaml", "samples/documents*.yaml"],
  resources: ["resources.yaml", "resources/*.yaml"],
  assessments: ["assessments.yaml", "assessments/*.yaml"],
  rubrics: ["rubrics.yaml", "rubrics/*.yaml"],
  items: ["items.yaml", "items/*.yaml", "assessments/items/*.yaml"],
  item_models: ["item-models.yaml", "item-models/*.yaml"],
  submissions: ["samples/submissions*.yaml", "records/submissions*.yaml"],
  item_responses: ["samples/item-responses*.yaml", "records/item-responses*.yaml"],
  evaluations: ["samples/evaluations*.yaml", "records/evaluations*.yaml"],
  evidence: ["samples/evidence*.yaml", "records/evidence*.yaml"],
  concept_states: ["samples/concept-states*.yaml", "records/concept-states*.yaml"],
  capability_states: ["samples/capability-states*.yaml", "records/capability-states*.yaml"],
  signals: ["samples/signals*.yaml", "records/signals*.yaml"],
  interventions: ["samples/interventions*.yaml", "records/interventions*.yaml"],
  events: ["samples/events*.yaml", "records/events*.yaml"],
  action_items: ["samples/action-items*.yaml", "records/action-items*.yaml"],
};

const SHARED_CONCEPTS = "shared/concepts.yaml";
const SHARED_CAPABILITIES = "shared/capabilities.yaml";
const SHARED_USERS = "shared/users.yaml";

// --------------------------------------------------------------------------
// Globbing
// --------------------------------------------------------------------------

/** `*` matches within one path segment, as `Path.glob` does. No `**`. */
const toRegExp = (pattern: string): RegExp =>
  new RegExp(
    "^" +
      pattern
        .split("/")
        .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
        .join("/") +
      "$",
  );

const walk = (base: string): string[] => {
  const found: string[] = [];
  const visit = (directory: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else found.push(full);
    }
  };
  visit(base);
  return found;
};

const glob = (base: string, pattern: string): string[] => {
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
export const MERGE_KEYS = { merge: true } as const;

const documents = (path: string, issues: IssueList): unknown[] => {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    issues.error("file.unreadable", String(error), path);
    return [];
  }
  try {
    return parseAllDocuments(raw, MERGE_KEYS)
      .map((document) => document.toJS({ mapAsMap: false }))
      .filter((value) => value !== null && value !== undefined);
  } catch (error) {
    issues.error("yaml.invalid", `cannot parse YAML: ${error}`, path);
    return [];
  }
};

/** Normalise one YAML document into a list of entity mappings. */
const entries = (
  document: unknown,
  collection: string,
  path: string,
  issues: IssueList,
): Record<string, unknown>[] => {
  let candidates: unknown[];
  if (Array.isArray(document)) {
    candidates = document;
  } else if (document && typeof document === "object") {
    const keys = Object.keys(document as object);
    const inner = (document as Record<string, unknown>)[collection];
    candidates = keys.length === 1 && keys[0] === collection && Array.isArray(inner) ? inner : [document];
  } else {
    issues.error("yaml.shape", `expected a mapping or list, got ${typeof document}`, path);
    return [];
  }

  const found: Record<string, unknown>[] = [];
  candidates.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      issues.error("yaml.shape", `entry ${index} is not a mapping`, path);
      return;
    }
    found.push(candidate as Record<string, unknown>);
  });
  return found;
};

const report = (error: z.ZodError, path: string, issues: IssueList): void => {
  for (const detail of error.issues) {
    const where = detail.path.map(String).join(".") || "<root>";
    issues.error("schema.invalid", `${where}: ${detail.message}`, path);
  }
};

const readInto = <T extends z.ZodTypeAny>(
  base: string,
  name: string,
  patterns: string[],
  schema: T,
  issues: IssueList,
): z.infer<T>[] => {
  const seen = new Set<string>();
  const loaded: z.infer<T>[] = [];
  for (const pattern of patterns) {
    for (const path of glob(base, pattern)) {
      if (seen.has(path) || !statSync(path).isFile()) continue;
      seen.add(path);
      for (const document of documents(path, issues)) {
        for (const entry of entries(document, name, path, issues)) {
          const result = schema.safeParse(entry);
          if (result.success) loaded.push(result.data);
          else report(result.error, path, issues);
        }
      }
    }
  }
  return loaded;
};

const readShared = <T extends z.ZodTypeAny>(
  root: string,
  relativePath: string,
  schema: T,
  issues: IssueList,
): z.infer<T>[] => {
  const path = join(root, relativePath);
  try {
    if (!statSync(path).isFile()) return [];
  } catch {
    return [];
  }
  const name = relativePath.split("/").pop()!.replace(/\.yaml$/, "");
  const loaded: z.infer<T>[] = [];
  for (const document of documents(path, issues)) {
    for (const entry of entries(document, name, path, issues)) {
      const result = schema.safeParse(entry);
      if (result.success) loaded.push(result.data);
      else report(result.error, path, issues);
    }
  }
  return loaded;
};

// --------------------------------------------------------------------------
// Shared records
// --------------------------------------------------------------------------

const referencedConcepts = (data: Record<string, any[]>): Set<string> => {
  const referenced = new Set<string>();
  const add = (values?: string[]) => values?.forEach((value) => referenced.add(value));
  for (const module of data.modules ?? []) add(module.concepts);
  for (const outcome of data.outcomes ?? []) add(outcome.concepts);
  for (const activity of data.activities ?? []) add(activity.concepts);
  for (const resource of data.resources ?? []) add(resource.concepts);
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

const referencedCapabilities = (data: Record<string, any[]>): Set<string> => {
  const referenced = new Set<string>();
  for (const outcome of data.outcomes ?? []) outcome.capabilities?.forEach((c: string) => referenced.add(c));
  const fromRubric = (rubric: any) => {
    for (const criterion of rubric?.criteria ?? []) {
      if (criterion.capability_id) referenced.add(criterion.capability_id);
    }
  };
  for (const assessment of data.assessments ?? []) if (assessment.rubric) fromRubric(assessment.rubric);
  for (const rubric of data.rubrics ?? []) fromRubric(rubric);
  for (const itemModel of data.item_models ?? []) {
    if (itemModel.capability_id) referenced.add(itemModel.capability_id);
  }
  return referenced;
};

/** Add referenced shared concepts, following prerequisite edges transitively. */
const pullSharedConcepts = (local: any[], shared: any[], wanted: Iterable<string>): any[] => {
  const have = new Set(local.map((concept) => concept.concept_id));
  const byId = new Map(shared.map((concept) => [concept.concept_id, concept]));
  const pending = [...wanted].filter((id) => !have.has(id) && byId.has(id));
  const added: any[] = [];
  while (pending.length) {
    const conceptId = pending.pop()!;
    if (have.has(conceptId)) continue;
    const concept = byId.get(conceptId)!;
    have.add(conceptId);
    added.push(concept);
    for (const neighbour of [...(concept.prerequisites ?? []), ...(concept.related ?? [])]) {
      if (!have.has(neighbour) && byId.has(neighbour)) pending.push(neighbour);
    }
  }
  return [...local, ...added];
};

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export interface LoadResult {
  bundle: CourseBundle | null;
  issues: IssueList;
}

/** Course directories under `courses/`, in identifier order. */
export const discoverCourses = (root: string): string[] => {
  const coursesDir = join(root, "courses");
  let entries;
  try {
    entries = readdirSync(coursesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(coursesDir, entry.name))
    .filter((path) => {
      try {
        return statSync(join(path, "course.yaml")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
};

export const loadCourse = (courseDir: string, root: string): LoadResult => {
  const issues = new IssueList();
  const courseFile = join(courseDir, "course.yaml");

  try {
    if (!statSync(courseFile).isFile()) throw new Error();
  } catch {
    issues.error("course.missing", "course.yaml not found", courseDir);
    return { bundle: null, issues };
  }

  let course: z.infer<typeof Course> | null = null;
  for (const document of documents(courseFile, issues)) {
    for (const entry of entries(document, "course", courseFile, issues)) {
      const result = Course.safeParse(entry);
      if (result.success) course = result.data;
      else report(result.error, courseFile, issues);
    }
  }
  if (!course) return { bundle: null, issues };

  const data: Record<string, any[]> = {};
  for (const [name, schema] of Object.entries(COLLECTION_SCHEMAS)) {
    data[name] = readInto(courseDir, name, COLLECTIONS[name as CollectionName], schema, issues);
  }

  const sharedConcepts = readShared(root, SHARED_CONCEPTS, Concept, issues);
  const sharedCapabilities = readShared(root, SHARED_CAPABILITIES, Capability, issues);
  const sharedUsers = readShared(root, SHARED_USERS, User, issues);

  if (sharedConcepts.length) {
    data.concepts = pullSharedConcepts(data.concepts!, sharedConcepts, referencedConcepts(data));
  }
  if (sharedCapabilities.length) {
    const have = new Set(data.capabilities!.map((capability) => capability.capability_id));
    const wanted = referencedCapabilities(data);
    data.capabilities = [
      ...data.capabilities!,
      ...sharedCapabilities.filter(
        (capability: any) => wanted.has(capability.capability_id) && !have.has(capability.capability_id),
      ),
    ];
  }
  if (sharedUsers.length) {
    const have = new Set(data.users!.map((user) => user.user_id));
    data.users = [...data.users!, ...sharedUsers.filter((user: any) => !have.has(user.user_id))];
  }

  return { bundle: { course, ...data } as CourseBundle, issues };
};
