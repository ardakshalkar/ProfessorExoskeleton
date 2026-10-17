/**
 * The route table, and the one request handler that reads it.
 *
 * Every route lives in `server/routes/<area>.js` as an entry of its `routes`
 * array: the keys it answers to and a `handle(c)`. A key is one of
 *
 * * `paths` — exact paths under `/professor-pane`,
 * * `prefixes` — any path starting with one of these,
 * * `views` — `/view/<name>`, the documents a frame is pointed at,
 * * `widgets` — every `/view/<name>` in `VIEWS` not claimed by `views`: the
 *   course model's own widget documents.
 *
 * `early: true` answers before the workspace is resolved, for the routes a
 * session cannot reach (`routes/public.js` says why each). Everything else
 * runs with the request's workspace, inside the try that turns a throw into
 * the answer: a page for a `/view/`, JSON for a `fetch`.
 *
 * `c`, what every `handle` gets:
 *   req, res      the request and response
 *   url, path     the parsed URL, and its path under BASE
 *   runId, view   `?run=`, and the name after `/view/` (else null)
 *   fail(text)    the failure in the shape this path answers in
 *   workspace, root   the session's course workspace (not for `early` routes)
 *   registry, credentials, harness   dsh's services, as `apply` holds them
 *
 * A path matched twice is a mistake, and the table refuses to build.
 *
 * In development `index.js` re-imports this module, and everything it imports,
 * whenever a file under `server/` or `ainar-node/src/` changes — see
 * `index.js`. So nothing here may hold state that must outlive a save.
 */

import { useWorkspaceProfile } from "@ainar/core/src/profile.ts";
import { ToolError } from "@ainar/core/src/workspace.ts";

import { BASE, sendErrorPage, sendJson } from "./http.js";
import { resolveWorkspace, VIEWS } from "./workspace.js";
import { routes as canvas } from "./routes/canvas.js";
import { routes as core } from "./routes/core.js";
import { routes as course } from "./routes/course.js";
import { routes as defence } from "./routes/defence.js";
import { routes as files } from "./routes/files.js";
import { routes as grade } from "./routes/grade.js";
import { routes as grading } from "./routes/grading.js";
import { routes as integrations } from "./routes/integrations.js";
import { routes as materials } from "./routes/materials.js";
import { routes as plan } from "./routes/plan.js";
import { routes as preferences } from "./routes/preferences.js";
import { routes as publicRoutes } from "./routes/public.js";
import { routes as publish } from "./routes/publish.js";
import { routes as records } from "./routes/records.js";
import { routes as scans } from "./routes/scans.js";
import { routes as syncs } from "./routes/syncs.js";
import { routes as views } from "./routes/views.js";

export const ROUTES = [
  ...publicRoutes,
  ...core,
  ...course,
  ...defence,
  ...files,
  ...scans,
  ...grade,
  ...preferences,
  ...syncs,
  ...integrations,
  ...canvas,
  ...plan,
  ...records,
  ...grading,
  ...materials,
  ...publish,
  ...views,
];

/** The table, indexed: exact paths and views by name, prefixes in order. */
const index = (routes) => {
  const exact = new Map();
  const byView = new Map();
  const prefixes = [];
  const claim = (map, key, route, what) => {
    if (map.has(key)) throw new Error(`${what} ${key} is answered by two routes`);
    map.set(key, route);
  };
  for (const route of routes) {
    for (const path of route.paths ?? []) claim(exact, path, route, "path");
    for (const view of route.views ?? []) claim(byView, view, route, "view");
    for (const prefix of route.prefixes ?? []) prefixes.push([prefix, route]);
  }
  // Widgets last, so a view with its own route keeps it.
  for (const route of routes.filter((r) => r.widgets)) {
    for (const view of Object.keys(VIEWS)) if (!byView.has(view)) byView.set(view, route);
  }
  return { exact, byView, prefixes };
};

const TABLE = index(ROUTES);

/** The route for a path, or null. */
export const routeFor = (path) => {
  if (TABLE.exact.has(path)) return TABLE.exact.get(path);
  if (path.startsWith("/view/")) return TABLE.byView.get(path.slice("/view/".length)) ?? null;
  for (const [prefix, route] of TABLE.prefixes) if (path.startsWith(prefix)) return route;
  return null;
};

/** One request, as dsh's prefix route hands it over. */
export const handle = (req, res, { registry, credentials, harness }) => {
  let url;
  try {
    url = new URL(req.url ?? "/", "http://localhost");
  } catch {
    return sendJson(res, 400, { error: "unreadable request URL" });
  }
  const path = url.pathname.slice(BASE.length) || "/";
  const runId = url.searchParams.get("run") ?? "";
  // Which shape a failure takes on this path, decided once: a `/view/` request
  // is an iframe's and gets a page, everything else is a `fetch` and gets JSON.
  const view = path.startsWith("/view/") ? path.slice("/view/".length) : null;
  const fail = (text) =>
    view === null ? sendJson(res, 200, { error: text }) : sendErrorPage(res, text);
  const c = { req, res, url, path, runId, view, fail, registry, credentials, harness };

  const route = routeFor(path);
  if (route?.early) return route.handle(c);

  let resolved;
  try {
    // The session the pane is mounted in. `details` is a session-scoped slot, so
    // the browser half always has one; a request without it is still answered,
    // from AINAR_WORKSPACE, because the route is reachable outside the pane.
    resolved = resolveWorkspace(registry, url.searchParams.get("session") ?? "");
  } catch (error) {
    // 200 with the sentence, not 4xx: this is the answer to the pane's
    // question and the pane draws it as prose. A status code would make the
    // browser half decide between "the harness is misconfigured" and "the
    // route is gone", which it cannot tell apart and should not have to.
    return fail(String(error.message ?? error));
  }
  c.workspace = resolved.workspace;
  c.root = resolved.root;
  // This workspace's profile for everything the request reads (timezone,
  // grading shapes, marks); the pane serves several workspaces, so per request.
  useWorkspaceProfile({ root: c.root });

  try {
    if (!route) return sendJson(res, 404, { error: `no route ${path} under ${BASE}` });
    return route.handle(c);
  } catch (error) {
    if (error instanceof ToolError) return fail(error.message);
    // An unexpected throw is a bug in a route or in the loader, and the
    // message is the only thing that will get it fixed. It reaches one
    // professor's own browser on one loopback port; there is nobody to leak to.
    return fail(String((error && error.message) || error));
  }
};
