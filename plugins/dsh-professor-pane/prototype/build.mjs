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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// The pane's own renderer and its style, so a brief reads here exactly as it
// reads in the harness. Not a second markdown implementation.
import { MARKDOWN_STYLE, renderMarkdown } from "../lib/markdown.js";
import { Workspace } from "../../../ainar-node/src/workspace.ts";
import { outlinePayload } from "../../../ainar-node/src/outline.ts";
import { gradebookPayload } from "../../../ainar-node/src/gradebook.ts";
import { dashboardPayload } from "../../../ainar-node/src/progress.ts";
import { inboxPayload } from "../../../ainar-node/src/inbox.ts";
import { BY_TOOL } from "../../../ainar-node/src/tools/widgets.ts";
import { officeAt } from "../../../ainar-node/src/materials.ts";

const HERE = import.meta.dirname;
const REPO = join(HERE, "..", "..", "..");

/**
 * Which course to draw, and from where.
 *
 * The example course is the default because it is the one this repository can
 * promise is there. A real course is pointed at with the environment, the way
 * `AINAR_WORKSPACE` points the tools at one:
 *
 *   PROTO_WORKSPACE="/path/to/AI Course 2026 v1" PROTO_RUN=CSS-4007-2026-FALL \
 *     node --experimental-strip-types plugins/dsh-professor-pane/prototype/build.mjs
 *
 * Point it at the folder that CONTAINS `courses/`, not at a course. The output
 * then holds that course's records — pseudonymous, but a real class's marks and
 * gaps — so it is written beside the builder and is gitignored, and publishing
 * it anywhere is a decision for the person who ran this rather than a default.
 */
const ROOT = process.env.PROTO_WORKSPACE || join(REPO, "workspace");
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
 * Keyed by the EXAMPLE course's pseudonyms, so a real course gets none of them
 * and its class list stays pseudonymous — which is the right answer twice over:
 * inventing a name for a real student would be worse than showing none, and
 * the roster that holds their actual name is not this builder's to read.
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
// Illustrative. Since 2026-09-29 a draft is a record in the course marked
// `approval: draft`, and the example course holds none — so the drafts view
// would otherwise be identical to the record. These three are shaped like
// such records (ordinary ids, `approval: draft`) and the page labels them.

const proposed = {
  note:
    "Illustrative. The example course holds no record marked approval: draft, so these " +
    "three stand in for what drafted records would look like.",
  modules: {
    10: { module_id: "MODULE-10", approval: "draft", title: "Ethics, deployment and failure",
          concepts: ["Model cards", "Failure modes in deployment"] },
  },
  decks: { 2: { title: "Search and problem formulation", resource_id: "RES-0202", approval: "draft" } },
  assessments: {
    12: { assessment_id: "ASSESSMENT-06", approval: "draft", title: "Project checkpoint",
          type: "project", weight: null, due_on: null },
  },
};

// ----------------------------------------------------------------- materials
//
// What a material chip opens. The harness serves these from `/file` and frames
// them over the page; this page has no server, so the ones it can carry are
// embedded and the rest say what would happen.
//
// The division is the harness's own `SHOWABLE`/`CONVERTIBLE` split, read here
// rather than restated: markdown is rendered to HTML and served as HTML, an SVG
// and a PDF are framed as they are, and a `.pptx` or `.docx` is rendered to PDF
// by LibreOffice when the machine has one. What cannot be embedded is a key
// with a scheme — `object://` is student work or a dataset in object storage,
// and `sendMaterial` refuses those too.

const MARKDOWN = new Set(["md", "markdown"]);
const INLINE = new Set(["svg", "html", "txt", "csv", "json"]);
const CONVERTIBLE = new Set(["pptx", "ppt", "docx", "doc", "odp", "odt", "rtf"]);

const extensionOf = (key) => {
  const name = String(key ?? "").split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

/**
 * The same stem pairing the pane does, for the same reason.
 *
 * A deck is registered twice — `MODULE-DRAFT-01-slides.pptx` and the
 * `.pdf` rendered from it are two Documents, and as far as the schema is
 * concerned they are unrelated. `withMaterialLinks` pairs them by the stem of
 * their storage key so one meeting shows one deck with two formats instead of
 * two chips both called "Slides", and the prototype was not doing it at all:
 * it walked a meeting's resources, and a resource points at the pptx only. The
 * PDF beside it has no resource pointing at it and so appeared nowhere.
 *
 * It is a convention and the draft that registered the PDFs says so: rename one
 * half and the pairing quietly stops. Worth having anyway, because the
 * alternative is a professor guessing which of two identical chips is which.
 */
const byStem = new Map();
for (const document of bundle.documents ?? []) {
  const key = String(document.storage_key ?? "");
  if (!key || key.includes("://")) continue;
  const name = key.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) continue;
  const stem = name.slice(0, dot);
  if (!byStem.has(stem)) byStem.set(stem, []);
  byStem.get(stem).push({ id: document.document_id, extension: name.slice(dot + 1).toLowerCase() });
}

/** Every format one document also exists in, itself first. Empty unless two. */
const formatsOf = (documentId) => {
  for (const group of byStem.values()) {
    if (!group.some((entry) => entry.id === documentId)) continue;
    const shown = group.filter((entry) => ["pptx", "pdf", "docx"].includes(entry.extension));
    if (shown.length < 2) return [];
    return shown
      .sort((a, b) => (a.id === documentId ? -1 : b.id === documentId ? 1 : 0))
      .map((entry) => ({ label: entry.extension.toUpperCase(), doc: entry.id }));
  }
  return [];
};

const materials = {};
for (const document of bundle.documents ?? []) {
  const key = String(document.storage_key ?? "");
  const extension = extensionOf(key);
  const entry = { title: document.title ?? document.document_id, extension: extension,
                  formats: formatsOf(document.document_id) };

  if (!key || key.includes("://")) {
    entry.held = "outside the workspace, in object storage — sendMaterial refuses a key with " +
      "a scheme, and a dead link would be worse than none";
  } else if (!existsSync(join(ROOT, key))) {
    entry.held = "recorded in documents.yaml and not on disk";
  } else if (MARKDOWN.has(extension)) {
    // The pane's own renderer and its own style sheet, not a second copy of
    // either. The renderer is a deliberate subset, and its failure mode is a
    // line that reads as its own source rather than a page that breaks.
    entry.html = MARKDOWN_STYLE +
      '<div class="md">' + renderMarkdown(readFileSync(join(ROOT, key), "utf8")) + "</div>";
  } else if (INLINE.has(extension)) {
    entry.html = extension === "svg"
      ? readFileSync(join(ROOT, key), "utf8")
      : "<pre>" + readFileSync(join(ROOT, key), "utf8")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";
  } else if (CONVERTIBLE.has(extension)) {
    entry.converts = true;
  }
  materials[document.document_id] = entry;
}


// -------------------------------------------------------------------- briefs
//
// What a piece of graded work asks for, which is the other half of "press it
// and read it" and the half that matters more: 2 of this course's 21
// assessments have a brief DOCUMENT, 12 carry the brief in the record's own
// `description`, and 7 have neither. A chip that names work nobody can read is
// the state `sendBrief` exists to end.
//
// Composed the way `sendBrief` composes it — the title, the same six facts in
// the same order, then the text, through the same renderer — so a brief reads
// here as it reads in the harness. The facts are restated rather than imported
// because they are eleven lines inside an HTTP handler; if a third surface ever
// needs them, that is the moment to lift them out rather than now.

const briefs = {};
for (const a of outline.assessments) {
  const text = String(a.description ?? "").trim();
  const doc = a.instructions_document_id ?? "";
  if (!text && !doc) {
    // Drawn as `no brief` in the same amber a missing weight gets. Work a
    // student cannot start is a hole worth showing, not a field to leave blank.
    briefs[a.assessment_id] = { title: a.title ?? a.assessment_id, none: true };
    continue;
  }

  const when = [a.opens_on ? `opens ${a.opens_on}` : "", a.due_on ? `due ${a.due_on}` : ""]
    .filter(Boolean);
  const facts = [
    `**Dates** — ${when.length ? when.join(", ") : "not scheduled"}`,
    `**Weight** — ${a.weight == null ? "not set" : Math.round(a.weight * 100) + "%"}`,
  ];
  if (a.maximum_score != null) facts.push(`**Out of** — ${a.maximum_score}`);
  const handed = (a.submission_type ?? []).join(", ");
  if (handed) facts.push(`**Handed in as** — ${handed}`);
  const outcomes = (a.outcomes ?? []).join(", ");
  if (outcomes) facts.push(`**Outcomes** — ${outcomes}`);
  facts.push(
    `**Rubric** — ${a.criteria ? a.criteria + (a.criteria === 1 ? " criterion" : " criteria") : "none yet"}`,
  );

  const title = String(a.title ?? a.assessment_id);
  const source = [`# ${title}`, "", ...facts.map((f) => `- ${f}`), "", text].join("\n");
  briefs[a.assessment_id] = {
    title,
    // Empty when the brief lives only in a document; the modal then offers that.
    html: text ? MARKDOWN_STYLE + '<div class="md">' + renderMarkdown(source) + "</div>" : "",
    doc,
  };
}


// --------------------------------------------------- meetings off their week
//
// The outline places a meeting on its MODULE's week first and on its own date
// only as a fallback (`outline.ts`, meetingsByWeek). So a lecture dated Oct 5
// whose module is week 6 sits under "Oct 6 – Oct 12", and the page states two
// facts that cannot both be true. This course's weeks run Tuesday to Monday,
// because the run starts on Tuesday 1 September, and from week 6 the lectures
// move to Mondays: each one is the last day of the run-week before its module.
//
// Which fact is wrong — the run's start date, the meeting's date, or the
// module's week — is the professor's to say, so this does not move anything.
// It finds every case, prints it, and hands it to the page, which draws it as
// a hole like any other: a press asks which is right.

const misdated = [];
for (const week of outline.weeks) {
  for (const m of week.meetings) {
    if (!m.on || (m.on >= week.starts_on && m.on <= week.ends_on)) continue;
    const byDate = outline.weeks.find((w) => m.on >= w.starts_on && m.on <= w.ends_on);
    misdated.push({ activity_id: m.activity_id, on: m.on, week: week.week, date_week: byDate?.week ?? null });
  }
}
for (const m of misdated) {
  console.warn(`warning: ${m.activity_id} is on ${m.on}, which is week ${m.date_week ?? "none"}, ` +
    `but its module puts it in week ${m.week}`);
}

// ---------------------------------------------------------------- the payload

// --------------------------------------------------------------------- todos
//
// What is waiting for the professor, which is `action_inbox`'s whole job plus
// the structural holes `weeks[].gaps` reports. Ordered here rather than in the
// view, because "what needs me first" is a judgement about the course and a
// view that sorted would be making it.

const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
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
        : "add your decision beside each suggestion",
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
// `weeks[].gaps` the outline colours a week with — less the ones a draft
// already stands in for, the rule the page's `openGaps` applies to its chips,
// so this list and the outline cannot count the same course differently.
const covered = (week, kind) =>
  (kind === "module" && proposed.modules[week]) || (kind === "deck" && proposed.decks[week]);
for (const kind of ["module", "deck", "deadline", "weight"]) {
  const weeks = outline.weeks.filter((w) =>
    w.gaps.some((g) => g.kind === kind) && !covered(w.week, kind));
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

if (misdated.length) {
  const weeks = [...new Set(misdated.map((m) => m.week))];
  todos.push({
    kind: "gap", id: "misdated",
    title: misdated.length + " meeting" + (misdated.length === 1 ? " is" : "s are") +
      " dated outside the week " + (misdated.length === 1 ? "it sits" : "they sit") + " in",
    detail: misdated.map((m) => `${m.activity_id} on ${m.on}`).join(", "),
    priority: "medium", due: null, weeks,
  });
}

// One thing to do, said once. A stored `review_grades` action and the live
// count of pending suggestions are the same request when the action names the
// assessment — and they disagree, because the action counted once (24) and the
// gradebook counts now (1). The live figure wins; the action keeps its due date
// and is named in the detail, so nothing it asked for is lost.
for (const action of bundle.action_items ?? []) {
  if (action.course_version_id !== RUN || action.type !== "review_grades") continue;
  const live = todos.find((t) => t.kind === "approve" && (action.source_refs ?? []).includes(t.id));
  const stored = todos.findIndex((t) => t.kind === "action" && t.id === action.action_id);
  if (!live || stored < 0) continue;
  const was = todos[stored];
  live.due = live.due ?? was.due;
  live.detail = `${live.detail} · asked for by ${was.id}${was.due ? ` by ${was.due}` : ""}`;
  live.priority = (RANK[was.priority] ?? 9) < (RANK[live.priority] ?? 9) ? was.priority : live.priority;
  todos.splice(stored, 1);
}

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
  materials,
  briefs,
  office: officeAt() !== null,
  students,
  // Said on the payload rather than assumed by the view, so the banner the page
  // draws when names are showing is telling the truth about where they came
  // from. False on a course whose pseudonyms match no fixture: there are then
  // no names to warn about, and a banner claiming otherwise would be the page
  // lying about its own contents.
  names_are_fixture: students.some((s) => s.name !== null),
  todos,
  misdated,
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
