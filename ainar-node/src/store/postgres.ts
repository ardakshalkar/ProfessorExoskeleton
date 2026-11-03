/** PostgreSQL-backed CourseStore over the canonical CourseBundle read model. */

import { COLLECTION_NAMES, COLLECTION_SCHEMAS, OMIT_WHEN_EMPTY, type CourseBundle } from "../bundle.ts";
import { IssueList } from "../issues.ts";
import type { LoadResult } from "../loader.ts";
import { Course } from "../model/academic.ts";
import { RUNTIME_TABLES, buildScript, deleteRuntime } from "../sqlgen.ts";
import { LoadedCourseStore, WriteConflictError, rebase } from "./course.ts";

export interface SqlQueryResult<Row> {
  rows: Row[];
}

/** Implemented structurally by pg.Pool, pg.Client and transaction clients. */
export interface SqlClient {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlQueryResult<Row>>;
}

export interface TransactionSqlClient extends SqlClient {
  release(): void;
}

export interface SqlPool extends SqlClient {
  connect(): Promise<TransactionSqlClient>;
}

export interface OAuthIdentity {
  issuer: string;
  subject: string;
}

export const withIdentityClient = async <Result>(
  pool: SqlPool,
  identity: OAuthIdentity,
  operation: (client: TransactionSqlClient) => Promise<Result>,
): Promise<Result> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resolved = await client.query<{ user_id: string }>(RESOLVE_IDENTITY_SQL, [
      identity.issuer,
      identity.subject,
    ]);
    const userId = resolved.rows[0]?.user_id;
    if (!userId) throw new Error("OAuth identity is not linked to an AINAR user");
    await client.query("SELECT set_config('ainar.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original authorization/database error.
    }
    throw error;
  } finally {
    client.release();
  }
};

interface BundleRow extends Record<string, unknown> {
  course_code: string;
  format_version: string;
  payload: unknown;
  /** Raised by the database on every write to the row; a bigint, so it arrives as text. */
  revision?: unknown;
}

export const READ_BUNDLES_SQL = `
SELECT course_code, format_version, payload, revision
  FROM content.course_bundle_read_models
 ORDER BY course_code
`;

/** One course's row, locked until the transaction ends: a second flusher waits here. */
export const LOCK_BUNDLE_SQL = `
SELECT course_code, format_version, payload, revision
  FROM content.course_bundle_read_models
 WHERE course_code = $1
   FOR UPDATE
`;

export const REVISION_SQL = `
SELECT revision
  FROM content.course_bundle_read_models
 WHERE course_code = $1
`;

export const RESOLVE_IDENTITY_SQL = `
SELECT user_id::text AS user_id
  FROM delivery.user_identities
 WHERE issuer = $1 AND subject = $2
`;

const parsePayload = (row: BundleRow): LoadResult => {
  const issues = new IssueList();
  let envelope: any = row.payload;
  if (typeof envelope === "string") {
    try {
      envelope = JSON.parse(envelope);
    } catch (error) {
      issues.error("postgres.bundle_json", `invalid JSON: ${(error as Error).message}`, row.course_code);
      return { bundle: null, issues };
    }
  }

  if (!envelope || typeof envelope !== "object") {
    issues.error("postgres.bundle_shape", "payload is not a JSON object", row.course_code);
    return { bundle: null, issues };
  }
  if (envelope.format !== "ainar.course-bundle") {
    issues.error("postgres.bundle_format", `unsupported format ${String(envelope.format)}`, row.course_code);
  }
  if (String(envelope.format_version) !== "1" || String(row.format_version) !== "1") {
    issues.error(
      "postgres.bundle_version",
      `unsupported format version ${String(envelope.format_version)}`,
      row.course_code,
    );
  }
  if (envelope.course_id !== row.course_code) {
    issues.error(
      "postgres.bundle_course",
      `row is ${row.course_code} but payload is ${String(envelope.course_id)}`,
      row.course_code,
    );
  }

  const parsedCourse = Course.safeParse(envelope.course);
  if (!parsedCourse.success) {
    for (const issue of parsedCourse.error.issues) {
      issues.error("postgres.bundle_entity", issue.message, `course.${issue.path.join(".")}`);
    }
  }

  const data: Record<string, unknown[]> = {};
  for (const name of COLLECTION_NAMES) {
    // A collection newer than the payload format (`OMIT_WHEN_EMPTY` in
    // bundle.ts) is left out when empty, and absent reads as empty.
    const collection = envelope[name] ?? (OMIT_WHEN_EMPTY.has(name) ? [] : undefined);
    if (!Array.isArray(collection)) {
      issues.error("postgres.bundle_collection", `${name} is not an array`, row.course_code);
      data[name] = [];
      continue;
    }
    const schema = COLLECTION_SCHEMAS[name];
    data[name] = collection.flatMap((entry: unknown, index: number) => {
      const result = schema.safeParse(entry);
      if (result.success) return [result.data];
      for (const issue of result.error.issues) {
        issues.error(
          "postgres.bundle_entity",
          issue.message,
          `${name}.${index}.${issue.path.join(".")}`,
        );
      }
      return [];
    });
  }

  if (!parsedCourse.success || issues.errors.length) return { bundle: null, issues };
  return { bundle: { course: parsedCourse.data, ...data } as CourseBundle, issues };
};

/** Runs `work` inside one transaction on one connection, committing only when it returns. */
export type Transact = <Result>(work: (client: SqlClient) => Promise<Result>) => Promise<Result>;

/**
 * A transaction on `client`. A pool is asked for one connection first: its
 * `query` may hand each statement to a different one, and a `BEGIN` on one
 * connection does not hold the next statement on another.
 */
const transactOn = (client: SqlClient | SqlPool): Transact => async (work) => {
  const connection = "connect" in client && typeof client.connect === "function" ? await client.connect() : null;
  const on: SqlClient = connection ?? client;
  try {
    await on.query("BEGIN");
    const result = await work(on);
    await on.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await on.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    connection?.release();
  }
};

/**
 * The read models as a snapshot that takes writes.
 *
 * The engine is synchronous and a database is not, so a write lands in the
 * snapshot at once — the next load reads it back, as it would from a file —
 * and `flush` commits it. A flush writes each touched course whole, through
 * the same `buildScript` that `ainar sql` emits: every statement an upsert,
 * the relational rows first and the read model last, in one transaction, so
 * the database never holds a read model its rows do not back. Removed runtime
 * records are deleted by code before that, because the import never deletes
 * student work on its own.
 *
 * Two writers do not overwrite each other. Each course's row carries a
 * revision the database raises on every write (schema.sql); the store
 * remembers the one it loaded. A flush locks the row first, so a second
 * flusher waits, and reads the revision under the lock. Unmoved, the store's
 * copy is current and is written. Moved, somebody else wrote in between: the
 * store's changes are made again onto their course (`rebase`), and written
 * when none of the records it changed were changed by them too — otherwise
 * the flush refuses with a `WriteConflictError`, writes nothing for that
 * course, and the store takes their course as its own, so the next load reads
 * what is really there.
 *
 * One transaction per course, so one course's conflict does not hold back
 * another's changes. A flush that fails for any other reason — a lost
 * connection — leaves the writes pending, so the next flush tries them again.
 */
export class PostgresCourseStore extends LoadedCourseStore {
  private readonly transact: Transact;
  private readonly revisions: Map<string, string>;

  constructor(
    courses: Iterable<readonly [string, LoadResult]>,
    revisions: Iterable<readonly [string, string]>,
    transact: Transact,
    options: { root?: string; label?: string } = {},
  ) {
    super(courses, options);
    this.revisions = new Map(revisions);
    this.transact = transact;
  }

  /** The revision of a course this store holds, as the database numbered it. */
  revisionOf(courseId: string): string | undefined {
    return this.revisions.get(courseId);
  }

  override async flush(): Promise<void> {
    for (const pending of this.pendingCourses()) {
      const { courseId } = pending;
      let committed: { bundle: Record<string, unknown>; revision: string };
      try {
        committed = await this.transact(async (client) => {
          const locked = (await client.query<BundleRow>(LOCK_BUNDLE_SQL, [courseId])).rows[0];
          if (!locked) throw new Error(`${courseId} is not in the database any more, or not to this professor; nothing was written.`);
          let bundle = pending.bundle;
          if (String(locked.revision) !== this.revisions.get(courseId)) {
            const fresh = parsePayload(locked);
            if (!fresh.bundle) {
              throw new Error(`${courseId} in the database would not load: ${fresh.issues.errors[0]?.message ?? "unknown"}; nothing was written.`);
            }
            try {
              bundle = rebase(pending, fresh.bundle as unknown as Record<string, unknown>);
            } catch (error) {
              if (error instanceof WriteConflictError) this.revisions.set(courseId, String(locked.revision));
              throw error;
            }
          }
          let sql = "";
          for (const [collection, codes] of pending.removed) {
            if (RUNTIME_TABLES[collection]) sql += deleteRuntime(collection, codes);
          }
          sql += buildScript(bundle as unknown as CourseBundle, { transaction: false });
          await client.query(sql);
          // Read back rather than assumed: the trigger numbers it.
          const after = (await client.query<{ revision: unknown }>(REVISION_SQL, [courseId])).rows[0];
          return { bundle, revision: String(after?.revision) };
        });
      } catch (error) {
        if (error instanceof WriteConflictError) this.adopt(courseId, error.fresh);
        throw error;
      }
      this.adopt(courseId, committed.bundle);
      this.revisions.set(courseId, committed.revision);
    }
  }
}

const storeOptions = (options: { documentRoot?: string; label?: string }) => ({
  root: options.documentRoot,
  label: options.label ?? "PostgreSQL CourseBundle read model",
});

const storeFrom = (rows: BundleRow[], transact: Transact, options: { documentRoot?: string; label?: string }) =>
  new PostgresCourseStore(
    rows.map((row) => [row.course_code, parsePayload(row)] as const),
    rows.map((row) => [row.course_code, String(row.revision)] as const),
    transact,
    storeOptions(options),
  );

/**
 * Load the tenant-visible read models into the synchronous engine boundary.
 * Row-level security on the supplied SQL client decides which courses appear.
 * A flush runs in a transaction on the same client — on one connection of it,
 * when it is a pool.
 */
export const loadPostgresCourseStore = async (
  client: SqlClient | SqlPool,
  options: { documentRoot?: string; label?: string } = {},
): Promise<PostgresCourseStore> => {
  const result = await client.query<BundleRow>(READ_BUNDLES_SQL);
  return storeFrom(result.rows, transactOn(client), options);
};

/**
 * Resolve an OAuth subject and establish a transaction-local PostgreSQL user.
 * RLS policies read `ainar.user_id`; SET LOCAL prevents identity leakage when
 * the pooled connection is returned and reused for another professor. A flush
 * opens a transaction of its own under the same identity, since the one the
 * load ran in has committed.
 */
export const loadPostgresCourseStoreForIdentity = async (
  pool: SqlPool,
  identity: OAuthIdentity,
  options: { documentRoot?: string; label?: string } = {},
): Promise<PostgresCourseStore> => {
  const result = await withIdentityClient(pool, identity, (client) => client.query<BundleRow>(READ_BUNDLES_SQL));
  return storeFrom(result.rows, (work) => withIdentityClient(pool, identity, work), options);
};
