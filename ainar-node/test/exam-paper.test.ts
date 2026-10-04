/**
 * The question paper, printed from the record (src/exam-paper.ts) — and printed
 * without starting a process, because a DSH session under `workspace-write`
 * cannot open the pipe a captured child talks over. Every paper printed through
 * a spawned renderer, or through headless Chrome, asked the professor to
 * escalate the sandbox.
 */

import { strict as assert } from "node:assert";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { printPaper } from "../src/exam-paper.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, "..", "..", "workspace");

const withWorkspace = async (body: (root: string) => Promise<void>): Promise<void> => {
  const root = mkdtempSync(join(tmpdir(), "exam-paper-"));
  try {
    cpSync(join(EXAMPLE, "courses"), join(root, "courses"), { recursive: true });
    await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("the paper path starts no process: nothing on it imports child_process", () => {
  for (const file of ["../src/exam-paper.ts", "../bin/render-exam.ts", "../bin/exam-paper.ts"]) {
    const source = readFileSync(join(HERE, file), "utf-8");
    assert.doesNotMatch(source, /from\s+["']node:child_process["']/, `${file} imports child_process`);
    assert.doesNotMatch(source, /\bspawn(Sync)?\(|\bexecFile(Sync)?\(/, `${file} starts a process`);
  }
});

test("importing the renderer renders nothing and exits nothing", async () => {
  const module = await import("../bin/render-exam.ts");
  assert.equal(typeof module.renderExam, "function");
});

test("a paper prints in process, as a real PDF, and is registered against its assessment", async () => {
  await withWorkspace(async (root) => {
    const report = await printPaper({ assessmentId: "ASSESSMENT-01", root, format: "pdf" });
    const pdf = join(root, "courses", "CSS-4008", "assessments", "ASSESSMENT-01", "01-student.pdf");
    assert.ok(existsSync(pdf), "the PDF was written into the assessment's folder");
    assert.equal(readFileSync(pdf).subarray(0, 5).toString("latin1"), "%PDF-");
    assert.deepEqual(report.papers.map((paper) => paper.format), ["pdf"]);

    const documents = readFileSync(join(root, "courses", "CSS-4008", "documents", "generated.yaml"), "utf-8");
    assert.match(documents, /document_id: DOC-01-PAPER-PDF/);
    assert.match(documents, /renders: ASSESSMENT-01/, "the paper names the assessment it prints");
    assert.match(documents, /approval: draft/);
    assert.ok(report.lines.some((line) => line.includes("instructions_document_id: DOC-01-PAPER-PDF")));
  });
});

test("an exam with versions prints one paper per version: shared items plus its own", async () => {
  await withWorkspace(async (root) => {
    // Question 1 becomes version A, and a version B of it is added beside it —
    // `import-paper`'s convention: `extensions.variant` on the version's items.
    const file = join(root, "courses", "CSS-4008", "items", "assessment-01-items.yaml");
    const doc = parseYaml(readFileSync(file, "utf-8"));
    const first = doc.items.find((item: any) => item.number === 1);
    first.extensions = { ...(first.extensions ?? {}), variant: "A" };
    doc.items.push({ ...first, item_id: `${first.item_id}-B`, prompt: "A different question 1.", extensions: { variant: "B" } });
    writeFileSync(file, stringifyYaml(doc));

    const report = await printPaper({ assessmentId: "ASSESSMENT-01", root, format: "pdf" });
    const folder = join(root, "courses", "CSS-4008", "assessments", "ASSESSMENT-01");
    assert.deepEqual(report.papers.map((paper) => paper.variant), ["A", "B"]);
    assert.ok(existsSync(join(folder, "01-student-A.pdf")));
    assert.ok(existsSync(join(folder, "01-student-B.pdf")));

    const json = (variant: string) => JSON.parse(readFileSync(join(folder, "src", `01-paper-${variant}.json`), "utf-8"));
    // Each version carries all four questions, once: its own question 1 and the shared three.
    assert.deepEqual(json("A").questions.map((q: any) => q.number), [1, 2, 3, 4]);
    assert.deepEqual(json("B").questions.map((q: any) => q.number), [1, 2, 3, 4]);
    assert.equal(json("B").questions[0].prompt, "A different question 1.");
    assert.match(json("A").subtitle, /^Variant A/);

    const documents = readFileSync(join(root, "courses", "CSS-4008", "documents", "generated.yaml"), "utf-8");
    assert.match(documents, /document_id: DOC-01-PAPER-A-PDF/);
    assert.match(documents, /document_id: DOC-01-PAPER-B-PDF/);
    assert.match(documents, /variant: B/);

    await assert.rejects(printPaper({ assessmentId: "ASSESSMENT-01", root, variant: "C" }), /no variant 'C'.*A, B/);
  });
});

test("--no-register writes the paper and no record", async () => {
  await withWorkspace(async (root) => {
    const report = await printPaper({ assessmentId: "ASSESSMENT-01", root, format: "docx", register: false });
    assert.equal(report.written.length, 0);
    assert.ok(existsSync(join(root, "courses", "CSS-4008", "assessments", "ASSESSMENT-01", "01-student.docx")));
    assert.ok(!existsSync(join(root, "courses", "CSS-4008", "documents", "generated.yaml")) ||
      !readFileSync(join(root, "courses", "CSS-4008", "documents", "generated.yaml"), "utf-8").includes("DOC-01-PAPER"));
  });
});
