/**
 * Where a token's value actually comes from, for a CLI with no harness around
 * it.
 *
 * The registry names a variable and never holds a value. That leaves the
 * question of who holds it, and there are now two answers, because the
 * professor has two ways to put one there:
 *
 * * **They export it in a shell**, and it arrives in `process.env`.
 * * **They type it into the pane**, which writes it through `ctx.credentials`
 *   into `$DSH_HOME/.credentials.yaml` — the same managed store the harness's
 *   own Models page writes API keys to.
 *
 * A CLI invoked from a terminal has no `ctx`, so without this module the
 * second way would work everywhere except the command that matters: `ainar lms
 * push` would report no token while the pane showed one saved. Reading the
 * store here is what makes the two surfaces agree.
 *
 * ## The precedence is the provider's, not ours
 *
 * `dsh-credentials-local` layers the inherited process environment OVER its
 * managed document, and is explicit about why: a per-run override
 * (`AINAR_CANVAS_TOKEN=… bin/ainar …`, a CI secret, a container `-e`) is
 * operator intent for this run, and it cannot be edited from inside, so it has
 * to win visibly. This module reproduces that order exactly. Getting it
 * backwards would mean a professor's one-off override was silently ignored in
 * favour of a key they saved months ago.
 *
 * The two `.env` layers below the document are deliberately not reproduced.
 * They are the launcher's, they depend on a frozen environment snapshot only
 * the product CLI has, and guessing at them from here would invent a
 * precedence rather than mirror one.
 *
 * ## Reading, never writing
 *
 * Nothing in `ainar-node` writes to the credentials document. Writing is the
 * pane's job, through the seam, where the shadowing rule is enforced and a
 * write that could not take effect is refused rather than silently lost. A
 * second writer without that check is how two surfaces disagree about what the
 * credential is.
 */

import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

/** The grammar `credentialRef` accepts. A name outside it stored nothing. */
const REF_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const DSH_HOME_ENV = "DSH_HOME";

/** `$DSH_HOME/.credentials.yaml`, or `~/.dsh/.credentials.yaml`. */
export const credentialsPath = (): string => {
  const home = (process.env[DSH_HOME_ENV] ?? "").trim();
  return join(home ? resolve(home) : join(homedir(), ".dsh"), ".credentials.yaml");
};

/** Where a resolved value came from, for a report that has to say so. */
export type Source = "env" | "file";

export interface Resolved {
  value: string;
  source: Source;
}

/**
 * The document's `refs:` section, re-read when the file changes.
 *
 * Cached on modification time rather than read once, because the pane and a
 * long-running command can both be alive while the professor saves a token:
 * reading once would mean a `doctor` run just after a save still reported the
 * credential missing. Cached at all, rather than read every time, because
 * `list` asks about presence once per connection and a syscall per row for a
 * file that changes twice a term is waste.
 */
let cached: { path: string; mtimeMs: number; refs: Record<string, string> } | null = null;

const readRefs = (): Record<string, string> => {
  const path = credentialsPath();
  let mtimeMs: number;
  try {
    const stats = statSync(path);
    if (!stats.isFile()) return {};
    mtimeMs = stats.mtimeMs;
  } catch {
    // No harness home, or no document in it. Neither is an error: a professor
    // who only ever exports variables in a shell never creates one.
    return {};
  }

  if (cached && cached.path === path && cached.mtimeMs === mtimeMs) return cached.refs;

  let document: any;
  try {
    document = parse(readFileSync(path, "utf-8"));
  } catch {
    // A malformed credentials document is the harness's problem to report, and
    // it has a UI for it. Here it reads as "nothing stored", which degrades to
    // the environment rather than crashing a grading command.
    cached = { path, mtimeMs, refs: {} };
    return cached.refs;
  }

  const section = document?.refs;
  const refs: Record<string, string> = {};
  if (section && typeof section === "object" && !Array.isArray(section)) {
    for (const [name, value] of Object.entries(section)) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      // The seam's own rule: an empty stored value is absent everywhere. A
      // blank must never masquerade as a configured secret.
      if (text) refs[name] = text;
    }
  }
  cached = { path, mtimeMs, refs };
  return refs;
};

/**
 * A variable's value: the environment first, then the managed store.
 *
 * Returns `null` rather than an empty string when there is nothing, so that a
 * caller cannot accidentally send `Authorization: Bearer ` and read the 401 as
 * a bad token rather than as a missing one.
 */
export const resolveVariable = (name: string): Resolved | null => {
  if (!REF_NAME.test(name)) return null;

  const fromEnv = (process.env[name] ?? "").trim();
  if (fromEnv) return { value: fromEnv, source: "env" };

  const stored = readRefs()[name];
  return stored ? { value: stored, source: "file" } : null;
};

/** Whether the value exists, without reading it into the caller's hands. */
export const variablePresent = (name: string): boolean => resolveVariable(name) !== null;

/**
 * Forget the cached document. For tests, which write several in one process.
 *
 * Not exported for production use: outside a test the modification time is the
 * right invalidator, and a manual reset would only ever hide a bug in it.
 */
export const forgetCredentials = (): void => {
  cached = null;
};
