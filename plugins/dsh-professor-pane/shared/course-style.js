/**
 * Course mode's stylesheet and its two palettes.
 *
 * Shared by the course page the server renders (server/course-mode.js) and the
 * React view of course mode (client/course/), so the two say the same thing.
 * No imports and nothing environment-specific: Node and the bundle both load it.
 */

export const LIGHT = `--ground:#f3f4f0;--surface:#fff;--sunk:#eceee8;--ink:#171b18;--muted:#5f685f;
--line:#dadfd6;--rule:#e8ebe4;--accent:#2f6b3c;--accent-ink:#245231;--accent-line:#bcd8c2;
--accent-tint:#eef5ef;--flag:#a4362f;--flag-line:#f0c4c0;--flag-tint:#fdf1f0;
--draft:#2f5b8a;--draft-line:#bdd0e4;--draft-tint:#eef3f9;--on-fg:#fff;--hw:#a46a1f;`;
// DSH's theme is an explicit choice on its body, not the OS setting, so the
// host passes it and the page does not consult `prefers-color-scheme`.
export const DARK = `--ground:#101310;--surface:#191d1a;--sunk:#141815;--ink:#e6eae4;--muted:#99a399;
--line:#2b312c;--rule:#222722;--accent:#7fc98d;--accent-ink:#a6dcaf;--accent-line:#33513a;
--accent-tint:#18231a;--flag:#e08c85;--flag-line:#6b3a37;--flag-tint:#2a1c1b;
--draft:#8fb6de;--draft-line:#37506b;--draft-tint:#171f27;--on-fg:#0d100d;--hw:#d9a35b;`;

export const STYLE = `
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
.segt{font-weight:600;color:inherit;text-decoration:none}a.segt:hover{text-decoration:underline}
.segt a{color:inherit;text-decoration:none}.segt a:hover{text-decoration:underline}
.segd{font-variant-numeric:tabular-nums}
button.segd{all:unset;font-variant-numeric:tabular-nums;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px}
button.segd:focus-visible{outline:2px solid var(--accent)}
.lseg[draggable="true"]{position:relative;cursor:grab}
.lseg.lifted{opacity:.35}
.grip{position:absolute;left:-3px;right:0;height:7px;cursor:ns-resize;z-index:1}
.grip.top{top:-1px}.grip.bottom{bottom:-1px}
.grip::after{content:"";position:absolute;left:30%;right:30%;top:2px;height:3px;border-radius:2px;background:var(--lane);opacity:0;transition:opacity .12s}
.lseg:hover .grip::after{opacity:.55}.grip:hover::after{opacity:1!important}
table.plan tr.drop td,table.plan tr.target td{background:var(--accent-tint);box-shadow:inset 0 1px 0 var(--accent-line),inset 0 -1px 0 var(--accent-line)}
table.plan tr.drop .wkn b,table.plan tr.target .wkn b{color:var(--accent)}
table.plan tr[data-taught] .wkn b{color:var(--muted)}
.lseg.locked{cursor:default}.lseg.locked .segd::after{content:" \\00b7 locked";color:var(--muted)}
.plantoast{position:fixed;z-index:50;left:50%;bottom:18px;transform:translateX(-50%);max-width:calc(100vw - 24px);padding:8px 12px;border-radius:9px;background:var(--ink);color:var(--surface);font-size:12.5px;box-shadow:0 6px 20px rgba(0,0,0,.2)}
.plantoast[hidden]{display:none}
.pf-sum{margin:0;font-size:13px;font-variant-numeric:tabular-nums}
.pf-more{all:unset;cursor:pointer;font-size:12px;color:var(--accent);text-decoration:underline dotted;text-underline-offset:2px;align-self:flex-start}
.planform.brief .pf-fields,.planform.brief .tf-meetings,.planform.brief .tf-other,.planform.brief .pf-note{display:none}
.planform:not(.brief) .pf-sum,.planform:not(.brief) .pf-more{display:none}
.pf-fields{display:flex;flex-direction:column;gap:8px}
.tray{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:10px 12px;border:1px dashed var(--flag-line);border-radius:12px;background:var(--surface)}
.tray>b{font-size:13px;font-weight:600;display:inline-flex;gap:6px;align-items:center;margin-right:4px;color:var(--flag)}
.tray>small{color:var(--muted);font-size:12px}
.traychip{cursor:grab}
.planform{position:fixed;z-index:40;width:290px;max-width:calc(100vw - 24px);display:flex;flex-direction:column;gap:8px;padding:13px 15px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.planform[hidden]{display:none}
.planform .pf-title{font-size:14px}
.planform small{color:var(--muted);font-size:12px}
.planform label{display:grid;grid-template-columns:48px 1fr;align-items:center;gap:2px 8px;font-size:13px}
.planform label small{grid-column:2}
.planform label small.off{color:var(--flag)}
.planform input,.planform select{font:inherit;font-size:13px;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--sunk);color:var(--ink);color-scheme:inherit}
.planform .pf-row{display:grid;grid-template-columns:48px 1fr;align-items:start;gap:8px;font-size:13px}
.planform .pf-row>span{padding-top:5px}
.pf-week-pick{display:flex;flex-wrap:wrap;gap:6px}
.pf-week-pick select:first-child{flex:1 1 100%}
.pf-week-pick select+select{flex:1 1 auto}
.pf-week-pick input[type=time]{flex:0 0 auto}
.pf-mode{all:unset;cursor:pointer;font-size:12px;color:var(--accent);text-decoration:underline dotted;text-underline-offset:2px;align-self:flex-start}
.planform .pf-error{margin:0;color:var(--flag);font-size:12px}
.pf-actions{display:flex;gap:8px;align-items:center}
.pf-actions .chip{cursor:pointer}
.planform .primary[disabled]{opacity:.5;cursor:default}
.tchip{font-weight:500;cursor:grab;border-radius:5px;padding:1px 4px;margin-left:-4px}
.tchip:hover{background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)}
.tchip.lifted{opacity:.35}
.topicform{width:330px}
table.plan td.mats{min-width:120px;max-width:260px}
td.mats{line-height:1.9}td.mats .chip{font-size:12px;padding:1px 7px;margin:1px 4px 1px 0}td.mats .none{color:var(--muted);font-size:12px}
.cbtn{all:unset;cursor:pointer;margin-left:8px;color:var(--accent);font-size:12px;text-decoration:underline dotted;text-underline-offset:2px}
.cbtn:hover{text-decoration-style:solid}.cbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
table.plan tr.projrow td{padding:3px 12px 5px;border-top:0}
.pline{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;border-left:3px solid var(--lane);border-radius:0 6px 6px 0;padding:5px 10px;font-size:12px;background:color-mix(in srgb,var(--lane) 12%,var(--surface))}
.pline .pl-kind{color:var(--muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.pline .pl-span{color:var(--muted);margin-left:auto;font-variant-numeric:tabular-nums}
.pline.draft{border-left-style:dashed}.pline[draggable="true"]{cursor:grab}.pline.lifted{opacity:.35}
.pline.locked .segd::after{content:" \\00b7 locked";color:var(--muted)}
.cmap{width:760px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto}
.cmap-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;padding-right:34px;position:relative}
.cmap-close{position:absolute;right:0;top:-3px;cursor:pointer;padding:0 8px;font-size:16px;line-height:24px}
.cmap-body{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr);gap:10px 48px;align-items:start;padding:4px 0}
.cmap-lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.cmap-col{display:flex;flex-direction:column;gap:6px;position:relative;z-index:1;min-width:0}
.cmap-col.mid{align-items:stretch}
.cmap-cap{font-size:11px!important;letter-spacing:.06em;text-transform:uppercase}
.cmap .chip.concept{justify-content:center;color:var(--ink);background:var(--sunk);border-color:var(--line);white-space:normal;transition:opacity .12s}
.cmap-topic{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:1px;padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;font-size:12.5px;transition:opacity .12s}
.cmap-topic:hover,.cmap-topic:focus-visible{border-color:var(--accent-line);background:var(--accent-tint)}
.cmap-topic b{font-weight:550}.cmap-topic .via{font-size:11px!important;line-height:1.3}
.cmap .dim{opacity:.3}
.tie{fill:none;stroke-width:1.5;opacity:.75;transition:opacity .12s}
.tie.needs{stroke:var(--accent)}.tie.late{stroke:var(--flag);stroke-width:2}.tie.feeds{stroke:var(--hw)}
.tie.related{stroke:var(--muted);stroke-dasharray:5 4}.tie.again{stroke:var(--muted);stroke-dasharray:1.5 3}
.tie.lit{opacity:1;stroke-width:2.5}.tie.dim{opacity:.1}
.cmap-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--rule);padding-top:7px}
.cmap-key span::before{content:"";display:inline-block;width:18px;height:0;border-top:2px solid var(--accent);vertical-align:middle;margin-right:5px}
.cmap-key .late::before{border-top-color:var(--flag)}.cmap-key .feeds::before{border-top-color:var(--hw)}
.cmap-key .related::before{border-top:2px dashed var(--muted)}.cmap-key .again::before{border-top:2px dotted var(--muted)}
.tf-meetings,.tf-other{display:flex;flex-direction:column;gap:6px}
.topicform label{grid-template-columns:64px 1fr}
.topicform label>span{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.topicform .tf-swap{display:flex;gap:8px;align-items:flex-start;font-size:13px;padding-top:6px;border-top:1px solid var(--rule)}
.topicform .tf-swap[hidden],.planform .tf-other[hidden]{display:none}
.topicform .tf-swap>span{color:var(--ink);font-size:13px;white-space:normal}
.topicform .tf-swap input{margin-top:3px}
.tf-other{padding-left:10px;border-left:2px solid var(--rule)}
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
.retitled{display:inline}
.repen{all:unset;display:inline-flex;vertical-align:-2px;margin-left:4px;padding:2px;border-radius:5px;color:var(--muted);cursor:pointer;opacity:0;transition:opacity .12s}
.repen .i{width:13px;height:13px}
.retitled:hover>.repen,.repen:focus-visible,tr:hover .retitled>.repen,.lseg:hover .retitled>.repen{opacity:.7}
.repen:hover{opacity:1!important;background:var(--sunk);color:var(--ink)}
.repen.solo{opacity:.55;margin-left:0}.meeting:hover .repen.solo,.workrow:hover .repen.solo{opacity:.85}
.retitle{display:inline-flex;flex-wrap:wrap;align-items:center;gap:5px;vertical-align:middle;max-width:100%}
.retitle input{font:inherit;font-size:13px;min-width:14ch;width:min(32ch,100%);padding:3px 7px;border:1px solid var(--accent-line);border-radius:7px;background:var(--surface);color:var(--ink);color-scheme:inherit}
.retitle .chip{padding:2px 8px;font-size:12px}
.retitle .chip.primary,.rdialog .chip.primary{background:var(--accent);border-color:var(--accent);color:var(--on-fg)}
.chip[disabled]{opacity:.5;cursor:default}
.reerror{color:var(--flag);font-size:12px;margin:0;flex-basis:100%}
.rdveil{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:9vh 16px 16px;background:rgba(0,0,0,.22)}
.rdialog{width:min(520px,100%);max-height:80vh;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px 18px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.rdhead{display:flex;align-items:center;gap:8px}
.rdhead .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.rdid{font-size:12px;color:var(--muted)}
.rdclose{all:unset;margin-left:auto;cursor:pointer;font-size:20px;line-height:1;color:var(--muted);padding:0 4px}
.rdfield{display:flex;flex-direction:column;gap:4px;font-size:13px}
.rdfield small{color:var(--muted);font-size:12px}
.rdfield input,.rdfield textarea{font:inherit;font-size:13.5px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--sunk);color:var(--ink);color-scheme:inherit;resize:vertical}
.rdnote{margin:0;font-size:12px;color:var(--muted)}
.rdask{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--line);color:var(--accent)}
.rdask input{flex:1;min-width:0;font:inherit;font-size:13px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
@media (max-width:900px){
  .grid{grid-template-columns:1fr}.th{display:none}
  .cell{border-left:0;padding:4px 12px;flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:6px}
  .cell::before{content:attr(data-col);color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;flex:0 0 96px}
}`;

