/**
 * `ainar connections` — the one command that answers "what is this wired to".
 *
 *     ainar connections list                what is configured, and what is broken
 *     ainar connections show NAME           one connection, in full
 *     ainar connections doctor [NAME]       ask each provider whether it agrees
 *     ainar connections add NAME --type T   write one connection
 *     ainar connections migrate             build the registry from what exists
 *     ainar connections path                where the file is
 *
 * `list`, `show` and `doctor` are reads. `migrate` only ever adds: it never
 * edits a connection already in the registry and never touches the legacy
 * files it reads from. `add` is the one subcommand that changes a connection
 * on purpose, and it still cannot write a credential — there is no flag that
 * takes one.
 *
 * ## Why `add` exists after all
 *
 * It was drafted and dropped once, on the argument that a professor editing
 * four lines of JSON in an editor sees every field at once, while a flag-based
 * writer hides the ones nobody passed. That argument was about a human at a
 * terminal and it still holds for one.
 *
 * It stops holding the moment a second consumer appears. The professor pane
 * has a Canvas setup form, and a form cannot open an editor. The choice there
 * is between this command and a second registry writer inside the pane — one
 * that would have its own idea of what a valid host is, its own idea of which
 * variable each type defaults to, and no test holding the two together. The
 * pane makes exactly that argument about `ainar approve`, in its own words:
 * re-typing the steps would produce a third implementation, held to nothing,
 * whose first divergence would be a record that validated and was still wrong.
 *
 * So `add` is the seam the pane spawns, and the validation lives in one place.
 */

import {
  type Connection,
  type Registry,
  TYPES,
  connectionAsJson,
  hintFor,
  loadRegistry,
  readConnection,
  registryPath,
  saveRegistry,
  tokenPresent,
  tokenSource,
  usable,
} from "./index.ts";
import { credentialsPath } from "./store.ts";
import { type Found, discover, merge, profilesPath } from "./legacy.ts";
import { type Probe, probeAll } from "./probe.ts";
import { type Transport, FetchTransport } from "../lms/http.ts";

export interface ConnectionsArgs {
  subcommand: string;
  name: string | null;
  connections: string | null;
  rosterDir: string | null;
  profiles: string | null;
  json: boolean;
  dryRun: boolean;
  /** `add`: the fields of the connection being written. */
  type?: string | null;
  baseUrl?: string | null;
  courseId?: string | null;
  chatId?: string | null;
  forumId?: string | null;
  keyFile?: string | null;
  tokenEnv?: string | null;
  /** `add --default`: make this the one its type resolves to. */
  makeDefault?: boolean;
}

export interface Sink {
  out: (line: string) => void;
}

/** `canvas-narxoz  canvas  https://canvas.narxoz.kz` — padded into columns. */
const table = (rows: string[][]): string[] => {
  if (!rows.length) return [];
  const widths = rows[0]!.map((_, column) =>
    Math.max(...rows.map((row) => (row[column] ?? "").length)),
  );
  return rows.map((row) =>
    row
      .map((cell, column) => (cell ?? "").padEnd(column === row.length - 1 ? 0 : widths[column]!))
      .join("  ")
      .trimEnd(),
  );
};

/** What this connection points at, in one cell. */
const destination = (connection: Connection): string => {
  if (connection.type === "telegram") return connection.chatId ?? "—";
  if (connection.type === "sheets") return connection.keyFile ?? "(token only)";
  const host = connection.baseUrl ?? "—";
  return connection.courseId ? `${host} · course ${connection.courseId}` : host;
};

/**
 * The credential column: the variable's NAME, and whether it is set.
 *
 * A name is not a secret and printing it is the point — a professor whose push
 * is refused needs to know which variable to export, and guessing between
 * `CANVAS_TOKEN` and `AINAR_CANVAS_TOKEN` is exactly the confusion the merged
 * registry exists to end.
 */
const credential = (connection: Connection): string => {
  const source = tokenSource(connection);
  // Which of the two, not just whether. They behave differently: a value in
  // the shell shadows one saved in the pane and cannot be changed from there,
  // so a professor whose newly saved token has no effect needs to see that an
  // old one is still exported.
  if (source === "env") return `${connection.tokenEnv} ✓ (shell)`;
  if (source === "file") return `${connection.tokenEnv} ✓ (saved)`;
  if (connection.type === "sheets" && connection.keyFile) return "(service-account key)";
  return `${connection.tokenEnv} — not set`;
};

const listing = (registry: Registry, sink: Sink): number => {
  if (registry.error) {
    sink.out(`${registry.path} could not be read: ${registry.error}`);
    return 1;
  }
  if (!registry.present) {
    sink.out(`No registry at ${registry.path}.`);
    sink.out("");
    sink.out("Run `ainar connections migrate` to build one from the settings already");
    sink.out("on this machine — lms.toml, the prof-publish profiles, and the");
    sink.out("AINAR_* variables that are set.");
    return 0;
  }
  if (!registry.connections.length) {
    sink.out(`${registry.path} holds no connections.`);
    return 0;
  }

  sink.out(registry.path);
  sink.out("");
  const rows: string[][] = [["NAME", "TYPE", "POINTS AT", "CREDENTIAL"]];
  for (const connection of registry.connections) {
    rows.push([
      usable(connection) ? connection.name : `${connection.name} !`,
      connection.type,
      destination(connection),
      credential(connection),
    ]);
  }
  for (const line of table(rows)) sink.out(line);

  const troubled = registry.connections.filter((connection) => connection.issues.length);
  if (troubled.length) {
    sink.out("");
    for (const connection of troubled) {
      for (const issue of connection.issues) {
        sink.out(`${issue.severity === "error" ? "error" : " warn"}  ${connection.name}: ${issue.message}`);
      }
    }
  }

  const defaults = Object.entries(registry.defaults);
  if (defaults.length) {
    sink.out("");
    sink.out(`Defaults: ${defaults.map(([type, name]) => `${type} → ${name}`).join(", ")}`);
  }
  return troubled.some((connection) => !usable(connection)) ? 1 : 0;
};

const showing = (registry: Registry, name: string, sink: Sink): number => {
  const connection = registry.connections.find((entry) => entry.name === name);
  if (!connection) {
    sink.out(`no connection called '${name}' in ${registry.path}`);
    if (registry.connections.length) {
      sink.out(`Known: ${registry.connections.map((entry) => entry.name).join(", ")}`);
    }
    return 1;
  }

  sink.out(connection.name);
  for (const [key, value] of Object.entries(connectionAsJson(connection))) {
    sink.out(`  ${key.padEnd(10)} ${value}`);
  }
  sink.out(`  ${"credential".padEnd(10)} ${credential(connection)}`);
  if (tokenSource(connection) === "file") {
    sink.out(`             stored in ${credentialsPath()}`);
  }
  if (!tokenPresent(connection)) sink.out(`             ${hintFor(connection)}`);
  for (const issue of connection.issues) {
    sink.out(`  ${issue.severity === "error" ? "error" : "warn "}      ${issue.message}`);
  }
  return usable(connection) ? 0 : 1;
};

/**
 * Exit non-zero for anything that is not working, skipped included.
 *
 * A skipped connection is one with no token or a broken host — a real problem,
 * just one caught before a request was worth making. Exiting 0 on a wall of
 * `skip` would report "all fine" to a script, and to the professor reading the
 * last line, about a setup that cannot push anything.
 */
const reporting = (results: Probe[], sink: Sink): number => {
  for (const result of results) {
    const mark = result.ok ? "ok  " : result.checked ? "FAIL" : "skip";
    sink.out(`${mark}  ${result.name} (${result.type})`);
    if (result.identity) sink.out(`      answered as ${result.identity}`);
    sink.out(`      ${result.detail}`);
  }
  if (!results.length) sink.out("nothing to check.");
  return results.some((result) => !result.ok) ? 1 : 0;
};

/**
 * Report a migration the same way whether or not it wrote anything.
 *
 * The secrets paragraph is unconditional when one was found, and it says
 * "revoke" rather than "move". A token that has been readable in a plaintext
 * file is a token that may already have been read, and relocating it would
 * leave that unchanged while making it look handled.
 */
const migrationReport = (
  path: string,
  added: Connection[],
  skipped: Found[],
  found: Found[],
  wrote: boolean,
  sink: Sink,
): void => {
  if (!found.length) {
    sink.out("Nothing to migrate: no lms.toml, no prof-publish profiles, no AINAR_* hosts set.");
    return;
  }

  sink.out(`Found ${found.length} connection(s) in the old locations:`);
  for (const entry of found) sink.out(`  ${entry.connection.name}  ←  ${entry.source}`);
  sink.out("");

  if (added.length) {
    sink.out(`${wrote ? "Wrote" : "Would write"} ${added.length} to ${path}:`);
    for (const connection of added) {
      sink.out(`  ${connection.name}  ${connection.type}  ${destination(connection)}`);
    }
  } else {
    sink.out(`${path} already has all of them; nothing added.`);
  }
  if (skipped.length) {
    sink.out(
      `Left alone (already in the registry): ${skipped
        .map((entry) => entry.connection.name)
        .join(", ")}`,
    );
  }

  const secrets = found.filter((entry) => entry.secretLeftBehind);
  if (secrets.length) {
    sink.out("");
    sink.out("A literal token was found and deliberately NOT copied:");
    for (const entry of secrets) sink.out(`  ${entry.connection.name}  in  ${entry.source}`);
    sink.out("");
    sink.out("Do three things, in this order:");
    sink.out("  1. Revoke that token at the provider. It has been sitting in a file in");
    sink.out("     the clear, so treat it as exposed rather than as merely misplaced.");
    sink.out("  2. Issue a new one and export it under the variable the registry names");
    sink.out("     (`ainar connections show NAME` prints which).");
    sink.out("  3. Delete the `token` line from the old file.");
  }

  const needed = added.filter((connection) => !tokenPresent(connection));
  if (needed.length) {
    sink.out("");
    sink.out("Variables still to set:");
    for (const connection of needed) {
      if (connection.type === "sheets" && connection.keyFile) continue;
      sink.out(`  ${connection.tokenEnv.padEnd(26)} for ${connection.name}`);
    }
  }
};

/**
 * The whole group. Returns a process exit code; `1` means something is wrong
 * with the configuration, not that the command failed to run.
 *
 * That distinction matters for the pane and for scripts: `doctor` exiting 1
 * because a token expired is a true report, and it should be as easy to act on
 * as a green run.
 */
export const runConnections = async (
  args: ConnectionsArgs,
  sink: Sink,
  transport: Transport = new FetchTransport(),
): Promise<number> => {
  const path = registryPath(args.connections);
  const registry = loadRegistry(args.connections);

  switch (args.subcommand) {
    case "path": {
      sink.out(path);
      return 0;
    }

    case "list": {
      if (args.json) {
        sink.out(
          JSON.stringify(
            {
              path: registry.path,
              present: registry.present,
              error: registry.error,
              defaults: registry.defaults,
              connections: registry.connections.map((connection) => ({
                ...connection,
                // Presence and provenance only. The value is never serialised,
                // by anything.
                tokenPresent: tokenPresent(connection),
                tokenSource: tokenSource(connection),
                usable: usable(connection),
              })),
            },
            null,
            2,
          ),
        );
        return registry.error ? 1 : 0;
      }
      return listing(registry, sink);
    }

    case "show": {
      if (!args.name) {
        sink.out("usage: connections show NAME");
        return 1;
      }
      return showing(registry, args.name, sink);
    }

    case "doctor": {
      const chosen = args.name
        ? registry.connections.filter((connection) => connection.name === args.name)
        : registry.connections;
      if (args.name && !chosen.length) {
        sink.out(`no connection called '${args.name}' in ${registry.path}`);
        return 1;
      }
      if (!registry.present) {
        sink.out(`No registry at ${registry.path}. Run \`ainar connections migrate\` first.`);
        return 1;
      }
      const results = await probeAll(chosen, transport);
      if (args.json) {
        sink.out(JSON.stringify(results, null, 2));
        return results.some((result) => !result.ok) ? 1 : 0;
      }
      return reporting(results, sink);
    }

    /**
     * Write one connection, refusing anything that could not be used.
     *
     * Refusing rather than storing-with-a-warning, because the caller is
     * usually a form: a professor who pressed Save and saw "saved" has been
     * told the setup works, and finding out at the next push that the host was
     * typed `http://` is the failure this whole group exists to prevent. The
     * issues come back on stderr in the same words `list` would have used.
     *
     * There is no `--token`. Not omitted, not unsupported — absent, so that no
     * shell history, no process list and no CI log can carry one because of
     * this command.
     */
    case "add": {
      if (!args.name) {
        sink.out("usage: connections add NAME --type canvas|sheets|moodle|telegram [--base-url URL]");
        return 1;
      }
      if (registry.error) {
        sink.out(`${registry.path} could not be read: ${registry.error}`);
        sink.out("Fix or remove that file before writing into it.");
        return 1;
      }

      const existing = registry.connections.find((entry) => entry.name === args.name);
      // An update keeps whatever this call does not mention. A form that only
      // knows the host must not silently erase a course id somebody typed.
      const merged = readConnection(args.name, {
        type: args.type ?? existing?.type ?? null,
        baseUrl: args.baseUrl ?? existing?.baseUrl ?? null,
        tokenEnv: args.tokenEnv ?? existing?.tokenEnv ?? null,
        courseId: args.courseId ?? existing?.courseId ?? null,
        chatId: args.chatId ?? existing?.chatId ?? null,
        forumId: args.forumId ?? existing?.forumId ?? null,
        keyFile: args.keyFile ?? existing?.keyFile ?? null,
      });

      if (!usable(merged)) {
        for (const issue of merged.issues) {
          if (issue.severity === "error") sink.out(`error  ${issue.message}`);
        }
        sink.out("");
        sink.out("Nothing was written.");
        return 1;
      }

      const defaults = { ...registry.defaults };
      if (args.makeDefault) defaults[merged.type] = merged.name;

      const others = registry.connections.filter((entry) => entry.name !== merged.name);
      if (args.dryRun) {
        sink.out(`${existing ? "Would update" : "Would add"} ${merged.name} in ${path}:`);
      } else {
        saveRegistry(path, [...others, merged], defaults);
        sink.out(`${existing ? "Updated" : "Added"} ${merged.name} in ${path}:`);
      }
      for (const [key, value] of Object.entries(connectionAsJson(merged))) {
        sink.out(`  ${key.padEnd(10)} ${value}`);
      }
      for (const issue of merged.issues) sink.out(`  warn       ${issue.message}`);
      if (args.makeDefault) sink.out(`  default    for ${merged.type}`);
      if (!tokenPresent(merged)) {
        sink.out("");
        sink.out(`No credential yet: ${merged.tokenEnv} is not set. ${hintFor(merged)}`);
      }
      return 0;
    }

    case "migrate": {
      if (registry.error) {
        sink.out(`${registry.path} could not be read: ${registry.error}`);
        sink.out("Fix or remove that file before migrating into it.");
        return 1;
      }
      const found = discover({ rosterDirectory: args.rosterDir, profiles: args.profiles });
      const { connections, added, skipped } = merge(registry.connections, found);

      // Only write when there is something new. A file rewritten to identical
      // content still changes its timestamp, and a `migrate` that is safe to
      // re-run should leave no trace when it has nothing to do.
      const wrote = Boolean(added.length) && !args.dryRun;
      if (wrote) saveRegistry(path, connections, registry.defaults);

      migrationReport(path, added, skipped, found, wrote, sink);
      if (args.dryRun && added.length) {
        sink.out("");
        sink.out("--dry-run: nothing was written.");
      }
      return 0;
    }

    default: {
      sink.out(`unknown connections subcommand '${args.subcommand}'`);
      sink.out("usage: connections {list|show|doctor|add|migrate|path}");
      sink.out("");
      sink.out(`Types: ${TYPES.join(", ")}`);
      sink.out(`Registry: ${path}`);
      sink.out(`Legacy profiles: ${profilesPath(args.profiles)}`);
      return 1;
    }
  }
};
