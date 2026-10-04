#!/usr/bin/env node

/**
 * Render a question-only exam as DOCX or PDF.
 *
 * Generation does not use LibreOffice. DOCX is created with `docx`; PDF is
 * created directly with `pdf-lib`. Both dependencies may come from the Codex
 * bundled runtime (`EXAM_RENDERER_NODE_MODULES`) or this package's node_modules.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type AnswerLayout = "under-question" | "separate-sheet";
type OutputFormat = "docx" | "pdf";

type ExamOption = {
  label: string;
  text: string;
};

type ExamQuestion = {
  number: number;
  title?: string;
  marks?: number;
  prompt: string;
  options?: ExamOption[];
  responseLines?: number;
};

type ExamInput = {
  title?: string;
  /**
   * The line under the title: course, marks, weight, date — whatever the paper
   * has to state before question 1. One string rather than named fields,
   * because what belongs there differs per institution and a schema of
   * `course`/`marks`/`date` would be a guess at somebody else's registry.
   */
  subtitle?: string;
  /**
   * Ruled fields the candidate fills in, e.g. `["Name", "Group"]`. Without
   * these a paper cannot be collected, which is why an empty list is a
   * deliberate choice rather than the default.
   */
  candidateFields?: string[];
  questions: ExamQuestion[];
  /** `a4` or `letter` (the default, as before). Kazakhstan prints on A4. */
  pageSize?: "a4" | "letter";
  /**
   * The most pages the PDF may take. When the full layout runs over, the
   * renderer tightens the margins and then gives each question fewer ruled
   * lines — never fewer than one, never smaller type — until it fits, and
   * refuses rather than overflow when it cannot.
   */
  maxPages?: number;
};

type CliOptions = {
  input: string;
  output: string;
  format: OutputFormat;
  answers: AnswerLayout;
};

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function dependencyRoot(): string {
  const configured = process.env.EXAM_RENDERER_NODE_MODULES;
  if (configured) return resolve(configured);
  return resolve(scriptDirectory, "..", "node_modules");
}

function loadDependency(name: string): any {
  const root = dependencyRoot();
  try {
    return require(join(root, name));
  } catch (error) {
    throw new Error(
      `Cannot load ${name}. Install it in node/node_modules or set ` +
      `EXAM_RENDERER_NODE_MODULES to a directory containing it.\n${String(error)}`,
    );
  }
}

function parseArguments(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(
        "Usage: render-exam.ts --input exam.json --output exam.docx " +
        "--format docx|pdf --answers under-question|separate-sheet",
      );
    }
    values.set(key.slice(2), value);
  }

  const input = values.get("input");
  const output = values.get("output");
  const format = values.get("format") as OutputFormat | undefined;
  const answers = values.get("answers") as AnswerLayout | undefined;

  if (!input || !output) throw new Error("--input and --output are required");
  if (format !== "docx" && format !== "pdf") {
    throw new Error("--format must be docx or pdf");
  }
  if (answers !== "under-question" && answers !== "separate-sheet") {
    throw new Error("--answers must be under-question or separate-sheet");
  }

  return {
    input: resolve(input),
    output: resolve(output),
    format,
    answers,
  };
}

function validateExam(value: unknown): ExamInput {
  if (!value || typeof value !== "object") throw new Error("Exam input must be an object");
  const exam = value as Partial<ExamInput>;
  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    throw new Error("Exam input must contain at least one question");
  }
  const numbers = new Set<number>();
  for (const [index, question] of exam.questions.entries()) {
    if (!Number.isInteger(question.number) || question.number < 1) {
      throw new Error(`questions[${index}].number must be a positive integer`);
    }
    if (numbers.has(question.number)) throw new Error(`Duplicate question number ${question.number}`);
    numbers.add(question.number);
    if (!question.prompt?.trim()) throw new Error(`Question ${question.number} has no prompt`);
    if (question.responseLines !== undefined && question.responseLines < 1) {
      throw new Error(`Question ${question.number} responseLines must be positive`);
    }
  }
  return exam as ExamInput;
}

function questionHeading(question: ExamQuestion): string {
  const name = question.title ? ` - ${question.title}` : "";
  // "1 marks" is on every paper a student is handed, so the plural is worth the
  // line. `marks` is a score and may be fractional; only exactly 1 is singular.
  const marks =
    question.marks === undefined ? "" : ` (${question.marks} mark${question.marks === 1 ? "" : "s"})`;
  // `Q1`, not `Question 1` on a line of its own: on a one-page quiz the
  // heading row was a line of answer space spent on a word. The label now runs
  // into the question's first line.
  return `Q${question.number}${name}${marks}`;
}

function defaultResponseLines(question: ExamQuestion): number {
  if (question.responseLines) return question.responseLines;
  return question.options?.length ? 1 : 5;
}

async function renderDocx(exam: ExamInput, output: string, answers: AnswerLayout): Promise<void> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    HeadingLevel,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    TextRun,
  } = loadDependency("docx");

  const pageChildren: any[] = [];

  if (exam.title) {
    pageChildren.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: exam.title, bold: true })],
      spacing: { after: exam.subtitle || exam.candidateFields?.length ? 80 : 240 },
    }));
  }
  if (exam.subtitle) {
    pageChildren.push(new Paragraph({
      children: [new TextRun({ text: exam.subtitle, size: 20 })],
      spacing: { after: exam.candidateFields?.length ? 120 : 240 },
    }));
  }
  if (exam.candidateFields?.length) {
    pageChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: exam.candidateFields.map((field) => `${field}: ______________________`).join("    "),
        }),
      ],
      spacing: { after: 240 },
    }));
  }

  for (const question of exam.questions) {
    // The label and the question in one paragraph, label bold, so `Q1 (2 marks)`
    // does not take a line of its own. Each line of the prompt keeps its break.
    const promptLines = question.prompt.split("\n");
    pageChildren.push(new Paragraph({
      style: "ExamBody",
      keepNext: Boolean(question.options?.length),
      spacing: { before: 200 },
      children: [
        new TextRun({ text: `${questionHeading(question)}  `, bold: true }),
        ...promptLines.map((line, at) => new TextRun({ text: line, break: at === 0 ? 0 : 1 })),
      ],
    }));

    for (const option of question.options ?? []) {
      pageChildren.push(new Paragraph({
        style: "ExamOption",
        children: [
          new TextRun({ text: `${option.label}. `, bold: true }),
          new TextRun(option.text),
        ],
      }));
    }

    if (answers === "under-question") {
      if (question.options?.length) {
        pageChildren.push(new Paragraph({
          style: "AnswerLabel",
          children: [new TextRun({ text: "Answer: ____________________", bold: true })],
        }));
      } else {
        for (let line = 0; line < defaultResponseLines(question); line += 1) {
          pageChildren.push(responseLine(Paragraph, BorderStyle, false));
        }
      }
    }
  }

  if (answers === "separate-sheet") {
    pageChildren.push(new Paragraph({ children: [new PageBreak()] }));
    pageChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Answer Sheet", bold: true })],
      spacing: { after: 240 },
    }));
    for (const question of exam.questions) {
      pageChildren.push(new Paragraph({
        style: "QuestionHeading",
        keepNext: true,
        children: [new TextRun({ text: `Q${question.number}`, bold: true })],
      }));
      if (question.options?.length) {
        pageChildren.push(new Paragraph({
          style: "AnswerLabel",
          children: [new TextRun({ text: "Answer: ____________________", bold: true })],
        }));
      } else {
        const count = defaultResponseLines(question);
        for (let line = 0; line < count; line += 1) {
          pageChildren.push(responseLine(Paragraph, BorderStyle, line < count - 1));
        }
      }
    }
  }

  const document = new Document({
    creator: "ProfessorHarness",
    title: exam.title ?? "Exam",
    description: `Question-only exam with ${answers} answer layout`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "111827" },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
        title: {
          run: { font: "Calibri", size: 32, bold: true, color: "111827" },
          paragraph: { spacing: { before: 0, after: 120 } },
        },
        heading1: {
          run: { font: "Calibri", size: 32, bold: true, color: "111827" },
          paragraph: { spacing: { before: 240, after: 140 } },
        },
      },
      paragraphStyles: [
        {
          id: "ExamBody",
          name: "Exam Body",
          basedOn: "Normal",
          next: "ExamBody",
          run: { font: "Calibri", size: 22, color: "111827" },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
        {
          id: "QuestionHeading",
          name: "Question Heading",
          basedOn: "Normal",
          next: "ExamBody",
          run: { font: "Calibri", size: 26, bold: true, color: "1F4D78" },
          paragraph: { spacing: { before: 260, after: 100, line: 300 }, keepNext: true },
        },
        {
          id: "ExamOption",
          name: "Exam Option",
          basedOn: "Normal",
          next: "ExamOption",
          run: { font: "Calibri", size: 22, color: "111827" },
          paragraph: {
            indent: { left: 360, hanging: 0 },
            spacing: { before: 0, after: 80, line: 288 },
          },
        },
        {
          id: "AnswerLabel",
          name: "Answer Label",
          basedOn: "Normal",
          next: "QuestionHeading",
          run: { font: "Calibri", size: 22, bold: true, color: "374151" },
          paragraph: { spacing: { before: 100, after: 180, line: 288 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 360, footer: 480 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", color: "6B7280", size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: "6B7280", size: 18 }),
            ],
          })],
        }),
      },
      children: pageChildren,
    }],
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, await Packer.toBuffer(document));
}

function responseLine(Paragraph: any, BorderStyle: any, keepNext: boolean): any {
  return new Paragraph({
    style: "ExamBody",
    border: {
      bottom: { color: "B7C0CA", space: 1, style: BorderStyle.SINGLE, size: 2 },
    },
    spacing: { before: 80, after: 120, line: 360 },
    keepNext,
    children: [],
  });
}

/** How a PDF is laid out: the full layout is `{ lineScale: 1, compact: false }`. */
type Fit = { lineScale: number; compact: boolean };

/** The layouts tried, in order, when a paper must fit a number of pages. */
const FITS: Fit[] = [
  { lineScale: 1, compact: false },
  { lineScale: 1, compact: true },
  { lineScale: 0.75, compact: true },
  { lineScale: 0.6, compact: true },
  { lineScale: 0.5, compact: true },
  { lineScale: 0.4, compact: true },
  { lineScale: 0.3, compact: true },
  { lineScale: 0, compact: true },
];

async function renderPdf(exam: ExamInput, output: string, answers: AnswerLayout): Promise<void> {
  const limit = exam.maxPages;
  for (const fit of limit ? FITS : [FITS[0]!]) {
    const { bytes, pages } = await layoutPdf(exam, answers, fit);
    if (!limit || pages <= limit) {
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
      return;
    }
  }
  throw new Error(
    `the paper does not fit on ${limit} page(s) even with one ruled line per question and tight margins — ` +
      "shorten the questions, or allow another page",
  );
}

async function layoutPdf(
  exam: ExamInput,
  answers: AnswerLayout,
  fit: Fit,
): Promise<{ bytes: Uint8Array; pages: number }> {
  const { PDFDocument, StandardFonts, rgb } = loadDependency("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setCreator("ProfessorHarness");
  pdf.setProducer("ProfessorHarness TypeScript exam renderer");
  pdf.setTitle(exam.title ?? "Exam");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = exam.pageSize === "a4" ? [595.28, 841.89] : [612, 792];
  const margin = fit.compact ? 50 : 72;
  // Fewer ruled lines, never none: a question with nowhere to write is not a
  // question on paper. Scale 0 is the floor — one line each.
  const responseLinesFor = (question: ExamQuestion): number =>
    Math.max(1, Math.round(defaultResponseLines(question) * fit.lineScale));
  const contentWidth = pageWidth - 2 * margin;
  const bodySize = 11;
  const bodyLeading = 15;
  const titleSize = 16;
  const headingSize = 12.5;
  const ink = rgb(0.07, 0.09, 0.13);
  const headingInk = rgb(0.12, 0.30, 0.47);
  const lineInk = rgb(0.68, 0.72, 0.77);

  let page: any;
  let y = 0;

  const newPage = (): void => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensure = (height: number): void => {
    if (!page || y - height < margin + 18) newPage();
  };

  const drawWrapped = (
    text: string,
    font: any,
    size: number,
    color: any,
    indent = 0,
    after = 6,
  ): number => {
    const lines = wrapText(text, font, size, contentWidth - indent);
    ensure(lines.length * bodyLeading + after);
    for (const line of lines) {
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= bodyLeading;
    }
    y -= after;
    return lines.length;
  };

  const drawResponseLines = (count: number): void => {
    for (let index = 0; index < count; index += 1) {
      ensure(22);
      y -= 13;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.55,
        color: lineInk,
      });
      y -= 9;
    }
    y -= 4;
  };

  /**
   * The prompt's lines with the label running into the first: `Q1 (2 marks)`
   * in bold, then the question on the same line. The first line is wrapped to
   * what is left beside the label, the rest to the full width.
   */
  const labelledLines = (question: ExamQuestion): { label: string; labelWidth: number; lines: string[] } => {
    const label = `${questionHeading(question)}  `;
    const labelWidth = bold.widthOfTextAtSize(label, bodySize);
    const [first = "", ...others] = question.prompt.replace(/\r/g, "").split("\n");
    const opening = wrapText(first, regular, bodySize, contentWidth - labelWidth);
    const head = opening[0] ?? "";
    const remainder = first.slice(head.length).trim();
    const lines = [
      head,
      ...(remainder ? wrapText(remainder, regular, bodySize, contentWidth) : []),
      ...others.flatMap((paragraph) => wrapText(paragraph, regular, bodySize, contentWidth)),
    ];
    return { label, labelWidth, lines };
  };

  const drawQuestion = (question: ExamQuestion, includeAnswerSpace: boolean): void => {
    const labelled = labelledLines(question);
    const headingLines = 0;
    const promptLines = labelled.lines.length;
    const optionsHeight = (question.options ?? []).reduce(
      (sum, option) => sum +
        wrapText(`${option.label}. ${option.text}`, regular, bodySize, contentWidth - 18).length * bodyLeading + 3,
      0,
    );
    const answerHeight = includeAnswerSpace
      ? (question.options?.length ? 25 : responseLinesFor(question) * 22 + 4)
      : 8;
    const fullBlockHeight =
      headingLines * bodyLeading + 8 +
      promptLines * bodyLeading + 6 +
      optionsHeight + answerHeight;
    ensure(Math.min(fullBlockHeight, pageHeight - 2 * margin - 36));
    y -= 8;
    labelled.lines.forEach((line, at) => {
      if (at === 0) {
        page.drawText(labelled.label, { x: margin, y, size: bodySize, font: bold, color: headingInk });
        page.drawText(line, { x: margin + labelled.labelWidth, y, size: bodySize, font: regular, color: ink });
      } else {
        page.drawText(line, { x: margin, y, size: bodySize, font: regular, color: ink });
      }
      y -= bodyLeading;
    });
    y -= 6;
    for (const option of question.options ?? []) {
      drawWrapped(`${option.label}. ${option.text}`, regular, bodySize, ink, 18, 3);
    }
    if (includeAnswerSpace) {
      if (question.options?.length) {
        drawWrapped("Answer: ____________________", bold, bodySize, ink, 0, 10);
      } else {
        drawResponseLines(responseLinesFor(question));
      }
    } else {
      y -= 8;
    }
  };

  newPage();
  if (exam.title) {
    drawWrapped(exam.title, bold, titleSize, ink, 0, exam.subtitle ? 6 : 14);
  }
  if (exam.subtitle) {
    drawWrapped(exam.subtitle, regular, bodySize, headingInk, 0, exam.candidateFields?.length ? 10 : 14);
  }
  if (exam.candidateFields?.length) {
    drawWrapped(
      exam.candidateFields.map((field) => `${field}: ______________________`).join("    "),
      regular,
      bodySize,
      ink,
      0,
      14,
    );
  }
  for (const question of exam.questions) drawQuestion(question, answers === "under-question");

  if (answers === "separate-sheet") {
    newPage();
    drawWrapped("Answer Sheet", bold, titleSize, ink, 0, 14);
    for (const question of exam.questions) {
      const responseHeight = question.options?.length
        ? 42
        : 19 + responseLinesFor(question) * 22 + 4;
      ensure(responseHeight);
      drawWrapped(`Q${question.number}`, bold, headingSize, headingInk, 0, 4);
      if (question.options?.length) {
        drawWrapped("Answer: ____________________", bold, bodySize, ink, 0, 12);
      } else {
        drawResponseLines(responseLinesFor(question));
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage: any, index: number) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = regular.widthOfTextAtSize(label, 9);
    currentPage.drawText(label, {
      x: (pageWidth - width) / 2,
      y: 32,
      size: 9,
      font: regular,
      color: rgb(0.42, 0.45, 0.50),
    });
  });

  return { bytes: await pdf.save(), pages: pages.length };
}

function wrapText(text: string, font: any, size: number, width: number): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Render one paper, in this process.
 *
 * Exported so `exam-paper.ts` can call it rather than spawn this file. A
 * spawned renderer whose output is captured talks over a pipe, and a DSH
 * session under `workspace-write` refuses to open one — so every printed quiz
 * asked the professor to escalate the sandbox. Nothing here starts a process:
 * `docx` and `pdf-lib` write the file directly.
 */
export async function renderExam(
  value: unknown,
  output: string,
  format: OutputFormat,
  answers: AnswerLayout,
): Promise<void> {
  const exam = validateExam(value);
  if (format === "docx") return renderDocx(exam, output, answers);
  try {
    await renderPdf(withWinAnsi(exam), output, answers);
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    const found = /cannot encode "(.)"/.exec(message);
    if (!found) throw error;
    // pdf-lib's standard Helvetica holds WinAnsi and nothing else. Say which
    // character, and what to do, instead of pdf-lib's one-line refusal.
    throw new Error(
      `the PDF font cannot print "${found[1]}" (U+${found[1]!.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}). ` +
        "The built-in font covers Latin text only — Cyrillic or Kazakh text needs an embedded Unicode font, which this " +
        "renderer does not have yet. Print the DOCX (--format docx), or replace the character in the item.",
    );
  }
}

/**
 * Symbols a question paper uses that the built-in PDF font cannot print, as
 * the nearest thing it can. A paper asking for |x1 − x2| should print, not
 * fail; the DOCX keeps the real characters.
 */
const WINANSI_SUBSTITUTES: Record<string, string> = {
  "−": "-", // minus sign
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "′": "'",
  "″": "\"",
  " ": " ",
  " ": " ",
  " ": " ",
};

const winAnsiText = (text: string): string =>
  text.replace(/[−≤≥≠≈→←⇒′″   ]/g, (c) => WINANSI_SUBSTITUTES[c] ?? c);

function withWinAnsi(exam: ExamInput): ExamInput {
  const fix = (value: string | undefined) => (value === undefined ? value : winAnsiText(value));
  return {
    ...exam,
    title: fix(exam.title),
    subtitle: fix(exam.subtitle),
    candidateFields: exam.candidateFields?.map((field) => winAnsiText(field)),
    questions: exam.questions.map((question) => ({
      ...question,
      title: fix(question.title),
      prompt: winAnsiText(question.prompt),
      options: question.options?.map((option) => ({ ...option, text: winAnsiText(option.text) })),
    })),
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  await renderExam(JSON.parse(await readFile(options.input, "utf8")), options.output, options.format, options.answers);
  process.stdout.write(`${options.output}\n`);
}

// The CLI only when this file is the one being run, so importing it renders
// nothing. `import.meta.main` would say this, but not on Node 22.
const invokedDirectly =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
