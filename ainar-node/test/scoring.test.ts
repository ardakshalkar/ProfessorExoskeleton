import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dominantMisconception,
  scoreChoiceItems,
  successRate,
  type ItemStats,
} from "../src/scoring.ts";

/**
 * The assertions are `tests/test_grading.py::scoring` transcribed, with the two
 * items that file reads out of the example course written here as literals — the
 * claim being made is about `ainar/scoring.py`, and a reader should be able to
 * check it without loading a course.
 *
 * `ITEM-01-01` is the twenty-mark single-answer question; `ITEM-01-02` is the one
 * whose (b) is tagged as a misconception. `ITEM-01-03` is free text.
 */
const items = () =>
  new Map<string, any>([
    [
      "ITEM-01-01",
      {
        item_id: "ITEM-01-01",
        prompt: "Which one?",
        type: "multiple_choice",
        maximum_score: 20,
        options: [
          { label: "a", text: "right", correct: true },
          { label: "b", text: "wrong", correct: false },
        ],
      },
    ],
    [
      "ITEM-01-02",
      {
        item_id: "ITEM-01-02",
        prompt: "Which one?",
        type: "multiple_choice",
        maximum_score: 10,
        options: [
          { label: "a", text: "right", correct: true },
          {
            label: "b",
            text: "wrong",
            correct: false,
            indicates_misconception_of: "CONCEPT-TRAIN-TEST-SPLIT",
          },
        ],
      },
    ],
    [
      "ITEM-01-03",
      {
        item_id: "ITEM-01-03",
        prompt: "Explain.",
        type: "essay",
        maximum_score: 10,
        options: [],
      },
    ],
    [
      "ITEM-MS",
      {
        item_id: "ITEM-MS",
        prompt: "Which ones?",
        type: "multiple_select",
        maximum_score: 10,
        options: [
          { label: "a", text: "right", correct: true },
          { label: "b", text: "right", correct: true },
          { label: "c", text: "wrong", correct: false },
          { label: "d", text: "wrong", correct: false },
        ],
      },
    ],
  ]);

const responses = (...rows: [string, string, string[]][]) =>
  rows.map(([response_id, item_id, chosen_options]) => ({
    response_id,
    submission_id: "SUB-9060",
    item_id,
    student_id: "STUDENT-JNG7SN",
    chosen_options,
  })) as Record<string, any>[];

test("a correct choice earns the full item score", () => {
  const rows = responses(["RESP-DRAFT-01", "ITEM-01-01", ["a"]]);
  const result = scoreChoiceItems(rows, items());
  assert.equal(rows[0]!.score, 20);
  assert.equal(rows[0]!.correct, true);
  assert.equal(rows[0]!.scored_by, "auto");
  assert.deepEqual(result.scored, ["RESP-DRAFT-01"]);
});

test("a wrong choice earns nothing", () => {
  const rows = responses(["RESP-DRAFT-02", "ITEM-01-02", ["b"]]);
  scoreChoiceItems(rows, items());
  assert.equal(rows[0]!.score, 0);
  assert.equal(rows[0]!.correct, false);
});

test("free text items are left for a human", () => {
  const rows = [
    {
      response_id: "RESP-DRAFT-03",
      submission_id: "SUB-9060",
      item_id: "ITEM-01-03",
      student_id: "STUDENT-JNG7SN",
      raw_response: "Route planning is search.",
    },
  ] as Record<string, any>[];
  const result = scoreChoiceItems(rows, items());
  assert.equal("score" in rows[0]!, false);
  assert.match(result.unscorable[0]!, /needs a human/);
});

test("already scored responses are left alone", () => {
  const rows = responses(["RESP-DRAFT-04", "ITEM-01-01", ["a"]]);
  rows[0]!.score = 7;
  const result = scoreChoiceItems(rows, items());
  assert.equal(rows[0]!.score, 7);
  assert.deepEqual(result.alreadyScored, ["RESP-DRAFT-04"]);
});

test("rescoring is opt in", () => {
  const rows = responses(["RESP-DRAFT-05", "ITEM-01-01", ["a"]]);
  rows[0]!.score = 7;
  scoreChoiceItems(rows, items(), { rescore: true });
  assert.equal(rows[0]!.score, 20);
});

test("an undefined option is refused, not marked wrong", () => {
  const rows = responses(["RESP-DRAFT-06", "ITEM-01-01", ["z"]]);
  const result = scoreChoiceItems(rows, items());
  assert.equal("score" in rows[0]!, false);
  assert.match(result.unscorable[0]!, /not defined/);
});

test("an unanswered item is not silently zeroed", () => {
  const rows = responses(["RESP-DRAFT-07", "ITEM-01-01", []]);
  const result = scoreChoiceItems(rows, items());
  assert.equal("score" in rows[0]!, false);
  assert.match(result.unscorable[0]!, /no option chosen/);
});

test("the class converging on one distractor is surfaced", () => {
  const rows = responses(
    ["RESP-DRAFT-08", "ITEM-01-02", ["b"]],
    ["RESP-DRAFT-09", "ITEM-01-02", ["b"]],
    ["RESP-DRAFT-10", "ITEM-01-02", ["a"]],
  );
  const result = scoreChoiceItems(rows, items());
  const stats = result.stats.get("ITEM-01-02")!;
  assert.equal(stats.responses, 3);
  assert.equal(stats.correct, 1);
  assert.equal(successRate(stats), 0.33);
  const dominant = dominantMisconception(stats)!;
  assert.equal(dominant.label, "b");
  assert.equal(dominant.chose, 2);
  assert.equal(dominant.misconception, "CONCEPT-TRAIN-TEST-SPLIT");
});

test("no dominant misconception when everyone is right", () => {
  const rows = responses(["RESP-DRAFT-11", "ITEM-01-02", ["a"]]);
  const stats = scoreChoiceItems(rows, items()).stats.get("ITEM-01-02")!;
  assert.equal(dominantMisconception(stats), null);
});

test("an unknown item is named rather than skipped", () => {
  const rows = responses(["RESP-DRAFT-12", "ITEM-NOPE", ["a"]]);
  const result = scoreChoiceItems(rows, items());
  assert.deepEqual(result.unscorable, ["RESP-DRAFT-12: unknown item ITEM-NOPE"]);
});

// ------------------------------------------------------- partial credit

test("multiple_select is all-or-nothing without --partial", () => {
  const rows = responses(["RESP-P1", "ITEM-MS", ["a"]]);
  scoreChoiceItems(rows, items());
  assert.equal(rows[0]!.score, 0);
});

test("partial credit counts hits and cancels them with misses", () => {
  // One of two right, nothing wrong: half the marks.
  const half = responses(["RESP-P2", "ITEM-MS", ["a"]]);
  scoreChoiceItems(half, items(), { partial: true });
  assert.equal(half[0]!.score, 5);

  // One right, one wrong: they cancel.
  const cancelled = responses(["RESP-P3", "ITEM-MS", ["a", "c"]]);
  scoreChoiceItems(cancelled, items(), { partial: true });
  assert.equal(cancelled[0]!.score, 0);

  // Both wrong: floored at zero rather than negative.
  const floored = responses(["RESP-P4", "ITEM-MS", ["c", "d"]]);
  scoreChoiceItems(floored, items(), { partial: true });
  assert.equal(floored[0]!.score, 0);
});

test("both right answers is correct, not partial", () => {
  const rows = responses(["RESP-P5", "ITEM-MS", ["a", "b"]]);
  scoreChoiceItems(rows, items(), { partial: true });
  assert.equal(rows[0]!.score, 10);
  assert.equal(rows[0]!.correct, true);
});

// -------------------------------------------------------------- rounding

/**
 * `round()` in Python is half-to-even and rounds the double's decimal
 * expansion. A JavaScript `Math.round(x * 100) / 100` disagrees on both counts,
 * and a success rate is exactly the shape that lands on the disagreement: small
 * integers over small integers.
 */
test("a success rate rounds the way Python rounds", () => {
  const rate = (correct: number, responses_: number): number | null =>
    successRate({ correct, responses: responses_ } as ItemStats);

  assert.equal(rate(1, 3), 0.33); // 0.3333… → nearest
  assert.equal(rate(2, 3), 0.67); // 0.6666… → nearest
  assert.equal(rate(3, 8), 0.38); // 0.375 exactly → 38 is even
  assert.equal(rate(1, 8), 0.12); // 0.125 exactly → 12 is even, Math.round says 13
  assert.equal(rate(0, 3), 0.0);
  assert.equal(rate(0, 0), null);
});
