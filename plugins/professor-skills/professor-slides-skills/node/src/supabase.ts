/**
 * Connecting to a Supabase course database from a network that has no IPv6.
 *
 * Ported from `ProfessorExoskeletonDHS/exo/db.py`, whose reasoning is worth
 * repeating because the symptom misleads. The DSN the Supabase dashboard hands
 * out is
 *
 *     postgresql://postgres:PW@db.<ref>.supabase.co:5432/postgres
 *
 * and `db.<ref>.supabase.co` resolves to an AAAA record and nothing else. On a
 * network without an IPv6 route — this university's, among many — that host is
 * not slow, it is unreachable, and the driver reports it as a name that cannot
 * be resolved, which reads like a typo rather than a routing problem.
 *
 * The way through is Supabase's connection pooler, which has A records:
 *
 *     postgresql://postgres.<ref>:PW@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * Note the username: the pooler multiplexes every project in a region, so the
 * project ref moves out of the hostname and into the user. Getting that wrong
 * produces `Tenant or user not found`, which is also not about tenants.
 *
 * The region is not in the DSN and cannot be derived from it, so the routes are
 * tried and the one that answers is written down.
 *
 * ## What this cost before it was bounded
 *
 * The first version of this file did the arithmetic correctly and the waiting
 * catastrophically. Twenty-eight candidate hostnames were resolved *one at a
 * time*, each on the event loop. Every surviving route then got a ten-second
 * connection deadline, twice — once with a verified certificate and once
 * without. Nothing remembered a failure, so `pres source`, `pres context` and
 * `pres outline check` each paid the whole bill again, and a professor whose
 * `.env` named a database they were not currently on the VPN for waited minutes
 * per command to be told the database was not there.
 *
 * Four changes, each of which is a rule about a network rather than a
 * micro-optimisation:
 *
 *   - **Resolve in parallel.** DNS lookups are independent. There was never a
 *     reason to serialise them.
 *   - **Deadlines short, and a hard total budget.** A database that will answer
 *     answers in well under two seconds; one that needs ten is one whose
 *     lecture has started. The budget bounds the whole probe, so the worst case
 *     is a number rather than a multiplication.
 *   - **Connect in batches, and take the first answer.** The region is unknown,
 *     which is exactly the case a race is for.
 *   - **Remember the failure, not only the success.** A route that did not
 *     answer forty seconds ago will not answer now, and the next command should
 *     say so in a millisecond instead of finding out again. It expires, and
 *     `--source database` always retries — a cache that could not be overridden
 *     would be a cache that hides a database coming back.
 *
 * None of it changes what is *reported*. A skipped database is an attempt on
 * the provenance record with the reason and the age of the cached failure, for
 * the same reason a fallback always was: stale course data that looks
 * authoritative is the failure this whole layer exists to prevent.
 */

import { createRequire } from "node:module";
import { resolve4 } from "node:dns/promises";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { noteTiming, startSpan } from "./timing.ts";

const require = createRequire(import.meta.url);

/** Ordered by how likely a deployment reading this is to be in one. */
const REGIONS = [
  "ap-northeast-1", "ap-southeast-1", "ap-south-1", "ap-southeast-2", "ap-northeast-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-north-1",
  "us-east-1", "us-west-1", "us-east-2", "sa-east-1", "ca-central-1",
] as const;

/** The pooler answers on both. 6543 is transaction pooling, which every query here is. */
const PORTS = [6543, 5432] as const;
const PREFIXES = ["aws-0", "aws-1"] as const;

/**
 * How long one connection attempt gets.
 *
 * The configured DSN goes first and gets the shortest deadline, because its
 * commonest failure mode is a host with no IPv4 route, which fails on DNS or on
 * `ENETUNREACH` rather than by timing out. A pooler candidate gets a little
 * more: it is a real host that may be a continent away. A route read from the
 * cache gets the most, because it worked before and is worth waiting for.
 */
const FIRST_DEADLINE_MS = 1_500;
const PROBE_DEADLINE_MS = 2_500;
const CACHED_DEADLINE_MS = 4_000;

/** The whole probe, however many routes that is. A ceiling, not a target. */
const BUDGET_MS = 6_000;

/** How long a recorded failure is believed. */
const FAILURE_TTL_MS = 600_000;

/**
 * How many routes race at once.
 *
 * Twenty-eight, which is every pooler route in two batches rather than five.
 * The number is chosen against the budget above, not for its own sake: batches
 * that do not all fit inside the budget mean the last regions in the list are
 * never actually tried, and a professor whose project is in `ca-central-1`
 * would get "could not reach the database" from a search that stopped before it
 * asked. Two batches of short-lived TCP handshakes is a cheap way to be sure
 * the search is complete.
 */
const BATCH = 28;

const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const probeDeadline = (): number =>
  positiveNumber(process.env.PRES_CONNECT_TIMEOUT_MS, PROBE_DEADLINE_MS);

export const probeBudget = (): number =>
  positiveNumber(process.env.PRES_DB_BUDGET_MS, BUDGET_MS);

export const failureTtl = (): number =>
  positiveNumber(process.env.PRES_DB_FAIL_TTL_MS, FAILURE_TTL_MS);

/**
 * Where a probed route is remembered.
 *
 * Under the user's home, keyed by project ref — not in the course workspace and
 * not in the working directory. Three reasons, in order of how much each one
 * would annoy somebody:
 *
 *   - The workspace is usually a git checkout that belongs to someone else's
 *     project, and a tool that leaves untracked files in it is a tool people
 *     stop trusting.
 *   - What was discovered is a property of this machine's network and the
 *     project, not of the directory the command was run from, so per-directory
 *     caching would re-probe fifty-six hosts for no reason.
 *   - It is discovered state, never a curated credential, so it does not belong
 *     anywhere near the professor's `.env`.
 */
export function cachePath(ref: string | null): string {
  const home = process.env.PRES_HOME
    ?? process.env.HOME
    ?? process.env.USERPROFILE
    ?? ".";
  return join(home, ".pres", "routes", `${ref ?? "default"}`);
}

export class DatabaseUnreachable extends Error {
  readonly attempts: string[];

  constructor(message: string, attempts: string[] = []) {
    super(message);
    this.name = "DatabaseUnreachable";
    this.attempts = attempts;
  }
}

export interface Route {
  dsn: string;
  /** Host and port, no secret — this is what a failure report prints. */
  label: string;
  /** Whether this route goes through the pooler, read off the hostname. */
  pooled: boolean;
  /**
   * Whether the server's certificate chain was verified.
   *
   * False means the connection is encrypted but the certificate was not
   * checked — libpq's `sslmode=require`, and what `psycopg2` does by default,
   * which is why the Python original never had to mention it. It is mentioned
   * here: a downgrade nobody is told about is a downgrade nobody can decide
   * about.
   */
  verified?: boolean;
}

/**
 * The same route, with TLS asked for two different ways.
 *
 * `verify-full` checks the chain. `compat` is libpq's `sslmode=require` —
 * encrypted, certificate unverified — which `pg` only honours when told to use
 * libpq semantics, because its own `require` has meant `verify-full` since v8.
 */
export function withSsl(dsn: string, mode: "verify-full" | "compat"): string {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return dsn;
  }
  if (mode === "verify-full") {
    url.searchParams.delete("uselibpqcompat");
    url.searchParams.set("sslmode", "verify-full");
  } else {
    url.searchParams.set("uselibpqcompat", "true");
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

/** The first line of an error, which is the part that names the cause. */
const firstLine = (error: unknown): string =>
  String((error as Error)?.message ?? error).split(/\r?\n/)[0] ?? "";

/** Failures that mean "the chain was not trusted", not "the server said no". */
const CERTIFICATE_FAILURE = /certificate|self.signed|unable to (verify|get local issuer)|CERT_|DEPTH_ZERO/i;

/**
 * A DSN as it is safe to print: the password replaced, everything else kept.
 *
 * A failure report is the thing a professor screenshots when asking for help,
 * so it has to name the host it could not reach without carrying the password
 * to wherever the screenshot goes.
 */
export const redact = (dsn: string): string => dsn.replace(/(:\/\/[^:/@]+):[^@]*@/, "$1:***@");

/** The Supabase project ref, from either spelling of the DSN. */
export function projectRef(dsn: string): string | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
    return host.slice(3, -".supabase.co".length);
  }
  const user = decodeURIComponent(url.username || "");
  if (user.startsWith("postgres.")) return user.slice("postgres.".length);
  return null;
}

function parse(dsn: string): URL | null {
  try {
    return new URL(dsn);
  } catch {
    return null;
  }
}

const labelFor = (url: URL | null): string =>
  url ? `${url.hostname || "?"}${url.port ? `:${url.port}` : ""}` : "?";

const hasIpv4 = async (host: string): Promise<boolean> => {
  try {
    return (await resolve4(host)).length > 0;
  } catch {
    return false;
  }
};

/**
 * The routes worth trying, best first.
 *
 * The given DSN always leads: if it works it is what the professor configured
 * and there is no reason to second-guess it. Pooler routes follow, and only
 * those whose hostname actually resolves.
 *
 * The resolutions happen together rather than in turn. They are independent
 * network round trips; doing twenty-eight of them one after another turned a
 * hundred milliseconds of work into several seconds of waiting, and that was
 * before a single connection had been attempted.
 *
 * `PRES_SUPABASE_REGION` skips the guessing entirely. A professor who knows
 * their project is in `eu-central-1` should not pay for the other thirteen, and
 * this is the flag that turns a probe into one attempt.
 *
 * `resolveHost` is injectable so the candidate arithmetic can be tested without
 * a network.
 */
export async function candidates(
  dsn: string,
  resolveHost: (host: string) => Promise<boolean> = hasIpv4,
): Promise<Route[]> {
  const url = parse(dsn);
  if (!url) return [{ dsn, label: "?", pooled: false }];

  const out: Route[] = [
    { dsn, label: labelFor(url), pooled: url.hostname.endsWith(".pooler.supabase.com") },
  ];

  const ref = projectRef(dsn);
  const password = url.password;
  if (!ref || !password) return out;

  const pinned = process.env.PRES_SUPABASE_REGION?.trim();
  const regions = pinned ? [pinned] : REGIONS;

  const hosts: string[] = [];
  for (const prefix of PREFIXES) {
    for (const region of regions) hosts.push(`${prefix}-${region}.pooler.supabase.com`);
  }

  const done = startSpan("dns");
  const resolvable = await Promise.all(hosts.map((host) => resolveHost(host)));
  done(`${resolvable.filter(Boolean).length}/${hosts.length} resolved`);

  const user = encodeURIComponent(`postgres.${ref}`);
  const secret = encodeURIComponent(decodeURIComponent(password));
  const database = (url.pathname || "/postgres").replace(/^\//, "") || "postgres";

  for (const [index, host] of hosts.entries()) {
    if (!resolvable[index]) continue;
    for (const port of PORTS) {
      out.push({
        dsn: `postgresql://${user}:${secret}@${host}:${port}/${database}`,
        label: `${host}:${port}`,
        pooled: true,
      });
    }
  }
  return out;
}

interface QueryResult<Row> { rows: Row[] }

export interface Client {
  query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
  end(): Promise<void>;
}

function loadPg(): any {
  try {
    return require("pg");
  } catch (error) {
    throw new DatabaseUnreachable(
      "The `pg` driver is not installed, so the database route cannot be tried.\n" +
      "Install it (cd node && npm install pg), or work from a YAML course instead.\n" +
      String(error),
    );
  }
}

interface Attempt {
  route: Route;
  client: Client;
}

/**
 * A live connection, or an error naming every route that was tried and why.
 *
 * With `probe: false` the given DSN is used exactly as given — which is what a
 * caller wants once a route has been resolved and written down, including its
 * TLS parameters.
 *
 * With probing, the configured DSN is tried alone first, on a short deadline
 * and both ways round on TLS. That is where a re-signing proxy gets discovered,
 * and discovering it once is what stops the remaining fifty-six attempts from
 * each paying for a strict attempt that cannot succeed. The pooler candidates
 * then race in batches: the region is unknown, so there is nothing to be gained
 * by asking about them in order, and a great deal of waiting to be lost.
 */
export async function connect(
  dsn: string,
  options: { probe?: boolean; deadlineMs?: number; budgetMs?: number } = {},
): Promise<{ client: Client; route: Route }> {
  const { Client: PgClient } = loadPg();
  const deadline = options.deadlineMs ?? probeDeadline();

  const open = async (candidate: string, timeout: number): Promise<Client> => {
    const client: Client = new PgClient({
      connectionString: candidate,
      connectionTimeoutMillis: timeout,
    });
    await (client as unknown as { connect(): Promise<void> }).connect();
    return client;
  };

  if (options.probe === false) {
    const route: Route = { dsn, label: labelFor(parse(dsn)), pooled: false };
    const done = startSpan("cached route");
    try {
      const client = await open(dsn, options.deadlineMs ?? CACHED_DEADLINE_MS);
      done(route.label);
      return { client, route };
    } catch (error) {
      done("did not answer");
      throw new DatabaseUnreachable("The recorded route no longer answers.", [
        `${route.label}: ${firstLine(error)}`,
      ]);
    }
  }

  const started = performance.now();
  const budget = options.budgetMs ?? probeBudget();
  const spent = (): number => performance.now() - started;
  const routes = await candidates(dsn);
  const attempts: string[] = [];
  let chainIsTrusted = true;

  // --- the configured DSN, alone --------------------------------------------
  const configured = routes[0]!;
  const strictFirst = withSsl(configured.dsn, "verify-full");
  const done = startSpan("configured dsn");
  try {
    const client = await open(strictFirst, FIRST_DEADLINE_MS);
    done(configured.label);
    return { client, route: { ...configured, dsn: strictFirst, verified: true } };
  } catch (error) {
    const message = firstLine(error);
    if (CERTIFICATE_FAILURE.test(message)) {
      chainIsTrusted = false;
      const compat = withSsl(configured.dsn, "compat");
      try {
        const client = await open(compat, FIRST_DEADLINE_MS);
        done(`${configured.label}, certificate unverified`);
        return { client, route: { ...configured, dsn: compat, verified: false } };
      } catch (second) {
        attempts.push(`${configured.label}: ${firstLine(second)}`);
      }
    } else {
      attempts.push(`${configured.label}: ${message}`);
    }
    done("did not answer");
  }

  // --- the pooler candidates, in batches, first answer wins -----------------
  const pooler = routes.slice(1);
  if (!pooler.length) {
    throw new DatabaseUnreachable("Could not reach the course database on any route.", attempts);
  }

  const race = async (batch: Route[], mode: "verify-full" | "compat"): Promise<Attempt | null> => {
    const opened: Attempt[] = [];
    const errors: string[] = [];
    const results = await Promise.allSettled(
      batch.map(async (route) => {
        const candidate = withSsl(route.dsn, mode);
        const client = await open(candidate, deadline);
        return {
          route: { ...route, dsn: candidate, verified: mode === "verify-full" },
          client,
        } satisfies Attempt;
      }),
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") opened.push(result.value);
      else errors.push(`${batch[index]!.label}: ${firstLine(result.reason)}`);
    }
    if (!opened.length) {
      attempts.push(...errors);
      // If the only thing standing between here and a connection is an
      // untrusted chain, say so once and the caller retries in compat.
      if (mode === "verify-full" && errors.some((line) => CERTIFICATE_FAILURE.test(line))) {
        chainIsTrusted = false;
      }
      return null;
    }
    // One winner. The rest are closed rather than leaked: an abandoned pooler
    // connection holds a slot on a shared pooler until it times out, and this
    // opens twelve of them at a time.
    const [winner, ...losers] = opened;
    for (const loser of losers) {
      void loser.client.end().catch(() => {});
    }
    return winner!;
  };

  for (let index = 0; index < pooler.length; index += BATCH) {
    if (spent() > budget) {
      attempts.push(
        `gave up after ${Math.round(spent())} ms with ${pooler.length - index} route(s) untried ` +
        `(PRES_DB_BUDGET_MS=${Math.round(budget)}). Pin the region with PRES_SUPABASE_REGION to ` +
        "make this one attempt instead of a search.",
      );
      break;
    }
    const batch = pooler.slice(index, index + BATCH);
    const span = startSpan("pooler batch");
    if (chainIsTrusted) {
      const won = await race(batch, "verify-full");
      if (won) {
        span(won.route.label);
        return won;
      }
    }
    if (!chainIsTrusted) {
      const won = await race(batch, "compat");
      if (won) {
        span(`${won.route.label}, certificate unverified`);
        return won;
      }
    }
    span(`${batch.length} tried, none answered`);
  }

  noteTiming("database probe gave up", spent());
  throw new DatabaseUnreachable("Could not reach the course database on any route.", attempts);
}

/**
 * What is remembered about a project's route.
 *
 * Both halves matter and only one of them used to be written. A route that
 * worked saves a probe; a route that failed saves the *same* probe, and it is
 * the one a professor pays for repeatedly — a database is reachable once and
 * unreachable for the whole afternoon they are off the VPN.
 */
export interface RouteRecord {
  /** A route that served a course. */
  dsn?: string;
  ok_at?: string;
  /** When the database last failed to answer on every route. */
  failed_at?: string;
  /** The first line of why, for the report. */
  why?: string;
}

export function readRouteRecord(configuredDsn: string): RouteRecord | null {
  const path = cachePath(projectRef(configuredDsn));
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8").trim();
  if (!text) return null;
  // Before this was JSON the file held a bare DSN, and a professor who upgrades
  // should not lose a route they already paid to discover.
  if (!text.startsWith("{")) return { dsn: text };
  try {
    const parsed = JSON.parse(text) as RouteRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeRouteRecord(configuredDsn: string, record: RouteRecord): void {
  const path = cachePath(projectRef(configuredDsn));
  mkdirSync(dirname(path), { recursive: true });
  // The file can hold a password, so it is created readable by its owner only on
  // any system that honours the mode. Windows ignores it; there the file's
  // protection is the profile directory it sits in.
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

/** A working route, remembered so the next command does not probe again. */
export function readCachedDsn(configuredDsn: string): string | null {
  return readRouteRecord(configuredDsn)?.dsn ?? null;
}

export function writeCachedDsn(configuredDsn: string, dsn: string): void {
  writeRouteRecord(configuredDsn, { dsn, ok_at: new Date().toISOString() });
}

/**
 * Remember that nothing answered.
 *
 * The working route, if one was ever found, is deliberately dropped: a route
 * that has stopped answering should be re-probed when the failure expires, not
 * retried forever on the strength of having worked last month.
 */
export function recordUnreachable(configuredDsn: string, why: string): void {
  writeRouteRecord(configuredDsn, {
    failed_at: new Date().toISOString(),
    why: why.split(/\r?\n/)[0] ?? why,
  });
}

/**
 * Whether this database was recently found unreachable, and how recently.
 *
 * Returning the age rather than a boolean because the age goes in the report. A
 * professor told "the database was skipped" asks why; one told "the database
 * did not answer 40 s ago" already knows, and knows it will be retried.
 */
export function unreachableRecently(
  configuredDsn: string,
  ttlMs: number = failureTtl(),
): { why: string; ageMs: number } | null {
  const record = readRouteRecord(configuredDsn);
  if (!record?.failed_at) return null;
  const at = Date.parse(record.failed_at);
  if (!Number.isFinite(at)) return null;
  const ageMs = Date.now() - at;
  if (ageMs < 0 || ageMs > ttlMs) return null;
  return { why: record.why ?? "no reason recorded", ageMs };
}

/** Throw away what is remembered, so the next attempt is a fresh one. */
export function forgetRoute(configuredDsn: string): void {
  const path = cachePath(projectRef(configuredDsn));
  if (existsSync(path)) rmSync(path, { force: true });
}

/**
 * The whole course, as one row.
 *
 * `content.course_bundle_read_models` is the same read model the parent's MCP
 * server reads, so a course served from the database and the same course read
 * from YAML arrive in one shape and nothing downstream has to branch on where
 * it came from.
 */
export const BUNDLE_SQL = `
SELECT course_code, format_version, payload
  FROM content.course_bundle_read_models
 WHERE course_code = $1
`;

export async function fetchBundle(
  client: Client,
  courseCode: string,
): Promise<Record<string, unknown> | null> {
  const result = await client.query<{ payload: unknown }>(BUNDLE_SQL, [courseCode]);
  const payload = result.rows[0]?.payload;
  if (payload === undefined || payload === null) return null;
  return typeof payload === "string"
    ? (JSON.parse(payload) as Record<string, unknown>)
    : (payload as Record<string, unknown>);
}

/** Every course the database can serve, for `pres source` with no `--course`. */
export async function listCourses(client: Client): Promise<string[]> {
  const result = await client.query<{ course_code: string }>(
    "SELECT course_code FROM content.course_bundle_read_models ORDER BY course_code",
  );
  return result.rows.map((row) => row.course_code);
}
