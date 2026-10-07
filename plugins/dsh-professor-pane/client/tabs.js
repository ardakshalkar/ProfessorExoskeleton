/**
 * Where the pane's requests go and what it can show: the route prefix, the
 * revision poll that redraws on an outside write, and the tab and sub-view
 * tables.
 */

import { React } from "./react.js";

/** Kept in step with `BASE` in lib/http.js by hand; there are two of them. */
export const BASE = "/professor-pane";

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
 * The button bar, in order.
 *
 * `id` is this file's vocabulary; `view` is the path segment `index.js`
 * knows. "Course outline" is labelled as the student's view because that is
 * what the widget is — the term plan as a student reads it — and the
 * professor asking for it asked for it by that name.
 */
export const TABS = [
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
export const SUBVIEWS = {
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
export const defaultSub = (tabId) => (SUBVIEWS[tabId] ? SUBVIEWS[tabId][0].id : null);

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
export const NO_DRAFT_PAIR = new Set(["preferences", "students", "integrations", "scans"]);

/** Tabs with no segmented row of any kind. */
export const NO_SEGMENTED_ROW = new Set(["preferences"]);

/**
 * Tabs whose document can name a student, and therefore draw the pair.
 *
 * The class list, and the inbox — where the missing-submission rows and the
 * open signals are about particular people. Nowhere else: the outline, the
 * gradebook and the concept grid are about the class, and a parameter that
 * reached them would be a parameter with nothing to do.
 */
export const NAMED_TABS = new Set(["students", "tasks", "scans"]);

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
