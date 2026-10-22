/**
 * Connect Google (E30, GAU-2): the sign-in that lets the Sheets sync reach a
 * professor's own spreadsheets without a service-account key.
 *
 * Three routes, and the order a professor meets them in:
 *
 * * `GET /api/google/start` — answered with a redirect to Google's sign-in,
 *   carrying a PKCE challenge and a one-time `state`. A GET because it is the
 *   target of a link the professor clicks into a new tab; a link cannot POST,
 *   and a sign-in opened by `window.open` after a fetch is a pop-up the
 *   browser blocks. What a stray visit can do is start a sign-in the visitor
 *   then has to finish themselves, as themselves.
 * * `GET /api/google/callback` — where Google sends the browser back. The code
 *   is exchanged here, the refresh token goes through the credential seam into
 *   the harness's store, and `ainar connections add` writes a `sheets`
 *   connection with `credential: oauth` that names the variable and nothing
 *   else. The tab is left showing a sentence and can be closed.
 * * `POST /api/google/disconnect` — revoke at Google, clear the stored token,
 *   remove the connection. In that order, so a refusal at Google still leaves
 *   nothing on this machine.
 *
 * All three are answered before the workspace is resolved: Google's redirect
 * cannot carry the pane's session id, and none of this is about a course. A
 * connection is machine configuration.
 *
 * The redirect is always `http://127.0.0.1:<port>/…` on the port the pane was
 * opened on, which Google accepts for a Desktop client without registration.
 * A pane reached through a proxy or another machine's address is refused up
 * front, because Google would send the browser to a loopback address that is
 * not the one serving it.
 */

import {
  GOOGLE_CONNECTION,
  REFRESH_TOKEN_ENV,
  authorizationUrl,
  clearExpired,
  clientConfig,
  clientPath,
  exchangeCode,
  expiredAt,
  loopbackRedirect,
  newState,
  pkce,
  revoke,
} from "@ainar/core/src/connections/google.ts";
import { FetchTransport } from "@ainar/core/src/lms/http.ts";

import { addConnection, removeConnection } from "./connections.js";
import { BASE, send, sendJson } from "./http.js";
import { escapeText } from "./markdown.js";

/** How long a started sign-in waits for Google to come back. */
const PENDING_MS = 10 * 60 * 1000;

/**
 * Sign-ins in flight, by `state`. In memory on purpose: a harness restart in
 * the middle of one should end it, and a verifier written to disk would be a
 * second secret to clean up.
 */
const pending = new Map();

const sweep = () => {
  const now = Date.now();
  for (const [state, entry] of pending) if (entry.expires < now) pending.delete(state);
};

/** The status Integrations draws: the client file, and whether we are connected. */
export const googleStatus = (registry, refs) => {
  let client = { present: false, path: clientPath(), error: null };
  try {
    const found = clientConfig();
    client = { present: Boolean(found), path: clientPath(), error: null };
  } catch (error) {
    client = { present: true, path: clientPath(), error: String(error?.message ?? error) };
  }
  const connection =
    (registry?.connections ?? []).find((entry) => entry.type === "sheets" && entry.credential === "oauth") ?? null;
  const ref = connection?.tokenEnv ?? REFRESH_TOKEN_ENV;
  const connected = Boolean(connection && refs?.[ref]?.configured);
  return {
    client,
    connection: connection?.name ?? null,
    account: connection?.account ?? null,
    tokenEnv: ref,
    connected,
    // Saved, but the last time anything asked, Google refused it.
    expired: connected ? expiredAt() : null,
    // Recorded but the token is gone, or the token is there and the registry
    // entry is not. Either way, Connect is the fix and the pane says so.
    broken: Boolean(connection) !== Boolean(refs?.[ref]?.configured),
  };
};

/** A plain page for the sign-in tab to finish on. */
const page = (res, title, text, ok) =>
  send(
    res,
    200,
    "text/html; charset=utf-8",
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<title>${escapeText(title)}</title>` +
      "<style>body{margin:0;display:grid;place-items:center;min-height:100vh;" +
      'font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:#fafafa;color:#222}' +
      "main{max-width:34rem;padding:24px}h1{font-size:18px;margin:0 0 8px}" +
      `p{margin:0;color:#555}.mark{color:${ok ? "#1a7f37" : "#b42318"}}` +
      "@media(prefers-color-scheme:dark){body{background:#161616;color:#eee}p{color:#aaa}}</style>" +
      `<main><h1><span class="mark">${ok ? "✓" : "✕"}</span> ${escapeText(title)}</h1>` +
      `<p>${escapeText(text)}</p></main>`,
  );

/** `GET /api/google/start`. */
export const startSignIn = (req, res) => {
  sweep();
  let client;
  try {
    client = clientConfig();
  } catch (error) {
    return page(res, "Google can't be connected yet", String(error?.message ?? error), false);
  }
  if (!client) {
    return page(
      res,
      "Google can't be connected yet",
      `There is no OAuth client at ${clientPath()}. Download the Desktop app client from the Google ` +
        "Cloud console (Google Auth Platform → Clients) and save it there under that name.",
      false,
    );
  }

  const host = String(req.headers.host ?? "");
  const port = /:(\d+)$/.exec(host)?.[1] ?? "80";
  const redirectUri = `http://127.0.0.1:${port}${BASE}/api/google/callback`;
  if (!loopbackRedirect(`http://${host}/`)) {
    return page(
      res,
      "Connect Google from this machine",
      `This pane was opened at ${host}, and Google can only return a sign-in to the machine the ` +
        "harness runs on. Open the pane at http://127.0.0.1:" +
        port +
        " on that machine and connect from there.",
      false,
    );
  }

  const state = newState();
  const { verifier, challenge } = pkce();
  pending.set(state, { verifier, redirectUri, expires: Date.now() + PENDING_MS });
  const url = authorizationUrl(client, { redirectUri, state, challenge });
  res.writeHead(302, { location: url, "cache-control": "no-store" });
  res.end();
};

/** `GET /api/google/callback`. */
export const finishSignIn = async (url, res, credentials) => {
  sweep();
  const state = url.searchParams.get("state") ?? "";
  const entry = pending.get(state);
  // One use only, whatever happens next.
  pending.delete(state);

  const denied = url.searchParams.get("error");
  if (denied) {
    return page(
      res,
      "Google was not connected",
      denied === "access_denied"
        ? "The sign-in was cancelled. Nothing was saved. Close this tab and press Connect Google again when you are ready."
        : `Google answered: ${denied}. Nothing was saved.`,
      false,
    );
  }
  if (!entry) {
    return page(
      res,
      "This sign-in has expired",
      "It was started more than ten minutes ago, or the harness restarted since. Close this tab and press Connect Google again.",
      false,
    );
  }
  if (!credentials.service) {
    return page(
      res,
      "Nowhere to keep the sign-in",
      "No credential provider is mounted in this harness, so the sign-in could not be saved.",
      false,
    );
  }

  let granted;
  try {
    const client = clientConfig();
    if (!client) throw new Error(`The OAuth client at ${clientPath()} has gone.`);
    granted = await exchangeCode(
      client,
      { code: url.searchParams.get("code") ?? "", verifier: entry.verifier, redirectUri: entry.redirectUri },
      new FetchTransport(),
    );
  } catch (error) {
    return page(res, "Google was not connected", String(error?.message ?? error), false);
  }

  try {
    await credentials.service.set(REFRESH_TOKEN_ENV, granted.refreshToken);
  } catch (error) {
    // The grant is live at Google and has nowhere to go. Revoke it rather
    // than leave an orphan the professor cannot see from here.
    await revoke(granted.refreshToken, new FetchTransport()).catch(() => null);
    return page(
      res,
      "Google was not connected",
      `The sign-in worked, but it could not be saved: ${String(error?.message ?? error)}`,
      false,
    );
  }
  clearExpired();

  const added = await addConnection(null, {
    name: GOOGLE_CONNECTION,
    type: "sheets",
    tokenEnv: REFRESH_TOKEN_ENV,
    credential: "oauth",
    account: granted.email,
    makeDefault: true,
  });
  if (added.error) {
    return page(
      res,
      "Saved, but not recorded",
      `The sign-in is saved, but the connection could not be written: ${added.error}`,
      false,
    );
  }

  return page(
    res,
    "Google is connected",
    (granted.email ? `Signed in as ${granted.email}. ` : "") +
      "The grade-sheet syncs can now read and write any spreadsheet that account can edit. " +
      "Close this tab and go back to the pane.",
    true,
  );
};

/** `POST /api/google/disconnect`. */
export const disconnect = async (res, credentials, registry) => {
  const status = googleStatus(registry, {});
  const ref = status.tokenEnv;
  let revoked = null;
  if (credentials.service) {
    let token = null;
    try {
      token = String((await credentials.service.resolve(ref))?.value ?? "").trim() || null;
    } catch {
      token = null;
    }
    if (token) {
      try {
        revoked = await revoke(token, new FetchTransport());
      } catch (error) {
        revoked = { revoked: false, detail: String(error?.message ?? error) };
      }
    }
    try {
      await credentials.service.unset(ref);
    } catch (error) {
      return sendJson(res, 200, { error: `Could not clear the saved sign-in: ${String(error?.message ?? error)}` });
    }
  }
  if (status.connection) {
    const removed = await removeConnection(null, status.connection);
    if (removed.error) return sendJson(res, 200, { error: removed.error });
  }
  clearExpired();
  return sendJson(res, 200, {
    ok: true,
    revoked: revoked ? revoked.revoked : null,
    detail:
      revoked && !revoked.revoked
        ? `Removed here, but Google did not confirm the revocation (${revoked.detail}). ` +
          "Remove it at myaccount.google.com → Security → Third-party access."
        : null,
  });
};
