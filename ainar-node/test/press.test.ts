/**
 * GRD-3: who is asking (src/press.ts) and the decision ledger
 * (src/decision-ledger.ts).
 *
 *     node --experimental-strip-types --test test/press.test.ts
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

process.env.AINAR_PRESS_DIR = mkdtempSync(join(tmpdir(), "ainar-press-"));

const { AGENT_MARKS, PRESS_TTL_MS, decidesOrSends, pressDir, refusal, sameInput, signPress, whoIsAsking } = await import("../src/press.ts");
const { auditDecisions, recordDecisions } = await import("../src/decision-ledger.ts");
const { discoverCourses, loadCourse } = await import("../src/loader.ts");

const ROOT = resolve(process.cwd(), "..", "workspace");
const RUN = "CSS-4008-2026-FALL";
const DECIDE = ["grade", "decide", RUN, "--assessment", "ASSESSMENT-01", "--decisions", "-", "--root", "/w"];

/** An environment with no assistant shell's marks in it, whatever the test runner's has. */
const plain = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of [...Object.keys(AGENT_MARKS), "AINAR_PRESS"]) delete env[name];
  return { ...env, ...extra };
};

const positional = (argv: string[]): string[] => argv.filter((word, at) => !word.startsWith("--") && !(argv[at - 1] ?? "").startsWith("--"));

test("the commands that decide, hold, curve or send a grade are named; the rest are not", () => {
  const named = (line: string) => {
    const argv = line.split(" ");
    return decidesOrSends(positional(argv), argv);
  };
  assert.equal(named(`grade decide ${RUN} --assessment A`), "grade decide");
  assert.equal(named(`defence mark ${RUN} --assessment A --student S --criterion CRIT-1 --outcome partly`), "defence mark --criterion");
  assert.equal(named(`curve ${RUN} --assessment A --clear`), "curve");
  assert.equal(named(`integrity decide ${RUN} --case INTEGRITY-1 --state upheld`), "integrity decide");
  assert.equal(named(`integrity open ${RUN} --student S --assessment A`), "integrity open");
  assert.equal(named(`lms push ${RUN} --assessment A --target canvas-api --confirm`), "lms push --confirm");
  assert.equal(named(`lms send-reports ${RUN} --assessment A --confirm`), "lms send-reports --confirm");
  assert.equal(named(`sync run ${RUN} canvas-grades --confirm`), "sync run --confirm");
  assert.equal(named(`decisions adopt ${RUN}`), "decisions adopt");
  for (const line of [
    `grade status ${RUN} --assessment A`,
    `grade move ${RUN} --assessment A --item I --group 1 --score 2`,
    `lms push ${RUN} --assessment A --target canvas-api`,
    `lms plan ${RUN} --assessment A`,
    `sync run ${RUN} marks-sheet`,
    `sync plan ${RUN} canvas-grades`,
    `integrity list ${RUN}`,
    `decisions audit ${RUN}`,
    `defence grade ${RUN} --assessment A --student S --from reply.json`,
    // Whether the student defended: a fact the professor may say in chat.
    `defence mark ${RUN} --assessment A --student S --outcome defended`,
  ]) {
    assert.equal(named(line), null, line);
  }
});

test("the professor's own terminal is theirs; an assistant's shell is not, terminal or no", () => {
  assert.equal(whoIsAsking(DECIDE, plain(), true).via, "terminal");
  // DSH runs its shell in a pseudo-terminal: the terminal is there, the mark says whose.
  const dsh = whoIsAsking(DECIDE, plain({ DSH_SHELL: "1" }), true);
  assert.equal(dsh.via, null);
  assert.match(dsh.why!, /DSH's shell/);
  assert.equal(whoIsAsking(DECIDE, plain({ CLAUDECODE: "1" }), true).via, null);
  assert.equal(whoIsAsking(DECIDE, plain({ AI_AGENT: "some-agent" }), true).via, null);
  // No terminal and no press: a script, or a shell that sets no mark.
  const piped = whoIsAsking(DECIDE, plain(), false);
  assert.equal(piped.via, null);
  assert.match(piped.why!, /no terminal/);
  assert.match(refusal("grade decide", piped)!, /own terminal, or pressed in the pane/);
  assert.equal(refusal("grade decide", { via: "terminal" }), null);
});

test("a press from the pane is the professor's: its argv, its stdin, its five minutes", () => {
  const marks = '[{"student":"STUDENT-A","item":"ITEM-1","score":2}]';
  const press = signPress(DECIDE, marks);
  assert.ok(readdirSync(pressDir()).some((name) => name.startsWith(`${process.pid}-`) && name.endsWith(".pub")), "the public half is written down");

  // From inside an assistant's shell too: the harness was started from one, say.
  const asked = whoIsAsking(DECIDE, plain({ AINAR_PRESS: press, CLAUDECODE: "1" }), false);
  assert.equal(asked.via, "press");
  assert.ok(sameInput(asked, marks), "the marks it was signed with");
  assert.equal(sameInput(asked, '[{"student":"STUDENT-A","item":"ITEM-1","score":0}]'), false, "other marks piped in their place");

  const other = DECIDE.map((word) => (word === "ASSESSMENT-01" ? "ASSESSMENT-02" : word));
  assert.match(whoIsAsking(other, plain({ AINAR_PRESS: press }), false).why!, /another command/);
  const later = Date.now() + PRESS_TTL_MS + 1000;
  assert.match(whoIsAsking(DECIDE, plain({ AINAR_PRESS: press }), false, later).why!, /older than five minutes/);

  const forged = JSON.parse(Buffer.from(press, "base64url").toString("utf-8"));
  forged.argv = other;
  const tampered = Buffer.from(JSON.stringify(forged)).toString("base64url");
  assert.match(whoIsAsking(other, plain({ AINAR_PRESS: tampered }), false).why!, /signature does not hold/);
  assert.match(whoIsAsking(DECIDE, plain({ AINAR_PRESS: "not a press" }), false).why!, /could not be read/);
});

test("a sync's press covers the command it hands its work to, for its own run only", () => {
  const sync = ["sync", "run", RUN, "canvas-grades", "--confirm", "--root", "/w"];
  const press = signPress(sync);
  assert.equal(whoIsAsking(["lms", "push", RUN, "--target", "canvas-api", "--confirm"], plain({ AINAR_PRESS: press }), false).via, "press");
  assert.equal(whoIsAsking(["lms", "push", "OTHER-RUN", "--target", "canvas-api", "--confirm"], plain({ AINAR_PRESS: press }), false).via, null);
  // A plan's press covers nothing else.
  const plan = signPress(["sync", "run", RUN, "canvas-grades", "--root", "/w"]);
  assert.equal(whoIsAsking(["lms", "push", RUN, "--target", "canvas-api", "--confirm"], plain({ AINAR_PRESS: plan }), false).via, null);
});

test("a press signed by no harness running now is refused", () => {
  const press = signPress(DECIDE);
  const dir = pressDir();
  for (const name of readdirSync(dir)) rmSync(join(dir, name));
  try {
    assert.match(whoIsAsking(DECIDE, plain({ AINAR_PRESS: press }), false).why!, /no harness running now/);
  } finally {
    // This process's key is kept in memory; its public half is written once.
    process.env.AINAR_PRESS_DIR = mkdtempSync(join(tmpdir(), "ainar-press-"));
  }
});

test("the decision ledger names a decided evaluation no command wrote", () => {
  const base = mkdtempSync(join(tmpdir(), "ainar-decisions-"));
  const dir = discoverCourses(ROOT).find((path) => path.endsWith("CSS-4008"))!;
  const bundle = loadCourse(dir, ROOT).bundle! as any;
  const courseId = bundle.course.course_id;

  const before = auditDecisions(bundle, base);
  assert.equal(before.ledger, false);
  assert.equal(before.unknown.length, before.decided, "with no ledger, every decision is unknown here");

  // What the commands note as they write; then one written by hand beside them.
  assert.equal(recordDecisions(courseId, bundle.evaluations, "decisions adopt", base), before.decided);
  assert.equal(auditDecisions(bundle, base).unknown.length, 0);
  const suggested = bundle.evaluations.find((entry: any) => entry.status === "suggested");
  assert.ok(suggested, "the sample course has a suggested evaluation");
  suggested.status = "approved";
  suggested.professor_decision = { score: 1, decided_by: "USER-PROF", decided_at: "2026-11-01T10:00:00+05:00" };
  const after = auditDecisions(bundle, base);
  assert.deepEqual(after.unknown.map((entry) => entry.evaluation_id), [suggested.evaluation_id]);

  // A decision changed by hand (same id, new time) is unknown again.
  const known = bundle.evaluations.find((entry: any) => entry !== suggested && entry.professor_decision);
  if (known) {
    known.professor_decision = { ...known.professor_decision, decided_at: "2026-11-01T11:00:00+05:00" };
    assert.ok(auditDecisions(bundle, base).unknown.some((entry) => entry.evaluation_id === known.evaluation_id));
  }
});
