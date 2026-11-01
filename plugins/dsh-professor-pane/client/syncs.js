/**
 * The pieces a service's card on Integrations → This course draws its syncs
 * with: one sync with Preview and Run beside it, and the rows waiting for a
 * person. There used to be a Syncs view listing every sync of every service;
 * since 2026-10-13 each sync sits on its service's card instead.
 *
 * Every press is `ainar sync …` on the host half (server/syncs.js), and the
 * CLI's own words are shown under the card that asked for them.
 *
 * Preview, then send. A sync that changes what other people see — Canvas, a
 * sheet written back into — has no send button until a preview of it is on
 * screen, the same two presses the marks push has.
 *
 * A waiting row is shown where it came from: which sync, which tab and line,
 * and — for a sheet — the header, the row and its neighbours as a small grid,
 * because "line 23" is a question a professor can only answer by opening the
 * sheet, and the grid answers it here.
 */

import { pressWork } from "./jobs.js";
import { h, React } from "./react.js";
import { RoadResults, roadIn, useRoad } from "./road-flow.js";
import { BASE, scoped } from "./tabs.js";
import { ReconnectGoogle } from "./integration-parts.js";

/**
 * Why a row is waiting, in two or three words for the badge. The matcher's
 * own sentence is the title, for the professor who wants all of it.
 */
const shortWhy = (why) => {
  const text = String(why || "");
  if (/close spelling/.test(text)) return "close spelling";
  if (/only one word/.test(text)) return "only one word";
  const several = /matches (\d+) enrolled/.exec(text);
  if (several) return "fits " + several[1] + " students";
  if (/not enrolled/.test(text)) return "not enrolled";
  if (/closely enough|matches no enrolled/.test(text)) return "no close match";
  if (/no name/.test(text)) return "no name";
  return text.split(/[—;:]/)[0].trim();
};

/**
 * Which way a sync runs, as an icon: an arrow into a tray (coming in), out of
 * one (going out), or two arrows passing (both ways). Outline strokes in the
 * current colour, so the badge or heading around one decides how it looks.
 */
const DIRECTION_PATHS = {
  source: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 3v12", "M8 11l4 4l4 -4"],
  target: ["M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5", "M12 15v-12", "M8 7l4 -4l4 4"],
  both: ["M7 10h14l-4 -4", "M17 14h-14l4 4"],
};

const DIRECTION_WORDS = { source: "Coming in", target: "Going out", both: "Both ways" };

function DirectionIcon(props) {
  const size = props.size || 14;
  return h(
    "svg",
    {
      className: "pp-diricon",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
    },
    (DIRECTION_PATHS[props.role] || DIRECTION_PATHS.both).map((d) => h("path", { d, key: d })),
  );
}

/** The icon on its own tint, for headings and cards. */
function DirectionBadge(props) {
  return h(
    "span",
    { className: "pp-dir pp-dir-" + props.role + (props.small ? " pp-dir-small" : ""), title: DIRECTION_WORDS[props.role] },
    h(DirectionIcon, { role: props.role, size: props.small ? 11 : 14 }),
  );
}

/** A service's mark: two letters on its own colour. */
const SERVICE = {
  canvas: { mark: "Cv", name: "Canvas" },
  sheets: { mark: "GS", name: "Google Sheets" },
  telegram: { mark: "Tg", name: "Telegram" },
  github: { mark: "GH", name: "GitHub" },
  moodle: { mark: "Md", name: "Moodle" },
  file: { mark: "F", name: "File" },
};

/** 0 → A, 25 → Z, 26 → AA: the sheet's own column letters. */
const columnLetter = (index) => {
  let letters = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }
  return letters;
};

/** "today 14:20", "yesterday 09:05", "3 days ago · 6 Oct" — and the exact time in the title. */
export const when = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const clock = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(at)) / 86400000);
  if (days <= 0) return "today " + clock;
  if (days === 1) return "yesterday " + clock;
  const date = at.toLocaleDateString([], { day: "numeric", month: "short" });
  return days < 14 ? days + " days ago · " + date : date;
};

const plural = (count, one, many) => count + " " + (count === 1 ? one : many || one + "s");

/** A sheet's plan in one sentence. */
export const sheetLine = (sheet) =>
  sheet.moves
    ? [
        sheet.added ? plural(sheet.added, "mark") + " added" : null,
        sheet.changed ? plural(sheet.changed, "mark") + " changed" : null,
        sheet.removed ? plural(sheet.removed, "mark") + " taken back" : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "nothing new";

/** How many change rows a sheet's preview lists before "Show N more". */
const CHANGES_AT_FIRST = 12;

/** A grade sheet's preview: what would come in, mark by mark, and what waits. */
function SheetPlan(props) {
  const plan = props.plan;
  const [all, setAll] = React.useState(false);
  const shown = all ? plan.changes : plan.changes.slice(0, CHANGES_AT_FIRST);
  return h(
    React.Fragment,
    null,
    h(
      "b",
      null,
      sheetLine(plan) + (plan.rows !== null ? " · " + plural(plan.rows, "row") + " read" : ""),
      plan.from === "export" ? h("span", { className: "pp-as" }, " (from the downloaded copy)") : null,
    ),
    shown.length
      ? h(
          "ul",
          null,
          shown.map((change, index) => h("li", { key: index }, (change.name || change.student) + " · " + change.title + ": " + change.said)),
        )
      : null,
    plan.changes.length > shown.length
      ? h("button", { type: "button", className: "pp-morebtn", onClick: () => setAll(true) }, "Show " + (plan.changes.length - shown.length) + " more")
      : null,
    plan.held ? h("span", { className: "pp-as" }, plural(plan.held, "row") + " the sync was not sure of wait for you under Names to confirm.") : null,
    plan.problems ? h("span", { className: "pp-as" }, plural(plan.problems, "row") + " could not be read.") : null,
  );
}

export const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("") || "?";

/** The row as it stands in the sheet: letters across, line numbers down, the waiting row lit. */
function SheetPreview(props) {
  const preview = props.preview;
  const width = Math.max(preview.header.length, ...preview.rows.map((row) => row.cells.length));
  const marks = new Set(preview.markColumns);
  const cell = (value, index, extra) =>
    h(
      "td",
      {
        key: index,
        className:
          "pp-sheetcell" +
          (index === preview.nameColumn ? " pp-sheetname" : "") +
          (marks.has(index) ? " pp-sheetmark" : "") +
          (extra || ""),
        title: value || "",
      },
      value || "",
    );
  return h(
    "div",
    { className: "pp-sheetwrap" },
    h(
      "table",
      { className: "pp-sheet" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { className: "pp-sheetcorner" }),
          Array.from({ length: width }, (_, index) => h("th", { key: index }, columnLetter(preview.firstColumn + index))),
        ),
      ),
      h(
        "tbody",
        null,
        h(
          "tr",
          { className: "pp-sheethead" },
          h("th", { className: "pp-sheetline" }, ""),
          Array.from({ length: width }, (_, index) => cell(preview.header[index], index)),
        ),
        preview.rows.map((row) =>
          h(
            "tr",
            { key: row.line, className: row.line === props.line ? "pp-sheetlit" : "" },
            h("th", { className: "pp-sheetline" }, row.line),
            Array.from({ length: width }, (_, index) => cell(row.cells[index], index)),
          ),
        ),
      ),
    ),
  );
}

/**
 * A column the sheet has and the sync does not read, with marks under it: the
 * next homework, added to the sheet after the sync was set up. The assessment
 * it most likely is comes chosen; *Read it* maps it (`ainar sync map`), and
 * the marks come in on the next Preview or Run.
 */
function UnmappedColumn(props) {
  const column = props.column;
  const [picked, setPicked] = React.useState(column.proposed || "");
  return h(
    "div",
    { className: "pp-syncnew" },
    h(
      "span",
      { className: "pp-syncnewt", title: column.why },
      "New column " + columnLetter(column.column) + " “" + column.header + "”",
      h("span", { className: "pp-syncnewd" }, " · " + column.marked + (column.marked === 1 ? " mark" : " marks") + " not read"),
    ),
    h(
      "select",
      { value: picked, disabled: props.busy, onChange: (event) => setPicked(event.target.value) },
      h("option", { value: "" }, "Read it as…"),
      (props.choices || []).map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title)),
    ),
    h(
      "button",
      {
        type: "button",
        className: "pp-syncbtn pp-syncbtn-run",
        disabled: props.busy || !picked,
        title: picked ? "From now on this sync reads the column as " + picked : "Choose the assessment first",
        onClick: () => props.onMap(column.header, picked),
      },
      props.busy ? "Saving…" : "Read it",
    ),
  );
}

/** A press to one of the sync routes, answered with the CLI's own words. */
const syncPost = (runId, sessionId, path, body) =>
  pressWork(
    scoped(BASE + path + "?run=" + encodeURIComponent(runId || ""), sessionId),
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    sessionId,
  ).catch((error) => ({ error: String(error.message || error) }));

/**
 * One sync: its mark, when it last ran, and Preview with Run or Send.
 *
 * Its own state — the last answer, the assessment chosen, where a sheet is read
 * from, whether a preview is on screen — so a card can sit on whichever
 * service's card it belongs to. `assessment` fixes the assessment (a GitHub
 * row); without it a sync that needs one offers a picker. `bare` drops the
 * mark and title, for a service card whose header already says them.
 *
 * `onDone` after every press: a preview keeps the rows it could not place for
 * review, so the waiting list is read again after either.
 */
export function SyncCard(props) {
  const sync = props.sync;
  const [result, setResult] = React.useState(null);
  const [picked, setPicked] = React.useState("");
  const [reading, setReading] = React.useState(null);
  const [previewed, setPreviewed] = React.useState(false);
  const [pressed, setBusy] = React.useState(null);
  const [dropping, setDropping] = React.useState(false);
  // A grade sheet is a road (client/road-flow.js): its Preview and Send are
  // the ones Sync all makes, with the same snapshot and the same retry.
  const road = useRoad({ runId: props.runId, sessionId: props.sessionId, names: props.names, roads: sync.road ? [sync.road] : null });
  const busy = pressed || (road.phase === "asking" ? "plan" : road.phase === "sending" ? "run" : null);
  const roadPreview = roadIn(road.preview, sync.road);

  const service = SERVICE[sync.service] || { mark: sync.service.slice(0, 2), name: sync.service };
  const needsAssessment = sync.needs === "assessment";
  const assessment = props.assessment || picked;
  const ready = !needsAssessment || Boolean(assessment);
  const check = props.check || null;
  const done = () => {
    if (props.onDone) props.onDone();
  };

  // The sheet itself when this machine can read it; otherwise the copy the
  // professor downloaded. A copy is older than the sheet by definition, so it
  // is never the default when the live read is there.
  const from = reading || (sync.canReadLive ? "live" : "export");
  const canSend = sync.road ? Boolean(roadPreview && roadPreview.ok) : previewed;
  const forget = () => {
    setPreviewed(false);
    road.close();
  };

  const press = (action, confirm) => {
    if (sync.road) {
      setResult(null);
      const source = { from: sync.exported && from === "export" ? "export" : "live" };
      const asked =
        action === "plan"
          ? road.ask(source)
          : road.send({ [sync.road]: [sync.road] }, sync.live ? {} : Object.assign({ direct: true }, source));
      asked.then(done);
      return;
    }
    setBusy(action);
    syncPost(props.runId, props.sessionId, "/api/syncs/action", {
      action,
      sync: sync.id,
      assessment: assessment || "",
      from: sync.exported && from === "export" ? "export" : "live",
      confirm: Boolean(confirm),
      names: Boolean(props.names),
    }).then((answer) => {
      setBusy(null);
      setResult(Object.assign({ action }, answer));
      setPreviewed(action === "plan" && !answer.error && Boolean(answer.ok));
      done();
    });
  };

  const map = (header, picked) => {
    setBusy("map:" + header);
    syncPost(props.runId, props.sessionId, "/api/syncs/action", { action: "map", sync: sync.id, header, assessment: picked }).then(
      (answer) => {
        setBusy(null);
        setResult(Object.assign({ action: "map" }, answer));
        forget();
        done();
      },
    );
  };

  // A downloaded sheet, dropped on the card or chosen with the button. The host
  // keeps it only if `sync plan` can read it, and answers with that plan, so
  // what comes back is a preview of the new copy.
  const takeCopy = (file) => {
    if (!file) return;
    if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
      setResult({ action: "plan", error: "That is a spreadsheet file. In Google Sheets choose File → Download → Comma-separated values (.csv)." });
      return;
    }
    setBusy("copy");
    file
      .text()
      .then((csv) =>
        syncPost(props.runId, props.sessionId, "/api/syncs/copy", {
          sync: sync.id,
          csv,
          names: Boolean(props.names),
          // When the browser saved the download: how old the sheet in it is.
          lastModified: file.lastModified,
        }),
      )
      .catch((error) => ({ error: String(error.message || error) }))
      .then((answer) => {
        setBusy(null);
        const kept = !answer.error && answer.ok;
        if (kept) setReading("export");
        // The copy kept comes back previewed as the sheet's road, ready to Send.
        if (kept && answer.road) {
          setResult(null);
          road.adopt({ previewedAt: answer.road.at, roads: [answer.road] });
        } else {
          road.close();
          setResult(Object.assign({ action: "plan" }, answer));
        }
        setPreviewed(Boolean(kept));
        done();
      });
  };

  const chips = [
    check && check.state === "changed"
      ? h(
          "span",
          { className: "pp-chip pp-chip-warn", key: "c", title: check.said + " — checked " + new Date(check.checked_at).toLocaleTimeString() },
          "changed in Google" + (check.modified ? " " + when(check.modified) : ""),
        )
      : null,
    check && check.state === "same"
      ? h("span", { className: "pp-chip", key: "c", title: "Checked " + new Date(check.checked_at).toLocaleTimeString() }, "up to date")
      : null,
    check && check.state === "error" && !check.reconnect ? h("span", { className: "pp-chip", key: "c", title: check.said }, "could not check") : null,
    sync.reconnect || (check && check.reconnect)
      ? h("span", { className: "pp-chip pp-chip-warn", key: "g", title: "Google refused the saved sign-in" }, "Google sign-in expired")
      : null,
    sync.remembered ? h("span", { className: "pp-chip", key: "r", title: "Students found by a saved link" }, sync.remembered + " remembered") : null,
    // On a service's card the header already counts what waits.
    sync.waiting && !props.bare ? h("span", { className: "pp-chip pp-chip-warn", key: "w" }, sync.waiting + " waiting") : null,
    sync.live ? h("span", { className: "pp-chip pp-chip-live", key: "l" }, "others see it") : null,
    sync.enabled ? null : h("span", { className: "pp-chip", key: "x" }, "switched off"),
  ].filter(Boolean);

  // A grade sheet this machine cannot open itself comes in as a file the
  // professor downloads; the whole card takes the drop.
  const takesFile = Boolean(sync.download) && !sync.canReadLive;
  const hasFile = (event) => Array.from((event.dataTransfer && event.dataTransfer.types) || []).includes("Files");
  const dropProps = takesFile
    ? {
        onDragOver: (event) => {
          if (!hasFile(event)) return;
          event.preventDefault();
          if (!dropping) setDropping(true);
        },
        onDragLeave: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDropping(false);
        },
        onDrop: (event) => {
          if (!hasFile(event)) return;
          event.preventDefault();
          setDropping(false);
          takeCopy(event.dataTransfer.files[0]);
        },
      }
    : {};

  const last = h(
    "div",
    {
      className: "pp-synclast" + (sync.lastSynced || props.assessment ? "" : " pp-synclast-never"),
      title: sync.lastSynced ? new Date(sync.lastSynced).toLocaleString() : "No record of this sync running",
    },
    // A card fixed to one assessment says nothing about when: the last run is
    // per sync, and would be the date of some other assessment's.
    props.assessment
      ? sync.live
        ? "Preview, then send"
        : "Preview, then run"
      : sync.lastSynced
        ? "Last synced " + when(sync.lastSynced)
        : "Never synced",
    // What that run brought, for a grade sheet: the marks, and how old the sheet was.
    sync.lastEvent && !props.assessment
      ? " · " +
          ([
            sync.lastEvent.added ? sync.lastEvent.added + " new" : null,
            sync.lastEvent.changed ? sync.lastEvent.changed + " changed" : null,
            sync.lastEvent.removed ? sync.lastEvent.removed + " taken back" : null,
          ]
            .filter(Boolean)
            .join(", ") || "no marks changed") +
          (sync.lastEvent.read === "file" && sync.lastEvent.saved ? " · sheet saved " + when(sync.lastEvent.saved) : "")
      : null,
  );

  return h(
    "div",
    Object.assign({ className: "pp-synccard" + (props.bare ? " pp-synccard-bare" : "") + (dropping ? " pp-synccard-drop" : "") }, dropProps),
    props.bare
      ? h("div", { className: "pp-syncmain" }, last, chips.length ? h("div", { className: "pp-chips" }, chips) : null)
      : h(
          "div",
          { className: "pp-synctop" },
          h(
            "span",
            { className: "pp-svcwrap" },
            h("span", { className: "pp-svc pp-svc-" + sync.service, title: service.name, "aria-hidden": "true" }, service.mark),
            // Which way it runs, on the corner of the service's mark.
            h(DirectionBadge, { role: sync.role, small: true }),
          ),
          h(
            "div",
            { className: "pp-syncmain" },
            h("div", { className: "pp-synctitle" }, props.title || sync.label, h("span", { className: "pp-syncid" }, sync.id)),
            last,
            chips.length ? h("div", { className: "pp-chips" }, chips) : null,
          ),
        ),
    sync.needs === "message"
      ? h("p", { className: "pp-as" }, "Announcements are written and sent from Publish.")
      : h(
          "div",
          { className: "pp-syncctl" },
          needsAssessment && !props.assessment
            ? h(
                "select",
                {
                  value: picked,
                  onChange: (event) => {
                    setPicked(event.target.value);
                    forget();
                  },
                },
                h("option", { value: "" }, "Choose the assessment…"),
                (props.assessments || []).map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title)),
              )
            : null,
          // Where the sheet is read from. Directly when this machine has a
          // Google login of its own; otherwise from the copy the professor
          // downloaded, with its date, and the two presses that replace it.
          sync.exported !== null && sync.exported !== undefined && sync.hasSheet && sync.canReadLive
            ? h(
                "select",
                {
                  value: from,
                  onChange: (event) => {
                    setReading(event.target.value);
                    forget();
                  },
                },
                h("option", { value: "live" }, "Read the sheet in Google"),
                sync.exported ? h("option", { value: "export" }, "Read the copy of " + when(sync.exported)) : null,
              )
            : sync.exported !== null && sync.exported !== undefined
              ? h(
                  "span",
                  {
                    className: "pp-synccopy" + (sync.exported ? "" : " pp-synccopy-none"),
                    title: sync.exported ? new Date(sync.exported).toLocaleString() : "",
                  },
                  sync.exported ? "Copy of the sheet from " + when(sync.exported) : "No copy of the sheet yet",
                )
              : null,
          takesFile
            ? h(
                "a",
                {
                  className: "pp-syncbtn",
                  href: sync.download.url,
                  target: "_blank",
                  rel: "noreferrer",
                  title: "Your browser downloads the sheet from Google as a .csv file",
                },
                "Download from Google",
              )
            : null,
          takesFile
            ? h(
                "label",
                { className: "pp-syncbtn" + (busy ? " pp-syncbtn-off" : ""), title: "Choose the .csv file you downloaded, or drop it on this card" },
                busy === "copy" ? "Reading…" : "Add the downloaded file",
                h("input", {
                  type: "file",
                  accept: ".csv,text/csv",
                  hidden: true,
                  disabled: Boolean(busy),
                  onChange: (event) => {
                    const file = event.target.files && event.target.files[0];
                    event.target.value = "";
                    takeCopy(file);
                  },
                }),
              )
            : null,
          h("span", { className: "pp-segspacer" }),
          // Before Preview: pressing it with a refused sign-in only fails again.
          sync.reconnect || (check && check.reconnect) || (result && result.reconnect) || (roadPreview && roadPreview.reconnect)
            ? h(ReconnectGoogle, {
                className: "pp-syncbtn pp-syncbtn-send",
                onBack: () => {
                  setResult(null);
                  road.close();
                  done();
                },
              })
            : null,
          h(
            "button",
            { type: "button", className: "pp-syncbtn", disabled: Boolean(busy) || !ready, onClick: () => press("plan") },
            busy === "plan" ? "Looking…" : "Preview",
          ),
          sync.live
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-syncbtn pp-syncbtn-send",
                  disabled: Boolean(busy) || !ready || !canSend,
                  title: canSend ? "Do what the preview shows" : "Preview first",
                  onClick: () => press("run", true),
                },
                busy === "run" ? "Sending…" : "Send",
              )
            : h(
                "button",
                {
                  type: "button",
                  className: "pp-syncbtn pp-syncbtn-run",
                  disabled: Boolean(busy) || !ready || !sync.enabled,
                  onClick: () => press("run"),
                },
                busy === "run" ? "Running…" : "Run",
              ),
        ),
    // How the file gets here, and what would make the step unnecessary.
    takesFile
      ? h(
          "p",
          { className: "pp-synchint" },
          "No Google login on this computer: download the sheet" +
            (sync.download.tabHint ? " (from its \u201c" + sync.download.tabHint + "\u201d tab: File → Download → CSV)" : "") +
            ", then drop the file on this card. Nothing is written before a preview.",
        )
      : null,
    !props.assessment && (sync.unmapped || []).length
      ? h(
          "div",
          { className: "pp-syncnews" },
          sync.unmapped.map((column) =>
            h(UnmappedColumn, {
              key: column.header,
              column,
              choices: sync.mapChoices,
              busy: busy === "map:" + column.header,
              onMap: map,
            }),
          ),
        )
      : null,
    result
      ? h(
          "div",
          { className: "pp-syncout" + (result.error || !result.ok ? " pp-syncout-err" : "") },
          h(
            "div",
            { className: "pp-syncouthead" },
            // A failure the CLI printed arrives as `ok: false` with its words in
            // `output`, not as `error`: it is still not Done.
            h(
              "span",
              null,
              result.error || !result.ok
                ? result.action === "run"
                  ? "Could not run"
                  : result.action === "map"
                    ? "Could not map the column"
                    : "Could not preview"
                : result.action === "run"
                  ? "Done"
                  : result.action === "map"
                    ? "Column mapped — Preview or Run brings its marks in"
                    : "Preview — nothing was changed",
            ),
            h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: () => setResult(null) }, "×"),
          ),
          h("pre", null, result.error || result.output || "(nothing printed)"),
        )
      : null,
    // The road's preview: what Send would bring in, from the snapshot it keeps.
    road.preview
      ? h(
          "div",
          { className: "pp-syncout" + (road.preview.error || (roadPreview && !roadPreview.ok) ? " pp-syncout-err" : "") },
          h(
            "div",
            { className: "pp-syncouthead" },
            h("span", null, roadPreview && roadPreview.ok ? "Preview — nothing was changed" : "Could not preview"),
            h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: forget }, "×"),
          ),
          roadPreview && roadPreview.ok
            ? h("div", { className: "pp-syncallx" }, h(SheetPlan, { plan: roadPreview.preview }))
            : h("pre", null, road.preview.error || (roadPreview && roadPreview.error) || "(nothing printed)"),
        )
      : null,
    road.results ? h(RoadResults, { results: road.results, busy: road.phase === "asking", onAgain: () => press("plan"), onClose: road.close }) : null,
  );
}

/**
 * One row a sync was not sure of, as the decision it is: the name as written,
 * who it most likely is, and Confirm. Where it stands in the sheet — the row
 * and its neighbours as a small grid — opens under it on request: it answers
 * "which line 23", which is the question only some rows raise.
 *
 * A confirmed row is remembered on this computer and applied the next time its
 * sync runs; until then it writes nothing.
 */
function WaitingCard(props) {
  const row = props.row;
  const [picking, setPicking] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  const [showing, setShowing] = React.useState(false);
  const [best] = row.candidates;
  const preview = row.preview;
  const person = (candidate) => candidate.name || candidate.student;

  const confirm = (to) => {
    setBusy(true);
    setFailed(null);
    syncPost(props.runId, props.sessionId, "/api/syncs/action", {
      action: "confirm",
      sync: row.sync,
      line: row.line,
      key: row.key,
      to: to || null,
    }).then((answer) => {
      setBusy(false);
      if (answer.error || !answer.ok) {
        setFailed(answer.error || answer.output || "It was not confirmed.");
        return;
      }
      if (props.onDone) props.onDone();
    });
  };

  const where = [row.line ? "line " + row.line : null, preview && preview.tab ? "tab " + preview.tab : null].filter(Boolean).join(" · ");

  return h(
    "div",
    { className: "pp-waitrow" },
    h(
      "div",
      { className: "pp-waitline" },
      h(
        "span",
        { className: "pp-waitpair" },
        h("span", { className: "pp-waitwritten", title: "As written in the sheet" }, row.written !== null ? "\u201c" + row.written + "\u201d" : "(name hidden)"),
        h("span", { className: "pp-waitarrow", "aria-hidden": "true" }, "→"),
        best
          ? h(
              "span",
              { className: "pp-waitwho" },
              h("span", { className: "pp-avatar", "aria-hidden": "true" }, best.name ? initials(best.name) : "?"),
              h("span", { className: "pp-waitname" }, person(best)),
            )
          : h("span", { className: "pp-as" }, "nobody close"),
      ),
    ),
    // The names get the whole first line — they are what is being decided —
    // and the presses sit at the end of the second.
    h(
      "div",
      { className: "pp-waitmeta" },
      h(
        "span",
        { className: "pp-waitwhy" },
        h("span", { className: "pp-st-warn", title: row.why.replace(/ of STUDENT-[A-Z0-9]+/, "") }, shortWhy(row.why)),
        row.candidates.length > 1 ? " · also near " + row.candidates.slice(1).map(person).join(", ") : null,
        where ? " · " + where : null,
        preview
          ? h(
              "button",
              { type: "button", className: "pp-linkbtn", "aria-expanded": showing, onClick: () => setShowing(!showing) },
              showing ? "hide the sheet" : "show in the sheet",
            )
          : null,
        preview && preview.open
          ? h("a", { className: "pp-linkbtn", href: preview.open, target: "_blank", rel: "noreferrer" }, "open ↗")
          : null,
      ),
      picking
        ? null
        : h(
            "span",
            { className: "pp-waitacts" },
            best
              ? h("button", { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy, onClick: () => confirm(null) }, busy ? "…" : "Confirm")
              : null,
            h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking({ to: "" }) }, "Someone else"),
          ),
    ),
    showing && preview ? h(SheetPreview, { preview, line: row.line }) : null,
    picking
      ? h(
          "div",
          { className: "pp-syncctl" },
          h(
            "select",
            { value: picking.to || "", onChange: (event) => setPicking({ to: event.target.value }) },
            h("option", { value: "" }, "Who is it?"),
            (props.students || []).map((student) => h("option", { value: student.student, key: student.student }, student.name || student.student)),
          ),
          h(
            "button",
            { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: busy || !picking.to, onClick: () => confirm(picking.to) },
            "Confirm",
          ),
          h("button", { type: "button", className: "pp-syncbtn", onClick: () => setPicking(null) }, "Cancel"),
        )
      : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
  );
}

/** The rows waiting on a service's syncs. */
export function WaitingList(props) {
  const rows = props.rows || [];
  if (!rows.length) return null;
  return h(
    "div",
    { className: "pp-syncsection" },
    h(
      "div",
      { className: "pp-waittitle" },
      h("span", { className: "pp-csubtitle" }, "Names to confirm"),
      h("span", { className: "pp-count pp-count-warn" }, rows.length),
      h(
        "span",
        { className: "pp-as" },
        props.names ? "a confirmed name is used from the next sync on" : "names are hidden — press Names to see who each is",
      ),
    ),
    h(
      "div",
      { className: "pp-waitlist" },
      rows.map((row) =>
        h(WaitingCard, {
          row,
          students: props.students,
          runId: props.runId,
          sessionId: props.sessionId,
          onDone: props.onDone,
          key: row.sync + row.key,
        }),
      ),
    ),
  );
}