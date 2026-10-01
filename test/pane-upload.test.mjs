/**
 * The pane's upload route, driven end to end.
 *
 *     node --test test/pane-upload.test.mjs
 *
 * What it has to hold: a file lands in the private submissions folder and
 * never in the workspace; a scan is renamed by its content so no student's name
 * travels in the path the agent is told; the same scan twice is one file; and
 * anything that is not what the kind takes is refused before a byte is kept.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE = fileURLToPath(new URL("../workspace", import.meta.url));
const RUN = "CSS-4008-2026-FALL";

const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "pane-upload-"));
  for (const directory of ["courses", "shared"]) {
    cpSync(join(SAMPLE, directory), join(root, directory), { recursive: true });
  }
  return root;
};

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
  return handler;
};

/** A raw-body POST, delivered in two chunks the way a socket would. */
const upload = (handler, query, bytes, method = "POST") =>
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
        resolve(JSON.parse(chunks.join("")));
      },
    };
    const listeners = {};
    const req = {
      method,
      url: "/professor-pane/api/upload?" + query,
      headers: { "content-type": "application/octet-stream" },
      on(event, handle) {
        listeners[event] = handle;
        return this;
      },
      destroy() {},
    };
    handler(req, res);
    queueMicrotask(() => {
      const half = Math.floor(bytes.length / 2);
      listeners.data?.(bytes.subarray(0, half));
      listeners.data?.(bytes.subarray(half));
      listeners.end?.();
    });
  });

const PDF = Buffer.from("%PDF-1.7\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n");

const setUp = async () => {
  const root = workspace();
  const submissions = mkdtempSync(join(tmpdir(), "pane-upload-subs-"));
  process.env.AINAR_WORKSPACE = root;
  process.env.AINAR_SUBMISSIONS_DIR = submissions;
  return { root, submissions, handler: await route() };
};

test("a scan lands in the run's unfiled inbox, renamed by its content, with the name kept privately", async () => {
  const { root, submissions, handler } = await setUp();
  const result = await upload(handler, `run=${RUN}&kind=scans&name=${encodeURIComponent("Ivanova Aigerim quiz3.pdf")}`, PDF);
  assert.equal(result.ok, true, result.error);
  assert.match(result.file, /^scan-[0-9a-f]{10}\.pdf$/);
  assert.equal(result.path, join(submissions, RUN, "_inbox", result.file));
  assert.deepEqual(readFileSync(result.path), PDF);
  assert.ok(!result.path.includes("Ivanova"));
  const ledger = JSON.parse(readFileSync(join(submissions, RUN, "_inbox", "uploads.json"), "utf-8"));
  assert.equal(ledger[0].original, "Ivanova Aigerim quiz3.pdf");
  assert.ok(!readdirSync(join(root, "courses")).some((entry) => entry.startsWith("scan-")));

  const again = await upload(handler, `run=${RUN}&kind=scans&name=other.pdf`, PDF);
  assert.equal(again.file, result.file);
  assert.equal(again.duplicate, true);
  assert.equal(readdirSync(join(submissions, RUN, "_inbox")).filter((name) => name.endsWith(".pdf")).length, 1);
});

test("a paper keeps a safe form of its name, and a different file of the same name is kept beside it", async () => {
  const { submissions, handler } = await setUp();
  const first = await upload(handler, `run=${RUN}&kind=paper&name=${encodeURIComponent("../Quiz 3 (key).md")}`, Buffer.from("1. b\n"));
  assert.equal(first.ok, true, first.error);
  assert.equal(first.file, "Quiz-3-key.md");
  assert.equal(first.path, join(submissions, RUN, "_papers", "Quiz-3-key.md"));
  const corrected = await upload(handler, `run=${RUN}&kind=paper&name=${encodeURIComponent("Quiz 3 (key).md")}`, Buffer.from("1. c\n"));
  assert.match(corrected.file, /^Quiz-3-key-[0-9a-f]{6}\.md$/);
  assert.equal(readFileSync(first.path, "utf-8"), "1. b\n");
});

test("what the kind does not take is refused, and nothing is left behind", async () => {
  const { submissions, handler } = await setUp();
  assert.match((await upload(handler, `run=${RUN}&kind=scans&name=photo.jpg`, PDF)).error, /uploaded as PDF/);
  assert.match((await upload(handler, `run=${RUN}&kind=scans&name=fake.pdf`, Buffer.from("not a pdf"))).error, /does not start like a PDF/);
  assert.match((await upload(handler, `run=${RUN}&kind=scans&name=empty.pdf`, Buffer.alloc(0))).error, /empty/);
  assert.match((await upload(handler, `run=${RUN}&kind=secrets&name=a.pdf`, PDF)).error, /scans or paper/);
  assert.match((await upload(handler, `run=NOPE-2026-FALL&kind=scans&name=a.pdf`, PDF)).error, /no course run/);
  assert.match((await upload(handler, `run=${RUN}&kind=scans&name=a.pdf`, PDF, "GET")).error, /POST/);
  const inbox = join(submissions, RUN, "_inbox");
  assert.ok(!existsSync(inbox) || readdirSync(inbox).every((name) => !name.endsWith(".part") && !name.endsWith(".pdf")));
});

test("a submissions folder inside the workspace is refused", async () => {
  const { root, handler } = await setUp();
  process.env.AINAR_SUBMISSIONS_DIR = join(root, "uploads");
  const result = await upload(handler, `run=${RUN}&kind=scans&name=a.pdf`, PDF);
  assert.match(result.error, /inside the workspace/);
  assert.ok(!existsSync(join(root, "uploads")));
});
