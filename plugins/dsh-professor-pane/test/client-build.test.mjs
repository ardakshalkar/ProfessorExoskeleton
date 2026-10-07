// `lib/client.js` is built from `client/*.js` and committed, because dsh serves
// that one file as it is on disk. This fails when someone edits a module and
// forgets the build — or edits the built file by hand.
//
//   npm test   (in plugins/dsh-professor-pane)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "../client/build.mjs";

test("lib/client.js is what client/*.js builds", () => {
  const current = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(current === build(), "lib/client.js is out of date: run `npm run build` in plugins/dsh-professor-pane");
});
