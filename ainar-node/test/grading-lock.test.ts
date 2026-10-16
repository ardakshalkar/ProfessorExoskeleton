/**
 * The grading policy's lock, as `ainar validate` reads it: a note while it is
 * locked, and a warning when the policy no longer matches what was locked.
 *
 *     node --experimental-strip-types --test test/grading-lock.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { fromPreset, historyEntry, withProposal } from "../src/grading-policy.ts";
import { assessmentsOf, runById, type CourseBundle } from "../src/bundle.ts";
import { IssueList } from "../src/issues.ts";
import { gradingSchemeIssues } from "../src/validate.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const plain = new Workspace(ROOT, "flag").findRun(RUN);

/** The sample course under the ВСК preset, locked from the Gradebook the way the pane's writer does it. */
const locked = (): CourseBundle => {
  const bundle = withProposal(plain, RUN, fromPreset(plain, RUN, "vsk"));
  const entry = historyEntry(bundle, RUN, { at: "2026-10-01T09:00:00Z", action: "lock", summary: ["Policy locked."] });
  const run = runById(bundle).get(RUN) as any;
  run.grading_scheme.locked = true;
  run.grading_scheme.extensions = { history: [entry] };
  return bundle;
};

const issuesOf = (bundle: CourseBundle): IssueList => {
  const issues = new IssueList();
  gradingSchemeIssues(runById(bundle).get(RUN), assessmentsOf(bundle, RUN), issues);
  return issues;
};

test("a lock keeps the policy it locked", () => {
  const entry = (runById(locked()).get(RUN) as any).grading_scheme.extensions.history[0];
  assert.equal(entry.action, "lock");
  assert.ok(entry.locked_as.components.length > 0);
  assert.equal("before" in entry, false, "a lock replaces nothing, so it is not restorable");
});

test("a locked policy is a note, counted as neither an error nor a warning", () => {
  const issues = issuesOf(locked());
  const note = issues.notes.find((issue) => issue.code === "grading.locked");
  assert.ok(note, "no grading.locked note");
  assert.match(note!.message, /since 2026-10-01/);
  assert.match(note!.message, /unlock it in the Gradebook/);
  assert.ok(!issues.warnings.some((issue) => issue.code === "grading.locked_changed"));
  assert.ok(!issues.errors.some((issue) => issue.code.startsWith("grading.locked")));
});

test("an unlocked policy says nothing about a lock", () => {
  const issues = issuesOf(withProposal(plain, RUN, fromPreset(plain, RUN, "vsk")));
  assert.ok(!issues.items.some((issue) => issue.code.startsWith("grading.locked")));
});

test("filing or a block changed around the lock is a warning naming it", () => {
  const bundle = locked();
  const run = runById(bundle).get(RUN) as any;
  const moved = assessmentsOf(bundle, RUN).find((entry) => entry.component === "VSK1")!;
  (moved as any).component = "VSK2";
  run.grading_scheme.components.find((c: any) => c.component_id === "FINAL").weight = 0.5;
  const warning = issuesOf(bundle).warnings.find((issue) => issue.code === "grading.locked_changed");
  assert.ok(warning, "no grading.locked_changed warning");
  assert.match(warning!.message, new RegExp(`${moved.assessment_id} moved VSK1 → VSK2`));
  assert.match(warning!.message, /block FINAL changed/);
});

test("a lock set by hand, with nothing recorded, is only the note", () => {
  const bundle = withProposal(plain, RUN, fromPreset(plain, RUN, "vsk"));
  (runById(bundle).get(RUN) as any).grading_scheme.locked = true;
  const issues = issuesOf(bundle);
  assert.ok(issues.notes.some((issue) => issue.code === "grading.locked"));
  assert.ok(!issues.warnings.some((issue) => issue.code === "grading.locked_changed"));
});
