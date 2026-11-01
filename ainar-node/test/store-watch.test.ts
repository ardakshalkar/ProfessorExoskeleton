/**
 * A watching course store (`YamlCourseStore` with `watch`, store/course.ts):
 * a quiet folder is not walked again, and the course is read again after a
 * change seen by the watch or a write this process made.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { YamlCourseStore } from "../src/store/course.ts";
import { noteCourseWrite } from "../src/store/written.ts";

const SAMPLE = fileURLToPath(new URL("../../workspace", import.meta.url));

/** A copy of the sample workspace's first course, in a folder of its own. */
const copy = (): { root: string; courseId: string } => {
  const courseId = readdirSync(join(SAMPLE, "courses"))[0]!;
  const root = mkdtempSync(join(tmpdir(), "store-watch-"));
  cpSync(join(SAMPLE, "courses", courseId), join(root, "courses", courseId), { recursive: true });
  return { root, courseId };
};

/** A file of the course, touched as an editor saving it would. */
const touch = (root: string, courseId: string): void => {
  const folder = join(root, "courses", courseId);
  const file = readdirSync(folder, { recursive: true, withFileTypes: true }).find((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))!;
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(file.parentPath, file.name), later, later);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test("a quiet course is answered from what was loaded", () => {
  const { root, courseId } = copy();
  const store = new YamlCourseStore(root, { watch: true });
  const first = store.load(courseId);
  assert.equal(store.load(courseId), first);
  assert.equal(store.load(courseId), first);
});

test("a change the watch sees is read on the next load", async () => {
  const { root, courseId } = copy();
  const store = new YamlCourseStore(root, { watch: true });
  const first = store.load(courseId);
  await settle();
  touch(root, courseId);
  await settle();
  assert.notEqual(store.load(courseId), first);
});

test("this process's own write is read at once, before any watch event", () => {
  const { root, courseId } = copy();
  const store = new YamlCourseStore(root, { watch: true });
  const first = store.load(courseId);
  touch(root, courseId);
  noteCourseWrite();
  assert.notEqual(store.load(courseId), first);
});

test("a store that does not watch walks every time, as before", () => {
  const { root, courseId } = copy();
  const store = new YamlCourseStore(root);
  const first = store.load(courseId);
  touch(root, courseId);
  assert.notEqual(store.load(courseId), first);
});
