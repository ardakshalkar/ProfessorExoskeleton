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
 *
 * ## There is no slot to do this with instead. Checked on 2026-09-17.
 *
 * `ui-layout`'s README says AppFrame "declares `sidebar`, `conversation`,
 * `details`, and `conversation.empty`". The fourth one does not exist. The
 * bundle in that same package, at the same 0.1.1-rc.2 this project pins,
 * declares:
 *
 *     sidebar         single  root
 *     conversation    single  session-maybe
 *     details         single  session
 *     shell.overlay   list    root
 *
 * and `conversation.empty` appears in no shipped bundle at all. It is a bug in
 * their README, and it is a convincing one — a start-screen slot in the
 * conversation column is exactly what this patch would otherwise not need.
 *
 * Every seat that needs no session, across layout and conversation both:
 *
 *     sidebar                        single   taken by the sidebar
 *     conversation.hero.brand.mark   single   taken by dsh-professor-brand
 *     conversation.hero.workspace    single   taken by the workspace picker
 *     conversation.hero.agentPreset  single   taken by the preset chooser
 *     shell.overlay                  list     free
 *
 * The only free one is the wrong shape: AppFrame renders `shell.overlay` into
 * `<div className={overlayLayer} data-shell-overlay>`, a floating layer over the
 * three columns rather than a column. The other four are `single` and taking one
 * evicts something a professor uses.
 *
 * Nor can the column be opened from `ctx.layout`. The gate sits ABOVE the
 * geometry — `computeColumns(..., detailsSession === void 0 ? 0 : panels.details)`
 * zeroes the width whatever the store holds — so there is no action to call.
 *
 * So this stays a patch until a shipped version grows a root-scoped seat in the
 * conversation column. Re-checking costs a look at that declaration table; the
 * README is not evidence.
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

/**
 * The sandbox's private temp directory, re-made when it has disappeared.
 *
 * On Windows, `sandbox-local` gives each session one private temp directory
 * (`%TEMP%\dsh-XXXXXX`, ACL-granted to the confined token) and caches it for the
 * life of the process:
 *
 *     const existing = this.tempCapabilities.get(key);
 *     if (existing !== void 0) return existing;
 *
 * Nothing checks that the directory is still there. On 2026-10-18 it was gone
 * after a night idle — what deleted it is still unknown — and from then on
 * EVERY confined command failed with `windows-acl-run: --temp is not an
 * existing directory`, until the harness was restarted. The model read that as
 * "the sandbox is broken" and asked for full access on every command, hours
 * after the restart had fixed it (traced in session-704e6afd).
 *
 * The fix is the obvious one: a cached capability whose directory is missing
 * has its grant disposed and is dropped, and the code below it makes a fresh
 * directory and grant exactly as it does for a session's first command. There
 * is no setting for this and no hook in front of it — the cache is a private
 * field of the provider — so it is a patch.
 */
const sandboxTempRecreated = {
  package: "@deepseek-ai/dsh-sandbox-local",
  file: "lib/index.js",
  find:
    "\t\tconst existing = this.tempCapabilities.get(key);\n" +
    "\t\tif (existing !== void 0) return existing;\n",
  replace:
    "\t\tconst existing = this.tempCapabilities.get(key);\n" +
    "\t\t/* PATCHED (patches/apply.mjs: sandbox temp): a cached temp directory that\n" +
    "\t\t   has been deleted is dropped and made again below, instead of failing\n" +
    "\t\t   every confined command until a restart. */\n" +
    "\t\tif (existing !== void 0 && !existsSync(existing.dir)) {\n" +
    "\t\t\tthis.tempCapabilities.delete(key);\n" +
    "\t\t\ttry {\n" +
    "\t\t\t\texisting.grant.dispose();\n" +
    "\t\t\t} catch (error) {\n" +
    "\t\t\t\tthis.ctx.logger.warn(error);\n" +
    "\t\t\t}\n" +
    "\t\t\tthis.ctx.logger.warn(`sandbox-local: temp directory ${existing.dir} was deleted; making a new one`);\n" +
    "\t\t} else if (existing !== void 0) return existing;\n",
  marker: "PATCHED (patches/apply.mjs: sandbox temp)",
  note: "a deleted sandbox temp directory is made again instead of failing every command",
};

const PATCHES = [detailsWithoutSession, sessionBrowserTitle, sandboxTempRecreated];

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
