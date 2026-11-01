/** Storage adapters for the read engine.
 *
 * A store returns a CourseBundle-shaped LoadResult. The engine and MCP tools do
 * not care whether that bundle came from YAML, PostgreSQL or a test double.
 */

import { type FSWatcher, readdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { discoverCourses, loadCourse, type LoadResult } from "../loader.ts";
import { IssueList } from "../issues.ts";
import { courseWrites } from "./written.ts";

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

/**
 * How long a watching store trusts a quiet folder before walking it anyway:
 * the cover for a watch event that never came.
 */
const TRUST_MS = 30_000;

/** What a watching store knows about one course folder since it last walked it. */
interface Watched {
  watcher: FSWatcher | null;
  /** Something under the folder moved since the last walk. */
  moved: boolean;
  /** `courseWrites()` at the last walk. */
  writes: number;
  walkedAt: number;
}

/**
 * Personal/offline mode: authored YAML with mtime-based cache invalidation.
 *
 * Each `load` walks the course folder for its newest mtime — every file
 * stat'ed, about 20 ms for a course of 400 files on a synced folder. A
 * process that loads once (the CLI) pays it once. One that loads a dozen
 * times a request (the pane, docs/PANE-SPEED.md) passes `{ watch: true }`:
 * then the folder is watched and walked again only when something under it
 * moved, when this process wrote a course file (store/written.ts — a watch
 * event arrives too late for a route that reads its own write back), or
 * after `TRUST_MS` of quiet. What the walk decides is unchanged.
 */
export class YamlCourseStore implements CourseStore {
  readonly root: string;
  readonly label: string;
  private loaded = new Map<string, { result: LoadResult; stamp: number }>();
  private readonly watching: boolean;
  private watched = new Map<string, Watched>();

  constructor(root: string, options: { watch?: boolean } = {}) {
    this.root = root;
    this.label = root;
    this.watching = options.watch === true;
  }

  courseIds(): string[] {
    return discoverCourses(this.root).map((path) => path.split(/[\\/]/).pop()!);
  }

  load(courseId: string): LoadResult {
    const directory = join(this.root, "courses", courseId);
    const cached = this.loaded.get(courseId);
    if (cached && this.quiet(courseId)) return cached.result;
    const stamp = this.walk(courseId, directory);
    if (cached && cached.stamp === stamp) return cached.result;

    const result = loadCourse(directory, this.root);
    this.loaded.set(courseId, { result, stamp });
    return result;
  }

  /** Whether a watching store may skip the walk: nothing moved, nothing written, not quiet for long. */
  private quiet(courseId: string): boolean {
    const seen = this.watched.get(courseId);
    if (!seen || !seen.watcher) return false;
    return !seen.moved && seen.writes === courseWrites() && Date.now() - seen.walkedAt < TRUST_MS;
  }

  /** The newest mtime, and — when watching — the folder's watch, started on the first walk. */
  private walk(courseId: string, directory: string): number {
    if (!this.watching) return newestMtime(directory);
    let seen = this.watched.get(courseId);
    if (!seen) {
      seen = { watcher: null, moved: true, writes: -1, walkedAt: 0 };
      const entry = seen;
      try {
        entry.watcher = watch(directory, { recursive: true }, () => {
          entry.moved = true;
        });
        // A watch that fails later is no watch: every load walks again.
        entry.watcher.on("error", () => {
          entry.watcher?.close();
          entry.watcher = null;
        });
        entry.watcher.unref();
      } catch {
        entry.watcher = null;
      }
      this.watched.set(courseId, entry);
    }
    // Cleared before the walk, so a change during it counts for the next load.
    seen.moved = false;
    seen.writes = courseWrites();
    seen.walkedAt = Date.now();
    return newestMtime(directory);
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
