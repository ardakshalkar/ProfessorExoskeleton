/**
 * `materials.yaml` and the records it produces, joined.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { producerFor, type Producer } from "../src/materials.ts";

const deck = (fields: Partial<Producer> = {}): Producer => ({
  id: "week-01-slides",
  render: "MODULE-DRAFT-01-slides/MODULE-DRAFT-01-slides.md",
  produces: "MODULE-DRAFT-01-slides/MODULE-DRAFT-01-slides.pptx",
  title: "Week 1 slides",
  document_id: "DOC-DECK-MD-DRAFT-01",
  pdf_document_id: "DOC-DECK-MD-DRAFT-PDF-01",
  concepts: [],
  pdf: false,
  ...fields,
});

test("an approved deck finds the producer its draft id names", () => {
  // The manifest keeps the draft id, because `materials build` writes drafts;
  // `approve` takes the marker out. The join has to survive that.
  const producers = [deck()];
  assert.equal(producerFor(producers, "DOC-DECK-MD-01")?.id, "week-01-slides");
  assert.equal(producerFor(producers, "DOC-DECK-MD-PDF-01")?.id, "week-01-slides");
});

test("a draft id still finds its producer", () => {
  assert.equal(producerFor([deck()], "DOC-DECK-MD-DRAFT-01")?.id, "week-01-slides");
});

test("the default PDF id is matched once promoted too", () => {
  const producers = [deck({ pdf_document_id: null })];
  assert.equal(producerFor(producers, "DOC-DECK-MD-01-PDF")?.id, "week-01-slides");
});

test("another deck's id finds nothing", () => {
  assert.equal(producerFor([deck()], "DOC-DECK-MD-02"), null);
});
