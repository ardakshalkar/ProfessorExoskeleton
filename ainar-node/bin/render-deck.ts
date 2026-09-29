#!/usr/bin/env node

/**
 * `render-deck` is now `ainar deck render --document`.
 *
 *     node --experimental-strip-types bin/render-deck.ts \
 *       --course-version CSS-4008-2026-FALL --document DOC-4410 --pdf
 *
 * This was a second renderer, with its own layout, fonts and output folder,
 * and nothing in the pipeline called it — every deck the course recorded was
 * built by the slide engine that is now `src/slides/`. Merged on 2026-09-29.
 * What this one had that the engine lacked went with it: the refusal to render
 * a draft Document, the refusal of a `storage_key` that is not markdown, figure
 * credits read off Document records, and the PDF conversion that checks the
 * exit code (`src/pdf.ts`).
 *
 * Kept as a shim for one release, because `bin/deck` and a skill or two still
 * say its name. The flags are the same; the output is not — a recorded deck
 * renders beside its markdown in the course now, rather than to
 * `output/<RUN>/<DOC>.pptx`. Pass `--out` for the old place.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ainar = fileURLToPath(new URL("./ainar.ts", import.meta.url));
const args = process.argv.slice(2);
console.warn("render-deck is `ainar deck render --document`; running that.\n");
const result = spawnSync(
  process.execPath,
  ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", ainar, "deck", "render", ...args],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(String(result.error.message ?? result.error));
  process.exit(1);
}
process.exit(result.status ?? 1);
