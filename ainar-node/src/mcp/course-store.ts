/** Storage adapters for the read engine.
 *
 * A store returns a CourseBundle-shaped LoadResult. The engine and MCP tools do
 * not care whether that bundle came from YAML, PostgreSQL or a test double.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { discoverCourses, loadCourse, type LoadResult } from "../loader.ts";
import { IssueList } from "../issues.ts";

export interface CourseStore {
  /** A filesystem root for resolving repository-backed documents, if any. */
  readonly root?: string;
  /** Human-readable source name for diagnostics and list_courses. */
  readonly label: string;
  courseIds(): string[];
  load(courseId: string): LoadResult;
}

/** The newest mtime under a course directory, or zero when it is unreadable. */
const newestMtime = (directory: string): number => {
  let newest = 0;
  const walk = (path: string): void => {
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return;
    }
    if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
  };
  walk(directory);
  return newest;
};

/** Personal/offline mode: authored YAML with mtime-based cache invalidation. */
export class YamlCourseStore implements CourseStore {
  readonly root: string;
  readonly label: string;
  private loaded = new Map<string, { result: LoadResult; stamp: number }>();

  constructor(root: string) {
    this.root = root;
    this.label = root;
  }

  courseIds(): string[] {
    return discoverCourses(this.root).map((path) => path.split(/[\\/]/).pop()!);
  }

  load(courseId: string): LoadResult {
    const directory = join(this.root, "courses", courseId);
    const stamp = newestMtime(directory);
    const cached = this.loaded.get(courseId);
    if (cached && cached.stamp === stamp) return cached.result;

    const result = loadCourse(directory, this.root);
    this.loaded.set(courseId, { result, stamp });
    return result;
  }
}

/** An already-loaded store, used by database snapshots and tests. */
export class LoadedCourseStore implements CourseStore {
  readonly root?: string;
  readonly label: string;
  private readonly courses: Map<string, LoadResult>;

  constructor(
    courses: Iterable<readonly [string, LoadResult]>,
    options: { root?: string; label?: string } = {},
  ) {
    this.courses = new Map(courses);
    this.root = options.root;
    this.label = options.label ?? "loaded CourseBundle store";
  }

  courseIds(): string[] {
    return [...this.courses.keys()].sort();
  }

  load(courseId: string): LoadResult {
    const found = this.courses.get(courseId);
    if (found) return found;
    const issues = new IssueList();
    issues.error("course.missing", `no course '${courseId}' in ${this.label}`, courseId);
    return { bundle: null, issues };
  }
}
