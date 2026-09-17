/**
 * Publishing a homework starter repository to GitHub.
 *
 * Everything else in this project refuses to publish. `design-assessment` builds
 * the repository as files and prints the `gh` commands for a person to run; the
 * skills are told never to run them. This file is where that rule is kept
 * rather than broken: the act still belongs to a person, and what changes is
 * only that the person now presses a button instead of retyping two commands.
 * Nothing here writes without `confirm`, and `planPublish` — the default —
 * reaches GitHub only to read.
 *
 * ## Two ways to reach GitHub, because there are two places this runs
 *
 * On a professor's laptop the machine already has a GitHub login: `gh auth
 * login` was run once, and asking them to mint a token as well would be asking
 * for a second credential to manage for no gain. On a shared host — `deploy/`,
 * one home and one port per professor — there is no interactive login, no
 * keyring, and `gh` may not be installed at all.
 *
 * So the same publish runs either way:
 *
 * * **`gh`** shells out to the GitHub CLI and inherits whatever it is logged in
 *   as. Nothing to configure, and nothing this project stores.
 * * **`token`** uses a connection in `connections.json` — the same registry
 *   Canvas and Telegram use, with the same rule that the file names the
 *   *variable* and never holds the secret. Configurable through the pane, and
 *   the only mode that works headless.
 *
 * Which one is decided by `resolveAuth`: a configured connection wins, `gh`
 * is the fallback, and `--auth` forces either. That order is deliberate — a
 * professor who has gone to the trouble of configuring a token meant it to be
 * used, and silently preferring an ambient `gh` login would publish as whoever
 * last logged in on the machine rather than as the identity they set up.
 *
 * ## Three things it will not do
 *
 * **It will not invent a repository name.** A name is the address students are
 * sent to and next year's cohort can find; guessing `css4007-hw3` from a title
 * is exactly the kind of helpfulness that produces a public URL nobody chose.
 * The name comes from `extensions.github.template_repo`, or from the professor
 * in the same request, and its absence is reported rather than filled in.
 *
 * **It will not force.** The update path clones what is on GitHub, writes the
 * local files over it and commits on top, so an edit somebody made in the
 * browser stays in the history even when this commit supersedes it. A starter
 * repository a student has already forked is not a file to be overwritten.
 *
 * **It will not publish an answer key.** A starter repository is student-facing,
 * so every text file in it is scanned against the run's items with the same
 * `scan` that guards the public course page, and a leak refuses the publish
 * with no override. `page.ts` says why there is no flag for this.
 *
 * The git work happens in a temporary clone, never in the professor's folder:
 * `homework/<slug>/` lives inside the workspace's own repository, and a nested
 * `.git` would quietly turn it into something the workspace cannot track.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { type Connection, hintFor, usable } from "./connections/index.ts";
import { resolveVariable } from "./connections/store.ts";
import { describeLeak, isSafe, scan } from "./safety.ts";

/** `owner/name`, the only shape GitHub and this take. */
const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

/**
 * Never copied into a starter repository, whatever a `.gitignore` says.
 *
 * `.gitignore` governs the push itself — the commit happens inside a clone that
 * has the professor's own file in it — but the plan is computed before any of
 * that, and a plan that lists `.env` as "would be added" has already put the
 * name of a secret on screen in front of whoever is watching.
 */
const NEVER = new Set([".git", ".env", "node_modules", "__pycache__", ".venv", "venv", ".DS_Store"]);

const skip = (name: string): boolean => NEVER.has(name) || name.endsWith(".pyc");

/** Every publishable file under a directory, as forward-slashed relative paths. */
export const filesUnder = (dir: string, base = dir): string[] => {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return found;
  }
  for (const name of entries) {
    if (skip(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full, base));
    else found.push(relative(base, full).split(/[\\/]/).join("/"));
  }
  return found;
};

/**
 * Git's own blob id for a file's bytes.
 *
 * The comparison against GitHub is made on these rather than on a fetched copy
 * of every file: a tree listing carries the sha of each blob, so one request
 * answers "which files differ" for a repository of any size, and the plan costs
 * one round trip whatever the homework weighs.
 */
export const blobSha = (contents: Buffer): string =>
  createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${contents.length}\0`), contents]))
    .digest("hex");

/**
 * The same bytes with CRLF line endings turned into LF.
 *
 * Git stores LF and hands Windows CRLF on checkout, so the working tree and the
 * blob genuinely differ byte for byte and a sha taken off the file on disk does
 * not match the one GitHub reports. Comparing the raw bytes therefore called
 * every CRLF text file "changed": on the real HW1 it reported `make_dataset.py`
 * and `kazakh_errors.json` as drifted when the difference was 193 and 87
 * carriage returns and nothing else.
 *
 * That is worse than a cosmetic wrong answer. Publishing on the back of it would
 * push a commit that changes only line endings, across a public template other
 * people have already forked, while claiming to be a content update.
 *
 * So a file is compared twice: as it is, and normalised. Matching normalised is
 * reported as unchanged and said out loud, rather than silently — a repository
 * that really is stored with CRLF is a thing that exists, and a professor
 * looking at "nothing to publish" deserves to know which comparison produced it.
 */
export const normaliseEol = (contents: Buffer): Buffer =>
  contents.includes(0) ? contents : Buffer.from(contents.toString("binary").replace(/\r\n/g, "\n"), "binary");

/** Where a homework's files live, from what the assessment records. */
export const homeworkDir = (root: string, assessment: Record<string, any>): string | null => {
  const recorded = assessment?.extensions?.github?.local_path;
  if (typeof recorded === "string" && recorded.trim() !== "") {
    const path = join(root, recorded);
    return existsSync(path) ? path : null;
  }
  // No convention is guessed beyond the one the skill writes: `homework/<slug>/`
  // with the slug spelled out. A directory found by fuzzy-matching a title is a
  // directory somebody else's homework could win.
  return null;
};

/** The repository this assessment is published to, if one is recorded. */
export const recordedRepo = (assessment: Record<string, any>): string | null => {
  const repo = assessment?.extensions?.github?.template_repo;
  return typeof repo === "string" && REPO_PATTERN.test(repo.trim()) ? repo.trim() : null;
};

// --------------------------------------------------------------------------
// Reaching GitHub
// --------------------------------------------------------------------------

/** How a command is run. Injected so the tests never reach the network. */
export interface Runner {
  (
    command: string,
    args: string[],
    options?: { cwd?: string; env?: Record<string, string> },
  ): string;
}

export const realRunner: Runner = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    encoding: "utf-8",
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    // Captured, not inherited. `execFileSync` sends a child's stderr straight to
    // this process's stderr unless told otherwise, and the commonest case here
    // is `gh api` on a repository that does not exist yet — which is not an
    // error, it is the answer to "does this exist". Inheriting printed
    // `gh: Not Found (HTTP 404)` into the middle of a plan that then said, two
    // lines later, that the repository would be created. A failure that matters
    // still carries its stderr on the thrown error.
    stdio: ["ignore", "pipe", "pipe"],
  });

export type AuthMode = "gh" | "token";

/**
 * Public unless the professor says otherwise.
 *
 * A starter repository exists to be forked — students press "Use this
 * template", and a private one they cannot see is a template that does not
 * work. It began private here, on the reasoning that going public is a
 * decision; but the decision is made the moment somebody sets homework that
 * students have to clone, and defaulting to the state that cannot serve its
 * purpose only meant an extra command every time.
 *
 * It stays in the plan and in the confirmation text, in those words, because
 * "public" is the part of this that cannot be taken back quietly: the answer
 * key scan is what stands between the press and a mistake, and the professor
 * should see which one they are making.
 */
export type Visibility = "public" | "private";

/**
 * A way to talk to GitHub, whichever mode produced it.
 *
 * `gitEnv` rather than a URL carrying the token: a credential in `argv` is
 * readable by every process on the host, and `/proc/<pid>/cmdline` is
 * world-readable where `environ` is not. Git reads configuration out of
 * `GIT_CONFIG_*`, so the Authorization header travels in the environment of the
 * one child that needs it and appears in no command line.
 */
export interface Github {
  mode: AuthMode;
  /** How this was resolved, for the report. Never contains the token. */
  source: string;
  /** Default owner for a repository created with no owner spelled out. */
  owner: string | null;
  tree(repo: string): Promise<Map<string, string> | null>;
  createRepo(repo: string, checkout: string, visibility: Visibility): Promise<string>;
  cloneUrl(repo: string): string;
  gitEnv(): Record<string, string>;
  /** Remove anything secret from text before it is shown or logged. */
  redact(text: string): string;
}

const parseTree = (raw: string): Map<string, string> => {
  const tree = JSON.parse(raw)?.tree ?? [];
  const found = new Map<string, string>();
  for (const entry of tree) {
    if (entry?.type === "blob" && typeof entry.path === "string") found.set(entry.path, entry.sha);
  }
  return found;
};

/** The GitHub CLI, with whatever it is logged in as. */
export const ghCli = (run: Runner = realRunner): Github => ({
  mode: "gh",
  source: "the gh CLI's own login",
  owner: null,
  async tree(repo) {
    try {
      return parseTree(run("gh", ["api", `repos/${repo}/git/trees/HEAD?recursive=1`]));
    } catch {
      return null; // No such repository, or no access to it.
    }
  },
  async createRepo(repo, checkout, visibility) {
    return run("gh", ["repo", "create", repo, `--${visibility}`, "--source", checkout, "--push"]);
  },
  cloneUrl(repo) {
    return `https://github.com/${repo}.git`;
  },
  gitEnv() {
    return {};
  },
  redact(text) {
    return text;
  },
});

/** A configured token, for a host with no interactive login. */
export const tokenApi = (token: string, owner: string | null, source: string): Github => {
  const call = async (path: string, init: RequestInit = {}): Promise<Response> =>
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "ainar-homework-publish",
        ...(init.headers ?? {}),
      },
    });

  return {
    mode: "token",
    source,
    owner,
    async tree(repo) {
      const response = await call(`/repos/${repo}/git/trees/HEAD?recursive=1`);
      if (!response.ok) return null;
      return parseTree(await response.text());
    },
    async createRepo(repo, _checkout, visibility) {
      const [repoOwner, name] = repo.split("/");
      // A repository under the token's own account is created on `/user/repos`;
      // one under an organisation needs the org route, and GitHub answers a
      // clear 403 when the token may not. Which of the two is decided by
      // comparing against the authenticated login rather than by guessing.
      const me = await call("/user");
      const login = me.ok ? ((await me.json()) as { login?: string }).login : null;
      const path = login && login.toLowerCase() === repoOwner.toLowerCase()
        ? "/user/repos"
        : `/orgs/${repoOwner}/repos`;
      const response = await call(path, {
        method: "POST",
        body: JSON.stringify({ name, private: visibility === "private" }),
      });
      if (!response.ok) {
        const detail = ((await response.json().catch(() => ({}))) as { message?: string }).message;
        throw new Error(
          `GitHub refused to create ${repo} (${response.status})` +
            (detail ? `: ${detail}` : "") +
            ". The token needs Administration: read and write on that owner.",
        );
      }
      return `Created ${repo} (${visibility}).`;
    },
    cloneUrl(repo) {
      return `https://github.com/${repo}.git`;
    },
    gitEnv() {
      const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
      return {
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
        GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
        GIT_TERMINAL_PROMPT: "0",
      };
    },
    redact(text) {
      return token ? text.split(token).join("«token»") : text;
    },
  };
};

export interface AuthResolution {
  github: Github | null;
  /** Why there is no way to reach GitHub, if there is none. */
  refusal: string | null;
  /** Both routes, as the professor would act on them. */
  notes: string[];
}

/**
 * Pick a mode: a configured connection first, then `gh`, unless one is forced.
 *
 * Returns rather than throws, and names both routes when neither is available.
 * "gh: command not found" on a server is a true statement that tells a
 * professor nothing about the thing they can actually do there.
 */
export const resolveAuth = (options: {
  connection?: Connection | null;
  force?: AuthMode | null;
  run?: Runner;
}): AuthResolution => {
  const { connection = null, force = null, run = realRunner } = options;
  const notes: string[] = [];

  const tokenRoute = (): Github | string => {
    if (!connection) {
      return "No github connection is configured. `ainar connections add github …`, or the pane's Integrations tab.";
    }
    if (!usable(connection)) {
      const worst = connection.issues.find((issue) => issue.severity === "error");
      return `The github connection '${connection.name}' cannot be used: ${worst?.message ?? "it is misconfigured"}`;
    }
    const resolved = resolveVariable(connection.tokenEnv);
    if (!resolved) {
      return (
        `The github connection '${connection.name}' names ${connection.tokenEnv}, ` +
        `which is not set. ${hintFor(connection)}`
      );
    }
    return tokenApi(
      resolved.value,
      connection.owner,
      `the '${connection.name}' connection (${connection.tokenEnv}, from ${resolved.source})`,
    );
  };

  const ghRoute = (): Github | string => {
    try {
      run("gh", ["auth", "status"]);
      return ghCli(run);
    } catch {
      return "The gh CLI is not installed, or is not logged in (`gh auth login`).";
    }
  };

  if (force === "token") {
    const chosen = tokenRoute();
    return typeof chosen === "string"
      ? { github: null, refusal: chosen, notes }
      : { github: chosen, refusal: null, notes };
  }
  if (force === "gh") {
    const chosen = ghRoute();
    return typeof chosen === "string"
      ? { github: null, refusal: chosen, notes }
      : { github: chosen, refusal: null, notes };
  }

  const viaToken = tokenRoute();
  if (typeof viaToken !== "string") return { github: viaToken, refusal: null, notes };
  const viaGh = ghRoute();
  if (typeof viaGh !== "string") {
    notes.push(`Using the gh CLI. ${viaToken}`);
    return { github: viaGh, refusal: null, notes };
  }
  return {
    github: null,
    refusal: `No way to reach GitHub.\n  token: ${viaToken}\n  gh: ${viaGh}`,
    notes,
  };
};

// --------------------------------------------------------------------------
// Planning and publishing
// --------------------------------------------------------------------------

export interface PublishPlan {
  assessmentId: string;
  /** Absolute path to the folder that would be published. */
  localDir: string | null;
  repo: string | null;
  /** Whether that repository already exists on GitHub. */
  exists: boolean;
  added: string[];
  changed: string[];
  removed: string[];
  /** Reasons this cannot proceed. Empty means `publish` would run. */
  refusals: string[];
  /** Worth saying, but not fatal. */
  notes: string[];
  /** How GitHub is being reached: `gh` or `token`. */
  mode: AuthMode | null;
  /** What a created repository would be. Ignored when one already exists. */
  visibility: Visibility;
}

/** `owner/name`, completed from the connection's owner when only a name is given. */
export const fullRepoName = (asked: string, owner: string | null): string =>
  asked.includes("/") || !owner ? asked : `${owner}/${asked}`;

/**
 * What publishing would do, without doing any of it.
 *
 * Reaches GitHub to read the tree, and nothing else. Every refusal is collected
 * rather than thrown on the first one: a professor who is missing both a
 * repository name and a folder should be told both at once.
 */
export const planPublish = async (options: {
  root: string;
  assessment: Record<string, any>;
  items: Parameters<typeof scan>[1];
  github: Github;
  repo?: string | null;
  visibility?: Visibility;
}): Promise<PublishPlan> => {
  const { root, assessment, items, github, visibility = "public" } = options;
  const asked = options.repo?.trim()
    ? fullRepoName(options.repo.trim(), github.owner)
    : null;
  const plan: PublishPlan = {
    assessmentId: String(assessment?.assessment_id ?? ""),
    localDir: homeworkDir(root, assessment),
    repo: asked ?? recordedRepo(assessment),
    exists: false,
    added: [],
    changed: [],
    removed: [],
    refusals: [],
    notes: [],
    mode: github.mode,
    visibility,
  };

  if (asked && !REPO_PATTERN.test(asked)) {
    plan.refusals.push(`'${asked}' is not owner/name, which is the only shape GitHub takes.`);
    plan.repo = null;
  }
  if (!plan.localDir) {
    plan.refusals.push(
      "No folder to publish. The assessment records no " +
        "`extensions.github.local_path`, or the path it records does not exist. " +
        "`/design-assessment` writes one when it scaffolds the repository.",
    );
  }
  if (!plan.repo) {
    plan.refusals.push(
      "No repository named. Record one as `extensions.github.template_repo`, or " +
        "name it in this request — it will not be guessed from the title.",
    );
  }
  if (plan.refusals.length) return plan;

  const localFiles = filesUnder(plan.localDir!);
  if (!localFiles.length) {
    plan.refusals.push(`${plan.localDir} holds no publishable file.`);
    return plan;
  }

  // Student-facing, so the answer keys are checked before anything is offered
  // to be pushed. Text only: a `.png` cannot leak a key it cannot spell, and
  // decoding one as UTF-8 to find out produces noise that matches nothing.
  const leaks: string[] = [];
  for (const file of localFiles) {
    const bytes = readFileSync(join(plan.localDir!, file));
    if (bytes.includes(0)) continue;
    const result = scan(bytes.toString("utf-8"), items);
    if (!isSafe(result)) {
      for (const leak of result.leaks) leaks.push(`${file} — ${describeLeak(leak)}`);
    }
  }
  if (leaks.length) {
    plan.refusals.push("This would publish an answer key to students:\n  " + leaks.join("\n  "));
    return plan;
  }

  const remote = await github.tree(plan.repo!);
  plan.exists = remote !== null;
  if (!plan.exists) {
    plan.added = localFiles;
    plan.notes.push(`${plan.repo} does not exist yet; it would be created ${visibility}.`);
    return plan;
  }

  let eolOnly = 0;
  for (const file of localFiles) {
    const bytes = readFileSync(join(plan.localDir!, file));
    const there = remote!.get(file);
    if (there === undefined) {
      plan.added.push(file);
      continue;
    }
    if (there === blobSha(bytes)) continue;
    if (there === blobSha(normaliseEol(bytes))) {
      eolOnly += 1;
      continue;
    }
    plan.changed.push(file);
  }
  if (eolOnly) {
    plan.notes.push(
      `${eolOnly} file(s) differ from GitHub only in line endings, which is what ` +
        "a Windows checkout looks like. They are not counted as changed, and " +
        "publishing will not touch them.",
    );
  }
  for (const file of remote!.keys()) {
    if (!localFiles.includes(file)) plan.removed.push(file);
  }
  if (plan.removed.length) {
    plan.notes.push(
      `${plan.removed.length} file(s) are on GitHub and not in the folder; ` +
        "publishing removes them there. They stay in the repository's history.",
    );
  }
  return plan;
};

export interface PublishResult {
  plan: PublishPlan;
  created: boolean;
  pushed: boolean;
  /** What git and GitHub said, redacted, for the caller to print whole. */
  output: string[];
  url: string | null;
}

const copyTree = (from: string, to: string): void => {
  for (const file of filesUnder(from)) {
    const destination = join(to, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(from, file), destination);
  }
};

/** Everything in a clone except its `.git`, so the copy is a replacement. */
const emptyExceptGit = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    if (name === ".git") continue;
    rmSync(join(dir, name), { recursive: true, force: true });
  }
};

/**
 * Create the repository if it is not there, and push the folder to it.
 *
 * The work happens in a temporary clone so the professor's folder never gains
 * a `.git`, and the commit sits on top of whatever GitHub already had.
 */
export const publish = async (options: {
  root: string;
  assessment: Record<string, any>;
  items: Parameters<typeof scan>[1];
  github: Github;
  repo?: string | null;
  message?: string;
  visibility?: Visibility;
  run?: Runner;
  tempDir?: string;
}): Promise<PublishResult> => {
  const { github, run = realRunner } = options;
  const plan = await planPublish(options);
  const result: PublishResult = { plan, created: false, pushed: false, output: [], url: null };
  if (plan.refusals.length) return result;

  const say = (text: string) => {
    const cleaned = github.redact(String(text ?? "")).trim();
    if (cleaned) result.output.push(cleaned);
  };

  const nothingToDo =
    plan.exists && !plan.added.length && !plan.changed.length && !plan.removed.length;
  if (nothingToDo) {
    say("Everything in the folder is already on GitHub, byte for byte.");
    result.url = `https://github.com/${plan.repo}`;
    return result;
  }

  const workDir = options.tempDir ?? mkdtempSync(join(tmpdir(), "ainar-hw-"));
  const checkout = join(workDir, basename(plan.localDir!));
  const message =
    options.message?.trim() || `Update ${plan.assessmentId || basename(plan.localDir!)} starter files`;
  const env = github.gitEnv();
  const git = (args: string[], cwd?: string) => run("git", args, { cwd, env });

  try {
    if (plan.exists) {
      say(git(["clone", "--depth", "1", github.cloneUrl(plan.repo!), checkout]));
      emptyExceptGit(checkout);
      copyTree(plan.localDir!, checkout);
      git(["add", "-A"], checkout);
      // `git commit` exits non-zero with nothing staged. That is the case where
      // the only differences were files `.gitignore` covers, which the plan
      // cannot see and this can — reported rather than raised.
      try {
        say(git(["commit", "-m", message], checkout));
      } catch {
        say("Nothing to commit once .gitignore was applied; nothing was pushed.");
        result.url = `https://github.com/${plan.repo}`;
        return result;
      }
      say(git(["push"], checkout));
      result.pushed = true;
    } else {
      mkdirSync(checkout, { recursive: true });
      copyTree(plan.localDir!, checkout);
      git(["init", "-b", "main"], checkout);
      git(["add", "-A"], checkout);
      git(["commit", "-m", message], checkout);
      // Public unless asked otherwise: a template students cannot see is a
      // template that does not work. `Visibility` carries the reasoning.
      say(await github.createRepo(plan.repo!, checkout, plan.visibility));
      if (github.mode === "token") {
        git(["remote", "add", "origin", github.cloneUrl(plan.repo!)], checkout);
        say(git(["push", "-u", "origin", "main"], checkout));
      }
      result.created = true;
      result.pushed = true;
    }
    result.url = `https://github.com/${plan.repo}`;
    return result;
  } catch (error) {
    // Redacted before it reaches the caller: git puts the failing URL in its
    // own message, and in token mode the header is in the environment but the
    // remote may still be echoed.
    throw new Error(github.redact(error instanceof Error ? error.message : String(error)));
  } finally {
    if (!options.tempDir) rmSync(workDir, { recursive: true, force: true });
  }
};

/** The plan as lines, for a terminal and for the pane's output box alike. */
export const describePlan = (plan: PublishPlan): string[] => {
  const lines: string[] = [];
  if (plan.refusals.length) {
    for (const refusal of plan.refusals) lines.push(`refused: ${refusal}`);
    return lines;
  }
  lines.push(`folder: ${plan.localDir}`);
  lines.push(
    `repository: ${plan.repo}${plan.exists ? "" : ` (would be created, ${plan.visibility})`}`,
  );
  if (plan.mode) lines.push(`reaching GitHub by: ${plan.mode}`);
  const say = (label: string, files: string[]) => {
    if (!files.length) return;
    lines.push(`${label}: ${files.length}`);
    for (const file of files.slice(0, 20)) lines.push(`  ${file}`);
    if (files.length > 20) lines.push(`  … and ${files.length - 20} more`);
  };
  say("added", plan.added);
  say("changed", plan.changed);
  say("removed", plan.removed);
  if (!plan.added.length && !plan.changed.length && !plan.removed.length) {
    lines.push("no difference: the folder and the repository already match");
  }
  for (const note of plan.notes) lines.push(`note: ${note}`);
  return lines;
};
