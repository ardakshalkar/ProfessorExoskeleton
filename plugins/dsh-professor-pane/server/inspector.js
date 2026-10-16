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
 * Cached on the revision: the walk is cheap, the parse of every record is
 * not, and the answer cannot change until the revision does.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

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
        found.push({ full, mtime: statSync(full).mtimeMs });
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

const CACHE = new Map();

/**
 * @param root - the workspace folder.
 * @returns `{ recent: [...SHOWN lines, newest first], drafts, drafts_by }` —
 *   `drafts_by` the count per kind, largest first: 445 machine-read answers
 *   and two assessments are not one sentence.
 */
export const recentDocument = (root) => {
  const { revision } = revisionDocument(root);
  const cached = CACHE.get(root);
  if (cached && cached.revision === revision) return cached.value;

  const files = listFiles(root).sort((a, b) => b.mtime - a.mtime);
  let drafts = 0;
  const byKind = new Map();
  const recent = [];
  for (const file of files) {
    const lines = linesOf(root, file);
    for (const line of lines) {
      if (!line.draft) continue;
      drafts += 1;
      byKind.set(line.collection, (byKind.get(line.collection) || 0) + 1);
    }
    // A file of many records (a roster, a list of concepts) is one change,
    // not forty: its first record names it.
    if (recent.length < SHOWN && lines.length) {
      recent.push(lines.length === 1 ? lines[0] : { ...lines[0], id: null, title: null, records: lines.length, draft: lines.some((line) => line.draft) });
    }
  }
  const drafts_by = [...byKind].map(([collection, count]) => ({ collection, count })).sort((a, b) => b.count - a.count);
  const value = { recent, drafts, drafts_by };
  CACHE.set(root, { revision, value });
  return value;
};
