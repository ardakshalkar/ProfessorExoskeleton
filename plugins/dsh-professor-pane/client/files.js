/**
 * Files: the run's scanned papers and recorded answers — where they are
 * stored, how much there is, and a way into each pile. Course mode's view of
 * what `server/files.js` reads off the disk.
 */

import { Message } from "./common.js";
import { TitleWithTag } from "./marks.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/** 1536 → "1.5 KB", 0 → "—". */
const size = (bytes) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return (value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10) + " " + units[unit];
};

/** 754 → "12 min", 40 → "1 min", 0 → "—". */
const minutes = (seconds) => (seconds ? Math.max(1, Math.round(seconds / 60)) + " min" : "—");

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

const WHOSE_MOVE = { you: "Your move", assistant: "Assistant", done: "Done" };

/**
 * How far a pile has got through recognition and grading — the Scans window's
 * seven steps as its bar, the step it is on, what is left in a few words and
 * whose move it is. Every step's detail is a hover away.
 */
function PileProgress(props) {
  const standing = props.standing;
  if (!standing || !standing.now) return h("span", { className: "pp-as" }, "not set up as a pile");
  const now = standing.now;
  const stages = standing.stages || [];
  const tip = stages
    .map((stage, i) => (stage.state === "done" ? "✓ " : i === now.index ? "→ " : "   ") + stage.label + " — " + stage.detail)
    .join("\n");
  const at = now.index < now.total ? (stages[now.index] || {}).label : null;
  return h(
    "span",
    { className: "pp-pileprog", title: tip },
    h(
      "span",
      { className: "pp-pilebar", "aria-hidden": "true" },
      (standing.progress || []).map((state, i) => h("i", { key: i, className: state === "done" ? "pp-s-done" : i === now.index ? "pp-s-now" : "" })),
    ),
    h(
      "span",
      { className: "pp-pileprogtext" },
      h("span", { className: "pp-pileprogstep" }, at ? "Step " + (now.index + 1) + " of " + now.total + " · " + at : "All steps done"),
      h("span", { className: "pp-as" }, now.phrase),
    ),
    h("span", { className: "pp-whose pp-whose-" + now.whose }, WHOSE_MOVE[now.whose] || now.whose),
  );
}

/** `/api/files` for one run, re-read whenever the course is written. */
function useFiles(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/files?run=" + encodeURIComponent(runId || "") + "&r=" + revision, sessionId), {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision]);
  return state;
}

/**
 * Course mode · Files. Scans and audio are private and never in the course
 * folder; this says where they are, totals them, lists them per assessment,
 * and opens each pile in the Scans window, the batch in the recordings dialog,
 * or the folder itself in the file manager.
 */
export function Files(props) {
  const state = useFiles(props.runId, props.sessionId, props.revision);
  const [revealed, setRevealed] = React.useState(null);
  if (state.phase === "loading") return h(Message, null, "Reading what is stored…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);

  const reveal = (assessment) => {
    setRevealed({ busy: true });
    fetch(
      scoped(
        BASE + "/api/files/reveal?run=" + encodeURIComponent(props.runId || "") + (assessment ? "&assessment=" + encodeURIComponent(assessment) : ""),
        props.sessionId,
      ),
      { method: "POST", headers: { accept: "application/json" } },
    )
      .then((response) => response.json())
      .then((answer) => setRevealed(answer.error ? { error: answer.error } : { ok: true }))
      .catch((error) => setRevealed({ error: String(error) }));
  };

  const scans = doc.assessments.filter((entry) => entry.scans.uploaded || entry.scans.papers);
  const audio = doc.assessments.filter((entry) => entry.audio.takes);
  const nothing = !scans.length && !audio.length && !doc.unfiled.count && !doc.recordings.count;
  const folderButton = (assessment) =>
    h("button", { type: "button", className: "pp-segbtn", title: "Open this folder in the file manager", onClick: () => reveal(assessment) }, "Folder");

  return h(
    "div",
    { className: "pp-files" },
    // Where: the one fact a professor asking "where are my scans" wants first.
    h(
      "div",
      { className: "pp-fileswhere" },
      h(
        "div",
        { className: "pp-fileswheretext" },
        h("b", null, "Stored on this computer, outside the course folder"),
        h("code", { title: doc.folder }, doc.folder),
        h("span", { className: "pp-as" }, "Scans and recordings carry students' names and voices, so they never go into the course folder or git."),
      ),
      h(
        "div",
        { className: "pp-approverow" },
        doc.exists
          ? h("button", { type: "button", className: "pp-segbtn", "aria-busy": revealed && revealed.busy ? "true" : undefined, onClick: () => reveal("") }, "Open folder")
          : null,
        props.onUpload ? h("button", { type: "button", className: "pp-primary", onClick: props.onUpload }, "Upload…") : null,
      ),
    ),
    revealed && revealed.error ? h("p", { className: "pp-behind" }, revealed.error) : null,

    nothing
      ? h(Message, null, "Nothing is stored for this run yet. Scanned papers and recorded answers you upload will be listed here.")
      : h(
          React.Fragment,
          null,
          // Totals, as tiles.
          h(
            "div",
            { className: "pp-filetiles" },
            h(
              "div",
              { className: "pp-filetile" },
              h("span", { className: "pp-filetilehead" }, "Scans"),
              h("b", null, plural(doc.totals.scans.files, "PDF", "PDFs")),
              h("span", { className: "pp-as" }, size(doc.totals.scans.bytes)),
            ),
            h(
              "div",
              { className: "pp-filetile" },
              h("span", { className: "pp-filetilehead" }, "Audio"),
              h("b", null, doc.totals.audio.takes ? plural(doc.totals.audio.takes, "recording", "recordings") : "None yet"),
              h(
                "span",
                { className: "pp-as" },
                doc.totals.audio.takes
                  ? minutes(doc.totals.audio.seconds) + " · " + size(doc.totals.audio.bytes)
                  : "recorded answers and defences land here",
              ),
            ),
            doc.unfiled.count || doc.recordings.count
              ? h(
                  "div",
                  { className: "pp-filetile pp-filetile-wait" },
                  h("span", { className: "pp-filetilehead" }, "Waiting to be filed"),
                  h(
                    "b",
                    null,
                    [doc.unfiled.count ? plural(doc.unfiled.count, "scan", "scans") : null, doc.recordings.count ? plural(doc.recordings.count, "recording", "recordings") : null]
                      .filter(Boolean)
                      .join(" · "),
                  ),
                  h("span", { className: "pp-as" }, "uploaded, not yet given to an assessment or a student"),
                )
              : null,
          ),

          // Scans, per assessment pile.
          scans.length || doc.unfiled.count
            ? h(
                "section",
                { className: "pp-filesection" },
                h("h3", null, "Scans"),
                h(
                  "table",
                  { className: "pp-plantable pp-filetable" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", null, "Assessment"),
                      h("th", null, "Progress"),
                      h("th", { className: "pp-num" }, "Uploaded"),
                      h("th", { className: "pp-num" }, "Papers filed"),
                      h("th", { className: "pp-num" }, "Size"),
                      h("th", null, ""),
                    ),
                  ),
                  h(
                    "tbody",
                    null,
                    doc.unfiled.count
                      ? h(
                          "tr",
                          { key: "_unfiled", className: "pp-filewait" },
                          h("td", null, h("b", null, "Not yet filed to an assessment")),
                          h("td", null, h("span", { className: "pp-as" }, "waiting to be given to an assessment")),
                          h("td", { className: "pp-num" }, String(doc.unfiled.count)),
                          h("td", { className: "pp-num" }, "—"),
                          h("td", { className: "pp-num" }, size(doc.unfiled.bytes)),
                          h("td", { className: "pp-fileacts" }, props.onUpload ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onUpload }, "File them…") : null),
                        )
                      : null,
                    scans.map((entry) =>
                      h(
                        "tr",
                        { key: entry.id },
                        h("td", null, h(TitleWithTag, { title: entry.title })),
                        h("td", null, h(PileProgress, { standing: entry.scans.standing })),
                        h("td", { className: "pp-num" }, String(entry.scans.uploaded)),
                        h("td", { className: "pp-num" }, String(entry.scans.papers)),
                        h("td", { className: "pp-num" }, size(entry.scans.bytes)),
                        h(
                          "td",
                          { className: "pp-fileacts" },
                          entry.scans.pile && entry.known && props.onOpenScans
                            ? h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpenScans(entry.id) }, "Open pile")
                            : null,
                          folderButton(entry.id),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : null,

          // Audio: recorded answers per assessment, and the uploaded batch.
          audio.length || doc.recordings.count
            ? h(
                "section",
                { className: "pp-filesection" },
                h("h3", null, "Audio"),
                h(
                  "table",
                  { className: "pp-plantable pp-filetable" },
                  h(
                    "thead",
                    null,
                    h("tr", null, h("th", null, "Assessment"), h("th", { className: "pp-num" }, "Students"), h("th", { className: "pp-num" }, "Recordings"), h("th", { className: "pp-num" }, "Length"), h("th", { className: "pp-num" }, "Size"), h("th", null, "")),
                  ),
                  h(
                    "tbody",
                    null,
                    doc.recordings.count
                      ? h(
                          "tr",
                          { key: "_batch", className: "pp-filewait" },
                          h(
                            "td",
                            null,
                            h("b", null, "Uploaded in a batch"),
                            h(
                              "span",
                              { className: "pp-as" },
                              " · " + (doc.recordings.planned ? doc.recordings.matched + " of " + doc.recordings.planned + " matched to a student" : "not matched yet"),
                            ),
                          ),
                          h("td", { className: "pp-num" }, "—"),
                          h("td", { className: "pp-num" }, String(doc.recordings.count)),
                          h("td", { className: "pp-num" }, "—"),
                          h("td", { className: "pp-num" }, size(doc.recordings.bytes)),
                          h("td", { className: "pp-fileacts" }, props.onRecordings ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onRecordings }, "Open recordings…") : null),
                        )
                      : null,
                    audio.map((entry) =>
                      h(
                        "tr",
                        { key: entry.id },
                        h("td", null, h(TitleWithTag, { title: entry.title })),
                        h("td", { className: "pp-num" }, String(entry.audio.students)),
                        h("td", { className: "pp-num" }, String(entry.audio.takes)),
                        h("td", { className: "pp-num" }, minutes(entry.audio.seconds)),
                        h("td", { className: "pp-num" }, size(entry.audio.bytes)),
                        h("td", { className: "pp-fileacts" }, folderButton(entry.id)),
                      ),
                    ),
                  ),
                ),
              )
            : null,

          doc.papers.count
            ? h(
                "p",
                { className: "pp-as" },
                "Also stored: " + plural(doc.papers.count, "question paper or answer key", "question papers and answer keys") + " (" + size(doc.papers.bytes) + ").",
              )
            : null,
        ),
  );
}
