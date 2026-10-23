/**
 * Course mode · Sync: bringing the run and the services outside it into step,
 * as an operation rather than a setting. BACKLOG E37 HOME-6 and HOME-7;
 * docs/PROFESSOR-JOURNEY.md §8.
 *
 * Sync all is on top: one preview of every road it moves — Canvas and each
 * grade sheet — grouped by which way data runs, then one Send. Under it is
 * what Sync all leaves for the professor, one at a time: Canvas's conflicts
 * and the changes Canvas made (`CanvasDifferences`), each grade sheet with its
 * own Preview and Run (`SyncCard`), and the names a sheet could not place
 * (`WaitingList`). Those three are the components the Integrations cards drew;
 * they moved here, so their rules are the same code.
 *
 * Course settings keeps what is set up twice a term: the address, the token,
 * which course, which sheet, the Google sign-in.
 */

import { CanvasRead } from "./canvas-card.js";
import { CanvasDifferences } from "./canvas-diff.js";
import { Message, useJson } from "./common.js";
import { useSheetCheck } from "./marks.js";
import { h, React } from "./react.js";
import { SyncCard, WaitingList, when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

const plural = (count, one, many) => count + " " + (count === 1 ? one : many || one + "s");

const post = (path, runId, sessionId, body) =>
  fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId || ""), sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String((error && error.message) || error) }));

/** One line per assessment: "HW4: 12", from rows that carry a title. */
const byAssessment = (rows) => {
  const counts = new Map();
  for (const entry of rows) {
    const title = entry.title || entry.assessment_id;
    counts.set(title, (counts.get(title) || 0) + 1);
  }
  return [...counts].map(([title, n]) => title + ": " + n).join(" · ");
};

/** A sheet's plan in one sentence. */
const sheetLine = (sheet) =>
  sheet.moves
    ? [
        sheet.added ? plural(sheet.added, "mark") + " added" : null,
        sheet.changed ? plural(sheet.changed, "mark") + " changed" : null,
        sheet.removed ? plural(sheet.removed, "mark") + " taken back" : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "nothing new";

/** The preview Sync all shows, and its one Send. */
function SyncAllPreview(props) {
  const preview = props.preview;
  const canvas = preview.canvas && !preview.canvas.error ? preview.canvas : null;
  const send = canvas ? canvas.send : [];
  const take = canvas ? canvas.take : [];
  const absent = canvas ? canvas.absent || [] : [];
  const held = canvas ? canvas.held : [];
  const marks = send.filter((entry) => entry.kind === "grades");
  const fields = send.filter((entry) => entry.kind === "assignments");
  const sheets = preview.sheets.filter((sheet) => sheet.ok);
  const moving = sheets.filter((sheet) => sheet.moves > 0);
  const failed = preview.sheets.filter((sheet) => !sheet.ok);
  const sheetHeld = sheets.reduce((sum, sheet) => sum + (sheet.held || 0), 0);
  const nothing = !send.length && !take.length && !absent.length && !moving.length;

  const go = () =>
    props.onSend({
      canvas: send.concat(take).map((entry) => entry.key),
      sheets: moving.map((sheet) => sheet.id),
      from: Object.fromEntries(moving.filter((sheet) => sheet.from).map((sheet) => [sheet.id, sheet.from])),
    });

  const label = [
    send.length ? "send " + send.length + " to Canvas" : null,
    take.length || absent.length ? "update the class list" : null,
    moving.length ? "bring in " + plural(moving.length, "sheet") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return h(
    "div",
    { className: "pp-syncallx" },
    h("span", { className: "pp-as" }, "Asked " + when(preview.previewedAt) + ". Nothing has been sent or saved yet."),
    // What comes in: changes the run's own records; nobody outside sees it.
    h(
      "div",
      { className: "pp-sxgroup" },
      h("b", null, "Comes in"),
      h(
        "ul",
        null,
        take.length ? h("li", null, "Class list: " + plural(take.length, "student") + " Canvas has and this run does not") : null,
        absent.length ? h("li", null, "Class list: " + plural(absent.length, "student") + " no longer in Canvas — noted, nobody dropped") : null,
        sheets.map((sheet) =>
          h(
            "li",
            { key: sheet.id },
            "Grade sheet " + sheet.id + ": " + sheetLine(sheet),
            sheet.from === "export" ? h("span", { className: "pp-as" }, " (from the downloaded copy)") : null,
          ),
        ),
        !take.length && !absent.length && !sheets.length ? h("li", { className: "pp-as" }, "nothing") : null,
      ),
    ),
    // What goes out: students see it.
    h(
      "div",
      { className: "pp-sxgroup" + (send.length ? " pp-sxout" : "") },
      h("b", null, "Goes out — students see it"),
      h(
        "ul",
        null,
        marks.length ? h("li", null, "Canvas marks: " + marks.length + " (" + byAssessment(marks) + ")") : null,
        fields.length ? h("li", null, "Canvas definitions: " + plural(fields.length, "field") + " (" + byAssessment(fields) + ")") : null,
        !send.length ? h("li", { className: "pp-as" }, "nothing") : null,
      ),
    ),
    held.length || sheetHeld || failed.length || (preview.canvas && preview.canvas.error)
      ? h(
          "div",
          { className: "pp-sxgroup" },
          h("b", null, "Left for you"),
          h(
            "ul",
            null,
            held.length ? h("li", null, plural(held.length, "Canvas difference") + " — conflicts and what Canvas changed; settle them below") : null,
            sheetHeld ? h("li", null, plural(sheetHeld, "sheet row") + " the sync was not sure of; confirm them below") : null,
            preview.canvas && preview.canvas.error ? h("li", { className: "pp-saveerr" }, "Canvas: " + preview.canvas.error) : null,
            failed.map((sheet) =>
              h("li", { key: sheet.id, className: "pp-saveerr" }, "Grade sheet " + sheet.id + ": " + sheet.error),
            ),
          ),
        )
      : null,
    preview.elsewhere.length
      ? h(
          "p",
          { className: "pp-as" },
          "Not in Sync all: " + preview.elsewhere.map((road) => road.why).filter((why, i, all) => all.indexOf(why) === i).join(" "),
        )
      : null,
    h(
      "div",
      { className: "pp-dacts" },
      nothing
        ? h("span", { className: "pp-as" }, "Everything Sync all moves is already in step.")
        : h(
            "button",
            { type: "button", className: "pp-segbtn pp-danger", disabled: props.sending, onClick: go },
            props.sending ? "Syncing…" : "Sync: " + label,
          ),
      h("button", { type: "button", className: "pp-segbtn", disabled: props.sending, onClick: props.onClose }, nothing ? "Close" : "Cancel"),
    ),
  );
}

/** Course mode · Sync. */
export function SyncView(props) {
  const [tick, setTick] = React.useState(0);
  const revision = String(props.revision || 0) + "." + tick;
  const syncs = useJson(
    scoped(
      BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(revision),
      props.sessionId,
    ),
  );
  const checks = useSheetCheck(props.runId, props.sessionId, revision);
  const kept = React.useRef(null);
  if (syncs.phase === "ready" && syncs.value && !syncs.value.error) kept.current = syncs.value;
  const [phase, setPhase] = React.useState("idle");
  const [preview, setPreview] = React.useState(null);
  const [results, setResults] = React.useState(null);

  const done = (tags) => {
    setTick((value) => value + 1);
    if (props.onWrite) props.onWrite(tags);
  };
  const ask = () => {
    setPhase("asking");
    setResults(null);
    post("/api/sync-all", props.runId, props.sessionId, { confirm: false, names: Boolean(props.names) }).then((body) => {
      setPhase("idle");
      setPreview(body);
      // A sheet plan keeps the rows it could not place for review.
      done(["syncs"]);
    });
  };
  const send = (chosen) => {
    setPhase("sending");
    post("/api/sync-all", props.runId, props.sessionId, Object.assign({ confirm: true, names: Boolean(props.names) }, chosen)).then((body) => {
      setPhase("idle");
      setPreview(null);
      setResults(body);
      done(["syncs", "marks", "integrations", "canvas", "records"]);
    });
  };

  const doc = kept.current;
  if (syncs.phase === "ready" && syncs.value && syncs.value.error && !doc) return h(Message, { error: true }, syncs.value.error);
  if (!doc) return h(Message, null, "Reading this run's roads…");

  const canvasOn = doc.syncs.some((sync) => sync.service === "canvas" && sync.enabled);
  const roster = doc.syncs.find((sync) => sync.service === "canvas" && sync.stream === "roster" && sync.enabled) || null;
  const sheets = doc.syncs.filter((sync) => sync.service === "sheets" && sync.stream === "marks" && sync.enabled);
  const sheetIds = new Set(sheets.map((sync) => sync.id));
  const waiting = doc.waiting.filter((row) => sheetIds.has(row.sync));
  const checkOf = (sync) => (checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) : null);

  return h(
    "div",
    { className: "pp-syncview" },
    h(
      "section",
      { className: "pp-ccard" },
      h(
        "div",
        { className: "pp-chead" },
        h(
          "span",
          { className: "pp-cname" },
          "Sync all",
          h(
            "span",
            { className: "pp-intwhat" },
            [canvasOn ? "Canvas" : null, sheets.length ? plural(sheets.length, "grade sheet") : null].filter(Boolean).join(" and ") ||
              "No road here moves with Sync all",
          ),
        ),
        h("span", { className: "pp-segspacer" }),
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: phase !== "idle" || Boolean(preview) || (!canvasOn && !sheets.length),
            title: "Ask Canvas and every grade sheet what would move. Nothing is sent until you press Sync.",
            onClick: ask,
          },
          phase === "asking" ? "Asking Canvas and the sheets…" : "Preview all…",
        ),
      ),
      preview && preview.error ? h("p", { className: "pp-saveerr" }, preview.error) : null,
      preview && !preview.error
        ? h(SyncAllPreview, { preview, sending: phase === "sending", onSend: send, onClose: () => setPreview(null) })
        : null,
      results
        ? h(
            "div",
            { className: "pp-syncallx" },
            results.error
              ? h("pre", { className: "pp-approveout pp-approveerr" }, results.error)
              : results.results.map((entry, index) =>
                  h(
                    "pre",
                    { className: "pp-approveout" + (entry.ok ? "" : " pp-approveerr"), key: index },
                    (entry.ok ? "✓ " : "✗ ") + (entry.command || entry.road) + "\n" + entry.output,
                  ),
                ),
            h("div", { className: "pp-dacts" }, h("button", { type: "button", className: "pp-segbtn", onClick: () => setResults(null) }, "Close")),
          )
        : null,
    ),
    canvasOn
      ? h(
          "section",
          { className: "pp-ccard" },
          h("div", { className: "pp-chead" }, h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"), h("span", { className: "pp-cname" }, "Canvas")),
          h(CanvasDifferences, {
            runId: props.runId,
            sessionId: props.sessionId,
            names: props.names,
            noSyncAll: true,
            onWrite: () => done(["canvas", "marks"]),
          }),
          // The class list alone, for a professor who wants only that.
          roster
            ? h(CanvasRead, {
                sync: roster,
                label: "Class list",
                runId: props.runId,
                sessionId: props.sessionId,
                names: props.names,
                onWrite: () => done(["syncs", "records"]),
              })
            : null,
        )
      : null,
    sheets.map((sync) =>
      h(
        "section",
        { className: "pp-ccard", key: sync.id },
        h(
          "div",
          { className: "pp-chead" },
          h("span", { className: "pp-svc pp-svc-sheets", "aria-hidden": "true" }, "GS"),
          h("span", { className: "pp-cname" }, sync.label, h("span", { className: "pp-intwhat" }, sync.id)),
        ),
        h(SyncCard, { sync, bare: true, check: checkOf(sync), runId: props.runId, sessionId: props.sessionId, names: props.names, onDone: () => done(["syncs", "marks"]) }),
      ),
    ),
    waiting.length
      ? h(
          "section",
          { className: "pp-ccard" },
          h("div", { className: "pp-chead" }, h("span", { className: "pp-cname" }, "Names to confirm", h("span", { className: "pp-intwhat" }, "rows a sheet could not place surely"))),
          h(WaitingList, {
            rows: waiting,
            students: doc.students,
            names: doc.names,
            runId: props.runId,
            sessionId: props.sessionId,
            onDone: () => done(["syncs", "marks"]),
          }),
        )
      : null,
    h(
      "p",
      { className: "pp-as" },
      "Addresses, tokens, which course and which sheet are in Course settings. ",
      props.onOpenSettings ? h("button", { type: "button", className: "pp-linkbtn", onClick: props.onOpenSettings }, "Open Course settings") : null,
    ),
  );
}
