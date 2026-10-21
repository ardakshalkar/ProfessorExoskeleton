/**
 * The pane itself — the run's header and the inspector under it — and the header
 * button that opens it.
 */

import { useCanvasWatch } from "./canvas-check.js";
import { Message, useDark, useJson } from "./common.js";
import { DefenceDesk } from "./defence-desk.js";
import { Inspector } from "./inspector.js";
import { SheetNotice } from "./marks.js";
import { CourseMode, MaterialModal, materialUrl } from "./materials.js";
import { carryPlace, deliverCarried, PLACE_EVENT, takePendingPlace } from "./navigator.js";
import { PublishModal } from "./publish.js";
import { h, React } from "./react.js";
import { GradeBoard } from "./grade-board.js";
import { ScansModal } from "./scans.js";
import { BASE, scoped } from "./tabs.js";
import { AREAS, useVersion, useWorkspaceWatch, wrote } from "./data.js";
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
  // Which card Integrations should bring into view, from a jump elsewhere
  // (the sheet notice, Students' "Sync from sheet"). The tick makes the same
  // jump work twice.
  const [integrationsFocus, setIntegrationsFocus] = React.useState({ service: null, tick: 0 });
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


  // What changed, per area of the course and per tag (client/data.js): each
  // reader below follows what it reads, so a write redraws only those. The
  // course mode, the inspector and the navigator read across everything.
  const everything = useVersion(AREAS.everything);
  const marksVersion = useVersion(AREAS.marks);
  const gradeVersion = useVersion(AREAS.grade);
  const scansVersion = useVersion(AREAS.scans);
  const deskVersion = useVersion(AREAS.files);
  // After a write made here: `tags` for what it changed outside the course
  // files; what it changed inside them the revision says at once.
  const write = (tags) => wrote(props.sessionId, tags);

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
  // The chat beside an open place, or not. A press that starts a turn or
  // writes into the composer opens it, so the professor sees the answer
  // without leaving the place; the Chat button in course mode puts it away.
  const [chatBeside, setChatBeside] = React.useState(false);
  // What the left sidebar last asked course mode to show — `{ mode }`,
  // `{ view }` — numbered, so the same place pressed twice still lands.
  const [placeRequest, setPlaceRequest] = React.useState(null);
  const placeCount = React.useRef(0);
  /**
   * Open a place in course mode, from this column: `{ mode }`, or `{ view,
   * sub }`. The column has no places of its own since the tabs went (see
   * client/inspector.js), so every jump that used to switch a tab lands here.
   */
  const openPlace = (request) => {
    placeCount.current += 1;
    setPlaceRequest({ ...request, n: "pane-" + placeCount.current });
    setCourseMode(true);
  };
  const focusCard = (service) => {
    setIntegrationsFocus((value) => ({ service, tick: value.tick + 1 }));
    openPlace({ view: "settings", sub: "integrations" });
  };
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
  // The step Scans opens on, or null for the pile's current one.
  const [scansStep, setScansStep] = React.useState(null);

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

  // A place pressed in the course navigator (client/navigator.js). A request
  // made before this pane mounted — a press that started a chat in another
  // course — is taken on mount; later ones arrive as the event. Declared
  // after the effect that clears `chosen` on a session switch, so on the
  // mount of a new session the run the press named is the one that stays.
  React.useEffect(() => {
    const answer = (request) => {
      if (!request) return;
      if (typeof request.run === "string" && request.run) setChosen(request.run);
      // `chat`: the place was open beside a chat the professor switched
      // away from, and comes back the same way beside the new one.
      if (request.chat) setChatBeside(true);
      // `compose`: a new chat started with a place open. The place stays the
      // page and its own composer takes the first message (CourseComposer).
      if (request.compose) setChatBeside(false);
      setPlaceRequest(request);
      setCourseMode(true);
      // `scans`: a pile pressed under Held papers, opened in Scans over the
      // place at Match, where the held papers are named.
      if (typeof request.scans === "string" && /^[A-Z0-9][A-Z0-9-]*$/.test(request.scans)) {
        setScansStep("match");
        setScansPile(request.scans);
      }
    };
    answer(takePendingPlace());
    const onPlace = (event) => {
      takePendingPlace();
      answer(event.detail);
    };
    window.addEventListener(PLACE_EVENT, onPlace);
    return () => window.removeEventListener(PLACE_EVENT, onPlace);
  }, [props.sessionId]);
  const dark = useDark();
  // Re-fetched when the session changes, because a different session may be
  // a different workspace and therefore a different set of courses.
  const runs = useJson(scoped(BASE + "/api/runs", props.sessionId));

  // Anything that writes to the course files redraws what reads them, whoever
  // wrote it — the assistant, an editor, this pane. One watcher per session,
  // shared with the navigator.
  useWorkspaceWatch(props.sessionId);

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
        // brings the chat in beside the place, so the professor watches it
        // answer without losing where they were.
        if (courseModeRef.current) setChatBeside(true);
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
          .then(() => write(["defence"]))
          .catch(() => write(["defence"]));
        return;
      }
      // A fork the student brought in person (`defence fork`). A link the
      // command refuses comes back as its own words, since the frame that
      // asked has no place to show them.
      // *Audio defence* on a homework with nothing handed in: a submission
      // with no link is recorded first, so the desk has one to file under.
      // That is a CLI run of a few seconds, so the desk opens at once and
      // reads its session only once the submission is there.
      if (data.kind === "defence-audio") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run = currentRunRef.current;
        if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        setDesk({ assessment: data.assessment, student: data.student, preparing: true });
        const settle = (next) =>
          setDesk((open) => (open && open.assessment === data.assessment && open.student === data.student ? next : open));
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
            write(["defence"]);
            if (!result.ok) {
              settle(null);
              window.alert(String(result.error || result.output || "the defence could not be started").trim().split("\n").slice(-2).join(" "));
              return;
            }
            settle({ assessment: data.assessment, student: data.student });
          })
          .catch((error) => {
            settle(null);
            window.alert("the defence could not be started: " + String(error));
            write(["defence"]);
          });
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
            write(["files", "defence"]);
          })
          .catch(() => write(["files", "defence"]));
        return;
      }
      if (data.kind === "defence-fork") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run = currentRunRef.current;
        if (!run || !id.test(String(data.assessment)) || !id.test(String(data.student))) return;
        if (typeof data.url !== "string" || !/^https:\/\/\S+$/.test(data.url.trim())) {
          window.alert("A fork link starts with https://");
          write(["defence"]);
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
            write(["defence"]);
          })
          .catch(() => write(["defence"]));
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
          .then(() => write(["defence"]))
          .catch(() => write(["defence"]));
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
            write(["defence"]);
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
          .catch(() => write(["defence"]));
        return;
      }
      // "This is …" on a held paper in the Students view's exam window:
      // `scans assign`, exactly as the Scans tab's Held lane sends it. The
      // frame has nowhere to say a refusal, so it is said here.
      if (data.kind === "scans-place") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        const run = currentRunRef.current;
        if (!run || !id.test(String(data.assessment)) || !/^STUDENT-[A-Z0-9]+$/.test(String(data.student))) return;
        fetch(
          scoped(BASE + "/api/scans/assign?run=" + encodeURIComponent(run) + "&assessment=" + encodeURIComponent(data.assessment), props.sessionId),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: String(data.file || ""), pages: String(data.pages || ""), student: data.student }),
          },
        )
          .then((response) => response.json())
          .then((result) => {
            if (result.error || !result.ok) {
              window.alert(String(result.error || result.output || "the paper was not placed").trim().split("\n").slice(-2).join(" "));
            }
            write(["scans", "files"]);
          })
          .catch((error) => {
            window.alert("the paper was not placed: " + String(error));
            write(["scans", "files"]);
          });
        return;
      }
      // Planning writes its own dates now (client/course/planning.jsx).
      // From an assessment chip in course mode: the Grade view, or the Scans
      // tab as a window on that pile. Each opens over course mode, which stays.
      if (data.kind === "grade" || data.kind === "scans") {
        const id = /^[A-Z0-9][A-Z0-9-]*$/;
        if (!id.test(String(data.assessment))) return;
        if (data.kind === "scans") setScansPile(data.assessment);
        else setGrading({ assessment: data.assessment, label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.assessment });
        return;
      }
      // "Upload scans…" on a paper assessment's row with no pile yet: the
      // upload dialog, already knowing which assessment the papers are.
      if (data.kind === "upload") {
        if (!/^[A-Z0-9][A-Z0-9-]*$/.test(String(data.assessment))) return;
        setUploading({
          assessment: data.assessment,
          label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.assessment,
        });
        return;
      }
      // The Students tab's "Sync from sheet": the Syncs view, where the sheet
      // is read directly or brought in as a downloaded file.
      if (data.kind === "syncs") {
        focusCard("sheets");
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

  // Keep the run checked against Canvas whichever page is open, not only
  // when the Gradebook is: a finished check redraws every Canvas count.
  useCanvasWatch(current ? current.runId : null, props.sessionId);

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
        if (confirm && result.ok) write([]);
      })
      .catch((error) =>
        setPublishing((state) => state && { ...state, phase: "error", text: String(error) }),
      );
  };

  // A press puts words into the composer; under course mode the composer is
  // covered unless the chat is beside the place, so bring it in, as an
  // `ask` does.
  const mentionAndShow = props.mention && ((text) => {
    const written = props.mention(text);
    if (written && courseModeRef.current) setChatBeside(true);
    return written;
  });

  // The other choice: a new chat, with the place carried into it and the words
  // in the place's own composer (`draft`), ready for the first message — the
  // navigator's New chat, with something already said.
  const startChatWith = props.startChat && current && ((request) => {
    const carried = carryPlace({ ...request, compose: true, run: current.runId });
    props.startChat();
    setTimeout(() => deliverCarried(carried), 1500);
  });

  const body = () => {
    if (runs.phase === "loading") return h(Message, null, "Reading the workspace…");
    if (runs.value.error) return h(Message, { error: true }, runs.value.error);
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
    return h(Inspector, {
      runId: current.runId,
      sessionId: props.sessionId,
      revision: everything,
      mention: mentionAndShow,
      openPlace: openPlace,
      key: current.runId,
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
        // The course's places, over the conversation: the way in when the
        // course navigator is not in the sidebar. Beside Publish because,
        // like it, it is about the run rather than about this column.
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
              "Open course",
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
    ),
    // Marks a grade-sheet sync brought in since this browser last looked,
    // whoever ran it. Above the inspector, since a sync is news wherever one is.
    current
      ? h(SheetNotice, {
          runId: current.runId,
          sessionId: props.sessionId,
          revision: marksVersion,
          key: "notice|" + current.runId,
          onOpen: () => openPlace({ view: "gradebook" }),
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
          request: placeRequest,
          sessionId: props.sessionId,
          dark: dark,
          drafts: drafts,
          setDrafts: setDrafts,
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
          // A press beside an item on the weeks names it in the chat's
          // composer and brings the chat in beside the place.
          mention: mentionAndShow,
          startChat: startChatWith,
          chatTitle: props.chatTitle,
          chatState: props.chatState,
          openPublish: openPublish,
          // Each view inside names what its own writes changed.
          wrote: write,
          // For Course settings: Preferences is per course and term, and
          // Integrations scrolls to the card a jump named.
          courseId: current.courseId,
          term: current.term,
          integrationsFocus: integrationsFocus,
          chat: chatBeside,
          setChat: setChatBeside,
          compose: Boolean(placeRequest && placeRequest.compose),
          draft: placeRequest && placeRequest.draft ? { text: placeRequest.draft, n: placeRequest.n } : null,
          onClose: () => {
            setCourseMode(false);
            setPlaceRequest(null);
            setChatBeside(false);
          },
        })
      : null,
    desk && current
      ? h(DefenceDesk, {
          runId: current.runId,
          sessionId: props.sessionId,
          assessment: desk.assessment,
          student: desk.student,
          ask: props.ask,
          reload: deskVersion,
          preparing: Boolean(desk.preparing),
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
          revision: gradeVersion,
          ask: props.ask,
          onWrite: () => write(["grading"]),
          onClose: () => setGrading(null),
        })
      : null,
    scansPile && current
      ? h(ScansModal, {
          runId: current.runId,
          sessionId: props.sessionId,
          pile: scansPile,
          step: scansStep,
          // Opened at Match from Held papers: the held lane first.
          lane: scansStep === "match" ? "held" : null,
          names: names,
          revision: scansVersion,
          ask: props.ask,
          onWrite: () => write(["scans", "files"]),
          onClose: () => {
            setScansPile(null);
            setScansStep(null);
          },
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
          // Pressed on an assessment's row: which one the papers are.
          assessment: uploading === true ? null : uploading,
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
          // the mention lands in the composer, so the chat comes in beside
          // the place, as for an `ask` from the page.
          mention: mentionAndShow,
          onClose: () => setMaterial(null),
        }),
  );
}

// --------------------------------------------------------------- plugin

/**
 * `layout` for the open/close verbs, `slots` for the two seats, `sessions`
 * to resolve the session a widget's question should be asked in.
 */
export const inject = ["slots", "layout", "sessions", "conversation", "workspaces"];

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
