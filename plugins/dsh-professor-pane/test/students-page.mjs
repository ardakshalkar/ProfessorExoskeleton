// The Students view alone, in a browser.
//
//   set AINAR_WORKSPACE=<a course workspace>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/students-page.mjs RUN   # then open http://localhost:3093
//
// The same server function the pane frames, over the workspace's own run.
// Pseudonyms unless the address carries ?names=1, for the reason the pane
// opts in per request: a screen that might be shared shows codes by default.

import http from "node:http";

import { defenceReader, forksReader } from "../server/defence-desk.js";
import { scanStandings } from "../server/scans.js";
import { studentsDocument } from "../server/students.js";
import { resolveWorkspace, rosterDir } from "../server/workspace.js";

const PORT = Number(process.env.PORT ?? 3093);
const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/") {
      res.writeHead(404);
      return res.end();
    }
    const body = studentsDocument(
      workspace,
      RUN,
      url.searchParams.get("dark") === "1",
      url.searchParams.get("names") === "1",
      `http://localhost:${PORT}`,
      "",
      defenceReader(root, RUN),
      // Read per request: `ainar homework forks` run beside this shows on reload.
      forksReader(root, RUN),
      (bundle) => scanStandings(bundle, RUN, root, rosterDir()),
    );
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  })
  .listen(PORT, () => console.log(`students page on http://localhost:${PORT} for ${RUN}`));
