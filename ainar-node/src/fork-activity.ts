/**
 * What each student did in their fork: the commits they added to the starter,
 * counted in all and week by week from when the homework opened.
 *
 * Beside `forks.json` (`forks.ts`), in `<submissions>/<RUN>/<ASSESSMENT>/
 * fork-activity.json`. Like it, it names accounts and repositories — public
 * facts — and no student; the match is made on render.
 *
 * **Only the student's commits.** A fork carries the starter's history, so
 * its own commit list would give everyone the professor's commits too.
 * GitHub's compare (`/repos/{starter}/compare/{branch}...{owner}:{branch}`)
 * answers exactly what the fork has that the starter does not: `ahead_by`,
 * and those commits with their dates and authors. One request per fork.
 *
 * **A commit's date is the student's word.** Git stores whatever date the
 * committing machine said, and it can be set to anything. So each commit is
 * also stamped with `seen`: the first analysis that found it on GitHub — this
 * process's clock, not theirs — and each analysis that found a fork changed
 * adds a snapshot (`at`, the head, the count). The weeks are counted by
 * `seen` by default; the claimed dates are kept beside them, and a commit
 * whose claimed date is before an earlier analysis that did not have it was
 * pushed late or redated, which the page says without deciding which.
 *
 * **Only what changed is read again.** The fork listing carries `pushed_at`;
 * a fork pushed no later than the last analysis keeps its result untouched,
 * so after the first run an analysis costs about one request per fork that
 * moved.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Fork } from "./forks.ts";
import { writeFileWhole } from "./write-file.ts";

export interface ForkCommit {
  sha: string;
  /** The author date git carries: whatever the committing machine said. */
  date: string | null;
  /** The GitHub account the author's email resolves to, when it does. */
  author: string | null;
  /** The first analysis that found this commit on GitHub. */
  seen: string;
  /** No longer on the fork: history rewritten (a force-push) after `seen`. */
  gone?: string;
}

export interface ForkSnapshot {
  /** When the analysis ran. */
  at: string;
  head: string | null;
  /** Commits the fork had beyond the starter then. */
  ahead_by: number;
}

export interface ForkActivity {
  repo: string;
  owner: string;
  branch: string | null;
  head: string | null;
  ahead_by: number;
  /** The fork's `pushed_at` when it was last read, which decides whether to read it again. */
  pushed_at: string | null;
  /** The last analysis that looked at this fork, read or skipped. */
  checked_at: string;
  commits: ForkCommit[];
  snapshots: ForkSnapshot[];
  /** Why the last read failed; the rest is what an earlier read found. */
  error?: string | null;
}

export interface ActivityCache {
  assessment_id: string;
  template_repo: string;
  /** The starter's branch the forks are compared against. */
  base_branch: string | null;
  analysed_at: string | null;
  /** By `owner/name`, lower-cased. */
  forks: Record<string, ForkActivity>;
}

export const activityPath = (submissions: string, runId: string, assessmentId: string): string =>
  join(submissions, runId, assessmentId, "fork-activity.json");

export const readActivity = (path: string): ActivityCache | null => {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && parsed.forks && typeof parsed.forks === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const writeActivity = (path: string, cache: ActivityCache): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileWhole(path, JSON.stringify(cache) + "\n");
};

export const keyOf = (repo: string): string => repo.toLowerCase();

/** Read again only a fork never read, one that failed, or one pushed since. */
export const needsRead = (previous: ForkActivity | undefined, fork: Fork): boolean =>
  !previous || Boolean(previous.error) || String(fork.pushed_at ?? "") > String(previous.pushed_at ?? "");

/** What one compare said, reduced. */
export interface Compared {
  head: string | null;
  ahead_by: number;
  commits: { sha: string; date: string | null; author: string | null }[];
}

/** GitHub's compare answer, reduced to what is kept. */
export const toCompared = (body: Record<string, any>): Compared => ({
  head: Array.isArray(body?.commits) && body.commits.length ? String(body.commits[body.commits.length - 1].sha) : null,
  ahead_by: Number(body?.ahead_by ?? 0) || 0,
  commits: (Array.isArray(body?.commits) ? body.commits : []).map((entry: Record<string, any>) => ({
    sha: String(entry.sha),
    date: entry.commit?.author?.date ?? entry.commit?.committer?.date ?? null,
    author: entry.author?.login ?? null,
  })),
});

/**
 * A fork's activity after one read: commits it had before keep the `seen` they
 * had; new ones are seen `now`; ones missing now are marked gone, not dropped,
 * because a rewritten history is itself worth seeing. A snapshot is added when
 * the head or the count moved.
 */
export const merged = (previous: ForkActivity | undefined, fork: Fork, read: Compared, now: string): ForkActivity => {
  const before = new Map((previous?.commits ?? []).map((commit) => [commit.sha, commit]));
  const present = new Set(read.commits.map((commit) => commit.sha));
  const commits: ForkCommit[] = read.commits.map((commit) => {
    const kept = before.get(commit.sha);
    return { sha: commit.sha, date: commit.date, author: commit.author, seen: kept?.seen ?? now };
  });
  for (const [sha, commit] of before) {
    if (!present.has(sha)) commits.push(commit.gone ? commit : { ...commit, gone: now });
  }
  const snapshots = [...(previous?.snapshots ?? [])];
  const last = snapshots[snapshots.length - 1];
  if (!last || last.head !== read.head || last.ahead_by !== read.ahead_by) {
    snapshots.push({ at: now, head: read.head, ahead_by: read.ahead_by });
  }
  return {
    repo: fork.repo,
    owner: fork.owner,
    branch: fork.default_branch ?? previous?.branch ?? null,
    head: read.head,
    ahead_by: read.ahead_by,
    pushed_at: fork.pushed_at,
    checked_at: now,
    commits,
    snapshots,
    error: null,
  };
};

/** A read that failed: what was known stays, with the reason. */
export const failed = (previous: ForkActivity | undefined, fork: Fork, reason: string, now: string): ForkActivity => ({
  repo: fork.repo,
  owner: fork.owner,
  branch: fork.default_branch ?? previous?.branch ?? null,
  head: previous?.head ?? null,
  ahead_by: previous?.ahead_by ?? 0,
  pushed_at: previous?.pushed_at ?? null,
  checked_at: now,
  commits: previous?.commits ?? [],
  snapshots: previous?.snapshots ?? [],
  error: reason,
});

/** A fork skipped because nothing was pushed since: only the check moves. */
export const unchanged = (previous: ForkActivity, now: string): ForkActivity => ({ ...previous, checked_at: now });

// ---------------------------------------------------------------------------
// Reading GitHub
// ---------------------------------------------------------------------------

/** One GET: the status and the parsed body, or a status of 0 with why. */
export type GithubGet = (path: string) => Promise<{ status: number; body: any; limited?: boolean; message?: string }>;

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Every commit the fork has beyond the starter. Compare answers 250 commits on
 * its first page; past that, pages of 100 until `total_commits` are in, with a
 * stop at ten — a thousand commits on one homework is not a student's work.
 */
export const compareFork = async (
  get: GithubGet,
  template: string,
  baseBranch: string,
  fork: Fork,
): Promise<Compared | { error: string; limited?: boolean }> => {
  const head = `${fork.owner}:${fork.default_branch ?? baseBranch}`;
  const path = `/repos/${template}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(head)}`;
  const first = await get(`${path}?per_page=100&page=1`);
  if (first.status !== 200) {
    return {
      error: first.status === 404 ? "GitHub has no such fork or branch any more" : first.message || `GitHub answered ${first.status}`,
      limited: first.limited,
    };
  }
  const compared = toCompared(first.body);
  const total = Number(first.body?.total_commits ?? compared.commits.length);
  for (let page = 2; compared.commits.length < total && page <= 10; page++) {
    const next = await get(`${path}?per_page=100&page=${page}`);
    if (next.status !== 200) break;
    const more = toCompared(next.body);
    if (!more.commits.length) break;
    compared.commits.push(...more.commits);
    compared.head = more.head ?? compared.head;
  }
  return compared;
};

/**
 * Run `work` over `items`, `limit` at a time, stopping early once `stop()`
 * turns true (GitHub said the hour's reads are spent).
 */
export const pooled = async <T>(items: T[], limit: number, work: (item: T) => Promise<void>, stop: () => boolean): Promise<void> => {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !stop()) {
      const item = items[next++]!;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
};

export interface AnalyseReport {
  read: number;
  skipped: number;
  failed: number;
  /** Not reached: GitHub's limit ran out first. */
  left: number;
}

/**
 * Read every fork that moved, `limit` at a time, saving after each so a
 * cancelled run keeps what it read. `say` hears a line per fork read.
 */
export const analyseForks = async (options: {
  get: GithubGet;
  template: string;
  baseBranch: string;
  forks: Fork[];
  previous: ActivityCache | null;
  assessmentId: string;
  save: (cache: ActivityCache) => void;
  say?: (line: string) => void;
  now?: () => string;
  limit?: number;
}): Promise<{ cache: ActivityCache; report: AnalyseReport }> => {
  const { get, template, baseBranch, forks, previous, assessmentId, save, say = () => {}, limit = 6 } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const started = now();
  const cache: ActivityCache = {
    assessment_id: assessmentId,
    template_repo: template,
    base_branch: baseBranch,
    analysed_at: previous?.analysed_at ?? null,
    // A fork deleted since stays: what it had is still what the student did.
    forks: { ...(previous?.forks ?? {}) },
  };
  const report: AnalyseReport = { read: 0, skipped: 0, failed: 0, left: 0 };
  const due: Fork[] = [];
  for (const fork of forks) {
    const before = cache.forks[keyOf(fork.repo)];
    if (needsRead(before, fork)) due.push(fork);
    else {
      cache.forks[keyOf(fork.repo)] = unchanged(before!, started);
      report.skipped += 1;
    }
  }
  say(`analysing ${due.length} fork(s) of ${template} (${report.skipped} unchanged since the last analysis)`);
  let limited = false;
  await pooled(
    due,
    limit,
    async (fork) => {
      const key = keyOf(fork.repo);
      const result = await compareFork(get, template, baseBranch, fork);
      if ("error" in result) {
        if (result.limited) {
          limited = true;
          return;
        }
        cache.forks[key] = failed(cache.forks[key], fork, result.error, started);
        report.failed += 1;
        say(`  ${fork.repo}: ${result.error}`);
      } else {
        cache.forks[key] = merged(cache.forks[key], fork, result, started);
        report.read += 1;
        say(`  ${fork.repo}: ${result.ahead_by} commit(s)`);
      }
      save(cache);
    },
    () => limited,
  );
  report.left = due.length - report.read - report.failed;
  if (!limited) cache.analysed_at = started;
  save(cache);
  return { cache, report };
};

/** `get` over `fetch`, with or without a token, saying when the hour's reads are spent. */
export const fetchGet =
  (token: string | null): GithubGet =>
  async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "ainar-homework-forks",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const limited =
      (response.status === 403 || response.status === 429) && response.headers.get("x-ratelimit-remaining") === "0";
    const body = await response.json().catch(() => null);
    return {
      status: response.status,
      body,
      limited,
      message: limited ? "GitHub's hourly limit is spent" : (body as any)?.message,
    };
  };

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

/** Week 1 is the seven days from `start`; 0 is before it. */
export const weekOf = (at: string | null, start: string): number | null => {
  if (!at) return null;
  const t = Date.parse(at);
  const s = Date.parse(start);
  if (!Number.isFinite(t) || !Number.isFinite(s)) return null;
  return t < s ? 0 : Math.floor((t - s) / WEEK) + 1;
};

export interface Weekly {
  /** `[0]` is before the start; `[k]` week k. */
  weeks: number[];
  /** After `until` (the deadline), when one was given. */
  after: number;
  total: number;
  /** Commits whose claimed date is before an analysis that had not seen them. */
  late_dated: number;
  /** Commits removed from the fork since they were seen. */
  gone: number;
  /** Commits by an account other than the fork's owner. */
  by_others: number;
  /**
   * Commits the first analysis found, all at once: nothing on this side says
   * when they arrived, so even by `seen` they are placed by their claimed date.
   */
  unverified: number;
}

/**
 * A fork's commits by week from `start`, up to `weeks` weeks (later ones fold
 * into the last), and those after `until` — the deadline — apart. `by` is
 * `seen` — when an analysis found it, the clock this side keeps — or `date`,
 * the one the commit claims.
 */
export const weekly = (
  activity: ForkActivity | undefined,
  start: string,
  weeks: number,
  by: "seen" | "date" = "seen",
  until: string | null = null,
): Weekly => {
  const out: Weekly = { weeks: Array.from({ length: weeks + 1 }, () => 0), after: 0, total: 0, late_dated: 0, gone: 0, by_others: 0, unverified: 0 };
  if (!activity) return out;
  const checks = activity.snapshots.map((snapshot) => snapshot.at).sort();
  const first = checks[0] ?? null;
  for (const commit of activity.commits) {
    if (commit.gone) {
      out.gone += 1;
      continue;
    }
    out.total += 1;
    if (commit.author && commit.author.toLowerCase() !== activity.owner.toLowerCase()) out.by_others += 1;
    // Claimed before an analysis that ran without it (the first one, which
    // saw everything at once, says nothing about that).
    if (commit.date && checks.some((at) => at < commit.seen && commit.date! < at)) out.late_dated += 1;
    const baseline = commit.seen === first;
    if (baseline) out.unverified += 1;
    const at = by === "seen" && !baseline ? commit.seen : commit.date;
    if (until && at && Date.parse(at) > Date.parse(until)) {
      out.after += 1;
      continue;
    }
    const week = weekOf(at, start);
    if (week === null) continue;
    out.weeks[Math.min(week, weeks)]! += 1;
  }
  return out;
};

/** How many commits the fork had at `at`, from the snapshots; null before the first. */
export const countAt = (activity: ForkActivity | undefined, at: string): number | null => {
  let found: number | null = null;
  for (const snapshot of activity?.snapshots ?? []) if (snapshot.at <= at) found = snapshot.ahead_by;
  return found;
};
