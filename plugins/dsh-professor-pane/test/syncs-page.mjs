// The Syncs view alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   node plugins/dsh-professor-pane/test/syncs-page.mjs RUN     # then open http://localhost:3092
//
// The list of syncs is the workspace's own, from the same server function the
// pane uses, and Preview runs the real `ainar sync plan` — it writes nothing.
// The review list, the class list and every write (Run, Send, Confirm) are
// mock: made-up names, answered from memory, so looking at the view never
// changes a course, a sheet or the link table, and puts no real student's
// name on a screen that might be shared.

import http from "node:http";
import { readFileSync } from "node:fs";

import { copyFromUpload, runSyncAction, syncsDocument } from "../server/syncs.js";
import { resolveWorkspace } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3092);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const client = new URL("../lib/client.js", import.meta.url);
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");

const students = [
  { student: "STUDENT-AAAA01", name: "Ostanin Artem" },
  { student: "STUDENT-AAAA02", name: "Nurlanova Aigerim" },
  { student: "STUDENT-AAAA03", name: "Nurlanova Aruzhan" },
  { student: "STUDENT-AAAA04", name: "Serikbayev Dauren" },
  { student: "STUDENT-AAAA05", name: "Abenova Zhanel" },
];
const named = (student) => students.find((entry) => entry.student === student);
let waiting = [
  { line: 7, written: "Ostanin Artym", why: "a close spelling", candidates: ["STUDENT-AAAA01"] },
  { line: 12, written: "Aigerim", why: "only one word", candidates: ["STUDENT-AAAA02"] },
  { line: 18, written: "Serikbaev Dauren", why: "a close spelling", candidates: ["STUDENT-AAAA04"] },
  { line: 23, written: "A. Nurlanova", why: "the name matches no enrolled student closely enough", candidates: ["STUDENT-AAAA02", "STUDENT-AAAA03"] },
  { line: 31, written: "Zhanel", why: "only one word", candidates: ["STUDENT-AAAA05"] },
];

/** A made-up sheet around a waiting row: the header, the row, a neighbour each side. */
const NEIGHBOURS = ["Akhmetov Ruslan", "Bekova Dana", "Ivanova Maria", "Kassymov Timur", "Li Wei", "Omarova Saule"];
const previewFor = (row, names, index) => {
  const marks = (seed) => ["T", "LT", "", "T", "LLT"].map((_, column) => ["T", "LT", "", "LLT"][(seed + column) % 4]);
  const line = (at, name, seed) => ({ line: at, cells: [names ? name : "•••", ...marks(seed), seed % 3 ? "" : "lab partner absent"] });
  return {
    tab: "Homework",
    firstColumn: 1,
    nameColumn: 0,
    markColumns: [1, 2, 3, 4, 5],
    header: ["Name", "1Task", "2Task", "3Task", "4Task", "5Task", "Note"],
    rows: [
      line(row.line - 1, NEIGHBOURS[index % NEIGHBOURS.length], index + 1),
      line(row.line, row.written, index),
      line(row.line + 1, NEIGHBOURS[(index + 3) % NEIGHBOURS.length], index + 2),
    ],
    open: "https://docs.google.com/spreadsheets/d/EXAMPLE-ONLY-NOT-A-SHEET/edit#gid=0&range=A" + row.line,
  };
};

const documentFor = (names) => {
  const real = syncsDocument(workspace, RUN, { names: false });
  const rows = waiting.map((row, index) => ({
    sync: "hw-sheet",
    source: "Grade sheet you keep",
    preview: previewFor(row, names, index),
    key: "name:" + row.written.toLowerCase(),
    line: row.line,
    written: names ? row.written : null,
    why: row.why,
    candidates: row.candidates.map((student, index) => ({
      student,
      name: names ? named(student).name : null,
      match: index ? "near" : "close",
    })),
  }));
  return {
    ...real,
    names,
    waiting: rows,
    students: students.map((entry) => ({ student: entry.student, name: names ? entry.name : null })),
    syncs: real.syncs.map((sync) => (sync.id === "hw-sheet" ? { ...sync, waiting: rows.length } : sync)),
  };
};

/** Two made-up runs of the grade sheet: one from a downloaded copy this morning, one live yesterday. */
const activityFor = (names) => {
  const change = (student, title, from, to, scoreFrom, scoreTo) => ({
    student,
    name: names ? named(student).name : null,
    assessment: "ASSESSMENT-" + title.replace(/\s+/g, ""),
    title,
    from,
    to,
    score_from: scoreFrom,
    score_to: scoreTo,
  });
  const hour = 3600000;
  const at = (ago) => new Date(Date.now() - ago).toISOString();
  return {
    runId: RUN,
    names,
    events: [
      {
        sync: "hw-sheet", label: "Grade sheet you keep", at: at(0.2 * hour), read: "file", saved: at(0.5 * hour),
        rows: 31, placed: 30, held: 1, waiting: 1, unchanged: 112, wrote_back: 0, added: 2, changed: 1, removed: 1,
        changes: [
          change("STUDENT-AAAA01", "Homework 3", null, "T", null, 10),
          change("STUDENT-AAAA02", "Homework 3", null, "LT", null, 8),
          change("STUDENT-AAAA04", "Homework 2", "LT", "T", 8, 10),
          change("STUDENT-AAAA05", "Homework 2", "T", null, 10, null),
        ],
      },
      {
        sync: "hw-sheet", label: "Grade sheet you keep", at: at(26 * hour), read: "sheet", saved: at(26 * hour),
        rows: 31, placed: 31, held: 0, waiting: 0, unchanged: 116, wrote_back: 0, added: 0, changed: 0, removed: 0, changes: [],
      },
    ],
  };
};

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>Syncs — test page</title>
<style>body{font:13px system-ui;margin:0;background:#f4f4f6}#root{max-width:560px;margin:24px auto;background:#fff;
border:1px solid #e3e3e6;border-radius:12px;padding:14px 16px}#bar{max-width:560px;margin:16px auto 0;display:flex;gap:8px}</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
</head><body><div id="bar"></div><div id="root"></div>
<script>
window.__ModuleLoader__ = { load: ({ factory }) => { window.__client = factory((name) => (name === "react" ? React : ReactDOM)); } };
</script>
<script src="/client.js"></script>
<script>
const h = React.createElement;
window.__jumped = [];
function App() {
  const [names, setNames] = React.useState(true);
  const [revision, setRevision] = React.useState(0);
  const [drafts, setDrafts] = React.useState(false);
  // ?course=1 opens course mode (the big screen) over the page instead.
  if (new URLSearchParams(location.search).get("course") === "1") {
    return h(window.__client.CourseMode, {
      title: ${JSON.stringify(RUN)}, runId: ${JSON.stringify(RUN)}, sessionId: "", start: "2026-09-01", end: "2026-12-20",
      reload: revision, drafts, setDrafts, names, setNames, dark: false, covered: false,
      onClose: () => {}, onJump: (tab) => window.__jumped.push(tab), onPublish: () => {}, onUpload: () => {},
      onWrite: () => setRevision(revision + 1), openPublish: () => {}, ask: () => {},
      tabs: [{ id: "integrations", label: "Integrations", hint: "" }],
    });
  }
  return h(React.Fragment, null,
    ReactDOM.createPortal(h("button", { onClick: () => setNames(!names) }, names ? "Show codes" : "Show names"), document.getElementById("bar")),
    // What a sheet sync brought in: the notice over the pane and Gradebook's "Last added".
    h(window.__client.SheetNotice, { runId: ${JSON.stringify(RUN)}, sessionId: "", revision, onOpen: () => window.__jumped.push("gradebook"), onSync: () => window.__jumped.push("syncs") }),
    h(window.__client.RecentMarks, { runId: ${JSON.stringify(RUN)}, sessionId: "", revision, names }),
    h(window.__client.SyncsView,{ runId: ${JSON.stringify(RUN)}, sessionId: "", names, revision, onWrite: () => setRevision(revision + 1) }));
}
ReactDOM.createRoot(document.getElementById("root")).render(h(App));
</script></body></html>`;

const json = (res, value) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(page);
    }
    if (url.pathname === "/client.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(readFileSync(client));
    }
    if (url.pathname === "/professor-pane/api/syncs") return json(res, documentFor(url.searchParams.get("names") === "1"));
    if (url.pathname === "/professor-pane/api/marks-activity") return json(res, activityFor(url.searchParams.get("names") === "1"));
    // Google is not asked from here: the sheet is said to have changed ten minutes ago.
    if (url.pathname === "/professor-pane/api/sheet-check") {
      const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
      return json(res, {
        runId: RUN,
        available: true,
        checks: [{ sync: "hw-sheet", label: "Grade sheet you keep", state: "changed", modified: ago(10), last_synced: ago(12), last_saved: ago(30), checked_at: ago(0), said: "the sheet has changed since the last sync" }],
      });
    }
    // Course mode's header line reads Canvas's state from here; a stand-in.
    if (url.pathname === "/professor-pane/api/integrations") return json(res, { integrations: [{ id: "canvas", state: "ready" }] });
    // A dropped sheet is checked by the real `sync plan` and then thrown away:
    // the copy on disk is never replaced from here.
    if (url.pathname === "/professor-pane/api/syncs/copy") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      return json(res, await copyFromUpload(workspace, root, RUN, JSON.parse(raw || "{}"), { keep: false }));
    }
    if (url.pathname === "/professor-pane/api/syncs/action") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || "{}");
      if (body.action === "plan") return json(res, await runSyncAction(workspace, root, RUN, body));
      if (body.action === "confirm") {
        waiting = waiting.filter((row) => row.line !== body.line);
        return json(res, { ok: true, output: "(mock) confirmed" });
      }
      return json(res, { ok: true, output: `(mock) ${body.action} ${body.sync ?? ""} — nothing was written` });
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`syncs page on http://localhost:${PORT} for ${RUN}`));
