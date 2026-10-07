/**
 * The routes that spawn `ainar`: scans, publish, the assignment push and the
 * marks push.
 */

// `execFile` is here for the write routes only — `/api/publish` and the two
// that reach a third party — each of which spawns this checkout's TypeScript
// `ainar` rather than reimplementing what it does. See `runPublish`.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { assessmentsOf, runById } from "@ainar/core/src/bundle.ts";

import { sendJson } from "./http.js";
import {
  CANVAS_ASSIGNMENTS_KEY,
  CANVAS_COURSES_KEY,
  lmsLinkage,
  lmsString,
} from "./integrations.js";
import { recordAssessmentLinks } from "./lms-writes.js";
import { loadedRun } from "./workspace.js";

/**
 * The `ainar` CLI this pane is allowed to run: the TypeScript one, in this
 * checkout.
 *
 * A machine-wide `ainar` also exists — the Python package, on PATH — and
 * resolving the command by name would find that one instead. This project does
 * not run Python, so the path is spelled out rather than looked up, and a
 * missing file is reported as a missing file rather than silently falling
 * through to a different implementation of the same gate.
 *
 * Three levels up from this file is the project root:
 * plugins/dsh-professor-pane/lib/actions.js -> ../../.. -> ainar-node/bin/ainar.ts
 */
export const AINAR_CLI = fileURLToPath(new URL("../../../ainar-node/bin/ainar.ts", import.meta.url));

/** The bundled `dots-swarm` animation the defence desk loads; see vendor/build-dots.mjs. */
export const DOTS_BUNDLE = fileURLToPath(new URL("../vendor/dots-swarm.js", import.meta.url));

/** `ainar scans …`, for the Scans tab's two writes. The output is the answer. */
export const runScans = (args, root, timeout = 300000) =>
  new Promise((resolveRun) => {
    if (!existsSync(AINAR_CLI)) {
      resolveRun({ ok: false, error: `The TypeScript ainar CLI is not at ${AINAR_CLI}.` });
      return;
    }
    execFile(
      process.execPath,
      ["--experimental-strip-types", AINAR_CLI, ...args, "--root", root],
      { cwd: root, timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        const output = [stdout, stderr]
          .filter(Boolean)
          .join("\n")
          .split("\n")
          .filter((line) => !/NO_COLOR|trace-warnings|ExperimentalWarning/.test(line))
          .join("\n")
          .trim();
        resolveRun({ ok: code === 0, exitCode: code, command: `bin/ainar ${args.join(" ")}`, output });
      },
    );
  });

/**
 * What `scans read` said, without a line per paper: the papers it could not
 * read, and its closing count. Fifty "read STUDENT-…" lines say nothing the
 * Read step's count does not.
 */
export const readSummary = (output) =>
  String(output ?? "")
    .split("\n")
    .filter((line) => !/^\s+read\s+STUDENT-/.test(line) && !/^reading /.test(line))
    .join("\n")
    .trim();

/**
 * Publish, by spawning the CLI.
 *
 * Spawned rather than reimplemented: `ainar publish` is the one place that
 * decides what a publication carries, and a second copy of that in a web
 * server would be a second answer to "what may a student be shown".
 *
 * **Publishing approves nothing.** Since 2026-09-29 a draft is a record in the
 * course marked `approval: draft`, and `ainar publish` leaves every one out
 * and names it in the plan. There is no route in this pane that accepts a
 * draft — the professor changes the word in the record — and `--confirm` on
 * this one does not become one.
 *
 * **Plan and publish are one route with a flag.** Without `confirm` the CLI
 * reads, prints and writes nothing — including nothing in `courses/`.
 */
export const runPublish = (res, root, runId, target, body) => {
  const TARGETS = ["page", "homework", "canvas", "telegram", "update"];
  if (!TARGETS.includes(target)) {
    return sendJson(res, 200, { error: `${target} is not something this can publish.` });
  }
  if (!existsSync(AINAR_CLI)) {
    return sendJson(res, 200, {
      error:
        `The TypeScript ainar CLI is not at ${AINAR_CLI}. This pane will not ` +
        "fall back to the Python `ainar` on PATH — install or restore " +
        "ainar-node/ instead.",
    });
  }

  const confirm = body.confirm === true;
  const assessment = String(body.assessment ?? "").trim();
  const message = String(body.message ?? "");
  const repo = String(body.repo ?? "").trim();
  const group = String(body.group ?? "").trim();

  const identifier = /^[A-Za-z0-9_.:@+/-]{1,200}$/;
  if ((target === "homework" || target === "canvas") && !identifier.test(assessment)) {
    return sendJson(res, 200, { error: "No assessment chosen." });
  }
  if (repo && !identifier.test(repo)) {
    return sendJson(res, 200, { error: `${repo} is not a repository name.` });
  }
  if (group && !identifier.test(group)) {
    return sendJson(res, 200, { error: `${group} is not a subgroup label.` });
  }
  if (target === "telegram" && !message.trim()) {
    return sendJson(res, 200, { error: "There is nothing to announce." });
  }

  const args = ["--experimental-strip-types", AINAR_CLI, "publish", target];
  if (target === "page" || target === "telegram" || target === "update") args.push(runId);
  else args.push(assessment, "--run", runId);
  args.push("--root", root);
  if (repo) args.push("--repo", repo);
  if (group) args.push("--group", group);
  // The message goes in argv rather than a temporary file, deliberately: a file
  // would outlive the request, and what a professor is about to tell a class is
  // not something this server should leave on disk.
  if (target === "telegram") args.push("--message", message);
  // Correcting the last announcement rather than posting a second one. Never
  // the default, here or in the CLI: a professor sending their second
  // announcement of the week means a second announcement, and a press that
  // silently rewrote the first would destroy something students had read.
  if (target === "telegram" && body.edit === true) args.push("--edit");
  if (confirm) args.push("--confirm");

  execFile(
    process.execPath,
    args,
    { cwd: root, timeout: 300000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      sendJson(res, 200, {
        ok: code === 0,
        confirmed: confirm,
        exitCode: code,
        // The message is not echoed back into the command line shown on screen:
        // it is already in the box the professor typed it into, and repeating
        // it as a shell argument makes a ten-line announcement unreadable.
        command:
          `bin/ainar publish ${target} ` +
          (target === "page" || target === "telegram" || target === "update"
            ? runId
            : `${assessment} --run ${runId}`) +
          (repo ? ` --repo ${repo}` : "") +
          (group ? ` --group ${group}` : "") +
          (target === "telegram" ? " --message …" : "") +
          (target === "telegram" && body.edit === true ? " --edit" : "") +
          (confirm ? " --confirm" : ""),
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      });
    },
  );
};

/**
 * Send an assessment's DEFINITION to Canvas, by spawning the CLI.
 *
 * Spawned rather than reimplemented, for the reason `runPublish` gives: the
 * rules that matter here — what counts as drift, which fields this model has
 * an opinion about, how a created assignment's id is written back into
 * `courses/` without destroying the comments around it — live in
 * `ainar-node/src/lms/`, and a second implementation in this file would have
 * its own idea of all three. The LMS write layer is deliberately absent from the
 * course model's tools, which are a read-only surface; the CLI is the seam that
 * exists for exactly this.
 *
 * **Plan and push are one route with a flag**, and the flag is the professor's
 * press. Both make an outbound request, so both are POST — a plan that Canvas
 * has to answer is not something a prefetch or a replayed history entry should
 * be able to fire, even though it changes nothing.
 *
 * The CLI's own text is passed through whole. "1 field(s) were edited in
 * Canvas and are left alone" is the sentence the professor needs, and nothing
 * this pane could summarise it into would be better.
 */
export const runAssignmentPush = (res, root, runId, body) => {
  const assessment = String(body.assessment ?? "").trim();
  if (!assessment) {
    return sendJson(res, 200, { error: "No assessment named." });
  }
  if (!/^[A-Za-z0-9_.:@+-]{1,200}$/.test(assessment)) {
    return sendJson(res, 200, { error: `${assessment} is not an assessment id.` });
  }
  const group = String(body.group ?? "").trim();
  if (group && !/^[A-Za-z0-9_.:@+-]{1,200}$/.test(group)) {
    return sendJson(res, 200, { error: `${group} is not a subgroup label.` });
  }

  if (!existsSync(AINAR_CLI)) {
    return sendJson(res, 200, {
      error:
        `The TypeScript ainar CLI is not at ${AINAR_CLI}. This pane will not ` +
        "fall back to the Python `ainar` on PATH — install or restore " +
        "ainar-node/ instead.",
    });
  }

  const confirm = body.confirm === true;
  const overwrite = body.overwriteDrift === true;
  // Refused here as well as in the CLI. Replacing a colleague's edit is the
  // one thing on this screen that destroys somebody else's work, and it must
  // not be reachable by a press that meant "preview".
  if (overwrite && !confirm) {
    return sendJson(res, 200, {
      error: "Overwriting what Canvas holds is part of sending, not of previewing.",
    });
  }

  const args = [
    "--experimental-strip-types",
    AINAR_CLI,
    "lms",
    confirm ? "assignment-push" : "assignment-plan",
    runId,
    "--assessment",
    assessment,
  ];
  if (group) args.push("--group", group);
  if (confirm) args.push("--confirm");
  if (overwrite) args.push("--overwrite-drift");

  execFile(
    process.execPath,
    args,
    { cwd: root, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      sendJson(res, 200, {
        ok: code === 0,
        confirmed: confirm,
        exitCode: code,
        command:
          `bin/ainar lms ${confirm ? "assignment-push" : "assignment-plan"} ${runId} ` +
          `--assessment ${assessment}${group ? " --group " + group : ""}` +
          `${confirm ? " --confirm" : ""}${overwrite ? " --overwrite-drift" : ""}`,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      });
    },
  );
};

/**
 * Send an assessment's MARKS to Canvas, one subgroup's course at a time, by
 * spawning `ainar lms plan` / `lms push --target canvas-api`.
 *
 * The same two presses as the definition above: a plan, which asks Canvas what
 * it holds and changes nothing, and then a send, which is a separate request
 * the professor makes after reading it. A run taught as several Canvas
 * courses is pushed per subgroup, because each course numbers its assignments
 * separately; this loops over them so one press covers the class.
 *
 * `link` binds an existing Canvas assignment to one subgroup before the plan —
 * the answer to "Quiz 1 is already in Canvas, I made it by hand" — merged into
 * the subgroups already bound, since the writer replaces the whole mapping.
 */
export const runMarksPush = async (workspace, root, runId, body) => {
  const assessment = String(body.assessment ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(assessment)) return { error: "Not an assessment id." };
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  const record = assessmentsOf(bundle, runId).find((entry) => entry.assessment_id === assessment);
  if (!run || !record) return { error: `${assessment} is not an assessment of ${runId}.` };

  const courses = lmsLinkage(run)[CANVAS_COURSES_KEY];
  const courseOf = courses && typeof courses === "object" && !Array.isArray(courses) ? courses : {};
  const groups = Object.keys(courseOf).sort();

  if (body.link) {
    const group = String(body.link.group ?? "");
    const id = String(body.link.assignmentId ?? "").trim();
    if (groups.length && !groups.includes(group)) return { error: `${runId} has no Canvas course for '${group}'.` };
    const current = lmsLinkage(record)[CANVAS_ASSIGNMENTS_KEY];
    const merged = Object.assign({}, current && typeof current === "object" && !Array.isArray(current) ? current : {});
    merged[group] = id;
    const saved = recordAssessmentLinks(workspace, root, runId, { [assessment]: groups.length ? merged : id });
    if (saved.error) return saved;
  }

  const confirm = body.confirm === true;
  const results = [];
  for (const group of groups.length ? groups : [null]) {
    const args = ["lms", confirm ? "push" : "plan", runId, "--assessment", assessment, "--target", "canvas-api"];
    if (group) args.push("--group", group);
    if (confirm) args.push("--confirm");
    const result = await runScans(args, root);
    results.push({
      group,
      courseId: group ? String(courseOf[group] ?? "") : lmsString(run, "canvas_course_id"),
      ok: result.ok,
      // No assignment bound for this course: it is linked or created first,
      // and the send stays unavailable until it is.
      unlinked: /has no Canvas assignment/.test(result.output ?? ""),
      command: result.command,
      output: result.output ?? result.error ?? "",
    });
  }
  return { confirmed: confirm, groups: results };
};
