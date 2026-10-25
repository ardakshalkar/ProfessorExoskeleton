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
import { MarksForCanvas, PublishedChanges, useSheetCheck } from "./marks.js";
import { h, React } from "./react.js";
import { RoadFlow, roadIn } from "./road-flow.js";
import { SyncCard, WaitingList, sheetLine, when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

const plural = (count, one, many) => count + " " + (count === 1 ? one : many || one + "s");

/** One line per assessment: "HW4: 12", from rows that carry a title. */
const byAssessment = (rows) => {
  const counts = new Map();
  for (const entry of rows) {
    const title = entry.title || entry.assessment_id;
    counts.set(title, (counts.get(title) || 0) + 1);
  }
  return [...counts].map(([title, n]) => title + ": " + n).join(" · ");
};

/** Sync all's preview, split by road: Canvas's, the sheets that read, and what failed. */
const partsOf = (preview) => {
  const canvasRoad = roadIn(preview, "canvas");
  const canvas = canvasRoad && canvasRoad.ok ? canvasRoad.preview : null;
  const sheetRoads = preview.roads.filter((road) => road.service === "sheets");
  const sheets = sheetRoads.filter((road) => road.ok).map((road) => Object.assign({ id: road.id }, road.preview));
  return {
    canvasError: canvasRoad && !canvasRoad.ok ? canvasRoad.error : null,
    send: canvas ? canvas.send : [],
    take: canvas ? canvas.take : [],
    absent: canvas ? canvas.absent || [] : [],
    held: canvas ? canvas.held : [],
    sheets,
    moving: sheets.filter((sheet) => sheet.moves > 0),
    failed: sheetRoads.filter((road) => !road.ok),
  };
};

/** What Sync all's Send sends: Canvas's previewed rows (and its class-list notes), and each sheet that would bring marks in. */
const chooseAll = (preview) => {
  const parts = partsOf(preview);
  const keys = {};
  if (parts.send.length || parts.take.length || parts.absent.length) keys.canvas = parts.send.concat(parts.take).map((entry) => entry.key);
  for (const sheet of parts.moving) keys[sheet.id] = [sheet.id];
  return Object.keys(keys).length ? keys : null;
};

const sendAllLabel = (preview) => {
  const parts = partsOf(preview);
  return (
    "Sync: " +
    [
      parts.send.length ? "send " + parts.send.length + " to Canvas" : null,
      parts.take.length || parts.absent.length ? "update the class list" : null,
      parts.moving.length ? "bring in " + plural(parts.moving.length, "sheet") : null,
    ]
      .filter(Boolean)
      .join(", ")
  );
};

/** The preview Sync all shows above its one Send. */
function SyncAllPreview(props) {
  const preview = props.preview;
  const { send, take, absent, held, sheets, failed, canvasError } = partsOf(preview);
  const marks = send.filter((entry) => entry.kind === "grades");
  const fields = send.filter((entry) => entry.kind === "assignments");
  const sheetHeld = sheets.reduce((sum, sheet) => sum + (sheet.held || 0), 0);

  return h(
    React.Fragment,
    null,
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
    held.length || sheetHeld || failed.length || canvasError
      ? h(
          "div",
          { className: "pp-sxgroup" },
          h("b", null, "Left for you"),
          h(
            "ul",
            null,
            held.length ? h("li", null, plural(held.length, "Canvas difference") + " — conflicts and what Canvas changed; settle them below") : null,
            sheetHeld ? h("li", null, plural(sheetHeld, "sheet row") + " the sync was not sure of; confirm them below") : null,
            canvasError ? h("li", { className: "pp-saveerr" }, "Canvas: " + canvasError) : null,
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
  );
}

/**
 * Course mode · Sync: every road out, and what has not gone down one — Sync
 * all, the marks Canvas lacks, what differs in Canvas, the grade sheets, the
 * names to confirm, and the materials changed since publishing. `focus:
 * "marks"` (a link that used to open Gradebook · To Canvas or Waiting ·
 * Unpublished) brings Marks for Canvas into view.
 */
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
  // Scrolled to once the page is drawn, and again when the same link is
  // followed twice (the focus is numbered like the request it came with).
  const marksRef = React.useRef(null);
  React.useEffect(() => {
    if (props.focus && props.focus.section === "marks" && marksRef.current) marksRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [props.focus ? props.focus.n : null, Boolean(kept.current)]);

  const done = (tags) => {
    setTick((value) => value + 1);
    if (props.onWrite) props.onWrite(tags);
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
    h(RoadFlow, {
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      roads: null,
      label: "Preview all…",
      asking: "Asking Canvas and the sheets…",
      title: "Ask Canvas and every grade sheet what would move. Nothing is sent until you press Sync.",
      disabled: !canvasOn && !sheets.length,
      describe: (preview) => h(SyncAllPreview, { preview }),
      choose: chooseAll,
      sendLabel: sendAllLabel,
      nothing: "Everything Sync all moves is already in step.",
      // A sheet plan keeps the rows it could not place for review.
      onPreviewed: () => done(["syncs"]),
      onSent: () => done(["syncs", "marks", "integrations", "canvas", "records"]),
      frame: (button, body) =>
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
            button,
          ),
          body,
        ),
    }),
    // What Canvas lacks, per assessment, with its send: one assessment at a
    // time, beside Sync all, which sends them all.
    canvasOn
      ? h(
          "section",
          { className: "pp-ccard", ref: marksRef },
          h("div", { className: "pp-chead" }, h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"), h("span", { className: "pp-cname" }, "Marks for Canvas")),
          h(MarksForCanvas, {
            runId: props.runId,
            sessionId: props.sessionId,
            revision: props.marksRevision,
            names: props.names,
            ask: props.ask,
            onWrite: () => done(["grading", "canvas", "marks"]),
          }),
        )
      : null,
    canvasOn
      ? h(
          "section",
          { className: "pp-ccard" },
          h("div", { className: "pp-chead" }, h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"), h("span", { className: "pp-cname" }, "Canvas", h("span", { className: "pp-intwhat" }, "what differs"))),
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
    h(PublishedChanges, { runId: props.runId, sessionId: props.sessionId, revision: props.marksRevision, openPublish: props.openPublish }),
    h(
      "p",
      { className: "pp-as" },
      "Addresses, tokens, which course and which sheet are in Course settings. ",
      props.onOpenSettings ? h("button", { type: "button", className: "pp-linkbtn", onClick: props.onOpenSettings }, "Open Course settings") : null,
    ),
  );
}
