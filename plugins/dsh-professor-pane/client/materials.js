/**
 * The sandboxed frame every served document goes into, material links and the
 * material overlay, and Course mode.
 */

import { decodeIssues, Message, useJson } from "./common.js";
import { courseModeEscape } from "./course-escape.js";
import { GradebookPanes } from "./gradebook.js";
import { GradebookStatus, Unpublished } from "./marks.js";
import { Files } from "./files.js";
import { Integrations } from "./integrations.js";
import { Preferences } from "./preferences.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, DRAFT_MODES, IDENTITY_MODES, PLACE_SHOWN_EVENT, scoped, SUBVIEWS } from "./tabs.js";

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
  { id: "settings", label: "Course settings", hint: "Integrations — Canvas, the grade sheet, GitHub — and the preferences the skills assume" },
];

/**
 * The views drawn as more than one document, and which: the first is the
 * default. Each is a real view of the run, not a filter over one payload.
 */
const VIEW_SUBS = {
  tasks: SUBVIEWS.tasks,
  materials: [
    { id: "assessments", label: "Assessments" },
    { id: "slides", label: "Slides" },
    { id: "exams", label: "Exams" },
    { id: "grading", label: "Grading policy" },
    { id: "outline", label: "Student's outline" },
  ],
  settings: [
    { id: "integrations", label: "Integrations" },
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
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      // A key pressed in the chat beside the place is the chat's: Escape
      // there stops a turn or clears a menu, and must not shut the place.
      const target = event.target;
      if (props.chat && veilRef.current && target instanceof Node && target !== document.body && !veilRef.current.contains(target)) return;
      // A deck opened from the term plan sits on top and owns Escape: it
      // closes first, and this stays where the professor was reading.
      if (courseModeEscape({ covered: props.covered }) === "close") close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, props.covered, props.chat]);
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
    if (view === "settings") {
      return h(
        "div",
        { className: "pp-cviewpad" },
        subOf("settings") === "preferences"
          ? h(Preferences, { courseId: props.courseId || "", term: props.term || "", sessionId: props.sessionId })
          : h(Integrations, {
              runId: props.runId,
              sessionId: props.sessionId,
              onWrite: props.onWrite,
              revision: props.reload,
              names: props.names,
              ask: props.ask,
              focus: props.integrationsFocus,
              key: props.runId,
            }),
      );
    }
    if (view === "concepts") {
      return h(WidgetFrame, {
        key: "progress|" + props.dark + "|" + props.drafts + "|" + props.reload,
        view: "progress",
        runId: props.runId,
        sessionId: props.sessionId,
        dark: props.dark,
        drafts: props.drafts,
        title: "Concepts",
      });
    }
    if (view === "materials") {
      const sub = subOf("materials");
      return h(WidgetFrame, {
        key: sub + "|" + props.dark + "|" + props.drafts + "|" + props.reload,
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
        h(GradebookPanes, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: props.reload,
          names: props.names,
          ask: props.ask,
          onWrite: props.onWrite,
        }),
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
  const named = view === "students" || (view === "settings" && subOf("settings") === "integrations") || (view === "tasks" && taskSub !== "unpublished");
  // With the navigator in the sidebar the places are chosen there, and this
  // header keeps only the readings of the weeks. Without it — the stock
  // browser in the seat, nothing measured — the row is the only way in.
  const navigator = left > 0;
  const viewEntry = view ? COURSE_VIEWS.find((entry) => entry.id === view) || null : null;

  const placeName = viewEntry ? viewEntry.label : navigator ? "Weeks" : props.title;
  const setChat = props.setChat || (() => {});
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
          h("div", { className: "pp-modaltitle", title: props.title }, placeName),
          // The readings of the weeks. Under a place they are the way back to
          // the weeks, so they stay, unpressed.
          COURSE_MODES.map((entry) => segment(entry, view === null && mode === entry.id, () => chooseMode(entry.id), false)),
          navigator ? null : h("span", { className: "pp-segsep", "aria-hidden": "true" }),
          navigator ? null : COURSE_VIEWS.map((entry) => segment(entry, view === entry.id, () => setView(entry.id), preview)),
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
            { type: "button", className: "pp-publishbtn", title: "Publish the course page, an announcement, a repository or a Canvas brief", onClick: props.onPublish },
            "Publish",
          ),
          h(
            "button",
            { type: "button", className: "pp-publishbtn", title: "Scanned papers, an exam paper and its key, or recorded defences", onClick: props.onUpload },
            "Upload",
          ),
          // The conversation beside the place: a press on a hole starts a
          // turn there, and this is how to look at it again or put it away.
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              "aria-pressed": Boolean(props.chat),
              title: props.chat ? "Put the chat away; the place takes the width" : "The chat beside this place",
              onClick: () => setChat(!props.chat),
            },
            "Chat",
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
      ),
      ),
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
