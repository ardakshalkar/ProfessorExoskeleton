/**
 * Google Sheets v4: the professor's gradebook, written in place. Ported from
 * `ainar/lms/sheets.py`.
 *
 * The sheet is a **view**. It is regenerated from professor decisions and is not
 * a source of truth — that is the discipline which stops two gradebooks becoming
 * two answers. But a spreadsheet is also a text box a human types into, and
 * pretending otherwise would mean silently eating a correction. So this target
 * reads the tab before it writes, compares what is there against the decisions
 * and against the ledger, and refuses to overwrite anything it did not put there.
 *
 * Two ways to authenticate, and the choice is about what your IT department
 * allows:
 *
 * **A service account** (recommended). Create one, download its JSON key, share
 * the spreadsheet with the account's email address as an editor. No browser flow,
 * no expiring token.
 *
 * **An access token you already have.** `AINAR_SHEETS_TOKEN`, from
 * `gcloud auth print-access-token` or anywhere else. It expires in an hour, which
 * is fine for a push.
 *
 * ## What the port removed
 *
 * Signing a service-account assertion needs RSA. Python's standard library does
 * not do RSA, so `sheets.py` had an optional `google-auth` dependency and a
 * failure message explaining how to install it or work around it. Node's
 * `crypto` signs RS256 out of the box, so that whole branch is gone: the JWT is
 * built and signed here, exchanged for a token, and there is nothing to install.
 *
 * Requests go through the same injectable transport as the Canvas client, so the
 * tests exercise a real write without one leaving the machine.
 */

import { createSign } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Grid, STUDENT, TOTAL, height, width } from "./grid.ts";
import { type Response, type Transport, FetchTransport, json } from "./http.ts";
import { readTomlTable } from "./canvas-api.ts";

const API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const TOKEN_ENV = "AINAR_SHEETS_TOKEN";
export const KEY_FILE_ENV = "AINAR_SHEETS_KEY";
export const CONFIG_NAME = "lms.toml";

/** Values are written as typed by us — no formula parsing, no locale surprises. */
const INPUT_OPTION = "RAW";

/** Google refused, and said why. */
export class SheetsError extends Error {}

// --------------------------------------------------------------------------
// Credentials
// --------------------------------------------------------------------------

export interface Credentials {
  token(transport: Transport): Promise<string>;
}

/** An access token someone else obtained. Expires; that is their problem. */
export class StaticToken implements Credentials {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  async token(): Promise<string> {
    return this.value;
  }
}

const base64url = (value: Buffer | string): string =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * A service-account key file, exchanged for an access token.
 *
 * The flow is RFC 7523: build a JWT claiming the scope, sign it with the key's
 * private half, and POST it to Google's token endpoint. Sixty lines, no
 * dependency, and every step is visible — which matters on the one path in this
 * workspace that can write into a document a person edits by hand.
 */
export class ServiceAccount implements Credentials {
  keyFile: string;
  private cached: { value: string; expires: number } | null = null;

  constructor(keyFile: string) {
    this.keyFile = keyFile;
  }

  private key(): Record<string, string> {
    let text: string;
    try {
      text = readFileSync(this.keyFile, "utf-8");
    } catch {
      throw new Error(`no service-account key at ${this.keyFile}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${this.keyFile} is not readable as a service-account key`);
    }
  }

  /** Who to share the spreadsheet with. Read from the key file directly. */
  get clientEmail(): string | null {
    try {
      return this.key().client_email ?? null;
    } catch {
      return null;
    }
  }

  async token(transport: Transport): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expires > now + 60) return this.cached.value;

    const key = this.key();
    if (!key.private_key || !key.client_email) {
      throw new Error(
        `${this.keyFile} has no private_key or client_email, so it is not a ` +
          "service-account key. Download a fresh one from the Google Cloud console.",
      );
    }

    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${base64url(signer.sign(key.private_key))}`;

    const response = await transport.request("POST", TOKEN_URL, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new TextEncoder().encode(
        new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      ),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new SheetsError(
        `Google refused the service-account assertion (${response.status}): ` +
          `${response.body.slice(0, 200).trim() || "no detail"}. Check the key is ` +
          "current and that the Sheets API is enabled for its project.",
      );
    }
    const payload = json(response) ?? {};
    if (!payload.access_token) {
      throw new SheetsError("Google returned no access_token for the assertion");
    }
    this.cached = {
      value: String(payload.access_token),
      expires: now + Number(payload.expires_in ?? 3600),
    };
    return this.cached.value;
  }
}

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** A token from the environment if there is one, else a service-account key. */
export const loadCredentials = (directory: string | null = null): Credentials => {
  const token = process.env[TOKEN_ENV];
  if (token) return new StaticToken(token);

  const settings = directory ? readTomlTable(join(directory, CONFIG_NAME), "sheets") : {};
  const keyPath = process.env[KEY_FILE_ENV] || settings.key_file;
  if (keyPath) return new ServiceAccount(keyPath);
  const fallback = directory ? join(directory, "sheets-key.json") : null;
  if (fallback && isFile(fallback)) return new ServiceAccount(fallback);
  throw new Error(
    "no Google credentials. Either:\n" +
      `  · export ${TOKEN_ENV} with an access token, or\n` +
      `  · put a service-account key at ${fallback ?? "~/.ainar/roster/sheets-key.json"}, ` +
      `or name it with ${KEY_FILE_ENV}, and share the spreadsheet with the ` +
      "account's email address as an editor.",
  );
};

/**
 * Accept the id, or the URL it was copied from.
 *
 * Everyone pastes the URL. Refusing it teaches nothing; extracting the id from it
 * is one regex and saves a confusing 404.
 */
export const spreadsheetIdOf = (value: string): string => {
  const cleaned = value.trim();
  if (cleaned.includes("docs.google.com") || cleaned.startsWith("http")) {
    const parts = new URL(cleaned).pathname.split("/").filter(Boolean);
    const index = parts.indexOf("d");
    if (index >= 0 && index + 1 < parts.length) return parts[index + 1]!;
    throw new Error(`could not find a spreadsheet id in ${value}`);
  }
  return cleaned;
};

// --------------------------------------------------------------------------
// A1 notation
// --------------------------------------------------------------------------

/** `Fall 2026` and `A1:Z` become `'Fall 2026'!A1:Z`. */
export const a1 = (tab: string, reference: string): string =>
  `'${tab.replace(/'/g, "''")}'!${reference}`;

/** 0 -> A, 25 -> Z, 26 -> AA. */
export const columnLetter = (index: number): string => {
  let letters = "";
  let current = index + 1;
  while (current) {
    const remainder = (current - 1) % 26;
    current = Math.floor((current - 1) / 26);
    letters = String.fromCharCode(65 + remainder) + letters;
  }
  return letters;
};

// --------------------------------------------------------------------------
// The client
// --------------------------------------------------------------------------

const messageOf = (response: Response): string => {
  let payload: any;
  try {
    payload = json(response);
  } catch {
    return response.body.slice(0, 200).trim() || "no detail";
  }
  if (payload && typeof payload === "object") {
    const error = payload.error;
    if (error && typeof error === "object") {
      return String(error.message ?? error.status ?? JSON.stringify(error));
    }
    if (error) return String(error);
  }
  return response.body.slice(0, 200).trim() || "no detail";
};

export class SheetsClient {
  credentials: Credentials;
  transport: Transport;

  constructor(credentials: Credentials, transport: Transport = new FetchTransport()) {
    this.credentials = credentials;
    this.transport = transport;
  }

  private async headers(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.credentials.token(this.transport)}`,
      Accept: "application/json",
    };
  }

  private check(response: Response, what: string): Response {
    if (response.status >= 200 && response.status < 300) return response;
    const detail = messageOf(response);
    if (response.status === 401 || response.status === 403) {
      throw new SheetsError(
        `Google refused (${response.status}) while ${what}: ${detail}. If this ` +
          "is a service account, share the spreadsheet with its email address " +
          "as an editor — access is not implied by owning the key.",
      );
    }
    if (response.status === 404) {
      throw new SheetsError(
        `no such spreadsheet or range (${what}): ${detail}. Check the id — it ` +
          "is the long string between /d/ and /edit in the URL.",
      );
    }
    if (response.status === 429) {
      throw new SheetsError(
        `Google rate limit reached while ${what}. Wait a minute; nothing ` +
          "partial was written by this call.",
      );
    }
    throw new SheetsError(`Google returned ${response.status} while ${what}: ${detail}`);
  }

  private url(spreadsheetId: string, suffix = "", params?: Record<string, string>): string {
    let url = `${API_ROOT}/${encodeURIComponent(spreadsheetId)}${suffix}`;
    if (params) url += "?" + new URLSearchParams(params).toString();
    return url;
  }

  async tabTitles(spreadsheetId: string): Promise<string[]> {
    const response = this.check(
      await this.transport.request(
        "GET",
        this.url(spreadsheetId, "", { fields: "sheets.properties.title" }),
        { headers: await this.headers() },
      ),
      "reading the spreadsheet",
    );
    const payload = json(response) ?? {};
    return (payload.sheets ?? []).map((sheet: any) => sheet?.properties?.title ?? "");
  }

  async addTab(spreadsheetId: string, title: string): Promise<void> {
    const body = { requests: [{ addSheet: { properties: { title } } }] };
    this.check(
      await this.transport.request("POST", this.url(spreadsheetId, ":batchUpdate"), {
        headers: { ...(await this.headers()), "Content-Type": "application/json" },
        body: new TextEncoder().encode(JSON.stringify(body)),
      }),
      `creating the tab '${title}'`,
    );
  }

  async read(spreadsheetId: string, rangeA1: string): Promise<string[][]> {
    const response = this.check(
      await this.transport.request(
        "GET",
        this.url(spreadsheetId, `/values/${encodeURIComponent(rangeA1)}`, {
          majorDimension: "ROWS",
        }),
        { headers: await this.headers() },
      ),
      `reading ${rangeA1}`,
    );
    const payload = json(response) ?? {};
    return (payload.values ?? []).map((row: any[]) => row.map((cell) => String(cell)));
  }

  async write(spreadsheetId: string, rangeA1: string, values: string[][]): Promise<number> {
    const response = this.check(
      await this.transport.request(
        "PUT",
        this.url(spreadsheetId, `/values/${encodeURIComponent(rangeA1)}`, {
          valueInputOption: INPUT_OPTION,
        }),
        {
          headers: { ...(await this.headers()), "Content-Type": "application/json" },
          body: new TextEncoder().encode(
            JSON.stringify({ range: rangeA1, majorDimension: "ROWS", values }),
          ),
        },
      ),
      `writing ${rangeA1}`,
    );
    const payload = json(response) ?? {};
    return Number(payload.updatedRows ?? values.length);
  }

  async clear(spreadsheetId: string, rangeA1: string): Promise<void> {
    this.check(
      await this.transport.request(
        "POST",
        this.url(spreadsheetId, `/values/${encodeURIComponent(rangeA1)}:clear`),
        {
          headers: { ...(await this.headers()), "Content-Type": "application/json" },
          body: new TextEncoder().encode("{}"),
        },
      ),
      `clearing ${rangeA1}`,
    );
  }
}

// --------------------------------------------------------------------------
// Reading a tab back
// --------------------------------------------------------------------------

/**
 * What the sheet currently holds, per pseudonym.
 *
 * Located by header name rather than by column position, because a professor who
 * inserts a column of their own should not have their sheet misread. A cell that
 * is not a number reads as no value — someone typing "absent" into a gradebook
 * has said something, but not a score.
 */
export const totalsInTab = (
  existing: string[][],
  known?: Set<string> | null,
): Record<string, number | null> => {
  if (!existing.length) return {};
  const header = existing[0]!;
  const studentAt = header.indexOf(STUDENT);
  const totalAt = header.indexOf(TOTAL);
  if (studentAt === -1 || totalAt === -1) return {};

  const found: Record<string, number | null> = {};
  for (const row of existing.slice(1)) {
    if (studentAt >= row.length) continue;
    const studentId = row[studentAt]!.trim();
    if (!studentId || (known && !known.has(studentId))) continue;
    const cell = totalAt < row.length ? row[totalAt]!.trim() : "";
    if (!cell) {
      found[studentId] = null;
      continue;
    }
    const parsed = Number(cell);
    found[studentId] = Number.isFinite(parsed) ? parsed : null;
  }
  return found;
};

/**
 * The rows below the new grid, which a shrinking class would leave behind.
 *
 * Clearing before writing would empty the tab if the write then failed. Writing
 * first and clearing the remainder afterwards never leaves the sheet worse than
 * it started.
 */
export const trailingRange = (tab: string, grid: Grid, existing: string[][]): string | null => {
  if (existing.length <= height(grid)) return null;
  return a1(
    tab,
    `A${height(grid) + 1}:${columnLetter(Math.max(width(grid), 1) - 1)}${existing.length}`,
  );
};
