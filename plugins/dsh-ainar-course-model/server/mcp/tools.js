/**
 * The fourteen portable read-only tools. Ported from `ainar/mcp/tools.py`.
 *
 * What is **not** here is the point of the file. `approve`, `lms push`,
 * `roster whois` and the rest are absent by construction, not disabled by a
 * flag — a rule in CLAUDE.md is an instruction to a model, and a verb that does
 * not exist is not. `WITHHELD` records each omission with its reason so the
 * list cannot quietly shrink. Shared-backend integrations are added separately
 * by `server.ts`; they never appear in the local stdio or MCPB surface.
 */
import { statSync } from "node:fs";
import { join } from "node:path";
import { assessmentsOf, courseContext } from "../bundle.js";
import { blueprintPayload } from "../blueprint.js";
import { gradebookPayload } from "../gradebook.js";
import { calibrationPayload, pendingPayload, rubricPayload } from "../grading.js";
import { inboxPayload } from "../inbox.js";
import { outlinePayload } from "../outline.js";
import { dashboardPayload, studentRecord } from "../progress.js";
import { alignmentMarkdown, syllabusMarkdown } from "../report.js";
import { coverage, validate } from "../validate.js";
import { SCHEMA_NAMES, shapeOf } from "../schema.js";
import { ToolError, referenceDate, requireRunId } from "./workspace.js";
import { BY_TOOL } from "./widgets.js";
export const WITHHELD = {
    approve: "turns a proposal into a record. It is the only place a human enters the loop, and a tool that could be called by the model it is meant to check is not a check at all.",
    "lms push": "writes a grade to Canvas or a spreadsheet. A student can see a posted grade within seconds, which makes it the same act as approving.",
    "lms plan / lms diff": "read-only, but they reach a third party and need a token. Keeping them out is what lets this server hold no credential at all.",
    "roster whois / roster show": "resolves a pseudonym to a real person. The mapping lives outside the repository on purpose; a tool that returns names would move it back in.",
    "roster import": "writes enrollments, and reads a file full of real names.",
    "extract-evidence / roll-up": "deterministic and safe to run, but they write records into courses/. Run them from the CLI after approving.",
    "score-items": "rewrites draft files in place.",
    "export / sql": "generate files; a person should decide where.",
};
const VERSION_ARG = {
    course_version_id: { type: "string", description: "Course run id, e.g. CSS-4008-2026-FALL" },
};
const DATE_ARG = { date: { type: "string", description: "YYYY-MM-DD; defaults to today" } };
const ASSESSMENT_ARG = {
    assessment_id: { type: "string", description: "Restrict to one assessment" },
};
const schema = (properties, required = ["course_version_id"]) => ({
    type: "object",
    properties,
    required,
    additionalProperties: false,
});
/**
 * What to change, phrased for whoever set the root.
 *
 * This sentence used to name `AINAR_WORKSPACE` whatever the host. That is right
 * for the standalone MCP server, which resolves from exactly that variable, and
 * wrong everywhere else: the CLI took `--root` or the directory it ran in, and
 * the harness plugins take the folder the session was opened on. A professor
 * reading "AINAR_WORKSPACE should point at…" in the Course pane is being sent
 * to fix a variable that had no part in the answer — and, worse, one that may
 * be set correctly for something else entirely.
 *
 * The two session entries are close to unreachable, because both plugins
 * resolve through `workspaceRootFor`, which returns a directory only once it
 * has seen `courses/` inside it. They are here for the race — a folder renamed
 * between resolving and reading — and because an unreachable branch that lies
 * is still a lie waiting for its caller.
 */
const FIX = {
    env: "AINAR_WORKSPACE should point at the folder that *contains* courses/, not " +
        "at a course itself and not at unmodelled material.",
    flag: "`--root` should name the folder that *contains* courses/, not a course " +
        "itself and not unmodelled material.",
    cwd: "Stand in the folder that *contains* courses/ — not in a course, and not " +
        "in unmodelled material — or pass `--root` naming that folder.",
    session: "Open the folder that *contains* courses/ as this session's workspace, not " +
        "a course itself and not unmodelled material.",
    unknown: "The workspace should be the folder that *contains* courses/, not a course " +
        "itself and not unmodelled material.",
};
/**
 * Why the course list is empty, when it is. Ported from `_why_empty`.
 *
 * An empty list means two very different things: this workspace has no courses
 * yet, or the workspace is not where the caller thinks it is. The second is the
 * commonest first-run mistake and it is the one a bare `[]` describes worst — a
 * client reads it back as "your workspace is empty", which sounds like a fact
 * about the professor's work rather than about a path.
 */
const whyEmpty = (workspace) => {
    if (workspace.courseIds().length)
        return {};
    if (!workspace.root)
        return { note: `${workspace.store.label} returned no courses.` };
    const courses = join(workspace.root, "courses");
    let isDirectory = false;
    try {
        isDirectory = statSync(courses).isDirectory();
    }
    catch {
        isDirectory = false;
    }
    if (!isDirectory) {
        return {
            note: `No courses/ directory under ${workspace.root}. ${FIX[workspace.origin]} ` +
                "Nothing has been read.",
        };
    }
    return {
        note: `${courses} exists but no subdirectory of it holds a course.yaml, which ` +
            "is what marks a folder as a course. Scaffold one with `ainar new course`.",
    };
};
const text = (value) => typeof value === "string" ? value : JSON.stringify(value, null, 2);
export const TOOLS = [
    {
        name: "list_courses",
        description: "List the courses in this workspace with their runs, assessments and validation state.",
        inputSchema: schema({}, []),
        handler: (workspace) => ({
            workspace: workspace.store.label,
            courses: workspace.courseIds().map((courseId) => {
                try {
                    const { bundle } = workspace.load(courseId);
                    const issues = validate(bundle, { root: workspace.root });
                    return {
                        course_id: courseId,
                        title: bundle.course.title,
                        runs: bundle.versions.map((run) => ({
                            course_version_id: run.course_version_id,
                            term: run.term,
                            start_date: run.start_date,
                            end_date: run.end_date,
                        })),
                        assessments: bundle.versions.flatMap((run) => assessmentsOf(bundle, run.course_version_id).map((a) => a.assessment_id)),
                        // The counts travel with their coverage. That mattered most when
                        // the port was partial and `errors: 0` would have read as "checked
                        // and clean" on a third of the checks; it stays now that the port is
                        // complete, because the ratio is what lets a reader tell the two
                        // situations apart without knowing which version they are talking to.
                        errors: issues.errors.length,
                        warnings: issues.warnings.length,
                        validation: coverage(),
                    };
                }
                catch (error) {
                    return { course_id: courseId, error: String(error.message) };
                }
            }),
            ...whyEmpty(workspace),
        }),
    },
    {
        name: "course_context",
        description: "The Course Context document for one run: identity, learning outcomes, the concept graph with prerequisites, capabilities, which module the run is currently in, active assessments and class state.",
        inputSchema: schema({ ...VERSION_ARG, ...DATE_ARG }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            const bundle = workspace.findRun(courseVersionId);
            return courseContext(bundle, courseVersionId, referenceDate(bundle, courseVersionId, args.date));
        },
    },
    {
        name: "course_outline",
        description: "One run as a term plan, week by week: the module taught in each week, the lectures and labs scheduled inside it with dates and rooms, and the assessments that open or fall due there, plus the declared weights and the required materials. This is the course page — what a student would see. A week with no module is reported as unplanned rather than as empty, and no figure derived from student work appears: for those, call gradebook or class_progress.",
        inputSchema: schema({ ...VERSION_ARG, ...DATE_ARG }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            const bundle = workspace.findRun(courseVersionId);
            return outlinePayload(bundle, courseVersionId, referenceDate(bundle, courseVersionId, args.date));
        },
    },
    {
        name: "validate_course",
        description: "Every validation error and warning for one course, with the code and location of each.",
        inputSchema: schema({ course_id: { type: "string", description: "e.g. CSS-4008 — the course, not the run" } }, ["course_id"]),
        handler: (workspace, args) => {
            const courseId = String(args.course_id ?? "").trim();
            if (!courseId)
                throw new ToolError("course_id is required, e.g. 'CSS-4008'");
            const { bundle } = workspace.load(courseId);
            const issues = validate(bundle, { root: workspace.root });
            const describe = (issue) => ({
                code: issue.code,
                message: issue.message,
                location: issue.location ?? null,
            });
            return {
                course_id: courseId,
                errors: issues.errors.map(describe),
                warnings: issues.warnings.map(describe),
                // The list is as partial as the validator is, and an empty one would
                // otherwise read as "checked and clean" — a far stronger claim than 18
                // of 94 checks can support.
                validation: coverage(),
                scope: "courses/ only. Drafts under work/ are not visible to this server, so a clean " +
                    "result says nothing about unapproved agent output — that needs " +
                    "`ainar validate <COURSE> --drafts work/<RUN>`.",
                note: "A warning usually means a real gap in the course design — an outcome nothing " +
                    "assesses, a concept nothing teaches — and resolving it is the professor's call, " +
                    "not something to silence.",
            };
        },
    },
    {
        name: "assessment_rubric",
        description: "One assessment with its rubric and items fully resolved: criteria with their level descriptions, the outcome and concepts each measures by title, and for choice items the answer key and what each distractor reveals.",
        inputSchema: schema({ assessment_id: { type: "string", description: "e.g. ASSESSMENT-04" } }, ["assessment_id"]),
        handler: (workspace, args) => {
            const assessmentId = String(args.assessment_id ?? "").trim();
            if (!assessmentId)
                throw new ToolError("assessment_id is required, e.g. 'ASSESSMENT-04'");
            return rubricPayload(workspace.findAssessment(assessmentId), assessmentId);
        },
    },
    {
        name: "pending_judgements",
        description: "What is left to grade, submission by criterion, plus who has not submitted — usually the more urgent problem.",
        inputSchema: schema({ ...VERSION_ARG, ...ASSESSMENT_ARG }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return pendingPayload(workspace.findRun(courseVersionId), courseVersionId, args.assessment_id);
        },
    },
    {
        name: "gradebook",
        description: "Criterion decisions totalled into one score per student per assessment, from approved professor decisions only — never from AI suggestions.",
        inputSchema: schema({
            ...VERSION_ARG,
            ...ASSESSMENT_ARG,
            allow_partial: {
                type: "boolean",
                description: "Treat part-graded rows as exportable. Off by default.",
            },
        }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return gradebookPayload(workspace.findRun(courseVersionId), courseVersionId, {
                assessmentId: args.assessment_id ?? null,
                allowPartial: Boolean(args.allow_partial),
            });
        },
    },
    {
        name: "assessment_blueprint",
        description: "What a new assessment should cover before anyone writes a question: marks allocated by declared outcome weight, what each outcome already carries, concepts never assessed, concepts with a low observed success rate, and whether the new weight would break the grading scheme.",
        inputSchema: schema({
            ...VERSION_ARG,
            outcomes: {
                type: "array",
                items: { type: "string" },
                description: "Restrict to these outcome ids, e.g. ['LO-01','LO-02']",
            },
            through_module: {
                type: "string",
                description: "Only material up to this module, e.g. MODULE-08 or a week number",
            },
            weight: { type: "number", description: "Proposed weight of the new assessment, 0–1" },
        }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return blueprintPayload(workspace.findRun(courseVersionId), courseVersionId, {
                outcomes: args.outcomes ?? undefined,
                through: args.through_module ?? null,
                weight: args.weight ?? null,
            });
        },
    },
    {
        name: "student",
        description: "What one run knows about one student, by pseudonym: outcomes with the evidence behind them, capability levels, and gaps with the prerequisites underneath them.",
        inputSchema: schema({ ...VERSION_ARG, student_id: { type: "string", description: "Pseudonym, e.g. STUDENT-1023" } }, ["course_version_id", "student_id"]),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            const studentId = String(args.student_id ?? "").trim();
            if (!studentId) {
                throw new ToolError("student_id is required, and must be a pseudonym like STUDENT-1023");
            }
            return studentRecord(workspace.findRun(courseVersionId), courseVersionId, studentId);
        },
    },
    {
        name: "class_progress",
        description: "The class as a grid: concepts in teaching order against students by pseudonym, with the mean proportion of marks earned on evidence tagged with each concept, plus capability levels.",
        inputSchema: schema(VERSION_ARG),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return dashboardPayload(workspace.findRun(courseVersionId), courseVersionId);
        },
    },
    {
        name: "action_inbox",
        description: "What is waiting for the professor in one run: grades awaiting approval, missing submissions, open signals, interventions to approve and upcoming deadlines, with the event behind each.",
        inputSchema: schema({ ...VERSION_ARG, ...DATE_ARG }),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            const bundle = workspace.findRun(courseVersionId);
            return inboxPayload(bundle, courseVersionId, referenceDate(bundle, courseVersionId, args.date));
        },
    },
    {
        name: "calibration",
        description: "How closely the grading agent tracks the professor, per criterion: agreement rate, the direction it errs in, and whether its stated confidence predicts anything.",
        inputSchema: schema(VERSION_ARG),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return calibrationPayload(workspace.findRun(courseVersionId), courseVersionId);
        },
    },
    {
        name: "syllabus",
        description: "The syllabus as markdown, generated from the course model: identity, outcomes, weekly plan, assessment table, materials and every rubric.",
        inputSchema: schema(VERSION_ARG),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return syllabusMarkdown(workspace.findRun(courseVersionId), courseVersionId);
        },
    },
    {
        name: "alignment_report",
        description: "The constructive alignment report as markdown, for programme review: for each outcome where it is taught, practised and assessed, and what share of the final grade it actually carries — computed from rubric criteria rather than declared intent.",
        inputSchema: schema(VERSION_ARG),
        handler: (workspace, args) => {
            const courseVersionId = requireRunId(args);
            return alignmentMarkdown(workspace.findRun(courseVersionId), courseVersionId);
        },
    },
  {
    name: "model_schema",
    description:
      "What a record of one kind must contain: every field with its type, whether it is required, the values an enum allows and the pattern an identifier must match. Call this before writing or scaffolding YAML rather than copying the shape out of another course.",
    inputSchema: schema(
      {
        entity: {
          type: "string",
          description: "Collection name, e.g. 'course', 'modules', 'assessments'. Omit to list them.",
        },
      },
      [],
    ),
    handler: (_workspace, args) => {
      const entity = String(args.entity ?? "").trim();
      if (!entity) {
        return {
          entities: SCHEMA_NAMES,
          note: "Call again with one of these as `entity`.",
        };
      }
      const fields = shapeOf(entity);
      if (fields === null) {
        throw new ToolError(`${entity} is not an entity. One of: ${SCHEMA_NAMES.join(", ")}`);
      }
      return {
        entity,
        fields,
        // Read out of the same schemas the validator uses, so this cannot
        // describe a record the validator would then refuse.
        note:
          "Derived from the validator's own schemas at call time. A field marked required " +
          "must be present; everything else may be omitted. `pattern` is a regular " +
          "expression the whole value must match.",
      };
    },
  },
  {
    name: "course_stats",
    description:
      "How much of the model is filled in for one course: a count per collection. Use it to tell an empty course from a missing one.",
    inputSchema: schema(
      { course_id: { type: "string", description: "e.g. CSS-4008 — the course, not the run" } },
      ["course_id"],
    ),
    handler: (workspace, args) => {
      const courseId = String(args.course_id ?? "").trim();
      if (!courseId) throw new ToolError("course_id is required, e.g. 'CSS-4008'");
      const { bundle } = workspace.load(courseId);
      const counts = {};
      for (const [key, value] of Object.entries(bundle)) {
        if (Array.isArray(value)) counts[key] = value.length;
      }
      return { course_id: courseId, counts };
    },
  },
];
/**
 * One tool call, as text for the model and — where there is one — structure.
 *
 * `structuredContent` is not decoration. A widget is handed it through
 * `window.openai.toolOutput` and renders it; without it a component gets nothing
 * to draw. A markdown-producing tool has no structure to give, so it returns text
 * alone, which is also why `syllabus` and `alignment_report` have no widget.
 *
 * The `_meta` repeats the template URI. The declaration on the tool definition is
 * what the specification requires; some hosts read it from the result instead,
 * and saying it twice costs one key.
 */
export const callTool = (workspace, name, args) => {
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool) {
        return {
            content: [{ type: "text", text: `no tool named '${name}'. This server is read-only.` }],
            isError: true,
        };
    }
    try {
        const payload = tool.handler(workspace, args);
        const result = { content: [{ type: "text", text: text(payload) }] };
        if (typeof payload !== "string")
            result.structuredContent = payload;
        const widget = BY_TOOL.get(name);
        if (widget)
            result._meta = { ui: { resourceUri: widget.uri } };
        return result;
    }
    catch (error) {
        if (error instanceof ToolError) {
            return { content: [{ type: "text", text: error.message }], isError: true };
        }
        throw error;
    }
};
