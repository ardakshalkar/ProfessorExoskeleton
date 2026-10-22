/**
 * The window a number in the Students view's header opens: one assessment,
 * across the class.
 *
 * What the professor asks of a column before any one cell: how many handed it
 * in, how many are missing, what the graded ones came to and how they spread,
 * which questions went worst — and, for a paper exam, where its scans stand.
 * Every figure is the gradebook's row (score, status) or a decided mark on an
 * evaluation, counted here; the browser half only shows and hides the panel.
 * A suggested mark is counted as waiting, never averaged in: it is not a grade.
 */

import { escapeAttribute, escapeText } from "./markdown.js";

const round = (value) => String(Math.round(value * 10) / 10);

const median = (sorted) =>
  sorted.length === 0
    ? null
    : sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

/** Mean, median, spread and ends of a list of numbers; nulls when it is empty. */
export const describe = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, mean: null, median: null, sd: null, low: null, high: null };
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const sd = Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length);
  return { n: sorted.length, mean, median: median(sorted), sd, low: sorted[0], high: sorted[sorted.length - 1] };
};

/**
 * One assessment's figures.
 *
 * `cells` is one entry per active student: `{ student, group, state, entry }`,
 * the state being the Students view's own (graded, in, missing, unrecorded,
 * ahead) and `entry` the gradebook row. `criteria` is the rubric's, and
 * `evaluations` the assessment's. `pile` is the scan standing, or null; its
 * `held` papers, when it has them, are listed with their nearest students, and
 * their written names kept only when `names` is on.
 *
 * `items`, `responses` and `submissions` are the assessment's, for what a
 * question opens into: its wording in each variant, the key and guidance it
 * is marked by, and every answer with the mark it got and why.
 */
export const summarise = ({ assessment, cells, criteria = [], evaluations = [], pile = null, names = false, items = [], responses = [], submissions = [], cases = [] }) => {
  const count = (state) => cells.filter((cell) => cell.state === state).length;
  const missing = cells.filter((cell) => cell.state === "missing").map((cell) => cell.student);
  // A student counted missing while a paper placed on nobody is nearest them:
  // most often a name the reader misspelt, so the paper is theirs.
  const held = (pile?.held ?? []).map((paper) => ({
    file: paper.file,
    pages: paper.pages,
    variant: paper.variant ?? null,
    written: names ? paper.written ?? null : null,
    candidates: paper.candidates.map((student) => ({ student, missing: missing.includes(student) })),
  }));
  const graded = cells.filter((cell) => cell.state === "graded");
  const percent = (cell) => (100 * cell.entry.score) / cell.entry.maximum;
  const percents = graded.map(percent);
  const bins = Array.from({ length: 10 }, () => 0);
  // Who is in each bar, highest mark first: the bar's hover names them.
  const binned = Array.from({ length: 10 }, () => []);
  for (const cell of graded) {
    const bin = Math.min(9, Math.max(0, Math.floor(percent(cell) / 10)));
    bins[bin] += 1;
    binned[bin].push({ student: cell.student, score: cell.entry.score });
  }
  for (const list of binned) list.sort((a, b) => b.score - a.score || a.student.localeCompare(b.student));

  const groupNames = [...new Set(cells.map((cell) => cell.group))].sort();
  const groups =
    groupNames.length > 1
      ? groupNames.map((group) => {
          const mine = cells.filter((cell) => cell.group === group);
          return {
            group,
            students: mine.length,
            missing: mine.filter((cell) => cell.state === "missing").length,
            ...describe(mine.filter((cell) => cell.state === "graded").map(percent)),
          };
        })
      : [];

  const studentOf = new Map(submissions.map((entry) => [entry.submission_id, String(entry.student_id ?? "")]));
  const isDecided = (entry) => entry.professor_decision && ["approved", "overridden"].includes(entry.status);
  const questions = criteria.map((criterion) => {
    const mine = evaluations.filter((entry) => entry.criterion_id === criterion.criterion_id);
    const decided = mine.filter(isDecided);
    const maximum = Number(criterion.maximum_score) || 0;
    const stats = describe(decided.map((entry) => Number(entry.professor_decision.score)));
    // The same question in every variant: one criterion, one item per variant.
    const asked = items
      .filter((item) => item.criterion_id === criterion.criterion_id)
      .sort((a, b) => String(a.extensions?.variant ?? "").localeCompare(String(b.extensions?.variant ?? "")));
    const variantOf = new Map(asked.map((item) => [item.item_id, item.extensions?.variant ?? null]));
    const answers = mine.map((entry) => {
      const response = responses.find((row) => row.submission_id === entry.submission_id && variantOf.has(row.item_id));
      const scan = response?.extensions?.scan ?? {};
      const text = String(response?.raw_response ?? "").trim();
      const mark = isDecided(entry) ? entry.professor_decision : entry.ai_suggestion;
      return {
        student: studentOf.get(entry.submission_id) ?? entry.submission_id,
        variant: response ? variantOf.get(response.item_id) : null,
        text,
        blank: Boolean(response) && (Boolean(scan.blank) || !text),
        page: scan.page ?? null,
        read: scan.confidence ?? null,
        score: mark && typeof mark.score === "number" ? mark.score : null,
        decided: Boolean(isDecided(entry)),
        // The professor's own comment when there is one, else the grader's reason.
        comment: entry.professor_decision?.comment || entry.ai_suggestion?.comment || null,
        suggested: entry.ai_suggestion && typeof entry.ai_suggestion.score === "number" ? entry.ai_suggestion.score : null,
      };
    });
    const at = (score) => answers.filter((answer) => answer.score === score).length;
    return {
      id: criterion.criterion_id,
      title: String(criterion.title ?? criterion.criterion_id),
      maximum,
      decided: decided.length,
      waiting: mine.length - decided.length,
      mean: stats.mean,
      percent: stats.mean === null || !maximum ? null : (100 * stats.mean) / maximum,
      variants: asked.map((item) => ({
        variant: item.extensions?.variant ?? null,
        item_id: item.item_id,
        prompt: String(item.prompt ?? ""),
        key: item.answer_key ? String(item.answer_key) : null,
        guidance: item.marking_guidance ? String(item.marking_guidance) : null,
      })),
      levels: (criterion.levels ?? [])
        .map((level) => ({ score: Number(level.score), description: String(level.description ?? level.label ?? ""), count: at(Number(level.score)) }))
        .sort((a, b) => b.score - a.score),
      answers,
    };
  });

  const lowest = graded
    .slice()
    .sort((a, b) => percent(a) - percent(b))
    .slice(0, 5)
    .map((cell) => ({ student: cell.student, score: cell.entry.score, maximum: cell.entry.maximum }));

  return {
    id: assessment.assessment_id,
    title: String(assessment.title ?? assessment.assessment_id),
    type: assessment.type ?? null,
    weight: typeof assessment.weight === "number" ? assessment.weight : null,
    due: assessment.due_at ?? null,
    maximum: graded[0]?.entry.maximum ?? assessment.maximum_score ?? null,
    students: cells.length,
    counts: {
      graded: graded.length,
      in: count("in"),
      handed: graded.length + count("in"),
      missing: count("missing"),
      unrecorded: count("unrecorded"),
      ahead: count("ahead"),
      held: count("held"),
      voided: count("voided"),
    },
    // The integrity cases on this assessment, open first: the Integrity tab.
    cases: cases
      .map((entry) => ({
        id: entry.case_id,
        student: String(entry.student_id),
        state: entry.state ?? "open",
        outcome: entry.outcome ?? null,
        note: entry.note ?? null,
        opened_at: entry.opened_at ?? null,
        decided_at: entry.decided_at ?? null,
        others: (entry.assessments ?? []).filter((id) => id !== assessment.assessment_id),
      }))
      .sort((a, b) => Number(b.state === "open") - Number(a.state === "open") || a.id.localeCompare(b.id)),
    scores: describe(graded.map((cell) => cell.entry.score)),
    percents: { ...describe(percents), under_half: percents.filter((value) => value < 50).length },
    bins,
    binned,
    // The curve on the record, and each graded total before it — what the
    // Curve tab previews a new curve against.
    curve: assessment.curve ?? null,
    raws: graded.map((cell) => ({ student: cell.student, raw: cell.entry.raw_score ?? cell.entry.score })),
    groups,
    questions,
    lowest,
    missing,
    maybe_held: missing.filter((student) => held.some((paper) => paper.candidates.some((candidate) => candidate.student === student))),
    scans: pile
      ? {
          stages: pile.stages,
          now: { title: pile.now.title, body: pile.now.body },
          lanes: pile.lanes ?? null,
          placed: pile.status.placed.length,
          read: pile.status.transcribed.length,
          no_scan: pile.status.missing.length,
          canvas: pile.canvas,
          held,
        }
      : null,
  };
};

/**
 * The panel for one summary, hidden until its header number is pressed.
 * `nameOf(student)` is the name to draw, or the pseudonym; `when(iso)` a date;
 * `crop(paper)` the address of a held paper's name line, or null — it is the
 * handwritten name, so only with names on; `page(student, n)` the address of a
 * page of a student's scan, or null, loaded only when its answer is opened.
 */
export const windowPanel = (summary, { nameOf, when, crop = () => null, page = () => null, reports = null }) => {
  const s = summary;
  const c = s.counts;
  const stat = (label, value, warm = false) =>
    '<div class="aws"><div class="dim">' + label + '</div><div class="awv' + (warm ? " low" : "") + '">' + value + "</div></div>";
  const pct = (value) => (value === null ? "—" : round(value) + "%");
  const pts = (value) => (value === null ? "—" : round(value));
  const facts = [
    s.type ? escapeText(s.type) : null,
    s.maximum !== null ? "out of " + escapeText(round(Number(s.maximum))) : null,
    s.weight !== null ? escapeText(round(s.weight * 100)) + "% of the course" : null,
    s.due ? "due " + escapeText(when(s.due)) : "no due date",
  ].filter(Boolean);

  // Who handed it in, in one bar: graded, handed in and waiting, missing,
  // not imported, not due — the legend's colours, in the strip's order.
  const share = (n) => (s.students ? (100 * n) / s.students : 0);
  const parts = [
    ["graded", c.graded, "graded"],
    ["in", c.in, "handed in, not graded"],
    ["missing", c.missing, "missing"],
    ["unrecorded", c.unrecorded, "not imported"],
    ["ahead", c.ahead, "not due"],
    ["held", c.held ?? 0, "held by an integrity case"],
    ["voided", c.voided ?? 0, "voided by an integrity case"],
  ].filter(([, n]) => n > 0);
  const handIns =
    '<div class="awbar" role="img" aria-label="' +
    escapeText(parts.map(([, n, label]) => n + " " + label).join(", ")) +
    '">' +
    parts.map(([state, n, label]) => '<span class="m ' + state + '" style="width:' + share(n) + '%" title="' + n + " " + label + '"></span>').join("") +
    "</div>" +
    '<p class="awk dim">' +
    parts.map(([state, n, label]) => '<span class="m ' + state + '"></span>' + n + " " + escapeText(label)).join(" ") +
    "</p>";

  const tallest = Math.max(1, ...s.bins);
  const histogram = s.scores.n
    ? '<div class="awh" role="img" aria-label="How the graded marks spread, in tenths of full marks">' +
      s.bins
        .map(
          (n, i) =>
            '<span class="awc" title="' +
            escapeAttribute(
              (i * 10) + "–" + (i === 9 ? 100 : i * 10 + 9) + "%: " + n +
                (s.binned?.[i] ?? []).map((who) => "\n" + nameOf(who.student) + " — " + round(who.score)).join(""),
            ) +
            '">' +
            '<span class="awf' + (i < 5 ? " low" : "") + '" style="height:' + (100 * n) / tallest + '%"></span>' +
            '<span class="awn">' + (n || "") + "</span></span>",
        )
        .join("") +
      '</div><div class="awx dim"><span>0%</span><span>50%</span><span>100%</span></div>'
    : '<p class="dim">Nothing graded yet' + (c.in ? ": " + c.in + " handed in and waiting for a decided mark." : ".") + "</p>";

  const go = (student, extra = "") =>
    '<button type="button" class="chip" data-aw-student="' + escapeText(student) + '" data-aw-hw="' + escapeText(s.id) + '">' +
    escapeText(nameOf(student)) + extra + "</button>";

  const results =
    "<h3>Results</h3>" +
    handIns +
    '<div class="awst">' +
    stat("Handed in", c.handed + '<span class="dim"> of ' + s.students + "</span>") +
    stat("Missing", String(c.missing), c.missing > 0) +
    stat("Mean", s.scores.n ? pts(s.scores.mean) + ' <span class="dim">' + pct(s.percents.mean) + "</span>" : "—") +
    stat("Median", s.scores.n ? pts(s.scores.median) + ' <span class="dim">' + pct(s.percents.median) + "</span>" : "—") +
    stat("Lowest – highest", s.scores.n ? pts(s.scores.low) + " – " + pts(s.scores.high) : "—") +
    stat("Spread (SD)", s.scores.n ? pts(s.scores.sd) : "—") +
    stat("Under half marks", s.scores.n ? String(s.percents.under_half) : "—", s.percents.under_half > 0) +
    "</div>" +
    histogram;

  const groups = s.groups.length
    ? "<h3>By subgroup</h3><table class=\"awt\"><thead><tr><th>Group</th><th>Graded</th><th>Mean</th><th>Missing</th></tr></thead><tbody>" +
      s.groups
        .map(
          (g) =>
            "<tr><td>" + escapeText(g.group || "No subgroup") + "</td><td>" + g.n + " of " + g.students + "</td><td>" + pct(g.mean) +
            '</td><td class="' + (g.missing ? "low" : "") + '">' + g.missing + "</td></tr>",
        )
        .join("") +
      "</tbody></table>"
    : "";

  // Questions: the list on the left, and what the one pressed opens into on
  // the right — how it is marked, then every answer under the mark it got.
  // How the answers spread over the marks, lowest at the left: one segment
  // per mark, as wide as the answers given it, stronger the higher it is.
  // Blank answers are their own grey segment, apart from a written zero.
  const qbar = (q) => {
    const marked = q.answers.filter((answer) => answer.score !== null);
    if (!marked.length) return '<span class="awdist"></span>';
    const counts = new Map();
    for (const answer of marked) {
      const key = answer.blank ? "blank" : String(answer.score);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const keys = [...counts.keys()].sort((a, b) => (a === "blank" ? -1 : b === "blank" ? 1 : Number(a) - Number(b)));
    const label = keys.map((key) => (key === "blank" ? "blank" : round(Number(key))) + ": " + counts.get(key)).join(" · ");
    return (
      '<span class="awdist" role="img" aria-label="' + escapeText(label) + '">' +
      keys
        .map((key) => {
          const n = counts.get(key);
          const share = (100 * n) / marked.length;
          const title = (key === "blank" ? "Nothing written" : round(Number(key)) + " / " + round(q.maximum)) + ": " + n + " answer" + (n === 1 ? "" : "s");
          if (key === "blank") return '<span class="blank" style="width:' + share + '%" title="' + escapeText(title) + '"></span>';
          const fraction = q.maximum ? Number(key) / q.maximum : 0;
          return (
            '<span class="' + (fraction < 0.5 ? "low" : "") + '" style="width:' + share + "%;opacity:" + (0.35 + 0.65 * fraction).toFixed(2) +
            '" title="' + escapeText(title) + '"></span>'
          );
        })
        .join("") +
      "</span>"
    );
  };
  const qmean = (q) => (q.mean === null ? "—" : round(q.mean) + " / " + round(q.maximum));
  const markText = (value) => (value === null ? "—" : round(value));
  // A mark as a circle filled as far as it is of the full marks, then the number.
  const pie = (value, maximum) =>
    '<span class="awpie" style="--f:' + (value === null || !maximum ? 0 : Math.max(0, Math.min(100, (100 * value) / maximum))).toFixed(1) +
    '%" aria-hidden="true"></span>';
  const mark = (value, maximum) => '<span class="awmark">' + pie(value, maximum) + markText(value) + "</span>";
  const answerCard = (q) => (answer) =>
    '<div class="awans' + (answer.decided ? "" : " sug") + '">' +
    '<div class="awansh">' + mark(answer.score, q.maximum) +
    go(answer.student) +
    (answer.variant ? '<span class="dim">variant ' + escapeText(answer.variant) + "</span>" : "") +
    (answer.decided ? "" : '<span class="dim">suggested, not decided</span>') +
    (answer.decided && answer.suggested !== null && answer.suggested !== answer.score
      ? '<span class="dim">suggested ' + markText(answer.suggested) + "</span>"
      : "") +
    (answer.read && answer.read !== "high" ? '<span class="awmay">' + escapeText(answer.read) + " reading</span>" : "") +
    "</div>" +
    (answer.blank
      ? '<div class="dim">Nothing written.</div>'
      : answer.text
        ? '<div class="awanst">' + escapeText(answer.text) + "</div>"
        : "") +
    (answer.comment && !answer.blank ? '<div class="awwhy">' + escapeText(answer.comment) + "</div>" : "") +
    (answer.page && page(answer.student, answer.page)
      ? '<details class="awpg"><summary>page ' + answer.page + "</summary>" +
        '<img loading="lazy" alt="Page ' + answer.page + '" src="' + escapeText(page(answer.student, answer.page)) + '"></details>'
      : "") +
    "</div>";
  const questionDetail = (q, index) => {
    const placed = new Set(q.levels.map((level) => level.score));
    const under = (score) => q.answers.filter((answer) => answer.score === score && !answer.blank);
    const elsewhere = q.answers.filter((answer) => !answer.blank && !placed.has(answer.score));
    const blanks = q.answers.filter((answer) => answer.blank);
    const card = answerCard(q);
    // The groups as a row of chips above them: press one to see only it.
    const groups = [
      ...q.levels.filter((level) => under(level.score).length).map((level) => [String(level.score), mark(level.score, q.maximum), under(level.score).length, level.description]),
      ...(elsewhere.length ? [["other", '<span class="awmark">·</span>', elsewhere.length, "Off the rubric's levels, or no mark yet"]] : []),
      ...(blanks.length ? [["blank", '<span class="awmark">' + pie(0, 1) + "—</span>", blanks.length, "Nothing written"]] : []),
    ];
    const selector = groups.length > 1
      ? '<div class="awlvsel" role="group" aria-label="Show one mark">' +
        '<button type="button" data-aw-lv="all" aria-pressed="true">All <span class="dim">' + q.answers.length + "</span></button>" +
        groups
          .map(([key, badge, n, title]) => '<button type="button" data-aw-lv="' + key + '" aria-pressed="false" title="' + escapeText(title) + '">' + badge +
            ' <span class="dim">' + n + "</span></button>")
          .join("") +
        "</div>"
      : "";
    return (
      '<div class="awqd" data-aw-qd="' + index + '"' + (index === 0 ? "" : " hidden") + ">" +
      "<h3>" + escapeText(q.title) + ' <span class="dim">· mean ' + qmean(q) + " · " + q.decided + " decided" +
      (q.waiting ? " · " + q.waiting + " waiting" : "") + "</span></h3>" +
      q.variants
        .map(
          (v) =>
            '<details class="awvar"' + (q.variants.length === 1 ? " open" : "") + "><summary>" +
            (v.variant ? "Variant " + escapeText(v.variant) : "The question") + "</summary>" +
            '<div class="awpr">' + escapeText(v.prompt) + "</div>" +
            (v.key ? '<div class="awkey"><b>Key</b> ' + escapeText(v.key) + "</div>" : "") +
            (v.guidance ? '<div class="awkey"><b>Marking</b> ' + escapeText(v.guidance) + "</div>" : "") +
            "</details>",
        )
        .join("") +
      selector +
      (q.levels.length
        ? q.levels
            .map((level) => {
              const here = under(level.score);
              return (
                '<div class="awlv" data-lv="' + level.score + '"><div class="awlvh">' + mark(level.score, q.maximum) +
                "<span>" + escapeText(level.description) + '</span><span class="dim">' + here.length + "</span></div>" +
                here.map(card).join("") + "</div>"
              );
            })
            .join("")
        : "") +
      (elsewhere.length
        ? '<div class="awlv" data-lv="other"><div class="awlvh"><span class="awmark">·</span><span>' +
          (q.levels.length ? "Off the rubric's levels, or no mark yet" : "The answers") +
          '</span><span class="dim">' + elsewhere.length + "</span></div>" +
          elsewhere.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(card).join("") + "</div>"
        : "") +
      (blanks.length
        ? '<details class="awlv" data-lv="blank"><summary class="awlvh"><span class="awmark">' + pie(0, 1) + "—</span><span>Nothing written</span><span class=\"dim\">" +
          blanks.length + "</span></summary>" + blanks.map(card).join("") + "</details>"
        : "") +
      (!q.answers.length ? '<p class="dim">No answer to this question is graded or suggested yet.</p>' : "") +
      "</div>"
    );
  };
  const questions = s.questions.length
    ? '<p class="dim awnote">Means from decided marks only; a suggestion is counted as waiting. Each strip is how the answers spread over the marks, ' +
      "zero at the left, grey for nothing written — hover a segment for its count. Press a question for its answers and how each was marked.</p>" +
      '<div class="awqs"><div class="awql">' +
      s.questions
        .map(
          (q, index) =>
            '<button type="button" class="awqi' + (index === 0 ? " on" : "") + '" data-aw-q="' + index + '">' +
            '<span class="awqt">' + escapeText(q.title) + "</span>" +
            '<span class="awqm num">' + qmean(q) + "</span>" + qbar(q) +
            (q.waiting ? '<span class="awqw dim">' + q.waiting + " waiting</span>" : "") +
            "</button>",
        )
        .join("") +
      '</div><div class="awqdetail">' + s.questions.map(questionDetail).join("") + "</div></div>"
    : "";

  const maybe = new Set(s.maybe_held ?? []);
  const people =
    (s.missing.length
      ? "<h3>Missing (" + s.missing.length + ")</h3>" +
        (maybe.size
          ? '<p class="dim awnote">' + maybe.size + " of them may only be unplaced: a held paper's name is nearest theirs. See Held papers.</p>"
          : "") +
        "<p class=\"awp\">" +
        s.missing.map((student) => go(student, maybe.has(student) ? ' <span class="awmay">· held paper?</span>' : "")).join("") +
        "</p>"
      : "") +
    (s.lowest.length
      ? "<h3>Lowest marks</h3><p class=\"awp\">" +
        s.lowest.map((row) => go(row.student, ' <span class="dim">' + round(row.score) + "/" + round(row.maximum) + "</span>")).join("") +
        "</p>"
      : "");

  // The papers placed on nobody, each with its nearest students as one-press
  // answers — `scans assign`, as the Scans tab's Held lane sends it.
  const heldList = (papers) =>
    papers.length
      ? "<h3>Held papers (" + papers.length + ")</h3>" +
        '<p class="dim awnote">Placed on nobody yet, so whoever wrote them reads as missing. A press places the paper, as Scans does.</p>' +
        papers
          .map((paper) => {
            const src = crop(paper);
            const facts = [
              "pages " + escapeText(paper.pages),
              paper.variant ? "variant " + escapeText(paper.variant) : null,
              paper.written ? "read as “" + escapeText(paper.written) + "”" : null,
            ].filter(Boolean);
            const answers = paper.candidates.length
              ? paper.candidates
                  .map(
                    (candidate) =>
                      '<button type="button" class="chip act" data-aw-place="' + escapeText(s.id) + '" data-file="' + escapeText(paper.file) +
                      '" data-pages="' + escapeText(paper.pages) + '" data-student="' + escapeText(candidate.student) + '">This is ' +
                      escapeText(nameOf(candidate.student)) +
                      (candidate.missing ? ' <span class="dim">· no paper yet</span>' : ' <span class="dim">· has a paper</span>') +
                      "</button>",
                  )
                  .join("")
              : '<span class="dim">No enrolled student is near this name — say who in Scans.</span>';
            return (
              '<div class="awhp">' +
              (src ? '<img class="awcrop" loading="lazy" onerror="this.remove()" alt="The name line of pages ' + escapeText(paper.pages) + '" src="' + escapeText(src) + '">' : "") +
              '<div class="dim">' + facts.join(" · ") + '</div><p class="awp">' + answers + "</p></div>"
            );
          })
          .join("")
      : "";

  const scans = s.scans
    ? (() => {
        const p = s.scans;
        const l = p.lanes;
        return (
          "<h3>Scanned papers</h3>" +
          '<ol class="awsteps">' +
          p.stages
            .map((stage) => '<li class="' + escapeText(stage.state) + '" title="' + escapeText(stage.detail ?? "") + '">' + escapeText(stage.label) + "</li>")
            .join("") +
          "</ol>" +
          '<p><b>' + escapeText(p.now.title) + "</b> " + '<span class="dim">' + escapeText(p.now.body ?? "") + "</span></p>" +
          '<div class="awst">' +
          (l ? stat("Papers in the scans", String(l.placed + l.check + l.held)) : "") +
          stat("Placed on a student", String(p.placed)) +
          (l ? stat("Held — say who", String(l.held), l.held > 0) + stat("Weak match — check", String(l.check), l.check > 0) : "") +
          stat("Read", p.read + '<span class="dim"> of ' + p.placed + "</span>", p.read < p.placed) +
          stat("Enrolled, no scan", String(p.no_scan), p.no_scan > 0) +
          (p.canvas && p.canvas.ready ? stat("In Canvas", p.canvas.sent + '<span class="dim"> of ' + p.canvas.ready + "</span>") : "") +
          "</div>" +
          heldList(p.held ?? []) +
          '<p class="awgo"><button type="button" class="chip act" data-aw-scans="' + escapeText(s.id) + '">Open in Scans</button> ' +
          '<button type="button" class="chip act" data-aw-grade="' + escapeText(s.id) + '" data-label="' + escapeText(s.title) + '">Open the Grade view</button></p>'
        );
      })()
    : "";

  /*
   * The curve: set on this assessment only, never by itself, and applied by
   * the gradebook to each total after totalling (`ainar curve`). The preview
   * is the same formula over the raw totals, redrawn as the numbers change;
   * the students ticked are passed over and keep their marked total.
   */
  const curveTab = (() => {
    if (!s.raws?.length || s.maximum === null) return "";
    const max = Number(s.maximum);
    const cv = s.curve;
    const inForce = cv && cv.approval !== "draft";
    const passed = new Set(cv?.exclude ?? []);
    const topRaw = Math.max(...s.raws.map((r) => r.raw));
    const anchor = cv ? cv.anchor : Math.min(max, topRaw);
    const exponent = cv ? cv.exponent : 1;
    const status = !cv
      ? '<p class="dim">No curve: every total counts as marked.</p>'
      : '<p class="awcvnow' + (inForce ? " on" : "") + '"><b>' + (inForce ? "Curved" : "A draft curve, not applied") + "</b> " +
        '<span class="dim">anchor ' + escapeText(round(cv.anchor)) + " · exponent " + escapeText(round(cv.exponent)) +
        (passed.size ? " · passing over " + passed.size : "") +
        (cv.decided_at ? " · set " + escapeText(when(cv.decided_at)) : "") +
        (cv.note ? " · “" + escapeText(cv.note) + "”" : "") + "</span></p>";
    const everyone = [...new Set([...s.raws.map((r) => r.student), ...passed])]
      .map((student) => ({ student, name: nameOf(student), raw: s.raws.find((r) => r.student === student)?.raw ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const preset = (value, label) =>
      '<button type="button" class="chip" data-cv-exp="' + value + '">' + escapeText(label) + "</button>";
    return (
      "<h3>Curve</h3>" + status +
      '<div class="awcv" data-cv="' + escapeText(s.id) + '" data-max="' + max + '" data-raws="' +
      escapeAttribute(JSON.stringify(s.raws.map((r) => [r.student, r.raw]))) + '">' +
      '<div class="awcvf"><label>Anchor <input type="number" data-cv-anchor min="0.01" max="' + max + '" step="0.5" value="' + escapeText(round(anchor)) + '">' +
      '<span class="dim">the raw total that becomes ' + escapeText(round(max)) + " · highest marked " + escapeText(round(topRaw)) + "</span></label>" +
      '<label>Exponent <input type="number" data-cv-exponent min="0.05" max="1" step="0.05" value="' + escapeText(round(exponent)) + '">' +
      '<span class="awcvp">' + preset(1, "1 · straight") + preset(0.75, "0.75") + preset(0.5, "0.5 · square root") + "</span></label>" +
      '<p class="dim awnote">Each raw total t becomes ' + escapeText(round(max)) + " × (t ÷ anchor)^exponent, never above " + escapeText(round(max)) +
      ". Under 1 the low marks rise most. The marks on each question are never changed; taking the curve off puts every total back.</p></div>" +
      '<div class="awcvpre" aria-live="polite"></div>' +
      '<details class="awcvx"' + (passed.size ? " open" : "") + '><summary>Pass over students <span class="dim" data-cv-count>' +
      (passed.size ? passed.size + " passed over" : "none") + "</span></summary>" +
      '<p class="dim awnote">A ticked student keeps the total they were marked — an integrity case, a retake marked on its own terms. Say why in the note.</p>' +
      '<input type="search" class="awcvq" placeholder="Find a student" aria-label="Find a student">' +
      '<div class="awcvl">' +
      everyone
        .map(
          (p) =>
            '<label data-cv-who="' + escapeText(p.name.toLowerCase()) + '"><input type="checkbox" data-cv-ex="' + escapeText(p.student) + '"' +
            (passed.has(p.student) ? " checked" : "") + "> " + escapeText(p.name) +
            ' <span class="dim">' + (p.raw === null ? "not graded" : escapeText(round(p.raw))) + "</span></label>",
        )
        .join("") +
      "</div></details>" +
      '<label class="awcvn">Note <input type="text" data-cv-note maxlength="500" placeholder="Why this curve, and why anyone is passed over" value="' +
      escapeAttribute(cv?.note ?? "") + '"></label>' +
      '<p class="awgo"><button type="button" class="chip act" data-cv-apply>' + (cv ? "Apply the changed curve" : "Apply curve") + "</button> " +
      (cv ? '<button type="button" class="chip" data-cv-clear>Take the curve off</button>' : "") + "</p></div>"
    );
  })();

  /*
   * Exam reports: made in the harness (`ainar report exam`), one PDF per
   * student and the professor's own with a page each; sent as a comment on
   * each student's Canvas submission with theirs attached (`lms send-reports`).
   * Sending asks for the plan first and shows it before anything leaves.
   */
  const reportsTab = (() => {
    if (!reports || !s.counts.handed) return "";
    const r = reports;
    return (
      "<h3>Reports</h3>" +
      '<p class="dim awnote">Each student’s report has every question, their answer, the rubric with the level they got, their mark, and how many in the class got full marks. ' +
      "Only decided marks are printed. Your report has a summary page, then one page per student.</p>" +
      (r.made
        ? '<div class="awst">' +
          stat("Reports made", String(r.count) + (r.madeAt ? ' <span class="dim">' + escapeText(when(r.madeAt)) + "</span>" : "")) +
          stat("Fully marked — can be sent", String(r.ready), r.ready < r.count) +
          stat("Sent to Canvas", r.sent + '<span class="dim"> of ' + r.ready + "</span>") +
          "</div>"
        : '<p class="dim">No reports yet.</p>') +
      '<p class="awgo" data-rp="' + escapeText(s.id) + '">' +
      (r.classUrl
        ? '<a class="chip act" href="' + escapeAttribute(r.classUrl) + '" target="_blank" rel="noopener" data-view="' +
          escapeAttribute(s.title + " — class report") + '" data-format="pdf">Open my report (PDF)</a> '
        : "") +
      '<button type="button" class="chip' + (r.made ? "" : " act") + '" data-rp-make>' + (r.made ? "Make them again" : "Make the reports") + "</button> " +
      (r.made && r.ready ? '<button type="button" class="chip act" data-rp-send>Send to students in Canvas…</button>' : "") +
      "</p>" +
      (r.hidden ? '<p class="dim awnote">Your report names everyone, so it opens with real names on.</p>' : "") +
      '<p class="dim awnote">Making takes about a minute for a class of sixty. Making them again after a change of marks replaces the PDFs; a student already sent the earlier report is offered the new one.</p>'
    );
  })();

  /*
   * Integrity cases on this assessment: each with its student, where it
   * stands and the professor's note folded away (this window is projected),
   * and the decision — Clear, or Uphold with what it does to the mark — for an
   * open one, Reopen for a decided one. `ainar integrity decide` writes it;
   * a case is opened from the student's hand-in, not here.
   */
  const integrityTab = (() => {
    const cases = s.cases ?? [];
    if (!cases.length && !c.handed) return "";
    const said = (entry) =>
      entry.state === "open"
        ? "open — the mark is held, off the curve"
        : entry.state === "cleared"
          ? "cleared — the mark counts as marked"
          : "upheld — " +
            ({
              no_penalty: "no penalty: the mark counts, off the curve",
              adjusted: "mark adjusted: the decided mark counts, off the curve",
              zero: "the mark is 0",
              voided: "voided: out of the student's total, excused in Canvas",
            }[entry.outcome] ?? entry.outcome);
    const decide = (entry) =>
      entry.state === "open"
        ? '<span class="awicd" data-ic="' + escapeText(entry.id) + '">' +
          presetChips(DECISION_NOTES) +
          '<textarea data-ic-note rows="2" maxlength="2000" placeholder="Decision note (optional) — added under the opening note, private"></textarea>' +
          '<button type="button" class="chip" data-ic-decide="cleared">Clear</button> ' +
          '<select data-ic-outcome aria-label="What upholding it does to the mark">' +
          '<option value="zero">Uphold — mark 0</option>' +
          '<option value="voided">Uphold — void it (EX)</option>' +
          '<option value="adjusted">Uphold — I adjusted the marks</option>' +
          '<option value="no_penalty">Uphold — no penalty</option>' +
          "</select> " +
          '<button type="button" class="chip act" data-ic-decide="upheld">Decide</button></span>'
        : '<span class="awicd" data-ic="' + escapeText(entry.id) + '"><button type="button" class="chip" data-ic-decide="open">Reopen</button></span>';
    return (
      "<h3>Integrity</h3>" +
      '<p class="dim awnote">An open case holds the student’s mark and keeps it off the curve. Clearing it lets the mark count; upholding it applies what you choose. ' +
      "Only the mark reaches Canvas — a voided one as excused (EX) — never the case or its note. To open a case, press the student’s cell and open it on their hand-in.</p>" +
      (cases.length
        ? '<div class="awic" data-ic-for="' + escapeText(s.id) + '">' +
          cases
            .map(
              (entry) =>
                '<div class="awicr' + (entry.state === "open" ? " on" : "") + '">' +
                '<div><b>' + escapeText(nameOf(entry.student)) + '</b> <span class="dim">' + escapeText(entry.id) +
                (entry.others.length ? " · also " + escapeText(entry.others.join(", ")) : "") +
                (entry.opened_at ? " · opened " + escapeText(when(entry.opened_at)) : "") +
                (entry.decided_at ? " · decided " + escapeText(when(entry.decided_at)) : "") + "</span></div>" +
                '<div class="awics">' + escapeText(said(entry)) + "</div>" +
                (entry.note ? '<details class="awicn"><summary>Note</summary>' + escapeText(entry.note) + "</details>" : "") +
                decide(entry) +
                "</div>",
            )
            .join("") +
          "</div>"
        : '<p class="dim">No integrity cases on this assessment.</p>')
    );
  })();
  const openCases = (s.cases ?? []).filter((entry) => entry.state === "open").length;

  // One tab per part, so each is a press away rather than a scroll down.
  const tabs = [
    ["overview", "Overview", results + groups],
    ["curve", "Curve" + (s.curve && s.curve.approval !== "draft" ? " · on" : ""), curveTab],
    ["integrity", "Integrity" + (openCases ? " · " + openCases + " open" : (s.cases ?? []).length ? " (" + s.cases.length + ")" : ""), integrityTab],
    ["reports", "Reports" + (reports?.made ? " · " + reports.count : ""), reportsTab],
    ["questions", "Questions" + (s.questions.length ? " (" + s.questions.length + ")" : ""), questions],
    ["scans", "Scans", scans],
    ["people", "Students" + (s.missing.length ? " · " + s.missing.length + " missing" : ""), people],
  ].filter(([, , html]) => html);
  return (
    '<div class="awpanel" data-aw-panel="' + escapeText(s.id) + '" hidden>' +
    '<div class="awhead"><div class="awheadtop"><div><div class="awtitle">' + escapeText(s.title) + '</div><div class="dim">' + facts.join(" · ") + "</div></div>" +
    '<button type="button" class="dwk" data-aw-close aria-label="Close" title="Close (Esc)">×</button></div>' +
    '<div class="awtabs" role="tablist">' +
    tabs
      .map(([key, title], index) => '<button type="button" role="tab" data-aw-tab="' + key + '" aria-selected="' + (index === 0) + '">' + escapeText(title) + "</button>")
      .join("") +
    "</div></div>" +
    '<div class="awbody">' +
    tabs.map(([key, , html], index) => '<section data-aw-sec="' + key + '"' + (index === 0 ? "" : " hidden") + ">" + html + "</section>").join("") +
    "</div>" +
    "</div>"
  );
};

/*
 * Preset answers for an integrity case's note: presses that add a line to the
 * `[data-ic-note]` field beside them, once each, the field staying editable.
 * Used by the opener on a hand-in (students.js) and the decision here.
 */
export const presetChips = (list) =>
  '<span class="icp">' +
  list
    .map((text) => '<button type="button" class="chip" data-ic-preset="' + escapeAttribute(text) + '">' + escapeText(text) + "</button>")
    .join("") +
  "</span>";

export const presetScript =
  "<script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-ic-preset]');if(!b)return;" +
  "var box=b.closest('.rgb,.awicd'),f=box&&box.querySelector('[data-ic-note]');if(!f)return;" +
  "var t=b.getAttribute('data-ic-preset'),v=f.value.trim();if(v.split('\\n').indexOf(t)<0)f.value=(v?v+'\\n':'')+t;" +
  "b.setAttribute('aria-pressed','true');f.focus();});</script>";

/** The decision notes offered beside an open case's Clear and Decide. */
const DECISION_NOTES = [
  "Admitted at the meeting",
  "Confirmed by comparing the papers",
  "Explanation accepted",
  "Not enough evidence",
  "First offence: a warning",
  "Referred to the faculty committee",
];

/** The dialog holding every panel; one is shown at a time. */
export const assessmentDialog = (panels) => '<dialog class="aw" aria-label="Assessment across the class">' + panels.join("") + "</dialog>";

export const assessmentWindowStyle =
  ".th .n[data-aw]{cursor:pointer;font:inherit;font-size:10px;background:none;border:0;padding:0;color:var(--dim)}" +
  ".th .n[data-aw]:hover,.th .n[data-aw]:focus-visible{color:var(--info);outline:1px solid var(--accent-line,var(--info));outline-offset:1px}" +
  // Docked to the right, the full height: the class list stays in view at the left.
  "dialog.aw{width:min(1180px,96vw);height:100vh;max-height:100vh;margin:0 0 0 auto;padding:0;border:0;border-left:1px solid var(--line);" +
  "border-radius:0;background:var(--dwbg);color:var(--fg);box-shadow:-10px 0 40px rgba(0,0,0,.22);overflow:hidden}" +
  "dialog.aw::backdrop{background:rgba(0,0,0,.22)}" +
  ".awpanel{display:flex;flex-direction:column;height:100%}.awpanel[hidden]{display:none}" +
  ".awhead{padding:12px 18px 0;border-bottom:1px solid var(--line);background:var(--dwbg)}" +
  ".awheadtop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}" +
  ".awtitle{font-size:16px;font-weight:600}" +
  ".awtabs{display:flex;gap:2px;margin-top:10px}" +
  ".awtabs button{font:inherit;font-size:12px;background:none;border:0;border-bottom:2px solid transparent;padding:6px 12px;color:var(--dim);cursor:pointer}" +
  ".awtabs button[aria-selected=true]{color:var(--fg);border-bottom-color:var(--info);font-weight:600}" +
  ".awbody{flex:1;min-height:0;overflow:auto;padding:4px 18px 18px}" +
  ".awbody section[hidden]{display:none}" +
  ".awqs{display:grid;grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:16px;align-items:start}" +
  ".awql{position:sticky;top:0;display:flex;flex-direction:column;gap:2px;padding-top:6px}" +
  ".awqi{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;text-align:left;font:inherit;font-size:12px;" +
  "background:none;border:1px solid transparent;border-radius:6px;padding:6px 8px;color:var(--fg);cursor:pointer}" +
  ".awqi:hover{background:var(--line)}.awqi.on{border-color:var(--info);background:var(--infobg)}" +
  ".awqw{grid-column:1/-1;font-size:10.5px}" +
  ".awdist{grid-column:1/-1;display:flex;gap:1px;height:9px;border-radius:3px;overflow:hidden;background:var(--line)}" +
  ".awdist span{display:block;height:100%;min-width:2px;background:var(--info)}.awdist span.low{background:var(--warn)}" +
  ".awdist span.blank{background:var(--dim);opacity:.25}" +
  ".awqd[hidden]{display:none}.awqd h3{margin-top:10px}" +
  ".awvar{border:1px solid var(--line);border-radius:6px;padding:4px 10px;margin:0 0 6px;font-size:12px}" +
  ".awvar summary{cursor:pointer;font-weight:600}" +
  ".awpr{white-space:pre-wrap;margin:6px 0}.awkey{margin:4px 0;color:var(--dim)}.awkey b{color:var(--fg)}" +
  ".awlv{margin:12px 0 0}.awlvh{display:flex;gap:8px;align-items:baseline;font-size:12px;padding:4px 0;border-bottom:1px solid var(--line)}" +
  "summary.awlvh{cursor:pointer}.awlvh .dim{margin-left:auto}" +
  ".awmark{display:inline-flex;align-items:center;gap:5px;min-width:30px;font-weight:700;font-variant-numeric:tabular-nums;" +
  "border-radius:4px;padding:1px 6px 1px 4px;background:var(--infobg)}" +
  ".awpie{display:inline-block;flex:none;width:13px;height:13px;border-radius:50%;box-sizing:border-box;border:1.5px solid var(--info);" +
  "background:conic-gradient(var(--info) var(--f),transparent 0)}" +
  ".awans{border:1px solid var(--line);border-radius:6px;padding:6px 10px;margin:6px 0 0;font-size:12px}" +
  ".awans.sug .awmark{background:none;border:1px dashed var(--line)}" +
  ".awlvsel{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0 2px;position:sticky;top:0;z-index:1;padding:6px 0;background:var(--dwbg)}" +
  ".awlvsel button{display:inline-flex;align-items:center;gap:3px;font:inherit;font-size:12px;cursor:pointer;color:var(--fg);" +
  "background:none;border:1px solid var(--line);border-radius:14px;padding:2px 8px 2px 3px}" +
  ".awlvsel button .awmark{background:none;padding:0 2px}" +
  ".awlvsel button[data-aw-lv=all]{padding-left:9px}" +
  ".awlvsel button[aria-pressed=true]{border-color:var(--info);background:var(--infobg)}" +
  ".awlv[hidden]{display:none}" +
  ".awansh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px}" +
  ".awanst{white-space:pre-wrap;line-height:1.45}" +
  ".awwhy{margin-top:4px;padding-left:8px;border-left:2px solid var(--info);color:var(--dim)}" +
  ".awpg summary{cursor:pointer;font-size:11px;color:var(--dim);margin-top:4px}" +
  ".awpg img{display:block;max-width:100%;margin-top:4px;border-radius:4px;background:#fff;border:1px solid var(--line)}" +
  ".awbody h3{font-size:13px;margin:16px 0 6px}" +
  ".awbar{display:flex;height:12px;border-radius:3px;overflow:hidden;gap:1px}" +
  ".awbar .m{height:12px;border-radius:0;min-width:3px}" +
  ".awk{font-size:11px;margin:5px 0 8px}.awk .m{margin:0 3px 0 10px}.awk .m:first-child{margin-left:0}" +
  ".awst{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:6px;margin:6px 0 10px}" +
  ".aws{border:1px solid var(--line);border-radius:6px;padding:5px 9px}.aws .dim{font-size:11px}" +
  ".awv{font-size:17px;font-variant-numeric:tabular-nums}.awv .dim{font-size:12px}.awv.low{color:var(--warn)}" +
  ".awh{display:flex;align-items:flex-end;gap:3px;height:90px;border-bottom:1px solid var(--line)}" +
  ".awc{flex:1;position:relative;height:100%;display:flex;align-items:flex-end}" +
  ".awf{display:block;width:100%;background:var(--info);opacity:.55;border-radius:2px 2px 0 0}.awf.low{background:var(--warn)}" +
  ".awn{position:absolute;top:-1px;left:0;right:0;text-align:center;font-size:10px;color:var(--dim)}" +
  ".awx{display:flex;justify-content:space-between;font-size:10px;margin-top:2px}" +
  ".awt{border-collapse:collapse;width:100%;font-size:12px}" +
  ".awt th{text-align:left;font-weight:600;color:var(--dim);border-bottom:1px solid var(--line);padding:3px 6px}" +
  ".awt td{border-bottom:1px solid var(--line);padding:3px 6px}.awt .num{font-variant-numeric:tabular-nums;white-space:nowrap}" +
  ".awt td.low{color:var(--warn);font-weight:600}" +
  ".awq{display:block;width:90px;height:7px;border-radius:4px;background:var(--line);overflow:hidden}" +
  ".awq span{display:block;height:100%;background:var(--info);opacity:.6}.awq span.low{background:var(--warn);opacity:.8}" +
  ".awnote{font-size:11px;margin:-2px 0 4px}" +
  ".awp{display:flex;flex-wrap:wrap;gap:4px}" +
  ".awsteps{display:flex;flex-wrap:wrap;gap:4px;list-style:none;padding:0;margin:0 0 6px}" +
  ".awsteps li{font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid var(--line);color:var(--dim)}" +
  ".awsteps li.done{background:var(--infobg);border-color:var(--info);color:var(--fg)}" +
  ".awsteps li.current{border-color:var(--info);color:var(--info);font-weight:600}" +
  ".awsteps li.yours{background:var(--warnbg);border-color:var(--warn);color:var(--warn);font-weight:600}" +
  ".awgo{margin:8px 0 0}" +
  ".awmay{color:var(--warn)}" +
  ".awhp{border:1px solid var(--line);border-radius:6px;padding:6px 9px;margin:0 0 6px}.awhp .awp{margin:4px 0 0}" +
  ".awcrop{display:block;max-width:100%;max-height:90px;margin:0 0 4px;border-radius:3px;background:#fff}" +
  "[data-aw-place][disabled]{opacity:.6}" +
  ".awcvnow{margin:0 0 8px}.awcvnow.on b{color:var(--info)}" +
  ".awcvf{display:flex;flex-direction:column;gap:8px;margin:4px 0 6px}" +
  ".awcvf label,.awcvn{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12px;font-weight:600}" +
  ".awcvf label .dim{font-weight:400}.awcvf input{width:80px;font:inherit;font-size:13px}" +
  ".awcvp{display:inline-flex;gap:4px;font-weight:400}" +
  ".awcvn{margin:10px 0 0}.awcvn input{flex:1;min-width:200px;font:inherit;font-size:13px}" +
  ".awcvpre{margin:8px 0;padding:8px 10px;border-radius:6px;background:var(--infobg);font-size:12px}" +
  ".awcvpre b{font-variant-numeric:tabular-nums}" +
  ".awcvh{display:flex;align-items:flex-end;gap:3px;height:70px;margin:6px 0 2px;border-bottom:1px solid var(--line)}" +
  ".awcvh span{flex:1;display:flex;align-items:flex-end;height:100%;gap:1px}" +
  ".awcvh i{flex:1;display:block;border-radius:2px 2px 0 0;background:var(--dim);opacity:.35}.awcvh i+i{background:var(--info);opacity:.75}" +
  ".awcvk{display:flex;gap:12px;font-size:11px}.awcvk i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;background:var(--dim);opacity:.35}" +
  ".awcvk i.after{background:var(--info);opacity:.75}" +
  ".awcvx{border:1px solid var(--line);border-radius:6px;padding:6px 10px;margin:8px 0 0}.awcvx summary{cursor:pointer;font-size:12px;font-weight:600}" +
  ".awcvq{margin:6px 0;font:inherit;font-size:12px;width:200px}" +
  ".awcvl{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 12px;max-height:260px;overflow:auto;font-size:12px}" +
  ".awcvl label{display:flex;gap:6px;align-items:center;cursor:pointer}.awcvl label[hidden]{display:none}.awcvl .dim{margin-left:auto}" +
  ".awstate{font-size:11px;align-self:center}" +
  ".awic{display:flex;flex-direction:column;gap:6px}" +
  ".awicr{border:1px solid var(--line);border-radius:6px;padding:7px 10px;font-size:12px}" +
  ".awicr.on{border-color:var(--warn);background:var(--warnbg)}" +
  ".awics{margin:3px 0 5px}.awicn{font-size:11px;color:var(--dim);margin:0 0 6px}.awicn summary{cursor:pointer}" +
  ".awicd{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.awicd select{font:inherit;font-size:12px}" +
  ".awicd textarea{flex-basis:100%;font:inherit;font-size:12px}" +
  ".icp{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px;flex-basis:100%}" +
  ".icp .chip{font-size:11px;padding:2px 8px}.icp .chip[aria-pressed=true]{border-color:var(--info);background:var(--infobg)}" +
  ".awbar .m.held{background:var(--warn)}.awbar .m.voided{background:var(--dim);opacity:.4}" +
  ".awk .m.held{background:var(--warn)}.awk .m.voided{background:var(--dim);opacity:.4}";

/*
 * Open the column's panel; close on ×, Esc (the dialog's own) or a press on
 * the backdrop. A student's name opens their hand-in in the drawer, as the
 * cell in their row would. Scans and Grade go up to the browser half, which
 * opens them over this view, as course mode's chips do. "This is …" on a held
 * paper goes up too, since this frame may not fetch: the browser half puts it
 * in the line of placements (client/scans-queue.js), and the redraw shows the
 * paper placed.
 *
 * The line is drawn here as the browser half reports it (`scans-queue`): each
 * paper waiting says Queued, the one in hand Placing…, and its buttons are off.
 * Every placement redraws this view, which would close the window under a
 * professor still pressing; so the frame says which panel is open and how far
 * it is scrolled (`aw-state`), asks on load (`scans-queue-hello`), and the
 * answer reopens it while placements are going through.
 */
export const assessmentWindowScript =
  "<script>(function(){var dlg=document.querySelector('dialog.aw');if(!dlg)return;" +
  "var up=parent!==window;function say(m){if(up){m.source='professor-pane';parent.postMessage(m,'*');}}" +
  "function shut(){if(dlg.open)dlg.close();}" +
  "function shownId(){var p=dlg.querySelector('[data-aw-panel]:not([hidden])');return dlg.open&&p?p.getAttribute('data-aw-panel'):null;}" +
  "function report(){var id=shownId(),pn=id&&dlg.querySelector('[data-aw-panel=\"'+id+'\"]'),b=pn&&pn.querySelector('.awbody')," +
  "tb=pn&&pn.querySelector('[data-aw-tab][aria-selected=true]');say({kind:'aw-state',panel:id,scroll:b?b.scrollTop:0,tab:tb?tb.getAttribute('data-aw-tab'):null});}" +
  "function tabTo(pn,k){var tb=pn.querySelector('[data-aw-tab=\"'+k+'\"]');if(!tb)return;" +
  "[].slice.call(pn.querySelectorAll('[data-aw-tab]')).forEach(function(x){x.setAttribute('aria-selected',String(x===tb));});" +
  "[].slice.call(pn.querySelectorAll('[data-aw-sec]')).forEach(function(x){x.hidden=x.getAttribute('data-aw-sec')!==k;});}" +
  "function show(id,top,tab){[].slice.call(dlg.querySelectorAll('[data-aw-panel]')).forEach(function(p){p.hidden=p.getAttribute('data-aw-panel')!==id;});" +
  "var pn=dlg.querySelector('[data-aw-panel=\"'+id+'\"]');if(pn&&tab)tabTo(pn,tab);" +
  "if(!dlg.open)dlg.showModal();var b=pn&&pn.querySelector('.awbody');if(b)b.scrollTop=top||0;report();}" +
  // The Curve tab's preview: the gradebook's formula over the raw totals,
  // with the students ticked left as marked. A preview only — `ainar curve`
  // writes the curve and the gradebook applies it.
  "function r2(x){return Math.round(x*100)/100;}" +
  "function mid(v){var s=v.slice().sort(function(a,b){return a-b;}),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}" +
  "function avg(v){return v.reduce(function(a,b){return a+b;},0)/v.length;}" +
  "function cvDraw(box){var max=Number(box.getAttribute('data-max')),raws=JSON.parse(box.getAttribute('data-raws'))," +
  "a=Number(box.querySelector('[data-cv-anchor]').value),e=Number(box.querySelector('[data-cv-exponent]').value),ex={}," +
  "out=box.querySelector('.awcvpre'),ap=box.querySelector('[data-cv-apply]');" +
  "[].slice.call(box.querySelectorAll('[data-cv-ex]:checked')).forEach(function(c){ex[c.getAttribute('data-cv-ex')]=1;});" +
  "var n=Object.keys(ex).length,ct=box.querySelector('[data-cv-count]');if(ct)ct.textContent=n?n+' passed over':'none';" +
  "if(!(a>0&&a<=max&&e>0&&e<=1)){out.textContent='The anchor is above 0 and at most '+max+'; the exponent above 0 and at most 1.';if(ap)ap.disabled=true;return;}" +
  "if(ap)ap.disabled=false;" +
  "var be=raws.map(function(r){return r[1];}),af=raws.map(function(r){return ex[r[0]]?r[1]:r2(Math.min(max,max*Math.pow(Math.max(0,r[1])/a,e)));});" +
  "var up=0;be.forEach(function(x,i){up=Math.max(up,af[i]-x);});" +
  "function cnt(v,f){return v.filter(f).length;}function full(x){return x>=max;}function low(x){return x<max/2;}" +
  "function pair(l,x,y){return l+' <b>'+x+' → '+y+'</b>';}" +
  "var bins=[0,0,0,0,0,0,0,0,0,0].map(function(){return [0,0];});" +
  "be.forEach(function(x,i){bins[Math.min(9,Math.floor(10*x/max))][0]++;bins[Math.min(9,Math.floor(10*af[i]/max))][1]++;});" +
  "var top=Math.max.apply(null,bins.map(function(b){return Math.max(b[0],b[1]);}).concat([1]));" +
  "out.innerHTML=[pair('Mean',r2(avg(be)),r2(avg(af))),pair('median',r2(mid(be)),r2(mid(af))),pair('lowest',r2(Math.min.apply(null,be)),r2(Math.min.apply(null,af)))," +
  "pair('under half',cnt(be,low),cnt(af,low)),pair('full marks',cnt(be,full),cnt(af,full)),'raised by at most <b>'+r2(up)+'</b>'].join(' · ')+" +
  "'<div class=\"awcvh\">'+bins.map(function(b,i){return '<span title=\"'+(i*10)+'–'+(i===9?100:i*10+9)+'%: '+b[0]+' before, '+b[1]+' after\">'+" +
  "'<i style=\"height:'+(100*b[0]/top)+'%\"></i><i style=\"height:'+(100*b[1]/top)+'%\"></i></span>';}).join('')+'</div>'+" +
  "'<div class=\"awcvk dim\"><span><i></i>as marked</span><span><i class=\"after\"></i>with this curve</span></div>';}" +
  "[].slice.call(dlg.querySelectorAll('.awcv')).forEach(cvDraw);" +
  "dlg.addEventListener('input',function(e){var t=e.target,box=t.closest&&t.closest('.awcv');if(!box)return;" +
  "if(t.classList.contains('awcvq')){var w=t.value.trim().toLowerCase();" +
  "[].slice.call(box.querySelectorAll('[data-cv-who]')).forEach(function(l){l.hidden=!!w&&l.getAttribute('data-cv-who').indexOf(w)<0;});return;}" +
  "cvDraw(box);});" +
  "dlg.addEventListener('change',function(e){var box=e.target.closest&&e.target.closest('.awcv');if(box)cvDraw(box);});" +
  "dlg.addEventListener('close',report);" +
  "[].slice.call(dlg.querySelectorAll('.awbody')).forEach(function(b){b.addEventListener('scroll',report);});" +
  "function note(p,s){[].slice.call(p.querySelectorAll('[data-aw-place]')).forEach(function(x){x.disabled=!!s;});" +
  "var t=p.querySelector('.awstate');if(!t){t=document.createElement('span');t.className='awstate dim';p.querySelector('.awp').appendChild(t);}t.textContent=s;}" +
  "function mark(m){var on={};if(m.running)on[m.running]='Placing…';(m.queued||[]).forEach(function(k){on[k]='Queued';});" +
  "[].slice.call(dlg.querySelectorAll('.awhp')).forEach(function(p){var b=p.querySelector('[data-aw-place]');if(!b)return;" +
  "note(p,on[b.getAttribute('data-aw-place')+'|'+b.getAttribute('data-file')+'|'+b.getAttribute('data-pages')]||'');});}" +
  "window.addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane'||d.kind!=='scans-queue')return;" +
  "mark(d);if(d.restore&&d.restore.panel&&dlg.querySelector('[data-aw-panel=\"'+d.restore.panel+'\"]'))show(d.restore.panel,d.restore.scroll,d.restore.tab);});" +
  "say({kind:'scans-queue-hello'});" +
  "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;" +
  "var h=t.closest('[data-aw]');if(h){show(h.getAttribute('data-aw'),0);return;}" +
  // A tab shows its section; a question shows what it opens into.
  "var tb=t.closest('[data-aw-tab]');if(tb){var pn=tb.closest('[data-aw-panel]');tabTo(pn,tb.getAttribute('data-aw-tab'));" +
  "pn.querySelector('.awbody').scrollTop=0;report();return;}" +
  // Reports: make them, or send them — the browser half shows the plan first.
  "var rp=t.closest('[data-rp-make],[data-rp-send]');if(rp){if(rp.disabled||!up)return;var rb=rp.closest('[data-rp]');" +
  "[].slice.call(rb.querySelectorAll('button')).forEach(function(x){x.disabled=true;});" +
  "var mk=rp.hasAttribute('data-rp-make');rp.textContent=mk?'Making… about a minute':'Checking who gets one…';" +
  "say({kind:mk?'reports-make':'reports-send',assessment:rb.getAttribute('data-rp')});return;}" +
  // An integrity case decided: Clear, Decide (with the outcome chosen), Reopen.
  "var dc=t.closest('[data-ic-decide]');if(dc){if(dc.disabled||!up)return;var rw=dc.closest('[data-ic]'),st=dc.getAttribute('data-ic-decide')," +
  "oc=rw.querySelector('[data-ic-outcome]');[].slice.call(rw.querySelectorAll('button,select')).forEach(function(x){x.disabled=true;});" +
  "dc.textContent='Writing…';say({kind:'integrity',action:'decide',assessment:dc.closest('[data-ic-for]').getAttribute('data-ic-for')," +
  "case:rw.getAttribute('data-ic'),state:st,outcome:st==='upheld'&&oc?oc.value:null," +
  "note:rw.querySelector('[data-ic-note]')?rw.querySelector('[data-ic-note]').value.trim():''});return;}" +
  // The curve's presses: an exponent preset, Apply, Take it off.
  "var cx=t.closest('[data-cv-exp]');if(cx){var bx=cx.closest('.awcv');bx.querySelector('[data-cv-exponent]').value=cx.getAttribute('data-cv-exp');cvDraw(bx);return;}" +
  "var ca=t.closest('[data-cv-apply],[data-cv-clear]');if(ca){if(ca.disabled||!up)return;var bx=ca.closest('.awcv');" +
  "[].slice.call(bx.querySelectorAll('[data-cv-apply],[data-cv-clear]')).forEach(function(x){x.disabled=true;});" +
  "ca.textContent=ca.hasAttribute('data-cv-clear')?'Taking it off…':'Applying…';" +
  "say(ca.hasAttribute('data-cv-clear')?{kind:'curve',assessment:bx.getAttribute('data-cv'),clear:true}:{kind:'curve',assessment:bx.getAttribute('data-cv')," +
  "anchor:Number(bx.querySelector('[data-cv-anchor]').value),exponent:Number(bx.querySelector('[data-cv-exponent]').value)," +
  "exclude:[].slice.call(bx.querySelectorAll('[data-cv-ex]:checked')).map(function(c){return c.getAttribute('data-cv-ex');})," +
  "note:bx.querySelector('[data-cv-note]').value.trim()});return;}" +
  "var lb=t.closest('[data-aw-lv]');if(lb){var qd=lb.closest('[data-aw-qd]'),v=lb.getAttribute('data-aw-lv');" +
  "[].slice.call(qd.querySelectorAll('[data-aw-lv]')).forEach(function(x){x.setAttribute('aria-pressed',String(x===lb));});" +
  "[].slice.call(qd.querySelectorAll('.awlv')).forEach(function(x){x.hidden=v!=='all'&&x.getAttribute('data-lv')!==v;" +
  "if(v==='blank'&&x.tagName==='DETAILS')x.open=true;});return;}" +
  "var qb=t.closest('[data-aw-q]');if(qb){var sc=qb.closest('section'),i=qb.getAttribute('data-aw-q');" +
  "[].slice.call(sc.querySelectorAll('[data-aw-q]')).forEach(function(x){x.classList.toggle('on',x===qb);});" +
  "[].slice.call(sc.querySelectorAll('[data-aw-qd]')).forEach(function(x){x.hidden=x.getAttribute('data-aw-qd')!==i;});" +
  "var bd=qb.closest('.awbody');if(bd&&bd.scrollTop>sc.offsetTop)bd.scrollTop=sc.offsetTop;return;}" +
  "if(t===dlg||t.closest('[data-aw-close]')){shut();return;}" +
  "var pl=t.closest('[data-aw-place]');if(pl){if(pl.disabled||!up)return;note(pl.closest('.awhp'),'Queued');" +
  "say({kind:'scans-place',assessment:pl.getAttribute('data-aw-place'),file:pl.getAttribute('data-file')," +
  "pages:pl.getAttribute('data-pages'),student:pl.getAttribute('data-student')});return;}" +
  "var s=t.closest('[data-aw-student]');if(s){var a=s.getAttribute('data-aw-hw'),who=s.getAttribute('data-aw-student');" +
  "var cell=[].slice.call(document.querySelectorAll('[data-hw]')).filter(function(c){return c.getAttribute('data-hw')===a&&c.getAttribute('data-hw-student')===who;})[0];" +
  "shut();if(cell)cell.click();return;}" +
  "var g=t.closest('[data-aw-scans],[data-aw-grade]');if(g&&parent!==window){shut();" +
  "var m=g.hasAttribute('data-aw-scans')?{source:'professor-pane',kind:'scans',assessment:g.getAttribute('data-aw-scans')}" +
  ":{source:'professor-pane',kind:'grade',assessment:g.getAttribute('data-aw-grade'),label:g.getAttribute('data-label')||''};" +
  "parent.postMessage(m,'*');}});" +
  "})();</script>";
