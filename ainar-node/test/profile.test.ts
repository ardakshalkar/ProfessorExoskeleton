import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { decidedAt } from "../src/records-write.ts";
import { LEGACY_INSTITUTION, mergeLayers, resetActiveProfile, resolveProfile, useWorkspaceProfile } from "../src/profile.ts";

const root = mkdtempSync(join(tmpdir(), "profile-"));
after(() => {
  resetActiveProfile();
  rmSync(root, { recursive: true, force: true });
});

const layer = (path: string, values: object): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `version: 1\nscope: x\nvalues: ${JSON.stringify(values)}\n`);
};

test("a workspace that names no institution gets the legacy pack, and says so", () => {
  const { profile, institutionSource } = resolveProfile({ root });
  assert.equal(institutionSource, "legacy-default");
  assert.equal(profile.institution, LEGACY_INSTITUTION);
  assert.equal(profile.locale.timezone, "Asia/Almaty");
  assert.deepEqual(profile.marking.late_marks.map((mark) => mark.word), ["T", "LT", "LLT"]);
});

test("a pack that is not shipped is an error, not a silent fallback", () => {
  assert.throws(() => resolveProfile({ institution: "nowhere-u" }), /No institution pack nowhere-u/);
  assert.throws(() => resolveProfile({ institution: "../etc" }), /not a pack name/);
});

test("layers beat each other in order: institution < professor < course < run < task", () => {
  const home = join(root, "home");
  layer(join(home, "preferences.yaml"), { locale: { timezone: "Europe/Berlin" } });
  assert.equal(resolveProfile({ root, professorHome: home }).profile.locale.timezone, "Europe/Berlin");

  layer(join(root, "courses", "AAA-100", "preferences.yaml"), { locale: { timezone: "America/New_York" } });
  assert.equal(resolveProfile({ root, professorHome: home, courseId: "AAA-100" }).profile.locale.timezone, "America/New_York");

  layer(join(root, "courses", "AAA-100", "versions", "2026-FALL", "preferences.yaml"), { locale: { timezone: "Asia/Tokyo" } });
  const run = resolveProfile({ root, professorHome: home, courseId: "AAA-100", term: "2026-FALL" });
  assert.equal(run.profile.locale.timezone, "Asia/Tokyo");
  assert.deepEqual(run.layers.map((entry) => entry.scope), ["system", "professor", "course", "run", "institution"]);

  const task = resolveProfile({ root, professorHome: home, courseId: "AAA-100", term: "2026-FALL", task: { locale: { timezone: "UTC" } } });
  assert.equal(task.profile.locale.timezone, "UTC");

  // The layer below still says what it said: a course's own zone does not leak to a sibling course.
  assert.equal(resolveProfile({ root, professorHome: home, courseId: "BBB-200" }).profile.locale.timezone, "Europe/Berlin");
});

test("the highest layer that names an institution wins; the system layer is neutral", () => {
  const home = join(root, "home2");
  layer(join(home, "preferences.yaml"), { institution: "narxoz" });
  assert.equal(resolveProfile({ root, professorHome: home }).institutionSource, "professor");
  layer(join(root, "courses", "CCC-300", "preferences.yaml"), { institution: "narxoz" });
  assert.equal(resolveProfile({ root, professorHome: home, courseId: "CCC-300" }).institutionSource, "course");
});

test("lists of {id} objects merge by id, later order first; other lists are replaced", () => {
  const merged = mergeLayers(
    { presets: [{ id: "a", title: "A", n: 1 }, { id: "b", title: "B" }], words: ["x", "y"] },
    { presets: [{ id: "b", title: "B2" }, { id: "c", title: "C" }], words: ["z"] },
  );
  assert.deepEqual(merged.presets, [{ id: "b", title: "B2" }, { id: "c", title: "C" }, { id: "a", title: "A", n: 1 }]);
  assert.deepEqual(merged.words, ["z"]);
});

test("an empty value inherits; null in the lowest layer survives", () => {
  assert.deepEqual(mergeLayers({ a: 1, b: { c: 2 } }, { a: "", b: { c: undefined } }), { a: 1, b: { c: 2 } });
  assert.deepEqual(mergeLayers(undefined, { parent: null }), { parent: null });
});

test("the Narxoz pack's grading vocabulary is the old built-in one", () => {
  const { profile } = resolveProfile({ institution: "narxoz" });
  assert.deepEqual(profile.grading.presets.map((preset) => preset.id), ["vsk", "vsk-blocks", "admission", "categories", "flat"]);
  assert.equal(profile.grading.period_boundary, "first_midterm");
  assert.equal(profile.marking.defence.partial_factor, 0.5);
  const final = new RegExp(profile.grading.final_matchers.map((source) => `(?:${source})`).join("|"), "i");
  for (const text of ["FINAL-1 x", "Итоговый", "Экзамен", "ФИНАЛ"]) assert.ok(final.test(text), text);
  assert.ok(!final.test("MIDTERM-1 Midterm"));
});

test("with no pack opinions of its own, the system layer is neutral", () => {
  const { profile } = resolveProfile({ institution: "narxoz", task: { locale: { timezone: "UTC" } } });
  assert.equal(profile.locale.timezone, "UTC");
  assert.ok(profile.grading.presets.some((preset) => preset.id === "flat"));
});

test("stamps follow the workspace profile, not a built-in zone", () => {
  const instant = new Date("2026-10-18T04:00:00Z");
  const home = join(root, "home3");
  layer(join(home, "preferences.yaml"), { locale: { timezone: "UTC" } });
  useWorkspaceProfile({ root, professorHome: home });
  assert.equal(decidedAt(undefined, instant), "2026-10-18T04:00:00+00:00");
  assert.equal(decidedAt("Asia/Almaty", instant), "2026-10-18T09:00:00+05:00");
  // An unknown run zone falls back to the profile's, not to +05:00.
  assert.equal(decidedAt("Not/AZone", instant), "2026-10-18T04:00:00+00:00");
  resetActiveProfile();
  assert.equal(decidedAt(undefined, instant), "2026-10-18T09:00:00+05:00");
});
