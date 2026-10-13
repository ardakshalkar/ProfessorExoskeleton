/**
 * The Syncs view of the Integrations tab: every road to a service outside the
 * run, with Preview and Run beside it, and the matches waiting for a person.
 *
 * Drawn here rather than served as a document for Integrations' reason: it
 * posts back. Every press is `ainar sync …` on the host half (server/syncs.js),
 * and the CLI's own words are shown under the row that asked for them.
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

import { Message } from "./common.js";
import { useSheetCheck } from "./marks.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

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

/** The groups the syncs are drawn in, by which way the data runs. */
const GROUPS = [
  { role: "source", title: "Coming into the course", hint: "Read from the service; nothing is sent to it." },
  { role: "target", title: "Going out", hint: "Other people see what these send — preview first." },
  { role: "both", title: "Both ways", hint: "Whichever side changed since the last sync wins; both changed waits for you." },
];

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

const initials = (name) =>
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

export function SyncsView(props) {
  const url = (path) => scoped(BASE + path + "?run=" + encodeURIComponent(props.runId || ""), props.sessionId);
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  // Per sync: the last press's answer, which assessment is chosen, where the
  // sheet is read from, and whether a preview is on screen (which is what
  // makes a send available).
  const [results, setResults] = React.useState({});
  const [chosen, setChosen] = React.useState({});
  const [reading, setReading] = React.useState({});
  const [previewed, setPreviewed] = React.useState({});
  const [busy, setBusy] = React.useState(null);
  const [others, setOthers] = React.useState({});
  // The card a file is being dragged over, for its outline.
  const [dropping, setDropping] = React.useState(null);
  // Whether each grade sheet changed in Google since its last sync.
  const sheetCheck = useSheetCheck(props.runId, props.sessionId, (props.revision || 0) + "." + tick);

  React.useEffect(() => {
    let live = true;
    fetch(url("/api/syncs") + (props.names ? "&names=1" : "") + "&r=" + (props.revision || 0) + "." + tick, {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error.message || error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, props.names, props.revision, tick]);

  if (state.phase === "loading" && !state.value) return h(Message, null, "Reading this run's syncs…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);

  const post = (body, key) => {
    setBusy(key);
    return fetch(url("/api/syncs/action"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((response) => response.json())
      .catch((error) => ({ error: String(error.message || error) }))
      .then((answer) => {
        setBusy(null);
        return answer;
      });
  };

  // The sheet itself when this machine can read it; otherwise the copy the
  // professor downloaded. A copy is older than the sheet by definition, so it
  // is never the default when the live read is there.
  const fromOf = (sync) => reading[sync.id] || (sync.canReadLive ? "live" : "export");

  const press = (sync, action, confirm) => {
    const body = {
      action,
      sync: sync.id,
      assessment: chosen[sync.id] || "",
      from: sync.exported && fromOf(sync) === "export" ? "export" : "live",
      confirm: Boolean(confirm),
      names: Boolean(props.names),
    };
    post(body, sync.id + ":" + action).then((answer) => {
      setResults((all) => Object.assign({}, all, { [sync.id]: Object.assign({ action }, answer) }));
      setPreviewed((all) => Object.assign({}, all, { [sync.id]: action === "plan" && !answer.error && answer.ok }));
      // A preview keeps the rows it could not place for review, so the
      // Waiting list is read again after either press.
      setTick((value) => value + 1);
      if (props.onWrite) props.onWrite();
    });
  };

  // A downloaded sheet, dropped on the card or chosen with the button. The host
  // keeps it only if `sync plan` can read it, and answers with that plan, so
  // what comes back is a preview of the new copy.
  const takeCopy = (sync, file) => {
    if (!file) return;
    const key = sync.id + ":copy";
    if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
      setResults((all) => Object.assign({}, all, {
        [sync.id]: { action: "plan", error: "That is a spreadsheet file. In Google Sheets choose File → Download → Comma-separated values (.csv)." },
      }));
      return;
    }
    setBusy(key);
    file
      .text()
      .then((csv) =>
        fetch(url("/api/syncs/copy"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          // When the browser saved the download: how old the sheet in it is.
          body: JSON.stringify({ sync: sync.id, csv, names: Boolean(props.names), lastModified: file.lastModified }),
        }).then((response) => response.json()),
      )
      .catch((error) => ({ error: String(error.message || error) }))
      .then((answer) => {
        setBusy(null);
        setResults((all) => Object.assign({}, all, { [sync.id]: Object.assign({ action: "plan" }, answer) }));
        const kept = !answer.error && answer.ok;
        if (kept) setReading((all) => Object.assign({}, all, { [sync.id]: "export" }));
        setPreviewed((all) => Object.assign({}, all, { [sync.id]: kept }));
        setTick((value) => value + 1);
        if (props.onWrite) props.onWrite();
      });
  };

  const confirmRow = (row, to) => {
    post({ action: "confirm", sync: row.sync, line: row.line, key: row.key, to: to || null }, "confirm:" + row.key).then(
      (answer) => {
        if (answer.error || !answer.ok) {
          setResults((all) => Object.assign({}, all, { [row.sync]: answer }));
          return;
        }
        setTick((value) => value + 1);
        // Course mode's header counts what is waiting; it reads on the same revision.
        if (props.onWrite) props.onWrite();
      },
    );
  };

  const migrate = () =>
    post({ action: "migrate" }, "migrate").then((answer) => {
      setResults((all) => Object.assign({}, all, { _migrate: answer }));
      setTick((value) => value + 1);
      if (props.onWrite) props.onWrite();
    });

  const person = (candidate) => candidate.name || candidate.student;
  const implied = doc.syncs.filter((sync) => sync.implied).length;
  const remembered = doc.syncs.reduce((sum, sync) => sum + (sync.remembered || 0), 0);
  const latest = doc.syncs
    .filter((sync) => sync.lastSynced)
    .sort((a, b) => Date.parse(b.lastSynced) - Date.parse(a.lastSynced))[0];
  const close = (id) => setResults((all) => Object.assign({}, all, { [id]: null }));

  // ---- one sync ----------------------------------------------------------

  const syncCard = (sync) => {
    const result = results[sync.id];
    const service = SERVICE[sync.service] || { mark: sync.service.slice(0, 2), name: sync.service };
    const needsAssessment = sync.needs === "assessment";
    const ready = !needsAssessment || chosen[sync.id];
    const check = sheetCheck && sheetCheck.checks ? sheetCheck.checks.find((entry) => entry.sync === sync.id) : null;
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
      check && check.state === "error" ? h("span", { className: "pp-chip", key: "c", title: check.said }, "could not check") : null,
      sync.implied ? h("span", { className: "pp-chip", key: "o", title: "Read from " + (sync.from || "older settings") }, "older settings") : null,
      sync.remembered ? h("span", { className: "pp-chip", key: "r" }, sync.remembered + " remembered") : null,
      sync.waiting ? h("span", { className: "pp-chip pp-chip-warn", key: "w" }, sync.waiting + " waiting") : null,
      sync.live ? h("span", { className: "pp-chip pp-chip-live", key: "l" }, "others see it") : null,
      sync.enabled ? null : h("span", { className: "pp-chip", key: "x" }, "switched off"),
    ];
    // A grade sheet this machine cannot open itself comes in as a file the
    // professor downloads; the whole card takes the drop.
    const takesFile = Boolean(sync.download) && !sync.canReadLive;
    const hasFile = (event) => Array.from((event.dataTransfer && event.dataTransfer.types) || []).includes("Files");
    const dropProps = takesFile
      ? {
          onDragOver: (event) => {
            if (!hasFile(event)) return;
            event.preventDefault();
            if (dropping !== sync.id) setDropping(sync.id);
          },
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropping(null);
          },
          onDrop: (event) => {
            if (!hasFile(event)) return;
            event.preventDefault();
            setDropping(null);
            takeCopy(sync, event.dataTransfer.files[0]);
          },
        }
      : {};
    return h(
      "div",
      Object.assign({ className: "pp-synccard" + (dropping === sync.id ? " pp-synccard-drop" : ""), key: sync.id }, dropProps),
      h(
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
          h("div", { className: "pp-synctitle" }, sync.label, h("span", { className: "pp-syncid" }, sync.id)),
          h(
            "div",
            {
              className: "pp-synclast" + (sync.lastSynced ? "" : " pp-synclast-never"),
              title: sync.lastSynced ? new Date(sync.lastSynced).toLocaleString() : "No record of this sync running",
            },
            sync.lastSynced ? "Last synced " + when(sync.lastSynced) : "Never synced",
            // What that run brought, for a grade sheet: the marks, and how old the sheet was.
            sync.lastEvent
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
          ),
          h("div", { className: "pp-chips" }, chips),
        ),
      ),
      sync.needs === "message"
        ? h("p", { className: "pp-as" }, "Announcements are written and sent from Publish.")
        : h(
            "div",
            { className: "pp-syncctl" },
            needsAssessment
              ? h(
                  "select",
                  {
                    value: chosen[sync.id] || "",
                    onChange: (event) => {
                      const value = event.target.value;
                      setChosen((all) => Object.assign({}, all, { [sync.id]: value }));
                      setPreviewed((all) => Object.assign({}, all, { [sync.id]: false }));
                    },
                  },
                  h("option", { value: "" }, "Choose the assessment…"),
                  doc.assessments.map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title)),
                )
              : null,
            // Where the sheet is read from. Directly when this machine has a
            // Google login of its own; otherwise from the copy the professor
            // downloaded, with its date, and the two presses that replace it.
            sync.exported !== null && sync.exported !== undefined && sync.hasSheet && sync.canReadLive
              ? h(
                  "select",
                  {
                    value: fromOf(sync),
                    onChange: (event) => {
                      const value = event.target.value;
                      setReading((all) => Object.assign({}, all, { [sync.id]: value }));
                      setPreviewed((all) => Object.assign({}, all, { [sync.id]: false }));
                    },
                  },
                  h("option", { value: "live" }, "Read the sheet in Google"),
                  sync.exported ? h("option", { value: "export" }, "Read the copy of " + when(sync.exported)) : null,
                )
              : sync.exported !== null && sync.exported !== undefined
                ? h(
                    "span",
                    { className: "pp-synccopy" + (sync.exported ? "" : " pp-synccopy-none"), title: sync.exported ? new Date(sync.exported).toLocaleString() : "" },
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
                  busy === sync.id + ":copy" ? "Reading…" : "Add the downloaded file",
                  h("input", {
                    type: "file",
                    accept: ".csv,text/csv",
                    hidden: true,
                    disabled: Boolean(busy),
                    onChange: (event) => {
                      const file = event.target.files && event.target.files[0];
                      event.target.value = "";
                      takeCopy(sync, file);
                    },
                  }),
                )
              : null,
            h("span", { className: "pp-segspacer" }),
            h(
              "button",
              { type: "button", className: "pp-syncbtn", disabled: Boolean(busy) || !ready, onClick: () => press(sync, "plan") },
              busy === sync.id + ":plan" ? "Looking…" : "Preview",
            ),
            sync.live
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-syncbtn pp-syncbtn-send",
                    disabled: Boolean(busy) || !ready || !previewed[sync.id],
                    title: previewed[sync.id] ? "Do what the preview shows" : "Preview first",
                    onClick: () => press(sync, "run", true),
                  },
                  busy === sync.id + ":run" ? "Sending…" : "Send",
                )
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pp-syncbtn pp-syncbtn-run",
                    disabled: Boolean(busy) || !ready || !sync.enabled,
                    onClick: () => press(sync, "run"),
                  },
                  busy === sync.id + ":run" ? "Running…" : "Run",
                ),
          ),
      // How the file gets here, and what would make the step unnecessary: the
      // missing thing named, so "why do I have to do this" has an answer.
      takesFile
        ? h(
            "p",
            { className: "pp-synchint" },
            "This computer has no Google login of its own, so the sheet comes in as a file: press Download from Google" +
              (sync.download.tabHint
                ? ' (it downloads the first tab; for "' + sync.download.tabHint + '" open that tab and use File → Download → Comma-separated values)'
                : "") +
              ", then drop the file here. You see what it would change before anything is written.",
          )
        : null,
      result
        ? h(
            "div",
            { className: "pp-syncout" + (result.error || !result.ok ? " pp-syncout-err" : "") },
            h(
              "div",
              { className: "pp-syncouthead" },
              h("span", null, result.error ? "Could not run" : result.action === "run" ? "Done" : "Preview — nothing was changed"),
              h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: () => close(sync.id) }, "×"),
            ),
            h("pre", null, result.error || result.output || "(nothing printed)"),
          )
        : null,
    );
  };

  // ---- one waiting row ---------------------------------------------------

  const waitingCard = (row) => {
    const [best] = row.candidates;
    const picking = others[row.key];
    const preview = row.preview;
    return h(
      "div",
      { className: "pp-waitcard", key: row.sync + row.key },
      h(
        "div",
        { className: "pp-waithead" },
        h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, preview ? "GS" : "··"),
        h(
          "span",
          { className: "pp-waitsource" },
          row.source,
          preview && preview.tab ? h("span", { className: "pp-waitwhere" }, " · tab " + preview.tab) : null,
          row.line ? h("span", { className: "pp-waitwhere" }, " · line " + row.line) : null,
        ),
        h("span", { className: "pp-segspacer" }),
        preview && preview.open
          ? h("a", { className: "pp-waitopen", href: preview.open, target: "_blank", rel: "noreferrer" }, "Open in Google Sheets ↗")
          : null,
      ),
      preview ? h(SheetPreview, { preview, line: row.line }) : null,
      h(
        "div",
        { className: "pp-waitdecide" },
        h(
          "div",
          { className: "pp-waitpair" },
          h("span", { className: "pp-waitwritten", title: "As written in the sheet" }, row.written !== null ? "“" + row.written + "”" : "(name hidden)"),
          h("span", { className: "pp-waitarrow", "aria-hidden": "true" }, "→"),
          best
            ? h(
                "span",
                { className: "pp-waitwho" },
                h("span", { className: "pp-avatar", "aria-hidden": "true" }, best.name ? initials(best.name) : "?"),
                h("span", { className: "pp-waitname" }, person(best)),
              )
            : h("span", { className: "pp-as" }, "nobody in the class list is close"),
          h("span", { className: "pp-chip pp-chip-warn", title: row.why.replace(/ of STUDENT-[A-Z0-9]+/, "") }, shortWhy(row.why)),
        ),
        row.candidates.length > 1 ? h("div", { className: "pp-as" }, "Also near: " + row.candidates.slice(1).map(person).join(", ")) : null,
        picking
          ? h(
              "div",
              { className: "pp-syncctl" },
              h(
                "select",
                {
                  value: picking.to || "",
                  onChange: (event) => {
                    const to = event.target.value;
                    setOthers((all) => Object.assign({}, all, { [row.key]: { to } }));
                  },
                },
                h("option", { value: "" }, "Who is it?"),
                doc.students.map((student) => h("option", { value: student.student, key: student.student }, student.name || student.student)),
              ),
              h("span", { className: "pp-segspacer" }),
              h(
                "button",
                { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: Boolean(busy) || !picking.to, onClick: () => confirmRow(row, picking.to) },
                "Confirm",
              ),
              h("button", { type: "button", className: "pp-syncbtn", onClick: () => setOthers((all) => Object.assign({}, all, { [row.key]: null })) }, "Cancel"),
            )
          : h(
              "div",
              { className: "pp-syncctl" },
              h("span", { className: "pp-segspacer" }),
              best
                ? h(
                    "button",
                    { type: "button", className: "pp-syncbtn pp-syncbtn-run", disabled: Boolean(busy), onClick: () => confirmRow(row, null) },
                    "Confirm " + (best.name ? best.name.split(/\s+/)[0] : "it"),
                  )
                : null,
              h("button", { type: "button", className: "pp-syncbtn", onClick: () => setOthers((all) => Object.assign({}, all, { [row.key]: { to: "" } })) }, "Someone else"),
            ),
      ),
    );
  };

  // ---- the page ----------------------------------------------------------

  const tile = (label, value, note, tone) =>
    h(
      "div",
      { className: "pp-stile" + (tone ? " pp-stile-" + tone : "") },
      h("span", { className: "pp-stilelabel" }, label),
      h("span", { className: "pp-stilevalue" }, value),
      note ? h("span", { className: "pp-stilenote" }, note) : null,
    );

  return h(
    "div",
    { className: "pp-syncs" },
    h(
      "div",
      { className: "pp-stiles" },
      tile(
        "Syncs",
        doc.syncs.length,
        h(
          "span",
          { className: "pp-stiledirs" },
          GROUPS.map((group) => {
            const count = doc.syncs.filter((sync) => sync.role === group.role).length;
            return count
              ? h(
                  "span",
                  { className: "pp-stiledir pp-stiledir-" + group.role, key: group.role, title: DIRECTION_WORDS[group.role] },
                  h(DirectionIcon, { role: group.role, size: 12 }),
                  count + " " + (group.role === "source" ? "in" : group.role === "target" ? "out" : "both"),
                )
              : null;
          }),
        ),
      ),
      tile("Waiting for you", doc.waiting.length, doc.waiting.length ? "rows a sync was not sure of" : "nothing to decide", doc.waiting.length ? "warn" : "ok"),
      tile("Last synced", latest ? when(latest.lastSynced) : "never", latest ? latest.label : "no sync has run yet"),
      tile("Remembered", remembered, "students found by a saved link"),
    ),
    props.onSetup
      ? h(
          "div",
          { className: "pp-syncnote" },
          h("span", null, "Addresses, tokens and Canvas links are set up in Integrations → This course."),
          h("button", { type: "button", className: "pp-syncbtn", title: "Show Integrations here — each service this course uses, and its setup", onClick: props.onSetup }, "Open Integrations"),
        )
      : null,
    implied
      ? h(
          "div",
          { className: "pp-syncnote" },
          h(
            "span",
            null,
            implied === doc.syncs.length ? "All " : implied + " of ",
            doc.syncs.length + " are read from older settings. Save them in the run's settings so they are written down in one place.",
          ),
          h(
            "button",
            { type: "button", className: "pp-syncbtn", disabled: Boolean(busy), onClick: migrate, title: "Writes syncs: into the run's version.yaml" },
            busy === "migrate" ? "Writing…" : "Save in settings",
          ),
        )
      : null,
    results._migrate ? h("pre", { className: "pp-approveout" }, results._migrate.error || results._migrate.output) : null,

    doc.waiting.length
      ? h(
          "section",
          { className: "pp-syncsection" },
          h("h3", { className: "pp-synch3" }, "Waiting for you", h("span", { className: "pp-count pp-count-warn" }, doc.waiting.length)),
          h(
            "p",
            { className: "pp-as" },
            doc.names
              ? "Each row as it stands in its sheet, and who it most likely is. A confirmed row is remembered on this computer and applied the next time its sync runs; until then it writes nothing."
              : "Names are hidden. Press Names to see who each row is.",
          ),
          h("div", { className: "pp-waitlist" }, doc.waiting.map(waitingCard)),
        )
      : null,

    GROUPS.map((group) => {
      const members = doc.syncs.filter((sync) => sync.role === group.role);
      if (!members.length) return null;
      return h(
        "section",
        { className: "pp-syncsection", key: group.role },
        h(
          "h3",
          { className: "pp-synch3" },
          h(DirectionBadge, { role: group.role }),
          group.title,
          h("span", { className: "pp-count" }, members.length),
        ),
        h("p", { className: "pp-as" }, group.hint),
        h("div", { className: "pp-syncgrid" }, members.map(syncCard)),
      );
    }),
    doc.syncs.length ? null : h(Message, null, "This run has no syncs yet."),
    doc.waiting.length
      ? null
      : h("p", { className: "pp-as pp-syncfoot" }, "Nothing is waiting. Rows a sync is not sure of appear at the top after it runs."),
  );
}
