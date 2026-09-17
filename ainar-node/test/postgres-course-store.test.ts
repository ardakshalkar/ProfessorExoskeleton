import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  loadPostgresCourseStore,
  loadPostgresCourseStoreForIdentity,
  type SqlClient,
  type SqlPool,
} from "../src/store/postgres.ts";
import { Workspace } from "../src/workspace.ts";

const payload = JSON.parse(
  readFileSync(resolve(process.cwd(), "..", "golden", "CSS-4008", "bundle.json"), "utf8"),
);

test("a PostgreSQL read-model row becomes the same CourseBundle boundary", async () => {
  let sql = "";
  const client: SqlClient = {
    async query<Row extends Record<string, unknown>>(text: string) {
      sql = text;
      return {
        rows: [
          {
            course_code: "CSS-4008",
            format_version: "1",
            payload,
          } as unknown as Row,
        ],
      };
    },
  };

  const store = await loadPostgresCourseStore(client);
  const workspace = new Workspace(store);
  assert.match(sql, /content\.course_bundle_read_models/);
  assert.deepEqual(workspace.courseIds(), ["CSS-4008"]);
  assert.equal(workspace.findRun("CSS-4008-2026-FALL").course.title, "Artificial Intelligence");
});

test("an invalid database bundle is refused rather than partially loaded", async () => {
  const client: SqlClient = {
    async query<Row extends Record<string, unknown>>() {
      return {
        rows: [
          {
            course_code: "CSS-4008",
            format_version: "9",
            payload: { ...payload, format_version: "9" },
          } as unknown as Row,
        ],
      };
    },
  };
  const store = await loadPostgresCourseStore(client);
  assert.equal(store.load("CSS-4008").bundle, null);
  assert.equal(store.load("CSS-4008").issues.errors[0]!.code, "postgres.bundle_version");
});

test("an OAuth identity becomes a transaction-local RLS user", async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  let released = false;
  const connection = {
    async query<Row extends Record<string, unknown>>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("delivery.user_identities")) {
        return { rows: [{ user_id: "00000000-0000-0000-0000-000000000123" } as Row] };
      }
      if (text.includes("content.course_bundle_read_models")) {
        return {
          rows: [{ course_code: "CSS-4008", format_version: "1", payload } as unknown as Row],
        };
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool: SqlPool = {
    query: connection.query,
    async connect() {
      return connection;
    },
  };

  const store = await loadPostgresCourseStoreForIdentity(pool, {
    issuer: "https://auth.example.edu",
    subject: "professor-123",
  });
  assert.deepEqual(store.courseIds(), ["CSS-4008"]);
  assert.deepEqual(calls[1]!.values, ["https://auth.example.edu", "professor-123"]);
  assert.match(calls[2]!.text, /set_config\('ainar\.user_id'/);
  assert.equal(calls.at(-1)!.text, "COMMIT");
  assert.equal(released, true);
});
