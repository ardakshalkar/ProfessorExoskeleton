#!/usr/bin/env node

/**
 * The one place that knows how to get TypeScript to run.
 *
 * `pres.ts` is the actual CLI. Node has stripped types from `.ts` files without
 * a flag since 22.18, needed `--experimental-strip-types` from 22.6 to 22.17,
 * and cannot do it at all before that. Three different invocations, and every
 * caller that hard-codes one of them is wrong on somebody's machine.
 *
 * So everything goes through here: the `bin/pres` and `bin/pres.cmd` shims the
 * plugin puts on PATH, and the `pres` binary npm creates from `package.json`'s
 * `bin` field. That second route is what makes the CLI installable without the
 * plugin at all:
 *
 *     cd node && npm link      # or: npm install -g .
 *     pres source --course CSS-4008
 *
 * On a Node that already strips types the script is imported in process, which
 * costs nothing. On an older one it is re-run in a child with the flag, and the
 * child's exit code and signal are passed back out — a CLI that swallowed a
 * non-zero exit would make `pres check` useless in a script.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./pres.ts", import.meta.url));

if (process.features.typescript) {
  // `pres.ts` runs on import: it is a script, not a module with an export.
  await import(new URL("./pres.ts", import.meta.url).href);
} else {
  const result = spawnSync(
    process.execPath,
    // Only the experimental notice is silenced. A broad `--no-warnings` would
    // also hide things worth seeing — the driver's TLS notices, above all.
    ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", entry, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  if (result.error) {
    const version = process.versions.node;
    console.error(
      `pres: this Node (${version}) cannot run TypeScript.\n` +
      "Node 22.6 or later is required; 22.18 and later need no flag at all.\n" +
      String(result.error.message ?? result.error),
    );
    process.exit(127);
  }
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(result.status ?? 0);
}
