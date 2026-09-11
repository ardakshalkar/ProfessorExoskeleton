/**
 * The LMS seam: getting what this workspace decided out to where students read it.
 * Ported from `ainar/lms/__init__.py`.
 *
 *     ainar lms plan   RUN --assessment A [--from export.csv]   what would change
 *     ainar lms push   RUN --assessment A --out file.csv         write a file
 *     ainar lms push   RUN --assessment A --target canvas-api --confirm
 *     ainar lms diff   RUN --assessment A                        three-way comparison
 *     ainar lms import-submissions RUN --assessment A
 *
 *     ainar lms assignment-plan RUN --assessment A               the definition
 *     ainar lms assignment-push RUN --assessment A --confirm
 *
 * ## Two things move, and they are not the same thing
 *
 * The four verbs above move **values** — one score per student. The assignment
 * pair moves the **definition**: title, points, dates, what may be handed in,
 * and the brief as the Canvas description. Before it existed, Canvas and this
 * workspace held two independent descriptions of the same assignment joined by
 * nothing but an id, and the only way to notice they disagreed was for a
 * student to ask. `lms/assignment.ts` is that half.
 *
 * They differ over subgroups, and deliberately. A push of MARKS insists on one
 * `--group` per invocation, because each cohort's data is different. A push of
 * the DEFINITION fans out to every Canvas course the run names, because the
 * definition is the same for all of them — and a definition that reached one
 * subgroup and not the other is how two halves of one class end up being told
 * different things.
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
 * Where the host and the credential live is not this module's business any
 * more: `src/connections/` owns that, one registry read by grading, publishing
 * and the pane alike. `ainar connections list` shows it, `migrate` builds it
 * from `lms.toml` and the older publishing profiles, and both of those keep
 * working underneath.
 *
 * What has not changed is that credentials never come from the repository, and
 * never from the registry either: a connection names an environment variable —
 * `AINAR_CANVAS_TOKEN`, `AINAR_SHEETS_TOKEN` — or a service-account key beside
 * the roster, and the value is read at the moment a request is made.
 */
export const TARGETS = ["canvas-csv", "canvas-api", "sheet-csv", "sheets-api"];
/** Targets that change something outside this machine when pushed. */
export const LIVE_TARGETS = ["canvas-api", "sheets-api"];
export const LMS_EXTENSION = "lms";
export const CANVAS_ASSIGNMENT_KEY = "canvas_assignment_id";
export const CANVAS_COURSE_KEY = "canvas_course_id";
export const SHEET_ID_KEY = "sheet_id";
/**
 * The per-subgroup keys, for a run that is several Canvas courses.
 *
 * One offering taught to CS-401 and CS-402 is often two Canvas courses rather
 * than one course with two sections — separate shells, separate enrolments,
 * separate assignments with separate ids. A single `canvas_course_id` cannot
 * say that, and neither can a single `canvas_assignment_id`.
 *
 * Two keys rather than letting the existing ones hold either a string or a
 * mapping. A field whose type depends on how the course happens to be
 * organised is a field every reader has to test before using, and the one
 * that forgets reads `"88219"` as a mapping and finds nothing. Separate keys
 * make the shape a fact about the name.
 *
 * Setting both forms at once is refused by the validator rather than resolved
 * by precedence: two answers to "which Canvas course is this" is not a
 * question tooling should settle quietly.
 */
export const CANVAS_COURSES_KEY = "canvas_courses";
export const CANVAS_ASSIGNMENTS_KEY = "canvas_assignments";
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
const linkage = (entity) => {
    const found = entity?.extensions?.[LMS_EXTENSION];
    return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};
const str = (entity, key) => {
    const value = linkage(entity)[key];
    return value === null || value === undefined ? null : String(value);
};
/** The Canvas assignment this assessment maps to, if it has been recorded. */
export const canvasAssignmentId = (assessment) => str(assessment, CANVAS_ASSIGNMENT_KEY);
export const canvasCourseId = (run) => str(run, CANVAS_COURSE_KEY);
/** A `subgroup -> id` mapping out of the linkage, or an empty map. */
const mapping = (entity, key) => {
    const found = linkage(entity)[key];
    const out = new Map();
    if (!found || typeof found !== "object" || Array.isArray(found))
        return out;
    for (const [group, value] of Object.entries(found)) {
        if (value === null || value === undefined)
            continue;
        const cleaned = String(value).trim();
        if (cleaned)
            out.set(group, cleaned);
    }
    return out;
};
/** Which Canvas course each subgroup is taught in, where they differ. */
export const canvasCourses = (run) => mapping(run, CANVAS_COURSES_KEY);
/** Which Canvas assignment each subgroup submits to, where they differ. */
export const canvasAssignments = (assessment) => mapping(assessment, CANVAS_ASSIGNMENTS_KEY);
/**
 * The Canvas course for one subgroup: its own, else the run's single one.
 *
 * The fallback matters for the common half-configured case — a professor who
 * has mapped CS-401 and not yet CS-402 should get a clear "CS-402 has no
 * Canvas course" from the caller, not a silent push of CS-402's marks into
 * CS-401's gradebook. So the fallback applies only when there is no mapping at
 * all; once a mapping exists, a subgroup missing from it is missing.
 */
export const canvasCourseFor = (run, group) => {
    const perGroup = canvasCourses(run);
    if (!perGroup.size)
        return canvasCourseId(run);
    if (group === null)
        return null;
    return perGroup.get(group) ?? null;
};
/** The same rule, one level down. */
export const canvasAssignmentFor = (assessment, group) => {
    const perGroup = canvasAssignments(assessment);
    if (!perGroup.size)
        return canvasAssignmentId(assessment);
    if (group === null)
        return null;
    return perGroup.get(group) ?? null;
};
/**
 * Whether this run is several Canvas courses rather than one.
 *
 * The question every caller that fans out has to ask first, and worth a name
 * because "the mapping is non-empty" reads as an implementation detail at the
 * call site while this reads as the fact it stands for.
 */
export const isPerSubgroup = (run) => canvasCourses(run).size > 0;
export const sheetId = (run) => str(run, SHEET_ID_KEY);
/** The tab an assessment or a run writes to, when one was written down. */
export const sheetTab = (entity) => str(entity, SHEET_TAB_KEY);
// --------------------------------------------------------------------------
// Default tab names
// --------------------------------------------------------------------------
/** Characters Google Sheets will not accept in a tab name. */
const FORBIDDEN_IN_TAB = new Set("[]*?/\\:");
const MAX_TAB_LENGTH = 100;
export const SUMMARY_TAB = "Summary";
const sanitise = (name) => {
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
export const defaultSheetTab = (assessment) => {
    const id = assessment.assessment_id;
    const remainder = id.startsWith("ASSESSMENT-") ? id.slice("ASSESSMENT-".length) : id;
    if (!remainder)
        return sanitise(id);
    return sanitise(/^[0-9]/.test(remainder) ? `A${remainder}` : remainder);
};
/** What the assessment actually writes to: what was written down, or the default. */
export const effectiveSheetTab = (assessment) => sheetTab(assessment) || defaultSheetTab(assessment);
export const effectiveSummaryTab = (run) => sheetTab(run) || SUMMARY_TAB;
/**
 * Which entities want which tab, defaults included.
 *
 * A collision here is not cosmetic: each push rewrites a tab whole, so two
 * claimants means one silently erases the other.
 */
export const tabOwners = (runs, assessments, courseVersionId) => {
    const owners = new Map();
    const add = (tab, who) => {
        if (!owners.has(tab))
            owners.set(tab, []);
        owners.get(tab).push(who);
    };
    const run = runs.find((entry) => entry.course_version_id === courseVersionId);
    if (run)
        add(effectiveSummaryTab(run), `${courseVersionId} (summary)`);
    for (const assessment of assessments)
        add(effectiveSheetTab(assessment), assessment.assessment_id);
    return owners;
};
