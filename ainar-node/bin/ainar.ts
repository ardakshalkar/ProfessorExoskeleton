/**
 * The whole CLI, in Node.
 *
 *     node --experimental-strip-types bin/ainar.ts <command> [args]
 *
 * Most commands here are a **surface over already-verified code**: they parse
 * arguments and print, and the payload underneath is one the golden fixtures
 * hold to the implementation this port replaces. No logic is reimplemented in
 * those, so nothing in them can drift in a way `npm run golden` would not catch.
 *
 * `approve` is the oldest exception, and it is not a surface over verified code —
 * it is a second implementation of the one gate, which is exactly what the
 * migration plan argued against on the grounds that two gates can disagree. What
 * made it defensible was that the disagreement was *measured*: both gates were
 * run over the same drafts and the trees they wrote compared, the emitters were
 * compared scalar by scalar, and the refusal is the same width — all 94 checks,
 * held there by the 98 mutations in `workspace/golden/validator/`. It still prints its
 * coverage on every run, because that number is the gate and a reader should not
 * have to trust it.
 *
 * ## The write verbs
 *
 * There used to be a `REFUSED` table here: `lms`, `score-items`, `sql` and
 * `export` printed "run `python -m ainar` for that" and exited 1, and `dashboard`
 * and `page` were absent entirely. All six were ported on 2026-09-08 and Python
 * is not a dependency of this project any more — `PROVENANCE.md` records what
 * each was checked against. Each writes something, so each says what it wrote and
 * where; `score-items` and `import-submissions` take `--dry-run`, and the two
 * live `lms` targets take `--confirm` instead, because a dry run of a grade post
 * is a plan and this file already prints one.
 *
 * `lms` is the only command that reaches a third party, and the whole of it lives
 * in `src/lms/` — this file parses its arguments and nothing else.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import {
  courseContext,
  enrollmentsOf,
  groupsOf,
  itemById,
  requireGroups,
  runById,
} from "../src/bundle.ts";
import { blueprintPayload } from "../src/blueprint.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { calibrationPayload, pendingPayload, rubricPayload } from "../src/grading.ts";
import { inboxPayload } from "../src/inbox.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { dashboardPayload, rollUpCapabilities, studentRecord } from "../src/progress.ts";
import { extractEvidence } from "../src/evidence.ts";
import { bundleStats, exportBundle } from "../src/export.ts";
import { buildScript, schemaSql } from "../src/sqlgen.ts";
import { renderHtml } from "../src/dashboard.ts";
import { TARGETS } from "../src/lms/index.ts";
import { MATCH_KEYS } from "../src/lms/base.ts";
import { runLms } from "../src/lms/command.ts";
import { runConnections } from "../src/connections/command.ts";
import { outlinePayload } from "../src/outline.ts";
import { loadStructure, loadStyle } from "../src/templates.ts";
import {
  copyMaterials,
  href,
  linkMaterials,
  publishable,
  renderPage,
  renderStatic,
  scanOrRefuse,
} from "../src/page.ts";
// @ts-ignore -- plain .mjs so `node prerender-widget.mjs` still needs no flags
import { prerender } from "./prerender-widget.mjs";
import { alignmentMarkdown, syllabusMarkdown } from "../src/report.ts";
import { coverage, validate } from "../src/validate.ts";
import { IssueList, describe } from "../src/issues.ts";
import { DRAFTABLE, draftFiles, mergeDrafts } from "../src/drafts.ts";
import {
  dominantMisconception,
  emptyResult,
  scoreChoiceItems,
  successRate,
} from "../src/scoring.ts";
import {
  ENROLLMENTS_HEADER,
  type Enrollment,
  RosterStore,
  buildRoster,
  loadSalt,
  readRows,
  reconcileEnrollments,
  refuseInsideRepo,
  rosterDir,
} from "../src/roster.ts";
import { dump } from "../src/yaml-out.ts";
import { SCHEMA_NAMES, jsonSchemaFor, shapeText } from "../src/schema.ts";
import {
  explainMissing,
  findConnection,
  loadRegistry,
  tokenFor,
  tokenPresent,
} from "../src/connections/index.ts";
import {
  type AuthMode,
  describePlan,
  planPublish,
  publish,
  resolveAuth,
} from "../src/homework.ts";
import { archiveRun, migrateLayout } from "../src/layout.ts";
import { newCourse, newRun } from "../src/scaffold.ts";
import { LAYOUT, measureDeck } from "../src/deck.ts";
import { buildMaterials } from "../src/materials.ts";
import { importMaterial } from "../src/materials-import.ts";
import {
  floatPaths,
  decidedAt,
  runApproval,
  writeRecords,
} from "../src/approve.ts";
import {
  MATERIAL_COLLECTIONS,
  // `TARGETS` is taken by the gradebook targets above, and these are a
  // different list of a different kind of thing.
  TARGETS as PUBLISH_TARGETS,
  type Target,
  announcementDigest,
  announcementText,
  checkAnnouncement,
  describePublication,
  destinations,
  editAnnouncement,
  isUpdate,
  materialChecksums,
  pagePlan,
  outstanding,
  pendingMaterials,
  publishPlan,
  readChannel,
  sendAnnouncement,
} from "../src/publish.ts";
import { FetchTransport } from "../src/lms/http.ts";
import {
  describeFreshness,
  fingerprints,
  freshness,
  heldBackForStaleness,
  nothingChanged,
  restamp,
} from "../src/freshness.ts";
import { Ledger } from "../src/lms/ledger.ts";
import { Workspace } from "../src/workspace.ts";



const args = process.argv.slice(2);

const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

/**
 * Flags that take no value, so the loop below does not eat the argument after
 * them.
 *
 * Without this list `ainar roster import --dry-run export.csv` loses the file —
 * `--dry-run` swallows it as its value and the command reports a usage error
 * about an argument that is right there on the line. The same trap was waiting
 * for `--keep-absent`, which is what made it worth naming them all.
 */
const BOOLEAN_FLAGS = new Set([
  "dry-run",
  "no-pdf",
  "json",
  "verbose",
  "keep-absent",
  "partial",
  "rescore",
  "ddl",
  "prune",
  // Accepted and ignored: `page` cannot produce a page that needs JavaScript
  // any more, so there is nothing left for this to refuse. A skill still
  // passing it should not fail.
  "static",
  // `lms`
  "allow-partial",
  "with-names",
  "no-comments",
  "comments",
  "confirm",
  // `homework publish` and `publish homework`. It takes no value, and left out
  // of this list it swallows whatever follows it — so `--private` written
  // before the assessment id loses the assessment id.
  "private",
  // `publish telegram --edit`: correct the last announcement rather than
  // posting a second one.
  "edit",
  "quiet",
  "overwrite-drift",
  "summary",
  "all",
  // `connections add`
  "default",
]);

/** Every occurrence of a repeatable flag, with comma-separated values split. */
const flagList = (name: string): string[] => {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== `--${name}`) continue;
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) continue;
    for (const entry of value.split(",")) {
      const trimmed = entry.trim();
      if (trimmed) values.push(trimmed);
    }
  }
  return values;
};

/** Positional arguments only — a flag may sit before the command or after it. */
const positional: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const value = args[index]!;
  if (value.startsWith("--")) {
    if (!BOOLEAN_FLAGS.has(value.slice(2))) index += 1; // skip the flag's value
    continue;
  }
  positional.push(value);
}

const command = positional[0] ?? "help";
const rest = positional.slice(1);
// Which of the two produced the root is kept, so a "no courses/ here" answer
// can tell the professor to move or to pass `--root` rather than to fix an
// environment variable this CLI has never read.
const rootFlag = flag("root");
const root = resolve(rootFlag ?? process.cwd());
const workspace = new Workspace(root, rootFlag ? "flag" : "cwd");

const out = (value: unknown): void =>
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/** The bundle owning a run. */
const forRun = (courseVersionId: string) => workspace.findRun(courseVersionId);

/**
 * The workspace's only course, for commands that take a drafts directory rather
 * than a run id. Ambiguity is an error rather than a guess: approving into the
 * wrong course would write records a person never reviewed.
 */
const onlyCourse = () => {
  const ids = workspace.courseIds();
  if (ids.length !== 1) {
    throw new Error(
      `this workspace holds ${ids.length} courses (${ids.join(", ")}); name the run with --course-version`,
    );
  }
  return workspace.load(ids[0]!).bundle!;
};

/** The bundle's only run, on the same terms. */
const soleRun = (bundle: ReturnType<typeof onlyCourse>): string => {
  const runs = [...runById(bundle).keys()];
  if (runs.length !== 1) {
    throw new Error(
      `this course has ${runs.length} runs (${runs.join(", ")}); name one with --course-version`,
    );
  }
  return runs[0]!;
};

const HELP = `ainar — the AINAR course model CLI

  validate [COURSE]        referential checks, ${coverage().implemented} of ${coverage().total}
  stats [COURSE]           how much of the model is filled in
  context RUN [--date D]   the Course Context document
  syllabus RUN             the syllabus, as markdown
  alignment RUN            the constructive alignment report
  gradebook RUN [--assessment A] [--group G]
  pending RUN [--assessment A]
  rubric ASSESSMENT
  student RUN STUDENT
  class-progress RUN [--group G]
  inbox RUN [--date D] [--group G]
  calibration RUN
  blueprint RUN
  approve DRAFTS --as USER [--only IDS] [--reject IDS] [--dry-run]

  roster import FILE.csv [--run RUN] [--id-column C] [--name-column C]
                         [--email-column C] [--group-column C]
                         [--delimiter D] [--group G] [--keep-absent] [--dry-run]
  roster show [--run RUN] [--out PATH]     PRIVATE: names, to a terminal
  roster whois STUDENT-XXXXXX              PRIVATE: one identity
  roster groups [--run RUN]                the subgroups, and who is in them
  roster status                            where the identities live

  schema [ENTITY] [--json] [--out DIR]     what a record must look like
  new course COURSE_ID [--title T] [--credits N] [--department D]
  new run COURSE_ID TERM --start YYYY-MM-DD --end YYYY-MM-DD
  homework publish ASSESSMENT [--repo owner/name] [--private] [--confirm]
                                           plan it; --confirm creates and pushes

  Publishing, with the gate folded in. Each of these reads and prints a plan;
  --confirm promotes the drafted DOCUMENTS AND RESOURCES the publication needs
  — never an evaluation, which is \`approve\` and is yours — and then publishes:

  publish page RUN [--as USER] [--out DIR] [--template T] [--structure S]
  publish telegram RUN --message TEXT | --message-file PATH [--chat-id C]
  publish homework ASSESSMENT --run RUN [--repo owner/name] [--private]
  publish canvas ASSESSMENT --run RUN [--group G] [--overwrite-drift]

  The approver recorded against a promoted material is --as, or the run's first
  instructor. A draft the record already holds is left alone rather than
  promoted twice, so publishing the same run again publishes rather than
  colliding.
  migrate-layout [COURSE_ID…] [--dry-run]  move off versions/<TERM>/, once
  archive-run [--force] [--dry-run]        pack the finished term into archive/
  deck fit FILE.md [--verbose]            will each slide fit on the page

  Enrollments hold pseudonyms only. Names, numbers and emails go to
  --roster-dir (default ~/.ainar/roster, or AINAR_ROSTER_DIR), which must
  stay outside the workspace and must never be committed.

  An import never deletes: a student the export no longer lists is marked
  \`status: dropped\`, and every count in the model reads only \`active\`.
  --group G restricts that to one subgroup, for a class whose exports arrive
  one subgroup at a time; --keep-absent turns the marking off entirely.

  --group narrows gradebook, class-progress and inbox to one subgroup, and
  the term plan to the meetings that subgroup attends — an activity with no
  group is the whole run's and stays in every subgroup's view. It may be
  repeated or given a comma-separated list, and a label this run does not
  have is refused rather than answered with an empty class.

  These derive records and write them into courses/. Each validates the merged
  bundle first and writes nothing if it fails, and each takes --dry-run:

  extract-evidence [RUN] [--dry-run]   evidence from approved decisions and scored items
  roll-up [RUN] [--dry-run]            capability states from that evidence

  These write files. Each says what it wrote and where:

  score-items DRAFTS --course-version RUN [--partial] [--rescore] [--dry-run]
  export [COURSE] [--out DIR]              canonical JSON, default dist/
  sql [COURSE] [--out DIR] [--prune]       an idempotent PostgreSQL import
  sql --ddl [--out FILE]                   the schema the import expects

  Two HTML surfaces, and deliberately opposite ones. dashboard draws marks by
  pseudonym and is the professor's; page draws the plan and is the only output
  here written to be hosted where students can read it.

  dashboard RUN [--json] [--out PATH] [--template T]
  page RUN [--date D] [--out DIR] [--template T] [--structure S]

  materials build RUN [--only ID] [--no-pdf] [--dry-run] [--materials DIR]
  materials import RUN FILE.pptx --as DOC-ID [--module M] [--title T] [--dry-run]

  Producing a material and registering it, as one act. The producers a course
  declares in its materials.yaml are run, what they make is converted and
  described, and ONE draft is written through the same schema and emitter
  approve uses. Nothing is written to courses/: approval stays the only way in,
  and this narrows what reaches it to records already known to be valid.

  --template is appearance only: a style sheet, refused if it carries markup or
  fetches anything, and refused outright if it declares a different surface.
  --structure is the section layout for page, on the same terms.

  The gradebook targets. plan and diff are read-only; push to a -csv target
  writes a file somebody still has to upload, and the two -api targets reach a
  live gradebook, need --confirm, and are not for an agent to run:

  lms plan RUN --assessment A [--target T] [--from export.csv] [--json]
  lms diff RUN --assessment A [--target T] [--from export.csv]
  lms push RUN --assessment A --target canvas-csv --from export.csv --out FILE
  lms push RUN --assessment A --target sheet-csv --out FILE [--with-names]
  lms push RUN --assessment A --target canvas-api --confirm [--comments]
  lms push RUN [--assessment A | --summary | --all] --target sheets-api --confirm
  lms import-submissions RUN --assessment A [--target T] [--out FILE] [--dry-run]

  lms assignment-plan RUN --assessment A [--group G]        what Canvas would get
  lms assignment-push RUN --assessment A [--group G] --confirm [--overwrite-drift]

  The assignment pair moves the DEFINITION — title, points, dates, what may be
  handed in, and the brief as the description — not the marks. It fans out to
  every Canvas course the run names, because one definition serves every
  subgroup; --group narrows it to one. A field a person edited in Canvas is
  reported and left alone unless --overwrite-drift says otherwise.

  --target is canvas-csv (default), canvas-api, sheet-csv or sheets-api.
  --connection NAME picks a host from the connections registry; without it the
  registry's default for that type is used, then lms.toml. --canvas-url still
  overrides everything, for one invocation.
  --group G is required when the run has a Canvas course per subgroup
  (extensions.lms.canvas_courses). One push reaches one Canvas course, so it
  is run once per subgroup and carries only that subgroup's students.
  --by is sis-id (default), login or email — how a target's rows match ours.
  --allow-partial exports a partly graded assessment. --overwrite-drift
  replaces a value somebody edited in the target; without it, a drifted cell is
  reported and left alone.

  Names, numbers and emails come from the private roster at the moment of
  export and are never written back. A file naming students may not land
  inside the workspace, and the command refuses a path that would.

  Every outbound connection, in one registry. A connection is a host, the
  non-secret ids that pin down a course or a channel, and the NAME of the
  variable holding the credential — never the credential itself:

  connections list [--json]                what is configured, and what is broken
  connections show NAME                    one connection, in full
  connections doctor [NAME] [--json]       ask each provider whether it agrees
  connections add NAME --type T [--base-url URL] [--course-id N] [--chat-id C]
                       [--forum-id F] [--key-file P] [--token-env VAR]
                       [--default] [--dry-run]
  connections migrate [--dry-run]          build it from what is already here
  connections path                         where the registry lives

  add writes one connection and refuses anything that could not be used. There
  is no --token: the registry holds the NAME of the variable, never a value.
  An update keeps every field this call does not mention.

  migrate reads lms.toml, the prof-publish profiles and the AINAR_* hosts that
  are set. It only ever adds: an existing connection is never edited and no
  legacy file is touched. A literal token found in one is reported and NOT
  copied — it should be revoked, not relocated.

  --connections FILE       the registry (default: ~/.ainar/connections.json)

  --root DIR               the workspace (default: the current directory)
  --roster-dir DIR         where identities live (default: ~/.ainar/roster)`;

/**
 * A path under the workspace shown relative to it, and anything else shown in
 * full. `Path.is_relative_to` in `cmd_export`, which is how `--out ../elsewhere`
 * prints an absolute path rather than a wall of `..`.
 */
const within = (base: string, path: string): string => {
  const rel = relative(base, path);
  return rel && !rel.startsWith("..") ? rel : path;
};

/** `_emit` in `ainar/commands/common.py`: to `--out` if there is one, else stdout. */
const emit = (text: string): void => {
  const target = flag("out");
  if (!target) {
    out(text);
    return;
  }
  const path = resolve(target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf-8" });
  out(`wrote ${within(root, path)}`);
};

const today = (): string => new Date().toISOString().slice(0, 10);

const onDate = (courseVersionId: string): string => {
  const given = flag("date");
  if (given) return given;
  const run = runById(forRun(courseVersionId)).get(courseVersionId) as any;
  const now = today();
  return now < run.start_date ? run.start_date : now > run.end_date ? run.end_date : now;
};

/**
 * `--group`, checked against the run before anything is filtered by it.
 *
 * A subgroup nobody is in is almost always a typo, and the shape of the
 * mistake is an empty class rather than an error — every count reads zero and
 * nothing says why. `requireGroups` turns it into a refusal that names the
 * groups the run does have.
 */
const runGroups = (courseVersionId: string): string[] =>
  requireGroups(forRun(courseVersionId), courseVersionId, flagList("group"));

/**
 * The enrollments already written for a term, exactly as the file holds them.
 *
 * Read from the file rather than from the loaded bundle deliberately. The
 * bundle has been through the schema, which fills in every default the author
 * did not write; this list is about to be written straight back out, so
 * sourcing it from the bundle would reformat every row on the first re-import
 * and bury the two or three that actually changed.
 *
 * A file that exists but is not shaped like an enrollments file is a refusal,
 * not an empty list — silently treating it as empty would overwrite it.
 */
const readEnrollments = (path: string): Enrollment[] => {
  if (!existsSync(path)) return [];
  const parsed = parse(readFileSync(path, "utf-8")) as { enrollments?: unknown } | null;
  const entries = parsed?.enrollments ?? null;
  if (entries === null) return [];
  if (!Array.isArray(entries)) {
    throw new Error(`${path} holds no \`enrollments:\` list; refusing to overwrite it`);
  }
  return entries as Enrollment[];
};

/**
 * Write the students' page, and say what went on it.
 *
 * Ported from `cmd_page` in `ainar/commands/page.py`. The public surface, and
 * deliberately the opposite of `dashboard`: it draws the plan, and it is the
 * only output here written to be hosted where students can read it.
 *
 * A function rather than a case body because `publish page` performs the same
 * build after promoting the materials it needs, and a second copy of it would
 * be a second answer to "what may a student be shown".
 */
const buildCoursePage = (runId: string): { lines: string[]; published: string[] } => {
  const lines: string[] = [];
  const say = (line: string): void => void lines.push(line);
  const bundle = forRun(runId);
  // A rendering whose source has changed is a picture of the old text, and the
  // page is where that would reach a student. Held back with the reason rather
  // than published as though it matched — `freshness.ts` says why it is not
  // rebuilt here instead.
  const holdBack = heldBackForStaleness(freshness(bundle, runId, root));
  const on = onDate(runId);
  const payload = outlinePayload(bundle, runId, on, {
    groups: runGroups(runId),
  }) as Record<string, any>;

  // Before anything is written: a template that cannot be read, or that is a
  // dashboard's, should stop the command rather than half a site.
  const [style, template] = loadStyle(flag("template"), "course-page", root);
  const [markupTemplate, structureName] = loadStructure(flag("structure"), "course-page", root);

  const { published, heldBack, tally } = publishable(bundle, runId, root, holdBack);
  const scanned = scanOrRefuse(published, bundle);
  const materials = scanned.safe;
  const withheld = [...heldBack, ...scanned.heldBack];
  linkMaterials(payload, materials);

  const site = resolve(flag("out") ?? join(root, "dist", "pages", runId));
  copyMaterials(site, materials);

  const title = `${(bundle.course as any).course_id} — ${(bundle.course as any).title}`;
  const document = renderPage(payload, title, style, markupTemplate || undefined);
  const { markup, problems } = prerender(document, "course_outline");
  if (problems.length) {
    // Python fell back to shipping the payload and the view for the browser to
    // run. There is no such fallback here: the prerenderer runs in this very
    // process, so a failure is the view failing, and a page nobody can read is
    // worse than no page.
    throw new Error(
      `the course outline view did not render, so there is no page to write:\n  ` +
        problems.join("\n  "),
    );
  }

  const index = join(site, "index.html");
  writeFileSync(index, renderStatic(markup, payload, title, style), { encoding: "utf-8" });

  say(`wrote ${within(root, index)}`);
  say("  static HTML, no script");
  if (template) {
    say(`  styled with the ${template} template — appearance only, nothing added`);
  }
  if (structureName) {
    say(`  arranged by the ${structureName} structure — the same view, same payload`);
  }
  say(`  the week marked 'this week' is the one containing ${on}`);
  for (const material of materials) {
    say(`  published ${href(material)} — ${material.title}`);
  }
  for (const reason of withheld) say(`  held back ${reason}`);
  for (const [reason, count] of Object.entries(tally)) {
    if (count) say(`  ${count} document(s) not published: ${reason}`);
  }
  if (scanned.unchecked.length) {
    say(`  the answer-key scan could not cover ${scanned.unchecked.length} recorded answer(s):`);
    for (const entry of scanned.unchecked) say(`    ${entry}`);
  }
  say("Student-safe: the outline carries no enrollment, submission or score.");
  // The identifiers as well as the prose: `publish` writes what went out into
  // the ledger, and "what went out" is exactly this list rather than a second
  // guess at it.
  return { lines, published: materials.map((material) => material.documentId) };
};

/**
 * Plan or perform a homework starter repository, and return an exit code.
 *
 * A function for `buildCoursePage`'s reason: `publish homework` promotes the
 * brief first and then does exactly this, and the refusals here — a repository
 * nobody named, an answer key inside the folder — are the ones that must still
 * hold when the caller is a button.
 */
interface HomeworkOutcome {
  /** Non-zero when it refused; the caller exits with it. */
  code: number;
  /** `owner/name`, once GitHub has been asked. */
  repo: string | null;
  /** The repository's URL, when a push returned one. */
  url: string | null;
}

const publishHomework = async (
  assessmentId: string,
  confirm: boolean,
  say: (line: string) => void,
): Promise<HomeworkOutcome> => {
  const asked = flag("course-version") ?? flag("run");
  const bundle = asked ? forRun(asked) : onlyCourse();
  const resolvedRun = asked ?? soleRun(bundle);
  const assessment = (bundle.assessments as any[]).find(
    (entry) => entry.assessment_id === assessmentId,
  );
  if (!assessment) throw new Error(`no assessment ${assessmentId} in this workspace`);

  const forced = flag("auth");
  if (forced && forced !== "gh" && forced !== "token") {
    throw new Error("--auth takes gh or token");
  }
  const registry = loadRegistry(flag("connections"));
  const auth = resolveAuth({
    connection: findConnection(registry, { name: flag("connection"), type: "github" }),
    force: (forced as AuthMode | null) ?? null,
  });
  if (!auth.github) {
    console.error(auth.refusal ?? "No way to reach GitHub.");
    return { code: 1, repo: null, url: null };
  }
  for (const note of auth.notes) say(`note: ${note}`);

  // The whole run's items, not the assessment's own. `safety.ts` says a wider
  // set only makes the scan stricter, and a starter repository that quotes
  // another assessment's answer is no less published for it.
  const items = (bundle.items as any[]).filter(
    (item) => item.course_version_id === resolvedRun || item.course_version_id === undefined,
  );
  const shared = {
    root,
    assessment,
    items,
    github: auth.github,
    repo: flag("repo"),
    // Public is the default because a template students cannot see cannot be
    // forked. `--private` is the way back, for work being staged before a
    // cohort is told about it.
    visibility: (args.includes("--private") ? "private" : "public") as "private" | "public",
  };

  if (!confirm) {
    const plan = await planPublish(shared);
    say(`Publishing ${assessmentId} would do this, and has done nothing:`);
    for (const line of describePlan(plan)) say(`  ${line}`);
    // Non-zero on a refusal, the way `approve` is: a caller that offers a
    // "publish now" button off the back of this must not offer it for a plan
    // that cannot run, and "did it refuse" is not something a reader of the
    // text should have to work out by looking for a word in it.
    if (plan.refusals.length) return { code: 1, repo: plan.repo ?? null, url: null };
    say("\nRun it again with --confirm to publish.");
    return { code: 0, repo: plan.repo ?? null, url: null };
  }

  const result = await publish({ ...shared, message: flag("message") });
  if (result.plan.refusals.length) {
    for (const line of describePlan(result.plan)) console.error(`  ${line}`);
    return { code: 1, repo: result.plan.repo ?? null, url: null };
  }
  for (const line of result.output) say(line);
  if (result.created) say(`\nCreated ${result.plan.repo}, private.`);
  if (result.url) say(result.url);
  if (result.created) {
    say(
      "\nIt is private. Making it public, and marking it a template so students " +
        "get a clean history, are both yours:\n" +
        `  gh repo edit ${result.plan.repo} --template\n` +
        `  gh repo edit ${result.plan.repo} --visibility public`,
    );
  }
  say(
    `\nRecord it on the assessment, if it is not there yet:\n` +
      `  extensions.github.template_repo: ${result.plan.repo}`,
  );
  return { code: 0, repo: result.plan.repo ?? null, url: result.url ?? null };
};

try {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      out(HELP);
      break;

    case "validate": {
      let errors = 0;
      let warnings = 0;
      for (const courseDir of discoverCourses(root)) {
        const courseId = courseDir.split(/[\\/]/).pop()!;
        if (rest[0] && rest[0] !== courseId) continue;
        const { bundle, issues: loadIssues } = loadCourse(courseDir, root);
        const issues = bundle ? validate(bundle, { root }) : loadIssues;
        errors += issues.errors.length;
        warnings += issues.warnings.length;
        console.log(`  ${courseId}: ${issues.errors.length} error(s), ${issues.warnings.length} warning(s)`);
        for (const issue of issues.items) console.log(`    ${describe(issue)}`);
      }
      console.log(`\n${errors} error(s), ${warnings} warning(s)`);
      console.log(coverage().note);
      process.exit(errors ? 1 : 0);
    }

    case "stats": {
      for (const courseDir of discoverCourses(root)) {
        const courseId = courseDir.split(/[\\/]/).pop()!;
        if (rest[0] && rest[0] !== courseId) continue;
        const { bundle } = loadCourse(courseDir, root);
        if (!bundle) continue;
        console.log(`${courseId} — ${(bundle.course as any).title}`);
        for (const [name, list] of Object.entries(bundle)) {
          if (Array.isArray(list) && list.length) {
            console.log(`  ${name.padEnd(18)} ${list.length}`);
          }
        }
        console.log();
      }
      break;
    }

    case "context":
      out(courseContext(forRun(rest[0]!), rest[0]!, onDate(rest[0]!)));
      break;
    case "syllabus":
      out(syllabusMarkdown(forRun(rest[0]!), rest[0]!));
      break;
    case "alignment":
      out(alignmentMarkdown(forRun(rest[0]!), rest[0]!));
      break;
    case "gradebook":
      out(
        gradebookPayload(forRun(rest[0]!), rest[0]!, {
          assessmentId: flag("assessment") ?? null,
          groups: runGroups(rest[0]!),
        }),
      );
      break;
    case "pending":
      out(pendingPayload(forRun(rest[0]!), rest[0]!, flag("assessment")));
      break;
    case "rubric":
      out(rubricPayload(workspace.findAssessment(rest[0]!), rest[0]!));
      break;
    case "student":
      out(studentRecord(forRun(rest[0]!), rest[0]!, rest[1]!));
      break;
    case "class-progress":
      out(dashboardPayload(forRun(rest[0]!), rest[0]!, { groups: runGroups(rest[0]!) }));
      break;
    case "inbox":
      out(inboxPayload(forRun(rest[0]!), rest[0]!, onDate(rest[0]!), { groups: runGroups(rest[0]!) }));
      break;
    case "calibration":
      out(calibrationPayload(forRun(rest[0]!), rest[0]!));
      break;
    case "blueprint":
      out(blueprintPayload(forRun(rest[0]!), rest[0]!, { weight: Number(flag("weight")) || null }));
      break;

    case "extract-evidence": {
      // Ported from `cmd_extract_evidence` in `ainar/cli.py`. Same five steps as
      // `roll-up` below, and for the same reason: derive, show, validate the
      // merged bundle, honour --dry-run, write. Writing before validating would
      // leave records in `courses/` that `ainar validate` then rejects, with
      // nothing to say which of them were mechanical.
      const asked = rest[0] ?? flag("course-version") ?? flag("run");
      const bundle = asked ? forRun(asked) : onlyCourse();
      const resolvedRun = asked ?? soleRun(bundle);
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);

      const produced = extractEvidence(bundle, resolvedRun);
      if (produced.length === 0) {
        out("no new evidence — every approved decision is already recorded");
        break;
      }

      for (const item of produced) {
        const target = item.outcome_id ?? item.capability_id ?? item.concept_id;
        const level =
          item.demonstrated_level === null || item.demonstrated_level === undefined
            ? ""
            : ` level ${item.demonstrated_level}`;
        out(`  ${item.evidence_id}  ${item.student_id}  ${target}${level}  from ${item.source_id}`);
      }

      const issues = new IssueList();
      const merged = mergeDrafts(bundle, { evidence: produced });
      issues.extend(validate(merged, { root }));
      if (issues.errors.length) {
        console.error("\nvalidation failed; nothing was written");
        for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
        process.exit(1);
      }

      const { implemented, total: allChecks } = coverage();
      out(`\nchecked against ${implemented} of ${allChecks} validator checks`);

      if (args.includes("--dry-run")) {
        out(`\ndry run — ${produced.length} record(s) would be written`);
        break;
      }

      const approval = {
        records: new Map([["evidence", produced]]),
        idMap: new Map<string, string>(),
        skipped: [] as string[],
        notes: [] as string[],
      };
      out("");
      for (const path of writeRecords(courseDir, approval as never)) {
        out(`wrote ${relative(root, path)}`);
      }
      out(`\n${produced.length} evidence record(s) derived.`);
      break;
    }

    case "roll-up": {
      // Ported from `cmd_roll_up` in `ainar/cli.py`, step for step: derive,
      // show, validate the merged bundle, and only then write. The order is the
      // safety property — deriving into a bundle that does not validate would
      // put records in `courses/` that `ainar validate` then rejects, and the
      // professor would have to unpick which of them were mechanical.
      const asked = rest[0] ?? flag("course-version") ?? flag("run");
      const bundle = asked ? forRun(asked) : onlyCourse();
      const resolvedRun = asked ?? soleRun(bundle);
      const run = runById(bundle).get(resolvedRun) as { term: string; timezone?: string };
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);

      // The same stamp helper `approve` uses, so a state derived at the same
      // moment as an approval carries the same instant in the same timezone.
      const now = decidedAt(run.timezone);

      const produced = rollUpCapabilities(bundle, resolvedRun, now);
      if (produced.length === 0) {
        out("no new capability states — every capability with evidence already has one");
        break;
      }

      for (const state of produced) {
        out(
          `  ${state.student_id}  ${state.capability_id}  level ${state.level}` +
            `  from ${state.source_count} source(s)`,
        );
      }

      const issues = new IssueList();
      const merged = mergeDrafts(bundle, { capability_states: produced });
      issues.extend(validate(merged, { root }));
      if (issues.errors.length) {
        console.error("\nvalidation failed; nothing was written");
        for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
        process.exit(1);
      }

      // The same disclosure `approve` makes, for the same reason: this command
      // writes to the record, and the width of the check it passed is the only
      // honest measure of what that write was held to.
      const { implemented, total: allChecks } = coverage();
      out(`\nchecked against ${implemented} of ${allChecks} validator checks`);

      if (args.includes("--dry-run")) {
        out(`\ndry run — ${produced.length} record(s) would be written`);
        break;
      }

      const approval = {
        records: new Map([["capability_states", produced]]),
        idMap: new Map<string, string>(),
        skipped: [] as string[],
        notes: [] as string[],
      };
      for (const path of writeRecords(courseDir, approval as never)) {
        out(`wrote ${relative(root, path)}`);
      }
      out(`\n${produced.length} capability state(s) derived.`);
      break;
    }

    case "connections": {
      // The registry every outbound target reads. No workspace is loaded: a
      // connection is machine configuration and is answerable from a directory
      // holding no courses at all — which is the state a professor is in when
      // they are setting one up.
      const code = await runConnections(
        {
          subcommand: rest[0] ?? "list",
          name: rest[1] ?? null,
          connections: flag("connections") ?? null,
          rosterDir: flag("roster-dir") ?? null,
          profiles: flag("profiles") ?? null,
          json: args.includes("--json"),
          dryRun: args.includes("--dry-run"),
          type: flag("type") ?? null,
          baseUrl: flag("base-url") ?? null,
          courseId: flag("course-id") ?? null,
          chatId: flag("chat-id") ?? null,
          forumId: flag("forum-id") ?? null,
          keyFile: flag("key-file") ?? null,
          tokenEnv: flag("token-env") ?? null,
          makeDefault: args.includes("--default"),
        },
        { out: (line) => out(line) },
      );
      if (code) process.exit(code);
      break;
    }

    case "lms": {
      // Ported from `ainar/commands/lms.py`, which is where the whole group
      // lives — this is argument parsing and nothing else.
      //
      // `await` at the top level of a module, because the two live targets speak
      // HTTP and Node has no synchronous client. Python's `urllib` did, which is
      // the only reason its version of this reads as straight-line code.
      const subcommand = rest[0];
      if (!subcommand || !rest[1]) {
        console.error(
          "usage: lms {plan|push|diff|import-submissions|assignment-plan|" +
            "assignment-push} RUN --assessment A [--target T]",
        );
        process.exit(1);
      }
      const by = (flag("by") ?? "sis-id") as "sis-id" | "login" | "email";
      if (!MATCH_KEYS.includes(by)) {
        throw new Error(`--by is one of ${MATCH_KEYS.join(", ")}; got '${by}'`);
      }
      const target = flag("target") ?? "canvas-csv";
      if (!TARGETS.includes(target as never)) {
        throw new Error(`--target is one of ${TARGETS.join(", ")}; got '${target}'`);
      }

      const code = await runLms(
        {
          subcommand,
          run: rest[1]!,
          assessment: flag("assessment") ?? null,
          target,
          by,
          source: flag("from") ?? null,
          column: flag("column") ?? null,
          out: flag("out") ?? null,
          tab: flag("tab") ?? null,
          sheet: flag("sheet") ?? null,
          canvasUrl: flag("canvas-url") ?? null,
          canvasCourse: flag("canvas-course") ?? null,
          canvasAssignment: flag("canvas-assignment") ?? null,
          group: flag("group") ?? null,
          connection: flag("connection") ?? null,
          connections: flag("connections") ?? null,
          rosterDir: flag("roster-dir") ?? null,
          syncDir: flag("sync-dir") ?? null,
          allowPartial: args.includes("--allow-partial"),
          withNames: args.includes("--with-names"),
          noComments: args.includes("--no-comments"),
          comments: args.includes("--comments"),
          confirm: args.includes("--confirm"),
          dryRun: args.includes("--dry-run"),
          quiet: args.includes("--quiet"),
          json: args.includes("--json"),
          overwriteDrift: args.includes("--overwrite-drift"),
          summary: args.includes("--summary"),
          allTabs: args.includes("--all"),
        },
        forRun(rest[1]!),
        root,
        { out: (line) => out(line) },
      );
      if (code) process.exit(code);
      break;
    }

    case "dashboard": {
      // Ported from `cmd_dashboard` in `ainar/cli.py`. The private surface: it
      // draws marks, by pseudonym, and is not written for a URL.
      const runId = rest[0]!;
      const bundle = forRun(runId);
      if (args.includes("--json")) {
        emit(JSON.stringify(dashboardPayload(bundle, runId), null, 2));
        break;
      }
      const [style, template] = loadStyle(flag("template"), "course-dashboard", root);
      const target = resolve(
        flag("out") ??
          join(root, "dist", (bundle.course as any).course_id, `${runId}-progress.html`),
      );
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, renderHtml(bundle, runId, { style }), { encoding: "utf-8" });
      out(`wrote ${within(root, target)}`);
      if (template) {
        out(`  styled with the ${template} template — appearance only, nothing added`);
      }
      out("Open it in a browser. Students are shown by pseudonym.");
      break;
    }

    case "materials": {
      // Argument parsing and nothing else; `src/materials.ts` is where the work
      // is, on the same terms as `lms` above.
      if (rest[0] !== "build" && rest[0] !== "import") {
        console.error("usage: materials build RUN [--only ID] [--no-pdf] [--dry-run]");
        console.error("       materials import RUN FILE.pptx --as DOC-ID [--module M] [--title T]");
        process.exit(1);
      }
      const runId = rest[1];
      if (!runId) throw new Error("usage: materials build RUN [--only ID] [--no-pdf]");
      // Resolving the run proves it exists before a single script is executed:
      // a typo in the id should not be discovered after seven decks are built
      // and a draft is written naming a course version nobody has.
      const bundle = forRun(runId);
      if (bundle === null) throw new Error(`no course run '${runId}' in this workspace`);

      if (rest[0] === "import") {
        const file = rest[2];
        if (!file) throw new Error("usage: materials import RUN FILE.pptx --as DOC-ID");
        const as = flag("as");
        if (!as) {
          throw new Error(
            "name the record with --as DOC-ID. The id is the professor's to choose: " +
              "it is what the deck will be called in the course for the rest of its life.",
          );
        }
        // The course's own concepts, title and aliases, as the closed vocabulary
        // the reader may propose from. Nothing outside this can be suggested,
        // which is why an automatic reading is safe to offer at all.
        const vocabulary = new Map(
          ((bundle.concepts as any[]) ?? []).map((concept) => [
            concept.concept_id as string,
            [concept.title as string, ...((concept.aliases as string[]) ?? [])].filter(Boolean),
          ]),
        );
        const report = importMaterial({
          root,
          courseVersionId: runId,
          file,
          documentId: as,
          title: flag("title") ?? null,
          moduleId: flag("module") ?? null,
          vocabulary,
          draftsDir: flag("drafts") ?? join(root, "work", runId),
          dryRun: args.includes("--dry-run"),
        });
        for (const line of report.lines) console.log(line);
        if (report.draft !== null) {
          console.log("");
          console.log(`wrote ${relative(root, report.draft).split(sep).join("/")}`);
          console.log("Read it before approving — the outline was measured, not written:");
          console.log(`  ainar approve work/${runId} --as <USER-ID>`);
        }
        break;
      }

      const course = bundle.course.course_id;
      const report = buildMaterials({
        root,
        courseVersionId: runId,
        materialsDir: flag("materials") ?? join(root, "courses", course, "materials"),
        only: flag("only") ?? null,
        pdf: !args.includes("--no-pdf"),
        dryRun: args.includes("--dry-run"),
        draftsDir: flag("drafts") ?? join(root, "work", runId),
      });
      for (const line of report.lines) console.log(line);
      if (report.draft !== null) {
        console.log("");
        console.log(`wrote ${relative(root, report.draft).split(sep).join("/")}`);
        console.log("Nothing is a record yet. Review it, then:");
        console.log(`  ainar approve work/${runId} --as <USER-ID>`);
      }
      if (report.failed > 0) {
        console.error("");
        console.error(`${report.failed} producer step(s) failed; see above.`);
        process.exit(1);
      }
      break;
    }

    case "page": {
      for (const line of buildCoursePage(rest[0]!).lines) out(line);
      break;
    }

    /**
     * Publishing, with the gate folded in.
     *
     * Four targets, one grammar: the command with no `--confirm` reads and
     * prints a plan and writes nothing anywhere; the same command with
     * `--confirm` promotes the drafted **materials** the publication needs and
     * then performs it. `src/publish.ts` says why those two halves belong in
     * one press and why the promotion stops at documents and resources.
     *
     * Nothing new is implemented here. The page is `buildCoursePage`, the
     * starter repository is `publishHomework`, Canvas is `runLms`, and the
     * promotion is `runApproval` — the same call `ainar approve` makes. This
     * case is the argument parsing, the order, and the refusal to go on when
     * the first half failed.
     */
    case "publish": {
      const target = (rest[0] ?? "") as Target;
      if (!PUBLISH_TARGETS.includes(target)) {
        console.error(
          "usage: publish {page|homework|canvas|telegram|update} … [--confirm]\n" +
            "  publish page RUN [--as USER] [--out DIR] [--template T] [--structure S]\n" +
            "  publish homework ASSESSMENT [--run RUN] [--repo owner/name] [--private]\n" +
            "  publish canvas ASSESSMENT --run RUN [--group G] [--overwrite-drift]\n" +
            "  publish telegram RUN --message TEXT | --message-file PATH [--chat-id C] [--edit]\n" +
            "  publish update RUN\n\n" +
            "Without --confirm each of these reads and prints what it would do.\n" +
            "With it, the drafted documents and resources the publication needs are\n" +
            "promoted first — never an evaluation, which is `ainar approve` and yours.\n\n" +
            "`update` revisits every destination this run has already been published to,\n" +
            "which the ledger knows and nothing else does. It never publishes anywhere\n" +
            "for the first time. `telegram --edit` corrects the last announcement in the\n" +
            "channel instead of posting a second one.",
        );
        process.exit(1);
      }

      const confirm = args.includes("--confirm");
      const named =
        target === "page" || target === "telegram" || target === "update"
          ? rest[1]
          : (flag("run") ?? flag("course-version"));
      const bundle = named ? forRun(named) : onlyCourse();
      const runId = named ?? soleRun(bundle);
      const run = runById(bundle).get(runId) as any;
      const courseId = (bundle.course as { course_id: string }).course_id;
      const courseDir = join(root, "courses", courseId);
      const draftsDir = resolve(flag("drafts") ?? join(root, "work", runId));

      // Half of the plan, and the half that is the same whatever the target is.
      // A drafts directory that is not there is not an error: a course whose
      // materials are all recorded publishes with nothing to promote.
      const pending = existsSync(draftsDir)
        ? pendingMaterials(draftsDir, bundle)
        : { promotions: [], leftAlone: new Map<string, number>(), errors: [] };
      if (pending.errors.length) {
        console.error(`the drafts in ${within(root, draftsDir)} do not load, so nothing is published:`);
        for (const error of pending.errors) console.error(`    ${error}`);
        process.exit(1);
      }

      // The other half: what this particular target would do, and what it
      // would refuse. Computed before anything is promoted, because a plan a
      // professor cannot read is a plan they will press past.
      const actions: string[] = [];
      const refusals: string[] = [];
      let announcement: ReturnType<typeof checkAnnouncement> | null = null;
      let channelId = "";
      let telegramToken = "";

      /**
       * A complete `LmsArgs`, because a partial one is how a default nobody
       * chose reaches Canvas. Every field the assignment path reads is named
       * here even where the answer is "nothing was asked for".
       */
      const assignmentArgs = (subcommand: string, write: boolean, assessment = rest[1] ?? null) => ({
        subcommand,
        run: runId,
        assessment,
        target: "canvas-csv",
        by: "sis-id" as const,
        source: null,
        column: null,
        out: null,
        tab: null,
        sheet: null,
        canvasUrl: flag("canvas-url") ?? null,
        canvasCourse: null,
        canvasAssignment: null,
        group: flag("group") ?? null,
        connection: flag("connection") ?? null,
        connections: flag("connections") ?? null,
        rosterDir: flag("roster-dir") ?? null,
        syncDir: flag("sync-dir") ?? null,
        allowPartial: false,
        withNames: false,
        noComments: false,
        comments: false,
        confirm: write,
        dryRun: false,
        quiet: false,
        json: false,
        overwriteDrift: write && args.includes("--overwrite-drift"),
        summary: false,
        allTabs: false,
      });

      // Has anything been edited since it was recorded? Asked once, for every
      // target, because a changed brief matters to Canvas the way a changed
      // deck matters to the page — and because the answer is the same question
      // the professor is really asking when they press Publish a second time.
      const found = freshness(bundle, runId, root);
      const stale = heldBackForStaleness(found);

      // And has it been sent before? The record cannot say — it holds what the
      // course IS, not what left the machine — so this is the ledger's, beside
      // the one `lms push` keeps, in the same file for the same run.
      const prints = fingerprints(bundle, runId, root);
      const checksums = materialChecksums(prints);
      const titles = new Map(prints.map((print) => [print.documentId, print.title]));
      const ledger = Ledger.load(runId, flag("sync-dir"));
      // The scope of a publication: a page and an announcement are the run's,
      // a repository and a Canvas brief are one assessment's.
      const scope =
        target === "page" || target === "telegram" || target === "update" ? runId : (rest[1] ?? "");
      // Canvas keeps its history in `assignments` rather than in
      // `publications` — the spec it sent and the id Canvas returned, per
      // course — so the previous state is read from there and never written
      // twice. The newest of them is the one to describe.
      const canvasLast = Object.entries(ledger.assignments)
        .filter(([entryKey]) => entryKey.startsWith(`${scope}|`))
        .map(([entryKey, entry]) => ({
          where: `Canvas course ${entryKey.slice(scope.length + 1)}`,
          at: entry.at,
          reference: `assignment ${entry.canvas_assignment_id}`,
          handle: entry.canvas_assignment_id,
          materials: {},
        }))
        .sort((left, right) => right.at.localeCompare(left.at))[0];
      const last = target === "canvas" ? (canvasLast ?? null) : ledger.lastPublication(target, scope);

      const fanOut = destinations(ledger.publications, runId);

      if (target === "update") {
        if (!fanOut.updating.length) {
          refusals.push(
            "nothing has been published from this machine for this run yet, so there is " +
              "nothing to update. Publish to a target once and this revisits it afterwards.",
          );
        }
        for (const entry of fanOut.updating) {
          const what = entry.target === "page" ? "" : ` (${entry.scope})`;
          actions.push(`${entry.target}${what} — ${entry.where}, last sent ${entry.at}`);
        }
        for (const entry of fanOut.skipped) {
          actions.push(
            `NOT ${entry.target} — ${entry.where}. An announcement is what you typed, ` +
              "and nothing in the record can re-derive it: `publish telegram … --edit`",
          );
        }
      }

      if (target === "page") {
        const plan = pagePlan(bundle, runId, root, stale);
        const site = resolve(flag("out") ?? join(root, "dist", "pages", runId));
        actions.push(`write ${within(root, site)} — static HTML, no script`);
        for (const material of plan.publishing) {
          actions.push(`copy ${material.filename} — ${material.title}`);
        }
        for (const reason of plan.heldBack) actions.push(`hold back ${reason}`);
        for (const [reason, count] of Object.entries(plan.tally)) {
          if (count) actions.push(`${count} document(s) not published: ${reason}`);
        }
      }

      if (target === "telegram") {
        const registry = loadRegistry(flag("connections"));
        const connection = findConnection(registry, { name: flag("connection"), type: "telegram" });
        announcement = checkAnnouncement(
          announcementText(flag("message"), flag("message-file")),
          bundle.items as unknown[],
        );
        refusals.push(...announcement.refusals);
        channelId =
          flag("chat-id") ?? (run?.extensions?.telegram?.chat_id as string) ?? connection?.chatId ?? "";
        if (!connection) {
          refusals.push(explainMissing(registry, "telegram"));
        } else if (!tokenPresent(connection)) {
          refusals.push(
            `${connection.tokenEnv} holds nothing, so the bot cannot authenticate. ` +
              "The pane's Integrations · Credentials writes it, or export it in the shell.",
          );
        } else {
          telegramToken = tokenFor(connection);
        }
        if (!channelId) {
          refusals.push(
            "no channel: give the telegram connection a --chat-id, or put one on the run " +
              "as extensions.telegram.chat_id",
          );
        }
        actions.push(`send ${announcement.text.length} character(s) to ${channelId || "(no channel)"}`);
        for (const warning of announcement.warnings) actions.push(`warning: ${warning}`);
      }

      if (target === "homework" || target === "canvas") {
        const assessmentId = rest[1];
        if (!assessmentId) throw new Error(`usage: publish ${target} ASSESSMENT_ID`);
        const assessment = (bundle.assessments as any[]).find(
          (entry) => entry.assessment_id === assessmentId,
        );
        if (!assessment) throw new Error(`no assessment ${assessmentId} in this workspace`);
        actions.push(
          target === "homework"
            ? `plan and push the starter repository for ${assessmentId} — GitHub answers first`
            : `send ${assessmentId}'s definition to Canvas — the plan below is Canvas's own answer`,
        );
      }

      if (!confirm) {
        for (const line of publishPlan({ target, pending, actions, refusals })) out(line);

        // Not for an update: its own list already says when each destination
        // was last sent, and "nothing has been published here before" about a
        // mode rather than a place is a sentence about nothing.
        if (!isUpdate(target)) {
          out("");
          for (const line of describePublication(last, checksums, titles)) out(line);
        }

        if (!nothingChanged(found)) {
          out("");
          out("Changed since it was last recorded:");
          for (const line of describeFreshness(found)) out(`  ${line}`);
          if (found.stale.length) {
            out(`  rebuild those with \`ainar materials build ${runId}\`, then publish again`);
          }
        }

        // The two targets whose plan is a question for somebody else's server
        // are asked here rather than described, because "what would change in
        // Canvas" is not knowable from this side of the wire.
        if (target === "homework") {
          out("");
          const { code } = await publishHomework(rest[1]!, false, out);
          if (code) process.exit(code);
        }
        if (target === "canvas") {
          out("");
          const code = await runLms(assignmentArgs("assignment-plan", false), bundle, root, {
            out: (line: string) => out(line),
          });
          if (code) process.exit(code);
        }
        if (target === "telegram" && telegramToken && channelId) {
          const channel = await readChannel(telegramToken, channelId, new FetchTransport());
          out("");
          out(`Telegram: ${channel.title ?? "(the bot can see it, and it has no title)"} — ${channelId}`);
          out("");
          out(announcement!.text);
        }

        out("");
        out(
          refusals.length
            ? "Nothing was published, and this plan cannot run until the refusals above are fixed."
            : "Nothing was published. Run it again with --confirm to promote and publish.",
        );
        if (refusals.length) process.exit(1);
        break;
      }

      if (refusals.length) {
        console.error("refusing to publish:");
        for (const refusal of refusals) console.error(`    ${refusal}`);
        process.exit(1);
      }

      // The gate, over materials only, and the same one `ainar approve` runs.
      // A draft the record already holds is rejected rather than re-promoted,
      // which is what makes pressing Publish a second time publish a second
      // time instead of reporting a collision.
      const todo = outstanding(pending);
      if (todo.length) {
        const approver = flag("as") ?? (run?.instructors ?? [])[0];
        if (!approver) {
          console.error(
            "This run names no instructor, so there is no id to record as having " +
              "accepted the materials. Pass --as USER-ID, or add one to `instructors`.",
          );
          process.exit(1);
        }
        const outcome = runApproval({
          bundle,
          draftsDir,
          courseDir,
          root,
          approver,
          timezone: run?.timezone,
          collections: MATERIAL_COLLECTIONS,
          reject: new Set(
            pending.promotions
              .filter((entry) => entry.recordedAs !== null)
              .map((entry) => entry.draftId),
          ),
        });
        for (const line of outcome.lines) out(line);
        if (!outcome.ok) {
          for (const error of outcome.errors) console.error(`    ${error}`);
          console.error("\nnothing was published: the materials did not pass the gate");
          process.exit(1);
        }
        out("");
      }

      // The bytes on disk are what is about to be published, so the record is
      // made to describe them before anything is sent. This is the half that
      // used to be nobody's job: a professor who fixed a word in an approved
      // deck had a record still describing the text before the fix, and
      // nothing anywhere said so.
      if (!nothingChanged(found)) {
        const stamped = restamp(root, courseId, found);
        for (const line of describeFreshness(found)) out(line);
        for (const path of stamped.written) {
          out(`re-stamped ${within(root, path)} — ${stamped.count} record(s)`);
        }
        for (const id of stamped.deferred) {
          out(
            `${id} is NOT re-stamped: something rendered from it is stale, and recording ` +
              "the change would make that rendering look current. Rebuild it, then publish again.",
          );
        }
        out("");
      }

      // Re-read, deliberately. The records written a moment ago are what the
      // publication is about, and the bundle in hand predates them — a page
      // built from it would leave out the very deck this command just promoted.
      const published = named ? forRun(named) : onlyCourse();

      /**
       * One publication, performed and noted.
       *
       * A loop rather than a chain of `if`s because `update` runs several in a
       * row, and the alternative is the same four blocks written twice. Each
       * job reports its own outcome and the loop goes on: a fan-out that
       * stopped at the first failure would leave the professor with some
       * destinations current and some not, and no list of which.
       */
      const perform = async (job: { target: Target; scope: string }): Promise<number> => {
        let where = "";
        let reference: string | null = null;
        let handle: string | null = null;
        let sent: string[] = [];
        let payload: string | undefined;

        if (job.target === "page") {
          const built = buildCoursePage(runId);
          for (const line of built.lines) out(line);
          where = within(root, resolve(flag("out") ?? join(root, "dist", "pages", runId)));
          sent = built.published;
        }
        if (job.target === "homework") {
          const result = await publishHomework(job.scope, true, out);
          if (result.code) return result.code;
          where = result.repo ?? "GitHub";
          reference = result.url;
          handle = result.repo;
        }
        if (job.target === "canvas") {
          const code = await runLms(
            assignmentArgs("assignment-push", true, job.scope),
            published,
            root,
            { out: (line: string) => out(line) },
          );
          if (code) return code;
          // Not recorded as a publication: `lms/ledger.ts` already writes an
          // `assignments` entry per assessment per Canvas course, carrying the
          // spec it sent and the id Canvas returned. That is the same fact, and
          // it is the one `assignment-plan` reads to tell a change from drift.
          // A second copy here would be a second answer to "what did we send".
          where = "";
        }
        if (job.target === "telegram") {
          const previous = ledger.lastPublication("telegram", job.scope);
          const correcting = args.includes("--edit");
          if (correcting && !previous?.handle) {
            console.error(
              "--edit corrects the last announcement, and this machine has not sent one " +
                "to this run. Send it as a new message instead.",
            );
            return 1;
          }
          if (correcting) {
            const result = await editAnnouncement(
              telegramToken,
              channelId,
              previous!.handle!,
              announcement!.text,
              new FetchTransport(),
            );
            out(
              result === "edited"
                ? `edited message ${previous!.handle} in ${channelId} — students now read the new text`
                : `message ${previous!.handle} already says exactly that; nothing was sent`,
            );
            where = channelId;
            handle = previous!.handle;
            reference = `message ${previous!.handle}`;
          } else {
            const messageId = await sendAnnouncement(
              telegramToken,
              channelId,
              announcement!.text,
              new FetchTransport(),
            );
            out(`sent message ${messageId} to ${channelId}`);
            out("A Telegram message cannot be recalled by this command, or by any other.");
            where = channelId;
            handle = String(messageId);
            reference = `message ${messageId}`;
          }
          payload = announcementDigest(announcement!.text);
        }

        // Written last, and only for a publication that came back. The ledger
        // is what the NEXT plan reads to say "last published Tuesday, and
        // these three have changed since" instead of describing every
        // publication as though it were the first.
        if (where) {
          ledger.recordPublication(job.target, job.scope, {
            where,
            at: decidedAt(run?.timezone),
            reference,
            handle,
            // For a page, the materials it actually copied; for the rest, the
            // materials of the run as they stood, which is what a later "has
            // anything changed" is asked about.
            materials: Object.fromEntries(
              (job.target === "page" ? sent : [...checksums.keys()])
                .filter((id) => checksums.has(id))
                .map((id) => [id, checksums.get(id)!]),
            ),
            ...(payload ? { payload } : {}),
          });
        }
        return 0;
      };

      const jobs = isUpdate(target)
        ? fanOut.updating.map((entry) => ({ target: entry.target, scope: entry.scope }))
        : [{ target, scope }];

      let failures = 0;
      for (const job of jobs) {
        if (jobs.length > 1) out(`--- ${job.target}${job.target === "page" ? "" : ` ${job.scope}`}`);
        // A throw is caught per job for the same reason a non-zero code is
        // tolerated: `runAssignment` throws when a run names no Canvas course,
        // and one misconfigured destination must not stop the three that are
        // fine. A single publication re-throws, because there is nothing to
        // carry on to and the stack is worth seeing.
        try {
          const code = await perform(job);
          if (code) {
            failures += 1;
            console.error(`${job.target} ${job.scope} did not go out (exit ${code}).`);
          }
        } catch (error) {
          if (jobs.length === 1) throw error;
          failures += 1;
          console.error(`${job.target} ${job.scope} did not go out: ${(error as Error).message}`);
        }
      }

      out(`noted in ${within(root, ledger.save())}`);
      if (failures) {
        console.error(
          `\n${failures} of ${jobs.length} destination(s) did not go out. The rest did, and ` +
            "the ledger records which — running this again retries only what is behind.",
        );
        process.exit(1);
      }
      break;
    }

    case "sql": {
      // Ported from `cmd_sql` in `ainar/cli.py`. `--ddl` prints (or writes) the
      // hand-written schema and stops; otherwise every validating course becomes
      // an idempotent import script under `dist/<COURSE>/import.sql`.
      if (args.includes("--ddl")) {
        const target = flag("out");
        if (!target) {
          out(schemaSql());
        } else {
          mkdirSync(dirname(resolve(target)), { recursive: true });
          writeFileSync(resolve(target), schemaSql(), { encoding: "utf-8" });
          out(`wrote ${within(root, resolve(target))}`);
        }
        break;
      }

      const selected = discoverCourses(root).filter(
        (courseDir) => !rest[0] || rest[0] === courseDir.split(/[\\/]/).pop(),
      );
      const doPrune = args.includes("--prune");
      if (doPrune && selected.length > 1) {
        throw new Error("--prune needs one course; name it");
      }

      const outDir = resolve(flag("out") ?? join(root, "dist"));
      let failed = false;
      for (const courseDir of selected) {
        const courseId = courseDir.split(/[\\/]/).pop()!;
        const { bundle, issues: loadIssues } = loadCourse(courseDir, root);
        const issues = bundle ? validate(bundle, { root }) : loadIssues;
        if (!bundle || issues.errors.length) {
          failed = true;
          out(`${courseId}: not exported`);
          for (const issue of issues.errors) out(`    ${describe(issue)}`);
          continue;
        }
        const script = buildScript(bundle, { prune: doPrune });
        const path = join(outDir, (bundle.course as any).course_id, "import.sql");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, script, { encoding: "utf-8" });
        const statements = script.split(";\n").length - 1;
        out(`wrote ${within(root, path)}  (${statements} statements)`);
      }

      if (failed) {
        out("\nfix the errors above, then generate again");
        process.exit(1);
      }
      out(
        "\nApply with:\n" +
          "  psql -d ainar -f ainar-node/src/sql/schema.sql\n" +
          `  psql -d ainar -f ${outDir.split(/[\\/]/).pop()}/<COURSE>/import.sql`,
      );
      break;
    }

    case "export": {
      // Ported from `cmd_export` in `ainar/cli.py`. A course that does not
      // validate is not exported, and the run continues to the next one, so a
      // workspace with one broken course still produces the others.
      const outDir = resolve(flag("out") ?? join(root, "dist"));
      let failed = false;
      for (const courseDir of discoverCourses(root)) {
        const courseId = courseDir.split(/[\\/]/).pop()!;
        if (rest[0] && rest[0] !== courseId) continue;
        const { bundle, issues: loadIssues } = loadCourse(courseDir, root);
        const issues = bundle ? validate(bundle, { root }) : loadIssues;
        if (!bundle || issues.errors.length) {
          failed = true;
          out(`${courseId}: not exported`);
          for (const issue of issues.errors) out(`    ${describe(issue)}`);
          continue;
        }
        for (const path of exportBundle(bundle, outDir, today())) {
          out(`wrote ${within(root, path)}`);
        }
      }
      if (failed) {
        out("\nfix the errors above, then export again");
        process.exit(1);
      }
      break;
    }

    case "score-items": {
      // Ported from `cmd_score_items` in `ainar/cli.py`.
      //
      // Two deliberate departures from Python, both about which files it opens:
      //
      // * It walks with `draftFiles`, so a dot-directory, a `node_modules` and a
      //   deck's `.plan.yaml` sidecar are skipped. Python globbed everything and
      //   relied on `item_responses` being absent from whatever it picked up.
      // * A file it rewrites is emitted by `dump`, which leaves a timestamp as
      //   the text the author wrote. Python round-tripped it through a `datetime`
      //   and rewrote every one of them in its own spelling.
      const draftsDir = rest[0];
      const runFlag = flag("course-version") ?? flag("run");
      if (!draftsDir || !runFlag) {
        console.error(
          "usage: score-items DRAFTS_DIR --course-version RUN [--partial] [--rescore] [--dry-run]",
        );
        process.exit(1);
      }

      const items = itemById(forRun(runFlag)) as Map<string, any>;
      const files = draftFiles(resolve(draftsDir));
      if (!files.length) {
        out(`no draft files in ${draftsDir}`);
        process.exit(1);
      }

      // Every collection's floats, not just `item_responses`: one draft file may
      // hold several, and the ones this command does not touch are still rewritten.
      const floats = new Set<string>();
      for (const [collection, schema] of Object.entries(DRAFTABLE)) {
        for (const path of floatPaths(schema, [collection])) floats.add(path);
      }

      const combined = emptyResult();
      const touched: string[] = [];
      for (const path of files) {
        const document = parse(readFileSync(path, "utf-8")) ?? {};
        if (typeof document !== "object" || Array.isArray(document)) continue;
        if (!("item_responses" in document)) continue;

        const responses = ((document as any).item_responses ?? []) as Record<string, any>[];
        const result = scoreChoiceItems(responses, items, {
          partial: args.includes("--partial"),
          rescore: args.includes("--rescore"),
        });
        combined.scored.push(...result.scored);
        combined.alreadyScored.push(...result.alreadyScored);
        combined.unscorable.push(...result.unscorable);
        for (const [itemId, stats] of result.stats) combined.stats.set(itemId, stats);

        if (result.scored.length && !args.includes("--dry-run")) {
          writeFileSync(path, dump(document, (p) => floats.has(p.join("."))), {
            encoding: "utf-8",
          });
          touched.push(path);
        }
      }

      out(`Scored ${combined.scored.length} response(s) against the answer key`);
      if (combined.alreadyScored.length) {
        out(`  ${combined.alreadyScored.length} already scored (use --rescore to redo)`);
      }
      for (const note of combined.unscorable) out(`  needs a human: ${note}`);

      if (combined.stats.size) {
        out("\nItem difficulty");
        for (const itemId of [...combined.stats.keys()].sort()) {
          const stats = combined.stats.get(itemId)!;
          if (!stats.responses) continue;
          // A rate is already two decimals, so no value here can land on a half
          // percent and `Math.round` cannot disagree with Python's `:.0%`.
          const percent = Math.round((successRate(stats) ?? 0) * 100);
          out(`  ${itemId}  ${stats.correct}/${stats.responses} correct  (${percent}%)`);
          const dominant = dominantMisconception(stats);
          if (dominant?.misconception) {
            out(
              `      ${dominant.chose} chose (${dominant.label}) — reads as a ` +
                `misconception of ${dominant.misconception}`,
            );
          }
        }
      }

      if (args.includes("--dry-run")) {
        out("\ndry run — nothing written");
        break;
      }
      for (const path of touched) out(`\nupdated ${path}`);
      if (combined.scored.length) {
        out(`\nReview, then: ainar approve ${draftsDir} --as USER-…`);
      }
      break;
    }

    case "approve": {
      const draftsDir = rest[0];
      const approver = flag("as");
      if (!draftsDir || !approver) {
        console.error("usage: approve DRAFTS_DIR --as USER_ID [--only IDS] [--reject IDS] [--dry-run]");
        process.exit(1);
      }

      const courseVersionId = flag("course-version") ?? flag("run");
      const bundle = courseVersionId ? forRun(courseVersionId) : onlyCourse();
      const resolvedRun = courseVersionId ?? soleRun(bundle);
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);

      // The order of operations is `runApproval`'s, not this file's, because
      // `ainar publish` performs the same gate over the materials a publication
      // needs and two copies of that order is how a record validates and is
      // still wrong. What stays here is argument parsing and the exit code.
      const dryRun = args.includes("--dry-run");
      const outcome = runApproval({
        bundle,
        draftsDir: resolve(draftsDir),
        courseDir,
        root,
        approver,
        timezone: (runById(bundle).get(resolvedRun) as { timezone?: string }).timezone,
        only: flag("only") ? new Set(flag("only")!.split(",")) : undefined,
        reject: flag("reject") ? new Set(flag("reject")!.split(",")) : undefined,
        dryRun,
      });

      for (const line of outcome.lines) out(line);
      if (!outcome.ok) {
        for (const error of outcome.errors) console.error(`    ${error}`);
        process.exit(1);
      }
      if (outcome.written.length) {
        out(`The drafts in ${draftsDir} can now be removed.`);
      }
      break;
    }

    /**
     * The class list, and the boundary it sits on.
     *
     * Every branch here either keeps identities outside the workspace or
     * refuses. `import` writes pseudonymous enrollments into `courses/` and the
     * names beside them into `--roster-dir`; `show` and `whois` print to a
     * terminal and refuse any output path inside the workspace.
     *
     * The interesting code is in `src/roster.ts` — what is here is the part
     * that says no.
     */
    case "roster": {
      const sub = rest[0] ?? "";
      const directory = rosterDir(flag("roster-dir"));

      if (sub === "status") {
        const store = RosterStore.load(directory);
        const inside = (resolve(directory) + sep).startsWith(resolve(root) + sep);
        out(`roster directory   ${directory}`);
        out(`inside the repo    ${inside ? "YES — MOVE IT" : "no"}`);
        out(`salt               ${existsSync(join(directory, "salt")) ? "present" : "not created yet"}`);
        out(`people known       ${Object.keys(store.people).length}`);
        // `runs` is the key `record()` writes. Python reads `versions` here and
        // so never prints this line; the bug is not worth carrying across.
        const runs = [
          ...new Set(Object.values(store.people).flatMap((person) => person.runs ?? [])),
        ].sort();
        if (runs.length) out(`course runs        ${runs.join(", ")}`);
        out("\nOverride the location with --roster-dir or the AINAR_ROSTER_DIR variable.");
        break;
      }

      /*
       * The subgroups, and how many are in each.
       *
       * Every other command that takes `--group` refuses a label this run does
       * not have, so this is the list to look at first. It counts active
       * students only — a subgroup everyone dropped out of shows as 0 rather
       * than disappearing, which is the more useful of the two.
       */
      if (sub === "groups") {
        const courseVersionId = flag("run") ?? flag("course-version");
        const bundle = courseVersionId ? forRun(courseVersionId) : onlyCourse();
        const resolvedRun = courseVersionId ?? soleRun(bundle);
        const labels = groupsOf(bundle, resolvedRun);
        if (!labels.length) {
          out(`${resolvedRun} has no subgroups: no enrollment or activity carries a group.`);
          break;
        }
        out(resolvedRun);
        const enrolled = enrollmentsOf(bundle, resolvedRun);
        for (const label of labels) {
          const active = enrolled.filter(
            (entry) =>
              entry.status === "active" &&
              ["student", "auditor"].includes(entry.role) &&
              String(entry.group ?? "").trim() === label,
          ).length;
          const meetings = (bundle.activities as any[]).filter(
            (activity) =>
              activity.course_version_id === resolvedRun &&
              String(activity.group ?? "").trim() === label,
          ).length;
          out(`  ${label.padEnd(16)} ${String(active).padStart(3)} active  ${meetings} meeting(s)`);
        }
        const ungrouped = enrolled.filter(
          (entry) =>
            entry.status === "active" &&
            ["student", "auditor"].includes(entry.role) &&
            !String(entry.group ?? "").trim(),
        ).length;
        if (ungrouped) out(`  ${"(no group)".padEnd(16)} ${String(ungrouped).padStart(3)} active`);
        break;
      }

      if (sub === "whois") {
        const studentId = rest[1];
        if (!studentId) throw new Error("usage: roster whois STUDENT-XXXXXX");
        const person = RosterStore.load(directory).whois(studentId);
        if (person === null) {
          console.error(`${studentId} is not in the local roster`);
          process.exit(1);
        }
        out(`PRIVATE — ${studentId}`);
        for (const key of ["name", "institutional_id", "email", "first_seen"] as const) {
          if (person[key]) out(`  ${key.padEnd(18)} ${person[key]}`);
        }
        if (person.runs?.length) out(`  ${"runs".padEnd(18)} ${person.runs.join(", ")}`);
        break;
      }

      if (sub === "show") {
        const target = flag("out");
        // Checked before anything is read, so a bad path cannot first pull names
        // into memory and then fail.
        refuseInsideRepo(target, root);
        const courseVersionId = flag("run") ?? flag("course-version");
        const bundle = courseVersionId ? forRun(courseVersionId) : onlyCourse();
        const resolvedRun = courseVersionId ?? soleRun(bundle);
        const store = RosterStore.load(directory);
        const enrolled = enrollmentsOf(bundle, resolvedRun);
        const lines = [
          "PRIVATE — contains student identities. Do not paste into the repository,",
          "an issue tracker, or any shared document.",
          "",
          resolvedRun,
          "",
        ];
        for (const enrollment of enrolled) {
          const person = store.whois(enrollment.student_id) ?? {};
          const name = person.name ?? "(unknown — not in the local roster)";
          const institutional = person.institutional_id ?? "";
          const group = enrollment.group ? `  [${enrollment.group}]` : "";
          // Since an import marks departures rather than deleting them, this
          // list holds people who are no longer in the class. Saying which is
          // the difference between a class list and a list of everyone who was
          // ever on it.
          const status = enrollment.status === "active" ? "" : `  (${enrollment.status})`;
          lines.push(`  ${enrollment.student_id}  ${name}  ${institutional}${group}${status}`);
        }
        const active = enrolled.filter((entry) => entry.status === "active").length;
        lines.push(
          "",
          active === enrolled.length
            ? `${active} enrolled`
            : `${active} enrolled, ${enrolled.length - active} no longer active`,
        );
        const text = lines.join("\n");
        if (target) {
          mkdirSync(dirname(resolve(target)), { recursive: true });
          writeFileSync(resolve(target), text + "\n", { encoding: "utf-8" });
          out(`wrote ${resolve(target)}`);
        } else {
          out(text);
        }
        break;
      }

      if (sub === "import") {
        const file = rest[1];
        if (!file) {
          throw new Error(
            "usage: roster import FILE.csv [--run RUN] [--group G] [--keep-absent] [--dry-run]",
          );
        }
        const courseVersionId = flag("run") ?? flag("course-version");
        const bundle = courseVersionId ? forRun(courseVersionId) : onlyCourse();
        const resolvedRun = courseVersionId ?? soleRun(bundle);
        const courseId = (bundle.course as { course_id: string }).course_id;

        const salt = loadSalt(directory);
        const store = RosterStore.load(directory);
        const rows = readRows(resolve(file), flag("delimiter"));
        const result = buildRoster(rows, {
          courseVersionId: resolvedRun,
          store,
          salt,
          idColumn: flag("id-column"),
          nameColumn: flag("name-column"),
          emailColumn: flag("email-column"),
          groupColumn: flag("group-column"),
          today: today(),
        });

        const chosen = Object.entries(result.columns)
          .filter(([, value]) => value)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ");
        out(`Read ${rows.length} row(s) from ${file}`);
        out(`  columns: ${chosen}`);
        out(`  ${result.added.length} new, ${result.known.length} already known`);
        for (const note of result.skipped) out(`  skipped ${note}`);
        if (!result.enrollments.length) {
          console.error("\nnothing to write");
          process.exit(1);
        }

        // The course directory, where the loader reads enrollments.
        const courseDir = join(root, "courses", courseId);
        const path = join(courseDir, "enrollments.yaml");

        /*
         * A course taught to two sections is two CourseVersions with one `term`
         * between them, and they share this one file. Reconciling has to see
         * only the rows belonging to the run being imported, and writing has to
         * put the other run's rows back untouched.
         */
        const onDisk = readEnrollments(path);
        const mine = onDisk.filter((entry) => entry.course_version_id === resolvedRun);
        const others = onDisk.filter((entry) => entry.course_version_id !== resolvedRun);

        const groups = flagList("group");
        const merged = reconcileEnrollments(mine, result.enrollments, {
          groups,
          markDropped: !args.includes("--keep-absent"),
        });

        const say = (label: string, ids: string[]): void => {
          if (!ids.length) return;
          const shown = ids.slice(0, 5).join(", ") + (ids.length > 5 ? ", …" : "");
          out(`  ${label.padEnd(19)}${String(ids.length).padStart(4)}  ${shown}`);
        };
        out("");
        if (groups.length) out(`  reconciling group(s): ${groups.join(", ")}`);
        say("newly enrolled", merged.arrived);
        say("marked dropped", merged.dropped);
        say("back from dropped", merged.returned);
        // The one number a professor should look at twice. An export that
        // covers only part of the class leaves the rest here rather than
        // dropping them, and saying so is how they find out the scope was
        // wrong before it becomes a grade nobody counted.
        say("absent, left active", merged.held);

        if (args.includes("--dry-run")) {
          out("\ndry run — nothing written");
          for (const enrollment of merged.enrollments.slice(0, 5)) {
            out(`  ${enrollment.student_id}  ${enrollment.status}  ${enrollment.group ?? ""}`);
          }
          if (merged.enrollments.length > 5) {
            out(`  … and ${merged.enrollments.length - 5} more`);
          }
          break;
        }

        const written = [...others, ...merged.enrollments];
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, ENROLLMENTS_HEADER + dump({ enrollments: written }), {
          encoding: "utf-8",
        });
        const saved = store.save();
        const active = merged.enrollments.filter((entry) => entry.status === "active").length;
        out(
          `\nwrote ${relative(root, path).split(/[\\/]/).join("/")}  ` +
            `(${merged.enrollments.length} enrollments for ${resolvedRun}, ` +
            `${active} active, pseudonyms only)`,
        );
        out(`wrote ${saved}  (identities, outside the repository)`);

        const { bundle: reloaded, issues: loadIssues } = loadCourse(courseDir, root);
        const issues = reloaded ? validate(reloaded, { root }) : loadIssues;
        if (issues.errors.length) {
          console.error("\nthe course no longer validates:");
          for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
          process.exit(1);
        }
        break;
      }

      console.error(`unknown roster subcommand '${sub}'\n`);
      console.error(HELP);
      process.exit(1);
    }

    /**
     * What a record must look like, read out of the validator's own schemas.
     *
     * Written because the alternative was watched happening: an agent asked to
     * start a course searched the filesystem for an unrelated workspace and
     * copied its files, then minted an identifier the model refuses. The shape
     * is derivable and now it is answerable.
     */
    case "schema": {
      const wanted = rest[0];
      const outDir = flag("out");

      if (outDir) {
        // The JSON Schema form, which is what Python's `schema` writes.
        const names = wanted ? [wanted] : SCHEMA_NAMES;
        let count = 0;
        for (const name of names) {
          const document = jsonSchemaFor(name);
          if (document === null) throw new Error(`${name} is not an entity`);
          const path = join(resolve(outDir), `${name}.schema.json`);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, JSON.stringify(document, null, 2) + "\n", { encoding: "utf-8" });
          count += 1;
        }
        out(`wrote ${count} schema file(s) to ${resolve(outDir)}`);
        break;
      }

      if (!wanted) {
        out("Entities. `schema <name>` for one of them:\n");
        out("  " + SCHEMA_NAMES.join("\n  "));
        break;
      }

      if (args.includes("--json")) {
        const document = jsonSchemaFor(wanted);
        if (document === null) throw new Error(`${wanted} is not an entity`);
        out(document);
        break;
      }

      out(shapeText(wanted));
      break;
    }

    /**
     * A course, or an offering of one, as files that already validate.
     *
     * Nothing is overwritten: a file that exists is reported and left alone.
     */
    case "new": {
      const what = rest[0];

      if (what === "course") {
        const courseId = rest[1];
        if (!courseId) throw new Error("usage: new course COURSE_ID [--title T]");
        const written = newCourse({
          root,
          courseId,
          title: flag("title"),
          credits: flag("credits") ? Number(flag("credits")) : undefined,
          department: flag("department"),
        });
        out(`Scaffolding ${courseId} in ${join(root, "courses", courseId)}`);
        for (const entry of written) {
          out(`  ${entry.created ? "created" : "skipped (exists)"} ${relative(root, entry.path).split(/[\\/]/).join("/")}`);
        }
        out(
          "\nNo offering yet, so this will not validate until you add one:\n" +
            `  new run ${courseId} <TERM> --start YYYY-MM-DD --end YYYY-MM-DD`,
        );
        break;
      }

      if (what === "run") {
        const courseId = rest[1];
        const term = rest[2];
        const start = flag("start");
        const end = flag("end");
        if (!courseId || !term || !start || !end) {
          throw new Error("usage: new run COURSE_ID TERM --start YYYY-MM-DD --end YYYY-MM-DD");
        }
        const written = newRun({ root, courseId, term, start, end });
        out(`Scaffolding offering ${courseId}-${term}`);
        for (const entry of written) {
          out(`  ${entry.created ? "created" : "skipped (exists)"} ${relative(root, entry.path).split(/[\\/]/).join("/")}`);
        }
        break;
      }

      console.error("usage: new course COURSE_ID  |  new run COURSE_ID TERM --start … --end …");
      process.exit(1);
    }

    /**
     * Publish a homework starter repository, or say what publishing would do.
     *
     * A plan by default and a push only with `--confirm`, which is the same
     * shape `approve` and `lms push` have and for the same reason: the outward
     * facing half of this belongs to a person, and the flag is where they say
     * so. The rules live in `src/homework.ts`; this is the seam.
     */
    case "homework": {
      if (rest[0] !== "publish") {
        console.error(
          "usage: homework publish ASSESSMENT_ID [--repo owner/name] [--auth gh|token] " +
            "[--private] [--confirm]",
        );
        process.exit(1);
      }
      const assessmentId = rest[1];
      if (!assessmentId) throw new Error("usage: homework publish ASSESSMENT_ID [--repo owner/name]");
      const { code } = await publishHomework(assessmentId, args.includes("--confirm"), out);
      if (code) process.exit(code);
      break;
    }

    /**
     * The one-way move off `versions/<TERM>/`.
     *
     * Run once per workspace. `--dry-run` lists every move first, which is what
     * anyone should do on a workspace holding a real term's records.
     */
    case "migrate-layout": {
      const dryRun = args.includes("--dry-run");
      const courseDirs = rest.length
        ? rest.map((id) => join(root, "courses", id))
        : discoverCourses(root);
      if (!courseDirs.length) throw new Error("no courses found under courses/");

      for (const courseDir of courseDirs) {
        const name = relative(root, courseDir).split(/[\\/]/).join("/");
        const result = migrateLayout(courseDir, { dryRun });
        if (!result.moved.length && !result.left.length) {
          out(`${name}: already flat, nothing to move`);
          continue;
        }
        out(`${name}${dryRun ? " (dry run)" : ""}`);
        for (const { from, to } of result.moved) {
          out(
            `  ${dryRun ? "would move" : "moved"} ` +
              `${relative(courseDir, from).split(/[\\/]/).join("/")} -> ` +
              `${relative(courseDir, to).split(/[\\/]/).join("/")}`,
          );
        }
        for (const { path, references } of result.rewritten) {
          out(
            `  ${dryRun ? "would rewrite" : "rewrote"} ${references} recorded path(s) in ` +
              `${relative(courseDir, path).split(/[\\/]/).join("/")}`,
          );
        }
        // Named rather than moved or deleted: `.superseded/` and `.bak-*` files
        // are the professor's own filing, and guessing at what they meant by
        // them is exactly the kind of tidying nobody asked for.
        for (const { path, why } of result.left) {
          out(`  left alone (${why}): ${relative(courseDir, path).split(/[\\/]/).join("/")}`);
        }
      }
      break;
    }

    /**
     * Pack a finished offering away and clear the live record for the next one.
     *
     * Text in full, binaries as a checksum manifest — see `src/layout.ts` for
     * why that split and not another.
     */
    case "archive-run": {
      const dryRun = args.includes("--dry-run");
      const bundle = onlyCourse();
      const runs = bundle.versions as { course_version_id: string; term: string; status?: string }[];
      if (runs.length !== 1) {
        throw new Error(`this workspace holds ${runs.length} runs; it should hold one`);
      }
      const [run] = runs;
      if (run.status !== "completed" && !args.includes("--force")) {
        throw new Error(
          `${run.course_version_id} is ${run.status ?? "not marked completed"}. ` +
            "Set `status: completed` in version.yaml when the term is over, or pass --force.",
        );
      }
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);
      const result = archiveRun({ root, courseDir, term: run.term, dryRun });

      out(`${dryRun ? "Would archive" : "Archived"} ${run.course_version_id}`);
      out(`  to ${relative(root, result.archiveDir).split(/[\\/]/).join("/")}`);
      out(`  ${result.copied.length} text file(s) ${dryRun ? "would be copied" : "copied"}`);
      if (result.manifested.length) {
        const bytes = result.manifested.reduce((total, entry) => total + entry.bytes, 0);
        out(
          `  ${result.manifested.length} binary file(s) recorded by checksum, ` +
            `not copied (${(bytes / 1024 / 1024).toFixed(1)} MB left where they are)`,
        );
      }
      if (!dryRun) {
        for (const name of result.cleared) out(`  cleared ${name}`);
        out("\nThe course keeps its outcomes, concepts, modules and people.");
        out("Give it the next offering with `ainar new run`.");
      }
      break;
    }

    /**
     * Will it fit, answered by the code that lays it out.
     *
     * The alternative was watched happening: an agent redesigning a deck said
     * "let me read the exact textHeight formula so I can compute what actually
     * fits" and opened `deck.ts`. Arithmetic carried out in a model's head is
     * expensive, unverifiable, and stale the moment a font size moves. This
     * runs the renderer's own measuring — literally the same `blockHeight` —
     * without writing a file or starting PowerPoint.
     */
    case "deck": {
      if (rest[0] !== "fit") {
        console.error("usage: deck fit FILE.md [--verbose]");
        process.exit(1);
      }
      const file = rest[1];
      if (!file) throw new Error("usage: deck fit FILE.md [--verbose]");
      const measured = measureDeck(readFileSync(resolve(file), "utf-8"));
      const verbose = args.includes("--verbose");

      out(`${measured.length} slide(s), ${LAYOUT.floor}" of usable page\n`);
      for (const slide of measured) {
        // An image is measured at the most it can take — the renderer shrinks
        // it to whatever space is left — so a slide holding one is an UPPER
        // bound: the real picture may be shorter, and the overflow smaller or
        // absent. Say "may" there rather than reporting a bound as a fact.
        const state = slide.fits
          ? `fits, ${(LAYOUT.floor - slide.bottom).toFixed(2)}" to spare`
          : slide.approximate
            ? `may overflow, by up to ${slide.overflow.toFixed(2)}"`
            : `OVERFLOWS by ${slide.overflow.toFixed(2)}"`;
        out(
          `  ${String(slide.slide).padStart(2)}  ${slide.approximate ? "≤" : " "}` +
            `${slide.bottom.toFixed(2).padStart(5)}"  ${state}  ${slide.title}`,
        );
        if (verbose) {
          for (const block of slide.blocks) {
            out(
              `        ${block.kind.padEnd(10)} at ${block.at.toFixed(2).padStart(5)}" ` +
                `+${block.height.toFixed(2).padStart(5)}"  ${block.text.replace(/\s+/g, " ").slice(0, 46)}`,
            );
          }
        }
      }

      const certain = measured.filter((slide) => !slide.fits && !slide.approximate);
      const maybe = measured.filter((slide) => !slide.fits && slide.approximate);
      out("");
      if (certain.length) {
        out(
          `${certain.length} slide(s) run past the page: ` +
            `${certain.map((entry) => entry.slide).join(", ")}. Shorten or split them.`,
        );
      }
      if (maybe.length) {
        out(
          `${maybe.length} slide(s) may run past it — ${maybe.map((entry) => entry.slide).join(", ")} — ` +
            "each holds an image, and an image's real height is only known once it is " +
            "placed. Render to be sure: the renderer warns using these same numbers.",
        );
      }
      if (!certain.length && !maybe.length) out("Every slide fits.");
      // An estimate, so a failure here is a warning and not an exit code: the
      // fonts are rendered by PowerPoint, not by this.
      break;
    }

    default:
      console.error(`unknown command '${command}'\n`);
      console.error(HELP);
      process.exit(1);
  }
} catch (error) {
  console.error(String((error as Error).message ?? error));
  process.exit(1);
}
