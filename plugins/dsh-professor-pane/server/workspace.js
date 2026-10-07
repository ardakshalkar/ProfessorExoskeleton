/**
 * Which workspace a request is about, and the reads every view starts from:
 * the cached course store, a tool's payload, the run list, the revision the
 * pane's refresh poll compares, and the roster the class list is named from.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { approvedView } from "@ainar/core/src/approval.ts";
import { runById } from "@ainar/core/src/bundle.ts";
import { gradebookPayload } from "@ainar/core/src/gradebook.ts";
import { inboxPayload } from "@ainar/core/src/inbox.ts";
import { outlinePayload } from "@ainar/core/src/outline.ts";
import { dashboardPayload } from "@ainar/core/src/progress.ts";
import { YamlCourseStore } from "@ainar/core/src/store/course.ts";
import { callTool } from "@ainar/core/src/tools/index.ts";
import {
  referenceDate,
  ToolError,
  Workspace,
  workspaceRootFor,
} from "@ainar/core/src/workspace.ts";

/**
 * The views a widget document answers, keyed by the path segment.
 *
 * Not the tab list — `client/tabs.js` owns that, and most tabs are no longer in
 * here. Each entry names a tool in `dsh-ainar-course-model`'s manifest, which
 * is keyed by tool. Everything else the pane draws has no widget behind it:
 * the class list, the Checklist, the assessment, slide and exam tables and the
 * grading policy are assembled in this file, while Preferences and
 * Integrations are drawn by the browser half from `/api/preferences` and
 * `/api/integrations` — those two have forms, and a form cannot live in the
 * sandboxed frame the served documents go into.
 */
export const VIEWS = {
  outline: { tool: "course_outline" },
  progress: { tool: "class_progress" },
  gradebook: { tool: "gradebook" },
  tasks: { tool: "action_inbox" },
};

/**
 * One `YamlCourseStore` per workspace root, kept for the life of the process.
 *
 * The store is where the course model's parse cache lives: it stamps each
 * loaded course with the newest mtime under its directory and re-reads only
 * when that moves. `Workspace`'s own header says why — a course takes about a
 * second to parse, and nothing on these routes writes.
 *
 * That cache was doing nothing here. `resolveWorkspace` built a
 * `new Workspace(root)` per request, which built a new store, which started
 * with an empty map — so every view re-parsed every course from disk, and a
 * single render of the Course outline tab paid for it more than once, because
 * `gradingDocument` and friends ask for a payload AND call `findRun`.
 *
 * Caching the STORE rather than the `Workspace` is what keeps `origin`
 * honest: it is only ever used to word the advice in a "no workspace" error,
 * and that advice differs by how the root was arrived at. A `Workspace` is a
 * few fields around a store, so building a fresh one per request costs nothing
 * and lets a session-resolved request and an `AINAR_WORKSPACE` one share the
 * parse while still naming the right thing to fix.
 *
 * Invalidation is entirely the store's, so an agent's write, a roster import
 * or a hand-edited YAML is picked up on the next request exactly as before —
 * this changes what is thrown away between requests, not when a re-read
 * happens.
 *
 * Unbounded, deliberately: the key is a workspace root the professor opened in
 * the sidebar, so the map holds one entry per folder they have looked at this
 * session — units, not thousands — and evicting one would only throw away a
 * parse we would immediately redo.
 */
const STORES = new Map();

const storeFor = (root) => {
  const found = STORES.get(root);
  if (found) return found;
  const made = new YamlCourseStore(root);
  STORES.set(root, made);
  return made;
};

/**
 * The workspace one request is about, resolved per request rather than at load.
 *
 * The order `ainar/commands/common.py` argues for, with the session standing in
 * for the professor's working directory:
 *
 *   1. the workspace the session is in — what the sidebar says
 *   2. AINAR_WORKSPACE — for a request with no usable session
 *
 * `sessionId` is turned into a path by the workspace registry, never by the
 * caller. An id dsh does not account for resolves to nothing and falls through
 * to the variable, which is the same answer as sending no id at all.
 *
 * Per request, because a professor may switch workspaces in the sidebar, or
 * export the variable, without restarting the harness.
 */
export const resolveWorkspace = (registry, sessionId) => {
  if (sessionId) {
    for (const workspace of registry.list()) {
      if (!workspace.sessionIds.includes(sessionId)) continue;
      const standing = workspaceRootFor(workspace.path);
      if (standing) return { workspace: new Workspace(storeFor(standing), "session"), root: standing };
      // A registered workspace that holds no courses/ is a real answer: the
      // professor opened a folder that is not a course workspace. Say so rather
      // than quietly reporting on whatever AINAR_WORKSPACE names.
      throw new ToolError(
        `${workspace.path} is open as a workspace but holds no courses/ directory, ` +
          "and neither does anything above it. Open the folder that contains " +
          "courses/ — not a course, and not unmodelled material.",
      );
    }
  }
  const value = (process.env.AINAR_WORKSPACE ?? "").trim();
  if (!value) {
    throw new ToolError(
      "No course workspace. This session is not standing in a folder that holds a " +
        "courses/ directory, and AINAR_WORKSPACE is not set. Either open the course " +
        "folder as a workspace, or set the variable to the folder that contains your " +
        "courses/ directory.",
    );
  }
  const fallback = workspaceRootFor(value);
  if (!fallback) {
    throw new ToolError(
      `AINAR_WORKSPACE points at ${value}, which is not a directory holding courses/ ` +
        "— and neither is anything above it.",
    );
  }
  return { workspace: new Workspace(storeFor(fallback), "env"), root: fallback };
};

/**
 * A tool payload, or a thrown `ToolError` carrying the tool's own words.
 *
 * `callTool` reports a failure in-band — `{ isError: true, content: [...] }` —
 * rather than by throwing, and the text in there is the one worth showing: "no
 * course run 'X' in this workspace" is the answer to the professor's question,
 * and replacing it with a status code would be throwing the answer away.
 */
export const payload = (workspace, tool, args) => {
  const result = callTool(workspace, tool, args);
  if (result && result.isError) {
    const text = (result.content ?? [])
      .map((part) => (part && part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
    throw new ToolError(text || `${tool} failed and said nothing about why.`);
  }
  return result.structuredContent ?? result;
};

/**
 * The four payloads, over the whole course or over what has been accepted.
 *
 * Since 2026-09-29 a draft is not a file somewhere else: an agent writes into
 * the course and marks the record `approval: draft` (a grade: `status:
 * suggested`). So the two halves the pane has always shown are one bundle,
 * read two ways — `withDrafts` is the course as it stands, drafts and all, and
 * without it the view is `approvedView`, what a student may be shown and what
 * an LMS may be given. The pane says which one is on screen, above the frame,
 * because the widget documents are shared with two other hosts and know
 * nothing about drafts.
 *
 * `issues` is kept, empty, for the callers that still read it: there is no
 * draft directory to fail to load any more.
 */
export const viewPayload = (workspace, tool, runId, on, withDrafts) => {
  let bundle = null;
  for (const courseId of workspace.courseIds()) {
    try {
      const loaded = workspace.load(courseId);
      if (runById(loaded.bundle).has(runId)) {
        bundle = loaded.bundle;
        break;
      }
    } catch {
      // A course that will not load cannot be the one owning this run, and
      // saying so here would replace the run's own error with an unrelated
      // course's. `findRun` skips the same way.
      continue;
    }
  }
  if (bundle === null) throw new ToolError(`no course run '${runId}' in this workspace`);

  const shown = withDrafts ? bundle : approvedView(bundle);
  const date = referenceDate(shown, runId, on);
  switch (tool) {
    case "course_outline":
      return { payload: outlinePayload(shown, runId, date), issues: [] };
    case "class_progress":
      return { payload: dashboardPayload(shown, runId), issues: [] };
    case "gradebook":
      return { payload: gradebookPayload(shown, runId, {}), issues: [] };
    case "action_inbox":
      return { payload: inboxPayload(shown, runId, date), issues: [] };
    default:
      throw new ToolError(`${tool} has no view over the accepted record`);
  }
};

/**
 * Where each dateless assessment actually lives, found rather than assumed.
 *
 * The button that asks the professor for a missing deadline tells the model
 * which record to edit, and the first version of that prompt guessed the file:
 * `assessments/generated.yaml`, because that is where
 * `approve` writes. It is a guess. `RECORD_GLOBS.assessments` accepts
 * `assessments.yaml` as well as `assessments/*.yaml`,
 * so a hand-authored assessment, or one an older import placed, sits somewhere
 * else — and a prompt naming the wrong file is worse than one naming none,
 * because the model will helpfully edit or create it.
 *
 * So the identifier is looked up. Every YAML the loader would read for this run
 * is scanned for the id as a `assessment_id:` value, and the first file holding
 * it wins. Nothing found means the field stays absent and the widget falls back
 * to naming the directory, which is true whatever the filename.
 *
 * The scan is bounded by the run's own assessment files — a handful, read once
 * per outline request — and it only runs when there is a dateless assessment to
 * ask about, which is nearly never.
 */
export const withRecordPaths = (data, root, courseId, term, entries) => {
  if (data === null || typeof data !== "object") return data;
  const wanted = new Set();
  for (const entry of entries) {
    if (entry?.assessment_id) wanted.add(entry.assessment_id);
  }
  if (!wanted.size) return data;

  const base = join(root, "courses", courseId);
  const candidates = [join(base, "assessments.yaml")];
  try {
    for (const name of readdirSync(join(base, "assessments"))) {
      if (/\.ya?ml$/i.test(name)) candidates.push(join(base, "assessments", name));
    }
  } catch {
    // No assessments/ directory: the single-file layout, already in the list.
  }

  const found = new Map();
  for (const path of candidates) {
    let text;
    try {
      text = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    for (const id of wanted) {
      if (found.has(id)) continue;
      // As a value of the key, not merely somewhere in the file: an id can
      // appear in a description or a rubric criterion without the record
      // living here.
      if (new RegExp(`^\\s*-?\\s*assessment_id:\\s*${id}\\s*$`, "m").test(text)) {
        found.set(id, relative(root, path).split(sep).join("/"));
      }
    }
  }
  if (!found.size) return data;

  for (const entry of entries) {
    const path = found.get(entry?.assessment_id);
    if (path) entry.source_file = path;
  }
  return data;
};

/**
 * A fingerprint of the course model on disk, for the pane to poll.
 *
 * The pane used to redraw only when the professor changed something through it
 * — a run, a tab, an approval. Everything else that writes to the workspace
 * left it showing yesterday: an agent setting a due date, a draft accepted in
 * an editor, a file edited by hand. The professor then read a stale
 * page with no way to tell it was stale, which is the failure this pane exists
 * to avoid everywhere else.
 *
 * Name, size and mtime of every YAML under `courses/`, hashed. Not
 * the contents: this runs every few seconds and the point is to be cheap. The
 * cost of hashing metadata instead is one real case — a write that changes
 * neither size nor mtime, which on a filesystem with millisecond timestamps
 * means a same-millisecond same-length rewrite. That is a missed refresh, not
 * a wrong page, and the professor still has the pane's own reload.
 *
 * Entries are sorted, so two machines walking the same tree agree, and the
 * revision does not flicker because a directory listing came back in a
 * different order.
 */
const walkRevision = (root) => {
  const hash = createHash("sha256");
  let files = 0;

  const walk = (directory, depth) => {
    // Deep enough for <collection>/<file>.yaml with room to
    // spare, shallow enough that a symlink loop cannot spin here forever.
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith(".")) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!/\.ya?ml$/i.test(entry.name)) continue;
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      hash.update(full);
      hash.update(String(stats.mtimeMs));
      hash.update(String(stats.size));
      files += 1;
    }
  };

  walk(join(root, "courses"), 0);
  // Defence questions are drafted into `output/<RUN>/defence/` rather than the
  // course (see src/defence.ts), and the class list draws them, so their
  // arrival has to redraw it like any record would. Only that folder: the rest
  // of `output/` is render scratch and would redraw the pane mid-render.
  let runs = [];
  try {
    runs = readdirSync(join(root, "output"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    runs = [];
  }
  for (const run of runs.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    walk(join(root, "output", run.name, "defence"), 5);
  }
  return { revision: hash.digest("hex").slice(0, 16), files };
};

/**
 * The same answer, computed at most once per `REVISION_TTL_MS` per root.
 *
 * The walk is cheap but not free, and it now has two callers rather than one:
 * `/api/revision`, which the pane polls every 2500ms, and every view that
 * caches a computed report against the revision as its key. Without this, one
 * poll landing beside one frame reload walks the tree twice for an answer that
 * cannot have changed between them.
 *
 * The window is a second, well under the poll interval, so the poll still gets
 * a fresh walk every time it asks — this collapses only the burst that a single
 * redraw causes, and the most a change can sit unnoticed is a second longer
 * than it already could.
 */
const REVISION_TTL_MS = 1000;
const REVISIONS = new Map();

export const revisionDocument = (root) => {
  const now = Date.now();
  const found = REVISIONS.get(root);
  if (found && now - found.at < REVISION_TTL_MS) return found.value;
  const value = walkRevision(root);
  REVISIONS.set(root, { at: now, value });
  return value;
};

/**
 * Every course and run this workspace holds, for the run picker.
 *
 * `list_courses` is the only tool that answers without being told a run, which
 * makes it the one the pane has to start from. A course whose runs come back
 * empty is passed through as it is: the pane says the course has no offering
 * the loader can read rather than picking a run that is not there. That is not
 * a hypothetical — a workspace still on the superseded `runs/` + `versions/v1`
 * layout reads exactly that way, and a pane that guessed would draw a term plan
 * for an offering the model does not have.
 */
export const runsDocument = (workspace, root) => {
  const listed = payload(workspace, "list_courses", {});

  /**
   * The instructors of one run, which `list_courses` does not carry.
   *
   * Read from the bundle instead, per course. `Workspace.load` caches and
   * re-reads only when the files move, so this costs a map lookup on every call
   * after the first — and a course that will not load returns nothing rather
   * than throwing, because the run picker must still list the courses whose
   * offerings are broken.
   */
  const instructorsOf = (courseId, runId) => {
    try {
      const loaded = workspace.load(courseId);
      if (loaded.bundle === null) return [];
      const run = runById(loaded.bundle).get(runId);
      return Array.isArray(run?.instructors) ? run.instructors : [];
    } catch {
      return [];
    }
  };

  return {
    workspace: root,
    courses: (listed.courses ?? []).map((course) => ({
      course_id: course.course_id,
      title: course.title,
      errors: course.errors,
      warnings: course.warnings,
      // `course_version_id` is what the node port calls the offering, because
      // the model merged version and run into one record and its identifier
      // carries the term. `run_id` is the older spelling and the Python MCP
      // server still answers with it, so both are accepted here: whichever
      // engine is behind `callTool` on a given machine, the pane gets an id.
      runs: (course.runs ?? [])
        .map((run) => ({
          run_id: run.course_version_id ?? run.run_id ?? null,
          term: run.term ?? null,
          start_date: run.start_date ?? null,
          end_date: run.end_date ?? null,
          // Who may decide. A grade's decision records WHO made it
          // (`decided_by`), so the pane offers the run's own instructors
          // rather than a box for the professor to retype their id into. A
          // list rather than a name, because a co-taught run has several and
          // the pane must not pick one of them on their behalf.
          instructors: instructorsOf(
            course.course_id,
            run.course_version_id ?? run.run_id ?? "",
          ),
        }))
        .filter((run) => run.run_id !== null),
    })),
  };
};

/**
 * The bundle owning a run, WITH the complaints its load produced.
 *
 * `workspace.findRun` hands back the bundle alone, which is all the widget
 * views need. The class list needs the complaints too: whether enrollments are
 * absent, refused or synthetic is the difference between three very different
 * sentences, and the loader says which in an issue rather than in the data.
 */
export const loadedRun = (workspace, runId) => {
  for (const courseId of workspace.courseIds()) {
    try {
      const loaded = workspace.load(courseId);
      if (runById(loaded.bundle).has(runId)) return loaded;
    } catch {
      // A course that will not load cannot be the one owning this run, and its
      // error would replace the run's own. `viewPayload` skips the same way.
      continue;
    }
  }
  throw new ToolError(`no course run '${runId}' in this workspace`);
};

/**
 * Where the private roster lives, by the same rule `roster.ts` applies.
 *
 * Duplicated rather than imported because `dsh-ainar-course-model` has no
 * roster module and should not gain one: everything in that package is loaded
 * by MCP tools whose output goes to a model, and a reader for the identity
 * store is the one thing that must never be reachable from there. This copy is
 * a dozen lines and is read-only.
 *
 * Split in two because the directory itself is now wanted separately:
 * `lms.toml` sits beside `people.json`, and the Integrations tab reads it. One
 * expansion of `~` and of `AINAR_ROSTER_DIR`, in one place, so the two files
 * can never be looked for in different directories.
 */
export const rosterDir = () => {
  const configured = (process.env.AINAR_ROSTER_DIR || "").trim();
  return configured
    ? resolve(configured.startsWith("~") ? join(homedir(), configured.slice(1)) : configured)
    : join(homedir(), ".ainar", "roster");
};

export const rosterPath = () => join(rosterDir(), "people.json");

/**
 * The identity map, read fresh, held only for the length of one response.
 *
 * Returns `null` when there is no store to read — which is not an error. A
 * professor who has never run `ainar roster import` has no names to show, and
 * the view says so rather than drawing an empty column.
 */
export const rosterPeople = () => {
  const path = rosterPath();
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return null;
    const payload = JSON.parse(readFileSync(path, "utf-8"));
    const people = payload && payload.people;
    return people && typeof people === "object" ? people : null;
  } catch {
    // A store that will not parse is a store that cannot name anybody. The
    // caller falls back to pseudonyms, which is always a correct answer.
    return null;
  }
};

/**
 * The inbox payload, with the students on it named.
 *
 * The one place this pane puts a real name into a WIDGET document, and the
 * reasoning is the same as the class list's: the resolution happens here, from
 * a file on the professor's own machine, and the document is served over
 * loopback to their own browser. Nothing is written, the MCP tool's payload is
 * untouched, and a chat client asking `action_inbox` gets what it always got.
 *
 * Only the pseudonyms already on the page are looked up. A run of two hundred
 * with three missing submissions puts three names in the document, not two
 * hundred — the map is what the view needs to draw, not a copy of the roster.
 *
 * No roster, or no name for an id, and the id stays as it is. `who()` in the
 * widget falls back to the pseudonym, which is a correct answer everywhere.
 */
export const withStudentNames = (data) => {
  const people = rosterPeople();
  if (people === null) return data;

  const wanted = new Set();
  for (const row of data.assessments ?? []) {
    for (const id of row.missing ?? []) wanted.add(id);
  }
  for (const list of [data.open_signals, data.interventions_awaiting_approval]) {
    for (const row of list ?? []) if (row.student_id) wanted.add(row.student_id);
  }

  const named = {};
  for (const id of wanted) {
    const name = people[id] && typeof people[id].name === "string" ? people[id].name.trim() : "";
    if (name) named[id] = name;
  }
  return Object.keys(named).length === 0 ? data : { ...data, people: named };
};
