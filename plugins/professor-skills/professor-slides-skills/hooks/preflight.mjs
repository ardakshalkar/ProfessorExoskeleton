/**
 * Say at the start of the session what would otherwise fail at the first command.
 *
 * Installing a plugin does not run `npm install`, so a fresh install has no
 * `node_modules` and the first `pres source` dies on a module it cannot find —
 * which reads as "this plugin is broken" rather than "this plugin has a setup
 * step". That is the whole reason this file exists.
 *
 * It finds the plugin from its own location rather than from
 * `CLAUDE_PLUGIN_ROOT`, so it also works when the hook is run by hand or by
 * something that does not set that variable.
 *
 * Silence means everything needed is present. Anything printed goes to the
 * professor as session context, so it is written for them and not for a log:
 * what is wrong, and the command that fixes it.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nodeDirectory = join(pluginRoot, "node");

const notes = [];

// --- Node itself -----------------------------------------------------------
// Type stripping arrived behind a flag in 22.6 and became the default in 22.18.
// Anything older cannot run the CLI at all, and `major >= 22` is not the test:
// 22.0 through 22.5 pass it and still fail.
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  notes.push(
    `professor-slides-skills: this Node is ${process.versions.node}, and the plugin needs 22.6 ` +
    "or later to run its TypeScript (22.18 and later need no flag). Every `pres` command will " +
    "fail until a newer Node is on PATH.",
  );
}

// --- what `npm install` would have put there -------------------------------
// `yaml` is the only hard dependency: without it nothing can read a course.
if (!existsSync(join(nodeDirectory, "node_modules", "yaml"))) {
  notes.push(
    "professor-slides-skills: dependencies are not installed, so every `pres` command will fail " +
    "on the first import. One command fixes it:\n" +
    `    cd "${nodeDirectory}" && npm install`,
  );
} else {
  // These three are optional on purpose — reading and checking a course must
  // not require a Postgres driver or a native image library — so a missing one
  // is worth a sentence rather than a warning, and only about what it costs.
  const missing = ["pg", "pptxgenjs", "sharp"]
    .filter((name) => !existsSync(join(nodeDirectory, "node_modules", name)));
  if (missing.length) {
    const costs = {
      pg: "the Supabase route (YAML and flat-file courses still work)",
      pptxgenjs: "`pres render`",
      sharp: "`pres render`",
    };
    const affected = [...new Set(missing.map((name) => costs[name]))].join(" and ");
    notes.push(
      `professor-slides-skills: ${missing.join(", ")} did not install, so ${affected} is ` +
      `unavailable. Everything else works. To retry:\n    cd "${nodeDirectory}" && npm install ${missing.join(" ")}`,
    );
  }
}

if (notes.length) console.log(notes.join("\n\n"));
