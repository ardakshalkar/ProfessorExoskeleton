/**
 * A markdown deck's figures, served beside the page `/file` renders it into.
 *
 *     node --test test/pane-file-assets.test.mjs
 *
 * A Marp deck names its figures relative to itself (`figures/fig-01.svg`). The
 * page `/file?doc=…` renders has the pane's address, not the deck's folder, so
 * the browser resolved those to `/professor-pane/figures/…` and every figure in
 * a draft deck came back broken.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sendMaterial } from "../plugins/dsh-professor-pane/server/serve-file.js";

const root = mkdtempSync(join(tmpdir(), "pane-file-assets-"));
const deckDir = join(root, "courses", "C", "materials", "DECK");
mkdirSync(join(deckDir, "figures"), { recursive: true });
writeFileSync(
  join(deckDir, "DECK.md"),
  "# Week\n\n![a figure](figures/fig-01.svg)\n\n![remote](https://example.org/x.png)\n",
);
writeFileSync(join(deckDir, "figures", "fig-01.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
writeFileSync(join(deckDir, "notes.yaml"), "secret: 1\n");

const workspace = {
  courseIds: () => ["C"],
  load: () => ({
    bundle: {
      documents: [{ document_id: "DOC-DECK", title: "Deck", storage_key: "courses/C/materials/DECK/DECK.md" }],
    },
  }),
};

/** Just enough of a `ServerResponse` to read back what was sent. */
const response = () => {
  const res = { status: 0, headers: {}, body: "" };
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.writeHead = (status, headers = {}) => {
    res.status = status;
    for (const [k, v] of Object.entries(headers)) res.headers[k.toLowerCase()] = v;
  };
  res.end = (body = "") => (res.body = Buffer.isBuffer(body) ? body.toString("utf8") : String(body));
  return res;
};

test("a rendered deck points its relative figures at /file?asset=", () => {
  const res = response();
  sendMaterial(res, workspace, root, "DOC-DECK", false, false, "", "S1");
  assert.match(
    res.body,
    /<img alt="a figure" src="\/professor-pane\/file\?doc=DOC-DECK&amp;asset=figures%2Ffig-01\.svg&amp;session=S1">/,
  );
  // An absolute URL is the author's and stays as written.
  assert.match(res.body, /src="https:\/\/example\.org\/x\.png"/);
});

test("the figure itself is served from beside the deck", () => {
  const res = response();
  sendMaterial(res, workspace, root, "DOC-DECK", false, false, "figures/fig-01.svg", "S1");
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "image/svg+xml");
  assert.match(res.body, /<svg/);
});

test("an asset that is not a picture, or climbs out of the workspace, is refused", () => {
  for (const asset of ["notes.yaml", "../../../../../../../etc/passwd.png"]) {
    const res = response();
    sendMaterial(res, workspace, root, "DOC-DECK", false, false, asset, "");
    assert.equal(res.status, 404, asset);
  }
});
