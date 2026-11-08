// Students · Forks alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   set AINAR_SUBMISSIONS_DIR=<where `homework forks --activity` wrote>   (optional)
//   set AINAR_ROSTER_DIR=<a COPY of ~/.ainar/roster>                       (Match writes here)
//   node --experimental-strip-types plugins/dsh-professor-pane/test/forks-page.mjs RUN   # then open http://localhost:3094
//
// The page is framed the way the pane frames it, and the frame's presses are
// answered here: Match writes the roster store under AINAR_ROSTER_DIR — point
// it at a copy — and the homework buttons switch the frame. Analyze is not
// run here. `?assessment=ASSESSMENT-…` picks the homework, `?names=1` shows
// names.

import http from "node:http";

import { forksDocument, matchAccounts } from "../server/forks-view.js";
import { readBody } from "../server/http.js";
import { resolveWorkspace, rosterDir } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3094);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");

const host = (query) =>
  '<!doctype html><meta charset="utf-8"><title>Forks</title>' +
  "<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>" +
  '<iframe id="f" sandbox="allow-scripts allow-popups"></iframe><script>' +
  "var f=document.getElementById('f'),q=new URLSearchParams(" + JSON.stringify(query) + ");" +
  "function load(){fetch('/doc?'+q).then(function(r){return r.text()}).then(function(t){f.srcdoc=t;});}load();" +
  "addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane')return;" +
  "if(d.kind==='forks-pick'){q.set('assessment',d.assessment);load();}" +
  "if(d.kind==='fork-match'&&d.pairs){fetch('/match',{method:'POST',body:JSON.stringify({pairs:d.pairs})}).then(function(r){return r.json()})" +
  ".then(function(a){a.source='professor-pane';a.kind='fork-matched';a.ticket=d.ticket;e.source.postMessage(a,'*');});}});" +
  "</script>";

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(host(url.search));
    }
    // `/solo`: the page unframed, answering its own presses — for a browser
    // that cannot click into a sandboxed frame.
    if (url.pathname === "/doc" || url.pathname === "/solo") {
      const solo =
        url.pathname !== "/solo"
          ? ""
          : "<script>addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane')return;" +
            "if(d.kind==='forks-pick'){var u=new URL(location.href);u.searchParams.set('assessment',d.assessment);location.href=u;}" +
            "if(d.kind==='fork-match'&&d.pairs){fetch('/match',{method:'POST',body:JSON.stringify({pairs:d.pairs})}).then(function(r){return r.json()})" +
            ".then(function(a){a.source='professor-pane';a.kind='fork-matched';a.ticket=d.ticket;postMessage(a,'*');});}});</script>";
      const body = solo + forksDocument(
        workspace,
        root,
        RUN,
        url.searchParams.get("assessment"),
        url.searchParams.get("dark") === "1",
        url.searchParams.get("names") === "1",
      );
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(body);
    }
    if (url.pathname === "/match" && req.method === "POST") {
      return readBody(req).then((text) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(matchAccounts(rosterDir(), JSON.parse(text).pairs ?? [])));
      });
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => console.log(`forks page on http://localhost:${PORT} for ${RUN}, roster at ${rosterDir()}`));
