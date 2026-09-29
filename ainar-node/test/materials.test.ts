/**
 * `materials.yaml` and the records it produces, joined.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { producerFor, type Producer } from "../src/materials.ts";

const deck = (fields: Partial<Producer> = {}): Producer => ({
  id: "week-01-slides",
  render: "MODULE-01-slides/MODULE-01-slides.md",
  produces: "MODULE-01-slides/MODULE-01-slides.pptx",
  title: "Week 1 slides",
  document_id: "DOC-DECK-MD-01",
  pdf_document_id: "DOC-DECK-MD-PDF-01",
  concepts: [],
  pdf: false,
  ...fields,
});

test("a deck finds the producer its id names, and so does its PDF", () => {
  // A draft and the record it becomes have one id, so the join is exact.
  const producers = [deck()];
  assert.equal(producerFor(producers, "DOC-DECK-MD-01")?.id, "week-01-slides");
  assert.equal(producerFor(producers, "DOC-DECK-MD-PDF-01")?.id, "week-01-slides");
});

test("the default PDF id is matched", () => {
  const producers = [deck({ pdf_document_id: null })];
  assert.equal(producerFor(producers, "DOC-DECK-MD-01-PDF")?.id, "week-01-slides");
});

test("another deck's id finds nothing", () => {
  assert.equal(producerFor([deck()], "DOC-DECK-MD-02"), null);
});
