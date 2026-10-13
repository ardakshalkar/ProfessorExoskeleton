/**
 * Whose fork is whose: a homework's public forks, matched to students.
 *
 * Students fork the starter repository and keep the fork public
 * (`homework.ts`), so GitHub already lists every fork of it — and every
 * submission a student handed in with a link says which GitHub account is
 * theirs. A student who forked HW3 and showed it in class, with nothing in
 * Canvas, therefore does not need their link copied out of a browser: their
 * fork is one of the starter's forks, under an account their HW1 named.
 *
 * A course where nobody hands in a link — the marks come off a sheet — learns
 * no account that way, so the professor can record one per student instead:
 * `ainar roster github STUDENT --login NAME`, or a GitHub column the sheet
 * sync reads. It ties a pseudonym to a person, so it lives in the roster
 * store (`~/.ainar/roster/people.json`, under `github`), never in `courses/`.
 *
 * Two halves, kept apart on purpose:
 *
 * * **The lookup** (`lookUpForks`) reaches GitHub and writes what it found to
 *   `<submissions>/<RUN>/<ASSESSMENT>/forks.json`. It names accounts and
 *   repositories only — public facts — and no student.
 * * **The match** (`forkChoices`) is pure, and runs on every render: the
 *   cache against the submissions on record. A login two students' links
 *   share is nobody's (the sync rule: an unsure match is held, not made), and
 *   a fork already on someone's submission is not offered to anyone else.
 *
 * Nothing here records anything. Choosing a fork is the professor's press,
 * and it goes through `defence fork` like a pasted link always has — which in
 * turn teaches the match that account for the next homework.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Fork {
  /** The GitHub account the fork sits under, as GitHub spells it. */
  owner: string;
  /** `owner/name`. */
  repo: string;
  url: string;
  /** Last push, which says whether anything was done in it. */
  pushed_at: string | null;
  created_at: string | null;
}

export interface ForkCache {
  assessment_id: string;
  template_repo: string;
  looked_up_at: string;
  forks: Fork[];
}

export const forksPath = (submissions: string, runId: string, assessmentId: string): string =>
  join(submissions, runId, assessmentId, "forks.json");

export const readForks = (path: string): ForkCache | null => {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && Array.isArray(parsed.forks) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeForks = (path: string, cache: ForkCache): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2) + "\n");
};

/** GitHub's fork listing, reduced to what the match and the screen use. Private forks are dropped. */
export const toForks = (listed: Record<string, any>[]): Fork[] =>
  listed
    .filter((entry) => entry && !entry.private && entry.owner?.login && entry.full_name)
    .map((entry) => ({
      owner: String(entry.owner.login),
      repo: String(entry.full_name),
      url: String(entry.html_url ?? `https://github.com/${entry.full_name}`),
      pushed_at: entry.pushed_at ?? null,
      created_at: entry.created_at ?? null,
    }))
    .sort((a, b) => a.owner.localeCompare(b.owner, undefined, { sensitivity: "base" }));

/** The GitHub account a link is under, lower-cased; null for anything that is not a github.com repository. */
export const loginOf = (url: unknown): string | null => {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") return null;
    const [owner, name] = parsed.pathname.split("/").filter(Boolean);
    return owner && name ? owner.toLowerCase() : null;
  } catch {
    return null;
  }
};

/**
 * Which student each GitHub account belongs to.
 *
 * Two sources. The links on record, from any homework; and the account the
 * professor recorded for a student in the roster store (`people.json`'s
 * `github`, from `ainar roster github` or the sheet's GitHub column) —
 * `recorded` is that, pseudonym → login, and is read by the caller so this
 * stays pure.
 *
 * A recorded account wins: it is the professor's word, where a link is only
 * what a student handed in. A student with one recorded is matched by it
 * alone, so a classmate's repository they once submitted is not taken for
 * theirs. An account two students share — two links, or two recordings — is
 * left out: it might be a shared repository, a copied link, or a typo, and a
 * guess would hand one student another's work.
 */
export const studentsByLogin = (
  submissions: Record<string, any>[],
  recorded: Record<string, string> = {},
): Map<string, string> => {
  const byLink = new Map<string, Set<string>>();
  for (const submission of submissions) {
    const login = loginOf(submission?.url);
    if (!login || !submission.student_id) continue;
    if (!byLink.has(login)) byLink.set(login, new Set());
    byLink.get(login)!.add(String(submission.student_id));
  }
  const byRecord = new Map<string, Set<string>>();
  for (const [student, value] of Object.entries(recorded)) {
    const login = githubLogin(value)?.toLowerCase();
    if (!login) continue;
    if (!byRecord.has(login)) byRecord.set(login, new Set());
    byRecord.get(login)!.add(student);
  }
  const withRecord = new Set([...byRecord.values()].flatMap((students) => [...students]));
  const owners = new Map<string, string>();
  for (const [login, students] of byLink) {
    if (byRecord.has(login)) continue;
    const others = [...students].filter((student) => !withRecord.has(student));
    if (students.size === 1 && others.length === 1) owners.set(login, others[0]!);
  }
  for (const [login, students] of byRecord) if (students.size === 1) owners.set(login, [...students][0]!);
  return owners;
};

/**
 * A GitHub account as a professor might write it — `aliya-k`, `@aliya-k`,
 * `github.com/aliya-k`, a link to one of their repositories — reduced to the
 * login; null for anything GitHub would not accept as one.
 */
export const githubLogin = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/^@/, "");
  const link = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  if (link) text = link[1]!;
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(text) ? text : null;
};

/** Pseudonym → recorded login, out of the roster store's people. */
export const recordedLogins = (people: Record<string, { github?: unknown }> | null | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [student, person] of Object.entries(people ?? {})) {
    const login = githubLogin(person?.github);
    if (login) out[student] = login;
  }
  return out;
};

export interface ForkChoices {
  /** Their own fork, by an account recorded for them or named by their earlier links. */
  theirs: Fork | null;
  /** How `theirs` was known: the account recorded in the roster, or a link they handed in. */
  how: "recorded" | "link" | null;
  /** Forks nobody on record owns and nobody has handed in: the ones to pick from. */
  unclaimed: Fork[];
}

/**
 * What can be offered to one student for one homework.
 *
 * `submissions` is the run's submissions, all assessments: an account is
 * learned from any homework, and a fork already on a submission for this
 * homework is spoken for. `recorded` is the logins the roster store holds,
 * pseudonym → login (`recordedLogins`).
 */
export const forkChoices = (
  cache: ForkCache | null,
  submissions: Record<string, any>[],
  assessmentId: string,
  studentId: string,
  recorded: Record<string, string> = {},
): ForkChoices => {
  if (!cache) return { theirs: null, how: null, unclaimed: [] };
  const owners = studentsByLogin(submissions, recorded);
  const mine = githubLogin(recorded[studentId])?.toLowerCase() ?? null;
  const handedIn = new Set(
    submissions
      .filter((entry) => entry.assessment_id === assessmentId && entry.url)
      .map((entry) => String(entry.url).trim().toLowerCase().replace(/\/+$/, "")),
  );
  let theirs: Fork | null = null;
  const unclaimed: Fork[] = [];
  for (const fork of cache.forks) {
    const owner = owners.get(fork.owner.toLowerCase());
    if (owner === studentId) {
      // Two forks under one account is a student who forked twice; the one
      // pushed to last is the one they worked in.
      if (!theirs || String(fork.pushed_at ?? "") > String(theirs.pushed_at ?? "")) theirs = fork;
      continue;
    }
    if (owner) continue;
    if (handedIn.has(fork.url.toLowerCase().replace(/\/+$/, ""))) continue;
    unclaimed.push(fork);
  }
  const how = theirs ? (mine !== null && theirs.owner.toLowerCase() === mine ? "recorded" : "link") : null;
  return { theirs, how, unclaimed };
};
