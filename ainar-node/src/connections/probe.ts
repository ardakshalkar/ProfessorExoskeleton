/**
 * `ainar connections doctor` — does this connection actually work?
 *
 * Every check here is a read. Nothing a probe does changes a grade, posts a
 * message, or writes a cell, and that is a property worth keeping: `doctor` is
 * the command a professor runs when something is already wrong, which is
 * exactly when they should not have to weigh whether running it is safe.
 *
 * What each probe proves is narrower than "it works", and the wording says so.
 * A Canvas profile read proves the host answers and the token is live; it does
 * not prove the token can grade the course in question, because finding that
 * out means naming a course and reading its assignments, which is a different
 * question from "is this connection configured".
 *
 * Requests go through the same injectable transport as the Canvas and Sheets
 * clients, so the tests exercise every branch without one leaving the machine.
 */

import { type Transport, FetchTransport, TransportError, json } from "../lms/http.ts";
import { ServiceAccount, StaticToken } from "../lms/sheets.ts";
import {
  type Connection,
  hintFor,
  keyFilePath,
  tokenFor,
  tokenPresent,
  usable,
} from "./index.ts";

export interface Probe {
  name: string;
  type: string;
  /** The connection answered and the credential was accepted. */
  ok: boolean;
  /** Nothing was attempted — the configuration was broken, or the token absent. */
  checked: boolean;
  /** Who or what answered: a Canvas user, a bot username, a Moodle site. */
  identity: string | null;
  detail: string;
}

const failed = (connection: Connection, detail: string, checked = true): Probe => ({
  name: connection.name,
  type: connection.type,
  ok: false,
  checked,
  identity: null,
  detail,
});

const answered = (connection: Connection, identity: string | null, detail: string): Probe => ({
  name: connection.name,
  type: connection.type,
  ok: true,
  checked: true,
  identity,
  detail,
});

/** A provider's own words, when it bothered to say anything. */
const detailOf = (body: string): string => {
  try {
    const payload = JSON.parse(body);
    for (const key of ["message", "error", "errors", "description", "exception"]) {
      const found = payload?.[key];
      if (typeof found === "string" && found) return found;
      if (Array.isArray(found) && found.length) {
        const first = found[0];
        return String(typeof first === "object" ? (first?.message ?? JSON.stringify(first)) : first);
      }
    }
  } catch {
    // Not JSON. The first line of whatever it was is more use than nothing.
  }
  return body.split("\n")[0]?.slice(0, 160).trim() || "no detail";
};

// --------------------------------------------------------------------------
// Per provider
// --------------------------------------------------------------------------

/** Canvas: who does this token belong to? */
const probeCanvas = async (connection: Connection, transport: Transport): Promise<Probe> => {
  const response = await transport.request(
    "GET",
    `${connection.baseUrl}/api/v1/users/self/profile`,
    { headers: { Authorization: `Bearer ${tokenFor(connection)}`, Accept: "application/json" } },
  );
  if (response.status === 401 || response.status === 403) {
    return failed(
      connection,
      `Canvas refused the token (${response.status}): ${detailOf(response.body)}. ` +
        `Check ${connection.tokenEnv} is current — ${hintFor(connection)}`,
    );
  }
  if (response.status < 200 || response.status >= 300) {
    return failed(connection, `Canvas returned ${response.status}: ${detailOf(response.body)}`);
  }
  const payload = json(response) ?? {};
  return answered(
    connection,
    payload.name ?? payload.login_id ?? (payload.id ? String(payload.id) : null),
    "the host answered and the token is live. Whether it can grade a particular " +
      "course is a separate question, and `ainar lms plan` is what answers it.",
  );
};

/**
 * Moodle: `core_webservice_get_site_info`, by POST.
 *
 * Moodle's REST endpoint takes the token as a parameter, and every example in
 * its documentation puts it in the query string. POST puts it in the body
 * instead, which keeps a credential out of URLs, proxy logs and shell history
 * for the price of one extra header.
 */
const probeMoodle = async (connection: Connection, transport: Transport): Promise<Probe> => {
  const body = new URLSearchParams({
    wstoken: tokenFor(connection),
    wsfunction: "core_webservice_get_site_info",
    moodlewsrestformat: "json",
  });
  const response = await transport.request(
    "POST",
    `${connection.baseUrl}/webservice/rest/server.php`,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new TextEncoder().encode(body.toString()),
    },
  );
  if (response.status < 200 || response.status >= 300) {
    return failed(connection, `Moodle returned ${response.status}: ${detailOf(response.body)}`);
  }
  const payload = json(response) ?? {};
  // Moodle answers 200 and puts the refusal in the body, so the status alone
  // would report a dead token as a working connection.
  if (payload.exception) {
    return failed(
      connection,
      `Moodle refused the token: ${payload.message ?? payload.errorcode ?? payload.exception}. ` +
        hintFor(connection),
    );
  }
  return answered(
    connection,
    payload.sitename ?? payload.username ?? null,
    "the site answered and the web-service token is live.",
  );
};

/**
 * Telegram: `getMe`.
 *
 * The Bot API puts the token in the path and offers no alternative, so this is
 * the one probe that cannot keep a credential out of a URL. It goes to
 * api.telegram.org over HTTPS and the URL is never logged or printed by this
 * code, which is as much as can be done about it.
 */
const probeTelegram = async (connection: Connection, transport: Transport): Promise<Probe> => {
  const response = await transport.request(
    "GET",
    `https://api.telegram.org/bot${tokenFor(connection)}/getMe`,
    { headers: { Accept: "application/json" } },
  );
  const payload = json(response) ?? {};
  if (response.status < 200 || response.status >= 300 || payload.ok !== true) {
    return failed(
      connection,
      `Telegram refused (${response.status}): ${payload.description ?? detailOf(response.body)}. ` +
        hintFor(connection),
    );
  }
  const bot = payload.result ?? {};
  return answered(
    connection,
    bot.username ? `@${bot.username}` : (bot.first_name ?? null),
    `the bot is live. It still needs permission to post at ${connection.chatId}, ` +
      "which only a post can prove.",
  );
};

/**
 * Sheets: exchange the service-account assertion, or report the token.
 *
 * A service-account key can be proved outright — the exchange either returns an
 * access token or it does not. A bare `AINAR_SHEETS_TOKEN` cannot: verifying it
 * means reading a spreadsheet, and the connection does not name one. Saying
 * that is better than a green tick that stands for nothing.
 */
const probeSheets = async (connection: Connection, transport: Transport): Promise<Probe> => {
  const key = keyFilePath(connection);
  if (key) {
    const account = new ServiceAccount(key);
    await account.token(transport);
    return answered(
      connection,
      account.clientEmail,
      "Google accepted the service-account key. Share each spreadsheet with that " +
        "address as an editor, or a write will still be refused.",
    );
  }
  new StaticToken(tokenFor(connection));
  return answered(
    connection,
    null,
    `${connection.tokenEnv} is set. Its validity is not checked here — that needs ` +
      "a spreadsheet to read, and this connection names none.",
  );
};

// --------------------------------------------------------------------------

/**
 * Check one connection.
 *
 * Broken configuration and a missing credential are reported without a request
 * being made: there is nothing to learn from asking a host we already know we
 * cannot address, and every attempt spends the professor's API quota.
 */
export const probe = async (
  connection: Connection,
  transport: Transport = new FetchTransport(),
): Promise<Probe> => {
  if (!usable(connection)) {
    const first = connection.issues.find((issue) => issue.severity === "error");
    return failed(connection, first?.message ?? "the connection is not usable", false);
  }
  // Sheets can authenticate with a key file instead, so absence of the variable
  // is only fatal for the other three.
  if (!tokenPresent(connection) && !(connection.type === "sheets" && connection.keyFile)) {
    return failed(
      connection,
      `${connection.tokenEnv} is not set. ${hintFor(connection)}`,
      false,
    );
  }

  try {
    if (connection.type === "canvas") return await probeCanvas(connection, transport);
    if (connection.type === "moodle") return await probeMoodle(connection, transport);
    if (connection.type === "telegram") return await probeTelegram(connection, transport);
    return await probeSheets(connection, transport);
  } catch (error) {
    // A transport failure is "the request never happened", which is a different
    // thing to report than a refusal — and neither is a reason to crash a
    // command whose whole job is to survey several connections at once.
    const message = error instanceof TransportError ? error.message : (error as Error).message;
    return failed(connection, message);
  }
};

/** Check several, one after another. Sequential on purpose: rate limits. */
export const probeAll = async (
  connections: Connection[],
  transport: Transport = new FetchTransport(),
): Promise<Probe[]> => {
  const results: Probe[] = [];
  for (const connection of connections) results.push(await probe(connection, transport));
  return results;
};
