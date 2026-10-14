// Built by client/build.mjs from client/*.js — edit those, then `npm run build`.
/**
 * The browser half: the right column of the harness, as the professor's pane.
 *
 * Hand-written in the module loader's registration form rather than bundled.
 * Every client half in `node_modules/@deepseek-ai` is this same shape —
 * `window.__ModuleLoader__.load({ id, factory })`, a factory that takes a
 * synchronous `require` and returns `module.exports` — so the format is the
 * loader's contract and not a private artefact of anybody's tsdown config.
 * `package.json` says why there is no build step.
 *
 * WHICH SEAT THIS IS, AND WHAT IT DISPLACES
 * -----------------------------------------
 * `details` is the third column of `ui-layout`'s AppFrame: the right pane. It
 * is a `single` slot, so a second registration does not sit beside the first —
 * it shadows it, and the lowest priority renders. `ui-conversation` registers
 * its tool-call inspector there at the default priority 0, so this pane
 * registers at -1 and wins.
 *
 * That is a displacement and worth stating plainly. What it costs is nothing
 * today: the only thing that opens that inspector is the `openDetails(target)`
 * action `ui-conversation` hands to `conversation.chat.node` registrants, and
 * no shipped registrant calls it — the panel is unreachable in the running
 * harness. The same call's data is in the trajectory view, which has its own
 * seat in the conversation column. If a future DSH wires a "view details"
 * control up, this pane's priority is the one line to reconsider.
 *
 * WHAT IT DRAWS
 * -------------
 * A row of buttons. Most of them put a document into a sandboxed frame with its
 * payload already inside it — either `dsh-ainar-course-model`'s own widget, so
 * the term plan a professor sees here is the same document ChatGPT and Claude
 * Desktop get from the same bytes with no second implementation to drift, or a
 * page `index.js` assembles for a view no widget covers.
 *
 * Two are drawn here instead: Preferences and Integrations. Both have a form,
 * and a form cannot go in the frame — it is delivered as `srcdoc` without
 * `allow-same-origin`, so a document inside it has an opaque origin and cannot
 * call back to the routes a Save would need. See `WidgetFrame`.
 *
 * The pane computes no figure, which is the rule the widgets are held to and
 * the reason they are worth reusing rather than reimplementing. Every number in
 * here arrived in a payload; this file formats dates by printing the strings it
 * was given and does no arithmetic at all.
 */

window.__ModuleLoader__.load({
  id: "dsh-professor-pane",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ── client/react.js

    const React = require("react");
    // For one thing only: the material overlay. Everything else in this file
    // renders inside the column; a deck cannot, so it is portalled to the body.
    const ReactDOM = require("react-dom");
    const h = React.createElement;

    // ── client/tabs.js

    /** Kept in step with `BASE` in server/http.js by hand; there are two of them. */
    const BASE = "/professor-pane";

    /**
     * `?session=` on every request.
     *
     * It is what makes the pane follow the workspace picked in the sidebar. The
     * host turns the id into a directory through dsh's own workspace registry,
     * so this side never sends a path — see `inject` in index.js for why that
     * matters. An id the registry does not account for falls back to
     * AINAR_WORKSPACE, which is the same answer as sending nothing.
     */
    function scoped(path, sessionId) {
      return path + (path.indexOf("?") === -1 ? "?" : "&") + "session=" + encodeURIComponent(sessionId);
    }

    /** How often to ask whether the course model on disk has moved. */
    const REVISION_POLL_MS = 2500;

    /**
     * Redraw when something outside the pane writes to the workspace.
     *
     * The pane knew about its own writes — a publication bumped `reload` — and
     * about nothing else. An agent setting a due date, a draft accepted in an
     * editor, a file edited by hand: all of them left the professor reading a
     * page that no longer matched the record, with nothing on screen to say so.
     * A course model is the sort of thing two people and a model all write to,
     * so "it changed" has to be observed rather than assumed.
     *
     * `/api/revision` hashes the size and mtime of every YAML under `courses/`. This polls it and calls `onChange` when the answer differs
     * from the last one seen.
     *
     * Three things this deliberately does not do:
     *
     * - **It does not fire on the first answer.** The first response only
     *   establishes the baseline; treating it as a change would reload the
     *   frame once on every mount, which looks like a flicker and costs a
     *   payload.
     * - **It does not poll a hidden tab.** `visibilitychange` restarts it, and
     *   the check on becoming visible is immediate — the case where the record
     *   changed while the professor was elsewhere is exactly the case worth
     *   catching promptly.
     * - **It does not treat a failed request as a change.** A harness restart
     *   would otherwise reload the frame repeatedly while the server is down.
     */
    function useRevisionWatch(url, onChange) {
      const seen = React.useRef(null);
      const changed = React.useRef(onChange);
      changed.current = onChange;

      React.useEffect(() => {
        if (url === null) return undefined;
        seen.current = null;
        let live = true;
        let timer = null;

        const check = () => {
          if (!live) return;
          fetch(url, { headers: { accept: "application/json" } })
            .then((response) => response.json())
            .then((value) => {
              if (!live || !value || typeof value.revision !== "string") return;
              if (seen.current === null) {
                seen.current = value.revision;
                return;
              }
              if (seen.current !== value.revision) {
                seen.current = value.revision;
                changed.current();
              }
            })
            .catch(() => {
              // The harness restarting, or the workspace briefly unreadable.
              // Keep the last revision and try again on the next tick.
            });
        };

        const start = () => {
          if (timer !== null) return;
          timer = setInterval(check, REVISION_POLL_MS);
        };
        const stop = () => {
          if (timer === null) return;
          clearInterval(timer);
          timer = null;
        };
        const onVisibility = () => {
          if (document.visibilityState === "visible") {
            check();
            start();
          } else {
            stop();
          }
        };

        onVisibility();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
          live = false;
          stop();
          document.removeEventListener("visibilitychange", onVisibility);
        };
      }, [url]);
    }

    /**
     * The button bar, in order.
     *
     * `id` is this file's vocabulary; `view` is the path segment `index.js`
     * knows. "Course outline" is labelled as the student's view because that is
     * what the widget is — the term plan as a student reads it — and the
     * professor asking for it asked for it by that name.
     */
    const TABS = [
      { id: "outline", label: "Course outline", hint: "Student's view", view: "outline" },
      { id: "students", label: "Students", hint: "The class list, by subgroup", view: "students" },
      { id: "progress", label: "Progress", hint: "The class, by concept", view: "progress" },
      { id: "tasks", label: "Tasks", hint: "What is waiting for you", view: "tasks" },
      // `view: null` for Integrations' reason: it calls back, to say who a paper is.
      { id: "scans", label: "Scans", hint: "Paper exams: who each paper is, and where the pile stands", view: null },
      { id: "preferences", label: "Preferences", hint: "What the skills assume", view: null },
      // Last, deliberately. It is the tab a professor opens twice a term —
      // when a course is wired up, and when a push does not arrive — rather
      // than the one they live in, and the five before it are all about the
      // course itself. `view: null` for Preferences' reason: it carries a form.
      {
        id: "integrations",
        label: "Integrations",
        hint: "What this course is wired to",
        view: null,
      },
    ];

    /**
     * The documents behind a tab, where a tab has more than one.
     *
     * Each entry is a real view of the run, not a filter over one payload: the
     * segmented row swaps which document the frame loads. A tab absent from this
     * table draws the single view named in `TABS`.
     *
     * The FIRST entry is the default, so it should be the one a professor opens
     * the tab expecting. `outline` leads with the weeks because that is what
     * "course outline" means to them; `tasks` leads with Pending because a thing
     * awaiting judgement outranks a thing merely drafted.
     */
    const SUBVIEWS = {
      // Week by week is first, and therefore the default: the term as it runs
      // is what the tab is for. The four beside it answer "what have I got",
      // which used to be answerable only by scrolling sixteen weeks.
      outline: [
        { id: "outline", label: "Week by week" },
        { id: "grading", label: "Grading policy" },
        { id: "assessments", label: "Assessments" },
        { id: "slides", label: "Slides" },
        { id: "exams", label: "Exams" },
      ],
      progress: [
        { id: "progress", label: "Concepts" },
        { id: "gradebook", label: "Gradebook" },
      ],
      // Pending, then Ready, then Checklist: the order is how close a thing is
      // to being finished. Pending is work awaiting the professor's judgement,
      // Ready is work awaiting their approval, and Checklist is what nobody has
      // started. Pending stays the default because a thing awaiting judgement
      // outranks a thing merely drafted, and both outrank a thing not yet
      // written.
      tasks: [
        { id: "tasks", label: "Pending" },
        { id: "ready", label: "Ready" },
        { id: "checklist", label: "Checklist" },
        // Last: not work to do on the course but what has not left it yet —
        // marks Canvas does not have, materials changed since publishing.
        { id: "unpublished", label: "Unpublished" },
      ],
      // Regrouped by service (2026-10-13). This course is one card per service —
      // Canvas's took over Status, Targets and Links, and the sheet's and
      // GitHub's took over Syncs. Credentials goes when Accounts replaces it.
      integrations: [
        { id: "course", label: "This course" },
        { id: "credentials", label: "Credentials" },
      ],
    };

    /** The default sub-view for a tab: the first one listed. */
    const defaultSub = (tabId) => (SUBVIEWS[tabId] ? SUBVIEWS[tabId][0].id : null);

    /**
     * Tabs that draw no Record / + drafts pair.
     *
     * Not the same as "no sub-views": a tab absent from `SUBVIEWS` still gets
     * the pair, because most single-document views have a drafted half worth
     * seeing. These two do not — Preferences is not a view of a run, and the
     * class list has no drafted half: enrollments are not agent-writable and
     * carry no approval.
     *
     * Students is in this set and still draws a row: the identity pair below
     * is its own control and has nothing to do with drafts.
     *
     * Integrations is in it for Preferences' reason and one sharper one. Its
     * subject is what the run is wired to — a Canvas host, a token, a section
     * id — and none of that is drafted: `versions` is not agent-writable, so
     * there is no proposed half of an LMS linkage anywhere for a `+ drafts`
     * press to reveal.
     */
    const NO_DRAFT_PAIR = new Set(["preferences", "students", "integrations", "scans"]);

    /** Tabs with no segmented row of any kind. */
    const NO_SEGMENTED_ROW = new Set(["preferences"]);

    /**
     * Tabs whose document can name a student, and therefore draw the pair.
     *
     * The class list, and the inbox — where the missing-submission rows and the
     * open signals are about particular people. Nowhere else: the outline, the
     * gradebook and the concept grid are about the class, and a parameter that
     * reached them would be a parameter with nothing to do.
     */
    // Integrations for its Syncs view: "Ostanin Artym → Ostanin Artem" is a
    // decision a professor can make; "→ STUDENT-B7K2QA" is not.
    const NAMED_TABS = new Set(["students", "tasks", "scans", "integrations"]);

    /**
     * Pseudonyms or real names, on the tabs that name people.
     *
     * The record holds pseudonyms and this does not change that — it asks the
     * host to resolve them against `~/.ainar/roster/people.json` for the length
     * of one render. Nothing is written and nothing leaves the machine.
     *
     * **Names are the default**, at the professor's instruction. A class list
     * is a list of people, and the argument for opening on pseudonyms was
     * about one situation — a screen shared in a meeting or thrown at a
     * lecture-hall projector — rather than about the ordinary case of a
     * professor reading their own roster at their own desk. Optimising every
     * use for the rarer one made the common one worse.
     *
     * The projector case is still handled, by the two things that survive the
     * flip: `Pseudonyms` is one press away and stays on screen as a control, so
     * covering the list before plugging in the HDMI is a single click; and the
     * band across the top of the view says names are showing, so nobody has to
     * remember which mode they left it in.
     *
     * On Tasks there is no band, because that document is a widget and the pane
     * does not write inside one. What carries the warning there is the amber on
     * the `Names` button itself, which is in the pane's own chrome, is on screen
     * whenever the tab is, and is the control that turns it off.
     */
    const IDENTITY_MODES = [
      { label: "Names", names: true, hint: "real names from your private roster" },
      {
        label: "Pseudonyms",
        names: false,
        hint: "STUDENT-XXXXXX — press before screen-sharing or projecting",
      },
    ];

    /**
     * Which halves of the course a view is computed over.
     *
     * Not a display option. Drafts live in the course, marked `approval:
     * draft` (a grade: `status: suggested`). "Record" answers what a student
     * may be shown — only what has been accepted; "+ drafts" answers what the
     * term looks like with every proposal in it. They are different questions
     * and the pane never shows the second silently: it carries a banner.
     */
    const DRAFT_MODES = [
      { label: "Record", drafts: false, hint: "only what has been accepted" },
      { label: "+ drafts", drafts: true, hint: "including records marked approval: draft" },
    ];

    // ── client/style.js

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
.pp-filetable td:first-child{max-width:0;width:55%}
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
.pp-coursebody{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
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
/* Integrations → This course. A strip of what needs the professor, then one
   card per service. The card is the sync card's shape, grown: a header with
   the service's mark, its rows below, and Details folded at the foot. */
.pp-course{display:flex;flex-direction:column;gap:10px}
.pp-needs{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;
  background:rgba(214,130,32,.09);border:1px solid rgba(214,130,32,.28)}
.pp-needstitle{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#b4600f;font-weight:600}
.pp-needsrow{display:flex;gap:8px;align-items:center;font-size:12px}
.pp-needsrow > span{flex:1;min-width:0}
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

    // ── client/common.js

    // ------------------------------------------------------------- fetching

    /**
     * One JSON read, with a network failure turned into the same `{ error }`
     * shape the route uses for a course-model failure.
     *
     * The pane has exactly one way to say "this did not work", and it prints
     * whatever text it was given. That is deliberate: the interesting failures
     * here are the course model's own sentences — "no course run 'X' in this
     * workspace", "AINAR_WORKSPACE is not set" — and a pane that classified
     * them into its own categories would be paraphrasing the only useful part.
     */
    function useJson(url) {
      const [state, setState] = React.useState({ phase: "loading" });
      React.useEffect(() => {
        if (url === null) return undefined;
        let live = true;
        setState({ phase: "loading" });
        fetch(url, { headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((value) => {
            if (live) setState({ phase: "ready", value: value });
          })
          .catch((error) => {
            if (live) setState({ phase: "ready", value: { error: String(error.message || error) } });
          });
        return () => {
          live = false;
        };
      }, [url]);
      return state;
    }

    /**
     * The draft loader's complaints, off the response header.
     *
     * A header value carries no newlines and nothing outside Latin-1, so the
     * route percent-encodes one line and this is the other half of that. A
     * header that is absent means the loader had nothing to say, which is not
     * the same as drafts being off — `x-professor-pane-drafts` says that.
     */
    function decodeIssues(raw) {
      if (!raw) return [];
      try {
        return decodeURIComponent(raw).split(" | ").filter(Boolean);
      } catch {
        return [];
      }
    }

    /** Whether the harness is currently painting dark, read off the body. */
    function useDark() {
      const read = () =>
        typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme");
      const [dark, setDark] = React.useState(read);
      React.useEffect(() => {
        // `ui-layout`'s theme presenter writes the attribute on every resolved
        // theme change, so watching the attribute catches a theme switch
        // without this package having to inject the `theme` service and hold a
        // second subscription to the same fact.
        const observer = new MutationObserver(() => setDark(read()));
        observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
        return () => observer.disconnect();
      }, []);
      return dark;
    }

    // ---------------------------------------------------------------- views

    function Message(props) {
      return h("div", { className: "pp-msg" + (props.error ? " pp-err" : "") }, props.children);
    }

    // ── client/preferences.js

    /**
     * One preference layer.
     *
     * The keys are flattened to dotted paths because that is how DataLayer's
     * own documentation names them (`presentation.audience`), and because the
     * nesting is two or three deep and an indented tree in a 360px column reads
     * worse than the path does. A value that is a list is joined; a value that
     * is `ask` is left as the word, which is the whole point of that value.
     */
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
          value: Array.isArray(value) ? value.join(", ") : String(value),
        });
      };
      if (layer.values) walk(layer.values, "");

      return h(
        "div",
        { className: "pp-layer" },
        h("p", { className: "pp-layername" }, layer.label + " · " + layer.scope),
        h("p", { className: "pp-layerpath" }, layer.path),
        layer.error
          ? h("p", { className: "pp-absent" }, "This file could not be parsed: " + layer.error)
          : !layer.present
            ? h("p", { className: "pp-absent" }, "No file here. Nothing at this layer.")
            : rows.length === 0
              ? h("p", { className: "pp-absent" }, "The file has no `values` block.")
              : rows.map((row) =>
                  h(
                    "div",
                    { className: "pp-pref", key: row.key },
                    h("span", { className: "pp-prefkey" }, row.key),
                    h("span", { className: "pp-prefval" }, row.value),
                  ),
                ),
      );
    }

    /** A layer's `values` tree as the dotted paths the schema speaks in. */
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

    /**
     * What a setting would be if this layer said nothing, and who said it.
     *
     * The layers arrive in resolution order, so everything BEFORE the selected
     * one is what it would inherit. This is the difference between a form that
     * can be filled in safely and one that cannot: a professor typing into an
     * empty box needs to know they are replacing `true` from the DataLayer
     * defaults, not filling a hole.
     */
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

    /**
     * The preference layers: which file says what, and a form for the three
     * that are the professor's.
     *
     * **The picker is the view.** Selecting a layer shows its path, its own
     * values as controls, and what each one would inherit if it said nothing —
     * so "which file said it", the question this tab exists for, is answered by
     * the row rather than by scrolling four stacked lists. `All layers` keeps
     * the stacked read-only form for when the whole resolution is the question.
     *
     * **A blank control means inherit, not empty.** A layer overrides only the
     * keys it names, so clearing a box removes the key rather than writing an
     * empty one. That is why every control offers `inherit` explicitly instead
     * of leaving the professor to guess what an empty box does.
     *
     * **The form is built from the schema the host derived from
     * `defaults.yaml`**, which is the list of what DataLayer actually reads. A
     * control here cannot write a setting nothing consults, and a setting the
     * defaults grow appears here without this file changing.
     *
     * The DataLayer defaults themselves are not editable: they ship with the
     * harness, they are the same for every professor, and a pane that let one
     * be edited would be editing the installation rather than the course.
     */
    function Preferences(props) {
      const url = scoped(
        BASE +
          "/api/preferences?course=" +
          encodeURIComponent(props.courseId || "") +
          "&term=" +
          encodeURIComponent(props.term || ""),
        props.sessionId,
      );
      const state = useJson(url);
      // What a Save handed back, which is the file as it now is. Preferred over
      // the fetch so the form redraws from disk rather than from its own memory
      // of what was typed.
      const [fresh, setFresh] = React.useState(null);
      const [scope, setScope] = React.useState("professor");
      const [edits, setEdits] = React.useState({});
      const [status, setStatus] = React.useState(null);

      const data =
        fresh || (state.phase === "ready" && !state.value.error ? state.value : null);

      // Reseed whenever the file changes under the form or the layer changes.
      // Keyed on `phase` and the save counter rather than on `data`, because a
      // fetch hook that returns a fresh object each render would make an effect
      // depending on the object itself run forever.
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
        editable
          .map((layer) =>
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                "aria-pressed": scope === layer.scope,
                title: layer.path,
                onClick: () => setScope(layer.scope),
                key: layer.scope,
              },
              layer.label,
            ),
          )
          .concat([
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                "aria-pressed": scope === "all",
                title: "Every layer as it stands, including the DataLayer defaults",
                onClick: () => setScope("all"),
                key: "all",
              },
              "All layers",
            ),
          ]),
      );

      if (scope === "all" || !chosen) {
        return h(
          "div",
          { className: "pp-prefwrap" },
          picker,
          h(
            "div",
            { className: "pp-scroll" },
            layers.map((layer) => h(Layer, { layer: layer, key: layer.scope })),
            h("p", { className: "pp-absent" }, data.note),
          ),
        );
      }

      const setField = (path, value) =>
        setEdits((previous) => Object.assign({}, previous, { [path]: value }));

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
              className: className,
              value: current,
              onChange: (event) => setField(field.path, event.target.value),
            },
            [h("option", { value: "", key: "" }, "inherit")].concat(
              options.map((option) => h("option", { value: option, key: option }, option)),
            ),
          );
        }
        return h("input", {
          className: className,
          type: field.type === "number" ? "number" : "text",
          step: "any",
          value: current,
          // The inherited value, so an empty box shows what it is deferring to
          // rather than looking unset.
          placeholder: inherited === null ? "inherit" : String(inherited.value),
          onChange: (event) => setField(field.path, event.target.value),
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
                inherited === null
                  ? "nothing below sets this"
                  : String(inherited.value) + " · " + inherited.label,
              ),
            ),
            control(field),
          ),
        );
      }

      const save = () => {
        setStatus("saving");
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: scope, values: edits }),
        })
          .then((response) => response.json())
          .then((body) => {
            if (body.error) {
              setStatus({ error: body.error });
              return;
            }
            setFresh(body);
            setStatus({ saved: body.saved });
          })
          .catch((error) => setStatus({ error: String((error && error.message) || error) }));
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
          chosen.error
            ? h("p", { className: "pp-saveerr" }, "This file could not be parsed: " + chosen.error)
            : null,
          h(
            "p",
            { className: "pp-absent" },
            chosen.present
              ? "This file exists. It overrides only the settings it names."
              : "No file here yet. Saving a setting creates it; saving nothing does not.",
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
                onClick: save,
              },
              status === "saving" ? "Saving…" : "Save to this layer",
            ),
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                onClick: () => {
                  setEdits(flattenValues(chosen.values));
                  setStatus(null);
                },
              },
              "Revert",
            ),
            status && status.error
              ? h("span", { className: "pp-saveerr" }, status.error)
              : saved
                ? h(
                    "span",
                    { className: "pp-savenote" },
                    saved.written
                      ? "Wrote " + saved.count + " setting" + (saved.count === 1 ? "" : "s") + "."
                      : "Nothing set, so no file was created.",
                  )
                : null,
          ),
        ),
      );
    }

    // ── client/integration-parts.js

    // ------------------------------------------------------------ integrations

    /** A row: what it is called, what it is set to, and a note underneath. */
    function Fact(props) {
      return h(
        "div",
        { className: "pp-fact" },
        h(
          "span",
          { className: "pp-factkey" },
          props.label,
          props.note ? h("span", { className: "pp-factnote" }, props.note) : null,
        ),
        h(
          "span",
          { className: "pp-factval" + (props.missing ? " pp-factmissing" : "") },
          props.children,
        ),
      );
    }

    /**
     * Present or not, as the same two words everywhere.
     *
     * Never the value, and there is no parameter here that could carry one —
     * the host half sends a boolean. A token rendered into this pane would be a
     * grade-changing credential on a screen that gets projected.
     */
    function Presence(props) {
      return props.present
        ? h("span", { className: "pp-yes" }, props.yes || "set")
        : h("span", { className: "pp-no" }, props.no || "not set");
    }

    /**
     * One credential field: type it in, press Save, never see it again.
     *
     * The input is uncontrolled after a save — `setValue("")` clears it — and
     * there is no code path that puts a stored value back into it. That is
     * deliberate and is the difference between a field and a display: a box
     * pre-filled with the current token would put the token on the screen,
     * which is the one thing this whole tab is built not to do.
     *
     * `writable: false` disables it rather than hiding it. Hiding would leave
     * a professor wondering where the field went; disabling with the reason
     * beside it says "you already set this, in your shell, and that is where
     * to change it".
     */
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
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ref: props.name, value }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            // Cleared whether or not the write succeeded. A rejected token
            // left sitting in the box is a token on the screen, and the
            // professor has it in their clipboard either way.
            setValue("");
            if (body.error) {
              setPhase("idle");
              if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
              return;
            }
            setPhase("idle");
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => {
            setValue("");
            setPhase("idle");
            if (props.onStatus) {
              props.onStatus({ error: String((error && error.message) || error), from: props.name });
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
          },
        }),
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: !writable || phase === "saving" || !value.trim(),
            onClick: submit,
          },
          phase === "saving" ? "Saving…" : "Save",
        ),
        status.configured && writable
          ? h(
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
                      props.sessionId,
                    ),
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ ref: props.name, value: "" }),
                    },
                  )
                    .then((response) => response.json())
                    .then((body) => {
                      setPhase("idle");
                      if (body.error) {
                        if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
                        return;
                      }
                      if (props.onSaved) props.onSaved(body);
                    })
                    .catch(() => setPhase("idle"));
                },
              },
              "Clear",
            )
          : null,
      );
    }

    /**
     * Connect Google: sign in once, and the grade-sheet syncs reach the
     * professor's own spreadsheets with no key to download or share.
     *
     * Connect is a LINK into a new tab, not a button that fetches and then opens
     * one: a window opened after an await is a pop-up, and browsers block those.
     * The tab goes to Google and comes back to the pane's server, which saves the
     * sign-in and says so. Nothing comes back to this page, so it re-reads when
     * the professor returns to it — the first focus after pressing Connect.
     *
     * The token is never on this page in any form. What is drawn is whether a
     * sign-in is saved and the account it answered as.
     */
    function GoogleConnect(props) {
      const google = props.google || {};
      const client = google.client || {};
      const [waiting, setWaiting] = React.useState(false);
      const [phase, setPhase] = React.useState("idle");
      const [error, setError] = React.useState(null);
      const [note, setNote] = React.useState(null);

      React.useEffect(() => {
        if (!waiting) return undefined;
        const back = () => {
          setWaiting(false);
          if (props.onChanged) props.onChanged();
        };
        window.addEventListener("focus", back);
        return () => window.removeEventListener("focus", back);
      }, [waiting]);

      const disconnect = () => {
        setPhase("working");
        setError(null);
        setNote(null);
        fetch(BASE + "/api/google/disconnect", { method: "POST" })
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) {
              setError(body.error);
              return;
            }
            setNote(body.detail || "Disconnected. Google has been told to forget the sign-in.");
            if (props.onChanged) props.onChanged();
          })
          .catch((failure) => {
            setPhase("idle");
            setError(String((failure && failure.message) || failure));
          });
      };

      const connectLink = (label) =>
        h(
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
            },
          },
          label,
        );

      let body;
      if (!client.present) {
        body = h(
          "p",
          { className: "pp-absent" },
          "Not set up on this machine yet. Download the Desktop app OAuth client from the Google " +
            "Cloud console (Google Auth Platform → Clients) and save it as " +
            client.path +
            ". Then come back here.",
        );
      } else if (client.error) {
        body = h("p", { className: "pp-saveerr" }, client.error);
      } else if (google.connected) {
        body = h(
          "div",
          { className: "pp-saverow" },
          h(Presence, { present: true, yes: google.account ? "connected as " + google.account : "connected" }),
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: phase === "working", onClick: disconnect },
            phase === "working" ? "Disconnecting…" : "Disconnect",
          ),
          connectLink("Switch account"),
        );
      } else {
        body = h(
          "div",
          { className: "pp-saverow" },
          connectLink(google.broken ? "Reconnect Google" : "Connect Google"),
          waiting
            ? h("span", { className: "pp-savenote" }, "Finish the sign-in in the new tab, then come back here.")
            : google.broken
              ? h("span", { className: "pp-saveerr" }, "The saved sign-in is incomplete. Connecting again fixes it.")
              : null,
        );
      }

      return h(
        "div",
        null,
        h("p", { className: "pp-factgroup" }, "Google"),
        h(
          "p",
          { className: "pp-absent" },
          "Lets the grade-sheet syncs read and write the spreadsheets your Google account can edit. " +
            "The sign-in is kept in the harness's credential store; grades go from Google to this " +
            "machine with no server in between.",
        ),
        body,
        error ? h("p", { className: "pp-saveerr" }, error) : null,
        note ? h("p", { className: "pp-savenote" }, note) : null,
      );
    }

    /**
     * What each provider's setup form asks for.
     *
     * A table rather than a component per provider, because the four forms
     * differ only in which of these rows they draw and what the placeholder
     * says. A fifth provider is an entry in `integrationsFor` on the host
     * side and nothing at all here.
     */
    const SETUP_FIELDS = {
      baseUrl: {
        label: "Address",
        type: "url",
        placeholder: "https://canvas.your-university.edu",
      },
      chatId: {
        label: "Channel",
        type: "text",
        placeholder: "@course_channel, or the numeric id",
      },
      sheetId: {
        label: "Spreadsheet",
        type: "text",
        placeholder: "the URL, or the id between /d/ and /edit",
      },
      token: {
        label: "Access token",
        type: "password",
        placeholder: "paste the token",
      },
    };

    /** What each provider calls its token, and where it comes from. */
    const TOKEN_HINT = {
      canvas: "Canvas → Account → Settings → New Access Token",
      telegram: "the token @BotFather gave you when the bot was created",
      moodle: "Moodle → Preferences → Security keys",
      sheets: "an access token, or leave empty and use a service-account key",
    };

    /**
     * Set one integration up, or fill in the half that is missing.
     *
     * The token box is cleared on every outcome, success or refusal: a
     * rejected token left in the box is a token on a screen that gets
     * projected, and the professor has it in their clipboard either way.
     *
     * Nothing is ever pre-filled from what is stored. The address could be
     * shown safely and the token could not, and a form where one field
     * remembers and the other does not is a form that invites somebody to
     * press Save with an empty token and wonder why it stopped working.
     */
    function ProviderSetup(props) {
      const spec = props.integration;
      const [values, setValues] = React.useState({});
      const [phase, setPhase] = React.useState("idle");
      const [failed, setFailed] = React.useState(null);

      const set = (key, value) => setValues(Object.assign({}, values, { [key]: value }));
      // Every provider needs its destination; the token can be supplied later
      // or through the environment, so it never gates Save.
      const required = (spec.fields || []).filter((field) => field !== "token");
      const ready = required.every((field) => String(values[field] || "").trim());

      const submit = () => {
        setPhase("saving");
        setFailed(null);
        fetch(
          scoped(
            BASE + "/api/integrations/setup?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(Object.assign({ provider: spec.id }, values)),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            setValues(Object.assign({}, values, { token: "" }));
            setPhase("idle");
            if (body.error) {
              setFailed(body.error);
              return;
            }
            setValues({});
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => {
            setValues(Object.assign({}, values, { token: "" }));
            setPhase("idle");
            setFailed(String((error && error.message) || error));
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
              field === "token" ? meta.label + " — " + (TOKEN_HINT[spec.id] || "") : meta.label,
            ),
            h("input", {
              className: "pp-fieldbox",
              type: meta.type,
              autoComplete: "off",
              spellCheck: false,
              placeholder: meta.placeholder,
              value: values[field] || "",
              disabled: phase === "saving",
              onChange: (event) => set(field, event.target.value),
            }),
          );
        }),
        h(
          "p",
          { className: "pp-absent" },
          "Everything but the token is saved outside this repository, in the connections " +
            "registry or the run record. The token goes to the harness's credential store " +
            "and is never shown again.",
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
              onClick: submit,
            },
            phase === "saving" ? "Saving and checking…" : "Save and check",
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
              },
            },
            "Cancel",
          ),
        ),
        failed ? h("p", { className: "pp-saveerr" }, failed) : null,
      );
    }

    /**
     * A title reduced to what two systems are likely to agree on.
     *
     * Case, punctuation and runs of space go; the words stay. It is enough to
     * pair "Model Evaluation Assignment" with "Model evaluation assignment"
     * and honest about being a suggestion rather than a fact — nothing here
     * saves on its own.
     */
    const normaliseTitle = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04ff]+/g, " ")
        .trim();

    /**
     * Pair each assessment with the Canvas assignment it most likely is.
     *
     * Three passes, weakest last: an exact normalised title, then one title
     * containing the other, then a unique match on what it is out of. A
     * Canvas assignment is claimed by at most one assessment, so a second
     * assessment with the same name gets nothing rather than a duplicate —
     * two assessments pointing at one column is the mistake the validator
     * calls `lms.duplicate_link`, and suggesting it would be rude.
     */
    const suggestPairs = (assessments, assignments) => {
      const taken = new Set();
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
          assignments.find((a) => !taken.has(a.id) && normaliseTitle(a.name) === wanted),
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
          }),
        );
      });

      for (const entry of stillLeft) {
        if (entry.maximumScore === null || entry.maximumScore === undefined) continue;
        const sameScore = assignments.filter(
          (a) => !taken.has(a.id) && a.points !== null && Math.abs(a.points - entry.maximumScore) < 0.01,
        );
        // Only when it is unambiguous. "One of the four things worth 20" is
        // not a suggestion, it is a coin toss with a professor's gradebook.
        if (sameScore.length === 1) claim(entry.assessmentId, sameScore[0]);
      }

      return picks;
    };

    /**
     * Bind each assessment to its Canvas assignment, one subgroup at a time.
     *
     * One subgroup at a time because that is how a push runs: each subgroup
     * has its own Canvas course, each course numbers its assignments
     * independently, and the two lists have nothing to do with each other.
     * Twenty-one assessments across three courses is sixty-three bindings,
     * which is why the pairing is suggested and not asked for — but nothing
     * is written until Save, and every row is a dropdown the professor can
     * disagree with.
     *
     * What is sent back on Save is the WHOLE mapping for each assessment,
     * this subgroup merged into the ones already bound. The writer replaces
     * the mapping wholesale, so sending only what is on screen would unbind
     * every other subgroup silently.
     */
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

      // What is already recorded for the subgroup on screen.
      const recorded = {};
      for (const entry of assessments) {
        const existing = perSubgroup
          ? (entry.canvasAssignments || {})[group]
          : entry.canvasAssignmentId;
        if (existing) recorded[entry.assessmentId] = existing;
      }
      const chosen = picks || recorded;

      const load = () => {
        if (!courseId) {
          setFailed(
            perSubgroup
              ? `${group} has no Canvas course bound yet — bind it above first.`
              : "This run has no Canvas course recorded yet.",
          );
          return;
        }
        setPhase("fetching");
        setFailed(null);
        fetch(
          scoped(
            BASE + "/api/canvas/assignments?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ courseId }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) {
              setFailed(body.error);
              return;
            }
            setAssignments(body.assignments || []);
            // Suggest only where nothing is recorded, so a fetch never
            // overwrites a pairing the professor has already accepted.
            const suggested = suggestPairs(
              assessments.filter((entry) => !recorded[entry.assessmentId]),
              (body.assignments || []).filter((a) => !Object.values(recorded).includes(a.id)),
            );
            setPicks(Object.assign({}, recorded, suggested));
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
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
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ links }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) {
              setFailed(body.error);
              return;
            }
            setPicks(null);
            setAssignments(null);
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
          });
      };

      const options = assignments || [];
      const bound = assessments.filter((entry) => chosen[entry.assessmentId]).length;

      return h(
        "div",
        null,
        h("p", { className: "pp-factgroup" }, "Assessments and their Canvas assignments"),
        perSubgroup
          ? h(
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
                  },
                },
                subgroups.map((name) =>
                  h(
                    "option",
                    { value: name, key: name },
                    name + ((props.courseMap || {})[name] ? "" : " — no Canvas course"),
                  ),
                ),
              ),
            )
          : null,
        h(
          "div",
          { className: "pp-saverow-top" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase !== "idle",
              onClick: load,
            },
            phase === "fetching" ? "Asking Canvas…" : "Fetch assignments and suggest pairs",
          ),
          options.length
            ? h(
                "span",
                { className: "pp-savenote" },
                " " + bound + " of " + assessments.length + " paired",
              )
            : null,
        ),
        options.length
          ? assessments.map((entry) =>
              h(
                "div",
                { className: "pp-bind", key: entry.assessmentId },
                h(
                  "span",
                  { className: "pp-bindname" },
                  entry.title || entry.assessmentId,
                  h(
                    "span",
                    { className: "pp-intwhat" },
                    entry.assessmentId +
                      (entry.maximumScore === null || entry.maximumScore === undefined
                        ? ""
                        : " · out of " + entry.maximumScore),
                  ),
                ),
                h(
                  "select",
                  {
                    className: "pp-bindsel",
                    value: chosen[entry.assessmentId] || "",
                    onChange: (event) =>
                      setPicks(
                        Object.assign({}, chosen, {
                          [entry.assessmentId]: event.target.value,
                        }),
                      ),
                  },
                  h("option", { value: "" }, "— not linked —"),
                  options.map((assignment) =>
                    h(
                      "option",
                      { value: assignment.id, key: assignment.id },
                      assignment.name +
                        (assignment.points === null ? "" : " · " + assignment.points) +
                        " (" + assignment.id + ")",
                    ),
                  ),
                ),
              ),
            )
          : null,
        options.length
          ? h(
              "div",
              { className: "pp-saverow" },
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: phase !== "idle",
                  onClick: save,
                },
                phase === "saving" ? "Saving…" : "Save these pairings",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: phase !== "idle",
                  onClick: () => setPicks(null),
                },
                "Revert",
              ),
              h(
                "span",
                { className: "pp-savenote" },
                " Suggestions are a guess from the titles and the marks. Check them.",
              ),
            )
          : null,
        failed ? h("p", { className: "pp-saveerr" }, failed) : null,
      );
    }

    /**
     * Every integration, its state, and the way to fix the ones that are not
     * finished.
     *
     * The whole reason this view exists: the facts were all on the tab and
     * none of them added up to an answer. A professor asking "will a push
     * reach Canvas" had to know that the host is in one file, the token in a
     * variable, the course id on the run record and the assignment ids on
     * four assessments — and then do the arithmetic themselves.
     *
     * A finished integration collapses to one line. An unfinished one shows
     * its checklist, because "partly configured" without saying which part is
     * a worse answer than nothing.
     */
    function IntegrationStatus(props) {
      const [opened, setOpened] = React.useState(null);
      const rows = props.integrations || [];

      if (!rows.length) {
        return h("p", { className: "pp-absent" }, "Nothing to report about this run yet.");
      }

      const label = { ready: "ready", partial: "partly set up", absent: "not set up" };

      return h(
        "div",
        null,
        rows.map((row) =>
          h(
            "div",
            { className: "pp-int", key: row.id },
            h(
              "div",
              { className: "pp-inthead" },
              h(
                "span",
                { className: "pp-intname" },
                row.label,
                h("span", { className: "pp-intwhat" }, row.what),
              ),
              h("span", { className: "pp-state pp-state-" + row.state }, label[row.state]),
            ),
            // A finished one says so and stops. Its steps are all ticks, and
            // four ticks is a wall to read past on the way to the one row
            // that still needs something.
            row.state === "ready"
              ? null
              : h(
                  "ul",
                  { className: "pp-steps" },
                  row.steps.map((entry, index) =>
                    h(
                      "li",
                      {
                        className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"),
                        key: index,
                      },
                      h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
                      h(
                        "span",
                        null,
                        entry.label,
                        entry.done
                          ? null
                          : h("span", { className: "pp-stephint" }, " — " + entry.hint),
                      ),
                    ),
                  ),
                ),
            row.canPushGrades === false && row.state !== "absent"
              ? h(
                  "p",
                  { className: "pp-absent" },
                  "Grades cannot be pushed here — nothing in this workspace has a " +
                    row.label +
                    " gradebook target. It publishes content.",
                )
              : null,
            opened === row.id
              ? h(
                  "div",
                  null,
                  // The steps still to do, in order, and only those. A
                  // professor who has already saved a host and a token should
                  // not have to scroll past the form asking for them again to
                  // reach the pairing that is actually missing.
                  row.steps[0].done && row.steps[1].done
                    ? null
                    : h(ProviderSetup, {
                        integration: row,
                        runId: props.runId,
                        sessionId: props.sessionId,
                        onCancel: () => setOpened(null),
                        onSaved: (body) => {
                          if (props.onSaved) props.onSaved(body);
                        },
                      }),
                  row.id === "canvas" && row.steps[1].done && !row.steps[2].done
                    ? h(SubgroupCourses, {
                        runId: props.runId,
                        sessionId: props.sessionId,
                        subgroups: props.data.subgroups || [],
                        state:
                          props.data.subgroupCourses || {
                            map: {},
                            perSubgroup: false,
                            conflict: false,
                          },
                        onSaved: (body) => {
                          if (props.onSaved) props.onSaved(body);
                        },
                      })
                    : null,
                  // Only once there is a course to ask about. Fetching a
                  // course's assignments needs the course, and offering the
                  // binder before that is offering a button that can only
                  // fail.
                  row.id === "canvas" && row.steps[1].done && row.steps[2].done && !row.steps[3].done
                    ? h(AssignmentBinder, {
                        runId: props.runId,
                        sessionId: props.sessionId,
                        subgroups: props.data.subgroups || [],
                        courseMap: (props.data.subgroupCourses || {}).perSubgroup
                          ? (props.data.subgroupCourses || {}).map
                          : null,
                        singleCourseId: (props.data.canvasCourse || {}).id,
                        assessments: props.data.assessments || [],
                        onSaved: (body) => {
                          if (props.onSaved) props.onSaved(body);
                        },
                      })
                    : null,
                  h(
                    "div",
                    { className: "pp-saverow" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        onClick: () => setOpened(null),
                      },
                      "Done for now",
                    ),
                  ),
                )
              : row.state === "ready"
                ? null
                : h(
                    "div",
                    { className: "pp-saverow-top" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        onClick: () => setOpened(row.id),
                      },
                      // Named by what is left rather than by the provider, so
                      // a half-finished Canvas offers "Continue" and does not
                      // look like it is asking to start over.
                      (row.state === "absent" ? "Configure " : "Continue setting up ") +
                        row.label,
                    ),
                  ),
          ),
        ),
        props.setup && props.setup.answered
          ? h(
              "p",
              { className: "pp-ok" },
              props.setup.provider +
                " answered as " +
                props.setup.answered +
                (props.setup.tokenSaved ? ". The token is stored." : "."),
            )
          : null,
        props.setup && props.setup.checkFailed
          ? h("p", { className: "pp-saveerr" }, props.setup.checkFailed)
          : null,
      );
    }

    /**
     * Which Canvas course each subgroup is taught in.
     *
     * Only drawn when the run has subgroups, because a run with one cohort has
     * one Canvas course and the field above already holds it.
     *
     * The picker is filled from Canvas rather than typed. A Canvas course id
     * is a number nobody remembers and everybody copies out of a URL, and a
     * digit dropped there binds a cohort to somebody else's course — which is
     * a mistake that looks like nothing until marks arrive in it.
     */
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
            props.sessionId,
          ),
          { method: "POST" },
        )
          .then((response) => response.json())
          .then((body) => {
            setFetching(false);
            if (body.error) {
              setFailed(body.error);
              return;
            }
            setCatalogue(body.courses || []);
          })
          .catch((error) => {
            setFetching(false);
            setFailed(String((error && error.message) || error));
          });
      };

      const save = () => {
        setPhase("saving");
        setFailed(null);
        fetch(
          scoped(
            BASE + "/api/canvas/course-map?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mapping: chosen }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) {
              setFailed(body.error);
              return;
            }
            setPicked(null);
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
          });
      };

      const options = catalogue || [];

      return h(
        "div",
        null,
        h("p", { className: "pp-factgroup" }, "A Canvas course per subgroup"),
        props.state.conflict
          ? h(
              "p",
              { className: "pp-saveerr" },
              "This run also sets a single Canvas course id (" +
                props.state.singleId +
                "). A record cannot hold both — clear that one before binding subgroups.",
            )
          : null,
        h(
          "p",
          { className: "pp-absent" },
          options.length
            ? "Bind each subgroup to the Canvas course it is taught in. A push then " +
                "runs once per subgroup and carries only that subgroup's students."
            : "If each subgroup has its own Canvas course, fetch your courses and bind " +
                "them here. Leave this alone when the whole run is one Canvas course.",
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
              onClick: load,
            },
            fetching ? "Asking Canvas…" : "Fetch my Canvas courses",
          ),
        ),
        subgroups.map((entry) =>
          h(
            "div",
            { className: "pp-bind", key: entry.group },
            h("span", { className: "pp-bindname" }, entry.group),
            options.length
              ? h(
                  "select",
                  {
                    className: "pp-bindsel",
                    value: chosen[entry.group] || "",
                    onChange: (event) =>
                      setPicked(
                        Object.assign({}, chosen, { [entry.group]: event.target.value }),
                      ),
                  },
                  h("option", { value: "" }, "— not bound —"),
                  options.map((course) =>
                    h(
                      "option",
                      { value: course.id, key: course.id },
                      course.name + " (" + course.id + ")",
                    ),
                  ),
                )
              : h(
                  "span",
                  { className: chosen[entry.group] ? null : "pp-absent" },
                  chosen[entry.group] || "not bound",
                ),
          ),
        ),
        options.length
          ? h(
              "div",
              { className: "pp-saverow" },
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: phase === "saving",
                  onClick: save,
                },
                phase === "saving" ? "Saving…" : "Save to the run record",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: phase === "saving",
                  onClick: () => setPicked(null),
                },
                "Revert",
              ),
            )
          : null,
        failed ? h("p", { className: "pp-saveerr" }, failed) : null,
      );
    }

    // ── client/canvas-card.js

    /** `https://canvas.example.edu/` → `canvas.example.edu`. */
    const hostName = (url) =>
      String(url || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");

    /** `7 Oct`, for a row that has room for a date and nothing else. */
    const shortDate = (iso) => {
      if (!iso) return null;
      const at = new Date(iso);
      return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
    };

    /**
     * The Canvas courses this run is taught in, keyed by subgroup — or by "" for
     * a run that is one Canvas course. Empty when none is recorded.
     */
    const canvasCoursesOf = (data) => {
      const perSubgroup = data.subgroupCourses || { map: {}, perSubgroup: false };
      if (perSubgroup.perSubgroup) return perSubgroup.map;
      return data.canvasCourse && data.canvasCourse.id ? { "": data.canvasCourse.id } : {};
    };

    /** Which of the run's Canvas courses this assessment has a column in. */
    const columnsOf = (assessment, courses) => {
      const groups = Object.keys(courses);
      if (groups.length === 1 && groups[0] === "") {
        return { "": assessment.canvasAssignmentId || null };
      }
      const out = {};
      for (const group of groups) out[group] = (assessment.canvasAssignments || {})[group] || null;
      return out;
    };

    const assignmentUrl = (host, courseId, assignmentId) =>
      host && courseId && assignmentId
        ? String(host).replace(/\/+$/, "") + "/courses/" + courseId + "/assignments/" + assignmentId
        : null;

    /** Due date first, undated last, then by title: the order a term is taught in. */
    const byDue = (left, right) =>
      String(left.a.dueAt || "9999").localeCompare(String(right.a.dueAt || "9999")) ||
      String(left.a.title || left.a.assessmentId).localeCompare(String(right.a.title || right.a.assessmentId));

    /** A press to `/api/syncs/action`, answered with the CLI's own words. */
    const postSync = (runId, sessionId, body) =>
      fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(runId || ""), sessionId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((response) => response.json())
        .catch((error) => ({ error: String((error && error.message) || error) }));

    /**
     * One sync that only reads from Canvas — the class list, or one assessment's
     * hand-ins — as a line with Preview and Run. Nothing it does reaches students,
     * so Run needs no preview first; a sync that does is not drawn here.
     */
    function CanvasRead(props) {
      const [busy, setBusy] = React.useState(null);
      const [result, setResult] = React.useState(null);
      const sync = props.sync;
      if (!sync) return null;

      const press = (action) => {
        setBusy(action);
        postSync(props.runId, props.sessionId, {
          action,
          sync: sync.id,
          assessment: props.assessmentId || "",
          confirm: false,
          names: Boolean(props.names),
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
              props.assessmentId ? "" : sync.lastSynced ? " · " + when(sync.lastSynced) : " · never",
            ),
          ),
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => press("plan") },
            busy === "plan" ? "Looking…" : "Preview",
          ),
          sync.live
            ? null
            : h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: Boolean(busy) || !sync.enabled,
                  onClick: () => press("run"),
                },
                busy === "run" ? "Running…" : "Run",
              ),
        ),
        result
          ? h(
              "pre",
              { className: "pp-approveout" + (result.error || !result.ok ? " pp-approveerr" : "") },
              (result.error ? "" : result.action === "run" ? "Done.\n" : "Preview — nothing was changed.\n") +
                (result.error || result.output || "(nothing printed)"),
            )
          : null,
      );
    }

    /**
     * Sending an assessment's DEFINITION to Canvas — its title, points, dates,
     * what may be handed in, and the brief as the description.
     *
     * Moved here from the Links view, where it chose the assessment from a list;
     * on the card it sits under the assessment's own row and that choice is made.
     * Everything else about it is as it was, and each rule is the reason for a
     * shape:
     *
     * * **preview first, always.** The send button does not exist until a plan
     *   has come back, and the plan is the CLI's own words.
     * * **the send button is the only red thing here**, the pane's signal for a
     *   press that writes outside this machine.
     * * **drift needs its own press.** A field somebody edited in Canvas is left
     *   alone; replacing it is a checkbox that appears only when the plan reported
     *   drift, cleared after every send so it cannot carry into the next one.
     * * **every subgroup by default**, which is what the command does: one
     *   definition serves the class, and a send that reached CS-401 and not CS-402
     *   is how two halves end up being told different things.
     */
    function DefinitionPush(props) {
      const subgroups = (props.subgroups || []).map((entry) => entry.group);
      const [group, setGroup] = React.useState("");
      const [phase, setPhase] = React.useState("idle");
      const [result, setResult] = React.useState(null);
      const [overwrite, setOverwrite] = React.useState(false);

      // A plan belongs to the subgroup it was asked about. Changing it throws the
      // plan away, so the red button can never send something other than what
      // was read.
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
              overwriteDrift: confirm && overwrite,
            }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) {
              setResult({ failed: true, text: body.error, sent: false });
              return;
            }
            setResult({
              failed: !body.ok,
              text: body.output || (body.ok ? "Canvas had nothing to change." : "No output."),
              sent: confirm && body.ok,
            });
            // A send consumes the preview: what is on screen now describes a
            // state that no longer exists.
            if (confirm) {
              setOverwrite(false);
              // A created assignment's id was written into the record.
              if (body.ok && props.onWrite) props.onWrite();
            }
          })
          .catch((error) => {
            setPhase("idle");
            setResult({ failed: true, text: String((error && error.message) || error), sent: false });
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
          subgroups.length
            ? h(
                "select",
                {
                  className: "pp-bindsel",
                  value: group,
                  "aria-label": "Which subgroup's Canvas course",
                  onChange: (event) => {
                    setGroup(event.target.value);
                    reset();
                  },
                },
                [h("option", { value: "", key: "*" }, "Every subgroup")].concat(
                  subgroups.map((name) => h("option", { value: name, key: name }, name)),
                ),
              )
            : null,
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: phase !== "idle", onClick: () => call(false) },
            phase === "planning" ? "Asking Canvas…" : "Preview what Canvas would get",
          ),
          previewed
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn pp-danger",
                  disabled: phase !== "idle",
                  onClick: () => call(true),
                },
                phase === "sending" ? "Sending…" : "Send to Canvas",
              )
            : null,
        ),
        sawDrift
          ? h(
              "label",
              { className: "pp-savenote" },
              h("input", {
                type: "checkbox",
                checked: overwrite,
                onChange: (event) => setOverwrite(event.target.checked),
              }),
              " Also replace what was edited in Canvas",
            )
          : null,
        result
          ? h("pre", { className: "pp-approveout" + (result.failed ? " pp-approveerr" : "") }, result.text)
          : null,
      );
    }

    /**
     * Which Canvas assignment this assessment is, in each of the run's courses.
     *
     * One course at a time: each is asked for its own assignment list only when
     * the professor presses Choose, because the list costs a Canvas request with
     * their token. What is saved is the whole mapping for this assessment — the
     * writer replaces it wholesale, and sending only the course being edited
     * would unbind the others.
     */
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
          body: JSON.stringify({ courseId: courses[group] }),
        })
          .then((response) => response.json())
          .then((body) =>
            setLists((all) => Object.assign({}, all, { [group]: body.error ? { error: body.error } : body.assignments || [] })),
          )
          .catch((error) => setLists((all) => Object.assign({}, all, { [group]: { error: String(error) } })));
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
          body: JSON.stringify({ links: { [assessment.assessmentId]: link } }),
        })
          .then((response) => response.json())
          .then((body) => {
            setPhase("idle");
            if (body.error) return setFailed(body.error);
            setLists((all) => Object.assign({}, all, { [group]: undefined }));
            setPicks((all) => Object.assign({}, all, { [group]: undefined }));
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
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
            Array.isArray(list)
              ? h(
                  React.Fragment,
                  null,
                  h(
                    "select",
                    {
                      className: "pp-bindsel",
                      value: picks[group] ?? id ?? "",
                      onChange: (event) => setPicks((all) => Object.assign({}, all, { [group]: event.target.value })),
                    },
                    h("option", { value: "" }, "— not linked —"),
                    list.map((assignment) =>
                      h(
                        "option",
                        { value: assignment.id, key: assignment.id },
                        assignment.name + (assignment.points == null ? "" : " · " + assignment.points + " pts"),
                      ),
                    ),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      disabled: phase !== "idle" || (picks[group] ?? id ?? "") === (id ?? ""),
                      onClick: () => save(group, picks[group] ?? ""),
                    },
                    phase === "saving" ? "Saving…" : "Save",
                  ),
                )
              : h(
                  React.Fragment,
                  null,
                  h(
                    "span",
                    { className: "pp-ccol" + (id ? "" : " pp-no") },
                    id
                      ? url
                        ? h("a", { href: url, target: "_blank", rel: "noreferrer", title: "Open it in Canvas" }, id + " ↗")
                        : id
                      : "not linked",
                  ),
                  list && list.error
                    ? h("span", { className: "pp-saveerr" }, list.error)
                    : h(
                        "button",
                        {
                          type: "button",
                          className: "pp-segbtn",
                          disabled: list === "loading",
                          title: "Ask Canvas for this course's assignments. A read; it sends your token.",
                          onClick: () => choose(group),
                        },
                        list === "loading" ? "Asking Canvas…" : id ? "Change…" : "Choose…",
                      ),
                ),
          );
        }),
        failed ? h("p", { className: "pp-saveerr" }, failed) : null,
      );
    }

    /**
     * Which Canvas section or student group feeds which subgroup of this run.
     *
     * Moved from the Links view unchanged in what it does. It lives in the card's
     * Details because it is set once, at the start of a term, and read by nobody
     * afterwards but the roster sync.
     */
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

      // A Save hands back the record as it now is; start again from it.
      React.useEffect(() => setPicked(null), [data]);

      const load = () => {
        setFetching(true);
        setStatus(null);
        fetch(scoped(BASE + "/api/canvas/catalogue?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
          method: "POST",
        })
          .then((response) => response.json())
          .then((body) => {
            setFetching(false);
            if (body.error) return setStatus({ error: body.error });
            setCatalogue(body);
          })
          .catch((error) => {
            setFetching(false);
            setStatus({ error: String((error && error.message) || error) });
          });
      };

      const toggle = (option) =>
        setPicked(() => {
          const next = Object.assign({}, chosen);
          if (Object.hasOwn(next, key(option))) delete next[key(option)];
          else {
            next[key(option)] = {
              id: option.id,
              kind: option.kind,
              name: option.name,
              // One subgroup and nothing to decide: bind it.
              group: data.subgroups.length === 1 ? data.subgroups[0].group : null,
            };
          }
          return next;
        });

      const bind = (option, group) =>
        setPicked(() => {
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
          body: JSON.stringify({ selections: Object.values(chosen) }),
        })
          .then((response) => response.json())
          .then((body) => {
            if (body.error) return setStatus({ error: body.error });
            setStatus({ saved: body.saved });
            if (props.onSaved) props.onSaved(body);
          })
          .catch((error) => setStatus({ error: String((error && error.message) || error) }));
      };

      // The live list once fetched, otherwise what the record holds, so a mapping
      // can be read and undone without spending a Canvas request.
      const offered = catalogue
        ? catalogue.options
        : data.selections.map((row) => ({ id: row.id, kind: row.kind, name: row.name || row.id, students: null, sisId: null }));

      // Order-insensitive, joined on NUL for `grading.js`'s reason: a section name
      // is free text and may hold any separator a registrar typed.
      const canonical = (table) =>
        Object.keys(table)
          .sort()
          .map((entry) => `${entry}\u0000${table[entry].group || ""}\u0000${table[entry].name || ""}`)
          .join("\u0000\u0000");
      const dirty = canonical(seed(data.selections)) !== canonical(chosen);

      return h(
        "div",
        null,
        h("p", { className: "pp-factgroup" }, "Sections and groups"),
        h(
          "p",
          { className: "pp-as" },
          data.subgroups.length
            ? "Which Canvas section or student group feeds which subgroup. The class list sync reads this." +
                (data.ungrouped
                  ? " " + data.ungrouped + " active student" + (data.ungrouped === 1 ? "" : "s") + " carry no subgroup."
                  : "")
            : "This run has no subgroups, so a section ticked here only says it belongs to this run.",
        ),
        h(
          "div",
          { className: "pp-approverow" },
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: fetching, onClick: load },
            fetching ? "Asking Canvas…" : catalogue ? "Fetch again" : "Fetch from Canvas",
          ),
          catalogue ? h("span", { className: "pp-savenote" }, catalogue.options.length + " in course " + catalogue.courseId) : null,
        ),
        offered.length === 0
          ? h("p", { className: "pp-as" }, catalogue ? "Canvas returned no sections or groups." : "Nothing is mapped yet.")
          : offered.map((option) => {
              const on = Object.hasOwn(chosen, key(option));
              return h(
                "div",
                { className: "pp-pick", key: key(option) },
                h("input", {
                  type: "checkbox",
                  className: "pp-pickbox",
                  checked: on,
                  onChange: () => toggle(option),
                  "aria-label": option.name,
                }),
                h(
                  "span",
                  { className: "pp-picklabel" },
                  option.name,
                  h(
                    "span",
                    { className: "pp-factnote" },
                    option.kind +
                      " " +
                      option.id +
                      (option.students == null ? "" : " · " + option.students + " students") +
                      (option.sisId ? " · SIS " + option.sisId : ""),
                  ),
                ),
                on && data.subgroups.length
                  ? h(
                      "select",
                      {
                        className: "pp-prefctl pp-picksel",
                        value: (chosen[key(option)] && chosen[key(option)].group) || "",
                        onChange: (event) => bind(option, event.target.value),
                        "aria-label": "Which subgroup " + option.name + " feeds",
                      },
                      [h("option", { value: "", key: "" }, "the whole run")].concat(
                        data.subgroups.map((entry) =>
                          h("option", { value: entry.group, key: entry.group }, entry.group + " (" + entry.students + ")"),
                        ),
                      ),
                    )
                  : null,
              );
            }),
        dirty || (status && (status.error || status.saved))
          ? h(
              "div",
              { className: "pp-approverow" },
              dirty
                ? h(
                    "button",
                    { type: "button", className: "pp-segbtn", disabled: status === "saving", onClick: save },
                    status === "saving" ? "Saving…" : "Save",
                  )
                : null,
              dirty
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      onClick: () => {
                        setPicked(null);
                        setStatus(null);
                      },
                    },
                    "Revert",
                  )
                : null,
              status && status.error ? h("span", { className: "pp-saveerr" }, status.error) : null,
              status && status.saved && !dirty
                ? h("span", { className: "pp-savenote" }, "Saved to " + status.saved.path + ".")
                : null,
            )
          : null,
      );
    }

    /** One assessment's three states, as the pills its row has room for. */
    const rowPills = (entry, reachable) => {
      const pills = [];
      const { linked, of } = entry.link;
      // Until Canvas can be reached there is no column to speak of either way.
      if (!reachable) {
        // nothing
      } else if (linked === of) {
        pills.push({ key: "col", text: "linked", tone: "ok" });
      } else {
        pills.push({ key: "col", text: linked ? linked + " of " + of + " linked" : "not linked", tone: "warn" });
      }
      pills.push(
        entry.a.definitionSent
          ? { key: "def", text: "brief sent " + shortDate(entry.a.definitionSent), tone: "" }
          : { key: "def", text: "brief not sent", tone: "quiet" },
      );
      const c = entry.u && entry.u.canvas;
      if (!c || c.ready === 0) pills.push({ key: "marks", text: "no marks yet", tone: "quiet" });
      else if (c.unsent + c.changed === 0) pills.push({ key: "marks", text: "all " + c.ready + " marks in", tone: "ok" });
      else pills.push({ key: "marks", text: c.unsent + c.changed + " marks to send", tone: "warn" });
      return pills;
    };

    /** What the card counts, for its own header and for the strip above it. */
    const canvasCounts = (data, unpublished) => {
      const courses = canvasCoursesOf(data);
      const usage = {};
      for (const entry of (unpublished && unpublished.assessments) || []) usage[entry.id] = entry;
      const rows = (data.assessments || []).map((a) => {
        const columns = columnsOf(a, courses);
        const ids = Object.values(columns);
        return {
          a,
          u: usage[a.assessmentId] || null,
          link: { linked: ids.filter(Boolean).length, of: Math.max(ids.length, 1) },
        };
      });
      rows.sort(byDue);
      const unlinked = rows.filter((entry) => entry.link.linked < entry.link.of);
      const toSend = rows.filter((entry) => entry.u && entry.u.canvas && entry.u.canvas.unsent + entry.u.canvas.changed > 0);
      return { courses, rows, unlinked, toSend };
    };

    /**
     * The card.
     *
     * `filter` comes from the strip above it, so "13 assessments have no Canvas
     * column → Show" lands on exactly those rows; `filterTick` makes the same
     * press work twice after the professor has changed the filter by hand.
     */
    function CanvasCard(props) {
      const data = props.data;
      const row = (data.integrations || []).find((entry) => entry.id === "canvas");
      const [filter, setFilter] = React.useState(props.filter || "all");
      const [open, setOpen] = React.useState(null);
      const [binding, setBinding] = React.useState(false);
      const [editing, setEditing] = React.useState(null);
      const [tokenError, setTokenError] = React.useState(null);
      React.useEffect(() => {
        if (props.filter) setFilter(props.filter);
      }, [props.filter, props.filterTick]);

      if (!row) return null;
      const [hostStep, tokenStep, courseStep] = row.steps;
      const reachable = hostStep.done && tokenStep.done && courseStep.done;
      const { courses, rows, unlinked, toSend } = canvasCounts(data, props.unpublished);
      const courseCount = Object.keys(courses).length;
      const subgroupCourses = data.subgroupCourses || { map: {}, perSubgroup: false, conflict: false };
      const rosterSync = props.syncs ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "roster") : null;
      const handInSync = props.syncs
        ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "submissions")
        : null;

      const saved = (body) => {
        if (props.onSaved) props.onSaved(body);
      };

      const subtitle = [
        data.canvas.host ? hostName(data.canvas.host) : "no address",
        tokenStep.done ? "token saved" : "no token",
        subgroupCourses.perSubgroup
          ? courseCount + " course" + (courseCount === 1 ? "" : "s") + ", one per subgroup"
          : data.canvasCourse.id
            ? "course " + data.canvasCourse.id
            : "no course",
      ].join(" · ");

      const chip = !reachable
        ? { text: "setup needed", tone: "warn" }
        : unlinked.length
          ? { text: rows.length - unlinked.length + " of " + rows.length + " linked", tone: "warn" }
          : { text: "ready", tone: "ok" };

      const shown = rows.filter((entry) =>
        filter === "unlinked" ? unlinked.includes(entry) : filter === "marks" ? toSend.includes(entry) : true,
      );

      // ---- setup, while Canvas cannot be reached -----------------------------

      const setup = reachable
        ? null
        : h(
            "div",
            { className: "pp-csetup" },
            h(
              "ul",
              { className: "pp-steps" },
              [hostStep, tokenStep, courseStep].map((entry, index) =>
                h(
                  "li",
                  { className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"), key: index },
                  h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
                  h("span", null, entry.label),
                ),
              ),
            ),
            !hostStep.done
              ? h(ProviderSetup, { integration: row, runId: props.runId, sessionId: props.sessionId, onSaved: saved })
              : !tokenStep.done
                ? // The address is known, so only the token is asked for — the
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
                      onStatus: (next) => setTokenError(next && next.error ? next.error : null),
                    }),
                    h(
                      "p",
                      { className: "pp-as" },
                      "Canvas → Account → Settings → New Access Token. It goes to the credential store and is never shown again.",
                    ),
                    tokenError ? h("p", { className: "pp-saveerr" }, tokenError) : null,
                  )
                : data.subgroups.length
                ? h(SubgroupCourses, {
                    runId: props.runId,
                    sessionId: props.sessionId,
                    subgroups: data.subgroups,
                    state: subgroupCourses,
                    onSaved: saved,
                  })
                : h(
                    "p",
                    { className: "pp-as" },
                    "Record the Canvas course on the run as extensions.lms.canvas_course_id — the number in the " +
                      "course's Canvas address" +
                      (data.run.recordPath ? ", in " + data.run.recordPath : "") +
                      ".",
                  ),
            data.setup && data.setup.provider === "canvas" && data.setup.checkFailed
              ? h("p", { className: "pp-saveerr" }, data.setup.checkFailed)
              : null,
          );

      // ---- one assessment ----------------------------------------------------

      const panel = (entry) =>
        h(
          "div",
          { className: "pp-cpanel" },
          h("p", { className: "pp-factgroup" }, "Canvas assignment"),
          h(ColumnLinks, {
            assessment: entry.a,
            courses,
            host: data.canvas.host,
            runId: props.runId,
            sessionId: props.sessionId,
            onSaved: saved,
          }),
          h("p", { className: "pp-factgroup" }, "Definition"),
          h(
            "p",
            { className: "pp-as" },
            "Title, points, dates, what may be handed in, and the brief as the description. " +
              (entry.a.definitionSent
                ? "Last sent from this computer " + when(entry.a.definitionSent) + "."
                : "Not sent from this computer. Where there is no assignment yet, sending creates it and links it."),
          ),
          h(DefinitionPush, {
            assessmentId: entry.a.assessmentId,
            subgroups: subgroupCourses.perSubgroup ? data.subgroups : [],
            runId: props.runId,
            sessionId: props.sessionId,
            onWrite: props.onWrite,
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
            },
          }),
          handInSync
            ? h(
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
                  onWrite: props.onWrite,
                }),
              )
            : null,
        );

      const assessmentRow = (entry) => {
        const id = entry.a.assessmentId;
        const expanded = open === id;
        return h(
          "div",
          { className: "pp-crow" + (expanded ? " pp-crow-open" : ""), key: id },
          h(
            "button",
            {
              type: "button",
              className: "pp-crowhead",
              "aria-expanded": expanded,
              onClick: () => setOpen(expanded ? null : id),
            },
            h("span", { className: "pp-crowchev", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
            h(
              "span",
              { className: "pp-crowtitle" },
              entry.a.title || id,
              entry.a.dueAt ? h("span", { className: "pp-as" }, " · due " + shortDate(entry.a.dueAt)) : null,
            ),
            h(
              "span",
              { className: "pp-crowpills" },
              rowPills(entry, reachable).map((pill) =>
                h("span", { className: "pp-chip" + (pill.tone ? " pp-chip-" + pill.tone : ""), key: pill.key }, pill.text),
              ),
            ),
          ),
          expanded ? panel(entry) : null,
        );
      };

      // ---- details -----------------------------------------------------------

      const details = h(
        "details",
        { className: "pp-cdetails" },
        h("summary", null, "Details"),
        h(
          Fact,
          { label: "Address", note: data.canvas.hostFrom || "not configured", missing: !data.canvas.host },
          data.canvas.host || h(Presence, { present: false, no: "not set" }),
        ),
        h(
          Fact,
          { label: "Token", note: data.canvas.tokenEnv + " — never shown, only whether it is there", missing: !tokenStep.done },
          h(Presence, { present: tokenStep.done, yes: "saved", no: "not set" }),
        ),
        Object.keys(courses).map((group) =>
          h(
            Fact,
            { label: group ? "Course · " + group : "Course", key: "course:" + group },
            data.canvas.host
              ? h(
                  "a",
                  { href: String(data.canvas.host).replace(/\/+$/, "") + "/courses/" + courses[group], target: "_blank", rel: "noreferrer" },
                  courses[group] + " ↗",
                )
              : courses[group],
          ),
        ),
        data.canvasCourse.fromColumn && !data.canvasCourse.fromExtension && !subgroupCourses.perSubgroup
          ? h(
              "p",
              { className: "pp-saveerr" },
              "The course id is in lms_course_id, which a push does not read. It reads extensions.lms.canvas_course_id.",
            )
          : null,
        subgroupCourses.conflict
          ? h(
              "p",
              { className: "pp-saveerr" },
              "The run also sets a single Canvas course (" + subgroupCourses.singleId + "). A record cannot hold both.",
            )
          : null,
        h(
          Fact,
          {
            label: "Grades go to",
            note: data.target.value === null ? "the run's gradebook target, not recorded yet" : "the run's gradebook target",
            missing: data.target.value === null || data.target.supported === false,
          },
          data.target.value || h(Presence, { present: false, no: "not recorded" }),
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
              onClick: () => setEditing(editing === "access" ? null : "access"),
            },
            "Change address or token",
          ),
          data.subgroups.length
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": editing === "courses",
                  onClick: () => setEditing(editing === "courses" ? null : "courses"),
                },
                "Change courses",
              )
            : null,
        ),
        editing === "access"
          ? h(ProviderSetup, {
              integration: row,
              runId: props.runId,
              sessionId: props.sessionId,
              onCancel: () => setEditing(null),
              onSaved: (body) => {
                setEditing(null);
                saved(body);
              },
            })
          : null,
        editing === "courses"
          ? h(SubgroupCourses, {
              runId: props.runId,
              sessionId: props.sessionId,
              subgroups: data.subgroups,
              state: subgroupCourses,
              onSaved: (body) => {
                setEditing(null);
                saved(body);
              },
            })
          : null,
        reachable ? h(CanvasSections, { data, runId: props.runId, sessionId: props.sessionId, onSaved: saved }) : null,
      );

      // ---- the card ----------------------------------------------------------

      const filters = [
        { id: "all", label: "All " + rows.length },
        { id: "unlinked", label: "Not linked " + unlinked.length, hide: !reachable || !unlinked.length },
        { id: "marks", label: "Marks to send " + toSend.length, hide: !toSend.length },
      ].filter((entry) => !entry.hide);

      return h(
        "section",
        { className: "pp-ccard" },
        h(
          "div",
          { className: "pp-chead" },
          h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"),
          h("span", { className: "pp-cname" }, "Canvas", h("span", { className: "pp-intwhat" }, subtitle)),
          h("span", { className: "pp-chip pp-chip-" + chip.tone }, chip.text),
        ),
        setup,
        reachable && rosterSync
          ? h(CanvasRead, {
              sync: rosterSync,
              label: "Class list",
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onWrite: props.onWrite,
            })
          : null,
        rows.length
          ? h(
              React.Fragment,
              null,
              h(
                "div",
                { className: "pp-ctools" },
                filters.length > 1
                  ? filters.map((entry) =>
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pp-segbtn",
                          key: entry.id,
                          "aria-pressed": filter === entry.id,
                          onClick: () => setFilter(entry.id),
                        },
                        entry.label,
                      ),
                    )
                  : h("span", { className: "pp-as" }, rows.length + " assessments"),
                h("span", { className: "pp-segspacer" }),
                reachable && unlinked.length
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        "aria-pressed": binding,
                        title: "Fetch each course's assignments and pair them with the unlinked assessments by title and points",
                        onClick: () => setBinding(!binding),
                      },
                      "Suggest pairs",
                    )
                  : null,
              ),
              binding
                ? h(
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
                      },
                    }),
                  )
                : null,
              h(
                "div",
                { className: "pp-crows" },
                shown.length ? shown.map(assessmentRow) : h("p", { className: "pp-as" }, "Nothing here."),
              ),
            )
          : h("p", { className: "pp-as" }, "This run has no assessments yet. Drafting one is /design-assessment."),
        details,
      );
    }

    // ── client/service-cards.js

    /** `7 Oct`, for a row that has room for a date and nothing else. */
    const dayOf = (iso) => {
      if (!iso) return null;
      const at = new Date(iso);
      return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
    };

    /** A card's header: the service's mark, its name and one line under it, and a chip. */
    function CardHead(props) {
      return h(
        "div",
        { className: "pp-chead" },
        h("span", { className: "pp-svc pp-svc-" + props.service, "aria-hidden": "true" }, props.mark),
        h("span", { className: "pp-cname" }, props.name, h("span", { className: "pp-intwhat" }, props.subtitle)),
        props.chip ? h("span", { className: "pp-chip pp-chip-" + props.chip.tone }, props.chip.text) : null,
      );
    }

    /**
     * Google Sheets: the grade sheets this run reads and writes, and the Google
     * sign-in that lets it do so without a download.
     *
     * Connect Google is on the card while nobody is signed in, because it is the
     * one thing that turns "download the sheet, drop it here" into a Run press —
     * and in Details once somebody is, where Disconnect and Switch account belong.
     */
    function SheetsCard(props) {
      const data = props.data;
      const syncs = props.syncs ? props.syncs.syncs.filter((sync) => sync.service === "sheets") : [];
      const row = (data.integrations || []).find((entry) => entry.id === "sheets");
      const google = data.google || {};
      const checks = useSheetCheck(props.runId, props.sessionId, String(props.revision || 0));
      const [editing, setEditing] = React.useState(false);

      // The gradebook copy (`extensions.lms.sheet_id`) is the other use of Sheets:
      // a card is drawn for either.
      if (!syncs.length && !(row && row.state !== "absent")) return null;

      const ids = new Set(syncs.map((sync) => sync.id));
      const waiting = props.syncs ? props.syncs.waiting.filter((entry) => ids.has(entry.sync)) : [];
      const checkOf = (sync) => (checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) : null);
      const changed = syncs.filter((sync) => {
        const check = checkOf(sync);
        return check && check.state === "changed";
      });

      const subtitle = [
        google.connected ? "connected as " + (google.account || "your Google account") : "Google not connected · sheets come in as downloads",
        syncs.length ? syncs.length + " sheet" + (syncs.length === 1 ? "" : "s") : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const chip = waiting.length
        ? { text: waiting.length + " waiting", tone: "warn" }
        : changed.length
          ? { text: "changed in Google", tone: "warn" }
          : google.connected
            ? { text: "ready", tone: "ok" }
            : null;

      return h(
        "section",
        { className: "pp-ccard", id: "pp-card-sheets" },
        h(CardHead, { service: "sheets", mark: "GS", name: "Google Sheets", subtitle, chip }),
        syncs.map((sync) =>
          h(
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
              onDone: props.onDone,
            }),
          ),
        ),
        h(WaitingList, {
          rows: waiting,
          students: props.syncs ? props.syncs.students : [],
          names: props.syncs ? props.syncs.names : false,
          runId: props.runId,
          sessionId: props.sessionId,
          onDone: props.onDone,
        }),
        google.connected
          ? null
          : h(GoogleConnect, { google, onChanged: props.onRefresh }),
        h(
          "details",
          { className: "pp-cdetails" },
          h("summary", null, "Details"),
          google.connected ? h(GoogleConnect, { google, onChanged: props.onRefresh }) : null,
          h(
            Fact,
            {
              label: "Gradebook copy",
              note: data.sheet.id
                ? "The spreadsheet the gradebook is written to · summary tab " + data.sheet.summaryTab
                : "A spreadsheet the gradebook is written to, if you keep one — extensions.lms.sheet_id on the run",
            },
            data.sheet.id || h(Presence, { present: false, no: "none" }),
          ),
          row
            ? h(
                Fact,
                { label: "Credential", note: "a Google sign-in, AINAR_SHEETS_TOKEN, or a service-account key" },
                h(Presence, { present: row.steps[1] && row.steps[1].done, yes: "available", no: "none" }),
              )
            : null,
          row
            ? h(
                "div",
                { className: "pp-approverow" },
                h(
                  "button",
                  { type: "button", className: "pp-segbtn", "aria-pressed": editing, onClick: () => setEditing(!editing) },
                  data.sheet.id ? "Change the gradebook copy" : "Keep a gradebook copy",
                ),
              )
            : null,
          editing && row
            ? h(ProviderSetup, {
                integration: Object.assign({}, row, { fields: ["sheetId"] }),
                runId: props.runId,
                sessionId: props.sessionId,
                onCancel: () => setEditing(false),
                onSaved: (body) => {
                  setEditing(false);
                  if (props.onSaved) props.onSaved(body);
                },
              })
            : null,
        ),
      );
    }

    /**
     * GitHub: each homework's starter repository, which students fork.
     *
     * A row per assessment that names one, by due date, with where it is and when
     * this machine last pushed to it. A row opens to Preview and Send — a starter
     * repository is public and forked, so a push is something students see, and it
     * waits for a preview like every other press that leaves the machine.
     */
    function GithubCard(props) {
      const data = props.data;
      const sync = props.syncs ? props.syncs.syncs.find((entry) => entry.service === "github") : null;
      const rows = (data.assessments || [])
        .filter((assessment) => assessment.github)
        .sort((left, right) => String(left.dueAt || "9999").localeCompare(String(right.dueAt || "9999")));
      const [open, setOpen] = React.useState(null);

      if (!sync && !rows.length) return null;
      const unpublished = rows.filter((assessment) => !assessment.github.published);
      const chip = !rows.length
        ? null
        : unpublished.length
          ? { text: unpublished.length + " not published", tone: "warn" }
          : { text: "all published", tone: "ok" };

      return h(
        "section",
        { className: "pp-ccard", id: "pp-card-github" },
        h(CardHead, {
          service: "github",
          mark: "GH",
          name: "GitHub",
          subtitle:
            rows.length + " homework repositor" + (rows.length === 1 ? "y" : "ies") + " · students fork them" +
            (sync && sync.lastSynced ? " · last pushed " + when(sync.lastSynced) : ""),
          chip,
        }),
        rows.length
          ? h(
              "div",
              { className: "pp-crows" },
              rows.map((assessment) => {
                const id = assessment.assessmentId;
                const repo = assessment.github.repo;
                const published = assessment.github.published;
                const expanded = open === id;
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
                      assessment.dueAt ? h("span", { className: "pp-as" }, " · due " + dayOf(assessment.dueAt)) : null,
                    ),
                    h(
                      "span",
                      { className: "pp-crowpills" },
                      h("span", { className: "pp-chip" + (repo ? "" : " pp-chip-warn") }, repo || "no repository named"),
                      published
                        ? h("span", { className: "pp-chip pp-chip-ok" }, "published " + dayOf(published.at))
                        : h("span", { className: "pp-chip pp-chip-warn" }, "not published"),
                    ),
                  ),
                  expanded
                    ? h(
                        "div",
                        { className: "pp-cpanel" },
                        repo
                          ? h(
                              "p",
                              { className: "pp-as" },
                              h("a", { href: "https://github.com/" + repo, target: "_blank", rel: "noreferrer" }, repo + " ↗"),
                              assessment.github.folder ? " · from " + assessment.github.folder : "",
                              published ? " · last pushed from here " + when(published.at) : " · never pushed from here",
                            )
                          : h(
                              "p",
                              { className: "pp-as" },
                              "No repository is named yet. Record one as extensions.github.template_repo on the assessment — /design-assessment writes it when it scaffolds the starter.",
                            ),
                        sync
                          ? h(SyncCard, {
                              sync,
                              bare: true,
                              assessment: id,
                              runId: props.runId,
                              sessionId: props.sessionId,
                              names: props.names,
                              onDone: props.onDone,
                            })
                          : h("p", { className: "pp-as" }, "This run has no homework-repos sync, so there is nothing to push with."),
                      )
                    : null,
                );
              }),
            )
          : h("p", { className: "pp-as" }, "No assessment names a starter repository yet. /design-assessment writes one when it scaffolds the homework."),
      );
    }

    // ── client/integrations.js

    /** The last ready, error-free value of a `useJson`-shaped state, or null. */
    function useSteady(state) {
      const last = React.useRef(null);
      if (state.phase === "ready" && state.value && !state.value.error) last.current = state.value;
      return last.current;
    }

    /**
     * What this run is wired to, and what it is not.
     *
     * Drawn here rather than served as a document for `WidgetFrame`'s reason:
     * the views post back, and a frame with no `allow-same-origin` cannot call
     * the routes they post to.
     *
     * One fetch of `/api/integrations` for every view. It reads five files and
     * five environment variables, and splitting it per view would be chances to
     * show a host from one read beside a token from another.
     */
    function Integrations(props) {
      const url = scoped(
        BASE +
          "/api/integrations?run=" +
          encodeURIComponent(props.runId || "") +
          // The revision counter, in the URL because `useJson` re-fetches when
          // its URL changes and on nothing else. The route does not read `r`;
          // its only job is to make an `ainar lms` run in a terminal, or a
          // hand-edited version.yaml, redraw this tab without a remount.
          "&r=" +
          encodeURIComponent(String(props.revision || 0)),
        props.sessionId,
      );
      const state = useJson(url);
      // What a Save handed back, which is the record as it now is. Preferred
      // over the fetch for the reason `Preferences` prefers it: the form should
      // redraw from disk rather than from its own memory of what was ticked.
      const [fresh, setFresh] = React.useState(null);
      // A refusal from the credential seam, tagged with the field that caused it.
      const [status, setStatus] = React.useState(null);
      // Bumped after a sync press, so its card's chips and the waiting rows are
      // read again even where nothing passes `onWrite`.
      const [tick, setTick] = React.useState(0);
      // The run's marks and syncs, for the cards and the strip above them. The
      // syncs in Names mode only when the pane shows names: a waiting row is a
      // person, and "→ STUDENT-B7K2QA" asks a professor to decide what they
      // cannot read.
      const unpublished = useUnpublished(props.runId, props.sessionId, props.revision || 0);
      const syncs = useJson(
        scoped(
          BASE +
            "/api/syncs?run=" +
            encodeURIComponent(props.runId || "") +
            (props.names ? "&names=1" : "") +
            "&r=" +
            encodeURIComponent(String(props.revision || 0) + "." + tick),
          props.sessionId,
        ),
      );

      // A read that lands after a Save is at least as new as what the Save
      // handed back, so it takes over.
      React.useEffect(() => {
        if (state.phase !== "ready") return;
        setFresh(null);
        setStatus(null);
      }, [state]);

      // Every Save bumps the revision, and `useJson` goes back to loading on each
      // one. The last answer stays on screen meanwhile: blanking the tab would
      // unmount the Canvas card and close the row the professor was working in.
      const fetched = useSteady(state);
      const marks = useSteady(unpublished);
      const roads = useSteady(syncs);

      if (state.phase === "ready" && state.value && state.value.error && !fresh) {
        return h(Message, { error: true }, state.value.error);
      }
      const data = fresh || fetched;
      if (!data) return h(Message, null, "Reading what this run is wired to…");

      const sub = props.subView || "course";
      const onSaved = (body) => {
        setFresh(body);
        setStatus(null);
        // The run record changed, so every other view of it is stale — the same
        // counter an approval bumps.
        if (props.onWrite) props.onWrite();
      };
      // After a sync press: a run writes records, a confirm changes what waits.
      const onSynced = () => {
        setTick((value) => value + 1);
        if (props.onWrite) props.onWrite();
      };
      // A Google sign-in changes the registry and the credential store, not the
      // record, so nothing bumps the revision: read the document again by hand.
      const refresh = () =>
        fetch(url, { headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((body) => {
            if (!body.error) setFresh(body);
            setTick((value) => value + 1);
          })
          .catch(() => null);

      // ---- Credentials ---------------------------------------------------

      if (sub === "credentials") {
        return h(
          "div",
          { className: "pp-scroll" },
          h(
            "p",
            { className: "pp-absent" },
            "Presence only. This pane never shows a credential's value — a Canvas " +
              "token can change a grade, and this screen gets projected.",
          ),
          h(GoogleConnect, {
            google: data.google,
            // Re-read the whole document: the sign-in changed the registry and
            // the store, and the Status checklist reads both.
            onChanged: () =>
              fetch(url, { headers: { accept: "application/json" } })
                .then((response) => response.json())
                .then((body) => {
                  if (!body.error) setFresh(body);
                })
                .catch(() => null),
          }),
          h("p", { className: "pp-factgroup" }, "Credentials"),
          (() => {
            const refs = (data.credentials && data.credentials.refs) || {};
            // The Google sign-in is Connect's, above, and is never pasted.
            const google = data.google && data.google.tokenEnv;
            const names = Object.keys(refs)
              .filter((name) => name !== google)
              .sort();
            if (!names.length) {
              return h(
                "p",
                { className: "pp-absent" },
                "No connection in this run names a credential yet.",
              );
            }
            return [
              h(
                "p",
                { className: "pp-absent", key: "why" },
                data.credentials && data.credentials.available
                  ? "Type a token here and it goes to the harness's credential store, " +
                      "not into any file in this repository. It is never shown again — " +
                      "there is no code path that reads one back."
                  : "No credential provider is mounted, so these can only be set in the " +
                      "environment. The names are what to export.",
              ),
              ...names.map((name) =>
                h(Secret, {
                  key: name,
                  name,
                  status: refs[name],
                  runId: props.runId,
                  sessionId: props.sessionId,
                  onSaved: (body) => {
                    setFresh(body);
                    setStatus(null);
                    // A token is not the record, so `onWrite` is deliberately
                    // not called: nothing in courses/ changed and re-fetching
                    // every other view would be work for no new fact.
                  },
                  onStatus: (next) => setStatus(next),
                }),
              ),
              ...names
                .filter((name) => refs[name] && refs[name].why)
                .map((name) =>
                  h("p", { className: "pp-absent", key: name + ":why" }, name + ": " + refs[name].why),
                ),
              // A refusal from the seam belongs under the field that caused
              // it, and `status.from` carries the variable's name for exactly
              // that — the same tagging the Fetch and Save buttons use so one
              // button's failure is never printed beside the other's.
              status && status.error && names.includes(status.from)
                ? h("p", { className: "pp-saveerr", key: "err" }, status.error)
                : null,
            ];
          })(),
          h("p", { className: "pp-factgroup" }, "Environment"),
          data.environment.map((variable) =>
            h(
              Fact,
              { label: variable.name, note: variable.what, key: variable.name },
              h(Presence, { present: variable.present }),
            ),
          ),
          h("p", { className: "pp-factgroup" }, "Files"),
          h(
            Fact,
            {
              // First, because it is the file every tool now reads first.
              // The two below it are where the same answer used to live, and
              // they are still shown: during a migration the honest picture is
              // all three, and "the host you can see is in the file the pusher
              // does not read" is the diagnosis this tab exists to give.
              label: "connections.json",
              note:
                data.registry.error ||
                data.registry.path + " — the shared registry, `ainar connections`",
              missing: !data.registry.present || Boolean(data.registry.error),
            },
            data.registry.present
              ? data.registry.error
                ? "unreadable"
                : data.registry.connections.length +
                  " connection" +
                  (data.registry.connections.length === 1 ? "" : "s")
              : h(Presence, { present: false, no: "not migrated yet" }),
          ),
          h(
            Fact,
            {
              label: "lms.toml",
              note: data.canvas.configPath,
              missing: !data.canvas.host && !data.canvas.tokenInFile,
            },
            data.canvas.tokenInFile
              ? h(Presence, { present: true, yes: "host and token" })
              : data.canvas.host && data.canvas.hostFrom !== "AINAR_CANVAS_URL"
                ? h(Presence, { present: true, yes: "host only" })
                : h(Presence, { present: false, no: "nothing read" }),
          ),
          h(
            Fact,
            {
              label: "profiles (legacy)",
              note: data.connections.error || data.connections.path,
              missing: !data.connections.present || Boolean(data.connections.error),
            },
            data.connections.present
              ? data.connections.error
                ? "unreadable"
                : data.connections.profiles.length +
                  " profile" +
                  (data.connections.profiles.length === 1 ? "" : "s")
              : h(Presence, { present: false, no: "no file" }),
          ),
          h(
            Fact,
            {
              label: "people.json",
              note:
                data.roster.path +
                " — the identity store, outside the repository. The course record " +
                "holds pseudonyms; the real names are only here",
              missing: !data.roster.present,
            },
            data.roster.present
              ? data.roster.count === null
                ? "unreadable"
                : data.roster.count + " known"
              : h(Presence, { present: false, no: "no roster" }),
          ),
          data.registry.connections.some((connection) => connection.tokenInFile)
            ? h(
                "p",
                { className: "pp-saveerr" },
                "A connection in the registry holds a literal token, which that file is " +
                  "not supposed to contain at all. Revoke it at the provider, export a " +
                  "fresh one under the variable the connection names, and delete the line.",
              )
            : null,
          data.connections.profiles.some((profile) => profile.tokenInFile)
            ? h(
                "p",
                { className: "pp-saveerr" },
                "A legacy profile holds a literal token. It still works, but a token in a " +
                  "file that gets backed up and synced should be treated as exposed: " +
                  "`ainar connections migrate` says what to do about it, and does not " +
                  "copy the token forward.",
              )
            : null,
        );
      }

      // ---- This course ---------------------------------------------------

      return h(CourseIntegrations, {
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
        onRefresh: refresh,
        onWrite: props.onWrite,
      });
    }

    /** The services that have a card of their own; the rest are drawn as Status drew them. */
    const CARDED = new Set(["canvas", "sheets", "github"]);

    /**
     * Integrations → This course: what needs the professor, then one card per
     * service.
     *
     * The strip names only what a person has to do — a name a sync could not
     * place, an assessment with no Canvas column, marks Canvas does not have — and
     * each item goes to the rows it is about. A course with nothing to do shows no
     * strip at all rather than a green "all clear" to read past.
     *
     * Canvas, Google Sheets and GitHub have cards. Telegram and Moodle are still
     * drawn as Status drew them, and only when the course uses them: a service
     * nobody has set up is one line at the bottom, not a red row each. Any sync of
     * a service with no card is drawn on its own under "Other syncs", so moving
     * the syncs onto cards cannot lose one.
     *
     * `focus` comes from outside — the sheet notice, Students' "Sync from sheet" —
     * and scrolls the named card into view; its `tick` makes the same jump work
     * twice.
     */
    function CourseIntegrations(props) {
      const data = props.data;
      const [filter, setFilter] = React.useState({ id: null, tick: 0 });
      const [adding, setAdding] = React.useState(false);
      const [migrating, setMigrating] = React.useState(null);
      const canvasRow = (data.integrations || []).find((row) => row.id === "canvas");
      const reachable = Boolean(canvasRow) && canvasRow.steps.slice(0, 3).every((step) => step.done);
      const counts = canvasCounts(data, props.unpublished);
      const syncs = props.syncs ? props.syncs.syncs : [];
      const waiting = props.syncs ? props.syncs.waiting.length : 0;
      const others = (data.integrations || []).filter((row) => !CARDED.has(row.id));
      // A service with a sync on this run is used by it, set up or not.
      const synced = new Set(syncs.map((sync) => sync.service));
      const isUsed = (row) => row.state !== "absent" || synced.has(row.id);
      const used = others.filter(isUsed);
      const unused = others.filter((row) => !isUsed(row));
      const loose = syncs.filter((sync) => !CARDED.has(sync.service));
      const implied = syncs.filter((sync) => sync.implied).length;

      const scrollTo = (id) => {
        const card = document.getElementById(id);
        if (card) card.scrollIntoView({ block: "start" });
      };
      React.useEffect(() => {
        if (props.focus && props.focus.service) scrollTo("pp-card-" + props.focus.service);
      }, [props.focus && props.focus.tick]);

      const show = (id) => {
        setFilter((current) => ({ id, tick: current.tick + 1 }));
        scrollTo("pp-card-canvas");
      };
      const plural = (count, one, many) => count + " " + (count === 1 ? one : many);

      const migrate = () => {
        setMigrating("working");
        fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "migrate" }),
        })
          .then((response) => response.json())
          .catch((error) => ({ error: String((error && error.message) || error) }))
          .then((answer) => {
            setMigrating(answer);
            if (props.onSynced) props.onSynced();
          });
      };

      const needs = [
        waiting
          ? {
              key: "waiting",
              text: plural(waiting, "name", "names") + " from the grade sheet to confirm",
              go: () => scrollTo("pp-card-sheets"),
            }
          : null,
        reachable && counts.unlinked.length
          ? {
              key: "unlinked",
              text: plural(counts.unlinked.length, "assessment has", "assessments have") + " no Canvas column",
              go: () => show("unlinked"),
            }
          : null,
        counts.toSend.length
          ? {
              key: "marks",
              text: "Canvas is missing marks for " + plural(counts.toSend.length, "assessment", "assessments"),
              go: () => show("marks"),
            }
          : null,
      ].filter(Boolean);

      const card = {
        runId: props.runId,
        sessionId: props.sessionId,
        names: props.names,
        onSaved: props.onSaved,
      };

      return h(
        "div",
        { className: "pp-scroll pp-course" },
        needs.length
          ? h(
              "div",
              { className: "pp-needs", role: "status" },
              h("span", { className: "pp-needstitle" }, "Needs you"),
              needs.map((item) =>
                h(
                  "div",
                  { className: "pp-needsrow", key: item.key },
                  h("span", null, item.text),
                  h("button", { type: "button", className: "pp-segbtn", onClick: item.go }, "Show"),
                ),
              ),
            )
          : null,
        h(
          CanvasCard,
          Object.assign({}, card, {
            data,
            unpublished: props.unpublished,
            syncs: props.syncs,
            ask: props.ask,
            filter: filter.id,
            filterTick: filter.tick,
            onWrite: props.onWrite,
          }),
        ),
        h(
          SheetsCard,
          Object.assign({}, card, {
            data,
            syncs: props.syncs,
            revision: props.revision,
            onDone: props.onSynced,
            onRefresh: props.onRefresh,
          }),
        ),
        h(GithubCard, Object.assign({}, card, { data, syncs: props.syncs, onDone: props.onSynced })),
        used.length
          ? h(IntegrationStatus, {
              integrations: used,
              setup: data.setup,
              data,
              runId: props.runId,
              sessionId: props.sessionId,
              onSaved: props.onSaved,
            })
          : null,
        loose.length
          ? h(
              "div",
              { className: "pp-syncsection" },
              h("p", { className: "pp-factgroup" }, "Other syncs"),
              loose.map((sync) =>
                h(SyncCard, {
                  sync,
                  key: sync.id,
                  assessments: props.syncs.assessments,
                  runId: props.runId,
                  sessionId: props.sessionId,
                  names: props.names,
                  onDone: props.onSynced,
                }),
              ),
            )
          : null,
        unused.length
          ? h(
              "div",
              { className: "pp-unused" },
              h(
                "div",
                { className: "pp-approverow" },
                h("span", { className: "pp-as" }, "Not used by this course: " + unused.map((row) => row.label).join(", ")),
                h(
                  "button",
                  { type: "button", className: "pp-segbtn", "aria-pressed": adding, onClick: () => setAdding(!adding) },
                  adding ? "Close" : "Set one up",
                ),
              ),
              adding
                ? h(IntegrationStatus, {
                    integrations: unused,
                    setup: data.setup,
                    data,
                    runId: props.runId,
                    sessionId: props.sessionId,
                    onSaved: props.onSaved,
                  })
                : null,
            )
          : null,
        // The syncs this run still takes from older settings (lms.toml, the sheet
        // settings, the publishing profiles) rather than from its own `syncs:`.
        // They work as they are; this writes them down in one place.
        implied
          ? h(
              "div",
              { className: "pp-approverow" },
              h(
                "span",
                { className: "pp-as" },
                (implied === syncs.length ? "All " : implied + " of ") +
                  plural(syncs.length, "sync is", "syncs are") +
                  " read from older settings. Saving them writes syncs: into the run's settings.",
              ),
              h(
                "button",
                { type: "button", className: "pp-segbtn", disabled: migrating === "working", onClick: migrate },
                migrating === "working" ? "Writing…" : "Save in settings",
              ),
            )
          : null,
        migrating && migrating !== "working"
          ? h("pre", { className: "pp-approveout" + (migrating.error ? " pp-approveerr" : "") }, migrating.error || migrating.output)
          : null,
      );
    }

    // ── client/syncs.js

    /**
     * Why a row is waiting, in two or three words for the badge. The matcher's
     * own sentence is the title, for the professor who wants all of it.
     */
    const shortWhy = (why) => {
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

    /**
     * Which way a sync runs, as an icon: an arrow into a tray (coming in), out of
     * one (going out), or two arrows passing (both ways). Outline strokes in the
     * current colour, so the badge or heading around one decides how it looks.
     */
    const DIRECTION_PATHS = {
      source: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 3v12", "M8 11l4 4l4 -4"],
      target: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 15v-12", "M8 7l4 -4l4 4"],
      both: ["M7 10h14l-4 -4", "M17 14h-14l4 4"],
    };

    const DIRECTION_WORDS = { source: "Coming in", target: "Going out", both: "Both ways" };

    function DirectionIcon(props) {
      const size = props.size || 14;
      return h(
        "svg",
        {
          className: "pp-diricon",
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        (DIRECTION_PATHS[props.role] || DIRECTION_PATHS.both).map((d) => h("path", { d, key: d })),
      );
    }

    /** The icon on its own tint, for headings and cards. */
    function DirectionBadge(props) {
      return h(
        "span",
        { className: "pp-dir pp-dir-" + props.role + (props.small ? " pp-dir-small" : ""), title: DIRECTION_WORDS[props.role] },
        h(DirectionIcon, { role: props.role, size: props.small ? 11 : 14 }),
      );
    }

    /** A service's mark: two letters on its own colour. */
    const SERVICE = {
      canvas: { mark: "Cv", name: "Canvas" },
      sheets: { mark: "GS", name: "Google Sheets" },
      telegram: { mark: "Tg", name: "Telegram" },
      github: { mark: "GH", name: "GitHub" },
      moodle: { mark: "Md", name: "Moodle" },
      file: { mark: "F", name: "File" },
    };

    /** 0 → A, 25 → Z, 26 → AA: the sheet's own column letters. */
    const columnLetter = (index) => {
      let letters = "";
      let current = index + 1;
      while (current > 0) {
        const remainder = (current - 1) % 26;
        letters = String.fromCharCode(65 + remainder) + letters;
        current = Math.floor((current - 1) / 26);
      }
      return letters;
    };

    /** "today 14:20", "yesterday 09:05", "3 days ago · 6 Oct" — and the exact time in the title. */
    const when = (iso) => {
      if (!iso) return null;
      const at = new Date(iso);
      if (Number.isNaN(at.getTime())) return null;
      const clock = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const day = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const days = Math.round((day(new Date()) - day(at)) / 86400000);
      if (days <= 0) return "today " + clock;
      if (days === 1) return "yesterday " + clock;
      const date = at.toLocaleDateString([], { day: "numeric", month: "short" });
      return days < 14 ? days + " days ago · " + date : date;
    };

    const initials = (name) =>
      String(name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("") || "?";

    /** The row as it stands in the sheet: letters across, line numbers down, the waiting row lit. */
    function SheetPreview(props) {
      const preview = props.preview;
      const width = Math.max(preview.header.length, ...preview.rows.map((row) => row.cells.length));
      const marks = new Set(preview.markColumns);
      const cell = (value, index, extra) =>
        h(
          "td",
          {
            key: index,
            className:
              "pp-sheetcell" +
              (index === preview.nameColumn ? " pp-sheetname" : "") +
              (marks.has(index) ? " pp-sheetmark" : "") +
              (extra || ""),
            title: value || "",
          },
          value || "",
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
              Array.from({ length: width }, (_, index) => h("th", { key: index }, columnLetter(preview.firstColumn + index))),
            ),
          ),
          h(
            "tbody",
            null,
            h(
              "tr",
              { className: "pp-sheethead" },
              h("th", { className: "pp-sheetline" }, ""),
              Array.from({ length: width }, (_, index) => cell(preview.header[index], index)),
            ),
            preview.rows.map((row) =>
              h(
                "tr",
                { key: row.line, className: row.line === props.line ? "pp-sheetlit" : "" },
                h("th", { className: "pp-sheetline" }, row.line),
                Array.from({ length: width }, (_, index) => cell(row.cells[index], index)),
              ),
            ),
          ),
        ),
      );
    }

    /** A press to one of the sync routes, answered with the CLI's own words. */
    const syncPost = (runId, sessionId, path, body) =>
      fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId || ""), sessionId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((response) => response.json())
        .catch((error) => ({ error: String(error.message || error) }));

    /**
     * One sync: its mark, when it last ran, and Preview with Run or Send.
     *
     * Its own state — the last answer, the assessment chosen, where a sheet is read
     * from, whether a preview is on screen — so a card can sit on whichever
     * service's card it belongs to. `assessment` fixes the assessment (a GitHub
     * row); without it a sync that needs one offers a picker. `bare` drops the
     * mark and title, for a service card whose header already says them.
     *
     * `onDone` after every press: a preview keeps the rows it could not place for
     * review, so the waiting list is read again after either.
     */
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

      // The sheet itself when this machine can read it; otherwise the copy the
      // professor downloaded. A copy is older than the sheet by definition, so it
      // is never the default when the live read is there.
      const from = reading || (sync.canReadLive ? "live" : "export");

      const press = (action, confirm) => {
        setBusy(action);
        syncPost(props.runId, props.sessionId, "/api/syncs/action", {
          action,
          sync: sync.id,
          assessment: assessment || "",
          from: sync.exported && from === "export" ? "export" : "live",
          confirm: Boolean(confirm),
          names: Boolean(props.names),
        }).then((answer) => {
          setBusy(null);
          setResult(Object.assign({ action }, answer));
          setPreviewed(action === "plan" && !answer.error && Boolean(answer.ok));
          done();
        });
      };

      // A downloaded sheet, dropped on the card or chosen with the button. The host
      // keeps it only if `sync plan` can read it, and answers with that plan, so
      // what comes back is a preview of the new copy.
      const takeCopy = (file) => {
        if (!file) return;
        if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
          setResult({ action: "plan", error: "That is a spreadsheet file. In Google Sheets choose File → Download → Comma-separated values (.csv)." });
          return;
        }
        setBusy("copy");
        file
          .text()
          .then((csv) =>
            syncPost(props.runId, props.sessionId, "/api/syncs/copy", {
              sync: sync.id,
              csv,
              names: Boolean(props.names),
              // When the browser saved the download: how old the sheet in it is.
              lastModified: file.lastModified,
            }),
          )
          .catch((error) => ({ error: String(error.message || error) }))
          .then((answer) => {
            setBusy(null);
            setResult(Object.assign({ action: "plan" }, answer));
            const kept = !answer.error && answer.ok;
            if (kept) setReading("export");
            setPreviewed(Boolean(kept));
            done();
          });
      };

      const chips = [
        check && check.state === "changed"
          ? h(
              "span",
              { className: "pp-chip pp-chip-warn", key: "c", title: check.said + " — checked " + new Date(check.checked_at).toLocaleTimeString() },
              "changed in Google" + (check.modified ? " " + when(check.modified) : ""),
            )
          : null,
        check && check.state === "same"
          ? h("span", { className: "pp-chip", key: "c", title: "Checked " + new Date(check.checked_at).toLocaleTimeString() }, "up to date")
          : null,
        check && check.state === "error" ? h("span", { className: "pp-chip", key: "c", title: check.said }, "could not check") : null,
        sync.remembered ? h("span", { className: "pp-chip", key: "r", title: "Students found by a saved link" }, sync.remembered + " remembered") : null,
        // On a service's card the header already counts what waits.
        sync.waiting && !props.bare ? h("span", { className: "pp-chip pp-chip-warn", key: "w" }, sync.waiting + " waiting") : null,
        sync.live ? h("span", { className: "pp-chip pp-chip-live", key: "l" }, "others see it") : null,
        sync.enabled ? null : h("span", { className: "pp-chip", key: "x" }, "switched off"),
      ].filter(Boolean);

      // A grade sheet this machine cannot open itself comes in as a file the
      // professor downloads; the whole card takes the drop.
      const takesFile = Boolean(sync.download) && !sync.canReadLive;
      const hasFile = (event) => Array.from((event.dataTransfer && event.dataTransfer.types) || []).includes("Files");
      const dropProps = takesFile
        ? {
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
            },
          }
        : {};

      const last = h(
        "div",
        {
          className: "pp-synclast" + (sync.lastSynced || props.assessment ? "" : " pp-synclast-never"),
          title: sync.lastSynced ? new Date(sync.lastSynced).toLocaleString() : "No record of this sync running",
        },
        // A card fixed to one assessment says nothing about when: the last run is
        // per sync, and would be the date of some other assessment's.
        props.assessment
          ? sync.live
            ? "Preview, then send"
            : "Preview, then run"
          : sync.lastSynced
            ? "Last synced " + when(sync.lastSynced)
            : "Never synced",
        // What that run brought, for a grade sheet: the marks, and how old the sheet was.
        sync.lastEvent && !props.assessment
          ? " · " +
              ([
                sync.lastEvent.added ? sync.lastEvent.added + " new" : null,
                sync.lastEvent.changed ? sync.lastEvent.changed + " changed" : null,
                sync.lastEvent.removed ? sync.lastEvent.removed + " taken back" : null,
              ]
                .filter(Boolean)
                .join(", ") || "no marks changed") +
              (sync.lastEvent.read === "file" && sync.lastEvent.saved ? " · sheet saved " + when(sync.lastEvent.saved) : "")
          : null,
      );

      return h(
        "div",
        Object.assign({ className: "pp-synccard" + (props.bare ? " pp-synccard-bare" : "") + (dropping ? " pp-synccard-drop" : "") }, dropProps),
        props.bare
          ? h("div", { className: "pp-syncmain" }, last, chips.length ? h("div", { className: "pp-chips" }, chips) : null)
          : h(
              "div",
              { className: "pp-synctop" },
              h(
                "span",
                { className: "pp-svcwrap" },
                h("span", { className: "pp-svc pp-svc-" + sync.service, title: service.name, "aria-hidden": "true" }, service.mark),
                // Which way it runs, on the corner of the service's mark.
                h(DirectionBadge, { role: sync.role, small: true }),
              ),
              h(
                "div",
                { className: "pp-syncmain" },
                h("div", { className: "pp-synctitle" }, props.title || sync.label, h("span", { className: "pp-syncid" }, sync.id)),
                last,
                chips.length ? h("div", { className: "pp-chips" }, chips) : null,
              ),
            ),
        sync.needs === "message"
          ? h("p", { className: "pp-as" }, "Announcements are written and sent from Publish.")
          : h(
              "div",
              { className: "pp-syncctl" },
              needsAssessment && !props.assessment
                ? h(
                    "select",
                    {
                      value: picked,
                      onChange: (event) => {
                        setPicked(event.target.value);
                        setPreviewed(false);
                      },
                    },
                    h("option", { value: "" }, "Choose the assessment…"),
                    (props.assessments || []).map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title)),
                  )
                : null,
              // Where the sheet is read from. Directly when this machine has a
              // Google login of its own; otherwise from the copy the professor
              // downloaded, with its date, and the two presses that replace it.
              sync.exported !== null && sync.exported !== undefined && sync.hasSheet && sync.canReadLive
                ? h(
                    "select",
                    {
                      value: from,
                      onChange: (event) => {
                        setReading(event.target.value);
                        setPreviewed(false);
                      },
                    },
                    h("option", { value: "live" }, "Read the sheet in Google"),
                    sync.exported ? h("option", { value: "export" }, "Read the copy of " + when(sync.exported)) : null,
                  )
                : sync.exported !== null && sync.exported !== undefined
                  ? h(
                      "span",
                      {
                        className: "pp-synccopy" + (sync.exported ? "" : " pp-synccopy-none"),
                        title: sync.exported ? new Date(sync.exported).toLocaleString() : "",
                      },
                      sync.exported ? "Copy of the sheet from " + when(sync.exported) : "No copy of the sheet yet",
                    )
                  : null,
              takesFile
                ? h(
                    "a",
                    {
                      className: "pp-syncbtn",
                      href: sync.download.url,
                      target: "_blank",
                      rel: "noreferrer",
                      title: "Your browser downloads the sheet from Google as a .csv file",
                    },
                    "Download from Google",
                  )
                : null,
              takesFile
                ? h(
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
                      },
                    }),
                  )
                : null,
              h("span", { className: "pp-segspacer" }),
              h(
                "button",
                { type: "button", className: "pp-syncbtn", disabled: Boolean(busy) || !ready, onClick: () => press("plan") },
                busy === "plan" ? "Looking…" : "Preview",
              ),
              sync.live
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-syncbtn pp-syncbtn-send",
                      disabled: Boolean(busy) || !ready || !previewed,
                      title: previewed ? "Do what the preview shows" : "Preview first",
                      onClick: () => press("run", true),
                    },
                    busy === "run" ? "Sending…" : "Send",
                  )
                : h(
                    "button",
                    {
                      type: "button",
                      className: "pp-syncbtn pp-syncbtn-run",
                      disabled: Boolean(busy) || !ready || !sync.enabled,
                      onClick: () => press("run"),
                    },
                    busy === "run" ? "Running…" : "Run",
                  ),
            ),
        // How the file gets here, and what would make the step unnecessary: the
        // missing thing named, so "why do I have to do this" has an answer.
        takesFile
          ? h(
              "p",
              { className: "pp-synchint" },
              "This computer has no Google login of its own, so the sheet comes in as a file: press Download from Google" +
                (sync.download.tabHint
                  ? " (it downloads the first tab; for “" +
                    sync.download.tabHint +
                    "” open that tab and use File → Download → Comma-separated values)"
                  : "") +
                ", then drop the file here. You see what it would change before anything is written.",
            )
          : null,
        result
          ? h(
              "div",
              { className: "pp-syncout" + (result.error || !result.ok ? " pp-syncout-err" : "") },
              h(
                "div",
                { className: "pp-syncouthead" },
                h("span", null, result.error ? "Could not run" : result.action === "run" ? "Done" : "Preview — nothing was changed"),
                h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: () => setResult(null) }, "×"),
              ),
              h("pre", null, result.error || result.output || "(nothing printed)"),
            )
          : null,
      );
    }

    /**
     * One row a sync was not sure of: where it stands in its sheet, who it most
     * likely is, and Confirm or Someone else. A confirmed row is remembered on this
     * computer and applied the next time its sync runs; until then it writes
     * nothing.
     */
    function WaitingCard(props) {
      const row = props.row;
      const [picking, setPicking] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [failed, setFailed] = React.useState(null);
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
          to: to || null,
        }).then((answer) => {
          setBusy(false);
          if (answer.error || !answer.ok) {
            setFailed(answer.error || answer.output || "It was not confirmed.");
            return;
          }
          if (props.onDone) props.onDone();
        });
      };

      return h(
        "div",
        { className: "pp-waitcard" },
        h(
          "div",
          { className: "pp-waithead" },
          h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, preview ? "GS" : "··"),
          h(
            "span",
            { className: "pp-waitsource" },
            row.source,
            preview && preview.tab ? h("span", { className: "pp-waitwhere" }, " · tab " + preview.tab) : null,
            row.line ? h("span", { className: "pp-waitwhere" }, " · line " + row.line) : null,
          ),
          h("span", { className: "pp-segspacer" }),
          preview && preview.open
            ? h("a", { className: "pp-waitopen", href: preview.open, target: "_blank", rel: "noreferrer" }, "Open in Google Sheets ↗")
            : null,
        ),
        preview ? h(SheetPreview, { preview, line: row.line }) : null,
        h(
          "div",
          { className: "pp-waitdecide" },
          h(
            "div",
            { className: "pp-waitpair" },
            h(
              "span",
              { className: "pp-waitwritten", title: "As written in the sheet" },
              row.written !== null ? "“" + row.written + "”" : "(name hidden)",
            ),
            h("span", { className: "pp-waitarrow", "aria-hidden": "true" }, "→"),
            best
              ? h(
                  "span",
                  { className: "pp-waitwho" },
                  h("span", { className: "pp-avatar", "aria-hidden": "true" }, best.name ? initials(best.name) : "?"),
                  h("span", { className: "pp-waitname" }, person(best)),
                )
              : h("span", { className: "pp-as" }, "nobody in the class list is close"),
            h("span", { className: "pp-chip pp-chip-warn", title: row.why.replace(/ of STUDENT-[A-Z0-9]+/, "") }, shortWhy(row.why)),
          ),
          row.candidates.length > 1
            ? h("div", { className: "pp-as" }, "Also near: " + row.candidates.slice(1).map(person).join(", "))
            : null,
          picking
            ? h(
                "div",
                { className: "pp-syncctl" },
                h(
                  "select",
                  { value: picking.to || "", onChange: (event) => setPicking({ to: event.target.value }) },
                  h("option", { value: "" }, "Who is it?"),
                  (props.students || []).map((student) =>
                    h("option", { value: student.student, key: student.student }, student.name || student.student),
                  ),
                ),
                h("span", { className: "pp-segspacer" }),
                h(
                  "button",
                  { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy || !picking.to, onClick: () => confirm(picking.to) },
                  "Confirm",
                ),
                h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking(null) }, "Cancel"),
              )
            : h(
                "div",
                { className: "pp-syncctl" },
                h("span", { className: "pp-segspacer" }),
                best
                  ? h(
                      "button",
                      { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy, onClick: () => confirm(null) },
                      "Confirm " + (best.name ? best.name.split(/\s+/)[0] : "it"),
                    )
                  : null,
                h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking({ to: "" }) }, "Someone else"),
              ),
          failed ? h("p", { className: "pp-saveerr" }, failed) : null,
        ),
      );
    }

    /** The rows waiting on a service's syncs, with the sentence that says what Confirm does. */
    function WaitingList(props) {
      const rows = props.rows || [];
      if (!rows.length) return null;
      return h(
        "div",
        { className: "pp-syncsection" },
        h("h3", { className: "pp-synch3" }, "Waiting for you", h("span", { className: "pp-count pp-count-warn" }, rows.length)),
        h(
          "p",
          { className: "pp-as" },
          props.names
            ? "Each row as it stands in its sheet, and who it most likely is. A confirmed row is remembered on this computer and applied the next time its sync runs; until then it writes nothing."
            : "Names are hidden. Press Names to see who each row is.",
        ),
        h(
          "div",
          { className: "pp-waitlist" },
          rows.map((row) =>
            h(WaitingCard, {
              row,
              students: props.students,
              runId: props.runId,
              sessionId: props.sessionId,
              onDone: props.onDone,
              key: row.sync + row.key,
            }),
          ),
        ),
      );
    }

    // ── client/course-escape.js

    const courseModeEscape = ({ covered }) => (covered ? "none" : "close");

    // ── client/materials.js

    /**
     * A widget document in an iframe, delivered as `srcdoc` rather than `src`.
     *
     * `sandbox` deliberately withholds `allow-same-origin`. The document needs
     * to run its own script and needs no origin privileges: the widgets declare
     * an empty CSP allow-list and their own README forbids network, images and
     * `callTool`, so a frame with no origin is the honest expression of what
     * they are. Granting `allow-same-origin` beside `allow-scripts` would also
     * be theatre — a frame with both can reach up and remove its own sandbox
     * attribute.
     *
     * `allow-popups` and `allow-popups-to-escape-sandbox` ARE granted, and the
     * reason is the deck. Every slide link in the week view is a real file this
     * app serves, and with `allow-scripts` alone Chrome stopped every one of
     * them: a frame with an opaque origin may not navigate itself or the top
     * document, so pressing PDF did nothing at all and looked like a broken
     * link. The escape flag is the second half of it — without it the new tab
     * inherits the opaque origin and a PDF viewer will not load in it.
     *
     * The alternative was to route each click out through the same postMessage
     * channel the buttons use and call `window.open` from here. It is the more
     * conservative shape and it does not work: the popup blocker wants the open
     * to happen inside the gesture, and a message handler is a later task.
     *
     * What keeps this narrow is not the sandbox, it is the href. `safeUrl` in
     * `runtime.js` returns null for anything that is not http, https or a
     * relative path, so `javascript:` and `data:` never reach the document, and
     * the payload that supplies the URLs is ours.
     *
     * Which is why this fetches the document and hands it over as `srcdoc`
     * instead of pointing `src` at the route. Navigating a frame that has no
     * origin privileges to a URL is the part that gets stopped: in the browser
     * this was built against, such a subframe load fails outright with
     * `ERR_BLOCKED_BY_CLIENT` and the frame stays blank, while the identical
     * document in `srcdoc` under the identical sandbox paints and its script
     * runs and can `postMessage` back. Fetching is a plain same-origin read
     * from the app, so nothing about the document or the sandbox has to be
     * relaxed to make it arrive.
     *
     * The failure text on the route is HTML for this reason too: it arrives
     * here as a document and goes into the frame like any other.
     */
    function WidgetFrame(props) {
      const url = scoped(
        BASE +
          "/view/" +
          props.view +
          "?run=" +
          encodeURIComponent(props.runId) +
          (props.dark ? "&dark=1" : "") +
          (props.drafts ? "&drafts=1" : "") +
          // Course mode's "Preview as student": the record alone, no hole.
          (props.student ? "&student=1" : "") +
          // Course mode's reading: planning, teaching, or the full term table.
          (props.mode ? "&mode=" + encodeURIComponent(props.mode) : "") +
          // Teaching's focus week, when course mode kept one.
          (props.week ? "&week=" + encodeURIComponent(props.week) : "") +
          // Only ever sent affirmatively, and only by the class list. Every
          // other view's URL is unchanged, so nothing else can start naming
          // people because a parameter leaked into a shared link.
          (props.names ? "&names=1" : ""),
        props.sessionId,
      );
      const [doc, setDoc] = React.useState(null);
      React.useEffect(() => {
        let live = true;
        setDoc(null);
        fetch(url)
          .then((response) =>
            response.text().then((text) => ({
              html: text,
              // What the route says it merged, and what the draft loader
              // complained about on the way. Headers rather than fields in the
              // payload, because the payload goes into a widget document that
              // is shared with two other hosts and has no place to print them.
              mode: response.headers.get("x-professor-pane-drafts"),
              issues: decodeIssues(response.headers.get("x-professor-pane-draft-issues")),
            })),
          )
          .then((value) => {
            if (live) setDoc(value);
          })
          .catch((error) => {
            if (live) setDoc({ failed: String(error.message || error) });
          });
        return () => {
          live = false;
        };
      }, [url]);

      if (doc === null) return h(Message, null, "Reading the course model…");
      if (doc.failed) return h(Message, { error: true }, doc.failed);
      return h(
        React.Fragment,
        null,
        doc.mode === "merged"
          ? h(
              "div",
              { className: "pp-banner" },
              h("b", null, "Record + drafts. "),
              "Everything below includes records marked ",
              h("code", null, "approval: draft"),
              ", which nobody has accepted yet. Accepting one is changing that word to ",
              h("code", null, "approved"),
              " in its record, and that is yours to do.",
              doc.issues.length
                ? h("span", { className: "pp-issues" }, doc.issues.join("  ·  "))
                : null,
            )
          : null,
        h("iframe", {
          className: "pp-frame",
          srcDoc: doc.html,
          sandbox: "allow-scripts allow-popups allow-popups-to-escape-sandbox",
          "aria-label": props.title,
          title: props.title,
        }),
      );
    }

    // ------------------------------------------------------- material view

    /**
     * The one URL shape the overlay will put in a frame.
     *
     * The address arrives as a `postMessage` from a document with an opaque
     * origin, which is to say from somewhere this side cannot authenticate. So
     * it is not trusted as a URL at all: it is accepted only if it resolves to
     * THIS app's own material route, and anything else — another origin,
     * another path on this one, a `javascript:` string — comes back null and
     * nothing opens. What the frame can be pointed at is therefore exactly the
     * set of documents `sendMaterial` is already willing to serve.
     */
    /**
     * The routes a frame may ask this app to open over the harness.
     *
     * An allowlist of exact pathnames on this app's own origin, and it is the
     * whole of the check — a frame naming anything else gets silence rather
     * than a frame. Two entries, and both are reads that resolve an identifier
     * the course record already names:
     *
     * - `/file` serves a DOCUMENT, addressed by `document_id`.
     * - `/brief` serves a piece of graded work's own text, addressed by run and
     *   `assessment_id`. It joined the list when the outline's chips started
     *   opening a brief: most assessments carry no document, so there was no
     *   `/file` address to give them.
     * - `/outline` serves what was READ out of a deck the course did not write,
     *   addressed by `document_id`. Same shape again: a `presentation_plan` is
     *   a record, not a file, so there is no `/file` address for it either.
     * - `/starter` serves a homework's starter README when no brief document is
     *   registered, addressed by run and `assessment_id`, like `/brief`.
     *
     * Adding a route here is granting it the overlay, so the bar is the one
     * `/file` already meets: same origin, a read, and addressed by an id rather
     * than by anything resembling a path.
     */
    const MATERIAL_ROUTES = new Set([
      BASE + "/file",
      BASE + "/brief",
      BASE + "/outline",
      BASE + "/starter",
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

    /**
     * The formats the browser paints with a viewer of its own rather than as a
     * document. They are framed unsandboxed, because a sandbox stops the
     * viewer; nothing in either format can run anyway.
     */
    const MEDIA = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp"]);

    /**
     * How the thing in the overlay is named in a message.
     *
     * The identifier first, because that is the part that saves work: a model
     * handed `DOC-0204` reads that document, while one handed a title has to
     * go and find which of forty it was — and may pick the wrong one, which is
     * worse than searching. The title follows in quotes so the professor can
     * see what they attached without decoding an id.
     *
     * The id comes out of the address rather than from a new prop, because the
     * address already carries exactly one and this pane put it there:
     * `/file?doc=…` names a Document, `/brief?…&assessment=…` names the piece
     * of graded work whose own text is being shown. Anything else — a material
     * hosted elsewhere, some future route — has no identifier to offer and
     * returns empty, which is the button's own condition for existing.
     */
    function mentionOf(url, label) {
      let parsed;
      try {
        parsed = new URL(url, window.location.href);
      } catch {
        return "";
      }
      const id =
        parsed.searchParams.get("doc") ?? parsed.searchParams.get("assessment") ?? "";
      if (id === "") return "";
      const title = typeof label === "string" ? label.trim() : "";
      const named = title === "" ? id : id + ' ("' + title + '")';

      // What this artefact was made from, when the record says. Both ends are
      // named rather than one: the id identifies what is on screen, and the
      // source is the record to change — a PDF of a deck is not editable and
      // its builder is, so a question about "this slide" is answered in the
      // second one. `from` is put on the address by `withMaterialLinks`, which
      // walks `extensions.rendered_from` to the end of the chain.
      const source = parsed.searchParams.get("from") ?? "";
      return source === "" ? named : named + ", built from " + source;
    }

    /**
     * A deck, a paper or a handout, over the whole harness.
     *
     * Portalled to `document.body` rather than rendered in place. The pane is
     * the third column of the AppFrame and a slide is not a column-shaped
     * thing; a modal rendered inside `.pp-root` would be clipped by the column
     * whatever its z-index said, because the column scrolls its own overflow.
     * `createPortal` is how the shipped halves leave their seat — the subagent
     * switcher's menu does the same — so this is the harness's own idiom and
     * not a hole punched through it.
     *
     * HOW THE FRAME IS SANDBOXED, AND WHY IT DEPENDS ON THE FORMAT
     *
     * Not a preference. Measured in the browser this was built against, on
     * this app's own `/file` route:
     *
     * | frame                          | PDF | image | HTML | SVG | text |
     * | ------------------------------ | --- | ----- | ---- | --- | ---- |
     * | `sandbox` without same-origin  |  ✗  |   ✗   |  ✗   |  ✗  |  ✗   |
     * | `sandbox="allow-same-origin"`  |  ✗  |   ✗   |  ✓   |  ✓  |  ✓   |
     * | no sandbox                     |  ✓  |   ✓   |  ✓   |  ✓  |  ✓   |
     *
     * The first row is the one that surprises: a frame with an opaque origin
     * may not load a same-origin URL at all, and the request fails outright as
     * `ERR_BLOCKED_BY_CLIENT` with a blank panel where the deck should be. It
     * is the same finding `WidgetFrame` records, which is why the widgets are
     * delivered as `srcdoc` rather than pointed at their route.
     *
     * The second row is the PDF viewer and the image viewer: both are internal
     * documents of the browser's own, and a sandbox blocks them even when the
     * origin matches.
     *
     * So MEDIA — a PDF, a PNG, a JPEG — is framed with no sandbox, which costs
     * nothing: neither format can execute anything in the first place, and the
     * PDF viewer runs in a sandbox of the browser's own. Everything else is a
     * DOCUMENT, framed with `allow-same-origin` and therefore WITHOUT
     * `allow-scripts`: a course model may hold an HTML handout downloaded from
     * anywhere, and a script in one served same-origin would be running inside
     * the harness with the professor's session. Scripts off is what makes that
     * safe; the same-origin grant only makes it load.
     *
     * `Escape` closes, and so does the veil — but only the veil itself, never
     * a click that started inside the dialog. `stopPropagation` on the dialog
     * is what keeps a text selection dragged out of a PDF from dismissing the
     * thing being read.
     *
     * The header keeps a plain link to the same URL, and it is not decoration:
     * a `.pptx` reaches the frame as a download prompt or as a blank panel,
     * and the tab is the answer for every format the browser will not paint.
     */
    /**
     * Course mode: the whole term as the page, over the harness.
     *
     * Step four of `COURSE-MODE.md` — the spine as a page, chat as a button —
     * taken in the one shape this harness offers. Its layout declares no
     * full-width seat (`sidebar`, `conversation`, `details`, `shell.overlay`),
     * so this is the material overlay's own idiom: portalled to the body,
     * fixed over everything, closed with Escape, the backdrop or ×. The
     * conversation is underneath it, not replaced, and that is the "chat as a
     * button" half: a press on the page sends its prompt into the open session
     * and closes this, so the professor lands on the turn they started.
     *
     * The document is `/view/course`, drawn by the pane (`server/course-mode.js`)
     * from the same outline payload the Weeks tab gets, in the same sandboxed
     * frame, posting the same two messages. Record / + drafts is the pane's
     * own state, so this and the column never disagree about which half they
     * show; Preview as student is this view's alone.
     */
    /**
     * The two modes a professor is in, the full table either can drop into,
     * and how it went. Planning asks whether the term holds together; Teaching
     * is this week between the last and the next; Evidence is every week's
     * hand-ins, marks and concepts. Those two alone carry class figures.
     */
    const COURSE_MODES = [
      { id: "planning", label: "Planning", hint: "Does the term hold together: topics, quizzes, homework, weights" },
      { id: "teaching", label: "Teaching", hint: "This week, between the last and the next. Carries class figures" },
      { id: "evidence", label: "Evidence", hint: "How each week went: hand-ins, marks and concepts. Carries class figures" },
      { id: "term", label: "All weeks", hint: "Every week in full, three columns" },
    ];

    /**
     * Teaching while the run is under way, Planning before it starts or after
     * it ends. The run's own dates, compared as the ISO strings they are, and
     * today in the machine's local calendar — no arithmetic, no time zone.
     */
    const defaultCourseMode = (start, end) => {
      const now = new Date();
      const today =
        now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");
      return start && end && today >= start && today <= end ? "teaching" : "planning";
    };

    /**
     * The course read by person, by mark and by task rather than by week: the
     * class list, the gradebook and the tasks, each the very document its pane
     * tab shows. Chosen like the readings above and drawn after them, past a
     * divider, because they are not a way of painting the weeks. They carry
     * names and marks, so they are private: no Preview as student on them, and
     * their buttons are off while previewing one of the readings.
     */
    const COURSE_VIEWS = [
      { id: "students", label: "Students", hint: "The class list, by subgroup — names and marks, so private" },
      { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment, and how much of it Canvas has" },
      { id: "tasks", label: "Tasks", hint: "What is waiting for you, what is ready, what has not gone out" },
      // The private material itself — scanned papers, recorded answers — which
      // lives outside the course folder, so has no other place to be seen whole.
      { id: "files", label: "Files", hint: "Scans and audio: where they are stored, how much there is, each pile" },
      // Last: not the course but its roads out — Canvas, the sheet, the
      // repositories — and the rows a sync was not sure of, by name.
      { id: "integrations", label: "Integrations", hint: "Canvas, the grade sheet and GitHub: where each stands, and what is waiting for you" },
    ];

    /** The Status view's words for a connection, as the Integrations tab says them. */
    const CONNECTION_STATE = { ready: "connected", partial: "partly set up", absent: "not set up" };

    function CourseMode(props) {
      const close = props.onClose;
      const [student, setStudent] = React.useState(false);
      const [mode, setMode] = React.useState(() => defaultCourseMode(props.start, props.end));
      // A course-wide view, when one is chosen, in place of the reading; the
      // reading is kept so the weeks come back as they were left.
      const [view, setView] = React.useState(null);
      const [taskSub, setTaskSub] = React.useState(SUBVIEWS.tasks[0].id);
      // Integrations: the pane's own tab, drawn here so going
      // to it does not close course mode. This course first, as in the pane.
      const [integrationsSub, setIntegrationsSub] = React.useState("course");
      // The week Teaching was last stepped to. The page steps without a round
      // trip and reports each step; it is held in a ref so a step redraws
      // nothing, and copied into `week` only when Teaching is drawn again — on
      // coming back to it, or when the record or the drafts toggle changes.
      const stepped = React.useRef(null);
      const [week, setWeek] = React.useState(null);
      React.useEffect(() => {
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.source !== "professor-pane" || data.kind !== "teaching-week") return;
          if (Number.isInteger(data.week) && data.week > 0 && data.week < 100) stepped.current = data.week;
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
      }, []);
      React.useEffect(() => {
        setWeek(stepped.current);
      }, [props.reload, props.drafts]);
      const chooseMode = (id) => {
        if (id === "teaching") setWeek(stepped.current);
        setMode(id);
        setView(null);
      };
      // Teaching, Evidence and the course-wide views carry class figures or
      // names, so there is no student version of any of them to preview.
      const private_ = view !== null || mode === "teaching" || mode === "evidence";
      const preview = student && !private_;
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== "Escape") return;
          // A deck opened from the term plan sits on top and owns Escape: it
          // closes first, and this stays where the professor was reading.
          if (courseModeEscape({ covered: props.covered }) === "close") close();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      }, [close, props.covered]);
      // Canvas, in one line: the row the Integrations tab's Status view draws,
      // from the same payload. Nothing is computed here but the words.
      const wiring = useJson(
        scoped(BASE + "/api/integrations?run=" + encodeURIComponent(props.runId || "") + "&r=" + props.reload, props.sessionId),
      );
      const canvas =
        wiring.phase === "ready" && wiring.value && !wiring.value.error
          ? (wiring.value.integrations || []).find((row) => row.id === "canvas") || null
          : null;

      // How many sync rows wait for the professor, for the header line. Read
      // without names: a count needs none.
      const syncs = useJson(
        scoped(BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + "&r=" + props.reload, props.sessionId),
      );
      // The last answer of each read is kept while the next one loads, so a
      // confirm or a run — which bump `reload` — does not blank the line.
      const shown = React.useRef({ canvas: null, waiting: 0 });
      if (wiring.phase === "ready") shown.current.canvas = canvas;
      if (syncs.phase === "ready") {
        shown.current.waiting = syncs.value && !syncs.value.error ? (syncs.value.waiting || []).length : 0;
      }
      const waiting = shown.current.waiting;
      const canvasLine = shown.current.canvas;

      const viewBody = () => {
        if (view === "files") {
          return h(
            "div",
            { className: "pp-cviewpad" },
            h(Files, {
              runId: props.runId,
              sessionId: props.sessionId,
              revision: props.reload,
              onUpload: props.onUpload,
              onOpenScans: props.onOpenScans,
              onRecordings: props.onRecordings,
              key: props.runId,
            }),
          );
        }
        if (view === "integrations") {
          return h(
            "div",
            { className: "pp-cviewpad" },
            h(Integrations, {
              runId: props.runId,
              subView: integrationsSub,
              sessionId: props.sessionId,
              onWrite: props.onWrite,
              revision: props.reload,
              names: props.names,
              ask: props.ask,
              key: props.runId,
            }),
          );
        }
        if (view === "students") {
          return h(WidgetFrame, {
            key: "students|" + props.names + "|" + props.dark + "|" + props.reload,
            view: "students",
            runId: props.runId,
            sessionId: props.sessionId,
            dark: props.dark,
            names: props.names,
            title: "Students",
          });
        }
        if (view === "gradebook") {
          return h(
            React.Fragment,
            null,
            h(GradebookStatus, {
              runId: props.runId,
              sessionId: props.sessionId,
              revision: props.reload,
              names: props.names,
              ask: props.ask,
              onWrite: props.onWrite,
            }),
            h(RecentMarks, { runId: props.runId, sessionId: props.sessionId, revision: props.reload, names: props.names }),
            h(WidgetFrame, {
              key: "gradebook|" + props.dark + "|" + props.drafts + "|" + props.reload,
              view: "gradebook",
              runId: props.runId,
              sessionId: props.sessionId,
              dark: props.dark,
              drafts: props.drafts,
              title: "Gradebook",
            }),
          );
        }
        if (taskSub === "unpublished") {
          return h(Unpublished, {
            runId: props.runId,
            sessionId: props.sessionId,
            revision: props.reload,
            onWrite: props.onWrite,
            openPublish: props.openPublish,
            ask: props.ask,
            names: props.names,
          });
        }
        return h(WidgetFrame, {
          key: taskSub + "|" + props.names + "|" + props.dark + "|" + props.drafts + "|" + props.reload,
          view: taskSub,
          runId: props.runId,
          sessionId: props.sessionId,
          dark: props.dark,
          drafts: props.drafts,
          names: props.names,
          title: "Tasks",
        });
      };
      const segment = (entry, pressed, onClick, disabled) =>
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            "aria-pressed": pressed,
            disabled: disabled,
            title: disabled ? "Private — not shown while previewing as a student" : entry.hint,
            onClick: onClick,
            key: entry.id,
          },
          entry.label,
        );
      // The views that name people follow the pane's Names / Pseudonyms choice.
      const named = view === "students" || view === "integrations" || (view === "tasks" && taskSub !== "unpublished");

      return ReactDOM.createPortal(
        h(
          "div",
          {
            className: "pp-veil pp-coursemode",
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) close();
            },
          },
          h(
            "div",
            {
              className: "pp-modal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Course mode — " + props.title,
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead pp-coursehead" },
              h("div", { className: "pp-modaltitle" }, props.title + " · course mode"),
              COURSE_MODES.map((entry) => segment(entry, view === null && mode === entry.id, () => chooseMode(entry.id), false)),
              h("span", { className: "pp-segsep", "aria-hidden": "true" }),
              COURSE_VIEWS.map((entry) => segment(entry, view === entry.id, () => setView(entry.id), preview)),
              h("span", { className: "pp-segspacer" }),
              DRAFT_MODES.map((entry) =>
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    "aria-pressed": props.drafts === entry.drafts,
                    title: entry.hint,
                    onClick: () => props.setDrafts(entry.drafts),
                    key: entry.label,
                  },
                  entry.label,
                ),
              ),
              // Not on Teaching, Evidence or a course-wide view: a student is
              // never shown class figures or names, so there is nothing to preview.
              private_
                ? null
                : h(
                    "label",
                    { title: "The record alone, with no hole drawn — what ainar page publishes" },
                    h("input", {
                      type: "checkbox",
                      checked: student,
                      onChange: (event) => setStudent(event.target.checked),
                    }),
                    "Preview as student",
                  ),
              // The pane's header, which this veil covers. Publish and Upload
              // open their own windows on top, so course mode is still here when
              // they close. The wiring line opens Integrations in place, where
              // Canvas stands, what is waiting, and the setup are all answered.
              canvasLine || waiting
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-wiring pp-wiring-" + (canvasLine ? canvasLine.state : "ready") + (waiting ? " pp-wiring-waiting" : ""),
                      title: preview ? "Private — not shown while previewing as a student" : "Open Integrations",
                      disabled: preview,
                      onClick: () => {
                        setIntegrationsSub("course");
                        setView("integrations");
                      },
                    },
                    [
                      canvasLine ? "Canvas: " + (CONNECTION_STATE[canvasLine.state] || canvasLine.state) : null,
                      waiting ? waiting + " waiting" : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  )
                : null,
              h(
                "button",
                { type: "button", className: "pp-publishbtn", title: "Publish the course page, an announcement, a repository or a Canvas brief", onClick: props.onPublish },
                "Publish",
              ),
              h(
                "button",
                { type: "button", className: "pp-publishbtn", title: "Scanned papers, an exam paper and its key, or recorded defences", onClick: props.onUpload },
                "Upload",
              ),
              h(
                "select",
                {
                  className: "pp-runs pp-jump",
                  value: "",
                  "aria-label": "Open a tab in the pane",
                  title: "Close course mode and open this tab in the pane",
                  onChange: (event) => {
                    if (event.target.value) props.onJump(event.target.value);
                  },
                },
                h("option", { value: "" }, "Open in pane…"),
                props.tabs.map((entry) => h("option", { value: entry.id, key: entry.id, title: entry.hint }, entry.label)),
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-close",
                  "aria-label": "Close course mode",
                  title: "Back to the conversation (Esc)",
                  onClick: close,
                },
                "×",
              ),
            ),
            h(
              "div",
              { className: "pp-coursebody" },
              h(WidgetFrame, {
                key: props.reload,
                view: "course",
                runId: props.runId,
                sessionId: props.sessionId,
                dark: props.dark,
                drafts: props.drafts,
                student: preview,
                mode: mode,
                week: mode === "teaching" ? week : null,
                title: "Course mode",
              }),
              // The weeks stay mounted under a course-wide view, so coming back
              // to them keeps the place and the scroll.
              view
                ? h(
                    "section",
                    { className: "pp-cview", "aria-label": (COURSE_VIEWS.find((entry) => entry.id === view) || { label: "Integrations" }).label },
                    view === "tasks" || view === "integrations" || named
                      ? h(
                          "div",
                          { className: "pp-cviewbar" },
                          view === "tasks" ? SUBVIEWS.tasks.map((entry) => segment(entry, taskSub === entry.id, () => setTaskSub(entry.id), false)) : null,
                          // Integrations' own row; its Syncs entry goes back to the Syncs view.
                          view === "integrations"
                            ? SUBVIEWS.integrations.map((entry) =>
                                segment(
                                  entry,
                                  integrationsSub === entry.id,
                                  () => setIntegrationsSub(entry.id),
                                  false,
                                ),
                              )
                            : null,
                          h("span", { className: "pp-segspacer" }),
                          // The pane's own choice, the same state, so the two never differ.
                          named
                            ? IDENTITY_MODES.map((entry) =>
                                h(
                                  "button",
                                  {
                                    type: "button",
                                    className: "pp-segbtn" + (entry.names && props.names ? " pp-segbtn-warn" : ""),
                                    "aria-pressed": props.names === entry.names,
                                    title: entry.hint,
                                    onClick: () => props.setNames(entry.names),
                                    key: entry.label,
                                  },
                                  entry.label,
                                ),
                              )
                            : null,
                        )
                      : null,
                    h("div", { className: "pp-cviewbody" }, viewBody()),
                  )
                : null,
            ),
          ),
        ),
        document.body,
      );
    }

    function MaterialModal(props) {
      const close = props.onClose;
      // An exam with versions arrives as a list; everything else as one
      // document, which is a list of one and draws exactly as it always did.
      const papers =
        Array.isArray(props.papers) && props.papers.length > 1
          ? props.papers
          : [{ label: props.label, url: props.url, format: props.format }];
      const [index, setIndex] = React.useState(0);
      const [together, setTogether] = React.useState(false);
      const current = papers[Math.min(index, papers.length - 1)];
      const several = papers.length > 1;
      const frame = (paper, key) =>
        h("iframe", {
          key: key,
          className: "pp-modalframe",
          src: paper.url,
          // Undefined omits the attribute, which is the whole point for a
          // PDF; see the table above.
          sandbox: MEDIA.has(paper.format) ? undefined : "allow-same-origin",
          title: several ? props.label + " — " + paper.label : props.label,
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
            },
          },
          h(
            "div",
            {
              className: "pp-modal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": props.label,
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h("div", { className: "pp-modaltitle" }, props.label),
              several
                ? h(
                    "div",
                    { className: "pp-modaltabs", role: "group", "aria-label": "Versions" },
                    papers.map((paper, at) =>
                      h(
                        "button",
                        {
                          key: paper.url,
                          type: "button",
                          className: "pp-modaltab",
                          "aria-pressed": !together && at === index ? "true" : "false",
                          onClick: () => {
                            setIndex(at);
                            setTogether(false);
                          },
                        },
                        paper.label,
                      ),
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pp-modaltab",
                        "aria-pressed": together ? "true" : "false",
                        title: "Every version at once",
                        onClick: () => setTogether(!together),
                      },
                      "Side by side",
                    ),
                  )
                : null,
              // Name this in the composer, and let the professor type the
              // question. The alternative — a button that SENDS something —
              // would be the pane writing their sentence for them, and every
              // question worth asking about a brief is one it cannot guess.
              //
              // Rendered only when the composition actually provides the
              // draft-writing seam and this material has an identifier worth
              // carrying. A control that does nothing is worse than no control.
              props.mention && mentionOf(current.url, props.label)
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-modallink pp-chat",
                      title: "Put this in the message box, then type your question",
                      onClick: () => {
                        if (props.mention(mentionOf(current.url, props.label))) close();
                      },
                    },
                    "Ask about this ↩",
                  )
                : null,
              h(
                "a",
                {
                  className: "pp-modallink",
                  href: current.url,
                  target: "_blank",
                  rel: "noopener",
                },
                "Open in a tab ↗",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-close",
                  "aria-label": "Close " + props.label,
                  onClick: close,
                },
                "×",
              ),
            ),
            together
              ? h(
                  "div",
                  { className: "pp-modalbody" },
                  papers.map((paper) =>
                    h(
                      "div",
                      { key: paper.url, className: "pp-modalpane" },
                      h("div", { className: "pp-modalpanelabel" }, paper.label),
                      frame(paper),
                    ),
                  ),
                )
              : frame(current, current.url),
          ),
        ),
        document.body,
      );
    }

    // ── client/publish.js

    /**
     * The four places a course reaches an audience, and one dialog for them.
     *
     * It began as the homework publish alone, over the whole page rather than
     * beside the list, and that shape was right for a reason that turns out to
     * be general: approval is a sentence and a button, while publishing is a
     * file list, a repository name, an announcement somebody types, a plan that
     * runs to twenty lines, and a decision that reaches people outside this
     * machine. In a pane four hundred pixels wide that was a sliver nobody
     * could read — which is exactly how it was reported: the button "doesn't do
     * anything".
     *
     * It borrows `MaterialModal`'s shell: the same veil, the same Escape, the
     * same rule that a drag started inside the dialog does not dismiss it. What
     * it does NOT borrow is the frame — the content here is this pane's own
     * text, so it is rendered rather than loaded, and no sandbox question
     * arises.
     *
     * **Two presses, per target, always.** The first reads and prints; the
     * second is the only one that writes anything, and it does not exist until
     * the first has come back. Changing the target, the assessment or the
     * message throws the plan away, so the red button can never send something
     * other than what was read — the rule `Send to Canvas` already holds.
     *
     * **Publishing approves nothing.** A record marked `approval: draft` is
     * left out, and the plan names it — *Not published — 1 draft(s)* — so a
     * deck the professor expected and did not see is one line from the reason.
     */
    const PUBLISH_TARGETS = [
      {
        id: "page",
        label: "Course page",
        hint: "The week plan students read, with the approved materials beside it, written to dist/pages/",
      },
      {
        id: "telegram",
        label: "Telegram",
        hint: "One plain-text announcement to the run's channel. It cannot be recalled",
      },
      {
        id: "homework",
        label: "Homework repo",
        hint: "The starter repository on GitHub, for one assessment",
      },
      {
        id: "canvas",
        label: "Canvas brief",
        hint: "One assessment's definition — title, points, dates, the brief. Never the marks",
      },
      {
        id: "update",
        label: "Update everywhere",
        hint:
          "Every destination this run has already been published to, and no new ones. " +
          "An announcement is not among them: it cannot be re-derived, only corrected",
      },
    ];

    /**
     * What the second press says it will do, per target.
     *
     * Named after the thing that happens rather than the button that happens
     * it. "Publish" twice in a row tells a professor nothing about whether the
     * next click writes a folder or posts to a channel of a hundred students.
     */
    const CONFIRM_LABEL = {
      page: "Write the page",
      telegram: "Send to the channel",
      homework: "Publish to GitHub",
      canvas: "Send to Canvas",
      update: "Update every destination",
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
            },
          },
          h(
            "div",
            {
              className: "pp-modal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Publish " + state.label,
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h(
                "div",
                { className: "pp-modaltitle" },
                state.label ? "Publish " + state.label : "Publish",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-close",
                  "aria-label": "Close",
                  onClick: close,
                },
                "×",
              ),
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
                PUBLISH_TARGETS.map((entry) =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      "aria-pressed": state.target === entry.id,
                      title: entry.hint,
                      disabled: busy,
                      onClick: () => props.setTarget(entry.id),
                      key: entry.id,
                    },
                    entry.label,
                  ),
                ),
              ),
              needsAssessment
                ? h("input", {
                    type: "text",
                    className: "pp-input",
                    placeholder: "ASSESSMENT-04",
                    value: state.assessment,
                    disabled: busy,
                    "aria-label": "Assessment id",
                    onChange: (event) => props.setField("assessment", event.target.value),
                  })
                : null,
              state.target === "telegram"
                ? h(
                    React.Fragment,
                    null,
                    h("textarea", {
                      className: "pp-publishtext",
                      placeholder:
                        "Homework 3 is open. It is due Friday at 18:00 and counts for 10%.",
                      value: state.message,
                      disabled: busy,
                      "aria-label": "The announcement, exactly as students will read it",
                      onChange: (event) => props.setField("message", event.target.value),
                    }),
                    h(
                      "p",
                      { className: "pp-publishcount" },
                      state.message.length +
                        " / 4096 characters. This is sent as typed — the command composes nothing.",
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
                        onChange: (event) => props.setField("edit", event.target.checked),
                      }),
                      " correct the last announcement instead of posting a new one",
                    ),
                  )
                : null,
              h(
                "div",
                { className: "pp-approverow" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: busy,
                    title:
                      "Show what would be published, and which drafts would be left out. " +
                      "Writes nothing, here or anywhere else.",
                    onClick: () => props.run(false),
                  },
                  busy ? "Working…" : "Check what would be published",
                ),
                state.phase === "preview"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn pp-danger",
                        title:
                          "Publish what has been accepted. Records still marked approval: draft " +
                          "are left out.",
                        onClick: () => props.run(true),
                      },
                      state.target === "telegram" && state.edit
                    ? "Correct the message in the channel"
                    : CONFIRM_LABEL[state.target],
                    )
                  : null,
                state.target === "homework"
                  ? h("input", {
                      type: "text",
                      className: "pp-input",
                      placeholder: "owner/name, if not recorded",
                      value: state.repo,
                      disabled: busy,
                      "aria-label": "Repository",
                      onChange: (event) => props.setField("repo", event.target.value),
                    })
                  : null,
                state.target === "canvas"
                  ? h("input", {
                      type: "text",
                      className: "pp-input",
                      placeholder: "every subgroup",
                      value: state.group,
                      disabled: busy,
                      "aria-label": "Subgroup",
                      onChange: (event) => props.setField("group", event.target.value),
                    })
                  : null,
              ),
              state.phase === "idle"
                ? h(
                    "p",
                    { className: "pp-publishhint" },
                    "Nothing has been read or written yet. Check first; publishing is the " +
                      "second press. Anything still marked approval: draft is left out.",
                  )
                : h(
                    "pre",
                    {
                      className:
                        "pp-publishout" + (state.phase === "error" ? " pp-approveerr" : ""),
                    },
                    state.text,
                  ),
            ),
          ),
        ),
        document.body,
      );
    }

    // ── client/marks.js

    // ---------------------------------------------------------------- scans

    /**
     * What the assistant is asked for at the steps that need its judgement.
     * A skill and a target, nothing more: DSH loads the whole skill for any
     * `/name` in a message, and the skill finds where the pile stands itself,
     * so a procedure restated here would only be a second copy to drift. Read
     * is not here — it is a command, run by the pane's own button.
     * Pseudonyms and ids only.
     */
    const STEP_PROMPTS = {
      rubric: (runId, id) => "/import-assessment " + id + " " + runId + " — propose the rubric",
      grade: (runId, id) => "/grade-batch " + id + " " + runId,
      approve: (runId, id) =>
        "Which suggested grades on " + id + " (" + runId + ") are still waiting for my decision, " +
        "least confident first?",
    };

    /**
     * Every name correspondence in the pile, as big cards over the conversation.
     *
     * Two sections. **Matched** is every paper the roster placed by its name and
     * nobody has confirmed — a close spelling first, since that is where a wrong
     * match would be. They start as yes, because the matcher already decided;
     * pressing a card turns it to "not them". **Suggested** is every held paper
     * with a nearest student; those start as no, because the matcher refused
     * them, and pressing one turns it to yes. One press of Confirm sends the
     * lot: a yes pins the student, a "not them" takes the placement back and
     * holds the paper for the professor to name in the tab.
     */
    function MatchReview(props) {
      const matched = props.papers.filter(
        (paper) => paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed"),
      );
      matched.sort((a, b) => (a.lane === "check" ? 0 : 1) - (b.lane === "check" ? 0 : 1));
      const suggested = props.papers.filter((paper) => paper.lane === "held" && paper.candidates.length);
      const keyOf = (paper) => paper.file + "|" + paper.pages;
      // key → true (yes) or false (not them / leave). Absent means the default.
      const [choice, setChoice] = React.useState({});
      const isYes = (paper, fallback) => (keyOf(paper) in choice ? choice[keyOf(paper)] : fallback);
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
      const setAll = (list, value) =>
        setChoice((current) => {
          const next = Object.assign({}, current);
          list.forEach((paper) => {
            next[keyOf(paper)] = value;
          });
          return next;
        });

      const submit = () => {
        const papers = []
          .concat(yesMatched.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.resolved })))
          .concat(notMatched.map((paper) => ({ pages: paper.pages, file: paper.file, reject: paper.resolved })))
          .concat(yesSuggested.map((paper) => ({ pages: paper.pages, file: paper.file, student: paper.candidates[0].student })));
        if (papers.length) props.onSubmit(papers);
      };

      const rcard = (paper, student, name, yes, kind) =>
        h(
          "button",
          {
            type: "button",
            key: keyOf(paper),
            className: "pp-rcard" + (yes ? "" : kind === "matched" ? " pp-rcard-no" : " pp-rcard-off"),
            "aria-pressed": yes,
            disabled: busy,
            title: yes
              ? kind === "matched" ? "Press if this is not them" : "Press to leave it held"
              : kind === "matched" ? "Press to keep the match" : "Press if this is them",
            onClick: () => setChoice((current) => Object.assign({}, current, { [keyOf(paper)]: !yes })),
          },
          props.crops ? h("img", { src: props.cropUrl(paper), alt: "Name line, page " + paper.pages.split("-")[0], loading: "lazy" }) : null,
          h("div", { className: "pp-rwritten" }, paper.written ? "“" + paper.written + "”" : "pages " + paper.pages),
          h("div", { className: "pp-rname" }, name || student),
          h("div", { className: "pp-rid" }, student + " · pp. " + paper.pages),
          h(
            "div",
            { className: "pp-rbadges" },
            kind === "suggested"
              ? h("span", { className: "pp-rbadge pp-rbadge-close" }, "suggested · not placed")
              : paper.lane === "check"
                ? h("span", { className: "pp-rbadge pp-rbadge-close" }, paper.match === "partial" ? "one word" : "close spelling")
                : h("span", { className: "pp-rbadge" }, paper.match === "words" ? "same words" : "exact"),
            h(
              "span",
              { className: "pp-rbadge " + (yes ? "pp-rbadge-yes" : kind === "matched" ? "pp-rbadge-no" : "") },
              yes ? "✓ them" : kind === "matched" ? "✗ not them" : "leave held",
            ),
          ),
        );

      const label =
        "Confirm " + (yesMatched.length + yesSuggested.length) +
        (notMatched.length ? " · reject " + notMatched.length : "");

      return ReactDOM.createPortal(
        h(
          "div",
          {
            className: "pp-veil",
            onMouseDown: (event) => {
              if (event.target === event.currentTarget && !busy) close();
            },
          },
          h(
            "div",
            { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Review name matches" },
            h(
              "div",
              { className: "pp-modalhead" },
              h("div", { className: "pp-modaltitle" }, "Who wrote each paper · " + props.title),
              h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×"),
            ),
            h(
              "div",
              { className: "pp-review" },
              matched.length
                ? h(
                    "div",
                    { className: "pp-reviewsec" },
                    "Matched by name",
                    h("span", null, matched.length + " — every one is them unless you press it"),
                    h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(matched, true) }, "All them"),
                  )
                : null,
              h("div", { className: "pp-reviewgrid" }, matched.map((paper) => rcard(paper, paper.resolved, paper.resolved_name, isYes(paper, true), "matched"))),
              suggested.length
                ? h(
                    "div",
                    { className: "pp-reviewsec" },
                    "Suggested",
                    h("span", null, suggested.length + " held — the nearest student, placed only if you press it"),
                    h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, true) }, "All them"),
                    h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => setAll(suggested, false) }, "None"),
                  )
                : null,
              h(
                "div",
                { className: "pp-reviewgrid" },
                suggested.map((paper) =>
                  rcard(paper, paper.candidates[0].student, paper.candidates[0].name, isYes(paper, false), "suggested"),
                ),
              ),
              !matched.length && !suggested.length ? h(Message, null, "Nothing to review: every paper is confirmed or set aside.") : null,
            ),
            h(
              "div",
              { className: "pp-reviewfoot" },
              h(
                "span",
                { className: "pp-as" },
                busy
                  ? "Placing — every answer at once, then one apply…"
                  : "A rejected paper is taken back and held for you to name in the tab. Nothing here is graded.",
              ),
              h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: close }, "Cancel"),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-primary",
                  disabled: busy || yesMatched.length + notMatched.length + yesSuggested.length === 0,
                  onClick: submit,
                },
                busy ? "Placing…" : label,
              ),
            ),
          ),
        ),
        document.body,
      );
    }

    /** What happens to one student's mark, in the preview's words, and its chip. */
    const PLAN_ACTIONS = {
      new: { words: "will be sent", chip: "pp-chip-warn", order: 0 },
      change: { words: "will be updated", chip: "pp-chip-warn", order: 1 },
      drift: { words: "edited in Canvas — left alone", chip: "pp-chip-live", order: 2 },
      unmatched: { words: "not found in Canvas", chip: "pp-chip-live", order: 3 },
      skip: { words: "not sent", chip: "", order: 4 },
      unchanged: { words: "already in Canvas", chip: "pp-chip-ok", order: 5 },
    };

    const planScore = (value) => (value === null || value === undefined ? "—" : String(Math.round(value * 100) / 100));

    /**
     * One Canvas course's preview, student by student: the mark here, what Canvas
     * holds now, and what a send would do — those it would send first.
     */
    function PlanTable(props) {
      const rows = props.entry.rows
        .slice()
        .sort(
          (a, b) =>
            (PLAN_ACTIONS[a.action] || PLAN_ACTIONS.skip).order - (PLAN_ACTIONS[b.action] || PLAN_ACTIONS.skip).order ||
            String(a.name || a.student_id).localeCompare(String(b.name || b.student_id)),
        );
      const counts = props.entry.counts || {};
      const sending = (counts.new || 0) + (counts.change || 0);
      const skipWhy = [...new Set(rows.filter((row) => row.action === "skip" && row.reason).map((row) => row.reason))];
      const summary = [
        sending ? sending + " will be sent" : "nothing to send",
        counts.unchanged ? counts.unchanged + " already in Canvas" : null,
        counts.drift ? counts.drift + " edited in Canvas" : null,
        counts.unmatched ? counts.unmatched + " not found in Canvas" : null,
        counts.skip ? counts.skip + " not sent" + (skipWhy.length === 1 ? " (" + skipWhy[0] + ")" : "") : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return h(
        "div",
        { className: "pp-plan" },
        h("p", { className: "pp-plansum" }, summary),
        // What the CLI says about the course — host, assignment, scale — is worth
        // having but not worth reading before the names; folded.
        props.entry.notes && props.entry.notes.length
          ? h(
              "details",
              { className: "pp-plannotes" },
              h("summary", null, "About this Canvas course"),
              props.entry.notes.map((note, i) => h("p", { className: "pp-as", key: "n" + i }, note)),
            )
          : null,
        h(
          "table",
          { className: "pp-plantable" },
          h(
            "thead",
            null,
            h("tr", null, h("th", null, "Student"), h("th", { className: "pp-num" }, "Mark"), h("th", { className: "pp-num" }, "Canvas now"), h("th", null, "")),
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
                  h("span", { className: "pp-chip " + said.chip, title: row.reason || "" }, row.action === "skip" && row.reason ? row.reason : said.words),
                ),
              );
            }),
          ),
        ),
      );
    }

    /**
     * What a send did, course by course, read from the CLI's own lines: posted
     * and landed, already there and now recorded, still processing in Canvas, or
     * failed — with the CLI's words a press away.
     */
    const sendOutcome = (entry) => {
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
          words:
            "Sent " + posted[1] + " marks" + already +
            (manual ? " — this assignment posts manually: post them in Canvas for students to see" : " — students can see them"),
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
        fail: "Not everything was sent",
      }[worst];
      return h(
        "div",
        { className: "pp-sendresult pp-sendresult-" + worst, role: "status" },
        h(
          "div",
          { className: "pp-sendresulthead" },
          h("span", { className: "pp-sendresulticon", "aria-hidden": "true" }, { ok: "✓", wait: "…", fail: "!" }[worst]),
          h("b", null, headline),
        ),
        h(
          "ul",
          null,
          outcomes.map((o) =>
            h(
              "li",
              { key: o.entry.group || "run", className: "pp-sendresult-" + o.said.kind },
              h("span", { className: "pp-sendcourse" }, props.name(o.entry)),
              h("span", null, o.said.words),
            ),
          ),
        ),
        h(
          "details",
          { className: "pp-plannotes" },
          h("summary", null, "What the CLI said"),
          outcomes.map((o) => h("pre", { className: "pp-approveout", key: "o" + (o.entry.group || "run") }, o.entry.output)),
        ),
      );
    }

    /**
     * Where a Canvas send stands, as three steps: check what Canvas has, send,
     * done. Each step is done, the one in progress, or still ahead; a step that
     * failed says so in red.
     */
    function SendSteps(props) {
      // `partial`: everything that can go is in Canvas, but some marks have
      // nowhere to go — amber, and saying how many, never a green tick.
      const labels = ["Check Canvas", "Send", props.failed ? "Not sent" : props.partial || "In Canvas"];
      return h(
        "ol",
        { className: "pp-sendsteps", "aria-label": "Canvas send progress" },
        labels.map((label, i) => {
          const state =
            i < props.at
              ? "done"
              : i === props.at
                ? props.failed && i === 2
                  ? "fail"
                  : props.partial && i === 2
                    ? "warn"
                    : props.busy
                      ? "busy"
                      : "now"
                : "todo";
          return h(
            "li",
            { key: "s" + i, className: "pp-sendstep pp-sendstep-" + state, "aria-current": i === props.at ? "step" : undefined },
            h("span", { className: "pp-sendstepdot", "aria-hidden": "true" }, state === "done" ? "✓" : state === "fail" || state === "warn" ? "!" : String(i + 1)),
            h("span", null, label),
          );
        }),
      );
    }

    /**
     * The marks of one assessment, sent to Canvas from beside the pile.
     *
     * Two presses, as everywhere a class can feel the result: **Preview** asks
     * Canvas what it holds for each subgroup's course and changes nothing;
     * only then does the red **Send N marks** exist, and any other press
     * throws the preview away. A subgroup whose course has no assignment for
     * this assessment yet is answered first — link the one already in Canvas,
     * or create it from the course record — because the planner cannot tell a
     * hand-made "Quiz 1" from no Quiz 1 and would otherwise make a second.
     */
    function CanvasMarks(props) {
      const [plan, setPlan] = React.useState(null);
      const [phase, setPhase] = React.useState("idle");
      const [failed, setFailed] = React.useState(null);
      const [lists, setLists] = React.useState({});
      const [picks, setPicks] = React.useState({});
      const [creating, setCreating] = React.useState({});

      const endpoint = (path) => scoped(BASE + path + "?run=" + encodeURIComponent(props.runId || ""), props.sessionId);
      const postJson = (path, body) =>
        fetch(endpoint(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((response) =>
          response.json(),
        );

      const marks = (extra, label) => {
        setPhase(label);
        setFailed(null);
        postJson("/api/canvas/marks", Object.assign({ assessment: props.assessmentId, names: Boolean(props.names) }, extra || {}))
          .then((body) => {
            setPhase("idle");
            if (body.error) return setFailed(body.error);
            setPlan(body);
            setCreating({});
            if (body.confirmed) props.onSent();
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
          });
      };

      // A send goes course by course, so the press can show each one landing.
      const [progress, setProgress] = React.useState(null);
      const send = async () => {
        const targets = ((plan && plan.groups) || []).filter((entry) => entry.ok && !entry.unlinked);
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
              group: entry.group || "",
            });
            if (body.error) results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: body.error });
            else results.push(...(body.groups || []));
          } catch (error) {
            results.push({ group: entry.group, courseId: entry.courseId, ok: false, output: String((error && error.message) || error) });
          }
        }
        setProgress({ done: targets.length, total: targets.length, now: null });
        setPhase("idle");
        setPlan({ confirmed: true, groups: results });
        setCreating({});
        props.onSent();
      };

      // Opened from a Send… press: the preview only reads Canvas, so it runs at
      // once and the first thing on screen is what would be sent.
      React.useEffect(() => {
        if (props.autoPreview && props.canvas && props.canvas.ready > 0) marks({}, "planning");
      }, []);

      const listFor = (entry) => {
        postJson("/api/canvas/assignments", { courseId: entry.courseId })
          .then((body) => setLists((all) => Object.assign({}, all, { [entry.group]: body.error ? { error: body.error } : body.assignments || [] })))
          .catch((error) => setLists((all) => Object.assign({}, all, { [entry.group]: { error: String(error) } })));
      };

      const create = (entry, confirm) => {
        setPhase("creating");
        setFailed(null);
        postJson("/api/canvas/assignment", { assessment: props.assessmentId, group: entry.group || "", confirm })
          .then((body) => {
            setPhase("idle");
            if (body.error) return setFailed(body.error);
            if (confirm && body.ok) return marks({}, "planning");
            setCreating((all) => Object.assign({}, all, { [entry.group]: body }));
          })
          .catch((error) => {
            setPhase("idle");
            setFailed(String((error && error.message) || error));
          });
      };

      const groups = (plan && plan.groups) || [];
      const unlinked = groups.filter((entry) => entry.unlinked);
      const title = props.title || props.assessmentId;

      /**
       * The mapping, handed to the assistant as a turn in the open session.
       * It may read Canvas and propose; it may link only what the professor
       * confirms in the chat, and it may not send a mark — those stay this
       * component's red button.
       */
      const askToLink = () => {
        const run = props.runId;
        const a = props.assessmentId;
        const where = unlinked.map((entry) => (entry.group ? entry.group + " (Canvas course " + entry.courseId + ")" : "the run's Canvas course")).join(", ");
        props.ask(
          "Link " + a + " (" + title + ") to its Canvas assignment in each course that has none yet: " + where + ".\n\n" +
            "1. Run `bin/ainar lms assignments " + run + " --assessment " + a + "`. It only reads Canvas. Show me, per course, the assignment you think is " + title + " and why — or say that nothing there looks like it.\n" +
            "2. Ask me to confirm each pairing, one line per course. Link nothing I have not confirmed.\n" +
            "3. For each one I confirm, run `bin/ainar lms link " + run + " --assessment " + a + " --group <GROUP> --canvas-assignment <ID>`. It changes nothing in Canvas; it records the id in the course.\n" +
            "4. Where no assignment exists, say so and offer to create it: `bin/ainar lms assignment-plan " + run + " --assessment " + a + " --group <GROUP>` shows what would be created; run `bin/ainar lms assignment-push … --confirm` only when I say yes.\n\n" +
            "Do not send any marks — I send those from the pane once every course is linked.",
        );
      };
      const previewed = plan && !plan.confirmed && groups.length > 0 && !unlinked.length && groups.every((entry) => entry.ok);
      // What the preview says a send would do — not the pane's own count, which
      // is only as current as the ledger.
      const planned = groups.reduce((n, entry) => n + ((entry.counts || {}).new || 0) + ((entry.counts || {}).change || 0), 0);
      // Already in Canvas at our value but never recorded here: a send whose
      // Canvas job finished after the CLI stopped waiting.
      const unrecorded = groups.reduce(
        (n, entry) => n + (entry.rows || []).filter((row) => row.action === "unchanged" && row.last_prepared === null).length,
        0,
      );
      // One send covers both: marks Canvas lacks are posted, and marks Canvas
      // already holds but this machine never noted are confirmed.
      const sendCount = planned + unrecorded;
      const sendable = previewed && sendCount > 0;
      const name = (entry) => entry.group || "the run's Canvas course";
      const busy = phase !== "idle";
      const c = props.canvas || { ready: 0, unsent: 0, changed: 0 };
      const toSend = c.unsent + c.changed;
      const inCanvas = groups.reduce((n, entry) => n + ((entry.counts || {}).unchanged || 0), 0);
      // `lead`: this is the Scans headline's one action. The headline already
      // says how many marks wait, so the count is not repeated.
      const lead = Boolean(props.lead);

      // Where the send stands: 0 checking, 1 ready to send / sending, 3 done.
      const confirmed = Boolean(plan && plan.confirmed);
      const sentFailed = confirmed && groups.some((entry) => !entry.ok);
      // Marks whose student is not in the Canvas course: no send places them.
      const unplaced = groups.reduce((n, entry) => n + ((entry.counts || {}).unmatched || 0), 0);
      const students = (n) => (n === 1 ? "1 student isn't" : n + " students aren't");
      const unplacedWords = unplaced
        ? " " + students(unplaced) + " in the Canvas course, so " + (unplaced === 1 ? "that mark has" : "those marks have") +
          " nowhere to go — add them in Canvas, then check again."
        : "";
      // Done is a green tick only when every mark is placed; otherwise amber,
      // saying how many are in.
      const finished = (previewed && !sendCount) || (confirmed && !sentFailed);
      const partial = finished && unplaced ? inCanvas + " of " + (inCanvas + unplaced) + " in Canvas" : null;
      const at =
        phase === "planning" || !plan ? 0 : phase === "sending" ? 1 : confirmed && sentFailed ? 2 : finished ? (partial ? 2 : 3) : 1;

      // What the preview found, in one sentence — the preview's truth over the
      // pane's own count, which is only as current as this machine's record.
      const headline =
        c.ready === 0
          ? "No whole marks to send yet."
          : phase === "planning"
            ? "Checking what Canvas has for these " + c.ready + " marks…"
            : phase === "sending"
              ? "Sending to Canvas — keep this open until it finishes."
              : confirmed
                ? null
                : previewed
                  ? planned
                    ? planned + " of " + c.ready + " marks are not in Canvas yet" + (inCanvas ? "; " + inCanvas + " already are." : ".") + unplacedWords
                    : unrecorded
                      ? "Canvas already has these " + unrecorded + " marks — sending confirms them here; students see no change." + unplacedWords
                      : unplaced
                        ? "Canvas has " + inCanvas + " of " + (inCanvas + unplaced) + " marks." + unplacedWords
                        : "Canvas has every mark (" + inCanvas + ")."
                  : toSend === 0
                    ? "Canvas has every mark (" + c.ready + ")."
                    : toSend + " of " + c.ready + " marks are not in Canvas.";

      // The forward press: its label and look follow the step it would take.
      const pct = progress && progress.total ? Math.round((100 * progress.done) / progress.total) : 0;
      const forward =
        c.ready === 0 || confirmed
          ? null
          : phase === "planning"
            ? h("button", { type: "button", className: "pp-primary", disabled: true, "aria-busy": "true" }, "Checking Canvas…")
            : phase === "sending"
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-primary pp-danger pp-btn-progress",
                    disabled: true,
                    "aria-busy": "true",
                    style: { "--pp-progress": pct + "%" },
                  },
                  "Sending… " + (progress && progress.total > 1 ? "course " + Math.min(progress.done + 1, progress.total) + " of " + progress.total : ""),
                )
              : sendable
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-primary pp-danger",
                      disabled: busy,
                      title: "Students see a posted grade within seconds",
                      onClick: send,
                    },
                    "Send " + sendCount + " marks to Canvas",
                  )
                : !plan
                  ? h("button", { type: "button", className: "pp-primary", disabled: busy, onClick: () => marks({}, "planning") }, "Check Canvas")
                  : null;

      return h(
        "div",
        { className: lead ? "pp-sendflow" : "pp-next pp-sendflow" },
        c.ready > 0 ? h(SendSteps, { at: at, busy: busy, failed: sentFailed, partial: partial }) : null,
        headline && !(lead && !plan && phase === "idle") ? h("p", { className: "pp-sendheadline" }, headline) : null,
        h(
          "div",
          { className: "pp-approverow" },
          forward,
          plan && !busy
            ? h("button", { type: "button", className: "pp-segbtn", onClick: () => marks({}, "planning") }, confirmed ? "Check Canvas again" : "Check again")
            : null,
        ),
        confirmed && phase !== "sending" ? h(SendResult, { groups: groups, name: name }) : null,
        failed ? h("pre", { className: "pp-approveout pp-approveerr" }, failed) : null,
        unlinked.length && props.ask
          ? h(
              "div",
              { className: "pp-linkask" },
              h(
                "p",
                null,
                unlinked.length === groups.length
                  ? "None of the Canvas courses has " + title + " linked, so there is nowhere to put these marks yet."
                  : unlinked.map((entry) => entry.group).join(", ") + " " + (unlinked.length === 1 ? "has" : "have") + " no " + title + " linked yet.",
              ),
              h(
                "p",
                { className: "pp-as" },
                "The assistant will read each course's assignment list in Canvas (nothing changes there), say which one it thinks is " +
                  title +
                  " and why, and ask you. Only the pairings you confirm are recorded — in the course record, not in Canvas. " +
                  "Where none exists it offers to create it, again only on your yes. It does not send marks.",
              ),
              h(
                "button",
                { type: "button", className: "pp-primary pp-chat", disabled: busy, onClick: askToLink },
                "Ask the assistant to link " + title,
              ),
            )
          : null,
        // The preview, course by course. After a send the result above says it
        // all, so the courses' own sections go.
        (confirmed ? [] : groups).map((entry) =>
          h(
            "div",
            { key: entry.group || "run" },
            h("p", { className: "pp-factgroup" }, name(entry) + (entry.courseId ? " · course " + entry.courseId : "")),
            entry.unlinked
              ? h(
                  "div",
                  { className: "pp-approverow" },
                  h("span", null, "Or by hand:"),
                  lists[entry.group] === undefined
                    ? h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => listFor(entry) }, "Link one already in Canvas…")
                    : lists[entry.group].error
                      ? h("span", { className: "pp-as" }, lists[entry.group].error)
                      : h(
                          React.Fragment,
                          null,
                          h(
                            "select",
                            {
                              className: "pp-bindsel",
                              value: picks[entry.group] || "",
                              onChange: (event) => setPicks((all) => Object.assign({}, all, { [entry.group]: event.target.value })),
                            },
                            h("option", { value: "" }, "Choose the assignment…"),
                            lists[entry.group].map((assignment) =>
                              h(
                                "option",
                                { value: assignment.id, key: assignment.id },
                                assignment.name + (assignment.points != null ? " (" + assignment.points + " pts)" : ""),
                              ),
                            ),
                          ),
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pp-segbtn",
                              disabled: busy || !picks[entry.group],
                              onClick: () => marks({ link: { group: entry.group || "", assignmentId: picks[entry.group] } }, "planning"),
                            },
                            "Link",
                          ),
                        ),
                  creating[entry.group]
                    ? h(
                        "button",
                        { type: "button", className: "pp-segbtn pp-danger", disabled: busy, onClick: () => create(entry, true) },
                        phase === "creating" ? "Creating…" : "Create it in " + name(entry),
                      )
                    : h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => create(entry, false) }, "Preview creating it"),
                )
              : null,
            entry.rows && !(creating[entry.group] || {}).output ? h(PlanTable, { entry: entry }) : null,
            // An unlinked course's own message is the CLI explaining its data
            // model; the sentence above says the same in the professor's terms.
            (creating[entry.group] || {}).output || (!entry.unlinked && entry.output && !plan.confirmed)
              ? h("pre", { className: "pp-approveout" + (entry.ok || entry.unlinked ? "" : " pp-approveerr") }, (creating[entry.group] || {}).output || entry.output)
              : null,
          ),
        ),
      );
    }

    /** `/api/unpublished` for one run, re-read whenever the course is written. */
    function useUnpublished(runId, sessionId, revision) {
      const [state, setState] = React.useState({ phase: "loading", value: null });
      React.useEffect(() => {
        let live = true;
        fetch(scoped(BASE + "/api/unpublished?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
          headers: { accept: "application/json" },
        })
          .then((response) => response.json())
          .then((value) => live && setState({ phase: "ready", value }))
          .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
        return () => {
          live = false;
        };
      }, [runId, sessionId, revision]);
      return state;
    }

    /** How old a check of Canvas may be before opening the Gradebook asks again. */
    const CANVAS_CHECK_FRESH = 5 * 60 * 1000;

    /**
     * `/api/canvas/check` for one run: what Canvas holds, asked of Canvas. The
     * last answer comes back at once; if there is none, or it is older than five
     * minutes, a new check runs in the background. `onChecked` fires when one
     * finishes — the check notes in the ledger what Canvas already holds, so the
     * counts drawn from the ledger are re-read then.
     */
    function useCanvasCheck(runId, sessionId, onChecked) {
      const [state, setState] = React.useState({ phase: "loading", value: null });
      const live = React.useRef(true);
      const url = scoped(BASE + "/api/canvas/check?run=" + encodeURIComponent(runId || ""), sessionId);
      const run = React.useCallback(() => {
        setState((current) => Object.assign({}, current, { phase: "running" }));
        fetch(url, { method: "POST", headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((answer) => {
            if (!live.current) return;
            setState({ phase: "ready", value: answer });
            if (onChecked) onChecked();
          })
          .catch((error) => live.current && setState({ phase: "ready", value: { error: String(error) } }));
      }, [url]);
      React.useEffect(() => {
        live.current = true;
        if (!runId) return undefined;
        fetch(url, { headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((answer) => {
            if (!live.current) return;
            if (answer.state === "running") return run();
            const stale = answer.state !== "ready" || !answer.at || Date.now() - Date.parse(answer.at) > CANVAS_CHECK_FRESH;
            setState({ phase: "ready", value: answer });
            if (stale) run();
          })
          .catch(() => live.current && run());
        return () => {
          live.current = false;
        };
      }, [url]);
      return [state, run];
    }

    /** Per assessment, the marks someone changed in Canvas, from the last check. */
    const editedIn = (check) => {
      const found = new Map();
      for (const entry of (check && check.value && check.value.value && check.value.value.assessments) || []) {
        const edited = [];
        for (const cell of entry.groups || []) for (const row of cell.edited || []) edited.push(Object.assign({ group: cell.group }, row));
        found.set(entry.assessment_id, edited);
      }
      return found;
    };

    /**
     * Per assessment, marks that cannot go to Canvas because their student is not
     * in the Canvas course — not "not sent yet", which a press would fix, but
     * "nowhere to send", which only an enrolment in Canvas fixes.
     */
    const unplacedIn = (check) => {
      const found = new Map();
      for (const entry of (check && check.value && check.value.value && check.value.value.assessments) || []) {
        found.set(entry.assessment_id, (entry.groups || []).reduce((n, cell) => n + ((cell.counts || {}).unmatched || 0), 0));
      }
      return found;
    };

    /**
     * One assessment's marking and Canvas, as the few words a row has room for.
     * `unplaced` — marks whose student is not in the Canvas course, from the last
     * check — are taken out of "not in Canvas", which a send would fix, and said
     * on their own, which it would not.
     */
    const markState = (entry, unplaced = 0) => {
      const c = entry.canvas;
      const marking =
        entry.submitted === 0 && entry.graded === 0
          ? "nothing handed in"
          : entry.graded + " of " + entry.submitted + " graded" + (entry.partial ? " · " + entry.partial + " part-graded" : "");
      const stuck = Math.min(unplaced, c.unsent);
      const unsent = c.unsent - stuck;
      let canvas = null;
      if (c.ready > 0) {
        canvas =
          unsent === 0 && c.changed === 0
            ? (stuck ? c.ready - stuck + " of " + c.ready : "all " + c.ready) + " in Canvas"
            : [unsent ? unsent + " not in Canvas" : null, c.changed ? c.changed + " changed since sent" : null].filter(Boolean).join(" · ");
      }
      return {
        marking,
        canvas,
        behind: unsent > 0 || c.changed > 0,
        waiting: unsent + c.changed,
        stuck: stuck ? stuck + " not in the Canvas course" : null,
      };
    };

    const dueOrder = (a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));

    /**
     * "HW2 - A grant office…" as a short tag and the rest, when the title leads
     * with one; otherwise no tag. Only for the eye: the record keeps one title.
     */
    const titleParts = (title) => {
      const match = /^(\S{1,8}(?: \d{1,3})?)\s+[-–—:]\s+(.+)$/.exec(String(title || ""));
      return match ? { tag: match[1], rest: match[2] } : { tag: null, rest: String(title || "") };
    };

    /** A title as tag chip + text, the way the Gradebook strips and Files print it. */
    const TitleWithTag = (props) => {
      const parts = titleParts(props.title);
      return h(
        "span",
        { className: "pp-titletag", title: props.title },
        parts.tag ? h("span", { className: "pp-tag" + (/^quiz|^exam|^mid|^final/i.test(parts.tag) ? " pp-tag-quiz" : "") }, parts.tag) : null,
        h("span", { className: "pp-titletext" }, parts.rest),
      );
    };

    /**
     * Above Progress · Gradebook: per assessment, how far its marking has got
     * and how much of it Canvas has. The gradebook widget is shared with the
     * chat clients and knows nothing of Canvas, so this line is the pane's.
     * Only assessments something was handed in for — a strip of twenty rows
     * saying "nothing handed in" would bury the two that matter.
     */
    function GradebookStatus(props) {
      // Re-read after a check of Canvas: it notes in the ledger what Canvas holds.
      const [checked, setChecked] = React.useState(0);
      const state = useUnpublished(props.runId, props.sessionId, props.revision + "." + checked);
      const [check, recheck] = useCanvasCheck(props.runId, props.sessionId, () => setChecked((value) => value + 1));
      // The one assessment whose Canvas send is open under its row.
      const [open, setOpen] = React.useState(null);
      if (state.phase === "loading" || !state.value || state.value.error) return null;
      const rows = state.value.assessments.filter((entry) => entry.submitted > 0 || entry.graded > 0).sort(dueOrder);
      if (!rows.length) return null;
      const edited = editedIn(check);
      const unplaced = unplacedIn(check);
      const said = new Map(rows.map((entry) => [entry.id, markState(entry, unplaced.get(entry.id) || 0)]));
      const waiting = rows.reduce((n, entry) => n + said.get(entry.id).waiting, 0);
      const answer = check.value || {};
      const checking = check.phase === "running" || check.phase === "loading";
      const unreachable = !checking && (answer.error || (answer.state === "ready" && !answer.value));
      return h(
        "div",
        { className: "pp-bookcard pp-bookstatus" + (open ? " pp-bookstatus-open" : "") },
        h(
          "div",
          { className: "pp-cardhead" },
          h("b", null, "Marking"),
          h(
            "span",
            { className: waiting ? "pp-chip pp-chip-warn" : "pp-chip pp-chip-ok" },
            waiting ? waiting + " marks waiting for Canvas" : "Canvas has every mark",
          ),
          // Where the Canvas figures come from: a check under way, the last one,
          // or this machine's record because Canvas could not be reached.
          h(
            "span",
            { className: "pp-checkstate" + (unreachable ? " pp-checkstate-off" : ""), title: unreachable ? String(answer.error || "") : "" },
            checking
              ? h("span", { className: "pp-checkspin", "aria-hidden": "true" })
              : null,
            checking
              ? "Checking Canvas…"
              : unreachable
                ? "Couldn't reach Canvas — this machine's record"
                : answer.at
                  ? "Checked Canvas " + when(answer.at)
                  : "",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-iconbtn",
              disabled: checking,
              "aria-busy": checking ? "true" : undefined,
              "aria-label": "Check Canvas again",
              title: "Check Canvas again",
              onClick: recheck,
            },
            checking ? "" : "↻",
          ),
        ),
        rows.map((entry) => {
          const state = said.get(entry.id);
          const of = Math.max(entry.submitted, entry.graded, 1);
          const done = Math.min(100, (100 * entry.graded) / of);
          const part = Math.min(100 - done, (100 * (entry.partial || 0)) / of);
          return h(
            React.Fragment,
            { key: entry.id },
            h(
            "div",
            { className: "pp-bookrow" + (open === entry.id ? " pp-bookrow-open" : "") },
            h(TitleWithTag, { title: entry.title }),
            h(
              "span",
              { className: "pp-bookprogress", title: state.marking },
              h(
                "span",
                { className: "pp-bar", "aria-hidden": "true" },
                h("i", { className: "pp-bar-done", style: { width: done + "%" } }),
                part ? h("i", { className: "pp-bar-part", style: { width: part + "%" } }) : null,
              ),
              h("span", { className: "pp-booknum" }, entry.submitted === 0 && entry.graded === 0 ? "—" : entry.graded + "/" + entry.submitted),
            ),
            h(
              "span",
              { className: "pp-bookcanvas" },
              state.canvas ? h("span", { className: "pp-chip " + (state.behind ? "pp-chip-warn" : "pp-chip-ok") }, state.canvas) : null,
              // Nowhere to send these: the student is not in the Canvas course.
              state.stuck
                ? h(
                    "span",
                    {
                      className: "pp-chip",
                      title: "These students are not enrolled in the Canvas course, so their marks have nowhere to go. Add them in Canvas, then check again.",
                    },
                    state.stuck,
                  )
                : null,
              // Someone changed these in Canvas itself; the check reports them and
              // never adopts them. The preview under Send… shows whose.
              (edited.get(entry.id) || []).length
                ? h(
                    "span",
                    {
                      className: "pp-chip pp-chip-live",
                      title: "Changed in Canvas, not here. Open Send… to see whose; a send would leave them alone.",
                    },
                    edited.get(entry.id).length + " changed in Canvas",
                  )
                : null,
              state.behind || open === entry.id
                ? h(
                    "button",
                    { type: "button", className: "pp-segbtn pp-sendbtn", "aria-expanded": open === entry.id, onClick: () => setOpen(open === entry.id ? null : entry.id) },
                    open === entry.id ? "Close" : "Send…",
                  )
                : null,
            ),
            ),
            open === entry.id
              ? h(
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
                    onSent: props.onWrite,
                  }),
                )
              : null,
          );
        }),
      );
    }

    // ---------------------------------------------------------------- sheet activity

    /** `/api/marks-activity` for one run: what each grade-sheet sync brought in. */
    function useMarksActivity(runId, sessionId, revision, names) {
      const [state, setState] = React.useState({ phase: "loading", value: null });
      React.useEffect(() => {
        if (!runId) return undefined;
        let live = true;
        fetch(
          scoped(BASE + "/api/marks-activity?run=" + encodeURIComponent(runId) + (names ? "&names=1" : "") + "&r=" + revision, sessionId),
          { headers: { accept: "application/json" } },
        )
          .then((response) => response.json())
          .then((value) => live && setState({ phase: "ready", value }))
          .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
        return () => {
          live = false;
        };
      }, [runId, sessionId, revision, names]);
      return state;
    }

    /** How often an open pane asks whether the sheet changed. The server asks Google at most every two minutes. */
    const SHEET_CHECK_EVERY = 5 * 60 * 1000;

    /**
     * `/api/sheet-check` for one run: has each grade sheet changed in Google
     * since its last sync? Asked on load, after every write here, and every five
     * minutes while the pane is on screen — a hidden pane does not spend
     * Google's quota.
     */
    function useSheetCheck(runId, sessionId, revision) {
      const [value, setValue] = React.useState(null);
      React.useEffect(() => {
        if (!runId) return undefined;
        let live = true;
        const ask = () => {
          if (document.visibilityState === "hidden") return;
          fetch(scoped(BASE + "/api/sheet-check?run=" + encodeURIComponent(runId) + "&r=" + revision, sessionId), {
            headers: { accept: "application/json" },
          })
            .then((response) => response.json())
            .then((answer) => live && setValue(answer))
            .catch(() => {});
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

    /** What a dismissal of "the sheet changed" is about: this edit, or — when Drive gives no time — until the next sync. */
    const changeMark = (check) => check.sync + "|" + (check.modified || check.last_synced || "");

    /**
     * The last sync this browser has shown, per run. A per-viewer convenience:
     * lost in a private window, and then the notice shows once more.
     */
    const sheetSeenKey = (runId) => "pp-sheet-seen:" + runId;
    const readSheetSeen = (runId) => {
      try {
        return window.localStorage.getItem(sheetSeenKey(runId));
      } catch {
        return null;
      }
    };
    const writeSheetSeen = (runId, at) => {
      try {
        window.localStorage.setItem(sheetSeenKey(runId), at);
      } catch {
        // Nothing kept; the notice comes back on the next load.
      }
    };

    /** "3 new · 1 changed · 1 taken back" */
    const countWords = (event) =>
      [
        event.added ? event.added + " new" : null,
        event.changed ? event.changed + " changed" : null,
        event.removed ? event.removed + " taken back" : null,
      ]
        .filter(Boolean)
        .join(" · ");

    /** Where the sheet was read from, and how old it was. */
    const sourceWords = (event) =>
      event.read === "sheet"
        ? "read from the sheet in Google"
        : "from the copy downloaded " + (when(event.saved) || "at an unknown time");

    /** One mark's move: "P (10)", "P → L · 10 → 8", "taken back (was P)". */
    const markWords = (change) => {
      const points = (value) => (value === null || value === undefined ? "—" : String(value));
      if (change.from === null && change.score_from === null) return (change.to || "?") + (change.score_to !== null ? " · " + points(change.score_to) : "");
      if (change.to === null && change.score_to === null) return "taken back (was " + (change.from || "a mark") + ")";
      const words = change.from === change.to ? change.to || "" : (change.from || "—") + " → " + (change.to || "—");
      const scores = change.score_from === change.score_to ? "" : points(change.score_from) + " → " + points(change.score_to);
      return [words, scores].filter(Boolean).join(" · ");
    };

    /**
     * A notice over the pane when a grade-sheet sync brought marks in that this
     * browser has not shown yet — whoever ran it: the Syncs view, the CLI or the
     * assistant. It says how many, when, and from what; Gradebook shows which.
     */
    function SheetNotice(props) {
      return h(
        React.Fragment,
        null,
        h(SheetChangedNotice, props),
        h(SheetSyncedNotice, props),
      );
    }

    /**
     * "Your grade sheet changed in Google since the last sync" — asked of Google
     * by the server, on a machine with a Google login. The press goes to the
     * Syncs view, where Preview shows what would come in; nothing syncs here.
     */
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
          // Not kept; it shows again on the next load.
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
          (changed.modified ? " — edited " + when(changed.modified) : "") +
            (changed.last_synced ? "; last synced " + when(changed.last_synced) : "") +
            ". Nothing has come in yet.",
        ),
        props.onSync
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                onClick: () => {
                  dismiss();
                  props.onSync();
                },
              },
              "Preview the sync",
            )
          : null,
        h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×"),
      );
    }

    function SheetSyncedNotice(props) {
      const state = useMarksActivity(props.runId, props.sessionId, props.revision, false);
      const [seen, setSeen] = React.useState(() => readSheetSeen(props.runId));
      React.useEffect(() => setSeen(readSheetSeen(props.runId)), [props.runId]);
      if (state.phase === "loading" || !state.value || state.value.error) return null;
      const latest = (state.value.events || []).find((event) => event.changes.length);
      if (!latest) return null;
      // Never seen anything on this browser: a sync from the last two days is
      // still news; an older one is not.
      const fresh = seen ? Date.parse(latest.at) > Date.parse(seen) : Date.now() - Date.parse(latest.at) < 2 * 86400000;
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
          " — marks: " + countWords(latest) + "; " + sourceWords(latest) + ".",
        ),
        props.onOpen
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                onClick: () => {
                  dismiss();
                  props.onOpen();
                },
              },
              "See in Gradebook",
            )
          : null,
        h("button", { type: "button", className: "pp-close", "aria-label": "Dismiss", onClick: dismiss }, "×"),
      );
    }

    /**
     * Above the Gradebook: the marks the grade sheet brought in last, newest
     * run first — when each run happened, what it read and how old that was,
     * and each mark that came, moved or went. A run that changed nothing is a
     * line of its own, so "did my sync work?" has an answer too.
     */
    function RecentMarks(props) {
      const state = useMarksActivity(props.runId, props.sessionId, props.revision, props.names);
      const [open, setOpen] = React.useState(false);
      if (state.phase === "loading" || !state.value || state.value.error) return null;
      const events = state.value.events || [];
      if (!events.length) return null;
      const SHOWN = 6;
      const shown = open ? events : events.slice(0, 2);
      const more = events.length > 2 || shown.some((event) => event.changes.length > SHOWN);
      return h(
        "div",
        { className: "pp-bookcard pp-recentmarks" },
        h(
          "div",
          { className: "pp-cardhead" },
          h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
          h("b", null, "Last added from the grade sheet"),
          more ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setOpen(!open) }, open ? "Fewer" : "Show all") : null,
        ),
        shown.map((event) => {
          const rows = open ? event.changes : event.changes.slice(0, SHOWN);
          return h(
            "div",
            { className: "pp-recentrun" + (event.changes.length ? "" : " pp-recentquiet"), key: event.sync + event.at },
            h(
              "div",
              { className: "pp-recentwhen", title: "Synced " + new Date(event.at).toLocaleString() + (event.saved ? "; sheet as of " + new Date(event.saved).toLocaleString() : "") },
              h("span", null, when(event.at)),
              event.changes.length ? h("span", { className: "pp-chip pp-chip-ok" }, countWords(event)) : h("span", { className: "pp-chip" }, "nothing changed"),
              h("span", { className: "pp-as" }, sourceWords(event)),
            ),
            rows.length
              ? h(
                  "ul",
                  { className: "pp-recentlist" },
                  rows.map((change) =>
                    h(
                      "li",
                      { key: change.student + change.assessment },
                      h("span", { className: "pp-avatar", "aria-hidden": "true" }, initials(change.name || change.student)),
                      h("span", { className: "pp-recentwho" }, change.name || change.student),
                      h(TitleWithTag, { title: change.title }),
                      h(
                        "span",
                        { className: change.to === null && change.score_to === null ? "pp-behind" : "pp-recentmark" },
                        markWords(change),
                      ),
                    ),
                  ),
                )
              : null,
            event.changes.length > rows.length
              ? h("div", { className: "pp-as" }, "… and " + (event.changes.length - rows.length) + " more")
              : null,
          );
        }),
      );
    }

    /**
     * Tasks · Unpublished: everything the course holds that has not gone out.
     * Each line carries the press that sends it — the marks as the Scans tab
     * sends them, a moved material through the Publish dialog — except a
     * draft, which only the professor's edit to its record can accept.
     */
    function Unpublished(props) {
      const state = useUnpublished(props.runId, props.sessionId, props.revision);
      const [open, setOpen] = React.useState(null);
      if (state.phase === "loading") return h(Message, null, "Reading what has gone out…");
      const doc = state.value;
      if (doc.error) return h(Message, { error: true }, doc.error);
      const nothing = !doc.marks.length && !doc.drafts.length && !doc.moved.length;
      const section = (title, rows) => (rows.length ? h(React.Fragment, null, h("p", { className: "pp-factgroup" }, title), rows) : null);

      return h(
        "div",
        { className: "pp-scroll" },
        h(
          "p",
          { className: "pp-as" },
          "Read from this machine: the gradebook, what Canvas confirmed receiving, and what was last published. Canvas is not asked, so an edit made there by hand does not show.",
        ),
        nothing ? h(Message, null, "Everything decided here is out: no marks waiting for Canvas, no drafts held back, no material changed since it was published.") : null,
        section(
          "Marks not in Canvas",
          doc.marks.sort(dueOrder).map((entry) => {
            const said = markState(entry);
            const binding =
              entry.binding.state === "none"
                ? "no Canvas assignment yet"
                : entry.binding.state === "some"
                  ? "no Canvas assignment in " + entry.binding.missing.join(", ")
                  : null;
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
                  { type: "button", className: "pp-segbtn", onClick: () => setOpen(open === entry.id ? null : entry.id) },
                  open === entry.id ? "Close" : "Send…",
                ),
              ),
              open === entry.id
                ? h(CanvasMarks, {
                    key: entry.id,
                    runId: props.runId,
                    sessionId: props.sessionId,
                    assessmentId: entry.id,
                    title: entry.title,
                    ask: props.ask,
                    names: props.names,
                    canvas: entry.canvas,
                    autoPreview: true,
                    onSent: props.onWrite,
                  })
                : null,
            );
          }),
        ),
        section(
          "Changed since published",
          doc.moved.map((entry) =>
            h(
              "div",
              { className: "pp-approverow", key: entry.documentId + "|" + entry.target + "|" + entry.scope },
              h("b", null, entry.title),
              h("span", null, "changed since it went to " + entry.where + " on " + String(entry.at).slice(0, 10)),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  onClick: () => props.openPublish(entry.target, entry.target === "page" || entry.target === "telegram" ? {} : { assessment: entry.scope }),
                },
                "Publish again…",
              ),
            ),
          ),
        ),
        section(
          "Drafts a publication leaves out",
          doc.drafts.length
            ? [
                h(
                  "p",
                  { className: "pp-as", key: "how" },
                  "Accepting one is your edit: change approval: draft to approved in its record, then publish.",
                ),
              ].concat(
                doc.drafts.map((entry) =>
                  h(
                    "div",
                    { className: "pp-approverow", key: entry.collection + "|" + entry.id },
                    h("b", null, entry.title || entry.id),
                    h("span", { className: "pp-as" }, entry.collection + " · " + entry.id),
                  ),
                ),
              )
            : [],
        ),
      );
    }

    // ── client/files.js

    /** 1536 → "1.5 KB", 0 → "—". */
    const size = (bytes) => {
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

    /** 754 → "12 min", 40 → "1 min", 0 → "—". */
    const minutes = (seconds) => (seconds ? Math.max(1, Math.round(seconds / 60)) + " min" : "—");

    const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

    /** `/api/files` for one run, re-read whenever the course is written. */
    function useFiles(runId, sessionId, revision) {
      const [state, setState] = React.useState({ phase: "loading", value: null });
      React.useEffect(() => {
        let live = true;
        fetch(scoped(BASE + "/api/files?run=" + encodeURIComponent(runId || "") + "&r=" + revision, sessionId), {
          headers: { accept: "application/json" },
        })
          .then((response) => response.json())
          .then((value) => live && setState({ phase: "ready", value }))
          .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
        return () => {
          live = false;
        };
      }, [runId, sessionId, revision]);
      return state;
    }

    /**
     * Course mode · Files. Scans and audio are private and never in the course
     * folder; this says where they are, totals them, lists them per assessment,
     * and opens each pile in the Scans window, the batch in the recordings dialog,
     * or the folder itself in the file manager.
     */
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
            props.sessionId,
          ),
          { method: "POST", headers: { accept: "application/json" } },
        )
          .then((response) => response.json())
          .then((answer) => setRevealed(answer.error ? { error: answer.error } : { ok: true }))
          .catch((error) => setRevealed({ error: String(error) }));
      };

      const scans = doc.assessments.filter((entry) => entry.scans.uploaded || entry.scans.papers);
      const audio = doc.assessments.filter((entry) => entry.audio.takes);
      const nothing = !scans.length && !audio.length && !doc.unfiled.count && !doc.recordings.count;
      const folderButton = (assessment) =>
        h("button", { type: "button", className: "pp-segbtn", title: "Open this folder in the file manager", onClick: () => reveal(assessment) }, "Folder");

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
            h("span", { className: "pp-as" }, "Scans and recordings carry students' names and voices, so they never go into the course folder or git."),
          ),
          h(
            "div",
            { className: "pp-approverow" },
            doc.exists
              ? h("button", { type: "button", className: "pp-segbtn", "aria-busy": revealed && revealed.busy ? "true" : undefined, onClick: () => reveal("") }, "Open folder")
              : null,
            props.onUpload ? h("button", { type: "button", className: "pp-primary", onClick: props.onUpload }, "Upload…") : null,
          ),
        ),
        revealed && revealed.error ? h("p", { className: "pp-behind" }, revealed.error) : null,

        nothing
          ? h(Message, null, "Nothing is stored for this run yet. Scanned papers and recorded answers you upload will be listed here.")
          : h(
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
                  h("span", { className: "pp-as" }, size(doc.totals.scans.bytes)),
                ),
                h(
                  "div",
                  { className: "pp-filetile" },
                  h("span", { className: "pp-filetilehead" }, "Audio"),
                  h("b", null, doc.totals.audio.takes ? plural(doc.totals.audio.takes, "recording", "recordings") : "None yet"),
                  h(
                    "span",
                    { className: "pp-as" },
                    doc.totals.audio.takes
                      ? minutes(doc.totals.audio.seconds) + " · " + size(doc.totals.audio.bytes)
                      : "recorded answers and defences land here",
                  ),
                ),
                doc.unfiled.count || doc.recordings.count
                  ? h(
                      "div",
                      { className: "pp-filetile pp-filetile-wait" },
                      h("span", { className: "pp-filetilehead" }, "Waiting to be filed"),
                      h(
                        "b",
                        null,
                        [doc.unfiled.count ? plural(doc.unfiled.count, "scan", "scans") : null, doc.recordings.count ? plural(doc.recordings.count, "recording", "recordings") : null]
                          .filter(Boolean)
                          .join(" · "),
                      ),
                      h("span", { className: "pp-as" }, "uploaded, not yet given to an assessment or a student"),
                    )
                  : null,
              ),

              // Scans, per assessment pile.
              scans.length || doc.unfiled.count
                ? h(
                    "section",
                    { className: "pp-filesection" },
                    h("h3", null, "Scans"),
                    h(
                      "table",
                      { className: "pp-plantable pp-filetable" },
                      h(
                        "thead",
                        null,
                        h("tr", null, h("th", null, "Assessment"), h("th", { className: "pp-num" }, "Uploaded"), h("th", { className: "pp-num" }, "Papers filed"), h("th", { className: "pp-num" }, "Size"), h("th", null, "")),
                      ),
                      h(
                        "tbody",
                        null,
                        doc.unfiled.count
                          ? h(
                              "tr",
                              { key: "_unfiled", className: "pp-filewait" },
                              h("td", null, h("b", null, "Not yet filed to an assessment")),
                              h("td", { className: "pp-num" }, String(doc.unfiled.count)),
                              h("td", { className: "pp-num" }, "—"),
                              h("td", { className: "pp-num" }, size(doc.unfiled.bytes)),
                              h("td", { className: "pp-fileacts" }, props.onUpload ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onUpload }, "File them…") : null),
                            )
                          : null,
                        scans.map((entry) =>
                          h(
                            "tr",
                            { key: entry.id },
                            h("td", null, h(TitleWithTag, { title: entry.title })),
                            h("td", { className: "pp-num" }, String(entry.scans.uploaded)),
                            h("td", { className: "pp-num" }, String(entry.scans.papers)),
                            h("td", { className: "pp-num" }, size(entry.scans.bytes)),
                            h(
                              "td",
                              { className: "pp-fileacts" },
                              entry.scans.pile && entry.known && props.onOpenScans
                                ? h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpenScans(entry.id) }, "Open pile")
                                : null,
                              folderButton(entry.id),
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,

              // Audio: recorded answers per assessment, and the uploaded batch.
              audio.length || doc.recordings.count
                ? h(
                    "section",
                    { className: "pp-filesection" },
                    h("h3", null, "Audio"),
                    h(
                      "table",
                      { className: "pp-plantable pp-filetable" },
                      h(
                        "thead",
                        null,
                        h("tr", null, h("th", null, "Assessment"), h("th", { className: "pp-num" }, "Students"), h("th", { className: "pp-num" }, "Recordings"), h("th", { className: "pp-num" }, "Length"), h("th", { className: "pp-num" }, "Size"), h("th", null, "")),
                      ),
                      h(
                        "tbody",
                        null,
                        doc.recordings.count
                          ? h(
                              "tr",
                              { key: "_batch", className: "pp-filewait" },
                              h(
                                "td",
                                null,
                                h("b", null, "Uploaded in a batch"),
                                h(
                                  "span",
                                  { className: "pp-as" },
                                  " · " + (doc.recordings.planned ? doc.recordings.matched + " of " + doc.recordings.planned + " matched to a student" : "not matched yet"),
                                ),
                              ),
                              h("td", { className: "pp-num" }, "—"),
                              h("td", { className: "pp-num" }, String(doc.recordings.count)),
                              h("td", { className: "pp-num" }, "—"),
                              h("td", { className: "pp-num" }, size(doc.recordings.bytes)),
                              h("td", { className: "pp-fileacts" }, props.onRecordings ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onRecordings }, "Open recordings…") : null),
                            )
                          : null,
                        audio.map((entry) =>
                          h(
                            "tr",
                            { key: entry.id },
                            h("td", null, h(TitleWithTag, { title: entry.title })),
                            h("td", { className: "pp-num" }, String(entry.audio.students)),
                            h("td", { className: "pp-num" }, String(entry.audio.takes)),
                            h("td", { className: "pp-num" }, minutes(entry.audio.seconds)),
                            h("td", { className: "pp-num" }, size(entry.audio.bytes)),
                            h("td", { className: "pp-fileacts" }, folderButton(entry.id)),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,

              doc.papers.count
                ? h(
                    "p",
                    { className: "pp-as" },
                    "Also stored: " + plural(doc.papers.count, "question paper or answer key", "question papers and answer keys") + " (" + size(doc.papers.bytes) + ").",
                  )
                : null,
            ),
      );
    }

    // ── client/grade-board.js

    /**
     * Grading a written exam, one question at a time, over the conversation.
     *
     * The document is server/grade.js — `ainar grade status --json` with names
     * added — and every figure in it arrived computed. Three readings, chosen
     * by where the rubric stands:
     *
     * * **no rubric** — the question, its marking guidance and the answers as
     *   read, with two ways forward: ask the assistant to group the answers and
     *   propose levels, or grade by points only;
     * * **rubric proposed** — the levels top down, the groups of answers placed
     *   under them, a select on each group to move it, and Accept rubric;
     * * **rubric accepted** — the groups with their answer cards. A card's
     *   buttons decide that answer; a group's Accept decides every undecided
     *   answer in it at its suggestion; Accept all does the question, or every
     *   question.
     *
     * Every write is a POST that spawns `ainar grade …`. A decision is the
     * professor's press, and how it was pressed — one card, a group, all — is
     * kept beside it by the CLI.
     */
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

      // groups.yaml is private, so the course's revision poll never sees the
      // assistant rewrite it. Ask for its time every few seconds while the view
      // is open, and redraw when it moves — a rethought rubric appears here
      // without anybody pressing reload.
      React.useEffect(() => {
        let last = null;
        let live = true;
        const check = () =>
          fetch(scoped(BASE + "/api/grade/stamp?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId), props.sessionId))
            .then((response) => response.json())
            .then((value) => {
              if (!live || value.error) return;
              if (last !== null && value.groups !== last) setTick((count) => count + 1);
              last = value.groups;
            })
            .catch(() => {});
        check();
        const timer = setInterval(check, 3000);
        return () => {
          live = false;
          clearInterval(timer);
        };
      }, [props.runId, props.assessmentId, props.sessionId]);
      const close = props.onClose;

      const url = (path) =>
        scoped(
          BASE + path + "?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessmentId),
          props.sessionId,
        );

      React.useEffect(() => {
        let live = true;
        fetch(url("/api/grade") + (props.names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
          headers: { accept: "application/json" },
        })
          .then((response) => response.json())
          .then((value) => live && setState({ phase: "ready", value }))
          .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
        return () => {
          live = false;
        };
      }, [props.runId, props.assessmentId, props.names, props.revision, tick]);

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            if (big) setBig(null);
            else close();
          }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      }, [close, busy, big]);

      // The card in focus takes the keyboard, so j/k and a digit act on it —
      // unless a comment is being typed.
      React.useEffect(() => {
        const node = document.querySelector(".pp-gcard.pp-focus");
        if (node && document.activeElement && document.activeElement.tagName !== "INPUT") node.focus({ preventScroll: false });
      }, [focus, at, tick, state.phase]);

      const post = (path, body, label) => {
        if (busy) return;
        setBusy(label);
        setSaid(null);
        fetch(url(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
          .then((response) => response.json())
          .then((result) => {
            setBusy(null);
            const stale = /no route \/api\/grade/.test(String(result.error || ""));
            const failed = Boolean(result.error) || !result.ok;
            setSaid(
              failed
                ? { error: true, text: stale ? "The harness was started before grading existed. Restart it, then try again." : result.error || result.output }
                : { error: false, text: String(result.output || "Done.").split("\n").filter((line) => !/^wrote /.test(line)).join(" ") },
            );
            setTick((value) => value + 1);
            props.onWrite();
          })
          .catch((error) => {
            setBusy(null);
            setSaid({ error: true, text: String(error) });
          });
      };

      const doc = state.value;
      const shell = (title, body, foot) =>
        ReactDOM.createPortal(
          h(
            "div",
            {
              className: "pp-veil",
              onMouseDown: (event) => {
                if (event.target === event.currentTarget && !busy) close();
              },
            },
            h(
              "div",
              { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Grade " + props.title },
              h(
                "div",
                { className: "pp-modalhead pp-ghead" },
                h("div", { className: "pp-modaltitle" }, title),
                doc && doc.items
                  ? doc.items.map((item, index) =>
                      h(
                        "button",
                        {
                          type: "button",
                          key: item.item_id,
                          className: "pp-gq" + (index === at ? " pp-gq-on" : "") + (doc.rubric !== "accepted" && !item.criterion ? " pp-gq-missing" : ""),
                          title: doc.rubric !== "accepted" && !item.criterion ? "No rubric chosen for this question yet" : undefined,
                          onClick: () => {
                            setAt(index);
                            setFocus(0);
                          },
                        },
                        "Q" + (item.number || index + 1),
                        h("span", null, " " + item.counts.decided + "/" + item.counts.answers),
                      ),
                    )
                  : null,
                h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: Boolean(busy), onClick: close }, "×"),
              ),
              said ? h("pre", { className: "pp-approveout pp-gsaid" + (said.error ? " pp-approveerr" : "") }, said.text) : null,
              body,
              foot ? h("div", { className: "pp-reviewfoot" }, foot) : null,
            ),
          ),
          document.body,
        );

      if (state.phase === "loading") return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "Reading the answers…")));
      if (doc.error) {
        return shell(
          "Grade · " + props.title,
          h(
            "div",
            { className: "pp-review" },
            h(Message, { error: true }, /no route \/api\/grade/.test(doc.error) ? "The harness was started before grading existed. Restart it to grade here." : doc.error),
          ),
        );
      }
      if (!doc.items.length) {
        return shell("Grade · " + props.title, h("div", { className: "pp-review" }, h(Message, null, "This assessment has no written questions to grade.")));
      }
      // The browser half is read when the page loads, the host half when the
      // harness starts: a page reloaded after an update meets an older host,
      // whose payload lacks what this view draws. Say so rather than fail.
      if (doc.items.some((entry) => !entry.marks || !entry.proposals)) {
        return shell(
          "Grade · " + props.title,
          h("div", { className: "pp-review" }, h(Message, { error: true }, "The harness is older than this view. Restart the harness, then open grading again.")),
        );
      }

      const item = doc.items[Math.min(at, doc.items.length - 1)];
      const who = (student) => (doc.names && doc.people[student] ? doc.people[student] + " · " + student : student);
      const pageUrl = (answer) =>
        url("/api/grade/page") + "&student=" + encodeURIComponent(answer.student) + "&page=" + encodeURIComponent(answer.page || 1) +
        (doc.names ? "&names=1" : "");
      const max = item.maximum_score;
      // The marks a button can give: the rubric's levels where there are
      // some, otherwise every whole mark — and halves on a short question,
      // where a half is how such a question is usually marked.
      const scale = item.criterion && item.criterion.levels.length
        ? item.criterion.levels.map((level) => level.score).sort((a, b) => a - b)
        : (() => {
            const step = max <= 4 ? 0.5 : 1;
            const out = [];
            for (let value = 0; value <= max + 1e-9; value += step) out.push(Math.round(value * 2) / 2);
            return out;
          })();
      const label = (value) => (Number.isInteger(value) ? String(value) : String(value).replace(/\.5$/, "½").replace(/^0½$/, "½"));
      const levelOf = (score) => (item.criterion ? item.criterion.levels.find((level) => level.score === score) : null);

      const guidance = item.marking_guidance
        ? h("details", { className: "pp-gguide" }, h("summary", null, "Marking guidance"), h("div", null, item.marking_guidance))
        : null;
      const question = h(
        "div",
        { className: "pp-gquestion" },
        h("b", null, "Q" + (item.number || at + 1) + ". "),
        item.prompt,
        h("span", { className: "pp-as" }, "  " + label(max) + " mark" + (max === 1 ? "" : "s")),
        guidance,
      );

      const answerText = (answer) =>
        answer.unread
          ? h("div", { className: "pp-gtext pp-gmuted" }, "Not read yet — the page is the only record of this answer.")
          : answer.blank
            ? h("div", { className: "pp-gtext pp-gmuted" }, "Nothing written.")
            : h("div", { className: "pp-gtext" }, answer.text);

      // Where this question stands. The rubric is accepted for the whole
      // assessment at once, but chosen question by question, so a question
      // with no criterion yet is "none" even while another is a draft.
      const itemState = !item.criterion ? "none" : doc.rubric === "accepted" ? "accepted" : "draft";
      const qName = "Q" + (item.number || at + 1);
      const without = doc.items.filter((entry) => !entry.criterion).map((entry, index) => "Q" + (entry.number || index + 1));

      // One line: the skill's "Where to start" maps it to §7, which holds the how.
      const ask = (several) =>
        "/import-assessment " + props.assessmentId + " " + props.runId + " — " + (several ? "propose the rubric" : "propose one rubric");

      // The proposed rubrics for this question, side by side: each one's levels
      // with how many answers it puts at each, and the mean it gives the class.
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
                h("span", null, " · " + proposal.spread.placed + " of " + answered + " answers placed"),
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
                    h("span", { className: "pp-gbar" }, h("span", { style: { width: Math.round((count / Math.max(1, answered)) * 100) + "%" } })),
                    h("span", { className: "pp-as" }, String(count)),
                  ),
                  h("div", { className: "pp-gpdesc" }, level.description),
                  names.length
                    ? h(
                        "div",
                        { className: "pp-gpgroups" },
                        names.map((group) =>
                          h(
                            "span",
                            { key: group.index, className: proposal.unsure.indexOf(group.index) !== -1 ? "pp-gpunsure" : "" },
                            group.label + " (" + group.count + ")",
                          ),
                        ),
                      )
                    : null,
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
                    onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id }, "choose"),
                  },
                  busy === "choose" ? "Writing…" : mine ? "Use again for " + qName : "Use for " + qName,
                ),
                everywhere && doc.items.length > 1
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        disabled: Boolean(busy) || doc.items.some((entry) => entry.counts.decided > 0),
                        onClick: () => post("/api/grade/choose", { proposal: proposal.id }, "choose"),
                      },
                      "Use for every question",
                    )
                  : null,
              ),
            );
          }),
        );
      };

      // Accept rubric accepts the whole assessment's rubric, so while some
      // question has none the press waits — and this says so where it is
      // read, with the one press that usually settles it: the same proposal
      // for the rest.
      const missingBar = () => {
        const rest = doc.items.filter((entry) => !entry.criterion);
        const same = item.chosen
          ? item.proposals.find((proposal) => proposal.id === item.chosen)
          : null;
        const coversRest = same && rest.every((entry) => entry.proposals.some((proposal) => proposal.id === same.id));
        return h(
          "div",
          { className: "pp-gmissing" },
          h("span", null, without.join(", ") + (without.length === 1 ? " still needs" : " still need") + " a rubric before the quiz's rubric can be accepted."),
          coversRest
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-primary",
                  disabled: Boolean(busy) || rest.some((entry) => entry.counts.decided > 0),
                  onClick: () => post("/api/grade/choose", { proposal: same.id, items: rest.map((entry) => entry.item_id) }, "choose"),
                },
                busy === "choose" ? "Writing…" : "Use “" + same.title + "” for " + without.join(", "),
              )
            : null,
          rest.map((entry) =>
            h(
              "button",
              {
                type: "button",
                key: entry.item_id,
                className: "pp-segbtn",
                onClick: () => {
                  setAt(doc.items.indexOf(entry));
                  setFocus(0);
                },
              },
              "Choose for Q" + (entry.number || doc.items.indexOf(entry) + 1),
            ),
          ),
        );
      };

      // ----------------------------------------------------------- no rubric
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
                proposed
                  ? item.proposals.length + " rubrics proposed for " + qName + " over the same groups of answers. Pick one to review; you accept it afterwards."
                  : "Nothing to grade against yet. Group the answers and propose levels — or mark by points, without a rubric.",
              ),
              h(
                "div",
                { className: "pp-actions" },
                h(
                  "button",
                  { type: "button", className: (proposed ? "pp-segbtn" : "pp-primary") + " pp-chat", disabled: Boolean(busy), onClick: () => { props.ask(ask(true)); close(); } },
                  proposed ? "Ask for other rubrics" : "Ask the assistant to propose rubrics",
                ),
                !proposed
                  ? h(
                      "button",
                      { type: "button", className: "pp-segbtn pp-chat", disabled: Boolean(busy), onClick: () => { props.ask(ask(false)); close(); } },
                      "Just one rubric",
                    )
                  : null,
                doc.rubric === "none" && !doc.items.some((entry) => entry.criterion)
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        disabled: Boolean(busy),
                        title: "One criterion per question, worth its marks, accepted now — then 0…" + label(max) + " buttons on every answer",
                        onClick: () => post("/api/grade/points-only", {}, "points"),
                      },
                      busy === "points" ? "Writing…" : "Grade by points only",
                    )
                  : null,
              ),
            ),
            proposed ? compare() : null,
            !proposed
              ? [
                  h("div", { className: "pp-reviewsec", key: "sec" }, "The answers", h("span", null, item.counts.answers - item.counts.unread - item.counts.blank + " written · " + item.counts.blank + " blank · " + item.counts.unread + " not read yet")),
                  item.answers
                    .filter((answer) => !answer.unread && !answer.blank)
                    .map((answer) => h("div", { className: "pp-gplain", key: answer.student }, h("div", { className: "pp-gwho" }, who(answer.student)), answerText(answer))),
                ]
              : null,
          ),
        );
      }

      // ------------------------------------------------------------- rubric
      if (itemState === "draft") {
        const levels = item.criterion && item.criterion.levels.length
          ? item.criterion.levels
          : scale.slice().reverse().map((score) => ({ score: score, label: null, description: "" }));
        const placedAt = (score) => item.groups.filter((group) => group.score === score);
        const unplaced = item.groups.filter((group) => group.score === null || !levels.some((level) => level.score === group.score));
        const groupChip = (group) => {
          const open = openGroups[item.item_id + "|" + group.index];
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
                  onClick: () => setOpenGroups((current) => Object.assign({}, current, { [item.item_id + "|" + group.index]: !open })),
                },
                (open ? "▾ " : "▸ ") + group.label,
              ),
              h("span", { className: "pp-as" }, group.count + (group.unsure ? " · unsure" : "")),
              h(
                "select",
                {
                  "aria-label": "Move this group to a level",
                  value: group.score === null ? "" : String(group.score),
                  disabled: Boolean(busy),
                  onChange: (event) =>
                    post(
                      "/api/grade/move",
                      { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) },
                      "move",
                    ),
                },
                h("option", { value: "" }, "not placed"),
                levels.map((level) => h("option", { value: String(level.score), key: level.score }, label(level.score) + (level.label ? " · " + level.label : ""))),
              ),
            ),
            group.reason ? h("div", { className: "pp-as" }, group.reason) : null,
            open ? members.map((answer) => h("div", { className: "pp-gplain", key: answer.student }, answerText(answer))) : null,
          );
        };
        return shell(
          "Grade · " + props.title + " · rubric proposed",
          h(
            "div",
            { className: "pp-review" },
            question,
            item.proposals.length
              ? h(
                  "div",
                  { className: "pp-gfrom" },
                  item.chosen
                    ? "Taken from the proposal “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”. "
                    : "",
                  h(
                    "button",
                    { type: "button", className: "pp-segbtn", onClick: () => setComparing(!comparing) },
                    comparing ? "Hide the proposals" : "Compare the " + item.proposals.length + " proposals",
                  ),
                )
              : null,
            comparing && item.proposals.length ? compare() : null,
            without.length ? missingBar() : null,
            !doc.grouped
              ? h(Message, null, "The levels are written, and the answers are not grouped yet. Ask the assistant to group them, or accept the rubric and grade each answer yourself.")
              : null,
            levels.map((level) =>
              h(
                "div",
                { className: "pp-glevel", key: level.score },
                h(
                  "div",
                  { className: "pp-glevelhead" },
                  h("b", null, label(level.score)),
                  h("span", null, level.description || (level.label || "")),
                  h("span", { className: "pp-as" }, placedAt(level.score).reduce((sum, group) => sum + group.count, 0) + " answers"),
                ),
                placedAt(level.score).map(groupChip),
              ),
            ),
            unplaced.length
              ? h("div", { className: "pp-glevel" }, h("div", { className: "pp-glevelhead" }, h("b", null, "?"), h("span", null, "Not placed at a level")), unplaced.map(groupChip))
              : null,
            item.counts.ungrouped
              ? h(Message, null, item.counts.ungrouped + " answer(s) to this question are in no group; they are graded one by one once the rubric is accepted.")
              : null,
            doc.group_problems.length ? h(Message, { error: true }, doc.group_problems.join("; ")) : null,
          ),
          [
            h(
              "span",
              { className: "pp-as", key: "hint" },
              without.length
                ? without.join(", ") + (without.length === 1 ? " has" : " have") + " no rubric yet — choose one there before accepting."
                : "Accepting the rubric accepts it for every question of " + props.title + ". Change a level's wording in chat.",
            ),
            h(
              "button",
              {
                type: "button",
                key: "accept",
                className: "pp-primary",
                disabled: Boolean(busy) || without.length > 0,
                onClick: () => post("/api/grade/accept-rubric", {}, "accept"),
              },
              busy === "accept" ? "Accepting…" : "Accept rubric",
            ),
          ],
        );
      }

      // -------------------------------------------------------------- grade
      const decide = (list, via, labelText) =>
        post(
          "/api/grade/decide",
          {
            via: via,
            decisions: list.map((entry) =>
              Object.assign({ item: entry.item || item.item_id, student: entry.student, score: entry.score }, notes[entry.student + "|" + (entry.item || item.item_id)] ? { comment: notes[entry.student + "|" + (entry.item || item.item_id)] } : {}),
            ),
          },
          labelText,
        );
      const waiting = (answers) => answers.filter((answer) => !answer.decision && answer.suggestion);
      // A decided mark the rubric, as it now stands, would suggest differently.
      const disagrees = (answer) => answer.decision && answer.now !== null && answer.now !== answer.decision.score;
      const sections = [];
      item.groups.forEach((group) =>
        sections.push({
          key: "g" + group.index,
          title: group.label,
          score: group.score,
          unsure: group.unsure,
          answers: item.answers.filter((answer) => answer.group === group.index && !answer.blank && !answer.unread),
        }),
      );
      sections.push({
        key: "none",
        title: item.groups.length ? "In no group" : "Answers",
        score: null,
        answers: item.answers.filter((answer) => answer.group === null && !answer.blank && !answer.unread),
      });
      sections.push({ key: "blank", title: "Blank", score: 0, answers: item.answers.filter((answer) => answer.blank) });
      sections.push({ key: "unread", title: "Not read yet — read the page, or run `scans read`", score: null, answers: item.answers.filter((answer) => answer.unread) });
      const visible = sections.filter((section) => section.answers.length);
      const order = [].concat.apply([], visible.map((section) => section.answers));
      const current = Math.min(focus, Math.max(0, order.length - 1));

      // The mark an answer stands at, as a badge you can read across the room:
      // green once decided, grey while it is only the suggestion.
      const badge = (answer) => {
        const decided = answer.decision ? answer.decision.score : null;
        const suggested = answer.suggestion ? answer.suggestion.score : null;
        const value = decided !== null ? decided : suggested;
        return h(
          "div",
          { className: "pp-gmark" + (decided !== null ? " pp-gmark-done" : value !== null ? " pp-gmark-sug" : " pp-gmark-none") },
          h("b", null, value === null ? "—" : label(value)),
          h("span", null, decided !== null ? "of " + label(max) + " ✓" : value !== null ? "suggested" : "no mark"),
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
            onMouseDown: () => setFocus(index),
          },
          badge(answer),
          h(
            "div",
            { className: "pp-gbody" },
            h("div", { className: "pp-gwho" }, who(answer.student), answer.page ? h("span", null, " · p." + answer.page) : null),
            answerText(answer),
            answer.confidence && answer.confidence !== "high" || answer.note
              ? h(
                  "div",
                  { className: "pp-gnote" + (answer.confidence === "low" ? " pp-glow" : "") },
                  (answer.confidence && answer.confidence !== "high" ? answer.confidence + " confidence" : "") +
                    (answer.note ? (answer.confidence && answer.confidence !== "high" ? " · " : "") + answer.note : ""),
                )
              : null,
            answer.suggestion && answer.suggestion.source === "grader" && answer.suggestion.comment
              ? h("div", { className: "pp-as" }, "Suggested " + label(answer.suggestion.score) + ": " + answer.suggestion.comment)
              : null,
            disagrees(answer)
              ? h(
                  "div",
                  { className: "pp-gdisagree" },
                  "The rubric now suggests " + label(answer.now) + ". ",
                  h(
                    "button",
                    { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => decide([{ student: answer.student, score: answer.now }], "one", "one") },
                    "Give " + label(answer.now),
                  ),
                  h("span", { className: "pp-as" }, " or keep " + label(decided)),
                )
              : null,
            h(
              "div",
              { className: "pp-gbtns" },
              scale.map((value) =>
                h(
                  "button",
                  {
                    type: "button",
                    key: value,
                    className: "pp-gscore" + (decided === value ? " pp-gscore-on" : decided === null && suggested === value ? " pp-gscore-next" : ""),
                    title: (levelOf(value) ? levelOf(value).description + " — " : "") + "give " + label(value),
                    disabled: Boolean(busy),
                    onClick: () => decide([{ student: answer.student, score: value }], "one", "one"),
                  },
                  label(value),
                ),
              ),
              h("input", {
                className: "pp-gcomment",
                placeholder: answer.decision && answer.decision.comment ? answer.decision.comment : "comment",
                value: notes[key] || "",
                onChange: (event) => {
                  const text = event.target.value;
                  setNotes((current) => Object.assign({}, current, { [key]: text }));
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter" && (decided !== null || suggested !== null)) {
                    decide([{ student: answer.student, score: decided !== null ? decided : suggested }], "one", "one");
                  }
                  event.stopPropagation();
                },
              }),
              answer.history ? h("span", { className: "pp-as" }, "changed " + answer.history + "×") : null,
            ),
          ),
        );
      };

      const onKey = (event) => {
        if (event.target.tagName === "SELECT" || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || busy) return;
        const answer = order[current];
        // After a mark, on to the next answer nobody has decided — the one
        // that still needs reading — or simply the next if none is left.
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
          // Enter takes the suggestion on an undecided answer only. On one
          // already decided it moves on: a decision is changed by pressing a
          // mark, never by the key that means "agree".
          if (!answer.decision && answer.suggestion) decide([{ student: answer.student, score: answer.suggestion.score }], "one", "one");
          onward();
          event.preventDefault();
        } else if (answer && /^[0-9]$/.test(event.key) && scale.indexOf(Number(event.key)) !== -1) {
          decide([{ student: answer.student, score: Number(event.key) }], "one", "one");
          onward();
          event.preventDefault();
        }
      };

      const allHere = waiting(item.answers);
      const allEverywhere = [].concat.apply(
        [],
        doc.items.map((entry) => waiting(entry.answers).map((answer) => ({ item: entry.item_id, student: answer.student, score: answer.suggestion.score }))),
      );
      const disagreeing = item.answers.filter(disagrees);

      // Where the question stands: per mark, how many answers sit there —
      // decided in green, still only suggested in grey — and the mean.
      const marksKeys = scale.slice().reverse().filter((value) => item.marks.at[String(value)] || (item.criterion && item.criterion.levels.some((level) => level.score === value)));
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
          disagreeing.length
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: Boolean(busy),
                  title: "Each keeps its old mark in its history",
                  onClick: () => decide(disagreeing.map((answer) => ({ student: answer.student, score: answer.now })), "group", "remark"),
                },
                busy === "remark" ? "Re-marking…" : "Re-mark all " + disagreeing.length + " at the rubric's suggestion",
              )
            : null,
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
              h("span", { className: "pp-gdist-done", style: { width: (slot.decided / answeredCount) * 100 + "%" } }),
              h("span", { className: "pp-gdist-sug", style: { width: (slot.suggested / answeredCount) * 100 + "%" } }),
            ),
            h("span", { className: "pp-gdistn" }, String(slot.decided + slot.suggested)),
          );
        }),
      );

      // The rubric, open while grading. Moving a group re-suggests every
      // answer in it at once; another proposal — the one the assistant wrote
      // after "rethink" — shows what it would change before it is used.
      const levelsNow = item.criterion && item.criterion.levels.length
        ? item.criterion.levels
        : scale.slice().reverse().map((score) => ({ score: score, label: null, description: "" }));
      const others = item.proposals.filter((proposal) => proposal.id !== item.chosen);
      const nextRev = "rev-" + (doc.proposals.filter((proposal) => /^rev-\d+$/.test(proposal.id)).length + 1);
      // The professor's words, and what the skill needs to place them: which
      // question, and the id the Grade view will look for. The how is §7's.
      const rethinkPrompt = (text) =>
        "/import-assessment " + props.assessmentId + " " + props.runId + " — rethink the rubric for " + qName +
        " (" + item.item_id + ") as `" + nextRev + "`: " + text.trim();
      const rubricPanel = h(
        "div",
        { className: "pp-grubric" },
        h(
          "div",
          { className: "pp-grubrichead" },
          h("b", null, "Rubric for " + qName),
          item.chosen ? h("span", { className: "pp-as" }, "from “" + ((item.proposals.find((proposal) => proposal.id === item.chosen) || {}).title || item.chosen) + "”") : null,
        ),
        levelsNow.map((level) => {
          const here = item.groups.filter((group) => group.score === level.score);
          return h(
            "div",
            { className: "pp-grlevel", key: level.score },
            h("div", { className: "pp-grlevelhead" }, h("b", null, label(level.score)), h("span", null, level.description)),
            here.map((group) =>
              h(
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
                    onChange: (event) =>
                      post("/api/grade/move", { item: item.item_id, group: group.index, score: event.target.value === "" ? null : Number(event.target.value) }, "move"),
                  },
                  h("option", { value: "" }, "no mark"),
                  levelsNow.map((option) => h("option", { value: String(option.score), key: option.score }, "→ " + label(option.score))),
                ),
              ),
            ),
          );
        }),
        others.map((proposal) => {
          const effect = proposal.effect;
          const nameOf = (index) => (item.groups[index] ? item.groups[index].label : "group " + (index + 1));
          return h(
            "div",
            { className: "pp-grother", key: proposal.id },
            h("div", { className: "pp-grubrichead" }, h("b", null, proposal.title), h("span", { className: "pp-as" }, "mean " + (proposal.spread.mean === null ? "—" : proposal.spread.mean))),
            proposal.summary ? h("div", { className: "pp-as" }, proposal.summary) : null,
            effect.moves.length
              ? h(
                  "ul",
                  { className: "pp-grmoves" },
                  effect.moves.map((move) =>
                    h("li", { key: move.group }, nameOf(move.group) + ": " + (move.from === null ? "—" : label(move.from)) + " → " + (move.to === null ? "—" : label(move.to)) + " (" + move.count + ")"),
                  ),
                )
              : h("div", { className: "pp-as" }, "Changes no suggestion."),
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
                  onClick: () => post("/api/grade/choose", { proposal: proposal.id, item: item.item_id, keepMarks: true, accept: true }, "revise"),
                },
                busy === "revise" ? "Applying…" : "Use this",
              ),
              h(
                "span",
                { className: "pp-as" },
                effect.changes + " suggestion(s) change" + (effect.disagree ? " · " + effect.disagree + " of your marks would differ" : ""),
              ),
            ),
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
              setNotes((current) => Object.assign({}, current, { ["rethink|" + item.item_id]: text }));
            },
            onKeyDown: (event) => event.stopPropagation(),
          }),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-chat",
              disabled: !(notes["rethink|" + item.item_id] || "").trim(),
              onClick: () => {
                props.ask(rethinkPrompt(notes["rethink|" + item.item_id]));
                setNotes((current) => Object.assign({}, current, { ["rethink|" + item.item_id]: "" }));
                setSaid({ error: false, text: "Asked the assistant to rethink " + qName + ". Its revision appears here, under the rubric, as soon as it is written." });
              },
            },
            "Ask the assistant to rethink " + qName,
          ),
        ),
      );

      // The page of the answer in focus, at a size handwriting can be read at,
      // beside the list rather than shrunk into every card.
      const shown = order[current];
      const side = h(
        "div",
        { className: "pp-gside" },
        showRubric ? rubricPanel : null,
        shown && doc.pages
          ? [
              h("div", { className: "pp-gwho", key: "who" }, who(shown.student) + " · page " + (shown.page || 1) + " · press the page to enlarge"),
              h("img", {
                key: "page",
                src: pageUrl(shown),
                alt: "Page " + (shown.page || 1) + " of " + shown.student + "'s paper",
                title: "Enlarge",
                onClick: () => setBig(shown),
              }),
            ]
          : h(Message, null, doc.pages ? "Choose an answer to see its page." : "pdftoppm is not installed, so pages cannot be drawn."),
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
                showRubric ? "Hide the rubric" : "Rubric and rethink" + (others.length ? " · " + others.length + " other proposal(s)" : ""),
              ),
              h("span", { className: "pp-as" }, "decided as " + (doc.decided_by || "nobody — the run lists no instructor")),
            ),
            visible.map((section) => {
              const open = waiting(section.answers);
              return h(
                React.Fragment,
                { key: section.key },
                h(
                  "div",
                  { className: "pp-gsection" },
                  section.score !== null && section.key !== "unread"
                    ? h("span", { className: "pp-gsecmark" }, label(section.score))
                    : h("span", { className: "pp-gsecmark pp-gsecmark-none" }, "—"),
                  h("b", null, section.title),
                  section.unsure ? h("i", null, "unsure") : null,
                  h("span", { className: "pp-as" }, section.answers.length + " answer" + (section.answers.length === 1 ? "" : "s")),
                  open.length && section.key !== "unread"
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "pp-segbtn",
                          disabled: Boolean(busy),
                          onClick: () => decide(open.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "group", "group"),
                        },
                        busy === "group" ? "Accepting…" : "Accept " + open.length + " at " + label(open[0].suggestion.score),
                      )
                    : null,
                ),
                section.answers.map(card),
              );
            }),
          ),
          side,
        ),
        [
          h(
            "span",
            { className: "pp-as", key: "hint" },
            busy ? "Writing…" : "j / k move · " + scale.filter((value) => Number.isInteger(value) && value < 10).join(" ") + " give a mark · Enter takes the suggestion · Esc closes",
          ),
          h(
            "button",
            {
              type: "button",
              key: "all-q",
              className: "pp-segbtn",
              disabled: Boolean(busy) || !allHere.length,
              onClick: () => decide(allHere.map((answer) => ({ student: answer.student, score: answer.suggestion.score })), "all", "all"),
            },
            "Accept all " + allHere.length + " for " + qName,
          ),
          h(
            "button",
            {
              type: "button",
              key: "all",
              className: "pp-primary",
              disabled: Boolean(busy) || !allEverywhere.length,
              onClick: () => decide(allEverywhere, "all", "all"),
            },
            busy === "all" ? "Accepting…" : "Accept all " + allEverywhere.length + " suggestions",
          ),
        ],
      );
    }

    /** One page of a paper, over the grading view: the handwriting at a readable size. */
    function GradePage(props) {
      return ReactDOM.createPortal(
        h(
          "div",
          { className: "pp-veil pp-gbig", onMouseDown: props.onClose },
          h("img", { src: props.src, alt: "The page", className: "pp-gbigimg" }),
        ),
        document.body,
      );
    }

    // ── client/scans.js

    /**
     * Paper exams: where a pile stands, and who each paper is.
     *
     * Drawn here rather than in the frame for Integrations' reason — it calls
     * back. The document is server/scans.js; every figure in it arrived computed.
     * Match is the one step drawn in full, because it is the one only the
     * professor can do; the others are a sentence and a press that asks the
     * assistant, since reading, proposing a rubric and grading are its work.
     */
    function ScansTab(props) {
      const [pile, setPile] = React.useState(props.pile || "");
      const [tick, setTick] = React.useState(0);
      const [state, setState] = React.useState({ phase: "loading", value: null });
      const [busy, setBusy] = React.useState(null);
      const [said, setSaid] = React.useState(null);
      const [focus, setFocus] = React.useState(0);
      const [reviewing, setReviewing] = React.useState(false);
      const [grading, setGrading] = React.useState(false);
      // The step whose detail is open; null follows the pile's current step.
      const [openStep, setOpenStep] = React.useState(null);
      const names = props.names;

      const query = (path) =>
        scoped(
          BASE + path + "?run=" + encodeURIComponent(props.runId) +
            (pile ? "&assessment=" + encodeURIComponent(pile) : ""),
          props.sessionId,
        );

      React.useEffect(() => {
        let live = true;
        fetch(query("/api/scans") + (names ? "&names=1" : "") + "&r=" + props.revision + "." + tick, {
          headers: { accept: "application/json" },
        })
          .then((response) => response.json())
          .then((value) => live && setState({ phase: "ready", value }))
          .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
        return () => {
          live = false;
        };
      }, [props.runId, pile, names, props.revision, tick]);

      const doc = state.value;
      const assessmentId = doc && doc.assessment ? doc.assessment.id : "";

      const post = (path, body, label, done) => {
        if (busy) return;
        setBusy(label);
        setSaid(null);
        fetch(query(path).replace(/assessment=[^&]*/, "") + "&assessment=" + encodeURIComponent(assessmentId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        })
          .then((response) => response.json())
          .then((result) => {
            setBusy(null);
            const stale = /no route \/api\/scans/.test(String(result.error || ""));
            setSaid({
              error: Boolean(result.error) || !result.ok,
              text: stale
                ? "The harness was started before this tab existed. Restart it, then try again."
                : result.error || result.output || "Done.",
            });
            setTick((value) => value + 1);
            props.onWrite();
            if (done && !result.error && result.ok) done();
          })
          .catch((error) => {
            setBusy(null);
            setSaid({ error: true, text: String(error) });
          });
      };
      const assign = (paper, to, label) =>
        post("/api/scans/assign", Object.assign({ pages: paper.pages, file: paper.file }, to), label);

      if (state.phase === "loading") return h(Message, null, "Reading the pile…");
      if (doc.error) {
        return h(
          Message,
          { error: true },
          /no route \/api\/scans/.test(doc.error)
            ? "The harness was started before this tab existed. Restart it to see scanned papers here."
            : doc.error,
        );
      }
      if (!doc.assessment) {
        return h(
          Message,
          null,
          "No scanned pile for " + props.runId + " yet. Upload the scans; the assistant works out " +
            "which assessment they are and files them, and they appear here.",
        );
      }

      const who = (id, name) => (name ? name + " · " + id : id);
      const cropUrl = (paper) =>
        query("/api/scans/crop").replace(/assessment=[^&]*/, "") +
        "&assessment=" + encodeURIComponent(assessmentId) +
        "&file=" + encodeURIComponent(paper.file) +
        "&pages=" + encodeURIComponent(paper.pages);
      // A harness started before `also` and `clash` existed serves papers
      // without them; the tab draws those as having none, not as a crash.
      doc.papers.forEach((paper) => {
        paper.also = paper.also || [];
        paper.clash = (paper.clash || []).map((entry) => Object.assign({ page_list: [] }, entry));
        paper.page_list = paper.page_list || [];
      });
      const pageUrl = (paper, page) =>
        query("/api/scans/crop").replace(/assessment=[^&]*/, "") +
        "&assessment=" + encodeURIComponent(assessmentId) +
        "&file=" + encodeURIComponent(paper.file) +
        "&pages=" + encodeURIComponent(paper.pages) +
        "&whole=" + page;
      // Two papers for one student, drawn whole and side by side: a spoiled
      // copy is the nearly blank one, which no name on either can say.
      const sideBySide = (paper) =>
        h(
          "div",
          { className: "pp-clash" },
          [{ file: paper.file, pages: paper.pages, page_list: paper.page_list, own: true }].concat(paper.clash).map((entry) =>
            h(
              "figure",
              { key: entry.file + "#" + entry.pages },
              h(
                "div",
                { className: "pp-clashpages" },
                entry.page_list.map((page) =>
                  h("img", { key: page, loading: "lazy", alt: "Page " + page + " of " + entry.file, src: pageUrl(entry, page) }),
                ),
              ),
              h("figcaption", null, (entry.own ? "This paper" : "The other") + " · pp. " + entry.pages),
            ),
          ),
        );
      const reviewable = doc.papers.filter(
        (paper) =>
          (paper.resolved && !paper.pinned && paper.has_name && (paper.lane === "check" || paper.lane === "placed")) ||
          (paper.lane === "held" && paper.candidates.length),
      ).length;
      const work = doc.papers.filter((paper) => paper.lane === "check" || paper.lane === "held");
      const at = Math.min(focus, Math.max(0, work.length - 1));
      const unplaced = doc.class.filter((entry) => !entry.placed);
      const placedPeople = doc.class.filter((entry) => entry.placed);

      const picker = (paper, label) => {
        const id = "pick-" + paper.file + "-" + paper.pages;
        return h(
          "select",
          {
            key: id,
            "aria-label": label,
            value: "",
            disabled: Boolean(busy),
            onChange: (event) => {
              if (event.target.value) assign(paper, { student: event.target.value }, paper.pages);
            },
          },
          h("option", { value: "" }, label + "…"),
          h(
            "optgroup",
            { label: "No paper yet" },
            unplaced.map((entry) => h("option", { value: entry.student, key: entry.student }, who(entry.student, entry.name))),
          ),
          h(
            "optgroup",
            { label: "Already have a paper" },
            placedPeople.map((entry) => h("option", { value: entry.student, key: entry.student }, who(entry.student, entry.name))),
          ),
        );
      };

      const card = (paper, index) => {
        const key = paper.file + "|" + paper.pages;
        const primary =
          paper.lane === "check"
            ? () => assign(paper, { student: paper.resolved }, paper.pages)
            : paper.candidates.length
              ? () => assign(paper, { student: paper.candidates[0].student }, paper.pages)
              : null;
        const pending = busy === paper.pages;
        return h(
          "div",
          {
            key,
            className: "pp-card" + (index === at ? " pp-focus" : ""),
            tabIndex: 0,
            onFocus: () => setFocus(index),
          },
          names && doc.crops
            ? h("img", {
                className: "pp-crop",
                alt: "The top of page " + paper.pages.split("-")[0] + ", where the name is written",
                loading: "lazy",
                src: cropUrl(paper),
              })
            : null,
          h(
            "div",
            null,
            names
              ? paper.written
                ? h("span", null, "Written: ", h("span", { className: "pp-written" }, paper.written))
                : h("span", null, paper.has_name ? "A number is written" : "No name written")
              : h("span", null, "Pages " + paper.pages),
          ),
          names && paper.also.length
            ? h("div", { className: "pp-cardmeta" }, "Also written: ", paper.also.map((text) => "“" + text + "”").join(", "))
            : null,
          paper.lane === "check"
            ? h(
                "div",
                { className: "pp-cardmeta" },
                (paper.match === "partial" ? "Placed on one word of the name: " : "Placed on a close spelling: ") +
                  who(paper.resolved, paper.resolved_name),
              )
            : h("div", { className: "pp-cardmeta" }, paper.problem || "Not placed yet"),
          names && doc.crops && paper.clash.length ? sideBySide(paper) : null,
          paper.lane === "held" && paper.candidates.length
            ? h(
                "div",
                { className: "pp-cardmeta" },
                "Nearest: " + paper.candidates.map((entry) => who(entry.student, entry.name)).join("; "),
              )
            : null,
          h(
            "div",
            { className: "pp-actions" },
            paper.lane === "check"
              ? h(
                  "button",
                  { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: primary },
                  "Confirm",
                )
              : null,
            paper.lane === "held"
              ? paper.candidates.map((entry) =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      key: entry.student,
                      disabled: Boolean(busy),
                      onClick: () => assign(paper, { student: entry.student }, paper.pages),
                    },
                    "It's " + (entry.name ? entry.name.split(/\s+/).slice(0, 2).join(" ") : entry.student),
                  ),
                )
              : null,
            paper.clash.length
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy),
                    title: "This one is not their paper — a copy they started and gave up, handed in with the real one",
                    onClick: () =>
                      assign(paper, { skip: "spoiled copy — the paper is pp. " + paper.clash.map((entry) => entry.pages).join(", ") }, paper.pages),
                  },
                  "Spoiled copy",
                )
              : null,
            picker(paper, paper.lane === "check" ? "Someone else" : paper.clash.length ? "Someone else's" : "Pick from class"),
            paper.lane === "held" && !paper.clash.length
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy),
                    title: "Not one of this run's students — a visitor, or a sheet that is nobody's",
                    onClick: () => assign(paper, { skip: "not a student of this run" }, paper.pages),
                  },
                  "Not a student",
                )
              : null,
            pending ? h("span", { className: "pp-as" }, "Placing…") : null,
          ),
        );
      };

      const onKey = (event) => {
        if (event.target.tagName === "SELECT" || event.target.tagName === "INPUT") return;
        if (event.key === "j" || event.key === "ArrowDown") {
          setFocus((value) => Math.min(value + 1, work.length - 1));
          event.preventDefault();
        } else if (event.key === "k" || event.key === "ArrowUp") {
          setFocus((value) => Math.max(value - 1, 0));
          event.preventDefault();
        } else if (event.key === "Enter" && event.target.classList.contains("pp-card")) {
          const paper = work[at];
          if (!paper) return;
          if (paper.lane === "check") assign(paper, { student: paper.resolved }, paper.pages);
          else if (paper.candidates.length) assign(paper, { student: paper.candidates[0].student }, paper.pages);
          event.preventDefault();
        }
      };

      // A harness from before `now` existed sends none; the tab still draws.
      const now = doc.now || { step: doc.next || null, index: 0, total: doc.stages.length, title: "", body: "", whose: "you", action: null };
      const shown = openStep || now.step || "canvas";
      const stageOf = (id) => doc.stages.find((stage) => stage.id === id) || null;
      const shownStage = stageOf(shown);
      const gradable = doc.answers > 0;
      const check = work.filter((paper) => paper.lane === "check");
      const held = work.filter((paper) => paper.lane === "held");
      const placed = doc.papers.filter((paper) => paper.lane === "placed");
      const skipped = doc.papers.filter((paper) => paper.lane === "skipped");

      const WHOSE = { you: "Your move", assistant: "Assistant", done: "Done" };
      const whose = (value) => h("span", { className: "pp-whose pp-whose-" + value }, WHOSE[value] || value);
      const choosePile = (id) => {
        setOpenStep(null);
        setFocus(0);
        setPile(id);
      };

      // The buttons each step offers. `primary` when it is the one action of
      // the headline; the same button in a step's detail is secondary, so a
      // view never has two primaries.
      const readButton = (primary) =>
        h(
          "button",
          {
            type: "button",
            key: "read",
            className: primary ? "pp-primary" : "pp-segbtn",
            disabled: Boolean(busy),
            title: "Runs `scans read`, then `scans record`: every answer recorded as a draft, the low-confidence ones listed",
            onClick: () => post("/api/scans/read", {}, "read"),
          },
          busy === "read" ? "Reading… a few minutes for a class" : "Read and record the answers",
        );
      const gradeButton = (primary) =>
        h(
          "button",
          {
            type: "button",
            key: "grade",
            className: primary ? "pp-primary" : "pp-segbtn",
            disabled: Boolean(busy),
            title: "Every answer to each question as cards over the conversation — choose the rubric, then mark and decide",
            onClick: () => setGrading(true),
          },
          "Open the Grade view",
        );
      const askButton = (kind, primary) =>
        STEP_PROMPTS[kind]
          ? h(
              "button",
              {
                type: "button",
                key: "ask-" + kind,
                className: (primary ? "pp-primary" : "pp-segbtn") + " pp-chat",
                onClick: () => props.ask(STEP_PROMPTS[kind](props.runId, assessmentId)),
              },
              kind === "grade" ? "Ask the assistant for suggestions" : "Ask the assistant",
            )
          : null;
      const canvasPanel = (lead) =>
        doc.canvas && doc.canvas.ready > 0
          ? h(CanvasMarks, {
              key: "canvas-" + assessmentId,
              lead: lead,
              runId: props.runId,
              sessionId: props.sessionId,
              assessmentId: assessmentId,
              title: doc.assessment.title,
              ask: props.ask,
              canvas: doc.canvas,
              onSent: () => {
                setTick((value) => value + 1);
                props.onWrite();
              },
            })
          : null;

      const nowActions = () => {
        if (now.action === "read") return [readButton(true)];
        if (now.action === "ask") return [askButton(now.ask, true)];
        if (now.action === "grade") return [gradeButton(true), now.ask ? askButton(now.ask, false) : null];
        if (now.action === "match")
          return [
            h(
              "button",
              { type: "button", key: "match", className: "pp-primary", onClick: () => setOpenStep("match") },
              "Show the papers",
            ),
          ];
        return [];
      };

      // The headline: the one step to work on, why, and its one action.
      const nowCard = h(
        "section",
        { className: "pp-now", "aria-label": "What " + doc.assessment.title + " needs now" },
        h(
          "div",
          { className: "pp-nowkick" },
          h("span", null, now.step ? "Step " + (now.index + 1) + " of " + now.total + " · " + ((stageOf(now.step) || {}).label || now.step) : "All " + now.total + " steps done"),
          whose(now.whose),
        ),
        h("h3", null, now.title),
        h("p", null, now.body),
        now.action === "canvas"
          ? canvasPanel(true)
          : h("div", { className: "pp-actions" }, nowActions()),
      );

      // Every pile, each saying where it is: the overview the dropdown hid.
      const pileList = h(
        "div",
        { className: "pp-piles", role: "list", "aria-label": "Scanned exams in " + props.runId },
        doc.piles.map((entry) =>
          h(
            "button",
            {
              type: "button",
              role: "listitem",
              key: entry.id,
              className: "pp-pile",
              "aria-current": entry.id === assessmentId,
              onClick: () => choosePile(entry.id),
            },
            h(
              "span",
              { className: "pp-pilename" },
              h("b", null, entry.title),
              h("span", null, entry.now ? entry.now.phrase : ""),
            ),
            entry.progress
              ? h(
                  "span",
                  { className: "pp-pilebar", "aria-hidden": "true" },
                  entry.progress.map((state, index) =>
                    h("i", { key: index, className: state === "done" ? "pp-s-done" : entry.now && index === entry.now.index ? "pp-s-now" : "" }),
                  ),
                )
              : null,
            entry.now ? whose(entry.now.whose) : null,
          ),
        ),
      );

      // The seven steps: done, the one to work on, and the rest; each opens
      // its own detail.
      const stepper = h(
        "div",
        { className: "pp-stepper", role: "list", "aria-label": doc.assessment.title + ": the seven steps" },
        doc.stages.map((stage, index) =>
          h(
            "button",
            {
              type: "button",
              role: "listitem",
              key: stage.id,
              className: "pp-stepbtn",
              "aria-pressed": stage.id === shown,
              title: stage.label + ": " + stage.detail,
              onClick: () => setOpenStep(stage.id),
            },
            h(
              "span",
              {
                className:
                  "pp-dot" +
                  (stage.state === "done" ? " pp-dot-done" : stage.id === now.step ? " pp-dot-now" : stage.state === "yours" ? " pp-dot-yours" : ""),
                "aria-hidden": "true",
              },
              stage.state === "done" ? "✓" : String(index + 1),
            ),
            h("span", null, stage.label),
          ),
        ),
      );

      // Match's tools: the papers that need a person, the review of every
      // match, and what was placed.
      const matchTools = () => [
        !names
          ? h(
              Message,
              { key: "pseudonyms" },
              "Pseudonyms are showing, so the handwritten names and their crops are hidden. Press Names to match papers.",
            )
          : reviewable
            ? h(
                "div",
                { className: "pp-actions", key: "review" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy),
                    title: "Every name the pile was matched on, as big cards — confirm them all at once, reject the wrong ones",
                    onClick: () => setReviewing(true),
                  },
                  "Review all " + reviewable + " name matches",
                ),
              )
            : null,
        check.length
          ? h(
              "div",
              { className: "pp-lane", key: "check-lane" },
              "Check",
              h("span", null, "· " + check.length + " placed on a close spelling or one word of the name — confirm, or say who it is"),
            )
          : null,
        ...check.map((paper) => card(paper, work.indexOf(paper))),
        held.length
          ? h("div", { className: "pp-lane", key: "held-lane" }, "Held", h("span", null, "· " + held.length + " not placed"))
          : null,
        ...held.map((paper) => card(paper, work.indexOf(paper))),
        work.length ? h("div", { className: "pp-cardmeta", key: "keys" }, "j / k to move between papers, Enter to confirm") : null,
        h(
          "details",
          { className: "pp-folded", key: "placed" },
          h(
            "summary",
            null,
            placed.length + " placed" + (skipped.length ? " · " + skipped.length + " set aside" : "") + " · " + doc.missing + " enrolled with no paper",
          ),
          h(
            "ul",
            null,
            placed.map((paper) =>
              h(
                "li",
                { key: paper.file + paper.pages },
                "pp. " + paper.pages + " → " + who(paper.resolved, paper.resolved_name) +
                  (paper.pinned ? " (confirmed)" : paper.match === "words" ? " (by its words)" : paper.match === "partial" ? " (one word)" : ""),
              ),
            ),
            skipped.map((paper) => h("li", { key: paper.file + paper.pages }, "pp. " + paper.pages + " — " + paper.skip)),
          ),
          h(
            "div",
            { className: "pp-actions" },
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy),
                title: "Run `scans apply` again — after editing plan.yaml by hand, say",
                onClick: () => post("/api/scans/apply", {}, "apply"),
              },
              busy === "apply" ? "Applying…" : "Re-apply the plan",
            ),
          ),
        ),
      ];

      // The open step's detail: what it says, and its tools when they are not
      // already the headline's action.
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
      const detail = shownStage
        ? h(
            "section",
            { className: "pp-stepdetail", "aria-label": shownStage.label },
            h("b", null, shownStage.label),
            " — " + shownStage.detail,
            stepTools(),
          )
        : null;

      return h(
        "div",
        { className: "pp-scroll", onKeyDown: onKey },
        pileList,
        nowCard,
        stepper,
        detail,
        said
          ? h("pre", { className: "pp-approveout" + (said.error ? " pp-approveerr" : "") }, said.text)
          : null,
        grading
          ? h(GradeBoard, {
              runId: props.runId,
              sessionId: props.sessionId,
              assessmentId: assessmentId,
              title: doc.assessment.title,
              names: names,
              revision: props.revision,
              ask: props.ask,
              onWrite: () => {
                setTick((value) => value + 1);
                props.onWrite();
              },
              onClose: () => setGrading(false),
            })
          : null,
        reviewing && names
          ? h(MatchReview, {
              papers: doc.papers,
              title: doc.assessment.title,
              crops: doc.crops,
              cropUrl: cropUrl,
              busy: busy === "review",
              onClose: () => setReviewing(false),
              onSubmit: (papers) =>
                post("/api/scans/assign", { papers: papers }, "review", () => setReviewing(false)),
            })
          : null,
      );
    }

    /**
     * The Scans tab as a window, opened on one pile from a chip in course mode.
     *
     * The same component the tab draws, over course mode rather than in the
     * column, so the professor checks a pile and comes back to the week they were
     * reading. Escape is heard in the bubbling phase: the Grade view and the
     * match review inside it take it first, in capture, and stop it there.
     */
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
            },
          },
          h(
            "div",
            {
              className: "pp-modal pp-scansmodal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Scans",
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h("div", { className: "pp-modaltitle" }, "Scans · " + props.runId),
              h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: close }, "×"),
            ),
            h(ScansTab, {
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              ask: props.ask,
              onWrite: props.onWrite,
              revision: props.revision,
              pile: props.pile,
            }),
          ),
        ),
        document.body,
      );
    }

    // ── client/defence-turn.js

    /**
     * When an answer has ended, from the microphone's level alone (AGT-1).
     *
     * Pure, one call per sample, so it can be tested without a microphone. It
     * waits for speech — the level above the room's noise floor for 0.4 s,
     * so a cough or a chair is not an answer — and then for silence: 2.5 s
     * below the floor after speech ends the take. Thinking pauses mid-answer
     * are shorter than that in practice; a student who needs longer presses
     * nothing and the professor presses Space when they are done instead.
     *
     * The floor is learnt, not configured: it follows the level while nobody
     * is speaking, and the threshold is three times it, never below a fixed
     * minimum so a silent room does not make breathing an answer. Three
     * minutes ends a take whatever happens, so a forgotten desk does not
     * record a lecture.
     *
     * The first 0.8 s of a take are not listened to. Without that, the tail of
     * the previous answer — the last word as the professor pressed Space —
     * became the start of the next one, and the next question "ended" on the
     * silence after it. What this cannot tell apart is a voice that is not the
     * student's: a professor who reads the question aloud is heard as the
     * answer. Hands-free therefore expects the question to be read off the
     * screen (AGT-4) until AGT-6 separates the two voices.
     */
    const TURN = { settleMs: 800, minSpeechMs: 400, silenceMs: 2500, capMs: 180000, minThreshold: 0.012, ratio: 3 };
    function turnStep(state, level, now, options) {
      const o = Object.assign({}, TURN, options || {});
      const s = state || {
        phase: "waiting",
        floor: Math.min(level, o.minThreshold),
        voicedSince: null,
        silentSince: null,
        startedAt: now,
      };
      const threshold = Math.max(o.minThreshold, s.floor * o.ratio);
      const loud = level > threshold;
      const result = (next, end) => ({
        state: next,
        end: end,
        threshold: threshold,
        silentFor: next.silentSince === null ? 0 : now - next.silentSince,
      });
      if (now - s.startedAt >= o.capMs) return result(s, "cap");
      if (now - s.startedAt < o.settleMs) return result(s, null);
      if (s.phase === "waiting") {
        if (!loud) {
          // Only quiet samples teach the floor, so speech never raises it.
          return result(Object.assign({}, s, { voicedSince: null, floor: s.floor * 0.95 + level * 0.05 }), null);
        }
        const voicedSince = s.voicedSince === null ? now : s.voicedSince;
        return now - voicedSince >= o.minSpeechMs
          ? result(Object.assign({}, s, { phase: "speaking", voicedSince: voicedSince, silentSince: null }), null)
          : result(Object.assign({}, s, { voicedSince: voicedSince }), null);
      }
      if (loud) return result(Object.assign({}, s, { silentSince: null }), null);
      const silentSince = s.silentSince === null ? now : s.silentSince;
      const next = Object.assign({}, s, { silentSince: silentSince, floor: s.floor * 0.98 + level * 0.02 });
      return result(next, now - silentSince >= o.silenceMs ? "silence" : null);
    }

    // ── client/defence-dots.js

    /*
     * The desk's dots: `dots-swarm` (MIT, dotsui.dev), bundled into
     * vendor/dots-swarm.js by vendor/build-dots.mjs and loaded the first time a
     * desk opens. The bundle uses this pane's React — it must be the same
     * instance the harness renders with, or its hooks fail — handed over on a
     * global before the script runs. If it cannot load, the desk simply has no
     * animation; the level meter still says what the microphone hears.
     */
    let dotsLoading = null;
    const loadDots = () => {
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

    /** Which shape the dots take for what the desk is doing. */
    const DOT_SHAPES = {
      idle: "microphone",
      waiting: "microphone",
      reading: "message",
      speaking: "equalizer",
      professor: "headphones",
      thinking: "thought-bubble",
      proposing: "thought-bubble",
      paused: "pause",
      done: "check",
    };

    /**
     * The dots: a microphone while the desk waits for the student, an
     * equalizer while they speak, a thought bubble while the next question is
     * chosen. Their colour follows the recording light, so the animation and
     * the light never disagree about whether the desk is listening.
     */
    function ListeningDots(props) {
      const [dots, setDots] = React.useState(window.__professorPaneDots || null);
      React.useEffect(() => {
        if (dots) return undefined;
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
          color: listening ? "#c43030" : props.phase === "professor" ? "#2f6fd6" : "#8d8f96",
          // The student's voice drives the swarm: louder is livelier.
          speed: props.phase === "speaking" ? 1 + Math.min(2, (props.level || 0) * 20) : 0.6,
          choreography: "flow",
          transitionDuration: 0.6,
          style: { width: props.size || 64, height: props.size || 64 },
          label: shape,
        }),
      );
    }

    // ── client/defence-marks.js

    /**
     * The stretches, and the key that marks them.
     *
     * `marks.current` is `{ origin, held, ranges }`: `origin` the take's start,
     * `held` when the key went down, `ranges` the closed stretches. A ref, not
     * state, because the hands-free loop and the caption stream read it ten times
     * a second and must see the latest without re-subscribing.
     */
    function useProfessorMarks() {
      const marks = React.useRef({ origin: null, held: null, ranges: [] });
      const [professorTalking, setProfessorTalking] = React.useState(false);
      const openMarks = (origin) => {
        marks.current = { origin, held: marks.current.held !== null ? origin : null, ranges: [] };
      };
      const closeMarks = () => {
        const current = marks.current;
        const now = Date.now();
        if (current.origin !== null && current.held !== null) current.ranges.push([(current.held - current.origin) / 1000, (now - current.origin) / 1000]);
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
          current.ranges.push([Math.max(0, (current.held - current.origin) / 1000), (Date.now() - current.origin) / 1000]);
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
        // Letting go anywhere, or leaving the window, ends the stretch: a key
        // stuck "down" would hand the rest of the answer to the professor.
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

    /** The hold-to-speak button, for a professor without a free hand on the keyboard. */
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
          title: "Hold while you speak, so your words are not taken for the student's answer.",
        },
        props.talking ? "You are speaking — not the answer" : "Hold to speak (P)",
      );
    }

    // ── client/defence-captions.js

    const CAPTION_MS = 5000;

    /** Float samples at the microphone's rate to 16-bit PCM at the stream's, as base64. */
    const pcmBase64 = (input, ratio, silent) => {
      const length = Math.floor(input.length / ratio);
      const pcm = new Int16Array(length);
      if (!silent) {
        for (let index = 0; index < length; index += 1) {
          // The mean of the samples this one stands for: a plain low-pass.
          const from = Math.floor(index * ratio);
          const to = Math.min(input.length, Math.floor((index + 1) * ratio));
          let sum = 0;
          for (let at = from; at < to; at += 1) sum += input[at];
          const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
          pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
        }
      }
      const bytes = new Uint8Array(pcm.buffer);
      let binary = "";
      for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000));
      return btoa(binary);
    };

    /**
     * The captions and the loop that makes them.
     *
     * `captions` is `{ question, pieces: [{ index, text }], partial, mode, from }`
     * for the take in hand. `marks` and `whole` are the desk's refs: nothing is
     * captioned while the professor holds P, or while a whole defence is paused.
     * `endpoint` builds a desk route for this student.
     */
    function useCaptions(endpoint, marks, whole) {
      const [captions, setCaptions] = React.useState(null);
      const [liveCaptions, setLiveCaptions] = React.useState(true);
      const liveCaptionsRef = React.useRef(true);
      liveCaptionsRef.current = liveCaptions;
      const captionLoop = React.useRef(null);

      /*
       * A second recorder on the same microphone, restarted every few seconds
       * so each piece is a whole little file any provider can read; a piece in
       * which somebody spoke is sent for a caption, a silent one is not.
       */
      const startCaptions = (stream, questionId, type) => {
        stopCaptions();
        setCaptions({ question: questionId, pieces: [], partial: "", mode: null });
        if (!liveCaptionsRef.current) return;
        const loop = { active: true, index: 0, loud: false, recorder: null, timer: null, cleanup: null };
        captionLoop.current = loop;
        // AGT-8: stream where the connection can (Scribe), word by word; else,
        // or if streaming fails, the five-second pieces below.
        fetch(endpoint("/api/defence/realtime"), { method: "POST" })
          .then((response) => response.json())
          .then((result) => {
            if (!loop.active) return;
            if (result.session) startStreaming(loop, stream, result.session, questionId, type);
            else startPieces(loop, stream, questionId, type);
          })
          .catch(() => loop.active && startPieces(loop, stream, questionId, type));
      };

      /*
       * Streaming captions (AGT-8): the microphone, brought down to 16 kHz
       * 16-bit PCM, straight to the provider's socket, with a single-use token
       * the server minted; the key stays on the server. While the professor
       * holds P, silence is sent instead, so their words are never captioned.
       * A socket that fails before it opens hands the take to the pieces.
       */
      const startStreaming = (loop, stream, session, questionId, type) => {
        let socket;
        try {
          socket = new WebSocket(session.url);
        } catch {
          startPieces(loop, stream, questionId, type);
          return;
        }
        let opened = false;
        let audio = null;
        let source = null;
        let node = null;
        const teardown = () => {
          try {
            if (node) node.disconnect();
            if (source) source.disconnect();
            if (audio && audio.state !== "closed") audio.close();
          } catch {}
          node = source = audio = null;
        };
        // A socket that fails before it opens fires both error and close: one
        // fallback, not two caption loops.
        const fallBack = () => {
          teardown();
          if (loop.fellBack || opened || !loop.active) return;
          loop.fellBack = true;
          startPieces(loop, stream, questionId, type);
        };
        socket.onopen = () => {
          opened = true;
          setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "streaming" }) : current));
          try {
            audio = new AudioContext();
            source = audio.createMediaStreamSource(stream);
            node = audio.createScriptProcessor(4096, 1, 1);
            const ratio = audio.sampleRate / session.sampleRate;
            node.onaudioprocess = (event) => {
              // A paused whole defence sends nothing: the gap is not in the recording either.
              if (socket.readyState !== 1 || whole.current.paused !== null) return;
              socket.send(
                JSON.stringify({
                  message_type: "input_audio_chunk",
                  audio_base_64: pcmBase64(event.inputBuffer.getChannelData(0), ratio, marks.current.held !== null),
                  commit: false,
                  sample_rate: session.sampleRate,
                }),
              );
            };
            source.connect(node);
            // A script processor runs only while connected onwards; it writes
            // nothing, so the speakers hear silence.
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
            setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { partial: String(message.text || "") }) : current));
          } else if (kind === "committed_transcript") {
            const text = String(message.text || "").trim();
            const index = loop.index;
            loop.index += 1;
            setCaptions((current) =>
              current && current.question === questionId
                ? Object.assign({}, current, { partial: "", pieces: text ? current.pieces.concat([{ index, text }]) : current.pieces })
                : current,
            );
          } else if (/error|exceeded|limited|exhausted/.test(kind)) {
            setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "failed:" + (message.error || kind) }) : current));
            socket.close();
          }
        };
        socket.onerror = () => fallBack();
        socket.onclose = () => fallBack();
        loop.cleanup = () => {
          teardown();
          if (socket.readyState === 1) {
            // Ask for the last words before closing.
            try {
              socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: session.sampleRate }));
            } catch {}
            setTimeout(() => socket.close(), 1500);
          } else if (socket.readyState === 0) {
            socket.close();
          }
        };
      };

      /** The five-second pieces (AGT-5): any provider, a caption per piece in which someone spoke. */
      const startPieces = (loop, stream, questionId, type) => {
        setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "pieces" }) : current));
        const cycle = () => {
          if (!loop.active) return;
          let piece;
          try {
            piece = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
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
        // The last piece is still captioned: the answer's final words.
        if (loop.recorder && loop.recorder.state !== "inactive") loop.recorder.stop();
        captionLoop.current = null;
      };
      /** Someone is audibly speaking — not the professor holding P — so this piece is worth a caption. */
      const heard = (level, threshold) => {
        const loop = captionLoop.current;
        if (loop && level > threshold && marks.current.held === null && whole.current.paused === null) loop.loud = true;
      };
      const caption = (questionId, index, blob) =>
        fetch(endpoint("/api/defence/caption", "&question=" + encodeURIComponent(questionId)), {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error || !String(result.text || "").trim()) return;
            setCaptions((current) =>
              current && current.question === questionId
                ? Object.assign({}, current, {
                    pieces: current.pieces.concat([{ index, text: String(result.text).trim() }]).sort((a, b) => a.index - b.index),
                  })
                : current,
            );
          })
          .catch(() => {});

      return { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard };
    }

    /** The captions, under whatever is recording. */
    function CaptionsLine(props) {
      const captions = props.captions;
      return captions && captions.question === props.question && (captions.pieces.length || captions.partial)
        ? h(
            "div",
            { className: "pp-dcaption", "aria-live": "polite" },
            h("span", { className: "pp-dim" }, captions.mode === "streaming" ? "Live: " : "Live, every few seconds: "),
            captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
            captions.partial ? h("span", { className: "pp-dpartial" }, " " + captions.partial) : null,
          )
        : null;
    }

    // ── client/defence-screen.js

    /** Kept in step with `screenChannel` in server/student-screen.js by hand. */
    const screenChannelName = (assessmentId, studentId) => "professor-pane-defence:" + assessmentId + ":" + studentId;

    /**
     * The channel to the student's screen, and what the desk says over it.
     *
     * `screen.current` holds the channel; `ready` once the professor has clicked
     * the screen (browsers speak only after a click); `last`, the state to repeat
     * to a screen opened late; `said`, a counter naming each read-aloud so its
     * "spoken" reply can be matched; `waiting` and `onSpoken`, the read-aloud in
     * flight. `dataRef` is the desk's latest session payload.
     */
    function useStudentScreen(props, dataRef) {
      const screen = React.useRef({ channel: null, open: false, ready: false, last: null, said: 0, waiting: null, onSpoken: null });
      const [screenState, setScreenState] = React.useState("closed"); // closed | open | ready
      const [readAloud, setReadAloud] = React.useState(false);
      const readAloudRef = React.useRef(false);
      readAloudRef.current = readAloud && screenState === "ready";

      /*
       * What the student's screen shows. Only the question being asked, by
       * number, and whether it is recording: never a reason, a criterion, a
       * proposal still waiting, or what comes next. Returns the text sent,
       * for the read-aloud timeout.
       */
      const showOnScreen = (questionId, phase, speak, picked) => {
        const questions = (dataRef.current && dataRef.current.questions) || [];
        // In a whole defence the take stays Q0, so the student's own words
        // still show under it; `picked` is the prepared question the
        // professor said they are asking, shown in its place.
        const entry = (picked && questions.find((q) => q.id === picked)) || (questionId ? questions.find((q) => q.id === questionId) : null);
        const prepared = questions.filter((q) => q.kind !== "follow_up" && q.kind !== "whole");
        const label = !entry
          ? ""
          : entry.kind === "follow_up"
            ? "Follow-up question"
            : entry.kind === "whole"
              ? "The defence"
              : "Question " + (prepared.findIndex((q) => q.id === entry.id) + 1) + " of " + prepared.length;
        const languages = (dataRef.current && dataRef.current.languages) || [];
        const state = {
          type: "state",
          question: questionId || null,
          title: (dataRef.current && dataRef.current.assessment && dataRef.current.assessment.title) || "",
          label,
          // The whole defence has no one question to show: the professor asks aloud.
          text: entry ? (entry.kind === "whole" ? "Answer the professor's questions as they come." : entry.text) : "",
          phase,
          lang: languages.length === 1 ? languages[0] : undefined,
        };
        if (speak) {
          screen.current.said += 1;
          state.speak = true;
          state.id = screen.current.said;
        }
        // A late screen is told where things stand, but never asked to speak again.
        screen.current.last = Object.assign({}, state, { speak: false });
        if (screen.current.channel) screen.current.channel.postMessage(state);
        return state.text;
      };

      React.useEffect(() => {
        if (typeof BroadcastChannel === "undefined") return undefined;
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
        // A screen silent for five seconds has been closed, whatever it said.
        const watch = setInterval(() => {
          if (screen.current.open && Date.now() - (screen.current.seen || 0) > 5000) {
            screen.current.open = false;
            screen.current.ready = false;
            setScreenState("closed");
          }
        }, 1000);
        return () => {
          clearInterval(watch);
          channel.postMessage({ type: "state", phase: "idle" });
          channel.close();
          screen.current.channel = null;
        };
      }, [props.assessment, props.student]);

      const openScreen = () =>
        window.open(
          scoped(BASE + "/defence/screen?assessment=" + encodeURIComponent(props.assessment) + "&student=" + encodeURIComponent(props.student), props.sessionId),
          "defence-screen-" + props.student,
          "popup,width=1100,height=700",
        );

      return { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen };
    }

    /**
     * The student's screen: open it, see that it is ready, and choose whether it
     * reads each question aloud.
     */
    function ScreenRow(props) {
      const screenState = props.screenState;
      return h(
        "div",
        { className: "pp-approverow" },
        h("button", { type: "button", className: "pp-segbtn", onClick: props.onOpen }, screenState === "closed" ? "Open student screen" : "Show student screen"),
        h(
          "span",
          { className: screenState === "ready" ? "pp-dim" : "pp-dwarn" },
          screenState === "closed"
            ? typeof BroadcastChannel === "undefined"
              ? "this browser cannot drive a second window"
              : "not open — the question is then only on this screen"
            : screenState === "open"
              ? "open — click it once, then move it to the screen the student sees"
              : "ready: it shows the question being asked and nothing else",
        ),
        h(
          "label",
          { className: "pp-dim pp-dchooser" },
          h("input", {
            type: "checkbox",
            checked: props.readAloud,
            disabled: screenState !== "ready",
            onChange: (event) => props.setReadAloud(event.target.checked),
          }),
          " read each question aloud there",
        ),
      );
    }

    // ── client/defence-views.js

    /** Seconds as m:ss. */
    const clock = (seconds) => Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");

    /** An ISO time as hh:mm, or as given if it is not one. */
    const clockTime = (iso) => {
      const at = new Date(iso);
      return Number.isNaN(at.getTime()) ? iso : String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0");
    };

    /** Hold to speak, wired to the desk's marks. */
    const speakButtonFor = (desk) =>
      h(SpeakButton, { talking: desk.professorTalking, onDown: desk.speakDown, onUp: desk.speakUp });

    /** One take of an answer: its recording, whose words, and — for a whole defence — its parts. */
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
            src: desk.endpoint("/api/defence/audio", "&file=" + encodeURIComponent(answer.audio)),
          }),
        ),
        // Whose words: the professor's are marked and dimmed, another voice
        // likewise, and a take whose voices could not be told apart says so
        // above its words — it is kept, and never cited as the answer.
        answer.transcript && answer.transcript.speakers && answer.transcript.speakers.unclear
          ? h("div", { className: "pp-dwarn" }, "Voices unclear — not cited as the student's: " + (answer.transcript.speakers.note || ""))
          : null,
        h(VoicePicker, { desk, answer }),
        answer.transcript
          ? h(
              "div",
              { className: "pp-dtranscript" },
              answer.transcript.segments.map((segment, index) => {
                const other = segment.speaker === "professor" ? "You: " : segment.speaker === "unknown" ? "Other voice: " : "";
                return h(
                  "span",
                  {
                    key: index,
                    className: (other ? "pp-dother " : "") + (segment.confidence === "low" ? "pp-dlow" : ""),
                    title: clock(segment.start) + (segment.confidence === "low" ? " · low confidence — listen to it" : ""),
                  },
                  other ? h("b", null, other) : null,
                  segment.text + " ",
                );
              }),
              answer.transcript.timed ? null : h("span", { className: "pp-dim" }, " (no timestamps from this model)"),
            )
          : h("div", { className: "pp-dim" }, answer.error ? "Not transcribed: " + answer.error : "Transcribing…"),
        answer.question_id === "Q0" ? h(SplitView, { desk, answer }) : null,
      );
    }

    /*
     * AGT-11: the whole defence divided into its questions, under its
     * recording. Each part says when it starts — pressing the time plays
     * from there — what was asked and which criterion its answer counts
     * for. A draft until the professor says the parts are right.
     */
    function SplitView(props) {
      const desk = props.desk;
      const answer = props.answer;
      const splitting = desk.splitting;
      if (!answer.transcript || answer.withdrawn) return null;
      const found = ((desk.data && desk.data.splits) || []).find((entry) => entry.question_id === answer.question_id && entry.take === answer.take);
      const busyHere = splitting && splitting.question === answer.question_id && splitting.take === answer.take;
      const play = (seconds) => {
        const audio = document.getElementById("pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"));
        if (!audio) return;
        audio.currentTime = seconds;
        audio.play().catch(() => {});
      };
      return h(
        "div",
        { className: "pp-dsplit" },
        busyHere
          ? h("div", { className: "pp-dim" }, "Dividing the defence into its questions…")
          : found
            ? h(
                React.Fragment,
                null,
                h(
                  "div",
                  { className: "pp-dim" },
                  found.parts.length + " question(s), divided by " + found.by + (found.approval === "approved" ? " · you checked them" : " · a draft: check the parts"),
                ),
                h(
                  "ol",
                  { className: "pp-dsplitlist" },
                  found.parts.map((part, index) =>
                    h(
                      "li",
                      { key: index },
                      h("button", { type: "button", className: "pp-dsplitat", title: "Play from here", onClick: () => play(part.start) }, clock(part.start)),
                      " ",
                      part.question_id ? h("b", null, part.question_id + " ") : h("span", { className: "pp-dim" }, "not prepared · "),
                      part.asked,
                      part.criterion_id ? h("span", { className: "pp-dim" }, " · " + (desk.criteria.get(part.criterion_id) || part.criterion_id)) : null,
                    ),
                  ),
                ),
                found.notes && found.notes.length ? h("div", { className: "pp-dwarn" }, found.notes.join(" · ")) : null,
                h(
                  "div",
                  { className: "pp-approverow" },
                  found.approval !== "approved"
                    ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.split(answer.question_id, answer.take, "approve") }, "These are right")
                    : null,
                  h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide again"),
                ),
              )
            : h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => desk.split(answer.question_id, answer.take) }, "Divide into questions"),
                h("span", { className: "pp-dim" }, "the session's model reads the dialogue, your presses as hints; nothing is graded"),
              ),
      );
    }

    /*
     * "This voice is me". Offered on a take whose voices were separated but
     * not settled — a whole defence always, an ordinary take when two voices
     * spoke about as much — and on one already settled, to correct it. Each
     * voice is shown by the first thing it said, which is how a professor
     * recognises their own question.
     */
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
      if (voices.length < 2 || (!transcript.speakers.unclear && !settled)) return null;
      return h(
        "div",
        { className: "pp-approverow pp-dvoices" },
        h("span", { className: "pp-dim" }, settled ? "Your voice:" : "Which voice is yours?"),
        voices.map((voice) =>
          h(
            "button",
            {
              type: "button",
              key: voice.id,
              className: "pp-segbtn",
              "aria-pressed": !!settled && settled.includes(voice.id),
              title: voice.id,
              onClick: () => props.desk.assignVoice(answer, voice.id),
            },
            "“" + (voice.first.length > 48 ? voice.first.slice(0, 46) + "…" : voice.first) + "” is me",
          ),
        ),
      );
    }

    /*
     * AGT-7: consent. Nothing records until the professor confirms the student
     * agreed to the statement the server wrote from the provider in use; the
     * server refuses a take without it.
     */
    function ConsentPanel(props) {
      const desk = props.desk;
      const previous = desk.data.consent;
      if (desk.consented) {
        return h(
          "div",
          { className: "pp-approverow" },
          h("span", { className: "pp-dim", title: previous.statement }, "The student agreed to be recorded at " + clockTime(previous.at) + "."),
          desk.confirmWithdraw
            ? h(
                React.Fragment,
                null,
                h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: desk.withdraw }, "Stop and record the withdrawal"),
                h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(false) }, "Cancel"),
              )
            : h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setConfirmWithdraw(true) }, "The student withdraws"),
        );
      }
      return h(
        "div",
        { className: "pp-dconsent" },
        h("b", null, previous && previous.withdrawn_at ? "The student withdrew at " + clockTime(previous.withdrawn_at) + "." : "Before anything is recorded"),
        previous && previous.withdrawn_at
          ? h("div", { className: "pp-dim" }, "Nothing more is recorded. The takes before it are kept and marked withdrawn, so nothing cites them; deleting them is your decision.")
          : h(
              React.Fragment,
              null,
              h("div", null, "Read this to the student, or let them read it on their screen:"),
              h("blockquote", { className: "pp-dstatement" }, desk.data.statement),
              previous && !previous.agreed
                ? h("div", { className: "pp-dwarn" }, "At " + clockTime(previous.at) + " the student did not agree. Nothing is recorded unless they agree now.")
                : null,
              h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: desk.consentBusy, onClick: () => desk.answerConsent("agree") }, "The student agreed"),
                h("button", { type: "button", className: "pp-segbtn", disabled: desk.consentBusy, onClick: () => desk.answerConsent("decline") }, "The student did not agree"),
              ),
            ),
      );
    }

    /**
     * DEF-5: once answers are in, the session's model proposes the marks, citing
     * the moments in the recording; the professor decides them in the grading
     * view like any other suggestion.
     */
    function GradeRow(props) {
      const desk = props.desk;
      const usable = ((desk.data && desk.data.answers) || []).filter((answer) => answer.transcript && !answer.withdrawn);
      if (!usable.length || desk.handsFree || desk.recording) return null;
      return h(
        "div",
        { className: "pp-approverow" },
        h("button", { type: "button", className: "pp-segbtn pp-chat", onClick: desk.proposeGrade }, "Propose the grade"),
        h(
          "span",
          { className: "pp-dim" },
          "the session's model reads what the student said and the code, and writes suggested marks citing the recording; you decide them",
        ),
      );
    }

    /** At rest: the two modes, each with its own start, and the desk's switches. */
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
          h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "questions", onClick: () => desk.chooseMode("questions") }, "Question by question"),
        ),
        mode === "whole"
          ? h(
              "button",
              {
                type: "button",
                className: "pp-segbtn pp-drec",
                disabled: Boolean(desk.recording || desk.sending),
                title: "One recording of the whole defence, transcribed as you talk. Press Space at each new question; the session's model divides it into its questions afterwards.",
                onClick: desk.recordWhole,
              },
              "● Record the whole defence",
            )
          : h(
              "button",
              {
                type: "button",
                className: "pp-segbtn pp-drec",
                disabled: Boolean(desk.recording || desk.sending),
                title: "Listens continuously: an answer ends after a pause of about two and a half seconds, and the next question comes up by itself.",
                onClick: desk.startHandsFree,
              },
              "● Start hands-free",
            ),
        mode === "questions"
          ? h(
              "label",
              { className: "pp-dim pp-dchooser" },
              h("input", { type: "checkbox", checked: desk.chooser, onChange: (event) => desk.setChooser(event.target.checked) }),
              " the session's model chooses each next question — a follow-up, or the next prepared one",
            )
          : null,
        h(
          "label",
          {
            className: "pp-dim pp-dchooser",
            title: "Every few seconds of speech is transcribed as it is said, through the same provider. Each answer is then transcribed twice: the captions are not kept.",
          },
          h("input", { type: "checkbox", checked: desk.liveCaptions, onChange: (event) => desk.setLiveCaptions(event.target.checked) }),
          " live captions while the student answers",
        ),
        desk.pending > 0 ? h("span", { className: "pp-dim" }, desk.pending + " answer(s) transcribing…") : null,
      );
    }

    /*
     * AGT-2 and AGT-3: the model's choice of what to ask next, waiting out its
     * five seconds. Ask now, Edit (change the words, then ask), Skip (the next
     * prepared question instead), Pause (stop; nothing is asked).
     */
    function ProposalPanel(props) {
      const desk = props.desk;
      const current = desk.proposal;
      const question = current.question;
      const left = Math.max(0, Math.ceil((current.deadline - desk.now) / 1000));
      const done = current.decision.action === "done" || !question;
      const notes = current.decision.notes || [];
      return h(
        "div",
        { className: "pp-dproposal" },
        h(
          "div",
          { className: "pp-dhandsline" },
          done
            ? h("b", null, "Done?")
            : h("b", null, question.id + (question.follows ? " ↳ follow-up on " + question.follows : "")),
          current.editing === null ? h("span", { className: "pp-dcount" }, done ? "finishing in " + left + " s" : "asking in " + left + " s") : null,
        ),
        done
          ? h("div", null, current.decision.why || "Nothing left to ask.")
          : current.editing !== null
            ? h("textarea", {
                className: "pp-dedit",
                value: current.editing,
                rows: 2,
                autoFocus: true,
                onChange: (event) => desk.setProposal(Object.assign({}, current, { editing: event.target.value })),
              })
            : h("div", { className: "pp-dqtext" }, question.text),
        !done && current.decision.why ? h("div", { className: "pp-dim" }, "Why: " + current.decision.why) : null,
        notes.length ? h("div", { className: "pp-dwarn" }, notes.join(" · ")) : null,
        h(
          "div",
          { className: "pp-dim" },
          "Chosen by " + current.decision.by + ".",
        ),
        h(
          "div",
          { className: "pp-approverow" },
          current.editing !== null
            ? h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("edit", current.editing) }, "Save and ask")
            : h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.settle("ask_now") }, done ? "Finish now" : "Ask now"),
          !done && current.editing === null
            ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.setProposal(Object.assign({}, current, { editing: question.text })) }, "Edit")
            : null,
          !done ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("skip") }, "Skip — next prepared question") : null,
          h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.settle("pause") }, "Pause"),
        ),
      );
    }

    /** Hands-free in the list view: the question being asked, the meter, and its controls. */
    function HandsPanel(props) {
      const desk = props.desk;
      return h(
        "div",
        { className: "pp-dhands pp-dhandsdots" },
        // One swarm for the whole defence, so it morphs between shapes
        // rather than starting over at each question.
        h(ListeningDots, { phase: desk.proposal ? "proposing" : desk.handsFree.phase, level: desk.handsFree.level }),
        h("div", { className: "pp-dhandsbody" }, h(HandsBody, { desk })),
      );
    }

    function HandsBody(props) {
      const desk = props.desk;
      const handsFree = desk.handsFree;
      const captions = desk.captions;
      return desk.proposal
        ? h(ProposalPanel, { desk })
        : handsFree.phase === "thinking" || handsFree.phase === "proposing"
          ? h(
              React.Fragment,
              null,
              h("div", { className: "pp-dhandsline" }, "Transcribing the answer and choosing what to ask next…"),
              captions ? h(CaptionsLine, { captions, question: captions.question }) : null,
            )
          : handsFree.phase === "reading"
          ? h("div", { className: "pp-dhandsline" }, h("b", null, handsFree.question), " · being read aloud on the student's screen — listening starts when it finishes")
          : h(
              React.Fragment,
              null,
              h(
                "div",
                { className: "pp-dhandsline" },
                h("b", null, handsFree.question),
                " · ",
                handsFree.phase === "professor"
                  ? "you are speaking — the answer waits"
                  : handsFree.phase === "speaking"
                  ? handsFree.silent
                    ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s"
                    : "hearing the answer"
                  : "listening — waiting for the student to speak",
                h(
                  "span",
                  { className: "pp-dmeter", "aria-hidden": "true" },
                  h("span", {
                    className: "pp-dmeterfill" + (handsFree.level > handsFree.threshold ? " pp-dmeteron" : ""),
                    style: { width: Math.min(100, Math.round(handsFree.level * 400)) + "%" },
                  }),
                ),
              ),
              h(CaptionsLine, { captions, question: handsFree.question }),
              h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("space") }, "End answer (Space)"),
                h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip, no answer"),
                h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
                speakButtonFor(desk),
              ),
              h(
                "div",
                { className: "pp-dim" },
                "Hold P (or the button) whenever you speak, so your words are not taken for the answer.",
              ),
            );
    }

    /**
     * A manual take in progress — one question, or the whole defence — with the
     * same dots as hands-free, following the level of the voice.
     */
    function RecordingPanel(props) {
      const desk = props.desk;
      const recording = desk.recording;
      const wholeMarks = desk.wholeMarks;
      const whole = recording.question === "Q0";
      const phase = desk.professorTalking ? "professor" : desk.manualLevel > 0.02 ? "speaking" : "waiting";
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
            (recording.paused ? " · paused at " : " · recording ") + clock(desk.elapsed) + (phase === "speaking" ? " · hearing a voice" : phase === "professor" ? " · you are speaking" : ""),
          ),
          h(CaptionsLine, { captions: desk.captions, question: recording.question }),
          h(
            "div",
            { className: "pp-approverow" },
            whole && !recording.paused ? h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.markQuestion(null) }, "Next question (Space)") : null,
            whole ? h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause") : null,
            h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
            speakButtonFor(desk),
          ),
          whole
            ? h(
                "div",
                { className: "pp-dim" },
                "Ask as you go. Press Space at each new question, or Asking this beside a prepared one — hints for dividing it afterwards. Hold P while you speak.",
              )
            : null,
        ),
      );
    }

    /** One question in the list: what it asks and why, its press, and its takes. */
    function QuestionItem(props) {
      const desk = props.desk;
      const entry = props.entry;
      const recording = desk.recording;
      const handsFree = desk.handsFree;
      const wholeMarks = desk.wholeMarks;
      const takes = desk.answers.filter((answer) => answer.question_id === entry.id);
      const live = (recording && recording.question === entry.id) || (handsFree && handsFree.question === entry.id);
      return h(
        "li",
        { className: "pp-dq" + (live ? " pp-dlive" : "") },
        h(
          "div",
          { className: "pp-dqtext" },
          h("b", null, entry.id + (entry.follows ? " ↳ " + entry.follows : "") + " "),
          entry.text,
        ),
        h(
          "div",
          { className: "pp-dim" },
          [
            entry.kind === "opening" ? "opening" : entry.kind === "follow_up" ? "follow-up" : null,
            entry.criterion_id ? desk.criteria.get(entry.criterion_id) || entry.criterion_id : null,
            (entry.evidence || []).map((cite) => cite.path + (cite.lines ? ":" + cite.lines : "")).join(", ") || null,
          ]
            .filter(Boolean)
            .join(" · "),
          entry.why ? h("div", null, entry.why) : null,
        ),
        h(
          "div",
          { className: "pp-approverow" },
          handsFree && handsFree.question === entry.id
            ? h("span", { className: "pp-drec pp-dlivemark" }, "● being asked — hands-free")
            : recording && recording.question === "Q0" && entry.kind !== "whole"
            ? // AGT-11: in a whole defence, say which prepared question you are asking.
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": wholeMarks.length > 0 && wholeMarks[wholeMarks.length - 1].question_id === entry.id,
                  disabled: Boolean(recording.paused),
                  onClick: () => desk.markQuestion(entry.id),
                },
                wholeMarks.some((mark) => mark.question_id === entry.id) ? "Asking this again" : "Asking this",
              )
            : live
            ? h(React.Fragment, null, h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop · " + clock(desk.elapsed)), speakButtonFor(desk))
            : h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: Boolean(recording || desk.sending || handsFree || !desk.consented),
                  onClick: () => desk.start(entry.id),
                },
                desk.sending === entry.id ? "Transcribing…" : takes.length ? "● Record again" : "● Record answer",
              ),
          takes.length
            ? h(
                "button",
                { type: "button", className: "pp-segbtn pp-chat", disabled: Boolean(recording || handsFree), onClick: () => desk.followUp(entry.id) },
                "Follow-up question",
              )
            : null,
        ),
        takes.map((answer) => h(TakeView, { key: answer.audio, desk, answer })),
      );
    }

    // ── client/defence-stage.js

    /*
     * The big button does the one thing the moment calls for: start, mark the
     * next question of a whole defence (as Space does), resume it, end a
     * hands-free answer, or ask a waiting proposal now — `desk.bigPress`. The
     * other controls of the moment sit in one row beside it — Pause, Stop, Skip,
     * hold to speak — and, at rest, the choice of mode.
     */
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
      const stagePhase = proposal
        ? "proposing"
        : handsFree
          ? handsFree.phase
          : recording
            ? recording.paused
              ? "idle"
              : desk.professorTalking
                ? "professor"
                : desk.manualLevel > 0.02
                  ? "speaking"
                  : "waiting"
            : splitting
              ? "thinking"
              : "idle";
      const stageQuestionId = handsFree && handsFree.question ? handsFree.question : recording ? recording.question : null;
      const bigLabel =
        !consented
          ? "Consent first"
          : proposal
            ? "Ask now"
            : stagePhase === "thinking" && handsFree
              ? "Choosing…"
              : stagePhase === "reading"
                ? "Reading aloud"
                : wholeRec
                  ? recording.paused
                    ? "Resume"
                    : "Next question"
                  : handsFree || recording
                    ? "End answer"
                    : desk.sending
                      ? "Transcribing…"
                      : splitting
                        ? "Dividing…"
                        : "Start";

      /** The row beside the big button: what else the moment allows. */
      const stageRow = () => {
        if (!consented) return null;
        if (wholeRec) {
          return h(
            React.Fragment,
            null,
            h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? desk.resumeWhole : desk.pauseWhole }, recording.paused ? "Resume" : "Pause"),
            h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: desk.stop }, "■ Stop"),
            recording.paused ? null : speakButtonFor(desk),
          );
        }
        if (handsFree && !proposal && handsFree.phase !== "thinking") {
          return h(
            React.Fragment,
            null,
            h("button", { type: "button", className: "pp-segbtn", onClick: () => desk.endTake("skip") }, "Skip"),
            h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => desk.endTake("pause") }, "Pause"),
            speakButtonFor(desk),
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
              onClick: () => desk.chooseMode("whole"),
            },
            "Whole defence",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              "aria-pressed": mode === "questions",
              title: "Hands-free, one take per question: an answer ends after a pause, and the next question comes up by itself.",
              onClick: () => desk.chooseMode("questions"),
            },
            "Question by question",
          ),
        );
      };

      const questions = (data && data.questions) || [];
      const entry = stageQuestionId ? questions.find((q) => q.id === stageQuestionId) : null;
      const lastId = captions && captions.question;
      const last = lastId ? questions.find((q) => q.id === lastId) : null;
      // Once nothing records, the last words stay under a heading that says
      // whose they were, dimmed, until the next take begins.
      const shown = entry || last;
      const pickedMark = wholeRec && wholeMarks.length ? wholeMarks[wholeMarks.length - 1] : null;
      const picked = pickedMark && pickedMark.question_id ? questions.find((q) => q.id === pickedMark.question_id) : null;
      const latestSplit = ((data && data.splits) || []).filter((entry) => entry.question_id === "Q0").slice(-1)[0] || null;
      const heading = wholeRec
        ? "The whole defence" + (recording.paused ? " · paused" : "") + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) + (picked ? " (" + picked.id + ")" : "") : "")
        : splitting
          ? "Dividing the defence into its questions…"
          : entry
            ? entry.id + (entry.follows ? " · follow-up on " + entry.follows : "") + (entry.criterion_id ? " · " + ((data.criteria || []).find((c) => c.id === entry.criterion_id) || {}).title : "")
            : shown
              ? shown.kind === "whole"
                ? "The whole defence, recorded"
                : shown.id + " answered"
              : consented
                ? "Ready"
                : "Before anything is recorded";
      const words = captions && (!stageQuestionId || captions.question === stageQuestionId) ? captions : null;
      // The stage shows the latest words, to glance at; all of them are in
      // the drawer and, once it ends, in the take's transcript.
      const heardWords = words ? words.pieces.slice(words.from || 0).map((piece) => piece.text).join(" ").split(/\s+/).filter(Boolean) : [];
      const spoken = heardWords.length > 80 ? ["…"].concat(heardWords.slice(-80)) : heardWords;
      const live = stagePhase === "waiting" || stagePhase === "speaking" || stagePhase === "professor";
      const stale = Boolean(words && !recording && !handsFree);
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
            picked
              ? h("div", null, picked.text)
              : entry && entry.kind !== "whole"
                ? h("div", null, entry.text)
                : !consented
                  ? h("div", null, "Open the drawer: the student agrees first.")
                  : !recording && !handsFree && !shown
                    ? h(
                        "div",
                        null,
                        mode === "whole"
                          ? "One recording of the whole defence, transcribed as you talk. Press Space at each new question; it is divided into its questions afterwards."
                          : "Hands-free, one question at a time: an answer ends after a pause, and the next question comes up.",
                      )
                    : null,
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-stagebtn" + (live ? " pp-stagelive" : ""),
              onClick: desk.bigPress,
              "aria-label": bigLabel,
            },
            h(ListeningDots, { phase: stagePhase, level: handsFree ? handsFree.level : desk.manualLevel, size: 130, className: "pp-stagedots" }),
            h("span", { className: "pp-stagebtnlabel" }, bigLabel + (recording ? " · " + clock(desk.elapsed) : "")),
          ),
          h("div", { className: "pp-approverow pp-stagerow" }, stageRow()),
          h(
            "div",
            { className: "pp-stagetr" + (stale ? " pp-stagetrold" : ""), "aria-live": "polite" },
            words && (spoken.length || words.partial)
              ? h(
                  React.Fragment,
                  null,
                  spoken.join(" "),
                  words.partial ? h("span", { className: "pp-dpartial" }, " " + words.partial) : null,
                )
              : h(
                  "span",
                  { className: "pp-dpartial" },
                  recording && recording.paused
                    ? "Paused — nothing is recorded or sent until you resume."
                    : live
                      ? desk.liveCaptions
                        ? wholeRec
                          ? "Listening — what is said appears here as it is said."
                          : "Listening — the student's words appear here as they speak."
                        : "Live captions are off."
                      : "The transcript appears here as the student speaks.",
                ),
          ),
          h(
            "div",
            { className: "pp-dim" },
            stagePhase === "professor"
              ? "You are speaking — not the answer"
              : handsFree && handsFree.phase === "speaking" && handsFree.silent
                ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s — the answer ends at 2.5 s"
                : splitting
                  ? "The session's model is reading the dialogue, your presses as hints."
                  : stagePhase === "thinking"
                    ? "Transcribing and choosing what to ask next…"
                    : proposal
                      ? "The next question is waiting in the drawer"
                      : wholeRec && live
                        ? "Space: a new question · Hold P to speak · Asking this, in the drawer, names a prepared one"
                        : live
                          ? "Hold P to speak · Space ends the answer"
                          : desk.sending
                            ? "Transcribing the recording…"
                            : !recording && !handsFree && latestSplit && mode === "whole"
                              ? "Divided into " + latestSplit.parts.length + " question(s)" + (latestSplit.approval === "approved" ? ", checked" : " — check them in the drawer")
                              : "",
          ),
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
              (desk.drawer ? "▾ " : "▴ ") + "Questions and controls",
            ),
            desk.pending > 0 ? h("span", { className: "pp-dim" }, desk.pending + " recording(s) transcribing…") : null,
          ),
          desk.drawer
            ? h(
                "div",
                { className: "pp-drawerbody" },
                proposal ? h("div", { className: "pp-dhands" }, h(ProposalPanel, { desk })) : null,
                h(ConsentPanel, { desk }),
                h(ScreenRow, desk.screenProps),
                consented && !handsFree && !recording ? h(StartRow, { desk }) : null,
                h(GradeRow, { desk }),
                desk.said ? h("div", { className: desk.said.error ? "pp-dwarn" : "pp-dim" }, desk.said.text) : null,
                h("ol", { className: "pp-dlist" }, questions.map((entry) => h(QuestionItem, { key: entry.id, desk, entry }))),
              )
            : null,
        ),
      );
    }

    // ── client/defence-desk.js

    /** The recording formats to try, best first. */
    const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

    /** How long a proposed next question waits for the professor before it is asked. */
    const PROPOSE_MS = 5000;

    /**
     * A choice remembered in this browser only, read once when the desk opens.
     * Storage can be unavailable (a private window, a blocked origin); then the
     * choice simply lasts until the desk closes.
     */
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
        } catch {}
      };
      return [value, choose];
    }

    /**
     * The defence desk: one student's oral defence, question by question.
     *
     * Here and not in a frame, because a frame sandboxed without
     * `allow-same-origin` may not ask for the microphone. The professor presses
     * Record, the student answers, Stop sends the take to the server, which keeps
     * it in the private folder and transcribes it through the `transcription`
     * connection. Every take is kept; a second press is a second take, never an
     * overwrite.
     *
     * The header says where the voice goes before anyone presses record — the
     * provider by name, and whether it leaves this machine — because a
     * student's voice is the most personal thing this pane has handled.
     *
     * Follow-up asks the session (`/defend-submission … follow-up on Qn`): the
     * model the professor is talking to reads what was said and appends one
     * question, which arrives here on the next redraw.
     */
    function DefenceDesk(props) {
      const close = props.onClose;
      const [data, setData] = React.useState(null);
      const [recording, setRecording] = React.useState(null); // { question, started, paused }
      const [sending, setSending] = React.useState(null);
      const [said, setSaid] = React.useState(null);
      const [tick, setTick] = React.useState(0);
      const [elapsed, setElapsed] = React.useState(0);
      const [manualLevel, setManualLevel] = React.useState(0);
      // The stage (big button, live transcript, everything else in a drawer)
      // or the list (every control and question in one column). The list is
      // one press away.
      const [view, chooseView] = useRememberedChoice("professor-pane.defence-view", (stored) => stored || "stage");
      const [drawer, setDrawer] = React.useState(true);
      /*
       * AGT-11: how the defence is taken. `whole` (the default): one
       * recording of the whole conversation, transcribed live, with a press
       * for each new question as a hint; the session's model divides it into
       * its questions afterwards. `questions`: hands-free, one take per
       * question, the desk choosing what comes next.
       */
      const [mode, chooseMode] = useRememberedChoice("professor-pane.defence-mode", (stored) => (stored === "questions" ? "questions" : "whole"));
      // The whole take in hand: when it started, the presses so far, and the
      // time spent paused — so every mark is in seconds of audio, not of clock.
      const whole = React.useRef({ started: null, marks: [], paused: null, pausedMs: 0 });
      const [wholeMarks, setWholeMarks] = React.useState([]);
      const [splitting, setSplitting] = React.useState(null); // { question, take }
      // Uploads still on the wire; the desk does not close while any are.
      const [pending, setPending] = React.useState(0);
      // Hands-free (AGT-1): { question, phase, level, threshold } while running.
      const [handsFree, setHandsFree] = React.useState(null);
      // AGT-2/3: the model's choice waiting out its five seconds, and whether
      // the model is asked at all (off: the desk walks the prepared questions).
      const [proposal, setProposal] = React.useState(null);
      const proposalRef = React.useRef(null);
      proposalRef.current = proposal;
      const [chooser, setChooser] = React.useState(true);
      const [now, setNow] = React.useState(Date.now());
      const recorder = React.useRef(null);
      // The hands-free loop's own state, outside React: it runs ten times a
      // second and must see the latest of everything without re-subscribing.
      const loop = React.useRef(null);
      const dataRef = React.useRef(null);
      dataRef.current = data;

      const query =
        "?run=" + encodeURIComponent(props.runId) +
        "&assessment=" + encodeURIComponent(props.assessment) +
        "&student=" + encodeURIComponent(props.student);
      const endpoint = (path, extra) => scoped(BASE + path + query + (extra || ""), props.sessionId);

      const { marks, professorTalking, openMarks, closeMarks, speakDown, speakUp } = useProfessorMarks();
      const { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard } = useCaptions(endpoint, marks, whole);
      const { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen } = useStudentScreen(props, dataRef);

      /*
       * AGT-7: consent. Nothing records until the professor confirms the
       * student agreed to the statement the server wrote from the provider in
       * use — the server refuses a take without it, so this is the visible
       * half of a rule that is enforced where the file is written. Withdrawal
       * stops everything at once and drops the take in hand unsent.
       */
      const consented = !!(data && data.consent && data.consent.agreed && !data.consent.withdrawn_at);
      const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
      const [consentBusy, setConsentBusy] = React.useState(false);
      // A manual take in progress when consent is withdrawn is stopped and not sent.
      const discard = React.useRef(false);
      const answerConsent = (action) => {
        setConsentBusy(true);
        return fetch(endpoint("/api/defence/consent"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) setSaid({ error: true, text: result.error });
          })
          .catch((error) => setSaid({ error: true, text: String(error) }))
          .then(() => {
            setConsentBusy(false);
            setTick((value) => value + 1);
          });
      };

      React.useEffect(() => {
        let live = true;
        fetch(endpoint("/api/defence/session"), { cache: "no-store" })
          .then((response) => response.json())
          .then((value) => live && setData(value))
          .catch((error) => live && setData({ error: String(error) }));
        return () => {
          live = false;
        };
      }, [props.reload, tick, props.assessment, props.student]);

      /** Seconds of audio in the take in hand: the clock less any time paused. */
      const audioNow = () => {
        const current = whole.current;
        if (current.started === null) return 0;
        const now = Date.now();
        return (now - current.started - current.pausedMs - (current.paused !== null ? now - current.paused : 0)) / 1000;
      };

      // A running clock while recording, so the professor sees it is live.
      React.useEffect(() => {
        if (!recording) return undefined;
        const timer = setInterval(() => setElapsed(audioNow()), 250);
        return () => clearInterval(timer);
      }, [recording]);

      // Closing mid-answer would lose it, so Escape does nothing then.
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

      // Release the microphone if the desk goes away while it is held.
      React.useEffect(() => () => {
        const held = recorder.current;
        if (held && held.state !== "inactive") held.stop();
        const running = loop.current;
        if (running) {
          clearInterval(running.timer);
          running.stream.getTracks().forEach((track) => track.stop());
          if (running.audio.state !== "closed") running.audio.close();
          loop.current = null;
        }
      }, []);

      /**
       * Send one take; transcribed by the server. Resolves either way, having
       * said what went wrong, with the take as the server kept it, or null.
       */
      const upload = (questionId, blob, seconds, ranges, askedAt, pressed) => {
        const spoke = (ranges || []).map((range) => range[0].toFixed(1) + "-" + range[1].toFixed(1)).join(",");
        const marked = (pressed || []).map((mark) => mark.at.toFixed(1) + (mark.question_id ? ":" + mark.question_id : "")).join(",");
        setPending((count) => count + 1);
        let kept = null;
        return fetch(endpoint("/api/defence/answer", "&question=" + encodeURIComponent(questionId) + "&seconds=" + seconds.toFixed(1) + (spoke ? "&professor=" + spoke : "") + (marked ? "&marks=" + marked : "") + (askedAt ? "&asked=" + Math.round(askedAt) : "")), {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) setSaid({ error: true, text: questionId + ": " + result.error });
            else if (result.answer && result.answer.error) {
              setSaid({ error: true, text: questionId + " kept, not transcribed: " + result.answer.error });
            }
            kept = result.answer || null;
          })
          .catch((error) => setSaid({ error: true, text: questionId + ": " + String(error) }))
          .then(() => {
            setPending((count) => count - 1);
            setTick((value) => value + 1);
            return kept;
          });
      };

      /*
       * AGT-11: divide a whole-defence take into its questions. The server
       * asks the session's model, with the presses as hints, and falls back
       * to the presses alone; the split comes back as a draft to check.
       */
      const split = (questionId, takeNumber, action) => {
        if (action !== "approve") setSplitting({ question: questionId, take: takeNumber });
        return fetch(endpoint("/api/defence/split"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: questionId, take: takeNumber, action: action || "split" }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) setSaid({ error: true, text: "Could not divide the defence: " + result.error });
            else if (!result.split) setSaid({ error: true, text: "The defence stays one piece: " + (result.notes || []).join("; ") });
            else if (action !== "approve") {
              const notes = result.notes || [];
              setSaid({
                error: notes.length > 0,
                text: "Divided into " + result.split.parts.length + " question(s) by " + result.split.by + (notes.length ? ": " + notes.join("; ") : ". Check them under the recording."),
              });
            }
          })
          .catch((error) => setSaid({ error: true, text: String(error) }))
          .then(() => {
            setSplitting(null);
            setTick((value) => value + 1);
          });
      };

      /** A press in a whole defence: a new question starts now, a prepared one if named. */
      const markQuestion = (questionId) => {
        const current = whole.current;
        if (!recording || recording.question !== "Q0" || current.paused !== null) return;
        const mark = questionId ? { at: audioNow(), question_id: questionId } : { at: audioNow() };
        current.marks = current.marks.concat([mark]);
        setWholeMarks(current.marks);
        // The live transcript starts over under the new question; the words
        // before it are still in the recording and in the take's transcript.
        setCaptions((value) => (value ? Object.assign({}, value, { from: value.pieces.length }) : value));
        showOnScreen("Q0", "listening", false, questionId || null);
      };

      /** Pause a whole defence: one recording still, with the gap left out of it. */
      const pauseWhole = () => {
        const media = recorder.current;
        const current = whole.current;
        if (!media || media.state !== "recording" || current.paused !== null || typeof media.pause !== "function") return;
        speakUp();
        media.pause();
        current.paused = Date.now();
        setRecording((value) => (value ? Object.assign({}, value, { paused: true }) : value));
        showOnScreen("Q0", "paused", false, lastPicked());
      };
      const resumeWhole = () => {
        const media = recorder.current;
        const current = whole.current;
        if (!media || media.state !== "paused" || current.paused === null) return;
        const gap = Date.now() - current.paused;
        current.pausedMs += gap;
        current.paused = null;
        // The professor's stretches are measured from the take's start: move
        // it on by the gap, so they stay in seconds of audio too.
        if (marks.current.origin !== null) marks.current.origin += gap;
        media.resume();
        setRecording((value) => (value ? Object.assign({}, value, { paused: false }) : value));
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
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
            const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
            // The level, for the dots: a manual take has no detector, but the
            // swarm should still show whether someone is speaking.
            let meter = null;
            try {
              const audio = new AudioContext();
              const analyser = audio.createAnalyser();
              analyser.fftSize = 2048;
              audio.createMediaStreamSource(stream).connect(analyser);
              const samples = new Float32Array(analyser.fftSize);
              meter = {
                audio,
                timer: setInterval(() => {
                  analyser.getFloatTimeDomainData(samples);
                  let sum = 0;
                  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
                  const level = Math.sqrt(sum / samples.length);
                  setManualLevel(level);
                  heard(level, 0.02);
                }, 150),
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
                // AGT-11: a whole defence, once transcribed, is divided into
                // its questions straight away; the professor checks the parts.
                if (kept && kept.question_id === "Q0" && kept.transcript && !kept.withdrawn) split(kept.question_id, kept.take);
              });
            };
            recorder.current = media;
            media.start(1000);
            setElapsed(0);
            whole.current = { started, marks: [], paused: null, pausedMs: 0 };
            setWholeMarks([]);
            setRecording({ question: questionId, started, paused: false });
            openMarks(started);
            showOnScreen(questionId, "listening");
            startCaptions(stream, questionId, type);
          })
          .catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
      };

      const stop = () => {
        const media = recorder.current;
        if (media && media.state !== "inactive") media.stop();
      };

      /*
       * Hands-free (AGT-1). The microphone is opened once and held; each
       * question gets its own recorder on that stream, and `turnStep` watches
       * the level ten times a second. When the student has spoken and then
       * stopped for long enough, the take is sent in the background and the
       * next unanswered question is put up at once — nobody presses anything.
       * Space ends an answer early; Skip moves on without keeping the take;
       * Pause keeps what was said and lets go of the microphone.
       */
      const nextUnanswered = (after) => {
        const questions = (dataRef.current && dataRef.current.questions) || [];
        const answered = new Set(((dataRef.current && dataRef.current.answers) || []).map((answer) => answer.question_id));
        const asked = loop.current ? loop.current.asked : new Set();
        const from = after ? questions.findIndex((entry) => entry.id === after) + 1 : 0;
        const ordered = questions.slice(from).concat(questions.slice(0, from));
        const found = ordered.find((entry) => entry.kind !== "whole" && !answered.has(entry.id) && !asked.has(entry.id));
        return found ? found.id : null;
      };

      const releaseMicrophone = (final) => {
        stopCaptions();
        showOnScreen(null, final === "done" ? "done" : "paused");
        const running = loop.current;
        if (!running) return;
        clearInterval(running.timer);
        running.stream.getTracks().forEach((track) => track.stop());
        if (running.audio && running.audio.state !== "closed") running.audio.close();
        loop.current = null;
        setHandsFree(null);
        setProposal(null);
      };

      const beginTake = (questionId) => {
        const running = loop.current;
        if (!running) return;
        if (!questionId) {
          releaseMicrophone("done");
          setSaid({ error: false, text: "Every question has an answer. Follow-up questions, if you ask for them, appear below." });
          return;
        }
        running.asked.add(questionId);
        const record = () => {
          // Paused, or moved on, while the question was being read.
          if (loop.current !== running || running.take) return;
          const media = new MediaRecorder(running.stream, running.type ? { mimeType: running.type } : undefined);
          const chunks = [];
          media.ondataavailable = (event) => {
            if (event.data && event.data.size) chunks.push(event.data);
          };
          running.take = { question: questionId, media, chunks, started: Date.now(), turn: null, keep: true, spoke: false, shown: "listening" };
          startCaptions(running.stream, questionId, running.type);
          openMarks(running.take.started);
          media.start(1000);
          setHandsFree({ question: questionId, phase: "waiting", level: 0, threshold: 0 });
          showOnScreen(questionId, "listening");
        };
        // Read aloud first, and listen only once the screen says it has
        // finished: the microphone would take the synthetic voice for the
        // student's. A screen that never answers is given until a generous
        // reading time has passed.
        if (readAloudRef.current && screen.current.ready) {
          setHandsFree({ question: questionId, phase: "reading", level: 0, threshold: 0 });
          const text = showOnScreen(questionId, "reading", true);
          const id = screen.current.said;
          const timer = setTimeout(() => {
            if (screen.current.waiting === id) record();
          }, Math.max(4000, text.length * 90) + 2000);
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

      /** End the take in hand: keep it or not, then put up the next question or stop. */
      const endTake = (how) => {
        const running = loop.current;
        const take = running && running.take;
        if (!take || take.media.state === "inactive") return;
        running.take = null;
        stopCaptions();
        const ranges = closeMarks();
        const keep = how !== "skip" && how !== "withdraw" && (take.spoke || how === "space");
        take.media.onstop = () => {
          const blob = new Blob(take.chunks, { type: (take.media.mimeType || running.type || "audio/webm").split(";")[0] });
          const sent = keep && blob.size ? upload(take.question, blob, (Date.now() - take.started) / 1000, ranges, take.started) : Promise.resolve();
          if (how === "pause" || how === "withdraw") releaseMicrophone();
          // An answer was given and the model may choose what follows it: wait
          // for the transcript, then ask. A skipped question, or a desk told
          // not to ask the model, goes straight to the next prepared one.
          else if (running.chooser && keep) {
            showOnScreen(null, "between");
            setHandsFree({ question: null, phase: "thinking", level: 0, threshold: 0 });
            sent.then(() => propose(take.question));
          } else beginTake(nextUnanswered(take.question));
        };
        take.media.stop();
      };

      /*
       * AGT-2 and AGT-3: after each answer the session's model chooses what to
       * ask, and the professor has five seconds to step in before it is asked.
       * Ask now, Skip (the next prepared question instead), Edit (change the
       * words, then ask), Pause (stop; nothing is asked). Every choice and
       * every override is recorded in the session by the server.
       */
      const propose = (after) => {
        if (!loop.current) return;
        fetch(endpoint("/api/defence/next", "&after=" + encodeURIComponent(after)), { method: "POST" })
          .then((response) => response.json())
          .then((result) => {
            if (!loop.current) return;
            if (result.error) {
              setSaid({ error: true, text: "Could not choose the next question: " + result.error + " — moving to the next prepared one." });
              beginTake(nextUnanswered(after));
              return;
            }
            setTick((value) => value + 1);
            setHandsFree({ question: null, phase: "proposing", level: 0, threshold: 0 });
            // The clock the countdown reads, set with the deadline: left stale,
            // the first frame counted from whenever it last ticked.
            setNow(Date.now());
            setProposal({ ...result, after, deadline: Date.now() + PROPOSE_MS, editing: null });
          })
          .catch((error) => {
            setSaid({ error: true, text: String(error) });
            if (loop.current) beginTake(nextUnanswered(after));
          });
      };

      const override = (kind, extra) =>
        fetch(endpoint("/api/defence/override"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ index: proposalRef.current ? proposalRef.current.index : null, override: kind }, extra || {})),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) setSaid({ error: true, text: result.error });
            return result;
          });

      /** Act on the proposal in hand: `auto` when the countdown ran out. */
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
          override("edit", { question: question.id, text: text }).then(() => {
            setTick((value) => value + 1);
            beginTake(question.id);
          });
          return;
        }
        if (how === "ask_now") override("ask_now");
        beginTake(question.id);
      };

      // The countdown. Editing stops it: a professor rewording a question is
      // not going to be overtaken by the clock.
      React.useEffect(() => {
        if (!proposal || proposal.editing !== null) return undefined;
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
        navigator.mediaDevices
          .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          .then((stream) => {
            const audio = new AudioContext();
            const analyser = audio.createAnalyser();
            analyser.fftSize = 2048;
            audio.createMediaStreamSource(stream).connect(analyser);
            const samples = new Float32Array(analyser.fftSize);
            const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
            loop.current = { stream, audio, analyser, samples, type, chooser, asked: new Set(), take: null, timer: null };
            loop.current.timer = setInterval(() => {
              const running = loop.current;
              const take = running && running.take;
              if (!take) return;
              running.analyser.getFloatTimeDomainData(running.samples);
              let sum = 0;
              for (let index = 0; index < running.samples.length; index += 1) sum += running.samples[index] * running.samples[index];
              const level = Math.sqrt(sum / running.samples.length);
              // The professor is speaking: not the answer, and not a silence
              // either. The detector waits, and the pause after it counts
              // from when they let go.
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
          })
          .catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
      };

      // Space ends the answer now — the student said "that's all", or the
      // room is too noisy for silence to be heard.
      React.useEffect(() => {
        if (!handsFree) return undefined;
        const onKey = (event) => {
          if (event.code !== "Space" || /^(INPUT|TEXTAREA|BUTTON)$/.test(String(event.target && event.target.tagName))) return;
          event.preventDefault();
          endTake("space");
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      }, [Boolean(handsFree)]);

      // In a whole defence, Space marks a new question, as the big button does.
      React.useEffect(() => {
        if (!recording || recording.question !== "Q0" || recording.paused) return undefined;
        const onKey = (event) => {
          if (event.code !== "Space" || event.repeat || /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(String(event.target && event.target.tagName))) return;
          event.preventDefault();
          markQuestion(null);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      }, [recording && recording.question, recording && recording.paused]);

      const followUp = (questionId) =>
        props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — follow-up on " + questionId);

      // DEF-5: the session's model proposes the marks; see `GradeRow`.
      const proposeGrade = () =>
        props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — propose the grade");

      /** The student withdrew: stop everything now, send nothing more, and record it. */
      const withdraw = () => {
        setConfirmWithdraw(false);
        setProposal(null);
        const running = loop.current;
        if (running && running.take) endTake("withdraw");
        else if (running) releaseMicrophone();
        if (recorder.current && recorder.current.state !== "inactive") {
          discard.current = true;
          recorder.current.stop();
        }
        answerConsent("withdraw");
      };

      // The student reads what they are agreeing to on their own screen.
      React.useEffect(() => {
        if (!data || data.error || consented || !screen.current.channel) return;
        const state = {
          type: "state",
          phase: data.consent && data.consent.withdrawn_at ? "stopped" : "consent",
          title: (data.assessment && data.assessment.title) || "",
          label: data.consent && data.consent.withdrawn_at ? "Recording stopped" : "Before we begin",
          text: data.consent && data.consent.withdrawn_at ? "You withdrew your agreement. Nothing more is recorded." : data.statement || "",
        };
        screen.current.last = state;
        screen.current.channel.postMessage(state);
      }, [data && data.statement, consented, data && data.consent && data.consent.withdrawn_at, screenState]);

      /** "This voice is me", from `VoicePicker`. */
      const assignVoice = (answer, voice) =>
        fetch(endpoint("/api/defence/voices"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: answer.question_id, take: answer.take, voices: [voice] }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) setSaid({ error: true, text: result.error });
            setTick((value) => value + 1);
          });

      // The whole defence in one recording: Q0 is made if it is not there, and
      // recorded like any take — no cap, P still marks the professor, and the
      // voices are told apart afterwards.
      const recordWhole = () =>
        fetch(endpoint("/api/defence/whole"), { method: "POST" })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) {
              setSaid({ error: true, text: result.error });
              return;
            }
            setTick((value) => value + 1);
            start(result.question);
          });

      // The student's screen shows their own words as they speak (asked for
      // 2026-10-06): the captions of the question being recorded, nothing else.
      React.useEffect(() => {
        const channel = screen.current.channel;
        if (!channel || !captions) return;
        channel.postMessage({
          type: "caption",
          question: captions.question,
          text: captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
          partial: captions.partial || "",
        });
      }, [captions]);

      // The stage keeps the window while an answer is being given: the drawer
      // folds to its strip when recording starts, and opens when the model
      // proposes the next question, so the proposal is never hunted for.
      const recordingNow = Boolean(recording || (handsFree && handsFree.phase !== "thinking" && handsFree.phase !== "proposing"));
      React.useEffect(() => {
        if (recordingNow) setDrawer(false);
      }, [recordingNow]);
      React.useEffect(() => {
        if (proposal) setDrawer(true);
      }, [proposal && proposal.index]);

      /** The stage's big button: the one thing the moment calls for. */
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

      /** What the views read and the presses they may make; see `defence-views.js`. */
      const desk = {
        data,
        answers: (data && data.answers) || [],
        criteria: new Map(((data && data.criteria) || []).map((criterion) => [criterion.id, criterion.title])),
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
        assignVoice,
      };

      return ReactDOM.createPortal(
        h(
          "div",
          {
            className: "pp-veil",
            onMouseDown: (event) => {
              if (event.target === event.currentTarget && !busy) close();
            },
          },
          h(
            "div",
            {
              className: "pp-modal pp-deskmodal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Defence desk",
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h(
                "div",
                { className: "pp-modaltitle" },
                "Defence · " + props.student + (data && data.assessment ? " · " + data.assessment.title : ""),
              ),
              h(
                "span",
                { className: "pp-approverow", role: "group", "aria-label": "View" },
                h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "stage", onClick: () => chooseView("stage") }, "Stage"),
                h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "list", onClick: () => chooseView("list") }, "List"),
              ),
              h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×"),
            ),
            view === "stage" && data && !data.error && (data.questions.length || mode === "whole")
              ? h("div", { className: "pp-publishbody pp-stagebody" }, h(DefenceStage, { desk }))
              : h(
              "div",
              { className: "pp-publishbody" },
              // Where the voice goes, said before anything is recorded.
              where
                ? h(
                    "div",
                    { className: where.error ? "pp-dwarn" : "pp-dim" },
                    where.error
                      ? (where.configured
                          ? where.configured.name + " (" + where.configured.provider + " " + where.configured.model + ") cannot transcribe yet: "
                          : "No transcription provider: ") +
                        where.error + " Answers are still recorded and kept, and transcribed once it is fixed."
                      : "Transcribed by " + where.name + " (" + where.provider + " " + where.model + ")" +
                          (where.local ? ", on this machine." : ": the recording is sent to that provider.") +
                          (typeof where.pricePerMinute === "number" ? " $" + where.pricePerMinute + "/min." : ""),
                  )
                : null,
              data && data.pin
                ? h("div", { className: "pp-dim" }, "Code at " + String(data.pin.commit).slice(0, 7) + (data.pin.pinned_by === "submitted_at" ? ", as handed in." : "."))
                : null,
              // Hands-free: one press starts it, and from then on the desk
              // listens, notices the end of each answer and moves on.
              data && !data.error && data.questions.length ? h(ScreenRow, desk.screenProps) : null,
              data && !data.error && data.questions.length ? h(ConsentPanel, { desk }) : null,
              data && !data.error && data.questions.length && consented
                ? handsFree
                  ? h(HandsPanel, { desk })
                  : recording
                    ? h(RecordingPanel, { desk })
                    : h(StartRow, { desk })
                : null,
              data && !data.error ? h(GradeRow, { desk }) : null,
              said ? h("div", { className: said.error ? "pp-dwarn" : "pp-dim" }, said.text) : null,
              data === null
                ? h("div", { className: "pp-dim" }, "Loading…")
                : data.error
                  ? h("div", { className: "pp-dwarn" }, data.error)
                  : !data.questions.length
                    ? h("div", { className: "pp-dim" }, "No questions drafted yet — Start defence drafts them.")
                    : h("ol", { className: "pp-dlist" }, data.questions.map((entry) => h(QuestionItem, { key: entry.id, desk, entry }))),
            ),
          ),
        ),
        document.body,
      );
    }

    // ── client/upload.js

    // --------------------------------------------------------------- upload

    /**
     * The two things a professor uploads, and what each is for.
     *
     * Kept to two on purpose. The harness's own attachment path takes images
     * and gives the model no file it can run a command on, so these are the
     * files that otherwise have no way in: the scanned pile, and the paper and
     * key it was sat against. Each lands in the private submissions folder
     * where the skill that reads it already looks — see `server/upload.js`.
     */
    const UPLOAD_KINDS = [
      {
        id: "scans",
        label: "Scanned student papers",
        accept: ".pdf,application/pdf",
        hint:
          "PDFs from the scanner — one per student or one batch for the class. Kept outside " +
          "the course, renamed so no student's name travels with them.",
      },
      {
        id: "paper",
        label: "Exam paper or answer key",
        accept: ".pdf,.docx,.odt,.md,.txt,.png,.jpg,.jpeg",
        hint:
          "The paper you set, and its key — so the questions can be recorded exactly as " +
          "printed. Kept outside the course until they are imported.",
      },
      {
        id: "recordings",
        label: "Recorded oral defences",
        accept: ".m4a,.mp4,.mp3,.wav,.webm,.ogg,audio/*",
        hint:
          "Defences recorded elsewhere — on a phone, in another room — one file per student. Kept " +
          "outside the course, renamed so no name travels with them; matched to students and priced " +
          "before anything is sent.",
      },
    ];

    /**
     * The message the agent gets once the files are in place.
     *
     * Paths, never the original filenames: a scan's name can carry a student's,
     * and this sentence goes into the transcript. The server has already renamed
     * a scan by its content, so what is quoted here is safe to say.
     */
    const uploadPrompt = (kind, runId, stored, note) => {
      const fresh = stored.filter((entry) => !entry.duplicate);
      const again = stored.length - fresh.length;
      const list = stored.map((entry) => "- " + entry.path).join("\n");
      const extra = note.trim() === "" ? "" : "\n\nWhat I can tell you: " + note.trim();
      const repeat = again ? " (" + again + " of them already uploaded before)" : "";
      if (kind === "scans") {
        return (
          "I uploaded " + stored.length + " scanned exam PDF(s) for " + runId + repeat +
          ", into the run's unfiled inbox:\n" + list + extra +
          "\n\nWork out which assessment they are from the covers and ask me before filing " +
          "them (/import-assessment §1), then grade them (/grade-scans)."
        );
      }
      return (
        "I uploaded the exam paper / answer key for " + runId + repeat + ":\n" + list + extra +
        "\n\nUse them to record the exam's questions and key (/import-assessment) — ask me " +
        "which assessment it is and about variants first."
      );
    };

    /**
     * Recorded defences uploaded afterwards (DEF-6): plan, file, transcribe —
     * each a press, each answered by `ainar defence batch` in the pane's own
     * process, its output shown as it is. The plan prices the batch on every
     * transcription connection before anything leaves; filing needs the
     * professor to confirm the students agreed to be recorded; sending needs a
     * second press after the quote.
     */
    function BatchModal(props) {
      const close = props.onClose;
      const [assessments, setAssessments] = React.useState([]);
      const [assessment, setAssessment] = React.useState("");
      const [consent, setConsent] = React.useState(false);
      const [quoted, setQuoted] = React.useState(false);
      const [busy, setBusy] = React.useState(null);
      const [output, setOutput] = React.useState("");
      const url = (extra) => scoped(BASE + "/api/defence/batch?run=" + encodeURIComponent(props.runId) + (extra || ""), props.sessionId);

      React.useEffect(() => {
        fetch(url(), { cache: "no-store" })
          .then((response) => response.json())
          .then((result) => {
            const list = result.assessments || [];
            setAssessments(list);
            if (list.length) setAssessment((current) => current || list[0].id);
            if (result.error) setOutput(result.error);
          })
          .catch((error) => setOutput(String(error)));
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

      const run = (step, extra) => {
        if (!assessment || busy) return;
        const sending = step === "transcribe" && /confirm/.test(extra || "");
        setBusy(step);
        setOutput(sending ? "Sending and transcribing — this takes a while for a long batch…" : "Working…");
        fetch(url("&step=" + step + "&assessment=" + encodeURIComponent(assessment) + (extra || "")), { method: "POST" })
          .then((response) => response.json())
          .then((result) => {
            setBusy(null);
            setOutput(result.error || result.output || "(nothing said)");
            if (step === "transcribe") setQuoted(!sending && !!result.ok);
          })
          .catch((error) => {
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
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h("div", { className: "pp-modaltitle" }, "Recorded defences"),
              h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: Boolean(busy), onClick: close }, "×"),
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
                    },
                  },
                  assessments.map((entry) => h("option", { key: entry.id, value: entry.id }, entry.title + " · " + entry.id)),
                ),
              ),
              h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => run("plan") }, "1 · Plan: who, how long, what it costs"),
              ),
              h(
                "div",
                { className: "pp-approverow" },
                h(
                  "label",
                  { className: "pp-dim pp-dchooser" },
                  h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }),
                  " every student in these recordings agreed to be recorded",
                ),
                h(
                  "button",
                  { type: "button", className: "pp-segbtn", disabled: Boolean(busy) || !consent, onClick: () => run("apply", "&consent=1") },
                  "2 · File them as their defences",
                ),
              ),
              h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => run("transcribe") }, "3 · Quote the transcription"),
                quoted
                  ? h(
                      "button",
                      { type: "button", className: "pp-segbtn pp-drec", disabled: Boolean(busy), onClick: () => run("transcribe", "&confirm=1") },
                      "Send them and transcribe",
                    )
                  : null,
              ),
              h(
                "div",
                { className: "pp-dim" },
                "A recording the plan could not place is named there: give it a student in the plan file it shows, and plan again. " +
                  "Once transcribed, open each student's defence desk: say which voice is yours, then Propose the grade.",
              ),
              output ? h("pre", { className: "pp-publishout" }, output) : null,
            ),
          ),
        ),
        document.body,
      );
    }

    function UploadModal(props) {
      const close = props.onClose;
      const [kind, setKind] = React.useState(props.kind || "scans");
      const [files, setFiles] = React.useState([]);
      const [note, setNote] = React.useState("");
      const [phase, setPhase] = React.useState("idle"); // idle | running | error
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

      /** Add files, once each — the same file dropped twice is one file. */
      const add = (list) => {
        const incoming = Array.from(list || []);
        setFiles((current) => {
          const seen = new Set(current.map((file) => file.name + "|" + file.size));
          return current.concat(incoming.filter((file) => !seen.has(file.name + "|" + file.size)));
        });
        setPhase("idle");
        setText("");
      };

      // The harness listens for drops on the whole document, to attach images
      // to the chat. A drop meant for this box is not one of those, so it stops
      // here rather than also arriving there as an attachment the model gets.
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
            // Recordings are the pane's to file — they go to the private folder,
            // which the session cannot write — so they open the batch dialog.
            if (kind === "recordings" && props.onRecordings) props.onRecordings();
            else props.ask(uploadPrompt(kind, props.runId, stored, note));
            close();
            return;
          }
          const file = files[index];
          setText("Uploading " + (index + 1) + " of " + files.length + " — " + file.name + "…");
          fetch(
            scoped(
              BASE + "/api/upload?run=" + encodeURIComponent(props.runId) +
                "&kind=" + encodeURIComponent(kind) +
                "&name=" + encodeURIComponent(file.name),
              props.sessionId,
            ),
            { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file },
          )
            .then((response) => response.json())
            .then((result) => {
              if (result.error) {
                // Stop at the first refusal and say which file. What already
                // went up stays up — it is in the private folder, renamed, and
                // an upload of it again is recognised rather than doubled.
                setPhase("error");
                // The browser half is read from disk on every load, the server
                // half once at boot — so a pane updated under a running harness
                // has this button and not the route behind it.
                const stale = /no route \/api\/upload/.test(String(result.error));
                setText(
                  file.name + ": " +
                    (stale
                      ? "the harness was started before uploads existed. Restart it, then upload again."
                      : result.error) +
                    (stored.length ? "\n\n" + stored.length + " file(s) before it were uploaded." : ""),
                );
                return;
              }
              stored.push(result);
              next(index + 1);
            })
            .catch((error) => {
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
            onDrop: stop,
          },
          h(
            "div",
            {
              className: "pp-modal pp-uploadmodal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Upload files",
              onMouseDown: (event) => event.stopPropagation(),
            },
            h(
              "div",
              { className: "pp-modalhead" },
              h("div", { className: "pp-modaltitle" }, "Upload · " + props.runId),
              h(
                "button",
                { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close },
                "×",
              ),
            ),
            h(
              "div",
              { className: "pp-publishbody" },
              h(
                "div",
                { className: "pp-approverow" },
                UPLOAD_KINDS.map((entry) =>
                  h(
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
                      key: entry.id,
                    },
                    entry.label,
                  ),
                ),
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
                  },
                },
                files.length === 0
                  ? "Drop files here, or press to choose"
                  : files.length + " file(s) — drop more, or press to add",
                h("input", {
                  ref: input,
                  type: "file",
                  multiple: true,
                  accept: spec.accept,
                  style: { display: "none" },
                  onChange: (event) => {
                    add(event.target.files);
                    event.target.value = "";
                  },
                }),
              ),
              files.length
                ? h(
                    "ul",
                    { className: "pp-uploadlist" },
                    files.map((file, index) =>
                      h(
                        "li",
                        { key: file.name + "|" + file.size },
                        h("span", { className: "pp-uploadname" }, file.name),
                        h("span", { className: "pp-as" }, " " + Math.max(1, Math.round(file.size / 1024)) + " KB"),
                        busy
                          ? null
                          : h(
                              "button",
                              {
                                type: "button",
                                className: "pp-modallink",
                                "aria-label": "Remove " + file.name,
                                onClick: () => setFiles((current) => current.filter((_, at) => at !== index)),
                              },
                              " remove",
                            ),
                      ),
                    ),
                  )
                : null,
              h("textarea", {
                className: "pp-publishtext pp-uploadnote",
                placeholder:
                  kind === "scans"
                    ? "Anything the assistant should know — which quiz this is, how many versions, a page scanned twice."
                    : "Anything the assistant should know — which exam, which file is the key, versions.",
                value: note,
                disabled: busy,
                "aria-label": "A note for the assistant",
                onChange: (event) => setNote(event.target.value),
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
                    title:
                      "Upload to the private folder outside the course, then tell the assistant in the chat where " +
                      "the files are. Nothing is graded or filed without asking you.",
                    onClick: upload,
                  },
                  busy ? "Uploading…" : "Upload and send to chat",
                ),
              ),
              phase === "idle"
                ? null
                : h(
                    "pre",
                    { className: "pp-publishout" + (phase === "error" ? " pp-approveerr" : "") },
                    text,
                  ),
            ),
          ),
        ),
        document.body,
      );
    }

    // ── client/pane.js

    // ----------------------------------------------------------------- pane

    /**
     * The pane.
     *
     * `sessionId` and the owner share arrive from the slot registration below;
     * `details` is a session-scoped slot, so this only ever renders with a
     * session open, which is also the only time there is anywhere to send a
     * widget's question.
     */
    function ProfessorPane(props) {
      const [tab, setTab] = React.useState("outline");
      // Which sub-view each tab is showing, keyed by tab. A map rather than one
      // piece of state per tab so that adding a tab to SUBVIEWS needs no new
      // state — and so that leaving a tab and coming back to it remembers where
      // the professor was, which one shared value could not do.
      const [subViews, setSubViews] = React.useState({});
      // Which card Integrations → This course should bring into view, from a jump
      // elsewhere (the sheet notice, Students' "Sync from sheet"). The tick makes
      // the same jump work twice.
      const [integrationsFocus, setIntegrationsFocus] = React.useState({ service: null, tick: 0 });
      const focusCard = (service) => {
        setTab("integrations");
        setSubViews((value) => Object.assign({}, value, { integrations: "course" }));
        setIntegrationsFocus((value) => ({ service, tick: value.tick + 1 }));
      };
      const subView = (tabId) => subViews[tabId] ?? defaultSub(tabId);
      // ON by default, which reverses the original decision here and is worth
      // recording rather than quietly flipping.
      //
      // The argument for `Record` was that the record is what a student may be
      // shown and what an LMS may be given, so the drafts view — what the term
      // looks like with every proposal marked `approval: draft` in it — is a
      // different question and the professor should be the one who asks it.
      //
      // That argument holds for a course being taught. It fails for a course
      // being BUILT, which is every course this pane has actually been opened
      // on: CSS-4007 has 15 drafted modules, 66 concepts, 8 assessments and 7
      // slide decks, and a record holding none of it. Defaulting to `Record`
      // meant the pane's first impression was sixteen empty weeks and a Tasks
      // tab saying there was nothing to do — while the work sat one toggle away.
      // An accurate view of an empty record is still the wrong thing to open on.
      //
      // The safeguard is unchanged and is what makes this safe: the merged view
      // carries a banner naming the directory it came from, so nothing drafted
      // is ever mistaken for something recorded. The professor can still ask the
      // other question — `Record` is one press away, and the segmented row makes
      // which one is live plain on screen.
      const [drafts, setDrafts] = React.useState(true);

      // Real names on the class list, on by default — see `IDENTITY_MODES`.
      //
      // Still not persisted, and that is no longer a safeguard but a
      // simplification: the initial state is the same every time, so what the
      // pane shows never depends on what was pressed in some earlier session.
      const [names, setNames] = React.useState(true);


      // Bumped after a write, and part of the frame's key, so the documents are
      // re-fetched. Without it the pane would go on drawing the course as it was
      // before the approval it just performed.
      const [reload, setReload] = React.useState(0);

      // The publication the professor is looking at, or null.
      //
      // Opened by the Publish button in the header, or by a press inside the
      // assessments frame, and held here for the reason the material overlay
      // is: the frame it came from remounts when the theme changes, and a plan
      // that vanished because the OS went dark would be a plan somebody re-ran
      // against GitHub for nothing.
      //
      // `phase` is idle | running | preview | done | error, the approval
      // strip's states and for its reason: only `preview` offers the writing
      // button, so a plan read before the message was edited cannot be sent.
      const [publishing, setPublishing] = React.useState(null);

      /** A fresh dialog for one target, with whatever is already known filled in. */
      const openPublish = (target, extra) =>
        setPublishing({
          target,
          assessment: "",
          label: "",
          repo: "",
          group: "",
          message: "",
          edit: false,
          phase: "idle",
          text: "",
          ...(extra || {}),
        });

      /**
       * Editing any input throws the plan away.
       *
       * The rule `Send to Canvas` established: the red button may only ever
       * send what the plan above it described. Changing the target, the
       * assessment, the repository or a word of the announcement means the
       * plan on screen is about something else, so it goes back to `idle` and
       * the writing button disappears until the professor reads a new one.
       */
      const setPublishField = (field, value) =>
        setPublishing((state) =>
          state === null ? state : { ...state, [field]: value, phase: "idle", text: "" },
        );

      // The material the professor is reading over the page, or null.
      //
      // Held on the pane rather than in the frame that opened it. The widget
      // frames are re-keyed on run, theme, drafts and identity and remount on
      // any of them; an overlay owned by one of those would vanish mid-slide
      // because the OS went dark. It closes when the professor closes it.
      const [material, setMaterial] = React.useState(null);
      // The upload dialog, open or not. Not held by a frame for the material
      // overlay's reason: a theme change mid-upload must not lose the files.
      const [uploading, setUploading] = React.useState(false);
      // Course mode open or not. Not persisted: like the column itself, it
      // opens on a press, and a reload is back in the conversation.
      const [courseMode, setCourseMode] = React.useState(false);
      // Read by the message handler, which is registered once per `ask` and
      // would otherwise see the value from when it was registered.
      const courseModeRef = React.useRef(false);
      courseModeRef.current = courseMode;
      // The run on screen, for the same reason: *Start defence* is answered by
      // that handler, and the run is chosen after it was registered.
      const currentRunRef = React.useRef(null);
      // The defence desk, open on one student or not.
      const [desk, setDesk] = React.useState(null);
      // The recorded-defences dialog (DEF-6), open or not.
      const [batch, setBatch] = React.useState(false);
      // The Grade view and the Scans window, opened from an assessment chip in
      // course mode: `{ assessment, label }` and an assessment id, or null.
      const [grading, setGrading] = React.useState(null);
      const [scansPile, setScansPile] = React.useState(null);

      // Open the column this pane lives in, once per session.
      //
      // `details` starts closed and its geometry is transient: `ui-layout`'s
      // store "never reads or writes localStorage", a reload restores it
      // closed, and selecting a different session closes it before paint. So
      // without this the pane is a button press away every single time, which
      // is not what a professor asked for when they asked for a course pane.
      //
      // Keyed on the session and nothing else, through a ref, so it fires on
      // mount and on a session switch but NEVER on a re-render. That is the
      // whole reason for the ref: the owner share is rebuilt as the entry
      // re-renders, and an effect depending on the function's identity would
      // re-open the column moments after the professor pressed × — a close
      // button that does not close is worse than no close button.
      //
      // Not guarded on window width, deliberately. Below about 1220px the
      // concession chain derives a zero width without touching the preference,
      // and "the panel restores itself when the window widens" — so asking for
      // it open on a narrow window is the right request to have on file.
      const openRef = React.useRef(props.openDetails);
      openRef.current = props.openDetails;
      React.useEffect(() => {
        openRef.current();
      }, [props.sessionId]);

      // The chosen run belongs to the workspace it was chosen in. Switching
      // sessions may switch workspaces, and a stale id would silently fall back
      // to "the first run of the first course" — right by luck, wrong when the
      // new workspace has several.
      React.useEffect(() => {
        setChosen(null);
      }, [props.sessionId]);
      const [chosen, setChosen] = React.useState(null);
      const dark = useDark();
      // Re-fetched when the session changes, because a different session may be
      // a different workspace and therefore a different set of courses.
      const runs = useJson(scoped(BASE + "/api/runs", props.sessionId));

      // Anything that writes to the workspace redraws the pane, whoever wrote
      // it. `setReload` is the same counter an approval bumps, so a change
      // arriving from outside and one made here take the identical path.
      useRevisionWatch(scoped(BASE + "/api/revision", props.sessionId), () => {
        setReload((count) => count + 1);
      });

      // Two things the widgets send up. They reach the harness as a
      // postMessage from a sandboxed frame, so the origin check is `null` — an
      // opaque origin is what a frame with no `allow-same-origin` has, and
      // requiring the page's own origin here would reject every message the
      // pane is meant to receive. What makes each one safe is its payload
      // contract, not the origin:
      //
      // * `ask` is one string, sent as a prompt, into the session the
      //   professor already has open.
      // * `view` is a URL that is opened only if it is this app's own material
      //   route — see `materialUrl`, which is the whole of the check. A frame
      //   that asked for anything else gets silence, not a frame.
      React.useEffect(() => {
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.source !== "professor-pane") return;
          if (data.kind === "ask") {
            if (typeof data.prompt !== "string" || data.prompt.trim() === "") return;
            props.ask(data.prompt);
            // Chat as a button: a press in course mode starts the turn and
            // gets out of its way, so the professor watches it answer.
            if (courseModeRef.current) setCourseMode(false);
            return;
          }
          // *Start defence*: clone the fork here, through the server, then hand
          // the drafting to the session — the model the professor is talking
          // to drafts the questions. A failed clone goes to the session too,
          // with what `defence prepare` said, so the answer arrives where the
          // professor is already looking; the pane has no place of its own
          // for it, and the redraw puts the button back.
          if (data.kind === "defence-desk") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            if (!id.test(String(data.assessment)) || !id.test(String(data.student))) return;
            setDesk({ assessment: data.assessment, student: data.student });
            return;
          }
          // *Defended* / *Not defended*: the professor's word, written onto the
          // submission by the server (`defence mark`); the redraw shows it.
          if (data.kind === "defended") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            const run = currentRunRef.current;
            if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
            if (!["defended", "not_defended", "clear"].includes(data.outcome)) return;
            fetch(
              scoped(
                BASE + "/api/defence/mark?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment) +
                  "&student=" + encodeURIComponent(data.student) +
                  "&outcome=" + encodeURIComponent(data.outcome),
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then(() => setReload((count) => count + 1))
              .catch(() => setReload((count) => count + 1));
            return;
          }
          // A fork the student brought in person (`defence fork`). A link the
          // command refuses comes back as its own words, since the frame that
          // asked has no place to show them.
          // *Audio defence* on a homework with nothing handed in: a submission
          // with no link is recorded first, so the desk has one to file under.
          if (data.kind === "defence-audio") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            const run = currentRunRef.current;
            if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
            fetch(
              scoped(
                BASE + "/api/defence/fork?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment) +
                  "&student=" + encodeURIComponent(data.student) + "&inperson=1",
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then((response) => response.json())
              .then((result) => {
                setReload((count) => count + 1);
                if (!result.ok) {
                  window.alert(String(result.error || result.output || "the defence could not be started").trim().split("\n").slice(-2).join(" "));
                  return;
                }
                setDesk({ assessment: data.assessment, student: data.student });
              })
              .catch(() => setReload((count) => count + 1));
            return;
          }
          // *Find forks*: the starter's public forks, looked up on GitHub by the
          // server; the redraw offers each student their own.
          if (data.kind === "homework-forks") {
            const run = currentRunRef.current;
            if (!run || !/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(String(data.assessment))) return;
            fetch(
              scoped(
                BASE + "/api/homework/forks?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment),
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then((response) => response.json())
              .then((result) => {
                if (!result.ok) {
                  window.alert(String(result.error || result.output || "the forks could not be looked up").trim().split("\n").slice(-2).join(" "));
                }
                setReload((count) => count + 1);
              })
              .catch(() => setReload((count) => count + 1));
            return;
          }
          if (data.kind === "defence-fork") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            const run = currentRunRef.current;
            if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
            if (typeof data.url !== "string" || !/^https:\/\/\S+$/.test(data.url.trim())) {
              window.alert("A fork link starts with https://");
              setReload((count) => count + 1);
              return;
            }
            fetch(
              scoped(
                BASE + "/api/defence/fork?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment) +
                  "&student=" + encodeURIComponent(data.student) +
                  "&url=" + encodeURIComponent(data.url.trim()),
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then((response) => response.json())
              .then((result) => {
                if (!result.ok) {
                  const said = String(result.error || result.output || "the link was not saved").trim().split("\n").slice(-2).join(" ");
                  window.alert(said);
                }
                setReload((count) => count + 1);
              })
              .catch(() => setReload((count) => count + 1));
            return;
          }
          // One rubric criterion checked at the defence (`defence mark --criterion`):
          // the mark changes in the course, and the redraw shows it.
          if (data.kind === "defence-check") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            const run = currentRunRef.current;
            if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student)) || !id.test(String(data.criterion))) return;
            if (!["confirmed", "partly", "not_confirmed", "clear"].includes(data.outcome)) return;
            const score = typeof data.score === "number" && Number.isFinite(data.score) ? "&score=" + data.score : "";
            fetch(
              scoped(
                BASE + "/api/defence/mark?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment) +
                  "&student=" + encodeURIComponent(data.student) +
                  "&criterion=" + encodeURIComponent(data.criterion) +
                  "&outcome=" + encodeURIComponent(data.outcome) + score,
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then(() => setReload((count) => count + 1))
              .catch(() => setReload((count) => count + 1));
            return;
          }
          if (data.kind === "defence") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            const run = currentRunRef.current;
            if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
            fetch(
              scoped(
                BASE + "/api/defence/prepare?run=" + encodeURIComponent(run) +
                  "&assessment=" + encodeURIComponent(data.assessment) +
                  "&student=" + encodeURIComponent(data.student),
                props.sessionId,
              ),
              { method: "POST" },
            )
              .then((response) => response.json())
              .then((result) => {
                setReload((count) => count + 1);
                if (result.ok && result.ask) {
                  props.ask(result.ask);
                  return;
                }
                const said = String(result.error || result.output || "no output").trim().split("\n").slice(-3).join(" ");
                props.ask(
                  "/defend-submission " + data.assessment + " " + run + " " + data.student +
                    " — the clone failed: " + said,
                );
              })
              .catch(() => setReload((count) => count + 1));
            return;
          }
          // From an assessment chip in course mode: the Grade view, or the Scans
          // tab as a window on that pile. Each opens over course mode, which stays.
          if (data.kind === "grade" || data.kind === "scans") {
            const id = /^[A-Z0-9][A-Z0-9-]*$/;
            if (!id.test(String(data.assessment))) return;
            if (data.kind === "scans") setScansPile(data.assessment);
            else setGrading({ assessment: data.assessment, label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.assessment });
            return;
          }
          // The Students tab's "Sync from sheet": the Syncs view, where the sheet
          // is read directly or brought in as a downloaded file.
          if (data.kind === "syncs") {
            focusCard("sheets");
            if (courseModeRef.current) setCourseMode(false);
            return;
          }
          if (data.kind === "publish") {
            if (typeof data.assessment !== "string" || data.assessment.trim() === "") return;
            // The starter repository unless the press names the Canvas brief.
            openPublish(data.target === "canvas" ? "canvas" : "homework", {
              assessment: data.assessment.trim(),
              label: typeof data.label === "string" ? data.label : data.assessment,
            });
            return;
          }
          if (data.kind === "view") {
            const url = materialUrl(data.url);
            if (url === null) return;
            const label = typeof data.label === "string" && data.label.trim() !== ""
              ? data.label.trim()
              : "Material";
            // The extension decides how the frame is sandboxed and nothing
            // else; an unrecognised one takes the stricter branch.
            const format = typeof data.format === "string" ? data.format.toLowerCase() : "";
            // The versions of an exam, when the chip carried them. Each URL
            // passes the same `materialUrl` check the single one does, so a list
            // is no wider a door than a link: an entry that fails is dropped,
            // and a list that ends up with one paper is just that paper.
            let papers = [];
            try {
              const listed = typeof data.papers === "string" ? JSON.parse(data.papers) : data.papers;
              papers = (Array.isArray(listed) ? listed : [])
                .slice(0, 8)
                .map((paper) => ({
                  url: materialUrl(paper && paper.url),
                  label: paper && typeof paper.label === "string" && paper.label.trim() !== ""
                    ? paper.label.trim()
                    : "Paper",
                  format: paper && typeof paper.format === "string" ? paper.format.toLowerCase() : "",
                }))
                .filter((paper) => paper.url !== null);
            } catch {
              papers = [];
            }
            setMaterial({ url, label, format, papers });
          }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
      }, [props.ask]);

      // Which run the pane is on: the professor's choice if they made one, else
      // the first run of the first course that has one. A workspace with no
      // readable offering leaves this null and the body says so.
      const courses = runs.phase === "ready" && !runs.value.error ? runs.value.courses || [] : [];
      const options = [];
      for (const course of courses) {
        for (const run of course.runs) {
          options.push({
            runId: run.run_id,
            courseId: course.course_id,
            term: run.term,
            label: course.course_id + " · " + run.term,
            title: course.title,
            start: run.start_date,
            end: run.end_date,
            instructors: run.instructors || [],
          });
        }
      }
      const current = options.find((option) => option.runId === chosen) || options[0] || null;
      currentRunRef.current = current ? current.runId : null;

      // Switching run returns to the default rather than carrying the last
      // press across. It matters in one direction now: a professor who pressed
      // `Pseudonyms` to cover one class list was covering THAT list, and the
      // press should not go on quietly hiding a different cohort they navigate
      // to next and expect to be able to read.
      React.useEffect(() => {
        setNames(true);
      }, [current ? current.runId : null]);

      /**
       * Plan or perform a publication, on the server.
       *
       * The same route either way; `confirm` is the difference between reading
       * and writing, and the professor supplies it by pressing the second
       * button rather than the first. What is typed here — a repository the
       * assessment does not name, a subgroup, the announcement itself — is
       * passed through and never guessed, on either side of the wire.
       *
       */
      const runPublish = (confirm) => {
        if (!current || !publishing) return;
        setPublishing((state) => ({
          ...state,
          phase: "running",
          text: confirm ? "Publishing…" : "Reading…",
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
            confirm,
          }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.error) {
              setPublishing((state) => state && { ...state, phase: "error", text: result.error });
              return;
            }
            setPublishing(
              (state) =>
                state && {
                  ...state,
                  phase: result.ok ? (confirm ? "done" : "preview") : "error",
                  text: result.output || "(the command said nothing)",
                },
            );
            // Publishing can write `extensions.github` back onto the record, so
            // the frames are re-fetched for the same reason approval re-fetches.
            if (confirm && result.ok) setReload((value) => value + 1);
          })
          .catch((error) =>
            setPublishing((state) => state && { ...state, phase: "error", text: String(error) }),
          );
      };

      const body = () => {
        if (runs.phase === "loading") return h(Message, null, "Reading the workspace…");
        if (runs.value.error) return h(Message, { error: true }, runs.value.error);
        if (tab === "preferences") {
          return h(Preferences, {
            courseId: current ? current.courseId : "",
            term: current ? current.term : "",
            sessionId: props.sessionId,
          });
        }
        // Integrations is NOT checked here beside Preferences, and the
        // difference is the point: Preferences is not a view of a run and draws
        // without one, while everything on Integrations hangs off the run
        // record. With no offering to read there is nothing for it to draw, so
        // it falls through to the sentence below, which is the accurate one.
        if (current === null) {
          // Not an empty state. A course whose `runs` came back empty is a
          // course the loader read and found no offering in, and the pane says
          // which courses those are rather than looking like it failed to load.
          return h(
            Message,
            { error: true },
            courses.length === 0
              ? "This workspace holds no courses."
              : "No course here has an offering the course model can read: " +
                courses.map((course) => course.course_id).join(", ") +
                ". A run needs version.yaml with start_date and end_date. " +
                "Run `python -m ainar validate` for the specifics.",
          );
        }
        if (tab === "scans") {
          return h(ScansTab, {
            runId: current.runId,
            sessionId: props.sessionId,
            names: names,
            ask: props.ask,
            // A placement writes a submission into the course, which other tabs draw.
            onWrite: () => setReload((value) => value + 1),
            revision: reload,
            key: current.runId,
          });
        }
        if (tab === "integrations") {
          return h(Integrations, {
            runId: current.runId,
            subView: subView(tab),
            sessionId: props.sessionId,
            // A Save writes the run record, which every other tab is drawing.
            // The same counter an approval bumps, so a change made here and one
            // arriving from outside take the identical path.
            onWrite: () => setReload((value) => value + 1),
            // Passed as a prop rather than put in the `key`, which is the
            // opposite of what every widget view does here and is deliberate.
            // A bumped key REMOUNTS, and this component holds something a
            // remount would throw away: the sections fetched from Canvas. The
            // professor presses Fetch, ticks two sections, presses Save — and a
            // remount at that moment would empty the list they had just used
            // and make them spend another request to get it back. The component
            // puts this in its own fetch URL instead, so the record is re-read
            // and the catalogue survives.
            revision: reload,
            names: names,
            ask: props.ask,
            focus: integrationsFocus,
            key: current.runId,
          });
        }
        if (tab === "tasks" && subView(tab) === "unpublished") {
          return h(Unpublished, {
            runId: current.runId,
            sessionId: props.sessionId,
            revision: reload,
            onWrite: () => setReload((value) => value + 1),
            openPublish: openPublish,
            ask: props.ask,
            names: names,
            key: current.runId,
          });
        }
        const view = SUBVIEWS[tab] ? subView(tab) : TABS.find((t) => t.id === tab).view;
        const frame = h(WidgetFrame, {
          view: view,
          runId: current.runId,
          dark: dark,
          drafts: drafts,
          // Only the class list resolves identities, so only it is ever asked
          // to. A `names` state left on while the professor moves to the
          // gradebook must not quietly name people there too.
          names: NAMED_TABS.has(tab) && names,
          sessionId: props.sessionId,
          title: TABS.find((t) => t.id === tab).label,
          // Run, view, theme, draft mode and identity mode in the key:
          // switching any of them replaces the frame rather than leaving a
          // document holding a payload for a question the professor is no
          // longer asking. Identity belongs here for a sharper reason than the
          // others — a frame kept across the switch back to Pseudonyms would go
          // on displaying the names it already had.
          key:
            view +
            "|" +
            current.runId +
            "|" +
            (tab === "students" && names ? "n" : "p") +
            "|" +
            (dark ? "d" : "l") +
            "|" +
            (drafts ? "m" : "r") +
            "|" +
            reload,
        });
        if (tab === "progress" && view === "gradebook") {
          return h(
            React.Fragment,
            null,
            h(GradebookStatus, {
              runId: current.runId,
              sessionId: props.sessionId,
              revision: reload,
              key: "status|" + current.runId,
              names: names,
              ask: props.ask,
              onWrite: () => setReload((value) => value + 1),
            }),
            h(RecentMarks, {
              runId: current.runId,
              sessionId: props.sessionId,
              revision: reload,
              names: names,
              key: "recent|" + current.runId,
            }),
            frame,
          );
        }
        return frame;
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
            // The term plan as the page, over the harness. Beside Publish
            // because, like it, it is about the run rather than about the tab.
            current
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-publishbtn",
                    title:
                      "The whole term in three columns over the conversation. Press a hole " +
                      "to have the assistant fill it; Esc returns to the chat.",
                    onClick: () => setCourseMode(true),
                  },
                  "Course mode",
                )
              : null,
            // Publishing is not a tab and not a sub-view, and putting it here
            // is the argument: every other control in this header chooses what
            // to LOOK at, and this one is the only thing in the pane a person
            // outside this machine ever sees the result of. It sits beside the
            // title because it belongs to the run rather than to whichever
            // view happens to be open — a professor deciding to put the week
            // in front of the class should not first have to be on the right
            // tab. Absent with no offering, since there would be nothing to
            // publish.
            current
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-publishbtn",
                    title:
                      "The course page, an announcement, a homework repository or a " +
                      "Canvas brief. Reads and shows a plan first; anything still marked " +
                      "approval: draft is left out.",
                    onClick: () => openPublish("page"),
                  },
                  "Publish",
                )
              : null,
            // The way in for files the chat cannot take: a scanned pile, an
            // exam paper, its key. Beside Publish because it is the other half
            // of the same edge — what comes in from paper, against what goes out.
            current
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-publishbtn",
                    title:
                      "Scanned papers, or an exam paper and its key. Kept outside the course; " +
                      "the assistant is told where they are and asks before filing or grading anything.",
                    onClick: () => setUploading(true),
                  },
                  "Upload",
                )
              : null,
            h(
              "button",
              {
                type: "button",
                className: "pp-close",
                "aria-label": "Close the pane",
                onClick: props.closeDetails,
              },
              "×",
            ),
          ),
          h(
            "p",
            { className: "pp-sub" },
            current
              ? current.runId +
                " · " +
                (current.start && current.end
                  ? current.start + " to " + current.end
                  : "term dates not recorded")
              : runs.phase === "loading"
                ? " "
                : "no offering",
          ),
          options.length > 1
            ? h(
                "select",
                {
                  className: "pp-runs",
                  value: current ? current.runId : "",
                  onChange: (event) => setChosen(event.target.value),
                  "aria-label": "Which run",
                },
                options.map((option) =>
                  h("option", { value: option.runId, key: option.runId }, option.label),
                ),
              )
            : null,
          h(
            "div",
            { className: "pp-tabs", role: "tablist" },
            TABS.map((entry) =>
              h(
                "button",
                {
                  type: "button",
                  role: "tab",
                  className: "pp-tab",
                  "aria-selected": tab === entry.id,
                  // The label is the accessible name and the hint is only the
                  // hover text. A bare `title` would become the name instead,
                  // which reads as "Resolved, read-only" in a screen reader
                  // where the button says "Preferences".
                  "aria-label": entry.label,
                  title: entry.hint,
                  onClick: () => setTab(entry.id),
                  key: entry.id,
                },
                entry.label,
              ),
            ),
          ),
        ),
        // The segmented row: which document, which halves of the course it is
        // computed over, and — on the class list only — whether people are
        // named. Preferences has none of it; it is not a view of a run.
        //
        // Students gets no Record / + drafts pair, because enrollments are not
        // agent-writable: there is no drafted class list and never will be, and a pair that changed nothing would be a control implying
        // an answer it does not have. It gets the identity pair instead.
        NO_SEGMENTED_ROW.has(tab)
          ? null
          : h(
              "div",
              { className: "pp-seg" },
              SUBVIEWS[tab]
                ? SUBVIEWS[tab].map((entry) =>
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        "aria-pressed": subView(tab) === entry.id,
                        onClick: () =>
                          setSubViews((current) =>
                            Object.assign({}, current, { [tab]: entry.id }),
                          ),
                        key: entry.id,
                      },
                      entry.label,
                    ),
                  )
                : null,
              h("span", { className: "pp-segspacer" }),
              NO_DRAFT_PAIR.has(tab)
                ? null
                : DRAFT_MODES.map((entry) =>
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn",
                        "aria-pressed": drafts === entry.drafts,
                        title: entry.hint,
                        onClick: () => setDrafts(entry.drafts),
                        key: entry.label,
                      },
                      entry.label,
                    ),
                  ),
              NAMED_TABS.has(tab)
                ? IDENTITY_MODES.map((entry) =>
                    h(
                      "button",
                      {
                        type: "button",
                        className:
                          "pp-segbtn" + (entry.names && names ? " pp-segbtn-warn" : ""),
                        "aria-pressed": names === entry.names,
                        title: entry.hint,
                        onClick: () => setNames(entry.names),
                        key: entry.label,
                      },
                      entry.label,
                    ),
                  )
                : null,
            ),
        // Marks a grade-sheet sync brought in since this browser last looked,
        // whoever ran it. Over every tab, since a sync is news wherever one is.
        current
          ? h(SheetNotice, {
              runId: current.runId,
              sessionId: props.sessionId,
              revision: reload,
              key: "notice|" + current.runId,
              onOpen: () => {
                setTab("progress");
                setSubViews((value) => Object.assign({}, value, { progress: "gradebook" }));
              },
              onSync: () => {
                focusCard("sheets");
              },
            })
          : null,
        h("div", { className: "pp-body" }, body()),
        publishing === null
          ? null
          : h(PublishModal, {
              state: publishing,
              run: runPublish,
              setTarget: (target) => setPublishField("target", target),
              setField: setPublishField,
              onClose: () => setPublishing(null),
            }),
        courseMode && current
          ? h(CourseMode, {
              title: current.title || current.label,
              runId: current.runId,
              start: current.start,
              end: current.end,
              sessionId: props.sessionId,
              dark: dark,
              drafts: drafts,
              setDrafts: setDrafts,
              reload: reload,
              covered:
                material !== null || publishing !== null || uploading || batch ||
                desk !== null || grading !== null || scansPile !== null,
              onPublish: () => openPublish("page"),
              onUpload: () => setUploading(true),
              // For Files: a pile in the Scans window, the batch in the recordings dialog.
              onOpenScans: (assessment) => setScansPile(assessment),
              onRecordings: () => setBatch(true),
              // For Students, Gradebook and Tasks: the pane's own identity choice, and what the
              // Unpublished view needs to send — the same props its tab gets.
              names: names,
              setNames: setNames,
              ask: props.ask,
              openPublish: openPublish,
              onWrite: () => setReload((value) => value + 1),
              tabs: TABS,
              onJump: (id) => {
                setTab(id);
                setCourseMode(false);
                if (props.openDetails) props.openDetails();
              },
              onClose: () => setCourseMode(false),
            })
          : null,
        desk && current
          ? h(DefenceDesk, {
              runId: current.runId,
              sessionId: props.sessionId,
              assessment: desk.assessment,
              student: desk.student,
              ask: props.ask,
              reload: reload,
              onClose: () => setDesk(null),
            })
          : null,
        grading && current
          ? h(GradeBoard, {
              runId: current.runId,
              sessionId: props.sessionId,
              assessmentId: grading.assessment,
              title: grading.label,
              names: names,
              revision: reload,
              ask: props.ask,
              onWrite: () => setReload((value) => value + 1),
              onClose: () => setGrading(null),
            })
          : null,
        scansPile && current
          ? h(ScansModal, {
              runId: current.runId,
              sessionId: props.sessionId,
              pile: scansPile,
              names: names,
              revision: reload,
              ask: props.ask,
              onWrite: () => setReload((value) => value + 1),
              onClose: () => setScansPile(null),
            })
          : null,
        batch && current
          ? h(BatchModal, {
              runId: current.runId,
              sessionId: props.sessionId,
              onClose: () => setBatch(false),
            })
          : null,
        uploading && current
          ? h(UploadModal, {
              runId: current.runId,
              sessionId: props.sessionId,
              ask: props.ask,
              onRecordings: () => setBatch(true),
              onClose: () => setUploading(false),
            })
          : null,
        material === null
          ? null
          : h(MaterialModal, {
              url: material.url,
              label: material.label,
              format: material.format,
              papers: material.papers,
              // A draft written under course mode's veil is a draft nobody sees:
              // the mention lands in the composer, so get out of its way, as an
              // `ask` from the page does.
              mention: props.mention && ((text) => {
                const written = props.mention(text);
                if (written) setCourseMode(false);
                return written;
              }),
              onClose: () => setMaterial(null),
            }),
      );
    }

    // --------------------------------------------------------------- plugin

    /**
     * `layout` for the open/close verbs, `slots` for the two seats, `sessions`
     * to resolve the session a widget's question should be asked in.
     */
    const inject = ["slots", "layout", "sessions", "conversation"];

    /**
     * The opener.
     *
     * Nothing in the shipped harness opens the details column, so a pane that
     * only registered into `details` would be a pane nobody could reach. This
     * puts one button in the session header beside the job list.
     */
    function OpenPaneAction(props) {
      return h(
        "button",
        {
          type: "button",
          className: "pp-tab",
          title: "The course, in the right pane",
          onClick: props.openPane,
        },
        "Course",
      );
    }

    // ── client/main.js

    /**
     * @param ctx - client root context.
     */
    function apply(ctx) {
      /**
       * Send a widget's question into one session.
       *
       * `sessions.scope(id)` then `sessionOf` is how `ui-conversation` reaches
       * a session's behaviour verbs, and `prompt(..., 'queue')` is its own
       * `send`: appended as a turn rather than steering the running one, so a
       * button press while the model is working does not interrupt it.
       */
      const ask = (sessionId) => (text) => {
        const scope = ctx.sessions.scope(sessionId);
        const session = scope === undefined ? undefined : ctx.sessions.sessionOf(scope);
        if (session === undefined) return;
        Promise.resolve(session.prompt([{ type: "text", text: text }], "queue")).catch(() => {});
      };

      /**
       * Put a mention of something into the composer, and send nothing.
       *
       * The opposite half of `ask`, and the difference is whose sentence it is.
       * `ask` carries a question this pane already knows how to phrase — "what
       * should I teach this week" — and sends it. This one carries only the
       * NAME of what the professor is looking at, into the draft, with the
       * caret after it: the question is theirs to type, and the identifier
       * spares the model a search for which of forty documents was meant.
       *
       * Appends rather than replaces. A half-typed question in the composer is
       * work, and a button that discards it to make room for a filename would
       * be the pane deciding it matters more than the professor's sentence.
       *
       * Returns whether the draft was actually written, because the caller
       * draws a different outcome for "no" — this reaches across a plugin
       * boundary to `ui-conversation`, and a composition without it is a real
       * arrangement rather than a broken one.
       */
      const mention = (sessionId) => (text) => {
        const scope = ctx.sessions.scope(sessionId);
        if (scope === undefined) return false;
        const resolver = ctx.conversation === undefined ? undefined : ctx.conversation.input;
        const input = resolver === undefined ? undefined : resolver.for(scope);
        if (input === undefined || typeof input.setDraft !== "function") return false;
        // `getSnapshot()`, not a `.snapshot` property: `SnapshotStore` is the
        // `useSyncExternalStore` shape, and reading the property that is not
        // there yields undefined rather than throwing — which is how the first
        // version of this silently replaced a half-typed question instead of
        // appending to it. Guarded anyway, because this is another package's
        // store and a read that throws must not cost the professor their draft.
        let current = "";
        try {
          const state = input.state;
          const snapshot =
            state !== undefined && typeof state.getSnapshot === "function"
              ? state.getSnapshot()
              : undefined;
          const draft = snapshot === undefined ? undefined : snapshot.draft;
          if (typeof draft === "string") current = draft;
        } catch {
          current = "";
        }
        // One space between what was there and what arrives, and none when the
        // draft is empty — the composer is a sentence being written, not a log.
        const trimmed = current.replace(/\s+$/, "");
        input.setDraft(trimmed === "" ? text : trimmed + " " + text);
        return true;
      };

      ctx.slots.inject("details", () =>
        ctx.slots.register(
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
            }),
          },
          ProfessorPane,
        ),
      );

      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.actions",
            id: "professor-pane",
            order: 10,
            inject: () => ({ openPane: () => ctx.layout.openDetails() }),
          },
          OpenPaneAction,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    // For the tests only: the end-of-answer detector is the one piece of the
    // desk that is logic rather than wiring, and the desk itself is mounted
    // alone by `test/desk-page.mjs`, against a mock API and a synthetic voice.
    exports.turnStep = turnStep;
    exports.DefenceDesk = DefenceDesk;
    // The same, for `test/integrations-page.mjs`: Integrations (and course mode
    // over it, with `?course=1`) against the real run, every write answered from
    // memory, and made-up names in the review list.
    exports.CourseMode = CourseMode;
    exports.Integrations = Integrations;
    // And the grade sheet's notice and "Last added", against made-up marks.
    exports.SheetNotice = SheetNotice;
    exports.RecentMarks = RecentMarks;
    return module.exports;
  },
});
