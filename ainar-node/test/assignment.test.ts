/**
 * Pushing the assignment DEFINITION to Canvas, rather than the marks on it.
 *
 *     node --experimental-strip-types --test test/assignment.test.ts
 *
 * Nothing here reaches the network: `RecordedTransport` replays canned
 * responses, so what is asserted is the request this workspace would make.
 *
 * The three things worth pinning, in order of how badly they fail:
 *
 * 1. **Drift is not overwritten.** A field a colleague edited in Canvas must
 *    survive a push. Getting this wrong destroys somebody's work silently.
 * 2. **Sameness is judged on meaning, not on bytes.** Canvas hands a due date
 *    back in UTC and rewrites the description's HTML. A comparison that read
 *    those as changes would report drift forever, which teaches a professor to
 *    ignore the report.
 * 3. **Only fields the model has an opinion about are sent**, so `grading_type`
 *    and anything else set in Canvas's own UI is not flattened by our silence.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  type AssignmentSpec,
  briefHtml,
  descriptionText,
  drifted,
  planAssignment,
  specFor,
  willWrite,
} from "../src/lms/assignment.ts";

const ASSESSMENT = {
  assessment_id: "ASSESSMENT-02",
  title: "Data Preparation Report",
  maximum_score: 100,
  due_at: "2026-10-06T23:59:00+05:00",
  opens_at: "2026-09-29T09:00:00+05:00",
  submission_type: ["pdf", "notebook"],
};

const plan = (
  spec: AssignmentSpec,
  current: Record<string, any> | null,
  prepared: Partial<AssignmentSpec> | null = null,
  group: string | null = null,
) =>
  planAssignment({
    courseVersionId: "CSS-4008-2026-FALL",
    assessmentId: "ASSESSMENT-02",
    group,
    canvasCourseId: "3312",
    canvasAssignmentId: current ? "90218" : null,
    spec,
    current,
    prepared,
  });

// ------------------------------------------------------------------- the spec

test("the model's submission formats become Canvas's, with the extensions", () => {
  const spec = specFor(ASSESSMENT, null);
  assert.deepEqual(spec.submission_types, ["online_upload"]);
  assert.deepEqual(spec.allowed_extensions, ["ipynb", "pdf"]);
  assert.equal(spec.points_possible, 100);
  assert.equal(spec.name, "Data Preparation Report");
});

test("several formats collapse to the channels Canvas knows", () => {
  const spec = specFor({ ...ASSESSMENT, submission_type: ["text", "url", "video"] }, null);
  assert.deepEqual(spec.submission_types, ["media_recording", "online_text_entry", "online_url"]);
  // No upload among them, so naming extensions would forbid uploads nobody
  // asked for.
  assert.deepEqual(spec.allowed_extensions, []);
});

test("an oral defence is still gradeable", () => {
  // `none` would leave Canvas with no column to hang a mark on.
  const spec = specFor({ ...ASSESSMENT, submission_type: ["oral_defense"] }, null);
  assert.deepEqual(spec.submission_types, ["on_paper"]);
});

test("a format Canvas has no channel for is dropped, not guessed at", () => {
  const spec = specFor({ ...ASSESSMENT, submission_type: ["seance"] }, null);
  assert.deepEqual(spec.submission_types, []);
});

// --------------------------------------------------------------------- create

test("with no assignment in Canvas, everything is sent and the operation is create", () => {
  const made = plan(specFor(ASSESSMENT, "<p>Hand in a PDF.</p>"), null);
  assert.equal(made.operation, "create");
  assert.equal(willWrite(made), true);
  assert.equal(made.send.name, "Data Preparation Report");
  assert.equal(made.send.points_possible, "100");
  assert.equal(made.send.due_at, "2026-10-06T23:59:00+05:00");
  assert.deepEqual(made.send.submission_types, ["online_upload"]);
  assert.deepEqual(made.send.allowed_extensions, ["ipynb", "pdf"]);
  assert.equal(made.send.description, "<p>Hand in a PDF.</p>");
});

test("a field the model says nothing about is never sent", () => {
  const made = plan(specFor({ ...ASSESSMENT, due_at: null, opens_at: null }, null), null);
  assert.equal("due_at" in made.send, false);
  assert.equal("unlock_at" in made.send, false);
  assert.equal("description" in made.send, false);
  // And nothing Canvas owns is invented.
  for (const key of ["grading_type", "published", "assignment_group_id", "position"]) {
    assert.equal(key in made.send, false, key);
  }
});

// ------------------------------------------------------------------ sameness

test("the same instant written two ways is not a change", () => {
  // We send +05:00; Canvas answers in UTC. Byte comparison would report drift
  // on every run forever.
  const made = plan(specFor(ASSESSMENT, null), {
    name: "Data Preparation Report",
    points_possible: 100,
    due_at: "2026-10-06T18:59:00Z",
    unlock_at: "2026-09-29T04:00:00Z",
    submission_types: ["online_upload"],
    allowed_extensions: ["pdf", "ipynb"],
  });
  assert.deepEqual(
    made.fields.filter((row) => row.action !== "unchanged"),
    [],
  );
  assert.equal(willWrite(made), false);
});

test("Canvas rewriting the description's HTML is not a change", () => {
  const ours = "<p>Hand in a <strong>PDF</strong>.</p>";
  const theirs = '<p class="x" id="y">Hand in a <strong>PDF</strong>.</p>';
  assert.equal(descriptionText(ours), descriptionText(theirs));

  const made = plan(specFor(ASSESSMENT, ours), {
    name: "Data Preparation Report",
    points_possible: 100,
    due_at: "2026-10-06T18:59:00Z",
    unlock_at: "2026-09-29T04:00:00Z",
    submission_types: ["online_upload"],
    allowed_extensions: ["pdf", "ipynb"],
    description: theirs,
  });
  assert.equal(made.fields.find((row) => row.field === "description")!.action, "unchanged");
});

test("submission types compare as a set, not as a list", () => {
  const made = plan(specFor({ ...ASSESSMENT, submission_type: ["text", "url"] }, null), {
    name: "Data Preparation Report",
    points_possible: 100,
    due_at: "2026-10-06T18:59:00Z",
    unlock_at: "2026-09-29T04:00:00Z",
    submission_types: ["online_url", "online_text_entry"],
  });
  assert.equal(made.fields.find((row) => row.field === "submission_types")!.action, "unchanged");
});

// ---------------------------------------------------------------------- drift

test("a field somebody edited in Canvas is reported and not sent", () => {
  const spec = specFor(ASSESSMENT, null);
  const made = plan(
    spec,
    { name: "Data Prep Report (moved to week 7)", points_possible: 100 },
    { name: "Data Preparation Report", points_possible: 100 },
  );
  const name = made.fields.find((row) => row.field === "name")!;
  assert.equal(name.action, "drift");
  assert.equal(name.current, "Data Prep Report (moved to week 7)");
  assert.equal("name" in made.send, false);
  assert.deepEqual(
    drifted(made).map((row) => row.field),
    ["name"],
  );
});

test("a field we changed ourselves is a change, not drift", () => {
  // Canvas still holds what we last sent, so the difference is this
  // workspace's own edit and is safe to push.
  const made = plan(
    specFor({ ...ASSESSMENT, maximum_score: 120 }, null),
    { name: "Data Preparation Report", points_possible: 100 },
    { name: "Data Preparation Report", points_possible: 100 },
  );
  const points = made.fields.find((row) => row.field === "points_possible")!;
  assert.equal(points.action, "change");
  assert.equal(made.send.points_possible, "120");
});

test("with no ledger, a value Canvas already holds is treated as drift", () => {
  // The safe reading of "we have never written this field and it is not
  // empty": somebody else put it there.
  const made = plan(specFor({ ...ASSESSMENT, maximum_score: 120 }, null), {
    name: "Data Preparation Report",
    points_possible: 100,
  });
  assert.equal(made.fields.find((row) => row.field === "points_possible")!.action, "drift");
  assert.equal("points_possible" in made.send, false);
});

test("an empty field in Canvas is new, never drift", () => {
  const made = plan(specFor(ASSESSMENT, "<p>Brief.</p>"), {
    name: "Data Preparation Report",
    points_possible: 100,
    description: "",
  });
  assert.equal(made.fields.find((row) => row.field === "description")!.action, "new");
  assert.equal(made.send.description, "<p>Brief.</p>");
});

// ----------------------------------------------------------------- the brief

test("no brief means the description is left alone, with a reason", () => {
  const { html, note } = briefHtml({ documents: [] }, ASSESSMENT, process.cwd());
  assert.equal(html, null);
  assert.match(note!, /no instructions_document_id/);
});

test("a brief in object storage cannot be sent, and says so", () => {
  const bundle = {
    documents: [
      {
        document_id: "DOC-1",
        storage_key: "object://courses/x/brief.md",
      },
    ],
  };
  const { html, note } = briefHtml(
    bundle,
    { ...ASSESSMENT, instructions_document_id: "DOC-1" },
    process.cwd(),
  );
  assert.equal(html, null);
  assert.match(note!, /stored outside this repository/);
});

test("a brief that climbs out of the workspace is refused", () => {
  const bundle = {
    documents: [{ document_id: "DOC-1", storage_key: "../../../etc/passwd" }],
  };
  const { html, note } = briefHtml(
    bundle,
    { ...ASSESSMENT, instructions_document_id: "DOC-1" },
    process.cwd(),
  );
  assert.equal(html, null);
  assert.match(note!, /outside the workspace/);
});

test("a .docx brief is not sent as a description", () => {
  const bundle = {
    documents: [{ document_id: "DOC-1", storage_key: "courses/x/brief.docx" }],
  };
  const { html, note } = briefHtml(
    bundle,
    { ...ASSESSMENT, instructions_document_id: "DOC-1" },
    process.cwd(),
  );
  assert.equal(html, null);
  assert.match(note!, /not text this can send/);
});
