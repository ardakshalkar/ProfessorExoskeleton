/**
 * The professor pane's browser half, executed rather than merely parsed.
 *
 *     node --test test/pane-client.test.mjs
 *
 * This file exists because of a bug that shipped past every check that was in
 * place. `lib/client.js` keeps its stylesheet in a template literal, and a
 * backtick written inside it — in a CSS comment, quoting a property name —
 * ends the literal early. The rest of the stylesheet is then parsed as
 * JavaScript, and `-webkit-text-security` is a perfectly legal expression:
 * unary minus applied to a chain of identifiers. So the file passed
 * `node --check`, passed a dynamic `import`, and failed at boot with
 * `webkit is not defined`.
 *
 * A dynamic import does not catch it because the loader's registration form is
 * `window.__ModuleLoader__.load({ id, factory })`: importing the module only
 * hands the factory over, and every line inside it — the stylesheet included —
 * runs later, when the harness calls it. So the test has to call it.
 *
 * What this therefore covers is the whole factory body: the stylesheet, every
 * component definition, and anything else evaluated at module-construction
 * time. What it does not cover is rendering — no component is mounted, because
 * that needs a DOM and the harness's services, and the failure mode this
 * guards against is not a rendering one.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import React from "react";
import ReactDOM from "react-dom";

/**
 * Everything the factory asks for.
 *
 * React and ReactDOM are real, because the factory calls into them while
 * defining components. Everything else is a harness service it only stores a
 * handle to, so a permissive stub is enough — and a stub is what keeps this
 * test runnable against a bare Node with no harness booted.
 */
const stubRequire = (id) => {
  if (id === "react") return React;
  if (id === "react-dom") return ReactDOM;
  return new Proxy(function stub() {}, { get: () => () => {} });
};

/**
 * What the client half registered with the loader, imported exactly once.
 *
 * Once because ES modules are cached: a second `import()` of the same
 * specifier does not re-run the top-level `load(...)` call, so a per-test
 * import would find nothing registered and fail for a reason that has nothing
 * to do with the pane.
 */
const registered = await (async () => {
  let captured = null;
  globalThis.window = { __ModuleLoader__: { load: (module) => (captured = module) } };
  await import("../plugins/dsh-professor-pane/lib/client.js");
  assert.ok(captured, "the client half registered nothing with the module loader");
  return captured;
})();

test("the pane's client half registers under its own id", () => {
  assert.equal(registered.id, "dsh-professor-pane");
  assert.equal(typeof registered.factory, "function");
});

test("the factory runs — the stylesheet is a string, not code", () => {
  // The assertion is that this does not throw. `webkit is not defined` was
  // what it threw when a backtick in a CSS comment ended the literal early.
  const exports = registered.factory(stubRequire);

  assert.ok(exports, "the factory returned nothing");
  assert.equal(typeof exports.apply, "function", "a client half applies into the harness");
});
