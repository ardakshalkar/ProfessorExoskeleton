/**
 * The run as a term plan. Ported from `ainar/outline.py`.
 *
 * Read that module's docstring for why placement works the way it does — a
 * meeting sits in its module's week and an assessment in the week its deadline
 * falls in. What is worth saying twice is the arithmetic, because it is the only
 * part that can differ between the two languages:
 *
 * - **Days are counted in UTC.** `daysBetween` parses both ends at midnight Z,
 *   so a run that starts in Almaty is not one week off because the machine
 *   running this is west of it.
 * - **A local date is the first ten characters of the timestamp**, not what
 *   `new Date(...)` says. Python's `datetime.date()` on an aware datetime gives
 *   the date in that datetime's own offset; slicing gives the same answer and
 *   `report.ts` already relies on it for due dates.
 */

import {
  activitiesOf,
  allRubrics,
  assessmentsOf,
  conceptById,
  modulesOf,
  outcomesOf,
  resourceById,
  runById,
  userById,
  type CourseBundle,
} from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";

/** How placement works, carried in the payload so a surface can print it. */
export const PLACEMENT =
  "Weeks are counted in sevens from the run's start date. A meeting sits in " +
  "its module's week and shows its own date beside it; an assessment sits in " +
  "the week it opens and in the week it is due, or — with no dates at all — in " +
  "its module's week, marked as having no deadline. Whether a meeting's date " +
  "disagrees with its module is `ainar validate`'s call (schedule.week_mismatch), " +
  "not this document's.";

const DAY = 86_400_000;

const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Which week of the run a date falls in, counted from its start. */
const weekNumber = (start: string, day: string): number =>
  Math.floor(daysBetween(start, day) / 7) + 1;

const addDays = (from: string, days: number): string =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The local date of an aware timestamp: its own offset, not the machine's. */
const dateOf = (stamp: string | null | undefined): string | null =>
  stamp ? stamp.slice(0, 10) : null;

/** Source-outline week labels, kept separate from approved modules. */
const sourceOutlineByWeek = (
  b: CourseBundle,
  run: any,
  course: any,
  totalWeeks: number,
): Map<number, Record<string, unknown>[]> => {
  const found = new Map<number, Record<string, unknown>[]>();
  for (const document of b.documents as any[]) {
    if (
      document.course_version_id !== run.course_version_id &&
      document.course_id !== course.course_id
    ) continue;
    const extension = document.extensions?.course_outline;
    if (!extension || typeof extension !== "object" || !Array.isArray(extension.weeks)) continue;
    for (const entry of extension.weeks) {
      if (!entry || typeof entry !== "object") continue;
      const week = entry.week;
      const title = entry.title ?? entry.topic;
      if (
        !Number.isInteger(week) || week < 1 || week > totalWeeks ||
        typeof title !== "string" || !title.trim()
      ) continue;
      const description =
        typeof entry.description === "string" && entry.description.trim()
          ? entry.description.trim()
          : null;
      const item = {
        document_id: document.document_id,
        source_title: document.title,
        title: title.trim(),
        description,
      };
      found.set(week, [...(found.get(week) ?? []), item]);
    }
  }
  return found;
};

/** Identifiers with their titles, keeping an unknown one visible as itself. */
const titled = (ids: string[], index: Map<string, any>): Record<string, unknown>[] =>
  ids.map((id) => ({ id, title: index.get(id)?.title ?? null }));

const resourceEntry = (resource: any): Record<string, unknown> => ({
  resource_id: resource.resource_id,
  title: resource.title,
  kind: resource.kind,
  url: resource.url ?? null,
  document_id: resource.document_id ?? null,
  required: resource.required,
});

const meeting = (
  activity: any,
  resources: Map<string, any>,
  concepts: Map<string, any>,
): Record<string, unknown> => ({
  activity_id: activity.activity_id,
  module_id: activity.module_id ?? null,
  type: activity.type,
  title: activity.title,
  scheduled_at: activity.scheduled_at ?? null,
  on: dateOf(activity.scheduled_at),
  duration_minutes: activity.duration_minutes ?? null,
  location: activity.location ?? null,
  preparation: activity.preparation ?? null,
  outcomes: activity.outcomes,
  concepts: titled(activity.concepts, concepts),
  resources: (activity.resources as string[])
    .filter((id) => resources.has(id))
    .map((id) => resourceEntry(resources.get(id))),
});

const assessmentEntry = (assessment: any, rubrics: Map<string, any>): Record<string, unknown> => {
  const rubric = assessment.rubric_id ? rubrics.get(assessment.rubric_id) : assessment.rubric;
  return {
    assessment_id: assessment.assessment_id,
    title: assessment.title,
    type: assessment.type,
    module_id: assessment.module_id ?? null,
    weight: assessment.weight ?? null,
    maximum_score: assessment.maximum_score,
    opens_at: assessment.opens_at ?? null,
    due_at: assessment.due_at ?? null,
    opens_on: dateOf(assessment.opens_at),
    due_on: dateOf(assessment.due_at),
    outcomes: assessment.outcomes,
    submission_type: assessment.submission_type,
    rubric_id: assessment.rubric_id ?? null,
    // Whether a rubric exists, not what it says.
    criteria: rubric ? (rubric.criteria ?? []).length : 0,
  };
};

/** Declared weights, and what is wrong with them if anything is. */
const grading = (assessments: any[]): Record<string, unknown> => {
  const declared = assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
  const unweighted = assessments
    .filter((a) => a.weight === null || a.weight === undefined)
    .map((a) => a.assessment_id as string);
  let note: string | null = null;
  if (unweighted.length) {
    note =
      `The grading policy is incomplete. ${unweighted.join(", ")} ` +
      `${unweighted.length === 1 ? "carries" : "carry"} no weight, so the ` +
      "total is not the grading policy. The weight is the professor's to set.";
  } else if (assessments.length && Math.abs(declared - 1.0) > 0.001) {
    note =
      `The weights total ${roundHalfEven(declared * 100, 0)}%, not 100%. Report this rather ` +
      "than adjusting an assessment to absorb the difference.";
  }
  return {
    total_weight: declared,
    unweighted,
    complete: !unweighted.length && assessments.length > 0 && Math.abs(declared - 1.0) <= 0.001,
    note,
  };
};

export const outlinePayload = (
  b: CourseBundle,
  courseVersionId: string,
  on: string,
): Record<string, unknown> => {
  const run = runById(b).get(courseVersionId) as any;
  const course = b.course as any;
  const users = userById(b);
  const concepts = conceptById(b);
  const resources = resourceById(b);
  const rubrics = allRubrics(b);
  const outcomes = new Map(
    outcomesOf(b, course.course_id).map((outcome) => [outcome.outcome_id as string, outcome]),
  );

  const modules = modulesOf(b, course.course_id);
  const activities = activitiesOf(b, courseVersionId);
  const assessments = assessmentsOf(b, courseVersionId);

  const totalWeeks = weekNumber(run.start_date, run.end_date);
  const sourceOutline = sourceOutlineByWeek(b, run, course, totalWeeks);
  const placed = (week: number | null | undefined): boolean =>
    week !== null && week !== undefined && week >= 1 && week <= totalWeeks;

  const moduleByWeek = new Map<number, any[]>();
  const unplacedModules: any[] = [];
  for (const module of modules) {
    if (placed(module.week)) {
      moduleByWeek.set(module.week, [...(moduleByWeek.get(module.week) ?? []), module]);
    } else {
      unplacedModules.push(module);
    }
  }

  const weekOfModule = new Map<string, number>(
    modules.filter((m) => placed(m.week)).map((m) => [m.module_id as string, m.week as number]),
  );

  const meetingsByWeek = new Map<number, any[]>();
  const unplacedMeetings: any[] = [];
  for (const activity of activities) {
    let week = activity.module_id ? weekOfModule.get(activity.module_id) ?? null : null;
    if (week === null && activity.scheduled_at) {
      // No module, or a module with no week of its own: fall back to the date,
      // which is the only other thing that says when this happens.
      const candidate = weekNumber(run.start_date, dateOf(activity.scheduled_at)!);
      week = placed(candidate) ? candidate : null;
    }
    if (week === null) unplacedMeetings.push(activity);
    else meetingsByWeek.set(week, [...(meetingsByWeek.get(week) ?? []), activity]);
  }

  const dueByWeek = new Map<number, any[]>();
  const opensByWeek = new Map<number, any[]>();
  // An assessment with no dates at all, sitting on the week its module teaches.
  //
  // This is a deliberate divergence from `ainar/outline.py`, which places an
  // assessment by its timestamps and by nothing else. The consequence there is
  // that a homework whose deadline nobody has set yet drops off the term plan
  // entirely and reappears in "on no week of this run" at the foot of the page
  // — the one place a professor planning a week will not look. A meeting has
  // never worked that way: it takes its module's week first and falls back to
  // its own date, twenty lines above.
  //
  // What this does NOT do is invent a deadline. The week is where the work is
  // taught, which is a different claim from when it is due, so these land in
  // their own bucket and every surface drawing them has to say the date is
  // missing rather than printing one.
  const undatedByWeek = new Map<number, any[]>();
  const unplacedAssessments: any[] = [];
  for (const assessment of assessments) {
    let anywhere = false;
    for (const [stamp, table] of [
      [assessment.due_at, dueByWeek],
      [assessment.opens_at, opensByWeek],
    ] as [string | null, Map<number, any[]>][]) {
      if (!stamp) continue;
      const week = weekNumber(run.start_date, dateOf(stamp)!);
      if (placed(week)) {
        table.set(week, [...(table.get(week) ?? []), assessment]);
        anywhere = true;
      }
    }
    if (!anywhere && assessment.module_id) {
      const week = weekOfModule.get(assessment.module_id) ?? null;
      if (week !== null) {
        undatedByWeek.set(week, [...(undatedByWeek.get(week) ?? []), assessment]);
        anywhere = true;
      }
    }
    if (!anywhere) unplacedAssessments.push(assessment);
  }

  const current = weekNumber(run.start_date, on);
  const weeks: Record<string, unknown>[] = [];
  for (let number = 1; number <= totalWeeks; number += 1) {
    const starts = addDays(run.start_date, 7 * (number - 1));
    // The last week is short whenever the run does not end on a seventh day.
    const seventh = addDays(starts, 6);
    const ends = seventh > run.end_date ? run.end_date : seventh;
    const here = moduleByWeek.get(number) ?? [];
    const week: Record<string, unknown> = {
      week: number,
      starts_on: starts,
      ends_on: ends,
      when: number === current ? "current" : number < current ? "past" : "upcoming",
      // A list, because two modules naming one week is a real state of the files
      // and hiding one of them would be the wrong answer.
      modules: here.map((module) => ({
        module_id: module.module_id,
        title: module.title,
        description: module.description ?? null,
        estimated_hours: module.estimated_hours ?? null,
        outcomes: titled(module.outcomes, outcomes),
        concepts: titled(module.concepts, concepts),
      })),
      meetings: (meetingsByWeek.get(number) ?? []).map((activity) =>
        meeting(activity, resources, concepts),
      ),
      opens: (opensByWeek.get(number) ?? []).map((a) => assessmentEntry(a, rubrics)),
      due: (dueByWeek.get(number) ?? []).map((a) => assessmentEntry(a, rubrics)),
      undated: (undatedByWeek.get(number) ?? []).map((a) => assessmentEntry(a, rubrics)),
      // Not "empty": nobody has planned it.
      planned: here.length > 0,
    };
    if ((sourceOutline.get(number) ?? []).length) {
      week.source_outline = sourceOutline.get(number);
    }
    weeks.push(week);
  }

  return {
    run: {
      id: run.course_version_id,
      course_id: course.course_id,
      title: course.title,
      description: course.description ?? null,
      term: run.term,
      status: run.status,
      start_date: run.start_date,
      end_date: run.end_date,
      timezone: run.timezone,
      credits: course.credits ?? null,
      department: course.department ?? null,
      language: course.language,
      instructors: (run.instructors as string[]).map(
        (userId) => users.get(userId)?.display_name ?? userId,
      ),
    },
    as_of: on,
    current_week: current >= 1 && current <= totalWeeks ? current : null,
    outcomes: outcomesOf(b, course.course_id).map((outcome) => ({
      outcome_id: outcome.outcome_id,
      title: outcome.title,
      level: outcome.level,
      weight: outcome.weight ?? null,
    })),
    weeks,
    assessments: assessments.map((assessment) => assessmentEntry(assessment, rubrics)),
    grading: grading(assessments),
    required_materials: (b.resources as any[])
      .filter((resource) => resource.required)
      .map(resourceEntry),
    unplaced: {
      modules: unplacedModules.map((module) => ({
        module_id: module.module_id,
        title: module.title,
        week: module.week ?? null,
      })),
      meetings: unplacedMeetings.map((activity) => meeting(activity, resources, concepts)),
      assessments: unplacedAssessments.map((a) => assessmentEntry(a, rubrics)),
    },
    totals: {
      weeks: totalWeeks,
      weeks_planned: weeks.filter((week) => week.planned).length,
      modules: modules.length,
      meetings: activities.length,
      assessments: assessments.length,
    },
    placement: PLACEMENT,
  };
};
