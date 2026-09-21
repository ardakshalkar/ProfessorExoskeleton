/**
 * Noticing that a material was edited, and what follows from it.
 *
 * The cycle these pin is the one a professor actually performs — fix a word,
 * publish, and find out that the PDF beside it is now a picture of the old
 * text — and the two traps found by running it:
 *
 * 1. re-stamping the source clears the staleness signal, so the NEXT
 *    publication would quietly copy the old rendering having warned once;
 * 2. deferring the re-stamp to keep the signal alive deadlocks, because a
 *    rebuild never clears it either.
 *
 * Both are in here by name, because neither is visible from reading the code.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { deferredSources, freshness, nothingChanged, restamp } from "../src/freshness.ts";
import { setRecordFields } from "../src/record-edit.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";
const SLIDES = `courses/${COURSE}/materials/MODULE-06-slides.md`;
const PDF = `courses/${COURSE}/materials/MODULE-06-slides.pdf`;

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-fresh-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  return root;
};

const load = (root: string) => new Workspace(root).findRun(RUN);

const recordOf = (root: string, id: string): Record<string, any> => {
  const parsed = parse(readFileSync(join(root, "courses", COURSE, "documents.yaml"), "utf-8"));
  return parsed.documents.find((entry: any) => entry.document_id === id);
};

/** The sample course records no checksums, so a test of change needs one first. */
const stampEverything = (root: string): void => {
  const found = freshness(load(root), RUN, root);
  restamp(root, COURSE, found);
};

const edit = (root: string, key: string, text: string): void =>
  writeFileSync(join(root, key), text, "utf-8");

// ------------------------------------------------------------- first stamp

test("a material with no checksum gets one, and nothing else in the file moves", () => {
  const root = workspace();
  const path = join(root, "courses", COURSE, "documents.yaml");
  const before = readFileSync(path, "utf-8");

  const found = freshness(load(root), RUN, root);
  assert.ok(found.unstamped.length >= 1, "the sample course records no checksums");
  assert.equal(found.changed.length, 0);

  const written = restamp(root, COURSE, found);
  assert.equal(written.written.length, 1);

  const after = readFileSync(path, "utf-8");
  const added = after
    .split(/\r?\n/)
    .filter((line) => !before.split(/\r?\n/).includes(line));
  // Only the stamps. A re-emitted document would have re-wrapped scalars and
  // re-padded every flow sequence, which is what this asserts did not happen.
  assert.ok(
    added.every((line) => /^\s*(checksum|size_bytes): /.test(line)),
    `unexpected changes:\n${added.join("\n")}`,
  );
  assert.equal(recordOf(root, "DOC-4410").version, undefined, "a first stamp is not a new version");
});

test("a second look at an untouched course has nothing to say", () => {
  const root = workspace();
  stampEverything(root);
  assert.equal(nothingChanged(freshness(load(root), RUN, root)), true);
});

// ------------------------------------------------------------ the edit

test("editing an approved material is noticed, and recorded as a new version", () => {
  const root = workspace();
  stampEverything(root);
  edit(root, SLIDES, "# Cross-validation\n\nThe corrected text.\n");

  const found = freshness(load(root), RUN, root);
  assert.deepEqual(
    found.changed.map((print) => print.documentId),
    ["DOC-4410"],
  );

  restamp(root, COURSE, found);
  const record = recordOf(root, "DOC-4410");
  assert.equal(record.version, 2);
  assert.equal(record.size_bytes, 40);
  assert.equal(nothingChanged(freshness(load(root), RUN, root)), true);
});

// ------------------------------------------------- the rendering beside it

/** Register a PDF rendered from the deck, the way `materials build` would. */
const withRendering = (root: string): void => {
  const path = join(root, "courses", COURSE, "documents.yaml");
  const text = readFileSync(path, "utf-8");
  writeFileSync(
    path,
    text.replace(
      "  - document_id: DOC-4411",
      "  - document_id: DOC-4499\n" +
        "    title: Model evaluation — slides (PDF)\n" +
        `    storage_key: ${PDF}\n` +
        "    mime_type: application/pdf\n" +
        `    course_version_id: ${RUN}\n\n` +
        "  - document_id: DOC-4411",
    ),
    "utf-8",
  );
  mkdirSync(join(root, "courses", COURSE, "materials"), { recursive: true });
  edit(root, PDF, "a rendering of the original text");
};

test("a rendering of something that changed is stale, and is not published", () => {
  const root = workspace();
  withRendering(root);
  stampEverything(root);
  edit(root, SLIDES, "# Cross-validation\n\nThe corrected text.\n");

  const found = freshness(load(root), RUN, root);
  assert.deepEqual(
    found.stale.map((entry) => [entry.documentId, entry.from]),
    [["DOC-4499", "DOC-4410"]],
  );
  assert.equal(found.rebuilt.length, 0);
});

test("the source is NOT re-stamped while its rendering is stale", () => {
  const root = workspace();
  withRendering(root);
  stampEverything(root);
  edit(root, SLIDES, "# Cross-validation\n\nThe corrected text.\n");

  const found = freshness(load(root), RUN, root);
  assert.deepEqual([...deferredSources(found)], ["DOC-4410"]);

  const written = restamp(root, COURSE, found);
  assert.deepEqual(written.deferred, ["DOC-4410"]);
  assert.equal(recordOf(root, "DOC-4410").version, undefined, "it was recorded anyway");

  // The trap: a publication that re-stamped here would find nothing stale next
  // time and would copy the old PDF without a word. It has to keep saying so.
  const again = freshness(load(root), RUN, root);
  assert.equal(again.stale.length, 1);
});

test("rebuilding the rendering clears it, and both are recorded together", () => {
  const root = workspace();
  withRendering(root);
  stampEverything(root);
  edit(root, SLIDES, "# Cross-validation\n\nThe corrected text.\n");
  restamp(root, COURSE, freshness(load(root), RUN, root));

  // What a rebuild looks like from here: the rendering's own bytes moved.
  edit(root, PDF, "a rendering of the corrected text");

  const found = freshness(load(root), RUN, root);
  assert.equal(found.stale.length, 0, "still stale after a rebuild");
  assert.deepEqual(
    found.rebuilt.map((print) => print.documentId),
    ["DOC-4499"],
  );

  restamp(root, COURSE, found);
  assert.equal(recordOf(root, "DOC-4410").version, 2);
  assert.equal(recordOf(root, "DOC-4499").version, 2);
  assert.equal(nothingChanged(freshness(load(root), RUN, root)), true);
});

test("a rendering edited on its own is drift, not a rebuild", () => {
  const root = workspace();
  withRendering(root);
  stampEverything(root);
  edit(root, PDF, "somebody opened the PDF and changed it");

  const found = freshness(load(root), RUN, root);
  assert.deepEqual(
    found.drifted.map((print) => print.documentId),
    ["DOC-4499"],
  );
  assert.equal(found.stale.length, 0);
  assert.equal(found.rebuilt.length, 0);
});

// --------------------------------------------------------- the text writer

test("setting a field that is already there replaces it rather than adding one", () => {
  const root = workspace();
  stampEverything(root);
  setRecordFields({
    root,
    courseId: COURSE,
    patterns: ["documents.yaml", "documents/*.yaml"],
    idField: "document_id",
    collection: "documents",
    edits: new Map([["DOC-4410", { size_bytes: 11 }]]),
  });
  const text = readFileSync(join(root, "courses", COURSE, "documents.yaml"), "utf-8");
  assert.equal(text.match(/^\s*size_bytes: 11$/gm)?.length, 1);
  assert.equal(recordOf(root, "DOC-4410").size_bytes, 11);
});

test("a record no file holds is a refusal that writes nothing", () => {
  const root = workspace();
  const path = join(root, "courses", COURSE, "documents.yaml");
  const before = readFileSync(path, "utf-8");
  assert.throws(
    () =>
      setRecordFields({
        root,
        courseId: COURSE,
        patterns: ["documents.yaml"],
        idField: "document_id",
        collection: "documents",
        edits: new Map([["DOC-NOPE", { size_bytes: 1 }]]),
      }),
    /No record file/,
  );
  assert.equal(readFileSync(path, "utf-8"), before);
});
