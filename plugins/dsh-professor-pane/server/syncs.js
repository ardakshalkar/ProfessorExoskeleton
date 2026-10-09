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

import { existsSync, statSync } from "node:fs";

import { assessmentsOf, enrolledIn } from "@ainar/core/src/bundle.ts";
import { exportPath } from "@ainar/core/src/grade-sheet.ts";
import { LinkTable } from "@ainar/core/src/sync/links.ts";
import { syncsOf } from "@ainar/core/src/sync/registry.ts";

import { runScans } from "./actions.js";
import { loadedRun, rosterPeople } from "./workspace.js";

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

const nameOf = (people, student) => {
  const name = people && people[student] && people[student].name;
  return name ? String(name) : null;
};

export const syncsDocument = (workspace, runId, { names = false } = {}) => {
  const { bundle } = loadedRun(workspace, runId);
  const syncs = syncsOf(bundle, runId);
  const links = LinkTable.load(runId);
  const people = names ? rosterPeople() : null;
  const csv = exportPath(runId);
  const exported = existsSync(csv) ? statSync(csv).mtime.toISOString() : null;

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
    remembered: Object.keys(links.links[sync.sync_id] || {}).length,
    waiting: links.queued(sync.sync_id).length,
  }));

  const waiting = [];
  for (const sync of syncs) {
    for (const [key, entry] of links.queued(sync.sync_id)) {
      waiting.push({
        sync: sync.sync_id,
        key,
        line: entry.line ?? null,
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
    if (!existsSync(csv)) return { error: `There is no exported sheet at ${csv}.` };
    args.push("--from", csv);
  }
  if (action === "run" && confirm) args.push("--confirm");
  return runScans(args, root);
};
