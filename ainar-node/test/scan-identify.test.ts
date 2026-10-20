/**
 * Where `scans identify` gets a hint when nobody gives a title
 * (src/scan-identify.ts): the uploaded file's name, else the printed title on
 * the cover — with the renderer and the model faked.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coverTitlePrompt, filenameHint, readCoverTitle, uploadedNames, usefulHint } from "../src/scan-identify.ts";
import { rankAssessments } from "../src/scans.ts";

const ASSESSMENTS = [
  { assessment_id: "ASSESSMENT-MIDTERM-1", title: "Midterm Exam 1", type: "exam", delivery: "paper_exam", due_at: "2026-10-13T09:00:00+05:00" },
  { assessment_id: "ASSESSMENT-QUIZ-03", title: "Quiz 3 - Weeks 4-5, with revision from Weeks 1-2", type: "quiz", delivery: "paper_exam", due_at: "2026-10-05T09:00:00+05:00" },
  { assessment_id: "ASSESSMENT-HW-02", title: "HW2 - A grant office that answers in JSON", type: "assignment", due_at: "2026-09-25T23:59:00+05:00" },
];

test("the uploaded name gives a title and a date, without the course code", () => {
  const hint = filenameHint("2026-10-13_CSS-4007_Midterm_Exam_1.pdf", "CSS-4007");
  assert.deepEqual(hint, { title: "midterm exam 1", date: "2026-10-13", from: "the uploaded file's name" });
  assert.equal(filenameHint("quiz3.PDF", "CSS-4007").title, "quiz 3");
  assert.equal(filenameHint("CSS-4007.pdf", "CSS-4007").title, null);
});

test("the 2026-10-20 midterm pile ranks Midterm 1 first on its uploaded name", () => {
  const hint = filenameHint("2026-10-13_CSS-4007_Midterm_Exam_1.pdf", "CSS-4007");
  assert.ok(usefulHint(hint, ASSESSMENTS));
  const ranked = rankAssessments(ASSESSMENTS, [], hint);
  assert.equal(ranked[0]!.assessment_id, "ASSESSMENT-MIDTERM-1");
  assert.match(ranked[0]!.reasons.join("; "), /shares "midterm", "exam", "1" with the uploaded file's name/);
  assert.match(ranked[0]!.reasons.join("; "), /due within 1 day/);
  assert.ok(ranked[0]!.score > ranked[1]!.score + 0.5);
});

test("a scanner's name, or a name with no assessment word in it, is not a hint", () => {
  assert.equal(usefulHint(filenameHint("0050AA48FF5B261001144750.pdf", "CSS-4007"), ASSESSMENTS), false);
  assert.equal(usefulHint(filenameHint("scan_001.pdf", "CSS-4007"), ASSESSMENTS), false);
  assert.equal(usefulHint(filenameHint("Ivanov.pdf", "CSS-4007"), ASSESSMENTS), false);
  assert.equal(usefulHint(filenameHint("ivanov_quiz3.pdf", "CSS-4007"), ASSESSMENTS), true);
});

test("the upload ledger maps each stored file back to its name, and a broken one maps nothing", () => {
  const inbox = mkdtempSync(join(tmpdir(), "identify-"));
  assert.equal(uploadedNames(inbox).size, 0);
  writeFileSync(join(inbox, "uploads.json"), JSON.stringify([{ file: "scan-92d32fb5e5.pdf", original: "2026-10-13_CSS-4007_Midterm_Exam_1.pdf" }, { file: "x" }]));
  assert.deepEqual([...uploadedNames(inbox)], [["scan-92d32fb5e5.pdf", "2026-10-13_CSS-4007_Midterm_Exam_1.pdf"]]);
  writeFileSync(join(inbox, "uploads.json"), "{not json");
  assert.equal(uploadedNames(inbox).size, 0);
});

test("the cover read asks for printed text only, and turns the title into a hint", async () => {
  assert.match(coverTitlePrompt("CSS-4007"), /Never return a person's name/);
  const work = mkdtempSync(join(tmpdir(), "identify-cover-"));
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "b0.png"), "png");
  const rendered: number[] = [];
  const read = await readCoverTitle("pile.pdf", {
    courseId: "CSS-4007",
    work,
    render: async (_pdf, page) => {
      rendered.push(page);
      return [join(work, "b0.png")];
    },
    reader: async (content) => {
      assert.equal(content.length, 3);
      return {
        text: JSON.stringify({ printed_title: "Midterm  Exam 1", course_code: "CSS-4007", date: "2026-10-13", variant: "A" }),
        model: "m",
        usage: { prompt_tokens: 1000, completion_tokens: 30 },
        ms: 5,
        at: "2026-10-20T12:00:00Z",
      };
    },
  });
  assert.deepEqual(rendered, [1]);
  assert.deepEqual(read.hint, { title: "Midterm Exam 1", date: "2026-10-13", from: "the cover" });
  assert.equal(read.variant, "A");
  assert.ok(read.usd > 0);
  assert.equal(existsSync(work), false, "the rendered strip is not kept");

  const blank = await readCoverTitle("pile.pdf", {
    courseId: "CSS-4007",
    work: mkdtempSync(join(tmpdir(), "identify-cover-")),
    render: async () => [],
    reader: async () => ({ text: JSON.stringify({ printed_title: "", date: "13 Oct" }), model: "m", usage: {}, ms: 1, at: "2026-10-20T12:00:00Z" }),
  });
  assert.equal(blank.hint, null);
});
