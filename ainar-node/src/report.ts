/**
 * Documents generated from the canonical model. Ported from `ainar/report.py`.
 *
 * These are the only text outputs, so they are compared as strings rather than
 * structurally — every space, dash and pipe is part of the fixture. Two Python
 * formatting habits carry the risk:
 *
 * - `f"{value:g}"` — shortest form, no trailing zeros: `25`, not `25.0`.
 * - `f"{value * 100:.0f}%"` — fixed to zero decimals, and Python's format spec
 *   rounds half to **even**, so `0.125 * 100` prints `12%`.
 */

import {
  allRubrics,
  activitiesOf,
  assessmentsOf,
  conceptById,
  modulesOf,
  outcomesOf,
  runById,
  userById,
  versionById,
  type CourseBundle,
} from "./bundle.ts";
import { outcomeGradeShare } from "./blueprint.ts";
import { roundHalfEven } from "./grading.ts";

const CHECK = "x";

const table = (headers: string[], rows: string[][]): string => {
  if (!rows.length) return "_None._\n";
  const line = "| " + headers.join(" | ") + " |";
  const rule = "| " + headers.map(() => "---").join(" | ") + " |";
  const body = rows.map((row) => "| " + row.map((cell) => cell || "—").join(" | ") + " |");
  return [line, rule, ...body].join("\n") + "\n";
};

/** Python's `f"{value:g}"`. */
const g = (value: number): string => String(Number(value.toPrecision(6)));

/** Python's `f"{value * 100:.0f}%"` — zero decimals, half to even. */
const percentOf = (value: number): string => `${roundHalfEven(value * 100, 0)}%`;

const percent = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : percentOf(value);

const push = (table_: Map<string, string[]>, key: string, value: string): void => {
  table_.set(key, [...(table_.get(key) ?? []), value]);
};

/** Join the parts, each ending in exactly one newline — as the Python does. */
const assemble = (parts: string[]): string =>
  parts.map((part) => (part.endsWith("\n") ? part : part + "\n")).join("");

export const syllabusMarkdown = (b: CourseBundle, courseVersionId: string): string => {
  const run = runById(b).get(courseVersionId) as any;
  const version = versionById(b).get(run.course_version_id) as any;
  const course = b.course as any;
  const outcomes = outcomesOf(b, (b.course as any).course_id);
  const modules = modulesOf(b, (b.course as any).course_id);
  const assessments = assessmentsOf(b, courseVersionId);
  const activities = activitiesOf(b, courseVersionId);
  const users = userById(b);
  const concepts = conceptById(b);
  const share = outcomeGradeShare(b, courseVersionId);

  const instructors = (run.instructors as string[])
    .map((userId) => (users.get(userId) as any)?.display_name ?? userId)
    .join(", ");

  const out: string[] = [];
  out.push(`# ${course.course_id} — ${course.title}\n`);
  out.push(
    table(
      ["Field", "Value"],
      [
        ["Term", run.term],
        ["Credits", course.credits ? g(course.credits) : ""],
        ["Department", course.department ?? ""],
        ["Language of instruction", (course.language as string[]).join(", ")],
        ["Instructor", instructors],
        ["Dates", `${run.start_date} – ${run.end_date}`],
        ["Syllabus version", `${version.course_version_id} (${version.status})`],
      ],
    ),
  );

  if (course.description) {
    out.push("\n## Course description\n");
    out.push(course.description + "\n");
  }

  out.push("\n## Learning outcomes\n");
  out.push("On completion of this course the student is able to:\n");
  out.push(
    table(
      ["ID", "Outcome", "Cognitive level", "Weight", "Share of grade"],
      outcomes.map((outcome) => [
        outcome.outcome_id,
        outcome.title,
        (outcome.level as string[]).join("/"),
        percent(outcome.weight),
        percent(share.get(outcome.outcome_id)),
      ]),
    ),
  );

  if ((b.capabilities as any[]).length) {
    out.push("\n## Capabilities developed\n");
    out.push(
      table(
        ["ID", "Capability", "Description"],
        (b.capabilities as any[]).map((capability) => [
          capability.capability_id,
          capability.title,
          capability.description ?? "",
        ]),
      ),
    );
  }

  out.push("\n## Weekly plan\n");
  const byModule = new Map<string, any[]>();
  for (const activity of activities) {
    if (activity.module_id) push(byModule as any, activity.module_id, activity);
  }
  out.push(
    table(
      ["Week", "Topic", "Outcomes", "Key concepts", "Sessions", "Hours"],
      modules.map((module) => [
        module.week ? String(module.week) : "",
        module.title,
        (module.outcomes as string[]).join(", "),
        (module.concepts as string[])
          .map((c) => (concepts.get(c) as any)?.title ?? c)
          .join(", "),
        (byModule.get(module.module_id) ?? []).map((a: any) => a.type).join(", "),
        module.estimated_hours ? g(module.estimated_hours) : "",
      ]),
    ),
  );

  out.push("\n## Assessment\n");
  out.push(
    table(
      ["ID", "Assessment", "Type", "Weight", "Due", "Outcomes"],
      assessments.map((assessment) => [
        assessment.assessment_id,
        assessment.title,
        assessment.type,
        percent(assessment.weight),
        assessment.due_at ? (assessment.due_at as string).slice(0, 10) : "",
        (assessment.outcomes as string[]).join(", "),
      ]),
    ),
  );
  const declared = assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
  out.push(`\nTotal weight: **${percentOf(declared)}**\n`);

  // A total is a number, and a number in a syllabus reads as the policy. Where a
  // weight is simply absent, the sum understates it by exactly the amount nobody
  // has decided yet — so say which assessments those are rather than letting
  // "Total weight: 70%" stand as though 70 were the answer.
  const unweighted = assessments
    .filter((a) => a.weight === null || a.weight === undefined)
    .map((a) => a.assessment_id as string);
  if (unweighted.length) {
    out.push(
      `\n> **The grading policy is incomplete.** ${unweighted.join(", ")} ` +
        `${unweighted.length === 1 ? "carries" : "carry"} no weight, so the ` +
        "total above is not the grading policy.\n",
    );
  } else if (assessments.length && Math.abs(declared - 1.0) > 0.001) {
    out.push(
      "\n> **The grading policy does not add up.** The weights above total " +
        `${percentOf(declared)}, not 100%.\n`,
    );
  }

  const required = (b.resources as any[]).filter((resource) => resource.required);
  if (required.length) {
    out.push("\n## Required materials\n");
    for (const resource of required) {
      const where = resource.url || (resource.document_id ? `\`${resource.document_id}\`` : "");
      out.push(
        `- **${resource.title}** (${resource.kind}) ${where}`.replace(/\s+$/, "") + "\n",
      );
    }
  }

  out.push("\n## Rubrics\n");
  for (const assessment of assessments) {
    const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : undefined;
    if (!rubric) continue;
    out.push(`\n### ${assessment.title} — ${rubric.rubric_id}\n`);
    out.push(
      table(
        ["Criterion", "Max", "Measures", "Levels"],
        rubric.criteria.map((criterion: any) => [
          `${criterion.criterion_id} ${criterion.title}`,
          g(criterion.maximum_score),
          criterion.outcome_id ?? "",
          criterion.levels
            .map((level: any) => `${g(level.score)}: ${level.description}`)
            .join(" · "),
        ]),
      ),
    );
  }

  out.push(
    "\n---\n\nGenerated from the AINAR canonical model " +
      `(${version.course_version_id}). Edit the course content, not this file.\n`,
  );
  return assemble(out);
};

export const alignmentMarkdown = (b: CourseBundle, courseVersionId: string): string => {
  const run = runById(b).get(courseVersionId) as any;
  const versionId = run.course_version_id;
  const outcomes = outcomesOf(b, (b.course as any).course_id);
  const modules = modulesOf(b, (b.course as any).course_id);
  const assessments = assessmentsOf(b, courseVersionId);
  const activities = activitiesOf(b, courseVersionId);
  const share = outcomeGradeShare(b, courseVersionId);
  const rubrics = allRubrics(b);

  const taught = new Map<string, string[]>();
  for (const module of modules) {
    for (const outcomeId of module.outcomes as string[]) push(taught, outcomeId, module.module_id);
  }
  const practised = new Map<string, string[]>();
  for (const activity of activities) {
    for (const outcomeId of activity.outcomes as string[]) push(practised, outcomeId, activity.activity_id);
  }
  const assessed = new Map<string, string[]>();
  for (const rubric of rubrics.values()) {
    for (const criterion of rubric.criteria ?? []) {
      if (criterion.outcome_id) push(assessed, criterion.outcome_id, criterion.criterion_id);
    }
  }

  const out: string[] = [];
  out.push(`# Constructive alignment — ${(b.course as any).course_id} ${run.term}\n`);
  out.push(
    `\nCourse version \`${versionId}\`, run \`${courseVersionId}\`. ` +
      "Every row must be complete: an outcome that is taught but not assessed " +
      "produces no evidence, and an outcome that is assessed but not taught is " +
      "a fairness problem.\n",
  );

  out.push("\n## Outcome coverage\n");
  out.push(
    table(
      ["Outcome", "Taught in", "Practised in", "Assessed by", "Share of grade", "Complete"],
      outcomes.map((outcome) => [
        `${outcome.outcome_id} ${outcome.title}`,
        (taught.get(outcome.outcome_id) ?? []).join(", "),
        (practised.get(outcome.outcome_id) ?? []).join(", "),
        (assessed.get(outcome.outcome_id) ?? []).join(", "),
        percent(share.get(outcome.outcome_id)),
        taught.get(outcome.outcome_id)?.length && assessed.get(outcome.outcome_id)?.length
          ? CHECK
          : "GAP",
      ]),
    ),
  );

  const attributed = [...share.values()].reduce((a, c) => a + c, 0);
  const declaredTotal = assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
  const unattributed = Math.max(0, declaredTotal - attributed);
  if (unattributed > 0.001) {
    out.push(
      `\n**${percentOf(unattributed)} of the final grade reaches no learning outcome.** ` +
        "Those marks cannot become evidence.\n",
    );
  }

  out.push("\n## Outcome × assessment\n");
  out.push(
    table(
      ["Outcome", ...assessments.map((a) => a.assessment_id as string)],
      outcomes.map((outcome) => [
        outcome.outcome_id,
        ...assessments.map((assessment) => {
          const criteria =
            assessment.rubric_id && rubrics.has(assessment.rubric_id)
              ? rubrics.get(assessment.rubric_id)!.criteria
              : [];
          return criteria.some((c: any) => c.outcome_id === outcome.outcome_id) ? CHECK : "";
        }),
      ]),
    ),
  );

  out.push("\n## Outcome × module\n");
  out.push(
    table(
      ["Outcome", ...modules.map((m) => `W${m.week ?? "?"}`)],
      outcomes.map((outcome) => [
        outcome.outcome_id,
        ...modules.map((module) =>
          (module.outcomes as string[]).includes(outcome.outcome_id) ? CHECK : "",
        ),
      ]),
    ),
  );

  out.push("\n## Concept coverage\n");
  const taughtConcepts = new Map<string, string[]>();
  for (const module of modules) {
    for (const conceptId of module.concepts as string[]) push(taughtConcepts, conceptId, module.module_id);
  }
  const assessedConcepts = new Map<string, string[]>();
  for (const rubric of rubrics.values()) {
    for (const criterion of rubric.criteria ?? []) {
      for (const conceptId of criterion.concepts as string[]) {
        push(assessedConcepts, conceptId, criterion.criterion_id);
      }
    }
  }
  for (const item of b.items as any[]) {
    for (const conceptId of item.concepts as string[]) push(assessedConcepts, conceptId, item.item_id);
  }

  out.push(
    table(
      ["Concept", "Prerequisites", "Taught in", "Assessed by"],
      (b.concepts as any[]).map((concept) => [
        `${concept.concept_id} ${concept.title}`,
        (concept.prerequisites as string[]).join(", "),
        (taughtConcepts.get(concept.concept_id) ?? []).join(", "),
        (assessedConcepts.get(concept.concept_id) ?? []).join(", "),
      ]),
    ),
  );

  if ((b.capabilities as any[]).length) {
    out.push("\n## Capability contribution\n");
    const contributions = new Map<string, string[]>();
    for (const outcome of outcomes) {
      for (const capabilityId of outcome.capabilities as string[]) {
        push(contributions, capabilityId, outcome.outcome_id);
      }
    }
    for (const rubric of rubrics.values()) {
      for (const criterion of rubric.criteria ?? []) {
        if (criterion.capability_id) push(contributions, criterion.capability_id, criterion.criterion_id);
      }
    }
    out.push(
      table(
        ["Capability", "Fed by"],
        (b.capabilities as any[]).map((capability) => [
          `${capability.capability_id} ${capability.title}`,
          [...new Set(contributions.get(capability.capability_id) ?? [])].sort().join(", "),
        ]),
      ),
    );
  }

  out.push("\n## Concept graph\n");
  out.push("\n```mermaid\ngraph TD\n");
  for (const concept of b.concepts as any[]) {
    out.push(`  ${concept.concept_id}["${(concept.title as string).replaceAll('"', "'")}"]\n`);
  }
  for (const concept of b.concepts as any[]) {
    for (const prerequisite of concept.prerequisites as string[]) {
      out.push(`  ${prerequisite} --> ${concept.concept_id}\n`);
    }
  }
  out.push("```\n");

  out.push(
    "\n---\n\nGenerated from the AINAR canonical model. " +
      "Run `python -m ainar validate` for the machine-checkable version of this report.\n",
  );
  return assemble(out);
};
