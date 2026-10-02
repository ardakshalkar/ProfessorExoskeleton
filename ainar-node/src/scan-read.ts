/**
 * Reading scanned papers with a vision model: `ainar scans read`.
 *
 * `src/scans.ts` does the deterministic half of a scanned exam and calls no
 * model. This is the other half, the one step that does: each placed paper's
 * `scan.pdf` is rendered, sent to DeepSeek's vision route once, and what comes
 * back fills that student's `transcript.yaml` — which `scans record` then
 * checks rather than trusts, and records as `approval: draft`.
 *
 * How a page is shown to the model. The vision route caps one image at 640,000
 * pixels and 1 MiB, so a whole A4 page fits only at about 110 dpi — too coarse
 * for cursive. Each page is instead rendered at 200 dpi and cut into at least
 * eight overlapping horizontal bands, each under the cap, all sent in order in
 * one request. That is the layout the 2026-10-01 Quiz 1 pile was read with.
 *
 * Reasoning effort is `low` by default. On a 12-paper sample of that pile
 * (2026-10-02), `low` agreed with `high` as closely as two `high` runs agree
 * with each other, for 28% less and 30% faster; `off` was ten times cheaper
 * but wrote longer answers than were on the page, so it is offered and not
 * the default.
 *
 * A page with next to no ink — the blank back of a sheet — is not sent; the
 * model is told it was blank. `--all-pages` sends every page regardless.
 *
 * Privacy: page images and every reading stay in the private submissions
 * folder (`<STUDENT>/reading.json` beside the transcript). The model provider
 * is the one reach outside this machine, and it is the same one the harness
 * already reads scans through.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { parse, stringify } from "yaml";
import { itemsForVariant, type ScanPlace } from "./scans.ts";

const run = promisify(execFile);

// --------------------------------------------------------------------------
// The model route
// --------------------------------------------------------------------------

export const DEFAULT_MODEL = "deepseek-v4-flash-vision-exp";
export const EFFORTS = ["off", "low", "high", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * DeepSeek Flash list prices, $ per million tokens, read 2026-10-02 from
 * api-docs.deepseek.com/quick_start/pricing. Only the estimate printed at the
 * end uses them; nothing is billed by this table.
 */
const FLASH_PRICE = { hit: 0.006, miss: 0.3, out: 1.2 };

/** Peak is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday; otherwise half price. */
export const isPeak = (at: Date): boolean => {
  const day = at.getUTCDay();
  const hour = at.getUTCHours();
  return day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
};

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

export const estimateCost = (usage: Usage, at: Date): number => {
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.prompt_cache_miss_tokens ?? Math.max(0, (usage.prompt_tokens ?? 0) - hit);
  const usd = (hit * FLASH_PRICE.hit + miss * FLASH_PRICE.miss + (usage.completion_tokens ?? 0) * FLASH_PRICE.out) / 1e6;
  return isPeak(at) ? usd : usd / 2;
};

/**
 * The API key: `DEEPSEEK_API_KEY`, else the one the harness holds in
 * `<checkout>/.dsh/.credentials.yaml` under `refs`. Never printed.
 */
export const deepseekKey = (checkout: string, env: NodeJS.ProcessEnv = process.env): string | null => {
  const fromEnv = (env.DEEPSEEK_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  const file = join(checkout, ".dsh", ".credentials.yaml");
  if (!existsSync(file)) return null;
  const value = (parse(readFileSync(file, "utf-8")) as any)?.refs?.DEEPSEEK_API_KEY;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ModelReply {
  text: string;
  model: string;
  usage: Usage;
  ms: number;
  at: string;
}

export type Reader = (content: ContentPart[]) => Promise<ModelReply>;

/** One chat request to DeepSeek, mapped the way dsh-llm-deepseek maps effort. */
export const deepseekReader = (options: {
  apiKey: string;
  model: string;
  effort: Effort;
  baseURL?: string;
  fetch?: typeof fetch;
}): Reader => {
  const base = (options.baseURL ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const call = options.fetch ?? fetch;
  return async (content) => {
    const body = {
      model: options.model,
      messages: [{ role: "user", content }],
      max_tokens: 32000,
      stream: false,
      // `off` is the adapter's word for thinking disabled; the rest are the wire's own.
      ...(options.effort === "off" ? { thinking: { type: "disabled" } } : { reasoning_effort: options.effort }),
    };
    for (let attempt = 1; ; attempt += 1) {
      const started = new Date();
      const response = await call(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
          await new Promise((done) => setTimeout(done, 2000 * attempt));
          continue;
        }
        throw new Error(`DeepSeek answered ${response.status}: ${detail}`);
      }
      const json: any = await response.json();
      return {
        text: String(json.choices?.[0]?.message?.content ?? ""),
        model: String(json.model ?? options.model),
        usage: json.usage ?? {},
        ms: Date.now() - started.getTime(),
        at: started.toISOString(),
      };
    }
  };
};

// --------------------------------------------------------------------------
// Rendering a page into bands
// --------------------------------------------------------------------------

export interface Band {
  y: number;
  height: number;
}

/**
 * Horizontal bands covering a page `width` × `height` pixels, each within the
 * pixel budget, overlapping so a line cut by one band is whole in the next.
 */
export const bandLayout = (
  width: number,
  height: number,
  options: { pixelBudget?: number; minBands?: number; overlap?: number } = {},
): Band[] => {
  const budget = options.pixelBudget ?? 640_000;
  const overlap = options.overlap ?? 48;
  const tallest = Math.floor(budget / width);
  if (tallest <= overlap * 2) throw new Error(`a ${width} px wide page cannot be banded within ${budget} pixels`);
  const count = Math.max(options.minBands ?? 8, Math.ceil((height - overlap) / (tallest - overlap)));
  const step = (height - overlap) / count;
  const bandHeight = Math.min(tallest, Math.ceil(step + overlap));
  const bands: Band[] = [];
  for (let index = 0; index < count; index += 1) {
    const y = Math.round(index * step);
    bands.push({ y, height: Math.min(bandHeight, height - y) });
  }
  return bands;
};

const pdftoppm = async (args: string[]): Promise<void> => {
  try {
    await run("pdftoppm", args, { windowsHide: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error("pdftoppm is not on PATH — install poppler (it renders the scan pages)");
    }
    throw error;
  }
};

/**
 * Share of inked pixels on a page rendered small and grey: ~0 for a blank back.
 * At 24 dpi a pen stroke blurs to light grey, so "inked" is anything below 75%
 * of white, not only near-black.
 */
export const inkShare = (pgm: Buffer): number => {
  // Binary PGM: "P5", width, height, maxval, one whitespace byte, then pixels.
  const header = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(pgm.subarray(0, 64).toString("latin1"));
  if (!header) throw new Error("pdftoppm did not write a binary PGM");
  const pixels = pgm.subarray(header[0].length);
  const max = Number(header[3]);
  let inked = 0;
  for (const value of pixels) if (value < max * 0.75) inked += 1;
  return pixels.length ? inked / pixels.length : 0;
};

/**
 * Below this share a page is taken as blank. On the Quiz 1 pile (61 papers,
 * 2026-10-02) written pages measured 0.023-0.06 and blank backs at most
 * 0.0002, so this sits an order of magnitude from both.
 */
export const BLANK_INK = 0.003;

export interface RenderedPage {
  page: number;
  blank: boolean;
  ink: number;
  bands: string[];
}

/** Render every page of `pdf` into bands under `work`; blank pages are measured, not banded. */
export const renderPaper = async (
  pdf: string,
  work: string,
  options: { dpi?: number; allPages?: boolean } = {},
): Promise<RenderedPage[]> => {
  const dpi = options.dpi ?? 200;
  mkdirSync(work, { recursive: true });
  const document = await PDFDocument.load(readFileSync(pdf), { ignoreEncryption: true });
  const pages: RenderedPage[] = [];
  for (let index = 0; index < document.getPageCount(); index += 1) {
    const page = index + 1;
    const probe = join(work, `ink-${page}`);
    await pdftoppm(["-gray", "-r", "24", "-f", String(page), "-l", String(page), "-singlefile", pdf, probe]);
    const ink = inkShare(readFileSync(`${probe}.pgm`));
    if (!options.allPages && ink < BLANK_INK) {
      pages.push({ page, blank: true, ink, bands: [] });
      continue;
    }
    const sheet = document.getPage(index);
    const turned = sheet.getRotation().angle % 180 !== 0;
    const { width: w, height: h } = sheet.getSize();
    const width = Math.floor(((turned ? h : w) * dpi) / 72);
    const height = Math.floor(((turned ? w : h) * dpi) / 72);
    const bands: string[] = [];
    for (const [number, band] of bandLayout(width, height).entries()) {
      const out = join(work, `p${page}-b${number}`);
      await pdftoppm([
        "-png", "-r", String(dpi), "-f", String(page), "-l", String(page),
        "-x", "0", "-y", String(band.y), "-W", String(width), "-H", String(band.height),
        "-singlefile", pdf, out,
      ]);
      bands.push(`${out}.png`);
    }
    pages.push({ page, blank: false, ink, bands });
  }
  return pages;
};

// --------------------------------------------------------------------------
// The request and the reply
// --------------------------------------------------------------------------

const questionLine = (item: any): string => {
  const options = (item.options ?? []).length
    ? `  Options: ${item.options.map((option: any) => `${option.label}) ${String(option.text ?? "").trim()}`).join("  ")}`
    : "";
  const marks = item.maximum_score != null ? ` [${item.maximum_score} marks]` : "";
  const kind = (item.options ?? []).length ? "choice" : "written";
  return `- item ${item.item_id} (Q${item.number ?? "?"}, ${kind})${marks}: ${String(item.prompt ?? "").replace(/\s+/g, " ").trim()}${options}`;
};

export const buildPrompt = (context: { title: string; courseId: string; items: any[]; pages: RenderedPage[] }): string =>
  [
    "You are transcribing ONE student's handwritten university exam paper.",
    `Course ${context.courseId}, assessment '${context.title}'.`,
    `The paper has ${context.pages.length} page(s). Each page with writing on it is attached as overlapping horizontal bands, top to bottom, labelled by page and band.`,
    ...context.pages.filter((page) => page.blank).map((page) => `Page ${page.page} is blank and is not attached.`),
    "",
    "The questions on this paper:",
    ...context.items.map(questionLine),
    "",
    "Return ONE JSON object and nothing else. No markdown fence, no commentary. Exactly these keys:",
    "{",
    '  "printed_title": "the printed heading at the top of the first page, verbatim",',
    '  "name_as_written": "the handwritten Name field, as carefully as you can; empty string if unreadable",',
    '  "name_confidence": "high" | "medium" | "low",',
    '  "number_as_written": "a handwritten student number, if there is one; else empty string",',
    '  "group_as_written": "the handwritten Group field; empty string if unreadable",',
    '  "answers": [ {"item": "<item id>", "text": "...", "chosen": [], "page": 1, "blank": false, "confidence": "high", "note": ""}, ... one per question above ]',
    "}",
    "",
    "Rules for the answers:",
    "- written questions: text is what is written, word for word, keeping the student's own spelling and grammar. If they wrote in Russian or Kazakh, transcribe in that language - do NOT translate.",
    "- choice questions: chosen lists the option labels marked; text is an empty string.",
    "- A question with lettered parts: put every part in one text, each prefixed 'a) ', 'b) ' ... in order; omit a part they did not write.",
    "- page is the page (1-based) the answer is on.",
    "- If a question's space is empty, set blank true, text to an empty string and chosen to [].",
    "- Never correct, improve, summarise, grade or translate. Confidence is about your reading of the handwriting, not the quality of the answer.",
    "- Where a word is genuinely unreadable, write [illegible] rather than guessing a plausible word.",
    "- note: anything a checker should know (crossed-out text, an answer written beside another question); else empty string.",
  ].join("\n");

export const requestContent = (prompt: string, pages: RenderedPage[], read: (path: string) => Buffer = readFileSync): ContentPart[] => {
  const content: ContentPart[] = [{ type: "text", text: prompt }];
  for (const page of pages) {
    page.bands.forEach((band, index) => {
      content.push({ type: "text", text: `Page ${page.page}, band ${index}:` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${read(band).toString("base64")}` } });
    });
  }
  return content;
};

/** The JSON object in a reply, fenced or not; null when there is none. */
export const parseReply = (text: string): any | null => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

// --------------------------------------------------------------------------
// Filling the transcript
// --------------------------------------------------------------------------

/** A transcript nobody has read yet: every entry as `scans apply` wrote it. */
export const isUnread = (transcript: any): boolean =>
  !transcript?.read_by &&
  (transcript?.answers ?? []).every(
    (answer: any) => (answer.text == null || answer.text === "") && !answer.blank && !(answer.chosen ?? []).length && !answer.confidence,
  );

const CONFIDENCE = new Set(["high", "medium", "low"]);

/**
 * Write a reading into a transcript's entries. An answer the reply leaves out,
 * or reads as an option the paper does not have, stays unread with a note —
 * `scans record` then holds that student back rather than record half a paper.
 */
export const fillTranscript = (
  transcript: any,
  reading: any,
  context: { items: any[]; readBy: string; pageCount: number },
): { transcript: any; problems: string[] } => {
  const byItem = new Map<string, any>();
  for (const answer of Array.isArray(reading?.answers) ? reading.answers : []) {
    if (answer && typeof answer.item === "string") byItem.set(answer.item, answer);
  }
  const byNumber = new Map<number, any>();
  for (const answer of Array.isArray(reading?.answers) ? reading.answers : []) {
    const number = Number(answer?.number ?? String(answer?.item ?? "").match(/^Q?(\d+)$/i)?.[1]);
    if (Number.isFinite(number)) byNumber.set(number, answer);
  }
  const items = new Map(context.items.map((item) => [item.item_id, item]));
  const problems: string[] = [];
  const answers = (transcript.answers ?? []).map((entry: any) => {
    const item = items.get(entry.item);
    const read = byItem.get(entry.item) ?? (entry.number != null ? byNumber.get(Number(entry.number)) : undefined);
    if (!item || !read) {
      problems.push(`${entry.item}: not in the reading`);
      return { ...entry, note: "not in the model's reading — read it by hand" };
    }
    const page = Number.isInteger(read.page) && read.page >= 1 && read.page <= context.pageCount ? read.page : null;
    const confidence = CONFIDENCE.has(read.confidence) ? read.confidence : "low";
    const note = typeof read.note === "string" && read.note.trim() ? read.note.trim() : null;
    if (read.blank === true) return { ...entry, ...(entry.chosen ? { chosen: [] } : { text: null }), page, blank: true, confidence, note };
    if (entry.options) {
      const labels = new Set(entry.options.map(String));
      const chosen = (Array.isArray(read.chosen) ? read.chosen : []).map(String);
      const unknown = chosen.filter((label: string) => !labels.has(label));
      if (!chosen.length || unknown.length) {
        problems.push(`${entry.item}: ${chosen.length ? `option(s) ${unknown.join(", ")} not on the paper` : "no option read"}`);
        return { ...entry, note: `the model read ${chosen.length ? chosen.join(", ") : "nothing"} — check by hand` };
      }
      return { ...entry, chosen, page, blank: false, confidence, note };
    }
    const text = typeof read.text === "string" ? read.text.trim() : "";
    if (!text) {
      problems.push(`${entry.item}: no text and not marked blank`);
      return { ...entry, note: "the model returned no text — read it by hand" };
    }
    return { ...entry, text, page, blank: false, confidence, note };
  });
  return { transcript: { ...transcript, read_by: context.readBy, answers }, problems };
};

const writeTranscript = (path: string, transcript: any): void => {
  const raw = readFileSync(path, "utf-8");
  const header = raw.slice(0, Math.max(0, raw.indexOf("student_id:")));
  writeFileSync(path, header + stringify(transcript, { lineWidth: 0 }), "utf-8");
};

// --------------------------------------------------------------------------
// The command
// --------------------------------------------------------------------------

export interface PaperRead {
  student: string;
  status: "read" | "partly read" | "unparsed" | "failed";
  problems: string[];
  pages: number;
  blank_pages: number;
  usage?: Usage;
  usd?: number;
  ms?: number;
  name_confidence?: string;
}

export interface ReadContext {
  place: ScanPlace;
  title: string;
  courseId: string;
  items: any[];
  reader: Reader;
  model: string;
  effort: Effort;
  /** Only these students; otherwise every placed paper with an unread transcript. */
  students?: string[];
  /** Read a transcript that has been read before, replacing what it holds. */
  force?: boolean;
  allPages?: boolean;
  concurrency?: number;
  now: string;
  render?: typeof renderPaper;
  onPaper?: (result: PaperRead) => void;
}

/** The placed papers this run would read, and why the others are left alone. */
export const readTargets = (
  place: ScanPlace,
  options: { students?: string[]; force?: boolean },
): { targets: string[]; skipped: { student: string; why: string }[] } => {
  const targets: string[] = [];
  const skipped: { student: string; why: string }[] = [];
  const placed = existsSync(place.base) ? readdirSync(place.base).filter((name) => name.startsWith("STUDENT-")).sort() : [];
  for (const student of options.students ?? placed) {
    const folder = join(place.base, student);
    if (!existsSync(join(folder, "scan.pdf")) || !existsSync(join(folder, "transcript.yaml"))) {
      skipped.push({ student, why: "no placed scan — run `scans apply` first" });
      continue;
    }
    const transcript = parse(readFileSync(join(folder, "transcript.yaml"), "utf-8"));
    if (!options.force && !isUnread(transcript)) {
      skipped.push({ student, why: `already read${transcript?.read_by ? ` (${transcript.read_by})` : ""} — --force to read again` });
      continue;
    }
    targets.push(student);
  }
  return { targets, skipped };
};

export const readScans = async (context: ReadContext): Promise<{ results: PaperRead[]; skipped: { student: string; why: string }[] }> => {
  const { targets, skipped } = readTargets(context.place, context);
  const render = context.render ?? renderPaper;
  const readBy = `${context.model} · effort ${context.effort} · ${context.now.slice(0, 10)}`;
  const results: PaperRead[] = [];
  let next = 0;

  const readOne = async (student: string): Promise<PaperRead> => {
    const folder = join(context.place.base, student);
    const transcriptPath = join(folder, "transcript.yaml");
    const transcript = parse(readFileSync(transcriptPath, "utf-8"));
    const items = itemsForVariant(context.items, transcript.variant ?? undefined);
    const work = join(context.place.inbox, "_render", student);
    try {
      const pages = await render(join(folder, "scan.pdf"), work, { allPages: context.allPages });
      const blank = pages.filter((page) => page.blank).length;
      if (blank === pages.length) {
        return { student, status: "failed", problems: ["every page looks blank — check the scan, or --all-pages"], pages: pages.length, blank_pages: blank };
      }
      const prompt = buildPrompt({ title: context.title, courseId: context.courseId, items, pages });
      const reply = await context.reader(requestContent(prompt, pages));
      const reading = parseReply(reply.text);
      const usd = estimateCost(reply.usage, new Date(reply.at));
      writeFileSync(
        join(folder, "reading.json"),
        JSON.stringify(
          {
            student_id: student,
            read_by: readBy,
            served_by: reply.model,
            at: reply.at,
            ms: reply.ms,
            usage: reply.usage,
            pages: pages.map(({ page, blank, ink }) => ({ page, blank, ink: Number(ink.toFixed(4)) })),
            reading,
            raw: reading ? undefined : reply.text,
          },
          null,
          1,
        ) + "\n",
      );
      const base = { student, pages: pages.length, blank_pages: blank, usage: reply.usage, usd, ms: reply.ms };
      if (!reading) return { ...base, status: "unparsed", problems: ["the reply was not JSON — kept in reading.json"] };
      const filled = fillTranscript(transcript, reading, { items, readBy, pageCount: pages.length });
      writeTranscript(transcriptPath, filled.transcript);
      return {
        ...base,
        status: filled.problems.length ? "partly read" : "read",
        problems: filled.problems,
        name_confidence: typeof reading.name_confidence === "string" ? reading.name_confidence : undefined,
      };
    } catch (error) {
      return { student, status: "failed", problems: [(error as Error).message], pages: 0, blank_pages: 0 };
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
  results.sort((a, b) => a.student.localeCompare(b.student));
  return { results, skipped };
};
