/**
 * Gradebook targets: getting approved decisions out to where students read them.
 * Ported from `ainar/lms/__init__.py`.
 *
 *     ainar lms plan   RUN --assessment A [--from export.csv]   what would change
 *     ainar lms push   RUN --assessment A --out file.csv         write a file
 *     ainar lms push   RUN --assessment A --target canvas-api --confirm
 *     ainar lms diff   RUN --assessment A                        three-way comparison
 *     ainar lms import-submissions RUN --assessment A
 *
 * Four targets, and they are not equally dangerous.
 *
 * `canvas-csv` and `sheet-csv` produce a file. It is inert until a person opens
 * or uploads it, and that upload is where a grade becomes visible to a student.
 *
 * `canvas-api` posts the grade itself, and a student can see it seconds later.
 * `sheets-api` writes the professor's own spreadsheet, which no student sees, but
 * it overwrites a document a person edits by hand.
 *
 * Both live targets require `--confirm`, and no agent may run either — the same
 * line `ainar approve` draws, for the same reason.
 *
 * The linkage between an assessment and its Canvas column lives in the
 * assessment's `extensions` mapping, which is non-secret and belongs in the
 * repository:
 *
 *     extensions:
 *       lms:
 *         canvas_assignment_id: 90218
 *
 * The course id and the spreadsheet belong on the run:
 *
 *     extensions:
 *       lms:
 *         canvas_course_id: 3312
 *         sheet_id: 1AbC…                 # the long string between /d/ and /edit
 *
 * Tab names are derived from the identifiers — `ASSESSMENT-04` writes to `A04`
 * and the run summary to `Summary` — so nothing has to be written down. Name one
 * only to override it.
 *
 * Credentials never come from the repository: `AINAR_CANVAS_TOKEN` or
 * `AINAR_SHEETS_TOKEN` in the environment, a service-account key beside the
 * roster, and the hosts in `~/.ainar/lms.toml`.
 */

export const TARGETS = ["canvas-csv", "canvas-api", "sheet-csv", "sheets-api"] as const;
export type Target = (typeof TARGETS)[number];

/** Targets that change something outside this machine when pushed. */
export const LIVE_TARGETS: readonly string[] = ["canvas-api", "sheets-api"];

export const LMS_EXTENSION = "lms";
export const CANVAS_ASSIGNMENT_KEY = "canvas_assignment_id";
export const CANVAS_COURSE_KEY = "canvas_course_id";
export const SHEET_ID_KEY = "sheet_id";

/**
 * The run's default target, set once at onboarding instead of typed every push.
 *
 * It is recorded even when this workspace cannot reach it. A professor who says
 * "we use Moodle" has told you something true and useful, and writing it down is
 * how the gap becomes visible — `lms.unsupported_target` names what is actually
 * supported rather than letting the setting look effective.
 */
export const TARGET_KEY = "target";
export const SHEET_TAB_KEY = "sheet_tab";

const linkage = (entity: any): Record<string, unknown> => {
  const found = entity?.extensions?.[LMS_EXTENSION];
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};

const str = (entity: any, key: string): string | null => {
  const value = linkage(entity)[key];
  return value === null || value === undefined ? null : String(value);
};

/** The Canvas assignment this assessment maps to, if it has been recorded. */
export const canvasAssignmentId = (assessment: any): string | null =>
  str(assessment, CANVAS_ASSIGNMENT_KEY);

export const canvasCourseId = (run: any): string | null => str(run, CANVAS_COURSE_KEY);

export const sheetId = (run: any): string | null => str(run, SHEET_ID_KEY);

/** The tab an assessment or a run writes to, when one was written down. */
export const sheetTab = (entity: any): string | null => str(entity, SHEET_TAB_KEY);

// --------------------------------------------------------------------------
// Default tab names
// --------------------------------------------------------------------------

/** Characters Google Sheets will not accept in a tab name. */
const FORBIDDEN_IN_TAB = new Set("[]*?/\\:");
const MAX_TAB_LENGTH = 100;

export const SUMMARY_TAB = "Summary";

const sanitise = (name: string): string => {
  const cleaned = [...name]
    .map((char) => (FORBIDDEN_IN_TAB.has(char) ? "-" : char))
    .join("")
    .trim();
  return cleaned.slice(0, MAX_TAB_LENGTH) || "Sheet";
};

/**
 * A tab name derived from the assessment id: `ASSESSMENT-04` → `A04`.
 *
 * From the **id**, deliberately, and never from the title. A tab name is the key
 * the next push finds the tab by, so it has to be as stable as the thing it
 * names — and in this model identifiers are permanent while titles are edited
 * freely. Deriving from the title would mean that rewording "Model Evaluation
 * Assignment" silently created a second tab and left a term's marks stranded in
 * the first.
 *
 * It also cannot collide: assessment ids are unique within a run, so the derived
 * names are too.
 */
export const defaultSheetTab = (assessment: any): string => {
  const id = assessment.assessment_id as string;
  const remainder = id.startsWith("ASSESSMENT-") ? id.slice("ASSESSMENT-".length) : id;
  if (!remainder) return sanitise(id);
  return sanitise(/^[0-9]/.test(remainder) ? `A${remainder}` : remainder);
};

/** What the assessment actually writes to: what was written down, or the default. */
export const effectiveSheetTab = (assessment: any): string =>
  sheetTab(assessment) || defaultSheetTab(assessment);

export const effectiveSummaryTab = (run: any): string => sheetTab(run) || SUMMARY_TAB;

/**
 * Which entities want which tab, defaults included.
 *
 * A collision here is not cosmetic: each push rewrites a tab whole, so two
 * claimants means one silently erases the other.
 */
export const tabOwners = (
  runs: any[],
  assessments: any[],
  courseVersionId: string,
): Map<string, string[]> => {
  const owners = new Map<string, string[]>();
  const add = (tab: string, who: string): void => {
    if (!owners.has(tab)) owners.set(tab, []);
    owners.get(tab)!.push(who);
  };
  const run = runs.find((entry) => entry.course_version_id === courseVersionId);
  if (run) add(effectiveSummaryTab(run), `${courseVersionId} (summary)`);
  for (const assessment of assessments) add(effectiveSheetTab(assessment), assessment.assessment_id);
  return owners;
};
