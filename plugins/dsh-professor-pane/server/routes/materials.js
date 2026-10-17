/**
 * Routes: materials. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { sendBrief, sendMaterial, sendOutline, sendStarter } from "../serve-file.js";

export const routes = [
  {
    paths: ["/file"],
    handle(c) {
      const { res, url, workspace, root } = c;
      return sendMaterial(
        res,
        workspace,
        root,
        url.searchParams.get("doc") ?? "",
        url.searchParams.get("dark") === "1",
        // Affirmative only, like `names=1` on the inbox: a URL replayed without
        // it serves the file itself, which is what every caller got before.
        url.searchParams.get("as") === "pdf",
        // A picture the document names by a path relative to itself — a deck's
        // `figures/fig-01.svg`. Carried with the session so the image request
        // resolves the same workspace the page did.
        url.searchParams.get("asset") ?? "",
        url.searchParams.get("session") ?? "",
      );
    },
  },
  // What was read out of a deck, for a deck this course did not write.
  {
    paths: ["/outline"],
    handle(c) {
      const { res, url, workspace, root } = c;
      return sendOutline(
        res,
        workspace,
        root,
        url.searchParams.get("doc") ?? "",
        url.searchParams.get("dark") === "1",
      );
    },
  },
  // The brief a piece of graded work carries as text rather than as a file.
  // Beside `/file` because it ends in the same overlay and obeys the same
  // rule: addressed by an identifier the course record already names.
  {
    paths: ["/brief"],
    handle(c) {
      const { res, url, runId, workspace, root } = c;
      return sendBrief(
        res,
        workspace,
        root,
        runId,
        url.searchParams.get("assessment") ?? "",
        url.searchParams.get("drafts") === "1",
        url.searchParams.get("dark") === "1",
      );
    },
  },
  // A homework's starter README, for work that names no brief document.
  {
    paths: ["/starter"],
    handle(c) {
      const { res, url, runId, workspace, root } = c;
      return sendStarter(
        res,
        workspace,
        root,
        runId,
        url.searchParams.get("assessment") ?? "",
        url.searchParams.get("drafts") === "1",
        url.searchParams.get("dark") === "1",
      );
    },
  },
];
