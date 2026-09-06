import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { LoadResult } from "../src/loader.ts";
import type { CourseStore } from "../src/mcp/course-store.ts";
import { Workspace } from "../src/mcp/workspace.ts";

const COURSE = "CSS-9900";
const RUN = `${COURSE}-2026-FALL`;

const result = {
  bundle: {
    course: { course_id: COURSE, title: "Database-shaped course" },
    versions: [
      {
        course_version_id: RUN,
        course_id: COURSE,
        term: "2026-FALL",
        start_date: "2026-09-01",
        end_date: "2026-12-20",
      },
    ],
    assessments: [],
  },
  issues: { errors: [], warnings: [] },
} as unknown as LoadResult;

class MemoryCourseStore implements CourseStore {
  readonly root = "memory://ainar";
  courseIds(): string[] {
    return [COURSE];
  }
  load(courseId: string): LoadResult {
    assert.equal(courseId, COURSE);
    return result;
  }
}

test("the MCP workspace can load a CourseBundle without touching YAML", () => {
  const workspace = new Workspace(new MemoryCourseStore());
  assert.deepEqual(workspace.courseIds(), [COURSE]);
  assert.equal(workspace.findRun(RUN).course.course_id, COURSE);
});
