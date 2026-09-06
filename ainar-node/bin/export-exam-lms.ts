#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exporterFor, validateLmsExam, type LmsExportTarget } from "../src/lms-export.ts";

function parse(argv: string[]): { input: string; output: string; target: LmsExportTarget } {
  if (argv.includes("--publish")) throw new Error("Live publication is intentionally disabled. Export a file, review it, and import it manually in the LMS.");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(usage());
    values.set(key.slice(2), value);
  }
  const input = values.get("input");
  const output = values.get("output");
  const rawTarget = values.get("target");
  const target = rawTarget === "moodle" ? "moodle-xml" : rawTarget === "canvas" ? "canvas-qti" : rawTarget;
  if (!input || !output || (target !== "moodle-xml" && target !== "canvas-qti" && target !== "qti-1.2")) throw new Error(usage());
  return { input: resolve(input), output: resolve(output), target };
}

function usage(): string {
  return "Usage: export-exam-lms.ts --input exam.json --target moodle|canvas|qti-1.2 --output package.xml|package.zip";
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  const exam = validateLmsExam(JSON.parse(await readFile(options.input, "utf8")));
  const exporter = exporterFor(options.target);
  if (!options.output.toLowerCase().endsWith(exporter.extension)) throw new Error(`${options.target} output must end in ${exporter.extension}`);
  const artifact = exporter.export(exam);
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, artifact.data);
  process.stdout.write(`${options.output}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
