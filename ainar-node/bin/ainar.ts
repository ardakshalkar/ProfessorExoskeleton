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

import { join, relative, resolve } from "node:path";
import { courseContext, runById } from "../src/bundle.ts";
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
  roster:
    "derives pseudonyms from a secret salt. A derivation that differs by a byte would silently break every cross-course identity, so there is one implementation of it and it is Python's.",
  "score-items": "rewrites draft files in place.",
  sql: "generates the PostgreSQL import; run it from the CLI that owns the schema.",
  export: "writes dist/; a person should decide where.",
  schema: "writes schema/.",
  new: "scaffolds files.",
};

const args = process.argv.slice(2);

const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

/** Positional arguments only — a flag may sit before the command or after it. */
const positional: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const value = args[index]!;
  if (value.startsWith("--")) {
    index += 1; // skip the flag's value
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
  gradebook RUN [--assessment A]
  pending RUN [--assessment A]
  rubric ASSESSMENT
  student RUN STUDENT
  class-progress RUN
  inbox RUN [--date D]
  calibration RUN
  blueprint RUN
  approve DRAFTS --as USER [--only IDS] [--reject IDS] [--dry-run]

  These derive records and write them into courses/. Each validates the merged
  bundle first and writes nothing if it fails, and each takes --dry-run:

  extract-evidence [RUN] [--dry-run]   evidence from approved decisions and scored items
  roll-up [RUN] [--dry-run]            capability states from that evidence

  --root DIR               the workspace (default: the current directory)

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
      out(gradebookPayload(forRun(rest[0]!), rest[0]!, { assessmentId: flag("assessment") ?? null }));
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
      out(dashboardPayload(forRun(rest[0]!), rest[0]!));
      break;
    case "inbox":
      out(inboxPayload(forRun(rest[0]!), rest[0]!, onDate(rest[0]!)));
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

    default:
      console.error(`unknown command '${command}'\n`);
      console.error(HELP);
      process.exit(1);
  }
} catch (error) {
  console.error(String((error as Error).message ?? error));
  process.exit(1);
}
