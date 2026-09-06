/**
 * A DeepSeek Harness plugin, small enough to read in one sitting.
 *
 * Five exports are the whole contract, and every plugin in
 * `node_modules/@deepseek-ai/` has the same shape:
 *
 *   name      what the loader calls this fiber in logs and in the audit
 *   inject    services it cannot start without — cordis waits for them
 *   Config    the schema for its loader row's `config:`, validated at mount
 *   apply     the body: register things, and return nothing
 *
 * Plus one file beside this one: `cordis.patch.yml`, named by `dsh.bundle.patch`
 * in `package.json`. That is what turns an installed package into a mounted
 * plugin; without it nothing here ever runs, however correct it is.
 *
 * What this registers:
 *
 *   two tools           `sample_ping`, `sample_read_stats` — see lib/tools.js
 *   one HTTP route      GET /sample/health, only where a web server exists
 *
 * Read-only throughout. Neither tool writes, and the route is a read. That is
 * a property of what is registered rather than of this file, which is why this
 * file does not try to enforce it.
 */

// `defineTool` is a MODULE EXPORT of the host's tool package, not a method on
// `ctx.tools`. Reading it off the registry throws `defineTool is not a
// function` while applying — and a plugin that fails to apply fails the whole
// tree, so the harness does not come up at all rather than coming up without
// this plugin.
//
// The host is not a dependency of this package: both imports resolve at runtime
// from wherever dsh installed the bundle. See `package.json`'s comments.
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";

import { sampleTools } from "./lib/tools.js";

/** What the loader calls this fiber. Matches the `id` in `cordis.patch.yml`. */
export const name = "sample";

/**
 * Services this plugin cannot start without.
 *
 * `tools` only. `webServer` is deliberately NOT listed even though the route
 * below needs it: a plugin that statically injects a service its deployment
 * does not compose never activates, and this sample is meant to mount in a
 * headless profile too. The route waits for the server on its own, inside
 * `apply`, which is the same thing `@deepseek-ai/dsh-agent-tool-presentation`
 * does with `codeRuntime` for exactly this reason.
 */
export const inject = ["tools"];

/**
 * The schema for this plugin's loader row.
 *
 * Every field has a default, so `config:` may be omitted entirely — which is
 * what `cordis.patch.yml` does. A profile that wants other values patches the
 * row by `id`; see `.dsh/profiles/sample/cordis.patch.yml`.
 *
 * Validated at mount, and a violation is a boot failure naming this row rather
 * than an undefined reaching a tool three calls later.
 */
export const Config = z.object({
  greeting: z.string().default("dsh-sample is mounted."),
  maxBytes: z.natural().default(1048576),
  route: z.boolean().default(true),
});

/** Where the route lives, if it lives at all. */
const BASE = "/sample";

/**
 * The one route: `GET /sample/health`.
 *
 * `startedAt` is a parameter rather than a module constant because it means
 * "since this mount activated", and a module constant would mean "since Node
 * imported this file" — the same number until a reload, and then quietly wrong.
 *
 * A prefix route hands over `req.url` whole, not the remainder after the
 * prefix, so the path is sliced here. A collision inside that prefix is a typo
 * in this file rather than the composition-level contract `webServer.register`
 * is protecting, which is why one prefix is registered instead of one exact
 * route per path.
 */
const health = (config, names, startedAt) => (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname.slice(BASE.length) || "/";
  if (path !== "/health") {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `no route ${path} under ${BASE}` }));
    return;
  }
  // A read has one method. Saying so costs three lines and keeps the route from
  // quietly answering a POST as though it had done something with the body.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      "content-type": "application/json; charset=utf-8",
      allow: "GET, HEAD",
    });
    res.end(JSON.stringify({ error: `${req.method} is not allowed on ${BASE}${path}` }));
    return;
  }
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    // Nothing here should be answered from a cache: the whole point of asking
    // is to learn the state the harness is in right now.
    "cache-control": "no-store",
  });
  res.end(
    JSON.stringify({
      ok: true,
      plugin: "dsh-sample",
      tools: names,
      greeting: config.greeting,
      maxBytes: config.maxBytes,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    }),
  );
};

/**
 * Mount everything, and leave behind a way to unmount it.
 *
 * Cordis has already waited for `tools` by the time this is called, so nothing
 * here sequences its own boot. Two disposal rules are worth knowing, and this
 * function relies on both:
 *
 *   `ctx.tools.register` returns a disposer attached to THIS fiber, so a
 *   reload or an unload takes the tools with it — nothing to clean up by hand.
 *
 *   `ctx.effect` is for a resource whose lifetime the plugin owns, like a
 *   registered route. Its callback returns the undo, and the string is what an
 *   audit prints when it says what this fiber is holding.
 *
 * @param ctx this mount's context, scoped to this fiber
 * @param config the loader row's `config:`, already through `Config`
 */
export function apply(ctx, config) {
  const startedAt = Date.now();
  const tools = sampleTools(defineTool, config);
  for (const tool of tools) ctx.tools.register(tool);

  if (!config.route) return;

  // The optional half. `ctx.inject` runs the callback if and when `webServer`
  // becomes available and unwinds it if the server goes away, so a headless
  // profile mounts the tools and simply never gets a route — inert, not broken.
  ctx.inject(["webServer"], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: "prefix",
          path: BASE,
          handler: health(
            config,
            tools.map((tool) => tool.name),
            startedAt,
          ),
        }),
      "sample: the /sample/health route",
    );
  });
}
