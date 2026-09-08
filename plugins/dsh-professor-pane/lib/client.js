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
 * Four buttons. Three of them put `dsh-ainar-course-model`'s own widget
 * document into a sandboxed frame with its payload already inside it — so the
 * term plan a professor sees here is the same document ChatGPT and Claude
 * Desktop get, from the same bytes, and there is no second implementation of it
 * to drift. The fourth is drawn here, because no tool returns preferences.
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
      { id: "preferences", label: "Preferences", hint: "Resolved, read-only", view: null },
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
      tasks: [
        { id: "tasks", label: "Pending" },
        { id: "ready", label: "Ready" },
      ],
    };

    /** The default sub-view for a tab: the first one listed. */
    const defaultSub = (tabId) => (SUBVIEWS[tabId] ? SUBVIEWS[tabId][0].id : null);

    /**
     * Tabs that draw no segmented row at all.
     *
     * Not the same as "no sub-views": a tab absent from `SUBVIEWS` still gets
     * the Record / + drafts pair, because most single-document views have a
     * drafted half worth seeing. These two do not — Preferences is not a view
     * of a run, and the class list has no draftable half — so they get no row.
     */
    const NO_SEGMENTED_ROW = new Set(["preferences", "students"]);

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
.pp-seg{display:flex;gap:4px;flex:none;padding:8px 12px 0;align-items:center}
.pp-segspacer{flex:1}
.pp-segbtn{background:0 0;cursor:pointer;padding:2px 8px;font:inherit;font-size:11px;border-radius:20px;
  color:var(--dsw-alias-label-tertiary,#6b6b6b);
  border:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
.pp-segbtn[aria-pressed=true]{color:var(--dsw-alias-label-primary,#111);font-weight:600;
  border-color:var(--dsw-alias-label-primary,#111)}
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
.pp-ask{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b6b);
  padding:5px 12px 6px;flex:none;border-top:1px solid var(--dsw-alias-border-l2,#e3e3e6)}
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

    function Preferences(props) {
      const state = useJson(
        scoped(
          BASE +
            "/api/preferences?course=" +
            encodeURIComponent(props.courseId || "") +
            "&term=" +
            encodeURIComponent(props.term || ""),
          props.sessionId,
        ),
      );
      if (state.phase === "loading") return h(Message, null, "Reading the preference files…");
      if (state.value.error) return h(Message, { error: true }, state.value.error);
      return h(
        "div",
        { className: "pp-scroll" },
        state.value.layers.map((layer) => h(Layer, { layer: layer, key: layer.scope })),
        h("p", { className: "pp-absent" }, state.value.note),
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
          (props.drafts ? "&drafts=1" : ""),
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

      // The widgets' buttons ask the model a question. They reach the harness
      // as a postMessage from a sandboxed frame, so the origin check is `null`
      // — an opaque origin is what a frame with no `allow-same-origin` has, and
      // requiring the page's own origin here would reject every message the
      // pane is meant to receive. What makes it safe is the payload contract,
      // not the origin: one string, sent as a prompt, into the session the
      // professor already has open.
      React.useEffect(() => {
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.source !== "professor-pane" || data.kind !== "ask") return;
          if (typeof data.prompt !== "string" || data.prompt.trim() === "") return;
          props.ask(data.prompt);
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
        const view = SUBVIEWS[tab] ? subView(tab) : TABS.find((t) => t.id === tab).view;
        return h(WidgetFrame, {
          view: view,
          runId: current.runId,
          dark: dark,
          drafts: drafts,
          sessionId: props.sessionId,
          title: TABS.find((t) => t.id === tab).label,
          // Run, view, theme and draft mode in the key: switching any of them
          // replaces the frame rather than leaving a document holding a payload
          // for a question the professor is no longer asking.
          key:
            view +
            "|" +
            current.runId +
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
        // The segmented row: which document, and which halves of the course it
        // is computed over. Preferences has neither — it is not a view of a run.
        // Students has neither either, for a different reason: `DRAFTABLE`
        // refuses enrollments in a draft file, so there is no drafted class
        // list and never will be. A Record / + drafts pair that changed nothing
        // would be a control implying an answer it does not have.
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
              DRAFT_MODES.map((entry) =>
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
