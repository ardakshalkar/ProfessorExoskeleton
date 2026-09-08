/**
 * The professor's own spreadsheet, as a CSV it can import. Ported from
 * `ainar/lms/sheet.py`.
 *
 * Canvas shows one number per assessment. A spreadsheet is where the breakdown
 * fits, and it is why a second gradebook is kept by hand at all — so this target
 * writes the criteria as columns, with the comments beside them.
 *
 * The layout comes from `grid.ts`, shared with the live Sheets target, so the
 * file you import and the sheet that gets written are the same table.
 *
 * One thing this sink cannot do: notice a hand edit. It writes a file, and what
 * happens when that file is imported over a sheet is between the professor and
 * their spreadsheet. `--target sheets-api` reads the tab before writing and
 * reports what it would overwrite; if scores get corrected directly in the
 * sheet, use that one.
 */

import { writeFileSync } from "node:fs";
import { type GradeRow } from "../gradebook.ts";
import { csvText } from "./csv.ts";
import { type AssessmentGridOptions, type Criterion, type Grid, assessmentGrid, values } from "./grid.ts";

/** Write any grid as CSV. Returns the number of data rows. */
export const writeGrid = (grid: Grid, path: string): number => {
  writeFileSync(path, csvText(values(grid)), { encoding: "utf-8" });
  return grid.rows.length;
};

/** One assessment as a sheet-importable CSV. */
export const writeSheet = (
  rows: GradeRow[],
  criteria: Criterion[],
  path: string,
  options: AssessmentGridOptions,
): number => writeGrid(assessmentGrid(rows, criteria, options), path);
