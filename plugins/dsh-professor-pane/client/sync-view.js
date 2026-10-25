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

/** "HW2 - A grant office that answers in JSON" reads as "HW2"; a title with no short head stays whole. */
const shortTitle = (title) => {
  const head = String(title).split(/\s+[-–—:]\s+/)[0];
  return head.length <= 16 ? head : String(title);
};

/** Rows grouped by assessment, in the order the course names them: HW1 before HW2, Quiz 1 before Quiz 2. */
const byAssessment = (rows) => {
  const groups = new Map();
  for (const entry of rows) {
    const title = entry.title || entry.assessment_id || (entry.kind === "roster" ? "Class list" : "Other");
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(entry);
  }
  return [...groups]
    .map(([title, entries]) => ({ title, short: shortTitle(title), entries }))
    .sort((a, b) => a.short.localeCompare(b.short, undefined, { numeric: true }));
};

/** One assessment's line in the preview: "HW2 — 22 students (5 new in Canvas, 17 replace Canvas's mark)". */
const assessmentLine = (group, noun) => {
  const fresh = group.entries.filter((entry) => entry.theirs === null || entry.theirs === "").length;
  const replace = group.entries.length - fresh;
  const split = fresh && replace ? " (" + fresh + " new in Canvas, " + replace + " replace what Canvas shows)" : replace ? " (each replaces what Canvas shows)" : "";
  return h("li", { key: group.title, title: group.title }, h("b", null, group.short), " — " + plural(group.entries.length, noun) + split);
};

/** Why Sync all left a Canvas difference, in the professor's words; one line per kind. */
const HELD_WHY = {
  conflict: "changed on both sides — you choose which to keep",
  pull: "changed in Canvas since the last sync — Sync all does not copy Canvas's changes over yours",
  held: "with nothing ready here to send yet (not accepted, or taken back)",
};

/** How many students an assessment shows before "Show N more", as on Canvas · what differs. */
const ROWS_AT_FIRST = 12;

/** Under this many, everything Sync all left opens at once; past it, the professor opens what they want to see. */
const OPEN_UNDER = 15;

/** Who one held row is about: the student's name when names are on, the definition's field, or the class-list entry. */
const heldWho = (entry) =>
  entry.kind === "assignments" ? "Setting: " + String(entry.field || "").replace(/_/g, " ") : entry.name || entry.student_id || entry.theirs || "—";

/** A value as the row shows it: a Canvas date in the reader's own time. */
const heldValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(text) && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return text;
};

/** One assessment's held rows: a student per line with both values and why, the first dozen and then "Show N more". */
function HeldGroup(props) {
  const [all, setAll] = React.useState(false);
  const rows = all ? props.group.entries : props.group.entries.slice(0, ROWS_AT_FIRST);
  const more = props.group.entries.length - rows.length;
  return h(
    "details",
    { className: "pp-sxheld", open: props.open },
    h("summary", { title: props.group.title }, h("b", null, props.group.short), " — " + plural(props.group.entries.length, props.noun)),
    rows.map((entry) =>
      h(
        "div",
        { className: "pp-drow", key: entry.key },
        h(
          "div",
          { className: "pp-drowline" },
          h("span", { className: "pp-drowwho" }, heldWho(entry)),
          entry.kind === "roster" ? null : h("span", { className: "pp-dvals" }, "here " + heldValue(entry.ours) + " · Canvas " + heldValue(entry.theirs)),
        ),
        entry.reason ? h("span", { className: "pp-dwhy" }, entry.reason) : null,
      ),
    ),
    more ? h("button", { type: "button", className: "pp-linkbtn", onClick: () => setAll(true) }, "Show " + more + " more") : null,
  );
}

/** One reason Sync all left rows behind, opening into the assessments and the students under it. */
function HeldKind(props) {
  const noun = props.entries.every((entry) => entry.kind === "grades") ? "mark" : "item";
  const groups = byAssessment(props.entries);
  return h(
    "details",
    { className: "pp-sxheld", open: props.open },
    h(
      "summary",
      null,
      h("b", null, plural(props.entries.length, noun)),
      " " + HELD_WHY[props.direction],
      h("span", { className: "pp-as" }, " · " + groups.map((group) => group.short + " " + group.entries.length).join(", ")),
    ),
    h(
      "div",
      { className: "pp-sxheldbody" },
      groups.map((group) =>
        h(HeldGroup, { key: group.title, group, noun: group.entries.every((entry) => entry.student_id) ? "student" : "item", open: props.open || groups.length === 1 }),
      ),
    ),
  );
}

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

/** "141 marks", "3 settings", or "141 marks and 3 settings". */
const sendNoun = (send) => {
  const marks = send.filter((entry) => entry.kind === "grades").length;
  const fields = send.length - marks;
  return [marks ? plural(marks, "mark") : null, fields ? plural(fields, "setting") : null].filter(Boolean).join(" and ");
};

const sendAllLabel = (preview) => {
  const parts = partsOf(preview);
  return (
    "Sync: " +
    [
      parts.send.length ? "send " + sendNoun(parts.send) + " to Canvas" : null,
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
  // The class-list notes are already under "Comes in"; the rest are the professor's.
  const left = held.filter((entry) => !absent.includes(entry));
  const leftBy = ["conflict", "pull", "held"].map((direction) => ({ direction, entries: left.filter((entry) => entry.direction === direction) }));

  return h(
    React.Fragment,
    null,
    h("span", { className: "pp-as" }, "Checked " + when(preview.previewedAt) + ". Nothing has been sent or saved yet — this is what the button below would do."),
    // What comes in: changes the run's own records; nobody outside sees it.
    h(
      "div",
      { className: "pp-sxgroup" },
      h("div", null, h("b", null, "Into your records"), h("span", { className: "pp-as" }, " — only you see these")),
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
      h("div", null, h("b", null, send.length ? "To Canvas: " + sendNoun(send) : "To Canvas"), h("span", { className: "pp-as" }, " — students will see these")),
      h(
        "ul",
        null,
        byAssessment(marks).map((group) => assessmentLine(group, "student")),
        fields.length
          ? h("li", null, "Assessment settings (title, due date, points…): ", byAssessment(fields).map((group) => group.short + " " + plural(group.entries.length, "field")).join(", "))
          : null,
        !send.length ? h("li", { className: "pp-as" }, "nothing") : null,
      ),
    ),
    left.length || sheetHeld || failed.length || canvasError
      ? h(
          "div",
          { className: "pp-sxgroup" },
          h("div", null, h("b", null, "Not included — needs your decision"), left.length ? h("span", { className: "pp-as" }, " — open a line to see whose") : null),
          leftBy.map((kind) =>
            kind.entries.length ? h(HeldKind, { key: kind.direction, direction: kind.direction, entries: kind.entries, open: left.length < OPEN_UNDER }) : null,
          ),
          h(
            "ul",
            null,
            left.length ? h("li", { className: "pp-as" }, "Settle each one under “Canvas · what differs” below, with Keep AINAR or Keep Canvas.") : null,
            sheetHeld ? h("li", null, plural(sheetHeld, "grade-sheet row") + " could not be matched to a student for sure; confirm them under “Names to confirm” below") : null,
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
          "Sync all does not do these: " + preview.elsewhere.map((road) => road.why).filter((why, i, all) => all.indexOf(why) === i).join(" "),
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
