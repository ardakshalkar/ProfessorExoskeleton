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

import { escapeText } from "./markdown.js";

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
export const summarise = ({ assessment, cells, criteria = [], evaluations = [], pile = null, names = false, items = [], responses = [], submissions = [] }) => {
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
    },
    scores: describe(graded.map((cell) => cell.entry.score)),
    percents: { ...describe(percents), under_half: percents.filter((value) => value < 50).length },
    bins,
    binned,
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
export const windowPanel = (summary, { nameOf, when, crop = () => null, page = () => null }) => {
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
            escapeText(
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

  // One tab per part, so each is a press away rather than a scroll down.
  const tabs = [
    ["overview", "Overview", results + groups],
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
  ".awstate{font-size:11px;align-self:center}";

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
  "function report(){var id=shownId(),b=id&&dlg.querySelector('[data-aw-panel=\"'+id+'\"] .awbody');say({kind:'aw-state',panel:id,scroll:b?b.scrollTop:0});}" +
  "function show(id,top){[].slice.call(dlg.querySelectorAll('[data-aw-panel]')).forEach(function(p){p.hidden=p.getAttribute('data-aw-panel')!==id;});" +
  "if(!dlg.open)dlg.showModal();var b=dlg.querySelector('[data-aw-panel=\"'+id+'\"] .awbody');if(b)b.scrollTop=top||0;report();}" +
  "dlg.addEventListener('close',report);" +
  "[].slice.call(dlg.querySelectorAll('.awbody')).forEach(function(b){b.addEventListener('scroll',report);});" +
  "function note(p,s){[].slice.call(p.querySelectorAll('[data-aw-place]')).forEach(function(x){x.disabled=!!s;});" +
  "var t=p.querySelector('.awstate');if(!t){t=document.createElement('span');t.className='awstate dim';p.querySelector('.awp').appendChild(t);}t.textContent=s;}" +
  "function mark(m){var on={};if(m.running)on[m.running]='Placing…';(m.queued||[]).forEach(function(k){on[k]='Queued';});" +
  "[].slice.call(dlg.querySelectorAll('.awhp')).forEach(function(p){var b=p.querySelector('[data-aw-place]');if(!b)return;" +
  "note(p,on[b.getAttribute('data-aw-place')+'|'+b.getAttribute('data-file')+'|'+b.getAttribute('data-pages')]||'');});}" +
  "window.addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane'||d.kind!=='scans-queue')return;" +
  "mark(d);if(d.restore&&d.restore.panel&&dlg.querySelector('[data-aw-panel=\"'+d.restore.panel+'\"]'))show(d.restore.panel,d.restore.scroll);});" +
  "say({kind:'scans-queue-hello'});" +
  "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;" +
  "var h=t.closest('[data-aw]');if(h){show(h.getAttribute('data-aw'),0);return;}" +
  // A tab shows its section; a question shows what it opens into.
  "var tb=t.closest('[data-aw-tab]');if(tb){var pn=tb.closest('[data-aw-panel]'),k=tb.getAttribute('data-aw-tab');" +
  "[].slice.call(pn.querySelectorAll('[data-aw-tab]')).forEach(function(x){x.setAttribute('aria-selected',String(x===tb));});" +
  "[].slice.call(pn.querySelectorAll('[data-aw-sec]')).forEach(function(x){x.hidden=x.getAttribute('data-aw-sec')!==k;});" +
  "pn.querySelector('.awbody').scrollTop=0;report();return;}" +
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
