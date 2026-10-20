/**
 * The scan-steps tool (plugins/dsh-professor-scan-steps): what it lets
 * through to `ainar scans`, tested without a harness or a spawn. The tool runs
 * outside the sandbox, so its argument check is the whole of its fence.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";

import { AINAR_CLI, STEPS, stepArgs } from "../plugins/dsh-professor-scan-steps/index.js";

const RUN = "CSS-4007-2026-FALL";
const A = "ASSESSMENT-MIDTERM-1";

test("the CLI it spawns is this checkout's", () => {
  assert.ok(existsSync(AINAR_CLI), AINAR_CLI);
  assert.deepEqual(STEPS, ["status", "file", "plan", "names", "apply"]);
});

test("filing the 2026-10-20 midterm pile becomes `scans file RUN FILE --assessment A`", () => {
  assert.deepEqual(stepArgs({ step: "file", run: RUN, assessment: A, file: "scan-92d32fb5e5.pdf" }), ["scans", "file", RUN, "scan-92d32fb5e5.pdf", "--assessment", A]);
});

test("each step carries only its own flags", () => {
  assert.deepEqual(stepArgs({ step: "plan", run: RUN, assessment: A, pages_per_student: 4 }), ["scans", "plan", RUN, "--assessment", A, "--pages-per-student", "4"]);
  assert.deepEqual(stepArgs({ step: "plan", run: RUN, assessment: A, per_file: true }), ["scans", "plan", RUN, "--assessment", A, "--per-file"]);
  assert.deepEqual(stepArgs({ step: "names", run: RUN, assessment: A, force: true, dry_run: true }), ["scans", "names", RUN, "--assessment", A, "--force", "--dry-run"]);
  assert.deepEqual(stepArgs({ step: "apply", run: RUN, assessment: A, replace: true, dry_run: true }), ["scans", "apply", RUN, "--assessment", A, "--replace", "--dry-run"]);
  assert.deepEqual(stepArgs({ step: "status", run: RUN, assessment: A, replace: true, file: "x.pdf" }), ["scans", "status", RUN, "--assessment", A]);
});

test("anything that is not a step, an id or a PDF in the inbox is refused before a spawn", () => {
  const refused = (args, pattern) => {
    const result = stepArgs(args);
    assert.ok(result instanceof Error, JSON.stringify(args));
    assert.match(result.message, pattern);
  };
  refused({ step: "assign", run: RUN, assessment: A }, /step is one of/);
  refused({ step: "read", run: RUN, assessment: A }, /step is one of/);
  refused({ step: "status", run: "css; rm -rf", assessment: A }, /not a run id/);
  refused({ step: "status", run: RUN, assessment: "QUIZ-3" }, /not an assessment id/);
  refused({ step: "file", run: RUN, assessment: A, file: "..\\..\\roster\\people.pdf" }, /names one PDF/);
  refused({ step: "file", run: RUN, assessment: A, file: "notes.txt" }, /names one PDF/);
  refused({ step: "plan", run: RUN, assessment: A, per_file: true, pages_per_student: 2 }, /not both/);
  refused({ step: "plan", run: RUN, assessment: A, pages_per_student: 2.5 }, /whole number/);
});
