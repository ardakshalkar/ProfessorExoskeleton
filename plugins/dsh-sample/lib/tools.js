/**
 * The two tools this sample registers, and the rules they illustrate.
 *
 * They are in their own file for one reason: `index.js` is about WIRING —
 * which services the plugin waits for, what it registers, what it disposes —
 * and a reader who wants to see that shape should not have to scroll past a
 * word counter to find it.
 *
 * `defineTool` is passed in by `index.js` rather than imported here, so this
 * file has no runtime dependency on the host at all: it is a pair of plain
 * descriptions, and a test can build them with a stub and call `execute`
 * directly.
 */

import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

/**
 * The workspace one call is about, or `null`.
 *
 * `exec.agent.session.header.cwd` is the folder the professor opened in the
 * sidebar, and it is the same field `@deepseek-ai/dsh-tool-fs` reads to decide
 * where `read_file` looks. Using the same one is the point: two tools in one
 * session cannot then disagree about which directory they are standing in.
 *
 * Every hop is optional because a caller need not be an agent — a `run_code`
 * program, a test, or a future non-session caller all reach `execute` with
 * less than an agent on the context. `null` is a real answer here, and each
 * tool below says what it does with it rather than guessing.
 *
 * Deliberately not `process.cwd()`: dsh picks its own working directory at
 * boot, a session outlives a `cd`, and the professor may switch workspaces
 * without restarting the harness.
 */
const sessionCwd = (exec) => {
  const cwd = exec?.agent?.session?.header?.cwd;
  return typeof cwd === "string" && cwd.trim() ? cwd : null;
};

/**
 * `candidate` resolved inside `root`, or a throw naming what was refused.
 *
 * This is the whole reason `sample_read_stats` takes a relative path and not
 * an absolute one. The tool reads a file and reports on it, so the path
 * argument IS the read primitive: a model that can pass a path climbing out of
 * the workspace can read the credentials file next to the harness, and no
 * amount of care elsewhere in this file takes that back.
 *
 * The check is on the RESOLVED path rather than on the argument, because `..`
 * is not the only way to leave a directory — a drive letter and a UNC path
 * both do it while looking nothing like `..`. And it compares against
 * `root + sep` rather than against `root`, because `startsWith(root)` alone
 * accepts `C:\work-elsewhere` for a root of `C:\work`.
 *
 * A tool is not a sandbox and should not pretend to be one — dsh ships
 * `@deepseek-ai/dsh-sandbox` for that. This is the cheap containment any tool
 * taking a path owes its caller regardless.
 */
const within = (root, candidate) => {
  if (isAbsolute(candidate)) {
    throw new Error(
      `path must be relative to the session workspace, and ${candidate} is absolute. ` +
        "Pass it as you would type it from the folder open in the sidebar.",
    );
  }
  const resolved = resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(
      `${candidate} resolves outside the session workspace (${root}), which this tool will not read.`,
    );
  }
  return resolved;
};

/** Words, the way a person counting them would: runs of non-whitespace. */
const countWords = (text) => (text.match(/\S+/g) ?? []).length;

/**
 * Lines, the way `wc -l` and every editor agree on them.
 *
 * Two edges, and both of them bite. An empty file has no lines at all, where a
 * bare `split` reports one. And a file ending in a newline does NOT have an
 * extra empty line after it — that newline terminates the last line rather
 * than starting a new one — where a bare `split` reports one more line than the
 * editor's gutter shows. So: drop one trailing terminator, then split.
 *
 * `a\n\n` is still two lines, which is right: the first newline ends line one
 * and the second ends an empty line two.
 */
const countLines = (text) =>
  text === "" ? 0 : text.replace(/(?:\r\n|\r|\n)$/, "").split(/\r\n|\r|\n/).length;

/** Letters, digits and hyphens; enough to count words in prose or in code. */
const WORD = /[\p{L}\p{N}-]+/gu;

/**
 * The commonest words, most frequent first, ties broken alphabetically.
 *
 * Sorted deterministically on purpose: an unstable order would make the tool
 * report differently for two calls on an unchanged file, which is the kind of
 * thing that quietly destroys a prompt cache and makes a test flap.
 */
const topWords = (text, limit) => {
  const counts = new Map();
  for (const raw of text.toLowerCase().match(WORD) ?? []) {
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
};

/**
 * The tool definitions, built against this mount's config.
 *
 * A factory rather than a module-level constant because `config` is per-mount:
 * two loader rows of this plugin — one in a profile with a small `maxBytes`,
 * one without — are two independent mounts, and a list computed once at import
 * time could only ever serve one of them.
 *
 * @param defineTool the host's helper, passed in by `index.js`
 * @param config this mount's config, already validated by the `Config` schema
 */
export const sampleTools = (defineTool, config) => [
  defineTool({
    name: "sample_ping",
    description:
      "Report that the sample plugin is mounted, and what it can see: its own " +
      "configured greeting, the workspace this session is standing in, and the " +
      "host's clock. Useful for confirming a plugin is live before blaming " +
      "anything else.",
    parameters: {
      // One optional string, to show the shape. `required` is written only when
      // it is `true`: the DSL rejects `required: false` with "required must be
      // true when present", and that rejection is fatal at REGISTRATION — so it
      // takes the whole harness down rather than spoiling one parameter.
      note: {
        type: "string",
        description: "Echoed back verbatim, so a caller can label one call among several.",
      },
    },
    output: {
      // An explicit object must declare `additionalProperties`; the DSL refuses
      // one that does not. Every key below is always present, which is why none
      // is marked required and none is nullable — a tool that omits a key it
      // declared reads better than one that returns null.
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          plugin: { type: "string" },
          greeting: { type: "string" },
          workspace: { type: "string" },
          now: { type: "string" },
          note: { type: "string" },
        },
      },
      render: (_args, value) => [
        {
          type: "text",
          text:
            `${value.greeting}\n` +
            `workspace: ${value.workspace}\n` +
            `host clock: ${value.now}` +
            (value.note ? `\nnote: ${value.note}` : ""),
        },
      ],
    },
    async execute(args, exec) {
      const cwd = sessionCwd(exec);
      return {
        plugin: "dsh-sample",
        greeting: config.greeting,
        // A sentence rather than an empty string, because "this session is not
        // standing anywhere" is a fact worth reading and "" is not.
        workspace: cwd ?? "(this call arrived without a session working directory)",
        now: new Date().toISOString(),
        note: args.note ?? "",
      };
    },
    // Nothing here mutates anything, so two calls may overlap. Exactly `true`
    // permits it; every other outcome, a throw included, stays exclusive.
    isConcurrencySafe: () => true,
  }),

  defineTool({
    name: "sample_read_stats",
    description:
      "Count the lines, words and commonest words in a UTF-8 text file inside " +
      "the workspace this session has open. The path is relative to that folder; " +
      "absolute paths and paths climbing out of it are refused.",
    parameters: {
      path: {
        type: "string",
        required: true,
        description: "Path to the file, relative to the open workspace folder.",
      },
      top: {
        type: "integer",
        description: "How many of the commonest words to return. Default 10, capped at 50.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          bytes: { type: "integer" },
          lines: { type: "integer" },
          words: { type: "integer" },
          characters: { type: "integer" },
          // `items` matters. Without it the array reaches the model as a bare
          // `array` and the element type declared here is thrown away on the
          // way out. The host accepts that silently, so nothing complains and
          // the model is simply told less than the tool knows.
          top_words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                word: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
        },
      },
      render: (_args, value) => [
        {
          type: "text",
          text:
            `${value.path}\n` +
            `${value.lines} lines · ${value.words} words · ` +
            `${value.characters} characters · ${value.bytes} bytes\n` +
            (value.top_words.length
              ? "most frequent: " +
                value.top_words.map((entry) => `${entry.word} (${entry.count})`).join(", ")
              : "no words in this file"),
        },
      ],
    },
    async execute(args, exec) {
      const root = sessionCwd(exec);
      if (root === null) {
        // A thrown Error becomes an ordinary error result the model can read and
        // correct from; it does not fail the registry or the session. The message
        // is the whole value of the failure, so it says what would fix it.
        throw new Error(
          "This tool reads inside the workspace folder open in the sidebar, and this " +
            "call arrived without one. Open a folder as a workspace and try again.",
        );
      }
      const target = within(resolve(root), args.path);

      const stats = statSync(target, { throwIfNoEntry: false });
      if (stats === undefined) throw new Error(`no such file: ${args.path}`);
      if (stats.isDirectory()) throw new Error(`${args.path} is a directory, not a file.`);
      if (stats.size > config.maxBytes) {
        throw new Error(
          `${args.path} is ${stats.size} bytes and this mount reads at most ${config.maxBytes}. ` +
            "Raise `maxBytes` on the plugin's loader row if that is the wrong limit.",
        );
      }

      const text = readFileSync(target, "utf8");
      return {
        path: args.path,
        bytes: stats.size,
        lines: countLines(text),
        words: countWords(text),
        characters: text.length,
        top_words: topWords(text, Math.min(Math.max(args.top ?? 10, 0), 50)),
      };
    },
    isConcurrencySafe: () => true,
  }),
];
