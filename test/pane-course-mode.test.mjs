/**
 * Course mode's three readings of one term: Planning, Teaching and the full
 * term table, as `server/course-mode.js` draws them on the host.
 *
 * The rules worth pinning are the ones about what each page may carry:
 *
 * 1. **Planning and the term table are structure only.** No class figure, no
 *    handed-in count, ever — they are the same facts a student page may hold.
 * 2. **Teaching is the one that carries class figures,** and says it is private.
 * 3. **A hole is a press.** Every fault Planning names asks for its fix, naming
 *    the run and the weeks, so the model starts from the record.
 * 4. **The student preview draws no hole**, on either structural reading.
 * 5. **A chip says where its work stands** — from the host's status, once per
 *    week, each with the press that opens its window — and only where the host
 *    sent one: never in the student preview.
 * 6. **Evidence prints the payloads' figures as they came,** week by week,
 *    names nobody, and none of it leaks into Planning or the term table.
 *
 *     node --test test/pane-course-mode.test.mjs
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { courseModeDocument } from "../plugins/dsh-professor-pane/server/course-mode.js";

const week = (n, extra = {}) => ({
  week: n,
  starts_on: `2026-09-0${n}`,
  ends_on: `2026-09-0${n}`,
  when: n < 2 ? "past" : n === 2 ? "current" : "upcoming",
  urgency: n < 2 ? "past" : "soon",
  modules: [],
  meetings: [],
  opens: [],
  due: [],
  undated: [],
  planned: false,
  gaps: [{ kind: "module", ids: [], note: "No module names this week." }],
  ...extra,
});

const quiz = { assessment_id: "ASM-Q", title: "Quiz one", type: "quiz", weight: 0.4, due_on: "2026-09-02", opens_on: "2026-09-02" };

/** Four one-day weeks: week 1 taught, week 2 now, weeks 3–4 unplanned and quiet. */
const payload = () => ({
  run: { id: "RUN-1", course_id: "C-1", term: "2026-FALL" },
  current_week: 2,
  weeks: [
    week(1, {
      planned: true, gaps: [],
      modules: [{ module_id: "M-1", title: "Basics", concepts: [{ id: "K-1", title: "Search" }], outcomes: [] }],
      meetings: [{ activity_id: "A-1", type: "lecture", on: "2026-09-01", location: "R1", resources: [] }],
    }),
    week(2, {
      planned: true,
      modules: [{ module_id: "M-2", title: "Learning", concepts: [{ id: "K-2", title: "Overfitting" }], outcomes: [] }],
      meetings: [{ activity_id: "A-2", type: "lecture", on: "2026-09-02", location: "R1", resources: [] }],
      due: [quiz], opens: [quiz],
      gaps: [{ kind: "deck", ids: ["A-2"], note: "1 meeting this week, and no slides are registered against it." }],
    }),
    week(3),
    week(4),
  ],
  assessments: [quiz],
  grading: { total_weight: 0.4, complete: false, note: "The weights come to 40%, not 100%." },
  unplaced: { modules: [], meetings: [], assessments: [] },
  outcomes: [],
  totals: { gaps: { weeks: 3 } },
});

const evidence = {
  concepts: { "K-1": { class_mean: 0.33, coverage: "3/3" } },
  handed_in: { "ASM-Q": { enrolled: 3, received: 2 } },
  signals: [{ description: "Search handled loosely in two submissions." }],
};

test("planning names every fault as a press that asks for its fix", () => {
  const html = courseModeDocument(payload(), { mode: "planning" });
  assert.match(html, /Weeks 3–4 have no topic/);
  assert.match(html, /Weeks 3–4: nothing graded opens, runs or falls due/);
  assert.match(html, /The weights come to 40%, not 100%/);
  // Each fault carries its own prompt, naming the run.
  assert.match(html, /data-ask="Weeks 3–4 of RUN-1 have no module/);
  assert.match(html, /class="wcard bad"/);
});

test("planning and the term table carry no class figure", () => {
  for (const mode of ["planning", "term"]) {
    const html = courseModeDocument(payload(), { mode, evidence });
    assert.equal(/handed in/.test(html), false, `${mode} drew a handed-in count`);
    assert.equal(/class 33%/.test(html), false, `${mode} drew a class mean`);
    assert.equal(/Private/.test(html), false, `${mode} claims to be private`);
  }
});

test("teaching draws this week between its neighbours, with class figures, and says so", () => {
  const html = courseModeDocument(payload(), { mode: "teaching", evidence });
  assert.match(html, /Private — class figures from approved evidence only/);
  // Week 2 is the one shown on load; every other week is rendered hidden.
  assert.match(html, /<section class="trio-wrap" data-week="2">/);
  assert.match(html, /<section class="trio-wrap" data-week="1" hidden>/);
  assert.match(html, /2 of 3 handed in/);
  // Week 1's concept sits under the line, so week 2 is told to revisit it.
  assert.match(html, /Revisit first/);
  assert.match(html, /Search — class 33% on 3\/3 observed, taught in week 1/);
  assert.match(html, /No slides yet/);
});

test("the student preview draws no hole on either structural reading", () => {
  for (const mode of ["planning", "term"]) {
    const html = courseModeDocument(payload(), { mode, student: true });
    assert.equal(/class="chip gap/.test(html), false, `${mode} drew a gap chip`);
    assert.equal(/class="faults"/.test(html), false, `${mode} drew the faults list`);
  }
});

const status = {
  "ASM-Q": {
    grading: { suggested: 12, decided: 5 },
    canvas: "none",
    repo: false,
    scans: { phrase: "8 papers to place", whose: "you" },
    defences: { defended: 4, of: 20, prepared: 6, student: "STUDENT-AB12" },
  },
};

test("a chip says where its work stands, with the press that opens its window", () => {
  for (const mode of ["term", "teaching"]) {
    const html = courseModeDocument(payload(), { mode, evidence, status });
    assert.match(html, /12 suggested · 5 decided/, mode);
    assert.match(html, /data-grade="ASM-Q"/, mode);
    assert.match(html, /8 papers to place/, mode);
    assert.match(html, /data-scans="ASM-Q"/, mode);
    assert.match(html, /4 of 20 defended/, mode);
    assert.match(html, /data-desk="ASM-Q" data-student="STUDENT-AB12"/, mode);
    assert.match(html, /not in Canvas yet/, mode);
    assert.match(html, /data-publish="ASM-Q" data-target="canvas"/, mode);
  }
  // The quiz opens and falls due in week 2: one status line there, not two.
  const term = courseModeDocument(payload(), { mode: "term", status });
  assert.equal(term.match(/data-grade="ASM-Q"/g).length, 1);
});

test("the student preview carries no status, whatever the host sent", () => {
  const html = courseModeDocument(payload(), { mode: "term", student: true, status });
  assert.equal(/suggested ·|defended<|not in Canvas|data-grade="|data-publish="/.test(html), false);
});

const weekly = {
  concepts: { "K-1": { class_mean: 0.33, coverage: "3/3" }, "K-2": { class_mean: 0.81, coverage: "2/3" } },
  work: {
    "ASM-Q": { maximum: 10, enrolled: 3, submitted: 2, not_submitted: 1, graded: 2, partially_graded: 0, mean: 7.25, median: 7.5 },
  },
  signals: [
    { description: "Search handled loosely across the class.", severity: "medium", concepts: ["K-1"] },
    { description: "Attendance dipped after the break.", severity: "low", concepts: [] },
  ],
};

test("evidence prints each week's figures as the payloads carry them, and says it is private", () => {
  const html = courseModeDocument(payload(), { mode: "evidence", evidence: weekly, status });
  assert.match(html, /Private — class figures from approved evidence only/);
  // The gradebook summary, verbatim: no figure is re-derived.
  assert.match(html, /2 of 3 handed in · 1 not handed in · 2 graded · mean 7\.25 of 10 · median 7\.5/);
  // Week 1 teaches K-1, under the line, so it is flagged; week 2's K-2 is not.
  assert.match(html, /Search<\/span><small>class 33% · 3\/3 observed · revisit/);
  assert.match(html, /Overfitting<\/span><small>class 81% · 2\/3 observed<\/small>/);
  assert.match(html, /data-ask="In week 1 of RUN-1 \(M-1\), the class is weakest on K-1/);
  // A signal tied to K-1 sits in week 1; one tied to nothing goes on top.
  assert.match(html, /Search handled loosely across the class\./);
  assert.match(html, /Open signals not tied to a week.*Attendance dipped after the break\./s);
  // Step 2's chip buttons work here too.
  assert.match(html, /data-grade="ASM-Q"/);
  // Weeks 3–4: nothing due, nothing measured.
  assert.match(html, /Weeks 3–4<\/b>.*nothing due, nothing measured yet/s);
});

test("evidence names nobody", () => {
  const html = courseModeDocument(payload(), { mode: "evidence", evidence: weekly });
  assert.equal(/STUDENT-/.test(html), false);
});

test("planning and the term table carry none of evidence's figures", () => {
  for (const mode of ["planning", "term"]) {
    const html = courseModeDocument(payload(), { mode, evidence: weekly });
    for (const figure of [/mean 7\.25/, /median 7\.5/, /handed in/, /class 33%/, /Search handled loosely/, /Private/]) {
      assert.equal(figure.test(html), false, `${mode} drew ${figure}`);
    }
  }
});

test("evidence reports nothing for work in a week still to come", () => {
  const data = payload();
  data.weeks[2] = week(3, { due: [quiz], gaps: [] });
  const html = courseModeDocument(data, { mode: "evidence", evidence: weekly });
  assert.match(html, /id="week-3".*not due yet/s);
});

test("evidence opens on this week, whether it is a row or inside a band", () => {
  const html = courseModeDocument(payload(), { mode: "evidence", evidence: weekly });
  assert.match(html, /<div class="wkhead now" id="week-2">/);
  // The scroll is made again once the frame has its size, not only at parse time.
  assert.match(html, /addEventListener\('load',toNow\)/);
  const later = payload();
  later.current_week = 3;
  const banded = courseModeDocument(later, { mode: "evidence", evidence: weekly });
  assert.match(banded, /<div class="band now" id="week-3">/);
});

test("teaching opens on the week it was last stepped to, and says when it steps", () => {
  const html = courseModeDocument(payload(), { mode: "teaching", evidence, focus: 3 });
  assert.match(html, /<section class="trio-wrap" data-week="3">/);
  assert.match(html, /<section class="trio-wrap" data-week="2" hidden>/);
  assert.match(html, /kind:'teaching-week'/);
  // A week the run does not have falls back to this week.
  const lost = courseModeDocument(payload(), { mode: "teaching", evidence, focus: 40 });
  assert.match(lost, /<section class="trio-wrap" data-week="2">/);
});
