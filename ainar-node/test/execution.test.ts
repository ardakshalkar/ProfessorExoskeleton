import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ACTIONS, resolveExecution } from "../src/execution.ts";

test("action names are unique", () => {
  assert.equal(new Set(ACTIONS.map(({ name }) => name)).size, ACTIONS.length);
});

test("judgement remains a skill with or without a backend", () => {
  for (const backendAvailable of [false, true]) {
    const plan = resolveExecution("design-assessment", { backendAvailable, actor: "agent" });
    assert.equal(plan.available, true);
    if (plan.available) assert.equal(plan.target, "skill");
  }
});

test("portable computation prefers backend state and falls back to local files", () => {
  const online = resolveExecution("gradebook", { backendAvailable: true, actor: "agent" });
  const offline = resolveExecution("gradebook", { backendAvailable: false, actor: "agent" });
  assert.equal(online.available && online.target, "backend");
  assert.equal(offline.available && offline.target, "local");
});

test("explicit file rendering stays local", () => {
  const plan = resolveExecution("render-deck", { backendAvailable: true, actor: "agent" });
  assert.equal(plan.available && plan.target, "local");
});

test("an agent cannot approve through either execution path", () => {
  for (const backendAvailable of [false, true]) {
    const plan = resolveExecution("approve", { backendAvailable, actor: "agent" });
    assert.equal(plan.available, false);
    if (!plan.available) assert.match(plan.reason, /human decision/);
  }
});

test("a human can approve locally in personal mode and through a backend in shared mode", () => {
  const personal = resolveExecution("approve", { backendAvailable: false, actor: "human" });
  const shared = resolveExecution("approve", { backendAvailable: true, actor: "human" });
  assert.equal(personal.available && personal.target, "local");
  assert.equal(shared.available && shared.target, "backend");
});

test("credentialled integrations never fall back to local execution", () => {
  const offline = resolveExecution("lms-push-grades", {
    backendAvailable: false,
    actor: "human",
  });
  assert.equal(offline.available, false);

  const online = resolveExecution("lms-push-grades", {
    backendAvailable: true,
    actor: "human",
  });
  assert.equal(online.available && online.target, "backend");
});

test("Telegram publication is a human-confirmed backend action", () => {
  const agent = resolveExecution("telegram-publish", { backendAvailable: true, actor: "agent" });
  const human = resolveExecution("telegram-publish", { backendAvailable: true, actor: "human" });
  const offline = resolveExecution("telegram-publish", { backendAvailable: false, actor: "human" });
  assert.equal(agent.available, false);
  assert.equal(human.available && human.target, "backend");
  assert.equal(offline.available, false);
});

test("an agent may read an integration through the backend but not without it", () => {
  const online = resolveExecution("notion-pull", {
    backendAvailable: true,
    actor: "agent",
  });
  assert.equal(online.available && online.target, "backend");

  const offline = resolveExecution("notion-pull", {
    backendAvailable: false,
    actor: "agent",
  });
  assert.equal(offline.available, false);
});
