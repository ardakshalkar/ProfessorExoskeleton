/**
 * The loaded courses, cached and re-read when the files move. Ported from
 * `ainar/mcp/tools.py`.
 *
 * A course takes about a second to parse. A grading conversation might call six
 * tools; re-reading the course for each would be a second of latency per call
 * for no benefit, since nothing here writes.
 *
 * But *something else* writes: the professor. `ainar roster import` adds two
 * students, `ainar approve` promotes a draft, and a cache with no invalidation
 * keeps serving the state from before either — for the life of the process,
 * which under Claude Desktop is until the app restarts. "I imported them and it
 * still says 27" is a confusing failure with nothing on screen to explain it, so
 * the cache is stamped with the newest mtime under the course directory and
 * dropped when that moves. One directory walk per call, over tens of small YAML
 * files, against a second of parsing: worth it.
 */
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { assessmentsOf, runById } from "../bundle.js";
import { YamlCourseStore } from "./course-store.js";
/**
 * The newest mtime anywhere under `directory`, in milliseconds, or 0 if it is
 * unreadable.
 *
 * Directory mtimes count too: on every platform they move when a file is added
 * or removed, which is what a roster import and an approval both do. A file
 * edited in place moves its own mtime instead, so both cases are covered.
 */
/** Something the model can fix by calling again with different arguments. */
export class ToolError extends Error {
}
/**
 * The nearest directory at or above `from` that holds a `courses/` directory,
 * or null.
 *
 * This is what a workspace *is*, so the walk belongs here rather than in
 * whichever host happens to need it. `ainar/commands/common.py` argues the
 * rule: standing inside a course repository means that repository, the way
 * `git` works from a subdirectory — a session opened on
 * `.../AI Course 2026 v1/homework` is still a session about that course.
 *
 * Every caller that has somewhere to stand resolves through this one function:
 * the CLI walks up from the working directory, the DeepSeek Harness bundle
 * walks up from the session's `cwd`, and the professor's pane walks up from the
 * directory the sidebar registered. A second copy of twelve lines would be a
 * quiet way for two halves of one screen to name different courses.
 *
 * The walk stops at the filesystem root rather than after a fixed depth, and
 * `dirname` reaching a fixed point is what root looks like on both platforms.
 */
export const workspaceRootFor = (from) => {
    if (!from)
        return null;
    let here = resolve(from);
    for (;;) {
        try {
            if (statSync(join(here, "courses")).isDirectory())
                return here;
        }
        catch {
            // Unreadable or absent: not a workspace, keep walking. A permission error
            // one directory up is not a reason to stop looking.
        }
        const up = dirname(here);
        if (up === here)
            return null;
        here = up;
    }
};
/**
 * How a workspace's root was arrived at.
 *
 * Nothing about reading a course depends on this. It exists so that a message
 * telling the professor to fix their workspace can name the thing they would
 * actually have to change, which differs by host: the standalone MCP server
 * resolves from `AINAR_WORKSPACE`, the CLI from `--root` or the directory it
 * was run in, and the harness plugins from the folder the session was opened
 * on. One sentence naming the variable served the first of those three and
 * misdirected the other two.
 *
 * `unknown` is the honest answer for a `Workspace` built straight from a store
 * — a test's in-memory one, or Postgres — and its advice names no mechanism.
 */
export class Workspace {
    // Written out rather than a constructor parameter property: those need code
    // generation, and `--experimental-strip-types` only erases.
    root;
    store;
    origin;
    constructor(source, origin = "unknown") {
        this.store = typeof source === "string" ? new YamlCourseStore(source) : source;
        this.root = this.store.root;
        this.origin = origin;
    }
    courseIds() {
        return this.store.courseIds();
    }
    load(courseId) {
        const result = this.store.load(courseId);
        if (!result.bundle) {
            throw new ToolError(`${courseId} could not be loaded: ` +
                result.issues.errors
                    .slice(0, 3)
                    .map((issue) => `${issue.code}: ${issue.message}`)
                    .join("; "));
        }
        return result;
    }
    /** The bundle owning a run. Runs are unique across courses by convention. */
    findRun(courseVersionId) {
        for (const courseId of this.courseIds()) {
            try {
                const { bundle } = this.load(courseId);
                if (runById(bundle).has(courseVersionId))
                    return bundle;
            }
            catch {
                continue;
            }
        }
        throw new ToolError(`no course run '${courseVersionId}' in this workspace`);
    }
    findAssessment(assessmentId) {
        for (const courseId of this.courseIds()) {
            let bundle;
            try {
                bundle = this.load(courseId).bundle;
            }
            catch {
                continue;
            }
            for (const run of bundle.versions) {
                if (assessmentsOf(bundle, run.course_version_id).some((a) => a.assessment_id === assessmentId)) {
                    return bundle;
                }
            }
        }
        throw new ToolError(`no assessment '${assessmentId}' in this workspace`);
    }
}
export const requireRunId = (args) => {
    const value = String(args.course_version_id ?? "").trim();
    if (!value)
        throw new ToolError("course_version_id is required, e.g. 'CSS-4008-2026-FALL'");
    return value;
};
/**
 * The date to reason about: the one asked for, else today clamped to the run.
 */
export const referenceDate = (bundle, courseVersionId, given) => {
    if (given) {
        const text = String(given);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            throw new ToolError(`date must be YYYY-MM-DD, got '${text}'`);
        }
        return text;
    }
    const run = runById(bundle).get(courseVersionId);
    const today = new Date().toISOString().slice(0, 10);
    return today < run.start_date ? run.start_date : today > run.end_date ? run.end_date : today;
};
