// The defence desk's end-of-answer detector (AGT-1), driven with synthetic
// microphone levels. `lib/client.js` is a browser module in the harness
// loader's registration form, so it is run here in a VM with a stub loader.
//
//   npm test   (in plugins/dsh-professor-pane)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const loadClient = () => {
  let exported = null;
  const window = {
    __ModuleLoader__: {
      load: ({ factory }) => {
        exported = factory((name) => (name === "react" ? { createElement: () => null } : {}));
      },
    },
  };
  vm.runInNewContext(readFileSync(new URL("../lib/client.js", import.meta.url), "utf-8"), { window, console });
  return exported;
};

const { turnStep } = loadClient();

/** Feed `[level, milliseconds]` stretches at 100 ms a sample; return when it ended, and why. */
const run = (stretches, options) => {
  let state = null;
  let now = 0;
  for (const [level, ms] of stretches) {
    for (let t = 0; t < ms; t += 100) {
      const step = turnStep(state, level, now, options);
      state = step.state;
      if (step.end) return { at: now, end: step.end, state };
      now += 100;
    }
  }
  return { at: null, end: null, state };
};

const ROOM = 0.004;
const VOICE = 0.08;

test("an answer ends after two and a half seconds of quiet following speech", () => {
  const result = run([[ROOM, 1000], [VOICE, 4000], [ROOM, 5000]]);
  assert.equal(result.end, "silence");
  // Speech ended at 5.0 s; the take ends 2.5 s later, give or take a sample.
  assert.ok(result.at >= 7400 && result.at <= 7600, `ended at ${result.at}`);
});

test("silence before the student has said anything never ends the take", () => {
  const result = run([[ROOM, 20000]]);
  assert.equal(result.end, null);
  assert.equal(result.state.phase, "waiting");
});

test("a cough is not an answer: speech has to last 0.4 s", () => {
  const result = run([[ROOM, 1000], [VOICE, 200], [ROOM, 6000]]);
  assert.equal(result.end, null);
  assert.equal(result.state.phase, "waiting");
});

test("a thinking pause shorter than the limit does not cut the answer off", () => {
  const result = run([[ROOM, 500], [VOICE, 3000], [ROOM, 2000], [VOICE, 3000], [ROOM, 4000]]);
  assert.equal(result.end, "silence");
  assert.ok(result.at >= 10900, `cut off at ${result.at}`);
});

test("a noisy room raises the threshold, so its hum is not taken for a voice", () => {
  const hum = 0.02;
  const result = run([[hum, 3000], [hum, 10000]]);
  assert.equal(result.end, null);
  const speaking = run([[hum, 3000], [0.15, 3000], [hum, 4000]]);
  assert.equal(speaking.end, "silence");
});

test("three minutes ends a take whatever is happening", () => {
  const result = run([[VOICE, 200000]]);
  assert.equal(result.end, "cap");
  assert.equal(result.at, 180000);
});

test("the pause shown to the professor counts up from the end of speech", () => {
  let state = null;
  let step;
  for (let now = 0; now <= 2000; now += 100) state = turnStep(state, VOICE, now).state;
  step = turnStep(state, ROOM, 2100);
  step = turnStep(step.state, ROOM, 3300);
  assert.equal(step.silentFor, 1200);
});

test("the tail of the last answer, in the first 0.8 s of a take, is not an answer", () => {
  const result = run([[VOICE, 700], [ROOM, 6000]]);
  assert.equal(result.end, null);
  assert.equal(result.state.phase, "waiting");
});
