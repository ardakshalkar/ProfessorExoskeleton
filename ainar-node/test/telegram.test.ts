import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { PostgresTelegramPublisher } from "../src/integrations/telegram.ts";
import { callTelegramTool } from "../src/mcp/telegram-tool.ts";
import type { SqlPool } from "../src/store/postgres.ts";

const identity = { issuer: "https://auth.example.edu", subject: "professor-123" };

const fixture = () => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  let request: { url: string; init?: RequestInit } | null = null;
  const connection = {
    async query<Row extends Record<string, unknown>>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("delivery.user_identities")) {
        return { rows: [{ user_id: "00000000-0000-0000-0000-000000000123" } as Row] };
      }
      if (text.includes("delivery.telegram_channels")) {
        return { rows: [{ chat_id: "@css4008", title: "CSS 4008" } as Row] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool: SqlPool = {
    query: connection.query,
    async connect() { return connection; },
  };
  const send = (async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 77, date: 1234 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return {
    calls,
    request: () => request,
    publisher: new PostgresTelegramPublisher(pool, "123:secret", send),
  };
};

const auth = (scopes: string[]): AuthInfo => ({
  token: "not-the-bot-token",
  clientId: "chatgpt-or-claude",
  scopes,
  extra: identity,
});

test("a channel lookup is scoped through the signed-in professor", async () => {
  const { calls, publisher } = fixture();
  const channel = await publisher.channel(identity, "CSS-4008-2026-FALL");
  assert.deepEqual(channel, { chatId: "@css4008", title: "CSS 4008" });
  assert.match(calls[2]!.text, /set_config\('ainar\.user_id'/);
  assert.deepEqual(calls[3]!.values, ["CSS-4008-2026-FALL"]);
  assert.equal(calls.at(-1)!.text, "COMMIT");
});

test("preview resolves the channel but sends nothing", async () => {
  const { publisher, request } = fixture();
  const response = await callTelegramTool(
    publisher,
    auth(["courses:read", "integrations:publish"]),
    { course_version_id: "CSS-4008-2026-FALL", message: "Assignment is available", confirm: false },
  );
  assert.equal(request(), null);
  assert.equal((response.structuredContent as any).published, false);
  assert.equal((response.structuredContent as any).channel.chat_id, "@css4008");
});

test("explicit confirmation sends one plain-text Telegram message", async () => {
  const { publisher, request } = fixture();
  const response = await callTelegramTool(
    publisher,
    auth(["courses:read", "integrations:publish"]),
    { course_version_id: "CSS-4008-2026-FALL", message: "Assignment is available", confirm: true },
  );
  const sent = request();
  assert.ok(sent);
  assert.ok(!sent.url.includes("Assignment"));
  assert.deepEqual(JSON.parse(String(sent.init?.body)), {
    chat_id: "@css4008",
    text: "Assignment is available",
    disable_web_page_preview: true,
  });
  assert.equal((response.structuredContent as any).telegram_message_id, 77);
});

test("publishing requires the integration scope and Telegram's length limit", async () => {
  const { publisher } = fixture();
  await assert.rejects(
    callTelegramTool(publisher, auth(["courses:read"]), {
      course_version_id: "CSS-4008-2026-FALL",
      message: "Assignment is available",
      confirm: true,
    }),
    /integrations:publish/,
  );
  await assert.rejects(
    callTelegramTool(publisher, auth(["integrations:publish"]), {
      course_version_id: "CSS-4008-2026-FALL",
      message: "x".repeat(4097),
      confirm: true,
    }),
    /4096/,
  );
});
