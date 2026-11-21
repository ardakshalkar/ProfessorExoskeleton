/**
 * A store kept equal to another: the files the authority, a replica sent the
 * whole course after each flush and after each file change it did not make,
 * and the one setting that decides whether a workspace is connected at all.
 */

import { strict as assert } from "node:assert";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { ID_FIELDS } from "../src/approval.ts";
import type { CourseBundle } from "../src/bundle.ts";
import { YamlCourseStore } from "../src/store/course.ts";
import { type CourseReplica, MirroredCourseStore } from "../src/store/mirror.ts";
import { DATABASE_ROLE_ENV, DATABASE_WORKSPACE_ENV, databaseFor, openCourseStore } from "../src/store/open.ts";
import { pruneRuntime } from "../src/sqlgen.ts";

const COURSE = "CSS-4008";
const EVALUATION_ID = ID_FIELDS.evaluations!;

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-mirror-"));
  cpSync(resolve(process.cwd(), "..", "workspace"), root, {
    recursive: true,
    filter: (path) => !/[\\/](golden|node_modules|\.git|dist|output)([\\/]|$)/.test(path),
  });
  return root;
};

/** A replica that keeps what it was sent, and can be told to fail. */
class Recorder implements CourseReplica {
  readonly label = "the recorder";
  sent: { courseId: string; bundle: CourseBundle }[] = [];
  fail: string | null = null;
  async replicate(courseId: string, bundle: CourseBundle): Promise<void> {
    if (this.fail) throw new Error(this.fail);
    this.sent.push({ courseId, bundle });
  }
}

const evaluationIds = (bundle: CourseBundle) => (bundle.evaluations as any[]).map((entry) => entry[EVALUATION_ID]);
const until = async (done: () => boolean, ms = 8000) => {
  const end = Date.now() + ms;
  while (!done() && Date.now() < end) await new Promise((wake) => setTimeout(wake, 50));
};

test("a write lands in the files and, on flush, the whole course reaches the replica", async () => {
  const root = workspace();
  const replica = new Recorder();
  const store = new MirroredCourseStore(new YamlCourseStore(root), replica);
  const template = structuredClone((store.load(COURSE).bundle!.evaluations as any[])[0]);
  const [path] = store.write(COURSE, { evaluations: [{ ...template, [EVALUATION_ID]: "EVAL-MIRRORED" }] });

  assert.match(readFileSync(path!, "utf-8"), /EVAL-MIRRORED/, "the files have it at once — they are the authority");
  assert.equal(replica.sent.length, 0);
  await store.flush();
  assert.equal(replica.sent.length, 1);
  assert.equal(replica.sent[0]!.courseId, COURSE);
  assert.ok(evaluationIds(replica.sent[0]!.bundle).includes("EVAL-MIRRORED"), "the course as the files now hold it");
  assert.equal(store.replicated.get(COURSE)?.ok, true);

  await store.flush();
  assert.equal(replica.sent.length, 1, "nothing changed, nothing sent");
});

test("a replica that fails is said, not thrown: the write already happened", async () => {
  const root = workspace();
  const replica = new Recorder();
  const said: string[] = [];
  const store = new MirroredCourseStore(new YamlCourseStore(root), replica, { say: (line) => said.push(line) });
  replica.fail = "connection refused";
  const template = structuredClone((store.load(COURSE).bundle!.evaluations as any[])[0]);
  store.write(COURSE, { evaluations: [{ ...template, [EVALUATION_ID]: "EVAL-KEPT" }] });
  await store.flush();
  assert.match(said.join("\n"), /CSS-4008 not mirrored to the recorder: connection refused/);
  assert.equal(store.replicated.get(COURSE)?.ok, false);
  assert.ok(evaluationIds(store.load(COURSE).bundle!).includes("EVAL-KEPT"), "the files keep the write");
});

test("a file changed around the store — a skill, a hand — is noticed and sent once it settles", async () => {
  const root = workspace();
  const replica = new Recorder();
  const store = new MirroredCourseStore(new YamlCourseStore(root, { watch: true }), replica);
  store.watch();
  try {
    const course = join(root, "courses", COURSE, "course.yaml");
    writeFileSync(course, readFileSync(course, "utf-8").replace(/^title: .*$/m, "title: Edited by hand"));
    await until(() => replica.sent.length > 0);
    assert.equal(replica.sent.length, 1, "one burst of changes, one send");
    assert.equal((replica.sent[0]!.bundle.course as any).title, "Edited by hand");
  } finally {
    store.close();
  }
});

test("catching up sends every course once", async () => {
  const root = workspace();
  const replica = new Recorder();
  const store = new MirroredCourseStore(new YamlCourseStore(root), replica);
  await store.catchUp();
  assert.deepEqual(replica.sent.map((entry) => entry.courseId), store.courseIds());
});

// ------------------------------------------------------------ the switch

const withEnv = async (values: Record<string, string | undefined>, run: () => void | Promise<void>) => {
  const before = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await run();
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

// The same folder spelled differently: on Windows case and backslashes do not matter, elsewhere only a trailing separator does.
const respelled = (path: string): string => (process.platform === "win32" ? path.toUpperCase() + "\\" : path + "/");

// An address nothing listens on: these tests never send, and must never reach a real database.
const NOWHERE = "postgresql://nobody:secret@127.0.0.1:1/nowhere";

test("a workspace is connected only when it is the one named — DATABASE_URL alone connects nothing", async () => {
  const root = workspace();
  await withEnv({ DATABASE_URL: NOWHERE, [DATABASE_WORKSPACE_ENV]: join(tmpdir(), "some-other-workspace") }, () => {
    assert.equal(databaseFor(root), null);
    assert.ok(openCourseStore(root) instanceof YamlCourseStore, "an unnamed workspace runs on its files alone");
  });
  await withEnv({ DATABASE_URL: NOWHERE, [DATABASE_WORKSPACE_ENV]: respelled(root), [DATABASE_ROLE_ENV]: undefined }, () => {
    const connected = databaseFor(root);
    assert.equal(connected?.role, "mirror", "named — case and a trailing separator aside — and mirror by default");
    assert.equal(connected?.target, "postgresql://nobody@127.0.0.1:1/nowhere", "the target is said without its password");
    const store = openCourseStore(root);
    assert.ok(store instanceof MirroredCourseStore);
    assert.ok(store.primary instanceof YamlCourseStore, "the files are the primary");
  });
});

test("the database as the authority is refused until it is built, rather than half-done", async () => {
  const root = workspace();
  await withEnv({ DATABASE_URL: NOWHERE, [DATABASE_WORKSPACE_ENV]: root, [DATABASE_ROLE_ENV]: "authority" }, () => {
    assert.throws(() => openCourseStore(root), /authority is not built yet/);
  });
  await withEnv({ DATABASE_URL: NOWHERE, [DATABASE_WORKSPACE_ENV]: root, [DATABASE_ROLE_ENV]: "boss" }, () => {
    assert.throws(() => openCourseStore(root), /one of mirror, authority/);
  });
});

test("the mirror's prune is scoped to the course's runs and keeps every row the files hold", () => {
  const bundle = new YamlCourseStore(workspace()).load(COURSE).bundle!;
  const sql = pruneRuntime(bundle);
  assert.match(sql, /DELETE FROM assessment\.evaluations WHERE submission_id IN \(SELECT id FROM assessment\.submissions WHERE assessment_id IN \(SELECT id FROM assessment\.assessments WHERE course_run_id IN \('[0-9a-f-]+'::uuid\)\)\) AND code <> ALL \(ARRAY\[/);
  const kept = evaluationIds(bundle)[0];
  assert.ok(sql.includes(`'${kept}'`), "the files' own evaluations are kept");
  assert.match(sql, /DELETE FROM learning\.action_items WHERE course_run_id IN/);
});
