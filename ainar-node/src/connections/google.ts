/**
 * "Connect Google": OAuth for an installed app, so a professor can give the
 * Sheets sync access without a service-account key (E30, GAU-2 and GAU-3).
 *
 * The flow is RFC 8252 with PKCE (RFC 7636). The pane opens Google's sign-in;
 * Google redirects to the pane's own loopback address with a code; the pane
 * exchanges the code for a refresh token and keeps that in the harness's
 * credential store. Every later request trades the refresh token for an
 * access token here, an hour at a time. No server of ours is in between.
 *
 * ## The client file
 *
 * A Desktop OAuth client is made once in the Google Cloud console and
 * downloaded as JSON. It lives at `~/.ainar/google-client.json` (or wherever
 * `AINAR_GOOGLE_CLIENT` points), beside the connections registry and outside
 * every repository. Google says outright that a desktop client's secret is not
 * a secret — any copy of the app carries it — and PKCE is what actually binds
 * a code to the sign-in that asked for it. It is still kept out of the
 * repository, because the project it belongs to is somebody's.
 *
 * ## Which Google client type
 *
 * Desktop, not Web. Google accepts any `http://127.0.0.1:<port>/<path>` as the
 * redirect for a Desktop client, which is what lets the pane answer on
 * whatever port the harness was started on. A Web client would need every
 * port registered in advance, so `clientConfig` refuses one and says why.
 *
 * Nothing here prints, logs or returns a token to anyone but its caller.
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type Transport, json } from "../lms/http.ts";

export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/**
 * Sheets to read and write; Drive metadata to ask only when a file last
 * changed. The same two the service-account path asks for, so a sheet that
 * works one way works the other. GAU-4 narrows this to `drive.file` once the
 * Picker exists to grant each sheet.
 */
export const SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly";

/** `openid email` on top, so the pane can say which account is connected. */
export const CONNECT_SCOPE = `openid email ${SHEETS_SCOPE}`;

export const CLIENT_ENV = "AINAR_GOOGLE_CLIENT";
export const CLIENT_NAME = "google-client.json";

/** Where the refresh token is kept, by name. The value is in the credential store. */
export const REFRESH_TOKEN_ENV = "AINAR_GOOGLE_REFRESH_TOKEN";

/** The connection "Connect Google" writes. */
export const GOOGLE_CONNECTION = "google";

/** Google said no, or said something this code cannot use. */
export class GoogleAuthError extends Error {
  /** The grant is gone — revoked, expired, or the password changed. Reconnect. */
  revoked: boolean;

  constructor(message: string, revoked = false) {
    super(message);
    this.revoked = revoked;
  }
}

/** What a revoked grant reads as, everywhere. Not an HTTP code. */
export const RECONNECT =
  "Google no longer accepts this sign-in (it was revoked, or has expired). " +
  "Reconnect Google in Integrations → Credentials.";

export interface ClientConfig {
  clientId: string;
  clientSecret: string | null;
  path: string;
}

const expand = (value: string): string =>
  value.startsWith("~") ? resolve(homedir(), value.slice(1).replace(/^[\\/]/, "")) : resolve(value);

export const clientPath = (): string => {
  const fromEnv = (process.env[CLIENT_ENV] ?? "").trim();
  return fromEnv ? expand(fromEnv) : join(homedir(), ".ainar", CLIENT_NAME);
};

/**
 * The downloaded client file, read. Null when there is none; an error when
 * there is one this flow cannot use.
 */
export const clientConfig = (path: string = clientPath()): ClientConfig | null => {
  try {
    if (!statSync(path).isFile()) return null;
  } catch {
    return null;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    throw new GoogleAuthError(`${path} is not JSON. Download the client again from the Google Cloud console.`);
  }
  if (parsed?.web && !parsed?.installed) {
    throw new GoogleAuthError(
      `${path} is a Web application client. Connect Google needs a Desktop app client — ` +
        "Google Cloud console → Google Auth Platform → Clients → Create client → Desktop app.",
    );
  }
  const block = parsed?.installed ?? parsed;
  const clientId = String(block?.client_id ?? "").trim();
  if (!clientId) throw new GoogleAuthError(`${path} names no client_id.`);
  const secret = String(block?.client_secret ?? "").trim();
  return { clientId, clientSecret: secret || null, path };
};

const base64url = (value: Buffer): string =>
  value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A PKCE verifier and its S256 challenge. */
export const pkce = (): { verifier: string; challenge: string } => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

/** An unguessable `state`, which is what ties the callback to this sign-in. */
export const newState = (): string => base64url(randomBytes(24));

/**
 * Whether a redirect is one Google accepts for a Desktop client, and one that
 * stays on this machine. Checked before Google is ever asked, so a pane opened
 * through a proxy says so instead of sending the professor to an error page.
 */
export const loopbackRedirect = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
};

/**
 * Google's sign-in address. `access_type=offline` and `prompt=consent` are
 * what make Google return a refresh token every time, including to somebody
 * reconnecting after a Disconnect.
 */
export const authorizationUrl = (
  client: ClientConfig,
  { redirectUri, state, challenge, loginHint }: { redirectUri: string; state: string; challenge: string; loginHint?: string | null },
): string => {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CONNECT_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params.toString()}`;
};

const form = (fields: Record<string, string | null>): Uint8Array => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value) params.set(key, value);
  return new TextEncoder().encode(params.toString());
};

const FORM = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };

/** Google's own words for a refusal: `error_description`, else `error`. */
const refusal = (body: string): { code: string; text: string } => {
  try {
    const payload = JSON.parse(body);
    return {
      code: String(payload?.error ?? ""),
      text: String(payload?.error_description ?? payload?.error ?? "").trim() || "no detail",
    };
  } catch {
    return { code: "", text: body.slice(0, 160).trim() || "no detail" };
  }
};

/**
 * The email in an ID token, read without verifying it. Safe here only because
 * the token came straight from Google's token endpoint over TLS in answer to
 * our own request — it is a label for the pane, never an authorisation.
 */
export const emailOf = (idToken: string | null | undefined): string | null => {
  const part = String(idToken ?? "").split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"));
    return typeof claims?.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
};

export interface Granted {
  refreshToken: string;
  email: string | null;
  scope: string;
}

/** Trade the callback's code for a refresh token. */
export const exchangeCode = async (
  client: ClientConfig,
  { code, verifier, redirectUri }: { code: string; verifier: string; redirectUri: string },
  transport: Transport,
): Promise<Granted> => {
  const response = await transport.request("POST", TOKEN_URL, {
    headers: FORM,
    body: form({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    const { text } = refusal(response.body);
    throw new GoogleAuthError(`Google refused the sign-in (${response.status}): ${text}.`);
  }
  const payload = json(response) ?? {};
  if (!payload.refresh_token) {
    throw new GoogleAuthError(
      "Google signed you in but sent no refresh token, so the connection would last an hour. " +
        "Remove Professor Exoskeleton at myaccount.google.com → Security → Third-party access, then connect again.",
    );
  }
  const scope = String(payload.scope ?? "");
  if (!scope.includes("auth/spreadsheets")) {
    throw new GoogleAuthError(
      "Google connected without permission to edit spreadsheets — the box for it was left unticked. " +
        "Connect again and allow it.",
    );
  }
  return { refreshToken: String(payload.refresh_token), email: emailOf(payload.id_token), scope };
};

/** An hour's access token, from the refresh token. */
export const refreshAccess = async (
  client: ClientConfig,
  refreshToken: string,
  transport: Transport,
): Promise<{ value: string; expiresIn: number }> => {
  const response = await transport.request("POST", TOKEN_URL, {
    headers: FORM,
    body: form({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    const { code, text } = refusal(response.body);
    // `invalid_grant` is the one that means "this sign-in is over". Everything
    // else is a misconfigured client or Google having a bad minute, and saying
    // "reconnect" for those would send the professor round a loop that cannot
    // fix them.
    if (code === "invalid_grant") throw new GoogleAuthError(RECONNECT, true);
    throw new GoogleAuthError(`Google refused to refresh the sign-in (${response.status}): ${text}.`);
  }
  const payload = json(response) ?? {};
  if (!payload.access_token) throw new GoogleAuthError("Google returned no access_token for the refresh.");
  return { value: String(payload.access_token), expiresIn: Number(payload.expires_in ?? 3600) };
};

/**
 * Tell Google to forget the grant. A token Google already forgot answers 400,
 * which is the outcome Disconnect wanted, so it counts as done.
 */
export const revoke = async (refreshToken: string, transport: Transport): Promise<{ revoked: boolean; detail: string | null }> => {
  const response = await transport.request("POST", REVOKE_URL, {
    headers: FORM,
    body: form({ token: refreshToken }),
  });
  if (response.status >= 200 && response.status < 300) return { revoked: true, detail: null };
  const { code, text } = refusal(response.body);
  if (response.status === 400 && code === "invalid_token") return { revoked: true, detail: "Google had already forgotten it" };
  return { revoked: false, detail: `Google answered ${response.status}: ${text}` };
};
