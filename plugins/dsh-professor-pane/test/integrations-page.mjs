// Integrations alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/integrations-page.mjs RUN [--ready] [--waiting]
//   # then open http://localhost:3094 (or ?course=1 for course mode over it)
//
// Every read is the workspace's own, from the same server functions the pane
// uses: what the run is wired to, its marks, its syncs. Preview of a sync runs
// the real `ainar sync plan`, which writes nothing. Every other press — a Save,
// a Run, a Send, a Confirm, anything that would reach Canvas, Google or GitHub
// — is answered from memory with "(mock)", so looking at the tab never changes
// a course, the record, the link table or what students see. Credential
// presence is read from this process's environment only; no store is mounted.
//
//   --ready    draw Canvas as reachable (a stand-in in AINAR_CANVAS_TOKEN)
//   --waiting  five made-up rows the grade sheet was not sure of, with
//              made-up names, so the review list can be looked at without
//              putting a real student's name on a screen

import http from "node:http";
import { readFileSync } from "node:fs";

import { Ledger } from "@ainar/core/src/lms/ledger.ts";

import { integrationsAnswer } from "../server/integrations.js";
import { runSyncAction, syncsDocument } from "../server/syncs.js";
import { unpublishedDocument } from "../server/unpublished.js";
import { loadedRun, resolveWorkspace } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3094);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const client = new URL("../lib/client.js", import.meta.url);
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");
// Safe only because every Canvas route below is answered from memory —
// nothing on this page sends the stand-in anywhere.
if (process.argv.includes("--ready")) process.env.AINAR_CANVAS_TOKEN = "test-page-stand-in";

// ---- made-up review rows -------------------------------------------------

const students = [
  { student: "STUDENT-AAAA01", name: "Ostanin Artem" },
  { student: "STUDENT-AAAA02", name: "Nurlanova Aigerim" },
  { student: "STUDENT-AAAA03", name: "Nurlanova Aruzhan" },
  { student: "STUDENT-AAAA04", name: "Serikbayev Dauren" },
  { student: "STUDENT-AAAA05", name: "Abenova Zhanel" },
];
const named = (student) => students.find((entry) => entry.student === student);
let waiting = process.argv.includes("--waiting")
  ? [
      { line: 7, written: "Ostanin Artym", why: "a close spelling", candidates: ["STUDENT-AAAA01"] },
      { line: 12, written: "Aigerim", why: "only one word", candidates: ["STUDENT-AAAA02"] },
      { line: 18, written: "Serikbaev Dauren", why: "a close spelling", candidates: ["STUDENT-AAAA04"] },
      { line: 23, written: "A. Nurlanova", why: "the name matches no enrolled student closely enough", candidates: ["STUDENT-AAAA02", "STUDENT-AAAA03"] },
      { line: 31, written: "Zhanel", why: "only one word", candidates: ["STUDENT-AAAA05"] },
    ]
  : [];

const NEIGHBOURS = ["Akhmetov Ruslan", "Bekova Dana", "Ivanova Maria", "Kassymov Timur", "Li Wei", "Omarova Saule"];
const previewFor = (row, names, index) => {
  const marks = (seed) => [0, 1, 2, 3, 4].map((column) => ["T", "LT", "", "LLT"][(seed + column) % 4]);
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

const syncsFor = (names) => {
  const real = syncsDocument(workspace, RUN, { names: false });
  if (!waiting.length) return real;
  const sheet = real.syncs.find((sync) => sync.service === "sheets");
  if (!sheet) return real;
  const rows = waiting.map((row, index) => ({
    sync: sheet.id,
    source: sheet.label,
    preview: previewFor(row, names, index),
    key: "name:" + row.written.toLowerCase(),
    line: row.line,
    written: names ? row.written : null,
    why: row.why,
    candidates: row.candidates.map((student, rank) => ({ student, name: names ? named(student).name : null, match: rank ? "near" : "close" })),
  }));
  return {
    ...real,
    names,
    waiting: rows,
    students: students.map((entry) => ({ student: entry.student, name: names ? entry.name : null })),
    syncs: real.syncs.map((sync) => (sync.id === sheet.id ? { ...sync, waiting: rows.length } : sync)),
  };
};

// ---- the page ------------------------------------------------------------

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>Integrations — test page</title>
<style>body{font:13px system-ui;margin:0;background:#f4f4f6}#root{max-width:var(--w,420px);margin:24px auto;background:#fff;
border:1px solid #e3e3e6;border-radius:12px;padding:14px 16px}#bar{max-width:420px;margin:16px auto 0;display:flex;gap:8px}</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
</head><body><div id="bar"></div><div id="root"></div>
<script>
window.__ModuleLoader__ = { load: ({ factory }) => { window.__client = factory((name) => (name === "react" ? React : ReactDOM)); } };
</script>
<script src="/client.js"></script>
<script>
const h = React.createElement;
window.__asked = [];
const RUN = ${JSON.stringify(RUN)};
function App() {
  const [revision, setRevision] = React.useState(0);
  const [sub, setSub] = React.useState("course");
  // Remounted on a button press, because the view reads subView only once.
  const [mount, setMount] = React.useState(0);
  const [names, setNames] = React.useState(true);
  const [drafts, setDrafts] = React.useState(false);
  const [focus, setFocus] = React.useState({ service: null, tick: 0 });
  const onWrite = () => setRevision((value) => value + 1);
  if (new URLSearchParams(location.search).get("course") === "1") {
    return h(window.__client.CourseMode, {
      title: RUN, runId: RUN, sessionId: "", start: "2026-09-01", end: "2026-12-20",
      reload: revision, drafts, setDrafts, names, setNames, dark: false, covered: false,
      onClose: () => {}, onPublish: () => {}, onUpload: () => {},
      onWrite, openPublish: () => {}, ask: (text) => window.__asked.push(text),
      courseId: "", term: "", integrationsFocus: focus,
    });
  }
  return h(React.Fragment, null,
    ReactDOM.createPortal([
      ...["course", "accounts"].map((id) => h("button", { key: id, onClick: () => { setSub(id); setMount((value) => value + 1); } }, id)),
      h("button", { key: "names", onClick: () => setNames(!names) }, names ? "Show codes" : "Show names"),
      h("button", { key: "focus", onClick: () => { setSub("course"); setFocus((value) => ({ service: "sheets", tick: value.tick + 1 })); } }, "Jump to sheet"),
    ], document.getElementById("bar")),
    h(window.__client.Integrations, {
      runId: RUN, sessionId: "", subView: sub, revision, names, focus, key: "m" + mount,
      ask: (text) => window.__asked.push(text),
      onWrite,
    }));
}
ReactDOM.createRoot(document.getElementById("root")).render(h(App));
</script></body></html>`;

const json = (res, value) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};

const answer = () => integrationsAnswer(workspace, root, RUN, { service: null });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.replace(/^\/professor-pane/, "");
    try {
      if (path === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(page);
      }
      if (path === "/client.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(readFileSync(client));
      }
      if (path === "/api/integrations") return json(res, await answer());
      if (path === "/api/syncs") return json(res, syncsFor(url.searchParams.get("names") === "1"));
      if (path === "/api/unpublished") {
        return json(res, unpublishedDocument({ bundle: loadedRun(workspace, RUN).bundle, runId: RUN, root, ledger: Ledger.load(RUN) }));
      }
      // Google is not asked from here: the sheet is said to have changed ten minutes ago.
      if (path === "/api/sheet-check") {
        const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
        const sheet = syncsDocument(workspace, RUN, { names: false }).syncs.find((sync) => sync.service === "sheets");
        return json(res, {
          runId: RUN,
          available: Boolean(sheet),
          checks: sheet
            ? [{ sync: sheet.id, state: "changed", modified: ago(10), last_synced: ago(12), checked_at: ago(0), said: "the sheet has changed since the last sync" }]
            : [],
        });
      }
      if (path === "/api/marks-activity") return json(res, { runId: RUN, names: false, events: [] });
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || "{}");
        // A write answered as if it had worked, with the record as it is.
        if (["/api/canvas/assignment-map", "/api/canvas/course-map", "/api/canvas/selection", "/api/integrations/setup", "/api/credentials"].includes(path)) {
          return json(res, await answer());
        }
        if (path === "/api/canvas/assignments") {
          return json(res, {
            courseId: body.courseId,
            assignments: [
              { id: "900001", name: "Quiz 4 - on Week 5", points: 5 },
              { id: "900002", name: "Homework 4", points: 4 },
            ],
          });
        }
        if (path === "/api/canvas/marks") {
          return json(res, {
            confirmed: body.confirm === true,
            groups: [{ group: null, courseId: "0", ok: true, unlinked: false, output: "(mock) marks " + (body.confirm ? "sent" : "planned") + " for " + body.assessment }],
          });
        }
        if (path === "/api/syncs/action") {
          // The real plan, which writes nothing; everything else from memory.
          if (body.action === "plan") return json(res, await runSyncAction(workspace, root, RUN, body));
          if (body.action === "confirm") {
            waiting = waiting.filter((row) => row.line !== body.line);
            return json(res, { ok: true, output: "(mock) confirmed" });
          }
          return json(res, { ok: true, output: `(mock) ${body.action} ${body.sync ?? ""} — nothing was written` });
        }
        return json(res, { ok: true, output: "(mock) " + path + " " + JSON.stringify(body) + " — nothing was sent" });
      }
    } catch (error) {
      return json(res, { error: String(error?.message ?? error) });
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`integrations page on http://localhost:${PORT} for ${RUN}`));
