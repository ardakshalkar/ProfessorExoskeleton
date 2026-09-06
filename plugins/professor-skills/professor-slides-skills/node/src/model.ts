/**
 * One shape for a course, whichever of the three places it came from.
 *
 * A Supabase read model, a course directory in the AINAR layout and a single
 * hand-written `course.yaml` describe the same thing at different levels of
 * detail. They are normalised here so that nothing downstream — no skill, no
 * check, no renderer — has to branch on where the course was found. What the
 * three cannot agree on is recorded in `provenance` instead, because *which
 * source answered* is a fact the professor needs and a fact a fallback is
 * otherwise very good at hiding.
 *
 * Nothing in this file invents. A field the source did not carry is absent, not
 * defaulted to something plausible: an outcome with a guessed Bloom level would
 * end up shaping a deck and nobody would remember it was guessed.
 */

export interface Outcome {
  outcome_id: string;
  title: string;
  description?: string;
  /** Bloom level as the course states it, when it states one. */
  level?: string;
  weight?: number;
  concepts: string[];
}

export interface Concept {
  concept_id: string;
  title: string;
  description?: string;
  /** Concepts that must land before this one can. */
  prerequisites: string[];
}

export interface Module {
  module_id: string;
  title: string;
  week?: number;
  description?: string;
  outcomes: string[];
  concepts: string[];
  estimated_hours?: number;
}

export interface Activity {
  activity_id: string;
  title?: string;
  /** lecture, lab, seminar, workshop … as the course names it. */
  type?: string;
  module_id?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  location?: string;
  outcomes: string[];
  concepts: string[];
  resources: string[];
  preparation?: string;
}

/**
 * A reading, a book chapter, a course page — the material a deck is grounded
 * in.
 *
 * This is `delivery.resources` / `versions/<TERM>/resources.yaml` unchanged.
 * Nothing new was defined for references because the course model already had
 * the right record, with the right concept tagging, and a second list of books
 * beside it would be a second thing to keep true.
 */
export interface Reference {
  resource_id: string;
  title: string;
  kind: string;
  url?: string;
  description?: string;
  required: boolean;
  concepts: string[];
  document_id?: string;
  /** Where in the book — pages, chapter — when the record says. */
  locator?: string;
}

export interface CourseVersion {
  course_version_id: string;
  term?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  status?: string;
}

export type Origin = "supabase" | "course-directory" | "flat-file";

export interface AttemptRecord {
  origin: Origin;
  /** Why this source did not answer, in words a professor can act on. */
  why: string;
}

export interface Provenance {
  origin: Origin;
  /** The route or path that answered, safe to print. */
  detail: string;
  /**
   * What was tried first and did not answer.
   *
   * A silent fallback to a YAML course while the database was merely
   * unreachable is the failure this field exists to prevent: the deck gets
   * built from last month's outcomes and looks exactly like one built from
   * this month's.
   */
  attempted: AttemptRecord[];
  read_at: string;
}

export interface CourseSource {
  course: {
    course_id: string;
    title: string;
    description?: string;
    credits?: number;
    department?: string;
    language?: string[];
    /** Only the flat shape states this; elsewhere it is a preference. */
    audience?: string;
  };
  version: CourseVersion | null;
  outcomes: Outcome[];
  concepts: Concept[];
  modules: Module[];
  activities: Activity[];
  references: Reference[];
  provenance: Provenance;
}

// --- reading a loosely-typed payload without inventing anything -------------

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rows = (value: unknown): Loose[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const str = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
};

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** A list of identifiers, tolerating a single string where a list belongs. */
const ids = (value: unknown): string[] => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const direct = str(entry);
    if (direct) return [direct];
    // Some exports nest the identifier one level down.
    if (isRecord(entry)) {
      const nested = str(entry.concept_id) ?? str(entry.outcome_id) ?? str(entry.id) ?? str(entry.code);
      if (nested) return [nested];
    }
    return [];
  });
};

const put = <T extends object>(target: T, key: keyof T, value: unknown): void => {
  if (value !== undefined) (target as Record<string, unknown>)[key as string] = value;
};

/**
 * A collection under any of the names the three sources give it.
 *
 * The read model and the YAML loader agree; a hand-written flat file usually
 * says `topics` where the model says `modules`, and refusing to read that would
 * make the flat shape useless to the person it exists for.
 */
const collection = (bundle: Loose, ...names: string[]): Loose[] => {
  for (const name of names) {
    const found = rows(bundle[name]);
    if (found.length) return found;
  }
  return [];
};

function toOutcome(row: Loose): Outcome | null {
  const id = str(row.outcome_id) ?? str(row.code) ?? str(row.id);
  const title = str(row.title) ?? str(row.name);
  if (!id || !title) return null;
  const outcome: Outcome = { outcome_id: id, title, concepts: ids(row.concepts) };
  put(outcome, "description", str(row.description));
  put(outcome, "level", str(row.level));
  put(outcome, "weight", num(row.weight));
  return outcome;
}

function toConcept(row: Loose): Concept | null {
  const id = str(row.concept_id) ?? str(row.code) ?? str(row.id);
  const title = str(row.title) ?? str(row.name);
  if (!id || !title) return null;
  const concept: Concept = { concept_id: id, title, prerequisites: ids(row.prerequisites) };
  put(concept, "description", str(row.description));
  return concept;
}

function toModule(row: Loose): Module | null {
  const id = str(row.module_id) ?? str(row.code) ?? str(row.id);
  const title = str(row.title) ?? str(row.name);
  if (!id || !title) return null;
  const module: Module = {
    module_id: id,
    title,
    outcomes: ids(row.outcomes),
    concepts: ids(row.concepts),
  };
  put(module, "week", num(row.week));
  put(module, "description", str(row.description));
  put(module, "estimated_hours", num(row.estimated_hours));
  return module;
}

function toActivity(row: Loose): Activity | null {
  const id = str(row.activity_id) ?? str(row.code) ?? str(row.id);
  if (!id) return null;
  const activity: Activity = {
    activity_id: id,
    outcomes: ids(row.outcomes),
    concepts: ids(row.concepts),
    resources: ids(row.resources),
  };
  put(activity, "title", str(row.title));
  put(activity, "type", str(row.type) ?? str(row.activity_type));
  put(activity, "module_id", str(row.module_id));
  put(activity, "scheduled_at", str(row.scheduled_at) ?? str(row.starts_at));
  put(activity, "duration_minutes", num(row.duration_minutes));
  put(activity, "location", str(row.location));
  put(activity, "preparation", str(row.preparation));
  return activity;
}

function toReference(row: Loose): Reference | null {
  const id = str(row.resource_id) ?? str(row.code) ?? str(row.id);
  const title = str(row.title) ?? str(row.name);
  if (!id || !title) return null;
  const extensions = isRecord(row.extensions) ? row.extensions : {};
  const reference: Reference = {
    resource_id: id,
    title,
    kind: str(row.kind) ?? "other",
    required: row.required === true,
    concepts: ids(row.concepts),
  };
  put(reference, "url", str(row.url));
  put(reference, "description", str(row.description));
  put(reference, "document_id", str(row.document_id));
  put(reference, "locator", str(row.locator) ?? str(extensions.locator) ?? str(extensions.pages));
  return reference;
}

/**
 * Prerequisite edges stated separately, folded onto the concepts they concern.
 *
 * The course model allows both spellings — `prerequisites` inline on a concept
 * and a `concept_edges` list — and a course that uses the second would
 * otherwise arrive with an empty graph, which reads as "this concept depends on
 * nothing" rather than as "the edges are in the other file".
 */
function applyEdges(concepts: Concept[], edges: Loose[]): void {
  if (!edges.length) return;
  const byId = new Map(concepts.map((concept) => [concept.concept_id, concept]));
  for (const edge of edges) {
    const relationship = str(edge.relationship_type) ?? "prerequisite";
    if (relationship !== "prerequisite" && relationship !== "requires") continue;
    const source = str(edge.source_concept_id);
    const target = str(edge.target_concept_id);
    if (!source || !target) continue;
    // source is the prerequisite of target, matching the schema's direction.
    const concept = byId.get(target);
    if (concept && !concept.prerequisites.includes(source)) concept.prerequisites.push(source);
  }
}

function toVersion(row: Loose | undefined): CourseVersion | null {
  if (!row) return null;
  const id = str(row.course_version_id) ?? str(row.code) ?? str(row.id);
  if (!id) return null;
  const version: CourseVersion = { course_version_id: id };
  put(version, "term", str(row.term));
  put(version, "start_date", str(row.start_date));
  put(version, "end_date", str(row.end_date));
  put(version, "timezone", str(row.timezone));
  put(version, "status", str(row.status));
  return version;
}

/**
 * A course bundle — from Supabase or from YAML — as a `CourseSource`.
 *
 * `versionId` picks a run when the bundle carries several; without it the only
 * version is used, and with several and no choice the version is left null
 * rather than guessed. A deck built against the wrong term is a deck with the
 * wrong dates and the wrong room on its first slide.
 */
export function fromBundle(
  bundle: Loose,
  provenance: Provenance,
  versionId?: string,
): CourseSource {
  const courseRow = isRecord(bundle.course)
    ? bundle.course
    : (collection(bundle, "courses")[0] ?? {});

  const course: CourseSource["course"] = {
    course_id: str(courseRow.course_id) ?? str(courseRow.code) ?? str(bundle.course_code) ?? "UNKNOWN",
    title: str(courseRow.title) ?? str(courseRow.name) ?? "Untitled course",
  };
  put(course, "description", str(courseRow.description));
  put(course, "credits", num(courseRow.credits));
  put(course, "department", str(courseRow.department));
  const language = ids(courseRow.language);
  if (language.length) course.language = language;
  put(course, "audience", str(courseRow.audience));

  const concepts = collection(bundle, "concepts").map(toConcept).filter((c): c is Concept => c !== null);
  applyEdges(concepts, collection(bundle, "concept_edges", "conceptEdges"));

  const versions = collection(bundle, "versions", "course_versions");
  const chosen = versionId
    ? versions.find((row) => {
        const id = str(row.course_version_id) ?? str(row.code);
        return id === versionId || str(row.term) === versionId;
      })
    : versions.length === 1
      ? versions[0]
      : undefined;
  const version = toVersion(chosen);

  // Records that name a run are filtered to the chosen one. Without a chosen
  // run everything is kept, and `pres source` says so — better a report the
  // professor has to narrow than one that quietly dropped this term's readings.
  const belongsToRun = (row: Loose): boolean => {
    if (!version) return true;
    const id = str(row.course_version_id) ?? str(row.course_run_id);
    return id === undefined || id === version.course_version_id;
  };

  return {
    course,
    version,
    outcomes: collection(bundle, "outcomes", "learning_outcomes")
      .map(toOutcome)
      .filter((o): o is Outcome => o !== null),
    concepts,
    modules: collection(bundle, "modules")
      .map(toModule)
      .filter((m): m is Module => m !== null),
    activities: collection(bundle, "activities", "learning_activities")
      .filter(belongsToRun)
      .map(toActivity)
      .filter((a): a is Activity => a !== null),
    references: collection(bundle, "resources", "references")
      .filter(belongsToRun)
      .map(toReference)
      .filter((r): r is Reference => r !== null),
    provenance,
  };
}

/**
 * The flat shape: one `course.yaml`, no course directory, no database.
 *
 * This is the shape that makes the plugin standalone rather than an accessory
 * to the parent repository. It is read through the same normaliser because the
 * only real difference is that `topics` stands in for `modules` and the
 * references sit at the top level — see `references/course-source.md`.
 */
export function fromFlatFile(document: Loose, provenance: Provenance): CourseSource {
  const courseRow = isRecord(document.course) ? document.course : document;
  const bundle: Loose = {
    course: courseRow,
    outcomes: document.outcomes ?? [],
    concepts: document.concepts ?? [],
    modules: document.modules ?? document.topics ?? [],
    activities: document.activities ?? document.sessions ?? [],
    resources: document.references ?? document.resources ?? [],
    versions: document.versions ?? (isRecord(document.version) ? [document.version] : []),
  };
  return fromBundle(bundle, provenance);
}
