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

import { runSyncAction, syncsDocument } from "../server/syncs.js";
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

const documentFor = (names) => {
  const real = syncsDocument(workspace, RUN, { names: false });
  const rows = waiting.map((row) => ({
    sync: "hw-sheet",
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
function App() {
  const [names, setNames] = React.useState(true);
  const [revision, setRevision] = React.useState(0);
  return h(React.Fragment, null,
    ReactDOM.createPortal(h("button", { onClick: () => setNames(!names) }, names ? "Show codes" : "Show names"), document.getElementById("bar")),
    h(window.__client.SyncsView, { runId: ${JSON.stringify(RUN)}, sessionId: "", names, revision, onWrite: () => setRevision(revision + 1) }));
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
