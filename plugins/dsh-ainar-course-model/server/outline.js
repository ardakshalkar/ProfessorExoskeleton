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
import { activitiesFor, allRubrics, assessmentsOf, conceptById, modulesOf, outcomesOf, resourceById, runById, userById, } from "./bundle.js";
import { roundHalfEven } from "./grading.js";
/** How placement works, carried in the payload so a surface can print it. */
export const PLACEMENT = "Weeks are counted in sevens from the run's start date. A meeting sits in " +
    "its module's week and shows its own date beside it; an assessment sits in " +
    "the week it opens and in the week it is due, or — with no dates at all — in " +
    "its module's week, marked as having no deadline. Whether a meeting's date " +
    "disagrees with its module is `ainar validate`'s call (schedule.week_mismatch), " +
    "not this document's.";
const DAY = 86_400_000;
const daysBetween = (from, to) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
/** Which week of the run a date falls in, counted from its start. */
const weekNumber = (start, day) => Math.floor(daysBetween(start, day) / 7) + 1;
const addDays = (from, days) => new Date(Date.parse(`${from}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** The local date of an aware timestamp: its own offset, not the machine's. */
const dateOf = (stamp) => stamp ? stamp.slice(0, 10) : null;
/** Source-outline week labels, kept separate from approved modules. */
const sourceOutlineByWeek = (b, run, course, totalWeeks) => {
    const found = new Map();
    for (const document of b.documents) {
        if (document.course_version_id !== run.course_version_id &&
            document.course_id !== course.course_id)
            continue;
        const extension = document.extensions?.course_outline;
        if (!extension || typeof extension !== "object" || !Array.isArray(extension.weeks))
            continue;
        for (const entry of extension.weeks) {
            if (!entry || typeof entry !== "object")
                continue;
            const week = entry.week;
            const title = entry.title ?? entry.topic;
            if (!Number.isInteger(week) || week < 1 || week > totalWeeks ||
                typeof title !== "string" || !title.trim())
                continue;
            const description = typeof entry.description === "string" && entry.description.trim()
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
const titled = (ids, index) => ids.map((id) => ({ id, title: index.get(id)?.title ?? null }));
const resourceEntry = (resource) => ({
    resource_id: resource.resource_id,
    title: resource.title,
    kind: resource.kind,
    url: resource.url ?? null,
    document_id: resource.document_id ?? null,
    required: resource.required,
});
const meeting = (activity, resources, concepts) => ({
    activity_id: activity.activity_id,
    module_id: activity.module_id ?? null,
    type: activity.type,
    title: activity.title,
    scheduled_at: activity.scheduled_at ?? null,
    on: dateOf(activity.scheduled_at),
    duration_minutes: activity.duration_minutes ?? null,
    location: activity.location ?? null,
    // Null is "the whole run meets".
    group: activity.group ?? null,
    preparation: activity.preparation ?? null,
    outcomes: activity.outcomes,
    concepts: titled(activity.concepts, concepts),
    resources: activity.resources
        .filter((id) => resources.has(id))
        .map((id) => resourceEntry(resources.get(id))),
});
const assessmentEntry = (assessment, rubrics) => {
    const rubric = assessment.rubric_id ? rubrics.get(assessment.rubric_id) : assessment.rubric;
    return {
        assessment_id: assessment.assessment_id,
        title: assessment.title,
        // What the work actually asks for, in the professor's own words.
        //
        // The outline used to carry every fact ABOUT a piece of graded work —
        // its weight, its dates, whether a rubric exists — and not one word of
        // the work itself, on the reasonable ground that a term plan is a shape
        // rather than a reader. But an assessment in this model usually has no
        // `instructions_document_id`: the brief lives in the record's own
        // `description`, and a view with nothing to open therefore had nothing
        // to show at all. Naming the file would not have helped, because for
        // most courses there is no file.
        //
        // It is plain text and stays plain text. Every interpolation in the
        // template language is escaped and there is no raw construct, so this
        // reaches a document as words rather than as markup — which matters,
        // since the same payload serves the public course page.
        description: assessment.description ?? null,
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
        // The brief students read, named rather than described. A view that has
        // a route to the file can then offer it; one that has not — the same
        // payload served to a chat client — simply has an id it cannot open,
        // which is the same position it is in for every other document the
        // model names.
        instructions_document_id: assessment.instructions_document_id ?? null,
    };
};
/** Declared weights, and what is wrong with them if anything is. */
const grading = (assessments) => {
    const declared = assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
    const unweighted = assessments
        .filter((a) => a.weight === null || a.weight === undefined)
        .map((a) => a.assessment_id);
    let note = null;
    if (unweighted.length) {
        note =
            `The grading policy is incomplete. ${unweighted.join(", ")} ` +
                `${unweighted.length === 1 ? "carries" : "carry"} no weight, so the ` +
                "total is not the grading policy. The weight is the professor's to set.";
    }
    else if (assessments.length && Math.abs(declared - 1.0) > 0.001) {
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
export const outlinePayload = (b, courseVersionId, on, options = {}) => {
    const groups = (options.groups ?? []).map((group) => group.trim()).filter(Boolean);
    const run = runById(b).get(courseVersionId);
    const course = b.course;
    const users = userById(b);
    const concepts = conceptById(b);
    const resources = resourceById(b);
    const rubrics = allRubrics(b);
    const outcomes = new Map(outcomesOf(b, course.course_id).map((outcome) => [outcome.outcome_id, outcome]));
    const modules = modulesOf(b, course.course_id);
    const activities = activitiesFor(b, courseVersionId, groups);
    const assessments = assessmentsOf(b, courseVersionId);
    const totalWeeks = weekNumber(run.start_date, run.end_date);
    const sourceOutline = sourceOutlineByWeek(b, run, course, totalWeeks);
    const placed = (week) => week !== null && week !== undefined && week >= 1 && week <= totalWeeks;
    const moduleByWeek = new Map();
    const unplacedModules = [];
    for (const module of modules) {
        if (placed(module.week)) {
            moduleByWeek.set(module.week, [...(moduleByWeek.get(module.week) ?? []), module]);
        }
        else {
            unplacedModules.push(module);
        }
    }
    const weekOfModule = new Map(modules.filter((m) => placed(m.week)).map((m) => [m.module_id, m.week]));
    const meetingsByWeek = new Map();
    const unplacedMeetings = [];
    for (const activity of activities) {
        let week = activity.module_id ? weekOfModule.get(activity.module_id) ?? null : null;
        if (week === null && activity.scheduled_at) {
            // No module, or a module with no week of its own: fall back to the date,
            // which is the only other thing that says when this happens.
            const candidate = weekNumber(run.start_date, dateOf(activity.scheduled_at));
            week = placed(candidate) ? candidate : null;
        }
        if (week === null)
            unplacedMeetings.push(activity);
        else
            meetingsByWeek.set(week, [...(meetingsByWeek.get(week) ?? []), activity]);
    }
    const dueByWeek = new Map();
    const opensByWeek = new Map();
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
    const undatedByWeek = new Map();
    const unplacedAssessments = [];
    for (const assessment of assessments) {
        let anywhere = false;
        for (const [stamp, table] of [
            [assessment.due_at, dueByWeek],
            [assessment.opens_at, opensByWeek],
        ]) {
            if (!stamp)
                continue;
            const week = weekNumber(run.start_date, dateOf(stamp));
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
        if (!anywhere)
            unplacedAssessments.push(assessment);
    }
    const current = weekNumber(run.start_date, on);
    const weeks = [];
    for (let number = 1; number <= totalWeeks; number += 1) {
        const starts = addDays(run.start_date, 7 * (number - 1));
        // The last week is short whenever the run does not end on a seventh day.
        const seventh = addDays(starts, 6);
        const ends = seventh > run.end_date ? run.end_date : seventh;
        const here = moduleByWeek.get(number) ?? [];
        const week = {
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
            meetings: (meetingsByWeek.get(number) ?? []).map((activity) => meeting(activity, resources, concepts)),
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
            instructors: run.instructors.map((userId) => users.get(userId)?.display_name ?? userId),
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
        required_materials: b.resources
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
        // Present only when it is a real filter; absence is the whole run,
        // and is what keeps an unnarrowed payload identical to the Python one.
        ...(groups.length ? { groups } : {}),
        placement: PLACEMENT,
    };
};
