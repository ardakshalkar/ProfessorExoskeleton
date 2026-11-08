import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyseForks,
  countAt,
  merged,
  needsRead,
  weekOf,
  weekly,
  type ActivityCache,
  type GithubGet,
} from "../src/fork-activity.ts";
import type { Fork } from "../src/forks.ts";

const fork = (owner: string, pushed_at: string | null): Fork => ({
  owner,
  repo: `${owner}/hw3`,
  url: `https://github.com/${owner}/hw3`,
  pushed_at,
  created_at: null,
  default_branch: "main",
});

const commit = (sha: string, date: string, author = "aliya") => ({ sha, commit: { author: { date } }, author: { login: author } });

/** A GitHub whose compare answers from a table, counting what it was asked. */
const github = (table: Record<string, any[]>, asked: string[] = []): GithubGet => async (path) => {
  asked.push(path);
  const owner = /\.\.\.([^%:]+)(?:%3A|:)/.exec(path)?.[1] ?? "";
  if (!(owner in table)) return { status: 404, body: null };
  return { status: 200, body: { ahead_by: table[owner]!.length, total_commits: table[owner]!.length, commits: table[owner] } };
};

const START = "2026-10-06T00:00:00Z";

test("week 1 is the seven days from the start, and before it is week 0", () => {
  assert.equal(weekOf("2026-10-06T00:00:00Z", START), 1);
  assert.equal(weekOf("2026-10-12T23:59:59Z", START), 1);
  assert.equal(weekOf("2026-10-13T00:00:00Z", START), 2);
  assert.equal(weekOf("2026-10-01T00:00:00Z", START), 0);
  assert.equal(weekOf(null, START), null);
});

test("a fork is read again only when it was pushed since, or failed", () => {
  const before = merged(undefined, fork("aliya", "2026-10-07T10:00:00Z"), { head: "a", ahead_by: 1, commits: [] }, "2026-10-08T00:00:00Z");
  assert.equal(needsRead(before, fork("aliya", "2026-10-07T10:00:00Z")), false);
  assert.equal(needsRead(before, fork("aliya", "2026-10-09T10:00:00Z")), true);
  assert.equal(needsRead(undefined, fork("aliya", null)), true);
  assert.equal(needsRead({ ...before, error: "gone" }, fork("aliya", "2026-10-07T10:00:00Z")), true);
});

test("a commit keeps the time it was first seen; a snapshot is added only when the fork moved", () => {
  const f = fork("aliya", null);
  const one = merged(undefined, f, { head: "a", ahead_by: 1, commits: [{ sha: "a", date: "2026-10-07T00:00:00Z", author: "aliya" }] }, "2026-10-08T00:00:00Z");
  const two = merged(
    one,
    f,
    {
      head: "b",
      ahead_by: 2,
      commits: [
        { sha: "a", date: "2026-10-07T00:00:00Z", author: "aliya" },
        { sha: "b", date: "2026-10-14T00:00:00Z", author: "aliya" },
      ],
    },
    "2026-10-15T00:00:00Z",
  );
  assert.deepEqual(two.commits.map((c) => [c.sha, c.seen]), [
    ["a", "2026-10-08T00:00:00Z"],
    ["b", "2026-10-15T00:00:00Z"],
  ]);
  assert.equal(two.snapshots.length, 2);
  const same = merged(two, f, { head: "b", ahead_by: 2, commits: two.commits }, "2026-10-20T00:00:00Z");
  assert.equal(same.snapshots.length, 2);
  // The count on any date comes from the snapshots.
  assert.equal(countAt(same, "2026-10-10T00:00:00Z"), 1);
  assert.equal(countAt(same, "2026-10-21T00:00:00Z"), 2);
  assert.equal(countAt(same, "2026-10-01T00:00:00Z"), null);
});

test("a commit rewritten away is kept as gone, not dropped", () => {
  const f = fork("aliya", null);
  const one = merged(undefined, f, { head: "a", ahead_by: 1, commits: [{ sha: "a", date: null, author: null }] }, "2026-10-08T00:00:00Z");
  const two = merged(one, f, { head: "c", ahead_by: 1, commits: [{ sha: "c", date: null, author: null }] }, "2026-10-09T00:00:00Z");
  assert.equal(two.commits.find((c) => c.sha === "a")?.gone, "2026-10-09T00:00:00Z");
  assert.equal(weekly(two, START, 4).gone, 1);
});

test("weeks by when they were seen, not by the date the commit claims; a redated commit is flagged", () => {
  const f = fork("aliya", null);
  // First analysis on day 3 finds one commit: nothing says when it arrived, so it goes by its date.
  const one = merged(undefined, f, { head: "a", ahead_by: 1, commits: [{ sha: "a", date: "2026-10-07T00:00:00Z", author: "aliya" }] }, "2026-10-08T00:00:00Z");
  // Week 3: a commit claiming week 1 appears — after an analysis that did not have it.
  const two = merged(
    one,
    f,
    {
      head: "b",
      ahead_by: 2,
      commits: [
        { sha: "a", date: "2026-10-07T00:00:00Z", author: "aliya" },
        { sha: "b", date: "2026-10-06T12:00:00Z", author: "bolat" },
      ],
    },
    "2026-10-21T00:00:00Z",
  );
  const seen = weekly(two, START, 4, "seen");
  assert.deepEqual(seen.weeks, [0, 1, 0, 1, 0]);
  assert.equal(seen.unverified, 1);
  assert.equal(seen.late_dated, 1);
  assert.equal(seen.by_others, 1);
  assert.deepEqual(weekly(two, START, 4, "date").weeks, [0, 2, 0, 0, 0]);
});

test("an analysis reads only the forks that moved, and keeps a deleted fork's history", async () => {
  const saved: ActivityCache[] = [];
  const asked: string[] = [];
  const first = await analyseForks({
    get: github({ aliya: [commit("a", "2026-10-07T00:00:00Z")], bolat: [] }, asked),
    template: "narxoz/hw3",
    baseBranch: "main",
    forks: [fork("aliya", "2026-10-07T00:00:00Z"), fork("bolat", "2026-10-07T00:00:00Z"), fork("gone", "2026-10-07T00:00:00Z")],
    previous: null,
    assessmentId: "ASSESSMENT-HW3",
    save: (cache) => saved.push(structuredClone(cache)),
    now: () => "2026-10-08T00:00:00Z",
  });
  assert.deepEqual(first.report, { read: 2, skipped: 0, failed: 1, left: 0 });
  assert.equal(first.cache.forks["aliya/hw3"]!.ahead_by, 1);
  assert.match(first.cache.forks["gone/hw3"]!.error ?? "", /no such fork/);
  assert.equal(asked.filter((path) => path.includes("/compare/")).length, 3);
  // The profile names, once each, for the forks that could be read.
  assert.deepEqual(asked.filter((path) => path.startsWith("/users/")).sort(), ["/users/aliya", "/users/bolat"]);

  const again: string[] = [];
  const second = await analyseForks({
    get: github({ aliya: [commit("a", "2026-10-07T00:00:00Z"), commit("b", "2026-10-14T00:00:00Z")], bolat: [] }, again),
    template: "narxoz/hw3",
    baseBranch: "main",
    // aliya pushed; bolat did not; `gone` is no longer listed.
    forks: [fork("aliya", "2026-10-14T00:00:00Z"), fork("bolat", "2026-10-07T00:00:00Z")],
    previous: first.cache,
    assessmentId: "ASSESSMENT-HW3",
    save: () => {},
    now: () => "2026-10-15T00:00:00Z",
  });
  assert.equal(again.length, 1, "one compare, and no profile asked twice");
  assert.match(again[0]!, /aliya/);
  assert.deepEqual(second.report, { read: 1, skipped: 1, failed: 0, left: 0 });
  assert.equal(second.cache.forks["aliya/hw3"]!.snapshots.length, 2);
  assert.ok(second.cache.forks["gone/hw3"], "a fork no longer listed keeps what it had");
  assert.ok(saved.length >= 3, "saved after each fork");
});

test("a spent hourly limit stops the run and leaves the rest for later", async () => {
  const limited: GithubGet = async () => ({ status: 403, body: null, limited: true, message: "limit" });
  const run = await analyseForks({
    get: limited,
    template: "narxoz/hw3",
    baseBranch: "main",
    forks: [fork("a", null), fork("b", null), fork("c", null)],
    previous: null,
    assessmentId: "ASSESSMENT-HW3",
    save: () => {},
    limit: 1,
  });
  assert.equal(run.report.left, 3);
  assert.equal(run.cache.analysed_at, null);
});

test("a profile's name is kept with the fork and asked for once", async () => {
  const get: GithubGet = async (path) =>
    path.startsWith("/users/")
      ? { status: 200, body: { name: " Аружан Абуова " } }
      : { status: 200, body: { ahead_by: 0, total_commits: 0, commits: [] } };
  const run = await analyseForks({
    get,
    template: "narxoz/hw3",
    baseBranch: "main",
    forks: [fork("aruzhan-png", null)],
    previous: null,
    assessmentId: "ASSESSMENT-HW3",
    save: () => {},
  });
  assert.equal(run.cache.forks["aruzhan-png/hw3"]!.owner_name, "Аружан Абуова");
  // Read again (pushed since): the name stays without a second ask.
  const asked: string[] = [];
  const again = await analyseForks({
    get: async (path) => (asked.push(path), get(path)),
    template: "narxoz/hw3",
    baseBranch: "main",
    forks: [fork("aruzhan-png", "2026-11-01T00:00:00Z")],
    previous: run.cache,
    assessmentId: "ASSESSMENT-HW3",
    save: () => {},
  });
  assert.equal(again.cache.forks["aruzhan-png/hw3"]!.owner_name, "Аружан Абуова");
  assert.ok(!asked.some((path) => path.startsWith("/users/")));
});
