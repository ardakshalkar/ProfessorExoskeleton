/**
 * The tools, tested without a harness.
 *
 *     npm test          (node --test test/tools.test.mjs)
 *
 * No dsh, no profile, no model, no npm install — this runs against a bare Node.
 * That is the reason `lib/tools.js` takes `defineTool` as an argument instead of
 * importing it: the host's helper validates arguments and output, which is the
 * host's job to test, and the identity stub below leaves each definition exactly
 * as written so `execute` can be called directly.
 *
 * What a stub therefore does NOT check: that the parameter and output schemas
 * are legal DSL. Those are enforced at registration by the real `defineTool`,
 * and getting one wrong fails the whole harness at boot — so `bin/sample`
 * coming up is the other half of this file's coverage, not an afterthought.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { sampleTools } from "../plugins/dsh-sample/lib/tools.js";

const CONFIG = { greeting: "hello from the test", maxBytes: 64, route: false };

/** The definition, as written. See the file comment for what this gives up. */
const defineTool = (definition) => definition;

const tool = (name, config = CONFIG) =>
  sampleTools(defineTool, config).find((candidate) => candidate.name === name);

/** A run context carrying a session standing in `cwd`, the way the host's does. */
const exec = (cwd) => ({ agent: { session: { header: { cwd } } } });

/** A throw from `execute`, as its message. */
const refusal = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  return assert.fail("expected a refusal, got a value");
};

const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-sample-"));
  writeFileSync(join(root, "notes.txt"), "the cat sat on the mat\nthe cat left\n", "utf8");
  writeFileSync(join(root, "empty.txt"), "", "utf8");
  return root;
};

test("ping reports the configured greeting and the session's workspace", async () => {
  const value = await tool("sample_ping").execute({}, exec("C:\\work"));
  assert.equal(value.greeting, "hello from the test");
  assert.equal(value.workspace, "C:\\work");
  assert.equal(value.note, "");
  // An ISO instant, not a locale string: the field is declared as a string and
  // read by a model, and `Date` parsing it back has to be unambiguous.
  assert.match(value.now, /^\d{4}-\d{2}-\d{2}T/);
});

test("ping answers a call that arrives without a session", async () => {
  const value = await tool("sample_ping").execute({ note: "labelled" }, {});
  assert.match(value.workspace, /without a session working directory/);
  assert.equal(value.note, "labelled");
});

test("read_stats counts lines, words and the commonest words", async () => {
  const root = workspace();
  const value = await tool("sample_read_stats").execute({ path: "notes.txt" }, exec(root));
  assert.equal(value.lines, 2, "a trailing newline terminates a line, it does not start one");
  assert.equal(value.words, 9);
  assert.deepEqual(value.top_words.slice(0, 2), [
    { word: "the", count: 3 },
    { word: "cat", count: 2 },
  ]);
});

test("read_stats reports an empty file as empty rather than as one line", async () => {
  const root = workspace();
  const value = await tool("sample_read_stats").execute({ path: "empty.txt" }, exec(root));
  assert.equal(value.lines, 0);
  assert.equal(value.words, 0);
  assert.deepEqual(value.top_words, []);
});

test("read_stats caps `top` at 50 and floors it at 0", async () => {
  const root = workspace();
  const stats = tool("sample_read_stats");
  assert.deepEqual(await stats.execute({ path: "notes.txt", top: 0 }, exec(root)).then((v) => v.top_words), []);
  const many = await stats.execute({ path: "notes.txt", top: 999 }, exec(root));
  assert.ok(many.top_words.length <= 50);
});

test("read_stats refuses an absolute path", async () => {
  const root = workspace();
  const message = await refusal(
    tool("sample_read_stats").execute({ path: join(root, "notes.txt") }, exec(root)),
  );
  assert.match(message, /must be relative/);
});

test("read_stats refuses a path that climbs out of the workspace", async () => {
  const root = workspace();
  const message = await refusal(
    tool("sample_read_stats").execute({ path: "../../.credentials.yaml" }, exec(root)),
  );
  assert.match(message, /outside the session workspace/);
});

test("read_stats refuses a sibling directory that shares a name prefix", async () => {
  // The reason the containment check compares against `root + sep` rather than
  // against `root`: `startsWith(root)` alone accepts this path.
  const root = workspace();
  const message = await refusal(
    tool("sample_read_stats").execute({ path: "../dsh-sample-elsewhere/notes.txt" }, exec(root)),
  );
  assert.match(message, /outside the session workspace/);
});

test("read_stats refuses a file larger than this mount's maxBytes", async () => {
  const root = workspace();
  writeFileSync(join(root, "big.txt"), "x".repeat(200), "utf8");
  const message = await refusal(
    tool("sample_read_stats").execute({ path: "big.txt" }, exec(root)),
  );
  assert.match(message, /reads at most 64/);
});

test("read_stats names a missing file and a directory distinctly", async () => {
  const root = workspace();
  const stats = tool("sample_read_stats");
  assert.match(await refusal(stats.execute({ path: "nope.txt" }, exec(root))), /no such file/);
  assert.match(await refusal(stats.execute({ path: "." }, exec(root))), /is a directory/);
});

test("read_stats says what would fix a call that has no workspace", async () => {
  const message = await refusal(tool("sample_read_stats").execute({ path: "notes.txt" }, {}));
  assert.match(message, /Open a folder as a workspace/);
});

test("both tools declare themselves concurrency-safe", () => {
  for (const name of ["sample_ping", "sample_read_stats"]) {
    // Exactly `true`. Anything else — including a truthy value — keeps the call
    // exclusive, so the assertion is on identity rather than on truthiness.
    assert.equal(tool(name).isConcurrencySafe({}), true);
  }
});

test("read_stats counts lines the way an editor's gutter does", async () => {
  const root = workspace();
  const stats = tool("sample_read_stats");
  const cases = [
    ["one-line-no-newline.txt", "alpha", 1],
    ["one-line-newline.txt", "alpha\n", 1],
    ["blank-line-at-end.txt", "alpha\n\n", 2],
    ["crlf.txt", "alpha\r\nbeta\r\n", 2],
  ];
  for (const [file, content, expected] of cases) {
    writeFileSync(join(root, file), content, "utf8");
    const value = await stats.execute({ path: file }, exec(root));
    assert.equal(value.lines, expected, file);
  }
});
