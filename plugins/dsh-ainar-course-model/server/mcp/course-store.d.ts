/** Storage adapters for the read engine.
 *
 * A store returns a CourseBundle-shaped LoadResult. The engine and MCP tools do
 * not care whether that bundle came from YAML, PostgreSQL or a test double.
 */
import { type LoadResult } from "../loader.ts";
export interface CourseStore {
    /** A filesystem root for resolving repository-backed documents, if any. */
    readonly root?: string;
    /** Human-readable source name for diagnostics and list_courses. */
    readonly label: string;
    courseIds(): string[];
    load(courseId: string): LoadResult;
}
/** Personal/offline mode: authored YAML with mtime-based cache invalidation. */
export declare class YamlCourseStore implements CourseStore {
    readonly root: string;
    readonly label: string;
    private loaded;
    constructor(root: string);
    courseIds(): string[];
    load(courseId: string): LoadResult;
}
/** An already-loaded store, used by database snapshots and tests. */
export declare class LoadedCourseStore implements CourseStore {
    readonly root?: string;
    readonly label: string;
    private readonly courses;
    constructor(courses: Iterable<readonly [string, LoadResult]>, options?: {
        root?: string;
        label?: string;
    });
    courseIds(): string[];
    load(courseId: string): LoadResult;
}
