/**
 * The sandboxed frame every served document goes into, material links and the
 * material overlay, and Course mode.
 */

import { decodeIssues, Message, useJson } from "./common.js";
import { courseModeEscape } from "./course-escape.js";
import { GradebookStatus, Unpublished } from "./marks.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, DRAFT_MODES, IDENTITY_MODES, scoped, SUBVIEWS } from "./tabs.js";

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
export function WidgetFrame(props) {
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
 * What does not belong to any one week, beside the weeks: the class list,
 * the gradebook and the tasks, each the very document its pane tab shows,
 * in a drawer from the right. They carry names and marks, so they are
 * private: Preview as student closes them and turns their buttons off.
 */
const DRAWERS = [
  { id: "students", label: "Students", hint: "The class list, by subgroup — names and marks, so private" },
  { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment, and how much of it Canvas has" },
  { id: "tasks", label: "Tasks", hint: "What is waiting for you, what is ready, what has not gone out" },
];

/** The Status view's words for a connection, as the Integrations tab says them. */
const CONNECTION_STATE = { ready: "connected", partial: "partly set up", absent: "not set up" };

export function CourseMode(props) {
  const close = props.onClose;
  const [student, setStudent] = React.useState(false);
  const [mode, setMode] = React.useState(() => defaultCourseMode(props.start, props.end));
  const [drawer, setDrawer] = React.useState(null);
  const [taskSub, setTaskSub] = React.useState(SUBVIEWS.tasks[0].id);
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
  };
  // Teaching and Evidence carry class figures, so there is no student
  // version of either to preview.
  const private_ = mode === "teaching" || mode === "evidence";
  const preview = student && !private_;
  // The privacy wall: a student preview never sits beside a class list.
  React.useEffect(() => {
    if (preview) setDrawer(null);
  }, [preview]);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      // A deck opened from the term plan sits on top and owns Escape: it
      // closes first, and this stays where the professor was reading.
      const step = courseModeEscape({ covered: props.covered, drawer });
      if (step === "drawer") setDrawer(null);
      else if (step === "close") close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, props.covered, drawer]);
  // Canvas, in one line: the row the Integrations tab's Status view draws,
  // from the same payload. Nothing is computed here but the words.
  const wiring = useJson(
    scoped(BASE + "/api/integrations?run=" + encodeURIComponent(props.runId || "") + "&r=" + props.reload, props.sessionId),
  );
  const canvas =
    wiring.phase === "ready" && wiring.value && !wiring.value.error
      ? (wiring.value.integrations || []).find((row) => row.id === "canvas") || null
      : null;

  const drawerBody = () => {
    if (drawer === "students") {
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
    if (drawer === "gradebook") {
      return h(
        React.Fragment,
        null,
        h(GradebookStatus, {
          runId: props.runId,
          sessionId: props.sessionId,
          revision: props.reload,
          openUnpublished: () => {
            setDrawer("tasks");
            setTaskSub("unpublished");
          },
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
  const drawerEntry = DRAWERS.find((entry) => entry.id === drawer) || null;

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
          COURSE_MODES.map((entry) =>
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                "aria-pressed": mode === entry.id,
                title: entry.hint,
                onClick: () => chooseMode(entry.id),
                key: entry.id,
              },
              entry.label,
            ),
          ),
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
          // Not on Teaching: a student is never shown class figures, so
          // there is no student version of that page to preview.
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
          // they close; the jump is for everything the term plan does not
          // draw — it closes course mode and opens the pane on that tab.
          // The course-wide views, beside the weeks rather than instead of
          // them. One at a time; a second press closes it.
          DRAWERS.map((entry) =>
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn pp-cdrawerbtn",
                "aria-pressed": drawer === entry.id,
                disabled: preview,
                title: preview ? "Private — not shown while previewing as a student" : entry.hint,
                onClick: () => setDrawer(drawer === entry.id ? null : entry.id),
                key: entry.id,
              },
              entry.label,
            ),
          ),
          canvas
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-wiring pp-wiring-" + canvas.state,
                  title: "Close course mode and open Integrations in the pane",
                  onClick: () => props.onJump("integrations"),
                },
                "Canvas: " + (CONNECTION_STATE[canvas.state] || canvas.state),
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
          drawerEntry
            ? h(
                "aside",
                { className: "pp-cdrawer", "aria-label": drawerEntry.label },
                h(
                  "div",
                  { className: "pp-cdrawerhead" },
                  h("b", null, drawerEntry.label),
                  drawer === "tasks"
                    ? SUBVIEWS.tasks.map((entry) =>
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pp-segbtn",
                            "aria-pressed": taskSub === entry.id,
                            onClick: () => setTaskSub(entry.id),
                            key: entry.id,
                          },
                          entry.label,
                        ),
                      )
                    : null,
                  h("span", { className: "pp-segspacer" }),
                  // The pane's own Names / Pseudonyms choice, on the views
                  // that name people: the same state, so the two never differ.
                  drawer === "students" || (drawer === "tasks" && taskSub !== "unpublished")
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
                  h(
                    "button",
                    { type: "button", className: "pp-close", "aria-label": "Close " + drawerEntry.label, title: "Close (Esc)", onClick: () => setDrawer(null) },
                    "×",
                  ),
                ),
                h("div", { className: "pp-cdrawerbody" }, drawerBody()),
              )
            : null,
        ),
      ),
    ),
    document.body,
  );
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
