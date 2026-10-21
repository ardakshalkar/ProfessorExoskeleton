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
 */
export const summarise = ({ assessment, cells, criteria = [], evaluations = [], pile = null, names = false }) => {
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
  for (const value of percents) bins[Math.min(9, Math.max(0, Math.floor(value / 10)))] += 1;

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

  const questions = criteria.map((criterion) => {
    const mine = evaluations.filter((entry) => entry.criterion_id === criterion.criterion_id);
    const decided = mine.filter((entry) => entry.professor_decision && ["approved", "overridden"].includes(entry.status));
    const maximum = Number(criterion.maximum_score) || 0;
    const stats = describe(decided.map((entry) => Number(entry.professor_decision.score)));
    return {
      id: criterion.criterion_id,
      title: String(criterion.title ?? criterion.criterion_id),
      maximum,
      decided: decided.length,
      waiting: mine.length - decided.length,
      mean: stats.mean,
      percent: stats.mean === null || !maximum ? null : (100 * stats.mean) / maximum,
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
 * handwritten name, so only with names on.
 */
export const windowPanel = (summary, { nameOf, when, crop = () => null }) => {
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
            '<span class="awc" title="' + (i * 10) + "–" + (i === 9 ? 100 : i * 10 + 9) + "%: " + n + '">' +
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

  const questions = s.questions.length
    ? "<h3>By question</h3><p class=\"dim awnote\">From decided marks only; a suggestion is counted as waiting.</p>" +
      '<table class="awt"><thead><tr><th>Question</th><th>Mean</th><th></th><th>Decided</th><th>Waiting</th></tr></thead><tbody>' +
      s.questions
        .map(
          (q) =>
            "<tr><td>" + escapeText(q.title) + '</td><td class="num">' + (q.mean === null ? "—" : round(q.mean) + " / " + round(q.maximum)) +
            '</td><td><span class="awq"><span class="' + (q.percent !== null && q.percent < 50 ? "low" : "") + '" style="width:' +
            (q.percent ?? 0) + '%"></span></span></td><td class="num">' + q.decided + '</td><td class="num">' + (q.waiting || "") + "</td></tr>",
        )
        .join("") +
      "</tbody></table>"
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

  return (
    '<div class="awpanel" data-aw-panel="' + escapeText(s.id) + '" hidden>' +
    '<div class="awhead"><div><div class="awtitle">' + escapeText(s.title) + '</div><div class="dim">' + facts.join(" · ") + "</div></div>" +
    '<button type="button" class="dwk" data-aw-close aria-label="Close" title="Close (Esc)">×</button></div>' +
    '<div class="awbody">' + results + scans + questions + groups + people + "</div>" +
    "</div>"
  );
};

/** The dialog holding every panel; one is shown at a time. */
export const assessmentDialog = (panels) => '<dialog class="aw" aria-label="Assessment across the class">' + panels.join("") + "</dialog>";

export const assessmentWindowStyle =
  ".th .n[data-aw]{cursor:pointer;font:inherit;font-size:10px;background:none;border:0;padding:0;color:var(--dim)}" +
  ".th .n[data-aw]:hover,.th .n[data-aw]:focus-visible{color:var(--info);outline:1px solid var(--accent-line,var(--info));outline-offset:1px}" +
  "dialog.aw{width:min(680px,94vw);max-height:88vh;padding:0;border:1px solid var(--line);border-radius:8px;" +
  "background:var(--dwbg);color:var(--fg);box-shadow:0 10px 40px rgba(0,0,0,.25)}" +
  "dialog.aw::backdrop{background:rgba(0,0,0,.28)}" +
  ".awpanel[hidden]{display:none}" +
  ".awhead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:12px 16px 8px;border-bottom:1px solid var(--line);" +
  "position:sticky;top:0;background:var(--dwbg)}" +
  ".awtitle{font-size:16px;font-weight:600}" +
  ".awbody{padding:4px 16px 16px}" +
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
  "[data-aw-place][disabled]{opacity:.6}";

/*
 * Open the column's panel; close on ×, Esc (the dialog's own) or a press on
 * the backdrop. A student's name opens their hand-in in the drawer, as the
 * cell in their row would. Scans and Grade go up to the browser half, which
 * opens them over this view, as course mode's chips do. "This is …" on a held
 * paper goes up too, since this frame may not fetch: the browser half runs
 * `scans assign` and the redraw shows the paper placed.
 */
export const assessmentWindowScript =
  "<script>(function(){var dlg=document.querySelector('dialog.aw');if(!dlg)return;" +
  "function shut(){if(dlg.open)dlg.close();}" +
  "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;" +
  "var h=t.closest('[data-aw]');if(h){var id=h.getAttribute('data-aw');" +
  "[].slice.call(dlg.querySelectorAll('[data-aw-panel]')).forEach(function(p){p.hidden=p.getAttribute('data-aw-panel')!==id;});" +
  "if(!dlg.open)dlg.showModal();var b=dlg.querySelector('[data-aw-panel=\"'+id+'\"] .awbody');if(b)b.scrollTop=0;return;}" +
  "if(t===dlg||t.closest('[data-aw-close]')){shut();return;}" +
  "var pl=t.closest('[data-aw-place]');if(pl){if(pl.disabled||parent===window)return;" +
  "[].slice.call(pl.parentNode.querySelectorAll('[data-aw-place]')).forEach(function(b){b.disabled=true;});pl.textContent='Placing…';" +
  "parent.postMessage({source:'professor-pane',kind:'scans-place',assessment:pl.getAttribute('data-aw-place'),file:pl.getAttribute('data-file')," +
  "pages:pl.getAttribute('data-pages'),student:pl.getAttribute('data-student')},'*');return;}" +
  "var s=t.closest('[data-aw-student]');if(s){var a=s.getAttribute('data-aw-hw'),who=s.getAttribute('data-aw-student');" +
  "var cell=[].slice.call(document.querySelectorAll('[data-hw]')).filter(function(c){return c.getAttribute('data-hw')===a&&c.getAttribute('data-hw-student')===who;})[0];" +
  "shut();if(cell)cell.click();return;}" +
  "var g=t.closest('[data-aw-scans],[data-aw-grade]');if(g&&parent!==window){shut();" +
  "var m=g.hasAttribute('data-aw-scans')?{source:'professor-pane',kind:'scans',assessment:g.getAttribute('data-aw-scans')}" +
  ":{source:'professor-pane',kind:'grade',assessment:g.getAttribute('data-aw-grade'),label:g.getAttribute('data-label')||''};" +
  "parent.postMessage(m,'*');}});" +
  "})();</script>";
