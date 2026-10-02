/**
 * Scanned papers (src/scans.ts): the plan, the checks on it, who a paper
 * belongs to, splitting, and turning a transcript into item responses.
 *
 * The PDFs are made here with pdf-lib, one page per sheet, so the page counts
 * and page order are known exactly.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { parse, stringify } from "yaml";
import { pseudonym, RosterStore } from "../src/roster.ts";
import {
  answerKey,
  applyScans,
  checkSource,
  fileScan,
  groupAnswers,
  identify,
  itemsForVariant,
  nameKey,
  nameSkeleton,
  parsePages,
  planScans,
  proposePapers,
  rankAssessments,
  readPlan,
  recordTranscripts,
  runInbox,
  scanPlace,
  scanStatus,
  scanSubmissionId,
  unfiledScans,
  variantsOf,
  writePlan,
  type ApplyContext,
  type ScanPlan,
} from "../src/scans.ts";

const RUN = "CSS-4008-2026-FALL";
const EXAM = "ASSESSMENT-MIDTERM";
const SALT = Buffer.alloc(32, 7);
const NOW = "2026-10-20T12:00:00+05:00";

const pdf = async (pages: number, sizes: [number, number][] = []): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) document.addPage(sizes[page] ?? [595, 842]);
  return document.save();
};

const setting = () => {
  const base = mkdtempSync(join(tmpdir(), "ainar-scans-"));
  const place = scanPlace(join(base, "submissions"), RUN, EXAM);
  mkdirSync(place.inbox, { recursive: true });
  const alice = pseudonym("220001", SALT);
  const bob = pseudonym("220002", SALT);
  const carol = pseudonym("220003", SALT);
  const store = new RosterStore(join(base, "roster"), {
    [alice]: { institutional_id: "220001", name: "Alice Adams", runs: [RUN] },
    [bob]: { institutional_id: "220002", name: "Bob Brown", runs: [RUN] },
    [carol]: { institutional_id: "220003", name: "Carol Brown", runs: [RUN] },
  });
  const enrolled = new Set([alice, bob, carol]);
  return { base, place, store, enrolled, alice, bob, carol };
};

const ITEMS = [
  { item_id: "ITEM-MID-01", assessment_id: EXAM, type: "multiple_choice", number: 1, options: [{ label: "a" }, { label: "b" }] },
  { item_id: "ITEM-MID-02", assessment_id: EXAM, type: "essay", number: 2, options: [] },
];

const VARIANT_ITEMS = [
  { item_id: "ITEM-MID-A1", assessment_id: EXAM, type: "essay", number: 1, extensions: { variant: "A" } },
  { item_id: "ITEM-MID-B1", assessment_id: EXAM, type: "essay", number: 1, extensions: { variant: "B" } },
  { item_id: "ITEM-MID-00", assessment_id: EXAM, type: "essay", number: 2 },
];

const context = (s: ReturnType<typeof setting>, extra: Partial<ApplyContext> = {}): ApplyContext => ({
  place: s.place,
  courseVersionId: RUN,
  assessmentId: EXAM,
  items: ITEMS,
  enrolled: s.enrolled,
  store: s.store,
  salt: SALT,
  now: NOW,
  ...extra,
});

// ------------------------------------------------------------------ pages

test("page ranges read as 1-based pages, in the order written", () => {
  assert.deepEqual(parsePages("1-3"), [1, 2, 3]);
  assert.deepEqual(parsePages("4"), [4]);
  assert.deepEqual(parsePages(4 as never), [4]);
  assert.deepEqual(parsePages("1-2, 5"), [1, 2, 5]);
  assert.throws(() => parsePages("3-1"), /backwards/);
  assert.throws(() => parsePages("one"), /cannot read/);
});

test("a fixed split proposes one paper per N pages, and names a short last one", () => {
  assert.deepEqual(proposePapers(4, { kind: "fixed", pagesPerPaper: 2 }), [{ pages: "1-2" }, { pages: "3-4" }]);
  const short = proposePapers(5, { kind: "fixed", pagesPerPaper: 2 });
  assert.equal(short.length, 3);
  assert.equal(short[2]!.pages, "5");
  assert.match(short[2]!.note!, /only 1 page/);
  assert.deepEqual(proposePapers(3, { kind: "per-file" }), [{ pages: "1-3" }]);
  assert.deepEqual(proposePapers(30, { kind: "read" }), []);
});

// ------------------------------------------------------------------ plan

test("planning lists the inbox, keeps what was written, and re-proposes a changed file", async () => {
  const s = setting();
  writeFileSync(join(s.place.inbox, "batch.pdf"), await pdf(4));
  const first = await planScans(s.place, { courseVersionId: RUN, assessmentId: EXAM }, { kind: "fixed", pagesPerPaper: 2 });
  assert.deepEqual(first.added, ["batch.pdf"]);
  assert.equal(first.plan.sources[0]!.page_count, 4);

  const plan = readPlan(s.place)!;
  plan.sources[0]!.papers[0]!.number = "220001";
  writePlan(s.place, plan);
  writeFileSync(join(s.place.inbox, "late.pdf"), await pdf(2));
  const second = await planScans(s.place, { courseVersionId: RUN, assessmentId: EXAM }, { kind: "per-file" });
  assert.deepEqual(second.kept, ["batch.pdf"]);
  assert.deepEqual(second.added, ["late.pdf"]);
  assert.equal(readPlan(s.place)!.sources[0]!.papers[0]!.number, "220001", "what somebody wrote survives");
  assert.ok(readFileSync(s.place.plan, "utf-8").startsWith("# PRIVATE"));

  writeFileSync(join(s.place.inbox, "batch.pdf"), await pdf(6));
  const third = await planScans(s.place, { courseVersionId: RUN, assessmentId: EXAM }, { kind: "fixed", pagesPerPaper: 2 });
  assert.deepEqual(third.changed, ["batch.pdf"]);
  assert.equal(readPlan(s.place)!.sources[0]!.papers.length, 3);
});

test("every page is used exactly once, and a variant must be one the items carry", () => {
  const source = (papers: any[]) => ({ file: "b.pdf", page_count: 4, checksum: "x", papers });
  assert.match(checkSource(source([{ pages: "1-2" }, { pages: "2-4" }]), []).get(null)!, /in two entries/);
  assert.match(checkSource(source([{ pages: "1-2" }]), []).get(null)!, /3, 4 of b.pdf are in no entry/);
  assert.equal(checkSource(source([{ pages: "1-2" }, { pages: "3-4", skip: "question sheet" }]), []).size, 0);

  const needsVariant = source([{ pages: "1-4" }]);
  assert.match(checkSource(needsVariant, ["A", "B"]).get(needsVariant.papers[0])!, /say which/);
  const wrongVariant = source([{ pages: "1-4", variant: "C" }]);
  assert.match(checkSource(wrongVariant, ["A", "B"]).get(wrongVariant.papers[0])!, /not one of A, B/);
  const noVariants = source([{ pages: "1-4", variant: "A" }]);
  assert.match(checkSource(noVariants, []).get(noVariants.papers[0])!, /no item/);
  const outside = source([{ pages: "1-5" }]);
  assert.match(checkSource(outside, []).get(outside.papers[0])!, /page\(s\) 5 are not in/);
});

test("variants come from the items, and a variant's paper includes the shared questions", () => {
  assert.deepEqual(variantsOf(VARIANT_ITEMS), ["A", "B"]);
  assert.deepEqual(itemsForVariant(VARIANT_ITEMS, "A").map((item) => item.item_id), ["ITEM-MID-A1", "ITEM-MID-00"]);
  assert.deepEqual(variantsOf(ITEMS), []);
});

// ------------------------------------------------------------------ identity

test("a student number resolves through the salt; a name must match one enrolled person", () => {
  const s = setting();
  const known = { store: s.store, salt: SALT, enrolled: s.enrolled };
  assert.deepEqual(identify({ pages: "1", number: "220002" }, known), { student: s.bob });
  assert.deepEqual(identify({ pages: "1", name: "adams, ALICE" }, known), { student: s.alice });
  assert.match((identify({ pages: "1", name: "Brown" }, known) as any).problem, /matches no/);
  assert.match((identify({ pages: "1", number: "999999" }, known) as any).problem, /no student in the roster/);
  assert.match((identify({ pages: "1", number: "220001" }, { ...known, salt: null }) as any).problem, /salt/);
  assert.match((identify({ pages: "1" }, known) as any).problem, /no number, name or student/);
  const outside = { ...known, enrolled: new Set([s.bob]) };
  assert.match((identify({ pages: "1", number: "220001" }, outside) as any).problem, /not enrolled/);
  assert.equal(nameKey("Brown  Bob"), nameKey("bob brown"));
});

test("two people with one name are shown, not chosen between", () => {
  const s = setting();
  s.store.people[pseudonym("220009", SALT)] = { institutional_id: "220009", name: "Alice Adams", runs: [RUN] };
  s.enrolled.add(pseudonym("220009", SALT));
  const result = identify({ pages: "1", name: "Alice Adams" }, { store: s.store, salt: SALT, enrolled: s.enrolled });
  assert.match((result as any).problem, /matches 2 enrolled students/);
});

test("a name in Latin finds its Cyrillic roster entry, with or without the patronymic", () => {
  const s = setting();
  const aigerim = pseudonym("220010", SALT);
  const yerlan = pseudonym("220011", SALT);
  s.store.people[aigerim] = { name: "Ерменбаева Айгерим Қайратқызы", runs: [RUN] };
  s.store.people[yerlan] = { name: "Жақсылықов Ерлан Нұрланұлы", runs: [RUN] };
  s.enrolled.add(aigerim).add(yerlan);
  const known = { store: s.store, salt: SALT, enrolled: s.enrolled };
  assert.deepEqual(identify({ pages: "1", name: "Yermenbayeva Aigerim" }, known), { student: aigerim, match: "words" });
  assert.deepEqual(identify({ pages: "1", name: "Erlan Zhaksylykov" }, known), { student: yerlan, match: "words" });
  assert.deepEqual(identify({ pages: "1", name: "Ермeнбаева Айгерим" }, known), { student: aigerim, match: "words" }, "a Latin e among Cyrillic");
  assert.equal(nameSkeleton("Ерменбаева"), nameSkeleton("Yermenbayeva"));
  assert.equal(nameSkeleton("Қасымова"), nameSkeleton("Kassymova"));
  assert.match((identify({ pages: "1", name: "Aigerim" }, known) as any).problem, /matches no/, "one word is not enough");
});

test("a close spelling is placed only when nobody else is near it", () => {
  const s = setting();
  const aigerim = pseudonym("220010", SALT);
  s.store.people[aigerim] = { name: "Ерменбаева Айгерим Қайратқызы", runs: [RUN] };
  s.enrolled.add(aigerim);
  const known = { store: s.store, salt: SALT, enrolled: s.enrolled };
  assert.deepEqual(identify({ pages: "1", name: "Yermenbaeya Aigerin" }, known), { student: aigerim, match: "close" });

  const twin = pseudonym("220012", SALT);
  s.store.people[twin] = { name: "Ерменбаева Айгерін", runs: [RUN] };
  s.enrolled.add(twin);
  assert.match((identify({ pages: "1", name: "Yermenbaeva Aigeri" }, known) as any).problem, /nearest is .*then/);
  assert.match((identify({ pages: "1", name: "Bob Brownstone" }, known) as any).problem, /nearest is/);
  assert.match((identify({ pages: "1", name: "Zhuldyz Omarova" }, known) as any).problem, /^the name matches no enrolled student$/);
});

test("an email made of the name is a second way to find someone", () => {
  const s = setting();
  const dana = pseudonym("220013", SALT);
  s.store.people[dana] = { name: "Д. С.", email: "dana.seitkali@narxoz.kz", runs: [RUN] };
  s.enrolled.add(dana);
  const known = { store: s.store, salt: SALT, enrolled: s.enrolled };
  assert.deepEqual(identify({ pages: "1", name: "Seitkali Dana" }, known), { student: dana, match: "words" });
});

// ------------------------------------------------------------------ apply

const batchPlan = async (s: ReturnType<typeof setting>, papers: any[], pages = 5): Promise<ScanPlan> => {
  writeFileSync(join(s.place.inbox, "batch.pdf"), await pdf(pages));
  const { plan } = await planScans(s.place, { courseVersionId: RUN, assessmentId: EXAM }, { kind: "read" });
  plan.sources[0]!.papers = papers;
  writePlan(s.place, plan);
  return readPlan(s.place)!;
};

test("apply splits each paper out, records a pseudonymous submission, and files the batch", async () => {
  const s = setting();
  const plan = await batchPlan(s, [
    { pages: "1", skip: "question sheet" },
    { pages: "2-3", number: "220001" },
    { pages: "4-5", name: "Bob Brown" },
  ]);
  const result = await applyScans(plan, context(s));
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.placed.map((entry) => entry.student).sort(), [s.alice, s.bob].sort());
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.finished, ["batch.pdf"]);
  assert.ok(existsSync(join(s.place.done, "batch.pdf")), "a batch fully placed moves to done/");

  const split = await PDFDocument.load(readFileSync(join(s.place.base, s.alice, "scan.pdf")));
  assert.equal(split.getPageCount(), 2);
  const submission = result.submissions.find((entry: any) => entry.student_id === s.alice) as any;
  assert.equal(submission.submission_id, scanSubmissionId(s.alice, EXAM));
  assert.equal(submission.extensions.scan.ref, `private://submissions/${RUN}/${EXAM}/${s.alice}/scan.pdf`);
  assert.ok(!JSON.stringify(result.submissions).includes("Alice"), "no name reaches a record");
  assert.ok(!JSON.stringify(result.submissions).includes("220001"), "no student number reaches a record");

  const transcript = parse(readFileSync(join(s.place.base, s.alice, "transcript.yaml"), "utf-8"));
  assert.deepEqual(transcript.answers.map((answer: any) => answer.item), ["ITEM-MID-01", "ITEM-MID-02"]);
  assert.deepEqual(transcript.answers[0].options, ["a", "b"]);

  const written = readPlan(s.place)!;
  assert.equal(written.sources[0]!.papers[1]!.resolved, s.alice);
});

test("applying again from the same pages changes nothing", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-5", number: "220001" }]);
  await applyScans(plan, context(s));
  const again = await applyScans(readPlan(s.place)!, context(s));
  assert.deepEqual(again.placed, []);
  assert.deepEqual(again.unchanged, [s.alice]);
  assert.equal(again.submissions.length, 1, "the submission is still reported, so the upsert is idempotent");
});

test("a paper that resolves to nobody waits in the plan with its problem, and the rest are placed", async () => {
  const s = setting();
  const plan = await batchPlan(s, [
    { pages: "1-2", number: "220001" },
    { pages: "3-5", name: "Nobody Known" },
  ]);
  const result = await applyScans(plan, context(s));
  assert.deepEqual(result.placed.map((entry) => entry.student), [s.alice]);
  assert.equal(result.problems.length, 1);
  assert.deepEqual(result.finished, [], "a batch with a paper still waiting stays in the inbox");
  assert.ok(existsSync(join(s.place.inbox, "batch.pdf")));
  assert.match(readPlan(s.place)!.sources[0]!.papers[1]!.problem!, /matches no enrolled/);
});

test("pages that do not add up hold the whole batch back", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-2", number: "220001" }, { pages: "4-5", number: "220002" }]);
  const result = await applyScans(plan, context(s));
  assert.deepEqual(result.placed, []);
  assert.match(result.problems[0]!.problem, /page\(s\) 3 .* in no entry/);
});

test("two papers for one student are both held, wherever they are in the pile", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-2", number: "220001" }, { pages: "3-5", name: "Alice Adams" }]);
  const result = await applyScans(plan, context(s));
  assert.deepEqual(result.placed, []);
  assert.equal(result.problems.filter((problem) => /2 papers resolve/.test(problem.problem)).length, 2);
});

test("a different scan for a placed student is refused unless --replace", async () => {
  const s = setting();
  await applyScans(await batchPlan(s, [{ pages: "1-5", number: "220001" }]), context(s));
  writeFileSync(join(s.place.inbox, "rescan.pdf"), await pdf(3));
  const { plan } = await planScans(s.place, { courseVersionId: RUN, assessmentId: EXAM }, { kind: "per-file" });
  plan.sources.find((source) => source.file === "rescan.pdf")!.papers[0]!.number = "220001";
  plan.sources = plan.sources.filter((source) => source.file === "rescan.pdf");
  writePlan(s.place, plan);

  const refused = await applyScans(readPlan(s.place)!, context(s));
  assert.match(refused.problems[0]!.problem, /already has a different scan/);
  const replaced = await applyScans(readPlan(s.place)!, context(s, { replace: true }));
  assert.equal(replaced.placed[0]!.replaced, true);
  assert.equal((await PDFDocument.load(readFileSync(join(s.place.base, s.alice, "scan.pdf")))).getPageCount(), 3);
});

test("a page scanned upside down is turned the way the plan says", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-2", number: "220001", rotate: { "2": 180 } }], 2);
  await applyScans(plan, context(s));
  const split = await PDFDocument.load(readFileSync(join(s.place.base, s.alice, "scan.pdf")));
  assert.deepEqual(split.getPages().map((page) => page.getRotation().angle), [0, 180]);
});

test("a dry run writes nothing, not even the plan's notes", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-5", number: "220001" }]);
  const before = readFileSync(s.place.plan, "utf-8");
  const result = await applyScans(plan, context(s, { dryRun: true }));
  assert.equal(result.placed.length, 1);
  assert.equal(existsSync(join(s.place.base, s.alice)), false);
  assert.equal(readFileSync(s.place.plan, "utf-8"), before);
});

// ------------------------------------------------------------------ record

const transcriptOf = (s: ReturnType<typeof setting>, student: string) => join(s.place.base, student, "transcript.yaml");

const fill = (s: ReturnType<typeof setting>, student: string, answers: any[]): void => {
  const path = transcriptOf(s, student);
  const transcript = parse(readFileSync(path, "utf-8"));
  transcript.read_by = "claude-opus-5-5";
  transcript.answers = transcript.answers.map((answer: any, index: number) => ({ ...answer, ...answers[index] }));
  writeFileSync(path, stringify(transcript));
};

test("a complete transcript becomes draft item responses; an incomplete one is held whole", async () => {
  const s = setting();
  await applyScans(await batchPlan(s, [{ pages: "1-2", number: "220001" }, { pages: "3-5", number: "220002" }]), context(s));
  fill(s, s.alice, [
    { chosen: ["b"], page: 1, confidence: "high" },
    { text: "Because the loss falls.", page: 2, confidence: "low" },
  ]);
  fill(s, s.bob, [{ chosen: ["a"], page: 1, confidence: "high" }]);

  const result = recordTranscripts({ place: s.place, assessmentId: EXAM, items: ITEMS, submitted: new Set([s.alice, s.bob]), now: NOW });
  assert.deepEqual(result.recorded, [s.alice]);
  assert.deepEqual(result.incomplete, [{ student: s.bob, unread: ["ITEM-MID-02"] }]);
  assert.equal(result.responses.length, 2);
  const choice = result.responses.find((response: any) => response.item_id === "ITEM-MID-01") as any;
  assert.equal(choice.approval, "draft");
  assert.deepEqual(choice.chosen_options, ["b"]);
  assert.equal(choice.submission_id, scanSubmissionId(s.alice, EXAM));
  assert.deepEqual(result.low, [{ student: s.alice, item: "ITEM-MID-02", page: 2 }]);
});

test("a blank answer is recorded as blank, and an option not on the paper is refused", async () => {
  const s = setting();
  await applyScans(await batchPlan(s, [{ pages: "1-2", number: "220001" }, { pages: "3-5", number: "220002" }]), context(s));
  fill(s, s.alice, [{ blank: true }, { blank: true }]);
  fill(s, s.bob, [{ chosen: ["z"], page: 1, confidence: "high" }, { blank: true }]);
  const result = recordTranscripts({ place: s.place, assessmentId: EXAM, items: ITEMS, submitted: new Set([s.alice, s.bob]), now: NOW });
  assert.deepEqual(result.recorded, [s.alice]);
  assert.equal(result.blank, 2);
  assert.equal((result.responses[0] as any).raw_response, "");
  assert.match(result.invalid[0]!.problem, /option\(s\) z are not on the paper/);
});

test("a transcript is refused before the scan has a submission in the course", async () => {
  const s = setting();
  await applyScans(await batchPlan(s, [{ pages: "1-5", number: "220001" }]), context(s));
  fill(s, s.alice, [{ blank: true }, { blank: true }]);
  const result = recordTranscripts({ place: s.place, assessmentId: EXAM, items: ITEMS, submitted: new Set(), now: NOW });
  assert.match(result.invalid[0]!.problem, /no submission/);
});

test("a variant's transcript lists its own questions and the shared ones, and nothing else", async () => {
  const s = setting();
  const plan = await batchPlan(s, [{ pages: "1-2", number: "220001", variant: "B" }, { pages: "3-5", skip: "spare" }]);
  await applyScans(plan, context(s, { items: VARIANT_ITEMS }));
  const transcript = parse(readFileSync(transcriptOf(s, s.alice), "utf-8"));
  assert.equal(transcript.variant, "B");
  assert.deepEqual(transcript.answers.map((answer: any) => answer.item), ["ITEM-MID-B1", "ITEM-MID-00"]);
});

// ------------------------------------------------------------------ status

test("status counts each step and names who has no scan", async () => {
  const s = setting();
  await applyScans(await batchPlan(s, [{ pages: "1-5", number: "220001" }]), context(s));
  const status = scanStatus(s.place, s.enrolled);
  assert.deepEqual(status.placed, [s.alice]);
  assert.deepEqual(status.transcribed, []);
  assert.deepEqual(status.missing, [s.bob, s.carol].sort());
});

// ------------------------------------------------------------------ before the assessment is known

test("the run's assessments rank against the cover, and a contradicting number weighs against", () => {
  const assessments = [
    { assessment_id: "ASSESSMENT-QUIZ-02", title: "Quiz 2 - Regression", type: "quiz", delivery: "paper_exam" },
    { assessment_id: "ASSESSMENT-QUIZ-03", title: "Quiz 3 - Classification", type: "quiz", delivery: "paper_exam", due_at: "2026-10-21T10:00:00+05:00" },
    { assessment_id: "ASSESSMENT-HW-01", title: "Homework 1", type: "assignment", delivery: "github_repo" },
  ];
  const items = [{ item_id: "ITEM-QUIZ-03-01", assessment_id: "ASSESSMENT-QUIZ-03", extensions: { variant: "A" } }];
  const ranked = rankAssessments(assessments, items, { title: "QUIZ №3 Classification", date: "2026-10-20" });
  assert.equal(ranked[0]!.assessment_id, "ASSESSMENT-QUIZ-03");
  assert.equal(ranked[0]!.questions, 1);
  assert.deepEqual(ranked[0]!.variants, ["A"]);
  assert.ok(ranked[0]!.reasons.some((reason) => /due within/.test(reason)));
  const two = ranked.find((entry) => entry.assessment_id === "ASSESSMENT-QUIZ-02")!;
  assert.ok(two.reasons.some((reason) => /not the cover's/.test(reason)));
  assert.equal(ranked.at(-1)!.assessment_id, "ASSESSMENT-HW-01");
});

test("filing moves a PDF from the run's inbox to the assessment's, and refuses a clash", async () => {
  const s = setting();
  const inbox = runInbox(join(s.base, "submissions"), RUN);
  mkdirSync(inbox, { recursive: true });
  writeFileSync(join(inbox, "pile.pdf"), await pdf(3));
  assert.deepEqual(await unfiledScans(inbox), [{ file: "pile.pdf", page_count: 3 }]);
  fileScan(inbox, "pile.pdf", s.place);
  assert.ok(existsSync(join(s.place.inbox, "pile.pdf")));
  assert.ok(!existsSync(join(inbox, "pile.pdf")));
  writeFileSync(join(inbox, "pile.pdf"), await pdf(4));
  assert.throws(() => fileScan(inbox, "pile.pdf", s.place), /already has a different/);
  assert.throws(() => fileScan(inbox, "../x.pdf", s.place), /not a path/);
});

// ------------------------------------------------------------------ answers

test("answers group by what was marked or written, case and punctuation aside", () => {
  const items = [
    { item_id: "ITEM-MID-01", type: "multiple_choice", number: 1, maximum_score: 1, prompt: "Pick", options: [{ label: "a", correct: false }, { label: "b", correct: true }] },
    { item_id: "ITEM-MID-02", type: "essay", number: 2, maximum_score: 5, prompt: "Why?", options: [] },
  ];
  const responses = [
    { item_id: "ITEM-MID-01", student_id: "STUDENT-A", chosen_options: ["b"] },
    { item_id: "ITEM-MID-01", student_id: "STUDENT-B", chosen_options: ["a"] },
    { item_id: "ITEM-MID-01", student_id: "STUDENT-C", chosen_options: ["b"] },
    { item_id: "ITEM-MID-02", student_id: "STUDENT-A", raw_response: "Overfitting." },
    { item_id: "ITEM-MID-02", student_id: "STUDENT-B", raw_response: "overfitting", extensions: { scan: { confidence: "low" } } },
    { item_id: "ITEM-MID-02", student_id: "STUDENT-C", raw_response: "", extensions: { scan: { blank: true } } },
  ];
  const [choice, written] = groupAnswers(items, responses);
  assert.deepEqual(choice!.groups.map((group) => [group.text, group.count, group.correct]), [["b", 2, true], ["a", 1, false]]);
  assert.equal(written!.blank, 1);
  assert.equal(written!.groups.length, 1);
  assert.equal(written!.groups[0]!.count, 2);
  assert.equal(written!.groups[0]!.low_confidence, 1);
  assert.equal(answerKey("  The  Learning rate!! "), "the learning rate");
});
