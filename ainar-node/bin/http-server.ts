/** Remote MCP transport backed by PostgreSQL CourseBundle read models. */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createServer } from "node:http";
import { Pool } from "pg";
import { PostgresTelegramPublisher } from "../src/integrations/telegram.ts";
import { bearerMatches, isLoopbackHost } from "../src/mcp/http-auth.ts";
import {
  loadPostgresCourseStore,
  loadPostgresCourseStoreForIdentity,
} from "../src/store/postgres.ts";
import {
  bearerToken,
  JwtAccessTokenVerifier,
  oauthChallenge,
  oauthConfigFromEnv,
  protectedResourceMetadata,
} from "../src/mcp/oauth.ts";
import { createAinarMcpServer } from "../src/mcp/server.ts";
import { Workspace } from "../src/workspace.ts";

const required = (name: string): string => {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const host = (process.env.AINAR_HOST ?? "127.0.0.1").trim();
const port = Number.parseInt(process.env.AINAR_PORT ?? "8765", 10);
const token = (process.env.AINAR_MCP_TOKEN ?? "").trim();
const telegramToken = (process.env.AINAR_TELEGRAM_BOT_TOKEN ?? "").trim();
const connectionString = required("DATABASE_URL");
const documentRoot = (process.env.AINAR_DOCUMENT_ROOT ?? "").trim() || undefined;
const oauth = oauthConfigFromEnv();
const verifier = oauth ? new JwtAccessTokenVerifier(oauth) : null;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`AINAR_PORT must be an integer from 1 to 65535, got ${process.env.AINAR_PORT}`);
}
if (!isLoopbackHost(host) && !oauth) {
  throw new Error("OAuth configuration is required when AINAR_HOST is not loopback");
}
if (telegramToken && !oauth) {
  throw new Error("AINAR_TELEGRAM_BOT_TOKEN requires OAuth; Telegram is never a local-token integration");
}
if (telegramToken && !oauth?.requiredScopes.includes("integrations:publish")) {
  throw new Error(
    "AINAR_TELEGRAM_BOT_TOKEN requires integrations:publish in AINAR_OAUTH_REQUIRED_SCOPES",
  );
}

const pool = new Pool({ connectionString });
const workspaceProvider = async (authInfo?: AuthInfo) => {
  const options = { documentRoot, label: "PostgreSQL CourseBundle read model" };
  const subject = authInfo?.extra?.subject;
  const issuer = authInfo?.extra?.issuer;
  const store = oauth
    ? await loadPostgresCourseStoreForIdentity(
        pool,
        { subject: String(subject ?? ""), issuer: String(issuer ?? "") },
        options,
      )
    : await loadPostgresCourseStore(pool, options);
  return new Workspace(store);
};
const telegram = telegramToken && oauth
  ? new PostgresTelegramPublisher(pool, telegramToken)
  : undefined;
const server = createAinarMcpServer(workspaceProvider, { telegram });
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);

const httpServer = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;

  if (path === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (oauth && path === oauth.metadataUrl.pathname) {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    });
    response.end(JSON.stringify(protectedResourceMetadata(oauth)));
    return;
  }
  if (path !== "/mcp") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  let authInfo: AuthInfo | undefined;
  if (oauth && verifier) {
    const accessToken = bearerToken(request.headers.authorization);
    try {
      if (!accessToken) throw new Error("missing bearer token");
      authInfo = await verifier.verifyAccessToken(accessToken);
    } catch {
      response.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": oauthChallenge(oauth),
      });
      response.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  } else if (token && !bearerMatches(request.headers.authorization, token)) {
    response.writeHead(401, {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="ainar-mcp"',
    });
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  if (authInfo) (request as typeof request & { auth?: AuthInfo }).auth = authInfo;

  try {
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error("ainar-mcp-http: request failed", error);
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

httpServer.listen(port, host, () => {
  console.error(
    `ainar-mcp-http: listening at http://${host}:${port}/mcp; ` +
      `PostgreSQL is refreshed for every tool call; auth=${oauth ? "oauth" : "local-dev"}`,
  );
});

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  httpServer.close(async () => {
    await transport.close();
    await pool.end();
    process.exit(0);
  });
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
