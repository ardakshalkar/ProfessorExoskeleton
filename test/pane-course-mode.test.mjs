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
