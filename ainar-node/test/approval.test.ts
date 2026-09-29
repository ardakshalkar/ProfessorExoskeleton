/**
 * The one rule: whether a person stands behind a record.
 *
 * Replaces `drafts.test.ts` and most of `approve.test.ts`, which tested a
 * second place for proposals to live and the command that moved them out of
 * it. A draft is now a record in the course that says so.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AGENT_WRITABLE, approvedView, drafts, isApproved, withRecords } from "../src/approval.ts";
import type { CourseBundle } from "../src/bundle.ts";
import { Document } from "../src/model/content.ts";
import { Concept, LearningOutcome } from "../src/model/academic.ts";

const bundle = (extra: Record<string, unknown[]>): CourseBundle =>
  ({
    course: { course_id: "CSS-4008" },
    documents: [],
    activities: [],
    assessments: [],
    items: [],
    evaluations: [],
    interventions: [],
    ...extra,
  }) as unknown as CourseBundle;

test("a record with no approval field is approved — hand-authored is the professor's own", () => {
  assert.ok(isApproved("documents", { document_id: "DOC-1" }));
  assert.ok(isApproved("documents", { document_id: "DOC-1", approval: "approved" }));
  assert.ok(!isApproved("documents", { document_id: "DOC-1", approval: "draft" }));
});

test("an evaluation is approved by its decision, not by the field", () => {
  assert.ok(!isApproved("evaluations", { status: "suggested" }));
  assert.ok(!isApproved("evaluations", { status: "in_review" }));
  assert.ok(isApproved("evaluations", { status: "approved" }));
  assert.ok(isApproved("evaluations", { status: "overridden" }));
  // A missing status is the model's default, `suggested`.
  assert.ok(!isApproved("evaluations", {}));
});

test("an intervention is a draft while it is proposed", () => {
  assert.ok(!isApproved("interventions", { status: "proposed" }));
  assert.ok(!isApproved("interventions", {}));
  assert.ok(isApproved("interventions", { status: "approved" }));
  assert.ok(isApproved("interventions", { status: "scheduled" }));
});

test("drafts lists every record nobody has accepted, by id", () => {
  const found = drafts(
    bundle({
      documents: [
        { document_id: "DOC-1", title: "Accepted" },
        { document_id: "DOC-2", title: "Proposed", approval: "draft" },
      ],
      evaluations: [{ evaluation_id: "EVAL-1", status: "suggested" }],
    }),
  );
  assert.deepEqual(found, [
    { collection: "documents", id: "DOC-2", title: "Proposed" },
    { collection: "evaluations", id: "EVAL-1" },
  ]);
});

test("the student view has no drafts in it, and the bundle it came from is untouched", () => {
  const whole = bundle({
    documents: [
      { document_id: "DOC-1" },
      { document_id: "DOC-2", approval: "draft" },
    ],
    evaluations: [
      { evaluation_id: "EVAL-1", status: "approved" },
      { evaluation_id: "EVAL-2", status: "suggested" },
    ],
  });
  const view = approvedView(whole) as unknown as Record<string, { [k: string]: unknown }[]>;
  assert.deepEqual(view.documents!.map((d) => d.document_id), ["DOC-1"]);
  assert.deepEqual(view.evaluations!.map((e) => e.evaluation_id), ["EVAL-1"]);
  assert.equal((whole.documents as unknown[]).length, 2, "the view must be a copy");
});

test("withRecords appends to a copy, for validating before a write", () => {
  const whole = bundle({ documents: [{ document_id: "DOC-1" }] });
  const merged = withRecords(whole, { documents: [{ document_id: "DOC-2" }] });
  assert.equal((merged.documents as unknown[]).length, 2);
  assert.equal((whole.documents as unknown[]).length, 1);
});

test("the schema accepts the field, and only its two words", () => {
  const base = { document_id: "DOC-1", title: "t", storage_key: "x.md", mime_type: "text/markdown" };
  assert.ok(Document.safeParse({ ...base, approval: "draft" }).success);
  assert.ok(Document.safeParse({ ...base, approval: "approved" }).success);
  assert.ok(!Document.safeParse({ ...base, approval: "maybe" }).success);
});

test("what an agent may not write has no approval field to hide behind", () => {
  // The course's structure is the professor's to author. An agent-written
  // concept or outcome marked `approval: draft` would read as a proposal
  // waiting politely; the strict schema refuses it outright instead.
  for (const collection of ["outcomes", "concepts", "modules", "capabilities", "enrollments"]) {
    assert.ok(!(collection in AGENT_WRITABLE), `${collection} became agent-writable`);
  }
  assert.ok(
    !Concept.safeParse({ concept_id: "CONCEPT-X", course_id: "CSS-4008", title: "t", approval: "draft" })
      .success,
  );
  assert.ok(
    !LearningOutcome.safeParse({
      outcome_id: "LO-01",
      course_id: "CSS-4008",
      title: "t",
      level: "apply",
      approval: "draft",
    }).success,
  );
});
