/**
 * Uploading: the kinds a file can be, and the single and batch upload dialogs.
 */

import { h, React, ReactDOM } from "./react.js";
import { BASE, scoped } from "./tabs.js";

// --------------------------------------------------------------- upload

/**
 * The two things a professor uploads, and what each is for.
 *
 * Kept to two on purpose. The harness's own attachment path takes images
 * and gives the model no file it can run a command on, so these are the
 * files that otherwise have no way in: the scanned pile, and the paper and
 * key it was sat against. Each lands in the private submissions folder
 * where the skill that reads it already looks — see `lib/upload.js`.
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
export function BatchModal(props) {
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

export function UploadModal(props) {
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
                className: "pp-segbtn",
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
