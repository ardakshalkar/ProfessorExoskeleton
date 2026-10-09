/**
 * `ainar sync`: every road out of and into a run, through one command.
 *
 *     ainar sync list    RUN                         every sync, written or implied
 *     ainar sync show    RUN SYNC                    one sync in full, and its links
 *     ainar sync plan    RUN SYNC [flags]            what would change; writes nothing
 *     ainar sync run     RUN SYNC [--confirm]        do it
 *     ainar sync review  RUN [SYNC]                  matches waiting for a person
 *     ainar sync confirm RUN SYNC (--all | --line N | --name "X") [--to STUDENT-X]
 *     ainar sync link    RUN SYNC "Name as written=STUDENT-X" [--unlink]
 *     ainar sync migrate RUN [--dry-run]             write the implied syncs out as syncs:
 *
 * A marks sheet runs here. Every other road already has a command that does
 * its work with its own refusals — `lms push`, `roster sync`, `publish` — and
 * `sync` hands over to it with the arguments the sync implies, rather than
 * re-implementing it and letting two versions of a safety check drift apart.
 *
 * One rule over all of them: anything that changes something outside this
 * machine needs `--confirm`. `plan` never does.
 */

import { spawnSync } from "node:child_process";
import { LinkTable, nameLinkKey } from "./links.ts";
import { type RunSync, findSync, syncsOf, writeSyncs, writtenForm } from "./registry.ts";
import { runMarksSync } from "./sheet-marks.ts";

export interface SyncArgs {
  subcommand: string;
  run: string;
  sync: string | null;
  /** Further positionals, e.g. the `Name=STUDENT-X` of `link`. */
  extra: string[];
  confirm: boolean;
  dryRun: boolean;
  json: boolean;
  all: boolean;
  line: number | null;
  name: string | null;
  to: string | null;
  unlink: boolean;
  from: string | null;
  rosterDir: string;
  linksDir: string | null;
  /** Flags to hand on to a delegated command, as typed. */
  passthrough: string[];
}

interface Deps {
  out: (line: unknown) => void;
  /** Run another `ainar` command; returns its exit code. Replaceable in tests. */
  delegate?: (argv: string[]) => number;
}

const defaultDelegate = (argv: string[]): number => {
  const result = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
};

/** What runs a sync that is not a marks sheet: the command, for planning and for doing. */
const delegation = (sync: RunSync, runId: string): { plan: string[]; run: string[]; live: boolean } | null => {
  const key = `${sync.service}|${sync.stream}|${sync.role}`;
  switch (key) {
    case "canvas|roster|source":
      return { plan: ["roster", "sync", runId, "--dry-run"], run: ["roster", "sync", runId], live: false };
    case "canvas|submissions|source":
      return {
        plan: ["lms", "import-submissions", runId, "--target", "canvas-api", "--dry-run"],
        run: ["lms", "import-submissions", runId, "--target", "canvas-api"],
        live: false,
      };
    case "canvas|grades|target":
      return {
        plan: ["lms", "plan", runId, "--target", "canvas-api"],
        run: ["lms", "push", runId, "--target", "canvas-api", "--confirm"],
        live: true,
      };
    case "canvas|assignment|target":
      return { plan: ["lms", "assignment-plan", runId], run: ["lms", "assignment-push", runId, "--confirm"], live: true };
    case "sheets|grades|target": {
      const sheet = (sync.where as Record<string, unknown>).sheet;
      const pointed = sheet ? ["--sheet", String(sheet)] : [];
      return {
        plan: ["lms", "plan", runId, "--target", "sheets-api", ...pointed],
        run: ["lms", "push", runId, "--target", "sheets-api", ...pointed, "--confirm"],
        live: true,
      };
    }
    case "telegram|announcement|target":
      return { plan: ["publish", "telegram", runId], run: ["publish", "telegram", runId, "--confirm"], live: true };
    case "github|repo|target":
      // The assessment is the one positional: `sync run RUN homework-repos ASSESSMENT-HW1 --confirm`.
      return {
        plan: ["publish", "homework", "--run", runId],
        run: ["publish", "homework", "--run", runId, "--confirm"],
        live: true,
      };
    default:
      return null;
  }
};

const isMarksSheet = (sync: RunSync): boolean => sync.service === "sheets" && sync.stream === "marks";

const describe = (sync: RunSync): string => {
  const where = Object.entries(sync.where as Record<string, unknown>)
    .map(([key, value]) => `${key} ${String(value).length > 24 ? String(value).slice(0, 21) + "…" : value}`)
    .join(", ");
  return (
    `${sync.sync_id.padEnd(20)} ${sync.service.padEnd(9)} ${sync.role.padEnd(7)} ${sync.stream.padEnd(12)}` +
    `${sync.enabled ? "" : " (off)"}${where ? `  ${where}` : ""}` +
    (sync.implied ? `   implied by ${sync.from}` : "")
  );
};

export const runSync = async (args: SyncArgs, bundle: any, root: string, deps: Deps): Promise<number> => {
  const { out } = deps;
  const delegate = deps.delegate ?? defaultDelegate;
  const runId = args.run;

  switch (args.subcommand) {
    case "list": {
      const all = syncsOf(bundle, runId);
      if (args.json) {
        out(all);
        return 0;
      }
      if (!all.length) {
        out(`${runId} has no syncs, written or implied. Add one under syncs: in its version.yaml.`);
        return 0;
      }
      out(`${runId}: ${all.length} sync(s)`);
      for (const sync of all) out(`  ${describe(sync)}`);
      if (all.some((sync) => sync.implied)) {
        out(`\nImplied syncs are read from older settings. \`ainar sync migrate ${runId}\` writes them out as syncs:.`);
      }
      return 0;
    }

    case "show": {
      const sync = findSync(bundle, runId, need(args.sync, "show"));
      out(args.json ? sync : describe(sync));
      if (!args.json) {
        out(`  match    ${(sync.match.length ? sync.match : ["(default)"]).join(" → ")}   unsure: ${sync.unsure}`);
        out(`  write    ${sync.write}   remove: ${sync.remove}   conflict: ${sync.conflict}   anchors: ${sync.anchors ? "on" : "off"}`);
        if (Object.keys(sync.map).length) out(`  map      ${JSON.stringify(sync.map)}`);
        const links = LinkTable.load(runId, args.linksDir);
        const count = Object.keys(links.links[sync.sync_id] ?? {}).length;
        out(`  links    ${count} remembered, ${links.queued(sync.sync_id).length} waiting for review   (${links.path})`);
      }
      return 0;
    }

    case "plan":
    case "run": {
      const sync = findSync(bundle, runId, need(args.sync, args.subcommand));
      if (!sync.enabled && args.subcommand === "run") {
        out(`${sync.sync_id} is switched off (enabled: false).`);
        return 1;
      }
      const planning = args.subcommand === "plan" || args.dryRun;
      if (isMarksSheet(sync)) {
        if (!planning && sync.role === "both" && !args.from && !args.confirm) {
          out(
            `${sync.sync_id} is two-way and would write into the sheet. Look at \`ainar sync plan ${runId} ${sync.sync_id}\` ` +
              "first, then run it again with --confirm.",
          );
          return 1;
        }
        if (!planning && sync.anchors && !args.from && !args.confirm) {
          out(`${sync.sync_id} anchors rows in the sheet, which writes into it. Run it again with --confirm.`);
          return 1;
        }
        await runMarksSync({
          bundle,
          runId,
          root,
          sync,
          rosterDirectory: args.rosterDir,
          from: args.from,
          dryRun: planning,
          json: args.json,
          out,
          linksDirectory: args.linksDir,
        });
        return 0;
      }
      const route = delegation(sync, runId);
      if (!route) {
        out(`${sync.sync_id}: nothing runs ${sync.service} ${sync.stream} as ${sync.role} yet.`);
        return 1;
      }
      if (!planning && route.live && !args.confirm) {
        out(
          `${sync.sync_id} changes ${sync.service}, which other people see. Look at ` +
            `\`ainar sync plan ${runId} ${sync.sync_id}\` first, then run it again with --confirm.`,
        );
        return 1;
      }
      const [verb, sub, ...after] = planning ? route.plan : route.run;
      const argv = [
        verb!,
        sub!,
        ...args.extra,
        ...after,
        ...(sync.connection ? ["--connection", sync.connection] : []),
        ...args.passthrough,
      ];
      out(`→ ainar ${argv.join(" ")}`);
      return delegate(argv);
    }

    case "review": {
      const links = LinkTable.load(runId, args.linksDir);
      const ids = args.sync ? [args.sync] : Object.keys(links.pending);
      let waiting = 0;
      for (const syncId of ids) {
        for (const [key, entry] of links.queued(syncId)) {
          waiting += 1;
          const options = entry.candidates.map((candidate) => `${candidate.student} (${candidate.match})`).join(", ");
          out(`${syncId}  ${entry.line ? `line ${entry.line} ` : ""}"${entry.label}"  ${entry.why}`);
          out(`    could be: ${options || "nobody close"}   [${key}]`);
        }
      }
      if (!waiting) out("Nothing is waiting for review.");
      else {
        out(
          `\n${waiting} waiting. \`ainar sync confirm ${runId} SYNC --line N\` takes the first candidate; ` +
            "add --to STUDENT-X for another; --all takes the first candidate for every one.",
        );
      }
      return 0;
    }

    case "confirm": {
      const syncId = need(args.sync, "confirm");
      findSync(bundle, runId, syncId);
      const links = LinkTable.load(runId, args.linksDir);
      const queued = links.queued(syncId).filter(([, entry]) => {
        if (args.all) return true;
        if (args.line !== null) return entry.line === args.line;
        if (args.name !== null) return entry.label === args.name;
        return false;
      });
      if (!queued.length) {
        out("Nothing waiting matches. `ainar sync review " + runId + " " + syncId + "` lists what is.");
        return 1;
      }
      if (args.to && queued.length > 1) {
        out("--to names one student, so confirm one row at a time with --line or --name.");
        return 1;
      }
      for (const [key, entry] of queued) {
        const student = args.to ?? entry.candidates[0]?.student;
        if (!student) {
          out(`  "${entry.label}" has no candidate — give one with --to STUDENT-X`);
          continue;
        }
        if (!/^STUDENT-[A-Z0-9]+$/.test(student)) throw new Error(`${student} is not a pseudonym`);
        links.set(syncId, key, { student, how: "confirmed", at: new Date().toISOString(), label: entry.label });
        out(`  "${entry.label}" → ${student}`);
      }
      if (!args.dryRun) out(`saved ${links.save()}. Run the sync again to apply.`);
      return 0;
    }

    case "link": {
      const syncId = need(args.sync, "link");
      findSync(bundle, runId, syncId);
      const links = LinkTable.load(runId, args.linksDir);
      const pairs = args.extra;
      if (!pairs.length) throw new Error('usage: sync link RUN SYNC "Name as written=STUDENT-X" [--unlink]');
      for (const pair of pairs) {
        const at = pair.lastIndexOf("=");
        const label = (args.unlink && at < 0 ? pair : pair.slice(0, at)).trim();
        const key = nameLinkKey(label);
        if (args.unlink) {
          out(links.unset(syncId, key) ? `  forgot "${label}"` : `  "${label}" was not linked`);
          continue;
        }
        const student = pair.slice(at + 1).trim();
        if (at <= 0 || !/^STUDENT-[A-Z0-9]+$/.test(student)) throw new Error(`'${pair}' is not "Name=STUDENT-X"`);
        links.set(syncId, key, { student, how: "pinned", at: new Date().toISOString(), label });
        out(`  "${label}" → ${student}`);
      }
      if (!args.dryRun) out(`saved ${links.save()}`);
      return 0;
    }

    case "migrate": {
      const implied = syncsOf(bundle, runId).filter((sync) => sync.implied);
      if (!implied.length) {
        out(`${runId}: every sync is already written as syncs:.`);
        return 0;
      }
      for (const sync of implied) out(`  ${sync.sync_id.padEnd(20)} from ${sync.from}\n${indent(JSON.stringify(writtenForm(sync)))}`);
      if (args.dryRun) {
        out(`\n${implied.length} sync(s) would be written to ${runId}'s version.yaml (dry run).`);
        return 0;
      }
      const course = (bundle.course as { course_id: string }).course_id;
      const result = writeSyncs(root, course, runId, implied);
      out(
        `\nwrote ${implied.length} sync(s) into ${result.written.join(", ")}. The older settings they came from ` +
          "are left as they were and are no longer read for these.",
      );
      return 0;
    }

    default:
      throw new Error(
        `unknown sync subcommand '${args.subcommand}'. It is one of: list, show, plan, run, review, confirm, link, migrate`,
      );
  }
};

const need = (value: string | null, subcommand: string): string => {
  if (!value) throw new Error(`usage: sync ${subcommand} RUN SYNC — \`ainar sync list RUN\` names them`);
  return value;
};

const indent = (text: string): string => `      ${text}`;
