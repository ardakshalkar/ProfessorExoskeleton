/**
 * One layout, two sinks. Ported from `ainar/lms/grid.py`.
 *
 * A spreadsheet view of a run can be written to a CSV the professor imports, or
 * straight into a Google Sheet. Those are two sinks for the same table, and if
 * each built its own layout they would drift apart within a term — the CSV would
 * gain a column the live sheet lacked, and the professor's formulas would break
 * on the next push.
 *
 * So the layout lives here as a grid of strings, and the sinks only decide where
 * it goes. Everything in a grid is already a string: this is the boundary where
 * numbers become presentation, and doing it once is the only way the two agree.
 *
 * Two grids, because a professor's gradebook has two views:
 *
 * * **The assessment grid** — students down, rubric criteria across, one total.
 *   This is the breakdown Canvas cannot show, and the reason a second gradebook
 *   exists.
 * * **The run summary** — students down, assessments across, with the weighted
 *   standing. This is the front page of the gradebook.
 */

import { type GradeRow, exportable, g, percent } from "../gradebook.ts";

/** Header of the column a drift check reads back. */
export const TOTAL = "total";
export const STUDENT = "student";
export const POINTS_POSSIBLE = "points possible";

/** A rendered table, ready for a CSV writer or a Sheets range. */
export interface Grid {
  header: string[];
  lead: string[][];
  rows: string[][];
  /**
   * Pseudonym per entry of `rows`, same order. Empty string where a row is not
   * about one student.
   */
  students: string[];
  note: string | null;
}

export const values = (grid: Grid): string[][] => [grid.header, ...grid.lead, ...grid.rows];

export const width = (grid: Grid): number =>
  values(grid).reduce((widest, row) => Math.max(widest, row.length), 0);

export const height = (grid: Grid): number => values(grid).length;

export const column = (grid: Grid, name: string): number | null => {
  const index = grid.header.indexOf(name);
  return index === -1 ? null : index;
};

/** The total cell per student, as written. */
export const totals = (grid: Grid): Record<string, string> => {
  const index = column(grid, TOTAL);
  if (index === null) return {};
  const found: Record<string, string> = {};
  grid.students.forEach((studentId, position) => {
    const row = grid.rows[position];
    if (studentId && row && index < row.length) found[studentId] = row[index]!;
  });
  return found;
};

/** Every row the same width — a Sheets range wants a rectangle. */
export const padded = (grid: Grid): string[][] => {
  const wide = width(grid);
  return values(grid).map((row) => [...row, ...Array(wide - row.length).fill("")]);
};

export interface Criterion {
  criterion_id: string;
  maximum: number;
}

export interface AssessmentGridOptions {
  maximum: number;
  names?: Record<string, string>;
  comments?: boolean;
  includeBlocked?: boolean;
}

/**
 * One assessment: criteria across, students down.
 *
 * `includeBlocked` keeps the rows that must not reach a student — with their
 * status and the reason instead of a score. In a private working sheet that is
 * the useful thing: it shows who is still unmarked. Nothing is invented to fill
 * the gap, and a blank stays blank.
 */
export const assessmentGrid = (
  rows: GradeRow[],
  criteria: Criterion[],
  { maximum, names = {}, comments = true, includeBlocked = true }: AssessmentGridOptions,
): Grid => {
  const header = [STUDENT, "name", ...criteria.map((criterion) => criterion.criterion_id)];
  header.push(TOTAL, "maximum", "percent", "status");
  if (comments) header.push("comment");
  header.push("not_exportable_because");

  const lead = [
    [
      POINTS_POSSIBLE,
      "",
      ...criteria.map((criterion) => g(criterion.maximum)),
      g(maximum),
      "",
      "",
      "",
      ...(comments ? [""] : []),
      "",
    ],
  ];

  const grid: Grid = { header, lead, rows: [], students: [], note: null };
  for (const row of rows) {
    if (!includeBlocked && !exportable(row)) continue;
    const scored = new Map(row.criteria.map((entry) => [entry.criterion_id, entry]));
    const line = [row.student_id, names[row.student_id] ?? ""];
    for (const criterion of criteria) {
      const found = scored.get(criterion.criterion_id);
      line.push(!found || found.score === null ? "" : g(found.score));
    }
    const share = percent(row);
    line.push(
      row.score === null ? "" : g(row.score),
      g(row.maximum),
      share === null ? "" : g(share),
      row.status,
    );
    if (comments) line.push(row.comment ?? "");
    line.push(exportable(row) ? "" : row.blocked.join("; "));
    grid.rows.push(line);
    grid.students.push(row.student_id);
  }
  return grid;
};

/**
 * The whole run: assessments across, weighted standing at the end.
 *
 * The standing is a share of what has been graded so far, carried over from
 * `ainar gradebook` — not a final grade, and labelled as such in the header so a
 * column heading cannot quietly become one.
 */
export const summaryGrid = (
  payload: Record<string, any>,
  { names = {} }: { names?: Record<string, string> } = {},
): Grid => {
  const assessments = payload.assessments as Record<string, any>[];
  const header = [STUDENT, "name"];
  for (const assessment of assessments) {
    const weight = assessment.weight as number | null;
    // `f"{weight:.0%}"`: a weight is two decimals at most, so no value here can
    // land on a half percent and disagree with Python's rounding.
    const suffix = weight === null || weight === undefined ? "" : ` (${Math.round(weight * 100)}%)`;
    header.push(`${assessment.assessment_id}${suffix}`);
  }
  header.push("% of graded so far", "weight graded", "outstanding");

  const lead = [
    [POINTS_POSSIBLE, "", ...assessments.map((assessment) => g(assessment.maximum)), "", "", ""],
  ];

  const byStudent = new Map<string, Map<string, any>>();
  for (const assessment of assessments) {
    for (const row of assessment.rows as Record<string, any>[]) {
      if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, new Map());
      byStudent.get(row.student_id)!.set(assessment.assessment_id, row);
    }
  }
  const totalsByStudent = new Map(
    (payload.totals as Record<string, any>[]).map((total) => [total.student_id, total]),
  );

  const grid: Grid = {
    header,
    lead,
    rows: [],
    students: [],
    note: "Regenerated from professor decisions. A blank was never assessed; it is not a zero.",
  };

  for (const studentId of [...byStudent.keys()].sort()) {
    const line = [studentId, names[studentId] ?? ""];
    for (const assessment of assessments) {
      const row = byStudent.get(studentId)!.get(assessment.assessment_id);
      line.push(!row || row.score === null ? "" : g(row.score));
    }
    const total = totalsByStudent.get(studentId);
    if (!total) {
      line.push("", "", "");
    } else {
      line.push(
        total.percent_of_graded === null ? "" : g(total.percent_of_graded),
        g(total.weight_graded),
        (total.assessments_outstanding as string[]).join(", "),
      );
    }
    grid.rows.push(line);
    grid.students.push(studentId);
  }
  return grid;
};
