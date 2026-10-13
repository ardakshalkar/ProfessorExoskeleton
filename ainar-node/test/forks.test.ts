import assert from "node:assert/strict";
import { test } from "node:test";

import { forkChoices, githubLogin, loginOf, recordedLogins, studentsByLogin, toForks, type ForkCache } from "../src/forks.ts";

const listed = [
  { owner: { login: "Aliya-K" }, full_name: "Aliya-K/hw3", html_url: "https://github.com/Aliya-K/hw3", pushed_at: "2026-10-01T10:00:00Z" },
  { owner: { login: "aliya-k" }, full_name: "aliya-k/hw3-again", html_url: "https://github.com/aliya-k/hw3-again", pushed_at: "2026-10-03T10:00:00Z" },
  { owner: { login: "bolat" }, full_name: "bolat/hw3", html_url: "https://github.com/bolat/hw3", pushed_at: null },
  { owner: { login: "shared" }, full_name: "shared/hw3", html_url: "https://github.com/shared/hw3" },
  { owner: { login: "stranger" }, full_name: "stranger/hw3", html_url: "https://github.com/stranger/hw3" },
  { owner: { login: "hidden" }, full_name: "hidden/hw3", private: true },
];
const cache: ForkCache = {
  assessment_id: "ASSESSMENT-HW3",
  template_repo: "narxoz/hw3",
  looked_up_at: "2026-10-13T00:00:00Z",
  forks: toForks(listed),
};
const submissions = [
  { student_id: "STUDENT-A", assessment_id: "ASSESSMENT-HW1", url: "https://github.com/aliya-k/hw1/tree/main" },
  { student_id: "STUDENT-B", assessment_id: "ASSESSMENT-HW1", url: "https://github.com/Bolat/hw1" },
  { student_id: "STUDENT-C", assessment_id: "ASSESSMENT-HW1", url: "https://github.com/shared/hw1" },
  { student_id: "STUDENT-D", assessment_id: "ASSESSMENT-HW1", url: "https://github.com/shared/hw1" },
  { student_id: "STUDENT-E", assessment_id: "ASSESSMENT-HW3", url: "https://github.com/stranger/hw3/" },
];

test("a link's account, and nothing for what is not a GitHub repository", () => {
  assert.equal(loginOf("https://github.com/Aliya-K/hw1/blob/main/a.py"), "aliya-k");
  assert.equal(loginOf("https://github.com/aliya-k"), null);
  assert.equal(loginOf("https://gitlab.com/a/b"), null);
  assert.equal(loginOf("not a link"), null);
});

test("an account two students' links name belongs to neither", () => {
  const owners = studentsByLogin(submissions);
  assert.equal(owners.get("aliya-k"), "STUDENT-A");
  assert.equal(owners.get("shared"), undefined);
});

test("private forks are not listed", () => {
  assert.ok(!cache.forks.some((fork) => fork.owner === "hidden"));
});

test("their own fork is found by the account an earlier homework named, the latest push winning", () => {
  const choices = forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-A");
  assert.equal(choices.theirs?.repo, "aliya-k/hw3-again");
});

test("the pick list leaves out forks someone owns or has handed in", () => {
  const choices = forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-F");
  assert.equal(choices.theirs, null);
  // `shared` is nobody's, so it stays pickable; `stranger` is handed in by E.
  assert.deepEqual(choices.unclaimed.map((fork) => fork.owner), ["shared"]);
});

test("no lookup yet, nothing offered", () => {
  assert.deepEqual(forkChoices(null, submissions, "ASSESSMENT-HW3", "STUDENT-A"), { theirs: null, how: null, unclaimed: [] });
});

test("a link-learned fork says so", () => {
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-A").how, "link");
});

test("an account as a professor might write it", () => {
  assert.equal(githubLogin("aliya-k"), "aliya-k");
  assert.equal(githubLogin(" @Aliya-K "), "Aliya-K");
  assert.equal(githubLogin("https://github.com/aliya-k"), "aliya-k");
  assert.equal(githubLogin("github.com/aliya-k/hw1"), "aliya-k");
  assert.equal(githubLogin("aliya k"), null);
  assert.equal(githubLogin("-aliya"), null);
  assert.equal(githubLogin("aliya--k"), null);
  assert.equal(githubLogin(""), null);
  assert.equal(githubLogin(undefined), null);
});

test("the roster store's recorded accounts, and nothing for a person without one", () => {
  assert.deepEqual(
    recordedLogins({
      "STUDENT-A": { github: "aliya-k" },
      "STUDENT-B": {},
      "STUDENT-C": { github: "not an account" },
    }),
    { "STUDENT-A": "aliya-k" },
  );
  assert.deepEqual(recordedLogins(null), {});
});

/* The real course hands in no links: the marks come off a sheet. */
const noLinks = [{ student_id: "STUDENT-G", assessment_id: "ASSESSMENT-HW1" }];

test("a recorded account finds their fork from the first homework, with no link on record", () => {
  const choices = forkChoices(cache, noLinks, "ASSESSMENT-HW3", "STUDENT-G", { "STUDENT-G": "Bolat" });
  assert.equal(choices.theirs?.repo, "bolat/hw3");
  assert.equal(choices.how, "recorded");
  // And it is no longer anyone else's to pick.
  const other = forkChoices(cache, noLinks, "ASSESSMENT-HW3", "STUDENT-H", { "STUDENT-G": "Bolat" });
  assert.ok(!other.unclaimed.some((fork) => fork.owner === "bolat"));
});

test("a recorded account wins over a link that names someone else", () => {
  // B's HW1 link is under `bolat`; the professor recorded `bolat` for G.
  const recorded = { "STUDENT-G": "bolat" };
  assert.equal(studentsByLogin(submissions, recorded).get("bolat"), "STUDENT-G");
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-G", recorded).theirs?.repo, "bolat/hw3");
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-B", recorded).theirs, null);
});

test("a student with a recorded account is matched by it alone, not by the links they handed in", () => {
  // A once handed in a link under `aliya-k`; the professor recorded `bolat` for A.
  const recorded = { "STUDENT-A": "bolat" };
  const owners = studentsByLogin(submissions, recorded);
  assert.equal(owners.get("bolat"), "STUDENT-A");
  assert.equal(owners.get("aliya-k"), undefined);
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-A", recorded).theirs?.repo, "bolat/hw3");
});

test("an account recorded for two students is nobody's", () => {
  const recorded = { "STUDENT-G": "bolat", "STUDENT-H": "BOLAT" };
  const owners = studentsByLogin(submissions, recorded);
  // Not G's, not H's — and not B's either, though B's link names it: the
  // professor's word is in doubt, and a link does not settle it.
  assert.equal(owners.get("bolat"), undefined);
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-G", recorded).theirs, null);
  assert.equal(forkChoices(cache, submissions, "ASSESSMENT-HW3", "STUDENT-B", recorded).theirs, null);
});

test("a recorded account that is not a GitHub account is ignored", () => {
  const choices = forkChoices(cache, noLinks, "ASSESSMENT-HW3", "STUDENT-G", { "STUDENT-G": "bolat hw3" });
  assert.equal(choices.theirs, null);
});
