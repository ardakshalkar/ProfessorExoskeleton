/**
 * The host half of the professor's visualization pane.
 *
 * It registers one prefix route and nothing else. Everything the pane draws
 * comes back through `/professor-pane/...`, and nearly everything behind that
 * route is a read: `callTool` from `dsh-ainar-course-model`, which is read-only
 * by construction, plus the preference and record files, read with
 * `readFileSync`.
 *
 * Four exceptions, and each one's own header argues for itself:
 *
 * * `/api/publish` spawns `ainar publish`. It publishes what the professor has
 *   accepted and names every record still marked `approval: draft` as left
 *   out; it accepts nothing on anybody's behalf. See `runPublish`.
 * * `/api/preferences` writes a preference layer. A preference is how the
 *   professor wants the skills to behave, not a claim about a student, so there
 *   is nothing in it for `approve` to gate.
 * * `/api/canvas/selection` writes `extensions.lms.canvas_sections` on the run
 *   record — which Canvas section feeds which subgroup. A fact about the
 *   professor's own LMS that no skill drafts and no agent can propose, and
 *   therefore one with no drafted half for `approve` to promote.
 * * `/api/canvas/catalogue` is the only outbound request in this plugin: two
 *   read-only Canvas endpoints, POST so that no link, prefetch or refresh can
 *   spend the professor's token.
 *
 * What is still true, and is the line worth keeping: **nothing here can accept
 * a draft, and nothing here can push a grade.** Accepting a record is changing
 * `approval: draft` in the file it lives in — or, for a grade, recording the
 * decision beside the AI suggestion — and the professor does that, not a route.
 *
 * Why HTTP rather than a service the browser half calls: four of the views this
 * pane switches between are already written. `dsh-ainar-course-model` ships
 * four widget documents — `course-outline`, `class-progress`, `gradebook`,
 * `action-inbox` — assembled from `widget-assets/`, and DSH renders none of
 * them. They are, in that plugin's own words, "inert, not broken".
 *
 * Not because DSH cannot render a tool's own view. It can: `dsh-client-ui-tool`
 * exposes a `tool.call.toolview` slot where the package owning a tool registers
 * a view for it by wire name. What DSH has no place for is the *metadata* —
 * `presentationMeta` is the MCP-app contract, and the render intents a tool may
 * return are a closed set (`generic`, `terminal`, `diff`, `search`, `read`,
 * `web`), none of which carries a document.
 *
 * So the native route exists and is the wrong shape for what we have. It wants
 * a component in the client runtime; we have four hundred lines of view code
 * already written against a plain HTML document, which the MCP hosts still
 * read. Serving each one as a document at a URL and pointing an iframe at it
 * keeps that copy the only one — the alternative is a second, in React, that a
 * professor would eventually see disagree with itself.
 *
 * This file is the plugin: `inject`, and `apply`, which registers the route and
 * holds dsh's services for it. The route table is `server/router.js`; the routes
 * are `server/routes/<area>.js`; what each assembles lives in `server/`, one
 * module per concern; the processes the write routes spawn are in
 * `server/actions.js`.
 *
 * RELOADING THE SERVER WITHOUT RESTARTING DSH
 * -------------------------------------------
 * dsh imports this file once. Node caches every module it imports by URL, so an
 * edit under `server/` used to need the whole harness restarted. Instead the
 * router is imported by URL with a generation number on it —
 * `server/router.js?pane-gen=3` — and a resolve hook (`module.registerHooks`)
 * hands that number down to everything it imports, ours and `@ainar/core`'s
 * TypeScript alike, but nothing under `node_modules`. A new number is therefore a
 * fresh copy of the whole graph. A watch on `server/` and on the core's `src/`
 * bumps the number on a save, and the next request imports the new graph.
 *
 * What a reload costs: the module-level caches under `server/` start empty
 * (they are caches — stores, revision hashes, a pending Google sign-in), and
 * each generation stays in memory, which is a development tool's price. If the
 * new graph does not load — a syntax error mid-edit — the old one keeps
 * answering and the error is logged; the next save tries again.
 * `PROFESSOR_PANE_RELOAD=0` turns all of it off and imports the router once.
 */

import { watch } from "node:fs";
import * as nodeModule from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The prefix is fixed for the life of the process, whatever generation of
// routes answers under it.
import { BASE } from "./server/http.js";
// Generation 0, imported as everything was before reloading existed, so the
// first request is answered synchronously like every other.
import * as firstRouter from "./server/router.js";

export const name = "professor-pane";

/**
 * The route registry, and the workspace registry.
 *
 * `workspaceRegistry` is how a request naming a session turns into a directory
 * on disk WITHOUT a path ever crossing from the browser: the pane sends the
 * session id it already has, and this side asks dsh which workspace accounts
 * for it. A `workspace=<path>` parameter would have been fewer lines and a
 * standing invitation to read any directory on the machine by crafting one
 * request — the routes here open YAML and print it, so the parameter would be
 * the read primitive. A session id resolves only to a folder the professor
 * registered in the sidebar, and to nothing else.
 */
export const inject = ["webServer", "workspaceRegistry"];

const ROUTER = new URL("./server/router.js", import.meta.url);
const GEN = "pane-gen";
const RELOAD = process.env.PROFESSOR_PANE_RELOAD !== "0" && typeof nodeModule.registerHooks === "function";

/** Once per process: carry `?pane-gen=N` from a parent module to what it imports. */
let hooked = false;
const hookGenerations = () => {
  if (hooked) return;
  hooked = true;
  nodeModule.registerHooks({
    resolve(specifier, context, next) {
      const resolved = next(specifier, context);
      const parent = context.parentURL;
      if (!parent || !parent.includes(`${GEN}=`)) return resolved;
      if (!resolved.url.startsWith("file:") || resolved.url.includes("/node_modules/")) return resolved;
      const generation = new URL(parent).searchParams.get(GEN);
      const url = new URL(resolved.url);
      url.searchParams.set(GEN, generation);
      return { ...resolved, url: url.href };
    },
  });
};

/**
 * The router, as the current generation of files makes it. Without reloading,
 * generation 0 for the life of the process.
 *
 * `now()` is the router when it is up to date, so a request is handled
 * synchronously — a route attaches its body listeners in the same turn, as it
 * always has. Only the first request after a save waits, for `latest()`; a
 * real request stream holds its body until a listener is attached.
 */
const routerSource = (logger) => {
  // To dsh's log and to the terminal the harness runs in, where whoever saved
  // the file is looking: dsh's logger does not print there.
  const say = (level, text) => {
    logger?.[level]?.(text);
    (level === "info" ? console.log : console.warn)(text);
  };
  let generation = 0;
  let wanted = 0;
  let current = firstRouter;
  let loading = null;

  const now = () => (wanted === generation ? current : null);

  const latest = () => {
    if (wanted === generation) return Promise.resolve(current);
    if (loading) return loading;
    const next = wanted;
    loading = import(`${ROUTER.href}?${GEN}=${next}`).then(
      (router) => {
        generation = next;
        current = router;
        loading = null;
        say("info", `professor-pane: server reloaded (generation ${next})`);
        return router;
      },
      (error) => {
        // Mid-edit: keep answering with what loaded last; the next save retries.
        generation = next;
        loading = null;
        say("warn", `professor-pane: reload failed, still serving the last good server: ${error?.stack ?? error}`);
        return current;
      },
    );
    return loading;
  };

  /** Watch our server code and the core's source; a save asks for a new generation. */
  const watchSources = () => {
    if (!RELOAD) return () => {};
    hookGenerations();
    const roots = [fileURLToPath(new URL("./server/", import.meta.url))];
    try {
      roots.push(dirname(fileURLToPath(import.meta.resolve("@ainar/core/src/profile.ts"))));
    } catch {
      // The core resolves wherever the routes do; without it there is nothing to watch.
    }
    let timer = null;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        wanted += 1;
      }, 150);
      timer.unref?.();
    };
    const watchers = [];
    for (const root of roots) {
      try {
        const watcher = watch(root, { recursive: true }, (_event, file) => {
          if (file && /\.(m?js|ts)$/.test(String(file))) bump();
        });
        watcher.unref?.();
        watchers.push(watcher);
      } catch (error) {
        say("warn", `professor-pane: cannot watch ${root}: ${error?.message ?? error}`);
      }
    }
    return () => {
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
    };
  };

  return { now, latest, watchSources };
};

/**
 * Cordis waits for `webServer` before calling this, so the route is live from
 * the moment the fiber activates and the disposer the registry returns is what
 * makes an unload actually unload.
 */
export function apply(ctx) {
  /**
   * The credential seam, if this composition has one.
   *
   * A holder rather than a direct `ctx.credentials`, because reading a service
   * that is not in `inject` throws — and putting `credentials` in `inject`
   * would make the WHOLE pane fail to activate wherever no provider is
   * mounted. Losing the outline, the inbox and the class list because nobody
   * can type a Canvas token is the wrong trade, so the dependency is a nested
   * fiber: it fills the holder while a provider is live and empties it when
   * one goes away, and the routes check.
   *
   * This cordis has no `inject: { optional }` form — every key in the object
   * shape is required — which is why the nested fiber is the idiom here rather
   * than a declaration.
   */
  const credentials = { service: null };
  ctx.inject(["credentials"], (scoped) => {
    credentials.service = scoped.credentials;
    scoped.on("dispose", () => {
      credentials.service = null;
    });
  });

  /*
   * The session's own model, for the hands-free desk (AGT-2): `llm` to call
   * it, `sessions` to read which provider and model a session is talking to,
   * and `agentDefaultModel` for a session that has not made a request yet.
   * Optional by the same nested-fiber idiom as `credentials`, one each, so a
   * composition without one loses only the choosing — the desk then falls
   * back to the next prepared question — never the pane.
   */
  const harness = { llm: null, sessions: null, defaults: null };
  for (const [key, service] of [["llm", "llm"], ["sessions", "sessions"], ["defaults", "agentDefaultModel"]]) {
    ctx.inject([service], (scoped) => {
      harness[key] = scoped[service];
      scoped.on("dispose", () => {
        harness[key] = null;
      });
    });
  }

  const services = { registry: ctx.workspaceRegistry, credentials, harness };
  const source = routerSource(ctx.logger);

  ctx.effect(source.watchSources, "professor-pane: reload the server on a save");
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: BASE,
        handler: (req, res) => {
          const router = source.now();
          if (router) return router.handle(req, res, services);
          return source.latest().then((next) => next.handle(req, res, services));
        },
      }),
    "professor-pane: the /professor-pane route",
  );
}
