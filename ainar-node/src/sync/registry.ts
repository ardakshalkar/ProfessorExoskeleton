/**
 * Every sync a run has: the ones written down as `syncs:`, and the ones its
 * older settings already imply.
 *
 * A run set up before `syncs:` existed is not broken by it. Its
 * `extensions.lms`, its `~/.ainar/sheets/RUN.json`, its
 * `extensions.telegram` each describe a road; this reads them as syncs —
 * marked `implied` — so `ainar sync list` shows the whole picture from the
 * first day, and `ainar sync migrate` can write them out as the real thing.
 * A written sync for the same service and stream replaces the implied one.
 */

import { Document } from "yaml";
import { loadSheetConfig, type SheetConfig } from "../grade-sheet.ts";
import { COLLECTIONS } from "../loader.ts";
import { Sync, type SyncSpec } from "../model/sync.ts";
import { editRecords, type EditResult } from "../record-edit.ts";
import { CANVAS_COURSES_KEY, CANVAS_COURSE_KEY, LMS_EXTENSION, SHEET_ID_KEY } from "../lms/index.ts";

export interface RunSync extends SyncSpec {
  /** Read from older settings rather than written as `syncs:`. */
  implied?: boolean;
  /** Where an implied sync was read from, for a person. */
  from?: string;
}

const lms = (entity: any): Record<string, unknown> => {
  const found = entity?.extensions?.[LMS_EXTENSION];
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};

const make = (spec: Record<string, unknown>, from: string): RunSync => ({
  ...(Sync.parse(spec) as SyncSpec),
  implied: true,
  from,
});

/** The grade-sheet settings as a sync. Pins are not here: they are links. */
export const sheetConfigAsSync = (config: SheetConfig, syncId = "hw-sheet"): Record<string, unknown> => ({
  sync_id: syncId,
  service: "sheets",
  role: "source",
  stream: "marks",
  where: { ...(config.url ? { sheet: config.url } : {}), ...(config.tab ? { tab: config.tab } : {}) },
  match: ["link", "name", "name:one-word"],
  unsure: "hold",
  write: "upsert",
  remove: "own",
  conflict: "refuse",
  map: {
    rows: { name: config.name_column, ...(config.flag_column ? { note: config.flag_column } : {}) },
    columns: config.columns,
    marks: Object.fromEntries(
      Object.entries(config.marks).map(([word, mark]) => [word, { factor: mark.factor, status: mark.status, label: mark.label }]),
    ),
  },
});

/** What the older settings of one run describe. */
export const impliedSyncs = (bundle: any, runId: string, options: { sheetsDir?: string } = {}): RunSync[] => {
  const run = (bundle.versions as any[]).find((entry) => entry.course_version_id === runId);
  if (!run) return [];
  const found: RunSync[] = [];
  const link = lms(run);
  const hasCanvas = link[CANVAS_COURSE_KEY] != null || link[CANVAS_COURSES_KEY] != null;
  if (hasCanvas) {
    const from = `${runId} extensions.lms`;
    found.push(
      make({ sync_id: "canvas-roster", service: "canvas", role: "source", stream: "roster", match: ["link", "key:sis-id", "key:login", "key:email", "name"], write: "upsert", remove: "never" }, from),
      make({ sync_id: "canvas-submissions", service: "canvas", role: "source", stream: "submissions", match: ["link", "key:sis-id"], write: "upsert", remove: "never" }, from),
      make({ sync_id: "canvas-grades", service: "canvas", role: "target", stream: "grades", match: ["link", "key:sis-id"], write: "upsert", remove: "never", conflict: "refuse" }, from),
      make({ sync_id: "canvas-assignment", service: "canvas", role: "target", stream: "assignment", write: "upsert", remove: "never", conflict: "refuse" }, from),
    );
  }
  if (link[SHEET_ID_KEY] != null) {
    found.push(
      make(
        {
          sync_id: "gradebook-copy",
          service: "sheets",
          role: "target",
          stream: "grades",
          where: { sheet: String(link[SHEET_ID_KEY]) },
          match: ["code"],
          write: "mirror",
          remove: "own",
          conflict: "refuse",
        },
        `${runId} extensions.lms.${SHEET_ID_KEY}`,
      ),
    );
  }
  const sheet = loadSheetConfig(runId, options.sheetsDir);
  if (sheet && Object.keys(sheet.columns).length) {
    found.push(make(sheetConfigAsSync(sheet), `~/.ainar/sheets/${runId}.json`));
  }
  const telegram = run.extensions?.telegram;
  if (telegram && typeof telegram === "object" && (telegram as any).chat_id != null) {
    found.push(
      make(
        { sync_id: "telegram", service: "telegram", role: "target", stream: "announcement", where: { chat: String((telegram as any).chat_id) }, write: "append" },
        `${runId} extensions.telegram`,
      ),
    );
  }
  const repos = (bundle.assessments as any[]).filter(
    (entry) => entry.course_version_id === runId && entry.extensions?.github?.template_repo,
  );
  if (repos.length) {
    found.push(
      make({ sync_id: "homework-repos", service: "github", role: "target", stream: "repo", write: "upsert", remove: "never" }, "assessment extensions.github"),
    );
  }
  return found;
};

/** The run's syncs: written ones, then implied ones nothing written replaces. */
export const syncsOf = (bundle: any, runId: string, options: { sheetsDir?: string } = {}): RunSync[] => {
  const run = (bundle.versions as any[]).find((entry) => entry.course_version_id === runId);
  if (!run) throw new Error(`no run ${runId} in this workspace`);
  const written: RunSync[] = ((run.syncs ?? []) as SyncSpec[]).map((entry) => ({ ...entry }));
  const covered = new Set(written.map((entry) => `${entry.service}|${entry.stream}|${entry.role}`));
  const ids = new Set(written.map((entry) => entry.sync_id));
  const implied = impliedSyncs(bundle, runId, options).filter(
    (entry) => !covered.has(`${entry.service}|${entry.stream}|${entry.role}`) && !ids.has(entry.sync_id),
  );
  return [...written, ...implied];
};

export const findSync = (bundle: any, runId: string, syncId: string, options: { sheetsDir?: string } = {}): RunSync => {
  const all = syncsOf(bundle, runId, options);
  const found = all.find((entry) => entry.sync_id === syncId);
  if (!found) {
    throw new Error(
      `${runId} has no sync '${syncId}'. It has: ${all.map((entry) => entry.sync_id).join(", ") || "none"} — ` +
        "`ainar sync list " + runId + "`",
    );
  }
  return found;
};

/** The sync as it would be written into `version.yaml`: defaults left out, so the file says only what was chosen. */
export const writtenForm = (sync: RunSync): Record<string, unknown> => {
  const defaults = Sync.parse({ sync_id: sync.sync_id, service: sync.service, role: sync.role, stream: sync.stream }) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sync)) {
    if (key === "implied" || key === "from") continue;
    if (value === null || value === undefined) continue;
    if (["sync_id", "service", "role", "stream"].includes(key)) {
      out[key] = value;
      continue;
    }
    if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
    out[key] = value;
  }
  return out;
};

/**
 * Write syncs onto the run's record, replacing any with the same id.
 *
 * Through `record-edit.ts`, which keeps the comments of a hand-written
 * `version.yaml`. Settings only: the older places they were read from are left
 * alone, and once a written sync covers them they stop being read.
 */
export const writeSyncs = (root: string, courseId: string, runId: string, syncs: RunSync[]): EditResult => {
  const edits = new Map<string, (node: any) => void>();
  edits.set(runId, (node) => {
    const before = node.get("syncs");
    const existing: Record<string, unknown>[] = before && typeof before.toJSON === "function" ? before.toJSON() : [];
    const replaced = new Set(syncs.map((entry) => entry.sync_id));
    const merged = [...existing.filter((entry) => !replaced.has(String(entry.sync_id))), ...syncs.map(writtenForm)];
    node.set("syncs", new Document(merged).contents);
  });
  return editRecords({
    root,
    courseId,
    patterns: COLLECTIONS.versions,
    idField: "course_version_id",
    collection: "versions",
    edits,
  });
};
