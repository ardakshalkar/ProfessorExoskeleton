/**
 * A material is a folder: the deck on top, figures and build scripts beneath.
 * Approval must keep that shape, and publishing must mirror it, or a
 * sibling-relative link inside the deck breaks the moment it is approved.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageDocuments, type Approval } from "../src/approve.ts";
import { copyMaterials, publishable } from "../src/page.ts";
import { IssueList } from "../src/issues.ts";

const RUN = "CSS-4008-2026-FALL";

const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "material-folder-"));
  const courseDir = join(root, "courses", "CSS-4008");
  const materials = join(root, "work", RUN, "materials");
  mkdirSync(join(materials, "MODULE-06-slides", "figures"), { recursive: true });
  writeFileSync(join(materials, "MODULE-06-slides", "MODULE-06-slides.md"), "# deck\n");
  writeFileSync(join(materials, "MODULE-06-slides", "figures", "fig-01.svg"), "<svg/>");
  writeFileSync(join(materials, "loose.md"), "# loose\n");
  return { root, courseDir };
};

const approvalOf = (keys: string[]): Approval => ({
  records: new Map([
    ["documents", keys.map((storage_key, i) => ({ document_id: `DOC-${i}`, storage_key }))],
  ]),
  idMap: new Map(),
  skipped: [],
  notes: [],
});

test("approval keeps a deck's folder and flattens a loose file", () => {
  const { root, courseDir } = workspace();
  const approval = approvalOf([
    `work/${RUN}/materials/MODULE-06-slides/MODULE-06-slides.md`,
    `work/${RUN}/materials/MODULE-06-slides/figures/fig-01.svg`,
    `work/${RUN}/materials/loose.md`,
  ]);
  const issues = new IssueList();
  stageDocuments(approval, { root, courseDir, issues });

  assert.deepEqual(issues.errors, []);
  const keys = approval.records.get("documents")!.map((d) => d.storage_key);
  assert.deepEqual(keys, [
    "courses/CSS-4008/materials/MODULE-06-slides/MODULE-06-slides.md",
    "courses/CSS-4008/materials/MODULE-06-slides/figures/fig-01.svg",
    "courses/CSS-4008/materials/loose.md",
  ]);
  for (const key of keys) assert.ok(existsSync(join(root, key as string)), `${key} moved`);
});

test("a published folder material lands on the site as the same folder", () => {
  const { root, courseDir } = workspace();
  const approval = approvalOf([
    `work/${RUN}/materials/MODULE-06-slides/MODULE-06-slides.md`,
    `work/${RUN}/materials/MODULE-06-slides/figures/fig-01.svg`,
  ]);
  stageDocuments(approval, { root, courseDir, issues: new IssueList() });

  const documents = approval.records.get("documents")!.map((d) => ({
    ...d,
    course_version_id: RUN,
    original_filename: (d.storage_key as string).split("/").pop(),
  }));
  const bundle = { documents, submissions: [], items: [] } as any;
  const { published } = publishable(bundle, RUN, root);
  assert.deepEqual(
    published.map((m) => m.filename),
    ["MODULE-06-slides/MODULE-06-slides.md", "MODULE-06-slides/figures/fig-01.svg"],
  );

  const site = join(root, "site");
  copyMaterials(site, published);
  assert.equal(
    readFileSync(join(site, "materials", "MODULE-06-slides", "figures", "fig-01.svg"), "utf-8"),
    "<svg/>",
  );
});
