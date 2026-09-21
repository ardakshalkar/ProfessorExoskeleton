/**
 * The pane's publish route, driven end to end.
 *
 *     node --test test/pane-publish.test.mjs
 *
 * `test/pane-client.test.mjs` executes the browser half; this executes the host
 * half, and it is the only test in this repository that mounts the plugin and
 * makes a request of it. It is here because the route's whole job is to reach
 * something else: it spawns `bin/ainar publish`, which performs the gate and
 * then a publication. A unit test of the argv it builds would pass while the
 * command it builds them for refused, which is the failure that matters.
 *
 * So it boots the plugin with a stub context, points `AINAR_WORKSPACE` at a
 * copy of the sample course with a drafted deck in it, and asks the route the
 * two questions a professor's two presses ask.
 *
 * Nothing here reaches the network. `page` is the one target that publishes to
 * the local filesystem; the other three are argument-parsing over the same
 * code and are covered by `ainar-node/test/publish.test.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE = fileURLToPath(new URL("../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";
const COURSE = "CSS-4008";

/** A workspace of its own, with one drafted deck and one drafted grade in it. */
const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "pane-publish-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  const drafts = join(root, "work", RUN);
  mkdirSync(drafts, { recursive: true });
  writeFileSync(
    join(drafts, "documents.yaml"),
    `documents:\n` +
      `  - document_id: DOC-DRAFT-9100\n` +
      `    title: Week 7 — cross-validation, slides\n` +
      `    storage_key: work/${RUN}/week-07-slides.md\n` +
      `    mime_type: text/markdown\n` +
      `    course_version_id: ${RUN}\n` +
      `    module_id: MODULE-06\n`,
    "utf-8",
  );
  writeFileSync(
    join(drafts, "evaluations.yaml"),
    `evaluations:\n` +
      `  - evaluation_id: EVAL-DRAFT-9100\n` +
      `    submission_id: SUB-1\n` +
      `    criterion_id: CRIT-01-01\n` +
      `    ai_suggestion:\n` +
      `      score: 8\n`,
    "utf-8",
  );
  writeFileSync(join(drafts, "week-07-slides.md"), "# Cross-validation\n", "utf-8");
  return root;
};

/**
 * The plugin, mounted on a context that is only what it asks for.
 *
 * `inject` names `webServer` and `workspaceRegistry`; `apply` also reaches for
 * `ctx.inject` for the credential seam, which is allowed to be absent — so the
 * stub calls that callback with nothing and the routes go on working. That is
 * the degradation the pane's README describes, exercised here for free.
 */
const route = async () => {
  const { apply } = await import("../plugins/dsh-professor-pane/index.js");
  let handler = null;
  apply({
    inject: () => {},
    effect: (make) => make(),
    workspaceRegistry: { list: () => [] },
    webServer: {
      register: (registration) => {
        handler = registration.handler;
        return () => {};
      },
    },
  });
  assert.ok(handler, "the plugin registered no route");
  return handler;
};

/** One request, with the response collected rather than written to a socket. */
const post = (handler, path, body) =>
  new Promise((resolve) => {
    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      writeHead(status, headers) {
        this.statusCode = status;
        Object.assign(this.headers, headers || {});
        return this;
      },
      write(chunk) {
        chunks.push(chunk);
        return true;
      },
      end(chunk) {
        if (chunk) chunks.push(chunk);
        resolve({ status: this.statusCode, body: chunks.join("") });
      },
    };
    const payload = JSON.stringify(body);
    const listeners = {};
    const req = {
      method: "POST",
      url: path,
      headers: { "content-type": "application/json" },
      on(event, handle) {
        listeners[event] = handle;
        return this;
      },
      destroy() {},
    };
    handler(req, res);
    // The route reads the body on the next turn, after `readBody` has attached
    // its listeners — which is what `handler` does synchronously above.
    queueMicrotask(() => {
      listeners.data?.(Buffer.from(payload));
      listeners.end?.();
    });
  });

test("the plan says what it would promote, and writes nothing", async () => {
  const root = workspace();
  process.env.AINAR_WORKSPACE = root;
  const handler = await route();

  const response = await post(handler, `/professor-pane/api/publish?run=${RUN}`, {
    target: "page",
    confirm: false,
  });
  const result = JSON.parse(response.body);

  assert.equal(result.ok, true, result.output);
  assert.equal(result.confirmed, false);
  assert.match(result.output, /Would promote 1 drafted material/);
  assert.match(result.output, /DOC-DRAFT-9100/);
  assert.match(result.output, /left alone: 1 draft\(s\) in evaluations/);
  assert.match(result.output, /Run it again with --confirm/);
  // A plan that wrote the page would be a plan that published it.
  assert.equal(existsSync(join(root, "dist")), false);
  assert.equal(existsSync(join(root, "courses", COURSE, "documents", "generated.yaml")), false);
});

test("confirming promotes the deck, publishes the page, and leaves the grade alone", async () => {
  const root = workspace();
  process.env.AINAR_WORKSPACE = root;
  const handler = await route();

  const response = await post(handler, `/professor-pane/api/publish?run=${RUN}`, {
    target: "page",
    approver: "USER-ARD-A01",
    confirm: true,
  });
  const result = JSON.parse(response.body);

  assert.equal(result.ok, true, result.output);
  assert.equal(result.confirmed, true);
  assert.match(result.output, /DOC-DRAFT-9100 {2}-> {2}DOC-9100/);
  assert.match(result.output, /published materials\/week-07-slides\.md/);

  const page = join(root, "dist", "pages", RUN, "index.html");
  assert.ok(existsSync(page), "no page was written");
  assert.match(readFileSync(page, "utf-8"), /CSS-4008/);

  // The one property this route exists to keep: it can promote an artefact and
  // it cannot promote a judgement about a student.
  assert.ok(existsSync(join(root, "courses", COURSE, "documents", "generated.yaml")));
  assert.equal(existsSync(join(root, "courses", COURSE, "records", "evaluations.yaml")), false);
});

test("an unknown target is refused before anything is spawned", async () => {
  process.env.AINAR_WORKSPACE = workspace();
  const handler = await route();
  const result = JSON.parse(
    (await post(handler, `/professor-pane/api/publish?run=${RUN}`, { target: "everyone" })).body,
  );
  assert.match(result.error, /not something this can publish/);
});

test("a telegram publish with nothing to say never reaches Telegram", async () => {
  process.env.AINAR_WORKSPACE = workspace();
  const handler = await route();
  const result = JSON.parse(
    (await post(handler, `/professor-pane/api/publish?run=${RUN}`, { target: "telegram", message: "  " }))
      .body,
  );
  assert.match(result.error, /nothing to announce/i);
});
