// The student's screen (AGT-4) must not be able to read anything the desk
// did not send it: no fetch, no XHR, no route of the pane named in it.
//
//   npm test   (in plugins/dsh-professor-pane)

import { test } from "node:test";
import assert from "node:assert/strict";
import { screenChannel, studentScreenPage } from "../lib/student-screen.js";

const page = studentScreenPage({ assessmentId: "ASSESSMENT-HW1", studentId: "STUDENT-JNG7SN" });

test("the screen reaches nothing: no fetch, no request, no pane route", () => {
  assert.doesNotMatch(page, /fetch\(|XMLHttpRequest|EventSource|WebSocket|\/api\/|src=|href=/);
});

test("it listens on the desk's channel for this student and assessment", () => {
  assert.equal(screenChannel("ASSESSMENT-HW1", "STUDENT-JNG7SN"), "professor-pane-defence:ASSESSMENT-HW1:STUDENT-JNG7SN");
  assert.match(page, /new BroadcastChannel\("professor-pane-defence:ASSESSMENT-HW1:STUDENT-JNG7SN"\)/);
});

test("what it is sent is drawn as text, never as markup", () => {
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write/);
});

test("a question that may still be edited or skipped is not shown between questions", () => {
  assert.match(page, /phase === "between" \|\| phase === "done" \|\| phase === "idle" \? ""/);
});
