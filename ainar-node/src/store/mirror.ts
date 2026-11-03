/**
 * One store the authority, another kept equal to it.
 *
 * `MirroredCourseStore` wraps the store that decides what a course says — the
 * primary — and after every flush brings a replica in line with it. Which is
 * which is the caller's to say (`openCourseStore`, store/open.ts), not this
 * file's: today the primary is the YAML under `courses/` and the replica is
 * PostgreSQL, so git, hand edits and the assistant's skills stay the
 * authority and the database is always current for whoever reads it there.
 * When the database becomes the authority, the same wrapper takes a
 * PostgreSQL primary and a replica that writes the files.
 *
 * What reaches the replica is the whole course as the primary now holds it,
 * not the individual writes: a skill that edits a file never passes through
 * here, and the watcher (`watch`) is how its change is noticed. A course that
 * fails to reach the replica is said, never thrown — the primary has the
 * change, and the professor's work is not undone because a copy is behind.
 */

import { type FSWatcher, watch } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { CourseBundle } from "../bundle.ts";
import type { EditResult } from "../record-edit.ts";
import { buildScript, pruneRuntime } from "../sqlgen.ts";
import { validate } from "../validate.ts";
import type { CourseStore, RecordEdits, RecordsByCollection, WriteOptions } from "./course.ts";

/** Something kept equal to the primary, one whole course at a time. */
export interface CourseReplica {
  readonly label: string;
  /** Make the replica's copy of the course `bundle`. Throws when it cannot. */
  replicate(courseId: string, bundle: CourseBundle): Promise<void>;
}

/** How a course last fared on its way to the replica. */
export interface Replicated {
  at: string;
  ok: boolean;
  message: string;
}

/**
 * PostgreSQL kept equal to the files: the course's import script and the
 * removal of runtime rows the files no longer hold, in one transaction. A
 * course that does not validate is not sent — the database's constraints
 * would refuse it part-way, and an invalid course is the files' to fix.
 *
 * A client per course, connected and closed around it, so a CLI process that
 * mirrored one write is not kept alive by an idle pool.
 */
export class PostgresReplica implements CourseReplica {
  readonly label: string;
  private readonly connectionString: string;
  private readonly root: string | undefined;

  constructor(connectionString: string, options: { label: string; root?: string }) {
    this.connectionString = connectionString;
    this.label = options.label;
    this.root = options.root;
  }

  async replicate(courseId: string, bundle: CourseBundle): Promise<void> {
    const errors = validate(bundle, { root: this.root }).errors;
    if (errors.length) {
      throw new Error(`${courseId} does not validate (${errors.length} error(s), first: ${errors[0]!.message}), so it was not sent`);
    }
    const pg = createRequire(import.meta.url)("pg");
    const client = new pg.Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(buildScript(bundle, { transaction: false }) + "\n" + pruneRuntime(bundle));
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      await client.end().catch(() => {});
    }
  }
}

/** How long the watcher lets a burst of file changes settle before it sends. */
const SETTLE_MS = 1500;

export class MirroredCourseStore implements CourseStore {
  readonly primary: CourseStore;
  readonly replica: CourseReplica;
  /** Each course's last trip to the replica, for a status line. */
  readonly replicated = new Map<string, Replicated>();
  private readonly say: (line: string) => void;
  private readonly dirty = new Set<string>();
  private running: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watcher: FSWatcher | null = null;

  constructor(primary: CourseStore, replica: CourseReplica, options: { say?: (line: string) => void } = {}) {
    this.primary = primary;
    this.replica = replica;
    this.say = options.say ?? (() => {});
  }

  get root(): string | undefined {
    return this.primary.root;
  }

  get label(): string {
    return `${this.primary.label}, mirrored to ${this.replica.label}`;
  }

  courseIds(): string[] {
    return this.primary.courseIds();
  }

  load(courseId: string) {
    return this.primary.load(courseId);
  }

  write(courseId: string, records: RecordsByCollection, options?: WriteOptions): string[] {
    return this.changed(courseId, this.primary.write(courseId, records, options));
  }

  remove(courseId: string, collection: string, ids: Iterable<string>): number {
    return this.changed(courseId, this.primary.remove(courseId, collection, ids));
  }

  edit(courseId: string, collection: string, edits: RecordEdits): EditResult {
    return this.changed(courseId, this.primary.edit(courseId, collection, edits));
  }

  setFields(courseId: string, collection: string, edits: Map<string, Record<string, string | number>>): EditResult {
    return this.changed(courseId, this.primary.setFields(courseId, collection, edits));
  }

  /** The primary's flush, then every changed course to the replica. */
  async flush(): Promise<void> {
    this.cancelTimer();
    await this.primary.flush();
    await this.replicateDirty();
  }

  /** Send every course once — on start, when what changed while nothing watched is unknown. */
  catchUp(): Promise<void> {
    for (const courseId of this.primary.courseIds()) this.dirty.add(courseId);
    return this.replicateDirty();
  }

  /**
   * Notice changes made around the store — a skill editing a file, a hand
   * edit, a `git pull` — and send the course once they settle. Only for a
   * primary on disk; one with no root has nothing to watch.
   */
  watch(): void {
    const root = this.primary.root;
    if (this.watcher || !root) return;
    try {
      this.watcher = watch(join(root, "courses"), { recursive: true }, (_event, filename) => {
        const courseId = String(filename ?? "").split(/[\\/]/)[0];
        if (!courseId) return;
        this.dirty.add(courseId);
        this.schedule();
      });
      this.watcher.on("error", () => this.close());
      this.watcher.unref();
    } catch (error) {
      this.say(`not watching ${root} for changes to mirror: ${(error as Error).message}`);
    }
  }

  close(): void {
    this.watcher?.close();
    this.watcher = null;
    this.cancelTimer();
  }

  private changed<Result>(courseId: string, result: Result): Result {
    this.dirty.add(courseId);
    this.schedule();
    return result;
  }

  private schedule(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.replicateDirty();
    }, SETTLE_MS);
    this.timer.unref?.();
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One at a time: a second call waits for the first, then sends what is left. */
  private replicateDirty(): Promise<void> {
    this.running = this.running.then(async () => {
      const known = new Set(this.primary.courseIds());
      const courses = [...this.dirty].filter((courseId) => known.has(courseId));
      this.dirty.clear();
      for (const courseId of courses) {
        const at = new Date().toISOString();
        const { bundle, issues } = this.primary.load(courseId);
        if (!bundle) {
          const message = `${courseId} would not load, so it was not mirrored: ${issues.errors[0]?.message ?? "unknown"}`;
          this.replicated.set(courseId, { at, ok: false, message });
          this.say(message);
          continue;
        }
        try {
          await this.replica.replicate(courseId, bundle);
          this.replicated.set(courseId, { at, ok: true, message: `${courseId} mirrored to ${this.replica.label}` });
        } catch (error) {
          const message = `${courseId} not mirrored to ${this.replica.label}: ${(error as Error).message}`;
          this.replicated.set(courseId, { at, ok: false, message });
          this.say(message);
        }
      }
    });
    return this.running;
  }
}
