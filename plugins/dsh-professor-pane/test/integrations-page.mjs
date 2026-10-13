// Integrations alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/integrations-page.mjs RUN
//   # then open http://localhost:3094
//
// Every read is the workspace's own, from the same server functions the pane
// uses: what the run is wired to, its marks, its syncs. Nothing here writes
// and nothing reaches Canvas: a Save, a Preview or a Send is answered from
// memory with "(mock)", so looking at the card never changes a course, the
// record, or what students see. Credential presence is read from this
// process's environment only — no store is mounted.

import http from "node:http";
import { readFileSync } from "node:fs";

import { Ledger } from "@ainar/core/src/lms/ledger.ts";

import { integrationsAnswer } from "../server/integrations.js";
import { syncsDocument } from "../server/syncs.js";
import { unpublishedDocument } from "../server/unpublished.js";
import { loadedRun, resolveWorkspace } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3094);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const client = new URL("../lib/client.js", import.meta.url);
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");
// `--ready` draws Canvas as reachable: a stand-in in the variable presence is
// read from. Safe only because every Canvas route below is answered from
// memory — nothing on this page sends it anywhere.
if (process.argv.includes("--ready")) process.env.AINAR_CANVAS_TOKEN = "test-page-stand-in";

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
window.__opened = [];
function App() {
  const [revision, setRevision] = React.useState(0);
  const [sub, setSub] = React.useState("course");
  return h(React.Fragment, null,
    ReactDOM.createPortal(["course", "credentials"].map((id) => h("button", { key: id, onClick: () => setSub(id) }, id)), document.getElementById("bar")),
    h(window.__client.Integrations, {
      runId: ${JSON.stringify(RUN)}, sessionId: "", subView: sub, revision, names: false,
      ask: (text) => window.__asked.push(text),
      openSyncs: () => window.__opened.push("syncs"),
      onWrite: () => setRevision((value) => value + 1),
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
      if (path === "/api/syncs") return json(res, syncsDocument(workspace, RUN, { names: false }));
      if (path === "/api/unpublished") {
        return json(res, unpublishedDocument({ bundle: loadedRun(workspace, RUN).bundle, runId: RUN, root, ledger: Ledger.load(RUN) }));
      }
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || "{}");
        // A write answered as if it had worked, with the record as it is.
        if (["/api/canvas/assignment-map", "/api/canvas/course-map", "/api/canvas/selection", "/api/integrations/setup"].includes(path)) {
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
          return json(res, { confirmed: body.confirm === true, groups: [{ group: null, courseId: "0", ok: true, unlinked: false, output: "(mock) marks " + (body.confirm ? "sent" : "planned") + " for " + body.assessment }] });
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
