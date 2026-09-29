/**
 * Writing records into the course: where they land, how they are emitted, and
 * the upsert that makes producing the same thing twice replace its record.
 *
 * The shape tests here were `approve.test.ts`'s, from when approval was the
 * only thing that wrote records.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { AGENT_WRITABLE, ID_FIELDS } from "../src/approval.ts";
import {
  HEADER,
  decidedAt,
  floatPaths,
  isRepoKey,
  stampDocument,
  tidy,
  writeRecords,
} from "../src/records-write.ts";

const course = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-write-"));
  const courseDir = join(root, "courses", "CSS-4008");
  mkdirSync(courseDir, { recursive: true });
  return courseDir;
};

const doc = (id: string, extra: Record<string, unknown> = {}) => ({
  document_id: id,
  title: `Deck ${id}`,
  storage_key: `courses/CSS-4008/materials/${id}.pptx`,
  mime_type: "application/pdf",
  ...extra,
});

const read = (path: string, collection: string): Record<string, unknown>[] =>
  (parse(readFileSync(path, "utf-8")) as Record<string, Record<string, unknown>[]>)[collection]!;

// ------------------------------------------------------------------ upsert

test("a new record lands in its collection's generated file, marked as given", () => {
  const courseDir = course();
  const [path] = writeRecords(courseDir, { documents: [doc("DOC-1", { approval: "draft" })] });
  assert.equal(path, join(courseDir, "documents", "generated.yaml"));
  const text = readFileSync(path!, "utf-8");
  assert.ok(text.startsWith(HEADER), "the header says what the file is");
  assert.equal(read(path!, "documents")[0]!.approval, "draft");
});

test("writing the same id again replaces it, in place, instead of adding a second", () => {
  const courseDir = course();
  writeRecords(courseDir, { documents: [doc("DOC-1"), doc("DOC-2")] });
  const [path] = writeRecords(courseDir, { documents: [doc("DOC-1", { title: "Rebuilt" })] });
  const records = read(path!, "documents");
  assert.deepEqual(records.map((r) => r.document_id), ["DOC-1", "DOC-2"]);
  assert.equal(records[0]!.title, "Rebuilt");
});

test("a rebuild keeps the approval the professor gave", () => {
  const courseDir = course();
  writeRecords(courseDir, { documents: [doc("DOC-1")] }); // approved: no field
  const [path] = writeRecords(
    courseDir,
    { documents: [doc("DOC-1", { approval: "draft", title: "Rebuilt" })] },
    { keepApproval: true },
  );
  const record = read(path!, "documents")[0]!;
  assert.equal(record.title, "Rebuilt");
  assert.equal(record.approval, undefined, "an accepted material went back to draft on rebuild");
});

test("a rebuild of a draft stays a draft", () => {
  const courseDir = course();
  writeRecords(courseDir, { documents: [doc("DOC-1", { approval: "draft" })] });
  const [path] = writeRecords(courseDir, { documents: [doc("DOC-1", { approval: "draft" })] }, {
    keepApproval: true,
  });
  assert.equal(read(path!, "documents")[0]!.approval, "draft");
});

test("a record already in a hand-authored file is edited there, not duplicated", () => {
  const courseDir = course();
  const authored = join(courseDir, "documents.yaml");
  writeFileSync(
    authored,
    "# The professor's own list — this comment must survive.\n" +
      "documents:\n" +
      "  - document_id: DOC-1\n" +
      "    title: Old title\n" +
      "    storage_key: courses/CSS-4008/materials/DOC-1.pptx\n" +
      "    mime_type: application/pdf\n",
    "utf-8",
  );
  const written = writeRecords(courseDir, { documents: [doc("DOC-1", { approval: "draft", title: "New" })] }, {
    keepApproval: true,
  });
  assert.deepEqual(written, [authored]);
  const text = readFileSync(authored, "utf-8");
  assert.match(text, /this comment must survive/);
  assert.match(text, /title: New/);
  assert.doesNotMatch(text, /approval/, "keepApproval must not add a draft marker to an accepted record");
});

test("a collection with no destination is refused by name", () => {
  assert.throws(() => writeRecords(course(), { concepts: [{ concept_id: "CONCEPT-X" }] }), /concepts/);
});

// ------------------------------------------------------------------ stamps

test("a document is stamped with the size and checksum of its file", () => {
  const courseDir = course();
  const root = join(courseDir, "..", "..");
  mkdirSync(join(courseDir, "materials"), { recursive: true });
  writeFileSync(join(courseDir, "materials", "DOC-1.pptx"), "bytes");
  const record: Record<string, unknown> = doc("DOC-1");
  assert.ok(stampDocument(record, root));
  assert.equal(record.size_bytes, 5);
  assert.match(String(record.checksum), /^sha256:[0-9a-f]{64}$/);
  assert.equal(stampDocument(doc("DOC-MISSING"), root), false);
});

// ------------------------------------------------------------------- shape

test("an empty extensions map is dropped and the rest sinks to the end", () => {
  const tidied = tidy({ extensions: {}, a: 1 }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(tidied), ["a"]);

  const kept = tidy({ extensions: { x: 1 }, a: 1 }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(kept), ["a", "extensions"]);

  // At any depth, including inside a list.
  const nested = tidy({ items: [{ extensions: {}, b: 2 }] }) as { items: Record<string, unknown>[] };
  assert.deepEqual(Object.keys(nested.items[0]!), ["b"]);
});

test("float-ness is read off the schema, the way pydantic reads it", () => {
  const paths = floatPaths(z.object({ score: z.number(), count: z.number().int() }), ["r"]);
  assert.ok(paths.has("r.score"), "a plain number is a float");
  assert.ok(!paths.has("r.count"), "an int was treated as a float");
});

test("a nullable or defaulted number keeps its float-ness", () => {
  const schema = z.object({
    a: z.number().nullish(),
    b: z.number().default(1),
    c: z.object({ d: z.number() }),
    e: z.array(z.object({ f: z.number() })),
  });
  const paths = floatPaths(schema, ["r"]);
  for (const path of ["r.a", "r.b", "r.c.d", "r.e.f"]) {
    assert.ok(paths.has(path), `${path} lost its float-ness`);
  }
});

test("only the two state collections lack an id field", () => {
  // `concept_states` and `capability_states` are keyed by student and concept
  // rather than by an identifier of their own, so an upsert cannot replace
  // them by id and appends instead.
  const without = Object.keys(AGENT_WRITABLE).filter((collection) => !ID_FIELDS[collection]);
  assert.deepEqual(without.sort(), ["capability_states", "concept_states"]);
});

test("a storage key with a scheme is not a repository path", () => {
  assert.ok(isRepoKey("courses/CSS-4008/materials/x.md"));
  assert.ok(!isRepoKey("object://bucket/x.md"));
});

// -------------------------------------------------------------- timestamps

test("the stamp carries the run's offset, not the machine's", () => {
  const stamp = decidedAt("Asia/Almaty", new Date("2026-10-18T04:00:00Z"));
  assert.equal(stamp, "2026-10-18T09:00:00+05:00");
});

test("an unknown timezone falls back to +05:00 rather than to UTC", () => {
  // Silently substituting UTC would misreport when a person decided, by five
  // hours — the same fallback `run_timezone` made.
  const stamp = decidedAt("Not/AZone", new Date("2026-10-18T04:00:00Z"));
  assert.ok(stamp.endsWith("+05:00"), stamp);
});

test("the stamp has no sub-second part", () => {
  const stamp = decidedAt("Asia/Almaty", new Date("2026-10-18T04:00:00.123Z"));
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/.test(stamp), stamp);
});
