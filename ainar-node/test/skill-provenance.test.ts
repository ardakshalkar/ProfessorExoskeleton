/**
 * PRV-2: the skills write provenance, through one shared definition —
 * `ainar-records/templates/provenance.yaml` — rather than a block of their own
 * each. This holds the template to the model the loader checks it against,
 * and every skill that drafts a record to pointing at it.
 *
 *     node --experimental-strip-types --test test/skill-provenance.test.ts
 */

import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";

import { APPROVABLE } from "../src/approval.ts";
import { COLLECTION_SPECS, type CollectionName } from "../src/collections.ts";
import { discoverCourses, loadCourse } from "../src/loader.ts";
import { Provenance } from "../src/model/common.ts";

const SKILLS = resolve(process.cwd(), "..", "plugins", "professor-course-skills", "skills");
const TEMPLATE = join(SKILLS, "ainar-records", "templates", "provenance.yaml");
const POINTER = "../ainar-records/templates/provenance.yaml";
const ROOT = resolve(process.cwd(), "..", "workspace");

/** What a skill would write into each of the template's fields. */
const FILLED: Record<string, unknown> = {
  produced_by: "/design-assessment",
  workflow_version: "2026.11.1",
  model_id: "deepseek-chat",
  input_refs: ["LO-03", "EVIDENCE-0042"],
  created_at: "2026-11-01T10:00:00+05:00",
};

const template = (): Record<string, unknown> => parse(readFileSync(TEMPLATE, "utf-8")).provenance;

const filled = (): Record<string, unknown> =>
  Object.fromEntries(Object.keys(template()).map((field) => [field, FILLED[field]]));

/** Every skill whose front matter says it drafts records, with what it produces. */
const draftingSkills = () =>
  readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const text = readFileSync(join(SKILLS, entry.name, "SKILL.md"), "utf-8");
      // Line by line: a description is free prose with colons in it, which
      // the hosts read as one line and strict YAML refuses.
      const front: Record<string, string> = {};
      for (const line of text.split(/^---\s*$/m)[1]!.split(/\r?\n/)) {
        const match = /^([a-z_]+):\s*(.*)$/.exec(line);
        if (match) front[match[1]!] = match[2]!.trim();
      }
      const produces = (front.produces ?? "").replace(/^\[|\]$/g, "").split(",").map((c) => c.trim()).filter(Boolean);
      return { name: entry.name, text, front, produces };
    })
    .filter((skill) => String(skill.front.writes ?? "").includes("drafts") && skill.produces.length);

/** Where each collection keeps the block. */
const attach = (collection: string, record: Record<string, any>, block: Record<string, unknown>) => {
  if (collection === "evaluations") return { ...record, ai_suggestion: { score: 0, ...record.ai_suggestion, provenance: block } };
  if (collection === "documents") return { ...record, generated_by: block };
  return { ...record, provenance: block };
};

test("the shared template is a placeholder for every field it names, and the model knows each one", () => {
  const block = template();
  const known = Object.keys(Provenance.shape);
  for (const [field, value] of Object.entries(block)) {
    assert.ok(known.includes(field), `the template names ${field}, which Provenance does not have`);
    assert.match(JSON.stringify(value), /\{\{.*\}\}/, `${field} in the template is a value, not a placeholder`);
    assert.ok(field in FILLED, `this test does not know how to fill ${field}`);
  }
  for (const field of ["produced_by", "workflow_version", "model_id", "input_refs", "created_at"]) {
    assert.ok(field in block, `the template has no ${field}`);
  }
});

test("the template, filled in, loads on every collection a drafting skill produces", () => {
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  const bundle = loadCourse(dir, ROOT).bundle! as any;
  const produced = new Set(draftingSkills().flatMap((skill) => skill.produces).filter((c) => APPROVABLE.includes(c)));
  assert.ok(produced.size >= 5, `only ${[...produced].join(", ")} found — is the front matter still read?`);
  for (const collection of APPROVABLE) {
    const sample = (bundle[collection] ?? [])[0];
    if (!sample) {
      assert.ok(!produced.has(collection), `a skill produces ${collection}, and the sample course has none to check it on`);
      continue;
    }
    const record = attach(collection, sample, filled());
    const loaded = COLLECTION_SPECS[collection as CollectionName].model.parse(record) as any;
    const block = collection === "evaluations" ? loaded.ai_suggestion.provenance : collection === "documents" ? loaded.generated_by : loaded.provenance;
    assert.equal(block.produced_by, "/design-assessment", collection);
    assert.equal(block.workflow_version, "2026.11.1", collection);
  }
});

test("every drafting skill has a version and points at the shared block, and nothing spells its own", () => {
  const skills = draftingSkills();
  assert.ok(skills.length >= 8, `only ${skills.length} drafting skills found`);
  for (const skill of skills) {
    const version = String(skill.front.version ?? "");
    assert.match(version, /^\d{4}\.\d{1,2}\.\d+$/, `${skill.name} has no version: (YYYY.M.N) in its front matter`);
    assert.ok(skill.text.includes(POINTER), `${skill.name} does not point at ${POINTER}`);
    for (const [, given] of skill.text.matchAll(/--workflow-version (\S+)/g)) {
      assert.equal(given, version, `${skill.name} passes --workflow-version ${given}, its front matter says ${version}`);
    }
  }
  for (const skill of readdirSync(SKILLS)) {
    for (const file of readdirSync(join(SKILLS, skill), { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || !/\.(md|ya?ml)$/.test(file.name)) continue;
      const text = readFileSync(join(file.parentPath, file.name), "utf-8");
      assert.doesNotMatch(text, /claude-code\/prototype|^\s*model_id: claude-/m, `${skill}/${file.name} spells out its own provenance`);
    }
  }
});
