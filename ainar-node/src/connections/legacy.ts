/**
 * The three places connections used to live, read so they can be merged.
 *
 * This file exists to be deleted one day. Until then it is the only code that
 * knows the old shapes, and it is read-only by design: migration proposes a
 * registry and never edits, moves or empties a legacy file. A professor who
 * runs `ainar connections migrate` and then decides against it has lost
 * nothing, and the two tools that still read the old locations keep working
 * unchanged in the meantime.
 *
 * ## The one thing that is deliberately not carried over
 *
 * A literal token. `~/.professor/connections.json` allows one, and the profile
 * on this machine uses it. Copying it into the new file would move a secret
 * from one plaintext file to another and call it a migration. So the value is
 * left where it is, never read into a variable that gets printed, and the
 * migration reports that it found one — because a token that has been sitting
 * in a config file should be revoked at the provider, not relocated.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readTomlTable } from "../lms/canvas-api.ts";
import { rosterDir } from "../roster.ts";
import {
  type Connection,
  type ConnectionType,
  DEFAULT_TOKEN_ENV,
  readConnection,
} from "./index.ts";

/** Where `prof-publish` keeps its profiles. */
export const PROFILES_ENV = "PROFESSOR_CONNECTIONS";

export const profilesPath = (explicit?: string | null): string => {
  if (explicit) return explicit;
  const fromEnv = (process.env[PROFILES_ENV] ?? "").trim();
  if (fromEnv) return fromEnv;
  return join(homedir(), ".professor", "connections.json");
};

/** One thing found in a legacy location, and where it was found. */
export interface Found {
  connection: Connection;
  source: string;
  /** A secret was in the file this came from; it was not copied. */
  secretLeftBehind: boolean;
}

/**
 * A readable name for a host: `canvas.narxoz.kz` and `narxoz.instructure.com`
 * both become `narxoz`.
 *
 * The institution is the part a professor recognises, and it is never the
 * label that says which product it is. Getting this wrong costs nothing — the
 * name is a handle and can be edited in the file — so a heuristic is the right
 * amount of machinery.
 */
const GENERIC = new Set(["canvas", "www", "lms", "moodle", "elearning", "learn", "instructure"]);

export const nameForHost = (type: ConnectionType, baseUrl: string | null): string => {
  if (!baseUrl) return `${type}-main`;
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return `${type}-main`;
  }
  const labels = host.split(".").filter(Boolean);
  const chosen = labels.find((label) => !GENERIC.has(label.toLowerCase()) && label.length > 2);
  return `${type}-${(chosen ?? labels[0] ?? "main").toLowerCase()}`;
};

const isFile = (path: string): boolean => {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * `~/.ainar/roster/lms.toml`, plus the two variables that could stand in for it.
 *
 * `AINAR_CANVAS_URL` is carried because a professor who set it has told us the
 * host as surely as one who wrote it in the file, and a migration that ignored
 * it would produce a registry with no Canvas in it on a machine where Canvas
 * demonstrably works.
 */
export const fromLmsToml = (directory?: string | null): Found[] => {
  const where = rosterDir(directory);
  const path = join(where, "lms.toml");
  const found: Found[] = [];

  const canvas = readTomlTable(path, "canvas");
  const host = (process.env.AINAR_CANVAS_URL ?? "").trim() || canvas.base_url || null;
  if (host) {
    const source = canvas.base_url ? path : "AINAR_CANVAS_URL";
    found.push({
      connection: readConnection(nameForHost("canvas", host), {
        type: "canvas",
        baseUrl: host,
        tokenEnv: DEFAULT_TOKEN_ENV.canvas,
      }),
      source,
      secretLeftBehind: Boolean(String(canvas.token ?? "").trim()),
    });
  }

  const sheets = readTomlTable(path, "sheets");
  const keyFile =
    (process.env.AINAR_SHEETS_KEY ?? "").trim() ||
    sheets.key_file ||
    (isFile(join(where, "sheets-key.json")) ? join(where, "sheets-key.json") : null);
  if (keyFile) {
    found.push({
      connection: readConnection("sheets-personal", {
        type: "sheets",
        tokenEnv: DEFAULT_TOKEN_ENV.sheets,
        keyFile,
      }),
      source: sheets.key_file ? path : "a service-account key beside the roster",
      secretLeftBehind: Boolean(String(sheets.token ?? "").trim()),
    });
  }

  return found;
};

/**
 * `~/.professor/connections.json`, the profiles `prof-publish` publishes with.
 *
 * The profile's own name is kept. It is what the professor types after
 * `--profile`, and what the publishing skills have written down; renaming it
 * during a migration would break the one thing about the old setup that works.
 */
export const fromProfiles = (explicit?: string | null): Found[] => {
  const path = profilesPath(explicit);
  if (!isFile(path)) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
  const table = parsed?.profiles;
  if (!table || typeof table !== "object" || Array.isArray(table)) return [];

  return Object.entries(table).map(([name, raw]) => {
    const profile = (raw ?? {}) as Record<string, unknown>;
    const type = String(profile.type ?? "");
    const known = (["canvas", "moodle", "telegram"] as string[]).includes(type)
      ? (type as ConnectionType)
      : ("canvas" as ConnectionType);

    // The old bare fallbacks — CANVAS_TOKEN and friends — are not carried
    // forward as names. A variable without a prefix is one any tool on the
    // machine may also be using, and this one can change a grade. A profile
    // that named its own `tokenEnv` keeps it: that is a choice, not a default.
    const named = String(profile.tokenEnv ?? "").trim();

    return {
      connection: readConnection(name, {
        type,
        baseUrl: profile.baseUrl,
        tokenEnv: named || DEFAULT_TOKEN_ENV[known],
        courseId: profile.courseId,
        chatId: profile.chatId,
        forumId: profile.forumId,
      }),
      source: path,
      secretLeftBehind: Boolean(String(profile.token ?? "").trim()),
    };
  });
};

/** Everything the old locations know, in one list. */
export const discover = (
  { rosterDirectory, profiles }: { rosterDirectory?: string | null; profiles?: string | null } = {},
): Found[] => [...fromLmsToml(rosterDirectory), ...fromProfiles(profiles)];

/**
 * Merge what was found into what already exists, without ever overwriting.
 *
 * An existing connection wins on its name: the registry is the file the
 * professor edits, and a migration re-run must not undo an edit. A discovered
 * connection whose name is taken but whose content differs is offered under a
 * suffixed name rather than dropped, so nothing found is silently lost.
 */
export const merge = (
  existing: Connection[],
  found: Found[],
): { connections: Connection[]; added: Connection[]; skipped: Found[] } => {
  const byName = new Map(existing.map((connection) => [connection.name, connection]));
  const added: Connection[] = [];
  const skipped: Found[] = [];

  const same = (left: Connection, right: Connection): boolean =>
    left.type === right.type &&
    left.baseUrl === right.baseUrl &&
    left.courseId === right.courseId &&
    left.chatId === right.chatId;

  for (const entry of found) {
    const taken = byName.get(entry.connection.name);
    if (taken) {
      if (same(taken, entry.connection)) {
        skipped.push(entry);
        continue;
      }
      let suffix = 2;
      let candidate = `${entry.connection.name}-${suffix}`;
      while (byName.has(candidate)) {
        suffix += 1;
        candidate = `${entry.connection.name}-${suffix}`;
      }
      const renamed = { ...entry.connection, name: candidate };
      byName.set(candidate, renamed);
      added.push(renamed);
      continue;
    }
    byName.set(entry.connection.name, entry.connection);
    added.push(entry.connection);
  }

  return { connections: [...byName.values()], added, skipped };
};
