// The grading policy's server half against a COPY of a workspace: read,
// impact, a preset applied, lock, unlock, the changes feed, restore.
//
//   set AINAR_WORKSPACE=<a throwaway copy>
//   node --experimental-strip-types plugins/dsh-professor-pane/test/grading-policy-smoke.mjs RUN
//
// It writes. Never point it at a real course.

import { readFileSync } from "node:fs";

import {
  gradebookChanges,
  gradingImpact,
  gradingPolicy,
  historyProposal,
  writeGradingLock,
  writeGradingPolicy,
} from "../server/grading-writes.js";
import { resolveWorkspace } from "../server/workspace.js";

const RUN = process.argv[2] ?? "CSS-4007-2026-FALL";
if (!/temp|tmp|scratch/i.test(process.env.AINAR_WORKSPACE ?? "")) throw new Error("AINAR_WORKSPACE does not look like a throwaway copy.");
const { workspace, root } = resolveWorkspace({ list: () => [] }, "");
const check = (label, ok, extra) => console.log((ok ? "ok   " : "FAIL ") + label + (extra ? "  " + extra : ""));

const doc = gradingPolicy(workspace, RUN);
check("policy reads", !doc.error && doc.policy.components.length > 0, doc.base);

const preset = gradingImpact(workspace, RUN, { preset: "vsk-blocks" });
check("preset impact", !preset.error && preset.impact.errors.length === 0, preset.impact?.summary?.length + " lines");

const stale = writeGradingPolicy(workspace, root, RUN, { proposal: preset.proposal, base: "nope", acknowledged: true });
check("stale base refused", Boolean(stale.stale));

// Acknowledgement is asked only when a total moves or Canvas has marks on what changes.
const weighty = preset.impact.weighty;
const noAck = writeGradingPolicy(workspace, root, RUN, { proposal: preset.proposal, base: doc.base });
check("acknowledgement asked exactly when weighty", weighty ? noAck.needs_ack === true : noAck.written === true, noAck.error);

const wrote = noAck.written ? noAck : writeGradingPolicy(workspace, root, RUN, { proposal: preset.proposal, base: doc.base, acknowledged: true, note: "smoke" });
check("applied", wrote.written === true, wrote.error ?? wrote.path + " · " + wrote.assessments + " assessments");

const after = gradingPolicy(workspace, RUN);
check("blocks now nested", after.policy.components.some((c) => c.parent === "VSK1"), after.policy.components.map((c) => c.component_id).join(","));
check("issues after", after.issues.filter((i) => i.level === "error").length === 0, JSON.stringify(after.issues.map((i) => i.code)));
check("history kept", after.history.length === 1 && after.history[0].before);

const locked = writeGradingLock(workspace, root, RUN, { locked: true });
check("locked", locked.written === true, locked.error);
const blocked = writeGradingPolicy(workspace, root, RUN, { proposal: doc.policy, base: gradingPolicy(workspace, RUN).base, acknowledged: true });
check("write refused while locked", /locked/i.test(blocked.error ?? ""));
const badUnlock = writeGradingLock(workspace, root, RUN, { locked: false, confirm: "please" });
check("unlock needs the word", Boolean(badUnlock.error));
const unlocked = writeGradingLock(workspace, root, RUN, { locked: false, confirm: "unlock", note: "smoke" });
check("unlocked", unlocked.written === true, unlocked.error);

const feed = gradebookChanges(workspace, RUN);
check("changes feed", feed.events.filter((e) => e.kind === "policy").length === 3, feed.total + " events, kinds " + [...new Set(feed.events.map((e) => e.kind))].join(","));

const policyIndex = feed.events.find((e) => e.kind === "policy" && e.restorable).index;
const restore = historyProposal(workspace, RUN, policyIndex);
const back = gradingImpact(workspace, RUN, { proposal: restore.proposal });
const reverted = writeGradingPolicy(workspace, root, RUN, { proposal: back.proposal, base: gradingPolicy(workspace, RUN).base, acknowledged: true, note: "restore" });
check("restored", reverted.written === true, reverted.error);
const final = gradingPolicy(workspace, RUN);
check(
  "back to the original filing",
  JSON.stringify(final.policy.assignments) === JSON.stringify(doc.policy.assignments) && final.policy.components.length === doc.policy.components.length,
);

const version = readFileSync(root + "/courses/CSS-4007/version.yaml", "utf8");
console.log("\n--- version.yaml grading_scheme ---\n" + version.slice(version.indexOf("grading_scheme:"), version.indexOf("grading_scheme:") + 1400));

// The assistant's road: a proposal recorded, shown with the policy, discarded;
// another recorded and then cleared by an apply.
const { recordProposal } = await import("@ainar/core/src/grading-proposals.ts");
const { discardGradingProposal } = await import("../server/grading-writes.js");
const { loadedRun } = await import("../server/workspace.js");
const fresh = () => loadedRun(workspace, RUN).bundle;
const offer = gradingImpact(workspace, RUN, { preset: "categories" }).proposal;
const first = recordProposal(root, fresh(), RUN, offer, { request: "by kind", note: "smoke" }).entry;
const shown = gradingPolicy(workspace, RUN);
check("proposal shown with the policy", shown.proposals.length === 1 && shown.proposals[0].id === first.id && shown.proposals[0].stale === false);
check("discarded", discardGradingProposal(workspace, root, RUN, { id: first.id }).dropped === 1 && gradingPolicy(workspace, RUN).proposals.length === 0);
recordProposal(root, fresh(), RUN, offer, { request: "by kind again" });
const applied = writeGradingPolicy(workspace, root, RUN, { proposal: offer, base: gradingPolicy(workspace, RUN).base, acknowledged: true });
check("apply clears pending proposals", applied.written === true && gradingPolicy(workspace, RUN).proposals.length === 0, applied.error);
