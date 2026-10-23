/**
 * The pane's stylesheet, injected once into the page's head.
 */

// ---------------------------------------------------------------- styles

/**
 * One style tag, injected once, owned by this package.
 *
 * The same convention the bundled halves use (`data-plugin` /
 * `data-plugin-css`), so the HMR driver's style inventory can find and
 * remove it, and so a second materialization of this factory does not stack
 * a second copy.
 */
const CSS_ID = "dsh-professor-pane/pane.css";
const PANE_CSS = `
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
/* Publish in course mode's header: outlined in the colour of the send it
   leads to, with the outward arrow; the fill stays for the Send itself. */
.pp-publishbtn.pp-outward{display:inline-flex;align-items:center;gap:4px;color:#b4342a;border-color:rgba(180,52,42,.45)}
.pp-publishbtn.pp-outward:hover:not(:disabled){background:rgba(180,52,42,.07);border-color:#b4342a}
.pp-outwardmark{font-size:11px;line-height:1}
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
.pp-banner-folded{padding:3px 12px 4px}
/* The drafts switch: one button and its count (docs/RIBBONS.md R4). */
.pp-draftswitch{display:inline-flex;align-items:center;gap:5px}
.pp-draftcount{font-size:10.5px;font-weight:600;opacity:.75}
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
/* One row, always: the title and the right-hand controls keep their size,
   and the readings and the drafts switch between them scroll sideways on a
   narrow window rather than pushing Chat and × onto a second line. */
.pp-coursehead{flex-wrap:nowrap}
.pp-headmid{flex:1;min-width:0;display:flex;align-items:center;gap:10px;overflow-x:auto;scrollbar-width:thin}
.pp-headmid::-webkit-scrollbar{height:4px}
.pp-headmid::-webkit-scrollbar-thumb{border-radius:2px;background:var(--dsw-alias-border-l3,#cfcfd6)}
.pp-headmid > *{flex:none}
.pp-headmid > .pp-segspacer{flex:1 0 8px}
.pp-connwait{min-width:16px;padding:0 4px;border-radius:8px;font-size:10px;font-weight:600;line-height:16px;
  text-align:center;color:#fff;background:#a5561f}
/* The chat's text field at the foot of an open place (CourseComposer in materials.js). */
.pp-composer{flex:none;display:flex;align-items:flex-end;gap:8px;margin:8px 16px 12px;padding:8px 8px 8px 14px;border:1px solid var(--dsw-alias-border-l2,#dadce0);border-radius:16px;background:var(--dsw-alias-bg-l1,#fff);box-shadow:0 2px 10px rgba(0,0,0,.06)}
.pp-composer:focus-within{border-color:#2f8a4e}
.pp-composer textarea{flex:1;min-width:0;border:0;outline:0;resize:none;background:transparent;color:inherit;font:inherit;font-size:13.5px;line-height:1.45;padding:5px 0;max-height:33vh}
.pp-composersend{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:#2f8a4e;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
.pp-composersend:disabled{opacity:.35;cursor:default}
/* The run picker's look, at a header's size: one control among the buttons. */
.pp-coursehead .pp-modaltitle{flex:none;max-width:240px;margin-right:6px}
.pp-coursehead label,.pp-cviewbar label{display:inline-flex;gap:5px;align-items:center;font-size:11px;
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
/* Today: three bands — Now, Waiting, Pulse — each row a link into its place. */
.pp-today{display:flex;flex-direction:column;gap:18px;font-size:12px}
.pp-tband h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:11px;font-weight:600;
  letter-spacing:.05em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-tcount{min-width:18px;padding:0 6px;border-radius:9px;font-size:10.5px;line-height:18px;text-align:center;
  letter-spacing:0;color:#fff;background:#a15c00}
.pp-tnow{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-tnowhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.pp-tnowhead b{font-size:16px;font-weight:600}
.pp-tmods{font-weight:500}
.pp-tlist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
.pp-tlist li{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pp-tnow p{margin:0}
.pp-tnowacts{display:flex;gap:6px;flex-wrap:wrap}
.pp-trows{display:flex;flex-direction:column;border-radius:10px;overflow:hidden;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-trow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;font:inherit;text-align:left;cursor:pointer;
  color:inherit;background:var(--dsw-alias-bg-l1,#fff);border:0;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-trow:first-child{border-top:0}
.pp-trow:hover{background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-trow:focus-visible{outline:2px solid #2f6fd6;outline-offset:-2px}
.pp-trow-hot{box-shadow:inset 3px 0 0 #a15c00}
.pp-trowtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.pp-trowtext b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-trowtext span{color:var(--dsw-alias-label-secondary,#555)}
.pp-ttag{flex:none;padding:1px 7px;border-radius:9px;font-size:10.5px;
  color:var(--dsw-alias-label-secondary,#555);background:var(--dsw-alias-fill-secondary,#f0f0f2)}
.pp-ttag-warn{color:#a15c00;background:rgba(161,92,0,.1)}
.pp-tgo{flex:none;font-size:16px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-ttiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:8px}
.pp-ttile{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;font:inherit;text-align:left;
  cursor:pointer;color:inherit;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-ttile:hover{background:var(--dsw-alias-fill-secondary,#f7f7f9)}
.pp-ttile b{font-size:18px;font-weight:600}
.pp-ttile .pp-as{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-ttile-warn{border-color:rgba(161,92,0,.4);background:rgba(161,92,0,.06)}
.pp-ttile-warn b{color:#a15c00}
.pp-ttilehead{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;
  color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-tsyncs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}
.pp-tsyncs .pp-ttilehead{margin-right:4px}
.pp-tsync{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:14px;font:inherit;cursor:pointer;
  color:inherit;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-tsync i{width:7px;height:7px;border-radius:50%;background:#2e7d4f}
.pp-tsync-wait i{background:#a15c00}
.pp-tsync:hover{background:var(--dsw-alias-fill-secondary,#f7f7f9)}
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
/* Canvas card: where the run and Canvas differ, and Sync all. */
.pp-cdiff{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:9px;
  background:var(--dsw-alias-fill-secondary,#f3f3f5)}
.pp-cdiffhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.pp-cdifftitle{font-weight:600}
.pp-cdiffkinds{display:flex;gap:4px;flex-wrap:wrap}
.pp-cdiffkind{display:inline-flex;gap:5px;align-items:baseline;padding:2px 8px;border-radius:7px;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff);cursor:pointer;color:inherit;font-family:inherit}
.pp-cdiffkind[aria-pressed=true]{border-color:#2f6fd6;box-shadow:0 0 0 1px #2f6fd6 inset}
.pp-cdiffkind b{font-weight:600}
.pp-cdiffways{font-size:11.5px;color:var(--dsw-alias-label-secondary,#555)}
.pp-cdiffways .pp-way-conflict{color:#b4342a;font-weight:600}
.pp-dlist{display:flex;flex-direction:column}
.pp-dgroup{font-size:11px;font-weight:600;margin:8px 0 2px;color:var(--dsw-alias-label-secondary,#555)}
.pp-drow{display:flex;flex-direction:column;gap:3px;padding:5px 0;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6);font-size:12px}
.pp-drowline{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.pp-drowwho{flex:1 1 140px;min-width:0;overflow-wrap:anywhere}
.pp-dvals{font-variant-numeric:tabular-nums;white-space:nowrap}
.pp-dvals s{color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.pp-dtag{font-size:10.5px;padding:0 6px;border-radius:10px;white-space:nowrap}
.pp-dtag-push{background:rgba(47,111,214,.12);color:#2456a8}
.pp-dtag-pull{background:rgba(214,130,32,.15);color:#b4600f}
.pp-dtag-conflict{background:rgba(180,52,42,.12);color:#b4342a}
.pp-dtag-held{background:var(--dsw-alias-fill-secondary,#ececef);color:var(--dsw-alias-label-secondary,#555)}
.pp-dwhy{font-size:11px;color:var(--dsw-alias-label-tertiary,#7a7a7a)}
.pp-dacts{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.pp-syncall{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:9px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff);font-size:12px}
.pp-syncall ul{margin:0;padding-left:18px}
/* Course mode · Concepts (concepts.js): concept × student, one hue in five
   steps, darker is stronger — readable in print and without colour vision. */
.pp-cg{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1;font-size:12px;padding:12px 14px 0}
.pp-cg-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pp-cg-shows{display:inline-flex;gap:4px}
.pp-cg-select{width:auto;margin:0;max-width:260px}
.pp-cg-find{font:inherit;font-size:11.5px;padding:3px 8px;border-radius:6px;min-width:160px;color:inherit;
  background:var(--dsw-alias-bg-l1,#fff);border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cg-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary,#555)}
.pp-cg-legend span{display:inline-flex;align-items:center;gap:5px}
.pp-cg-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding-bottom:12px}
.pp-cg-withpanel{grid-template-columns:minmax(0,1fr) 300px}
.pp-cg-scroll{min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l2,#e3e3e6);border-radius:10px}
.pp-cg-table{border-collapse:separate;border-spacing:0}
.pp-cg-table td{padding:1px;text-align:center}
.pp-cg-table td.pp-cg-lit,.pp-cg-litrow td{background:rgba(47,111,214,.08)}
.pp-cg-corner,.pp-cg-colhead{position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-l1,#fff)}
.pp-cg-corner{left:0;z-index:3;min-width:220px;padding:6px 8px;font-size:10.5px;font-weight:500;text-align:left;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cg-colhead{padding:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cg-colhead button{writing-mode:vertical-rl;transform:rotate(180deg);font:inherit;font-size:9.5px;padding:4px 0;width:18px;
  border:0;background:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#555)}
.pp-cg-colhead.pp-cg-lit button{color:#2f6fd6;font-weight:700}
.pp-cg-rowhead{position:sticky;left:0;z-index:1;background:var(--dsw-alias-bg-l1,#fff);padding:0;text-align:left;
  border-right:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-cg-litrow .pp-cg-rowhead{background:rgba(47,111,214,.08)}
.pp-cg-rowhead button{display:flex;align-items:baseline;gap:6px;width:220px;padding:2px 8px;font:inherit;text-align:left;
  border:0;background:none;cursor:pointer;color:inherit}
.pp-cg-ctitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-cg-rowhead small{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-cg-rowhead small.pp-cg-low{color:#a15c00;font-weight:600}
.pp-cg-cell{position:relative;display:inline-block;width:16px;height:16px;padding:0;border-radius:3px;
  border:1px solid transparent;cursor:pointer;vertical-align:middle}
i.pp-cg-cell{cursor:default;flex:none}
.pp-cg-b0{background:#1d4f91}.pp-cg-b1{background:#3f76b8}.pp-cg-b2{background:#7fa6d6}
.pp-cg-b3{background:#bcd0ea}.pp-cg-b4{background:#e7eef8;border-color:#bcd0ea}
.pp-cg-none{background:transparent;border:1px dashed var(--dsw-alias-border-l3,#cfcfd6)}
.pp-cg-thin{opacity:.45}
.pp-cg-sel{outline:2px solid #a15c00;outline-offset:1px}
.pp-cg-state{position:absolute;right:2px;top:2px;width:5px;height:5px;border-radius:50%;background:#a15c00;border:1px solid #fff}
.pp-cg-panel{position:relative;min-height:0;overflow:auto;padding:10px 12px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-cg-panelclose{position:absolute;right:6px;top:6px}
.pp-cg-ptitle{display:flex;flex-direction:column;gap:1px;margin:0 20px 4px 0}
.pp-cg-ptitle b{font-size:13px}
.pp-cg-ptitle span{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-cg-panel .pp-as{margin:0 0 8px}
.pp-cg-sub{margin:10px 0 4px;font-weight:600}
.pp-cg-ev,.pp-cg-list{margin:0 0 10px;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.pp-cg-ev li{display:grid;grid-template-columns:1fr auto;gap:0 8px;padding:5px 0;border-top:1px solid var(--dsw-alias-border-l2,#ececef)}
.pp-cg-ev li small{grid-column:1;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-cg-ev li b{grid-column:2;grid-row:1}
.pp-cg-list li{display:flex;align-items:center;gap:6px}
.pp-cg-list li .pp-linkbtn{margin:0;text-align:left;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-cg-list li small{flex:none;color:var(--dsw-alias-label-tertiary,#6b6b6b)}
.pp-cg-spread{display:flex;flex-direction:column;gap:3px;margin-bottom:6px}
.pp-cg-spreadrow{display:flex;align-items:center;gap:6px}
.pp-cg-spreadrow b{margin-left:auto}
/* Course mode · Sync: Sync all on top, grouped by which way data runs. */
.pp-syncview{display:flex;flex-direction:column;gap:12px;font-size:12px}
.pp-syncallx{display:flex;flex-direction:column;gap:8px}
.pp-sxgroup{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border-radius:9px;
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6);background:var(--dsw-alias-bg-l1,#fff)}
.pp-sxgroup ul{margin:0;padding-left:18px}
.pp-sxout{border-color:rgba(180,52,42,.35);background:rgba(180,52,42,.04)}
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
/* One pane alone, as a part of course mode's Gradebook: the page is its height. */
.pp-gbpanes.pp-gbpanes-one{grid-template-columns:minmax(0,1fr);height:auto;max-width:880px}
.pp-gbpanes.pp-gbpanes-one > .pp-gbpane{overflow:visible;max-height:none}
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

if (
  typeof document !== "undefined" &&
  document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + "]") === null
) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-professor-pane";
  tag.dataset.pluginCss = CSS_ID;
  tag.textContent = PANE_CSS;
  document.head.appendChild(tag);
}
