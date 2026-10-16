// Course mode's Planning reading alone, in a browser, with its drag writing.
//
//   set AINAR_WORKSPACE=<a COPY of a course workspace — this writes dates>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/planning-page.mjs RUN   # then open http://localhost:3095
//
// The page goes in a sandboxed frame as `srcdoc`, the way the pane frames it,
// and this parent stands in for the pane: a `dates` message is written into
// the record by the same `writeAssessmentDates`, and the newer page swapped
// into the open frame, as the pane does (`window.swaps` counts the answers).

import http from "node:http";

import { courseModeDocument } from "../server/course-mode.js";
import { readBody } from "../server/http.js";
import { planLocks, writeAssessmentDates, writeTopicMoves } from "../server/plan-writes.js";
import { loadedRun, resolveWorkspace, viewPayload } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3095);
const RUN = process.argv[2] ?? "CSS-4008-2026-FALL";

const PARENT = `<!doctype html><meta charset="utf-8"><title>Planning</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<iframe sandbox="allow-scripts allow-popups"></iframe>
<script>
var frame=document.querySelector('iframe'),first=true;window.swaps=0;
addEventListener('message',function(e){if(e.source===frame.contentWindow&&e.data&&e.data.kind==='swapped')window.swaps+=1;});
function load(){fetch('/doc'+location.search).then(function(r){return r.text();}).then(function(t){
  if(first){first=false;frame.srcdoc=t;}else frame.contentWindow.postMessage({source:'professor-pane',kind:'swap',html:t},'*');});}
addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane'||(d.kind!=='dates'&&d.kind!=='topic'))return;
  fetch('/'+(d.kind==='topic'?'topic':'dates'),{method:'POST',body:JSON.stringify(d)}).then(function(r){return r.json();})
    .then(function(r){window.lastWrite=r;if(r.error)alert(r.error);load();});});
load();
</script>`;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const { workspace, root } = resolveWorkspace({ list: () => [] }, "");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(PARENT);
    }
    if (url.pathname === "/doc") {
      const data = viewPayload(workspace, "course_outline", RUN, url.searchParams.get("date"), true).payload;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      const locks = { results: [...planLocks(loadedRun(workspace, RUN).bundle, RUN).results] };
      return res.end(courseModeDocument(data, { dark: url.searchParams.get("dark") === "1", mode: "planning", student: false, locks }));
    }
    if (url.pathname === "/dates" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(writeAssessmentDates(workspace, root, RUN, body)));
    }
    if (url.pathname === "/topic" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(writeTopicMoves(workspace, root, RUN, body)));
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`Planning for ${RUN} on http://localhost:${PORT}`));
