/**
 * Course mode: the term plan as the page, and the agent as a press on it.
 *
 * The design argued for in `COURSE-MODE.md` and built first as
 * `prototype/proto.html`, served here for real. One grid for the whole term —
 * Lecture, Graded work, Outcomes — so the columns line up from week 1 to week
 * 16, opened over the harness rather than squeezed into its 300px column.
 *
 * WHY IT IS DRAWN HERE AND NOT BY THE WIDGET
 * ------------------------------------------
 * `course-outline.tmpl` is one column wide by construction: it is the document
 * ChatGPT and Claude Desktop draw beside a reply, and it is what `ainar page`
 * publishes. A three-column term table is neither of those things. So the pane
 * draws this one itself, the way it draws the Checklist — from the same
 * `course_outline` payload, with the same material links — and the shared
 * widget keeps its own shape.
 *
 * WHAT IT COMPUTES
 * ----------------
 * This runs on the host, before the page exists, which is the side of the wall
 * where figures may be made. The page that arrives in the browser counts
 * nothing. What is decided here is presentation of facts the payload already
 * holds: which week a hole is urgent in (`when`, against `current_week`), runs
 * of unplanned weeks, which outcomes a week teaches against which it assesses.
 * Every gap is the payload's own `weeks[].gaps`, with the model's sentence on
 * its title.
 *
 * WHAT A PRESS DOES
 * -----------------
 * Two messages up to the harness, the two every pane document already sends:
 * `ask` (a prompt into the open session) and `view` (a material over the
 * harness, accepted only if it is this app's own `/file` route). A hole is a
 * verb: pressing "Draft deck" asks for the deck, naming the week, the module
 * and the meetings, so the model starts with the record rather than a search.
 * Nothing here approves, writes or decides; accepting a draft is the professor
 * changing `approval: draft` in its record.
 */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-05` as `Oct 5`, by hand: `Date` reads a bare ISO date as UTC. */
const shortDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : "";
};

/** A weight the payload computed, as a percentage; `null` stays `""`. */
const pct = (value) => (value === null || value === undefined ? "" : `${Math.round(value * 100)}%`);

// ------------------------------------------------------------------- icons

/**
 * Line icons on a 24-unit grid in the Lucide idiom, drawn inline: the frame has
 * no network and needs none. Stroked in `currentColor`, so a chip's tone —
 * red on a hole, green on a deck, blue on a draft — colours its icon too.
 */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-lecture" viewBox="0 0 24 24"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></symbol>
<symbol id="i-lab" viewBox="0 0 24 24"><path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></symbol>
<symbol id="i-seminar" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></symbol>
<symbol id="i-slides" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 7.5 4.5 2.5-4.5 2.5z"/><path d="M8 21h8"/><path d="M12 17v4"/></symbol>
<symbol id="i-reading" viewBox="0 0 24 24"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></symbol>
<symbol id="i-data" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></symbol>
<symbol id="i-notebook" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="m10 10-2 2 2 2"/><path d="m14 10 2 2-2 2"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></symbol>
<symbol id="i-brief" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></symbol>
<symbol id="i-video" viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></symbol>
<symbol id="i-quiz" viewBox="0 0 24 24"><path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></symbol>
<symbol id="i-homework" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></symbol>
<symbol id="i-project" viewBox="0 0 24 24"><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></symbol>
<symbol id="i-exam" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></symbol>
<symbol id="i-outcome" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></symbol>
<symbol id="i-concept" viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></symbol>
<symbol id="i-module" viewBox="0 0 24 24"><path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></symbol>
<symbol id="i-misdated" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 13.5v3"/><path d="M12 19.2h.01"/></symbol>
<symbol id="i-weight" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></symbol>
<symbol id="i-ask" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></symbol>
</defs></svg>`;

const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${esc(name)}"/></svg>`;

const MEETING_ICON = { lecture: "lecture", lab: "lab", seminar: "seminar", discussion: "seminar",
  review: "seminar", exercise: "homework", project_work: "project", field_work: "project", reading: "reading" };
const RESOURCE_ICON = { slides: "slides", reading: "reading", textbook_chapter: "reading", dataset: "data",
  notebook: "notebook", video: "video", link: "link", tool: "notebook" };
const RESOURCE_WORD = { textbook_chapter: "chapter", dataset: "dataset" };
const WORK_ICON = { quiz: "quiz", assignment: "homework", project: "project", exam: "exam",
  presentation: "lecture", oral_defense: "seminar", participation: "seminar" };
// `assignment` is the model's word; `homework` is the professor's.
const WORK_WORD = { assignment: "homework", oral_defense: "defence" };
const GAP = {
  module: { icon: "module", verb: "Plan module" },
  deck: { icon: "slides", verb: "Draft deck" },
  misdated: { icon: "misdated", verb: "Check date" },
  deadline: { icon: "calendar", verb: "Set dates" },
  weight: { icon: "weight", verb: "Set weight" },
  brief: { icon: "brief", verb: "Write brief" },
};

// ------------------------------------------------------------------- style

const LIGHT = `--ground:#f3f4f0;--surface:#fff;--sunk:#eceee8;--ink:#171b18;--muted:#5f685f;
--line:#dadfd6;--rule:#e8ebe4;--accent:#2f6b3c;--accent-ink:#245231;--accent-line:#bcd8c2;
--accent-tint:#eef5ef;--flag:#a4362f;--flag-line:#f0c4c0;--flag-tint:#fdf1f0;
--draft:#2f5b8a;--draft-line:#bdd0e4;--draft-tint:#eef3f9;--on-fg:#fff;`;
// DSH's theme is an explicit choice on its body, not the OS setting, so the
// host passes it and the page does not consult `prefers-color-scheme`.
const DARK = `--ground:#101310;--surface:#191d1a;--sunk:#141815;--ink:#e6eae4;--muted:#99a399;
--line:#2b312c;--rule:#222722;--accent:#7fc98d;--accent-ink:#a6dcaf;--accent-line:#33513a;
--accent-tint:#18231a;--flag:#e08c85;--flag-line:#6b3a37;--flag-tint:#2a1c1b;
--draft:#8fb6de;--draft-line:#37506b;--draft-tint:#171f27;--on-fg:#0d100d;`;

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,"Segoe UI",sans-serif}
.mono{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
.i{width:1.15em;height:1.15em;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.2em}
.strip{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 20px;background:var(--ground);border-bottom:1px solid var(--rule)}
.strip .note{font-size:12px;color:var(--muted);margin-right:auto}
.tally{display:flex;gap:6px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.tally span{font-size:12px;border-radius:999px;padding:2px 9px;border:1px dashed var(--flag-line);color:var(--flag)}
.tally .soon{border-style:solid;background:var(--flag-tint);font-weight:600}
.tally .past,.tally .zero{border:1px solid var(--line);color:var(--muted)}
.banner{margin:14px 20px 0;padding:9px 13px;border-radius:9px;font-size:13px;background:var(--accent-tint);border:1px solid var(--accent-line);color:var(--muted)}
.banner b{color:var(--accent-ink);font-weight:600}
.lead{margin:14px 20px 0;padding:12px 14px;border:1px dashed var(--flag-line);border-radius:12px;background:var(--surface);display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
.lead>b{font-size:14px;font-weight:600;margin-right:4px;display:inline-flex;gap:6px;align-items:center}
.grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,.75fr);margin:14px 20px 28px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:clip}
.th{position:sticky;top:var(--strip-h,45px);z-index:10;background:var(--sunk);color:var(--muted);padding:8px 12px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid var(--line)}
.wkhead{grid-column:1/-1;display:flex;align-items:baseline;gap:6px 10px;flex-wrap:wrap;padding:14px 12px 4px;border-top:1px solid var(--line)}
.wkhead>b{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
.wkhead h3{margin:0;font-size:14px;font-weight:600}
.wkhead h3.none{color:var(--muted);font-weight:450}
.wkhead.now{background:var(--accent-tint)}.wkhead.now>b{color:var(--accent)}
.wkhead.past>b,.wkhead.past h3{color:var(--muted)}
.wkhead .askw{margin-left:auto}
.concepts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px;padding:2px 12px 10px;align-items:center;color:var(--muted)}
.cell{padding:9px 12px 15px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;border-left:1px solid var(--rule);font-size:13px;min-width:0}
.cell[data-col="Lecture"]{border-left:0}
.cell>*{max-width:100%}
.meeting{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-left:9px;border-left:2px solid var(--rule)}
.dash{color:var(--muted);opacity:.5}
.pill{font-size:12px;border-radius:999px;padding:1px 8px;font-weight:500}
.pill.now{background:var(--accent);color:var(--on-fg)}
.pill.draft{background:var(--draft-tint);color:var(--draft);border:1px solid var(--draft-line)}
.chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;color:var(--ink);border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:3px 9px;max-width:100%;text-align:left;text-decoration:none;cursor:default}
a.chip,button.chip{cursor:pointer}
a.chip:hover,button.chip:hover{border-color:var(--accent-line)}
.chip .k{color:var(--muted);font-size:12px}
.chip .i{opacity:.85}
.chip.meet{background:var(--sunk);border-color:transparent}
.chip.deck{border-color:var(--accent-line);background:var(--accent-tint);color:var(--accent-ink);font-weight:500}
.chip.fmt{border-color:var(--accent-line);color:var(--accent-ink);font-size:12px;font-weight:600;padding:2px 7px}
.chip.concept{border-color:transparent;background:var(--sunk);color:var(--muted);font-size:12px}
.chip .tag{color:var(--muted);font-size:12px;border-right:1px solid var(--line);padding-right:6px;display:inline-flex;gap:4px;align-items:center}
.chip .wt{font-weight:600;font-variant-numeric:tabular-nums}
.chip.draft{border-color:var(--draft-line);background:var(--draft-tint);color:var(--draft)}
.chip.gap{border-style:dashed;border-color:var(--flag-line);color:var(--flag);background:none;font-weight:500}
.chip.gap:hover{background:var(--flag-tint);border-style:solid}
.chip.gap.soon{background:var(--flag-tint);border-style:solid;font-weight:600}
.chip.gap.past{color:var(--muted);border-color:var(--line);font-weight:450}
.chip.gap.past:hover{background:var(--sunk)}
.chip.lo{background:none;font-weight:500}
.chip.lo .k{font-weight:400}
.chip.lo.hit{background:var(--accent-tint);border-color:var(--accent-line);color:var(--accent-ink)}
.chip.ask{border-color:transparent;background:none;color:var(--accent-ink);font-size:12px;padding:2px 6px}
.chip.ask:hover{background:var(--accent-tint)}
.band{grid-column:1/-1;display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding:14px 12px;border-top:1px solid var(--line);background:var(--sunk)}
.band b{font-size:16px;font-weight:600;display:inline-flex;gap:6px;align-items:center}
.band .none{color:var(--muted)}
.foot{margin:0 20px 28px;font-size:12px;color:var(--muted);max-width:90ch}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
@media (max-width:900px){
  .grid{grid-template-columns:1fr}.th{display:none}
  .cell{border-left:0;padding:4px 12px;flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:6px}
  .cell::before{content:attr(data-col);color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;flex:0 0 96px}
}`;

/**
 * Presses, out to the harness: the same two messages every pane document
 * sends, and nothing else. `parent === window` means the page was opened in a
 * tab by itself, with nobody listening, so it takes no clicks at all. A
 * modified click keeps the tab a link always opened.
 *
 * And the sticky column heads sit under the strip by its MEASURED height,
 * because the strip wraps on a narrow frame.
 */
const SCRIPT = `<script>(function(){
var strip=document.querySelector('.strip');
function measure(){if(strip)document.documentElement.style.setProperty('--strip-h',strip.offsetHeight+'px');}
measure();if(window.ResizeObserver&&strip)new ResizeObserver(measure).observe(strip);
var now=document.querySelector('.wkhead.now');if(now)now.scrollIntoView({block:'start'});
if(parent===window)return;
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-ask]');
  if(b){e.preventDefault();parent.postMessage({source:'professor-pane',kind:'ask',prompt:b.getAttribute('data-ask')},'*');return;}
  var a=e.target.closest&&e.target.closest('a[data-view]');if(!a)return;
  if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  e.preventDefault();
  parent.postMessage({source:'professor-pane',kind:'view',url:a.getAttribute('href'),label:a.getAttribute('data-view'),format:a.getAttribute('data-format')},'*');
});})();<\/script>`;

// ------------------------------------------------------------------ prompts

/**
 * What a hole's press asks, naming the records.
 *
 * The context packet in words: the week, the module, the meetings or the
 * assessment — every identifier the model would otherwise spend a search on.
 * Ids only, never a name: this text goes to a model.
 */
const promptFor = (kind, week, run, ref) => {
  const module = (week.modules ?? [])[0];
  const about = `week ${week.week} of ${run.id}` + (module ? ` (${module.module_id}, "${module.title}")` : "");
  const gap = (week.gaps ?? []).find((g) => g.kind === kind) ?? { ids: [] };
  switch (kind) {
    case "deck":
      return `Draft the slides for ${about} with /make-materials. It meets in ${gap.ids.join(", ") || "its meetings"}` +
        " and has no deck. Register it as a resource marked approval: draft.";
    case "module":
      return `Week ${week.week} of ${run.id} has no module. Propose what it should teach, given the weeks either` +
        " side, as a draft module for me to read. Change nothing else.";
    case "misdated":
      return `${ref} is drawn under ${about}, but its date falls outside that week. Which is wrong: its date,` +
        " its module's week, or the run's start date? Tell me what you find and change nothing until I say.";
    case "weight":
      return `What should ${gap.ids.join(", ")} in ${about} be worth? The weight is mine to set; propose one and wait.`;
    case "brief":
      return `${ref} in ${about} has no brief students can read. Draft one from its rubric and outcomes with` +
        " /design-assessment, as a draft for me to read.";
    default:
      return `For ${about}, what is still missing?`;
  }
};

/** The undated-work prompt, the widget's own wording: two dates nobody has written down. */
const datesPrompt = (a, run) =>
  "Ask me this now, in your first message, before running any command: what are the open and due dates for " +
  `${a.assessment_id} ("${a.title}")? Skip the usual opening validate and inbox sweep, and do not read any ` +
  "file first: these two dates exist only in my head, so nothing on disk can answer this. Once I have " +
  `answered, set opens_at and due_at on the ${a.assessment_id} entry in ` +
  (a.source_file ?? `courses/${run.course_id}/versions/${run.term}/assessments/ (grep for the id)`) +
  ", and then just confirm what you wrote.";

// -------------------------------------------------------------------- parts

/**
 * When a hole bites: this week and next, later, or a week already taught.
 * The payload's own `urgency`; the fallback is the same rule, for a payload
 * built before the field existed.
 */
const tierOf = (week, current) => {
  if (week.urgency) return week.urgency;
  if (week.when === "past") return "past";
  if (current !== null && week.week <= current + 1) return "soon";
  return "later";
};

const gapChip = (kind, tier, prompt, title, label) =>
  `<button type="button" class="chip gap ${tier}" data-ask="${esc(prompt)}" title="${esc(title)}">` +
  `${icon(GAP[kind].icon)}${esc(label ?? GAP[kind].verb)}</button>`;

/** A material: a link the harness opens over itself when it can paint it. */
const materialChip = (r) => {
  const deck = r.kind === "slides";
  const cls = `chip${deck ? " deck" : ""}${r.draft ? " draft" : ""}`;
  const label = deck ? "Slides" : r.title;
  const what = RESOURCE_WORD[r.kind] ?? r.kind;
  const body = `${icon(RESOURCE_ICON[r.kind] ?? "file")}${esc(label)}${r.draft ? ' <span class="k">draft</span>' : ""}`;
  const out = [];
  if (r.url) {
    out.push(
      `<a class="${cls}" href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(`${what} · ${r.title}`)}"` +
        (r.viewable ? ` data-view="${esc(r.title)}" data-format="${esc(r.format)}"` : "") + `>${body}</a>`,
    );
  } else {
    out.push(`<span class="${cls}" title="${esc(what)}">${body}</span>`);
  }
  for (const f of (r.formats ?? []).slice(1)) {
    if (!f.url) continue;
    out.push(
      `<a class="chip fmt" href="${esc(f.url)}" target="_blank" rel="noopener"` +
        (f.viewable ? ` data-view="${esc(`${r.title} · ${f.label}`)}" data-format="${esc(f.format)}"` : "") +
        `>${esc(f.label)}</a>`,
    );
  }
  return out.join("");
};

/** A piece of graded work: when, what kind, what, and what it is worth. */
const workChip = (a, when) => {
  const kind = WORK_WORD[a.type] ?? a.type ?? "work";
  const cls = `chip${a.draft ? " draft" : ""}`;
  const body =
    `<span class="k mono">${esc(when)}</span><span class="tag">${icon(WORK_ICON[a.type] ?? "file")}${esc(kind)}</span>` +
    `${esc(a.title)}${a.draft ? ' <span class="k">draft</span>' : ""}<span class="wt">${esc(pct(a.weight))}</span>`;
  // The brief document when there is one the harness can paint, else the
  // record's own text as the page the pane serves it as.
  const href = a.viewable && a.url ? a.url : a.brief_url;
  if (href) {
    const format = a.viewable && a.url ? a.format : "html";
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" data-view="${esc(a.title)}" ` +
      `data-format="${esc(format)}" title="open the brief">${body}</a>`;
  }
  return `<span class="${cls}">${body}</span>`;
};

const hasBrief = (a) => Boolean(a.url || a.brief_url || String(a.description ?? "").trim());

/** A week nobody has planned and nothing meets in: a candidate for a band. */
const isEmpty = (w) => !(w.modules ?? []).length && !(w.meetings ?? []).length;

// ------------------------------------------------------------------ document

/**
 * The page.
 *
 * @param data - a `course_outline` payload, with the pane's material links
 *   and record paths already on it.
 * @param options.dark - the harness's theme, which the page cannot ask for.
 * @param options.student - Preview as student: the record alone, no hole drawn.
 *   What `ainar page` publishes, in this layout.
 */
export const courseModeDocument = (data, { dark = false, student = false } = {}) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const showGaps = !student;
  const tally = { soon: 0, later: 0, past: 0 };
  const count = (tier) => {
    tally[tier] += 1;
  };

  // ---- the card before week 1: work on no date at all
  const undated = [];
  for (const w of weeks) for (const a of w.undated ?? []) undated.push({ a, w });
  for (const a of data.unplaced?.assessments ?? []) undated.push({ a, w: null });
  let lead = "";
  if (showGaps && undated.length) {
    lead =
      `<div class="lead"><b>${icon("misdated")} ${undated.length} ${undated.length === 1 ? "thing is" : "things are"} not on the calendar yet</b>` +
      undated
        .map(({ a, w }) => {
          count(w ? tierOf(w, current) : "soon");
          return workChip(a, "no date") +
            gapChip("deadline", w ? tierOf(w, current) : "soon", datesPrompt(a, run),
              `${a.assessment_id} has no dates${w ? `; its module is week ${w.week}` : ""}.`);
        })
        .join("") +
      "</div>";
  }

  // ---- one row per week, a band per run of two or more empty ones
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && isEmpty(weeks[j])) j += 1;
    if (j - i >= 2) {
      rows.push({ band: weeks.slice(i, j) });
      i = j;
    } else {
      rows.push({ week: weeks[i] });
      i += 1;
    }
  }

  const weekRow = (w) => {
    const tier = tierOf(w, current);
    const gaps = showGaps ? w.gaps ?? [] : [];
    const has = (kind) => gaps.find((g) => g.kind === kind);
    const misdated = new Set(has("misdated")?.ids ?? []);
    const module = (w.modules ?? [])[0];
    const title = (w.modules ?? []).map((m) => m.title).join(" · ");

    // Holes that belong to the week as a whole, on its header. The deck sits
    // at the foot of the Lecture column and a date beside its meeting, where
    // their subject is; undated work is in the card before week 1.
    const headGaps = gaps
      .filter((g) => g.kind === "module" || g.kind === "weight")
      .map((g) => {
        count(tier);
        return gapChip(g.kind, tier, promptFor(g.kind, w, run), g.note);
      })
      .join("");

    const head =
      `<div class="wkhead ${w.when === "current" ? "now" : w.when === "past" ? "past" : ""}" id="week-${w.week}">` +
      `<b>${w.week < 10 ? "0" + w.week : w.week}</b><span class="k mono">${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</span>` +
      (title ? `<h3>${esc(title)}</h3>` : `<h3 class="none">Unplanned</h3>`) +
      (w.when === "current" ? '<span class="pill now">this week</span>' : "") +
      ((w.modules ?? []).some((m) => m.draft) ? '<span class="pill draft">draft</span>' : "") +
      headGaps +
      (module
        ? `<button type="button" class="chip ask askw" data-ask="${esc(
            `For week ${w.week} of ${run.id} (${module.module_id}), what should I teach and what should I revisit first?`,
          )}" title="Ask Claude to prepare this week">${icon("ask")}Prepare</button>`
        : "") +
      "</div>";

    const concepts = (w.modules ?? []).flatMap((m) => (m.concepts ?? []).map((c) => c.title ?? c.id));
    const conceptRow = concepts.length
      ? `<div class="concepts">${icon("concept")}${concepts.map((c) => `<span class="chip concept">${esc(c)}</span>`).join("")}</div>`
      : "";

    // Lecture: each meeting with its own materials, the deck first.
    const lecture = (w.meetings ?? [])
      .map((m) => {
        const resources = [...(m.resources ?? [])].sort(
          (a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1),
        );
        let off = "";
        if (misdated.has(m.activity_id)) {
          count(tier);
          off = gapChip("misdated", tier, promptFor("misdated", w, run, m.activity_id), has("misdated").note);
        }
        return `<div class="meeting"><span class="chip meet${m.draft ? " draft" : ""}" title="${esc(m.title ?? "")}">` +
          `<span class="k mono">${esc(shortDate(m.on) || "no date")}</span>${icon(MEETING_ICON[m.type] ?? "lecture")}` +
          `${esc([m.type, m.location].filter(Boolean).join(" · "))}</span>${off}${resources.map(materialChip).join("")}</div>`;
      })
      .join("");
    const deckGap = has("deck");
    if (deckGap) count(tier);
    const lectureCell =
      lecture +
      (deckGap ? gapChip("deck", tier, promptFor("deck", w, run), deckGap.note) : "") +
      (lecture ? "" : '<span class="dash">—</span>');

    // Graded work, one column, the type said on the chip.
    const seen = new Set();
    const graded = [];
    for (const [list, verb, field] of [[w.opens, "opens", "opens_on"], [w.due, "due", "due_on"]]) {
      for (const a of list ?? []) {
        graded.push(workChip(a, `${verb} ${shortDate(a[field])}`));
        if (showGaps && !hasBrief(a) && !seen.has(a.assessment_id)) {
          seen.add(a.assessment_id);
          count(tier);
          graded.push(gapChip("brief", tier, promptFor("brief", w, run, a.assessment_id),
            `${a.assessment_id} has no brief and no description.`));
        }
      }
    }
    // In the student preview there is no card for undated work, so it stays
    // on the week the record places it in.
    if (!showGaps) for (const a of w.undated ?? []) graded.push(workChip(a, "no date"));
    const gradedCell = graded.join("") || '<span class="dash">—</span>';

    // Outcomes: taught by the week's module, assessed by work falling due in it.
    const taught = new Map();
    for (const m of w.modules ?? []) for (const o of m.outcomes ?? []) taught.set(o.id, o.title ?? o.id);
    const assessed = new Set((w.due ?? []).flatMap((a) => a.outcomes ?? []));
    const outcomeIds = [...new Set([...taught.keys(), ...assessed])].sort();
    const titles = new Map((data.outcomes ?? []).map((o) => [o.outcome_id, o.title]));
    const outcomeCell =
      outcomeIds
        .map((id) => {
          const how = taught.has(id) && assessed.has(id) ? "taught · assessed" : assessed.has(id) ? "assessed" : "taught";
          return `<span class="chip lo${assessed.has(id) ? " hit" : ""}" title="${esc(`${taught.get(id) ?? titles.get(id) ?? id} — ${how}`)}">` +
            `${icon("outcome")}${esc(id)}<span class="k">${how}</span></span>`;
        })
        .join("") || '<span class="dash">—</span>';

    return head + conceptRow +
      `<div class="cell" data-col="Lecture">${lectureCell}</div>` +
      `<div class="cell" data-col="Graded work">${gradedCell}</div>` +
      `<div class="cell" data-col="Outcomes">${outcomeCell}</div>`;
  };

  const bandRow = (run_) => {
    const a = run_[0];
    const z = run_[run_.length - 1];
    const span = `Weeks ${a.week}–${z.week}`;
    const work = run_.flatMap((w) => [
      ...(w.opens ?? []).map((x) => workChip(x, `opens ${shortDate(x.opens_on)}`)),
      ...(w.due ?? []).map((x) => workChip(x, `due ${shortDate(x.due_on)}`)),
    ]);
    let plan = "";
    if (showGaps) {
      const tier = tierOf(a, current);
      for (const w of run_) if ((w.gaps ?? []).some((g) => g.kind === "module")) count(tier);
      plan = `<button type="button" class="chip gap ${tier}" data-ask="${esc(
        `${span} of ${run.id} have no module. Propose what they should teach, given what comes before them ` +
          "and what falls due in them, as draft modules for me to read.",
      )}">${icon("module")}Plan ${esc(span.toLowerCase())}</button>`;
    }
    return `<div class="band" id="week-${a.week}"><b>${icon("calendar")} ${esc(span)}</b>` +
      `<span class="k mono">${esc(shortDate(a.starts_on))} – ${esc(shortDate(z.ends_on))}</span>` +
      `<span class="none">${showGaps ? `unplanned · ${run_.length} weeks` : "no sessions scheduled"}</span>` +
      work.join("") + plan + "</div>";
  };

  const body = rows.map((r) => (r.band ? bandRow(r.band) : weekRow(r.week))).join("");

  const tallyHtml = showGaps
    ? `<div class="tally" title="${esc(
        Object.entries(data.totals?.gaps ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · "),
      )}"><span class="${tally.soon ? "soon" : "zero"}">${tally.soon} this week or next</span>` +
      `<span class="${tally.later ? "" : "zero"}">${tally.later} later</span>` +
      `<span class="past">${tally.past} in weeks taught</span></div>`
    : "";

  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(`${run.course_id ?? ""} · course mode`)}</title>` +
    `<style>:root{${dark ? DARK : LIGHT}}${STYLE}</style></head><body>` +
    SPRITE +
    `<div class="strip"><span class="note">${esc(run.term ?? "")} · ${
      current ? `week ${current} of ${weeks.length}` : `${weeks.length} weeks`
    } · press a hole to have Claude fill it</span>${tallyHtml}</div>` +
    (student
      ? '<div class="banner"><b>Preview as student.</b> The record alone — no hole, no note about what has not been written yet.</div>'
      : "") +
    lead +
    `<div class="grid"><div class="th">Lecture</div><div class="th">Graded work</div><div class="th">Outcomes</div>${body}</div>` +
    `<p class="foot">Structure only — nothing here is derived from student work. Accepting a draft is changing ` +
    `<span class="mono">approval: draft</span> in its record; this page points at records and changes none.</p>` +
    SCRIPT +
    "</body></html>"
  );
};
