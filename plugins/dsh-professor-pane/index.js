/**
 * The host half of the professor's visualization pane.
 *
 * It registers one prefix route and nothing else. Everything the pane draws
 * comes back through `/professor-pane/...`, and nearly everything behind that
 * route is a read: `callTool` from `dsh-ainar-course-model`, which is read-only
 * by construction, plus the preference and record files, read with
 * `readFileSync`.
 *
 * Four exceptions, and each one's own header argues for itself:
 *
 * * `/api/approve` spawns this checkout's `ainar approve` rather than
 *   reimplementing the approval gate. The gate stays where `AGENTS.md` puts it.
 * * `/api/preferences` writes a preference layer. A preference is how the
 *   professor wants the skills to behave, not a claim about a student, so there
 *   is nothing in it for `approve` to gate.
 * * `/api/canvas/selection` writes `extensions.lms.canvas_sections` on the run
 *   record — which Canvas section feeds which subgroup. A fact about the
 *   professor's own LMS that no skill drafts and no agent can propose, and
 *   therefore one with no drafted half for `approve` to promote.
 * * `/api/canvas/catalogue` is the only outbound request in this plugin: two
 *   read-only Canvas endpoints, POST so that no link, prefetch or refresh can
 *   spend the professor's token.
 *
 * What is still true, and is the line worth keeping: **nothing here can approve
 * a judgement about a student, and nothing here can push a grade.** A pane that
 * could approve one would be a second approval path, and `AGENTS.md` says there
 * is one and the professor runs it.
 *
 * Why HTTP rather than a service the browser half calls: four of the views this
 * pane switches between are already written. `dsh-ainar-course-model` ships
 * four widget documents — `course-outline`, `class-progress`, `gradebook`,
 * `action-inbox` — assembled from `widget-assets/`, and DSH renders none of
 * them, because `presentationMeta` is the MCP-app contract and DSH has no
 * renderer for it. They are, in that plugin's own words, "inert, not broken".
 * Serving each one as a document at a URL and pointing an iframe at it makes
 * them live again without a second copy of four hundred lines of view code
 * that a professor would eventually see disagree with itself.
 */

// `execFile` is here for one route only — `/api/approve`, which spawns this
// checkout's TypeScript `ainar` rather than reimplementing the approval gate.
// See `runApprove`. Nothing else in this file starts a process.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assessmentsOf,
  enrollmentsOf,
  groupsOf,
  requireGroups,
  runById,
} from "@ainar/core/src/bundle.ts";
import { loadDrafts, mergeDrafts } from "@ainar/core/src/drafts.ts";
import { gradebookPayload } from "@ainar/core/src/gradebook.ts";
import { inboxPayload } from "@ainar/core/src/inbox.ts";
import { IssueList } from "@ainar/core/src/issues.ts";
import { YamlCourseStore } from "@ainar/core/src/mcp/course-store.ts";
import { callTool } from "@ainar/core/src/mcp/tools.ts";
import { BY_TOOL } from "@ainar/core/src/mcp/widgets.ts";
import {
  ToolError,
  Workspace,
  referenceDate,
  workspaceRootFor,
} from "@ainar/core/src/mcp/workspace.ts";
import { writeAssessmentLinks } from "@ainar/core/src/lms/link.ts";
import { outlinePayload } from "@ainar/core/src/outline.ts";
import { dump as dumpYaml } from "@ainar/core/src/yaml-out.ts";
import { dashboardPayload } from "@ainar/core/src/progress.ts";
// `parseDocument` alongside `parse`, for one caller: `writeCanvasSelection`
// edits a file a professor also writes by hand, and the plain parse would hand
// back a JS object with every comment in `version.yaml` already discarded.
import { parse as parseYaml, parseDocument as parseYamlDocument } from "yaml";

// The pane's own text layer: HTML escaping, and the markdown renderer `/file`
// serves a brief and a deck through. Separate from this file because it is the
// only part of the server half a test can call with no workspace and no
// harness — see `test/pane-markdown.test.mjs`.
import { MARKDOWN_STYLE, escapeText, renderMarkdown } from "./lib/markdown.js";

export const name = "professor-pane";

/**
 * The route registry, and the workspace registry.
 *
 * `workspaceRegistry` is how a request naming a session turns into a directory
 * on disk WITHOUT a path ever crossing from the browser: the pane sends the
 * session id it already has, and this side asks dsh which workspace accounts
 * for it. A `workspace=<path>` parameter would have been fewer lines and a
 * standing invitation to read any directory on the machine by crafting one
 * request — the routes here open YAML and print it, so the parameter would be
 * the read primitive. A session id resolves only to a folder the professor
 * registered in the sidebar, and to nothing else.
 */
export const inject = ["webServer", "workspaceRegistry"];

/** Where every route in this file lives. Keep it in step with `lib/client.js`. */
const BASE = "/professor-pane";

/**
 * The vendored DataLayer defaults, found relative to this file.
 *
 * Deliberately not `process.cwd()`: dsh's working directory is whatever
 * folder the professor opened as a workspace, and the system preference layer
 * lives in this checkout beside the plugin. Resolving from `import.meta.url`
 * means the path is right whether the harness was started from the repo, from
 * a course folder, or from anywhere else.
 */
const DEFAULTS_YAML = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "datalayer",
  "preferences",
  "defaults.yaml",
);

/**
 * The views a widget document answers, keyed by the path segment.
 *
 * Not the tab list — `lib/client.js` owns that, and most tabs are no longer in
 * here. Each entry names a tool in `dsh-ainar-course-model`'s manifest, which
 * is keyed by tool. Everything else the pane draws has no widget behind it:
 * the class list, the Checklist, the assessment, slide and exam tables and the
 * grading policy are assembled in this file, while Preferences and
 * Integrations are drawn by the browser half from `/api/preferences` and
 * `/api/integrations` — those two have forms, and a form cannot live in the
 * sandboxed frame the served documents go into.
 */
const VIEWS = {
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
 * Invalidation is entirely the store's, so an `ainar approve`, a roster import
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
const resolveWorkspace = (registry, sessionId) => {
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
const payload = (workspace, tool, args) => {
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
 * The same four payloads, computed over the record with `work/<RUN>/` merged in.
 *
 * Why this exists, and why it is not the default: the professor's own course
 * lives in two halves. `courses/` is the record — what a person or `ainar
 * approve` wrote — and `work/<RUN>/` is what the skills proposed and nobody has
 * accepted. Both halves are real, and a pane that showed only the first would
 * report a course as nearly empty while fifteen weeks of it sat one directory
 * away. `work/CSS-4007-2026-FALL/course-outline-viewer.py` already draws both,
 * for exactly this reason, and marks the drafted half as drafted.
 *
 * `loadDrafts` and `mergeDrafts` are the course model's own, the pair behind
 * `ainar validate <COURSE> --drafts work/<RUN>`, so what gets merged here is
 * what that command validates: `DRAFTABLE` refuses outcomes, capabilities and
 * enrollments in a draft file, and this inherits that refusal rather than
 * restating it.
 *
 * It is opt-in per request because the two answers mean different things. The
 * record is what a student may be shown and what an LMS may be given; the merge
 * is what the term would look like if every proposal were accepted. The pane
 * says which one is on screen, above the frame — not inside it, because the
 * widget documents are shared with two other hosts and know nothing about
 * drafts.
 *
 * What it cannot rescue: `versions` is not draftable. An offering with no
 * `start_date` does not load at all, so there is no run for a merged module to
 * be placed in and this returns the loader's error like any other.
 */
const draftedPayload = (workspace, root, tool, runId, on) => {
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

  const issues = new IssueList();
  const merged = mergeDrafts(bundle, loadDrafts(join(root, "work", runId), issues));
  const date = referenceDate(merged, runId, on);
  switch (tool) {
    case "course_outline":
      return { payload: outlinePayload(merged, runId, date), issues: issues.items };
    case "class_progress":
      return { payload: dashboardPayload(merged, runId), issues: issues.items };
    case "gradebook":
      return { payload: gradebookPayload(merged, runId, {}), issues: issues.items };
    case "action_inbox":
      return { payload: inboxPayload(merged, runId, date), issues: issues.items };
    default:
      throw new ToolError(`${tool} has no drafted form`);
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
const withRecordPaths = (data, root, courseId, term, entries) => {
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
 * left it showing yesterday: an agent setting a due date, `bin/ainar approve`
 * run in a terminal, a file edited by hand. The professor then read a stale
 * page with no way to tell it was stale, which is the failure this pane exists
 * to avoid everywhere else.
 *
 * Name, size and mtime of every YAML under `courses/` and `work/`, hashed. Not
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

  for (const top of ["courses", "work"]) walk(join(root, top), 0);
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

const revisionDocument = (root) => {
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
const runsDocument = (workspace, root) => {
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
          // Who may approve. `ainar approve --as` records WHO accepted the
          // drafts, so the pane needs a candidate to offer rather than a box
          // for the professor to retype their own id into. The run's own
          // instructor list is that candidate, and it is a list rather than a
          // name because a co-taught run has several and the pane must not
          // pick one of them on their behalf.
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
 * The preference layers, each read where it lives and none of them merged.
 *
 * DataLayer resolves four layers, each beating the one before it, and the
 * useful thing to show a professor is not the winner — it is which file said
 * it. So this returns the layers in resolution order with their own values, and
 * the browser half does the last step in front of them: a value's row names the
 * layer it came from. A merged blob would print a number with no author.
 *
 * The task layer — flags on the invoking command — is not a file and cannot be
 * read here, so it is absent rather than empty.
 */
/**
 * Every option a professor may set, and what a control for it should be.
 *
 * Derived from `defaults.yaml` rather than declared here, because that file is
 * already the list of what DataLayer reads. A second copy would be a list of
 * what the pane BELIEVES DataLayer reads, and the first setting either one grew
 * without the other would be a control writing a key nothing consults.
 *
 * The choices come out of the file's own trailing comments — `style: lecture
 * # lecture | seminar | workshop`. That comment is not decoration; it is the
 * only place the alternatives are written down, and reading it is cheaper and
 * truer than restating them here. A key whose comment says something else, or
 * nothing at all, gets a plain field.
 *
 * A key appearing twice under different groups with DIFFERENT choices is
 * dropped from the option table rather than guessed at: the comment is matched
 * on the key alone, and two answers mean the match is not a match.
 */
const OPTION_COMMENT = /^\s*([A-Za-z0-9_]+):\s*[^#\s][^#]*#\s*([^|#]+(?:\|[^|#]+)+?)\s*$/;

const preferenceSchema = () => {
  let text;
  let parsed;
  try {
    text = readFileSync(DEFAULTS_YAML, "utf8");
    parsed = parseYaml(text) ?? {};
  } catch {
    // No defaults file, so nothing is known to be settable. The view reports
    // the system layer absent for the same reason and by the same route.
    return [];
  }

  const choices = new Map();
  const ambiguous = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = OPTION_COMMENT.exec(line);
    if (!match) continue;
    const words = match[2].split("|").map((word) => word.trim()).filter(Boolean);
    const seen = choices.get(match[1]);
    if (seen && seen.join("|") !== words.join("|")) ambiguous.add(match[1]);
    choices.set(match[1], words);
  }

  const fields = [];
  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node ?? {})) {
      const here = [...path, key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        walk(value, here);
        continue;
      }
      const options = ambiguous.has(key) ? null : choices.get(key) ?? null;
      fields.push({
        path: here.join("."),
        group: path.join(".") || "general",
        label: key.replace(/_/g, " "),
        type: options
          ? "enum"
          : typeof value === "boolean"
            ? "boolean"
            : typeof value === "number"
              ? "number"
              : "text",
        options,
        // `2.5` must not come back as `2` when a professor rounds it: PyYAML
        // writes a float differently from an integer, and `yaml-out` takes
        // float-ness from the caller because JavaScript has one number type.
        float: typeof value === "number" && !Number.isInteger(value),
        fallback: value,
      });
    }
  };
  walk(parsed.values ?? {}, []);
  return fields;
};

/**
 * The layers and where each one lives, named once.
 *
 * Read and write both need this list and must not disagree about it: a Save
 * that wrote somewhere the view does not read would look like a Save that did
 * nothing at all.
 */
const preferenceLayerPaths = (root, courseId, term) => {
  const candidates = [
    {
      scope: "system",
      label: "DataLayer defaults",
      path: DEFAULTS_YAML,
    },
    {
      scope: "professor",
      label: "This professor",
      path: join(process.env.PROFESSOR_HOME || root, "preferences.yaml"),
    },
  ];
  if (courseId) {
    candidates.push({
      scope: "course",
      label: `Course ${courseId}`,
      path: join(root, "courses", courseId, "preferences.yaml"),
    });
    if (term) {
      candidates.push({
        scope: "run",
        label: `${courseId} ${term}`,
        path: join(root, "courses", courseId, "preferences.yaml"),
      });
    }
  }

  return candidates;
};

const preferencesDocument = (root, courseId, term) => {
  const candidates = preferenceLayerPaths(root, courseId, term);
  const layers = candidates.map((candidate) => {
    let text;
    try {
      text = readFileSync(candidate.path, "utf8");
    } catch {
      // A layer nobody wrote is absent, and absent is a fact: three of these
      // four files not existing is the normal state of a workspace, and drawing
      // it as an empty set of preferences would say something different.
      return { ...candidate, present: false, values: null, error: null };
    }
    try {
      const parsed = parseYaml(text) ?? {};
      return {
        ...candidate,
        present: true,
        profile_id: parsed.profile_id ?? null,
        values: parsed.values ?? {},
        error: null,
      };
    } catch (error) {
      return { ...candidate, present: true, values: null, error: String(error.message ?? error) };
    }
  });

  return {
    layers,
    schema: preferenceSchema(),
    note:
      "Four layers resolve on top of each other, each beating the one before " +
      "it, and the last — flags on the invoking command — is not a file, so it " +
      "is not shown. The DataLayer defaults ship with the harness and are not " +
      "editable here; the other three are yours, and a layer overrides only " +
      "the keys it names.",
  };
};

/**
 * A request body, with a ceiling on it.
 *
 * The two routes that read one — the preference form and the Canvas selection.
 * The cap is enforced on what arrives rather than trusted from
 * `content-length`, because that header is the sender's claim about the body
 * and this is the body.
 */
const readBody = (req, limit = 256 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("the request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

/**
 * Write one preference layer, and only keys the schema knows.
 *
 * The second write verb in this pane, and unlike the first it is not an
 * approval. A preference is how the professor wants the skills to behave, not a
 * claim about a student, so there is nothing here for `ainar approve` to gate
 * and no second approval path is created by allowing it.
 *
 * What it shares with the first is that it writes a file a person also edits by
 * hand, so it goes through `yaml-out`'s `dump` — the emitter `approve` uses,
 * held to PyYAML byte for byte — and a file this saves is indistinguishable in
 * style from one written beside it.
 *
 * Unknown keys are refused rather than dropped quietly. The form is built FROM
 * the schema, so a key outside it did not come from the form, and writing it
 * would put a setting in the file that nothing ever reads.
 *
 * An empty result does not create a file. "No file here" and "a file that sets
 * nothing" are different facts about a layer — the view says so in those words
 * — and pressing Save on a form nobody filled in must not turn one into the
 * other.
 */
const writePreferences = (root, scope, courseId, term, values) => {
  if (scope === "system") {
    return { error: "The DataLayer defaults ship with the harness. They are not yours to edit here." };
  }
  const layer = preferenceLayerPaths(root, courseId, term).find((entry) => entry.scope === scope);
  if (!layer) {
    return { error: "No " + scope + " layer for this selection. A course layer needs a course, and a run layer needs a run." };
  }
  if (!existsSync(dirname(layer.path))) {
    return { error: "Nowhere to write: " + dirname(layer.path) + " does not exist." };
  }

  const schema = new Map(preferenceSchema().map((field) => [field.path, field]));
  const floats = new Set();
  const tree = {};
  let count = 0;

  for (const [path, raw] of Object.entries(values ?? {})) {
    const field = schema.get(path);
    if (!field) return { error: path + " is not a preference DataLayer reads." };
    // An empty control means "inherit", which is the ABSENCE of the key rather
    // than a value of its own. That is the whole grammar of a layer.
    if (raw === null || raw === undefined || raw === "") continue;

    let value = raw;
    if (field.type === "boolean") {
      if (raw !== true && raw !== false && raw !== "true" && raw !== "false") {
        return { error: path + " takes true or false." };
      }
      value = raw === true || raw === "true";
    } else if (field.type === "number") {
      value = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) return { error: path + " takes a number." };
      if (field.float || !Number.isInteger(value)) floats.add("values." + path);
    } else if (field.type === "enum" && !field.options.includes(String(raw))) {
      return { error: path + " takes one of: " + field.options.join(", ") + "." };
    } else {
      value = String(raw);
    }

    const parts = path.split(".");
    let node = tree;
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
    count += 1;
  }

  if (count === 0 && !existsSync(layer.path)) {
    return { written: false, path: layer.path, count: 0 };
  }

  // Whatever the file already called itself, it goes on calling itself. The id
  // is how a professor recognises their own layer in a log, and a Save is not
  // a reason to rename it.
  let profileId = null;
  try {
    profileId = (parseYaml(readFileSync(layer.path, "utf8")) ?? {}).profile_id ?? null;
  } catch {
    profileId = null;
  }
  if (!profileId) {
    profileId =
      scope === "professor"
        ? "professor-local"
        : scope === "course"
          ? "course-" + courseId
          : "run-" + courseId + "-" + term;
  }

  const document = { version: 1, profile_id: profileId, scope, values: tree };
  writeFileSync(layer.path, dumpYaml(document, (path) => floats.has(path.join("."))), "utf8");
  return { written: true, path: layer.path, count };
};

// ------------------------------------------------------------- integrations
//
// The Integrations tab: everything this run is wired to outside the workspace,
// and — the half actually worth a tab — everything it is not.
//
// The facts are scattered across five files and five environment variables, and
// that scattering is the reason this exists. A professor asking "will a push
// reach Canvas" has to know that the target is on the run record, that the
// course id is on the run record OR in its `extensions` and that only one of
// the two is read, that the host is in a TOML file beside the roster, that the
// token is an environment variable, and that Telegram is in a JSON file under a
// different dot-directory again. Four of those are invisible from every other
// tab in this pane.
//
// **Nothing here prints a credential.** Presence, the variable's name, and the
// path it would be read from — never the value. A pane that showed a Canvas
// token would be putting a grade-changing credential on a screen that gets
// screen-shared, which is the trade the class list's `Pseudonyms` control
// exists to avoid.

/**
 * The gradebook-target vocabulary, duplicated from `ainar/src/lms/index.ts`.
 *
 * Duplicated rather than imported, and since 2026-09-16 for one reason rather
 * than two. The old one was reach: the pane read the model through a compiled
 * copy that had no LMS module at all. It now reads `@ainar/core` directly, so
 * `@ainar/core/src/lms/` IS on the resolution path — this file already imports
 * `lms/link.ts` for the assignment-link writer. What remains is the reason that
 * was always the real one: everything else in that module can push a grade, and
 * a vocabulary is worth copying to keep the rest of it out of arm's reach.
 *
 * What is copied is four strings and two key names. If they drift, this tab
 * calls a supported target unsupported — a wrong sentence on a screen rather
 * than a wrong grade in Canvas.
 */
const LMS_EXTENSION = "lms";
const LMS_TARGETS = ["canvas-csv", "canvas-api", "sheet-csv", "sheets-api"];
const LIVE_LMS_TARGETS = new Set(["canvas-api", "sheets-api"]);
const CANVAS_SECTIONS_KEY = "canvas_sections";
/**
 * One Canvas course per subgroup, for a run taught in several Canvas shells.
 *
 * Duplicated from `src/lms/index.ts` for `LMS_TARGETS`' reason and with the
 * same consequence if it drifts: this pane is vendored and cannot import from
 * ainar-node, so the key name is repeated here and a mismatch would write a
 * mapping the pusher does not read.
 */
const CANVAS_COURSES_KEY = "canvas_courses";
const CANVAS_ASSIGNMENTS_KEY = "canvas_assignments";

/** `extensions.lms` as an object, whatever the record actually holds there. */
const lmsLinkage = (record) => {
  const found = record?.extensions?.[LMS_EXTENSION];
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};

/**
 * One linkage value, with `TODO` counted as absent.
 *
 * `isTodo` rather than a plain empty check, and it is not a nicety. The AINAR
 * scaffolds write the literal string `TODO` where a decision is owed, so a run
 * that has never chosen a gradebook target carries `target: TODO` — and the
 * first version of this read it as a recorded value. The tab then said
 * "Gradebook target · TODO · Recorded, but this workspace cannot reach it",
 * which is two wrong claims at once: nobody recorded it, and the reason it
 * cannot be reached is not that it is exotic. `isTodo`'s own header makes the
 * general point — drawing a placeholder as though it were a decision is worse
 * than saying nothing.
 *
 * Applied here rather than at each call site so it covers every key a scaffold
 * can stamp: the target, the Canvas course and assignment ids, the spreadsheet
 * and the tab names.
 */
const lmsString = (record, key) => {
  const value = lmsLinkage(record)[key];
  return isTodo(value) ? null : String(value);
};

/**
 * The two or three keys this tooling reads out of `lms.toml`.
 *
 * A hand-rolled reader rather than a TOML parser, copied from `canvas-api.ts`
 * for the reason its own header gives: what is wanted is a couple of string
 * assignments inside one table, and a real parser would be a dependency added
 * to read `base_url = "https://…"`.
 *
 * The `token` key is read only so that its PRESENCE can be reported. No caller
 * puts it in a response.
 */
const readTomlTable = (path, table) => {
  let text;
  try {
    if (!statSync(path).isFile()) return {};
    text = readFileSync(path, "utf-8");
  } catch {
    return {};
  }
  const found = {};
  let inside = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inside = line === `[${table}]`;
      continue;
    }
    if (!inside) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) value = value.slice(1, -1);
    if (key && value) found[key] = value;
  }
  return found;
};

/** Whether an environment variable holds something, without saying what. */
const envPresent = (name) => Boolean((process.env[name] || "").trim());

/**
 * The shared connections registry, which `ainar connections` owns.
 *
 * This is the file the pane should be reading, and the two below it —
 * `lms.toml` and the publishing profiles — are the older places the same
 * answer used to live. All three are still reported, because the honest
 * picture during a migration is all three, and because "your Canvas host is in
 * the file the pusher does not read" is precisely the diagnosis a professor
 * needs and cannot get from a view that shows only one.
 *
 * Read-only, and presence-only for credentials: a `tokenEnv` is a variable
 * NAME and is safe to print, a value never is. The registry is not supposed to
 * contain one at all, so finding one is reported as a problem rather than
 * quietly passed over.
 */
const registryPath = () => {
  const fromEnv = (process.env.AINAR_CONNECTIONS || "").trim();
  return fromEnv ? resolve(fromEnv) : join(homedir(), ".ainar", "connections.json");
};

const registryConnections = () => {
  const path = registryPath();
  let parsed;
  try {
    if (!existsSync(path) || !statSync(path).isFile()) {
      return { path, present: false, connections: [], defaults: {}, error: null };
    }
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    return { path, present: true, connections: [], defaults: {}, error: String(error?.message ?? error) };
  }
  const table = parsed && typeof parsed.connections === "object" ? parsed.connections : null;
  if (table === null) {
    return { path, present: true, connections: [], defaults: {}, error: "no `connections` object in the file" };
  }

  // Duplicated from `src/connections/index.ts`, and it drifts the way
  // `LMS_TARGETS` can drift: this plugin is vendored and cannot import from
  // ainar-node. The consequence of drift here is a wrong variable name in a
  // read-only column, which is why the duplication is tolerable and why the
  // names are worth keeping in one obvious shape.
  const FALLBACK = {
    canvas: "AINAR_CANVAS_TOKEN",
    sheets: "AINAR_SHEETS_TOKEN",
    moodle: "AINAR_MOODLE_TOKEN",
    telegram: "AINAR_TELEGRAM_BOT_TOKEN",
  };

  const connections = Object.entries(table)
    .map(([name, entry]) => {
      const type = String(entry?.type ?? "");
      const variable = String(entry?.tokenEnv ?? "").trim() || FALLBACK[type] || null;
      return {
        name,
        type,
        supported: Object.hasOwn(FALLBACK, type),
        baseUrl: entry?.baseUrl ?? null,
        courseId: entry?.courseId ?? null,
        chatId: entry?.chatId ?? null,
        forumId: entry?.forumId ?? null,
        keyFile: entry?.keyFile ?? null,
        tokenEnv: variable,
        tokenInEnv: variable ? envPresent(variable) : false,
        // Never true in a healthy registry. Reported so that it cannot be true
        // and unnoticed.
        tokenInFile: Boolean(String(entry?.token ?? "").trim()),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const defaults = parsed?.defaults && typeof parsed.defaults === "object" ? parsed.defaults : {};
  return { path, present: true, connections, defaults, error: null };
};

/**
 * The grammar `credentialRef` accepts. A name outside it stored nothing.
 *
 * Checked here rather than by importing `credentialRef` from
 * `@deepseek-ai/dsh-credentials`, and the difference matters: that import
 * would throw at module load in a composition without the package, taking the
 * whole pane with it, which is the same failure the nested-fiber injection
 * above exists to avoid. The brand is a compile-time type — at runtime
 * `credentialRef` validates against exactly this pattern and returns the
 * string — so passing a name that has passed this test is the same call.
 */
const CREDENTIAL_REF = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * What the credential seam says about each variable the registry names.
 *
 * Three facts per name, and never a fourth: whether a value is configured,
 * which layer supplies it, and whether this pane could write it. The value is
 * not among them and no code path here can reach one — `describe` does not
 * return it, by the seam's own design.
 *
 * `writable: false` is the interesting case. The local provider layers the
 * inherited process environment OVER its managed document and refuses to write
 * underneath it, because a write that resolution would keep shadowing is a
 * write that appears to succeed and does nothing. So a professor who exported
 * the variable in their shell must be shown a disabled field explaining that,
 * rather than a form that swallows what they type.
 *
 * Without a provider the answer degrades to what this process can see for
 * itself: presence in its own environment, and nothing writable.
 */
const credentialStatus = async (service, names) => {
  const status = {};
  for (const name of new Set(names)) {
    if (!name || !CREDENTIAL_REF.test(name)) continue;
    if (!service) {
      status[name] = {
        configured: envPresent(name),
        source: envPresent(name) ? "env" : null,
        writable: false,
        why: "no credential provider is mounted, so this can only be set in the environment",
      };
      continue;
    }
    try {
      const described = await service.describe(name);
      status[name] = {
        configured: Boolean(described?.configured),
        source: described?.source ?? null,
        writable: Boolean(described?.writable),
        why:
          described?.writable === false && described?.source === "env"
            ? "set in the launching environment, which cannot be edited from here"
            : null,
      };
    } catch (error) {
      status[name] = {
        configured: envPresent(name),
        source: null,
        writable: false,
        why: String(error?.message ?? error),
      };
    }
  }
  return status;
};

/**
 * A credential value, for the one route that has to send one.
 *
 * The only function in this file that holds a token, and it hands it straight
 * to the request. Nothing stores it, logs it, or puts it in a response — the
 * value exists for the duration of one outbound call and then is gone with the
 * stack frame.
 */
const resolveCredential = async (service, name) => {
  if (!service || !name || !CREDENTIAL_REF.test(name)) return null;
  try {
    const found = await service.resolve(name);
    const value = String(found?.value ?? "").trim();
    return value || null;
  } catch {
    // A provider that cannot answer is the same as one that has nothing: the
    // caller falls back to what the process environment holds.
    return null;
  }
};

/**
 * The Integrations payload, credentials and status resolved.
 *
 * Five routes answer with this document — the read, the credential write, the
 * Canvas setup, the subgroup mapping and the section selection — and each one
 * redraws the whole tab from what it returns. Assembling it in five places is
 * how one of them ends up without the status block and a Save silently blanks
 * half the view; there is already a comment two hundred lines up saying that
 * about the credential block, which is exactly how this function came to be.
 */
const integrationsAnswer = async (workspace, root, runId, credentials, extra = {}) => {
  const document = integrationsDocument(workspace, root, runId);
  const refs = await credentialStatus(credentials.service, credentialRefsIn(document));
  return {
    ...document,
    credentials: { available: Boolean(credentials.service), refs },
    integrations: integrationsFor(document, refs),
    ...extra,
  };
};

/**
 * Each integration as a checklist, so the tab opens on the answer.
 *
 * The question a professor arrives with is "will this work", and until now
 * every fact needed to answer it was on the page but none of them said it:
 * a host here, a token there, a course id on the run record, an assignment id
 * per assessment. Five facts, four of them absent, and no line anywhere
 * reading "Canvas is half set up".
 *
 * So each provider gets an ordered list of what it needs, each step done or
 * not, and a state derived from the two:
 *
 * * **absent** — nothing at all is recorded. There is a form for this.
 * * **partial** — some steps are done. The remaining ones are named, because
 *   "partly configured" without saying which part is a worse answer than
 *   nothing.
 * * **ready** — every step is done. Not a promise that a push will succeed:
 *   only Canvas answering can say that, and `doctor` is what asks.
 *
 * A step is a fact, not an instruction. `hint` says where the fact lives, so
 * a professor who would rather edit YAML than press a button can.
 *
 * Pure over the payload that is already assembled, plus the credential status
 * the route has just resolved — nothing here reads a file or the network, and
 * nothing here can hold a credential value.
 */
const integrationsFor = (document, refs) => {
  const configured = (name) => Boolean(name && refs[name] && refs[name].configured);
  const step = (label, done, hint) => ({ label, done: Boolean(done), hint });

  const stateOf = (steps) => {
    if (steps.every((entry) => entry.done)) return "ready";
    return steps.some((entry) => entry.done) ? "partial" : "absent";
  };

  // ---- Canvas ------------------------------------------------------------
  const subgroups = (document.subgroups ?? []).map((entry) => entry.group);
  const bound = Object.keys(document.subgroupCourses?.map ?? {});
  // With subgroups, "the course is recorded" means every one of them has one.
  // A run where CS-401 is bound and CS-402 is not cannot push CS-402, and
  // calling that done would hide exactly the half that is missing.
  const courseDone = subgroups.length
    ? bound.length > 0 && subgroups.every((group) => bound.includes(group))
    : Boolean(document.canvasCourse?.usable);
  const linked = (document.assessments ?? []).filter(
    (entry) => entry.canvasAssignmentId || Object.keys(entry.canvasAssignments ?? {}).length,
  );

  const canvasSteps = [
    step("Host", Boolean(document.canvas?.host), "the address you open Canvas at"),
    step(
      "Token",
      configured(document.canvas?.tokenEnv),
      document.canvas?.tokenEnv ?? "AINAR_CANVAS_TOKEN",
    ),
    step(
      subgroups.length ? `Course for each subgroup (${bound.length}/${subgroups.length})` : "Course",
      courseDone,
      subgroups.length ? "extensions.lms.canvas_courses" : "extensions.lms.canvas_course_id",
    ),
    step(
      `Assessments linked (${linked.length}/${(document.assessments ?? []).length})`,
      linked.length > 0 && linked.length === (document.assessments ?? []).length,
      "extensions.lms.canvas_assignment_id on each assessment",
    ),
  ];

  // ---- The registry-backed providers -------------------------------------
  const ofType = (type) =>
    (document.registry?.connections ?? []).filter((entry) => entry.type === type);
  const legacyOfType = (type) =>
    (document.connections?.profiles ?? []).filter((entry) => entry.type === type);

  const telegram = ofType("telegram")[0] ?? legacyOfType("telegram")[0] ?? null;
  const telegramSteps = [
    step("Channel", Boolean(telegram?.chatId), "the @name or numeric id the bot posts to"),
    step(
      "Bot token",
      configured(telegram?.tokenEnv) || Boolean(telegram?.tokenInEnv),
      telegram?.tokenEnv ?? "AINAR_TELEGRAM_BOT_TOKEN",
    ),
  ];

  const moodle = ofType("moodle")[0] ?? legacyOfType("moodle")[0] ?? null;
  const moodleSteps = [
    step("Host", Boolean(moodle?.baseUrl), "the address you open Moodle at"),
    step(
      "Web-service token",
      configured(moodle?.tokenEnv) || Boolean(moodle?.tokenInEnv),
      moodle?.tokenEnv ?? "AINAR_MOODLE_TOKEN",
    ),
  ];

  const sheetsConnection = ofType("sheets")[0] ?? null;
  const sheetsSteps = [
    step("Spreadsheet", Boolean(document.sheet?.id), "extensions.lms.sheet_id on the run"),
    step(
      "Credential",
      configured("AINAR_SHEETS_TOKEN") || Boolean(sheetsConnection?.keyFile),
      "AINAR_SHEETS_TOKEN, or a service-account key",
    ),
  ];

  return [
    {
      id: "canvas",
      label: "Canvas",
      what: "grades, and announcements",
      state: stateOf(canvasSteps),
      steps: canvasSteps,
      // Which fields the form asks for. The client draws from this rather
      // than knowing each provider, so a provider added here appears there.
      fields: ["baseUrl", "token"],
      canPushGrades: true,
    },
    {
      id: "telegram",
      label: "Telegram",
      what: "announcements to the course channel",
      state: stateOf(telegramSteps),
      steps: telegramSteps,
      fields: ["chatId", "token"],
      canPushGrades: false,
    },
    {
      id: "sheets",
      label: "Google Sheets",
      what: "the professor's own gradebook",
      state: stateOf(sheetsSteps),
      steps: sheetsSteps,
      fields: ["sheetId", "token"],
      canPushGrades: true,
    },
    {
      id: "moodle",
      label: "Moodle",
      what: "announcements and pages",
      state: stateOf(moodleSteps),
      steps: moodleSteps,
      fields: ["baseUrl", "token"],
      // Said out loud rather than left to be discovered: `ainar lms push` has
      // no Moodle target, and a row that looked like Canvas's would promise
      // one. `prof-publish` reaches Moodle, and it publishes content.
      canPushGrades: false,
    },
  ];
};

/** Every variable this run's integrations would read a credential from. */
const credentialRefsIn = (document) =>
  [
    document?.canvas?.tokenEnv,
    ...(document?.registry?.connections ?? []).map((connection) => connection.tokenEnv),
  ].filter(Boolean);

/**
 * The publishing profiles in `~/.professor/connections.json`.
 *
 * A different file, written by a different tool — the
 * `professor-lms-publishing-skills` package, which is where Moodle and Telegram
 * live. It is reported here because from the professor's side it is the same
 * question: what is this course wired to.
 *
 * A profile's literal `token` is dropped on the way out. `tokenEnv` is a
 * variable NAME and is safe to print; all this says of a token in the file is
 * that one is there — which is itself worth saying, because a credential in a
 * JSON file is a credential somewhere the professor may not have meant.
 */
const connectionProfiles = () => {
  const path = join(homedir(), ".professor", "connections.json");
  let parsed;
  try {
    if (!existsSync(path) || !statSync(path).isFile()) {
      return { path, present: false, profiles: [], error: null };
    }
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    return { path, present: true, profiles: [], error: String(error?.message ?? error) };
  }
  const table = parsed && typeof parsed.profiles === "object" ? parsed.profiles : null;
  if (table === null) {
    return { path, present: true, profiles: [], error: "no `profiles` object in the file" };
  }
  // The variable each provider falls back to when a profile names no
  // `tokenEnv`, from `resolveToken` in that package's `config.ts`.
  const FALLBACK = {
    canvas: "CANVAS_TOKEN",
    moodle: "MOODLE_TOKEN",
    telegram: "TELEGRAM_BOT_TOKEN",
  };
  const profiles = Object.entries(table).map(([name, profile]) => {
    const type = String(profile?.type ?? "");
    const variable = String(profile?.tokenEnv ?? "").trim() || FALLBACK[type] || null;
    return {
      name,
      type,
      supported: Object.hasOwn(FALLBACK, type),
      baseUrl: profile?.baseUrl ?? null,
      courseId: profile?.courseId ?? null,
      chatId: profile?.chatId ?? null,
      forumId: profile?.forumId ?? null,
      tokenEnv: variable,
      tokenInFile: Boolean(String(profile?.token ?? "").trim()),
      tokenInEnv: variable ? envPresent(variable) : false,
    };
  });
  return { path, present: true, profiles, error: null };
};

/**
 * Where the Canvas host and token would come from, resolved as
 * `loadCanvasConfig` resolves them: the environment first, then `lms.toml`.
 *
 * The host IS returned, because a hostname is not a secret and the professor
 * needs to see which Canvas this would push to — a course id pointing at the
 * wrong instance is the failure this whole tab is meant to make visible. The
 * token is returned only to `canvasCatalogue`, which sends it to that host and
 * to nowhere else; every response-building caller reads the two booleans.
 */
const canvasSettings = (registry = registryConnections()) => {
  const path = join(rosterDir(), "lms.toml");
  const settings = readTomlTable(path, "canvas");
  const fromEnv = (process.env.AINAR_CANVAS_URL || "").trim();

  // The same order `loadCanvasConfig` resolves in, and it has to stay the same
  // order: a pane that reported a different host from the one a push would use
  // would be worse than a pane that reported nothing.
  const usableCanvas = registry.connections.filter(
    (connection) => connection.type === "canvas" && connection.baseUrl && !connection.tokenInFile,
  );
  const named = registry.defaults?.canvas
    ? usableCanvas.find((connection) => connection.name === registry.defaults.canvas)
    : null;
  // One is unambiguous; two without a declared default are not, and the pusher
  // refuses to guess between them, so the pane must not name one either.
  const chosen = named ?? (usableCanvas.length === 1 ? usableCanvas[0] : null);

  const variable = chosen?.tokenEnv ?? "AINAR_CANVAS_TOKEN";
  return {
    configPath: path,
    registryPath: registry.path,
    connection: chosen?.name ?? null,
    host: fromEnv || chosen?.baseUrl || settings.base_url || null,
    hostFrom: fromEnv
      ? "AINAR_CANVAS_URL"
      : chosen
        ? `connection ${chosen.name} in ${registry.path}`
        : settings.base_url
          ? path
          : null,
    tokenEnv: variable,
    tokenInEnv: envPresent(variable),
    tokenInFile: Boolean(String(settings.token ?? "").trim()),
    token: process.env[variable] || settings.token || null,
  };
};

/**
 * The sheet tab an assessment writes to when nothing was written down, as
 * `defaultSheetTab` derives it: `ASSESSMENT-04` becomes `A04`.
 *
 * Duplicated for `LMS_TARGETS`' reason, with the same consequence if it drifts:
 * a wrong tab name in a read-only column. Derived from the id and never from
 * the title, because the tab name is the key the next push finds the tab by and
 * titles are edited freely.
 */
const defaultSheetTab = (assessmentId) => {
  const id = String(assessmentId ?? "");
  const remainder = id.startsWith("ASSESSMENT-") ? id.slice("ASSESSMENT-".length) : id;
  const derived = !remainder ? id : /^[0-9]/.test(remainder) ? `A${remainder}` : remainder;
  const cleaned = [...derived]
    .map((char) => ("[]*?/\\:".includes(char) ? "-" : char))
    .join("")
    .trim();
  return cleaned.slice(0, 100) || "Sheet";
};

/**
 * The Canvas sections and groups already bound to this run.
 *
 * A LIST rather than a map keyed by subgroup, and the shape is the whole design
 * of the selection this tab offers. A Canvas course is divided into sections by
 * a registrar and into student groups by the professor; a run carries
 * subgroups, or carries none at all. Keying by subgroup would leave a run
 * taught as one cohort with no key to write under, and would refuse the
 * ordinary case of two Canvas sections feeding one subgroup.
 *
 * So each entry is one Canvas thing the professor selected, and `group` says
 * which subgroup it feeds — absent meaning it feeds the whole run.
 */
const canvasSelections = (run) => {
  const raw = lmsLinkage(run)[CANVAS_SECTIONS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      id: entry.id === null || entry.id === undefined ? "" : String(entry.id),
      name: entry.name === null || entry.name === undefined ? null : String(entry.name),
      kind: entry.kind === "group" ? "group" : "section",
      group:
        entry.group === null || entry.group === undefined || entry.group === ""
          ? null
          : String(entry.group),
    }))
    .filter((entry) => entry.id !== "");
};

/** The run record's own file, which is the one place `versions` may live. */
const versionRecordPath = (root, courseId, term) =>
  join(root, "courses", courseId, "version.yaml");

/**
 * Everything the Integrations tab draws, as JSON for the browser half.
 *
 * JSON rather than a served HTML document, unlike the class list and the
 * Checklist. Those two are inert pages and go into the sandboxed frame; this
 * one has a form that has to call back — the Canvas fetch, and the save — and
 * the frame is delivered as `srcdoc` WITHOUT `allow-same-origin`, so a document
 * inside it has an opaque origin and cannot reach these routes at all.
 * Preferences is drawn in the browser half for exactly this reason.
 */
const integrationsDocument = (workspace, root, runId) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId) ?? {};
  const enrolled = enrollmentsOf(bundle, runId);
  const registry = registryConnections();
  const canvas = canvasSettings(registry);
  const target = lmsString(run, "target");

  // The course id, and WHICH field said it. Two fields can, and only one is
  // read by the pusher: `lms_course_id` is a first-class column on the run
  // record and is what onboarding writes, while `extensions.lms
  // .canvas_course_id` is what `ainar lms push` actually looks at. A professor
  // whose push cannot find a course needs to be told that the id they can see
  // is sitting in the field the pusher does not read.
  const extensionId = lmsString(run, "canvas_course_id");
  // `isTodo` here too: `lms_course_id` is a scaffolded column like any other,
  // and a run carrying the placeholder has not named a Canvas course.
  const columnId = isTodo(run.lms_course_id) ? null : String(run.lms_course_id);
  // The API takes a number. `canvas-88219` is a handle somebody wrote for a
  // human, and reporting it as configured would describe a push that cannot
  // work — so `usable` is separate from `id`.
  const numeric = /^[0-9]+$/;

  const activeIn = (group) =>
    enrolled.filter(
      (entry) => entry.status === "active" && String(entry.group ?? "").trim() === group,
    ).length;

  return {
    run: {
      runId,
      courseId: run.course_id ?? null,
      term: run.term ?? null,
      section: run.section ?? null,
      recordPath:
        run.course_id && run.term
          ? relative(root, versionRecordPath(root, run.course_id, run.term)).split(sep).join("/")
          : null,
    },

    // ---- Targets ---------------------------------------------------------
    target: {
      value: target,
      supported: target === null ? null : LMS_TARGETS.includes(target),
      live: target !== null && LIVE_LMS_TARGETS.has(target),
      options: LMS_TARGETS,
    },
    canvasCourse: {
      id: extensionId ?? (columnId && numeric.test(columnId) ? columnId : null),
      fromExtension: extensionId,
      fromColumn: columnId,
      usable: Boolean(
        extensionId ? numeric.test(extensionId) : columnId && numeric.test(columnId),
      ),
    },
    sheet: {
      id: lmsString(run, "sheet_id"),
      summaryTab: lmsString(run, "sheet_tab") || "Summary",
    },

    // One Canvas course per subgroup, where the run is taught in several
    // Canvas shells. `conflict` is the state the validator calls
    // `lms.both_course_forms`: reported here too, because the form has to
    // refuse to write into a record that already answers the question the
    // other way, and refusing without saying why is the worse half of that.
    subgroupCourses: (() => {
      const found = lmsLinkage(run)[CANVAS_COURSES_KEY];
      const map = {};
      if (found && typeof found === "object" && !Array.isArray(found)) {
        for (const [group, value] of Object.entries(found)) {
          const id = String(value ?? "").trim();
          if (id) map[group] = id;
        }
      }
      return {
        map,
        perSubgroup: Object.keys(map).length > 0,
        // `extensionId` only, deliberately. `lms_course_id` is the column the
        // pusher does not read, so a run carrying it alongside a subgroup
        // mapping has one answer, not two — and the validator's
        // `lms.both_course_forms` counts it the same way. Including it here
        // would raise a conflict on every run scaffolded with that column.
        conflict: Object.keys(map).length > 0 && Boolean(extensionId),
        singleId: extensionId,
      };
    })(),

    // ---- Credentials, by presence only -----------------------------------
    canvas: {
      host: canvas.host,
      hostFrom: canvas.hostFrom,
      configPath: canvas.configPath,
      registryPath: canvas.registryPath,
      connection: canvas.connection,
      tokenEnv: canvas.tokenEnv,
      tokenInEnv: canvas.tokenInEnv,
      tokenInFile: canvas.tokenInFile,
    },
    environment: [
      {
        name: "AINAR_CANVAS_URL",
        present: envPresent("AINAR_CANVAS_URL"),
        what: "Which Canvas to talk to. Not a secret.",
      },
      {
        name: "AINAR_CANVAS_TOKEN",
        present: envPresent("AINAR_CANVAS_TOKEN"),
        what: "Can change a grade. Keep it out of the repository.",
      },
      {
        name: "AINAR_SHEETS_TOKEN",
        present: envPresent("AINAR_SHEETS_TOKEN"),
        what: "Overwrites the professor's own spreadsheet.",
      },
      {
        name: "AINAR_TELEGRAM_BOT_TOKEN",
        present: envPresent("AINAR_TELEGRAM_BOT_TOKEN"),
        what: "Posts to the course channel students read.",
      },
      {
        name: "AINAR_MOODLE_TOKEN",
        present: envPresent("AINAR_MOODLE_TOKEN"),
        what: "Publishes to Moodle, where nothing here can push grades yet.",
      },
      {
        name: "AINAR_ROSTER_DIR",
        present: envPresent("AINAR_ROSTER_DIR"),
        what: "Where the private roster lives, if not ~/.ainar/roster.",
      },
      {
        name: "AINAR_CONNECTIONS",
        present: envPresent("AINAR_CONNECTIONS"),
        what: "Where the connections registry lives, if not ~/.ainar/connections.json.",
      },
    ],
    roster: (() => {
      const path = rosterPath();
      const people = rosterPeople();
      return {
        path,
        present: existsSync(path),
        // A count, never a name. The class list is where people are named, and
        // only when the professor has pressed for it.
        count: people === null ? null : Object.keys(people).length,
      };
    })(),
    // Two address books during the migration, and the pane shows both: the
    // registry every tool now reads first, and the older publishing profiles
    // it falls back to. A professor whose push cannot find a host needs to see
    // which of the two the host they can see is actually sitting in.
    registry,
    connections: connectionProfiles(),

    // ---- Links -----------------------------------------------------------
    assessments: assessmentsOf(bundle, runId).map((assessment) => ({
      assessmentId: assessment.assessment_id,
      title: assessment.title ?? null,
      // What it is out of. The binder's last-resort pairing rule compares it
      // against a Canvas assignment's points_possible, and a professor
      // checking a suggested pair reads it before anything else.
      maximumScore: assessment.maximum_score ?? null,
      canvasAssignmentId: lmsString(assessment, "canvas_assignment_id"),
      // The mapping itself, not just a count. The binder saves one subgroup
      // at a time and the writer replaces the whole mapping, so the browser
      // half has to send back the subgroups it is not editing — without this
      // it would send only CS-401 and quietly unbind the other two.
      canvasAssignments: (() => {
        const found = lmsLinkage(assessment)[CANVAS_ASSIGNMENTS_KEY];
        const map = {};
        if (found && typeof found === "object" && !Array.isArray(found)) {
          for (const [group, value] of Object.entries(found)) {
            const id = String(value ?? "").trim();
            if (id) map[group] = id;
          }
        }
        return map;
      })(),
      sheetTab: lmsString(assessment, "sheet_tab"),
      defaultSheetTab: defaultSheetTab(assessment.assessment_id),
    })),
    subgroups: groupsOf(bundle, runId).map((group) => ({ group, students: activeIn(group) })),
    ungrouped: activeIn(""),
    selections: canvasSelections(run),
  };
};

/**
 * Canvas's sections and student groups for one course, fetched live.
 *
 * The one outbound request this plugin makes, and everything about how it is
 * reached follows from that:
 *
 * * **POST, not GET.** It is a read as far as Canvas is concerned, so GET would
 *   be the honest verb — but it spends the professor's API quota and sends a
 *   grade-changing token, and this file's rule for that is already written on
 *   `/api/approve`: a side effect behind a GET is one a link, a prefetch, a
 *   refresh or a replayed history entry can fire without anybody having decided
 *   to. A professor pressing `Fetch from Canvas` has decided to.
 * * **No caching.** The answer is a list of sections a registrar edits, and a
 *   stale one would be mapped against by mistake.
 * * **Two read-only endpoints and no others.** There is no branch here that can
 *   write to Canvas.
 *
 * Pagination is Canvas's `Link` header. Bounded at ten pages, because a
 * thousand sections is not a course, it is a wrong course id — and an unbounded
 * follow would sit here spending quota on discovering that.
 */
const canvasCatalogue = async (courseId, host, token) => {
  const api = host.replace(/\/+$/, "") + "/api/v1";
  const read = async (collection, params) => {
    const rows = [];
    let next =
      `${api}/courses/${encodeURIComponent(courseId)}/${collection}?per_page=100` +
      (params ? `&${params}` : "");
    for (let page = 0; page < 10 && next; page += 1) {
      const response = await fetch(next, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!response.ok) {
        // The status and Canvas's own sentence. Never the request, which is
        // where the Authorization header is.
        let detail = "";
        try {
          detail = (await response.text()).slice(0, 400);
        } catch {
          detail = "";
        }
        throw new Error(
          `Canvas answered ${response.status} for ${collection}` + (detail ? `: ${detail}` : ""),
        );
      }
      const body = await response.json();
      if (Array.isArray(body)) rows.push(...body);
      const found = /<([^>]+)>\s*;\s*rel="next"/.exec(response.headers.get("link") || "");
      next = found ? found[1] : null;
    }
    return rows;
  };

  // Both, because both are called "groups" in conversation and guessing which
  // one the professor meant is how this control would end up mapping the wrong
  // thing. Sections are what a registrar-fed course is actually divided by;
  // student groups are the professor's own grouping, and each is labelled as
  // what it is so the choice is theirs rather than this function's.
  const [sections, groups] = await Promise.all([
    read("sections", "include[]=total_students"),
    read("groups", null),
  ]);

  const option = (row, kind) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? row.id ?? ""),
    kind,
    students:
      typeof row.total_students === "number"
        ? row.total_students
        : typeof row.members_count === "number"
          ? row.members_count
          : null,
    sisId: row.sis_section_id ? String(row.sis_section_id) : null,
  });

  return {
    host: host.replace(/\/+$/, ""),
    courseId: String(courseId),
    options: [
      ...sections.map((row) => option(row, "section")),
      ...groups.map((row) => option(row, "group")),
    ].filter((entry) => entry.id !== ""),
  };
};

/**
 * Write the Canvas selection into the run record.
 *
 * The third write verb in this pane, and the first that touches `courses/`. Why
 * it is allowed to, where a grade is not:
 *
 * `ainar approve` gates the promotion of DRAFTS — claims about students and
 * about what the course teaches, produced by an agent, which a professor has to
 * read before they become the record. This writes neither. It records which
 * Canvas section corresponds to which subgroup: a fact about the professor's
 * own LMS that only they know, that no skill drafts and no agent can propose,
 * and that therefore has no drafted half for `approve` to promote. Refusing it
 * would not protect the record — it would mean the fact stays settable only by
 * hand-editing YAML, which is the friction this tab exists to remove.
 *
 * What it borrows from `approve` is the care:
 *
 * * **`extensions.lms.canvas_sections` and nothing else.** The document is
 *   re-read, that one key is replaced, everything else written back untouched.
 *   No path here can reach `start_date`, `status` or `instructors`.
 * * **Comments survive**, through `parseDocument` rather than `parse`.
 *   `version.yaml` opens with a comment explaining the version/run merge, and a
 *   save that silently deleted a professor's writing would be a bug worse than
 *   the friction it removed. `writePreferences` may use the plain emitter
 *   because it owns its file whole; this one does not own the file at all.
 * * **A subgroup this run has never heard of is refused**, by `requireGroups`,
 *   for that function's own reason. A typo'd label would otherwise sit in the
 *   record binding a Canvas section to a cohort that does not exist.
 */
const writeCanvasSelection = (workspace, root, runId, selections) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }
  if (!Array.isArray(selections)) return { error: "The selection must be a list." };
  if (selections.length > 200) return { error: "That is more than 200 selections." };

  const cleaned = [];
  const seen = new Set();
  for (const entry of selections) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "Each selection must be an object." };
    }
    const id = String(entry.id ?? "").trim();
    if (!id) return { error: "A selection with no Canvas id cannot be recorded." };
    if (!/^[0-9]+$/.test(id)) return { error: `${id} is not a Canvas id.` };
    const kind = entry.kind === "group" ? "group" : "section";
    if (seen.has(`${kind}:${id}`)) continue;
    seen.add(`${kind}:${id}`);
    const group = String(entry.group ?? "").trim();
    // Throws on a label this run does not have, which is the point of asking
    // the bundle rather than trusting the form.
    if (group) requireGroups(bundle, runId, [group]);
    const row = { id, kind };
    const name = String(entry.name ?? "").trim();
    if (name) row.name = name;
    if (group) row.group = group;
    cleaned.push(row);
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  if (cleaned.length === 0) {
    // An empty selection REMOVES the key rather than writing an empty list, by
    // the grammar `writePreferences` states: absent and "set to nothing" are
    // different facts about a record, and unmapping every section should leave
    // the file saying nothing at all about Canvas sections. The now-empty
    // parents go with it, so a run that was never wired to Canvas reads exactly
    // as it did before this tab was ever opened.
    document.deleteIn(["extensions", LMS_EXTENSION, CANVAS_SECTIONS_KEY]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, CANVAS_SECTIONS_KEY], cleaned);
  }

  // The emitter always produces LF. A `version.yaml` that arrived with CRLF —
  // one edited on Windows in something that is not an editor — would otherwise
  // come back with every line changed, and a one-selection change would show up
  // in `git diff` as a rewrite of the whole record. The endings the professor
  // had are the endings they keep.
  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return {
    written: true,
    path: relative(root, path).split(sep).join("/"),
    count: cleaned.length,
  };
};

/**
 * Write each assessment's Canvas assignment linkage into its own record.
 *
 * The fourth writer here and the only one that edits a file other than
 * `version.yaml`, which brings two things worth stating.
 *
 * **Which file.** `RECORD_GLOBS` accepts `assessments.yaml`
 * and `assessments/*.yaml`, so an assessment sits wherever it
 * was authored or approved into. The file is found by scanning for the id as
 * a value of `assessment_id`, the way `withRecordPaths` does for the same
 * reason: guessing `generated.yaml` is right until somebody hand-authors one,
 * and then it silently edits the wrong record.
 *
 * **The header that says not to.** Files `ainar approve` writes carry
 * "Machine-managed — change these through approval, not by hand", and this
 * edits them. The line that makes it defensible: approval is a gate on
 * *decisions* — what a student was given, what an outcome claims — and a
 * Canvas assignment id is neither. It is a pointer at another system, it
 * carries no academic content, it changes when somebody rebuilds a Canvas
 * shell, and nothing about it is a judgement anybody should have to re-accept.
 * Every other field in the record is left exactly as it was.
 *
 * A multi-document file is refused rather than rewritten. The emitter would
 * have to reproduce the separators and the per-document formatting, and a
 * half-right rewrite of a professor's records is worse than an honest refusal
 * naming the file.
 */
const recordAssessmentLinks = (workspace, root, runId, links) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its records cannot be located.` };
  }
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    return { error: "The links must be an object of assessment id to Canvas assignment id." };
  }

  const known = new Set(assessmentsOf(bundle, runId).map((entry) => entry.assessment_id));
  const groups = new Set(groupsOf(bundle, runId));

  // Normalise every entry first, so a single bad value stops the whole write
  // rather than leaving half the assessments edited.
  const wanted = new Map();
  for (const [assessmentId, value] of Object.entries(links)) {
    if (!known.has(assessmentId)) {
      return { error: `${assessmentId} is not an assessment of ${runId}.` };
    }
    if (value === null || value === "" || value === undefined) {
      wanted.set(assessmentId, null);
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const mapping = {};
      for (const [group, id] of Object.entries(value)) {
        if (!groups.has(group)) {
          return { error: `${runId} has no subgroup '${group}'.` };
        }
        const cleaned = String(id ?? "").trim();
        if (!cleaned) continue;
        if (!/^[0-9]+$/.test(cleaned)) {
          return { error: `'${cleaned}' is not a Canvas assignment id — the API takes the number.` };
        }
        mapping[group] = cleaned;
      }
      wanted.set(assessmentId, Object.keys(mapping).length ? mapping : null);
      continue;
    }
    const cleaned = String(value).trim();
    if (!/^[0-9]+$/.test(cleaned)) {
      return { error: `'${cleaned}' is not a Canvas assignment id — the API takes the number.` };
    }
    wanted.set(assessmentId, cleaned);
  }
  if (!wanted.size) return { written: false, count: 0 };

  // ---- and hand the editing to the one writer -----------------------------
  //
  // Finding the file, refusing a multi-document one, editing through the YAML
  // document API so the comments survive, and keeping the line endings — all
  // of that is `lms/link.js`, which `ainar lms assignment-push` also calls.
  // This route used to hold a second copy of it, and two copies of a rule
  // about rewriting a professor's records is one copy too many.
  //
  // What stays here is validation of an untrusted browser payload, above:
  // whether the run exists, whether the assessment is in it, whether a
  // subgroup is one the run has, whether an id is the number the API takes.
  // That belongs where the payload arrives, not in a module the CLI shares.
  try {
    const recorded = writeAssessmentLinks(root, run.course_id, run.term, wanted);
    return { written: recorded.count > 0, count: recorded.count, files: recorded.written };
  } catch (error) {
    // The shared writer throws; this route answers in-band, because its caller
    // is a `fetch` in the browser half and a sentence is what it draws.
    return { error: String(error?.message ?? error) };
  }
};

/**
 * Set or clear one scalar under `extensions.lms` on the run record.
 *
 * The third writer of this file and the last one that needed writing, so it
 * is the general shape the other two are special cases of: edit the document
 * rather than rewrite it, delete the key and its emptied parents rather than
 * write a blank, and keep the line endings the file arrived with.
 */
const writeRunLmsValue = (workspace, root, runId, key, value) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  const cleaned = String(value ?? "").trim();
  if (!cleaned) {
    document.deleteIn(["extensions", LMS_EXTENSION, key]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, key], cleaned);
  }

  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return { written: true, path: relative(root, path).split(sep).join("/"), key, cleared: !cleaned };
};

/**
 * Write `extensions.lms.canvas_courses` — one Canvas course per subgroup.
 *
 * The same shape and the same care as `writeCanvasSelection` next door: the
 * document is edited rather than rewritten so a professor's comments and key
 * order survive, an empty mapping removes the key and its emptied parents
 * rather than writing `{}`, and the line endings the file arrived with are the
 * ones it leaves with.
 *
 * Two refusals of its own:
 *
 * **A subgroup this run does not have is rejected**, by `requireGroups`, for
 * that function's reason — a typo'd label would sit in the record binding a
 * Canvas course to a cohort that does not exist, and at push time it reads as
 * "that subgroup has no Canvas course" rather than as the typo it is.
 *
 * **Writing this while `canvas_course_id` is set is rejected.** The validator
 * calls that `lms.both_course_forms` and so does this: two answers to which
 * Canvas course a run is would be settled by whichever code path read first,
 * and the cost of reading wrong is one cohort's marks in another's gradebook.
 * The professor is told to clear the single id first, in those words.
 */
const writeCanvasCourses = (workspace, root, runId, mapping) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  if (!run) return { error: `no course run '${runId}' in this workspace` };
  if (!run.course_id || !run.term) {
    return { error: `${runId} carries no course_id and term, so its record cannot be located.` };
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return { error: "The mapping must be an object of subgroup to Canvas course id." };
  }

  const entries = Object.entries(mapping);
  if (entries.length > 100) return { error: "That is more than 100 subgroups." };

  const cleaned = {};
  for (const [group, value] of entries) {
    const label = String(group ?? "").trim();
    if (!label) return { error: "A mapping entry with no subgroup cannot be recorded." };
    const id = String(value ?? "").trim();
    // An entry with no id is an unmapping, not an error: the form sends every
    // subgroup it drew, and the ones still to be decided arrive empty.
    if (!id) continue;
    if (!/^[0-9]+$/.test(id)) {
      return {
        error:
          `'${id}' is not a Canvas course id. The API takes the number, which is the ` +
          "one in the course URL.",
      };
    }
    requireGroups(bundle, runId, [label]);
    cleaned[label] = id;
  }

  const singleId = lmsString(run, "canvas_course_id");
  if (Object.keys(cleaned).length && singleId) {
    return {
      error:
        `This run already sets extensions.lms.canvas_course_id to ${singleId}, which says ` +
        "the whole run is one Canvas course. Clear that first — a record holding both " +
        "forms has two answers to which course a push should reach.",
    };
  }

  const path = versionRecordPath(root, run.course_id, run.term);
  if (!existsSync(path)) return { error: `Nowhere to write: ${path} does not exist.` };

  let original;
  let document;
  try {
    original = readFileSync(path, "utf8");
    document = parseYamlDocument(original);
  } catch (error) {
    return { error: `${path} will not parse: ${String(error?.message ?? error)}` };
  }
  if (document.errors?.length) {
    return { error: `${path} will not parse: ${document.errors[0].message}` };
  }

  if (!Object.keys(cleaned).length) {
    document.deleteIn(["extensions", LMS_EXTENSION, CANVAS_COURSES_KEY]);
    const emptied = (node) => node && Array.isArray(node.items) && node.items.length === 0;
    if (emptied(document.getIn(["extensions", LMS_EXTENSION]))) {
      document.deleteIn(["extensions", LMS_EXTENSION]);
    }
    if (emptied(document.get("extensions"))) document.delete("extensions");
  } else {
    document.setIn(["extensions", LMS_EXTENSION, CANVAS_COURSES_KEY], cleaned);
  }

  const written = /\r\n/.test(original)
    ? String(document).replace(/\r?\n/g, "\r\n")
    : String(document);
  writeFileSync(path, written, "utf8");
  return {
    written: true,
    path: relative(root, path).split(sep).join("/"),
    count: Object.keys(cleaned).length,
  };
};

/**
 * `text` embedded in a `<script>` as a JSON literal that cannot end the element.
 *
 * `JSON.stringify` alone is not enough: a payload containing the six characters
 * `</script` closes the element from inside a string literal, and course data
 * carries free text — a resource title, an outcome statement, a professor's
 * note. Escaping `<` costs nothing and is the same precaution
 * `dsh-ainar-course-model`'s own `jsString` takes, for the same reason.
 */
const embed = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * One widget document with its payload already in it.
 *
 * `runtime.js` reads `window.openai.toolOutput` and repaints on three events,
 * so a document served with the object already present paints on first load and
 * needs no channel for its data. The only thing that has to travel back out is
 * a button press: the widgets ask the model a question through
 * `sendFollowUpMessage`, deliberately never `callTool`, and here that becomes a
 * `postMessage` the browser half turns into a prompt in the open session.
 *
 * `dark` re-declares the widget's own dark tokens unconditionally. The widget
 * style sheet chooses its scheme with `prefers-color-scheme`, which is the OS
 * setting; DSH's theme is an explicit choice on `body`. Without this an
 * iframe would be light inside a dark harness whenever the two disagree, and
 * the alternative — editing `shell.css` — is editing a file two servers share
 * and a test compares byte for byte.
 */
const widgetDocument = (widget, data, dark) => {
  const shim = `<script>
window.openai = {
  toolOutput: ${embed(data)},
  widgetState: {},
  setWidgetState: function (next) { this.widgetState = next; },
  sendFollowUpMessage: function (message) {
    // '*' rather than an origin, because this document is delivered into a
    // frame sandboxed without allow-same-origin: its own origin is the string
    // "null", which postMessage rejects as a target. The only receiver is the
    // harness page that put the document in the frame, and the payload is one
    // string that becomes a prompt in the professor's own open session.
    parent.postMessage({
      source: 'professor-pane',
      kind: 'ask',
      prompt: message && message.prompt
    }, '*');
  },
  // Show a material over the whole harness instead of in a new browser tab.
  //
  // THIS FUNCTION IS THE FEATURE TEST. runtime.js intercepts a click only
  // where the host offers this, so the same widget served to ChatGPT or Claude
  // Desktop — which have no page to put an overlay on and no route to the file
  // — goes on following its link exactly as before. No payload flag, no
  // second code path in the view: the capability is either here or it is not.
  openMaterial: function (material) {
    parent.postMessage({
      source: 'professor-pane',
      kind: 'view',
      url: material && material.url,
      label: material && material.label,
      format: material && material.format
    }, '*');
  }
};
</script>`;
  const scheme = dark
    ? `<style>:root{
  --fg:#e8e8e8; --on-fg:#16181c; --muted:#9a9a9a; --line:#2e3239; --panel:#1c1f24;
  --accent:#7fc98d; --flag:#e08c85;
  --b1:#6b3a37; --b2:#6d5730; --b3:#5f5c2c; --b4:#3f5a38; --b5:#2f6b3c;
  --none:#1e2126; --none-fg:#6b6b6b;
}</style>`
    : "";
  return (
    "<!doctype html><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<style>html,body{margin:0;padding:12px 14px 32px}</style>" +
    shim +
    widget.html() +
    scheme
  );
};

const send = (res, status, type, body) => {
  res.writeHead(status, {
    "content-type": type,
    // The pane is the professor's machine looking at the professor's course.
    // Nothing here should be sitting in a cache when the underlying YAML has
    // moved on, and the whole point of the pane is that a reload is current.
    "cache-control": "no-store",
  });
  res.end(body);
};

const sendJson = (res, status, value) =>
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));


/**
 * An assessment named as the professor reads it, and as the record knows it.
 *
 * The title alone was ambiguous in the way that matters here. A course whose
 * homework is titled "Homework" four times over drew four identical rows, and
 * telling the professor WHICH one carries no deadline is the only thing the
 * Deadlines section is for. The identifier is what distinguishes them, and it
 * is also the string they would grep for under `assessments/`
 * or hand to `ainar` — so it is the useful half of the pair to print, not a
 * debugging leftover.
 *
 * After the title and dimmed, because the title is what is read and the id is
 * what is acted on. The widget documents this pane serves put it in the same
 * place, so the two halves of the pane agree on where to look for it.
 *
 * Suppressed when the record has no title of its own: the fallback already IS
 * the id, and printing it twice reads as a fault in the page rather than in
 * the record.
 */
const titleWithId = (row) => {
  const id = row.assessment_id ?? null;
  const title = row.title ?? id ?? "untitled";
  return (
    escapeText(title) +
    (id !== null && title !== id ? ' <span class="id">' + escapeText(id) + "</span>" : "")
  );
};

/**
 * The click that shows a material over the harness instead of in a new tab.
 *
 * The pane's own pages have no `window.openai`, so they cannot reuse the shim
 * the widgets get; this is the same contract written out in eight lines. It
 * posts the identical `view` message, and the browser half accepts the URL
 * only if it addresses this app's material route — see `materialUrl` there.
 *
 * Three ways out of it, all deliberate. A page opened directly in a tab has
 * `parent === window`, nobody listening, and so takes no clicks at all. A
 * modified click — ctrl, cmd, shift, middle — keeps the tab it always opened.
 * And an anchor with no `data-view` is untouched, which is how a `.pptx` and a
 * reading hosted on somebody else's server go on behaving as before.
 */
const VIEW_SCRIPT =
  "<script>(function(){if(parent===window)return;" +
  "document.addEventListener('click',function(e){" +
  "var p=e.target.closest&&e.target.closest('button[data-publish]');" +
  "if(p){e.preventDefault();parent.postMessage({source:'professor-pane'," +
  "kind:'publish',assessment:p.getAttribute('data-publish')," +
  "label:p.getAttribute('data-label')||''},'*');return;}" +
  "var a=e.target.closest&&e.target.closest('a[data-view]');if(!a)return;" +
  "if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;" +
  "e.preventDefault();" +
  "parent.postMessage({source:'professor-pane',kind:'view'," +
  "url:a.getAttribute('href'),label:a.getAttribute('data-view')," +
  "format:a.getAttribute('data-format')},'*');" +
  "});})();<\/script>";

/**
 * A failure on a `/view/` path, as a page rather than as JSON.
 *
 * The `/view/` routes answer an iframe, and an iframe handed
 * `{"error":"no course run 'X' in this workspace"}` renders that as the literal
 * text of a JSON document. The sentence is the useful part; this puts it in a
 * page so the professor reads the sentence and not the braces around it. The
 * `/api/` paths keep JSON, because their caller is `fetch` and can read it.
 */
/**
 * The shell the two hand-drawn views share.
 *
 * The widget views are documents from `dsh-ainar-course-model` and bring their
 * own styling; these two have no widget behind them, so the chrome lives here.
 * Kept deliberately close to `sendErrorPage`'s: transparent background so the
 * pane's own surface shows through, system font, and a dark variant driven by
 * the `dark=1` the pane already passes to every view.
 */
const documentPage = (bodyHtml, dark) =>
  '<!doctype html><meta charset="utf-8">' +
  "<style>" +
  ":root{--fg:#1f1f1f;--dim:#6b6b6b;--line:#e3e3e3;--warn:#8a6d1f;--warnbg:#fdf6e3;" +
  "--info:#3a5f8a;--infobg:#eef2f8}" +
  (dark
    ? ":root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;--warn:#d8b55a;--warnbg:#2e2a1e;" +
      "--info:#8fb0d8;--infobg:#1e242e}"
    : "@media(prefers-color-scheme:dark){:root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;" +
      "--warn:#d8b55a;--warnbg:#2e2a1e;--info:#8fb0d8;--infobg:#1e242e}}") +
  "body{margin:0;padding:14px 16px;font:13px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;" +
  "color:var(--fg);background:transparent}" +
  "h2{font-size:13px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}" +
  "section{margin:0 0 18px}" +
  "p{margin:0 0 8px}" +
  ".dim{color:var(--dim)}" +
  // An identifier, wherever one sits beside a title. Monospaced rather than
  // merely dim, because `.dim` is the heading colour too and an id inside an
  // `h2` would otherwise be indistinguishable from the title it qualifies —
  // and the transforms are reset for the same reason: `text-transform` on a
  // heading must not reach a string the professor may have to type back.
  ".id{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dim);" +
  "text-transform:none;letter-spacing:0;font-weight:400}" +
  ".row{display:flex;gap:10px;justify-content:space-between;padding:5px 0;" +
  "border-bottom:1px solid var(--line)}" +
  ".row:last-child{border-bottom:none}" +
  ".k{min-width:0;overflow-wrap:anywhere}" +
  ".v{color:var(--dim);white-space:nowrap}" +
  ".todo{background:var(--warnbg);color:var(--warn);border-radius:3px;padding:0 5px;" +
  "font-size:12px;white-space:nowrap}" +
  // Drafted, not missing. A second badge rather than a second shade of the
  // TODO amber, because the two say opposite things about whose move it is:
  // amber is "nobody has written this", blue is "it is written and waiting for
  // you to approve it". One colour with two meanings would make the Checklist
  // unreadable at a glance, which is the only thing it is for.
  ".draft{background:var(--infobg);color:var(--info);border-radius:3px;padding:0 5px;" +
  "font-size:12px;white-space:nowrap}" +
  // The count row under a heading: `4 in the course · 2 drafted · 1 missing`.
  ".tally{color:var(--dim);font-size:12px;margin:0 0 6px}" +
  "code{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--warnbg);" +
  "color:var(--warn);border-radius:3px;padding:1px 5px}" +
  ".empty{border-left:3px solid var(--line);padding-left:10px;color:var(--dim)}" +
  // The filter row. Shaped after `pp-segbtn` in the browser half rather than
  // sharing it: that stylesheet belongs to the pane's own chrome and does not
  // reach inside a srcdoc frame, and one of the two had to own these five
  // lines.
  //
  // Not sticky, though a long class list argues for it. `body` here is
  // deliberately transparent so the pane's own surface shows through, and a
  // sticky bar needs an opaque background to be worth having — which would
  // mean guessing the pane's colour and painting a strip that does not quite
  // match it. A row that scrolls away beats a row that looks wrong.
  ".chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 10px}" +
  ".chip{font:inherit;font-size:11px;cursor:pointer;padding:2px 9px;border-radius:20px;" +
  "background:0 0;color:var(--dim);border:1px solid var(--line)}" +
  ".chip[aria-pressed=true]{color:var(--fg);font-weight:600;border-color:var(--fg)}" +
  // A link that opens a document. Shaped like the format buttons the Slides
  // list writes inline, and written here instead because two views now need
  // it — the same five declarations copied a third time is how the two halves
  // of one control start to drift apart.
  ".chip-link{color:inherit;text-decoration:none;border:1px solid var(--line);" +
  "border-radius:3px;padding:0 5px;font-size:11px;letter-spacing:.04em;white-space:nowrap}" +
  ".chip-link:hover{border-color:var(--fg)}" +
  "</style>" +
  bodyHtml;

/**
 * A value the professor has not filled in yet.
 *
 * The AINAR scaffolds write the literal string `TODO` into a record where a
 * decision is owed, and it reaches here as data. Drawing it as if it were a
 * grading policy would be worse than saying nothing: the pane would show a
 * course whose policy is "TODO" and look like it had one.
 */
const isTodo = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (typeof value === "string" && value.trim().toUpperCase() === "TODO");

const todoOr = (value) =>
  isTodo(value) ? '<span class="todo">not set yet</span>' : escapeText(String(value));

/**
 * The grading policy half of the Course outline tab.
 *
 * The arithmetic is NOT done here. `course_outline` already carries a `grading`
 * section — `total_weight`, which assessments carry no weight, whether the
 * scheme is complete, and a sentence when it is not — and this draws that.
 *
 * The first version of this function did the sum itself and got it wrong in the
 * way the model exists to prevent: `weight` is a FRACTION of one, so a perfectly
 * good scheme of 0.15 + 0.15 + 0.2 + 0.5 was rendered as "Total 1% — not 100"
 * and would have sent a professor to fix a course that was already correct.
 * Reading the model's own number cannot drift from what the Week-by-week view
 * beside it reports, which is the whole reason the pane is built this way.
 *
 * What is assembled here is only what no tool answers: the run's own
 * `extensions` — the written policy, the LMS target, the planned week count —
 * which are records of decisions rather than computations over them.
 */
const gradingDocument = (workspace, root, runId, dark, withDrafts, on) => {
  const data = withDrafts
    ? draftedPayload(workspace, root, "course_outline", runId, on).payload
    : payload(workspace, "course_outline", { course_version_id: runId });

  const bundle = workspace.findRun(runId);
  const run = runById(bundle).get(runId) ?? {};
  const extensions = run.extensions ?? {};
  const grading = data.grading ?? {};
  const assessments = Array.isArray(data.assessments) ? data.assessments : [];

  // `total_weight` is a fraction of one; the model reports it to a person as a
  // percentage, and so does this.
  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : "—";

  const policy =
    "<section><h2>Grading policy</h2><p>" +
    todoOr(extensions.grading_policy) +
    "</p></section>";

  const schedule = extensions.schedule ?? {};
  const facts =
    "<section><h2>The run</h2>" +
    [
      ["Term", run.term],
      ["Dates", run.start_date && run.end_date ? run.start_date + " → " + run.end_date : null],
      ["Status", run.status],
      ["Timezone", run.timezone],
      ["Planned weeks", schedule.weeks],
      ["LMS target", (extensions.lms ?? {}).target],
    ]
      .map(
        ([label, value]) =>
          '<div class="row"><span class="k">' +
          escapeText(label) +
          '</span><span class="v">' +
          todoOr(value) +
          "</span></div>",
      )
      .join("") +
    "</section>";

  const weights =
    "<section><h2>Weights</h2>" +
    (assessments.length === 0
      ? '<p class="empty">No assessment belongs to this run, so nothing carries a weight ' +
        "and there is no scheme to check. Drafting one is <code>/design-assessment</code>.</p>"
      : assessments
          .map(
            (row) =>
              '<div class="row"><span class="k">' +
              titleWithId(row) +
              '</span><span class="v">' +
              (row.weight === null || row.weight === undefined
                ? '<span class="todo">no weight</span>'
                : asPercent(row.weight)) +
              "</span></div>",
          )
          .join("") +
        '<div class="row"><span class="k"><strong>Total</strong></span><span class="v">' +
        (grading.complete === true
          ? asPercent(grading.total_weight)
          : '<span class="todo">' + asPercent(grading.total_weight) + "</span>") +
        "</span></div>") +
    "</section>";

  // The model's own sentence about what is wrong, rather than one invented
  // here. It names the assessments at fault, which a total cannot.
  const note = grading.note
    ? '<section><p class="empty">' + escapeText(grading.note) + "</p></section>"
    : "";

  return documentPage(policy + facts + weights + note, dark);
};

/**
 * The chip that opens a piece of graded work's brief, or the fact that there
 * is not one.
 *
 * A brief is not optional in the way a weight or a rubric is optional. A
 * weight the professor has not decided is a decision they can take next week;
 * work with no brief is work a student cannot start, so its absence is drawn
 * in the same amber the pane uses for every other hole rather than as a dash.
 *
 * `data-view` is the request to open it over the harness instead of in a tab,
 * and it is written only when the format is one the browser will paint —
 * `withMaterialLinks` decides that, and a `.docx` brief therefore keeps the
 * tab it always opened. See VIEW_SCRIPT.
 */
const briefChip = (assessment) => {
  const href = assessment.url;
  if (!href) return '<span class="todo">no brief</span>';
  // `open`, not the extension. The Slides list names formats — `PDF`, `PPTX` —
  // because a deck there exists in several and the label is the choice being
  // offered. A brief is one document, so its extension is not a choice, and
  // naming it would put `MD` on screen as though that meant something to the
  // person reading.
  return (
    '<a class="chip-link" href="' +
    escapeText(href) +
    '" target="_blank" rel="noopener"' +
    (assessment.viewable
      ? ' data-view="' +
        escapeText(assessment.title ?? assessment.assessment_id ?? "Brief") +
        '" data-format="' +
        escapeText(assessment.format ?? "") +
        '"'
      : "") +
    ">open</a>"
  );
};

/**
 * The three list views of the Course outline tab.
 *
 * Week by week answers "what happens when"; these answer "what have I got",
 * which is a different question and was previously only answerable by scrolling
 * sixteen weeks and holding the answer in your head.
 *
 * All three read the SAME `course_outline` payload the week view does, and none
 * of them computes a figure. A weight shown here and a weight shown there are
 * one number from one command — the first version of `gradingDocument` did its
 * own arithmetic and reported a correct scheme as broken, and that is the
 * mistake this whole pane is shaped to avoid.
 */

/** `2026-09-18T09:00:00+05:00` as `2026-09-18 09:00`, in the run's own offset. */
const stamp = (value) => {
  const text = String(value ?? "");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(text);
  if (!match) return text.slice(0, 10);
  // Sliced, not parsed: `new Date(...)` would re-render this in the machine's
  // timezone, and a deadline is a claim in the course's.
  return `${match[1]} ${match[2]}`;
};

const outlinePayloadFor = (workspace, root, runId, withDrafts, on) =>
  withDrafts
    ? draftedPayload(workspace, root, "course_outline", runId, on).payload
    : payload(workspace, "course_outline", { course_version_id: runId });

const rows = (entries) =>
  entries
    .map(
      ([key, value]) =>
        '<div class="row"><span class="k">' + key + '</span><span class="v">' + value + "</span></div>",
    )
    .join("");

/**
 * Every piece of graded work, in the order it falls due.
 *
 * Undated work sorts last rather than first, which is what `""` would do: a
 * deadline nobody has set is not a deadline in January.
 */
const assessmentsDocument = (
  workspace,
  root,
  runId,
  dark,
  withDrafts,
  on,
  origin,
  sessionId,
) => {
  const data = withMaterialLinks(
    outlinePayloadFor(workspace, root, runId, withDrafts, on),
    origin,
    sessionId,
    workspace,
    dark,
    withDrafts,
  );
  const all = Array.isArray(data.assessments) ? [...data.assessments] : [];
  all.sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : null;

  const body =
    all.length === 0
      ? '<p class="empty">No assessment belongs to this run yet. Drafting one is ' +
        "<code>/design-assessment</code>.</p>"
      : all
          .map((row) => {
            const weight = asPercent(row.weight);
            const detail = [
              row.type ? escapeText(row.type) : null,
              row.criteria ? escapeText(String(row.criteria)) + " criteria" : null,
              row.outcomes ? escapeText(row.outcomes) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              '<div class="row"><span class="k">' +
              titleWithId(row) +
              (detail ? '<br><span class="dim">' + detail + "</span>" : "") +
              '</span><span class="v">' +
              (weight === null ? '<span class="todo">no weight</span>' : weight) +
              "<br>" +
              (row.due_on
                ? '<span class="dim">due ' + escapeText(row.due_on) + "</span>"
                : '<span class="todo">no date</span>') +
              // The brief on its own line, under the weight and the date. Not
              // beside the title: a course whose homework is titled "Homework"
              // four times over already leans on the id to tell the rows
              // apart, and a link in the middle of that is one more thing to
              // read before finding the one you meant.
              "<br>" +
              briefChip(row) +
              "</span></div>"
            );
          })
          .join("");

  return documentPage(
    "<section><h2>Assessments</h2>" + body + VIEW_SCRIPT + "</section>",
    dark,
  );
};

/**
 * Every deck in the term, with the formats each exists in.
 *
 * A `Resource` carries no week of its own — the only join is the activity that
 * uses it — so these are gathered by walking the weeks rather than by reading a
 * resource list, and a deck attached to no meeting does not appear here at all.
 * That is the model's shape, not an omission: an unattached deck is not yet
 * part of any class.
 */
const slidesDocument = (workspace, root, runId, dark, withDrafts, on, origin, sessionId) => {
  let data = outlinePayloadFor(workspace, root, runId, withDrafts, on);
  data = withMaterialLinks(data, origin, sessionId, workspace, dark, withDrafts);

  const found = [];
  for (const week of data.weeks ?? []) {
    for (const meeting of week.meetings ?? []) {
      for (const resource of meeting.resources ?? []) {
        if (resource.kind !== "slides") continue;
        found.push({ week: week.week, title: resource.title, resource });
      }
    }
  }

  // `title` is what the overlay would be called; a null one is a format the
  // browser would only download, and the anchor is left as the tab it always
  // was. See VIEW_SCRIPT, and SHOWABLE for which formats those are.
  // `target` matters more here than it looks: this page is delivered into a
  // frame with an opaque origin, and such a frame may not navigate itself, so
  // a same-tab link was a link that did nothing at all. The frame is granted
  // `allow-popups-to-escape-sandbox` for exactly this.
  const link = (href, label, title, format) =>
    '<a href="' + escapeText(href) + '" target="_blank" rel="noopener"' +
    (title === null
      ? ""
      : ' data-view="' + escapeText(title) + '" data-format="' + escapeText(format ?? "") + '"') +
    ' style="color:inherit;text-decoration:none;' +
    "border:1px solid var(--line);border-radius:3px;padding:0 5px;margin-left:4px;" +
    'font-size:11px;letter-spacing:.04em">' + escapeText(label) + "</a>";

  const body =
    found.length === 0
      ? '<p class="empty">No meeting in this run carries a deck. A deck reaches this list ' +
        "by being a <code>slides</code> resource on a learning activity.</p>"
      : found
          .map((entry) => {
            const formats = (entry.resource.formats ?? [])
              .filter((format) => format.url)
              .map((format) =>
                link(
                  format.url,
                  format.label,
                  format.viewable ? (entry.title ?? "Slides") + " · " + format.label : null,
                  format.format,
                ),
              )
              .join("");
            return (
              '<div class="row"><span class="k">' +
              '<span class="dim">week ' + escapeText(String(entry.week)) + "</span> " +
              escapeText(entry.title ?? "untitled") +
              '</span><span class="v">' +
              (formats ||
                (entry.resource.url
                  ? link(
                      entry.resource.url,
                      "open",
                      entry.resource.viewable ? (entry.title ?? "Slides") : null,
                      entry.resource.format,
                    )
                  : '<span class="todo">no file</span>')) +
              "</span></div>"
            );
          })
          .join("");

  return documentPage("<section><h2>Slides</h2>" + body + VIEW_SCRIPT + "</section>", dark);
};

/**
 * The sit-down assessments, with what a professor checks before setting one.
 *
 * `exam` only. A quiz is graded work and belongs on the Assessments list; an
 * exam is the one a room has to be booked for, and the questions asked of it —
 * is it written, is it weighted, does a rubric exist — are asked weeks earlier
 * than for anything else. Filtering by the model's own `type` rather than by a
 * title convention means renaming "Midterm Exam 1" does not move it.
 */
const examsDocument = (workspace, root, runId, dark, withDrafts, on, origin, sessionId) => {
  const data = withMaterialLinks(
    outlinePayloadFor(workspace, root, runId, withDrafts, on),
    origin,
    sessionId,
    workspace,
    dark,
    withDrafts,
  );
  const bundle = withDrafts
    ? null
    : workspace.findRun(runId);
  const exams = (Array.isArray(data.assessments) ? data.assessments : []).filter(
    (row) => row.type === "exam",
  );

  // Item counts come from the bundle, because the outline payload carries a
  // criteria count and not an item count. Absent when the drafted view is on
  // rather than wrong: a merged bundle is not what `findRun` returns.
  const itemsById = new Map();
  if (bundle) {
    for (const item of bundle.items ?? []) {
      const key = item.assessment_id;
      if (key) itemsById.set(key, (itemsById.get(key) ?? 0) + 1);
    }
  }

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : null;

  const body =
    exams.length === 0
      ? '<p class="empty">No assessment in this run has <code>type: exam</code>. ' +
        "Quizzes and assignments are on the Assessments list.</p>"
      : exams
          .map((row) => {
            const weight = asPercent(row.weight);
            const count = itemsById.get(row.assessment_id);
            return (
              "<section><h2>" +
              titleWithId(row) +
              "</h2>" +
              rows([
                ["When", row.due_on ? escapeText(row.due_on) : '<span class="todo">no date</span>'],
                ["Weight", weight === null ? '<span class="todo">no weight</span>' : weight],
                // First among the things that have to exist, because it is the
                // one a room full of students will be handed. An exam with
                // items written and no paper registered is the failure this
                // row is here to make visible weeks earlier.
                ["Paper", briefChip(row)],
                [
                  "Questions",
                  count === undefined
                    ? '<span class="dim">—</span>'
                    : count === 0
                      ? '<span class="todo">none written</span>'
                      : String(count),
                ],
                [
                  "Rubric criteria",
                  row.criteria ? escapeText(String(row.criteria)) : '<span class="dim">—</span>',
                ],
                ["Outcomes", row.outcomes ? escapeText(row.outcomes) : '<span class="dim">—</span>'],
              ]) +
              "</section>"
            );
          })
          .join("");

  return documentPage(body + VIEW_SCRIPT, dark);
};

/**
 * A backup, not a proposal.
 *
 * The scaffolds write `modules-draft.yaml.bak-20260903-171431`, so the stamp is
 * two dash-separated groups rather than one — the first version of this matched
 * `.bak-<digits>` and let that file through, putting a backup on screen beside
 * the draft it backs up: two entries for one decision.
 */
const isBackup = (name) => /\.bak(\b|[-.]|$)/i.test(name);

/** Every entry one level down, as {name, directory, when}. */
const filesIn = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push({ name: entry.name, directory: true, when: "" });
      continue;
    }
    if (isBackup(entry.name)) continue;
    let when = "";
    try {
      when = statSync(join(dir, entry.name)).mtime.toISOString().slice(0, 10);
    } catch {
      when = "";
    }
    files.push({ name: entry.name, directory: false, when });
  }
  return files;
};

/**
 * The "Ready" half of the Tasks tab: what has been prepared, and what it is.
 *
 * The Pending half is `action_inbox`, which reads the RECORD — pending
 * evaluations, open signals, interventions. That is the right answer to "what is
 * waiting on my judgement about work students did", and it is empty for a course
 * nobody has taught yet: correct, and useless to a professor who has a term of
 * material drafted and wants to know what they have.
 *
 * So this half answers a different question — what is prepared? — and it answers
 * it in the vocabulary a professor thinks in: weeks, quizzes, an exam, lecture
 * decks. Not filenames. A directory listing was the first version of this and it
 * was wrong in a specific way: `quiz-quiz-03-student.pdf` is not a task, and
 * "materials/ 117 files" hid the seven lecture decks inside it.
 *
 * Two sources, deliberately kept apart on screen, because they are two different
 * kinds of thing and only one of them can be approved:
 *
 *   1. DRAFT RECORDS — `loadDrafts` parses `work/<RUN>/*.yaml` into the model's
 *      own collections. These are what `ainar approve` promotes into the course.
 *   2. FILES — decks, printed papers, figures sitting in `materials/`. Real work,
 *      but not records: approving the drafts does not put a .pptx anywhere.
 *
 * Against both, what the course record actually holds — which is the "what should
 * I do" of the whole tab. Fifteen drafted weeks against zero recorded ones is a
 * sentence about what to do next; fifteen drafted weeks alone is trivia.
 *
 * On parsing: an earlier version refused to parse, on the grounds that a
 * malformed draft would break the tab at the moment the professor most needed to
 * see it. `loadDrafts` removes that objection — it collects complaints into an
 * `IssueList` instead of throwing — so the parse is safe AND the complaints are
 * shown, which is strictly better than hiding the file.
 */

/** What a drafted collection is called in a sentence, singular and plural. */
const DRAFT_KINDS = [
  { key: "modules", one: "Week", many: "Weeks", record: "modules" },
  { key: "concepts", one: "Concept", many: "Concepts", record: "concepts" },
  { key: "assessments", one: "Assessment", many: "Assessments", record: "assessments" },
  { key: "items", one: "Assessment item", many: "Assessment items", record: "items" },
  { key: "activities", one: "Meeting", many: "Meetings", record: "activities" },
  { key: "documents", one: "Document", many: "Documents", record: "documents" },
  { key: "resources", one: "Resource", many: "Resources", record: "resources" },
];

/** Files in `materials/`, by the kind of thing they are. */
const MATERIAL_KINDS = [
  { label: "Lecture decks", test: /\.pptx$/i },
  { label: "Printed papers", test: /\.(docx|pdf)$/i },
  { label: "Figures", test: /\.(svg|png|jpe?g)$/i },
  { label: "Build scripts", test: /\.(py|mjs|js)$/i },
  { label: "Notes and data", test: /\.(md|markdown|json|ndjson|txt|ya?ml)$/i },
];

/**
 * How a `type` value is said in a sentence.
 *
 * An explicit table rather than a pluralising rule, because both enums are
 * CLOSED sets — `AssessmentType` and `ItemType` in the model — so every value
 * that can appear is known and can simply be written down. A rule got this
 * wrong on the first run in exactly the way rules do: it rendered six quizzes as
 * "6 quizs" and ten numeric items as "10 numerics".
 *
 * The fallback is the SINGULAR with underscores opened up, never a guessed
 * plural: an unknown type reading "3 oral defense" is a little stiff, while
 * "3 oral defenses" would be this function inventing English it does not know.
 */
const TYPE_WORDS = {
  // AssessmentType
  assignment: "assignments",
  quiz: "quizzes",
  exam: "exams",
  project: "projects",
  presentation: "presentations",
  oral_defense: "oral defences",
  participation: "participation",
  // ItemType
  multiple_choice: "multiple-choice",
  multiple_select: "multiple-select",
  true_false: "true/false",
  short_answer: "short answer",
  numeric: "numeric",
  essay: "essays",
  code: "code",
  practical: "practicals",
  other: "other",
};

const saidAs = (type, count) => {
  if (count === 1) return type.replace(/_/g, " ");
  return TYPE_WORDS[type] ?? type.replace(/_/g, " ");
};

/** `6 quizzes, 1 exam, 1 assignment` — the breakdown, in count order. */
const byType = (rows) => {
  const tally = new Map();
  for (const row of rows) {
    const type = typeof row.type === "string" && row.type ? row.type : null;
    if (type === null) continue;
    tally.set(type, (tally.get(type) ?? 0) + 1);
  }
  if (tally.size === 0) return "";
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => count + " " + saidAs(type, count))
    .join(", ");
};

/** One row: what it is, how much of it is drafted, and whether the course has any. */
const readyRow = (label, drafted, detail, recorded) =>
  '<div class="row"><span class="k">' +
  escapeText(label) +
  (detail ? ' <span class="dim">' + escapeText(detail) + "</span>" : "") +
  '</span><span class="v">' +
  drafted +
  " drafted" +
  (recorded === null
    ? ""
    : recorded === 0
      ? ' · <span class="todo">none in the course</span>'
      : ' · <span class="dim">' + recorded + " in the course</span>") +
  "</span></div>";

const readyDocument = (workspace, root, runId, dark) => {
  const dir = join(root, "work", runId);
  const issues = new IssueList();
  const drafted = loadDrafts(dir, issues);

  // `draft.missing` is not a fault to report as one: a run nobody has drafted
  // for is the ordinary state of a new course, and the empty page below says so
  // better than an error would.
  const missing = issues.errors.some((issue) => issue.code === "draft.missing");

  // What the course itself holds, to sit beside each drafted count. Loading it
  // is allowed to fail — a course whose offering does not parse still has a work
  // directory worth listing — and the columns simply go quiet when it does.
  let record = null;
  try {
    const bundle = workspace.findRun(runId);
    record = {};
    for (const kind of DRAFT_KINDS) {
      const rows = bundle[kind.record];
      record[kind.key] = Array.isArray(rows) ? rows.length : 0;
    }
  } catch {
    record = null;
  }

  const rows = DRAFT_KINDS.map((kind) => {
    const items = Array.isArray(drafted[kind.key]) ? drafted[kind.key] : [];
    if (items.length === 0) return "";
    return readyRow(
      items.length === 1 ? kind.one : kind.many,
      items.length,
      byType(items),
      record === null ? null : record[kind.key],
    );
  })
    .filter(Boolean)
    .join("");

  let body =
    rows === ""
      ? ""
      : "<section><h2>Prepared, awaiting approval</h2>" +
        '<p class="dim">Drafted into <code>work/</code> by the skills. ' +
        "<code>ainar approve</code> puts them in the course.</p>" +
        rows +
        "</section>";

  // The files. Counted by kind rather than listed, because the question here is
  // "have I got slides for this course", not "what is every filename".
  const materials = filesIn(join(dir, "materials"));
  if (materials !== null) {
    const files = materials.filter((entry) => !entry.directory && !isBackup(entry.name));
    const counted = MATERIAL_KINDS.map((kind) => ({
      label: kind.label,
      count: files.filter((file) => kind.test.test(file.name)).length,
    })).filter((kind) => kind.count > 0);

    if (counted.length) {
      body +=
        "<section><h2>Prepared as files</h2>" +
        '<p class="dim">In <code>materials/</code>. Real work, but not records — ' +
        "approving the drafts does not move these.</p>" +
        counted
          .map(
            (kind) =>
              '<div class="row"><span class="k">' +
              escapeText(kind.label) +
              '</span><span class="v">' +
              kind.count +
              "</span></div>",
          )
          .join("") +
        "</section>";
    }
  }

  // Complaints from the parse, said plainly. A draft the loader refused is the
  // one thing on this page the professor can act on immediately.
  const complaints = issues.items.filter((issue) => issue.code !== "draft.missing");
  if (complaints.length) {
    body +=
      "<section><h2>Needs fixing (" +
      complaints.length +
      ")</h2>" +
      complaints
        .slice(0, 12)
        .map(
          (issue) =>
            '<div class="row"><span class="k">' +
            escapeText(issue.message ?? issue.code) +
            '</span><span class="v">' +
            escapeText(issue.location ?? issue.level ?? "") +
            "</span></div>",
        )
        .join("") +
      "</section>";
  }

  if (body === "") {
    return documentPage(
      '<section><h2>Ready</h2><p class="empty">' +
        (missing
          ? "Nothing has been drafted for " +
            escapeText(runId) +
            ". Skills write their proposals to <code>work/" +
            escapeText(runId) +
            "</code>, and this lists them once they do."
          : "The work directory for " +
            escapeText(runId) +
            " exists but holds nothing the model recognises yet.") +
        "</p></section>",
      dark,
    );
  }

  // The closing sentence changes with the answer: a course that has approved
  // nothing needs a different next step from one that is partly in.
  const anythingRecorded =
    record !== null && Object.values(record).some((count) => count > 0);
  body +=
    '<section><p class="dim">' +
    (anythingRecorded
      ? "Some of this course is already recorded. <code>ainar approve</code> promotes what is not."
      : "None of this is in the course record yet, so nothing here reaches a student. " +
        "<code>ainar approve</code> is the step that changes that, and it is yours to run.") +
    "</p></section>";

  return documentPage(body, dark);
};

/**
 * A count that exists in two halves.
 *
 * `recorded` is what `courses/` holds. `merged` is what it would hold if every
 * proposal in `work/<RUN>/` were approved. The drafted half is the difference
 * rather than a count of the draft files, because `mergeDrafts` is what decides
 * whether a proposal actually lands — `DRAFTABLE` refuses whole collections —
 * and a draft the merge threw away must not be reported here as work in hand.
 */
const split = (recorded, merged) => ({
  recorded,
  drafted: Math.max(0, merged - recorded),
  state: recorded > 0 ? "done" : merged > 0 ? "draft" : "todo",
});

const countOf = (value) => (Array.isArray(value) ? value.length : 0);

/** Every week's slide decks, by week number, from one outline payload. */
const decksByWeek = (data) => {
  const found = new Map();
  for (const week of data.weeks ?? []) {
    for (const meeting of week.meetings ?? []) {
      for (const resource of meeting.resources ?? []) {
        if (resource.kind !== "slides") continue;
        const list = found.get(week.week) ?? [];
        list.push(resource);
        found.set(week.week, list);
      }
    }
  }
  return found;
};

/**
 * What is not finished in one run, and whose move each thing is.
 *
 * Four questions, which is what the professor actually asks of a course they
 * are still building: what has not been created, what carries no deadline, do
 * the weights come to 100%, and is each week's deck written or only proposed.
 *
 * **Nothing is recomputed here that the model already computes.** The weights
 * come out of `course_outline`'s own `grading` section — `total_weight`,
 * `unweighted`, `complete`, and the sentence it writes when something is wrong
 * — for the reason `gradingDocument`'s header gives at length: an earlier
 * version of that view did the arithmetic itself, forgot that `weight` is a
 * fraction of one, and told a professor their correct scheme was "1%, not
 * 100". Two views disagreeing about a number is the failure this whole pane is
 * shaped to avoid, and a checklist that says "incomplete" while the Grading
 * policy tab says "100%" would be the worst instance of it. Likewise the
 * counts: `totals` is the payload's, and the deadline column is `due_on` as
 * the outline reports it.
 *
 * **Both halves, always.** Like `ready`, this view does not take the Record /
 * `+ drafts` toggle — it loads the record AND the merge and reports the
 * difference, because "written, or only proposed" is the question rather than
 * a setting. A toggle that hid one column would remove the answer.
 *
 * Returns data, not HTML. The document is rendered per request because `dark`
 * varies with the professor's theme; the report does not, so it is the half
 * worth caching. See `checklistFor`.
 */
const checklistReport = (workspace, root, runId) => {
  const record = payload(workspace, "course_outline", { course_version_id: runId });

  // A run nobody has drafted for merges to itself, which is the right answer:
  // every drafted count comes out zero and every row reads "in the course".
  let merged = record;
  try {
    merged = draftedPayload(workspace, root, "course_outline", runId, null).payload;
  } catch {
    // The record loaded, so the run is real; only the draft directory failed.
    // `ready` is the view that reports draft-loading complaints, and it says
    // more about them than a line here could.
    merged = record;
  }

  // Roles, not head count: `enrollments` is refused in a draft file, so this
  // has no drafted half and is read from the bundle rather than a payload.
  let enrolled = null;
  try {
    enrolled = enrollmentsOf(workspace.findRun(runId), runId).filter(
      (entry) => ["student", "auditor"].includes(entry.role) && entry.status === "active",
    ).length;
  } catch {
    enrolled = null;
  }

  const recordTotals = record.totals ?? {};
  const mergedTotals = merged.totals ?? {};
  const at = (totals, key) => (typeof totals[key] === "number" ? totals[key] : 0);

  const withRubric = (data) =>
    (data.assessments ?? []).filter((row) => (row.criteria ?? 0) > 0).length;

  const structure = [
    {
      label: "Learning outcomes",
      piece: split(countOf(record.outcomes), countOf(merged.outcomes)),
      hint: "/propose-concepts",
    },
    {
      label: "Weekly modules",
      piece: split(at(recordTotals, "modules"), at(mergedTotals, "modules")),
      hint: "/plan-term",
    },
    {
      label: "Meetings scheduled",
      piece: split(at(recordTotals, "meetings"), at(mergedTotals, "meetings")),
      hint: "/plan-term",
    },
    {
      label: "Assessments",
      piece: split(at(recordTotals, "assessments"), at(mergedTotals, "assessments")),
      hint: "/design-assessment",
    },
    {
      label: "Assessments with a rubric",
      piece: split(withRubric(record), withRubric(merged)),
      hint: "/design-assessment",
      of: at(mergedTotals, "assessments"),
    },
  ];

  // Two things `versions` owns, and `versions` is not draftable — so these are
  // present or absent, never proposed, and a "drafted" column against them
  // would be a column that can only ever read zero.
  const fixed = [
    { label: "Instructor named", have: countOf(record.run?.instructors), hint: "version.yaml" },
    { label: "Students enrolled", have: enrolled, hint: "ainar roster import" },
  ];

  const weeksPlanned = {
    planned: at(mergedTotals, "weeks_planned"),
    total: at(mergedTotals, "weeks"),
  };

  // Weeks that hold a meeting. A week with none has no class to write a deck
  // for, and counting it as a missing deck would report the same hole twice —
  // once here and once as "Meetings scheduled".
  const meetingWeeks = (merged.weeks ?? []).filter((week) => (week.meetings ?? []).length > 0);

  const recordDecks = decksByWeek(record);
  const mergedDecks = decksByWeek(merged);

  const slides = meetingWeeks.map((week) => {
    const recorded = (recordDecks.get(week.week) ?? []).length;
    const all = mergedDecks.get(week.week) ?? [];
    return {
      week: week.week,
      title: (week.modules ?? [])[0]?.title ?? null,
      recorded,
      drafted: Math.max(0, all.length - recorded),
      // Registered as a resource with nothing behind it: no file to open and
      // no document to serve. `resource.no_location` is the validator's name
      // for it, and it is the difference between a deck that exists and a deck
      // somebody meant to make.
      unlocated: all.filter((resource) => !resource.url && !resource.document_id).length,
      state: recorded > 0 ? "done" : all.length > 0 ? "draft" : "todo",
    };
  });

  // Undated work, read off the merge so a drafted assessment with no deadline
  // is caught before it is approved rather than after.
  const recordedIds = new Set((record.assessments ?? []).map((row) => row.assessment_id));

  // `unplaced` is the outline's own word for a record that lands in no week.
  // For an assessment that means neither an in-run date nor a module to inherit
  // a week from — so an undated one is usually here too, and the two faults are
  // reported together on its own row rather than as a second anonymous count
  // under another heading. What is left over is the different fault: work with
  // a date that falls outside the run.
  const unplacedIds = new Set(
    (merged.unplaced?.assessments ?? []).map((row) => row.assessment_id),
  );

  const undated = (merged.assessments ?? [])
    .filter((row) => !row.due_on)
    .map((row) => ({
      assessment_id: row.assessment_id,
      title: row.title ?? row.assessment_id ?? "untitled",
      type: row.type ?? null,
      drafted: !recordedIds.has(row.assessment_id),
      // No module either, so nothing places it in a week: the deadline is the
      // fix for both, which is why it is said here and not twice.
      unplaced: unplacedIds.has(row.assessment_id),
    }));

  const undatedIds = new Set(undated.map((row) => row.assessment_id));

  return {
    structure,
    fixed,
    weeksPlanned,
    unplaced: {
      modules: countOf(merged.unplaced?.modules),
      meetings: countOf(merged.unplaced?.meetings),
      assessments: [...unplacedIds].filter((id) => !undatedIds.has(id)).length,
    },
    slides,
    undated,
    dated: countOf(merged.assessments) - undated.length,
    grading: { record: record.grading ?? {}, merged: merged.grading ?? {} },
    // True when the merge added nothing, which is the ordinary state of a
    // course whose proposals have all been approved. The page drops its
    // "drafted" language entirely in that case rather than printing a column
    // of zeroes.
    anyDrafted:
      structure.some((entry) => entry.piece.drafted > 0) ||
      slides.some((entry) => entry.drafted > 0) ||
      undated.some((entry) => entry.drafted),
  };
};

/**
 * The report, computed at most once per change to the workspace.
 *
 * `checklistReport` is the most expensive thing this file does: it builds the
 * outline payload twice — once over the record, once over the record with
 * `work/<RUN>/` merged — and the merge re-parses the draft directory. Doing
 * that on every frame load would be paying a course parse for a page whose
 * answer cannot change until a file does.
 *
 * The key is the revision hash the pane ALREADY computes for its own refresh
 * poll: name, size and mtime of every YAML under `courses/` and `work/`. That
 * makes the cache exactly as fresh as the pane itself — the same hash that
 * tells the browser to reload the frame is the one that invalidates what the
 * frame is about to be served, so there is no window in which the pane redraws
 * and gets the previous answer back.
 *
 * Capped and evicted oldest-first. A professor switches between a handful of
 * runs, so the cap is never reached in practice; it is here so that a long
 * session driving many runs cannot grow the map without bound.
 */
const CHECKLIST_CACHE_MAX = 24;
const CHECKLISTS = new Map();

const checklistFor = (workspace, root, runId) => {
  const key = root + "\u0000" + runId;
  const { revision } = revisionDocument(root);

  const found = CHECKLISTS.get(key);
  if (found && found.revision === revision) return found.report;

  const report = checklistReport(workspace, root, runId);
  CHECKLISTS.set(key, { revision, report });
  if (CHECKLISTS.size > CHECKLIST_CACHE_MAX) {
    // Insertion order is Map's own guarantee, so the first key is the oldest.
    CHECKLISTS.delete(CHECKLISTS.keys().next().value);
  }
  return report;
};

/** `4 in the course · 2 drafted`, or the amber badge when there is neither. */
const countValue = (piece, none) => {
  const parts = [];
  if (piece.recorded > 0) {
    parts.push('<span class="dim">' + piece.recorded + " in the course</span>");
  }
  if (piece.drafted > 0) {
    parts.push('<span class="draft">' + piece.drafted + " drafted</span>");
  }
  return parts.length ? parts.join(" · ") : '<span class="todo">' + escapeText(none) + "</span>";
};

const checkRowHtml = (labelHtml, hint, value) =>
  '<div class="row"><span class="k">' +
  labelHtml +
  (hint ? '<br><span class="dim">' + escapeText(hint) + "</span>" : "") +
  '</span><span class="v">' +
  value +
  "</span></div>";

/**
 * A row whose label is text. The common case, and the safe one.
 *
 * Only `checkRowHtml` takes markup, and only one caller does — the deadline
 * list, which needs `titleWithId`. Everything else keeps a signature that
 * cannot be handed an unescaped course title by accident.
 */
const checkRow = (label, hint, value) => checkRowHtml(escapeText(label), hint, value);

/**
 * The Checklist tab: the four questions a course under construction raises.
 *
 * Every figure on this page comes from `checklistReport`, which takes them from
 * `course_outline`. Nothing is computed in the rendering.
 */
const checklistDocument = (workspace, root, runId, dark) => {
  const report = checklistFor(workspace, root, runId);

  const asPercent = (fraction) =>
    typeof fraction === "number" ? Math.round(fraction * 1000) / 10 + "%" : "—";

  // ---- What has not been created ----------------------------------------

  const structureRows = report.structure
    .map((entry) => {
      const value =
        entry.of !== undefined && entry.piece.recorded + entry.piece.drafted > 0
          ? countValue(entry.piece, "none") +
            ' <span class="dim">of ' +
            entry.of +
            "</span>"
          : countValue(entry.piece, "none");
      return checkRow(entry.label, entry.piece.state === "todo" ? entry.hint : "", value);
    })
    .join("");

  const fixedRows = report.fixed
    .map((entry) =>
      checkRow(
        entry.label,
        entry.have ? "" : entry.hint,
        entry.have === null
          ? '<span class="dim">—</span>'
          : entry.have > 0
            ? '<span class="dim">' + entry.have + "</span>"
            : '<span class="todo">none</span>',
      ),
    )
    .join("");

  const { planned, total } = report.weeksPlanned;
  const weeksRow = checkRow(
    "Weeks with a module",
    planned < total ? "/plan-term places a module in each" : "",
    total === 0
      ? '<span class="todo">the run has no weeks</span>'
      : '<span class="' +
        (planned === total ? "dim" : "todo") +
        '">' +
        planned +
        " of " +
        total +
        "</span>",
  );

  // Created but attached to nothing, which is a different fault from missing
  // and has a different fix: the record exists, and the week it belongs in is
  // what is absent.
  const UNPLACED_NOUNS = { modules: "module", meetings: "meeting", assessments: "assessment" };
  const unplaced = Object.entries(report.unplaced).filter(([, count]) => count > 0);
  const unplacedRow = unplaced.length
    ? checkRow(
        "Created but not placed",
        "no week, or dated outside the run",
        unplaced
          .map(
            ([kind, count]) =>
              '<span class="todo">' +
              count +
              " " +
              escapeText(UNPLACED_NOUNS[kind]) +
              (count === 1 ? "" : "s") +
              "</span>",
          )
          .join(" "),
      )
    : "";

  const notCreated =
    "<section><h2>What is not created</h2>" +
    structureRows +
    weeksRow +
    fixedRows +
    unplacedRow +
    "</section>";

  // ---- Deadlines ---------------------------------------------------------

  const deadlines =
    "<section><h2>Deadlines</h2>" +
    (report.undated.length === 0
      ? report.dated === 0
        ? '<p class="empty">There is no graded work in this run yet, so there is nothing ' +
          "to give a date to. Drafting one is <code>/design-assessment</code>.</p>"
        : '<p class="dim">All ' +
          report.dated +
          " pieces of graded work carry a due date.</p>"
      : '<p class="tally">' +
        report.undated.length +
        " of " +
        (report.dated + report.undated.length) +
        " carry no due date. A deadline is the professor's to set — " +
        "no skill writes one.</p>" +
        report.undated
          .map((entry) =>
            checkRowHtml(
              titleWithId(entry),
              [entry.type, entry.unplaced ? "no module either, so no week holds it" : null]
                .filter(Boolean)
                .join(" · "),
              '<span class="todo">no deadline</span>' +
                (entry.drafted ? ' <span class="draft">drafted</span>' : ""),
            ),
          )
          .join("")) +
    "</section>";

  // ---- Weights -----------------------------------------------------------
  //
  // `total_weight` is a fraction of one and `complete` is the model's own
  // verdict on it. Neither is recomputed here; `note` is the model's sentence,
  // which names the assessments at fault in a way a percentage cannot.

  const scheme = report.grading.record;
  const withDrafts = report.grading.merged;
  const differs = scheme.total_weight !== withDrafts.total_weight;

  const weights =
    "<section><h2>Weights</h2>" +
    checkRow(
      "Declared in the course",
      "",
      scheme.complete === true
        ? '<span class="dim">' + asPercent(scheme.total_weight) + "</span>"
        : '<span class="todo">' + asPercent(scheme.total_weight) + " of 100%</span>",
    ) +
    (differs
      ? checkRow(
          "If every draft were approved",
          "",
          withDrafts.complete === true
            ? '<span class="draft">' + asPercent(withDrafts.total_weight) + "</span>"
            : '<span class="todo">' + asPercent(withDrafts.total_weight) + " of 100%</span>",
        )
      : "") +
    ((withDrafts.unweighted ?? []).length
      ? checkRow(
          "Carrying no weight",
          "",
          '<span class="todo">' + withDrafts.unweighted.length + "</span>",
        )
      : "") +
    (withDrafts.note ? '<p class="empty">' + escapeText(withDrafts.note) + "</p>" : "") +
    "</section>";

  // ---- Slides ------------------------------------------------------------

  const missingDecks = report.slides.filter((entry) => entry.state === "todo").length;
  const draftedDecks = report.slides.filter((entry) => entry.state === "draft").length;
  const readyDecks = report.slides.filter((entry) => entry.state === "done").length;

  const slides =
    "<section><h2>Slides</h2>" +
    (report.slides.length === 0
      ? '<p class="empty">No week in this run holds a meeting, so there is nowhere for a ' +
        "deck to attach. A deck reaches this list by being a <code>slides</code> resource " +
        "on a learning activity.</p>"
      : '<p class="tally">' +
        readyDecks +
        " ready · " +
        draftedDecks +
        " drafted · " +
        missingDecks +
        " with no deck, over " +
        report.slides.length +
        " weeks that meet.</p>" +
        report.slides
          .map((entry) =>
            checkRow(
              "Week " + entry.week + (entry.title ? " · " + entry.title : ""),
              "",
              entry.state === "todo"
                ? '<span class="todo">no deck</span>'
                : (entry.recorded > 0
                    ? '<span class="dim">' + entry.recorded + " in the course</span>"
                    : "") +
                  (entry.drafted > 0
                    ? (entry.recorded > 0 ? " · " : "") +
                      '<span class="draft">' +
                      entry.drafted +
                      " drafted</span>"
                    : "") +
                  (entry.unlocated > 0
                    ? ' <span class="todo">' + entry.unlocated + " with no file</span>"
                    : ""),
            ),
          )
          .join("")) +
    "</section>";

  // The closing sentence, which changes with the answer: a course whose gaps
  // are all drafted needs `ainar approve`, and one whose gaps are empty needs a
  // skill run. Saying both every time would say neither.
  const closing =
    '<section><p class="dim">' +
    (report.anyDrafted
      ? "Blue is written and waiting for you — <code>ainar approve</code> puts it in the " +
        "course. Amber is not written yet."
      : "Nothing is drafted for this run, so every amber row above needs a skill run " +
        "rather than an approval.") +
    "</p></section>";

  return documentPage(notCreated + deadlines + weights + slides + closing, dark);
};

/**
 * The bundle owning a run, WITH the complaints its load produced.
 *
 * `workspace.findRun` hands back the bundle alone, which is all the widget
 * views need. The class list needs the complaints too: whether enrollments are
 * absent, refused or synthetic is the difference between three very different
 * sentences, and the loader says which in an issue rather than in the data.
 */
const loadedRun = (workspace, runId) => {
  for (const courseId of workspace.courseIds()) {
    try {
      const loaded = workspace.load(courseId);
      if (runById(loaded.bundle).has(runId)) return loaded;
    } catch {
      // A course that will not load cannot be the one owning this run, and its
      // error would replace the run's own. `draftedPayload` skips the same way.
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
const rosterDir = () => {
  const configured = (process.env.AINAR_ROSTER_DIR || "").trim();
  return configured
    ? resolve(configured.startsWith("~") ? join(homedir(), configured.slice(1)) : configured)
    : join(homedir(), ".ainar", "roster");
};

const rosterPath = () => join(rosterDir(), "people.json");

/**
 * The identity map, read fresh, held only for the length of one response.
 *
 * Returns `null` when there is no store to read — which is not an error. A
 * professor who has never run `ainar roster import` has no names to show, and
 * the view says so rather than drawing an empty column.
 */
const rosterPeople = () => {
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
const withStudentNames = (data) => {
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

/**
 * The class list, by subgroup.
 *
 * **Names by default; pseudonyms one press away.** The record holds pseudonyms
 * and always will — the mapping back to real people lives outside the
 * repository on purpose, and nothing this view does changes what is on disk.
 * What changed is which question this view answers first. A class list is a
 * list of people, the professor is the one person entitled to read it, and
 * sending them to `ainar roster whois` seventy-four times was friction dressed
 * up as a safeguard.
 *
 * The case for opening on pseudonyms was real but narrow: this pane gets
 * screen-shared and thrown at lecture-hall projectors. That is a minority of
 * the times it is opened, and paying for it on every other one was the wrong
 * trade. It is covered instead by two things — `Pseudonyms` is a single press
 * and sits in the segmented row where it can be found in a hurry, and a
 * coloured rule at the top says names are showing, so the state is never
 * something to remember.
 *
 * The names are resolved from `~/.ainar/roster/people.json` at render time and
 * exist only in the string this function returns. Nothing is written, nothing
 * is cached, and nothing is sent anywhere.
 *
 * Three states, and telling them apart is most of what this view is for:
 *
 * * **loaded** — read from `enrollments.yaml`, where
 *   `ainar roster import` writes the pseudonyms, or from
 *   `samples/enrollments*.yaml`. Fixtures are announced as
 *   fixtures; a real roster is not.
 * * **refused** — an enrollments file sits under `records/`,
 *   the location reserved for the rows Supabase owns, and the loader would not
 *   read it (`storage.forbidden`). Drawing an empty list here would describe a
 *   course nobody had enrolled in, which is a different and false thing.
 * * **absent** — nothing has been imported yet, and `ainar roster import` is
 *   the answer.
 *
 * Dropped students are drawn, dimmed, under a heading of their own. They are in
 * the record because an import marks a departure rather than deleting the row,
 * and a class list that silently omitted them would undo the point of that.
 */
const studentsDocument = (workspace, runId, dark, withNames, origin, sessionId) => {
  const { bundle, issues } = loadedRun(workspace, runId);
  const enrolled = enrollmentsOf(bundle, runId);

  // Read once per response, not once per student: the store is one file and
  // twenty-seven reads of it would be twenty-seven chances to catch it
  // half-written by a concurrent `ainar roster import`.
  const people = withNames ? rosterPeople() : null;

  /**
   * What to show for one person, and what to show underneath it.
   *
   * The pseudonym never disappears. It is the identifier every other surface
   * uses — the gradebook, `whois`, a bug report — so a named row that dropped
   * it would be a row the professor could not act on anywhere else.
   */
  const heading = (studentId) => {
    const person = people ? people[studentId] : null;
    const name = person && typeof person.name === "string" ? person.name.trim() : "";
    if (!name) return escapeText(studentId);
    return (
      escapeText(name) +
      '<br><span class="dim" style="font-weight:400"><code>' +
      escapeText(studentId) +
      "</code></span>"
    );
  };

  const issueItems = issues && Array.isArray(issues.items) ? issues.items : [];
  const refused = issueItems.filter(
    (issue) => issue.code === "storage.forbidden" && /enrollments/.test(issue.message ?? ""),
  );
  const synthetic = issueItems.some((issue) => issue.code === "storage.fixture");

  const note = (text) =>
    '<p class="dim" style="border-left:3px solid var(--line);padding-left:10px">' + text + "</p>";

  /*
   * The refused file is worth saying even when there IS a list to draw.
   *
   * A workspace can hold both: fixtures under `samples/` that loaded, and a
   * real `enrollments.yaml` beside them that did not. Reporting the refusal
   * only on an empty list would draw the fixtures as though they were the
   * class and stay silent about student identities sitting in a git tree —
   * which is the one thing on this screen a professor most needs told.
   */
  const refusedHtml = refused.length
    ? '<p class="empty">An enrollments file in this run was <b>not read</b>. It ' +
      "names students, so it belongs in Supabase rather than in the course tree, " +
      "and the loader refuses it rather than pulling identities into a bundle a " +
      "prompt or a widget could serialise. Move it out of the repository.</p>" +
      refused
        .map(
          (issue) =>
            '<div class="row"><span class="k"><code>' +
            escapeText(issue.location ?? "enrollments.yaml") +
            "</code></span></div>",
        )
        .join("")
    : "";

  if (enrolled.length === 0) {
    const body =
      refusedHtml ||
      '<p class="empty">Nobody is enrolled in this run yet. Importing a class ' +
        "list is <code>ainar roster import export.csv --run " +
        escapeText(runId) +
        "</code>, which writes pseudonyms here and the names themselves outside " +
        "the repository.</p>";
    return documentPage("<section><h2>Students</h2>" + body + "</section>", dark);
  }

  // Per-student marks, from the gradebook rather than recomputed. The record is
  // one place; two arithmetics over it would eventually disagree, and the one
  // on this screen would be the one nobody had tested.
  let totals = new Map();
  try {
    const book = gradebookPayload(bundle, runId, {});
    totals = new Map((book.totals ?? []).map((row) => [row.student_id, row]));
  } catch {
    // A course whose rubrics do not add up cannot be totalled, and that is the
    // gradebook's complaint to make, on the gradebook's tab. A class list is
    // still a class list without the marks column.
  }

  // The run's own assessments, by id. Doubles as the scope filter for
  // submissions: a bundle holds every run's, and this view is about one.
  const assessmentTitles = new Map(
    assessmentsOf(bundle, runId).map((assessment) => [assessment.assessment_id, assessment]),
  );

  const active = enrolled.filter((entry) => entry.status === "active");
  const inactive = enrolled.filter((entry) => entry.status !== "active");

  const label = (entry) => String(entry.group ?? "").trim();
  const groups = [...new Set(active.map(label))].sort((a, b) => {
    // The ungrouped go last: they are the remainder, not a subgroup called "".
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  const marks = (studentId) => {
    const row = totals.get(studentId);
    if (!row) return '<span class="dim">no work graded yet</span>';
    const counted = (row.assessments_counted ?? []).length;
    const outstanding = (row.assessments_outstanding ?? []).length;
    const percent = row.percent_of_graded;
    const of = counted + outstanding;
    return (
      (percent === null || percent === undefined
        ? '<span class="dim">—</span>'
        : escapeText(String(percent)) + "%") +
      '<br><span class="dim">' +
      escapeText(String(counted)) +
      " of " +
      escapeText(String(of)) +
      " graded</span>"
    );
  };

  /* ------------------------------------------------------- what they handed in
   *
   * The class list said how much of the course each student had been marked
   * on and nothing at all about what they wrote. A professor asking "what is
   * in this?" — the question a mark cannot answer — had to leave the harness,
   * find the file and open it, or read `item-responses.yaml` by hand.
   *
   * So each person's work opens under their row, and it opens CLOSED. This
   * pane is screen-shared and projected; a class list that unfolded every
   * student's answers on load would put a room's written work on a lecture
   * theatre wall. One press per person is the right price for that, and it is
   * the pane's own idiom already — the folded missing-students list works the
   * same way.
   *
   * Rendered inline rather than fetched on demand, and that is forced rather
   * than chosen: these documents are delivered into a frame with an opaque
   * origin, which may neither navigate itself nor `fetch`. There is no
   * "load it when pressed" available in here. See VIEW_SCRIPT.
   */

  const submissionsOf = new Map();
  for (const submission of bundle.submissions ?? []) {
    if (!assessmentTitles.has(submission.assessment_id)) continue;
    const key = submission.student_id;
    if (!submissionsOf.has(key)) submissionsOf.set(key, []);
    submissionsOf.get(key).push(submission);
  }
  for (const list of submissionsOf.values()) {
    // Newest last, the order they were handed in. An attempt 2 sorting above
    // attempt 1 would read as the earlier answer.
    list.sort((a, b) => String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")));
  }

  const responsesOf = new Map();
  for (const response of bundle.item_responses ?? []) {
    const key = response.submission_id;
    if (!responsesOf.has(key)) responsesOf.set(key, []);
    responsesOf.get(key).push(response);
  }

  const itemById = new Map((bundle.items ?? []).map((item) => [item.item_id, item]));
  const documentById = new Map((bundle.documents ?? []).map((row) => [row.document_id, row]));

  /**
   * One file a student handed in, as a link or as the reason there is not one.
   *
   * The reason matters more than it looks. `samples/documents.yaml` says it in
   * as many words: the bytes of student work live in object storage and never
   * in this repository. `sendMaterial` refuses any key carrying a scheme, so a
   * submission recorded as `object://…` cannot be framed — not because this
   * view forgot to link it, but because the model deliberately does not have
   * it here. Saying so is the honest answer; a dead `open` link that returned
   * a sentence about storage would be worse than no link.
   *
   * A professor who DOES keep submissions in the workspace gets the overlay
   * for free: a repository-relative key is served by the same route a brief
   * is, and a PDF, an image, a text file or markdown paints in the frame.
   */
  const fileRow = (file) => {
    const record = documentById.get(file.document_id);
    const title = record && record.title ? record.title : file.document_id;
    const type = String(file.type ?? "").trim();
    const key = String((record ?? {}).storage_key ?? "");
    const left =
      '<span class="k">' +
      escapeText(title) +
      (type ? ' <span class="dim">' + escapeText(type) + "</span>" : "") +
      "</span>";

    if (!record) {
      return (
        '<div class="row">' +
        left +
        '<span class="v"><span class="todo">no such document</span></span></div>'
      );
    }
    if (!key || key.includes("://")) {
      return (
        '<div class="row">' +
        left +
        '<span class="v"><span class="dim">held outside the workspace</span></span></div>'
      );
    }
    const extension = extensionOfKey(key);
    const href =
      `${origin}${BASE}/file?doc=` +
      encodeURIComponent(file.document_id) +
      (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
      (dark ? "&dark=1" : "");
    return (
      '<div class="row">' +
      left +
      '<span class="v"><a class="chip-link" href="' +
      escapeText(href) +
      '" target="_blank" rel="noopener"' +
      (SHOWABLE.has(extension)
        ? ' data-view="' + escapeText(title) + '" data-format="' + escapeText(extension) + '"'
        : "") +
      ">open</a></span></div>"
    );
  };

  /**
   * One answer: the question, then what the student put.
   *
   * Both halves, because neither is legible alone. `chosen_options: [b]` says
   * nothing without the option's own text, and a paragraph of `raw_response`
   * says little without the question it answers. An item the course no longer
   * has is named by its id rather than dropped — a response whose item was
   * deleted is a thing to notice, not to hide.
   */
  const answer = (response) => {
    const item = itemById.get(response.item_id);
    const number = item && item.number ? String(item.number) + ". " : "";
    const prompt = item
      ? escapeText(item.prompt)
      : '<span class="dim">' + escapeText(response.item_id) + " — no such item in the course</span>";

    const chosen = Array.isArray(response.chosen_options) ? response.chosen_options : [];
    const options = item && Array.isArray(item.options) ? item.options : [];
    const picked = chosen.map((label) => {
      const option = options.find((candidate) => candidate.label === label);
      return (
        "<b>" +
        escapeText(label) +
        "</b>" +
        (option ? " " + escapeText(option.text) : "")
      );
    });

    const scored =
      response.score === null || response.score === undefined
        ? '<span class="todo">not scored</span>'
        : escapeText(String(response.score)) +
          (item && typeof item.maximum_score === "number"
            ? " of " + escapeText(String(item.maximum_score))
            : "");

    // `correct` is nullish on anything a person marked rather than a machine,
    // and absent is not the same as wrong.
    const verdict =
      response.correct === true
        ? ' · <span class="ok">correct</span>'
        : response.correct === false
          ? ' · <span class="bad">incorrect</span>'
          : "";

    return (
      '<div class="qa"><p class="q">' +
      escapeText(number) +
      prompt +
      "</p>" +
      (picked.length ? '<p class="a">chose ' + picked.join("; ") + "</p>" : "") +
      (response.raw_response
        ? "<blockquote>" + escapeText(String(response.raw_response)) + "</blockquote>"
        : "") +
      (!picked.length && !response.raw_response
        ? '<p class="a"><span class="dim">nothing recorded for this question</span></p>'
        : "") +
      '<p class="s">' +
      scored +
      verdict +
      "</p></div>"
    );
  };

  /** Everything one student handed in, closed until asked for. */
  const workPanel = (entry) => {
    const list = submissionsOf.get(entry.student_id) ?? [];
    if (!list.length) return "";
    return (
      '<div class="row work" data-group="' +
      escapeText(label(entry)) +
      '" data-work="' +
      escapeText(String(entry.student_id ?? "")) +
      '" hidden><div class="wk">' +
      list
        .map((submission) => {
          const assessment = assessmentTitles.get(submission.assessment_id) ?? {};
          const responses = (responsesOf.get(submission.submission_id) ?? [])
            .slice()
            .sort((a, b) => {
              const left = itemById.get(a.item_id);
              const right = itemById.get(b.item_id);
              // By the number the student saw, and by id where a question has
              // none: the order on the paper is the order to read them in.
              return (
                (left && left.number ? left.number : 0) - (right && right.number ? right.number : 0) ||
                String(a.item_id).localeCompare(String(b.item_id))
              );
            });
          const files = Array.isArray(submission.files) ? submission.files : [];
          return (
            "<h3>" +
            escapeText(assessment.title ?? submission.assessment_id) +
            ' <span class="id">' +
            escapeText(submission.assessment_id) +
            "</span></h3>" +
            '<p class="dim">' +
            (submission.submitted_at
              ? "handed in " + escapeText(stamp(submission.submitted_at))
              : "no time recorded") +
            (submission.status && submission.status !== "submitted"
              ? " · " + escapeText(String(submission.status))
              : "") +
            (submission.attempt && submission.attempt > 1
              ? " · attempt " + escapeText(String(submission.attempt))
              : "") +
            "</p>" +
            (submission.note
              ? '<p class="dim">' + escapeText(String(submission.note)) + "</p>"
              : "") +
            responses.map(answer).join("") +
            files.map(fileRow).join("") +
            // Handed in, and nothing to read: a file-only submission whose
            // bytes are elsewhere, or a row created before any answer was
            // recorded. Both are facts, and an empty panel would look broken.
            (responses.length === 0 && files.length === 0
              ? '<p class="dim">Nothing is recorded under this submission — no answers, no files.</p>'
              : "")
          );
        })
        .join("") +
      "</div></div>"
    );
  };

  const row = (entry, dimmed) =>
    // The group travels with the row so the filter can act on a departed
    // student too. Their section is not grouped — it is one list of everyone
    // who left — but they belonged to a subgroup while they were here, and a
    // filter that showed the whole departed list under every subgroup would
    // be answering a different question each time.
    '<div class="row" data-group="' +
    escapeText(label(entry)) +
    '"><span class="k"' +
    (dimmed ? ' style="color:var(--dim)"' : "") +
    ">" +
    heading(entry.student_id ?? "") +
    (entry.role && entry.role !== "student"
      ? ' <span class="dim">' + escapeText(entry.role) + "</span>"
      : "") +
    '</span><span class="v">' +
    (dimmed
      ? '<span class="todo">' +
        escapeText(entry.status ?? "inactive") +
        "</span>" +
        (label(entry) ? '<br><span class="dim">' + escapeText(label(entry)) + "</span>" : "")
      : marks(entry.student_id)) +
    workButton(entry) +
    "</span></div>";

  /**
   * The press that opens one person's work, or nothing at all.
   *
   * Absent rather than disabled when there is nothing handed in: a row of
   * dead buttons down a class list of which three have submitted is noise,
   * and "no button" already says it. The count is on the button because the
   * professor is choosing which row to open.
   */
  const workButton = (entry) => {
    const count = (submissionsOf.get(entry.student_id) ?? []).length;
    if (count === 0) return "";
    return (
      '<br><button type="button" class="chip" aria-expanded="false" data-workbtn="' +
      escapeText(String(entry.student_id ?? "")) +
      '">' +
      escapeText(String(count)) +
      (count === 1 ? " submission" : " submissions") +
      "</button>"
    );
  };

  /*
   * Sort by what is on screen.
   *
   * With names off that is the pseudonym, which is the order every other
   * surface uses. With names on, a list ordered by pseudonym is a shuffled
   * list — the derivation is a hash, so it has no relation to anything a
   * professor can scan for. Falling back to the pseudonym keeps someone the
   * store does not know from floating to an arbitrary place in the list.
   */
  const sortKey = (entry) => {
    const person = people ? people[entry.student_id] : null;
    const name = person && typeof person.name === "string" ? person.name.trim() : "";
    return name || String(entry.student_id ?? "");
  };
  const byDisplayed = (a, b) => sortKey(a).localeCompare(sortKey(b));

  const sections = groups
    .map((group) => {
      const members = active.filter((entry) => label(entry) === group).sort(byDisplayed);
      return (
        '<section data-group="' +
        escapeText(group) +
        '"><h2>' +
        escapeText(group === "" ? "No subgroup" : group) +
        ' <span class="dim">· ' +
        escapeText(String(members.length)) +
        " active</span></h2>" +
        members.map((entry) => row(entry, false) + workPanel(entry)).join("") +
        "</section>"
      );
    })
    .join("");

  const departed = inactive.length
    ? '<section data-departed="1"><h2>No longer active</h2>' +
      inactive
        .slice()
        .sort(byDisplayed)
        .map((entry) => row(entry, true) + workPanel(entry))
        .join("") +
      "</section>"
    : "";

  /*
   * Which of the three identity states this render is in, said on screen.
   *
   * The named case gets a band rather than the usual quiet grey line. It is
   * the one state where the screen holds something that must not be projected
   * by accident, and a professor who has just plugged into a lecture-hall HDMI
   * should be able to see it from the back of the room.
   */
  const identityNote = !withNames
    ? note(
        "Pseudonyms — safe to screen-share. Press <b>Names</b> above to go back " +
          "to reading the list; names are what this view opens with.",
      )
    : people === null
      ? note(
          "<b>No names available.</b> There is no roster store at <code>" +
            escapeText(rosterPath()) +
            "</code>. Import a class list with <code>ainar roster import " +
            "export.csv --run " +
            escapeText(runId) +
            "</code>, or point <code>AINAR_ROSTER_DIR</code> at the directory " +
            "holding it.",
        )
      : // Names are the normal state now, so this is a marker rather than a
        // warning: a filled amber alarm on every load would be wallpaper
        // within a week and would stop being read at the one moment it
        // matters. A coloured rule and one sentence stay legible.
        '<p style="border-left:3px solid #a5561f;padding-left:10px;margin:8px 0;' +
        'color:#a5561f"><b>Real names on screen.</b> Press <b>Pseudonyms</b> ' +
        "before screen-sharing or projecting this.</p>";

  const header =
    "<section><h2>Students</h2>" +
    '<p class="dim">' +
    escapeText(String(active.length)) +
    " active" +
    (inactive.length ? " · " + escapeText(String(inactive.length)) + " no longer active" : "") +
    (groups.filter((group) => group !== "").length
      ? " · " + escapeText(String(groups.filter((group) => group !== "").length)) + " subgroups"
      : "") +
    "</p>" +
    identityNote +
    (synthetic
      ? note(
          "Read from <code>samples/</code>: synthetic fixtures, not the roster. " +
            "Real enrollments come from Supabase.",
        )
      : "") +
    refusedHtml +
    "</section>";

  /*
   * The subgroup filter, drawn above everything else.
   *
   * Inside the document rather than in the pane's segmented row, and filtering
   * in the page rather than refetching. Three reasons, in order of weight:
   *
   * * the groups are a property of the run, so the browser half would have to
   *   be told them before it could draw a control for them — a header, a
   *   parse, and a second source of truth for what the subgroups are;
   * * a refetch per press would re-resolve the roster and rebuild the list to
   *   show a subset of what is already on screen;
   * * the professor switching between CSS4007-ENG-8 and -9 in a meeting wants
   *   it to happen at the speed of a click.
   *
   * Only drawn when there is something to choose between: one subgroup, or
   * none at all, and the control would be a row of buttons that all do the
   * same thing.
   */
  const chip = (value, text, count, pressed) =>
    '<button type="button" class="chip" data-filter="' +
    escapeText(value) +
    '" aria-pressed="' +
    (pressed ? "true" : "false") +
    '">' +
    escapeText(text) +
    ' <span class="dim">' +
    escapeText(String(count)) +
    "</span></button>";

  const filterBar =
    groups.length > 1
      ? '<div class="chips">' +
        chip("*", "All", active.length, true) +
        groups
          .map((group) =>
            chip(
              group,
              group === "" ? "No subgroup" : group,
              active.filter((entry) => label(entry) === group).length,
              false,
            ),
          )
          .join("") +
        "</div>"
      : "";

  /*
   * The filter, as eighteen lines of DOM toggling.
   *
   * `hidden` rather than a class, so a section that is filtered out is out of
   * the accessibility tree as well as off the screen — a screen reader running
   * down a filtered list should not read the ninety students the professor
   * just filtered away.
   *
   * The departed section is handled row by row and then hidden if it emptied,
   * because it is one list rather than one section per group.
   */
  const filterScript = filterBar
    ? "<script>(function(){" +
      "var chips=[].slice.call(document.querySelectorAll('.chip'));" +
      "var sections=[].slice.call(document.querySelectorAll('section[data-group]'));" +
      "var gone=document.querySelector('section[data-departed]');" +
      "function apply(want){" +
      "chips.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.filter===want));});" +
      "sections.forEach(function(s){s.hidden=want!=='*'&&s.dataset.group!==want;});" +
      "if(gone){var seen=0;" +
      "[].forEach.call(gone.querySelectorAll('.row:not(.work)'),function(r){" +
      "var off=want!=='*'&&r.dataset.group!==want;r.hidden=off;if(!off)seen++;});" +
      "gone.hidden=seen===0;}" +
      "}" +
      "chips.forEach(function(c){c.addEventListener('click',function(){apply(c.dataset.filter);});});" +
      "})();</script>"
    : "";

  /*
   * The disclosure, as nine lines of DOM toggling.
   *
   * `hidden` rather than a class, for the filter's reason: a panel nobody has
   * opened should be out of the accessibility tree as well as off the screen.
   * A screen reader running down a class list must not read every student's
   * answers aloud.
   *
   * The panel is found by `data-work` matching the button's `data-workbtn`
   * rather than by DOM adjacency, so the two can be reordered without this
   * quietly opening the wrong person's work.
   */
  const workScript =
    "<script>(function(){" +
    "[].forEach.call(document.querySelectorAll('[data-workbtn]'),function(b){" +
    "b.addEventListener('click',function(){" +
    "var panel=document.querySelector('[data-work=\"'+b.dataset.workbtn+'\"]');" +
    "if(!panel)return;" +
    "panel.hidden=!panel.hidden;" +
    "b.setAttribute('aria-expanded',String(!panel.hidden));" +
    "});});" +
    "})();</script>";

  /*
   * What a work panel needs that `documentPage` does not have.
   *
   * `.row[hidden]` is the one that is not cosmetic. `documentPage` gives
   * `.row` a `display:flex`, and an author `display` beats the user agent's
   * `[hidden]{display:none}` — so without this line every panel is open on
   * load, which is precisely the state this view must never boot into.
   */
  const workStyle =
    "<style>" +
    ".row.work{display:block;border-bottom:1px solid var(--line);padding:0}" +
    // AFTER `.row.work`, and the order is the whole point. Both selectors
    // score the same, so the later one wins — with these two the other way
    // round every panel was open on load, which is the one state this view
    // must never boot into. Written as the more specific selector as well, so
    // that a rule added between them cannot bring the bug back.
    ".row.work[hidden]{display:none}" +
    ".wk{padding:2px 0 10px 10px;border-left:2px solid var(--line);margin:0 0 6px}" +
    ".wk h3{font-size:12px;margin:10px 0 2px;letter-spacing:.04em;text-transform:uppercase;" +
    "color:var(--dim)}" +
    ".wk h3:first-child{margin-top:2px}" +
    ".wk p{margin:0 0 4px}" +
    ".qa{margin:6px 0 10px}" +
    ".qa .q{font-weight:600}" +
    ".qa .a{margin:0 0 2px}" +
    ".qa .s{font-size:12px;color:var(--dim)}" +
    // The answer a student typed, set apart from the question and from the
    // mark. It is the thing this whole panel exists to show, so it is the one
    // element in here that is not dimmed.
    ".qa blockquote{margin:2px 0 4px;border-left:3px solid var(--line);padding:0 0 0 9px;" +
    "white-space:pre-wrap;overflow-wrap:anywhere}" +
    ".ok{color:var(--info)}" +
    ".bad{color:var(--warn)}" +
    "</style>";

  return documentPage(
    workStyle + filterBar + header + sections + departed + filterScript + workScript + VIEW_SCRIPT,
    dark,
  );
};

/**
 * Whether the browser will paint this format in a frame, or only download it.
 *
 * The narrow list, not the broad one. A `.pptx` and a `.docx` are downloads in
 * every browser this runs in, and marking one showable would put a blank panel
 * over the harness and call it a slide deck — worse than the tab it replaced.
 *
 * `.md` was out for that same reason and is now in, because the reason stopped
 * being true rather than because the rule was relaxed. Chrome does download
 * `text/markdown`, whatever the file is made of — so `/file` no longer sends
 * one. A markdown document is RENDERED there and served as HTML, which is a
 * format on this list, and the professor gets the document instead of a file
 * in Downloads. That is not a cosmetic preference: this project's own skills
 * write a deck as Marp markdown and the brief students read as markdown beside
 * the YAML, so `.md` is the format most of a course is actually in.
 *
 * A format that is out is not broken here; it keeps the link it always had,
 * and the overlay's header offers the same tab for a format that turns out to
 * be a download after all.
 *
 * At module scope rather than inside `withMaterialLinks`, because the class
 * list reads it as well — a student's handed-in PDF is the same question about
 * the same route, and two copies of this list would drift.
 */
const SHOWABLE = new Set([
  "pdf",
  "html",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "txt",
  "csv",
  "json",
  "md",
  "markdown",
]);

/** A storage key's extension, lowercased, or `""`. */
const extensionOfKey = (key) => {
  const name = String(key ?? "").split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

/**
 * Give every resource that names a document somewhere to go.
 *
 * The widget will not invent a path — `safeUrl` in its runtime returns null for
 * anything that is not http, https or a relative reference — and that is right:
 * the same document renders in a chat client that has no route to the file. So
 * the PANE supplies the URL, because the pane is the host that does have one.
 *
 * An ABSOLUTE http URL, not `/professor-pane/file?…`. `safeUrl` refuses a
 * leading slash outright, and the document is rendered inside a `srcdoc` iframe
 * where a relative reference resolves against a base the frame does not really
 * have. `http://<host>/…` is the only form that survives both.
 *
 * A resource that already carries its own `url` keeps it: an externally hosted
 * reading is not ours to redirect through a local file route.
 *
 * Both places the outline payload holds resources — the chips on each meeting,
 * and the required-materials list at the end. They are the same records reached
 * two ways, and a link in one place but not the other is what this pane looked
 * like before.
 */
const withMaterialLinks = (data, origin, sessionId, workspace, dark, withDrafts) => {
  if (!origin || data === null || typeof data !== "object") return data;

  // `dark` travels on the address for one format only, and is inert for the
  // rest: a PDF and a PNG are painted by the browser's own viewer, which has
  // never asked this app what colour the harness is. It is on the URL because
  // a RENDERED markdown document is a page of ours, framed over the whole
  // harness, and a white brief in a dark harness is the one thing the overlay
  // was supposed to stop happening. The harness's theme is an explicit choice
  // and need not agree with the machine's, so it is passed rather than left to
  // `prefers-color-scheme`.
  const address = (documentId) => {
    // `from` is carried on the address and nowhere else, because the only
    // consumer is the overlay's "ask about this" button and the overlay is
    // handed a URL, a label and a format — nothing that could look a record up.
    // Putting it here costs one parameter and saves a second route whose whole
    // job would be answering a question the payload already knew.
    const source = sourceOf(documentId);
    return (
      `${origin}${BASE}/file?doc=` +
      encodeURIComponent(documentId) +
      (source ? "&from=" + encodeURIComponent(source) : "") +
      (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
      (dark ? "&dark=1" : "")
    );
  };

  // Every document in the workspace, indexed by the basename of its storage key
  // with the extension removed.
  //
  // This is how one lecture in two formats is recognised. The model has no
  // "same thing, other format" relation — a `Resource` names ONE document — so
  // `…-Week-3.pptx` and `…-Week-3.pdf` are two unrelated records as far as the
  // schema is concerned. Pairing them by stem is a convention, and the draft
  // that registered the PDFs says so in as many words: rename one half and the
  // pairing quietly stops. It is a convention worth having because the
  // alternative is two chips both called "slides" on one meeting.
  const byStem = new Map();
  /** Every document's extension, so a link can say whether it is showable. */
  const extensionOf = new Map();
  /** `extensions.rendered_from`, one hop: the record this artefact came from. */
  const renderedFrom = new Map();
  /**
   * `extensions.origin`: built in this workspace, or brought in finished.
   *
   * A week may hold both — a deck rendered from its markdown and somebody
   * else's deck imported whole — and the two are different claims about what
   * the file IS, not merely about where it sits. The pane badges this, so the
   * professor is never guessing which of two chips is which; an artefact that
   * declares nothing is drawn as the unfinished state it is rather than
   * silently as "generated".
   */
  const originOf = new Map();
  /** `extensions.read_by`: text, ocr or vlm — how an imported outline was got. */
  const readByOf = new Map();
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    for (const document of loaded.bundle.documents ?? []) {
      // Read before the storage-key guard: a source may legitimately be a
      // record this loop skips for its own reasons, and the edge is still true.
      const from = document.extensions?.rendered_from;
      if (typeof from === "string" && from !== "") {
        renderedFrom.set(document.document_id, from);
      }
      const origin = document.extensions?.origin;
      if (typeof origin === "string" && origin !== "") {
        originOf.set(document.document_id, origin);
      }
      const readBy = document.extensions?.read_by;
      if (typeof readBy === "string" && readBy !== "") {
        readByOf.set(document.document_id, readBy);
      }
      const key = String(document.storage_key ?? "");
      if (!key || key.includes("://")) continue;
      const name = key.split(/[\\/]/).pop() ?? "";
      const dot = name.lastIndexOf(".");
      if (dot <= 0) continue;
      const stem = name.slice(0, dot);
      const extension = name.slice(dot + 1).toLowerCase();
      extensionOf.set(document.document_id, extension);
      if (!byStem.has(stem)) byStem.set(stem, []);
      byStem.get(stem).push({ id: document.document_id, extension });
    }
  }

  const showable = (documentId) => SHOWABLE.has(extensionOf.get(documentId) ?? "");

  /**
   * What a rendered artefact was produced from, following the chain to its end.
   *
   * `extensions.rendered_from` is a real edge in the record — a PDF names the
   * deck it was converted from, and that deck names the script that built it —
   * and this walks to the document at the end, because that is the one a
   * professor would edit. Changing a slide means changing the builder; nobody
   * edits a PDF.
   *
   * It replaces nothing: `formatsFor` still pairs siblings by filename stem,
   * which is a convention and stays one. This is the relation the schema
   * actually carries, and the two answer different questions — "the same thing
   * in another format" and "the thing this was made from".
   *
   * Cycles end the walk rather than hanging it. A record that names itself, or
   * two that name each other, is bad data and not worth a stack overflow; the
   * last id reached is returned and the validator is the place that complains.
   */
  const sourceOf = (documentId) => {
    const seen = new Set([documentId]);
    let at = documentId;
    for (;;) {
      const next = renderedFrom.get(at);
      if (next === undefined || seen.has(next)) break;
      seen.add(next);
      at = next;
    }
    return at === documentId ? null : at;
  };

  /** The formats a document is available in, itself first. */
  const formatsFor = (documentId) => {
    for (const [, group] of byStem) {
      const self = group.find((entry) => entry.id === documentId);
      if (!self) continue;
      // Only formats worth a separate button. A deck beside its own build
      // script shares no stem, so this stays a small set in practice.
      const shown = group.filter((entry) => ["pptx", "pdf", "docx"].includes(entry.extension));
      if (shown.length < 2) return [];
      return shown
        .sort((a, b) => (a.id === documentId ? -1 : b.id === documentId ? 1 : 0))
        .map((entry) => ({
          label: entry.extension.toUpperCase(),
          url: address(entry.id),
          viewable: SHOWABLE.has(entry.extension),
          // The extension travels with the link because the overlay sandboxes
          // a document and does not sandbox a PDF. See MEDIA in `client.js`.
          format: entry.extension,
        }));
    }
    return [];
  };

  const link = (resource) => {
    if (!resource || typeof resource !== "object") return resource;
    if (!resource.document_id) return resource;
    const formats = formatsFor(resource.document_id);
    // A resource that carries its own URL is hosted elsewhere and is not ours
    // to frame: the overlay only shows what `/file` serves from this
    // workspace, so an external reading keeps the tab it always opened.
    const viewable = !resource.url && showable(resource.document_id);
    const url = resource.url || address(resource.document_id);
    return {
      ...resource,
      url,
      formats,
      viewable,
      format: extensionOf.get(resource.document_id) ?? "",
      // Empty when the record says nothing, and the view draws that as its own
      // state rather than assuming the common case.
      origin: originOf.get(resource.document_id) ?? "",
      read_by: readByOf.get(resource.document_id) ?? "",
    };
  };

  /**
   * The same address, for the brief a piece of graded work names.
   *
   * A `Resource` and an `Assessment` both point at a `Document` and neither
   * spells the field the same way: a resource carries `document_id`, an
   * assessment carries `instructions_document_id`, and that difference is the
   * only reason this is a second function rather than an argument to `link`.
   * Everything after the lookup — the absolute URL, whether the browser will
   * paint it, the extension that decides how the overlay frames it — is
   * identical, because it is the same route serving the same file.
   *
   * `formats` is left empty rather than paired by stem. The stem convention
   * exists for a deck that was built into three files from one source; a brief
   * is one document, and a second chip beside it would be inviting the
   * professor to choose between a file and itself.
   *
   * An assessment with no brief is returned untouched — no `url`, so every
   * view downstream keeps the "nothing to open" branch it already had rather
   * than being handed a link to a document that does not exist.
   */
  /**
   * Where this pane serves a piece of graded work's own text.
   *
   * Separate from `address`, and a separate field from `url`, because the two
   * answer different questions: `url` is the BRIEF DOCUMENT when one exists,
   * and this is the record's `description` rendered as a page. An assessment
   * can have both, and the chip and its "open" link then lead to different
   * things on purpose — the text somebody wrote in the record, and the file
   * they attached to it.
   *
   * `drafts` travels on the address, because the outline it was built from was
   * itself drafted or not and the brief must agree with the chip that opened
   * it. The pane defaults to `+ drafts`, so without this a professor reading a
   * proposed assessment's chip would be shown the approved text — or an error
   * saying the assessment does not exist, which is worse, since it does.
   */
  const briefAddress = (runId, assessmentId) =>
    `${origin}${BASE}/brief?run=` +
    encodeURIComponent(runId) +
    "&assessment=" +
    encodeURIComponent(assessmentId) +
    (sessionId ? "&session=" + encodeURIComponent(sessionId) : "") +
    (withDrafts ? "&drafts=1" : "") +
    (dark ? "&dark=1" : "");

  const runId = String(data?.run?.id ?? "");

  const linkAssessment = (assessment) => {
    if (!assessment || typeof assessment !== "object") return assessment;
    // The record's own text, when it has any. This is what the chip opens, and
    // it is the usual case: most assessments in this model carry no brief
    // document at all, so without it the chip names work nobody can read.
    const brief =
      runId && assessment.assessment_id && String(assessment.description ?? "").trim()
        ? briefAddress(runId, assessment.assessment_id)
        : null;
    const documentId = assessment.instructions_document_id;
    if (!documentId) return brief ? { ...assessment, brief_url: brief } : assessment;
    return {
      ...assessment,
      ...(brief ? { brief_url: brief } : {}),
      url: address(documentId),
      viewable: showable(documentId),
      format: extensionOf.get(documentId) ?? "",
      formats: [],
    };
  };

  for (const week of Array.isArray(data.weeks) ? data.weeks : []) {
    for (const meeting of Array.isArray(week.meetings) ? week.meetings : []) {
      if (Array.isArray(meeting.resources)) meeting.resources = meeting.resources.map(link);
    }
    // Every list a week places graded work in. One assessment appears in two
    // of them — the week it opens and the week it falls due — and both rows
    // have to carry the link, because either is the one the professor happens
    // to be looking at.
    for (const key of ["opens", "due", "undated"]) {
      if (Array.isArray(week[key])) week[key] = week[key].map(linkAssessment);
    }
  }
  if (Array.isArray(data.required_materials)) {
    data.required_materials = data.required_materials.map(link);
  }
  // The flat list the Assessments and Exams tabs read, and the work `outline`
  // could not place on any week at all. The last one matters more than its
  // size suggests: an assessment with no module and no dates is exactly the
  // one whose brief a professor is trying to find.
  if (Array.isArray(data.assessments)) data.assessments = data.assessments.map(linkAssessment);
  if (data.unplaced && Array.isArray(data.unplaced.assessments)) {
    data.unplaced = {
      ...data.unplaced,
      assessments: data.unplaced.assessments.map(linkAssessment),
    };
  }
  return data;
};

/**
 * The MIME type a material is served as, by extension.
 *
 * A document carries `mime_type`, and that is what this uses when it looks
 * sane. The table is the fallback for a record that does not, and for the one
 * case where the recorded type is actively wrong — a deck registered as
 * `application/octet-stream` downloads as a nameless blob.
 */
const MIME_BY_EXTENSION = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  ndjson: "application/x-ndjson",
  yaml: "text/plain; charset=utf-8",
  yml: "text/plain; charset=utf-8",
  py: "text/plain; charset=utf-8",
  js: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

/**
 * The extensions this pane renders rather than hands over.
 *
 * Markdown is the project's own working format — `make-materials` writes a
 * deck as Marp markdown, `design-assessment` writes the brief students read as
 * markdown beside the YAML, and both say so in as many words — so it is the
 * one format where "serve the file" and "show the professor the document" are
 * different acts.
 */
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);

/**
 * The one thing a rendered document needs that every other view must not have:
 * a background of its own.
 *
 * `documentPage` paints `body` transparent on purpose — its pages are frames
 * INSIDE the pane's column, and the pane's own surface is meant to show
 * through. A rendered brief is the opposite case: it fills the overlay, and
 * `.pp-modalframe` in the browser half paints that frame `#fff`. So a
 * `dark=1` document, which sets `--fg` to near-white, was drawing pale grey
 * text on white — measured, not guessed. It is fixed here rather than by
 * darkening the frame, because the frame's white is the right default for a
 * FOREIGN HTML handout that assumes a light page and brings its own black
 * text; this is our document and knows its own palette.
 *
 * Both branches, in `documentPage`'s own shape: the harness's explicit choice
 * wins where there is one, and the machine's preference decides where there is
 * not.
 */
const MARKDOWN_GROUND = (dark) =>
  "<style>" +
  (dark
    ? "body{background:#1e1e1e}"
    : "body{background:#fff}" +
      "@media(prefers-color-scheme:dark){body{background:#1e1e1e}}") +
  "</style>";

/**
 * One markdown document as a page.
 *
 * The `<title>` is the document's own, because the overlay's header carries a
 * label and a browser tab does not: `Open in a tab ↗` on a nameless page put
 * `localhost:7411/professor-pane/file` in the tab strip.
 */
const markdownPage = (title, source, dark) =>
  documentPage(
    "<title>" +
      escapeText(title) +
      "</title>" +
      MARKDOWN_GROUND(dark) +
      MARKDOWN_STYLE +
      '<article class="md">' +
      renderMarkdown(source) +
      "</article>",
    dark,
  );

/**
 * Serve one material, addressed by the DOCUMENT that records it.
 *
 * By document id, never by path. The pane runs a web server on the professor's
 * own machine with their whole workspace under it, and a `?path=` parameter
 * would make that server a file browser for anything the process can read —
 * `../../.ssh/id_rsa` included. Addressing by `document_id` means the only
 * readable files are the ones the course record already names, and the record
 * is a thing a person curates.
 *
 * Two further limits, both belt and braces rather than the main defence:
 *
 * - a `storage_key` carrying a scheme (`object://…`) is refused. It is not a
 *   path in this repository and this route has no business resolving it.
 * - the resolved file must still sit inside the workspace root. A record whose
 *   key climbs out with `..` is a record that should not have validated, and
 *   this is the second place that becomes untrue rather than the first.
 *
 * Read-only, and no directory listing: a request that does not name a document
 * gets a sentence, not a browse.
 *
 * One format is transformed rather than served: markdown is rendered to HTML
 * here. See `MARKDOWN_EXTENSIONS` for why that is this route's job and not the
 * browser's.
 */
/**
 * One piece of graded work, as a page the overlay can frame.
 *
 * The chip in the outline used to open a sheet drawn INSIDE the widget's
 * frame, which is the wrong size for the job: the frame is one pane of the
 * harness, so a brief opened there is a dialog inside a column rather than
 * over the window, and it looked nothing like the overlay a deck or a PDF
 * opens into. This route is what lets the brief take that same overlay —
 * `openMaterial` needs a URL, and for the great majority of assessments there
 * is no file to point it at, so the page is composed here from the record.
 *
 * Markdown, and then the ordinary `markdownPage`, rather than markup of its
 * own. A brief that HAS a document already renders through that function, and
 * a brief that has only a description should not arrive in the same overlay
 * looking like it came from somewhere else. It also means the description is
 * treated exactly as every other authored text here is — rendered, not
 * injected; `renderMarkdown` escapes what it does not recognise.
 *
 * Addressed by run and assessment id, never by anything resembling a path. The
 * ids are looked up in the payload the pane already serves, so the only briefs
 * this can print are the ones the course record names — the same rule
 * `sendMaterial` follows, and for the same reason.
 */
const sendBrief = (res, workspace, root, runId, assessmentId, withDrafts, dark) => {
  if (!runId) return sendJson(res, 200, { error: "no run chosen" });
  if (!assessmentId) return sendJson(res, 200, { error: "no assessment named" });

  let data;
  try {
    data = withDrafts
      ? draftedPayload(workspace, root, "course_outline", runId, null).payload
      : payload(workspace, "course_outline", { course_version_id: runId });
  } catch (error) {
    return sendErrorPage(res, String(error.message ?? error));
  }

  const found = (data.assessments ?? []).find((a) => a && a.assessment_id === assessmentId);
  if (!found) {
    return sendErrorPage(res, `no assessment ${assessmentId} in ${runId}`);
  }

  const text = String(found.description ?? "").trim();
  if (!text) {
    return sendErrorPage(
      res,
      `${assessmentId} has no description yet, so there is nothing to read. ` +
        "The brief is the record's own text; write it there and it appears here.",
    );
  }

  // The same facts the chip's sheet carried, in the same order. A definition
  // list in markdown is a bulleted one — the renderer here is small on purpose
  // and this is not the place to grow it a new block type.
  const facts = [];
  const when = [
    found.opens_on ? `opens ${found.opens_on}` : "",
    found.due_on ? `due ${found.due_on}` : "",
  ].filter(Boolean);
  facts.push(`**Dates** — ${when.length ? when.join(", ") : "not scheduled"}`);
  facts.push(
    `**Weight** — ${found.weight == null ? "not set" : Math.round(found.weight * 100) + "%"}`,
  );
  if (found.maximum_score != null) facts.push(`**Out of** — ${found.maximum_score}`);
  const handed = (found.submission_type ?? []).join(", ");
  if (handed) facts.push(`**Handed in as** — ${handed}`);
  const outcomes = (found.outcomes ?? []).join(", ");
  if (outcomes) facts.push(`**Outcomes** — ${outcomes}`);
  facts.push(
    `**Rubric** — ${
      found.criteria
        ? found.criteria + (found.criteria === 1 ? " criterion" : " criteria")
        : "none yet"
    }`,
  );

  const title = String(found.title ?? assessmentId);
  const source = [
    `# ${title}`,
    "",
    ...facts.map((fact) => `- ${fact}`),
    "",
    text,
  ].join("\n");

  return send(res, 200, "text/html; charset=utf-8", markdownPage(title, source, dark === true));
};

const sendMaterial = (res, workspace, root, documentId, dark) => {
  if (!documentId) return sendJson(res, 200, { error: "no document named" });

  let found = null;
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    found = (loaded.bundle.documents ?? []).find((row) => row.document_id === documentId);
    if (found) break;
  }
  if (!found) return sendJson(res, 200, { error: `no document ${documentId} in this workspace` });

  const key = String(found.storage_key ?? "");
  if (!key || key.includes("://")) {
    return sendJson(res, 200, {
      error: `${documentId} is stored outside this repository (${key || "no storage_key"}), so the pane cannot serve it`,
    });
  }

  const full = resolve(root, key);
  const inside = resolve(root) + sep;
  if (!full.startsWith(inside)) {
    return sendJson(res, 200, { error: `${documentId} resolves outside the workspace` });
  }

  let body;
  try {
    body = readFileSync(full);
  } catch {
    return sendJson(res, 200, { error: `${key} is recorded but not on disk` });
  }

  const extension = (key.split(".").pop() ?? "").toLowerCase();

  // Markdown becomes a page. The name it downloads under becomes `.html` with
  // it, because a file whose bytes are HTML and whose name ends `.md` is a
  // file the professor's editor opens as source.
  let name = basename(full);
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    body = Buffer.from(
      markdownPage(String(found.title ?? name), body.toString("utf8"), dark === true),
      "utf8",
    );
    name = name.replace(/\.[^.]+$/, "") + ".html";
  }

  const type = MARKDOWN_EXTENSIONS.has(extension)
    ? "text/html; charset=utf-8"
    : (MIME_BY_EXTENSION[extension] ??
      (typeof found.mime_type === "string" && found.mime_type
        ? found.mime_type
        : "application/octet-stream"));

  res.setHeader("Content-Type", type);
  // `inline` so a deck opens in whatever the browser has rather than landing in
  // Downloads, and the filename so that when it does download it keeps its name.
  res.setHeader("Content-Disposition", `inline; filename="${name.replace(/"/g, "")}"`);
  res.setHeader("Content-Length", String(body.length));
  res.writeHead(200);
  res.end(body);
};

/**
 * The `ainar` CLI this pane is allowed to run: the TypeScript one, in this
 * checkout.
 *
 * A machine-wide `ainar` also exists — the Python package, on PATH — and
 * resolving the command by name would find that one instead. This project does
 * not run Python, so the path is spelled out rather than looked up, and a
 * missing file is reported as a missing file rather than silently falling
 * through to a different implementation of the same gate.
 *
 * Three levels up from this plugin is the project root:
 * plugins/dsh-professor-pane/index.js -> ../.. -> ainar-node/bin/ainar.ts
 */
const AINAR_CLI = fileURLToPath(new URL("../../ainar-node/bin/ainar.ts", import.meta.url));

/**
 * Promote the drafts in `work/<RUN>/` into the course record.
 *
 * This SPAWNS the CLI rather than calling `approveDrafts` and `writeRecords`
 * here, and that is the one decision in this file worth defending. Everything
 * else the pane serves is a read, computed in-process from the course model, and
 * until now nothing here spawned anything at all.
 *
 * Approval is different because it is a gate, and the gate is an ORDER of
 * operations: load drafts, stage documents, merge, validate, and only then
 * write. `bin/ainar.ts` performs that order and is the copy held to Python's by
 * `tests/test_approve_parity.py`, which compares the written trees byte for
 * byte. Re-typing those steps here would produce a third implementation, held to
 * nothing, whose first divergence would be a course record that validated and
 * was still wrong.
 *
 * `--dry-run` unless `confirm`, because a button that writes on the first click
 * is a button nobody can safely explore.
 */
const runApprove = (res, root, runId, approver, confirm) => {
  if (!approver) {
    return sendJson(res, 200, {
      error:
        "No approver. Approval records WHO accepted the drafts, so it needs a " +
        "user id — the run's instructor, e.g. USER-ASHALKAR.",
    });
  }

  if (!existsSync(AINAR_CLI)) {
    return sendJson(res, 200, {
      error:
        `The TypeScript ainar CLI is not at ${AINAR_CLI}. This pane will not ` +
        "fall back to the Python `ainar` on PATH — install or restore " +
        "ainar-node/ instead.",
    });
  }

  const args = [
    "--experimental-strip-types",
    AINAR_CLI,
    "approve",
    join(root, "work", runId),
    "--as",
    approver,
    "--root",
    root,
    "--course-version",
    runId,
  ];
  if (!confirm) args.push("--dry-run");

  execFile(
    process.execPath,
    args,
    { cwd: root, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      // The CLI exits non-zero when it refuses — drafts that do not load,
      // validation that fails — and its own text is the useful part. It is
      // passed through whole rather than summarised: "validation of the
      // approved records failed" plus the issue list is what the professor
      // needs, and a status code is not.
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      sendJson(res, 200, {
        ok: code === 0,
        confirmed: confirm,
        exitCode: code,
        command: `bin/ainar approve work/${runId} --as ${approver}${confirm ? "" : " --dry-run"}`,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      });
    },
  );
};

/**
 * Send an assessment's DEFINITION to Canvas, by spawning the CLI.
 *
 * Spawned rather than reimplemented, for the reason `runApprove` gives: the
 * rules that matter here — what counts as drift, which fields this model has
 * an opinion about, how a created assignment's id is written back into
 * `courses/` without destroying the comments around it — live in
 * `ainar-node/src/lms/`, and a second implementation in this file would have
 * its own idea of all three. The LMS write layer is deliberately absent from the
 * course model's tools, which are a read-only surface; the CLI is the seam that
 * exists for exactly this.
 *
 * **Plan and push are one route with a flag**, and the flag is the professor's
 * press. Both make an outbound request, so both are POST — a plan that Canvas
 * has to answer is not something a prefetch or a replayed history entry should
 * be able to fire, even though it changes nothing.
 *
 * The CLI's own text is passed through whole. "1 field(s) were edited in
 * Canvas and are left alone" is the sentence the professor needs, and nothing
 * this pane could summarise it into would be better.
 */
const runAssignmentPush = (res, root, runId, body) => {
  const assessment = String(body.assessment ?? "").trim();
  if (!assessment) {
    return sendJson(res, 200, { error: "No assessment named." });
  }
  if (!/^[A-Za-z0-9_.:@+-]{1,200}$/.test(assessment)) {
    return sendJson(res, 200, { error: `${assessment} is not an assessment id.` });
  }
  const group = String(body.group ?? "").trim();
  if (group && !/^[A-Za-z0-9_.:@+-]{1,200}$/.test(group)) {
    return sendJson(res, 200, { error: `${group} is not a subgroup label.` });
  }

  if (!existsSync(AINAR_CLI)) {
    return sendJson(res, 200, {
      error:
        `The TypeScript ainar CLI is not at ${AINAR_CLI}. This pane will not ` +
        "fall back to the Python `ainar` on PATH — install or restore " +
        "ainar-node/ instead.",
    });
  }

  const confirm = body.confirm === true;
  const overwrite = body.overwriteDrift === true;
  // Refused here as well as in the CLI. Replacing a colleague's edit is the
  // one thing on this screen that destroys somebody else's work, and it must
  // not be reachable by a press that meant "preview".
  if (overwrite && !confirm) {
    return sendJson(res, 200, {
      error: "Overwriting what Canvas holds is part of sending, not of previewing.",
    });
  }

  const args = [
    "--experimental-strip-types",
    AINAR_CLI,
    "lms",
    confirm ? "assignment-push" : "assignment-plan",
    runId,
    "--assessment",
    assessment,
  ];
  if (group) args.push("--group", group);
  if (confirm) args.push("--confirm");
  if (overwrite) args.push("--overwrite-drift");

  execFile(
    process.execPath,
    args,
    { cwd: root, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      sendJson(res, 200, {
        ok: code === 0,
        confirmed: confirm,
        exitCode: code,
        command:
          `bin/ainar lms ${confirm ? "assignment-push" : "assignment-plan"} ${runId} ` +
          `--assessment ${assessment}${group ? " --group " + group : ""}` +
          `${confirm ? " --confirm" : ""}${overwrite ? " --overwrite-drift" : ""}`,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      });
    },
  );
};

/**
 * Write one connection into the registry, by spawning the CLI.
 *
 * Spawned rather than written here, for the reason `runApprove` gives about
 * approval: the rules for what a usable connection is — HTTPS only, a numeric
 * Canvas course id, which variable each type defaults to — live in
 * `src/connections/`, and a second writer in this file would have its own
 * version of them, held to nothing. `ainar connections add` refuses what it
 * cannot use and prints why, and that text is what the professor sees.
 *
 * It cannot carry a credential: the command has no `--token` flag. The token
 * goes through the credential seam separately, in the route below.
 */
const addConnection = (root, fields) =>
  new Promise((resolve) => {
    if (!existsSync(AINAR_CLI)) {
      resolve({ error: `The TypeScript ainar CLI is not at ${AINAR_CLI}.` });
      return;
    }
    const args = ["--experimental-strip-types", AINAR_CLI, "connections", "add", fields.name];
    for (const [flag, value] of [
      ["--type", fields.type],
      ["--base-url", fields.baseUrl],
      ["--course-id", fields.courseId],
      ["--chat-id", fields.chatId],
    ]) {
      if (value) args.push(flag, String(value));
    }
    if (fields.makeDefault) args.push("--default");

    execFile(
      process.execPath,
      args,
      { cwd: root, timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (error) {
          resolve({ error: output || String(error.message ?? error) });
          return;
        }
        resolve({ ok: true, output });
      },
    );
  });

/**
 * A name for a host a professor will recognise: `canvas.narxoz.kz` becomes
 * `canvas-narxoz`.
 *
 * Derived rather than asked for. A connection name is a handle, it is editable
 * in the file afterwards, and one more field in a setup form is one more thing
 * to get wrong before anything works. Duplicated from `connections/legacy.ts`,
 * where the same heuristic names what a migration finds.
 */
const GENERIC_HOST_LABELS = new Set([
  "canvas",
  "www",
  "lms",
  "moodle",
  "elearning",
  "learn",
  "instructure",
]);

const connectionNameFor = (type, baseUrl) => {
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return `${type}-main`;
  }
  const labels = host.split(".").filter(Boolean);
  const chosen = labels.find(
    (label) => !GENERIC_HOST_LABELS.has(label.toLowerCase()) && label.length > 2,
  );
  return `${type}-${(chosen ?? labels[0] ?? "main").toLowerCase()}`;
};

/**
 * Ask Canvas who the token belongs to. One read, and it proves the pair.
 *
 * Run at the end of setup so that "saved" means "Canvas answered", not "the
 * file was written". A host typed with a typo and a token that is fine are
 * indistinguishable in a config file and obvious the moment something asks.
 */
const canvasWhoAmI = async (host, token) => {
  const response = await fetch(`${String(host).replace(/\/+$/, "")}/api/v1/users/self/profile`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Canvas refused the token (${response.status}). Check it is current and belongs ` +
        "to an account that can see this course.",
    );
  }
  if (!response.ok) throw new Error(`Canvas returned ${response.status}.`);
  const body = await response.json();
  return body?.name ?? body?.login_id ?? (body?.id ? String(body.id) : null);
};

/**
 * Ask Telegram who the bot is. The Bot API puts the token in the path and
 * offers no alternative, so this is the one check that cannot keep a
 * credential out of a URL; it goes to api.telegram.org over HTTPS and the URL
 * is never logged or printed here.
 */
const telegramWhoAmI = async (token) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    throw new Error(
      `Telegram refused (${response.status}): ${body?.description ?? "no detail"}. ` +
        "The token is the one @BotFather gave you.",
    );
  }
  const bot = body.result ?? {};
  return bot.username ? `@${bot.username}` : (bot.first_name ?? null);
};

/**
 * Ask Moodle for its site info, by POST.
 *
 * Every example in Moodle's documentation puts the token in the query string.
 * POST puts it in the body instead, which keeps a credential out of URLs and
 * proxy logs for the price of one header. Moodle also answers 200 and puts
 * the refusal in the body, so the status alone would report a dead token as a
 * working connection.
 */
const moodleWhoAmI = async (host, token) => {
  const response = await fetch(`${String(host).replace(/\/+$/, "")}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      wstoken: token,
      wsfunction: "core_webservice_get_site_info",
      moodlewsrestformat: "json",
    }).toString(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Moodle returned ${response.status}.`);
  if (body?.exception) {
    throw new Error(`Moodle refused the token: ${body.message ?? body.errorcode ?? body.exception}`);
  }
  return body?.sitename ?? body?.username ?? null;
};

/**
 * The id out of a Google Sheets URL, or the id itself.
 *
 * Everyone pastes the URL. Refusing it teaches nothing and extracting the id
 * is one split — the same accommodation `spreadsheetIdOf` makes in
 * `src/lms/sheets.ts`, for the same reason.
 */
const spreadsheetIdFrom = (value) => {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "";
  if (!cleaned.includes("docs.google.com") && !cleaned.startsWith("http")) return cleaned;
  let parts;
  try {
    parts = new URL(cleaned).pathname.split("/").filter(Boolean);
  } catch {
    return cleaned;
  }
  const index = parts.indexOf("d");
  return index >= 0 && index + 1 < parts.length ? parts[index + 1] : cleaned;
};

/**
 * One Canvas course's assignments, so an assessment is bound by picking a name.
 *
 * `points_possible` comes back with each, because it is the one field that
 * makes a suggestion checkable: two assignments can share a name and differ
 * by what they are out of, and a professor scanning a list of twenty-one
 * pairings needs something to disagree with.
 */
const canvasAssignmentList = async (host, token, courseId) => {
  const url =
    `${String(host).replace(/\/+$/, "")}/api/v1/courses/${encodeURIComponent(courseId)}` +
    "/assignments?per_page=100";
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 404) {
    throw new Error(`Canvas has no course ${courseId}, or this token cannot see it.`);
  }
  if (!response.ok) throw new Error(`Canvas returned ${response.status} listing assignments.`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Canvas did not return a list of assignments.");
  return body
    .filter((entry) => entry && entry.id)
    .map((entry) => ({
      id: String(entry.id),
      name: entry.name ?? `Assignment ${entry.id}`,
      points: entry.points_possible ?? null,
      dueAt: entry.due_at ?? null,
    }));
};

/**
 * The courses this token can teach, so a subgroup is bound by picking a name.
 *
 * `enrollment_type=teacher` rather than every course the account can see: a
 * professor's list is short, and the alternative is a picker holding every
 * course they have ever been enrolled in as a student.
 */
const canvasCourseList = async (host, token) => {
  const url =
    `${String(host).replace(/\/+$/, "")}/api/v1/courses` +
    "?enrollment_type=teacher&enrollment_state=active&per_page=100";
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Canvas returned ${response.status} listing courses.`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Canvas did not return a list of courses.");
  return body
    .filter((course) => course && course.id)
    .map((course) => ({
      id: String(course.id),
      name: course.name ?? course.course_code ?? `Course ${course.id}`,
      code: course.course_code ?? null,
      term: course.term?.name ?? null,
    }));
};

const sendErrorPage = (res, text) =>
  send(
    res,
    200,
    "text/html; charset=utf-8",
    '<!doctype html><meta charset="utf-8">' +
      "<style>body{margin:0;padding:14px 16px;font:13px/1.55 system-ui,-apple-system,\"Segoe UI\",sans-serif;" +
      "color:#6b6b6b;background:transparent}" +
      "p{margin:0;border-left:3px solid currentColor;padding-left:10px}" +
      "@media(prefers-color-scheme:dark){body{color:#9a9a9a}}</style>" +
      "<p>" +
      escapeText(text) +
      "</p>",
  );

/**
 * The one route. A prefix rather than five exact ones because the paths under
 * it are this file's own vocabulary and a collision inside it is a typo, not
 * the composition-level contract `webServer.register` is protecting.
 */
const handler = (registry, credentials = { service: null }) => (req, res) => {
  let url;
  try {
    url = new URL(req.url ?? "/", "http://localhost");
  } catch {
    return sendJson(res, 400, { error: "unreadable request URL" });
  }
  const path = url.pathname.slice(BASE.length) || "/";
  const runId = url.searchParams.get("run") ?? "";
  // Which shape a failure takes on this path, decided once: a `/view/` request
  // is an iframe's and gets a page, everything else is a `fetch` and gets JSON.
  const view = path.startsWith("/view/") ? path.slice("/view/".length) : null;
  const fail = (text) =>
    view === null ? sendJson(res, 200, { error: text }) : sendErrorPage(res, text);

  let resolved;
  try {
    // The session the pane is mounted in. `details` is a session-scoped slot, so
    // the browser half always has one; a request without it is still answered,
    // from AINAR_WORKSPACE, because the route is reachable outside the pane.
    resolved = resolveWorkspace(registry, url.searchParams.get("session") ?? "");
  } catch (error) {
    // 200 with the sentence, not 4xx: this is the answer to the pane's
    // question and the pane draws it as prose. A status code would make the
    // browser half decide between "the harness is misconfigured" and "the
    // route is gone", which it cannot tell apart and should not have to.
    return fail(String(error.message ?? error));
  }
  const { workspace, root } = resolved;

  try {
    if (path === "/api/runs") {
      return sendJson(res, 200, runsDocument(workspace, root));
    }

    if (path === "/api/revision") {
      return sendJson(res, 200, revisionDocument(root));
    }

    if (path === "/api/preferences") {
      const course = url.searchParams.get("course") ?? "";
      const term = url.searchParams.get("term") ?? "";

      // A write, and therefore POST only, for `/api/approve`'s reason: a GET
      // that changes a file is one a link, a prefetch or a refresh can fire
      // without anybody having decided to.
      if (req.method === "POST") {
        return readBody(req)
          .then((text) => {
            let body;
            try {
              body = JSON.parse(text || "{}");
            } catch {
              return sendJson(res, 200, { error: "The preferences body is not JSON." });
            }
            const result = writePreferences(
              root,
              String(body.scope ?? ""),
              course,
              term,
              body.values ?? {},
            );
            if (result.error) return sendJson(res, 200, result);
            // The layers as they now are, in the same response. The form is
            // drawn from them, so re-reading here is what makes a Save show
            // the file rather than the browser's memory of it.
            return sendJson(res, 200, {
              ...preferencesDocument(root, course, term),
              saved: result,
            });
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }

      return sendJson(res, 200, preferencesDocument(root, course, term));
    }

    if (path === "/api/integrations") {
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return integrationsAnswer(workspace, root, runId, credentials)
        .then((answer) => sendJson(res, 200, answer))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The credential write. POST only, and the only route in this plugin that
     * accepts a secret.
     *
     * Three properties it has to keep, and each is a line below:
     *
     * **It only ever writes.** No GET returns a value, the response is the
     * redrawn document with presence in it, and nothing is logged. A pane that
     * could read a token back would be a pane that shows one on a screen that
     * gets shared.
     *
     * **It writes only variables the registry names.** Anything else would
     * make this a general-purpose secret writer for any environment variable
     * on the machine, reachable from a browser. The registry's `tokenEnv`
     * values are the whole allowed set.
     *
     * **It refuses rather than pretends.** The seam rejects a write under a
     * shadowing read-only layer, and that rejection is passed through with its
     * reason instead of being turned into a success the professor would
     * discover was a lie the next time a push failed.
     */
    if (path === "/api/credentials") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting a credential is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      if (!credentials.service) {
        return sendJson(res, 200, {
          error:
            "No credential provider is mounted in this composition, so there is nowhere " +
            "to save a token. Export it in the environment instead — `ainar connections " +
            "show NAME` prints which variable.",
        });
      }

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The credential body is not JSON." });
          }

          const ref = String(body.ref ?? "").trim();
          const document = integrationsDocument(workspace, root, runId);
          if (!CREDENTIAL_REF.test(ref) || !credentialRefsIn(document).includes(ref)) {
            return sendJson(res, 200, {
              error:
                `'${ref}' is not a variable any connection in this run names. This route ` +
                "writes only those, so that it cannot be used to set anything else on the machine.",
            });
          }

          // A value that is only whitespace is a clearing, not a credential.
          // The seam treats an empty stored value as absent everywhere, so
          // writing one would leave a record that reads as unconfigured —
          // removing it says the same thing without the litter.
          const value = String(body.value ?? "");
          try {
            if (value.trim()) await credentials.service.set(ref, value.trim());
            else await credentials.service.unset(ref);
          } catch (error) {
            return sendJson(res, 200, { error: String(error?.message ?? error) });
          }

          // Presence only, never the value.
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              saved: { ref, cleared: !value.trim() },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Set an integration up from nothing, or fill in the half that is missing.
     *
     * One route for every provider rather than one each, because the shape is
     * the same for all of them and the differences are three lines apiece:
     * what identifies the destination, where that fact belongs, and what
     * question proves the credential works.
     *
     * The two halves always go to two different places, which is the point of
     * the registry. What identifies the destination is configuration — a host,
     * a channel, a spreadsheet — and lands in the connections registry or the
     * run record. The token is a credential and goes through the seam into the
     * harness's store. Neither lands in this repository.
     *
     * Ordered destination-then-token-then-check, and the order matters. The
     * destination first means a professor who mistypes the token still has the
     * rest recorded and only retries the half that failed. The check last is
     * what lets the answer say "Telegram answered as @course_bot" rather than
     * "saved" — a host with a typo and a token that is fine look identical in
     * a config file and differ the moment something asks.
     */
    if (path === "/api/integrations/setup") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting an integration up is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The setup body is not JSON." });
          }

          const provider = String(body.provider ?? "").trim();
          const token = String(body.token ?? "").trim();
          const baseUrl = String(body.baseUrl ?? "").trim();
          const chatId = String(body.chatId ?? "").trim();
          const sheetId = spreadsheetIdFrom(body.sheetId);

          if (!["canvas", "telegram", "moodle", "sheets"].includes(provider)) {
            return sendJson(res, 200, { error: `'${provider}' is not an integration this pane sets up.` });
          }

          // ---- the destination ------------------------------------------
          let connectionName = null;
          if (provider === "sheets") {
            if (sheetId) {
              const written = writeRunLmsValue(workspace, root, runId, "sheet_id", sheetId);
              if (written.error) return sendJson(res, 200, written);
            }
          } else {
            const identifier = provider === "telegram" ? chatId : baseUrl;
            if (!identifier) {
              return sendJson(res, 200, {
                error:
                  provider === "telegram"
                    ? "A channel is needed — the @name the bot posts to, or its numeric id."
                    : `A ${provider} address is needed — the one you open it at.`,
              });
            }
            connectionName =
              provider === "telegram"
                ? `telegram-${chatId.replace(/^@/, "").toLowerCase()}`
                : connectionNameFor(provider, baseUrl);
            const added = await addConnection(root, {
              name: connectionName,
              type: provider,
              baseUrl: provider === "telegram" ? null : baseUrl,
              chatId: provider === "telegram" ? chatId : null,
              // The first of a type is the one every command should reach
              // without being told. A second one has to be named.
              makeDefault: true,
            });
            if (added.error) return sendJson(res, 200, { error: added.error });
          }

          // ---- the credential -------------------------------------------
          const variable = {
            canvas: "AINAR_CANVAS_TOKEN",
            telegram: "AINAR_TELEGRAM_BOT_TOKEN",
            moodle: "AINAR_MOODLE_TOKEN",
            sheets: "AINAR_SHEETS_TOKEN",
          }[provider];

          if (token) {
            if (!credentials.service) {
              return sendJson(res, 200, {
                error:
                  "The rest was saved, but no credential provider is mounted, so the " +
                  `token could not be. Export ${variable} instead.`,
              });
            }
            try {
              await credentials.service.set(variable, token);
            } catch (error) {
              return sendJson(res, 200, {
                error: `The rest was saved, but the token was not: ${String(error?.message ?? error)}`,
              });
            }
          }

          // ---- the check ------------------------------------------------
          let answered = null;
          let checkFailed = null;
          const live = await resolveCredential(credentials.service, variable);
          const fresh = canvasSettings();
          if (live) {
            try {
              if (provider === "canvas" && fresh.host) {
                answered = await canvasWhoAmI(fresh.host, live);
              } else if (provider === "telegram") {
                answered = await telegramWhoAmI(live);
              } else if (provider === "moodle" && baseUrl) {
                answered = await moodleWhoAmI(baseUrl, live);
              }
              // Sheets is not checked here, deliberately: proving a Google
              // token means reading a spreadsheet, and a green tick that
              // stands for nothing is worse than an honest silence.
            } catch (error) {
              checkFailed = String(error?.message ?? error);
            }
          }

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              setup: {
                provider,
                connection: connectionName,
                answered,
                checkFailed,
                tokenSaved: Boolean(token),
                checked: provider !== "sheets",
              },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The professor's own Canvas courses, so a subgroup is bound by name.
     *
     * POST for `canvasCatalogue`'s reason: it spends the professor's API quota
     * and sends their token, so it happens when they press for it and never
     * because a URL was visited.
     */
    if (path === "/api/canvas/courses") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas courses is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, {
          error: "No Canvas host is configured yet. Set one up above first.",
        });
      }
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then(async (token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Paste one into the ${settings.tokenEnv} field first.`,
            });
          }
          return sendJson(res, 200, { courses: await canvasCourseList(settings.host, usable) });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The assignments of one Canvas course, for the binder below.
     *
     * Takes the course id rather than deriving it: with a Canvas course per
     * subgroup there are several, and the caller is binding one subgroup at a
     * time. POST for `canvasCatalogue`'s reason — it spends the professor's
     * quota and sends their token.
     */
    if (path === "/api/canvas/assignments") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas assignments is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, { error: "No Canvas host is configured yet." });
      }
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          const courseId = String(body.courseId ?? "").trim();
          if (!/^[0-9]+$/.test(courseId)) {
            return sendJson(res, 200, { error: "A numeric Canvas course id is needed." });
          }
          const token = await resolveCredential(credentials.service, settings.tokenEnv);
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Set ${settings.tokenEnv} first.`,
            });
          }
          return sendJson(res, 200, {
            courseId,
            assignments: await canvasAssignmentList(settings.host, usable, courseId),
          });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Bind assessments to Canvas assignments.
     *
     * The body is `{links: {ASSESSMENT-01: "90218" | {CS-401: "90218"}}}` —
     * a string for a run that is one Canvas course, a mapping for one that is
     * several. An entry set to null clears the linkage.
     *
     * Writes into the assessment records, which is the one place in this pane
     * that edits a file `ainar approve` owns. `recordAssessmentLinks` states
     * why that is defensible; the short version is that a Canvas id is a
     * pointer, not a decision.
     */
    if (path === "/api/canvas/assignment-map") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the assignment mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = recordAssessmentLinks(workspace, root, runId, body.links);
          if (result.error) return sendJson(res, 200, result);
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Bind each subgroup to its Canvas course.
     *
     * Writes `extensions.lms.canvas_courses` into the run record, which is
     * what `ainar lms push --group` reads. Unlike `canvas_sections` beside it,
     * this mapping is not decorative: with it set, a push refuses to run
     * without `--group` and carries only that subgroup's students.
     */
    if (path === "/api/canvas/course-map") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the subgroup mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = writeCanvasCourses(workspace, root, runId, body.mapping);
          if (result.error) return sendJson(res, 200, result);

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    // The live Canvas read, and the one outbound request in this plugin. POST
    // for `canvasCatalogue`'s reason: it spends the professor's API quota and
    // sends their token, so it happens when they press for it and never
    // because a URL was visited.
    if (path === "/api/canvas/catalogue") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas catalogue is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const document = integrationsDocument(workspace, root, runId);
      const settings = canvasSettings();
      // Every precondition named separately, because "it did not work" is the
      // one answer this tab must never give: each of these is a different file
      // to go and edit.
      if (!document.canvasCourse.usable) {
        return sendJson(res, 200, {
          error: document.canvasCourse.fromColumn
            ? `This run's Canvas course is recorded as ${document.canvasCourse.fromColumn}, ` +
              "which is a handle rather than the numeric id the API takes. The number is in " +
              "the Canvas course URL; record it as `extensions.lms.canvas_course_id`."
            : "This run has no Canvas course id. It goes on the run record as " +
              "`extensions.lms.canvas_course_id`, and the number is in the Canvas course URL.",
        });
      }
      if (!settings.host) {
        return sendJson(res, 200, {
          error:
            "No Canvas host is configured. Either export AINAR_CANVAS_URL, or write " +
            `${settings.configPath} with a [canvas] table naming base_url.`,
        });
      }
      // Through the seam first, then what this process can see for itself.
      // `canvasSettings` reads `process.env`, which is only one of the two
      // layers a token can now live in — without this, a token the professor
      // had just saved in the field below would be reported missing by the
      // button beside it.
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then((token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error:
                `No Canvas token. Paste one into the ${settings.tokenEnv} field above, or ` +
                `export ${settings.tokenEnv} in your shell. Canvas → Account → Settings → ` +
                "New Access Token. It can change grades, so keep it out of the repository.",
            });
          }
          return canvasCatalogue(document.canvasCourse.id, settings.host, usable).then((result) =>
            sendJson(res, 200, result),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    // The save. POST for `/api/approve`'s reason and one more of its own: this
    // is the only route in the pane that writes to `courses/`.
    if (path === "/api/canvas/assignment") {
      // POST only, for `/api/approve`'s reason: this one reaches outside the
      // machine, and with `--confirm` it changes what a class can see.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "assignment is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(res, 200, { error: "The request body must be an object." });
          }
          return runAssignmentPush(res, root, runId, body);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/api/canvas/selection") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas selection is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The selection body is not JSON." });
          }
          const result = writeCanvasSelection(workspace, root, runId, body.selections);
          if (result.error) return sendJson(res, 200, result);
          // The record as it now is, in the same response, for
          // `/api/preferences`' reason: the form is drawn from this, so
          // re-reading here is what makes a Save show the file rather than the
          // browser's memory of what was ticked.
          // The whole answer travels with every redraw, or saving a selection
          // would blank the credential and status blocks the browser half
          // draws from it.
          return integrationsAnswer(workspace, root, runId, credentials, { saved: result }).then(
            (answer) => sendJson(res, 200, answer),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/file") {
      return sendMaterial(
        res,
        workspace,
        root,
        url.searchParams.get("doc") ?? "",
        url.searchParams.get("dark") === "1",
      );
    }

    // The brief a piece of graded work carries as text rather than as a file.
    // Beside `/file` because it ends in the same overlay and obeys the same
    // rule: addressed by an identifier the course record already names.
    if (path === "/brief") {
      return sendBrief(
        res,
        workspace,
        root,
        runId,
        url.searchParams.get("assessment") ?? "",
        url.searchParams.get("drafts") === "1",
        url.searchParams.get("dark") === "1",
      );
    }

    if (path === "/api/approve") {
      // POST only. Everything else on this route is a read a GET can serve;
      // this one writes to `courses/`, and a side effect behind a GET is one a
      // link, a prefetch or a refresh can fire without anybody deciding to.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "approve is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return runApprove(
        res,
        root,
        runId,
        url.searchParams.get("approver") ?? "",
        url.searchParams.get("confirm") === "1",
      );
    }

    // The two views with no widget behind them. Checked before the widget
    // lookup because `BY_TOOL` has nothing to give them: their content is
    // assembled here, from the run record and from the work directory.
    if (view === "assessments" || view === "slides" || view === "exams") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      const withDrafts = url.searchParams.get("drafts") === "1";
      const on = url.searchParams.get("date");
      const host = req.headers.host;
      const session = url.searchParams.get("session") ?? "";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "assessments"
          ? assessmentsDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              on,
              host ? `http://${host}` : "",
              session,
            )
          : view === "slides"
            ? slidesDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              )
            : examsDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              ),
      );
    }

    // The class list. No drafts toggle: `DRAFTABLE` refuses enrollments in a
    // draft file, so there is never a drafted half of this view to show, and a
    // toggle that changed nothing would suggest otherwise.
    if (view === "students") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        studentsDocument(
          workspace,
          runId,
          url.searchParams.get("dark") === "1",
          // Opt-in per request. The pane asks for names only when the professor
          // has pressed for them, so a route replayed from a log or a history
          // entry without the parameter renders pseudonyms.
          url.searchParams.get("names") === "1",
          req.headers.host ? `http://${req.headers.host}` : "",
          url.searchParams.get("session") ?? "",
        ),
      );
    }

    // The Checklist. No drafts toggle, for `ready`'s reason and one more of its
    // own: this view IS the record-against-drafts comparison — every row says
    // which half a thing is in — so a setting that removed one half would
    // remove the answer rather than narrow it.
    if (view === "checklist") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        checklistDocument(workspace, root, runId, url.searchParams.get("dark") === "1"),
      );
    }

    if (view === "grading" || view === "ready") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      // `grading` honours the drafts toggle, because a drafted assessment
      // carries a weight and changes the scheme. `ready` does not take it:
      // it reads `work/` whatever the toggle says — that IS the drafted half,
      // and a "Record" setting that emptied it would be answering a question
      // nobody asked.
      const withDrafts = url.searchParams.get("drafts") === "1";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "grading"
          ? gradingDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              url.searchParams.get("date"),
            )
          : readyDocument(workspace, root, runId, dark),
      );
    }

    if (view !== null && Object.hasOwn(VIEWS, view)) {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const tool = VIEWS[view].tool;
      const widget = BY_TOOL.get(tool);
      if (!widget) return sendErrorPage(res, `no widget is bound to ${tool}`);
      // `drafts=1` merges `work/<RUN>/` over the record. The response carries
      // the draft loader's own complaints in a header rather than in the
      // document, because the document is a widget shared with two other hosts
      // and has no place to print them; the pane reads the header and says so
      // in its own chrome, above the frame.
      const withDrafts = url.searchParams.get("drafts") === "1";
      let data;
      let noted = [];
      if (withDrafts) {
        const drafted = draftedPayload(workspace, root, tool, runId, url.searchParams.get("date"));
        data = drafted.payload;
        // "There are no drafts" is not a complaint worth putting on screen.
        //
        // `draft.empty` and `draft.missing` mean the work directory is empty or
        // absent, which since `+ drafts` became the default view is the ordinary
        // state of a course whose proposals have all been approved. The banner
        // used to read `warning:draft.empty` followed by an absolute path, on a
        // course where nothing was wrong at all. Every other complaint — a file
        // that will not parse, a collection that may not be drafted — still
        // shows, because those are things a person can fix.
        noted = drafted.issues.filter(
          (issue) => issue.code !== "draft.empty" && issue.code !== "draft.missing",
        );
      } else {
        data = payload(workspace, tool, { course_version_id: runId });
      }
      // Only the outline carries resources; the other views have none to link.
      if (view === "outline") {
        const host = req.headers.host;
        data = withMaterialLinks(
          data,
          host ? `http://${host}` : "",
          url.searchParams.get("session") ?? "",
          workspace,
          url.searchParams.get("dark") === "1",
          withDrafts,
        );
        const run = data?.run ?? {};
        if (run.course_id && run.term) {
          data = withRecordPaths(
            data,
            root,
            run.course_id,
            run.term,
            (data.weeks ?? []).flatMap((week) => week.undated ?? []),
          );
        }
        // The week view is the weeks. Assessments and the grading policy are
        // two tabs of their own now, and rendering them here as well put a
        // table and a policy note between the professor and what they opened
        // this tab for. The widget keeps both by default — a chat client has no
        // tabs to move them to — so the pane has to ask.
        data = { ...data, sections: { assessments: false, grading: false, header: false } };
      }
      if (view === "tasks") {
        // Where each dateless assessment lives, so the widget's "set dates"
        // button can name the record instead of a directory. The inbox payload
        // carries no `course_id` — only the run's own id and term — so the
        // course is read off the bundle rather than parsed out of the run id,
        // which is a convention and not a guarantee.
        let courseId = null;
        try {
          courseId = workspace.findRun(runId)?.course?.course_id ?? null;
        } catch {
          // The payload built, so the run is real; without the bundle the
          // prompt falls back to telling the model to grep for the id.
          courseId = null;
        }
        const term = data?.run?.term ?? null;
        if (courseId && term) {
          data = withRecordPaths(
            data,
            root,
            courseId,
            term,
            (data.assessments ?? []).filter((row) => !row.due_at),
          );
        }
        // Names on the inbox, and nowhere else a widget is served. Opt-in per
        // request exactly as the class list is, so a URL replayed without the
        // parameter renders pseudonyms.
        if (url.searchParams.get("names") === "1") data = withStudentNames(data);
      }
      const dark = url.searchParams.get("dark") === "1";
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      if (noted.length) {
        res.setHeader(
          "x-professor-pane-draft-issues",
          // One header line, so it survives a header value's own rules: no
          // newlines, and nothing outside Latin-1. A code and a location are
          // both identifiers, and the message is dropped rather than mangled.
          encodeURIComponent(
            noted
              .map((issue) => `${issue.level}:${issue.code}${issue.location ? " " + issue.location : ""}`)
              .join(" | "),
          ),
        );
      }
      return send(res, 200, "text/html; charset=utf-8", widgetDocument(widget, data, dark));
    }

    return sendJson(res, 404, { error: `no route ${path} under ${BASE}` });
  } catch (error) {
    if (error instanceof ToolError) return fail(error.message);
    // An unexpected throw is a bug in this file or in the loader, and the
    // message is the only thing that will get it fixed. It reaches one
    // professor's own browser on one loopback port; there is nobody to leak to.
    return fail(String((error && error.message) || error));
  }
};

/**
 * Cordis waits for `webServer` before calling this, so the route is live from
 * the moment the fiber activates and the disposer the registry returns is what
 * makes an unload actually unload.
 */
export function apply(ctx) {
  /**
   * The credential seam, if this composition has one.
   *
   * A holder rather than a direct `ctx.credentials`, because reading a service
   * that is not in `inject` throws — and putting `credentials` in `inject`
   * would make the WHOLE pane fail to activate wherever no provider is
   * mounted. Losing the outline, the inbox and the class list because nobody
   * can type a Canvas token is the wrong trade, so the dependency is a nested
   * fiber: it fills the holder while a provider is live and empties it when
   * one goes away, and the routes check.
   *
   * This cordis has no `inject: { optional }` form — every key in the object
   * shape is required — which is why the nested fiber is the idiom here rather
   * than a declaration.
   */
  const credentials = { service: null };
  ctx.inject(["credentials"], (scoped) => {
    credentials.service = scoped.credentials;
    scoped.on("dispose", () => {
      credentials.service = null;
    });
  });

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: BASE,
        handler: handler(ctx.workspaceRegistry, credentials),
      }),
    "professor-pane: the /professor-pane route",
  );
}
