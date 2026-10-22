// Built by client/build.mjs from client/ — edit those, then `npm run build`.
window.__ModuleLoader__.load({
  id: "dsh-professor-pane",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/main.js
var main_exports = {};
__export(main_exports, {
  CourseMode: () => CourseMode,
  DefenceDesk: () => DefenceDesk,
  Integrations: () => Integrations,
  RecentMarks: () => RecentMarks,
  SheetNotice: () => SheetNotice,
  apply: () => apply,
  inject: () => inject,
  turnStep: () => turnStep
});
module.exports = __toCommonJS(main_exports);

// client/style.js
var CSS_ID = "dsh-professor-pane/pane.css";
var PANE_CSS = `
.pp-root{display:flex;flex-direction:column;height:100%;min-width:0;
  background:var(--dsw-alias-bg-l1,transparent);color:var(--dsw-alias-label-primary,inherit)}
.pp-head{flex:none;padding:10px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-titlerow{display:flex;align-items:baseline;gap:8px;min-width:0}
.pp-title{font-size:13px;font-weight:600;flex:1;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The one control in the header that changes something outside this machine.
   An outline rather than a fill: it opens a dialog and publishes nothing by
   itself, so it should not look like the red button two presses further in. */
.pp-publishbtn{flex:none}
.pp-close{flex:none;background:0 0;border:0;cursor:pointer;padding:2px 4px;border-radius:6px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);font-size:14px;line-height:1}
.pp-close:hover{color:var(--dsw-alias-label-secondary,#444)}
.pp-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b);margin:1px 0 8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-runs{width:100%;margin:0 0 8px;font:inherit;font-size:11.5px;padding:3px 5px;border-radius:6px;
  color:inherit;background:var(--dsw-alias-fill-l2,transparent);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}
.pp-tabs::-webkit-scrollbar{display:none}
.pp-tab{flex:none;background:0 0;border:0;border-bottom:2px solid transparent;cursor:pointer;
  padding:5px 8px 6px;font:inherit;font-size:11.5px;white-space:nowrap;border-radius:6px 6px 0 0;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-tab:hover{color:var(--dsw-alias-label-secondary,#444)}
.pp-tab[aria-selected=true]{color:var(--dsw-alias-label-primary,#111);font-weight:600;
  border-bottom-color:var(--dsw-alias-label-primary,#111)}
/* Wraps rather than squeezes. Tasks now carries three sub-views, the draft
   pair and the identity pair, which is seven controls in a column the layout
   will not widen past the conversation; a row that overflows hides the last
   one, and the last one is Pseudonyms. */
.pp-seg{display:flex;flex-wrap:wrap;gap:4px;row-gap:4px;flex:none;padding:8px 12px 0;
  align-items:center}
.pp-segspacer{flex:1}
/* ---- Buttons. One system for every press in the pane, by role, not by view:
   secondary  .pp-segbtn .pp-syncbtn .pp-publishbtn   outline: most presses
   primary    .pp-primary .pp-syncbtn-run             filled green: the step forward
   danger     .pp-danger .pp-syncbtn-send             filled red: reaches students
   toggle     .pp-segbtn[aria-pressed]                a choice of view, selected
   quiet      .pp-linkbtn .pp-morebtn                 underlined text
   One height, one pill shape, one type size; the same hover, focus, disabled
   and busy states. A press that is working says so with [aria-busy=true]: a
   spinner, moving stripes, and, with .pp-btn-progress and --pp-progress, a
   fill that grows as the work does. */
.pp-segbtn,.pp-syncbtn,.pp-publishbtn,.pp-primary,.pp-danger{
  position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  box-sizing:border-box;min-height:26px;padding:0 12px;border-radius:999px;cursor:pointer;
  font:inherit;font-size:11.5px;font-weight:500;line-height:1;white-space:nowrap;text-decoration:none;
  color:var(--dsw-alias-label-primary,#1d1d1f);background:transparent;
  border:1px solid var(--dsw-alias-border-l3,#d2d2d7);
  transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s}
.pp-segbtn:hover:not(:disabled),.pp-syncbtn:hover:not(:disabled),.pp-publishbtn:hover:not(:disabled){
  background:var(--dsw-alias-fill-secondary,#f2f2f4);border-color:var(--dsw-alias-label-tertiary,#9a9a9f)}
.pp-segbtn[aria-pressed=false]{color:var(--dsw-alias-label-tertiary,#6b6b6b);font-weight:500}
.pp-segbtn[aria-pressed=true]{color:var(--dsw-alias-bg-l1,#fff);background:var(--dsw-alias-label-primary,#1d1d1f);
  border-color:var(--dsw-alias-label-primary,#1d1d1f);font-weight:600}
.pp-segbtn[aria-pressed=true]:hover:not(:disabled){background:var(--dsw-alias-label-primary,#1d1d1f)}
.pp-primary,.pp-syncbtn-run{color:#fff;background:#2f8a4e;border-color:#2f8a4e;font-weight:600}
.pp-primary:hover:not(:disabled),.pp-syncbtn-run:hover:not(:disabled){background:#28794a;border-color:#28794a}
.pp-danger,.pp-syncbtn-send:not(:disabled){color:#fff;background:#b4342a;border-color:#b4342a;font-weight:600}
.pp-danger:hover:not(:disabled),.pp-syncbtn-send:hover:not(:disabled){background:#9e2c23;border-color:#9e2c23}
.pp-segbtn:focus-visible,.pp-syncbtn:focus-visible,.pp-publishbtn:focus-visible,.pp-primary:focus-visible,
.pp-danger:focus-visible,.pp-linkbtn:focus-visible,.pp-morebtn:focus-visible{outline:2px solid #2f6fd6;outline-offset:2px}
.pp-segbtn:disabled,.pp-syncbtn:disabled,.pp-publishbtn:disabled,.pp-primary:disabled,.pp-danger:disabled{
  opacity:.45;cursor:default}
/* Working: stays at full strength, so it reads as progress, not as off. */
[aria-busy=true].pp-segbtn,[aria-busy=true].pp-syncbtn,[aria-busy=true].pp-primary,[aria-busy=true].pp-danger{
  opacity:1;cursor:progress;
  background-image:repeating-linear-gradient(-45deg,rgba(255,255,255,.16) 0 8px,transparent 8px 16px);
  background-size:23px 23px;animation:pp-btn-stripes .7s linear infinite}
[aria-busy=true].pp-segbtn,[aria-busy=true].pp-syncbtn{
  background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,.05) 0 8px,transparent 8px 16px)}
[aria-busy=true].pp-segbtn::before,[aria-busy=true].pp-syncbtn::before,
[aria-busy=true].pp-primary::before,[aria-busy=true].pp-danger::before{
  content:"";flex:none;width:10px;height:10px;border-radius:50%;
  border:2px solid currentColor;border-right-color:transparent;animation:pp-btn-spin .8s linear infinite}
/* The fill: how much of the work is done, behind the label. */
.pp-btn-progress::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--pp-progress,0%);
  background:rgba(255,255,255,.28);transition:width .4s ease;pointer-events:none}
/* The Chat button: how the chat put away is doing. Working is aria-busy
   (above); stopped on a question is amber, finished out of sight is green. */
.pp-chatbtn[aria-busy=true][aria-pressed=false]{color:#2f6fd6;border-color:#2f6fd6;font-weight:600}
.pp-chatbtn.pp-chat-wait::before,.pp-chatbtn.pp-chat-done::before{
  content:"";flex:none;width:8px;height:8px;border-radius:50%;background:currentColor}
.pp-chatbtn.pp-chat-wait,.pp-chatbtn.pp-chat-wait[aria-pressed=false]{color:#a5561f;border-color:#a5561f;font-weight:600}
.pp-chatbtn.pp-chat-wait::before{animation:pp-step-pulse 1.1s ease-in-out infinite}
.pp-chatbtn.pp-chat-done,.pp-chatbtn.pp-chat-done[aria-pressed=false]{color:#2f7a3e;border-color:#2f7a3e;font-weight:600}
@keyframes pp-btn-stripes{to{background-position:23px 0}}
@keyframes pp-btn-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){[aria-busy=true]{animation:none!important}
  [aria-busy=true]::before{animation:none!important}}
a.pp-segbtn{display:inline-flex}
/* A press that goes to the chat rather than changing a record. The same glyph
   server/page.js puts on [data-ask] in the frames, so it means one thing everywhere. */
.pp-chat::after{content:"\\2726";margin-left:.35em;font-size:.85em;opacity:.75}
/* The repository name, typed when the assessment does not record one. Sized to
   owner/name and no wider: it sits in a row of buttons, and a field that
   stretched would read as the subject of the strip rather than a gap in it. */
.pp-input{font:inherit;font-size:11px;padding:2px 8px;border-radius:20px;width:18ch;
  background:0 0;color:var(--dsw-alias-label-primary,#111);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
/* Names, while they are showing. The one control in the pane that changes what
   is safe to have on a projector, so it does not look like the others while it
   is engaged. */
.pp-segbtn-warn[aria-pressed=true]{color:#a5561f;border-color:#a5561f;
  background:rgba(165,86,31,.10)}
.pp-approve{flex:none;padding:8px 12px 0}
.pp-approverow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pp-as{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
/* The writing button is the only red thing in the pane, and it is red only
   once a preview has been read. */
/* Behind: something decided here that has not gone out. Amber, the colour the
   Scans bar gives a step that is yours. */
.pp-behind{font-size:12px;color:#a15c00}
/* The two strips over the Gradebook: cards with a header, one row per thing. */
.pp-bookcard{flex:0 0 auto;overflow:auto;margin:10px 14px 0;padding:0 0 4px;border-radius:10px;
  font-size:11.5px;line-height:1.45;background:var(--dsw-alias-bg-l1,#fff);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);box-shadow:0 1px 2px rgba(0,0,0,.04);container-type:inline-size}
.pp-cardhead{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:8px 12px;
  background:inherit;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cardhead b{font-weight:600;font-size:12px;flex:1;min-width:0}
.pp-bookstatus{max-height:38%}
/* Where the Canvas figures come from: checking, checked when, or unreachable. */
.pp-checkstate{display:inline-flex;align-items:center;gap:6px;font-size:11px;white-space:nowrap;
  color:var(--dsw-alias-label-tertiary,#8a8a8f)}
.pp-checkstate-off{color:#a15c00}
.pp-checkspin{width:9px;height:9px;border-radius:50%;border:1.5px solid currentColor;border-right-color:transparent;
  animation:pp-btn-spin .8s linear infinite}
/* A press that is only a glyph: square, the same height as every other. */
.pp-iconbtn{width:26px;padding:0;font-size:13px}
.pp-bookrow{display:grid;grid-template-columns:minmax(0,1fr) 120px auto;gap:12px;align-items:center;
  padding:6px 12px;border-top:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.05))}
.pp-cardhead + .pp-bookrow{border-top:0}
.pp-bookrow:hover{background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-titletag{display:flex;align-items:center;gap:6px;min-width:0}
.pp-titletext{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-bookrow .pp-titletext{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-tag{flex:none;font-size:10px;font-weight:700;letter-spacing:.02em;padding:1px 6px;border-radius:5px;
  background:rgba(47,98,168,.12);color:#2f62a8;white-space:nowrap}
.pp-tag-quiz{background:rgba(124,77,182,.12);color:#6d43a8}
.pp-bookprogress{display:flex;align-items:center;gap:7px}
.pp-bar{flex:1;display:flex;height:6px;border-radius:3px;overflow:hidden;
  background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-bar i{display:block;height:100%}
.pp-bar-done{background:#2e7d4f}
.pp-bar-part{background:rgba(46,125,79,.4)}
.pp-booknum{font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#555);min-width:4.5ch;text-align:right}
.pp-bookcanvas{display:flex;align-items:center;justify-content:flex-end;gap:6px}
/* A Send… open under its row: the preview, then the red press. */
.pp-bookstatus-open{max-height:75%}
.pp-bookrow-open{background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-bookdrawer{padding:8px 12px 12px;background:var(--dsw-alias-fill-secondary,#f7f7f9);
  border-top:1px dashed var(--dsw-alias-border-l2,#e3e3e6)}
.pp-bookdrawer .pp-approverow{gap:8px}
.pp-plan{margin:6px 0 0}
.pp-plansum{margin:4px 0 6px;font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-plantable{width:100%;border-collapse:collapse;font-size:11.5px;background:var(--dsw-alias-bg-l1,#fff);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:8px;overflow:hidden}
.pp-plantable th{text-align:left;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);padding:5px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-plantable td{padding:4px 10px;border-top:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.05))}
.pp-plantable .pp-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pp-plantable td:last-child{text-align:right}
.pp-planwho{max-width:0;width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
/* A Canvas send as three steps — check, send, in Canvas — each done (green
   tick), working (pulsing), the one you are on (outlined) or ahead (grey). */
.pp-sendflow{display:flex;flex-direction:column;gap:8px}
.pp-sendsteps{display:flex;align-items:center;list-style:none;margin:0;padding:0;font-size:11px;
  color:var(--dsw-alias-label-tertiary,#8a8a8f)}
.pp-sendstep{display:flex;align-items:center;gap:6px;flex:none}
.pp-sendstep + .pp-sendstep::before{content:"";width:28px;height:2px;margin:0 8px;border-radius:1px;
  background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-sendstep-done + .pp-sendstep::before{background:#2e7d4f}
.pp-sendstepdot{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  font-size:10.5px;font-weight:700;box-sizing:border-box;border:1.5px solid var(--dsw-alias-border-l3,#d2d2d7);
  background:var(--dsw-alias-bg-l1,#fff)}
.pp-sendstep-done{color:#2e7d4f}
.pp-sendstep-done .pp-sendstepdot{color:#fff;background:#2e7d4f;border-color:#2e7d4f}
.pp-sendstep-now,.pp-sendstep-busy{color:var(--dsw-alias-label-primary,#1d1d1f);font-weight:600}
.pp-sendstep-now .pp-sendstepdot{border-color:var(--dsw-alias-label-primary,#1d1d1f)}
.pp-sendstep-busy .pp-sendstepdot{border-color:#2f6fd6;color:#2f6fd6;animation:pp-step-pulse 1.1s ease-in-out infinite}
.pp-sendstep-warn{color:#a15c00;font-weight:600}
.pp-sendstep-warn .pp-sendstepdot{color:#fff;background:#a15c00;border-color:#a15c00}
.pp-sendstep-fail{color:#b4342a;font-weight:600}
.pp-sendstep-fail .pp-sendstepdot{color:#fff;background:#b4342a;border-color:#b4342a}
@keyframes pp-step-pulse{0%,100%{box-shadow:0 0 0 0 rgba(47,111,214,.35)}50%{box-shadow:0 0 0 5px rgba(47,111,214,0)}}
@media (prefers-reduced-motion:reduce){.pp-sendstep-busy .pp-sendstepdot{animation:none}}
.pp-sendheadline{margin:0;font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary,#1d1d1f)}
/* Files: where the private material is, totals as tiles, a table per kind. */
.pp-files{display:flex;flex-direction:column;gap:14px;font-size:12px}
.pp-fileswhere{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-fileswheretext{flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px}
.pp-fileswheretext b{font-weight:600}
.pp-fileswheretext code{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-secondary,#555)}
.pp-filetiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.pp-filetile{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-filetile b{font-size:15px;font-weight:600}
.pp-filetilehead{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-filetile-wait{border-color:rgba(161,92,0,.4);background:rgba(161,92,0,.06)}
.pp-filetile-wait b{color:#a15c00}
.pp-filesection h3{margin:0 0 6px;font-size:12.5px;font-weight:600}
.pp-filetable td{vertical-align:middle}
.pp-filetable td:first-child{max-width:0;width:30%}
.pp-pileprog{display:flex;align-items:center;gap:10px}
.pp-pileprog .pp-pilebar{width:70px}
.pp-pileprog .pp-pilebar i{height:6px;border-radius:3px}
.pp-pileprogtext{display:flex;flex-direction:column;min-width:0;line-height:1.3}
.pp-pileprogstep{font-weight:600;white-space:nowrap}
.pp-filewait td{background:rgba(161,92,0,.05)}
.pp-fileacts{display:flex;gap:6px;justify-content:flex-end}
/* What a send did: green landed, amber still processing, red failed. */
.pp-sendresult{margin:8px 0;padding:9px 11px;border-radius:8px;font-size:11.5px;line-height:1.45;
  border:1px solid rgba(46,125,79,.35);background:rgba(46,125,79,.08)}
.pp-sendresult-wait{border-color:rgba(161,92,0,.4);background:rgba(161,92,0,.08)}
.pp-sendresult-fail{border-color:rgba(180,52,42,.4);background:rgba(180,52,42,.07)}
.pp-sendresulthead{display:flex;align-items:center;gap:8px}
.pp-sendresulthead b{flex:1;font-size:12.5px;color:var(--dsw-alias-label-primary,#111)}
.pp-sendresulticon{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  font-weight:700;color:#fff;background:#2e7d4f}
.pp-sendresult-wait .pp-sendresulticon{background:#a15c00}
.pp-sendresult-fail .pp-sendresulticon{background:#b4342a}
.pp-sendresult ul{list-style:none;margin:6px 0 4px 28px;padding:0}
.pp-sendresult li{display:flex;gap:8px;margin:2px 0}
.pp-sendresult li.pp-sendresult-fail{color:#b4342a}
.pp-sendresult li.pp-sendresult-wait{color:#a15c00}
.pp-sendcourse{flex:none;min-width:9em;font-weight:600}
.pp-sendresult .pp-plannotes{margin:4px 0 0 28px}
.pp-plannotes{margin:0 0 6px;font-size:11px}
.pp-plannotes summary{cursor:pointer;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-plannotes p{margin:3px 0 0 12px}
.pp-planquiet td{color:var(--dsw-alias-label-tertiary,#8a8a8a)}
/* A narrow pane: the Canvas chip and its press go under the title. */
@container (max-width:560px){.pp-bookrow{grid-template-columns:minmax(0,1fr) 110px}
  .pp-bookcanvas{grid-column:1 / -1;justify-content:flex-start}}
/* What the grade sheet brought in: a notice over every tab until seen, and the
   last runs above the Gradebook. Green, the colour of a thing that arrived. */
.pp-sheetnotice{flex:none;display:flex;align-items:center;gap:8px;margin:8px 14px 0;padding:7px 9px;
  border-radius:8px;font-size:11.5px;line-height:1.45;border:1px solid rgba(46,125,79,.35);
  background:rgba(46,125,79,.08);color:var(--dsw-alias-label-secondary,#3a3a3a)}
.pp-sheetnotice b{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
/* Changed in Google, not yet in: amber, the colour of a step that is yours. */
.pp-sheetnotice-changed{border-color:rgba(161,92,0,.4);background:rgba(161,92,0,.08)}
.pp-sheetnoticetext{flex:1;min-width:0}
.pp-recentmarks{max-height:34%}
/* Each sync a step on a timeline: a dot on a rail, green when marks came in. */
.pp-recentrun{position:relative;padding:8px 12px 6px 30px}
.pp-recentrun::before{content:"";position:absolute;left:15px;top:0;bottom:0;width:2px;
  background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cardhead + .pp-recentrun::before{top:14px}
.pp-recentrun:last-child::before{bottom:calc(100% - 16px)}
.pp-recentrun::after{content:"";position:absolute;left:11px;top:11px;width:10px;height:10px;border-radius:50%;
  background:#2e7d4f;box-shadow:0 0 0 3px var(--dsw-alias-bg-l1,#fff)}
.pp-recentquiet::after{background:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-recentwhen{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pp-recentwhen > span:first-child{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-recentlist{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:2px}
.pp-recentlist li{display:grid;grid-template-columns:22px minmax(0,13em) minmax(0,1fr) auto;gap:8px;align-items:center;
  padding:3px 6px;margin:0 -6px;border-radius:6px}
.pp-recentlist li:hover{background:var(--dsw-alias-fill-secondary,#f5f5f7)}
.pp-recentlist .pp-titletext{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-recentwho{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.pp-recentmark{font-variant-numeric:tabular-nums;color:#2e7d4f;font-weight:600}
.pp-recentrun > .pp-as{display:block;margin:2px 0 0 36px}
@container (max-width:560px){.pp-recentlist li{grid-template-columns:22px minmax(0,1fr) auto}
  .pp-recentlist .pp-titletag{grid-column:2 / -1;grid-row:2}}
.pp-linkask{margin:8px 0;padding:8px 10px;border-left:3px solid #a15c00}
.pp-linkask p{margin:0 0 6px}
.pp-approveout{margin:8px 0 0;padding:8px 10px;max-height:180px;overflow:auto;
  white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.5;
  border-radius:6px;background:var(--dsw-alias-fill-secondary,#f5f5f7);
  color:var(--dsw-alias-label-secondary,#3a3a3a)}
.pp-approveerr{color:#b4342a}
.pp-body{flex:1;min-height:0;display:flex;flex-direction:column}
/* Scans: the piles as a list, each saying where it is; the chosen pile's one
   step to work on, as a headline with its single action; the seven steps as a
   row of dots; and the chosen step's detail and tools under it. Overview
   first, the step that matters next, the rest on demand. */
.pp-piles{display:flex;flex-direction:column;gap:5px;margin:0 0 12px}
.pp-pile{display:flex;align-items:center;gap:9px;width:100%;text-align:left;font:inherit;cursor:pointer;
  padding:7px 9px;border-radius:8px;color:inherit;background:0 0;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-pile[aria-current=true]{border-color:var(--dsw-alias-label-primary,#111)}
.pp-pilename{flex:1;min-width:0}
.pp-pilename b{display:block;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-pilename span{display:block;font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-pilebar{display:flex;gap:2px;width:56px;flex:none}
.pp-pilebar i{flex:1;height:4px;border-radius:2px;background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-pilebar i.pp-s-done{background:#2e7d4f}
.pp-pilebar i.pp-s-now{background:#a5561f}
.pp-whose{flex:none;font-size:10.5px;padding:1px 7px;border-radius:20px;white-space:nowrap}
.pp-whose-you{color:#a5561f;background:rgba(165,86,31,.1)}
.pp-whose-assistant{color:#5b4bb7;background:rgba(91,75,183,.1)}
.pp-whose-done{color:#2e7d4f;background:rgba(46,125,79,.1)}
.pp-now{border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:10px;padding:10px 12px;margin:0 0 12px}
.pp-nowkick{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-now h3{margin:3px 0 3px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-now p{margin:0 0 9px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#555)}
.pp-stepper{display:flex;justify-content:space-between;margin:0 0 4px}
.pp-stepbtn{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px 0;
  font:inherit;cursor:pointer;background:0 0;border:0;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-stepbtn span{font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pp-stepbtn[aria-pressed=true] span{color:var(--dsw-alias-label-primary,#111);font-weight:600}
.pp-dot{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:10px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#cfcfd4)}
.pp-dot-done{background:#2e7d4f;border-color:#2e7d4f;color:#fff}
.pp-dot-now{border:2px solid #a5561f;color:#a5561f;font-weight:600}
.pp-dot-yours{border-color:#a5561f;color:#a5561f}
.pp-stepbtn[aria-pressed=true] .pp-dot{box-shadow:0 0 0 2px var(--dsw-alias-fill-secondary,#ececf0)}
.pp-stepdetail{margin:6px 0 0;padding:9px 10px;border-radius:8px;font-size:12px;line-height:1.5;
  background:var(--dsw-alias-fill-secondary,#f5f5f7)}
.pp-stepdetail > b{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-lane{display:flex;align-items:baseline;gap:6px;margin:14px 0 6px;font-size:11px;
  letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-lane span{text-transform:none;letter-spacing:0}
.pp-card{border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:8px;padding:8px 9px;
  margin:0 0 6px;font-size:12px;line-height:1.45;outline:0}
.pp-card:focus,.pp-card.pp-focus{border-color:var(--dsw-alias-label-primary,#111)}
.pp-crop{display:block;width:100%;height:auto;border-radius:4px;margin:0 0 6px;background:#fff}
.pp-cardmeta{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b);word-break:break-word}
.pp-clash{display:flex;gap:10px;margin:6px 0;flex-wrap:wrap}
.pp-clash figure{margin:0;flex:1 1 140px;min-width:0}
.pp-clashpages{display:flex;gap:3px}
.pp-clashpages img{flex:1 1 0;min-width:0;height:auto;border-radius:3px;background:#fff;border:1px solid var(--dsw-alias-border-secondary,#ddd)}
.pp-clash figcaption{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b);margin-top:2px}
.pp-written{font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:11.5px}
.pp-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center}
.pp-actions select{font:inherit;font-size:11px;max-width:100%;padding:2px 4px;border-radius:6px;
  color:inherit;background:0 0;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
/* Match's desk (client/scans.js): the pile in one bar, a list of the papers
   that need a person, and the chosen paper with the class ranked beside it.
   Green placed, blue a weak match to check, amber held. */
.pp-msum{margin:8px 0 6px}
.pp-mbar{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;background:var(--dsw-alias-fill-secondary,#ececf0)}
.pp-mbar i{display:block;height:100%}
.pp-mbar-placed,.pp-mdot-placed{background:#2f7d4f}
.pp-mbar-check,.pp-mdot-check{background:#3b6fb6}
.pp-mbar-held,.pp-mdot-held{background:#a5561f}
.pp-mkey{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#555)}
.pp-mkey span{display:inline-flex;align-items:center;gap:5px}
.pp-mdot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}
.pp-desk{display:grid;grid-template-columns:minmax(190px,36%) minmax(0,1fr);gap:12px;margin-top:10px;align-items:start}
@media (max-width:620px){.pp-desk{grid-template-columns:1fr}}
.pp-mside{min-width:0;position:sticky;top:0}
.pp-mfilter{display:flex;gap:4px;margin:0 0 6px;flex-wrap:wrap}
.pp-mlist{max-height:min(58vh,520px);overflow:auto;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:8px}
.pp-mrow{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 9px;border:0;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:0 0;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.pp-mrow:last-child{border-bottom:0}
.pp-mrow:hover{background:var(--dsw-alias-fill-secondary,#f5f5f7)}
.pp-mrow-on,.pp-mrow-on:hover{background:var(--dsw-alias-fill-secondary,#ececf0);box-shadow:inset 3px 0 0 var(--dsw-alias-label-primary,#111)}
.pp-mrowmain{flex:1;min-width:0;display:flex;flex-direction:column}
.pp-mrowmain b,.pp-mrowmain span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-mrowmain b{font-weight:600;font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:11.5px}
.pp-mrowmain span{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-mempty{padding:10px}
.pp-mkeys{margin-top:5px}
.pp-qchip{flex:none;font-size:10.5px;padding:1px 7px;border-radius:9px;color:#3b6fb6;border:1px solid currentColor}
.pp-mdetail{min-width:0;font-size:12px;line-height:1.45}
.pp-mhead{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:0 0 2px}
.pp-mlabel{margin:10px 0 4px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-ranked{list-style:none;padding:0;margin:0 0 8px}
.pp-rankrow{display:grid;grid-template-columns:16px minmax(0,1fr) 64px auto;align-items:center;gap:8px;width:100%;text-align:left;
  padding:5px 8px;margin:0 0 3px;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:6px;
  background:0 0;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.pp-rankrow:hover:not(:disabled){border-color:var(--dsw-alias-label-primary,#111)}
.pp-rankrow:disabled{opacity:.55;cursor:default}
.pp-rankrow-now{border-color:#3b6fb6}
.pp-ranknum{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b);text-align:center}
.pp-rankname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-near{display:block;height:6px;border-radius:3px;overflow:hidden;background:var(--dsw-alias-fill-secondary,#ececf0)}
.pp-near i{display:block;height:100%}
.pp-near-close i{background:#2f7d4f}
.pp-near-possible i{background:#a5561f}
.pp-near-far i{background:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-as-warn{color:#a5561f}
.pp-msearch{display:block;width:100%;box-sizing:border-box;margin:4px 0 6px;padding:6px 9px;border-radius:6px;font:inherit;font-size:12px;
  color:inherit;background:0 0;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-msearch:focus{outline:0;border-color:var(--dsw-alias-label-primary,#111)}
.pp-nopaper summary{margin:4px 0}
.pp-chips{display:flex;flex-wrap:wrap;gap:4px}
.pp-folded{font-size:11.5px;color:var(--dsw-alias-label-secondary,#555)}
.pp-folded summary{cursor:pointer;margin:12px 0 4px}
.pp-folded li{margin:1px 0}
.pp-next{margin:0 0 10px;padding:7px 9px;border-radius:6px;font-size:11.5px;line-height:1.45;
  background:var(--dsw-alias-fill-secondary,#f5f5f7)}
.pp-frame{flex:1;min-height:0;width:100%;border:0;display:block}
.pp-scroll{flex:1;min-height:0;overflow:auto;padding:12px 14px 32px}
.pp-prefwrap{flex:1;min-height:0;display:flex;flex-direction:column}
.pp-banner{flex:none;font-size:11px;line-height:1.45;padding:6px 12px 7px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  color:var(--dsw-alias-label-secondary,#555);
  background:var(--dsw-alias-fill-l2,rgba(124,58,237,.08))}
.pp-banner b{font-weight:600}
.pp-banner .pp-issues{display:block;margin-top:3px;
  font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:10.5px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);word-break:break-word}
.pp-msg{margin:12px 14px;font-size:12px;line-height:1.5;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-msg code{font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:11.5px}
.pp-err{border-left:3px solid var(--dsw-alias-label-tertiary,#b45309);padding-left:9px;
  color:var(--dsw-alias-label-secondary,#444)}
.pp-layer{margin:0 0 14px}
.pp-layername{font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);margin:0 0 3px}
.pp-layerpath{font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:10.5px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);margin:0 0 5px;word-break:break-all}
.pp-absent{font-size:11.5px;font-style:italic;color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-pref{display:flex;gap:8px;font-size:12px;padding:2px 0;align-items:baseline}
.pp-prefkey{flex:1;min-width:0;font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);
  font-size:11px;color:var(--dsw-alias-label-secondary,#444);word-break:break-all}
.pp-prefval{flex:none;max-width:52%;text-align:right;word-break:break-word}
/* The editor. One row per setting: what it is called, what it inherits, and the
   control that overrides it at the layer the picker has selected. */
.pp-prefgroup{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;margin:14px 0 4px;
  color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-prefrow{display:flex;gap:8px;align-items:center;padding:3px 0;font-size:12px}
.pp-preflabel{flex:1;min-width:0}
.pp-prefinherit{display:block;font-size:10.5px;
  color:var(--dsw-alias-label-tertiary,#9a9a9a);word-break:break-word}
.pp-prefctl{flex:none;width:40%;max-width:170px;font:inherit;font-size:11.5px;padding:2px 4px;
  border-radius:4px;background:0 0;color:var(--dsw-alias-label-primary,#111);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
/* A control holding a value of its own, against one that is only inheriting.
   Without this the form reads as twenty-five settings the professor has made,
   when in a fresh workspace they have made none. */
.pp-prefctl.pp-set{border-color:var(--dsw-alias-label-primary,#111);font-weight:600}
/* Integrations. One row per fact: what it is called, where it is read from,
   and what it is set to — with the missing state the only colour on the tab,
   because "this is not wired up" is the answer the professor came for. */
.pp-fact{display:flex;gap:10px;align-items:baseline;padding:4px 0;font-size:12px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-fact:last-of-type{border-bottom:none}
.pp-factkey{flex:1;min-width:0;overflow-wrap:anywhere}
.pp-factnote{display:block;font-size:10.5px;
  color:var(--dsw-alias-label-tertiary,#9a9a9a);overflow-wrap:anywhere}
.pp-factval{flex:none;max-width:46%;text-align:right;overflow-wrap:anywhere;
  font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:11px}
.pp-factmissing{color:#a5561f}
.pp-factgroup{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 4px;
  color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-yes{color:var(--dsw-alias-label-secondary,#3a3a3a)}
.pp-no{color:#a5561f}
/* One tickable Canvas section, and the subgroup it feeds. */
.pp-pick{display:flex;gap:8px;align-items:baseline;padding:4px 0;font-size:12px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-pickbox{flex:none;margin:2px 0 0}
.pp-picklabel{flex:1;min-width:0;overflow-wrap:anywhere}
.pp-picksel{flex:none;width:auto;max-width:44%}
/* The Fetch row sits ABOVE the list it fills, so its rule belongs on the
   bottom rather than the top the save row draws. */
.pp-saverow-top{border-top:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  margin:0 0 8px;padding:0 0 10px}
.pp-saverow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:14px 0 0;
  border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);margin:14px 0 0}
.pp-savenote{font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-saveerr{font-size:11px;color:#b4342a}
/* One credential field: the variable's name, a masked box, and a button.

   The input is type=password, so the browser's own masking is what hides it. Nothing here has an eye toggle: a
   reveal control on a pane that gets projected is a control somebody presses
   by accident during a lecture. */
.pp-secret{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:5px 0}
.pp-secretname{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.pp-secretbox{flex:1;min-width:120px;font-size:12px;padding:3px 6px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:4px;
  background:var(--dsw-alias-bg-l1,#fff);color:inherit}
.pp-secretbox:disabled{opacity:.55}
/* The setup form: a stack of labelled fields rather than the one-line rows
   above, because a host and a token are entered together and a professor
   reads them as one thing to fill in. */
.pp-setup{display:flex;flex-direction:column;gap:8px;padding:10px 0 4px}
.pp-field{display:flex;flex-direction:column;gap:3px}
.pp-fieldlabel{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-fieldbox{font-size:12px;padding:4px 6px;border-radius:4px;color:inherit;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  background:var(--dsw-alias-bg-l1,#fff)}
.pp-ok{font-size:11px;color:#2f6b3c}
/* One subgroup and the Canvas course it is bound to. */
.pp-bind{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-bindname{flex:none;min-width:64px;font-weight:600}
.pp-bindsel{flex:1;min-width:0;max-width:62%}
/* One integration, its state, and the way to fix it. */
.pp-int{padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-inthead{display:flex;gap:8px;align-items:baseline}
.pp-intname{flex:1;font-weight:600;font-size:12.5px}
.pp-intwhat{font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a);
  display:block;margin:1px 0 0}
.pp-state{flex:none;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;
  padding:1px 7px;border-radius:20px;border:1px solid currentColor}
.pp-state-ready{color:#2f6b3c}
.pp-state-partial{color:#a5561f}
.pp-state-absent{color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-steps{list-style:none;margin:6px 0 0;padding:0}
.pp-step{font-size:11.5px;padding:1px 0;display:flex;gap:6px;align-items:baseline}
.pp-stepmark{flex:none;width:12px}
.pp-step-done{color:var(--dsw-alias-label-secondary,#3a3a3a)}
.pp-step-todo{color:#a5561f}
.pp-stephint{color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-ask{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b);
  padding:5px 12px 6px;flex:none;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
/* The material overlay: a deck or an exam paper, over the whole harness.

   Fixed to the viewport and portalled to document.body, so neither the
   column's width nor its overflow:auto clips it. The z-index is 4000 against
   a harness whose own highest layer is 1100; it is a round number above the
   ceiling rather than a maximum, so a future DSH dialog can still be put over
   this one deliberately.

   The pane is 320-odd pixels wide and a lecture slide is 4:3. Nothing about
   reading one belongs in a column, which is the whole reason this exists. */
.pp-veil{position:fixed;inset:0;z-index:4000;display:flex;flex-direction:column;
  padding:24px clamp(16px,4vw,64px) 28px;background:rgba(15,16,18,.55)}
.pp-modal{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;
  border-radius:10px;background:var(--dsw-alias-bg-l1,#fff);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  box-shadow:0 18px 60px rgba(0,0,0,.35)}
.pp-modalhead{flex:none;display:flex;gap:10px;align-items:center;padding:8px 10px 8px 12px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-modaltitle{flex:1;min-width:0;font-size:12.5px;font-weight:600;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  color:var(--dsw-alias-label-primary,#111)}
/* The way out for a format the browser will not paint. A .pptx reaches the
   frame as a download prompt or as nothing at all, and the professor should
   not have to guess that a blank panel means "open it elsewhere". */
.pp-modallink{flex:none;font-size:11px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
/* The same seat serves a link and a button — "open in a tab" and "ask about
   this" are one row of quiet affordances — so the button is stripped back to
   the anchor's own appearance rather than given a second style to drift. */
button.pp-modallink{cursor:pointer;font-family:inherit;background:none;border:0;padding:0}
button.pp-modallink:hover{color:var(--dsw-alias-label-primary,#1a1a1a)}
.pp-modalframe{flex:1;min-height:0;width:100%;border:0;display:block;background:#fff}
/* An exam with versions: one tab per version, and a side-by-side view, which
   is how anyone checks that two versions ask different questions rather than
   the same one reworded. Two frames share the body; on a narrow screen they
   stack, because two half-width PDFs at 360px are two unreadable ones. */
.pp-modaltabs{flex:none;display:flex;gap:4px;align-items:center}
.pp-modaltab{cursor:pointer;font:inherit;font-size:11.5px;padding:3px 9px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:none;
  color:var(--dsw-alias-label-secondary,#444)}
.pp-modaltab[aria-pressed="true"]{background:var(--dsw-alias-label-primary,#111);
  border-color:var(--dsw-alias-label-primary,#111);color:var(--dsw-alias-bg-l1,#fff)}
.pp-modalbody{flex:1;min-height:0;display:flex;gap:1px;background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-modalpane{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-l1,#fff)}
.pp-modalpanelabel{flex:none;font-size:11px;font-weight:600;padding:4px 10px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
@media (max-width:720px){.pp-modalbody{flex-direction:column}}
/* Course mode: the place is the page, from the navigator to the window's edge.
   One layer under the material overlay (4000), because a deck opened FROM
   the term plan must land on top of it. No margin, no dimmed backdrop, no
   card: it is not a dialog over the chat but what the centre shows, and a
   sixteen-week grid or a gradebook wants every pixel. */
.pp-veil.pp-coursemode{z-index:3900;padding:0;background:var(--dsw-alias-bg-l1,#fff)}
.pp-coursemode > .pp-modal{border:0;border-radius:0;box-shadow:none}
/* With the chat beside it: a rule between the two, the chat to the right. */
.pp-coursemode.pp-beside{border-right:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
/* Too narrow for both: the place steps aside, mounted, and a pill brings it back. */
.pp-coursemode.pp-away{visibility:hidden;pointer-events:none}
/* At the top, under the chat's header: the bottom belongs to the composer. */
.pp-backpill{position:fixed;z-index:3900;right:12px;top:84px;
  min-height:32px;padding:0 16px;box-shadow:0 4px 16px rgba(0,0,0,.18)}
/* The chat strip's put-away tab, centred on the rule at its left edge (right is set inline). */
.pp-chatclose{position:fixed;z-index:3900;top:50%;margin-top:-13px;width:26px;height:26px;padding:0 0 2px;border-radius:50%;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff);color:inherit;
  font-size:16px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.pp-chatclose:hover{background:var(--dsw-alias-bg-l2,#f3f3f5)}
/* The shell's own conversation column moved into a strip at the right (see
   useChatBeside in client/materials.js): the sidebar's track, the track the
   place covers, then the chat. !important because AppFrame writes its widths
   inline; the attribute comes off as soon as the chat is put away. */
[data-pp-split]{grid-template-columns:var(--pp-side,280px) minmax(0,1fr) var(--pp-chat,440px)!important}
[data-pp-split] > [data-pp-col=centre]{grid-column:3!important;grid-row:1!important;min-width:0}
[data-pp-split] > [data-pp-col=details]{grid-column:2!important;grid-row:1!important;visibility:hidden}
[data-pp-split] > [data-pp-col=handle]{display:none!important}
.pp-coursebody{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
/* The weeks' own stacking: their sticky strip and heads (z-index 20 and
   under) stay inside the scroller instead of drawing over a course-wide view. */
.pp-courseview{isolation:isolate}
/* A course-wide view (Students, Gradebook, Tasks) over the weeks, which
   stay mounted beneath so they come back where they were left. */
.pp-cview{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;background:var(--dsw-alias-bg-l1,#fff)}
.pp-cviewbar{flex:none;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;padding:8px 10px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cviewbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
/* The readings of the weeks, then the course read another way. */
.pp-segsep{flex:none;align-self:stretch;width:1px;margin:2px 4px;background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-coursehead .pp-segbtn[disabled]{opacity:.45;cursor:not-allowed}
/* Canvas in one line; a press jumps to Integrations in the pane. */
.pp-wiring{flex:none;font:inherit;font-size:11px;cursor:pointer;background:none;border:0;padding:2px 4px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);text-decoration:underline;text-underline-offset:2px}
.pp-wiring-absent,.pp-wiring-partial{color:#a4362f}
/* Connections in the header (connections-menu.js): a mark per service, then
   the worst of them in words; pressed, a panel of each with its syncs. */
.pp-conn{position:relative;flex:none}
.pp-connbtn{display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:11px;cursor:pointer;
  padding:2px 7px 2px 4px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  background:var(--dsw-alias-bg-l1,#fff);color:var(--dsw-alias-label-secondary,#555)}
.pp-connbtn[disabled]{opacity:.45;cursor:not-allowed}
.pp-connbtn.pp-conn-bad{color:#a4362f;border-color:rgba(180,52,42,.35)}
.pp-connbtn.pp-conn-warn{color:#a5561f;border-color:rgba(165,86,31,.35)}
.pp-conndot{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;
  font-size:8.5px;font-weight:700;background:rgba(47,138,78,.13);color:#2f8a4e}
.pp-conndot.pp-conn-warn{background:rgba(165,86,31,.14);color:#a5561f}
.pp-conndot.pp-conn-bad{background:rgba(180,52,42,.14);color:#b4342a}
.pp-connlabel{margin-left:2px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-connchev{font-size:9px;opacity:.7}
.pp-connpanel{position:fixed;z-index:4100;max-height:min(70vh,640px);overflow:auto;padding:6px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff);
  box-shadow:0 10px 30px rgba(0,0,0,.14)}
.pp-connrow{padding:8px 8px 10px;border-radius:9px}
.pp-connrow+.pp-connrow{border-top:1px solid var(--dsw-alias-border-l2,#ececef)}
.pp-connhead{display:flex;align-items:center;gap:8px}
.pp-connname{display:flex;flex-direction:column;font-size:12.5px;font-weight:600;line-height:1.25}
.pp-connstate{font-size:11px;font-weight:500;color:#2f8a4e}
.pp-conn-warn .pp-connstate{color:#a5561f}
.pp-conn-bad .pp-connstate{color:#b4342a}
.pp-connline{margin:4px 0 0 30px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-connsync{margin:8px 0 0 30px}
.pp-connsync .pp-synccard{margin-top:2px}
.pp-coursebody .pp-frame{background:transparent}
.pp-coursehead{flex-wrap:wrap}
/* The chat's text field at the foot of an open place (CourseComposer in materials.js). */
.pp-composer{flex:none;display:flex;align-items:flex-end;gap:8px;margin:8px 16px 12px;padding:8px 8px 8px 14px;border:1px solid var(--dsw-alias-border-l2,#dadce0);border-radius:16px;background:var(--dsw-alias-bg-l1,#fff);box-shadow:0 2px 10px rgba(0,0,0,.06)}
.pp-composer:focus-within{border-color:#2f8a4e}
.pp-composer textarea{flex:1;min-width:0;border:0;outline:0;resize:none;background:transparent;color:inherit;font:inherit;font-size:13.5px;line-height:1.45;padding:5px 0;max-height:33vh}
.pp-composersend{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:#2f8a4e;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
.pp-composersend:disabled{opacity:.35;cursor:default}
/* The run picker's look, at a header's size: one control among the buttons. */
.pp-coursehead .pp-modaltitle{flex:none;max-width:240px;margin-right:6px}
.pp-coursehead label{display:inline-flex;gap:5px;align-items:center;font-size:11px;
  color:var(--dsw-alias-label-secondary,#555);cursor:pointer}
/* The publish dialog's body. Unlike the material modal there is no frame to
   fill, so the plan scrolls and the controls stay put above it. */
.pp-publishbody{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;
  padding:12px;overflow:hidden}
.pp-publishout{flex:1;min-height:0;margin:0;overflow:auto;white-space:pre-wrap;
  word-break:break-word;font-size:11.5px;line-height:1.5;padding:10px;border-radius:6px;
  background:var(--dsw-alias-bg-l2,#f6f6f7);color:var(--dsw-alias-label-primary,#1a1a1a)}
.pp-publishhint{margin:0;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
/* The upload dialog: a drop box, the files, a note. Not the full-height sheet the
   publish dialog is — there is no long plan to read — so it sizes to content. */
.pp-uploadmodal{flex:none;max-height:100%;width:min(640px,100%);margin:auto}
/* The match review: every name the pile was matched on, as big cards, so a
   class's worth can be read at a glance and confirmed in one press. A card is
   a toggle — pressed means "not them" for a match, "yes" for a suggestion. */
.pp-review{flex:1;min-height:0;overflow:auto;padding:12px 14px 18px}
.pp-reviewsec{display:flex;align-items:baseline;gap:8px;margin:14px 0 8px;font-size:12px;font-weight:600}
.pp-reviewsec:first-child{margin-top:0}
.pp-reviewsec span{font-weight:400;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-reviewgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
.pp-rcard{display:flex;flex-direction:column;gap:5px;text-align:left;font:inherit;cursor:pointer;
  padding:9px 10px;border-radius:10px;background:var(--dsw-alias-bg-l1,#fff);color:inherit;
  border:2px solid #2f8a4e}
.pp-rcard:focus-visible{outline:2px solid var(--dsw-alias-label-primary,#111);outline-offset:2px}
.pp-rcard img{display:block;width:100%;height:auto;border-radius:6px;background:#fff}
.pp-rcard .pp-rwritten{font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:12px;
  color:var(--dsw-alias-label-secondary,#444)}
.pp-rcard .pp-rname{font-size:14px;font-weight:600;line-height:1.3}
.pp-rcard .pp-rid{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-rbadges{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.pp-rbadge{font-size:10.5px;padding:1px 7px;border-radius:20px;
  background:var(--dsw-alias-fill-secondary,#f0f0f2);color:var(--dsw-alias-label-secondary,#444)}
.pp-rbadge-close{background:rgba(165,86,31,.12);color:#a5561f}
.pp-rbadge-yes{background:rgba(47,138,78,.12);color:#2f8a4e;margin-left:auto}
.pp-rbadge-no{background:rgba(180,52,42,.12);color:#b4342a;margin-left:auto}
.pp-rcard-no{border-color:#b4342a}
.pp-rcard-no img,.pp-rcard-no .pp-rname{opacity:.45}
.pp-rcard-no .pp-rname{text-decoration:line-through}
.pp-rcard-off{border-color:var(--dsw-alias-border-l2,#e3e3e6);border-style:dashed}
.pp-reviewfoot{flex:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:9px 12px;
  border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-reviewfoot .pp-as{flex:1;min-width:0}
/* Syncs. Tiles say how much there is; the rows waiting for a person come
   first, each as the sheet shows it (letters across, lines down, the row lit)
   with the decision under it; then the roads, grouped by which way data runs,
   each with its service's mark. */
.pp-syncs{display:flex;flex-direction:column;gap:14px}
.pp-cviewpad{padding:16px 20px 40px;max-width:880px}
.pp-wiring-waiting{color:#a5561f;font-weight:600}
.pp-stiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:8px}
.pp-stile{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;
  background:var(--dsw-alias-fill-secondary,#f3f3f5)}
.pp-stilelabel{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-stilevalue{font-size:22px;font-weight:600;line-height:1.15;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-primary,#111)}
.pp-stilenote{font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.pp-stile-warn{background:rgba(214,130,32,.13)}
.pp-stile-warn .pp-stilevalue{color:#b4600f}
.pp-stile-ok .pp-stilevalue{color:#2f8a4e}
.pp-syncnote{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;border-radius:10px;font-size:12px;
  border:1px dashed var(--dsw-alias-border-l2,#d6d6dc);color:var(--dsw-alias-label-secondary,#555)}
.pp-syncnote > span{flex:1;min-width:180px}
.pp-syncsection{display:flex;flex-direction:column;gap:6px}
.pp-synch3{display:flex;align-items:center;gap:8px;margin:2px 0 0;font-size:13.5px;font-weight:600;
  color:var(--dsw-alias-label-primary,#111)}
.pp-count{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:20px;
  background:var(--dsw-alias-fill-secondary,#ececf0);color:var(--dsw-alias-label-secondary,#555)}
.pp-count-warn{background:rgba(214,130,32,.16);color:#b4600f}
.pp-syncgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:8px}
.pp-synccard{display:flex;flex-direction:column;gap:9px;padding:11px 12px;border-radius:12px;min-width:0;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-synccard:hover{border-color:var(--dsw-alias-border-l3,#cfcfd6)}
.pp-synctop{display:flex;gap:10px;align-items:flex-start}
.pp-svc{flex:none;width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;
  font-size:11.5px;font-weight:700;letter-spacing:.02em}
.pp-svc-small{width:22px;height:22px;border-radius:6px;font-size:9.5px}
.pp-svc-canvas{background:rgba(226,73,51,.14);color:#c23a26}
.pp-svc-sheets{background:rgba(30,142,62,.14);color:#1e7e38}
.pp-svc-telegram{background:rgba(42,161,218,.15);color:#1d84b6}
.pp-svc-github{background:rgba(60,64,72,.13);color:#3c4048}
.pp-svc-moodle,.pp-svc-file{background:rgba(214,130,32,.14);color:#b4600f}
.pp-syncmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.pp-synctitle{font-size:13px;font-weight:600;line-height:1.3;color:var(--dsw-alias-label-primary,#111);overflow-wrap:anywhere}
.pp-syncid{margin-left:6px;font-weight:400;font-size:11px;font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);
  color:var(--dsw-alias-label-tertiary,#8a8a8a)}
.pp-chips{display:flex;gap:4px;flex-wrap:wrap}
.pp-diricon{display:block;flex:none}
.pp-dir{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px}
.pp-dir-small{position:absolute;right:-5px;bottom:-5px;width:17px;height:17px;border-radius:50%;
  box-shadow:0 0 0 2px var(--dsw-alias-bg-l1,#fff)}
.pp-dir-source{background:rgba(47,98,168,.14);color:#2f62a8}
.pp-dir-target{background:rgba(47,138,78,.14);color:#2f8a4e}
.pp-dir-both{background:rgba(110,77,180,.14);color:#6e4db4}
.pp-dir-small{background-color:var(--dsw-alias-bg-l1,#fff)}
.pp-dir-small.pp-dir-source{background-image:linear-gradient(rgba(47,98,168,.18),rgba(47,98,168,.18))}
.pp-dir-small.pp-dir-target{background-image:linear-gradient(rgba(47,138,78,.18),rgba(47,138,78,.18))}
.pp-dir-small.pp-dir-both{background-image:linear-gradient(rgba(110,77,180,.18),rgba(110,77,180,.18))}
.pp-svcwrap{position:relative;flex:none;display:inline-flex}
.pp-stiledirs{display:inline-flex;gap:10px;flex-wrap:wrap}
.pp-stiledir{display:inline-flex;align-items:center;gap:3px}
.pp-stiledir-source{color:#2f62a8}
.pp-stiledir-target{color:#2f8a4e}
.pp-stiledir-both{color:#6e4db4}
.pp-synccopy{font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.pp-synccopy-none{color:#b4600f}
.pp-synclast{font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.pp-synclast::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;
  vertical-align:1px;background:#2f8a4e}
.pp-synclast-never{color:var(--dsw-alias-label-tertiary,#8a8a8a)}
.pp-synclast-never::before{background:var(--dsw-alias-border-l3,#cfcfd6)}
.pp-stilevalue{overflow-wrap:anywhere}
.pp-chip{font-size:10.5px;padding:1px 7px;border-radius:20px;white-space:nowrap;
  background:var(--dsw-alias-fill-secondary,#f0f0f2);color:var(--dsw-alias-label-secondary,#555)}
.pp-chip-warn{background:rgba(214,130,32,.15);color:#b4600f}
.pp-chip-live{background:rgba(180,52,42,.11);color:#b4342a}
.pp-syncctl{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pp-syncctl select{flex:1;min-width:0;max-width:100%;font:inherit;font-size:11.5px;padding:4px 6px;border-radius:7px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff);color:inherit}
a.pp-syncbtn,label.pp-syncbtn{text-decoration:none}
.pp-syncbtn-off{opacity:.45;pointer-events:none}
/* A downloaded sheet is dropped on its card; the outline says where it lands. */
.pp-synccard-drop{border:1px dashed #1e7e38;background:rgba(30,142,62,.06)}
.pp-synchint{margin:0;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary,#555)}
.pp-syncout{border-radius:9px;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-syncout-err{border-color:rgba(180,52,42,.45)}
.pp-syncouthead{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 4px 10px;font-size:11px;font-weight:600;
  background:var(--dsw-alias-fill-secondary,#f3f3f5);color:var(--dsw-alias-label-secondary,#555)}
.pp-syncout-err .pp-syncouthead{background:rgba(180,52,42,.09);color:#b4342a}
.pp-syncout pre{margin:0;padding:8px 10px;max-height:200px;overflow:auto;font-size:11px;line-height:1.5;white-space:pre-wrap;
  font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace)}
.pp-waitlist{display:flex;flex-direction:column;gap:10px}
.pp-waitcard{display:flex;flex-direction:column;gap:9px;padding:11px 12px;border-radius:12px;
  border:1px solid rgba(214,130,32,.35);background:var(--dsw-alias-bg-l1,#fff);box-shadow:inset 3px 0 0 rgba(214,130,32,.7)}
.pp-waithead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.pp-waitsource{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-waitwhere{font-weight:400;color:var(--dsw-alias-label-secondary,#555)}
.pp-waitopen{font-size:11.5px;color:#1e7e38;text-decoration:none;white-space:nowrap}
.pp-waitopen:hover{text-decoration:underline}
.pp-sheetwrap{overflow-x:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#dadce0)}
.pp-sheet{border-collapse:collapse;width:100%;font-size:11.5px;font-variant-numeric:tabular-nums}
.pp-sheet th,.pp-sheet td{border:1px solid var(--dsw-alias-border-l2,#e2e3e6);padding:3px 7px;height:20px;
  white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.pp-sheet thead th{font-size:10px;font-weight:500;text-align:center;color:var(--dsw-alias-label-tertiary,#80868b);
  background:var(--dsw-alias-fill-secondary,#f6f7f8)}
.pp-sheet tr > :first-child{border-left:0}
.pp-sheet tr:last-child > *{border-bottom:0}
.pp-sheet thead tr > *{border-top:0}
.pp-sheetcorner,.pp-sheetline{width:30px;min-width:30px;font-size:10px;font-weight:500;text-align:center;
  color:var(--dsw-alias-label-tertiary,#80868b);background:var(--dsw-alias-fill-secondary,#f6f7f8)}
.pp-sheethead td{font-weight:600;color:var(--dsw-alias-label-primary,#111);background:rgba(30,142,62,.05)}
.pp-sheetcell{color:var(--dsw-alias-label-secondary,#444)}
.pp-sheetmark{text-align:center;font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace)}
.pp-sheetlit td{background:rgba(214,130,32,.13);color:var(--dsw-alias-label-primary,#111)}
.pp-sheetlit .pp-sheetline{background:rgba(214,130,32,.3);color:#8a4a0c;font-weight:700}
.pp-sheetlit .pp-sheetname{font-weight:600;box-shadow:inset 0 0 0 2px #d68220}
.pp-waitdecide{display:flex;flex-direction:column;gap:6px}
.pp-waitpair{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}
.pp-waitwritten{color:var(--dsw-alias-label-secondary,#555);font-style:italic}
.pp-waitarrow{color:var(--dsw-alias-label-tertiary,#8a8a8a)}
.pp-waitwho{display:inline-flex;align-items:center;gap:6px}
.pp-avatar{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  font-size:9.5px;font-weight:700;background:rgba(47,98,168,.14);color:#2f62a8}
.pp-waitname{font-weight:600;color:var(--dsw-alias-label-primary,#111)}
.pp-syncfoot{margin:0}
/* Grading: one question at a time over the conversation. The questions are
   tabs in the head; a card is the page beside what was read off it, and a row
   of marks. A dashed mark is the suggestion, a filled one the decision. */
.pp-ghead{flex-wrap:wrap}
.pp-gq{font:inherit;font-size:11.5px;cursor:pointer;padding:3px 10px;border-radius:20px;background:transparent;
  color:var(--dsw-alias-label-secondary,#444);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gq span{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gq-on{border-color:var(--dsw-alias-label-primary,#111);color:var(--dsw-alias-label-primary,#111);font-weight:600}
.pp-gq-missing{border-color:#a5561f;color:#a5561f}
.pp-gmissing{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;padding:8px 10px;border-radius:8px;
  font-size:12.5px;color:#a5561f;background:rgba(165,86,31,.08);border:1px solid rgba(165,86,31,.35)}
.pp-gmissing span{flex:1;min-width:200px}
.pp-gsaid{margin:8px 12px 0;max-height:7em;overflow:auto}
.pp-gquestion{font-size:13px;line-height:1.5;margin:0 0 10px;padding:10px 12px;border-radius:8px;
  background:var(--dsw-alias-bg-l2,#f6f6f7)}
.pp-gguide{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#444)}
.pp-gguide summary{cursor:pointer;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gnone{display:flex;flex-direction:column;gap:8px;font-size:12.5px;margin:0 0 14px}
.pp-gplain{padding:6px 0;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.pp-gwho{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6b6b6b);margin-bottom:2px}
.pp-gtext{font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.pp-gmuted{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-style:italic}
.pp-gnote{font-size:11px;color:#a5561f;margin-top:3px}
.pp-glow{font-weight:600}
.pp-glevel{margin:0 0 12px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-glevelhead{display:flex;gap:10px;align-items:baseline;font-size:12.5px;margin-bottom:4px}
.pp-glevelhead b{font-size:15px;min-width:18px}
.pp-glevelhead span:nth-child(2){flex:1}
.pp-ggroup{margin:6px 0 0;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-l2,#f6f6f7)}
.pp-ggroup-unsure .pp-as{color:#a5561f}
.pp-ggrouphead{display:flex;gap:8px;align-items:center;font-size:12.5px}
.pp-ggrouphead .pp-glink{flex:1;min-width:0;text-align:left}
.pp-glink{font:inherit;background:none;border:0;padding:0;cursor:pointer;color:inherit}
.pp-gcompare{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:0 0 14px}
.pp-gprop{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-gprop-on{border:2px solid #2f8a4e}
.pp-gprophead{display:flex;gap:8px;align-items:baseline;font-size:13px}
.pp-gprophead b{flex:1}
.pp-gmean{font-size:12.5px;font-weight:600}
.pp-gmean span{font-weight:400;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gplevel{padding:5px 0;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.pp-gplevelhead{display:flex;gap:8px;align-items:center;font-size:12px}
.pp-gplevelhead b{min-width:18px;font-size:13px}
.pp-gbar{flex:1;height:7px;border-radius:4px;background:var(--dsw-alias-fill-secondary,#eee);overflow:hidden}
.pp-gbar span{display:block;height:100%;background:#2f8a4e}
.pp-gpdesc{font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-secondary,#444);margin-top:2px}
.pp-gpgroups{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.pp-gpgroups span{font-size:10.5px;padding:1px 7px;border-radius:20px;background:var(--dsw-alias-fill-secondary,#f0f0f2);
  color:var(--dsw-alias-label-secondary,#444)}
.pp-gpgroups span.pp-gpunsure{color:#a5561f;background:rgba(165,86,31,.1)}
.pp-gfrom{display:flex;gap:8px;align-items:center;font-size:12px;margin:0 0 10px;color:var(--dsw-alias-label-secondary,#444)}
.pp-gprogress{height:5px;border-radius:3px;background:var(--dsw-alias-fill-secondary,#eee);overflow:hidden;margin:0 0 4px}
.pp-gprogress div{height:100%;background:#2f8a4e}
.pp-gsplit{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,46%)}
.pp-gsplit > .pp-review{min-height:0}
.pp-gside{min-height:0;overflow:auto;padding:10px 12px;border-left:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  background:var(--dsw-alias-bg-l2,#f6f6f7)}
.pp-gside img{display:block;width:100%;height:auto;margin-top:4px;border-radius:6px;background:#fff;cursor:zoom-in;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gpicture{margin:0 0 10px;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gpicturehead{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:12px;margin-bottom:6px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gpicturehead b{font-size:14px;color:var(--dsw-alias-label-primary,#111)}
.pp-gwarn{color:#a5561f;font-weight:600}
.pp-gdist{display:flex;gap:8px;align-items:center;font-size:12px;margin:3px 0}
.pp-gdist b{min-width:22px;text-align:right}
.pp-gdistbar{flex:1;height:10px;border-radius:5px;background:var(--dsw-alias-fill-secondary,#eee);overflow:hidden;display:flex}
.pp-gdist-done{background:#2f8a4e}
.pp-gdist-sug{background:#b9b9bf}
.pp-gdistn{min-width:24px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gsection{display:flex;gap:8px;align-items:center;margin:14px 0 6px;font-size:12.5px}
.pp-gsection i{font-style:normal;font-size:11px;color:#a5561f;background:rgba(165,86,31,.1);padding:0 6px;border-radius:10px}
.pp-gsecmark{min-width:26px;height:26px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;
  font-weight:700;font-size:14px;color:#fff;background:#55555c}
.pp-gsecmark-none{background:var(--dsw-alias-fill-secondary,#e6e6ea);color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gmark{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:54px;padding:4px 6px;border-radius:8px}
.pp-gmark b{font-size:22px;line-height:1.1}
.pp-gmark span{font-size:10px}
.pp-gmark-done{background:#2f8a4e;color:#fff}
.pp-gmark-sug{background:var(--dsw-alias-fill-secondary,#ececef);color:var(--dsw-alias-label-primary,#222)}
.pp-gmark-sug span{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-gmark-none{background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a8a);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gdisagree{font-size:12px;color:#a5561f;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pp-grubric{margin:0 0 12px;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-l1,#fff);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);font-size:12px}
.pp-grubrichead{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
.pp-grlevel{padding:6px 0;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.pp-grlevelhead{display:flex;gap:8px;line-height:1.4}
.pp-grlevelhead b{min-width:18px;font-size:13px}
.pp-grgroup{display:flex;gap:8px;align-items:center;margin:4px 0 0 26px}
.pp-grgroupname{flex:1;min-width:0}
.pp-grgroupname i{font-style:normal;color:#a5561f}
.pp-grother{margin-top:10px;padding:8px;border-radius:8px;background:rgba(47,138,78,.06);border:1px solid rgba(47,138,78,.35)}
.pp-grmoves{margin:4px 0;padding-left:18px}
.pp-grethink{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.pp-grethink textarea{font:inherit;font-size:12px;padding:6px 8px;border-radius:6px;resize:vertical;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:transparent;color:inherit}
.pp-gcard{display:flex;gap:12px;align-items:flex-start;padding:8px 10px;margin:0 0 6px;cursor:pointer;
  border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-gcard.pp-focus{border-color:var(--dsw-alias-label-primary,#111);box-shadow:0 0 0 1px var(--dsw-alias-label-primary,#111)}
.pp-gcard-done{border-left:3px solid #2f8a4e}
.pp-gbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.pp-gbtns{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:5px}
.pp-gscore{font:inherit;font-size:12px;min-width:30px;padding:3px 8px;border-radius:6px;cursor:pointer;background:transparent;
  color:var(--dsw-alias-label-secondary,#444);border:1px solid var(--dsw-alias-border-l2,#c9c9ce)}
.pp-gscore-next{border-color:var(--dsw-alias-label-secondary,#666);font-weight:600}
.pp-gscore-on{background:#2f8a4e;border-color:#2f8a4e;color:#fff;font-weight:600}
.pp-gcomment{font:inherit;font-size:11.5px;flex:1;min-width:90px;padding:3px 7px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:transparent;color:inherit}
.pp-gstate{font-size:11px;color:#2f8a4e}
.pp-veil.pp-gbig{z-index:4100;align-items:center;justify-content:center;cursor:zoom-out;overflow:auto}
.pp-gbigimg{max-width:100%;height:auto;background:#fff;border-radius:6px}
.pp-uploadmodal .pp-publishbody{overflow:auto}
.pp-deskmodal{max-width:900px;width:100%;margin:0 auto}
.pp-deskmodal .pp-publishbody{overflow:auto;font-size:12.5px}
.pp-dlist{margin:0;padding-left:22px}
.pp-dq{margin:0 0 14px;padding:6px 8px;border-radius:8px}
.pp-dlive{background:rgba(196,48,48,.07);outline:1px solid rgba(196,48,48,.35)}
.pp-dqtext{font-size:13.5px;line-height:1.45;margin-bottom:2px}
.pp-dim{color:var(--dsw-alias-label-tertiary,#6b6b6b);font-size:11.5px}
.pp-dwarn{color:#9a5b00;font-size:11.5px}
.pp-drec{color:#c43030;border-color:#c43030;font-weight:600}
.pp-dtake{margin:6px 0 0;padding:6px 0 0;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-dtakehead{display:flex;align-items:center;gap:10px;font-size:11px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-dtakehead audio{height:28px;max-width:320px}
.pp-dtranscript{margin-top:4px;line-height:1.5;white-space:pre-wrap}
.pp-dlow{background:rgba(230,160,0,.22);border-radius:3px}
.pp-dhands{padding:8px 10px;border-radius:8px;background:rgba(196,48,48,.06);border:1px solid rgba(196,48,48,.3)}
.pp-dhandsline{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12.5px}
.pp-dmeter{flex:none;width:120px;height:6px;margin-left:auto;border-radius:3px;overflow:hidden;
  background:var(--dsw-alias-border-l2,#e3e3e6)}
.pp-dmeterfill{display:block;height:100%;background:#9a9aa0;transition:width .1s linear}
.pp-dmeteron{background:#2f8a4e}
.pp-dlivemark{font-size:11.5px;font-weight:600}
.pp-dother{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-dconsent{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2,#c9c9ce)}
.pp-dstatement{margin:0;padding:6px 10px;border-left:3px solid #c43030;font-size:13px;line-height:1.5}
.pp-dspeaking{background:#2f6fd6;border-color:#2f6fd6;color:#fff;font-weight:600}
.pp-dchooser{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.pp-stagebody{padding:0;overflow:hidden}
.pp-stage{flex:1;min-height:0;display:flex;flex-direction:column}
.pp-stagefg{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;
  gap:14px;padding:16px clamp(16px,6vw,72px);text-align:center}
.pp-stagefg>*{flex:none}
.pp-stagefg>:first-child{margin-top:auto}
.pp-stagefg>:last-child{margin-bottom:auto}
.pp-stageq{max-width:640px;font-size:14px;color:var(--dsw-alias-label-secondary,#444);line-height:1.45}
.pp-stageq b{display:block;font-size:12px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary,#6b6b6b);margin-bottom:4px}
.pp-stagebtn{position:relative;flex:none;width:clamp(140px,22vh,180px);height:clamp(140px,22vh,180px);border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#c9c9ce);
  background:var(--dsw-alias-bg-l1,#fff);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:4px;padding:0;color:inherit;font:inherit}
.pp-stagebtn:focus-visible{outline:2px solid #2f6fd6;outline-offset:4px}
.pp-stagelive{border-color:#c43030;background:rgba(196,48,48,.05)}
.pp-stagego{border-color:#c43030;background:#c43030;box-shadow:0 0 0 0 rgba(196,48,48,.45);animation:pp-stagecall 2.2s ease-out infinite}
.pp-stagego:hover{background:#a82626;border-color:#a82626}
.pp-stagego .pp-stagebtnlabel{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em}
@keyframes pp-stagecall{0%{box-shadow:0 0 0 0 rgba(196,48,48,.45)}70%{box-shadow:0 0 0 18px rgba(196,48,48,0)}100%{box-shadow:0 0 0 0 rgba(196,48,48,0)}}
.pp-stagewait{cursor:progress;opacity:.55;border-style:dashed}
.pp-stagebusy{display:flex;align-items:center;gap:10px;max-width:560px;padding:10px 16px;border-radius:10px;
  border:1px solid #d9a400;background:#fff6d6;color:#5a4500;font-size:14px;line-height:1.4;text-align:left}
.pp-stagebusy b{font-weight:700}
.pp-stagespin{flex:none;display:inline-block;width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;
  animation:pp-stagespin .8s linear infinite}
@keyframes pp-stagespin{to{transform:rotate(360deg)}}
.pp-dpending{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;background:#fff6d6;border:1px solid #d9a400;
  color:#5a4500;font-size:12px;font-weight:600}
.pp-dpending .pp-stagespin{width:11px;height:11px}
@media(prefers-reduced-motion:reduce){.pp-stagego,.pp-stagespin{animation:none}}
.pp-stagedots{display:block;width:130px;height:130px;margin-top:-10px}
.pp-stagebtnlabel{position:absolute;bottom:14px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#444)}
.pp-stagetr{max-width:720px;width:100%;min-height:3em;font-size:clamp(17px,2.2vw,24px);line-height:1.45;overflow-wrap:anywhere;
  display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;max-height:calc(1.45em * 4)}
@media(max-height:620px){.pp-stagetr{max-height:calc(1.45em * 3)}}
.pp-stagetrlong{-webkit-mask-image:linear-gradient(to bottom,transparent,#000 1.6em);mask-image:linear-gradient(to bottom,transparent,#000 1.6em)}
.pp-stagetrold{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-stagerow{justify-content:center;min-height:28px}
.pp-dsplit{margin-top:6px;display:flex;flex-direction:column;gap:4px}
.pp-dsplitlist{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:2px}
.pp-dsplitat{font:inherit;font-variant-numeric:tabular-nums;border:0;background:none;padding:0;color:#2f6fd6;cursor:pointer;text-decoration:underline}
.pp-drawer{flex:none;max-height:55%;display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  background:var(--dsw-alias-bg-l2,#f7f7f8)}
.pp-drawerhead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px}
.pp-drawerbody{overflow:auto;padding:0 12px 12px;display:flex;flex-direction:column;gap:8px;font-size:12.5px}
.pp-dcaption{margin:2px 0 6px;font-size:13px;line-height:1.45;font-style:italic;overflow-wrap:anywhere}
.pp-dpartial{color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-dhandsdots{display:flex;align-items:flex-start;gap:12px}
.pp-dhandsbody{flex:1;min-width:0}
.pp-ddots{flex:none;display:block;width:64px;height:64px}
.pp-dproposal{display:flex;flex-direction:column;gap:4px}
.pp-dcount{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;color:#c43030}
.pp-dedit{font:inherit;font-size:13px;width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2,#c9c9ce);background:transparent;color:inherit;resize:vertical}
.pp-drop{flex:none;display:flex;align-items:center;justify-content:center;min-height:96px;
  padding:14px;border-radius:8px;cursor:pointer;text-align:center;font-size:12px;
  color:var(--dsw-alias-label-secondary,#444);
  border:1.5px dashed var(--dsw-alias-border-l2,#c9c9ce)}
.pp-drop:hover,.pp-drop:focus-visible{border-color:var(--dsw-alias-label-tertiary,#9a9a9a);outline:none}
.pp-dropover{border-color:var(--dsw-alias-label-primary,#1a1a1a);
  background:var(--dsw-alias-bg-l2,#f6f6f7)}
.pp-uploadlist{margin:0;padding:0 0 0 2px;list-style:none;font-size:11.5px;max-height:150px;overflow:auto}
.pp-uploadlist li{padding:2px 0;display:flex;gap:4px;align-items:baseline}
.pp-uploadname{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-uploadnote{min-height:56px}
/* The repository field, sized at 18ch above for a pane four hundred pixels
   wide. This dialog is not that, and at 18ch it clipped its own placeholder —
   the one control whose whole job is to be typed into was the one you could
   not read. It takes the room the row has left, within reason. */
.pp-publishbody .pp-input{width:auto;flex:1 1 24ch;min-width:22ch;max-width:40ch}
/* The announcement box. A Telegram post is several lines and is the only thing
   in this pane a professor composes rather than picks, so it gets the room a
   paragraph needs and the monospace the plan below it uses — what is typed
   here is what is sent, character for character. */
.pp-publishtext{font:inherit;font-size:11.5px;line-height:1.5;padding:8px 10px;
  border-radius:6px;resize:vertical;min-height:84px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);
  background:var(--dsw-alias-bg-l1,#fff);color:var(--dsw-alias-label-primary,#1a1a1a)}
.pp-publishcount{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
/* Integrations → This course. A strip of what needs the professor, then one
   card per service. The card is the sync card's shape, grown: a header with
   the service's mark, its rows below, and Details folded at the foot. */
.pp-course{display:flex;flex-direction:column;gap:10px}
.pp-needs{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;
  background:rgba(214,130,32,.09);border:1px solid rgba(214,130,32,.28)}
.pp-needstitle{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#b4600f;font-weight:600}
.pp-needsrow{display:flex;gap:8px;align-items:center;font-size:12px}
.pp-needsrow > span:not(.pp-svc){flex:1;min-width:0}
.pp-ccard{display:flex;flex-direction:column;gap:8px;padding:11px 12px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-chead{display:flex;gap:10px;align-items:center}
.pp-cname{flex:1;min-width:0;font-weight:600;font-size:13px;overflow-wrap:anywhere}
.pp-chip-ok{background:rgba(47,138,78,.13);color:#2f6b3c}
.pp-chip-quiet{background:transparent;color:var(--dsw-alias-label-tertiary,#9a9a9a);padding-left:0}
.pp-csetup{padding:2px 0}
.pp-cread{display:flex;flex-direction:column}
.pp-creadline{display:flex;gap:6px;align-items:center;font-size:12px}
.pp-creadname{flex:1;min-width:0}
.pp-ctools{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding-top:6px;
  border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-crows{display:flex;flex-direction:column}
.pp-crow{border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-crow:last-child{border-bottom:none}
.pp-crowhead{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;width:100%;padding:6px 0;
  background:none;border:0;font:inherit;font-size:12px;text-align:left;cursor:pointer;color:inherit}
.pp-crowhead:hover .pp-crowtitle{text-decoration:underline}
.pp-crowchev{flex:none;width:10px;font-size:10px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-crowtitle{flex:1 1 180px;min-width:0;overflow-wrap:anywhere}
.pp-crowpills{display:flex;gap:4px;flex-wrap:wrap;margin-left:16px}
.pp-crow-open .pp-crowtitle{font-weight:600}
.pp-cpanel{margin:0 0 10px 16px;padding:2px 0 4px 10px;border-left:2px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cpanel .pp-factgroup:first-child{margin-top:4px}
.pp-ccol{flex:1;min-width:0;font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace);font-size:11px}
.pp-ccol a{color:inherit}
.pp-cdetails{border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);padding-top:6px;font-size:12px}
.pp-cdetails > summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-cdetails[open] > summary{margin-bottom:4px}
.pp-unused{padding:2px 0}
/* A sync inside its service's card: the card's own border is enough. */
.pp-synccard-bare{padding:0;border:0;border-radius:0;background:none}
.pp-synccard-bare:hover{border-color:transparent}
.pp-synccard-bare.pp-synccard-drop{padding:8px;border:1px dashed #1e7e38;border-radius:9px}
.pp-csub{display:flex;flex-direction:column;gap:6px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-csubtitle{font-size:12px;font-weight:600}
/* Integrations' own header: This course, and the button to Accounts. */
.pp-ihead{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.pp-ihtitle{font-size:12.5px;font-weight:600}
/* Accounts: one row per service this computer is signed in to. */
.pp-accts{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:12px;
  background:var(--dsw-alias-bg-l1,#fff)}
.pp-acct{padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-acct:last-child{border-bottom:none}
.pp-acct-off .pp-svc{opacity:.55}
.pp-acctbody{padding:8px 0 2px 42px}
/* The design pass (2026-10-13): one size of button inside a card, colour only
   on what needs something, and lists that open on what matters. */
.pp-crowstate{display:block;margin-left:16px;font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.pp-crowsep{color:var(--dsw-alias-label-tertiary,#b0b0b0)}
.pp-st-ok{color:#2f6b3c}
.pp-st-warn{color:#b4600f;font-weight:600}
.pp-st-quiet{color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-morebtn{align-self:flex-start;margin:4px 0 0 16px;padding:0;border:0;background:none;font:inherit;font-size:11.5px;
  cursor:pointer;color:var(--dsw-alias-label-secondary,#555);text-decoration:underline;text-underline-offset:2px}
.pp-cnudge{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 9px;border-radius:8px;font-size:11.5px;
  background:var(--dsw-alias-fill-secondary,#f3f3f5)}
.pp-cnudge > span{flex:1;min-width:160px}
.pp-cnudge .pp-saverow{border:0;margin:0;padding:0}
.pp-waittitle{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.pp-waitrow{display:flex;flex-direction:column;gap:3px;padding:7px 0;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-waitline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pp-waitline .pp-waitpair{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px}
.pp-waitline .pp-avatar{width:18px;height:18px;font-size:8.5px;flex:none}
.pp-waitmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pp-waitwhy{flex:1 1 160px;min-width:0}
.pp-syncsection .pp-waitlist{gap:0}
.pp-waitacts{display:flex;gap:4px;margin-left:auto;flex:none}
.pp-waitmeta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a)}
.pp-linkbtn{margin-left:8px;padding:0;border:0;background:none;font:inherit;font-size:11px;cursor:pointer;
  color:var(--dsw-alias-label-secondary,#555);text-decoration:underline;text-underline-offset:2px}
.pp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px;
  background:var(--dsw-alias-border-l3,#cfcfd6)}
.pp-dot-on{background:#2f8a4e}
.pp-needsrow .pp-svc-small{width:18px;height:18px;font-size:8.5px;border-radius:5px}
/* ---- Gradebook, top half: last changes | grading policy. Two columns when
   there is room, one under the other in the conversation's column. Each pane
   scrolls on its own so the gradebook widget below keeps its place. */
.pp-gbwrap{flex:0 0 auto;margin:10px 14px 0;container-type:inline-size;min-height:0}
.pp-gbpanes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:10px;height:min(46vh,520px)}
.pp-gbpanes > .pp-gbpane{margin:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}
@container (max-width:680px){.pp-gbpanes{grid-template-columns:minmax(0,1fr);height:auto}
  .pp-gbpanes > .pp-gbpane{max-height:300px}}
.pp-gbpanebody{flex:1;min-height:0;overflow:auto;padding:6px 12px 8px}
.pp-gbpad{padding:6px 0}
.pp-gbfilters{display:inline-flex;gap:3px;flex-wrap:wrap}
.pp-gbfilter{min-height:20px;padding:0 8px;font-size:10.5px}
.pp-gblog{list-style:none;margin:0;padding:0}
.pp-gbline{display:flex;gap:8px;align-items:flex-start;padding:6px 0;
  border-top:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.05))}
.pp-gbline:first-child{border-top:0}
.pp-gbline .pp-avatar,.pp-gbline .pp-svc{flex:none;margin-top:1px}
.pp-gbicon{flex:none;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;background:rgba(47,111,214,.12);color:#2f6fd6}
.pp-gbline-policy{background:rgba(47,111,214,.04);border-radius:8px;padding:6px;margin:2px -6px}
.pp-gbwhat{flex:1;min-width:0}
.pp-gbwhat b{font-weight:600}
.pp-gbwhen{margin-left:6px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a8a8f)}
.pp-gbsummary{margin:3px 0 2px;padding-left:16px;font-size:11px;color:var(--dsw-alias-label-secondary,#444)}
.pp-gbsummary li{margin:1px 0;overflow-wrap:anywhere}
.pp-gbsummary-big{font-size:12px;line-height:1.5;padding-left:18px}
.pp-gbmarks{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}
.pp-gbmark{font-size:10.5px;padding:1px 6px;border-radius:5px;background:var(--dsw-alias-fill-secondary,#f2f2f4)}
.pp-gbmore{margin:6px 0 0}
/* The policy: one bar for the top-level blocks, then each block as a row
   that opens to what is in it. */
.pp-gbbar{display:flex;height:22px;border-radius:6px;overflow:hidden;margin:4px 0 8px;font-size:10.5px;font-weight:600}
.pp-gbbar-mini{height:16px;margin:4px 0;font-size:9.5px}
.pp-gbbar-flat{align-items:center;justify-content:center;background:var(--dsw-alias-fill-secondary,#f0f0f2);
  color:var(--dsw-alias-label-tertiary,#6b6b6b);font-weight:500}
.pp-gbseg{flex-basis:0;min-width:0;display:flex;align-items:center;justify-content:center;padding:0 4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
.pp-gbseg + .pp-gbseg{border-left:2px solid var(--dsw-alias-bg-l1,#fff)}
.pp-gbseg0{background:#2f6fd6}.pp-gbseg1{background:#2f8a4e}.pp-gbseg2{background:#b4600f}
.pp-gbseg3{background:#7a4cc2}.pp-gbseg4{background:#0f8a8a}.pp-gbseg5{background:#b4342a}
.pp-gbblock{border-top:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.05))}
.pp-gbblock > summary{display:flex;align-items:center;gap:6px;padding:5px 0;cursor:pointer;list-style:none}
.pp-gbblock > summary::-webkit-details-marker{display:none}
.pp-gbblock > summary::before{content:"▸";font-size:9px;color:var(--dsw-alias-label-tertiary,#8a8a8f);width:8px}
.pp-gbblock[open] > summary::before{content:"▾"}
.pp-gbbtitle{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-gbbw{font-variant-numeric:tabular-nums;font-weight:600}
.pp-gbsum{font-size:10.5px;padding:1px 6px;border-radius:20px;white-space:nowrap}
.pp-gbsum-ok{background:rgba(47,138,78,.13);color:#2f6b3c}
.pp-gbsum-off{background:rgba(214,130,32,.15);color:#b4600f}
.pp-gbmembers{list-style:none;margin:0 0 6px;padding:0 0 0 14px}
.pp-gbmembers li{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px}
.pp-gbmembers .pp-titletext{flex:1}
.pp-gbmw{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#444)}
.pp-gbloose{margin-top:6px}
.pp-gbdesc{margin:8px 0 4px;line-height:1.45}
.pp-gbissues{margin:6px 0 0;padding-left:16px;font-size:11px;color:#a15c00}
.pp-gbissues-fixed{color:#2f6b3c}
.pp-gbissue-err{color:#b4342a}
.pp-gbok{margin-top:6px;color:#2f6b3c}
.pp-gbunlock{display:flex;flex-direction:column;gap:6px;padding:8px;margin:4px 0 10px;border-radius:8px;
  border:1px solid rgba(180,52,42,.35);background:rgba(180,52,42,.05)}
.pp-gbunlock p{margin:0}
.pp-gbrow{display:flex;gap:6px;justify-content:flex-end}
.pp-gbinput{font:inherit;font-size:11.5px;padding:3px 6px;border-radius:6px;min-width:0;color:inherit;
  background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l3,#d2d2d7)}
.pp-gbinput:focus{outline:2px solid #2f6fd6;outline-offset:-1px}
.pp-gbnum{width:64px;text-align:right;font-variant-numeric:tabular-nums}
.pp-gbpctfield{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
/* The editor sheet: the policy on the left, what it changes on the right. */
.pp-gbveil .pp-modal{max-width:1500px;margin:0 auto;width:100%;font-size:11.5px;line-height:1.45;
  color:var(--dsw-alias-label-primary,#1d1d1f)}
.pp-gbimpactpane{flex:0.9;background:var(--dsw-alias-bg-l2,#f8f8f9)}
.pp-gbpresetgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:12px}
.pp-gbpreset{display:flex;flex-direction:column;gap:3px;text-align:left;font:inherit;cursor:pointer;padding:8px 9px;
  border-radius:10px;color:inherit;background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gbpreset:hover{border-color:#2f6fd6;box-shadow:0 0 0 1px #2f6fd6}
.pp-gbpresethead{display:flex;align-items:center;gap:6px;justify-content:space-between}
.pp-gbpresethead b{font-size:12px;font-weight:600}
.pp-gborigin{font-size:11px;padding:6px 8px;margin:0 0 10px;border-radius:6px;background:rgba(47,111,214,.08);color:#2f5aa8}
.pp-gbeditsec{margin-bottom:14px}
.pp-gbblocks{display:flex;flex-direction:column;gap:3px}
.pp-gbblockrow{display:grid;grid-template-columns:110px minmax(120px,1fr) 84px 110px 64px 96px auto;gap:6px;align-items:center}
.pp-gbblockhead{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a8a8f)}
.pp-gbid{font-family:var(--dsw-font-mono,ui-monospace,Consolas,monospace)}
.pp-gbfill{display:flex;align-items:center;gap:2px}
.pp-gbfill .pp-linkbtn{margin-left:4px}
.pp-gbrowbtns{display:flex;align-items:center;gap:2px;white-space:nowrap}
.pp-gbcoursepoints{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:8px;font-size:11.5px}
.pp-gbfiling{display:flex;flex-direction:column}
.pp-gbfilerow{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,220px) 84px;gap:8px;align-items:center;padding:3px 0;
  border-top:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.05))}
.pp-gbfiletitle{display:flex;align-items:center;gap:6px;min-width:0}
.pp-gbfiletitle .pp-titletext{font-weight:600}
.pp-gbimpactsec{margin-top:12px}
.pp-gbtable td,.pp-gbtable th{padding:3px 6px;text-align:left}
.pp-gbhot td{background:rgba(180,52,42,.06)}
.pp-gbup{color:#2f8a4e;font-weight:600}.pp-gbdown{color:#b4342a;font-weight:600}
.pp-gback{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-primary,#111);font-size:11.5px}
.pp-gbnote{width:min(260px,30vw)}
.pp-gbveil .pp-modalpane{container-type:inline-size}
@container (max-width:720px){.pp-gbblockrow{grid-template-columns:84px minmax(90px,1fr) 76px 92px 54px}
  .pp-gbblockrow > .pp-gbfill{grid-column:2 / span 2}.pp-gbblockrow > .pp-gbrowbtns{grid-column:4 / span 2}
  .pp-gbblockhead{display:none}
  .pp-gbfilerow{grid-template-columns:minmax(0,1fr) 84px}.pp-gbfilerow > select{grid-column:1}}
/* The policy diff: bars now/after, blocks marked +/−/~, moves grouped by
   route, weights as a pair of bars. Green new, red gone, amber changed —
   the colours the rest of the pane uses for ok, live and yours-to-decide. */
.pp-gbdiff{display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
.pp-gbdiffbars{display:grid;grid-template-columns:42px minmax(0,1fr);gap:3px 8px;align-items:center}
.pp-gbdifflabel{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a8a8f);text-align:right}
.pp-gbdiffbars .pp-gbbar-mini{margin:0;height:18px}
.pp-gbseg-marked{box-shadow:inset 0 0 0 2px #f2b84b}
.pp-gbdiffsec{display:flex;flex-direction:column;gap:2px}
.pp-gbdiffhead{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#444);margin:2px 0}
.pp-gbdiffline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;font-size:11.5px}
.pp-gbdmark{width:12px;text-align:center;font-weight:700}
.pp-gbdtitle{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
.pp-gbdval{font-variant-numeric:tabular-nums}
.pp-gbdchange{font-size:11px;color:var(--dsw-alias-label-secondary,#444)}
.pp-gbdchange s,.pp-gbwnums s{color:var(--dsw-alias-label-tertiary,#8a8a8f)}
.pp-gbd-added{background:rgba(47,138,78,.10)}.pp-gbd-added .pp-gbdmark{color:#2f8a4e}
.pp-gbd-removed{background:rgba(180,52,42,.08)}.pp-gbd-removed .pp-gbdmark{color:#b4342a}
.pp-gbd-removed .pp-gbdtitle,.pp-gbd-removed .pp-gbdval,.pp-gbd-removed .pp-tag{text-decoration:line-through;opacity:.7}
.pp-gbd-changed{background:rgba(214,130,32,.10)}.pp-gbd-changed .pp-gbdmark{color:#b4600f}
.pp-gbd-same{opacity:.65}
.pp-gbmove{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:3px 6px;border-radius:6px;background:rgba(47,111,214,.06)}
.pp-gbmoveroute{white-space:nowrap;font-size:11px}
.pp-gbmoveitems{display:flex;flex-wrap:wrap;gap:3px}
.pp-gbwrow{display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center;padding:2px 6px;font-size:11px}
.pp-gbwrow-dropped .pp-titletext{text-decoration:line-through;opacity:.7}
.pp-gbwbars{display:flex;flex-direction:column;gap:2px}
.pp-gbwbar{display:block;height:4px;border-radius:2px;min-width:1px}
.pp-gbwbar-was{background:var(--dsw-alias-border-l3,#c9c9ce)}
.pp-gbwbar-now{background:#2f6fd6}
.pp-gbwnums{white-space:nowrap;font-variant-numeric:tabular-nums}
.pp-gbwords{margin:6px 0}
.pp-gbwords > summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8f)}
/* The assistant column: the thread scrolls, the request box stays put. */
.pp-gbassist{flex:0 0 360px;max-width:40%}
.pp-gbthread{display:flex;flex-direction:column;gap:10px}
.pp-gbassisthint{line-height:1.5}
.pp-gbexamples{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.pp-gbexample{text-align:left;font:inherit;font-size:11.5px;cursor:pointer;padding:6px 8px;border-radius:8px;color:inherit;
  background:var(--dsw-alias-bg-l1,#fff);border:1px dashed var(--dsw-alias-border-l3,#c9c9ce)}
.pp-gbexample:hover{border-style:solid;border-color:#2f6fd6}
.pp-gbwaiting{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:8px;background:rgba(47,111,214,.08);font-size:11.5px}
.pp-gbwaiting .pp-checkspin{flex:none;margin-top:3px}
.pp-gbcard{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border-radius:10px;
  background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gbcard-loaded{border-color:#2f8a4e;box-shadow:0 0 0 1px #2f8a4e}
.pp-gbcard-stale{opacity:.75}
.pp-gbcardhead{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pp-gbyou{font-size:11.5px;padding:5px 8px;border-radius:8px;background:var(--dsw-alias-fill-secondary,#f2f2f4)}
.pp-gbwhy{font-size:11.5px;line-height:1.45}
.pp-gbdiff-compact .pp-gbdiffline,.pp-gbdiff-compact .pp-gbwrow{font-size:10.5px}
.pp-gbcompose{flex:none;display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-gbask{width:100%;box-sizing:border-box;resize:vertical;min-height:54px}
@media (max-width:1100px){.pp-gbassist{flex:1 1 auto;max-width:none}}

/* The course navigator: the left sidebar's workspace region. */
.pp-nav{display:flex;flex-direction:column;min-height:0;height:100%;font-size:13px;color:var(--dsw-alias-label-primary,#111)}
.pp-nav-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 4px 8px 0}
.pp-nav-course{position:relative;display:flex;flex-direction:column;gap:3px;width:100%;box-sizing:border-box;text-align:left;font:inherit;color:inherit;
  padding:8px 10px;border-radius:10px;cursor:pointer;background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-nav-course:hover{border-color:var(--dsw-alias-border-l3,#c9c9ce)}
.pp-nav-coursetitle{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13.5px}
.pp-nav-coursetitle span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-nav-coursesub{font-size:11.5px;color:var(--dsw-alias-label-secondary,#444)}
.pp-nav-bar{height:3px;border-radius:2px;background:var(--dsw-alias-fill-secondary,#f2f2f4);margin-top:4px;overflow:hidden}
.pp-nav-bar i{display:block;height:3px;background:#2f6fd6;border-radius:2px}
.pp-nav-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:5;display:flex;flex-direction:column;padding:4px;border-radius:10px;
  background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l3,#c9c9ce);box-shadow:0 8px 24px rgba(0,0,0,.12)}
.pp-nav-label{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#888);margin:14px 6px 4px}
.pp-nav-label span{flex:1}
.pp-nav-row{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;text-align:left;font:inherit;color:inherit;
  background:0 0;border:0;border-radius:8px;padding:6px 8px;cursor:pointer;min-width:0}
.pp-nav-row:hover{background:var(--dsw-alias-fill-secondary,#f2f2f4)}
.pp-nav-row[aria-current=true]{background:var(--dsw-alias-fill-secondary,#f2f2f4);font-weight:600}
.pp-nav-row svg{flex:none;color:var(--dsw-alias-label-secondary,#444)}
.pp-nav-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-nav-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}
.pp-nav-badge{flex:none;font-size:11px;padding:1px 7px;border-radius:8px;background:rgba(214,140,30,.16);color:#9a5b00}
body[data-ds-dark-theme] .pp-nav-badge{color:#f0b45c}
.pp-nav-week{display:flex;flex-direction:column;gap:1px;padding:2px 0}
.pp-nav-line{display:flex;align-items:baseline;gap:6px;padding:3px 8px;font-size:12px;min-width:0}
.pp-nav-line .pp-nav-text{color:var(--dsw-alias-label-primary,#111)}
.pp-nav-quiet{color:var(--dsw-alias-label-tertiary,#888);font-size:12px;padding:3px 8px}
.pp-nav-icon{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;border:0;background:0 0;
  color:var(--dsw-alias-label-secondary,#444);cursor:pointer;padding:0}
.pp-nav-icon:hover{background:var(--dsw-alias-fill-secondary,#f2f2f4)}
.pp-nav-dot{flex:none;width:6px;height:6px;border-radius:50%;background:#2f6fd6}
.pp-nav-foot{flex:none;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);padding-top:6px;margin-top:4px}
.pp-nav-rail{display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:4px}
.pp-nav-rail .pp-nav-icon{width:36px;height:36px;border-radius:8px;position:relative}
.pp-nav-mono{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;
  background:var(--dsw-alias-fill-secondary,#f2f2f4);margin-bottom:6px;cursor:pointer;border:0;color:inherit}
.pp-nav-pip{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:#d68c1e}
.pp-nav-rail .pp-nav-icon[aria-current=true]{background:var(--dsw-alias-fill-secondary,#f2f2f4);color:var(--dsw-alias-label-primary,#111)}

/* The right column as an inspector: focus, waiting, recent changes. */
.pp-insp{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 24px;font-size:13px;color:var(--dsw-alias-label-primary,#111)}
.pp-insp-section{padding:6px 0 4px}
.pp-insp-section+.pp-insp-section{border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);margin-top:6px}
.pp-insp-label{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#888);margin:6px 4px 4px}
.pp-insp-label span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-insp-line{display:flex;align-items:baseline;gap:6px;flex:1;min-width:0;width:100%;box-sizing:border-box;text-align:left;font:inherit;font-size:12.5px;color:inherit;
  background:0 0;border:0;border-radius:7px;padding:5px 6px;cursor:pointer}
.pp-insp-line:hover{background:var(--dsw-alias-fill-secondary,#f2f2f4)}
.pp-insp-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-insp-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}
.pp-insp-quiet{color:var(--dsw-alias-label-tertiary,#888);font-size:12px;padding:3px 6px}
.pp-insp-change{display:flex;align-items:center;gap:2px;min-width:0}
.pp-insp-act{flex:none;font:inherit;font-size:11px;padding:2px 8px;border-radius:6px;cursor:pointer;color:var(--dsw-alias-label-secondary,#444);
  background:0 0;border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-insp-act:hover{border-color:var(--dsw-alias-border-l3,#c9c9ce)}
`;
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-professor-pane";
  tag.dataset.pluginCss = CSS_ID;
  tag.textContent = PANE_CSS;
  document.head.appendChild(tag);
}

// client/react.js
var React = __toESM(require("react"), 1);
var ReactDOM = __toESM(require("react-dom"), 1);
var h = React.createElement;
var Fragment2 = React.Fragment;

// client/defence-captions.js
var CAPTION_MS = 5e3;
var pcmBase64 = (input, ratio, silent) => {
  const length = Math.floor(input.length / ratio);
  const pcm = new Int16Array(length);
  if (!silent) {
    for (let index = 0; index < length; index += 1) {
      const from = Math.floor(index * ratio);
      const to = Math.min(input.length, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let at = from; at < to; at += 1) sum += input[at];
      const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
      pcm[index] = value < 0 ? value * 32768 : value * 32767;
    }
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let at = 0; at < bytes.length; at += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 32768));
  return btoa(binary);
};
function useCaptions(endpoint, marks, whole) {
  const [captions, setCaptions] = React.useState(null);
  const [liveCaptions, setLiveCaptions] = React.useState(true);
  const liveCaptionsRef = React.useRef(true);
  liveCaptionsRef.current = liveCaptions;
  const captionLoop = React.useRef(null);
  const startCaptions = (stream, questionId, type) => {
    stopCaptions();
    setCaptions({ question: questionId, pieces: [], partial: "", mode: null });
    if (!liveCaptionsRef.current) return;
    const loop = { active: true, index: 0, loud: false, recorder: null, timer: null, cleanup: null };
    captionLoop.current = loop;
    fetch(endpoint("/api/defence/realtime"), { method: "POST" }).then((response) => response.json()).then((result) => {
      if (!loop.active) return;
      if (result.session) startStreaming(loop, stream, result.session, questionId, type);
      else startPieces(loop, stream, questionId, type);
    }).catch(() => loop.active && startPieces(loop, stream, questionId, type));
  };
  const startStreaming = (loop, stream, session, questionId, type) => {
    let socket;
    try {
      socket = new WebSocket(session.url);
    } catch {
      startPieces(loop, stream, questionId, type);
      return;
    }
    let opened2 = false;
    let audio = null;
    let source = null;
    let node = null;
    const teardown = () => {
      try {
        if (node) node.disconnect();
        if (source) source.disconnect();
        if (audio && audio.state !== "closed") audio.close();
      } catch {
      }
      node = source = audio = null;
    };
    const fallBack = () => {
      teardown();
      if (loop.fellBack || opened2 || !loop.active) return;
      loop.fellBack = true;
      startPieces(loop, stream, questionId, type);
    };
    socket.onopen = () => {
      opened2 = true;
      setCaptions((current) => current && current.question === questionId ? Object.assign({}, current, { mode: "streaming" }) : current);
      try {
        audio = new AudioContext();
        source = audio.createMediaStreamSource(stream);
        node = audio.createScriptProcessor(4096, 1, 1);
        const ratio = audio.sampleRate / session.sampleRate;
        node.onaudioprocess = (event) => {
          if (socket.readyState !== 1 || whole.current.paused !== null) return;
          socket.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: pcmBase64(event.inputBuffer.getChannelData(0), ratio, marks.current.held !== null),
              commit: false,
              sample_rate: session.sampleRate
            })
          );
        };
        source.connect(node);
        node.connect(audio.destination);
      } catch {
        socket.close();
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const kind = String(message.message_type || "");
      if (kind === "partial_transcript") {
        setCaptions((current) => current && current.question === questionId ? Object.assign({}, current, { partial: String(message.text || "") }) : current);
      } else if (kind === "committed_transcript") {
        const text = String(message.text || "").trim();
        const index = loop.index;
        loop.index += 1;
        setCaptions(
          (current) => current && current.question === questionId ? Object.assign({}, current, { partial: "", pieces: text ? current.pieces.concat([{ index, text }]) : current.pieces }) : current
        );
      } else if (/error|exceeded|limited|exhausted/.test(kind)) {
        setCaptions((current) => current && current.question === questionId ? Object.assign({}, current, { mode: "failed:" + (message.error || kind) }) : current);
        socket.close();
      }
    };
    socket.onerror = () => fallBack();
    socket.onclose = () => fallBack();
    loop.cleanup = () => {
      teardown();
      if (socket.readyState === 1) {
        try {
          socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: session.sampleRate }));
        } catch {
        }
        setTimeout(() => socket.close(), 1500);
      } else if (socket.readyState === 0) {
        socket.close();
      }
    };
  };
  const startPieces = (loop, stream, questionId, type) => {
    setCaptions((current) => current && current.question === questionId ? Object.assign({}, current, { mode: "pieces" }) : current);
    const cycle = () => {
      if (!loop.active) return;
      let piece;
      try {
        piece = new MediaRecorder(stream, type ? { mimeType: type } : void 0);
      } catch {
        return;
      }
      const chunks = [];
      piece.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      piece.onstop = () => {
        const index = loop.index;
        loop.index += 1;
        const spoke = loop.loud;
        loop.loud = false;
        const blob = new Blob(chunks, { type: (piece.mimeType || type || "audio/webm").split(";")[0] });
        if (spoke && blob.size) caption(questionId, index, blob);
        if (loop.active && stream.active) cycle();
      };
      loop.recorder = piece;
      piece.start();
      loop.timer = setTimeout(() => piece.state !== "inactive" && piece.stop(), CAPTION_MS);
    };
    cycle();
  };
  const stopCaptions = () => {
    const loop = captionLoop.current;
    if (!loop) return;
    loop.active = false;
    clearTimeout(loop.timer);
    if (loop.cleanup) loop.cleanup();
    if (loop.recorder && loop.recorder.state !== "inactive") loop.recorder.stop();
    captionLoop.current = null;
  };
  const heard = (level, threshold) => {
    const loop = captionLoop.current;
    if (loop && level > threshold && marks.current.held === null && whole.current.paused === null) loop.loud = true;
  };
  const caption = (questionId, index, blob) => fetch(endpoint("/api/defence/caption", "&question=" + encodeURIComponent(questionId)), {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob
  }).then((response) => response.json()).then((result) => {
    if (result.error || !String(result.text || "").trim()) return;
    setCaptions(
      (current) => current && current.question === questionId ? Object.assign({}, current, {
        pieces: current.pieces.concat([{ index, text: String(result.text).trim() }]).sort((a, b) => a.index - b.index)
      }) : current
    );
  }).catch(() => {
  });
  return { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard };
}
function CaptionsLine(props) {
  const captions = props.captions;
  return captions && captions.question === props.question && (captions.pieces.length || captions.partial) ? h(
    "div",
    { className: "pp-dcaption", "aria-live": "polite" },
    h("span", { className: "pp-dim" }, captions.mode === "streaming" ? "Live: " : "Live, every few seconds: "),
    captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
    captions.partial ? h("span", { className: "pp-dpartial" }, " " + captions.partial) : null
  ) : null;
}

// client/defence-marks.js
function useProfessorMarks() {
  const marks = React.useRef({ origin: null, held: null, ranges: [] });
  const [professorTalking, setProfessorTalking] = React.useState(false);
  const openMarks = (origin) => {
    marks.current = { origin, held: marks.current.held !== null ? origin : null, ranges: [] };
  };
  const closeMarks = () => {
    const current = marks.current;
    const now = Date.now();
    if (current.origin !== null && current.held !== null) current.ranges.push([(current.held - current.origin) / 1e3, (now - current.origin) / 1e3]);
    const ranges = current.ranges;
    marks.current = { origin: null, held: current.held !== null ? now : null, ranges: [] };
    return ranges;
  };
  const speakDown = () => {
    if (marks.current.held !== null) return;
    marks.current.held = Date.now();
    setProfessorTalking(true);
  };
  const speakUp = () => {
    const current = marks.current;
    if (current.held === null) return;
    if (current.origin !== null) {
      current.ranges.push([Math.max(0, (current.held - current.origin) / 1e3), (Date.now() - current.origin) / 1e3]);
    }
    current.held = null;
    setProfessorTalking(false);
  };
  React.useEffect(() => {
    const typing = (event) => /^(INPUT|TEXTAREA)$/.test(String(event.target && event.target.tagName));
    const down = (event) => {
      if ((event.key === "p" || event.key === "P") && !event.repeat && !typing(event)) speakDown();
    };
    const up = (event) => {
      if (event.key === "p" || event.key === "P") speakUp();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", speakUp);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", speakUp);
    };
  }, []);
  return { marks, professorTalking, openMarks, closeMarks, speakDown, speakUp };
}
function SpeakButton(props) {
  return h(
    "button",
    {
      type: "button",
      className: "pp-segbtn" + (props.talking ? " pp-dspeaking" : ""),
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture(event.pointerId);
        props.onDown();
      },
      onPointerUp: props.onUp,
      onPointerCancel: props.onUp,
      title: "Hold while you speak, so your words are not taken for the student's answer."
    },
    props.talking ? "You are speaking — not the answer" : "Hold to speak (P)"
  );
}

// client/tabs.js
var BASE = "/professor-pane";
var PLACE_SHOWN_EVENT = "professor-pane:place-shown";
function scoped(path, sessionId) {
  return path + (path.indexOf("?") === -1 ? "?" : "&") + "session=" + encodeURIComponent(sessionId);
}
var SUBVIEWS = {
  tasks: [
    { id: "tasks", label: "Pending" },
    { id: "ready", label: "Ready" },
    { id: "checklist", label: "Checklist" },
    // Last: not work to do on the course but what has not left it yet —
    // marks Canvas does not have, materials changed since publishing.
    { id: "unpublished", label: "Unpublished" }
  ]
};
var IDENTITY_MODES = [
  { label: "Names", names: true, hint: "real names from your private roster" },
  {
    label: "Pseudonyms",
    names: false,
    hint: "STUDENT-XXXXXX — press before screen-sharing or projecting"
  }
];
var DRAFT_MODES = [
  { label: "Record", drafts: false, hint: "only what has been accepted" },
  { label: "+ drafts", drafts: true, hint: "including records marked approval: draft" }
];

// client/defence-screen.js
var screenChannelName = (assessmentId, studentId) => "professor-pane-defence:" + assessmentId + ":" + studentId;
function useStudentScreen(props, dataRef) {
  const screen = React.useRef({ channel: null, open: false, ready: false, last: null, said: 0, waiting: null, onSpoken: null });
  const [screenState, setScreenState] = React.useState("closed");
  const [readAloud, setReadAloud] = React.useState(false);
  const readAloudRef = React.useRef(false);
  readAloudRef.current = readAloud && screenState === "ready";
  const showOnScreen = (questionId, phase, speak, picked) => {
    const questions = dataRef.current && dataRef.current.questions || [];
    const entry = picked && questions.find((q) => q.id === picked) || (questionId ? questions.find((q) => q.id === questionId) : null);
    const prepared = questions.filter((q) => q.kind !== "follow_up" && q.kind !== "whole");
    const label = !entry ? "" : entry.kind === "follow_up" ? "Follow-up question" : entry.kind === "whole" ? "The defence" : "Question " + (prepared.findIndex((q) => q.id === entry.id) + 1) + " of " + prepared.length;
    const languages = dataRef.current && dataRef.current.languages || [];
    const state = {
      type: "state",
      question: questionId || null,
      title: dataRef.current && dataRef.current.assessment && dataRef.current.assessment.title || "",
      label,
      // The whole defence has no one question to show: the professor asks aloud.
      text: entry ? entry.kind === "whole" ? "Answer the professor's questions as they come." : entry.text : "",
      phase,
      lang: languages.length === 1 ? languages[0] : void 0
    };
    if (speak) {
      screen.current.said += 1;
      state.speak = true;
      state.id = screen.current.said;
    }
    screen.current.last = Object.assign({}, state, { speak: false });
    if (screen.current.channel) screen.current.channel.postMessage(state);
    return state.text;
  };
  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return void 0;
    const channel = new BroadcastChannel(screenChannelName(props.assessment, props.student));
    screen.current.channel = channel;
    channel.onmessage = (event) => {
      const message = event.data || {};
      screen.current.seen = Date.now();
      if (message.type === "alive") {
        const ready = screen.current.ready || Boolean(message.ready);
        if (!screen.current.open || ready !== screen.current.ready) {
          screen.current.open = true;
          screen.current.ready = ready;
          setScreenState(ready ? "ready" : "open");
        }
      } else if (message.type === "hello") {
        screen.current.open = true;
        screen.current.ready = screen.current.ready || Boolean(message.ready);
        setScreenState(screen.current.ready ? "ready" : "open");
        channel.postMessage(screen.current.last || { type: "state", phase: "idle" });
      } else if (message.type === "bye") {
        screen.current.open = false;
        screen.current.ready = false;
        setScreenState("closed");
      } else if (message.type === "spoken" && screen.current.onSpoken) {
        screen.current.onSpoken(message.id);
      }
    };
    const watch = setInterval(() => {
      if (screen.current.open && Date.now() - (screen.current.seen || 0) > 5e3) {
        screen.current.open = false;
        screen.current.ready = false;
        setScreenState("closed");
      }
    }, 1e3);
    return () => {
      clearInterval(watch);
      channel.postMessage({ type: "state", phase: "idle" });
      channel.close();
      screen.current.channel = null;
    };
  }, [props.assessment, props.student]);
  const openScreen = () => window.open(
    scoped(BASE + "/defence/screen?assessment=" + encodeURIComponent(props.assessment) + "&student=" + encodeURIComponent(props.student), props.sessionId),
    "defence-screen-" + props.student,
    "popup,width=1100,height=700"
  );
  return { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen };
}
function ScreenRow(props) {
  const screenState = props.screenState;
  return h(
    "div",
    { className: "pp-approverow" },
    h("button", { type: "button", className: "pp-segbtn", onClick: props.onOpen }, screenState === "closed" ? "Open student screen" : "Show student screen"),
    h(
      "span",
      { className: screenState === "ready" ? "pp-dim" : "pp-dwarn" },
      screenState === "closed" ? typeof BroadcastChannel === "undefined" ? "this browser cannot drive a second window" : "not open — the question is then only on this screen" : screenState === "open" ? "open — click it once, then move it to the screen the student sees" : "ready: it shows the question being asked and nothing else"
    ),
    h(
      "label",
      { className: "pp-dim pp-dchooser" },
      h("input", {
        type: "checkbox",
        checked: props.readAloud,
        disabled: screenState !== "ready",
        onChange: (event) => props.setReadAloud(event.target.checked)
      }),
      " read each question aloud there"
    )
  );
}

// client/defence-dots.js
var dotsLoading = null;
var loadDots = () => {
  if (window.__professorPaneDots) return Promise.resolve(window.__professorPaneDots);
  if (dotsLoading) return dotsLoading;
  window.__professorPaneReact = React;
  dotsLoading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = BASE + "/vendor/dots-swarm.js";
    script.async = true;
    script.onload = () => resolve(window.__professorPaneDots || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return dotsLoading;
};
var DOT_SHAPES = {
  idle: "microphone",
  waiting: "microphone",
  reading: "message",
  speaking: "equalizer",
  professor: "headphones",
  thinking: "thought-bubble",
  proposing: "thought-bubble",
  paused: "pause",
  done: "check"
};
function ListeningDots(props) {
  const [dots, setDots] = React.useState(window.__professorPaneDots || null);
  React.useEffect(() => {
    if (dots) return void 0;
    let live = true;
    loadDots().then((loaded) => live && setDots(loaded));
    return () => {
      live = false;
    };
  }, []);
  if (!dots || !dots.DotSwarm) return null;
  const shape = DOT_SHAPES[props.phase] || "orb";
  const listening = props.phase === "waiting" || props.phase === "speaking";
  return h(
    "span",
    { className: props.className || "pp-ddots", "aria-hidden": "true" },
    h(dots.DotSwarm, {
      shape,
      count: props.size && props.size > 100 ? 260 : 140,
      dotSize: props.size && props.size > 100 ? 2.5 : 2,
      color: props.color ? props.color : listening ? "#c43030" : props.phase === "professor" ? "#2f6fd6" : "#8d8f96",
      // The student's voice drives the swarm: louder is livelier.
      speed: props.phase === "speaking" ? 1 + Math.min(2, (props.level || 0) * 20) : 0.6,
      choreography: "flow",
      transitionDuration: 0.6,
      style: { width: props.size || 64, height: props.size || 64 },
      label: shape
    })
  );
}

// client/defence-views.js
var clock = (seconds) => Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
var clockTime = (iso) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0");
};
var speakButtonFor = (desk) => h(SpeakButton, { talking: desk.professorTalking, onDown: desk.speakDown, onUp: desk.speakUp });
function TakeView(props) {
  const desk = props.desk;
  const answer = props.answer;
  return h(
    "div",
    { className: "pp-dtake" },
    h(
      "div",
      { className: "pp-dtakehead" },
      "Take " + answer.take + (answer.seconds ? " · " + clock(answer.seconds) : ""),
      h("audio", {
        id: "pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"),
        controls: true,
        preload: "none",
        src: desk.endpoint("/api/defence/audio", "&file=" + encodeURIComponent(answer.audio))
      })
    ),
    // Whose words: the professor's are marked and dimmed, another voice
    // likewise, and a take whose voices could not be told apart says so
    // above its words — it is kept, and never cited as the answer.
    answer.transcript && answer.transcript.speakers && answer.transcript.speakers.unclear ? h("div", { className: "pp-dwarn" }, "Voices unclear — not cited as the student's: " + (answer.transcript.speakers.note || "")) : null,
    h(VoicePicker, { desk, answer }),
    answer.transcript ? h(
      "div",
      { className: "pp-dtranscript" },
      answer.transcript.segments.map((segment, index) => {
        const other = segment.speaker === "professor" ? "You: " : segment.speaker === "unknown" ? "Other voice: " : "";
        return h(
          "span",
          {
            key: index,
            className: (other ? "pp-dother " : "") + (segment.confidence === "low" ? "pp-dlow" : ""),
            title: clock(segment.start) + (segment.confidence === "low" ? " · low confidence — listen to it" : "")
          },
          other ? h("b", null, other) : null,
          segment.text + " "
        );
      }),
      answer.transcript.timed ? null : h("span", { className: "pp-dim" }, " (no timestamps from this model)")
    ) : h("div", { className: "pp-dim" }, answer.error ? "Not transcribed: " + answer.error : "Transcribing…"),
    answer.question_id === "Q0" ? h(SplitView, { desk, answer }) : null
  );
}
function SplitView(props) {
  const desk = props.desk;
  const answer = props.answer;
  const splitting = desk.splitting;
  if (!answer.transcript || answer.withdrawn) return null;
  const found = (desk.data && desk.data.splits || []).find((entry) => entry.question_id === answer.question_id && entry.take === answer.take);
  const busyHere = splitting && splitting.question === answer.question_id && splitting.take === answer.take;
  const play = (seconds) => {
    const audio = document.getElementById("pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"));
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play().catch(() => {
    });
  };
  return h(
    "div",
    { className: "pp-dsplit" },
    busyHere ? h("div", { className: "pp-dim" }, "Dividing the defence into its questions…") : found ? h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pp-dim" },
        found.parts.length + " question(s), divided by " + found.by + (found.approval === "approved" ? " · you checked them" : " · a draft: check the parts")
      ),
      h(
        "ol",
        { className: "pp-dsplitlist" },
        found.parts.map(
          (part, index) => h(
            "li",
            { key: index },
            h("button", { type: "button", className: "pp-dsplitat", title: "Play from here", onClick: () => play(part.start) }, clock(part.start)),
            " ",
            part.question_id ? h("b", null, part.question_id + " ") : h("span", { className: "pp-dim" }, "not prepared · "),
            part.asked,
            part.criterion_id ? h("span", { className: "pp-dim" }, " · " + (desk.criteria.get(part.criterion_id) || part.criterion_id)) : null
          )
        )
      ),
      found.notes && found.notes.length ? h("div", { className: "pp-dwarn" }, found.notes.join(" · ")) : null,
      h(
        "div",
        { className: "pp-approverow" },
        found.approval !== "approved" ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.split(answer.question_id, answer.take, "approve") }, "These are right") : null,
        h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide again")
      )
    ) : h(
      "div",
      { className: "pp-approverow" },
      h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide into questions"),
      h("span", { className: "pp-dim" }, "the session's model reads the dialogue, your presses as hints; nothing is graded")
    )
  );
}
function VoicePicker(props) {
  const answer = props.answer;
  const transcript = answer.transcript;
  if (!transcript) return null;
  const voices = [];
  for (const segment of transcript.segments) {
    if (!segment.speaker_id || voices.some((voice) => voice.id === segment.speaker_id)) continue;
    voices.push({ id: segment.speaker_id, first: segment.text });
  }
  const settled = transcript.speakers && transcript.speakers.professor_voices;
  if (voices.length < 2 || !transcript.speakers.unclear && !settled) return null;
  return h(
    "div",
    { className: "pp-approverow pp-dvoices" },
    h("span", { className: "pp-dim" }, settled ? "Your voice:" : "Which voice is yours?"),
    voices.map(
      (voice) => h(
        "button",
        {
          type: "button",
          key: voice.id,
          className: "pp-segbtn",
          "aria-pressed": !!settled && settled.includes(voice.id),
          title: voice.id,
          onClick: () => props.desk.assignVoice(answer, voice.id)
        },
        "“" + (voice.first.length > 48 ? voice.first.slice(0, 46) + "…" : voice.first) + "” is me"
      )
    )
  );
}
function ConsentPanel(props) {
  const desk = props.desk;
  const previous = desk.data.consent;
  if (desk.consented) {
    return h(
      "div",
      { className: "pp-approverow" },
      h("span", { className: "pp-dim", title: previous.statement }, "The student agreed to be recorded at " + clockTime(previous.at) + "."),
      desk.confirmWithdraw ? h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: desk.withdraw }, "Stop and record the withdrawal"),
        h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(false) }, "Cancel")
      ) : h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(true) }, "The student withdraws")
    );
  }
  return h(
    "div",
    { className: "pp-dconsent" },
    h("b", null, previous && previous.withdrawn_at ? "The student withdrew at " + clockTime(previous.withdrawn_at) + "." : "Before anything is recorded"),
    previous && previous.withdrawn_at ? h("div", { className: "pp-dim" }, "Nothing more is recorded. The takes before it are kept and marked withdrawn, so nothing cites them; deleting them is your decision.") : h(
      React.Fragment,
      null,
      h("div", null, "Read this to the student, or let them read it on their screen:"),
      h("blockquote", { className: "pp-dstatement" }, desk.data.statement),
      previous && !previous.agreed ? h("div", { className: "pp-dwarn" }, "At " + clockTime(previous.at) + " the student did not agree. Nothing is recorded unless they agree now.") : null,
      h(
        "div",
        { className: "pp-approverow" },
        h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: () => desk.answerConsent("agree") }, "The student agreed"),
        h("button", { type: "button", className: "pp-segbtn", disabled: desk.consentBusy, onClick: () => desk.answerConsent("decline") }, "The student did not agree")
      )
    )
  );
}
function GradeRow(props) {
  const desk = props.desk;
  const usable = (desk.data && desk.data.answers || []).filter((answer) => answer.transcript && !answer.withdrawn);
  if (!usable.length || desk.handsFree || desk.recording) return null;
  return h(
    "div",
    { className: "pp-approverow" },
    h("button", { type: "button", className: "pp-segbtn pp-chat", onClick: desk.proposeGrade }, "Propose the grade"),
    h(
      "span",
      { className: "pp-dim" },
      "the session's model reads what the student said and the code, and writes suggested marks citing the recording; you decide them"
    )
  );
}
function StartRow(props) {
  const desk = props.desk;
  const mode = desk.mode;
  return h(
    "div",
    { className: "pp-approverow" },
    // AGT-11: the two modes, each with its own start; the whole defence first.
    h(
      "span",
      { className: "pp-approverow", role: "group", "aria-label": "Mode" },
      h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "whole", onClick: () => desk.chooseMode("whole") }, "Whole defence"),
      h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "questions", onClick: () => desk.chooseMode("questions") }, "Question by question")
    ),
    mode === "whole" ? h(
      "button",
      {
        type: "button",
        className: "pp-segbtn pp-drec",
        disabled: Boolean(desk.recording || desk.sending),
        title: "One recording of the whole defence, transcribed as you talk. Press Space at each new question; the session's model divides it into its questions afterwards.",
        onClick: desk.recordWhole
      },
      "● Record the whole defence"
    ) : h(
      "button",
      {
        type: "button",
        className: "pp-segbtn pp-drec",
        disabled: Boolean(desk.recording || desk.sending),
        title: "Listens continuously: an answer ends after a pause of about two and a half seconds, and the next question comes up by itself.",
        onClick: desk.startHandsFree
      },
      "● Start hands-free"
    ),
    mode === "questions" ? h(
      "label",
      { className: "pp-dim pp-dchooser" },
      h("input", { type: "checkbox", checked: desk.chooser, onChange: (event) => desk.setChooser(event.target.checked) }),
      " the session's model chooses each next question — a follow-up, or the next prepared one"
    ) : null,
    h(
      "label",
      {
        className: "pp-dim pp-dchooser",
        title: "Every few seconds of speech is transcribed as it is said, through the same provider. Each answer is then transcribed twice: the captions are not kept."
      },
      h("input", { type: "checkbox", checked: desk.liveCaptions, onChange: (event) => desk.setLiveCaptions(event.target.checked) }),
      " live captions while the student answers"
    ),
    desk.pending > 0 ? h("span", { className: "pp-dim" }, desk.pending + " answer(s) transcribing…") : null
  );
}
function ProposalPanel(props) {
  const desk = props.desk;
  const current = desk.proposal;
  const question = current.question;
  const left = Math.max(0, Math.ceil((current.deadline - desk.now) / 1e3));
  const done = current.decision.action === "done" || !question;
  const notes = current.decision.notes || [];
  return h(
    "div",
    { className: "pp-dproposal" },
    h(
      "div",
      { className: "pp-dhandsline" },
      done ? h("b", null, "Done?") : h("b", null, question.id + (question.follows ? " ↳ follow-up on " + question.follows : "")),
      current.editing === null ? h("span", { className: "pp-dcount" }, done ? "finishing in " + left + " s" : "asking in " + left + " s") : null
    ),
    done ? h("div", null, current.decision.why || "Nothing left to ask.") : current.editing !== null ? h("textarea", {
      className: "pp-dedit",
      value: current.editing,
      rows: 2,
      autoFocus: true,
      onChange: (event) => desk.setProposal(Object.assign({}, current, { editing: event.target.value }))
    }) : h("div", { className: "pp-dqtext" }, question.text),
    !done && current.decision.why ? h("div", { className: "pp-dim" }, "Why: " + current.decision.why) : null,
    notes.length ? h("div", { className: "pp-dwarn" }, notes.join(" · ")) : null,
    h(
      "div",
      { className: "pp-dim" },
      "Chosen by " + current.decision.by + "."
    ),
    h(
      "div",
      { className: "pp-approverow" },
      current.editing !== null ? h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("edit", current.editing) }, "Save and ask") : h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("ask_now") }, done ? "Finish now" : "Ask now"),
      !done && current.editing === null ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setProposal(Object.assign({}, current, { editing: question.text })) }, "Edit") : null,
      !done ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("skip") }, "Skip — next prepared question") : null,
      h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("pause") }, "Pause")
    )
  );
}
function HandsPanel(props) {
  const desk = props.desk;
  return h(
    "div",
    { className: "pp-dhands pp-dhandsdots" },
    // One swarm for the whole defence, so it morphs between shapes
    // rather than starting over at each question.
    h(ListeningDots, { phase: desk.proposal ? "proposing" : desk.handsFree.phase, level: desk.handsFree.level }),
    h("div", { className: "pp-dhandsbody" }, h(HandsBody, { desk }))
  );
}
function HandsBody(props) {
  const desk = props.desk;
  const handsFree = desk.handsFree;
  const captions = desk.captions;
  return desk.proposal ? h(ProposalPanel, { desk }) : handsFree.phase === "thinking" || handsFree.phase === "proposing" ? h(
    React.Fragment,
    null,
    h("div", { className: "pp-dhandsline" }, "Transcribing the answer and choosing what to ask next…"),
    captions ? h(CaptionsLine, { captions, question: captions.question }) : null
  ) : handsFree.phase === "reading" ? h("div", { className: "pp-dhandsline" }, h("b", null, handsFree.question), " · being read aloud on the student's screen — listening starts when it finishes") : h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pp-dhandsline" },
      h("b", null, handsFree.question),
      " · ",
      handsFree.phase === "professor" ? "you are speaking — the answer waits" : handsFree.phase === "speaking" ? handsFree.silent ? "pause " + (handsFree.silent / 1e3).toFixed(1) + " s" : "hearing the answer" : "listening — waiting for the student to speak",
      h(
        "span",
        { className: "pp-dmeter", "aria-hidden": "true" },
        h("span", {
          className: "pp-dmeterfill" + (handsFree.level > handsFree.threshold ? " pp-dmeteron" : ""),
          style: { width: Math.min(100, Math.round(handsFree.level * 400)) + "%" }
        })
      )
    ),
    h(CaptionsLine, { captions, question: handsFree.question }),
    h(
      "div",
      { className: "pp-approverow" },
      h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("space") }, "End answer (Space)"),
      h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip, no answer"),
      h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
      speakButtonFor(desk)
    ),
    h(
      "div",
      { className: "pp-dim" },
      "Hold P (or the button) whenever you speak, so your words are not taken for the answer."
    )
  );
}
function RecordingPanel(props) {
  const desk = props.desk;
  const recording = desk.recording;
  const wholeMarks = desk.wholeMarks;
  const whole = recording.question === "Q0";
  const phase = desk.professorTalking ? "professor" : desk.manualVoiced ? "speaking" : "waiting";
  return h(
    "div",
    { className: "pp-dhands pp-dhandsdots" },
    h(ListeningDots, { phase, level: desk.manualLevel }),
    h(
      "div",
      { className: "pp-dhandsbody" },
      h(
        "div",
        { className: "pp-dhandsline" },
        h("b", null, whole ? "The whole defence" + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) : "") : recording.question),
        (recording.paused ? " · paused at " : " · recording ") + clock(desk.elapsed) + (phase === "speaking" ? " · hearing a voice" : phase === "professor" ? " · you are speaking" : "")
      ),
      h(CaptionsLine, { captions: desk.captions, question: recording.question }),
      h(
        "div",
        { className: "pp-approverow" },
        whole && !recording.paused ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.markQuestion(null) }, "Next question (Space)") : null,
        whole ? h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause") : null,
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
        speakButtonFor(desk)
      ),
      whole ? h(
        "div",
        { className: "pp-dim" },
        "Ask as you go. Press Space at each new question, or Asking this beside a prepared one — hints for dividing it afterwards. Hold P while you speak."
      ) : null
    )
  );
}
function QuestionItem(props) {
  const desk = props.desk;
  const entry = props.entry;
  const recording = desk.recording;
  const handsFree = desk.handsFree;
  const wholeMarks = desk.wholeMarks;
  const takes = desk.answers.filter((answer) => answer.question_id === entry.id);
  const live = recording && recording.question === entry.id || handsFree && handsFree.question === entry.id;
  return h(
    "li",
    { className: "pp-dq" + (live ? " pp-dlive" : "") },
    h(
      "div",
      { className: "pp-dqtext" },
      h("b", null, entry.id + (entry.follows ? " ↳ " + entry.follows : "") + " "),
      entry.text
    ),
    h(
      "div",
      { className: "pp-dim" },
      [
        entry.kind === "opening" ? "opening" : entry.kind === "follow_up" ? "follow-up" : null,
        entry.criterion_id ? desk.criteria.get(entry.criterion_id) || entry.criterion_id : null,
        (entry.evidence || []).map((cite) => cite.path + (cite.lines ? ":" + cite.lines : "")).join(", ") || null
      ].filter(Boolean).join(" · "),
      entry.why ? h("div", null, entry.why) : null
    ),
    h(
      "div",
      { className: "pp-approverow" },
      handsFree && handsFree.question === entry.id ? h("span", { className: "pp-drec pp-dlivemark" }, "● being asked — hands-free") : recording && recording.question === "Q0" && entry.kind !== "whole" ? (
        // AGT-11: in a whole defence, say which prepared question you are asking.
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            "aria-pressed": wholeMarks.length > 0 && wholeMarks[wholeMarks.length - 1].question_id === entry.id,
            disabled: Boolean(recording.paused),
            onClick: () => desk.markQuestion(entry.id)
          },
          wholeMarks.some((mark) => mark.question_id === entry.id) ? "Asking this again" : "Asking this"
        )
      ) : live ? h(React.Fragment, null, h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop · " + clock(desk.elapsed)), speakButtonFor(desk)) : h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: Boolean(recording || desk.sending || handsFree || !desk.consented),
          onClick: () => desk.start(entry.id)
        },
        desk.sending === entry.id ? "Transcribing…" : takes.length ? "● Record again" : "● Record answer"
      ),
      takes.length ? h(
        "button",
        { type: "button", className: "pp-segbtn pp-chat", disabled: Boolean(recording || handsFree), onClick: () => desk.followUp(entry.id) },
        "Follow-up question"
      ) : null
    ),
    takes.map((answer) => h(TakeView, { key: answer.audio, desk, answer }))
  );
}

// client/defence-stage.js
function DefenceStage(props) {
  const desk = props.desk;
  const data = desk.data;
  const recording = desk.recording;
  const handsFree = desk.handsFree;
  const proposal = desk.proposal;
  const captions = desk.captions;
  const splitting = desk.splitting;
  const wholeMarks = desk.wholeMarks;
  const consented = desk.consented;
  const mode = desk.mode;
  const wholeRec = Boolean(recording && recording.question === "Q0");
  const stagePhase = proposal ? "proposing" : handsFree ? handsFree.phase : recording ? recording.paused ? "idle" : desk.professorTalking ? "professor" : desk.manualVoiced ? "speaking" : "waiting" : (
    // Transcribing a recording is the desk working, not waiting for a
    // voice: a microphone there read as "still listening".
    splitting || desk.sending ? "thinking" : "idle"
  );
  const stageQuestionId = handsFree && handsFree.question ? handsFree.question : recording ? recording.question : null;
  const bigLabel = !consented ? "Consent first" : proposal ? "Ask now" : stagePhase === "thinking" && handsFree ? "Choosing…" : stagePhase === "reading" ? "Reading aloud" : wholeRec ? recording.paused ? "Resume" : "Next question" : handsFree || recording ? "End answer" : desk.sending ? "Transcribing…" : splitting ? "Dividing…" : "● Start recording";
  const busy = Boolean(consented && !recording && !handsFree && !proposal && (desk.sending || splitting));
  const ready = Boolean(consented && !recording && !handsFree && !proposal && !busy);
  const waitingOn = Math.max(desk.pending || 0, desk.sending ? 1 : 0);
  const stageRow = () => {
    if (!consented) return null;
    if (wholeRec) {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
        recording.paused ? null : speakButtonFor(desk)
      );
    }
    if (handsFree && !proposal && handsFree.phase !== "thinking") {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
        speakButtonFor(desk)
      );
    }
    if (recording) return speakButtonFor(desk);
    if (handsFree || proposal || desk.sending || splitting) return null;
    return h(
      "span",
      { className: "pp-approverow", role: "group", "aria-label": "Mode" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "whole",
          title: "One recording of the whole conversation, transcribed as it goes; divided into its questions afterwards.",
          onClick: () => desk.chooseMode("whole")
        },
        "Whole defence"
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "questions",
          title: "Hands-free, one take per question: an answer ends after a pause, and the next question comes up by itself.",
          onClick: () => desk.chooseMode("questions")
        },
        "Question by question"
      )
    );
  };
  const questions = data && data.questions || [];
  const entry = stageQuestionId ? questions.find((q) => q.id === stageQuestionId) : null;
  const lastId = captions && captions.question;
  const last = lastId ? questions.find((q) => q.id === lastId) : null;
  const shown = entry || last;
  const pickedMark = wholeRec && wholeMarks.length ? wholeMarks[wholeMarks.length - 1] : null;
  const picked = pickedMark && pickedMark.question_id ? questions.find((q) => q.id === pickedMark.question_id) : null;
  const latestSplit = (data && data.splits || []).filter((entry2) => entry2.question_id === "Q0").slice(-1)[0] || null;
  const heading = wholeRec ? "The whole defence" + (recording.paused ? " · paused" : "") + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) + (picked ? " (" + picked.id + ")" : "") : "") : splitting ? "Dividing the defence into its questions…" : entry ? entry.id + (entry.follows ? " · follow-up on " + entry.follows : "") + (entry.criterion_id ? " · " + ((data.criteria || []).find((c) => c.id === entry.criterion_id) || {}).title : "") : shown ? shown.kind === "whole" ? "The whole defence, recorded" : shown.id + " answered" : consented ? "Ready" : "Before anything is recorded";
  const words = captions && (!stageQuestionId || captions.question === stageQuestionId) ? captions : null;
  const heardWords = words ? words.pieces.slice(words.from || 0).map((piece) => piece.text).join(" ").split(/\s+/).filter(Boolean) : [];
  const spoken = heardWords.length > 80 ? ["…"].concat(heardWords.slice(-80)) : heardWords;
  const live = stagePhase === "waiting" || stagePhase === "speaking" || stagePhase === "professor";
  const stale2 = Boolean(words && !recording && !handsFree);
  return h(
    "div",
    { className: "pp-stage" },
    h(
      "div",
      { className: "pp-stagefg" },
      h(
        "div",
        { className: "pp-stageq" },
        h("b", null, heading.replace(/ · undefined$/, "")),
        picked ? h("div", null, picked.text) : entry && entry.kind !== "whole" ? h("div", null, entry.text) : !consented ? h("div", null, "Open the drawer: the student agrees first.") : !recording && !handsFree && !shown ? h(
          "div",
          null,
          mode === "whole" ? "One recording of the whole defence, transcribed as you talk. Press Space at each new question; it is divided into its questions afterwards." : "Hands-free, one question at a time: an answer ends after a pause, and the next question comes up."
        ) : null
      ),
      busy ? h(
        "div",
        { className: "pp-stagebusy", role: "status" },
        h("span", { className: "pp-stagespin", "aria-hidden": "true" }),
        h(
          "span",
          null,
          h("b", null, splitting ? "Dividing the defence into its questions" : "Transcribing " + (waitingOn > 1 ? waitingOn + " recordings" : "the recording")),
          " — wait: the next recording can start once this is done."
        )
      ) : null,
      h(
        "button",
        {
          type: "button",
          className: "pp-stagebtn" + (live ? " pp-stagelive" : "") + (ready ? " pp-stagego" : "") + (busy ? " pp-stagewait" : ""),
          onClick: desk.bigPress,
          "aria-label": bigLabel,
          "aria-busy": busy || void 0,
          "aria-disabled": busy || void 0
        },
        h(ListeningDots, { phase: stagePhase, level: handsFree ? handsFree.level : desk.manualLevel, size: 130, className: "pp-stagedots", color: ready ? "#ffffff" : void 0 }),
        h("span", { className: "pp-stagebtnlabel" }, bigLabel + (recording ? " · " + clock(desk.elapsed) : ""))
      ),
      h("div", { className: "pp-approverow pp-stagerow" }, stageRow()),
      /*
       * A fixed few lines, the newest at the bottom: the box is anchored to
       * its foot and clips the top, fading it, so a long answer never pushes
       * the circle off the stage or the latest words below the fold. Every
       * word is still in the drawer and in the take's transcript.
       */
      h(
        "div",
        { className: "pp-stagetr" + (stale2 ? " pp-stagetrold" : "") + (heardWords.length > 30 ? " pp-stagetrlong" : ""), "aria-live": "polite" },
        words && (spoken.length || words.partial) ? h(
          "div",
          null,
          spoken.join(" "),
          words.partial ? h("span", { className: "pp-dpartial" }, " " + words.partial) : null
        ) : h(
          "span",
          { className: "pp-dpartial" },
          recording && recording.paused ? "Paused — nothing is recorded or sent until you resume." : live ? desk.liveCaptions ? wholeRec ? "Listening — what is said appears here as it is said." : "Listening — the student's words appear here as they speak." : "Live captions are off." : "The transcript appears here as the student speaks."
        )
      ),
      h(
        "div",
        { className: "pp-dim" },
        stagePhase === "professor" ? "You are speaking — not the answer" : handsFree && handsFree.phase === "speaking" && handsFree.silent ? "pause " + (handsFree.silent / 1e3).toFixed(1) + " s — the answer ends at 2.5 s" : splitting ? "The session's model is reading the dialogue, your presses as hints." : stagePhase === "thinking" ? "Transcribing and choosing what to ask next…" : proposal ? "The next question is waiting in the drawer" : wholeRec && live ? "Space: a new question · Hold P to speak · Asking this, in the drawer, names a prepared one" : live ? "Hold P to speak · Space ends the answer" : desk.sending ? "Transcribing the recording…" : !recording && !handsFree && latestSplit && mode === "whole" ? "Divided into " + latestSplit.parts.length + " question(s)" + (latestSplit.approval === "approved" ? ", checked" : " — check them in the drawer") : ""
      )
    ),
    h(
      "div",
      { className: "pp-drawer" },
      h(
        "div",
        { className: "pp-drawerhead" },
        h(
          "button",
          { type: "button", className: "pp-segbtn", "aria-expanded": desk.drawer, onClick: () => desk.setDrawer(!desk.drawer) },
          (desk.drawer ? "▾ " : "▴ ") + "Questions and controls"
        ),
        desk.pending > 0 ? h(
          "span",
          { className: "pp-dpending", role: "status" },
          h("span", { className: "pp-stagespin", "aria-hidden": "true" }),
          desk.pending === 1 ? "1 recording transcribing…" : desk.pending + " recordings transcribing…"
        ) : null
      ),
      desk.drawer ? h(
        "div",
        { className: "pp-drawerbody" },
        proposal ? h("div", { className: "pp-dhands" }, h(ProposalPanel, { desk })) : null,
        h(ConsentPanel, { desk }),
        h(ScreenRow, desk.screenProps),
        consented && !handsFree && !recording ? h(StartRow, { desk }) : null,
        h(GradeRow, { desk }),
        desk.said ? h("div", { className: desk.said.error ? "pp-dwarn" : "pp-dim" }, desk.said.text) : null,
        h("ol", { className: "pp-dlist" }, questions.map((entry2) => h(QuestionItem, { key: entry2.id, desk, entry: entry2 })))
      ) : null
    )
  );
}

// client/defence-turn.js
var TURN = { settleMs: 800, minSpeechMs: 400, silenceMs: 2500, capMs: 18e4, minThreshold: 0.012, ratio: 3 };
function turnStep(state, level, now, options) {
  const o = Object.assign({}, TURN, options || {});
  const s = state || {
    phase: "waiting",
    floor: Math.min(level, o.minThreshold),
    voicedSince: null,
    silentSince: null,
    startedAt: now
  };
  const threshold = Math.max(o.minThreshold, s.floor * o.ratio);
  const loud = level > threshold;
  const result = (next2, end) => ({
    state: next2,
    end,
    threshold,
    silentFor: next2.silentSince === null ? 0 : now - next2.silentSince
  });
  if (now - s.startedAt >= o.capMs) return result(s, "cap");
  if (now - s.startedAt < o.settleMs) return result(s, null);
  if (s.phase === "waiting") {
    if (!loud) {
      return result(Object.assign({}, s, { voicedSince: null, floor: s.floor * 0.95 + level * 0.05 }), null);
    }
    const voicedSince = s.voicedSince === null ? now : s.voicedSince;
    return now - voicedSince >= o.minSpeechMs ? result(Object.assign({}, s, { phase: "speaking", voicedSince, silentSince: null }), null) : result(Object.assign({}, s, { voicedSince }), null);
  }
  if (loud) return result(Object.assign({}, s, { silentSince: null }), null);
  const silentSince = s.silentSince === null ? now : s.silentSince;
  const next = Object.assign({}, s, { silentSince, floor: s.floor * 0.98 + level * 0.02 });
  return result(next, now - silentSince >= o.silenceMs ? "silence" : null);
}

// client/defence-desk.js
var RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
var PROPOSE_MS = 5e3;
var VOICE_HOLD_MS = 1500;
function useRememberedChoice(key, read) {
  const [value, setValue] = React.useState(() => {
    try {
      return read(window.localStorage.getItem(key));
    } catch {
      return read(null);
    }
  });
  const choose = (next) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
    }
  };
  return [value, choose];
}
function DefenceDesk(props) {
  const close = props.onClose;
  const [data, setData] = React.useState(null);
  const [recording, setRecording] = React.useState(null);
  const [sending, setSending] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [manualLevel, setManualLevel] = React.useState(0);
  const [manualVoiced, setManualVoiced] = React.useState(false);
  const [view, chooseView] = useRememberedChoice("professor-pane.defence-view", (stored) => stored || "stage");
  const [drawer, setDrawer] = React.useState(true);
  const [mode, chooseMode] = useRememberedChoice("professor-pane.defence-mode", (stored) => stored === "questions" ? "questions" : "whole");
  const whole = React.useRef({ started: null, marks: [], paused: null, pausedMs: 0 });
  const [wholeMarks, setWholeMarks] = React.useState([]);
  const [splitting, setSplitting] = React.useState(null);
  const [pending, setPending] = React.useState(0);
  const [handsFree, setHandsFree] = React.useState(null);
  const [proposal, setProposal] = React.useState(null);
  const proposalRef = React.useRef(null);
  proposalRef.current = proposal;
  const [chooser, setChooser] = React.useState(true);
  const [now, setNow] = React.useState(Date.now());
  const recorder = React.useRef(null);
  const loop = React.useRef(null);
  const dataRef = React.useRef(null);
  dataRef.current = data;
  const query = "?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessment) + "&student=" + encodeURIComponent(props.student);
  const endpoint = (path, extra) => scoped(BASE + path + query + (extra || ""), props.sessionId);
  const { marks, professorTalking, openMarks, closeMarks, speakDown, speakUp } = useProfessorMarks();
  const { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard } = useCaptions(endpoint, marks, whole);
  const { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen } = useStudentScreen(props, dataRef);
  const consented = !!(data && data.consent && data.consent.agreed && !data.consent.withdrawn_at);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const [consentBusy, setConsentBusy] = React.useState(false);
  const discard = React.useRef(false);
  const answerConsent = (action) => {
    setConsentBusy(true);
    return fetch(endpoint("/api/defence/consent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    }).then((response) => response.json()).then((result) => {
      if (result.error) setSaid({ error: true, text: result.error });
    }).catch((error) => setSaid({ error: true, text: String(error) })).then(() => {
      setConsentBusy(false);
      setTick((value) => value + 1);
    });
  };
  React.useEffect(() => {
    if (props.preparing) return void 0;
    let live = true;
    fetch(endpoint("/api/defence/session"), { cache: "no-store" }).then((response) => response.json()).then((value) => live && setData(value)).catch((error) => live && setData({ error: String(error) }));
    return () => {
      live = false;
    };
  }, [props.reload, tick, props.assessment, props.student, props.preparing]);
  const audioNow = () => {
    const current = whole.current;
    if (current.started === null) return 0;
    const now2 = Date.now();
    return (now2 - current.started - current.pausedMs - (current.paused !== null ? now2 - current.paused : 0)) / 1e3;
  };
  React.useEffect(() => {
    if (!recording) return void 0;
    const timer = setInterval(() => setElapsed(audioNow()), 250);
    return () => clearInterval(timer);
  }, [recording]);
  const busy = Boolean(recording || sending || handsFree || pending > 0);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);
  React.useEffect(() => () => {
    const held = recorder.current;
    if (held && held.state !== "inactive") held.stop();
    const running2 = loop.current;
    if (running2) {
      clearInterval(running2.timer);
      running2.stream.getTracks().forEach((track) => track.stop());
      if (running2.audio.state !== "closed") running2.audio.close();
      loop.current = null;
    }
  }, []);
  const upload = (questionId, blob, seconds, ranges, askedAt, pressed) => {
    const spoke = (ranges || []).map((range) => range[0].toFixed(1) + "-" + range[1].toFixed(1)).join(",");
    const marked = (pressed || []).map((mark) => mark.at.toFixed(1) + (mark.question_id ? ":" + mark.question_id : "")).join(",");
    setPending((count) => count + 1);
    let kept = null;
    return fetch(endpoint("/api/defence/answer", "&question=" + encodeURIComponent(questionId) + "&seconds=" + seconds.toFixed(1) + (spoke ? "&professor=" + spoke : "") + (marked ? "&marks=" + marked : "") + (askedAt ? "&asked=" + Math.round(askedAt) : "")), {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob
    }).then((response) => response.json()).then((result) => {
      if (result.error) setSaid({ error: true, text: questionId + ": " + result.error });
      else if (result.answer && result.answer.error) {
        setSaid({ error: true, text: questionId + " kept, not transcribed: " + result.answer.error });
      }
      kept = result.answer || null;
    }).catch((error) => setSaid({ error: true, text: questionId + ": " + String(error) })).then(() => {
      setPending((count) => count - 1);
      setTick((value) => value + 1);
      return kept;
    });
  };
  const split = (questionId, takeNumber, action) => {
    if (action !== "approve") setSplitting({ question: questionId, take: takeNumber });
    return fetch(endpoint("/api/defence/split"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionId, take: takeNumber, action: action || "split" })
    }).then((response) => response.json()).then((result) => {
      if (result.error) setSaid({ error: true, text: "Could not divide the defence: " + result.error });
      else if (!result.split) setSaid({ error: true, text: "The defence stays one piece: " + (result.notes || []).join("; ") });
      else if (action !== "approve") {
        const notes = result.notes || [];
        setSaid({
          error: notes.length > 0,
          text: "Divided into " + result.split.parts.length + " question(s) by " + result.split.by + (notes.length ? ": " + notes.join("; ") : ". Check them under the recording.")
        });
      }
    }).catch((error) => setSaid({ error: true, text: String(error) })).then(() => {
      setSplitting(null);
      setTick((value) => value + 1);
    });
  };
  const markQuestion = (questionId) => {
    const current = whole.current;
    if (!recording || recording.question !== "Q0" || current.paused !== null) return;
    const mark = questionId ? { at: audioNow(), question_id: questionId } : { at: audioNow() };
    current.marks = current.marks.concat([mark]);
    setWholeMarks(current.marks);
    setCaptions((value) => value ? Object.assign({}, value, { from: value.pieces.length }) : value);
    showOnScreen("Q0", "listening", false, questionId || null);
  };
  const pauseWhole = () => {
    const media = recorder.current;
    const current = whole.current;
    if (!media || media.state !== "recording" || current.paused !== null || typeof media.pause !== "function") return;
    speakUp();
    media.pause();
    current.paused = Date.now();
    setRecording((value) => value ? Object.assign({}, value, { paused: true }) : value);
    showOnScreen("Q0", "paused", false, lastPicked());
  };
  const resumeWhole = () => {
    const media = recorder.current;
    const current = whole.current;
    if (!media || media.state !== "paused" || current.paused === null) return;
    const gap = Date.now() - current.paused;
    current.pausedMs += gap;
    current.paused = null;
    if (marks.current.origin !== null) marks.current.origin += gap;
    media.resume();
    setRecording((value) => value ? Object.assign({}, value, { paused: false }) : value);
    showOnScreen("Q0", "listening", false, lastPicked());
  };
  const lastPicked = () => {
    const last = whole.current.marks[whole.current.marks.length - 1];
    return last && last.question_id ? last.question_id : null;
  };
  const start = (questionId) => {
    if (recording || sending || handsFree || !consented) return;
    setSaid(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setSaid({ error: true, text: "This browser cannot record here: the page has to be served over https or from localhost." });
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const media = new MediaRecorder(stream, type ? { mimeType: type } : void 0);
      let meter = null;
      try {
        const audio = new AudioContext();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let lastLoud = 0;
        meter = {
          audio,
          timer: setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
            const level = Math.sqrt(sum / samples.length);
            setManualLevel(level);
            const now2 = Date.now();
            if (level > 0.02) lastLoud = now2;
            setManualVoiced(now2 - lastLoud < VOICE_HOLD_MS);
            heard(level, 0.02);
          }, 150)
        };
      } catch {
        meter = null;
      }
      const chunks = [];
      const started = Date.now();
      media.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      media.onstop = () => {
        stopCaptions();
        stream.getTracks().forEach((track) => track.stop());
        if (meter) {
          clearInterval(meter.timer);
          if (meter.audio.state !== "closed") meter.audio.close();
        }
        setManualLevel(0);
        setManualVoiced(false);
        recorder.current = null;
        setRecording(null);
        showOnScreen(null, "idle");
        const blob = new Blob(chunks, { type: (media.mimeType || type || "audio/webm").split(";")[0] });
        if (discard.current) {
          discard.current = false;
          closeMarks();
          return;
        }
        const seconds = audioNow();
        const pressed = whole.current.marks;
        whole.current = { started: null, marks: [], paused: null, pausedMs: 0 };
        setWholeMarks([]);
        if (!blob.size) {
          setSaid({ error: true, text: "Nothing was recorded." });
          return;
        }
        setSending(questionId);
        upload(questionId, blob, seconds, closeMarks(), started, pressed).then((kept) => {
          setSending(null);
          if (kept && kept.question_id === "Q0" && kept.transcript && !kept.withdrawn) split(kept.question_id, kept.take);
        });
      };
      recorder.current = media;
      media.start(1e3);
      setElapsed(0);
      whole.current = { started, marks: [], paused: null, pausedMs: 0 };
      setWholeMarks([]);
      setRecording({ question: questionId, started, paused: false });
      openMarks(started);
      showOnScreen(questionId, "listening");
      startCaptions(stream, questionId, type);
    }).catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
  };
  const stop = () => {
    const media = recorder.current;
    if (media && media.state !== "inactive") media.stop();
  };
  const nextUnanswered = (after) => {
    const questions = dataRef.current && dataRef.current.questions || [];
    const answered = new Set((dataRef.current && dataRef.current.answers || []).map((answer) => answer.question_id));
    const asked = loop.current ? loop.current.asked : /* @__PURE__ */ new Set();
    const from = after ? questions.findIndex((entry) => entry.id === after) + 1 : 0;
    const ordered = questions.slice(from).concat(questions.slice(0, from));
    const found = ordered.find((entry) => entry.kind !== "whole" && !answered.has(entry.id) && !asked.has(entry.id));
    return found ? found.id : null;
  };
  const releaseMicrophone = (final) => {
    stopCaptions();
    showOnScreen(null, final === "done" ? "done" : "paused");
    const running2 = loop.current;
    if (!running2) return;
    clearInterval(running2.timer);
    running2.stream.getTracks().forEach((track) => track.stop());
    if (running2.audio && running2.audio.state !== "closed") running2.audio.close();
    loop.current = null;
    setHandsFree(null);
    setProposal(null);
  };
  const beginTake = (questionId) => {
    const running2 = loop.current;
    if (!running2) return;
    if (!questionId) {
      releaseMicrophone("done");
      setSaid({ error: false, text: "Every question has an answer. Follow-up questions, if you ask for them, appear below." });
      return;
    }
    running2.asked.add(questionId);
    const record = () => {
      if (loop.current !== running2 || running2.take) return;
      const media = new MediaRecorder(running2.stream, running2.type ? { mimeType: running2.type } : void 0);
      const chunks = [];
      media.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      running2.take = { question: questionId, media, chunks, started: Date.now(), turn: null, keep: true, spoke: false, shown: "listening" };
      startCaptions(running2.stream, questionId, running2.type);
      openMarks(running2.take.started);
      media.start(1e3);
      setHandsFree({ question: questionId, phase: "waiting", level: 0, threshold: 0 });
      showOnScreen(questionId, "listening");
    };
    if (readAloudRef.current && screen.current.ready) {
      setHandsFree({ question: questionId, phase: "reading", level: 0, threshold: 0 });
      const text = showOnScreen(questionId, "reading", true);
      const id = screen.current.said;
      const timer = setTimeout(() => {
        if (screen.current.waiting === id) record();
      }, Math.max(4e3, text.length * 90) + 2e3);
      screen.current.waiting = id;
      screen.current.onSpoken = (spoken) => {
        if (spoken !== id) return;
        clearTimeout(timer);
        screen.current.waiting = null;
        record();
      };
      return;
    }
    record();
  };
  const endTake = (how) => {
    const running2 = loop.current;
    const take = running2 && running2.take;
    if (!take || take.media.state === "inactive") return;
    running2.take = null;
    stopCaptions();
    const ranges = closeMarks();
    const keep = how !== "skip" && how !== "withdraw" && (take.spoke || how === "space");
    take.media.onstop = () => {
      const blob = new Blob(take.chunks, { type: (take.media.mimeType || running2.type || "audio/webm").split(";")[0] });
      const sent = keep && blob.size ? upload(take.question, blob, (Date.now() - take.started) / 1e3, ranges, take.started) : Promise.resolve();
      if (how === "pause" || how === "withdraw") releaseMicrophone();
      else if (running2.chooser && keep) {
        showOnScreen(null, "between");
        setHandsFree({ question: null, phase: "thinking", level: 0, threshold: 0 });
        sent.then(() => propose(take.question));
      } else beginTake(nextUnanswered(take.question));
    };
    take.media.stop();
  };
  const propose = (after) => {
    if (!loop.current) return;
    fetch(endpoint("/api/defence/next", "&after=" + encodeURIComponent(after)), { method: "POST" }).then((response) => response.json()).then((result) => {
      if (!loop.current) return;
      if (result.error) {
        setSaid({ error: true, text: "Could not choose the next question: " + result.error + " — moving to the next prepared one." });
        beginTake(nextUnanswered(after));
        return;
      }
      setTick((value) => value + 1);
      setHandsFree({ question: null, phase: "proposing", level: 0, threshold: 0 });
      setNow(Date.now());
      setProposal({ ...result, after, deadline: Date.now() + PROPOSE_MS, editing: null });
    }).catch((error) => {
      setSaid({ error: true, text: String(error) });
      if (loop.current) beginTake(nextUnanswered(after));
    });
  };
  const override = (kind, extra) => fetch(endpoint("/api/defence/override"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ index: proposalRef.current ? proposalRef.current.index : null, override: kind }, extra || {}))
  }).then((response) => response.json()).then((result) => {
    if (result.error) setSaid({ error: true, text: result.error });
    return result;
  });
  const settle = (how, text) => {
    const current = proposalRef.current;
    if (!current) return;
    setProposal(null);
    const question = current.question;
    if (how === "pause") {
      override("pause");
      releaseMicrophone();
      return;
    }
    if (how === "skip") {
      override("skip");
      if (question && loop.current) loop.current.asked.add(question.id);
      beginTake(nextUnanswered(current.after));
      return;
    }
    if (current.decision.action === "done" || !question) {
      if (how === "ask_now") override("ask_now");
      releaseMicrophone("done");
      const reason = current.decision.why || "nothing left to ask";
      setSaid({ error: false, text: "The desk thinks the defence is complete: " + reason + (/[.!?]$/.test(reason) ? "" : ".") });
      return;
    }
    if (how === "edit") {
      override("edit", { question: question.id, text }).then(() => {
        setTick((value) => value + 1);
        beginTake(question.id);
      });
      return;
    }
    if (how === "ask_now") override("ask_now");
    beginTake(question.id);
  };
  React.useEffect(() => {
    if (!proposal || proposal.editing !== null) return void 0;
    const timer = setInterval(() => {
      const current = proposalRef.current;
      if (!current || current.editing !== null) return;
      if (Date.now() >= current.deadline) settle("auto");
      else setNow(Date.now());
    }, 200);
    return () => clearInterval(timer);
  }, [proposal && proposal.index, proposal && proposal.editing !== null]);
  const startHandsFree = () => {
    if (recording || sending || loop.current || !consented) return;
    setSaid(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      setSaid({ error: true, text: "This browser cannot record here: the page has to be served over https or from localhost." });
      return;
    }
    const first = nextUnanswered(null);
    if (!first) {
      setSaid({ error: false, text: "Every question already has an answer." });
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((stream) => {
      const audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      loop.current = { stream, audio, analyser, samples, type, chooser, asked: /* @__PURE__ */ new Set(), take: null, timer: null };
      loop.current.timer = setInterval(() => {
        const running2 = loop.current;
        const take = running2 && running2.take;
        if (!take) return;
        running2.analyser.getFloatTimeDomainData(running2.samples);
        let sum = 0;
        for (let index = 0; index < running2.samples.length; index += 1) sum += running2.samples[index] * running2.samples[index];
        const level = Math.sqrt(sum / running2.samples.length);
        if (marks.current.held !== null) {
          take.resumed = true;
          setHandsFree({ question: take.question, phase: "professor", level, threshold: 0 });
          return;
        }
        if (take.resumed && take.turn) {
          take.turn = Object.assign({}, take.turn, { silentSince: null, voicedSince: null });
          take.resumed = false;
        }
        const step = turnStep(take.turn, level, Date.now());
        take.turn = step.state;
        if (step.state.phase === "speaking") take.spoke = true;
        heard(level, step.threshold);
        if (take.spoke && take.shown !== "hearing") {
          take.shown = "hearing";
          showOnScreen(take.question, "hearing");
        }
        setHandsFree({ question: take.question, phase: step.state.phase, level, threshold: step.threshold, silent: step.silentFor });
        if (step.end) endTake(step.end);
      }, 100);
      beginTake(first);
    }).catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
  };
  React.useEffect(() => {
    if (!handsFree) return void 0;
    const onKey = (event) => {
      if (event.code !== "Space" || /^(INPUT|TEXTAREA|BUTTON)$/.test(String(event.target && event.target.tagName))) return;
      event.preventDefault();
      endTake("space");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [Boolean(handsFree)]);
  React.useEffect(() => {
    if (!recording || recording.question !== "Q0" || recording.paused) return void 0;
    const onKey = (event) => {
      if (event.code !== "Space" || event.repeat || /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(String(event.target && event.target.tagName))) return;
      event.preventDefault();
      markQuestion(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording && recording.question, recording && recording.paused]);
  const followUp = (questionId) => props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — follow-up on " + questionId);
  const proposeGrade = () => props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — propose the grade");
  const withdraw = () => {
    setConfirmWithdraw(false);
    setProposal(null);
    const running2 = loop.current;
    if (running2 && running2.take) endTake("withdraw");
    else if (running2) releaseMicrophone();
    if (recorder.current && recorder.current.state !== "inactive") {
      discard.current = true;
      recorder.current.stop();
    }
    answerConsent("withdraw");
  };
  React.useEffect(() => {
    if (!data || data.error || consented || !screen.current.channel) return;
    const state = {
      type: "state",
      phase: data.consent && data.consent.withdrawn_at ? "stopped" : "consent",
      title: data.assessment && data.assessment.title || "",
      label: data.consent && data.consent.withdrawn_at ? "Recording stopped" : "Before we begin",
      text: data.consent && data.consent.withdrawn_at ? "You withdrew your agreement. Nothing more is recorded." : data.statement || ""
    };
    screen.current.last = state;
    screen.current.channel.postMessage(state);
  }, [data && data.statement, consented, data && data.consent && data.consent.withdrawn_at, screenState]);
  const assignVoice = (answer, voice) => fetch(endpoint("/api/defence/voices"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: answer.question_id, take: answer.take, voices: [voice] })
  }).then((response) => response.json()).then((result) => {
    if (result.error) setSaid({ error: true, text: result.error });
    setTick((value) => value + 1);
  });
  const recordWhole = () => fetch(endpoint("/api/defence/whole"), { method: "POST" }).then((response) => response.json()).then((result) => {
    if (result.error) {
      setSaid({ error: true, text: result.error });
      return;
    }
    setTick((value) => value + 1);
    start(result.question);
  });
  React.useEffect(() => {
    const channel = screen.current.channel;
    if (!channel || !captions) return;
    channel.postMessage({
      type: "caption",
      question: captions.question,
      text: captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
      partial: captions.partial || ""
    });
  }, [captions]);
  const recordingNow = Boolean(recording || handsFree && handsFree.phase !== "thinking" && handsFree.phase !== "proposing");
  React.useEffect(() => {
    if (recordingNow) setDrawer(false);
  }, [recordingNow]);
  React.useEffect(() => {
    if (proposal) setDrawer(true);
  }, [proposal && proposal.index]);
  const bigPress = () => {
    if (!data || data.error) return;
    if (!consented) {
      setDrawer(true);
      return;
    }
    if (proposal) return settle("ask_now");
    if (handsFree) {
      if (handsFree.phase === "waiting" || handsFree.phase === "speaking" || handsFree.phase === "professor") endTake("space");
      return;
    }
    if (recording) {
      if (recording.question !== "Q0") return stop();
      return recording.paused ? resumeWhole() : markQuestion(null);
    }
    if (sending || splitting) return;
    if (mode === "whole") return recordWhole();
    if (!data.questions.some((entry) => entry.kind !== "whole")) {
      setSaid({ error: true, text: "No prepared questions yet: Start defence drafts them, or take the defence whole." });
      setDrawer(true);
      return;
    }
    startHandsFree();
  };
  const where = data && data.transcription;
  const desk = {
    data,
    answers: data && data.answers || [],
    criteria: new Map((data && data.criteria || []).map((criterion) => [criterion.id, criterion.title])),
    consented,
    confirmWithdraw,
    setConfirmWithdraw,
    consentBusy,
    answerConsent,
    withdraw,
    recording,
    sending,
    elapsed,
    manualLevel,
    manualVoiced,
    handsFree,
    proposal,
    setProposal,
    now,
    settle,
    splitting,
    split,
    wholeMarks,
    captions,
    liveCaptions,
    setLiveCaptions,
    professorTalking,
    speakDown,
    speakUp,
    pending,
    said,
    mode,
    chooseMode,
    chooser,
    setChooser,
    drawer,
    setDrawer,
    screenProps: { screenState, readAloud, setReadAloud, onOpen: openScreen },
    endpoint,
    start,
    stop,
    markQuestion,
    pauseWhole,
    resumeWhole,
    recordWhole,
    startHandsFree,
    endTake,
    bigPress,
    followUp,
    proposeGrade,
    assignVoice
  };
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        }
      },
      h(
        "div",
        {
          className: "pp-modal pp-deskmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Defence desk",
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h(
            "div",
            { className: "pp-modaltitle" },
            "Defence · " + props.student + (data && data.assessment ? " · " + data.assessment.title : "")
          ),
          h(
            "span",
            { className: "pp-approverow", role: "group", "aria-label": "View" },
            h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "stage", onClick: () => chooseView("stage") }, "Stage"),
            h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "list", onClick: () => chooseView("list") }, "List")
          ),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×")
        ),
        view === "stage" && data && !data.error && (data.questions.length || mode === "whole") ? h("div", { className: "pp-publishbody pp-stagebody" }, h(DefenceStage, { desk })) : h(
          "div",
          { className: "pp-publishbody" },
          // Where the voice goes, said before anything is recorded.
          where ? h(
            "div",
            { className: where.error ? "pp-dwarn" : "pp-dim" },
            where.error ? (where.configured ? where.configured.name + " (" + where.configured.provider + " " + where.configured.model + ") cannot transcribe yet: " : "No transcription provider: ") + where.error + " Answers are still recorded and kept, and transcribed once it is fixed." : "Transcribed by " + where.name + " (" + where.provider + " " + where.model + ")" + (where.local ? ", on this machine." : ": the recording is sent to that provider.") + (typeof where.pricePerMinute === "number" ? " $" + where.pricePerMinute + "/min." : "")
          ) : null,
          data && data.pin ? h("div", { className: "pp-dim" }, "Code at " + String(data.pin.commit).slice(0, 7) + (data.pin.pinned_by === "submitted_at" ? ", as handed in." : ".")) : null,
          // Hands-free: one press starts it, and from then on the desk
          // listens, notices the end of each answer and moves on.
          data && !data.error && data.questions.length ? h(ScreenRow, desk.screenProps) : null,
          data && !data.error && data.questions.length ? h(ConsentPanel, { desk }) : null,
          data && !data.error && data.questions.length && consented ? handsFree ? h(HandsPanel, { desk }) : recording ? h(RecordingPanel, { desk }) : h(StartRow, { desk }) : null,
          data && !data.error ? h(GradeRow, { desk }) : null,
          said ? h("div", { className: said.error ? "pp-dwarn" : "pp-dim" }, said.text) : null,
          data === null ? h(
            "div",
            { className: "pp-dpending", role: "status" },
            h("span", { className: "pp-stagespin", "aria-hidden": "true" }),
            props.preparing ? "Setting up the defence for this student…" : "Opening the desk…"
          ) : data.error ? h("div", { className: "pp-dwarn" }, data.error) : !data.questions.length ? h("div", { className: "pp-dim" }, "No questions drafted yet — Start defence drafts them.") : h("ol", { className: "pp-dlist" }, data.questions.map((entry) => h(QuestionItem, { key: entry.id, desk, entry })))
        )
      )
    ),
    document.body
  );
}

// client/integration-parts.js
function Fact(props) {
  return h(
    "div",
    { className: "pp-fact" },
    h(
      "span",
      { className: "pp-factkey" },
      props.label,
      props.note ? h("span", { className: "pp-factnote" }, props.note) : null
    ),
    h(
      "span",
      { className: "pp-factval" + (props.missing ? " pp-factmissing" : "") },
      props.children
    )
  );
}
function Presence(props) {
  return props.present ? h("span", { className: "pp-yes" }, props.yes || "set") : h("span", { className: "pp-no" }, props.no || "not set");
}
function Secret(props) {
  const [value, setValue] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const status = props.status || {};
  const writable = status.writable !== false;
  const submit = () => {
    setPhase("saving");
    fetch(
      scoped(
        BASE + "/api/credentials?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: props.name, value })
      }
    ).then((response) => response.json()).then((body) => {
      setValue("");
      if (body.error) {
        setPhase("idle");
        if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
        return;
      }
      setPhase("idle");
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => {
      setValue("");
      setPhase("idle");
      if (props.onStatus) {
        props.onStatus({ error: String(error && error.message || error), from: props.name });
      }
    });
  };
  return h(
    "div",
    { className: "pp-secret" },
    h("span", { className: "pp-secretname" }, props.name),
    h("input", {
      className: "pp-secretbox",
      type: "password",
      // Browsers offer to remember anything they think is a login. This is
      // a machine credential and belongs in the harness's store, not in a
      // password manager keyed to a localhost URL.
      autoComplete: "off",
      spellCheck: false,
      disabled: !writable || phase === "saving",
      placeholder: status.configured ? "replace the stored value" : "paste the token",
      value,
      onChange: (event) => setValue(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter" && value.trim()) submit();
      }
    }),
    h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        disabled: !writable || phase === "saving" || !value.trim(),
        onClick: submit
      },
      phase === "saving" ? "Saving…" : "Save"
    ),
    status.configured && writable ? h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        disabled: phase === "saving",
        onClick: () => {
          setValue("");
          setPhase("saving");
          fetch(
            scoped(
              BASE + "/api/credentials?run=" + encodeURIComponent(props.runId || ""),
              props.sessionId
            ),
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ref: props.name, value: "" })
            }
          ).then((response) => response.json()).then((body) => {
            setPhase("idle");
            if (body.error) {
              if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
              return;
            }
            if (props.onSaved) props.onSaved(body);
          }).catch(() => setPhase("idle"));
        }
      },
      "Clear"
    ) : null
  );
}
function ReconnectGoogle(props) {
  const [waiting2, setWaiting] = React.useState(false);
  React.useEffect(() => {
    if (!waiting2) return void 0;
    const back = () => {
      setWaiting(false);
      if (props.onBack) props.onBack();
    };
    window.addEventListener("focus", back);
    return () => window.removeEventListener("focus", back);
  }, [waiting2]);
  return h(
    "a",
    {
      className: props.className || "pp-segbtn",
      href: BASE + "/api/google/start",
      target: "_blank",
      rel: "noopener",
      title: "Opens Google's sign-in in a new tab. Come back here when it says Google is connected.",
      onClick: () => setWaiting(true)
    },
    waiting2 ? "Finish in the new tab…" : props.label || "Reconnect Google"
  );
}
function GoogleConnect(props) {
  const google = props.google || {};
  const client = google.client || {};
  const [waiting2, setWaiting] = React.useState(false);
  const [phase, setPhase] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [note, setNote] = React.useState(null);
  React.useEffect(() => {
    if (!waiting2) return void 0;
    const back = () => {
      setWaiting(false);
      if (props.onChanged) props.onChanged();
    };
    window.addEventListener("focus", back);
    return () => window.removeEventListener("focus", back);
  }, [waiting2]);
  const disconnect = () => {
    setPhase("working");
    setError(null);
    setNote(null);
    fetch(BASE + "/api/google/disconnect", { method: "POST" }).then((response) => response.json()).then((body2) => {
      setPhase("idle");
      if (body2.error) {
        setError(body2.error);
        return;
      }
      setNote(body2.detail || "Disconnected. Google has been told to forget the sign-in.");
      if (props.onChanged) props.onChanged();
    }).catch((failure) => {
      setPhase("idle");
      setError(String(failure && failure.message || failure));
    });
  };
  const connectLink = (label) => h(
    "a",
    {
      className: "pp-segbtn",
      href: BASE + "/api/google/start",
      target: "_blank",
      rel: "noopener",
      title: "Opens Google's sign-in in a new tab. It comes back to this machine, not to any server.",
      onClick: () => {
        setError(null);
        setNote(null);
        setWaiting(true);
      }
    },
    label
  );
  let body;
  if (!client.present) {
    body = h(
      "p",
      { className: "pp-absent" },
      "Not set up on this machine yet. Download the Desktop app OAuth client from the Google Cloud console (Google Auth Platform → Clients) and save it as " + client.path + ". Then come back here."
    );
  } else if (client.error) {
    body = h("p", { className: "pp-saveerr" }, client.error);
  } else if (google.connected && google.expired) {
    body = h(
      "div",
      null,
      h(
        "div",
        { className: "pp-saverow" },
        connectLink("Reconnect Google"),
        h(
          "span",
          { className: "pp-saveerr", title: "Refused " + new Date(google.expired).toLocaleString() },
          "Google stopped accepting the sign-in" + (google.account ? " for " + google.account : "") + "."
        )
      ),
      // GAU-1: a consent screen in Testing ends every sign-in after 7 days.
      h(
        "p",
        { className: "pp-absent" },
        "If this happens every week, the app's consent screen in Google Cloud is still in Testing, where a sign-in lasts 7 days. Publishing it (Google Auth Platform → Audience → Publish app) makes it last."
      )
    );
  } else if (google.connected) {
    body = h(
      "div",
      { className: "pp-saverow" },
      h(Presence, { present: true, yes: google.account ? "connected as " + google.account : "connected" }),
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: phase === "working", onClick: disconnect },
        phase === "working" ? "Disconnecting…" : "Disconnect"
      ),
      connectLink("Switch account")
    );
  } else {
    body = h(
      "div",
      { className: "pp-saverow" },
      connectLink(google.broken ? "Reconnect Google" : "Connect Google"),
      waiting2 ? h("span", { className: "pp-savenote" }, "Finish the sign-in in the new tab, then come back here.") : google.broken ? h("span", { className: "pp-saveerr" }, "The saved sign-in is incomplete. Connecting again fixes it.") : null
    );
  }
  return h(
    "div",
    null,
    props.bare ? null : h("p", { className: "pp-factgroup" }, "Google"),
    // `compact`: the button and its outcome only, where the sentence around
    // it already says what connecting does.
    props.compact ? null : h(
      "p",
      { className: "pp-absent" },
      "Lets the grade-sheet syncs read and write the spreadsheets your Google account can edit. The sign-in is kept in the harness's credential store; grades go from Google to this machine with no server in between."
    ),
    body,
    error ? h("p", { className: "pp-saveerr" }, error) : null,
    note ? h("p", { className: "pp-savenote" }, note) : null
  );
}
var SETUP_FIELDS = {
  baseUrl: {
    label: "Address",
    type: "url",
    placeholder: "https://canvas.your-university.edu"
  },
  chatId: {
    label: "Channel",
    type: "text",
    placeholder: "@course_channel, or the numeric id"
  },
  sheetId: {
    label: "Spreadsheet",
    type: "text",
    placeholder: "the URL, or the id between /d/ and /edit"
  },
  token: {
    label: "Access token",
    type: "password",
    placeholder: "paste the token"
  }
};
var TOKEN_HINT = {
  canvas: "Canvas → Account → Settings → New Access Token",
  telegram: "the token @BotFather gave you when the bot was created",
  moodle: "Moodle → Preferences → Security keys",
  sheets: "an access token, or leave empty and use a service-account key",
  github: "GitHub → Settings → Developer settings → Personal access tokens"
};
function ProviderSetup(props) {
  const spec = props.integration;
  const [values, setValues] = React.useState({});
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const set2 = (key, value) => setValues(Object.assign({}, values, { [key]: value }));
  const required = (spec.fields || []).filter((field) => field !== "token");
  const ready = required.every((field) => String(values[field] || "").trim());
  const submit = () => {
    setPhase("saving");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/integrations/setup?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign({ provider: spec.id }, values))
      }
    ).then((response) => response.json()).then((body) => {
      setValues(Object.assign({}, values, { token: "" }));
      setPhase("idle");
      if (body.error) {
        setFailed(body.error);
        return;
      }
      setValues({});
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => {
      setValues(Object.assign({}, values, { token: "" }));
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  return h(
    "div",
    { className: "pp-setup" },
    (spec.fields || []).map((field) => {
      const meta = SETUP_FIELDS[field];
      if (!meta) return null;
      return h(
        "div",
        { className: "pp-field", key: field },
        h(
          "span",
          { className: "pp-fieldlabel" },
          field === "token" ? meta.label + " — " + (TOKEN_HINT[spec.id] || "") : meta.label
        ),
        h("input", {
          className: "pp-fieldbox",
          type: meta.type,
          autoComplete: "off",
          spellCheck: false,
          placeholder: meta.placeholder,
          value: values[field] || "",
          disabled: phase === "saving",
          onChange: (event) => set2(field, event.target.value)
        })
      );
    }),
    h(
      "p",
      { className: "pp-absent" },
      "Everything but the token is saved outside this repository, in the connections registry or the run record. The token goes to the harness's credential store and is never shown again."
    ),
    h(
      "div",
      { className: "pp-saverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving" || !ready,
          onClick: submit
        },
        phase === "saving" ? "Saving and checking…" : "Save and check"
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving",
          onClick: () => {
            setValues({});
            setFailed(null);
            if (props.onCancel) props.onCancel();
          }
        },
        "Cancel"
      )
    ),
    failed ? h("p", { className: "pp-saveerr" }, failed) : null
  );
}
var normaliseTitle = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, " ").trim();
var suggestPairs = (assessments, assignments) => {
  const taken = /* @__PURE__ */ new Set();
  const picks = {};
  const claim = (assessmentId, assignment) => {
    if (!assignment || taken.has(assignment.id)) return false;
    picks[assessmentId] = assignment.id;
    taken.add(assignment.id);
    return true;
  };
  const left = assessments.filter((entry) => {
    const wanted = normaliseTitle(entry.title);
    return !claim(
      entry.assessmentId,
      assignments.find((a) => !taken.has(a.id) && normaliseTitle(a.name) === wanted)
    );
  });
  const stillLeft = left.filter((entry) => {
    const wanted = normaliseTitle(entry.title);
    if (!wanted) return true;
    return !claim(
      entry.assessmentId,
      assignments.find((a) => {
        if (taken.has(a.id)) return false;
        const other = normaliseTitle(a.name);
        return other && (other.includes(wanted) || wanted.includes(other));
      })
    );
  });
  for (const entry of stillLeft) {
    if (entry.maximumScore === null || entry.maximumScore === void 0) continue;
    const sameScore = assignments.filter(
      (a) => !taken.has(a.id) && a.points !== null && Math.abs(a.points - entry.maximumScore) < 0.01
    );
    if (sameScore.length === 1) claim(entry.assessmentId, sameScore[0]);
  }
  return picks;
};
function AssignmentBinder(props) {
  const subgroups = (props.subgroups || []).map((entry) => entry.group);
  const perSubgroup = subgroups.length > 0 && props.courseMap;
  const [group, setGroup] = React.useState(perSubgroup ? subgroups[0] : null);
  const [assignments, setAssignments] = React.useState(null);
  const [picks, setPicks] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const assessments = props.assessments || [];
  const courseId = perSubgroup ? (props.courseMap || {})[group] : props.singleCourseId;
  const recorded = {};
  for (const entry of assessments) {
    const existing = perSubgroup ? (entry.canvasAssignments || {})[group] : entry.canvasAssignmentId;
    if (existing) recorded[entry.assessmentId] = existing;
  }
  const chosen = picks || recorded;
  const load = () => {
    if (!courseId) {
      setFailed(
        perSubgroup ? `${group} has no Canvas course bound yet — bind it above first.` : "This run has no Canvas course recorded yet."
      );
      return;
    }
    setPhase("fetching");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/assignments?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId })
      }
    ).then((response) => response.json()).then((body) => {
      setPhase("idle");
      if (body.error) {
        setFailed(body.error);
        return;
      }
      setAssignments(body.assignments || []);
      const suggested = suggestPairs(
        assessments.filter((entry) => !recorded[entry.assessmentId]),
        (body.assignments || []).filter((a) => !Object.values(recorded).includes(a.id))
      );
      setPicks(Object.assign({}, recorded, suggested));
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  const save = () => {
    setPhase("saving");
    setFailed(null);
    const links = {};
    for (const entry of assessments) {
      const picked = chosen[entry.assessmentId];
      if (perSubgroup) {
        const merged = Object.assign({}, entry.canvasAssignments || {});
        if (picked) merged[group] = picked;
        else delete merged[group];
        links[entry.assessmentId] = Object.keys(merged).length ? merged : null;
      } else {
        links[entry.assessmentId] = picked || null;
      }
    }
    fetch(
      scoped(
        BASE + "/api/canvas/assignment-map?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ links })
      }
    ).then((response) => response.json()).then((body) => {
      setPhase("idle");
      if (body.error) {
        setFailed(body.error);
        return;
      }
      setPicks(null);
      setAssignments(null);
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  const options = assignments || [];
  const bound = assessments.filter((entry) => chosen[entry.assessmentId]).length;
  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "Assessments and their Canvas assignments"),
    perSubgroup ? h(
      "div",
      { className: "pp-bind" },
      h("span", { className: "pp-bindname" }, "Subgroup"),
      h(
        "select",
        {
          className: "pp-bindsel",
          value: group || "",
          onChange: (event) => {
            setGroup(event.target.value);
            setAssignments(null);
            setPicks(null);
            setFailed(null);
          }
        },
        subgroups.map(
          (name) => h(
            "option",
            { value: name, key: name },
            name + ((props.courseMap || {})[name] ? "" : " — no Canvas course")
          )
        )
      )
    ) : null,
    h(
      "div",
      { className: "pp-saverow-top" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase !== "idle",
          onClick: load
        },
        phase === "fetching" ? "Asking Canvas…" : "Fetch assignments and suggest pairs"
      ),
      options.length ? h(
        "span",
        { className: "pp-savenote" },
        " " + bound + " of " + assessments.length + " paired"
      ) : null
    ),
    options.length ? assessments.map(
      (entry) => h(
        "div",
        { className: "pp-bind", key: entry.assessmentId },
        h(
          "span",
          { className: "pp-bindname" },
          entry.title || entry.assessmentId,
          h(
            "span",
            { className: "pp-intwhat" },
            entry.assessmentId + (entry.maximumScore === null || entry.maximumScore === void 0 ? "" : " · out of " + entry.maximumScore)
          )
        ),
        h(
          "select",
          {
            className: "pp-bindsel",
            value: chosen[entry.assessmentId] || "",
            onChange: (event) => setPicks(
              Object.assign({}, chosen, {
                [entry.assessmentId]: event.target.value
              })
            )
          },
          h("option", { value: "" }, "— not linked —"),
          options.map(
            (assignment) => h(
              "option",
              { value: assignment.id, key: assignment.id },
              assignment.name + (assignment.points === null ? "" : " · " + assignment.points) + " (" + assignment.id + ")"
            )
          )
        )
      )
    ) : null,
    options.length ? h(
      "div",
      { className: "pp-saverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase !== "idle",
          onClick: save
        },
        phase === "saving" ? "Saving…" : "Save these pairings"
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase !== "idle",
          onClick: () => setPicks(null)
        },
        "Revert"
      ),
      h(
        "span",
        { className: "pp-savenote" },
        " Suggestions are a guess from the titles and the marks. Check them."
      )
    ) : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null
  );
}
function IntegrationStatus(props) {
  const [opened2, setOpened] = React.useState(null);
  const rows = props.integrations || [];
  if (!rows.length) {
    return h("p", { className: "pp-absent" }, "Nothing to report about this run yet.");
  }
  const label = { ready: "ready", partial: "partly set up", absent: "not set up" };
  return h(
    "div",
    null,
    rows.map(
      (row) => h(
        "div",
        { className: "pp-int", key: row.id },
        h(
          "div",
          { className: "pp-inthead" },
          h(
            "span",
            { className: "pp-intname" },
            row.label,
            h("span", { className: "pp-intwhat" }, row.what)
          ),
          h("span", { className: "pp-state pp-state-" + row.state }, label[row.state])
        ),
        // A finished one says so and stops. Its steps are all ticks, and
        // four ticks is a wall to read past on the way to the one row
        // that still needs something.
        row.state === "ready" ? null : h(
          "ul",
          { className: "pp-steps" },
          row.steps.map(
            (entry, index) => h(
              "li",
              {
                className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"),
                key: index
              },
              h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
              h(
                "span",
                null,
                entry.label,
                entry.done ? null : h("span", { className: "pp-stephint" }, " — " + entry.hint)
              )
            )
          )
        ),
        row.canPushGrades === false && row.state !== "absent" ? h(
          "p",
          { className: "pp-absent" },
          "Grades cannot be pushed here — nothing in this workspace has a " + row.label + " gradebook target. It publishes content."
        ) : null,
        opened2 === row.id ? h(
          "div",
          null,
          // The steps still to do, in order, and only those. A
          // professor who has already saved a host and a token should
          // not have to scroll past the form asking for them again to
          // reach the pairing that is actually missing.
          row.steps[0].done && row.steps[1].done ? null : h(ProviderSetup, {
            integration: row,
            runId: props.runId,
            sessionId: props.sessionId,
            onCancel: () => setOpened(null),
            onSaved: (body) => {
              if (props.onSaved) props.onSaved(body);
            }
          }),
          row.id === "canvas" && row.steps[1].done && !row.steps[2].done ? h(SubgroupCourses, {
            runId: props.runId,
            sessionId: props.sessionId,
            subgroups: props.data.subgroups || [],
            state: props.data.subgroupCourses || {
              map: {},
              perSubgroup: false,
              conflict: false
            },
            onSaved: (body) => {
              if (props.onSaved) props.onSaved(body);
            }
          }) : null,
          // Only once there is a course to ask about. Fetching a
          // course's assignments needs the course, and offering the
          // binder before that is offering a button that can only
          // fail.
          row.id === "canvas" && row.steps[1].done && row.steps[2].done && !row.steps[3].done ? h(AssignmentBinder, {
            runId: props.runId,
            sessionId: props.sessionId,
            subgroups: props.data.subgroups || [],
            courseMap: (props.data.subgroupCourses || {}).perSubgroup ? (props.data.subgroupCourses || {}).map : null,
            singleCourseId: (props.data.canvasCourse || {}).id,
            assessments: props.data.assessments || [],
            onSaved: (body) => {
              if (props.onSaved) props.onSaved(body);
            }
          }) : null,
          h(
            "div",
            { className: "pp-saverow" },
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                onClick: () => setOpened(null)
              },
              "Done for now"
            )
          )
        ) : row.state === "ready" ? null : h(
          "div",
          { className: "pp-saverow-top" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              onClick: () => setOpened(row.id)
            },
            // Named by what is left rather than by the provider, so
            // a half-finished Canvas offers "Continue" and does not
            // look like it is asking to start over.
            (row.state === "absent" ? "Configure " : "Continue setting up ") + row.label
          )
        )
      )
    ),
    props.setup && props.setup.answered ? h(
      "p",
      { className: "pp-ok" },
      props.setup.provider + " answered as " + props.setup.answered + (props.setup.tokenSaved ? ". The token is stored." : ".")
    ) : null,
    props.setup && props.setup.checkFailed ? h("p", { className: "pp-saveerr" }, props.setup.checkFailed) : null
  );
}
function SubgroupCourses(props) {
  const [catalogue, setCatalogue] = React.useState(null);
  const [fetching, setFetching] = React.useState(false);
  const [picked, setPicked] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const subgroups = props.subgroups || [];
  const current = props.state.map || {};
  const chosen = picked || current;
  if (!subgroups.length) return null;
  const load = () => {
    setFetching(true);
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/courses?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      { method: "POST" }
    ).then((response) => response.json()).then((body) => {
      setFetching(false);
      if (body.error) {
        setFailed(body.error);
        return;
      }
      setCatalogue(body.courses || []);
    }).catch((error) => {
      setFetching(false);
      setFailed(String(error && error.message || error));
    });
  };
  const save = () => {
    setPhase("saving");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/course-map?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapping: chosen })
      }
    ).then((response) => response.json()).then((body) => {
      setPhase("idle");
      if (body.error) {
        setFailed(body.error);
        return;
      }
      setPicked(null);
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  const options = catalogue || [];
  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "A Canvas course per subgroup"),
    props.state.conflict ? h(
      "p",
      { className: "pp-saveerr" },
      "This run also sets a single Canvas course id (" + props.state.singleId + "). A record cannot hold both — clear that one before binding subgroups."
    ) : null,
    h(
      "p",
      { className: "pp-absent" },
      options.length ? "Bind each subgroup to the Canvas course it is taught in. A push then runs once per subgroup and carries only that subgroup's students." : "If each subgroup has its own Canvas course, fetch your courses and bind them here. Leave this alone when the whole run is one Canvas course."
    ),
    h(
      "div",
      { className: "pp-saverow-top" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: fetching,
          onClick: load
        },
        fetching ? "Asking Canvas…" : "Fetch my Canvas courses"
      )
    ),
    subgroups.map(
      (entry) => h(
        "div",
        { className: "pp-bind", key: entry.group },
        h("span", { className: "pp-bindname" }, entry.group),
        options.length ? h(
          "select",
          {
            className: "pp-bindsel",
            value: chosen[entry.group] || "",
            onChange: (event) => setPicked(
              Object.assign({}, chosen, { [entry.group]: event.target.value })
            )
          },
          h("option", { value: "" }, "— not bound —"),
          options.map(
            (course) => h(
              "option",
              { value: course.id, key: course.id },
              course.name + " (" + course.id + ")"
            )
          )
        ) : h(
          "span",
          { className: chosen[entry.group] ? null : "pp-absent" },
          chosen[entry.group] || "not bound"
        )
      )
    ),
    options.length ? h(
      "div",
      { className: "pp-saverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving",
          onClick: save
        },
        phase === "saving" ? "Saving…" : "Save to the run record"
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving",
          onClick: () => setPicked(null)
        },
        "Revert"
      )
    ) : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null
  );
}

// client/data.js
var versions = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
var bump = (areas) => {
  if (!areas.length) return;
  for (const area of new Set(areas)) versions.set(area, (versions.get(area) ?? 0) + 1);
  versions.set("*", (versions.get("*") ?? 0) + 1);
  for (const listener of listeners) listener();
};
var versionOf = (areas) => {
  if (areas.includes("*")) return versions.get("*") ?? 0;
  let sum = 0;
  for (const area of areas) sum += versions.get(area) ?? 0;
  return sum;
};
var subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function useVersion(areas) {
  const key = areas.join(",");
  const read = React.useCallback(() => versionOf(key.split(",")), [key]);
  return React.useSyncExternalStore(subscribe, read, read);
}
var POLL_MS = 2500;
var watchers = /* @__PURE__ */ new Map();
var watcherFor = (sessionId) => {
  if (watchers.has(sessionId)) return watchers.get(sessionId);
  const url = scoped(BASE + "/api/revision", sessionId);
  const watcher = { users: 0, seen: null, timer: null, inflight: null };
  watcher.check = (fresh = false) => {
    if (watcher.inflight && !fresh) return watcher.inflight;
    const asked = fetch(url + (fresh ? "&fresh=1" : ""), { headers: { accept: "application/json" } }).then((response) => response.json()).then((value) => {
      if (!value || typeof value.revision !== "string") return;
      const before = watcher.seen;
      watcher.seen = value;
      if (before === null || before.revision === value.revision) return;
      if (!value.areas || !before.areas) return bump(["*"]);
      const moved = [];
      for (const area of /* @__PURE__ */ new Set([...Object.keys(before.areas), ...Object.keys(value.areas)])) {
        if (before.areas[area] !== value.areas[area]) moved.push(area);
      }
      bump(moved.length ? moved : ["*"]);
    }).catch(() => {
    }).finally(() => {
      if (watcher.inflight === asked) watcher.inflight = null;
    });
    watcher.inflight = asked;
    return asked;
  };
  const start = () => {
    if (watcher.timer === null) watcher.timer = setInterval(() => watcher.check(), POLL_MS);
  };
  const stop = () => {
    if (watcher.timer !== null) clearInterval(watcher.timer);
    watcher.timer = null;
  };
  watcher.onVisibility = () => {
    if (document.visibilityState === "visible") {
      watcher.check();
      start();
    } else {
      stop();
    }
  };
  watcher.mount = () => {
    watcher.users += 1;
    if (watcher.users === 1) {
      watcher.onVisibility();
      document.addEventListener("visibilitychange", watcher.onVisibility);
    }
  };
  watcher.unmount = () => {
    watcher.users -= 1;
    if (watcher.users > 0) return;
    stop();
    document.removeEventListener("visibilitychange", watcher.onVisibility);
    watchers.delete(sessionId);
  };
  watchers.set(sessionId, watcher);
  return watcher;
};
function watchSession(sessionId) {
  const watcher = watcherFor(sessionId);
  watcher.mount();
  return () => watcher.unmount();
}
function useWorkspaceWatch(sessionId) {
  React.useEffect(() => sessionId ? watchSession(sessionId) : void 0, [sessionId]);
}
function wrote(sessionId, tags = []) {
  bump(tags);
  const watcher = sessionId ? watchers.get(sessionId) : null;
  if (watcher) return watcher.check(true);
  bump(["*"]);
  return Promise.resolve();
}
var AREAS = {
  everything: ["*"],
  integrations: ["integrations", "version", "course", "assessments", "canvas"],
  syncs: ["syncs", "records", "assessments", "integrations", "canvas"],
  marks: ["records", "assessments", "syncs", "integrations", "grading", "canvas"],
  grading: ["grading", "version", "assessments", "records"],
  files: ["files", "scans", "defence", "records"],
  scans: ["scans", "files", "records", "assessments"],
  grade: ["records", "assessments", "items", "grading", "canvas"]
};

// client/canvas-check.js
var FRESH_MS = 5 * 60 * 1e3;
var LOOK_MS = 60 * 1e3;
var runs = /* @__PURE__ */ new Map();
var listeners2 = /* @__PURE__ */ new Map();
var LOADING = { phase: "loading", value: null };
var entryFor = (runId) => runs.get(runId) || LOADING;
var set = (runId, next) => {
  runs.set(runId, Object.assign({}, entryFor(runId), next));
  for (const listener of listeners2.get(runId) || []) listener();
};
var urlFor = (runId, sessionId) => scoped(BASE + "/api/canvas/check?run=" + encodeURIComponent(runId), sessionId);
var stale = (answer) => !answer || answer.state !== "ready" || !answer.at || Date.now() - Date.parse(answer.at) > FRESH_MS;
var run = (runId, sessionId) => {
  const entry = entryFor(runId);
  if (entry.phase === "running") return;
  set(runId, { phase: "running" });
  fetch(urlFor(runId, sessionId), { method: "POST", headers: { accept: "application/json" } }).then((response) => response.json()).then((answer) => {
    set(runId, { phase: "ready", value: answer });
    wrote(sessionId, ["canvas"]);
  }).catch((error) => set(runId, { phase: "ready", value: { error: String(error) } }));
};
var refresh = (runId, sessionId) => {
  const entry = entryFor(runId);
  if (entry.phase === "running") return;
  if (entry.phase === "ready" && entry.value && !entry.value.error) {
    if (stale(entry.value)) run(runId, sessionId);
    return;
  }
  fetch(urlFor(runId, sessionId), { headers: { accept: "application/json" } }).then((response) => response.json()).then((answer) => {
    if (entryFor(runId).phase === "running") return void 0;
    if (answer.state === "running") return run(runId, sessionId);
    set(runId, { phase: "ready", value: answer });
    if (stale(answer)) run(runId, sessionId);
  }).catch(() => run(runId, sessionId));
};
var opened = /* @__PURE__ */ new Set();
var open = (runId, sessionId) => {
  if (opened.has(runId)) return false;
  opened.add(runId);
  run(runId, sessionId);
  return true;
};
function useCanvasWatch(runId, sessionId, runIds = []) {
  const all = runIds.join("\n");
  React.useEffect(() => {
    for (const id of all ? all.split("\n") : []) open(id, sessionId);
  }, [all, sessionId]);
  React.useEffect(() => {
    if (!runId) return void 0;
    const look = () => document.visibilityState === "visible" && refresh(runId, sessionId);
    if (!open(runId, sessionId)) look();
    const timer = setInterval(look, LOOK_MS);
    document.addEventListener("visibilitychange", look);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, [runId, sessionId]);
}
function useCanvasCheck(runId, sessionId) {
  const subscribe2 = React.useCallback(
    (listener) => {
      if (!runId) return () => {
      };
      if (!listeners2.has(runId)) listeners2.set(runId, /* @__PURE__ */ new Set());
      listeners2.get(runId).add(listener);
      return () => listeners2.get(runId).delete(listener);
    },
    [runId]
  );
  const read = React.useCallback(() => runId ? entryFor(runId) : LOADING, [runId]);
  const state = React.useSyncExternalStore(subscribe2, read, read);
  React.useEffect(() => {
    if (runId) refresh(runId, sessionId);
  }, [runId, sessionId]);
  const again = React.useCallback(() => runId && run(runId, sessionId), [runId, sessionId]);
  return [state, again];
}

// client/common.js
function useJson(url) {
  const [state, setState] = React.useState({ phase: "loading" });
  React.useEffect(() => {
    if (url === null) return void 0;
    let live = true;
    setState({ phase: "loading" });
    fetch(url, { headers: { accept: "application/json" } }).then((response) => response.json()).then((value) => {
      if (live) setState({ phase: "ready", value });
    }).catch((error) => {
      if (live) setState({ phase: "ready", value: { error: String(error.message || error) } });
    });
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
function decodeIssues(raw) {
  if (!raw) return [];
  try {
    return decodeURIComponent(raw).split(" | ").filter(Boolean);
  } catch {
    return [];
  }
}
function useDark() {
  const read = () => typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme");
  const [dark, setDark] = React.useState(read);
  React.useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
function Message(props) {
  return h("div", { className: "pp-msg" + (props.error ? " pp-err" : "") }, props.children);
}

// client/syncs.js
var shortWhy = (why) => {
  const text = String(why || "");
  if (/close spelling/.test(text)) return "close spelling";
  if (/only one word/.test(text)) return "only one word";
  const several = /matches (\d+) enrolled/.exec(text);
  if (several) return "fits " + several[1] + " students";
  if (/not enrolled/.test(text)) return "not enrolled";
  if (/closely enough|matches no enrolled/.test(text)) return "no close match";
  if (/no name/.test(text)) return "no name";
  return text.split(/[—;:]/)[0].trim();
};
var DIRECTION_PATHS = {
  source: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 3v12", "M8 11l4 4l4 -4"],
  target: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 15v-12", "M8 7l4 -4l4 4"],
  both: ["M7 10h14l-4 -4", "M17 14h-14l4 4"]
};
var DIRECTION_WORDS = { source: "Coming in", target: "Going out", both: "Both ways" };
function DirectionIcon(props) {
  const size2 = props.size || 14;
  return h(
    "svg",
    {
      className: "pp-diricon",
      width: size2,
      height: size2,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    (DIRECTION_PATHS[props.role] || DIRECTION_PATHS.both).map((d) => h("path", { d, key: d }))
  );
}
function DirectionBadge(props) {
  return h(
    "span",
    { className: "pp-dir pp-dir-" + props.role + (props.small ? " pp-dir-small" : ""), title: DIRECTION_WORDS[props.role] },
    h(DirectionIcon, { role: props.role, size: props.small ? 11 : 14 })
  );
}
var SERVICE = {
  canvas: { mark: "Cv", name: "Canvas" },
  sheets: { mark: "GS", name: "Google Sheets" },
  telegram: { mark: "Tg", name: "Telegram" },
  github: { mark: "GH", name: "GitHub" },
  moodle: { mark: "Md", name: "Moodle" },
  file: { mark: "F", name: "File" }
};
var columnLetter = (index) => {
  let letters = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }
  return letters;
};
var when = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const clock2 = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = (date2) => new Date(date2.getFullYear(), date2.getMonth(), date2.getDate()).getTime();
  const days = Math.round((day(/* @__PURE__ */ new Date()) - day(at)) / 864e5);
  if (days <= 0) return "today " + clock2;
  if (days === 1) return "yesterday " + clock2;
  const date = at.toLocaleDateString([], { day: "numeric", month: "short" });
  return days < 14 ? days + " days ago · " + date : date;
};
var initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
function SheetPreview(props) {
  const preview = props.preview;
  const width = Math.max(preview.header.length, ...preview.rows.map((row) => row.cells.length));
  const marks = new Set(preview.markColumns);
  const cell = (value, index, extra) => h(
    "td",
    {
      key: index,
      className: "pp-sheetcell" + (index === preview.nameColumn ? " pp-sheetname" : "") + (marks.has(index) ? " pp-sheetmark" : "") + (extra || ""),
      title: value || ""
    },
    value || ""
  );
  return h(
    "div",
    { className: "pp-sheetwrap" },
    h(
      "table",
      { className: "pp-sheet" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { className: "pp-sheetcorner" }),
          Array.from({ length: width }, (_, index) => h("th", { key: index }, columnLetter(preview.firstColumn + index)))
        )
      ),
      h(
        "tbody",
        null,
        h(
          "tr",
          { className: "pp-sheethead" },
          h("th", { className: "pp-sheetline" }, ""),
          Array.from({ length: width }, (_, index) => cell(preview.header[index], index))
        ),
        preview.rows.map(
          (row) => h(
            "tr",
            { key: row.line, className: row.line === props.line ? "pp-sheetlit" : "" },
            h("th", { className: "pp-sheetline" }, row.line),
            Array.from({ length: width }, (_, index) => cell(row.cells[index], index))
          )
        )
      )
    )
  );
}
var syncPost = (runId, sessionId, path, body) => fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId || ""), sessionId), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
}).then((response) => response.json()).catch((error) => ({ error: String(error.message || error) }));
function SyncCard(props) {
  const sync = props.sync;
  const [result, setResult] = React.useState(null);
  const [picked, setPicked] = React.useState("");
  const [reading, setReading] = React.useState(null);
  const [previewed, setPreviewed] = React.useState(false);
  const [busy, setBusy] = React.useState(null);
  const [dropping, setDropping] = React.useState(false);
  const service = SERVICE[sync.service] || { mark: sync.service.slice(0, 2), name: sync.service };
  const needsAssessment = sync.needs === "assessment";
  const assessment = props.assessment || picked;
  const ready = !needsAssessment || Boolean(assessment);
  const check = props.check || null;
  const done = () => {
    if (props.onDone) props.onDone();
  };
  const from = reading || (sync.canReadLive ? "live" : "export");
  const press2 = (action, confirm) => {
    setBusy(action);
    syncPost(props.runId, props.sessionId, "/api/syncs/action", {
      action,
      sync: sync.id,
      assessment: assessment || "",
      from: sync.exported && from === "export" ? "export" : "live",
      confirm: Boolean(confirm),
      names: Boolean(props.names)
    }).then((answer) => {
      setBusy(null);
      setResult(Object.assign({ action }, answer));
      setPreviewed(action === "plan" && !answer.error && Boolean(answer.ok));
      done();
    });
  };
  const takeCopy = (file) => {
    if (!file) return;
    if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
      setResult({ action: "plan", error: "That is a spreadsheet file. In Google Sheets choose File → Download → Comma-separated values (.csv)." });
      return;
    }
    setBusy("copy");
    file.text().then(
      (csv) => syncPost(props.runId, props.sessionId, "/api/syncs/copy", {
        sync: sync.id,
        csv,
        names: Boolean(props.names),
        // When the browser saved the download: how old the sheet in it is.
        lastModified: file.lastModified
      })
    ).catch((error) => ({ error: String(error.message || error) })).then((answer) => {
      setBusy(null);
      setResult(Object.assign({ action: "plan" }, answer));
      const kept = !answer.error && answer.ok;
      if (kept) setReading("export");
      setPreviewed(Boolean(kept));
      done();
    });
  };
  const chips = [
    check && check.state === "changed" ? h(
      "span",
      { className: "pp-chip pp-chip-warn", key: "c", title: check.said + " — checked " + new Date(check.checked_at).toLocaleTimeString() },
      "changed in Google" + (check.modified ? " " + when(check.modified) : "")
    ) : null,
    check && check.state === "same" ? h("span", { className: "pp-chip", key: "c", title: "Checked " + new Date(check.checked_at).toLocaleTimeString() }, "up to date") : null,
    check && check.state === "error" && !check.reconnect ? h("span", { className: "pp-chip", key: "c", title: check.said }, "could not check") : null,
    sync.reconnect || check && check.reconnect ? h("span", { className: "pp-chip pp-chip-warn", key: "g", title: "Google refused the saved sign-in" }, "Google sign-in expired") : null,
    sync.remembered ? h("span", { className: "pp-chip", key: "r", title: "Students found by a saved link" }, sync.remembered + " remembered") : null,
    // On a service's card the header already counts what waits.
    sync.waiting && !props.bare ? h("span", { className: "pp-chip pp-chip-warn", key: "w" }, sync.waiting + " waiting") : null,
    sync.live ? h("span", { className: "pp-chip pp-chip-live", key: "l" }, "others see it") : null,
    sync.enabled ? null : h("span", { className: "pp-chip", key: "x" }, "switched off")
  ].filter(Boolean);
  const takesFile = Boolean(sync.download) && !sync.canReadLive;
  const hasFile = (event) => Array.from(event.dataTransfer && event.dataTransfer.types || []).includes("Files");
  const dropProps = takesFile ? {
    onDragOver: (event) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      if (!dropping) setDropping(true);
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDropping(false);
    },
    onDrop: (event) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      setDropping(false);
      takeCopy(event.dataTransfer.files[0]);
    }
  } : {};
  const last = h(
    "div",
    {
      className: "pp-synclast" + (sync.lastSynced || props.assessment ? "" : " pp-synclast-never"),
      title: sync.lastSynced ? new Date(sync.lastSynced).toLocaleString() : "No record of this sync running"
    },
    // A card fixed to one assessment says nothing about when: the last run is
    // per sync, and would be the date of some other assessment's.
    props.assessment ? sync.live ? "Preview, then send" : "Preview, then run" : sync.lastSynced ? "Last synced " + when(sync.lastSynced) : "Never synced",
    // What that run brought, for a grade sheet: the marks, and how old the sheet was.
    sync.lastEvent && !props.assessment ? " · " + ([
      sync.lastEvent.added ? sync.lastEvent.added + " new" : null,
      sync.lastEvent.changed ? sync.lastEvent.changed + " changed" : null,
      sync.lastEvent.removed ? sync.lastEvent.removed + " taken back" : null
    ].filter(Boolean).join(", ") || "no marks changed") + (sync.lastEvent.read === "file" && sync.lastEvent.saved ? " · sheet saved " + when(sync.lastEvent.saved) : "") : null
  );
  return h(
    "div",
    Object.assign({ className: "pp-synccard" + (props.bare ? " pp-synccard-bare" : "") + (dropping ? " pp-synccard-drop" : "") }, dropProps),
    props.bare ? h("div", { className: "pp-syncmain" }, last, chips.length ? h("div", { className: "pp-chips" }, chips) : null) : h(
      "div",
      { className: "pp-synctop" },
      h(
        "span",
        { className: "pp-svcwrap" },
        h("span", { className: "pp-svc pp-svc-" + sync.service, title: service.name, "aria-hidden": "true" }, service.mark),
        // Which way it runs, on the corner of the service's mark.
        h(DirectionBadge, { role: sync.role, small: true })
      ),
      h(
        "div",
        { className: "pp-syncmain" },
        h("div", { className: "pp-synctitle" }, props.title || sync.label, h("span", { className: "pp-syncid" }, sync.id)),
        last,
        chips.length ? h("div", { className: "pp-chips" }, chips) : null
      )
    ),
    sync.needs === "message" ? h("p", { className: "pp-as" }, "Announcements are written and sent from Publish.") : h(
      "div",
      { className: "pp-syncctl" },
      needsAssessment && !props.assessment ? h(
        "select",
        {
          value: picked,
          onChange: (event) => {
            setPicked(event.target.value);
            setPreviewed(false);
          }
        },
        h("option", { value: "" }, "Choose the assessment…"),
        (props.assessments || []).map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title))
      ) : null,
      // Where the sheet is read from. Directly when this machine has a
      // Google login of its own; otherwise from the copy the professor
      // downloaded, with its date, and the two presses that replace it.
      sync.exported !== null && sync.exported !== void 0 && sync.hasSheet && sync.canReadLive ? h(
        "select",
        {
          value: from,
          onChange: (event) => {
            setReading(event.target.value);
            setPreviewed(false);
          }
        },
        h("option", { value: "live" }, "Read the sheet in Google"),
        sync.exported ? h("option", { value: "export" }, "Read the copy of " + when(sync.exported)) : null
      ) : sync.exported !== null && sync.exported !== void 0 ? h(
        "span",
        {
          className: "pp-synccopy" + (sync.exported ? "" : " pp-synccopy-none"),
          title: sync.exported ? new Date(sync.exported).toLocaleString() : ""
        },
        sync.exported ? "Copy of the sheet from " + when(sync.exported) : "No copy of the sheet yet"
      ) : null,
      takesFile ? h(
        "a",
        {
          className: "pp-syncbtn",
          href: sync.download.url,
          target: "_blank",
          rel: "noreferrer",
          title: "Your browser downloads the sheet from Google as a .csv file"
        },
        "Download from Google"
      ) : null,
      takesFile ? h(
        "label",
        { className: "pp-syncbtn" + (busy ? " pp-syncbtn-off" : ""), title: "Choose the .csv file you downloaded, or drop it on this card" },
        busy === "copy" ? "Reading…" : "Add the downloaded file",
        h("input", {
          type: "file",
          accept: ".csv,text/csv",
          hidden: true,
          disabled: Boolean(busy),
          onChange: (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = "";
            takeCopy(file);
          }
        })
      ) : null,
      h("span", { className: "pp-segspacer" }),
      // Before Preview: pressing it with a refused sign-in only fails again.
      sync.reconnect || check && check.reconnect || result && result.reconnect ? h(ReconnectGoogle, {
        className: "pp-syncbtn pp-syncbtn-send",
        onBack: () => {
          setResult(null);
          done();
        }
      }) : null,
      h(
        "button",
        { type: "button", className: "pp-syncbtn", disabled: Boolean(busy) || !ready, onClick: () => press2("plan") },
        busy === "plan" ? "Looking…" : "Preview"
      ),
      sync.live ? h(
        "button",
        {
          type: "button",
          className: "pp-syncbtn pp-syncbtn-send",
          disabled: Boolean(busy) || !ready || !previewed,
          title: previewed ? "Do what the preview shows" : "Preview first",
          onClick: () => press2("run", true)
        },
        busy === "run" ? "Sending…" : "Send"
      ) : h(
        "button",
        {
          type: "button",
          className: "pp-syncbtn pp-syncbtn-run",
          disabled: Boolean(busy) || !ready || !sync.enabled,
          onClick: () => press2("run")
        },
        busy === "run" ? "Running…" : "Run"
      )
    ),
    // How the file gets here, and what would make the step unnecessary.
    takesFile ? h(
      "p",
      { className: "pp-synchint" },
      "No Google login on this computer: download the sheet" + (sync.download.tabHint ? " (from its “" + sync.download.tabHint + "” tab: File → Download → CSV)" : "") + ", then drop the file on this card. Nothing is written before a preview."
    ) : null,
    result ? h(
      "div",
      { className: "pp-syncout" + (result.error || !result.ok ? " pp-syncout-err" : "") },
      h(
        "div",
        { className: "pp-syncouthead" },
        h("span", null, result.error ? "Could not run" : result.action === "run" ? "Done" : "Preview — nothing was changed"),
        h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: () => setResult(null) }, "×")
      ),
      h("pre", null, result.error || result.output || "(nothing printed)")
    ) : null
  );
}
function WaitingCard(props) {
  const row = props.row;
  const [picking, setPicking] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  const [showing, setShowing] = React.useState(false);
  const [best] = row.candidates;
  const preview = row.preview;
  const person = (candidate) => candidate.name || candidate.student;
  const confirm = (to) => {
    setBusy(true);
    setFailed(null);
    syncPost(props.runId, props.sessionId, "/api/syncs/action", {
      action: "confirm",
      sync: row.sync,
      line: row.line,
      key: row.key,
      to: to || null
    }).then((answer) => {
      setBusy(false);
      if (answer.error || !answer.ok) {
        setFailed(answer.error || answer.output || "It was not confirmed.");
        return;
      }
      if (props.onDone) props.onDone();
    });
  };
  const where = [row.line ? "line " + row.line : null, preview && preview.tab ? "tab " + preview.tab : null].filter(Boolean).join(" · ");
  return h(
    "div",
    { className: "pp-waitrow" },
    h(
      "div",
      { className: "pp-waitline" },
      h(
        "span",
        { className: "pp-waitpair" },
        h("span", { className: "pp-waitwritten", title: "As written in the sheet" }, row.written !== null ? "“" + row.written + "”" : "(name hidden)"),
        h("span", { className: "pp-waitarrow", "aria-hidden": "true" }, "→"),
        best ? h(
          "span",
          { className: "pp-waitwho" },
          h("span", { className: "pp-avatar", "aria-hidden": "true" }, best.name ? initials(best.name) : "?"),
          h("span", { className: "pp-waitname" }, person(best))
        ) : h("span", { className: "pp-as" }, "nobody close")
      )
    ),
    // The names get the whole first line — they are what is being decided —
    // and the presses sit at the end of the second.
    h(
      "div",
      { className: "pp-waitmeta" },
      h(
        "span",
        { className: "pp-waitwhy" },
        h("span", { className: "pp-st-warn", title: row.why.replace(/ of STUDENT-[A-Z0-9]+/, "") }, shortWhy(row.why)),
        row.candidates.length > 1 ? " · also near " + row.candidates.slice(1).map(person).join(", ") : null,
        where ? " · " + where : null,
        preview ? h(
          "button",
          { type: "button", className: "pp-linkbtn", "aria-expanded": showing, onClick: () => setShowing(!showing) },
          showing ? "hide the sheet" : "show in the sheet"
        ) : null,
        preview && preview.open ? h("a", { className: "pp-linkbtn", href: preview.open, target: "_blank", rel: "noreferrer" }, "open ↗") : null
      ),
      picking ? null : h(
        "span",
        { className: "pp-waitacts" },
        best ? h("button", { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy, onClick: () => confirm(null) }, busy ? "…" : "Confirm") : null,
        h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking({ to: "" }) }, "Someone else")
      )
    ),
    showing && preview ? h(SheetPreview, { preview, line: row.line }) : null,
    picking ? h(
      "div",
      { className: "pp-syncctl" },
      h(
        "select",
        { value: picking.to || "", onChange: (event) => setPicking({ to: event.target.value }) },
        h("option", { value: "" }, "Who is it?"),
        (props.students || []).map((student) => h("option", { value: student.student, key: student.student }, student.name || student.student))
      ),
      h(
        "button",
        { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy || !picking.to, onClick: () => confirm(picking.to) },
        "Confirm"
      ),
      h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking(null) }, "Cancel")
    ) : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null
  );
}
function WaitingList(props) {
  const rows = props.rows || [];
  if (!rows.length) return null;
  return h(
    "div",
    { className: "pp-syncsection" },
    h(
      "div",
      { className: "pp-waittitle" },
      h("span", { className: "pp-csubtitle" }, "Names to confirm"),
      h("span", { className: "pp-count pp-count-warn" }, rows.length),
      h(
        "span",
        { className: "pp-as" },
        props.names ? "a confirmed name is used from the next sync on" : "names are hidden — press Names to see who each is"
      )
    ),
    h(
      "div",
      { className: "pp-waitlist" },
      rows.map(
        (row) => h(WaitingCard, {
          row,
          students: props.students,
          runId: props.runId,
          sessionId: props.sessionId,
          onDone: props.onDone,
          key: row.sync + row.key
        })
      )
    )
  );
}

// shared/course-words.js
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var shortDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : "";
};
var pct = (value) => value === null || value === void 0 ? "" : `${Math.round(value * 100)}%`;
var weightPct = (value) => value === null || value === void 0 ? "" : `${Number((value * 100).toFixed(2))}%`;
var ICONS = {
  lecture: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  lab: '<path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  seminar: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  slides: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 7.5 4.5 2.5-4.5 2.5z"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  reading: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  notebook: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="m10 10-2 2 2 2"/><path d="m14 10 2 2-2 2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  brief: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  quiz: '<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  homework: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  project: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
  exam: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  outcome: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  concept: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  module: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  misdated: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 13.5v3"/><path d="M12 19.2h.01"/>',
  weight: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  ask: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
};
var MEETING_ICON = {
  lecture: "lecture",
  lab: "lab",
  seminar: "seminar",
  discussion: "seminar",
  review: "seminar",
  exercise: "homework",
  project_work: "project",
  field_work: "project",
  reading: "reading"
};
var RESOURCE_ICON = {
  slides: "slides",
  reading: "reading",
  textbook_chapter: "reading",
  dataset: "data",
  notebook: "notebook",
  video: "video",
  link: "link",
  tool: "notebook"
};
var RESOURCE_WORD = { textbook_chapter: "chapter", dataset: "dataset" };
var WORK_ICON = {
  quiz: "quiz",
  assignment: "homework",
  project: "project",
  exam: "exam",
  presentation: "lecture",
  oral_defense: "seminar",
  participation: "seminar"
};
var WORK_WORD = { assignment: "homework", oral_defense: "defence" };
var GAP = {
  module: { icon: "module", verb: "Plan module" },
  deck: { icon: "slides", verb: "Draft deck" },
  misdated: { icon: "misdated", verb: "Check date" },
  deadline: { icon: "calendar", verb: "Set dates" },
  weight: { icon: "weight", verb: "Set weight" },
  brief: { icon: "brief", verb: "Write brief" }
};
var promptFor = (kind, week, run2, ref) => {
  const module2 = (week.modules ?? [])[0];
  const about = `week ${week.week} of ${run2.id}` + (module2 ? ` (${module2.module_id}, "${module2.title}")` : "");
  const gap = (week.gaps ?? []).find((g) => g.kind === kind) ?? { ids: [] };
  switch (kind) {
    case "deck":
      return `Draft the slides for ${about} with /make-materials. It meets in ${gap.ids.join(", ") || "its meetings"} and has no deck. Register it as a resource marked approval: draft.`;
    case "module":
      return `Week ${week.week} of ${run2.id} has no module. Propose what it should teach, given the weeks either side, as a draft module for me to read. Change nothing else.`;
    case "misdated":
      return `${ref} is drawn under ${about}, but its date falls outside that week. Which is wrong: its date, its module's week, or the run's start date? Tell me what you find and change nothing until I say.`;
    case "weight":
      return `What should ${gap.ids.join(", ")} in ${about} be worth? The weight is mine to set; propose one and wait.`;
    case "brief":
      return `${ref} in ${about} has no brief students can read. Draft one from its rubric and outcomes with /design-assessment, as a draft for me to read.`;
    default:
      return `For ${about}, what is still missing?`;
  }
};
var datesPrompt = (a, run2) => `Ask me this now, in your first message, before running any command: what are the open and due dates for ${a.assessment_id} ("${a.title}")? Skip the usual opening validate and inbox sweep, and do not read any file first: these two dates exist only in my head, so nothing on disk can answer this. Once I have answered, set opens_at and due_at on the ${a.assessment_id} entry in ` + (a.source_file ?? `courses/${run2.course_id}/versions/${run2.term}/assessments/ (grep for the id)`) + ", and then just confirm what you wrote.";
var tierOf = (week, current) => {
  if (week.urgency) return week.urgency;
  if (week.when === "past") return "past";
  if (current !== null && week.week <= current + 1) return "soon";
  return "later";
};
var hasBrief = (a) => Boolean(a.url || a.brief_url || String(a.description ?? "").trim());
var titleOf = (w) => (w.modules ?? []).map((m) => m.title).join(" · ");
var conceptsOf = (w) => (w.modules ?? []).flatMap((m) => m.concepts ?? []);
var KINDS = { quiz: ["Quizzes", "q"], assignment: ["Homework", "hw"], project: ["Project", "pj"], exam: ["Exams", "ex"] };
var kindOf = (type) => KINDS[type] ?? ["Other", "ot"];
var LANES = [["test", "Exams & Quizzes", "q", ["quiz", "exam"]], ["assignment", "Homework", "hw", ["assignment"]], ["project", "Project", "pj", ["project"]]];
var laneOf = (type) => LANES.find((l) => l[3].includes(type)) ?? ["other", "Other", "ot", []];
var runOffset = (data) => {
  const run2 = data.run ?? {};
  try {
    if (run2.timezone && run2.start_date) {
      const name = new Intl.DateTimeFormat("en-US", { timeZone: run2.timezone, timeZoneName: "longOffset" }).formatToParts(/* @__PURE__ */ new Date(`${run2.start_date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ?? "";
      const m = /GMT([+-]\d{2}:\d{2})?/.exec(name);
      if (m) return m[1] ?? "+00:00";
    }
  } catch {
  }
  for (const a of data.assessments ?? []) {
    const m = /([+-]\d{2}:\d{2}|Z)$/.exec(String(a.due_at ?? a.opens_at ?? ""));
    if (m) return m[1] === "Z" ? "+00:00" : m[1];
  }
  return "+00:00";
};
var REVISIT_BELOW = 0.6;
var STEP_PROMPTS = {
  rubric: (runId, id) => "/import-assessment " + id + " " + runId + " — propose the rubric",
  grade: (runId, id) => "/grade-batch " + id + " " + runId,
  approve: (runId, id) => "Which suggested grades on " + id + " (" + runId + ") are still waiting for my decision, least confident first?"
};

// client/marks.js
function MatchReview(props) {
  const matched = props.papers.filter(
    (paper) => paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed")
  );
  matched.sort((a, b) => (a.lane === "check" ? 0 : 1) - (b.lane === "check" ? 0 : 1));
  const suggested = props.papers.filter((paper) => paper.lane === "held" && paper.candidates.length);
  const keyOf = (paper) => paper.file + "|" + paper.pages;
  const [choice, setChoice] = React.useState({});
  const isYes = (paper, fallback) => keyOf(paper) in choice ? choice[keyOf(paper)] : fallback;
  const close = props.onClose;
  const busy = props.busy;
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);
  const yesMatched = matched.filter((paper) => isYes(paper, true));
  const notMatched = matched.filter((paper) => !isYes(paper, true));
  const yesSuggested = suggested.filter((paper) => isYes(paper, false));
  const setAll = (list, value) => setChoice((current) => {
    const next = Object.assign({}, current);
    list.forEach((paper) => {
      next[keyOf(paper)] = value;
    });
    return next;
  });
  const submit = () => {
    const papers = [].concat(yesMatched.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.resolved }))).concat(notMatched.map((paper) => ({ pages: paper.pages, file: paper.file, reject: paper.resolved }))).concat(yesSuggested.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.candidates[0].student })));
    if (papers.length) props.onSubmit(papers);
  };
  const rcard = (paper, student, name, yes, kind) => h(
    "button",
    {
      type: "button",
      key: keyOf(paper),
      className: "pp-rcard" + (yes ? "" : kind === "matched" ? " pp-rcard-no" : " pp-rcard-off"),
      "aria-pressed": yes,
      disabled: busy,
      title: yes ? kind === "matched" ? "Press if this is not them" : "Press to leave it held" : kind === "matched" ? "Press to keep the match" : "Press if this is them",
      onClick: () => setChoice((current) => Object.assign({}, current, { [keyOf(paper)]: !yes }))
    },
    props.crops ? h("img", { src: props.cropUrl(paper), alt: "Name line, page " + paper.pages.split("-")[0], loading: "lazy" }) : null,
    h("div", { className: "pp-rwritten" }, paper.written ? "“" + paper.written + "”" : "pages " + paper.pages),
    h("div", { className: "pp-rname" }, name || student),
    h("div", { className: "pp-rid" }, student + " · pp. " + paper.pages),
    h(
      "div",
      { className: "pp-rbadges" },
      kind === "suggested" ? h("span", { className: "pp-rbadge pp-rbadge-close" }, "suggested · not placed") : paper.lane === "check" ? h("span", { className: "pp-rbadge pp-rbadge-close" }, paper.match === "partial" ? "one word" : "close spelling") : h("span", { className: "pp-rbadge" }, paper.match === "words" ? "same words" : "exact"),
      h(
        "span",
        { className: "pp-rbadge " + (yes ? "pp-rbadge-yes" : kind === "matched" ? "pp-rbadge-no" : "") },
        yes ? "✓ them" : kind === "matched" ? "✗ not them" : "leave held"
      )
    )
  );
  const label = "Confirm " + (yesMatched.length + yesSuggested.length) + (notMatched.length ? " · reject " + notMatched.length : "");
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        }
      },
      h(
        "div",
        { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Review name matches" },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Who wrote each paper · " + props.title),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×")
        ),
        h(
          "div",
          { className: "pp-review" },
          matched.length ? h(
            "div",
            { className: "pp-reviewsec" },
            "Matched by name",
            h("span", null, matched.length + " — every one is them unless you press it"),
            h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(matched, true) }, "All them")
          ) : null,
          h("div", { className: "pp-reviewgrid" }, matched.map((paper) => rcard(paper, paper.resolved, paper.resolved_name, isYes(paper, true), "matched"))),
          suggested.length ? h(
            "div",
            { className: "pp-reviewsec" },
            "Suggested",
            h("span", null, suggested.length + " held — the nearest student, placed only if you press it"),
            h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, true) }, "All them"),
            h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, false) }, "None")
          ) : null,
          h(
            "div",
            { className: "pp-reviewgrid" },
            suggested.map(
              (paper) => rcard(paper, paper.candidates[0].student, paper.candidates[0].name, isYes(paper, false), "suggested")
            )
          ),
          !matched.length && !suggested.length ? h(Message, null, "Nothing to review: every paper is confirmed or set aside.") : null
        ),
        h(
          "div",
          { className: "pp-reviewfoot" },
          h(
            "span",
            { className: "pp-as" },
            busy ? "Placing — every answer at once, then one apply…" : "A rejected paper is taken back and held for you to name in the tab. Nothing here is graded."
          ),
          h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: close }, "Cancel"),
          h(
            "button",
            {
              type: "button",
              className: "pp-primary",
              disabled: busy || yesMatched.length + notMatched.length + yesSuggested.length === 0,
              onClick: submit
            },
            busy ? "Placing…" : label
          )
        )
      )
    ),
    document.body
  );
}
var PLAN_ACTIONS = {
  new: { words: "will be sent", chip: "pp-chip-warn", order: 0 },
  change: { words: "will be updated", chip: "pp-chip-warn", order: 1 },
  drift: { words: "edited in Canvas — left alone", chip: "pp-chip-live", order: 2 },
  unmatched: { words: "not found in Canvas", chip: "pp-chip-live", order: 3 },
  skip: { words: "not sent", chip: "", order: 4 },
  unchanged: { words: "already in Canvas", chip: "pp-chip-ok", order: 5 }
};
var planScore = (value) => value === null || value === void 0 ? "—" : String(Math.round(value * 100) / 100);
function PlanTable(props) {
  const rows = props.entry.rows.slice().sort(
    (a, b) => (PLAN_ACTIONS[a.action] || PLAN_ACTIONS.skip).order - (PLAN_ACTIONS[b.action] || PLAN_ACTIONS.skip).order || String(a.name || a.student_id).localeCompare(String(b.name || b.student_id))
  );
  const counts = props.entry.counts || {};
  const sending = (counts.new || 0) + (counts.change || 0);
  const skipWhy = [...new Set(rows.filter((row) => row.action === "skip" && row.reason).map((row) => row.reason))];
  const summary = [
    sending ? sending + " will be sent" : "nothing to send",
    counts.unchanged ? counts.unchanged + " already in Canvas" : null,
    counts.drift ? counts.drift + " edited in Canvas" : null,
    counts.unmatched ? counts.unmatched + " not found in Canvas" : null,
    counts.skip ? counts.skip + " not sent" + (skipWhy.length === 1 ? " (" + skipWhy[0] + ")" : "") : null
  ].filter(Boolean).join(" · ");
  return h(
    "div",
    { className: "pp-plan" },
    h("p", { className: "pp-plansum" }, summary),
    // What the CLI says about the course — host, assignment, scale — is worth
    // having but not worth reading before the names; folded.
    props.entry.notes && props.entry.notes.length ? h(
      "details",
      { className: "pp-plannotes" },
      h("summary", null, "About this Canvas course"),
      props.entry.notes.map((note, i) => h("p", { className: "pp-as", key: "n" + i }, note))
    ) : null,
    h(
      "table",
      { className: "pp-plantable" },
      h(
        "thead",
        null,
        h("tr", null, h("th", null, "Student"), h("th", { className: "pp-num" }, "Mark"), h("th", { className: "pp-num" }, "Canvas now"), h("th", null, ""))
      ),
      h(
        "tbody",
        null,
        rows.map((row) => {
          const said = PLAN_ACTIONS[row.action] || PLAN_ACTIONS.skip;
          return h(
            "tr",
            { key: row.student_id, className: row.action === "unchanged" ? "pp-planquiet" : "" },
            h("td", { className: "pp-planwho", title: row.student_id }, row.name || row.student_id),
            h("td", { className: "pp-num" }, planScore(row.score) + (row.maximum ? " / " + planScore(row.maximum) : "")),
            h("td", { className: "pp-num" }, planScore(row.current)),
            h(
              "td",
              null,
              // A skipped row says why ("no submission"); the rest say what happens.
              h("span", { className: "pp-chip " + said.chip, title: row.reason || "" }, row.action === "skip" && row.reason ? row.reason : said.words)
            )
          );
        })
      )
    )
  );
}
var sendOutcome = (entry) => {
  const out = entry.output || "";
  const posted = /Canvas finished: (\d+) grade/.exec(out);
  const held = /Canvas already holds (\d+)/.exec(out);
  const manual = /posts manually/.test(out);
  if (!entry.ok) {
    const lines = out.split("\n").map((line) => line.trim()).filter(Boolean);
    return { kind: "fail", words: "Not sent — " + (lines[lines.length - 1] || "the send failed") };
  }
  const already = held ? " (" + held[1] + " were already there)" : "";
  if (/has not finished the job yet/.test(out)) {
    return { kind: "wait", count: 0, words: "Canvas accepted the marks but is still processing them" + already + ". Check again in a minute." };
  }
  if (posted) {
    return {
      kind: "ok",
      count: Number(posted[1]) + (held ? Number(held[1]) : 0),
      words: "Sent " + posted[1] + " marks" + already + (manual ? " — this assignment posts manually: post them in Canvas for students to see" : " — students can see them")
    };
  }
  if (held) return { kind: "ok", count: Number(held[1]), words: "Canvas already had all " + held[1] + " marks — confirmed" };
  if (/nothing to send/.test(out)) return { kind: "ok", count: 0, words: "Nothing to send — Canvas already matches" };
  return { kind: "ok", count: 0, words: "Done" };
};
function SendResult(props) {
  const outcomes = props.groups.map((entry) => ({ entry, said: sendOutcome(entry) }));
  const worst = outcomes.some((o) => o.said.kind === "fail") ? "fail" : outcomes.some((o) => o.said.kind === "wait") ? "wait" : "ok";
  const landed = outcomes.reduce((n, o) => n + (o.said.count || 0), 0);
  const headline = {
    ok: landed ? "Sent — Canvas has these " + landed + " marks" : "Sent — Canvas is up to date",
    wait: "Sent, but Canvas is still processing",
    fail: "Not everything was sent"
  }[worst];
  return h(
    "div",
    { className: "pp-sendresult pp-sendresult-" + worst, role: "status" },
    h(
      "div",
      { className: "pp-sendresulthead" },
      h("span", { className: "pp-sendresulticon", "aria-hidden": "true" }, { ok: "✓", wait: "…", fail: "!" }[worst]),
      h("b", null, headline)
    ),
    h(
      "ul",
      null,
      outcomes.map(
        (o) => h(
          "li",
          { key: o.entry.group || "run", className: "pp-sendresult-" + o.said.kind },
          h("span", { className: "pp-sendcourse" }, props.name(o.entry)),
          h("span", null, o.said.words)
        )
      )
    ),
    h(
      "details",
      { className: "pp-plannotes" },
      h("summary", null, "What the CLI said"),
      outcomes.map((o) => h("pre", { className: "pp-approveout", key: "o" + (o.entry.group || "run") }, o.entry.output))
    )
  );
}
function SendSteps(props) {
  const labels = ["Check Canvas", "Send", props.failed ? "Not sent" : props.partial || "In Canvas"];
  return h(
    "ol",
    { className: "pp-sendsteps", "aria-label": "Canvas send progress" },
    labels.map((label, i) => {
      const state = i < props.at ? "done" : i === props.at ? props.failed && i === 2 ? "fail" : props.partial && i === 2 ? "warn" : props.busy ? "busy" : "now" : "todo";
      return h(
        "li",
        { key: "s" + i, className: "pp-sendstep pp-sendstep-" + state, "aria-current": i === props.at ? "step" : void 0 },
        h("span", { className: "pp-sendstepdot", "aria-hidden": "true" }, state === "done" ? "✓" : state === "fail" || state === "warn" ? "!" : String(i + 1)),
        h("span", null, label)
      );
    })
  );
}
function CanvasMarks(props) {
  const [plan, setPlan] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const [lists, setLists] = React.useState({});
  const [picks, setPicks] = React.useState({});
  const [creating, setCreating] = React.useState({});
  const endpoint = (path) => scoped(BASE + path + "?run=" + encodeURIComponent(props.runId || ""), props.sessionId);
  const postJson = (path, body) => fetch(endpoint(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    (response) => response.json()
  );
  const marks = (extra, label) => {
    setPhase(label);
    setFailed(null);
    postJson("/api/canvas/marks", Object.assign({ assessment: props.assessmentId, names: Boolean(props.names) }, extra || {})).then((body) => {
      setPhase("idle");
      if (body.error) return setFailed(body.error);
      setPlan(body);
      setCreating({});
      if (body.confirmed) props.onSent();
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  const [progress, setProgress] = React.useState(null);
  const send2 = async () => {
    const targets = (plan && plan.groups || []).filter((entry) => entry.ok && !entry.unlinked);
    if (!targets.length) return;
    setPhase("sending");
    setFailed(null);
    const results = [];
    for (let i = 0; i < targets.length; i++) {
      const entry = targets[i];
      setProgress({ done: i, total: targets.length, now: entry.group || "Canvas" });
      try {
        const body = await postJson("/api/canvas/marks", {
          assessment: props.assessmentId,
          names: Boolean(props.names),
          confirm: true,
          group: entry.group || ""
        });
        if (body.error) results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: body.error });
        else results.push(...body.groups || []);
      } catch (error) {
        results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: String(error && error.message || error) });
      }
    }
    setProgress({ done: targets.length, total: targets.length, now: null });
    setPhase("idle");
    setPlan({ confirmed: true, groups: results });
    setCreating({});
    props.onSent();
  };
  React.useEffect(() => {
    if (props.autoPreview && props.canvas && props.canvas.ready > 0) marks({}, "planning");
  }, []);
  const listFor = (entry) => {
    postJson("/api/canvas/assignments", { courseId: entry.courseId }).then((body) => setLists((all) => Object.assign({}, all, { [entry.group]: body.error ? { error: body.error } : body.assignments || [] }))).catch((error) => setLists((all) => Object.assign({}, all, { [entry.group]: { error: String(error) } })));
  };
  const create = (entry, confirm) => {
    setPhase("creating");
    setFailed(null);
    postJson("/api/canvas/assignment", { assessment: props.assessmentId, group: entry.group || "", confirm }).then((body) => {
      setPhase("idle");
      if (body.error) return setFailed(body.error);
      if (confirm && body.ok) return marks({}, "planning");
      setCreating((all) => Object.assign({}, all, { [entry.group]: body }));
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  const groups = plan && plan.groups || [];
  const unlinked = groups.filter((entry) => entry.unlinked);
  const title = props.title || props.assessmentId;
  const askToLink = () => {
    const run2 = props.runId;
    const a = props.assessmentId;
    const where = unlinked.map((entry) => entry.group ? entry.group + " (Canvas course " + entry.courseId + ")" : "the run's Canvas course").join(", ");
    props.ask(
      "Link " + a + " (" + title + ") to its Canvas assignment in each course that has none yet: " + where + ".\n\n1. Run `bin/ainar lms assignments " + run2 + " --assessment " + a + "`. It only reads Canvas. Show me, per course, the assignment you think is " + title + " and why — or say that nothing there looks like it.\n2. Ask me to confirm each pairing, one line per course. Link nothing I have not confirmed.\n3. For each one I confirm, run `bin/ainar lms link " + run2 + " --assessment " + a + " --group <GROUP> --canvas-assignment <ID>`. It changes nothing in Canvas; it records the id in the course.\n4. Where no assignment exists, say so and offer to create it: `bin/ainar lms assignment-plan " + run2 + " --assessment " + a + " --group <GROUP>` shows what would be created; run `bin/ainar lms assignment-push … --confirm` only when I say yes.\n\nDo not send any marks — I send those from the pane once every course is linked."
    );
  };
  const previewed = plan && !plan.confirmed && groups.length > 0 && !unlinked.length && groups.every((entry) => entry.ok);
  const planned = groups.reduce((n, entry) => n + ((entry.counts || {}).new || 0) + ((entry.counts || {}).change || 0), 0);
  const unrecorded = groups.reduce(
    (n, entry) => n + (entry.rows || []).filter((row) => row.action === "unchanged" && row.last_prepared === null).length,
    0
  );
  const sendCount = planned + unrecorded;
  const sendable = previewed && sendCount > 0;
  const name = (entry) => entry.group || "the run's Canvas course";
  const busy = phase !== "idle";
  const c = props.canvas || { ready: 0, unsent: 0, changed: 0 };
  const toSend = c.unsent + c.changed;
  const inCanvas = groups.reduce((n, entry) => n + ((entry.counts || {}).unchanged || 0), 0);
  const lead = Boolean(props.lead);
  const confirmed = Boolean(plan && plan.confirmed);
  const sentFailed = confirmed && groups.some((entry) => !entry.ok);
  const unplaced = groups.reduce((n, entry) => n + ((entry.counts || {}).unmatched || 0), 0);
  const students = (n) => n === 1 ? "1 student isn't" : n + " students aren't";
  const unplacedWords = unplaced ? " " + students(unplaced) + " in the Canvas course, so " + (unplaced === 1 ? "that mark has" : "those marks have") + " nowhere to go — add them in Canvas, then check again." : "";
  const finished = previewed && !sendCount || confirmed && !sentFailed;
  const partial = finished && unplaced ? inCanvas + " of " + (inCanvas + unplaced) + " in Canvas" : null;
  const at = phase === "planning" || !plan ? 0 : phase === "sending" ? 1 : confirmed && sentFailed ? 2 : finished ? partial ? 2 : 3 : 1;
  const headline = c.ready === 0 ? "No whole marks to send yet." : phase === "planning" ? "Checking what Canvas has for these " + c.ready + " marks…" : phase === "sending" ? "Sending to Canvas — keep this open until it finishes." : confirmed ? null : previewed ? planned ? planned + " of " + c.ready + " marks are not in Canvas yet" + (inCanvas ? "; " + inCanvas + " already are." : ".") + unplacedWords : unrecorded ? "Canvas already has these " + unrecorded + " marks — sending confirms them here; students see no change." + unplacedWords : unplaced ? "Canvas has " + inCanvas + " of " + (inCanvas + unplaced) + " marks." + unplacedWords : "Canvas has every mark (" + inCanvas + ")." : toSend === 0 ? "Canvas has every mark (" + c.ready + ")." : toSend + " of " + c.ready + " marks are not in Canvas.";
  const pct2 = progress && progress.total ? Math.round(100 * progress.done / progress.total) : 0;
  const forward = c.ready === 0 || confirmed ? null : phase === "planning" ? h("button", { type: "button", className: "pp-primary", disabled: true, "aria-busy": "true" }, "Checking Canvas…") : phase === "sending" ? h(
    "button",
    {
      type: "button",
      className: "pp-primary pp-danger pp-btn-progress",
      disabled: true,
      "aria-busy": "true",
      style: { "--pp-progress": pct2 + "%" }
    },
    "Sending… " + (progress && progress.total > 1 ? "course " + Math.min(progress.done + 1, progress.total) + " of " + progress.total : "")
  ) : sendable ? h(
    "button",
    {
      type: "button",
      className: "pp-primary pp-danger",
      disabled: busy,
      title: "Students see a posted grade within seconds",
      onClick: send2
    },
    "Send " + sendCount + " marks to Canvas"
  ) : !plan ? h("button", { type: "button", className: "pp-primary", disabled: busy, onClick: () => marks({}, "planning") }, "Check Canvas") : null;
  return h(
    "div",
    { className: lead ? "pp-sendflow" : "pp-next pp-sendflow" },
    c.ready > 0 ? h(SendSteps, { at, busy, failed: sentFailed, partial }) : null,
    headline && !(lead && !plan && phase === "idle") ? h("p", { className: "pp-sendheadline" }, headline) : null,
    h(
      "div",
      { className: "pp-approverow" },
      forward,
      plan && !busy ? h("button", { type: "button", className: "pp-segbtn", onClick: () => marks({}, "planning") }, confirmed ? "Check Canvas again" : "Check again") : null
    ),
    confirmed && phase !== "sending" ? h(SendResult, { groups, name }) : null,
    failed ? h("pre", { className: "pp-approveout pp-approveerr" }, failed) : null,
    unlinked.length && props.ask ? h(
      "div",
      { className: "pp-linkask" },
      h(
        "p",
        null,
        unlinked.length === groups.length ? "None of the Canvas courses has " + title + " linked, so there is nowhere to put these marks yet." : unlinked.map((entry) => entry.group).join(", ") + " " + (unlinked.length === 1 ? "has" : "have") + " no " + title + " linked yet."
      ),
      h(
        "p",
        { className: "pp-as" },
        "The assistant will read each course's assignment list in Canvas (nothing changes there), say which one it thinks is " + title + " and why, and ask you. Only the pairings you confirm are recorded — in the course record, not in Canvas. Where none exists it offers to create it, again only on your yes. It does not send marks."
      ),
      h(
        "button",
        { type: "button", className: "pp-primary pp-chat", disabled: busy, onClick: askToLink },
        "Ask the assistant to link " + title
      )
    ) : null,
    // The preview, course by course. After a send the result above says it
    // all, so the courses' own sections go.
    (confirmed ? [] : groups).map(
      (entry) => h(
        "div",
        { key: entry.group || "run" },
        h("p", { className: "pp-factgroup" }, name(entry) + (entry.courseId ? " · course " + entry.courseId : "")),
        entry.unlinked ? h(
          "div",
          { className: "pp-approverow" },
          h("span", null, "Or by hand:"),
          lists[entry.group] === void 0 ? h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => listFor(entry) }, "Link one already in Canvas…") : lists[entry.group].error ? h("span", { className: "pp-as" }, lists[entry.group].error) : h(
            React.Fragment,
            null,
            h(
              "select",
              {
                className: "pp-bindsel",
                value: picks[entry.group] || "",
                onChange: (event) => setPicks((all) => Object.assign({}, all, { [entry.group]: event.target.value }))
              },
              h("option", { value: "" }, "Choose the assignment…"),
              lists[entry.group].map(
                (assignment) => h(
                  "option",
                  { value: assignment.id, key: assignment.id },
                  assignment.name + (assignment.points != null ? " (" + assignment.points + " pts)" : "")
                )
              )
            ),
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: busy || !picks[entry.group],
                onClick: () => marks({ link: { group: entry.group || "", assignmentId: picks[entry.group] } }, "planning")
              },
              "Link"
            )
          ),
          creating[entry.group] ? h(
            "button",
            { type: "button", className: "pp-segbtn pp-danger", disabled: busy, onClick: () => create(entry, true) },
            phase === "creating" ? "Creating…" : "Create it in " + name(entry)
          ) : h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => create(entry, false) }, "Preview creating it")
        ) : null,
        entry.rows && !(creating[entry.group] || {}).output ? h(PlanTable, { entry }) : null,
        // An unlinked course's own message is the CLI explaining its data
        // model; the sentence above says the same in the professor's terms.
        (creating[entry.group] || {}).output || !entry.unlinked && entry.output && !plan.confirmed ? h("pre", { className: "pp-approveout" + (entry.ok || entry.unlinked ? "" : " pp-approveerr") }, (creating[entry.group] || {}).output || entry.output) : null
      )
    )
  );
}
function useUnpublished(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/unpublished?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
      headers: { accept: "application/json" }
    }).then((response) => response.json()).then((value) => live && setState({ phase: "ready", value })).catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision]);
  return state;
}
var editedIn = (check) => {
  const found = /* @__PURE__ */ new Map();
  for (const entry of check && check.value && check.value.value && check.value.value.assessments || []) {
    const edited = [];
    for (const cell of entry.groups || []) for (const row of cell.edited || []) edited.push(Object.assign({ group: cell.group }, row));
    found.set(entry.assessment_id, edited);
  }
  return found;
};
var unplacedIn = (check) => {
  const found = /* @__PURE__ */ new Map();
  for (const entry of check && check.value && check.value.value && check.value.value.assessments || []) {
    found.set(entry.assessment_id, (entry.groups || []).reduce((n, cell) => n + ((cell.counts || {}).unmatched || 0), 0));
  }
  return found;
};
var markState = (entry, unplaced = 0) => {
  const c = entry.canvas;
  const marking = entry.submitted === 0 && entry.graded === 0 ? "nothing handed in" : entry.graded + " of " + entry.submitted + " graded" + (entry.partial ? " · " + entry.partial + " part-graded" : "");
  const stuck = Math.min(unplaced, c.unsent);
  const unsent = c.unsent - stuck;
  let canvas = null;
  if (c.ready > 0) {
    canvas = unsent === 0 && c.changed === 0 ? (stuck ? c.ready - stuck + " of " + c.ready : "all " + c.ready) + " in Canvas" : [unsent ? unsent + " not in Canvas" : null, c.changed ? c.changed + " changed since sent" : null].filter(Boolean).join(" · ");
  }
  return {
    marking,
    canvas,
    behind: unsent > 0 || c.changed > 0,
    waiting: unsent + c.changed,
    stuck: stuck ? stuck + " not in the Canvas course" : null
  };
};
var dueOrder = (a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));
var titleParts = (title) => {
  const match = /^(\S{1,8}(?: \d{1,3})?)\s+[-–—:]\s+(.+)$/.exec(String(title || ""));
  return match ? { tag: match[1], rest: match[2] } : { tag: null, rest: String(title || "") };
};
var TitleWithTag = (props) => {
  const parts = titleParts(props.title);
  return h(
    "span",
    { className: "pp-titletag", title: props.title },
    parts.tag ? h("span", { className: "pp-tag" + (/^quiz|^exam|^mid|^final/i.test(parts.tag) ? " pp-tag-quiz" : "") }, parts.tag) : null,
    h("span", { className: "pp-titletext" }, parts.rest)
  );
};
function GradebookStatus(props) {
  const state = useUnpublished(props.runId, props.sessionId, props.revision);
  const [check, recheck] = useCanvasCheck(props.runId, props.sessionId);
  const [open2, setOpen] = React.useState(null);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const rows = state.value.assessments.filter((entry) => entry.submitted > 0 || entry.graded > 0).sort(dueOrder);
  if (!rows.length) return null;
  const edited = editedIn(check);
  const unplaced = unplacedIn(check);
  const said = new Map(rows.map((entry) => [entry.id, markState(entry, unplaced.get(entry.id) || 0)]));
  const waiting2 = rows.reduce((n, entry) => n + said.get(entry.id).waiting, 0);
  const answer = check.value || {};
  const checking = check.phase === "running" || check.phase === "loading";
  const unreachable = !checking && (answer.error || answer.state === "ready" && !answer.value);
  return h(
    "div",
    { className: "pp-bookcard pp-bookstatus" + (open2 ? " pp-bookstatus-open" : "") },
    h(
      "div",
      { className: "pp-cardhead" },
      h("b", null, "Marking"),
      h(
        "span",
        { className: waiting2 ? "pp-chip pp-chip-warn" : "pp-chip pp-chip-ok" },
        waiting2 ? waiting2 + " marks waiting for Canvas" : "Canvas has every mark"
      ),
      // Where the Canvas figures come from: a check under way, the last one,
      // or this machine's record because Canvas could not be reached.
      h(
        "span",
        { className: "pp-checkstate" + (unreachable ? " pp-checkstate-off" : ""), title: unreachable ? String(answer.error || "") : "" },
        checking ? h("span", { className: "pp-checkspin", "aria-hidden": "true" }) : null,
        checking ? "Checking Canvas…" : unreachable ? "Couldn't reach Canvas — this machine's record" : answer.at ? "Checked Canvas " + when(answer.at) : ""
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn pp-iconbtn",
          disabled: checking,
          "aria-busy": checking ? "true" : void 0,
          "aria-label": "Check Canvas again",
          title: "Check Canvas again",
          onClick: recheck
        },
        checking ? "" : "↻"
      )
    ),
    rows.map((entry) => {
      const state2 = said.get(entry.id);
      const of = Math.max(entry.submitted, entry.graded, 1);
      const done = Math.min(100, 100 * entry.graded / of);
      const part = Math.min(100 - done, 100 * (entry.partial || 0) / of);
      return h(
        React.Fragment,
        { key: entry.id },
        h(
          "div",
          { className: "pp-bookrow" + (open2 === entry.id ? " pp-bookrow-open" : "") },
          h(TitleWithTag, { title: entry.title }),
          h(
            "span",
            { className: "pp-bookprogress", title: state2.marking },
            h(
              "span",
              { className: "pp-bar", "aria-hidden": "true" },
              h("i", { className: "pp-bar-done", style: { width: done + "%" } }),
              part ? h("i", { className: "pp-bar-part", style: { width: part + "%" } }) : null
            ),
            h("span", { className: "pp-booknum" }, entry.submitted === 0 && entry.graded === 0 ? "—" : entry.graded + "/" + entry.submitted)
          ),
          h(
            "span",
            { className: "pp-bookcanvas" },
            state2.canvas ? h("span", { className: "pp-chip " + (state2.behind ? "pp-chip-warn" : "pp-chip-ok") }, state2.canvas) : null,
            // Nowhere to send these: the student is not in the Canvas course.
            state2.stuck ? h(
              "span",
              {
                className: "pp-chip",
                title: "These students are not enrolled in the Canvas course, so their marks have nowhere to go. Add them in Canvas, then check again."
              },
              state2.stuck
            ) : null,
            // Someone changed these in Canvas itself; the check reports them and
            // never adopts them. The preview under Send… shows whose.
            (edited.get(entry.id) || []).length ? h(
              "span",
              {
                className: "pp-chip pp-chip-live",
                title: "Changed in Canvas, not here. Open Send… to see whose; a send would leave them alone."
              },
              edited.get(entry.id).length + " changed in Canvas"
            ) : null,
            state2.behind || open2 === entry.id ? h(
              "button",
              { type: "button", className: "pp-segbtn pp-sendbtn", "aria-expanded": open2 === entry.id, onClick: () => setOpen(open2 === entry.id ? null : entry.id) },
              open2 === entry.id ? "Close" : "Send…"
            ) : null
          )
        ),
        open2 === entry.id ? h(
          "div",
          { className: "pp-bookdrawer" },
          h(CanvasMarks, {
            runId: props.runId,
            sessionId: props.sessionId,
            assessmentId: entry.id,
            title: entry.title,
            ask: props.ask,
            names: props.names,
            canvas: entry.canvas,
            autoPreview: true,
            onSent: props.onWrite
          })
        ) : null
      );
    })
  );
}
function useMarksActivity(runId, sessionId, revision, names) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    if (!runId) return void 0;
    let live = true;
    fetch(
      scoped(BASE + "/api/marks-activity?run=" + encodeURIComponent(runId) + (names ? "&names=1" : "") + "&r=" + revision, sessionId),
      { headers: { accept: "application/json" } }
    ).then((response) => response.json()).then((value) => live && setState({ phase: "ready", value })).catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision, names]);
  return state;
}
var SHEET_CHECK_EVERY = 5 * 60 * 1e3;
function useSheetCheck(runId, sessionId, revision) {
  const [value, setValue] = React.useState(null);
  React.useEffect(() => {
    if (!runId) return void 0;
    let live = true;
    const ask = () => {
      if (document.visibilityState === "hidden") return;
      fetch(scoped(BASE + "/api/sheet-check?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
        headers: { accept: "application/json" }
      }).then((response) => response.json()).then((answer) => live && setValue(answer)).catch(() => {
      });
    };
    ask();
    const timer = setInterval(ask, SHEET_CHECK_EVERY);
    const onShow = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [runId, sessionId, revision]);
  return value;
}
var changeMark = (check) => check.sync + "|" + (check.modified || check.last_synced || "");
var sheetSeenKey = (runId) => "pp-sheet-seen:" + runId;
var readSheetSeen = (runId) => {
  try {
    return window.localStorage.getItem(sheetSeenKey(runId));
  } catch {
    return null;
  }
};
var writeSheetSeen = (runId, at) => {
  try {
    window.localStorage.setItem(sheetSeenKey(runId), at);
  } catch {
  }
};
var countWords = (event) => [
  event.added ? event.added + " new" : null,
  event.changed ? event.changed + " changed" : null,
  event.removed ? event.removed + " taken back" : null
].filter(Boolean).join(" · ");
var sourceWords = (event) => event.read === "sheet" ? "read from the sheet in Google" : "from the copy downloaded " + (when(event.saved) || "at an unknown time");
var markWords = (change) => {
  const points = (value) => value === null || value === void 0 ? "—" : String(value);
  if (change.from === null && change.score_from === null) return (change.to || "?") + (change.score_to !== null ? " · " + points(change.score_to) : "");
  if (change.to === null && change.score_to === null) return "taken back (was " + (change.from || "a mark") + ")";
  const words = change.from === change.to ? change.to || "" : (change.from || "—") + " → " + (change.to || "—");
  const scores = change.score_from === change.score_to ? "" : points(change.score_from) + " → " + points(change.score_to);
  return [words, scores].filter(Boolean).join(" · ");
};
function SheetNotice(props) {
  return h(
    React.Fragment,
    null,
    h(SheetChangedNotice, props),
    h(SheetSyncedNotice, props)
  );
}
function SheetChangedNotice(props) {
  const answer = useSheetCheck(props.runId, props.sessionId, props.revision);
  const storeKey = "pp-sheet-change-seen:" + props.runId;
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return window.localStorage.getItem(storeKey);
    } catch {
      return null;
    }
  });
  if (!answer || !answer.available || !answer.checks) return null;
  const changed = answer.checks.find((check) => check.state === "changed" && changeMark(check) !== dismissed);
  if (!changed) return null;
  const dismiss = () => {
    const mark = changeMark(changed);
    try {
      window.localStorage.setItem(storeKey, mark);
    } catch {
    }
    setDismissed(mark);
  };
  return h(
    "div",
    { className: "pp-sheetnotice pp-sheetnotice-changed", role: "status" },
    h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
    h(
      "span",
      { className: "pp-sheetnoticetext" },
      h("b", null, "Your grade sheet changed in Google"),
      (changed.modified ? " — edited " + when(changed.modified) : "") + (changed.last_synced ? "; last synced " + when(changed.last_synced) : "") + ". Nothing has come in yet."
    ),
    props.onSync ? h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        onClick: () => {
          dismiss();
          props.onSync();
        }
      },
      "Preview the sync"
    ) : null,
    h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×")
  );
}
function SheetSyncedNotice(props) {
  const state = useMarksActivity(props.runId, props.sessionId, props.revision, false);
  const [seen, setSeen] = React.useState(() => readSheetSeen(props.runId));
  React.useEffect(() => setSeen(readSheetSeen(props.runId)), [props.runId]);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const latest = (state.value.events || []).find((event) => event.changes.length);
  if (!latest) return null;
  const fresh = seen ? Date.parse(latest.at) > Date.parse(seen) : Date.now() - Date.parse(latest.at) < 2 * 864e5;
  if (!fresh) return null;
  const dismiss = () => {
    const newest = state.value.events[0].at;
    writeSheetSeen(props.runId, newest);
    setSeen(newest);
  };
  return h(
    "div",
    { className: "pp-sheetnotice", role: "status" },
    h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
    h(
      "span",
      { className: "pp-sheetnoticetext" },
      h("b", null, "Grade sheet synced " + (when(latest.at) || "")),
      " — marks: " + countWords(latest) + "; " + sourceWords(latest) + "."
    ),
    props.onOpen ? h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        onClick: () => {
          dismiss();
          props.onOpen();
        }
      },
      "See in Gradebook"
    ) : null,
    h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×")
  );
}
function RecentMarks(props) {
  const state = useMarksActivity(props.runId, props.sessionId, props.revision, props.names);
  const [open2, setOpen] = React.useState(false);
  if (state.phase === "loading" || !state.value || state.value.error) return null;
  const events = state.value.events || [];
  if (!events.length) return null;
  const SHOWN = 6;
  const shown = open2 ? events : events.slice(0, 2);
  const more = events.length > 2 || shown.some((event) => event.changes.length > SHOWN);
  return h(
    "div",
    { className: "pp-bookcard pp-recentmarks" },
    h(
      "div",
      { className: "pp-cardhead" },
      h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
      h("b", null, "Last added from the grade sheet"),
      more ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setOpen(!open2) }, open2 ? "Fewer" : "Show all") : null
    ),
    shown.map((event) => {
      const rows = open2 ? event.changes : event.changes.slice(0, SHOWN);
      return h(
        "div",
        { className: "pp-recentrun" + (event.changes.length ? "" : " pp-recentquiet"), key: event.sync + event.at },
        h(
          "div",
          { className: "pp-recentwhen", title: "Synced " + new Date(event.at).toLocaleString() + (event.saved ? "; sheet as of " + new Date(event.saved).toLocaleString() : "") },
          h("span", null, when(event.at)),
          event.changes.length ? h("span", { className: "pp-chip pp-chip-ok" }, countWords(event)) : h("span", { className: "pp-chip" }, "nothing changed"),
          h("span", { className: "pp-as" }, sourceWords(event))
        ),
        rows.length ? h(
          "ul",
          { className: "pp-recentlist" },
          rows.map(
            (change) => h(
              "li",
              { key: change.student + change.assessment },
              h("span", { className: "pp-avatar", "aria-hidden": "true" }, initials(change.name || change.student)),
              h("span", { className: "pp-recentwho" }, change.name || change.student),
              h(TitleWithTag, { title: change.title }),
              h(
                "span",
                { className: change.to === null && change.score_to === null ? "pp-behind" : "pp-recentmark" },
                markWords(change)
              )
            )
          )
        ) : null,
        event.changes.length > rows.length ? h("div", { className: "pp-as" }, "… and " + (event.changes.length - rows.length) + " more") : null
      );
    })
  );
}
function Unpublished(props) {
  const state = useUnpublished(props.runId, props.sessionId, props.revision);
  const [open2, setOpen] = React.useState(null);
  if (state.phase === "loading") return h(Message, null, "Reading what has gone out…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);
  const nothing = !doc.marks.length && !doc.drafts.length && !doc.moved.length;
  const section = (title, rows) => rows.length ? h(React.Fragment, null, h("p", { className: "pp-factgroup" }, title), rows) : null;
  return h(
    "div",
    { className: "pp-scroll" },
    h(
      "p",
      { className: "pp-as" },
      "Read from this machine: the gradebook, what Canvas confirmed receiving, and what was last published. Canvas is not asked, so an edit made there by hand does not show."
    ),
    nothing ? h(Message, null, "Everything decided here is out: no marks waiting for Canvas, no drafts held back, no material changed since it was published.") : null,
    section(
      "Marks not in Canvas",
      doc.marks.sort(dueOrder).map((entry) => {
        const said = markState(entry);
        const binding = entry.binding.state === "none" ? "no Canvas assignment yet" : entry.binding.state === "some" ? "no Canvas assignment in " + entry.binding.missing.join(", ") : null;
        return h(
          "div",
          { key: entry.id },
          h(
            "div",
            { className: "pp-approverow" },
            h("b", null, entry.title),
            h("span", null, said.canvas),
            binding ? h("span", { className: "pp-behind" }, binding) : null,
            h(
              "button",
              { type: "button", className: "pp-segbtn", onClick: () => setOpen(open2 === entry.id ? null : entry.id) },
              open2 === entry.id ? "Close" : "Send…"
            )
          ),
          open2 === entry.id ? h(CanvasMarks, {
            key: entry.id,
            runId: props.runId,
            sessionId: props.sessionId,
            assessmentId: entry.id,
            title: entry.title,
            ask: props.ask,
            names: props.names,
            canvas: entry.canvas,
            autoPreview: true,
            onSent: props.onWrite
          }) : null
        );
      })
    ),
    section(
      "Changed since published",
      doc.moved.map(
        (entry) => h(
          "div",
          { className: "pp-approverow", key: entry.documentId + "|" + entry.target + "|" + entry.scope },
          h("b", null, entry.title),
          h("span", null, "changed since it went to " + entry.where + " on " + String(entry.at).slice(0, 10)),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              onClick: () => props.openPublish(entry.target, entry.target === "page" || entry.target === "telegram" ? {} : { assessment: entry.scope })
            },
            "Publish again…"
          )
        )
      )
    ),
    section(
      "Drafts a publication leaves out",
      doc.drafts.length ? [
        h(
          "p",
          { className: "pp-as", key: "how" },
          "Accepting one is your edit: change approval: draft to approved in its record, then publish."
        )
      ].concat(
        doc.drafts.map(
          (entry) => h(
            "div",
            { className: "pp-approverow", key: entry.collection + "|" + entry.id },
            h("b", null, entry.title || entry.id),
            h("span", { className: "pp-as" }, entry.collection + " · " + entry.id)
          )
        )
      ) : []
    )
  );
}

// client/canvas-card.js
var hostName = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
var shortDate2 = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
};
var canvasCoursesOf = (data) => {
  const perSubgroup = data.subgroupCourses || { map: {}, perSubgroup: false };
  if (perSubgroup.perSubgroup) return perSubgroup.map;
  return data.canvasCourse && data.canvasCourse.id ? { "": data.canvasCourse.id } : {};
};
var columnsOf = (assessment, courses) => {
  const groups = Object.keys(courses);
  if (groups.length === 1 && groups[0] === "") {
    return { "": assessment.canvasAssignmentId || null };
  }
  const out = {};
  for (const group of groups) out[group] = (assessment.canvasAssignments || {})[group] || null;
  return out;
};
var assignmentUrl = (host, courseId, assignmentId) => host && courseId && assignmentId ? String(host).replace(/\/+$/, "") + "/courses/" + courseId + "/assignments/" + assignmentId : null;
var byDue = (left, right) => String(left.a.dueAt || "9999").localeCompare(String(right.a.dueAt || "9999")) || String(left.a.title || left.a.assessmentId).localeCompare(String(right.a.title || right.a.assessmentId));
var postSync = (runId, sessionId, body) => fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(runId || ""), sessionId), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
}).then((response) => response.json()).catch((error) => ({ error: String(error && error.message || error) }));
function CanvasRead(props) {
  const [busy, setBusy] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const sync = props.sync;
  if (!sync) return null;
  const press2 = (action) => {
    setBusy(action);
    postSync(props.runId, props.sessionId, {
      action,
      sync: sync.id,
      assessment: props.assessmentId || "",
      confirm: false,
      names: Boolean(props.names)
    }).then((answer) => {
      setBusy(null);
      setResult(Object.assign({ action }, answer));
      if (action === "run" && props.onWrite) props.onWrite();
    });
  };
  return h(
    "div",
    { className: "pp-cread" },
    h(
      "div",
      { className: "pp-creadline" },
      h(
        "span",
        { className: "pp-creadname" },
        props.label,
        h(
          "span",
          { className: "pp-as" },
          // The last run is per sync, not per assessment, so a hand-ins line
          // under one assessment says nothing about when: it would be the date
          // some other assessment's hand-ins came in.
          props.assessmentId ? "" : sync.lastSynced ? " · " + when(sync.lastSynced) : " · never"
        )
      ),
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => press2("plan") },
        busy === "plan" ? "Looking…" : "Preview"
      ),
      sync.live ? null : h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: Boolean(busy) || !sync.enabled,
          onClick: () => press2("run")
        },
        busy === "run" ? "Running…" : "Run"
      )
    ),
    result ? h(
      "pre",
      { className: "pp-approveout" + (result.error || !result.ok ? " pp-approveerr" : "") },
      (result.error ? "" : result.action === "run" ? "Done.\n" : "Preview — nothing was changed.\n") + (result.error || result.output || "(nothing printed)")
    ) : null
  );
}
function DefinitionPush(props) {
  const subgroups = (props.subgroups || []).map((entry) => entry.group);
  const [group, setGroup] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [result, setResult] = React.useState(null);
  const [overwrite, setOverwrite] = React.useState(false);
  const reset = () => {
    setResult(null);
    setOverwrite(false);
  };
  const call = (confirm) => {
    setPhase(confirm ? "sending" : "planning");
    fetch(
      scoped(BASE + "/api/canvas/assignment?run=" + encodeURIComponent(props.runId || ""), props.sessionId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessment: props.assessmentId,
          group,
          confirm,
          overwriteDrift: confirm && overwrite
        })
      }
    ).then((response) => response.json()).then((body) => {
      setPhase("idle");
      if (body.error) {
        setResult({ failed: true, text: body.error, sent: false });
        return;
      }
      setResult({
        failed: !body.ok,
        text: body.output || (body.ok ? "Canvas had nothing to change." : "No output."),
        sent: confirm && body.ok
      });
      if (confirm) {
        setOverwrite(false);
        if (body.ok && props.onWrite) props.onWrite();
      }
    }).catch((error) => {
      setPhase("idle");
      setResult({ failed: true, text: String(error && error.message || error), sent: false });
    });
  };
  const sawDrift = Boolean(result) && !result.failed && /edited in Canvas/.test(result.text);
  const previewed = Boolean(result) && !result.failed && !result.sent;
  return h(
    "div",
    null,
    h(
      "div",
      { className: "pp-approverow" },
      subgroups.length ? h(
        "select",
        {
          className: "pp-bindsel",
          value: group,
          "aria-label": "Which subgroup's Canvas course",
          onChange: (event) => {
            setGroup(event.target.value);
            reset();
          }
        },
        [h("option", { value: "", key: "*" }, "Every subgroup")].concat(
          subgroups.map((name) => h("option", { value: name, key: name }, name))
        )
      ) : null,
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: phase !== "idle", onClick: () => call(false) },
        phase === "planning" ? "Asking Canvas…" : "Preview what Canvas would get"
      ),
      previewed ? h(
        "button",
        {
          type: "button",
          className: "pp-segbtn pp-danger",
          disabled: phase !== "idle",
          onClick: () => call(true)
        },
        phase === "sending" ? "Sending…" : "Send to Canvas"
      ) : null
    ),
    sawDrift ? h(
      "label",
      { className: "pp-savenote" },
      h("input", {
        type: "checkbox",
        checked: overwrite,
        onChange: (event) => setOverwrite(event.target.checked)
      }),
      " Also replace what was edited in Canvas"
    ) : null,
    result ? h("pre", { className: "pp-approveout" + (result.failed ? " pp-approveerr" : "") }, result.text) : null
  );
}
function ColumnLinks(props) {
  const { assessment, courses, host } = props;
  const columns = columnsOf(assessment, courses);
  const single = Object.keys(courses).length === 1 && Object.keys(courses)[0] === "";
  const [lists, setLists] = React.useState({});
  const [picks, setPicks] = React.useState({});
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);
  const choose = (group) => {
    setLists((all) => Object.assign({}, all, { [group]: "loading" }));
    fetch(scoped(BASE + "/api/canvas/assignments?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: courses[group] })
    }).then((response) => response.json()).then(
      (body) => setLists((all) => Object.assign({}, all, { [group]: body.error ? { error: body.error } : body.assignments || [] }))
    ).catch((error) => setLists((all) => Object.assign({}, all, { [group]: { error: String(error) } })));
  };
  const save = (group, value) => {
    setPhase("saving");
    setFailed(null);
    let link;
    if (single) link = value || null;
    else {
      const merged = Object.assign({}, assessment.canvasAssignments || {});
      if (value) merged[group] = value;
      else delete merged[group];
      link = Object.keys(merged).length ? merged : null;
    }
    fetch(scoped(BASE + "/api/canvas/assignment-map?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links: { [assessment.assessmentId]: link } })
    }).then((response) => response.json()).then((body) => {
      setPhase("idle");
      if (body.error) return setFailed(body.error);
      setLists((all) => Object.assign({}, all, { [group]: void 0 }));
      setPicks((all) => Object.assign({}, all, { [group]: void 0 }));
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => {
      setPhase("idle");
      setFailed(String(error && error.message || error));
    });
  };
  return h(
    "div",
    null,
    Object.keys(columns).map((group) => {
      const id = columns[group];
      const list = lists[group];
      const url = assignmentUrl(host, courses[group], id);
      return h(
        "div",
        { className: "pp-bind", key: group || "run" },
        h("span", { className: "pp-bindname" }, group || "Canvas"),
        Array.isArray(list) ? h(
          React.Fragment,
          null,
          h(
            "select",
            {
              className: "pp-bindsel",
              value: picks[group] ?? id ?? "",
              onChange: (event) => setPicks((all) => Object.assign({}, all, { [group]: event.target.value }))
            },
            h("option", { value: "" }, "— not linked —"),
            list.map(
              (assignment) => h(
                "option",
                { value: assignment.id, key: assignment.id },
                assignment.name + (assignment.points == null ? "" : " · " + assignment.points + " pts")
              )
            )
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase !== "idle" || (picks[group] ?? id ?? "") === (id ?? ""),
              onClick: () => save(group, picks[group] ?? "")
            },
            phase === "saving" ? "Saving…" : "Save"
          )
        ) : h(
          React.Fragment,
          null,
          h(
            "span",
            { className: "pp-ccol" + (id ? "" : " pp-no") },
            id ? url ? h("a", { href: url, target: "_blank", rel: "noreferrer", title: "Open it in Canvas" }, id + " ↗") : id : "not linked"
          ),
          list && list.error ? h("span", { className: "pp-saveerr" }, list.error) : h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: list === "loading",
              title: "Ask Canvas for this course's assignments. A read; it sends your token.",
              onClick: () => choose(group)
            },
            list === "loading" ? "Asking Canvas…" : id ? "Change…" : "Choose…"
          )
        )
      );
    }),
    failed ? h("p", { className: "pp-saveerr" }, failed) : null
  );
}
function CanvasSections(props) {
  const data = props.data;
  const seed = (rows) => {
    const out = {};
    for (const row of rows || []) {
      out[row.kind + ":" + row.id] = { id: row.id, kind: row.kind, name: row.name, group: row.group };
    }
    return out;
  };
  const [catalogue, setCatalogue] = React.useState(null);
  const [fetching, setFetching] = React.useState(false);
  const [picked, setPicked] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const chosen = picked || seed(data.selections);
  const key = (option) => option.kind + ":" + option.id;
  React.useEffect(() => setPicked(null), [data]);
  const load = () => {
    setFetching(true);
    setStatus(null);
    fetch(scoped(BASE + "/api/canvas/catalogue?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST"
    }).then((response) => response.json()).then((body) => {
      setFetching(false);
      if (body.error) return setStatus({ error: body.error });
      setCatalogue(body);
    }).catch((error) => {
      setFetching(false);
      setStatus({ error: String(error && error.message || error) });
    });
  };
  const toggle = (option) => setPicked(() => {
    const next = Object.assign({}, chosen);
    if (Object.hasOwn(next, key(option))) delete next[key(option)];
    else {
      next[key(option)] = {
        id: option.id,
        kind: option.kind,
        name: option.name,
        // One subgroup and nothing to decide: bind it.
        group: data.subgroups.length === 1 ? data.subgroups[0].group : null
      };
    }
    return next;
  });
  const bind = (option, group) => setPicked(() => {
    const next = Object.assign({}, chosen);
    if (!next[key(option)]) return next;
    next[key(option)] = Object.assign({}, next[key(option)], { group: group || null });
    return next;
  });
  const save = () => {
    setStatus("saving");
    fetch(scoped(BASE + "/api/canvas/selection?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selections: Object.values(chosen) })
    }).then((response) => response.json()).then((body) => {
      if (body.error) return setStatus({ error: body.error });
      setStatus({ saved: body.saved });
      if (props.onSaved) props.onSaved(body);
    }).catch((error) => setStatus({ error: String(error && error.message || error) }));
  };
  const offered = catalogue ? catalogue.options : data.selections.map((row) => ({ id: row.id, kind: row.kind, name: row.name || row.id, students: null, sisId: null }));
  const canonical = (table) => Object.keys(table).sort().map((entry) => `${entry}\0${table[entry].group || ""}\0${table[entry].name || ""}`).join("\0\0");
  const dirty = canonical(seed(data.selections)) !== canonical(chosen);
  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "Sections and groups"),
    h(
      "p",
      { className: "pp-as" },
      data.subgroups.length ? "Which Canvas section or student group feeds which subgroup. The class list sync reads this." + (data.ungrouped ? " " + data.ungrouped + " active student" + (data.ungrouped === 1 ? "" : "s") + " carry no subgroup." : "") : "This run has no subgroups, so a section ticked here only says it belongs to this run."
    ),
    h(
      "div",
      { className: "pp-approverow" },
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: fetching, onClick: load },
        fetching ? "Asking Canvas…" : catalogue ? "Fetch again" : "Fetch from Canvas"
      ),
      catalogue ? h("span", { className: "pp-savenote" }, catalogue.options.length + " in course " + catalogue.courseId) : null
    ),
    offered.length === 0 ? h("p", { className: "pp-as" }, catalogue ? "Canvas returned no sections or groups." : "Nothing is mapped yet.") : offered.map((option) => {
      const on = Object.hasOwn(chosen, key(option));
      return h(
        "div",
        { className: "pp-pick", key: key(option) },
        h("input", {
          type: "checkbox",
          className: "pp-pickbox",
          checked: on,
          onChange: () => toggle(option),
          "aria-label": option.name
        }),
        h(
          "span",
          { className: "pp-picklabel" },
          option.name,
          h(
            "span",
            { className: "pp-factnote" },
            option.kind + " " + option.id + (option.students == null ? "" : " · " + option.students + " students") + (option.sisId ? " · SIS " + option.sisId : "")
          )
        ),
        on && data.subgroups.length ? h(
          "select",
          {
            className: "pp-prefctl pp-picksel",
            value: chosen[key(option)] && chosen[key(option)].group || "",
            onChange: (event) => bind(option, event.target.value),
            "aria-label": "Which subgroup " + option.name + " feeds"
          },
          [h("option", { value: "", key: "" }, "the whole run")].concat(
            data.subgroups.map(
              (entry) => h("option", { value: entry.group, key: entry.group }, entry.group + " (" + entry.students + ")")
            )
          )
        ) : null
      );
    }),
    dirty || status && (status.error || status.saved) ? h(
      "div",
      { className: "pp-approverow" },
      dirty ? h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: status === "saving", onClick: save },
        status === "saving" ? "Saving…" : "Save"
      ) : null,
      dirty ? h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          onClick: () => {
            setPicked(null);
            setStatus(null);
          }
        },
        "Revert"
      ) : null,
      status && status.error ? h("span", { className: "pp-saveerr" }, status.error) : null,
      status && status.saved && !dirty ? h("span", { className: "pp-savenote" }, "Saved to " + status.saved.path + ".") : null
    ) : null
  );
}
var rowState = (entry, reachable) => {
  const parts = [];
  const { linked, of } = entry.link;
  if (reachable) {
    parts.push(
      linked === of ? { key: "col", text: "linked", tone: "ok" } : { key: "col", text: linked ? linked + " of " + of + " linked" : "not linked", tone: "warn" }
    );
  }
  parts.push(
    entry.a.definitionSent ? { key: "def", text: "brief sent " + shortDate2(entry.a.definitionSent), tone: "" } : { key: "def", text: "no brief sent", tone: "quiet" }
  );
  const c = entry.u && entry.u.canvas;
  if (!c || c.ready === 0) parts.push({ key: "marks", text: "no marks yet", tone: "quiet" });
  else if (c.unsent + c.changed === 0) parts.push({ key: "marks", text: "all " + c.ready + " marks in", tone: "ok" });
  else parts.push({ key: "marks", text: c.unsent + c.changed + " marks to send", tone: "warn" });
  return parts;
};
var ROWS_AT_FIRST = 8;
var canvasCounts = (data, unpublished) => {
  const courses = canvasCoursesOf(data);
  const usage = {};
  for (const entry of unpublished && unpublished.assessments || []) usage[entry.id] = entry;
  const rows = (data.assessments || []).map((a) => {
    const columns = columnsOf(a, courses);
    const ids = Object.values(columns);
    return {
      a,
      u: usage[a.assessmentId] || null,
      link: { linked: ids.filter(Boolean).length, of: Math.max(ids.length, 1) }
    };
  });
  rows.sort(byDue);
  const unlinked = rows.filter((entry) => entry.link.linked < entry.link.of);
  const toSend = rows.filter((entry) => entry.u && entry.u.canvas && entry.u.canvas.unsent + entry.u.canvas.changed > 0);
  return { courses, rows, unlinked, toSend };
};
function CanvasCard(props) {
  const data = props.data;
  const row = (data.integrations || []).find((entry) => entry.id === "canvas");
  const [filter, setFilter] = React.useState(props.filter || null);
  const [more, setMore] = React.useState(false);
  const [open2, setOpen] = React.useState(null);
  const [binding, setBinding] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [tokenError, setTokenError] = React.useState(null);
  React.useEffect(() => {
    if (props.filter) {
      setFilter(props.filter);
      setMore(false);
    }
  }, [props.filter, props.filterTick]);
  if (!row) return null;
  const [hostStep, tokenStep, courseStep] = row.steps;
  const reachable = hostStep.done && tokenStep.done && courseStep.done;
  const { courses, rows, unlinked, toSend } = canvasCounts(data, props.unpublished);
  const courseCount = Object.keys(courses).length;
  const subgroupCourses = data.subgroupCourses || { map: {}, perSubgroup: false, conflict: false };
  const rosterSync = props.syncs ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "roster") : null;
  const handInSync = props.syncs ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "submissions") : null;
  const saved = (body) => {
    if (props.onSaved) props.onSaved(body);
  };
  const subtitle = [
    data.canvas.host ? hostName(data.canvas.host) : "no address",
    // The token is the account's (Integrations → Accounts); said here only
    // when it is missing.
    tokenStep.done ? null : "no token",
    subgroupCourses.perSubgroup ? courseCount + " course" + (courseCount === 1 ? "" : "s") + ", one per subgroup" : data.canvasCourse.id ? "course " + data.canvasCourse.id : "no course"
  ].filter(Boolean).join(" · ");
  const chip = !reachable ? { text: "setup needed", tone: "warn" } : unlinked.length ? { text: rows.length - unlinked.length + " of " + rows.length + " linked", tone: "warn" } : { text: "ready", tone: "ok" };
  const attention = rows.filter((entry) => reachable && unlinked.includes(entry) || toSend.includes(entry));
  const current = filter || (attention.length ? "attention" : "all");
  const matching = rows.filter(
    (entry) => current === "unlinked" ? unlinked.includes(entry) : current === "marks" ? toSend.includes(entry) : current === "attention" ? attention.includes(entry) : true
  );
  const shown = more ? matching : matching.slice(0, ROWS_AT_FIRST);
  const choose = (id) => {
    setFilter(id);
    setMore(false);
  };
  const setup = reachable ? null : h(
    "div",
    { className: "pp-csetup" },
    h(
      "ul",
      { className: "pp-steps" },
      [hostStep, tokenStep, courseStep].map(
        (entry, index) => h(
          "li",
          { className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"), key: index },
          h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
          h("span", null, entry.label)
        )
      )
    ),
    !hostStep.done ? h(ProviderSetup, { integration: row, runId: props.runId, sessionId: props.sessionId, onSaved: saved }) : !tokenStep.done ? (
      // The address is known, so only the token is asked for — the
      // setup form would make the professor type the address again.
      h(
        "div",
        null,
        h(Secret, {
          name: data.canvas.tokenEnv,
          status: ((data.credentials || {}).refs || {})[data.canvas.tokenEnv],
          runId: props.runId,
          sessionId: props.sessionId,
          onSaved: saved,
          onStatus: (next) => setTokenError(next && next.error ? next.error : null)
        }),
        h(
          "p",
          { className: "pp-as" },
          "Canvas → Account → Settings → New Access Token. It goes to the credential store and is never shown again."
        ),
        tokenError ? h("p", { className: "pp-saveerr" }, tokenError) : null
      )
    ) : data.subgroups.length ? h(SubgroupCourses, {
      runId: props.runId,
      sessionId: props.sessionId,
      subgroups: data.subgroups,
      state: subgroupCourses,
      onSaved: saved
    }) : h(
      "p",
      { className: "pp-as" },
      "Record the Canvas course on the run as extensions.lms.canvas_course_id — the number in the course's Canvas address" + (data.run.recordPath ? ", in " + data.run.recordPath : "") + "."
    ),
    data.setup && data.setup.provider === "canvas" && data.setup.checkFailed ? h("p", { className: "pp-saveerr" }, data.setup.checkFailed) : null
  );
  const panel = (entry) => h(
    "div",
    { className: "pp-cpanel" },
    h("p", { className: "pp-factgroup" }, "Canvas assignment"),
    h(ColumnLinks, {
      assessment: entry.a,
      courses,
      host: data.canvas.host,
      runId: props.runId,
      sessionId: props.sessionId,
      onSaved: saved
    }),
    h("p", { className: "pp-factgroup" }, "Definition"),
    h(
      "p",
      { className: "pp-as" },
      "Title, points, dates, what may be handed in, and the brief as the description. " + (entry.a.definitionSent ? "Last sent from this computer " + when(entry.a.definitionSent) + "." : "Not sent from this computer. Where there is no assignment yet, sending creates it and links it.")
    ),
    h(DefinitionPush, {
      assessmentId: entry.a.assessmentId,
      subgroups: subgroupCourses.perSubgroup ? data.subgroups : [],
      runId: props.runId,
      sessionId: props.sessionId,
      onWrite: props.onWrite
    }),
    h("p", { className: "pp-factgroup" }, "Marks"),
    h(CanvasMarks, {
      runId: props.runId,
      sessionId: props.sessionId,
      assessmentId: entry.a.assessmentId,
      title: entry.a.title || entry.a.assessmentId,
      canvas: entry.u ? entry.u.canvas : null,
      ask: props.ask,
      onSent: () => {
        if (props.onWrite) props.onWrite();
      }
    }),
    handInSync ? h(
      React.Fragment,
      null,
      h("p", { className: "pp-factgroup" }, "Hand-ins"),
      h(CanvasRead, {
        sync: handInSync,
        label: "What students handed in, from Canvas",
        assessmentId: entry.a.assessmentId,
        runId: props.runId,
        sessionId: props.sessionId,
        names: props.names,
        onWrite: props.onWrite
      })
    ) : null
  );
  const assessmentRow = (entry) => {
    const id = entry.a.assessmentId;
    const expanded = open2 === id;
    return h(
      "div",
      { className: "pp-crow" + (expanded ? " pp-crow-open" : ""), key: id },
      h(
        "button",
        {
          type: "button",
          className: "pp-crowhead",
          "aria-expanded": expanded,
          onClick: () => setOpen(expanded ? null : id)
        },
        h("span", { className: "pp-crowchev", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
        h(
          "span",
          { className: "pp-crowtitle" },
          entry.a.title || id,
          entry.a.dueAt ? h("span", { className: "pp-as" }, " · due " + shortDate2(entry.a.dueAt)) : null
        ),
        h(
          "span",
          { className: "pp-crowstate" },
          rowState(entry, reachable).map(
            (part, index) => h(
              React.Fragment,
              { key: part.key },
              index ? h("span", { className: "pp-crowsep", "aria-hidden": "true" }, " · ") : null,
              h("span", { className: part.tone ? "pp-st-" + part.tone : null }, part.text)
            )
          )
        )
      ),
      expanded ? panel(entry) : null
    );
  };
  const details = h(
    "details",
    { className: "pp-cdetails" },
    h("summary", null, "Details"),
    h(
      Fact,
      { label: "Address", note: data.canvas.hostFrom || "not configured", missing: !data.canvas.host },
      data.canvas.host || h(Presence, { present: false, no: "not set" })
    ),
    h(
      Fact,
      { label: "Token", note: data.canvas.tokenEnv + " — never shown, only whether it is there", missing: !tokenStep.done },
      h(Presence, { present: tokenStep.done, yes: "saved", no: "not set" })
    ),
    Object.keys(courses).map(
      (group) => h(
        Fact,
        { label: group ? "Course · " + group : "Course", key: "course:" + group },
        data.canvas.host ? h(
          "a",
          { href: String(data.canvas.host).replace(/\/+$/, "") + "/courses/" + courses[group], target: "_blank", rel: "noreferrer" },
          courses[group] + " ↗"
        ) : courses[group]
      )
    ),
    data.canvasCourse.fromColumn && !data.canvasCourse.fromExtension && !subgroupCourses.perSubgroup ? h(
      "p",
      { className: "pp-saveerr" },
      "The course id is in lms_course_id, which a push does not read. It reads extensions.lms.canvas_course_id."
    ) : null,
    subgroupCourses.conflict ? h(
      "p",
      { className: "pp-saveerr" },
      "The run also sets a single Canvas course (" + subgroupCourses.singleId + "). A record cannot hold both."
    ) : null,
    h(
      Fact,
      {
        label: "Grades go to",
        note: data.target.value === null ? "the run's gradebook target, not recorded yet" : "the run's gradebook target",
        missing: data.target.value === null || data.target.supported === false
      },
      data.target.value || h(Presence, { present: false, no: "not recorded" })
    ),
    data.run.recordPath ? h(Fact, { label: "Run record", note: "where the course ids and columns are written" }, data.run.recordPath) : null,
    h(
      "div",
      { className: "pp-approverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": editing === "access",
          onClick: () => setEditing(editing === "access" ? null : "access")
        },
        "Change address or token"
      ),
      data.subgroups.length ? h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": editing === "courses",
          onClick: () => setEditing(editing === "courses" ? null : "courses")
        },
        "Change courses"
      ) : null
    ),
    editing === "access" ? h(ProviderSetup, {
      integration: row,
      runId: props.runId,
      sessionId: props.sessionId,
      onCancel: () => setEditing(null),
      onSaved: (body) => {
        setEditing(null);
        saved(body);
      }
    }) : null,
    editing === "courses" ? h(SubgroupCourses, {
      runId: props.runId,
      sessionId: props.sessionId,
      subgroups: data.subgroups,
      state: subgroupCourses,
      onSaved: (body) => {
        setEditing(null);
        saved(body);
      }
    }) : null,
    reachable ? h(CanvasSections, { data, runId: props.runId, sessionId: props.sessionId, onSaved: saved }) : null
  );
  const filters = [
    { id: "attention", label: "Needs something " + attention.length, hide: !attention.length },
    { id: "all", label: "All " + rows.length },
    { id: "unlinked", label: "Not linked " + unlinked.length, hide: current !== "unlinked" },
    { id: "marks", label: "Marks to send " + toSend.length, hide: current !== "marks" }
  ].filter((entry) => !entry.hide);
  return h(
    "section",
    // The id is what the Needs-you strip's Show scrolls to.
    { className: "pp-ccard", id: "pp-card-canvas" },
    h(
      "div",
      { className: "pp-chead" },
      h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"),
      h("span", { className: "pp-cname" }, "Canvas", h("span", { className: "pp-intwhat" }, subtitle)),
      h("span", { className: "pp-chip pp-chip-" + chip.tone }, chip.text)
    ),
    setup,
    reachable && rosterSync ? h(CanvasRead, {
      sync: rosterSync,
      label: "Class list",
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      onWrite: props.onWrite
    }) : null,
    rows.length ? h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pp-ctools" },
        filters.length > 1 ? filters.map(
          (entry) => h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              key: entry.id,
              "aria-pressed": current === entry.id,
              onClick: () => choose(entry.id)
            },
            entry.label
          )
        ) : h("span", { className: "pp-as" }, rows.length + " assessments"),
        h("span", { className: "pp-segspacer" }),
        reachable && unlinked.length ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            "aria-pressed": binding,
            title: "Fetch each course's assignments and pair them with the unlinked assessments by title and points",
            onClick: () => setBinding(!binding)
          },
          "Suggest pairs"
        ) : null
      ),
      binding ? h(
        "div",
        { className: "pp-cpanel" },
        h(AssignmentBinder, {
          runId: props.runId,
          sessionId: props.sessionId,
          subgroups: data.subgroups,
          courseMap: subgroupCourses.perSubgroup ? subgroupCourses.map : null,
          singleCourseId: data.canvasCourse.id,
          assessments: data.assessments,
          onSaved: (body) => {
            setBinding(false);
            saved(body);
          }
        })
      ) : null,
      h(
        "div",
        { className: "pp-crows" },
        shown.length ? shown.map(assessmentRow) : h("p", { className: "pp-as" }, "Nothing here.")
      ),
      matching.length > shown.length ? h(
        "button",
        { type: "button", className: "pp-morebtn", onClick: () => setMore(true) },
        "Show " + (matching.length - shown.length) + " more"
      ) : null
    ) : h("p", { className: "pp-as" }, "This run has no assessments yet. Drafting one is /design-assessment."),
    details
  );
}

// client/accounts.js
var bareHost = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
function AccountRow(props) {
  return h(
    "div",
    { className: "pp-acct" + (props.connected ? "" : " pp-acct-off") },
    h(
      "div",
      { className: "pp-chead" },
      h("span", { className: "pp-svc pp-svc-" + props.service, "aria-hidden": "true" }, props.mark),
      h(
        "span",
        { className: "pp-cname" },
        props.name,
        h(
          "span",
          { className: "pp-intwhat" },
          // One dot says connected or not; the words beside it say as whom.
          h("span", { className: "pp-dot" + (props.connected ? " pp-dot-on" : ""), title: props.connected ? "Connected" : "Not connected" }),
          props.status
        )
      ),
      props.action ? h(
        "button",
        { type: "button", className: "pp-segbtn", "aria-pressed": props.open, onClick: props.onToggle },
        props.open ? "Close" : props.action
      ) : null
    ),
    props.open ? h("div", { className: "pp-acctbody" }, props.children) : null,
    props.error ? h("p", { className: "pp-saveerr" }, props.error) : null
  );
}
function Accounts(props) {
  const data = props.data;
  const refs = data.credentials && data.credentials.refs || {};
  const connections = data.registry && data.registry.connections || [];
  const [open2, setOpen] = React.useState(null);
  const [errors, setErrors] = React.useState({});
  const toggle = (id) => setOpen(open2 === id ? null : id);
  const saved = (body) => {
    setErrors({});
    if (props.onSaved) props.onSaved(body);
  };
  const failed = (id) => (next) => setErrors((all) => Object.assign({}, all, { [id]: next && next.error ? next.error : null }));
  const configured = (name) => Boolean(name && refs[name] && refs[name].configured);
  const integration = (id) => (data.integrations || []).find((row) => row.id === id) || { id, fields: [] };
  const ofType = (type) => connections.filter((entry) => entry.type === type);
  const legacy = (type) => (data.connections && data.connections.profiles || []).filter((entry) => entry.type === type);
  const secret = (id, name) => h(Secret, {
    name,
    status: refs[name],
    runId: props.runId,
    sessionId: props.sessionId,
    onSaved: saved,
    onStatus: failed(id)
  });
  const canvas = data.canvas || {};
  const canvasToken = configured(canvas.tokenEnv) || canvas.tokenInEnv;
  const canvasRow = h(
    AccountRow,
    {
      service: "canvas",
      mark: "Cv",
      name: "Canvas",
      key: "canvas",
      connected: Boolean(canvas.host) && canvasToken,
      status: canvas.host ? bareHost(canvas.host) + " · " + (canvasToken ? "token saved" : "no token") : "no address yet",
      action: canvas.host ? canvasToken ? "Change" : "Add the token" : "Connect",
      open: open2 === "canvas",
      onToggle: () => toggle("canvas"),
      error: errors.canvas
    },
    canvas.host ? h(
      React.Fragment,
      null,
      h("p", { className: "pp-as" }, (canvasToken ? "Replace the token" : "Paste a token") + " — Canvas → Account → Settings → New Access Token."),
      secret("canvas", canvas.tokenEnv),
      h("p", { className: "pp-factgroup" }, "Or a different Canvas"),
      h(ProviderSetup, { integration: integration("canvas"), runId: props.runId, sessionId: props.sessionId, onSaved: saved })
    ) : h(ProviderSetup, { integration: integration("canvas"), runId: props.runId, sessionId: props.sessionId, onSaved: saved })
  );
  const google = data.google || {};
  const googleRow = h(
    AccountRow,
    {
      service: "sheets",
      mark: "G",
      name: "Google",
      key: "google",
      connected: Boolean(google.connected),
      status: google.connected ? "signed in as " + (google.account || "your Google account") + " · grade sheets are read directly" : "not signed in · grade sheets come in as downloads",
      action: google.connected ? "Change" : "Connect",
      open: open2 === "google",
      onToggle: () => toggle("google")
    },
    h(GoogleConnect, { google, bare: true, onChanged: props.onRefresh })
  );
  const github = data.github || { gh: {} };
  const githubRow = h(
    AccountRow,
    {
      service: "github",
      mark: "GH",
      name: "GitHub",
      key: "github",
      connected: Boolean(github.via),
      status: github.via === "token" ? "token saved" + (github.owner ? " · repositories under " + github.owner : "") : github.via === "gh" ? "through the gh CLI, signed in as " + github.gh.account : github.gh && github.gh.installed ? "the gh CLI is installed but not signed in" : "no token, and no gh CLI",
      action: github.via === "token" ? "Change" : github.via === "gh" ? "Use a token" : "Connect",
      open: open2 === "github",
      onToggle: () => toggle("github")
    },
    h(
      "p",
      { className: "pp-as" },
      github.via === "gh" ? "Homework repositories are pushed as " + github.gh.account + ". A token below takes over from the gh CLI, if you would rather use one." : "Either sign the gh CLI in — run gh auth login in a terminal, and this row picks it up — or paste a token. A token is tried first."
    ),
    github.connection ? secret("github", github.tokenEnv) : h(ProviderSetup, {
      integration: { id: "github", fields: ["token"] },
      runId: props.runId,
      sessionId: props.sessionId,
      onSaved: saved
    })
  );
  const announce = (type, mark, name, describe) => {
    const entry = ofType(type)[0] || legacy(type)[0] || null;
    const token = Boolean(entry) && (configured(entry.tokenEnv) || entry.tokenInEnv || entry.tokenInFile);
    return h(
      AccountRow,
      {
        service: type,
        mark,
        name,
        key: type,
        connected: Boolean(entry) && token,
        status: entry ? describe(entry) + " · " + (token ? "token saved" : "no token") : "not set up",
        action: entry ? "Change" : "Connect",
        open: open2 === type,
        onToggle: () => toggle(type),
        error: errors[type]
      },
      entry && entry.tokenEnv && !token ? secret(type, entry.tokenEnv) : null,
      h(ProviderSetup, { integration: integration(type), runId: props.runId, sessionId: props.sessionId, onSaved: saved })
    );
  };
  const telegramRow = announce("telegram", "Tg", "Telegram", (entry) => "posts to " + (entry.chatId || "a channel"));
  const moodleRow = announce("moodle", "Md", "Moodle", (entry) => bareHost(entry.baseUrl) || "a Moodle site");
  const voices = ofType("transcription");
  const transcriptionRow = h(
    AccountRow,
    {
      service: "file",
      mark: "Tx",
      name: "Transcription",
      key: "transcription",
      connected: voices.some((entry) => configured(entry.tokenEnv) || entry.tokenInEnv),
      status: voices.length ? voices.map(
        (entry) => entry.name + " · " + [entry.provider, entry.model].filter(Boolean).join(" ") + (entry.pricePerMinute === null ? "" : " · $" + entry.pricePerMinute + "/min") + (configured(entry.tokenEnv) || entry.tokenInEnv ? "" : " · no token")
      ).join("; ") : "not set up · the defence desk records answers without transcribing them",
      action: voices.length ? "Change" : "How to connect",
      open: open2 === "transcription",
      onToggle: () => toggle("transcription"),
      error: errors.transcription
    },
    voices.map((entry) => h("div", { key: entry.name }, secret("transcription", entry.tokenEnv))),
    h(
      "p",
      { className: "pp-as" },
      "A transcription service is added with ainar connections add NAME --type transcription --provider openai|elevenlabs --model M --price-per-minute USD; its token is then pasted here."
    )
  );
  const covered = new Set(
    [
      canvas.tokenEnv,
      google.tokenEnv,
      github.tokenEnv,
      ...connections.filter((entry) => ["telegram", "moodle", "transcription"].includes(entry.type)).map((entry) => entry.tokenEnv)
    ].filter(Boolean)
  );
  const others = Object.keys(refs).filter((name) => !covered.has(name) && refs[name] && (refs[name].configured || connections.some((entry) => entry.tokenEnv === name))).sort();
  return h(
    "div",
    { className: "pp-scroll pp-course" },
    h(
      "p",
      { className: "pp-as" },
      "On this computer, for every course on it. A token goes to the credential store and is never shown again — this screen gets projected."
    ),
    data.credentials && data.credentials.available ? null : h(
      "p",
      { className: "pp-saveerr" },
      "No credential store is mounted, so a token cannot be saved from here. Each row names the variable to export instead."
    ),
    // Connected first, in their own order; then the rest, under a label, so
    // the services this computer actually uses are the top of the list.
    (() => {
      const all = [canvasRow, googleRow, githubRow, telegramRow, moodleRow, transcriptionRow];
      const on = all.filter((row) => row.props.connected);
      const off = all.filter((row) => !row.props.connected);
      return h(
        React.Fragment,
        null,
        on.length ? h("div", { className: "pp-accts" }, on) : null,
        off.length ? h("p", { className: "pp-factgroup" }, on.length ? "Not connected" : "Nothing connected yet") : null,
        off.length ? h("div", { className: "pp-accts" }, off) : null
      );
    })(),
    data.setup && data.setup.answered ? h("p", { className: "pp-ok" }, data.setup.provider + " answered as " + data.setup.answered + ".") : null,
    data.setup && data.setup.checkFailed ? h("p", { className: "pp-saveerr" }, data.setup.checkFailed) : null,
    h(
      "details",
      { className: "pp-cdetails" },
      h("summary", null, "Where these are read from"),
      others.length ? h(
        React.Fragment,
        null,
        h("p", { className: "pp-factgroup" }, "Other credentials"),
        others.map((name) => h("div", { key: name }, secret("other", name))),
        errors.other ? h("p", { className: "pp-saveerr" }, errors.other) : null
      ) : null,
      h("p", { className: "pp-factgroup" }, "Environment"),
      (data.environment || []).map(
        (variable) => h(Fact, { label: variable.name, note: variable.what, key: variable.name }, h(Presence, { present: variable.present }))
      ),
      h("p", { className: "pp-factgroup" }, "Files"),
      h(
        Fact,
        {
          label: "connections.json",
          note: data.registry.error || data.registry.path + " — the shared registry, ainar connections",
          missing: !data.registry.present || Boolean(data.registry.error)
        },
        data.registry.present ? data.registry.error ? "unreadable" : connections.length + " connection" + (connections.length === 1 ? "" : "s") : h(Presence, { present: false, no: "not migrated yet" })
      ),
      h(
        Fact,
        { label: "lms.toml", note: canvas.configPath, missing: !canvas.host && !canvas.tokenInFile },
        canvas.tokenInFile ? h(Presence, { present: true, yes: "host and token" }) : canvas.host && canvas.hostFrom !== "AINAR_CANVAS_URL" ? h(Presence, { present: true, yes: "host only" }) : h(Presence, { present: false, no: "nothing read" })
      ),
      h(
        Fact,
        {
          label: "profiles (legacy)",
          note: data.connections.error || data.connections.path,
          missing: !data.connections.present || Boolean(data.connections.error)
        },
        data.connections.present ? data.connections.error ? "unreadable" : data.connections.profiles.length + " profile" + (data.connections.profiles.length === 1 ? "" : "s") : h(Presence, { present: false, no: "no file" })
      ),
      h(
        Fact,
        {
          label: "people.json",
          note: data.roster.path + " — the identity store, outside the repository. The course record holds pseudonyms; the real names are only here",
          missing: !data.roster.present
        },
        data.roster.present ? data.roster.count === null ? "unreadable" : data.roster.count + " known" : h(Presence, { present: false, no: "no roster" })
      )
    ),
    // Said outside the fold: a token in a file is a problem to act on, not a
    // fact to look up.
    connections.some((connection) => connection.tokenInFile) ? h(
      "p",
      { className: "pp-saveerr" },
      "A connection in the registry holds a literal token, which that file is not supposed to contain at all. Revoke it at the provider, paste a fresh one into its row above, and delete the line."
    ) : null,
    data.connections.profiles.some((profile) => profile.tokenInFile) ? h(
      "p",
      { className: "pp-saveerr" },
      "A legacy profile holds a literal token. It still works, but a token in a file that gets backed up and synced should be treated as exposed: ainar connections migrate says what to do about it, and does not copy the token forward."
    ) : null
  );
}

// client/service-cards.js
var dayOf = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
};
function CardHead(props) {
  return h(
    "div",
    { className: "pp-chead" },
    h("span", { className: "pp-svc pp-svc-" + props.service, "aria-hidden": "true" }, props.mark),
    h("span", { className: "pp-cname" }, props.name, h("span", { className: "pp-intwhat" }, props.subtitle)),
    props.chip ? h("span", { className: "pp-chip pp-chip-" + props.chip.tone }, props.chip.text) : null
  );
}
function SheetsCard(props) {
  const data = props.data;
  const syncs = props.syncs ? props.syncs.syncs.filter((sync) => sync.service === "sheets") : [];
  const row = (data.integrations || []).find((entry) => entry.id === "sheets");
  const google = data.google || {};
  const checks = useSheetCheck(props.runId, props.sessionId, String(props.revision || 0));
  const [editing, setEditing] = React.useState(false);
  if (!syncs.length && !(row && row.state !== "absent")) return null;
  const ids = new Set(syncs.map((sync) => sync.id));
  const waiting2 = props.syncs ? props.syncs.waiting.filter((entry) => ids.has(entry.sync)) : [];
  const checkOf = (sync) => checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) : null;
  const changed = syncs.filter((sync) => {
    const check = checkOf(sync);
    return check && check.state === "changed";
  });
  const expired = google.connected && Boolean(google.expired || checks && checks.checks && checks.checks.some((entry) => entry.reconnect));
  const subtitle = [
    expired ? "Google stopped accepting the sign-in" + (google.account ? " for " + google.account : "") : google.connected ? "connected as " + (google.account || "your Google account") : "Google not connected · sheets come in as downloads",
    syncs.length ? syncs.length + " sheet" + (syncs.length === 1 ? "" : "s") : null
  ].filter(Boolean).join(" · ");
  const chip = expired ? { text: "reconnect", tone: "warn" } : waiting2.length ? { text: waiting2.length + " waiting", tone: "warn" } : changed.length ? { text: "changed in Google", tone: "warn" } : google.connected ? { text: "ready", tone: "ok" } : null;
  return h(
    "section",
    { className: "pp-ccard", id: "pp-card-sheets" },
    h(CardHead, { service: "sheets", mark: "GS", name: "Google Sheets", subtitle, chip }),
    syncs.map(
      (sync) => h(
        "div",
        { className: "pp-csub", key: sync.id },
        h("div", { className: "pp-csubtitle" }, sync.label, h("span", { className: "pp-syncid" }, sync.id)),
        h(SyncCard, {
          sync,
          bare: true,
          check: checkOf(sync),
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          onDone: props.onDone
        })
      )
    ),
    h(WaitingList, {
      rows: waiting2,
      students: props.syncs ? props.syncs.students : [],
      names: props.syncs ? props.syncs.names : false,
      runId: props.runId,
      sessionId: props.sessionId,
      onDone: props.onDone
    }),
    google.connected ? null : h(
      "div",
      { className: "pp-cnudge" },
      h("span", null, "Connect Google and this card reads the sheet itself — no download."),
      h(GoogleConnect, { google, bare: true, compact: true, onChanged: props.onRefresh })
    ),
    h(
      "details",
      { className: "pp-cdetails" },
      h("summary", null, "Details"),
      google.connected ? h(GoogleConnect, { google, bare: true, compact: true, onChanged: props.onRefresh }) : null,
      h(
        Fact,
        {
          label: "Gradebook copy",
          note: data.sheet.id ? "The spreadsheet the gradebook is written to · summary tab " + data.sheet.summaryTab : "A spreadsheet the gradebook is written to, if you keep one — extensions.lms.sheet_id on the run"
        },
        data.sheet.id || h(Presence, { present: false, no: "none" })
      ),
      row ? h(
        Fact,
        { label: "Credential", note: "a Google sign-in, AINAR_SHEETS_TOKEN, or a service-account key" },
        h(Presence, { present: row.steps[1] && row.steps[1].done, yes: "available", no: "none" })
      ) : null,
      row ? h(
        "div",
        { className: "pp-approverow" },
        h(
          "button",
          { type: "button", className: "pp-segbtn", "aria-pressed": editing, onClick: () => setEditing(!editing) },
          data.sheet.id ? "Change the gradebook copy" : "Keep a gradebook copy"
        )
      ) : null,
      editing && row ? h(ProviderSetup, {
        integration: Object.assign({}, row, { fields: ["sheetId"] }),
        runId: props.runId,
        sessionId: props.sessionId,
        onCancel: () => setEditing(false),
        onSaved: (body) => {
          setEditing(false);
          if (props.onSaved) props.onSaved(body);
        }
      }) : null
    )
  );
}
function GithubCard(props) {
  const data = props.data;
  const sync = props.syncs ? props.syncs.syncs.find((entry) => entry.service === "github") : null;
  const rows = (data.assessments || []).filter((assessment) => assessment.github).sort((left, right) => String(left.dueAt || "9999").localeCompare(String(right.dueAt || "9999")));
  const [open2, setOpen] = React.useState(null);
  if (!sync && !rows.length) return null;
  const unpublished = rows.filter((assessment) => !assessment.github.published);
  const chip = !rows.length ? null : unpublished.length ? { text: unpublished.length + " not published", tone: "warn" } : { text: "all published", tone: "ok" };
  return h(
    "section",
    { className: "pp-ccard", id: "pp-card-github" },
    h(CardHead, {
      service: "github",
      mark: "GH",
      name: "GitHub",
      subtitle: rows.length + " homework repositor" + (rows.length === 1 ? "y" : "ies") + " · students fork them" + (sync && sync.lastSynced ? " · last pushed " + when(sync.lastSynced) : ""),
      chip
    }),
    rows.length ? h(
      "div",
      { className: "pp-crows" },
      rows.map((assessment) => {
        const id = assessment.assessmentId;
        const repo = assessment.github.repo;
        const published = assessment.github.published;
        const expanded = open2 === id;
        return h(
          "div",
          { className: "pp-crow" + (expanded ? " pp-crow-open" : ""), key: id },
          h(
            "button",
            { type: "button", className: "pp-crowhead", "aria-expanded": expanded, onClick: () => setOpen(expanded ? null : id) },
            h("span", { className: "pp-crowchev", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
            h(
              "span",
              { className: "pp-crowtitle" },
              assessment.title || id,
              assessment.dueAt ? h("span", { className: "pp-as" }, " · due " + dayOf(assessment.dueAt)) : null
            ),
            h(
              "span",
              { className: "pp-crowstate" },
              repo ? h("span", { className: "pp-st-quiet" }, repo) : h("span", { className: "pp-st-warn" }, "no repository named"),
              h("span", { className: "pp-crowsep", "aria-hidden": "true" }, " · "),
              published ? h("span", { className: "pp-st-ok" }, "published " + dayOf(published.at)) : h("span", { className: "pp-st-warn" }, "not published")
            )
          ),
          expanded ? h(
            "div",
            { className: "pp-cpanel" },
            repo ? h(
              "p",
              { className: "pp-as" },
              h("a", { href: "https://github.com/" + repo, target: "_blank", rel: "noreferrer" }, repo + " ↗"),
              assessment.github.folder ? " · from " + assessment.github.folder : "",
              published ? " · last pushed from here " + when(published.at) : " · never pushed from here"
            ) : h(
              "p",
              { className: "pp-as" },
              "No repository is named yet. Record one as extensions.github.template_repo on the assessment — /design-assessment writes it when it scaffolds the starter."
            ),
            sync ? h(SyncCard, {
              sync,
              bare: true,
              assessment: id,
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onDone: props.onDone
            }) : h("p", { className: "pp-as" }, "This run has no homework-repos sync, so there is nothing to push with.")
          ) : null
        );
      })
    ) : h("p", { className: "pp-as" }, "No assessment names a starter repository yet. /design-assessment writes one when it scaffolds the homework.")
  );
}

// client/integrations.js
function useSteady(state) {
  const last = React.useRef(null);
  if (state.phase === "ready" && state.value && !state.value.error) last.current = state.value;
  return last.current;
}
function Integrations(props) {
  const url = scoped(
    BASE + "/api/integrations?run=" + encodeURIComponent(props.runId || "") + // The revision counter, in the URL because `useJson` re-fetches when
    // its URL changes and on nothing else. The route does not read `r`;
    // its only job is to make an `ainar lms` run in a terminal, or a
    // hand-edited version.yaml, redraw this tab without a remount.
    "&r=" + encodeURIComponent(String(props.revision || 0)),
    props.sessionId
  );
  const state = useJson(url);
  const [fresh, setFresh] = React.useState(null);
  const [accounts, setAccounts] = React.useState(props.subView === "accounts");
  const [tick, setTick] = React.useState(0);
  const unpublished = useUnpublished(props.runId, props.sessionId, props.revision || 0);
  const syncs = useJson(
    scoped(
      BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(String(props.revision || 0) + "." + tick),
      props.sessionId
    )
  );
  React.useEffect(() => {
    if (state.phase !== "ready") return;
    setFresh(null);
  }, [state]);
  React.useEffect(() => {
    if (props.focus && props.focus.service) setAccounts(false);
  }, [props.focus && props.focus.tick]);
  const fetched = useSteady(state);
  const marks = useSteady(unpublished);
  const roads = useSteady(syncs);
  if (state.phase === "ready" && state.value && state.value.error && !fresh) {
    return h(Message, { error: true }, state.value.error);
  }
  const data = fresh || fetched;
  if (!data) return h(Message, null, "Reading what this run is wired to…");
  const onSaved = (body) => {
    setFresh(body);
    if (props.onWrite) props.onWrite();
  };
  const onSynced = () => {
    setTick((value) => value + 1);
    if (props.onWrite) props.onWrite();
  };
  const refresh2 = () => fetch(url, { headers: { accept: "application/json" } }).then((response) => response.json()).then((body) => {
    if (!body.error) setFresh(body);
    setTick((value) => value + 1);
  }).catch(() => null);
  const head = h(
    "div",
    { className: "pp-ihead" },
    accounts ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setAccounts(false) }, "← This course") : h("span", { className: "pp-ihtitle" }, "This course"),
    h("span", { className: "pp-segspacer" }),
    accounts ? h("span", { className: "pp-ihtitle" }, "Accounts") : h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        title: "Canvas, Google, GitHub and the rest, as this computer is signed in to them",
        onClick: () => setAccounts(true)
      },
      "Accounts"
    )
  );
  if (accounts) {
    return h(
      "div",
      null,
      head,
      h(Accounts, {
        data,
        runId: props.runId,
        sessionId: props.sessionId,
        // A token or a connection is machine configuration, not the record,
        // so nothing else needs to redraw; `onWrite` is not called.
        onSaved: (body) => setFresh(body),
        onRefresh: refresh2
      })
    );
  }
  return h(
    "div",
    null,
    head,
    h(CourseIntegrations, {
      data,
      unpublished: marks,
      syncs: roads,
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      ask: props.ask,
      focus: props.focus,
      revision: String(props.revision || 0) + "." + tick,
      onSaved,
      onSynced,
      onRefresh: refresh2,
      onWrite: props.onWrite
    })
  );
}
var CARDED = /* @__PURE__ */ new Set(["canvas", "sheets", "github"]);
function CourseIntegrations(props) {
  const data = props.data;
  const [filter, setFilter] = React.useState({ id: null, tick: 0 });
  const [adding, setAdding] = React.useState(false);
  const [migrating, setMigrating] = React.useState(null);
  const canvasRow = (data.integrations || []).find((row) => row.id === "canvas");
  const reachable = Boolean(canvasRow) && canvasRow.steps.slice(0, 3).every((step) => step.done);
  const counts = canvasCounts(data, props.unpublished);
  const syncs = props.syncs ? props.syncs.syncs : [];
  const waiting2 = props.syncs ? props.syncs.waiting.length : 0;
  const others = (data.integrations || []).filter((row) => !CARDED.has(row.id));
  const synced = new Set(syncs.map((sync) => sync.service));
  const isUsed = (row) => row.state !== "absent" || synced.has(row.id);
  const used = others.filter(isUsed);
  const unused = others.filter((row) => !isUsed(row));
  const loose = syncs.filter((sync) => !CARDED.has(sync.service));
  const implied = syncs.filter((sync) => sync.implied).length;
  const scrollTo = (id) => {
    const card2 = document.getElementById(id);
    if (card2) card2.scrollIntoView({ block: "start" });
  };
  React.useEffect(() => {
    if (props.focus && props.focus.service) scrollTo("pp-card-" + props.focus.service);
  }, [props.focus && props.focus.tick]);
  const show = (id) => {
    setFilter((current) => ({ id, tick: current.tick + 1 }));
    scrollTo("pp-card-canvas");
  };
  const plural3 = (count, one, many) => count + " " + (count === 1 ? one : many);
  const migrate = () => {
    setMigrating("working");
    fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "migrate" })
    }).then((response) => response.json()).catch((error) => ({ error: String(error && error.message || error) })).then((answer) => {
      setMigrating(answer);
      if (props.onSynced) props.onSynced();
    });
  };
  const needs = [
    waiting2 ? {
      key: "waiting",
      service: "sheets",
      mark: "GS",
      text: plural3(waiting2, "name", "names") + " from the grade sheet to confirm",
      go: () => scrollTo("pp-card-sheets")
    } : null,
    reachable && counts.unlinked.length ? {
      key: "unlinked",
      service: "canvas",
      mark: "Cv",
      text: plural3(counts.unlinked.length, "assessment has", "assessments have") + " no Canvas column",
      go: () => show("unlinked")
    } : null,
    counts.toSend.length ? {
      key: "marks",
      service: "canvas",
      mark: "Cv",
      text: "Canvas is missing marks for " + plural3(counts.toSend.length, "assessment", "assessments"),
      go: () => show("marks")
    } : null
  ].filter(Boolean);
  const card = {
    runId: props.runId,
    sessionId: props.sessionId,
    names: props.names,
    onSaved: props.onSaved
  };
  return h(
    "div",
    { className: "pp-scroll pp-course" },
    needs.length ? h(
      "div",
      { className: "pp-needs", role: "status" },
      h("span", { className: "pp-needstitle" }, "Needs you"),
      needs.map(
        (item) => h(
          "div",
          { className: "pp-needsrow", key: item.key },
          h("span", { className: "pp-svc pp-svc-small pp-svc-" + item.service, "aria-hidden": "true" }, item.mark),
          h("span", null, item.text),
          h("button", { type: "button", className: "pp-segbtn", onClick: item.go }, "Show")
        )
      )
    ) : null,
    h(
      CanvasCard,
      Object.assign({}, card, {
        data,
        unpublished: props.unpublished,
        syncs: props.syncs,
        ask: props.ask,
        filter: filter.id,
        filterTick: filter.tick,
        onWrite: props.onWrite
      })
    ),
    h(
      SheetsCard,
      Object.assign({}, card, {
        data,
        syncs: props.syncs,
        revision: props.revision,
        onDone: props.onSynced,
        onRefresh: props.onRefresh
      })
    ),
    h(GithubCard, Object.assign({}, card, { data, syncs: props.syncs, onDone: props.onSynced })),
    used.length ? h(IntegrationStatus, {
      integrations: used,
      setup: data.setup,
      data,
      runId: props.runId,
      sessionId: props.sessionId,
      onSaved: props.onSaved
    }) : null,
    loose.length ? h(
      "div",
      { className: "pp-syncsection" },
      h("p", { className: "pp-factgroup" }, "Other syncs"),
      loose.map(
        (sync) => h(SyncCard, {
          sync,
          key: sync.id,
          assessments: props.syncs.assessments,
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          onDone: props.onSynced
        })
      )
    ) : null,
    unused.length ? h(
      "div",
      { className: "pp-unused" },
      h(
        "div",
        { className: "pp-approverow" },
        h("span", { className: "pp-as" }, "Not used by this course: " + unused.map((row) => row.label).join(", ")),
        h(
          "button",
          { type: "button", className: "pp-segbtn", "aria-pressed": adding, onClick: () => setAdding(!adding) },
          adding ? "Close" : "Set one up"
        )
      ),
      adding ? h(IntegrationStatus, {
        integrations: unused,
        setup: data.setup,
        data,
        runId: props.runId,
        sessionId: props.sessionId,
        onSaved: props.onSaved
      }) : null
    ) : null,
    // The syncs this run still takes from older settings (lms.toml, the sheet
    // settings, the publishing profiles) rather than from its own `syncs:`.
    // They work as they are; this writes them down in one place.
    implied ? h(
      "div",
      { className: "pp-approverow" },
      h(
        "span",
        { className: "pp-as" },
        (implied === syncs.length ? "All " : implied + " of ") + plural3(syncs.length, "sync is", "syncs are") + " read from older settings. Saving them writes syncs: into the run's settings."
      ),
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: migrating === "working", onClick: migrate },
        migrating === "working" ? "Writing…" : "Save in settings"
      )
    ) : null,
    migrating && migrating !== "working" ? h("pre", { className: "pp-approveout" + (migrating.error ? " pp-approveerr" : "") }, migrating.error || migrating.output) : null
  );
}

// shared/course-style.js
var LIGHT = `--ground:#f3f4f0;--surface:#fff;--sunk:#eceee8;--ink:#171b18;--muted:#5f685f;
--line:#dadfd6;--rule:#e8ebe4;--accent:#2f6b3c;--accent-ink:#245231;--accent-line:#bcd8c2;
--accent-tint:#eef5ef;--flag:#a4362f;--flag-line:#f0c4c0;--flag-tint:#fdf1f0;
--draft:#2f5b8a;--draft-line:#bdd0e4;--draft-tint:#eef3f9;--on-fg:#fff;--hw:#a46a1f;`;
var DARK = `--ground:#101310;--surface:#191d1a;--sunk:#141815;--ink:#e6eae4;--muted:#99a399;
--line:#2b312c;--rule:#222722;--accent:#7fc98d;--accent-ink:#a6dcaf;--accent-line:#33513a;
--accent-tint:#18231a;--flag:#e08c85;--flag-line:#6b3a37;--flag-tint:#2a1c1b;
--draft:#8fb6de;--draft-line:#37506b;--draft-tint:#171f27;--on-fg:#0d100d;--hw:#d9a35b;`;
var STYLE = `
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
.status .steps{display:inline-flex;gap:3px;align-items:center;margin-right:1px}
.status .steps i{width:7px;height:7px;border-radius:50%;box-sizing:border-box;border:1px solid var(--line)}
.status .steps i.done{background:var(--accent);border-color:var(--accent)}
.status .steps i.yours{background:var(--draft);border-color:var(--draft)}
.status .steps i.current{border:2px solid var(--accent)}
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
button.star{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-left:2px;border-radius:5px;color:var(--accent);opacity:.35;cursor:pointer;vertical-align:middle;transition:opacity .12s}
button.star .i{width:14px;height:14px}
button.star:hover,button.star:focus-visible{opacity:1;background:var(--accent-tint)}button.star:focus-visible{outline:2px solid var(--accent)}
table.plan tr:hover button.star,.cmap-c:hover button.star,.traychip:hover button.star{opacity:.8}
button.star.open{opacity:1;background:var(--accent-tint)}
.starmenu{position:fixed;z-index:60;width:220px;display:flex;flex-direction:column;padding:4px;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);font-size:13px;font-weight:400;text-transform:none;letter-spacing:0;white-space:normal;cursor:default}
.starmenu button{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:1px;padding:6px 9px;border-radius:7px;cursor:pointer;color:var(--ink)}
.starmenu button:hover,.starmenu button:focus-visible{background:var(--accent-tint)}
.starmenu .sm-topic{font-size:12.5px;color:var(--accent-ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.starmenu .sm-topic.none{color:var(--muted);font-style:italic;font-weight:400}
.starmenu b{font-weight:600}.starmenu small{color:var(--muted);font-size:11.5px;line-height:1.3;margin:0!important}
.lseg{position:relative}.lseg>button.star{position:absolute;top:2px;right:2px}
.lseg.first{padding-right:24px}
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

// client/course/parts.jsx
var send = (message) => window.postMessage(Object.assign({ source: "professor-pane" }, message), "*");
var press = {
  ask: (prompt) => send({ kind: "ask", prompt }),
  grade: (assessment, label) => send({ kind: "grade", assessment, label }),
  scans: (assessment) => send({ kind: "scans", assessment }),
  upload: (assessment, label) => send({ kind: "upload", assessment, label }),
  desk: (assessment, student) => send({ kind: "defence-desk", assessment, student }),
  publish: (assessment, label, target) => send({ kind: "publish", assessment, label, target })
};
function ViewLink(props) {
  const { view, format, papers, children, ...rest } = props;
  const onClick = (event) => {
    if (!view) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    send({ kind: "view", url: props.href, label: view, format, papers: papers ? JSON.stringify(papers) : null });
  };
  return /* @__PURE__ */ h("a", { target: "_blank", rel: "noopener", ...rest, onClick }, children);
}
function Sprite() {
  return /* @__PURE__ */ h("svg", { width: "0", height: "0", style: { position: "absolute" }, "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ h("defs", null, Object.entries(ICONS).map(([name, inner]) => /* @__PURE__ */ h("symbol", { key: name, id: "i-" + name, viewBox: "0 0 24 24", dangerouslySetInnerHTML: { __html: inner } }))));
}
function Icon(props) {
  return /* @__PURE__ */ h("svg", { className: "i", "aria-hidden": "true" }, /* @__PURE__ */ h("use", { href: "#i-" + props.name }));
}
function AskButton(props) {
  return /* @__PURE__ */ h("button", { type: "button", className: props.className || "chip ask", "data-ask": "", title: props.title, onClick: () => press.ask(props.prompt) }, /* @__PURE__ */ h(Icon, { name: "ask" }), props.label);
}
function GapChip(props) {
  const gap = GAP[props.kind];
  return /* @__PURE__ */ h("button", { type: "button", className: "chip gap " + props.tier, "data-ask": "", title: props.title, onClick: () => press.ask(props.prompt) }, /* @__PURE__ */ h(Icon, { name: gap.icon }), props.label || gap.verb);
}
function MaterialChips(props) {
  const r = props.resource;
  const deck = r.kind === "slides";
  const cls = "chip" + (deck ? " deck" : "") + (r.draft ? " draft" : "");
  const label = deck ? "Slides" : r.title;
  const what = RESOURCE_WORD[r.kind] || r.kind;
  const body = /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(Icon, { name: RESOURCE_ICON[r.kind] || "file" }), label, r.draft ? /* @__PURE__ */ h(Fragment2, null, " ", /* @__PURE__ */ h("span", { className: "k" }, "draft")) : null);
  return /* @__PURE__ */ h(Fragment2, null, r.url ? /* @__PURE__ */ h(
    ViewLink,
    {
      className: cls,
      href: r.url,
      title: what + " · " + r.title,
      view: r.viewable ? r.title : null,
      format: r.format
    },
    body
  ) : /* @__PURE__ */ h("span", { className: cls, title: what }, body), (r.formats || []).slice(1).map(
    (f) => f.url ? /* @__PURE__ */ h(
      ViewLink,
      {
        key: f.label,
        className: "chip fmt",
        href: f.url,
        view: f.viewable ? r.title + " · " + f.label : null,
        format: f.format
      },
      f.label
    ) : null
  ));
}
function WorkChip(props) {
  const a = props.work;
  const kind = WORK_WORD[a.type] || a.type || "work";
  const cls = "chip" + (a.draft ? " draft" : "");
  const body = /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "k mono" }, props.when), /* @__PURE__ */ h("span", { className: "tag" }, /* @__PURE__ */ h(Icon, { name: WORK_ICON[a.type] || "file" }), kind), a.title, a.draft ? /* @__PURE__ */ h(Fragment2, null, " ", /* @__PURE__ */ h("span", { className: "k" }, "draft")) : null, /* @__PURE__ */ h("span", { className: "wt" }, weightPct(a.weight)));
  const papers = Array.isArray(a.papers) && a.papers.length > 1 ? a.papers : null;
  if (papers) {
    return /* @__PURE__ */ h(ViewLink, { className: cls, href: papers[0].url, view: a.title, format: papers[0].format, papers, title: "open the " + papers.length + " versions" }, body);
  }
  const href = a.viewable && a.url ? a.url : a.brief_url;
  if (href) {
    return /* @__PURE__ */ h(ViewLink, { className: cls, href, view: a.title, format: a.viewable && a.url ? a.format : "html", title: "open the brief" }, body);
  }
  return /* @__PURE__ */ h("span", { className: cls }, body);
}
function StatusLine(props) {
  const a = props.work;
  const st = props.status ? props.status[a.assessment_id] : null;
  if (!st) return null;
  const id = a.assessment_id;
  const label = a.title || id;
  const parts = [];
  if (st.grading) {
    parts.push(
      /* @__PURE__ */ h(Fragment2, { key: "grading" }, /* @__PURE__ */ h("span", { className: "stat" }, st.grading.suggested, " suggested · ", st.grading.decided, " decided"), /* @__PURE__ */ h("button", { type: "button", className: "chip act", title: "Open the Grade view", onClick: () => press.grade(id, label) }, "Grade"))
    );
  }
  if (st.scans && st.scans.none) {
    parts.push(
      /* @__PURE__ */ h(Fragment2, { key: "scans" }, /* @__PURE__ */ h("span", { className: "stat" }, "no scans yet"), /* @__PURE__ */ h("button", { type: "button", className: "chip act", title: "Upload the scanned papers of " + label, onClick: () => press.upload(id, label) }, "Upload scans…"))
    );
  } else if (st.scans) {
    parts.push(/* @__PURE__ */ h(ScanSteps, { key: "scans", id, label, scans: st.scans, graded: Boolean(st.grading) }));
  }
  if (st.defences) {
    parts.push(
      /* @__PURE__ */ h(Fragment2, { key: "defences" }, /* @__PURE__ */ h("span", { className: "stat" }, st.defences.defended, " of ", st.defences.of, " defended"), st.defences.student ? /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "chip act",
          title: "The defence desk, on " + st.defences.student,
          onClick: () => press.desk(id, st.defences.student)
        },
        "Open defence desk"
      ) : null)
    );
  }
  if (st.canvas) {
    parts.push(
      /* @__PURE__ */ h(Fragment2, { key: "canvas" }, /* @__PURE__ */ h("span", { className: "badge" }, st.canvas === "some" ? "not in every Canvas course yet" : "not in Canvas yet"), /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "chip act",
          title: "Send its definition to Canvas — reads a plan first",
          onClick: () => press.publish(id, label, "canvas")
        },
        "publish…"
      ))
    );
  }
  if (st.repo) {
    parts.push(
      /* @__PURE__ */ h(Fragment2, { key: "repo" }, /* @__PURE__ */ h("span", { className: "badge" }, "no starter repository yet"), /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "chip act",
          title: "Create the starter repository on GitHub — reads a plan first",
          onClick: () => press.publish(id, label, "homework")
        },
        "publish…"
      ))
    );
  }
  return parts.length ? /* @__PURE__ */ h("span", { className: "status" }, parts) : null;
}
function ScanSteps(props) {
  const { id, label, scans } = props;
  const act = scans.act;
  const opensScans = act && act.kind === "scans";
  const steps = scans.steps || [];
  const strip = steps.map((step) => step.label + ": " + step.detail).join("\n");
  let action = null;
  if (act && act.kind === "ask") {
    action = /* @__PURE__ */ h(AskButton, { className: "chip act", label: act.label, prompt: act.prompt, title: act.prompt });
  } else if (act && act.kind === "grade" && !props.graded) {
    action = /* @__PURE__ */ h("button", { type: "button", className: "chip act", title: "Open the Grade view", onClick: () => press.grade(id, label) }, act.label);
  } else if (opensScans) {
    action = /* @__PURE__ */ h("button", { type: "button", className: "chip act", title: "Open the pile in Scans, on this step", onClick: () => press.scans(id) }, act.label);
  }
  return /* @__PURE__ */ h(Fragment2, null, steps.length ? /* @__PURE__ */ h("span", { className: "steps", role: "img", "aria-label": strip, title: strip }, steps.map((step) => /* @__PURE__ */ h("i", { key: step.label, className: step.state }))) : null, /* @__PURE__ */ h("span", { className: "stat" + (scans.whose === "you" ? " yours" : "") }, scans.phrase, scans.whose === "assistant" ? " · the assistant's" : ""), action, opensScans ? null : /* @__PURE__ */ h("button", { type: "button", className: "chip act", title: "Open the pile in Scans", onClick: () => press.scans(id) }, "Scans"));
}
var Dash = () => /* @__PURE__ */ h("span", { className: "dash" }, "—");
var twoDigits = (n) => n < 10 ? "0" + n : String(n);

// client/course/edit.jsx
var EditContext = React.createContext(null);
var recordUrl = (edit, query) => scoped(BASE + "/api/record?run=" + encodeURIComponent(edit.runId) + (query || ""), edit.sessionId);
var CHECKED = /* @__PURE__ */ new Set(["module", "assessment"]);
var WORD = { module: "topic", assessment: "graded work", activity: "meeting" };
var quoted = (value) => value ? "“" + String(value).replace(/\s+/g, " ").slice(0, 300) + "”" : "(empty)";
function checkPrompt(runId, result) {
  const changes = Object.keys(result.fields || {}).map(
    (name) => "  " + name + ": " + quoted(result.before && result.before[name]) + " → " + quoted(result.fields[name])
  );
  return [
    "/revise I changed " + (WORD[result.kind] || result.kind) + " " + result.id + " in " + runId + " from the course page. It is already saved:",
    ...changes,
    "",
    "First decide what kind of change this is — a rename (same subject, new words), a refocus (same area, a different angle or scope) or a different topic — and say which in one line, with why.",
    "Then go through what points at it, below, and say for each group whether it still fits. Ask me about the groups that need changing, one at a time; propose each change as a draft (approval: draft) and ask me on a question card whether to accept it. Change nothing else without asking.",
    "Places that print the title (the course page, Canvas) are behind until it is published again — name them; do not publish.",
    "",
    "What points at it (ainar impact " + result.id + "):",
    ...result.impact && result.impact.length ? result.impact : ["  nothing else in the course points at it"]
  ].join("\n");
}
function saveRecord(edit, kind, id, fields, check) {
  return fetch(recordUrl(edit), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, id, fields, check: Boolean(check) })
  }).then((response) => response.json()).catch((error) => ({ error: String(error.message || error) })).then((result) => {
    if (result.written) wrote(edit.sessionId, []);
    if (check && result.written && result.before) press.ask(checkPrompt(edit.runId, result));
    return result;
  });
}
var own = (event) => event.stopPropagation();
function EditableTitle(props) {
  const edit = React.useContext(EditContext);
  const { kind, id, title } = props;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title || "");
  const [saved, setSaved] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef(null);
  React.useEffect(() => {
    if (saved !== null && saved === title) setSaved(null);
  }, [title]);
  React.useEffect(() => {
    if (editing && input.current) {
      input.current.focus();
      input.current.select();
    }
  }, [editing]);
  const shown = saved !== null ? saved : title;
  const label = props.children && saved === null ? props.children : shown;
  if (!edit || !edit.enabled || !id) return /* @__PURE__ */ h("span", { className: props.className }, label);
  const start = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setValue(shown || "");
    setError("");
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError("");
  };
  const commit = (check) => {
    const next = value.trim();
    if (!next) return setError("A title cannot be empty.");
    if (next === (shown || "")) return cancel();
    setBusy(true);
    saveRecord(edit, kind, id, { title: next }, check).then((result) => {
      setBusy(false);
      if (result.error) return setError(String(result.error));
      setSaved(next);
      setEditing(false);
    });
  };
  if (editing) {
    return /* @__PURE__ */ h("span", { className: "retitle", "data-own-escape": "", onMouseDown: own, onDragStart: (e) => e.preventDefault(), onClick: own }, /* @__PURE__ */ h(
      "input",
      {
        ref: input,
        value,
        disabled: busy,
        draggable: "false",
        "aria-label": "Title",
        onChange: (e) => setValue(e.target.value),
        onKeyDown: (e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit((e.ctrlKey || e.metaKey) && CHECKED.has(kind));
          if (e.key === "Escape") cancel();
        }
      }
    ), /* @__PURE__ */ h("button", { type: "button", className: "chip primary", disabled: busy, title: "Save the new title, and nothing else (Enter)", onClick: () => commit(false) }, busy ? "Saving…" : "Save"), CHECKED.has(kind) ? /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "chip ask",
        disabled: busy,
        title: "Save, then have the assistant say whether the topic changed and ask about what that leaves behind (Ctrl+Enter)",
        onClick: () => commit(true)
      },
      "Save + check ✦"
    ) : null, /* @__PURE__ */ h("button", { type: "button", className: "chip", disabled: busy, onClick: cancel }, "Cancel"), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "chip",
        disabled: busy,
        title: "Every field this item has that the page may change",
        onClick: () => {
          cancel();
          edit.open(kind, id);
        }
      },
      "All fields…"
    ), error ? /* @__PURE__ */ h("small", { className: "reerror" }, error) : null);
  }
  return /* @__PURE__ */ h("span", { className: "retitled " + (props.className || "") }, label, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "repen",
      draggable: "false",
      title: "Rename — or Shift-click for every field",
      "aria-label": "Rename " + (shown || id),
      onMouseDown: own,
      onClick: (event) => {
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          edit.open(kind, id);
        } else start(event);
      }
    },
    /* @__PURE__ */ h(Icon, { name: "edit" })
  ));
}
function EditButton(props) {
  const edit = React.useContext(EditContext);
  if (!edit || !edit.enabled || !props.id) return null;
  return /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "repen solo",
      title: props.title || "Change it",
      "aria-label": "Edit " + props.id,
      onMouseDown: own,
      onClick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        edit.open(props.kind, props.id);
      }
    },
    /* @__PURE__ */ h(Icon, { name: "edit" })
  );
}
function ModuleTitles(props) {
  return (props.modules || []).map((m, i) => /* @__PURE__ */ h(Fragment2, { key: m.module_id || i }, i ? " · " : null, /* @__PURE__ */ h(EditableTitle, { kind: "module", id: m.module_id, title: m.title })));
}
function RecordDialog(props) {
  const edit = React.useContext(EditContext);
  const { kind, id, onClose } = props;
  const [record, setRecord] = React.useState(null);
  const [values, setValues] = React.useState({});
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ask, setAsk] = React.useState("");
  const box = React.useRef(null);
  React.useEffect(() => {
    let live = true;
    fetch(recordUrl(edit, "&kind=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id)), { headers: { accept: "application/json" } }).then((response) => response.json()).then((value) => {
      if (!live) return;
      if (value.error) return setError(String(value.error));
      setRecord(value);
      setValues(Object.fromEntries(value.fields.map((f) => [f.name, String(f.value ?? "")])));
    }).catch((e) => live && setError(String(e.message || e)));
    return () => {
      live = false;
    };
  }, [kind, id]);
  React.useEffect(() => {
    const first = box.current && box.current.querySelector("input,textarea");
    if (first) first.focus();
  }, [record]);
  const changed = record ? Object.fromEntries(record.fields.filter((f) => (values[f.name] ?? "") !== String(f.value ?? "")).map((f) => [f.name, values[f.name] ?? ""])) : {};
  const missing = record ? record.fields.find((f) => f.required && !String(values[f.name] || "").trim()) : null;
  const save = (check) => {
    if (!Object.keys(changed).length) return onClose();
    setBusy(true);
    saveRecord(edit, kind, id, changed, check).then((result) => {
      setBusy(false);
      if (result.error) return setError(String(result.error));
      onClose();
    });
  };
  const title = record ? (record.fields.find((f) => f.name === "title") || {}).value : "";
  const sendAsk = () => {
    const text = ask.trim();
    if (!text) return;
    press.ask("About " + id + (title ? " (“" + title + "”)" : "") + " in " + edit.runId + ": " + text);
    onClose();
  };
  return /* @__PURE__ */ h("div", { className: "rdveil", "data-own-escape": "", onMouseDown: (e) => e.target === e.currentTarget && !busy && onClose() }, /* @__PURE__ */ h(
    "div",
    {
      ref: box,
      className: "rdialog",
      role: "dialog",
      "aria-label": "Edit " + id,
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !missing) save(false);
      }
    },
    /* @__PURE__ */ h("div", { className: "rdhead" }, /* @__PURE__ */ h("span", { className: "k" }, record ? record.word : "Item"), /* @__PURE__ */ h("span", { className: "mono rdid" }, id), record && record.draft ? /* @__PURE__ */ h("span", { className: "k" }, "draft") : null, /* @__PURE__ */ h("button", { type: "button", className: "rdclose", "aria-label": "Close", onClick: onClose }, "×")),
    !record && !error ? /* @__PURE__ */ h("p", { className: "calm" }, "Reading the record…") : null,
    record ? record.fields.map((f) => /* @__PURE__ */ h("label", { key: f.name, className: "rdfield" }, /* @__PURE__ */ h("span", null, f.label, f.required ? "" : /* @__PURE__ */ h("small", null, " · may be empty")), f.shape === "text" ? /* @__PURE__ */ h(
      "textarea",
      {
        rows: 5,
        maxLength: f.max,
        value: values[f.name] ?? "",
        onChange: (e) => setValues(Object.assign({}, values, { [f.name]: e.target.value }))
      }
    ) : /* @__PURE__ */ h(
      "input",
      {
        maxLength: f.max,
        value: values[f.name] ?? "",
        onChange: (e) => setValues(Object.assign({}, values, { [f.name]: e.target.value }))
      }
    ))) : null,
    record && record.draft ? /* @__PURE__ */ h("p", { className: "rdnote" }, "Changing a draft does not accept it: it stays ", /* @__PURE__ */ h("span", { className: "mono" }, "approval: draft"), ".") : null,
    error ? /* @__PURE__ */ h("p", { className: "reerror" }, error) : null,
    /* @__PURE__ */ h("div", { className: "pf-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "chip primary", disabled: !record || busy || Boolean(missing), title: "Save these fields, and nothing else", onClick: () => save(false) }, busy ? "Saving…" : Object.keys(changed).length ? "Save" : "Done"), record && record.check && Object.keys(changed).length ? /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "chip ask",
        disabled: busy || Boolean(missing),
        title: "Save, then have the assistant say whether the topic changed and ask about what that leaves behind",
        onClick: () => save(true)
      },
      "Save + check ✦"
    ) : null, /* @__PURE__ */ h("button", { type: "button", className: "chip", disabled: busy, onClick: onClose }, "Cancel"), missing ? /* @__PURE__ */ h("small", { className: "reerror" }, missing.label, " cannot be empty.") : null),
    /* @__PURE__ */ h("div", { className: "rdask" }, /* @__PURE__ */ h(Icon, { name: "ask" }), /* @__PURE__ */ h(
      "input",
      {
        placeholder: "Anything else about it — the weight, the rubric, the outcomes — ask the assistant",
        value: ask,
        onChange: (e) => setAsk(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            sendAsk();
          }
        }
      }
    ), /* @__PURE__ */ h("button", { type: "button", className: "chip ask", disabled: !ask.trim(), onClick: sendAsk }, "Ask"))
  ));
}
function EditScope(props) {
  const [open2, setOpen] = React.useState(null);
  const value = React.useMemo(
    () => ({
      runId: props.runId,
      sessionId: props.sessionId,
      enabled: props.enabled,
      open: (kind, id) => setOpen({ kind, id })
    }),
    [props.runId, props.sessionId, props.enabled]
  );
  return /* @__PURE__ */ h(EditContext.Provider, { value }, props.children, open2 && props.enabled ? /* @__PURE__ */ h(RecordDialog, { key: open2.kind + "|" + open2.id, kind: open2.kind, id: open2.id, onClose: () => setOpen(null) }) : null);
}

// client/course/term.jsx
var isEmpty = (w) => !(w.modules || []).length && !(w.meetings || []).length;
var rowsOf = (weeks, empty = isEmpty) => {
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && empty(weeks[j])) j += 1;
    if (j - i >= 2) {
      rows.push({ band: weeks.slice(i, j) });
      i = j;
    } else {
      rows.push({ week: weeks[i] });
      i += 1;
    }
  }
  return rows;
};
var undatedOf = (data) => {
  const out = [];
  for (const w of data.weeks || []) for (const a of w.undated || []) out.push({ a, w });
  for (const a of data.unplaced && data.unplaced.assessments || []) out.push({ a, w: null });
  return out;
};
var tallyOf = (data, rows, current) => {
  const tally = { soon: 0, later: 0, past: 0 };
  for (const { w } of undatedOf(data)) tally[w ? tierOf(w, current) : "soon"] += 1;
  for (const row of rows) {
    if (row.band) {
      const tier2 = tierOf(row.band[0], current);
      for (const w2 of row.band) if ((w2.gaps || []).some((g) => g.kind === "module")) tally[tier2] += 1;
      continue;
    }
    const w = row.week;
    const tier = tierOf(w, current);
    const gaps = w.gaps || [];
    const has = (kind) => gaps.find((g) => g.kind === kind);
    tally[tier] += gaps.filter((g) => g.kind === "module" || g.kind === "weight").length;
    const misdated = new Set(has("misdated") && has("misdated").ids || []);
    tally[tier] += (w.meetings || []).filter((m) => misdated.has(m.activity_id)).length;
    if (has("deck")) tally[tier] += 1;
    const seen = /* @__PURE__ */ new Set();
    for (const a of [...w.opens || [], ...w.due || []]) {
      if (!hasBrief(a) && !seen.has(a.assessment_id)) {
        seen.add(a.assessment_id);
        tally[tier] += 1;
      }
    }
  }
  return tally;
};
function Tally(props) {
  const { data, current } = props;
  const tally = tallyOf(data, rowsOf(data.weeks || []), current);
  const title = Object.entries(data.totals && data.totals.gaps || {}).map(([k, v]) => k + ": " + v).join(" · ");
  return /* @__PURE__ */ h("div", { className: "tally", title }, /* @__PURE__ */ h("span", { className: tally.soon ? "soon" : "zero" }, tally.soon, " this week or next"), /* @__PURE__ */ h("span", { className: tally.later ? "" : "zero" }, tally.later, " later"), /* @__PURE__ */ h("span", { className: "past" }, tally.past, " in weeks taught"));
}
function WeekRow(props) {
  const { w, data, run: run2, current, student, status } = props;
  const showGaps = !student;
  const tier = tierOf(w, current);
  const gaps = showGaps ? w.gaps || [] : [];
  const has = (kind) => gaps.find((g) => g.kind === kind);
  const misdated = new Set(has("misdated") && has("misdated").ids || []);
  const module2 = (w.modules || [])[0];
  const title = (w.modules || []).map((m) => m.title).join(" · ");
  const concepts = (w.modules || []).flatMap((m) => (m.concepts || []).map((c) => c.title || c.id));
  const lecture = (w.meetings || []).map((m) => {
    const resources = [...m.resources || []].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
    return /* @__PURE__ */ h("div", { className: "meeting", key: m.activity_id }, /* @__PURE__ */ h("span", { className: "chip meet" + (m.draft ? " draft" : ""), title: m.title || "" }, /* @__PURE__ */ h("span", { className: "k mono" }, shortDate(m.on) || "no date"), /* @__PURE__ */ h(Icon, { name: MEETING_ICON[m.type] || "lecture" }), [m.type, m.location].filter(Boolean).join(" · ")), /* @__PURE__ */ h(EditButton, { kind: "activity", id: m.activity_id, title: "Change this meeting: its title, room, description" }), misdated.has(m.activity_id) ? /* @__PURE__ */ h(GapChip, { kind: "misdated", tier, prompt: promptFor("misdated", w, run2, m.activity_id), title: has("misdated").note }) : null, resources.map((r, i) => /* @__PURE__ */ h(MaterialChips, { key: (r.resource_id || r.title) + i, resource: r })));
  });
  const deckGap = has("deck");
  const seen = /* @__PURE__ */ new Set();
  const graded = [];
  for (const [list, verb, field] of [[w.opens, "opens", "opens_on"], [w.due, "due", "due_on"]]) {
    for (const a of list || []) {
      const last = verb === "due" || !(w.due || []).some((d) => d.assessment_id === a.assessment_id);
      graded.push(
        /* @__PURE__ */ h(Fragment2, { key: verb + a.assessment_id }, /* @__PURE__ */ h(WorkChip, { work: a, when: verb + " " + shortDate(a[field]) }), /* @__PURE__ */ h(EditButton, { kind: "assessment", id: a.assessment_id, title: "Change its title or description" }), student || !last ? null : /* @__PURE__ */ h(StatusLine, { work: a, status }))
      );
      if (showGaps && !hasBrief(a) && !seen.has(a.assessment_id)) {
        seen.add(a.assessment_id);
        graded.push(
          /* @__PURE__ */ h(
            GapChip,
            {
              key: "brief" + a.assessment_id,
              kind: "brief",
              tier,
              prompt: promptFor("brief", w, run2, a.assessment_id),
              title: a.assessment_id + " has no brief and no description."
            }
          )
        );
      }
    }
  }
  if (!showGaps) for (const a of w.undated || []) graded.push(/* @__PURE__ */ h(WorkChip, { key: "undated" + a.assessment_id, work: a, when: "no date" }));
  const taught = /* @__PURE__ */ new Map();
  for (const m of w.modules || []) for (const o of m.outcomes || []) taught.set(o.id, o.title || o.id);
  const assessed = new Set((w.due || []).flatMap((a) => a.outcomes || []));
  const outcomeIds = [.../* @__PURE__ */ new Set([...taught.keys(), ...assessed])].sort();
  const titles = new Map((data.outcomes || []).map((o) => [o.outcome_id, o.title]));
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "wkhead " + (w.when === "current" ? "now" : w.when === "past" ? "past" : ""), id: "week-" + w.week }, /* @__PURE__ */ h("b", null, twoDigits(w.week)), /* @__PURE__ */ h("span", { className: "k mono" }, shortDate(w.starts_on), " – ", shortDate(w.ends_on)), title ? /* @__PURE__ */ h("h3", null, /* @__PURE__ */ h(ModuleTitles, { modules: w.modules })) : /* @__PURE__ */ h("h3", { className: "none" }, "Unplanned"), w.when === "current" ? /* @__PURE__ */ h("span", { className: "pill now" }, "this week") : null, (w.modules || []).some((m) => m.draft) ? /* @__PURE__ */ h("span", { className: "pill draft" }, "draft") : null, gaps.filter((g) => g.kind === "module" || g.kind === "weight").map((g) => /* @__PURE__ */ h(GapChip, { key: g.kind, kind: g.kind, tier, prompt: promptFor(g.kind, w, run2), title: g.note })), module2 ? /* @__PURE__ */ h(
    AskButton,
    {
      className: "chip ask askw",
      title: "Ask the assistant to prepare this week",
      prompt: "For week " + w.week + " of " + run2.id + " (" + module2.module_id + "), what should I teach and what should I revisit first?",
      label: "Prepare"
    }
  ) : null), concepts.length ? /* @__PURE__ */ h("div", { className: "concepts" }, /* @__PURE__ */ h(Icon, { name: "concept" }), concepts.map((c, i) => /* @__PURE__ */ h("span", { className: "chip concept", key: c + i }, c))) : null, /* @__PURE__ */ h("div", { className: "cell", "data-col": "Lecture" }, lecture, deckGap ? /* @__PURE__ */ h(GapChip, { kind: "deck", tier, prompt: promptFor("deck", w, run2), title: deckGap.note }) : null, lecture.length ? null : /* @__PURE__ */ h(Dash, null)), /* @__PURE__ */ h("div", { className: "cell", "data-col": "Graded work" }, graded.length ? graded : /* @__PURE__ */ h(Dash, null)), /* @__PURE__ */ h("div", { className: "cell", "data-col": "Outcomes" }, outcomeIds.length ? outcomeIds.map((id) => {
    const how = taught.has(id) && assessed.has(id) ? "taught · assessed" : assessed.has(id) ? "assessed" : "taught";
    return /* @__PURE__ */ h("span", { key: id, className: "chip lo" + (assessed.has(id) ? " hit" : ""), title: (taught.get(id) || titles.get(id) || id) + " — " + how }, /* @__PURE__ */ h(Icon, { name: "outcome" }), id, /* @__PURE__ */ h("span", { className: "k" }, how));
  }) : /* @__PURE__ */ h(Dash, null)));
}
function BandRow(props) {
  const { band, run: run2, current, student, status } = props;
  const a = band[0];
  const z = band[band.length - 1];
  const span = "Weeks " + a.week + "–" + z.week;
  const holds = current !== null && current >= a.week && current <= z.week;
  return /* @__PURE__ */ h("div", { className: "band" + (holds ? " now" : ""), id: "week-" + a.week }, /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Icon, { name: "calendar" }), " ", span), /* @__PURE__ */ h("span", { className: "k mono" }, shortDate(a.starts_on), " – ", shortDate(z.ends_on)), /* @__PURE__ */ h("span", { className: "none" }, student ? "no sessions scheduled" : "unplanned · " + band.length + " weeks"), band.flatMap((w) => [
    ...(w.opens || []).map((x) => /* @__PURE__ */ h(Fragment2, { key: "o" + w.week + x.assessment_id }, /* @__PURE__ */ h(WorkChip, { work: x, when: "opens " + shortDate(x.opens_on) }), student ? null : /* @__PURE__ */ h(StatusLine, { work: x, status }))),
    ...(w.due || []).map((x) => /* @__PURE__ */ h(Fragment2, { key: "d" + w.week + x.assessment_id }, /* @__PURE__ */ h(WorkChip, { work: x, when: "due " + shortDate(x.due_on) }), student ? null : /* @__PURE__ */ h(StatusLine, { work: x, status })))
  ]), student ? null : /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "chip gap " + tierOf(a, current),
      "data-ask": "",
      onClick: () => press.ask(
        span + " of " + run2.id + " have no module. Propose what they should teach, given what comes before them and what falls due in them, as draft modules for me to read."
      )
    },
    /* @__PURE__ */ h(Icon, { name: "module" }),
    "Plan ",
    span.toLowerCase()
  ));
}
function Term(props) {
  const { data, student, status } = props;
  const run2 = data.run || {};
  const current = data.current_week ?? null;
  const undated = undatedOf(data);
  return /* @__PURE__ */ h(Fragment2, null, !student && undated.length ? /* @__PURE__ */ h("div", { className: "lead" }, /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Icon, { name: "misdated" }), " ", undated.length, " ", undated.length === 1 ? "thing is" : "things are", " not on the calendar yet"), undated.map(({ a, w }) => /* @__PURE__ */ h(Fragment2, { key: a.assessment_id }, /* @__PURE__ */ h(WorkChip, { work: a, when: "no date" }), /* @__PURE__ */ h(StatusLine, { work: a, status }), /* @__PURE__ */ h(
    GapChip,
    {
      kind: "deadline",
      tier: w ? tierOf(w, current) : "soon",
      prompt: datesPrompt(a, run2),
      title: a.assessment_id + " has no dates" + (w ? "; its module is week " + w.week : "") + "."
    }
  )))) : null, /* @__PURE__ */ h("div", { className: "grid" }, /* @__PURE__ */ h("div", { className: "th" }, "Lecture"), /* @__PURE__ */ h("div", { className: "th" }, "Graded work"), /* @__PURE__ */ h("div", { className: "th" }, "Outcomes"), rowsOf(data.weeks || []).map(
    (row) => row.band ? /* @__PURE__ */ h(BandRow, { key: "band" + row.band[0].week, band: row.band, run: run2, current, student, status }) : /* @__PURE__ */ h(WeekRow, { key: row.week.week, w: row.week, data, run: run2, current, student, status })
  )), /* @__PURE__ */ h(StructureFoot, null));
}
function StructureFoot() {
  return /* @__PURE__ */ h("p", { className: "foot" }, "Structure only — nothing here is derived from student work. Accepting a draft is changing", " ", /* @__PURE__ */ h("span", { className: "mono" }, "approval: draft"), " in its record; this page points at records and changes none.");
}

// client/course/evidence.jsx
function SignalLine(props) {
  const s = props.signal;
  return /* @__PURE__ */ h("li", { className: s.severity === "high" ? "flagged" : "" }, /* @__PURE__ */ h(Icon, { name: "concept" }), /* @__PURE__ */ h("span", null, s.description), s.severity ? /* @__PURE__ */ h("small", null, s.severity) : null);
}
function Figures(props) {
  const { a, w, work } = props;
  if (w.when === "upcoming") return /* @__PURE__ */ h("small", { className: "none" }, "not due yet");
  const f = work[a.assessment_id];
  if (!f) return /* @__PURE__ */ h("small", { className: "none" }, "no approved marks yet");
  const out = [];
  if (f.enrolled !== null && f.submitted !== null) out.push(f.submitted + " of " + f.enrolled + " handed in");
  if (f.not_submitted) out.push(f.not_submitted + " not handed in");
  if (f.graded !== null) out.push(f.graded + " graded" + (f.partially_graded ? " · " + f.partially_graded + " partly" : ""));
  if (f.mean !== null) out.push("mean " + f.mean + (f.maximum !== null ? " of " + f.maximum : ""));
  if (f.median !== null) out.push("median " + f.median);
  return /* @__PURE__ */ h("small", null, out.join(" · "));
}
function Evidence(props) {
  const { data, evidence, status } = props;
  const run2 = data.run || {};
  const weeks = data.weeks || [];
  const current = data.current_week ?? null;
  const ev = evidence || {};
  const concepts = ev.concepts || {};
  const work = ev.work || {};
  const signals = ev.signals || [];
  const has = (c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean !== void 0;
  const weekOfConcept = /* @__PURE__ */ new Map();
  for (const w of weeks) for (const c of conceptsOf(w)) if (!weekOfConcept.has(c.id)) weekOfConcept.set(c.id, w.week);
  const signalWeek = (s) => (s.concepts || []).map((c) => weekOfConcept.get(c)).find((n) => n !== void 0) ?? null;
  const loose = signals.filter((s) => signalWeek(s) === null);
  const measured = (w) => (w.due || []).length > 0 || conceptsOf(w).some(has) || signals.some((s) => signalWeek(s) === w.week);
  const weekRow = (w) => {
    const here = signals.filter((s) => signalWeek(s) === w.week);
    const module2 = (w.modules || [])[0];
    const weak = conceptsOf(w).filter((c) => has(c) && concepts[c.id].class_mean < REVISIT_BELOW);
    return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "wkhead " + (w.when === "current" ? "now" : w.when === "past" ? "past" : ""), id: "week-" + w.week }, /* @__PURE__ */ h("b", null, twoDigits(w.week)), /* @__PURE__ */ h("span", { className: "k mono" }, shortDate(w.starts_on), " – ", shortDate(w.ends_on)), titleOf(w) ? /* @__PURE__ */ h("h3", null, titleOf(w)) : /* @__PURE__ */ h("h3", { className: "none" }, "Unplanned"), w.when === "current" ? /* @__PURE__ */ h("span", { className: "pill now" }, "this week") : null, /* @__PURE__ */ h("span", { className: "askw" }, weak.length ? /* @__PURE__ */ h(
      AskButton,
      {
        prompt: "In week " + w.week + " of " + run2.id + (module2 ? " (" + module2.module_id + ")" : "") + ", the class is weakest on " + weak.map((c) => c.id).join(", ") + ". Read the approved evidence for those concepts and tell me what went wrong and what to revisit. Change nothing.",
        label: "Why did this week go wrong?"
      }
    ) : null)), /* @__PURE__ */ h("div", { className: "cell", "data-col": "Due that week" }, (w.due || []).length ? /* @__PURE__ */ h("ul", { className: "facts" }, w.due.map((a) => /* @__PURE__ */ h("li", { key: a.assessment_id }, /* @__PURE__ */ h(WorkChip, { work: a, when: "due " + shortDate(a.due_on) }), /* @__PURE__ */ h(Figures, { a, w, work }), /* @__PURE__ */ h(StatusLine, { work: a, status })))) : /* @__PURE__ */ h(Dash, null)), /* @__PURE__ */ h("div", { className: "cell", "data-col": "Concepts taught" }, conceptsOf(w).length ? /* @__PURE__ */ h("ul", { className: "facts" }, conceptsOf(w).map((c) => {
      const x = concepts[c.id];
      const low = has(c) && x.class_mean < REVISIT_BELOW;
      return /* @__PURE__ */ h("li", { key: c.id, className: low ? "flagged" : "" }, /* @__PURE__ */ h(Icon, { name: "concept" }), /* @__PURE__ */ h("span", null, c.title || c.id), /* @__PURE__ */ h("small", null, has(c) ? "class " + pct(x.class_mean) + " · " + (x.coverage || "") + " observed" + (low ? " · revisit" : "") : "not assessed yet"));
    })) : /* @__PURE__ */ h(Dash, null)), /* @__PURE__ */ h("div", { className: "cell", "data-col": "Signals" }, here.length ? /* @__PURE__ */ h("ul", { className: "facts" }, here.map((s, i) => /* @__PURE__ */ h(SignalLine, { key: i, signal: s }))) : /* @__PURE__ */ h(Dash, null)));
  };
  return /* @__PURE__ */ h("div", { className: "mode evidence" }, /* @__PURE__ */ h("div", { className: "stepper" }, /* @__PURE__ */ h("b", null, current ? "Week " + current + " of " + weeks.length : weeks.length + " weeks"), /* @__PURE__ */ h("span", { className: "private" }, "Private — class figures from approved evidence only")), loose.length ? /* @__PURE__ */ h("div", { className: "side" }, /* @__PURE__ */ h("small", null, "Open signals not tied to a week"), /* @__PURE__ */ h("ul", { className: "facts" }, loose.map((s, i) => /* @__PURE__ */ h(SignalLine, { key: i, signal: s })))) : null, /* @__PURE__ */ h("div", { className: "grid" }, /* @__PURE__ */ h("div", { className: "th" }, "Due that week"), /* @__PURE__ */ h("div", { className: "th" }, "Concepts taught"), /* @__PURE__ */ h("div", { className: "th" }, "Signals"), rowsOf(weeks, (w) => !measured(w)).map((row) => {
    if (!row.band) return /* @__PURE__ */ h(Fragment2, { key: row.week.week }, weekRow(row.week));
    const a = row.band[0];
    const z = row.band[row.band.length - 1];
    const holds = current !== null && current >= a.week && current <= z.week;
    return /* @__PURE__ */ h("div", { key: "band" + a.week, className: "band" + (holds ? " now" : ""), id: "week-" + a.week }, /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Icon, { name: "calendar" }), " Weeks ", a.week, "–", z.week), /* @__PURE__ */ h("span", { className: "k mono" }, shortDate(a.starts_on), " – ", shortDate(z.ends_on)), /* @__PURE__ */ h("span", { className: "none" }, "nothing due, nothing measured yet"));
  })), /* @__PURE__ */ h("p", { className: "foot" }, "Hand-ins and marks are the gradebook's, from approved decisions; a concept's class mean is over approved evidence. A concept under", " ", pct(REVISIT_BELOW), " is marked to revisit."));
}

// client/course/planning.jsx
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var nice = (d) => {
  const p = d.split("-");
  return MON[+p[1] - 1] + " " + +p[2];
};
var addDays = (d, n) => {
  const p = d.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
};
var local = (s) => s ? String(s).slice(0, 16) : "";
var offOf = (s, fallback) => {
  const m = /(Z|[+-][0-9][0-9]:[0-9][0-9])$/.exec(s || "");
  return m ? m[1] === "Z" ? "+00:00" : m[1] : fallback;
};
var shift = (v, n) => v ? addDays(v.slice(0, 10), n) + v.slice(10) : v;
var dayName = (d) => DAY[(/* @__PURE__ */ new Date(d + "T12:00:00Z")).getUTCDay()];
var when2 = (v) => v ? dayName(v.slice(0, 10)) + " " + nice(v.slice(0, 10)) + ", " + v.slice(11, 16) : "";
var sameInstant = (a, b) => (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);
var withOverrides = (data, dates, topics) => {
  const fix = (a) => {
    const o = dates[a.assessment_id];
    if (!o) return a;
    return Object.assign({}, a, {
      opens_at: o.opens_at || null,
      due_at: o.due_at || null,
      opens_on: o.opens_at ? o.opens_at.slice(0, 10) : null,
      due_on: o.due_at ? o.due_at.slice(0, 10) : null
    });
  };
  const undated = [...(data.weeks || []).flatMap((w) => w.undated || []), ...data.unplaced && data.unplaced.assessments || []];
  const known = new Set((data.assessments || []).map((a) => a.assessment_id));
  const assessments = [...data.assessments || [], ...undated.filter((a) => !known.has(a.assessment_id))].map(fix);
  const modules = [];
  for (const w of data.weeks || []) {
    for (const m of w.modules || []) {
      modules.push({ module: m, week: topics[m.module_id] ? topics[m.module_id].week : w.week, meetings: (w.meetings || []).filter((x) => x.module_id === m.module_id) });
    }
  }
  return { assessments, modules };
};
function Toast(props) {
  if (!props.text) return null;
  return /* @__PURE__ */ h("div", { className: "plantoast", role: "status" }, props.text);
}
var useOutside = (ref, onOutside) => {
  const latest = React.useRef(onOutside);
  latest.current = onOutside;
  React.useEffect(() => {
    const root = ref.current && ref.current.getRootNode();
    if (!root) return void 0;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) latest.current();
    };
    root.addEventListener("mousedown", onDown, true);
    return () => root.removeEventListener("mousedown", onDown, true);
  }, []);
};
var placed = (x, y, width, height) => ({
  left: Math.max(12, Math.min(x + 14, window.innerWidth - width - 12)) + "px",
  top: Math.max(12, Math.min(y + 14, window.innerHeight - height - 12)) + "px"
});
var daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
function WeekWhen(props) {
  const { value, rows, weekOf, isOpens, className, onChange } = props;
  const day = value ? value.slice(0, 10) : "";
  const row = day ? rows.find((r) => r.n === weekOf(day)) : null;
  const time = value ? value.slice(11, 16) : isOpens ? "09:00" : "23:59";
  const days = (r) => Array.from({ length: daysBetween(r.from, r.to) + 1 }, (_, i) => addDays(r.from, i));
  const toWeek = (n) => {
    const r = rows.find((x) => x.n === n);
    if (!r) return onChange("");
    const len = daysBetween(r.from, r.to);
    const at = row ? Math.min(daysBetween(row.from, day), len) : isOpens ? 0 : len;
    onChange(addDays(r.from, at) + "T" + time);
  };
  return /* @__PURE__ */ h("span", { className: "pf-week-pick " + className }, /* @__PURE__ */ h("select", { value: row ? row.n : "", onChange: (e) => toWeek(Number(e.target.value)), "aria-label": "Week" }, /* @__PURE__ */ h("option", { value: "" }, isOpens ? "No opening" : "Week…"), rows.map((r) => /* @__PURE__ */ h("option", { key: r.n, value: r.n }, "Week " + r.n + " · " + nice(r.from)))), row ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("select", { value: day, onChange: (e) => onChange(e.target.value + "T" + time), "aria-label": "Day" }, days(row).map((d) => /* @__PURE__ */ h("option", { key: d, value: d }, dayName(d) + " " + nice(d)))), /* @__PURE__ */ h("input", { type: "time", value: time, onChange: (e) => e.target.value && onChange(day + "T" + e.target.value), "aria-label": "Time" })) : null);
}
function DatesForm(props) {
  const { pending, item, rows, rowOf, weekOf, taughtBefore, onChange, onSave, onCancel } = props;
  const [brief, setBrief] = React.useState(pending.brief);
  const outside = [pending.opens, pending.due].some((v) => v && !weekOf(v.slice(0, 10)));
  const [byDate, setByDate] = React.useState(outside);
  const ref = React.useRef(null);
  useOutside(ref, () => !pending.saving && onCancel());
  const [size2, setSize] = React.useState({ w: 290, h: 200 });
  React.useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, [brief, byDate, Boolean(pending.opens), Boolean(pending.due)]);
  React.useEffect(() => {
    const first = ref.current && ref.current.querySelector(brief ? ".pf-save" : byDate ? ".pf-due" : ".pf-due select");
    if (first) first.focus();
  }, [brief, byDate]);
  const wasTaught = (v) => Boolean(taughtBefore && v && v.slice(0, 10) < taughtBefore);
  const frozen = (was, now) => was !== now && (wasTaught(was) || wasTaught(now));
  const orig = { opens: local(item.opens_at), due: local(item.due_at) };
  const bad = !pending.due ? "It needs a due date." : pending.opens && pending.opens > pending.due ? "It would open after it is due." : frozen(orig.opens, pending.opens) ? "Its opening would move into or out of a week already taught." : frozen(orig.due, pending.due) ? "Its due date would move into or out of a week already taught." : "";
  const hint = (v, isOpens) => {
    if (!v) return { text: isOpens ? "no opening date" : "", off: false };
    const w = weekOf(v.slice(0, 10));
    return { text: w ? "week " + w + " · " + dayName(v.slice(0, 10)) : "outside the term", off: !w };
  };
  const r = pending.to ? rowOf(pending.to) : null;
  const opensHint = hint(pending.opens, true);
  const dueHint = hint(pending.due, false);
  return /* @__PURE__ */ h(
    "div",
    {
      ref,
      className: "planform" + (brief ? " brief" : ""),
      role: "dialog",
      "aria-label": "Dates",
      style: placed(pending.x, pending.y, size2.w, size2.h),
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }
    },
    /* @__PURE__ */ h("b", { className: "pf-title" }, item.title || pending.id),
    /* @__PURE__ */ h("small", { className: "pf-week" }, r ? (brief && pending.from ? "Week " + pending.from + " → week " + r.n : "Week " + r.n) + " · " + nice(r.from) + " – " + nice(r.to) : ""),
    /* @__PURE__ */ h("p", { className: "pf-sum" }, (pending.opens ? "Opens " + when2(pending.opens) + " · " : "") + "due " + when2(pending.due)),
    /* @__PURE__ */ h("div", { className: "pf-fields" }, byDate ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("span", null, "Opens"), /* @__PURE__ */ h("input", { type: "datetime-local", className: "pf-opens", value: pending.opens, onChange: (e) => onChange({ opens: e.target.value }) }), /* @__PURE__ */ h("small", { className: "pf-opens-wk" + (opensHint.off ? " off" : "") }, opensHint.text)), /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("span", null, "Due"), /* @__PURE__ */ h("input", { type: "datetime-local", className: "pf-due", required: true, value: pending.due, onChange: (e) => onChange({ due: e.target.value }) }), /* @__PURE__ */ h("small", { className: "pf-due-wk" + (dueHint.off ? " off" : "") }, dueHint.text))) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "pf-row" }, /* @__PURE__ */ h("span", null, "Opens"), /* @__PURE__ */ h(WeekWhen, { value: pending.opens, rows, weekOf, isOpens: true, className: "pf-opens", onChange: (v) => onChange({ opens: v }) })), /* @__PURE__ */ h("div", { className: "pf-row" }, /* @__PURE__ */ h("span", null, "Due"), /* @__PURE__ */ h(WeekWhen, { value: pending.due, rows, weekOf, className: "pf-due", onChange: (v) => onChange({ due: v }) }))), /* @__PURE__ */ h("button", { type: "button", className: "pf-mode", onClick: () => setByDate(!byDate) }, byDate ? "Pick by week instead" : "Pick a calendar date instead")),
    bad ? /* @__PURE__ */ h("p", { className: "pf-error" }, bad) : null,
    /* @__PURE__ */ h("div", { className: "pf-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "primary pf-save", disabled: Boolean(bad) || pending.saving, onClick: onSave }, pending.saving ? "Saving…" : brief ? "Save" : "Save dates"), /* @__PURE__ */ h("button", { type: "button", className: "chip pf-cancel", onClick: onCancel }, "Cancel")),
    /* @__PURE__ */ h("button", { type: "button", className: "pf-more", onClick: () => setBrief(false) }, "Change dates"),
    /* @__PURE__ */ h("small", { className: "pf-note" }, "Writes opens_at and due_at into its record. Canvas keeps its own copy until the definition is sent again.")
  );
}
function TopicForm(props) {
  const { pending, topics, rowOf, weekOf, onChange, onSave, onCancel } = props;
  const [brief, setBrief] = React.useState(true);
  const ref = React.useRef(null);
  useOutside(ref, () => !pending.saving && onCancel());
  const [size2, setSize] = React.useState({ w: 330, h: 200 });
  React.useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, [brief, pending.swap]);
  React.useEffect(() => {
    const save = ref.current && ref.current.querySelector(".tf-save");
    if (save) save.focus();
  }, []);
  const t = topics[pending.id];
  const r = rowOf(pending.to);
  const other = pending.other ? topics[pending.other] : null;
  const cap = (s) => {
    s = String(s || "meeting").replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  let bad = "";
  const list = (mid, values, want, key) => topics[mid].meetings.length ? topics[mid].meetings.map((x) => {
    const v = values[x.activity] || "";
    const w = v ? weekOf(v.slice(0, 10)) : null;
    const off = Boolean(v) && w !== want;
    if (off) bad = "A meeting would fall outside its topic’s week, and show as misdated.";
    return /* @__PURE__ */ h("label", { key: x.activity }, /* @__PURE__ */ h("span", { title: x.activity }, cap(x.type) + (x.group ? " · " + x.group : "")), /* @__PURE__ */ h("input", { type: "datetime-local", value: v, onChange: (e) => onChange(key, x.activity, e.target.value) }), /* @__PURE__ */ h("small", { className: off ? "off" : "" }, !v ? "no date" : w ? "week " + w + " · " + dayName(v.slice(0, 10)) + (w !== want ? " — not this topic’s week" : "") : "outside the term"));
  }) : /* @__PURE__ */ h("small", null, "No meetings to move.");
  const k = t.meetings.length;
  const there = pending.there;
  return /* @__PURE__ */ h(
    "div",
    {
      ref,
      className: "planform topicform" + (brief ? " brief" : ""),
      role: "dialog",
      "aria-label": "Move topic",
      style: placed(pending.x, pending.y, size2.w, size2.h),
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }
    },
    /* @__PURE__ */ h("b", { className: "tf-title" }, t.title),
    /* @__PURE__ */ h("small", { className: "tf-week" }, "Week ", pending.from, " → week ", pending.to, " · ", nice(r.from), " – ", nice(r.to)),
    /* @__PURE__ */ h("p", { className: "pf-sum tf-sum" }, k ? "Its " + (k === 1 ? "meeting moves" : k + " meetings move") + " with it, same days and times." : "It has no meetings to move."),
    /* @__PURE__ */ h("div", { className: "tf-meetings" }, list(pending.id, pending.meetings, pending.to, "meetings")),
    there === 1 && other ? /* @__PURE__ */ h("label", { className: "tf-swap" }, /* @__PURE__ */ h("input", { type: "checkbox", className: "tf-swap-on", checked: pending.swap, onChange: (e) => onChange("swap", null, e.target.checked) }), /* @__PURE__ */ h("span", null, "Swap with “", other.title, "” — it moves to week ", pending.from, " with its meetings")) : there > 1 ? /* @__PURE__ */ h("label", { className: "tf-swap" }, /* @__PURE__ */ h("input", { type: "checkbox", className: "tf-swap-on", disabled: true }), /* @__PURE__ */ h("span", null, "Week ", pending.to, " already has ", there, " topics; this one joins them.")) : null,
    other && pending.swap ? /* @__PURE__ */ h("div", { className: "tf-other" }, list(pending.other, pending.otherMeetings, pending.from, "otherMeetings")) : null,
    bad ? /* @__PURE__ */ h("p", { className: "pf-error tf-error" }, bad) : null,
    /* @__PURE__ */ h("div", { className: "pf-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "primary tf-save", disabled: pending.saving, onClick: onSave }, pending.saving ? "Moving…" : "Save"), /* @__PURE__ */ h("button", { type: "button", className: "chip tf-cancel", onClick: onCancel }, "Cancel")),
    k ? /* @__PURE__ */ h("button", { type: "button", className: "pf-more tf-more", onClick: () => setBrief(false) }, "Change meeting times") : null,
    /* @__PURE__ */ h("small", { className: "pf-note" }, "Writes the module's week and its meetings' dates. Slides and graded work keep theirs.")
  );
}
var TIE = {
  needs: "needs",
  late: "needs, but taught later",
  feeds: "is needed by",
  related: "related to",
  again: "also taught in"
};
function ConceptMap(props) {
  const { at, modules, graph, onClose } = props;
  const [focus, setFocus] = React.useState(at.mids);
  const [hover, setHover] = React.useState(null);
  const ref = React.useRef(null);
  const body = React.useRef(null);
  const nodes = React.useRef({});
  const [lines, setLines] = React.useState([]);
  const [size2, setSize] = React.useState({ w: 720, h: 420 });
  useOutside(ref, onClose);
  const homes = /* @__PURE__ */ new Map();
  for (const x of modules) {
    for (const c of x.module.concepts || []) {
      if (!homes.has(c.id)) homes.set(c.id, []);
      homes.get(c.id).push(x);
    }
  }
  const mine = modules.filter((x) => focus.includes(x.module.module_id));
  const week = mine.length ? mine[0].week : at.week;
  const title = mine.map((x) => x.module.title).join(" · ");
  const seen = /* @__PURE__ */ new Set();
  const concepts = mine.flatMap((x) => x.module.concepts || []).filter((c) => !seen.has(c.id) && seen.add(c.id));
  const titleOf2 = (id) => graph[id] && graph[id].title || id;
  const inHere = (x) => focus.includes(x.module.module_id);
  const ties = [];
  const topics = /* @__PURE__ */ new Map();
  const loose = [];
  const tie = (cid, other, kind) => {
    for (const x of homes.get(other) || []) {
      if (inHere(x)) continue;
      const k = kind === "needs" && x.week > week ? "late" : kind;
      const mid = x.module.module_id;
      if (!topics.has(mid)) topics.set(mid, { x, via: /* @__PURE__ */ new Set(), left: false });
      const t = topics.get(mid);
      t.via.add(titleOf2(other));
      if (k === "needs" || x.week < week && k !== "late") t.left = true;
      if (!ties.some((e) => e.c === cid && e.t === mid && e.kind === k)) ties.push({ c: cid, t: mid, kind: k });
    }
  };
  for (const c of concepts) {
    const g = graph[c.id] || { prerequisites: [], related: [] };
    for (const p of g.prerequisites) {
      if (!(homes.get(p) || []).length && !concepts.some((x) => x.id === p)) loose.push(titleOf2(c.id) + " needs " + titleOf2(p) + ", which no topic teaches");
      tie(c.id, p, "needs");
    }
    for (const [id, other] of Object.entries(graph)) if (other.prerequisites.includes(c.id)) tie(c.id, id, "feeds");
    for (const r of g.related) tie(c.id, r, "related");
    for (const [id, other] of Object.entries(graph)) if (other.related.includes(c.id)) tie(c.id, id, "related");
    tie(c.id, c.id, "again");
  }
  const byWeek = (a, b) => a.x.week - b.x.week;
  const left = [...topics.values()].filter((t) => t.left).sort(byWeek);
  const right = [...topics.values()].filter((t) => !t.left).sort(byWeek);
  const key = focus.join("|");
  React.useLayoutEffect(() => {
    const measure = () => {
      if (!body.current) return;
      const o = body.current.getBoundingClientRect();
      const box = (id) => {
        const el = nodes.current[id];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: r.left - o.left, r: r.right - o.left, y: r.top - o.top + r.height / 2 };
      };
      setLines(
        ties.map((e) => {
          const c = box("c:" + e.c);
          const t = box("t:" + e.t);
          if (!c || !t) return null;
          const toLeft = topics.get(e.t).left;
          const x1 = toLeft ? c.l : c.r;
          const x2 = toLeft ? t.r : t.l;
          const mid = (x1 + x2) / 2;
          return Object.assign({}, e, { d: "M" + x1 + "," + c.y + " C" + mid + "," + c.y + " " + mid + "," + t.y + " " + x2 + "," + t.y });
        }).filter(Boolean)
      );
      if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !body.current) return void 0;
    const observer = new ResizeObserver(measure);
    observer.observe(body.current);
    return () => observer.disconnect();
  }, [key]);
  React.useEffect(() => {
    const close = ref.current && ref.current.querySelector(".cmap-close");
    if (close) close.focus();
  }, []);
  const drawnLines = lines.filter((e) => topics.has(e.t) && concepts.some((c) => c.id === e.c));
  const lit = (e) => !hover || hover === "c:" + e.c || hover === "t:" + e.t;
  const litNode = (id) => !hover || hover === id || drawnLines.some((e) => lit(e) && ("c:" + e.c === id || "t:" + e.t === id));
  const node = (id) => ({
    ref: (el) => nodes.current[id] = el,
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(id),
    onBlur: () => setHover(null)
  });
  const topicBox = (t) => {
    const id = "t:" + t.x.module.module_id;
    return /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        key: id,
        className: "cmap-topic" + (litNode(id) ? "" : " dim"),
        title: "Show the concepts of “" + t.x.module.title + "”",
        onClick: () => {
          setHover(null);
          setFocus(modules.filter((y) => y.week === t.x.week && y.module.module_id === t.x.module.module_id).map((y) => y.module.module_id));
        },
        ...node(id)
      },
      /* @__PURE__ */ h("small", null, "Week ", t.x.week),
      /* @__PURE__ */ h("b", null, t.x.module.title),
      /* @__PURE__ */ h("small", { className: "via" }, [...t.via].join(" · "))
    );
  };
  return /* @__PURE__ */ h(
    "div",
    {
      ref,
      className: "planform cmap",
      role: "dialog",
      "aria-label": "Concepts of " + title,
      style: placed(at.x, at.y, size2.w, size2.h),
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }
    },
    /* @__PURE__ */ h("div", { className: "cmap-head" }, /* @__PURE__ */ h("b", { className: "pf-title" }, title), /* @__PURE__ */ h("small", null, "Week ", week, " · ", concepts.length, " ", concepts.length === 1 ? "concept" : "concepts", " · ", topics.size, " ", topics.size === 1 ? "topic" : "topics", " tied to them"), /* @__PURE__ */ h("button", { type: "button", className: "chip cmap-close", onClick: onClose, "aria-label": "Close" }, "×")),
    /* @__PURE__ */ h("div", { className: "cmap-body", ref: body }, /* @__PURE__ */ h("svg", { className: "cmap-lines", "aria-hidden": "true" }, drawnLines.map((e, i) => /* @__PURE__ */ h("path", { key: i, d: e.d, className: "tie " + e.kind + (lit(e) ? hover ? " lit" : "" : " dim") }, /* @__PURE__ */ h("title", null, titleOf2(e.c) + " " + TIE[e.kind] + " " + topics.get(e.t).x.module.title)))), /* @__PURE__ */ h("div", { className: "cmap-col side" }, /* @__PURE__ */ h("small", { className: "cmap-cap" }, "Builds on"), left.length ? left.map(topicBox) : /* @__PURE__ */ h("small", { className: "none" }, "nothing earlier")), /* @__PURE__ */ h("div", { className: "cmap-col mid" }, /* @__PURE__ */ h("small", { className: "cmap-cap" }, "Concepts"), concepts.length ? concepts.map((c) => /* @__PURE__ */ h("span", { key: c.id, tabIndex: 0, className: "chip concept cmap-c" + (litNode("c:" + c.id) ? "" : " dim"), title: c.id, ...node("c:" + c.id) }, c.title || c.id, /* @__PURE__ */ h(
      Mention,
      {
        mention: props.mention,
        fresh: props.fresh,
        chat: props.chatTitle,
        label: "“" + (c.title || c.id) + "”",
        text: props.words(c.id + " “" + (c.title || c.id) + "” (a concept of " + mine.map((x) => x.module.module_id + " “" + x.module.title + "”").join(", ") + ", week " + week + ")"),
        onDone: (written) => {
          props.onMentioned(written);
          if (written) onClose();
        }
      }
    ))) : /* @__PURE__ */ h("small", { className: "none" }, "This topic names no concepts.")), /* @__PURE__ */ h("div", { className: "cmap-col side" }, /* @__PURE__ */ h("small", { className: "cmap-cap" }, "Leads to"), right.length ? right.map(topicBox) : /* @__PURE__ */ h("small", { className: "none" }, "nothing later"))),
    loose.length ? /* @__PURE__ */ h("p", { className: "pf-error" }, loose.join(". ") + ".") : null,
    /* @__PURE__ */ h("div", { className: "cmap-key" }, /* @__PURE__ */ h("span", { className: "needs" }, "needs"), /* @__PURE__ */ h("span", { className: "late" }, "needed before it is taught"), /* @__PURE__ */ h("span", { className: "feeds" }, "needed by"), /* @__PURE__ */ h("span", { className: "related" }, "related"), /* @__PURE__ */ h("span", { className: "again" }, "taught again"))
  );
}
function Mention(props) {
  const [menu, setMenu] = React.useState(null);
  if (!props.mention && !props.fresh) return null;
  const toThis = () => {
    setMenu(null);
    const written = props.mention(props.text);
    if (props.onDone) props.onDone(written);
  };
  const toNew = () => {
    setMenu(null);
    props.fresh(props.text);
    if (props.onDone) props.onDone(true);
  };
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "star" + (menu ? " open" : ""),
      draggable: "false",
      title: "Ask about " + props.label + " in a chat",
      "aria-label": "Ask about " + props.label + " in a chat",
      "aria-haspopup": props.mention && props.fresh ? "menu" : void 0,
      "aria-expanded": menu ? "true" : void 0,
      onMouseDown: (e) => e.stopPropagation(),
      onClick: (e) => {
        e.stopPropagation();
        if (!props.fresh) return toThis();
        if (!props.mention) return toNew();
        const box = e.currentTarget.getBoundingClientRect();
        setMenu(menu ? null : { x: box.left, y: box.bottom });
      }
    },
    /* @__PURE__ */ h(Icon, { name: "ask" })
  ), menu ? /* @__PURE__ */ h(StarMenu, { at: menu, label: props.label, chat: props.chat ? props.chat() : null, onThis: toThis, onNew: toNew, onClose: () => setMenu(null) }) : null);
}
function StarMenu(props) {
  const ref = React.useRef(null);
  useOutside(ref, props.onClose);
  React.useEffect(() => {
    const first = ref.current && ref.current.querySelector("button");
    if (first) first.focus();
  }, []);
  const move = (e) => {
    const items = [...ref.current.querySelectorAll("button")];
    const i = items.indexOf(e.target);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      props.onClose();
    }
  };
  const chat = props.chat;
  return /* @__PURE__ */ h(
    "div",
    {
      ref,
      className: "starmenu",
      "data-own-escape": "",
      role: "menu",
      "aria-label": "Ask about " + props.label,
      style: placed(props.at.x - 14, props.at.y - 10, 220, 92),
      onKeyDown: move,
      onMouseDown: (e) => e.stopPropagation(),
      onClick: (e) => e.stopPropagation()
    },
    /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: props.onThis, title: chat && chat.title ? chat.title : void 0 }, /* @__PURE__ */ h("b", null, "This chat"), chat && chat.title ? /* @__PURE__ */ h("span", { className: "sm-topic" }, "“", chat.title, "”") : chat && chat.blank ? /* @__PURE__ */ h("span", { className: "sm-topic none" }, "empty — nothing asked yet") : chat ? /* @__PURE__ */ h("span", { className: "sm-topic none" }, "no topic yet") : null, /* @__PURE__ */ h("small", null, "add it to this chat’s message box")),
    /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: props.onNew }, /* @__PURE__ */ h("b", null, "New chat"), /* @__PURE__ */ h("small", null, "start a chat about it, with this page open"))
  );
}
function Planning(props) {
  const { data, student, locks, graph, runId, sessionId } = props;
  const mention = props.mention || null;
  const fresh = props.fresh || null;
  const chatTitle = props.chatTitle || null;
  const run2 = data.run || {};
  const weeks = data.weeks || [];
  const editable = !student;
  const OFF = runOffset(data);
  const rows = weeks.map((w) => ({ n: w.week, from: w.starts_on, to: w.ends_on, taught: w.when === "past" }));
  const rowOf = (n) => rows.find((r) => r.n === n) || null;
  const weekOf = (d) => d ? (rows.find((r) => d >= r.from && d <= r.to) || {}).n || null : null;
  const taught = (n) => n !== null && Boolean((rowOf(n) || {}).taught);
  let taughtBefore = null;
  for (const r of rows) {
    if (r.taught) taughtBefore = "9999";
    else {
      if (taughtBefore) taughtBefore = r.from;
      break;
    }
  }
  const withResults = new Set(locks && locks.results || []);
  const [dates, setDates] = React.useState({});
  const [topicWeeks, setTopicWeeks] = React.useState({});
  const [pending, setPending] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const toastTimer = React.useRef(null);
  const say = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };
  React.useEffect(() => {
    setDates((current) => {
      const next = {};
      for (const [id, o] of Object.entries(current)) {
        const a = (data.assessments || []).find((x) => x.assessment_id === id);
        const settled = o.saved && a && sameInstant(a.due_at, o.due_at) && sameInstant(a.opens_at, o.opens_at);
        if (!settled) next[id] = o;
      }
      return next;
    });
    setTopicWeeks((current) => {
      const next = {};
      for (const [id, o] of Object.entries(current)) {
        const w = weeks.find((x) => (x.modules || []).some((m) => m.module_id === id));
        if (!(o.saved && w && w.week === o.week)) next[id] = o;
      }
      return next;
    });
  }, [data]);
  const drawn = withOverrides(data, dates, topicWeeks);
  const byId = new Map(drawn.assessments.map((a) => [a.assessment_id, a]));
  const recordOf = (id) => {
    const all = [...data.assessments || [], ...(data.weeks || []).flatMap((w) => w.undated || []), ...data.unplaced && data.unplaced.assessments || []];
    return all.find((a) => a.assessment_id === id) || null;
  };
  const topics = {};
  for (const w of weeks) {
    for (const m of w.modules || []) {
      topics[m.module_id] = {
        title: m.title,
        week: w.week,
        meetings: (w.meetings || []).filter((x) => x.module_id === m.module_id).map((x) => ({ activity: x.activity_id, type: x.type, group: x.group || null, scheduled_at: x.scheduled_at || null }))
      };
    }
  }
  const groups = [];
  for (const a of data.assessments || []) {
    const name = kindOf(a.type)[0];
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push(g = { name, weight: 0, count: 0, unweighted: 0 });
    g.count += 1;
    if (a.weight === null || a.weight === void 0) g.unweighted += 1;
    else g.weight += a.weight;
  }
  const grading = data.grading || {};
  const spans = drawn.assessments.filter((a) => a.due_on).map((a) => {
    const end2 = weekOf(a.due_on);
    return { a, lane: laneOf(a.type), start: weekOf(a.opens_on) ?? end2, end: end2 };
  });
  const projects = spans.filter((s) => s.lane[0] === "project" && s.start !== null);
  const lanes = LANES.concat([["other", "Other", "ot"]]).filter((l) => l[0] !== "project" && spans.some((s) => s.lane[1] === l[1]));
  const columns = 3 + lanes.length;
  const [map, setMap] = React.useState(null);
  const undated = drawn.assessments.filter((a) => !a.due_on);
  const faults = [];
  if (!student) {
    const runsOf = (list) => list.reduce((all, n) => {
      const last = all[all.length - 1];
      if (last && last[last.length - 1] === n - 1) last.push(n);
      else all.push([n]);
      return all;
    }, []);
    const unplanned = weeks.filter((w) => (w.gaps || []).some((g) => g.kind === "module")).map((w) => w.week);
    for (const r of runsOf(unplanned)) {
      const span = r.length === 1 ? "Week " + r[0] : "Weeks " + r[0] + "–" + r[r.length - 1];
      faults.push({
        tone: "flag",
        icon: "module",
        text: span + " " + (r.length === 1 ? "has" : "have") + " no topic",
        prompt: span + " of " + run2.id + " " + (r.length === 1 ? "has" : "have") + " no module. Propose what " + (r.length === 1 ? "it" : "they") + " should teach, given what comes before and what falls due, as draft modules for me to read.",
        verb: r.length === 1 ? "Plan week " + r[0] : "Plan these weeks"
      });
    }
    const graded = /* @__PURE__ */ new Set();
    for (const s of spans) if (s.start !== null && s.end !== null) for (let n = s.start; n <= s.end; n += 1) graded.add(n);
    for (const r of runsOf(weeks.map((w) => w.week).filter((n) => !graded.has(n))).filter((r2) => r2.length >= 2)) {
      const span = "Weeks " + r[0] + "–" + r[r.length - 1];
      faults.push({
        tone: "warn",
        icon: "quiz",
        text: span + ": nothing graded opens, runs or falls due",
        prompt: span + " of " + run2.id + " have no graded work opening, running or falling due. Should something be assessed there, given what those weeks teach? Propose it as a draft; change nothing else.",
        verb: "Suggest an assessment"
      });
    }
    for (const a of undated) faults.push({ tone: "flag", icon: "calendar", text: a.title + " has no dates", verb: "Set dates", dated: a.assessment_id });
    if (!grading.complete) {
      faults.push({
        tone: "flag",
        icon: "weight",
        text: grading.note || "The weights do not add up to 100%",
        prompt: "The weights in " + run2.id + " do not settle the grading policy: " + (grading.note || "they do not add up") + " Propose a correction and wait.",
        verb: "Fix the weights"
      });
    }
  }
  const openDates = (id, opens, due, to, from, x, y, brief) => {
    const item = recordOf(id);
    if (!item) return;
    setPending({ kind: "dates", id, opens: opens || "", due: due || "", to, from, x, y, brief });
    setDates((d) => Object.assign({}, d, { [id]: { opens_at: opens ? opens + ":00" + offOf(item.opens_at || item.due_at, OFF) : null, due_at: due ? due + ":00" + offOf(item.due_at, OFF) : null } }));
  };
  const cancel = () => {
    if (!pending) return;
    if (pending.kind === "dates") {
      setDates((d) => {
        const next = Object.assign({}, d);
        if (!(next[pending.id] && next[pending.id].saved)) delete next[pending.id];
        return next;
      });
    } else {
      setTopicWeeks((t) => {
        const next = Object.assign({}, t);
        for (const id of [pending.id, pending.other]) if (id && !(next[id] && next[id].saved)) delete next[id];
        return next;
      });
    }
    setPending(null);
  };
  const changeDates = (change) => {
    const next = Object.assign({}, pending, change);
    setPending(next);
    const item = recordOf(next.id);
    setDates(
      (d) => Object.assign({}, d, {
        [next.id]: {
          opens_at: next.opens ? next.opens + ":00" + offOf(item.opens_at || item.due_at, OFF) : null,
          due_at: next.due ? next.due + ":00" + offOf(item.due_at, OFF) : null
        }
      })
    );
  };
  const post = (path, body) => fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId), sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }).then((response) => response.json()).catch((error) => ({ error: String(error.message || error) }));
  const saveDates = () => {
    const p = pending;
    const o = dates[p.id];
    setPending(Object.assign({}, p, { saving: true }));
    post("/api/plan/dates", { assessment: p.id, opens_at: o.opens_at || "", due_at: o.due_at }).then((result) => {
      if (result.error) {
        setDates((d) => {
          const next = Object.assign({}, d);
          delete next[p.id];
          return next;
        });
        say(String(result.error));
      } else {
        setDates((d) => Object.assign({}, d, { [p.id]: Object.assign({}, d[p.id], { saved: true }) }));
        wrote(sessionId, []);
      }
      setPending(null);
    });
  };
  const openTopic = (mid, to, x, y) => {
    const t = topics[mid];
    if (!t) return;
    const there = Object.keys(topics).filter((k) => k !== mid && topics[k].week === to);
    const n = (to - t.week) * 7;
    const meetings = {};
    for (const m of t.meetings) meetings[m.activity] = m.scheduled_at ? shift(local(m.scheduled_at), n) : "";
    const other = there.length === 1 ? there[0] : null;
    const otherMeetings = {};
    if (other) for (const m of topics[other].meetings) otherMeetings[m.activity] = m.scheduled_at ? shift(local(m.scheduled_at), -n) : "";
    setPending({ kind: "topic", id: mid, from: t.week, to, there: there.length, other, swap: Boolean(other), meetings, otherMeetings, x, y });
    setTopicWeeks((tw) => Object.assign({}, tw, { [mid]: { week: to } }, other ? { [other]: { week: t.week } } : {}));
  };
  const changeTopic = (key, activity, value) => {
    if (key === "swap") {
      setPending(Object.assign({}, pending, { swap: value }));
      setTopicWeeks((tw) => {
        const next = Object.assign({}, tw);
        if (value) next[pending.other] = { week: pending.from };
        else delete next[pending.other];
        return next;
      });
      return;
    }
    setPending(Object.assign({}, pending, { [key]: Object.assign({}, pending[key], { [activity]: value }) }));
  };
  const stamps = (mid, values) => topics[mid].meetings.filter((m) => values[m.activity]).map((m) => ({ activity: m.activity, scheduled_at: values[m.activity] + ":00" + offOf(m.scheduled_at, OFF) }));
  const saveTopic = () => {
    const p = pending;
    const moves = [{ module: p.id, week: p.to, meetings: stamps(p.id, p.meetings) }];
    if (p.other && p.swap) moves.push({ module: p.other, week: p.from, meetings: stamps(p.other, p.otherMeetings) });
    setPending(Object.assign({}, p, { saving: true }));
    post("/api/plan/topic", { moves }).then((result) => {
      const ids = [p.id, p.other].filter(Boolean);
      if (result.error) {
        setTopicWeeks((tw) => {
          const next = Object.assign({}, tw);
          for (const id of ids) delete next[id];
          return next;
        });
        say(String(result.error));
      } else {
        setTopicWeeks((tw) => {
          const next = Object.assign({}, tw);
          for (const id of ids) if (next[id]) next[id] = Object.assign({}, next[id], { saved: true });
          return next;
        });
        wrote(sessionId, []);
      }
      setPending(null);
    });
  };
  const drag = React.useRef(null);
  const grip = React.useRef(null);
  const [over, setOver] = React.useState(null);
  const [lifted, setLifted] = React.useState(null);
  const refused = React.useRef(false);
  const end = () => {
    setOver(null);
    setLifted(null);
    drag.current = null;
  };
  const startBar = (e, a, fromWeek, only) => {
    const edge = only || (grip.current && e.currentTarget.contains(grip.current) ? grip.current.getAttribute("data-edge") : "both");
    const item = recordOf(a.assessment_id);
    if (item && taught(weekOf(item.opens_on)) && edge !== "due") {
      e.preventDefault();
      say("It opened in a week already taught — drag its due end instead.");
      return;
    }
    if (pending) cancel();
    drag.current = { id: a.assessment_id, edge, from: fromWeek };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", a.assessment_id);
    } catch {
    }
    setTimeout(() => setLifted(a.assessment_id), 0);
  };
  const startTopic = (e, mid, fromWeek) => {
    if (pending) cancel();
    drag.current = { topic: true, id: mid, from: fromWeek };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", mid);
    } catch {
    }
    setTimeout(() => setLifted(mid), 0);
  };
  const rowHandlers = (r) => ({
    onDragOver: (e) => {
      if (!drag.current) return;
      refused.current = r.taught;
      if (r.taught) {
        if (over !== null) setOver(null);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== r.n) setOver(r.n);
    },
    onDrop: (e) => {
      if (!drag.current || r.taught) return;
      e.preventDefault();
      const d = drag.current;
      const to = r.n;
      end();
      if (d.topic) {
        if (to !== d.from) openTopic(d.id, to, e.clientX, e.clientY);
        return;
      }
      const item = recordOf(d.id);
      let opens = local(item.opens_at);
      let due = local(item.due_at);
      if (!item.due_at) {
        opens = "";
        due = r.to + "T23:59";
      } else if (d.from !== null) {
        if (to === d.from) return;
        const n = (to - d.from) * 7;
        if (d.edge !== "due") opens = shift(opens, n);
        if (d.edge !== "opens") due = shift(due, n);
      }
      openDates(d.id, opens, due, to, d.from, e.clientX, e.clientY, true);
    }
  });
  const onDragEnd = () => {
    if (drag.current && refused.current) say("That week is already taught; nothing moves into it.");
    refused.current = false;
    end();
  };
  const said = (text) => text + (run2.id ? " in " + run2.id : "");
  const topicWords = (m, n) => said(m.module_id + " “" + m.title + "” (week " + n + ")");
  const workWords = (a) => said(a.assessment_id + " “" + a.title + "” (" + (WORK_WORD[a.type] || a.type || "work") + (a.due_on ? ", due " + shortDate(a.due_on) : "") + ")");
  const mentioned = (written) => {
    if (!written) say("The chat’s message box cannot be reached from here.");
  };
  const barOf = (s) => {
    const a = s.a;
    const href = a.viewable && a.url ? a.url : a.brief_url;
    const record = recordOf(a.assessment_id) || a;
    const locked = withResults.has(a.assessment_id) || taught(weekOf(record.due_on));
    const why = withResults.has(a.assessment_id) ? "has results — its dates stay" : "due in a week already taught";
    const movable = editable && !locked;
    const dueWords = "due " + shortDate(a.due_on) + " · " + (weightPct(a.weight) || "no weight");
    const tip = a.title + (a.opens_on ? " · opens " + shortDate(a.opens_on) : "") + " · due " + shortDate(a.due_on) + (!editable ? "" : locked ? " — " + why : taught(s.start) ? " — opened in a week already taught; drag its due end" : " — drag to another week");
    return { href, locked, movable, dueWords, tip };
  };
  const target = pending ? pending.to : null;
  return /* @__PURE__ */ h("div", { className: "mode", onDragEnd }, /* @__PURE__ */ h("div", { className: "weights" }, groups.map((g) => /* @__PURE__ */ h("div", { className: "wcard", key: g.name }, /* @__PURE__ */ h("small", null, g.name), /* @__PURE__ */ h("b", null, weightPct(g.weight) || "—"), /* @__PURE__ */ h("small", null, g.count, " ", g.count === 1 ? "item" : "items", g.unweighted ? " · " + g.unweighted + " with no weight" : ""))), /* @__PURE__ */ h("div", { className: "wcard " + (grading.complete ? "ok" : "bad") }, /* @__PURE__ */ h("small", null, "Total"), /* @__PURE__ */ h("b", null, weightPct(grading.total_weight) || "—"), /* @__PURE__ */ h("small", null, grading.complete ? "weights add up" : "does not add up"))), student ? null : faults.length ? /* @__PURE__ */ h("ul", { className: "faults" }, faults.map((f, i) => /* @__PURE__ */ h("li", { className: f.tone, key: i }, /* @__PURE__ */ h(Icon, { name: f.icon }), /* @__PURE__ */ h("span", null, f.text), f.dated ? /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "chip ask strong",
      onClick: (e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const item = recordOf(f.dated);
        openDates(f.dated, local(item.opens_at), local(item.due_at), item.due_at ? weekOf(item.due_at.slice(0, 10)) : null, null, box.left, box.bottom, false);
      }
    },
    /* @__PURE__ */ h(Icon, { name: "calendar" }),
    f.verb
  ) : /* @__PURE__ */ h(AskButton, { prompt: f.prompt, label: f.verb, className: "chip ask strong" })))) : /* @__PURE__ */ h("p", { className: "calm" }, "Every week has a topic, the graded work is spread, and the weights add up."), editable && undated.length ? /* @__PURE__ */ h("div", { className: "tray" }, /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Icon, { name: "calendar" }), "Not on the calendar"), undated.map((a) => /* @__PURE__ */ h(
    "span",
    {
      key: a.assessment_id,
      className: "chip traychip" + (lifted === a.assessment_id ? " lifted" : ""),
      draggable: "true",
      title: "Drag onto a week",
      onDragStart: (e) => startBar(e, a, null)
    },
    /* @__PURE__ */ h(Icon, { name: WORK_ICON[a.type] || "file" }),
    a.title,
    /* @__PURE__ */ h(Mention, { mention, fresh, chat: chatTitle, label: "“" + a.title + "”", text: workWords(a), onDone: mentioned })
  )), /* @__PURE__ */ h("small", null, "Drag one onto a week, then settle the day.")) : null, /* @__PURE__ */ h("table", { className: "plan" }, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, /* @__PURE__ */ h("th", null, "Week"), /* @__PURE__ */ h("th", null, "Topic"), /* @__PURE__ */ h("th", null, "Materials"), lanes.map((l) => /* @__PURE__ */ h("th", { key: l[0], className: "lanehead " + l[2] }, l[1])))), /* @__PURE__ */ h("tbody", null, weeks.map((w) => {
    const r = rowOf(w.week);
    const here = drawn.modules.filter((x) => x.week === w.week);
    const title = here.map((x) => x.module.title).join(" · ");
    const n = here.flatMap((x) => x.module.concepts || []).length;
    const draft = here.some((x) => x.module.draft);
    const cls = [w.when === "current" ? "now" : "", over === w.week ? "drop" : "", target === w.week ? "target" : ""].filter(Boolean).join(" ");
    const meetings = [...here.flatMap((x) => x.meetings), ...(w.meetings || []).filter((m) => !m.module_id)];
    const known = /* @__PURE__ */ new Set();
    const materials = meetings.flatMap((m) => m.resources || []).filter((x) => {
      const id = x.resource_id || x.title;
      return !known.has(id) && known.add(id);
    }).sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
    const conceptsButton = n ? /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "cbtn",
        title: "Show these concepts and the topics they are tied to",
        onClick: (e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setMap({ mids: here.map((x) => x.module.module_id), week: w.week, x: box.left, y: box.bottom });
        }
      },
      n + " " + (n === 1 ? "concept" : "concepts")
    ) : null;
    return /* @__PURE__ */ h(Fragment2, { key: w.week }, /* @__PURE__ */ h(
      "tr",
      {
        key: w.week,
        className: cls,
        "data-week": w.week,
        "data-taught": r.taught ? "1" : void 0,
        title: r.taught ? "Already taught: nothing moves into or out of this week" : void 0,
        onDragLeave: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && over === w.week) setOver(null);
        },
        ...editable ? rowHandlers(r) : {}
      },
      /* @__PURE__ */ h("td", { className: "wkn" }, /* @__PURE__ */ h("b", null, w.week), /* @__PURE__ */ h("small", null, shortDate(w.starts_on))),
      /* @__PURE__ */ h("td", { className: "topic" }, !title ? /* @__PURE__ */ h("span", { className: "notopic" }, "No topic yet") : editable && !taught(w.week) ? /* @__PURE__ */ h(Fragment2, null, here.map((x, i) => /* @__PURE__ */ h(Fragment2, { key: x.module.module_id }, i ? /* @__PURE__ */ h("span", { className: "dash" }, " · ") : null, /* @__PURE__ */ h(
        "span",
        {
          className: "tchip" + (x.module.draft ? " draftword" : "") + (lifted === x.module.module_id ? " lifted" : ""),
          draggable: "true",
          title: "Drag to another week — its meetings move with it",
          onDragStart: (e) => startTopic(e, x.module.module_id, w.week)
        },
        /* @__PURE__ */ h(EditableTitle, { kind: "module", id: x.module.module_id, title: x.module.title })
      ), /* @__PURE__ */ h(Mention, { mention, fresh, chat: chatTitle, label: "“" + x.module.title + "”", text: topicWords(x.module, w.week), onDone: mentioned }))), conceptsButton, draft ? /* @__PURE__ */ h("small", null, "draft") : null) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: draft ? "draftword" : "" }, here.map((x, i) => /* @__PURE__ */ h(Fragment2, { key: x.module.module_id }, i ? " · " : null, /* @__PURE__ */ h(EditableTitle, { kind: "module", id: x.module.module_id, title: x.module.title }), /* @__PURE__ */ h(Mention, { mention, fresh, chat: chatTitle, label: "“" + x.module.title + "”", text: topicWords(x.module, w.week), onDone: mentioned })))), conceptsButton, draft ? /* @__PURE__ */ h("small", null, "draft") : null)),
      /* @__PURE__ */ h("td", { className: "mats" }, materials.length ? materials.map((x, i) => /* @__PURE__ */ h(MaterialChips, { key: (x.resource_id || x.title) + i, resource: x })) : /* @__PURE__ */ h("span", { className: "none" }, title ? "none yet" : "")),
      lanes.map((l) => /* @__PURE__ */ h("td", { className: "lane", key: l[0] }, spans.filter((s) => s.lane[1] === l[1] && s.start !== null && w.week >= s.start && w.week <= s.end).map((s) => {
        const first = w.week === s.start;
        const last = w.week === s.end;
        const a = s.a;
        const { href, locked, movable, dueWords, tip } = barOf(s);
        const segCls = "lseg " + kindOf(a.type)[1] + (first ? " first" : "") + (last ? " last" : "") + (a.draft ? " draft" : "") + (editable && locked ? " locked" : "") + (lifted === a.assessment_id ? " lifted" : "");
        return /* @__PURE__ */ h(
          "div",
          {
            key: a.assessment_id,
            className: segCls,
            draggable: movable ? "true" : void 0,
            title: tip,
            onDragStart: movable ? (e) => startBar(e, a, w.week) : void 0
          },
          movable && first && a.opens_on && weekOf(a.opens_on) === s.start && !taught(s.start) ? /* @__PURE__ */ h("span", { className: "grip top", "data-edge": "opens", title: "Drag to move when it opens", onMouseDown: (e) => grip.current = e.currentTarget }) : null,
          movable && last ? /* @__PURE__ */ h("span", { className: "grip bottom", "data-edge": "due", title: "Drag to move when it is due", onMouseDown: (e) => grip.current = e.currentTarget }) : null,
          !first ? null : /* @__PURE__ */ h(EditableTitle, { kind: "assessment", id: a.assessment_id, title: a.title, className: "segt" }, href ? /* @__PURE__ */ h(ViewLink, { draggable: "false", href, view: a.title, format: a.viewable && a.url ? a.format : "html" }, a.title) : a.title),
          first ? /* @__PURE__ */ h(Mention, { mention, fresh, chat: chatTitle, label: "“" + a.title + "”", text: workWords(a), onDone: mentioned }) : null,
          !last ? null : movable ? /* @__PURE__ */ h(
            "button",
            {
              type: "button",
              className: "segd",
              title: "Change the dates",
              onMouseDown: () => grip.current = null,
              onClick: (e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const item = recordOf(a.assessment_id);
                openDates(a.assessment_id, local(item.opens_at), local(item.due_at), weekOf(item.due_on), null, box.left, box.bottom, false);
              }
            },
            dueWords
          ) : /* @__PURE__ */ h("span", { className: "segd" }, dueWords)
        );
      })))
    ), projects.filter((s) => s.start === w.week).map((s) => {
      const a = s.a;
      const { href, locked, movable, dueWords, tip } = barOf(s);
      const dueOnly = taught(s.start);
      return /* @__PURE__ */ h("tr", { className: "projrow", key: "pj" + a.assessment_id }, /* @__PURE__ */ h("td", { colSpan: columns }, /* @__PURE__ */ h(
        "div",
        {
          className: "pline pj" + (a.draft ? " draft" : "") + (editable && locked ? " locked" : "") + (lifted === a.assessment_id ? " lifted" : ""),
          draggable: movable ? "true" : void 0,
          title: tip,
          onMouseDown: () => grip.current = null,
          onDragStart: movable ? (e) => startBar(e, a, dueOnly ? s.end : s.start, dueOnly ? "due" : null) : void 0
        },
        /* @__PURE__ */ h(Icon, { name: WORK_ICON[a.type] || "project" }),
        /* @__PURE__ */ h("span", { className: "pl-kind" }, "Project"),
        /* @__PURE__ */ h(EditableTitle, { kind: "assessment", id: a.assessment_id, title: a.title, className: "segt" }, href ? /* @__PURE__ */ h(ViewLink, { draggable: "false", href, view: a.title, format: a.viewable && a.url ? a.format : "html" }, a.title) : a.title),
        /* @__PURE__ */ h(Mention, { mention, fresh, chat: chatTitle, label: "“" + a.title + "”", text: workWords(a), onDone: mentioned }),
        /* @__PURE__ */ h("span", { className: "pl-span" }, s.start === s.end ? "week " + s.end : "weeks " + s.start + "–" + s.end, a.opens_on ? " · opens " + shortDate(a.opens_on) : ""),
        movable ? /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: "segd",
            title: "Change the dates",
            onClick: (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const item = recordOf(a.assessment_id);
              openDates(a.assessment_id, local(item.opens_at), local(item.due_at), weekOf(item.due_on), null, box.left, box.bottom, false);
            }
          },
          dueWords
        ) : /* @__PURE__ */ h("span", { className: "segd" }, dueWords)
      )));
    }));
  }))), /* @__PURE__ */ h("p", { className: "foot" }, "Each bar runs from the week a piece of work opens to the week it is due; a project is a line under the week it opens in. Press a topic’s concepts to see the topics they build on and lead to.", editable ? " Drag a bar to another week to move both dates — the weekday and the time come with it. Drag its top edge to move only the opening, its bottom edge to move only the due date, and press the due line to set the day by hand. Drag a topic to another week and its meetings move with it, or trade places with the topic already there." : "", " ", "Rooms, times and decks are in Teaching."), pending && pending.kind === "dates" ? /* @__PURE__ */ h(
    DatesForm,
    {
      key: pending.id,
      pending,
      item: recordOf(pending.id),
      rows,
      rowOf,
      weekOf,
      taughtBefore,
      onChange: changeDates,
      onSave: saveDates,
      onCancel: cancel
    }
  ) : null, pending && pending.kind === "topic" ? /* @__PURE__ */ h(
    TopicForm,
    {
      key: pending.id,
      pending,
      topics,
      rowOf,
      weekOf,
      onChange: changeTopic,
      onSave: saveTopic,
      onCancel: cancel
    }
  ) : null, map ? /* @__PURE__ */ h(ConceptMap, { key: map.mids.join("|") + map.week, at: map, modules: drawn.modules, graph: graph || {}, mention, fresh, chatTitle, words: said, onMentioned: mentioned, onClose: () => setMap(null) }) : null, /* @__PURE__ */ h(Toast, { text: toast }));
}

// client/course/teaching.jsx
function WorkLine(props) {
  const { a, verb, date, withHanded, week, handed, status } = props;
  const got = handed[a.assessment_id];
  const showStatus = withHanded || !(week && week.due || []).some((d) => d.assessment_id === a.assessment_id);
  return /* @__PURE__ */ h("li", null, /* @__PURE__ */ h(WorkChip, { work: a, when: verb + " " + shortDate(date) }), /* @__PURE__ */ h(EditButton, { kind: "assessment", id: a.assessment_id, title: "Change its title or description" }), withHanded && got && got.enrolled ? /* @__PURE__ */ h("small", null, got.received, " of ", got.enrolled, " handed in") : null, showStatus ? /* @__PURE__ */ h(StatusLine, { work: a, status }) : null);
}
function DeckNeed(props) {
  const { w, run: run2 } = props;
  const meets = w.meetings || [];
  if (!meets.length || meets.some((m) => (m.resources || []).some((r) => r.kind === "slides"))) return null;
  return /* @__PURE__ */ h("div", { className: "need" }, /* @__PURE__ */ h(Icon, { name: "slides" }), /* @__PURE__ */ h("span", null, "No slides yet"), /* @__PURE__ */ h(AskButton, { prompt: promptFor("deck", w, run2), label: "Draft slides", className: "chip ask strong" }));
}
function Side(props) {
  const { w, label, current, concepts, handed, status, run: run2, onGo } = props;
  if (!w) {
    return /* @__PURE__ */ h("div", { className: "side empty" }, /* @__PURE__ */ h("small", null, label), /* @__PURE__ */ h("p", null, "Outside the run."));
  }
  const taught = current !== null && w.week < current;
  return /* @__PURE__ */ h("div", { className: "side" }, /* @__PURE__ */ h("small", null, label, " · week ", w.week), /* @__PURE__ */ h("b", null, titleOf(w) ? /* @__PURE__ */ h(ModuleTitles, { modules: w.modules }) : "No topic yet"), /* @__PURE__ */ h("ul", { className: "facts" }, (w.meetings || []).map((m) => /* @__PURE__ */ h("li", { key: m.activity_id }, /* @__PURE__ */ h(Icon, { name: MEETING_ICON[m.type] || "lecture" }), /* @__PURE__ */ h("span", null, shortDate(m.on) || "no date", " · ", m.type), /* @__PURE__ */ h("small", null, m.location || ""))), (w.opens || []).map((a) => /* @__PURE__ */ h(WorkLine, { key: "o" + a.assessment_id, a, verb: "opens", date: a.opens_on, withHanded: false, week: w, handed, status })), (w.due || []).map((a) => /* @__PURE__ */ h(WorkLine, { key: "d" + a.assessment_id, a, verb: "due", date: a.due_on, withHanded: true, handed, status })), taught ? conceptsOf(w).map((c) => {
    const x = concepts[c.id];
    return /* @__PURE__ */ h("li", { key: c.id }, /* @__PURE__ */ h(Icon, { name: "concept" }), /* @__PURE__ */ h("span", null, c.title || c.id), /* @__PURE__ */ h("small", null, x && x.class_mean !== null && x.class_mean !== void 0 ? "class " + pct(x.class_mean) + " · " + (x.coverage || "") : "not assessed yet"));
  }) : null), /* @__PURE__ */ h(DeckNeed, { w, run: run2 }), /* @__PURE__ */ h("button", { type: "button", className: "link", onClick: () => onGo(w.week) }, "Make this the focus ›"));
}
function Focus(props) {
  const { w, run: run2, current, at, concepts, handed, signals, status } = props;
  const misdated = (w.gaps || []).find((g) => g.kind === "misdated");
  const meetings = w.meetings || [];
  const work = [
    ...(w.opens || []).map((a) => /* @__PURE__ */ h(WorkLine, { key: "o" + a.assessment_id, a, verb: "opens", date: a.opens_on, withHanded: false, week: w, handed, status })),
    ...(w.due || []).map((a) => /* @__PURE__ */ h(WorkLine, { key: "d" + a.assessment_id, a, verb: "due", date: a.due_on, withHanded: true, handed, status }))
  ];
  const revisit = [w.week - 1, w.week - 2].map(at).filter(Boolean).flatMap(
    (p) => conceptsOf(p).map((c) => ({ c, x: concepts[c.id], week: p.week })).filter(({ x }) => x && x.class_mean !== null && x.class_mean !== void 0 && x.class_mean < REVISIT_BELOW)
  );
  const module2 = (w.modules || [])[0];
  const prepare = "For week " + w.week + " of " + run2.id + (module2 ? " (" + module2.module_id + ")" : "") + ", what should I teach and what should I revisit first?" + (revisit.length ? " The class is weakest on " + revisit.map((r) => r.c.title || r.c.id).join(" and ") + "." : "");
  return /* @__PURE__ */ h("div", { className: "focus" }, /* @__PURE__ */ h("small", null, w.week === current ? "This week" : "Week " + w.week, " · ", shortDate(w.starts_on), " – ", shortDate(w.ends_on)), /* @__PURE__ */ h("h2", null, titleOf(w) ? /* @__PURE__ */ h(ModuleTitles, { modules: w.modules }) : "No topic yet"), conceptsOf(w).length ? /* @__PURE__ */ h("div", { className: "concepts" }, /* @__PURE__ */ h(Icon, { name: "concept" }), conceptsOf(w).map((c) => /* @__PURE__ */ h("span", { className: "chip concept", key: c.id }, c.title || c.id))) : null, meetings.length ? /* @__PURE__ */ h("ul", { className: "facts big" }, meetings.map((m) => {
    const resources = [...m.resources || []].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
    return /* @__PURE__ */ h("li", { key: m.activity_id }, /* @__PURE__ */ h(Icon, { name: MEETING_ICON[m.type] || "lecture" }), /* @__PURE__ */ h("span", null, shortDate(m.on) || "no date", " · ", [m.type, m.location].filter(Boolean).join(" · ")), /* @__PURE__ */ h(EditButton, { kind: "activity", id: m.activity_id, title: "Change this meeting: its title, room, description" }), resources.map((r, i) => /* @__PURE__ */ h(MaterialChips, { key: (r.resource_id || r.title) + i, resource: r })));
  })) : /* @__PURE__ */ h("p", { className: "calm" }, "No meeting this week."), misdated ? misdated.ids.map((id) => {
    const m = meetings.find((x) => x.activity_id === id) || {};
    const word = m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "A meeting";
    return /* @__PURE__ */ h("div", { className: "need warn", title: misdated.note, key: id }, /* @__PURE__ */ h(Icon, { name: "misdated" }), /* @__PURE__ */ h("span", null, word, " dated ", shortDate(m.on), ",", " ", m.on < w.starts_on ? "before this week starts (" + shortDate(w.starts_on) + ")" : "after this week ends (" + shortDate(w.ends_on) + ")"), /* @__PURE__ */ h(AskButton, { prompt: promptFor("misdated", w, run2, id), label: "Check date", className: "chip ask strong" }));
  }) : null, /* @__PURE__ */ h(DeckNeed, { w, run: run2 }), work.length ? /* @__PURE__ */ h("ul", { className: "facts" }, work) : /* @__PURE__ */ h("p", { className: "calm" }, "Nothing graded opens or falls due this week."), revisit.length || signals.length ? /* @__PURE__ */ h("div", { className: "revisit" }, /* @__PURE__ */ h("b", null, "Revisit first"), revisit.map((r) => /* @__PURE__ */ h("p", { key: r.c.id + r.week }, r.c.title || r.c.id, " — class ", pct(r.x.class_mean), " on ", r.x.coverage || "", " observed, taught in week ", r.week)), signals.length ? /* @__PURE__ */ h("p", null, signals.length, " open signal", signals.length === 1 ? "" : "s", ": ", signals[0].description || "") : null) : null, /* @__PURE__ */ h(AskButton, { prompt: prepare, label: "Prepare this week", className: "primary" }));
}
function Teaching(props) {
  const { data, evidence, status } = props;
  const run2 = data.run || {};
  const weeks = data.weeks || [];
  const current = data.current_week ?? null;
  const at = (n) => weeks.find((w2) => w2.week === n) || null;
  const ev = evidence || {};
  const concepts = ev.concepts || {};
  const handed = ev.handed_in || {};
  const signals = ev.signals || [];
  const [focus, setFocus] = React.useState(() => props.focus && weeks.some((w2) => w2.week === props.focus) ? props.focus : current || 1);
  const go = (n) => {
    setFocus(n);
    if (props.onStep) props.onStep(n);
    if (props.onScrollTop) props.onScrollTop();
  };
  const w = at(focus) || weeks[0];
  if (!w) return /* @__PURE__ */ h("div", { className: "mode" });
  const prev = at(w.week - 1);
  const next = at(w.week + 1);
  const shared = { current, concepts, handed, status, run: run2, onGo: go };
  return /* @__PURE__ */ h("div", { className: "mode" }, /* @__PURE__ */ h("section", { className: "trio-wrap" }, /* @__PURE__ */ h("div", { className: "stepper" }, prev ? /* @__PURE__ */ h("button", { type: "button", className: "chip", onClick: () => go(prev.week) }, "‹ Week ", prev.week) : null, /* @__PURE__ */ h("b", null, "Week ", w.week, " of ", weeks.length), current !== null && w.week !== current ? /* @__PURE__ */ h("button", { type: "button", className: "chip", onClick: () => go(current) }, "Back to this week") : null, next ? /* @__PURE__ */ h("button", { type: "button", className: "chip", onClick: () => go(next.week) }, "Week ", next.week, " ›") : null, /* @__PURE__ */ h("span", { className: "private" }, "Private — class figures from approved evidence only")), /* @__PURE__ */ h("div", { className: "trio" }, /* @__PURE__ */ h(Side, { w: prev, label: "Before", ...shared }), /* @__PURE__ */ h(Focus, { w, run: run2, current, at, concepts, handed, signals, status }), /* @__PURE__ */ h(Side, { w: next, label: "After", ...shared }))));
}

// client/course/view.jsx
var SCOPED = STYLE.replace(/(^|\n)body\{/, "$1.cm{").replace(/@media \(max-width:900px\)/g, "@container cm (max-width:900px)");
var sheet = (dark) => ":host{display:block;container:cm/inline-size}.cm{" + (dark ? DARK : LIGHT) + "min-height:100%}" + SCOPED;
function useCourse(url, version) {
  const [state, setState] = React.useState({ url: null, value: null });
  React.useEffect(() => {
    let live = true;
    fetch(url, { headers: { accept: "application/json" } }).then((response) => response.json()).then((value) => live && setState({ url, value })).catch((error) => live && setState({ url, value: { error: String(error.message || error) } }));
    return () => {
      live = false;
    };
  }, [url, version]);
  return state;
}
var NOTES = {
  term: "press a hole to have the assistant fill it",
  planning: "does the term hold together",
  teaching: "this week, between the last and the next",
  evidence: "how each week went"
};
function CourseView(props) {
  const { runId, sessionId, mode, dark, drafts, student, week } = props;
  const version = useVersion(AREAS.everything);
  const url = scoped(
    BASE + "/api/course?run=" + encodeURIComponent(runId) + "&mode=" + encodeURIComponent(mode) + (drafts ? "&drafts=1" : "") + (student ? "&student=1" : "") + (dark ? "&dark=1" : "") + (mode === "teaching" && week ? "&week=" + encodeURIComponent(week) : ""),
    sessionId
  );
  const state = useCourse(url, version);
  const scroller = React.useRef(null);
  const [host, setHost] = React.useState(null);
  const hostRef = React.useCallback((el) => {
    scroller.current = el;
    setHost(el);
  }, []);
  const placed2 = React.useRef(null);
  const reading = runId + "|" + mode;
  React.useLayoutEffect(() => {
    if (!state.value || state.value.error || placed2.current === reading) return;
    if (state.url !== url) return;
    placed2.current = reading;
    const root = scroller.current && scroller.current.shadowRoot;
    const now = root && root.querySelector(".wkhead.now,.band.now,tr.now");
    if (now) now.scrollIntoView({ block: "start" });
    else if (scroller.current) scroller.current.scrollTop = 0;
  });
  React.useLayoutEffect(() => {
    const root = scroller.current && scroller.current.shadowRoot;
    const strip = root && root.querySelector(".strip");
    const cm = root && root.querySelector(".cm");
    if (!strip || !cm || typeof ResizeObserver === "undefined") return void 0;
    const measure = () => cm.style.setProperty("--strip-h", strip.offsetHeight + "px");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  });
  const answer = state.value;
  const body = () => {
    if (!answer) return /* @__PURE__ */ h("p", { className: "calm", style: { margin: "14px 20px" } }, "Reading the course model…");
    if (answer.error) return /* @__PURE__ */ h("p", { className: "calm", style: { margin: "14px 20px", color: "var(--flag)" } }, answer.error);
    const data = answer.data || {};
    const run2 = data.run || {};
    const weeks = data.weeks || [];
    const current = data.current_week ?? null;
    const shown = answer.mode || mode;
    const strip = /* @__PURE__ */ h("div", { className: "strip" }, /* @__PURE__ */ h("span", { className: "note" }, run2.term || "", " · ", current ? "week " + current + " of " + weeks.length : weeks.length + " weeks", " · ", NOTES[shown]), shown === "term" && !answer.student ? /* @__PURE__ */ h(Tally, { data, current }) : null);
    const banner = answer.student && (shown === "term" || shown === "planning") ? /* @__PURE__ */ h("div", { className: "banner" }, /* @__PURE__ */ h("b", null, "Preview as student."), " The record alone — no hole, no note about what has not been written yet.") : null;
    if (shown === "planning") {
      return /* @__PURE__ */ h(Fragment2, null, strip, banner, /* @__PURE__ */ h(Planning, { data, student: answer.student, locks: answer.locks, graph: answer.graph, mention: answer.student ? null : props.mention, fresh: answer.student ? null : props.fresh, chatTitle: props.chatTitle, runId, sessionId }), answer.student ? /* @__PURE__ */ h(StructureFoot, null) : /* @__PURE__ */ h("p", { className: "foot" }, "Structure only — nothing here is derived from student work. Moving a bar changes its ", /* @__PURE__ */ h("span", { className: "mono" }, "opens_at"), " and", " ", /* @__PURE__ */ h("span", { className: "mono" }, "due_at"), " and nothing else; accepting a draft is still changing ", /* @__PURE__ */ h("span", { className: "mono" }, "approval: draft"), " in its record."));
    }
    if (shown === "teaching") {
      return /* @__PURE__ */ h(Fragment2, null, strip, /* @__PURE__ */ h(
        Teaching,
        {
          key: runId,
          data,
          evidence: answer.evidence,
          status: answer.status,
          focus: answer.focus,
          onStep: props.onStep,
          onScrollTop: () => scroller.current && (scroller.current.scrollTop = 0)
        }
      ));
    }
    if (shown === "evidence") {
      return /* @__PURE__ */ h(Fragment2, null, strip, /* @__PURE__ */ h(Evidence, { data, evidence: answer.evidence, status: answer.status }));
    }
    return /* @__PURE__ */ h(Fragment2, null, strip, banner, /* @__PURE__ */ h(Term, { data, student: answer.student, status: answer.status }));
  };
  return /* @__PURE__ */ h(Fragment2, null, answer && !answer.error && answer.drafts ? /* @__PURE__ */ h("div", { className: "pp-banner" }, /* @__PURE__ */ h("b", null, "Record + drafts. "), "Everything below includes records marked ", /* @__PURE__ */ h("code", null, "approval: draft"), ", which nobody has accepted yet. Accepting one is changing that word to", " ", /* @__PURE__ */ h("code", null, "approved"), " in its record, and that is yours to do.") : null, /* @__PURE__ */ h("div", { ref: hostRef, className: "pp-courseview", style: { flex: 1, minHeight: 0, overflow: "auto" } }, /* @__PURE__ */ h(ShadowContent, { host }, /* @__PURE__ */ h("style", null, sheet(dark)), /* @__PURE__ */ h("div", { className: "cm" }, /* @__PURE__ */ h(Sprite, null), /* @__PURE__ */ h(EditScope, { runId, sessionId, enabled: Boolean(answer && !answer.error && !answer.student) }, body())))));
}
function ShadowContent(props) {
  const host = props.host;
  const root = React.useMemo(() => host ? host.shadowRoot || host.attachShadow({ mode: "open" }) : null, [host]);
  return root ? ReactDOM.createPortal(props.children, root) : null;
}

// client/course-escape.js
var courseModeEscape = ({ covered }) => covered ? "none" : "close";

// client/gradebook.js
var gpPct = (weight) => weight === null || weight === void 0 || weight === "" ? "—" : Math.round(Number(weight) * 1e4) / 100 + "%";
var gpRound = (value, digits) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};
var gpUrl = (path, runId, sessionId, extra) => scoped(BASE + path + "?run=" + encodeURIComponent(runId || "") + (extra || ""), sessionId);
var GP_TIMEOUT_MS = 2e4;
var gpFetch = (url, init) => {
  const abort = typeof AbortController === "function" ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), GP_TIMEOUT_MS) : null;
  return fetch(url, Object.assign({}, init, abort ? { signal: abort.signal } : {})).then((response) => response.json()).catch((error) => ({
    error: error && error.name === "AbortError" ? "No answer from the pane's server in " + GP_TIMEOUT_MS / 1e3 + " seconds. If several tabs of the harness are open, close the extras and press Retry; otherwise the harness may need a restart." : String(error && error.message || error)
  })).finally(() => timer && clearTimeout(timer));
};
var gpGet = (path, runId, sessionId, extra) => gpFetch(gpUrl(path, runId, sessionId, extra), { headers: { accept: "application/json" } });
var gpPost = (path, runId, sessionId, body) => gpFetch(gpUrl(path, runId, sessionId), {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify(body)
});
var FAMILY_WORDS = {
  period: "by period",
  category: "by kind of work",
  hybrid: "period × kind",
  admission: "admission gate",
  flat: "no blocks"
};
var gpTree = (components) => {
  const out = [];
  const visit = (parent, depth, seen2) => {
    for (const component of components) {
      if ((component.parent || null) !== parent || seen2.has(component.component_id)) continue;
      seen2.add(component.component_id);
      out.push({ component, depth });
      visit(component.component_id, depth + 1, seen2);
    }
  };
  const seen = /* @__PURE__ */ new Set();
  visit(null, 0, seen);
  for (const component of components) if (!seen.has(component.component_id)) out.push({ component, depth: 0 });
  return out;
};
var gpFilled = (policy, componentId) => {
  const children = policy.components.filter((c) => c.parent === componentId);
  const members = Object.entries(policy.assignments).filter((entry) => entry[1].component === componentId);
  return children.reduce((sum, c) => sum + Number(c.weight || 0), 0) + members.reduce((sum, entry) => sum + Number(entry[1].weight || 0), 0);
};
var gpClose = (a, b) => Math.abs(a - b) <= 1e-3;
function GradebookPanes(props) {
  const [revision, setRevision] = React.useState(0);
  const [editing, setEditing] = React.useState(null);
  const bump2 = () => {
    setRevision((value) => value + 1);
    if (props.onWrite) props.onWrite();
  };
  const key = props.revision + "|" + revision;
  return h(
    "div",
    { className: "pp-gbwrap" },
    h(
      "div",
      { className: "pp-gbpanes" },
      h(LastChanges, {
        runId: props.runId,
        sessionId: props.sessionId,
        names: props.names,
        revision: key,
        onRestore: (proposal, at) => setEditing({ start: proposal, label: "Restoring the policy as it was before " + (when(at) || "that change") })
      }),
      h(PolicyCard, {
        runId: props.runId,
        sessionId: props.sessionId,
        revision: key,
        onEdit: () => setEditing({ start: null, label: null }),
        onWrite: bump2
      })
    ),
    editing ? h(PolicyEditor, {
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      ask: props.ask,
      start: editing.start,
      label: editing.label,
      onClose: () => setEditing(null),
      onWritten: () => {
        setEditing(null);
        bump2();
      }
    }) : null
  );
}
var CHANGE_FILTERS = [
  ["all", "All"],
  ["grade", "Grades"],
  ["sheet", "Sheet"],
  ["policy", "Policy"]
];
function LastChanges(props) {
  const [state, setState] = React.useState({ phase: "loading" });
  const [filter, setFilter] = React.useState("all");
  const [open2, setOpen] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    gpGet("/api/gradebook/changes", props.runId, props.sessionId, (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(props.revision) + "&a=" + attempt).then(
      (value) => live && setState({ phase: "ready", value })
    );
    return () => {
      live = false;
    };
  }, [props.runId, props.sessionId, props.names, props.revision, attempt]);
  const body = () => {
    if (state.phase === "loading") return h("div", { className: "pp-as pp-gbpad" }, "Reading what changed…");
    if (state.value.error) return h(GpFailed, { error: state.value.error, retry: () => setAttempt((n) => n + 1) });
    const events = state.value.events.filter((event) => filter === "all" || event.kind === filter);
    if (!events.length) {
      return h(
        "div",
        { className: "pp-as pp-gbpad" },
        filter === "all" ? "No grade has been decided and the policy has not been changed here yet." : "Nothing of this kind yet."
      );
    }
    const shown = open2 ? events : events.slice(0, 14);
    return h(
      React.Fragment,
      null,
      h(
        "ul",
        { className: "pp-gblog" },
        shown.map((event, index) => h(ChangeLine, { key: event.kind + index + (event.at || ""), event, runId: props.runId, sessionId: props.sessionId, onRestore: props.onRestore }))
      ),
      events.length > shown.length ? h("button", { type: "button", className: "pp-linkbtn pp-gbmore", onClick: () => setOpen(true) }, "Show " + (events.length - shown.length) + " more") : null
    );
  };
  return h(
    "section",
    { className: "pp-bookcard pp-gbpane", "aria-label": "Last changes" },
    h(
      "div",
      { className: "pp-cardhead" },
      h("b", null, "Last changes"),
      h(
        "span",
        { className: "pp-gbfilters" },
        CHANGE_FILTERS.map(
          (entry) => h(
            "button",
            { key: entry[0], type: "button", className: "pp-segbtn pp-gbfilter", "aria-pressed": filter === entry[0], onClick: () => setFilter(entry[0]) },
            entry[1]
          )
        )
      )
    ),
    h("div", { className: "pp-gbpanebody" }, body())
  );
}
var scoreWords = (value, of) => value === null || value === void 0 ? "—" : String(gpRound(Number(value), 2)) + (of ? "/" + of : "");
function ChangeLine(props) {
  const event = props.event;
  const [busy, setBusy] = React.useState(false);
  const stamp = h("span", { className: "pp-gbwhen", title: event.at ? new Date(event.at).toLocaleString() : "no time recorded" }, when(event.at) || "undated");
  if (event.kind === "policy") {
    const restore = () => {
      setBusy(true);
      gpGet("/api/grading/history", props.runId, props.sessionId, "&index=" + event.index).then((answer) => {
        setBusy(false);
        if (answer.error) window.alert(answer.error);
        else props.onRestore(answer.proposal, answer.at);
      });
    };
    return h(
      "li",
      { className: "pp-gbline pp-gbline-policy" },
      h("span", { className: "pp-gbicon", "aria-hidden": "true" }, event.action === "lock" ? "🔒" : event.action === "unlock" ? "🔓" : "§"),
      h(
        "div",
        { className: "pp-gbwhat" },
        h("div", null, h("b", null, event.action === "lock" ? "Policy locked" : event.action === "unlock" ? "Policy unlocked" : "Grading policy changed"), stamp),
        event.action === "change" ? h("ul", { className: "pp-gbsummary" }, event.summary.slice(0, 4).map((line, i) => h("li", { key: i }, line))) : null,
        event.note ? h("div", { className: "pp-as" }, "“" + event.note + "”") : null,
        event.restorable ? h("button", { type: "button", className: "pp-linkbtn", disabled: busy, onClick: restore }, busy ? "Opening…" : "Open the policy as it was before…") : null
      )
    );
  }
  if (event.kind === "sheet") {
    const counts = [event.added ? event.added + " new" : null, event.changed ? event.changed + " changed" : null, event.removed ? event.removed + " taken back" : null].filter(Boolean).join(" · ");
    return h(
      "li",
      { className: "pp-gbline" },
      h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
      h(
        "div",
        { className: "pp-gbwhat" },
        h("div", null, h("b", null, "Grade sheet synced"), stamp),
        h("div", { className: "pp-as" }, counts || "nothing changed"),
        event.changes.length ? h(
          "div",
          { className: "pp-gbmarks" },
          event.changes.map(
            (change, i) => h(
              "span",
              { key: i, className: "pp-gbmark" },
              (change.name || change.student) + " · " + change.title + " " + (change.to === null && change.score_to === null ? "taken back" : scoreWords(change.score_to))
            )
          ),
          event.more ? h("span", { className: "pp-as" }, "+" + event.more + " more") : null
        ) : null
      )
    );
  }
  const who = event.name || event.student;
  return h(
    "li",
    { className: "pp-gbline" },
    h("span", { className: "pp-avatar", "aria-hidden": "true" }, initials(who)),
    h(
      "div",
      { className: "pp-gbwhat" },
      h("div", null, h("b", null, who), " · " + event.title, stamp),
      h(
        "div",
        { className: "pp-as" },
        (event.first ? "graded" : "changed") + " via " + event.how + (event.by ? " by " + event.by : "") + " — " + event.criteria.slice(0, 4).map((c) => c.criterion + " " + (c.from === null ? "" : scoreWords(c.from) + " → ") + scoreWords(c.to, c.of)).join("; ") + (event.criteria.length > 4 ? "; +" + (event.criteria.length - 4) : "")
      )
    )
  );
}
function usePolicy(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setState((old) => old.phase === "ready" && old.runId === runId ? old : { phase: "loading" });
    gpGet("/api/grading/policy", runId, sessionId, "&r=" + encodeURIComponent(revision) + "&a=" + attempt).then((value) => live && setState({ phase: "ready", value, runId }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision, attempt]);
  return Object.assign({ retry: () => setAttempt((n) => n + 1) }, state);
}
function GpFailed(props) {
  return h(
    "div",
    null,
    h(Message, { error: true }, props.error),
    props.retry ? h("button", { type: "button", className: "pp-segbtn", style: { margin: "0 14px 10px" }, onClick: props.retry }, "Retry") : null
  );
}
function PolicyCard(props) {
  const state = usePolicy(props.runId, props.sessionId, props.revision);
  const [unlocking, setUnlocking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  const head = (doc2) => h(
    "div",
    { className: "pp-cardhead" },
    h("b", null, "Grading policy"),
    doc2 ? h(
      "span",
      { className: "pp-chip " + (doc2.locked ? "pp-chip-ok" : "pp-chip-warn"), title: doc2.locked ? "Nothing can change the policy until it is unlocked." : "Anyone with the pane or the session can change it." },
      doc2.locked ? "🔒 Locked" : "Unlocked"
    ) : null,
    doc2 && !doc2.locked ? h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        disabled: busy,
        title: "Freeze the policy: no block, weight or filing can change until it is unlocked.",
        onClick: () => {
          setBusy(true);
          gpPost("/api/grading/lock", props.runId, props.sessionId, { locked: true }).then((answer) => {
            setBusy(false);
            if (answer.error) setFailed(answer.error);
            else props.onWrite();
          });
        }
      },
      "Lock"
    ) : null,
    doc2 ? doc2.locked ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setUnlocking(true) }, "Unlock…") : h("button", { type: "button", className: "pp-primary", onClick: props.onEdit }, "Change…") : null
  );
  if (state.phase === "loading") return h("section", { className: "pp-bookcard pp-gbpane" }, head(null), h("div", { className: "pp-as pp-gbpad" }, "Reading the policy…"));
  const doc = state.value;
  if (doc.error) return h("section", { className: "pp-bookcard pp-gbpane" }, head(null), h(GpFailed, { error: doc.error, retry: state.retry }));
  return h(
    "section",
    { className: "pp-bookcard pp-gbpane", "aria-label": "Grading policy" },
    head(doc),
    h(
      "div",
      { className: "pp-gbpanebody" },
      failed ? h(Message, { error: true }, failed) : null,
      unlocking ? h(UnlockForm, {
        runId: props.runId,
        sessionId: props.sessionId,
        onCancel: () => setUnlocking(false),
        onDone: () => {
          setUnlocking(false);
          props.onWrite();
        }
      }) : null,
      h(PolicyTree, { policy: doc.policy, assessments: doc.assessments, groups: doc.canvas_groups }),
      doc.description ? h("p", { className: "pp-as pp-gbdesc" }, doc.description) : null,
      doc.issues.length ? h(
        "ul",
        { className: "pp-gbissues" },
        doc.issues.map((issue, i) => h("li", { key: i, className: issue.level === "error" ? "pp-gbissue-err" : "" }, (issue.location ? issue.location + ": " : "") + issue.message))
      ) : h("div", { className: "pp-as pp-gbok" }, "✓ Adds up: the validator has nothing to say about the policy.")
    )
  );
}
function UnlockForm(props) {
  const [typed, setTyped] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  return h(
    "div",
    { className: "pp-gbunlock" },
    h("b", null, "Unlock the grading policy"),
    h("p", { className: "pp-as" }, "Marks may already be in Canvas on this policy's scale. Unlocking is recorded in the policy's history, with your reason."),
    h("input", { className: "pp-gbinput", placeholder: "Why (optional)", value: note, onChange: (e) => setNote(e.target.value) }),
    h("input", { className: "pp-gbinput", placeholder: "Type UNLOCK", value: typed, onChange: (e) => setTyped(e.target.value), "aria-label": "Type UNLOCK to confirm" }),
    failed ? h(Message, { error: true }, failed) : null,
    h(
      "div",
      { className: "pp-gbrow" },
      h("button", { type: "button", className: "pp-segbtn", onClick: props.onCancel }, "Cancel"),
      h(
        "button",
        {
          type: "button",
          className: "pp-danger",
          disabled: typed.trim().toUpperCase() !== "UNLOCK" || busy,
          "aria-busy": busy,
          onClick: () => {
            setBusy(true);
            gpPost("/api/grading/lock", props.runId, props.sessionId, { locked: false, confirm: typed, note }).then((answer) => {
              setBusy(false);
              if (answer.error) setFailed(answer.error);
              else props.onDone();
            });
          }
        },
        "Unlock"
      )
    )
  );
}
function PolicyTree(props) {
  const policy = props.policy;
  const titles = new Map((props.assessments || []).map((a) => [a.assessment_id, a]));
  const members = (componentId) => Object.entries(policy.assignments).filter((entry) => (entry[1].component || null) === componentId).map((entry) => ({ id: entry[0], weight: entry[1].weight, record: titles.get(entry[0]) }));
  const top = policy.components.filter((c) => !c.parent);
  const topSum = top.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const loose = members(null).filter((m) => m.weight !== null && m.weight !== void 0);
  if (!policy.components.length) {
    const total = Object.values(policy.assignments).reduce((sum, a) => sum + Number(a.weight || 0), 0);
    return h(
      "div",
      null,
      h("div", { className: "pp-as" }, "No blocks: every assessment counts by its own weight. Together they are " + gpPct(total) + (gpClose(total, 1) ? "." : ", not 100%.")),
      h(MemberList, { members: loose })
    );
  }
  return h(
    "div",
    { className: "pp-gbtree" },
    h(
      "div",
      { className: "pp-gbbar", role: "img", "aria-label": top.map((c) => c.title + " " + gpPct(c.weight)).join(", ") },
      top.map(
        (c, i) => h("span", { key: c.component_id, className: "pp-gbseg pp-gbseg" + i % 6, style: { flexGrow: Math.max(Number(c.weight) || 0, 1e-4) }, title: c.title + " " + gpPct(c.weight) }, c.title + " " + gpPct(c.weight))
      )
    ),
    gpClose(topSum, 1) ? null : h("div", { className: "pp-behind" }, "The top-level blocks add up to " + gpPct(topSum) + ", not 100%."),
    gpTree(policy.components).map((entry) => {
      const c = entry.component;
      const filled = gpFilled(policy, c.component_id);
      const list = members(c.component_id);
      const hasChildren = policy.components.some((x) => x.parent === c.component_id);
      const ok = gpClose(filled, Number(c.weight));
      return h(
        "details",
        { key: c.component_id, className: "pp-gbblock", style: { marginLeft: entry.depth * 14 + "px" }, open: entry.depth === 0 && list.length <= 6 },
        h(
          "summary",
          null,
          h("span", { className: "pp-tag" }, c.component_id),
          h("span", { className: "pp-gbbtitle" }, c.title),
          h("span", { className: "pp-gbbw" }, gpPct(c.weight)),
          c.points ? h("span", { className: "pp-chip" }, "out of " + c.points) : null,
          props.groups && props.groups.indexOf(c.component_id) !== -1 ? h("span", { className: "pp-chip pp-chip-quiet", title: "Has a Canvas assignment group" }, "Canvas ✓") : null,
          list.length || hasChildren ? h("span", { className: ok ? "pp-gbsum pp-gbsum-ok" : "pp-gbsum pp-gbsum-off", title: "What is inside adds up to " + gpPct(filled) }, ok ? "✓" : gpPct(filled) + " inside") : h("span", { className: "pp-gbsum pp-gbsum-off" }, "empty")
        ),
        h(MemberList, { members: list })
      );
    }),
    loose.length ? h("div", { className: "pp-gbloose" }, h("b", null, "In no block"), h(MemberList, { members: loose })) : null
  );
}
function MemberList(props) {
  if (!props.members.length) return null;
  return h(
    "ul",
    { className: "pp-gbmembers" },
    props.members.map(
      (m) => h(
        "li",
        { key: m.id },
        h("span", { className: "pp-titletext" }, m.record ? m.record.title : m.id),
        m.record && m.record.draft ? h("span", { className: "pp-chip pp-chip-warn" }, "draft") : null,
        m.record && m.record.sent ? h("span", { className: "pp-chip pp-chip-quiet", title: m.record.sent + " marks in Canvas" }, "Canvas " + m.record.sent) : null,
        h("span", { className: "pp-gbmw" }, gpPct(m.weight))
      )
    )
  );
}
var gpCopy = (proposal) => JSON.parse(JSON.stringify(proposal));
function PolicyEditor(props) {
  const state = usePolicy(props.runId, props.sessionId, "editor");
  const [draft, setDraft] = React.useState(null);
  const [origin, setOrigin] = React.useState(props.label);
  const [impact, setImpact] = React.useState({ phase: "idle" });
  const [ack, setAck] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [writing, setWriting] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  const [asked, setAsked] = React.useState(false);
  const [proposals, setProposals] = React.useState([]);
  const [loaded, setLoaded] = React.useState(null);
  const [showAssistant, setShowAssistant] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 1100);
  const doc = state.phase === "ready" && !state.value.error ? state.value : null;
  React.useEffect(() => {
    if (doc && draft === null) setDraft(gpCopy(props.start || doc.policy));
    if (doc) setProposals(doc.proposals || []);
  }, [doc]);
  const refreshProposals = () => gpGet("/api/grading/policy", props.runId, props.sessionId, "&p=" + Date.now()).then((value) => {
    if (value && !value.error) setProposals(value.proposals || []);
    return value;
  });
  const loadProposal = (entry) => {
    setDraft(gpCopy(entry.proposal));
    setLoaded(entry.id);
    setOrigin("Proposal " + entry.id + " from the assistant" + (entry.request ? " — for “" + entry.request + "”" : "") + ". Edit it here like any draft; nothing is written until you apply.");
  };
  const discardProposal = (entry) => gpPost("/api/grading/discard", props.runId, props.sessionId, { id: entry.id }).then((answer) => {
    if (answer.error) setFailed(answer.error);
    if (loaded === entry.id) setLoaded(null);
    return refreshProposals();
  });
  React.useEffect(() => {
    if (!draft) return void 0;
    let live = true;
    setImpact((current) => ({ phase: "checking", value: current.value }));
    const timer = setTimeout(() => {
      gpPost("/api/grading/impact", props.runId, props.sessionId, { proposal: draft, names: Boolean(props.names) }).then((answer) => {
        if (!live) return;
        setImpact({ phase: "ready", value: answer });
        setAck(false);
      });
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [draft]);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !writing) {
        event.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [writing]);
  const update = (change) => setDraft((current) => change(gpCopy(current)));
  const choosePreset = (preset) => {
    setFailed(null);
    gpPost("/api/grading/impact", props.runId, props.sessionId, { preset: preset.id, names: Boolean(props.names) }).then((answer) => {
      if (answer.error) return setFailed(answer.error);
      setOrigin("From the preset “" + preset.title + "” — work is filed where you had it when the preset has that block, by kind and date otherwise.");
      setDraft(answer.proposal);
    });
  };
  const result = impact.value && !impact.value.error ? impact.value.impact : null;
  const weighty = result && result.weighty;
  const blocked = !result || result.nothing || result.errors.length > 0 || weighty && !ack || impact.phase !== "ready";
  const apply2 = () => {
    setWriting(true);
    setFailed(null);
    gpPost("/api/grading/apply", props.runId, props.sessionId, { proposal: draft, base: doc.base, acknowledged: ack, note }).then((answer) => {
      setWriting(false);
      if (answer.error) return setFailed(answer.error);
      props.onWritten();
    });
  };
  const askSession = () => {
    if (!props.ask || !result) return;
    props.ask(reviewPrompt(props.runId, draft, result, doc));
    setAsked(true);
  };
  const content = () => {
    if (state.phase === "ready" && state.value.error) return h("div", { className: "pp-review" }, h(GpFailed, { error: state.value.error, retry: state.retry }));
    if (state.phase === "loading" || !draft) return h("div", { className: "pp-review" }, h("div", { className: "pp-as" }, "Reading the policy…"));
    if (doc.locked) return h("div", { className: "pp-review" }, h(Message, { error: true }, "The policy is locked. Close this and unlock it first."));
    return h(
      "div",
      { className: "pp-modalbody" },
      h(
        "div",
        { className: "pp-modalpane" },
        h("div", { className: "pp-modalpanelabel" }, "The policy as it would be"),
        h(
          "div",
          { className: "pp-review" },
          h(PresetStrip, { presets: doc.presets, onChoose: choosePreset }),
          origin ? h("div", { className: "pp-gborigin" }, origin) : null,
          h(BlockEditor, { draft, update }),
          h(FilingEditor, { draft, update, assessments: doc.assessments })
        )
      ),
      // Nothing to compare yet — the current policy, untouched — so no column
      // for it: it appears with the first edit, preset or loaded proposal.
      gpDiff(doc.policy, draft).empty ? null : h(
        "div",
        { className: "pp-modalpane pp-gbimpactpane" },
        h("div", { className: "pp-modalpanelabel" }, "What it changes", impact.phase === "checking" ? h("span", { className: "pp-checkspin", style: { marginLeft: "6px", display: "inline-block" } }) : null),
        h(
          "div",
          { className: "pp-review" },
          impact.value && impact.value.error ? h(Message, { error: true }, impact.value.error) : null,
          result ? h(ImpactReport, { impact: result, names: props.names, before: doc.policy, after: draft, assessments: doc.assessments }) : h("div", { className: "pp-as" }, "Counting…")
        )
      ),
      showAssistant ? h(AssistantPanel, {
        runId: props.runId,
        ask: props.ask,
        doc,
        draft,
        proposals,
        loaded,
        refresh: refreshProposals,
        onLoad: loadProposal,
        onDiscard: discardProposal
      }) : null
    );
  };
  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil pp-gbveil" },
      h(
        "div",
        { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Change the grading policy" },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Change the grading policy · " + props.runId),
          h(
            "button",
            { type: "button", className: "pp-segbtn", "aria-pressed": showAssistant, onClick: () => setShowAssistant(!showAssistant), title: "Ask for a change in words; the assistant proposes, you load and apply" },
            "✦ Assistant" + (proposals.length ? " · " + proposals.length : "")
          ),
          draft && doc ? h("button", { type: "button", className: "pp-modallink", onClick: () => (setDraft(gpCopy(doc.policy)), setOrigin(null), setLoaded(null)) }, "Start again from the current policy") : null,
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: writing, onClick: props.onClose }, "×")
        ),
        content(),
        doc && !doc.locked && draft ? h(
          "div",
          { className: "pp-reviewfoot" },
          h(
            "span",
            { className: "pp-as" },
            result && result.errors.length ? h("span", { className: "pp-gbissue-err" }, "Cannot be written: " + result.errors[0].message) : weighty ? h(
              "label",
              { className: "pp-gback" },
              h("input", { type: "checkbox", checked: ack, onChange: (e) => setAck(e.target.checked) }),
              " I have read what this changes" + (result.canvas.resend.length ? ", including marks Canvas already has" : result.blocks.removed.length || result.canvas.needs_group.length ? ", including the Canvas groups" : "") + "."
            ) : result && result.nothing ? "Nothing changes yet." : "Nobody's total moves, Canvas has no marks on what changes, and no Canvas group loses its block."
          ),
          h("input", { className: "pp-gbinput pp-gbnote", placeholder: "Why (kept in the history)", value: note, onChange: (e) => setNote(e.target.value) }),
          props.ask ? h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: !result || result.nothing, onClick: askSession, title: "The session reads briefs, keys, the syllabus and Canvas for what this would affect. It edits nothing." },
            asked ? "Asked ✓" : "Ask the assistant to check"
          ) : null,
          failed ? h("span", { className: "pp-gbissue-err" }, failed) : null,
          h("button", { type: "button", className: "pp-segbtn", disabled: writing, onClick: props.onClose }, "Cancel"),
          h("button", { type: "button", className: "pp-primary", disabled: blocked || writing, "aria-busy": writing, onClick: apply2 }, "Apply change")
        ) : null
      )
    ),
    document.body
  );
}
var reviewPrompt = (runId, draft, impact, doc) => {
  const blocks = gpTree(draft.components).map((entry) => {
    const c = entry.component;
    return "  ".repeat(entry.depth) + "- " + c.component_id + " " + c.title + " " + gpPct(c.weight) + (c.points ? " (out of " + c.points + ")" : "");
  }).join("\n");
  const filing = Object.entries(draft.assignments).map((entry) => entry[0] + " → " + (entry[1].component || "none") + " " + gpPct(entry[1].weight)).join("; ");
  return "I am about to change the grading policy of " + runId + " in the pane. Do not edit anything — review it and tell me what it affects.\n\nProposed blocks:\n" + (blocks || "(none — every assessment counts by its own weight)") + "\nFiling: " + filing + "\n\nCounted impact (the pane's, exact):\n- " + impact.summary.join("\n- ") + '\n\nCheck what the counts cannot: briefs, answer keys, the syllabus, the course page and announcements that state a percentage or a block name (e.g. "10% of the final grade (VSK1)"); whether students were already told the current policy; Canvas assignment groups and marks already sent ' + (impact.canvas.resend.length ? "(" + impact.canvas.resend.join(", ") + " have marks in Canvas)" : "") + "; and whether the institution's rule still holds" + (doc && doc.description ? " — the run's own description says: " + doc.description.replace(/\s+/g, " ").slice(0, 400) : "") + ". List each place and what would need to change, then say whether you would apply it.";
};
function PresetStrip(props) {
  return h(
    "div",
    { className: "pp-gbpresets" },
    h("div", { className: "pp-reviewsec" }, "Start from a structure", h("span", null, "replaces the blocks below; you adjust from there")),
    h(
      "div",
      { className: "pp-gbpresetgrid" },
      props.presets.map((preset) => {
        const top = preset.components.filter((c) => !c.parent);
        return h(
          "button",
          { key: preset.id, type: "button", className: "pp-gbpreset", onClick: () => props.onChoose(preset), title: preset.summary },
          h("span", { className: "pp-gbpresethead" }, h("b", null, preset.title), h("span", { className: "pp-chip" }, FAMILY_WORDS[preset.family] || preset.family)),
          top.length ? h(
            "span",
            { className: "pp-gbbar pp-gbbar-mini" },
            top.map((c, i) => h("span", { key: c.component_id, className: "pp-gbseg pp-gbseg" + i % 6, style: { flexGrow: c.weight } }, gpPct(c.weight)))
          ) : h("span", { className: "pp-gbbar pp-gbbar-mini pp-gbbar-flat" }, "Σ weights"),
          h(
            "span",
            { className: "pp-as" },
            preset.components.length ? preset.components.map((c) => (c.parent ? "  " : "") + c.title).slice(0, 5).join(" · ") + (preset.components.length > 5 ? " …" : "") : preset.summary
          )
        );
      })
    )
  );
}
function WeightInput(props) {
  const shown = props.value === null || props.value === void 0 ? "" : String(gpRound(Number(props.value) * 100, 4));
  const [text, setText] = React.useState(shown);
  React.useEffect(() => {
    if (Number(text) !== Number(shown) || text === "" !== (shown === "")) setText(shown);
  }, [shown]);
  return h(
    "span",
    { className: "pp-gbpctfield" },
    h("input", {
      className: "pp-gbinput pp-gbnum",
      inputMode: "decimal",
      value: text,
      "aria-label": props.label,
      onChange: (event) => {
        const raw = event.target.value.replace(",", ".");
        setText(raw);
        if (raw.trim() === "") return props.onChange(null);
        const value = Number(raw);
        if (Number.isFinite(value)) props.onChange(gpRound(value / 100, 12));
      }
    }),
    "%"
  );
}
function BlockEditor(props) {
  const draft = props.draft;
  const ids = draft.components.map((c) => c.component_id);
  const set2 = (index, field, value) => props.update((next) => {
    const was = next.components[index].component_id;
    next.components[index][field] = value;
    if (field === "component_id") {
      for (const c of next.components) if (c.parent === was) c.parent = value;
      for (const key of Object.keys(next.assignments)) if (next.assignments[key].component === was) next.assignments[key].component = value;
    }
    return next;
  });
  const remove = (id) => props.update((next) => {
    const gone = next.components.find((c) => c.component_id === id);
    next.components = next.components.filter((c) => c.component_id !== id);
    for (const c of next.components) if (c.parent === id) c.parent = gone.parent || null;
    for (const key of Object.keys(next.assignments)) if (next.assignments[key].component === id) next.assignments[key].component = gone.parent || null;
    return next;
  });
  const add = (parent) => props.update((next) => {
    let n = next.components.length + 1;
    while (next.components.some((c) => c.component_id === "BLOCK" + n)) n += 1;
    next.components.push({ component_id: "BLOCK" + n, title: "New block", weight: 0, parent: parent || null, points: null });
    return next;
  });
  const fit = (id) => props.update((next) => {
    const block = next.components.find((c) => c.component_id === id);
    const children = next.components.filter((c) => c.parent === id);
    const room = Math.max(0, Number(block.weight) - children.reduce((sum2, c) => sum2 + Number(c.weight || 0), 0));
    const members = Object.keys(next.assignments).filter((key) => next.assignments[key].component === id);
    const sum = members.reduce((total, key) => total + Number(next.assignments[key].weight || 0), 0);
    for (const key of members) next.assignments[key].weight = gpRound(sum > 0 ? Number(next.assignments[key].weight || 0) / sum * room : room / members.length, 12);
    return next;
  });
  const topSum = draft.components.filter((c) => !c.parent).reduce((sum, c) => sum + Number(c.weight || 0), 0);
  return h(
    "div",
    { className: "pp-gbeditsec" },
    h(
      "div",
      { className: "pp-reviewsec" },
      "Blocks",
      h("span", { className: draft.components.length && !gpClose(topSum, 1) ? "pp-behind" : "" }, draft.components.length ? "top level adds up to " + gpPct(topSum) : "none — the grade is the sum of the assessments' weights"),
      h("button", { type: "button", className: "pp-segbtn", onClick: () => add(null) }, "+ Block")
    ),
    draft.components.length ? h(
      "div",
      { className: "pp-gbblocks" },
      h("div", { className: "pp-gbblockrow pp-gbblockhead" }, h("span", null, "Id"), h("span", null, "Title"), h("span", null, "Weight"), h("span", null, "Inside"), h("span", null, "Out of"), h("span", null, "Inside it"), h("span", null)),
      gpTree(draft.components).map((entry) => {
        const c = entry.component;
        const index = draft.components.indexOf(c);
        const filled = gpFilled(draft, c.component_id);
        const used = draft.components.some((x) => x.parent === c.component_id) || Object.values(draft.assignments).some((a) => a.component === c.component_id);
        return h(
          "div",
          { key: index, className: "pp-gbblockrow", style: { paddingLeft: entry.depth * 16 + "px" } },
          h("input", { className: "pp-gbinput pp-gbid", value: c.component_id, "aria-label": "Block id", onChange: (e) => set2(index, "component_id", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")) }),
          h("input", { className: "pp-gbinput", value: c.title, "aria-label": "Block title", onChange: (e) => set2(index, "title", e.target.value) }),
          h(WeightInput, { value: c.weight, label: c.component_id + " weight", onChange: (v) => set2(index, "weight", v === null ? 0 : v) }),
          h(
            "select",
            { className: "pp-gbinput", value: c.parent || "", "aria-label": "Inside", onChange: (e) => set2(index, "parent", e.target.value || null) },
            h("option", { value: "" }, "— top —"),
            ids.filter((id) => id !== c.component_id).map((id) => h("option", { key: id, value: id }, id))
          ),
          h("input", {
            className: "pp-gbinput pp-gbnum",
            value: c.points === null || c.points === void 0 ? "" : String(c.points),
            placeholder: "—",
            inputMode: "decimal",
            "aria-label": "Out of, in the LMS",
            title: "What this block is out of in the LMS journal — ВСК is out of 100. Empty: no scale of its own.",
            onChange: (e) => set2(index, "points", e.target.value.trim() === "" ? null : Number(e.target.value))
          }),
          h(
            "span",
            { className: "pp-gbfill" },
            used ? gpClose(filled, Number(c.weight)) ? h("span", { className: "pp-gbsum pp-gbsum-ok" }, "✓ " + gpPct(filled)) : h(
              React.Fragment,
              null,
              h("span", { className: "pp-gbsum pp-gbsum-off" }, gpPct(filled)),
              Object.values(draft.assignments).some((a) => a.component === c.component_id) ? h("button", { type: "button", className: "pp-linkbtn", title: "Scale this block's assessments, keeping their proportions, so they fill it exactly", onClick: () => fit(c.component_id) }, "fit") : null
            ) : h("span", { className: "pp-as" }, "empty")
          ),
          h(
            "span",
            { className: "pp-gbrowbtns" },
            h("button", { type: "button", className: "pp-linkbtn", title: "Add a block inside " + c.component_id, onClick: () => add(c.component_id) }, "+ inside"),
            h("button", { type: "button", className: "pp-close", "aria-label": "Remove " + c.component_id, title: "Remove — what is inside moves up a level", onClick: () => remove(c.component_id) }, "×")
          )
        );
      })
    ) : null,
    h(
      "label",
      { className: "pp-gbcoursepoints" },
      "The whole course is out of ",
      h("input", {
        className: "pp-gbinput pp-gbnum",
        value: draft.points === null || draft.points === void 0 ? "" : String(draft.points),
        placeholder: "—",
        inputMode: "decimal",
        onChange: (e) => props.update((next) => (next.points = e.target.value.trim() === "" ? null : Number(e.target.value), next))
      }),
      h("span", { className: "pp-as" }, " in the LMS (empty: each assessment out of its own maximum unless a block sets a scale)")
    )
  );
}
function FilingEditor(props) {
  const draft = props.draft;
  const options = gpTree(draft.components).map((entry) => ({ id: entry.component.component_id, label: "  ".repeat(entry.depth) + entry.component.component_id + " · " + entry.component.title }));
  const total = Object.values(draft.assignments).reduce((sum, a) => sum + Number(a.weight || 0), 0);
  const set2 = (id, field, value) => props.update((next) => (next.assignments[id][field] = value, next));
  return h(
    "div",
    { className: "pp-gbeditsec" },
    h("div", { className: "pp-reviewsec" }, "Assessments", h("span", { className: gpClose(total, 1) ? "" : "pp-behind" }, "weights add up to " + gpPct(total))),
    h(
      "div",
      { className: "pp-gbfiling" },
      props.assessments.map((a) => {
        const now = draft.assignments[a.assessment_id] || { component: null, weight: null };
        return h(
          "div",
          { key: a.assessment_id, className: "pp-gbfilerow" },
          h(
            "span",
            { className: "pp-gbfiletitle" },
            h("span", { className: "pp-titletext", title: a.assessment_id }, a.title),
            h("span", { className: "pp-as" }, (a.type || "") + (a.due_at ? " · due " + String(a.due_at).slice(0, 10) : " · undated")),
            a.draft ? h("span", { className: "pp-chip pp-chip-warn" }, "draft") : null,
            a.sent ? h("span", { className: "pp-chip pp-chip-live", title: a.sent + " marks already in Canvas" }, "Canvas " + a.sent) : null
          ),
          draft.components.length ? h(
            "select",
            { className: "pp-gbinput", value: now.component || "", "aria-label": a.title + " block", onChange: (e) => set2(a.assessment_id, "component", e.target.value || null) },
            h("option", { value: "" }, "— none —"),
            options.map((o) => h("option", { key: o.id, value: o.id }, o.label))
          ) : null,
          h(WeightInput, { value: now.weight, label: a.title + " weight", onChange: (v) => set2(a.assessment_id, "weight", v) })
        );
      })
    )
  );
}
function ImpactReport(props) {
  const impact = props.impact;
  if (impact.nothing) return h("div", { className: "pp-as" }, "Nothing changes yet. Pick a structure or edit a block.");
  const section = (title, body) => h("div", { className: "pp-gbimpactsec" }, h("div", { className: "pp-reviewsec" }, title), body);
  return h(
    "div",
    null,
    props.before && props.after ? h(PolicyDiff, { before: props.before, after: props.after, assessments: props.assessments }) : null,
    h(
      "details",
      { className: "pp-gbwords", open: !(props.before && props.after) },
      h("summary", null, "In words"),
      h("ul", { className: "pp-gbsummary pp-gbsummary-big" }, impact.summary.map((line, i) => h("li", { key: i }, line)))
    ),
    impact.errors.length ? section("Would not hold together", h("ul", { className: "pp-gbissues" }, impact.errors.map((e, i) => h("li", { key: i, className: "pp-gbissue-err" }, (e.location ? e.location + ": " : "") + e.message)))) : null,
    impact.issues.introduced.length ? section("New warnings", h("ul", { className: "pp-gbissues" }, impact.issues.introduced.filter((e) => e.level !== "error").map((e, i) => h("li", { key: i }, (e.location ? e.location + ": " : "") + e.message)))) : null,
    impact.issues.fixed.length ? section("Fixed", h("ul", { className: "pp-gbissues pp-gbissues-fixed" }, impact.issues.fixed.map((e, i) => h("li", { key: i }, "✓ " + e.message)))) : null,
    impact.lms.length ? section(
      "Out of in Canvas",
      h(
        "table",
        { className: "pp-sheet pp-gbtable" },
        h("thead", null, h("tr", null, h("th", null, "Assessment"), h("th", null, "Now"), h("th", null, "After"), h("th", null, "Marks in Canvas"))),
        h(
          "tbody",
          null,
          impact.lms.map(
            (row) => h(
              "tr",
              { key: row.assessment_id, className: row.sent ? "pp-gbhot" : "" },
              h("td", null, row.title),
              h("td", null, row.from === null ? "—" : gpRound(row.from, 2)),
              h(
                "td",
                null,
                row.dropped ? h("span", { className: "pp-as" }, "not counted") : row.to === null ? h("span", { className: "pp-behind", title: row.problem || "" }, "cannot scale") : gpRound(row.to, 2)
              ),
              h("td", null, row.sent ? h("span", { className: "pp-chip pp-chip-live" }, row.sent + " to resend") : "—")
            )
          )
        )
      )
    ) : null,
    impact.canvas.needs_group.length || impact.canvas.orphan_groups.length ? section(
      "Canvas assignment groups",
      h(
        "div",
        { className: "pp-as" },
        impact.canvas.needs_group.length ? h("div", null, "Need a group before work can be pushed: " + impact.canvas.needs_group.join(", ") + " — Integrations · Canvas, or `ainar lms groups`.") : null,
        impact.canvas.orphan_groups.length ? h("div", null, "Linked groups no block uses any more: " + impact.canvas.orphan_groups.join(", ") + ".") : null
      )
    ) : null,
    impact.students.changed ? section(
      "Students' running totals (" + impact.students.changed + " of " + impact.students.of + " move)",
      h(
        React.Fragment,
        null,
        h(
          "table",
          { className: "pp-sheet pp-gbtable" },
          h("thead", null, h("tr", null, h("th", null, "Student"), h("th", null, "Now"), h("th", null, "After"), h("th", null, "Δ"), h("th", null, "Blocks after"))),
          h(
            "tbody",
            null,
            impact.students.rows.slice(0, 25).map(
              (row) => h(
                "tr",
                { key: row.student_id },
                h("td", null, row.name || row.student_id),
                h("td", null, row.from === null ? "—" : row.from),
                h("td", null, row.to),
                h("td", { className: row.delta < 0 ? "pp-gbdown" : row.delta > 0 ? "pp-gbup" : "" }, (row.delta > 0 ? "+" : "") + row.delta),
                h("td", { className: "pp-as" }, row.blocks.map((b) => b.component_id + " " + (b.to === null ? "—" : gpRound(b.to, 2)) + (b.out_of ? "/" + b.out_of : "")).join(" · "))
              )
            )
          )
        ),
        impact.students.changed > 25 ? h("div", { className: "pp-as" }, "… and " + (impact.students.changed - 25) + " more. Totals are what has been graded so far, out of 100.") : h("div", { className: "pp-as" }, "Totals are what has been graded so far, out of 100.")
      )
    ) : null
  );
}
var gpDiff = (before, after) => {
  const was = new Map(before.components.map((c) => [c.component_id, c]));
  const now = new Map(after.components.map((c) => [c.component_id, c]));
  const blocks = [];
  const oldDepth = new Map(gpTree(before.components).map((entry) => [entry.component.component_id, entry.depth]));
  for (const entry of gpTree(after.components)) {
    const c = entry.component;
    const old = was.get(c.component_id);
    const changes = [];
    if (old) {
      if (Math.abs(Number(old.weight) - Number(c.weight)) > 1e-9) changes.push({ what: "weight", from: gpPct(old.weight), to: gpPct(c.weight) });
      if ((old.points || null) !== (c.points || null)) changes.push({ what: "out of", from: old.points || "—", to: c.points || "—" });
      if ((old.parent || null) !== (c.parent || null)) changes.push({ what: "inside", from: old.parent || "top", to: c.parent || "top" });
      if (old.title !== c.title) changes.push({ what: "title", from: old.title, to: c.title });
    }
    blocks.push({ id: c.component_id, title: c.title, weight: c.weight, depth: entry.depth, status: !old ? "added" : changes.length ? "changed" : "same", changes });
  }
  for (const c of before.components) {
    if (now.has(c.component_id)) continue;
    blocks.push({ id: c.component_id, title: c.title, weight: c.weight, depth: oldDepth.get(c.component_id) || 0, status: "removed", changes: [] });
  }
  const moves = /* @__PURE__ */ new Map();
  const weights = [];
  for (const id of Object.keys(after.assignments)) {
    const from = before.assignments[id] || { component: null, weight: null };
    const to = after.assignments[id];
    if ((from.component || null) !== (to.component || null)) {
      const key = (from.component || "") + "→" + (to.component || "");
      if (!moves.has(key)) moves.set(key, { from: from.component || null, to: to.component || null, ids: [] });
      moves.get(key).ids.push(id);
    }
    const a = from.weight === null || from.weight === void 0 ? null : Number(from.weight);
    const b = to.weight === null || to.weight === void 0 ? null : Number(to.weight);
    if (a !== b && !(a !== null && b !== null && Math.abs(a - b) < 1e-9)) weights.push({ id, from: a, to: b, dropped: !b });
  }
  weights.sort((x, y) => Math.abs((y.to || 0) - (y.from || 0)) - Math.abs((x.to || 0) - (x.from || 0)));
  const pointsChanged = (before.points || null) !== (after.points || null);
  return {
    blocks,
    moves: [...moves.values()],
    weights,
    points: pointsChanged ? { from: before.points || "—", to: after.points || "—" } : null,
    empty: !blocks.some((b) => b.status !== "same") && !moves.size && !weights.length && !pointsChanged
  };
};
var DIFF_MARK = { added: "+", removed: "−", changed: "~", same: "" };
function DiffBar(props) {
  const top = props.components.filter((c) => !c.parent);
  if (!top.length) return h("span", { className: "pp-gbbar pp-gbbar-mini pp-gbbar-flat" }, "no blocks — Σ weights");
  return h(
    "span",
    { className: "pp-gbbar pp-gbbar-mini" },
    top.map(
      (c, i) => h(
        "span",
        {
          key: c.component_id,
          className: "pp-gbseg pp-gbseg" + i % 6 + (props.marked && props.marked.has(c.component_id) ? " pp-gbseg-marked" : ""),
          style: { flexGrow: Math.max(Number(c.weight) || 0, 1e-4) },
          title: c.title + " " + gpPct(c.weight)
        },
        c.component_id + " " + gpPct(c.weight)
      )
    )
  );
}
function PolicyDiff(props) {
  const diff = gpDiff(props.before, props.after);
  const titles = new Map((props.assessments || []).map((a) => [a.assessment_id, a.title]));
  const name = (id) => titles.get(id) || id;
  const blockName = (id) => id ? id : "no block";
  if (diff.empty) return h("div", { className: "pp-as" }, "Same as the current policy.");
  const marked = new Set(diff.blocks.filter((b) => b.status !== "same").map((b) => b.id));
  const shownBlocks = props.compact ? diff.blocks.filter((b) => b.status !== "same") : diff.blocks;
  const weights = props.compact ? diff.weights.slice(0, 6) : diff.weights;
  const maxWeight = Math.max(1e-4, ...diff.weights.map((w) => Math.max(w.from || 0, w.to || 0)));
  return h(
    "div",
    { className: "pp-gbdiff" + (props.compact ? " pp-gbdiff-compact" : "") },
    h(
      "div",
      { className: "pp-gbdiffbars" },
      h("span", { className: "pp-gbdifflabel" }, "Now"),
      h(DiffBar, { components: props.before.components }),
      h("span", { className: "pp-gbdifflabel" }, "After"),
      h(DiffBar, { components: props.after.components, marked })
    ),
    diff.points ? h("div", { className: "pp-gbdiffline pp-gbd-changed" }, h("b", null, "~"), " The course is out of " + diff.points.from + " → " + diff.points.to + " in the LMS") : null,
    shownBlocks.length ? h(
      "div",
      { className: "pp-gbdiffsec" },
      props.compact ? null : h("div", { className: "pp-gbdiffhead" }, "Blocks"),
      shownBlocks.map(
        (b) => h(
          "div",
          { key: b.status + b.id, className: "pp-gbdiffline pp-gbd-" + b.status, style: { paddingLeft: 6 + b.depth * 14 + "px" } },
          h("b", { className: "pp-gbdmark", "aria-label": b.status }, DIFF_MARK[b.status]),
          h("span", { className: "pp-tag" }, b.id),
          h("span", { className: "pp-gbdtitle" }, b.title),
          b.status === "same" || b.status === "removed" || b.status === "added" ? h("span", { className: "pp-gbdval" }, gpPct(b.weight)) : null,
          b.changes.map(
            (c, i) => h("span", { key: i, className: "pp-gbdchange" }, c.what + " ", h("s", null, String(c.from)), " → ", h("b", null, String(c.to)))
          ),
          b.status === "removed" ? h("span", { className: "pp-as" }, "removed") : b.status === "added" ? h("span", { className: "pp-as" }, "new") : null
        )
      )
    ) : null,
    diff.moves.length ? h(
      "div",
      { className: "pp-gbdiffsec" },
      h("div", { className: "pp-gbdiffhead" }, "Moves between blocks"),
      diff.moves.map(
        (m) => h(
          "div",
          { key: (m.from || "") + (m.to || ""), className: "pp-gbmove" },
          h("span", { className: "pp-gbmoveroute" }, h("span", { className: m.from ? "pp-tag" : "pp-as" }, blockName(m.from)), " → ", h("span", { className: m.to ? "pp-tag" : "pp-gbissue-err" }, blockName(m.to))),
          h(
            "span",
            { className: "pp-gbmoveitems" },
            (props.compact ? m.ids.slice(0, 5) : m.ids).map((id) => h("span", { key: id, className: "pp-gbmark" }, name(id))),
            props.compact && m.ids.length > 5 ? h("span", { className: "pp-as" }, "+" + (m.ids.length - 5)) : null
          )
        )
      )
    ) : null,
    weights.length ? h(
      "div",
      { className: "pp-gbdiffsec" },
      h("div", { className: "pp-gbdiffhead" }, "Weights" + (props.compact && diff.weights.length > weights.length ? " (" + weights.length + " of " + diff.weights.length + ")" : "")),
      weights.map(
        (w) => h(
          "div",
          { key: w.id, className: "pp-gbwrow" + (w.dropped ? " pp-gbwrow-dropped" : "") },
          h("span", { className: "pp-titletext", title: w.id }, name(w.id)),
          h(
            "span",
            { className: "pp-gbwbars", "aria-hidden": "true" },
            h("span", { className: "pp-gbwbar pp-gbwbar-was", style: { width: (w.from || 0) / maxWeight * 100 + "%" } }),
            h("span", { className: "pp-gbwbar pp-gbwbar-now", style: { width: (w.to || 0) / maxWeight * 100 + "%" } })
          ),
          h("span", { className: "pp-gbwnums" }, h("s", null, gpPct(w.from)), " → ", w.dropped ? h("b", { className: "pp-gbissue-err" }, "not counted") : h("b", null, gpPct(w.to)))
        )
      )
    ) : null
  );
}
var ASSISTANT_EXAMPLES = [
  "Drop HW8 and spread its weight over the other ВСК 2 homework",
  "Make the quizzes 10% of each ВСК, taken from homework",
  "Switch to the admission rating (РК 1, РК 2, exam 40) and keep my filing",
  "Put both midterms in one Midterms block worth 20%"
];
var ASSISTANT_WAIT_MS = 8 * 60 * 1e3;
var assistantPrompt = (runId, request, draft, doc) => {
  const titles = {};
  for (const a of doc && doc.assessments || []) titles[a.assessment_id] = a.title + (a.due_at ? " (due " + String(a.due_at).slice(0, 10) + ")" : "");
  return "/grading-proposal " + runId + " — " + request.trim() + "\n\nFast path — everything you need is below. Unless the request names something that is not here, do not run help or validate and do not open records: write the whole policy to a temp file and record it" + (doc && doc.propose_command ? " with exactly:\n" + doc.propose_command : " with bin/ainar grading propose " + runId + " --file FILE --request WORDS --note WHY") + "\nIts output is the check; do not verify again. Then answer in one sentence.\nChange only what was asked: every assessment keeps its block unless the request moves it; dropping one is weight 0 in the same block.\n\nAssessment titles: " + JSON.stringify(titles) + "\n\nThe policy as it stands in the Gradebook editor (unsaved edits included) — propose against this, as a whole policy:\n```json\n" + JSON.stringify({ components: draft.components, points: draft.points, assignments: draft.assignments }) + "\n```";
};
function AssistantPanel(props) {
  const [text, setText] = React.useState("");
  const [waiting2, setWaiting] = React.useState(null);
  const [sent, setSent] = React.useState([]);
  const known = (props.proposals || []).map((p) => p.id);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!waiting2) return void 0;
    const timer = setInterval(() => tick((n) => n + 1), 1e3);
    return () => clearInterval(timer);
  }, [waiting2]);
  const elapsed = waiting2 ? Math.floor((Date.now() - waiting2.since) / 1e3) : 0;
  const clock2 = Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0");
  React.useEffect(() => {
    if (!waiting2) return void 0;
    const timer = setInterval(() => {
      if (Date.now() - waiting2.since > ASSISTANT_WAIT_MS) {
        setWaiting(null);
        return;
      }
      props.refresh();
    }, 3e3);
    return () => clearInterval(timer);
  }, [waiting2]);
  React.useEffect(() => {
    if (waiting2 && known.some((id) => !waiting2.known.has(id))) {
      setWaiting(null);
      const fresh = props.proposals.filter((p) => !waiting2.known.has(p.id)).pop();
      if (fresh && !fresh.stale) props.onLoad(fresh);
    }
  }, [known.join(",")]);
  const send2 = () => {
    const request = text.trim();
    if (!request || !props.ask) return;
    props.ask(assistantPrompt(props.runId, request, props.draft, props.doc));
    setSent((list) => list.concat([{ at: (/* @__PURE__ */ new Date()).toISOString(), request }]));
    setWaiting({ since: Date.now(), known: new Set(known), request });
    setText("");
  };
  const cards = [...props.proposals || []].reverse();
  return h(
    "div",
    { className: "pp-modalpane pp-gbassist" },
    h("div", { className: "pp-modalpanelabel" }, "✦ Assistant — ask for a change in words"),
    h(
      "div",
      { className: "pp-review pp-gbthread" },
      !props.ask ? h(Message, { error: true }, "No session is open beside the pane, so there is nobody to ask. Open one and come back.") : null,
      !cards.length && !waiting2 ? h(
        "div",
        { className: "pp-as pp-gbassisthint" },
        "Say what you want; the assistant reads the course and proposes a whole policy. It never writes the policy — you load a proposal, read the diff and the impact, and apply it yourself.",
        h(
          "div",
          { className: "pp-gbexamples" },
          ASSISTANT_EXAMPLES.map((example) => h("button", { key: example, type: "button", className: "pp-gbexample", onClick: () => setText(example) }, example))
        )
      ) : null,
      waiting2 ? h(
        "div",
        { className: "pp-gbwaiting", role: "status" },
        h("span", { className: "pp-checkspin" }),
        h("span", null, h("b", null, "Asked: "), "“" + waiting2.request + "” — the assistant is working on it (" + clock2 + "). Its proposal appears here and opens in the editor; the conversation shows each step."),
        h("button", { type: "button", className: "pp-linkbtn", onClick: () => setWaiting(null) }, "stop waiting")
      ) : null,
      cards.map(
        (entry) => h(
          "div",
          { key: entry.id, className: "pp-gbcard" + (props.loaded === entry.id ? " pp-gbcard-loaded" : "") + (entry.stale ? " pp-gbcard-stale" : "") },
          h(
            "div",
            { className: "pp-gbcardhead" },
            h("b", null, "Proposal " + entry.id),
            h("span", { className: "pp-gbwhen" }, when(entry.at) || ""),
            props.loaded === entry.id ? h("span", { className: "pp-chip pp-chip-ok" }, "in the editor") : null,
            entry.stale ? h("span", { className: "pp-chip pp-chip-warn", title: "The policy changed after this was proposed" }, "made for an older policy") : null
          ),
          entry.request ? h("div", { className: "pp-gbyou" }, h("span", { className: "pp-as" }, "You: "), entry.request) : null,
          entry.note ? h("div", { className: "pp-gbwhy" }, h("span", { className: "pp-as" }, "Why: "), entry.note) : null,
          h(PolicyDiff, { before: props.doc.policy, after: entry.proposal, assessments: props.doc.assessments, compact: true }),
          h(
            "div",
            { className: "pp-gbrow" },
            h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onDiscard(entry) }, "Discard"),
            h("button", { type: "button", className: "pp-primary", disabled: props.loaded === entry.id, onClick: () => props.onLoad(entry) }, props.loaded === entry.id ? "Loaded" : "Load into editor")
          )
        )
      ),
      sent.length && !waiting2 && cards.length === 0 ? h("div", { className: "pp-as" }, "No proposal came back. The session may have asked you something — look at the conversation.") : null
    ),
    h(
      "div",
      { className: "pp-gbcompose" },
      h("textarea", {
        className: "pp-gbinput pp-gbask",
        rows: 3,
        placeholder: "e.g. drop HW8 and give its weight to the final project",
        value: text,
        disabled: !props.ask,
        onChange: (e) => setText(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send2();
          }
        }
      }),
      h(
        "div",
        { className: "pp-gbrow" },
        h("span", { className: "pp-as", style: { flex: 1 } }, "Ctrl+Enter sends. Ids and weights only — no names."),
        h("button", { type: "button", className: "pp-primary", disabled: !props.ask || !text.trim() || Boolean(waiting2), onClick: send2 }, waiting2 ? "Waiting…" : "Ask")
      )
    )
  );
}

// client/files.js
var size = (bytes) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return (value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10) + " " + units[unit];
};
var minutes = (seconds) => seconds ? Math.max(1, Math.round(seconds / 60)) + " min" : "—";
var plural = (n, one, many) => n + " " + (n === 1 ? one : many);
var WHOSE_MOVE = { you: "Your move", assistant: "Assistant", done: "Done" };
function PileProgress(props) {
  const standing = props.standing;
  if (!standing || !standing.now) return h("span", { className: "pp-as" }, "not set up as a pile");
  const now = standing.now;
  const stages = standing.stages || [];
  const tip = stages.map((stage, i) => (stage.state === "done" ? "✓ " : i === now.index ? "→ " : "   ") + stage.label + " — " + stage.detail).join("\n");
  const at = now.index < now.total ? (stages[now.index] || {}).label : null;
  return h(
    "span",
    { className: "pp-pileprog", title: tip },
    h(
      "span",
      { className: "pp-pilebar", "aria-hidden": "true" },
      (standing.progress || []).map((state, i) => h("i", { key: i, className: state === "done" ? "pp-s-done" : i === now.index ? "pp-s-now" : "" }))
    ),
    h(
      "span",
      { className: "pp-pileprogtext" },
      h("span", { className: "pp-pileprogstep" }, at ? "Step " + (now.index + 1) + " of " + now.total + " · " + at : "All steps done"),
      h("span", { className: "pp-as" }, now.phrase)
    ),
    h("span", { className: "pp-whose pp-whose-" + now.whose }, WHOSE_MOVE[now.whose] || now.whose)
  );
}
function useFiles(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/files?run=" + encodeURIComponent(runId || "") + "&r=" + revision, sessionId), {
      headers: { accept: "application/json" }
    }).then((response) => response.json()).then((value) => live && setState({ phase: "ready", value })).catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision]);
  return state;
}
function Files(props) {
  const state = useFiles(props.runId, props.sessionId, props.revision);
  const [revealed, setRevealed] = React.useState(null);
  if (state.phase === "loading") return h(Message, null, "Reading what is stored…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);
  const reveal = (assessment) => {
    setRevealed({ busy: true });
    fetch(
      scoped(
        BASE + "/api/files/reveal?run=" + encodeURIComponent(props.runId || "") + (assessment ? "&assessment=" + encodeURIComponent(assessment) : ""),
        props.sessionId
      ),
      { method: "POST", headers: { accept: "application/json" } }
    ).then((response) => response.json()).then((answer) => setRevealed(answer.error ? { error: answer.error } : { ok: true })).catch((error) => setRevealed({ error: String(error) }));
  };
  const scans = doc.assessments.filter((entry) => entry.scans.uploaded || entry.scans.papers);
  const audio = doc.assessments.filter((entry) => entry.audio.takes);
  const nothing = !scans.length && !audio.length && !doc.unfiled.count && !doc.recordings.count;
  const folderButton = (assessment) => h("button", { type: "button", className: "pp-segbtn", title: "Open this folder in the file manager", onClick: () => reveal(assessment) }, "Folder");
  return h(
    "div",
    { className: "pp-files" },
    // Where: the one fact a professor asking "where are my scans" wants first.
    h(
      "div",
      { className: "pp-fileswhere" },
      h(
        "div",
        { className: "pp-fileswheretext" },
        h("b", null, "Stored on this computer, outside the course folder"),
        h("code", { title: doc.folder }, doc.folder),
        h("span", { className: "pp-as" }, "Scans and recordings carry students' names and voices, so they never go into the course folder or git.")
      ),
      h(
        "div",
        { className: "pp-approverow" },
        doc.exists ? h("button", { type: "button", className: "pp-segbtn", "aria-busy": revealed && revealed.busy ? "true" : void 0, onClick: () => reveal("") }, "Open folder") : null,
        props.onUpload ? h("button", { type: "button", className: "pp-primary", onClick: props.onUpload }, "Upload…") : null
      )
    ),
    revealed && revealed.error ? h("p", { className: "pp-behind" }, revealed.error) : null,
    nothing ? h(Message, null, "Nothing is stored for this run yet. Scanned papers and recorded answers you upload will be listed here.") : h(
      React.Fragment,
      null,
      // Totals, as tiles.
      h(
        "div",
        { className: "pp-filetiles" },
        h(
          "div",
          { className: "pp-filetile" },
          h("span", { className: "pp-filetilehead" }, "Scans"),
          h("b", null, plural(doc.totals.scans.files, "PDF", "PDFs")),
          h("span", { className: "pp-as" }, size(doc.totals.scans.bytes))
        ),
        h(
          "div",
          { className: "pp-filetile" },
          h("span", { className: "pp-filetilehead" }, "Audio"),
          h("b", null, doc.totals.audio.takes ? plural(doc.totals.audio.takes, "recording", "recordings") : "None yet"),
          h(
            "span",
            { className: "pp-as" },
            doc.totals.audio.takes ? minutes(doc.totals.audio.seconds) + " · " + size(doc.totals.audio.bytes) : "recorded answers and defences land here"
          )
        ),
        doc.unfiled.count || doc.recordings.count ? h(
          "div",
          { className: "pp-filetile pp-filetile-wait" },
          h("span", { className: "pp-filetilehead" }, "Waiting to be filed"),
          h(
            "b",
            null,
            [doc.unfiled.count ? plural(doc.unfiled.count, "scan", "scans") : null, doc.recordings.count ? plural(doc.recordings.count, "recording", "recordings") : null].filter(Boolean).join(" · ")
          ),
          h("span", { className: "pp-as" }, "uploaded, not yet given to an assessment or a student")
        ) : null
      ),
      // Scans, per assessment pile.
      scans.length || doc.unfiled.count ? h(
        "section",
        { className: "pp-filesection" },
        h("h3", null, "Scans"),
        h(
          "table",
          { className: "pp-plantable pp-filetable" },
          h(
            "thead",
            null,
            h(
              "tr",
              null,
              h("th", null, "Assessment"),
              h("th", null, "Progress"),
              h("th", { className: "pp-num" }, "Uploaded"),
              h("th", { className: "pp-num" }, "Papers filed"),
              h("th", { className: "pp-num" }, "Size"),
              h("th", null, "")
            )
          ),
          h(
            "tbody",
            null,
            doc.unfiled.count ? h(
              "tr",
              { key: "_unfiled", className: "pp-filewait" },
              h("td", null, h("b", null, "Not yet filed to an assessment")),
              h("td", null, h("span", { className: "pp-as" }, "waiting to be given to an assessment")),
              h("td", { className: "pp-num" }, String(doc.unfiled.count)),
              h("td", { className: "pp-num" }, "—"),
              h("td", { className: "pp-num" }, size(doc.unfiled.bytes)),
              h("td", { className: "pp-fileacts" }, props.onUpload ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onUpload }, "File them…") : null)
            ) : null,
            scans.map(
              (entry) => h(
                "tr",
                { key: entry.id },
                h("td", null, h(TitleWithTag, { title: entry.title })),
                h("td", null, h(PileProgress, { standing: entry.scans.standing })),
                h("td", { className: "pp-num" }, String(entry.scans.uploaded)),
                h("td", { className: "pp-num" }, String(entry.scans.papers)),
                h("td", { className: "pp-num" }, size(entry.scans.bytes)),
                h(
                  "td",
                  { className: "pp-fileacts" },
                  entry.scans.pile && entry.known && props.onOpenScans ? h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpenScans(entry.id) }, "Open pile") : null,
                  folderButton(entry.id)
                )
              )
            )
          )
        )
      ) : null,
      // Audio: recorded answers per assessment, and the uploaded batch.
      audio.length || doc.recordings.count ? h(
        "section",
        { className: "pp-filesection" },
        h("h3", null, "Audio"),
        h(
          "table",
          { className: "pp-plantable pp-filetable" },
          h(
            "thead",
            null,
            h("tr", null, h("th", null, "Assessment"), h("th", { className: "pp-num" }, "Students"), h("th", { className: "pp-num" }, "Recordings"), h("th", { className: "pp-num" }, "Length"), h("th", { className: "pp-num" }, "Size"), h("th", null, ""))
          ),
          h(
            "tbody",
            null,
            doc.recordings.count ? h(
              "tr",
              { key: "_batch", className: "pp-filewait" },
              h(
                "td",
                null,
                h("b", null, "Uploaded in a batch"),
                h(
                  "span",
                  { className: "pp-as" },
                  " · " + (doc.recordings.planned ? doc.recordings.matched + " of " + doc.recordings.planned + " matched to a student" : "not matched yet")
                )
              ),
              h("td", { className: "pp-num" }, "—"),
              h("td", { className: "pp-num" }, String(doc.recordings.count)),
              h("td", { className: "pp-num" }, "—"),
              h("td", { className: "pp-num" }, size(doc.recordings.bytes)),
              h("td", { className: "pp-fileacts" }, props.onRecordings ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onRecordings }, "Open recordings…") : null)
            ) : null,
            audio.map(
              (entry) => h(
                "tr",
                { key: entry.id },
                h("td", null, h(TitleWithTag, { title: entry.title })),
                h("td", { className: "pp-num" }, String(entry.audio.students)),
                h("td", { className: "pp-num" }, String(entry.audio.takes)),
                h("td", { className: "pp-num" }, minutes(entry.audio.seconds)),
                h("td", { className: "pp-num" }, size(entry.audio.bytes)),
                h("td", { className: "pp-fileacts" }, folderButton(entry.id))
              )
            )
          )
        )
      ) : null,
      doc.papers.count ? h(
        "p",
        { className: "pp-as" },
        "Also stored: " + plural(doc.papers.count, "question paper or answer key", "question papers and answer keys") + " (" + size(doc.papers.bytes) + ")."
      ) : null
    )
  );
}

// client/connections-menu.js
var MARK = { canvas: "Cv", sheets: "GS", github: "GH", telegram: "Tg", moodle: "Md", transcription: "Tr" };
var RANK = { bad: 3, warn: 2, ok: 1 };
var plural2 = (count, one, many) => count + " " + (count === 1 ? one : many);
var connectionsOf = (data, roads, checks) => {
  if (!data) return [];
  const rows = data.integrations || [];
  const rowOf = (id) => rows.find((row) => row.id === id) || null;
  const syncs = roads && roads.syncs ? roads.syncs : [];
  const syncsOf = (service) => syncs.filter((sync) => sync.service === service);
  const waitingOf = (service) => {
    const ids = new Set(syncsOf(service).map((sync) => sync.id));
    return (roads && roads.waiting ? roads.waiting : []).filter((entry) => ids.has(entry.sync)).length;
  };
  const missing = (row) => "Still to set up: " + row.steps.filter((step) => !step.done).map((step) => step.label).join(", ") + ".";
  const used = (id) => {
    const row = rowOf(id);
    return Boolean(row && row.state !== "absent" || syncsOf(id).length);
  };
  const fromSteps = (row) => !row || row.state === "absent" ? { tone: "bad", state: "not set up", line: "Nothing is recorded for it yet.", fix: "setup" } : row.state === "partial" ? { tone: "warn", state: "partly set up", line: missing(row), fix: "setup" } : { tone: "ok", state: "set up", line: row.what ? "For " + row.what + "." : "Set up.", fix: null };
  const out = [];
  if (used("canvas")) {
    const row = rowOf("canvas");
    const state = fromSteps(row);
    const waiting2 = waitingOf("canvas");
    if (row && row.state === "ready") {
      state.state = "connected";
      state.line = (data.canvas && data.canvas.host ? data.canvas.host : "Canvas") + " · every step recorded.";
    }
    if (waiting2 && state.tone === "ok") Object.assign(state, { tone: "warn", state: plural2(waiting2, "row", "rows") + " to confirm" });
    out.push(Object.assign({ id: "canvas", name: "Canvas", syncs: syncsOf("canvas") }, state));
  }
  const sheetSyncs = syncsOf("sheets");
  if (used("sheets")) {
    const google = data.google || {};
    const found = checks && checks.checks ? checks.checks : [];
    const expired = Boolean(google.connected && (google.expired || found.some((check) => check.reconnect) || sheetSyncs.some((sync) => sync.reconnect)));
    const readsLive = google.connected || sheetSyncs.some((sync) => sync.canReadLive);
    const changed = found.filter((check) => check.state === "changed");
    const waiting2 = waitingOf("sheets");
    const who = google.account ? " for " + google.account : "";
    const state = expired ? { tone: "bad", state: "sign-in expired", line: "Google stopped accepting the sign-in" + who + ".", fix: "reconnect" } : !readsLive ? { tone: "warn", state: "no Google login", line: "The sheet comes in as a download until Google is connected.", fix: "connect" } : waiting2 ? { tone: "warn", state: plural2(waiting2, "name", "names") + " to confirm", line: "Confirm them on the Google Sheets card.", fix: null } : changed.length ? {
      tone: "warn",
      state: "changed in Google",
      line: "The sheet changed" + (changed[0].modified ? " " + when(changed[0].modified) : "") + " since the last sync.",
      fix: null
    } : {
      tone: "ok",
      state: found.some((check) => check.state === "same") ? "up to date" : "connected",
      line: google.account ? "Signed in as " + google.account + "." : "This computer can read the sheet.",
      fix: null
    };
    out.push(Object.assign({ id: "sheets", name: "Google Sheets", syncs: sheetSyncs }, state));
  }
  const github = data.github || {};
  const githubSyncs = syncsOf("github");
  if (githubSyncs.length || github.connection) {
    const gh = github.gh || {};
    const state = github.via === "token" ? { tone: "ok", state: "signed in", line: "A saved token" + (github.owner ? ", repositories under " + github.owner : "") + ".", fix: null } : github.via === "gh" ? { tone: "ok", state: "signed in", line: "The gh command line, as " + gh.account + ".", fix: null } : {
      tone: "bad",
      state: "not signed in",
      line: gh.installed ? "gh is installed but not signed in, and no token is saved." : "No GitHub token is saved, and gh is not installed.",
      fix: "setup"
    };
    out.push(Object.assign({ id: "github", name: "GitHub", syncs: githubSyncs }, state));
  }
  for (const id of ["telegram", "moodle"]) {
    if (!used(id)) continue;
    const row = rowOf(id);
    out.push(Object.assign({ id, name: row ? row.label : id, syncs: syncsOf(id) }, fromSteps(row)));
  }
  const refs = data.credentials && data.credentials.refs || {};
  const transcription = (data.registry && data.registry.connections || []).find((entry) => entry.type === "transcription");
  if (transcription) {
    const saved = Boolean(refs[transcription.tokenEnv] && refs[transcription.tokenEnv].configured || transcription.tokenInEnv);
    const what = [transcription.provider, transcription.model].filter(Boolean).join(" · ");
    out.push(
      saved ? { id: "transcription", name: "Transcription", tone: "ok", state: "key saved", line: (what || "A provider") + ", for recorded defences.", fix: null, syncs: [] } : { id: "transcription", name: "Transcription", tone: "bad", state: "no key", line: "No key is saved for " + (what || "the provider") + ".", fix: "setup", syncs: [] }
    );
  }
  return out;
};
var worstOf = (rows) => rows.reduce((worst, row) => !worst || RANK[row.tone] > RANK[worst.tone] ? row : worst, null);
function ConnectionsMenu(props) {
  const [open2, setOpen] = React.useState(false);
  const [at, setAt] = React.useState(null);
  const box = React.useRef(null);
  const layer = React.useRef(null);
  const checks = useSheetCheck(props.runId, props.sessionId, String(props.revision || 0));
  const rows = connectionsOf(props.data, props.roads, checks);
  React.useEffect(() => {
    if (!open2) return void 0;
    const place = () => {
      if (!box.current) return;
      const rect = box.current.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 32);
      setAt({ top: rect.bottom + 6, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), width });
    };
    place();
    const away = (event) => {
      const inside = [box.current, layer.current].some((node) => node && node.contains(event.target));
      if (!inside) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
    };
  }, [open2]);
  if (!rows.length) return null;
  const worst = worstOf(rows);
  const label = worst.tone === "ok" ? "Connections" : worst.name + ": " + worst.state + (rows.filter((row) => row.tone !== "ok").length > 1 ? " · more" : "");
  const go = (id) => {
    setOpen(false);
    if (props.onOpen) props.onOpen(id);
  };
  const fixOf = (row) => {
    if (row.fix === "reconnect" || row.fix === "connect") {
      return h(ReconnectGoogle, { label: row.fix === "connect" ? "Connect Google" : "Reconnect Google", onBack: props.onDone });
    }
    if (row.fix === "setup") return h("button", { type: "button", className: "pp-segbtn", onClick: () => go(row.id) }, "Set up");
    return null;
  };
  const panel = h(
    "div",
    {
      className: "pp-connpanel",
      ref: layer,
      role: "dialog",
      "aria-label": "Connections",
      style: at ? { top: at.top + "px", left: at.left + "px", width: at.width + "px" } : { visibility: "hidden" }
    },
    // What needs the professor first; otherwise in the header's order.
    rows.slice().sort((left, right) => RANK[right.tone] - RANK[left.tone]).map(
      (row) => h(
        "section",
        { className: "pp-connrow pp-conn-" + row.tone, key: row.id },
        h(
          "div",
          { className: "pp-connhead" },
          h("span", { className: "pp-svc pp-svc-small pp-svc-" + row.id, "aria-hidden": "true" }, MARK[row.id] || row.id.slice(0, 2)),
          h("span", { className: "pp-connname" }, row.name, h("span", { className: "pp-connstate" }, row.state)),
          h("span", { className: "pp-segspacer" }),
          fixOf(row),
          h("button", { type: "button", className: "pp-segbtn", title: "Its card on Integrations", onClick: () => go(row.id) }, "Open")
        ),
        h("p", { className: "pp-connline" }, row.line),
        row.syncs.map(
          (sync) => h(
            "div",
            { className: "pp-connsync", key: sync.id },
            h("div", { className: "pp-csubtitle" }, sync.label, h("span", { className: "pp-syncid" }, sync.id)),
            h(SyncCard, {
              sync,
              bare: true,
              check: checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) || null : null,
              assessments: props.roads ? props.roads.assessments : [],
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onDone: props.onDone
            })
          )
        )
      )
    )
  );
  return h(
    "span",
    { className: "pp-conn", ref: box },
    h(
      "button",
      {
        type: "button",
        className: "pp-connbtn pp-conn-" + worst.tone + (props.waiting ? " pp-wiring-waiting" : ""),
        "aria-expanded": open2,
        disabled: props.disabled,
        title: props.disabled ? "Private — not shown while previewing as a student" : "Each connection, and its syncs",
        onClick: () => setOpen(!open2)
      },
      rows.map(
        (row) => h("span", { className: "pp-conndot pp-conn-" + row.tone, key: row.id, title: row.name + ": " + row.state }, MARK[row.id] || row.id.slice(0, 2))
      ),
      h("span", { className: "pp-connlabel" }, [label, props.waiting && worst.tone === "ok" ? plural2(props.waiting, "row", "rows") + " waiting" : null].filter(Boolean).join(" · ")),
      h("span", { className: "pp-connchev", "aria-hidden": "true" }, open2 ? "▴" : "▾")
    ),
    open2 ? ReactDOM.createPortal(panel, document.body) : null
  );
}

// client/preferences.js
function Layer(props) {
  const layer = props.layer;
  const rows = [];
  const walk = (value, prefix) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const key of Object.keys(value)) walk(value[key], prefix ? prefix + "." + key : key);
      return;
    }
    rows.push({
      key: prefix,
      value: Array.isArray(value) ? value.join(", ") : String(value)
    });
  };
  if (layer.values) walk(layer.values, "");
  return h(
    "div",
    { className: "pp-layer" },
    h("p", { className: "pp-layername" }, layer.label + " · " + layer.scope),
    h("p", { className: "pp-layerpath" }, layer.path),
    layer.error ? h("p", { className: "pp-absent" }, "This file could not be parsed: " + layer.error) : !layer.present ? h("p", { className: "pp-absent" }, "No file here. Nothing at this layer.") : rows.length === 0 ? h("p", { className: "pp-absent" }, "The file has no `values` block.") : rows.map(
      (row) => h(
        "div",
        { className: "pp-pref", key: row.key },
        h("span", { className: "pp-prefkey" }, row.key),
        h("span", { className: "pp-prefval" }, row.value)
      )
    )
  );
}
function flattenValues(values) {
  const out = {};
  const walk = (node, prefix) => {
    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
      for (const key of Object.keys(node)) walk(node[key], prefix ? prefix + "." + key : key);
      return;
    }
    out[prefix] = Array.isArray(node) ? node.join(", ") : node;
  };
  if (values) walk(values, "");
  return out;
}
function inheritedAt(flats, layers, scope, path) {
  let found = null;
  for (let index = 0; index < layers.length; index += 1) {
    if (layers[index].scope === scope) break;
    if (Object.prototype.hasOwnProperty.call(flats[index], path)) {
      found = { value: flats[index][path], label: layers[index].label };
    }
  }
  return found;
}
function Preferences(props) {
  const url = scoped(
    BASE + "/api/preferences?course=" + encodeURIComponent(props.courseId || "") + "&term=" + encodeURIComponent(props.term || ""),
    props.sessionId
  );
  const state = useJson(url);
  const [fresh, setFresh] = React.useState(null);
  const [scope, setScope] = React.useState("professor");
  const [edits, setEdits] = React.useState({});
  const [status, setStatus] = React.useState(null);
  const data = fresh || (state.phase === "ready" && !state.value.error ? state.value : null);
  React.useEffect(() => {
    if (!data) return;
    const layer = data.layers.filter((entry) => entry.scope === scope)[0];
    setEdits(flattenValues(layer && layer.values));
    setStatus(null);
  }, [state.phase, fresh, scope]);
  if (state.phase === "loading") return h(Message, null, "Reading the preference files…");
  if (state.value && state.value.error) return h(Message, { error: true }, state.value.error);
  if (!data) return h(Message, null, "No preferences to show.");
  const layers = data.layers;
  const flats = layers.map((layer) => flattenValues(layer.values));
  const editable = layers.filter((layer) => layer.scope !== "system");
  const chosen = layers.filter((entry) => entry.scope === scope)[0];
  const picker = h(
    "div",
    { className: "pp-seg" },
    editable.map(
      (layer) => h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": scope === layer.scope,
          title: layer.path,
          onClick: () => setScope(layer.scope),
          key: layer.scope
        },
        layer.label
      )
    ).concat([
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": scope === "all",
          title: "Every layer as it stands, including the DataLayer defaults",
          onClick: () => setScope("all"),
          key: "all"
        },
        "All layers"
      )
    ])
  );
  if (scope === "all" || !chosen) {
    return h(
      "div",
      { className: "pp-prefwrap" },
      picker,
      h(
        "div",
        { className: "pp-scroll" },
        layers.map((layer) => h(Layer, { layer, key: layer.scope })),
        h("p", { className: "pp-absent" }, data.note)
      )
    );
  }
  const setField = (path, value) => setEdits((previous) => Object.assign({}, previous, { [path]: value }));
  const control = (field) => {
    const has = Object.prototype.hasOwnProperty.call(edits, field.path);
    const raw = has && edits[field.path] !== null ? edits[field.path] : "";
    const current = String(raw);
    const inherited = inheritedAt(flats, layers, scope, field.path);
    const className = "pp-prefctl" + (current === "" ? "" : " pp-set");
    if (field.type === "boolean" || field.type === "enum") {
      const options = field.type === "boolean" ? ["true", "false"] : field.options;
      return h(
        "select",
        {
          className,
          value: current,
          onChange: (event) => setField(field.path, event.target.value)
        },
        [h("option", { value: "", key: "" }, "inherit")].concat(
          options.map((option) => h("option", { value: option, key: option }, option))
        )
      );
    }
    return h("input", {
      className,
      type: field.type === "number" ? "number" : "text",
      step: "any",
      value: current,
      // The inherited value, so an empty box shows what it is deferring to
      // rather than looking unset.
      placeholder: inherited === null ? "inherit" : String(inherited.value),
      onChange: (event) => setField(field.path, event.target.value)
    });
  };
  const rows = [];
  let group = null;
  for (const field of data.schema) {
    if (field.group !== group) {
      group = field.group;
      rows.push(h("p", { className: "pp-prefgroup", key: "g:" + group }, group));
    }
    const inherited = inheritedAt(flats, layers, scope, field.path);
    rows.push(
      h(
        "div",
        { className: "pp-prefrow", key: field.path },
        h(
          "span",
          { className: "pp-preflabel" },
          field.label,
          h(
            "span",
            { className: "pp-prefinherit" },
            inherited === null ? "nothing below sets this" : String(inherited.value) + " · " + inherited.label
          )
        ),
        control(field)
      )
    );
  }
  const save = () => {
    setStatus("saving");
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, values: edits })
    }).then((response) => response.json()).then((body) => {
      if (body.error) {
        setStatus({ error: body.error });
        return;
      }
      setFresh(body);
      setStatus({ saved: body.saved });
    }).catch((error) => setStatus({ error: String(error && error.message || error) }));
  };
  const saved = status && status.saved;
  return h(
    "div",
    { className: "pp-prefwrap" },
    picker,
    h(
      "div",
      { className: "pp-scroll" },
      h("p", { className: "pp-layername" }, chosen.label + " · " + chosen.scope),
      h("p", { className: "pp-layerpath" }, chosen.path),
      chosen.error ? h("p", { className: "pp-saveerr" }, "This file could not be parsed: " + chosen.error) : null,
      h(
        "p",
        { className: "pp-absent" },
        chosen.present ? "This file exists. It overrides only the settings it names." : "No file here yet. Saving a setting creates it; saving nothing does not."
      ),
      rows,
      h(
        "div",
        { className: "pp-saverow" },
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: status === "saving",
            title: "Write these settings to " + chosen.path,
            onClick: save
          },
          status === "saving" ? "Saving…" : "Save to this layer"
        ),
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            onClick: () => {
              setEdits(flattenValues(chosen.values));
              setStatus(null);
            }
          },
          "Revert"
        ),
        status && status.error ? h("span", { className: "pp-saveerr" }, status.error) : saved ? h(
          "span",
          { className: "pp-savenote" },
          saved.written ? "Wrote " + saved.count + " setting" + (saved.count === 1 ? "" : "s") + "." : "Nothing set, so no file was created."
        ) : null
      )
    )
  );
}

// client/materials.js
function WidgetFrame(props) {
  const url = scoped(
    BASE + "/view/" + props.view + "?run=" + encodeURIComponent(props.runId) + (props.dark ? "&dark=1" : "") + (props.drafts ? "&drafts=1" : "") + // Course mode's "Preview as student": the record alone, no hole.
    (props.student ? "&student=1" : "") + // Course mode's reading: planning, teaching, or the full term table.
    (props.mode ? "&mode=" + encodeURIComponent(props.mode) : "") + // Teaching's focus week, when course mode kept one.
    (props.week ? "&week=" + encodeURIComponent(props.week) : "") + // Only ever sent affirmatively, and only by the class list. Every
    // other view's URL is unchanged, so nothing else can start naming
    // people because a parameter leaked into a shared link.
    (props.names ? "&names=1" : ""),
    props.sessionId
  );
  const [doc, setDoc] = React.useState(null);
  const loaded = React.useRef(null);
  const shownHtml = React.useRef(null);
  React.useEffect(() => {
    let live = true;
    const same = loaded.current === url;
    if (!same) setDoc(null);
    fetch(url).then(
      (response) => response.text().then((text) => ({
        html: text,
        // What the route says it merged, and what the draft loader
        // complained about on the way. Headers rather than fields in the
        // payload, because the payload goes into a widget document that
        // is shared with two other hosts and has no place to print them.
        mode: response.headers.get("x-professor-pane-drafts"),
        issues: decodeIssues(response.headers.get("x-professor-pane-draft-issues"))
      }))
    ).then((value) => {
      if (!live) return;
      if (!same) {
        loaded.current = url;
        shownHtml.current = value.html;
        setDoc(value);
        return;
      }
      if (value.html === shownHtml.current) return;
      shownHtml.current = value.html;
      setDoc(value);
    }).catch((error) => {
      if (live) setDoc({ failed: String(error.message || error) });
    });
    return () => {
      live = false;
    };
  }, [url, props.revision]);
  if (doc === null) return h(Message, null, "Reading the course model…");
  if (doc.failed) return h(Message, { error: true }, doc.failed);
  return h(
    React.Fragment,
    null,
    doc.mode === "merged" ? h(
      "div",
      { className: "pp-banner" },
      h("b", null, "Record + drafts. "),
      "Everything below includes records marked ",
      h("code", null, "approval: draft"),
      ", which nobody has accepted yet. Accepting one is changing that word to ",
      h("code", null, "approved"),
      " in its record, and that is yours to do.",
      doc.issues.length ? h("span", { className: "pp-issues" }, doc.issues.join("  ·  ")) : null
    ) : null,
    h("iframe", {
      className: "pp-frame",
      srcDoc: doc.html,
      sandbox: "allow-scripts allow-popups allow-popups-to-escape-sandbox",
      "aria-label": props.title,
      title: props.title
    })
  );
}
var MATERIAL_ROUTES = /* @__PURE__ */ new Set([
  BASE + "/file",
  BASE + "/brief",
  BASE + "/outline",
  BASE + "/starter"
]);
function materialUrl(value) {
  if (typeof value !== "string" || value === "") return null;
  let url;
  try {
    url = new URL(value, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (!MATERIAL_ROUTES.has(url.pathname)) return null;
  return url.href;
}
var MEDIA = /* @__PURE__ */ new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp"]);
function mentionOf(url, label) {
  let parsed;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return "";
  }
  const id = parsed.searchParams.get("doc") ?? parsed.searchParams.get("assessment") ?? "";
  if (id === "") return "";
  const title = typeof label === "string" ? label.trim() : "";
  const named = title === "" ? id : id + ' ("' + title + '")';
  const source = parsed.searchParams.get("from") ?? "";
  return source === "" ? named : named + ", built from " + source;
}
var COURSE_MODES = [
  { id: "planning", label: "Planning", hint: "Does the term hold together: topics, quizzes, homework, weights" },
  { id: "teaching", label: "Teaching", hint: "This week, between the last and the next. Carries class figures" },
  { id: "evidence", label: "Evidence", hint: "How each week went: hand-ins, marks and concepts. Carries class figures" },
  { id: "term", label: "All weeks", hint: "Every week in full, three columns" }
];
var defaultCourseMode = (start, end) => {
  const now = /* @__PURE__ */ new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return start && end && today >= start && today <= end ? "teaching" : "planning";
};
var COURSE_VIEWS = [
  { id: "students", label: "Students", hint: "The class list, by subgroup — names and marks, so private" },
  { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment, and how much of it Canvas has" },
  // The class by concept: what used to be the right column's Progress tab.
  { id: "concepts", label: "Concepts", hint: "The class, by concept — what has been shown and what has not" },
  { id: "tasks", label: "Tasks", hint: "What is waiting for you, what is ready, what has not gone out" },
  // What the course has got, by kind rather than by week: the right
  // column's old Course outline sub-views, the student's outline last.
  { id: "materials", label: "Materials", hint: "Assessments, slides, exams, the grading policy, and the outline a student reads" },
  // The private material itself — scanned papers, recorded answers — which
  // lives outside the course folder, so has no other place to be seen whole.
  { id: "files", label: "Files", hint: "Scans and audio: where they are stored, how much there is, each pile" },
  // Last: not the course but its roads out — Canvas, the sheet, the
  // repositories — and what the skills assume. Opened twice a term.
  { id: "settings", label: "Course settings", hint: "Integrations — Canvas, the grade sheet, GitHub — and the preferences the skills assume" }
];
var VIEW_SUBS = {
  tasks: SUBVIEWS.tasks,
  materials: [
    { id: "assessments", label: "Assessments" },
    { id: "slides", label: "Slides" },
    { id: "exams", label: "Exams" },
    { id: "grading", label: "Grading policy" },
    { id: "outline", label: "Student's outline" }
  ],
  settings: [
    { id: "integrations", label: "Integrations" },
    { id: "preferences", label: "Preferences" }
  ]
};
var VIEW_ALIASES = {
  integrations: { view: "settings", sub: "integrations" },
  preferences: { view: "settings", sub: "preferences" }
};
var resolveRequest = (request) => {
  if (!request || !VIEW_ALIASES[request.view]) return request;
  return { ...request, ...VIEW_ALIASES[request.view], sub: request.sub || VIEW_ALIASES[request.view].sub };
};
var CONNECTION_STATE = { ready: "connected", partial: "partly set up", absent: "not set up" };
function CourseMode(props) {
  const close = props.onClose;
  const everything = useVersion(AREAS.everything);
  const integrationsVersion = useVersion(AREAS.integrations);
  const syncsVersion = useVersion(AREAS.syncs);
  const marksVersion = useVersion(AREAS.marks);
  const gradingVersion = useVersion(AREAS.grading);
  const filesVersion = useVersion(AREAS.files);
  const [student, setStudent] = React.useState(false);
  const request = resolveRequest(props.request || null);
  const known = (id, list) => list.some((entry) => entry.id === id);
  const [mode, setMode] = React.useState(
    () => request && known(request.mode, COURSE_MODES) ? request.mode : defaultCourseMode(props.start, props.end)
  );
  const [view, setView] = React.useState(() => request && known(request.view, COURSE_VIEWS) ? request.view : null);
  const [subs, setSubs] = React.useState(
    () => request && VIEW_SUBS[request.view] && known(request.sub, VIEW_SUBS[request.view]) ? { [request.view]: request.sub } : {}
  );
  const subOf = (id) => VIEW_SUBS[id] ? subs[id] || VIEW_SUBS[id][0].id : null;
  const setSub = (id, sub) => setSubs((value) => Object.assign({}, value, { [id]: sub }));
  React.useEffect(() => {
    if (!request) return;
    if (known(request.view, COURSE_VIEWS)) {
      setView(request.view);
      if (VIEW_SUBS[request.view] && known(request.sub, VIEW_SUBS[request.view])) setSub(request.view, request.sub);
    } else if (known(request.mode, COURSE_MODES)) {
      setMode(request.mode);
      setView(null);
    }
  }, [request ? request.n : null]);
  const taskSub = subOf("tasks");
  const onShown = props.onShown;
  React.useEffect(() => {
    const place = { mode, view };
    if (onShown) onShown(place);
    window.dispatchEvent(new CustomEvent(PLACE_SHOWN_EVENT, { detail: place }));
  }, [mode, view]);
  React.useEffect(
    () => () => window.dispatchEvent(new CustomEvent(PLACE_SHOWN_EVENT, { detail: null })),
    []
  );
  const stepped = React.useRef(null);
  const [week, setWeek] = React.useState(null);
  React.useEffect(() => {
    setWeek(stepped.current);
  }, [everything, props.drafts]);
  const chooseMode = (id) => {
    if (id === "teaching") setWeek(stepped.current);
    setMode(id);
    setView(null);
  };
  const [left, setLeft] = React.useState(0);
  const beside = useChatBeside(Boolean(props.chat), left);
  const veilRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const nav = document.querySelector(".pp-nav, .pp-nav-rail");
    if (!nav) return void 0;
    let column = null;
    for (let node = nav.parentElement; node && node !== document.body; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.left <= 0.5 && rect.width > 0 && rect.width < window.innerWidth / 2) column = node;
    }
    if (column === null) return void 0;
    const measure = () => setLeft(Math.round(column.getBoundingClientRect().right));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const private_ = view !== null || mode === "teaching" || mode === "evidence";
  const preview = student && !private_;
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (props.chat && veilRef.current && target instanceof Node && target !== document.body && !veilRef.current.contains(target)) return;
      if (event.composedPath().some((node) => node instanceof Element && (node.hasAttribute("data-own-escape") || node.classList.contains("planform")))) return;
      if (document.querySelector(".pp-connpanel")) return;
      if (courseModeEscape({ covered: props.covered }) === "close") close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, props.covered, props.chat]);
  const wiring = useJson(
    scoped(BASE + "/api/integrations?run=" + encodeURIComponent(props.runId || "") + "&r=" + integrationsVersion, props.sessionId)
  );
  const canvas = wiring.phase === "ready" && wiring.value && !wiring.value.error ? (wiring.value.integrations || []).find((row) => row.id === "canvas") || null : null;
  const syncs = useJson(
    scoped(BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + "&r=" + syncsVersion, props.sessionId)
  );
  const shown = React.useRef({ canvas: null, waiting: 0, data: null, roads: null });
  if (wiring.phase === "ready") {
    shown.current.canvas = canvas;
    shown.current.data = wiring.value && !wiring.value.error ? wiring.value : null;
  }
  if (syncs.phase === "ready") {
    shown.current.waiting = syncs.value && !syncs.value.error ? (syncs.value.waiting || []).length : 0;
    shown.current.roads = syncs.value && !syncs.value.error ? syncs.value : null;
  }
  const waiting2 = shown.current.waiting;
  const canvasLine = shown.current.canvas;
  const [jump, setJump] = React.useState(null);
  const openCard = (service) => {
    setJump((current) => ({ service, tick: (current ? current.tick : 0) + 1 }));
    setSub("settings", "integrations");
    setView("settings");
  };
  const viewBody = () => {
    if (view === "files") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        h(Files, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: filesVersion,
          onUpload: props.onUpload,
          onOpenScans: props.onOpenScans,
          onRecordings: props.onRecordings,
          key: props.runId
        })
      );
    }
    if (view === "settings") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        subOf("settings") === "preferences" ? h(Preferences, { courseId: props.courseId || "", term: props.term || "", sessionId: props.sessionId }) : h(Integrations, {
          runId: props.runId,
          sessionId: props.sessionId,
          onWrite: () => props.wrote(["integrations"]),
          revision: integrationsVersion,
          names: props.names,
          ask: props.ask,
          focus: jump || props.integrationsFocus,
          key: props.runId
        })
      );
    }
    if (view === "concepts") {
      return h(WidgetFrame, {
        key: "progress|" + props.dark + "|" + props.drafts,
        revision: everything,
        view: "progress",
        runId: props.runId,
        sessionId: props.sessionId,
        dark: props.dark,
        drafts: props.drafts,
        title: "Concepts"
      });
    }
    if (view === "materials") {
      const sub = subOf("materials");
      return h(WidgetFrame, {
        key: sub + "|" + props.dark + "|" + props.drafts,
        revision: everything,
        view: sub,
        runId: props.runId,
        sessionId: props.sessionId,
        dark: props.dark,
        drafts: props.drafts,
        title: (VIEW_SUBS.materials.find((entry) => entry.id === sub) || { label: "Materials" }).label
      });
    }
    if (view === "students") {
      return h(WidgetFrame, {
        key: "students|" + props.names + "|" + props.dark,
        revision: everything,
        view: "students",
        runId: props.runId,
        sessionId: props.sessionId,
        dark: props.dark,
        names: props.names,
        title: "Students"
      });
    }
    if (view === "gradebook") {
      return h(
        React.Fragment,
        null,
        h(GradebookStatus, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: marksVersion,
          names: props.names,
          ask: props.ask,
          onWrite: () => props.wrote(["grading"])
        }),
        h(GradebookPanes, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: gradingVersion,
          names: props.names,
          ask: props.ask,
          onWrite: () => props.wrote(["grading"])
        }),
        h(WidgetFrame, {
          key: "gradebook|" + props.dark + "|" + props.drafts,
          revision: everything,
          view: "gradebook",
          runId: props.runId,
          sessionId: props.sessionId,
          dark: props.dark,
          drafts: props.drafts,
          title: "Gradebook"
        })
      );
    }
    if (taskSub === "unpublished") {
      return h(Unpublished, {
        runId: props.runId,
        sessionId: props.sessionId,
        revision: marksVersion,
        onWrite: () => props.wrote(["integrations", "grading"]),
        openPublish: props.openPublish,
        ask: props.ask,
        names: props.names
      });
    }
    return h(WidgetFrame, {
      key: taskSub + "|" + props.names + "|" + props.dark + "|" + props.drafts,
      revision: everything,
      view: taskSub,
      runId: props.runId,
      sessionId: props.sessionId,
      dark: props.dark,
      drafts: props.drafts,
      names: props.names,
      title: "Tasks"
    });
  };
  const segment = (entry, pressed, onClick, disabled) => h(
    "button",
    {
      type: "button",
      className: "pp-segbtn",
      "aria-pressed": pressed,
      disabled,
      title: disabled ? "Private — not shown while previewing as a student" : entry.hint,
      onClick,
      key: entry.id
    },
    entry.label
  );
  const named = view === "students" || view === "settings" && subOf("settings") === "integrations" || view === "tasks" && taskSub !== "unpublished";
  const navigator2 = left > 0;
  const viewEntry = view ? COURSE_VIEWS.find((entry) => entry.id === view) || null : null;
  const placeName = viewEntry ? viewEntry.label : navigator2 ? "Weeks" : props.title;
  const setChat = props.setChat || (() => {
  });
  const chatState = useChatState(props.chatState, Boolean(props.chat), props.sessionId);
  return ReactDOM.createPortal(
    h(
      React.Fragment,
      null,
      h(
        "div",
        {
          ref: veilRef,
          className: "pp-veil pp-coursemode" + (beside.mode === "side" ? " pp-beside" : "") + (beside.mode === "swap" ? " pp-away" : ""),
          style: { left: left + "px", right: (beside.mode === "side" ? beside.width : 0) + "px" },
          "aria-hidden": beside.mode === "swap" ? "true" : void 0
        },
        h(
          "div",
          {
            className: "pp-modal",
            role: "region",
            "aria-label": "Course mode — " + props.title
          },
          h(
            "div",
            { className: "pp-modalhead pp-coursehead" },
            // The place, not the course: the course is named in the navigator
            // beside it and in the column, and here it only crowded the row.
            h("div", { className: "pp-modaltitle", title: props.title }, placeName),
            // The readings of the weeks. Under a place they are the way back to
            // the weeks, so they stay, unpressed.
            COURSE_MODES.map((entry) => segment(entry, view === null && mode === entry.id, () => chooseMode(entry.id), false)),
            navigator2 ? null : h("span", { className: "pp-segsep", "aria-hidden": "true" }),
            navigator2 ? null : COURSE_VIEWS.map((entry) => segment(entry, view === entry.id, () => setView(entry.id), preview)),
            h("span", { className: "pp-segspacer" }),
            DRAFT_MODES.map(
              (entry) => h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": props.drafts === entry.drafts,
                  title: entry.hint,
                  onClick: () => props.setDrafts(entry.drafts),
                  key: entry.label
                },
                entry.label
              )
            ),
            // Not on Teaching, Evidence or a course-wide view: a student is
            // never shown class figures or names, so there is nothing to preview.
            private_ ? null : h(
              "label",
              { title: "The record alone, with no hole drawn — what ainar page publishes" },
              h("input", {
                type: "checkbox",
                checked: student,
                onChange: (event) => setStudent(event.target.checked)
              }),
              "Preview as student"
            ),
            // The pane's header, which this veil covers. Publish and Upload
            // open their own windows on top, so course mode is still here when
            // they close. The connections button says how each service stands
            // and holds their syncs; with none to show (no payload yet), the
            // old Canvas line stands in.
            shown.current.data ? h(ConnectionsMenu, {
              data: shown.current.data,
              roads: shown.current.roads,
              waiting: waiting2,
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              revision: integrationsVersion + "." + syncsVersion,
              disabled: preview,
              onOpen: openCard,
              onDone: () => props.wrote(["syncs", "marks", "integrations"])
            }) : canvasLine || waiting2 ? h(
              "button",
              {
                type: "button",
                className: "pp-wiring pp-wiring-" + (canvasLine ? canvasLine.state : "ready") + (waiting2 ? " pp-wiring-waiting" : ""),
                title: preview ? "Private — not shown while previewing as a student" : "Open Integrations",
                disabled: preview,
                onClick: () => {
                  setSub("settings", "integrations");
                  setView("settings");
                }
              },
              [
                canvasLine ? "Canvas: " + (CONNECTION_STATE[canvasLine.state] || canvasLine.state) : null,
                waiting2 ? waiting2 + " waiting" : null
              ].filter(Boolean).join(" · ")
            ) : null,
            h(
              "button",
              { type: "button", className: "pp-publishbtn", title: "Publish the course page, an announcement, a repository or a Canvas brief", onClick: props.onPublish },
              "Publish"
            ),
            h(
              "button",
              { type: "button", className: "pp-publishbtn", title: "Scanned papers, an exam paper and its key, or recorded defences", onClick: props.onUpload },
              "Upload"
            ),
            // The conversation beside the place: a press on a hole starts a
            // turn there, and this is how to look at it again or put it away.
            // Put away, it still says how the chat is doing: working, waiting
            // on the professor, or finished since it was put away.
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn pp-chatbtn" + (chatState === "waiting" ? " pp-chat-wait" : chatState === "done" ? " pp-chat-done" : ""),
                "aria-pressed": Boolean(props.chat),
                "aria-busy": chatState === "running" ? "true" : void 0,
                title: CHAT_STATE_TIP[chatState] ? CHAT_STATE_TIP[chatState] + " — " + (props.chat ? "put the chat away" : "press to see it") : props.chat ? "Put the chat away; the place takes the width" : "The chat beside this place",
                onClick: () => setChat(!props.chat)
              },
              CHAT_STATE_WORD[chatState] ? "Chat · " + CHAT_STATE_WORD[chatState] : "Chat"
            ),
            h(
              "button",
              {
                type: "button",
                className: "pp-close",
                "aria-label": "Close course mode",
                title: "Back to the conversation (Esc)",
                onClick: close
              },
              "×"
            )
          ),
          h(
            "div",
            { className: "pp-coursebody" },
            // The weeks, drawn here by React from the course data
            // (client/course/): a refresh re-renders in place, and a Planning
            // drop moves its bar before the write is made.
            h(CourseView, {
              runId: props.runId,
              sessionId: props.sessionId,
              dark: props.dark,
              drafts: props.drafts,
              student: preview,
              mode,
              week: mode === "teaching" ? week : null,
              mention: props.mention,
              chatTitle: props.chatTitle,
              fresh: props.startChat ? (text) => props.startChat({ mode, draft: text }) : null,
              onStep: (n) => {
                stepped.current = n;
              }
            }),
            // The weeks stay mounted under a course-wide view, so coming back
            // to them keeps the place and the scroll.
            view ? h(
              "section",
              { className: "pp-cview", "aria-label": viewEntry ? viewEntry.label : "Course" },
              VIEW_SUBS[view] || named ? h(
                "div",
                { className: "pp-cviewbar" },
                VIEW_SUBS[view] ? VIEW_SUBS[view].map((entry) => segment(entry, subOf(view) === entry.id, () => setSub(view, entry.id), false)) : null,
                h("span", { className: "pp-segspacer" }),
                // The pane's own choice, the same state, so the two never differ.
                named ? IDENTITY_MODES.map(
                  (entry) => h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn" + (entry.names && props.names ? " pp-segbtn-warn" : ""),
                      "aria-pressed": props.names === entry.names,
                      title: entry.hint,
                      onClick: () => props.setNames(entry.names),
                      key: entry.label
                    },
                    entry.label
                  )
                ) : null
              ) : null,
              h("div", { className: "pp-cviewbody" }, viewBody())
            ) : null
          ),
          // The chat's text field on the page itself, while the chat is not
          // beside it: a question asked here starts the turn and brings the
          // chat in beside the place, which stays where it was.
          props.chat || !props.ask ? null : h(CourseComposer, {
            key: props.sessionId,
            focus: Boolean(props.compose),
            draft: props.draft,
            place: placeName + (view === null ? " · " + (COURSE_MODES.find((entry) => entry.id === mode) || { label: mode }).label : ""),
            runId: props.runId,
            onSend: (text) => {
              props.ask(text);
              setChat(true);
            }
          })
        )
      ),
      // The chat beside the place, put away from the chat's own side: a tab
      // on the rule between the two, halfway down, where it covers neither
      // header (the chat's title and Session log, the place's own ×).
      beside.mode === "side" ? h(
        "button",
        {
          type: "button",
          className: "pp-chatclose",
          style: { right: beside.width - 13 + "px" },
          "aria-label": "Put the chat away",
          title: "Put the chat away; the place takes the width",
          onClick: () => setChat(false)
        },
        "›"
      ) : null,
      // The place stepped aside for the chat on a narrow window: the way back.
      beside.mode === "swap" ? h(
        "button",
        { type: "button", className: "pp-primary pp-backpill", onClick: () => setChat(false) },
        "‹ " + placeName
      ) : null
    ),
    document.body
  );
}
var CHAT_STATE_WORD = { running: "working", waiting: "needs you", done: "done" };
var CHAT_STATE_TIP = {
  running: "The assistant is working",
  waiting: "The chat is waiting for your answer",
  done: "The assistant finished while the chat was put away"
};
function useChatState(source, shown, sessionId) {
  const latest = React.useRef(source);
  latest.current = source;
  const [live, setLive] = React.useState(() => source ? source.get() : "idle");
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!latest.current) return void 0;
    const read = () => setLive(latest.current ? latest.current.get() : "idle");
    read();
    return latest.current.subscribe(read);
  }, [sessionId, Boolean(source)]);
  const was = React.useRef(live);
  React.useEffect(() => {
    if (was.current === "running" && live === "idle" && !shown) setDone(true);
    if (live !== "idle") setDone(false);
    was.current = live;
  }, [live]);
  React.useEffect(() => {
    if (shown) setDone(false);
  }, [shown]);
  React.useEffect(() => setDone(false), [sessionId]);
  return live === "idle" && done ? "done" : live;
}
function CourseComposer(props) {
  const [text, setText] = React.useState("");
  const box = React.useRef(null);
  React.useEffect(() => {
    if (props.focus && box.current) box.current.focus();
  }, [props.focus]);
  const draftN = props.draft ? props.draft.n : null;
  React.useEffect(() => {
    if (!props.draft) return;
    const add = props.draft.text;
    setText((was) => (was.trim() ? was.replace(/\s+$/, "") + " " + add : add) + " ");
    if (box.current) box.current.focus();
  }, [draftN]);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight / 3)) + "px";
  }, [text]);
  const send2 = () => {
    const said = text.trim();
    if (!said) return;
    props.onSend(said + "\n\n(Asked from course mode — " + props.place + (props.runId ? ", run " + props.runId : "") + ".)");
    setText("");
  };
  return h(
    "form",
    {
      className: "pp-composer",
      "data-own-escape": text ? "" : void 0,
      onSubmit: (event) => {
        event.preventDefault();
        send2();
      }
    },
    h("textarea", {
      ref: box,
      rows: 1,
      value: text,
      placeholder: "Ask the assistant about " + props.place + " — or tell it what to change",
      "aria-label": "Message the session",
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Escape" && text) {
          setText("");
          return;
        }
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          send2();
        }
      }
    }),
    h(
      "button",
      { type: "submit", className: "pp-composersend", disabled: !text.trim(), title: "Send (Enter)", "aria-label": "Send" },
      "↑"
    )
  );
}
var chatWidth = (viewport) => Math.max(380, Math.min(520, Math.round(viewport * 0.32)));
var PLACE_MIN = 560;
function useChatBeside(wanted, left) {
  const [viewport, setViewport] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const width = chatWidth(viewport);
  const mode = !wanted ? "none" : viewport - left - width >= PLACE_MIN ? "side" : "swap";
  React.useLayoutEffect(() => {
    if (mode !== "side") return void 0;
    const pane = document.querySelector(".pp-root");
    let frame = null;
    for (let node = pane ? pane.parentElement : null; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).display === "grid" && node.children.length >= 3) {
        frame = node;
        break;
      }
    }
    if (frame === null) return void 0;
    const columns = Array.from(frame.children).slice(0, 3);
    const details = columns.find((column) => column.contains(pane));
    const nav = document.querySelector(".pp-nav, .pp-nav-rail");
    const sidebar = columns.find((column) => column !== details && nav && column.contains(nav)) || columns[0];
    const centre = columns.find((column) => column !== details && column !== sidebar);
    if (!details || !centre) return void 0;
    const follow = () => {
      const track = String(frame.style.gridTemplateColumns || "").trim().split(/\s+/)[0] || "";
      const side = /^\d+(\.\d+)?px$/.test(track) ? track : Math.round(sidebar.getBoundingClientRect().width) + "px";
      if (frame.style.getPropertyValue("--pp-side") !== side) frame.style.setProperty("--pp-side", side);
    };
    follow();
    frame.style.setProperty("--pp-chat", width + "px");
    centre.setAttribute("data-pp-col", "centre");
    details.setAttribute("data-pp-col", "details");
    const sideRight = sidebar.getBoundingClientRect().right;
    const handles = Array.from(frame.children).slice(3).filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.width <= 16 && rect.left > sideRight + 16;
    });
    for (const handle of handles) handle.setAttribute("data-pp-col", "handle");
    frame.setAttribute("data-pp-split", "");
    const observer = new MutationObserver(follow);
    observer.observe(frame, { attributes: true, attributeFilter: ["style"] });
    return () => {
      observer.disconnect();
      frame.removeAttribute("data-pp-split");
      centre.removeAttribute("data-pp-col");
      details.removeAttribute("data-pp-col");
      for (const handle of handles) handle.removeAttribute("data-pp-col");
      frame.style.removeProperty("--pp-side");
      frame.style.removeProperty("--pp-chat");
    };
  }, [mode, width]);
  return { mode, width };
}
function MaterialModal(props) {
  const close = props.onClose;
  const papers = Array.isArray(props.papers) && props.papers.length > 1 ? props.papers : [{ label: props.label, url: props.url, format: props.format }];
  const [index, setIndex] = React.useState(0);
  const [together, setTogether] = React.useState(false);
  const current = papers[Math.min(index, papers.length - 1)];
  const several = papers.length > 1;
  const frame = (paper, key) => h("iframe", {
    key,
    className: "pp-modalframe",
    src: paper.url,
    // Undefined omits the attribute, which is the whole point for a
    // PDF; see the table above.
    sandbox: MEDIA.has(paper.format) ? void 0 : "allow-same-origin",
    title: several ? props.label + " — " + paper.label : props.label
  });
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close();
        }
      },
      h(
        "div",
        {
          className: "pp-modal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": props.label,
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, props.label),
          several ? h(
            "div",
            { className: "pp-modaltabs", role: "group", "aria-label": "Versions" },
            papers.map(
              (paper, at) => h(
                "button",
                {
                  key: paper.url,
                  type: "button",
                  className: "pp-modaltab",
                  "aria-pressed": !together && at === index ? "true" : "false",
                  onClick: () => {
                    setIndex(at);
                    setTogether(false);
                  }
                },
                paper.label
              )
            ),
            h(
              "button",
              {
                type: "button",
                className: "pp-modaltab",
                "aria-pressed": together ? "true" : "false",
                title: "Every version at once",
                onClick: () => setTogether(!together)
              },
              "Side by side"
            )
          ) : null,
          // Name this in the composer, and let the professor type the
          // question. The alternative — a button that SENDS something —
          // would be the pane writing their sentence for them, and every
          // question worth asking about a brief is one it cannot guess.
          //
          // Rendered only when the composition actually provides the
          // draft-writing seam and this material has an identifier worth
          // carrying. A control that does nothing is worse than no control.
          props.mention && mentionOf(current.url, props.label) ? h(
            "button",
            {
              type: "button",
              className: "pp-modallink pp-chat",
              title: "Put this in the message box, then type your question",
              onClick: () => {
                if (props.mention(mentionOf(current.url, props.label))) close();
              }
            },
            "Ask about this ↩"
          ) : null,
          h(
            "a",
            {
              className: "pp-modallink",
              href: current.url,
              target: "_blank",
              rel: "noopener"
            },
            "Open in a tab ↗"
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-close",
              "aria-label": "Close " + props.label,
              onClick: close
            },
            "×"
          )
        ),
        together ? h(
          "div",
          { className: "pp-modalbody" },
          papers.map(
            (paper) => h(
              "div",
              { key: paper.url, className: "pp-modalpane" },
              h("div", { className: "pp-modalpanelabel" }, paper.label),
              frame(paper)
            )
          )
        ) : frame(current, current.url)
      )
    ),
    document.body
  );
}

// client/navigator.js
var PLACE_EVENT = "professor-pane:place";
var PENDING_MS = 4e3;
var pendingPlace = null;
var placeCount = 0;
function requestPlace(request) {
  placeCount += 1;
  pendingPlace = { ...request, n: placeCount, at: Date.now() };
  window.dispatchEvent(new CustomEvent(PLACE_EVENT, { detail: pendingPlace }));
}
function carryPlace(request) {
  placeCount += 1;
  pendingPlace = { ...request, n: placeCount, at: Date.now() };
  return pendingPlace;
}
function deliverCarried(carried) {
  if (pendingPlace === null || pendingPlace.n !== carried.n) return;
  window.dispatchEvent(new CustomEvent(PLACE_EVENT, { detail: pendingPlace }));
}
function takePendingPlace() {
  const found = pendingPlace;
  pendingPlace = null;
  return found !== null && Date.now() - found.at < PENDING_MS ? found : null;
}
function Icon2(props) {
  const size2 = props.size || 16;
  return h(
    "svg",
    {
      width: size2,
      height: size2,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    [].concat(props.d).map((d, index) => h("path", { d, key: index }))
  );
}
var ICONS2 = {
  weeks: ["M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z", "M4 10h16", "M8 3v4", "M16 3v4"],
  tasks: ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6l1 1 2-2", "M4 12l1 1 2-2", "M4 18l1 1 2-2"],
  students: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M3 20a6 6 0 0 1 12 0", "M16 4.5a3.5 3.5 0 0 1 0 6.5", "M18 14.5a6 6 0 0 1 3 5.5"],
  gradebook: ["M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z", "M4 10h16", "M4 15h16", "M10 4v16"],
  concepts: ["M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M5 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M10.5 8.5l-4 7", "M13.5 8.5l4 7"],
  materials: ["M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19.5v-14.5A1.5 1.5 0 0 1 7 3.5z", "M14 3.5v4h4", "M9 13h6", "M9 17h6"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  files: ["M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"],
  plug: ["M9 7V3", "M15 7V3", "M7 7h10v4a5 5 0 0 1-10 0z", "M12 16v5"],
  folders: ["M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z", "M10.5 14.5a2 2 0 1 0 0-.01", "M12 15.5l2 2"],
  plus: ["M12 5v14", "M5 12h14"],
  chevron: ["M8 10l4 4 4-4"],
  course: ["M12 4l9 4-9 4-9-4z", "M7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5"],
  held: ["M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19.5v-14.5A1.5 1.5 0 0 1 7 3.5z", "M14 3.5v4h4", "M12 11v4", "M12 18h.01"]
};
var PLACES = [
  { id: "weeks", label: "Weeks", hint: "The term, week by week — what is planned and what is missing", request: { mode: "planning" } },
  { id: "tasks", label: "Tasks", hint: "What is waiting for you, what is ready, what has not gone out", request: { view: "tasks" } },
  { id: "students", label: "Students", hint: "The class list, by subgroup", request: { view: "students" } },
  { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment", request: { view: "gradebook" } },
  { id: "concepts", label: "Concepts", hint: "The class, by concept", request: { view: "concepts" } },
  { id: "materials", label: "Materials", hint: "Assessments, slides, exams, the grading policy, the student's outline", request: { view: "materials" } },
  { id: "files", label: "Files", hint: "Scans and recordings: where they are, each pile", request: { view: "files" } }
];
var SETTINGS = { id: "settings", label: "Course settings", hint: "Integrations — Canvas, the grade sheet, GitHub — and the preferences the skills assume", request: { view: "settings" } };
function useShownPlace() {
  const [shown, setShown] = React.useState(null);
  React.useEffect(() => {
    const onShown = (event) => setShown(event.detail || null);
    window.addEventListener(PLACE_SHOWN_EVENT, onShown);
    return () => window.removeEventListener(PLACE_SHOWN_EVENT, onShown);
  }, []);
  return shown;
}
var isShown = (shown, entry) => shown !== null && (entry.request.view ? shown.view === entry.request.view : shown.view === null);
var visibleSession = (session, current, archived) => session !== void 0 && session.origin !== "subagent" && !archived.has(session.id) && (!session.blank || session.id === current);
var ago = (updatedAt, now) => {
  const minutes2 = Math.floor((now - updatedAt) / 6e4);
  if (!Number.isFinite(minutes2) || minutes2 < 1) return "now";
  if (minutes2 < 60) return minutes2 + "m";
  const hours = Math.floor(minutes2 / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days < 14 ? days + "d" : Math.floor(days / 7) + "w";
};
var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTHS2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var navDate = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return DAYS[date.getDay()] + " " + date.getDate() + " " + MONTHS2[date.getMonth()];
};
var shortTitle = (title) => {
  const text = String(title || "");
  const cut = text.split(/\s[-–—:]\s/)[0];
  return cut.length <= 28 ? cut : text.slice(0, 28) + "…";
};
var capital = (word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
var REMEMBERED = "professor-pane:navigator-workspace";
var remembered = () => {
  try {
    return window.localStorage.getItem(REMEMBERED);
  } catch {
    return null;
  }
};
var remember = (workspaceId) => {
  try {
    window.localStorage.setItem(REMEMBERED, workspaceId);
  } catch {
  }
};
function useNavigatorData(sessionId) {
  useWorkspaceWatch(sessionId);
  const revision = useVersion(AREAS.everything);
  const [state, setState] = React.useState({ sessionId: null, value: null });
  React.useEffect(() => {
    if (!sessionId) return void 0;
    let live = true;
    fetch(scoped(BASE + "/api/navigator", sessionId) + "&r=" + revision, { headers: { accept: "application/json" } }).then((response) => response.json()).then((value) => {
      if (live) setState({ sessionId, value });
    }).catch((error) => {
      if (live) setState({ sessionId, value: { error: String(error.message || error) } });
    });
    return () => {
      live = false;
    };
  }, [sessionId, revision]);
  return state.value;
}
function Row(props) {
  return h(
    "button",
    {
      type: "button",
      className: "pp-nav-row",
      title: props.hint,
      "aria-current": props.current ? "true" : void 0,
      onClick: props.onClick
    },
    props.icon ? h(Icon2, { d: ICONS2[props.icon] }) : null,
    props.dot ? h("span", { className: "pp-nav-dot", title: "Working" }) : null,
    h("span", { className: "pp-nav-text" }, props.label),
    props.badge ? h("span", { className: "pp-nav-badge", title: props.badgeHint }, props.badge) : null,
    props.meta ? h("span", { className: "pp-nav-meta" }, props.meta) : null
  );
}
function CourseBlock(props) {
  const [open2, setOpen] = React.useState(false);
  const run2 = props.run;
  const weekText = run2 && run2.current_week ? "week " + run2.current_week + " of " + run2.weeks : null;
  const sub = run2 ? [run2.course_id, run2.term, weekText].filter(Boolean).join(" · ") : props.subtitle;
  return h(
    "div",
    { style: { position: "relative" } },
    h(
      "button",
      {
        type: "button",
        className: "pp-nav-course",
        "aria-haspopup": "menu",
        "aria-expanded": open2,
        title: "Switch course",
        onClick: () => setOpen((value) => !value)
      },
      h(
        "span",
        { className: "pp-nav-coursetitle" },
        h("span", null, run2 ? run2.title : props.fallbackTitle),
        h(Icon2, { d: ICONS2.chevron, size: 14 })
      ),
      sub ? h("span", { className: "pp-nav-coursesub" }, sub) : null,
      run2 && run2.current_week && run2.weeks ? h(
        "span",
        { className: "pp-nav-bar", "aria-hidden": "true" },
        h("i", { style: { width: Math.min(100, Math.round(run2.current_week / run2.weeks * 100)) + "%" } })
      ) : null
    ),
    open2 ? h(
      "div",
      { className: "pp-nav-menu", role: "menu", onMouseLeave: () => setOpen(false) },
      props.workspaces.map(
        (workspace) => h(Row, {
          key: workspace.workspaceId,
          icon: "course",
          label: workspace.title || workspace.path,
          current: workspace.workspaceId === props.workspaceId,
          hint: workspace.path,
          onClick: () => {
            setOpen(false);
            props.onPick(workspace.workspaceId);
          }
        })
      )
    ) : null
  );
}
function ThisWeek(props) {
  const week = props.week;
  const open2 = () => requestPlace({ mode: "teaching", run: props.runId });
  if (!week) return null;
  const lines = [];
  for (const meeting of week.meetings) {
    lines.push(
      h(
        "button",
        { type: "button", className: "pp-nav-row pp-nav-line", key: "m" + lines.length, onClick: open2, title: meeting.title },
        h("span", { className: "pp-nav-text" }, capital(meeting.type) + " · " + meeting.title),
        meeting.deck ? null : h("span", { className: "pp-nav-badge" }, "no deck"),
        h("span", { className: "pp-nav-meta" }, navDate(meeting.on) || "no date")
      )
    );
  }
  for (const work of week.due) {
    lines.push(
      h(
        "button",
        { type: "button", className: "pp-nav-row pp-nav-line", key: "d" + lines.length, onClick: open2, title: work.title },
        h("span", { className: "pp-nav-text" }, shortTitle(work.title) + " due"),
        h("span", { className: "pp-nav-meta" }, navDate(work.due_on) || "no date")
      )
    );
  }
  if (!week.due.length && props.nextDue) {
    lines.push(h("div", { className: "pp-nav-quiet", key: "next" }, "Nothing due · next in week " + props.nextDue.week));
    for (const work of props.nextDue.due.slice(0, 3)) {
      lines.push(
        h(
          "button",
          { type: "button", className: "pp-nav-row pp-nav-line", key: "n" + lines.length, onClick: open2, title: work.title },
          h("span", { className: "pp-nav-text" }, shortTitle(work.title)),
          h("span", { className: "pp-nav-meta" }, navDate(work.due_on) || "no date")
        )
      );
    }
  }
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pp-nav-label" },
      h("span", null, "This week" + (week.modules.length ? " · " + week.modules[0] : ""))
    ),
    h("div", { className: "pp-nav-week" }, lines.length ? lines : h("div", { className: "pp-nav-quiet" }, "Nothing scheduled"))
  );
}
function HeldPapers(props) {
  if (!props.piles.length) return null;
  return h(
    React.Fragment,
    null,
    h("div", { className: "pp-nav-label" }, h("span", null, "Held papers")),
    props.piles.map(
      (pile) => h(Row, {
        key: pile.assessment_id,
        icon: "held",
        label: shortTitle(pile.title),
        hint: pile.title + " — " + pile.held + (pile.held === 1 ? " scanned paper is" : " scanned papers are") + " placed on nobody yet. Say who in Scans.",
        badge: String(pile.held),
        badgeHint: pile.held + " not placed on a student",
        onClick: () => props.onOpen(pile.assessment_id)
      })
    )
  );
}
function Chats(props) {
  const [all, setAll] = React.useState(false);
  const now = Date.now();
  const shown = all ? props.sessions : props.sessions.slice(0, 6);
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pp-nav-label" },
      h("span", null, "Chats"),
      h(
        "button",
        { type: "button", className: "pp-nav-icon", title: "New chat in this course", "aria-label": "New chat in this course", onClick: props.onNew },
        h(Icon2, { d: ICONS2.plus, size: 14 })
      )
    ),
    shown.map(
      (session) => h(Row, {
        key: session.id,
        label: session.blank ? "New chat" : session.displayTitle,
        hint: session.blank ? "New chat" : session.displayTitle,
        current: session.id === props.current,
        dot: session.running,
        meta: session.blank ? null : ago(session.updatedAt, now),
        onClick: () => props.onOpen(session.id)
      })
    ),
    props.sessions.length > shown.length ? h(Row, { label: "All " + props.sessions.length + " chats", onClick: () => setAll(true) }) : null,
    !props.sessions.length ? h("div", { className: "pp-nav-quiet" }, "No chats in this course yet") : null
  );
}
function CourseNavigator(props) {
  const list = props.useSessions((state) => state);
  const workspaces = props.useWorkspaces((state) => state.items) || [];
  const archivedIds = props.useWorkspaces((state) => state.archivedSessionIds);
  const archived = React.useMemo(() => new Set(archivedIds || []), [archivedIds]);
  const current = list.current;
  const holding = current === void 0 ? void 0 : workspaces.find((workspace2) => workspace2.sessionIds.includes(current));
  const workspace = holding || workspaces.find((entry) => entry.workspaceId === remembered()) || workspaces[0] || null;
  React.useEffect(() => {
    if (workspace) remember(workspace.workspaceId);
  }, [workspace ? workspace.workspaceId : null]);
  const sessionId = workspace ? holding ? current : workspace.sessionIds.find((id) => list.byId[id] !== void 0) || null : null;
  const data = useNavigatorData(sessionId);
  const shown = useShownPlace();
  const run2 = data && !data.error ? data.run : null;
  const sessions = React.useMemo(() => {
    if (!workspace) return [];
    return workspace.sessionIds.map((id) => list.byId[id]).filter((session) => visibleSession(session, current, archived)).sort((a, b) => b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1);
  }, [workspace, list, current, archived]);
  const pick = (workspaceId) => {
    remember(workspaceId);
    props.startSession(workspaceId);
  };
  const place = (request) => {
    if (!holding && workspace) props.startSession(workspace.workspaceId);
    requestPlace({ ...request, run: run2 ? run2.run_id : null });
  };
  const carry = (fresh) => {
    if (shown === null) return;
    carryPlace({ mode: shown.mode, view: shown.view, chat: !fresh, compose: Boolean(fresh), run: run2 ? run2.run_id : null });
  };
  const openChat = (sessionId2) => {
    if (sessionId2 !== current) carry(false);
    props.open(sessionId2);
  };
  const newChat = () => {
    if (!workspace) return;
    carry(true);
    props.startSession(workspace.workspaceId);
  };
  const pending = data && data.grading ? data.grading.pending : 0;
  const gaps = data && !data.error ? data.gaps : 0;
  const heldPiles = data && !data.error && Array.isArray(data.held) ? data.held : [];
  const held = heldPiles.reduce((sum, pile) => sum + pile.held, 0);
  const openPile = (assessmentId) => place({ view: "files", scans: assessmentId });
  const badgeOf = (id) => id === "weeks" && gaps ? { badge: gaps + (gaps === 1 ? " gap" : " gaps"), hint: gaps + " weeks have something missing" } : id === "tasks" && pending ? { badge: String(pending), hint: pending + " suggested marks wait for your decision" } : id === "files" && held ? { badge: held + " held", hint: held + " scanned papers are placed on nobody yet" } : { badge: null, hint: null };
  if (!props.wide) {
    return h(
      "div",
      { className: "pp-nav-rail" },
      h(
        "button",
        { type: "button", className: "pp-nav-mono", title: run2 ? run2.title : "Courses", onClick: props.expandSidebar },
        run2 ? run2.course_id.replace(/[^A-Z]/g, "").slice(0, 3) || "C" : "C"
      ),
      PLACES.map(
        (entry) => h(
          "button",
          {
            type: "button",
            key: entry.id,
            className: "pp-nav-icon",
            title: entry.label,
            "aria-label": entry.label,
            "aria-current": isShown(shown, entry) ? "true" : void 0,
            onClick: () => place(entry.request)
          },
          h(Icon2, { d: ICONS2[entry.id], size: 18 }),
          badgeOf(entry.id).badge ? h("span", { className: "pp-nav-pip", "aria-hidden": "true" }) : null
        )
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-nav-icon",
          title: "New chat in this course",
          "aria-label": "New chat in this course",
          onClick: newChat
        },
        h(Icon2, { d: ICONS2.plus, size: 18 })
      )
    );
  }
  const notCourse = data && data.error ? data.error : null;
  return h(
    "div",
    { className: "pp-nav" },
    h(
      "div",
      { className: "pp-nav-scroll" },
      workspaces.length ? h(CourseBlock, {
        run: run2,
        workspaces,
        workspaceId: workspace ? workspace.workspaceId : null,
        fallbackTitle: workspace ? workspace.title || workspace.path : "Courses",
        subtitle: notCourse ? "Not a course folder" : data ? data.run ? null : "No course run in this folder yet" : "Reading the course…",
        onPick: pick
      }) : h("div", { className: "pp-nav-quiet" }, "Add a course folder with Folders and search, below."),
      run2 ? h(ThisWeek, { week: data.week, nextDue: data.next_due, runId: run2.run_id }) : null,
      run2 ? h(HeldPapers, { piles: heldPiles, onOpen: openPile }) : null,
      run2 ? h("div", { className: "pp-nav-label" }, h("span", null, "Course")) : null,
      run2 ? PLACES.map((entry) => {
        const badge = badgeOf(entry.id);
        return h(Row, {
          key: entry.id,
          icon: entry.id,
          label: entry.label,
          hint: entry.hint,
          current: isShown(shown, entry),
          badge: badge.badge,
          badgeHint: badge.hint,
          onClick: () => place(entry.request)
        });
      }) : null,
      workspace ? h(Chats, {
        sessions,
        current,
        onOpen: openChat,
        onNew: newChat
      }) : null
    ),
    h(
      "div",
      { className: "pp-nav-foot" },
      run2 ? h(Row, {
        icon: SETTINGS.id,
        label: SETTINGS.label,
        hint: SETTINGS.hint,
        current: isShown(shown, SETTINGS),
        onClick: () => place(SETTINGS.request)
      }) : null,
      h(Row, {
        icon: "folders",
        label: "Folders and search",
        hint: "The harness's own list: every folder, search, rename, archive",
        onClick: props.showStock
      })
    )
  );
}
function NavigatorReturn(props) {
  return h(
    "button",
    {
      type: "button",
      className: props.wide ? "pp-nav-row" : "pp-nav-icon",
      title: "Back to the course navigator",
      "aria-label": "Course view",
      onClick: props.showNavigator
    },
    h(Icon2, { d: ICONS2.course, size: props.wide ? 16 : 18 }),
    props.wide ? h("span", { className: "pp-nav-text" }, "Course view") : null
  );
}

// client/inspector.js
function useKept(url) {
  const [value, setValue] = React.useState(null);
  React.useEffect(() => {
    if (url === null) return void 0;
    let live = true;
    fetch(url, { headers: { accept: "application/json" } }).then((response) => response.json()).then((answer) => {
      if (live) setValue(answer);
    }).catch((error) => {
      if (live) setValue({ error: String(error.message || error) });
    });
    return () => {
      live = false;
    };
  }, [url]);
  return value;
}
var since = (iso, now) => ago(Date.parse(iso), now);
var PLACE_OF = {
  assessments: { view: "materials", sub: "assessments" },
  modules: { mode: "planning" },
  activities: { mode: "planning" },
  evaluations: { view: "gradebook" },
  submissions: { view: "gradebook" },
  concepts: { view: "concepts" },
  documents: { view: "materials", sub: "slides" },
  resources: { view: "materials", sub: "slides" }
};
function Section(props) {
  return h(
    "section",
    { className: "pp-insp-section" },
    h("div", { className: "pp-insp-label" }, h("span", null, props.label), props.action || null),
    props.children
  );
}
function Line(props) {
  return h(
    "button",
    { type: "button", className: "pp-insp-line", title: props.hint, onClick: props.onClick },
    h("span", { className: "pp-insp-text" }, props.text),
    props.badge ? h("span", { className: "pp-nav-badge" }, props.badge) : null,
    props.meta ? h("span", { className: "pp-insp-meta" }, props.meta) : null
  );
}
function Inspector(props) {
  const nav = useKept(
    scoped(BASE + "/api/navigator?run=" + encodeURIComponent(props.runId) + "&r=" + props.revision, props.sessionId)
  );
  const recent = useKept(scoped(BASE + "/api/recent?r=" + props.revision, props.sessionId));
  const mention = (text) => {
    if (props.mention) props.mention(text);
  };
  const now = Date.now();
  const pending = nav && nav.grading ? nav.grading.pending : 0;
  const signals = nav && nav.grading ? nav.grading.signals : 0;
  const gaps = nav && !nav.error ? nav.gaps || 0 : 0;
  const draftKinds = recent && !recent.error ? recent.drafts_by || [] : [];
  const waiting2 = [
    pending ? { text: pending + (pending === 1 ? " mark waits" : " marks wait") + " for your decision", place: { view: "tasks" } } : null,
    // Drafts by kind, the three largest: what is a draft matters more than how many.
    ...draftKinds.slice(0, 3).map((kind) => ({
      text: kind.count + " " + kind.collection.replace(/[-_]/g, " ") + " still " + (kind.count === 1 ? "a draft" : "drafts"),
      place: { view: "tasks", sub: "ready" }
    })),
    gaps ? { text: gaps + (gaps === 1 ? " week has" : " weeks have") + " something missing", place: { mode: "planning" } } : null,
    signals ? { text: signals + (signals === 1 ? " open signal" : " open signals"), place: { view: "tasks" } } : null
  ].filter(Boolean);
  const changes = recent && !recent.error ? recent.recent : [];
  return h(
    "div",
    { className: "pp-insp" },
    h(
      Section,
      { label: "Waiting" },
      waiting2.length ? waiting2.map(
        (entry, index) => h(Line, { key: index, text: entry.text, onClick: () => props.openPlace(entry.place), hint: "Open it in the centre" })
      ) : h("div", { className: "pp-insp-quiet" }, nav ? "Nothing is waiting for you" : "Reading the course…")
    ),
    h(
      Section,
      { label: "Recent changes" },
      changes.length ? changes.map((change) => {
        const place = PLACE_OF[change.collection];
        return h(
          "div",
          { className: "pp-insp-change", key: change.path },
          h(Line, {
            text: change.records ? change.collection + " · " + change.records + " records" : change.title || change.id || change.path.split("/").pop(),
            badge: change.draft ? "draft" : null,
            meta: since(change.changed_at, now),
            hint: change.path + " — put it into the message box",
            onClick: () => mention(change.path)
          }),
          place ? h(
            "button",
            {
              type: "button",
              className: "pp-insp-act",
              title: "Open where it is drawn",
              onClick: () => props.openPlace(place)
            },
            "Open"
          ) : null
        );
      }) : h("div", { className: "pp-insp-quiet" }, recent ? "No records yet" : "Reading the course…")
    )
  );
}

// client/scans-queue.js
var placementKey = (assessment, file, pages) => assessment + "|" + (file || "") + "|" + pages;
var waiting = [];
var running = null;
var snapshot = { running: null, queued: [] };
var listeners3 = /* @__PURE__ */ new Set();
var publish = () => {
  snapshot = { running: running ? running.key : null, queued: waiting.map((job) => job.key) };
  for (const listener of listeners3) listener(snapshot);
};
var pump = () => {
  if (running || !waiting.length) return;
  running = waiting.shift();
  publish();
  const job = running;
  fetch(
    scoped(
      BASE + "/api/scans/assign?run=" + encodeURIComponent(job.runId) + "&assessment=" + encodeURIComponent(job.assessment),
      job.sessionId
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ pages: job.pages, file: job.file }, job.answer))
    }
  ).then((response) => response.json()).catch((error) => ({ error: String(error) })).then((result) => {
    running = null;
    publish();
    try {
      if (job.onDone) job.onDone(result);
    } finally {
      pump();
    }
  });
};
function enqueuePlacement(job) {
  const key = placementKey(job.assessment, job.file, job.pages);
  if (running && running.key === key || waiting.some((entry) => entry.key === key)) return false;
  waiting.push(Object.assign({}, job, { key }));
  publish();
  pump();
  return true;
}
var placementsNow = () => snapshot;
var placementsWaiting = (state = snapshot) => state.running !== null || state.queued.length > 0;
function usePlacements() {
  const [state, setState] = React.useState(snapshot);
  React.useEffect(() => {
    listeners3.add(setState);
    setState(snapshot);
    return () => {
      listeners3.delete(setState);
    };
  }, []);
  return state;
}
function onPlacements(listener) {
  listeners3.add(listener);
  return () => listeners3.delete(listener);
}

// client/publish.js
var PUBLISH_TARGETS = [
  {
    id: "page",
    label: "Course page",
    hint: "The week plan students read, with the approved materials beside it, written to dist/pages/"
  },
  {
    id: "telegram",
    label: "Telegram",
    hint: "One plain-text announcement to the run's channel. It cannot be recalled"
  },
  {
    id: "homework",
    label: "Homework repo",
    hint: "The starter repository on GitHub, for one assessment"
  },
  {
    id: "canvas",
    label: "Canvas brief",
    hint: "One assessment's definition — title, points, dates, the brief. Never the marks"
  },
  {
    id: "update",
    label: "Update everywhere",
    hint: "Every destination this run has already been published to, and no new ones. An announcement is not among them: it cannot be re-derived, only corrected"
  }
];
var CONFIRM_LABEL = {
  page: "Write the page",
  telegram: "Send to the channel",
  homework: "Publish to GitHub",
  canvas: "Send to Canvas",
  update: "Update every destination"
};
function PublishModal(props) {
  const close = props.onClose;
  const state = props.state;
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);
  const busy = state.phase === "running";
  const needsAssessment = state.target === "homework" || state.target === "canvas";
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close();
        }
      },
      h(
        "div",
        {
          className: "pp-modal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Publish " + state.label,
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h(
            "div",
            { className: "pp-modaltitle" },
            state.label ? "Publish " + state.label : "Publish"
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-close",
              "aria-label": "Close",
              onClick: close
            },
            "×"
          )
        ),
        h(
          "div",
          { className: "pp-publishbody" },
          // Which of the four. Radio-shaped rather than four dialogs,
          // because "put this in front of the class" is one intention and
          // the professor should not have to know which menu it is under.
          h(
            "div",
            { className: "pp-approverow" },
            PUBLISH_TARGETS.map(
              (entry) => h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": state.target === entry.id,
                  title: entry.hint,
                  disabled: busy,
                  onClick: () => props.setTarget(entry.id),
                  key: entry.id
                },
                entry.label
              )
            )
          ),
          needsAssessment ? h("input", {
            type: "text",
            className: "pp-input",
            placeholder: "ASSESSMENT-04",
            value: state.assessment,
            disabled: busy,
            "aria-label": "Assessment id",
            onChange: (event) => props.setField("assessment", event.target.value)
          }) : null,
          state.target === "telegram" ? h(
            React.Fragment,
            null,
            h("textarea", {
              className: "pp-publishtext",
              placeholder: "Homework 3 is open. It is due Friday at 18:00 and counts for 10%.",
              value: state.message,
              disabled: busy,
              "aria-label": "The announcement, exactly as students will read it",
              onChange: (event) => props.setField("message", event.target.value)
            }),
            h(
              "p",
              { className: "pp-publishcount" },
              state.message.length + " / 4096 characters. This is sent as typed — the command composes nothing."
            ),
            // Off by default, and that is the safeguard rather than a
            // preference: a second announcement is the ordinary case,
            // and a press that silently rewrote the first would
            // destroy something students had already read.
            h(
              "label",
              { className: "pp-publishcount" },
              h("input", {
                type: "checkbox",
                checked: state.edit === true,
                disabled: busy,
                onChange: (event) => props.setField("edit", event.target.checked)
              }),
              " correct the last announcement instead of posting a new one"
            )
          ) : null,
          h(
            "div",
            { className: "pp-approverow" },
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: busy,
                title: "Show what would be published, and which drafts would be left out. Writes nothing, here or anywhere else.",
                onClick: () => props.run(false)
              },
              busy ? "Working…" : "Check what would be published"
            ),
            state.phase === "preview" ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn pp-danger",
                title: "Publish what has been accepted. Records still marked approval: draft are left out.",
                onClick: () => props.run(true)
              },
              state.target === "telegram" && state.edit ? "Correct the message in the channel" : CONFIRM_LABEL[state.target]
            ) : null,
            state.target === "homework" ? h("input", {
              type: "text",
              className: "pp-input",
              placeholder: "owner/name, if not recorded",
              value: state.repo,
              disabled: busy,
              "aria-label": "Repository",
              onChange: (event) => props.setField("repo", event.target.value)
            }) : null,
            state.target === "canvas" ? h("input", {
              type: "text",
              className: "pp-input",
              placeholder: "every subgroup",
              value: state.group,
              disabled: busy,
              "aria-label": "Subgroup",
              onChange: (event) => props.setField("group", event.target.value)
            }) : null
          ),
          state.phase === "idle" ? h(
            "p",
            { className: "pp-publishhint" },
            "Nothing has been read or written yet. Check first; publishing is the second press. Anything still marked approval: draft is left out."
          ) : h(
            "pre",
            {
              className: "pp-publishout" + (state.phase === "error" ? " pp-approveerr" : "")
            },
            state.text
          )
        )
      )
    ),
    document.body
  );
}

// client/grade-board.js
function GradeBoard(props) {
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  const [at, setAt] = React.useState(0);
  const [busy, setBusy] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [focus, setFocus] = React.useState(0);
  const [big, setBig] = React.useState(null);
  const [notes, setNotes] = React.useState({});
  const [openGroups, setOpenGroups] = React.useState({});
  const [comparing, setComparing] = React.useState(false);
  const [showRubric, setShowRubric] = React.useState(false);
  React.useEffect(() => {
    let last = null;
    let live = true;
    const check = () => fetch(scoped(BASE + "/api/grade/stamp?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId), props.sessionId)).then((response) => response.json()).then((value) => {
      if (!live || value.error) return;
      if (last !== null && value.groups !== last) setTick((count) => count + 1);
      last = value.groups;
    }).catch(() => {
    });
    check();
    const timer = setInterval(check, 3e3);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [props.runId, props.assessmentId, props.sessionId]);
  const close = props.onClose;
  const url = (path) => scoped(
    BASE + path + "?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId),
    props.sessionId
  );
  React.useEffect(() => {
    let live = true;
    fetch(url("/api/grade") + (props.names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
      headers: { accept: "application/json" }
    }).then((response) => response.json()).then((value) => live && setState({ phase: "ready", value })).catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, props.assessmentId, props.names, props.revision, tick]);
  React.useEffect(() => {
    const onKey2 = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        if (big) setBig(null);
        else close();
      }
    };
    window.addEventListener("keydown", onKey2, true);
    return () => window.removeEventListener("keydown", onKey2, true);
  }, [close, busy, big]);
  React.useEffect(() => {
    const node = document.querySelector(".pp-gcard.pp-focus");
    if (node && document.activeElement && document.activeElement.tagName !== "INPUT") node.focus({ preventScroll: false });
  }, [focus, at, tick, state.phase]);
  const post = (path, body, label2) => {
    if (busy) return;
    setBusy(label2);
    setSaid(null);
    fetch(url(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((response) => response.json()).then((result) => {
      setBusy(null);
      const stale2 = /no route \/api\/grade/.test(String(result.error || ""));
      const failed = Boolean(result.error) || !result.ok;
      setSaid(
        failed ? { error: true, text: stale2 ? "The harness was started before grading existed. Restart it, then try again." : result.error || result.output } : { error: false, text: String(result.output || "Done.").split("\n").filter((line) => !/^wrote /.test(line)).join(" ") }
      );
      setTick((value) => value + 1);
      props.onWrite();
    }).catch((error) => {
      setBusy(null);
      setSaid({ error: true, text: String(error) });
    });
  };
  const doc = state.value;
  const shell = (title, body, foot) => ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        }
      },
      h(
        "div",
        { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Grade " + props.title },
        h(
          "div",
          { className: "pp-modalhead pp-ghead" },
          h("div", { className: "pp-modaltitle" }, title),
          doc && doc.items ? doc.items.map(
            (item2, index) => h(
              "button",
              {
                type: "button",
                key: item2.item_id,
                className: "pp-gq" + (index === at ? " pp-gq-on" : "") + (doc.rubric !== "accepted" && !item2.criterion ? " pp-gq-missing" : ""),
                title: doc.rubric !== "accepted" && !item2.criterion ? "No rubric chosen for this question yet" : void 0,
                onClick: () => {
                  setAt(index);
                  setFocus(0);
                }
              },
              "Q" + (item2.number || index + 1),
              h("span", null, " " + item2.counts.decided + "/" + item2.counts.answers)
            )
          ) : null,
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: Boolean(busy), onClick: close }, "×")
        ),
        said ? h("pre", { className: "pp-approveout pp-gsaid" + (said.error ? " pp-approveerr" : "") }, said.text) : null,
        body,
        foot ? h("div", { className: "pp-reviewfoot" }, foot) : null
      )
    ),
    document.body
  );
  if (state.phase === "loading") return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "Reading the answers…")));
  if (doc.error) {
    return shell(
      "Grade · " + props.title,
      h(
        "div",
        { className: "pp-review" },
        h(Message, { error: true }, /no route \/api\/grade/.test(doc.error) ? "The harness was started before grading existed. Restart it to grade here." : doc.error)
      )
    );
  }
  if (!doc.items.length) {
    return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "This assessment has no written questions to grade.")));
  }
  if (doc.items.some((entry) => !entry.marks || !entry.proposals)) {
    return shell(
      "Grade · " + props.title,
      h("div", { className: "pp-review" }, h(Message, { error: true }, "The harness is older than this view. Restart the harness, then open grading again."))
    );
  }
  const item = doc.items[Math.min(at, doc.items.length - 1)];
  const who = (student) => doc.names && doc.people[student] ? doc.people[student] + " · " + student : student;
  const pageUrl = (answer) => url("/api/grade/page") + "&student=" + encodeURIComponent(answer.student) + "&page=" + encodeURIComponent(answer.page || 1) + (doc.names ? "&names=1" : "");
  const max = item.maximum_score;
  const scale = item.criterion && item.criterion.levels.length ? item.criterion.levels.map((level) => level.score).sort((a, b) => a - b) : (() => {
    const step = max <= 4 ? 0.5 : 1;
    const out = [];
    for (let value = 0; value <= max + 1e-9; value += step) out.push(Math.round(value * 2) / 2);
    return out;
  })();
  const label = (value) => Number.isInteger(value) ? String(value) : String(value).replace(/\.5$/, "½").replace(/^0½$/, "½");
  const levelOf = (score) => item.criterion ? item.criterion.levels.find((level) => level.score === score) : null;
  const guidance = item.marking_guidance ? h("details", { className: "pp-gguide" }, h("summary", null, "Marking guidance"), h("div", null, item.marking_guidance)) : null;
  const question = h(
    "div",
    { className: "pp-gquestion" },
    h("b", null, "Q" + (item.number || at + 1) + ". "),
    item.prompt,
    h("span", { className: "pp-as" }, "  " + label(max) + " mark" + (max === 1 ? "" : "s")),
    guidance
  );
  const answerText = (answer) => answer.unread ? h("div", { className: "pp-gtext pp-gmuted" }, "Not read yet — the page is the only record of this answer.") : answer.blank ? h("div", { className: "pp-gtext pp-gmuted" }, "Nothing written.") : h("div", { className: "pp-gtext" }, answer.text);
  const itemState = !item.criterion ? "none" : doc.rubric === "accepted" ? "accepted" : "draft";
  const qName = "Q" + (item.number || at + 1);
  const without = doc.items.filter((entry) => !entry.criterion).map((entry, index) => "Q" + (entry.number || index + 1));
  const ask = (several) => "/import-assessment " + props.assessmentId + " " + props.runId + " — " + (several ? "propose the rubric" : "propose one rubric");
  const compare = () => {
    const answered = item.counts.answers - item.counts.unread - item.counts.blank;
    return h(
      "div",
      { className: "pp-gcompare" },
      item.proposals.map((proposal) => {
        const mine = item.chosen === proposal.id;
        const everywhere = doc.items.every((entry) => entry.proposals.some((other) => other.id === proposal.id));
        return h(
          "div",
          { className: "pp-gprop" + (mine ? " pp-gprop-on" : ""), key: proposal.id },
          h("div", { className: "pp-gprophead" }, h("b", null, proposal.title), mine ? h("span", { className: "pp-gstate" }, "in use") : null),
          proposal.summary ? h("div", { className: "pp-as" }, proposal.summary) : null,
          h(
            "div",
            { className: "pp-gmean" },
            proposal.spread.mean === null ? "nothing placed" : "class mean " + proposal.spread.mean + " / " + label(max),
            h("span", null, " · " + proposal.spread.placed + " of " + answered + " answers placed")
          ),
          proposal.levels.map((level) => {
            const count = proposal.spread.at[String(level.score)] || 0;
            const names = item.groups.filter((group) => proposal.scores[group.index] === level.score);
            return h(
              "div",
              { className: "pp-gplevel", key: level.score },
              h(
                "div",
                { className: "pp-gplevelhead" },
                h("b", null, label(level.score)),
                h("span", { className: "pp-gbar" }, h("span", { style: { width: Math.round(count / Math.max(1, answered) * 100) + "%" } })),
                h("span", { className: "pp-as" }, String(count))
              ),
              h("div", { className: "pp-gpdesc" }, level.description),
              names.length ? h(
                "div",
                { className: "pp-gpgroups" },
                names.map(
                  (group) => h(
                    "span",
                    { key: group.index, className: proposal.unsure.indexOf(group.index) !== -1 ? "pp-gpunsure" : "" },
                    group.label + " (" + group.count + ")"
                  )
                )
              ) : null
            );
          }),
          h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              {
                type: "button",
                className: mine ? "pp-segbtn" : "pp-primary",
                disabled: Boolean(busy) || item.counts.decided > 0,
                title: item.counts.decided ? qName + " already has marks decided against its rubric" : "Write this as " + qName + "'s rubric, as a draft to review",
                onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id }, "choose")
              },
              busy === "choose" ? "Writing…" : mine ? "Use again for " + qName : "Use for " + qName
            ),
            everywhere && doc.items.length > 1 ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy) || doc.items.some((entry) => entry.counts.decided > 0),
                onClick: () => post("/api/grade/choose", { proposal: proposal.id }, "choose")
              },
              "Use for every question"
            ) : null
          )
        );
      })
    );
  };
  const missingBar = () => {
    const rest = doc.items.filter((entry) => !entry.criterion);
    const same = item.chosen ? item.proposals.find((proposal) => proposal.id === item.chosen) : null;
    const coversRest = same && rest.every((entry) => entry.proposals.some((proposal) => proposal.id === same.id));
    return h(
      "div",
      { className: "pp-gmissing" },
      h("span", null, without.join(", ") + (without.length === 1 ? " still needs" : " still need") + " a rubric before the quiz's rubric can be accepted."),
      coversRest ? h(
        "button",
        {
          type: "button",
          className: "pp-primary",
          disabled: Boolean(busy) || rest.some((entry) => entry.counts.decided > 0),
          onClick: () => post("/api/grade/choose", { proposal: same.id, items: rest.map((entry) => entry.item_id) }, "choose")
        },
        busy === "choose" ? "Writing…" : "Use “" + same.title + "” for " + without.join(", ")
      ) : null,
      rest.map(
        (entry) => h(
          "button",
          {
            type: "button",
            key: entry.item_id,
            className: "pp-segbtn",
            onClick: () => {
              setAt(doc.items.indexOf(entry));
              setFocus(0);
            }
          },
          "Choose for Q" + (entry.number || doc.items.indexOf(entry) + 1)
        )
      )
    );
  };
  if (itemState === "none") {
    const proposed = item.proposals.length > 0;
    return shell(
      "Grade · " + props.title + (proposed ? " · choose a rubric" : " · no rubric yet"),
      h(
        "div",
        { className: "pp-review" },
        question,
        h(
          "div",
          { className: "pp-gnone" },
          h(
            "div",
            null,
            proposed ? item.proposals.length + " rubrics proposed for " + qName + " over the same groups of answers. Pick one to review; you accept it afterwards." : "Nothing to grade against yet. Group the answers and propose levels — or mark by points, without a rubric."
          ),
          h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              { type: "button", className: (proposed ? "pp-segbtn" : "pp-primary") + " pp-chat", disabled: Boolean(busy), onClick: () => {
                props.ask(ask(true));
                close();
              } },
              proposed ? "Ask for other rubrics" : "Ask the assistant to propose rubrics"
            ),
            !proposed ? h(
              "button",
              { type: "button", className: "pp-segbtn pp-chat", disabled: Boolean(busy), onClick: () => {
                props.ask(ask(false));
                close();
              } },
              "Just one rubric"
            ) : null,
            doc.rubric === "none" && !doc.items.some((entry) => entry.criterion) ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy),
                title: "One criterion per question, worth its marks, accepted now — then 0…" + label(max) + " buttons on every answer",
                onClick: () => post("/api/grade/points-only", {}, "points")
              },
              busy === "points" ? "Writing…" : "Grade by points only"
            ) : null
          )
        ),
        proposed ? compare() : null,
        !proposed ? [
          h("div", { className: "pp-reviewsec", key: "sec" }, "The answers", h("span", null, item.counts.answers - item.counts.unread - item.counts.blank + " written · " + item.counts.blank + " blank · " + item.counts.unread + " not read yet")),
          item.answers.filter((answer) => !answer.unread && !answer.blank).map((answer) => h("div", { className: "pp-gplain", key: answer.student }, h("div", { className: "pp-gwho" }, who(answer.student)), answerText(answer)))
        ] : null
      )
    );
  }
  if (itemState === "draft") {
    const levels = item.criterion && item.criterion.levels.length ? item.criterion.levels : scale.slice().reverse().map((score) => ({ score, label: null, description: "" }));
    const placedAt = (score) => item.groups.filter((group) => group.score === score);
    const unplaced = item.groups.filter((group) => group.score === null || !levels.some((level) => level.score === group.score));
    const groupChip = (group) => {
      const open2 = openGroups[item.item_id + "|" + group.index];
      const members = item.answers.filter((answer) => answer.group === group.index);
      return h(
        "div",
        { className: "pp-ggroup" + (group.unsure ? " pp-ggroup-unsure" : ""), key: group.index },
        h(
          "div",
          { className: "pp-ggrouphead" },
          h(
            "button",
            {
              type: "button",
              className: "pp-glink",
              onClick: () => setOpenGroups((current2) => Object.assign({}, current2, { [item.item_id + "|" + group.index]: !open2 }))
            },
            (open2 ? "▾ " : "▸ ") + group.label
          ),
          h("span", { className: "pp-as" }, group.count + (group.unsure ? " · unsure" : "")),
          h(
            "select",
            {
              "aria-label": "Move this group to a level",
              value: group.score === null ? "" : String(group.score),
              disabled: Boolean(busy),
              onChange: (event) => post(
                "/api/grade/move",
                { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) },
                "move"
              )
            },
            h("option", { value: "" }, "not placed"),
            levels.map((level) => h("option", { value: String(level.score), key: level.score }, label(level.score) + (level.label ? " · " + level.label : "")))
          )
        ),
        group.reason ? h("div", { className: "pp-as" }, group.reason) : null,
        open2 ? members.map((answer) => h("div", { className: "pp-gplain", key: answer.student }, answerText(answer))) : null
      );
    };
    return shell(
      "Grade · " + props.title + " · rubric proposed",
      h(
        "div",
        { className: "pp-review" },
        question,
        item.proposals.length ? h(
          "div",
          { className: "pp-gfrom" },
          item.chosen ? "Taken from the proposal “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”. " : "",
          h(
            "button",
            { type: "button", className: "pp-segbtn", onClick: () => setComparing(!comparing) },
            comparing ? "Hide the proposals" : "Compare the " + item.proposals.length + " proposals"
          )
        ) : null,
        comparing && item.proposals.length ? compare() : null,
        without.length ? missingBar() : null,
        !doc.grouped ? h(Message, null, "The levels are written, and the answers are not grouped yet. Ask the assistant to group them, or accept the rubric and grade each answer yourself.") : null,
        levels.map(
          (level) => h(
            "div",
            { className: "pp-glevel", key: level.score },
            h(
              "div",
              { className: "pp-glevelhead" },
              h("b", null, label(level.score)),
              h("span", null, level.description || (level.label || "")),
              h("span", { className: "pp-as" }, placedAt(level.score).reduce((sum, group) => sum + group.count, 0) + " answers")
            ),
            placedAt(level.score).map(groupChip)
          )
        ),
        unplaced.length ? h("div", { className: "pp-glevel" }, h("div", { className: "pp-glevelhead" }, h("b", null, "?"), h("span", null, "Not placed at a level")), unplaced.map(groupChip)) : null,
        item.counts.ungrouped ? h(Message, null, item.counts.ungrouped + " answer(s) to this question are in no group; they are graded one by one once the rubric is accepted.") : null,
        doc.group_problems.length ? h(Message, { error: true }, doc.group_problems.join("; ")) : null
      ),
      [
        h(
          "span",
          { className: "pp-as", key: "hint" },
          without.length ? without.join(", ") + (without.length === 1 ? " has" : " have") + " no rubric yet — choose one there before accepting." : "Accepting the rubric accepts it for every question of " + props.title + ". Change a level's wording in chat."
        ),
        h(
          "button",
          {
            type: "button",
            key: "accept",
            className: "pp-primary",
            disabled: Boolean(busy) || without.length > 0,
            onClick: () => post("/api/grade/accept-rubric", {}, "accept")
          },
          busy === "accept" ? "Accepting…" : "Accept rubric"
        )
      ]
    );
  }
  const decide = (list, via, labelText) => post(
    "/api/grade/decide",
    {
      via,
      decisions: list.map(
        (entry) => Object.assign({ item: entry.item || item.item_id, student: entry.student, score: entry.score }, notes[entry.student + "|" + (entry.item || item.item_id)] ? { comment: notes[entry.student + "|" + (entry.item || item.item_id)] } : {})
      )
    },
    labelText
  );
  const waiting2 = (answers) => answers.filter((answer) => !answer.decision && answer.suggestion);
  const disagrees = (answer) => answer.decision && answer.now !== null && answer.now !== answer.decision.score;
  const sections = [];
  item.groups.forEach(
    (group) => sections.push({
      key: "g" + group.index,
      title: group.label,
      score: group.score,
      unsure: group.unsure,
      answers: item.answers.filter((answer) => answer.group === group.index && !answer.blank && !answer.unread)
    })
  );
  sections.push({
    key: "none",
    title: item.groups.length ? "In no group" : "Answers",
    score: null,
    answers: item.answers.filter((answer) => answer.group === null && !answer.blank && !answer.unread)
  });
  sections.push({ key: "blank", title: "Blank", score: 0, answers: item.answers.filter((answer) => answer.blank) });
  sections.push({ key: "unread", title: "Not read yet — read the page, or run `scans read`", score: null, answers: item.answers.filter((answer) => answer.unread) });
  const visible = sections.filter((section) => section.answers.length);
  const order = [].concat.apply([], visible.map((section) => section.answers));
  const current = Math.min(focus, Math.max(0, order.length - 1));
  const badge = (answer) => {
    const decided = answer.decision ? answer.decision.score : null;
    const suggested = answer.suggestion ? answer.suggestion.score : null;
    const value = decided !== null ? decided : suggested;
    return h(
      "div",
      { className: "pp-gmark" + (decided !== null ? " pp-gmark-done" : value !== null ? " pp-gmark-sug" : " pp-gmark-none") },
      h("b", null, value === null ? "—" : label(value)),
      h("span", null, decided !== null ? "of " + label(max) + " ✓" : value !== null ? "suggested" : "no mark")
    );
  };
  const card = (answer) => {
    const index = order.indexOf(answer);
    const decided = answer.decision ? answer.decision.score : null;
    const suggested = answer.suggestion ? answer.suggestion.score : null;
    const key = answer.student + "|" + item.item_id;
    return h(
      "div",
      {
        key: answer.student,
        className: "pp-gcard" + (index === current ? " pp-focus" : "") + (decided !== null ? " pp-gcard-done" : ""),
        tabIndex: 0,
        onFocus: () => setFocus(index),
        onMouseDown: () => setFocus(index)
      },
      badge(answer),
      h(
        "div",
        { className: "pp-gbody" },
        h("div", { className: "pp-gwho" }, who(answer.student), answer.page ? h("span", null, " · p." + answer.page) : null),
        answerText(answer),
        answer.confidence && answer.confidence !== "high" || answer.note ? h(
          "div",
          { className: "pp-gnote" + (answer.confidence === "low" ? " pp-glow" : "") },
          (answer.confidence && answer.confidence !== "high" ? answer.confidence + " confidence" : "") + (answer.note ? (answer.confidence && answer.confidence !== "high" ? " · " : "") + answer.note : "")
        ) : null,
        answer.suggestion && answer.suggestion.source === "grader" && answer.suggestion.comment ? h("div", { className: "pp-as" }, "Suggested " + label(answer.suggestion.score) + ": " + answer.suggestion.comment) : null,
        disagrees(answer) ? h(
          "div",
          { className: "pp-gdisagree" },
          "The rubric now suggests " + label(answer.now) + ". ",
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => decide([{ student: answer.student, score: answer.now }], "one", "one") },
            "Give " + label(answer.now)
          ),
          h("span", { className: "pp-as" }, " or keep " + label(decided))
        ) : null,
        h(
          "div",
          { className: "pp-gbtns" },
          scale.map(
            (value) => h(
              "button",
              {
                type: "button",
                key: value,
                className: "pp-gscore" + (decided === value ? " pp-gscore-on" : decided === null && suggested === value ? " pp-gscore-next" : ""),
                title: (levelOf(value) ? levelOf(value).description + " — " : "") + "give " + label(value),
                disabled: Boolean(busy),
                onClick: () => decide([{ student: answer.student, score: value }], "one", "one")
              },
              label(value)
            )
          ),
          h("input", {
            className: "pp-gcomment",
            placeholder: answer.decision && answer.decision.comment ? answer.decision.comment : "comment",
            value: notes[key] || "",
            onChange: (event) => {
              const text = event.target.value;
              setNotes((current2) => Object.assign({}, current2, { [key]: text }));
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" && (decided !== null || suggested !== null)) {
                decide([{ student: answer.student, score: decided !== null ? decided : suggested }], "one", "one");
              }
              event.stopPropagation();
            }
          }),
          answer.history ? h("span", { className: "pp-as" }, "changed " + answer.history + "×") : null
        )
      )
    );
  };
  const onKey = (event) => {
    if (event.target.tagName === "SELECT" || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || busy) return;
    const answer = order[current];
    const onward = () => {
      const later = order.findIndex((entry, index) => index > current && !entry.decision);
      setFocus(later === -1 ? Math.min(current + 1, order.length - 1) : later);
    };
    if (event.key === "j" || event.key === "ArrowDown") {
      setFocus(Math.min(current + 1, order.length - 1));
      event.preventDefault();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      setFocus(Math.max(current - 1, 0));
      event.preventDefault();
    } else if (answer && event.key === "Enter") {
      if (!answer.decision && answer.suggestion) decide([{ student: answer.student, score: answer.suggestion.score }], "one", "one");
      onward();
      event.preventDefault();
    } else if (answer && /^[0-9]$/.test(event.key) && scale.indexOf(Number(event.key)) !== -1) {
      decide([{ student: answer.student, score: Number(event.key) }], "one", "one");
      onward();
      event.preventDefault();
    }
  };
  const allHere = waiting2(item.answers);
  const allEverywhere = [].concat.apply(
    [],
    doc.items.map((entry) => waiting2(entry.answers).map((answer) => ({ item: entry.item_id, student: answer.student, score: answer.suggestion.score })))
  );
  const disagreeing = item.answers.filter(disagrees);
  const marksKeys = scale.slice().reverse().filter((value) => item.marks.at[String(value)] || item.criterion && item.criterion.levels.some((level) => level.score === value));
  const answeredCount = Math.max(1, item.counts.answers - item.counts.unread);
  const picture = h(
    "div",
    { className: "pp-gpicture" },
    h(
      "div",
      { className: "pp-gpicturehead" },
      h("b", null, item.marks.mean === null ? "No marks yet" : "Mean " + item.marks.mean + " of " + label(max)),
      h("span", null, item.counts.decided + " of " + item.counts.answers + " decided" + (item.counts.unread ? " · " + item.counts.unread + " not read yet" : "")),
      disagreeing.length ? h("span", { className: "pp-gwarn" }, disagreeing.length + " decided mark(s) differ from the rubric now") : null,
      disagreeing.length ? h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: Boolean(busy),
          title: "Each keeps its old mark in its history",
          onClick: () => decide(disagreeing.map((answer) => ({ student: answer.student, score: answer.now })), "group", "remark")
        },
        busy === "remark" ? "Re-marking…" : "Re-mark all " + disagreeing.length + " at the rubric's suggestion"
      ) : null
    ),
    marksKeys.map((value) => {
      const slot = item.marks.at[String(value)] || { decided: 0, suggested: 0 };
      const level = levelOf(value);
      return h(
        "div",
        { className: "pp-gdist", key: value, title: level ? level.description : "" },
        h("b", null, label(value)),
        h(
          "span",
          { className: "pp-gdistbar" },
          h("span", { className: "pp-gdist-done", style: { width: slot.decided / answeredCount * 100 + "%" } }),
          h("span", { className: "pp-gdist-sug", style: { width: slot.suggested / answeredCount * 100 + "%" } })
        ),
        h("span", { className: "pp-gdistn" }, String(slot.decided + slot.suggested))
      );
    })
  );
  const levelsNow = item.criterion && item.criterion.levels.length ? item.criterion.levels : scale.slice().reverse().map((score) => ({ score, label: null, description: "" }));
  const others = item.proposals.filter((proposal) => proposal.id !== item.chosen);
  const nextRev = "rev-" + (doc.proposals.filter((proposal) => /^rev-\d+$/.test(proposal.id)).length + 1);
  const rethinkPrompt = (text) => "/import-assessment " + props.assessmentId + " " + props.runId + " — rethink the rubric for " + qName + " (" + item.item_id + ") as `" + nextRev + "`: " + text.trim();
  const rubricPanel = h(
    "div",
    { className: "pp-grubric" },
    h(
      "div",
      { className: "pp-grubrichead" },
      h("b", null, "Rubric for " + qName),
      item.chosen ? h("span", { className: "pp-as" }, "from “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”") : null
    ),
    levelsNow.map((level) => {
      const here = item.groups.filter((group) => group.score === level.score);
      return h(
        "div",
        { className: "pp-grlevel", key: level.score },
        h("div", { className: "pp-grlevelhead" }, h("b", null, label(level.score)), h("span", null, level.description)),
        here.map(
          (group) => h(
            "div",
            { className: "pp-grgroup", key: group.index },
            h("span", { className: "pp-grgroupname" }, group.label, group.unsure ? h("i", null, " unsure") : null),
            h("span", { className: "pp-as" }, String(group.count)),
            h(
              "select",
              {
                "aria-label": "Move " + group.label + " to another mark",
                value: group.score === null ? "" : String(group.score),
                disabled: Boolean(busy),
                onChange: (event) => post("/api/grade/move", { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) }, "move")
              },
              h("option", { value: "" }, "no mark"),
              levelsNow.map((option) => h("option", { value: String(option.score), key: option.score }, "→ " + label(option.score)))
            )
          )
        )
      );
    }),
    others.map((proposal) => {
      const effect = proposal.effect;
      const nameOf = (index) => item.groups[index] ? item.groups[index].label : "group " + (index + 1);
      return h(
        "div",
        { className: "pp-grother", key: proposal.id },
        h("div", { className: "pp-grubrichead" }, h("b", null, proposal.title), h("span", { className: "pp-as" }, "mean " + (proposal.spread.mean === null ? "—" : proposal.spread.mean))),
        proposal.summary ? h("div", { className: "pp-as" }, proposal.summary) : null,
        effect.moves.length ? h(
          "ul",
          { className: "pp-grmoves" },
          effect.moves.map(
            (move) => h("li", { key: move.group }, nameOf(move.group) + ": " + (move.from === null ? "—" : label(move.from)) + " → " + (move.to === null ? "—" : label(move.to)) + " (" + move.count + ")")
          )
        ) : h("div", { className: "pp-as" }, "Changes no suggestion."),
        h(
          "div",
          { className: "pp-actions" },
          h(
            "button",
            {
              type: "button",
              className: "pp-primary",
              disabled: Boolean(busy),
              title: "Write it as " + qName + "'s rubric, accepted. Marks already given stay; any it disagrees with are flagged.",
              onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id, keepMarks: true, accept: true }, "revise")
            },
            busy === "revise" ? "Applying…" : "Use this"
          ),
          h(
            "span",
            { className: "pp-as" },
            effect.changes + " suggestion(s) change" + (effect.disagree ? " · " + effect.disagree + " of your marks would differ" : "")
          )
        )
      );
    }),
    h(
      "div",
      { className: "pp-grethink" },
      h("textarea", {
        rows: 2,
        placeholder: "What should change? e.g. “morphology-only answers deserve the mark”, “half marks for a consequence without numbers”",
        value: notes["rethink|" + item.item_id] || "",
        onChange: (event) => {
          const text = event.target.value;
          setNotes((current2) => Object.assign({}, current2, { ["rethink|" + item.item_id]: text }));
        },
        onKeyDown: (event) => event.stopPropagation()
      }),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn pp-chat",
          disabled: !(notes["rethink|" + item.item_id] || "").trim(),
          onClick: () => {
            props.ask(rethinkPrompt(notes["rethink|" + item.item_id]));
            setNotes((current2) => Object.assign({}, current2, { ["rethink|" + item.item_id]: "" }));
            setSaid({ error: false, text: "Asked the assistant to rethink " + qName + ". Its revision appears here, under the rubric, as soon as it is written." });
          }
        },
        "Ask the assistant to rethink " + qName
      )
    )
  );
  const shown = order[current];
  const side = h(
    "div",
    { className: "pp-gside" },
    showRubric ? rubricPanel : null,
    shown && doc.pages ? [
      h("div", { className: "pp-gwho", key: "who" }, who(shown.student) + " · page " + (shown.page || 1) + " · press the page to enlarge"),
      h("img", {
        key: "page",
        src: pageUrl(shown),
        alt: "Page " + (shown.page || 1) + " of " + shown.student + "'s paper",
        title: "Enlarge",
        onClick: () => setBig(shown)
      })
    ] : h(Message, null, doc.pages ? "Choose an answer to see its page." : "pdftoppm is not installed, so pages cannot be drawn.")
  );
  return shell(
    "Grade · " + props.title,
    h(
      "div",
      { className: "pp-gsplit" },
      h(
        "div",
        { className: "pp-review", onKeyDown: onKey },
        question,
        big ? h(GradePage, { src: pageUrl(big), onClose: () => setBig(null) }) : null,
        picture,
        h(
          "div",
          { className: "pp-actions", style: { marginBottom: "6px" } },
          h(
            "button",
            { type: "button", className: "pp-segbtn", onClick: () => setShowRubric(!showRubric) },
            showRubric ? "Hide the rubric" : "Rubric and rethink" + (others.length ? " · " + others.length + " other proposal(s)" : "")
          ),
          h("span", { className: "pp-as" }, "decided as " + (doc.decided_by || "nobody — the run lists no instructor"))
        ),
        visible.map((section) => {
          const open2 = waiting2(section.answers);
          return h(
            React.Fragment,
            { key: section.key },
            h(
              "div",
              { className: "pp-gsection" },
              section.score !== null && section.key !== "unread" ? h("span", { className: "pp-gsecmark" }, label(section.score)) : h("span", { className: "pp-gsecmark pp-gsecmark-none" }, "—"),
              h("b", null, section.title),
              section.unsure ? h("i", null, "unsure") : null,
              h("span", { className: "pp-as" }, section.answers.length + " answer" + (section.answers.length === 1 ? "" : "s")),
              open2.length && section.key !== "unread" ? h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: Boolean(busy),
                  onClick: () => decide(open2.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "group", "group")
                },
                busy === "group" ? "Accepting…" : "Accept " + open2.length + " at " + label(open2[0].suggestion.score)
              ) : null
            ),
            section.answers.map(card)
          );
        })
      ),
      side
    ),
    [
      h(
        "span",
        { className: "pp-as", key: "hint" },
        busy ? "Writing…" : "j / k move · " + scale.filter((value) => Number.isInteger(value) && value < 10).join(" ") + " give a mark · Enter takes the suggestion · Esc closes"
      ),
      h(
        "button",
        {
          type: "button",
          key: "all-q",
          className: "pp-segbtn",
          disabled: Boolean(busy) || !allHere.length,
          onClick: () => decide(allHere.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "all", "all")
        },
        "Accept all " + allHere.length + " for " + qName
      ),
      h(
        "button",
        {
          type: "button",
          key: "all",
          className: "pp-primary",
          disabled: Boolean(busy) || !allEverywhere.length,
          onClick: () => decide(allEverywhere, "all", "all")
        },
        busy === "all" ? "Accepting…" : "Accept all " + allEverywhere.length + " suggestions"
      )
    ]
  );
}
function GradePage(props) {
  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil pp-gbig", onMouseDown: props.onClose },
      h("img", { src: props.src, alt: "The page", className: "pp-gbigimg" })
    ),
    document.body
  );
}

// client/scans.js
function ScansTab(props) {
  const [pile, setPile] = React.useState(props.pile || "");
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  const [busy, setBusy] = React.useState(null);
  const placements = usePlacements();
  const blocked = Boolean(busy) || placementsWaiting(placements);
  const [said, setSaid] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [laneView, setLaneView] = React.useState(props.lane === "held" ? "held" : "all");
  const [search, setSearch] = React.useState("");
  const searchBox = React.useRef(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [grading, setGrading] = React.useState(false);
  const [openStep, setOpenStep] = React.useState(props.step || null);
  const deskRef = React.useRef(null);
  const scrolled = React.useRef(false);
  React.useEffect(() => {
    if (props.lane !== "held" || scrolled.current || state.phase !== "ready" || !deskRef.current) return;
    scrolled.current = true;
    deskRef.current.scrollIntoView({ block: "start" });
  });
  const names = props.names;
  const query = (path) => scoped(
    BASE + path + "?run=" + encodeURIComponent(props.runId) + (pile ? "&assessment=" + encodeURIComponent(pile) : ""),
    props.sessionId
  );
  React.useEffect(() => {
    let live = true;
    fetch(query("/api/scans") + (names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
      headers: { accept: "application/json" }
    }).then((response) => response.json()).then((value) => live && setState({ phase: "ready", value })).catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, pile, names, props.revision, tick]);
  const doc = state.value;
  const assessmentId = doc && doc.assessment ? doc.assessment.id : "";
  const post = (path, body, label, done) => {
    if (blocked) return;
    setBusy(label);
    setSaid(null);
    fetch(query(path).replace(/assessment=[^&]*/, "") + "&assessment=" + encodeURIComponent(assessmentId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then((response) => response.json()).then((result) => {
      setBusy(null);
      const stale2 = /no route \/api\/scans/.test(String(result.error || ""));
      setSaid({
        error: Boolean(result.error) || !result.ok,
        text: stale2 ? "The harness was started before this tab existed. Restart it, then try again." : result.error || result.output || "Done."
      });
      setTick((value) => value + 1);
      props.onWrite();
      if (done && !result.error && result.ok) done();
    }).catch((error) => {
      setBusy(null);
      setSaid({ error: true, text: String(error) });
    });
  };
  const assign = (paper, to) => {
    if (busy) return;
    setSaid(null);
    enqueuePlacement({
      runId: props.runId,
      sessionId: props.sessionId,
      assessment: assessmentId,
      file: paper.file,
      pages: paper.pages,
      answer: to,
      onDone: (result) => {
        const stale2 = /no route \/api\/scans/.test(String(result.error || ""));
        const failed = Boolean(result.error) || !result.ok;
        setSaid({
          error: failed,
          text: stale2 ? "The harness was started before this tab existed. Restart it, then try again." : (failed ? "pp. " + paper.pages + " was not placed: " : "") + (result.error || result.output || "Done.")
        });
        setTick((value) => value + 1);
        props.onWrite();
      }
    });
  };
  const statusOf = (paper) => {
    const key = placementKey(assessmentId, paper.file, paper.pages);
    return placements.running === key ? "placing" : placements.queued.includes(key) ? "queued" : null;
  };
  if (state.phase === "loading") return h(Message, null, "Reading the pile…");
  if (doc.error) {
    return h(
      Message,
      { error: true },
      /no route \/api\/scans/.test(doc.error) ? "The harness was started before this tab existed. Restart it to see scanned papers here." : doc.error
    );
  }
  if (!doc.assessment) {
    return h(
      Message,
      null,
      "No scanned pile for " + props.runId + " yet. Upload the scans; the assistant works out which assessment they are and files them, and they appear here."
    );
  }
  const who = (id, name) => name ? name + " · " + id : id;
  const cropUrl = (paper) => query("/api/scans/crop").replace(/assessment=[^&]*/, "") + "&assessment=" + encodeURIComponent(assessmentId) + "&file=" + encodeURIComponent(paper.file) + "&pages=" + encodeURIComponent(paper.pages);
  doc.papers.forEach((paper) => {
    paper.also = paper.also || [];
    paper.clash = (paper.clash || []).map((entry) => Object.assign({ page_list: [] }, entry));
    paper.page_list = paper.page_list || [];
  });
  const pageUrl = (paper, page) => query("/api/scans/crop").replace(/assessment=[^&]*/, "") + "&assessment=" + encodeURIComponent(assessmentId) + "&file=" + encodeURIComponent(paper.file) + "&pages=" + encodeURIComponent(paper.pages) + "&whole=" + page;
  const sideBySide = (paper) => h(
    "div",
    { className: "pp-clash" },
    [{ file: paper.file, pages: paper.pages, page_list: paper.page_list, own: true }].concat(paper.clash).map(
      (entry) => h(
        "figure",
        { key: entry.file + "#" + entry.pages },
        h(
          "div",
          { className: "pp-clashpages" },
          entry.page_list.map(
            (page) => h("img", { key: page, loading: "lazy", alt: "Page " + page + " of " + entry.file, src: pageUrl(entry, page) })
          )
        ),
        h("figcaption", null, (entry.own ? "This paper" : "The other") + " · pp. " + entry.pages)
      )
    )
  );
  const reviewable = doc.papers.filter(
    (paper) => paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed") || paper.lane === "held" && paper.candidates.length
  ).length;
  const keyOf = (paper) => paper.file + "|" + paper.pages;
  const held = doc.papers.filter((paper) => paper.lane === "held");
  const check = doc.papers.filter((paper) => paper.lane === "check");
  const placed2 = doc.papers.filter((paper) => paper.lane === "placed");
  const skipped = doc.papers.filter((paper) => paper.lane === "skipped");
  const view = laneView === "held" && !held.length || laneView === "check" && !check.length ? "all" : laneView;
  const work = view === "held" ? held : view === "check" ? check : held.concat(check);
  const current = work.find((paper) => keyOf(paper) === selected) || work.find((paper) => !statusOf(paper)) || work[0] || null;
  const noPaper = doc.class.filter((entry) => !entry.placed);
  const hasPaper = new Set(doc.class.filter((entry) => entry.placed).map((entry) => entry.student));
  const waiting2 = doc.papers.filter((paper) => statusOf(paper)).length;
  const nextAfter = (paper) => {
    const index = work.indexOf(paper);
    return work.slice(index + 1).concat(work.slice(0, Math.max(0, index))).find((entry) => entry !== paper && !statusOf(entry)) || null;
  };
  const place = (paper, to) => {
    if (busy || !paper || statusOf(paper)) return;
    assign(paper, to);
    const next = nextAfter(paper);
    setSelected(next ? keyOf(next) : null);
    setSearch("");
  };
  const skeleton = (word) => word.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/kh|x/g, "h").replace(/zh/g, "j").replace(/q/g, "k").replace(/w/g, "u").replace(/y/g, "i").replace(/(.)\1+/g, "$1").replace(/[^a-z0-9]/g, "");
  const found = (entry, text) => text.trim().toLowerCase().split(/\s+/).every((word) => {
    const latin = skeleton(word);
    return String(entry.name || "").toLowerCase().includes(word) || entry.student.toLowerCase().includes(word) || latin !== "" && String(entry.search || "").includes(latin);
  });
  const searched = search.trim() ? noPaper.filter((entry) => found(entry, search)).concat(doc.class.filter((entry) => entry.placed && found(entry, search))).slice(0, 12) : [];
  const NEAR = { close: "close", possible: "possible", far: "far" };
  const studentLine = (paper, student) => student === paper.resolved ? "placed here now" : hasPaper.has(student) ? "has a paper" : "no paper yet";
  const rankRow = (paper, entry, index, off) => h(
    "li",
    { key: entry.student },
    h(
      "button",
      {
        type: "button",
        className: "pp-rankrow" + (entry.student === paper.resolved ? " pp-rankrow-now" : ""),
        disabled: off,
        title: "Place pp. " + paper.pages + " on " + who(entry.student, entry.name) + (index < 9 ? " — key " + (index + 1) : ""),
        onClick: () => place(paper, { student: entry.student })
      },
      h("span", { className: "pp-ranknum" }, index < 9 ? String(index + 1) : ""),
      h("span", { className: "pp-rankname" }, entry.name || entry.student),
      entry.near ? h(
        "span",
        { className: "pp-near pp-near-" + entry.near, title: NEAR[entry.near] + " · distance " + entry.distance },
        h("i", { style: { width: Math.round(Math.max(0.06, 1 - Math.min(1, entry.distance)) * 100) + "%" } })
      ) : h("span"),
      h("span", { className: "pp-as" + (hasPaper.has(entry.student) && entry.student !== paper.resolved ? " pp-as-warn" : "") }, studentLine(paper, entry.student))
    )
  );
  const deskDetail = (paper) => {
    if (!paper) return h("div", { className: "pp-mdetail pp-as" }, "Nothing here needs you.");
    const status = statusOf(paper);
    const off = Boolean(busy) || Boolean(status);
    const ranked = paper.ranked && paper.ranked.length ? paper.ranked : paper.candidates;
    return h(
      "div",
      { className: "pp-mdetail" },
      names && doc.crops ? h("img", {
        key: keyOf(paper),
        className: "pp-crop",
        alt: "The top of page " + paper.pages.split(/[-,]/)[0] + ", where the name is written",
        src: cropUrl(paper)
      }) : null,
      h(
        "div",
        { className: "pp-mhead" },
        names ? paper.written ? h("span", null, "Read as ", h("span", { className: "pp-written" }, paper.written)) : h("span", null, paper.has_name ? "A number is written" : "No name written") : null,
        h("span", { className: "pp-as" }, "pp. " + paper.pages + (paper.variant ? " · variant " + paper.variant : "")),
        status ? h("span", { className: "pp-qchip" }, status === "placing" ? "Placing…" : "Queued") : null
      ),
      names && paper.also.length ? h("div", { className: "pp-cardmeta" }, "Also written: ", paper.also.map((text) => "“" + text + "”").join(", ")) : null,
      h(
        "div",
        { className: "pp-cardmeta" },
        paper.lane === "check" ? (paper.match === "partial" ? "Placed on one word of the name: " : "Placed on a close spelling: ") + who(paper.resolved, paper.resolved_name) : paper.problem || "Not placed yet"
      ),
      names && doc.crops && paper.clash.length ? sideBySide(paper) : null,
      paper.lane === "check" ? h(
        "div",
        { className: "pp-actions" },
        h(
          "button",
          { type: "button", className: "pp-primary", disabled: off, onClick: () => place(paper, { student: paper.resolved }) },
          "Confirm " + (paper.resolved_name ? paper.resolved_name.split(/\s+/).slice(0, 2).join(" ") : paper.resolved)
        ),
        h("span", { className: "pp-as" }, "Enter")
      ) : null,
      ranked.length ? h(
        React.Fragment,
        null,
        h("div", { className: "pp-mlabel" }, "Possible matches, nearest first"),
        h("ol", { className: "pp-ranked" }, ranked.map((entry, index) => rankRow(paper, entry, index, off)))
      ) : h("div", { className: "pp-cardmeta" }, "No enrolled student is near what is written — search the class below."),
      h("input", {
        ref: searchBox,
        className: "pp-msearch",
        type: "search",
        value: search,
        disabled: off,
        placeholder: "Someone else — type a name or number  ( / )",
        "aria-label": "Search the class for who wrote pp. " + paper.pages,
        onChange: (event) => setSearch(event.target.value)
      }),
      search.trim() ? searched.length ? h(
        "ol",
        { className: "pp-ranked" },
        searched.map((entry, index) => rankRow(paper, { student: entry.student, name: entry.name }, index + 100, off))
      ) : h("div", { className: "pp-cardmeta" }, "Nobody in the class matches “" + search.trim() + "”.") : noPaper.length ? h(
        "details",
        { className: "pp-folded pp-nopaper" },
        h("summary", null, noPaper.length + (noPaper.length === 1 ? " student has" : " students have") + " no paper yet"),
        h(
          "div",
          { className: "pp-chips" },
          noPaper.map(
            (entry) => h(
              "button",
              {
                type: "button",
                key: entry.student,
                className: "pp-segbtn",
                disabled: off,
                title: "Place pp. " + paper.pages + " on " + who(entry.student, entry.name),
                onClick: () => place(paper, { student: entry.student })
              },
              entry.name || entry.student
            )
          )
        )
      ) : null,
      h(
        "div",
        { className: "pp-actions" },
        paper.clash.length ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: off,
            title: "This one is not their paper — a copy they started and gave up, handed in with the real one",
            onClick: () => place(paper, { skip: "spoiled copy — the paper is pp. " + paper.clash.map((entry) => entry.pages).join(", ") })
          },
          "Spoiled copy"
        ) : null,
        paper.lane === "held" && !paper.clash.length ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: off,
            title: "Not one of this run's students — a visitor, or a sheet that is nobody's",
            onClick: () => place(paper, { skip: "not a student of this run" })
          },
          "Not a student"
        ) : null
      )
    );
  };
  const deskRow = (paper) => {
    const status = statusOf(paper);
    const guess = paper.lane === "check" ? paper.resolved_name || paper.resolved : (paper.candidates[0] || {}).name || (paper.candidates[0] || {}).student;
    return h(
      "button",
      {
        type: "button",
        key: keyOf(paper),
        className: "pp-mrow" + (paper === current ? " pp-mrow-on" : ""),
        "aria-current": paper === current ? "true" : void 0,
        onClick: () => {
          setSelected(keyOf(paper));
          setSearch("");
        }
      },
      h("span", { className: "pp-mdot pp-mdot-" + paper.lane, title: paper.lane === "check" ? "Weak match, to check" : "Held — placed on nobody" }),
      h(
        "span",
        { className: "pp-mrowmain" },
        h("b", null, names && paper.written ? paper.written : "pp. " + paper.pages),
        h("span", null, (names && paper.written ? "pp. " + paper.pages : paper.lane === "check" ? "to check" : "held") + (guess ? " → " + guess : ""))
      ),
      status ? h("span", { className: "pp-qchip" }, status === "placing" ? "Placing…" : "Queued") : null
    );
  };
  const onKey = (event) => {
    if (shown !== "match" || !current) return;
    if (event.target.tagName === "INPUT") {
      if (event.key === "Enter" && searched.length) {
        place(current, { student: searched[0].student });
        event.preventDefault();
      } else if (event.key === "Escape" && search) {
        setSearch("");
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.target.tagName === "SELECT" || event.target.tagName === "TEXTAREA") return;
    const index = work.indexOf(current);
    const ranked = current.ranked && current.ranked.length ? current.ranked : current.candidates;
    if (event.key === "j" || event.key === "ArrowDown") {
      const next = work[Math.min(index + 1, work.length - 1)];
      if (next) setSelected(keyOf(next));
      event.preventDefault();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      const next = work[Math.max(index - 1, 0)];
      if (next) setSelected(keyOf(next));
      event.preventDefault();
    } else if (/^[1-9]$/.test(event.key) && ranked[Number(event.key) - 1]) {
      place(current, { student: ranked[Number(event.key) - 1].student });
      event.preventDefault();
    } else if (event.key === "Enter" && !event.target.closest("button")) {
      if (current.lane === "check") place(current, { student: current.resolved });
      else if (ranked.length) place(current, { student: ranked[0].student });
      event.preventDefault();
    } else if (event.key === "/" && searchBox.current) {
      searchBox.current.focus();
      event.preventDefault();
    }
  };
  const confirmAll = () => {
    const papers = check.filter((paper) => !statusOf(paper)).map((paper) => ({ file: paper.file, pages: paper.pages, student: paper.resolved }));
    if (!papers.length) return;
    const ok = window.confirm(
      "Confirm all " + papers.length + " weak matches? Each paper stays on the student it was matched to, and is marked as confirmed by you."
    );
    if (ok) post("/api/scans/assign", { papers }, "confirm-all");
  };
  const now = doc.now || { step: doc.next || null, index: 0, total: doc.stages.length, title: "", body: "", whose: "you", action: null };
  const shown = openStep || now.step || "canvas";
  const stageOf = (id) => doc.stages.find((stage) => stage.id === id) || null;
  const shownStage = stageOf(shown);
  const gradable = doc.answers > 0;
  const WHOSE = { you: "Your move", assistant: "Assistant", done: "Done" };
  const whose = (value) => h("span", { className: "pp-whose pp-whose-" + value }, WHOSE[value] || value);
  const choosePile = (id) => {
    setOpenStep(null);
    setLaneView("all");
    setSelected(null);
    setSearch("");
    setPile(id);
  };
  const readButton = (primary) => h(
    "button",
    {
      type: "button",
      key: "read",
      className: primary ? "pp-primary" : "pp-segbtn",
      disabled: blocked,
      title: "Runs `scans read`, then `scans record`: every answer recorded as a draft, the low-confidence ones listed",
      onClick: () => post("/api/scans/read", {}, "read")
    },
    busy === "read" ? "Reading… a few minutes for a class" : "Read and record the answers"
  );
  const gradeButton = (primary) => h(
    "button",
    {
      type: "button",
      key: "grade",
      className: primary ? "pp-primary" : "pp-segbtn",
      disabled: Boolean(busy),
      title: "Every answer to each question as cards over the conversation — choose the rubric, then mark and decide",
      onClick: () => setGrading(true)
    },
    "Open the Grade view"
  );
  const askButton = (kind, primary) => STEP_PROMPTS[kind] ? h(
    "button",
    {
      type: "button",
      key: "ask-" + kind,
      className: (primary ? "pp-primary" : "pp-segbtn") + " pp-chat",
      onClick: () => props.ask(STEP_PROMPTS[kind](props.runId, assessmentId))
    },
    kind === "grade" ? "Ask the assistant for suggestions" : "Ask the assistant"
  ) : null;
  const canvasPanel = (lead) => doc.canvas && doc.canvas.ready > 0 ? h(CanvasMarks, {
    key: "canvas-" + assessmentId,
    lead,
    runId: props.runId,
    sessionId: props.sessionId,
    assessmentId,
    title: doc.assessment.title,
    ask: props.ask,
    canvas: doc.canvas,
    onSent: () => {
      setTick((value) => value + 1);
      props.onWrite();
    }
  }) : null;
  const nowActions = () => {
    if (now.action === "read") return [readButton(true)];
    if (now.action === "ask") return [askButton(now.ask, true)];
    if (now.action === "grade") return [gradeButton(true), now.ask ? askButton(now.ask, false) : null];
    if (now.action === "match")
      return [
        h(
          "button",
          { type: "button", key: "match", className: "pp-primary", onClick: () => setOpenStep("match") },
          "Show the papers"
        )
      ];
    return [];
  };
  const nowCard = h(
    "section",
    { className: "pp-now", "aria-label": "What " + doc.assessment.title + " needs now" },
    h(
      "div",
      { className: "pp-nowkick" },
      h("span", null, now.step ? "Step " + (now.index + 1) + " of " + now.total + " · " + ((stageOf(now.step) || {}).label || now.step) : "All " + now.total + " steps done"),
      whose(now.whose)
    ),
    h("h3", null, now.title),
    h("p", null, now.body),
    now.action === "canvas" ? canvasPanel(true) : h("div", { className: "pp-actions" }, nowActions())
  );
  const pileList = h(
    "div",
    { className: "pp-piles", role: "list", "aria-label": "Scanned exams in " + props.runId },
    doc.piles.map(
      (entry) => h(
        "button",
        {
          type: "button",
          role: "listitem",
          key: entry.id,
          className: "pp-pile",
          "aria-current": entry.id === assessmentId,
          onClick: () => choosePile(entry.id)
        },
        h(
          "span",
          { className: "pp-pilename" },
          h("b", null, entry.title),
          h("span", null, entry.now ? entry.now.phrase : "")
        ),
        entry.progress ? h(
          "span",
          { className: "pp-pilebar", "aria-hidden": "true" },
          entry.progress.map(
            (state2, index) => h("i", { key: index, className: state2 === "done" ? "pp-s-done" : entry.now && index === entry.now.index ? "pp-s-now" : "" })
          )
        ) : null,
        entry.now ? whose(entry.now.whose) : null
      )
    )
  );
  const stepper = h(
    "div",
    { className: "pp-stepper", role: "list", "aria-label": doc.assessment.title + ": the seven steps" },
    doc.stages.map(
      (stage, index) => h(
        "button",
        {
          type: "button",
          role: "listitem",
          key: stage.id,
          className: "pp-stepbtn",
          "aria-pressed": stage.id === shown,
          title: stage.label + ": " + stage.detail,
          onClick: () => setOpenStep(stage.id)
        },
        h(
          "span",
          {
            className: "pp-dot" + (stage.state === "done" ? " pp-dot-done" : stage.id === now.step ? " pp-dot-now" : stage.state === "yours" ? " pp-dot-yours" : ""),
            "aria-hidden": "true"
          },
          stage.state === "done" ? "✓" : String(index + 1)
        ),
        h("span", null, stage.label)
      )
    )
  );
  const matchTools = () => {
    const counted = placed2.length + check.length + held.length;
    const share = (n) => (counted ? 100 * n / counted : 0) + "%";
    const filter = (id, label, n) => h(
      "button",
      {
        type: "button",
        key: id,
        className: "pp-segbtn",
        "aria-pressed": view === id,
        onClick: () => {
          setLaneView(id);
          setSelected(null);
          setSearch("");
        }
      },
      label + " " + n
    );
    return [
      h(
        "div",
        { className: "pp-msum", key: "sum" },
        h(
          "div",
          { className: "pp-mbar", role: "img", "aria-label": placed2.length + " placed, " + check.length + " to check, " + held.length + " held" },
          h("i", { className: "pp-mbar-placed", style: { width: share(placed2.length) } }),
          h("i", { className: "pp-mbar-check", style: { width: share(check.length) } }),
          h("i", { className: "pp-mbar-held", style: { width: share(held.length) } })
        ),
        h(
          "div",
          { className: "pp-mkey" },
          h("span", null, h("i", { className: "pp-mdot pp-mdot-placed" }), placed2.length + " of " + counted + " placed"),
          check.length ? h("span", null, h("i", { className: "pp-mdot pp-mdot-check" }), check.length + " weak matches to check") : null,
          held.length ? h("span", null, h("i", { className: "pp-mdot pp-mdot-held" }), held.length + " held") : null,
          waiting2 ? h("span", null, waiting2 + " queued") : null,
          h("span", { className: "pp-as" }, doc.missing + " enrolled with no paper")
        )
      ),
      !names ? h(
        Message,
        { key: "pseudonyms" },
        "Pseudonyms are showing, so the handwritten names and their crops are hidden. Press Names to match papers."
      ) : null,
      check.length || names && reviewable ? h(
        "div",
        { className: "pp-actions", key: "many" },
        check.length ? h(
          "button",
          {
            type: "button",
            className: "pp-primary",
            disabled: blocked,
            title: "Keep every weak match on the student it was matched to, as one write — or check them one by one below",
            onClick: confirmAll
          },
          busy === "confirm-all" ? "Confirming…" : "Confirm all " + check.length + " weak matches"
        ) : null,
        names && reviewable ? h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: blocked,
            title: "Every name the pile was matched on, as big cards — confirm them all at once, reject the wrong ones",
            onClick: () => setReviewing(true)
          },
          "Review all " + reviewable + " name matches"
        ) : null
      ) : null,
      held.length + check.length ? h(
        "div",
        { className: "pp-desk", key: "desk", ref: deskRef },
        h(
          "div",
          { className: "pp-mside" },
          h(
            "div",
            { className: "pp-mfilter" },
            filter("held", "Held", held.length),
            filter("check", "To check", check.length),
            filter("all", "All", held.length + check.length)
          ),
          h(
            "div",
            { className: "pp-mlist", role: "list", "aria-label": "Papers that need you" },
            work.length ? work.map(deskRow) : h("div", { className: "pp-as pp-mempty" }, "None here.")
          ),
          h("div", { className: "pp-as pp-mkeys" }, "j / k move · 1–9 pick · Enter first · / search")
        ),
        deskDetail(current)
      ) : h("div", { className: "pp-cardmeta", key: "none" }, "Every paper is placed on a student."),
      h(
        "details",
        { className: "pp-folded", key: "placed" },
        h(
          "summary",
          null,
          placed2.length + " placed" + (skipped.length ? " · " + skipped.length + " set aside" : "") + " · " + doc.missing + " enrolled with no paper"
        ),
        h(
          "ul",
          null,
          placed2.map(
            (paper) => h(
              "li",
              { key: paper.file + paper.pages },
              "pp. " + paper.pages + " → " + who(paper.resolved, paper.resolved_name) + (paper.pinned ? " (confirmed)" : paper.match === "words" ? " (by its words)" : paper.match === "partial" ? " (one word)" : "")
            )
          ),
          skipped.map((paper) => h("li", { key: paper.file + paper.pages }, "pp. " + paper.pages + " — " + paper.skip))
        ),
        h(
          "div",
          { className: "pp-actions" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: blocked,
              title: "Run `scans apply` again — after editing plan.yaml by hand, say",
              onClick: () => post("/api/scans/apply", {}, "apply")
            },
            busy === "apply" ? "Applying…" : "Re-apply the plan"
          )
        )
      )
    ];
  };
  const stepTools = () => {
    if (shown === "match") return matchTools();
    if (shown === "read") return now.action === "read" ? [] : [h("div", { className: "pp-actions", key: "a" }, readButton(false))];
    if (shown === "rubric" || shown === "grade" || shown === "approve") {
      if (!gradable || now.action === "grade") return [];
      return [h("div", { className: "pp-actions", key: "a" }, gradeButton(false))];
    }
    if (shown === "canvas") return now.action === "canvas" ? [] : [canvasPanel()];
    return [];
  };
  const detail = shownStage ? h(
    "section",
    { className: "pp-stepdetail", "aria-label": shownStage.label },
    h("b", null, shownStage.label),
    " — " + shownStage.detail,
    stepTools()
  ) : null;
  return h(
    "div",
    { className: "pp-scroll", onKeyDown: onKey },
    pileList,
    nowCard,
    stepper,
    detail,
    said ? h("pre", { className: "pp-approveout" + (said.error ? " pp-approveerr" : "") }, said.text) : null,
    grading ? h(GradeBoard, {
      runId: props.runId,
      sessionId: props.sessionId,
      assessmentId,
      title: doc.assessment.title,
      names,
      revision: props.revision,
      ask: props.ask,
      onWrite: () => {
        setTick((value) => value + 1);
        props.onWrite();
      },
      onClose: () => setGrading(false)
    }) : null,
    reviewing && names ? h(MatchReview, {
      papers: doc.papers,
      title: doc.assessment.title,
      crops: doc.crops,
      cropUrl,
      busy: busy === "review",
      onClose: () => setReviewing(false),
      onSubmit: (papers) => post("/api/scans/assign", { papers }, "review", () => setReviewing(false))
    }) : null
  );
}
function ScansModal(props) {
  const close = props.onClose;
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close();
        }
      },
      h(
        "div",
        {
          className: "pp-modal pp-scansmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Scans",
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Scans · " + props.runId),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: close }, "×")
        ),
        h(ScansTab, {
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          ask: props.ask,
          onWrite: props.onWrite,
          revision: props.revision,
          pile: props.pile,
          step: props.step,
          lane: props.lane
        })
      )
    ),
    document.body
  );
}

// client/upload.js
var UPLOAD_KINDS = [
  {
    id: "scans",
    label: "Scanned student papers",
    accept: ".pdf,application/pdf",
    hint: "PDFs from the scanner — one per student or one batch for the class. Kept outside the course, renamed so no student's name travels with them."
  },
  {
    id: "paper",
    label: "Exam paper or answer key",
    accept: ".pdf,.docx,.odt,.md,.txt,.png,.jpg,.jpeg",
    hint: "The paper you set, and its key — so the questions can be recorded exactly as printed. Kept outside the course until they are imported."
  },
  {
    id: "recordings",
    label: "Recorded oral defences",
    accept: ".m4a,.mp4,.mp3,.wav,.webm,.ogg,audio/*",
    hint: "Defences recorded elsewhere — on a phone, in another room — one file per student. Kept outside the course, renamed so no name travels with them; matched to students and priced before anything is sent."
  }
];
var uploadPrompt = (kind, runId, stored, note, assessment) => {
  const fresh = stored.filter((entry) => !entry.duplicate);
  const again = stored.length - fresh.length;
  const list = stored.map((entry) => "- " + entry.path).join("\n");
  const extra = note.trim() === "" ? "" : "\n\nWhat I can tell you: " + note.trim();
  const repeat = again ? " (" + again + " of them already uploaded before)" : "";
  if (assessment) {
    const id = assessment.assessment;
    return kind === "scans" ? "I uploaded " + stored.length + " scanned exam PDF(s) for " + id + " (" + runId + ")" + repeat + ", into the run's unfiled inbox:\n" + list + extra + "\n\nI uploaded them from " + id + "'s row in course mode, so that is which assessment they are — no need to identify it from the covers. Check its questions are recorded (/import-assessment) and ask me about variants, then file and grade them (/grade-scans)." : "I uploaded the exam paper / answer key for " + id + " (" + runId + ")" + repeat + ":\n" + list + extra + "\n\nUse them to record " + id + "'s questions and key (/import-assessment) — ask me about variants first.";
  }
  if (kind === "scans") {
    return "I uploaded " + stored.length + " scanned exam PDF(s) for " + runId + repeat + ", into the run's unfiled inbox:\n" + list + extra + "\n\nWork out which assessment they are and ask me before filing them (/import-assessment §1), then grade them (/grade-scans). Start with `scans identify`: it ranks each file by the name I uploaded it under, which is kept privately, else by the title printed on its cover — you do not need to see the pages.";
  }
  return "I uploaded the exam paper / answer key for " + runId + repeat + ":\n" + list + extra + "\n\nUse them to record the exam's questions and key (/import-assessment) — ask me which assessment it is and about variants first.";
};
function BatchModal(props) {
  const close = props.onClose;
  const [assessments, setAssessments] = React.useState([]);
  const [assessment, setAssessment] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [quoted2, setQuoted] = React.useState(false);
  const [busy, setBusy] = React.useState(null);
  const [output, setOutput] = React.useState("");
  const url = (extra) => scoped(BASE + "/api/defence/batch?run=" + encodeURIComponent(props.runId) + (extra || ""), props.sessionId);
  React.useEffect(() => {
    fetch(url(), { cache: "no-store" }).then((response) => response.json()).then((result) => {
      const list = result.assessments || [];
      setAssessments(list);
      if (list.length) setAssessment((current) => current || list[0].id);
      if (result.error) setOutput(result.error);
    }).catch((error) => setOutput(String(error)));
  }, [props.runId]);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);
  const run2 = (step, extra) => {
    if (!assessment || busy) return;
    const sending = step === "transcribe" && /confirm/.test(extra || "");
    setBusy(step);
    setOutput(sending ? "Sending and transcribing — this takes a while for a long batch…" : "Working…");
    fetch(url("&step=" + step + "&assessment=" + encodeURIComponent(assessment) + (extra || "")), { method: "POST" }).then((response) => response.json()).then((result) => {
      setBusy(null);
      setOutput(result.error || result.output || "(nothing said)");
      if (step === "transcribe") setQuoted(!sending && !!result.ok);
    }).catch((error) => {
      setBusy(null);
      setOutput(String(error));
    });
  };
  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil", onMouseDown: (event) => event.target === event.currentTarget && !busy && close() },
      h(
        "div",
        {
          className: "pp-modal pp-deskmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Recorded defences",
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Recorded defences"),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: Boolean(busy), onClick: close }, "×")
        ),
        h(
          "div",
          { className: "pp-publishbody" },
          h(
            "div",
            { className: "pp-approverow" },
            h("span", { className: "pp-dim" }, "Assessment"),
            h(
              "select",
              {
                className: "pp-input",
                value: assessment,
                disabled: Boolean(busy),
                onChange: (event) => {
                  setAssessment(event.target.value);
                  setQuoted(false);
                }
              },
              assessments.map((entry) => h("option", { key: entry.id, value: entry.id }, entry.title + " · " + entry.id))
            )
          ),
          h(
            "div",
            { className: "pp-approverow" },
            h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => run2("plan") }, "1 · Plan: who, how long, what it costs")
          ),
          h(
            "div",
            { className: "pp-approverow" },
            h(
              "label",
              { className: "pp-dim pp-dchooser" },
              h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }),
              " every student in these recordings agreed to be recorded"
            ),
            h(
              "button",
              { type: "button", className: "pp-segbtn", disabled: Boolean(busy) || !consent, onClick: () => run2("apply", "&consent=1") },
              "2 · File them as their defences"
            )
          ),
          h(
            "div",
            { className: "pp-approverow" },
            h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => run2("transcribe") }, "3 · Quote the transcription"),
            quoted2 ? h(
              "button",
              { type: "button", className: "pp-segbtn pp-drec", disabled: Boolean(busy), onClick: () => run2("transcribe", "&confirm=1") },
              "Send them and transcribe"
            ) : null
          ),
          h(
            "div",
            { className: "pp-dim" },
            "A recording the plan could not place is named there: give it a student in the plan file it shows, and plan again. Once transcribed, open each student's defence desk: say which voice is yours, then Propose the grade."
          ),
          output ? h("pre", { className: "pp-publishout" }, output) : null
        )
      )
    ),
    document.body
  );
}
function UploadModal(props) {
  const close = props.onClose;
  const [kind, setKind] = React.useState(props.kind || "scans");
  const [files, setFiles] = React.useState([]);
  const [note, setNote] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [text, setText] = React.useState("");
  const [over, setOver] = React.useState(false);
  const input = React.useRef(null);
  const spec = UPLOAD_KINDS.find((entry) => entry.id === kind);
  const busy = phase === "running";
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);
  const add = (list) => {
    const incoming = Array.from(list || []);
    setFiles((current) => {
      const seen = new Set(current.map((file) => file.name + "|" + file.size));
      return current.concat(incoming.filter((file) => !seen.has(file.name + "|" + file.size)));
    });
    setPhase("idle");
    setText("");
  };
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const upload = () => {
    if (busy || files.length === 0) return;
    setPhase("running");
    const stored = [];
    const next = (index) => {
      if (index >= files.length) {
        if (kind === "recordings" && props.onRecordings) props.onRecordings();
        else props.ask(uploadPrompt(kind, props.runId, stored, note, props.assessment));
        close();
        return;
      }
      const file = files[index];
      setText("Uploading " + (index + 1) + " of " + files.length + " — " + file.name + "…");
      fetch(
        scoped(
          BASE + "/api/upload?run=" + encodeURIComponent(props.runId) + "&kind=" + encodeURIComponent(kind) + "&name=" + encodeURIComponent(file.name),
          props.sessionId
        ),
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file }
      ).then((response) => response.json()).then((result) => {
        if (result.error) {
          setPhase("error");
          const stale2 = /no route \/api\/upload/.test(String(result.error));
          setText(
            file.name + ": " + (stale2 ? "the harness was started before uploads existed. Restart it, then upload again." : result.error) + (stored.length ? "\n\n" + stored.length + " file(s) before it were uploaded." : "")
          );
          return;
        }
        stored.push(result);
        next(index + 1);
      }).catch((error) => {
        setPhase("error");
        setText(file.name + ": " + String(error));
      });
    };
    next(0);
  };
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        },
        onDragEnter: stop,
        onDragOver: stop,
        onDrop: stop
      },
      h(
        "div",
        {
          className: "pp-modal pp-uploadmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Upload files",
          onMouseDown: (event) => event.stopPropagation()
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Upload · " + (props.assessment ? props.assessment.label : props.runId)),
          h(
            "button",
            { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close },
            "×"
          )
        ),
        h(
          "div",
          { className: "pp-publishbody" },
          h(
            "div",
            { className: "pp-approverow" },
            // For one assessment: its papers and its key; recordings are the run's.
            UPLOAD_KINDS.filter((entry) => !props.assessment || entry.id !== "recordings").map(
              (entry) => h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": kind === entry.id,
                  title: entry.hint,
                  disabled: busy,
                  onClick: () => {
                    setKind(entry.id);
                    setPhase("idle");
                    setText("");
                  },
                  key: entry.id
                },
                entry.label
              )
            )
          ),
          h("p", { className: "pp-publishhint" }, spec.hint),
          h(
            "div",
            {
              className: "pp-drop" + (over ? " pp-dropover" : ""),
              role: "button",
              tabIndex: 0,
              "aria-label": "Choose files, or drop them here",
              onClick: () => !busy && input.current && input.current.click(),
              onKeyDown: (event) => {
                if ((event.key === "Enter" || event.key === " ") && !busy && input.current) {
                  event.preventDefault();
                  input.current.click();
                }
              },
              onDragEnter: (event) => {
                stop(event);
                setOver(true);
              },
              onDragOver: stop,
              onDragLeave: (event) => {
                stop(event);
                setOver(false);
              },
              onDrop: (event) => {
                stop(event);
                setOver(false);
                if (!busy) add(event.dataTransfer && event.dataTransfer.files);
              }
            },
            files.length === 0 ? "Drop files here, or press to choose" : files.length + " file(s) — drop more, or press to add",
            h("input", {
              ref: input,
              type: "file",
              multiple: true,
              accept: spec.accept,
              style: { display: "none" },
              onChange: (event) => {
                add(event.target.files);
                event.target.value = "";
              }
            })
          ),
          files.length ? h(
            "ul",
            { className: "pp-uploadlist" },
            files.map(
              (file, index) => h(
                "li",
                { key: file.name + "|" + file.size },
                h("span", { className: "pp-uploadname" }, file.name),
                h("span", { className: "pp-as" }, " " + Math.max(1, Math.round(file.size / 1024)) + " KB"),
                busy ? null : h(
                  "button",
                  {
                    type: "button",
                    className: "pp-modallink",
                    "aria-label": "Remove " + file.name,
                    onClick: () => setFiles((current) => current.filter((_, at) => at !== index))
                  },
                  " remove"
                )
              )
            )
          ) : null,
          h("textarea", {
            className: "pp-publishtext pp-uploadnote",
            placeholder: kind === "scans" ? "Anything the assistant should know — which quiz this is, how many versions, a page scanned twice." : "Anything the assistant should know — which exam, which file is the key, versions.",
            value: note,
            disabled: busy,
            "aria-label": "A note for the assistant",
            onChange: (event) => setNote(event.target.value)
          }),
          h(
            "div",
            { className: "pp-approverow" },
            h(
              "button",
              {
                type: "button",
                // Recordings open the batch steps instead of writing to the chat.
                className: kind === "recordings" ? "pp-segbtn" : "pp-segbtn pp-chat",
                disabled: busy || files.length === 0,
                title: "Upload to the private folder outside the course, then tell the assistant in the chat where the files are. Nothing is graded or filed without asking you.",
                onClick: upload
              },
              busy ? "Uploading…" : "Upload and send to chat"
            )
          ),
          phase === "idle" ? null : h(
            "pre",
            { className: "pp-publishout" + (phase === "error" ? " pp-approveerr" : "") },
            text
          )
        )
      )
    ),
    document.body
  );
}

// client/pane.js
function ProfessorPane(props) {
  const [integrationsFocus, setIntegrationsFocus] = React.useState({ service: null, tick: 0 });
  const [drafts, setDrafts] = React.useState(true);
  const [names, setNames] = React.useState(true);
  const everything = useVersion(AREAS.everything);
  const marksVersion = useVersion(AREAS.marks);
  const gradeVersion = useVersion(AREAS.grade);
  const scansVersion = useVersion(AREAS.scans);
  const deskVersion = useVersion(AREAS.files);
  const write = (tags) => wrote(props.sessionId, tags);
  const [publishing, setPublishing] = React.useState(null);
  const openPublish = (target, extra) => setPublishing({
    target,
    assessment: "",
    label: "",
    repo: "",
    group: "",
    message: "",
    edit: false,
    phase: "idle",
    text: "",
    ...extra || {}
  });
  const setPublishField = (field, value) => setPublishing(
    (state) => state === null ? state : { ...state, [field]: value, phase: "idle", text: "" }
  );
  const [material, setMaterial] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [courseMode, setCourseMode] = React.useState(false);
  const courseModeRef = React.useRef(false);
  courseModeRef.current = courseMode;
  const [chatBeside, setChatBeside] = React.useState(false);
  const [placeRequest, setPlaceRequest] = React.useState(null);
  const placeCount2 = React.useRef(0);
  const openPlace = (request) => {
    placeCount2.current += 1;
    setPlaceRequest({ ...request, n: "pane-" + placeCount2.current });
    setCourseMode(true);
  };
  const focusCard = (service) => {
    setIntegrationsFocus((value) => ({ service, tick: value.tick + 1 }));
    openPlace({ view: "settings", sub: "integrations" });
  };
  const currentRunRef = React.useRef(null);
  const [desk, setDesk] = React.useState(null);
  const [batch, setBatch] = React.useState(false);
  const [grading, setGrading] = React.useState(null);
  const [scansPile, setScansPile] = React.useState(null);
  const [scansStep, setScansStep] = React.useState(null);
  const examWindow = React.useRef(null);
  const placedAt = React.useRef(0);
  React.useEffect(
    () => onPlacements((line) => {
      for (const frame of document.querySelectorAll("iframe")) {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage({ source: "professor-pane", kind: "scans-queue", running: line.running, queued: line.queued }, "*");
        }
      }
    }),
    []
  );
  const openRef = React.useRef(props.openDetails);
  openRef.current = props.openDetails;
  React.useEffect(() => {
    openRef.current();
  }, [props.sessionId]);
  React.useEffect(() => {
    setChosen(null);
  }, [props.sessionId]);
  const [chosen, setChosen] = React.useState(null);
  React.useEffect(() => {
    const answer = (request) => {
      if (!request) return;
      if (typeof request.run === "string" && request.run) setChosen(request.run);
      if (request.chat) setChatBeside(true);
      if (request.compose) setChatBeside(false);
      setPlaceRequest(request);
      setCourseMode(true);
      if (typeof request.scans === "string" && /^[A-Z0-9][A-Z0-9-]*$/.test(request.scans)) {
        setScansStep("match");
        setScansPile(request.scans);
      }
    };
    answer(takePendingPlace());
    const onPlace = (event) => {
      takePendingPlace();
      answer(event.detail);
    };
    window.addEventListener(PLACE_EVENT, onPlace);
    return () => window.removeEventListener(PLACE_EVENT, onPlace);
  }, [props.sessionId]);
  const dark = useDark();
  const runs2 = useJson(scoped(BASE + "/api/runs", props.sessionId));
  useWorkspaceWatch(props.sessionId);
  React.useEffect(() => {
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== "professor-pane") return;
      if (data.kind === "ask") {
        if (typeof data.prompt !== "string" || data.prompt.trim() === "") return;
        props.ask(data.prompt);
        if (courseModeRef.current) setChatBeside(true);
        return;
      }
      if (data.kind === "defence-desk") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        if (!id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        setDesk({ assessment: data.assessment, student: data.student });
        return;
      }
      if (data.kind === "defended") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        if (!["defended", "not_defended", "clear"].includes(data.outcome)) return;
        fetch(
          scoped(
            BASE + "/api/defence/mark?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment) + "&student=" + encodeURIComponent(data.student) + "&outcome=" + encodeURIComponent(data.outcome),
            props.sessionId
          ),
          { method: "POST" }
        ).then(() => write(["defence"])).catch(() => write(["defence"]));
        return;
      }
      if (data.kind === "defence-audio") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        setDesk({ assessment: data.assessment, student: data.student, preparing: true });
        const settle = (next) => setDesk((open2) => open2 && open2.assessment === data.assessment && open2.student === data.student ? next : open2);
        fetch(
          scoped(
            BASE + "/api/defence/fork?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment) + "&student=" + encodeURIComponent(data.student) + "&inperson=1",
            props.sessionId
          ),
          { method: "POST" }
        ).then((response) => response.json()).then((result) => {
          write(["defence"]);
          if (!result.ok) {
            settle(null);
            window.alert(String(result.error || result.output || "the defence could not be started").trim().split("\n").slice(-2).join(" "));
            return;
          }
          settle({ assessment: data.assessment, student: data.student });
        }).catch((error) => {
          settle(null);
          window.alert("the defence could not be started: " + String(error));
          write(["defence"]);
        });
        return;
      }
      if (data.kind === "homework-forks") {
        const run2 = currentRunRef.current;
        if (!run2 || !/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(String(data.assessment))) return;
        fetch(
          scoped(
            BASE + "/api/homework/forks?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment),
            props.sessionId
          ),
          { method: "POST" }
        ).then((response) => response.json()).then((result) => {
          if (!result.ok) {
            window.alert(String(result.error || result.output || "the forks could not be looked up").trim().split("\n").slice(-2).join(" "));
          }
          write(["files", "defence"]);
        }).catch(() => write(["files", "defence"]));
        return;
      }
      if (data.kind === "defence-fork") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        if (typeof data.url !== "string" || !/^https:\/\/\S+$/.test(data.url.trim())) {
          window.alert("A fork link starts with https://");
          write(["defence"]);
          return;
        }
        fetch(
          scoped(
            BASE + "/api/defence/fork?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment) + "&student=" + encodeURIComponent(data.student) + "&url=" + encodeURIComponent(data.url.trim()),
            props.sessionId
          ),
          { method: "POST" }
        ).then((response) => response.json()).then((result) => {
          if (!result.ok) {
            const said = String(result.error || result.output || "the link was not saved").trim().split("\n").slice(-2).join(" ");
            window.alert(said);
          }
          write(["defence"]);
        }).catch(() => write(["defence"]));
        return;
      }
      if (data.kind === "defence-check") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !id.test(String(data.student)) || !id.test(String(data.criterion))) return;
        if (!["confirmed", "partly", "not_confirmed", "clear"].includes(data.outcome)) return;
        const score = typeof data.score === "number" && Number.isFinite(data.score) ? "&score=" + data.score : "";
        fetch(
          scoped(
            BASE + "/api/defence/mark?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment) + "&student=" + encodeURIComponent(data.student) + "&criterion=" + encodeURIComponent(data.criterion) + "&outcome=" + encodeURIComponent(data.outcome) + score,
            props.sessionId
          ),
          { method: "POST" }
        ).then(() => write(["defence"])).catch(() => write(["defence"]));
        return;
      }
      if (data.kind === "defence") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        fetch(
          scoped(
            BASE + "/api/defence/prepare?run=" + encodeURIComponent(run2) + "&assessment=" + encodeURIComponent(data.assessment) + "&student=" + encodeURIComponent(data.student),
            props.sessionId
          ),
          { method: "POST" }
        ).then((response) => response.json()).then((result) => {
          write(["defence"]);
          if (result.ok && result.ask) {
            props.ask(result.ask);
            return;
          }
          const said = String(result.error || result.output || "no output").trim().split("\n").slice(-3).join(" ");
          props.ask(
            "/defend-submission " + data.assessment + " " + run2 + " " + data.student + " — the clone failed: " + said
          );
        }).catch(() => write(["defence"]));
        return;
      }
      if (data.kind === "scans-place") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run2 = currentRunRef.current;
        if (!run2 || !id.test(String(data.assessment)) || !/^STUDENT-[A-Z0-9]+$/.test(String(data.student))) return;
        const pages = String(data.pages || "");
        enqueuePlacement({
          runId: run2,
          sessionId: props.sessionId,
          assessment: data.assessment,
          file: String(data.file || ""),
          pages,
          answer: { student: data.student },
          onDone: (result) => {
            placedAt.current = Date.now();
            if (result.error || !result.ok) {
              window.alert(
                "pp. " + pages + " was not placed: " + String(result.error || result.output || "no answer").trim().split("\n").slice(-2).join(" ")
              );
            }
            write(["scans", "files"]);
          }
        });
        return;
      }
      if (data.kind === "aw-state") {
        const panel = typeof data.panel === "string" && /^[A-Z0-9][A-Z0-9-]*$/.test(data.panel) ? data.panel : null;
        examWindow.current = panel ? { panel, scroll: Math.max(0, Number(data.scroll) || 0) } : null;
        return;
      }
      if (data.kind === "scans-queue-hello") {
        if (!event.source) return;
        const line = placementsNow();
        const going = placementsWaiting(line) || Date.now() - placedAt.current < 15e3;
        event.source.postMessage(
          { source: "professor-pane", kind: "scans-queue", running: line.running, queued: line.queued, restore: going ? examWindow.current : null },
          "*"
        );
        return;
      }
      if (data.kind === "grade" || data.kind === "scans") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        if (!id.test(String(data.assessment))) return;
        if (data.kind === "scans") setScansPile(data.assessment);
        else setGrading({ assessment: data.assessment, label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.assessment });
        return;
      }
      if (data.kind === "upload") {
        if (!/^[A-Z0-9][A-Z0-9-]*$/.test(String(data.assessment))) return;
        setUploading({
          assessment: data.assessment,
          label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.assessment
        });
        return;
      }
      if (data.kind === "syncs") {
        focusCard("sheets");
        return;
      }
      if (data.kind === "publish") {
        if (typeof data.assessment !== "string" || data.assessment.trim() === "") return;
        openPublish(data.target === "canvas" ? "canvas" : "homework", {
          assessment: data.assessment.trim(),
          label: typeof data.label === "string" ? data.label : data.assessment
        });
        return;
      }
      if (data.kind === "view") {
        const url = materialUrl(data.url);
        if (url === null) return;
        const label = typeof data.label === "string" && data.label.trim() !== "" ? data.label.trim() : "Material";
        const format = typeof data.format === "string" ? data.format.toLowerCase() : "";
        let papers = [];
        try {
          const listed = typeof data.papers === "string" ? JSON.parse(data.papers) : data.papers;
          papers = (Array.isArray(listed) ? listed : []).slice(0, 8).map((paper) => ({
            url: materialUrl(paper && paper.url),
            label: paper && typeof paper.label === "string" && paper.label.trim() !== "" ? paper.label.trim() : "Paper",
            format: paper && typeof paper.format === "string" ? paper.format.toLowerCase() : ""
          })).filter((paper) => paper.url !== null);
        } catch {
          papers = [];
        }
        setMaterial({ url, label, format, papers });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [props.ask]);
  const courses = runs2.phase === "ready" && !runs2.value.error ? runs2.value.courses || [] : [];
  const options = [];
  for (const course of courses) {
    for (const run2 of course.runs) {
      options.push({
        runId: run2.run_id,
        courseId: course.course_id,
        term: run2.term,
        label: course.course_id + " · " + run2.term,
        title: course.title,
        start: run2.start_date,
        end: run2.end_date,
        instructors: run2.instructors || []
      });
    }
  }
  const current = options.find((option) => option.runId === chosen) || options[0] || null;
  currentRunRef.current = current ? current.runId : null;
  useCanvasWatch(
    current ? current.runId : null,
    props.sessionId,
    options.map((option) => option.runId)
  );
  React.useEffect(() => {
    setNames(true);
  }, [current ? current.runId : null]);
  const runPublish = (confirm) => {
    if (!current || !publishing) return;
    setPublishing((state) => ({
      ...state,
      phase: "running",
      text: confirm ? "Publishing…" : "Reading…"
    }));
    fetch(scoped(BASE + "/api/publish?run=" + encodeURIComponent(current.runId), props.sessionId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: publishing.target,
        assessment: (publishing.assessment || "").trim(),
        repo: (publishing.repo || "").trim(),
        group: (publishing.group || "").trim(),
        message: publishing.message || "",
        edit: publishing.edit === true,
        confirm
      })
    }).then((response) => response.json()).then((result) => {
      if (result.error) {
        setPublishing((state) => state && { ...state, phase: "error", text: result.error });
        return;
      }
      setPublishing(
        (state) => state && {
          ...state,
          phase: result.ok ? confirm ? "done" : "preview" : "error",
          text: result.output || "(the command said nothing)"
        }
      );
      if (confirm && result.ok) write([]);
    }).catch(
      (error) => setPublishing((state) => state && { ...state, phase: "error", text: String(error) })
    );
  };
  const mentionAndShow = props.mention && ((text) => {
    const written = props.mention(text);
    if (written && courseModeRef.current) setChatBeside(true);
    return written;
  });
  const startChatWith = props.startChat && current && ((request) => {
    const carried = carryPlace({ ...request, compose: true, run: current.runId });
    props.startChat();
    setTimeout(() => deliverCarried(carried), 1500);
  });
  const body = () => {
    if (runs2.phase === "loading") return h(Message, null, "Reading the workspace…");
    if (runs2.value.error) return h(Message, { error: true }, runs2.value.error);
    if (current === null) {
      return h(
        Message,
        { error: true },
        courses.length === 0 ? "This workspace holds no courses." : "No course here has an offering the course model can read: " + courses.map((course) => course.course_id).join(", ") + ". A run needs version.yaml with start_date and end_date. Run `python -m ainar validate` for the specifics."
      );
    }
    return h(Inspector, {
      runId: current.runId,
      sessionId: props.sessionId,
      revision: everything,
      mention: mentionAndShow,
      openPlace,
      key: current.runId
    });
  };
  return h(
    "div",
    { className: "pp-root" },
    h(
      "div",
      { className: "pp-head" },
      h(
        "div",
        { className: "pp-titlerow" },
        h("div", { className: "pp-title" }, current ? current.title : "Course"),
        // The course's places, over the conversation: the way in when the
        // course navigator is not in the sidebar. Beside Publish because,
        // like it, it is about the run rather than about this column.
        current ? h(
          "button",
          {
            type: "button",
            className: "pp-publishbtn",
            title: "The whole term in three columns over the conversation. Press a hole to have the assistant fill it; Esc returns to the chat.",
            onClick: () => setCourseMode(true)
          },
          "Open course"
        ) : null,
        // Publishing is not a tab and not a sub-view, and putting it here
        // is the argument: every other control in this header chooses what
        // to LOOK at, and this one is the only thing in the pane a person
        // outside this machine ever sees the result of. It sits beside the
        // title because it belongs to the run rather than to whichever
        // view happens to be open — a professor deciding to put the week
        // in front of the class should not first have to be on the right
        // tab. Absent with no offering, since there would be nothing to
        // publish.
        current ? h(
          "button",
          {
            type: "button",
            className: "pp-publishbtn",
            title: "The course page, an announcement, a homework repository or a Canvas brief. Reads and shows a plan first; anything still marked approval: draft is left out.",
            onClick: () => openPublish("page")
          },
          "Publish"
        ) : null,
        // The way in for files the chat cannot take: a scanned pile, an
        // exam paper, its key. Beside Publish because it is the other half
        // of the same edge — what comes in from paper, against what goes out.
        current ? h(
          "button",
          {
            type: "button",
            className: "pp-publishbtn",
            title: "Scanned papers, or an exam paper and its key. Kept outside the course; the assistant is told where they are and asks before filing or grading anything.",
            onClick: () => setUploading(true)
          },
          "Upload"
        ) : null,
        h(
          "button",
          {
            type: "button",
            className: "pp-close",
            "aria-label": "Close the pane",
            onClick: props.closeDetails
          },
          "×"
        )
      ),
      h(
        "p",
        { className: "pp-sub" },
        current ? current.runId + " · " + (current.start && current.end ? current.start + " to " + current.end : "term dates not recorded") : runs2.phase === "loading" ? " " : "no offering"
      ),
      options.length > 1 ? h(
        "select",
        {
          className: "pp-runs",
          value: current ? current.runId : "",
          onChange: (event) => setChosen(event.target.value),
          "aria-label": "Which run"
        },
        options.map(
          (option) => h("option", { value: option.runId, key: option.runId }, option.label)
        )
      ) : null
    ),
    // Marks a grade-sheet sync brought in since this browser last looked,
    // whoever ran it. Above the inspector, since a sync is news wherever one is.
    current ? h(SheetNotice, {
      runId: current.runId,
      sessionId: props.sessionId,
      revision: marksVersion,
      key: "notice|" + current.runId,
      onOpen: () => openPlace({ view: "gradebook" }),
      onSync: () => {
        focusCard("sheets");
      }
    }) : null,
    h("div", { className: "pp-body" }, body()),
    publishing === null ? null : h(PublishModal, {
      state: publishing,
      run: runPublish,
      setTarget: (target) => setPublishField("target", target),
      setField: setPublishField,
      onClose: () => setPublishing(null)
    }),
    courseMode && current ? h(CourseMode, {
      title: current.title || current.label,
      runId: current.runId,
      start: current.start,
      end: current.end,
      request: placeRequest,
      sessionId: props.sessionId,
      dark,
      drafts,
      setDrafts,
      covered: material !== null || publishing !== null || uploading || batch || desk !== null || grading !== null || scansPile !== null,
      onPublish: () => openPublish("page"),
      onUpload: () => setUploading(true),
      // For Files: a pile in the Scans window, the batch in the recordings dialog.
      onOpenScans: (assessment) => setScansPile(assessment),
      onRecordings: () => setBatch(true),
      // For Students, Gradebook and Tasks: the pane's own identity choice, and what the
      // Unpublished view needs to send — the same props its tab gets.
      names,
      setNames,
      ask: props.ask,
      // A press beside an item on the weeks names it in the chat's
      // composer and brings the chat in beside the place.
      mention: mentionAndShow,
      startChat: startChatWith,
      chatTitle: props.chatTitle,
      chatState: props.chatState,
      openPublish,
      // Each view inside names what its own writes changed.
      wrote: write,
      // For Course settings: Preferences is per course and term, and
      // Integrations scrolls to the card a jump named.
      courseId: current.courseId,
      term: current.term,
      integrationsFocus,
      chat: chatBeside,
      setChat: setChatBeside,
      compose: Boolean(placeRequest && placeRequest.compose),
      draft: placeRequest && placeRequest.draft ? { text: placeRequest.draft, n: placeRequest.n } : null,
      onClose: () => {
        setCourseMode(false);
        setPlaceRequest(null);
        setChatBeside(false);
      }
    }) : null,
    desk && current ? h(DefenceDesk, {
      runId: current.runId,
      sessionId: props.sessionId,
      assessment: desk.assessment,
      student: desk.student,
      ask: props.ask,
      reload: deskVersion,
      preparing: Boolean(desk.preparing),
      onClose: () => setDesk(null)
    }) : null,
    grading && current ? h(GradeBoard, {
      runId: current.runId,
      sessionId: props.sessionId,
      assessmentId: grading.assessment,
      title: grading.label,
      names,
      revision: gradeVersion,
      ask: props.ask,
      onWrite: () => write(["grading"]),
      onClose: () => setGrading(null)
    }) : null,
    scansPile && current ? h(ScansModal, {
      runId: current.runId,
      sessionId: props.sessionId,
      pile: scansPile,
      step: scansStep,
      // Opened at Match from Held papers: the held lane first.
      lane: scansStep === "match" ? "held" : null,
      names,
      revision: scansVersion,
      ask: props.ask,
      onWrite: () => write(["scans", "files"]),
      onClose: () => {
        setScansPile(null);
        setScansStep(null);
      }
    }) : null,
    batch && current ? h(BatchModal, {
      runId: current.runId,
      sessionId: props.sessionId,
      onClose: () => setBatch(false)
    }) : null,
    uploading && current ? h(UploadModal, {
      runId: current.runId,
      sessionId: props.sessionId,
      ask: props.ask,
      // Pressed on an assessment's row: which one the papers are.
      assessment: uploading === true ? null : uploading,
      onRecordings: () => setBatch(true),
      onClose: () => setUploading(false)
    }) : null,
    material === null ? null : h(MaterialModal, {
      url: material.url,
      label: material.label,
      format: material.format,
      papers: material.papers,
      // A draft written under course mode's veil is a draft nobody sees:
      // the mention lands in the composer, so the chat comes in beside
      // the place, as for an `ask` from the page.
      mention: mentionAndShow,
      onClose: () => setMaterial(null)
    })
  );
}
var inject = ["slots", "layout", "sessions", "conversation", "workspaces"];
function OpenPaneAction(props) {
  return h(
    "button",
    {
      type: "button",
      className: "pp-tab",
      title: "The course, in the right pane",
      onClick: props.openPane
    },
    "Course"
  );
}

// client/main.js
function apply(ctx) {
  const ask = (sessionId) => (text) => {
    const scope = ctx.sessions.scope(sessionId);
    const session = scope === void 0 ? void 0 : ctx.sessions.sessionOf(scope);
    if (session === void 0) return;
    Promise.resolve(session.prompt([{ type: "text", text }], "queue")).catch(() => {
    });
  };
  const mention = (sessionId) => (text) => {
    const scope = ctx.sessions.scope(sessionId);
    if (scope === void 0) return false;
    const resolver = ctx.conversation === void 0 ? void 0 : ctx.conversation.input;
    const input = resolver === void 0 ? void 0 : resolver.for(scope);
    if (input === void 0 || typeof input.setDraft !== "function") return false;
    let current = "";
    try {
      const state = input.state;
      const snapshot2 = state !== void 0 && typeof state.getSnapshot === "function" ? state.getSnapshot() : void 0;
      const draft = snapshot2 === void 0 ? void 0 : snapshot2.draft;
      if (typeof draft === "string") current = draft;
    } catch {
      current = "";
    }
    const trimmed = current.replace(/\s+$/, "");
    input.setDraft(trimmed === "" ? text : trimmed + " " + text);
    return true;
  };
  ctx.slots.inject(
    "details",
    () => ctx.slots.register(
      {
        name: "details",
        // Lowest renders. `ui-conversation`'s tool-call inspector sits at
        // the default 0; see this file's header for what that displaces and
        // why it currently costs nothing.
        priority: -1,
        inject: (sessionId) => ({
          closeDetails: () => ctx.layout.closeDetails(),
          openDetails: () => ctx.layout.openDetails(),
          ask: ask(sessionId),
          mention: mention(sessionId),
          // A new chat in the open chat's own workspace, opened.
          startChat: () => ctx.workspaces.startSession(),
          // What the open chat is about, read when asked: its durable title,
          // or that nothing has been asked in it yet.
          // Whether the open chat is working, waiting on the professor, or
          // idle, as one word, and a way to hear when that changes — for the
          // Chat button while the chat is put away.
          chatState: {
            get: () => {
              let row;
              try {
                row = ctx.sessions.list.getSnapshot().byId[sessionId];
              } catch {
                row = void 0;
              }
              if (row === void 0) return "idle";
              if (row.pendingInteraction) return "waiting";
              return row.running ? "running" : "idle";
            },
            subscribe: (fn) => ctx.sessions.list.subscribe(fn)
          },
          chatTitle: () => {
            let row;
            try {
              row = ctx.sessions.list.getSnapshot().byId[sessionId];
            } catch {
              row = void 0;
            }
            return row === void 0 ? null : { title: row.title || null, blank: Boolean(row.blank) };
          }
        })
      },
      ProfessorPane
    )
  );
  const STOCK_KEY = "professor-pane:navigator-off";
  let stock = false;
  try {
    stock = window.localStorage.getItem(STOCK_KEY) === "1";
  } catch {
    stock = false;
  }
  let seat = null;
  const seatSidebar = () => {
    if (seat !== null) seat();
    seat = stock ? ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "professor-navigator-return",
          inject: () => ({ showNavigator: () => setStock(false) })
        },
        NavigatorReturn
      )
    ) : ctx.slots.inject(
      "sidebar.workspaces",
      () => ctx.slots.register(
        {
          name: "sidebar.workspaces",
          priority: -1,
          inject: () => ({
            startSession: (workspaceId) => ctx.workspaces.startSession(workspaceId),
            open: (sessionId) => ctx.sessions.open(sessionId),
            showStock: () => setStock(true)
          })
        },
        CourseNavigator
      )
    );
  };
  const setStock = (value) => {
    stock = value;
    try {
      window.localStorage.setItem(STOCK_KEY, value ? "1" : "0");
    } catch {
    }
    seatSidebar();
  };
  seatSidebar();
  ctx.slots.inject(
    "conversation.session.header.actions",
    () => ctx.slots.register(
      {
        name: "conversation.session.header.actions",
        id: "professor-pane",
        order: 10,
        inject: () => ({ openPane: () => ctx.layout.openDetails() })
      },
      OpenPaneAction
    )
  );
}
    if (!Object.prototype.hasOwnProperty.call(module.exports, Symbol.toStringTag)) {
      Object.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
    }
    return module.exports;
  },
});
