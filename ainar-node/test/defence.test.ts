import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkQuestions,
  cloneAtHandIn,
  codeDigest,
  collectCode,
  defencePlace,
  readDefence,
  repoUrl,
  writeDefence,
  type Git,
} from "../src/defence.ts";

test("a GitHub link to a page inside a repository is cut back to the repository", () => {
  assert.equal(repoUrl("https://github.com/student-a/css4007-hw1/tree/main/src"), "https://github.com/student-a/css4007-hw1");
  assert.equal(repoUrl(" https://github.com/student-a/css4007-hw1.git "), "https://github.com/student-a/css4007-hw1");
});

test("only an https link to somewhere else is cloned", () => {
  assert.throws(() => repoUrl("file:///etc"), /only https/);
  assert.throws(() => repoUrl("git@github.com:a/b.git"), /not a link/);
  assert.throws(() => repoUrl("https://localhost/a/b"), /this machine/);
  assert.throws(() => repoUrl("https://github.com/student-a"), /names no repository/);
});

test("the private clone and the pseudonymous questions live in two places", () => {
  const place = defencePlace("/subs", "/ws", "CSS-4007-2026-FALL", "ASSESSMENT-HW1", "STUDENT-JNG7SN");
  assert.equal(place.repo, join("/subs", "CSS-4007-2026-FALL", "ASSESSMENT-HW1", "STUDENT-JNG7SN", "defence", "repo"));
  assert.equal(place.questions, join("/ws", "output", "CSS-4007-2026-FALL", "defence", "ASSESSMENT-HW1", "STUDENT-JNG7SN.yaml"));
});

/** A git that answers from a script and records what it was asked. */
const fakeGit = (answers: Record<string, string>): { git: Git; calls: string[][] } => {
  const calls: string[][] = [];
  const git: Git = async (args) => {
    calls.push(args);
    if (args[0] === "clone") mkdirSync(join(args.at(-1)!, ".git"), { recursive: true });
    return answers[args[0]!] ?? "";
  };
  return { git, calls };
};

test("the clone is pinned to the last commit before the hand-in, not the head", async () => {
  const repoDir = join(mkdtempSync(join(tmpdir(), "defence-")), "repo");
  const { git, calls } = fakeGit({ "rev-parse": "head000", "rev-list": "handin1", show: "2026-10-15T20:00:00+05:00" });
  const pin = await cloneAtHandIn({
    url: "https://github.com/student-a/css4007-hw1",
    repoDir,
    submittedAt: "2026-10-15T23:59:00+05:00",
    git,
    now: new Date("2026-10-20T10:00:00Z"),
  });
  assert.equal(pin.commit, "handin1");
  assert.equal(pin.head, "head000");
  assert.equal(pin.pinned_by, "submitted_at");
  assert.deepEqual(calls.find((c) => c[0] === "rev-list"), ["rev-list", "-1", "--before=2026-10-15T23:59:00+05:00", "HEAD"]);
  assert.deepEqual(calls.find((c) => c[0] === "checkout"), ["checkout", "--quiet", "--detach", "handin1"]);

  // Asked again, the pinned clone is reused: the questions cite that commit.
  const again = fakeGit({});
  assert.equal(await cloneAtHandIn({ url: pin.url, repoDir, previous: pin, git: again.git }), pin);
  assert.equal(again.calls.length, 0);
});

test("without a hand-in time the head is used, and the pin says so", async () => {
  const repoDir = join(mkdtempSync(join(tmpdir(), "defence-")), "repo");
  const { git } = fakeGit({ "rev-parse": "head000" });
  const pin = await cloneAtHandIn({ url: "https://github.com/a/b", repoDir, git });
  assert.equal(pin.commit, "head000");
  assert.equal(pin.pinned_by, "head");
  assert.equal(pin.note, undefined);
});

test("a link handed in before anything was pushed is defended on the head, and says so", async () => {
  const repoDir = join(mkdtempSync(join(tmpdir(), "defence-")), "repo");
  const { git } = fakeGit({ "rev-parse": "head000", "rev-list": "" });
  const pin = await cloneAtHandIn({ url: "https://github.com/a/b", repoDir, submittedAt: "2026-10-01T09:00:00+05:00", git });
  assert.equal(pin.pinned_by, "head");
  assert.match(pin.note!, /every commit came after it/);
});

const sampleRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "repo-"));
  writeFileSync(join(dir, "train.py"), "import pandas\n\ndef split(df):\n    return df[:80], df[80:]\n");
  writeFileSync(join(dir, "README.md"), "# HW1\n");
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, ".git", "config"), "[core]\n");
  writeFileSync(
    join(dir, "analysis.ipynb"),
    JSON.stringify({ cells: [{ cell_type: "code", source: ["x = 1\n", "print(x)"], outputs: [{ text: "1" }] }] }),
  );
  return dir;
};

test("code is read first, numbered, notebooks as their cells, and data and .git left out", () => {
  const { files, unread } = collectCode(sampleRepo());
  assert.deepEqual(files.map((f) => f.path).sort(), ["README.md", "analysis.ipynb", "train.py"]);
  assert.equal(files.at(-1)!.path, "README.md");
  const train = files.find((f) => f.path === "train.py")!;
  assert.match(train.text, /^3│ def split\(df\):$/m);
  const notebook = files.find((f) => f.path === "analysis.ipynb")!;
  assert.match(notebook.text, /cell 1 \(code\)/);
  assert.doesNotMatch(notebook.text, /outputs/);
  assert.deepEqual(unread, []);
});

test("what does not fit the budget is named rather than silently left out", () => {
  const { files, unread } = collectCode(sampleRepo(), 80);
  assert.ok(files.length < 3);
  assert.ok(unread.length >= 1);
});

const CRITERIA = [{ criterion_id: "CRIT-HW1-SPLIT", title: "Train/test split" }];

test("drafted questions are checked: an unknown criterion is unset, a citation of unseen code dropped", () => {
  const { files } = collectCode(sampleRepo());
  const { questions, notes } = checkQuestions(
    {
      questions: [
        { kind: "probe", text: "Walk me through your homework.", evidence: [] },
        {
          text: "Why do you split at row 80 in split()?",
          criterion_id: "CRIT-HW1-SPLIT",
          why: "Shows whether they know the data is ordered.",
          evidence: [{ path: "train.py", lines: "3-4" }, { path: "secret.py", lines: "1" }],
        },
        { text: "What does print(x) show?", criterion_id: "CRIT-NOPE", evidence: [{ path: "train.py", lines: "40-41" }] },
        { text: "   " },
      ],
    },
    CRITERIA,
    files,
  );
  assert.deepEqual(questions.map((q) => [q.id, q.kind]), [["Q1", "opening"], ["Q2", "probe"], ["Q3", "probe"]]);
  assert.deepEqual(questions[1]!.evidence, [{ path: "train.py", lines: "3-4" }]);
  assert.equal(questions[2]!.criterion_id, null);
  assert.deepEqual(questions[2]!.evidence, []);
  assert.ok(questions.every((q) => q.approval === "draft"));
  assert.equal(notes.length, 3);
});

test("the digest carries the commit, the rubric and the numbered code", () => {
  const { files, unread } = collectCode(sampleRepo());
  const text = codeDigest({
    title: "Homework 1",
    assessmentId: "ASSESSMENT-HW1",
    studentId: "STUDENT-JNG7SN",
    brief: "Split the data.",
    criteria: CRITERIA,
    pin: {
      url: "https://github.com/a/b",
      commit: "handin1",
      committed_at: null,
      head: "head000",
      pinned_by: "submitted_at",
      cloned_at: "2026-10-20T10:00:00Z",
    },
    files,
    unread,
  });
  assert.match(text, /Commit: handin1 \(the last commit at or before the hand-in\)\. The fork has moved on since/);
  assert.match(text, /- CRIT-HW1-SPLIT: Train\/test split/);
  assert.match(text, /=== train\.py \(5 lines\) ===/);
});

test("the questions file round-trips", () => {
  const file = join(mkdtempSync(join(tmpdir(), "q-")), "out", "STUDENT-JNG7SN.yaml");
  writeDefence(file, {
    submission_id: "SUB-JNG7SN-HW1",
    assessment_id: "ASSESSMENT-HW1",
    student_id: "STUDENT-JNG7SN",
    repo: { url: "https://github.com/a/b", commit: "handin1" },
    questions: [
      { id: "Q1", kind: "opening", text: "Walk me through it.", criterion_id: null, why: "", evidence: [], approval: "draft" },
    ],
  });
  assert.equal(readDefence(file)!.questions[0]!.text, "Walk me through it.");
});
