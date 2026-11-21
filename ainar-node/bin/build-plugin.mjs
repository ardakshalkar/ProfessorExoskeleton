/**
 * `npm run build:plugin` — bundle the CLI and the MCP server into the
 * `ainar-core` plugin (BACKLOG E41, PLG-2).
 *
 * Output, all under `plugins/ainar-core/`:
 *
 *   dist/ainar.mjs        the CLI, plain JavaScript, Node >= 20, no npm install
 *   dist/ainar-mcp.mjs    the stdio MCP server
 *   dist/sql/schema.sql   read by sqlgen next to the bundle
 *   dist/share/           what `installRoot()` finds in a plugin
 *                           vendor/datalayer, vendor/ainar/mcp/widget-assets, profiles
 *
 * External on purpose: `pptxgenjs` and `sharp` (native, deck rendering is out of
 * v1) and `pg` (loaded by `createRequire`, only for the PostgreSQL mirror).
 */

import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const node = resolve(here, "..");
const repo = resolve(node, "..");
const out = join(repo, "plugins", "ainar-core", "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Bundled ESM still needs `require` for the few CJS packages that call it.
const banner = {
  js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
};

await build({
  entryPoints: {
    ainar: join(node, "bin", "ainar.ts"),
    "ainar-mcp": join(node, "bin", "server.ts"),
  },
  outdir: out,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pptxgenjs", "sharp", "pg", "pg-native"],
  banner,
  logLevel: "info",
});

cpSync(join(node, "src", "sql"), join(out, "sql"), { recursive: true });

const share = join(out, "share");
for (const path of [
  ["vendor", "datalayer"],
  ["vendor", "ainar", "mcp", "widget-assets"],
  ["profiles"],
]) {
  cpSync(join(repo, ...path), join(share, ...path), { recursive: true });
}
console.log(`built ${out}`);
