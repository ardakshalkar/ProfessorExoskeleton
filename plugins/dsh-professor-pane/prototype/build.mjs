/**
 * Builds the course-mode prototype: real course data injected into proto.html.
 *
 *   node --experimental-strip-types plugins/dsh-professor-pane/prototype/build.mjs
 *
 * Three substitutions, all between markers so the page stays hand-editable:
 *   __COURSE_DATA__   the course, read through the same payloads the pane reads
 *   __TEMPLATE_JS__   the shipped template interpreter, verbatim
 *   __PANE_DOC__      the document the 300px pane serves today, for chat mode
 *
 * The output, `course-mode-prototype.html`, is NOT committed: it is 240KB of
 * derived bytes that would churn on every course edit. Run this, open the file
 * it names, and edit `proto.html` to change the design.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Workspace } from "../../../ainar-node/src/workspace.ts";
import { outlinePayload } from "../../../ainar-node/src/outline.ts";
import { gradebookPayload } from "../../../ainar-node/src/gradebook.ts";
import { dashboardPayload } from "../../../ainar-node/src/progress.ts";
import { inboxPayload } from "../../../ainar-node/src/inbox.ts";
import { BY_TOOL } from "../../../ainar-node/src/tools/widgets.ts";

const HERE = import.meta.dirname;
const REPO = join(HERE, "..", "..", "..");
const ROOT = join(REPO, "workspace");
const RUN = process.env.PROTO_RUN ?? "CSS-4008-2026-FALL";
/** Pinned, so the prototype reads the same whatever day it is built. */
const ON = "2026-10-15";

const ws = new Workspace(ROOT);
const bundle = ws.findRun(RUN);
const outline = outlinePayload(bundle, RUN, ON);
const gradebook = gradebookPayload(bundle, RUN, {});
const progress = dashboardPayload(bundle, RUN);
const inbox = inboxPayload(bundle, RUN, ON);

// ------------------------------------------------------------------ students
//
// Everything the progress section draws, counted here and never in a view.
//
// **No names.** The bundle holds one user — the instructor — because a student
// in this model is a pseudonymous identifier and nothing else; real names live
// in `~/.ainar/roster/people.json` on the professor's own machine, which is
// what `dsh-professor-pane` reads and holds for the length of one response. A
// page that gets published cannot have them, so the prototype shows the control
// and says why it is off rather than pretending the question does not arise.

const enrolled = (bundle.enrollments ?? []).filter(
  (e) => e.course_version_id === RUN && e.role === "student" && e.status === "active",
).length;

/**
 * Fixture names, so the layout reads the way it will on a real class list.
 *
 * Invented here and nowhere else — no roster was read to produce them, and
 * there is no roster in this workspace to read. They are Almaty-plausible
 * because the run's timezone is `Asia/Almaty` and a name list of Smiths would
 * lay out differently from the one this course will actually carry.
 *
 * The identifier stays under every name, for the reason `dsh-professor-pane`
 * keeps it there: it is what `whois`, the gradebook and a bug report all use.
 * And the packet a press sends keeps the pseudonym alone, because that text
 * goes to a model and the model should work in the record's own vocabulary.
 */
const FIXTURE_NAMES = {
  "STUDENT-JNG7SN": "Aigerim Zhaksybekova",
  "STUDENT-K4QM2X": "Daniyar Serikov",
  "STUDENT-R7TB5D": "Madina Orazbek",
};

const groupOf = new Map(
  (bundle.enrollments ?? [])
    .filter((e) => e.course_version_id === RUN)
    .map((e) => [e.student_id, e.group ?? null]),
);

const students = (progress.students ?? []).map((id) => {
  const concepts = (progress.concepts ?? []).map((c) => {
    const cell = (c.cells ?? []).find((x) => x.student_id === id) ?? {};
    return {
      concept_id: c.concept_id,
      title: c.title,
      // null is "never assessed", which is a different cell from 0%.
      proportion: cell.proportion ?? null,
      evidence: cell.evidence ?? 0,
      state: cell.state ?? null,
    };
  });
  const marks = (gradebook.assessments ?? []).map((a) => {
    const row = (a.rows ?? []).find((r) => r.student_id === id) ?? {};
    return {
      assessment_id: a.assessment_id,
      title: a.title,
      type: a.type,
      weight: a.weight ?? null,
      status: row.status ?? "missing",
      percent: row.percent ?? null,
      exportable: row.exportable ?? false,
      // Why a mark may not be exported, in the model's own words. This is the
      // most useful column on the page and the one no other surface draws.
      blocked: row.blocked ?? [],
    };
  });
  return {
    student_id: id,
    name: FIXTURE_NAMES[id] ?? null,
    group: groupOf.get(id) ?? null,
    concepts,
    marks,
    signals: (inbox.open_signals ?? []).filter((s) => s.student_id === id).map((s) => ({
      signal_id: s.signal_id, type: s.type, severity: s.severity, description: s.description,
    })),
  };
});

// ------------------------------------------------------------------ proposed
//
// Illustrative. This workspace has no `work/<RUN>/`, so there is nothing for
// `loadDrafts` to merge and the Proposed overlay would otherwise be identical
// to Plan. The prototype says so on the banner rather than passing these off.

const proposed = {
  note:
    "Illustrative. This workspace has no work/CSS-4008-2026-FALL/, so nothing here " +
    "came from loadDrafts — these three stand in for what a merge would add.",
  modules: {
    10: { module_id: "MODULE-10-DRAFT-01", title: "Ethics, deployment and failure",
          concepts: ["Model cards", "Failure modes in deployment"] },
  },
  decks: { 2: { title: "Search and problem formulation", resource_id: "RES-DRAFT-02" } },
  assessments: {
    12: { assessment_id: "ASSESSMENT-06-DRAFT-01", title: "Project checkpoint",
          type: "project", weight: null, due_on: null },
  },
};

// ---------------------------------------------------------------- the payload

// --------------------------------------------------------------------- todos
//
// What is waiting for the professor, which is `action_inbox`'s whole job plus
// the structural holes `weeks[].gaps` reports. Ordered here rather than in the
// view, because "what needs me first" is a judgement about the course and a
// view that sorted would be making it.

const todos = [];
for (const item of inbox.existing_action_items ?? []) {
  todos.push({
    kind: "action", id: item.action_id, title: item.title,
    detail: item.type.replace(/_/g, " "), priority: item.priority,
    due: item.due_at ? item.due_at.slice(0, 10) : null, status: item.status,
  });
}
if ((inbox.pending_evaluations?.total ?? 0) > 0) {
  for (const row of inbox.pending_evaluations.by_assessment ?? []) {
    todos.push({
      kind: "approve", id: row.assessment_id,
      title: row.pending + " suggested grade" + (row.pending === 1 ? "" : "s") +
        " waiting on you for " + row.title,
      detail: row.low_confidence
        ? row.low_confidence + " of them low confidence"
        : "ainar approve is the only way in",
      priority: "high", due: null,
    });
  }
}
for (const signal of inbox.open_signals ?? []) {
  todos.push({
    kind: "signal", id: signal.signal_id, student_id: signal.student_id,
    title: signal.description, detail: signal.type.replace(/_/g, " "),
    priority: signal.severity, due: null,
  });
}
for (const a of inbox.assessments ?? []) {
  if ((a.missing ?? []).length) {
    todos.push({
      kind: "missing", id: a.assessment_id,
      title: a.missing.length + " outstanding submission" + (a.missing.length === 1 ? "" : "s") +
        " for " + a.title,
      detail: a.missing.join(", "), priority: "medium", due: null,
    });
  }
}
// The structural half: holes in the course as built, counted off the same
// `weeks[].gaps` the outline colours a week with.
for (const kind of ["module", "deck", "deadline", "weight"]) {
  const weeks = outline.weeks.filter((w) => w.gaps.some((g) => g.kind === kind));
  if (!weeks.length) continue;
  todos.push({
    kind: "gap", id: kind,
    title: weeks.length + " week" + (weeks.length === 1 ? "" : "s") + " with " +
      { module: "no module", deck: "no deck", deadline: "undated work", weight: "unweighted work" }[kind],
    detail: "weeks " + weeks.map((w) => w.week).join(", "),
    priority: kind === "module" ? "medium" : "low", due: null,
    weeks: weeks.map((w) => w.week),
  });
}

const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
todos.sort((a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9));

const data = {
  run: outline.run,
  as_of: outline.as_of,
  current_week: outline.current_week,
  weeks: outline.weeks,
  assessments: outline.assessments,
  grading: outline.grading,
  totals: outline.totals,
  unplaced: outline.unplaced,
  outcomes: outline.outcomes,
  placement: outline.placement,
  enrolled,
  students,
  // Said on the payload rather than assumed by the view, so the banner the page
  // draws when names are showing is telling the truth about where they came
  // from. A real harness would set this false and resolve from the roster.
  names_are_fixture: true,
  todos,
  inbox: {
    assessments: (inbox.assessments ?? []).map((a) => ({
      assessment_id: a.assessment_id, title: a.title, type: a.type, status: a.status,
      enrolled: a.enrolled, submissions_received: a.submissions_received,
      missing: a.missing ?? [], criteria: a.criteria, items: a.items,
    })),
  },
  proposed,
};

// --------------------------------------------- the pane as it is, for chat mode

const paneDoc =
  "<script>window.openai = { toolOutput: " +
  JSON.stringify({
    ...outline,
    sections: { assessments: false, grading: false, header: false, gaps: true },
  }).replace(/</g, "\\u003c") +
  " };<\/script>\n" +
  BY_TOOL.get("course_outline").html();

const attr = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------------- assemble

// The real template interpreter, not a copy of one. `esc` is defined beside it
// in the page, the way `test/widgets.test.ts` loads it and the way every widget
// document concatenates it.
const ASSETS = join(REPO, "vendor", "ainar", "mcp", "widget-assets");
const engine = readFileSync(join(ASSETS, "template.js"), "utf8").replace(/\r\n/g, "\n");

const template = readFileSync(join(HERE, "proto.html"), "utf8");
const out = template
  .replace("__COURSE_DATA__", JSON.stringify(data).replace(/<\//g, "<\\/"))
  .replace("__TEMPLATE_JS__", () => engine)
  .replace("__PANE_DOC__", attr(paneDoc));

const target = join(HERE, "course-mode-prototype.html");
writeFileSync(target, out);
console.log(
  "wrote", target, (out.length / 1024).toFixed(0) + "KB",
  "| weeks", data.weeks.length, "| enrolled", enrolled,
  "| gaps", JSON.stringify(outline.totals.gaps),
);
