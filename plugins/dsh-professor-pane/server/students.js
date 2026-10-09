/**
 * The class list, and each student's row with their work and their defence.
 */

import { allRubrics, assessmentsOf, enrollmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { exportPath, loadSheetConfig } from "@ainar/core/src/grade-sheet.ts";
import { gradebookPayload } from "@ainar/core/src/gradebook.ts";

import { BASE } from "./http.js";
import { escapeText } from "./markdown.js";
import { extensionOfKey, SHOWABLE } from "./materials.js";
import { documentPage, stamp, VIEW_SCRIPT } from "./page.js";
import { loadedRun, rosterPath, rosterPeople } from "./workspace.js";

export const studentsDocument = (workspace, runId, dark, withNames, origin, sessionId, defenceOf = null) => {
  const { bundle, issues } = loadedRun(workspace, runId);
  const enrolled = enrollmentsOf(bundle, runId);

  // Read once per response, not once per student: the store is one file and
  // twenty-seven reads of it would be twenty-seven chances to catch it
  // half-written by a concurrent `ainar roster import`.
  const people = withNames ? rosterPeople() : null;

  /**
   * What to show for one person, and what to show underneath it.
   *
   * The pseudonym never disappears. It is the identifier every other surface
   * uses — the gradebook, `whois`, a bug report — so a named row that dropped
   * it would be a row the professor could not act on anywhere else.
   */
  const heading = (studentId) => {
    const person = people ? people[studentId] : null;
    const name = person && typeof person.name === "string" ? person.name.trim() : "";
    if (!name) return escapeText(studentId);
    // The grade sheet's note about this person, kept beside their name in the
    // roster and shown only with it: it is about them, not about their work.
    const sheetFlag = person.sheet_flags && typeof person.sheet_flags[runId] === "string" ? person.sheet_flags[runId] : "";
    return (
      escapeText(name) +
      (sheetFlag ? ' <span title="Noted in the grade sheet">' + escapeText(sheetFlag) + "</span>" : "") +
      '<br><span class="dim" style="font-weight:400"><code>' +
      escapeText(studentId) +
      "</code></span>"
    );
  };

  const issueItems = issues && Array.isArray(issues.items) ? issues.items : [];
  const refused = issueItems.filter(
    (issue) => issue.code === "storage.forbidden" && /enrollments/.test(issue.message ?? ""),
  );
  const synthetic = issueItems.some((issue) => issue.code === "storage.fixture");

  const note = (text) =>
    '<p class="dim" style="border-left:3px solid var(--line);padding-left:10px">' + text + "</p>";

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
   * appear here either. Only the bounds are new arithmetic, and they are the
   * plainest there is: the floor is every open assessment at nothing, the
   * ceiling every one at full marks, and the pace the student's own share of
   * what has been graded carried over the rest.
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
  const courseWeight = weighted.reduce((sum, assessment) => sum + assessment.weight, 0);
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
  const submissionUrl = new Map();
  for (const submission of bundle.submissions ?? []) {
    if (submission.url) submissionUrl.set(submission.submission_id, submission.url);
  }
  const KINDS = [
    { label: "Homework", types: ["assignment", "homework", "lab"] },
    { label: "Quizzes", types: ["quiz"] },
    { label: "Exams", types: ["exam", "midterm", "final"] },
    { label: "Projects", types: ["project"] },
  ];
  const kindOf = (type) => KINDS.find((kind) => kind.types.includes(String(type ?? ""))) ?? null;
  const kinds = [
    ...KINDS.map((kind) => ({ ...kind, assessments: weighted.filter((a) => kindOf(a.type) === kind) })),
    { label: "Other", types: [], assessments: weighted.filter((a) => !kindOf(a.type)) },
  ].filter((kind) => kind.assessments.length);

  // The scheme's top-level blocks, in its own order: ВСК 1, ВСК 2, Final. A
  // nested block is already inside its parent's figure.
  const schemeBlocks = (((runById(bundle).get(runId) ?? {}).grading_scheme ?? {}).components ?? []).filter(
    (component) => !component.parent,
  );

  const number = (value) => String(Math.round(value * 10) / 10);

  /** One student's state on every weighted assessment, and the bounds that follow. */
  const standingOf = (studentId) => {
    let earned = 0;
    let gradedWeight = 0;
    let open = 0;
    const cells = new Map();
    let missing = 0;
    let waiting = 0;
    for (const assessment of weighted) {
      const entry = rowFor.get(assessment.assessment_id + "|" + studentId);
      const due = assessment.due_at ? Date.parse(assessment.due_at) : NaN;
      let state;
      if (entry && entry.status === "graded" && entry.score !== null && entry.maximum) {
        earned += (entry.score / entry.maximum) * assessment.weight;
        gradedWeight += assessment.weight;
        state = "graded";
      } else {
        open += assessment.weight;
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
    const share = gradedWeight ? earned / gradedWeight : null;
    return {
      cells,
      missing,
      waiting,
      share,
      floor: courseWeight ? (earned / courseWeight) * 100 : null,
      ceiling: courseWeight ? ((earned + open) / courseWeight) * 100 : null,
      open: courseWeight ? (open / courseWeight) * 100 : null,
    };
  };

  const cell = (assessment, { state, entry, due }) => {
    const title = assessment.title ?? assessment.assessment_id;
    const url = entry && entry.submission_id ? submissionUrl.get(entry.submission_id) : null;
    const when = Number.isFinite(due) ? " · due " + stamp(assessment.due_at) : " · no due date";
    const said =
      state === "graded"
        ? number(entry.score) + " of " + number(entry.maximum)
        : state === "in"
          ? "handed in, not graded yet"
          : state === "missing"
            ? "missing — past due, nothing handed in"
            : state === "unrecorded"
              ? "past due, but no hand-ins recorded for anyone yet — not imported"
              : "not due yet";
    const text = { graded: entry && number(entry.score), in: "✓", missing: "✗", unrecorded: "?", ahead: "·" }[state];
    const tip = title + " — " + said + when + (url ? " · " + url : "");
    // A handed-in repository opens on GitHub from its cell: the homework row
    // is where the professor is looking when they want it.
    return url
      ? '<a class="c ' + state + ' repo" href="' + escapeText(url) + '" target="_blank" rel="noopener" title="' +
          escapeText(tip) + '">' + escapeText(text) + "</a>"
      : '<span class="c ' + state + '" title="' + escapeText(tip) + '">' + escapeText(text) + "</span>";
  };

  const standingBlock = (studentId, standing) => {
    if (!weighted.length) return "";
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
      standing.floor === null
        ? ""
        : '<p class="bounds">Final can still land <b>' + number(standing.floor) + " – " + number(standing.ceiling) +
          "</b> / 100" +
          ' <span class="dim">· ' + number(standing.open) + "% of the course still open" +
          (standing.waiting ? " · " + standing.waiting + " handed in, awaiting grading" : "") +
          "</span></p>";
    const lines = kinds
      .map((kind) => {
        const missed = kind.assessments.filter((a) => standing.cells.get(a.assessment_id).state === "missing").length;
        return (
          '<div class="kind"><span class="kl">' + escapeText(kind.label) + "</span>" +
          '<span class="cells">' +
          kind.assessments.map((a) => cell(a, standing.cells.get(a.assessment_id))).join("") +
          "</span>" +
          (missed ? ' <span class="todo">' + missed + " missing</span>" : "") +
          "</div>"
        );
      })
      .join("");
    return '<div class="standing">' + bounds + blocks + lines + "</div>";
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

  const marks = (studentId) => {
    const row = totals.get(studentId);
    if (!row) return '<span class="dim">no work graded yet</span>';
    const counted = (row.assessments_counted ?? []).length;
    const outstanding = (row.assessments_outstanding ?? []).length;
    const percent = row.percent_of_graded;
    const of = counted + outstanding;
    // The share of graded work is also where the course ends at this pace —
    // the same share carried over what is left — so it is said once, as that.
    return (
      (percent === null || percent === undefined
        ? '<span class="dim">—</span>'
        : "<b>" + escapeText(String(percent)) + "</b>" + '<span class="dim"> at this pace</span>') +
      '<br><span class="dim">' +
      escapeText(String(counted)) +
      " of " +
      escapeText(String(of)) +
      " graded</span>"
    );
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
        ? '<span class="todo">not scored</span>'
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

  /**
   * The repository a student handed in, and their oral defence of it.
   *
   * Only for a submission with a link. The repository opens on GitHub in a
   * tab of its own — it is somebody else's site, not a material this pane can
   * frame. *Start defence* clones it in the harness's process and then asks
   * the session to draft the questions (`/defend-submission`), so the model
   * drafting them is whichever one the professor is talking to.
   *
   * Once drafted, the questions are drawn here in the order they will be
   * asked, each with the criterion it is evidence for and the lines it is
   * about, marked draft until the professor has read them.
   */
  const defenceBlock = (submission) => {
    if (!submission.url) return "";
    const prepared = defenceOf ? defenceOf(submission.assessment_id, submission.student_id) : { pin: null, questions: null };
    const criteria = new Map(
      ((rubricsById.get(assessmentTitles.get(submission.assessment_id)?.rubric_id ?? "") ?? {}).criteria ?? []).map(
        (criterion) => [criterion.criterion_id, criterion.title],
      ),
    );
    const questions = prepared.questions && Array.isArray(prepared.questions.questions) ? prepared.questions.questions : [];
    const pin = prepared.pin;
    const press = (label) =>
      '<button type="button" class="chip" data-defence="' +
      escapeText(submission.assessment_id) +
      '" data-student="' +
      escapeText(submission.student_id) +
      '">' +
      escapeText(label) +
      "</button>";
    return (
      '<div class="defence">' +
      '<p><a class="chip-link" href="' +
      escapeText(submission.url) +
      '" target="_blank" rel="noopener">repository</a>' +
      (pin
        ? ' <span class="dim">at <code>' +
          escapeText(String(pin.commit).slice(0, 7)) +
          "</code>" +
          (pin.pinned_by === "submitted_at" ? ", as handed in" : pin.note ? " — " + escapeText(pin.note) : ", the head") +
          (pin.head && pin.head !== pin.commit ? " · moved on since" : "") +
          "</span>"
        : "") +
      " " +
      (questions.length
        ? '<button type="button" class="chip" data-desk="' +
          escapeText(submission.assessment_id) +
          '" data-student="' +
          escapeText(submission.student_id) +
          '">Open defence desk</button>' +
          press("Draft again")
        : press("Start defence")) +
      "</p>" +
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
      + "</div>"
    );
  };

  /** Everything one student handed in, closed until asked for. */
  const workPanel = (entry) => {
    const list = submissionsOf.get(entry.student_id) ?? [];
    if (!list.length) return "";
    return (
      '<div class="row work" data-group="' +
      escapeText(label(entry)) +
      '" data-work="' +
      escapeText(String(entry.student_id ?? "")) +
      '" hidden><div class="wk">' +
      list
        .map((submission) => {
          const assessment = assessmentTitles.get(submission.assessment_id) ?? {};
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
          return (
            "<h3>" +
            escapeText(assessment.title ?? submission.assessment_id) +
            ' <span class="id">' +
            escapeText(submission.assessment_id) +
            "</span></h3>" +
            '<p class="dim">' +
            (submission.submitted_at
              ? "handed in " + escapeText(stamp(submission.submitted_at))
              : "no time recorded") +
            (submission.status && submission.status !== "submitted"
              ? " · " + escapeText(String(submission.status))
              : "") +
            (submission.attempt && submission.attempt > 1
              ? " · attempt " + escapeText(String(submission.attempt))
              : "") +
            "</p>" +
            (submission.note
              ? '<p class="dim">' + escapeText(String(submission.note)) + "</p>"
              : "") +
            responses.map(answer).join("") +
            files.map(fileRow).join("") +
            defenceBlock(submission) +
            // Handed in, and nothing to read: a file-only submission whose
            // bytes are elsewhere, or a row created before any answer was
            // recorded. Both are facts, and an empty panel would look broken.
            (responses.length === 0 && files.length === 0 && !submission.url
              ? '<p class="dim">Nothing is recorded under this submission — no answers, no files.</p>'
              : "")
          );
        })
        .join("") +
      "</div></div>"
    );
  };

  /**
   * One student: their row, where they stand, and their folded work, in one
   * element the sort and the filters move or hide as a unit — so an open work
   * panel can never be left behind under somebody else's name.
   */
  const student = (entry, dimmed) => {
    const id = String(entry.student_id ?? "");
    const standing = dimmed || !weighted.length ? null : standingOf(id);
    return (
      // The group travels with the student so the filter can act on a
      // departed one too. Their section is not grouped — it is one list of
      // everyone who left — but they belonged to a subgroup while they were
      // here, and a filter that showed the whole departed list under every
      // subgroup would be answering a different question each time.
      '<div class="st" data-group="' +
      escapeText(label(entry)) +
      '" data-name="' +
      escapeText(sortKey(entry)) +
      '" data-missing="' +
      (standing ? standing.missing : 0) +
      '" data-share="' +
      (standing && standing.share !== null ? standing.share : -1) +
      '" data-floor="' +
      (standing && standing.floor !== null ? standing.floor : -1) +
      '">' +
      row(entry, dimmed, standing ? standingBlock(id, standing) : "") +
      workPanel(entry) +
      "</div>"
    );
  };

  const row = (entry, dimmed, below) =>
    '<div class="row' +
    (below ? " has-st" : "") +
    '"><span class="k"' +
    (dimmed ? ' style="color:var(--dim)"' : "") +
    ">" +
    heading(entry.student_id ?? "") +
    (entry.role && entry.role !== "student"
      ? ' <span class="dim">' + escapeText(entry.role) + "</span>"
      : "") +
    '</span><span class="v">' +
    (dimmed
      ? '<span class="todo">' +
        escapeText(entry.status ?? "inactive") +
        "</span>" +
        (label(entry) ? '<br><span class="dim">' + escapeText(label(entry)) + "</span>" : "")
      : marks(entry.student_id)) +
    workButton(entry) +
    "</span>" +
    below +
    "</div>";

  /**
   * The press that opens one person's work, or nothing at all.
   *
   * Absent rather than disabled when there is nothing handed in: a row of
   * dead buttons down a class list of which three have submitted is noise,
   * and "no button" already says it. The count is on the button because the
   * professor is choosing which row to open.
   */
  const workButton = (entry) => {
    const count = (submissionsOf.get(entry.student_id) ?? []).length;
    if (count === 0) return "";
    return (
      '<br><button type="button" class="chip" aria-expanded="false" data-workbtn="' +
      escapeText(String(entry.student_id ?? "")) +
      '">' +
      escapeText(String(count)) +
      (count === 1 ? " submission" : " submissions") +
      "</button>"
    );
  };

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

  const sections = groups
    .map((group) => {
      const members = active.filter((entry) => label(entry) === group).sort(byDisplayed);
      return (
        '<section data-group="' +
        escapeText(group) +
        '"><h2>' +
        escapeText(group === "" ? "No subgroup" : group) +
        ' <span class="dim">· ' +
        escapeText(String(members.length)) +
        " active</span></h2>" +
        members.map((entry) => student(entry, false)).join("") +
        "</section>"
      );
    })
    .join("");

  const departed = inactive.length
    ? '<section data-departed="1"><h2>No longer active</h2>' +
      inactive
        .slice()
        .sort(byDisplayed)
        .map((entry) => student(entry, true))
        .join("") +
      "</section>"
    : "";

  /*
   * Which of the three identity states this render is in, said on screen.
   *
   * The named case gets a band rather than the usual quiet grey line. It is
   * the one state where the screen holds something that must not be projected
   * by accident, and a professor who has just plugged into a lecture-hall HDMI
   * should be able to see it from the back of the room.
   */
  const identityNote = !withNames
    ? note(
        "Pseudonyms — safe to screen-share. Press <b>Names</b> above to go back " +
          "to reading the list; names are what this view opens with.",
      )
    : people === null
      ? note(
          "<b>No names available.</b> There is no roster store at <code>" +
            escapeText(rosterPath()) +
            "</code>. Import a class list with <code>ainar roster import " +
            "export.csv --run " +
            escapeText(runId) +
            "</code>, or point <code>AINAR_ROSTER_DIR</code> at the directory " +
            "holding it.",
        )
      : // Names are the normal state now, so this is a marker rather than a
        // warning: a filled amber alarm on every load would be wallpaper
        // within a week and would stop being read at the one moment it
        // matters. A coloured rule and one sentence stay legible.
        '<p style="border-left:3px solid #a5561f;padding-left:10px;margin:8px 0;' +
        'color:#a5561f"><b>Real names on screen.</b> Press <b>Pseudonyms</b> ' +
        "before screen-sharing or projecting this.</p>";

  /*
   * The professor's own grade sheet, when the run has one (`ainar homework
   * sheet`). Synced on a press rather than on every render: the sheet is
   * private, so only the open session can read it — through its Google Drive
   * connector — and a render must not start a turn. The press asks the session,
   * which exports the sheet beside the roster and runs `homework sync`; the
   * sync is deterministic and safe to repeat, so a second press changes
   * nothing unless the sheet did.
   */
  const sheet = loadSheetConfig(runId);
  const sheetPrompt = sheet
    ? "Sync the grade sheet for " + runId + ". Read the Google Sheet " + (sheet.url ?? "(no URL set)") +
      (sheet.tab ? ", tab \"" + sheet.tab + "\"," : "") +
      " with the Google Drive connector and write it as CSV — the header row and every row, empty cells kept — to " +
      exportPath(runId) + ". Then run `ainar homework sync " + runId + " --from \"" + exportPath(runId) +
      "\"` and tell me what it wrote, and every `check` and `held` line."
    : "";
  const sheetHtml = sheet
    ? '<p class="dim">Grade sheet: ' +
      Object.entries(sheet.columns)
        .map(([column, id]) => escapeText(column) + " → " + escapeText((weighted.find((a) => a.assessment_id === id) ?? {}).title ?? id))
        .join(", ") +
      " · " +
      (sheet.synced_at ? "last synced " + escapeText(stamp(sheet.synced_at)) : "never synced") +
      ' <button type="button" class="chip" data-ask="' + escapeText(sheetPrompt) + '">Sync from sheet</button></p>'
    : "";

  const header =
    "<section><h2>Students</h2>" +
    '<p class="dim">' +
    escapeText(String(active.length)) +
    " active" +
    (inactive.length ? " · " + escapeText(String(inactive.length)) + " no longer active" : "") +
    (groups.filter((group) => group !== "").length
      ? " · " + escapeText(String(groups.filter((group) => group !== "").length)) + " subgroups"
      : "") +
    "</p>" +
    (behind
      ? '<p><span class="todo">' + behind + (behind === 1 ? " student has" : " students have") +
        " work past due and not handed in</span></p>"
      : "") +
    sheetHtml +
    (unrecorded.size
      ? note(
          "Past due with <b>no hand-ins recorded for anyone</b>, so drawn as <b>?</b> rather than missing: " +
            [...unrecorded]
              .map((id) => escapeText((weighted.find((a) => a.assessment_id === id) ?? {}).title ?? id))
              .join(", ") +
            ". Bring them in from Canvas with <code>ainar lms import-submissions " +
            escapeText(runId) +
            " --assessment …</code>; the repository links come with them.",
        )
      : "") +
    identityNote +
    (synthetic
      ? note(
          "Read from <code>samples/</code>: synthetic fixtures, not the roster. " +
            "Real enrollments come from Supabase.",
        )
      : "") +
    refusedHtml +
    "</section>";

  /*
   * The subgroup filter, drawn above everything else.
   *
   * Inside the document rather than in the pane's segmented row, and filtering
   * in the page rather than refetching. Three reasons, in order of weight:
   *
   * * the groups are a property of the run, so the browser half would have to
   *   be told them before it could draw a control for them — a header, a
   *   parse, and a second source of truth for what the subgroups are;
   * * a refetch per press would re-resolve the roster and rebuild the list to
   *   show a subset of what is already on screen;
   * * the professor switching between CSS4007-ENG-8 and -9 in a meeting wants
   *   it to happen at the speed of a click.
   *
   * Only drawn when there is something to choose between: one subgroup, or
   * none at all, and the control would be a row of buttons that all do the
   * same thing.
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
            chip(
              group,
              group === "" ? "No subgroup" : group,
              active.filter((entry) => label(entry) === group).length,
              false,
            ),
          )
          .join("")
      : "";
  const sortChip = (value, text, pressed) =>
    '<button type="button" class="chip" data-sort="' + value + '" aria-pressed="' + (pressed ? "true" : "false") + '">' +
    escapeText(text) + "</button>";
  const filterBar =
    groupChips || weighted.length
      ? '<div class="chips">' +
        groupChips +
        (behind
          ? '<button type="button" class="chip" data-missing-only aria-pressed="false">Missing work only ' +
            '<span class="dim">' + behind + "</span></button>"
          : "") +
        (weighted.length
          ? '<span class="dim sortl">Sort</span>' +
            sortChip("name", "Name", true) +
            sortChip("missing", "Most missing", false) +
            sortChip("share", "Lowest %", false) +
            sortChip("floor", "Lowest floor", false)
          : "") +
        "</div>"
      : "";

  /*
   * The filter, as eighteen lines of DOM toggling.
   *
   * `hidden` rather than a class, so a section that is filtered out is out of
   * the accessibility tree as well as off the screen — a screen reader running
   * down a filtered list should not read the ninety students the professor
   * just filtered away.
   *
   * The departed section is handled row by row and then hidden if it emptied,
   * because it is one list rather than one section per group.
   */
  // Missing-only hides every student with nothing overdue, the departed list
  // included: nobody who left has work still due. Sorting reorders students
  // inside their own section, never across subgroups.
  const filterScript = filterBar
    ? "<script>(function(){" +
      "var chips=[].slice.call(document.querySelectorAll('.chip[data-filter]'));" +
      "var sorts=[].slice.call(document.querySelectorAll('.chip[data-sort]'));" +
      "var only=document.querySelector('.chip[data-missing-only]');" +
      "var sections=[].slice.call(document.querySelectorAll('section[data-group]'));" +
      "var gone=document.querySelector('section[data-departed]');" +
      "var want='*',lacking=false;" +
      "function apply(){" +
      "chips.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.filter===want));});" +
      "if(only)only.setAttribute('aria-pressed',String(lacking));" +
      "sections.forEach(function(s){var seen=0;" +
      "[].forEach.call(s.querySelectorAll('.st'),function(r){var off=lacking&&r.dataset.missing==='0';r.hidden=off;if(!off)seen++;});" +
      "s.hidden=(want!=='*'&&s.dataset.group!==want)||seen===0;});" +
      "if(gone){var left=0;" +
      "[].forEach.call(gone.querySelectorAll('.st'),function(r){" +
      "var off=lacking||(want!=='*'&&r.dataset.group!==want);r.hidden=off;if(!off)left++;});" +
      "gone.hidden=left===0;}" +
      "}" +
      "function order(by){" +
      "sorts.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.sort===by));});" +
      "sections.concat(gone?[gone]:[]).forEach(function(s){" +
      "var list=[].slice.call(s.querySelectorAll('.st'));" +
      "list.sort(function(a,b){var d=0;" +
      "if(by==='missing')d=Number(b.dataset.missing)-Number(a.dataset.missing);" +
      "else if(by==='share'||by==='floor')d=Number(a.dataset[by])-Number(b.dataset[by]);" +
      "return d||a.dataset.name.localeCompare(b.dataset.name);});" +
      "list.forEach(function(r){s.appendChild(r);});});" +
      "}" +
      "chips.forEach(function(c){c.addEventListener('click',function(){want=c.dataset.filter;apply();});});" +
      "if(only)only.addEventListener('click',function(){lacking=!lacking;apply();});" +
      "sorts.forEach(function(c){c.addEventListener('click',function(){order(c.dataset.sort);});});" +
      "})();</script>"
    : "";

  /*
   * The disclosure, as nine lines of DOM toggling.
   *
   * `hidden` rather than a class, for the filter's reason: a panel nobody has
   * opened should be out of the accessibility tree as well as off the screen.
   * A screen reader running down a class list must not read every student's
   * answers aloud.
   *
   * The panel is found by `data-work` matching the button's `data-workbtn`
   * rather than by DOM adjacency, so the two can be reordered without this
   * quietly opening the wrong person's work.
   */
  const workScript =
    "<script>(function(){" +
    "[].forEach.call(document.querySelectorAll('[data-workbtn]'),function(b){" +
    "b.addEventListener('click',function(){" +
    "var panel=document.querySelector('[data-work=\"'+b.dataset.workbtn+'\"]');" +
    "if(!panel)return;" +
    "panel.hidden=!panel.hidden;" +
    "b.setAttribute('aria-expanded',String(!panel.hidden));" +
    "});});" +
    "})();</script>";

  /*
   * What a work panel needs that `documentPage` does not have.
   *
   * `.row[hidden]` is the one that is not cosmetic. `documentPage` gives
   * `.row` a `display:flex`, and an author `display` beats the user agent's
   * `[hidden]{display:none}` — so without this line every panel is open on
   * load, which is precisely the state this view must never boot into.
   */
  const workStyle =
    "<style>" +
    ".row.work{display:block;border-bottom:1px solid var(--line);padding:0}" +
    // AFTER `.row.work`, and the order is the whole point. Both selectors
    // score the same, so the later one wins — with these two the other way
    // round every panel was open on load, which is the one state this view
    // must never boot into. Written as the more specific selector as well, so
    // that a rule added between them cannot bring the bug back.
    ".row.work[hidden]{display:none}" +
    ".wk{padding:2px 0 10px 10px;border-left:2px solid var(--line);margin:0 0 6px}" +
    ".wk h3{font-size:12px;margin:10px 0 2px;letter-spacing:.04em;text-transform:uppercase;" +
    "color:var(--dim)}" +
    ".wk h3:first-child{margin-top:2px}" +
    ".wk p{margin:0 0 4px}" +
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
    ".defence{margin:8px 0 4px}" +
    ".defence .chip{margin-left:4px}" +
    ".dq{margin:4px 0 0;padding-left:20px}" +
    ".dq li{margin:0 0 8px}" +
    ".dq p{margin:0 0 2px;overflow-wrap:anywhere}" +
    ".dq .dim{font-size:12px}" +
    // A student's row is the last child of its wrapper whether or not work
    // follows it, and `documentPage` drops the rule under a last child.
    ".st>.row:not(.work){border-bottom:1px solid var(--line)}" +
    ".row.has-st{flex-wrap:wrap;row-gap:2px}" +
    ".standing{flex:1 0 100%;font-size:12px;margin:2px 0 4px}" +
    ".standing p{margin:0 0 3px}" +
    ".blocks .blk{margin-right:14px;white-space:nowrap}" +
    ".kind{display:flex;align-items:center;gap:6px;margin:2px 0;flex-wrap:wrap}" +
    ".kl{width:72px;color:var(--dim)}" +
    ".cells{display:inline-flex;gap:3px;flex-wrap:wrap}" +
    ".c{display:inline-block;min-width:26px;padding:0 3px;text-align:center;border-radius:3px;" +
    "border:1px solid var(--line);font-variant-numeric:tabular-nums;line-height:18px;text-decoration:none;color:var(--fg)}" +
    ".c.graded{background:var(--infobg);border-color:transparent}" +
    ".c.in{color:var(--info);border-style:dashed;border-color:var(--info)}" +
    ".c.missing{background:var(--warnbg);color:var(--warn);border-color:var(--warn);font-weight:600}" +
    ".c.ahead{color:var(--dim)}" +
    ".c.unrecorded{color:var(--dim);border-style:dotted}" +
    ".c.repo{text-decoration:underline;text-underline-offset:2px}" +
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
    "parent.postMessage({source:'professor-pane',kind:'ask',prompt:k.getAttribute('data-ask')},'*');return;}" +
    "var d=e.target.closest&&e.target.closest('button[data-desk]');" +
    "if(d){parent.postMessage({source:'professor-pane',kind:'defence-desk'," +
    "assessment:d.getAttribute('data-desk'),student:d.getAttribute('data-student')},'*');return;}" +
    "var b=e.target.closest&&e.target.closest('button[data-defence]');if(!b||b.disabled)return;" +
    "b.disabled=true;b.textContent='Cloning…';" +
    "parent.postMessage({source:'professor-pane',kind:'defence'," +
    "assessment:b.getAttribute('data-defence'),student:b.getAttribute('data-student')},'*');" +
    "});})();</script>";

  return documentPage(
    workStyle + filterBar + header + sections + departed + filterScript + workScript + defenceScript + VIEW_SCRIPT,
    dark,
  );
};
