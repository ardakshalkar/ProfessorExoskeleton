/**
 * The sandboxed frame every served document goes into, material links and the
 * material overlay, and Course mode.
 */

import { decodeIssues, DraftBanner, Message, useJson } from "./common.js";
import { AREAS, useVersion } from "./data.js";
import { CourseView } from "./course/view.jsx";
import { courseModeEscape } from "./course-escape.js";
import { GradebookPanes } from "./gradebook.js";
import { GradebookStatus, Unpublished } from "./marks.js";
import { Files } from "./files.js";
import { ConnectionsMenu } from "./connections-menu.js";
import { Integrations } from "./integrations.js";
import { Preferences } from "./preferences.js";
import { ConceptsGrid } from "./concepts.js";
import { matchCommand } from "../shared/actions.js";
import { SyncView } from "./sync-view.js";
import { Today, WaitingPlace } from "./today.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, IDENTITY_MODES, PLACE_SHOWN_EVENT, scoped, SUBVIEWS } from "./tabs.js";

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
  // The URL the frame's document was loaded from. A fetch for the same URL
  // under a new `revision` is the same page with newer records; any other URL
  // is a different page, and the frame says it is reading until it arrives.
  const loaded = React.useRef(null);
  // The HTML the frame is showing now.
  const shownHtml = React.useRef(null);
  React.useEffect(() => {
    let live = true;
    const same = loaded.current === url;
    if (!same) setDoc(null);
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
        if (!live) return;
        if (!same) {
          loaded.current = url;
          shownHtml.current = value.html;
          setDoc(value);
          return;
        }
        // The same page, newer: replaced once the new one is in hand — no
        // blank in between — and not at all when nothing on it moved.
        if (value.html === shownHtml.current) return;
        shownHtml.current = value.html;
        setDoc(value);
      })
      .catch((error) => {
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
    doc.mode === "merged" ? h(DraftBanner, { issues: doc.issues }) : null,
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

export function materialUrl(value) {
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
  // First: where the course stands, what waits on the professor, and how the
  // class and the roads out are doing — each a link into another place.
  { id: "today", label: "Today", hint: "This week, what is waiting on you, and how the class and the syncs stand" },
  { id: "students", label: "Students", hint: "The class list, by subgroup — names and marks, so private" },
  { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment, and how much of it Canvas has" },
  // The class by concept: what used to be the right column's Progress tab.
  { id: "concepts", label: "Concepts", hint: "The class, by concept — what has been shown and what has not" },
  // Waiting (was Tasks): everything waiting on the professor in one list
  // first, then the four lists it is drawn from (BACKLOG E37 HOME-13). The id
  // stays `tasks`, which every jump into it already names.
  { id: "tasks", label: "Waiting", hint: "Everything waiting on you, in one order, with snooze — and what is ready and what has not gone out" },
  // What the course has got, by kind rather than by week: the right
  // column's old Course outline sub-views, the student's outline last.
  { id: "materials", label: "Materials", hint: "Assessments, slides, exams, the grading policy, and the outline a student reads" },
  // The private material itself — scanned papers, recorded answers — which
  // lives outside the course folder, so has no other place to be seen whole.
  { id: "files", label: "Files", hint: "Scans and audio: where they are stored, how much there is, each pile" },
  // Bringing Canvas and the grade sheets into step: an operation done weekly,
  // so not behind Course settings, which keeps the setting up.
  { id: "syncs", label: "Sync", hint: "Canvas and the grade sheets: Sync all, what differs, and names to confirm" },
  // Last: not the course but its roads out — Canvas, the sheet, the
  // repositories — and what the skills assume. Opened twice a term.
  { id: "settings", label: "Course settings", hint: "Integrations — Canvas, the grade sheet, GitHub — and the preferences the skills assume" },
];

/**
 * The views drawn as more than one document, and which: the first is the
 * default. Each is a real view of the run, not a filter over one payload.
 */
const VIEW_SUBS = {
  tasks: [{ id: "waiting", label: "Everything" }].concat(SUBVIEWS.tasks),
  materials: [
    { id: "assessments", label: "Assessments" },
    { id: "slides", label: "Slides" },
    { id: "exams", label: "Exams" },
    { id: "grading", label: "Grading policy" },
    { id: "outline", label: "Student's outline" },
  ],
  // The Gradebook's four parts, which were stacked in one long page
  // (docs/RIBBONS.md R6). Last changes keeps its own All · Grades · Sheet ·
  // Policy: those filter that one list.
  gradebook: [
    { id: "marks", label: "Marks" },
    { id: "canvas", label: "To Canvas" },
    { id: "policy", label: "Policy" },
    { id: "changes", label: "Last changes" },
  ],
  // Accounts was a button inside Integrations; it is the third part here.
  settings: [
    { id: "integrations", label: "Integrations" },
    { id: "accounts", label: "Accounts" },
    { id: "preferences", label: "Preferences" },
  ],
};

/** Older names a request may still use: the Integrations view became Course settings. */
const VIEW_ALIASES = {
  integrations: { view: "settings", sub: "integrations" },
  preferences: { view: "settings", sub: "preferences" },
};

/** A request with its view resolved through `VIEW_ALIASES`. */
const resolveRequest = (request) => {
  if (!request || !VIEW_ALIASES[request.view]) return request;
  return { ...request, ...VIEW_ALIASES[request.view], sub: request.sub || VIEW_ALIASES[request.view].sub };
};

/** The Status view's words for a connection, as the Integrations tab says them. */
const CONNECTION_STATE = { ready: "connected", partial: "partly set up", absent: "not set up" };

export function CourseMode(props) {
  const close = props.onClose;
  // What each place reads, followed separately (client/data.js): the weeks
  // and the course-wide documents read across the course; the settings, the
  // queues and the gradebook's own panels follow their areas. `props.wrote`
  // is how a view says what its own write changed.
  const everything = useVersion(AREAS.everything);
  const integrationsVersion = useVersion(AREAS.integrations);
  const syncsVersion = useVersion(AREAS.syncs);
  const marksVersion = useVersion(AREAS.marks);
  const gradingVersion = useVersion(AREAS.grading);
  const filesVersion = useVersion(AREAS.files);
  const [student, setStudent] = React.useState(false);
  // `props.request` is a place pressed in the left sidebar: a reading
  // (`mode`) or a course-wide view (`view`). It decides where course mode
  // opens, and moves it when a second place is pressed while it is open.
  const request = resolveRequest(props.request || null);
  const known = (id, list) => list.some((entry) => entry.id === id);
  const [mode, setMode] = React.useState(() =>
    request && known(request.mode, COURSE_MODES) ? request.mode : defaultCourseMode(props.start, props.end),
  );
  // A course-wide view, when one is chosen, in place of the reading; the
  // reading is kept so the weeks come back as they were left.
  const [view, setView] = React.useState(() => (request && known(request.view, COURSE_VIEWS) ? request.view : null));
  // Which document each many-document view shows, by view; the first listed
  // until chosen, and kept when the professor leaves the view and comes back.
  const [subs, setSubs] = React.useState(() =>
    request && VIEW_SUBS[request.view] && known(request.sub, VIEW_SUBS[request.view]) ? { [request.view]: request.sub } : {},
  );
  const subOf = (id) => (VIEW_SUBS[id] ? subs[id] || VIEW_SUBS[id][0].id : null);
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
  // A door into the Concepts grid: a request for it that names a student, a
  // concept or a week (HOME-9). Numbered like the request, so the same door
  // pressed twice still lands.
  const doorOf = (entry) =>
    entry && entry.view === "concepts" && (entry.student || entry.concept || entry.week)
      ? { student: entry.student || null, concept: entry.concept || null, week: entry.week || null, n: entry.n }
      : null;
  const [conceptsFocus, setConceptsFocus] = React.useState(() => doorOf(request));
  const doorCount = React.useRef(0);
  // Words a press on the page puts into the field at its foot, unsent.
  const [fill, setFill] = React.useState(null);
  React.useEffect(() => {
    const door = doorOf(request);
    if (door) setConceptsFocus(door);
  }, [request ? request.n : null]);
  // What is on screen, said to the pane (the inspector's focus) and to the
  // navigator (which marks the place as current); null once closed.
  const onShown = props.onShown;
  React.useEffect(() => {
    const place = { mode: mode, view: view };
    if (onShown) onShown(place);
    window.dispatchEvent(new CustomEvent(PLACE_SHOWN_EVENT, { detail: place }));
  }, [mode, view]);
  React.useEffect(
    () => () => window.dispatchEvent(new CustomEvent(PLACE_SHOWN_EVENT, { detail: null })),
    [],
  );  // The week Teaching was last stepped to. The page steps without a round
  // trip and reports each step; it is held in a ref so a step redraws
  // nothing, and copied into `week` only when Teaching is drawn again — on
  // coming back to it, or when the record or the drafts toggle changes.
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
  // With the course navigator in the sidebar, course mode is the centre and
  // the sidebar stays usable beside it: pressing another place moves it, and
  // a chat opens over it. So the veil starts at the sidebar's right edge,
  // followed as the sidebar collapses to its rail or is dragged wider. The
  // column is found from the navigator outwards — the outermost ancestor
  // still flush with the window's left edge and narrower than half of it —
  // rather than by the shell's class names, which are hashed. With the stock
  // browser in the seat there is no navigator, and the veil covers it all.
  const [left, setLeft] = React.useState(0);
  // The right edge is the window's: a place is the page, and the inspector,
  // which says what is waiting beside a chat, has nothing to add beside the
  // place that draws it. With the chat asked for (`props.chat`), the shell's
  // own conversation column is moved into a strip at the right — see
  // `useChatBeside` — and the place stops at it; on a window too narrow for
  // both, the place steps aside and the chat has the screen.
  const beside = useChatBeside(Boolean(props.chat), left);
  const veilRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const nav = document.querySelector(".pp-nav, .pp-nav-rail");
    if (!nav) return undefined;
    let column = null;
    for (let node = nav.parentElement; node && node !== document.body; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      // Not a zero-width box: the shell wraps seats in `display: contents`
      // elements, which measure 0 wide at 0 and would put the edge there.
      if (rect.left <= 0.5 && rect.width > 0 && rect.width < window.innerWidth / 2) column = node;
    }
    if (column === null) return undefined;
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
  // Teaching, Evidence and the course-wide views carry class figures or
  // names, so there is no student version of any of them to preview.
  const private_ = view !== null || mode === "teaching" || mode === "evidence";
  const preview = student && !private_;
  // × and Escape go back to Today from any other place, and close course
  // mode only from Today itself: closing from a place used to land on the
  // empty chat Today replaced (docs/RIBBONS.md R10). Read through a ref, for
  // the key handler registered once.
  const onToday = view === "today";
  const onTodayRef = React.useRef(onToday);
  onTodayRef.current = onToday;
  const back = () => {
    if (onTodayRef.current) close();
    else setView("today");
  };
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      // A key pressed in the chat beside the place is the chat's: Escape
      // there stops a turn or clears a menu, and must not shut the place.
      const target = event.target;
      if (props.chat && veilRef.current && target instanceof Node && target !== document.body && !veilRef.current.contains(target)) return;
      // An editor or a form open on the page (a title, the item dialog, the
      // dates) owns Escape: it puts its value back and the place stays. This
      // listener runs first, at the window, so the editor's own handler
      // cannot stop it; the mark on the editor is how it is told.
      if (event.composedPath().some((node) => node instanceof Element && (node.hasAttribute("data-own-escape") || node.classList.contains("planform")))) return;
      // The connections panel, open from the header, closes first.
      if (document.querySelector(".pp-connpanel")) return;
      // A deck opened from the term plan sits on top and owns Escape: it
      // closes first, and this stays where the professor was reading.
      if (courseModeEscape({ covered: props.covered }) === "close") back();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, props.covered, props.chat]);
  // Canvas, in one line: the row the Integrations tab's Status view draws,
  // from the same payload. Nothing is computed here but the words.
  const wiring = useJson(
    scoped(BASE + "/api/integrations?run=" + encodeURIComponent(props.runId || "") + "&r=" + integrationsVersion, props.sessionId),
  );
  const canvas =
    wiring.phase === "ready" && wiring.value && !wiring.value.error
      ? (wiring.value.integrations || []).find((row) => row.id === "canvas") || null
      : null;

  // How many sync rows wait for the professor, for the header line. Read
  // without names: a count needs none.
  const syncs = useJson(
    scoped(BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + "&r=" + syncsVersion, props.sessionId),
  );
  // The last answer of each read is kept while the next one loads, so a
  // confirm or a run — which move their versions — does not blank the line.
  const shown = React.useRef({ canvas: null, waiting: 0, data: null, roads: null });
  if (wiring.phase === "ready") {
    shown.current.canvas = canvas;
    shown.current.data = wiring.value && !wiring.value.error ? wiring.value : null;
  }
  if (syncs.phase === "ready") {
    shown.current.waiting = syncs.value && !syncs.value.error ? (syncs.value.waiting || []).length : 0;
    shown.current.roads = syncs.value && !syncs.value.error ? syncs.value : null;
  }
  const waiting = shown.current.waiting;
  const canvasLine = shown.current.canvas;
  // How many records say `approval: draft`, for the drafts switch: the
  // count the right column's inspector reads, cached on the server per
  // revision of the workspace.
  const recent = useJson(scoped(BASE + "/api/recent?r=" + everything, props.sessionId));
  if (recent.phase === "ready" && recent.value && typeof recent.value.drafts === "number") shown.current.drafts = recent.value.drafts;
  const draftCount = typeof shown.current.drafts === "number" ? shown.current.drafts : null;
  // A press in the connections panel jumps to that service's card.
  const [jump, setJump] = React.useState(null);
  const openCard = (service) => {
    setJump((current) => ({ service, tick: (current ? current.tick : 0) + 1 }));
    setSub("settings", "integrations");
    setView("settings");
  };

  /**
   * A press on Today: a reading, a view, or a window over course mode. The
   * request shapes are the navigator's, plus `{ grade }` and `{ scans }`.
   */
  const openFromToday = (request) => {
    if (!request) return;
    if (request.grade) {
      if (props.onGrade) props.onGrade(request.grade, request.label);
    } else if (request.scans) {
      if (props.onOpenScans) props.onOpenScans(request.scans);
    } else if (request.view && known(request.view, COURSE_VIEWS)) {
      if (VIEW_SUBS[request.view] && known(request.sub, VIEW_SUBS[request.view])) setSub(request.view, request.sub);
      // A door into the Concepts grid from inside course mode — the command
      // field's student or concept — numbered like the pane's own.
      const door = doorOf(Object.assign({}, request, { n: "here-" + (doorCount.current += 1) }));
      if (door) setConceptsFocus(door);
      setView(request.view);
    } else if (request.mode && known(request.mode, COURSE_MODES)) {
      // Teaching on a week named by the command field ("week 7").
      if (request.mode === "teaching" && Number.isInteger(request.week)) stepped.current = request.week;
      chooseMode(request.mode);
    }
  };
  // The command field's choice (shared/actions.js): a place, or one of the
  // header's windows. A skill it fills into the field itself.
  const runCommand = (action) => {
    if (action.open) openFromToday(action.open);
    else if (action.press === "publish" && props.onPublish) props.onPublish();
    else if (action.press === "upload" && props.onUpload) props.onUpload();
  };

  const viewBody = () => {
    if (view === "today") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        h(Today, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: everything + "." + syncsVersion + "." + filesVersion,
          onOpen: openFromToday,
          // A line of the phase's list that is the assistant's: its skill
          // goes into the field to be finished, as the command field does.
          onFill: (text) => setFill({ text: text.trimEnd(), n: "fill-" + (doorCount.current += 1) }),
        }),
      );
    }
    if (view === "syncs") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        h(SyncView, {
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          revision: syncsVersion,
          onWrite: (tags) => props.wrote(tags || ["syncs"]),
          onOpenSettings: () => {
            setSub("settings", "integrations");
            setView("settings");
          },
          key: props.runId,
        }),
      );
    }
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
          key: props.runId,
        }),
      );
    }
    if (view === "settings") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        subOf("settings") === "preferences"
          ? h(Preferences, { courseId: props.courseId || "", term: props.term || "", sessionId: props.sessionId })
          : h(Integrations, {
              runId: props.runId,
              sessionId: props.sessionId,
              onWrite: () => props.wrote(["integrations"]),
              revision: integrationsVersion,
              names: props.names,
              ask: props.ask,
              focus: jump || props.integrationsFocus,
              onOpenSync: () => setView("syncs"),
              // Integrations or Accounts, as the place bar chose.
              placed: true,
              subView: subOf("settings") === "accounts" ? "accounts" : "course",
              key: props.runId,
            }),
      );
    }
    if (view === "concepts") {
      return h(ConceptsGrid, {
        key: props.runId,
        runId: props.runId,
        sessionId: props.sessionId,
        names: props.names,
        drafts: props.drafts,
        revision: everything,
        focus: conceptsFocus,
        // A question from the grid starts a turn and brings the chat in
        // beside it, as the composer does.
        ask: props.ask
          ? (text) => {
              props.ask(text);
              setChat(true);
            }
          : null,
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
        title: (VIEW_SUBS.materials.find((entry) => entry.id === sub) || { label: "Materials" }).label,
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
        title: "Students",
      });
    }
    if (view === "gradebook") {
      const part = subOf("gradebook");
      if (part === "canvas") {
        return h(GradebookStatus, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: marksVersion,
          names: props.names,
          ask: props.ask,
          onWrite: () => props.wrote(["grading"]),
        });
      }
      if (part === "policy" || part === "changes") {
        return h(GradebookPanes, {
          only: part,
          runId: props.runId,
          sessionId: props.sessionId,
          revision: gradingVersion,
          names: props.names,
          ask: props.ask,
          onWrite: () => props.wrote(["grading"]),
        });
      }
      return h(WidgetFrame, {
        key: "gradebook|" + props.dark + "|" + props.drafts,
        revision: everything,
        view: "gradebook",
        runId: props.runId,
        sessionId: props.sessionId,
        dark: props.dark,
        drafts: props.drafts,
        title: "Gradebook",
      });
    }
    if (taskSub === "waiting") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        h(WaitingPlace, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: everything + "." + syncsVersion + "." + filesVersion,
          onOpen: openFromToday,
        }),
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
        names: props.names,
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
  const named =
    view === "students" ||
    view === "syncs" ||
    // The Gradebook names students (its marks, Last changes); without the
    // switch here a projected Gradebook could not be covered in place.
    view === "gradebook" ||
    // The Concepts grid is a column per student.
    view === "concepts" ||
    (view === "settings" && subOf("settings") === "integrations") ||
    // Everything names nobody; the lists it is drawn from do.
    (view === "tasks" && taskSub !== "unpublished" && taskSub !== "waiting");
  // With the navigator in the sidebar the places are chosen there, and this
  // header keeps only the readings of the weeks. Without it — the stock
  // browser in the seat, nothing measured — the row is the only way in.
  const navigator = left > 0;
  const viewEntry = view ? COURSE_VIEWS.find((entry) => entry.id === view) || null : null;

  const placeName = viewEntry ? viewEntry.label : navigator ? "Weeks" : props.title;
  // The title says which part of the place is open, as the composer did
  // alone before: "Weeks · Teaching", "Materials · Slides", and Today's date
  // (docs/RIBBONS.md R9).
  const subLabel = view
    ? VIEW_SUBS[view]
      ? (VIEW_SUBS[view].find((entry) => entry.id === subOf(view)) || { label: null }).label
      : view === "today"
        ? new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
        : null
    : (COURSE_MODES.find((entry) => entry.id === mode) || { label: null }).label;
  const placeTitle = subLabel ? placeName + " · " + subLabel : placeName;
  // Where the drafts switch changes what is drawn: the weeks, and the views
  // computed over the course model. Today, Students, Files, Sync and Course
  // settings read the same either way, and so do Tasks' Ready and Checklist,
  // which are about the drafted half whatever the switch says (see
  // server/routes/views.js) — so the switch is not on them.
  const draftsApply =
    view === null ||
    view === "concepts" ||
    view === "materials" ||
    // The marks grid; the Canvas status, the policy and its history read
    // the same either way.
    (view === "gradebook" && subOf("gradebook") === "marks") ||
    // Pending, whose id is `tasks`: the inbox, over the half the switch picks.
    (view === "tasks" && taskSub === "tasks");
  // The readings of the weeks and Preview as student are Weeks' own, drawn
  // in its place bar under the header; without the navigator (the stock
  // browser in the seat) the header is the only row, and they stay in it.
  const readings = COURSE_MODES.map((entry) => segment(entry, view === null && mode === entry.id, () => chooseMode(entry.id), false));
  // Not on Teaching, Evidence or a course-wide view: a student is never
  // shown class figures or names, so there is nothing to preview.
  const previewSwitch = private_
    ? null
    : h(
        "label",
        { title: "The record alone, with no hole drawn — what ainar page publishes", key: "preview" },
        h("input", {
          type: "checkbox",
          checked: student,
          onChange: (event) => setStudent(event.target.checked),
        }),
        "Preview as student",
      );
  const setChat = props.setChat || (() => {});
  const chatState = useChatState(props.chatState, Boolean(props.chat), props.sessionId);
  return ReactDOM.createPortal(
    h(
      React.Fragment,
      null,
      h(
      "div",
      {
        ref: veilRef,
        className:
          "pp-veil pp-coursemode" +
          (beside.mode === "side" ? " pp-beside" : "") +
          (beside.mode === "swap" ? " pp-away" : ""),
        style: { left: left + "px", right: (beside.mode === "side" ? beside.width : 0) + "px" },
        "aria-hidden": beside.mode === "swap" ? "true" : undefined,
      },
      h(
        "div",
        {
          className: "pp-modal",
          role: "region",
          "aria-label": "Course mode — " + props.title,
        },
        h(
          "div",
          { className: "pp-modalhead pp-coursehead" },
          // The place, not the course: the course is named in the navigator
          // beside it and in the column, and here it only crowded the row.
          h("div", { className: "pp-modaltitle", title: props.title }, placeTitle),
          // The middle of the row is the one part that gives way: on a narrow
          // window it scrolls sideways, so the controls on the right — the
          // connections, Publish, Chat and × — never wrap under the title.
          h(
            "div",
            { className: "pp-headmid" },
            navigator ? null : readings,
            navigator ? null : h("span", { className: "pp-segsep", "aria-hidden": "true" }),
            navigator ? null : COURSE_VIEWS.map((entry) => segment(entry, view === entry.id, () => setView(entry.id), preview)),
            h("span", { className: "pp-segspacer" }),
            // One switch with the count, and only where it changes what is
            // drawn (docs/RIBBONS.md R4). Pressed: drafts are in the view.
            draftsApply
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn pp-draftswitch",
                    "aria-pressed": Boolean(props.drafts),
                    title: props.drafts
                      ? "Showing drafts with the record. Press to see only what has been accepted."
                      : "Showing only what has been accepted. Press to include records marked approval: draft.",
                    onClick: () => props.setDrafts(!props.drafts),
                  },
                  "Drafts",
                  draftCount !== null ? h("span", { className: "pp-draftcount" }, draftCount.toLocaleString()) : null,
                )
              : null,
            navigator ? null : previewSwitch,
          ),
          // The pane's header, which this veil covers. Publish opens its own
          // window on top, so course mode is still here when it closes.
          // Upload is not here: it is on Files and on an assessment's scans
          // slot, where the files are about something (docs/RIBBONS.md R1).
          // The connections are a mark per service, coloured by how each
          // stands, and hold their syncs; with none to show (no payload yet),
          // the old Canvas line stands in.
          shown.current.data
            ? h(ConnectionsMenu, {
                data: shown.current.data,
                roads: shown.current.roads,
                waiting,
                runId: props.runId,
                sessionId: props.sessionId,
                names: props.names,
                revision: integrationsVersion + "." + syncsVersion,
                disabled: preview,
                onOpen: openCard,
                onDone: () => props.wrote(["syncs", "marks", "integrations"]),
              })
            : canvasLine || waiting
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-wiring pp-wiring-" + (canvasLine ? canvasLine.state : "ready") + (waiting ? " pp-wiring-waiting" : ""),
                  title: preview ? "Private — not shown while previewing as a student" : waiting ? "Open Sync" : "Open Integrations",
                  disabled: preview,
                  onClick: () => {
                    if (waiting) return setView("syncs");
                    setSub("settings", "integrations");
                    setView("settings");
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
            {
              type: "button",
              // The one control in the header whose result other people see:
              // drawn as going out, not filled — it opens a preview, and the
              // red fill is the Send inside it (docs/RIBBONS.md R8).
              className: "pp-publishbtn pp-outward",
              title:
                "Publish the course page, an announcement, a repository or a Canvas brief. Students see what you send; " +
                "nothing goes until you confirm the preview.",
              onClick: props.onPublish,
            },
            "Publish",
            h("span", { className: "pp-outwardmark", "aria-hidden": "true" }, "↗"),
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
              "aria-busy": chatState === "running" ? "true" : undefined,
              title: CHAT_STATE_TIP[chatState]
                ? CHAT_STATE_TIP[chatState] + " — " + (props.chat ? "put the chat away" : "press to see it")
                : props.chat
                  ? "Put the chat away; the place takes the width"
                  : "The chat beside this place",
              onClick: () => setChat(!props.chat),
            },
            CHAT_STATE_WORD[chatState] ? "Chat · " + CHAT_STATE_WORD[chatState] : "Chat",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-close",
              "aria-label": onToday ? "Close course mode" : "Back to Today",
              title: onToday ? "Back to the conversation (Esc)" : "Back to Today (Esc)",
              onClick: back,
            },
            "×",
          ),
        ),
        h(
          "div",
          { className: "pp-coursebody" },
          // Weeks' place bar: its four readings on the left, Preview as
          // student on the right — the same row Materials and Tasks have for
          // their sub-views (docs/RIBBONS.md R3, R7). A course-wide view is
          // drawn over it, with its own.
          navigator
            ? h(
                "div",
                { className: "pp-cviewbar" },
                readings,
                h("span", { className: "pp-segspacer" }),
                previewSwitch,
              )
            : null,
          // The weeks, drawn here by React from the course data
          // (client/course/): a refresh re-renders in place, and a Planning
          // drop moves its bar before the write is made.
          h(CourseView, {
            runId: props.runId,
            sessionId: props.sessionId,
            dark: props.dark,
            drafts: props.drafts,
            student: preview,
            mode: mode,
            week: mode === "teaching" ? week : null,
            mention: props.mention,
            chatTitle: props.chatTitle,
            fresh: props.startChat ?(text) => props.startChat({ mode: mode, draft: text }) : null,
            onStep: (n) => {
              stepped.current = n;
            },
          }),
          // The weeks stay mounted under a course-wide view, so coming back
          // to them keeps the place and the scroll.
          view
            ? h(
                "section",
                { className: "pp-cview", "aria-label": viewEntry ? viewEntry.label : "Course" },
                VIEW_SUBS[view] || named
                  ? h(
                      "div",
                      { className: "pp-cviewbar" },
                      VIEW_SUBS[view] ? VIEW_SUBS[view].map((entry) => segment(entry, subOf(view) === entry.id, () => setSub(view, entry.id), false)) : null,
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
        // The chat's text field on the page itself, while the chat is not
        // beside it: a question asked here starts the turn and brings the
        // chat in beside the place, which stays where it was.
        props.chat || !props.ask
          ? null
          : h(CourseComposer, {
              key: props.sessionId,
              focus: Boolean(props.compose),
              draft: fill || props.draft,
              place: placeTitle,
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              revision: everything,
              onCommand: runCommand,
              onSend: (text) => {
                props.ask(text);
                setChat(true);
              },
            }),
      ),
      ),
      // The chat beside the place, put away from the chat's own side: a tab
      // on the rule between the two, halfway down, where it covers neither
      // header (the chat's title and Session log, the place's own ×).
      beside.mode === "side"
        ? h(
            "button",
            {
              type: "button",
              className: "pp-chatclose",
              style: { right: beside.width - 13 + "px" },
              "aria-label": "Put the chat away",
              title: "Put the chat away; the place takes the width",
              onClick: () => setChat(false),
            },
            "›",
          )
        : null,
      // The place stepped aside for the chat on a narrow window: the way back.
      beside.mode === "swap"
        ? h(
            "button",
            { type: "button", className: "pp-primary pp-backpill", onClick: () => setChat(false) },
            "‹ " + placeName,
          )
        : null,
    ),
    document.body,
  );
}

const CHAT_STATE_WORD = { running: "working", waiting: "needs you", done: "done" };
const CHAT_STATE_TIP = {
  running: "The assistant is working",
  waiting: "The chat is waiting for your answer",
  done: "The assistant finished while the chat was put away",
};

/**
 * How the open chat is doing, for the Chat button: "running", "waiting"
 * (an approval or a question it is stopped on), "done" (it finished while
 * the chat was put away, until the chat is looked at again) or "idle".
 *
 * `source` is `{ get, subscribe }` over the harness's session list
 * (client/main.js); without it the button is the plain toggle it was.
 */
function useChatState(source, shown, sessionId) {
  const latest = React.useRef(source);
  latest.current = source;
  const [live, setLive] = React.useState(() => (source ? source.get() : "idle"));
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!latest.current) return undefined;
    const read = () => setLive(latest.current ? latest.current.get() : "idle");
    read();
    return latest.current.subscribe(read);
  }, [sessionId, Boolean(source)]);
  // A turn that ends out of sight is news; one watched to its end is not.
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

/**
 * The chat's text field, docked at the foot of an open place.
 *
 * A new chat started from the navigator with a place open lands here rather
 * than on the chat's empty page, so the professor keeps looking at what they
 * were looking at while they type (`focus`). What is sent names where it was
 * asked from — the place and the run — so the session does not have to be
 * told which course and which view "this" meant. Enter sends, Shift+Enter is
 * a new line.
 *
 * It is also the command field (BACKLOG E37 HOME-12). As the professor types,
 * it offers what the action catalogue (shared/actions.js) and the run's own
 * weeks, students, assessments and concepts match. ↑ ↓ and a click choose one;
 * Enter opens a match only when what was typed names it exactly ("week 7",
 * "sync all", a student's full name), and otherwise asks the assistant as it
 * always did — a question that mentions week 7 is still a question. A skill
 * is put into the field to be finished, never sent.
 */
/** What each kind of suggestion is called in the command field. */
const CMD_KIND = { action: "Do", week: "Week", student: "Student", assessment: "Assessment", concept: "Concept" };

function CourseComposer(props) {
  const [text, setText] = React.useState("");
  const [lit, setLit] = React.useState(-1);
  const box = React.useRef(null);
  const index = useJson(
    scoped(
      BASE + "/api/command-index?run=" + encodeURIComponent(props.runId || "") + (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(String(props.revision || 0)),
      props.sessionId,
    ),
  );
  const known = React.useRef(null);
  if (index.phase === "ready" && index.value && !index.value.error) known.current = index.value;
  // A filled skill ("/prepare-lesson …") is being finished, not looked for.
  const matches = props.onCommand && !text.trim().startsWith("/") ? matchCommand(text, known.current) : [];
  React.useEffect(() => setLit(-1), [text]);
  const choose = (entry) => {
    if (entry.do.fill) {
      setText(entry.do.fill.replace("{run}", props.runId || ""));
      if (box.current) box.current.focus();
      return;
    }
    setText("");
    props.onCommand(entry.do);
  };
  React.useEffect(() => {
    if (props.focus && box.current) box.current.focus();
  }, [props.focus]);
  // Words a press brought with a new chat (`draft`), added after whatever is
  // typed, with the caret after them: the question is the professor's.
  const draftN = props.draft ? props.draft.n : null;
  React.useEffect(() => {
    if (!props.draft) return;
    const add = props.draft.text;
    setText((was) => (was.trim() ? was.replace(/\s+$/, "") + " " + add : add) + " ");
    if (box.current) box.current.focus();
  }, [draftN]);
  // The field grows with what is typed, to a third of the window.
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight / 3)) + "px";
  }, [text]);
  const send = () => {
    const said = text.trim();
    if (!said) return;
    props.onSend(said + "\n\n(Asked from course mode — " + props.place + (props.runId ? ", run " + props.runId : "") + ".)");
    setText("");
  };
  return h(
    "form",
    {
      className: "pp-composer",
      "data-own-escape": text ? "" : undefined,
      onSubmit: (event) => {
        event.preventDefault();
        send();
      },
    },
    matches.length
      ? h(
          "div",
          { className: "pp-cmdlist", role: "listbox", "aria-label": "Go to" },
          matches.map((entry, i) =>
            h(
              "button",
              {
                type: "button",
                key: entry.key,
                role: "option",
                "aria-selected": i === lit,
                className: "pp-cmd" + (i === lit ? " pp-cmd-lit" : ""),
                // Chosen on press, before the field loses focus.
                onMouseDown: (event) => {
                  event.preventDefault();
                  choose(entry);
                },
              },
              h("span", { className: "pp-cmdkind" }, CMD_KIND[entry.kind] || entry.kind),
              h("span", { className: "pp-cmdlabel" }, entry.label),
              entry.outward ? h("span", { className: "pp-cmdout", title: "Students see the result; it still asks before anything goes" }, "↗") : null,
              entry.hint ? h("span", { className: "pp-cmdhint" }, entry.hint) : null,
              entry.exact && lit < 0 && i === 0 ? h("kbd", null, "Enter") : null,
            ),
          ),
          h(
            "div",
            { className: "pp-cmdfoot" },
            matches[0].exact ? "Enter opens the first · ↑↓ to choose · Shift+Enter for a new line" : "↑↓ to choose · Enter asks the assistant",
          ),
        )
      : null,
    h("textarea", {
      ref: box,
      rows: 1,
      value: text,
      placeholder: "Ask the assistant about " + props.place + " — or type a place, a week, a student…",
      "aria-label": "Message the session, or go to a place",
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => {
        if (matches.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          // Through none (-1) and each suggestion, round again at either end.
          const step = event.key === "ArrowDown" ? 1 : -1;
          setLit((value) => {
            const next = value + step;
            if (next >= matches.length) return -1;
            if (next < -1) return matches.length - 1;
            return next;
          });
          return;
        }
        if (event.key === "Escape" && lit >= 0) {
          setLit(-1);
          return;
        }
        if (event.key === "Escape" && text) {
          setText("");
          return;
        }
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          if (lit >= 0 && matches[lit]) return choose(matches[lit]);
          if (matches.length && matches[0].exact) return choose(matches[0]);
          send();
        }
      },
    }),
    h(
      "button",
      { type: "submit", className: "pp-composersend", disabled: !text.trim(), title: "Send (Enter)", "aria-label": "Send" },
      "↑",
    ),
  );
}

/** The chat strip's width at a window width: a third of it, within reason. */
const chatWidth = (viewport) => Math.max(380, Math.min(520, Math.round(viewport * 0.32)));

/** The narrowest a place may be with the chat beside it; below, they swap. */
const PLACE_MIN = 560;

/**
 * The shell's conversation column, moved beside an open place.
 *
 * The chat is not drawn twice: it stays the shell's own column, with its
 * composer, its turns and its scroll. AppFrame lays the columns out as one
 * grid — sidebar, centre, details — with the widths in an inline
 * `grid-template-columns`. While the chat is asked for, the grid gets
 * `data-pp-split`, and the stylesheet re-tracks it: the sidebar at its own
 * width, then a track the place covers (the details column goes there,
 * hidden), then the chat at `chatWidth`. The columns are found by structure
 * — the grid above `.pp-root`, the child holding the pane, the child holding
 * the navigator — since the shell's class names are hashed. The sidebar's
 * track is read off AppFrame's own inline value and followed as it changes,
 * so collapsing or dragging the sidebar still works.
 *
 * Returns `{ mode, width }`: "none", "side" (the strip is `width` wide at the
 * window's right) or "swap" (too narrow for both; the place steps aside).
 */
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
    if (mode !== "side") return undefined;
    const pane = document.querySelector(".pp-root");
    let frame = null;
    for (let node = pane ? pane.parentElement : null; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).display === "grid" && node.children.length >= 3) {
        frame = node;
        break;
      }
    }
    if (frame === null) return undefined;
    const columns = Array.from(frame.children).slice(0, 3);
    const details = columns.find((column) => column.contains(pane));
    const nav = document.querySelector(".pp-nav, .pp-nav-rail");
    const sidebar = columns.find((column) => column !== details && nav && column.contains(nav)) || columns[0];
    const centre = columns.find((column) => column !== details && column !== sidebar);
    if (!details || !centre) return undefined;
    const follow = () => {
      const track = String(frame.style.gridTemplateColumns || "").trim().split(/\s+/)[0] || "";
      const side = /^\d+(\.\d+)?px$/.test(track) ? track : Math.round(sidebar.getBoundingClientRect().width) + "px";
      if (frame.style.getPropertyValue("--pp-side") !== side) frame.style.setProperty("--pp-side", side);
    };
    follow();
    frame.style.setProperty("--pp-chat", width + "px");
    centre.setAttribute("data-pp-col", "centre");
    details.setAttribute("data-pp-col", "details");
    // The details column's drag handle: a narrow child past the columns, to
    // the right of the sidebar's own. Left where AppFrame put it, it would
    // sit in the chat strip and resize a column nobody can see.
    const sideRight = sidebar.getBoundingClientRect().right;
    const handles = Array.from(frame.children)
      .slice(3)
      .filter((child) => {
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

export function MaterialModal(props) {
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
