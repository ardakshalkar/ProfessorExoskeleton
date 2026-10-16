/**
 * Routes answered before the workspace is resolved: `early` in the table.
 * Each says why it cannot wait for a session.
 */

import { readFileSync } from "node:fs";

import { DOTS_BUNDLE } from "../actions.js";
import { registryConnections } from "../integrations.js";
import { disconnect, finishSignIn, startSignIn } from "../google.js";
import { send, sendErrorPage, sendJson } from "../http.js";

export const routes = [
  // Connect Google, ahead of the workspace: Google's redirect back cannot carry
  // the session id, and a connection is the machine's, not a course's. See
  // server/google.js.
  {
    early: true,
    paths: ["/api/google/start"],
    handle: ({ req, res }) => startSignIn(req, res),
  },
  {
    early: true,
    paths: ["/api/google/callback"],
    handle: ({ url, res, credentials }) =>
      finishSignIn(url, res, credentials).catch((error) => sendErrorPage(res, String(error?.message ?? error))),
  },
  {
    early: true,
    paths: ["/api/google/disconnect"],
    handle: ({ req, res, credentials }) => {
      if (req.method !== "POST") return sendJson(res, 405, { error: "disconnecting Google is POST only" });
      return disconnect(res, credentials, registryConnections()).catch((error) =>
        sendJson(res, 200, { error: String(error?.message ?? error) }),
      );
    },
  },
  // The dots animation on the defence desk: `dots-swarm` (MIT), bundled once
  // into vendor/ by vendor/build-dots.mjs. A script with no data in it, and
  // ahead of the workspace for that reason: a `<script src>` carries no
  // session, and behind the check it got the "no course workspace" JSON
  // instead — the desk's circle drew empty.
  {
    early: true,
    paths: ["/vendor/dots-swarm.js"],
    handle: ({ res }) => {
      try {
        return send(res, 200, "text/javascript; charset=utf-8", readFileSync(DOTS_BUNDLE));
      } catch {
        return send(res, 404, "text/plain; charset=utf-8", "the dots bundle is not built");
      }
    },
  },
];
