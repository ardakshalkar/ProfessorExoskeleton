import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { Json, buildScript, literal, rowId, schemaSql, upsert, uuid5 } from "../src/sqlgen.ts";

/**
 * `tests/test_sql.py` transcribed, minus the tests that needed `sqlglot` to
 * parse the output — there is no equivalent PostgreSQL parser here, so the
 * strongest check left is the column one below, which is also the one that
 * catches the mistake a parser would not: an INSERT naming a column the DDL
 * does not define.
 *
 * The last test is the parity check, and it is the reason this file exists at
 * all. `workspace/golden/CSS-4008/import.sql` was produced by `python -m ainar sql` before
 * Python was cut loose, so it is a record of what the implementation this port
 * replaces actually emitted.
 */

const ROOT = resolve(process.cwd(), "..", "workspace");

const course = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle!;
};

// ------------------------------------------------------------------ literals

test("an apostrophe cannot end the string early", () => {
  assert.equal(literal("Bloom's taxonomy"), "'Bloom''s taxonomy'");
  assert.equal(
    literal("'; DROP TABLE academic.courses; --"),
    "'''; DROP TABLE academic.courses; --'",
  );
});

test("scalars render as themselves", () => {
  assert.equal(literal(null), "NULL");
  assert.equal(literal(undefined), "NULL");
  assert.equal(literal(true), "TRUE");
  assert.equal(literal(0.25), "0.25");
  // A timestamp reaches this module as the text the author wrote, so it needs
  // no formatting of its own — which is also why it round-trips exactly.
  assert.equal(literal("2026-10-15T23:59:00+05:00"), "'2026-10-15T23:59:00+05:00'");
});

test("a list of strings is a text array", () => {
  assert.equal(literal(["pdf", "notebook"]), "ARRAY['pdf', 'notebook']::text[]");
  // An empty ARRAY and an empty JSONB object are both written `{}` in Postgres,
  // and only the absence of `::jsonb` tells them apart.
  assert.equal(literal([]), "'{}'");
});

test("an object is jsonb with stable key order", () => {
  assert.equal(literal({ b: 1, a: 2 }), '\'{"a": 2, "b": 1}\'::jsonb');
});

test("json must be declared rather than guessed", () => {
  // The bug this guards: a JSON array silently rendered as a text[] of reprs.
  assert.throws(() => literal([{ document_id: "DOC-1" }]), /wrap the value in Json/);
  assert.equal(literal(new Json([{ document_id: "DOC-1" }])), '\'[{"document_id": "DOC-1"}]\'::jsonb');
});

// --------------------------------------------------------------- identifiers

test("identifiers are derived from the code and never move", () => {
  const first = rowId("LO-04");
  assert.equal(first, rowId("LO-04"));
  assert.notEqual(first, rowId("LO-05"));
  assert.equal(first[14], "5", "the version nibble must say UUIDv5");
  assert.match(first[19]!, /[89ab]/, "the variant bits must say RFC 4122");
});

test("uuid5 matches the published vectors", () => {
  // The two standard namespaces, which is what pins the derivation itself
  // rather than merely pinning it to whatever this file happens to compute.
  const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
  assert.equal(uuid5(DNS, "www.example.com"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
  assert.equal(uuid5(URL, "https://example.com/"), "dd2c1780-811a-5296-81c5-178a0ef488bc");
});

test("an id under this project's namespace is the one Python derived", () => {
  // `python -c "uuid.uuid5(uuid.UUID(NAMESPACE), 'LO-04')"`. If this ever
  // changes, every row already imported by the application is orphaned.
  assert.equal(rowId("LO-04"), "a5c788dc-6ba3-5898-ac09-6723a2414cfc");
});

// -------------------------------------------------------------------- upsert

test("every row is an upsert so reimport updates in place", () => {
  const statement = upsert("academic.courses", { id: rowId("X-1000"), title: "T" });
  assert.match(statement, /ON CONFLICT \(id\) DO UPDATE SET title = EXCLUDED\.title/);
  assert.equal(statement.includes("EXCLUDED.id"), false, "the conflict key must not update itself");
});

test("a junction row with no payload does nothing on conflict", () => {
  const statement = upsert(
    "academic.module_outcomes",
    { module_id: rowId("MODULE-01"), outcome_id: rowId("LO-01") },
    ["module_id", "outcome_id"],
  );
  assert.match(statement, /DO NOTHING/);
});

// ---------------------------------------------------------------- the schema

test("the schema creates every group from the design", () => {
  const text = schemaSql();
  // Five, not six. `harness` folded into `learning` when the schema was
  // flattened: two tables about what the professor should look at next were
  // never worth a schema of their own.
  for (const group of ["academic", "delivery", "assessment", "learning", "content"]) {
    assert.match(text, new RegExp(`CREATE SCHEMA IF NOT EXISTS ${group};`));
  }
  assert.equal(schemaSql().includes("CREATE SCHEMA IF NOT EXISTS harness;"), false);
});

test("the schema keeps the constraints the validator also enforces", () => {
  const text = schemaSql();
  for (const constraint of [
    "decided_rows_are_stamped",
    "signals_carry_evidence",
    "evidence_names_a_target",
    "interventions_are_approved_by_a_person",
  ]) {
    assert.match(text, new RegExp(`CONSTRAINT ${constraint}`));
  }
});

test("removing an outcome cannot silently destroy evidence", () => {
  // learning.* -> academic.* must RESTRICT, never CASCADE.
  const text = schemaSql();
  const start = text.indexOf("CREATE TABLE IF NOT EXISTS learning.evidence");
  const evidence = text.slice(start, text.indexOf(");", start));
  for (const column of ["outcome_id", "capability_id", "concept_id"]) {
    const line = evidence.split("\n").find((row) => row.trim().startsWith(column))!;
    assert.match(line, /ON DELETE RESTRICT/, `${column} must not cascade`);
  }
});

// --------------------------------------------------------- the import script

test("the same content produces the same script", () => {
  const bundle = course();
  assert.equal(buildScript(bundle), buildScript(bundle));
});

test("every generated INSERT column exists in the DDL", () => {
  // A SQL parser accepts an INSERT naming a missing column; PostgreSQL does not.
  const tables = new Map<string, Set<string>>();
  for (const match of schemaSql().matchAll(
    /CREATE TABLE IF NOT EXISTS\s+([a-z_]+\.[a-z_]+)\s*\(([\s\S]*?)^\);/gm,
  )) {
    const columns = [...match[2]!.matchAll(/^ {4}([a-z_][a-z0-9_]*)\s+/gm)].map((m) => m[1]!);
    tables.set(match[1]!, new Set(columns));
  }
  assert.ok(tables.size, "the DDL table parser found nothing");

  const missing: Record<string, string[]> = {};
  for (const match of buildScript(course()).matchAll(
    /INSERT INTO\s+([a-z_]+\.[a-z_]+)\s*\(([^)]+)\)/g,
  )) {
    const columns = match[2]!.split(",").map((column) => column.trim());
    const absent = columns.filter((column) => !tables.get(match[1]!)?.has(column)).sort();
    if (absent.length) missing[match[1]!] = absent;
  }
  assert.deepEqual(missing, {}, "generated INSERT columns absent from the schema");
});

/**
 * The whole script, against what `python -m ainar sql` wrote for the same course.
 *
 * One difference is expected and is the port's one known limit: a whole-numbered
 * float inside a free-form `extensions` map prints as `1` here and `1.0` there,
 * because the JavaScript YAML parser has already discarded the distinction by
 * the time this module runs. `sqlgen.ts`'s header explains it; this test names
 * every line it is allowed to affect, so a *second* kind of difference fails
 * even though the first is tolerated.
 */
test("the script matches what the Python implementation emitted", () => {
  const fixture = readFileSync(join(ROOT, "golden", "CSS-4008", "import.sql"), "utf-8")
    .replace(/\r/g, "")
    .split("\n");
  const ours = buildScript(course()).replace(/\r/g, "").split("\n");

  assert.equal(ours.length, fixture.length, "the two scripts have different line counts");

  const differing: number[] = [];
  for (let index = 0; index < fixture.length; index += 1) {
    if (ours[index] !== fixture[index]) differing.push(index + 1);
  }

  for (const line of differing) {
    const theirs = fixture[line - 1]!;
    const mine = ours[line - 1]!;
    assert.equal(
      theirs.replace(/"proportion": ([0-9]+)\.0/g, '"proportion": $1'),
      mine,
      `line ${line} differs by more than the known extensions-float divergence`,
    );
  }
});
