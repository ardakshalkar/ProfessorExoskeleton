/**
 * Reading scanned papers with a model (src/scan-read.ts): the band layout, the
 * blank-page measure, the request, filling a transcript from a reply, and the
 * run over a pile — with the renderer and the model both faked, so nothing here
 * needs poppler or the network.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import {
  bandLayout,
  buildPrompt,
  deepseekKey,
  deepseekReader,
  estimateCost,
  fillTranscript,
  inkShare,
  isPeak,
  isUnread,
  parseReply,
  readScans,
  readTargets,
  requestContent,
  type RenderedPage,
} from "../src/scan-read.ts";
import { scanPlace } from "../src/scans.ts";

const ITEMS = [
  { item_id: "ITEM-Q-01", assessment_id: "ASSESSMENT-Q", type: "short_answer", number: 1, prompt: "Explain tokens.", maximum_score: 2, options: [] },
  {
    item_id: "ITEM-Q-02",
    assessment_id: "ASSESSMENT-Q",
    type: "multiple_choice",
    number: 2,
    prompt: "Pick one.",
    maximum_score: 1,
    options: [{ label: "a", text: "yes" }, { label: "b", text: "no" }],
  },
];

const skeleton = (student: string) => ({
  student_id: student,
  assessment_id: "ASSESSMENT-Q",
  variant: null,
  page_count: 2,
  read_by: null,
  answers: [
    { item: "ITEM-Q-01", number: 1, type: "short_answer", text: null, page: null, blank: false, confidence: null, note: null },
    { item: "ITEM-Q-02", number: 2, type: "multiple_choice", options: ["a", "b"], chosen: [], page: null, blank: false, confidence: null, note: null },
  ],
});

test("bands cover an A4 page at 200 dpi in eight overlapping strips under the pixel cap", () => {
  const bands = bandLayout(1653, 2339);
  assert.equal(bands.length, 8);
  assert.equal(bands[0]!.y, 0);
  const last = bands.at(-1)!;
  assert.equal(last.y + last.height, 2339);
  for (const band of bands) assert.ok(band.height * 1653 <= 640_000);
  for (let index = 1; index < bands.length; index += 1) {
    assert.ok(bands[index]!.y < bands[index - 1]!.y + bands[index - 1]!.height, "each band overlaps the one above");
  }
});

test("a page too tall for eight bands gets more of them", () => {
  const bands = bandLayout(1653, 5000);
  assert.ok(bands.length > 8);
  for (const band of bands) assert.ok(band.height * 1653 <= 640_000);
  assert.equal(bands.at(-1)!.y + bands.at(-1)!.height, 5000);
});

test("ink share is zero for a white page and counts light grey strokes", () => {
  const pgm = (pixels: number[]) => Buffer.concat([Buffer.from(`P5\n${pixels.length} 1\n255\n`, "latin1"), Buffer.from(pixels)]);
  assert.equal(inkShare(pgm([255, 255, 255, 255])), 0);
  assert.equal(inkShare(pgm([255, 180, 255, 255])), 0.25, "a blurred pen stroke at 24 dpi is grey, not black");
});

test("the prompt names every question and every blank page", () => {
  const pages: RenderedPage[] = [
    { page: 1, blank: false, ink: 0.05, bands: ["b0.png"] },
    { page: 2, blank: true, ink: 0, bands: [] },
  ];
  const prompt = buildPrompt({ title: "Quiz", courseId: "CSS-1", items: ITEMS, pages });
  assert.match(prompt, /item ITEM-Q-01 \(Q1, written\) \[2 marks\]: Explain tokens\./);
  assert.match(prompt, /item ITEM-Q-02 \(Q2, choice\).*a\) yes {2}b\) no/);
  assert.match(prompt, /Page 2 is blank and is not attached\./);
  const content = requestContent(prompt, pages, () => Buffer.from("png"));
  assert.deepEqual(
    content.map((part) => part.type),
    ["text", "text", "image_url"],
  );
  assert.equal((content[2] as any).image_url.url, `data:image/png;base64,${Buffer.from("png").toString("base64")}`);
});

test("a reply is parsed fenced or bare, and refused when it is not JSON", () => {
  assert.deepEqual(parseReply('{"a":1}'), { a: 1 });
  assert.deepEqual(parseReply('Here:\n```json\n{"a":2}\n```'), { a: 2 });
  assert.equal(parseReply("I could not read it."), null);
});

test("a reading fills the transcript; what it leaves out stays unread", () => {
  const reading = {
    answers: [
      { item: "ITEM-Q-01", text: "  Tokens are pieces  ", page: 1, confidence: "medium", note: "" },
      { item: "ITEM-Q-02", chosen: ["c"], page: 1, confidence: "high" },
    ],
  };
  const { transcript, problems } = fillTranscript(skeleton("STUDENT-A"), reading, { items: ITEMS, readBy: "m · effort low", pageCount: 2 });
  assert.equal(transcript.read_by, "m · effort low");
  assert.equal(transcript.answers[0].text, "Tokens are pieces");
  assert.equal(transcript.answers[0].confidence, "medium");
  assert.equal(transcript.answers[0].note, null);
  assert.deepEqual(transcript.answers[1].chosen, [], "an option the paper does not have is not recorded");
  assert.equal(transcript.answers[1].confidence, null);
  assert.match(transcript.answers[1].note, /check by hand/);
  assert.deepEqual(problems, ["ITEM-Q-02: option(s) c not on the paper"]);
});

test("a blank answer, an odd confidence and a page out of range are made safe", () => {
  const reading = {
    answers: [
      { item: "ITEM-Q-01", text: "", blank: true, page: 1, confidence: "high" },
      { item: "ITEM-Q-02", chosen: ["b"], page: 9, confidence: "certain" },
    ],
  };
  const { transcript, problems } = fillTranscript(skeleton("STUDENT-A"), reading, { items: ITEMS, readBy: "m", pageCount: 2 });
  assert.equal(transcript.answers[0].blank, true);
  assert.equal(transcript.answers[0].text, null);
  assert.equal(transcript.answers[1].page, null);
  assert.equal(transcript.answers[1].confidence, "low", "a confidence outside high/medium/low reads as low");
  assert.deepEqual(problems, []);
});

test("answers keyed by question number are matched when the item id is missing", () => {
  const reading = { answers: [{ number: 1, text: "x", confidence: "high" }, { item: "Q2", chosen: ["a"], confidence: "high" }] };
  const { problems, transcript } = fillTranscript(skeleton("STUDENT-A"), reading, { items: ITEMS, readBy: "m", pageCount: 2 });
  assert.deepEqual(problems, []);
  assert.deepEqual(transcript.answers[1].chosen, ["a"]);
});

test("a transcript counts as unread only while nothing has been written into it", () => {
  assert.equal(isUnread(skeleton("STUDENT-A")), true);
  const touched = skeleton("STUDENT-A");
  touched.answers[0]!.text = "by hand" as any;
  assert.equal(isUnread(touched), false);
  assert.equal(isUnread({ ...skeleton("STUDENT-A"), read_by: "someone" }), false);
});

test("the key comes from the environment first, then the harness credentials", () => {
  const checkout = mkdtempSync(join(tmpdir(), "scanread-key-"));
  assert.equal(deepseekKey(checkout, {}), null);
  mkdirSync(join(checkout, ".dsh"));
  writeFileSync(join(checkout, ".dsh", ".credentials.yaml"), stringify({ refs: { DEEPSEEK_API_KEY: "sk-harness" } }));
  assert.equal(deepseekKey(checkout, {}), "sk-harness");
  assert.equal(deepseekKey(checkout, { DEEPSEEK_API_KEY: "sk-env" }), "sk-env");
});

test("peak hours are weekday mornings UTC, and off-peak costs half", () => {
  const usage = { prompt_cache_miss_tokens: 1_000_000, completion_tokens: 1_000_000 };
  const peak = new Date("2026-10-02T07:00:00Z"); // Friday
  const evening = new Date("2026-10-02T12:00:00Z");
  assert.equal(isPeak(peak), true);
  assert.equal(isPeak(evening), false);
  assert.equal(isPeak(new Date("2026-10-03T07:00:00Z")), false, "Saturday");
  assert.ok(Math.abs(estimateCost(usage, peak) - 1.5) < 1e-9);
  assert.ok(Math.abs(estimateCost(usage, evening) - 0.75) < 1e-9);
});

test("the reader maps effort the way the harness adapter does", async () => {
  const bodies: any[] = [];
  const fake = (async (_url: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ model: "deepseek-flash", choices: [{ message: { content: "{}" } }], usage: { completion_tokens: 3 } }));
  }) as typeof fetch;
  await deepseekReader({ apiKey: "k", model: "m", effort: "low", fetch: fake })([{ type: "text", text: "hi" }]);
  await deepseekReader({ apiKey: "k", model: "m", effort: "off", fetch: fake })([{ type: "text", text: "hi" }]);
  assert.equal(bodies[0].reasoning_effort, "low");
  assert.equal(bodies[0].thinking, undefined);
  assert.deepEqual(bodies[1].thinking, { type: "disabled" });
  assert.equal(bodies[1].reasoning_effort, undefined);
});

test("a run reads every unread paper, keeps the reply, and leaves read ones alone", async () => {
  const submissions = mkdtempSync(join(tmpdir(), "scanread-run-"));
  const place = scanPlace(submissions, "RUN-1", "ASSESSMENT-Q");
  for (const student of ["STUDENT-A", "STUDENT-B", "STUDENT-C"]) {
    mkdirSync(join(place.base, student), { recursive: true });
    writeFileSync(join(place.base, student, "scan.pdf"), "pdf");
    const transcript = skeleton(student);
    if (student === "STUDENT-C") transcript.read_by = "the professor" as any;
    writeFileSync(join(place.base, student, "transcript.yaml"), "# header kept\n" + stringify(transcript));
  }
  const render = async (_pdf: string, work: string): Promise<RenderedPage[]> => {
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, "b0.png"), "png");
    return [
      { page: 1, blank: false, ink: 0.04, bands: [join(work, "b0.png")] },
      { page: 2, blank: true, ink: 0, bands: [] },
    ];
  };
  const asked: number[] = [];
  const reader = async (content: any[]) => {
    asked.push(content.filter((part) => part.type === "image_url").length);
    return {
      text: JSON.stringify({
        name_confidence: "medium",
        answers: [
          { item: "ITEM-Q-01", text: "read", page: 1, confidence: "high" },
          { item: "ITEM-Q-02", chosen: ["a"], page: 1, confidence: "high" },
        ],
      }),
      model: "deepseek-flash",
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      ms: 10,
      at: "2026-10-02T12:00:00Z",
    };
  };

  assert.deepEqual(readTargets(place, {}).targets, ["STUDENT-A", "STUDENT-B"]);
  const { results, skipped } = await readScans({
    place, title: "Quiz", courseId: "CSS-1", items: ITEMS, reader, model: "m", effort: "low", now: "2026-10-02T17:00:00+05:00", render,
  });
  assert.deepEqual(results.map((entry) => [entry.student, entry.status, entry.blank_pages]), [
    ["STUDENT-A", "read", 1],
    ["STUDENT-B", "read", 1],
  ]);
  assert.deepEqual(skipped.map((entry) => entry.student), ["STUDENT-C"]);
  assert.deepEqual(asked, [1, 1], "the blank page is not sent");

  const raw = readFileSync(join(place.base, "STUDENT-A", "transcript.yaml"), "utf-8");
  assert.ok(raw.startsWith("# header kept\n"));
  const transcript = parse(raw);
  assert.equal(transcript.read_by, "m · effort low · 2026-10-02");
  assert.equal(transcript.answers[0].text, "read");
  const kept = JSON.parse(readFileSync(join(place.base, "STUDENT-A", "reading.json"), "utf-8"));
  assert.equal(kept.served_by, "deepseek-flash");
  assert.deepEqual(kept.pages.map((page: any) => page.blank), [false, true]);
  assert.equal(existsSync(join(place.inbox, "_render")), false, "page images are removed after the read");

  const again = await readScans({ place, title: "Quiz", courseId: "CSS-1", items: ITEMS, reader, model: "m", effort: "low", now: "x", render });
  assert.equal(again.results.length, 0, "a second run sends nothing");
});

test("a reply that is not JSON is kept and the transcript left unread", async () => {
  const submissions = mkdtempSync(join(tmpdir(), "scanread-bad-"));
  const place = scanPlace(submissions, "RUN-1", "ASSESSMENT-Q");
  mkdirSync(join(place.base, "STUDENT-A"), { recursive: true });
  writeFileSync(join(place.base, "STUDENT-A", "scan.pdf"), "pdf");
  writeFileSync(join(place.base, "STUDENT-A", "transcript.yaml"), stringify(skeleton("STUDENT-A")));
  const render = async (): Promise<RenderedPage[]> => [{ page: 1, blank: false, ink: 0.04, bands: [] }];
  const reader = async () => ({ text: "sorry", model: "m", usage: {}, ms: 1, at: "2026-10-02T12:00:00Z" });
  const { results } = await readScans({ place, title: "Q", courseId: "C", items: ITEMS, reader, model: "m", effort: "low", now: "x", render });
  assert.equal(results[0]!.status, "unparsed");
  assert.equal(isUnread(parse(readFileSync(join(place.base, "STUDENT-A", "transcript.yaml"), "utf-8"))), true);
  assert.equal(JSON.parse(readFileSync(join(place.base, "STUDENT-A", "reading.json"), "utf-8")).raw, "sorry");
});
