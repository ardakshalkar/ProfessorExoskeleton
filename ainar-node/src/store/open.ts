/**
 * Which store a workspace runs on — the one place that decides.
 *
 * The CLI and the pane both open their store here, so where a course lives is
 * one setting, read once, rather than a question each caller answers. Two
 * values, resolved like every other credential (the environment, then
 * `~/.dsh/.credentials.yaml`):
 *
 *     AINAR_DATABASE_WORKSPACE   the workspace root connected to DATABASE_URL
 *     AINAR_DATABASE_ROLE        what the database is to it: `mirror` (the default)
 *
 * Connected by naming the workspace, not by `DATABASE_URL` being set: that URL
 * is set for every process on the machine, and the test suites build throwaway
 * workspaces that must never reach the professor's database. A workspace that
 * is not the named one runs on its files alone, as before.
 *
 * `mirror`: the files are the authority, the database a copy kept current
 * (store/mirror.ts). `authority` — the database decides, the files are the
 * copy — is the next step and is refused until it is built; it changes this
 * function and nothing that calls it.
 */

import { resolve } from "node:path";
import { describeTarget } from "../db.ts";
import { resolveVariable } from "../connections/store.ts";
import { type CourseStore, YamlCourseStore } from "./course.ts";
import { MirroredCourseStore, PostgresReplica } from "./mirror.ts";

export const DATABASE_WORKSPACE_ENV = "AINAR_DATABASE_WORKSPACE";
export const DATABASE_ROLE_ENV = "AINAR_DATABASE_ROLE";
export const DATABASE_ROLES = ["mirror", "authority"] as const;
export type DatabaseRole = (typeof DATABASE_ROLES)[number];

export interface DatabaseConnection {
  role: DatabaseRole;
  connectionString: string;
  /** The target without its password, for saying where things went. */
  target: string;
}

/** Two roots as one folder: resolved, separators and (on Windows) case set aside. */
const sameRoot = (left: string, right: string): boolean => {
  const norm = (path: string) => {
    const full = resolve(path).replace(/[\\/]+$/, "");
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  return norm(left) === norm(right);
};

/** The database this workspace is connected to, or null when it runs on its files alone. */
export const databaseFor = (root: string): DatabaseConnection | null => {
  const named = resolveVariable(DATABASE_WORKSPACE_ENV)?.value?.trim();
  if (!named || !sameRoot(named, root)) return null;
  const connectionString = resolveVariable("DATABASE_URL")?.value?.trim();
  if (!connectionString) {
    throw new Error(`${DATABASE_WORKSPACE_ENV} names ${root}, but DATABASE_URL is not set, so there is no database to connect it to.`);
  }
  const role = (resolveVariable(DATABASE_ROLE_ENV)?.value?.trim() || "mirror") as DatabaseRole;
  if (!DATABASE_ROLES.includes(role)) {
    throw new Error(`${DATABASE_ROLE_ENV} is ${role}; it is one of ${DATABASE_ROLES.join(", ")}.`);
  }
  return { role, connectionString, target: describeTarget(connectionString) };
};

/**
 * The store for a workspace root. `watch` is the pane's: a long-lived process
 * that keeps the YAML parse cached, and — when mirrored — notices files the
 * store did not write and sends them on. `say` hears what did not reach the
 * database; the write itself has already happened.
 */
export const openCourseStore = (
  root: string,
  options: { watch?: boolean; say?: (line: string) => void } = {},
): CourseStore => {
  const files = new YamlCourseStore(root, { watch: options.watch === true });
  const database = databaseFor(root);
  if (!database) return files;
  if (database.role === "authority") {
    throw new Error(
      `${DATABASE_ROLE_ENV}=authority is not built yet: the database cannot decide for ${root} until a PostgreSQL ` +
        "primary with a file replica exists. Set it to mirror, or leave it unset.",
    );
  }
  const mirrored = new MirroredCourseStore(files, new PostgresReplica(database.connectionString, { label: database.target, root }), {
    say: options.say,
  });
  if (options.watch) {
    // Long-lived: whatever changed while nothing watched is sent once on open.
    mirrored.watch();
    void mirrored.catchUp();
  }
  return mirrored;
};
