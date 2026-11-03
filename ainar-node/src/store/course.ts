/** Storage adapters for the engine.
 *
 * A store returns a CourseBundle-shaped LoadResult, and takes records back by
 * collection. The engine and MCP tools do not care whether that bundle came
 * from YAML, PostgreSQL or a test double, nor where a record they write lands.
 */

import { type FSWatcher, readdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { Document } from "yaml";
import { ID_FIELDS } from "../approval.ts";
import { COLLECTION_SCHEMAS } from "../collections.ts";
import { COLLECTIONS, discoverCourses, loadCourse, type LoadResult } from "../loader.ts";
import { IssueList } from "../issues.ts";
import { type EditResult, editRecords, setRecordFields } from "../record-edit.ts";
import {
  type PlaceContext,
  RECORD_FILES,
  recordFile,
  removeRecords,
  tidy,
  writeRecords,
} from "../records-write.ts";
import { courseWrites } from "./written.ts";

type Record_ = Record<string, unknown>;

/** Records by collection, as `writeRecords` takes them. */
export type RecordsByCollection = Iterable<[string, Record_[]]> | Record<string, Record_[]>;

export interface WriteOptions extends PlaceContext {
  /** A regeneration: a replaced record keeps the `approval` it had. */
  keepApproval?: boolean;
}

/**
 * One edit per identifier, handed the record as a `yaml` node and the document
 * it sits in — the shape `editRecords` has always handed its callers, so an
 * edit written against a file works unchanged against any store.
 */
export type RecordEdits = Map<string, (node: any, document: any) => void>;

export interface CourseStore {
  /** A filesystem root for resolving repository-backed documents, if any. */
  readonly root?: string;
  /** Human-readable source name for diagnostics and list_courses. */
  readonly label: string;
  courseIds(): string[];
  load(courseId: string): LoadResult;
  /**
   * Upsert records, replacing any with the same id. Returns where they went:
   * file paths for YAML, `courses/<id>/<file>` locations otherwise.
   */
  write(courseId: string, records: RecordsByCollection, options?: WriteOptions): string[];
  /** Take ainar-written runtime records out, by id. Returns how many went. */
  remove(courseId: string, collection: string, ids: Iterable<string>): number;
  /** Edit records where they are. Throws, having changed nothing, when an id is not found. */
  edit(courseId: string, collection: string, edits: RecordEdits): EditResult;
  /**
   * Set top-level scalar fields — `setRecordFields` for a file, which leaves
   * every other byte of a hand-authored record as it was.
   */
  setFields(courseId: string, collection: string, edits: Map<string, Record<string, string | number>>): EditResult;
  /**
   * Make every write so far durable. YAML writes are durable when they return;
   * a database store holds them in its snapshot until this commits them.
   */
  flush(): Promise<void>;
}

/**
 * The store a library write goes to: the one its caller works in, or — for a
 * caller that passed none, a test say — the YAML files under `root`. The CLI
 * and the pane always pass theirs, so a workspace over a database writes there.
 */
export const writeStore = (root: string, store?: CourseStore): CourseStore => store ?? new YamlCourseStore(root);

/** The entries of a `RecordsByCollection`, whichever of its two shapes it came in. */
const entriesOf = (records: RecordsByCollection): [string, Record_[]][] =>
  Symbol.iterator in Object(records)
    ? [...(records as Iterable<[string, Record_[]]>)]
    : Object.entries(records as Record<string, Record_[]>);

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
  private watching: boolean;
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

  /** `writeRecords` into the course folder; the next load sees it through `noteCourseWrite`. */
  write(courseId: string, records: RecordsByCollection, options: WriteOptions = {}): string[] {
    return writeRecords(join(this.root, "courses", courseId), records, options);
  }

  remove(courseId: string, collection: string, ids: Iterable<string>): number {
    return removeRecords(join(this.root, "courses", courseId), collection, ids);
  }

  /** `editRecords` over the files the loader reads this collection from. */
  edit(courseId: string, collection: string, edits: RecordEdits): EditResult {
    return editRecords({ ...this.where(courseId, collection), edits });
  }

  setFields(courseId: string, collection: string, edits: Map<string, Record<string, string | number>>): EditResult {
    return setRecordFields({ ...this.where(courseId, collection), edits });
  }

  /** Where a collection's records can be, as `record-edit.ts` takes it. */
  private where(courseId: string, collection: string) {
    const patterns = COLLECTIONS[collection as keyof typeof COLLECTIONS];
    const idField = ID_FIELDS[collection];
    if (!patterns || !idField) throw new Error(`${collection} has no records that can be edited by id`);
    return { root: this.root, courseId, patterns, idField, collection };
  }

  /** Every write above is on disk when it returns. */
  async flush(): Promise<void> {}

  /**
   * Stop watching. `unref` is not enough on Linux: Node's recursive watch
   * there is one watcher per directory, and those keep the process alive
   * (seen in CI, where a test file never exited). A store that is done
   * closes; loads after this walk every time, as a store that never watched.
   */
  close(): void {
    for (const seen of this.watched.values()) seen.watcher?.close();
    this.watched.clear();
    this.watching = false;
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

/** What a loaded store holds that it has not flushed, per course. */
export interface PendingCourse {
  courseId: string;
  bundle: Record<string, unknown>;
  /** Ids taken out since the last flush, by collection. */
  removed: Map<string, Set<string>>;
}

/**
 * An already-loaded store, used by database snapshots and tests.
 *
 * Writes land in the snapshot, so a load after a write reads it back, and are
 * held there as pending until `flush`. Here flushing only forgets them; the
 * PostgreSQL store (store/postgres.ts) commits them first. Every record is
 * parsed against its collection's schema before the snapshot changes — what
 * the loader would refuse on the way in from a file is refused on the way in
 * here, and a refusal changes nothing.
 */
export class LoadedCourseStore implements CourseStore {
  readonly root?: string;
  readonly label: string;
  private readonly courses: Map<string, LoadResult>;
  private readonly pendingByCourse = new Map<string, PendingCourse>();

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

  write(courseId: string, records: RecordsByCollection, options: WriteOptions = {}): string[] {
    const bundle = this.bundleOf(courseId);
    const next: Record<string, unknown[]> = {};
    const locations = new Set<string>();
    for (const [collection, items] of entriesOf(records)) {
      if (!items.length) continue;
      const field = ID_FIELDS[collection];
      const list = [...((next[collection] ?? bundle[collection] ?? []) as Record_[])];
      for (const item of items) {
        // Resolved first, so a record with no place is refused as the file store refuses it.
        locations.add(`courses/${courseId}/${recordFile(collection, item, options)}`);
        const identifier = field ? item[field] : undefined;
        const at = identifier === undefined ? -1 : list.findIndex((entry) => entry?.[field!] === identifier);
        let record = item;
        if (at >= 0 && options.keepApproval) {
          const previous = list[at]!.approval;
          const { approval: _dropped, ...rest } = item;
          record = previous === undefined ? rest : { ...rest, approval: previous };
        }
        const parsed = this.parsed(collection, tidy(record));
        if (at >= 0) list[at] = parsed;
        else list.push(parsed);
      }
      next[collection] = list;
    }
    Object.assign(bundle, next);
    if (Object.keys(next).length) this.pending(courseId, bundle);
    return [...locations];
  }

  /** Only the ainar-written runtime collections, as `removeRecords` allows. */
  remove(courseId: string, collection: string, ids: Iterable<string>): number {
    const file = RECORD_FILES[collection];
    const field = ID_FIELDS[collection];
    if (typeof file !== "string" || !file.startsWith("records/") || !field) {
      throw new Error(`${collection} is not a collection records can be removed from`);
    }
    const bundle = this.bundleOf(courseId);
    const wanted = new Set(ids);
    const list = (bundle[collection] ?? []) as Record_[];
    const kept = list.filter((entry) => !wanted.has(entry?.[field] as string));
    const removed = list.length - kept.length;
    if (!removed) return 0;
    const gone = list.filter((entry) => wanted.has(entry?.[field] as string)).map((entry) => entry[field] as string);
    bundle[collection] = kept;
    const pending = this.pending(courseId, bundle);
    const ledger = pending.removed.get(collection) ?? new Set<string>();
    for (const id of gone) ledger.add(id);
    pending.removed.set(collection, ledger);
    return removed;
  }

  /**
   * Each record is handed to its edit as a `yaml` document built from it, so
   * an edit written for a file — `setIn`, `deleteIn`, `document.createNode` —
   * runs as it does there. What comes back is parsed before anything changes.
   */
  edit(courseId: string, collection: string, edits: RecordEdits): EditResult {
    if (!edits.size) return { written: [], count: 0 };
    const field = ID_FIELDS[collection];
    if (!field) throw new Error(`${collection} has no records that can be edited by id`);
    const bundle = this.bundleOf(courseId);
    const list = [...((bundle[collection] ?? []) as Record_[])];
    const indexOf = (id: string) => list.findIndex((entry) => String(entry?.[field]) === id);
    const missing = [...edits.keys()].filter((id) => indexOf(id) < 0);
    if (missing.length) {
      throw new Error(
        `No ${collection} record in ${this.label} for ${courseId} holds ` +
          `${missing.sort().join(", ")}. Nothing was written.`,
      );
    }
    for (const [id, edit] of edits) {
      const at = indexOf(id);
      const document = new Document(list[at]);
      edit(document.contents, document);
      list[at] = this.parsed(collection, document.toJS());
    }
    bundle[collection] = list;
    this.pending(courseId, bundle);
    return { written: [`courses/${courseId}/${collection}`], count: edits.size };
  }

  /** A snapshot keeps no formatting to protect, so setting a field is an edit. */
  setFields(courseId: string, collection: string, edits: Map<string, Record<string, string | number>>): EditResult {
    return this.edit(
      courseId,
      collection,
      new Map(
        [...edits].map(([id, fields]) => [
          id,
          (node: any) => {
            for (const [field, value] of Object.entries(fields)) node.set(field, value);
          },
        ]),
      ),
    );
  }

  /** Nothing to commit to; the writes stay in the snapshot and stop being pending. */
  async flush(): Promise<void> {
    this.pendingByCourse.clear();
  }

  /** The courses written since the last flush, for a subclass that commits them. */
  protected pendingCourses(): PendingCourse[] {
    return [...this.pendingByCourse.values()];
  }

  protected settle(courseIds: Iterable<string>): void {
    for (const courseId of courseIds) this.pendingByCourse.delete(courseId);
  }

  private bundleOf(courseId: string): Record<string, unknown> {
    const bundle = this.courses.get(courseId)?.bundle;
    if (!bundle) throw new Error(`${courseId} is not loaded in ${this.label}; nothing was written.`);
    return bundle as unknown as Record<string, unknown>;
  }

  private parsed(collection: string, record: unknown): Record_ {
    const schema = (COLLECTION_SCHEMAS as Record<string, { safeParse: (value: unknown) => any }>)[collection];
    if (!schema) throw new Error(`${collection} is not a collection of a course bundle`);
    const result = schema.safeParse(record);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(
        `${collection} record would not load: ${issue.path.join(".") || "(record)"}: ${issue.message}. ` +
          "Nothing was written.",
      );
    }
    return result.data as Record_;
  }

  private pending(courseId: string, bundle: Record<string, unknown>): PendingCourse {
    let entry = this.pendingByCourse.get(courseId);
    if (!entry) {
      entry = { courseId, bundle, removed: new Map() };
      this.pendingByCourse.set(courseId, entry);
    }
    return entry;
  }
}
