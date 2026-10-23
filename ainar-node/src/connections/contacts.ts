/**
 * When each service outside the machine last answered, and when it last did
 * not — so "Google Sheets: up to date" can also say "worked today 15:58, the
 * last try failed at 16:04 because Google could not be reached".
 *
 * Kept by host, not by service: the transport is the one place every request
 * passes through, and it knows the URL, not what the URL is for. The pane
 * turns hosts into services (Canvas is whatever host the run names).
 *
 * `~/.ainar/contacts.json`, beside the client file and the connections
 * registry, because a network failure is the machine's, not a run's. Only
 * times, a status and a sentence; never a URL's query, a body or a token.
 * Best effort, as `markExpired`: a sandboxed session cannot write here, and the
 * request it is reporting still answers its caller.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CONTACTS_ENV = "AINAR_CONTACTS";

export interface Contact {
  /** The last request that got an answer the caller could use. */
  worked: string | null;
  /** The last one that did not: unreachable, refused or a server error. */
  failed: string | null;
  /** Why it failed, in a sentence. */
  said: string | null;
  /** The status of that failure, when there was an answer at all. */
  status: number | null;
}

export const contactsPath = (): string => {
  const fromEnv = (process.env[CONTACTS_ENV] ?? "").trim();
  return fromEnv || join(homedir(), ".ainar", "contacts.json");
};

export const loadContacts = (): Record<string, Contact> => {
  try {
    const parsed = JSON.parse(readFileSync(contactsPath(), "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Whether an answer means the service worked. A refusal of the sign-in (401,
 * 403), too many requests (429) and a server error (5xx) are the service not
 * working; a 404 or a 422 is the service working and saying no to one request,
 * which is the caller's to report.
 */
export const workedWith = (status: number): boolean => status < 400 || (status < 500 && ![401, 403, 429].includes(status));

/** One request's outcome. `status` null is "never reached". */
export const noteContact = (url: string, status: number | null, said: string | null = null): void => {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  try {
    const contacts = loadContacts();
    const at = new Date().toISOString();
    const entry: Contact = Object.assign({ worked: null, failed: null, said: null, status: null }, contacts[host]);
    if (status !== null && workedWith(status)) entry.worked = at;
    else Object.assign(entry, { failed: at, said: said ?? `answered ${status}`, status });
    contacts[host] = entry;
    const path = contactsPath();
    mkdirSync(dirname(path), { recursive: true });
    // Two processes may note at once (the pane and a CLI it spawned): a whole
    // file renamed into place, so neither reads half of the other's.
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(contacts, null, 2) + "\n", "utf-8");
    renameSync(temporary, path);
  } catch {
    // The request's own answer still reaches its caller.
  }
};
