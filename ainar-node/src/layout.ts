/**
 * Moving a course off the `versions/<TERM>/` layout, and retiring a finished run.
 *
 * A workspace holds one run of one course. It did not always: a course
 * directory used to be a container of offerings, each under its own
 * `versions/<TERM>/`, and every glob in `loader.ts` began with that prefix. The
 * level said the same thing in every path it appeared in, so it is gone —
 * `version.yaml` sits beside `course.yaml` and still carries the term.
 *
 * Two commands, and they are deliberately not one. `migrate-layout` is the
 * one-way move a workspace makes once. `archive-run` is the thing a professor
 * does every December.
 *
 * Neither deletes anything a person wrote. `migrate-layout` moves files and
 * reports what it would not touch; `archive-run` copies text out and then
 * clears only the collections it has copied. Both refuse before they write
 * rather than half-way through, because a half-migrated workspace loads as a
 * course with most of its records missing, which reads exactly like data loss.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, relative } from "node:path";

/** What a move did, for the caller to print. */
export interface Moved {
  from: string;
  to: string;
}

export interface MigrateResult {
  moved: Moved[];
  /** Paths left alone, with the reason — backups, ad hoc archives, leftovers. */
  left: { path: string; why: string }[];
  /** Files whose recorded paths were rewritten, and how many in each. */
  rewritten: { path: string; references: number }[];
}

/** `.bak`, `.superseded` and friends: a person's own filing, not ours to move. */
const isLeftover = (name: string): boolean =>
  name.startsWith(".") || /\.bak(-|\.|$)|~$|\.orig$/i.test(name);

const entriesOf = (dir: string): string[] => {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
};

/** Every YAML file under a directory, at any depth. */
const yamlFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const name of entriesOf(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...yamlFiles(full));
    else if (/\.ya?ml$/i.test(name)) found.push(full);
  }
  return found;
};

/**
 * Move `courses/<ID>/versions/<TERM>/*` up into `courses/<ID>/`.
 *
 * Refuses a course with more than one term directory. That workspace held two
 * offerings at once, which the new layout cannot express, and picking one for
 * the professor would silently orphan the other — `archive-run` the finished
 * one first, then migrate.
 */
export const migrateLayout = (
  courseDir: string,
  options: { dryRun?: boolean } = {},
): MigrateResult => {
  const { dryRun = false } = options;
  const versionsDir = join(courseDir, "versions");
  const result: MigrateResult = { moved: [], left: [], rewritten: [] };

  if (!existsSync(versionsDir)) return result;

  const terms = entriesOf(versionsDir).filter((name) => {
    const full = join(versionsDir, name);
    if (!statSync(full).isDirectory()) return false;
    if (isLeftover(name)) {
      result.left.push({ path: full, why: "not a term directory" });
      return false;
    }
    return true;
  });

  if (terms.length > 1) {
    throw new Error(
      `${relative(dirname(courseDir), courseDir)} holds ${terms.length} terms ` +
        `(${terms.join(", ")}), and a workspace holds one run. Archive the finished ` +
        "ones with `ainar archive-run` first, then migrate.",
    );
  }

  for (const name of entriesOf(versionsDir)) {
    const full = join(versionsDir, name);
    if (!terms.includes(name)) {
      if (!result.left.some((entry) => entry.path === full)) {
        result.left.push({ path: full, why: "not a term directory" });
      }
      continue;
    }
    for (const entry of entriesOf(full)) {
      const from = join(full, entry);
      const to = join(courseDir, entry);
      if (isLeftover(entry)) {
        result.left.push({ path: from, why: "a backup or hidden file" });
        continue;
      }
      if (existsSync(to)) {
        throw new Error(
          `${to} already exists, so ${from} has nowhere to land. Resolve the ` +
            "collision by hand; nothing was moved.",
        );
      }
      result.moved.push({ from, to });
    }
  }

  // A `storage_key` with no scheme is a path in the workspace, and the live
  // course has forty of them spelling out `versions/<TERM>/materials/…`. Moving
  // the files without rewriting these turns every material into
  // `document.missing_file` — the move is only half the migration.
  const [term] = terms;
  if (term) {
    const courseId = basename(courseDir);
    const stale = `courses/${courseId}/versions/${term}/`;
    const fresh = `courses/${courseId}/`;
    for (const file of yamlFiles(courseDir)) {
      const text = readFileSync(file, "utf-8");
      const references = text.split(stale).length - 1;
      if (!references) continue;
      result.rewritten.push({ path: file, references });
      if (!dryRun) writeFileSync(file, text.split(stale).join(fresh), "utf-8");
    }
  }

  if (dryRun) return result;

  for (const { from, to } of result.moved) renameSync(from, to);
  // Only when the professor's own leftovers are not still sitting in it, which
  // is why this checks rather than passing `recursive` and hoping.
  for (const dir of [...new Set(result.moved.map(({ from }) => dirname(from))), versionsDir]) {
    if (existsSync(dir) && entriesOf(dir).length === 0) rmdirSync(dir);
  }
  return result;
};

// --------------------------------------------------------------------------
// Archiving a finished offering
// --------------------------------------------------------------------------

/** Collections copied into an archive, as filenames relative to the course. */
const ARCHIVED_FILES = [
  "version.yaml",
  "enrollments.yaml",
  "activities.yaml",
  "documents.yaml",
  "resources.yaml",
  "assessments.yaml",
];

/** Directories copied whole, text and all. */
const ARCHIVED_DIRS = ["assessments", "items", "item-models", "activities", "documents", "resources", "records", "samples"];

/**
 * Directories split file by file rather than taken whole.
 *
 * A term's records are kilobytes of YAML and stay greppable forever. Its
 * rendered decks and imported PDFs are not, and they are the only reason an
 * archive would grow without bound.
 *
 * So the split is by what a file IS, not by which directory it sits in:
 * `materials/` holds the deck markdown, the figure SVGs and the build scripts
 * next to the `.pptx` and `.pdf` they produce. The sources are the archive —
 * they are small, they diff, and a deck that is genuinely wanted again renders
 * from them. The renders are named in the manifest and left where they are.
 */
const SPLIT_DIRS = ["materials"];

/** Extensions archived in full. Everything else is named in the manifest. */
const TEXT = new Set([
  ".md", ".markdown", ".txt", ".yaml", ".yml", ".json", ".csv", ".tsv",
  ".py", ".js", ".ts", ".sql", ".svg", ".html", ".css", ".ipynb", ".tex",
]);

const isText = (path: string): boolean => TEXT.has(extname(path).toLowerCase());

export interface ArchiveResult {
  /** Where the archive was written. */
  archiveDir: string;
  /** Text files copied in. */
  copied: string[];
  /** Files recorded in the manifest instead of copied. */
  manifested: { path: string; bytes: number; sha256: string }[];
  /** Live paths cleared afterwards. */
  cleared: string[];
}

const walkFiles = (dir: string, base = dir): string[] => {
  const found: string[] = [];
  for (const name of entriesOf(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walkFiles(full, base));
    else found.push(relative(base, full).split(/[\\/]/).join("/"));
  }
  return found;
};

const copyInto = (from: string, to: string, copied: string[], root: string): void => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied.push(relative(root, from).split(/[\\/]/).join("/"));
};

/**
 * Pack a finished offering into `archive/<TERM>/` and clear the live record.
 *
 * `archive/` sits at the workspace root, outside `courses/`, so it is outside
 * every glob the loader has — an archived term is inert by construction rather
 * than by a flag something has to remember to check.
 */
export const archiveRun = (
  options: { root: string; courseDir: string; term: string; dryRun?: boolean },
): ArchiveResult => {
  const { root, courseDir, term, dryRun = false } = options;
  const archiveDir = join(root, "archive", term);
  const result: ArchiveResult = { archiveDir, copied: [], manifested: [], cleared: [] };

  if (existsSync(archiveDir)) {
    throw new Error(`${archiveDir} already exists. Nothing was archived.`);
  }

  for (const name of ARCHIVED_FILES) {
    const from = join(courseDir, name);
    if (!existsSync(from)) continue;
    if (!dryRun) copyInto(from, join(archiveDir, name), result.copied, courseDir);
    else result.copied.push(name);
    result.cleared.push(name);
  }

  for (const name of ARCHIVED_DIRS) {
    const dir = join(courseDir, name);
    if (!existsSync(dir)) continue;
    for (const relativePath of walkFiles(dir)) {
      const from = join(dir, relativePath);
      if (!dryRun) copyInto(from, join(archiveDir, name, relativePath), result.copied, courseDir);
      else result.copied.push(`${name}/${relativePath}`);
    }
    result.cleared.push(name);
  }

  for (const name of SPLIT_DIRS) {
    const dir = join(courseDir, name);
    if (!existsSync(dir)) continue;
    for (const relativePath of walkFiles(dir)) {
      const full = join(dir, relativePath);
      if (isText(full)) {
        if (!dryRun) copyInto(full, join(archiveDir, name, relativePath), result.copied, courseDir);
        else result.copied.push(`${name}/${relativePath}`);
        continue;
      }
      const bytes = statSync(full).size;
      const sha256 = createHash("sha256").update(readFileSync(full)).digest("hex");
      result.manifested.push({ path: `${name}/${relativePath}`, bytes, sha256 });
    }
  }

  if (dryRun) return result;

  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(
    join(archiveDir, "MANIFEST.yaml"),
    manifest(term, result),
    { encoding: "utf-8" },
  );

  for (const name of result.cleared) {
    rmSync(join(courseDir, name), { recursive: true, force: true });
  }
  return result;
};

const manifest = (term: string, result: ArchiveResult): string => {
  const lines = [
    "# Written by `ainar archive-run`.",
    "#",
    "# Everything text in this offering was copied in beside this file. The",
    "# binaries were not: each is listed below with its size and checksum, so a",
    "# file can be identified if it turns up again, and a deck can be re-rendered",
    "# from the markdown that IS here.",
    "",
    `term: ${term}`,
    `archived_at: ${new Date().toISOString()}`,
    `files_copied: ${result.copied.length}`,
    "binaries:",
  ];
  if (!result.manifested.length) lines.push("  []");
  for (const entry of result.manifested) {
    lines.push(`  - path: ${entry.path}`);
    lines.push(`    bytes: ${entry.bytes}`);
    lines.push(`    sha256: ${entry.sha256}`);
  }
  return lines.join("\n") + "\n";
};
