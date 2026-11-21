/**
 * Where the files that ship with AINAR live — the one seam between "a checkout
 * of this repository" and "a bundle inside a plugin" (BACKLOG E41, PLG-1).
 *
 * Four places used to compute the repository by `resolve(here, "..", "..")`:
 * the profile defaults and institution packs, the skill templates, the widget
 * assets and the deck renderer's `node_modules`. In a plugin there is no
 * repository, only the bundle's `share/` folder, so they all ask here.
 *
 * `installRoot()` returns, first match wins:
 *
 *   1. `$AINAR_INSTALL_ROOT`, when set (tests, unusual layouts);
 *   2. the repository, when this file sits in `ainar-node/src/` of a checkout;
 *   3. a `share/` folder beside the bundle (`dist/share` or `dist/../share`).
 *
 * "Is it a checkout" is answered by `vendor/datalayer` existing, the same
 * directory the defaults are read from, so a layout that passes the test is one
 * the code can run in.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MARKER = join("vendor", "datalayer");

let cached: string | undefined;

const candidates = (): string[] => {
  const named = (process.env.AINAR_INSTALL_ROOT ?? "").trim();
  return [
    ...(named ? [resolve(named)] : []),
    resolve(HERE, "..", ".."),
    resolve(HERE, "share"),
    resolve(HERE, "..", "share"),
  ];
};

/** The root all shipped files resolve from. Throws, naming every place tried. */
export function installRoot(): string {
  if (cached && !process.env.AINAR_INSTALL_ROOT) return cached;
  const list = candidates();
  for (const root of list) {
    if (existsSync(join(root, MARKER))) {
      cached = root;
      return root;
    }
  }
  throw new Error(
    `cannot find the AINAR install root (no ${MARKER} in any of):\n` +
      list.map((path) => `  ${path}`).join("\n") +
      "\nSet AINAR_INSTALL_ROOT to the repository or the plugin's share/ folder.",
  );
}

/** A path under the install root. */
export const installPath = (...parts: string[]): string => join(installRoot(), ...parts);

/**
 * Where optional native dependencies (`pptxgenjs`, `sharp`) are looked for first:
 * `ainar-node/node_modules` in a checkout, `share/node_modules` in a plugin.
 */
export function dependencyRoot(): string {
  const checkout = installPath("ainar-node", "node_modules");
  return existsSync(checkout) ? checkout : installPath("node_modules");
}
