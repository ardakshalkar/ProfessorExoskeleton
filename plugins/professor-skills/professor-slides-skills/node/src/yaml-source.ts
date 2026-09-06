/**
 * Reading a course directory in the AINAR layout.
 *
 * The glob patterns are the contract with that layout and are copied verbatim
 * from `ProfessorHarness/node/src/loader.ts`, narrowed to the collections a
 * presentation needs. Copied rather than paraphrased on purpose: a course that
 * loads there must load identically here, and a pattern quietly dropped would
 * mean a collection that is silently empty — no readings, no scheduled
 * meeting — which looks exactly like a course that has none.
 *
 * What is deliberately not read: submissions, evaluations, evidence, concept
 * states, enrolments. A deck is built from what the course claims, and student
 * records have no business being loaded by a tool that renders slides.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseAllDocuments } from "yaml";

/** Collection name in the bundle, and the files it is read from. */
const COLLECTIONS: Record<string, string[]> = {
  outcomes: ["outcomes.yaml", "outcomes/*.yaml"],
  concepts: ["concepts.yaml", "concepts/*.yaml"],
  concept_edges: ["concept-edges.yaml"],
  modules: ["modules.yaml", "modules/*.yaml"],
  versions: ["versions/*/version.yaml"],
  activities: ["versions/*/activities.yaml", "versions/*/activities/*.yaml"],
  resources: ["versions/*/resources.yaml", "versions/*/resources/*.yaml"],
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Paths matching a pattern with at most one `*` per segment.
 *
 * Deliberately not a glob library: these seven patterns are the whole
 * requirement, and a dependency here would be a dependency in the one code
 * path that has to work on a machine with nothing installed.
 */
export function expand(root: string, pattern: string): string[] {
  let paths = [root];
  for (const segment of pattern.split("/")) {
    const next: string[] = [];
    for (const path of paths) {
      if (!segment.includes("*")) {
        const candidate = join(path, segment);
        if (existsSync(candidate)) next.push(candidate);
        continue;
      }
      if (!isDirectory(path)) continue;
      const matcher = new RegExp(`^${segment.split("*").map((part) =>
        part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
      for (const entry of readdirSync(path).sort()) {
        if (matcher.test(entry)) next.push(join(path, entry));
      }
    }
    paths = next;
  }
  return paths.filter((path) => !isDirectory(path));
}

/** Every YAML document in a file — the layout allows several per file. */
function documentsIn(path: string): unknown[] {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  return parseAllDocuments(text)
    .map((document) => document.toJS({ maxAliasCount: -1 }))
    .filter((value) => value !== null && value !== undefined);
}

export interface DirectoryRead {
  bundle: Record<string, unknown>;
  /** Every file that contributed, for the provenance report. */
  files: string[];
  /** Problems worth telling the professor about, not worth stopping for. */
  warnings: string[];
}

/**
 * One course directory as a bundle-shaped object, ready for `fromBundle`.
 *
 * A file that will not parse is a warning rather than a failure. The commonest
 * cause is a half-finished edit in one week's activities, and refusing to
 * outline the other fifteen weeks over it helps nobody — but it is reported,
 * because a silently skipped file is a silently missing meeting.
 */
export function readCourseDirectory(courseDirectory: string): DirectoryRead {
  const bundle: Record<string, unknown> = {};
  const files: string[] = [];
  const warnings: string[] = [];

  const coursePath = join(courseDirectory, "course.yaml");
  if (!existsSync(coursePath)) {
    throw new Error(`${courseDirectory} has no course.yaml, so it is not a course directory.`);
  }
  bundle.course = documentsIn(coursePath)[0] ?? {};
  files.push(coursePath);

  for (const [name, patterns] of Object.entries(COLLECTIONS)) {
    const collected: unknown[] = [];
    for (const pattern of patterns) {
      for (const path of expand(courseDirectory, pattern)) {
        let documents: unknown[];
        try {
          documents = documentsIn(path);
        } catch (error) {
          warnings.push(`${path}: ${String((error as Error).message ?? error).split("\n")[0]}`);
          continue;
        }
        files.push(path);
        for (const document of documents) {
          if (Array.isArray(document)) {
            collected.push(...document);
          } else if (document && typeof document === "object") {
            const record = document as Record<string, unknown>;
            // `versions/*/version.yaml` is one record per file; every other
            // file wraps its rows in a key named after the collection.
            const wrapped = record[name];
            if (Array.isArray(wrapped)) collected.push(...wrapped);
            else collected.push(record);
          }
        }
      }
    }
    bundle[name] = collected;
  }

  return { bundle, files, warnings };
}

/** Course directories under a workspace, by course identifier. */
export function coursesIn(workspace: string): string[] {
  const root = join(workspace, "courses");
  if (!isDirectory(root)) return [];
  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((path) => isDirectory(path) && existsSync(join(path, "course.yaml")))
    .map((path) => basename(path))
    .sort();
}
