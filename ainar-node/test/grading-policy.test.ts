/**
 * Changing the grading policy: presets laid over a course, and the impact of
 * a proposal counted by the same gradebook, scale and validator.
 *
 *     node --experimental-strip-types --test test/grading-policy.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { fromPreset, currentProposal, policyBase, policyDocument, policyImpact, presets, readProposal, withProposal } from "../src/grading-policy.ts";
import { runById } from "../src/bundle.ts";
import { Workspace } from "../src/workspace.ts";

const ROOT = fileURLToPath(new URL("../../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const plain = new Workspace(ROOT, "flag").findRun(RUN);

/** The sample course under Narxoz's ВСК policy, filed by hand the way a professor would. */
const narxoz = () => {
  const vsk = fromPreset(plain, RUN, "vsk");
  return withProposal(plain, RUN, vsk);
};

test("the policy as it stands changes nothing, and its base is stable", () => {
  const impact = policyImpact(plain, RUN, currentProposal(plain, RUN));
  assert.equal(impact.nothing, true);
  assert.deepEqual(impact.summary, ["Nothing changes."]);
  assert.equal(policyBase(plain, RUN), policyBase(plain, RUN));
});

test("every preset lays over the course without a structural error", () => {
  for (const preset of presets()) {
    const impact = policyImpact(plain, RUN, fromPreset(plain, RUN, preset.id));
    assert.equal(impact.errors.length, 0, `${preset.id}: ${impact.errors.map((e) => e.message).join("; ")}`);
  }
});

test("a preset keeps the professor's period: ВСК 1 work becomes РК 1 work, and ВСК blocks split by kind", () => {
  const course = narxoz();
  const before = currentProposal(course, RUN).assignments;
  const admission = fromPreset(course, RUN, "admission").assignments;
  const blocks = fromPreset(course, RUN, "vsk-blocks").assignments;
  for (const [id, was] of Object.entries(before)) {
    if (was.component === "VSK1") {
      assert.equal(admission[id]!.component, "RK1", id);
      assert.match(String(blocks[id]!.component), /^VSK1(-|$)/, id);
    }
    if (was.component === "VSK2") assert.equal(admission[id]!.component, "RK2", id);
  }
});

test("a block's members keep their proportions and fill it", () => {
  const proposal = fromPreset(narxoz(), RUN, "categories");
  for (const block of proposal.components) {
    const members = Object.values(proposal.assignments).filter((a) => a.component === block.component_id);
    if (!members.length) continue;
    const sum = members.reduce((total, a) => total + Number(a.weight), 0);
    assert.ok(Math.abs(sum - block.weight) < 1e-9, `${block.component_id} holds ${sum}, not ${block.weight}`);
  }
});

test("removing a block with work in it is said, and asks for acknowledgement", () => {
  const course = narxoz();
  const proposal = currentProposal(course, RUN);
  proposal.components = proposal.components.filter((c) => c.component_id !== "VSK2");
  for (const entry of Object.values(proposal.assignments)) if (entry.component === "VSK2") entry.component = null;
  const impact = policyImpact(course, RUN, proposal);
  assert.deepEqual(impact.blocks.removed, ["VSK2"]);
  assert.equal(impact.weighty, true);
  assert.ok(impact.issues.introduced.some((issue) => issue.code === "grading.component_sum"));
});

test("a proposal from the page is checked field by field", () => {
  const ok = currentProposal(narxoz(), RUN);
  assert.throws(() => readProposal(plain, RUN, { ...ok, components: [{ component_id: "1BAD", title: "x", weight: 0.1 }] }), /not a block id/);
  assert.throws(() => readProposal(plain, RUN, { ...ok, components: [{ component_id: "A", title: "x", weight: 2 }] }), /between 0% and 100%/);
  assert.throws(() => readProposal(plain, RUN, { ...ok, components: [{ component_id: "A", title: "x", weight: 0.1, parent: "NOPE" }] }), /not a block/);
  assert.throws(() => readProposal(plain, RUN, { components: [], assignments: { "ASSESSMENT-NOPE": { component: null, weight: 0.1 } } }), /not an assessment/);
});

test("the document carries presets without their filing rules, and the lock", () => {
  const doc = policyDocument(plain, RUN);
  assert.equal(doc.locked, false);
  assert.ok(doc.presets.every((preset) => preset.components.every((c: any) => !("takes" in c))));
  const run = runById(plain).get(RUN) as any;
  assert.equal(doc.has_scheme, Boolean(run.grading_scheme));
});

// ---------------------------------------------------------------- proposals

import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dropProposals, proposalsOf, recordProposal } from "../src/grading-proposals.ts";

/** A throwaway copy of the sample workspace, so a proposal can be written. */
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "gp-"));
  cpSync(ROOT, dir, { recursive: true });
  return dir;
};

test("a proposal is checked, recorded beside the policy, and taken back — the policy never moves", () => {
  const dir = scratch();
  const load = () => new Workspace(dir, "flag").findRun(RUN);
  const before = currentProposal(load(), RUN);
  const proposal = fromPreset(load(), RUN, "vsk");
  const { entry } = recordProposal(dir, load(), RUN, proposal, { request: "ВСК please", note: "Two halves and a final." });
  assert.match(entry.id, /^P-[0-9A-F]{8}$/);
  assert.ok(entry.summary.length > 0);
  const after = load();
  assert.deepEqual(currentProposal(after, RUN), before, "recording a proposal changes nothing about the policy");
  assert.equal(proposalsOf(after, RUN).length, 1);
  assert.equal(proposalsOf(after, RUN)[0]!.request, "ВСК please");

  assert.throws(() => recordProposal(dir, after, RUN, currentProposal(after, RUN)), /changes nothing/);
  assert.throws(
    () => recordProposal(dir, after, RUN, { components: [{ component_id: "A", title: "a", weight: 1, parent: "A" }], assignments: {} }),
    /would not hold together|inside itself/,
  );
  assert.equal(proposalsOf(load(), RUN).length, 1, "a refused proposal writes nothing");

  assert.equal(dropProposals(dir, load(), RUN, entry.id).dropped, 1);
  assert.equal(proposalsOf(load(), RUN).length, 0);
});
