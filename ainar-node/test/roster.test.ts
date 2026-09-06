import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  PSEUDONYM_ALPHABET,
  RosterStore,
  b32encode,
  buildRoster,
  loadSalt,
  parseDelimited,
  pseudonym,
  readRows,
  refuseInsideRepo,
  rosterDir,
  sniffDelimiter,
} from "../src/roster.ts";

/**
 * The point of this file is the first four tests.
 *
 * `bin/ainar.ts` refused to carry a second implementation of the pseudonym,
 * and the reason it gave was right: a derivation differing by one byte would
 * hand a student a second identity in their second course, and nothing in a
 * diff would show it. What makes a second implementation safe is not care, it
 * is that both halves are public standards with published vectors — so the
 * vectors are here, and they fail loudly if either half drifts.
 *
 * The rest is ordinary behaviour, asserted against `ainar/roster.py`.
 */

const tmp = (name: string): string => mkdtempSync(join(tmpdir(), `roster-${name}-`));
const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);

// --------------------------------------------------------------------------
// The derivation, pinned to its standards
// --------------------------------------------------------------------------

test("base32 matches the RFC 4648 test vectors, which is what b32encode emits", () => {
  // RFC 4648 section 10. These are the same bytes `base64.b32encode` returns,
  // padding included — the padding is dropped later by the alphabet filter, and
  // dropping it here instead would pass this test while shifting a pseudonym
  // whose digest happened to end on a chunk boundary.
  const vectors: [string, string][] = [
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ];
  for (const [input, expected] of vectors) {
    assert.equal(b32encode(utf8(input)), expected, `b32encode(${JSON.stringify(input)})`);
  }
});

test("the pseudonym is HMAC-SHA256 over the salt, base32, first six alphabet characters", () => {
  // Fixed salt and identifier, so the whole chain is nailed down: change the
  // hash, the alphabet, the length, or the trimming, and this fails.
  const salt = Buffer.from("00".repeat(32), "hex");
  const first = pseudonym("20231234", salt);

  assert.match(first, /^STUDENT-[A-Z2-7]{6}$/);
  assert.equal(first.length, "STUDENT-".length + 6);
  // Recomputed from the documented recipe rather than pasted from a run, so the
  // test states the rule instead of the last answer.
  const digest = createHmac("sha256", salt).update("20231234", "utf8").digest();
  const expected =
    "STUDENT-" +
    [...b32encode(digest)].filter((c) => PSEUDONYM_ALPHABET.includes(c)).slice(0, 6).join("");
  assert.equal(first, expected);
});

test("the same student keeps one identifier, and a different salt gives another", () => {
  const salt = Buffer.from("11".repeat(32), "hex");
  const other = Buffer.from("22".repeat(32), "hex");
  // Whitespace is stripped, which is what makes a re-export with a stray space
  // the same person rather than a new one.
  assert.equal(pseudonym("20231234", salt), pseudonym("  20231234  ", salt));
  assert.notEqual(pseudonym("20231234", salt), pseudonym("20231234", other));
  assert.notEqual(pseudonym("20231234", salt), pseudonym("20231235", salt));
});

test("a salt is created once and then reused", () => {
  const directory = tmp("salt");
  const first = loadSalt(directory);
  assert.equal(first.length, 32);
  assert.deepEqual(loadSalt(directory), first);
  // The file is hex plus a newline, the shape Python writes and reads.
  assert.match(readFileSync(join(directory, "salt"), "utf-8"), /^[0-9a-f]{64}\n$/);
});

test("a missing salt refuses rather than inventing one when create is off", () => {
  assert.throws(() => loadSalt(tmp("nosalt"), { create: false }), /no salt at/);
});

// --------------------------------------------------------------------------
// Reading an export
// --------------------------------------------------------------------------

test("the delimiter is sniffed from the header, and quotes hide it", () => {
  assert.equal(sniffDelimiter("id,name,group"), ",");
  assert.equal(sniffDelimiter("id;name;group"), ";");
  assert.equal(sniffDelimiter("id\tname\tgroup"), "\t");
  // Two commas inside one quoted heading must not outvote the real separator.
  assert.equal(sniffDelimiter('id;"Last, First, M";group'), ";");
  // Nothing to go on is a single column, and a comma reads that correctly.
  assert.equal(sniffDelimiter("id"), ",");
});

test("quoted fields may hold the delimiter, newlines and doubled quotes", () => {
  const rows = parseDelimited('a,b\n"x,1","he said ""hi""\nagain"\n', ",");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["x,1", 'he said "hi"\nagain'],
  ]);
});

test("readRows strips the BOM and keys rows by header", () => {
  const directory = tmp("csv");
  const path = join(directory, "export.csv");
  writeFileSync(path, "\uFEFFstudent_id;name;группа\r\n20231234;Aigerim;CS-01\r\n", "utf-8");
  assert.deepEqual(readRows(path), [
    { student_id: "20231234", name: "Aigerim", "группа": "CS-01" },
  ]);
});

test("an xlsx export is refused with the instruction, not read badly", () => {
  assert.throws(() => readRows(join(tmp("xlsx"), "roster.xlsx")), /export the roster as CSV/);
});

// --------------------------------------------------------------------------
// Building enrollments
// --------------------------------------------------------------------------

const salt = Buffer.from("ab".repeat(32), "hex");
const build = (rows: Record<string, string>[], store = new RosterStore(tmp("store"))) =>
  buildRoster(rows, {
    courseVersionId: "CSS-4007-2026-FALL",
    store,
    salt,
    today: "2026-09-06",
  });

test("columns are found by name, in three languages, without being told", () => {
  const result = build([{ "жеке нөмірі": "20231234", "ф.и.о.": "Aigerim", "топ": "CS-01" }]);
  assert.equal(result.columns.id, "жеке нөмірі");
  assert.equal(result.columns.name, "ф.и.о.");
  assert.equal(result.columns.group, "топ");
  assert.equal(result.enrollments[0]!.group, "CS-01");
});

test("no identifier column is a refusal that names the columns present", () => {
  assert.throws(
    () => build([{ surname: "Aigerim", mark: "87" }]),
    /could not find a student identifier column.*surname, mark/s,
  );
});

test("an enrollment carries the pseudonym and nothing else about the person", () => {
  const result = build([{ student_id: "20231234", name: "Aigerim", email: "a@sdu.edu.kz" }]);
  const enrollment = result.enrollments[0]!;
  assert.deepEqual(Object.keys(enrollment).sort(), [
    "course_version_id",
    "enrollment_id",
    "role",
    "status",
    "student_id",
  ]);
  assert.equal(enrollment.student_id, pseudonym("20231234", salt));
  assert.equal(enrollment.enrollment_id, "ENR-" + enrollment.student_id.slice("STUDENT-".length));
  // The name and the number went to the store, never to the enrollment.
  const serialised = JSON.stringify(result.enrollments);
  assert.ok(!serialised.includes("Aigerim"), "a name reached the enrollments");
  assert.ok(!serialised.includes("20231234"), "an institutional id reached the enrollments");
  assert.ok(!serialised.includes("sdu.edu.kz"), "an email reached the enrollments");
});

test("a row with no identifier, and a duplicate, are skipped with their line numbers", () => {
  const result = build([
    { student_id: "20231234", name: "A" },
    { student_id: "", name: "B" },
    { student_id: "20231234", name: "C" },
  ]);
  assert.equal(result.enrollments.length, 1);
  // Row 2 is the first record because row 1 is the header the professor sees.
  assert.deepEqual(result.skipped, ["row 3: no identifier", "row 4: 20231234 appears twice"]);
});

test("a second import of the same person is known, not added, and gains the run", () => {
  const store = new RosterStore(tmp("twice"));
  const first = build([{ student_id: "20231234", name: "Aigerim" }], store);
  assert.deepEqual(first.added.length, 1);
  assert.deepEqual(first.known, []);

  const again = buildRoster([{ student_id: "20231234", name: "Aigerim" }], {
    courseVersionId: "CSS-4008-2027-SPRING",
    store,
    salt,
    today: "2027-02-01",
  });
  assert.deepEqual(again.added, []);
  assert.equal(again.known.length, 1);

  const person = store.whois(pseudonym("20231234", salt))!;
  assert.deepEqual(person.runs, ["CSS-4007-2026-FALL", "CSS-4008-2027-SPRING"]);
  // first_seen is when we first saw them, not when we last did.
  assert.equal(person.first_seen, "2026-09-06");
});

test("an export missing a column does not erase what an earlier one knew", () => {
  const store = new RosterStore(tmp("keep"));
  build([{ student_id: "20231234", name: "Aigerim", email: "a@sdu.edu.kz" }], store);
  build([{ student_id: "20231234", name: "Aigerim" }], store);
  assert.equal(store.whois(pseudonym("20231234", salt))!.email, "a@sdu.edu.kz");
});

// --------------------------------------------------------------------------
// The store, and the boundary
// --------------------------------------------------------------------------

test("the store round-trips through a file with sorted keys", () => {
  const directory = tmp("save");
  const store = new RosterStore(directory);
  build([{ student_id: "20231234", name: "Aigerim" }], store);
  const path = store.save();

  const text = readFileSync(path, "utf-8");
  assert.ok(text.endsWith("\n"), "the file ends with a newline");
  // sort_keys=True applies at every level, not only the top.
  const person = JSON.parse(text).people[pseudonym("20231234", salt)];
  assert.deepEqual(Object.keys(person), [...Object.keys(person)].sort());

  const reloaded = RosterStore.load(directory);
  assert.deepEqual(reloaded.people, store.people);
  assert.equal(reloaded.whois("STUDENT-NOBODY"), null);
});

test("writing identities anywhere inside the workspace is refused", () => {
  const root = tmp("root");
  assert.throws(() => refuseInsideRepo(join(root, "roster.txt"), root), /refusing to write/);
  assert.throws(() => refuseInsideRepo(join(root, "work", "roster.txt"), root), /refusing to write/);
  // A sibling whose name merely starts with the workspace's is not inside it.
  refuseInsideRepo(root + "-private/roster.txt", root);
  refuseInsideRepo(null, root);
});

test("the roster directory is outside the repository by default and overridable", () => {
  assert.ok(rosterDir().includes(".ainar"));
  assert.equal(rosterDir("C:/tmp/elsewhere"), resolve("C:/tmp/elsewhere"));
});
