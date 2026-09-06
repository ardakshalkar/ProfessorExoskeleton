/**
 * `ainar new course` and `ainar new run`. Ported from `ainar/commands/scaffold.py`.
 *
 * Templates rather than empty files, because the first thing anyone does with a
 * new course is copy the shape of an existing one — and on 2026-09-06 an agent
 * did exactly that, searching the whole of `Documents` for another workspace
 * and reading seven files out of an unrelated course to learn what
 * `course.yaml` looks like. There was no command to run instead. Now there is.
 *
 * **Every template is written to validate as-is.** A scaffolded course passes
 * `validate` before a word of real content is in it, so the first error a
 * person sees is their own. `test/scaffold.test.ts` holds that promise, because
 * it is the kind that rots silently: the templates are strings, so nothing else
 * notices when the model moves underneath them.
 *
 * Nothing here overwrites. `writeIfAbsent` is the whole safety model, and it is
 * enough: a scaffold that clobbered a course would be the worst command in the
 * CLI, and one that skips is merely unhelpful.
 *
 * **The layout is the post-merge one:** outcomes, concepts and modules belong to
 * the *course* and carry `course_id`; `versions/<TERM>/version.yaml` is one
 * offering. There is no `runs/` directory and no version number — a
 * `CourseVersion` *is* the term.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const COURSE_TEMPLATE = `course_id: {course_id}
title: {title}
description: TODO
credits: {credits}
department: {department}
language: [en]
status: draft
`;

/**
 * Outcomes belong to the course, not to a term — student evidence from an
 * earlier semester points at `LO-01`, so it cannot be scoped to one offering.
 */
const OUTCOMES_TEMPLATE = `# Learning outcomes: what a student must be able to demonstrate.
#
# Weights should sum to 1.0. Keep identifiers stable even when the wording
# changes — student evidence from earlier terms points at these strings.
outcomes:
  - outcome_id: LO-01
    course_id: {course_id}
    title: TODO
    description: TODO
    level: understand
    weight: 1.0
    concepts: []
    capabilities: []
`;

const CONCEPTS_TEMPLATE = `# Knowledge structure. Prerequisites make gap explanations possible: "difficulty
# with overfitting" is only useful next to "train-test separation is not yet
# demonstrated".
concepts:
  - concept_id: CONCEPT-TODO
    course_id: {course_id}
    title: TODO
    description: TODO
    prerequisites: []
`;

const MODULES_TEMPLATE = `# One module per teaching week. Every module names the outcomes it serves and
# the concepts it introduces — that link is what the lesson agent reads.
modules:
  - module_id: MODULE-01
    course_id: {course_id}
    title: TODO
    week: 1
    outcomes: []
    concepts: []
    estimated_hours: 6
`;

/**
 * One offering. This was two records until the merge — a `CourseVersion` holding
 * the approved definition and a `CourseRun` holding the semester — and what is
 * left is the term.
 */
const VERSION_TEMPLATE = `# One offering of {course_id}.
course_version_id: {course_version_id}
course_id: {course_id}
term: {term}
start_date: {start}
end_date: {end}
instructors: []
timezone: Asia/Almaty
status: planned
`;

const ASSESSMENTS_TEMPLATE = `# Assessments for this offering. Weights should sum to 1.0.
#
# Every criterion should name the outcome it measures, otherwise grading
# produces marks but no learning evidence.
assessments:
  - assessment_id: ASSESSMENT-01
    course_version_id: {course_version_id}
    title: TODO
    type: assignment
    maximum_score: 100
    weight: 1.0
    outcomes: []
    submission_type: [pdf]
    rubric:
      rubric_id: RUBRIC-01
      title: TODO
      criteria:
        - criterion_id: CRIT-01-01
          rubric_id: RUBRIC-01
          title: TODO
          maximum_score: 100
          outcome_id: LO-01
          levels:
            - score: 100
              description: TODO
`;

const ACTIVITIES_TEMPLATE = `# Lectures, labs, seminars and other scheduled teaching.
activities: []
`;

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );

export interface Written {
  path: string;
  created: boolean;
}

const writeIfAbsent = (path: string, content: string, out: Written[]): void => {
  if (existsSync(path)) {
    out.push({ path, created: false });
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: "utf-8" });
  out.push({ path, created: true });
};

export interface NewCourseOptions {
  root: string;
  courseId: string;
  title?: string;
  credits?: number;
  department?: string;
}

export const newCourse = (options: NewCourseOptions): Written[] => {
  const written: Written[] = [];
  const courseDir = join(options.root, "courses", options.courseId);
  const values = {
    course_id: options.courseId,
    title: options.title ?? "TODO",
    credits: options.credits ?? 6,
    department: options.department ?? "TODO",
  };
  writeIfAbsent(join(courseDir, "course.yaml"), fill(COURSE_TEMPLATE, values), written);
  writeIfAbsent(join(courseDir, "outcomes.yaml"), fill(OUTCOMES_TEMPLATE, values), written);
  writeIfAbsent(join(courseDir, "concepts.yaml"), fill(CONCEPTS_TEMPLATE, values), written);
  writeIfAbsent(join(courseDir, "modules.yaml"), fill(MODULES_TEMPLATE, values), written);
  writeIfAbsent(join(courseDir, "people", "users.yaml"), "users: []\n", written);
  return written;
};

export interface NewRunOptions {
  root: string;
  courseId: string;
  term: string;
  start: string;
  end: string;
}

export const newRun = (options: NewRunOptions): Written[] => {
  const written: Written[] = [];
  const courseVersionId = `${options.courseId}-${options.term}`;
  const runDir = join(options.root, "courses", options.courseId, "versions", options.term);
  const values = {
    course_id: options.courseId,
    course_version_id: courseVersionId,
    term: options.term,
    start: options.start,
    end: options.end,
  };
  writeIfAbsent(join(runDir, "version.yaml"), fill(VERSION_TEMPLATE, values), written);
  writeIfAbsent(join(runDir, "assessments.yaml"), fill(ASSESSMENTS_TEMPLATE, values), written);
  writeIfAbsent(join(runDir, "activities.yaml"), ACTIVITIES_TEMPLATE, written);
  writeIfAbsent(join(runDir, "resources.yaml"), "resources: []\n", written);
  writeIfAbsent(join(runDir, "enrollments.yaml"), "enrollments: []\n", written);
  return written;
};
