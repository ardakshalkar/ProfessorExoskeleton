/**
 * Writing through a CourseStore: the same calls land in YAML files or in a
 * PostgreSQL snapshot, read back at once, and — for the database — reach it
 * only when flushed.
 */

import { strict as assert } from "node:assert";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { ID_FIELDS } from "../src/approval.ts";
import { openCase } from "../src/integrity.ts";
import { YamlCourseStore } from "../src/store/course.ts";
import { loadPostgresCourseStore, type SqlClient } from "../src/store/postgres.ts";

const COURSE = "CSS-4008";
const payload = JSON.parse(
  readFileSync(resolve(process.cwd(), "..", "workspace", "golden", COURSE, "bundle.json"), "utf8"),
);

/** A store over the golden bundle, and every statement it sends. */
const database = async () => {
  const sent: string[] = [];
  const client: SqlClient = {
    async query<Row extends Record<string, unknown>>(text: string) {
      sent.push(text);
      return {
        rows: text.includes("SELECT course_code")
          ? [{ course_code: COURSE, format_version: "1", payload: structuredClone(payload) } as unknown as Row]
          : [],
      };
    },
  };
  const store = await loadPostgresCourseStore(client);
  sent.length = 0;
  return { store, sent };
};

const evaluation = () => structuredClone(payload.evaluations[0]) as Record<string, unknown>;
const EVALUATION_ID = ID_FIELDS.evaluations!;

test("a database write reads back at once and reaches the database only on flush", async () => {
  const { store, sent } = await database();
  const record = { ...evaluation(), [EVALUATION_ID]: "EVAL-NEW-1" };
  const [where] = store.write(COURSE, { evaluations: [record] });

  assert.equal(where, `courses/${COURSE}/records/evaluations.yaml`);
  assert.ok((store.load(COURSE).bundle!.evaluations as any[]).some((e) => e[EVALUATION_ID] === "EVAL-NEW-1"));
  assert.equal(sent.length, 0, "nothing is sent before the flush");

  await store.flush();
  assert.equal(sent.length, 1, "one flush is one transaction");
  assert.match(sent[0]!, /^BEGIN;/);
  assert.match(sent[0]!, /COMMIT;$/);
  assert.match(sent[0]!, /INSERT INTO assessment\.evaluations/);
  assert.match(sent[0]!, /'EVAL-NEW-1'/);
  // The read model last, so it never describes rows that did not commit.
  assert.ok(sent[0]!.lastIndexOf("content.course_bundle_read_models") > sent[0]!.lastIndexOf("assessment.evaluations"));

  await store.flush();
  assert.equal(sent.length, 1, "a second flush has nothing left to send");
});

test("a record that would not load is refused and changes nothing", async () => {
  const { store } = await database();
  const before = structuredClone(store.load(COURSE).bundle!.evaluations);
  assert.throws(
    () => store.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-BAD", status: "maybe" }] }),
    /would not load.*Nothing was written/,
  );
  assert.deepEqual(store.load(COURSE).bundle!.evaluations, before);
});

test("an edit written for a file runs against the snapshot through the same yaml API", async () => {
  const { store, sent } = await database();
  const id = evaluation()[EVALUATION_ID] as string;
  const result = store.edit(COURSE, "evaluations", new Map([[id, (node: any) => node.setIn(["extensions", "note"], "checked")]]));
  assert.equal(result.count, 1);
  const edited = (store.load(COURSE).bundle!.evaluations as any[]).find((e) => e[EVALUATION_ID] === id);
  assert.equal(edited.extensions.note, "checked");

  assert.throws(() => store.edit(COURSE, "evaluations", new Map([["EVAL-NOPE", () => {}]])), /EVAL-NOPE.*Nothing was written/);
  await store.flush();
  assert.match(sent[0]!, /checked/);
});

test("a removed runtime record is deleted by code, before the rows are upserted", async () => {
  const { store, sent } = await database();
  const field = ID_FIELDS.item_responses!;
  const id = payload.item_responses[0][field] as string;
  assert.equal(store.remove(COURSE, "item_responses", [id]), 1);
  assert.ok(!(store.load(COURSE).bundle!.item_responses as any[]).some((r) => r[field] === id));
  await store.flush();
  const deleted = sent[0]!.indexOf(`DELETE FROM assessment.item_responses WHERE code IN ('${id}')`);
  assert.ok(deleted > 0 && deleted < sent[0]!.indexOf("INSERT INTO"));
  assert.throws(() => store.remove(COURSE, "documents", ["DOC-1"]), /not a collection records can be removed from/);
});

test("a failed flush keeps the writes pending for the next one", async () => {
  let fail = true;
  const sent: string[] = [];
  const client: SqlClient = {
    async query<Row extends Record<string, unknown>>(text: string) {
      if (text.includes("SELECT course_code")) {
        return { rows: [{ course_code: COURSE, format_version: "1", payload: structuredClone(payload) } as unknown as Row] };
      }
      if (fail) throw new Error("connection reset");
      sent.push(text);
      return { rows: [] };
    },
  };
  const store = await loadPostgresCourseStore(client);
  store.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-RETRY" }] });
  await assert.rejects(store.flush(), /connection reset/);
  fail = false;
  await store.flush();
  assert.match(sent[0]!, /'EVAL-RETRY'/);
});

test("a library writer handed a database store writes there, and no file", async () => {
  const { store, sent } = await database();
  const root = mkdtempSync(join(tmpdir(), "ainar-no-files-"));
  const run = payload.versions[0].course_version_id as string;
  const assessment = (payload.assessments as any[]).find((entry) => entry.course_version_id === run).assessment_id;
  const student = (payload.enrollments as any[]).find((entry) => entry.course_version_id === run).student_id;
  const opened = openCase({
    root,
    store,
    bundle: store.load(COURSE).bundle!,
    runId: run,
    studentId: student,
    assessmentIds: [assessment],
    by: payload.versions[0].instructors?.[0] ?? "",
    at: "2026-11-03T10:00:00Z",
  });
  assert.ok(((store.load(COURSE).bundle as any).integrity_cases as any[]).some((entry) => entry.case_id === opened.caseId));
  assert.deepEqual(readdirSync(root), [], "nothing was written under the root");
  await store.flush();
  assert.match(sent[0]!, new RegExp(opened.caseId));
});

test("the same calls against YAML write the course's files", async () => {
  const root = mkdtempSync(join(tmpdir(), "ainar-store-writes-"));
  cpSync(resolve(process.cwd(), "..", "workspace"), root, {
    recursive: true,
    filter: (path) => !/[\\/](golden|node_modules|\.git)([\\/]|$)/.test(path),
  });
  const store = new YamlCourseStore(root);
  const record = { ...evaluation(), [EVALUATION_ID]: "EVAL-YAML-1" };
  const [path] = store.write(COURSE, { evaluations: [record] });
  assert.equal(path, join(root, "courses", COURSE, "records", "evaluations.yaml"));
  assert.match(readFileSync(path!, "utf-8"), /EVAL-YAML-1/);
  assert.ok((store.load(COURSE).bundle!.evaluations as any[]).some((e) => e[EVALUATION_ID] === "EVAL-YAML-1"));

  store.edit(COURSE, "evaluations", new Map([["EVAL-YAML-1", (node: any) => node.setIn(["extensions", "note"], "checked")]]));
  assert.match(readFileSync(path!, "utf-8"), /note: checked/);
  assert.equal(store.remove(COURSE, "evaluations", ["EVAL-YAML-1"]), 1);
  await store.flush();
});
