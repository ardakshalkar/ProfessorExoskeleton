/**
 * The host half of the professor's visualization pane.
 *
 * It registers one prefix route and nothing else. Everything the pane draws
 * comes back through `/professor-pane/...`, and everything behind that route is
 * a read: `callTool` from `dsh-ainar-course-model`, which is read-only by
 * construction, plus the preference files, which are read with `readFileSync`.
 * There is no write verb in this file and no place to add one — a pane that
 * could approve a grade would be a second approval path, and `AGENTS.md` says
 * there is one and the professor runs it.
 *
 * Why HTTP rather than a service the browser half calls: the four views this
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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { runById } from "dsh-ainar-course-model/server/bundle.js";
import { loadDrafts, mergeDrafts } from "dsh-ainar-course-model/server/drafts.js";
import { gradebookPayload } from "dsh-ainar-course-model/server/gradebook.js";
import { inboxPayload } from "dsh-ainar-course-model/server/inbox.js";
import { IssueList } from "dsh-ainar-course-model/server/issues.js";
import { callTool } from "dsh-ainar-course-model/server/mcp/tools.js";
import { BY_TOOL } from "dsh-ainar-course-model/server/mcp/widgets.js";
import {
  ToolError,
  Workspace,
  referenceDate,
  workspaceRootFor,
} from "dsh-ainar-course-model/server/mcp/workspace.js";
import { outlinePayload } from "dsh-ainar-course-model/server/outline.js";
import { dashboardPayload } from "dsh-ainar-course-model/server/progress.js";
import { parse as parseYaml } from "yaml";

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
 * The four tabs, in the order the button bar shows them.
 *
 * `widget` names a document in `dsh-ainar-course-model`'s manifest, keyed there
 * by tool. `preferences` has no widget because no tool returns preferences —
 * that view is drawn by the browser half from `/api/preferences` below.
 */
const VIEWS = {
  outline: { tool: "course_outline" },
  progress: { tool: "class_progress" },
  gradebook: { tool: "gradebook" },
  tasks: { tool: "action_inbox" },
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
      if (standing) return { workspace: new Workspace(standing, "session"), root: standing };
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
  return { workspace: new Workspace(fallback, "env"), root: fallback };
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
 * `versions/<term>/assessments/generated.yaml`, because that is where
 * `approve` writes. It is a guess. `RECORD_GLOBS.assessments` accepts
 * `versions/*​/assessments.yaml` as well as `versions/*​/assessments/*.yaml`,
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
const withRecordPaths = (data, root, courseId, term) => {
  if (data === null || typeof data !== "object") return data;
  const wanted = new Set();
  for (const week of data.weeks ?? []) {
    for (const entry of week.undated ?? []) {
      if (entry?.assessment_id) wanted.add(entry.assessment_id);
    }
  }
  if (!wanted.size) return data;

  const base = join(root, "courses", courseId, "versions", term);
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

  for (const week of data.weeks ?? []) {
    for (const entry of week.undated ?? []) {
      const path = found.get(entry?.assessment_id);
      if (path) entry.source_file = path;
    }
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
const revisionDocument = (root) => {
  const hash = createHash("sha256");
  let files = 0;

  const walk = (directory, depth) => {
    // Deep enough for versions/<term>/<collection>/<file>.yaml with room to
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
const preferencesDocument = (root, courseId, term) => {
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
        path: join(root, "courses", courseId, "versions", term, "preferences.yaml"),
      });
    }
  }

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
    note:
      "Read-only. Four layers resolve on top of each other and the last one — " +
      "flags on the invoking command — is not a file, so it is not shown. " +
      "Editing a preference means editing the file its row names.",
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

const escapeText = (value) =>
  String(value).replace(
    /[&<>]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character],
  );

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
  ":root{--fg:#1f1f1f;--dim:#6b6b6b;--line:#e3e3e3;--warn:#8a6d1f;--warnbg:#fdf6e3}" +
  (dark
    ? ":root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;--warn:#d8b55a;--warnbg:#2e2a1e}"
    : "@media(prefers-color-scheme:dark){:root{--fg:#e8e8e8;--dim:#9a9a9a;--line:#3a3a3a;" +
      "--warn:#d8b55a;--warnbg:#2e2a1e}}") +
  "body{margin:0;padding:14px 16px;font:13px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;" +
  "color:var(--fg);background:transparent}" +
  "h2{font-size:13px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}" +
  "section{margin:0 0 18px}" +
  "p{margin:0 0 8px}" +
  ".dim{color:var(--dim)}" +
  ".row{display:flex;gap:10px;justify-content:space-between;padding:5px 0;" +
  "border-bottom:1px solid var(--line)}" +
  ".row:last-child{border-bottom:none}" +
  ".k{min-width:0;overflow-wrap:anywhere}" +
  ".v{color:var(--dim);white-space:nowrap}" +
  ".todo{background:var(--warnbg);color:var(--warn);border-radius:3px;padding:0 5px;" +
  "font-size:12px;white-space:nowrap}" +
  "code{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--warnbg);" +
  "color:var(--warn);border-radius:3px;padding:1px 5px}" +
  ".empty{border-left:3px solid var(--line);padding-left:10px;color:var(--dim)}" +
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
              escapeText(row.title ?? row.assessment_id ?? "untitled") +
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
const withMaterialLinks = (data, origin, sessionId, workspace) => {
  if (!origin || data === null || typeof data !== "object") return data;

  const address = (documentId) =>
    `${origin}${BASE}/file?doc=` +
    encodeURIComponent(documentId) +
    (sessionId ? "&session=" + encodeURIComponent(sessionId) : "");

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
  for (const courseId of workspace.courseIds()) {
    let loaded;
    try {
      loaded = workspace.load(courseId);
    } catch {
      continue;
    }
    if (loaded.bundle === null) continue;
    for (const document of loaded.bundle.documents ?? []) {
      const key = String(document.storage_key ?? "");
      if (!key || key.includes("://")) continue;
      const name = key.split(/[\\/]/).pop() ?? "";
      const dot = name.lastIndexOf(".");
      if (dot <= 0) continue;
      const stem = name.slice(0, dot);
      const extension = name.slice(dot + 1).toLowerCase();
      if (!byStem.has(stem)) byStem.set(stem, []);
      byStem.get(stem).push({ id: document.document_id, extension });
    }
  }

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
        .map((entry) => ({ label: entry.extension.toUpperCase(), url: address(entry.id) }));
    }
    return [];
  };

  const link = (resource) => {
    if (!resource || typeof resource !== "object") return resource;
    if (!resource.document_id) return resource;
    const formats = formatsFor(resource.document_id);
    const url = resource.url || address(resource.document_id);
    return { ...resource, url, formats };
  };

  for (const week of Array.isArray(data.weeks) ? data.weeks : []) {
    for (const meeting of Array.isArray(week.meetings) ? week.meetings : []) {
      if (Array.isArray(meeting.resources)) meeting.resources = meeting.resources.map(link);
    }
  }
  if (Array.isArray(data.required_materials)) {
    data.required_materials = data.required_materials.map(link);
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
 */
const sendMaterial = (res, workspace, root, documentId) => {
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
  const type =
    MIME_BY_EXTENSION[extension] ??
    (typeof found.mime_type === "string" && found.mime_type ? found.mime_type : "application/octet-stream");

  res.setHeader("Content-Type", type);
  // `inline` so a deck opens in whatever the browser has rather than landing in
  // Downloads, and the filename so that when it does download it keeps its name.
  res.setHeader("Content-Disposition", `inline; filename="${basename(full).replace(/"/g, "")}"`);
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
const handler = (registry) => (req, res) => {
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
      return sendJson(
        res,
        200,
        preferencesDocument(
          root,
          url.searchParams.get("course") ?? "",
          url.searchParams.get("term") ?? "",
        ),
      );
    }

    if (path === "/file") {
      return sendMaterial(res, workspace, root, url.searchParams.get("doc") ?? "");
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
        );
        const run = data?.run ?? {};
        if (run.course_id && run.term) {
          data = withRecordPaths(data, root, run.course_id, run.term);
        }
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
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: BASE,
        handler: handler(ctx.workspaceRegistry),
      }),
    "professor-pane: the /professor-pane route",
  );
}
