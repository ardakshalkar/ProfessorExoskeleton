/**
 * Getting grades out — to a file, to Canvas, to a spreadsheet. Ported from
 * `ainar/commands/lms.py`.
 *
 * The largest command group, and the only one that reaches a third party. Its
 * size is mostly the refusals: what would change, what was edited in the target,
 * what the sheet holds that this workspace did not put there. Those checks are
 * the reason a push is safe to run, so they live beside the push.
 *
 * `ainar lms plan` and `diff` are read-only. `push` to a file target writes a
 * file somebody still has to upload; `push --target canvas-api` or `sheets-api`
 * reaches a live gradebook and no agent may run it.
 *
 * It lives in `src/` rather than inside `bin/ainar.ts` because it is a third the
 * size of that file on its own, and because every path through it wants testing
 * against a recorded transport rather than against a process.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { decidedAt, zoneOffsetMinutes } from "../approve.ts";
import { allRubrics, assessmentById, assessmentsOf, enrollmentsOf, runById } from "../bundle.ts";
import { type CourseBundle } from "../bundle.ts";
import { type GradeRow, gradeRows, gradebookPayload } from "../gradebook.ts";
import {
  LIVE_TARGETS,
  canvasAssignmentId,
  canvasCourseId,
  effectiveSheetTab,
  effectiveSummaryTab,
  sheetId,
  sheetTab,
} from "./index.ts";
import {
  type Directory as RosterDirectory,
  type MatchKey,
  type PlanRow,
  type PushPlan,
  Directory,
  buildPlan,
  classify,
  counts,
  drift,
  planAsDict,
  refuseInside,
  writable,
} from "./base.ts";
import {
  type CanvasExport,
  columnFor,
  assignmentColumns,
  currentScores,
  planSummaryNote,
  readExport,
  writeImport,
} from "./canvas.ts";
import {
  CanvasClient,
  CanvasError,
  apiCurrentScores,
  canvasUserIds,
  isDone,
  hasFailed,
  loadCanvasConfig,
  scaleProblem,
  visibilityNote,
} from "./canvas-api.ts";
import { type Criterion, type Grid, assessmentGrid, padded, summaryGrid, totals, width } from "./grid.ts";
import { FetchTransport, type Transport } from "./http.ts";
import { Ledger } from "./ledger.ts";
import { writeSheet } from "./sheet.ts";
import {
  SheetsClient,
  SheetsError,
  a1,
  columnLetter,
  loadCredentials,
  spreadsheetIdOf,
  totalsInTab,
  trailingRange,
} from "./sheets.ts";
import { submissionsFromApi, submissionsFromExport, writeDrafts } from "./pull.ts";
import { rosterDir } from "../roster.ts";

/** Python's `%g`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/** Everything the arguments say, in one shape the whole module reads. */
export interface LmsArgs {
  subcommand: string;
  run: string;
  assessment: string | null;
  target: string;
  by: MatchKey;
  source: string | null;
  column: string | null;
  out: string | null;
  tab: string | null;
  sheet: string | null;
  canvasUrl: string | null;
  canvasCourse: string | null;
  canvasAssignment: string | null;
  rosterDir: string | null;
  syncDir: string | null;
  allowPartial: boolean;
  withNames: boolean;
  noComments: boolean;
  comments: boolean;
  confirm: boolean;
  dryRun: boolean;
  quiet: boolean;
  json: boolean;
  overwriteDrift: boolean;
  summary: boolean;
  allTabs: boolean;
}

/** Everything a gradebook target needs, gathered before anything is decided. */
interface LmsContext {
  root: string;
  bundle: CourseBundle;
  assessment: any | null;
  directory: RosterDirectory;
  exported: CanvasExport | null;
  column: string | null;
  client: CanvasClient | null;
  courseId: string | null;
  assignmentId: string | null;
  canvasAssignment: Record<string, any> | null;
  userIds: Map<string, string>;
  submissions: Record<string, any>[];
  notes: string[];
  unmatched: string[];
  scaleProblem: string | null;
  sheets: SheetsClient | null;
  spreadsheetId: string | null;
  tab: string | null;
  existingTab: string[][];
}

export interface Deps {
  out: (line: string) => void;
  transport?: Transport;
  directory?: RosterDirectory;
  /** Replaced in tests so an unfinished Canvas job does not cost ten seconds. */
  sleep?: (ms: number) => Promise<void>;
}

const quoteTab = (tab: string): string => `'${tab.replace(/'/g, "''")}'`;

const runOf = (bundle: CourseBundle, courseVersionId: string): any =>
  runById(bundle).get(courseVersionId);

// --------------------------------------------------------------------------
// The context
// --------------------------------------------------------------------------

/** The pieces every `ainar lms` subcommand needs, resolved once. */
const openContext = async (
  args: LmsArgs,
  bundle: CourseBundle,
  root: string,
  deps: Deps,
): Promise<LmsContext> => {
  // --summary and --all cover a whole run, so neither names an assessment.
  const wholesale = args.summary || args.allTabs;
  if (!args.assessment && !wholesale) {
    throw new Error("--assessment is required (or --summary / --all, for the whole run)");
  }

  const assessment = args.assessment ? (assessmentById(bundle).get(args.assessment) ?? null) : null;
  if (assessment === null && !wholesale) {
    const available = assessmentsOf(bundle, args.run)
      .map((entry: any) => entry.assessment_id)
      .join(", ");
    throw new Error(`unknown assessment '${args.assessment}'. In this run: ${available}`);
  }

  const context: LmsContext = {
    root,
    bundle,
    assessment,
    directory: deps.directory ?? Directory.open(args.rosterDir),
    exported: args.source ? readExport(args.source) : null,
    column: null,
    client: null,
    courseId: null,
    assignmentId: null,
    canvasAssignment: null,
    userIds: new Map(),
    submissions: [],
    notes: [],
    unmatched: [],
    scaleProblem: null,
    sheets: null,
    spreadsheetId: null,
    tab: null,
    existingTab: [],
  };

  if (context.exported !== null && assessment !== null) {
    const linked = canvasAssignmentId(assessment);
    if (args.column) {
      context.column = args.column;
    } else if (linked) {
      context.column = columnFor(context.exported, linked);
      if (context.column === null) {
        const carrying = [...assignmentColumns(context.exported).keys()].join(", ") || "none";
        throw new Error(
          `${assessment.assessment_id} is linked to Canvas assignment ` +
            `${linked}, which is not a column in ${args.source}. Columns ` +
            `carrying an id: ${carrying}`,
        );
      }
    } else {
      throw new Error(
        `${assessment.assessment_id} has no extensions.lms.canvas_assignment_id, ` +
          "so there is no way to know which column is its. Add it to the " +
          "assessment, or name the column with --column.",
      );
    }
    const possible = (context.exported.points_possible[context.column] ?? "").trim();
    if (possible) {
      const parsed = Number(possible);
      if (Number.isFinite(parsed) && Math.abs(parsed - assessment.maximum_score) > 0.01) {
        context.scaleProblem =
          `the export says this column is out of ${g(parsed)} but ` +
          `the assessment here is out of ${g(assessment.maximum_score)} — ` +
          "a raw score would misreport it";
      }
    }
  }

  if (args.target === "canvas-api") {
    await openCanvas(args, context, deps);
  } else if (args.target === "sheets-api" && !args.allTabs) {
    // --all resolves every tab itself, from one listing of the spreadsheet.
    await openSheets(args, context, deps);
  }

  return context;
};

/** Open the spreadsheet and list its tabs. Shared by every sheets path. */
const sheetsTarget = async (
  args: LmsArgs,
  context: LmsContext,
  deps: Deps,
): Promise<string[]> => {
  const run = runOf(context.bundle, args.run);
  const rawId = args.sheet || sheetId(run);
  if (!rawId) {
    throw new Error(
      `${args.run} has no extensions.lms.sheet_id, so there is no spreadsheet ` +
        "to write. Add it to run.yaml — it is the long string between /d/ and " +
        "/edit in the URL — or pass --sheet.",
    );
  }
  context.spreadsheetId = spreadsheetIdOf(rawId);
  context.sheets = new SheetsClient(
    loadCredentials(rosterDir(args.rosterDir)),
    deps.transport ?? new FetchTransport(),
  );
  return context.sheets.tabTitles(context.spreadsheetId);
};

/**
 * Existing tabs that look like the one about to be created.
 *
 * Derived names are short. A professor who has been keeping 'A04 Model
 * Evaluation' by hand should be told before a tab called 'A04' appears beside it,
 * because otherwise the marks they were looking at stop updating and nothing says
 * why.
 */
const tabsResembling = (tab: string, titles: string[]): string[] => {
  const lowered = tab.toLowerCase();
  return titles.filter(
    (title) =>
      title !== tab &&
      (title.toLowerCase().startsWith(lowered) || lowered.startsWith(title.toLowerCase())),
  );
};

/** Resolve the spreadsheet, the tab, and what the tab already holds. */
const openSheets = async (args: LmsArgs, context: LmsContext, deps: Deps): Promise<void> => {
  const run = runOf(context.bundle, args.run);
  const titles = await sheetsTarget(args, context, deps);
  const writtenDown = args.summary ? sheetTab(run) : sheetTab(context.assessment);
  const derived = args.summary ? effectiveSummaryTab(run) : effectiveSheetTab(context.assessment);
  context.tab = args.tab || derived;
  const source = args.tab
    ? "named with --tab"
    : writtenDown
      ? "from extensions.lms.sheet_tab"
      : "derived from the identifier";

  if (titles.includes(context.tab)) {
    context.existingTab = await context.sheets!.read(
      context.spreadsheetId!,
      `${quoteTab(context.tab)}!A1:ZZ`,
    );
    context.notes.push(
      `Sheet tab '${context.tab}' (${source}) holds ${context.existingTab.length} row(s) now.`,
    );
  } else {
    context.notes.push(
      `Sheet tab '${context.tab}' (${source}) does not exist yet and will be created.`,
    );
    for (const near of tabsResembling(context.tab, titles)) {
      context.notes.push(
        `! '${near}' already exists and looks related. If that is the tab you ` +
          "meant, set extensions.lms.sheet_tab to it — otherwise this push " +
          "leaves it behind untouched.",
      );
    }
  }
};

/** Resolve the live Canvas side: ids, the assignment, the roster join. */
const openCanvas = async (args: LmsArgs, context: LmsContext, deps: Deps): Promise<void> => {
  const run = runOf(context.bundle, args.run);
  context.courseId = args.canvasCourse || canvasCourseId(run);
  context.assignmentId = args.canvasAssignment || canvasAssignmentId(context.assessment);
  if (!context.courseId) {
    throw new Error(
      `${args.run} has no extensions.lms.canvas_course_id, so there is no ` +
        "course to talk to. Add it to run.yaml, or pass --canvas-course.",
    );
  }
  if (!context.assignmentId) {
    throw new Error(
      `${context.assessment.assessment_id} has no ` +
        "extensions.lms.canvas_assignment_id, so there is no assignment to " +
        "grade. Add it to the assessment.",
    );
  }

  const config = loadCanvasConfig(rosterDir(args.rosterDir), { baseUrl: args.canvasUrl });
  context.client = new CanvasClient(config, deps.transport ?? new FetchTransport());
  context.canvasAssignment = await context.client.assignment(
    context.courseId,
    context.assignmentId,
  );
  context.scaleProblem = scaleProblem(context.canvasAssignment, context.assessment.maximum_score);
  context.notes.push(
    `Canvas assignment ${context.assignmentId}: ` +
      `${context.canvasAssignment.name || "untitled"}`,
  );
  if (context.canvasAssignment.published === false) {
    context.notes.push(
      "It is unpublished in Canvas, which usually means grades cannot be entered.",
    );
  }
  context.notes.push(visibilityNote(context.canvasAssignment));

  const students = await context.client.students(context.courseId);
  const joined = canvasUserIds(students, context.directory, args.by);
  context.userIds = joined.mapped;
  context.unmatched = joined.unmatched;
  context.submissions = await context.client.submissions(context.courseId, context.assignmentId);
};

// --------------------------------------------------------------------------
// The plan
// --------------------------------------------------------------------------

const makePlan = (
  args: LmsArgs,
  context: LmsContext,
): { plan: PushPlan; ledger: Ledger; rows: GradeRow[] } => {
  const assessment = context.assessment;
  const rows =
    gradeRows(context.bundle, args.run, {
      assessmentId: assessment.assessment_id,
      allowPartial: args.allowPartial,
    }).get(assessment.assessment_id) ?? [];

  // Each target is asked about its own state. A sheet is a regenerated view and
  // has none — comparing it against a Canvas export would report one target's
  // state as though it were the other's.
  let current: Record<string, number | null> = {};
  const unknown: string[] = [...context.unmatched];
  if (args.target === "canvas-csv" && context.exported !== null && context.column) {
    const found = currentScores(context.exported, context.column, context.directory, args.by);
    current = found.scores;
    unknown.push(...found.unknown);
  } else if (args.target === "canvas-api" && context.client !== null) {
    current = apiCurrentScores(context.submissions, context.userIds);
  } else if (args.target === "sheets-api" && context.existingTab.length) {
    // A sheet is a view, but it is also a box a human types into. Reading it back
    // is what turns "regenerate" into "regenerate without eating a correction
    // somebody made by hand".
    current = totalsInTab(context.existingTab, new Set(rows.map((row) => row.student_id)));
  }

  const ledger = Ledger.load(args.run, args.syncDir);
  const plan = buildPlan({
    courseVersionId: args.run,
    assessmentId: assessment.assessment_id,
    target: args.target,
    rows,
    directory: context.directory,
    current,
    prepared: ledger.prepared(args.target, assessment.assessment_id),
    requireIdentity: args.target.startsWith("canvas"),
  });

  // Someone graded in Canvas who is not in this run's roster: either the class
  // list has not been re-imported since an add/drop, or the column belongs to
  // another section. Either way it should not pass unmentioned.
  const ours = new Set(rows.map((row) => row.student_id));
  plan.unknown_in_target = [
    ...unknown,
    ...Object.keys(current)
      .filter((studentId) => !ours.has(studentId))
      .sort(),
  ];
  plan.notes.push(...context.notes);
  if (context.exported !== null && context.column) {
    plan.notes.push(planSummaryNote(context.exported, context.column));
  }
  if (context.scaleProblem) plan.notes.push(`! ${context.scaleProblem}`);

  // A live target can only be written to for students Canvas knows by id.
  if (args.target === "canvas-api") {
    for (const row of plan.rows) {
      if ((row.action === "new" || row.action === "change") && !context.userIds.has(row.student_id)) {
        row.action = "unmatched";
        row.reason =
          "no Canvas user id for this pseudonym — the roster and the " +
          "Canvas enrollment list disagree";
      }
    }
  }
  return { plan, ledger, rows };
};

const printPlan = (plan: PushPlan, out: (line: string) => void, verbose = true): void => {
  const tally = counts(plan);
  const order = ["new", "change", "unchanged", "drift", "skip", "unmatched"];
  const summary = order
    .filter((key) => key in tally)
    .map((key) => `${tally[key]} ${key}`)
    .join(", ");
  out(`${plan.assessment_id} -> ${plan.target}: ${summary || "nothing"}`);
  for (const note of plan.notes) out(`  ${note}`);

  const drifted = drift(plan);
  if (drifted.length) {
    out("\n  edited in the target since this workspace last prepared it:");
    for (const row of drifted) {
      const decided = row.score === null ? "no score" : g(row.score);
      out(
        `    ${row.student_id}  target ${g(row.current!)}  ·  decisions say ` +
          `${decided}  — left alone`,
      );
    }
    out("    Reconcile these by hand: the target may well be right.");
  }

  if (!verbose) return;
  for (const action of ["new", "change"]) {
    const rows = plan.rows.filter((row) => row.action === action);
    if (!rows.length) continue;
    out(`\n  ${action}:`);
    for (const row of rows) {
      const was = row.current === null ? "blank" : g(row.current);
      out(`    ${row.student_id}  ${was} -> ${g(row.score!)} / ${g(row.maximum!)}`);
    }
  }

  const skipped = plan.rows.filter((row) => row.action === "skip" || row.action === "unmatched");
  if (skipped.length) {
    out("\n  not exported:");
    for (const row of skipped) out(`    ${row.student_id}  ${row.reason}`);
  }
  if (plan.unknown_in_target.length) {
    out(
      `\n  ${plan.unknown_in_target.length} row(s) in the export are not in this ` +
        "run's roster: " +
        plan.unknown_in_target.slice(0, 8).join(", "),
    );
    out("    Re-import the class list, or ignore them if they are another section.");
  }
};

// --------------------------------------------------------------------------
// Shared pieces
// --------------------------------------------------------------------------

const criteriaFor = (bundle: CourseBundle, assessment: any): Criterion[] => {
  const rubric = assessment.rubric_id ? allRubrics(bundle).get(assessment.rubric_id) : null;
  return ((rubric?.criteria ?? []) as any[]).map((criterion) => ({
    criterion_id: criterion.criterion_id,
    maximum: criterion.maximum_score,
  }));
};

/**
 * Real names, resolved in memory, only when asked for.
 *
 * A sheet the professor keeps is one of the few places a name is genuinely
 * wanted, and it lives in their Google account rather than in this repository —
 * which is the only reason this is allowed at all.
 */
const namesFor = (
  args: LmsArgs,
  context: LmsContext,
  studentIds: Iterable<string>,
): Record<string, string> => {
  if (!args.withNames) return {};
  const names: Record<string, string> = {};
  for (const studentId of studentIds) {
    const identity = context.directory.identity(studentId);
    if (identity?.name) names[studentId] = identity.name;
  }
  return names;
};

const lastColumn = (grid: Grid): string => columnLetter(Math.max(width(grid), 1) - 1);

/** Write a grid over a tab, then clear whatever the old one left below it. */
const writeOneTab = async (
  context: LmsContext,
  tab: string,
  grid: Grid,
  existing: string[][],
  create: boolean,
): Promise<[number, string]> => {
  const client = context.sheets!;
  const spreadsheetId = context.spreadsheetId!;
  if (create) await client.addTab(spreadsheetId, tab);

  const target = a1(tab, `A1:${lastColumn(grid)}${grid.rows.length + grid.lead.length + 1}`);
  const written = await client.write(spreadsheetId, target, padded(grid));
  const leftover = trailingRange(tab, grid, existing);
  if (leftover) await client.clear(spreadsheetId, leftover);
  return [written, target];
};

/**
 * Cells the sheet holds that this workspace did not put there.
 *
 * Checked over the whole grid rather than over the plan, because a regeneration
 * writes blanks as well as scores — and a student who is not graded here but has
 * a number in the sheet is the case where overwriting would destroy the most.
 */
const gridConflicts = (
  existingRows: string[][],
  grid: Grid,
  prepared: Record<string, number>,
): [string, number, number | null][] => {
  const existing = totalsInTab(existingRows, new Set(grid.students));
  const conflicts: [string, number, number | null][] = [];
  for (const [studentId, cell] of Object.entries(totals(grid))) {
    const ours = cell.trim() ? Number(cell) : null;
    const theirs = existing[studentId];
    if (theirs === null || theirs === undefined) continue;
    const [action] = classify(ours, theirs, prepared[studentId]);
    if (action === "drift") conflicts.push([studentId, theirs, ours]);
  }
  return conflicts;
};

// --------------------------------------------------------------------------
// The subcommands
// --------------------------------------------------------------------------

const runPlan = async (args: LmsArgs, context: LmsContext, deps: Deps): Promise<number> => {
  const { plan } = makePlan(args, context);
  if (args.json) {
    deps.out(JSON.stringify(planAsDict(plan), null, 2));
    return 0;
  }
  printPlan(plan, deps.out);
  if (args.target === "canvas-api") {
    deps.out("\nNothing was sent. `ainar lms push --target canvas-api --confirm`");
    deps.out("posts these, and students see them as soon as Canvas has them.");
  } else if (args.target === "sheets-api") {
    deps.out("\nNothing was written. `ainar lms push --target sheets-api --confirm`");
    deps.out("regenerates the tab. No student sees that sheet.");
  } else {
    deps.out("\nNothing was written. `ainar lms push --out <file>` prepares the upload.");
  }
  return 0;
};

/** Post grades to Canvas. The only code path here that a student can feel. */
const pushToCanvas = async (
  args: LmsArgs,
  context: LmsContext,
  plan: PushPlan,
  ledger: Ledger,
  deps: Deps,
): Promise<number> => {
  const rows = writable(plan);
  const withComments = rows.filter((row) => args.comments && row.comment);
  deps.out(
    `\n${rows.length} grade(s) would be posted to Canvas assignment ` +
      `${context.assignmentId}` +
      (args.comments ? `, ${withComments.length} with a comment` : ", scores only"),
  );
  if (!args.comments) {
    deps.out("  Comments stay here unless you pass --comments.");
  } else {
    deps.out("  Comments go to the students as written. They are your words, from");
    deps.out("  professor_decision — a suggestion's comment is never sent.");
  }

  if (!args.confirm) {
    deps.out("\nnothing was sent. Add --confirm to post these.");
    deps.out("Students can see a posted grade within seconds, so read the list above");
    deps.out("before you do.");
    return 0;
  }

  const grades = new Map<string, [number, string | null]>();
  for (const row of rows) {
    const userId = context.userIds.get(row.student_id);
    if (userId) grades.set(userId, [row.score!, args.comments ? row.comment : null]);
  }

  let final;
  try {
    const progress = await context.client!.updateGrades(
      context.courseId!,
      context.assignmentId!,
      grades,
    );
    deps.out(`\nCanvas accepted the job (progress ${progress.id}); waiting for it`);
    final = await context.client!.waitFor(progress, deps.sleep ? { sleep: deps.sleep } : {});
  } catch (error) {
    if (error instanceof CanvasError) throw new Error(`\n${error.message}`);
    throw error;
  }

  if (hasFailed(final)) {
    throw new Error(
      `Canvas reported the grading job failed: ${final.message || "no detail"}. ` +
        "Nothing was recorded here; check the assignment in Canvas before retrying.",
    );
  }
  if (!isDone(final)) {
    deps.out(
      "Canvas has not finished the job yet. It usually completes on its own — " +
        `check progress ${final.id}, then run \`ainar lms diff\` to confirm.`,
    );
    deps.out("Nothing was recorded here, because it is not yet known to have landed.");
    return 0;
  }

  deps.out(`Canvas finished: ${grades.size} grade(s) posted.`);
  const at = decidedAt(runOf(context.bundle, args.run)?.timezone);
  const touched = ledger.record(args.target, context.assessment.assessment_id, rows, {
    at,
    state: "applied",
  });
  deps.out(`noted ${touched} applied value(s) in ${ledger.save()}`);
  if (context.canvasAssignment?.post_manually) {
    deps.out("This assignment posts manually: post them in Canvas for students to see.");
  }
  return 0;
};

/** Regenerate one assessment's tab, without eating a hand edit. */
const pushToSheets = async (
  args: LmsArgs,
  context: LmsContext,
  plan: PushPlan,
  ledger: Ledger,
  rows: GradeRow[],
  deps: Deps,
): Promise<number> => {
  const grid = assessmentGrid(rows, criteriaFor(context.bundle, context.assessment), {
    maximum: context.assessment.maximum_score,
    names: namesFor(args, context, rows.map((row) => row.student_id)),
    comments: !args.noComments,
  });
  deps.out(
    `\n${grid.rows.length} row(s) would be written to '${context.tab}', ` +
      `${width(grid)} column(s) wide`,
  );
  deps.out("  No student sees this sheet. It is your working copy.");

  const conflicts = gridConflicts(
    context.existingTab,
    grid,
    ledger.prepared(args.target, context.assessment.assessment_id),
  );
  if (conflicts.length && !args.overwriteDrift) {
    deps.out("\n  the sheet holds values this workspace did not put there:");
    for (const [studentId, theirs, ours] of conflicts) {
      const replacement = ours === null ? "a blank" : g(ours);
      deps.out(`    ${studentId}  sheet has ${g(theirs)}, this would write ${replacement}`);
    }
    throw new Error(
      "\nrefusing to overwrite them. Either record the decision here so the two " +
        "agree, or pass --overwrite-drift if the sheet is the one that is wrong.",
    );
  }
  if (conflicts.length) {
    deps.out(`\n  --overwrite-drift: replacing ${conflicts.length} hand-edited cell(s).`);
  }

  if (!args.confirm) {
    deps.out("\nnothing was written. Add --confirm to update the sheet.");
    return 0;
  }

  let written: number;
  let target: string;
  try {
    [written, target] = await writeOneTab(
      context,
      context.tab!,
      grid,
      context.existingTab,
      !context.existingTab.length,
    );
  } catch (error) {
    if (error instanceof SheetsError) throw new Error(`\n${error.message}`);
    throw error;
  }

  deps.out(`\nwrote ${written} row(s) to ${target}`);
  deps.out("The sheet is a view: regenerate it rather than editing scores in it.");
  const at = decidedAt(runOf(context.bundle, args.run)?.timezone);
  const touched = ledger.record(args.target, context.assessment.assessment_id, writable(plan), {
    at,
    state: "applied",
  });
  deps.out(`noted ${touched} applied value(s) in ${ledger.save()}`);
  return 0;
};

/**
 * The front page: assessments across, weighted standing at the end.
 *
 * Every column here is derived, so there is nowhere a correction could have been
 * typed — which is why this one is regenerated wholesale while the per-assessment
 * tab checks first.
 */
const pushSummaryToSheets = async (
  args: LmsArgs,
  context: LmsContext,
  deps: Deps,
): Promise<number> => {
  const payload = gradebookPayload(context.bundle, args.run, {
    allowPartial: args.allowPartial,
  }) as Record<string, any>;
  const grid = summaryGrid(payload, {
    names: namesFor(
      args,
      context,
      (payload.totals as any[]).map((total) => total.student_id),
    ),
  });
  deps.out(`${args.run} summary -> '${context.tab}'`);
  for (const note of context.notes) deps.out(`  ${note}`);
  deps.out(
    `\n${grid.rows.length} student(s) across ${(payload.assessments as any[]).length} assessment(s)`,
  );
  deps.out("  Every column is derived from decisions, so this tab is rewritten whole.");

  if (!args.confirm) {
    deps.out("\nnothing was written. Add --confirm to update the sheet.");
    return 0;
  }
  let written: number;
  let target: string;
  try {
    [written, target] = await writeOneTab(
      context,
      context.tab!,
      grid,
      context.existingTab,
      !context.existingTab.length,
    );
  } catch (error) {
    if (error instanceof SheetsError) throw new Error(`\n${error.message}`);
    throw error;
  }
  deps.out(`\nwrote ${written} row(s) to ${target}`);
  deps.out("A blank is not a zero: it means nothing has assessed that student yet.");
  return 0;
};

/**
 * Regenerate every tab of a run, assessments first and the summary last.
 *
 * Two properties make this worth having as its own path rather than a shell loop:
 *
 * **Order.** The summary is derived from the same decisions as the pages behind
 * it, so writing it last means the front page is never newer than they are. A
 * loop in the wrong order leaves a gradebook whose totals no one can reconcile.
 *
 * **All or nothing.** Every tab is built and checked before any is written, so a
 * hand edit in the fourth tab stops the first three too. A partially regenerated
 * spreadsheet — half the tabs current, the summary agreeing with neither half —
 * is worse than one that is uniformly a day old.
 */
const pushAllToSheets = async (
  args: LmsArgs,
  context: LmsContext,
  deps: Deps,
): Promise<number> => {
  const bundle = context.bundle;
  const titles = await sheetsTarget(args, context, deps);
  const ledger = Ledger.load(args.run, args.syncDir);

  const assessments = [...assessmentsOf(bundle, args.run)].sort((left: any, right: any) => {
    const leftUndated = left.due_at ? 0 : 1;
    const rightUndated = right.due_at ? 0 : 1;
    if (leftUndated !== rightUndated) return leftUndated - rightUndated;
    const byDate = String(left.due_at ?? "").localeCompare(String(right.due_at ?? ""));
    return byDate || left.assessment_id.localeCompare(right.assessment_id);
  });
  const rowsByAssessment = gradeRows(bundle, args.run, { allowPartial: args.allowPartial });
  const payload = gradebookPayload(bundle, args.run, {
    allowPartial: args.allowPartial,
  }) as Record<string, any>;

  deps.out(
    `${args.run} -> sheets-api: ${assessments.length + 1} tab(s) in spreadsheet ` +
      `${context.spreadsheetId}`,
  );

  const planned: [string, Grid, string[][], boolean, string | null][] = [];
  const conflicts: [string, string, number, number | null][] = [];
  for (const assessment of assessments as any[]) {
    const tab = effectiveSheetTab(assessment);
    const rows = rowsByAssessment.get(assessment.assessment_id) ?? [];
    const grid = assessmentGrid(rows, criteriaFor(bundle, assessment), {
      maximum: assessment.maximum_score,
      names: namesFor(args, context, rows.map((row) => row.student_id)),
      comments: !args.noComments,
    });
    const existing = titles.includes(tab)
      ? await context.sheets!.read(context.spreadsheetId!, `${quoteTab(tab)}!A1:ZZ`)
      : [];
    for (const [studentId, theirs, ours] of gridConflicts(
      existing,
      grid,
      ledger.prepared(args.target, assessment.assessment_id),
    )) {
      conflicts.push([tab, studentId, theirs, ours]);
    }
    planned.push([tab, grid, existing, !titles.includes(tab), assessment.assessment_id]);
    deps.out(
      `    ${tab.padEnd(12)} ${assessment.assessment_id.padEnd(15)} ${grid.rows.length} row(s) × ` +
        `${width(grid)} col  ${titles.includes(tab) ? "exists" : "will be created"}`,
    );
  }

  const summaryTab = effectiveSummaryTab(runOf(bundle, args.run));
  const summary = summaryGrid(payload, {
    names: namesFor(
      args,
      context,
      (payload.totals as any[]).map((total) => total.student_id),
    ),
  });
  planned.push([summaryTab, summary, [], !titles.includes(summaryTab), null]);
  deps.out(
    `    ${summaryTab.padEnd(12)} ${"(summary)".padEnd(15)} ${summary.rows.length} row(s) × ` +
      `${width(summary)} col  ` +
      `${titles.includes(summaryTab) ? "exists" : "will be created"}, written last`,
  );

  if (conflicts.length && !args.overwriteDrift) {
    deps.out("\n  the sheet holds values this workspace did not put there:");
    for (const [tab, studentId, theirs, ours] of conflicts) {
      const replacement = ours === null ? "a blank" : g(ours);
      deps.out(`    ${tab}  ${studentId}  sheet has ${g(theirs)}, this would write ${replacement}`);
    }
    throw new Error(
      `\nrefusing to write any of the ${planned.length} tab(s): a partial ` +
        "regeneration would leave the summary disagreeing with the pages behind " +
        "it. Record those decisions here, or pass --overwrite-drift.",
    );
  }
  if (conflicts.length) {
    deps.out(`\n  --overwrite-drift: replacing ${conflicts.length} hand-edited cell(s).`);
  }

  if (!args.confirm) {
    deps.out(`\nnothing was written. Add --confirm to regenerate all ${planned.length} tab(s).`);
    return 0;
  }

  const at = decidedAt(runOf(bundle, args.run)?.timezone);
  let totalRows = 0;
  for (const [tab, grid, existing, create, assessmentId] of planned) {
    let written: number;
    let target: string;
    try {
      [written, target] = await writeOneTab(context, tab, grid, existing, create);
    } catch (error) {
      if (error instanceof SheetsError) {
        throw new Error(
          `\n${error.message}\n\nTabs written before this point are current; ` +
            `'${tab}' and anything after it are not. Run it again.`,
        );
      }
      throw error;
    }
    totalRows += written;
    deps.out(`  wrote ${target}`);
    if (assessmentId !== null) {
      ledger.record(
        args.target,
        assessmentId,
        (rowsByAssessment.get(assessmentId) ?? []).filter((row) => row.score !== null && !row.blocked.length),
        { at, state: "applied" },
      );
    }
  }
  deps.out(`\n${planned.length} tab(s), ${totalRows} row(s). Ledger: ${ledger.save()}`);
  deps.out("The summary was written last, so it is not newer than the tabs behind it.");
  return 0;
};

const runPush = async (args: LmsArgs, context: LmsContext, deps: Deps): Promise<number> => {
  if (args.allTabs) return pushAllToSheets(args, context, deps);
  if (args.summary) return pushSummaryToSheets(args, context, deps);

  const { plan, ledger, rows } = makePlan(args, context);
  const live = LIVE_TARGETS.includes(args.target);
  let out: string | null = null;
  if (!live) {
    if (!args.out) throw new Error(`--out is required for --target ${args.target}`);
    out = resolve(args.out);
    refuseInside(out, context.root);
  } else if (args.out) {
    throw new Error(
      `${args.target} writes to a live target, not to a file — drop --out, or ` +
        "use a -csv target to produce a file you handle yourself.",
    );
  }

  if (args.overwriteDrift) {
    for (const row of drift(plan)) {
      row.action = "change";
      row.reason = "overwriting a value edited in the target, as asked";
    }
  }
  printPlan(plan, deps.out, !args.quiet);
  if (args.overwriteDrift) {
    deps.out("\n  --overwrite-drift: hand edits in the target will be replaced.");
  }

  if (context.scaleProblem) {
    throw new Error(
      `\nrefusing to send a score: ${context.scaleProblem}.\nFix the ` +
        "assessment's maximum_score or the assignment in Canvas, then run again.",
    );
  }
  if (args.dryRun) {
    deps.out("\ndry run — nothing written");
    return 0;
  }
  // A sheet is a whole view, not a set of changed cells: criteria, statuses and
  // who is still unmarked are worth regenerating even when no total moved.
  if (!writable(plan).length && args.target !== "sheets-api") {
    deps.out("\nnothing to send — no row would change in the target");
    return 0;
  }

  if (args.target === "canvas-api") return pushToCanvas(args, context, plan, ledger, deps);
  if (args.target === "sheets-api") return pushToSheets(args, context, plan, ledger, rows, deps);

  mkdirSync(dirname(out!), { recursive: true });
  if (args.target === "canvas-csv") {
    if (context.exported === null || context.column === null) {
      throw new Error(
        "canvas-csv needs a Canvas gradebook export: --from <export.csv>. " +
          "Starting from a real export is what makes the identity columns and " +
          "the assignment id exactly what Canvas expects back.",
      );
    }
    const written = writeImport(plan, context.exported, context.column, out!, args.by);
    deps.out(`\nwrote ${out}  (${written} score(s) in column '${context.column}')`);
    deps.out("Blank cells are left as Canvas has them — a blank is never a zero.");
    deps.out("Upload it yourself: Canvas → Grades → Import. Nothing has reached");
    deps.out("Canvas until you do, and reviewing the file first is the point.");
  } else {
    const written = writeSheet(rows, criteriaFor(context.bundle, context.assessment), out!, {
      maximum: context.assessment.maximum_score,
      names: namesFor(args, context, rows.map((row) => row.student_id)),
      comments: !args.noComments,
    });
    deps.out(`\nwrote ${out}  (${written} row(s), criteria as columns)`);
    deps.out("A sheet is a view: regenerate it rather than editing scores in it.");
  }

  const at = decidedAt(runOf(context.bundle, args.run)?.timezone);
  const touched = ledger.record(args.target, context.assessment.assessment_id, writable(plan), {
    at,
    out,
  });
  deps.out(`noted ${touched} prepared value(s) in ${ledger.save()}`);
  deps.out("'prepared' means the file exists, not that anyone uploaded it.");
  return 0;
};

/** Three-way: what the decisions say, what the target holds, what we prepared. */
const runDiff = async (args: LmsArgs, context: LmsContext, deps: Deps): Promise<number> => {
  const { plan } = makePlan(args, context);
  if (args.json) {
    deps.out(JSON.stringify(planAsDict(plan), null, 2));
    return 0;
  }

  deps.out(`${plan.assessment_id} — decisions versus ${plan.target}`);
  for (const note of plan.notes) deps.out(`  ${note}`);
  deps.out("");
  deps.out(
    `    ${"student".padEnd(16)}${"decided".padStart(9)}${"in target".padStart(11)}` +
      `${"prepared".padStart(10)}  verdict`,
  );
  const show = (value: number | null): string => (value === null ? "—" : g(value));
  for (const row of [...plan.rows].sort((left, right) =>
    left.student_id.localeCompare(right.student_id),
  )) {
    const verdict: Record<string, string> = {
      unchanged: "agrees",
      new: "not in the target yet",
      change: "target is stale",
      drift: "edited in the target",
      skip: `not exportable: ${row.reason}`,
      unmatched: row.reason || "no identity",
    };
    deps.out(
      `    ${row.student_id.padEnd(16)}${show(row.score).padStart(9)}` +
        `${show(row.current).padStart(11)}${show(row.last_prepared).padStart(10)}  ` +
        `${verdict[row.action]}`,
    );
  }
  const preparedOnly = plan.rows.filter(
    (row) => row.action === "new" && row.last_prepared !== null,
  );
  if (preparedOnly.length) {
    deps.out(
      `\n  ${preparedOnly.length} value(s) were prepared but are not in the ` +
        "target — an upload was probably never done:",
    );
    for (const row of preparedOnly) {
      deps.out(`    ${row.student_id}  prepared ${g(row.last_prepared!)}`);
    }
  }
  return 0;
};

const runImportSubmissions = async (
  args: LmsArgs,
  context: LmsContext,
  deps: Deps,
): Promise<number> => {
  const { root, bundle, assessment } = context;
  if (args.target === "canvas-csv" && (context.exported === null || context.column === null)) {
    throw new Error(
      "--from <canvas-export.csv> is required, or use --target canvas-api to " +
        "read the submissions from Canvas directly (which carries the times).",
    );
  }

  const enrolled = new Set(
    enrollmentsOf(bundle, args.run)
      .filter((enrollment: any) => enrollment.status === "active")
      .map((enrollment: any) => enrollment.student_id as string),
  );
  const known = new Set(
    (bundle.submissions as any[])
      .filter((submission) => submission.assessment_id === assessment.assessment_id)
      .map((submission) => submission.student_id as string),
  );

  let result;
  let source: string;
  if (args.target === "canvas-api") {
    result = submissionsFromApi(
      context.submissions,
      context.userIds,
      { assessmentId: assessment.assessment_id, enrolled, known },
      zoneOffsetMinutes(runOf(bundle, args.run)?.timezone),
    );
    source = `Canvas assignment ${context.assignmentId}`;
  } else {
    result = submissionsFromExport(context.exported!, context.column!, context.directory, args.by, {
      assessmentId: assessment.assessment_id,
      enrolled,
      known,
    });
    source = `${args.source}, column '${context.column}'`;
  }

  deps.out(`${source} → ${assessment.assessment_id}`);
  deps.out(`  ${result.drafts.length} proposed, ${result.already.length} already recorded here`);
  for (const studentId of result.unmatched) {
    deps.out(`  skipped ${studentId}: not an active enrollment in this run`);
  }
  if (!result.drafts.length) {
    deps.out("\nnothing to propose");
    return 0;
  }
  for (const draft of result.drafts.slice(0, 10)) {
    deps.out(
      `    ${draft.submission_id}  ${draft.student_id}  ${draft.submitted_at ?? "no time recorded"}`,
    );
  }
  if (result.drafts.length > 10) deps.out(`    … and ${result.drafts.length - 10} more`);

  if (args.dryRun) {
    deps.out("\ndry run — nothing written");
    return 0;
  }

  const out = args.out
    ? resolve(args.out)
    : join(root, "work", args.run, "submissions-draft.yaml");
  const path = writeDrafts(result.drafts, out);
  deps.out(`\nwrote ${path}`);
  if (args.target === "canvas-api") {
    deps.out("Submission times come from Canvas, converted to the run's timezone.");
  } else {
    deps.out("No submission time is recorded: a gradebook export does not carry one,");
    deps.out("and inventing it would be a fabricated fact about a student.");
  }
  deps.out(
    `\nCheck it, then approve:\n  ainar validate ${(bundle.course as any).course_id} ` +
      `--drafts work/${args.run}`,
  );
  return 0;
};

// --------------------------------------------------------------------------
// The entry point
// --------------------------------------------------------------------------

export const runLms = async (
  args: LmsArgs,
  bundle: CourseBundle,
  root: string,
  deps: Deps,
): Promise<number> => {
  if ((args.summary || args.allTabs) && args.target !== "sheets-api") {
    const which = args.summary ? "--summary" : "--all";
    throw new Error(`${which} writes into a live spreadsheet; use --target sheets-api`);
  }
  if (args.allTabs && args.summary) throw new Error("--all already includes the summary tab; drop --summary");
  if (args.allTabs && args.assessment) {
    throw new Error(
      "--all writes every tab of the run; drop --assessment, or push that one " +
        "assessment on its own",
    );
  }
  if (args.allTabs && args.tab) throw new Error("--all derives every tab name; --tab names only one");
  if (args.subcommand === "diff" && args.target === "sheet-csv") {
    throw new Error(
      "sheet-csv writes a file and cannot be read back — there is nothing to " +
        "diff against. Use --target sheets-api to compare a live sheet, or " +
        "--target canvas-csv --from <export> to compare Canvas.",
    );
  }

  const context = await openContext(args, bundle, root, deps);
  switch (args.subcommand) {
    case "plan":
      return runPlan(args, context, deps);
    case "push":
      return runPush(args, context, deps);
    case "diff":
      return runDiff(args, context, deps);
    case "import-submissions":
      return runImportSubmissions(args, context, deps);
    default:
      throw new Error(
        `unknown lms subcommand '${args.subcommand}'. It is one of: plan, push, ` +
          "diff, import-submissions",
      );
  }
};
