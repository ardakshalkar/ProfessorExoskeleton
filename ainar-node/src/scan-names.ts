/**
 * Reading who wrote each paper off its cover: `ainar scans names`.
 *
 * `scans plan` splits a pile into page ranges and `scans apply` matches a
 * written name to the roster; both are deterministic. Between them sat the one
 * step with no command: someone had to look at every cover and type the name
 * into the plan. On 2026-10-05 an agent asked to do that for a 102-page pile
 * tried Windows OCR instead, which cannot read handwriting, and left 51 papers
 * without a name. This is that step as a command, on the same vision route
 * `scans read` uses, so reading a cover is the same judgement made the same way
 * every time.
 *
 * What it sends: the top of each paper's first page only — the edge down to
 * 2.6 inches, where the title, the Name line and anything written above the
 * title are — at 200 dpi, cut into bands under the route's pixel cap. Nothing
 * below that strip leaves the machine at this step.
 *
 * What it writes: `name` or `number` into the plan as read, `also` for every
 * other name on the cover (Quiz 2 of CSS-4007 had a full name above the title
 * and only a first name on the Name line), with `confidence` and `read_by`,
 * and a `note` when the reading needs a person: no name found, a name in
 * another hand,
 * a first page that is not a cover (the split has drifted), a low-confidence
 * read. It never writes `student`: matching stays `scans apply`'s, and a paper
 * someone has already said who it is (name, number or student) is left alone
 * unless `--force` asks for it to be read again. The replies are kept in the
 * private `_inbox/names.json`.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { bandLayout, estimateCost, parseReply, type ContentPart, type Reader, type Usage } from "./scan-read.ts";
import { nameKey, parsePages, readPlan, writePlan, type PlanPaper, type ScanPlace } from "./scans.ts";

const run = promisify(execFile);

/** From the top edge down: room for a name written above the title, and the Name line under it. */
export const COVER_INCHES = 2.6;

/** The top of one page, rendered into bands; the paths of the PNGs, top to bottom. */
export const renderCover = async (pdf: string, page: number, work: string, options: { dpi?: number } = {}): Promise<string[]> => {
  const dpi = options.dpi ?? 200;
  mkdirSync(work, { recursive: true });
  const document = await PDFDocument.load(readFileSync(pdf), { ignoreEncryption: true });
  const sheet = document.getPage(page - 1);
  const turned = sheet.getRotation().angle % 180 !== 0;
  const { width: w, height: h } = sheet.getSize();
  const width = Math.floor(((turned ? h : w) * dpi) / 72);
  const height = Math.min(Math.floor(((turned ? w : h) * dpi) / 72), Math.round(COVER_INCHES * dpi));
  const bands: string[] = [];
  for (const [number, band] of bandLayout(width, height, { minBands: 1 }).entries()) {
    const out = join(work, `p${page}-b${number}`);
    try {
      await run(
        "pdftoppm",
        ["-png", "-r", String(dpi), "-f", String(page), "-l", String(page), "-x", "0", "-y", String(band.y), "-W", String(width), "-H", String(band.height), "-singlefile", pdf, out],
        { windowsHide: true },
      );
    } catch (error: any) {
      if (error?.code === "ENOENT") throw new Error("pdftoppm is not on PATH — install poppler (it renders the scan pages)");
      throw error;
    }
    bands.push(`${out}.png`);
  }
  return bands;
};

export const buildNamePrompt = (context: { title: string; courseId: string; variants: string[] }): string =>
  [
    "This is the top of the first page of ONE student's handwritten university exam paper,",
    `course ${context.courseId}, assessment '${context.title}'. It is attached as overlapping horizontal bands, top to bottom.`,
    "",
    "Return ONE JSON object and nothing else. No markdown fence, no commentary. Exactly these keys:",
    "{",
    '  "printed_title": "the printed heading of the paper, verbatim; empty string if there is none",',
    '  "is_first_page": true if this is the first page of the paper (its printed heading and Name line are on it), else false,',
    '  "name_as_written": "the student\'s handwritten name on the Name line; empty string if there is none or it is unreadable",',
    '  "other_names": [ { "text": "any other handwritten name in the strip, as written", "where": "above the title" | "in a margin" | "beside the date" | "elsewhere", "same_hand": true if it looks like the same handwriting as the Name line, else false } ],',
    '  "number_as_written": "a handwritten student or ID number, digits only; else empty string",',
    ...(context.variants.length
      ? [`  "variant_as_printed": "the version printed or written on the paper, one of ${context.variants.join(", ")}; else empty string",`]
      : []),
    '  "confidence": "high" | "medium" | "low",',
    '  "note": "anything a person should know (two names, a crossed-out name, a name that is only a first name); else empty string"',
    "}",
    "",
    "Rules:",
    "- The name is usually on the Name line, but a student may write it anywhere near the top: above the title, in a margin, beside the date. Look everywhere in the strip.",
    "- Every handwritten name that is not the Name line's goes in other_names, even when it repeats it in full (a surname added above the title). An empty list when there are none. If the Name line is empty, the name found elsewhere is name_as_written and not repeated in other_names.",
    "- Write the name in the script it is written in, letter for letter. Do not transliterate, translate, correct or complete it.",
    "- Never invent a name. If you cannot read it, return an empty string and say so in note.",
    "- confidence is about how sure you are of every letter of the name, not of anything else.",
  ].join("\n");

export const nameRequest = (prompt: string, bands: string[], read: (path: string) => Buffer = readFileSync): ContentPart[] => [
  { type: "text", text: prompt },
  ...bands.flatMap((band, index): ContentPart[] => [
    { type: "text", text: `Band ${index}:` },
    { type: "image_url", image_url: { url: `data:image/png;base64,${read(band).toString("base64")}` } },
  ]),
];

const CONFIDENCE = new Set(["high", "medium", "low"]);
const said = (paper: PlanPaper): boolean => Boolean(paper.name || paper.also?.length || paper.number || paper.student);

/**
 * Write one reading into a plan entry. Returns what a person should look at,
 * empty when the reading can go to `scans apply` as it is.
 */
export const fillPaper = (
  paper: PlanPaper,
  reading: any,
  context: { readBy: string; variants: string[] },
): { paper: PlanPaper; problems: string[] } => {
  const problems: string[] = [];
  const name = typeof reading?.name_as_written === "string" ? reading.name_as_written.replace(/\s+/g, " ").trim() : "";
  const digits = typeof reading?.number_as_written === "string" ? reading.number_as_written.replace(/\s+/g, "") : "";
  const number = /^\d{4,}$/.test(digits) ? digits : "";
  const confidence = CONFIDENCE.has(reading?.confidence) ? reading.confidence : "low";
  // A range whose first page is not a cover is somebody else's pages: a name
  // read off it would place them on the wrong student, so it is not written and
  // `apply` holds the paper.
  const cover = reading?.is_first_page !== false;
  // Every other name on the cover, kept apart from the Name line's: a full name
  // above the title can place a paper whose Name line has only a first name,
  // and one in another hand can say someone wrote for someone else.
  const others = (Array.isArray(reading?.other_names) ? reading.other_names : [])
    .map((entry: any) => ({
      text: typeof entry?.text === "string" ? entry.text.replace(/\s+/g, " ").trim() : "",
      where: typeof entry?.where === "string" ? entry.where.trim() : "",
      other_hand: entry?.same_hand === false,
    }))
    .filter((entry: { text: string }) => entry.text && (!name || nameKey(entry.text) !== nameKey(name)));
  const next: PlanPaper = { ...paper };
  delete next.name;
  delete next.number;
  delete next.note;
  delete next.also;
  if (cover && number) next.number = number;
  if (cover && name) next.name = name;
  if (cover && others.length) next.also = [...new Set<string>(others.map((entry: { text: string }) => entry.text))];
  next.confidence = confidence;
  next.read_by = context.readBy;
  // A note `plan` wrote (a short last range) survives; one an earlier reading wrote is replaced.
  const notes: string[] = paper.note && !paper.read_by ? [paper.note] : [];
  if (!cover) {
    notes.push("this range's first page does not look like a cover — the split may have drifted here");
    problems.push("not a cover");
  } else if (!name && !number && !others.length) {
    notes.push("no name or number found on the cover — for the professor to place");
    problems.push("no name");
  } else if (confidence === "low") {
    notes.push("name read with low confidence — check it against the crop");
    problems.push("low confidence");
  }
  if (cover) {
    for (const other of others as { text: string; where: string; other_hand: boolean }[]) {
      notes.push(`also written: "${other.text}"${other.where ? ` ${other.where}` : ""}${other.other_hand ? ", in another hand" : ""}`);
      if (other.other_hand) problems.push("a name in another hand");
    }
  }
  const variant = typeof reading?.variant_as_printed === "string" ? reading.variant_as_printed.trim() : "";
  if (variant && !next.variant && context.variants.includes(variant)) next.variant = variant;
  const remark = typeof reading?.note === "string" ? reading.note.trim() : "";
  if (remark) notes.push(`model: ${remark}`);
  if (notes.length) next.note = notes.join("; ");
  return { paper: next, problems };
};

export interface NameRead {
  file: string;
  pages: string;
  status: "named" | "check" | "unparsed" | "failed";
  problems: string[];
  confidence?: string;
  usage?: Usage;
  usd?: number;
  ms?: number;
}

/** The plan entries a run would read: unplaced, not skipped, and nobody has said who yet. */
export const nameTargets = (
  place: ScanPlace,
  options: { force?: boolean } = {},
): { file: string; pages: string }[] => {
  const plan = readPlan(place);
  if (!plan) return [];
  return plan.sources.flatMap((source) =>
    source.papers
      .filter((paper) => !paper.skip && !paper.resolved && !paper.student && (options.force || !said(paper)))
      .map((paper) => ({ file: source.file, pages: String(paper.pages) })),
  );
};

export interface NamesContext {
  place: ScanPlace;
  title: string;
  courseId: string;
  variants: string[];
  reader: Reader;
  model: string;
  effort: string;
  force?: boolean;
  concurrency?: number;
  now: string;
  render?: typeof renderCover;
  onPaper?: (result: NameRead) => void;
}

export const readNames = async (context: NamesContext): Promise<NameRead[]> => {
  const plan = readPlan(context.place);
  if (!plan) throw new Error(`no plan in ${context.place.inbox} — run \`scans plan\` first`);
  const targets = nameTargets(context.place, context);
  const render = context.render ?? renderCover;
  const readBy = `${context.model} · effort ${context.effort} · ${context.now.slice(0, 10)}`;
  const prompt = buildNamePrompt(context);
  const logPath = join(context.place.inbox, "names.json");
  const log: Record<string, unknown> = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf-8")) : {};
  const results: NameRead[] = [];
  let next = 0;

  const readOne = async ({ file, pages }: { file: string; pages: string }): Promise<NameRead> => {
    const pdf = join(context.place.inbox, file);
    const work = join(context.place.inbox, "_render", `names-${file}-${pages}`.replace(/[^\w.-]/g, "_"));
    try {
      const first = parsePages(pages)[0]!;
      const bands = await render(pdf, first, work);
      const reply = await context.reader(nameRequest(prompt, bands));
      const reading = parseReply(reply.text);
      const usd = estimateCost(reply.usage, new Date(reply.at));
      log[`${file}#${pages}`] = { read_by: readBy, served_by: reply.model, at: reply.at, ms: reply.ms, usage: reply.usage, reading, raw: reading ? undefined : reply.text };
      const base = { file, pages, usage: reply.usage, usd, ms: reply.ms };
      if (!reading) return { ...base, status: "unparsed", problems: ["the reply was not JSON — kept in names.json"] };
      const source = plan.sources.find((entry) => entry.file === file)!;
      const index = source.papers.findIndex((paper) => String(paper.pages) === pages);
      const filled = fillPaper(source.papers[index]!, reading, { readBy, variants: context.variants });
      source.papers[index] = filled.paper;
      return { ...base, status: filled.problems.length ? "check" : "named", problems: filled.problems, confidence: filled.paper.confidence };
    } catch (error) {
      return { file, pages, status: "failed", problems: [(error as Error).message] };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, context.concurrency ?? 6) }, async () => {
      while (next < targets.length) {
        const result = await readOne(targets[next++]!);
        results.push(result);
        context.onPaper?.(result);
      }
    }),
  );
  rmSync(join(context.place.inbox, "_render"), { recursive: true, force: true });
  writePlan(context.place, plan);
  writeFileSync(logPath, JSON.stringify(log, null, 1) + "\n");
  const order = (entry: NameRead) => `${entry.file}#${String(parsePages(entry.pages)[0]).padStart(5, "0")}`;
  return results.sort((a, b) => order(a).localeCompare(order(b)));
};
