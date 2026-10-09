/**
 * A grade sheet the professor keeps by hand, brought into the course and kept
 * in step with it.
 *
 *     ainar homework sheet RUN --url URL --column 1Task=ASSESSMENT-HW1 …   say what the sheet is
 *     ainar homework sync  RUN [--from export.csv] [--dry-run]             bring it in again
 *
 * The sheet is one row per student and one column per assessment, and a cell
 * holds a mark word — `T` handed in, `LT` late, `LLT` very late — rather than
 * a score. Each word is a factor of the rubric: every criterion is decided at
 * its maximum times the factor, so `LT` on a 1 / 1.5 / 1.5 rubric is
 * 0.8 / 1.2 / 1.2 and the gradebook totals it to 3.2 of 4. A blank cell is
 * nothing handed in, which needs no record at all.
 *
 * ## The sheet is the professor's, so its marks are decisions
 *
 * Nobody suggested these grades; the professor typed them. They are written as
 * `professor_decision`, status `approved`, with `decided_via: grade-sheet`.
 *
 * ## A sync, not an import
 *
 * The sheet goes on being edited, so this is run again and again, and every run
 * must land on the same records. It owns exactly what it wrote — submissions
 * marked `extensions.source: grade-sheet`, evaluations marked `decided_via:
 * grade-sheet` — and nothing else:
 *
 * * a cell that changed rewrites its records; one that did not leaves them as
 *   they were, `decided_at` included;
 * * a cell emptied takes its records away again;
 * * a submission from Canvas or a scan, or a grade decided in the pane, is
 *   never touched — the run reports it and leaves the sheet's cell unapplied.
 *
 * ## Names stay outside the course
 *
 * The sheet names people. It is read where it is — Google, or a CSV beside the
 * roster — and matched to pseudonyms with the roster's own matcher; only
 * pseudonyms reach `courses/`. The settings, which pin names that would not
 * match to their pseudonym, live in `~/.ainar/sheets/`, and so does the flag
 * column's note about a person: `people.json` keeps it under `sheet_flags`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { allRubrics } from "./bundle.ts";
import { evaluationId } from "./grade-board.ts";
import { pulledSubmissionId } from "./lms/pull.ts";
import { type RosterStore } from "./roster.ts";
import { LinkTable, adoptPins } from "./sync/links.ts";
import { type MatchContext, type MatchStep, type RowIdentity, matchRow, rowKeys } from "./sync/match.ts";
import { type ConflictRule, decide } from "./sync/reconcile.ts";

/** What marks a record as the sheet's own, so a later run may change or take it back. */
export const SOURCE = "grade-sheet";

export interface SheetMark {
  /** Each criterion is decided at its maximum times this. */
  factor: number;
  status: "submitted" | "late";
  /** How the comment on the grade says it. */
  label: string;
}

export interface SheetConfig {
  run: string;
  /** The spreadsheet's URL or id, for reading it live. */
  url: string | null;
  /** The tab; the first one when not given. */
  tab: string | null;
  /** The header over the names. */
  name_column: string;
  /** A header whose cell is a note about the person, kept in the roster. */
  flag_column: string | null;
  /** Header → assessment id. */
  columns: Record<string, string>;
  /** Mark word → what it is worth. Matched without regard to case. */
  marks: Record<string, SheetMark>;
  /** A name as written in the sheet → the pseudonym it is, where matching cannot tell. */
  students: Record<string, string>;
  /** When a sync last wrote, for the pane to say. */
  synced_at?: string | null;
}

export const DEFAULT_MARKS: Record<string, SheetMark> = {
  T: { factor: 1, status: "submitted", label: "handed in" },
  LT: { factor: 0.8, status: "late", label: "late" },
  LLT: { factor: 0.5, status: "late", label: "very late" },
};

export const sheetsDir = (): string =>
  process.env.AINAR_SHEETS_DIR ? process.env.AINAR_SHEETS_DIR : join(homedir(), ".ainar", "sheets");

export const configPath = (runId: string, directory = sheetsDir()): string => join(directory, `${runId}.json`);

/** Where an exported copy of the sheet is put when it is read through a connector rather than live. */
export const exportPath = (runId: string, directory = sheetsDir()): string => join(directory, `${runId}.csv`);

export const loadSheetConfig = (runId: string, directory = sheetsDir()): SheetConfig | null => {
  const path = configPath(runId, directory);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    run: runId,
    url: raw.url ?? null,
    tab: raw.tab ?? null,
    name_column: raw.name_column ?? "Name",
    flag_column: raw.flag_column ?? null,
    columns: raw.columns ?? {},
    marks: raw.marks ?? DEFAULT_MARKS,
    students: raw.students ?? {},
    synced_at: raw.synced_at ?? null,
  };
};

export const saveSheetConfig = (config: SheetConfig, directory = sheetsDir()): string => {
  mkdirSync(directory, { recursive: true });
  const path = configPath(config.run, directory);
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { encoding: "utf-8" });
  return path;
};

// --------------------------------------------------------------------------
// Reading the grid
// --------------------------------------------------------------------------

const clean = (value: unknown): string => String(value ?? "").trim();

export interface SheetRow {
  /** 1-based, as the sheet numbers it. */
  line: number;
  name: string;
  flag: string;
  cells: Record<string, string>;
  /** The invisible tag on this row, when the sync anchors and the row has one. */
  anchor?: string | null;
}

/**
 * Where things are in the grid: the header row and each column, 0-based.
 *
 * Found by header text, or — when the sync anchors — by the invisible tags on
 * the columns, so a header retyped from "1Task" to "Task 1" is still found.
 */
export interface SheetLayout {
  headerRow: number;
  /** Mapped header (as written in the settings) → column index. */
  columns: Record<string, number>;
  name: number;
  flag: number;
}

/** What the sheet's own invisible tags say, read before the grid is parsed. */
export interface SheetAnchors {
  /** Column index → what the column is: an assessment id, or `name`, `note`. */
  columns: Map<number, string>;
  /** Row index (0-based) → the row's tag. */
  rows: Map<number, string>;
}

export const NAME_ANCHOR = "name";
export const NOTE_ANCHOR = "note";

export const sheetLayout = (grid: string[][], config: SheetConfig, anchors?: SheetAnchors | null): SheetLayout => {
  const wanted = Object.keys(config.columns);
  const anchoredAt = (what: string): number => {
    for (const [column, value] of anchors?.columns ?? []) if (value === what) return column;
    return -1;
  };
  const anchoredName = anchoredAt(NAME_ANCHOR);

  let at = grid.findIndex((row) => {
    const cells = row.map(clean);
    return cells.includes(config.name_column) && wanted.some((header) => cells.includes(header));
  });
  // A renamed header: the name column is tagged, so the header row is the
  // first non-empty one above the data in that column.
  if (at < 0 && anchoredName >= 0) {
    at = grid.findIndex((row) => clean(row[anchoredName]) !== "");
  }
  if (at < 0) {
    throw new Error(
      `no header row with "${config.name_column}" and one of ${wanted.map((h) => `"${h}"`).join(", ")} — ` +
        "check the column names with `ainar sync show RUN SYNC`, or turn on anchors so a renamed header is still found",
    );
  }
  const header = grid[at]!.map(clean);
  const index = (name: string | null) => (name ? header.indexOf(name) : -1);
  const columns: Record<string, number> = {};
  const missing: string[] = [];
  for (const column of wanted) {
    const found = index(column) >= 0 ? index(column) : anchoredAt(config.columns[column]!);
    if (found < 0) missing.push(column);
    else columns[column] = found;
  }
  if (missing.length) throw new Error(`the sheet has no column ${missing.map((h) => `"${h}"`).join(", ")}`);
  const name = index(config.name_column) >= 0 ? index(config.name_column) : anchoredName;
  const flag = config.flag_column ? (index(config.flag_column) >= 0 ? index(config.flag_column) : anchoredAt(NOTE_ANCHOR)) : -1;
  return { headerRow: at, columns, name, flag };
};

/**
 * The rows under the header, whichever row the header is on.
 *
 * A sheet a person keeps often has a title or a blank line above the table,
 * so the header is the first row that carries the name column and at least
 * one assessment column — not row one by assumption.
 */
export const sheetRows = (grid: string[][], config: SheetConfig, anchors?: SheetAnchors | null): SheetRow[] => {
  const layout = sheetLayout(grid, config, anchors);
  const wanted = Object.keys(config.columns);

  // A row with no name is kept when it carries a mark: dropping it would lose
  // the mark without a word. Only a row with neither — a spacer, a total line
  // left blank — is passed over.
  const rows: SheetRow[] = [];
  grid.slice(layout.headerRow + 1).forEach((row, offset) => {
    const index = layout.headerRow + 1 + offset;
    const name = clean(row[layout.name]);
    const cells = Object.fromEntries(wanted.map((column) => [column, clean(row[layout.columns[column]!])]));
    if (!name && !Object.values(cells).some(Boolean)) return;
    rows.push({
      line: index + 1,
      name,
      flag: layout.flag >= 0 ? clean(row[layout.flag]) : "",
      cells,
      anchor: anchors?.rows.get(index) ?? null,
    });
  });
  return rows;
};

// --------------------------------------------------------------------------
// Planning a sync
// --------------------------------------------------------------------------

export interface SyncProblem {
  line: number | null;
  name: string | null;
  problem: string;
}

export interface SyncPlan {
  placed: { line: number; student: string; match: string | null }[];
  problems: SyncProblem[];
  submissions: Record<string, unknown>[];
  evaluations: Record<string, unknown>[];
  /** Ids of the sheet's own records that the sheet no longer has. */
  remove: { submissions: string[]; evaluations: string[] };
  /**
   * The sheet's own submissions left in place because a held row may still
   * be that student — taking them back would turn a misspelt name into lost
   * grades.
   */
  kept: string[];
  unchanged: number;
  /** Pseudonym → the flag cell, for everyone the sheet placed. */
  flags: Record<string, string>;
  /** Unsure matches put in the review queue, for `ainar sync confirm`. */
  queued: number;
  /** Two-way only: cells the course changed, to write into the sheet. */
  writeBack: { line: number; column: string; student: string; word: string }[];
  /** Placed rows that carry no anchor yet, when the sync anchors. */
  anchor: { line: number; student: string }[];
  /** `student|assessment` → the mark as synced, for the ledger's base. Null forgets it. */
  synced: Record<string, string | null>;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export const planSync = (options: {
  rows: SheetRow[];
  config: SheetConfig;
  bundle: any;
  runId: string;
  store: RosterStore;
  salt: Uint8Array | null;
  enrolled: Set<string>;
  decidedBy: string | null;
  decidedAt: string;
  /** The sync this is; links and the ledger's base are kept under it. */
  syncId?: string;
  links?: LinkTable;
  steps?: MatchStep[];
  unsure?: "hold" | "ask";
  role?: "source" | "both";
  conflict?: ConflictRule;
  /** The values as last synced (`Ledger.synced`), for a two-way sync. */
  base?: Record<string, string>;
  anchors?: boolean;
}): SyncPlan => {
  const { rows, config, bundle, runId, store, salt, enrolled } = options;
  const syncId = options.syncId ?? "hw-sheet";
  const role = options.role ?? "source";
  const base = options.base ?? {};
  const plan: SyncPlan = {
    placed: [],
    problems: [],
    submissions: [],
    evaluations: [],
    remove: { submissions: [], evaluations: [] },
    kept: [],
    unchanged: 0,
    flags: {},
    queued: 0,
    writeBack: [],
    anchor: [],
    synced: {},
  };

  const marks = new Map(Object.entries(config.marks).map(([word, mark]) => [word.toUpperCase(), mark]));
  const assessments = new Map(
    (bundle.assessments as any[])
      .filter((entry) => entry.course_version_id === runId)
      .map((entry) => [entry.assessment_id as string, entry]),
  );
  const rubrics = allRubrics(bundle);
  const criteriaOf = new Map<string, any[]>();
  for (const [column, assessmentId] of Object.entries(config.columns)) {
    const assessment = assessments.get(assessmentId);
    if (!assessment) {
      plan.problems.push({ line: null, name: null, problem: `column "${column}": ${runId} has no ${assessmentId}` });
      continue;
    }
    // Inline on the assessment, or by id — the loader accepts both.
    const rubric = assessment.rubric ?? rubrics.get(assessment.rubric_id ?? "");
    const criteria = [...((rubric as any)?.criteria ?? [])];
    if (!criteria.length) {
      plan.problems.push({
        line: null,
        name: null,
        problem: `column "${column}": ${assessmentId} has no rubric criteria, so a mark cannot become a grade`,
      });
      continue;
    }
    criteriaOf.set(assessmentId, criteria);
  }

  const submissions = bundle.submissions as any[];
  const evaluations = new Map((bundle.evaluations as any[]).map((entry) => [String(entry.evaluation_id), entry]));
  const ours = (submission: any) => submission?.extensions?.source === SOURCE;
  const decidedHere = (evaluation: any) => evaluation?.extensions?.decided_via === SOURCE;

  // Who each row is, by the shared matcher: links first, then the name. The
  // older pins in the settings are links by another name and are read in.
  const links = options.links ?? new LinkTable("(in memory)", runId);
  if (Object.keys(config.students).length) adoptPins(links, syncId, config.students, options.decidedAt);
  const context: MatchContext = {
    syncId,
    steps: options.steps ?? ["link", "name", "name:one-word"],
    unsure: options.unsure ?? "hold",
    links,
    store,
    salt,
    enrolled,
    at: options.decidedAt,
  };
  const seenKeys = new Set<string>();

  // Two rows on one person is the sheet's mistake to show, not one to settle
  // by taking whichever came last.
  const rowOf = new Map<string, SheetRow>();
  // Columns where a row that could not be placed has a mark. Somebody's
  // grade is there, and until the row is placed nobody can say whose.
  const heldColumns = new Set<string>();
  const hold = (row: SheetRow, problem: string): void => {
    plan.problems.push({ line: row.line, name: row.name, problem });
    for (const [column, word] of Object.entries(row.cells)) if (word) heldColumns.add(column);
  };
  for (const row of rows) {
    if (!row.name && !row.anchor) {
      const marked = Object.entries(row.cells)
        .filter(([, word]) => word)
        .map(([column, word]) => `${word} under ${column}`);
      hold(row, `no name in "${config.name_column}", but it has ${marked.join(", ")} — write the name in`);
      continue;
    }
    const identity: RowIdentity = { label: row.name, line: row.line, name: row.name, anchor: row.anchor ?? null };
    for (const key of rowKeys(identity)) seenKeys.add(key);
    const outcome = matchRow(identity, context);
    if (outcome.status === "held") {
      if (outcome.queued) plan.queued += 1;
      hold(row, outcome.problem);
      continue;
    }
    const earlier = rowOf.get(outcome.student);
    if (earlier) {
      hold(row, `the same student as line ${earlier.line} (${outcome.student}) — link one of them with \`ainar sync link\``);
      continue;
    }
    rowOf.set(outcome.student, row);
    const how = outcome.status === "check" ? outcome.how : outcome.how === "link" || outcome.how === "name" ? null : outcome.how;
    plan.placed.push({ line: row.line, student: outcome.student, match: how });
    if (row.flag) plan.flags[outcome.student] = row.flag;
    if (options.anchors && !row.anchor) plan.anchor.push({ line: row.line, student: outcome.student });
  }
  links.pruneQueue(syncId, seenKeys);

  const wantedSubmissions = new Set<string>();
  const wantedEvaluations = new Set<string>();
  const ownedEvaluations = (submissionId: string): string[] =>
    [...evaluations.values()]
      .filter((entry) => entry.submission_id === submissionId && decidedHere(entry))
      .map((entry) => String(entry.evaluation_id));
  /** Keep what the course already has for one cell: it is neither taken back nor rewritten. */
  const keepAsIs = (student: string, assessmentId: string): void => {
    const own = submissions.find((entry) => entry.assessment_id === assessmentId && entry.student_id === student && ours(entry));
    if (!own) return;
    wantedSubmissions.add(own.submission_id);
    for (const id of ownedEvaluations(own.submission_id)) wantedEvaluations.add(id);
  };

  /**
   * The mark word the course holds for one cell, for a two-way sync to
   * compare: the sheet's own word, or one read back from grades decided
   * elsewhere when exactly one mark fits them. Null is "no word fits" — the
   * cell is then left to the sheet.
   */
  const courseWord = (student: string, assessmentId: string): string | null => {
    const held = submissions.filter((entry) => entry.assessment_id === assessmentId && entry.student_id === student);
    if (!held.length) return "";
    const own = held.find(ours);
    if (own) return String(own.extensions?.mark ?? "").toUpperCase();
    const criteria = criteriaOf.get(assessmentId) ?? [];
    let scored = 0;
    let maximum = 0;
    for (const criterion of criteria) {
      const decision = evaluations.get(evaluationId(student, criterion.criterion_id))?.professor_decision;
      if (!decision) return null;
      scored += Number(decision.score);
      maximum += Number(criterion.maximum_score);
    }
    if (!maximum) return null;
    const late = held.some((entry) => entry.status === "late");
    const fits = [...marks].filter(([, mark]) => Math.abs(mark.factor - scored / maximum) < 0.01 && (mark.status === "late") === late);
    return fits.length === 1 ? fits[0]![0] : null;
  };

  for (const [student, row] of rowOf) {
    for (const [column, assessmentId] of Object.entries(config.columns)) {
      const criteria = criteriaOf.get(assessmentId);
      if (!criteria) continue;
      const theirs = (row.cells[column] ?? "").toUpperCase();
      const cellKey = `${student}|${assessmentId}`;
      if (role === "both") {
        const ours = courseWord(student, assessmentId);
        if (ours !== null) {
          const decision = decide(cellKey, ours, base[cellKey], theirs, "both", options.conflict ?? "refuse");
          if (decision.verdict === "send") {
            plan.writeBack.push({ line: row.line, column, student, word: ours });
            plan.synced[cellKey] = ours || null;
            keepAsIs(student, assessmentId);
            continue;
          }
          if (decision.verdict === "conflict") {
            plan.problems.push({
              line: row.line,
              name: row.name,
              problem:
                `${column}: the sheet says ${theirs || "nothing"} and the course says ${ours || "nothing"}, ` +
                `and both changed since the last sync — set one of them, then sync again`,
            });
            keepAsIs(student, assessmentId);
            continue;
          }
        }
      }
      plan.synced[cellKey] = theirs || null;
      const word = row.cells[column] ?? "";
      if (!word) continue;
      const mark = marks.get(word.toUpperCase());
      if (!mark) {
        plan.problems.push({
          line: row.line,
          name: row.name,
          problem: `"${word}" under ${column} is not a mark this sheet knows (${[...marks.keys()].join(", ")})`,
        });
        continue;
      }

      const already = submissions.filter((entry) => entry.assessment_id === assessmentId && entry.student_id === student);
      const foreign = already.find((entry) => !ours(entry));
      if (foreign) {
        plan.problems.push({
          line: row.line,
          name: row.name,
          problem: `${assessmentId}: ${student} already has ${foreign.submission_id} from elsewhere — the sheet's ${word} is not applied`,
        });
        continue;
      }

      const submissionId = pulledSubmissionId(student, assessmentId);
      wantedSubmissions.add(submissionId);
      const note = `Grade sheet: ${word} (${mark.label})`;
      const before = already.find((entry) => entry.submission_id === submissionId);
      if (!before || before.status !== mark.status || before.note !== note) {
        plan.submissions.push({
          submission_id: submissionId,
          assessment_id: assessmentId,
          student_id: student,
          status: mark.status,
          note,
          extensions: { ...(before?.extensions ?? {}), source: SOURCE, mark: word },
        });
      }

      for (const criterion of criteria) {
        const id = evaluationId(student, criterion.criterion_id);
        const existing = evaluations.get(id);
        if (existing && !decidedHere(existing) && existing.professor_decision) {
          plan.problems.push({
            line: row.line,
            name: row.name,
            problem: `${criterion.criterion_id}: ${student} was graded in the pane — the sheet's ${word} is not applied to it`,
          });
          continue;
        }
        wantedEvaluations.add(id);
        const score = round(Number(criterion.maximum_score) * mark.factor);
        const comment = `${note}, ×${mark.factor}`;
        const previous = existing?.professor_decision;
        if (previous && Number(previous.score) === score && previous.comment === comment) {
          plan.unchanged += 1;
          continue;
        }
        plan.evaluations.push({
          evaluation_id: id,
          submission_id: submissionId,
          criterion_id: criterion.criterion_id,
          ...(existing?.ai_suggestion ? { ai_suggestion: existing.ai_suggestion } : {}),
          professor_decision: { score, comment, decided_by: options.decidedBy, decided_at: options.decidedAt },
          status: "approved",
          extensions: { ...(existing?.extensions ?? {}), decided_via: SOURCE },
        });
      }
    }
  }

  // What the sheet wrote before and no longer says. Only for the assessments
  // it covers: a column taken out of the settings stops the sync speaking for
  // it, and is not an instruction to delete what it once wrote.
  //
  // A student the sheet placed and whose cell is now empty has had the mark
  // taken out, and loses it. A student the sheet did not place at all is
  // different when a held row has a mark in that column: the held row may be
  // them under a misspelt or missing name, so their grade stays until the
  // row is placed.
  const covered = new Set(criteriaOf.keys());
  const heldAssessments = new Set([...heldColumns].map((column) => config.columns[column]));
  for (const submission of submissions) {
    if (!ours(submission) || !covered.has(submission.assessment_id)) continue;
    if (wantedSubmissions.has(submission.submission_id)) continue;
    if (!rowOf.has(submission.student_id) && heldAssessments.has(submission.assessment_id)) {
      plan.kept.push(submission.submission_id);
    } else {
      plan.remove.submissions.push(submission.submission_id);
    }
  }
  const removedSubmissions = new Set(plan.remove.submissions);
  const keptSubmissions = new Set(plan.kept);
  for (const evaluation of evaluations.values()) {
    if (!decidedHere(evaluation)) continue;
    if (wantedEvaluations.has(String(evaluation.evaluation_id))) continue;
    if (keptSubmissions.has(evaluation.submission_id)) continue;
    const submission = submissions.find((entry) => entry.submission_id === evaluation.submission_id);
    if (removedSubmissions.has(evaluation.submission_id) || (submission && covered.has(submission.assessment_id))) {
      plan.remove.evaluations.push(String(evaluation.evaluation_id));
    }
  }
  return plan;
};

/**
 * Keep each placed person's flag in the roster, under this run.
 *
 * The flag column is a note about a person — in the course this was built
 * for, who cannot yet do the work alone — so it lives beside their name and
 * never in `courses/`. A person the sheet no longer flags loses the note.
 */
export const applyFlags = (store: RosterStore, runId: string, placed: string[], flags: Record<string, string>): number => {
  let changed = 0;
  for (const student of placed) {
    const person = store.people[student];
    if (!person) continue;
    const all = { ...((person.sheet_flags as Record<string, string> | undefined) ?? {}) };
    const want = flags[student] ?? "";
    if ((all[runId] ?? "") === want) continue;
    if (want) all[runId] = want;
    else delete all[runId];
    if (Object.keys(all).length) person.sheet_flags = all;
    else delete person.sheet_flags;
    changed += 1;
  }
  return changed;
};
