/**
 * Exam reports: what a report carries, and `lms send-reports` against a
 * recorded Canvas — a plan until --confirm, only fully marked reports, each a
 * comment with the PDF attached, and nobody sent the same report twice.
 *
 *     node --experimental-strip-types --test test/exam-report.test.ts
 */

import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { assessmentsOf, runById } from "../src/bundle.ts";
import { examReport } from "../src/exam-report.ts";
import { gradeRows } from "../src/gradebook.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { Directory } from "../src/lms/base.ts";
import { type LmsArgs, runLms } from "../src/lms/command.ts";
import { RecordedTransport, type Response } from "../src/lms/http.ts";
import { reportPlace } from "../src/report-place.ts";
import { RosterStore } from "../src/roster.ts";

const ROOT = resolve(process.cwd(), "..", "workspace");
const RUN = "CSS-4008-2026-FALL";
const PEOPLE = {
  "STUDENT-JNG7SN": { institutional_id: "20231023", name: "Aigerim T." },
  "STUDENT-K4QM2X": { institutional_id: "20231024", name: "Bekzat K." },
  "STUDENT-R7TB5D": { institutional_id: "20231025", name: "Dana S." },
} as any;
const CANVAS_USER: Record<string, number> = { "STUDENT-JNG7SN": 5001, "STUDENT-K4QM2X": 5002, "STUDENT-R7TB5D": 5003 };

const scratch = () => mkdtempSync(join(tmpdir(), "ainar-report-test-"));
const response = (status: number, body: unknown): Response => ({ status, body: JSON.stringify(body), headers: {} });

const sample = () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  return loadCourse(dir, ROOT).bundle! as any;
};

test("a report has every handed-in student, their questions, and only decided marks", () => {
  const bundle = sample();
  const assessment = assessmentsOf(bundle, RUN).find((entry: any) =>
    (gradeRows(bundle, RUN, { assessmentId: entry.assessment_id }).get(entry.assessment_id) ?? []).some((row) => row.submission_id),
  )!;
  const report = examReport({ bundle, runId: RUN, assessmentId: assessment.assessment_id, names: { "STUDENT-JNG7SN": "Aigerim T." } });
  const handed = (gradeRows(bundle, RUN, { assessmentId: assessment.assessment_id, allowPartial: true }).get(assessment.assessment_id) ?? []).filter(
    (row) => row.submission_id,
  );
  assert.equal(report.students.length, handed.length);
  for (const student of report.students) {
    // A total only when every mark is decided; the gradebook's, curve and all.
    if (student.status !== "graded") assert.equal(student.total, null);
    for (const question of student.questions) {
      if (question.mark !== null) assert.ok(question.mark <= question.maximum + 1e-9);
    }
  }
  const named = report.students.find((student) => student.student === "STUDENT-JNG7SN");
  if (named) assert.equal(named.name, "Aigerim T.");
  for (const stat of report.stats) assert.ok(stat.full <= stat.marked);
});

/** The fixture course linked to Canvas course 1, assignment 2, and reports for three students. */
const setup = () => {
  const bundle = sample();
  const run = runById(bundle).get(RUN);
  run.extensions = { ...(run.extensions ?? {}), lms: { canvas_course_id: "1" } };
  const assessment = assessmentsOf(bundle, RUN)[0];
  for (const entry of assessmentsOf(bundle, RUN) as any[]) if (entry.extensions?.lms) delete entry.extensions.lms.canvas_assignment_id;
  assessment.extensions = { ...(assessment.extensions ?? {}), lms: { canvas_assignment_id: "2" } };

  const reports = scratch();
  const place = reportPlace(reports, RUN, assessment.assessment_id);
  mkdirSync(join(place.dir, "students"), { recursive: true });
  const made = "2026-10-22T13:00:00+05:00";
  writeFileSync(
    place.manifest,
    JSON.stringify({
      run: RUN,
      assessment: assessment.assessment_id,
      title: "Quiz",
      students: {
        "STUDENT-JNG7SN": { total: 8, maximum: 10, status: "graded", made_at: made },
        "STUDENT-K4QM2X": { total: null, maximum: 10, status: "partially_graded", made_at: made },
        "STUDENT-R7TB5D": { total: 9, maximum: 10, status: "graded", made_at: made },
      },
    }),
  );
  writeFileSync(place.studentPdf("STUDENT-JNG7SN"), "%PDF-1.4 fake");
  writeFileSync(place.studentPdf("STUDENT-K4QM2X"), "%PDF-1.4 fake");
  // STUDENT-R7TB5D's PDF is missing.
  return { bundle, assessment, reports, place };
};

const canvas = () =>
  new RecordedTransport({
    "GET /api/v1/courses/1/assignments/2": response(200, { id: 2, name: "Quiz", points_possible: 10, published: true }),
    "GET /api/v1/courses/1/users": response(
      200,
      Object.entries(PEOPLE).map(([id, person]: [string, any]) => ({ id: CANVAS_USER[id], sis_user_id: person.institutional_id })),
    ),
    "GET /api/v1/courses/1/assignments/2/submissions": response(200, []),
    "POST /api/v1/courses/1/assignments/2/submissions/5001/comments/files": response(200, {
      upload_url: "https://uploads.example.edu/upload/xyz",
      upload_params: { filename: "report.pdf" },
    }),
    "POST /upload/xyz": response(201, { id: 77 }),
    "PUT /api/v1/courses/1/assignments/2/submissions/5001": response(200, { id: 1 }),
  });

const send = async (confirm: boolean, transport: RecordedTransport, context: ReturnType<typeof setup>) => {
  process.env.AINAR_CANVAS_TOKEN = "test-token";
  const lines: string[] = [];
  const args = {
    subcommand: "send-reports", run: RUN, assessment: context.assessment.assessment_id, target: "canvas-api", by: "sis-id",
    source: null, column: null, out: null, tab: null, sheet: null, canvasUrl: "https://canvas.example.edu",
    canvasCourse: null, canvasAssignment: null, group: null, connection: null, connections: join(scratch(), "none.json"),
    rosterDir: scratch(), syncDir: scratch(), allowPartial: false, withNames: false, noComments: true, comments: false,
    confirm, dryRun: false, quiet: false, json: false, overwriteDrift: false, summary: false, allTabs: false,
    reportsDir: context.reports,
  } as LmsArgs;
  await runLms(args, context.bundle, ROOT, {
    out: (line) => lines.push(line),
    transport,
    directory: new Directory(new RosterStore(scratch(), PEOPLE), Buffer.from("a-fixed-salt", "utf-8")),
  });
  return lines.join("\n");
};

test("send-reports is a plan until --confirm, and sends only a fully marked report with its PDF", async () => {
  const context = setup();
  const planned = canvas();
  const said = await send(false, planned, context);
  assert.match(said, /1 ready to send/);
  assert.match(said, /1 not fully marked, so not sent: STUDENT-K4QM2X/);
  assert.match(said, /1 with no PDF on disk: STUDENT-R7TB5D/);
  assert.match(said, /Nothing was sent/);
  assert.equal(planned.bodies("POST").length, 0);
  assert.equal(planned.bodies("PUT").length, 0);
  assert.equal(existsSync(context.place.sent), false);

  const live = canvas();
  await send(true, live, context);
  assert.equal(live.bodies("POST").length, 2, "ask where to upload, then upload");
  const [comment] = live.bodies("PUT");
  assert.match(decodeURIComponent(String(comment)), /comment\[file_ids\]\[\]=77/);
  const sent = JSON.parse(readFileSync(context.place.sent, "utf8"));
  assert.deepEqual(Object.keys(sent), ["STUDENT-JNG7SN"]);

  // The same report is not sent twice.
  const again = canvas();
  const second = await send(true, again, context);
  assert.match(second, /1 already sent this report/);
  assert.equal(again.bodies("PUT").length, 0);
});
