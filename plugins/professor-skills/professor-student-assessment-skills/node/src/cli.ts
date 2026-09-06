import { resolve } from "node:path";
import { auditBatch, checkEvaluations, officialSummaries } from "./assessment.ts";
import { evaluationsFrom, readRubric, readStdin } from "./io.ts";

const usage = `Usage:
  producer | prof-assess check --rubric rubric.json [--confidence 0.8]
  producer | prof-assess summary --rubric rubric.json
  producer | prof-assess audit --rubric rubric.json [--confidence 0.8]

Evaluation input is restricted data: provide it on stdin and do not redirect
identified output into a course repository.`;

function parseArgs(argv: string[]) {
  const command = argv[0] ?? "help";
  const values = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`invalid arguments\n${usage}`);
    values.set(flag.slice(2), value);
  }
  return { command, values };
}

function confidence(values: Map<string, string>): number {
  const parsed = Number(values.get("confidence") ?? "0.8");
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error("--confidence must be between 0 and 1");
  return parsed;
}

export async function runCli(argv: string[]): Promise<void> {
  const { command, values } = parseArgs(argv);
  if (["help", "--help", "-h"].includes(command)) { console.log(usage); return; }
  if (!["check", "summary", "audit"].includes(command)) throw new Error(`unknown command ${command}\n${usage}`);
  const rubricPath = values.get("rubric");
  if (!rubricPath) throw new Error(`--rubric is required\n${usage}`);
  const rubric = await readRubric(resolve(rubricPath));
  const evaluations = evaluationsFrom(await readStdin());
  if (command === "check") {
    const issues = checkEvaluations(rubric, evaluations, confidence(values));
    console.log(JSON.stringify({ valid: !issues.some((issue) => issue.severity === "error"), issues }, null, 2));
    if (issues.some((issue) => issue.severity === "error")) process.exitCode = 2;
  } else if (command === "summary") {
    console.log(JSON.stringify({ basis: "stamped professor decisions only", submissions: officialSummaries(rubric, evaluations) }, null, 2));
  } else {
    console.log(JSON.stringify(auditBatch(rubric, evaluations, confidence(values)), null, 2));
  }
}
