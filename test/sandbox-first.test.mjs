/**
 * The sandbox-first gate, tested without a harness: a stub `ctx.on` collects
 * the two listeners and the tests drive them the way the tool registry does.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { apply } from "../plugins/dsh-professor-sandbox-first/index.js";

function mount() {
  const listeners = {};
  apply({ on: (event, listener) => void (listeners[event] = listener) });
  const allowed = { kind: "allow" };
  return {
    gate: (exec) => listeners["tools/pre-execute"](exec, () => Promise.resolve(allowed)),
    result: (exec, result) => listeners["tools/result"](exec, result),
    allowed,
  };
}

const session = (id) => ({ session: { id } });
const plain = (command, id = "s1") => ({ name: "pwsh", agent: session(id), arguments: { command, description: "run it" } });
const escalated = (command, id = "s1") => ({
  name: "pwsh",
  agent: session(id),
  arguments: { command, description: "run it wider", sandbox_permissions: "danger-full-access", justification: "because" },
});
const ok = { isError: false, value: { kind: "foreground", exitCode: 0, sandbox: { mode: "workspace-write", denied: false } } };

test("a plain call passes untouched", async () => {
  const { gate, allowed } = mount();
  assert.equal(await gate(plain("Get-Date")), allowed);
});

test("an escalation nobody refused is denied before any approval card", async () => {
  const { gate } = mount();
  const decision = await gate(escalated("Get-Date"));
  assert.equal(decision.kind, "deny");
  assert.match(decision.reason, /without sandbox_permissions/);
});

test("a confined run that worked does not unlock escalation", async () => {
  const { gate, result } = mount();
  result(plain("Get-Date"), ok);
  assert.equal((await gate(escalated("Get-Date"))).kind, "deny");
});

for (const [label, outcome] of [
  ["a sandbox denial", { isError: false, value: { exitCode: 1, sandbox: { mode: "workspace-write", denied: true } } }],
  ["a runner failure", { isError: false, value: { exitCode: null, sandbox: { mode: "workspace-write", denied: false, runnerFailed: true } } }],
  ["an error result (no sandbox backend)", { isError: true, content: [] }],
  ["a failing exit (EPERM from a piped spawn)", { isError: false, value: { exitCode: 1, sandbox: { mode: "workspace-write", denied: false } } }],
]) {
  test(`${label} unlocks the escalated retry of that same command`, async () => {
    const { gate, result, allowed } = mount();
    result(plain("bin\\deck.cmd render"), outcome);
    assert.equal(await gate(escalated("bin\\deck.cmd render")), allowed);
  });
}

const chained = (stderr) => ({
  isError: false,
  value: { exitCode: 0, stdout: { text: "=== status ===\r\n", truncated: false }, stderr: { text: stderr, truncated: false }, sandbox: { mode: "workspace-write", denied: false } },
});

for (const [label, stderr] of [
  ["Node's EPERM", "ainar.cmd : EPERM: operation not permitted, mkdir 'C:\\Users\\A\\.ainar\\submissions\\RUN\\ASSESSMENT-MIDTERM-1\\_inbox'"],
  ["PowerShell's access denied", "New-Item : Access to the path 'ASSESSMENT-MIDTERM-1' is denied."],
]) {
  test(`${label} in a chained command that exited 0 unlocks its retry (2026-10-20)`, async () => {
    const { gate, result, allowed } = mount();
    result(plain("scans file …; scans status …"), chained(stderr));
    assert.equal(await gate(escalated("scans file …; scans status …")), allowed);
  });
}

test("ordinary output with exit 0 is not a refusal", async () => {
  const { gate, result } = mount();
  result(plain("Get-Content notes.md"), chained("a note about permissions and access"));
  assert.equal((await gate(escalated("Get-Content notes.md"))).kind, "deny");
});

test("the unlock is for that command only, and that session only", async () => {
  const { gate, result } = mount();
  result(plain("bin\\deck.cmd render"), { isError: true, content: [] });
  assert.equal((await gate(escalated("Get-ChildItem"))).kind, "deny");
  assert.equal((await gate(escalated("bin\\deck.cmd render", "s2"))).kind, "deny");
});

test("description and surrounding whitespace do not make it a different call", async () => {
  const { gate, result, allowed } = mount();
  result(plain("  New-Item x  "), { isError: true, content: [] });
  assert.equal(await gate(escalated("New-Item x")), allowed);
});

test("a fresh process remembers nothing", async () => {
  mount().result(plain("Get-Date"), { isError: true, content: [] });
  assert.equal((await mount().gate(escalated("Get-Date"))).kind, "deny");
});

const A = 'C:\\Users\\A\\Development\\ProfessorExosceletonDHSPlugin\\bin\\ainar.cmd';

for (const [step, command] of [
  ["file", `& "${A}" scans file CSS-4007-2026-FALL scan-0880c27eec.pdf --assessment ASSESSMENT-QUIZ-03 --root .`],
  ["plan", `$d="C:\\x\\_inbox"; New-Item -ItemType File -Force -Path "$d\\.probe"; & "${A}" scans plan CSS-4007-2026-FALL --assessment ASSESSMENT-QUIZ-03 --root .`],
  ["names", `$A="${A}"; & $A scans names CSS-4007-2026-FALL --assessment ASSESSMENT-QUIZ-03 --root . *> $log`],
  ["apply", `& "${A}" scans apply CSS-4007-2026-FALL --assessment ASSESSMENT-QUIZ-03 --root .`],
]) {
  test(`an escalated \`scans ${step}\` is sent to scan_pile even after a refusal (2026-10-22)`, async () => {
    const { gate, result } = mount();
    result(plain(command), { isError: false, value: { exitCode: 1, sandbox: { mode: "workspace-write", denied: false } } });
    const decision = await gate(escalated(command));
    assert.equal(decision.kind, "deny");
    assert.match(decision.reason, new RegExp(`scan_pile[\\s\\S]*step: "${step}"`));
  });
}

test("an escalated scan step in the background is sent to scan_pile too", async () => {
  const { gate } = mount();
  const call = escalated(`& "${A}" scans names RUN --assessment ASSESSMENT-QUIZ-03`);
  call.arguments.run_in_background = true;
  assert.equal((await gate(call)).kind, "deny");
});

test("the plain scan step still runs, and the steps scan_pile lacks still escalate", async () => {
  const { gate, result, allowed } = mount();
  assert.equal(await gate(plain(`& "${A}" scans plan RUN --assessment X`)), allowed);
  const read = `& "${A}" scans read RUN --assessment ASSESSMENT-QUIZ-03 --root .`;
  result(plain(read), { isError: true, content: [] });
  assert.equal(await gate(escalated(read)), allowed);
});

test("background jobs are left to stock behaviour", async () => {
  const { gate, allowed } = mount();
  const call = escalated("long job");
  call.arguments.run_in_background = true;
  assert.equal(await gate(call), allowed);
});
