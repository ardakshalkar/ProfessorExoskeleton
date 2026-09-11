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
 * held there by the 98 mutations in `golden/validator/`. It still prints its
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
import { DRAFTABLE, draftFiles, loadDrafts, mergeDrafts } from "../src/drafts.ts";
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
import { newCourse, newRun } from "../src/scaffold.ts";
import { LAYOUT, measureDeck } from "../src/deck.ts";
import {
  ID_FIELDS,
  approveDrafts,
  floatPaths,
  decidedAt,
  stageDocuments,
  total,
  writeRecords,
} from "../src/approve.ts";
import { Workspace } from "../src/mcp/workspace.ts";



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
      const run = runById(bundle).get(resolvedRun) as { term: string };
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);
      const runDir = join(courseDir, "versions", run.term);

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
      for (const path of writeRecords(runDir, approval as never)) {
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
      const runDir = join(courseDir, "versions", run.term);

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
      for (const path of writeRecords(runDir, approval as never)) {
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

    case "page": {
      // Ported from `cmd_page` in `ainar/commands/page.py`. The public surface,
      // and deliberately the opposite one: it draws the plan, and it is the only
      // output here written to be hosted where students can read it.
      const runId = rest[0]!;
      const bundle = forRun(runId);
      const on = onDate(runId);
      const payload = outlinePayload(bundle, runId, on, {
        groups: runGroups(runId),
      }) as Record<string, any>;

      // Before anything is written: a template that cannot be read, or that is a
      // dashboard's, should stop the command rather than half a site.
      const [style, template] = loadStyle(flag("template"), "course-page", root);
      const [markupTemplate, structureName] = loadStructure(
        flag("structure"),
        "course-page",
        root,
      );

      const { published, heldBack, tally } = publishable(bundle, runId, root);
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
        // Python fell back to shipping the payload and the view for the browser
        // to run. There is no such fallback here: the prerenderer runs in this
        // very process, so a failure is the view failing, and a page nobody can
        // read is worse than no page.
        throw new Error(
          `the course outline view did not render, so there is no page to write:\n  ` +
            problems.join("\n  "),
        );
      }

      const index = join(site, "index.html");
      writeFileSync(index, renderStatic(markup, payload, title, style), { encoding: "utf-8" });

      out(`wrote ${within(root, index)}`);
      out("  static HTML, no script");
      if (template) {
        out(`  styled with the ${template} template — appearance only, nothing added`);
      }
      if (structureName) {
        out(`  arranged by the ${structureName} structure — the same view, same payload`);
      }
      out(`  the week marked 'this week' is the one containing ${on}`);
      for (const material of materials) {
        out(`  published ${href(material)} — ${material.title}`);
      }
      for (const reason of withheld) out(`  held back ${reason}`);
      for (const [reason, count] of Object.entries(tally)) {
        if (count) out(`  ${count} document(s) not published: ${reason}`);
      }
      if (scanned.unchecked.length) {
        out(`  the answer-key scan could not cover ${scanned.unchecked.length} recorded answer(s):`);
        for (const entry of scanned.unchecked) out(`    ${entry}`);
      }
      out("Student-safe: the outline carries no enrollment, submission or score.");
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
      const term = (runById(bundle).get(resolvedRun) as { term: string }).term;
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);
      const runDir = join(courseDir, "versions", term);

      const issues = new IssueList();
      const drafted = loadDrafts(resolve(draftsDir), issues);
      if (issues.errors.length) {
        for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
        console.error("\nthe drafts do not load cleanly; nothing was approved");
        process.exit(1);
      }

      const stamp = decidedAt((runById(bundle).get(resolvedRun) as { timezone?: string }).timezone);
      const approval = approveDrafts(bundle, drafted, {
        approver,
        decidedAt: stamp,
        issues,
        only: flag("only") ? new Set(flag("only")!.split(",")) : undefined,
        reject: flag("reject") ? new Set(flag("reject")!.split(",")) : undefined,
      });

      if (total(approval) === 0 && !issues.errors.length) {
        out("nothing to approve");
        break;
      }

      out(`Approving as ${approver} at ${stamp}\n`);
      for (const [collection, items] of approval.records) {
        const field = ID_FIELDS[collection]!;
        out(`  ${collection}:`);
        for (const item of items) {
          const promotedId = item[field] as string;
          const original =
            [...approval.idMap.entries()].find(([, value]) => value === promotedId)?.[0] ?? promotedId;
          out(`    ${original}  ->  ${promotedId}`);
        }
      }
      for (const note of approval.notes) out(`\n  note: ${note}`);
      if (approval.skipped.length) out(`\n  skipped: ${[...approval.skipped].sort().join(", ")}`);

      const dryRun = args.includes("--dry-run");
      const staged = stageDocuments(approval, { root, runDir, issues, dryRun });

      const merged = mergeDrafts(bundle, Object.fromEntries(approval.records));

      // A dry run rewrites every staged `storage_key` to its destination but
      // copies nothing, so the validator then reports each of those materials as
      // a missing file. That is the rehearsal's own shadow, not a fault in the
      // drafts: the same approval run for real copies the file first and passes.
      //
      // Only that one code, and only for the documents `stageDocuments` said it
      // would move, is dropped. A document whose SOURCE is missing never enters
      // that list, so it still fails here — which is the case a preview exists
      // to catch.
      const found = validate(merged, { root });
      const stagedIds = new Set(staged);
      issues.extend(
        dryRun
          ? found.items.filter(
              (issue) =>
                !(
                  issue.code === "document.missing_file" &&
                  issue.location != null &&
                  stagedIds.has(issue.location)
                ),
            )
          : found,
      );
      if (issues.errors.length) {
        console.error("\nvalidation of the approved records failed; nothing was written");
        for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
        process.exit(1);
      }

      // Printed on every run rather than left to be discovered. The refusal *is*
      // the gate, so its width is the one number that says how much this gate is
      // worth — and it was two thirds short until Phase 4 finished.
      const { implemented, total: allChecks } = coverage();
      out(
        `\nchecked against ${implemented} of ${allChecks} validator checks` +
          (implemented === allChecks ? "" : " — `python -m ainar validate` is the complete set"),
      );

      if (dryRun) {
        out(
          "\ndry run — nothing written" +
            (staged.length
              ? `, and ${staged.length} material(s) not copied. The real run copies them first.`
              : ""),
        );
        break;
      }

      for (const path of writeRecords(runDir, approval)) {
        out(`wrote ${relative(root, path).split(/[\\/]/).join("/")}`);
      }
      out(`\n${total(approval)} record(s) approved. The drafts in ${draftsDir} can now be removed.`);
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
        const run = runById(bundle).get(resolvedRun) as { term: string };
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

        // `versions/<term>/`, where the loader reads enrollments. Python still
        // writes `runs/<term>/`, which is the layout from before version and run
        // were merged — a file written there today is a file nothing loads.
        const courseDir = join(root, "courses", courseId);
        const path = join(courseDir, "versions", run.term, "enrollments.yaml");

        /*
         * Two runs can share a term — a course taught to two sections is two
         * CourseVersions with one `term` between them, and the loader globs
         * `versions/*​/enrollments.yaml`, so both sections' rows live in this one
         * file. Reconciling has to see only the rows belonging to the run being
         * imported, and writing has to put the other run's rows back untouched.
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
