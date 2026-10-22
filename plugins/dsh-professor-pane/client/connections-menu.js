/**
 * The run's connections in course mode's header: a mark per service the run
 * uses, coloured by how it stands, and — pressed — a panel with each one's
 * state, the fix when a sign-in is the problem, and its syncs.
 *
 * Nothing is decided here that Integrations does not already decide. The
 * states come from the same three answers its cards read (`/api/integrations`,
 * `/api/syncs`, `/api/sheet-check`), and each sync is drawn by `SyncCard`, so
 * Preview before Send, the assessment picker and the Reconnect on a refused
 * sign-in are the same code they are on the card. A press that changes what
 * other people see is still never one press from here.
 *
 * Which services: the ones the run uses — set up at all, or with a sync on the
 * run — as Integrations draws them. Transcription is the machine's, not the
 * run's, and is listed when a connection for it exists.
 */

import { ReconnectGoogle } from "./integration-parts.js";
import { useSheetCheck } from "./marks.js";
import { h, React, ReactDOM } from "./react.js";
import { SyncCard, when } from "./syncs.js";

const MARK = { canvas: "Cv", sheets: "GS", github: "GH", telegram: "Tg", moodle: "Md", transcription: "Tr" };
const RANK = { bad: 3, warn: 2, ok: 1 };
const plural = (count, one, many) => count + " " + (count === 1 ? one : many);

/**
 * Each service as `{ id, name, tone, state, line, fix, syncs }`: `tone` is ok,
 * warn or bad; `state` the two or three words for the header; `line` the
 * sentence in the panel; `fix` what the panel offers besides Open —
 * `reconnect`, `connect` (Google) or `setup` (Integrations). Pure over the
 * three answers, any of which may still be null.
 */
export const connectionsOf = (data, roads, checks) => {
  if (!data) return [];
  const rows = data.integrations || [];
  const rowOf = (id) => rows.find((row) => row.id === id) || null;
  const syncs = roads && roads.syncs ? roads.syncs : [];
  const syncsOf = (service) => syncs.filter((sync) => sync.service === service);
  const waitingOf = (service) => {
    const ids = new Set(syncsOf(service).map((sync) => sync.id));
    return (roads && roads.waiting ? roads.waiting : []).filter((entry) => ids.has(entry.sync)).length;
  };
  const missing = (row) =>
    "Still to set up: " +
    row.steps
      .filter((step) => !step.done)
      .map((step) => step.label)
      .join(", ") +
    ".";
  const used = (id) => {
    const row = rowOf(id);
    return Boolean((row && row.state !== "absent") || syncsOf(id).length);
  };
  // A service with only a checklist: Telegram, Moodle, and Canvas before its
  // syncs say more.
  const fromSteps = (row) =>
    !row || row.state === "absent"
      ? { tone: "bad", state: "not set up", line: "Nothing is recorded for it yet.", fix: "setup" }
      : row.state === "partial"
        ? { tone: "warn", state: "partly set up", line: missing(row), fix: "setup" }
        : { tone: "ok", state: "set up", line: row.what ? "For " + row.what + "." : "Set up.", fix: null };
  const out = [];

  if (used("canvas")) {
    const row = rowOf("canvas");
    const state = fromSteps(row);
    const waiting = waitingOf("canvas");
    if (row && row.state === "ready") {
      state.state = "connected";
      state.line = (data.canvas && data.canvas.host ? data.canvas.host : "Canvas") + " · every step recorded.";
    }
    if (waiting && state.tone === "ok") Object.assign(state, { tone: "warn", state: plural(waiting, "row", "rows") + " to confirm" });
    out.push(Object.assign({ id: "canvas", name: "Canvas", syncs: syncsOf("canvas") }, state));
  }

  const sheetSyncs = syncsOf("sheets");
  if (used("sheets")) {
    const google = data.google || {};
    const found = checks && checks.checks ? checks.checks : [];
    const expired = Boolean(google.connected && (google.expired || found.some((check) => check.reconnect) || sheetSyncs.some((sync) => sync.reconnect)));
    const readsLive = google.connected || sheetSyncs.some((sync) => sync.canReadLive);
    const changed = found.filter((check) => check.state === "changed");
    const waiting = waitingOf("sheets");
    const who = google.account ? " for " + google.account : "";
    const state = expired
      ? { tone: "bad", state: "sign-in expired", line: "Google stopped accepting the sign-in" + who + ".", fix: "reconnect" }
      : !readsLive
        ? { tone: "warn", state: "no Google login", line: "The sheet comes in as a download until Google is connected.", fix: "connect" }
        : waiting
          ? { tone: "warn", state: plural(waiting, "name", "names") + " to confirm", line: "Confirm them on the Google Sheets card.", fix: null }
          : changed.length
            ? {
                tone: "warn",
                state: "changed in Google",
                line: "The sheet changed" + (changed[0].modified ? " " + when(changed[0].modified) : "") + " since the last sync.",
                fix: null,
              }
            : {
                tone: "ok",
                state: found.some((check) => check.state === "same") ? "up to date" : "connected",
                line: google.account ? "Signed in as " + google.account + "." : "This computer can read the sheet.",
                fix: null,
              };
    out.push(Object.assign({ id: "sheets", name: "Google Sheets", syncs: sheetSyncs }, state));
  }

  const github = data.github || {};
  const githubSyncs = syncsOf("github");
  if (githubSyncs.length || github.connection) {
    const gh = github.gh || {};
    const state =
      github.via === "token"
        ? { tone: "ok", state: "signed in", line: "A saved token" + (github.owner ? ", repositories under " + github.owner : "") + ".", fix: null }
        : github.via === "gh"
          ? { tone: "ok", state: "signed in", line: "The gh command line, as " + gh.account + ".", fix: null }
          : {
              tone: "bad",
              state: "not signed in",
              line: gh.installed ? "gh is installed but not signed in, and no token is saved." : "No GitHub token is saved, and gh is not installed.",
              fix: "setup",
            };
    out.push(Object.assign({ id: "github", name: "GitHub", syncs: githubSyncs }, state));
  }

  for (const id of ["telegram", "moodle"]) {
    if (!used(id)) continue;
    const row = rowOf(id);
    out.push(Object.assign({ id, name: row ? row.label : id, syncs: syncsOf(id) }, fromSteps(row)));
  }

  const refs = (data.credentials && data.credentials.refs) || {};
  const transcription = ((data.registry && data.registry.connections) || []).find((entry) => entry.type === "transcription");
  if (transcription) {
    const saved = Boolean((refs[transcription.tokenEnv] && refs[transcription.tokenEnv].configured) || transcription.tokenInEnv);
    const what = [transcription.provider, transcription.model].filter(Boolean).join(" · ");
    out.push(
      saved
        ? { id: "transcription", name: "Transcription", tone: "ok", state: "key saved", line: (what || "A provider") + ", for recorded defences.", fix: null, syncs: [] }
        : { id: "transcription", name: "Transcription", tone: "bad", state: "no key", line: "No key is saved for " + (what || "the provider") + ".", fix: "setup", syncs: [] },
    );
  }
  return out;
};

/** The worst of the services, for the header's words. */
const worstOf = (rows) => rows.reduce((worst, row) => (!worst || RANK[row.tone] > RANK[worst.tone] ? row : worst), null);

/**
 * The header button and its panel.
 *
 * `data` and `roads` are the answers course mode already holds for its header;
 * `revision` re-asks the sheet check after a write. `onOpen(service)` goes to
 * that service's card on Integrations; `onDone` after a press that wrote.
 */
export function ConnectionsMenu(props) {
  const [open, setOpen] = React.useState(false);
  // Where the panel stands: under the button, kept inside the window.
  const [at, setAt] = React.useState(null);
  const box = React.useRef(null);
  const layer = React.useRef(null);
  const checks = useSheetCheck(props.runId, props.sessionId, String(props.revision || 0));
  const rows = connectionsOf(props.data, props.roads, checks);

  React.useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      if (!box.current) return;
      const rect = box.current.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 32);
      setAt({ top: rect.bottom + 6, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), width });
    };
    place();
    // A press on the button is the button's; anywhere else but the panel closes it.
    const away = (event) => {
      const inside = [box.current, layer.current].some((node) => node && node.contains(event.target));
      if (!inside) setOpen(false);
    };
    // Course mode leaves Escape alone while the panel is in the page.
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  if (!rows.length) return null;
  const worst = worstOf(rows);
  const label =
    worst.tone === "ok"
      ? "Connections"
      : worst.name + ": " + worst.state + (rows.filter((row) => row.tone !== "ok").length > 1 ? " · more" : "");

  const go = (id) => {
    setOpen(false);
    if (props.onOpen) props.onOpen(id);
  };

  const fixOf = (row) => {
    if (row.fix === "reconnect" || row.fix === "connect") {
      return h(ReconnectGoogle, { label: row.fix === "connect" ? "Connect Google" : "Reconnect Google", onBack: props.onDone });
    }
    if (row.fix === "setup") return h("button", { type: "button", className: "pp-segbtn", onClick: () => go(row.id) }, "Set up");
    return null;
  };

  // On the page's root, above course mode: inside its header the panel would
  // be clipped by the window and drawn under the place.
  const panel = h(
    "div",
    {
      className: "pp-connpanel",
      ref: layer,
      role: "dialog",
      "aria-label": "Connections",
      style: at ? { top: at.top + "px", left: at.left + "px", width: at.width + "px" } : { visibility: "hidden" },
    },
    // What needs the professor first; otherwise in the header's order.
    rows
      .slice()
      .sort((left, right) => RANK[right.tone] - RANK[left.tone])
      .map((row) =>
      h(
        "section",
        { className: "pp-connrow pp-conn-" + row.tone, key: row.id },
        h(
          "div",
          { className: "pp-connhead" },
          h("span", { className: "pp-svc pp-svc-small pp-svc-" + row.id, "aria-hidden": "true" }, MARK[row.id] || row.id.slice(0, 2)),
          h("span", { className: "pp-connname" }, row.name, h("span", { className: "pp-connstate" }, row.state)),
          h("span", { className: "pp-segspacer" }),
          fixOf(row),
          h("button", { type: "button", className: "pp-segbtn", title: "Its card on Integrations", onClick: () => go(row.id) }, "Open"),
        ),
        h("p", { className: "pp-connline" }, row.line),
        row.syncs.map((sync) =>
          h(
            "div",
            { className: "pp-connsync", key: sync.id },
            h("div", { className: "pp-csubtitle" }, sync.label, h("span", { className: "pp-syncid" }, sync.id)),
            h(SyncCard, {
              sync,
              bare: true,
              check: checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) || null : null,
              assessments: props.roads ? props.roads.assessments : [],
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onDone: props.onDone,
            }),
          ),
        ),
      ),
    ),
  );

  return h(
    "span",
    { className: "pp-conn", ref: box },
    h(
      "button",
      {
        type: "button",
        className: "pp-connbtn pp-conn-" + worst.tone + (props.waiting ? " pp-wiring-waiting" : ""),
        "aria-expanded": open,
        disabled: props.disabled,
        title: props.disabled ? "Private — not shown while previewing as a student" : "Each connection, and its syncs",
        onClick: () => setOpen(!open),
      },
      rows.map((row) =>
        h("span", { className: "pp-conndot pp-conn-" + row.tone, key: row.id, title: row.name + ": " + row.state }, MARK[row.id] || row.id.slice(0, 2)),
      ),
      h("span", { className: "pp-connlabel" }, [label, props.waiting && worst.tone === "ok" ? plural(props.waiting, "row", "rows") + " waiting" : null].filter(Boolean).join(" · ")),
      h("span", { className: "pp-connchev", "aria-hidden": "true" }, open ? "▴" : "▾"),
    ),
    open ? ReactDOM.createPortal(panel, document.body) : null,
  );
}
