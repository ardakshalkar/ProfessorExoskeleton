import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import {
  CLIENT_ENV,
  RECONNECT,
  REFRESH_TOKEN_ENV,
  authorizationUrl,
  clientConfig,
  emailOf,
  exchangeCode,
  expiredAt,
  expiredPath,
  loopbackRedirect,
  pkce,
  refreshAccess,
  revoke,
} from "../src/connections/google.ts";
import { loadRegistry, readConnection } from "../src/connections/index.ts";
import { probe } from "../src/connections/probe.ts";
import { runConnections } from "../src/connections/command.ts";
import { forgetCredentials } from "../src/connections/store.ts";
import { OAuthRefresh, SheetsError, forgetAccessTokens, loadCredentials } from "../src/lms/sheets.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";

/**
 * Connect Google (E30, GAU-2/GAU-3) without Google: every exchange is a
 * `RecordedTransport` answer, every file is in a temporary directory, and the
 * refresh token comes from the environment the way a CLI run would see it.
 */

const scratch = (): string => mkdtempSync(join(tmpdir(), "ainar-google-"));
const response = (status: number, body: unknown): Response => ({
  status,
  body: typeof body === "string" ? body : JSON.stringify(body),
  headers: {},
});

const clientFile = (content: unknown): string => {
  const path = join(scratch(), "google-client.json");
  writeFileSync(path, JSON.stringify(content), "utf-8");
  return path;
};

// Never the real credential store: once the professor connects, the real one
// holds a refresh token, and "nothing saved" would stop being true here.
process.env.DSH_HOME = scratch();

const DESKTOP ={ installed: { client_id: "abc.apps.googleusercontent.com", client_secret: "GOCSPX-x" } };

const saved = { client: process.env[CLIENT_ENV], refresh: process.env[REFRESH_TOKEN_ENV], sheets: process.env.AINAR_SHEETS_TOKEN };
afterEach(() => {
  for (const [name, value] of [
    [CLIENT_ENV, saved.client],
    [REFRESH_TOKEN_ENV, saved.refresh],
    ["AINAR_SHEETS_TOKEN", saved.sheets],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  forgetCredentials();
  forgetAccessTokens();
});

/** An ID token whose payload says `email`. Unsigned: `emailOf` only labels. */
const idToken = (email: string): string =>
  ["e30", Buffer.from(JSON.stringify({ email })).toString("base64url"), "sig"].join(".");

test("the client file: Desktop is read, Web is refused with the fix, absence is null", () => {
  assert.deepEqual(clientConfig(clientFile(DESKTOP))?.clientId, "abc.apps.googleusercontent.com");
  assert.throws(() => clientConfig(clientFile({ web: { client_id: "w" } })), /Desktop app client/);
  assert.equal(clientConfig(join(scratch(), "missing.json")), null);
});

test("PKCE: the challenge is the S256 of the verifier", () => {
  const { verifier, challenge } = pkce();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.ok(verifier.length >= 43);
});

test("the sign-in URL asks for offline access, consent, PKCE and the sheets scope", () => {
  const client = clientConfig(clientFile(DESKTOP))!;
  const url = new URL(
    authorizationUrl(client, { redirectUri: "http://127.0.0.1:3080/professor-pane/api/google/callback", state: "s1", challenge: "c1" }),
  );
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.match(url.searchParams.get("scope")!, /auth\/spreadsheets/);
});

test("only a loopback http redirect is accepted", () => {
  assert.ok(loopbackRedirect("http://127.0.0.1:3080/x"));
  assert.ok(loopbackRedirect("http://localhost:3080/x"));
  assert.ok(!loopbackRedirect("https://professor.prof-exo.com/x"));
  assert.ok(!loopbackRedirect("http://10.0.0.5:3080/x"));
});

test("a code becomes a refresh token and the account it signed in as", async () => {
  const client = clientConfig(clientFile(DESKTOP))!;
  const transport = new RecordedTransport({
    "POST /token": response(200, {
      access_token: "ya29.a",
      refresh_token: "1//r",
      scope: "openid email https://www.googleapis.com/auth/spreadsheets",
      id_token: idToken("prof@example.edu"),
    }),
  });
  const granted = await exchangeCode(client, { code: "4/c", verifier: "v", redirectUri: "http://127.0.0.1:1/cb" }, transport);
  assert.equal(granted.refreshToken, "1//r");
  assert.equal(granted.email, "prof@example.edu");
  const sent = new URLSearchParams(transport.bodies()[0]);
  assert.equal(sent.get("code_verifier"), "v");
  assert.equal(sent.get("grant_type"), "authorization_code");
});

test("a sign-in with no refresh token, or without the sheets box ticked, is refused", async () => {
  const client = clientConfig(clientFile(DESKTOP))!;
  const args = { code: "c", verifier: "v", redirectUri: "http://127.0.0.1:1/cb" };
  await assert.rejects(
    exchangeCode(client, args, new RecordedTransport({ "POST /token": response(200, { access_token: "a", scope: "x" }) })),
    /no refresh token/,
  );
  await assert.rejects(
    exchangeCode(
      client,
      args,
      new RecordedTransport({ "POST /token": response(200, { access_token: "a", refresh_token: "r", scope: "openid email" }) }),
    ),
    /edit spreadsheets/,
  );
});

test("a revoked grant reads as Reconnect, not as an HTTP code", async () => {
  const client = clientConfig(clientFile(DESKTOP))!;
  const transport = new RecordedTransport({
    "POST /token": response(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }),
  });
  await assert.rejects(refreshAccess(client, "1//r", transport), (error: Error) => error.message === RECONNECT);

  const other = new RecordedTransport({ "POST /token": response(401, { error: "invalid_client" }) });
  await assert.rejects(refreshAccess(client, "1//r", other), /refused to refresh.*401/);
});

test("revoke: a token Google already forgot counts as done", async () => {
  assert.deepEqual(await revoke("r", new RecordedTransport({ "POST /revoke": response(200, "") })), { revoked: true, detail: null });
  const gone = await revoke("r", new RecordedTransport({ "POST /revoke": response(400, { error: "invalid_token" }) }));
  assert.equal(gone.revoked, true);
});

test("emailOf reads the claim and tolerates junk", () => {
  assert.equal(emailOf(idToken("a@b.c")), "a@b.c");
  assert.equal(emailOf("nonsense"), null);
  assert.equal(emailOf(null), null);
});

// ----------------------------------------------------------------- GAU-3

const oauthRegistry = (): string => {
  const path = join(scratch(), "connections.json");
  writeFileSync(
    path,
    JSON.stringify({
      connections: {
        google: { type: "sheets", tokenEnv: REFRESH_TOKEN_ENV, credential: "oauth", account: "prof@example.edu" },
      },
      defaults: { sheets: "google" },
    }),
    "utf-8",
  );
  return path;
};

test("the registry keeps credential and account, and refuses oauth on anything but sheets", () => {
  const connection = readConnection("google", { type: "sheets", credential: "oauth", account: "a@b.c" });
  assert.equal(connection.credential, "oauth");
  assert.equal(connection.account, "a@b.c");
  assert.equal(connection.issues.length, 0);
  assert.equal(readConnection("x", { type: "canvas", baseUrl: "https://c.edu", credential: "oauth" }).issues[0]?.code, "bad_credential");
});

test("loadCredentials turns an oauth connection into refreshed access tokens, cached until expiry", async () => {
  process.env[CLIENT_ENV] = clientFile(DESKTOP);
  process.env[REFRESH_TOKEN_ENV] = "1//refresh";
  delete process.env.AINAR_SHEETS_TOKEN;
  const credentials = loadCredentials(null, { connectionsPath: oauthRegistry() });
  assert.ok(credentials instanceof OAuthRefresh);
  assert.equal((credentials as OAuthRefresh).account, "prof@example.edu");

  const transport = new RecordedTransport({ "POST /token": [response(200, { access_token: "ya29.one", expires_in: 3599 })] });
  assert.equal(await credentials.token(transport), "ya29.one");
  // A second instance — the next command — reuses the token: one exchange.
  const again = loadCredentials(null, { connectionsPath: oauthRegistry() });
  assert.equal(await again.token(transport), "ya29.one");
  assert.equal(transport.calls.length, 1);
  assert.equal(new URLSearchParams(transport.bodies()[0]).get("refresh_token"), "1//refresh");
});

test("a revoked sign-in surfaces as a SheetsError saying Reconnect", async () => {
  process.env[CLIENT_ENV] = clientFile(DESKTOP);
  process.env[REFRESH_TOKEN_ENV] = "1//dead";
  delete process.env.AINAR_SHEETS_TOKEN;
  const credentials = loadCredentials(null, { connectionsPath: oauthRegistry() });
  const transport = new RecordedTransport({ "POST /token": response(400, { error: "invalid_grant" }) });
  await assert.rejects(credentials.token(transport), (error: Error) => error instanceof SheetsError && /Reconnect Google/.test(error.message));
});

test("a refusal is remembered beside the client file, and a refresh that works forgets it", async () => {
  process.env[CLIENT_ENV] = clientFile(DESKTOP);
  process.env[REFRESH_TOKEN_ENV] = "1//later";
  delete process.env.AINAR_SHEETS_TOKEN;
  assert.equal(expiredAt(), null);
  const credentials = loadCredentials(null, { connectionsPath: oauthRegistry() });

  await assert.rejects(credentials.token(new RecordedTransport({ "POST /token": response(400, { error: "invalid_grant" }) })));
  assert.ok(expiredAt());
  assert.equal(dirname(expiredPath()), dirname(process.env[CLIENT_ENV]!));

  // Google having a bad minute is not an expiry, and does not clear one either.
  await assert.rejects(credentials.token(new RecordedTransport({ "POST /token": response(503, { error: "backend" }) })));
  assert.ok(expiredAt());

  await credentials.token(new RecordedTransport({ "POST /token": response(200, { access_token: "ya29.back" }) }));
  assert.equal(expiredAt(), null);
});

test("an oauth connection with no saved sign-in, or no client file, says which half is missing", () => {
  delete process.env.AINAR_SHEETS_TOKEN;
  delete process.env[REFRESH_TOKEN_ENV];
  process.env[CLIENT_ENV] = clientFile(DESKTOP);
  assert.throws(() => loadCredentials(null, { connectionsPath: oauthRegistry(), connection: "google" }), /Connect Google/);
  process.env[REFRESH_TOKEN_ENV] = "1//r";
  process.env[CLIENT_ENV] = join(scratch(), "gone.json");
  assert.throws(() => loadCredentials(null, { connectionsPath: oauthRegistry(), connection: "google" }), /OAuth client/);
});

test("doctor proves an oauth connection by refreshing it", async () => {
  process.env[CLIENT_ENV] = clientFile(DESKTOP);
  process.env[REFRESH_TOKEN_ENV] = "1//probe";
  const [connection] = loadRegistry(oauthRegistry()).connections;
  const result = await probe(connection!, new RecordedTransport({ "POST /token": response(200, { access_token: "ya29.p" }) }));
  assert.equal(result.ok, true);
  assert.equal(result.identity, "prof@example.edu");

  forgetAccessTokens();
  const dead = await probe(connection!, new RecordedTransport({ "POST /token": response(400, { error: "invalid_grant" }) }));
  assert.equal(dead.ok, false);
  assert.match(dead.detail, /Reconnect Google/);
});

test("connections add --credential oauth, then remove, round-trips and drops the default", async () => {
  const path = join(scratch(), "connections.json");
  const lines: string[] = [];
  const base = {
    name: "google",
    connections: path,
    rosterDir: null,
    profiles: null,
    json: false,
    dryRun: false,
  };
  assert.equal(
    await runConnections(
      { ...base, subcommand: "add", type: "sheets", tokenEnv: REFRESH_TOKEN_ENV, credential: "oauth", account: "a@b.c", makeDefault: true },
      { out: (line) => lines.push(line) },
    ),
    0,
  );
  const written = JSON.parse(readFileSync(path, "utf-8"));
  assert.deepEqual(written.connections.google, { type: "sheets", tokenEnv: REFRESH_TOKEN_ENV, credential: "oauth", account: "a@b.c" });
  assert.equal(written.defaults.sheets, "google");

  assert.equal(await runConnections({ ...base, subcommand: "remove" }, { out: (line) => lines.push(line) }), 0);
  const after = JSON.parse(readFileSync(path, "utf-8"));
  assert.deepEqual(after.connections, {});
  assert.equal(after.defaults, undefined);
});
