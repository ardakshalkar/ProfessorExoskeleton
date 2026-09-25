/**
 * Moving off `versions/<TERM>/`, and retiring a term.
 *
 * Both commands move a professor's only copy of something, so the tests that
 * matter are the refusals: a workspace with two terms, a collision, a term
 * still running. A migration that half-succeeds reads exactly like data loss,
 * and an archive that clears before it copies IS data loss.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { archiveRun, migrateLayout } from "../src/layout.ts";

const COURSE = "CSS-9002";

const write = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents, "utf-8");
};

/** A workspace on the old layout, with `terms` offerings under `versions/`. */
const old = (terms: string[] = ["2026-FALL"]): { root: string; courseDir: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-layout-"));
  const courseDir = join(root, "courses", COURSE);
  write(join(courseDir, "course.yaml"), `course_id: ${COURSE}\ntitle: Layout Test\n`);
  for (const term of terms) {
    const runDir = join(courseDir, "versions", term);
    write(join(runDir, "version.yaml"), `course_version_id: ${COURSE}-${term}\nterm: ${term}\n`);
    write(join(runDir, "enrollments.yaml"), "enrollments: []\n");
    write(join(runDir, "assessments", "a01.yaml"), "assessment_id: ASSESSMENT-01\n");
  }
  return { root, courseDir };
};

test("a term's files move up into the course directory", () => {
  const { courseDir } = old();
  const result = migrateLayout(courseDir);

  assert.equal(result.moved.length, 3);
  assert.ok(existsSync(join(courseDir, "version.yaml")));
  assert.ok(existsSync(join(courseDir, "assessments", "a01.yaml")));
  assert.ok(!existsSync(join(courseDir, "versions")));
});

test("a dry run reports the moves and touches nothing", () => {
  const { courseDir } = old();
  const result = migrateLayout(courseDir, { dryRun: true });

  assert.equal(result.moved.length, 3);
  assert.ok(existsSync(join(courseDir, "versions", "2026-FALL", "version.yaml")));
  assert.ok(!existsSync(join(courseDir, "version.yaml")));
});

test("two terms are refused rather than one being picked", () => {
  const { courseDir } = old(["2025-FALL", "2026-FALL"]);
  assert.throws(() => migrateLayout(courseDir), /holds 2 terms/);
  assert.ok(existsSync(join(courseDir, "versions", "2025-FALL", "version.yaml")));
});

test("a file already at the destination stops the whole migration", () => {
  const { courseDir } = old();
  write(join(courseDir, "enrollments.yaml"), "enrollments: []\n");

  assert.throws(() => migrateLayout(courseDir), /has nowhere to land/);
  // The one that would have moved first is still where it was.
  assert.ok(existsSync(join(courseDir, "versions", "2026-FALL", "version.yaml")));
});

/**
 * The half of the migration that is not a file move.
 *
 * Caught on the real course: thirty-eight documents carried
 * `storage_key: courses/CSS-4007/versions/2026-FALL/materials/…`, a path in the
 * workspace rather than an object-storage key. Moving the files and leaving the
 * records alone turned every one of them into `document.missing_file` — a
 * migration that validates as forty errors is not a migration.
 */
test("recorded paths into the old layout are rewritten", () => {
  const { courseDir } = old();
  write(
    join(courseDir, "versions", "2026-FALL", "documents", "generated.yaml"),
    "documents:\n" +
      `  - document_id: DOC-01\n    storage_key: courses/${COURSE}/versions/2026-FALL/materials/w1.md\n` +
      `  - document_id: DOC-02\n    storage_key: object://elsewhere/w2.pdf\n`,
  );

  const result = migrateLayout(courseDir);
  const text = readFileSync(join(courseDir, "documents", "generated.yaml"), "utf-8");

  assert.equal(result.rewritten.length, 1);
  assert.equal(result.rewritten[0].references, 1);
  assert.match(text, new RegExp(`storage_key: courses/${COURSE}/materials/w1\\.md`));
  // An object-storage key is not a path in the workspace and is left alone.
  assert.match(text, /storage_key: object:\/\/elsewhere\/w2\.pdf/);
});

test("a dry run reports the rewrites without making them", () => {
  const { courseDir } = old();
  const file = join(courseDir, "versions", "2026-FALL", "documents", "generated.yaml");
  write(
    file,
    `documents:\n  - document_id: DOC-01\n    storage_key: courses/${COURSE}/versions/2026-FALL/materials/w1.md\n`,
  );

  const result = migrateLayout(courseDir, { dryRun: true });

  assert.equal(result.rewritten.length, 1);
  assert.match(readFileSync(file, "utf-8"), /versions\/2026-FALL\/materials/);
});

test("backups and ad hoc archives are named, not moved", () => {
  const { courseDir } = old();
  write(join(courseDir, "versions", ".superseded", "v1-version.yaml"), "old: true\n");
  write(join(courseDir, "versions", "2026-FALL", "version.yaml.bak-20260903"), "old: true\n");

  const result = migrateLayout(courseDir);
  const left = result.left.map((entry) => entry.path.replace(/\\/g, "/"));

  assert.ok(left.some((path) => path.includes(".superseded")));
  assert.ok(left.some((path) => path.includes(".bak-20260903")));
  assert.ok(existsSync(join(courseDir, "versions", ".superseded", "v1-version.yaml")));
});

// --------------------------------------------------------------------------
// Archiving
// --------------------------------------------------------------------------

/** A flat workspace with one finished term, some records and one binary. */
const finished = (): { root: string; courseDir: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-archive-"));
  const courseDir = join(root, "courses", COURSE);
  write(join(courseDir, "course.yaml"), `course_id: ${COURSE}\ntitle: Archive Test\n`);
  write(join(courseDir, "version.yaml"), `course_version_id: ${COURSE}-2026-FALL\nterm: 2026-FALL\n`);
  write(join(courseDir, "outcomes.yaml"), "outcomes: []\n");
  write(join(courseDir, "assessments", "a01.yaml"), "assessment_id: ASSESSMENT-01\n");
  write(join(courseDir, "records", "evidence.yaml"), "evidence: []\n");
  write(join(courseDir, "materials", "week-06.md"), "# Week 6\n");
  write(join(courseDir, "materials", "week-06.pptx"), "not really a deck, but binary enough");
  return { root, courseDir };
};

test("text is copied in and the live collections are cleared", () => {
  const { root, courseDir } = finished();
  const result = archiveRun({ root, courseDir, term: "2026-FALL" });

  assert.ok(existsSync(join(result.archiveDir, "version.yaml")));
  assert.ok(existsSync(join(result.archiveDir, "assessments", "a01.yaml")));
  assert.ok(existsSync(join(result.archiveDir, "records", "evidence.yaml")));
  assert.ok(!existsSync(join(courseDir, "assessments")));
  assert.ok(!existsSync(join(courseDir, "records")));
});

test("what the course is, rather than what one term did, stays put", () => {
  const { root, courseDir } = finished();
  archiveRun({ root, courseDir, term: "2026-FALL" });

  assert.ok(existsSync(join(courseDir, "course.yaml")));
  assert.ok(existsSync(join(courseDir, "outcomes.yaml")));
});

test("binaries are recorded by checksum and left where they are", () => {
  const { root, courseDir } = finished();
  const result = archiveRun({ root, courseDir, term: "2026-FALL" });

  const paths = result.manifested.map((entry) => entry.path);
  assert.deepEqual(paths, ["materials/week-06.pptx"]);
  for (const entry of result.manifested) assert.match(entry.sha256, /^[0-9a-f]{64}$/);

  // The deck's source is the archive; the render is only named in it, because
  // the source re-renders and is a thousandth of the size.
  assert.ok(existsSync(join(result.archiveDir, "materials", "week-06.md")));
  assert.ok(!existsSync(join(result.archiveDir, "materials", "week-06.pptx")));
  assert.ok(existsSync(join(courseDir, "materials", "week-06.pptx")));

  const manifest = readFileSync(join(result.archiveDir, "MANIFEST.yaml"), "utf-8");
  assert.match(manifest, /term: 2026-FALL/);
  assert.match(manifest, /week-06\.pptx/);
});

test("an archive that already exists is refused rather than merged into", () => {
  const { root, courseDir } = finished();
  archiveRun({ root, courseDir, term: "2026-FALL" });

  assert.throws(
    () => archiveRun({ root, courseDir, term: "2026-FALL" }),
    /already exists/,
  );
});

test("a dry run copies nothing and clears nothing", () => {
  const { root, courseDir } = finished();
  const result = archiveRun({ root, courseDir, term: "2026-FALL", dryRun: true });

  assert.ok(result.copied.length > 0);
  assert.ok(!existsSync(result.archiveDir));
  assert.ok(existsSync(join(courseDir, "assessments", "a01.yaml")));
});
