#!/usr/bin/env node
/**
 * Patches applied to shipped `@deepseek-ai` packages after every install.
 *
 * Run by `postinstall`, so an `npm install` — which rewrites node_modules and
 * would otherwise silently revert these — reapplies them. Idempotent: running
 * it twice is a no-op, and it says so.
 *
 * Every patch here is a FORK of somebody else's bundle, with the cost that
 * implies: dsh is pinned at an exact version in package.json precisely so these
 * cannot drift under us unnoticed, and each patch below fails LOUDLY if the text
 * it expects is gone. That failure is the point. A patch that quietly matched
 * nothing would leave the harness running stock behaviour while this file
 * claimed otherwise, and the symptom would surface as "the pane stopped
 * appearing" days later with nothing to connect it to an upgrade.
 *
 * Adding a patch here should feel expensive. Prefer configuration, then a
 * plugin, then a slot registration; reach for this only when the behaviour is
 * hard-coded in a bundle, as the details-column session gate is.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The details column, available before a session exists.
 *
 * `ui-layout`'s AppFrame derives the column's width from `detailsSession`, and
 * stock it resolves to `undefined` unless the current session is non-blank:
 *
 *     return current !== void 0 && s.byId[current]?.blank === false ? current : void 0;
 *
 * A blank session is what the start screen is. So stock dsh forces the column
 * to zero width there, and the professor's course pane — which has real course
 * data to show and needs no session to fetch it — is unreachable until somebody
 * sends a message. That is the gate this drops.
 *
 * What is deliberately NOT changed: the slot stays `scope: "session"` in the
 * AppFrame children table, so the pane is still handed a session id and still
 * re-renders per session. The blank session on the start screen has an id like
 * any other; it simply has no turns in it yet. The pane already resolves its
 * workspace without one (see its `resolveWorkspace`), which is why this is a
 * one-condition change rather than a rework.
 */
const detailsWithoutSession = {
  package: "@deepseek-ai/dsh-client-ui-layout",
  file: "lib/client.js",
  find:
    "const detailsSession = useSessions((s) => {\n" +
    "\t\t\t\tconst current = s.current;\n" +
    "\t\t\t\treturn current !== void 0 && s.byId[current]?.blank === false ? current : void 0;\n" +
    "\t\t\t});",
  replace:
    "const detailsSession = useSessions((s) => {\n" +
    "\t\t\t\tconst current = s.current;\n" +
    "\t\t\t\t/* PATCHED (patches/apply.mjs): the `blank === false` gate is dropped, so\n" +
    "\t\t\t\t   the details column is available on the start screen too. */\n" +
    "\t\t\t\treturn current !== void 0 ? current : void 0;\n" +
    "\t\t\t});",
  // How to recognise our own work, so a second run is a no-op rather than a
  // failure to find the original text.
  marker: "PATCHED (patches/apply.mjs)",
  note: "details column no longer needs a session",
};

/*
 * The served index.html's <title> used to be patched here, and is not any more.
 *
 * It moved to `plugins/dsh-professor-brand/` on 2026-09-17, as a
 * `ctx.webServer.tapIndex` transform. The webserver documents that hook as "the
 * escape hatch for markup no IndexInjection row expresses", `renderIndex`
 * applies it to every index response, and `dsh-host-frontend-static` routes
 * every index response through `renderIndex` — so this was a supported
 * extension point the whole time, reached through a plugin, which is exactly
 * the order of preference the note at the top of this file asks for.
 *
 * The replacement is also better than what it replaced: a tap can match
 * `<title>` by pattern, where a patch has to match the shipped string exactly
 * and breaks on any upstream retitling.
 *
 * It did NOT remove the need for `sessionBrowserTitle` below. That one is a
 * constant inside a React component the renderer mounts itself, and no hook
 * reaches it.
 */

/**
 * The browser tab's title once a session is open.
 *
 * The `tapIndex` transform in `dsh-professor-brand` covers the document the
 * server sends, which is what the tab reads until React mounts. It is not the
 * whole story: `ui-renderer`'s `DocumentTitle` then takes the tab over for the
 * rest of the session's life and composes it from its OWN hardcoded constant —
 *
 *     const productTitle = "DeepSeek Harness";
 *     document.title = title === void 0 ? productTitle : `${title} — ${productTitle}`;
 *
 * — so patching only the served HTML left the tab reading "Professor's
 * Exoskeleton" on the start screen and "<session title> — DeepSeek Harness"
 * the moment a conversation was open. That is the state in which anybody
 * actually uses the thing, and it is the state a screenshot catches.
 *
 * Both halves are needed, and neither is redundant: this constant is also the
 * title restored on unmount, while the served HTML is what shows before any of
 * this JavaScript has run. Only this half has to be a patch.
 */
const sessionBrowserTitle = {
  package: "@deepseek-ai/dsh-client-ui-renderer",
  file: "lib/client.js",
  find: 'const productTitle = "DeepSeek Harness";',
  replace:
    '/* PATCHED (patches/apply.mjs) */ const productTitle = "Professor\'s Exoskeleton";',
  marker: "PATCHED (patches/apply.mjs)",
  note: "session tab titles carry this host's name, not DeepSeek's",
};

const PATCHES = [detailsWithoutSession, sessionBrowserTitle];

let changed = 0;
let already = 0;

for (const patch of PATCHES) {
  const path = join(root, "node_modules", patch.package, patch.file);
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    console.error(`patches: ${patch.package} is not installed — nothing to patch.`);
    console.error("  This is fine before the first `npm install` and a problem after one.");
    continue;
  }

  if (source.includes(patch.marker)) {
    console.log(`patches: ${patch.package} already patched`);
    already += 1;
    continue;
  }

  if (!source.includes(patch.find)) {
    console.error(`patches: ${patch.package} — the text this patch expects is GONE.`);
    console.error("  The bundle changed under the patch, so the behaviour it provides is");
    console.error("  not in effect. Re-derive it against the new source before trusting");
    console.error("  anything that depends on it. Looked for:\n");
    console.error(patch.find.split("\n").map((line) => `    ${line}`).join("\n"));
    process.exitCode = 1;
    continue;
  }

  writeFileSync(path, source.replace(patch.find, patch.replace), "utf8");
  console.log(`patches: ${patch.package} patched — ${patch.note}`);
  changed += 1;
}

console.log(`patches: ${changed} applied, ${already} already in place, ${PATCHES.length} total`);
