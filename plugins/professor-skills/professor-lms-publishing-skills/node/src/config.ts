import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ConnectionProfile, ConnectionsFile, Publication } from "./types.ts";

export function defaultConnectionsPath(): string {
  return resolve(homedir(), ".professor", "connections.json");
}

/**
 * The shared registry `ainar connections` owns.
 *
 * Publishing and grading used to keep separate address books, so a professor
 * could have a working Canvas host here and be told by `ainar lms push` that
 * none was configured. This is the merged one; the file above is still read,
 * so nothing that works today stops working.
 */
export function registryPath(): string {
  const fromEnv = (process.env.AINAR_CONNECTIONS ?? "").trim();
  return fromEnv ? resolve(fromEnv) : resolve(homedir(), ".ainar", "connections.json");
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read JSON ${path}: ${detail}`);
  }
}

async function readJsonIfPresent(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    // Missing, unreadable or malformed. The registry is the preferred source
    // but not a required one, and a caller who has only the legacy file must
    // not be stopped by the absence of a file they have never created.
    return null;
  }
}

/**
 * One connection out of the shared registry, in the shape this package speaks.
 *
 * A literal token is refused rather than honoured. The registry's contract is
 * that it holds no secrets, and a `token` key appearing in it means something
 * wrote one there — which is worth stopping for, not working around.
 */
function fromRegistry(entry: Record<string, unknown>, name: string, path: string): ConnectionProfile {
  const type = String(entry.type ?? "");
  if (type === "sheets") {
    throw new Error(
      `connection ${name} is a Google Sheets connection, which publishes nothing. ` +
        "Use `ainar lms push --target sheets-api` for a gradebook.",
    );
  }
  if (!["canvas", "moodle", "telegram"].includes(type)) {
    throw new Error(`connection ${name} in ${path} has unsupported type ${type || "(none)"}`);
  }
  if (typeof entry.token === "string" && entry.token.trim()) {
    throw new Error(
      `connection ${name} in ${path} carries a literal token. The registry holds ` +
        "no secrets: move it to the environment, name the variable in tokenEnv, " +
        "and revoke the one that was in the file.",
    );
  }
  return {
    type: type as ConnectionProfile["type"],
    baseUrl: entry.baseUrl as string,
    tokenEnv: entry.tokenEnv as string | undefined,
    courseId: entry.courseId as string | undefined,
    forumId: entry.forumId as string | undefined,
    chatId: entry.chatId as string | undefined,
  } as ConnectionProfile;
}

/**
 * Find a connection by name: the shared registry first, then the old profiles.
 *
 * Registry first, so that migrating a profile is enough to change where a
 * publish goes. The legacy file is unchanged and still honoured, including its
 * literal `token` — breaking a setup that works is not a migration.
 */
export async function loadProfile(path: string, name: string): Promise<ConnectionProfile> {
  const registry = registryPath();
  const shared = (await readJsonIfPresent(registry)) as { connections?: Record<string, unknown> } | null;
  const entry = shared?.connections?.[name];
  if (entry && typeof entry === "object") {
    return fromRegistry(entry as Record<string, unknown>, name, registry);
  }

  const parsed = await readJson(path) as Partial<ConnectionsFile>;
  if (!parsed || typeof parsed !== "object" || !parsed.profiles || typeof parsed.profiles !== "object") {
    throw new Error(`connections file ${path} must contain a profiles object`);
  }
  const profile = parsed.profiles[name];
  if (!profile) {
    const known = Object.keys(shared?.connections ?? {}).concat(Object.keys(parsed.profiles));
    throw new Error(
      `profile ${name} was not found in ${registry} or ${path}` +
        (known.length ? `. Known: ${[...new Set(known)].sort().join(", ")}` : ""),
    );
  }
  if (!["canvas", "moodle", "telegram"].includes(profile.type)) {
    throw new Error(`profile ${name} has unsupported type ${String(profile.type)}`);
  }
  return profile;
}

export async function loadPublication(path: string): Promise<Publication> {
  const publication = await readJson(path) as Partial<Publication>;
  if (!publication || typeof publication !== "object" || typeof publication.kind !== "string") {
    throw new Error(`publication ${path} must contain a string kind`);
  }
  return publication as Publication;
}

/**
 * The credential, from the variable the profile names.
 *
 * When it names none there are two fallbacks and the order matters: the
 * `AINAR_`-prefixed name that the shared registry writes comes first, and the
 * bare name this package shipped with second. A bare `CANVAS_TOKEN` is a
 * variable any tool on the machine may also be claiming, so it is kept only so
 * that an existing setup does not break.
 */
export function resolveToken(profile: ConnectionProfile): string {
  if (profile.tokenEnv) {
    const value = process.env[profile.tokenEnv];
    if (!value) throw new Error(`environment variable ${profile.tokenEnv} is not set`);
    return value;
  }
  if (profile.token) return profile.token;
  const fallbacks = {
    canvas: ["AINAR_CANVAS_TOKEN", "CANVAS_TOKEN"],
    moodle: ["AINAR_MOODLE_TOKEN", "MOODLE_TOKEN"],
    telegram: ["AINAR_TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"],
  }[profile.type];
  for (const name of fallbacks) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `profile needs tokenEnv or token (neither ${fallbacks.join(" nor ")} is set)`,
  );
}

export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`invalid baseUrl: ${value}`); }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("baseUrl must use HTTPS (HTTP is allowed only for localhost tests)");
  }
  return url.toString().replace(/\/$/, "");
}
