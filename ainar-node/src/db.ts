/**
 * `ainar db` — the live route into PostgreSQL that `ainar sql` stops short of.
 *
 *     ainar db status            reachable? schema loaded? which courses and runs
 *     ainar db init              create the database if missing, apply the schema
 *     ainar db push [COURSE]     run each course's import script in one transaction
 *
 * The SQL is exactly what `ainar sql` writes to `dist/`: `schemaSql()` and
 * `buildScript()`. Nothing here generates SQL of its own, so a reviewed import
 * file and a push cannot disagree. Both are idempotent — `CREATE … IF NOT
 * EXISTS` and `INSERT … ON CONFLICT DO UPDATE` — so running either twice is
 * the same as running it once.
 *
 * The connection is one `DATABASE_URL`, resolved like every other credential
 * (`resolveVariable`: the environment, then `~/.dsh/.credentials.yaml`), never
 * a flag and never a file in a course workspace. A plain connection string is
 * also what Supabase hands out, so moving there is changing that one value
 * (with `?sslmode=require`) and running `db init` against it.
 */

import type { SqlClient } from "./store/postgres.ts";

export const DATABASE_URL_ENV = "DATABASE_URL";

/** The schemas `schema.sql` creates. All five present is "schema loaded". */
const SCHEMAS = ["academic", "delivery", "assessment", "learning", "content"];

/** `postgresql://user@host:port/db`, the password left out so it can be printed. */
export const describeTarget = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    const user = url.username ? `${decodeURIComponent(url.username)}@` : "";
    return `${url.protocol}//${user}${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "(DATABASE_URL is not a URL)";
  }
};

/** The same server, its maintenance database — where CREATE DATABASE is run from. */
export const maintenanceTarget = (connectionString: string): { url: string; database: string } => {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  url.pathname = "/postgres";
  return { url: url.toString(), database };
};

export interface DbStatus {
  schemaLoaded: boolean;
  missingSchemas: string[];
  courses: string[];
  runs: string[];
}

export const readStatus = async (client: SqlClient): Promise<DbStatus> => {
  const present = await client.query<{ schema_name: string }>(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)",
    [SCHEMAS],
  );
  const have = new Set(present.rows.map((row) => row.schema_name));
  const missingSchemas = SCHEMAS.filter((name) => !have.has(name));
  if (missingSchemas.length) return { schemaLoaded: false, missingSchemas, courses: [], runs: [] };

  const courses = await client.query<{ code: string }>("SELECT code FROM academic.courses ORDER BY code");
  const runs = await client.query<{ code: string }>("SELECT code FROM delivery.course_versions ORDER BY code");
  return {
    schemaLoaded: true,
    missingSchemas,
    courses: courses.rows.map((row) => row.code),
    runs: runs.rows.map((row) => row.code),
  };
};

/**
 * The status as lines, with the drift against the workspace: what is authored
 * and not pushed, and what is in the database with nothing here authoring it
 * (usually a course from another workspace — reported, never deleted).
 */
export const formatStatus = (
  target: string,
  status: DbStatus,
  workspace: { courses: string[]; runs: string[] },
): string[] => {
  const lines = [`database   ${target}  reachable`];
  if (!status.schemaLoaded) {
    lines.push(`schema     absent (${status.missingSchemas.join(", ")} missing) — \`ainar db init\` writes it`);
    return lines;
  }
  lines.push("schema     loaded");
  const section = (label: string, inDb: string[], authored: string[]) => {
    const db = new Set(inDb);
    const here = new Set(authored);
    for (const code of [...new Set([...inDb, ...authored])].sort()) {
      const where = db.has(code) && here.has(code) ? "" : db.has(code) ? "  (database only)" : "  (workspace only)";
      lines.push(`${label.padEnd(10)} ${code}${where}`);
    }
  };
  section("course", status.courses, workspace.courses);
  section("run", status.runs, workspace.runs);
  const behind = [
    ...workspace.courses.filter((code) => !status.courses.includes(code)),
    ...workspace.runs.filter((code) => !status.runs.includes(code)),
  ];
  if (behind.length) lines.push("", `NOT YET IN THE DATABASE: ${behind.join(", ")} — \`ainar db push\``);
  return lines;
};
