/**
 * Shared answers: pairs whose exam answers agree far more than the class's,
 * weighted by how rare what they share is (BACKLOG E38, STN-10).
 *
 *     node --experimental-strip-types --test test/shared-answers.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { sharedAnswers } from "../src/shared-answers.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const sample: any = new Workspace(ROOT, "flag").findRun(RUN);

const N = 20;
const STUDENTS = Array.from({ length: N }, (_, i) => `STUDENT-P${String(i).padStart(2, "0")}`);

/** Words nobody else writes: each student's answer is their own apart from what a test plants. */
const own = (i: number, item: string) =>
  Array.from({ length: 12 }, (_, k) => `w${i}${item.replace(/\W/g, "")}k${k}`).join(" ");

type Answer = { text?: string; chose?: string[] };

/**
 * One run with the given exams, each with its items; `answer(exam, item, i)`
 * is what student `i` wrote, `null` for nothing.
 */
const course = (
  exams: { id: string; type: string; items: { id: string; type: string; prompt?: string; options?: any[] }[] }[],
  answer: (exam: string, item: string, i: number) => Answer | null,
) => {
  const b: any = structuredClone(sample);
  b.assessments = exams.map((e) => ({ assessment_id: e.id, course_version_id: RUN, title: e.id, type: e.type, maximum_score: 10 }));
  b.items = exams.flatMap((e) =>
    e.items.map((item) => ({
      item_id: item.id,
      assessment_id: e.id,
      type: item.type,
      prompt: item.prompt ?? "Explain it.",
      maximum_score: 1,
      options: item.options ?? [],
    })),
  );
  b.submissions = [];
  b.item_responses = [];
  for (const e of exams) {
    STUDENTS.forEach((student_id, i) => {
      const submission_id = `SUB-${e.id}-${i}`;
      b.submissions.push({ submission_id, assessment_id: e.id, student_id, status: "submitted", attempt: 1, files: [] });
      for (const item of e.items) {
        const a = answer(e.id, item.id, i);
        if (!a) continue;
        b.item_responses.push({
          response_id: `RESP-${item.id}-${i}`,
          approval: "draft",
          submission_id,
          item_id: item.id,
          student_id,
          chosen_options: a.chose ?? [],
          raw_response: a.text ?? null,
        });
      }
    });
  }
  return b;
};

const WRITTEN = [
  { id: "ITEM-W1", type: "short_answer", prompt: "Explain why a context window limits what the model can use." },
  { id: "ITEM-W2", type: "short_answer" },
];
const COPIED = "because the window drops the oldest turns first so the earliest instructions quietly vanish from the conversation entirely";

test("two students sharing a long run of wording nobody else wrote are unusual; the rest are not", () => {
  const b = course([{ id: "EXAM-1", type: "exam", items: WRITTEN }], (_e, item, i) => ({
    text: `${item === "ITEM-W1" && (i === 3 || i === 11) ? COPIED : ""} ${own(i, item)}`,
  }));
  const [exam] = sharedAnswers(b, RUN).exams;
  assert.equal(exam!.answered, N);
  assert.deepEqual(exam!.unusual.map((p) => p.students), [["STUDENT-P03", "STUDENT-P11"]]);
  const [item] = exam!.unusual[0]!.items;
  assert.equal(item!.item_id, "ITEM-W1");
  // The shared run comes back as one excerpt, not as overlapping phrases.
  assert.deepEqual(item!.shared, [COPIED]);
});

test("wording from the question, and wording the whole class uses, never counts", () => {
  const b = course([{ id: "EXAM-1", type: "exam", items: WRITTEN }], (_e, item, i) => ({
    // Everyone restates the question and uses one stock phrase; P03 and P11 do nothing more alike.
    text: `a context window limits what the model can use and every answer says the same stock phrase here ${own(i, item)}`,
  }));
  const [exam] = sharedAnswers(b, RUN).exams;
  assert.deepEqual(exam!.unusual, []);
});

test("the same numbers, worked the same way, are not wording", () => {
  const b = course([{ id: "EXAM-1", type: "exam", items: WRITTEN }], (_e, item, i) => ({
    text: `${item === "ITEM-W1" && (i === 3 || i === 11) ? "2 2 0 2 1 2 0 2 3 2 3 2 3 5 18 a b 0 1" : ""} ${own(i, item)}`,
  }));
  assert.deepEqual(sharedAnswers(b, RUN).exams[0]!.unusual, []);
});

const CHOICES = Array.from({ length: 6 }, (_, k) => ({
  id: `ITEM-C${k}`,
  type: "multiple_choice",
  options: ["A", "B", "C", "D"].map((label) => ({ label, text: `option ${label}`, correct: label === "A" })),
}));

test("a rare wrong choice in common weighs far more than a common right one", () => {
  // Everyone right on every item, except P03 and P11, who choose the same wrong option throughout.
  const b = course([{ id: "QUIZ-1", type: "quiz", items: CHOICES }], (_e, _item, i) => ({ chose: [i === 3 || i === 11 ? "C" : "A"] }));
  const [exam] = sharedAnswers(b, RUN).exams;
  const pair = exam!.unusual.find((p) => p.students.join() === "STUDENT-P03,STUDENT-P11");
  assert.ok(pair, "the pair sharing the wrong option is unusual");
  assert.ok(pair!.items.every((item) => item.kind === "choice" && item.both_wrong));
  // Two who share only the right answers are not.
  assert.ok(!exam!.unusual.some((p) => p.students.join() === "STUDENT-P00,STUDENT-P01"));
});

test("a pair unusual on two exams recurs; homework is never compared", () => {
  const exams = [
    { id: "EXAM-1", type: "exam", items: WRITTEN },
    { id: "EXAM-2", type: "exam", items: WRITTEN.map((item) => ({ ...item, id: `${item.id}-2` })) },
    { id: "HOMEWORK-1", type: "assignment", items: WRITTEN.map((item) => ({ ...item, id: `${item.id}-H` })) },
  ];
  const b = course(exams, (_e, item, i) => ({ text: `${item.startsWith("ITEM-W1") && (i === 3 || i === 11) ? COPIED : ""} ${own(i, item)}` }));
  const found = sharedAnswers(b, RUN);
  assert.deepEqual(found.exams.map((e) => e.assessment_id), ["EXAM-1", "EXAM-2"]);
  assert.deepEqual(found.recurring, [{ students: ["STUDENT-P03", "STUDENT-P11"], exams: ["EXAM-1", "EXAM-2"] }]);
});

test("with no recorded answers there is nothing to compare, and the note says where answers come from", () => {
  const found = sharedAnswers(course([{ id: "EXAM-1", type: "exam", items: WRITTEN }], () => null), RUN);
  assert.deepEqual(found.exams, []);
  assert.ok(found.notes[0]!.includes("scans record"));
});
