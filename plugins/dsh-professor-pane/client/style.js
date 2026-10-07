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
const CSS = `
.pp-root{display:flex;flex-direction:column;height:100%;min-width:0;
  background:var(--dsw-alias-bg-l1,transparent);color:var(--dsw-alias-label-primary,inherit)}
.pp-head{flex:none;padding:10px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-titlerow{display:flex;align-items:baseline;gap:8px;min-width:0}
.pp-title{font-size:13px;font-weight:600;flex:1;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The one control in the header that changes something outside this machine.
   An outline rather than a fill: it opens a dialog and publishes nothing by
   itself, so it should not look like the red button two presses further in. */
.pp-publishbtn{flex:none;font:inherit;font-size:11px;line-height:1;cursor:pointer;
  padding:4px 9px;border-radius:20px;color:var(--dsw-alias-label-secondary,#444);
  background:var(--dsw-alias-fill-l2,transparent);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-publishbtn:hover{color:var(--dsw-alias-label-primary,#111);
  border-color:var(--dsw-alias-label-tertiary,#9a9a9a)}
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
.pp-segbtn{background:0 0;cursor:pointer;padding:2px 8px;font:inherit;font-size:11px;border-radius:20px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-segbtn[aria-pressed=true]{color:var(--dsw-alias-label-primary,#111);font-weight:600;
  border-color:var(--dsw-alias-label-primary,#111)}
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
.pp-danger{color:#b4342a;border-color:#b4342a}
/* Behind: something decided here that has not gone out. Amber, the colour the
   Scans bar gives a step that is yours. */
.pp-behind{font-size:12px;color:#a15c00}
.pp-bookstatus{flex:0 0 auto;max-height:35%;overflow:auto;margin:8px 14px 0}
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
/* Course mode: the term plan as the page, over the harness.
   One layer under the material overlay (4000), because a deck opened FROM
   the term plan must land on top of it, and narrower margins than a deck,
   because three columns of sixteen weeks want the width. */
.pp-veil.pp-coursemode{z-index:3900;padding:14px clamp(10px,2vw,28px) 16px}
.pp-coursebody{flex:1;min-height:0;display:flex;flex-direction:column}
.pp-coursebody .pp-frame{background:transparent}
.pp-coursehead{flex-wrap:wrap}
/* The run picker's look, at a header's size: one control among the buttons. */
.pp-coursehead .pp-jump{width:auto;margin:0;flex:none}
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
.pp-primary{font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:6px 14px;border-radius:20px;
  color:#fff;background:#2f8a4e;border:1px solid #2f8a4e}
.pp-primary:disabled{opacity:.5;cursor:default}
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
.pp-stagedots{display:block;width:130px;height:130px;margin-top:-10px}
.pp-stagebtnlabel{position:absolute;bottom:14px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#444)}
.pp-stagetr{max-width:720px;min-height:3em;font-size:clamp(17px,2.2vw,24px);line-height:1.45;overflow-wrap:anywhere}
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
`;

if (
  typeof document !== "undefined" &&
  document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + "]") === null
) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-professor-pane";
  tag.dataset.pluginCss = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
