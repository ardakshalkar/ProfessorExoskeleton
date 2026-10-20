/**
 * Where `scans identify` gets its hint when nobody passes `--title`.
 *
 * `rankAssessments` only ranks against words it is given. On 2026-10-20 a pile
 * uploaded as `2026-10-13_CSS-4007_Midterm_Exam_1.pdf` arrived as
 * `scan-92d32fb5e5.pdf`; the agent ran `identify` with no title, every
 * assessment scored 0.00, the session's model could not see the cover, and it
 * recommended Quiz 3 from the page count. Both things that named the exam were
 * on this machine: the original name in `_inbox/uploads.json`, and the printed
 * title on page 1. This reads them, in that order.
 *
 * The original name may carry a student's (`ivanov_quiz3.pdf`), and the upload
 * message keeps it out of the transcript for that reason. So it is used here
 * only to rank: what `identify` prints is the words it shares with an
 * assessment, never the name. The cover read asks for printed text only — the
 * title, the course code, a date, a variant — never a name, and sends only the
 * top of page 1, the same strip `scans names` sends.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { renderCover } from "./scan-names.ts";
import { estimateCost, parseReply, type ContentPart, type Reader } from "./scan-read.ts";
import { vocabularyOf, words } from "./scans.ts";

export interface Hint {
  title: string | null;
  date: string | null;
  /** How the reasons name it: "the cover", "the uploaded file's name". */
  from: string;
}

/** `_inbox/uploads.json`: each stored file's name back to what it was called when uploaded. */
export const uploadedNames = (inbox: string): Map<string, string> => {
  const ledger = join(inbox, "uploads.json");
  const names = new Map<string, string>();
  if (!existsSync(ledger)) return names;
  try {
    const entries = JSON.parse(readFileSync(ledger, "utf-8"));
    if (Array.isArray(entries)) for (const entry of entries) if (entry?.file && entry?.original) names.set(String(entry.file), String(entry.original));
  } catch {}
  return names;
};

/**
 * A title and a date out of a file's name: `2026-10-13_CSS-4007_Midterm_Exam_1.pdf`
 * → "Midterm Exam 1", 2026-10-13. The course code is taken out, because every
 * assessment of the run shares it and it would only add numbers to disagree with.
 */
export const filenameHint = (original: string, courseId: string): Hint => {
  let stem = original.replace(/\.[^.]+$/, "");
  let date: string | null = null;
  const iso = /(20\d\d)[-_.](\d\d)[-_.](\d\d)/.exec(stem);
  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    stem = stem.replace(iso[0], " ");
  }
  const course = new Set(words(courseId));
  const title = words(stem)
    .filter((word) => !course.has(word))
    .join(" ");
  return { title: title || null, date, from: "the uploaded file's name" };
};

/**
 * Whether a hint can point anywhere: it shares a real word — three letters or
 * more, not a number — with some assessment. A scanner's name
 * (`0050AA48FF5B261001144750.pdf`) shares none, and is not worth ranking on.
 */
export const usefulHint = (hint: Hint, assessments: any[]): boolean => {
  const read = words(hint.title ?? "").filter((word) => /\p{L}{3,}/u.test(word) && !/^\d+$/.test(word));
  return assessments.some((assessment) => {
    const vocabulary = vocabularyOf(assessment);
    return read.some((word) => vocabulary.has(word));
  });
};

export const coverTitlePrompt = (courseId: string): string =>
  [
    `This is the top of the first page of a scanned university exam paper, course ${courseId}. It is attached as overlapping horizontal bands, top to bottom.`,
    "",
    "Return ONE JSON object and nothing else. No markdown fence, no commentary. Exactly these keys:",
    "{",
    '  "printed_title": "the printed heading of the paper, verbatim (for example \\"Midterm Exam 1\\" or \\"Quiz 3 — Classification\\"); empty string if there is none",',
    '  "course_code": "a course code printed on the page; else empty string",',
    '  "date": "a date printed or written on the paper as YYYY-MM-DD; else empty string",',
    '  "variant": "a version or variant mark printed on the paper; else empty string"',
    "}",
    "",
    "Rules:",
    "- Printed text only. Never return a person's name, a student number, or anything handwritten except a date.",
    "- If the title is not readable, return an empty string. Never invent one.",
  ].join("\n");

export interface CoverTitle {
  hint: Hint | null;
  /** The printed title as read; kept out of what `identify` prints. */
  printed: string | null;
  variant: string | null;
  usd: number;
}

/** Read the printed title off the top of page 1 with a vision model. */
export const readCoverTitle = async (
  pdf: string,
  context: { courseId: string; reader: Reader; work: string; render?: typeof renderCover },
): Promise<CoverTitle> => {
  const render = context.render ?? renderCover;
  try {
    const bands = await render(pdf, 1, context.work);
    const content: ContentPart[] = [
      { type: "text", text: coverTitlePrompt(context.courseId) },
      ...bands.flatMap((band, index): ContentPart[] => [
        { type: "text", text: `Band ${index}:` },
        { type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(band).toString("base64")}` } },
      ]),
    ];
    const reply = await context.reader(content);
    const reading = parseReply(reply.text);
    const usd = estimateCost(reply.usage, new Date(reply.at));
    const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
    const printed = text(reading?.printed_title);
    const date = /^20\d\d-\d\d-\d\d$/.test(text(reading?.date)) ? text(reading?.date) : null;
    return {
      hint: printed ? { title: printed, date, from: "the cover" } : null,
      printed: printed || null,
      variant: text(reading?.variant) || null,
      usd,
    };
  } finally {
    rmSync(context.work, { recursive: true, force: true });
  }
};
