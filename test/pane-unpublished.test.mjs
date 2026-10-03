/**
 * What has not gone out yet: `plugins/dsh-professor-pane/lib/unpublished.js`.
 *
 *     node --test test/pane-unpublished.test.mjs
 *
 * Over the sample course, with a ledger of the test's own — the real one is in
 * `~/.ainar/sync/` and holds a professor's gradebook values. The sample has no
 * marks, so one student's paper is marked here, in a copy of the bundle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { allRubrics, enrolledIn } from "@ainar/core/src/bundle.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { Workspace } from "@ainar/core/src/workspace.ts";
import { unpublishedDocument } from "../plugins/dsh-professor-pane/lib/unpublished.js";

const ROOT = fileURLToPath(new URL("../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const sample = new Workspace(ROOT, "flag").findRun(RUN);

/** The sample, with one student's paper for one rubric-marked assessment decided in full. */
const marked = () => {
  const bundle = structuredClone(sample);
  const rubrics = allRubrics(bundle);
  // A rubric none of whose criteria is scored through items, so the
  // evaluations below are the whole mark.
  const itemCriteria = new Set(bundle.items.map((item) => item.criterion_id).filter(Boolean));
  const assessment = bundle.assessments.find(
    (entry) =>
      entry.course_version_id === RUN &&
      entry.rubric_id &&
      rubrics.get(entry.rubric_id)?.criteria?.length &&
      !rubrics.get(entry.rubric_id).criteria.some((criterion) => itemCriteria.has(criterion.criterion_id)),
  );
  assert.ok(assessment, "the sample has an assessment marked on its rubric alone");
  const handedIn = new Set(
    bundle.submissions.filter((entry) => entry.assessment_id === assessment.assessment_id).map((entry) => entry.student_id),
  );
  const student = enrolledIn(bundle, RUN).find((entry) => !handedIn.has(entry.student_id)).student_id;
  const submission = `SUB-TEST-${assessment.assessment_id}`;
  bundle.submissions.push({
    submission_id: submission,
    assessment_id: assessment.assessment_id,
    student_id: student,
    submitted_at: "2026-10-01T09:00:00+05:00",
  });
  for (const criterion of rubrics.get(assessment.rubric_id).criteria) {
    bundle.evaluations.push({
      evaluation_id: `EVAL-TEST-${criterion.criterion_id}`,
      submission_id: submission,
      criterion_id: criterion.criterion_id,
      status: "approved",
      professor_decision: { score: criterion.maximum_score, decided_by: "USER-TEST", decided_at: "2026-10-02T09:00:00+05:00" },
    });
  }
  return { bundle, assessmentId: assessment.assessment_id, student };
};

const doc = (bundle, ledger) => unpublishedDocument({ bundle, runId: RUN, root: ROOT, ledger });
const line = (found, id) => found.assessments.find((entry) => entry.id === id);

test("every assessment of the run gets a line, and nothing is waiting where nothing is marked", () => {
  const found = doc(sample, new Ledger("unused.json"));
  assert.ok(found.assessments.length > 0);
  assert.deepEqual(found.marks, []);
  for (const entry of found.assessments) {
    assert.equal(entry.canvas.sent + entry.canvas.unsent + entry.canvas.changed, entry.canvas.ready, entry.id);
  }
});

test("a whole mark waits for Canvas until Canvas confirms it, and waits again once changed", () => {
  const { bundle, assessmentId, student } = marked();
  const ledger = new Ledger("unused.json");

  const before = doc(bundle, ledger);
  assert.deepEqual(before.marks.map((entry) => entry.id), [assessmentId]);
  assert.deepEqual(line(before, assessmentId).canvas, { ready: 1, sent: 0, unsent: 1, changed: 0 });

  const score = bundle.evaluations
    .filter((entry) => entry.submission_id === `SUB-TEST-${assessmentId}`)
    .reduce((sum, entry) => sum + entry.professor_decision.score, 0);
  ledger.record("canvas-api", assessmentId, [{ student_id: student, score, maximum: null }], {
    at: "2026-10-03T09:00:00+05:00",
    state: "applied",
  });
  const sent = doc(bundle, ledger);
  assert.deepEqual(sent.marks, [], "sent at the same value");
  assert.deepEqual(line(sent, assessmentId).canvas, { ready: 1, sent: 1, unsent: 0, changed: 0 });

  ledger.record("canvas-api", assessmentId, [{ student_id: student, score: score - 1, maximum: null }], {
    at: "2026-10-03T10:00:00+05:00",
    state: "applied",
  });
  assert.deepEqual(line(doc(bundle, ledger), assessmentId).canvas, { ready: 1, sent: 0, unsent: 0, changed: 1 });
});

test("a mark with no Canvas assignment to go to is named as unbound, where the run has Canvas", () => {
  const { bundle, assessmentId } = marked();
  const found = doc(bundle, new Ledger("unused.json"));
  const binding = line(found, assessmentId).binding;
  if (binding.state === null) {
    assert.deepEqual(found.unbound, [], "a run with no Canvas course has nothing unbound");
  } else {
    assert.equal(found.unbound.includes(assessmentId), binding.state !== "all", binding.state);
  }
});
