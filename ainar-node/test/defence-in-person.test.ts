/**
 * The submission an in-person defence files under, when nothing was handed
 * in: `recordInPersonSubmission`, shared by `ainar defence fork --in-person`
 * and the pane's *Audio defence*, which calls it in its own process.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { recordInPersonSubmission } from "../src/defence.ts";
import { Workspace } from "../src/workspace.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const STUDENT = "STUDENT-K4QM2X";
// The sample has this student's ASSESSMENT-01 hand-in, and nothing for ASSESSMENT-02.
const HANDED_IN = "ASSESSMENT-01";
const NOTHING = "ASSESSMENT-02";

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-inperson-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  return root;
};

const load = (root: string) => new Workspace(root).findRun(RUN);

const submissionsOf = (root: string, assessmentId: string): any[] =>
  (load(root).submissions as any[]).filter((entry) => entry.assessment_id === assessmentId && entry.student_id === STUDENT);

test("with nothing handed in, a submission with no link is recorded and loads back", () => {
  const root = workspace();
  assert.equal(submissionsOf(root, NOTHING).length, 0, "the sample changed: this student now has an ASSESSMENT-02 submission");

  const kept = recordInPersonSubmission(root, load(root), RUN, NOTHING, STUDENT);

  assert.equal(kept.created, true);
  assert.equal(kept.submission_id, "SUB-K4QM2X-02");
  assert.equal(kept.written.length, 1);
  const [record] = submissionsOf(root, NOTHING);
  assert.equal(record.submission_id, kept.submission_id);
  assert.equal(record.status, "submitted");
  assert.equal(record.url, undefined);
  assert.equal(record.extensions?.source, "fork");
  assert.match(record.note, /in person/);
});

test("a second press files under the first submission and writes nothing", () => {
  const root = workspace();
  const first = recordInPersonSubmission(root, load(root), RUN, NOTHING, STUDENT);
  const before = readFileSync(first.written[0], "utf-8");

  const again = recordInPersonSubmission(root, load(root), RUN, NOTHING, STUDENT);

  assert.deepEqual(again, { submission_id: first.submission_id, created: false, written: [] });
  assert.equal(readFileSync(first.written[0], "utf-8"), before);
  assert.equal(submissionsOf(root, NOTHING).length, 1);
});

test("a student who handed in defends under that hand-in, untouched", () => {
  const root = workspace();
  const [existing] = submissionsOf(root, HANDED_IN);
  assert.ok(existing, "the sample changed: this student has no ASSESSMENT-01 submission");

  const kept = recordInPersonSubmission(root, load(root), RUN, HANDED_IN, STUDENT);

  assert.deepEqual(kept, { submission_id: existing.submission_id, created: false, written: [] });
  assert.deepEqual(submissionsOf(root, HANDED_IN), [existing]);
});

test("an unknown assessment or a student not in the run is refused, and nothing is written", () => {
  const root = workspace();
  const bundle = load(root);
  const count = (bundle.submissions as any[]).length;

  assert.throws(() => recordInPersonSubmission(root, bundle, RUN, "ASSESSMENT-NOPE", STUDENT), /has no assessment ASSESSMENT-NOPE/);
  assert.throws(() => recordInPersonSubmission(root, bundle, RUN, NOTHING, "STUDENT-NOBODY"), /not enrolled/);
  assert.equal((load(root).submissions as any[]).length, count);
});
