// Students · Forks alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   set AINAR_SUBMISSIONS_DIR=<where `homework forks --activity` wrote>   (optional)
//   node --experimental-strip-types plugins/dsh-professor-pane/test/forks-page.mjs RUN   # then open http://localhost:3094
//
// The same server function the pane frames. `?assessment=ASSESSMENT-…`
// picks the homework, `?names=1` shows names. The page's presses post to a
// parent that is not here, so they only show they were pressed.

import http from "node:http";

import { forksDocument } from "../server/forks-view.js";
import { resolveWorkspace } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3094);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/") {
      res.writeHead(404);
      return res.end();
    }
    const assessment = url.searchParams.get("assessment");
    const body = forksDocument(workspace, root, RUN, assessment, url.searchParams.get("dark") === "1", url.searchParams.get("names") === "1");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  })
  .listen(PORT, () => console.log(`forks page on http://localhost:${PORT} for ${RUN}`));
