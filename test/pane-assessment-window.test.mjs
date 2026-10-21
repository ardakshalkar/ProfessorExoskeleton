/**
 * The window a Students-view header number opens: plugins/dsh-professor-pane/server/assessment-window.js
 *
 *     node --test test/pane-assessment-window.test.mjs
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { describe, summarise, windowPanel } from "../plugins/dsh-professor-pane/server/assessment-window.js";

const row = (score, maximum = 10) => ({ score, maximum, status: "graded" });
const cell = (student, state, group = "A", entry = null) => ({ student, group, state, entry });

const cells = [
  cell("STUDENT-AAAAAA", "graded", "A", row(9)),
  cell("STUDENT-BBBBBB", "graded", "A", row(4)),
  cell("STUDENT-CCCCCC", "graded", "B", row(7)),
  cell("STUDENT-DDDDDD", "graded", "B", row(10)),
  cell("STUDENT-EEEEEE", "in", "B"),
  cell("STUDENT-FFFFFF", "missing", "A"),
  cell("STUDENT-GGGGGG", "missing", "B"),
];
const assessment = { assessment_id: "ASSESSMENT-QUIZ-09", title: "Quiz 9", type: "quiz", weight: 0.02, due_at: "2026-10-01T09:00:00+05:00" };
const criteria = [
  { criterion_id: "CRIT-1", title: "Q1", maximum_score: 4 },
  { criterion_id: "CRIT-2", title: "Q2", maximum_score: 6 },
];
const decided = (criterion, score) => ({ criterion_id: criterion, status: "approved", professor_decision: { score } });
const evaluations = [
  decided("CRIT-1", 4), decided("CRIT-1", 1), decided("CRIT-2", 6),
  { criterion_id: "CRIT-2", status: "suggested", ai_suggestion: { score: 0 } },
];

test("the figures: counts, ends and middle of the graded, spread, tenths, groups, questions", () => {
  const s = summarise({ assessment, cells, criteria, evaluations });
  assert.deepEqual(s.counts, { graded: 4, in: 1, handed: 5, missing: 2, unrecorded: 0, ahead: 0 });
  assert.equal(s.students, 7);
  assert.equal(s.scores.mean, 7.5);
  assert.equal(s.scores.median, 8);
  assert.equal(s.scores.low, 4);
  assert.equal(s.scores.high, 10);
  assert.equal(s.percents.under_half, 1);
  assert.deepEqual(s.bins, [0, 0, 0, 0, 1, 0, 0, 1, 0, 2], "full marks fall in the top tenth");
  assert.deepEqual(s.missing, ["STUDENT-FFFFFF", "STUDENT-GGGGGG"]);
  assert.deepEqual(s.lowest.map((entry) => entry.student), ["STUDENT-BBBBBB", "STUDENT-CCCCCC", "STUDENT-AAAAAA", "STUDENT-DDDDDD"]);
  assert.deepEqual(
    s.groups.map((g) => [g.group, g.n, g.students, g.missing, g.mean]),
    [["A", 2, 3, 1, 65], ["B", 2, 4, 1, 85]],
  );
  // A suggestion is waiting, not averaged in.
  assert.deepEqual(
    s.questions.map((q) => [q.id, q.decided, q.waiting, q.mean]),
    [["CRIT-1", 2, 0, 2.5], ["CRIT-2", 1, 1, 6]],
  );
  assert.equal(s.scans, null);
});

test("nothing graded yet says so, and no figure is invented", () => {
  const s = summarise({ assessment, cells: [cell("STUDENT-AAAAAA", "in"), cell("STUDENT-BBBBBB", "missing")] });
  assert.equal(s.scores.mean, null);
  assert.deepEqual(describe([]), { n: 0, mean: null, median: null, sd: null, low: null, high: null });
  const html = windowPanel(s, { nameOf: (id) => id, when: (iso) => iso.slice(0, 10) });
  assert.match(html, /Nothing graded yet: 1 handed in and waiting/);
  assert.match(html, /Missing \(1\)/);
  assert.doesNotMatch(html, /By subgroup/, "one group draws no subgroup table");
});

test("a paper exam shows its pile: the steps, the papers, and the way to Scans and the Grade view", () => {
  const pile = {
    stages: [{ id: "match", label: "Match", state: "yours", detail: "39 of 63 placed" }, { id: "read", label: "Read", state: "done", detail: "" }],
    now: { title: "Send the marks to Canvas", body: "Every answer is decided." },
    lanes: { placed: 15, check: 24, held: 24, skipped: 0 },
    status: { placed: new Array(39).fill("S"), transcribed: new Array(39).fill("S"), missing: new Array(42).fill("S") },
    canvas: { ready: 39, sent: 0, unsent: 39, changed: 0 },
  };
  const s = summarise({ assessment, cells, pile });
  assert.deepEqual([s.scans.placed, s.scans.read, s.scans.no_scan], [39, 39, 42]);
  const html = windowPanel(s, { nameOf: (id) => (id === "STUDENT-FFFFFF" ? "Aru <Test>" : id), when: (iso) => iso.slice(0, 10) });
  assert.match(html, /data-aw-panel="ASSESSMENT-QUIZ-09" hidden/);
  assert.match(html, /<li class="yours" title="39 of 63 placed">Match<\/li>/);
  assert.match(html, /Held — say who<\/div><div class="awv low">24/);
  assert.match(html, /data-aw-scans="ASSESSMENT-QUIZ-09"/);
  assert.match(html, /data-aw-grade="ASSESSMENT-QUIZ-09" data-label="Quiz 9"/);
  assert.match(html, /Aru &lt;Test&gt;/, "a name is escaped");
  assert.match(html, /quiz · out of 10 · 2% of the course · due 2026-10-01/);
  assert.doesNotMatch(html, /Held papers/, "a pile read without the roster lists no held papers");
});

test("a held paper names its nearest student, and a missing student it is nearest is flagged", () => {
  const pile = {
    stages: [],
    now: { title: "Say who 2 papers are", body: "" },
    lanes: { placed: 4, check: 0, held: 2, skipped: 0 },
    status: { placed: [], transcribed: [], missing: [] },
    canvas: null,
    held: [
      { file: "scan-1.pdf", pages: "65,66,68,67", variant: "A", written: "Kozhantuan Bizhanov", candidates: ["STUDENT-FFFFFF", "STUDENT-AAAAAA"] },
      { file: "scan-1.pdf", pages: "1-4", variant: "D", written: "Darrir", candidates: [] },
    ],
  };
  const s = summarise({ assessment, cells, pile, names: true });
  assert.deepEqual(s.maybe_held, ["STUDENT-FFFFFF"]);
  assert.deepEqual(s.scans.held[0].candidates, [{ student: "STUDENT-FFFFFF", missing: true }, { student: "STUDENT-AAAAAA", missing: false }]);
  const html = windowPanel(s, {
    nameOf: (id) => (id === "STUDENT-FFFFFF" ? "Bizhamal" : id),
    when: (iso) => iso.slice(0, 10),
    crop: (paper) => "http://h/crop?pages=" + paper.pages,
  });
  assert.match(html, /Held papers \(2\)/);
  assert.match(html, /pages 65,66,68,67 · variant A · read as “Kozhantuan Bizhanov”/);
  assert.match(
    html,
    /data-aw-place="ASSESSMENT-QUIZ-09" data-file="scan-1.pdf" data-pages="65,66,68,67" data-student="STUDENT-FFFFFF">This is Bizhamal <span class="dim">· no paper yet/,
  );
  assert.match(html, /This is STUDENT-AAAAAA <span class="dim">· has a paper/);
  assert.match(html, /No enrolled student is near this name/);
  assert.match(html, /<img class="awcrop"[^>]*src="http:\/\/h\/crop\?pages=1-4"/);
  assert.match(html, /Bizhamal <span class="awmay">· held paper\?<\/span>/, "the missing student is flagged");
  assert.match(html, /1 of them may only be unplaced/);

  // On pseudonyms the written name is not carried, and no crop is drawn.
  const hidden = windowPanel(summarise({ assessment, cells, pile }), { nameOf: (id) => id, when: (iso) => iso });
  assert.doesNotMatch(hidden, /Kozhantuan|awcrop/);
});
