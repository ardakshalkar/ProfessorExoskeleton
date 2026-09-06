import assert from "node:assert/strict";
import test from "node:test";
import { bearerMatches, isLoopbackHost } from "../src/mcp/http-auth.ts";

test("loopback host detection covers the safe local defaults", () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("LOCALHOST"), true);
  assert.equal(isLoopbackHost("0.0.0.0"), false);
});

test("bearer token comparison rejects missing, malformed and wrong credentials", () => {
  assert.equal(bearerMatches(undefined, "secret"), false);
  assert.equal(bearerMatches("Basic secret", "secret"), false);
  assert.equal(bearerMatches("Bearer wrong", "secret"), false);
  assert.equal(bearerMatches("Bearer secret", "secret"), true);
});

