/**
 * Reading who wrote each paper off its cover (src/scan-names.ts): the prompt,
 * filling a plan entry from a reply, which entries a run reads, and the run
 * itself — with the renderer and the model both faked, so nothing here needs
 * poppler or the network.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNamePrompt, fillPaper, nameRequest, nameTargets, readNames } from "../src/scan-names.ts";
import { readPlan, scanPlace, writePlan } from "../src/scans.ts";

const READ_BY = "test-model · effort low · 2026-10-06";

test("the prompt asks for the name wherever it is written, and the variant only when there are some", () => {
  const plain = buildNamePrompt({ title: "Quiz 2", courseId: "CSS-4007", variants: [] });
  assert.match(plain, /above the title/);
  assert.match(plain, /Do not transliterate/);
  assert.doesNotMatch(plain, /variant_as_printed/);
  assert.match(buildNamePrompt({ title: "Quiz 2", courseId: "CSS-4007", variants: ["A", "B"] }), /one of A, B/);
});

test("the request carries the prompt and each band in order", () => {
  const content = nameRequest("P", ["b0.png", "b1.png"], () => Buffer.from("x"));
  assert.equal(content.length, 5);
  assert.deepEqual(content[1], { type: "text", text: "Band 0:" });
  assert.equal((content[4] as any).image_url.url, `data:image/png;base64,${Buffer.from("x").toString("base64")}`);
});

test("a confident reading writes the name and nothing for a person to check", () => {
  const { paper, problems } = fillPaper(
    { pages: "1-2" },
    { is_first_page: true, name_as_written: "  Alice   Adams ", number_as_written: "", confidence: "high", note: "" },
    { readBy: READ_BY, variants: [] },
  );
  assert.deepEqual(paper, { pages: "1-2", name: "Alice Adams", confidence: "high", read_by: READ_BY });
  assert.deepEqual(problems, []);
});

test("a number is kept only when it is digits; a variant only when the paper has it", () => {
  const { paper } = fillPaper(
    { pages: "3-4" },
    { is_first_page: true, name_as_written: "Bob", number_as_written: "220 103 456", variant_as_printed: "B", confidence: "medium" },
    { readBy: READ_BY, variants: ["A", "B"] },
  );
  assert.equal(paper.number, "220103456");
  assert.equal(paper.variant, "B");
  const odd = fillPaper(
    { pages: "3-4" },
    { is_first_page: true, name_as_written: "Bob", number_as_written: "12a", variant_as_printed: "C", confidence: "sure" },
    { readBy: READ_BY, variants: ["A", "B"] },
  ).paper;
  assert.equal(odd.number, undefined);
  assert.equal(odd.variant, undefined);
  assert.equal(odd.confidence, "low", "a confidence outside the scale counts as low");
});

test("no name, a low read and a page that is not a cover each leave a note", () => {
  const empty = fillPaper({ pages: "5-6" }, { is_first_page: true, name_as_written: "", confidence: "low" }, { readBy: READ_BY, variants: [] });
  assert.equal(empty.paper.name, undefined);
  assert.match(empty.paper.note!, /no name or number/);
  assert.deepEqual(empty.problems, ["no name"]);

  const low = fillPaper({ pages: "5-6" }, { is_first_page: true, name_as_written: "Carol", confidence: "low" }, { readBy: READ_BY, variants: [] });
  assert.equal(low.paper.name, "Carol");
  assert.match(low.paper.note!, /low confidence/);

  const drift = fillPaper({ pages: "7-8" }, { is_first_page: false, name_as_written: "Dan", confidence: "high" }, { readBy: READ_BY, variants: [] });
  assert.equal(drift.paper.name, undefined, "a name off a page that is not a cover would place someone else's pages");
  assert.match(drift.paper.note!, /drifted/);
});

test("every other name on the cover is kept apart, and one in another hand is for a person", () => {
  const { paper, problems } = fillPaper(
    { pages: "77-78" },
    {
      is_first_page: true,
      name_as_written: "Nurshapagat",
      other_names: [
        { text: "Zhangazy  Nurshapagat", where: "above the title", same_hand: false },
        { text: "nurshapagat", where: "in a margin", same_hand: true },
      ],
      confidence: "high",
    },
    { readBy: READ_BY, variants: [] },
  );
  assert.equal(paper.name, "Nurshapagat");
  assert.deepEqual(paper.also, ["Zhangazy Nurshapagat"], "a repeat of the Name line is not another name");
  assert.match(paper.note!, /also written: "Zhangazy Nurshapagat" above the title, in another hand/);
  assert.deepEqual(problems, ["a name in another hand"]);

  const plain = fillPaper({ pages: "1", also: ["Old"] }, { is_first_page: true, name_as_written: "Eve", confidence: "high" }, { readBy: READ_BY, variants: [] });
  assert.equal(plain.paper.also, undefined, "a re-read replaces what an earlier one saw");
  assert.match(buildNamePrompt({ title: "Q", courseId: "C", variants: [] }), /other_names/);
});

test("a note the plan wrote survives a reading; one an earlier reading wrote is replaced", () => {
  const planned = fillPaper({ pages: "9", note: "only 1 page(s) where 2 were expected" }, { name_as_written: "Eve", confidence: "high" }, { readBy: READ_BY, variants: [] });
  assert.match(planned.paper.note!, /only 1 page/);
  const reread = fillPaper({ pages: "9", note: "name read with low confidence", read_by: "old" }, { name_as_written: "Eve", confidence: "high" }, { readBy: READ_BY, variants: [] });
  assert.equal(reread.paper.note, undefined);
});

const pile = () => {
  const place = scanPlace(mkdtempSync(join(tmpdir(), "scan-names-")), "RUN-1", "ASSESSMENT-Q");
  mkdirSync(place.inbox, { recursive: true });
  writeFileSync(join(place.inbox, "batch.pdf"), "not really a pdf");
  writePlan(place, {
    course_version_id: "RUN-1",
    assessment_id: "ASSESSMENT-Q",
    sources: [
      {
        file: "batch.pdf",
        page_count: 10,
        checksum: "sha256:x",
        papers: [
          { pages: "1-2" },
          { pages: "3-4", name: "Written By Hand" },
          { pages: "5-6", resolved: "STUDENT-AAAAAA", name: "Placed" },
          { pages: "7-8", skip: "question sheet" },
          { pages: "9-10", name: "Unmatched", problem: "the name matches no enrolled student" },
        ],
      },
    ],
  });
  return place;
};

test("a run reads only the papers nobody has said who wrote; --force adds the unplaced ones", () => {
  const place = pile();
  assert.deepEqual(nameTargets(place).map((entry) => entry.pages), ["1-2"]);
  assert.deepEqual(nameTargets(place, { force: true }).map((entry) => entry.pages), ["1-2", "3-4", "9-10"]);
});

test("a run sends each first page, fills the plan and keeps the replies", async () => {
  const place = pile();
  const rendered: number[] = [];
  const results = await readNames({
    place,
    title: "Quiz",
    courseId: "C-1",
    variants: [],
    model: "test-model",
    effort: "low",
    now: "2026-10-06T10:00:00Z",
    force: true,
    render: async (_pdf, page) => {
      rendered.push(page);
      return [];
    },
    reader: async () => ({
      text: rendered.length === 3 ? "not json" : JSON.stringify({ is_first_page: true, name_as_written: `Name ${rendered.at(-1)}`, confidence: "high" }),
      model: "test-model",
      usage: { prompt_tokens: 100, completion_tokens: 10 },
      ms: 5,
      at: "2026-10-06T12:00:00Z",
    }),
    concurrency: 1,
  });
  assert.deepEqual(rendered, [1, 3, 9]);
  assert.deepEqual(results.map((entry) => [entry.pages, entry.status]), [["1-2", "named"], ["3-4", "named"], ["9-10", "unparsed"]]);
  const papers = readPlan(place)!.sources[0]!.papers;
  assert.equal(papers[0]!.name, "Name 1");
  assert.equal(papers[0]!.read_by, "test-model · effort low · 2026-10-06");
  assert.equal(papers[1]!.name, "Name 3");
  assert.equal(papers[2]!.name, "Placed", "a placed paper is never read again");
  assert.equal(papers[4]!.name, "Unmatched", "an unparsed reply leaves the entry as it was");
  const log = JSON.parse(readFileSync(join(place.inbox, "names.json"), "utf-8"));
  assert.equal(log["batch.pdf#9-10"].raw, "not json");
  assert.equal(existsSync(join(place.inbox, "_render")), false);
});
