/**
 * Snoozed waiting items: "not until <date>" on something in Today's and
 * Waiting's list. BACKLOG E37 HOME-5.
 *
 * Kept on this machine, not in the course: a snooze is the professor's
 * choice about when to be reminded, not a fact about the course, and the
 * records must not change because somebody said "not this week". Not
 * TODO-10's postpone either, which moves a date students see.
 *
 *     ~/.ainar/pane/<RUN>.json   { "snoozed": { "<item id>": "YYYY-MM-DD" } }
 *
 * `AINAR_PANE_DIR` moves the folder, as `AINAR_SYNC_DIR` moves the sync
 * ledger's. An item comes back on its date by itself: the list is computed
 * every time, and a snooze whose day has come is simply ignored, then
 * dropped at the next write.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const RUN = /^[A-Z0-9][A-Z0-9-]*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ITEM = /^[a-z]+(-[A-Za-z0-9-]+)?$/;

export const paneDir = () => (process.env.AINAR_PANE_DIR ? resolve(process.env.AINAR_PANE_DIR) : join(homedir(), ".ainar", "pane"));

const pathOf = (runId) => {
  if (!RUN.test(String(runId))) throw new Error(`${runId} is not a run id.`);
  return join(paneDir(), runId + ".json");
};

/** Today in the machine's calendar, as the ISO date the snoozes are. */
export const todayIso = () => {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
};

/** Every snooze still in force for a run: item id → the day it comes back. */
export const snoozesOf = (runId) => {
  let stored = {};
  try {
    const path = pathOf(runId);
    if (existsSync(path)) stored = JSON.parse(readFileSync(path, "utf8")).snoozed || {};
  } catch {
    stored = {};
  }
  const today = todayIso();
  return Object.fromEntries(Object.entries(stored).filter(([, until]) => DAY.test(String(until)) && until > today));
};

/**
 * Snooze an item until a day (after today), or wake it (`until` null). The
 * file is written whole, through a temporary name, so a crash cannot leave
 * half of it.
 */
export const setSnooze = (runId, item, until) => {
  if (!ITEM.test(String(item))) return { error: "Which item?" };
  if (until !== null && (!DAY.test(String(until)) || until <= todayIso())) return { error: "Snooze until a day after today." };
  const snoozed = snoozesOf(runId);
  if (until === null) delete snoozed[item];
  else snoozed[item] = until;
  const path = pathOf(runId);
  mkdirSync(paneDir(), { recursive: true });
  const temporary = path + ".tmp";
  writeFileSync(temporary, JSON.stringify({ snoozed }, null, 2) + "\n", "utf8");
  renameSync(temporary, path);
  return { ok: true, snoozed };
};
