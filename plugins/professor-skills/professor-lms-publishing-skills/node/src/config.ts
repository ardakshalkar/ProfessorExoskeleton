import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ConnectionProfile, ConnectionsFile, Publication } from "./types.ts";

export function defaultConnectionsPath(): string {
  return resolve(homedir(), ".professor", "connections.json");
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read JSON ${path}: ${detail}`);
  }
}

export async function loadProfile(path: string, name: string): Promise<ConnectionProfile> {
  const parsed = await readJson(path) as Partial<ConnectionsFile>;
  if (!parsed || typeof parsed !== "object" || !parsed.profiles || typeof parsed.profiles !== "object") {
    throw new Error(`connections file ${path} must contain a profiles object`);
  }
  const profile = parsed.profiles[name];
  if (!profile) throw new Error(`profile ${name} was not found in ${path}`);
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

export function resolveToken(profile: ConnectionProfile): string {
  if (profile.tokenEnv) {
    const value = process.env[profile.tokenEnv];
    if (!value) throw new Error(`environment variable ${profile.tokenEnv} is not set`);
    return value;
  }
  if (profile.token) return profile.token;
  const fallback = { canvas: "CANVAS_TOKEN", moodle: "MOODLE_TOKEN", telegram: "TELEGRAM_BOT_TOKEN" }[profile.type];
  const value = process.env[fallback];
  if (!value) throw new Error(`profile needs tokenEnv or token (fallback ${fallback} is not set)`);
  return value;
}

export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`invalid baseUrl: ${value}`); }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("baseUrl must use HTTPS (HTTP is allowed only for localhost tests)");
  }
  return url.toString().replace(/\/$/, "");
}
