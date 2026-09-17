/**
 * Publishing a starter repository, without publishing anything.
 *
 * Every test here injects its GitHub, so nothing reaches the network and the
 * interesting half — what this REFUSES — is the half that is covered. The
 * refusals are the feature: an answer key that reaches students cannot be
 * unpublished, and a repository name guessed from a title is a URL nobody
 * chose.
 *
 *     node --experimental-strip-types --test test/
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  type Github,
  blobSha,
  filesUnder,
  fullRepoName,
  homeworkDir,
  planPublish,
  publish,
  recordedRepo,
  resolveAuth,
  tokenApi,
} from "../src/homework.ts";

const write = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents, "utf-8");
};

/** A workspace with one homework folder, and the assessment that names it. */
const workspace = (files: Record<string, string> = { "README.md": "# HW3\n" }) => {
  const root = mkdtempSync(join(tmpdir(), "ainar-hw-"));
  for (const [name, contents] of Object.entries(files)) {
    write(join(root, "homework", "hw3-retrieval", name), contents);
  }
  const assessment = {
    assessment_id: "ASSESSMENT-HW-03",
    extensions: { github: { local_path: "homework/hw3-retrieval", template_repo: "narxoz/hw3" } },
  };
  return { root, assessment };
};

/** A GitHub that answers from a map, and records what it was asked to do. */
const fake = (tree: Map<string, string> | null): Github & { created: string[] } => ({
  mode: "token",
  source: "a test",
  owner: "narxoz",
  created: [],
  async tree() {
    return tree;
  },
  async createRepo(repo, _checkout, visibility) {
    (this as any).created.push(`${repo}:${visibility}`);
    return `Created ${repo} (${visibility}).`;
  },
  cloneUrl(repo) {
    return `https://github.com/${repo}.git`;
  },
  gitEnv() {
    return {};
  },
  redact(text) {
    return text;
  },
});

// --------------------------------------------------------------------------
// The pieces
// --------------------------------------------------------------------------

test("a blob id is the one git would compute", () => {
  const dir = mkdtempSync(join(tmpdir(), "ainar-sha-"));
  writeFileSync(join(dir, "f.txt"), "hello\n");
  const fromGit = execFileSync("git", ["hash-object", join(dir, "f.txt")], {
    encoding: "utf-8",
  }).trim();

  assert.equal(blobSha(Buffer.from("hello\n")), fromGit);
});

test("secrets and build litter are never listed as publishable", () => {
  const { root } = workspace({
    "README.md": "# HW3\n",
    ".env": "OPENAI_API_KEY=sk-real\n",
    ".gitignore": ".env\n",
    "src/solve.py": "pass\n",
  });
  const files = filesUnder(join(root, "homework", "hw3-retrieval"));

  assert.deepEqual(files.sort(), [".gitignore", "README.md", "src/solve.py"]);
});

test("a folder is only where the record says it is", () => {
  const { root, assessment } = workspace();
  assert.ok(homeworkDir(root, assessment));
  // No fuzzy match from the title: a folder found by guessing is a folder
  // somebody else's homework could win.
  assert.equal(homeworkDir(root, { assessment_id: "ASSESSMENT-HW-03" }), null);
});

test("a repository name is taken only in owner/name shape", () => {
  assert.equal(recordedRepo({ extensions: { github: { template_repo: "narxoz/hw3" } } }), "narxoz/hw3");
  assert.equal(recordedRepo({ extensions: { github: { template_repo: "hw3" } } }), null);
  assert.equal(fullRepoName("hw3", "narxoz"), "narxoz/hw3");
  assert.equal(fullRepoName("other/hw3", "narxoz"), "other/hw3");
});

// --------------------------------------------------------------------------
// The plan
// --------------------------------------------------------------------------

test("added, changed and removed are counted against what GitHub holds", async () => {
  const { root, assessment } = workspace({ "README.md": "# HW3\n", "data.csv": "a,b\n" });
  const remote = new Map([
    ["README.md", blobSha(Buffer.from("# HW3 old\n"))],
    ["gone.md", blobSha(Buffer.from("x"))],
  ]);

  const plan = await planPublish({ root, assessment, items: [], github: fake(remote) });

  assert.deepEqual(plan.added, ["data.csv"]);
  assert.deepEqual(plan.changed, ["README.md"]);
  assert.deepEqual(plan.removed, ["gone.md"]);
  assert.ok(plan.notes.some((note) => note.includes("stay in the repository's history")));
});

/**
 * Caught on the real HW1, which reported two drifted files that were identical.
 *
 * Git stores LF and checks out CRLF on Windows, so the bytes on disk and the
 * blob GitHub reports genuinely differ. Publishing on the back of that would
 * have pushed a line-endings-only commit to a public template other people have
 * forked, while calling itself a content update.
 */
test("a file differing only in line endings is not drift", async () => {
  const { root, assessment } = workspace({ "make_dataset.py": "import os\r\nprint(os)\r\n" });
  const remote = new Map([["make_dataset.py", blobSha(Buffer.from("import os\nprint(os)\n"))]]);

  const plan = await planPublish({ root, assessment, items: [], github: fake(remote) });

  assert.deepEqual(plan.changed, []);
  assert.deepEqual(plan.added, []);
  assert.ok(plan.notes.some((note) => note.includes("line endings")));
});

test("a real edit is still drift, CRLF or not", async () => {
  const { root, assessment } = workspace({ "make_dataset.py": "import os\r\nprint(1)\r\n" });
  const remote = new Map([["make_dataset.py", blobSha(Buffer.from("import os\nprint(os)\n"))]]);

  const plan = await planPublish({ root, assessment, items: [], github: fake(remote) });

  assert.deepEqual(plan.changed, ["make_dataset.py"]);
});

test("a repository that is not there yet is reported as one to create", async () => {
  const { root, assessment } = workspace();
  const plan = await planPublish({ root, assessment, items: [], github: fake(null) });

  assert.equal(plan.exists, false);
  assert.deepEqual(plan.added, ["README.md"]);
  assert.equal(plan.refusals.length, 0);
});

/**
 * Public by default, because a template students cannot see cannot be forked —
 * which is the only thing a starter repository is for.
 */
test("a new repository is created public unless asked otherwise", async () => {
  const { root, assessment } = workspace();
  const plan = await planPublish({ root, assessment, items: [], github: fake(null) });
  assert.equal(plan.visibility, "public");
  assert.ok(plan.notes.some((note) => note.includes("created public")));

  const closed = await planPublish({
    root,
    assessment,
    items: [],
    github: fake(null),
    visibility: "private",
  });
  assert.equal(closed.visibility, "private");
  assert.ok(closed.notes.some((note) => note.includes("created private")));
});

test("no repository is named rather than guessed", async () => {
  const { root } = workspace();
  const plan = await planPublish({
    root,
    assessment: {
      assessment_id: "ASSESSMENT-HW-03",
      extensions: { github: { local_path: "homework/hw3-retrieval" } },
    },
    items: [],
    github: fake(null),
  });

  assert.ok(plan.refusals.some((r) => r.includes("will not be guessed")));
});

test("an answer key in the starter files refuses the publish", async () => {
  const { root, assessment } = workspace({
    "README.md": "# HW3\n\nHint: the expected output is 0.732 for the held-out split.\n",
  });
  const items = [
    {
      item_id: "ITEM-03-01",
      answer_key: "the expected output is 0.732 for the held-out split",
    },
  ];

  const plan = await planPublish({ root, assessment, items, github: fake(null) });

  assert.ok(plan.refusals.some((r) => r.includes("answer key")));
  assert.ok(plan.refusals.some((r) => r.includes("ITEM-03-01")));
});

test("a refused plan publishes nothing", async () => {
  const { root, assessment } = workspace({ "README.md": "answer: 42 is the whole of it\n" });
  const github = fake(null);
  const result = await publish({
    root,
    assessment,
    items: [{ item_id: "ITEM-01", answer_key: "42 is the whole of it" }],
    github,
    run: () => {
      throw new Error("nothing should have been run");
    },
  });

  assert.equal(result.pushed, false);
  assert.equal(result.created, false);
  assert.deepEqual(github.created, []);
});

test("a folder already matching GitHub is left alone", async () => {
  const { root, assessment } = workspace({ "README.md": "# HW3\n" });
  const remote = new Map([["README.md", blobSha(Buffer.from("# HW3\n"))]]);

  const result = await publish({
    root,
    assessment,
    items: [],
    github: fake(remote),
    run: () => {
      throw new Error("nothing should have been run");
    },
  });

  assert.equal(result.pushed, false);
  assert.ok(result.output.join(" ").includes("already on GitHub"));
});

// --------------------------------------------------------------------------
// Which way it reaches GitHub
// --------------------------------------------------------------------------

const connection = (over: Record<string, unknown> = {}) =>
  ({
    name: "gh-main",
    type: "github",
    baseUrl: null,
    tokenEnv: "AINAR_TEST_GH_TOKEN",
    courseId: null,
    chatId: null,
    forumId: null,
    keyFile: null,
    owner: "narxoz",
    issues: [],
    ...over,
  }) as any;

test("a configured token wins over an ambient gh login", () => {
  process.env.AINAR_TEST_GH_TOKEN = "ghp_test";
  try {
    const resolved = resolveAuth({ connection: connection(), run: () => "logged in" });
    assert.equal(resolved.github?.mode, "token");
    assert.equal(resolved.github?.owner, "narxoz");
  } finally {
    delete process.env.AINAR_TEST_GH_TOKEN;
  }
});

test("with no connection it falls back to gh, and says so", () => {
  const resolved = resolveAuth({ connection: null, run: () => "logged in" });

  assert.equal(resolved.github?.mode, "gh");
  assert.ok(resolved.notes.join(" ").includes("No github connection is configured"));
});

test("with neither, both routes are named rather than one error repeated", () => {
  const resolved = resolveAuth({
    connection: null,
    run: () => {
      throw new Error("gh: not found");
    },
  });

  assert.equal(resolved.github, null);
  assert.match(resolved.refusal ?? "", /token:/);
  assert.match(resolved.refusal ?? "", /gh:/);
});

test("a connection whose variable is unset explains where to get one", () => {
  const resolved = resolveAuth({
    connection: connection(),
    force: "token",
    run: () => "logged in",
  });

  assert.equal(resolved.github, null);
  assert.match(resolved.refusal ?? "", /AINAR_TEST_GH_TOKEN/);
  assert.match(resolved.refusal ?? "", /personal access token/i);
});

test("the token never travels in a command line, and never reaches output", () => {
  const api = tokenApi("ghp_secret_value", "narxoz", "a test");
  const env = api.gitEnv();

  // Git takes its configuration from the environment, so no argv carries it.
  assert.equal(env.GIT_CONFIG_KEY_0, "http.https://github.com/.extraheader");
  assert.ok(env.GIT_CONFIG_VALUE_0?.startsWith("Authorization: Basic "));
  assert.ok(!env.GIT_CONFIG_VALUE_0?.includes("ghp_secret_value"));
  assert.equal(api.redact("fatal: could not read ghp_secret_value"), "fatal: could not read «token»");
});
