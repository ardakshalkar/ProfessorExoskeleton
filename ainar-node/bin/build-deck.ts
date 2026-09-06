#!/usr/bin/env node

/**
 * Run a hand-built deck script.
 *
 *     bin/deck-build <script.ts> [--out DIR]
 *
 * The seven CSS-4007 decks are not rendered from markdown — each week is a
 * script that draws its slides by coordinate. The Python originals did
 * `from deck_kit import …`, a sibling file in the same directory. A TypeScript
 * script in a course workspace has no sibling to import: the kit lives in this
 * checkout and the script lives in the professor's course folder, and neither
 * knows where the other is.
 *
 * So the script imports nothing. It default-exports a function, this hands it
 * the kit, and the path problem disappears — which also means a deck script is
 * readable as what it is, a page of layout with no plumbing at the top.
 *
 *     export const OUTPUT = "MODULE-DRAFT-05-….pptx";
 *     export default function build({ deck, C, W, H }) { … }
 *
 * `--out` defaults to the script's own directory, which is where the Python
 * scripts wrote and where the course record expects the file.
 */

import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { C, Deck, H, W } from "../src/deck-kit.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const script = args.find((value) => !value.startsWith("--") && /\.(ts|mjs|js)$/.test(value));
if (!script) {
  console.error("usage: deck-build <script.ts> [--out DIR]");
  process.exit(1);
}

const scriptPath = isAbsolute(script) ? script : resolve(script);
const module_ = await import(pathToFileURL(scriptPath).href);
const build = module_.default;
if (typeof build !== "function") {
  console.error(`${script} has no default export to call. It should export a build function.`);
  process.exit(1);
}

const output: string = module_.OUTPUT ?? "deck.pptx";
const outDir = resolve(flag("out") ?? dirname(scriptPath));
const deck = new Deck();

build({ deck, C, W, H });

const file = resolve(outDir, output);
await deck.write(file);
console.log(`wrote ${file}  slides: ${deck.pres.slides?.length ?? "?"}`);
