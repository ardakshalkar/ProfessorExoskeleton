/**
 * Which student a row on the far side is, remembered.
 *
 * Every service needs the same fact — "this row is STUDENT-JNG7SN" — and until
 * now each kept it its own way: name pins in `~/.ainar/sheets/RUN.json`, Canvas
 * user ids in the roster's `people.json`, a `student:` beside a paper in a scan
 * plan. A link table is the pattern sync tools settle on (match once, then keep
 * the link; MIM's join, Whalesync's first-sync match): a name is how a person
 * is found the FIRST time, and the link is how they are found every time after.
 *
 * One file per run, beside the roster and outside the repository, because a
 * link ties something personal — a name as written, an anchor in a sheet of
 * names — to a pseudonym, and that pairing is exactly what the roster protects.
 *
 *     ~/.ainar/links/<RUN>.json
 *     {
 *       "version": 1,
 *       "links":   { "<sync>": { "<key>": { "student", "how", "at", "label"? } } },
 *       "pending": { "<sync>": { "<key>": { "label", "line"?, "candidates": [...], "why", "at" } } }
 *     }
 *
 * A key says what kind of thing was linked: `name:<nameKey>` for a name as
 * written (case, order and punctuation set aside, so retyping it the same way
 * still finds it), `anchor:<tag>` for an invisible tag on a sheet row,
 * `canvas-user:<id>`, `file:<name>`.
 *
 * `pending` is the review queue. A match the matcher was not sure of, under
 * `unsure: hold`, waits there with its candidates until `ainar sync confirm`
 * moves it into `links` — or `ainar sync link` names someone else.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { nameKey } from "../scans.ts";

export const LINKS_VERSION = 1;

export interface Link {
  student: string;
  /** How it was made: `confirmed`, `pinned`, `name`, `words`, `code`, `key`, `migrated`. */
  how: string;
  at: string;
  /** The name or file name as written, kept for a person reading the file. Private like the rest. */
  label?: string;
}

export interface Candidate {
  student: string;
  /** `close`, `partial`, or a distance for a near miss. */
  match: string;
}

/**
 * Where a waiting row came from, so a person can see it as it stands in the
 * sheet rather than as a line number: the header, the row, and one row each
 * side. Kept with the queue, privately, because it holds names.
 */
export interface RowContext {
  source: "sheet";
  /** The spreadsheet's URL or id, when it was read live or is known. */
  sheet?: string | null;
  tab?: string | null;
  /** The tab's numeric id, for a link that opens on the row. Live reads only. */
  gid?: number | null;
  /** 0-based sheet column of the first cell shown, so a view can letter the columns A, B, C… */
  firstColumn: number;
  /** Index within the shown cells of the names, so a view can hide them in pseudonym mode. */
  nameColumn: number;
  /** 0-based columns the sync reads marks from. */
  markColumns: number[];
  header: string[];
  /** The row and its neighbours, 1-based lines as the sheet numbers them. */
  rows: { line: number; cells: string[] }[];
}

export interface Pending {
  label: string;
  line?: number | null;
  candidates: Candidate[];
  why: string;
  at: string;
  context?: RowContext | null;
}

export const linksDir = (explicit?: string | null): string => {
  if (explicit) return explicit;
  if (process.env.AINAR_LINKS_DIR) return process.env.AINAR_LINKS_DIR;
  return join(homedir(), ".ainar", "links");
};

export const nameLinkKey = (name: string): string => `name:${nameKey(name)}`;
export const anchorLinkKey = (tag: string): string => `anchor:${tag}`;

export class LinkTable {
  path: string;
  runId: string;
  links: Record<string, Record<string, Link>> = {};
  pending: Record<string, Record<string, Pending>> = {};
  private dirty = false;

  constructor(path: string, runId: string) {
    this.path = path;
    this.runId = runId;
  }

  static load(runId: string, directory?: string | null): LinkTable {
    const path = join(linksDir(directory), `${runId}.json`);
    const table = new LinkTable(path, runId);
    if (!existsSync(path)) return table;
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    table.links = raw.links ?? {};
    table.pending = raw.pending ?? {};
    return table;
  }

  get changed(): boolean {
    return this.dirty;
  }

  get(syncId: string, key: string): Link | null {
    return this.links[syncId]?.[key] ?? null;
  }

  /** Every key linked to one student in one sync — for writing back to their row. */
  keysOf(syncId: string, student: string): string[] {
    return Object.entries(this.links[syncId] ?? {})
      .filter(([, link]) => link.student === student)
      .map(([key]) => key);
  }

  set(syncId: string, key: string, link: Link): void {
    const before = this.links[syncId]?.[key];
    if (before && before.student === link.student && before.label === link.label) return;
    (this.links[syncId] ??= {})[key] = link;
    if (this.pending[syncId]?.[key]) delete this.pending[syncId]![key];
    this.dirty = true;
  }

  unset(syncId: string, key: string): boolean {
    if (!this.links[syncId]?.[key]) return false;
    delete this.links[syncId]![key];
    this.dirty = true;
    return true;
  }

  /** Put a match in the review queue, replacing what was queued for the same key. */
  queue(syncId: string, key: string, entry: Pending): void {
    const before = this.pending[syncId]?.[key];
    const same =
      before &&
      before.label === entry.label &&
      before.why === entry.why &&
      before.line === entry.line &&
      JSON.stringify(before.candidates) === JSON.stringify(entry.candidates) &&
      JSON.stringify(before.context ?? null) === JSON.stringify(entry.context ?? null);
    if (same) return;
    (this.pending[syncId] ??= {})[key] = entry;
    this.dirty = true;
  }

  /** Drop queued entries this run of the sync did not see again — the row was fixed or removed. */
  pruneQueue(syncId: string, seen: Set<string>): void {
    for (const key of Object.keys(this.pending[syncId] ?? {})) {
      if (seen.has(key)) continue;
      delete this.pending[syncId]![key];
      this.dirty = true;
    }
  }

  queued(syncId: string): [string, Pending][] {
    return Object.entries(this.pending[syncId] ?? {});
  }

  /**
   * Write one sync's review queue and nothing else — for a plan.
   *
   * A plan changes nothing in the course or on the far side, and it should
   * not teach the link table either: what it matched for sure is remembered
   * when the sync runs. But the rows it could not place are worth keeping at
   * once, so the review list shows what the preview just found rather than
   * waiting for a run. Read fresh from disk so the plan's in-memory links are
   * not written with it.
   */
  saveQueue(syncId: string): string {
    const disk = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf-8")) : {};
    const onDisk = new LinkTable(this.path, this.runId);
    onDisk.links = disk.links ?? {};
    onDisk.pending = disk.pending ?? {};
    if (JSON.stringify(onDisk.pending[syncId] ?? {}) === JSON.stringify(this.pending[syncId] ?? {})) return this.path;
    if (this.pending[syncId] && Object.keys(this.pending[syncId]!).length) onDisk.pending[syncId] = this.pending[syncId]!;
    else delete onDisk.pending[syncId];
    return onDisk.save();
  }

  save(): string {
    mkdirSync(join(this.path, ".."), { recursive: true });
    const payload = {
      version: LINKS_VERSION,
      note:
        "Which student a row outside this workspace is, per sync. Private: a link " +
        "ties a name as written, or an anchor in a sheet of names, to a pseudonym.",
      run: this.runId,
      links: this.links,
      pending: this.pending,
    };
    writeFileSync(this.path, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf-8" });
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // No POSIX permissions here; the file is still outside the repository.
    }
    this.dirty = false;
    return this.path;
  }
}

/**
 * Bring a sheet's name pins in from the older settings file, once.
 *
 * `homework sheet --student "Name=STUDENT-X"` wrote them into
 * `~/.ainar/sheets/RUN.json`. They are links by another name, so the first
 * sync that has a link table reads them in and the old file is left as it is.
 */
export const adoptPins = (table: LinkTable, syncId: string, pins: Record<string, string>, at: string): number => {
  let adopted = 0;
  for (const [name, student] of Object.entries(pins)) {
    const key = nameLinkKey(name);
    if (table.get(syncId, key)) continue;
    table.set(syncId, key, { student, how: "pinned", at, label: name });
    adopted += 1;
  }
  return adopted;
};
