/**
 * The right column's one read of its own: what changed in the course lately,
 * and how many records still say `approval: draft`.
 *
 * The inspector beside the chat answers "what has this conversation — or
 * anyone — just done to the course", which no view payload carries: they are
 * about the course as it stands, not about which records moved. So this walks
 * `courses/` the way the revision walk does, newest first, and reads each
 * file only for the few fields a line needs — its id, its title, its approval.
 *
 * It does not say WHICH session wrote a file. Nothing on disk records that,
 * and a list labelled "this chat" that included another session's writes
 * would be a claim the data cannot back. The line says when, and the column
 * says "Recent changes".
 *
 * What it reads, and what it does not: the draft count is the store's parsed
 * course, which every other view has already paid for. The list is the
 * newest files by date, and only those are read — a small file parsed as it
 * always was, a large file that is the only file of its collection in the
 * course (`records/evidence.yaml`, 4.4 MB on CSS-4007) answered from the
 * store's records of that collection, which are exactly that file's. Until
 * 2026-10-25 this parsed every YAML under `courses/` a second time, about
 * five seconds on CSS-4007, on the pane's first load.
 *
 * Cached on the revision: the answer cannot change until the revision does.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { COLLECTION_FILES } from "@ainar/core/src/collections.ts";
import { parse as parseYaml } from "yaml";

import { revisionDocument } from "./workspace.js";

/** How many lines the column lists. */
const SHOWN = 12;

/** The id field a record is known by: the collection's own, else the first `*_id`. */
const idOf = (record) => {
  if (!record || typeof record !== "object") return null;
  for (const key of ["assessment_id", "module_id", "activity_id", "concept_id", "outcome_id", "resource_id", "document_id", "evaluation_id", "submission_id", "course_version_id", "course_id"]) {
    if (typeof record[key] === "string") return record[key];
  }
  for (const [key, value] of Object.entries(record)) {
    if (key.endsWith("_id") && typeof value === "string") return value;
  }
  return null;
};

const titleOf = (record) => {
  if (!record || typeof record !== "object") return null;
  for (const key of ["title", "name", "label", "statement"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
};

/** Every YAML under `courses/`, with its mtime; the revision walk's bounds. */
const listFiles = (root) => {
  const found = [];
  const walk = (directory, depth) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!/\.ya?ml$/i.test(entry.name)) continue;
      try {
        const stats = statSync(full);
        found.push({ full, mtime: stats.mtimeMs, size: stats.size });
      } catch {
        continue;
      }
    }
  };
  walk(join(root, "courses"), 0);
  return found;
};

/** One file as the column's line, or several when the file is a list of records. */
const linesOf = (root, file) => {
  let parsed;
  try {
    parsed = parseYaml(readFileSync(file.full, "utf8"));
  } catch {
    return [];
  }
  const path = relative(root, file.full).split(sep).join("/");
  if (!parsed || typeof parsed !== "object") return [];
  // A records file is `{ <collection>: [records] }` — `assessments:`,
  // `evaluations:` — and the key is the kind. A file that is one record
  // (`version.yaml`) is named by its file.
  const groups = idOf(parsed) === null ? Object.entries(parsed).filter(([, value]) => Array.isArray(value) && value.some((entry) => entry && typeof entry === "object")) : [];
  const sets = groups.length
    ? groups
    : [[path.split("/").pop().replace(/\.ya?ml$/i, ""), [parsed]]];
  const lines = [];
  for (const [collection, records] of sets) {
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      lines.push({
        path,
        collection,
        id: idOf(record),
        title: titleOf(record),
        // `approval: draft` only: a suggested mark is counted where marks
        // are (the inspector's "marks wait"), not twice.
        draft: record.approval === "draft",
        changed_at: new Date(file.mtime).toISOString(),
      });
    }
  }
  return lines;
};

/** Above this a file is answered from the store when it can be, not parsed. */
const LARGE = 256 * 1024;

/** The loader's glob, `*` within one path segment, as a test on a course-relative path. */
const patternTest = (pattern) =>
  new RegExp("^" + pattern.split("/").map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("/") + "$");

const PATTERNS = Object.entries(COLLECTION_FILES).map(([collection, patterns]) => [collection, patterns.map(patternTest)]);

/**
 * The collection a course file is the only source of, or null: one
 * collection reads it, and no other file of that course is read into that
 * collection. Then the store's records of that collection are this file's.
 */
const soleSourceOf = (relativePath, courseFiles) => {
  const readers = PATTERNS.filter(([, tests]) => tests.some((test) => test.test(relativePath)));
  if (readers.length !== 1) return null;
  const [collection, tests] = readers[0];
  const sources = courseFiles.filter((path) => tests.some((test) => test.test(path)));
  return sources.length === 1 ? collection : null;
};

/** One large file's lines, from the store's records of its collection. */
const linesFromStore = (root, file, records, collection) => {
  const path = relative(root, file.full).split(sep).join("/");
  const changed_at = new Date(file.mtime).toISOString();
  return records
    .filter((record) => record && typeof record === "object")
    .map((record) => ({ path, collection, id: idOf(record), title: titleOf(record), draft: record.approval === "draft", changed_at }));
};

const CACHE = new Map();

/**
 * @param workspace - the course workspace, whose store holds the parsed course.
 * @param root - the workspace folder.
 * @returns `{ recent: [...SHOWN lines, newest first], drafts, drafts_by }` —
 *   `drafts_by` the count per kind, largest first: 445 machine-read answers
 *   and two assessments are not one sentence.
 */
export const recentDocument = (workspace, root) => {
  const { revision } = revisionDocument(root);
  const cached = CACHE.get(root);
  if (cached && cached.revision === revision) return cached.value;

  // Every course as the store has it parsed; a course that will not load
  // counts no drafts, as a file that would not parse counted none.
  const bundles = new Map();
  for (const courseId of workspace.courseIds()) {
    try {
      const loaded = workspace.load(courseId);
      if (loaded.bundle) bundles.set(courseId, loaded.bundle);
    } catch {
      continue;
    }
  }

  let drafts = 0;
  const byKind = new Map();
  for (const bundle of bundles.values()) {
    for (const [collection, records] of Object.entries(bundle)) {
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (!record || record.approval !== "draft") continue;
        drafts += 1;
        byKind.set(collection, (byKind.get(collection) || 0) + 1);
      }
    }
  }

  const files = listFiles(root).sort((a, b) => b.mtime - a.mtime);
  const courseFiles = new Map();
  const relativeTo = (courseId, full) => relative(join(root, "courses", courseId), full).split(sep).join("/");
  const recent = [];
  for (const file of files) {
    if (recent.length >= SHOWN) break;
    let lines = null;
    if (file.size > LARGE) {
      const courseId = relative(join(root, "courses"), file.full).split(sep)[0];
      const bundle = bundles.get(courseId);
      if (bundle) {
        if (!courseFiles.has(courseId)) {
          courseFiles.set(courseId, files.filter((entry) => relativeTo(courseId, entry.full).split("/")[0] !== "..").map((entry) => relativeTo(courseId, entry.full)));
        }
        const collection = soleSourceOf(relativeTo(courseId, file.full), courseFiles.get(courseId));
        if (collection && Array.isArray(bundle[collection])) lines = linesFromStore(root, file, bundle[collection], collection);
      }
    }
    lines ??= linesOf(root, file);
    // A file of many records (a roster, a list of concepts) is one change,
    // not forty: its first record names it.
    if (lines.length) {
      recent.push(lines.length === 1 ? lines[0] : { ...lines[0], id: null, title: null, records: lines.length, draft: lines.some((line) => line.draft) });
    }
  }
  const drafts_by = [...byKind].map(([collection, count]) => ({ collection, count })).sort((a, b) => b.count - a.count);
  const value = { recent, drafts, drafts_by };
  CACHE.set(root, { revision, value });
  return value;
};
