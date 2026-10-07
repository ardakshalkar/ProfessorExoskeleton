/**
 * The pane itself — the button bar and whichever tab is open — and the header
 * button that opens it.
 */

import { Message, useDark, useJson } from "./common.js";
import { DefenceDesk } from "./defence-desk.js";
import { Integrations } from "./integrations.js";
import { GradebookStatus, Unpublished } from "./marks.js";
import { CourseMode, MaterialModal, materialUrl, WidgetFrame } from "./materials.js";
import { Preferences } from "./preferences.js";
import { PublishModal } from "./publish.js";
import { h, React } from "./react.js";
import { ScansTab } from "./scans.js";
import {
  BASE,
  defaultSub,
  DRAFT_MODES,
  IDENTITY_MODES,
  NAMED_TABS,
  NO_DRAFT_PAIR,
  NO_SEGMENTED_ROW,
  scoped,
  SUBVIEWS,
  TABS,
  useRevisionWatch,
} from "./tabs.js";
import { BatchModal, UploadModal } from "./upload.js";

// ----------------------------------------------------------------- pane

/**
 * The pane.
 *
 * `sessionId` and the owner share arrive from the slot registration below;
 * `details` is a session-scoped slot, so this only ever renders with a
 * session open, which is also the only time there is anywhere to send a
 * widget's question.
 */
export function ProfessorPane(props) {
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
      if (data.kind === "publish") {
        if (typeof data.assessment !== "string" || data.assessment.trim() === "") return;
        openPublish("homework", {
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
          openUnpublished: () => {
            setTab("tasks");
            setSubViews((value) => Object.assign({}, value, { tasks: "unpublished" }));
          },
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
          covered: material !== null || publishing !== null,
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
export const inject = ["slots", "layout", "sessions", "conversation"];

/**
 * The opener.
 *
 * Nothing in the shipped harness opens the details column, so a pane that
 * only registered into `details` would be a pane nobody could reach. This
 * puts one button in the session header beside the job list.
 */
export function OpenPaneAction(props) {
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
