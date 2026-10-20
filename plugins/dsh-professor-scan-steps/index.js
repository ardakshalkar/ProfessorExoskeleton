/**
 * The deterministic scan steps as one harness tool, run outside the sandbox.
 *
 * Every step after a pile is identified writes the private submissions folder
 * (`~/.ainar/submissions/`): `scans file` moves the PDF, `plan` writes
 * `plan.yaml`, `names` writes the plan and renders covers, `apply` splits the
 * pile. The assistant's sandbox cannot write there, and DSH has no setting that
 * would let it, so each of those commands needed its own approval. On
 * 2026-10-20 that stopped a Midterm 1 pile at the first step: `scans file` was
 * refused with EPERM, the escalated retry was refused too, and the professor
 * was asked to restart the harness with full access (session-704e6afd, turn 9).
 *
 * None of these steps is judgement — which exam a pile is was the professor's
 * answer, and the CLI does the rest exactly — so they belong where the pane's
 * own scan buttons already run them: in the harness's process, by spawning this
 * checkout's `ainar`. This tool is that, offered to the assistant. It runs the
 * named step and nothing else; the arguments are checked before anything is
 * spawned, and an id or a file name that is not one is refused.
 *
 * What stays out on purpose: `scans assign` (who a paper is, the professor's
 * call, made in the pane's Scans tab), and `read`/`record` (the pane's Read &
 * record button, which has the long timeout and the progress). `identify`
 * already runs in the sandbox.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { workspaceRootFor } from "@ainar/core/src/workspace.ts";

export const name = "professor-scan-steps";
export const inject = ["tools"];

/** This checkout's TypeScript CLI, by path: a Python `ainar` on PATH is a different implementation. */
export const AINAR_CLI = fileURLToPath(new URL("../../ainar-node/bin/ainar.ts", import.meta.url));

export const STEPS = ["status", "file", "plan", "names", "apply"];

const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const PDF = /^[\w.-]+\.pdf$/i;

/**
 * The `ainar` arguments for one call, or an Error saying what is wrong.
 * Exported for the tests: this is the whole of what the tool lets through.
 */
export function stepArgs(args) {
  const step = String(args?.step ?? "");
  if (!STEPS.includes(step)) return new Error(`step is one of ${STEPS.join(", ")}, not "${step}"`);
  const run = String(args?.run ?? "");
  const assessment = String(args?.assessment ?? "");
  if (!ID.test(run)) return new Error(`"${run}" is not a run id`);
  if (!ID.test(assessment) || !assessment.startsWith("ASSESSMENT-")) return new Error(`"${assessment}" is not an assessment id`);
  const out = ["scans", step, run];
  if (step === "file") {
    const file = String(args?.file ?? "");
    if (!PDF.test(file)) return new Error(`file names one PDF in the run's _inbox, like scan-92d32fb5e5.pdf — not "${file}"`);
    out.push(file);
  }
  out.push("--assessment", assessment);
  if (step === "plan") {
    if (args?.per_file === true && args?.pages_per_student !== undefined) return new Error("per_file or pages_per_student, not both");
    if (args?.per_file === true) out.push("--per-file");
    if (args?.pages_per_student !== undefined) {
      const pages = Number(args.pages_per_student);
      if (!Number.isInteger(pages) || pages < 1 || pages > 100) return new Error("pages_per_student is a whole number of pages, 1 to 100");
      out.push("--pages-per-student", String(pages));
    }
  }
  if (step === "names" && args?.force === true) out.push("--force");
  if (step === "apply" && args?.replace === true) out.push("--replace");
  if ((step === "names" || step === "apply") && args?.dry_run === true) out.push("--dry-run");
  return out;
}

const run = (args, root) =>
  new Promise((resolveRun) => {
    if (!existsSync(AINAR_CLI)) {
      resolveRun({ ok: false, exitCode: null, command: "", output: `The TypeScript ainar CLI is not at ${AINAR_CLI}.` });
      return;
    }
    execFile(
      process.execPath,
      ["--experimental-strip-types", AINAR_CLI, ...args, "--root", root],
      // `names` reads every cover with a model; a big pile takes minutes.
      { cwd: root, timeout: 900000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        const output = [stdout, stderr]
          .filter(Boolean)
          .join("\n")
          .split("\n")
          .filter((line) => !/NO_COLOR|trace-warnings|ExperimentalWarning/.test(line))
          .join("\n")
          .trim();
        resolveRun({ ok: exitCode === 0, exitCode, command: `bin/ainar ${args.join(" ")}`, output });
      },
    );
  });

const DESCRIPTION =
  "Run one deterministic step of the scanned-exam pipeline — `ainar scans <step>` — in the harness's own " +
  "process, which can write the private submissions folder (~/.ainar/submissions) that your sandbox cannot. " +
  "Use this instead of running `bin/ainar scans file|plan|names|apply` in the shell: those are refused there " +
  "and need an approval each. Steps: status (where the pile stands); file (move FILE from the run's unfiled " +
  "_inbox under the assessment — only after the professor has said which assessment it is); plan (list the " +
  "inbox PDFs and propose the split: per_file, or pages_per_student N, or neither for uneven papers); names " +
  "(read who wrote each paper off its cover into the plan, with a vision model); apply (split and match to the " +
  "roster; dry_run first). Editing plan.yaml by hand is still yours. Saying who a paper is (`scans assign`) is " +
  "the professor's, in the pane's Scans tab, and reading the answers is the pane's Read & record button.";

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "scan_pile",
      description: DESCRIPTION,
      parameters: {
        step: { type: "string", enum: STEPS, required: true, description: "Which `ainar scans` step to run." },
        run: { type: "string", required: true, description: "The course run, e.g. CSS-4007-2026-FALL." },
        assessment: { type: "string", required: true, description: "The assessment the pile is (or is being filed under), e.g. ASSESSMENT-MIDTERM-1." },
        file: { type: "string", description: "step=file: the PDF's name in the run's _inbox, as `scans identify` listed it." },
        per_file: { type: "boolean", description: "step=plan: one PDF per student." },
        pages_per_student: { type: "integer", description: "step=plan: one batch, every paper this many pages (count both sides of a duplex scan)." },
        force: { type: "boolean", description: "step=names: read again the papers already named but not placed." },
        replace: { type: "boolean", description: "step=apply: use a rescan for a student who already has one." },
        dry_run: { type: "boolean", description: "step=names or apply: say what would happen, change nothing." },
      },
      output: {
        schema: { type: "json" },
        render: (_args, value) => [
          { type: "text", text: `${value.command ? `$ ${value.command}\n` : ""}${value.output || "(no output)"}${value.ok ? "" : `\n[exit code: ${value.exitCode}]`}` },
        ],
      },
      async execute(args, exec) {
        const argv = stepArgs(args);
        if (argv instanceof Error) throw argv;
        const cwd = exec?.agent?.session?.header?.cwd;
        const root = workspaceRootFor(typeof cwd === "string" && cwd.trim() ? cwd : (process.env.AINAR_WORKSPACE ?? ""));
        if (!root) throw new Error("This session is not standing in a course workspace (a folder holding courses/).");
        return run(argv, root);
      },
    }),
  );
}
