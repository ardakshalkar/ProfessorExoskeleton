/**
 * Where the pane's requests go and what it can show: the route prefix, the
 * revision poll that redraws on an outside write, and the shared tables.
 */

import { React } from "./react.js";

/** Kept in step with `BASE` in server/http.js by hand; there are two of them. */
export const BASE = "/professor-pane";

/**
 * The window event course mode announces what it shows on — `{ mode, view }`,
 * or null when it closes — so the navigator can mark that place as current.
 * Here rather than in navigator.js because course mode is built before it.
 */
export const PLACE_SHOWN_EVENT = "professor-pane:place-shown";

/**
 * `?session=` on every request.
 *
 * It is what makes the pane follow the workspace picked in the sidebar. The
 * host turns the id into a directory through dsh's own workspace registry,
 * so this side never sends a path — see `inject` in index.js for why that
 * matters. An id the registry does not account for falls back to
 * AINAR_WORKSPACE, which is the same answer as sending nothing.
 */
export function scoped(path, sessionId) {
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
export function useRevisionWatch(url, onChange) {
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
 * The documents behind a course-mode view that has more than one.
 *
 * Until 2026-10-16 this table, and the TABS beside it, were the right
 * column's button bar. The column is an inspector now (client/inspector.js)
 * and its places live in course mode; Tasks is the one table course mode
 * reads from here, since the Unpublished view keys off its last entry.
 *
 * Pending, then Ready, then Checklist: the order is how close a thing is to
 * being finished. Pending is work awaiting the professor's judgement, Ready
 * is work awaiting their approval, and Checklist is what nobody has started.
 */
export const SUBVIEWS = {
  tasks: [
    { id: "tasks", label: "Pending" },
    { id: "ready", label: "Ready" },
    { id: "checklist", label: "Checklist" },
    // Last: not work to do on the course but what has not left it yet —
    // marks Canvas does not have, materials changed since publishing.
    { id: "unpublished", label: "Unpublished" },
  ],
};

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
export const IDENTITY_MODES = [
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
export const DRAFT_MODES = [
  { label: "Record", drafts: false, hint: "only what has been accepted" },
  { label: "+ drafts", drafts: true, hint: "including records marked approval: draft" },
];
