/** Storage adapters for the read engine.
 *
 * A store returns a CourseBundle-shaped LoadResult. The engine and MCP tools do
 * not care whether that bundle came from YAML, PostgreSQL or a test double.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { discoverCourses, loadCourse } from "../loader.js";
import { IssueList } from "../issues.js";
/** The newest mtime under a course directory, or zero when it is unreadable. */
const newestMtime = (directory) => {
    let newest = 0;
    const walk = (path) => {
        let stat;
        try {
            stat = statSync(path);
        }
        catch {
            return;
        }
        if (stat.mtimeMs > newest)
            newest = stat.mtimeMs;
        if (!stat.isDirectory())
            return;
        for (const entry of readdirSync(path))
            walk(join(path, entry));
    };
    walk(directory);
    return newest;
};
/** Personal/offline mode: authored YAML with mtime-based cache invalidation. */
export class YamlCourseStore {
    root;
    label;
    loaded = new Map();
    constructor(root) {
        this.root = root;
        this.label = root;
    }
    courseIds() {
        return discoverCourses(this.root).map((path) => path.split(/[\\/]/).pop());
    }
    load(courseId) {
        const directory = join(this.root, "courses", courseId);
        const stamp = newestMtime(directory);
        const cached = this.loaded.get(courseId);
        if (cached && cached.stamp === stamp)
            return cached.result;
        const result = loadCourse(directory, this.root);
        this.loaded.set(courseId, { result, stamp });
        return result;
    }
}
/** An already-loaded store, used by database snapshots and tests. */
export class LoadedCourseStore {
    root;
    label;
    courses;
    constructor(courses, options = {}) {
        this.courses = new Map(courses);
        this.root = options.root;
        this.label = options.label ?? "loaded CourseBundle store";
    }
    courseIds() {
        return [...this.courses.keys()].sort();
    }
    load(courseId) {
        const found = this.courses.get(courseId);
        if (found)
            return found;
        const issues = new IssueList();
        issues.error("course.missing", `no course '${courseId}' in ${this.label}`, courseId);
        return { bundle: null, issues };
    }
}
