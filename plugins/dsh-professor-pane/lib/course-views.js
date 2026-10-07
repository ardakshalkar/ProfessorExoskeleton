/**
 * The course tables the pane assembles itself: the grading policy, and the
 * assessment, slide and exam lists.
 */

import { approvedView } from "@ainar/core/src/approval.ts";
import { runById } from "@ainar/core/src/bundle.ts";
import { gradebookPayload } from "@ainar/core/src/gradebook.ts";

import { schemeHtml, schemeStyle } from "./grading-view.js";
import { escapeAttribute, escapeText } from "./markdown.js";
import { withMaterialLinks } from "./materials.js";
import { documentPage, rows, titleWithId, todoOr, VIEW_SCRIPT } from "./page.js";
import { viewPayload } from "./workspace.js";

/**
 * The press that offers to publish a homework's starter repository.
 *
 * Only for work that arrives as one — `submission_type` includes `code_repo`.
 * A quiz has no repository to publish and a button offering to make it one
 * would be a question the professor has to answer every time they read the
 * list.
 *
 * It carries the identifier and nothing else. What the repository is called,
 * whether it exists, and what would change are all answered by the server when
 * the press arrives, because a frame that has been open since this morning is
 * not a reliable witness to any of them.
 */
const isRepoWork = (assessment) => {
  const kinds = assessment.submission_type;
  return Array.isArray(kinds)
    ? kinds.includes("code_repo")
    : String(kinds ?? "").includes("code_repo");
};

/**
 * Where the starter repository is, so the list answers "is this published".
 *
 * The record's answer, not GitHub's, and the difference is worth being exact
 * about: this says a repository was written down, which is what makes the
 * publish button able to run at all. Whether it exists, and whether it matches
 * the folder, is what pressing the button reports — one network call, when
 * somebody asks, rather than one per row every time this list is drawn.
 *
 * Amber when nothing is recorded, in the same colour the pane uses for a
 * missing brief and a missing weight. Work students fork and cannot start
 * without is a hole in the same sense.
 */
const repoChip = (assessment) => {
  const repo = assessment.github?.template_repo;
  if (!repo) return '<span class="todo">not published</span>';
  return (
    '<a class="chip-link" href="https://github.com/' +
    escapeText(repo) +
    '" target="_blank" rel="noopener">' +
    escapeText(repo) +
    "</a>"
  );
};

const publishButton = (assessment) => {
  if (!isRepoWork(assessment)) return "";
  // Two words for two situations, because they are different acts. Work with no
  // repository is being put somewhere for the first time — a URL that did not
  // exist will exist, and students will be sent to it. Work that has one is
  // being brought up to date, and the thing at the other end is a repository
  // people may already have forked. A single "publish" read as pending on a
  // homework that has been on GitHub since September, which is what prompted
  // this. The ellipsis is the usual promise that a strip opens rather than
  // something happening on the press.
  const recorded = Boolean(assessment.github?.template_repo);
  return (
    '<button class="chip-link" type="button" data-publish="' +
    escapeText(assessment.assessment_id ?? "") +
    '" data-label="' +
    escapeText(assessment.title ?? assessment.assessment_id ?? "") +
    '" title="' +
    (recorded
      ? "Check what differs from GitHub, and push it if you want to."
      : "Create the repository and push the folder to it.") +
    '">' +
    (recorded ? "update…" : "publish…") +
    "</button>"
  );
};

/**
 * The grading policy half of the Course outline tab.
 *
 * The arithmetic is NOT done here. `course_outline` already carries a `grading`
 * section — `total_weight`, which assessments carry no weight, whether the
 * scheme is complete, and a sentence when it is not — and this draws that.
 *
 * The first version of this function did the sum itself and got it wrong in the
 * way the model exists to prevent: `weight` is a FRACTION of one, so a perfectly
 * good scheme of 0.15 + 0.15 + 0.2 + 0.5 was rendered as "Total 1% — not 100"
 * and would have sent a professor to fix a course that was already correct.
 * Reading the model's own number cannot drift from what the Week-by-week view
 * beside it reports, which is the whole reason the pane is built this way.
 *
 * What is assembled here is only what no tool answers: the run's own
 * `extensions` — the written policy, the LMS target, the planned week count —
 * which are records of decisions rather than computations over them.
 */
export const gradingDocument = (workspace, root, runId, dark, withDrafts, on) => {
  const data = viewPayload(workspace, "course_outline", runId, on, withDrafts).payload;

  const bundle = workspace.findRun(runId);
  const run = runById(bundle).get(runId) ?? {};
  const extensions = run.extensions ?? {};
  const grading = data.grading ?? {};
  const assessments = Array.isArray(data.assessments) ? data.assessments : [];

  // `total_weight` is a fraction of one; the model reports it to a person as a
  // percentage, and so does this.
  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : "—";

  const policy =
    "<section><h2>Grading policy</h2><p>" +
    todoOr(extensions.grading_policy) +
    "</p></section>";

  const schedule = extensions.schedule ?? {};
  const facts =
    "<section><h2>The run</h2>" +
    [
      ["Term", run.term],
      ["Dates", run.start_date && run.end_date ? run.start_date + " → " + run.end_date : null],
      ["Status", run.status],
      ["Timezone", run.timezone],
      ["Planned weeks", schedule.weeks],
      ["LMS target", (extensions.lms ?? {}).target],
    ]
      .map(
        ([label, value]) =>
          '<div class="row"><span class="k">' +
          escapeText(label) +
          '</span><span class="v">' +
          todoOr(value) +
          "</span></div>",
      )
      .join("") +
    "</section>";

  const weights =
    "<section><h2>Weights</h2>" +
    (assessments.length === 0
      ? '<p class="empty">No assessment belongs to this run, so nothing carries a weight ' +
        "and there is no scheme to check. Drafting one is <code>/design-assessment</code>.</p>"
      : assessments
          .map(
            (row) =>
              '<div class="row"><span class="k">' +
              titleWithId(row) +
              '</span><span class="v">' +
              (row.weight === null || row.weight === undefined
                ? '<span class="todo">no weight</span>'
                : asPercent(row.weight)) +
              "</span></div>",
          )
          .join("") +
        '<div class="row"><span class="k"><strong>Total</strong></span><span class="v">' +
        (grading.complete === true
          ? asPercent(grading.total_weight)
          : '<span class="todo">' + asPercent(grading.total_weight) + "</span>") +
        "</span></div>") +
    "</section>";

  // The model's own sentence about what is wrong, rather than one invented
  // here. It names the assessments at fault, which a total cannot.
  const note = grading.note
    ? '<section><p class="empty">' + escapeText(grading.note) + "</p></section>"
    : "";

  // A run with a grading scheme is drawn as the blocks it is built from — see
  // lib/grading-view.js — and the written policy follows as the reference.
  // Without one, the flat list of weights is still the whole truth.
  if (run.grading_scheme?.components?.length) {
    const shown = withDrafts ? bundle : approvedView(bundle);
    const ours = (shown.assessments ?? []).filter((a) => a.course_version_id === runId);
    const graded = new Set(
      (gradebookPayload(approvedView(bundle), runId, {}).assessments ?? [])
        .filter((a) => (a.summary?.graded ?? 0) > 0 || (a.summary?.partially_graded ?? 0) > 0)
        .map((a) => a.assessment_id),
    );
    const scheme = schemeHtml({ run, assessments: ours, graded });
    return documentPage(schemeStyle(dark) + scheme + note + policy + facts, dark);
  }

  return documentPage(policy + facts + weights + note, dark);
};

/**
 * The chip that opens a piece of graded work's brief, or the fact that there
 * is not one.
 *
 * A brief is not optional in the way a weight or a rubric is optional. A
 * weight the professor has not decided is a decision they can take next week;
 * work with no brief is work a student cannot start, so its absence is drawn
 * in the same amber the pane uses for every other hole rather than as a dash.
 *
 * `data-view` is the request to open it over the harness instead of in a tab,
 * and it is written only when the format is one the browser will paint —
 * `withMaterialLinks` decides that, and a `.docx` brief therefore keeps the
 * tab it always opened. See VIEW_SCRIPT.
 */
const briefChip = (assessment) => {
  // An exam with versions: one chip, one overlay, every version in it as a tab
  // — and side by side, which is how a professor checks two versions really
  // ask different questions. The first version's address is the plain link, so
  // a modified click still opens a tab with something in it.
  const papers = Array.isArray(assessment.papers) ? assessment.papers : [];
  if (papers.length > 1) {
    return (
      '<a class="chip-link" href="' +
      escapeText(papers[0].url) +
      '" target="_blank" rel="noopener" data-view="' +
      escapeText(assessment.title ?? assessment.assessment_id ?? "Paper") +
      '" data-format="' +
      escapeText(papers[0].format ?? "") +
      '" data-papers="' +
      // JSON is full of `"`, so this one value needs the quote escaped too.
      escapeAttribute(JSON.stringify(papers.map(({ label, url, format }) => ({ label, url, format })))) +
      '">open · ' +
      papers.length +
      " versions</a>"
    );
  }
  const href = assessment.url;
  if (!href) return '<span class="todo">no brief</span>';
  // `open`, not the extension. The Slides list names formats — `PDF`, `PPTX` —
  // because a deck there exists in several and the label is the choice being
  // offered. A brief is one document, so its extension is not a choice, and
  // naming it would put `MD` on screen as though that meant something to the
  // person reading.
  return (
    '<a class="chip-link" href="' +
    escapeText(href) +
    '" target="_blank" rel="noopener"' +
    (assessment.viewable
      ? ' data-view="' +
        escapeText(assessment.title ?? assessment.assessment_id ?? "Brief") +
        '" data-format="' +
        escapeText(assessment.format ?? "") +
        '"'
      : "") +
    ">open</a>"
  );
};

const outlinePayloadFor = (workspace, root, runId, withDrafts, on) =>
  viewPayload(workspace, "course_outline", runId, on, withDrafts).payload;

/**
 * Every piece of graded work, in the order it falls due.
 *
 * Undated work sorts last rather than first, which is what `""` would do: a
 * deadline nobody has set is not a deadline in January.
 */
export const assessmentsDocument = (
  workspace,
  root,
  runId,
  dark,
  withDrafts,
  on,
  origin,
  sessionId,
) => {
  const data = withMaterialLinks(
    outlinePayloadFor(workspace, root, runId, withDrafts, on),
    origin,
    sessionId,
    workspace,
    dark,
    withDrafts,
  );
  const all = Array.isArray(data.assessments) ? [...data.assessments] : [];
  all.sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : null;

  const body =
    all.length === 0
      ? '<p class="empty">No assessment belongs to this run yet. Drafting one is ' +
        "<code>/design-assessment</code>.</p>"
      : all
          .map((row) => {
            const weight = asPercent(row.weight);
            const detail = [
              row.type ? escapeText(row.type) : null,
              row.criteria ? escapeText(String(row.criteria)) + " criteria" : null,
              row.outcomes ? escapeText(row.outcomes) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              '<div class="row"><span class="k">' +
              titleWithId(row) +
              (detail ? '<br><span class="dim">' + detail + "</span>" : "") +
              '</span><span class="v">' +
              (weight === null ? '<span class="todo">no weight</span>' : weight) +
              "<br>" +
              (row.due_on
                ? '<span class="dim">due ' + escapeText(row.due_on) + "</span>"
                : '<span class="todo">no date</span>') +
              // The brief on its own line, under the weight and the date. Not
              // beside the title: a course whose homework is titled "Homework"
              // four times over already leans on the id to tell the rows
              // apart, and a link in the middle of that is one more thing to
              // read before finding the one you meant.
              "<br>" +
              briefChip(row) +
              (isRepoWork(row) ? "<br>" + repoChip(row) + publishButton(row) : "") +
              "</span></div>"
            );
          })
          .join("");

  return documentPage(
    "<section><h2>Assessments</h2>" + body + VIEW_SCRIPT + "</section>",
    dark,
  );
};

/**
 * Every deck in the term, with the formats each exists in.
 *
 * A `Resource` carries no week of its own — the only join is the activity that
 * uses it — so these are gathered by walking the weeks rather than by reading a
 * resource list, and a deck attached to no meeting does not appear here at all.
 * That is the model's shape, not an omission: an unattached deck is not yet
 * part of any class.
 */
export const slidesDocument = (workspace, root, runId, dark, withDrafts, on, origin, sessionId) => {
  let data = outlinePayloadFor(workspace, root, runId, withDrafts, on);
  data = withMaterialLinks(data, origin, sessionId, workspace, dark, withDrafts);

  const found = [];
  for (const week of data.weeks ?? []) {
    for (const meeting of week.meetings ?? []) {
      for (const resource of meeting.resources ?? []) {
        if (resource.kind !== "slides") continue;
        found.push({ week: week.week, title: resource.title, resource });
      }
    }
  }

  // `title` is what the overlay would be called; a null one is a format the
  // browser would only download, and the anchor is left as the tab it always
  // was. See VIEW_SCRIPT, and SHOWABLE for which formats those are.
  // `target` matters more here than it looks: this page is delivered into a
  // frame with an opaque origin, and such a frame may not navigate itself, so
  // a same-tab link was a link that did nothing at all. The frame is granted
  // `allow-popups-to-escape-sandbox` for exactly this.
  const link = (href, label, title, format) =>
    '<a href="' + escapeText(href) + '" target="_blank" rel="noopener"' +
    (title === null
      ? ""
      : ' data-view="' + escapeText(title) + '" data-format="' + escapeText(format ?? "") + '"') +
    ' style="color:inherit;text-decoration:none;' +
    "border:1px solid var(--line);border-radius:3px;padding:0 5px;margin-left:4px;" +
    'font-size:11px;letter-spacing:.04em">' + escapeText(label) + "</a>";

  const body =
    found.length === 0
      ? '<p class="empty">No meeting in this run carries a deck. A deck reaches this list ' +
        "by being a <code>slides</code> resource on a learning activity.</p>"
      : found
          .map((entry) => {
            const formats = (entry.resource.formats ?? [])
              .filter((format) => format.url)
              .map((format) =>
                link(
                  format.url,
                  format.label,
                  format.viewable ? (entry.title ?? "Slides") + " · " + format.label : null,
                  format.format,
                ),
              )
              .join("");
            return (
              '<div class="row"><span class="k">' +
              '<span class="dim">week ' + escapeText(String(entry.week)) + "</span> " +
              escapeText(entry.title ?? "untitled") +
              '</span><span class="v">' +
              (formats ||
                (entry.resource.url
                  ? link(
                      entry.resource.url,
                      "open",
                      entry.resource.viewable ? (entry.title ?? "Slides") : null,
                      entry.resource.format,
                    )
                  : '<span class="todo">no file</span>')) +
              "</span></div>"
            );
          })
          .join("");

  return documentPage("<section><h2>Slides</h2>" + body + VIEW_SCRIPT + "</section>", dark);
};

/**
 * The sit-down assessments, with what a professor checks before setting one.
 *
 * `exam` only. A quiz is graded work and belongs on the Assessments list; an
 * exam is the one a room has to be booked for, and the questions asked of it —
 * is it written, is it weighted, does a rubric exist — are asked weeks earlier
 * than for anything else. Filtering by the model's own `type` rather than by a
 * title convention means renaming "Midterm Exam 1" does not move it.
 */
export const examsDocument = (workspace, root, runId, dark, withDrafts, on, origin, sessionId) => {
  const data = withMaterialLinks(
    outlinePayloadFor(workspace, root, runId, withDrafts, on),
    origin,
    sessionId,
    workspace,
    dark,
    withDrafts,
  );
  // Drafts live in the course now, so both views have a bundle to count from.
  const bundle = withDrafts ? workspace.findRun(runId) : approvedView(workspace.findRun(runId));
  const exams = (Array.isArray(data.assessments) ? data.assessments : []).filter(
    (row) => row.type === "exam",
  );

  // Item counts come from the bundle, because the outline payload carries a
  // criteria count and not an item count. Absent when the drafted view is on
  // rather than wrong: a merged bundle is not what `findRun` returns.
  const itemsById = new Map();
  if (bundle) {
    for (const item of bundle.items ?? []) {
      const key = item.assessment_id;
      if (key) itemsById.set(key, (itemsById.get(key) ?? 0) + 1);
    }
  }

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : null;

  const body =
    exams.length === 0
      ? '<p class="empty">No assessment in this run has <code>type: exam</code>. ' +
        "Quizzes and assignments are on the Assessments list.</p>"
      : exams
          .map((row) => {
            const weight = asPercent(row.weight);
            const count = itemsById.get(row.assessment_id);
            return (
              "<section><h2>" +
              titleWithId(row) +
              "</h2>" +
              rows([
                ["When", row.due_on ? escapeText(row.due_on) : '<span class="todo">no date</span>'],
                ["Weight", weight === null ? '<span class="todo">no weight</span>' : weight],
                // First among the things that have to exist, because it is the
                // one a room full of students will be handed. An exam with
                // items written and no paper registered is the failure this
                // row is here to make visible weeks earlier.
                ["Paper", briefChip(row)],
                [
                  "Questions",
                  count === undefined
                    ? '<span class="dim">—</span>'
                    : count === 0
                      ? '<span class="todo">none written</span>'
                      : String(count),
                ],
                [
                  "Rubric criteria",
                  row.criteria ? escapeText(String(row.criteria)) : '<span class="dim">—</span>',
                ],
                ["Outcomes", row.outcomes ? escapeText(row.outcomes) : '<span class="dim">—</span>'],
              ]) +
              "</section>"
            );
          })
          .join("");

  return documentPage(body + VIEW_SCRIPT, dark);
};
