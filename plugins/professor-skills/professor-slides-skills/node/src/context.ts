/**
 * Everything one session's outline is allowed to be built from.
 *
 * The point of assembling this rather than handing an agent the whole course is
 * that the boundaries are the interesting part. A module's concepts bound what
 * the deck may cover; its outcomes bound what the deck may claim to serve; the
 * previous module is what the opening slide builds on; the scheduled activity's
 * duration and type decide the shape, because a 100-minute lecture and a
 * 150-minute lab are not the same artefact.
 *
 * Prerequisites are included one level deep and then named, not expanded
 * further. A deck that re-teaches the whole chain is a deck that never reaches
 * this week's material, but a deck that assumes a prerequisite the class has
 * not met is one that will not land — so the outline gets the names and decides
 * which of them are worth five minutes.
 */

import type { Activity, Concept, CourseSource, Module, Outcome, Reference } from "./model.ts";

/** Reference kinds that are reading matter a deck can be grounded in. */
export const GROUNDING_KINDS = new Set([
  "reading",
  "textbook_chapter",
  "link",
  "video",
  "slides",
  "notebook",
]);

export interface ModuleContext {
  course: CourseSource["course"];
  version: CourseSource["version"];
  module: Module;
  /** The module before this one, by week then by order in the file. */
  previous: Module | null;
  next: Module | null;
  outcomes: Outcome[];
  concepts: Concept[];
  /**
   * Concepts this module's concepts depend on, taught elsewhere.
   *
   * Each carries the module that introduces it, so the outline can say "this
   * builds on CONCEPT-X, which was week 3" rather than merely naming it.
   */
  prerequisites: Array<Concept & { introduced_by: string | null }>;
  activities: Activity[];
  references: Reference[];
  /** What the module claims that this context cannot resolve — reported, not fixed. */
  unresolved: string[];
  provenance: CourseSource["provenance"];
}

const byId = <T>(rows: T[], key: (row: T) => string): Map<string, T> =>
  new Map(rows.map((row) => [key(row), row]));

/** Modules in teaching order: by week where stated, else by file order. */
export function inTeachingOrder(modules: Module[]): Module[] {
  return modules
    .map((module, index) => ({ module, index }))
    .sort((a, b) => {
      const weekA = a.module.week ?? Number.MAX_SAFE_INTEGER;
      const weekB = b.module.week ?? Number.MAX_SAFE_INTEGER;
      return weekA !== weekB ? weekA - weekB : a.index - b.index;
    })
    .map((entry) => entry.module);
}

/**
 * The module a date falls in, for "prepare the next lecture" with no module
 * named. Uses the activity schedule, which is the only thing that knows about
 * actual days.
 */
export function moduleOnDate(source: CourseSource, isoDate: string): Module | null {
  const day = isoDate.slice(0, 10);
  const activity = source.activities
    .filter((entry) => entry.scheduled_at?.slice(0, 10) === day)
    .find((entry) => entry.module_id);
  if (!activity?.module_id) return null;
  return source.modules.find((module) => module.module_id === activity.module_id) ?? null;
}

export function buildModuleContext(source: CourseSource, moduleId: string): ModuleContext {
  const modules = inTeachingOrder(source.modules);
  const position = modules.findIndex((entry) => entry.module_id === moduleId);
  if (position < 0) {
    const known = modules.map((entry) => entry.module_id).join(", ") || "none";
    throw new Error(`No module '${moduleId}' in ${source.course.course_id}. Known modules: ${known}`);
  }
  const module = modules[position]!;

  const conceptsById = byId(source.concepts, (concept) => concept.concept_id);
  const outcomesById = byId(source.outcomes, (outcome) => outcome.outcome_id);
  const unresolved: string[] = [];

  const outcomes: Outcome[] = [];
  for (const id of module.outcomes) {
    const outcome = outcomesById.get(id);
    if (outcome) outcomes.push(outcome);
    else unresolved.push(`${module.module_id} names outcome ${id}, which the course does not define`);
  }

  const concepts: Concept[] = [];
  for (const id of module.concepts) {
    const concept = conceptsById.get(id);
    if (concept) concepts.push(concept);
    else unresolved.push(`${module.module_id} names concept ${id}, which the course does not define`);
  }

  // Which module introduces a concept — the answer to "where was this taught".
  const introducedBy = new Map<string, string>();
  for (const entry of modules) {
    for (const id of entry.concepts) {
      if (!introducedBy.has(id)) introducedBy.set(id, entry.module_id);
    }
  }

  const own = new Set(module.concepts);
  const prerequisites: ModuleContext["prerequisites"] = [];
  const seen = new Set<string>();
  for (const concept of concepts) {
    for (const id of concept.prerequisites) {
      if (own.has(id) || seen.has(id)) continue;
      seen.add(id);
      const prerequisite = conceptsById.get(id);
      if (!prerequisite) {
        unresolved.push(`${concept.concept_id} requires ${id}, which the course does not define`);
        continue;
      }
      prerequisites.push({ ...prerequisite, introduced_by: introducedBy.get(id) ?? null });
    }
  }

  const activities = source.activities.filter((activity) => activity.module_id === module.module_id);

  // A reference earns its place by concept overlap, or by being attached to
  // this module's scheduled meeting. Nothing else is included: a deck grounded
  // in every reading on the course is grounded in none of them.
  const attached = new Set(activities.flatMap((activity) => activity.resources));
  const references = source.references.filter(
    (reference) =>
      attached.has(reference.resource_id) ||
      reference.concepts.some((id) => own.has(id) || seen.has(id)),
  );

  return {
    course: source.course,
    version: source.version,
    module,
    previous: position > 0 ? modules[position - 1]! : null,
    next: position + 1 < modules.length ? modules[position + 1]! : null,
    outcomes,
    concepts,
    prerequisites,
    activities,
    references: references.filter((reference) => GROUNDING_KINDS.has(reference.kind) || reference.required),
    unresolved,
    provenance: source.provenance,
  };
}

/**
 * The same context, short.
 *
 * What STANDARD mode reads. The full report prints every outcome's description,
 * every concept's description and every reference's location on its own line,
 * which is right when a session is being designed carefully and is two or three
 * times the size of what a competent model needs to write a good deck from.
 *
 * Nothing is dropped, only trimmed: every identifier, title, prerequisite,
 * duration and reference is still here, so the boundaries the context exists to
 * state — what the session may cover, what it may claim to serve — are all
 * intact. Descriptions are cut to their first sentence-or-so, which is where a
 * concept description says what the concept is. `pres context` without
 * `--brief` remains the full thing, and DEEP mode reads that.
 */
export function describeContextBrief(context: ModuleContext): string {
  const clip = (text: string | undefined, limit = 150): string => {
    const flat = String(text ?? "").replace(/\s+/g, " ").trim();
    if (flat.length <= limit) return flat;
    // Prefer a sentence boundary, because half a sentence reads as an error and
    // a whole short one reads as a summary.
    const stop = flat.slice(0, limit).lastIndexOf(". ");
    return stop > limit * 0.4 ? flat.slice(0, stop + 1) : `${flat.slice(0, limit).trimEnd()}…`;
  };

  const lines: string[] = [];
  const runId = context.version?.course_version_id ?? context.course.course_id;
  const week = context.module.week === undefined ? "" : ` · week ${context.module.week}`;
  lines.push(`${context.module.module_id} ${context.module.title} — ${runId}${week}`);
  lines.push(
    `previous: ${context.previous ? context.previous.module_id : "none (first module)"}` +
    (context.next ? ` · next: ${context.next.module_id}` : ""),
  );

  lines.push("");
  lines.push("outcomes (the deck may claim to serve these and no others):");
  if (!context.outcomes.length) lines.push("  none stated");
  for (const outcome of context.outcomes) {
    const level = outcome.level ? ` [${outcome.level}]` : "";
    lines.push(`  ${outcome.outcome_id}${level} ${outcome.title}`);
  }

  lines.push("");
  lines.push("concepts (the deck may cover these and no others):");
  if (!context.concepts.length) lines.push("  none stated");
  for (const concept of context.concepts) {
    lines.push(`  ${concept.concept_id} ${concept.title}`);
    const description = clip(concept.description);
    if (description) lines.push(`    ${description}`);
  }

  if (context.prerequisites.length) {
    lines.push("");
    lines.push("prerequisites, taught elsewhere:");
    for (const concept of context.prerequisites) {
      const where = concept.introduced_by ?? "not introduced by any module";
      lines.push(`  ${concept.concept_id} ${concept.title} (${where})`);
    }
  }

  lines.push("");
  if (!context.activities.length) {
    lines.push("scheduled: nothing, so the duration is not settled — ask.");
  } else {
    lines.push("scheduled:");
    for (const activity of context.activities) {
      const parts = [
        activity.type ?? "session",
        activity.duration_minutes ? `${activity.duration_minutes} min` : null,
        activity.scheduled_at ?? null,
      ].filter(Boolean);
      lines.push(`  ${activity.activity_id} ${activity.title ?? "untitled"} — ${parts.join(" · ")}`);
    }
  }

  lines.push("");
  if (!context.references.length) {
    lines.push("references: none recorded. The deck is grounded in the course design only; say so.");
  } else {
    lines.push("references:");
    for (const reference of context.references) {
      const where = reference.url ?? reference.document_id ?? "";
      const locator = reference.locator ? ` — ${reference.locator}` : "";
      lines.push(`  ${reference.resource_id} [${reference.kind}] ${reference.title}${locator}${where ? `  ${where}` : ""}`);
    }
  }

  if (context.unresolved.length) {
    lines.push("");
    lines.push("unresolved:");
    for (const problem of context.unresolved) lines.push(`  ${problem}`);
  }
  return lines.join("\n");
}

/**
 * The context as prose, for a skill that is going to read it rather than parse
 * it. `--json` gives the same thing structured.
 */
export function describeContext(context: ModuleContext): string {
  const lines: string[] = [];
  const runId = context.version?.course_version_id ?? context.course.course_id;
  lines.push(`# ${context.module.module_id} — ${context.module.title}`);
  lines.push(`${context.course.course_id} ${context.course.title} · ${runId}`);
  if (context.module.week !== undefined) lines.push(`Week ${context.module.week}`);
  lines.push("");

  if (context.previous) {
    lines.push(`Previous: ${context.previous.module_id} — ${context.previous.title}`);
  } else {
    lines.push("Previous: none — this is the first module, so there is nothing to build on.");
  }
  if (context.next) lines.push(`Next: ${context.next.module_id} — ${context.next.title}`);
  lines.push("");

  lines.push("## Outcomes this module serves");
  if (!context.outcomes.length) lines.push("- none stated");
  for (const outcome of context.outcomes) {
    const level = outcome.level ? ` [${outcome.level}]` : "";
    lines.push(`- ${outcome.outcome_id}${level} ${outcome.title}`);
    if (outcome.description) lines.push(`    ${outcome.description}`);
  }
  lines.push("");

  lines.push("## Concepts this module introduces");
  if (!context.concepts.length) lines.push("- none stated");
  for (const concept of context.concepts) {
    lines.push(`- ${concept.concept_id} ${concept.title}`);
    if (concept.description) lines.push(`    ${concept.description}`);
  }
  lines.push("");

  lines.push("## Prerequisites, taught elsewhere");
  if (!context.prerequisites.length) lines.push("- none");
  for (const concept of context.prerequisites) {
    const where = concept.introduced_by ? ` (introduced in ${concept.introduced_by})` : " (not introduced by any module)";
    lines.push(`- ${concept.concept_id} ${concept.title}${where}`);
  }
  lines.push("");

  lines.push("## Scheduled");
  if (!context.activities.length) {
    lines.push("- nothing scheduled for this module, so the duration is not settled — ask.");
  }
  for (const activity of context.activities) {
    const parts = [
      activity.type ?? "session",
      activity.duration_minutes ? `${activity.duration_minutes} min` : null,
      activity.scheduled_at ?? null,
      activity.location ?? null,
    ].filter(Boolean);
    lines.push(`- ${activity.activity_id}: ${activity.title ?? "untitled"} — ${parts.join(" · ")}`);
    if (activity.preparation) lines.push(`    preparation: ${activity.preparation}`);
  }
  lines.push("");

  lines.push("## References for these concepts");
  if (!context.references.length) {
    lines.push("- none recorded. The deck is grounded in the course design only; say so.");
  }
  for (const reference of context.references) {
    const where = reference.url ?? reference.document_id ?? "no location recorded";
    const locator = reference.locator ? ` — ${reference.locator}` : "";
    lines.push(`- ${reference.resource_id} [${reference.kind}] ${reference.title}${locator}`);
    lines.push(`    ${where}`);
  }

  if (context.unresolved.length) {
    lines.push("");
    lines.push("## Unresolved");
    for (const problem of context.unresolved) lines.push(`- ${problem}`);
  }
  return lines.join("\n");
}
