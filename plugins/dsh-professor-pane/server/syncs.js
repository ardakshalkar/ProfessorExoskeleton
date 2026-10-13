/**
 * The Syncs view of the Integrations tab: every road between the run and a
 * service outside it, and the matches waiting for the professor.
 *
 * Read here, written through the CLI. The document comes from the same three
 * places `ainar sync` reads — the run's `syncs:` (or what its older settings
 * imply), the private link table, the private class list — and every press
 * spawns `ainar sync …`, for `runPublish`'s reason: the rules about what may
 * be sent, what is held and what needs `--confirm` live in
 * `ainar-node/src/sync/`, and a second copy in a web server would be a second
 * answer to "may this reach Canvas".
 *
 * Names are resolved here, from `people.json` on this machine, and only when
 * the pane's Names mode is on — the reason the review list exists is that
 * "Ostanin Artym → STUDENT-B7K2QA" asks a professor to decide something they
 * cannot read. Off, the codes stay, which is always a correct answer.
 */

import { existsSync, mkdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { assessmentsOf, enrolledIn } from "@ainar/core/src/bundle.ts";
import { exportPath, loadSheetConfig } from "@ainar/core/src/grade-sheet.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { LinkTable } from "@ainar/core/src/sync/links.ts";
import { syncsOf } from "@ainar/core/src/sync/registry.ts";
import { checkSheet } from "@ainar/core/src/sync/sheet-watch.ts";

import { loadCredentials } from "@ainar/core/src/lms/sheets.ts";

import { runScans } from "./actions.js";
import { loadedRun, rosterDir, rosterPeople } from "./workspace.js";

/** What a professor calls each road, by service, stream and role. */
const LABELS = {
  "sheets|marks": "Grade sheet you keep",
  "sheets|grades": "Gradebook copy in Google Sheets",
  "canvas|roster": "Canvas class list",
  "canvas|submissions": "Canvas hand-ins",
  "canvas|grades": "Canvas grades",
  "canvas|assignment": "Canvas assignments",
  "telegram|announcement": "Telegram channel",
  "github|repo": "Homework repositories",
};

/**
 * Whether running a sync changes something other people see, so the press
 * that does it is a separate one after a plan. The same line the CLI draws
 * with `--confirm`.
 */
const isLive = (sync) =>
  sync.role === "target" ||
  (sync.service === "sheets" && sync.stream === "marks" && (sync.role === "both" || sync.anchors));

/** What a sync needs chosen before it can be planned. */
const needs = (sync) =>
  ["grades", "assignment", "submissions", "repo"].includes(sync.stream) && sync.service !== "sheets"
    ? "assessment"
    : sync.stream === "announcement"
      ? "message"
      : null;

const isMarksSheet = (sync) => sync.service === "sheets" && sync.stream === "marks";

/**
 * A waiting row's place in the sheet, for the view to draw as a small grid.
 *
 * In pseudonym mode the name column is blanked — in the row and in its
 * neighbours — since a sheet of names is exactly what that mode hides. The
 * link opens the spreadsheet on the row when the tab's id is known (a live
 * read), and on the spreadsheet otherwise (a CSV export carries no tab id).
 */
const previewOf = (context, names, line) => {
  if (!context || context.source !== "sheet") return null;
  const hide = (cells) => cells.map((cell, index) => (!names && index === context.nameColumn && cell ? "•••" : cell));
  let open = null;
  const sheet = String(context.sheet || "").trim();
  if (sheet) {
    let id = sheet;
    const found = /\/d\/([A-Za-z0-9_-]+)/.exec(sheet);
    if (found) id = found[1];
    if (/^[A-Za-z0-9_-]{10,}$/.test(id)) {
      open =
        "https://docs.google.com/spreadsheets/d/" +
        id +
        "/edit" +
        (Number.isInteger(context.gid) && line ? "#gid=" + context.gid + "&range=A" + line : "");
    }
  }
  return {
    tab: context.tab || null,
    firstColumn: Number(context.firstColumn) || 0,
    nameColumn: context.nameColumn,
    markColumns: context.markColumns || [],
    header: context.header || [],
    rows: (context.rows || []).map((row) => ({ line: row.line, cells: hide(row.cells || []) })),
    open,
  };
};

/**
 * When a sync last ran for real. `ainar sync` notes it in the ledger since
 * 2026-10-09; before that, each road left its own trace, and the newest of
 * those is the honest answer — the last grade Canvas was sent, the last
 * assignment written, the last announcement, the sheet settings' own stamp.
 * Null is "no record of it ever running", which the view says as such.
 */
const lastSyncedOf = (sync, ledger, sheetSettings) => {
  const recorded = ledger.lastRun(sync.sync_id);
  if (recorded) return recorded;
  const key = `${sync.service}|${sync.stream}`;
  if (key === "canvas|grades") return ledger.latestSent("canvas-api|") || ledger.latestSent("canvas-csv|");
  if (key === "canvas|assignment") return ledger.latestSent("assignment|");
  if (key === "sheets|grades") return ledger.latestSent("sheets-api|") || ledger.latestSent("sheet-csv|");
  if (key === "sheets|marks") return (sheetSettings && sheetSettings.synced_at) || null;
  if (key === "telegram|announcement") return ledger.latestSent("telegram|");
  if (key === "github|repo") return ledger.latestSent("homework|");
  return null;
};

/**
 * Whether this machine can read a Google Sheet itself. The same lookup
 * `ainar` makes before a live read — environment, connections registry,
 * key files beside the roster — and no request: a credential that exists but
 * was revoked still answers yes, and the read then says why it failed.
 */
const googleReady = () => {
  try {
    loadCredentials(rosterDir());
    return true;
  } catch {
    return false;
  }
};

/**
 * Where the professor's own browser downloads the sheet as CSV, for a machine
 * with no Google login of its own.
 *
 * The session used to be asked to read the sheet "with the Google Drive
 * connector" (until 2026-10-10). A dsh session has no such connector, its
 * sandbox cannot reach Google, and the CLI has no credential, so the request
 * could only fail. The browser the pane is open in is usually signed in to the
 * Google account that owns the sheet, so Google's export link downloads
 * a private sheet with no setup at all, and the file comes back through
 * `copyFromUpload`.
 *
 * The tab is chosen by its gid, which only the sheet's URL carries. With a tab
 * named but no gid, the link downloads the first tab, and `tabHint` tells the
 * professor to download from the named tab themselves.
 */
const downloadOf = (sync) => {
  const where = sync.where || {};
  const sheet = String(where.sheet || "").trim();
  const found = /\/d\/([A-Za-z0-9_-]{10,})/.exec(sheet) || /^([A-Za-z0-9_-]{20,})$/.exec(sheet);
  if (!found) return null;
  const gid = /[#?&]gid=(\d+)/.exec(sheet);
  return {
    url:
      "https://docs.google.com/spreadsheets/d/" + found[1] + "/export?format=csv" + (gid ? "&gid=" + gid[1] : ""),
    tabHint: where.tab && !gid ? String(where.tab) : null,
  };
};

const nameOf = (people, student) => {
  const name = people && people[student] && people[student].name;
  return name ? String(name) : null;
};

/** A run's changes as the three counts a notice has room for. */
const countsOf = (changes) => {
  const counts = { added: 0, changed: 0, removed: 0 };
  for (const change of changes || []) {
    if (change.from === null && change.score_from === null) counts.added += 1;
    else if (change.to === null && change.score_to === null) counts.removed += 1;
    else counts.changed += 1;
  }
  return counts;
};

/** The last run of one sheet sync, in brief, for its card. */
const lastEventOf = (ledger, sync) => {
  const [event] = ledger.events(sync.sync_id);
  return event ? Object.assign({ at: event.at, saved: event.saved, read: event.read }, countsOf(event.changes)) : null;
};

/**
 * What the grade sheets brought into the run, newest run first: when each
 * sync ran, whether it read the sheet or a downloaded copy and when that copy
 * was saved, and every mark it added, changed or took back. Read from the
 * sync ledger on this machine — `runMarksSync` writes it after a real run.
 *
 * Names in Names mode only, as the Syncs view; codes otherwise.
 */
export const marksActivity = (workspace, runId, { names = false, limit = 12 } = {}) => {
  const { bundle } = loadedRun(workspace, runId);
  const ledger = Ledger.load(runId);
  const people = names ? rosterPeople() : null;
  const titles = new Map(assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id, entry.title || entry.assessment_id]));
  const events = [];
  for (const sync of syncsOf(bundle, runId).filter(isMarksSheet)) {
    for (const event of ledger.events(sync.sync_id)) {
      events.push(
        Object.assign({}, event, countsOf(event.changes), {
          sync: sync.sync_id,
          label: LABELS["sheets|marks"],
          changes: (event.changes || []).map((change) =>
            Object.assign({}, change, { name: nameOf(people, change.student), title: titles.get(change.assessment) || change.assessment }),
          ),
        }),
      );
    }
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { runId, names: Boolean(people), events: events.slice(0, limit) };
};

export const syncsDocument = (workspace, runId, { names = false } = {}) => {
  const { bundle } = loadedRun(workspace, runId);
  const syncs = syncsOf(bundle, runId);
  const links = LinkTable.load(runId);
  const people = names ? rosterPeople() : null;
  const csv = exportPath(runId);
  const exported = existsSync(csv) ? statSync(csv).mtime.toISOString() : null;
  const ledger = Ledger.load(runId);
  const sheetSettings = loadSheetConfig(runId);

  const rows = syncs.map((sync) => ({
    id: sync.sync_id,
    label: LABELS[`${sync.service}|${sync.stream}`] || `${sync.service} ${sync.stream}`,
    service: sync.service,
    role: sync.role,
    stream: sync.stream,
    implied: Boolean(sync.implied),
    from: sync.from || null,
    enabled: sync.enabled !== false,
    live: isLive(sync),
    needs: needs(sync),
    // Only the sheet reads from a file the professor exports; the rest speak
    // to their service directly.
    exported: isMarksSheet(sync) ? exported : null,
    hasSheet: isMarksSheet(sync) ? Boolean(sync.where && sync.where.sheet) : null,
    // Reading the sheet live needs a Google credential on this machine. Most
    // professors have none: they download it in their browser and drop the
    // file on the card, and it is kept at `exportPath`.
    canReadLive: isMarksSheet(sync) ? googleReady() : null,
    download: isMarksSheet(sync) ? downloadOf(sync) : null,
    remembered: Object.keys(links.links[sync.sync_id] || {}).length,
    waiting: links.queued(sync.sync_id).length,
    lastSynced: lastSyncedOf(sync, ledger, sheetSettings),
    lastEvent: isMarksSheet(sync) ? lastEventOf(ledger, sync) : null,
  }));

  const waiting = [];
  for (const sync of syncs) {
    for (const [key, entry] of links.queued(sync.sync_id)) {
      waiting.push({
        sync: sync.sync_id,
        source: LABELS[`${sync.service}|${sync.stream}`] || sync.sync_id,
        key,
        line: entry.line ?? null,
        preview: previewOf(entry.context, people !== null, entry.line ?? null),
        // The name as written in the sheet is a name too: shown only in Names mode.
        written: people ? entry.label : null,
        why: entry.why,
        candidates: (entry.candidates || []).map((candidate) => ({
          student: candidate.student,
          name: nameOf(people, candidate.student),
          match: candidate.match,
        })),
      });
    }
  }

  const enrolled = enrolledIn(bundle, runId)
    .map((entry) => ({ student: entry.student_id, name: nameOf(people, entry.student_id) }))
    .sort((a, b) => (a.name || a.student).localeCompare(b.name || b.student));

  return {
    runId,
    names: Boolean(people),
    syncs: rows,
    waiting,
    students: enrolled,
    assessments: assessmentsOf(bundle, runId).map((entry) => ({ id: entry.assessment_id, title: entry.title || entry.assessment_id })),
    linksPath: links.path,
  };
};

/**
 * Asked of Google at most this often per sheet, however many pane windows
 * poll: a check is two small reads, and Google's quota is per minute.
 */
const CHECK_EVERY = 2 * 60 * 1000;
const checked = new Map();

/**
 * Has each grade sheet changed since its last sync? `ainar sync check`'s
 * question (src/sync/sheet-watch.ts), asked in-process because it writes
 * nothing. Only on a machine with a Google login: without one the sheet
 * comes in as a download, and there is nothing here to ask Google with.
 * A sync that ran since the last answer makes that answer stale, so the
 * cache is keyed on the last run as well.
 */
export const sheetChecks = async (workspace, runId) => {
  const { bundle } = loadedRun(workspace, runId);
  const sheets = syncsOf(bundle, runId).filter((sync) => isMarksSheet(sync) && sync.enabled !== false && sync.where && sync.where.sheet);
  if (!sheets.length) return { runId, available: false, why: "no grade sheet", checks: [] };
  if (!googleReady()) return { runId, available: false, why: "no Google login on this computer", checks: [] };
  const ledger = Ledger.load(runId);
  const checks = [];
  for (const sync of sheets) {
    const key = runId + "|" + sync.sync_id + "|" + (ledger.lastRun(sync.sync_id) || "");
    const cached = checked.get(key);
    if (cached && Date.now() - cached.at < CHECK_EVERY) {
      checks.push(cached.answer);
      continue;
    }
    let answer;
    try {
      answer = Object.assign({ label: LABELS["sheets|marks"] }, await checkSheet({ runId, sync, rosterDirectory: rosterDir() }));
    } catch (error) {
      answer = { sync: sync.sync_id, label: LABELS["sheets|marks"], state: "error", said: String(error?.message ?? error), checked_at: new Date().toISOString() };
    }
    checked.set(key, { at: Date.now(), answer });
    checks.push(answer);
  }
  return { runId, available: true, checks };
};

const ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const CODE = /^STUDENT-[A-Z0-9]+$/;

/**
 * One press: plan, run, confirm, migrate. Every one is `ainar sync …`.
 *
 * `run` on a live sync without `confirm` is refused here as well as in the
 * CLI, for the marks push's reason: the press that changes what students see
 * is never the one that meant "preview".
 */
export const runSyncAction = async (workspace, root, runId, body) => {
  const action = String(body.action || "");
  if (action === "migrate") return runScans(["sync", "migrate", runId], root);

  const syncId = String(body.sync || "");
  const { bundle } = loadedRun(workspace, runId);
  const sync = syncsOf(bundle, runId).find((entry) => entry.sync_id === syncId);
  if (!sync) return { error: `${runId} has no sync '${syncId}'.` };

  if (action === "confirm") {
    const args = ["sync", "confirm", runId, syncId];
    if (Number.isInteger(body.line)) args.push("--line", String(body.line));
    else if (typeof body.key === "string" && body.key.startsWith("name:")) {
      // A row with no line number is confirmed by the name it was queued under.
      const queued = LinkTable.load(runId).queued(syncId).find(([key]) => key === body.key);
      if (!queued) return { error: "That row is no longer waiting." };
      args.push("--name", queued[1].label);
    } else return { error: "No row chosen." };
    if (body.to) {
      if (!CODE.test(String(body.to))) return { error: `${body.to} is not a student.` };
      args.push("--to", String(body.to));
    }
    return runScans(args, root);
  }

  if (action !== "plan" && action !== "run") return { error: `${action} is not something this can do.` };
  const confirm = body.confirm === true;
  if (action === "run" && isLive(sync) && !confirm) {
    return { error: "This one changes what other people see. Preview it first, then send." };
  }

  const args = ["sync", action, runId, syncId];
  if (needs(sync) === "assessment") {
    const assessment = String(body.assessment || "");
    if (!ID.test(assessment) || !assessmentsOf(bundle, runId).some((entry) => entry.assessment_id === assessment)) {
      return { error: "Choose an assessment first." };
    }
    // A repository is published per assessment, named as the one positional.
    if (sync.stream === "repo") args.push(assessment);
    else args.push("--assessment", assessment);
  }
  if (needs(sync) === "message") return { error: "Announcements are written and sent from Publish." };
  if (isMarksSheet(sync) && body.from === "export") {
    const csv = exportPath(runId);
    if (!existsSync(csv)) return { error: "There is no downloaded copy of the sheet yet. " + HOW_TO_DOWNLOAD };
    args.push("--from", csv);
  } else if (isMarksSheet(sync) && !googleReady()) {
    return { error: NO_LOGIN + " " + HOW_TO_DOWNLOAD };
  }
  if (action === "run" && confirm) args.push("--confirm");
  // Names by default, as the CLI prints them; codes when the pane shows pseudonyms.
  if (isMarksSheet(sync) && body.names === false) args.push("--codes");
  return runScans(args, root);
};

const NO_LOGIN = "This computer has no Google login of its own, so it cannot open the sheet directly.";
const HOW_TO_DOWNLOAD =
  'Press "Download from Google" (or in the sheet: File → Download → Comma-separated values), ' +
  "then drop the downloaded file on this card.";

/** A grade sheet is a few kilobytes; this is room for a very large class. */
export const UPLOAD_LIMIT = 4 * 1024 * 1024;

/**
 * A sheet the professor downloaded, dropped on the card: checked by the same
 * `sync plan` that will read it, and only then kept as the run's copy.
 *
 * It goes to a file beside the copy first, and the plan reads that file. A file
 * the plan cannot read (the wrong tab, an Excel file, Google's sign-in page
 * saved as .csv) is deleted and the plan's own words are returned, so the copy
 * that worked before is still there. A file it can read replaces the copy, and
 * the plan's output is the preview, so the professor sees what a Run would
 * change without pressing anything else.
 */
export const copyFromUpload = async (workspace, root, runId, body, { keep = true } = {}) => {
  const syncId = String(body.sync || "");
  const { bundle } = loadedRun(workspace, runId);
  const sync = syncsOf(bundle, runId).find((entry) => entry.sync_id === syncId);
  if (!sync) return { error: `${runId} has no sync '${syncId}'.` };
  if (!isMarksSheet(sync)) return { error: "Only a grade sheet you keep is read from a downloaded file." };

  const text = String(body.csv ?? "").replace(/^﻿/, "");
  if (!text.trim()) return { error: "That file is empty." };
  if (/^\s*</.test(text)) {
    return {
      error:
        "That file is a web page, not the sheet. Google usually sends one when the browser is not signed in to " +
        "the account the sheet belongs to. Sign in, then download it again.",
    };
  }
  if (text.startsWith("PK")) {
    return { error: "That is an Excel file. In Google Sheets choose File → Download → Comma-separated values (.csv)." };
  }

  const csv = exportPath(runId);
  mkdirSync(dirname(csv), { recursive: true });
  const incoming = csv.replace(/\.csv$/i, "") + ".incoming.csv";
  writeFileSync(incoming, text, "utf8");
  const args = ["sync", "plan", runId, syncId, "--from", incoming];
  if (body.names === false) args.push("--codes");
  const answer = await runScans(args, root);
  // `keep: false` checks the file and throws it away: the test page's mode.
  if (!answer.ok || !keep) {
    rmSync(incoming, { force: true });
    if (answer.ok) return answer;
    return Object.assign({}, answer, {
      error: "The downloaded file could not be read as this sheet, so the copy you had is kept.\n\n" + (answer.output || ""),
    });
  }
  renameSync(incoming, csv);
  // The copy dates from when the browser saved the download, not from the
  // drop: that is how old the sheet it holds is, and what a sync records.
  const saved = Number(body.lastModified);
  if (Number.isFinite(saved) && saved > Date.UTC(2000, 0, 1) && saved <= Date.now() + 60000) {
    const at = new Date(saved);
    try {
      utimesSync(csv, at, at);
    } catch {
      // The drop time stands; a sync still records it.
    }
  }
  return Object.assign({}, answer, { kept: csv });
};
