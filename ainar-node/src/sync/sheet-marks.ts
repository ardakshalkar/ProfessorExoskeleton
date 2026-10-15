/**
 * Running a marks-sheet sync: the professor's hand-kept grade sheet, read in —
 * and, with `role: both`, the course's changes written back.
 *
 * `ainar homework sync` and `ainar sync run … hw-sheet` are this one
 * function. What a mark means and who a row is are `grade-sheet.ts` and
 * `match.ts`; this reads the sheet (live, or a CSV export), runs the plan,
 * prints the three lists every sync prints, and — when not a dry run — writes
 * the records, the links, the ledger's base, the anchors and the cells.
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { enrolledIn } from "../bundle.ts";
import {
  defaultMarks,
  GITHUB_ANCHOR,
  NAME_ANCHOR,
  NOTE_ANCHOR,
  type SheetAnchors,
  type SheetConfig,
  type SyncPlan,
  applyFlags,
  applyGithubLogins,
  loadSheetConfig,
  planSync,
  rowContextFor,
  saveSheetConfig,
  sheetLayout,
  sheetRows,
} from "../grade-sheet.ts";
import { Ledger, type MarkChange } from "../lms/ledger.ts";
import { SheetsClient, a1, columnLetter, loadCredentials, spreadsheetIdOf } from "../lms/sheets.ts";
import { decidedAt, removeRecords, writeRecords } from "../records-write.ts";
import { RosterStore, loadSalt, parseDelimited, sniffDelimiter } from "../roster.ts";
import { LinkTable, anchorLinkKey } from "./links.ts";
import type { MatchStep } from "./match.ts";
import type { RunSync } from "./registry.ts";

/** The sheet settings a sync describes, with the older file's pins carried along. */
export const sheetConfigFromSync = (sync: RunSync, legacy: SheetConfig | null): SheetConfig => {
  const where = sync.where as Record<string, unknown>;
  const map = sync.map as Record<string, any>;
  const rows = (map.rows ?? {}) as Record<string, string>;
  const marks = map.marks
    ? Object.fromEntries(
        Object.entries(map.marks as Record<string, any>).map(([word, mark]) => [
          word.toUpperCase(),
          typeof mark === "number"
            ? { factor: mark, status: "submitted" as const, label: "handed in" }
            : { factor: Number(mark.factor), status: mark.status === "late" ? ("late" as const) : ("submitted" as const), label: String(mark.label ?? mark.status ?? "handed in") },
        ]),
      )
    : (legacy?.marks ?? defaultMarks());
  return {
    run: legacy?.run ?? "",
    url: (where.sheet as string | undefined) ?? legacy?.url ?? null,
    tab: (where.tab as string | undefined) ?? legacy?.tab ?? null,
    name_column: rows.name ?? legacy?.name_column ?? "Name",
    flag_column: rows.note ?? legacy?.flag_column ?? null,
    github_column: rows.github ?? legacy?.github_column ?? null,
    columns: (map.columns as Record<string, string> | undefined) ?? legacy?.columns ?? {},
    marks,
    students: legacy?.students ?? {},
    synced_at: legacy?.synced_at ?? null,
  };
};

/**
 * A hash of what a sheet says, the same for a live read and its CSV export:
 * cells trimmed, empty ends of rows and empty rows at the bottom dropped,
 * since the two disagree only about those. Formatting is not in it — a
 * colour change is not a change of marks.
 */
export const fingerprintOf = (grid: string[][]): string => {
  const rows = grid.map((row) => {
    const cells = row.map((cell) => String(cell ?? "").trim());
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    return cells;
  });
  while (rows.length && !rows[rows.length - 1]!.length) rows.pop();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 32);
};

/** Where a sync's sheet is, and its tab, for a live read or a check. */
export const openSheet = async (
  sync: RunSync,
  config: { url: string | null; tab: string | null },
  rosterDirectory: string,
  given?: SheetsClient,
): Promise<{ client: SheetsClient; id: string; tab: string; sheetId: number }> => {
  if (!config.url) throw new Error(`sync ${sync.sync_id} names no sheet: set where.sheet, or pass --from export.csv`);
  let client = given;
  if (!client) {
    try {
      client = new SheetsClient(loadCredentials(rosterDirectory, { connection: sync.connection ?? null }));
    } catch (error) {
      throw new Error(`${(error as Error).message}\n\nOr export the sheet as CSV and pass --from export.csv.`);
    }
  }
  const id = spreadsheetIdOf(config.url);
  const tabs = await client.tabs(id);
  const tab = config.tab ? tabs.find((entry) => entry.title === config.tab) : tabs[0];
  if (!tab) throw new Error(config.tab ? `the spreadsheet has no tab "${config.tab}"` : "the spreadsheet has no tabs");
  return { client, id, tab: tab.title, sheetId: tab.sheetId };
};

export interface MarksRun {
  plan: SyncPlan;
  rows: number;
  dryRun: boolean;
  wrote: { cells: number; anchors: number };
  /** Each mark the run added, changed or took back — or would, on a dry run. */
  changes: MarkChange[];
}

/**
 * The plan as marks rather than records: one entry per student and
 * assessment whose word or points it moves. A sheet mark is one cell and
 * several criterion grades; a professor asks about the cell.
 */
export const changesOf = (plan: SyncPlan, bundle: any): MarkChange[] => {
  const submissions = new Map<string, any>((bundle.submissions as any[]).map((entry) => [String(entry.submission_id), entry]));
  const evaluations = bundle.evaluations as any[];
  const before = new Map<string, any[]>();
  for (const evaluation of evaluations) {
    if (!evaluation.professor_decision) continue;
    const list = before.get(evaluation.submission_id) ?? [];
    list.push(evaluation);
    before.set(evaluation.submission_id, list);
  }
  const written = new Map<string, any>((plan.submissions as any[]).map((entry) => [String(entry.submission_id), entry]));
  const graded = new Map<string, any>((plan.evaluations as any[]).map((entry) => [String(entry.evaluation_id), entry]));
  const removedSubmissions = new Set(plan.remove.submissions);
  const removedEvaluations = new Set(plan.remove.evaluations);
  const byId = new Map(evaluations.map((entry) => [String(entry.evaluation_id), entry]));

  const touched = new Set<string>([
    ...written.keys(),
    ...[...graded.values()].map((entry) => String(entry.submission_id)),
    ...removedSubmissions,
    ...[...removedEvaluations].map((id) => String(byId.get(id)?.submission_id ?? "")).filter(Boolean),
  ]);
  const sum = (list: any[]): number | null =>
    list.length ? Math.round(list.reduce((total, entry) => total + Number(entry.professor_decision.score), 0) * 100) / 100 : null;

  const changes: MarkChange[] = [];
  for (const id of touched) {
    const old = submissions.get(id) ?? null;
    const now = removedSubmissions.has(id) ? null : (written.get(id) ?? old);
    const record = now ?? old;
    if (!record) continue;
    const was = before.get(id) ?? [];
    const after = removedSubmissions.has(id)
      ? []
      : [
          ...was.filter((entry) => !removedEvaluations.has(String(entry.evaluation_id)) && !graded.has(String(entry.evaluation_id))),
          ...[...graded.values()].filter((entry) => String(entry.submission_id) === id),
        ];
    const from = old?.extensions?.mark ? String(old.extensions.mark) : null;
    const to = now?.extensions?.mark ? String(now.extensions.mark) : null;
    const change: MarkChange = {
      student: String(record.student_id),
      assessment: String(record.assessment_id),
      from,
      to,
      score_from: sum(was),
      score_to: sum(after),
    };
    if (change.from === change.to && change.score_from === change.score_to) continue;
    changes.push(change);
  }
  return changes.sort((a, b) => a.assessment.localeCompare(b.assessment) || a.student.localeCompare(b.student));
};

/** "added P (10)", "P → L (10 → 8)", "took back P" — one change in a few words. */
export const describeChange = (change: MarkChange): string => {
  const points = (value: number | null) => (value === null ? "" : String(value));
  if (change.from === null && change.score_from === null) return `added ${change.to ?? "?"}${change.score_to !== null ? ` (${points(change.score_to)})` : ""}`;
  if (change.to === null && change.score_to === null) return `took back ${change.from ?? "the mark"}`;
  const words = change.from === change.to ? (change.to ?? "") : `${change.from ?? "—"} → ${change.to ?? "—"}`;
  const scores = change.score_from === change.score_to ? "" : ` (${points(change.score_from) || "—"} → ${points(change.score_to) || "—"})`;
  return `${words}${scores}`.trim();
};

export const runMarksSync = async (options: {
  bundle: any;
  runId: string;
  root: string;
  sync: RunSync;
  rosterDirectory: string;
  from?: string | null;
  dryRun: boolean;
  json?: boolean;
  /** Print pseudonyms rather than the class list's names. */
  codes?: boolean;
  out: (line: unknown) => void;
  linksDirectory?: string | null;
  syncDirectory?: string | null;
  sheetsDirectory?: string;
  /** For tests: a client that never leaves the machine. */
  client?: SheetsClient;
}): Promise<MarksRun> => {
  const { bundle, runId, sync, out } = options;
  const run = (bundle.versions as any[]).find((entry) => entry.course_version_id === runId);
  const legacy = loadSheetConfig(runId, options.sheetsDirectory);
  const config = { ...sheetConfigFromSync(sync, legacy), run: runId };
  if (!Object.keys(config.columns).length) {
    throw new Error(`sync ${sync.sync_id} maps no columns — give it map.columns: { "<header>": ASSESSMENT-… }`);
  }
  if (sync.role === "target") throw new Error(`sync ${sync.sync_id} is a target; a marks sheet is read with role source or both`);

  // The grid: a CSV someone exported, or the sheet itself through its connection.
  let grid: string[][];
  let live: { client: SheetsClient; id: string; tab: string; sheetId: number } | null = null;
  let anchors: SheetAnchors | null = null;
  if (options.from) {
    const text = readFileSync(resolve(options.from), "utf-8").replace(/^﻿/, "");
    grid = parseDelimited(text, sniffDelimiter(text.split(/\r?\n/, 1)[0] ?? ""));
  } else {
    live = await openSheet(sync, config, options.rosterDirectory, options.client);
    grid = await live.client.read(live.id, a1(live.tab, "A1:ZZ"));
    if (sync.anchors) anchors = await live.client.anchors(live.id, live.sheetId);
  }
  const role = sync.role === "both" && !live ? "source" : (sync.role as "source" | "both");
  if (sync.role === "both" && !live) out("  note   read from a CSV, so nothing is written back to the sheet this time");

  let salt: Uint8Array | null = null;
  try {
    salt = loadSalt(options.rosterDirectory, { create: false });
  } catch {
    salt = null;
  }
  const store = RosterStore.load(options.rosterDirectory);
  const links = LinkTable.load(runId, options.linksDirectory);
  const ledger = Ledger.load(runId, options.syncDirectory);
  const enrolled = new Set(enrolledIn(bundle, runId).map((entry) => entry.student_id as string));
  const stamp = decidedAt(run?.timezone);
  const rows = sheetRows(grid, config, anchors);
  const plan = planSync({
    rows,
    config,
    bundle,
    runId,
    store,
    salt,
    enrolled,
    decidedBy: (run?.instructors ?? [])[0] ?? null,
    decidedAt: stamp,
    syncId: sync.sync_id,
    links,
    steps: (sync.match.length ? sync.match : ["link", "name", "name:one-word"]) as MatchStep[],
    unsure: sync.unsure,
    role,
    conflict: sync.conflict,
    base: ledger.synced(sync.sync_id),
    anchors: Boolean(sync.anchors && live),
    rowContext: rowContextFor(grid, sheetLayout(grid, config, anchors), {
      sheet: config.url,
      tab: live ? live.tab : config.tab,
      gid: live ? live.sheetId : null,
    }),
  });

  // The class list's names in place of codes, unless asked for codes — the
  // reader decides "is Sapashev Arthur Sapashev Artur?", not "…STUDENT-VFWID7?".
  const named = (text: string): string =>
    options.codes
      ? text
      : text.replace(/STUDENT-[A-Z0-9]+/g, (code) => (store.people[code] as { name?: string } | undefined)?.name || code);
  const changes = changesOf(plan, bundle);
  report(plan, rows, options.dryRun, sync, (line) => out(typeof line === "string" ? named(line) : line), options.json === true, runId, changes);
  const result: MarksRun = { plan, rows: rows.length, dryRun: options.dryRun, wrote: { cells: 0, anchors: 0 }, changes };
  if (options.dryRun) {
    // The rows it could not place, kept for review now — nothing else.
    links.saveQueue(sync.sync_id);
    return result;
  }

  const courseDir = join(options.root, "courses", (bundle.course as { course_id: string }).course_id);
  if (plan.remove.evaluations.length) removeRecords(courseDir, "evaluations", plan.remove.evaluations);
  if (plan.remove.submissions.length) removeRecords(courseDir, "submissions", plan.remove.submissions);
  writeRecords(courseDir, { submissions: plan.submissions as any[], evaluations: plan.evaluations as any[] });
  const flagged = applyFlags(store, runId, plan.placed.map((entry) => entry.student), plan.flags);
  const githubs = applyGithubLogins(store, plan.githubs);
  if (flagged || githubs.changed) store.save();

  if (live && plan.writeBack.length) {
    const layout = sheetLayout(grid, config, anchors);
    result.wrote.cells = await live.client.writeCells(
      live.id,
      plan.writeBack.map((cell) => ({ range: a1(live!.tab, `${columnLetter(layout.columns[cell.column]!)}${cell.line}`), value: cell.word })),
    );
  }
  if (live && sync.anchors) result.wrote.anchors = await anchorSheet(live, grid, config, anchors, plan, links, sync.sync_id, stamp);

  ledger.recordSynced(sync.sync_id, plan.synced);
  ledger.recordRun(sync.sync_id, stamp);
  ledger.recordEvent(sync.sync_id, {
    at: stamp,
    read: live ? "sheet" : "file",
    saved: live ? stamp : savedAt(options.from!),
    rows: rows.length,
    placed: plan.placed.length,
    held: plan.problems.filter((problem) => problem.line !== null).length,
    waiting: plan.queued,
    unchanged: plan.unchanged,
    wrote_back: result.wrote.cells,
    changes,
    // What the sheet says now, as a hash, for `sync check` to compare against
    // later — read again when this run wrote into it, so our own cells are
    // not mistaken for an edit.
    fingerprint: fingerprintOf(live && result.wrote.cells ? await live.client.read(live.id, a1(live.tab, "A1:ZZ")) : grid),
    modified: live && typeof live.client.modifiedTime === "function" ? await live.client.modifiedTime(live.id) : null,
  });
  ledger.save();
  if (links.changed) links.save();
  if (legacy) saveSheetConfig({ ...legacy, synced_at: stamp }, options.sheetsDirectory);
  if (!options.json) {
    if (flagged) out(`  ${flagged} flag note(s) updated in ${store.path}`);
    if (githubs.changed) out(`  ${githubs.changed} GitHub account(s) recorded in ${store.path}`);
    for (const entry of githubs.refused) {
      out(named(`  held   ${entry.student}: "${entry.value}" under "${config.github_column}" is not a GitHub account — not recorded`));
    }
    if (result.wrote.cells) out(`  wrote ${result.wrote.cells} cell(s) back into the sheet`);
    if (result.wrote.anchors) out(`  anchored ${result.wrote.anchors} row(s) and column(s)`);
  }
  return result;
};

/**
 * When a downloaded copy was saved: its file time. The pane sets that to the
 * time the browser saved the download, so it is the sheet's age, not the
 * moment it was dropped on the card.
 */
const savedAt = (path: string): string | null => {
  try {
    return statSync(resolve(path)).mtime.toISOString();
  } catch {
    return null;
  }
};

/** Tag every placed row and mapped column that has no tag yet. */
const anchorSheet = async (
  live: { client: SheetsClient; id: string; sheetId: number },
  grid: string[][],
  config: SheetConfig,
  anchors: SheetAnchors | null,
  plan: SyncPlan,
  links: LinkTable,
  syncId: string,
  at: string,
): Promise<number> => {
  const layout = sheetLayout(grid, config, anchors);
  const tagged = new Set(anchors?.columns.keys() ?? []);
  const wanted: { dimension: "ROWS" | "COLUMNS"; index: number; value: string }[] = [];
  const column = (index: number, value: string) => {
    if (index >= 0 && !tagged.has(index)) wanted.push({ dimension: "COLUMNS", index, value });
  };
  column(layout.name, NAME_ANCHOR);
  column(layout.flag, NOTE_ANCHOR);
  column(layout.github, GITHUB_ANCHOR);
  for (const [header, index] of Object.entries(layout.columns)) column(index, config.columns[header]!);
  for (const row of plan.anchor) {
    // Random, so the sheet alone never says who a row is; the pairing is the private link.
    const tag = randomBytes(6).toString("hex");
    links.set(syncId, anchorLinkKey(tag), { student: row.student, how: "anchor", at });
    wanted.push({ dimension: "ROWS", index: row.line - 1, value: tag });
  }
  await live.client.addAnchors(live.id, live.sheetId, wanted);
  return wanted.length;
};

/** The report every sync prints: placed, check, held, then what was or would be written. */
const report = (
  plan: SyncPlan,
  rows: { line: number; name: string }[],
  dryRun: boolean,
  sync: RunSync,
  out: (line: unknown) => void,
  json: boolean,
  runId: string,
  changes: MarkChange[],
): void => {
  if (json) {
    out({ sync: sync.sync_id, dry_run: dryRun, rows: rows.length, ...plan, changes });
    return;
  }
  out(`${sync.sync_id} (${sync.role} · ${sync.stream}): ${rows.length} row(s), ${plan.placed.length} placed${dryRun ? " (dry run)" : ""}`);
  for (const entry of plan.placed.filter((placed) => placed.match === "partial" || placed.match === "close")) {
    const row = rows.find((candidate) => candidate.line === entry.line)!;
    out(`  check  line ${entry.line} "${row.name}" → ${entry.student} (${entry.match} match)`);
  }
  for (const problem of plan.problems) {
    const where = problem.line ? `line ${problem.line}${problem.name ? ` "${problem.name}"` : ""}: ` : "";
    out(`  held   ${where}${problem.problem}`);
  }
  if (plan.queued) {
    out(
      `  ${plan.queued} waiting for you — confirm them under "Waiting for you" in the pane's Syncs view, ` +
        `or with \`ainar sync review ${runId} ${sync.sync_id}\``,
    );
  }
  if (plan.kept.length) {
    out(`  kept   ${plan.kept.length} earlier submission(s) the sheet no longer places — a held row may be those students; place it and sync again`);
  }
  const verb = dryRun ? "would write" : "wrote";
  out(
    `  ${verb} ${plan.submissions.length} submission(s), ${plan.evaluations.length} grade(s)` +
      `; ${plan.unchanged} grade(s) unchanged` +
      (plan.remove.submissions.length || plan.remove.evaluations.length
        ? `; ${dryRun ? "would take back" : "took back"} ${plan.remove.submissions.length} submission(s) and ` +
          `${plan.remove.evaluations.length} grade(s) the sheet no longer has`
        : "") +
      (plan.writeBack.length ? `; ${dryRun ? "would write" : "writes"} ${plan.writeBack.length} cell(s) back to the sheet` : ""),
  );
  // The marks themselves, so "what did the sheet bring" is answered by name.
  const SHOWN = 15;
  for (const change of changes.slice(0, SHOWN)) {
    out(`  ${dryRun ? "would" : "mark "}  ${change.student} · ${change.assessment}: ${describeChange(change)}`);
  }
  if (changes.length > SHOWN) out(`  … and ${changes.length - SHOWN} more mark(s)`);
};
