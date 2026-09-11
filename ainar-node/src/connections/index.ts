/**
 * One registry for every outbound connection this workspace has.
 *
 * Before this module there were three answers to "what is this course wired
 * to", and none of them could see the others:
 *
 * * `ainar lms` read `[canvas]` and `[sheets]` out of `~/.ainar/roster/lms.toml`
 *   and took its tokens from `AINAR_CANVAS_TOKEN` / `AINAR_SHEETS_TOKEN`.
 * * `prof-publish` read named profiles out of `~/.professor/connections.json`
 *   and took its tokens from `CANVAS_TOKEN` / `MOODLE_TOKEN` /
 *   `TELEGRAM_BOT_TOKEN`, or from a literal `token` in that same file.
 * * The professor pane re-implemented readers for both, so it could show the
 *   two side by side.
 *
 * The failure that motivated merging them is not theoretical: a professor can
 * have a working Canvas profile in `connections.json` and still be told by
 * `ainar lms push` that no Canvas host is configured, because the pusher never
 * looks there. One host, written down once, read by everything.
 *
 * ## What a connection is, and is not
 *
 * A connection is **where** and **who**: a host, the non-secret identifiers that
 * pin down a course or a channel, and the NAME of the environment variable
 * holding the credential. It is deliberately not **what**: which assessment maps
 * to which Canvas column stays on the assessment record in the repository, where
 * it is reviewable and belongs to the course rather than to the machine.
 *
 * ## Tokens are never in this file
 *
 * A connection names its variable — `tokenEnv: "AINAR_CANVAS_TOKEN"` — and the
 * value is read from the environment at the moment a request is made. A literal
 * secret in the file is not honoured, and not silently ignored either: it is
 * reported as an error against that connection, because a token sitting in a
 * file the professor forgot about is exactly the thing worth saying out loud.
 * Nothing here prints, logs or writes a token value.
 *
 * ## JSON, not TOML
 *
 * `lms.toml` is read by a hand-rolled reader that handles one flat table, which
 * was the right call for two string assignments. A registry of named
 * connections with typed fields is not that shape, and JSON parses correctly
 * with no dependency and no ambiguity — the same reasoning that put
 * `~/.professor/connections.json` in JSON to begin with.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Source, credentialsPath, resolveVariable } from "./store.ts";

export const TYPES = ["canvas", "sheets", "moodle", "telegram"] as const;
export type ConnectionType = (typeof TYPES)[number];

/** Where the registry lives when nothing says otherwise. */
export const REGISTRY_ENV = "AINAR_CONNECTIONS";
export const REGISTRY_NAME = "connections.json";

/**
 * The variable each type falls back to when a connection names none.
 *
 * `AINAR_`-prefixed throughout, including for the two types that came from
 * `prof-publish` with bare names. A bare `CANVAS_TOKEN` is a variable any other
 * tool on the machine may also claim, and the one being claimed here can change
 * a grade.
 */
export const DEFAULT_TOKEN_ENV: Record<ConnectionType, string> = {
  canvas: "AINAR_CANVAS_TOKEN",
  sheets: "AINAR_SHEETS_TOKEN",
  moodle: "AINAR_MOODLE_TOKEN",
  telegram: "AINAR_TELEGRAM_BOT_TOKEN",
};

/** What is wrong with a connection, and whether it can still be used. */
export interface Issue {
  code: string;
  severity: "error" | "warn";
  message: string;
}

/**
 * One connection, as read and validated.
 *
 * Every field is present whether or not the type uses it, so a caller can print
 * a table without knowing which keys each provider cares about. `issues` carries
 * the validation; an `error` there means unusable, a `warn` means usable and
 * worth saying.
 */
export interface Connection {
  name: string;
  type: ConnectionType;
  baseUrl: string | null;
  tokenEnv: string;
  courseId: string | null;
  chatId: string | null;
  forumId: string | null;
  keyFile: string | null;
  issues: Issue[];
}

export interface Registry {
  path: string;
  present: boolean;
  connections: Connection[];
  /** A per-type default, for callers that were given no name. */
  defaults: Partial<Record<ConnectionType, string>>;
  /** The file could not be read or parsed at all. */
  error: string | null;
}

const expand = (value: string): string =>
  value.startsWith("~") ? resolve(homedir(), value.slice(1).replace(/^[\\/]/, "")) : resolve(value);

/**
 * The registry path: an explicit flag, then the environment, then `~/.ainar`.
 *
 * Beside the roster directory rather than inside it. The roster holds
 * identities and is relocated with `AINAR_ROSTER_DIR` by professors who keep it
 * on removable media; connections are machine configuration and should not
 * travel with the identities or vanish when that variable points elsewhere.
 */
export const registryPath = (explicit?: string | null): string => {
  if (explicit) return expand(explicit);
  const fromEnv = (process.env[REGISTRY_ENV] ?? "").trim();
  if (fromEnv) return expand(fromEnv);
  return join(homedir(), ".ainar", REGISTRY_NAME);
};

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
};

/**
 * A host we are willing to send a credential to.
 *
 * HTTPS, or a loopback address for a test double. The check is here rather than
 * at request time because a `http://` host in the registry is a mistake to
 * report while the professor is looking at the configuration, not one to
 * discover at the moment a grade is being posted.
 */
const baseUrlIssue = (value: string): string | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `'${value}' is not a URL`;
  }
  if (url.protocol === "https:") return null;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return null;
  return `'${value}' is not HTTPS, and a token must not travel in the clear`;
};

export const normaliseBaseUrl = (value: string): string => value.replace(/\/+$/, "");

/**
 * Read one entry into a `Connection`, collecting what is wrong rather than
 * throwing.
 *
 * Collecting is the point: one malformed connection must not hide the other
 * four. `ainar connections list` shows every one it found and says which cannot
 * be used, which is the view a professor needs when a push has just failed.
 */
export const readConnection = (name: string, raw: unknown): Connection => {
  const issues: Issue[] = [];
  const source = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({
      code: "malformed",
      severity: "error",
      message: `'${name}' is not an object`,
    });
  }

  const declared = text(source.type) ?? "";
  const type = (TYPES as readonly string[]).includes(declared)
    ? (declared as ConnectionType)
    : ("canvas" as ConnectionType);
  if (!(TYPES as readonly string[]).includes(declared)) {
    issues.push({
      code: "unknown_type",
      severity: "error",
      message: declared
        ? `type '${declared}' is not one of ${TYPES.join(", ")}`
        : `no type. One of ${TYPES.join(", ")} is required`,
    });
  }

  const baseUrl = text(source.baseUrl);
  const tokenEnv = text(source.tokenEnv) ?? DEFAULT_TOKEN_ENV[type];

  // The rule the whole file exists to enforce. Reported, not ignored: a token
  // in a config file is a token somebody has to remember to revoke.
  if (text(source.token)) {
    issues.push({
      code: "secret_in_file",
      severity: "error",
      message:
        `'${name}' carries a literal token. Move it to the environment as ` +
        `${tokenEnv}, delete it here, and revoke that token at the provider — ` +
        "it has been sitting in a file in the clear.",
    });
  }

  if (type === "canvas" || type === "moodle") {
    if (!baseUrl) {
      issues.push({
        code: "no_host",
        severity: "error",
        message: `${type} needs a baseUrl, the host this connection talks to`,
      });
    } else {
      const problem = baseUrlIssue(baseUrl);
      if (problem) issues.push({ code: "bad_host", severity: "error", message: problem });
    }
  }

  const courseId = text(source.courseId);
  // Canvas's API takes a number. `canvas-88219` is a handle somebody wrote for
  // a human, and accepting it here would describe a push that cannot work.
  if (type === "canvas" && courseId && !/^\d+$/.test(courseId)) {
    issues.push({
      code: "bad_course_id",
      severity: "error",
      message: `courseId should be the numeric Canvas course id, not '${courseId}'`,
    });
  }

  const chatId = text(source.chatId);
  if (type === "telegram" && !chatId) {
    issues.push({
      code: "no_chat",
      severity: "error",
      message: "telegram needs a chatId — `@channelname`, or the numeric id",
    });
  }

  const keyFile = text(source.keyFile);
  if (type === "sheets" && keyFile && !existsSync(expand(keyFile))) {
    issues.push({
      code: "no_key_file",
      severity: "warn",
      message: `keyFile ${keyFile} does not exist yet`,
    });
  }

  return {
    name,
    type,
    baseUrl: baseUrl ? normaliseBaseUrl(baseUrl) : null,
    tokenEnv,
    courseId,
    chatId,
    forumId: text(source.forumId),
    keyFile,
    issues,
  };
};

/** Usable means: nothing about the configuration itself is broken. */
export const usable = (connection: Connection): boolean =>
  !connection.issues.some((issue) => issue.severity === "error");

/**
 * The key file as a path the filesystem will accept.
 *
 * Stored as the professor typed it — `~/.ainar/roster/sheets-key.json` is what
 * they will recognise in the file and what stays correct if the registry is
 * copied to another machine — and expanded here, at every point of use. A
 * writer that expanded it on save would quietly rewrite their file into
 * something machine-specific.
 */
export const keyFilePath = (connection: Connection): string | null =>
  connection.keyFile ? expand(connection.keyFile) : null;

/**
 * Whether the credential is present, without reading it.
 *
 * Presence is safe to print and is the only thing any display here ever asks.
 * The value is read in exactly one function, `tokenFor`, at the moment a
 * request is about to be made.
 */
export const tokenPresent = (connection: Connection): boolean =>
  resolveVariable(connection.tokenEnv) !== null;

/**
 * Which of the two places the credential is coming from, or null for neither.
 *
 * Worth reporting because the two behave differently: a value in the
 * environment cannot be changed from inside the pane and shadows anything
 * saved there, so a professor whose new token appears to have no effect needs
 * to be told that an old one is still exported in their shell.
 */
export const tokenSource = (connection: Connection): Source | null =>
  resolveVariable(connection.tokenEnv)?.source ?? null;

/**
 * The credential itself. The only place in this module that touches a value.
 *
 * The environment first, then the harness's managed credentials document —
 * `store.ts` owns that order and explains it. Sheets is exempt from needing
 * either: a service-account key file is a credential too, and `lms/sheets.ts`
 * already knows how to turn one into a token, so a sheets connection with a
 * `keyFile` and no variable set is complete.
 */
export const tokenFor = (connection: Connection): string => {
  const found = resolveVariable(connection.tokenEnv);
  if (found) return found.value;
  throw new Error(
    `${connection.name} has no credential: ${connection.tokenEnv} is set neither in ` +
      `the environment nor in ${credentialsPath()}. ${hintFor(connection)}`,
  );
};

/** Where the professor gets the token this connection wants. */
export const hintFor = (connection: Connection): string =>
  ({
    canvas: "Canvas → Account → Settings → New Access Token. It can change a grade; keep it out of the repository.",
    sheets:
      "An access token from `gcloud auth print-access-token`, or set keyFile to a service-account key and share the spreadsheet with its address.",
    moodle: "Moodle → Preferences → Security keys, for a web-service token.",
    telegram: "The bot token @BotFather gave you when the bot was created.",
  })[connection.type];

/**
 * Read the registry. A missing file is an empty registry, not an error.
 *
 * Missing is the normal state before anyone has run `ainar connections migrate`,
 * and the callers that fall back to the legacy locations need to tell "nothing
 * configured here" apart from "configured and broken".
 */
export const loadRegistry = (explicit?: string | null): Registry => {
  const path = registryPath(explicit);
  const empty: Registry = { path, present: false, connections: [], defaults: {}, error: null };

  try {
    if (!existsSync(path) || !statSync(path).isFile()) return empty;
  } catch {
    return empty;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    return { ...empty, present: true, error: (error as Error).message };
  }

  const table = parsed?.connections;
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    return {
      ...empty,
      present: true,
      error: "no `connections` object in the file",
    };
  }

  const connections = Object.entries(table)
    .map(([name, raw]) => readConnection(name, raw))
    .sort((left, right) => left.name.localeCompare(right.name));

  const defaults: Partial<Record<ConnectionType, string>> = {};
  const declared = parsed?.defaults;
  if (declared && typeof declared === "object" && !Array.isArray(declared)) {
    for (const type of TYPES) {
      const named = text(declared[type]);
      if (named) defaults[type] = named;
    }
  }

  return { path, present: true, connections, defaults, error: null };
};

/**
 * The connection a caller asked for by name, or the one default for its type.
 *
 * Returning null rather than throwing, because every caller has a legacy path
 * to fall back to and a different thing to say when there is nothing to fall
 * back to either.
 */
export const findConnection = (
  registry: Registry,
  { name, type }: { name?: string | null; type?: ConnectionType | null } = {},
): Connection | null => {
  if (name) {
    return registry.connections.find((connection) => connection.name === name) ?? null;
  }
  if (!type) return null;

  const named = registry.defaults[type];
  if (named) {
    const found = registry.connections.find((connection) => connection.name === named);
    if (found) return found;
  }

  // No declared default. One connection of the type is unambiguous; two are
  // not, and guessing between two Canvas hosts is how grades reach the wrong
  // course.
  const candidates = registry.connections.filter((connection) => connection.type === type);
  return candidates.length === 1 ? candidates[0]! : null;
};

/**
 * Why `findConnection` came back empty, in a sentence a professor can act on.
 *
 * Split out from the lookup so the callers that fall back to a legacy location
 * can borrow the wording only when the fallback is also empty.
 */
export const explainMissing = (registry: Registry, type: ConnectionType): string => {
  if (registry.error) return `${registry.path} could not be read: ${registry.error}`;
  if (!registry.present) {
    return (
      `no connections registry at ${registry.path}. Run \`ainar connections migrate\` ` +
      "to build one from the settings you already have."
    );
  }
  const candidates = registry.connections.filter((connection) => connection.type === type);
  if (!candidates.length) return `no ${type} connection in ${registry.path}`;
  return (
    `${candidates.length} ${type} connections in ${registry.path} ` +
    `(${candidates.map((connection) => connection.name).join(", ")}) and no default. ` +
    `Name one with --connection, or set defaults.${type} in the file.`
  );
};

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

/** A connection as it is stored: the fields its type uses, and nothing else. */
export const connectionAsJson = (connection: Connection): Record<string, unknown> => {
  const stored: Record<string, unknown> = { type: connection.type };
  if (connection.baseUrl) stored.baseUrl = connection.baseUrl;
  stored.tokenEnv = connection.tokenEnv;
  if (connection.courseId) stored.courseId = connection.courseId;
  if (connection.chatId) stored.chatId = connection.chatId;
  if (connection.forumId) stored.forumId = connection.forumId;
  if (connection.keyFile) stored.keyFile = connection.keyFile;
  return stored;
};

/**
 * Write the registry back.
 *
 * `connectionAsJson` is what gets written, which is what keeps a secret out of
 * the file structurally rather than by discipline: a `token` key has nowhere to
 * go, because the writer has no branch that emits one.
 */
export const saveRegistry = (
  path: string,
  connections: Connection[],
  defaults: Partial<Record<ConnectionType, string>> = {},
): void => {
  const table: Record<string, unknown> = {};
  for (const connection of [...connections].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    table[connection.name] = connectionAsJson(connection);
  }
  const document: Record<string, unknown> = { connections: table };
  if (Object.keys(defaults).length) document.defaults = defaults;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(document, null, 2) + "\n", { encoding: "utf-8" });
};
