#!/usr/bin/env node

/**
 * Turn an assessment into a printable paper, straight from the record.
 *
 * The work is `printPaper` in `src/exam-paper.ts`, which `ainar paper render`
 * calls too; this is the original command line, kept so nothing that names it
 * breaks. It renders in process — no child, no pipe — so it runs inside a DSH
 * session under `workspace-write` without asking to escalate.
 *
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --root <workspace>
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --format pdf --out output/
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --no-register
 */

import { printPaper, type AnswerLayout, type PaperFormat } from "../src/exam-paper.ts";

const USAGE =
  "Usage: exam-paper.ts --assessment ID [--root DIR] [--out DIR]\n" +
  "                    [--format docx|pdf|both] [--answers under-question|separate-sheet]\n" +
  "                    [--variant V] [--doc-id DOC-XXX] [--no-register]";

const parse = (argv: string[]): Record<string, string> => {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(USAGE);
    values[key.slice(2)] = value;
  }
  return values;
};

try {
  // Lifted out before the pairs are read: `parse` takes `--key value` two at a
  // time, so a switch with no value would swallow the next flag as its own.
  const argv = process.argv.slice(2);
  const args = parse(argv.filter((one) => one !== "--no-register"));
  if (!args.assessment) throw new Error(USAGE);
  const report = await printPaper({
    assessmentId: args.assessment,
    root: args.root ?? process.cwd(),
    rootSource: args.root ? "flag" : "cwd",
    format: (args.format ?? "both") as PaperFormat | "both",
    answers: (args.answers ?? "under-question") as AnswerLayout,
    out: args.out ?? null,
    docId: args["doc-id"] ?? null,
    register: !argv.includes("--no-register"),
    variant: args.variant ?? null,
  });
  for (const line of report.warnings) process.stderr.write(line + "\n");
  process.stdout.write(report.lines.join("\n") + "\n");
} catch (error) {
  process.stderr.write(String((error as Error).message ?? error) + "\n");
  process.exit(1);
}
