/**
 * Finding the course: a database link first, then YAML, then a single file.
 *
 * The order is the professor's expectation — the shared database is the copy
 * everyone else is looking at, so if there is one it is the truth — but the
 * order is not the interesting part. The interesting part is that *the answer
 * says which source produced it*.
 *
 * A fallback is a very good way to hide a failure. A Supabase link that is
 * merely unreachable, silently followed by a course directory that was last
 * pulled in March, produces a deck built from March's outcomes that is
 * indistinguishable from one built from today's. So every attempt that did not
 * answer is recorded on `provenance.attempted`, and every surface that prints a
 * course prints where it came from.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { courseDsn, loadEnvironment, type Environment } from "./env.ts";
import {
  fromBundle,
  fromFlatFile,
  type AttemptRecord,
  type CourseSource,
  type Origin,
  type Provenance,
} from "./model.ts";
import {
  connect,
  failureTtl,
  fetchBundle,
  forgetRoute,
  listCourses,
  readCachedDsn,
  recordUnreachable,
  redact,
  unreachableRecently,
  writeCachedDsn,
  DatabaseUnreachable,
} from "./supabase.ts";
import { coursesIn, readCourseDirectory } from "./yaml-source.ts";
import { formatMs, noteTiming, timed } from "./timing.ts";
import type { SourcePreference } from "./route.ts";

export interface ResolveOptions {
  /** The course identifier, e.g. `CSS-4008`. */
  course?: string;
  /** The run, as `CSS-4008-2026-FALL` or just `2026-FALL`. */
  version?: string;
  /** A single flat `course.yaml`, when the professor names one. */
  courseFile?: string;
  /** Force one source instead of trying all three, for diagnosis. */
  only?: Origin;
  /**
   * Which sources are in play, as a preference rather than a diagnosis.
   *
   *   `auto`      the database, then a course directory, then a flat file.
   *   `database`  the database and nothing else. A failure is an error, never
   *               a quiet fallback onto whatever a directory last held.
   *   `local`     skip the database. What FAST mode uses, and what a professor
   *               working on a train wants.
   *
   * Separate from `only` because they answer different questions. `only` is for
   * diagnosing a fallback and forces exactly one origin; this expresses what
   * the professor wants to happen, and `local` still tries two places.
   */
  source?: SourcePreference;
  /** Probe the database even if it was recently found unreachable. */
  freshRoute?: boolean;
  /** Where the search starts. */
  cwd?: string;
}

export interface Resolved {
  source: CourseSource;
  /** Non-fatal problems found while reading — unparseable files, mostly. */
  warnings: string[];
}

const now = (): string => new Date().toISOString();

const provenance = (
  origin: Origin,
  detail: string,
  attempted: AttemptRecord[],
): Provenance => ({ origin, detail, attempted, read_at: now() });

/** A course directory under a workspace, or null if there is no such course. */
function locateCourseDirectory(workspace: string, course: string | undefined): string | null {
  if (course) {
    const direct = join(workspace, "courses", course);
    return existsSync(join(direct, "course.yaml")) ? direct : null;
  }
  const found = coursesIn(workspace);
  // With one course there is nothing to choose; with several, choosing for the
  // professor is how a deck ends up attached to the wrong course.
  return found.length === 1 ? join(workspace, "courses", found[0]!) : null;
}

/** A flat `course.yaml`, by explicit path or in the working directory. */
function locateFlatFile(cwd: string, courseFile: string | undefined): string | null {
  if (courseFile) {
    const path = isAbsolute(courseFile) ? courseFile : resolve(cwd, courseFile);
    return existsSync(path) ? path : null;
  }
  for (const name of ["course.yaml", "course.yml", "presentation-course.yaml"]) {
    const path = resolve(cwd, name);
    if (existsSync(path)) return path;
  }
  return null;
}

async function tryDatabase(
  environment: Environment,
  options: ResolveOptions,
  attempted: AttemptRecord[],
): Promise<Resolved | null> {
  const configured = courseDsn(environment);
  if (!configured) {
    attempted.push({
      origin: "supabase",
      why: "no course database is configured (PRES_COURSE_URL, SUPABASE_DB_URL or SUPABASE_URL)",
    });
    return null;
  }
  if (!options.course) {
    attempted.push({
      origin: "supabase",
      why: `a database is configured (${configured.key}) but no --course was given, and the read model is keyed by course code`,
    });
    return null;
  }

  // A database that did not answer a minute ago will not answer now, and the
  // difference between saying so immediately and finding out again is the
  // difference between a command that takes 40 ms and one that takes six
  // seconds — paid once per `pres` call, several times per deck. The record
  // expires, and `--source database` and `--fresh-route` both retry regardless:
  // a cache that could not be overridden would hide a database coming back.
  // `--source database` always probes. It is the flag a professor reaches for
  // when they have just reconnected and want the shared copy, and the message
  // the cache prints tells them to reach for it — a cache that then refused to
  // retry would be a cache that lies.
  const retryAnyway = options.freshRoute || options.source === "database";
  if (!retryAnyway) {
    const failed = unreachableRecently(configured.dsn);
    if (failed) {
      noteSkip(`unreachable ${formatMs(failed.ageMs)} ago`);
      attempted.push({
        origin: "supabase",
        why:
          `skipped: nothing answered ${formatMs(failed.ageMs)} ago, and that is remembered for ` +
          `${formatMs(failureTtl())} so every command after the first is instant instead of slow ` +
          `(${failed.why}). Retry now with --source database, or --fresh-route.`,
      });
      return null;
    }
  } else {
    forgetRoute(configured.dsn);
  }

  const cached = readCachedDsn(configured.dsn);
  const dsn = cached ?? configured.dsn;

  try {
    const { client, route } = await timed(
      cached ? "database connect (cached route)" : "database probe",
      () => connect(dsn, { probe: cached === null }),
    );
    try {
      const payload = await fetchBundle(client, options.course);
      if (!payload) {
        // Distinguish "this database serves other courses" from "nobody has
        // imported anything into it". The second is the commoner state and the
        // one whose fix is a command, so it is worth naming.
        const available = await listCourses(client).catch(() => [] as string[]);
        attempted.push({
          origin: "supabase",
          why: available.length
            ? `reached ${route.label}, which serves ${available.join(", ")} but not '${options.course}'`
            : `reached ${route.label}, but content.course_bundle_read_models is empty — the schema is ` +
              "deployed and no course has been imported into it yet (in ProfessorHarness: `ainar sql`)",
        });
        return null;
      }
      // Only worth writing once it has actually served a course: a route that
      // connects and then cannot answer is not a route worth remembering.
      if (route.pooled && route.dsn !== cached) writeCachedDsn(configured.dsn, route.dsn);
      const detail = `${route.label}${route.pooled ? " (pooler)" : ""}, via ${configured.key}`;
      // An unverified certificate is encryption without identity. It is what
      // libpq's `sslmode=require` has always meant and what the Python original
      // did silently, and it is reported here rather than silently, because a
      // professor on a network that re-signs traffic should know that is what
      // this is.
      const warnings = route.verified === false
        ? [
            `the certificate at ${route.label} was not verified — the connection is encrypted but ` +
            "the server's identity was not checked. Something on this network re-signs TLS, or " +
            "Supabase's chain is not in this machine's trust store.",
          ]
        : [];
      return {
        source: fromBundle(payload, provenance("supabase", detail, attempted), options.version),
        warnings,
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    const reason = error instanceof DatabaseUnreachable
      ? [error.message, ...error.attempts.map((line) => `  ${line}`)].join("\n")
      : String((error as Error).message ?? error);
    // Remembered, so the next command in this session is instant. Only a real
    // failure to reach it: `pg` not being installed is a missing dependency, not
    // an unreachable database, and caching it would hide the install.
    if (!/`pg` driver is not installed/.test(reason)) {
      recordUnreachable(configured.dsn, reason);
    }
    attempted.push({
      origin: "supabase",
      why: `${redact(dsn)} did not answer.\n${reason}`,
    });
    return null;
  }
}

/** A timing line for a database that was not tried, which is the point of it. */
const noteSkip = (detail: string): void => noteTiming("database probe", 0, `skipped — ${detail}`);

function tryDirectory(
  environment: Environment,
  options: ResolveOptions,
  attempted: AttemptRecord[],
): Resolved | null {
  const workspace = environment.workspace;
  if (!workspace) {
    attempted.push({
      origin: "course-directory",
      why: "no directory containing courses/ was found (set PRES_WORKSPACE)",
    });
    return null;
  }
  const directory = locateCourseDirectory(workspace, options.course);
  if (!directory) {
    const available = coursesIn(workspace);
    attempted.push({
      origin: "course-directory",
      why: options.course
        ? `${workspace} has no courses/${options.course}/course.yaml`
        : available.length
          ? `${workspace} holds ${available.length} courses (${available.join(", ")}) and no --course was given`
          : `${workspace}/courses is empty`,
    });
    return null;
  }

  const { bundle, files, warnings } = readCourseDirectory(directory);
  return {
    source: fromBundle(
      bundle,
      provenance("course-directory", `${directory} (${files.length} files)`, attempted),
      options.version,
    ),
    warnings,
  };
}

function tryFlatFile(
  options: ResolveOptions,
  cwd: string,
  attempted: AttemptRecord[],
): Resolved | null {
  const path = locateFlatFile(cwd, options.courseFile);
  if (!path) {
    attempted.push({
      origin: "flat-file",
      why: options.courseFile
        ? `${options.courseFile} does not exist`
        : `no course.yaml in ${cwd}`,
    });
    return null;
  }
  const document = parseYaml(readFileSync(path, "utf8").replace(/^﻿/, "")) as Record<string, unknown>;
  if (!document || typeof document !== "object") {
    attempted.push({ origin: "flat-file", why: `${path} is empty or is not a mapping` });
    return null;
  }
  return { source: fromFlatFile(document, provenance("flat-file", path, attempted)), warnings: [] };
}

/**
 * The course, and a record of everything that was tried to find it.
 *
 * Throws only when nothing answered, and then the message names each source and
 * why it did not — which is the difference between "set SUPABASE_URL" and an
 * hour spent wondering why the deck has no readings in it.
 */
export async function resolveCourse(options: ResolveOptions = {}): Promise<Resolved> {
  return timed("course source", () => resolveCourseInner(options));
}

/** Which origins this preference allows, in order. */
export function originsFor(preference: SourcePreference = "auto"): Origin[] {
  if (preference === "database") return ["supabase"];
  if (preference === "local") return ["course-directory", "flat-file"];
  return ["supabase", "course-directory", "flat-file"];
}

async function resolveCourseInner(options: ResolveOptions): Promise<Resolved> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const environment = loadEnvironment(cwd);
  const attempted: AttemptRecord[] = [];

  const preference: SourcePreference = options.source ?? "auto";
  const allowed = new Set(originsFor(preference));
  const wanted = options.only;

  // A skipped database is recorded, never merely absent. The whole point of the
  // provenance record is that a deck built from a course directory while the
  // professor believed they were on the shared database is indistinguishable
  // from a correct one, and "I asked for local" is exactly as easy to forget as
  // "the network was down".
  if (!allowed.has("supabase") && (!wanted || wanted === "supabase")) {
    attempted.push({
      origin: "supabase",
      why: "not tried — --source local (or fast mode) asked for the copy on this machine",
    });
  }

  const stages: Array<[Origin, () => Promise<Resolved | null> | Resolved | null]> = [
    ["supabase", () => tryDatabase(environment, options, attempted)],
    ["course-directory", () => tryDirectory(environment, options, attempted)],
    ["flat-file", () => tryFlatFile(options, cwd, attempted)],
  ];

  for (const [origin, run] of stages) {
    if (wanted && wanted !== origin) continue;
    if (!allowed.has(origin)) continue;
    const resolved = await run();
    if (resolved) return resolved;
  }

  const reasons = attempted.map((entry) => `  ${entry.origin}: ${entry.why}`).join("\n");
  const tail = preference === "database"
    ? "\n\n--source database was asked for, so nothing fell back to a local copy. A course " +
      "directory last pulled in March produces a deck built from March's outcomes and looks " +
      "exactly like a correct one; that is the failure this refusal prevents. Use --source auto " +
      "to allow the fallback, with the provenance line saying what happened."
    : "\n\nThree places are looked in, in this order: a course database named by " +
      "PRES_COURSE_URL/SUPABASE_DB_URL/SUPABASE_URL, a workspace holding courses/<ID>/course.yaml, " +
      "and a single flat course.yaml. See references/course-source.md.";
  throw new Error(
    `No course found${options.course ? ` for '${options.course}'` : ""}.\n${reasons}${tail}`,
  );
}

/** Human-readable provenance, for the top of every report a skill prints. */
export function describeProvenance(source: CourseSource): string {
  const { provenance: record } = source;
  const lines = [`Course read from ${record.origin}: ${record.detail}`];
  for (const attempt of record.attempted) {
    const first = attempt.why.split("\n")[0]!;
    // "tried X first" is wrong for a source that was deliberately not tried,
    // and the distinction is the whole value of the line: a database that was
    // skipped by request is a choice, one that did not answer is a problem.
    const skipped = /^(?:skipped|not tried)/.test(first);
    // Strip the reason's own lead-in when the verb already says it: "skipped
    // supabase first — skipped: nothing answered" reads like a stutter, and this
    // line is the one thing in the report a professor is meant to actually read.
    const why = skipped ? first.replace(/^(?:skipped|not tried)\s*[:—-]\s*/, "") : first;
    lines.push(`  ${skipped ? "skipped" : "tried"} ${attempt.origin} first — ${why}`);
  }
  return lines.join("\n");
}
