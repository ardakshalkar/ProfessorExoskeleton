/**
 * The class list, and each student's row with their work and their defence.
 */

import { allRubrics, assessmentsOf, enrollmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { forkChoices, recordedLogins } from "@ainar/core/src/forks.ts";
import { loadSheetConfig } from "@ainar/core/src/grade-sheet.ts";
import { gradeChanges } from "@ainar/core/src/grade-changes.ts";
import { finalRange, gradebookPayload } from "@ainar/core/src/gradebook.ts";
import { ASSESSMENT_KINDS } from "@ainar/core/src/assessment-kinds.ts";
import { reportPlace, reportsDir } from "@ainar/core/src/report-place.ts";
import { existsSync, readFileSync } from "node:fs";

import {
  assessmentDialog,
  assessmentWindowScript,
  assessmentWindowStyle,
  presetChips,
  presetScript,
  summarise,
  windowPanel,
} from "./assessment-window.js";
import { BASE } from "./http.js";
import { escapeAttribute, escapeText } from "./markdown.js";
import { extensionOfKey, SHOWABLE } from "./materials.js";
import { documentPage, stamp, VIEW_SCRIPT } from "./page.js";
import { loadedRun, rosterPath, rosterPeople } from "./workspace.js";

export const studentsDocument = (
  workspace,
  runId,
  dark,
  withNames,
  origin,
  sessionId,
  defenceOf = null,
  forksOf = null,
  pilesOf = null,
) => {
  const { bundle, issues } = loadedRun(workspace, runId);
  const enrolled = enrollmentsOf(bundle, runId);

  // Read once per response, not once per student: the store is one file and
  // twenty-seven reads of it would be twenty-seven chances to catch it
  // half-written by a concurrent `ainar roster import`.
  const people = withNames ? rosterPeople() : null;
  // The GitHub accounts recorded with `ainar roster github` or the sheet's
  // GitHub column, read whether or not names are on: they only pick a
  // student's fork out of the list, and are never drawn on their own.
  const recorded = recordedLogins(withNames ? people : rosterPeople());

  const issueItems = issues && Array.isArray(issues.items) ? issues.items : [];
  const refused = issueItems.filter(
    (issue) => issue.code === "storage.forbidden" && /enrollments/.test(issue.message ?? ""),
  );
  const synthetic = issueItems.some((issue) => issue.code === "storage.fixture");

  /*
   * The refused file is worth saying even when there IS a list to draw.
   *
   * A workspace can hold both: fixtures under `samples/` that loaded, and a
   * real `enrollments.yaml` beside them that did not. Reporting the refusal
   * only on an empty list would draw the fixtures as though they were the
   * class and stay silent about student identities sitting in a git tree —
   * which is the one thing on this screen a professor most needs told.
   */
  const refusedHtml = refused.length
    ? '<p class="empty">An enrollments file in this run was <b>not read</b>. It ' +
      "names students, so it belongs in Supabase rather than in the course tree, " +
      "and the loader refuses it rather than pulling identities into a bundle a " +
      "prompt or a widget could serialise. Move it out of the repository.</p>" +
      refused
        .map(
          (issue) =>
            '<div class="row"><span class="k"><code>' +
            escapeText(issue.location ?? "enrollments.yaml") +
            "</code></span></div>",
        )
        .join("")
    : "";

  if (enrolled.length === 0) {
    const body =
      refusedHtml ||
      '<p class="empty">Nobody is enrolled in this run yet. Importing a class ' +
        "list is <code>ainar roster import export.csv --run " +
        escapeText(runId) +
        "</code>, which writes pseudonyms here and the names themselves outside " +
        "the repository.</p>";
    return documentPage("<section><h2>Students</h2>" + body + "</section>", dark);
  }

  // Per-student marks, from the gradebook rather than recomputed. The record is
  // one place; two arithmetics over it would eventually disagree, and the one
  // on this screen would be the one nobody had tested.
  let totals = new Map();
  let book = null;
  try {
    book = gradebookPayload(bundle, runId, {});
    totals = new Map((book.totals ?? []).map((row) => [row.student_id, row]));
  } catch {
    // A course whose rubrics do not add up cannot be totalled, and that is the
    // gradebook's complaint to make, on the gradebook's tab. A class list is
    // still a class list without the marks column.
  }

  /* ------------------------------------------------------------ where they stand
   *
   * What the professor asks of a row before anything else: what is missing,
   * what each quiz came to, and where the course can still end up for them.
   * Every figure is the gradebook's row for that student and assessment — its
   * status and its score — so a mark that is not on the Gradebook tab cannot
   * appear here either. The bounds are the gradebook's too (`finalRange`): the
   * floor is every open assessment at nothing, the ceiling every one at full
   * marks, and the pace the student's own share of what has been graded
   * carried over the rest. This screen adds no arithmetic over grades.
   *
   * "Missing" means past its `due_at` with nothing handed in. An assessment
   * with no due date is never missing, only not yet in — a fabricated deadline
   * would be a fabricated fact about a student.
   */
  const now = Date.now();
  const weighted = (book?.assessments ?? [])
    .filter((assessment) => typeof assessment.weight === "number" && assessment.weight > 0)
    .slice()
    .sort(
      (a, b) =>
        String(a.due_at ?? "9999").localeCompare(String(b.due_at ?? "9999")) ||
        String(a.assessment_id).localeCompare(String(b.assessment_id)),
    );
  const rowFor = new Map();
  for (const assessment of weighted) {
    for (const entry of assessment.rows ?? []) rowFor.set(assessment.assessment_id + "|" + entry.student_id, entry);
  }
  /*
   * Past due with nothing recorded for ANYONE is not a class that all missed
   * it. It is a hand-in that has not been brought in — Canvas holds the
   * homework until `ainar lms import-submissions` reads it back — and calling
   * eighty students delinquent over an import nobody ran would be the loudest
   * wrong thing this screen could say. Those cells read "not recorded", and
   * the header names the assessments and the command.
   */
  const unrecorded = new Set(
    weighted
      .filter((assessment) => {
        const due = assessment.due_at ? Date.parse(assessment.due_at) : NaN;
        return Number.isFinite(due) && due < now && !(assessment.rows ?? []).some((entry) => entry.submission_id);
      })
      .map((assessment) => assessment.assessment_id),
  );
  // One column per kind present, in core's reading order; a type the model
  // does not know (an old record) lands under Other rather than vanishing.
  const known = new Set(ASSESSMENT_KINDS.map((kind) => kind.type));
  const kinds = ASSESSMENT_KINDS.map((kind) => ({
    label: kind.many,
    assessments: weighted.filter((a) =>
      kind.type === "other" ? a.type === "other" || !known.has(a.type) : a.type === kind.type,
    ),
  })).filter((kind) => kind.assessments.length);

  // The scheme's top-level blocks, in its own order: ВСК 1, ВСК 2, Final. A
  // nested block is already inside its parent's figure.
  const schemeBlocks = (((runById(bundle).get(runId) ?? {}).grading_scheme ?? {}).components ?? []).filter(
    (component) => !component.parent,
  );

  const number = (value) => String(Math.round(value * 10) / 10);

  // The run's integrity cases (src/integrity.ts). Pseudonyms only; the note is
  // the professor's and is folded away wherever it is drawn — this pane is projected.
  const runCases = (bundle.integrity_cases ?? []).filter((entry) => entry.course_version_id === runId);
  const hasCases = runCases.length > 0;

  /** One student's state on every weighted assessment, and the gradebook's bounds. */
  const standingOf = (studentId) => {
    const cells = new Map();
    let missing = 0;
    let waiting = 0;
    for (const assessment of weighted) {
      const entry = rowFor.get(assessment.assessment_id + "|" + studentId);
      const due = assessment.due_at ? Date.parse(assessment.due_at) : NaN;
      let state;
      // An integrity case holds the mark, or voids it: the gradebook's word,
      // drawn as its own state so it is never read as missing or waiting.
      if (entry && (entry.status === "held" || entry.status === "voided")) {
        state = entry.status;
      } else if (entry && entry.status === "graded" && entry.score !== null && entry.maximum) {
        state = "graded";
      } else {
        if (entry && entry.submission_id) {
          state = "in";
          waiting += 1;
        } else if (unrecorded.has(assessment.assessment_id)) {
          state = "unrecorded";
        } else if (Number.isFinite(due) && due < now) {
          state = "missing";
          missing += 1;
        } else {
          state = "ahead";
        }
      }
      cells.set(assessment.assessment_id, { state, entry, due });
    }
    return { cells, missing, waiting, ...finalRange(book, studentId) };
  };

  /** What one cell says when hovered: the assessment, its state, its deadline. */
  const tipOf = (assessment, { state, entry, due }) => {
    const title = assessment.title ?? assessment.assessment_id;
    const when = Number.isFinite(due) ? " · due " + stamp(assessment.due_at) : " · no due date";
    const caseSaid = entry?.integrity
      ? " · integrity case " + entry.integrity.case_id + " " + entry.integrity.state.replace("_", " ") +
        (entry.integrity.outcome ? ", " + entry.integrity.outcome.replace("_", " ") : "")
      : "";
    const said =
      state === "held"
        ? "mark held — an integrity case is open"
        : state === "voided"
          ? "voided by an integrity case — out of the total"
          : state === "graded"
        ? number(entry.score) + " of " + number(entry.maximum) + caseSaid
        : state === "in"
          ? "handed in, not graded yet"
          : state === "missing"
            ? "missing — past due, nothing handed in"
            : state === "unrecorded"
              ? "no hand-ins imported for anyone yet"
              : "not due yet";
    return title + " — " + said + when;
  };

  /*
   * The row's marks: one column per kind — Homework, Quizzes, Exams,
   * Projects — and one fixed-width cell per assessment inside it, in the order
   * the detail lists them, so cell 3 of Homework is HW3 on every row. Colour
   * is the state, the hover is the assessment — a column of amber down the
   * list is a hand-in the whole class missed, which is the pattern a card per
   * student could never show.
   */
  const CELL = 24;
  const GAP = 2;
  const kindWidth = (kind) => kind.assessments.length * (CELL + GAP) - GAP;
  const columns =
    "minmax(150px,1.3fr) 56px 140px 52px 56px " + kinds.map((kind) => Math.max(kindWidth(kind), 52) + "px").join(" ");
  // The number the professor calls an assessment by — HW3, Quiz 4 — where its
  // title starts with one, and its place in the kind where it does not.
  const shortOf = (assessment, index) => {
    const match = /^\D{0,12}?(\d+)/.exec(String(assessment.title ?? ""));
    return match ? match[1] : String(index + 1);
  };
  /*
   * Every cell opens its hand-in in the drawer — what was
   * handed in, the fork, the defence, or what can still be done about it. The
   * attributes are read by the press in `drawerScript`.
   */
  const opens = (studentId, assessment) =>
    studentId
      ? ' data-hw="' + escapeText(assessment.assessment_id) + '" data-hw-student="' + escapeText(studentId) +
        '" role="button" tabindex="0"'
      : "";

  const strip = (standing, studentId) =>
    kinds
      .map(
        (kind) =>
          '<span class="sk">' +
          kind.assessments
            .map((a) => {
              const at = standing.cells.get(a.assessment_id);
              // The mark itself, small, where there is one; the state's sign
              // where there is not. A cell not yet due stays a bare slot.
              const text =
                at.state === "graded"
                  ? number(at.entry.score)
                  : { in: "✓", missing: "✗", unrecorded: "?", held: "⚑", voided: "EX" }[at.state] ?? "";
              // A mark an upheld case decided (zero, no penalty) keeps its
              // number, with the flag in the corner.
              const flagged = at.state === "graded" && at.entry?.integrity && at.entry.integrity.state !== "cleared";
              // A mark fills its cell from the bottom as far as it is of the
              // full marks, warm under half: good and bad read down a column.
              const share =
                at.state === "graded" && Number(at.entry.maximum) > 0
                  ? Math.max(0, Math.min(100, (100 * Number(at.entry.score)) / Number(at.entry.maximum)))
                  : null;
              return (
                '<span class="m ' + at.state + (share !== null && share < 50 ? " lo" : "") + (flagged ? " ic" : "") + '"' +
                (share !== null ? ' style="--f:' + share.toFixed(0) + '%"' : "") +
                ' title="' + escapeText(tipOf(a, at)) + '"' + opens(studentId, a) + ">" +
                escapeText(text) + "</span>"
              );
            })
            .join("") +
          "</span>",
      )
      .join("");

  /*
   * Where the course can still end, and the scheme's blocks — only once
   * something is graded. Before that the range is 0 – 100 for everyone and the
   * blocks are all dashes: a line that is true of the whole class says nothing
   * about this student, and the row's bar already draws it.
   */
  const standingBlock = (studentId, standing) => {
    if (!weighted.length || standing.floor === null || standing.open >= 100) return "";
    const total = totals.get(studentId);
    const blocks = schemeBlocks.length && total && Array.isArray(total.components)
      ? '<p class="blocks">' +
        schemeBlocks
          .map((block) => {
            const got = total.components.find((c) => c.component_id === block.component_id);
            const of = number(block.weight * 100);
            const has = got && got.weight_graded > 0;
            return (
              '<span class="blk"><span class="dim">' + escapeText(block.title ?? block.component_id) + "</span> " +
              (has ? "<b>" + number(got.earned_weighted * 100) + "</b>" : '<span class="dim">—</span>') +
              '<span class="dim"> / ' + of + "</span></span>"
            );
          })
          .join("") +
        "</p>"
      : "";
    const bounds =
      '<p class="bounds">Final can still land <b>' + number(standing.floor) + " – " + number(standing.ceiling) +
      "</b> / 100" +
      ' <span class="dim">· ' + number(standing.open) + "% of the course still open</span></p>";
    return '<div class="standing">' + bounds + blocks + "</div>";
  };

  // The run's own assessments, by id. Doubles as the scope filter for
  // submissions: a bundle holds every run's, and this view is about one.
  const assessmentTitles = new Map(
    assessmentsOf(bundle, runId).map((assessment) => [assessment.assessment_id, assessment]),
  );
  // For the criterion a defence question is evidence for, by its title.
  const rubricsById = allRubrics(bundle);

  const active = enrolled.filter((entry) => entry.status === "active");
  const inactive = enrolled.filter((entry) => entry.status !== "active");

  // Who has something past due and not handed in: the one count a professor
  // acts on from this screen, so it gets its own press.
  const behind = weighted.length ? active.filter((entry) => standingOf(String(entry.student_id ?? "")).missing > 0).length : 0;

  const label = (entry) => String(entry.group ?? "").trim();
  const groups = [...new Set(active.map(label))].sort((a, b) => {
    // The ungrouped go last: they are the remainder, not a subgroup called "".
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  /*
   * The share of graded work, which is also where the course ends at this
   * pace — the same share carried over what is left. The gradebook's figure,
   * not this view's.
   */
  const paceOf = (studentId) => {
    const percent = (totals.get(studentId) ?? {}).percent_of_graded;
    return typeof percent === "number" ? percent : null;
  };

  /*
   * The line a row is judged against. The model has no pass mark yet, so this
   * is the 50 every scheme the pane has met uses; when `grading_scheme` grows
   * one, it replaces this constant and nothing else.
   */
  const PASS = 50;
  const attentionOf = (studentId, standing) => {
    const pace = paceOf(studentId);
    return Boolean((standing && standing.missing > 0) || (pace !== null && pace < PASS));
  };

  const gradedLine = (studentId) => {
    const row = totals.get(studentId);
    if (!row) return "no work graded yet";
    const counted = (row.assessments_counted ?? []).length;
    return counted + " of " + (counted + (row.assessments_outstanding ?? []).length) + " graded";
  };

  /* ------------------------------------------------------- what they handed in
   *
   * The class list said how much of the course each student had been marked
   * on and nothing at all about what they wrote. A professor asking "what is
   * in this?" — the question a mark cannot answer — had to leave the harness,
   * find the file and open it, or read `item-responses.yaml` by hand.
   *
   * So each person's work opens under their row, and it opens CLOSED. This
   * pane is screen-shared and projected; a class list that unfolded every
   * student's answers on load would put a room's written work on a lecture
   * theatre wall. One press per person is the right price for that, and it is
   * the pane's own idiom already — the folded missing-students list works the
   * same way.
   *
   * Rendered inline rather than fetched on demand, and that is forced rather
   * than chosen: these documents are delivered into a frame with an opaque
   * origin, which may neither navigate itself nor `fetch`. There is no
   * "load it when pressed" available in here. See VIEW_SCRIPT.
   */

  const submissionsOf = new Map();
  for (const submission of bundle.submissions ?? []) {
    if (!assessmentTitles.has(submission.assessment_id)) continue;
    const key = submission.student_id;
    if (!submissionsOf.has(key)) submissionsOf.set(key, []);
    submissionsOf.get(key).push(submission);
  }
  for (const list of submissionsOf.values()) {
    // Newest last, the order they were handed in. An attempt 2 sorting above
    // attempt 1 would read as the earlier answer.
    list.sort((a, b) => String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")));
  }

  const responsesOf = new Map();
  for (const response of bundle.item_responses ?? []) {
    const key = response.submission_id;
    if (!responsesOf.has(key)) responsesOf.set(key, []);
    responsesOf.get(key).push(response);
  }

  // Every scanned pile's standing — read here, before any row is drawn, for a
  // hand-in's Scans tab as well as the assessment window further down.
  const piles = weighted.length && pilesOf ? pilesOf(bundle) : new Map();

  /*
   * Each assessment's exam reports, as `ainar report exam` left them in the
   * private folder: who has one, and who was sent theirs. A report names the
   * student, so it is opened only with names on — what Pseudonyms is for.
   */
  const reportsBase = (() => {
    try {
      return reportsDir(null);
    } catch {
      return null;
    }
  })();
  const readJson = (path) => {
    try {
      return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    } catch {
      return null;
    }
  };
  const reportUrl = (assessmentId, who) =>
    `${origin}${BASE}/api/reports/file?run=` + encodeURIComponent(runId) + "&assessment=" + encodeURIComponent(assessmentId) +
    "&student=" + encodeURIComponent(who) + (sessionId ? "&session=" + encodeURIComponent(sessionId) : "");
  const reportsOf = new Map();
  if (reportsBase) {
    for (const assessment of assessmentTitles.values()) {
      const place = reportPlace(reportsBase, runId, assessment.assessment_id);
      const manifest = readJson(place.manifest);
      if (!manifest) continue;
      reportsOf.set(assessment.assessment_id, {
        manifest,
        sent: readJson(place.sent) ?? {},
        classPdf: existsSync(place.classPdf),
        has: (student) => Boolean(manifest.students?.[student]) && existsSync(place.studentPdf(student)),
      });
    }
  }

  const itemById = new Map((bundle.items ?? []).map((item) => [item.item_id, item]));
  const documentById = new Map((bundle.documents ?? []).map((row) => [row.document_id, row]));

  /**
   * One file a student handed in, as a link or as the reason there is not one.
   *
   * The reason matters more than it looks. `samples/documents.yaml` says it in
   * as many words: the bytes of student work live in object storage and never
   * in this repository. `sendMaterial` refuses any key carrying a scheme, so a
   * submission recorded as `object://…` cannot be framed — not because this
   * view forgot to link it, but because the model deliberately does not have
   * it here. Saying so is the honest answer; a dead `open` link that returned
   * a sentence about storage would be worse than no link.
   *
   * A professor who DOES keep submissions in the workspace gets the overlay
   * for free: a repository-relative key is served by the same route a brief
   * is, and a PDF, an image, a text file or markdown paints in the frame.
   */
  const fileRow = (file) => {
    const record = documentById.get(file.document_id);
    const title = record && record.title ? record.title : file.document_id;
    const type = String(file.type ?? "").trim();
    const key = String((record ?? {}).storage_key ?? "");
    const left =
      '<span class="k">' +
      escapeText(title) +
      (type ? ' <span class="dim">' + escapeText(type) + "</span>" : "") +
      "</span>";

    if (!record) {
      return (
        '<div class="row">' +
        left +
        '<span class="v"><span class="todo">no such document</span></span></div>'
      );
    }
    if (!key || key.includes("://")) {
      return (
        '<div class="row">' +
        left +
        '<span class="v"><span class="dim">held outside the workspace</span></span></div>'
      );
    }
    const extension = extensionOfKey(key);
    const href =
      `${origin}${BASE}/file?doc=` +
      encodeURIComponent(file.document_id) +
      (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
      (dark ? "&dark=1" : "");
    return (
      '<div class="row">' +
      left +
      '<span class="v"><a class="chip-link" href="' +
      escapeText(href) +
      '" target="_blank" rel="noopener"' +
      (SHOWABLE.has(extension)
        ? ' data-view="' + escapeText(title) + '" data-format="' + escapeText(extension) + '"'
        : "") +
      ">open</a></span></div>"
    );
  };

  /**
   * One answer: the question, then what the student put.
   *
   * Both halves, because neither is legible alone. `chosen_options: [b]` says
   * nothing without the option's own text, and a paragraph of `raw_response`
   * says little without the question it answers. An item the course no longer
   * has is named by its id rather than dropped — a response whose item was
   * deleted is a thing to notice, not to hide.
   */
  const answer = (response) => {
    const item = itemById.get(response.item_id);
    const number = item && item.number ? String(item.number) + ". " : "";
    const prompt = item
      ? escapeText(item.prompt)
      : '<span class="dim">' + escapeText(response.item_id) + " — no such item in the course</span>";

    const chosen = Array.isArray(response.chosen_options) ? response.chosen_options : [];
    const options = item && Array.isArray(item.options) ? item.options : [];
    const picked = chosen.map((label) => {
      const option = options.find((candidate) => candidate.label === label);
      return (
        "<b>" +
        escapeText(label) +
        "</b>" +
        (option ? " " + escapeText(option.text) : "")
      );
    });

    const scored =
      response.score === null || response.score === undefined
        ? // Marked as a whole, as most papers are: not a grading left undone.
          '<span class="dim">no mark per question</span>'
        : escapeText(String(response.score)) +
          (item && typeof item.maximum_score === "number"
            ? " of " + escapeText(String(item.maximum_score))
            : "");

    // `correct` is nullish on anything a person marked rather than a machine,
    // and absent is not the same as wrong.
    const verdict =
      response.correct === true
        ? ' · <span class="ok">correct</span>'
        : response.correct === false
          ? ' · <span class="bad">incorrect</span>'
          : "";

    return (
      '<div class="qa"><p class="q">' +
      escapeText(number) +
      prompt +
      "</p>" +
      (picked.length ? '<p class="a">chose ' + picked.join("; ") + "</p>" : "") +
      (response.raw_response
        ? "<blockquote>" + escapeText(String(response.raw_response)) + "</blockquote>"
        : "") +
      (!picked.length && !response.raw_response
        ? '<p class="a"><span class="dim">nothing recorded for this question</span></p>'
        : "") +
      '<p class="s">' +
      scored +
      verdict +
      "</p></div>"
    );
  };

  /** A titled part of one hand-in: Defence, Repository, Answers, Files. */
  const part = (title, body, aside = "") =>
    body ? '<div class="part"><h3 class="sh">' + escapeText(title) + (aside ? ' <span class="dim">' + aside + "</span>" : "") + "</h3>" + body + "</div>" : "";

  const prepared = (submission) =>
    defenceOf ? defenceOf(submission.assessment_id, submission.student_id) : { pin: null, questions: null, recorded: null };

  /**
   * The repository a student handed in, opened on GitHub in a tab of its own
   * — somebody else's site, not a material this pane can frame — with the
   * commit the defence is pinned to once it is cloned.
   */
  const repositoryLine = (submission) => {
    const pin = prepared(submission).pin;
    return (
      '<p><a class="chip-link" href="' + escapeText(submission.url) + '" target="_blank" rel="noopener">' +
      escapeText(submission.url.replace(/^https?:\/\/(www\.)?github\.com\//, "")) + "</a>" +
      (pin
        ? ' <span class="dim">at <code>' +
          escapeText(String(pin.commit).slice(0, 7)) +
          "</code>" +
          (pin.pinned_by === "submitted_at" ? ", as handed in" : pin.note ? " — " + escapeText(pin.note) : ", the head") +
          (pin.head && pin.head !== pin.commit ? " · moved on since" : "") +
          "</span>"
        : "") +
      "</p>"
    );
  };

  /*
   * The recording, first in the Defence part: what was recorded and *Open
   * defence*, which opens the desk on it — every take's audio and
   * transcript are there, and nowhere on this page. Nothing recorded yet:
   * *Audio defence*, the same desk, ready to record.
   */
  const minutesOf = (seconds) =>
    seconds >= 60 ? Math.round(seconds / 60) + " min" : Math.max(1, Math.round(seconds)) + " s";
  const recordingLine = (submission) => {
    const recorded = prepared(submission).recorded;
    const desk = (label, primary) =>
      '<button type="button" class="chip' + (primary ? " act" : "") + '" data-desk="' + escapeText(submission.assessment_id) +
      '" data-student="' + escapeText(submission.student_id) + '">' + escapeText(label) + "</button>";
    if (!recorded) {
      return '<div class="rec"><span class="dim">Not recorded yet</span>' + desk("Audio defence", false) + "</div>";
    }
    const transcribed =
      recorded.transcribed === recorded.takes ? "transcribed" : recorded.transcribed + " of " + recorded.takes + " transcribed";
    return (
      '<div class="rec on"><span class="recdot" aria-hidden="true"></span><span class="rect"><b>Recorded</b> ' +
      escapeText(
        [
          recorded.seconds ? minutesOf(recorded.seconds) : "",
          recorded.whole ? "whole defence" : recorded.takes + (recorded.takes === 1 ? " answer" : " answers"),
          transcribed,
          recorded.last ? stamp(recorded.last) : "",
        ]
          .filter(Boolean)
          .join(" · "),
      ) +
      "</span>" + desk("Open defence", true) + "</div>"
    );
  };

  /**
   * The questions drafted for a handed-in repository, folded under the
   * recording. *Draft questions* clones it in the harness's process and then
   * asks the session to draft them (`/defend-submission`), so the model
   * drafting them is whichever one the professor is talking to. Once drafted
   * they are drawn in the order they will be asked, each with the criterion
   * it is evidence for and the lines it is about, marked draft until read.
   */
  const defenceBlock = (submission) => {
    if (!submission.url) return "";
    const ready = prepared(submission);
    const criteria = new Map(
      ((rubricsById.get(assessmentTitles.get(submission.assessment_id)?.rubric_id ?? "") ?? {}).criteria ?? []).map(
        (criterion) => [criterion.criterion_id, criterion.title],
      ),
    );
    const questions = ready.questions && Array.isArray(ready.questions.questions) ? ready.questions.questions : [];
    const press = (label) =>
      '<button type="button" class="chip" data-defence="' +
      escapeText(submission.assessment_id) +
      '" data-student="' +
      escapeText(submission.student_id) +
      '">' +
      escapeText(label) +
      "</button>";
    if (!questions.length) {
      return '<p class="defence"><span class="dim">No questions drafted</span> ' + press("Draft questions") + "</p>";
    }
    return (
      '<details class="dc defence"><summary>Drafted questions <span class="dim">' + questions.length + "</span></summary>" +
      '<p class="dqa">' + press("Draft again") + "</p>" +
      (questions.length
        ? "<ol class=\"dq\">" +
          questions
            .map(
              (question) =>
                "<li><p>" +
                escapeText(String(question.text ?? "")) +
                (question.approval === "draft" ? ' <span class="todo">draft</span>' : "") +
                "</p>" +
                '<p class="dim">' +
                [
                  question.kind === "opening" ? "opening" : null,
                  question.criterion_id
                    ? escapeText(criteria.get(question.criterion_id) ?? question.criterion_id)
                    : null,
                  ...(Array.isArray(question.evidence) ? question.evidence : []).map(
                    (cite) => "<code>" + escapeText(cite.path) + (cite.lines ? ":" + escapeText(cite.lines) : "") + "</code>",
                  ),
                ]
                  .filter(Boolean)
                  .join(" · ") +
                (question.why ? "<br>" + escapeText(String(question.why)) : "") +
                "</p></li>",
            )
            .join("") +
          "</ol>"
        : "")
      + "</details>"
    );
  };

  /*
   * The professor's word on the oral defence — *Defended* or *Not defended* —
   * written onto the submission (`defence mark`). Offered on work that can be
   * defended: homework and projects, a handed-in repository, an assessment
   * that lists an oral defence, or one already marked — not on a quiz or an
   * exam paper. Pressing the word that is on clears it.
   */
  const defensibleAssessment = (assessment) =>
    assessment.type === "assignment" ||
    assessment.type === "project" ||
    (Array.isArray(assessment.submission_type) && assessment.submission_type.includes("oral_defense"));

  const defensibleSubmission = (submission) =>
    Boolean(submission.url || submission.defence || defensibleAssessment(assessmentTitles.get(submission.assessment_id) ?? {}));

  // The verdict, one segmented pair: the word that is on is the filled one.
  const verdictRow = (submission) => {
    const press = (outcome, text) => {
      const on = submission.defence === outcome;
      return (
        '<button type="button" class="chip" data-defended="' +
        (on ? "clear" : outcome) +
        '" data-assessment="' +
        escapeText(submission.assessment_id) +
        '" data-student="' +
        escapeText(submission.student_id) +
        '" aria-pressed="' +
        String(on) +
        '"' +
        (on ? ' title="Press again to clear"' : "") +
        ">" +
        escapeText(text) +
        "</button>"
      );
    };
    return (
      '<div class="defended"><span class="segl">Verdict</span><span class="segg">' +
      press("defended", "Defended") +
      press("not_defended", "Not defended") +
      "</span>" +
      (submission.defence ? "" : ' <span class="dim">not marked</span>') +
      "</div>"
    );
  };

  /*
   * One hand-in's Defence part: the recording and *Open defence*, the
   * verdict, the rubric check, and the questions drafted for a repository.
   */
  const defencePart = (submission) =>
    defensibleSubmission(submission)
      ? part(
          "Defence",
          recordingLine(submission) +
            verdictRow(submission) +
            rubricCheck(submission, assessmentTitles.get(submission.assessment_id) ?? {}) +
            defenceBlock(submission),
        )
      : "";

  // Every evaluation by submission and criterion, for the rubric check.
  const evaluationOf = new Map(
    (bundle.evaluations ?? []).map((entry) => [entry.submission_id + " " + entry.criterion_id, entry]),
  );

  /*
   * The defence checked against the homework's own rubric, one criterion at a
   * time (`defence mark --criterion`, src/defence-check.ts): *Confirmed* keeps
   * the written mark, *Partly* halves it — or takes the points typed beside
   * it — and *Not confirmed* makes it 0. The written mark stays in the
   * evaluation's history; pressing the word that is on puts it back.
   */
  // A mark to two places: rubric points come in quarters, which `number` rounds away.
  const points = (value) => String(Math.round(value * 100) / 100);
  const rubricCheck = (submission, assessment) => {
    const rubric = assessment.rubric ?? rubricsById.get(assessment.rubric_id ?? "");
    const criteria = rubric && Array.isArray(rubric.criteria) ? rubric.criteria : [];
    if (!criteria.length) return "";
    let checked = 0;
    const rows = criteria
      .map((criterion) => {
        const evaluation = evaluationOf.get(submission.submission_id + " " + criterion.criterion_id);
        const decision =
          evaluation && ["approved", "overridden"].includes(evaluation.status) ? evaluation.professor_decision : null;
        const fromDefence = Boolean(decision && evaluation.extensions?.decided_via === "defence");
        const word = fromDefence ? decision.defence : null;
        if (word) checked += 1;
        const history = Array.isArray(evaluation?.extensions?.history) ? evaluation.extensions.history : [];
        const written = fromDefence
          ? [...history].reverse().find((entry) => entry && entry.via !== "defence")
          : decision;
        const writtenScore = written && written.score != null ? Number(written.score) : null;
        const attrs =
          ' data-criterion="' +
          escapeText(criterion.criterion_id) +
          '" data-assessment="' +
          escapeText(submission.assessment_id) +
          '" data-student="' +
          escapeText(submission.student_id) +
          '"';
        const press = (outcome, text) => {
          const on = word === outcome;
          return (
            '<button type="button" class="chip" data-check="' +
            (on ? "clear" : outcome) +
            '"' +
            attrs +
            ' aria-pressed="' +
            String(on) +
            '"' +
            (on ? ' title="Press again to restore the written mark"' : "") +
            ">" +
            escapeText(text) +
            "</button>"
          );
        };
        const maximum = Number(criterion.maximum_score);
        // A card per criterion: its name and mark on one line, the three
        // words joined underneath with the points for *Partly* at their end.
        return (
          '<div class="crit' + (word ? " done" : "") + '"><div class="cth"><span class="ctt">' +
          escapeText(String(criterion.title ?? criterion.criterion_id)) +
          '</span><span class="ctm">' +
          (decision ? "<b>" + escapeText(points(Number(decision.score))) + "</b>" : '<span class="dim">—</span>') +
          '<span class="dim"> / ' + escapeText(points(maximum)) + "</span>" +
          (fromDefence && writtenScore != null && writtenScore !== Number(decision.score)
            ? ' <span class="dim">was ' + escapeText(points(writtenScore)) + "</span>"
            : "") +
          '</span></div><div class="seg"><span class="segg">' +
          press("confirmed", "Confirmed") +
          press("partly", "Partly") +
          press("not_confirmed", "Not confirmed") +
          '</span><input class="dcs" type="number" min="0" max="' +
          escapeText(String(maximum)) +
          '" step="0.25" aria-label="Points for Partly" title="Points for Partly — empty halves the written mark" placeholder="' +
          escapeText(writtenScore != null ? points(Math.round((writtenScore / 2) * 100) / 100) : "pts") +
          '"' +
          attrs +
          "></div></div>"
        );
      })
      .join("");
    return (
      '<details class="dc rubric"><summary>Check against the rubric <span class="dim">' +
      escapeText(String(checked)) +
      " of " +
      escapeText(String(criteria.length)) +
      " checked</span>" +
      '<span class="cbar" aria-hidden="true"><span style="width:' + Math.round((checked / criteria.length) * 100) + '%"></span></span>' +
      "</summary>" +
      rows +
      "</details>"
    );
  };

  // Every mark that moved after its first decision, by submission (grade-changes.ts).
  const changesOf = new Map();
  for (const change of gradeChanges(bundle, runId)) {
    if (change.from === null || change.from === change.to) continue;
    const key = change.student_id + " " + change.assessment_id;
    if (!changesOf.has(key)) changesOf.set(key, []);
    changesOf.get(key).push(change);
  }

  /** When and how this submission's marks changed, newest first; nothing when none did. */
  const changesBlock = (submission) => {
    const list = changesOf.get(submission.student_id + " " + submission.assessment_id) ?? [];
    if (!list.length) return "";
    return (
      '<details class="dc"><summary>Grade changes <span class="dim">' +
      escapeText(String(list.length)) +
      "</span></summary><table>" +
      [...list]
        .reverse()
        .map(
          (change) =>
            "<tr><td>" +
            escapeText(change.at ? stamp(change.at) : "undated") +
            "</td><td>" +
            escapeText(change.criterion) +
            '</td><td class="dcm">' +
            escapeText(points(change.from) + " → " + points(change.to)) +
            "</td><td>" +
            escapeText(change.how + (change.defence ? " (" + change.defence.replace("_", " ") + ")" : "")) +
            "</td></tr>",
        )
        .join("") +
      "</table></details>"
    );
  };

  /*
   * A fork the student brought in person rather than handed in through
   * Canvas (`defence fork`) — chosen, not pasted.
   *
   * Students fork the starter and keep the fork public, so the starter's
   * forks are a list GitHub already has (`ainar homework forks`, src/forks.ts),
   * and the account a student's earlier links name picks theirs out of it.
   * Found: one press, *Use their fork*. Not found: a list of the forks nobody
   * on record owns, to pick from. Never looked up: *Find their fork*. Pasting a
   * link stays, one press behind, for a fork GitHub does not list — and on a
   * homework with no starter repository recorded it is the only way.
   */
  const runSubmissions = [...submissionsOf.values()].flat();
  const forkPicker = (assessmentId, studentId) => {
    const assessment = assessmentTitles.get(assessmentId) ?? {};
    const starter = assessment.extensions?.github?.template_repo ?? null;
    const cache = starter && forksOf ? forksOf(assessmentId) : null;
    const attrs = ' data-fork="' + escapeText(assessmentId) + '" data-student="' + escapeText(studentId) + '"';
    const input = (shown) =>
      '<input class="fk" type="url" placeholder="https://github.com/owner/repo" aria-label="Fork link"' +
      (shown ? "" : " hidden") +
      ">";
    const save = (shown, label = "Save", url = "") =>
      '<button type="button" class="chip' + (url ? " act" : "") + '"' + attrs +
      (url ? ' data-url="' + escapeText(url) + '"' : "") +
      (shown ? "" : " hidden") +
      ">" + escapeText(label) + "</button>";
    const paste = '<button type="button" class="lnk" data-paste>paste a link</button>';
    const again = cache
      ? '<button type="button" class="lnk" data-forks="' + escapeText(assessmentId) + '" title="Forks of ' +
        escapeText(starter) + " last looked up " + escapeText(stamp(cache.looked_up_at)) + '">look again</button>'
      : "";
    if (!starter) return '<span class="fp">' + input(true) + " " + save(true) + "</span>";
    if (!cache) {
      return (
        '<span class="fp"><button type="button" class="chip" data-forks="' + escapeText(assessmentId) +
        '" title="Look up the public forks of ' + escapeText(starter) + '">Find their fork</button> ' +
        paste + input(false) + " " + save(false) + "</span>"
      );
    }
    const { theirs, how, unclaimed } = forkChoices(cache, runSubmissions, assessmentId, studentId, recorded);
    if (theirs) {
      // A fork found by a recorded account names that account beside a
      // pseudonym; with names off it is not drawn, and the press alone stays.
      const shown = how !== "recorded" || withNames;
      return (
        '<span class="fp">' + save(true, "Use their fork", theirs.url) +
        (shown
          ? ' <a class="dim" href="' + escapeText(theirs.url) + '" target="_blank" rel="noopener">' + escapeText(theirs.repo) + "</a>"
          : ' <span class="dim">by their recorded account</span>') +
        " " + paste + input(false) + again + "</span>"
      );
    }
    if (!unclaimed.length) {
      return (
        '<span class="fp"><span class="dim">no unclaimed fork of ' + escapeText(starter) + "</span> " +
        input(true) + " " + save(true) + again + "</span>"
      );
    }
    /*
     * Until a student has handed in one link, nothing says which account is
     * theirs. Their name can still order the list: an account that spells
     * part of it goes first, under its own heading. A hint, never a choice —
     * `aliya` is more than one student — and only with names on screen.
     */
    const person = people ? people[studentId] : null;
    const tokens = person && typeof person.name === "string"
      ? person.name.toLowerCase().split(/[^\p{L}]+/u).filter((token) => token.length >= 4)
      : [];
    const looksLike = (fork) => {
      const login = fork.owner.toLowerCase().replace(/[^a-z]/g, "");
      return tokens.some((token) => login.includes(token) || (login.length >= 4 && token.includes(login)));
    };
    const option = (fork) =>
      '<option value="' + escapeText(fork.url) + '">' + escapeText(fork.repo) +
      (fork.pushed_at ? " · pushed " + escapeText(stamp(fork.pushed_at)) : "") + "</option>";
    const likely = unclaimed.filter(looksLike);
    const others = unclaimed.filter((fork) => !looksLike(fork));
    // Eighty forks in one select is a scroll, not a choice: past a dozen the
    // list gets a box that narrows it as the professor types.
    const narrow =
      unclaimed.length > 12 ? '<input class="fkq" type="search" placeholder="Filter forks" aria-label="Filter forks"> ' : "";
    return (
      '<span class="fp">' + narrow + '<select class="fks" aria-label="Their fork"><option value="">Pick their fork…</option>' +
      (likely.length
        ? '<optgroup label="Looks like their name">' + likely.map(option).join("") + "</optgroup>" +
          '<optgroup label="Every other fork">' + others.map(option).join("") + "</optgroup>"
        : others.map(option).join("")) +
      '<option value="paste">Paste a link…</option></select> ' +
      input(false) + " " + save(true) + again + "</span>"
    );
  };

  /*
   * Regrade the whole hand-in, with the professor's note on how. The press
   * asks the session (`/grade-submission`), so the model judging is the one
   * the professor is talking to, and what comes back is a fresh suggestion per
   * question beside the decided mark — still theirs to accept in Grade. The
   * prompt names the pseudonym, never the name: it becomes a turn in a chat.
   */
  // This hand-in's exam report, when one was made: open it, and whether it was sent.
  const reportLine = (submission) => {
    const reports = reportsOf.get(submission.assessment_id);
    const student = String(submission.student_id);
    if (!reports || !reports.has(student)) return "";
    const sent = reports.sent[student];
    const title = (assessmentTitles.get(submission.assessment_id)?.title ?? submission.assessment_id) + " — report";
    return (
      '<p class="rpl">' +
      (people
        ? '<a class="chip-link" href="' + escapeText(reportUrl(submission.assessment_id, student)) + '" target="_blank" rel="noopener" data-view="' +
          escapeText(title) + '" data-format="pdf">Report (PDF)</a>'
        : '<span class="dim">Report made — it carries the name, so it opens with real names on</span>') +
      ' <span class="dim">' +
      (sent ? "sent to Canvas " + escapeText(stamp(sent.at)) : "not sent") +
      "</span></p>"
    );
  };

  const regradeBlock = (submission) =>
    '<details class="dc regrade"><summary>Regrade the whole paper</summary>' +
    '<div class="rgb"><textarea data-note="the professor\'s note on how: " rows="3" ' +
    'placeholder="How to regrade it — e.g. accept answers in either notation; be stricter on Q4; read page 3 again"></textarea>' +
    '<button type="button" class="chip act" data-ask="' +
    escapeText(
      "/grade-submission " + submission.assessment_id + " " + runId + " " + submission.student_id +
        " — regrade the whole paper, every question afresh, as new suggestions beside the current marks",
    ) +
    '">Ask to regrade</button>' +
    '<p class="dim">New marks arrive as suggestions; the current ones stay until you accept the new ones in Grade.</p></div></details>';

  /*
   * An academic-integrity case on one student's assessment: each case's state,
   * the note folded, and — when none is open — *Open a case*, which holds the
   * mark until it is decided in the exam window's Integrity tab. Drawn on the
   * assessment's line whether or not anything was handed in. Nothing here is
   * sent to the student.
   */
  const caseState = (entry) => {
    const state = entry.state ?? "open";
    if (state === "open") return "open — the mark is held";
    if (state === "cleared") return "cleared — the mark counts";
    return (
      "upheld — " +
      ({ no_penalty: "no penalty", adjusted: "mark adjusted", zero: "the mark is 0", voided: "voided, out of the total" }[entry.outcome] ??
        String(entry.outcome))
    );
  };
  const integrityPart = (assessmentId, studentId) => {
    // Presses that fill the note with what is usually seen; each adds a line,
    // and the note stays editable before the case is opened.
    const OPEN_REASONS = [
      "Copied from another student's paper",
      "Same unusual mistakes as another paper",
      "Unauthorised notes or phone during the exam",
      "Answers taken from the internet or another source",
      "AI-generated work, not disclosed",
      "Shared answers with another student",
      "Someone else did the work or sat the exam",
    ];
    const submission = { assessment_id: assessmentId, student_id: studentId };
    const mine = runCases.filter(
      (entry) => entry.student_id === studentId && (entry.assessments ?? []).includes(assessmentId),
    );
    const open = mine.some((entry) => (entry.state ?? "open") === "open");
    const opener = open
      ? ""
      : '<details class="dc integrity"><summary>Open an integrity case</summary>' +
        '<div class="rgb">' + presetChips(OPEN_REASONS) + '<textarea data-ic-note rows="3" maxlength="2000" ' +
        'placeholder="What you saw — private, never sent to the student"></textarea>' +
        '<button type="button" class="chip act" data-ic-open="' + escapeText(submission.assessment_id) +
        '" data-student="' + escapeText(submission.student_id) + '">Open a case</button>' +
        '<p class="dim">The mark is held, and kept off the curve, until you decide the case in the exam window’s Integrity tab.</p></div></details>';
    if (!mine.length) return opener;
    return part(
      "Integrity",
      mine
        .map(
          (entry) =>
            '<div class="icl' + ((entry.state ?? "open") === "open" ? " on" : "") + '"><b>' + escapeText(entry.case_id) + "</b> " +
            escapeText(caseState(entry)) +
            (entry.note ? ' <details class="icn"><summary>note</summary>' + escapeText(String(entry.note)) + "</details>" : "") +
            "</div>",
        )
        .join("") + opener,
    );
  };

  /*
   * A paper exam's hand-in: what was read off the paper and the paper itself,
   * as two tabs — Answers first, Scans one press away. The pages are the
   * Grade view's own route, so the first page is drawn from below the name
   * line unless names are on. `loading="lazy"` inside a hidden tab: nothing is
   * drawn until Scans is pressed.
   */
  const answersAndScans = (submission, responses, pages) => {
    const student = String(submission.student_id);
    const src = (n) =>
      `${origin}${BASE}/api/grade/page?run=` + encodeURIComponent(runId) + "&assessment=" + encodeURIComponent(submission.assessment_id) +
      "&student=" + encodeURIComponent(student) + "&page=" + n + (people ? "&names=1" : "") +
      (sessionId ? "&session=" + encodeURIComponent(sessionId) : "");
    const tab = (key, text, count, on) =>
      '<button type="button" class="tb" data-tab="' + key + '" aria-pressed="' + String(on) + '">' + escapeText(text) +
      ' <span class="dim">' + count + "</span></button>";
    const scans = Array.from({ length: pages }, (_, i) =>
      '<figure class="pg"><img loading="lazy" alt="Page ' + (i + 1) + '" src="' + escapeText(src(i + 1)) + '">' +
      '<figcaption class="dim">page ' + (i + 1) + (i === 0 && !people ? " · name line hidden" : "") + "</figcaption></figure>",
    ).join("");
    return (
      '<div class="part tabs"><div class="tbs">' +
      tab("answers", "Answers", responses.length, true) +
      tab("scans", "Scans", pages, false) +
      "</div>" +
      '<div class="tp" data-pane="answers">' +
      (responses.length ? responses.map(answer).join("") : '<p class="dim">No answers read off the paper yet.</p>') +
      "</div>" +
      '<div class="tp" data-pane="scans" hidden>' + scans + "</div></div>"
    );
  };

  /**
   * One hand-in, in full, in the order a professor works through it: the
   * defence (recording, verdict, rubric check), the repository, then what was
   * written, then how the mark moved. `picker` is the fork picker for the
   * latest hand-in when it has no repository — *Audio defence* records the
   * whole conversation without one, so the fork stays optional.
   */
  const submissionSection = (submission, graded, picker) => {
    const responses = (responsesOf.get(submission.submission_id) ?? [])
      .slice()
      .sort((a, b) => {
        const left = itemById.get(a.item_id);
        const right = itemById.get(b.item_id);
        // By the number the student saw, and by id where a question has
        // none: the order on the paper is the order to read them in.
        return (
          (left && left.number ? left.number : 0) - (right && right.number ? right.number : 0) ||
          String(a.item_id).localeCompare(String(b.item_id))
        );
      });
    const files = Array.isArray(submission.files) ? submission.files : [];
    const scanPages = piles.get(submission.assessment_id)?.pages?.get(String(submission.student_id)) ?? 0;
    // When, which attempt, in what state — the id is the hover, not the line:
    // it is for typing back into a command, not for reading.
    const facts = [
      submission.submitted_at ? "handed in " + stamp(submission.submitted_at) : "",
      submission.status && submission.status !== "submitted" ? String(submission.status) : "",
      submission.attempt && submission.attempt > 1 ? "attempt " + submission.attempt : "",
    ].filter(Boolean);
    return (
      '<section class="sub" title="' + escapeText(submission.submission_id) + '">' +
      (facts.length ? '<p class="dim">' + escapeText(facts.join(" · ")) + "</p>" : "") +
      (submission.note ? '<p class="dim">' + escapeText(String(submission.note)) + "</p>" : "") +
      reportLine(submission) +
      (responses.length || scanPages ? regradeBlock(submission) : "") +
      defencePart(submission) +
      part(
        "Repository",
        submission.url ? repositoryLine(submission) : picker ? '<p class="fork"><span class="dim">None linked</span> ' + picker + "</p>" : "",
      ) +
      (scanPages
        ? answersAndScans(submission, responses, scanPages)
        : part("Answers", responses.map(answer).join(""), responses.length ? String(responses.length) : "")) +
      part("Files", files.map(fileRow).join("")) +
      changesBlock(submission) +
      // Handed in, and nothing to read: a file-only submission whose bytes
      // are elsewhere, or a row created before any answer was recorded. Both
      // are facts, and an empty panel would look broken. A sheet mark is the
      // common case, and "nothing recorded" beside 4 / 4 read as a contradiction.
      (responses.length === 0 && files.length === 0 && !scanPages && !submission.url && !prepared(submission).recorded
        ? '<p class="dim nothing">' +
          (graded ? "Only the mark is recorded — no answers or files." : "Nothing is recorded under this submission — no answers, no files.") +
          "</p>"
        : "") +
      "</section>"
    );
  };

  /*
   * One student's work, one line per assessment.
   *
   * The detail used to repeat the row — the same cells, larger — and put the
   * things a professor does at the foot of it, behind a dropdown of
   * homework. Now each assessment is a line saying where it stands, with
   * what can be done about it on the same line, and what was handed in
   * folded under it. Past-due lines come first; the rest follow under
   * one summary line that counts them.
   *
   * The detail is shown in the drawer (see `drawerScript`). Pressing a line
   * there, or a cell in the row, turns the drawer to that one hand-in: the
   * line alone, its answers, files, fork and defence. Answers stay closed
   * until then, for the reason the whole detail does: this pane is projected.
   */
  const headOf = (title) => {
    const split = /^(.{1,16}?)\s+[-–—:]\s+(.+)$/.exec(title);
    return split
      ? '<span class="iname">' + escapeText(split[1]) + '</span> <span class="dim">' + escapeText(split[2]) + "</span>"
      : '<span class="iname">' + escapeText(title) + "</span>";
  };
  const itemsOf = (studentId, standing) => {
    const list = submissionsOf.get(studentId) ?? [];
    const of = (id) => list.filter((entry) => entry.assessment_id === id);
    const items = weighted.map((a) => ({
      assessment: assessmentTitles.get(a.assessment_id) ?? a,
      cell: standing ? standing.cells.get(a.assessment_id) : null,
      subs: of(a.assessment_id),
    }));
    // What carries no weight still has a line when there is work under it,
    // or when it is homework a fork could still be brought for.
    for (const assessment of assessmentTitles.values()) {
      if (weighted.some((a) => a.assessment_id === assessment.assessment_id)) continue;
      const subs = of(assessment.assessment_id);
      if (subs.length || defensibleAssessment(assessment)) items.push({ assessment, cell: null, subs });
    }
    return items.map((item) => {
      const due = item.assessment.due_at ? Date.parse(item.assessment.due_at) : NaN;
      const state = item.cell
        ? item.cell.state
        : item.subs.length
          ? "in"
          : Number.isFinite(due) && due < now
            ? "missing"
            : "ahead";
      return { ...item, due, state };
    });
  };
  const itemLine = (item, studentId) => {
    const { assessment, cell, subs, due, state } = item;
    const id = assessment.assessment_id;
    const latest = subs[subs.length - 1];
    const tag =
      state === "graded"
        ? number(cell.entry.score) + " / " + number(cell.entry.maximum)
        : state === "in"
          ? latest && latest.submitted_at ? "handed in " + stamp(latest.submitted_at) : "handed in"
          : state === "missing"
            ? "missing" + (Number.isFinite(due) ? " · due " + stamp(assessment.due_at) : "")
            : state === "unrecorded"
              ? "not imported"
              : Number.isFinite(due)
                ? "due " + stamp(assessment.due_at)
                : "no due date";
    const defensible = defensibleAssessment(assessment);
    /*
     * Nothing handed in: the fork and the audio defence, drawn only once the
     * line is the drawer's one hand-in. On the student's list it is a single
     * *Bring it in…* — three lines of a class-wide fork list stacked under one
     * student was the loudest thing in the panel and the least often used.
     */
    const bring =
      !subs.length && defensible && (state === "missing" || state === "ahead" || state === "unrecorded");
    const actions = bring
      ? '<button type="button" class="chip bring" data-bring>Bring it in…</button>' +
        '<span class="ione">' + forkPicker(id, studentId) +
        ' <button type="button" class="chip act" data-audio-new data-assessment="' + escapeText(id) +
        '" data-student="' + escapeText(studentId) + '" title="Defended in person, nothing handed in">Audio defence</button></span>'
      : "";
    // Handed in without a repository — a sheet mark, a Canvas text entry: the
    // link can still be brought, in the latest hand-in's Repository part.
    // The integrity part comes first and once per assessment, handed in or
    // not: a paper taken in the room, or one never imported, can be under a case.
    const body =
      integrityPart(id, studentId) +
      subs
      .map((submission) =>
        submissionSection(
          submission,
          state === "graded",
          submission === latest && !latest.url && defensible ? forkPicker(id, studentId) : "",
        ),
      )
      .join("");
    const head = headOf(assessment.title ?? id);
    return (
      '<div class="it" data-it="' + escapeText(id) + '">' +
      '<button type="button" class="ih" title="' + escapeText(id) + '">' + head + "</button>" +
      '<span class="is"><span class="tag ' + state + '">' + escapeText(tag) + "</span></span>" +
      '<span class="ia">' + actions + "</span>" +
      (body ? '<div class="ib">' + body + "</div>" : "") +
      "</div>"
    );
  };
  const workPanel = (entry, standing) => {
    const studentId = String(entry.student_id ?? "");
    const items = itemsOf(studentId, standing);
    if (!items.length) return "";
    const due = items.filter((item) => item.state === "missing");
    const rest = items.filter((item) => item.state !== "missing");
    const count = (state) => rest.filter((item) => item.state === state).length;
    const folded = [
      count("graded") ? count("graded") + " graded" : "",
      count("in") ? count("in") + " awaiting grading" : "",
      count("unrecorded") ? count("unrecorded") + " not imported" : "",
      count("ahead") ? count("ahead") + " not yet due" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      '<div class="items" data-work="' + escapeText(studentId) + '">' +
      (due.length ? '<p class="ihd">Past due</p>' + due.map((item) => itemLine(item, studentId)).join("") : "") +
      (rest.length
        ? // Open: the drawer has the height an inline panel did not, and the
          // whole list is what a row press is for. The summary still counts it.
          '<details class="more" open><summary>' + escapeText(folded) + "</summary>" +
          rest.map((item) => itemLine(item, studentId)).join("") +
          "</details>"
        : "") +
      "</div>"
    );
  };

  /** The one sentence a detail opens with: what is in, what is late, what is marked. */
  const summaryOf = (studentId, standing) => {
    const handed = (submissionsOf.get(studentId) ?? []).length;
    const row = totals.get(studentId);
    const counted = row ? (row.assessments_counted ?? []).length : 0;
    return [
      handed ? escapeText(handed + " handed in") : "Nothing handed in yet",
      standing && standing.missing ? '<span class="todo">' + standing.missing + " past due</span>" : "",
      counted ? escapeText(gradedLine(studentId)) : "nothing graded",
      standing && standing.waiting ? escapeText(standing.waiting + " awaiting grading") : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  /**
   * One student: their row, where they stand, and their folded work, in one
   * element the sort and the filters move or hide as a unit — so an open work
   * panel can never be left behind under somebody else's name.
   */
  const student = (entry, dimmed) => {
    const id = String(entry.student_id ?? "");
    const standing = dimmed || !weighted.length ? null : standingOf(id);
    const pace = dimmed ? null : paceOf(id);
    const person = people ? people[id] : null;
    const named = person && typeof person.name === "string" ? person.name.trim() : "";
    // The grade sheet's note about this person, kept beside their name in the
    // roster and shown only with it: it is about them, not about their work.
    const flag = named && person.sheet_flags && typeof person.sheet_flags[runId] === "string" ? person.sheet_flags[runId] : "";
    // What the last roster sync found in Canvas: a pseudonym's fact, not a
    // name's, so it shows on every row. Gone from Canvas is a chip by the name;
    // back again is only the sentence, in the detail.
    const lms = entry.lms && typeof entry.lms.note === "string" ? entry.lms : null;
    const gone = lms && lms.in_course === false;
    const low = pace !== null && pace < PASS;

    /*
     * The bar: 0 to 100, the stretch the course can still end anywhere in, a
     * tick where this pace lands, and a faint line at the pass mark. Warm only
     * when the pace is under it — a floor of 9.8 in week five is everyone's,
     * and colouring floors would colour the whole list.
     */
    const bar =
      standing && standing.floor !== null
        ? '<span class="bar" title="Final can still land ' + number(standing.floor) + " – " + number(standing.ceiling) +
          ' / 100"><span class="pass" style="left:' + PASS + '%"></span>' +
          '<span class="span" style="left:' + number(standing.floor) + "%;width:" +
          number(Math.max(0, standing.ceiling - standing.floor)) + '%"></span>' +
          (pace !== null ? '<span class="tick' + (low ? " low" : "") + '" style="left:' + number(Math.min(100, pace)) + '%"></span>' : "") +
          '<span class="ends"><span>' + number(standing.floor) + "</span><span>" + number(standing.ceiling) + "</span></span>" +
          "</span>"
        : '<span class="dim">—</span>';

    // Hidden under the row and moved into the drawer when the row is pressed,
    // closed on load: this pane is projected. One sentence, then a line per
    // assessment — the row's strip is not repeated.
    // The pseudonym sits at the end, quiet: it is the identifier every other
    // surface uses, so a named row must still lead to it.
    const detail = dimmed
      ? ""
      : '<div class="detail" hidden><p class="sum">' +
        summaryOf(id, standing) +
        (entry.role && entry.role !== "student" ? " · " + escapeText(entry.role) : "") +
        (named ? '<code class="pid">' + escapeText(id) + "</code>" : "") +
        "</p>" +
        (lms ? '<p class="dim">' + escapeText(lms.note) + "</p>" : "") +
        (standing ? standingBlock(id, standing) : "") +
        workPanel(entry, standing) +
        "</div>";

    return (
      // The group travels with the student so the filter can act on a
      // departed one too: they belonged to a subgroup while they were here.
      '<div class="st" data-group="' +
      escapeText(label(entry)) +
      '" data-name="' +
      escapeText(sortKey(entry)) +
      '" data-find="' +
      escapeText((sortKey(entry) + " " + id).toLowerCase()) +
      '" data-missing="' +
      (standing ? standing.missing : 0) +
      // Unknown sorts last under "lowest first", not first: a student with
      // nothing graded is not the weakest in the class.
      '" data-share="' +
      (pace !== null ? pace : 999) +
      '" data-floor="' +
      (standing && standing.floor !== null ? standing.floor : 999) +
      '" data-attn="' +
      (!dimmed && attentionOf(id, standing) ? "1" : "0") +
      '"><div class="sr' +
      (dimmed ? " gone" : "") +
      '"' +
      (dimmed ? "" : ' role="button" tabindex="0" aria-expanded="false"') +
      ' title="' +
      escapeText(id) +
      '"><span class="nm">' +
      escapeText(named || id) +
      (flag ? ' <span class="todo" title="Noted in the grade sheet">' + escapeText(flag) + "</span>" : "") +
      (gone && !dimmed ? ' <span class="todo" title="' + escapeAttribute(lms.note) + '">not in Canvas</span>' : "") +
      "</span>" +
      '<span class="gr" title="' + escapeText(label(entry)) + '">' + escapeText(shortGroup(label(entry))) + "</span>" +
      (dimmed
        ? '<span class="rest"><span class="todo"' + (lms ? ' title="' + escapeAttribute(lms.note) + '"' : "") + ">" + escapeText(entry.status ?? "inactive") + "</span></span>"
        : bar +
          '<span class="pc' + (low ? " low" : "") + '">' + (pace !== null ? number(pace) : '<span class="dim">—</span>') + "</span>" +
          '<span class="ms">' +
          (standing && standing.missing ? '<span class="todo">' + standing.missing + "</span>" : '<span class="dim">–</span>') +
          "</span>" +
          (standing ? strip(standing, id) : kinds.map(() => "<span></span>").join(""))) +
      "</div>" +
      detail +
      "</div>"
    );
  };

  /*
   * A subgroup as its row shows it. `CSS4007-ENG-8`, `-9` and `-10` differ in
   * the last part only, and the column has room for that part; the full name
   * is the cell's hover and the chip's label.
   */
  const namedGroups = groups.filter((group) => group !== "");
  let shared =
    namedGroups.length > 1
      ? namedGroups.reduce((a, b) => {
          let i = 0;
          while (i < a.length && a[i] === b[i]) i++;
          return a.slice(0, i);
        })
      : "";
  shared = shared.slice(0, Math.max(shared.lastIndexOf("-"), shared.lastIndexOf("_"), shared.lastIndexOf(" ")) + 1);
  const shortGroup = (group) => (shared && group.startsWith(shared) ? group.slice(shared.length) : group);

  /*
   * Sort by what is on screen.
   *
   * With names off that is the pseudonym, which is the order every other
   * surface uses. With names on, a list ordered by pseudonym is a shuffled
   * list — the derivation is a hash, so it has no relation to anything a
   * professor can scan for. Falling back to the pseudonym keeps someone the
   * store does not know from floating to an arbitrary place in the list.
   */
  const sortKey = (entry) => {
    const person = people ? people[entry.student_id] : null;
    const name = person && typeof person.name === "string" ? person.name.trim() : "";
    return name || String(entry.student_id ?? "");
  };
  const byDisplayed = (a, b) => sortKey(a).localeCompare(sortKey(b));

  /*
   * One list, not a section per subgroup. The group is a column and a filter
   * now; sectioning by it made "who is lowest across the class" a question
   * the screen could not answer without three scrolls and a memory.
   */
  const list =
    '<div class="tbl" id="list" style="--cols:' + columns + '">' +
    (weighted.length
      ? '<div class="th">' +
        '<button type="button" data-sort="name" aria-pressed="true">Student</button>' +
        "<span>Group</span>" +
        '<button type="button" data-sort="floor" aria-pressed="false" title="Where the final can still land, lowest floor first">Final range</button>' +
        '<button type="button" data-sort="share" aria-pressed="false" title="Share of graded work, lowest first">Pace</button>' +
        '<button type="button" data-sort="missing" aria-pressed="false" title="Most missing first">Missing</button>' +
        kinds
          .map(
            (kind) =>
              '<span class="kh"><span class="kn">' +
              escapeText(kind.label) +
              '</span><span class="sk">' +
              kind.assessments
                .map(
                  (a, i) =>
                    '<button type="button" class="n" data-aw="' + escapeText(a.assessment_id) + '" title="' +
                    escapeText((a.title ?? a.assessment_id) + " — press for the class's results") + '">' + escapeText(shortOf(a, i)) + "</button>",
                )
                .join("") +
              "</span></span>",
          )
          .join("") +
        "</div>"
      : "") +
    active.slice().sort(byDisplayed).map((entry) => student(entry, false)).join("") +
    "</div>";

  /*
   * The window a header number opens: that assessment across the active
   * class, from the same cells the rows draw, the rubric's questions with
   * their decided marks, and — for a paper exam — its pile's standing.
   */
  const rubrics = allRubrics(bundle);
  const standings = new Map(active.map((entry) => [String(entry.student_id ?? ""), standingOf(String(entry.student_id ?? ""))]));
  const assessmentPanels = weighted.map((a) => {
    const record = (bundle.assessments ?? []).find((entry) => entry.assessment_id === a.assessment_id) ?? a;
    const rubric = rubrics.get(record.rubric_id ?? record.rubric?.rubric_id ?? "") ?? null;
    const handed = (bundle.submissions ?? []).filter((entry) => entry.assessment_id === a.assessment_id);
    const subs = new Set(handed.map((entry) => entry.submission_id));
    const scanned = piles.has(a.assessment_id);
    return windowPanel(
      summarise({
        assessment: { ...record, weight: a.weight ?? record.weight, due_at: a.due_at ?? record.due_at },
        cells: active.map((entry) => {
          const id = String(entry.student_id ?? "");
          const cell = standings.get(id).cells.get(a.assessment_id);
          return { student: id, group: label(entry), state: cell.state, entry: cell.entry };
        }),
        criteria: rubric?.criteria ?? [],
        evaluations: (bundle.evaluations ?? []).filter((entry) => subs.has(entry.submission_id)),
        pile: piles.get(a.assessment_id) ?? null,
        names: Boolean(people),
        items: (bundle.items ?? []).filter((entry) => entry.assessment_id === a.assessment_id),
        responses: (bundle.item_responses ?? []).filter((entry) => subs.has(entry.submission_id)),
        submissions: handed,
        cases: runCases.filter((entry) => (entry.assessments ?? []).includes(a.assessment_id)),
      }),
      {
        nameOf: (id) => (people && typeof people[id]?.name === "string" && people[id].name.trim() ? people[id].name.trim() : id),
        when: stamp,
        reports: (() => {
          const reports = reportsOf.get(a.assessment_id);
          const students = Object.entries(reports?.manifest.students ?? {});
          return {
            made: Boolean(reports),
            madeAt: reports?.manifest.class_made_at ?? null,
            count: students.length,
            ready: students.filter(([, entry]) => entry.status === "graded").length,
            sent: Object.keys(reports?.sent ?? {}).length,
            // The class report names everyone: only with names on.
            classUrl: reports?.classPdf && people ? reportUrl(a.assessment_id, "class") : null,
            hidden: Boolean(reports?.classPdf) && !people,
          };
        })(),
        // The top of the paper is the handwritten name: only with names on.
        crop: (paper) =>
          people
            ? `${origin}${BASE}/api/scans/crop?run=` + encodeURIComponent(runId) + "&assessment=" + encodeURIComponent(a.assessment_id) +
              "&file=" + encodeURIComponent(paper.file) + "&pages=" + encodeURIComponent(paper.pages) +
              (sessionId ? "&session=" + encodeURIComponent(sessionId) : "")
            : null,
        // The Grade view's own page route; the page carries the name, so it
        // is drawn with names only when they are on.
        page: (student, n) =>
          scanned
            ? `${origin}${BASE}/api/grade/page?run=` + encodeURIComponent(runId) + "&assessment=" + encodeURIComponent(a.assessment_id) +
              "&student=" + encodeURIComponent(student) + "&page=" + encodeURIComponent(n) + (people ? "&names=1" : "") +
              (sessionId ? "&session=" + encodeURIComponent(sessionId) : "")
            : null,
      },
    );
  });
  const assessmentWindow = weighted.length ? assessmentDialog(assessmentPanels) : "";

  const departed = inactive.length
    ? '<section class="tbl" data-departed="1" style="--cols:' + columns + '"><h2>No longer active</h2>' +
      inactive
        .slice()
        .sort(byDisplayed)
        .map((entry) => student(entry, true))
        .join("") +
      "</section>"
    : "";

  /*
   * The four numbers read before the list is: how many, where the middle of
   * the class is heading, how many are heading under the line, and how many
   * owe work. "Owe" excludes the unrecorded — see `unrecorded` above.
   */
  const paces = active.map((entry) => paceOf(String(entry.student_id ?? ""))).filter((pace) => pace !== null).sort((a, b) => a - b);
  const median = paces.length
    ? paces.length % 2
      ? paces[(paces.length - 1) / 2]
      : (paces[paces.length / 2 - 1] + paces[paces.length / 2]) / 2
    : null;
  const below = paces.filter((pace) => pace < PASS).length;
  const tile = (label, value, warm) =>
    '<div class="tile"><div class="dim">' + label + '</div><div class="tv' + (warm ? " low" : "") + '">' + value + "</div></div>";
  const tiles =
    '<div class="tiles">' +
    tile("Active", escapeText(String(active.length)) + (inactive.length ? '<span class="dim"> · ' + inactive.length + " left</span>" : ""), false) +
    (weighted.length
      ? tile("Median at this pace", median === null ? "—" : number(median), false) +
        tile("Below " + PASS + " at this pace", String(below), below > 0) +
        tile("Owe past-due work", String(behind), behind > 0)
      : "") +
    "</div>";

  /*
   * What is wrong with the DATA rather than with a student, said once.
   *
   * These were four stacked paragraphs; the professor read them every load
   * and acted on them once. One line each, the action at the end of it.
   */
  const sheet = loadSheetConfig(runId);
  const titleOf = (id) => (weighted.find((a) => a.assessment_id === id) ?? {}).title ?? id;
  const health = [
    unrecorded.size
      ? '<p class="hw">' +
        [...unrecorded].length +
        (unrecorded.size === 1 ? " assessment is" : " assessments are") +
        " past due with no hand-ins imported for anyone, so drawn as unknown, not missing: " +
        [...unrecorded].map((id) => escapeText(titleOf(id))).join(", ") +
        ". Bring them in with <code>ainar lms import-submissions " +
        escapeText(runId) +
        " --assessment …</code></p>"
      : "",
    /*
     * The professor's own grade sheet, when the run has one (`ainar homework
     * sheet`). Synced from the Syncs view, which the press opens; that view
     * reads the sheet directly where this machine has a Google login, and
     * otherwise takes the file the professor downloads. The column mapping
     * lives there too, and is this line's hover.
     */
    sheet
      ? '<p class="dim" title="' +
        escapeText(
          Object.entries(sheet.columns)
            .map(([column, id]) => column + " → " + titleOf(id))
            .join("\n"),
        ) +
        '">Grade sheet ' +
        (sheet.synced_at ? "last synced " + escapeText(stamp(sheet.synced_at)) : "never synced") +
        ' <button type="button" class="chip" data-syncs title="Integrations → Syncs">Sync from sheet</button></p>'
      : "",
    synthetic
      ? '<p class="dim">Read from <code>samples/</code>: synthetic fixtures, not the roster. Real enrollments come from Supabase.</p>'
      : "",
    withNames && people === null
      ? '<p class="hw"><b>No names available.</b> There is no roster store at <code>' +
        escapeText(rosterPath()) +
        "</code>. Import a class list with <code>ainar roster import export.csv --run " +
        escapeText(runId) +
        "</code>, or point <code>AINAR_ROSTER_DIR</code> at the directory holding it.</p>"
      : "",
  ].join("");

  /*
   * Which identity state this render is in, at the end of the toolbar where
   * the eye lands after a filter. Names are the normal state, so a coloured
   * word rather than a band: an alarm on every load is wallpaper within a week.
   */
  const identity = !withNames
    ? '<span class="idn dim">Pseudonyms — safe to share</span>'
    : people === null
      ? ""
      : '<span class="idn named" title="Press Pseudonyms above before screen-sharing or projecting this">Real names on screen</span>';

  /*
   * The toolbar, filtering in the page rather than refetching: the groups are
   * the run's, a refetch would rebuild what is already on screen, and the
   * professor switching subgroups in a meeting wants it at the speed of a
   * click. Group chips only when there is something to choose between.
   */
  const chip = (value, text, count, pressed) =>
    '<button type="button" class="chip" data-filter="' +
    escapeText(value) +
    '" aria-pressed="' +
    (pressed ? "true" : "false") +
    '">' +
    escapeText(text) +
    ' <span class="dim">' +
    escapeText(String(count)) +
    "</span></button>";
  const groupChips =
    groups.length > 1
      ? chip("*", "All", active.length, true) +
        groups
          .map((group) =>
            chip(group, group === "" ? "No subgroup" : group, active.filter((entry) => label(entry) === group).length, false),
          )
          .join("")
      : "";
  const attention = active.filter((entry) => {
    const id = String(entry.student_id ?? "");
    return attentionOf(id, weighted.length ? standingOf(id) : null);
  }).length;
  const filterBar =
    '<div class="chips tools">' +
    '<input type="search" class="find" placeholder="Find a student" aria-label="Find a student">' +
    groupChips +
    (attention
      ? '<button type="button" class="chip" data-attn-only aria-pressed="false" title="Work past due, or under ' +
        PASS +
        ' at this pace">Needs attention <span class="dim">' +
        attention +
        "</span></button>"
      : "") +
    '<span class="shown dim"></span>' +
    identity +
    "</div>";

  const header = "<section>" + tiles + (health ? '<div class="health">' + health + "</div>" : "") + refusedHtml + "</section>";

  const legend = weighted.length
    ? '<p class="legend dim"><span class="m graded"></span>graded <span class="m in"></span>handed in ' +
      '<span class="m missing"></span>missing <span class="m unrecorded"></span>not imported <span class="m ahead"></span>not due' +
      (hasCases ? ' <span class="m held"></span>held by an integrity case' : "") +
      " · " +
      "press a row for the student, a cell for that hand-in · ↑ ↓ next student, ← → next assessment</p>"
    : "";

  /*
   * Filter, search and sort, as DOM toggling.
   *
   * `hidden` rather than a class, so a filtered row is out of the
   * accessibility tree as well as off the screen. The departed list filters
   * by group and search and drops out under "Needs attention" — nobody who
   * left owes work. Pressing a row is the drawer's (`drawerScript`).
   */
  const filterScript =
    "<script>(function(){" +
    "var chips=[].slice.call(document.querySelectorAll('.chip[data-filter]'));" +
    "var sorts=[].slice.call(document.querySelectorAll('.th [data-sort]'));" +
    "var only=document.querySelector('.chip[data-attn-only]');" +
    "var find=document.querySelector('.find');var shown=document.querySelector('.shown');" +
    "var box=document.getElementById('list');var gone=document.querySelector('section[data-departed]');" +
    "var want='*',attn=false,q='';" +
    "function apply(){" +
    "chips.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.filter===want));});" +
    "if(only)only.setAttribute('aria-pressed',String(attn));" +
    "var all=0,seen=0;" +
    "[].forEach.call(box.querySelectorAll('.st'),function(r){all++;" +
    "var off=(want!=='*'&&r.dataset.group!==want)||(attn&&r.dataset.attn!=='1')||(q&&r.dataset.find.indexOf(q)<0);" +
    "r.hidden=off;if(!off)seen++;});" +
    "if(shown)shown.textContent=seen===all?'':seen+' of '+all;" +
    "if(gone){var left=0;[].forEach.call(gone.querySelectorAll('.st'),function(r){" +
    "var off=attn||(want!=='*'&&r.dataset.group!==want)||(q&&r.dataset.find.indexOf(q)<0);r.hidden=off;if(!off)left++;});" +
    "gone.hidden=left===0;}}" +
    "function order(by){" +
    "sorts.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.sort===by));});" +
    "var list=[].slice.call(box.querySelectorAll('.st'));" +
    "list.sort(function(a,b){var d=0;" +
    "if(by==='missing')d=Number(b.dataset.missing)-Number(a.dataset.missing);" +
    "else if(by==='share'||by==='floor')d=Number(a.dataset[by])-Number(b.dataset[by]);" +
    "return d||a.dataset.name.localeCompare(b.dataset.name);});" +
    "list.forEach(function(r){box.appendChild(r);});}" +
    "chips.forEach(function(c){c.addEventListener('click',function(){want=c.dataset.filter;apply();});});" +
    "if(only)only.addEventListener('click',function(){attn=!attn;apply();});" +
    "if(find)find.addEventListener('input',function(){q=find.value.trim().toLowerCase();apply();});" +
    "sorts.forEach(function(c){c.addEventListener('click',function(){order(c.dataset.sort);});});" +
    "})();</script>";

  /*
   * The drawer: one student, or one of their hand-ins, beside the list.
   *
   * It used to open inline under the row, and that pushed the row's own
   * cells off screen — the next homework of the same student was a scroll
   * up, the same homework of the next student was close, find, open. The
   * drawer keeps the list where it is and the pressed row and column lit.
   *
   * A row shows the student: the summary, where they stand, a line per
   * assessment. A cell, or a line in the drawer, shows that one hand-in.
   * ↑ ↓ walk the visible list in its current sort and filter, keeping the
   * assessment when there is one — one homework through the class — and
   * ← → walk the student's assessments in the row's order. Esc steps back
   * out of a hand-in, then closes.
   *
   * The student's `.detail` is MOVED into the drawer, not copied, and moved
   * back on close: a half-typed fork link or an open rubric check survives
   * stepping out and in, and the detail is found inside the student's own
   * `.st`, so a reordered list cannot open the wrong person's work. Every
   * line's answers are rendered here and hidden by the stylesheet until the
   * drawer is turned to that line — out of the accessibility tree as well,
   * so a screen reader running down a class list does not read every
   * student's answers aloud.
   *
   * The fork picker's small presses (`paste a link`, the select's last
   * option) reveal its link field; its filter box narrows the select.
   */
  const drawer =
    '<aside class="drawer" hidden tabindex="-1" role="dialog" aria-labelledby="dwt">' +
    '<div class="dwh">' +
    '<button type="button" class="dwk" data-dw="back" title="Back to the student (Esc)" hidden>‹</button>' +
    '<div class="dwt" id="dwt"></div>' +
    '<button type="button" class="dwk" data-dw="left" title="Previous assessment (←)" hidden>←</button>' +
    '<button type="button" class="dwk" data-dw="right" title="Next assessment (→)" hidden>→</button>' +
    '<button type="button" class="dwk" data-dw="up" title="Previous student (↑)">↑</button>' +
    '<button type="button" class="dwk" data-dw="down" title="Next student (↓)">↓</button>' +
    '<button type="button" class="dwk" data-dw="close" aria-label="Close" title="Close (Esc)">×</button>' +
    "</div>" +
    '<div class="dwbody"></div>' +
    "</aside>";
  const drawerScript =
    "<script>(function(){" +
    "var dw=document.querySelector('.drawer'),body=dw.querySelector('.dwbody'),title=document.getElementById('dwt')," +
    "box=document.getElementById('list'),cur=null;" +
    "function all(s,el){return [].slice.call((el||document).querySelectorAll(s));}" +
    "function rows(){return all('.st',box).filter(function(s){return !s.hidden&&s.querySelector('.sr[role=button]');});}" +
    "function lineOf(d,a){var f=null;all('[data-it]',d).forEach(function(x){if(x.getAttribute('data-it')===a)f=x;});return f;}" +
    // The row's order first, so → is the next cell along; then what only the detail lists.
    "function ids(){var out=all('[data-hw]',cur.st.querySelector('.sr')).map(function(c){return c.getAttribute('data-hw');});" +
    "all('[data-it]',cur.d).forEach(function(x){var a=x.getAttribute('data-it');if(out.indexOf(a)<0)out.push(a);});" +
    "return out.filter(function(a){return lineOf(cur.d,a);});}" +
    "function unlight(){all('.lit').forEach(function(x){x.classList.remove('lit');});}" +
    "function light(a){unlight();var r=cur.st.querySelector('.sr');r.classList.add('lit');if(!a)return;" +
    "var cells=all('[data-hw]',r),i=-1;cells.forEach(function(c,k){if(c.getAttribute('data-hw')===a)i=k;});if(i<0)return;" +
    "cells[i].classList.add('lit');var n=all('.th .n')[i];if(n)n.classList.add('lit');" +
    "cells[i].scrollIntoView({block:'nearest',inline:'nearest'});}" +
    "function park(){if(!cur)return;all('.it.on',cur.d).forEach(function(x){x.classList.remove('on');});" +
    "cur.d.hidden=true;cur.st.appendChild(cur.d);cur.st.querySelector('.sr').setAttribute('aria-expanded','false');unlight();cur=null;}" +
    "function show(st,a){" +
    "if(!cur||cur.st!==st){park();var d=st.querySelector('.detail');if(!d)return;" +
    "body.appendChild(d);d.hidden=false;cur={st:st,d:d,a:null};st.querySelector('.sr').setAttribute('aria-expanded','true');}" +
    "var line=a?lineOf(cur.d,a):null;if(!line)a=null;" +
    "all('.it.on',cur.d).forEach(function(x){x.classList.remove('on');});cur.a=a;dw.classList.toggle('one',!!line);" +
    "document.body.classList.toggle('dwone',!!line);" +
    "if(line){line.classList.add('on');var m=line.closest('details');if(m)m.open=true;}" +
    "var nm=st.querySelector('.nm');title.textContent=nm&&nm.firstChild?nm.firstChild.textContent:'';" +
    "if(line){var s=document.createElement('span');s.className='dim';s.textContent=' \\u203a ';title.appendChild(s);" +
    "var b=document.createElement('b');b.textContent=line.querySelector('.ih').textContent.trim();title.appendChild(b);}" +
    "['back','left','right'].forEach(function(k){dw.querySelector('[data-dw='+k+']').hidden=!line;});" +
    "dw.hidden=false;document.body.classList.add('dwopen');light(a);" +
    "st.querySelector('.sr').scrollIntoView({block:'nearest'});body.scrollTop=0;" +
    "if(!dw.contains(document.activeElement))dw.focus({preventScroll:true});}" +
    "function close(){var st=cur&&cur.st;park();dw.hidden=true;dw.classList.remove('one');document.body.classList.remove('dwopen','dwone');" +
    "if(st)st.querySelector('.sr').focus({preventScroll:true});}" +
    "function step(by){if(!cur)return;var list=rows(),n=list[list.indexOf(cur.st)+by];if(n)show(n,cur.a);}" +
    "function side(by){if(!cur||!cur.a)return;var list=ids(),n=list[list.indexOf(cur.a)+by];if(n)show(cur.st,n);}" +
    // Back to the student, the line just left marked for a moment.
    "function back(){if(!cur)return;var a=cur.a;show(cur.st,null);var l=a&&lineOf(cur.d,a);if(!l)return;" +
    "var m=l.closest('details');if(m)m.open=true;l.scrollIntoView({block:'nearest'});" +
    "l.classList.remove('flash');void l.offsetWidth;l.classList.add('flash');}" +
    "function reveal(fp){var i=fp.querySelector('input.fk'),s=fp.querySelector('button[data-fork]');" +
    "if(i){i.hidden=false;i.focus();}if(s)s.hidden=false;}" +
    "var ACT={close:close,back:back,up:function(){step(-1);},down:function(){step(1);},left:function(){side(-1);},right:function(){side(1);}};" +
    "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;" +
    "var k=t.closest('[data-dw]');if(k){ACT[k.getAttribute('data-dw')]();return;}" +
    "var p=t.closest('[data-paste]');if(p){var fp=p.closest('.fp');if(fp)reveal(fp);return;}" +
    // Answers / Scans: the pressed tab's pane shown, the other hidden.
    "var tb=t.closest('[data-tab]');if(tb){var g=tb.closest('.tabs'),w=tb.getAttribute('data-tab');" +
    "all('[data-tab]',g).forEach(function(x){x.setAttribute('aria-pressed',String(x===tb));});" +
    "all('[data-pane]',g).forEach(function(x){x.hidden=x.getAttribute('data-pane')!==w;});return;}" +
    "var c=t.closest('[data-hw]');if(c){var cs=c.closest('.st'),ca=c.getAttribute('data-hw');" +
    "if(cur&&cur.st===cs&&cur.a===ca)close();else show(cs,ca);return;}" +
    "if(cur&&dw.contains(t)){var it=t.closest('.it');" +
    "if(it&&!cur.a&&(t.closest('[data-bring],button.ih')||!t.closest('a,button,input,select,textarea,label,summary')))show(cur.st,it.getAttribute('data-it'));" +
    "return;}" +
    "var r=t.closest('.sr[role=button]');if(!r||t.closest('a,button,input,select'))return;" +
    "var st=r.closest('.st');if(cur&&cur.st===st&&!cur.a)close();else show(st,null);});" +
    "document.addEventListener('change',function(e){var s=e.target;if(!s.matches||!s.matches('select.fks'))return;" +
    "var fp=s.closest('.fp'),i=fp&&fp.querySelector('input.fk');if(!i)return;" +
    "if(s.value==='paste')reveal(fp);else i.hidden=true;});" +
    "document.addEventListener('input',function(e){var f=e.target;if(!f.matches||!f.matches('input.fkq'))return;" +
    "var s=f.parentNode.querySelector('select.fks'),w=f.value.trim().toLowerCase();if(!s)return;" +
    "all('option',s).forEach(function(o){if(o.value&&o.value!=='paste')o.hidden=!!w&&o.textContent.toLowerCase().indexOf(w)<0;});" +
    "all('optgroup',s).forEach(function(g){g.hidden=!all('option',g).some(function(o){return !o.hidden;});});});" +
    "document.addEventListener('keydown',function(e){var t=e.target;" +
    "if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('[data-hw],.sr[role=button]')){e.preventDefault();t.click();return;}" +
    "if(!cur||(t.closest&&t.closest('input,select,textarea')))return;" +
    "var go={Escape:cur.a?back:close,ArrowUp:ACT.up,ArrowDown:ACT.down,ArrowLeft:cur.a?ACT.left:null,ArrowRight:cur.a?ACT.right:null}[e.key];" +
    "if(go){e.preventDefault();go();}});" +
    "})();</script>";

  /*
   * What the detail needs that `documentPage` does not have.
   *
   * The `[hidden]` rules are the ones that are not cosmetic: an author
   * `display` beats the user agent's `[hidden]{display:none}`, so a line's
   * hand-in or a fork field given `display` here without them would be open
   * on load — the one state this view must never boot into.
   */
  const workStyle =
    "<style>" +
    "[data-hw]{cursor:pointer}" +
    "[data-hw]:hover,[data-hw]:focus-visible,[data-hw].lit{outline:2px solid var(--accent-line,var(--info));outline-offset:1px}" +
    ".th .n.lit{color:var(--info);font-weight:700}" +
    ".fp [hidden]{display:none}" +
    // The drawer. Its own surface: the page is transparent over the pane's,
    // and a panel over the list must not let the rows show through.
    ":root{--dwbg:#ffffff}" +
    (dark ? ":root{--dwbg:#1e1e1e}" : "@media(prefers-color-scheme:dark){:root{--dwbg:#1e1e1e}}") +
    // A student is a list of lines; one hand-in is answers and pages of
    // handwriting, so the drawer widens when it is turned to one.
    ":root{--dww:min(580px,46vw)}body.dwone{--dww:min(920px,66vw)}" +
    ".drawer{position:fixed;top:0;right:0;bottom:0;width:var(--dww);display:flex;flex-direction:column;" +
    "background:var(--dwbg);border-left:1px solid var(--line);box-shadow:-6px 0 18px rgba(0,0,0,.12);z-index:10;outline:none}" +
    ".drawer[hidden]{display:none}" +
    // Wide enough, the list gives the drawer its room rather than sitting under it.
    "@media(min-width:900px){body.dwopen{padding-right:calc(var(--dww) + 16px)}}" +
    "@media(max-width:899px){.drawer{width:min(640px,100%)}body.dwone .drawer{width:100%}}" +
    // Answers / Scans on a paper exam's hand-in.
    ".tbs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin:0 0 8px}" +
    ".tb{font:inherit;font-size:13px;background:none;border:0;border-bottom:2px solid transparent;padding:5px 12px;color:var(--dim);cursor:pointer;margin-bottom:-1px}" +
    ".tb:hover{color:var(--fg)}.tb[aria-pressed=true]{color:var(--fg);font-weight:600;border-bottom-color:var(--info)}" +
    ".tp[hidden]{display:none}" +
    ".pg{margin:0 0 12px}.pg img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:4px;background:#fff}" +
    ".pg figcaption{font-size:11px;margin-top:3px}" +
    ".rgb{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin:8px 10px}" +
    ".rgb textarea{box-sizing:border-box;width:100%;font:inherit;font-size:13px;resize:vertical}" +
    ".rgb p{margin:0;font-size:12px}" +
    ".dwh{display:flex;align-items:center;gap:4px;padding:8px 10px 8px 14px;border-bottom:1px solid var(--line)}" +
    ".dwt{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".dwt b{font-weight:600}" +
    ".dwk{font:inherit;font-size:14px;line-height:1;min-width:26px;height:26px;padding:0 6px;border:1px solid var(--line);" +
    "border-radius:4px;background:transparent;color:var(--fg);cursor:pointer}" +
    ".dwk:hover{background:var(--infobg)}.dwk[hidden]{display:none}" +
    ".dwk[data-dw=back]{border:0;font-size:20px;padding:0 4px}" +
    ".dwbody{flex:1;min-height:0;overflow:auto;padding:10px 14px 16px}" +
    // A student: every line, no answers. One hand-in: that line, open.
    ".drawer:not(.one) .ib,.drawer:not(.one) .ione,.drawer.one .bring{display:none}" +
    ".drawer.one .sum,.drawer.one .standing,.drawer.one .ihd,.drawer.one .more>summary,.drawer.one .it:not(.on){display:none}" +
    ".drawer.one .it.on{border-top:0;padding:0;cursor:default}" +
    ".drawer.one .it.on .ih{cursor:default;white-space:normal}" +
    ".drawer.one .it.on .ih:hover .iname{text-decoration:none}" +
    ".drawer.one .ione{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
    ".fkq{font:inherit;font-size:12px;width:130px}" +
    // The opening sentence, the pseudonym quiet at its end.
    ".detail .sum{margin:0 0 6px;display:flex;flex-wrap:wrap;gap:4px 0;align-items:baseline}" +
    ".pid{margin-left:auto;font-size:11px;color:var(--dim);background:none;padding:0}" +
    // One line per assessment: what it is, where it stands, what can be done.
    ".items{margin:4px 0 2px}" +
    ".ihd{margin:6px 0 2px;font-size:12px;color:var(--dim)}" +
    ".it{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:4px 10px;" +
    "align-items:center;padding:5px 6px;border-top:1px solid var(--line);cursor:pointer}" +
    ".drawer:not(.one) .it:hover{background:var(--infobg)}" +
    ".it.flash{animation:flash 1.2s ease-out}" +
    "@keyframes flash{from{background:var(--infobg)}to{background:transparent}}" +
    ".ih{display:flex;align-items:baseline;gap:6px;min-width:0;font:inherit;color:inherit;background:none;border:0;padding:0;" +
    "text-align:left;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}" +
    "button.ih{cursor:pointer}button.ih:hover .iname{text-decoration:underline}" +
    ".iname{font-weight:600}" +
    ".tag{font-size:12px;padding:1px 7px;border-radius:4px;white-space:nowrap;font-variant-numeric:tabular-nums}" +
    ".tag.missing{background:var(--warnbg);color:var(--warn)}" +
    ".tag.graded{background:var(--infobg)}" +
    ".tag.in{color:var(--info)}" +
    ".tag.ahead,.tag.unrecorded{color:var(--dim)}" +
    ".ia{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;min-width:0}" +
    ".fp{display:inline-flex;flex-wrap:wrap;gap:4px 6px;align-items:center;min-width:0}" +
    ".fp .fk{width:min(260px,100%);font:inherit;font-size:12px}" +
    ".fp .fks{font:inherit;font-size:12px;max-width:260px}" +
    ".fp a{font-size:12px;overflow-wrap:anywhere}" +
    ".lnk{font:inherit;font-size:12px;background:none;border:0;padding:0;color:var(--dim);text-decoration:underline;" +
    "text-underline-offset:2px;cursor:pointer}.lnk:hover{color:var(--fg)}" +
    ".ia:empty{display:none}" +
    ".ib{grid-column:1/-1;padding:8px 0 6px}" +
    ".drawer.one .ia{grid-column:1/-1}" +
    ".sub{margin:0 0 8px}.sub+.sub{border-top:1px dashed var(--line);padding-top:6px}" +
    ".sub p{margin:0 0 4px}" +
    ".more summary{cursor:pointer;font-size:12px;color:var(--dim);padding:6px 6px;border-top:1px solid var(--line)}" +
    ".more summary:hover{color:var(--fg)}" +
    ".qa{margin:6px 0 10px}" +
    ".qa .q{font-weight:600}" +
    ".qa .a{margin:0 0 2px}" +
    ".qa .s{font-size:12px;color:var(--dim)}" +
    // The answer a student typed, set apart from the question and from the
    // mark. It is the thing this whole panel exists to show, so it is the one
    // element in here that is not dimmed.
    ".qa blockquote{margin:2px 0 4px;border-left:3px solid var(--line);padding:0 0 0 9px;" +
    "white-space:pre-wrap;overflow-wrap:anywhere}" +
    ".ok{color:var(--info)}" +
    ".bad{color:var(--warn)}" +
    // One hand-in's parts: Defence, Repository, Answers, Files — each under a
    // small heading, so the eye finds the recording before the fork list.
    ".part{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--line)}" +
    ".sh{margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}" +
    ".sh .dim{font-weight:400;letter-spacing:0}" +
    ".nothing{margin-top:10px}" +
    ".chip.act{color:var(--info);border-color:var(--info);font-weight:600}" +
    // The recording line: a light that says it exists, what it is, and the
    // press that opens it — filled, the one primary button of the hand-in.
    ".rec{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;margin:0 0 10px}" +
    ".rec.on{background:var(--infobg);border-color:transparent}" +
    ".rect{flex:1;min-width:0}" +
    ".recdot{width:8px;height:8px;border-radius:50%;background:#c43030;flex:none}" +
    ".rec .chip{font-size:12px;padding:3px 12px;margin-left:auto}" +
    ".rec.on .chip.act{background:var(--info);color:var(--dwbg);border-color:var(--info)}" +
    // A segmented control: the words joined, the one that is on filled.
    ".segg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;vertical-align:middle}" +
    ".segg .chip{border:0;border-radius:0;margin:0;padding:3px 10px;font-size:12px;color:var(--fg)}" +
    ".segg .chip+.chip{border-left:1px solid var(--line)}" +
    ".segg .chip:hover{background:var(--infobg)}" +
    ".segg .chip[aria-pressed=true]{background:var(--info);color:var(--dwbg);font-weight:600}" +
    ".segl{font-size:12px;color:var(--dim);margin-right:8px}" +
    ".defended{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px}" +
    ".fork{margin:0}" +
    // Folded parts — the rubric check, drafted questions, grade changes.
    ".dc{margin:6px 0 8px;border:1px solid var(--line);border-radius:8px}" +
    ".dc>summary{cursor:pointer;font-size:13px;padding:7px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}" +
    ".dc[open]>summary{border-bottom:1px solid var(--line)}" +
    ".dc>table,.dc>.dqa,.dc>.dq{margin:8px 10px}" +
    ".dc table{border-collapse:collapse;width:calc(100% - 20px)}" +
    ".dc td{padding:3px 6px 3px 0;vertical-align:middle;border-top:1px solid var(--line);font-size:13px}" +
    ".dc .dcm{white-space:nowrap;font-variant-numeric:tabular-nums}" +
    ".cbar{flex:1;min-width:60px;max-width:140px;height:4px;border-radius:2px;background:var(--line);margin-left:auto;overflow:hidden}" +
    ".cbar span{display:block;height:100%;background:var(--info)}" +
    // A criterion: name and mark on one line, the three words under it.
    ".crit{padding:8px 10px;border-top:1px solid var(--line)}" +
    ".rubric[open]>summary+.crit{border-top:0}" +
    ".crit.done{box-shadow:inset 3px 0 0 var(--info)}" +
    ".cth{display:flex;gap:10px;align-items:baseline;justify-content:space-between}" +
    ".ctt{min-width:0;font-size:13px}" +
    ".ctm{white-space:nowrap;font-variant-numeric:tabular-nums;font-size:13px}" +
    ".seg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:5px}" +
    ".dcs{width:56px;font:inherit;font-size:12px;padding:2px 4px;border:1px solid var(--line);border-radius:4px;background:transparent;color:var(--fg)}" +
    ".defence{margin:6px 0 0}" +
    ".dq{margin:4px 0 0;padding-left:20px}" +
    ".dq li{margin:0 0 8px}" +
    ".dq p{margin:0 0 2px;overflow-wrap:anywhere}" +
    ".dq .dim{font-size:12px}" +
    // The summary tiles and the data-health lines above the list.
    ".tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}" +
    ".tile{border:1px solid var(--line);border-radius:6px;padding:7px 11px}" +
    ".tile .dim{font-size:12px}" +
    ".tv{font-size:20px;line-height:1.3;font-variant-numeric:tabular-nums}" +
    ".health{margin:0 0 10px}.health p{margin:0 0 4px}" +
    ".hw{background:var(--warnbg);color:var(--warn);border-radius:4px;padding:5px 9px}" +
    ".tools{align-items:center}" +
    ".find{font:inherit;font-size:12px;padding:2px 9px;border:1px solid var(--line);border-radius:20px;" +
    "background:transparent;color:var(--fg);width:160px}" +
    ".shown{font-size:12px}" +
    ".idn{margin-left:auto;font-size:12px}" +
    ".idn.named{color:#a5561f;font-weight:600}" +
    // One row per student. The same columns on the header and every row; the
    // strip takes what is left and the name gives way first.
    ".tbl{overflow-x:auto}" +
    ".th,.sr{display:grid;grid-template-columns:var(--cols);min-width:max-content;" +
    "gap:10px;align-items:center}" +
    ".th{font-size:11px;color:var(--dim);padding:0 4px 4px;border-bottom:1px solid var(--line)}" +
    ".th button{font:inherit;background:none;border:0;padding:0;color:inherit;text-align:left;cursor:pointer}" +
    ".th button:hover{color:var(--fg)}" +
    ".th button[aria-pressed=true]{color:var(--fg);font-weight:600}" +
    ".th button[aria-pressed=true]::after{content:' \\2193'}" +
    ".sr{padding:6px 4px;border-bottom:1px solid var(--line);cursor:pointer}" +
    ".sr:hover,.sr.lit{background:var(--infobg)}" +
    ".sr.lit{box-shadow:inset 3px 0 0 var(--info)}" +
    ".sr:focus-visible{outline:2px solid var(--info);outline-offset:-2px}" +
    ".sr.gone{cursor:default;color:var(--dim)}.sr.gone:hover{background:none}" +
    ".sr .rest{grid-column:3/-1}" +
    ".nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".gr{color:var(--dim);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".pc{font-variant-numeric:tabular-nums;font-weight:600}" +
    ".pc.low,.tv.low{color:var(--warn)}" +
    ".bar{position:relative;display:block;height:8px;border-radius:4px;background:var(--line)}" +
    ".bar .span{position:absolute;top:0;bottom:0;border-radius:4px;background:var(--dim);opacity:.45}" +
    ".bar .pass{position:absolute;top:-2px;bottom:-2px;width:1px;background:var(--dim);opacity:.6}" +
    ".bar .tick{position:absolute;top:-4px;width:2px;height:16px;margin-left:-1px;background:var(--fg)}" +
    ".bar .tick.low{background:var(--warn)}" +
    // The floor and the ceiling, small, under each end of the bar.
    ".bar{margin-bottom:11px}" +
    ".bar .ends{position:absolute;top:10px;left:0;right:0;display:flex;justify-content:space-between;" +
    "font-size:10px;line-height:1;color:var(--dim);font-variant-numeric:tabular-nums}" +
    // Every cell the same size, whatever it holds, so the columns line up
    // down the list and under the header's numbers.
    ".sk{display:inline-flex;gap:2px}" +
    ".sk .m,.sk .n{width:24px;height:18px;padding:0;font-size:10px;line-height:16px;text-align:center;" +
    "font-variant-numeric:tabular-nums;box-sizing:border-box;overflow:hidden;vertical-align:middle}" +
    ".sk .n{border:0;color:var(--dim);line-height:14px;height:14px}" +
    ".kh{display:flex;flex-direction:column;gap:1px}" +
    ".kn{color:var(--fg);font-weight:600}" +
    ".m{display:inline-block;width:9px;height:14px;border-radius:2px;border:1px solid var(--line);vertical-align:-2px}" +
    ".m.graded{background:var(--infobg);border-color:var(--info);color:var(--fg)}" +
    ".sk .m.graded{--cf:color-mix(in srgb,var(--info) 38%,transparent);" +
    "background:linear-gradient(to top,var(--cf) var(--f,100%),transparent var(--f,100%))}" +
    ".sk .m.graded.lo{--cf:color-mix(in srgb,var(--warn) 34%,transparent);border-color:var(--warn)}" +
    ".m.in{border:1px dashed var(--info);color:var(--info)}" +
    ".m.missing{background:var(--warnbg);border-color:var(--warn);color:var(--warn);font-weight:600}" +
    ".m.unrecorded{color:var(--dim)}" +
    ".m.unrecorded{border-style:dotted;border-color:var(--dim)}" +
    // Integrity: held is the professor's to decide, so it is loud; voided is
    // settled and out of the total, so it is quiet.
    ".m.held{background:var(--warnbg);border:1px solid var(--warn);color:var(--warn);font-weight:700}" +
    ".m.voided{border-style:dashed;border-color:var(--dim);color:var(--dim);font-size:8px}" +
    ".m.ic{position:relative}.m.ic::after{content:'';position:absolute;top:0;right:0;border-style:solid;" +
    "border-width:0 6px 6px 0;border-color:transparent var(--warn) transparent transparent}" +
    ".icl{margin:0 0 4px;font-size:12px}.icl.on b{color:var(--warn)}" +
    ".icn{display:inline-block;margin-left:6px;font-size:11px;color:var(--dim)}.icn summary{cursor:pointer}" +
    ".legend{font-size:11px;margin:8px 0 16px}.legend .m{margin:0 3px 0 8px}.legend .m:first-child{margin-left:0}" +
    ".detail>p{margin:0 0 4px}" +
    "section.tbl{margin-top:18px}" +
    // A narrow pane keeps who, where they are heading, and what they owe.
    "@media(max-width:720px){.th,.sr{grid-template-columns:minmax(0,1fr) 110px 44px 44px}" +
    ".th>:nth-child(2),.th>:nth-child(n+6),.sr .gr,.sr>.sk{display:none}.sr .rest{grid-column:2/-1}}" +
    ".standing{font-size:12px;margin:2px 0 4px}" +
    ".standing p{margin:0 0 3px}" +
    ".blocks .blk{margin-right:14px;white-space:nowrap}" +
    ".sortl{margin-left:12px;font-size:12px}" +
    "</style>";

  /*
   * *Start defence* posts up to the browser half, which runs the clone and
   * then asks the session — the frame itself may not `fetch`. The button is
   * disabled once pressed, so a double click is not two clones; the redraw
   * that follows brings it back.
   */
  const defenceScript =
    "<script>(function(){if(parent===window)return;" +
    "document.addEventListener('click',function(e){" +
    "var k=e.target.closest&&e.target.closest('button[data-ask]');" +
    "if(k){if(k.disabled)return;k.disabled=true;k.textContent='Asked…';" +
    // A note typed beside the press (Regrade) rides at the end of the prompt.
    "var q=k.getAttribute('data-ask'),nt=k.parentNode.querySelector('textarea[data-note]');" +
    "if(nt&&nt.value.trim()){q+='; '+nt.getAttribute('data-note')+nt.value.trim();nt.disabled=true;}" +
    "parent.postMessage({source:'professor-pane',kind:'ask',prompt:q},'*');return;}" +
    "var s=e.target.closest&&e.target.closest('button[data-syncs]');" +
    "if(s){parent.postMessage({source:'professor-pane',kind:'syncs'},'*');return;}" +
    // Save a fork: their own (the button carries it), the one picked from
    // the list, or a pasted link — in that order.
    "var f=e.target.closest&&e.target.closest('button[data-fork]');" +
    "if(f){if(f.disabled)return;var p=f.closest('.fp'),u=p&&p.querySelector('input.fk'),s=p&&p.querySelector('select.fks')," +
    "v=f.getAttribute('data-url')||(s&&s.value&&s.value!=='paste'?s.value:'')||(u&&!u.hidden?u.value.trim():'');" +
    "if(!v){if(s&&s.value!=='paste')s.focus();else if(u)u.focus();return;}" +
    "f.disabled=true;f.textContent='Saving…';parent.postMessage({source:'professor-pane',kind:'defence-fork'," +
    "assessment:f.getAttribute('data-fork'),student:f.getAttribute('data-student'),url:v},'*');return;}" +
    "var g=e.target.closest&&e.target.closest('button[data-forks]');" +
    "if(g){if(g.disabled)return;g.disabled=true;g.textContent='Looking…';" +
    "parent.postMessage({source:'professor-pane',kind:'homework-forks',assessment:g.getAttribute('data-forks')},'*');return;}" +
    "var n=e.target.closest&&e.target.closest('button[data-audio-new]');" +
    "if(n){if(n.disabled)return;n.disabled=true;n.textContent='Opening…';parent.postMessage({source:'professor-pane',kind:'defence-audio'," +
    "assessment:n.getAttribute('data-assessment'),student:n.getAttribute('data-student')},'*');return;}" +
    "var c=e.target.closest&&e.target.closest('button[data-check]');" +
    "if(c){if(c.disabled)return;var o=c.getAttribute('data-check'),x=c.closest('.crit').querySelector('input.dcs'),v=o==='partly'&&x&&x.value!==''?Number(x.value):null;" +
    "c.disabled=true;parent.postMessage({source:'professor-pane',kind:'defence-check',outcome:o,score:v," +
    "criterion:c.getAttribute('data-criterion'),assessment:c.getAttribute('data-assessment'),student:c.getAttribute('data-student')},'*');return;}" +
    // Open an integrity case, with the note typed above the press.
    "var ic=e.target.closest&&e.target.closest('button[data-ic-open]');" +
    "if(ic){if(ic.disabled)return;var icn=ic.parentNode.querySelector('textarea[data-ic-note]');ic.disabled=true;ic.textContent='Opening…';" +
    "parent.postMessage({source:'professor-pane',kind:'integrity',action:'open',assessment:ic.getAttribute('data-ic-open')," +
    "student:ic.getAttribute('data-student'),note:icn?icn.value.trim():''},'*');return;}" +
    "var m=e.target.closest&&e.target.closest('button[data-defended]');" +
    "if(m){if(m.disabled)return;m.disabled=true;" +
    "parent.postMessage({source:'professor-pane',kind:'defended',outcome:m.getAttribute('data-defended')," +
    "assessment:m.getAttribute('data-assessment'),student:m.getAttribute('data-student')},'*');return;}" +
    "var d=e.target.closest&&e.target.closest('button[data-desk]');" +
    "if(d){parent.postMessage({source:'professor-pane',kind:'defence-desk'," +
    "assessment:d.getAttribute('data-desk'),student:d.getAttribute('data-student')},'*');return;}" +
    "var b=e.target.closest&&e.target.closest('button[data-defence]');if(!b||b.disabled)return;" +
    "b.disabled=true;b.textContent='Cloning…';" +
    "parent.postMessage({source:'professor-pane',kind:'defence'," +
    "assessment:b.getAttribute('data-defence'),student:b.getAttribute('data-student')},'*');" +
    "});})();</script>";

  return documentPage(
    workStyle + "<style>" + assessmentWindowStyle + "</style>" + header + filterBar + list + legend + departed + drawer + assessmentWindow +
      filterScript + drawerScript + defenceScript + assessmentWindowScript + presetScript + VIEW_SCRIPT,
    dark,
  );
};
