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
--draft:#2f5b8a;--draft-line:#bdd0e4;--draft-tint:#eef3f9;--on-fg:#fff;--hw:#a46a1f;`;
// DSH's theme is an explicit choice on its body, not the OS setting, so the
// host passes it and the page does not consult `prefers-color-scheme`.
const DARK = `--ground:#101310;--surface:#191d1a;--sunk:#141815;--ink:#e6eae4;--muted:#99a399;
--line:#2b312c;--rule:#222722;--accent:#7fc98d;--accent-ink:#a6dcaf;--accent-line:#33513a;
--accent-tint:#18231a;--flag:#e08c85;--flag-line:#6b3a37;--flag-tint:#2a1c1b;
--draft:#8fb6de;--draft-line:#37506b;--draft-tint:#171f27;--on-fg:#0d100d;--hw:#d9a35b;`;

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
.wkhead,.band{scroll-margin-top:calc(var(--strip-h,45px) + 38px)}
.wkhead.now,.band.now{background:var(--accent-tint)}.wkhead.now>b{color:var(--accent)}
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
.mode{margin:14px 20px 24px;display:flex;flex-direction:column;gap:14px}
.mode .foot{margin:0}
.calm{margin:0;color:var(--muted);font-size:13px}
button.link{border:0;background:none;padding:0;font:inherit;font-size:13px;color:var(--accent-ink);cursor:pointer;text-align:left;text-decoration:underline;text-decoration-color:var(--accent-line);text-underline-offset:2px}
.status{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding-left:9px;margin:-1px 0 3px;font-size:12px}
.status .stat{color:var(--muted);font-variant-numeric:tabular-nums}
.status .stat.yours{color:var(--draft);font-weight:500}
.status .badge{border-radius:999px;padding:0 7px;border:1px dashed var(--flag-line);color:var(--flag)}
.chip.act{font-size:12px;padding:1px 7px;border-color:var(--accent-line);color:var(--accent-ink)}
.chip.act:hover{background:var(--accent-tint)}
.facts li .status{flex-basis:100%}
.facts li.flagged>span,.facts li.flagged>small{color:var(--flag)}
.mode.evidence .grid{margin:0}
.mode.evidence .facts li>small{flex-basis:100%;padding-left:1.4em}
.mode.evidence .facts li>a.chip+small,.mode.evidence .facts li>span.chip+small{padding-left:0}
small.none{color:var(--muted)}
.chip.ask.strong{border:1px solid var(--accent-line);background:var(--surface);font-weight:500}
.gap[data-ask]::after{content:"\\2726";margin-left:2px;font-size:.85em;opacity:.75}
.primary{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font:inherit;font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--on-fg);cursor:pointer}
.weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.wcard{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 13px;display:flex;flex-direction:column;gap:2px}
.wcard small{color:var(--muted);font-size:12px}
.wcard b{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}
.wcard.ok{background:var(--accent-tint);border-color:var(--accent-line)}.wcard.ok b,.wcard.ok small{color:var(--accent-ink)}
.wcard.bad{background:var(--flag-tint);border-color:var(--flag-line)}.wcard.bad b,.wcard.bad small{color:var(--flag)}
.faults{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.faults li{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--surface);border:1px dashed var(--flag-line);color:var(--flag)}
.faults li.warn{border-color:var(--line);color:var(--ink)}
.faults li span{flex:1}
table.plan{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:clip;font-size:13px}
table.plan th{text-align:left;background:var(--sunk);color:var(--muted);font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;border-bottom:1px solid var(--line)}
table.plan td{padding:6px 12px;border-top:1px solid var(--rule);vertical-align:middle}
table.plan tr.now td{background:var(--accent-tint)}
table.plan .wkn{width:72px;white-space:nowrap}.wkn b{font-size:16px;margin-right:6px;font-variant-numeric:tabular-nums}.wkn small{color:var(--muted);font-size:12px}
.topic span{font-weight:500}.topic small{margin-left:8px;color:var(--muted);font-size:12px}
.notopic{color:var(--flag);font-style:italic;font-weight:400!important}.draftword{color:var(--draft)}
table.plan td.lane{width:16%;min-width:140px;padding:0 6px}
.lanehead{border-bottom:3px solid var(--lane)!important}
.lseg{display:flex;flex-direction:column;justify-content:center;gap:1px;min-height:30px;border-left:3px solid var(--lane);padding:3px 8px;font-size:12px;color:var(--ink);text-decoration:none;background:color-mix(in srgb,var(--lane) 12%,var(--surface))}
.lseg.first{border-top-right-radius:6px}.lseg.last{border-bottom-right-radius:6px}
.lseg.draft{border-left-style:dashed}
.segt{font-weight:600}.segd{font-variant-numeric:tabular-nums}
.q{--lane:var(--draft)}.hw{--lane:var(--hw)}.pj{--lane:var(--accent)}.ex,.ot{--lane:var(--muted)}
.trio-wrap{display:flex;flex-direction:column;gap:12px}.trio-wrap[hidden]{display:none}
.stepper{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.stepper .chip{cursor:pointer}.stepper b{font-size:14px}
.private{margin-left:auto;font-size:12px;color:var(--muted)}
.trio{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr);gap:12px;align-items:start}
.side,.focus{border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:8px}
.side{background:var(--sunk)}.side.empty p{margin:0;color:var(--muted)}
.side>small,.focus>small{color:var(--muted);font-size:12px}
.side>b{font-size:14px}
.focus{background:var(--surface);border:2px solid var(--accent-line)}
.focus h2{margin:0;font-size:20px;font-weight:600}
.focus .concepts{padding:0;grid-column:auto}
.facts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.facts li{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.facts li small{color:var(--muted);font-size:12px}
.facts.big{font-size:14px}
.need{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--flag-tint);color:var(--flag);font-size:13px}
.need span{flex:1}.need.warn{background:var(--sunk);color:var(--ink)}
.revisit{border-left:3px solid var(--hw);padding:6px 10px;background:var(--sunk);font-size:13px}
.revisit b{display:block;margin-bottom:2px}.revisit p{margin:2px 0 0}
@media (max-width:900px){.trio{grid-template-columns:1fr}.trio .focus{order:-1}}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
@media (max-width:900px){
  .grid{grid-template-columns:1fr}.th{display:none}
  .cell{border-left:0;padding:4px 12px;flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:6px}
  .cell::before{content:attr(data-col);color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;flex:0 0 96px}
}`;

/**
 * Presses, out to the harness: the two messages every pane document sends,
 * and the four a status line's buttons send to open the pane's own windows
 * (`grade`, `scans`, `defence-desk`, `publish`). `parent === window` means the page was opened in a
 * tab by itself, with nobody listening, so it takes no clicks at all. A
 * modified click keeps the tab a link always opened.
 *
 * And the sticky column heads sit under the strip by its MEASURED height,
 * because the strip wraps on a narrow frame.
 *
 * The page opens on this week. Once is not enough: the frame is sandboxed
 * with an opaque origin and may be given its size only after this runs, so
 * a scroll made at parse time is lost and the page sits on week 1. It is
 * made again on load, on resize and whenever the page reflows, until the
 * professor scrolls themselves.
 *
 * Teaching steps between weeks in the page, with no round trip, and says
 * which week it stepped to (`teaching-week`): course mode keeps it, so
 * leaving Teaching and coming back returns to that week, not this one.
 */
const SCRIPT = `<script>(function(){
var strip=document.querySelector('.strip');
function measure(){if(strip)document.documentElement.style.setProperty('--strip-h',strip.offsetHeight+'px');}
measure();if(window.ResizeObserver&&strip)new ResizeObserver(measure).observe(strip);
var now=document.querySelector('.wkhead.now,.band.now'),moved=false;
function toNow(){if(now&&!moved&&innerHeight>0)now.scrollIntoView({block:'start'});}
['wheel','keydown','mousedown','touchstart'].forEach(function(k){addEventListener(k,function(){moved=true;},{once:true,passive:true});});
toNow();addEventListener('load',toNow);addEventListener('resize',toNow);if(window.requestAnimationFrame)requestAnimationFrame(toNow);
if(window.ResizeObserver)new ResizeObserver(toNow).observe(document.body);
document.addEventListener('click',function(e){
  var g=e.target.closest&&e.target.closest('[data-goto]');if(!g)return;
  var n=g.getAttribute('data-goto');
  document.querySelectorAll('.trio-wrap').forEach(function(s){s.hidden=s.getAttribute('data-week')!==n;});
  window.scrollTo(0,0);
  if(parent!==window)parent.postMessage({source:'professor-pane',kind:'teaching-week',week:Number(n)},'*');
});
if(parent===window)return;
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-ask]');
  if(b){e.preventDefault();parent.postMessage({source:'professor-pane',kind:'ask',prompt:b.getAttribute('data-ask')},'*');return;}
  var w=e.target.closest&&e.target.closest('[data-grade],[data-scans],[data-desk],[data-publish]');
  if(w){e.preventDefault();var m={source:'professor-pane'};
    if(w.hasAttribute('data-grade')){m.kind='grade';m.assessment=w.getAttribute('data-grade');m.label=w.getAttribute('data-label')||'';}
    else if(w.hasAttribute('data-scans')){m.kind='scans';m.assessment=w.getAttribute('data-scans');}
    else if(w.hasAttribute('data-desk')){m.kind='defence-desk';m.assessment=w.getAttribute('data-desk');m.student=w.getAttribute('data-student');}
    else{m.kind='publish';m.assessment=w.getAttribute('data-publish');m.label=w.getAttribute('data-label')||'';m.target=w.getAttribute('data-target')||'';}
    parent.postMessage(m,'*');return;}
  var a=e.target.closest&&e.target.closest('a[data-view]');if(!a)return;
  if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  e.preventDefault();
  parent.postMessage({source:'professor-pane',kind:'view',url:a.getAttribute('href'),label:a.getAttribute('data-view'),format:a.getAttribute('data-format'),papers:a.getAttribute('data-papers')},'*');
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
  // An exam with versions opens all of them in one overlay — tabs, or side by
  // side — rather than the one its record happens to name.
  const papers = Array.isArray(a.papers) && a.papers.length > 1 ? a.papers : null;
  if (papers) {
    return `<a class="${cls}" href="${esc(papers[0].url)}" target="_blank" rel="noopener" data-view="${esc(a.title)}" ` +
      `data-format="${esc(papers[0].format)}" data-papers="${esc(JSON.stringify(papers))}" ` +
      `title="open the ${papers.length} versions">${body}</a>`;
  }
  const href = a.viewable && a.url ? a.url : a.brief_url;
  if (href) {
    const format = a.viewable && a.url ? a.format : "html";
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" data-view="${esc(a.title)}" ` +
      `data-format="${esc(format)}" title="open the brief">${body}</a>`;
  }
  return `<span class="${cls}">${body}</span>`;
};

/**
 * Where a piece of graded work stands, under its chip: the host's figures
 * (`server/week-status.js`) said as words, each with the press that goes with
 * it. A press opens one of the pane's own windows over course mode — Grade,
 * Scans, Publish, the defence desk — and asks the chat nothing. Absent in the
 * student preview and in Planning, where the host sends no status.
 */
const statusLine = (a, status) => {
  const st = status ? status[a.assessment_id] : null;
  if (!st) return "";
  const id = esc(a.assessment_id);
  const label = esc(a.title ?? a.assessment_id);
  const parts = [];
  if (st.grading) {
    parts.push(`<span class="stat">${st.grading.suggested} suggested · ${st.grading.decided} decided</span>` +
      `<button type="button" class="chip act" data-grade="${id}" data-label="${label}" title="Open the Grade view">Grade</button>`);
  }
  if (st.scans) {
    parts.push(`<span class="stat${st.scans.whose === "you" ? " yours" : ""}">${esc(st.scans.phrase)}</span>` +
      `<button type="button" class="chip act" data-scans="${id}" title="Open the pile in Scans">Scans</button>`);
  }
  if (st.defences) {
    parts.push(`<span class="stat">${st.defences.defended} of ${st.defences.of} defended</span>` +
      (st.defences.student
        ? `<button type="button" class="chip act" data-desk="${id}" data-student="${esc(st.defences.student)}" ` +
          `title="${esc(`The defence desk, on ${st.defences.student}`)}">Open defence desk</button>`
        : ""));
  }
  if (st.canvas) {
    parts.push(`<span class="badge">${st.canvas === "some" ? "not in every Canvas course yet" : "not in Canvas yet"}</span>` +
      `<button type="button" class="chip act" data-publish="${id}" data-target="canvas" data-label="${label}" ` +
      `title="Send its definition to Canvas — reads a plan first">publish…</button>`);
  }
  if (st.repo) {
    parts.push(`<span class="badge">no starter repository yet</span>` +
      `<button type="button" class="chip act" data-publish="${id}" data-target="homework" data-label="${label}" ` +
      `title="Create the starter repository on GitHub — reads a plan first">publish…</button>`);
  }
  return parts.length ? `<span class="status">${parts.join("")}</span>` : "";
};

const hasBrief = (a) => Boolean(a.url || a.brief_url || String(a.description ?? "").trim());

const titleOf = (w) => (w.modules ?? []).map((m) => m.title).join(" · ");
const conceptsOf = (w) => (w.modules ?? []).flatMap((m) => m.concepts ?? []);
const askButton = (prompt, label, cls = "chip ask") =>
  `<button type="button" class="${cls}" data-ask="${esc(prompt)}">${icon("ask")}${esc(label)}</button>`;

// ---------------------------------------------------------------- planning

/**
 * Does the term hold together — asked at the start of a term, of the term as
 * a structure. The weights against a whole, one row per week with its topic
 * and the graded work running through it as lanes, and the faults said as
 * sentences with one press each. No rooms, times or decks: those are
 * teaching questions. Built from the outline payload alone, so it carries
 * nothing derived from student work.
 */
const LANES = [["quiz", "Quizzes", "q"], ["assignment", "Homework", "hw"], ["project", "Project", "pj"], ["exam", "Exams", "ex"]];
const laneOf = (type) => LANES.find((l) => l[0] === type) ?? ["other", "Other", "ot"];

const planningBody = (data, { student }) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const weekOf = (date) => (date ? weeks.find((w) => date >= w.starts_on && date <= w.ends_on)?.week ?? null : null);

  // Weights by kind of work, against the model's own total and verdict.
  const groups = [];
  for (const a of data.assessments ?? []) {
    const [, name] = laneOf(a.type);
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, weight: 0, count: 0, unweighted: 0 }));
    g.count += 1;
    if (a.weight === null || a.weight === undefined) g.unweighted += 1;
    else g.weight += a.weight;
  }
  const grading = data.grading ?? {};
  const cards =
    groups
      .map((g) => `<div class="wcard"><small>${esc(g.name)}</small><b>${esc(pct(g.weight) || "—")}</b>` +
        `<small>${g.count} ${g.count === 1 ? "item" : "items"}${g.unweighted ? ` · ${g.unweighted} with no weight` : ""}</small></div>`)
      .join("") +
    `<div class="wcard ${grading.complete ? "ok" : "bad"}"><small>Total</small><b>${esc(pct(grading.total_weight) || "—")}</b>` +
    `<small>${grading.complete ? "weights add up" : "does not add up"}</small></div>`;

  // A span per piece of graded work, the week it opens to the week it is due.
  const spans = (data.assessments ?? []).map((a) => {
    const end = weekOf(a.due_on);
    return { a, lane: laneOf(a.type), start: weekOf(a.opens_on) ?? end, end };
  });
  const lanes = LANES.concat([["other", "Other", "ot"]]).filter((l) => spans.some((s) => s.lane[1] === l[1]));

  // Faults, as sentences. Unplanned runs, quiet runs, undated work, weights.
  const faults = [];
  if (!student) {
    const unplanned = weeks.filter((w) => (w.gaps ?? []).some((g) => g.kind === "module")).map((w) => w.week);
    const runsOf = (list) =>
      list.reduce((all, n) => {
        const last = all[all.length - 1];
        if (last && last[last.length - 1] === n - 1) last.push(n);
        else all.push([n]);
        return all;
      }, []);
    for (const r of runsOf(unplanned)) {
      const span = r.length === 1 ? `Week ${r[0]}` : `Weeks ${r[0]}–${r[r.length - 1]}`;
      faults.push(["flag", "module", `${span} ${r.length === 1 ? "has" : "have"} no topic`,
        `${span} of ${run.id} ${r.length === 1 ? "has" : "have"} no module. Propose what ${r.length === 1 ? "it" : "they"} should teach, ` +
          "given what comes before and what falls due, as draft modules for me to read.",
        r.length === 1 ? `Plan week ${r[0]}` : "Plan these weeks"]);
    }
    const graded = new Set();
    for (const s of spans) if (s.start !== null && s.end !== null) for (let n = s.start; n <= s.end; n += 1) graded.add(n);
    for (const r of runsOf(weeks.map((w) => w.week).filter((n) => !graded.has(n))).filter((r) => r.length >= 2)) {
      const span = `Weeks ${r[0]}–${r[r.length - 1]}`;
      faults.push(["warn", "quiz", `${span}: nothing graded opens, runs or falls due`,
        `${span} of ${run.id} have no graded work opening, running or falling due. Should something be assessed ` +
          "there, given what those weeks teach? Propose it as a draft; change nothing else.",
        "Suggest an assessment"]);
    }
    const undated = [...weeks.flatMap((w) => w.undated ?? []), ...(data.unplaced?.assessments ?? [])];
    for (const a of undated) faults.push(["flag", "calendar", `${a.title} has no dates`, datesPrompt(a, run), "Set dates"]);
    if (!grading.complete) {
      faults.push(["flag", "weight", grading.note || "The weights do not add up to 100%",
        `The weights in ${run.id} do not settle the grading policy: ${grading.note || "they do not add up"} ` +
          "Propose a correction and wait.", "Fix the weights"]);
    }
  }
  const faultList = student
    ? ""
    : faults.length
      ? `<ul class="faults">${faults
          .map(([tone, ic, text, prompt, verb]) =>
            `<li class="${tone}">${icon(ic)}<span>${esc(text)}</span>${askButton(prompt, verb, "chip ask strong")}</li>`)
          .join("")}</ul>`
      : '<p class="calm">Every week has a topic, the graded work is spread, and the weights add up.</p>';

  const rows = weeks
    .map((w) => {
      const title = titleOf(w);
      const n = conceptsOf(w).length;
      const draft = (w.modules ?? []).some((m) => m.draft);
      const lanesHtml = lanes
        .map((l) => {
          const here = spans.filter((s) => s.lane[1] === l[1] && s.start !== null && w.week >= s.start && w.week <= s.end);
          return `<td class="lane">${here
            .map((s) => {
              const first = w.week === s.start;
              const last = w.week === s.end;
              const inner =
                (first ? `<span class="segt">${esc(s.a.title)}</span>` : "") +
                (last ? `<span class="segd">due ${esc(shortDate(s.a.due_on))} · ${esc(pct(s.a.weight) || "no weight")}</span>` : "");
              const cls = `lseg ${s.lane[2]}${first ? " first" : ""}${last ? " last" : ""}${s.a.draft ? " draft" : ""}`;
              const href = s.a.viewable && s.a.url ? s.a.url : s.a.brief_url;
              const tip = `${s.a.title}${s.a.opens_on ? " · opens " + shortDate(s.a.opens_on) : ""} · due ${shortDate(s.a.due_on)}`;
              return href
                ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" data-view="${esc(s.a.title)}" ` +
                    `data-format="${esc(s.a.viewable && s.a.url ? s.a.format : "html")}" title="${esc(tip)}">${inner}</a>`
                : `<span class="${cls}" title="${esc(tip)}">${inner}</span>`;
            })
            .join("")}</td>`;
        })
        .join("");
      return `<tr class="${w.when === "current" ? "now" : ""}"><td class="wkn"><b>${w.week}</b><small>${esc(shortDate(w.starts_on))}</small></td>` +
        `<td class="topic">${
          title
            ? `<span class="${draft ? "draftword" : ""}">${esc(title)}</span>${n ? `<small>${n} ${n === 1 ? "concept" : "concepts"}</small>` : ""}${draft ? "<small>draft</small>" : ""}`
            : '<span class="notopic">No topic yet</span>'
        }</td>${lanesHtml}</tr>`;
    })
    .join("");

  return `<div class="mode"><div class="weights">${cards}</div>${faultList}` +
    `<table class="plan"><thead><tr><th>Week</th><th>Topic</th>${lanes
      .map((l) => `<th class="lanehead ${l[2]}">${esc(l[1])}</th>`)
      .join("")}</tr></thead><tbody>${rows}</tbody></table>` +
    `<p class="foot">Each bar runs from the week a piece of work opens to the week it is due. Rooms, times and decks are in Teaching.</p></div>`;
};

// ---------------------------------------------------------------- teaching

/**
 * One week between its neighbours — asked during the term. The week in focus
 * is the large card; the one before says what was taught and handed in and
 * how its concepts landed, the one after what has to be ready. Every week of
 * the term is rendered, and the page's script shows one trio at a time, so
 * ‹ › needs no round trip.
 *
 * Private. It carries class figures — a concept's class mean over approved
 * evidence, how much of a piece of work has been handed in, the open signals —
 * which is why it is a mode of its own, behind the pane, and never part of a
 * document a student may be shown.
 */
const REVISIT_BELOW = 0.6;

const teachingBody = (data, evidence, status, focus = null) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const at = (n) => weeks.find((w) => w.week === n) ?? null;
  const concepts = evidence.concepts ?? {};
  const handed = evidence.handed_in ?? {};
  const signals = evidence.signals ?? [];

  // One status line per piece of work in a week: on its due line when it is
  // due in the same week it opens.
  const workLine = (a, verb, date, withHanded, week) => {
    const h = handed[a.assessment_id];
    return `<li>${workChip(a, `${verb} ${shortDate(date)}`)}` +
      (withHanded && h && h.enrolled ? `<small>${h.received} of ${h.enrolled} handed in</small>` : "") +
      (withHanded || !(week?.due ?? []).some((d) => d.assessment_id === a.assessment_id) ? statusLine(a, status) : "") + "</li>";
  };
  const deckNeed = (w) => {
    const meets = w.meetings ?? [];
    if (!meets.length || meets.some((m) => (m.resources ?? []).some((r) => r.kind === "slides"))) return "";
    return `<div class="need">${icon("slides")}<span>No slides yet</span>${askButton(promptFor("deck", w, run), "Draft slides", "chip ask strong")}</div>`;
  };
  const meetingLine = (m) =>
    `<li>${icon(MEETING_ICON[m.type] ?? "lecture")}<span>${esc(shortDate(m.on) || "no date")} · ${esc(m.type)}</span>` +
    `<small>${esc(m.location ?? "")}</small></li>`;

  const side = (w, label) => {
    if (!w) return `<div class="side empty"><small>${esc(label)}</small><p>Outside the run.</p></div>`;
    const taught = current !== null && w.week < current;
    const ev = taught
      ? conceptsOf(w)
          .map((c) => {
            const x = concepts[c.id];
            return `<li>${icon("concept")}<span>${esc(c.title ?? c.id)}</span><small>${
              x && x.class_mean !== null && x.class_mean !== undefined
                ? `class ${esc(pct(x.class_mean))} · ${esc(x.coverage ?? "")}`
                : "not assessed yet"
            }</small></li>`;
          })
          .join("")
      : "";
    return `<div class="side"><small>${esc(label)} · week ${w.week}</small><b>${esc(titleOf(w) || "No topic yet")}</b>` +
      `<ul class="facts">${(w.meetings ?? []).map(meetingLine).join("")}` +
      (w.opens ?? []).map((a) => workLine(a, "opens", a.opens_on, false, w)).join("") +
      (w.due ?? []).map((a) => workLine(a, "due", a.due_on, true)).join("") + ev + "</ul>" +
      deckNeed(w) + `<button type="button" class="link" data-goto="${w.week}">Make this the focus ›</button></div>`;
  };

  const focusCard = (w) => {
    const misdated = (w.gaps ?? []).find((g) => g.kind === "misdated");
    const off = misdated
      ? misdated.ids
          .map((id) => {
            const m = (w.meetings ?? []).find((x) => x.activity_id === id) ?? {};
            const word = m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "A meeting";
            return `<div class="need warn" title="${esc(misdated.note)}">${icon("misdated")}<span>${esc(word)} dated ${esc(shortDate(m.on))}, ${
              m.on < w.starts_on ? `before this week starts (${esc(shortDate(w.starts_on))})` : `after this week ends (${esc(shortDate(w.ends_on))})`
            }</span>${askButton(promptFor("misdated", w, run, id), "Check date", "chip ask strong")}</div>`;
          })
          .join("")
      : "";
    const meetings = (w.meetings ?? [])
      .map((m) => {
        const resources = [...(m.resources ?? [])].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
        return `<li>${icon(MEETING_ICON[m.type] ?? "lecture")}<span>${esc(shortDate(m.on) || "no date")} · ${esc(
          [m.type, m.location].filter(Boolean).join(" · "),
        )}</span>${resources.map(materialChip).join("")}</li>`;
      })
      .join("");
    const work = [
      ...(w.opens ?? []).map((a) => workLine(a, "opens", a.opens_on, false, w)),
      ...(w.due ?? []).map((a) => workLine(a, "due", a.due_on, true)),
    ].join("");
    // What to repair before building on it: concepts taught in the two weeks
    // before the focus whose class mean sits under the line.
    const revisit = [w.week - 1, w.week - 2]
      .map(at)
      .filter(Boolean)
      .flatMap((p) =>
        conceptsOf(p)
          .map((c) => ({ c, x: concepts[c.id], week: p.week }))
          .filter(({ x }) => x && x.class_mean !== null && x.class_mean !== undefined && x.class_mean < REVISIT_BELOW),
      );
    const module = (w.modules ?? [])[0];
    const prepare =
      `For week ${w.week} of ${run.id}${module ? ` (${module.module_id})` : ""}, what should I teach and what should I revisit first?` +
      (revisit.length ? ` The class is weakest on ${revisit.map((r) => r.c.title ?? r.c.id).join(" and ")}.` : "");
    return `<div class="focus"><small>${w.week === current ? "This week" : `Week ${w.week}`} · ${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</small>` +
      `<h2>${esc(titleOf(w) || "No topic yet")}</h2>` +
      (conceptsOf(w).length ? `<div class="concepts">${icon("concept")}${conceptsOf(w).map((c) => `<span class="chip concept">${esc(c.title ?? c.id)}</span>`).join("")}</div>` : "") +
      (meetings ? `<ul class="facts big">${meetings}</ul>` : '<p class="calm">No meeting this week.</p>') +
      off + deckNeed(w) +
      (work ? `<ul class="facts">${work}</ul>` : '<p class="calm">Nothing graded opens or falls due this week.</p>') +
      (revisit.length || signals.length
        ? `<div class="revisit"><b>Revisit first</b>${revisit
            .map((r) => `<p>${esc(r.c.title ?? r.c.id)} — class ${esc(pct(r.x.class_mean))} on ${esc(r.x.coverage ?? "")} observed, taught in week ${r.week}</p>`)
            .join("")}${signals.length ? `<p>${signals.length} open signal${signals.length === 1 ? "" : "s"}: ${esc(signals[0].description ?? "")}</p>` : ""}</div>`
        : "") +
      askButton(prepare, "Prepare this week", "primary") + "</div>";
  };

  // The week the professor last stepped to, when course mode kept one;
  // otherwise this week.
  const start = weeks.some((w) => w.week === focus) ? focus : current ?? 1;
  const sections = weeks
    .map((w) => {
      const prev = at(w.week - 1);
      const next = at(w.week + 1);
      const step =
        `<div class="stepper">` +
        (prev ? `<button type="button" class="chip" data-goto="${prev.week}">‹ Week ${prev.week}</button>` : "") +
        `<b>Week ${w.week} of ${weeks.length}</b>` +
        (current !== null && w.week !== current ? `<button type="button" class="chip" data-goto="${current}">Back to this week</button>` : "") +
        (next ? `<button type="button" class="chip" data-goto="${next.week}">Week ${next.week} ›</button>` : "") +
        `<span class="private">Private — class figures from approved evidence only</span></div>`;
      return `<section class="trio-wrap" data-week="${w.week}"${w.week === start ? "" : " hidden"}>${step}` +
        `<div class="trio">${side(prev, "Before")}${focusCard(w)}${side(next, "After")}</div></section>`;
    })
    .join("");
  return `<div class="mode">${sections}</div>`;
};

// ---------------------------------------------------------------- evidence

/**
 * How each week actually went — asked during and after the term, of every
 * week at once, which no other view answers: Progress is keyed by concept and
 * the gradebook by assessment, and "which week went wrong" is a question about
 * weeks. The same spine as All weeks; per week, the work that fell due with
 * the gradebook's own figures for it, the concepts the week's module teaches
 * with their class mean, and the class-level signals about those concepts.
 *
 * Private, like Teaching, and from approved evidence only. Every figure is
 * the host payload's (`gradebook` summary, `class_progress`), printed as it
 * came: grouping under weeks is presentation, and nothing is added up here.
 * Aggregates only — no row of this page is about one student.
 */
const evidenceBody = (data, evidence, status) => {
  const run = data.run ?? {};
  const weeks = data.weeks ?? [];
  const current = data.current_week ?? null;
  const concepts = evidence.concepts ?? {};
  const work = evidence.work ?? {};
  const signals = evidence.signals ?? [];

  // A signal belongs to the first week that teaches one of its concepts.
  const weekOfConcept = new Map();
  for (const w of weeks) for (const c of conceptsOf(w)) if (!weekOfConcept.has(c.id)) weekOfConcept.set(c.id, w.week);
  const signalWeek = (s) => (s.concepts ?? []).map((c) => weekOfConcept.get(c)).find((n) => n !== undefined) ?? null;
  const loose = signals.filter((s) => signalWeek(s) === null);
  const signalLine = (s) =>
    `<li class="${s.severity === "high" ? "flagged" : ""}">${icon("concept")}<span>${esc(s.description)}</span>` +
    (s.severity ? `<small>${esc(s.severity)}</small>` : "") + "</li>";

  // Work in a week still to come has nothing to report yet: the gradebook
  // counts every row with no hand-in as `not_submitted` whatever the date,
  // and "81 not handed in" for a quiz due next week is an accusation.
  const figures = (a, w) => {
    if (w.when === "upcoming") return '<small class="none">not due yet</small>';
    const f = work[a.assessment_id];
    if (!f) return '<small class="none">no approved marks yet</small>';
    const out = [];
    if (f.enrolled !== null && f.submitted !== null) out.push(`${f.submitted} of ${f.enrolled} handed in`);
    if (f.not_submitted) out.push(`${f.not_submitted} not handed in`);
    if (f.graded !== null) out.push(`${f.graded} graded` + (f.partially_graded ? ` · ${f.partially_graded} partly` : ""));
    if (f.mean !== null) out.push(`mean ${f.mean}` + (f.maximum !== null ? ` of ${f.maximum}` : ""));
    if (f.median !== null) out.push(`median ${f.median}`);
    return `<small>${esc(out.join(" · "))}</small>`;
  };
  const measured = (w) =>
    (w.due ?? []).length > 0 ||
    conceptsOf(w).some((c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean !== undefined) ||
    signals.some((s) => signalWeek(s) === w.week);

  const row = (w) => {
    const due = (w.due ?? [])
      .map((a) => `<li>${workChip(a, `due ${shortDate(a.due_on)}`)}${figures(a, w)}${statusLine(a, status)}</li>`)
      .join("");
    const taught = conceptsOf(w)
      .map((c) => {
        const x = concepts[c.id];
        const has = x && x.class_mean !== null && x.class_mean !== undefined;
        const low = has && x.class_mean < REVISIT_BELOW;
        return `<li class="${low ? "flagged" : ""}">${icon("concept")}<span>${esc(c.title ?? c.id)}</span><small>${
          has ? `class ${esc(pct(x.class_mean))} · ${esc(x.coverage ?? "")} observed${low ? " · revisit" : ""}` : "not assessed yet"
        }</small></li>`;
      })
      .join("");
    const here = signals.filter((s) => signalWeek(s) === w.week).map(signalLine).join("");
    const module = (w.modules ?? [])[0];
    const weak = conceptsOf(w).filter((c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean < REVISIT_BELOW);
    const ask = weak.length
      ? askButton(
          `In week ${w.week} of ${run.id}${module ? ` (${module.module_id})` : ""}, the class is weakest on ` +
            `${weak.map((c) => c.id).join(", ")}. Read the approved evidence for those concepts and tell me what went wrong ` +
            "and what to revisit. Change nothing.",
          "Why did this week go wrong?",
        )
      : "";
    return `<div class="wkhead ${w.when === "current" ? "now" : w.when === "past" ? "past" : ""}" id="week-${w.week}">` +
      `<b>${w.week < 10 ? "0" + w.week : w.week}</b><span class="k mono">${esc(shortDate(w.starts_on))} – ${esc(shortDate(w.ends_on))}</span>` +
      (titleOf(w) ? `<h3>${esc(titleOf(w))}</h3>` : '<h3 class="none">Unplanned</h3>') +
      (w.when === "current" ? '<span class="pill now">this week</span>' : "") +
      `<span class="askw">${ask}</span></div>` +
      `<div class="cell" data-col="Due that week">${due ? `<ul class="facts">${due}</ul>` : '<span class="dash">—</span>'}</div>` +
      `<div class="cell" data-col="Concepts taught">${taught ? `<ul class="facts">${taught}</ul>` : '<span class="dash">—</span>'}</div>` +
      `<div class="cell" data-col="Signals">${here ? `<ul class="facts">${here}</ul>` : '<span class="dash">—</span>'}</div>`;
  };

  // A run of two or more weeks with nothing due and nothing measured is one band.
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && !measured(weeks[j])) j += 1;
    if (j - i >= 2) {
      const a = weeks[i];
      const z = weeks[j - 1];
      const holds = current !== null && current >= a.week && current <= z.week;
      rows.push(`<div class="band${holds ? " now" : ""}" id="week-${a.week}"><b>${icon("calendar")} Weeks ${a.week}–${z.week}</b>` +
        `<span class="k mono">${esc(shortDate(a.starts_on))} – ${esc(shortDate(z.ends_on))}</span>` +
        `<span class="none">nothing due, nothing measured yet</span></div>`);
      i = j;
    } else {
      rows.push(row(weeks[i]));
      i += 1;
    }
  }

  return `<div class="mode evidence"><div class="stepper"><b>${current ? `Week ${current} of ${weeks.length}` : `${weeks.length} weeks`}</b>` +
    `<span class="private">Private — class figures from approved evidence only</span></div>` +
    (loose.length ? `<div class="side"><small>Open signals not tied to a week</small><ul class="facts">${loose.map(signalLine).join("")}</ul></div>` : "") +
    `<div class="grid"><div class="th">Due that week</div><div class="th">Concepts taught</div><div class="th">Signals</div>${rows.join("")}</div>` +
    `<p class="foot">Hand-ins and marks are the gradebook's, from approved decisions; a concept's class mean is over approved evidence. ` +
    `A concept under ${esc(pct(REVISIT_BELOW))} is marked to revisit.</p></div>`;
};

/** A week nobody has planned and nothing meets in: a candidate for a band. */const isEmpty = (w) => !(w.modules ?? []).length && !(w.meetings ?? []).length;

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
export const courseModeDocument = (
  data,
  { dark = false, student = false, mode = "term", evidence = null, status = null, focus = null } = {},
) => {
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
          return workChip(a, "no date") + statusLine(a, status) +
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
        const last = verb === "due" || !(w.due ?? []).some((d) => d.assessment_id === a.assessment_id);
        graded.push(workChip(a, `${verb} ${shortDate(a[field])}`) + (student || !last ? "" : statusLine(a, status)));
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
      ...(w.opens ?? []).map((x) => workChip(x, `opens ${shortDate(x.opens_on)}`) + (student ? "" : statusLine(x, status))),
      ...(w.due ?? []).map((x) => workChip(x, `due ${shortDate(x.due_on)}`) + (student ? "" : statusLine(x, status))),
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
    const holds = current !== null && current >= a.week && current <= z.week;
    return `<div class="band${holds ? " now" : ""}" id="week-${a.week}"><b>${icon("calendar")} ${esc(span)}</b>` +
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

  // Which of the three readings this page is. Planning and the term table
  // are structure only; Teaching carries class figures and says so.
  const strip = (note, extra = "") =>
    `<div class="strip"><span class="note">${esc(run.term ?? "")} · ${
      current ? `week ${current} of ${weeks.length}` : `${weeks.length} weeks`
    } · ${esc(note)}</span>${extra}</div>`;
  const studentBanner = student
    ? '<div class="banner"><b>Preview as student.</b> The record alone — no hole, no note about what has not been written yet.</div>'
    : "";
  const structureFoot =
    `<p class="foot">Structure only — nothing here is derived from student work. Accepting a draft is changing ` +
    `<span class="mono">approval: draft</span> in its record; this page points at records and changes none.</p>`;

  let main;
  if (mode === "planning") {
    main = strip("does the term hold together") + studentBanner + planningBody(data, { student }) + structureFoot;
  } else if (mode === "teaching") {
    main = strip("this week, between the last and the next") + teachingBody(data, evidence ?? {}, status, focus);
  } else if (mode === "evidence") {
    main = strip("how each week went") + evidenceBody(data, evidence ?? {}, status);
  } else {
    main = strip("press a hole to have Claude fill it", tallyHtml) + studentBanner + lead +
      `<div class="grid"><div class="th">Lecture</div><div class="th">Graded work</div><div class="th">Outcomes</div>${body}</div>` +
      structureFoot;
  }

  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(`${run.course_id ?? ""} · course mode`)}</title>` +
    `<style>:root{${dark ? DARK : LIGHT}}${STYLE}</style></head><body>` +
    SPRITE + main + SCRIPT + "</body></html>"
  );
};
