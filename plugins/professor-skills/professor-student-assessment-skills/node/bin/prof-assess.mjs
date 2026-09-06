#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./prof-assess.ts", import.meta.url));
if (process.features.typescript) {
  await import(new URL("./prof-assess.ts", import.meta.url).href);
} else {
  const result = spawnSync(process.execPath, [
    "--disable-warning=ExperimentalWarning",
    "--experimental-strip-types",
    entry,
    ...process.argv.slice(2),
  ], { stdio: "inherit" });
  if (result.error) {
    console.error(`prof-assess: Node 22.6 or later is required. ${result.error.message}`);
    process.exit(127);
  }
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(result.status ?? 0);
}
