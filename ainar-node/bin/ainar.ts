/**
 * The read half of the CLI, in Node. Phase 5 of `docs/node-migration.md`.
 *
 *     node --experimental-strip-types bin/ainar.ts <command> [args]
 *
 * Every command here is a **surface over already-verified code**: it parses
 * arguments and prints, and the payload underneath is one the golden fixtures
 * already hold to `ainar/`. No logic is reimplemented, so nothing here can
 * drift from Python in a way `npm run golden` would not catch.
 *
 * `approve` is the exception, and it is not a surface over verified code — it is
 * a second implementation of the one gate. `docs/node-migration.md` argued
 * against exactly that, on the grounds that two gates can disagree. What makes it
 * defensible here is that the disagreement is *measured*:
 * `tests/test_approve_parity.py` runs both gates over the same drafts and compares
 * the trees they write, `tests/test_yaml_parity.py` compares the emitters scalar by
 * scalar, and since Phase 4 the refusal is the same width as Python's — all 94
 * checks, held there by 98 mutations. It still prints its coverage on every run,
 * because that number is the gate and a reader should not have to trust it.
 *
 * The remaining write verbs are absent, and absent loudly — see `REFUSED`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { courseContext, enrollmentsOf, groupsOf, requireGroups, runById } from "../src/bundle.ts";
import { blueprintPayload } from "../src/blueprint.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { calibrationPayload, pendingPayload, rubricPayload } from "../src/grading.ts";
import { inboxPayload } from "../src/inbox.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { dashboardPayload, rollUpCapabilities, studentRecord } from "../src/progress.ts";
import { extractEvidence } from "../src/evidence.ts";
import { alignmentMarkdown, syllabusMarkdown } from "../src/report.ts";
import { coverage, validate } from "../src/validate.ts";
import { IssueList, describe } from "../src/issues.ts";
import { loadDrafts, mergeDrafts } from "../src/drafts.ts";
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
  decidedAt,
  stageDocuments,
  total,
  writeRecords,
} from "../src/approve.ts";
import { Workspace } from "../src/mcp/workspace.ts";

/** Commands that exist in `python -m ainar` and deliberately not here. */
const REFUSED: Record<string, string> = {
  lms: "reaches Canvas or a spreadsheet, and `push` can put a grade in front of a student within seconds.",
  "score-items": "rewrites draft files in place.",
  sql: "generates the PostgreSQL import; run it from the CLI that owns the schema.",
  export: "writes dist/; a person should decide where.",
};

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
const BOOLEAN_FLAGS = new Set(["dry-run", "json", "verbose", "keep-absent"]);

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

const HELP = `ainar (Node) — the read half of the workspace

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

  --root DIR               the workspace (default: the current directory)
  --roster-dir DIR         where identities live (default: ~/.ainar/roster)

These stay Python's: ${Object.keys(REFUSED).join(", ")}.
Run \`python -m ainar <command>\` for those.`;

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
  if (command in REFUSED) {
    console.error(`\`${command}\` is not in the Node CLI: it ${REFUSED[command]}`);
    console.error(`Run \`python -m ainar ${command} …\` instead.`);
    process.exit(1);
  }

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
