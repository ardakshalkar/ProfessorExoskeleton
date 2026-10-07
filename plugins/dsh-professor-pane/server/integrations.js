/**
 * What a run is wired to: its LMS linkage on the run record, the connection
 * registry, credential presence, and the document `/api/integrations` answers.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { assessmentsOf, enrollmentsOf, groupsOf, runById } from "@ainar/core/src/bundle.ts";

import { isTodo } from "./page.js";
import { loadedRun, rosterDir, rosterPath, rosterPeople } from "./workspace.js";

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
export const LMS_EXTENSION = "lms";
const LMS_TARGETS = ["canvas-csv", "canvas-api", "sheet-csv", "sheets-api"];
const LIVE_LMS_TARGETS = new Set(["canvas-api", "sheets-api"]);
export const CANVAS_SECTIONS_KEY = "canvas_sections";
/**
 * One Canvas course per subgroup, for a run taught in several Canvas shells.
 *
 * Duplicated from `src/lms/index.ts` for `LMS_TARGETS`' reason and with the
 * same consequence if it drifts: this pane is vendored and cannot import from
 * ainar-node, so the key name is repeated here and a mismatch would write a
 * mapping the pusher does not read.
 */
export const CANVAS_COURSES_KEY = "canvas_courses";
export const CANVAS_ASSIGNMENTS_KEY = "canvas_assignments";

/** `extensions.lms` as an object, whatever the record actually holds there. */
export const lmsLinkage = (record) => {
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
export const lmsString = (record, key) => {
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
export const CREDENTIAL_REF = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
export const resolveCredential = async (service, name) => {
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
export const integrationsAnswer = async (workspace, root, runId, credentials, extra = {}) => {
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
export const credentialRefsIn = (document) =>
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
export const canvasSettings = (registry = registryConnections()) => {
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
export const versionRecordPath = (root, courseId, term) =>
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
export const integrationsDocument = (workspace, root, runId) => {
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
