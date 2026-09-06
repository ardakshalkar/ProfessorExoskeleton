/**
 * The model, described from the model. Ported from `ainar schema`.
 *
 * Two audiences, two shapes:
 *
 * **JSON Schema**, which is what Python's `ainar schema` writes — one file per
 * entity plus a bundle envelope — for a tool that consumes schemas.
 *
 * **A compact field list**, which is what a person or a model reading a prompt
 * needs: name, type, required or not, the enum's members, the pattern an
 * identifier must match. On 2026-09-06 an agent asked to start a new course
 * answered "what shape is `course.yaml`" by searching the whole of `Documents`
 * for another workspace and copying its files — then minted `ITB3004`, which
 * `CourseId` refuses, because nothing had told it identifiers carry a dash.
 * That question has an answer in this repository and now it has a command.
 *
 * ## Why this is derived and not written down
 *
 * The obvious alternative was a page of Markdown in a skill listing the fields.
 * It would have been quicker and it would rot: `common.ts` changes, the page
 * does not, and a scaffolding instruction that is quietly wrong is worse than
 * none — the agent trusts it and writes records that fail validation. Every
 * line below is read out of the Zod schema at run time, so the command cannot
 * disagree with the validator. If a field moves, this moves.
 *
 * ## What it does not do
 *
 * Python writes the JSON Schema Pydantic generates. This writes the JSON Schema
 * `zod-to-json-schema` generates from the equivalent Zod. The two describe the
 * same records and are not byte-identical — different generators name their
 * `$defs` differently and disagree about where to put a default. Nothing
 * compares them, and nothing should: neither output is a record, and the
 * validator both halves share is the thing already held to parity.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  Capability,
  Concept,
  ConceptEdge,
  Course,
  LearningOutcome,
  Module,
} from "./model/academic.ts";
import {
  Assessment,
  AssessmentItem,
  Evaluation,
  ItemModel,
  ItemResponse,
  Rubric,
  Submission,
} from "./model/assessment.ts";
import { Document } from "./model/content.ts";
import {
  CourseVersion,
  Enrollment,
  LearningActivity,
  Resource,
  User,
} from "./model/delivery.ts";
import { ActionItem, CourseEvent } from "./model/harness.ts";
import {
  Intervention,
  LearningEvidence,
  StudentCapabilityState,
  StudentConceptState,
  StudentSignal,
} from "./model/learning.ts";

/**
 * Every entity, under the name a draft file and a record directory use.
 *
 * Keyed by collection name rather than by class name, because that is the name
 * a caller has in their hand: they are looking at `assessments:` in a YAML file
 * and want to know what goes under it.
 */
export const SCHEMA_MODELS: Record<string, z.ZodTypeAny> = {
  course: Course,
  outcomes: LearningOutcome,
  concepts: Concept,
  concept_edges: ConceptEdge,
  capabilities: Capability,
  modules: Module,
  versions: CourseVersion,
  enrollments: Enrollment,
  activities: LearningActivity,
  documents: Document,
  resources: Resource,
  assessments: Assessment,
  rubrics: Rubric,
  items: AssessmentItem,
  item_models: ItemModel,
  submissions: Submission,
  item_responses: ItemResponse,
  evaluations: Evaluation,
  evidence: LearningEvidence,
  concept_states: StudentConceptState,
  capability_states: StudentCapabilityState,
  signals: StudentSignal,
  interventions: Intervention,
  events: CourseEvent,
  action_items: ActionItem,
  users: User,
};

export const SCHEMA_NAMES: string[] = Object.keys(SCHEMA_MODELS).sort();

export interface Field {
  name: string;
  type: string;
  required: boolean;
  /** Present when the value is constrained to a list. */
  values?: string[];
  /** Present when a string must match one. */
  pattern?: string;
  /** Present when omitting the field is not the same as leaving it empty. */
  default?: string;
}

/**
 * Zod 3 and Zod 4 at once, because this repository runs both.
 *
 * `ainar-node` resolves zod 3.25 from its own `node_modules`; the vendored
 * plugin resolves 4.5 from the root. Same source, two majors, and they disagree
 * about every internal this file reads: v3 tags a schema with `_def.typeName`
 * ("ZodObject") and makes `_def.shape` a function, v4 tags it with `_def.type`
 * ("object") and makes `shape` a plain object. A walker written for one returns
 * null on the other, silently, which is how the first version of this passed
 * its own tests and answered nothing in the pane.
 *
 * So every read below asks both questions. The alternative — pinning one major
 * — is a real fix and a much larger one, and it belongs in a change of its own.
 */
const kindOf = (schema: any): string => {
  const def = schema?._def;
  if (!def) return "unknown";
  // v3: "ZodString". v4: "string".
  const tag = def.typeName ?? def.type;
  return String(tag ?? "unknown").replace(/^Zod/, "").toLowerCase();
};

const innerOf = (schema: any): any => schema?._def?.innerType ?? schema?._def?.schema ?? schema?._def?.type;

/**
 * Peel the wrappers Zod puts around a type until the type itself is reached.
 *
 * `.default()`, `.nullish()`, `.optional()` and the rest each wrap the schema
 * in another object rather than setting a flag, so a field declared
 * `Weight.nullish()` is three deep. The peeling is what turns that back into
 * "a number, not required".
 */
const unwrap = (schema: any): { inner: any; optional: boolean; fallback?: string } => {
  let current = schema;
  let optional = false;
  let fallback: string | undefined;
  for (let guard = 0; guard < 12; guard += 1) {
    const kind = kindOf(current);
    if (kind === "optional" || kind === "nullable") {
      optional = true;
      current = innerOf(current);
    } else if (kind === "default" || kind === "prefault") {
      optional = true;
      if (fallback === undefined) {
        const raw = current._def.defaultValue;
        try {
          fallback = JSON.stringify(typeof raw === "function" ? raw() : raw);
        } catch {
          fallback = undefined;
        }
      }
      current = innerOf(current);
    } else if (kind === "effects" || kind === "branded" || kind === "readonly" || kind === "catch" || kind === "pipe") {
      current = current._def.schema ?? current._def.innerType ?? current._def.out ?? current._def.type;
    } else {
      break;
    }
    if (!current) break;
  }
  return { inner: current, optional, fallback };
};

/** The regular expression a string must match, under either major. */
const patternOf = (schema: any): string | undefined => {
  const checks = schema?._def?.checks ?? [];
  for (const check of checks) {
    // v3: { kind: "regex", regex }. v4: { _zod: { def: { pattern } } }.
    if (check?.kind === "regex" && check.regex) return String(check.regex.source);
    const pattern = check?._zod?.def?.pattern;
    if (pattern) return String(pattern.source ?? pattern);
  }
  return undefined;
};

/** The members of an enum, under either major. */
const valuesOf = (schema: any): string[] | undefined => {
  const def = schema?._def;
  if (!def) return undefined;
  if (Array.isArray(def.values)) return def.values.map(String);
  if (def.entries) return Object.values(def.entries).map(String);
  if (def.values instanceof Set) return [...def.values].map(String);
  if (def.values && typeof def.values === "object") return Object.values(def.values).map(String);
  return undefined;
};

/** What to call a type in one word, and what else is worth saying about it. */
const describe = (schema: any): { type: string; values?: string[]; pattern?: string } => {
  const kind = kindOf(schema);
  switch (kind) {
    case "string":
      return { type: "string", pattern: patternOf(schema) };
    case "number": {
      const checks = schema?._def?.checks ?? [];
      const isInt =
        checks.some((c: any) => c?.kind === "int") ||
        checks.some((c: any) => c?._zod?.def?.format === "safeint");
      return { type: isInt ? "integer" : "number" };
    }
    case "boolean":
      return { type: "boolean" };
    case "enum":
      return { type: "enum", values: valuesOf(schema) };
    case "nativeenum":
      return { type: "enum", values: valuesOf(schema) };
    case "literal": {
      const def = schema._def;
      const one = def.value ?? (Array.isArray(def.values) ? def.values[0] : undefined);
      return { type: "literal", values: one === undefined ? undefined : [String(one)] };
    }
    case "array": {
      const element = schema._def.element ?? schema._def.type;
      const item = describe(unwrap(element).inner);
      return { type: `list of ${item.type}`, values: item.values, pattern: item.pattern };
    }
    case "record":
      return { type: "mapping" };
    case "object":
      return { type: "object" };
    case "union": {
      const options = schema._def.options ?? [];
      return { type: options.map((o: any) => describe(unwrap(o).inner).type).join(" or ") };
    }
    case "unknown":
    case "any":
      return { type: "any" };
    default:
      return { type: kind };
  }
};

/**
 * One entity as a list of fields.
 *
 * Returns null for a name that is not an entity, rather than throwing, so a
 * caller listing several can report the miss beside the hits.
 */
export const shapeOf = (name: string): Field[] | null => {
  const model = SCHEMA_MODELS[name];
  if (!model) return null;
  const { inner } = unwrap(model);
  const raw = (inner as any)?._def?.shape;
  // v3 hands back a factory; v4 hands back the object itself.
  const shape = typeof raw === "function" ? raw() : raw;
  if (!shape || typeof shape !== "object") return null;
  const fields: Field[] = [];
  for (const [key, value] of Object.entries(shape as Record<string, any>)) {
    const { inner: bare, optional, fallback } = unwrap(value);
    const described = describe(bare);
    fields.push({
      name: key,
      type: described.type,
      required: !optional,
      values: described.values,
      pattern: described.pattern,
      default: fallback,
    });
  }
  return fields;
};

/** The compact form, as lines a person or a model can read in a terminal. */
export const shapeText = (name: string): string => {
  const fields = shapeOf(name);
  if (!fields) return `${name} is not an entity. Try one of: ${SCHEMA_NAMES.join(", ")}`;
  const lines = [`${name}:`];
  for (const field of fields) {
    const parts = [field.type];
    if (field.pattern) parts.push(`matching /${field.pattern}/`);
    if (field.values) parts.push(`one of ${field.values.join(", ")}`);
    if (field.default !== undefined) parts.push(`default ${field.default}`);
    lines.push(
      `  ${field.required ? "*" : " "} ${field.name.padEnd(24)} ${parts.join(" · ")}`,
    );
  }
  lines.push("");
  lines.push("  * required. Everything else may be omitted.");
  return lines.join("\n");
};

/** JSON Schema for one entity, which is what Python's `schema` writes. */
export const jsonSchemaFor = (name: string): unknown | null => {
  const model = SCHEMA_MODELS[name];
  if (!model) return null;
  return zodToJsonSchema(model, { name });
};
