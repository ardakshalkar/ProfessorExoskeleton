/**
 * The read a small change starts with.
 *
 * What these pin is that `impact` answers the four questions a one-word edit
 * actually raises — which file, draft or record, what was rendered from it,
 * where it has already gone — and that the `next` lines never recommend a step
 * the report above them does not justify. That last one is the property worth
 * having: an agent reads those lines out, so a line that appears when it
 * should not is a wrong instruction rather than a cosmetic bug.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeImpact, impact } from "../src/impact.ts";
import { freshness, restamp } from "../src/freshness.ts";
import type { Publication } from "../src/lms/ledger.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";
const SLIDES = `courses/${COURSE}/materials/MODULE-06-slides.md`;
const PDF = `courses/${COURSE}/materials/MODULE-06-slides.pdf`;

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-impact-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  return root;
};

const load = (root: string) => new Workspace(root).findRun(RUN);

const look = (root: string, documentId: string, publications: Record<string, Publication> = {}) =>
  impact({ bundle: load(root), courseVersionId: RUN, root, documentId, publications })!;

/** The sample course records no checksums; a test about change needs them first. */
const stamped = (root: string): string => {
  restamp(root, COURSE, freshness(load(root), RUN, root));
  return root;
};

const published = (materials: Record<string, string>): Record<string, Publication> => ({
  [`page|${RUN}`]: {
    where: `dist/pages/${RUN}`,
    at: "2026-09-19T14:02:00+05:00",
    reference: null,
    handle: null,
    materials,
  },
});

const withRendering = (root: string): string => {
  const path = join(root, "courses", COURSE, "documents.yaml");
  writeFileSync(
    path,
    readFileSync(path, "utf-8").replace(
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
  writeFileSync(join(root, PDF), "a rendering of the original text", "utf-8");
  return root;
};

// ------------------------------------------------------------- what it is

test("a recorded deck is named with the file, the state and what points at it", () => {
  const found = look(stamped(workspace()), "DOC-4410");

  assert.equal(found.state, "record");
  assert.equal(found.fileState, "matches");
  assert.equal(found.storageKey, SLIDES);
  // A meeting reaches a deck through a resource, and naming the meeting is the
  // difference between "RES-441" and "week 6's lecture".
  assert.match(found.usedBy.join("\n"), /RES-441/);
  assert.match(found.usedBy.join("\n"), /ACT-0601 — Choosing a metric/);
  assert.deepEqual(found.publishedTo, []);
});

test("an unknown document is null rather than an empty report", () => {
  const root = workspace();
  assert.equal(
    impact({ bundle: load(root), courseVersionId: RUN, root, documentId: "DOC-NOPE", publications: {} }),
    null,
  );
});

test("a document with no checksum says so rather than claiming it matches", () => {
  const found = look(workspace(), "DOC-4410");
  assert.equal(found.fileState, "unstamped");
  assert.match(describeImpact(found).join("\n"), /no checksum recorded yet/);
});

// --------------------------------------------------------- what follows

test("an untouched record is edited in place, and says the old answer is not needed", () => {
  const next = look(stamped(workspace()), "DOC-4410").next.join("\n");
  assert.match(next, /edit .*MODULE-06-slides\.md in place/);
  assert.match(next, /a new identifier is not needed, and neither is `supersedes`/);
});

test("a rendering of a changed source is named stale, with the rebuild", () => {
  const root = stamped(withRendering(workspace()));
  writeFileSync(join(root, SLIDES), "# Cross-validation\n\nThe corrected text.\n", "utf-8");

  const found = look(root, "DOC-4410");
  assert.equal(found.fileState, "changed");
  assert.deepEqual(
    found.renderings.map((entry) => [entry.documentId, entry.stale]),
    [["DOC-4499", true]],
  );
  assert.match(found.next.join("\n"), /rebuild .*MODULE-06-slides\.pdf \(DOC-4499\)/);
});

test("a rendering knows it is one, and points at its source instead", () => {
  const root = stamped(withRendering(workspace()));
  const found = look(root, "DOC-4499");
  assert.equal(found.renderedFrom, "DOC-4410");
  assert.deepEqual(found.renderings, []);
  assert.match(describeImpact(found).join("\n"), /Edit that, not this one/);
});

test("a published copy that is behind is the fact the professor cannot see", () => {
  const root = stamped(workspace());
  const sent = published({ "DOC-4410": currentChecksum(root) });

  writeFileSync(join(root, SLIDES), "# Cross-validation\n\nThe corrected text.\n", "utf-8");
  const found = look(root, "DOC-4410", sent);

  assert.deepEqual(
    found.publishedTo.map((entry) => entry.behind),
    [true],
  );
  assert.match(found.next.join("\n"), /publish update CSS-4008-2026-FALL/);
});

test("a published copy that is current says so, and recommends nothing", () => {
  const root = stamped(workspace());
  // What a publication recorded is the checksum the record now carries, since
  // nothing has been edited since it was stamped.
  const found = look(root, "DOC-4410", published({ "DOC-4410": currentChecksum(root) }));
  assert.deepEqual(
    found.publishedTo.map((entry) => entry.behind),
    [false],
  );
  assert.match(found.next.join("\n"), /every place this went has the current version/);
  assert.doesNotMatch(found.next.join("\n"), /publish update/);
});

/** The checksum the record now carries, which is what a publication recorded. */
function currentChecksum(root: string): string {
  const parsed = readFileSync(join(root, "courses", COURSE, "documents.yaml"), "utf-8");
  return /checksum: (sha256:[0-9a-f]+)/.exec(parsed)![1]!;
}

// ------------------------------------------------------- naming the rebuild

test("a declared source beats the filename convention", () => {
  const root = workspace();
  const path = join(root, "courses", COURSE, "documents.yaml");
  writeFileSync(
    path,
    readFileSync(path, "utf-8").replace(
      "  - document_id: DOC-4411",
      "  - document_id: DOC-4498\n" +
        "    title: Model evaluation — handout notes\n" +
        `    storage_key: courses/${COURSE}/materials/week-06-notes.txt\n` +
        "    mime_type: text/plain\n" +
        `    course_version_id: ${RUN}\n` +
        "    extensions:\n" +
        "      origin: generated\n" +
        "      rendered_from: DOC-4410\n\n" +
        "  - document_id: DOC-4411",
    ),
    "utf-8",
  );
  writeFileSync(join(root, "courses", COURSE, "materials", "week-06-notes.txt"), "notes", "utf-8");
  stamped(root);

  // Nothing about the two filenames pairs them; the record says it.
  assert.equal(look(root, "DOC-4498").renderedFrom, "DOC-4410");
  assert.deepEqual(
    look(root, "DOC-4410").renderings.map((entry) => entry.documentId),
    ["DOC-4498"],
  );
});
