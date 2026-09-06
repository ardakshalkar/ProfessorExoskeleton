/**
 * Reading a course directory into a bundle. Ported from `ainar/loader.py`.
 *
 * The glob patterns are the contract with the layout and are copied across
 * verbatim — a course that loads in Python must load identically here, and a
 * pattern quietly dropped would mean a collection that is silently empty.
 */
import { type CourseBundle } from "./bundle.ts";
import { IssueList } from "./issues.ts";
/**
 * Resolve `<<: *anchor` the way `yaml.safe_load_all` does.
 *
 * Merge keys are YAML 1.1. PyYAML expands them with no option asked for, and
 * `yaml`'s default 1.2 core schema leaves `<<` as a literal key — so a file
 * every authoring tool writes and Python reads came back here with a mapping
 * under `"<<"` and the merged fields missing. A real `documents-draft.yaml`
 * hangs its figure provenance off one anchor; the port rejected three records
 * as `generated_by.produced_by: Required` while Python approved the same file.
 *
 * It must be passed at PARSE time. `toJS({ merge: true })` is accepted and does
 * nothing, which is the version of this bug that looks fixed.
 */
export declare const MERGE_KEYS: {
    readonly merge: true;
};
export interface LoadResult {
    bundle: CourseBundle | null;
    issues: IssueList;
}
/** Course directories under `courses/`, in identifier order. */
export declare const discoverCourses: (root: string) => string[];
export declare const loadCourse: (courseDir: string, root: string) => LoadResult;
