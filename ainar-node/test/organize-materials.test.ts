import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { organizeMaterials, planFolders } from "../src/material-folders.ts";

const sha = (text: string): string => "sha256:" + createHash("sha256").update(text).digest("hex");

test("files are grouped by what their names say, and nothing else is guessed", () => {
  const { to, left } = planFolders([
    "M-01-slides.md",
    "M-01-slides.pptx",
    "M-01-slides.plan.yaml",
    "M-01-slides.outline.yaml",
    "M-01-slides-fig-01-a.svg",
    "M-01-facts.py",
    "M-01-notes.md",
    "M-05-Imported.pptx",
    "M-05-Imported.pdf",
    "quiz-01-student.md",
    "deck_kit.py",
    "materials.yaml",
    "M-01-slides.md.bak-1",
  ]);
  assert.equal(to.get("M-01-slides.md"), "M-01-slides/M-01-slides.md");
  assert.equal(to.get("M-01-slides-fig-01-a.svg"), "M-01-slides/figures/fig-01-a.svg");
  assert.equal(to.get("M-01-facts.py"), "M-01-slides/build/M-01-facts.py");
  assert.equal(to.get("M-01-notes.md"), "M-01-slides/sources/M-01-notes.md");
  assert.equal(to.get("M-05-Imported.pdf"), "M-05-Imported/M-05-Imported.pdf");
  assert.equal(to.get("quiz-01-student.md"), "quiz-01-student/quiz-01-student.md");
  assert.deepEqual([...left.keys()], ["deck_kit.py"]);
  assert.ok(!to.has("M-01-slides.md.bak-1") && !to.has("materials.yaml"));
});

const course = (recordedChecksum: (deck: string) => string) => {
  const root = mkdtempSync(join(tmpdir(), "organize-"));
  const courseDir = join(root, "courses", "C1");
  const dir = join(courseDir, "materials");
  mkdirSync(join(courseDir, "documents"), { recursive: true });
  mkdirSync(dir, { recursive: true });
  const deck = "# deck\n![a](M-01-slides-fig-01-a.svg)\n";
  writeFileSync(join(dir, "M-01-slides.md"), deck);
  writeFileSync(join(dir, "M-01-slides.plan.yaml"), "deck: M-01-slides.md\n");
  writeFileSync(join(dir, "M-01-slides-fig-01-a.svg"), "<svg/>");
  writeFileSync(join(dir, "M-01-slides.pptx"), "pptx");
  writeFileSync(join(dir, "materials.yaml"), "producers:\n  - id: w1\n    render: M-01-slides.md\n    produces: M-01-slides.pptx\n");
  writeFileSync(
    join(courseDir, "documents", "generated.yaml"),
    "documents:\n- document_id: DOC-1\n  storage_key: courses/C1/materials/M-01-slides.md\n" +
      `  size_bytes: ${deck.length}\n  checksum: ${recordedChecksum(deck)}\n`,
  );
  return { root, courseDir, dir };
};

test("records, links and the manifest follow the move, and the deck is restamped", () => {
  const { root, courseDir, dir } = course(sha);
  const result = organizeMaterials({ root, courseDir, courseKey: "courses/C1/materials/" });

  assert.ok(existsSync(join(dir, "M-01-slides", "figures", "fig-01-a.svg")));
  const md = readFileSync(join(dir, "M-01-slides", "M-01-slides.md"), "utf-8");
  assert.match(md, /\]\(figures\/fig-01-a\.svg\)/);

  const records = readFileSync(join(courseDir, "documents", "generated.yaml"), "utf-8");
  assert.match(records, /storage_key: courses\/C1\/materials\/M-01-slides\/M-01-slides\.md/);
  assert.ok(records.includes(sha(md)), "checksum follows the rewritten deck");
  assert.deepEqual(result.restamped, ["DOC-1"]);

  const manifest = readFileSync(join(dir, "materials.yaml"), "utf-8");
  assert.match(manifest, /render: M-01-slides\/M-01-slides\.md/);
  assert.match(manifest, /produces: M-01-slides\/M-01-slides\.pptx/);
});

test("a record that already disagreed with its file is not quietly restamped", () => {
  const { root, courseDir } = course(() => sha("an earlier version of the deck"));
  const result = organizeMaterials({ root, courseDir, courseKey: "courses/C1/materials/" });
  const records = readFileSync(join(courseDir, "documents", "generated.yaml"), "utf-8");
  assert.ok(records.includes(sha("an earlier version of the deck")));
  assert.deepEqual(result.restamped, []);
  assert.ok(result.left.some((entry) => /already disagreed/.test(entry.why)));
});

test("a dry run changes nothing", () => {
  const { root, courseDir, dir } = course(sha);
  organizeMaterials({ root, courseDir, courseKey: "courses/C1/materials/", dryRun: true });
  assert.ok(existsSync(join(dir, "M-01-slides.md")));
  assert.ok(!existsSync(join(dir, "M-01-slides")));
});
