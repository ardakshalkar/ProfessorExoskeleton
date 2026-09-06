/**
 * Where the credentials are, and which copy of a value wins.
 *
 * Ported from `ProfessorExoskeletonDHS/exo/config.py`. Two rules carry over
 * unchanged because both were learned the hard way:
 *
 *   - **The process environment beats any file.** That ordering is what lets
 *     one command run against a staging database without editing a file every
 *     other command shares.
 *   - **A workspace's own `.env` is read, never copied.** A second copy of a
 *     database password is a second thing to rotate, and the professor already
 *     has one in the course workspace.
 *
 * The parser is deliberately not a dotenv library: this reads `KEY=value` lines
 * and nothing here needs more, so a dependency would buy nothing and the
 * parsing surface would grow.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ENV_FILES = [".env", ".env.local"] as const;

/** A `.env` as a plain mapping — no export, no interpolation, no shell. */
export function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  // utf-8 with a BOM is what Notepad writes, and the BOM would otherwise
  // become part of the first key's name.
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2]!.trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    out[match[1]!] = value;
  }
  return out;
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * A directory that holds `courses/`, searched upwards and then sideways.
 *
 * `PRES_WORKSPACE` (or `AINAR_WORKSPACE`, which a professor running the parent
 * already has set) wins. Otherwise: the current directory or any ancestor of
 * it, then a sibling `ProfessorHarness` checkout — the layout this plugin is
 * usually installed beside.
 */
export function findWorkspace(from: string = process.cwd()): string | null {
  for (const key of ["PRES_WORKSPACE", "AINAR_WORKSPACE"]) {
    const explicit = process.env[key];
    if (explicit && isDirectory(join(explicit, "courses"))) return resolve(explicit);
  }

  // The current directory or any ancestor, then a `ProfessorHarness` checkout
  // beside any of them — the layout this plugin is usually installed into. The
  // ancestor walk is what makes `pres` work from a subdirectory, which is where
  // a professor actually runs it.
  let directory = resolve(from);
  for (;;) {
    if (isDirectory(join(directory, "courses"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  directory = resolve(from);
  for (;;) {
    const sibling = join(directory, "ProfessorHarness");
    if (isDirectory(join(sibling, "courses"))) return sibling;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

export interface Environment {
  /** The workspace holding `courses/`, when there is one. */
  workspace: string | null;
  /** Every `.env` that was read, in the order it was read, for the report. */
  sources: string[];
  get(key: string): string | undefined;
}

/**
 * Locate the workspace, then read every `.env` that applies to it.
 *
 * The workspace's files come first and this directory's second, so a local
 * override beats the shared credential — the same precedence `exo` uses.
 */
export function loadEnvironment(from: string = process.cwd()): Environment {
  const workspace = findWorkspace(from);
  const merged: Record<string, string> = {};
  const sources: string[] = [];

  const roots = [...(workspace ? [workspace] : []), resolve(from)];
  for (const root of roots) {
    for (const name of ENV_FILES) {
      const path = join(root, name);
      const parsed = parseEnvFile(path);
      if (Object.keys(parsed).length) {
        Object.assign(merged, parsed);
        sources.push(path);
      }
    }
  }

  return {
    workspace,
    sources,
    get(key: string): string | undefined {
      return process.env[key] || merged[key] || undefined;
    },
  };
}

/** The keys that may name a course database, best first. */
export const DSN_KEYS = ["PRES_COURSE_URL", "SUPABASE_DB_URL", "SUPABASE_URL"] as const;

/** The configured DSN and which key supplied it, or null when none is set. */
export function courseDsn(env: Environment): { dsn: string; key: string } | null {
  for (const key of DSN_KEYS) {
    const dsn = env.get(key);
    if (dsn) return { dsn, key };
  }
  return null;
}
