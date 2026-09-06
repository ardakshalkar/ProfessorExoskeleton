import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  JwtAccessTokenVerifier,
  OAuthError,
  oauthConfigFromEnv,
  protectedResourceMetadata,
} from "../src/mcp/oauth.ts";

const config = oauthConfigFromEnv({
  AINAR_OAUTH_ISSUER: "https://auth.example.edu",
  AINAR_MCP_RESOURCE: "https://mcp.example.edu/mcp",
  AINAR_OAUTH_JWKS_URI: "https://auth.example.edu/.well-known/jwks.json",
  AINAR_OAUTH_REQUIRED_SCOPES: "courses:read students:read",
})!;

test("OAuth resource metadata advertises one canonical resource and issuer", () => {
  assert.deepEqual(protectedResourceMetadata(config), {
    resource: "https://mcp.example.edu/mcp",
    authorization_servers: ["https://auth.example.edu"],
    scopes_supported: [
      "courses:read",
      "students:read",
      "drafts:write",
      "approvals:write",
      "grades:write",
      "integrations:publish",
    ],
  });
});

test("JWT verification binds subject, audience, expiry and scopes", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" };
  const verifier = new JwtAccessTokenVerifier(config, createLocalJWKSet({ keys: [jwk] }));

  const sign = (audience: string, scope: string) =>
    new SignJWT({ scope, client_id: "claude-or-chatgpt" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://auth.example.edu")
      .setAudience(audience)
      .setSubject("professor-123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

  const valid = await verifier.verifyAccessToken(
    await sign("https://mcp.example.edu/mcp", "courses:read students:read"),
  );
  assert.equal(valid.extra?.subject, "professor-123");
  assert.equal(valid.clientId, "claude-or-chatgpt");

  await assert.rejects(
    verifier.verifyAccessToken(await sign("https://other.example.edu", "courses:read students:read")),
    OAuthError,
  );
  await assert.rejects(
    verifier.verifyAccessToken(await sign("https://mcp.example.edu/mcp", "courses:read")),
    /missing scope.*students:read/,
  );
});
