/**
 * Turn a CourseBundle into SQL the application can run. Ported from
 * `ainar/sqlgen.py`.
 *
 * Output is a plain `.sql` file rather than a live connection, for three
 * reasons: it needs no database driver in this workspace, it can be read and
 * reviewed before it touches anything, and it can be replayed.
 *
 * Identifiers are UUIDv5 derived from the readable code under a fixed namespace.
 * That makes an import idempotent — the same content always lands on the same
 * rows — and means foreign keys can be written without a single lookup.
 *
 * Every statement is `INSERT … ON CONFLICT (id) DO UPDATE`, so re-importing a
 * corrected course updates it in place rather than duplicating it.
 *
 * ## The one thing this port had to add
 *
 * Python read float-ness off the value: `literal(1.0)` is `repr(1.0)`, so a
 * weight of 1 prints as `1.0` and a week of 1 prints as `1`. JavaScript has one
 * number type and cannot tell them apart, so the schema says which — `real()`
 * for a column, `FLOAT_FIELDS` for a value nested inside a JSONB one. It is
 * cosmetic as far as Postgres is concerned; it is not cosmetic for a person
 * reading the diff between two generated scripts, which is the only way anybody
 * reviews this file.
 *
 * ## The one thing it cannot do
 *
 * `extensions` is a free-form map, so a number in one has no schema to consult.
 * Python knew `proportion: 1.0` was a float because PyYAML built a `float`;
 * the JavaScript YAML parser builds the number 1 and the distinction is gone
 * before this module sees it. So an *untyped* whole-numbered float inside
 * `extensions` prints as `1` where Python printed `1.0`, and `1.0` is what
 * `jsonb` would have stored.
 *
 * Measured, not assumed: generating this course through both implementations
 * and diffing gives 205 identical statements and three lines that differ, all
 * three on the same `extensions.proportion`. `test/sqlgen.test.ts` pins it, so
 * the day someone teaches the loader to carry float-ness the test says where to
 * come back to.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { floatPaths } from "./approve.ts";
import { type CourseBundle, allRubrics, bundlePayload } from "./bundle.ts";
import { SCHEMA_MODELS } from "./schema.ts";

/**
 * Fixed, so UUIDs are reproducible across machines and runs. Never change it:
 * a new namespace would orphan every row already imported.
 */
export const NAMESPACE = "6f1a0b9c-3f5e-5c8a-9d21-4e7b1c0a55d3";

// --------------------------------------------------------------------------
// UUIDv5
// --------------------------------------------------------------------------

/**
 * `uuid.uuid5(namespace, name)` — RFC 9562 §5.5.
 *
 * SHA-1 over the namespace's sixteen bytes followed by the name's UTF-8 bytes;
 * the first sixteen bytes of the digest, with the version nibble set to 5 and
 * the variant bits to the RFC's.
 *
 * Taking the namespace as an argument rather than closing over `NAMESPACE` is
 * what lets `test/sqlgen.test.ts` check it against the published vectors. Every
 * id in the import script is derived here, so an implementation that is wrong in
 * a way review would not catch — a byte-order slip, a mask off by a nibble —
 * still produces stable, plausible ids, and every row would land somewhere the
 * application cannot find it. The vectors are the only thing that rules that out.
 */
export const uuid5 = (namespace: string, name: string): string => {
  const digest = createHash("sha1")
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(Buffer.from(name, "utf-8"))
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const rowId = (code: string): string => uuid5(NAMESPACE, code);

// --------------------------------------------------------------------------
// Literals
// --------------------------------------------------------------------------

/**
 * Marks a value as JSONB rather than letting `literal` guess.
 *
 * A list of strings is a `text[]` and a list of objects is a JSON array, and
 * nothing about the value says which the column wants. Guessing once produced a
 * JSON array rendered as a Python `repr` inside a text array, which Postgres
 * accepted and no one would have noticed.
 */
export class Json {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

/** Marks a number as a float, so it prints `1.0` rather than `1`. */
export class Real {
  value: number | null | undefined;
  constructor(value: number | null | undefined) {
    this.value = value;
  }
}

const json = (value: unknown): Json => new Json(value);
const real = (value: number | null | undefined): Real => new Real(value);

/** A UUID that has already been rendered, so `literal` does not quote it as text. */
class Uuid {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}

const uuid = (code: string): Uuid => new Uuid(rowId(code));
const ref = (code: string | null | undefined): Uuid | null => (code ? uuid(code) : null);

/** A PostgreSQL string literal. Doubling the quote is the whole escape. */
const quote = (text: string): string => "'" + text.replace(/'/g, "''") + "'";

/**
 * Every field name in the model whose value is a float rather than an integer.
 *
 * Derived from the schemas rather than listed, so a field added upstream is
 * covered the day it lands. Names rather than paths because these are nested
 * payloads — a slide plan inside a document, a blueprint inside an assessment —
 * and the path a value sits at inside a JSONB column is not the path the
 * top-level schema knows it by.
 *
 * No name in the model is a float in one place and an integer in another; if
 * one ever is, `floatPaths` will report both and this set will be wrong in the
 * direction of printing `1.0` for an integer.
 */
const FLOAT_FIELDS: Set<string> = (() => {
  const names = new Set<string>();
  for (const model of Object.values(SCHEMA_MODELS)) {
    for (const path of floatPaths(model)) {
      const last = path.split(".").pop();
      if (last) names.add(last);
    }
  }
  return names;
})();

/**
 * `json.dumps(value, ensure_ascii=False, sort_keys=True)`.
 *
 * Written out rather than left to `JSON.stringify`, for two reasons that both
 * show up when the two implementations' output is diffed:
 *
 * * **Separators.** Python's defaults are `", "` and `": "`; JavaScript's are
 *   `","` and `":"`. Same JSON, different bytes, every line.
 * * **Floats.** A `minutes: 4.0` inside a slide plan is a float in the model and
 *   prints as `4.0`; `JSON.stringify` has no way to know and prints `4`. The
 *   same problem `Real` solves for columns, solved here for the values inside
 *   one — see `FLOAT_FIELDS`.
 *
 * `sort_keys` is what makes a generated script stable: the same course must
 * produce the same bytes, and object key order in JavaScript follows insertion.
 */
const canonicalJson = (value: unknown, isFloat = false): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return isFloat && Number.isInteger(value) ? `${value}.0` : String(value);
  }
  // `JSON.stringify` on a lone string escapes exactly what `json.dumps` escapes,
  // and leaves non-ASCII alone, which is `ensure_ascii=False`.
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalJson(item, isFloat)).join(", ") + "]";
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}: ` +
        canonicalJson((value as Record<string, unknown>)[key], FLOAT_FIELDS.has(key)),
    );
  return "{" + entries.join(", ") + "}";
};

export const literal = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Json) {
    return value.value === null || value.value === undefined
      ? "NULL"
      : quote(canonicalJson(value.value)) + "::jsonb";
  }
  if (value instanceof Real) {
    if (value.value === null || value.value === undefined) return "NULL";
    return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
  }
  if (value instanceof Uuid) return `'${value.value}'::uuid`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "'{}'";
    const bad = value.find((item) => typeof item !== "string" && typeof item !== "number");
    if (bad !== undefined) {
      throw new TypeError(
        `cannot render ${typeof bad} inside a text[]; wrap the value in Json() if the column is JSONB`,
      );
    }
    return `ARRAY[${value.map((item) => quote(String(item))).join(", ")}]::text[]`;
  }
  if (typeof value === "object") return quote(canonicalJson(value)) + "::jsonb";
  return quote(String(value));
};

/** Drop the empty `extensions` maps that every nested model carries. */
const tidy = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(tidy);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (key === "extensions" && value && typeof value === "object" && !Object.keys(value).length) {
        continue;
      }
      out[key] = tidy(value);
    }
    return out;
  }
  return node;
};

/** One nested model as JSONB. */
const jsonb = (model: unknown): Json =>
  model === null || model === undefined ? json(null) : json(tidy(model));

/** A list of nested models as a JSON array; an empty list is NULL, not `[]`. */
const jsonbList = (models: unknown[] | null | undefined): Json =>
  !models || !models.length ? json(null) : json(models.map(tidy));

// --------------------------------------------------------------------------
// Statement building
// --------------------------------------------------------------------------

type Row = Record<string, unknown>;

export const upsert = (table: string, row: Row, key: string | string[] = "id"): string => {
  const columns = Object.keys(row);
  const keys = typeof key === "string" ? [key] : key;
  const updates = columns.filter((column) => !keys.includes(column));
  const values = columns.map((column) => literal(row[column])).join(", ");
  const action = updates.length
    ? `DO UPDATE SET ${updates.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
    : "DO NOTHING";
  return (
    `INSERT INTO ${table} (${columns.join(", ")})\n` +
    `VALUES (${values})\n` +
    `ON CONFLICT (${keys.join(", ")}) ${action};`
  );
};

/** A list of statements with section headers, in dependency order. */
class Script {
  readonly parts: string[] = [];

  section(title: string): void {
    this.parts.push(`\n-- ${"-".repeat(70)}\n-- ${title}\n-- ${"-".repeat(70)}\n`);
  }

  add(statement: string): void {
    this.parts.push(statement);
  }

  /**
   * A comment in the script for something the projection cannot carry.
   *
   * Louder than dropping it and quieter than refusing to generate: the script
   * still runs, and a reader of the diff sees what did not survive.
   */
  note(message: string): void {
    this.parts.push(`-- NOTE: ${message}\n`);
  }

  rows(table: string, rows: Row[], key: string | string[] = "id"): void {
    for (const row of rows) this.add(upsert(table, row, key));
  }

  render(): string {
    return this.parts.join("\n") + "\n";
  }
}

// --------------------------------------------------------------------------
// The import script
// --------------------------------------------------------------------------

/** Documents before the documents that supersede them. */
const orderedDocuments = (bundle: CourseBundle): any[] => {
  const remaining = [...(bundle.documents as any[])];
  const emitted = new Set<string>();
  const ordered: any[] = [];
  while (remaining.length) {
    let progressed = false;
    for (const document of [...remaining]) {
      if (!document.supersedes || emitted.has(document.supersedes)) {
        ordered.push(document);
        emitted.add(document.document_id);
        remaining.splice(remaining.indexOf(document), 1);
        progressed = true;
      }
    }
    // A cycle; the validator would already have complained.
    if (!progressed) return [...ordered, ...remaining];
  }
  return ordered;
};

/**
 * Delete design rows this course no longer defines.
 *
 * Only design-time tables. Runtime tables hold student work and are owned by the
 * application, not by the repository — deleting a submission because it is
 * absent from a YAML file would be indefensible.
 */
const prune = (bundle: CourseBundle): string => {
  const versionIds = (bundle.versions as any[]).map((v) => uuid(v.course_version_id));
  if (!versionIds.length) return "-- no course versions; nothing to prune\n";
  const versions = versionIds.map(literal).join(", ");
  const keep = (codes: string[]): string =>
    codes.map((code) => literal(uuid(code))).join(", ") || "NULL";

  const statements = [
    `DELETE FROM academic.learning_outcomes\n WHERE course_version_id IN (${versions})\n   AND id NOT IN (${keep((bundle.outcomes as any[]).map((o) => o.outcome_id))});`,
    `DELETE FROM academic.modules\n WHERE course_version_id IN (${versions})\n   AND id NOT IN (${keep((bundle.modules as any[]).map((m) => m.module_id))});`,
    `DELETE FROM academic.concepts\n WHERE course_version_id IN (${versions})\n   AND id NOT IN (${keep((bundle.concepts as any[]).map((c) => c.concept_id))});`,
  ];
  return (
    "-- Design content only. Runtime tables are never pruned: student work\n" +
    "-- belongs to the application, not to this repository.\n" +
    statements.join("\n") +
    "\n"
  );
};

/** Emit the whole bundle as one transactional script. */
export const buildScript = (bundle: CourseBundle, { prune: doPrune = false } = {}): string => {
  const script = new Script();
  const course = bundle.course as any;

  script.add(
    "-- Generated by `ainar sql`. Do not edit.\n" +
      `-- Course: ${course.course_id} — ${course.title}\n` +
      "--\n" +
      "-- Identifiers are uuid5(NAMESPACE, code), so this script is idempotent:\n" +
      "-- running it twice leaves the database in the same state as running it once.\n" +
      "-- Apply the schema first:  psql -f ainar/sql/schema.sql\n",
  );
  script.add("BEGIN;\n");

  // ------------------------------------------------------------------ content
  script.section("content.documents");
  script.rows(
    "content.documents",
    orderedDocuments(bundle).map((d) => ({
      id: uuid(d.document_id),
      code: d.document_id,
      title: d.title,
      storage_key: d.storage_key,
      mime_type: d.mime_type,
      original_filename: d.original_filename,
      size_bytes: d.size_bytes,
      checksum: d.checksum,
      uploaded_by: d.uploaded_by,
      created_at: d.created_at,
      version: d.version,
      supersedes_id: ref(d.supersedes),
      generated_by: jsonb(d.generated_by),
      presentation_plan: jsonb(d.presentation_plan),
      extensions: d.extensions,
    })),
  );

  // ----------------------------------------------------------------- academic
  script.section("academic — the stable definition");
  script.rows("academic.courses", [
    {
      id: uuid(course.course_id),
      code: course.course_id,
      title: course.title,
      description: course.description,
      credits: real(course.credits),
      department: course.department,
      language: course.language,
      status: course.status,
      owner_code: course.owner,
      extensions: course.extensions,
    },
  ]);
  script.rows(
    "academic.capabilities",
    (bundle.capabilities as any[]).map((c) => ({
      id: uuid(c.capability_id),
      code: c.capability_id,
      title: c.title,
      description: c.description,
      domain: c.domain,
      levels: jsonbList(c.levels),
      extensions: c.extensions,
    })),
  );

  // Typed edges authored in `concept-edges.yaml` fold into the same arrays.
  // `part_of` and `refines` cannot be represented once the junction table is
  // gone; nothing in this repository authors one, and `unrepresentable` names
  // any that appear rather than discarding them quietly.
  const extraPrerequisites = new Map<string, Set<string>>();
  const extraRelated = new Map<string, Set<string>>();
  const unrepresentable: string[] = [];
  const into = (map: Map<string, Set<string>>, key: string, value: string): void => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  for (const edge of bundle.concept_edges as any[]) {
    const kind = edge.relationship_type;
    if (kind === "prerequisite_of") into(extraPrerequisites, edge.target_concept_id, edge.source_concept_id);
    else if (kind === "related_to") into(extraRelated, edge.source_concept_id, edge.target_concept_id);
    else unrepresentable.push(`${edge.source_concept_id} ${kind} ${edge.target_concept_id}`);
  }
  if (unrepresentable.length) {
    script.note("concept edges with no column to land in: " + unrepresentable.join("; "));
  }

  const union = (authored: string[], extra: Set<string> | undefined): string[] =>
    [...new Set([...authored, ...(extra ?? [])])].sort();

  script.rows(
    "academic.concepts",
    (bundle.concepts as any[]).map((c) => ({
      id: uuid(c.concept_id),
      code: c.concept_id,
      title: c.title,
      description: c.description,
      course_id: ref(c.course_id),
      aliases: c.aliases,
      prerequisite_codes: union(c.prerequisites, extraPrerequisites.get(c.concept_id)),
      related_codes: union(c.related, extraRelated.get(c.concept_id)),
      extensions: c.extensions,
    })),
  );
  script.rows(
    "academic.learning_outcomes",
    (bundle.outcomes as any[]).map((o) => ({
      id: uuid(o.outcome_id),
      code: o.outcome_id,
      course_id: uuid(o.course_id),
      title: o.title,
      description: o.description,
      cognitive_levels: o.level,
      weight: real(o.weight),
      concept_codes: [...o.concepts],
      capability_codes: [...o.capabilities],
      extensions: o.extensions,
    })),
  );
  script.rows(
    "academic.modules",
    (bundle.modules as any[]).map((m) => ({
      id: uuid(m.module_id),
      code: m.module_id,
      course_id: uuid(m.course_id),
      title: m.title,
      description: m.description,
      week: m.week,
      ordering: m.order,
      estimated_hours: real(m.estimated_hours),
      outcome_codes: [...m.outcomes],
      concept_codes: [...m.concepts],
      extensions: m.extensions,
    })),
  );

  // ----------------------------------------------------------------- delivery
  script.section("delivery — one semester");
  script.rows(
    "delivery.users",
    (bundle.users as any[]).map((u) => ({
      id: uuid(u.user_id),
      code: u.user_id,
      display_name: u.display_name,
      email: u.email,
      role: u.role,
      external_ids: u.external_ids,
      extensions: u.extensions,
    })),
  );
  script.rows(
    "delivery.course_versions",
    (bundle.versions as any[]).map((r) => ({
      id: uuid(r.course_version_id),
      code: r.course_version_id,
      course_id: uuid(r.course_id),
      term: r.term,
      start_date: r.start_date,
      end_date: r.end_date,
      timezone: r.timezone,
      status: r.status,
      lms_course_id: r.lms_course_id,
      section: r.section,
      expected_enrollment: r.expected_enrollment,
      approved_by: r.approved_by,
      syllabus_document_id: ref(r.syllabus_document_id),
      notes: r.notes,
      extensions: r.extensions,
    })),
  );
  script.rows(
    "delivery.run_staff",
    (bundle.versions as any[]).flatMap((r) =>
      (
        [
          ["instructor", r.instructors],
          ["assistant", r.assistants],
        ] as [string, string[]][]
      ).flatMap(([role, people]) =>
        people.map((u) => ({
          course_run_id: uuid(r.course_version_id),
          user_id: uuid(u),
          role,
        })),
      ),
    ),
    ["course_run_id", "user_id", "role"],
  );
  script.rows(
    "delivery.enrollments",
    (bundle.enrollments as any[]).map((e) => ({
      id: uuid(e.enrollment_id),
      code: e.enrollment_id,
      course_run_id: uuid(e.course_version_id),
      student_code: e.student_id,
      role: e.role,
      status: e.status,
      student_group: e.group,
      extensions: e.extensions,
    })),
  );
  script.rows(
    "delivery.resources",
    (bundle.resources as any[]).map((r) => ({
      id: uuid(r.resource_id),
      code: r.resource_id,
      title: r.title,
      kind: r.kind,
      course_run_id: ref(r.course_version_id),
      course_id: ref(r.course_id),
      document_id: ref(r.document_id),
      url: r.url,
      description: r.description,
      required: r.required,
      extensions: r.extensions,
    })),
  );
  script.rows(
    "delivery.resource_concepts",
    (bundle.resources as any[]).flatMap((r) =>
      (r.concepts as string[]).map((c) => ({
        resource_id: uuid(r.resource_id),
        concept_id: uuid(c),
      })),
    ),
    ["resource_id", "concept_id"],
  );
  script.rows(
    "delivery.learning_activities",
    (bundle.activities as any[]).map((a) => ({
      id: uuid(a.activity_id),
      code: a.activity_id,
      course_run_id: uuid(a.course_version_id),
      module_id: ref(a.module_id),
      activity_type: a.type,
      title: a.title,
      description: a.description,
      scheduled_at: a.scheduled_at,
      duration_minutes: a.duration_minutes,
      location: a.location,
      preparation: a.preparation,
      extensions: a.extensions,
    })),
  );
  for (const [table, field, column] of [
    ["delivery.activity_outcomes", "outcomes", "outcome_id"],
    ["delivery.activity_concepts", "concepts", "concept_id"],
    ["delivery.activity_resources", "resources", "resource_id"],
  ] as [string, string, string][]) {
    script.rows(
      table,
      (bundle.activities as any[]).flatMap((a) =>
        (a[field] as string[]).map((value) => ({
          activity_id: uuid(a.activity_id),
          [column]: uuid(value),
        })),
      ),
      ["activity_id", column],
    );
  }

  // --------------------------------------------------------------- assessment
  script.section("assessment — how learning is measured");
  const rubrics = [...allRubrics(bundle).values()];
  script.rows(
    "assessment.rubrics",
    rubrics.map((r) => ({
      id: uuid(r.rubric_id),
      code: r.rubric_id,
      title: r.title,
      description: r.description,
      extensions: r.extensions,
    })),
  );
  script.rows(
    "assessment.assessments",
    (bundle.assessments as any[]).map((a) => ({
      id: uuid(a.assessment_id),
      code: a.assessment_id,
      course_run_id: uuid(a.course_version_id),
      module_id: ref(a.module_id),
      rubric_id: ref(a.rubric_id),
      title: a.title,
      assessment_type: a.type,
      description: a.description,
      maximum_score: real(a.maximum_score),
      weight: real(a.weight),
      opens_at: a.opens_at,
      due_at: a.due_at,
      submission_type: a.submission_type,
      delivery: a.delivery ?? null,
      instructions_document_id: ref(a.instructions_document_id),
      settings: a.settings,
      design: jsonb(a.design),
      extensions: a.extensions,
    })),
  );
  script.rows(
    "assessment.assessment_outcomes",
    (bundle.assessments as any[]).flatMap((a) =>
      (a.outcomes as string[]).map((o) => ({
        assessment_id: uuid(a.assessment_id),
        outcome_id: uuid(o),
      })),
    ),
    ["assessment_id", "outcome_id"],
  );

  const criteria = rubrics.flatMap((r) => r.criteria as any[]);
  script.rows(
    "assessment.rubric_criteria",
    criteria.map((c) => ({
      id: uuid(c.criterion_id),
      code: c.criterion_id,
      rubric_id: uuid(c.rubric_id),
      title: c.title,
      description: c.description,
      maximum_score: real(c.maximum_score),
      levels: jsonbList(c.levels),
      weight: real(c.weight),
      outcome_id: ref(c.outcome_id),
      capability_id: ref(c.capability_id),
      extensions: c.extensions,
    })),
  );
  script.rows(
    "assessment.criterion_concepts",
    criteria.flatMap((c) =>
      (c.concepts as string[]).map((concept) => ({
        criterion_id: uuid(c.criterion_id),
        concept_id: uuid(concept),
      })),
    ),
    ["criterion_id", "concept_id"],
  );
  script.rows(
    "assessment.item_models",
    (bundle.item_models as any[]).map((m) => ({
      id: uuid(m.item_model_id),
      code: m.item_model_id,
      course_run_id: uuid(m.course_version_id),
      title: m.title,
      outcome_id: ref(m.outcome_id),
      capability_id: ref(m.capability_id),
      cognitive_level: m.cognitive_level,
      evidence_requirements: m.evidence_requirements,
      task_structure: m.task_structure,
      scenario_variables: m.scenario_variables,
      difficulty_features: m.difficulty_features,
      answer_requirements: m.answer_requirements,
      allowed_item_types: m.allowed_item_types,
      extensions: m.extensions,
    })),
  );
  script.rows(
    "assessment.item_model_concepts",
    (bundle.item_models as any[]).flatMap((m) =>
      (
        [
          ["construct", m.concepts],
          ["misconception", m.misconceptions],
        ] as [string, string[]][]
      ).flatMap(([role, values]) =>
        values.map((concept) => ({
          item_model_id: uuid(m.item_model_id),
          concept_id: uuid(concept),
          role,
        })),
      ),
    ),
    ["item_model_id", "concept_id", "role"],
  );
  script.rows(
    "assessment.assessment_items",
    (bundle.items as any[]).map((i) => ({
      id: uuid(i.item_id),
      code: i.item_id,
      assessment_id: uuid(i.assessment_id),
      item_model_id: ref(i.item_model_id),
      criterion_id: ref(i.criterion_id),
      outcome_id: ref(i.outcome_id),
      item_number: i.number,
      item_type: i.type,
      prompt: i.prompt,
      maximum_score: real(i.maximum_score),
      item_role: i.role,
      difficulty: i.difficulty ?? null,
      answer_key: i.answer_key,
      marking_guidance: i.marking_guidance,
      extensions: i.extensions,
    })),
  );
  script.rows(
    "assessment.item_concepts",
    (bundle.items as any[]).flatMap((i) =>
      (i.concepts as string[]).map((c) => ({ item_id: uuid(i.item_id), concept_id: uuid(c) })),
    ),
    ["item_id", "concept_id"],
  );
  script.rows(
    "assessment.item_options",
    (bundle.items as any[]).flatMap((i) =>
      (i.options as any[]).map((option) => ({
        item_id: uuid(i.item_id),
        label: option.label,
        body: option.text,
        is_correct: option.correct,
        indicates_misconception_of: ref(option.indicates_misconception_of),
        note: option.note,
      })),
    ),
    ["item_id", "label"],
  );
  script.rows(
    "assessment.submissions",
    (bundle.submissions as any[]).map((s) => ({
      id: uuid(s.submission_id),
      code: s.submission_id,
      assessment_id: uuid(s.assessment_id),
      student_code: s.student_id,
      submitted_at: s.submitted_at,
      status: s.status,
      attempt: s.attempt,
      note: s.note,
      extensions: s.extensions,
    })),
  );
  script.rows(
    "assessment.submission_files",
    (bundle.submissions as any[]).flatMap((s) =>
      (s.files as any[]).map((f) => ({
        submission_id: uuid(s.submission_id),
        document_id: uuid(f.document_id),
        file_type: f.type,
      })),
    ),
    ["submission_id", "document_id"],
  );
  script.rows(
    "assessment.item_responses",
    (bundle.item_responses as any[]).map((r) => ({
      id: uuid(r.response_id),
      code: r.response_id,
      submission_id: uuid(r.submission_id),
      item_id: uuid(r.item_id),
      student_code: r.student_id,
      chosen_options: r.chosen_options,
      raw_response: r.raw_response,
      score: real(r.score),
      correct: r.correct,
      scored_by: r.scored_by,
      responded_at: r.responded_at,
      extensions: r.extensions,
    })),
  );
  script.rows(
    "assessment.evaluations",
    (bundle.evaluations as any[]).map((e) => ({
      id: uuid(e.evaluation_id),
      code: e.evaluation_id,
      submission_id: uuid(e.submission_id),
      criterion_id: uuid(e.criterion_id),
      status: e.status,
      suggested_score: real(e.ai_suggestion ? e.ai_suggestion.score : null),
      suggested_confidence: real(e.ai_suggestion ? e.ai_suggestion.confidence : null),
      suggested_comment: e.ai_suggestion ? e.ai_suggestion.comment : null,
      suggested_evidence: jsonbList(e.ai_suggestion ? e.ai_suggestion.evidence : null),
      suggestion_provenance: jsonb(e.ai_suggestion ? e.ai_suggestion.provenance : null),
      decided_score: real(e.professor_decision ? e.professor_decision.score : null),
      decision_comment: e.professor_decision ? e.professor_decision.comment : null,
      decided_by: e.professor_decision ? e.professor_decision.decided_by : null,
      decided_at: e.professor_decision ? e.professor_decision.decided_at : null,
      extensions: e.extensions,
    })),
  );

  // ----------------------------------------------------------------- learning
  script.section("learning — what students demonstrated");
  script.rows(
    "learning.evidence",
    (bundle.evidence as any[]).map((e) => ({
      id: uuid(e.evidence_id),
      code: e.evidence_id,
      student_code: e.student_id,
      course_run_id: uuid(e.course_version_id),
      source_type: e.source_type,
      source_code: e.source_id,
      outcome_id: ref(e.outcome_id),
      capability_id: ref(e.capability_id),
      concept_id: ref(e.concept_id),
      demonstrated_level: e.demonstrated_level,
      confidence: real(e.confidence),
      verified_by: e.verified_by,
      recorded_at: e.recorded_at,
      provenance: jsonb(e.provenance),
      extensions: e.extensions,
    })),
  );
  script.rows(
    "learning.concept_states",
    (bundle.concept_states as any[]).map((s) => ({
      student_code: s.student_id,
      concept_id: uuid(s.concept_id),
      course_run_id: uuid(s.course_version_id),
      state: s.state,
      mastery_estimate: real(s.mastery_estimate),
      evidence_codes: s.evidence_ids,
      last_updated_at: s.last_updated_at,
      provenance: jsonb(s.provenance),
      extensions: s.extensions,
    })),
    ["student_code", "concept_id", "course_run_id"],
  );
  script.rows(
    "learning.capability_states",
    (bundle.capability_states as any[]).map((s) => ({
      student_code: s.student_id,
      capability_id: uuid(s.capability_id),
      course_run_id: ref(s.course_version_id),
      level: s.level,
      source_count: s.source_count,
      evidence_codes: s.evidence_ids,
      confidence: real(s.confidence),
      verified_by: s.verified_by,
      last_updated_at: s.last_updated_at,
      provenance: jsonb(s.provenance),
      extensions: s.extensions,
    })),
    ["student_code", "capability_id"],
  );
  script.rows(
    "learning.signals",
    (bundle.signals as any[]).map((s) => ({
      id: uuid(s.signal_id),
      code: s.signal_id,
      student_code: s.student_id,
      course_run_id: uuid(s.course_version_id),
      signal_type: s.type,
      severity: s.severity,
      description: s.description,
      evidence_codes: s.evidence_ids,
      status: s.status,
      detected_at: s.detected_at,
      provenance: jsonb(s.provenance),
      extensions: s.extensions,
    })),
  );
  script.rows(
    "learning.signal_concepts",
    (bundle.signals as any[]).flatMap((s) =>
      (s.concepts as string[]).map((c) => ({ signal_id: uuid(s.signal_id), concept_id: uuid(c) })),
    ),
    ["signal_id", "concept_id"],
  );
  script.rows(
    "learning.interventions",
    (bundle.interventions as any[]).map((i) => ({
      id: uuid(i.intervention_id),
      code: i.intervention_id,
      signal_id: ref(i.signal_id),
      student_code: i.student_id,
      course_run_id: uuid(i.course_version_id),
      intervention_type: i.type,
      description: i.description,
      proposed_by: i.proposed_by,
      approved_by: i.approved_by,
      status: i.status,
      scheduled_at: i.scheduled_at,
      completed_at: i.completed_at,
      effectiveness_note: i.effectiveness_note,
      extensions: i.extensions,
    })),
  );

  // ------------------------------------------------------------------ harness
  script.section("harness — events and the professor's inbox");
  script.rows(
    "learning.events",
    (bundle.events as any[]).map((e) => ({
      id: uuid(e.event_id),
      code: e.event_id,
      event_type: e.event_type,
      course_run_id: uuid(e.course_version_id),
      entity_type: e.entity_type,
      entity_code: e.entity_id,
      occurred_at: e.occurred_at,
      payload: e.payload,
      extensions: e.extensions,
    })),
  );
  script.rows(
    "learning.action_items",
    (bundle.action_items as any[]).map((a) => ({
      id: uuid(a.action_id),
      code: a.action_id,
      course_run_id: uuid(a.course_version_id),
      assigned_to: uuid(a.assigned_to),
      action_type: a.type,
      title: a.title,
      description: a.description,
      priority: a.priority,
      source_event_id: ref(a.source_event_id),
      source_codes: a.source_refs,
      status: a.status,
      due_at: a.due_at,
      available_actions: a.available_actions,
      provenance: jsonb(a.provenance),
      extensions: a.extensions,
    })),
  );

  // One storage-neutral read model for the engine. It is written last, inside
  // the same transaction as the relational projection, so readers never see a
  // bundle describing rows that did not commit.
  script.section("read model — one CourseBundle for YAML/PostgreSQL parity");
  script.rows(
    "content.course_bundle_read_models",
    [
      {
        course_code: course.course_id,
        format_version: "1",
        payload: json(bundlePayload(bundle)),
      },
    ],
    "course_code",
  );

  if (doPrune) {
    script.section("prune — design content removed from the repository");
    script.add(prune(bundle));
  }

  script.add("\nCOMMIT;");
  return script.render();
};

/**
 * The DDL, read from `src/sql/schema.sql`.
 *
 * Hand-written and reviewed rather than generated: it is the contract between
 * this workspace and the application, and a contract should be readable.
 */
export const schemaSql = (): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sql", "schema.sql"), "utf-8");
