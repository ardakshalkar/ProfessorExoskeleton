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
 * There is no `approve` any more (2026-09-29). A record an agent wrote sits in
 * the course marked `approval: draft`, and the professor accepts it by changing
 * the word — see `src/approval.ts`. `drafts` lists what is waiting.
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
 * `lms` is the only command that reaches a third party with a record, and the
 * whole of it lives in `src/lms/` — this file parses its arguments and nothing
 * else. `scans read` sends page images to a vision model and brings back only a
 * draft transcript, kept in the private folder; it lives in `src/scan-read.ts`.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import {
  courseContext,
  enrollmentsOf,
  groupsOf,
  itemById,
  requireGroups,
  runById,
  enrolledIn,
} from "../src/bundle.ts";
import { blueprintPayload } from "../src/blueprint.ts";
import { gradebookPayload } from "../src/gradebook.ts";
import { calibrationPayload, pendingPayload, rubricPayload } from "../src/grading.ts";
import { inboxPayload } from "../src/inbox.ts";
import { COLLECTIONS, discoverCourses, loadCourse } from "../src/loader.ts";
import { dashboardPayload, rollUpCapabilities, studentRecord } from "../src/progress.ts";
import { extractEvidence } from "../src/evidence.ts";
import { bundleStats, exportBundle } from "../src/export.ts";
import { buildScript, schemaSql } from "../src/sqlgen.ts";
import { renderHtml } from "../src/dashboard.ts";
import { TARGETS } from "../src/lms/index.ts";
import { MATCH_KEYS } from "../src/lms/base.ts";
import { runLms } from "../src/lms/command.ts";
import { CanvasClient, loadCanvasConfig } from "../src/lms/canvas-api.ts";
import {
  matchSections,
  parseLinks,
  readSections,
  recordCanvasIds,
  syncRows,
} from "../src/lms/roster-sync.ts";
import type { ImportResult } from "../src/roster.ts";
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
import { AGENT_WRITABLE, approvedView, drafts as draftsIn, withRecords } from "../src/approval.ts";
import { candidateFiles } from "../src/record-edit.ts";
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
import { organizeMaterials } from "../src/material-folders.ts";
import { newCourse, newRun } from "../src/scaffold.ts";
import { measureDeck } from "../src/deck.ts";
import { checkDeck, describeProblems, errorsIn } from "../src/slides/check.ts";
import { canRender, describeRender, PAGE, renderDeck, workspaceOf } from "../src/slides/render.ts";
import { deckForDocument, recordFor, type RecordedDeck } from "../src/slides/recorded.ts";
import { enableTiming, enableTimingFromEnvironment, reportTimings } from "../src/slides/timing.ts";
import { buildMaterials, documentRecord, producerFor, readProducers } from "../src/materials.ts";
import { importMaterial } from "../src/materials-import.ts";
import { decidedAt, floatPaths, removeRecords, stampDocument, writeRecords } from "../src/records-write.ts";
import {
  applyScans,
  assignPaper,
  carryTranscript,
  fileScan,
  groupAnswers,
  planScans,
  rankAssessments,
  readPlan,
  recordTranscripts,
  runInbox,
  scanPlace,
  scanStatus,
  scanSubmissionId,
  submissionsDir,
  unfiledScans,
  unplaceScan,
  variantsOf,
  writePlan,
  type Shape,
} from "../src/scans.ts";
import { DEFAULT_MODEL, deepseekKey, deepseekReader, EFFORTS, readScans, readTargets, type Effort } from "../src/scan-read.ts";
import {
  acceptRubric,
  checkGroups,
  chooseProposal,
  decideGrades,
  gradeBoard,
  moveAnswer,
  moveGroup,
  pointsOnlyRubric,
  readGroups,
  writeGroups,
  type DecidedVia,
} from "../src/grade-board.ts";
import { fileURLToPath } from "node:url";
import { importPaper, paperFiles, parseKey, parsePaper, readText, type Paper } from "../src/paper-import.ts";
import {
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
  publishPlan,
  unpublishedDrafts,
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
import { describeImpact, impact } from "../src/impact.ts";
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
  "drop-absent",
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
  // `publish … --rebuild`: run the producers behind the stale renderings
  // before publishing, rather than naming them and holding them back.
  "rebuild",
  "quiet",
  "overwrite-drift",
  "summary",
  "all",
  // `connections add`
  "default",
  // `deck render`
  "pdf",
  "draft",
  "timing",
  // `scans`
  "per-file",
  "replace",
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

/**
 * Derive evidence from what the professor has accepted, validate the merged
 * bundle, and write it unless this is a dry run. Shared by `extract-evidence`
 * and by `grade decide`, which runs it after every decision so concept
 * progress follows the marks without a second command.
 *
 * Writing before validating would leave records in `courses/` that `ainar
 * validate` then rejects, with nothing to say which of them were mechanical —
 * so a failed validation writes nothing and returns the errors.
 */
const deriveEvidence = (
  bundle: ReturnType<typeof forRun>,
  runId: string,
  { dryRun = false, list = true }: { dryRun?: boolean; list?: boolean } = {},
): { produced: Record<string, unknown>[]; refreshed: number; errors: string[] } => {
  const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);
  const produced = extractEvidence(approvedView(bundle), runId);
  const existing = new Set((bundle.evidence as any[]).map((e) => e.evidence_id as string));
  const refreshed = produced.filter((e) => existing.has(e.evidence_id as string)).length;
  if (!produced.length) return { produced, refreshed, errors: [] };

  if (list) {
    for (const item of produced) {
      const target = item.outcome_id ?? item.capability_id ?? item.concept_id;
      const level =
        item.demonstrated_level === null || item.demonstrated_level === undefined
          ? ""
          : ` level ${item.demonstrated_level}`;
      const again = existing.has(item.evidence_id as string) ? "  (refreshed)" : "";
      out(`  ${item.evidence_id}  ${item.student_id}  ${target}${level}  from ${item.source_id}${again}`);
    }
  }

  const issues = new IssueList();
  issues.extend(validate(withRecords(bundle, { evidence: produced }), { root }));
  if (issues.errors.length) return { produced: [], refreshed: 0, errors: issues.errors.map(describe) };
  if (!dryRun) {
    for (const path of writeRecords(courseDir, { evidence: produced as never[] })) {
      out(`wrote ${relative(root, path)}`);
    }
  }
  return { produced, refreshed, errors: [] };
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
  drafts [RUN]             what is marked approval: draft, awaiting you
  impact DOC-ID [--run RUN]   what a material is, and what changing it drags

  roster import FILE.csv [--run RUN] [--id-column C] [--name-column C]
                         [--email-column C] [--group-column C]
                         [--delimiter D] [--group G] [--keep-absent] [--dry-run]
  roster sync [--run RUN] [--group G] [--link CANVAS_ID=STUDENT-X ...]
              [--drop-absent] [--dry-run] [--connection NAME]
                                           the class list from each Canvas course
                                           the run names; adds who is new
  roster show [--run RUN] [--out PATH]     PRIVATE: names, to a terminal
  roster whois STUDENT-XXXXXX              PRIVATE: one identity
  roster groups [--run RUN]                the subgroups, and who is in them
  roster status                            where the identities live

  Scanned papers. The PDFs stay in --submissions-dir (default
  ~/.ainar/submissions, or AINAR_SUBMISSIONS_DIR), outside the workspace:

  scans identify RUN [--title T] [--date D] [--json]
                                           unfiled PDFs in RUN/_inbox, and the
                                           run's assessments ranked against T
  scans file RUN FILE.pdf --assessment A   move an unfiled PDF under A
  scans status RUN --assessment A          what is in the inbox, placed, read
  scans plan RUN --assessment A [--per-file | --pages-per-student N]
                                           list _inbox/*.pdf, propose the split
  scans apply RUN --assessment A [--replace] [--dry-run]
                                           split, match to the roster, record
  scans read RUN --assessment A [--effort off|low|high|max] [--student S]
             [--force] [--all-pages] [--model M] [--concurrency N] [--dry-run]
                                           fill unread transcripts with a vision
                                           model (DeepSeek, effort low) — the one
                                           scans step that leaves the machine
  scans record RUN --assessment A [--dry-run]
                                           complete transcripts -> item responses
  scans answers RUN --assessment A [--item ITEM] [--json]
                                           every recorded answer per question,
                                           identical ones grouped and counted

  Grading a written exam, question by question (the pane's Grade view). The
  grouping of answers is groups.yaml beside the scans; marks go to the course:

  grade status RUN --assessment A [--json] the rubric, the groups, and how many
                                           answers per question are decided
  grade decide RUN --assessment A --decisions '[{"student":"STUDENT-…","item":"ITEM-…","score":2}, …]'
               [--via one|group|all] [--by USER-…]
                                           the professor's marks: writes
                                           professor_decision, keeps the one it
                                           replaces in extensions.history
  grade move RUN --assessment A --item ITEM --group N (--score S | --unscored)
                                           put a group of answers at a level
  grade move RUN --assessment A --item ITEM --student S (--to N | --ungroup)
                                           move one answer to another group
  grade choose RUN --assessment A --proposal ID [--item ITEM[,ITEM]] [--keep-marks] [--accept]
                                           take one of the proposed rubrics, for
                                           one question or all; a draft unless
                                           --accept; --keep-marks to revise one
                                           that already has marks
  grade accept-rubric RUN --assessment A   the rubric's approval: draft -> approved
  grade points-only RUN --assessment A     no written rubric: one criterion per
                                           question, worth its marks

  import-paper RUN --assessment A --paper PAPER.md [--paper PAPER-B.md]
               [--key KEY.md] [--title T] [--type exam] [--dry-run]
                                           an exam that already exists: the
                                           paper as markdown, its items derived

  schema [ENTITY] [--json] [--out DIR]     what a record must look like
  new course COURSE_ID [--title T] [--credits N] [--department D]
  new run COURSE_ID TERM --start YYYY-MM-DD --end YYYY-MM-DD
  homework publish ASSESSMENT [--repo owner/name] [--private] [--confirm]
                                           plan it; --confirm creates and pushes

  Publishing. Each of these reads and prints a plan, and --confirm publishes.
  A record marked \`approval: draft\` is never published — the plan names it
  instead. Accepting one is changing that word in its file:

  publish page RUN [--out DIR] [--template T] [--structure S]
  publish telegram RUN --message TEXT | --message-file PATH [--chat-id C] [--edit]
  publish homework ASSESSMENT --run RUN [--repo owner/name] [--private]
  publish canvas ASSESSMENT --run RUN [--group G] [--overwrite-drift]
  publish update RUN                       everywhere it has already gone
  …any of them with --rebuild             run a stale rendering's producer first

  A material edited in place is noticed: the record is brought back into line
  with the file and its version goes up, and a rendering whose source changed
  is held back rather than published as a picture of the old text. --rebuild
  runs the producer the course declares for it in materials.yaml and publishes
  what it makes. --edit corrects the last announcement in the channel instead
  of posting a second one. update revisits every destination this run has
  already been published to, and never a new one.

  impact DOC-ID says what one material is and what changing it would drag —
  the read to do before a small edit, and the one /revise starts with.
  migrate-layout [COURSE_ID…] [--dry-run]  move off versions/<TERM>/, once
  archive-run [--force] [--dry-run]        pack the finished term into archive/
  organize-materials [COURSE_ID…] [--dry-run]  one folder per material, records rewritten
  deck fit FILE.md [--verbose]            will each slide fit on the page
  deck check FILE.md | --document DOC     is the deck renderable: gate, plan, figures
  deck render FILE.md | --document DOC [--pdf] [--draft] [--out DIR]
      A recorded deck renders beside its markdown in courses/; anything else,
      and every --draft, to output/<deck>/. Pictures always go to output/.

  Enrollments hold pseudonyms only. Names, numbers and emails go to
  --roster-dir (default ~/.ainar/roster, or AINAR_ROSTER_DIR), which must
  stay outside the workspace and must never be committed.

  An import never deletes: a student the export no longer lists is marked
  \`status: dropped\`, and every count in the model reads only \`active\`.
  --group G restricts that to one subgroup, for a class whose exports arrive
  one subgroup at a time; --keep-absent turns the marking off entirely.
  \`roster sync\` is the same import with Canvas as the export. Each Canvas
  student is matched by a link an earlier sync kept, an id the roster holds,
  or their name (the scans matcher); a close spelling is listed to check, an
  ambiguous one is left out until --link settles it, and the rest are new.
  Known students keep the roster's names, and nobody is marked dropped unless
  --drop-absent says so.

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

  score-items RUN [--partial] [--rescore] [--dry-run]
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
  described, and the Document records are written into the course, validated
  against the schema first and marked \`approval: draft\`. The files stay where
  the producer wrote them. Rebuilding an accepted material keeps it accepted.

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
  lms assignments RUN [--assessment A] [--group G] [--json]
                         each Canvas course's assignments, what each is linked
                         to, and the likeliest match for A; reads only
  lms link RUN --assessment A [--group G] --canvas-assignment ID
                         record that Canvas assignment ID is A in that
                         subgroup's course; changes nothing in Canvas

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
  // The outline is drawn from what the professor has accepted: a drafted
  // meeting or assessment is not on the students' plan until it is approved.
  // The materials below read the whole bundle, so that a drafted one is named
  // as held back rather than silently absent.
  const payload = outlinePayload(approvedView(bundle), runId, on, {
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
 * Which producer rebuilds each stale rendering, and what to say when none does.
 *
 * The join nothing could make before: `freshness` knows `DOC-4499` is a
 * picture of old text, `materials.yaml` is keyed by producer id, and the
 * professor was left to work out which of their seven build scripts made that
 * PDF. Both halves are now read together, so the plan either names the command
 * or says plainly why there is not one.
 */
const rebuildable = (
  found: ReturnType<typeof freshness>,
  courseId: string,
): { stale: string; producer: string | null; documentId: string }[] => {
  const producers = readProducers(
    flag("materials") ?? join(root, "courses", courseId, "materials"),
  );
  return found.stale.map((entry) => ({
    stale: entry.storageKey,
    documentId: entry.documentId,
    producer: producers ? (producerFor(producers, entry.documentId)?.id ?? null) : null,
  }));
};

/** The plan's advice about stale renderings, in the professor's own commands. */
const rebuildPlan = (found: ReturnType<typeof freshness>, courseId: string): string[] => {
  if (!found.stale.length) return [];
  const entries = rebuildable(found, courseId);
  const named = entries.filter((entry) => entry.producer !== null);
  const lines: string[] = [];
  if (named.length) {
    lines.push(
      `--confirm --rebuild would run ${named.map((entry) => entry.producer).join(", ")} first, ` +
        "and publish what they make",
    );
  }
  for (const entry of entries) {
    if (entry.producer !== null) continue;
    lines.push(
      `${entry.documentId} has no producer in materials.yaml, so nothing here can rebuild it — ` +
        "rebuild it however it was made, then publish again",
    );
  }
  return lines;
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
    // Public is the default because a repository students cannot see cannot be
    // forked. `--private` is the way back, for work being staged before a
    // cohort is told about it.
    visibility: (args.includes("--private") ? "private" : "public") as "private" | "public",
  };

  if (!confirm) {
    const plan = await planPublish(shared);
    say(`Publishing ${assessmentId} would do this, and has done nothing:`);
    for (const line of describePlan(plan)) say(`  ${line}`);
    // Non-zero on a refusal, the way `validate` is: a caller that offers a
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
  if (result.created) say(`\nCreated ${result.plan.repo}, ${result.plan.visibility}.`);
  if (result.url) say(result.url);
  if (result.created) {
    // Not a GitHub template, and nothing here suggests making it one: students
    // fork it, keep the fork public, and hand in the fork's link.
    say(
      "\nStudents fork it and keep their fork public; it is not a template, and " +
        "they should not make a private copy.",
    );
    if (result.plan.visibility === "private") {
      say(
        "It is private, so nobody can fork it yet. Making it public is yours:\n" +
          `  gh repo edit ${result.plan.repo} --visibility public --accept-visibility-change-consequences`,
      );
    }
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

      // Evidence is derived from what the professor has accepted — a decided
      // evaluation, an approved scored response — never from a draft.
      const dryRun = args.includes("--dry-run");
      const { produced, refreshed, errors } = deriveEvidence(bundle, resolvedRun, { dryRun });
      if (errors.length) {
        console.error("\nvalidation failed; nothing was written");
        for (const error of errors) console.error(`    ${error}`);
        process.exit(1);
      }
      if (produced.length === 0) {
        out("no new evidence — every approved decision is already recorded");
        break;
      }

      const { implemented, total: allChecks } = coverage();
      out(`\nchecked against ${implemented} of ${allChecks} validator checks`);
      const again = refreshed ? ` (${refreshed} refreshing a changed decision)` : "";
      out(
        dryRun
          ? `\ndry run — ${produced.length} record(s) would be written${again}`
          : `\n${produced.length} evidence record(s) derived${again}.`,
      );
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

      // The same stamp helper every writer uses, so a state derived at the same
      // moment as a decision carries the same instant in the same timezone.
      const now = decidedAt(run.timezone);

      const produced = rollUpCapabilities(approvedView(bundle), resolvedRun, now);
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
      const merged = withRecords(bundle, { capability_states: produced });
      issues.extend(validate(merged, { root }));
      if (issues.errors.length) {
        console.error("\nvalidation failed; nothing was written");
        for (const issue of issues.errors) console.error(`    ${describe(issue)}`);
        process.exit(1);
      }

      // The same disclosure extract-evidence makes, for the same reason: this command
      // writes to the record, and the width of the check it passed is the only
      // honest measure of what that write was held to.
      const { implemented, total: allChecks } = coverage();
      out(`\nchecked against ${implemented} of ${allChecks} validator checks`);

      if (args.includes("--dry-run")) {
        out(`\ndry run — ${produced.length} record(s) would be written`);
        break;
      }

      for (const path of writeRecords(courseDir, { capability_states: produced as never[] })) {
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
            "assignment-push|assignments|link} RUN --assessment A [--target T]",
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
          courseDir: join(root, "courses", bundle.course.course_id),
          dryRun: args.includes("--dry-run"),
        });
        for (const line of report.lines) console.log(line);
        if (report.written.length) {
          console.log("");
          for (const path of report.written) {
            console.log(`wrote ${relative(root, path).split(sep).join("/")}`);
          }
          console.log(`${as} is marked approval: draft. Read it before accepting it —`);
          console.log("the outline was measured, not written. To accept, set approval: approved.");
        }
        break;
      }

      const course = bundle.course.course_id;
      const report = await buildMaterials({
        root,
        courseVersionId: runId,
        materialsDir: flag("materials") ?? join(root, "courses", course, "materials"),
        only: flag("only") ?? null,
        pdf: !args.includes("--no-pdf"),
        dryRun: args.includes("--dry-run"),
        courseDir: join(root, "courses", course),
        bundle,
      });
      for (const line of report.lines) console.log(line);
      if (report.written.length) {
        console.log("");
        for (const path of report.written) {
          console.log(`wrote ${relative(root, path).split(sep).join("/")}`);
        }
        console.log(
          `${report.documents.join(", ")}: a new record is marked approval: draft, and a ` +
            "rebuilt one keeps the approval it had. Review, then set approval: approved.",
        );
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
     * What one material is, and what changing it would drag behind it.
     *
     * The read a small change starts with. `src/impact.ts` says why it exists:
     * "fix this word on slide 4" used to have no cheaper answer than
     * regenerating the deck, because the four facts needed to do less than
     * that were in four places. This is a read and nothing else — it writes
     * nothing, reaches nothing, and recommends rather than performs.
     */
    case "impact": {
      const documentId = rest[0];
      if (!documentId) {
        console.error("usage: impact DOC-ID [--run RUN]");
        process.exit(1);
      }
      const asked = flag("run") ?? flag("course-version");
      const bundle = asked ? forRun(asked) : onlyCourse();
      const runId = asked ?? soleRun(bundle);
      const found = impact({
        bundle,
        courseVersionId: runId,
        root,
        documentId,
        publications: Ledger.load(runId, flag("sync-dir")).publications,
      });
      if (!found) {
        throw new Error(`no document ${documentId} in ${runId}`);
      }
      for (const line of describeImpact(found)) out(line);
      break;
    }

    /**
     * Publishing.
     *
     * Four targets, one grammar: the command with no `--confirm` reads and
     * prints a plan and writes nothing anywhere; the same command with
     * `--confirm` performs it. A record marked `approval: draft` is never
     * published, and the plan names it — `src/publish.ts` says why publishing
     * no longer approves anything on the professor's behalf.
     *
     * Nothing new is implemented here. The page is `buildCoursePage`, the
     * starter repository is `publishHomework`, and Canvas is `runLms`. This
     * case is the argument parsing, the order, and the refusals.
     */
    case "publish": {
      const target = (rest[0] ?? "") as Target;
      if (!PUBLISH_TARGETS.includes(target)) {
        console.error(
          "usage: publish {page|homework|canvas|telegram|update} … [--confirm]\n" +
            "  publish page RUN [--out DIR] [--template T] [--structure S]\n" +
            "  publish homework ASSESSMENT [--run RUN] [--repo owner/name] [--private]\n" +
            "  publish canvas ASSESSMENT --run RUN [--group G] [--overwrite-drift]\n" +
            "  publish telegram RUN --message TEXT | --message-file PATH [--chat-id C] [--edit]\n" +
            "  publish update RUN\n\n" +
            "Without --confirm each of these reads and prints what it would do.\n" +
            "With it, it publishes. A record marked `approval: draft` is never\n" +
            "published; the plan names it, and accepting it is changing that word.\n\n" +
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

      // What a page or an update would leave out because nobody has accepted
      // it. An announcement is typed, and an assessment's own draft status is a
      // refusal below rather than a line in a list.
      const left = target === "page" || target === "update" ? unpublishedDrafts(bundle, runId) : [];

      // What this particular target would do, and what it would refuse.
      // Computed before anything is sent, because a plan a professor cannot
      // read is a plan they will press past.
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
        if (assessment.approval === "draft") {
          refusals.push(
            `${assessmentId} is marked approval: draft. Read it, set approval: approved, ` +
              "and publish again — students are not given a brief nobody has accepted.",
          );
        }
        actions.push(
          target === "homework"
            ? `plan and push the starter repository for ${assessmentId} — GitHub answers first`
            : `send ${assessmentId}'s definition to Canvas — the plan below is Canvas's own answer`,
        );
      }

      if (!confirm) {
        for (const line of publishPlan({ target, drafts: left, actions, refusals })) out(line);

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
          for (const line of rebuildPlan(found, courseId)) out(`  ${line}`);
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
            : "Nothing was published. Run it again with --confirm to publish.",
        );
        if (refusals.length) process.exit(1);
        break;
      }

      if (refusals.length) {
        console.error("refusing to publish:");
        for (const refusal of refusals) console.error(`    ${refusal}`);
        process.exit(1);
      }

      if (left.length) {
        out(`${left.length} draft(s) left out: ${left.map((draft) => draft.id).join(", ")}`);
        out("");
      }

      // Rebuilding, before anything is stamped or sent.
      //
      // Opt-in rather than automatic, and the reason is what a producer IS: a
      // script this course wrote, possibly Python, possibly followed by
      // LibreOffice. Running somebody's build scripts as a silent side effect
      // of the word "publish" is a surprising amount of machinery for a press
      // that was about putting a page up. The plan names the flag; the flag
      // runs them.
      let rebuilt = found;
      if (args.includes("--rebuild") && found.stale.length) {
        const materialsDir = flag("materials") ?? join(root, "courses", courseId, "materials");
        const jobs = rebuildable(found, courseId);
        for (const job of jobs) {
          if (job.producer === null) {
            out(`${job.documentId}: no producer declares it, so it is still the old text`);
            continue;
          }
          const report = await buildMaterials({
            root,
            courseVersionId: runId,
            materialsDir,
            only: job.producer,
            pdf: !args.includes("--no-pdf"),
            dryRun: false,
            courseDir,
            bundle,
          });
          for (const line of report.lines) out(`  ${line}`);
          if (report.failed) {
            console.error(`${job.producer} failed, so ${job.documentId} is still the old text.`);
          }
        }
        // Read again: the producers rewrote files in place, which is what
        // turns `stale` into `rebuilt` and lets both halves be recorded
        // together. Without this the run would stamp the pre-rebuild state.
        rebuilt = freshness(named ? forRun(named) : onlyCourse(), runId, root);
        out("");
      }
      const settled = rebuilt;

      // The bytes on disk are what is about to be published, so the record is
      // made to describe them before anything is sent. This is the half that
      // used to be nobody's job: a professor who fixed a word in an approved
      // deck had a record still describing the text before the fix, and
      // nothing anywhere said so.
      if (!nothingChanged(settled)) {
        const stamped = restamp(root, courseId, settled);
        for (const line of describeFreshness(settled)) out(line);
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

      // And the checksums are read again with it. `checksums` above was taken
      // before the producers ran, so writing the ledger from it recorded the
      // OLD bytes as the ones that went out — and the next plan then reported
      // the rebuild as a change that had happened since, about a file this
      // very run had rebuilt and published. What went out is what is on disk
      // at the moment it goes.
      const sentChecksums = materialChecksums(fingerprints(published, runId, root));

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
              (job.target === "page" ? sent : [...sentChecksums.keys()])
                .filter((id) => sentChecksums.has(id))
                .map((id) => [id, sentChecksums.get(id)!]),
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

    case "grade": {
      // Grading a written exam question by question: see src/grade-board.ts.
      // `decide` is the one command that writes a professor_decision, and it
      // runs only because the professor said so — typed here, or pressed in the
      // pane, which spawns it. An earlier decision is kept, never overwritten.
      const sub = rest[0] ?? "";
      const runId = rest[1];
      const assessmentId = flag("assessment");
      const SUBS = ["status", "decide", "move", "choose", "accept-rubric", "points-only"];
      if (!SUBS.includes(sub) || !runId || !assessmentId) {
        console.error(
          "usage: grade status RUN --assessment A [--json]\n" +
            "       grade decide RUN --assessment A --decisions '[{\"student\":\"STUDENT-…\",\"item\":\"ITEM-…\",\"score\":2}]' [--via one|group|all] [--by USER-…]\n" +
            "       grade move RUN --assessment A --item ITEM (--group N (--score S | --unscored) | --student S (--to N | --ungroup))\n" +
            "       grade choose RUN --assessment A --proposal ID [--item ITEM]\n" +
            "       grade {accept-rubric|points-only} RUN --assessment A",
        );
        process.exit(2);
      }
      const bundle = forRun(runId);
      const run = runById(bundle).get(runId) as { timezone?: string; instructors?: string[] };
      const base = submissionsDir(flag("submissions-dir"));
      refuseInsideRepo(base, root);
      const place = scanPlace(base, runId, assessmentId);
      const board = gradeBoard({ bundle, runId, assessmentId, place });
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);

      if (sub === "status") {
        if (args.includes("--json")) {
          out(board);
          break;
        }
        out(`${assessmentId} — ${board.assessment.title}`);
        out(`  rubric   ${board.rubric === "accepted" ? "accepted" : board.rubric === "draft" ? "proposed, not accepted" : "none"}`);
        out(`  groups   ${board.grouped ? place.base + "/groups.yaml" : "none proposed"}`);
        for (const problem of board.group_problems) out(`  PROBLEM  ${problem}`);
        out(`  papers   ${board.totals.papers}`);
        for (const item of board.items) {
          const c = item.counts;
          out(
            `\n  Q${item.number ?? "?"} ${item.item_id}  ${item.maximum_score} mark(s)  ` +
              `${item.criterion ? item.criterion.criterion_id : "no criterion"}  ` +
              `${c.decided} of ${c.answers} decided${c.changed ? `, ${c.changed} changed from the suggestion` : ""}` +
              `${c.blank ? `, ${c.blank} blank` : ""}${c.unread ? `, ${c.unread} not read yet` : ""}` +
              `${c.ungrouped ? `, ${c.ungrouped} in no group` : ""}`,
          );
          for (const group of item.groups) {
            out(`      ${group.score ?? "?"}  ${String(group.count).padStart(3)}×  ${group.label}${group.unsure ? "  (unsure)" : ""}`);
          }
          for (const proposal of item.proposals) {
            const spread = proposal.levels.map((level) => `${level.score}:${proposal.spread.at[String(level.score)] ?? 0}`).join(" ");
            out(
              `    proposal ${proposal.id}${item.chosen === proposal.id ? " (in use)" : ""}  ${proposal.title}  ` +
                `mean ${proposal.spread.mean ?? "—"}  [${spread}]`,
            );
          }
        }
        break;
      }

      if (sub === "decide") {
        const given = flag("decisions");
        if (!given) throw new Error("--decisions is a JSON list of {student, item, score, comment?}");
        const decisions = JSON.parse(given);
        if (!Array.isArray(decisions) || !decisions.length) throw new Error("--decisions is a JSON list of {student, item, score, comment?}");
        const via = (flag("via") ?? "one") as DecidedVia;
        if (!["one", "group", "all"].includes(via)) throw new Error(`--via is one, group or all, not ${via}`);
        const result = decideGrades({
          board,
          bundle,
          decisions,
          by: flag("by") ?? run?.instructors?.[0] ?? "",
          at: decidedAt(run?.timezone),
          via,
        });
        if (result.evaluations.length) {
          for (const path of writeRecords(courseDir, { evaluations: result.evaluations as never[] })) {
            out(`wrote ${relative(root, path)}`);
          }
        }
        out(
          `${result.written} decided` +
            (result.replaced ? ` (${result.replaced} replacing an earlier decision, kept in its history)` : "") +
            (result.unchanged ? `, ${result.unchanged} already decided the same way` : ""),
        );
        // The evidence follows the marks: concept progress and the gap view read
        // evidence, not evaluations. A failure here leaves the decisions written
        // and says so — `extract-evidence` can be run once the cause is fixed.
        if (result.evaluations.length) {
          const evidence = deriveEvidence(forRun(runId), runId, { list: false });
          if (evidence.errors.length) {
            out(`evidence not derived — validation failed: ${evidence.errors.join("; ")}`);
          } else if (evidence.produced.length) {
            out(
              `${evidence.produced.length} evidence record(s) derived` +
                (evidence.refreshed ? ` (${evidence.refreshed} refreshed)` : ""),
            );
          }
        }
        break;
      }

      if (sub === "move") {
        const groups = readGroups(place);
        if (!groups) throw new Error(`no groups.yaml in ${place.base} — the answers have not been grouped yet`);
        const itemId = flag("item");
        if (!itemId) throw new Error("--item names the question");
        if (flag("student")) {
          const to = args.includes("--ungroup") ? null : Number(flag("to")) - 1;
          if (to !== null && !Number.isInteger(to)) throw new Error("--to takes a group number (1, 2, …), or pass --ungroup");
          moveAnswer(groups, itemId, flag("student")!, to);
          out(`  ${flag("student")} → ${to === null ? "no group" : `group ${to + 1}`}`);
        } else {
          const group = Number(flag("group")) - 1;
          if (!Number.isInteger(group) || group < 0) throw new Error("--group takes a group number (1, 2, …)");
          const score = args.includes("--unscored") ? null : Number(flag("score"));
          if (score !== null && !Number.isFinite(score)) throw new Error("--score takes a number, or pass --unscored");
          moveGroup(groups, itemId, group, score);
          out(`  ${itemId} group ${group + 1} → ${score ?? "unscored"}`);
        }
        const items = (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId);
        const problems = checkGroups(groups, items);
        if (problems.length) throw new Error(`not written: ${problems.join("; ")}`);
        writeGroups(place, groups);
        out(`wrote ${place.base}/groups.yaml`);
        break;
      }

      if (sub === "choose") {
        // One of the proposed rubrics, for one question or all of them. The
        // rubric goes to draft; Accept rubric is still the professor's press.
        const groups = readGroups(place);
        if (!groups?.proposals?.length) throw new Error(`no rubric proposals in ${place.base}/groups.yaml — ask the assistant for them`);
        const items = (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId);
        const problems = checkGroups(groups, items);
        if (problems.length) throw new Error(`groups.yaml has problems: ${problems.join("; ")}`);
        const proposalId = flag("proposal");
        if (!proposalId) throw new Error("--proposal names the proposal to use");
        const only = flag("item") ? flag("item")!.split(",").map((id) => id.trim()).filter(Boolean) : undefined;
        const result = chooseProposal({
          root, bundle, board, groups, proposalId, itemIds: only,
          saveGroups: (saved) => writeGroups(place, saved),
          keepMarks: args.includes("--keep-marks"),
          accept: args.includes("--accept"),
        });
        for (const path of result.written) out(`wrote ${relative(root, path)}`);
        out(
          `${assessmentId}: ${result.items.join(", ")} from proposal ${proposalId}` +
            (args.includes("--accept") ? " — accepted" : " — the rubric is a draft until you accept it"),
        );
        break;
      }

      if (sub === "accept-rubric") {
        out(
          acceptRubric({ root, bundle, board })
            ? `${assessmentId}: rubric accepted (approval: approved)`
            : `${assessmentId}: the rubric was already accepted`,
        );
        break;
      }

      if (sub === "points-only") {
        const items = (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId);
        for (const path of pointsOnlyRubric({ root, bundle, board, items })) out(`wrote ${relative(root, path)}`);
        out(`${assessmentId}: one criterion per question, worth its marks — mark each answer by points`);
        break;
      }
      break;
    }

    case "score-items": {
      // Ported from `cmd_score_items` in `ainar/cli.py`.
      //
      // Scores the item responses in the course's own record files, in place.
      // What it scores is marked `approval: draft`: a score against the answer
      // key is still a score nobody has looked at, and the gradebook and
      // extract-evidence read only approved ones.
      //
      // A file it rewrites is emitted by `dump`, which leaves a timestamp as the
      // text the author wrote; the comment block at the top is kept.
      const runFlag = rest[0] ?? flag("course-version") ?? flag("run");
      if (!runFlag) {
        console.error("usage: score-items RUN [--partial] [--rescore] [--dry-run]");
        process.exit(1);
      }

      const bundle = forRun(runFlag);
      const items = itemById(bundle) as Map<string, any>;
      const files = candidateFiles(
        root,
        (bundle.course as { course_id: string }).course_id,
        COLLECTIONS.item_responses,
      ).filter((path) => existsSync(path));
      if (!files.length) {
        out(`no item-response files in courses/${(bundle.course as any).course_id}/records/`);
        process.exit(1);
      }

      const floats = floatPaths(AGENT_WRITABLE.item_responses, ["item_responses"]);

      const combined = emptyResult();
      const touched: string[] = [];
      for (const path of files) {
        const text = readFileSync(path, "utf-8");
        const document = parse(text) ?? {};
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

        const scored = new Set(result.scored);
        for (const response of responses) {
          if (scored.has(response.response_id)) response.approval = "draft";
        }

        if (result.scored.length && !args.includes("--dry-run")) {
          const header = (/^(?:#[^\n]*\r?\n|\r?\n)*/.exec(text)?.[0] ?? "").replace(/\r\n/g, "\n");
          writeFileSync(path, header + dump(document, (p) => floats.has(p.join("."))), {
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
      for (const path of touched) out(`\nupdated ${within(root, path)}`);
      if (combined.scored.length) {
        out(
          `\n${combined.scored.length} scored response(s) are marked approval: draft. ` +
            "Review, then set approval: approved.",
        );
      }
      break;
    }

    /**
     * What is waiting for the professor: every record marked as a draft.
     *
     * The list `ainar approve` used to be the only way to see, now read off the
     * course itself. It changes nothing — accepting a record is changing its
     * `approval` (or, for a grade, adding the decision) in the file it is in.
     */
    case "drafts": {
      const asked = rest[0] ?? flag("run") ?? flag("course-version");
      const bundle = asked ? forRun(asked) : onlyCourse();
      const waiting = draftsIn(bundle);
      if (args.includes("--json")) {
        out(waiting);
        break;
      }
      if (!waiting.length) {
        out("nothing is waiting — no record is marked as a draft");
        break;
      }
      let current = "";
      for (const draft of waiting) {
        if (draft.collection !== current) {
          current = draft.collection;
          out(`${current}:`);
        }
        out(`  ${draft.id}${draft.title ? `  ${draft.title}` : ""}`);
      }
      out(
        `\n${waiting.length} draft(s). Accept one by setting approval: approved in its file; ` +
          "for an evaluation, add the professor_decision with decided_by and decided_at.",
      );
      break;
    }

    case "approve": {
      // Removed on 2026-09-29. A record an agent wrote sits in the course marked
      // `approval: draft`; accepting it is changing that word. Kept as a message
      // rather than an unknown command, because an older copy of a skill may
      // still say to run it.
      console.error(
        "`ainar approve` is gone. Drafts live in the course, marked `approval: draft`\n" +
          "(an evaluation: `status: suggested`). `ainar drafts RUN` lists them; accept one\n" +
          "by setting `approval: approved` in its file, or for a grade by adding the\n" +
          "professor_decision with decided_by and decided_at and setting its status.",
      );
      process.exit(1);
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
    case "scans": {
      // The deterministic half of grading a scanned exam: see src/scans.ts.
      // Everything this reads or writes about a named person stays under
      // --submissions-dir; what reaches courses/ is pseudonymous.
      // `let`, for `assign`: it says who one paper is, then carries on as `apply`.
      let sub = rest[0] ?? "";
      const runId = rest[1];
      const assessmentId = flag("assessment");
      const SUBS = ["identify", "file", "status", "plan", "apply", "assign", "read", "record", "answers"];
      if (!SUBS.includes(sub) || !runId || (sub !== "identify" && !assessmentId)) {
        console.error(
          "usage: scans identify RUN [--title TEXT] [--date YYYY-MM-DD]\n" +
            "       scans file RUN FILE.pdf --assessment ASSESSMENT-ID\n" +
            "       scans assign RUN --assessment ASSESSMENT-ID --pages 13-14 [--file F.pdf] (--student STUDENT-ID | --skip WHY | --reject STUDENT-ID)\n" +
            "       scans assign RUN --assessment ASSESSMENT-ID --assignments '[{\"pages\":\"13-14\",\"student\":\"STUDENT-…\"}, …]'\n" +
            "       scans read RUN --assessment ASSESSMENT-ID [--effort off|low|high|max] [--student STUDENT-ID] [--force] [--dry-run]\n" +
            "       scans {status|plan|apply|record|answers} RUN --assessment ASSESSMENT-ID",
        );
        process.exit(2);
      }
      const bundle = forRun(runId);
      const run = runById(bundle).get(runId) as { timezone?: string };
      const base = submissionsDir(flag("submissions-dir"));
      refuseInsideRepo(base, root);
      const unfiled = runInbox(base, runId);
      const runAssessments = (bundle.assessments as any[]).filter((entry) => entry.course_version_id === runId);

      if (sub === "identify") {
        // Which assessment is this pile? Ranked, never decided: the reader puts
        // the top candidate to the professor, and `scans file` acts on the answer.
        const files = await unfiledScans(unfiled);
        out(`unfiled scans in ${unfiled}`);
        if (!files.length) out("  none — put the uploaded PDFs here, then run this again");
        for (const entry of files) out(`  ${entry.file}  ${entry.page_count} page(s)`);
        const candidates = rankAssessments(runAssessments, bundle.items as any[], {
          title: flag("title"),
          date: flag("date"),
        });
        if (args.includes("--json")) {
          out({ inbox: unfiled, files, candidates });
          break;
        }
        out(`\n${runId} assessments${flag("title") ? `, against "${flag("title")}"` : ""}:`);
        if (!candidates.length) out("  none yet — this is a new assessment: /import-assessment");
        for (const entry of candidates) {
          out(
            `  ${entry.score.toFixed(2)}  ${entry.assessment_id}  ${entry.title} (${entry.type})` +
              `  ${entry.questions ? `${entry.questions} question(s)` : "NO QUESTIONS"}` +
              (entry.variants.length ? `, variants ${entry.variants.join(", ")}` : "") +
              (entry.due_at ? `  due ${String(entry.due_at).slice(0, 10)}` : ""),
          );
          if (entry.reasons.length) out(`        ${entry.reasons.join("; ")}`);
        }
        out(
          "\nAsk the professor which it is. Then `scans file` it there — or, for an exam " +
            "the course has no record of, or one with no questions, /import-assessment.",
        );
        break;
      }

      const assessment = runAssessments.find((entry) => entry.assessment_id === assessmentId);
      if (!assessment) throw new Error(`${runId} has no assessment ${assessmentId} — /import-assessment records one`);
      const items = (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId);
      const courseDir = join(root, "courses", (bundle.course as { course_id: string }).course_id);
      const place = scanPlace(base, runId, assessmentId!);
      const enrolled = new Set(enrolledIn(bundle, runId).map((entry) => entry.student_id as string));
      const now = decidedAt(run?.timezone);
      const dryRun = args.includes("--dry-run");

      if (sub === "file") {
        const file = rest[2];
        if (!file) throw new Error(`name the file: scans file ${runId} FILE.pdf --assessment ${assessmentId}`);
        const to = fileScan(unfiled, file, place);
        out(`filed ${file} under ${assessmentId}: ${to}`);
        out(
          items.length
            ? `Next: \`scans plan ${runId} --assessment ${assessmentId}\`.`
            : `${assessmentId} has no questions yet — /import-assessment records them before \`scans plan\`.`,
        );
        break;
      }

      if (sub === "answers") {
        // What the class wrote, per question, identical answers collapsed: what
        // a rubric is proposed from. Pseudonyms only — the records hold no names.
        const only = flag("item");
        const scoped = items.filter((item) => !only || item.item_id === only);
        if (only && !scoped.length) throw new Error(`${assessmentId} has no item ${only}`);
        const grouped = groupAnswers(
          scoped,
          (bundle.item_responses as any[]).filter((entry) => scoped.some((item) => item.item_id === entry.item_id)),
        );
        if (args.includes("--json")) {
          out(grouped);
          break;
        }
        for (const entry of grouped) {
          out(
            `\n${entry.item_id}  Q${entry.number ?? "?"}${entry.variant ? ` (variant ${entry.variant})` : ""}  ` +
              `${entry.type}, ${entry.maximum_score} mark(s)  ·  ${entry.answered} answered, ${entry.blank} blank, ` +
              `${entry.groups.length} distinct`,
          );
          out(`  ${entry.prompt.split("\n")[0]!.slice(0, 100)}`);
          for (const group of entry.groups) {
            const mark = group.correct === undefined ? "" : group.correct ? " ✓" : "  ";
            const low = group.low_confidence ? `  (${group.low_confidence} read with low confidence)` : "";
            const text = group.text.replace(/\s+/g, " ");
            out(`  ${String(group.count).padStart(3)}×${mark} ${text.length > 160 ? `${text.slice(0, 157)}…` : text}${low}`);
          }
        }
        if (!grouped.some((entry) => entry.answered)) {
          out(`\nNo answers recorded for ${assessmentId} yet — \`scans record\` writes them.`);
        }
        break;
      }

      if (!items.length && (sub === "plan" || sub === "apply" || sub === "assign" || sub === "read")) {
        // Every transcript is built from the questions; with none, each paper
        // would be placed with an empty transcript and nothing would say so.
        throw new Error(
          `${assessmentId} has no questions recorded, so there is nothing to read the papers against. ` +
            `Record them first (/import-assessment, or \`import-paper ${runId} --assessment ${assessmentId} --paper …\`).`,
        );
      }

      if (sub === "status") {
        const status = scanStatus(place, enrolled);
        const variants = variantsOf(items);
        out(`${assessmentId} — ${assessment.title}`);
        out(`  private folder  ${place.base}`);
        out(`  questions       ${items.length}${variants.length ? `, variants ${variants.join(", ")}` : ""}`);
        out(
          `  inbox           ${status.inbox.length} PDF(s)` +
            (status.unplanned.length ? `, ${status.unplanned.length} not in the plan yet` : ""),
        );
        out(`  planned         ${status.planned} paper(s)${status.problems ? `, ${status.problems} with a problem` : ""}`);
        out(`  placed          ${status.placed.length} of ${enrolled.size} enrolled`);
        out(`  transcribed     ${status.transcribed.length} of ${status.placed.length}`);
        if (status.missing.length && status.placed.length) {
          const shown = status.missing.slice(0, 8).join(", ");
          out(`  no scan yet     ${status.missing.length}: ${shown}${status.missing.length > 8 ? ", …" : ""}`);
        }
        break;
      }

      if (sub === "read") {
        // The one scans step that calls a model: see src/scan-read.ts. Page
        // images and readings stay in the private folder; the model provider is
        // the only thing outside this machine that sees a page.
        const effort = (flag("effort") ?? "low") as Effort;
        if (!EFFORTS.includes(effort)) throw new Error(`--effort is one of ${EFFORTS.join(", ")}, not ${effort}`);
        const model = flag("model") ?? DEFAULT_MODEL;
        const concurrency = Number(flag("concurrency") ?? 6);
        if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error(`--concurrency takes a whole number, not ${flag("concurrency")}`);
        const only = flag("student");
        const options = { students: only ? only.split(",").map((id) => id.trim()) : undefined, force: args.includes("--force") };
        if (dryRun) {
          const { targets, skipped } = readTargets(place, options);
          for (const student of targets) out(`  would read  ${student}`);
          for (const entry of skipped) out(`  left alone  ${entry.student}: ${entry.why}`);
          out(`\n--dry-run: ${targets.length} paper(s) would be sent to ${model} at effort ${effort}; nothing sent or written.`);
          break;
        }
        const apiKey = deepseekKey(fileURLToPath(new URL("../../", import.meta.url)));
        if (!apiKey) throw new Error("no DeepSeek key: set DEEPSEEK_API_KEY, or add it to the harness (.dsh/.credentials.yaml)");
        out(`reading ${assessmentId} papers with ${model}, effort ${effort}`);
        const { results, skipped } = await readScans({
          place,
          title: assessment.title,
          courseId: (bundle.course as { course_id: string }).course_id,
          items,
          reader: deepseekReader({ apiKey, model, effort }),
          model,
          effort,
          ...options,
          allPages: args.includes("--all-pages"),
          concurrency,
          now,
          onPaper: (entry) =>
            out(
              `  ${entry.status.padEnd(11)} ${entry.student}` +
                (entry.ms ? `  ${(entry.ms / 1000).toFixed(0)}s` : "") +
                (entry.usage ? `  ${entry.usage.completion_tokens ?? 0} out` : "") +
                (entry.blank_pages ? `  ${entry.blank_pages} blank page(s) not sent` : "") +
                (entry.name_confidence && entry.name_confidence !== "high" ? `  name read: ${entry.name_confidence}` : "") +
                (entry.problems.length ? `  — ${entry.problems.join("; ")}` : ""),
            ),
        });
        if (skipped.length) out(`  left alone  ${skipped.length} paper(s) already read or not placed — --dry-run lists them`);
        const sent = results.filter((entry) => entry.usage);
        const tokens = (key: "prompt_tokens" | "completion_tokens") => sent.reduce((sum, entry) => sum + (entry.usage?.[key] ?? 0), 0);
        const usd = sent.reduce((sum, entry) => sum + (entry.usd ?? 0), 0);
        out(
          `\n${results.filter((entry) => entry.status === "read").length} read, ` +
            `${results.filter((entry) => entry.status === "partly read").length} partly, ` +
            `${results.filter((entry) => entry.status === "unparsed" || entry.status === "failed").length} not read. ` +
            `${tokens("prompt_tokens")} tokens in, ${tokens("completion_tokens")} out, about $${usd.toFixed(3)} at list price.`,
        );
        out(
          "Each transcript says read_by; the reply is kept beside it in reading.json. " +
            `Next: \`scans record ${runId} --assessment ${assessmentId}\` — a misread is the professor's to catch, so every answer is recorded as a draft.`,
        );
        break;
      }

      if (sub === "plan") {
        const perPaper = flag("pages-per-student");
        if (perPaper !== undefined && args.includes("--per-file")) {
          throw new Error("--per-file and --pages-per-student are two different shapes; pass one");
        }
        const size = perPaper === undefined ? null : Number(perPaper);
        if (size !== null && (!Number.isInteger(size) || size < 1)) {
          throw new Error(`--pages-per-student takes a whole number of pages, not ${perPaper}`);
        }
        const shape: Shape = args.includes("--per-file")
          ? { kind: "per-file" }
          : size !== null
            ? { kind: "fixed", pagesPerPaper: size }
            : { kind: "read" };
        const result = await planScans(place, { courseVersionId: runId, assessmentId }, shape);
        if (!result.added.length && !result.changed.length && !result.kept.length) {
          out(`nothing in ${place.inbox} — put the scanned PDFs there, then run this again`);
          break;
        }
        for (const file of result.added) out(`  added     ${file}`);
        for (const file of result.changed) out(`  CHANGED   ${file} — re-proposed; what was written for it is gone`);
        for (const file of result.kept) out(`  kept      ${file}`);
        out(`\nwrote ${place.plan}`);
        out(
          shape.kind === "read"
            ? "Next: read each file's pages and write one entry per paper (pages, number or name, variant), then `scans apply`."
            : "Next: check each entry's pages, add who it is (number or name) and the variant, then `scans apply`.",
        );
        break;
      }

      // Who one paper is, said by hand — the professor confirming a close match,
      // naming a held paper, or saying it is nobody's. Then the same apply as
      // always, so the paper is placed by the rules every other one was.
      // One paper from the flags, or many from --assignments (a JSON list of
      // {pages, file?, student | skip | reject}) — the pane's "confirm all" —
      // checked whole before anything moves, and applied once at the end.
      const carries: { from: string; student: string }[] = [];
      if (sub === "assign") {
        if (dryRun) throw new Error("scans assign has no --dry-run: it moves a wrong placement aside");
        const given = flag("assignments");
        const answers: any[] = given
          ? JSON.parse(given)
          : [{ pages: flag("pages"), file: flag("file"), student: flag("student"), skip: flag("skip"), reject: flag("reject") }];
        if (!Array.isArray(answers) || !answers.length) throw new Error("--assignments is a JSON list of answers");
        const plan = readPlan(place);
        if (!plan) throw new Error(`no plan at ${place.plan} — run \`scans plan\` first`);
        const undo: { previous: string; student: string | null }[] = [];
        for (const answer of answers) {
          const kinds = ["student", "skip", "reject"].filter((key) => answer[key]);
          if (!answer.pages || kinds.length !== 1) {
            throw new Error("each answer takes pages and one of --student STUDENT-ID, --skip WHY or --reject STUDENT-ID");
          }
          if (answer.student && !enrolled.has(answer.student)) throw new Error(`${answer.student} is not enrolled in ${runId}`);
          const to = answer.student ? { student: answer.student } : answer.skip ? { skip: answer.skip } : { reject: answer.reject };
          const { previous } = assignPaper(plan, { pages: String(answer.pages), file: answer.file || undefined }, to);
          if (previous) undo.push({ previous, student: answer.student ?? null });
          out(`  assigned  pages ${answer.pages} → ${answer.student ?? (answer.skip ? `skip: ${answer.skip}` : `not ${answer.reject}`)}`);
        }
        // Every refusal before any move: a paper already graded stops the lot.
        const records = { evaluations: bundle.evaluations as any[], item_responses: bundle.item_responses as any[] };
        for (const { previous } of undo) {
          const graded = records.evaluations.some((entry) => entry.submission_id === scanSubmissionId(previous, assessmentId!));
          if (graded) throw new Error(`${previous}'s paper is already graded — that is a grade to reconsider, not a placement to undo`);
        }
        for (const { previous, student } of undo) {
          const undone = unplaceScan(place, previous, assessmentId!, records, now);
          const taken = removeRecords(courseDir, "item_responses", undone.responses);
          const papers = removeRecords(courseDir, "submissions", [undone.submission_id]);
          out(`  unplaced  ${previous}: ${papers} submission, ${taken} answer(s) taken back; folder kept at ${undone.moved_to ?? "(none)"}`);
          if (student && undone.moved_to) carries.push({ from: undone.moved_to, student });
        }
        writePlan(place, plan);
        sub = "apply";
      }

      if (sub === "apply") {
        const plan = readPlan(place);
        if (!plan) {
          throw new Error(`no plan at ${place.plan} — run \`scans plan ${runId} --assessment ${assessmentId}\` first`);
        }
        const directory = rosterDir(flag("roster-dir"));
        let salt: Buffer | null = null;
        try {
          salt = loadSalt(directory, { create: false });
        } catch {
          salt = null; // `identify` says so, per paper, when a number needs it
        }
        const result = await applyScans(plan, {
          place,
          courseVersionId: runId,
          assessmentId,
          items,
          enrolled,
          store: RosterStore.load(directory),
          salt,
          replace: args.includes("--replace"),
          dryRun,
          now,
        });
        for (const entry of result.placed) {
          out(
            `  placed    ${entry.student}  ${entry.pages} page(s)` +
              (entry.variant ? `  variant ${entry.variant}` : "") +
              (entry.replaced ? "  (replaced an earlier scan)" : "") +
              (entry.match === "close" ? "  (close spelling — check)" : entry.match === "words" ? "  (by its words)" : ""),
          );
        }
        const close = result.placed.filter((entry) => entry.match === "close").length;
        if (close) out(`  ${close} placed on a close spelling of the name — marked match: close in the plan; check those first`);
        if (result.unchanged.length) out(`  unchanged ${result.unchanged.length} already placed from the same pages`);
        if (result.skipped) out(`  skipped   ${result.skipped} page range(s) marked skip`);
        for (const problem of result.problems) {
          out(`  WAITING   ${problem.file}${problem.pages ? ` pages ${problem.pages}` : ""}: ${problem.problem}`);
        }
        if (dryRun) {
          out("\n--dry-run: nothing written.");
          break;
        }
        if (result.submissions.length) {
          for (const path of writeRecords(courseDir, { submissions: result.submissions as never[] })) {
            out(`wrote ${relative(root, path)}`);
          }
        }
        out(`wrote ${place.plan}`);
        for (const carry of carries) {
          if (!result.placed.some((entry) => entry.student === carry.student)) continue;
          if (carryTranscript(carry.from, place, carry.student)) {
            out(`carried the transcript read off this paper to ${carry.student} — \`scans record\` records it`);
            result.transcripts = result.transcripts.filter((student) => student !== carry.student);
          }
        }
        if (result.transcripts.length) {
          out(`\n${result.transcripts.length} transcript(s) to fill: ${join(place.base, "<STUDENT>", "transcript.yaml")}`);
        }
        if (result.problems.length) out("The papers marked WAITING stay in the plan with their problem written beside them.");
        break;
      }

      // record
      const submitted = new Set(
        (bundle.submissions as any[])
          .filter((entry) => entry.assessment_id === assessmentId)
          .map((entry) => entry.student_id as string),
      );
      const result = recordTranscripts({ place, assessmentId, items, submitted, now });
      for (const student of result.recorded) out(`  recorded  ${student}`);
      for (const entry of result.incomplete) {
        const shown = entry.unread.slice(0, 5).join(", ");
        out(`  unread    ${entry.student}: ${entry.unread.length} question(s) — ${shown}${entry.unread.length > 5 ? ", …" : ""}`);
      }
      for (const entry of result.invalid) out(`  REFUSED   ${entry.student}: ${entry.problem}`);
      if (result.low.length) {
        out(`\n${result.low.length} answer(s) read with low confidence — look at these first:`);
        for (const entry of result.low) out(`  ${entry.student}  ${entry.item}${entry.page ? `  p.${entry.page}` : ""}`);
      }
      if (result.blank) out(`${result.blank} question(s) left blank.`);
      if (dryRun) {
        out("\n--dry-run: nothing written.");
        break;
      }
      if (!result.responses.length) break;
      for (const path of writeRecords(courseDir, { item_responses: result.responses as never[] })) {
        out(`wrote ${relative(root, path)}`);
      }
      out(
        `\nEvery response is marked approval: draft. Next: \`score-items ${runId}\` for the choice ` +
          "items, then /grade-batch for the written ones.",
      );
      break;
    }

    /**
     * An exam that already exists, read into the course: see src/paper-import.ts.
     *
     * The papers and the key are copied to where they belong in the
     * assessment's folder when they are given from elsewhere; a re-import reads
     * them from there. The items are derived and written marked `approval:
     * draft`, the papers registered as Documents, and — for an exam the course
     * has no record of — the assessment itself is written as a draft with the
     * claims only the professor can make (weight, outcomes) left empty.
     */
    case "import-paper": {
      const runId = rest[0];
      const assessmentId = flag("assessment");
      const given = flagList("paper");
      if (!runId || !assessmentId || !given.length) {
        console.error(
          "usage: import-paper RUN --assessment ASSESSMENT-ID --paper PAPER.md [--paper PAPER-B.md]\n" +
            "                    [--key KEY.md] [--title TEXT] [--type exam|quiz|…] [--dry-run]",
        );
        process.exit(2);
      }
      const bundle = forRun(runId);
      const run = runById(bundle).get(runId) as { timezone?: string };
      const courseId = (bundle.course as { course_id: string }).course_id;
      const courseDir = join(root, "courses", courseId);
      const now = decidedAt(run?.timezone);
      const dryRun = args.includes("--dry-run");
      const existing = (bundle.assessments as any[]).find((entry) => entry.assessment_id === assessmentId);
      if (existing && existing.course_version_id !== runId) {
        throw new Error(`${assessmentId} belongs to ${existing.course_version_id}, not ${runId}`);
      }
      if (!existing && !flag("title")) {
        throw new Error(`${runId} has no assessment ${assessmentId}; to record a new one, give it a --title as printed on the paper`);
      }

      const papers: { paper: Paper; from: string }[] = given.map((path) => {
        const from = resolve(path);
        return { paper: parsePaper(readText(from), path), from };
      });
      const keyPath = flag("key");
      const keyFrom = keyPath ? resolve(keyPath) : join(courseDir, paperFiles(assessmentId, null).key);
      const key = existsSync(keyFrom) ? parseKey(readFileSync(keyFrom, "utf-8")) : null;
      if (keyPath && !key) throw new Error(`${keyPath} does not exist`);

      const result = importPaper({ assessmentId, papers: papers.map((entry) => entry.paper), key, now });
      // What the paper does not say, a re-import keeps: the criterion a question
      // was linked to when its rubric was proposed, the concepts and outcome it
      // was tagged with. The paper owns the question; the course owns the rest.
      const before = new Map(
        (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId).map((item) => [item.item_id, item]),
      );
      for (const item of result.items) {
        const previous = before.get(item.item_id);
        if (!previous) continue;
        for (const field of ["criterion_id", "outcome_id", "concepts", "difficulty", "role", "item_model_id", "marking_guidance"]) {
          const value = previous[field];
          const empty = value === undefined || value === null || (Array.isArray(value) && !value.length);
          if (!empty && item[field] === undefined) item[field] = value;
        }
      }
      for (const [variant, total] of result.totals) {
        const count = result.items.filter((item) => ((item.extensions as any).variant ?? "") === variant).length;
        out(`  ${variant ? `variant ${variant}` : "paper"}: ${count} question(s), ${total} mark(s)`);
      }
      for (const problem of result.problems) out(`  PROBLEM  ${problem}`);
      if (result.unkeyed.length) {
        out(`  NO KEY   ${result.unkeyed.join(", ")} — choice questions need the professor's answer before anything is written`);
      }
      if (result.noModelAnswer.length) {
        out(`  note     no model answer for ${result.noModelAnswer.join(", ")} — the rubric step will ask`);
      }
      if (existing && existing.maximum_score && result.totals.size) {
        const total = [...result.totals.values()][0]!;
        if (total !== existing.maximum_score) {
          out(`  note     the paper adds up to ${total}, the assessment says maximum_score ${existing.maximum_score}`);
        }
      }
      const kept = new Set(result.items.map((item) => item.item_id));
      const orphans = (bundle.items as any[]).filter((item) => item.assessment_id === assessmentId && !kept.has(item.item_id));
      if (orphans.length) {
        out(`  note     on record but not on these papers: ${orphans.map((item) => item.item_id).join(", ")} — remove them from items.yaml if the paper dropped them`);
      }
      if (result.problems.length || result.unkeyed.length) {
        out("\nNothing written.");
        process.exit(1);
      }
      if (dryRun) {
        out("\n--dry-run: nothing written.");
        break;
      }

      // The papers and the key, into the folder they belong in — every clash
      // checked before the first file is copied, so a refusal writes nothing.
      const moves: [string, string][] = [
        ...(key && keyPath ? [[keyFrom, paperFiles(assessmentId, null).key] as [string, string]] : []),
        ...papers.map(({ paper, from }) => [from, paperFiles(assessmentId, paper.variant).paper] as [string, string]),
      ];
      for (const [from, relativeTo] of moves) {
        const to = join(courseDir, relativeTo);
        if (resolve(to) !== from && existsSync(to) && readFileSync(to, "utf-8") !== readFileSync(from, "utf-8")) {
          throw new Error(
            `${relative(root, to)} already exists and differs from ${relative(root, from) || from} — ` +
              "edit the one in the assessment's folder and import it from there",
          );
        }
      }
      const place = (from: string, relativeTo: string): string => {
        const to = join(courseDir, relativeTo);
        if (resolve(to) === from) return to;
        mkdirSync(dirname(to), { recursive: true });
        writeFileSync(to, readFileSync(from));
        out(`wrote ${relative(root, to)}`);
        return to;
      };
      if (key && keyPath) place(keyFrom, paperFiles(assessmentId, null).key);
      const documents: Record<string, unknown>[] = [];
      for (const { paper, from } of papers) {
        const files = paperFiles(assessmentId, paper.variant);
        place(from, files.paper);
        const document: Record<string, unknown> = {
          document_id: files.documentId,
          approval: "draft",
          title: `${existing?.title ?? flag("title")} — question paper${paper.variant ? `, variant ${paper.variant}` : ""}`,
          storage_key: `courses/${courseId}/${files.paper}`,
          mime_type: "text/markdown",
          course_id: courseId,
          course_version_id: runId,
          created_at: now,
          generated_by: { produced_by: "ainar import-paper", input_refs: [assessmentId], created_at: now },
          extensions: { origin: "imported" },
        };
        stampDocument(document, root);
        documents.push(documentRecord(document));
      }

      const records: Record<string, Record<string, unknown>[]> = { items: result.items, documents };
      if (!existing) {
        const variants = papers.map((entry) => entry.paper.variant).filter(Boolean);
        records.assessments = [
          {
            assessment_id: assessmentId,
            approval: "draft",
            course_version_id: runId,
            title: flag("title"),
            type: flag("type") ?? "exam",
            maximum_score: [...result.totals.values()][0],
            // The professor's: what it is worth, and what it measures.
            weight: null,
            outcomes: [],
            delivery: "paper_exam",
            submission_type: ["pdf"],
            // One version: the paper is its instructions. With variants there is
            // no single paper to point at, and the Documents name themselves.
            ...(papers.length === 1 ? { instructions_document_id: documents[0]!.document_id } : {}),
            extensions: {
              ...(variants.length ? { paper: { variants } } : {}),
              provenance: { produced_by: "ainar import-paper", created_at: now },
            },
          },
        ];
      }
      for (const path of writeRecords(courseDir, records as never)) out(`wrote ${relative(root, path)}`);
      out(
        `\nEverything written is approval: draft.${existing ? "" : " The weight and the outcomes are yours to fill in."}\n` +
          `Next: \`ainar validate ${courseId}\`, then the scans — \`scans plan ${runId} --assessment ${assessmentId}\`.`,
      );
      break;
    }

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

      /**
       * Reconcile one run's imported enrollments with the file, report, write.
       *
       * Shared by `import` and `sync`, which differ only in where the rows
       * came from and in whether absence means a drop.
       */
      const writeRoster = (
        bundle: ReturnType<typeof forRun>,
        resolvedRun: string,
        store: RosterStore,
        result: ImportResult,
        { groups, markDropped }: { groups: string[]; markDropped: boolean },
      ): void => {
        out(`  ${result.added.length} new to the roster, ${result.known.length} already known`);
        for (const note of result.skipped) out(`  skipped ${note}`);
        if (!result.enrollments.length) {
          console.error("\nnothing to write");
          process.exit(1);
        }

        // The course directory, where the loader reads enrollments.
        const courseId = (bundle.course as { course_id: string }).course_id;
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

        const merged = reconcileEnrollments(mine, result.enrollments, { groups, markDropped });

        const say = (label: string, ids: string[]): void => {
          if (!ids.length) return;
          // Twenty, not five: these are the pseudonyms somebody acts on — whom
          // to add in Canvas, whose mark has nowhere to go — and a list cut at
          // five hid exactly the two a push could not deliver.
          const shown = ids.slice(0, 20).join(", ") + (ids.length > 20 ? ", …" : "");
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
          return;
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
      };

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
        writeRoster(bundle, resolvedRun, store, result, {
          groups: flagList("group"),
          markDropped: !args.includes("--keep-absent"),
        });
        break;
      }

      /*
       * The same import, with Canvas as the export.
       *
       * Each Canvas course the run names is read, every student is placed — by
       * a recorded link, an identifier the roster holds, or their name — and
       * the rows go through `buildRoster` and `reconcileEnrollments` exactly as
       * a file's would. `roster-sync.ts` has the matching and why.
       *
       * Absence is NOT marked by default, unlike `import`: a Canvas course
       * routinely lacks someone the registrar lists — not yet added, or added
       * to the wrong shell — and a sync is run often, so `--drop-absent` is the
       * deliberate act.
       */
      if (sub === "sync") {
        const courseVersionId = flag("run") ?? flag("course-version");
        const bundle = courseVersionId ? forRun(courseVersionId) : onlyCourse();
        const resolvedRun = courseVersionId ?? soleRun(bundle);
        const run = runById(bundle).get(resolvedRun);
        if (!run) throw new Error(`no course run '${resolvedRun}' in this workspace`);
        const links = parseLinks(flagList("link"));

        const config = loadCanvasConfig(directory, {
          baseUrl: flag("canvas-url"),
          connection: flag("connection"),
          connectionsPath: flag("connections"),
        });
        const client = new CanvasClient(config, new FetchTransport());
        const sections = await readSections(client, run, flag("group") ?? null);

        const salt = loadSalt(directory);
        const store = RosterStore.load(directory);
        const enrolled = new Set(
          enrollmentsOf(bundle, resolvedRun)
            .filter((entry) => entry.status === "active" || entry.status === "dropped")
            .map((entry) => entry.student_id),
        );
        const matches = matchSections(sections, { store, salt, enrolled, links });

        out(`Canvas ${config.base_url} (from ${config.source})`);
        for (const section of sections) {
          out(`  ${(section.group ?? resolvedRun).padEnd(16)} course ${section.courseId.padEnd(8)} ${String(section.users.length).padStart(3)} student(s)`);
        }
        const count = (how: string) => matches.filter((match) => match.how === how).length;
        out(
          `  matched ${count("linked")} by recorded link, ${count("id")} by id, ` +
            `${count("name")} by name, ${count("close")} by a close spelling; ${count("new")} new`,
        );
        // The two lists a professor acts on. Pseudonym and Canvas id only: the
        // Canvas id is what `--link` takes and what Canvas's People page shows.
        for (const match of matches.filter((entry) => entry.how === "close")) {
          out(`  check   Canvas user ${match.canvasId} → ${match.student}  (close spelling, ${match.group ?? ""})`);
        }
        const unplaced = matches.filter((entry) => !entry.student);
        for (const match of unplaced) {
          out(`  left out Canvas user ${match.canvasId}${match.group ? ` in ${match.group}` : ""}: ${match.problem}`);
        }
        if (unplaced.length) {
          out("  settle one with --link CANVAS_USER_ID=STUDENT-XXXXXX (`roster whois` says who a pseudonym is)");
        }

        const result = buildRoster(syncRows(matches), {
          courseVersionId: resolvedRun,
          store,
          salt,
          idColumn: "id",
          nameColumn: "name",
          emailColumn: "email",
          groupColumn: "group",
          today: today(),
        });
        // After `buildRoster`, which is what creates the newcomers' entries.
        recordCanvasIds(matches, store);
        writeRoster(bundle, resolvedRun, store, result, {
          // Only the sections read can speak for who is absent from them.
          groups: sections.map((section) => section.group).filter((label): label is string => !!label),
          markDropped: args.includes("--drop-absent"),
        });
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
     * shape `publish` and `lms push` have and for the same reason: the outward
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
     * Regroup a flat `materials/` into one folder per material.
     *
     * Rewrites every recorded path and every figure link, and restamps the
     * checksum of a deck whose links changed. `--dry-run` first, always.
     */
    case "organize-materials": {
      const dryRun = args.includes("--dry-run");
      const ids = rest.filter((a) => !a.startsWith("--"));
      const courseDirs = ids.length ? ids.map((id) => join(root, "courses", id)) : discoverCourses(root);
      if (!courseDirs.length) throw new Error("no courses found under courses/");
      for (const courseDir of courseDirs) {
        const name = relative(root, courseDir).split(/[\\/]/).join("/");
        const result = organizeMaterials({
          root,
          courseDir,
          courseKey: `${name}/materials/`,
          dryRun,
        });
        out(`${name}${dryRun ? " (dry run)" : ""}`);
        const inCourse = (path: string): string => relative(courseDir, path).split(/[\\/]/).join("/");
        for (const { from, to } of result.moved) {
          out(`  ${dryRun ? "would move" : "moved"} ${inCourse(from)} -> ${inCourse(to)}`);
        }
        for (const { path, references } of result.rewritten) {
          out(`  ${dryRun ? "would rewrite" : "rewrote"} ${references} spot(s) in ${inCourse(path)}`);
        }
        for (const id of result.restamped) out(`  restamped size and checksum of ${id}`);
        for (const { path, why } of result.left) out(`  left alone (${why}): ${inCourse(path)}`);
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
     * Decks: will it fit, is it renderable, and render it — one engine.
     *
     * `check` and `render` were `pres check` and `pres render` in the slides
     * plugin, and `render` was also `bin/render-deck.ts` here; the two
     * renderers disagreed about fonts, layouts and where output went, and only
     * one of them built what the course records. See `src/slides/render.ts`.
     *
     * `fit` is answered by the code that lays the deck out. The alternative was
     * watched happening: an agent redesigning a deck said "let me read the
     * exact textHeight formula so I can compute what actually fits" and opened
     * the source. Arithmetic in a model's head is expensive, unverifiable, and
     * stale the moment a font size moves. So `fit` lays the deck out with the
     * renderer itself, into a temporary folder, and reports what it measured —
     * and falls back to the dependency-free estimate only when it cannot.
     */
    case "deck": {
      const sub = rest[0];
      const usage =
        "usage: deck fit FILE.md [--verbose]\n" +
        "       deck check FILE.md | --document DOC [--course-version RUN]\n" +
        "       deck render FILE.md | --document DOC [--course-version RUN] [--pdf] [--draft] [--out DIR]";
      if (sub !== "fit" && sub !== "check" && sub !== "render") {
        console.error(usage);
        process.exit(1);
      }
      // Where the seconds went — checks, layout, PDF — to stderr, as `pres`
      // did with the same flag and the same variable.
      enableTimingFromEnvironment();
      if (args.includes("--timing")) enableTiming(true);
      process.on("exit", () => reportTimings());

      // Which deck, and what the course record says about it.
      const documentId = flag("document");
      let deck: RecordedDeck;
      let deckRoot = root;
      if (documentId) {
        const runId = flag("course-version") ?? flag("run");
        deck = deckForDocument(runId ? forRun(runId) : onlyCourse(), root, documentId);
      } else {
        const file = rest[1];
        if (!file) throw new Error(usage);
        const deckPath = resolve(file);
        // A deck named by path carries its workspace with it, so this works
        // from anywhere — `--root` still wins when given.
        if (!rootFlag) deckRoot = workspaceOf(deckPath) ?? root;
        const inCourses = relative(join(deckRoot, "courses"), deckPath).split(/[\\/]/);
        let found: RecordedDeck | null = null;
        if (inCourses.length > 1 && inCourses[0] !== ".." && !/^[A-Za-z]:/.test(inCourses[0]!)) {
          try {
            const bundle = new Workspace(deckRoot).load(inCourses[0]!).bundle!;
            found = recordFor(bundle, deckRoot, deckPath);
          } catch {
            // A course that does not load still has decks worth checking.
          }
        }
        deck = found ?? { deckPath, documentId: null, recordPlan: null, figures: {} };
      }
      const recordOptions = {
        figures: deck.figures,
        ...(deck.recordPlan ? { recordPlan: deck.recordPlan } : {}),
      };

      if (sub === "check") {
        const checked = checkDeck(deck.deckPath, recordOptions);
        out(
          `${checked.deck}: ${checked.slides.length} slides, plan ${checked.planPath}` +
            (deck.documentId ? `, recorded as ${deck.documentId}` : ""),
        );
        out(describeProblems(checked.problems));
        if (errorsIn(checked.problems).length) process.exitCode = 1;
        break;
      }

      if (sub === "render") {
        const pdf = args.includes("--pdf");
        const result = await renderDeck(deck.deckPath, {
          root: deckRoot,
          pdf,
          draft: args.includes("--draft"),
          ...(flag("out") ? { outDir: flag("out")! } : {}),
          ...recordOptions,
        });
        const report = describeRender(result, pdf);
        for (const line of report.err) console.warn(line);
        for (const line of report.out) out(line);
        // Only when this render replaced the recorded one, in the deck's own
        // folder — a render to `--out` or to output/ changed nothing recorded.
        if (deck.documentId && dirname(result.pptx) === dirname(deck.deckPath)) {
          out(
            `\nThis replaced the rendering recorded beside ${deck.documentId}, so its record's size ` +
              "and checksum no longer describe the file. `ainar publish` names what is stale " +
              "and restamps a changed rendering before it sends anything.",
          );
        }
        break;
      }

      // fit
      const verbose = args.includes("--verbose");
      let measuredBy: "renderer" | "estimate" = "estimate";
      let reason = "";
      type Row = { slide: number; title: string; bottom: number; fits: boolean; approximate: boolean; overflow: number; blocks: { kind: string; at: number; height: number; text: string }[] };
      let rows: Row[] = [];
      if (canRender()) {
        const scratch = mkdtempSync(join(tmpdir(), "ainar-deck-fit-"));
        try {
          const result = await renderDeck(deck.deckPath, { root: deckRoot, outDir: scratch, assetsDir: scratch, ...recordOptions });
          measuredBy = "renderer";
          rows = result.measured.map((slide) => ({
            slide: slide.slide,
            title: slide.title,
            bottom: slide.bottom,
            fits: slide.bottom <= PAGE.floor,
            approximate: false,
            overflow: Math.max(0, slide.bottom - PAGE.floor),
            blocks: [],
          }));
        } catch (error) {
          reason = String((error as Error).message ?? error).split("\n")[0]!;
        } finally {
          rmSync(scratch, { recursive: true, force: true });
        }
      } else {
        reason = "pptxgenjs and sharp are not installed";
      }
      if (measuredBy === "estimate") rows = measureDeck(readFileSync(deck.deckPath, "utf-8"));

      out(
        `${rows.length} slide(s), ${PAGE.floor}" of usable page — ` +
          (measuredBy === "renderer"
            ? "laid out by the renderer"
            : `ESTIMATED, not laid out (${reason}); the renderer's own numbers can differ`) +
          "\n",
      );
      for (const slide of rows) {
        // An estimated image is measured at the most it can take — the renderer
        // shrinks it to the space left — so a slide holding one is an UPPER
        // bound. Say "may" there rather than reporting a bound as a fact.
        const state = slide.fits
          ? `fits, ${(PAGE.floor - slide.bottom).toFixed(2)}" to spare`
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
      if (verbose && measuredBy === "renderer") out("\n(--verbose block detail is only available from the estimate.)");

      const certain = rows.filter((slide) => !slide.fits && !slide.approximate);
      const maybe = rows.filter((slide) => !slide.fits && slide.approximate);
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
            "each holds an image, and an image's real height is only known once it is placed.",
        );
      }
      if (!certain.length && !maybe.length) out("Every slide fits.");
      // A measurement, so a failure here is a warning and not an exit code: the
      // fonts are finally rendered by PowerPoint, not by this.
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
