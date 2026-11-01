/**
 * In class and at home, on the Students place (BACKLOG E38, STN-4).
 *
 * The class: one scatter of where each student stands in class against at
 * home, the students on either side of it, the marks out of line with the
 * same student's other work on the same concepts, and the pairs who share
 * rare answers on an exam. A student: a chip on their row when any of that is
 * about them, and in their drawer their trajectory across the term and the
 * lines behind each chip. The row's chips are the gap, marks out of line, and
 * a pair that recurs across exams — one exam's pair alone would mark a third
 * of the class, so it stays in the section and the drawer.
 *
 * Every figure is `ainar standing` and `ainar shared-answers`, read from the
 * core: this file draws and adds no arithmetic. It says what differs, never
 * why. The shared phrases are what students wrote, so they are folded closed —
 * this pane is projected.
 *
 * Where an assessment's setting is unknown it asks, once, for the whole kind
 * at a time; the press is the professor's fact about the assessment, written
 * by `ainar assessment setting` through the pane (`kind: 'setting'`).
 */

import { GAP_AT, standingProfile } from "@ainar/core/src/standing.ts";
import { sharedAnswers } from "@ainar/core/src/shared-answers.ts";

import { escapeAttribute, escapeText } from "./markdown.js";

const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + String(Math.abs(Math.round(n)));
const whole = (n) => String(Math.round(n));

/** Which way a student leans, or null when the sides are not both there. */
const leanOf = (s) =>
  s.gap === null ? null : s.gap >= GAP_AT ? "home" : s.gap <= -GAP_AT ? "class" : "even";

/**
 * The standing profile and the shared answers of a run, kept per version of
 * the course (the bundle object; see `approvedOf` in workspace.js): both read
 * the course alone, and comparing every pair of answers was a quarter of the
 * Students page (docs/PANE-SPEED.md, 2). Read only by the view below.
 */
const READINGS = new WeakMap(); // bundle -> runId -> { profile, shared }

const readingsOf = (bundle, runId) => {
  let byRun = READINGS.get(bundle);
  if (!byRun) READINGS.set(bundle, (byRun = new Map()));
  if (!byRun.has(runId)) byRun.set(runId, { profile: standingProfile(bundle, runId), shared: sharedAnswers(bundle, runId) });
  return byRun.get(runId);
};

/**
 * The view for one run, or null when nothing can be said: no marks yet, or a
 * course the gradebook cannot total (its own tab says why).
 *
 * `nameOf(id)` is the name with names on, else the id.
 */
export const standingView = (bundle, runId, { nameOf = (id) => id } = {}) => {
  let profile;
  let shared;
  try {
    ({ profile, shared } = readingsOf(bundle, runId));
  } catch {
    return null;
  }
  if (!profile.students.some((s) => s.entries.length)) return null;

  const byId = new Map(profile.students.map((s) => [s.student_id, s]));
  const titleOf = new Map(profile.assessments.map((a) => [a.assessment_id, a.title || a.assessment_id]));
  const atOf = new Map(profile.assessments.map((a) => [a.assessment_id, a.at]));

  /** Pairs by student: each pair this student is in, with the exam. */
  const pairsOf = new Map();
  for (const exam of shared.exams) {
    for (const pair of exam.unusual) {
      for (const [me, other] of [pair.students, [...pair.students].reverse()]) {
        pairsOf.set(me, [...(pairsOf.get(me) ?? []), { other, exam, pair }]);
      }
    }
  }
  const recurring = new Set(shared.recurring.map((r) => r.students.join("|")));

  const open = (id, text) =>
    '<button type="button" class="svo" data-sv-open="' + escapeAttribute(id) + '" title="' + escapeAttribute(id) + '">' + escapeText(text) + "</button>";

  /* ------------------------------------------------------------- the class */

  // The question, asked once per kind: three quizzes are one answer.
  const unknown = profile.assessments.filter((a) => profile.unknown_setting.includes(a.assessment_id));
  const kinds = [...new Set(unknown.map((a) => a.type))];
  const ask = kinds
    .map((type) => {
      const these = unknown.filter((a) => a.type === type);
      const ids = these.map((a) => a.assessment_id).join(",");
      const press = (value, text) =>
        '<button type="button" class="chip" data-sv-setting="' + escapeAttribute(ids) + '" data-value="' + value + '">' + text + "</button>";
      return (
        '<p class="svask">' +
        escapeText(these.map((a) => titleOf.get(a.assessment_id)).join(", ")) +
        (these.length === 1 ? " sits" : " sit") +
        " on neither side until you say: " +
        (these.length === 1 ? "was it" : "were they") +
        " done under supervision? " +
        press("supervised", "In class") +
        press("unsupervised", "At home") +
        "</p>"
      );
    })
    .join("");

  // The scatter: in class across, at home up, the diagonal where they agree.
  const S = 240;
  const P = 28;
  const x = (v) => P + (v / 100) * S;
  const y = (v) => P + S - (v / 100) * S;
  const placed = profile.students.filter((s) => s.supervised.count && s.unsupervised.count);
  const dots = placed
    .map((s) => {
      const lean = leanOf(s);
      const flagged = s.out_of_line.length || pairsOf.has(s.student_id);
      return (
        '<circle class="svd ' + (lean ?? "thin") + (flagged ? " flag" : "") + '" cx="' + x(s.supervised.standing).toFixed(1) +
        '" cy="' + y(s.unsupervised.standing).toFixed(1) + '" r="4.5" data-sv-open="' + escapeAttribute(s.student_id) + '">' +
        "<title>" +
        escapeText(
          nameOf(s.student_id) + " — in class " + whole(s.supervised.standing) + " (" + s.supervised.count + "), at home " +
            whole(s.unsupervised.standing) + " (" + s.unsupervised.count + ")" +
            (s.gap === null ? ", too few to compare" : s.gap ? ", " + signed(s.gap) + " after ties" : ", even"),
        ) +
        "</title></circle>"
      );
    })
    .join("");
  const grid = [0, 50, 100]
    .map(
      (v) =>
        '<line class="svg" x1="' + x(v) + '" y1="' + y(0) + '" x2="' + x(v) + '" y2="' + y(100) + '"/>' +
        '<line class="svg" x1="' + x(0) + '" y1="' + y(v) + '" x2="' + x(100) + '" y2="' + y(v) + '"/>' +
        '<text class="svt" x="' + x(v) + '" y="' + (y(0) + 14) + '" text-anchor="middle">' + v + "</text>" +
        '<text class="svt" x="' + (x(0) - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>",
    )
    .join("");
  const scatter = placed.length
    ? '<svg class="svs" viewBox="0 0 ' + (S + P + 12) + " " + (S + P + 34) + '" role="img" aria-label="Class percentile in class against at home, one dot per student">' +
      grid +
      '<line class="svdiag" x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(100) + '" y2="' + y(100) + '"/>' +
      '<text class="svt" x="' + x(50) + '" y="' + (y(0) + 26) + '" text-anchor="middle">in class →</text>' +
      '<text class="svt" x="10" y="' + y(50) + '" text-anchor="middle" transform="rotate(-90 10 ' + y(50) + ')">at home →</text>' +
      dots +
      "</svg>"
    : '<p class="dim">Nobody has marks on both sides yet.</p>';

  const leaning = (lean) =>
    profile.students
      .filter((s) => leanOf(s) === lean)
      .sort((a, c) => Math.abs(c.gap) - Math.abs(a.gap))
      .map((s) => open(s.student_id, nameOf(s.student_id) + " " + signed(s.gap)))
      .join("");
  const home = leaning("home");
  const inClass = leaning("class");

  const outOfLine = profile.students
    .flatMap((s) => s.out_of_line.map((o) => ({ id: s.student_id, o })))
    .sort((a, c) => Math.abs(c.o.distance) - Math.abs(a.o.distance))
    .map(
      ({ id, o }) =>
        '<li>' + open(id, nameOf(id)) + " " + escapeText(titleOf.get(o.assessment_id)) +
        ' <span class="' + (o.distance > 0 ? "svup" : "svdown") + '">' + signed(o.distance) + "</span>" +
        '<span class="dim"> · ' + whole(o.here.mid) + " here, " + whole(o.there.mid) + " on the same " + o.concepts.length +
        " concept" + (o.concepts.length === 1 ? "" : "s") + " elsewhere</span></li>",
    )
    .join("");

  const pairLines = shared.exams
    .flatMap((exam) => exam.unusual.map((pair) => ({ exam, pair })))
    .sort((a, c) => Number(recurring.has(c.pair.students.join("|"))) - Number(recurring.has(a.pair.students.join("|"))) || c.pair.score - a.pair.score)
    .map(
      ({ exam, pair }) =>
        "<li>" + open(pair.students[0], nameOf(pair.students[0])) + " & " + open(pair.students[1], nameOf(pair.students[1])) +
        " " + escapeText(exam.title || exam.assessment_id) +
        (recurring.has(pair.students.join("|")) ? ' <span class="svup">on more than one exam</span>' : "") +
        '<span class="dim"> · ' + pair.items.length + " of " + pair.common + " items</span></li>",
    )
    .join("");

  const legend =
    '<p class="svl dim"><span class="svk home"></span>stronger at home <span class="svk class"></span>stronger in class ' +
    '<span class="svk even"></span>even <span class="svk thin"></span>too few to compare <span class="svk flag"></span>ringed: ' +
    "out of line, or shared answers · " + GAP_AT + "+ percentile points after ties</p>";

  const section =
    '<details class="stv" open><summary><b>In class and at home</b> <span class="dim">— where each student stands among the class, ' +
    "supervised work against unsupervised</span></summary>" +
    ask +
    '<div class="svw"><div>' + scatter + legend + "</div><div class=\"svc\">" +
    '<p class="svh">Stronger at home</p>' + (home || '<p class="dim">Nobody.</p>') +
    '<p class="svh">Stronger in class</p>' + (inClass || '<p class="dim">Nobody.</p>') +
    '<p class="svh">Out of line with their own work on the same concepts</p>' +
    (outOfLine ? "<ul>" + outOfLine + "</ul>" : '<p class="dim">Nothing.</p>') +
    '<p class="svh">Shared answers on an exam</p>' +
    (pairLines ? "<ul>" + pairLines + "</ul>" : '<p class="dim">' + (shared.exams.length ? "No pair stands out." : "No exam answers recorded yet.") + "</p>") +
    "</div></div>" +
    '<p class="dim svn">A difference, not a reason: a bad day, a good tutor and a copied answer all look alike here. ' +
    "Read the work before anything else.</p>" +
    "</details>";

  /* ------------------------------------------------------------- a student */

  const chipFor = (id) => {
    const s = byId.get(id);
    if (!s) return "";
    const lean = leanOf(s);
    const chips = [];
    if (lean === "home") chips.push('<span class="svc1 home" title="Stronger at home, ' + signed(s.gap) + ' after ties">home ' + signed(s.gap) + "</span>");
    if (lean === "class") chips.push('<span class="svc1 class" title="Stronger in class, ' + signed(s.gap) + ' after ties">class ' + signed(-s.gap) + "</span>");
    if (s.out_of_line.length) chips.push('<span class="svc1" title="Marks out of line with their own work on the same concepts">' + s.out_of_line.length + " out of line</span>");
    // Only a pair that recurs earns a chip: one exam's pair is in the section
    // and the drawer, and on the row it would mark a third of the class.
    const pairs = (pairsOf.get(id) ?? []).filter(({ pair }) => recurring.has(pair.students.join("|")));
    if (pairs.length) chips.push('<span class="svc1 home" title="Shared rare answers with the same student on more than one exam">shared answers, again</span>');
    return chips.join("");
  };

  /** Their percentile on every assessment across the term: filled in class, hollow at home, a bar where ties allow a range. */
  const trajectory = (s) => {
    if (s.entries.length < 2) return "";
    const W = 300;
    const H = 90;
    const pad = 8;
    const step = (W - 2 * pad) / Math.max(1, s.entries.length - 1);
    const py = (v) => pad + (H - 2 * pad) * (1 - v / 100);
    const points = s.entries.map((e, i) => ({ e, cx: pad + i * step }));
    const line = (side) => {
      const on = points.filter((p) => p.e.setting === side);
      return on.length > 1
        ? '<polyline class="svtl ' + side + '" points="' + on.map((p) => p.cx.toFixed(1) + "," + py(p.e.percentile).toFixed(1)).join(" ") + '"/>'
        : "";
    };
    return (
      '<svg class="svtr" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Class percentile on each assessment, in date order">' +
      '<line class="svg" x1="0" y1="' + py(50) + '" x2="' + W + '" y2="' + py(50) + '"/>' +
      line("supervised") + line("unsupervised") +
      points
        .map(
          ({ e, cx }) =>
            (e.high > e.low ? '<line class="svr" x1="' + cx.toFixed(1) + '" y1="' + py(e.high).toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + py(e.low).toFixed(1) + '"/>' : "") +
            '<circle class="svp ' + (e.setting ?? "unknown") + '" cx="' + cx.toFixed(1) + '" cy="' + py(e.percentile).toFixed(1) + '" r="3.5"><title>' +
            escapeText(titleOf.get(e.assessment_id) + " — " + (e.high > e.low ? whole(e.low) + "–" + whole(e.high) + " (tied)" : whole(e.percentile)) + " · " + e.percent + "%") +
            "</title></circle>",
        )
        .join("") +
      "</svg>" +
      '<p class="dim svkey">Class percentile on each assessment by date · filled in class, hollow at home, grey not yet said · a bar where tied marks allow a range · the line is the middle of the class</p>'
    );
  };

  const detailFor = (id) => {
    const s = byId.get(id);
    if (!s || !s.entries.length) return "";
    const side = (label, v) => (v.count ? label + " <b>" + whole(v.standing) + "</b> <span class=\"dim\">(" + v.count + ")</span>" : label + ' <span class="dim">—</span>');
    const lean = leanOf(s);
    const said =
      lean === "home" ? ' · <span class="svup">stronger at home by ' + whole(s.gap) + "</span>"
      : lean === "class" ? ' · <span class="svdown">stronger in class by ' + whole(-s.gap) + "</span>"
      : lean === "even" ? ' · <span class="dim">even</span>'
      : ' · <span class="dim">too few to compare</span>';
    const lines = s.out_of_line
      .map(
        (o) =>
          "<li>" + escapeText(titleOf.get(o.assessment_id)) + ' <span class="' + (o.distance > 0 ? "svup" : "svdown") + '">' + signed(o.distance) + "</span>" +
          '<span class="dim"> · ' + whole(o.here.mid) + " here against " + whole(o.there.mid) + " in " +
          escapeText(o.against.map((a) => titleOf.get(a)).join(", ")) + "</span></li>",
      )
      .join("");
    const pairs = (pairsOf.get(id) ?? [])
      .slice()
      .sort((a, c) => String(atOf.get(a.exam.assessment_id) ?? "").localeCompare(String(atOf.get(c.exam.assessment_id) ?? "")))
      .map(
        ({ other, exam, pair }) =>
          "<li>with " + open(other, nameOf(other)) + " on " + escapeText(exam.title || exam.assessment_id) +
          (recurring.has(pair.students.join("|")) ? ' <span class="svup">on more than one exam</span>' : "") +
          '<details class="svq"><summary class="dim">What they share</summary>' +
          pair.items
            .map((item) => '<p class="dim">' + escapeText(item.item_id) + (item.both_wrong ? " · both lost marks" : "") + "</p>" +
              item.shared.map((text) => "<q>" + escapeText(text) + "</q>").join(""))
            .join("") +
          "</details></li>",
      )
      .join("");
    return (
      '<div class="svs1"><p class="svh">In class and at home</p>' +
      "<p>" + side("in class", s.supervised) + " · " + side("at home", s.unsupervised) + said + "</p>" +
      trajectory(s) +
      (lines ? '<p class="svh">Out of line with their own work on the same concepts</p><ul>' + lines + "</ul>" : "") +
      (pairs ? '<p class="svh">Shared answers</p><ul>' + pairs + "</ul>" : "") +
      "</div>"
    );
  };

  const style =
    "<style>" +
    ".stv{margin:10px 0 14px;border:1px solid var(--line);border-radius:6px;padding:8px 12px}" +
    ".stv>summary{cursor:pointer}" +
    ".svw{display:flex;flex-wrap:wrap;gap:12px 24px;margin-top:8px}.svw>div{min-width:0}.svc{flex:1;min-width:260px}" +
    ".svs{width:280px;max-width:100%;height:auto;display:block}" +
    ".svg{stroke:var(--line);stroke-width:1}.svdiag{stroke:var(--dim);stroke-dasharray:3 3}" +
    ".svt{font-size:10px;fill:var(--dim)}" +
    ".svd{cursor:pointer;stroke-width:1.5}.svd.even{fill:var(--dim);stroke:var(--dim);opacity:.7}" +
    ".svd.home{fill:var(--warn);stroke:var(--warn)}.svd.class{fill:var(--info);stroke:var(--info)}" +
    ".svd.thin{fill:none;stroke:var(--dim);opacity:.6}.svd.flag{stroke:var(--fg);stroke-width:2}" +
    ".svd:hover{stroke:var(--fg);stroke-width:2.5}" +
    ".svh{margin:8px 0 3px;font-size:12px;color:var(--dim)}" +
    ".svc ul,.svs1 ul{margin:0;padding-left:16px;font-size:13px}.svc li,.svs1 li{margin:2px 0}" +
    ".svo{font:inherit;font-size:13px;background:none;border:0;padding:0 2px;color:var(--info);cursor:pointer;margin-right:6px}" +
    ".svo:hover{text-decoration:underline}" +
    ".svup{color:var(--warn);font-weight:600}.svdown{color:var(--info);font-weight:600}" +
    ".svask{margin:6px 0;padding:6px 8px;background:var(--warnbg);border-radius:4px;font-size:13px}.svask .chip{margin-left:6px}" +
    ".svl{font-size:11px;margin:4px 0 0}.svk{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px 0 8px;vertical-align:middle}" +
    ".svk.home{background:var(--warn)}.svk.class{background:var(--info)}.svk.even{background:var(--dim)}" +
    ".svk.thin{border:1.5px solid var(--dim)}.svk.flag{border:2px solid var(--fg)}" +
    ".svn{font-size:12px;margin:8px 0 0}" +
    ".svc1{display:inline-block;font-size:11px;padding:0 6px;margin-left:6px;border:1px solid var(--line);border-radius:9px;color:var(--dim);font-weight:400}" +
    ".svc1.home{color:var(--warn);border-color:var(--warn)}.svc1.class{color:var(--info);border-color:var(--info)}" +
    ".svs1{font-size:13px;margin:6px 0 8px}.svs1 p{margin:2px 0}" +
    ".svtr{width:100%;max-width:340px;height:auto;display:block;margin:4px 0}" +
    ".svtl{fill:none;stroke-width:1.2}.svtl.supervised{stroke:var(--info)}.svtl.unsupervised{stroke:var(--warn);stroke-dasharray:3 2}" +
    ".svr{stroke:var(--dim);stroke-width:2;opacity:.35}" +
    ".svp.supervised{fill:var(--info)}.svp.unsupervised{fill:var(--dwbg,#fff);stroke:var(--warn);stroke-width:1.5}.svp.unknown{fill:var(--dim)}" +
    ".svkey{font-size:11px;margin:0 0 4px}" +
    ".svq{margin:2px 0 4px}.svq q{display:block;margin:2px 0 2px 8px;font-size:12px}" +
    "</style>";

  /*
   * A name or a dot opens that student's row, which opens the drawer; the
   * setting press goes up to the pane, which runs `ainar assessment setting`.
   */
  const script =
    "<script>(function(){document.addEventListener('click',function(e){" +
    "var o=e.target.closest&&e.target.closest('[data-sv-open]');" +
    "if(o){var id=o.getAttribute('data-sv-open'),rows=document.querySelectorAll('.sr[title]');" +
    "for(var i=0;i<rows.length;i++){if(rows[i].getAttribute('title')===id){var st=rows[i].closest('.st');if(st&&st.hidden)st.hidden=false;" +
    "rows[i].scrollIntoView({block:'center'});rows[i].click();break;}}return;}" +
    "var p=e.target.closest&&e.target.closest('button[data-sv-setting]');" +
    "if(p&&parent!==window){if(p.disabled)return;[].forEach.call(p.parentNode.querySelectorAll('button'),function(b){b.disabled=true;});" +
    "p.textContent='Saving…';parent.postMessage({source:'professor-pane',kind:'setting'," +
    "assessments:p.getAttribute('data-sv-setting').split(','),setting:p.getAttribute('data-value')},'*');}" +
    "});})();</script>";

  return { section, chipFor, detailFor, style, script };
};
