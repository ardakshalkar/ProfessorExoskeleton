/**
 * Turn an assessment into a printable paper, straight from the record.
 *
 * `bin/render-exam.ts` renders a paper but takes JSON it cannot produce; the
 * course model holds the questions but has no way to print them. This is the
 * piece between them: it reads `assessments/` and `items/` out of the bundle,
 * maps the items to the shape the renderer validates, and renders each format.
 *
 * **In process, never a child.** The renderer used to be spawned with its output
 * captured, which is a pipe — and a DSH session under `workspace-write` cannot
 * open one, so every printed paper asked the professor to escalate the sandbox
 * (and an agent that did not know this path existed reached for headless
 * Chrome, which needs the same pipes). `renderExam` is imported and called
 * instead: one copy of the renderer, no process, nothing for the sandbox to
 * refuse.
 *
 * **No LibreOffice.** DOCX comes from `docx` and PDF from `pdf-lib`, both of
 * them writers rather than converters. That is the whole reason this path
 * exists beside `ainar materials`, whose PDFs are a LibreOffice conversion of a
 * `.pptx` and fail on a machine without it.
 *
 * **Question paper only.** `answer_key` and `marking_guidance` are read from the
 * record and deliberately not written: the renderer has no notion of a key, and
 * a marking key that arrives by accident beside a student paper is the kind of
 * file that ends up in the wrong hands.
 *
 * **A paper nobody recorded is a file, not a record.** The pane's Exams tab
 * draws a `Paper` row off the assessment's `instructions_document_id`, so a
 * paper that existed and was never registered read as `no brief`. So each
 * printing is also described as a `Document`, checked by `documentRecord` and
 * written into the course marked `approval: draft`, with `extensions.renders`
 * naming the assessment so every paper it has can be found from it. A reprint
 * replaces its own record — new checksum, same approval.
 *
 * The last hop is the professor's and is printed rather than performed: the
 * assessment's `instructions_document_id` is the professor's own record, so it
 * is a line for them to add.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { renderExam } from "../bin/render-exam.ts";
import { documentRecord } from "./materials.ts";
import { writeRecords } from "./records-write.ts";
import { Workspace } from "./workspace.ts";

export type PaperFormat = "docx" | "pdf";
export type AnswerLayout = "under-question" | "separate-sheet";

/**
 * What a paper is served as.
 *
 * The PDF is the half a browser paints: it is in the pane's `SHOWABLE` set and
 * opens over the harness, while a `.docx` is a download everywhere unless the
 * machine has LibreOffice. That is why a run that writes both points the
 * assessment at the PDF.
 */
const MIME: Record<PaperFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * How much ruled space a question earns.
 *
 * A blank and a choice get one line, because the answer is a word. A written
 * answer gets three lines per mark, which is `render-quiz.py`'s own constant and
 * is what keeps an eight-item, ten-mark quiz on one page. An item worth no marks
 * still gets a line to write on.
 */
export const responseLines = (item: any): number => {
  if (item.options?.length) return 1;
  if (item.type === "numeric" || item.type === "short_answer") {
    return item.maximum_score >= 2 ? Math.max(3, Math.round(item.maximum_score * 3)) : 1;
  }
  return Math.max(1, Math.round((item.maximum_score || 1) * 3));
};

/**
 * The file in `courses/` that defines an assessment, so the last manual step
 * names a path rather than a direction.
 *
 * A best effort, and absent rather than guessed: the loader keeps no file
 * provenance per record, so this is a text search for the identifier over the
 * course's own YAML. `records/` is skipped because a submission or an
 * evaluation mentions the assessment without defining it, and matching one
 * would send the professor to edit the wrong file.
 */
export const assessmentFile = (root: string, courseId: string, assessmentId: string): string | null => {
  const pattern = new RegExp(`^\\s*(-\\s*)?assessment_id:\\s*["']?${assessmentId}["']?\\s*$`, "m");
  const found: string[] = [];
  const walk = (directory: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "records" || entry === "materials" || entry === "samples") continue;
      const path = join(directory, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.ya?ml$/i.test(entry)) continue;
      try {
        if (pattern.test(readFileSync(path, "utf-8"))) found.push(path);
      } catch {
        continue;
      }
    }
  };
  walk(join(root, "courses", courseId));
  // An assessment in its own folder is defined by exactly one file there.
  const own = join(root, "courses", courseId, "assessments", assessmentId, "assessment.yaml");
  if (found.includes(own)) return relative(root, own).split(sep).join("/");
  // Every item on a quiz names the assessment it belongs to, so a plain text
  // search finds the items file as well as the record that defines it. Where
  // several match, the ones that live among the assessments are preferred —
  // `assessments/*.yaml` or an `assessments.yaml` beside them.
  const narrowed =
    found.length > 1
      ? found.filter((path) => {
          const parts = relative(root, path).split(/[\\/]/);
          return (
            parts.slice(0, -1).includes("assessments") || /^assessments\.ya?ml$/i.test(parts.at(-1)!)
          );
        })
      : found;
  // One file or nothing. Still two means the identifier appears somewhere this
  // search does not understand, and naming one of them would be a coin toss
  // dressed up as an answer.
  return narrowed.length === 1 ? relative(root, narrowed[0]!).split(sep).join("/") : null;
};

/**
 * Describe each printing as a `Document`, written into the course as a draft.
 *
 * Valid before it is written or not written at all — `documentRecord` is the
 * check a hand-written YAML emitter does not have, and the reason it is shared
 * with `ainar materials build` rather than copied.
 *
 * A paper written outside the workspace cannot be a record at all — a
 * `storage_key` with no scheme is a path in this repository — and is reported
 * rather than registered. A reprint of a paper the record already holds is
 * recorded under the id it already has, so its checksum and size describe the
 * printing on disk, and it keeps whatever approval it had.
 */
const registerPapers = (options: {
  root: string;
  bundle: any;
  assessment: any;
  papers: { format: PaperFormat; path: string }[];
  baseId: string;
  variant: string | null;
  questions: number;
  marks: number;
  courseDir: string;
}): { lines: string[]; written: string[]; pointAt: string | null } => {
  const { root, bundle, assessment, papers, baseId, courseDir } = options;
  const lines: string[] = [];
  const documents: Record<string, unknown>[] = [];

  const byKey = new Map(
    ((bundle.documents as any[]) ?? []).map((row) => [String(row.storage_key ?? ""), row.document_id]),
  );

  const stamp = new Date().toISOString();
  const registered: { format: PaperFormat; id: string }[] = [];

  for (const paper of papers) {
    const key = relative(root, paper.path).split(sep).join("/");
    if (key.startsWith("..") || isAbsolute(key)) {
      lines.push(
        `  ${basename(paper.path)} was written outside the workspace, so it cannot be a record. ` +
          "Print it under the workspace to register it.",
      );
      continue;
    }

    const documentId = byKey.get(key) ?? `${baseId}-${paper.format.toUpperCase()}`;

    const bytes = readFileSync(paper.path);
    documents.push(
      documentRecord({
        document_id: documentId,
        title:
          `${assessment.title} — question paper` +
          `${options.variant ? `, variant ${options.variant}` : ""} (${paper.format.toUpperCase()})`,
        storage_key: key,
        mime_type: MIME[paper.format],
        original_filename: basename(paper.path),
        size_bytes: bytes.length,
        checksum: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
        course_id: bundle.course.course_id,
        course_version_id: assessment.course_version_id ?? null,
        created_at: stamp,
        version: 1,
        approval: "draft",
        generated_by: {
          produced_by: "ainar-node/src/exam-paper.ts",
          // The assessment, not the items: a paper is the printing of one piece
          // of graded work, and its questions are reachable from it.
          input_refs: [assessment.assessment_id],
          created_at: stamp,
        },
        extensions: {
          // What the pane badges. A paper printed from the record is generated.
          origin: "generated",
          // The edge from a paper back to its assessment — the one the pane's
          // papers view collects by, so every printing of a piece of work
          // (and every form of it) is found without the assessment having to
          // list them. Not `rendered_from`: that names a Document converted
          // from, and this paper was written from the record's items.
          renders: assessment.assessment_id,
          // The same key `import-paper` writes on the items of a version, so a
          // paper and the questions on it are matched by one word.
          ...(options.variant ? { variant: options.variant } : {}),
          questions: options.questions,
          marks: options.marks,
        },
      }),
    );
    registered.push({ format: paper.format, id: documentId });
  }

  // The PDF when there is one: the pane frames a PDF over the harness and sends
  // a `.docx` to a tab unless this machine has LibreOffice.
  const pointAt =
    registered.find((entry) => entry.format === "pdf")?.id ?? registered[0]?.id ?? null;

  if (documents.length === 0) return { lines, written: [], pointAt };

  const written = writeRecords(courseDir, { documents }, { keepApproval: true });
  return { lines, written, pointAt };
};

export type PrintOptions = {
  assessmentId: string;
  /** The workspace root. */
  root: string;
  /** How the root was found, for `Workspace`'s own messages. */
  rootSource?: "flag" | "cwd" | "env";
  format?: PaperFormat | "both";
  answers?: AnswerLayout;
  /** Where to write; relative to the root. Default: the assessment's own folder. */
  out?: string | null;
  /** The document id stem for a paper the record does not hold yet. */
  docId?: string | null;
  register?: boolean;
  /** One version only, when the assessment has several. Default: every version. */
  variant?: string | null;
  /** `a4` or `letter`. Default: the assessment's `extensions.paper.page_size`, else letter. */
  pageSize?: "a4" | "letter" | null;
  /** The most pages a paper may take. Default: the assessment's `extensions.paper.max_pages`. */
  maxPages?: number | null;
};

export type PrintReport = {
  /** What to print, in order. */
  lines: string[];
  /** Said on stderr: the record disagrees with itself, and nothing fixed it. */
  warnings: string[];
  papers: { format: PaperFormat; path: string; variant: string | null }[];
  /** Record files written. */
  written: string[];
};

/** Print one assessment's question paper. Writes files; starts no process. */
export const printPaper = async (options: PrintOptions): Promise<PrintReport> => {
  const { assessmentId } = options;
  const format = options.format ?? "both";
  if (!["docx", "pdf", "both"].includes(format)) throw new Error("--format must be docx, pdf or both");
  const answers = options.answers ?? "under-question";
  if (answers !== "under-question" && answers !== "separate-sheet") {
    throw new Error("--answers must be under-question or separate-sheet");
  }

  const root = resolve(options.root);
  const workspace = new Workspace(root, options.rootSource ?? "flag");
  const bundle = workspace.findAssessment(assessmentId);

  const assessment = (bundle.assessments as any[]).find((row) => row.assessment_id === assessmentId);
  if (!assessment) throw new Error(`no assessment '${assessmentId}' in this workspace`);

  // `role: main` only. A `preparation` item is not on the paper, and an item
  // with no number has no place in a numbered list — saying so beats printing
  // it at an arbitrary position.
  const all = (bundle.items as any[]).filter((row) => row.assessment_id === assessmentId);
  const unnumbered = all.filter((row) => row.role === "main" && !row.number);
  if (unnumbered.length) {
    throw new Error(
      `${unnumbered.length} item(s) on ${assessmentId} carry no number: ` +
        unnumbered.map((row) => row.item_id).join(", "),
    );
  }
  const numbered = all.filter((row) => row.role === "main" && row.number).sort((a, b) => a.number - b.number);
  if (!numbered.length) throw new Error(`${assessmentId} has no numbered items to print`);

  // An exam with versions is several papers: each version's own items plus the
  // shared ones (`extensions.variant` unset) — `import-paper`'s convention, and
  // the grouping `validate` checks marks and numbering by. Without versions it
  // is one paper of every item.
  const variantOf = (item: any): string | null =>
    typeof item.extensions?.variant === "string" ? item.extensions.variant : null;
  const variants = [...new Set(numbered.map(variantOf).filter((v): v is string => v !== null))].sort();
  if (options.variant && !variants.includes(options.variant)) {
    throw new Error(
      `${assessmentId} has no variant '${options.variant}'` +
        (variants.length ? ` — it has ${variants.join(", ")}` : " — it is one paper"),
    );
  }
  const printing: (string | null)[] = options.variant ? [options.variant] : variants.length ? variants : [null];

  const course: any = bundle.course;
  const courseId = course.course_id;
  // The assessment's own folder (STORAGE.md §5): a paper is course material and
  // the record has to be able to name it. The papers sit at the top of the
  // folder; the JSON they are rendered from is an intermediate under `src/`.
  const out = options.out ?? null;
  const outDir = resolve(
    out && isAbsolute(out) ? out : out ? join(root, out) : join(root, "courses", courseId, "assessments", assessmentId),
  );
  mkdirSync(join(outDir, "src"), { recursive: true });
  // `QUIZ-01` for `ASSESSMENT-QUIZ-01`: the name a professor says aloud.
  const stem = assessmentId.replace(/^ASSESSMENT-/, "");
  const formats: PaperFormat[] = format === "both" ? ["docx", "pdf"] : [format];
  const due = assessment.due_at ? String(assessment.due_at).slice(0, 10) : null;
  const declared = assessment.maximum_score;
  const printing_ = assessment.extensions?.paper ?? {};
  const pageSize = options.pageSize ?? (printing_.page_size === "a4" || printing_.page_size === "letter" ? printing_.page_size : null);
  const maxPages = options.maxPages ?? (Number.isInteger(printing_.max_pages) && printing_.max_pages > 0 ? printing_.max_pages : null);
  if (pageSize !== null && pageSize !== "a4" && pageSize !== "letter") throw new Error("--page must be a4 or letter");

  const warnings: string[] = [];
  const lines: string[] = [];
  const papers: PrintReport["papers"] = [];
  const written: string[] = [];
  const pointAts: string[] = [];

  for (const variant of printing) {
    const items = variant === null ? numbered : numbered.filter((item) => variantOf(item) === null || variantOf(item) === variant);
    const label = variant ? `variant ${variant}` : "";
    const marks = items.reduce((sum, item) => sum + (item.maximum_score ?? 0), 0);
    if (declared !== undefined && declared !== null && Math.abs(marks - declared) > 0.001) {
      // Said, not fixed. The record is the professor's; a renderer that silently
      // rescaled a paper to match a total would hide the disagreement.
      warnings.push(`warning: items total ${marks} mark(s)${label ? ` in ${label}` : ""}, ${assessmentId} declares ${declared}`);
    }

    // The header line, assembled only from what the record actually states. The
    // variant leads it, because it is what a marker reads first off a cover.
    const subtitle = [
      variant ? `Variant ${variant}` : null,
      [course?.course_id, course?.title].filter(Boolean).join(" - ") || null,
      `${marks} mark${marks === 1 ? "" : "s"}`,
      assessment.weight ? `${Number((assessment.weight * 100).toFixed(2))}% of the final grade` : null,
      due,
    ]
      .filter(Boolean)
      .join("  |  ");

    const exam = {
      title: assessment.title,
      subtitle,
      // How the paper is printed is a fact about this assessment, kept on its
      // record so a reprint comes out the same: `extensions.paper.page_size`
      // and `max_pages`. A flag on the command overrides it for one run.
      ...(pageSize ? { pageSize } : {}),
      ...(maxPages ? { maxPages } : {}),
      // Group only when this run is actually taught in subgroups.
      candidateFields: (bundle.enrollments as any[]).some(
        (row) => row.course_version_id === assessment.course_version_id && row.group,
      )
        ? ["Name", "Group"]
        : ["Name"],
      questions: items.map((item) => ({
        number: item.number,
        marks: item.maximum_score,
        prompt: item.prompt,
        ...(item.options?.length
          ? { options: item.options.map((o: any) => ({ label: o.label, text: o.text })) }
          : {}),
        responseLines: responseLines(item),
      })),
    };

    const suffix = variant ? `-${variant}` : "";
    const jsonPath = join(outDir, "src", `${stem}-paper${suffix}.json`);
    writeFileSync(jsonPath, JSON.stringify(exam, null, 2) + "\n");
    const files: string[] = [jsonPath];
    const these: { format: PaperFormat; path: string }[] = [];
    for (const one of formats) {
      const output = join(outDir, `${stem}-student${suffix}.${one}`);
      await renderExam(exam, output, one, answers);
      files.push(output);
      these.push({ format: one, path: output });
      papers.push({ format: one, path: output, variant });
    }

    lines.push(
      `${assessment.title}${variant ? ` — variant ${variant}` : ""}`,
      `  ${items.length} question(s), ${marks} mark(s)`,
      ...files.map((path) => `  wrote ${relative(root, path).split(sep).join("/")}`),
    );

    if (options.register === false) continue;
    const report = registerPapers({
      root,
      bundle,
      assessment,
      papers: these,
      baseId: `${options.docId ?? `DOC-${stem.toUpperCase()}-PAPER`}${suffix}`,
      variant,
      questions: items.length,
      marks,
      courseDir: join(root, "courses", courseId),
    });
    lines.push(...report.lines);
    for (const path of report.written) {
      const shown = `wrote ${relative(root, path).split(sep).join("/")}`;
      if (!lines.includes(shown)) lines.push(shown);
      if (!written.includes(path)) written.push(path);
    }
    if (report.pointAt !== null) pointAts.push(report.pointAt);
  }

  if (options.register === false) return { lines, warnings, papers, written };
  if (written.length) {
    lines.push("", "Each new paper is marked approval: draft. Review it, then set approval: approved.");
  }
  // The Exams tab's `Paper` row is this one field, so a registered paper no
  // assessment names reads as `no brief` on work whose paper exists. With
  // versions it names the first; the pane's papers view finds the rest by
  // `extensions.renders`.
  const pointAt = pointAts[0] ?? null;
  if (pointAt !== null && !pointAts.includes(assessment.instructions_document_id)) {
    const file = assessmentFile(root, courseId, assessmentId);
    lines.push("", "The pane opens the paper the assessment names. Record it, if it is not there yet:");
    lines.push(`  instructions_document_id: ${pointAt}`);
    lines.push(file === null ? `  on ${assessmentId}, in courses/${courseId}/` : `  on ${assessmentId}, in ${file}`);
  }
  return { lines, warnings, papers, written };
};
