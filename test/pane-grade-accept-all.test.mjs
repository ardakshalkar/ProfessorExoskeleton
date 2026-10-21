/**
 * Accept all on a long exam: plugins/dsh-professor-pane/server/routes/grade.js
 *
 *     node --test test/pane-grade-accept-all.test.mjs
 *
 * 130 papers × 27 written questions is 3,510 suggestions, all accepted in one
 * press. The route used to refuse more than 2,000 ("No marks given."), and
 * past that passed the list to `ainar grade decide` as one argument, which a
 * Windows command line (32,767 characters) cannot hold. The list now reaches
 * the CLI on stdin, and every suggestion becomes the professor's decision.
 *
 * The exam has two variants whose copies of a question share its criterion,
 * as Midterm 1 does; that used to refuse the whole press ("marks more than one
 * question"), though no paper holds both copies.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

import { Workspace } from "@ainar/core/src/workspace.ts";
import { writeGroups } from "@ainar/core/src/grade-board.ts";
import { scanPlace } from "@ainar/core/src/scans.ts";

import { routes } from "../plugins/dsh-professor-pane/server/routes/grade.js";

const SAMPLE = fileURLToPath(new URL("../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";
const EXAM = "ASSESSMENT-BIG";
const STUDENTS = 130;
const QUESTIONS = 27;

const pad = (n, width) => String(n).padStart(width, "0");
const VARIANTS = ["A", "B"];
const student = (n) => `STUDENT-B${pad(n, 5)}`;
const question = (v, q) => `ITEM-BIG-${v}-${pad(q, 2)}`;
const criterion = (q) => `CRIT-BIG-${pad(q, 2)}`;
/** Students alternate variants, by their number. */
const variantOf = (i) => VARIANTS[i % VARIANTS.length];

/** The sample course, with a long paper exam whose answers are all grouped and scored. */
const course = () => {
  const root = mkdtempSync(join(tmpdir(), "pane-accept-all-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  const dir = join(root, "courses", COURSE);
  const folder = join(dir, "assessments", EXAM);
  mkdirSync(folder, { recursive: true });
  const questions = Array.from({ length: QUESTIONS }, (_, i) => i + 1);
  writeFileSync(
    join(folder, "assessment.yaml"),
    "assessments:\n" +
      `- assessment_id: ${EXAM}\n  course_version_id: ${RUN}\n  title: Long midterm\n  type: exam\n` +
      `  maximum_score: ${QUESTIONS * 2}\n  rubric_id: RUBRIC-BIG\n` +
      "  rubric:\n    rubric_id: RUBRIC-BIG\n    title: Long midterm\n    criteria:\n" +
      questions
        .map(
          (q) =>
            `    - criterion_id: ${criterion(q)}\n      rubric_id: RUBRIC-BIG\n      title: Q${q}\n      maximum_score: 2\n` +
            "      levels:\n        - { score: 2, description: right }\n        - { score: 1, description: half }\n        - { score: 0, description: wrong }\n",
        )
        .join(""),
  );
  writeFileSync(
    join(folder, "items.yaml"),
    "items:\n" +
      VARIANTS.flatMap((v) =>
        questions.map(
          (q) =>
            `- item_id: ${question(v, q)}\n  assessment_id: ${EXAM}\n  type: short_answer\n  prompt: Question ${q}?\n` +
            `  number: ${q}\n  maximum_score: 2\n  criterion_id: ${criterion(q)}\n  extensions:\n    variant: ${v}\n`,
        ),
      ).join(""),
  );
  const people = Array.from({ length: STUDENTS }, (_, i) => student(i + 1));
  writeFileSync(
    join(dir, "enrollments-big.yaml"),
    "enrollments:\n" +
      people
        .map((id, i) => `  - enrollment_id: ENR-B${pad(i, 5)}\n    course_version_id: ${RUN}\n    student_id: ${id}\n    role: student\n    status: active\n`)
        .join(""),
  );
  mkdirSync(join(dir, "records"), { recursive: true });
  writeFileSync(
    join(dir, "records", "submissions-big.yaml"),
    "submissions:\n" +
      people
        .map(
          (id, i) =>
            `  - submission_id: SUB-${id.slice(8)}-BIG\n    assessment_id: ${EXAM}\n    student_id: ${id}\n    status: submitted\n` +
            `    extensions:\n      scan:\n        variant: ${variantOf(i)}\n`,
        )
        .join(""),
  );

  const submissions = mkdtempSync(join(tmpdir(), "pane-accept-all-subs-"));
  const place = scanPlace(submissions, RUN, EXAM);
  people.forEach((id, i) => {
    mkdirSync(join(place.base, id), { recursive: true });
    writeFileSync(
      join(place.base, id, "transcript.yaml"),
      "answers:\n" + questions.map((q) => `  - { item: ${question(variantOf(i), q)}, text: "answer ${q}", confidence: high, page: 1 }\n`).join(""),
    );
  });
  // Every answer in a scored group: one suggestion per paper per question.
  writeGroups(place, {
    assessment_id: EXAM,
    items: VARIANTS.flatMap((v) =>
      questions.map((q) => {
        const sat = people.filter((_, i) => variantOf(i) === v);
        return {
          item_id: question(v, q),
          groups: [
            { label: "right", score: 2, students: sat.filter((_, i) => i % 3 === 0) },
            { label: "half", score: 1, students: sat.filter((_, i) => i % 3 === 1) },
            { label: "wrong", score: 0, students: sat.filter((_, i) => i % 3 === 2) },
          ],
        };
      }),
    ),
  });
  return { root, submissions };
};

/** One request through the route, as the router would hand it over. */
const call = (c, path, body) =>
  new Promise((resolve) => {
    const req = new PassThrough();
    req.method = body === undefined ? "GET" : "POST";
    const res = {
      writeHead() {},
      setHeader() {},
      end: (text) => resolve(JSON.parse(String(text))),
    };
    const url = new URL(`http://pane${path}`);
    routes[0].handle({ ...c, req, res, url, path: url.pathname });
    req.end(body === undefined ? "" : JSON.stringify(body));
  });

test("Accept all on 3,510 suggestions decides every one", { timeout: 300000 }, async () => {
  const { root, submissions } = course();
  process.env.AINAR_SUBMISSIONS_DIR = submissions;
  const c = { root, runId: RUN, view: "course", workspace: new Workspace(root) };

  const doc = await call(c, `/api/grade?assessment=${EXAM}`);
  assert.equal(doc.error, undefined, doc.error);
  // What the Grade view's Accept all sends: every waiting answer at its suggestion.
  const decisions = doc.items.flatMap((item) =>
    item.answers.filter((a) => !a.decision && a.suggestion).map((a) => ({ item: item.item_id, student: a.student, score: a.suggestion.score })),
  );
  assert.equal(decisions.length, STUDENTS * QUESTIONS, "each paper once per question, on its own variant only");
  for (const item of doc.items) {
    const v = item.item_id.split("-")[2];
    assert.ok(item.answers.every((a) => variantOf(Number(a.student.slice(9)) - 1) === v), `${item.item_id} lists only variant ${v}'s papers`);
  }
  assert.ok(JSON.stringify(decisions).length > 32767, "more than a Windows command line holds");

  const result = await call(c, `/api/grade/decide?assessment=${EXAM}`, { via: "all", decisions });
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.ok, true, result.output);
  assert.match(result.output, new RegExp(`^${STUDENTS * QUESTIONS} decided`, "m"));

  const after = await call(c, `/api/grade?assessment=${EXAM}`);
  const waiting = after.items.flatMap((item) => item.answers.filter((a) => !a.decision && a.suggestion));
  assert.equal(waiting.length, 0, "nothing is left suggested");
  const records = readdirSync(join(root, "courses", COURSE), { recursive: true })
    .filter((name) => /evaluation/i.test(String(name)) && String(name).endsWith(".yaml"))
    .map((name) => readFileSync(join(root, "courses", COURSE, String(name)), "utf-8"))
    .join("\n");
  assert.equal((records.match(/decided_via: all/g) ?? []).length, STUDENTS * QUESTIONS);
});

test("an empty press is still refused, and says so", async () => {
  const { root, submissions } = course();
  process.env.AINAR_SUBMISSIONS_DIR = submissions;
  const c = { root, runId: RUN, view: "course", workspace: new Workspace(root) };
  const result = await call(c, `/api/grade/decide?assessment=${EXAM}`, { via: "all", decisions: [] });
  assert.equal(result.error, "No marks given.");
});
