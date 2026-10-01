/**
 * An existing exam read into the course (src/paper-import.ts): the paper as
 * markdown, the key from the professor, the items derived from both.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { importPaper, itemIdFor, paperFiles, parseKey, parsePaper } from "../src/paper-import.ts";

const NOW = "2026-10-20T12:00:00+05:00";
const EXAM = "ASSESSMENT-MID-1";

const PAPER = `# Midterm 1

Answer every question. Closed book.

## 1. (2 marks)
Which of these is a supervised task?
- (a) Clustering
- (b) Classification
- (c) Dimensionality reduction

## Question 2 (5 marks) {essay}
Explain overfitting, with an example.

## 3. [1]
True or false: a larger learning rate always converges faster.
a) True
b) False

## 4. (3 marks)
Which of these are regularisers? Mark all that apply.
- a) Dropout
- b) L2 penalty
- c) Batch size
`;

const KEY = `## 1
b
2. A model fits noise in the training data
   and does worse on unseen data.
3. b
4. a, b
`;

test("a paper reads into numbered questions with marks, options and types", () => {
  const paper = parsePaper(PAPER);
  assert.equal(paper.variant, null);
  assert.match(paper.header, /Closed book/);
  assert.deepEqual(paper.questions.map((q) => [q.number, q.marks]), [[1, 2], [2, 5], [3, 1], [4, 3]]);
  assert.equal(paper.questions[0]!.prompt, "Which of these is a supervised task?");
  assert.deepEqual(paper.questions[0]!.options.map((o) => o.label), ["a", "b", "c"]);
  assert.equal(paper.questions[1]!.type, "essay");
  assert.equal(paper.questions[1]!.options.length, 0);
});

test("a question with no marks, or none at all, is refused rather than guessed", () => {
  assert.throws(() => parsePaper("## 1.\nWhat is a tensor?\n"), /question 1 has no marks/);
  assert.throws(() => parsePaper("# Just a title\n"), /no questions found/);
  assert.throws(() => parsePaper("## 1. (2)\nA\n## 1. (2)\nB\n"), /appear twice/);
});

test("a section heading is not a question", () => {
  const paper = parsePaper("## Part 2\nRead carefully.\n## 1. (2 marks)\nWhat is a tensor?\n");
  assert.equal(paper.questions.length, 1);
  assert.match(paper.header, /Part 2/);
});

test("the key reads one-liners, headed blocks and indented continuations", () => {
  const key = parseKey(KEY).get("")!;
  assert.equal(key.get(1), "b");
  assert.equal(key.get(2), "A model fits noise in the training data\nand does worse on unseen data.");
  assert.equal(key.get(4), "a, b");
});

test("items come out typed, keyed and marked draft", () => {
  const result = importPaper({ assessmentId: EXAM, papers: [parsePaper(PAPER)], key: parseKey(KEY), now: NOW });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.unkeyed, []);
  assert.equal(result.totals.get(""), 11);
  const byNumber = new Map(result.items.map((item) => [item.number, item as any]));
  assert.equal(byNumber.get(1).item_id, "ITEM-MID-1-01");
  assert.equal(byNumber.get(1).type, "multiple_choice");
  assert.deepEqual(byNumber.get(1).options.filter((o: any) => o.correct).map((o: any) => o.label), ["b"]);
  assert.equal(byNumber.get(2).type, "essay");
  assert.match(byNumber.get(2).answer_key, /fits noise/);
  assert.equal(byNumber.get(3).type, "true_false");
  assert.equal(byNumber.get(4).type, "multiple_select");
  for (const item of result.items) assert.equal(item.approval, "draft");
});

test("a choice question with no key stops the import", () => {
  const result = importPaper({ assessmentId: EXAM, papers: [parsePaper(PAPER)], key: null, now: NOW });
  assert.deepEqual(result.unkeyed, ["question 1", "question 3", "question 4"]);
  assert.deepEqual(result.noModelAnswer, ["question 2"]);
});

test("a key that names an option the paper does not have is a problem", () => {
  const result = importPaper({ assessmentId: EXAM, papers: [parsePaper(PAPER)], key: parseKey("1. d\n3. b\n4. a\n"), now: NOW });
  assert.ok(result.problems.some((problem) => /question 1: the key says d/.test(problem)));
});

test("variants: one paper each, items marked, key per section, totals compared", () => {
  const a = parsePaper("---\nvariant: A\n---\n## 1. (2 marks)\nPick\n- a) x\n- b) y\n## 2. (3 marks)\nWhy?\n");
  const b = parsePaper("---\nvariant: B\n---\n## 1. (2 marks)\nPick\n- a) y\n- b) x\n## 2. (2 marks)\nHow?\n");
  const key = parseKey("## Variant A\n1. a\n## Variant B\n1. b\n");
  const result = importPaper({ assessmentId: EXAM, papers: [a, b], key, now: NOW });
  assert.ok(result.items.some((item) => item.item_id === "ITEM-MID-1-A-01" && (item.extensions as any).variant === "A"));
  assert.ok(result.items.some((item) => item.item_id === "ITEM-MID-1-B-02"));
  assert.ok(result.problems.some((problem) => /different totals/.test(problem)));

  const unlabelled = importPaper({ assessmentId: EXAM, papers: [parsePaper(PAPER), parsePaper(PAPER)], key: null, now: NOW });
  assert.ok(unlabelled.problems.some((problem) => /every paper needs `variant:`/.test(problem)));
});

test("files and ids follow the assessment folder's names", () => {
  assert.equal(itemIdFor(EXAM, "B", 3), "ITEM-MID-1-B-03");
  assert.deepEqual(paperFiles(EXAM, "A"), {
    paper: "assessments/ASSESSMENT-MID-1/MID-1-student-A.md",
    key: "assessments/ASSESSMENT-MID-1/keys/MID-1-key.md",
    documentId: "DOC-MID-1-PAPER-A-MD",
  });
});
