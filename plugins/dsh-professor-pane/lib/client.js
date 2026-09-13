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

    const React = require("react");
    // For one thing only: the material overlay. Everything else in this file
    // renders inside the column; a deck cannot, so it is portalled to the body.
    const ReactDOM = require("react-dom");
    const h = React.createElement;

    /** Kept in step with `BASE` in index.js by hand; there are two of them. */
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
     * The pane knew about its own writes — an approval bumped `reload` — and
     * about nothing else. An agent setting a due date, `bin/ainar approve` in a
     * terminal, a file edited by hand: all of them left the professor reading a
     * page that no longer matched the record, with nothing on screen to say so.
     * A course model is the sort of thing two people and a model all write to,
     * so "it changed" has to be observed rather than assumed.
     *
     * `/api/revision` hashes the size and mtime of every YAML under `courses/`
     * and `work/`. This polls it and calls `onChange` when the answer differs
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
      ],
      // Targets first, because "where would a grade go" is the question that
      // brings a professor here; Credentials second, because it is the usual
      // answer to why it would not get there; Links last, because it is the
      // longest and the only one that writes.
      //
      // Unlike every other row in this table these are NOT separate documents
      // — `/api/integrations` answers all three at once, and the row picks
      // which sections of that one payload to draw. Three fetches for three
      // views of five small files would be three chances to show a professor a
      // host from one read and a token from another.
      integrations: [
        // First, and therefore the default. The question a professor opens
        // this tab with is "is it set up", and the three views below answer
        // it only by making them read five facts and do the arithmetic.
        { id: "status", label: "Status" },
        { id: "targets", label: "Targets" },
        { id: "credentials", label: "Credentials" },
        { id: "links", label: "Links" },
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
     * class list has no draftable half, since `DRAFTABLE` refuses enrollments
     * in a draft file.
     *
     * Students is in this set and still draws a row: the identity pair below
     * is its own control and has nothing to do with drafts.
     *
     * Integrations is in it for Preferences' reason and one sharper one. Its
     * subject is what the run is wired to — a Canvas host, a token, a section
     * id — and none of that is draftable: `DRAFTABLE` does not accept
     * `versions`, so there is no proposed half of an LMS linkage anywhere for a
     * `+ drafts` press to reveal. A pair there would imply the course record
     * and the work directory could disagree about which Canvas to push to.
     */
    const NO_DRAFT_PAIR = new Set(["preferences", "students", "integrations"]);

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
    const NAMED_TABS = new Set(["students", "tasks"]);

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
     * Not a display option. `courses/` is the record — what a person or `ainar
     * approve` wrote — and `work/<RUN>/` is what the skills proposed and nobody
     * has accepted. "Record" answers what a student may be shown; "+ drafts"
     * answers what the term would look like if every proposal were accepted.
     * They are different questions and the pane never merges the two silently:
     * the merged view carries a banner naming the directory it came from.
     */
    const DRAFT_MODES = [
      { label: "Record", drafts: false, hint: "courses/ only — what is approved" },
      { label: "+ drafts", drafts: true, hint: "with unapproved proposals from work/<RUN>/" },
    ];

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
.pp-approveout{margin:8px 0 0;padding:8px 10px;max-height:180px;overflow:auto;
  white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.5;
  border-radius:6px;background:var(--dsw-alias-fill-secondary,#f5f5f7);
  color:var(--dsw-alias-label-secondary,#3a3a3a)}
.pp-approveerr{color:#b4342a}
.pp-body{flex:1;min-height:0;display:flex;flex-direction:column}
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
.pp-modalframe{flex:1;min-height:0;width:100%;border:0;display:block;background:#fff}
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

    /**
     * What this run is wired to, and what it is not.
     *
     * Drawn here rather than served as a document for `WidgetFrame`'s reason:
     * the Links view has a form, and a frame with no `allow-same-origin` cannot
     * call back to the routes it would post to.
     *
     * One fetch for three sub-views. `/api/integrations` reads five files and
     * five environment variables, and splitting it per view would be three
     * chances to show a host from one read beside a token from another.
     */
    function Integrations(props) {
      const url = scoped(
        BASE +
          "/api/integrations?run=" +
          encodeURIComponent(props.runId || "") +
          // The revision counter, in the URL because `useJson` re-fetches when
          // its URL changes and on nothing else. The route does not read `r`
          // and does not need to — its only job is to make an `ainar lms` run
          // in a terminal, or a hand-edited version.yaml, redraw this tab. See
          // the `revision` prop in the pane for why this is not a remount.
          "&r=" +
          encodeURIComponent(String(props.revision || 0)),
        props.sessionId,
      );
      const state = useJson(url);
      // What a Save handed back, which is the record as it now is. Preferred
      // over the fetch for the reason `Preferences` prefers it: the form should
      // redraw from disk rather than from its own memory of what was ticked.
      const [fresh, setFresh] = React.useState(null);
      // The live Canvas answer. Never fetched on render — only when the
      // professor presses for it, because the request spends their API quota
      // and sends their token. `null` means nobody has asked yet, which is a
      // different state from "asked and Canvas returned nothing".
      const [catalogue, setCatalogue] = React.useState(null);
      const [fetching, setFetching] = React.useState(false);
      // Ticked sections, keyed `<kind>:<id>`, with the subgroup each feeds.
      // Seeded from the record and reseeded after a Save, so Revert has
      // something true to go back to.
      const [picked, setPicked] = React.useState(null);
      // One slot for both buttons, and therefore tagged with `from`.
      //
      // Untagged, this printed every failure in both places: a Canvas
      // precondition error appeared under `Fetch from Canvas` AND again beside
      // `Save to the run record`, which reads as two separate faults and
      // blames the save for something the fetch said. A message belongs under
      // the button that produced it.
      const [status, setStatus] = React.useState(null);
      const failure = (from) =>
        status && status.error && status.from === from ? status.error : null;

      const data =
        fresh || (state.phase === "ready" && !state.value.error ? state.value : null);

      const seed = (rows) => {
        const out = {};
        for (const row of rows || []) {
          out[row.kind + ":" + row.id] = { id: row.id, kind: row.kind, name: row.name, group: row.group };
        }
        return out;
      };

      // Reseed when the record changes under the form.
      //
      // Nothing here has to clear the fetched catalogue when the run changes,
      // and that is worth stating because it looks like an omission: the pane
      // keys this component on the run id, so a run switch REMOUNTS it and
      // every piece of state above starts empty. Which is the behaviour the
      // catalogue needs — a list of sections belongs to the Canvas course it
      // came from, and one left on screen across a switch would be offering
      // another course's sections to map.
      React.useEffect(() => {
        if (data) setPicked(seed(data.selections));
        setStatus(null);
      }, [state.phase, fresh]);

      if (state.phase === "loading") return h(Message, null, "Reading what this run is wired to…");
      if (state.value && state.value.error) return h(Message, { error: true }, state.value.error);
      if (!data) return h(Message, null, "Nothing to show.");

      const chosen = picked || seed(data.selections);
      const sub = props.subView || "targets";

      // ---- Targets -------------------------------------------------------

      if (sub === "status") {
        return h(
          "div",
          null,
          h(
            "p",
            { className: "pp-absent" },
            "What this run is wired to, and how much of each is done. A push reaches " +
              "nothing until every line below it is ticked.",
          ),
          h(IntegrationStatus, {
            integrations: data.integrations,
            setup: data.setup,
            data,
            runId: props.runId,
            sessionId: props.sessionId,
            onSaved: (body) => {
              setFresh(body);
              setStatus(null);
              // A connection is machine configuration and changes nothing in
              // courses/; a spreadsheet id does. Cheaper to refresh always
              // than to reason about which provider just wrote where.
              if (props.onWrite) props.onWrite();
            },
          }),
        );
      }

      if (sub === "targets") {
        const target = data.target;
        return h(
          "div",
          { className: "pp-scroll" },
          h("p", { className: "pp-factgroup" }, "Where an approved grade would go"),
          h(
            Fact,
            {
              label: "Gradebook target",
              note:
                target.value === null
                  ? "Set once at onboarding. Without it every push has to be told."
                  : target.supported === false
                    ? "Recorded, but this workspace cannot reach it. Supported: " +
                      target.options.join(", ")
                    : target.live
                      ? "A live target: a push changes something students can see, and needs --confirm"
                      : "Produces a file. Inert until somebody uploads it",
              missing: target.value === null || target.supported === false,
            },
            target.value === null
              ? h(Presence, { present: false, no: "not recorded" })
              : target.value,
          ),
          h(
            Fact,
            {
              label: "Canvas course",
              note:
                data.canvasCourse.fromExtension === null && data.canvasCourse.fromColumn
                  ? "In lms_course_id, which `ainar lms push` does not read. It reads " +
                    "extensions.lms.canvas_course_id"
                  : data.canvasCourse.fromExtension
                    ? "extensions.lms.canvas_course_id, which is the field the push reads"
                    : "extensions.lms.canvas_course_id on the run record. The number is in " +
                      "the Canvas course URL",
              missing: !data.canvasCourse.usable,
            },
            data.canvasCourse.fromExtension ||
              data.canvasCourse.fromColumn ||
              h(Presence, { present: false, no: "not recorded" }),
          ),
          h(
            Fact,
            {
              label: "Canvas host",
              note:
                data.canvas.hostFrom ||
                "A canvas connection in " +
                  data.canvas.registryPath +
                  " — `ainar connections migrate` builds one from what is already here",
              missing: !data.canvas.host,
            },
            data.canvas.host || h(Presence, { present: false, no: "not configured" }),
          ),
          // No setup form here. Status owns that, and a form offered in two
          // places is two places to keep true.
          data.canvas.host
            ? null
            : h(
                "p",
                { className: "pp-absent" },
                "No Canvas host yet. Status, above, is where it is set up.",
              ),
          h(
            Fact,
            {
              label: "Canvas token",
              // The variable's NAME, which is not a secret and is the thing a
              // professor needs when a push is refused. Guessing between
              // AINAR_CANVAS_TOKEN and the bare CANVAS_TOKEN the publishing
              // profiles used to fall back to is exactly the confusion the
              // merged registry exists to end.
              note: data.canvas.tokenEnv,
              missing: !data.canvas.tokenInEnv,
            },
            h(Presence, {
              present: data.canvas.tokenInEnv,
              yes: "set",
              no: "not set",
            }),
          ),
          h(
            Fact,
            {
              label: "Spreadsheet",
              note: data.sheet.id
                ? "Summary tab: " + data.sheet.summaryTab
                : "extensions.lms.sheet_id — the string between /d/ and /edit",
              missing: !data.sheet.id,
            },
            data.sheet.id || h(Presence, { present: false, no: "not recorded" }),
          ),
          h(SubgroupCourses, {
            runId: props.runId,
            sessionId: props.sessionId,
            subgroups: data.subgroups || [],
            state: data.subgroupCourses || { map: {}, perSubgroup: false, conflict: false },
            onSaved: (body) => {
              setFresh(body);
              setStatus(null);
              // The run record changed, so every other view of it is stale —
              // the same counter an approval bumps.
              if (props.onWrite) props.onWrite();
            },
          }),
          h("p", { className: "pp-factgroup" }, "What students would be told"),
          data.connections.profiles.filter((profile) => profile.type !== "canvas").length === 0
            ? h(
                "p",
                { className: "pp-absent" },
                "No Moodle or Telegram profile in " +
                  data.connections.path +
                  ". Announcing to a channel is /publish-telegram, which reads that file.",
              )
            : data.connections.profiles
                .filter((profile) => profile.type !== "canvas")
                .map((profile) =>
                  h(
                    Fact,
                    {
                      label: profile.name,
                      note:
                        profile.type +
                        (profile.chatId
                          ? " · chat " + profile.chatId
                          : profile.baseUrl
                            ? " · " + profile.baseUrl
                            : ""),
                      missing: !profile.supported,
                      key: profile.name,
                    },
                    profile.supported
                      ? h(Presence, {
                          present: profile.tokenInEnv || profile.tokenInFile,
                          yes: "ready",
                          no: "no token",
                        })
                      : "unsupported type",
                  ),
                ),
          h(
            "p",
            { className: "pp-absent" },
            data.run.recordPath
              ? "The run's own linkages live in " + data.run.recordPath + "."
              : "This run's record could not be located.",
          ),
        );
      }

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
          h("p", { className: "pp-factgroup" }, "Credentials"),
          (() => {
            const refs = (data.credentials && data.credentials.refs) || {};
            const names = Object.keys(refs).sort();
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

      // ---- Links ---------------------------------------------------------

      const key = (option) => option.kind + ":" + option.id;

      const toggle = (option) =>
        setPicked((current) => {
          const next = Object.assign({}, current || chosen);
          if (Object.hasOwn(next, key(option))) delete next[key(option)];
          else {
            next[key(option)] = {
              id: option.id,
              kind: option.kind,
              name: option.name,
              // One subgroup and nothing to decide: bind it, rather than
              // making the professor pick from a list of one. A run with none
              // stays null, which means "the whole run".
              group: data.subgroups.length === 1 ? data.subgroups[0].group : null,
            };
          }
          return next;
        });

      const bind = (option, group) =>
        setPicked((current) => {
          const next = Object.assign({}, current || chosen);
          if (!next[key(option)]) return next;
          next[key(option)] = Object.assign({}, next[key(option)], { group: group || null });
          return next;
        });

      const load = () => {
        setFetching(true);
        setStatus(null);
        fetch(
          scoped(
            BASE + "/api/canvas/catalogue?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          { method: "POST" },
        )
          .then((response) => response.json())
          .then((body) => {
            setFetching(false);
            if (body.error) {
              setStatus({ error: body.error, from: "fetch" });
              return;
            }
            setCatalogue(body);
          })
          .catch((error) => {
            setFetching(false);
            setStatus({ error: String((error && error.message) || error), from: "fetch" });
          });
      };

      const save = () => {
        setStatus("saving");
        fetch(
          scoped(
            BASE + "/api/canvas/selection?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ selections: Object.values(chosen) }),
          },
        )
          .then((response) => response.json())
          .then((body) => {
            if (body.error) {
              setStatus({ error: body.error, from: "save" });
              return;
            }
            setFresh(body);
            setStatus({ saved: body.saved });
            // The record changed, so every other view of it has to be
            // re-fetched — the same counter an approval bumps.
            if (props.onWrite) props.onWrite();
          })
          .catch((error) =>
            setStatus({ error: String((error && error.message) || error), from: "save" }),
          );
      };

      // What is offered to tick: the live catalogue once fetched, otherwise
      // whatever the RECORD holds — so a professor with no token still sees the
      // mapping they have and can still unmap one.
      //
      // From the record and deliberately not from `chosen`: an unticked row has
      // to stay on screen. Deriving the list from what is currently ticked would
      // make a row vanish the moment it was unticked, so changing your mind
      // would cost another Canvas request to get it back.
      const offered = catalogue
        ? catalogue.options
        : data.selections.map((row) => ({
            id: row.id,
            kind: row.kind,
            name: row.name || row.id,
            students: null,
            sisId: null,
          }));

      const saved = status && status.saved;
      // Order-insensitive, because `chosen` is keyed by insertion and a
      // professor who unticks a section and ticks it again has changed nothing.
      // Comparing the stringified objects directly reported that as unsaved
      // work and offered a Save that would write the file back as it already
      // was.
      //
      // Joined on NUL, written as an escape rather than as the byte — the
      // spelling `grading.js`'s `pair()` settled on, and for its reason. A
      // separator that can occur inside a value lets two different selections
      // canonicalise to one string, and a Canvas section name is free text that
      // may hold any punctuation a registrar typed. NUL cannot occur in any of
      // the three halves. The escape is what keeps this file readable as text:
      // a literal NUL makes git store the whole thing as binary, which is how
      // two files in this repo ended up with no reviewable diff at all.
      const canonical = (table) =>
        Object.keys(table)
          .sort()
          .map((entry) => {
            const row = table[entry];
            return `${entry}\u0000${row.group || ""}\u0000${row.name || ""}`;
          })
          .join("\u0000\u0000");
      const dirty = canonical(seed(data.selections)) !== canonical(chosen);

      return h(
        "div",
        { className: "pp-scroll" },
        h("p", { className: "pp-factgroup" }, "Canvas sections and groups"),
        h(
          "p",
          { className: "pp-absent" },
          data.subgroups.length
            ? "Which Canvas section or student group feeds which subgroup of this run. " +
              "Leave a selection on the whole run when it is not a subgroup's." +
              // Worth saying here rather than only on the class list: a run
              // where some students carry no subgroup is a run where a
              // per-subgroup mapping does not cover everybody, and this is the
              // screen where that matters.
              (data.ungrouped
                ? " " +
                  data.ungrouped +
                  " active student" +
                  (data.ungrouped === 1 ? "" : "s") +
                  " carry no subgroup, so no per-subgroup selection covers them."
                : "")
            : "This run has no subgroups, so a selection here says only that the section " +
              "belongs to this run.",
        ),
        h(
          "div",
          { className: "pp-saverow pp-saverow-top" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: fetching,
              title:
                "Ask Canvas for this course's sections and student groups. A read, " +
                "but it sends your token, so it happens only when you press this.",
              onClick: load,
            },
            fetching ? "Asking Canvas…" : catalogue ? "Fetch again" : "Fetch from Canvas",
          ),
          catalogue
            ? h(
                "span",
                { className: "pp-savenote" },
                catalogue.options.length +
                  " from " +
                  catalogue.host +
                  " · course " +
                  catalogue.courseId,
              )
            : null,
        ),
        failure("fetch") ? h("p", { className: "pp-saveerr" }, failure("fetch")) : null,
        offered.length === 0
          ? h(
              "p",
              { className: "pp-absent" },
              catalogue
                ? "Canvas returned no sections or groups for this course."
                : "Nothing is mapped yet. Fetching from Canvas is what fills this in.",
            )
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
                      (option.students === null ? "" : " · " + option.students + " students") +
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
                          h(
                            "option",
                            { value: entry.group, key: entry.group },
                            entry.group + " (" + entry.students + ")",
                          ),
                        ),
                      ),
                    )
                  : null,
              );
            }),
        h(
          "div",
          { className: "pp-saverow" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn" + (dirty ? " pp-danger" : ""),
              disabled: status === "saving" || !dirty,
              title: data.run.recordPath
                ? "Write extensions.lms.canvas_sections to " + data.run.recordPath
                : "This run's record could not be located",
              onClick: save,
            },
            status === "saving" ? "Saving…" : "Save to the run record",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: !dirty,
              onClick: () => {
                setPicked(seed(data.selections));
                setStatus(null);
              },
            },
            "Revert",
          ),
          failure("save")
            ? h("span", { className: "pp-saveerr" }, failure("save"))
            : saved
              ? h(
                  "span",
                  { className: "pp-savenote" },
                  "Wrote " +
                    saved.count +
                    " selection" +
                    (saved.count === 1 ? "" : "s") +
                    " to " +
                    saved.path +
                    ".",
                )
              : null,
        ),

        h("p", { className: "pp-factgroup" }, "Assessments"),
        data.assessments.length === 0
          ? h(
              "p",
              { className: "pp-absent" },
              "This run has no assessments yet, so there is nothing to link. " +
                "Drafting one is /design-assessment.",
            )
          : data.assessments.map((assessment) =>
              h(
                Fact,
                {
                  label: assessment.title || assessment.assessmentId,
                  note:
                    assessment.assessmentId +
                    " · sheet tab " +
                    (assessment.sheetTab || assessment.defaultSheetTab) +
                    (assessment.sheetTab ? "" : " (derived)"),
                  missing: assessment.canvasAssignmentId === null,
                  key: assessment.assessmentId,
                },
                assessment.canvasAssignmentId ||
                  h(Presence, { present: false, no: "no Canvas column" }),
              ),
            ),
        data.assessments.some((assessment) => assessment.canvasAssignmentId === null)
          ? h(
              "p",
              { className: "pp-absent" },
              "A Canvas column goes on the assessment as extensions.lms." +
                "canvas_assignment_id. Without one, a push has no column to write and " +
                "`ainar lms plan` says so — though sending the definition below " +
                "creates the assignment and writes its id here for you.",
            )
          : null,
        h(DefinitionPush, {
          runId: props.runId,
          sessionId: props.sessionId,
          assessments: data.assessments,
          subgroups: data.subgroups,
        }),
      );
    }

    /**
     * Sending an assessment's DEFINITION to Canvas — its title, points, dates,
     * what may be handed in, and the brief as the description.
     *
     * Everything else on this tab RECORDS a linkage: which Canvas assignment
     * is which. This is the one control that changes something a class can
     * see, so it is shaped like the approval strip rather than like its
     * neighbours:
     *
     * * **preview first, always.** The send button does not exist until a plan
     *   has come back, and the plan is the CLI's own words. A professor who has
     *   not read what would change cannot send it.
     * * **the send button is the only red thing here**, which is the pane's
     *   existing signal for a press that writes outside this machine.
     * * **drift needs its own press.** A field somebody edited in Canvas is
     *   left alone by default; replacing it is a second checkbox that only
     *   appears when the plan actually reported drift, and it is cleared again
     *   after every send so it cannot carry over to the next one.
     *
     * The subgroup selector defaults to "every subgroup", which is what the
     * command does and is the point of it: one definition serves the whole
     * class, and a send that reached CS-401 and not CS-402 is how two halves
     * end up being told different things.
     */
    function DefinitionPush(props) {
      const assessments = props.assessments || [];
      const subgroups = (props.subgroups || []).map((entry) => entry.group);
      const [assessment, setAssessment] = React.useState(
        assessments.length ? assessments[0].assessmentId : "",
      );
      const [group, setGroup] = React.useState("");
      const [phase, setPhase] = React.useState("idle");
      const [result, setResult] = React.useState(null);
      const [overwrite, setOverwrite] = React.useState(false);

      // A plan belongs to the assessment and subgroup it was asked about.
      // Changing either throws it away, so the red button can never send
      // something other than what was read.
      const reset = () => {
        setResult(null);
        setOverwrite(false);
      };

      const call = (confirm) => {
        setPhase(confirm ? "sending" : "planning");
        fetch(
          scoped(
            BASE + "/api/canvas/assignment?run=" + encodeURIComponent(props.runId || ""),
            props.sessionId,
          ),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              assessment: assessment,
              group: group,
              confirm: confirm,
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
            if (confirm) setOverwrite(false);
          })
          .catch((error) => {
            setPhase("idle");
            setResult({ failed: true, text: String((error && error.message) || error), sent: false });
          });
      };

      if (!assessments.length) return null;

      // Only offered when the plan said somebody had edited Canvas by hand.
      const sawDrift = Boolean(result) && !result.failed && /edited in Canvas/.test(result.text);
      const previewed = Boolean(result) && !result.failed && !result.sent;

      return h(
        "div",
        null,
        h("p", { className: "pp-factgroup" }, "Send a definition to Canvas"),
        h(
          "p",
          { className: "pp-absent" },
          "Title, points, dates, what may be handed in, and the brief as the " +
            "assignment description. Not the marks — those are ainar lms push.",
        ),
        h(
          "div",
          { className: "pp-bind" },
          h("span", { className: "pp-bindname" }, "Assessment"),
          h(
            "select",
            {
              className: "pp-bindsel",
              value: assessment,
              onChange: (event) => {
                setAssessment(event.target.value);
                reset();
              },
            },
            assessments.map((entry) =>
              h(
                "option",
                { value: entry.assessmentId, key: entry.assessmentId },
                entry.title || entry.assessmentId,
              ),
            ),
          ),
        ),
        subgroups.length
          ? h(
              "div",
              { className: "pp-bind" },
              h("span", { className: "pp-bindname" }, "Subgroup"),
              h(
                "select",
                {
                  className: "pp-bindsel",
                  value: group,
                  onChange: (event) => {
                    setGroup(event.target.value);
                    reset();
                  },
                },
                [h("option", { value: "", key: "*" }, "Every subgroup")].concat(
                  subgroups.map((name) => h("option", { value: name, key: name }, name)),
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
              onClick: () => call(false),
            },
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
          ? h(
              "pre",
              { className: "pp-approveout" + (result.failed ? " pp-approveerr" : "") },
              result.text,
            )
          : null,
      );
    }

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
              "Everything below includes unapproved proposals from ",
              h("code", null, "work/" + props.runId + "/"),
              ". Nothing here has been accepted; ",
              h("code", null, "ainar approve"),
              " is what would accept it, and that command is yours.",
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
     *
     * Adding a route here is granting it the overlay, so the bar is the one
     * `/file` already meets: same origin, a read, and addressed by an id rather
     * than by anything resembling a path.
     */
    const MATERIAL_ROUTES = new Set([BASE + "/file", BASE + "/brief"]);

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
    function MaterialModal(props) {
      const close = props.onClose;
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
              h(
                "a",
                {
                  className: "pp-modallink",
                  href: props.url,
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
            h("iframe", {
              className: "pp-modalframe",
              src: props.url,
              // Undefined omits the attribute, which is the whole point for a
              // PDF; see the table above.
              sandbox: MEDIA.has(props.format) ? undefined : "allow-same-origin",
              title: props.label,
            }),
          ),
        ),
        document.body,
      );
    }

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
      const subView = (tabId) => subViews[tabId] ?? defaultSub(tabId);
      // ON by default, which reverses the original decision here and is worth
      // recording rather than quietly flipping.
      //
      // The argument for `Record` was that the record is what a student may be
      // shown and what an LMS may be given, so the merged view — what the term
      // would look like if every proposal in `work/<RUN>/` were accepted — is a
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

      // The approval strip: what the last press produced, and whether the next
      // press writes.
      //
      // Two presses by design. The first runs `--dry-run` and shows what WOULD
      // be promoted; only then does a confirming button appear. A single button
      // that wrote on first click would be one misplaced click away from
      // promoting a term of drafts, and the thing being changed is the
      // professor's course record.
      //
      // `phase` is idle | running | preview | done | error. `preview` is the
      // only phase that offers the confirming button, so a stale preview cannot
      // be confirmed after the drafts have changed underneath it — switching
      // run, tab or draft mode resets this to idle.
      const [approval, setApproval] = React.useState({ phase: "idle", text: "" });

      // Bumped after a write, and part of the frame's key, so the documents are
      // re-fetched. Without it the pane would go on drawing the course as it was
      // before the approval it just performed.
      const [reload, setReload] = React.useState(0);

      // The material the professor is reading over the page, or null.
      //
      // Held on the pane rather than in the frame that opened it. The widget
      // frames are re-keyed on run, theme, drafts and identity and remount on
      // any of them; an overlay owned by one of those would vanish mid-slide
      // because the OS went dark. It closes when the professor closes it.
      const [material, setMaterial] = React.useState(null);

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
            setMaterial({ url, label, format });
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

      // Any change of subject invalidates a preview: the drafts it described are
      // not necessarily the drafts a confirming press would now write.
      React.useEffect(() => {
        setApproval({ phase: "idle", text: "" });
      }, [current ? current.runId : null, tab, drafts]);

      // Switching run returns to the default rather than carrying the last
      // press across. It matters in one direction now: a professor who pressed
      // `Pseudonyms` to cover one class list was covering THAT list, and the
      // press should not go on quietly hiding a different cohort they navigate
      // to next and expect to be able to read.
      React.useEffect(() => {
        setNames(true);
      }, [current ? current.runId : null]);

      /**
       * Run `ainar approve` on the server, previewing unless `confirm`.
       *
       * The request is a POST because it may write. The approver is the run's
       * first instructor — the pane shows which id it is about to record, and
       * declines to guess when the run names none.
       */
      const approve = (confirm) => {
        if (!current) return;
        const approver = (current.instructors || [])[0];
        if (!approver) {
          setApproval({
            phase: "error",
            text:
              "This run names no instructor, so there is no id to record as the " +
              "approver. Add one to `instructors` in the offering, or run " +
              "`bin/ainar approve … --as <USER-ID>` yourself.",
          });
          return;
        }
        setApproval({ phase: "running", text: confirm ? "Writing…" : "Checking…" });
        fetch(
          scoped(
            BASE +
              "/api/approve?run=" +
              encodeURIComponent(current.runId) +
              "&approver=" +
              encodeURIComponent(approver) +
              (confirm ? "&confirm=1" : ""),
            props.sessionId,
          ),
          { method: "POST" },
        )
          .then((response) => response.json())
          .then((result) => {
            if (result.error) {
              setApproval({ phase: "error", text: result.error });
              return;
            }
            setApproval({
              phase: result.ok ? (confirm ? "done" : "preview") : "error",
              text: result.output || "(the command said nothing)",
            });
            // A write changes the record the whole pane is drawing, so the
            // frames have to be re-fetched rather than left showing the course
            // as it was a moment ago.
            if (confirm && result.ok) setReload((value) => value + 1);
          })
          .catch((error) => setApproval({ phase: "error", text: String(error) }));
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
                ". A run needs versions/<TERM>/version.yaml with start_date and end_date. " +
                "Run `python -m ainar validate` for the specifics.",
          );
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
            key: current.runId,
          });
        }
        const view = SUBVIEWS[tab] ? subView(tab) : TABS.find((t) => t.id === tab).view;
        return h(WidgetFrame, {
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
        // Students gets no Record / + drafts pair, because `DRAFTABLE` refuses
        // enrollments in a draft file: there is no drafted class list and never
        // will be, and a pair that changed nothing would be a control implying
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
        // The approval strip. Only on Tasks, because that is the tab that shows
        // what is drafted — a button to accept proposals belongs beside the list
        // of them, not on the term plan or the gradebook.
        tab === "tasks" && current
          ? h(
              "div",
              { className: "pp-approve" },
              h(
                "div",
                { className: "pp-approverow" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: approval.phase === "running",
                    title:
                      "Run `ainar approve --dry-run` and show what would be " +
                      "promoted. Writes nothing.",
                    onClick: () => approve(false),
                  },
                  approval.phase === "running" ? "Working…" : "Check what would be approved",
                ),
                approval.phase === "preview"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pp-segbtn pp-danger",
                        title:
                          "Promote the drafts into courses/. This writes to the " +
                          "course record.",
                        onClick: () => approve(true),
                      },
                      "Approve and write",
                    )
                  : null,
                (current.instructors || []).length
                  ? h("span", { className: "pp-as" }, "as " + current.instructors[0])
                  : null,
              ),
              approval.phase === "idle"
                ? null
                : h(
                    "pre",
                    {
                      className:
                        "pp-approveout" + (approval.phase === "error" ? " pp-approveerr" : ""),
                    },
                    approval.text,
                  ),
            )
          : null,
        h("div", { className: "pp-body" }, body()),
        material === null
          ? null
          : h(MaterialModal, {
              url: material.url,
              label: material.label,
              format: material.format,
              onClose: () => setMaterial(null),
            }),
      );
    }

    // --------------------------------------------------------------- plugin

    /**
     * `layout` for the open/close verbs, `slots` for the two seats, `sessions`
     * to resolve the session a widget's question should be asked in.
     */
    const inject = ["slots", "layout", "sessions"];

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
    return module.exports;
  },
});
