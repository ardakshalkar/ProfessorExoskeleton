/**
 * Writing through a CourseStore: the same calls land in YAML files or in a
 * PostgreSQL snapshot, read back at once, and — for the database — reach it
 * only when flushed, without overwriting what another writer flushed first.
 */

import { strict as assert } from "node:assert";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { ID_FIELDS } from "../src/approval.ts";
import { openCase } from "../src/integrity.ts";
import { WriteConflictError, YamlCourseStore } from "../src/store/course.ts";
import { loadPostgresCourseStore, type SqlClient } from "../src/store/postgres.ts";

const COURSE = "CSS-4008";
const payload = JSON.parse(
  readFileSync(resolve(process.cwd(), "..", "workspace", "golden", COURSE, "bundle.json"), "utf8"),
);

/** The read model's row as `buildScript` writes it: the JSON literal of its upsert. */
const READ_MODEL_ROW = /INSERT INTO content\.course_bundle_read_models \([^)]*\)\nVALUES \('[^']*', '[^']*', '((?:[^']|'')*)'::jsonb\)/;

/**
 * One course's row, as much of PostgreSQL as a flush meets: a transaction
 * that commits or rolls back, the row read under `FOR UPDATE`, the script,
 * and the trigger raising the revision when the script upserts the row.
 */
class Database {
  committed = { payload: structuredClone(payload) as Record<string, unknown>, revision: 1 };
  private open: { payload: Record<string, unknown>; revision: number } | null = null;
  /** Every statement, in order. */
  sent: string[] = [];
  /** The next statement that contains this fails. */
  failOn: string | null = null;

  /** Somebody else's write — `ainar db push`, another session — straight to the row. */
  writeAsSomeoneElse(change: (payload: any) => void): void {
    change(this.committed.payload);
    this.committed.revision += 1;
  }

  scripts(): string[] {
    return this.sent.filter((text) => text.includes("INSERT INTO"));
  }

  client(): SqlClient {
    return {
      query: async <Row extends Record<string, unknown>>(text: string) => {
        this.sent.push(text.trim());
        if (this.failOn && text.includes(this.failOn)) {
          this.failOn = null;
          throw new Error("connection reset");
        }
        const row = () => this.open ?? this.committed;
        const rows = (list: unknown[]) => ({ rows: list as Row[] });
        if (text === "BEGIN") this.open = structuredClone(this.committed);
        else if (text === "COMMIT") [this.committed, this.open] = [this.open!, null];
        else if (text === "ROLLBACK") this.open = null;
        else if (text.includes("SELECT course_code")) {
          return rows([{ course_code: COURSE, format_version: "1", payload: structuredClone(row().payload), revision: String(row().revision) }]);
        } else if (text.includes("SELECT revision")) {
          return rows([{ revision: String(row().revision) }]);
        } else {
          const found = READ_MODEL_ROW.exec(text);
          if (found) {
            row().payload = JSON.parse(found[1]!.replace(/''/g, "'"));
            row().revision += 1;
          }
        }
        return rows([]);
      },
    };
  }
}

const database = async () => {
  const db = new Database();
  const store = await loadPostgresCourseStore(db.client());
  db.sent.length = 0;
  return { db, store, sent: db.sent };
};

const evaluation = () => structuredClone(payload.evaluations[0]) as Record<string, unknown>;
const EVALUATION_ID = ID_FIELDS.evaluations!;
const FIRST = payload.evaluations[0][EVALUATION_ID] as string;
const ids = (bundle: any, collection: string) => (bundle[collection] as any[]).map((entry) => entry[ID_FIELDS[collection]!]);
const note = (node: any, text: string) => node.setIn(["extensions", "note"], text);
const noteOf = (bundle: any) => (bundle.evaluations as any[]).find((entry) => entry[EVALUATION_ID] === FIRST).extensions?.note;

test("a database write reads back at once and reaches the database only on flush", async () => {
  const { store, sent } = await database();
  const record = { ...evaluation(), [EVALUATION_ID]: "EVAL-NEW-1" };
  const [where] = store.write(COURSE, { evaluations: [record] });

  assert.equal(where, `courses/${COURSE}/records/evaluations.yaml`);
  assert.ok(ids(store.load(COURSE).bundle, "evaluations").includes("EVAL-NEW-1"));
  assert.equal(sent.length, 0, "nothing is sent before the flush");

  await store.flush();
  assert.equal(sent[0], "BEGIN");
  assert.match(sent[1]!, /FOR UPDATE/, "the row is locked before anything is written");
  assert.match(sent[2]!, /INSERT INTO assessment\.evaluations[\s\S]*'EVAL-NEW-1'/);
  // The read model last, so it never describes rows that did not commit.
  assert.ok(sent[2]!.lastIndexOf("content.course_bundle_read_models") > sent[2]!.lastIndexOf("assessment.evaluations"));
  assert.equal(sent.at(-1), "COMMIT");
  assert.equal(store.revisionOf(COURSE), "2", "the store now holds the revision it wrote");

  const before = sent.length;
  await store.flush();
  assert.equal(sent.length, before, "a second flush has nothing left to send");
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
  const { db, store } = await database();
  const result = store.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "checked")]]));
  assert.equal(result.count, 1);
  assert.equal(noteOf(store.load(COURSE).bundle), "checked");

  assert.throws(() => store.edit(COURSE, "evaluations", new Map([["EVAL-NOPE", () => {}]])), /EVAL-NOPE.*Nothing was written/);
  await store.flush();
  assert.equal(noteOf(db.committed.payload), "checked");
});

test("a removed runtime record is deleted by code, before the rows are upserted", async () => {
  const { db, store } = await database();
  const field = ID_FIELDS.item_responses!;
  const id = payload.item_responses[0][field] as string;
  assert.equal(store.remove(COURSE, "item_responses", [id]), 1);
  assert.ok(!ids(store.load(COURSE).bundle, "item_responses").includes(id));
  await store.flush();
  const [script] = db.scripts();
  const deleted = script!.indexOf(`DELETE FROM assessment.item_responses WHERE code IN ('${id}')`);
  assert.ok(deleted >= 0 && deleted < script!.indexOf("INSERT INTO"));
  assert.throws(() => store.remove(COURSE, "documents", ["DOC-1"]), /not a collection records can be removed from/);
});

test("a failed flush rolls back and keeps the writes pending for the next one", async () => {
  const { db, store } = await database();
  store.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-RETRY" }] });
  db.failOn = "INSERT INTO";
  await assert.rejects(store.flush(), /connection reset/);
  assert.ok(db.sent.includes("ROLLBACK"));
  assert.equal(db.committed.revision, 1, "nothing reached the row");
  await store.flush();
  assert.ok(ids(db.committed.payload, "evaluations").includes("EVAL-RETRY"));
});

// ------------------------------------------------------------ two writers

test("two writers changing different records both land; the second is made onto the first", async () => {
  const db = new Database();
  const first = await loadPostgresCourseStore(db.client());
  const second = await loadPostgresCourseStore(db.client());

  first.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-FROM-FIRST" }] });
  second.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-FROM-SECOND" }] });
  // An existing record the first did not touch: it came back through the
  // first's whole-course write, and must still read as unchanged.
  second.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "second")]]));
  await first.flush();
  await second.flush();
  assert.equal(noteOf(db.committed.payload), "second");

  const held = ids(db.committed.payload, "evaluations");
  assert.ok(held.includes("EVAL-FROM-FIRST"), "the first writer's record was not overwritten");
  assert.ok(held.includes("EVAL-FROM-SECOND"));
  assert.ok(ids(second.load(COURSE).bundle, "evaluations").includes("EVAL-FROM-FIRST"), "the second store now reads both");
  assert.equal(db.committed.revision, 3);
  assert.equal(second.revisionOf(COURSE), "3");
});

test("two writers changing the same record: the second is refused, writes nothing, and reads the first", async () => {
  const db = new Database();
  const first = await loadPostgresCourseStore(db.client());
  const second = await loadPostgresCourseStore(db.client());

  first.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "first")]]));
  second.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "second")]]));
  // The second also changed a record nobody else touched; it goes nowhere either.
  second.write(COURSE, { evaluations: [{ ...evaluation(), [EVALUATION_ID]: "EVAL-ALSO-SECOND" }] });
  await first.flush();

  const error = await second.flush().then(
    () => null,
    (caught) => caught,
  );
  assert.ok(error instanceof WriteConflictError, "refused, not overwritten");
  assert.deepEqual(error.records, [`evaluations ${FIRST}`]);
  assert.equal(noteOf(db.committed.payload), "first");
  assert.ok(!ids(db.committed.payload, "evaluations").includes("EVAL-ALSO-SECOND"), "a refusal writes nothing for the course");
  assert.equal(db.committed.revision, 2);

  assert.equal(noteOf(second.load(COURSE).bundle), "first", "the refused store reads what is really there");
  const before = db.sent.length;
  await second.flush();
  assert.equal(db.sent.length, before, "the refused changes are not tried again");
  second.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "second, again")]]));
  await second.flush();
  assert.equal(noteOf(db.committed.payload), "second, again", "made again, it lands");
});

test("an import between load and flush is a writer like any other", async () => {
  const { db, store } = await database();
  db.writeAsSomeoneElse((course) => course.evaluations.push({ ...evaluation(), [EVALUATION_ID]: "EVAL-IMPORTED" }));
  store.edit(COURSE, "evaluations", new Map([[FIRST, (node: any) => note(node, "mine")]]));
  await store.flush();
  assert.ok(ids(db.committed.payload, "evaluations").includes("EVAL-IMPORTED"));
  assert.equal(noteOf(db.committed.payload), "mine");
});

test("removing what someone else already removed is not a conflict", async () => {
  const { db, store } = await database();
  const field = ID_FIELDS.item_responses!;
  const id = payload.item_responses[0][field] as string;
  db.writeAsSomeoneElse((course) => {
    course.item_responses = course.item_responses.filter((entry: any) => entry[field] !== id);
  });
  store.remove(COURSE, "item_responses", [id]);
  await store.flush();
  assert.ok(!ids(db.committed.payload, "item_responses").includes(id));
});

// ------------------------------------------------------------ callers and YAML

test("a library writer handed a database store writes there, and no file", async () => {
  const { db, store } = await database();
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
  assert.ok(ids(store.load(COURSE).bundle, "integrity_cases").includes(opened.caseId));
  assert.deepEqual(readdirSync(root), [], "nothing was written under the root");
  await store.flush();
  assert.ok(ids(db.committed.payload, "integrity_cases").includes(opened.caseId));
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
  assert.ok(ids(store.load(COURSE).bundle, "evaluations").includes("EVAL-YAML-1"));

  store.edit(COURSE, "evaluations", new Map([["EVAL-YAML-1", (node: any) => note(node, "checked")]]));
  assert.match(readFileSync(path!, "utf-8"), /note: checked/);
  assert.equal(store.remove(COURSE, "evaluations", ["EVAL-YAML-1"]), 1);
  await store.flush();
});
