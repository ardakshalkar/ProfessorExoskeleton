/**
 * What hangs off a topic or a piece of graded work — the records a change to
 * it may leave behind.
 *
 * `impact.ts` answers this for a material: which file, what was rendered from
 * it, where it went. A record has no file of its own to go stale; what it has
 * is other records that point at it by id. Renaming *Agents* to *Robotics*
 * changes one line, and leaves the topic's concepts, its outcomes, the
 * meetings that teach it, their slides and the homework that measures it all
 * describing agents. None of that is wrong until someone decides whether the
 * topic changed or only its name — and that decision is a judgement, made by
 * whichever model the session runs (`/revise`). This is the part that is not a
 * judgement: following the ids, so the model is handed the list rather than
 * left to search the course for it.
 *
 * It writes nothing and decides nothing. The groups come back in the order a
 * change spreads: what the item teaches or measures, then what delivers it,
 * then what is built from it.
 */

import type { CourseBundle } from "./bundle.ts";
import { activitiesOf, assessmentsOf, conceptById, moduleById, outcomeById, runById } from "./bundle.ts";

export interface ImpactEntry {
  id: string;
  title: string;
  /** `draft` while its record says `approval: draft`. */
  draft: boolean;
  /** A short fact beside the title — a meeting's type and date, a question count. */
  note?: string;
}

export interface ImpactGroup {
  /** `concepts`, `outcomes`, `meetings`, `materials`, `assessments`, `items`, `topic`. */
  kind: string;
  label: string;
  entries: ImpactEntry[];
}

export interface RecordImpact {
  kind: "module" | "assessment";
  id: string;
  title: string;
  groups: ImpactGroup[];
}

const entry = (record: any, idField: string, note?: string): ImpactEntry => ({
  id: String(record[idField]),
  title: String(record.title ?? record.prompt ?? record[idField]),
  draft: record.approval === "draft",
  ...(note ? { note } : {}),
});

const group = (kind: string, label: string, entries: ImpactEntry[]): ImpactGroup[] =>
  entries.length ? [{ kind, label, entries }] : [];

const named = (ids: string[], index: Map<string, any>, idField: string) =>
  ids.map((id) => (index.has(id) ? entry(index.get(id), idField) : { id, title: id, draft: false }));

/** The materials of a run that belong to a module: by `module_id`, or as a meeting's resource. */
const materialsOf = (bundle: CourseBundle, courseVersionId: string, moduleId: string, meetings: any[]) => {
  const seen = new Set<string>();
  const found: ImpactEntry[] = [];
  const resources = new Map((bundle.resources as any[]).map((r) => [r.resource_id, r]));
  for (const meeting of meetings) {
    for (const id of meeting.resources ?? []) {
      const resource = resources.get(id);
      if (!resource || seen.has(id)) continue;
      seen.add(id);
      found.push(entry(resource, "resource_id", resource.kind));
    }
  }
  for (const document of bundle.documents as any[]) {
    if (document.module_id !== moduleId) continue;
    if (document.course_version_id && document.course_version_id !== courseVersionId) continue;
    if (seen.has(document.document_id)) continue;
    seen.add(document.document_id);
    found.push(entry(document, "document_id", document.mime_type));
  }
  return found;
};

const when = (stamp: unknown) => (typeof stamp === "string" ? stamp.slice(0, 10) : "no date");

/**
 * The records that follow from `id`, a module of the run's course or an
 * assessment of the run. Null when it is neither.
 */
export const recordImpact = (bundle: CourseBundle, courseVersionId: string, kind: string, id: string): RecordImpact | null => {
  const run = runById(bundle).get(courseVersionId);
  if (!run) return null;
  const concepts = conceptById(bundle);
  const outcomes = outcomeById(bundle);

  if (kind === "module") {
    const module = moduleById(bundle).get(id);
    if (!module || module.course_id !== run.course_id) return null;
    const meetings = activitiesOf(bundle, courseVersionId).filter((a) => a.module_id === id);
    const work = assessmentsOf(bundle, courseVersionId).filter((a) => a.module_id === id);
    return {
      kind,
      id,
      title: module.title,
      groups: [
        ...group("concepts", "Concepts it teaches", named(module.concepts ?? [], concepts, "concept_id")),
        ...group("outcomes", "Outcomes it serves", named(module.outcomes ?? [], outcomes, "outcome_id")),
        ...group("meetings", "Meetings that teach it", meetings.map((m) => entry(m, "activity_id", `${m.type} · ${when(m.scheduled_at)}`))),
        ...group("materials", "Slides and materials", materialsOf(bundle, courseVersionId, id, meetings)),
        ...group("assessments", "Graded work tied to it", work.map((a) => entry(a, "assessment_id", a.type))),
      ],
    };
  }

  if (kind === "assessment") {
    const assessment = assessmentsOf(bundle, courseVersionId).find((a) => a.assessment_id === id);
    if (!assessment) return null;
    const module = assessment.module_id ? moduleById(bundle).get(assessment.module_id) : null;
    const items = (bundle.items as any[]).filter((item) => item.assessment_id === id);
    const brief = assessment.instructions_document_id
      ? (bundle.documents as any[]).find((d) => d.document_id === assessment.instructions_document_id)
      : null;
    return {
      kind,
      id,
      title: assessment.title,
      groups: [
        ...group("topic", "The topic it belongs to", module ? [entry(module, "module_id", `week ${module.week ?? "?"}`)] : []),
        ...group("outcomes", "Outcomes it measures", named(assessment.outcomes ?? [], outcomes, "outcome_id")),
        ...group("materials", "Its brief", brief ? [entry(brief, "document_id", brief.mime_type)] : []),
        ...group(
          "items",
          "Its questions",
          items.length ? [{ id, title: `${items.length} question${items.length === 1 ? "" : "s"}`, draft: items.some((i) => i.approval === "draft") }] : [],
        ),
      ],
    };
  }
  return null;
};

/** The impact as lines of text, for a prompt or a terminal. */
export const describeRecordImpact = (found: RecordImpact): string[] => {
  const lines = [`${found.id}  ${found.title}`];
  if (!found.groups.length) lines.push("  nothing else in the course points at it");
  for (const g of found.groups) {
    lines.push(`  ${g.label}:`);
    for (const e of g.entries) {
      lines.push(`    - ${e.id}  ${e.title}${e.note ? ` (${e.note})` : ""}${e.draft ? " [draft]" : ""}`);
    }
  }
  return lines;
};
