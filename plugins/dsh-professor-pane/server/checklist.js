/**
 * The Checklist and the Ready page: what the course has recorded, drafted and
 * still lacks, counted from the records and the files beside them.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { enrollmentsOf } from "@ainar/core/src/bundle.ts";

import { escapeText } from "./markdown.js";
import { documentPage, titleWithId } from "./page.js";
import { revisionDocument, viewPayload } from "./workspace.js";

/**
 * A backup, not a proposal.
 *
 * The scaffolds write `modules-draft.yaml.bak-20260903-171431`, so the stamp is
 * two dash-separated groups rather than one — the first version of this matched
 * `.bak-<digits>` and let that file through, putting a backup on screen beside
 * the draft it backs up: two entries for one decision.
 */
const isBackup = (name) => /\.bak(\b|[-.]|$)/i.test(name);

/** Every entry one level down, as {name, directory, when}. */
const filesIn = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push({ name: entry.name, directory: true, when: "" });
      continue;
    }
    if (isBackup(entry.name)) continue;
    let when = "";
    try {
      when = statSync(join(dir, entry.name)).mtime.toISOString().slice(0, 10);
    } catch {
      when = "";
    }
    files.push({ name: entry.name, directory: false, when });
  }
  return files;
};

/**
 * The "Ready" half of the Tasks tab: what has been prepared, and what it is.
 *
 * The Pending half is `action_inbox`, which reads the RECORD — pending
 * evaluations, open signals, interventions. That is the right answer to "what is
 * waiting on my judgement about work students did", and it is empty for a course
 * nobody has taught yet: correct, and useless to a professor who has a term of
 * material drafted and wants to know what they have.
 *
 * So this half answers a different question — what is prepared? — and it answers
 * it in the vocabulary a professor thinks in: weeks, quizzes, an exam, lecture
 * decks. Not filenames. A directory listing was the first version of this and it
 * was wrong in a specific way: `quiz-quiz-03-student.pdf` is not a task, and
 * "materials/ 117 files" hid the seven lecture decks inside it.
 *
 * The source is the course itself. Since 2026-09-29 an agent writes into the
 * file a record belongs in and marks it `approval: draft`, so what is prepared
 * and not yet accepted is read off the bundle — `drafts()` in
 * `ainar-node/src/approval.ts`, the rule every other reader uses — and set
 * against what the same collections hold that has been accepted. Fifteen
 * drafted meetings against none accepted is a sentence about what to do next;
 * fifteen drafted meetings alone is trivia.
 *
 * Accepting one is changing the word in its file. Nothing here does it: the pane
 * can say what is waiting, and the professor decides.
 */

/** What a drafted collection is called in a sentence, singular and plural. */
const DRAFT_KINDS = [
  { key: "assessments", one: "Assessment", many: "Assessments" },
  { key: "items", one: "Assessment item", many: "Assessment items" },
  { key: "activities", one: "Meeting", many: "Meetings" },
  { key: "documents", one: "Document", many: "Documents" },
  { key: "resources", one: "Resource", many: "Resources" },
  { key: "item_responses", one: "Scored response", many: "Scored responses" },
  { key: "signals", one: "Signal", many: "Signals" },
  { key: "action_items", one: "Action item", many: "Action items" },
];

/** Files in `materials/`, by the kind of thing they are. */
const MATERIAL_KINDS = [
  { label: "Lecture decks", test: /\.pptx$/i },
  { label: "Printed papers", test: /\.(docx|pdf)$/i },
  { label: "Figures", test: /\.(svg|png|jpe?g)$/i },
  { label: "Build scripts", test: /\.(py|mjs|js)$/i },
  { label: "Notes and data", test: /\.(md|markdown|json|ndjson|txt|ya?ml)$/i },
];

/**
 * How a `type` value is said in a sentence.
 *
 * An explicit table rather than a pluralising rule, because both enums are
 * CLOSED sets — `AssessmentType` and `ItemType` in the model — so every value
 * that can appear is known and can simply be written down. A rule got this
 * wrong on the first run in exactly the way rules do: it rendered six quizzes as
 * "6 quizs" and ten numeric items as "10 numerics".
 *
 * The fallback is the SINGULAR with underscores opened up, never a guessed
 * plural: an unknown type reading "3 oral defense" is a little stiff, while
 * "3 oral defenses" would be this function inventing English it does not know.
 */
const TYPE_WORDS = {
  // AssessmentType
  assignment: "assignments",
  quiz: "quizzes",
  exam: "exams",
  project: "projects",
  presentation: "presentations",
  oral_defense: "oral defences",
  participation: "participation",
  // ItemType
  multiple_choice: "multiple-choice",
  multiple_select: "multiple-select",
  true_false: "true/false",
  short_answer: "short answer",
  numeric: "numeric",
  essay: "essays",
  code: "code",
  practical: "practicals",
  other: "other",
};

const saidAs = (type, count) => {
  if (count === 1) return type.replace(/_/g, " ");
  return TYPE_WORDS[type] ?? type.replace(/_/g, " ");
};

/** `6 quizzes, 1 exam, 1 assignment` — the breakdown, in count order. */
const byType = (rows) => {
  const tally = new Map();
  for (const row of rows) {
    const type = typeof row.type === "string" && row.type ? row.type : null;
    if (type === null) continue;
    tally.set(type, (tally.get(type) ?? 0) + 1);
  }
  if (tally.size === 0) return "";
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => count + " " + saidAs(type, count))
    .join(", ");
};

/** One row: what it is, how much of it is drafted, and whether the course has any. */
const readyRow = (label, drafted, detail, recorded) =>
  '<div class="row"><span class="k">' +
  escapeText(label) +
  (detail ? ' <span class="dim">' + escapeText(detail) + "</span>" : "") +
  '</span><span class="v">' +
  drafted +
  " drafted" +
  (recorded === null
    ? ""
    : recorded === 0
      ? ' · <span class="todo">none accepted</span>'
      : ' · <span class="dim">' + recorded + " accepted</span>") +
  "</span></div>";

export const readyDocument = (workspace, root, runId, dark) => {
  let bundle;
  try {
    bundle = workspace.findRun(runId);
  } catch (error) {
    return documentPage(
      '<section><h2>Ready</h2><p class="empty">' + escapeText(String(error.message ?? error)) + "</p></section>",
      dark,
    );
  }

  // Drafted and accepted, per collection, for this run's records. A record with
  // no `course_version_id` (an item, a response) belongs to whatever it hangs
  // off, and is counted with the course.
  const inRun = (row) => !row.course_version_id || row.course_version_id === runId;

  const rows = DRAFT_KINDS.map((kind) => {
    const all = (Array.isArray(bundle[kind.key]) ? bundle[kind.key] : []).filter(inRun);
    const drafted = all.filter((row) => row.approval === "draft");
    if (drafted.length === 0) return "";
    return readyRow(
      drafted.length === 1 ? kind.one : kind.many,
      drafted.length,
      byType(drafted),
      all.length - drafted.length,
    );
  })
    .filter(Boolean)
    .join("");

  if (rows === "") {
    return documentPage(
      '<section><h2>Ready</h2><p class="empty">' +
        "Nothing in " +
        escapeText(runId) +
        " is marked <code>approval: draft</code>. Skills write their proposals into " +
        "the course marked that way, and this lists them once they do.</p></section>",
      dark,
    );
  }

  return documentPage(
    "<section><h2>Prepared, awaiting approval</h2>" +
      '<p class="dim">Written into the course by the skills and marked ' +
      "<code>approval: draft</code>. Nothing student-facing reads them until you " +
      "change that word to <code>approved</code> in the record.</p>" +
      rows +
      "</section>",
    dark,
  );
};

/**
 * A count that exists in two halves.
 *
 * `recorded` is what the course holds that has been accepted. `merged` is
 * everything it holds, drafts included — what it would be if every record
 * marked `approval: draft` were approved. The drafted half is the difference.
 */
const split = (recorded, merged) => ({
  recorded,
  drafted: Math.max(0, merged - recorded),
  state: recorded > 0 ? "done" : merged > 0 ? "draft" : "todo",
});

const countOf = (value) => (Array.isArray(value) ? value.length : 0);

/** Every week's slide decks, by week number, from one outline payload. */
const decksByWeek = (data) => {
  const found = new Map();
  for (const week of data.weeks ?? []) {
    for (const meeting of week.meetings ?? []) {
      for (const resource of meeting.resources ?? []) {
        if (resource.kind !== "slides") continue;
        const list = found.get(week.week) ?? [];
        list.push(resource);
        found.set(week.week, list);
      }
    }
  }
  return found;
};

/**
 * What is not finished in one run, and whose move each thing is.
 *
 * Four questions, which is what the professor actually asks of a course they
 * are still building: what has not been created, what carries no deadline, do
 * the weights come to 100%, and is each week's deck written or only proposed.
 *
 * **Nothing is recomputed here that the model already computes.** The weights
 * come out of `course_outline`'s own `grading` section — `total_weight`,
 * `unweighted`, `complete`, and the sentence it writes when something is wrong
 * — for the reason `gradingDocument`'s header gives at length: an earlier
 * version of that view did the arithmetic itself, forgot that `weight` is a
 * fraction of one, and told a professor their correct scheme was "1%, not
 * 100". Two views disagreeing about a number is the failure this whole pane is
 * shaped to avoid, and a checklist that says "incomplete" while the Grading
 * policy tab says "100%" would be the worst instance of it. Likewise the
 * counts: `totals` is the payload's, and the deadline column is `due_on` as
 * the outline reports it.
 *
 * **Both halves, always.** Like `ready`, this view does not take the Record /
 * `+ drafts` toggle — it loads the record AND the merge and reports the
 * difference, because "written, or only proposed" is the question rather than
 * a setting. A toggle that hid one column would remove the answer.
 *
 * Returns data, not HTML. The document is rendered per request because `dark`
 * varies with the professor's theme; the report does not, so it is the half
 * worth caching. See `checklistFor`.
 */
const checklistReport = (workspace, root, runId) => {
  const record = viewPayload(workspace, "course_outline", runId, null, false).payload;

  // A run nobody has drafted for merges to itself, which is the right answer:
  // every drafted count comes out zero and every row reads "in the course".
  let merged = record;
  try {
    merged = viewPayload(workspace, "course_outline", runId, null, true).payload;
  } catch {
    // The record loaded, so the run is real; only the draft directory failed.
    // `ready` is the view that reports draft-loading complaints, and it says
    // more about them than a line here could.
    merged = record;
  }

  // Roles, not head count: `enrollments` is refused in a draft file, so this
  // has no drafted half and is read from the bundle rather than a payload.
  let enrolled = null;
  try {
    enrolled = enrollmentsOf(workspace.findRun(runId), runId).filter(
      (entry) => ["student", "auditor"].includes(entry.role) && entry.status === "active",
    ).length;
  } catch {
    enrolled = null;
  }

  const recordTotals = record.totals ?? {};
  const mergedTotals = merged.totals ?? {};
  const at = (totals, key) => (typeof totals[key] === "number" ? totals[key] : 0);

  const withRubric = (data) =>
    (data.assessments ?? []).filter((row) => (row.criteria ?? 0) > 0).length;

  const structure = [
    {
      label: "Learning outcomes",
      piece: split(countOf(record.outcomes), countOf(merged.outcomes)),
      hint: "/propose-concepts",
    },
    {
      label: "Weekly modules",
      piece: split(at(recordTotals, "modules"), at(mergedTotals, "modules")),
      hint: "/plan-term",
    },
    {
      label: "Meetings scheduled",
      piece: split(at(recordTotals, "meetings"), at(mergedTotals, "meetings")),
      hint: "/plan-term",
    },
    {
      label: "Assessments",
      piece: split(at(recordTotals, "assessments"), at(mergedTotals, "assessments")),
      hint: "/design-assessment",
    },
    {
      label: "Assessments with a rubric",
      piece: split(withRubric(record), withRubric(merged)),
      hint: "/design-assessment",
      of: at(mergedTotals, "assessments"),
    },
  ];

  // Two things `versions` owns, and `versions` is not draftable — so these are
  // present or absent, never proposed, and a "drafted" column against them
  // would be a column that can only ever read zero.
  const fixed = [
    { label: "Instructor named", have: countOf(record.run?.instructors), hint: "version.yaml" },
    { label: "Students enrolled", have: enrolled, hint: "ainar roster import" },
  ];

  const weeksPlanned = {
    planned: at(mergedTotals, "weeks_planned"),
    total: at(mergedTotals, "weeks"),
  };

  // Weeks that hold a meeting. A week with none has no class to write a deck
  // for, and counting it as a missing deck would report the same hole twice —
  // once here and once as "Meetings scheduled".
  const meetingWeeks = (merged.weeks ?? []).filter((week) => (week.meetings ?? []).length > 0);

  const recordDecks = decksByWeek(record);
  const mergedDecks = decksByWeek(merged);

  const slides = meetingWeeks.map((week) => {
    const recorded = (recordDecks.get(week.week) ?? []).length;
    const all = mergedDecks.get(week.week) ?? [];
    return {
      week: week.week,
      title: (week.modules ?? [])[0]?.title ?? null,
      recorded,
      drafted: Math.max(0, all.length - recorded),
      // Registered as a resource with nothing behind it: no file to open and
      // no document to serve. `resource.no_location` is the validator's name
      // for it, and it is the difference between a deck that exists and a deck
      // somebody meant to make.
      unlocated: all.filter((resource) => !resource.url && !resource.document_id).length,
      // Whether a week is still missing its deck is the model's answer, not a
      // second one taken here. `outline` puts a `deck` gap on a week with a
      // meeting and no slides, and the same gap is what the week view draws —
      // so this column and the chip on week nine cannot disagree, which is the
      // failure a checklist beside a plan exists to avoid. What stays local is
      // the record/draft split: two payloads, which the model sees one of.
      state:
        recorded > 0
          ? "done"
          : (week.gaps ?? []).some((gap) => gap.kind === "deck")
            ? "todo"
            : "draft",
    };
  });

  // Undated work, read off the merge so a drafted assessment with no deadline
  // is caught before it is approved rather than after.
  const recordedIds = new Set((record.assessments ?? []).map((row) => row.assessment_id));

  // `unplaced` is the outline's own word for a record that lands in no week.
  // For an assessment that means neither an in-run date nor a module to inherit
  // a week from — so an undated one is usually here too, and the two faults are
  // reported together on its own row rather than as a second anonymous count
  // under another heading. What is left over is the different fault: work with
  // a date that falls outside the run.
  const unplacedIds = new Set(
    (merged.unplaced?.assessments ?? []).map((row) => row.assessment_id),
  );

  const undated = (merged.assessments ?? [])
    .filter((row) => !row.due_on)
    .map((row) => ({
      assessment_id: row.assessment_id,
      title: row.title ?? row.assessment_id ?? "untitled",
      type: row.type ?? null,
      drafted: !recordedIds.has(row.assessment_id),
      // No module either, so nothing places it in a week: the deadline is the
      // fix for both, which is why it is said here and not twice.
      unplaced: unplacedIds.has(row.assessment_id),
    }));

  const undatedIds = new Set(undated.map((row) => row.assessment_id));

  return {
    structure,
    fixed,
    weeksPlanned,
    unplaced: {
      modules: countOf(merged.unplaced?.modules),
      meetings: countOf(merged.unplaced?.meetings),
      assessments: [...unplacedIds].filter((id) => !undatedIds.has(id)).length,
    },
    slides,
    undated,
    dated: countOf(merged.assessments) - undated.length,
    grading: { record: record.grading ?? {}, merged: merged.grading ?? {} },
    // True when the merge added nothing, which is the ordinary state of a
    // course whose proposals have all been approved. The page drops its
    // "drafted" language entirely in that case rather than printing a column
    // of zeroes.
    anyDrafted:
      structure.some((entry) => entry.piece.drafted > 0) ||
      slides.some((entry) => entry.drafted > 0) ||
      undated.some((entry) => entry.drafted),
  };
};

/**
 * The report, computed at most once per change to the workspace.
 *
 * `checklistReport` is the most expensive thing this file does: it builds the
 * outline payload twice — once over what has been accepted, once over the
 * whole course, drafts included. Doing
 * that on every frame load would be paying a course parse for a page whose
 * answer cannot change until a file does.
 *
 * The key is the revision hash the pane ALREADY computes for its own refresh
 * poll: name, size and mtime of every YAML under `courses/`. That
 * makes the cache exactly as fresh as the pane itself — the same hash that
 * tells the browser to reload the frame is the one that invalidates what the
 * frame is about to be served, so there is no window in which the pane redraws
 * and gets the previous answer back.
 *
 * Capped and evicted oldest-first. A professor switches between a handful of
 * runs, so the cap is never reached in practice; it is here so that a long
 * session driving many runs cannot grow the map without bound.
 */
const CHECKLIST_CACHE_MAX = 24;
const CHECKLISTS = new Map();

const checklistFor = (workspace, root, runId) => {
  const key = root + "\u0000" + runId;
  const { revision } = revisionDocument(root);

  const found = CHECKLISTS.get(key);
  if (found && found.revision === revision) return found.report;

  const report = checklistReport(workspace, root, runId);
  CHECKLISTS.set(key, { revision, report });
  if (CHECKLISTS.size > CHECKLIST_CACHE_MAX) {
    // Insertion order is Map's own guarantee, so the first key is the oldest.
    CHECKLISTS.delete(CHECKLISTS.keys().next().value);
  }
  return report;
};

/** `4 in the course · 2 drafted`, or the amber badge when there is neither. */
const countValue = (piece, none) => {
  const parts = [];
  if (piece.recorded > 0) {
    parts.push('<span class="dim">' + piece.recorded + " in the course</span>");
  }
  if (piece.drafted > 0) {
    parts.push('<span class="draft">' + piece.drafted + " drafted</span>");
  }
  return parts.length ? parts.join(" · ") : '<span class="todo">' + escapeText(none) + "</span>";
};

const checkRowHtml = (labelHtml, hint, value) =>
  '<div class="row"><span class="k">' +
  labelHtml +
  (hint ? '<br><span class="dim">' + escapeText(hint) + "</span>" : "") +
  '</span><span class="v">' +
  value +
  "</span></div>";

/**
 * A row whose label is text. The common case, and the safe one.
 *
 * Only `checkRowHtml` takes markup, and only one caller does — the deadline
 * list, which needs `titleWithId`. Everything else keeps a signature that
 * cannot be handed an unescaped course title by accident.
 */
const checkRow = (label, hint, value) => checkRowHtml(escapeText(label), hint, value);

/**
 * The Checklist tab: the four questions a course under construction raises.
 *
 * Every figure on this page comes from `checklistReport`, which takes them from
 * `course_outline`. Nothing is computed in the rendering.
 */
export const checklistDocument = (workspace, root, runId, dark) => {
  const report = checklistFor(workspace, root, runId);

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : "—";

  // ---- What has not been created ----------------------------------------

  const structureRows = report.structure
    .map((entry) => {
      const value =
        entry.of !== undefined && entry.piece.recorded + entry.piece.drafted > 0
          ? countValue(entry.piece, "none") +
            ' <span class="dim">of ' +
            entry.of +
            "</span>"
          : countValue(entry.piece, "none");
      return checkRow(entry.label, entry.piece.state === "todo" ? entry.hint : "", value);
    })
    .join("");

  const fixedRows = report.fixed
    .map((entry) =>
      checkRow(
        entry.label,
        entry.have ? "" : entry.hint,
        entry.have === null
          ? '<span class="dim">—</span>'
          : entry.have > 0
            ? '<span class="dim">' + entry.have + "</span>"
            : '<span class="todo">none</span>',
      ),
    )
    .join("");

  const { planned, total } = report.weeksPlanned;
  const weeksRow = checkRow(
    "Weeks with a module",
    planned < total ? "/plan-term places a module in each" : "",
    total === 0
      ? '<span class="todo">the run has no weeks</span>'
      : '<span class="' +
        (planned === total ? "dim" : "todo") +
        '">' +
        planned +
        " of " +
        total +
        "</span>",
  );

  // Created but attached to nothing, which is a different fault from missing
  // and has a different fix: the record exists, and the week it belongs in is
  // what is absent.
  const UNPLACED_NOUNS = { modules: "module", meetings: "meeting", assessments: "assessment" };
  const unplaced = Object.entries(report.unplaced).filter(([, count]) => count > 0);
  const unplacedRow = unplaced.length
    ? checkRow(
        "Created but not placed",
        "no week, or dated outside the run",
        unplaced
          .map(
            ([kind, count]) =>
              '<span class="todo">' +
              count +
              " " +
              escapeText(UNPLACED_NOUNS[kind]) +
              (count === 1 ? "" : "s") +
              "</span>",
          )
          .join(" "),
      )
    : "";

  const notCreated =
    "<section><h2>What is not created</h2>" +
    structureRows +
    weeksRow +
    fixedRows +
    unplacedRow +
    "</section>";

  // ---- Deadlines ---------------------------------------------------------

  const deadlines =
    "<section><h2>Deadlines</h2>" +
    (report.undated.length === 0
      ? report.dated === 0
        ? '<p class="empty">There is no graded work in this run yet, so there is nothing ' +
          "to give a date to. Drafting one is <code>/design-assessment</code>.</p>"
        : '<p class="dim">All ' +
          report.dated +
          " pieces of graded work carry a due date.</p>"
      : '<p class="tally">' +
        report.undated.length +
        " of " +
        (report.dated + report.undated.length) +
        " carry no due date. A deadline is the professor's to set — " +
        "no skill writes one.</p>" +
        report.undated
          .map((entry) =>
            checkRowHtml(
              titleWithId(entry),
              [entry.type, entry.unplaced ? "no module either, so no week holds it" : null]
                .filter(Boolean)
                .join(" · "),
              '<span class="todo">no deadline</span>' +
                (entry.drafted ? ' <span class="draft">drafted</span>' : ""),
            ),
          )
          .join("")) +
    "</section>";

  // ---- Weights -----------------------------------------------------------
  //
  // `total_weight` is a fraction of one and `complete` is the model's own
  // verdict on it. Neither is recomputed here; `note` is the model's sentence,
  // which names the assessments at fault in a way a percentage cannot.

  const scheme = report.grading.record;
  const withDrafts = report.grading.merged;
  const differs = scheme.total_weight !== withDrafts.total_weight;

  const weights =
    "<section><h2>Weights</h2>" +
    checkRow(
      "Declared in the course",
      "",
      scheme.complete === true
        ? '<span class="dim">' + asPercent(scheme.total_weight) + "</span>"
        : '<span class="todo">' + asPercent(scheme.total_weight) + " of 100%</span>",
    ) +
    (differs
      ? checkRow(
          "If every draft were approved",
          "",
          withDrafts.complete === true
            ? '<span class="draft">' + asPercent(withDrafts.total_weight) + "</span>"
            : '<span class="todo">' + asPercent(withDrafts.total_weight) + " of 100%</span>",
        )
      : "") +
    ((withDrafts.unweighted ?? []).length
      ? checkRow(
          "Carrying no weight",
          "",
          '<span class="todo">' + withDrafts.unweighted.length + "</span>",
        )
      : "") +
    (withDrafts.note ? '<p class="empty">' + escapeText(withDrafts.note) + "</p>" : "") +
    "</section>";

  // ---- Slides ------------------------------------------------------------

  const missingDecks = report.slides.filter((entry) => entry.state === "todo").length;
  const draftedDecks = report.slides.filter((entry) => entry.state === "draft").length;
  const readyDecks = report.slides.filter((entry) => entry.state === "done").length;

  const slides =
    "<section><h2>Slides</h2>" +
    (report.slides.length === 0
      ? '<p class="empty">No week in this run holds a meeting, so there is nowhere for a ' +
        "deck to attach. A deck reaches this list by being a <code>slides</code> resource " +
        "on a learning activity.</p>"
      : '<p class="tally">' +
        readyDecks +
        " ready · " +
        draftedDecks +
        " drafted · " +
        missingDecks +
        " with no deck, over " +
        report.slides.length +
        " weeks that meet.</p>" +
        report.slides
          .map((entry) =>
            checkRow(
              "Week " + entry.week + (entry.title ? " · " + entry.title : ""),
              "",
              entry.state === "todo"
                ? '<span class="todo">no deck</span>'
                : (entry.recorded > 0
                    ? '<span class="dim">' + entry.recorded + " in the course</span>"
                    : "") +
                  (entry.drafted > 0
                    ? (entry.recorded > 0 ? " · " : "") +
                      '<span class="draft">' +
                      entry.drafted +
                      " drafted</span>"
                    : "") +
                  (entry.unlocated > 0
                    ? ' <span class="todo">' + entry.unlocated + " with no file</span>"
                    : ""),
            ),
          )
          .join("")) +
    "</section>";

  // The closing sentence, which changes with the answer: a course whose gaps
  // are all drafted needs the professor's approval, and one whose gaps are empty needs a
  // skill run. Saying both every time would say neither.
  const closing =
    '<section><p class="dim">' +
    (report.anyDrafted
      ? "Blue is written and waiting for you — change <code>approval: draft</code> to " +
        "<code>approved</code> in its record to accept it. Amber is not written yet."
      : "Nothing is drafted for this run, so every amber row above needs a skill run " +
        "rather than an approval.") +
    "</p></section>";

  return documentPage(notCreated + deadlines + weights + slides + closing, dark);
};
