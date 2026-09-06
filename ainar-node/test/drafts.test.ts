/**
 * What the draft loader refuses to read, against `_machinery` in `loader.py`.
 *
 * This file exists because there was no test here and the two loaders drifted.
 * `loader.py` skipped a dot-directory, a `node_modules` and a deck sidecar; this
 * port skipped nothing, and walked every directory it found. The consequence was
 * not a crash but something worse: `ainar validate` reported a workspace clean
 * while the pane serving the same files through this code listed a hundred and
 * sixteen `draft.collection` errors against it, and neither surface said the
 * other existed.
 *
 * The three cases below are the three in `tests/test_drafts.py`. They are worth
 * keeping in step by hand — a divergence here is invisible from Python, which is
 * exactly how the last one survived.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IssueList } from "../src/issues.ts";
import { loadDrafts } from "../src/drafts.ts";

const scratch = (): string => mkdtempSync(join(tmpdir(), "ainar-drafts-"));

/**
 * One genuine proposal, so a test that skips everything cannot pass by accident.
 *
 * An ACTIVITY rather than a module: `modules` left `DRAFTABLE` when the course's
 * structure became the professor's to author directly, so a modules draft is now
 * refused and would fail these tests for a reason that has nothing to do with
 * the directory walking they are about.
 */
const aRealDraft = (root: string): void =>
  writeFileSync(
    join(root, "activities-draft.yaml"),
    "activities:\n  - activity_id: ACT-DRAFT-01\n" +
      "    course_version_id: CSS-4008-2026-FALL\n    type: lecture\n    title: Visible\n",
    "utf-8",
  );

test("a tool's leftovers in node_modules are not read as drafts", () => {
  const root = scratch();
  mkdirSync(join(root, "materials", ".build", "node_modules"), { recursive: true });
  writeFileSync(
    join(root, "materials", ".build", "node_modules", ".modules.yaml"),
    "hoistPattern:\n  - '*'\n",
    "utf-8",
  );
  aRealDraft(root);

  const issues = new IssueList();
  const drafted = loadDrafts(root, issues);

  assert.deepEqual(issues.errors, []);
  assert.deepEqual(
    drafted.activities.map((activity) => activity.activity_id),
    ["ACT-DRAFT-01"],
  );
});

test("a draft in a dot-directory is skipped rather than half read", () => {
  const root = scratch();
  mkdirSync(join(root, ".cache"), { recursive: true });
  writeFileSync(
    join(root, ".cache", "concepts-draft.yaml"),
    "concepts:\n  - concept_id: CONCEPT-DRAFT-HIDDEN\n    course_id: CSS-4008\n    title: Hidden\n",
    "utf-8",
  );
  aRealDraft(root);

  const issues = new IssueList();
  const drafted = loadDrafts(root, issues);

  assert.deepEqual(issues.errors, []);
  assert.deepEqual(
    drafted.activities.map((activity) => activity.activity_id),
    ["ACT-DRAFT-01"],
    "the hidden directory contributed nothing",
  );
});

test("a deck sidecar beside a real draft is not read as one", () => {
  const root = scratch();
  const materials = join(root, "materials");
  mkdirSync(materials, { recursive: true });
  writeFileSync(
    join(materials, "MODULE-DRAFT-01-slides.plan.yaml"),
    "plan_version: 1\ndeck: MODULE-DRAFT-01-slides.md\nfigures: []\n",
    "utf-8",
  );
  writeFileSync(
    join(materials, "MODULE-DRAFT-01-slides.outline.yaml"),
    "outline_version: 1\ndeck: MODULE-DRAFT-01-slides.md\nbeats: []\n",
    "utf-8",
  );
  writeFileSync(
    join(materials, "documents-draft.yaml"),
    "documents:\n" +
      "  - document_id: DOC-DRAFT-01\n" +
      "    title: Week one slides\n" +
      "    storage_key: materials/MODULE-DRAFT-01-slides.md\n" +
      "    mime_type: text/markdown\n",
    "utf-8",
  );

  const issues = new IssueList();
  const drafted = loadDrafts(root, issues);

  assert.deepEqual(issues.errors, []);
  assert.deepEqual(
    drafted.documents.map((document) => document.document_id),
    ["DOC-DRAFT-01"],
  );
});
