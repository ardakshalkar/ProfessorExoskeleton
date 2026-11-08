/**
 * Students · Forks: *Match* keeps an account in the roster store.
 *
 *     node --test test/forks-view.test.mjs
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { matchAccount } from "../server/forks-view.js";

const store = (people) => {
  const dir = mkdtempSync(join(tmpdir(), "forks-match-"));
  writeFileSync(join(dir, "people.json"), JSON.stringify({ version: 1, people }));
  return dir;
};
const read = (dir) => JSON.parse(readFileSync(join(dir, "people.json"), "utf-8")).people;

test("Match records the account for the student, and × takes it back", () => {
  const dir = store({ "STUDENT-A": { name: "Aliya K" }, "STUDENT-B": { name: "Bolat" } });
  try {
    assert.equal(matchAccount(dir, "STUDENT-A", "@Aliya-K").ok, true);
    assert.equal(read(dir)["STUDENT-A"].github, "Aliya-K");
    assert.equal(matchAccount(dir, "STUDENT-A", null).ok, true);
    assert.equal(read(dir)["STUDENT-A"].github, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an account another student already has is saved, and the doubt is said", () => {
  const dir = store({ "STUDENT-A": { name: "A", github: "shared" }, "STUDENT-B": { name: "B" } });
  try {
    const answer = matchAccount(dir, "STUDENT-B", "Shared");
    assert.equal(answer.ok, true);
    assert.match(answer.note, /STUDENT-A has the same account/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("not an account, or nobody the store holds, is refused and nothing is written", () => {
  const dir = store({ "STUDENT-A": { name: "A" } });
  try {
    assert.match(matchAccount(dir, "STUDENT-A", "not an account").error, /not a GitHub account/);
    assert.match(matchAccount(dir, "STUDENT-Z", "zed").error, /not in the local roster/);
    assert.equal(read(dir)["STUDENT-A"].github, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
