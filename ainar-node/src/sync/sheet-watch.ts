/**
 * Has the grade sheet changed since it was last synced? A question, never a
 * sync: nothing here writes a record, a link, the ledger or a cell.
 *
 * Two answers are put together. The values of the tab, hashed the way a sync
 * hashes what it read (`fingerprintOf`), say WHETHER the sheet says anything
 * different — a recoloured cell is not a change of marks. Drive's
 * `modifiedTime` for the file says WHEN, which the Sheets API cannot; it is
 * the whole spreadsheet's time, not one cell's, and is null when the key's
 * project has the Drive API off.
 *
 * The hashes disagreeing while Drive says the file has not changed since the
 * copy the last sync read was saved is a CSV export differing from a live read
 * in some way the hash does not smooth over, not an edit; that is "same".
 */

import { loadSheetConfig } from "../grade-sheet.ts";
import { Ledger } from "../lms/ledger.ts";
import { type SheetsClient, a1 } from "../lms/sheets.ts";
import type { RunSync } from "./registry.ts";
import { fingerprintOf, openSheet, sheetConfigFromSync } from "./sheet-marks.ts";

export interface SheetCheck {
  sync: string;
  /** `changed`: the sheet says something the last sync did not read. */
  state: "changed" | "same" | "never-synced" | "unknown";
  checked_at: string;
  /** Drive's last-changed time for the spreadsheet, or null. */
  modified: string | null;
  /** The last sync that ran for real, and how old the sheet it read was. */
  last_synced: string | null;
  last_saved: string | null;
  /** One sentence for a person. */
  said: string;
}

export const checkSheet = async (options: {
  runId: string;
  sync: RunSync;
  rosterDirectory: string;
  syncDirectory?: string | null;
  sheetsDirectory?: string;
  /** For tests: a client that never leaves the machine. */
  client?: SheetsClient;
  now?: Date;
}): Promise<SheetCheck> => {
  const { runId, sync } = options;
  if (sync.service !== "sheets" || sync.stream !== "marks") throw new Error(`${sync.sync_id} is not a grade sheet`);
  const config = sheetConfigFromSync(sync, loadSheetConfig(runId, options.sheetsDirectory));
  const live = await openSheet(sync, config, options.rosterDirectory, options.client);
  const grid = await live.client.read(live.id, a1(live.tab, "A1:ZZ"));
  const fingerprint = fingerprintOf(grid);
  const modified = typeof live.client.modifiedTime === "function" ? await live.client.modifiedTime(live.id) : null;
  const [last] = Ledger.load(runId, options.syncDirectory).events(sync.sync_id);

  const base = {
    sync: sync.sync_id,
    checked_at: (options.now ?? new Date()).toISOString(),
    modified,
    last_synced: last?.at ?? null,
    last_saved: last?.saved ?? null,
  };
  const edited = modified ? ` (last edited ${modified})` : "";
  if (!last) return { ...base, state: "never-synced", said: `the sheet has not been synced yet${edited}` };

  const after = (a: string | null, b: string | null): boolean | null =>
    a && b && !Number.isNaN(Date.parse(a)) && !Number.isNaN(Date.parse(b)) ? Date.parse(a) > Date.parse(b) : null;
  const editedSince = after(modified, last.saved);

  let changed: boolean | null;
  if (last.fingerprint) changed = last.fingerprint !== fingerprint && editedSince !== false;
  else changed = editedSince;

  if (changed === null) {
    return { ...base, state: "unknown", said: "cannot tell: the last sync kept no fingerprint and Google does not say when the sheet changed" };
  }
  return changed
    ? { ...base, state: "changed", said: `the sheet has changed since the last sync${edited}` }
    : { ...base, state: "same", said: "the sheet says what it said at the last sync" };
};
