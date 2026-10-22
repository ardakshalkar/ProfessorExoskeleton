/**
 * Exam reports: one per student — each question, what they answered, the
 * rubric it was marked against, the mark, and how many of the class got full
 * marks on it — and the professor's report, every student one after another,
 * each starting on a page of its own.
 *
 * WHAT A REPORT CARRIES
 * ---------------------
 * Only decided marks. A suggestion nobody has accepted is not a grade, and a
 * report is sent to the student it is about; a question still waiting says so
 * rather than showing a number the professor has not stood behind. The total is
 * the gradebook's — curved where the assessment has a curve — so a report and
 * Canvas never disagree. The answer key is printed for a choice question (the
 * paper is marked; which option was right is the feedback) and the rubric's
 * levels for a written one, with the level awarded marked.
 *
 * WHERE IT GOES
 * -------------
 * Outside the repository, like scans: a report names a student. `reportsDir`
 * is `~/.ainar/reports` unless told otherwise, and under it
 * `<RUN>/<ASSESSMENT>/` holds `class.pdf`, `students/<STUDENT>.pdf` and
 * `report.json`, the list the pane and `lms send-reports` read.
 *
 * HOW IT IS DRAWN
 * ---------------
 * As Word documents with `docx`, then through LibreOffice in one run. pdf-lib's
 * own fonts are Latin only, and the names and answers here are Kazakh and
 * Russian as often as English; a `.docx` in Arial carries them, and LibreOffice
 * is already the converter the slides use (`pdf.ts`).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { approvedView } from "./approval.ts";
import { assessmentsOf, criterionById, itemsOf, type CourseBundle } from "./bundle.ts";
import { gradeRows, type GradeRow } from "./gradebook.ts";
import { toPdfAll } from "./pdf.ts";
import { itemsForVariant } from "./scans.ts";

export { reportPlace, reportsDir } from "./report-place.ts";

export interface ReportLevel {
  score: number;
  label: string | null;
  description: string;
}

export interface ReportQuestion {
  /** The criterion it is marked on, or the item when it has none: one question across variants. */
  key: string;
  number: number | null;
  item_id: string;
  prompt: string;
  maximum: number;
  options: { label: string; text: string; correct: boolean }[];
  levels: ReportLevel[];
  guidance: string | null;
  /** What the student wrote, or chose. */
  text: string;
  chosen: string[];
  blank: boolean;
  /** The decided mark, or null while it waits. */
  mark: number | null;
  comment: string | null;
}

export interface QuestionStats {
  key: string;
  number: number | null;
  maximum: number;
  marked: number;
  full: number;
  mean: number | null;
}

export interface StudentReport {
  student: string;
  name: string | null;
  status: string;
  total: number | null;
  /** The total before the curve, when one was applied. */
  raw_total: number | null;
  maximum: number;
  variant: string | null;
  questions: ReportQuestion[];
}

export interface ExamReport {
  run: string;
  course: string;
  assessment: { id: string; title: string; maximum: number; curved: boolean };
  stats: QuestionStats[];
  students: StudentReport[];
}

const full = (mark: number, maximum: number): boolean => maximum > 0 && mark >= maximum - 1e-9;

/**
 * The report's content, for every student who handed the assessment in.
 * `names` maps a pseudonym to the name to print; without it, the pseudonym.
 */
export const examReport = (options: {
  bundle: CourseBundle;
  runId: string;
  assessmentId: string;
  names?: Record<string, string> | null;
}): ExamReport => {
  const { bundle, runId, assessmentId } = options;
  const assessment = assessmentsOf(bundle, runId).find((entry: any) => entry.assessment_id === assessmentId) as any;
  if (!assessment) throw new Error(`${assessmentId} is not an assessment of ${runId}`);
  // Marks from what a person stands behind, as Canvas gets them; answers from
  // everything, since an answer read off a paper is not a judgement.
  const rows = gradeRows(approvedView(bundle), runId, { assessmentId, allowPartial: true }).get(assessmentId) ?? [];
  const items = itemsOf(bundle, assessmentId);
  const criteria = criterionById(bundle);
  const submissions = new Map((bundle.submissions as any[]).map((entry) => [entry.submission_id, entry]));
  const responses = new Map<string, Map<string, any>>();
  for (const response of bundle.item_responses as any[]) {
    if (!responses.has(response.submission_id)) responses.set(response.submission_id, new Map());
    responses.get(response.submission_id)!.set(response.item_id, response);
  }

  const students: StudentReport[] = [];
  for (const row of rows as GradeRow[]) {
    if (!row.submission_id) continue;
    const submission = submissions.get(row.submission_id) ?? {};
    const variant = submission.extensions?.scan?.variant ?? null;
    const theirs = responses.get(row.submission_id) ?? new Map();
    const questions = itemsForVariant(items, variant ?? undefined).map((item: any): ReportQuestion => {
      const criterion = item.criterion_id ? criteria.get(item.criterion_id) : null;
      const scored = item.criterion_id ? row.criteria.find((entry) => entry.criterion_id === item.criterion_id) : null;
      const response = theirs.get(item.item_id);
      const text = String(response?.raw_response ?? "").trim();
      const chosen: string[] = Array.isArray(response?.chosen_options) ? response.chosen_options.map(String) : [];
      // A choice question with no criterion is marked by its response's own
      // score — the one `score-items` wrote, once it is no longer a draft.
      const own = !scored && response && response.approval !== "draft" && typeof response.score === "number" ? response.score : null;
      return {
        key: item.criterion_id ?? item.item_id,
        number: item.number ?? null,
        item_id: item.item_id,
        prompt: String(item.prompt ?? ""),
        maximum: Number(scored?.maximum ?? criterion?.maximum_score ?? item.maximum_score ?? 0),
        options: (item.options ?? []).map((option: any) => ({ label: String(option.label), text: String(option.text), correct: Boolean(option.correct) })),
        levels: (criterion?.levels ?? [])
          .map((level: any) => ({ score: Number(level.score), label: level.label ?? null, description: String(level.description ?? "") }))
          .sort((a: ReportLevel, b: ReportLevel) => b.score - a.score),
        guidance: item.marking_guidance ? String(item.marking_guidance) : null,
        text,
        chosen,
        blank: !text && !chosen.length,
        mark: scored ? scored.score : own,
        comment: scored?.comment ?? null,
      };
    });
    students.push({
      student: row.student_id,
      name: options.names?.[row.student_id] ?? null,
      status: row.status,
      total: row.status === "graded" ? row.score : null,
      raw_total: row.raw_score ?? null,
      maximum: row.maximum,
      variant,
      questions,
    });
  }
  const sortName = (entry: StudentReport) => entry.name ?? entry.student;
  students.sort((a, b) => sortName(a).localeCompare(sortName(b)));

  // One line per question, across variants: the criterion is the question.
  const stats = new Map<string, QuestionStats & { sum: number }>();
  for (const student of students) {
    for (const question of student.questions) {
      const entry = stats.get(question.key) ?? { key: question.key, number: question.number, maximum: question.maximum, marked: 0, full: 0, mean: null, sum: 0 };
      if (question.mark !== null) {
        entry.marked += 1;
        entry.sum += question.mark;
        if (full(question.mark, question.maximum)) entry.full += 1;
      }
      stats.set(question.key, entry);
    }
  }
  return {
    run: runId,
    course: String((bundle.course as any)?.title ?? (bundle.course as any)?.course_id ?? ""),
    assessment: { id: assessmentId, title: String(assessment.title ?? assessmentId), maximum: Number(assessment.maximum_score), curved: rows.some((row) => row.raw_score != null) },
    stats: [...stats.values()]
      .map(({ sum, ...entry }) => ({ ...entry, mean: entry.marked ? Math.round((sum / entry.marked) * 100) / 100 : null }))
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.key.localeCompare(b.key)),
    students,
  };
};

// ---------------------------------------------------------------- the page

const number = (value: number): string => String(Math.round(value * 100) / 100);
const GREY = "666666";
const GOOD = "1E7B45";
const LOW = "B15A00";
const PALE = "F2F4F7";
const AWARDED = "DCEBFA";

const p = (runs: TextRun[] | string, options: Record<string, unknown> = {}) =>
  new Paragraph({ children: typeof runs === "string" ? [new TextRun(runs)] : runs, ...options });

const thin = { style: BorderStyle.SINGLE, size: 4, color: "D0D5DD" };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };

/** One student's pages: who, the total, then question by question. */
const studentSection = (report: ExamReport, student: StudentReport, statsOf: Map<string, QuestionStats>) => {
  const children: (Paragraph | Table)[] = [];
  children.push(p([new TextRun({ text: `${report.course} · ${report.assessment.title}`, color: GREY, size: 18 })]));
  children.push(
    p([
      new TextRun({ text: student.name ?? student.student, bold: true, size: 32 }),
      ...(student.name ? [new TextRun({ text: `   ${student.student}`, color: GREY, size: 16 })] : []),
    ], { spacing: { before: 60, after: 60 } }),
  );
  const total =
    student.total === null
      ? [new TextRun({ text: "Not fully marked yet", bold: true, color: LOW })]
      : [
          new TextRun({ text: `${number(student.total)} / ${number(student.maximum)}`, bold: true, size: 28 }),
          ...(student.raw_total !== null && Math.abs(student.raw_total - student.total) > 1e-9
            ? [new TextRun({ text: `   marked ${number(student.raw_total)}, then curved`, color: GREY, size: 18 })]
            : []),
        ];
  children.push(p(total, { spacing: { after: 200 }, border: { bottom: { ...thin, size: 8 } } }));

  for (const question of student.questions) {
    const stats = statsOf.get(question.key);
    const markText =
      question.mark === null ? "not marked yet" : `${number(question.mark)} / ${number(question.maximum)}`;
    const markColour = question.mark === null ? GREY : full(question.mark, question.maximum) ? GOOD : question.mark < question.maximum / 2 ? LOW : undefined;
    children.push(
      p([
        new TextRun({ text: `Q${question.number ?? "?"}   `, bold: true, size: 24 }),
        new TextRun({ text: markText, bold: true, size: 24, ...(markColour ? { color: markColour } : {}) }),
        ...(stats && stats.marked
          ? [new TextRun({ text: `      ${stats.full} of ${stats.marked} in the class got full marks`, color: GREY, size: 18 })]
          : []),
      ], { spacing: { before: 280, after: 80 }, keepNext: true }),
    );
    for (const line of question.prompt.split(/\r?\n/)) children.push(p([new TextRun({ text: line, size: 20 })], { keepNext: true }));

    if (question.options.length) {
      for (const option of question.options) {
        const picked = question.chosen.includes(option.label);
        children.push(
          p([
            new TextRun({ text: `${picked ? "●" : "○"} ${option.label}) `, bold: picked }),
            new TextRun({ text: option.text, bold: picked }),
            ...(option.correct ? [new TextRun({ text: "   ✓ correct", color: GOOD, bold: true })] : []),
            ...(picked && !option.correct ? [new TextRun({ text: "   your answer", color: LOW })] : []),
          ], { indent: { left: 240 } }),
        );
      }
      if (!question.chosen.length) children.push(p([new TextRun({ text: "No option chosen.", italics: true, color: GREY })], { indent: { left: 240 } }));
    } else {
      children.push(p([new TextRun({ text: "Answer", bold: true, size: 18, color: GREY })], { spacing: { before: 100 }, keepNext: true }));
      const lines = question.blank ? ["Nothing written."] : question.text.split(/\r?\n/);
      lines.forEach((line, index) =>
        children.push(
          p([new TextRun({ text: line, italics: question.blank, ...(question.blank ? { color: GREY } : {}) })], {
            shading: { type: ShadingType.CLEAR, color: "auto", fill: PALE },
            indent: { left: 120, right: 120 },
            spacing: { before: index === 0 ? 40 : 0, after: index === lines.length - 1 ? 80 : 0 },
          }),
        ),
      );
    }

    if (question.levels.length) {
      children.push(p([new TextRun({ text: "Rubric", bold: true, size: 18, color: GREY })], { spacing: { before: 80 }, keepNext: true }));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: question.levels.map((level) => {
            const awarded = question.mark !== null && Math.abs(level.score - question.mark) < 1e-9;
            const fill = awarded ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: AWARDED } } : {};
            return new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  ...fill,
                  children: [p([new TextRun({ text: number(level.score), bold: true, size: 18 })], { alignment: AlignmentType.CENTER })],
                }),
                new TableCell({
                  borders: cellBorders,
                  ...fill,
                  children: [
                    p([
                      ...(level.label ? [new TextRun({ text: `${level.label}: `, bold: true, size: 18 })] : []),
                      new TextRun({ text: level.description, size: 18, bold: awarded }),
                      ...(awarded ? [new TextRun({ text: "   ← awarded", bold: true, size: 18, color: GOOD })] : []),
                    ]),
                  ],
                }),
              ],
            });
          }),
        }),
      );
    } else if (question.guidance && !question.options.length) {
      children.push(p([new TextRun({ text: "How it was marked: ", bold: true, size: 18, color: GREY }), new TextRun({ text: question.guidance, size: 18 })], { spacing: { before: 80 } }));
    }
    if (question.comment) {
      children.push(p([new TextRun({ text: "Comment: ", bold: true, size: 18 }), new TextRun({ text: question.comment, italics: true, size: 18 })], { spacing: { before: 80 } }));
    }
  }
  return { properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children };
};

/**
 * One student on one page, for the professor's report: who, the total, and a
 * row per question — the mark, what they wrote, the comment. The questions and
 * their rubrics are the professor's own and are not repeated sixty times; the
 * student's copy has them.
 */
const compactSection = (report: ExamReport, student: StudentReport) => {
  const cell = (runs: TextRun[], width: number, extra: Record<string, unknown> = {}) =>
    new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, borders: cellBorders, children: [p(runs)], ...extra });
  const head = (text: string, width: number) =>
    cell([new TextRun({ text, bold: true, size: 16 })], width, { shading: { type: ShadingType.CLEAR, color: "auto", fill: PALE } });
  return {
    properties: { page: { margin: { top: 700, bottom: 700, left: 800, right: 800 } } },
    children: [
      p([new TextRun({ text: `${report.course} · ${report.assessment.title}`, color: GREY, size: 16 })]),
      p([
        new TextRun({ text: student.name ?? student.student, bold: true, size: 28 }),
        ...(student.name ? [new TextRun({ text: `   ${student.student}`, color: GREY, size: 16 })] : []),
        new TextRun({
          text: student.total === null ? "      not fully marked" : `      ${number(student.total)} / ${number(student.maximum)}`,
          bold: true,
          size: 26,
          ...(student.total === null ? { color: LOW } : {}),
        }),
        ...(student.raw_total !== null && student.total !== null && Math.abs(student.raw_total - student.total) > 1e-9
          ? [new TextRun({ text: `  (marked ${number(student.raw_total)})`, color: GREY, size: 16 })]
          : []),
        ...(student.variant ? [new TextRun({ text: `   variant ${student.variant}`, color: GREY, size: 16 })] : []),
      ], { spacing: { after: 120 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: [head("Q", 7), head("Mark", 11), head("Answer", 82)] }),
          ...student.questions.map((question) => {
            const colour = question.mark === null ? GREY : full(question.mark, question.maximum) ? GOOD : question.mark < question.maximum / 2 ? LOW : undefined;
            const answer = question.options.length
              ? question.chosen.length
                ? question.chosen.map((label) => {
                    const option = question.options.find((entry) => entry.label === label);
                    return `${label}${option?.correct ? " ✓" : ""}`;
                  }).join(", ")
                : "no option chosen"
              : question.blank
                ? "nothing written"
                : question.text.replace(/\s*\n\s*/g, " / ");
            return new TableRow({
              cantSplit: true,
              children: [
                cell([new TextRun({ text: `Q${question.number ?? "?"}`, bold: true, size: 16 })], 7),
                cell([new TextRun({ text: question.mark === null ? "—" : `${number(question.mark)}/${number(question.maximum)}`, bold: true, size: 16, ...(colour ? { color: colour } : {}) })], 11),
                cell([
                  new TextRun({ text: answer, size: 15, ...(question.blank ? { italics: true, color: GREY } : {}) }),
                  ...(question.comment ? [new TextRun({ text: `  — ${question.comment}`, italics: true, size: 15, color: GREY })] : []),
                ], 82),
              ],
            });
          }),
        ],
      }),
    ],
  };
};

/** The professor's first page: every question across the class. */
const summarySection = (report: ExamReport) => {
  const graded = report.students.filter((student) => student.total !== null);
  const header = (text: string) =>
    new TableCell({ borders: cellBorders, shading: { type: ShadingType.CLEAR, color: "auto", fill: PALE }, children: [p([new TextRun({ text, bold: true, size: 18 })])] });
  const cell = (text: string, colour?: string) =>
    new TableCell({ borders: cellBorders, children: [p([new TextRun({ text, size: 18, ...(colour ? { color: colour } : {}) })])] });
  return {
    properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
    children: [
      p([new TextRun({ text: report.course, color: GREY, size: 18 })]),
      p([new TextRun({ text: `${report.assessment.title} — class report`, bold: true, size: 32 })], { spacing: { after: 120 } }),
      p(
        `${report.students.length} handed in · ${graded.length} fully marked · out of ${number(report.assessment.maximum)}` +
          (report.assessment.curved ? " · curved" : "") +
          (graded.length
            ? ` · mean ${number(graded.reduce((sum, student) => sum + (student.total ?? 0), 0) / graded.length)}`
            : ""),
        { spacing: { after: 240 } },
      ),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: ["Question", "Out of", "Full marks", "Marked", "Mean"].map(header) }),
          ...report.stats.map((stat) => {
            const share = stat.marked ? stat.full / stat.marked : 0;
            return new TableRow({
              children: [
                cell(`Q${stat.number ?? "?"}`),
                cell(number(stat.maximum)),
                cell(stat.marked ? `${stat.full} (${Math.round(share * 100)}%)` : "—", stat.marked && share < 0.25 ? LOW : undefined),
                cell(String(stat.marked)),
                cell(stat.mean === null ? "—" : number(stat.mean)),
              ],
            });
          }),
        ],
      }),
      p([new TextRun({ text: "One student per page from here, in name order: each question's mark, what they wrote, and the comment. Each student's own report has the questions and rubrics in full.", color: GREY, size: 18 })], { spacing: { before: 240 } }),
    ],
  };
};

const documentOf = (sections: any[]) =>
  new Document({
    creator: "ainar",
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections,
  });

/**
 * Write the reports: the professor's `class.pdf` and one PDF per student, or
 * only `students` when given. Returns what was written; throws with
 * LibreOffice's own words when it could not convert.
 */
export const writeExamReports = async (options: {
  report: ExamReport;
  dir: string;
  students?: string[] | null;
  generatedAt: string;
}): Promise<{ classPdf: string | null; students: string[] }> => {
  const { report, dir } = options;
  const wanted = options.students?.length ? new Set(options.students) : null;
  const statsOf = new Map(report.stats.map((stat) => [stat.key, stat]));
  const chosen = report.students.filter((student) => !wanted || wanted.has(student.student));
  if (!chosen.length) throw new Error(wanted ? `none of ${[...wanted].join(", ")} handed ${report.assessment.id} in` : `nobody has handed ${report.assessment.id} in`);

  const work = mkdtempSync(join(tmpdir(), "ainar-report-"));
  try {
    const sources: string[] = [];
    if (!wanted) {
      const path = join(work, "class.docx");
      writeFileSync(path, await Packer.toBuffer(documentOf([summarySection(report), ...chosen.map((student) => compactSection(report, student))])));
      sources.push(path);
    }
    for (const student of chosen) {
      const path = join(work, `${student.student}.docx`);
      writeFileSync(path, await Packer.toBuffer(documentOf([studentSection(report, student, statsOf)])));
      sources.push(path);
    }
    // Forty at a time keeps the command line well inside Windows' limit.
    const pdfs: string[] = [];
    for (let at = 0; at < sources.length; at += 40) {
      const converted = toPdfAll(sources.slice(at, at + 40), work);
      if ("error" in converted) throw new Error(converted.error);
      pdfs.push(...converted.pdfs);
    }

    mkdirSync(join(dir, "students"), { recursive: true });
    const place = { classPdf: join(dir, "class.pdf"), student: (id: string) => join(dir, "students", `${id}.pdf`) };
    let classPdf: string | null = null;
    const written: string[] = [];
    for (const pdf of pdfs) {
      const id = pdf.replace(/^.*[\\/]/, "").replace(/\.pdf$/, "");
      const target = id === "class" ? place.classPdf : place.student(id);
      rmSync(target, { force: true });
      renameSync(pdf, target);
      if (id === "class") classPdf = target;
      else written.push(target);
    }

    // The list the pane and `lms send-reports` read: who has a report, with
    // what total, made when.
    const manifestPath = join(dir, "report.json");
    const before = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { students: {} };
    const students = { ...(before.students ?? {}) };
    for (const student of chosen) {
      students[student.student] = { total: student.total, maximum: student.maximum, status: student.status, made_at: options.generatedAt };
    }
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          run: report.run,
          assessment: report.assessment.id,
          title: report.assessment.title,
          class_made_at: classPdf ? options.generatedAt : (before.class_made_at ?? null),
          students,
        },
        null,
        2,
      ) + "\n",
    );
    return { classPdf, students: written };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};
