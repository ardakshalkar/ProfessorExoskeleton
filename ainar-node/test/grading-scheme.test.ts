/**
 * The run's grading scheme: blocks of the final grade (ВСК1/ВСК2/Final at
 * Narxoz, categories or periods elsewhere), each assessment counting in one.
 *
 *     node --experimental-strip-types --test test/grading-scheme.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { allRubrics, enrolledIn } from "../src/bundle.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { planAssignment } from "../src/lms/assignment.ts";
import { runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import { CourseVersion } from "../src/model/delivery.ts";
import { validate } from "../src/validate.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const sample = new Workspace(ROOT, "flag").findRun(RUN);

/** The sample with a two-block scheme: P1 holds the first half of the assessments by weight order, P2 the rest. */
const withScheme = (tweak: (b: any) => void = () => {}) => {
  const b: any = structuredClone(sample);
  const run = b.versions.find((v: any) => v.course_version_id === RUN);
  const ours = b.assessments.filter((a: any) => a.course_version_id === RUN);
  const half = Math.ceil(ours.length / 2);
  let first = 0;
  ours.forEach((a: any, i: number) => {
    a.component = i < half ? "P1" : "P2";
    if (i < half) first += a.weight ?? 0;
  });
  const total = ours.reduce((sum: number, a: any) => sum + (a.weight ?? 0), 0);
  run.grading_scheme = {
    components: [
      { component_id: "P1", title: "First period", weight: first },
      { component_id: "P2", title: "Second period", weight: total - first },
    ],
  };
  tweak(b);
  return b;
};

const issueCodes = (b: any): string[] => {
  const list: any = validate(b);
  const all = [...(list.errors ?? []), ...(list.warnings ?? [])];
  return all.map((issue: any) => issue.code);
};

test("the model takes a scheme on the run and refuses a malformed component id", () => {
  const run = sample.versions.find((v: any) => v.course_version_id === RUN) as any;
  const parsed = CourseVersion.parse({
    ...run,
    grading_scheme: { components: [{ component_id: "VSK1", title: "ВСК 1", weight: 0.3 }] },
  });
  assert.equal((parsed as any).grading_scheme.components[0].title, "ВСК 1");
  assert.throws(() =>
    CourseVersion.parse({ ...run, grading_scheme: { components: [{ component_id: "vsk 1", title: "x", weight: 0.3 }] } }),
  );
});

test("a consistent scheme raises nothing", () => {
  const found = issueCodes(withScheme()).filter((code) => code.startsWith("grading."));
  assert.deepEqual(found, []);
});

test("a block whose members do not add up to it is a warning, naming both numbers", () => {
  const b = withScheme((b) => {
    b.versions.find((v: any) => v.course_version_id === RUN).grading_scheme.components[0].weight += 0.05;
  });
  const list: any = validate(b);
  const warning = (list.warnings ?? []).find((w: any) => w.code === "grading.component_sum" && /P1/.test(w.message));
  assert.ok(warning, "P1's sum is reported");
  assert.ok((list.warnings ?? []).some((w: any) => w.code === "grading.component_sum" && /top-level/.test(w.message)));
});

test("an assessment naming a component the scheme does not have is an error; one naming none is a warning", () => {
  const b = withScheme((b) => {
    const ours = b.assessments.filter((a: any) => a.course_version_id === RUN);
    ours[0].component = "NOPE";
    ours[1].component = null;
  });
  const codes = issueCodes(b);
  assert.ok(codes.includes("grading.unknown_component"));
  assert.ok(codes.includes("grading.unassigned"));
});

test("a parent that is not a component, and a cycle, are errors", () => {
  const unknownParent = withScheme((b) => {
    b.versions.find((v: any) => v.course_version_id === RUN).grading_scheme.components[0].parent = "GHOST";
  });
  assert.ok(issueCodes(unknownParent).includes("grading.unknown_parent"));
  const cycle = withScheme((b) => {
    const [p1, p2] = b.versions.find((v: any) => v.course_version_id === RUN).grading_scheme.components;
    p1.parent = "P2";
    p2.parent = "P1";
  });
  assert.ok(issueCodes(cycle).includes("grading.cycle"));
});

test("the gradebook totals each student per component, a nested one counting in its parent too", () => {
  const b = withScheme((b) => {
    const run = b.versions.find((v: any) => v.course_version_id === RUN);
    // Nest P2 inside a FINAL-HALF block, which then holds P2's weight.
    run.grading_scheme.components.push({ component_id: "HALF", title: "Half", weight: run.grading_scheme.components[1].weight });
    run.grading_scheme.components[1].parent = "HALF";
  });
  // One student, fully marked on one P1 assessment marked on its rubric alone.
  const rubrics = allRubrics(b);
  const itemCriteria = new Set(b.items.map((item: any) => item.criterion_id).filter(Boolean));
  const target = b.assessments.find(
    (a: any) =>
      a.course_version_id === RUN && a.component === "P1" && a.rubric_id &&
      rubrics.get(a.rubric_id)?.criteria?.length &&
      !rubrics.get(a.rubric_id).criteria.some((c: any) => itemCriteria.has(c.criterion_id)),
  );
  assert.ok(target, "a P1 assessment marked on its rubric");
  const handedIn = new Set(b.submissions.filter((s: any) => s.assessment_id === target.assessment_id).map((s: any) => s.student_id));
  const student = enrolledIn(b, RUN).find((e: any) => !handedIn.has(e.student_id))!.student_id;
  b.submissions.push({ submission_id: "SUB-SCHEME-1", assessment_id: target.assessment_id, student_id: student, submitted_at: "2026-10-01T09:00:00+05:00" });
  for (const criterion of rubrics.get(target.rubric_id).criteria) {
    b.evaluations.push({
      evaluation_id: `EVAL-SCHEME-${criterion.criterion_id}`,
      submission_id: "SUB-SCHEME-1",
      criterion_id: criterion.criterion_id,
      status: "approved",
      professor_decision: { score: criterion.maximum_score, decided_by: "USER-T", decided_at: "2026-10-02T09:00:00+05:00" },
    });
  }

  const book: any = gradebookPayload(b, RUN, {});
  assert.equal(book.assessments.find((a: any) => a.assessment_id === target.assessment_id).component, "P1");
  const row = book.totals.find((t: any) => t.student_id === student);
  const byId = Object.fromEntries(row.components.map((c: any) => [c.component_id, c]));
  assert.deepEqual(Object.keys(byId), ["P1", "P2", "HALF"], "every component, in the scheme's order");
  assert.equal(byId.P1.weight_graded, target.weight);
  assert.equal(byId.P1.percent_of_graded, 100);
  assert.equal(byId.P2.weight_graded, 0);
  assert.equal(byId.P2.percent_of_graded, null, "nothing graded in it yet is a blank, not a zero");
  assert.equal(byId.HALF.percent_of_graded, null);
});

test("a run with no scheme keeps the totals it always had", () => {
  const book: any = gradebookPayload(sample, RUN, {});
  for (const row of book.totals) assert.ok(!("components" in row));
});

test("an assignment push plans the component's Canvas group, and leaves it alone when unmapped", () => {
  const base = { name: "Quiz 1", points_possible: 10, due_at: null, unlock_at: null, submission_types: [], allowed_extensions: [], description: null };
  const options = { courseVersionId: RUN, assessmentId: "ASSESSMENT-01", group: null, canvasCourseId: "1", canvasAssignmentId: "5", prepared: null };
  const move = planAssignment({ ...options, spec: { ...base, assignment_group_id: "39945" }, current: { name: "Quiz 1", assignment_group_id: 39945 } });
  assert.equal(move.fields.find((f) => f.field === "assignment_group_id")!.action, "unchanged");
  const create = planAssignment({ ...options, spec: { ...base, assignment_group_id: "39945" }, current: null });
  assert.equal(create.send.assignment_group_id, "39945");
  const unmapped = planAssignment({ ...options, spec: { ...base }, current: null });
  assert.ok(!("assignment_group_id" in unmapped.send));
});

// --------------------------------------------------------------- lms groups

const response = (status: number, body: unknown): Response => ({ status, body: JSON.stringify(body), headers: {} });

const lmsArgs = (overrides: Record<string, unknown>): any => ({
  subcommand: "groups", run: "CSS-4007-2026-FALL", assessment: null, target: "canvas-csv", by: "sis-id",
  source: null, column: null, out: null, tab: null, sheet: null, canvasUrl: "https://canvas.example.edu",
  canvasCourse: null, canvasAssignment: null, group: null, connection: null, connections: null,
  rosterDir: null, syncDir: null, allowPartial: false, withNames: false, noComments: false, comments: false,
  confirm: false, dryRun: false, quiet: false, json: false, overwriteDrift: false, summary: false, allTabs: false,
  ...overrides,
});

const narxoz = () => ({
  course: { course_id: "CSS-4007", title: "AI" },
  versions: [
    {
      course_version_id: "CSS-4007-2026-FALL",
      course_id: "CSS-4007",
      term: "2026-FALL",
      grading_scheme: {
        components: [
          { component_id: "VSK1", title: "ВСК 1", weight: 0.3 },
          { component_id: "VSK2", title: "ВСК 2", weight: 0.3 },
          { component_id: "FINAL", title: "Экзамен", weight: 0.4 },
        ],
      },
      extensions: { lms: { canvas_courses: { "ENG-8": 7434 } } },
    },
  ],
  assessments: [], documents: [], rubrics: [], items: [],
});

const GROUPS = {
  "GET /api/v1/courses/7434/assignment_groups": response(200, [
    { id: 39945, name: "САБ-1/ВСК-1", group_weight: 30 },
    { id: 39946, name: "САБ-2/ВСК-2", group_weight: 30 },
    { id: 39947, name: "Емтихан/Экзамен", group_weight: 40 },
  ]),
};

test("lms groups suggests each Canvas group's component by name and weight, and --accept records them", async () => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const root = mkdtempSync(join(tmpdir(), "ainar-groups-"));
  mkdirSync(join(root, "courses", "CSS-4007"), { recursive: true });
  const path = join(root, "courses", "CSS-4007", "version.yaml");
  writeFileSync(path, "course_version_id: CSS-4007-2026-FALL\ncourse_id: CSS-4007\nterm: 2026-FALL\nextensions:\n  lms:\n    canvas_courses:\n      ENG-8: 7434\n");

  const lines: string[] = [];
  const transport = new RecordedTransport(GROUPS);
  await runLms(lmsArgs({}), narxoz() as any, root, { out: (line) => lines.push(line), transport });
  assert.ok(lines.some((l) => l.includes('39945') && l.includes("likely VSK1")), lines.join("\n"));
  assert.ok(lines.some((l) => l.includes('39947') && l.includes("likely FINAL")), lines.join("\n"));
  assert.ok(lines.some((l) => l.includes("Nothing was changed")));

  const accepted: string[] = [];
  await runLms(lmsArgs({ accept: true }), narxoz() as any, root, { out: (line) => accepted.push(line), transport: new RecordedTransport(GROUPS) });
  const written = readFileSync(path, "utf-8");
  assert.match(written, /canvas_assignment_groups:/);
  assert.match(written, /VSK1:\s*\n\s+ENG-8: 39945/);
  assert.match(written, /FINAL:\s*\n\s+ENG-8: 39947/);
  assert.ok(accepted.some((l) => l.includes("Nothing in Canvas was changed")));
});

test("lms groups on a run with no scheme says what to add", async () => {
  const b: any = narxoz();
  delete b.versions[0].grading_scheme;
  await assert.rejects(() => runLms(lmsArgs({}), b, process.cwd(), { out: () => {}, transport: new RecordedTransport(GROUPS) }), /has no grading_scheme/);
});
