/**
 * Placing scanned papers one at a time: plugins/dsh-professor-pane/client/scans-queue.js
 *
 *     node --test test/pane-scans-queue.test.mjs
 *
 * `scans assign` reads and rewrites the pile's plan with no lock, so two at
 * once would lose a placement. Presses may come as fast as the professor
 * likes; the requests may not overlap.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { enqueuePlacement, onPlacements, placementKey, placementsNow, placementsWaiting } from "../plugins/dsh-professor-pane/client/scans-queue.js";

test("presses wait in line, one request at a time, in the order pressed; a paper already waiting is not added twice", async () => {
  const calls = [];
  globalThis.fetch = (url, init) =>
    new Promise((resolve) => {
      calls.push({ url, body: JSON.parse(init.body), resolve });
    });
  const answer = (index, value) => calls[index].resolve({ json: () => Promise.resolve(value) });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const seen = [];
  const stop = onPlacements((line) => seen.push(line));
  const done = [];
  const press = (pages, student) =>
    enqueuePlacement({
      runId: "RUN-1",
      sessionId: "",
      assessment: "ASSESSMENT-MIDTERM-1",
      file: "scan-1.pdf",
      pages,
      answer: { student },
      onDone: (result) => done.push([pages, result.ok]),
    });

  assert.equal(press("65,66,68,67", "STUDENT-ZHCW4G"), true);
  assert.equal(press("29-32", "STUDENT-H75AZ6"), true);
  assert.equal(press("29-32", "STUDENT-H75AZ6"), false, "the same paper twice is one placement");
  assert.equal(calls.length, 1, "the second waits for the first");
  assert.deepEqual(placementsNow(), {
    running: placementKey("ASSESSMENT-MIDTERM-1", "scan-1.pdf", "65,66,68,67"),
    queued: [placementKey("ASSESSMENT-MIDTERM-1", "scan-1.pdf", "29-32")],
  });
  assert.match(calls[0].url, /\/api\/scans\/assign\?run=RUN-1&assessment=ASSESSMENT-MIDTERM-1/);
  assert.deepEqual(calls[0].body, { pages: "65,66,68,67", file: "scan-1.pdf", student: "STUDENT-ZHCW4G" });

  answer(0, { ok: true });
  await settle();
  assert.equal(calls.length, 2, "the next starts once the first is back");
  assert.deepEqual(calls[1].body, { pages: "29-32", file: "scan-1.pdf", student: "STUDENT-H75AZ6" });

  // A refusal is reported to its press and does not stop the line.
  assert.equal(press("49-52", "STUDENT-P5M65P"), true);
  answer(1, { ok: false, error: "refused" });
  await settle();
  answer(2, { ok: true });
  await settle();
  assert.deepEqual(done, [["65,66,68,67", true], ["29-32", false], ["49-52", true]]);
  assert.equal(placementsWaiting(), false);
  assert.equal(calls.length, 3);
  assert.ok(seen.length >= 6, "every move of the line is told");
  stop();
});
