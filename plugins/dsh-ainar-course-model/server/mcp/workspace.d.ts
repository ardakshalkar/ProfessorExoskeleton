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
import type { LoadResult } from "../loader.ts";
import type { CourseBundle } from "../bundle.ts";
import { type CourseStore } from "./course-store.ts";
/**
 * The newest mtime anywhere under `directory`, in milliseconds, or 0 if it is
 * unreadable.
 *
 * Directory mtimes count too: on every platform they move when a file is added
 * or removed, which is what a roster import and an approval both do. A file
 * edited in place moves its own mtime instead, so both cases are covered.
 */
/** Something the model can fix by calling again with different arguments. */
export declare class ToolError extends Error {
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
export declare const workspaceRootFor: (from: string | undefined | null) => string | null;
/** How a workspace's root was arrived at, so advice can name what to change. */
export type WorkspaceOrigin = "session" | "env" | "flag" | "cwd" | "unknown";
export declare class Workspace {
    readonly root?: string;
    readonly store: CourseStore;
    readonly origin: WorkspaceOrigin;
    constructor(source: string | CourseStore, origin?: WorkspaceOrigin);
    courseIds(): string[];
    load(courseId: string): LoadResult;
    /** The bundle owning a run. Runs are unique across courses by convention. */
    findRun(courseVersionId: string): CourseBundle;
    findAssessment(assessmentId: string): CourseBundle;
}
export declare const requireRunId: (args: Record<string, unknown>) => string;
/**
 * The date to reason about: the one asked for, else today clamped to the run.
 */
export declare const referenceDate: (bundle: CourseBundle, courseVersionId: string, given: unknown) => string;
