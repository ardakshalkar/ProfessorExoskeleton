/** PostgreSQL-backed CourseStore over the canonical CourseBundle read model. */

import { COLLECTION_NAMES, COLLECTION_SCHEMAS, OMIT_WHEN_EMPTY, type CourseBundle } from "../bundle.ts";
import { IssueList } from "../issues.ts";
import type { LoadResult } from "../loader.ts";
import { Course } from "../model/academic.ts";
import { RUNTIME_TABLES, buildScript, deleteRuntime } from "../sqlgen.ts";
import { LoadedCourseStore } from "./course.ts";

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
}

export const READ_BUNDLES_SQL = `
SELECT course_code, format_version, payload
  FROM content.course_bundle_read_models
 ORDER BY course_code
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

/** Runs one flush's SQL as a single transaction. */
export type Commit = (sql: string) => Promise<void>;

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
 * A failed flush leaves the writes pending, so the next flush tries them again.
 */
export class PostgresCourseStore extends LoadedCourseStore {
  private readonly commit: Commit;

  constructor(
    courses: Iterable<readonly [string, LoadResult]>,
    commit: Commit,
    options: { root?: string; label?: string } = {},
  ) {
    super(courses, options);
    this.commit = commit;
  }

  override async flush(): Promise<void> {
    const pending = this.pendingCourses();
    if (!pending.length) return;
    let sql = "";
    for (const { bundle, removed } of pending) {
      for (const [collection, codes] of removed) {
        if (RUNTIME_TABLES[collection]) sql += deleteRuntime(collection, codes);
      }
      sql += buildScript(bundle as unknown as CourseBundle, { transaction: false }) + "\n";
    }
    await this.commit(sql);
    this.settle(pending.map((entry) => entry.courseId));
  }
}

const storeOptions = (options: { documentRoot?: string; label?: string }) => ({
  root: options.documentRoot,
  label: options.label ?? "PostgreSQL CourseBundle read model",
});

/**
 * Load the tenant-visible read models into the synchronous engine boundary.
 * Row-level security on the supplied SQL client decides which courses appear.
 * A flush runs its script on the same client, wrapped in `BEGIN`/`COMMIT`.
 */
export const loadPostgresCourseStore = async (
  client: SqlClient,
  options: { documentRoot?: string; label?: string } = {},
): Promise<PostgresCourseStore> => {
  const result = await client.query<BundleRow>(READ_BUNDLES_SQL);
  return new PostgresCourseStore(
    result.rows.map((row) => [row.course_code, parsePayload(row)] as const),
    async (sql) => {
      await client.query(`BEGIN;\n${sql}\nCOMMIT;`);
    },
    storeOptions(options),
  );
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
  const rows = await withIdentityClient(pool, identity, (client) => client.query<BundleRow>(READ_BUNDLES_SQL));
  return new PostgresCourseStore(
    rows.rows.map((row) => [row.course_code, parsePayload(row)] as const),
    async (sql) => {
      await withIdentityClient(pool, identity, async (client) => {
        await client.query(sql);
      });
    },
    storeOptions(options),
  );
};
