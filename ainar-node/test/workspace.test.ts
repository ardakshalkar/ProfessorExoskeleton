/**
 * The cache serves a course the professor is still editing.
 *
 * Nothing in the read surface writes, so caching a parsed course for the life of
 * the process looks free. It is not: `ainar roster import` and `ainar approve`
 * both write into `courses/` from another process, and under Claude Desktop this
 * one lives until the app restarts. A cache that never notices is a server that
 * answers "27 students" all afternoon after you imported the twenty-eighth.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Workspace, workspaceRootFor } from "../src/workspace.ts";

const COURSE = "CSS-9001";

/** A workspace holding its one course run and `students` enrollments. */
const scaffold = (students: number): string => {
  const root = mkdtempSync(join(tmpdir(), "ainar-ws-"));
  const course = join(root, "courses", COURSE);
  mkdirSync(course, { recursive: true });

  writeFileSync(
    join(course, "course.yaml"),
    `course_id: ${COURSE}\ntitle: Cache Test\n`,
  );
  writeFileSync(
    join(course, "version.yaml"),
    `course_version_id: ${COURSE}-2026-FALL\ncourse_id: ${COURSE}\n` +
      `term: 2026-FALL\nstart_date: 2026-09-01\nend_date: 2026-12-20\n`,
  );
  writeEnrollments(root, students);
  return root;
};

const writeEnrollments = (root: string, students: number): void => {
  const rows = Array.from({ length: students }, (_, index) => {
    const id = `STUDENT-${9000 + index}`;
    return (
      `  - enrollment_id: ENR-${9000 + index}\n` +
      `    course_version_id: ${COURSE}-2026-FALL\n` +
      `    student_id: ${id}\n`
    );
  }).join("");
  const path = join(root, "courses", COURSE, "enrollments.yaml");
  writeFileSync(path, `enrollments:\n${rows}`);
  // Windows mtime resolution can be coarse enough that two writes inside one
  // test share a timestamp, which would make this pass for the wrong reason.
  const future = new Date(Date.now() + 2000);
  utimesSync(path, future, future);
};

test("a second call with nothing changed reuses the parsed course", () => {
  const workspace = new Workspace(scaffold(2));
  assert.equal(workspace.load(COURSE), workspace.load(COURSE));
});

test("an enrollment added by another process is picked up", () => {
  const root = scaffold(2);
  const workspace = new Workspace(root);
  assert.equal(workspace.load(COURSE).bundle!.enrollments.length, 2);

  writeEnrollments(root, 3); // as `ainar roster import` would

  assert.equal(workspace.load(COURSE).bundle!.enrollments.length, 3);
});


// --------------------------------------------------------------------------
// Which workspace a caller is standing in
// --------------------------------------------------------------------------
//
// `ainar`'s CLI walks up from the working directory, the DeepSeek Harness
// bundle walks up from the session's `cwd`, and the professor's pane walks up
// from the directory the sidebar registered. One function, because the failure
// of two is not a crash: two halves of one screen naming different courses,
// with nothing on either to show which is which.

/** A workspace root, plus a nested path inside one of its courses. */
const nested = (): { root: string; deep: string } => {
  const root = mkdtempSync(join(tmpdir(), "ainar-root-"));
  const deep = join(root, "courses", COURSE, "records");
  mkdirSync(deep, { recursive: true });
  return { root, deep };
};

test("a directory holding courses/ is its own workspace root", () => {
  const { root } = nested();
  assert.equal(workspaceRootFor(root), root);
});

test("a directory inside a course resolves to the workspace above it", () => {
  const { root, deep } = nested();
  // The case the whole function is for: a session opened on a course folder,
  // or on some homework directory inside one, is still a session about that
  // workspace — the way `git` works from a subdirectory.
  assert.equal(workspaceRootFor(deep), root);
});

test("a directory with no courses/ anywhere above it resolves to null", () => {
  // Null rather than a throw, and rather than the filesystem root: the caller
  // decides what to do without a workspace, and in the bundle that decision is
  // to fall back to AINAR_WORKSPACE.
  assert.equal(workspaceRootFor(mkdtempSync(join(tmpdir(), "ainar-bare-"))), null);
});

test("no directory at all resolves to null rather than to the process cwd", () => {
  // `undefined` is what a caller with no session hands in. Resolving it to
  // `process.cwd()` would make the answer depend on where dsh happened to be
  // started, which is the one thing nobody on screen can see.
  assert.equal(workspaceRootFor(undefined), null);
  assert.equal(workspaceRootFor(null), null);
  assert.equal(workspaceRootFor(""), null);
});

test("the nearest workspace wins over one further up", () => {
  // A course repository checked out inside another workspace. Standing in the
  // inner one means the inner one; a walk that ran to the outermost match
  // would validate the wrong course from inside the right folder.
  const outer = mkdtempSync(join(tmpdir(), "ainar-outer-"));
  mkdirSync(join(outer, "courses"), { recursive: true });
  const inner = join(outer, "nested", "second-workspace");
  mkdirSync(join(inner, "courses"), { recursive: true });
  assert.equal(workspaceRootFor(inner), inner);
});

test("a file named courses is not a workspace", () => {
  // `isDirectory()` and not `existsSync`: a stray `courses` file would
  // otherwise capture the walk and every load underneath it would fail with a
  // message about YAML rather than about the folder.
  const root = mkdtempSync(join(tmpdir(), "ainar-file-"));
  writeFileSync(join(root, "courses"), "not a directory");
  assert.equal(workspaceRootFor(root), null);
});
