import { strict as assert } from "node:assert";
import { test } from "node:test";
import { describeTarget, formatStatus, maintenanceTarget, readStatus } from "../src/db.ts";
import type { SqlClient } from "../src/store/postgres.ts";

/** Answers the three queries `readStatus` sends, from fixed rows. */
const fakeClient = (schemas: string[], courses: string[], runs: string[]): SqlClient => ({
  query: async (text: string) => {
    if (text.includes("information_schema")) return { rows: schemas.map((schema_name) => ({ schema_name })) } as any;
    if (text.includes("academic.courses")) return { rows: courses.map((code) => ({ code })) } as any;
    if (text.includes("delivery.course_versions")) return { rows: runs.map((code) => ({ code })) } as any;
    throw new Error(`unexpected query: ${text}`);
  },
});

const ALL = ["academic", "delivery", "assessment", "learning", "content"];

test("the password never reaches the printed target", () => {
  assert.equal(
    describeTarget("postgresql://postgres:s3cret@localhost:5432/ainar"),
    "postgresql://postgres@localhost:5432/ainar",
  );
  assert.equal(describeTarget("not a url"), "(DATABASE_URL is not a URL)");
});

test("CREATE DATABASE runs from the same server's postgres database", () => {
  const { url, database } = maintenanceTarget("postgresql://u:p@db.example:6543/ainar?sslmode=require");
  assert.equal(database, "ainar");
  assert.equal(url, "postgresql://u:p@db.example:6543/postgres?sslmode=require");
});

test("a database with a schema missing reads as absent, and lists nothing else", async () => {
  const status = await readStatus(fakeClient(["academic", "delivery"], ["X"], ["Y"]));
  assert.equal(status.schemaLoaded, false);
  assert.deepEqual(status.missingSchemas, ["assessment", "learning", "content"]);
  assert.deepEqual(status.courses, []);
  assert.match(formatStatus("t", status, { courses: [], runs: [] }).join("\n"), /schema {5}absent/);
});

test("drift names what is unpushed and what only the database has", async () => {
  const status = await readStatus(fakeClient(ALL, ["CSS-4007", "OTHER-1"], []));
  const text = formatStatus("t", status, { courses: ["CSS-4007", "CSS-4008"], runs: ["RUN-1"] }).join("\n");
  assert.match(text, /course {5}CSS-4007\n/);
  assert.match(text, /CSS-4008 {2}\(workspace only\)/);
  assert.match(text, /OTHER-1 {2}\(database only\)/);
  assert.match(text, /NOT YET IN THE DATABASE: CSS-4008, RUN-1/);
});
