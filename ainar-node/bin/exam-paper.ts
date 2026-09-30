#!/usr/bin/env node

/**
 * Turn an approved assessment into a printable paper, straight from the record.
 *
 * `render-exam.ts` renders a paper but takes JSON it cannot produce; the course
 * model holds the questions but has no way to print them. This is the piece
 * between them: it reads `assessments/` and `items/` out of the bundle, maps the
 * items to the shape `render-exam.ts` validates, and spawns it once per format.
 *
 * **Why spawn rather than import.** `render-exam.ts` exports nothing and calls
 * `main()` at module scope, so importing it would run its CLI. Spawning reuses
 * the renderer exactly as it is tested rather than forking a second copy of it,
 * which is the mistake `PROVENANCE.md` records for the slides plugin.
 *
 * **No LibreOffice.** DOCX comes from `docx` and PDF from `pdf-lib`, both of
 * them writers rather than converters. That is the whole reason this path
 * exists beside `ainar materials`, whose PDFs are a LibreOffice conversion of a
 * `.pptx` and fail on a machine without it.
 *
 * **Question paper only.** `answer_key` and `marking_guidance` are read from the
 * record and deliberately not written: `render-exam.ts` has no notion of a key,
 * and a marking key that arrives by accident beside a student paper is the kind
 * of file that ends up in the wrong hands. `--key` is not implemented rather
 * than half-implemented.
 *
 * **A paper nobody recorded is a file, not a record.** Printing one used to end
 * at the filesystem: the pane's Exams tab draws a `Paper` row off the
 * assessment's `instructions_document_id`, so a paper that existed and was
 * never registered read as `no brief` — the wrong claim, not merely a missing
 * control, which is the fault `sendBrief` and the `no brief` amber exist to
 * end. So each printing is also described as a `Document`, checked by
 * `documentRecord` and written into the course marked `approval: draft`. A
 * reprint replaces its own record — new checksum, same approval.
 *
 * The last hop is the professor's and is printed rather than performed: the
 * assessment's `instructions_document_id` is the professor's own record, so it
 * is a line for them to add, the way `homework publish` hands back
 * `extensions.github.template_repo`.
 *
 * The papers are written to the assessment's own folder,
 * `courses/<COURSE>/assessments/<ID>/QUIZ-01-student.pdf`, with the JSON they
 * are rendered from under its `src/` (STORAGE.md §5).
 *
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --root <workspace>
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --format pdf --out output/
 *     exam-paper.ts --assessment ASSESSMENT-QUIZ-01 --no-register
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { documentRecord } from "../src/materials.ts";
import { writeRecords } from "../src/records-write.ts";
import { Workspace } from "../src/workspace.ts";

type Format = "docx" | "pdf";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERER = join(HERE, "render-exam.ts");

const USAGE =
  "Usage: exam-paper.ts --assessment ID [--root DIR] [--out DIR]\n" +
  "                    [--format docx|pdf|both] [--answers under-question|separate-sheet]\n" +
  "                    [--doc-id DOC-XXX] [--no-register]";

/**
 * What a paper is served as.
 *
 * The PDF is the half a browser paints: it is in the pane's `SHOWABLE` set and
 * opens over the harness, while a `.docx` is a download everywhere unless the
 * machine has LibreOffice. That is why a run that writes both points the
 * assessment at the PDF.
 */
const MIME: Record<Format, string> = {
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
const responseLines = (item: any): number => {
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
const assessmentFile = (root: string, courseId: string, assessmentId: string): string | null => {
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
  papers: { format: Format; path: string }[];
  baseId: string;
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
  const registered: { format: Format; id: string }[] = [];

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
        title: `${assessment.title} — question paper (${paper.format.toUpperCase()})`,
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
          produced_by: "ainar-node/bin/exam-paper.ts",
          // The assessment, not the items: a paper is the printing of one piece
          // of graded work, and its questions are reachable from it. A list of
          // item identifiers here would be a second copy of the paper's
          // contents, to fall out of step with the first the moment one is
          // renumbered.
          input_refs: [assessment.assessment_id],
          created_at: stamp,
        },
        extensions: {
          // What the pane badges. A paper printed from the record is generated,
          // and an artefact that declares nothing is drawn as unfinished rather
          // than silently as this.
          origin: "generated",
          // Not `rendered_from`: that edge names the Document an artefact was
          // converted from, and this paper was written from the record's items.
          // The DOCX and the PDF are siblings out of one renderer, neither made
          // from the other, and saying otherwise would be a tidy lie.
          questions: options.questions,
          marks: options.marks,
        },
      }),
    );
    registered.push({ format: paper.format, id: documentId });
  }

  // The PDF when there is one. The pane frames a PDF over the harness and sends
  // a `.docx` to a tab unless this machine has LibreOffice, so pointing the
  // assessment at the PDF is pointing it at the half that opens.
  const pointAt =
    registered.find((entry) => entry.format === "pdf")?.id ?? registered[0]?.id ?? null;

  if (documents.length === 0) return { lines, written: [], pointAt };

  const written = writeRecords(courseDir, { documents }, { keepApproval: true });
  return { lines, written, pointAt };
};

const parse = (argv: string[]): Record<string, string> => {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(USAGE);
    values[key.slice(2)] = value;
  }
  return values;
};

const main = (): void => {
  // Lifted out before the pairs are read: `parse` takes `--key value` two at a
  // time, so a switch with no value would swallow the next flag as its own.
  const argv = process.argv.slice(2);
  const register = !argv.includes("--no-register");
  const args = parse(argv.filter((one) => one !== "--no-register"));
  const assessmentId = args.assessment;
  if (!assessmentId) throw new Error(USAGE);

  const format = args.format ?? "both";
  if (!["docx", "pdf", "both"].includes(format)) {
    throw new Error("--format must be docx, pdf or both");
  }
  const answers = args.answers ?? "under-question";

  const root = resolve(args.root ?? process.cwd());
  const workspace = new Workspace(root, args.root ? "flag" : "cwd");
  const bundle = workspace.findAssessment(assessmentId);

  const assessment = (bundle.assessments as any[]).find(
    (row) => row.assessment_id === assessmentId,
  );
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
  const items = all
    .filter((row) => row.role === "main" && row.number)
    .sort((a, b) => a.number - b.number);
  if (!items.length) throw new Error(`${assessmentId} has no numbered items to print`);

  const marks = items.reduce((sum, item) => sum + (item.maximum_score ?? 0), 0);
  const declared = assessment.maximum_score;
  if (declared !== undefined && declared !== null && Math.abs(marks - declared) > 0.001) {
    // Said, not fixed. The record is the professor's; a renderer that silently
    // rescaled a paper to match a total would hide the disagreement.
    process.stderr.write(
      `warning: items total ${marks} mark(s), ${assessmentId} declares ${declared}\n`,
    );
  }

  // The header line, assembled only from what the record actually states. A
  // course with no department, a quiz with no weight or no date each simply
  // contribute nothing rather than a placeholder.
  const course: any = bundle.course;
  const due = assessment.due_at ? String(assessment.due_at).slice(0, 10) : null;
  const subtitle = [
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
    // Group only when this run is actually taught in subgroups — asked from the
    // enrollments, which is where `group` lives. A paper printed for a
    // subgrouped class without it is one somebody sorts by hand afterwards; a
    // paper printed with it for a class that has none is a box nobody can fill.
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

  // The assessment's own folder, `courses/<COURSE>/assessments/<ID>/`
  // (STORAGE.md §5), rather than the working directory: a paper is course
  // material and the record has to be able to name it — a `storage_key` is a
  // path in this repository, so a paper printed outside it is a file the pane
  // can never serve. The papers sit at the top of the folder, where the
  // professor looks for them; the JSON they are rendered from is an
  // intermediate and goes under `src/`.
  const courseId = (bundle.course as any).course_id;
  const outDir = resolve(
    isAbsolute(args.out ?? "")
      ? args.out!
      : args.out
        ? join(root, args.out)
        : join(root, "courses", courseId, "assessments", assessmentId),
  );
  mkdirSync(join(outDir, "src"), { recursive: true });

  // `QUIZ-01` for `ASSESSMENT-QUIZ-01`: the name a professor says aloud.
  const stem = assessmentId.replace(/^ASSESSMENT-/, "");
  const jsonPath = join(outDir, "src", `${stem}-paper.json`);
  writeFileSync(jsonPath, JSON.stringify(exam, null, 2) + "\n");

  const formats: Format[] = format === "both" ? ["docx", "pdf"] : [format as Format];
  const written: string[] = [jsonPath];
  const papers: { format: Format; path: string }[] = [];
  for (const one of formats) {
    const output = join(outDir, `${stem}-student.${one}`);
    const run = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        RENDERER,
        "--input", jsonPath,
        "--output", output,
        "--format", one,
        "--answers", answers,
      ],
      { encoding: "utf-8" },
    );
    // Both the exit code and the renderer's own stderr, because render-exam
    // reports a missing dependency on stderr and a bare "it failed" would send
    // the reader to the wrong place.
    if (run.status !== 0) {
      throw new Error(
        `render-exam failed for ${one} (exit ${run.status})\n${run.stderr || run.stdout || ""}`,
      );
    }
    written.push(output);
    papers.push({ format: one, path: output });
  }

  process.stdout.write(
    `${assessment.title}\n` +
      `  ${items.length} question(s), ${marks} mark(s)\n` +
      written.map((path) => `  wrote ${path}`).join("\n") +
      "\n",
  );

  if (!register) return;

  const report = registerPapers({
    root,
    bundle,
    assessment,
    papers,
    baseId: args["doc-id"] ?? `DOC-${stem.toUpperCase()}-PAPER`,
    questions: items.length,
    marks,
    courseDir: join(root, "courses", courseId),
  });

  const out: string[] = [""];
  out.push(...report.lines);
  for (const path of report.written) {
    out.push(`wrote ${relative(root, path).split(sep).join("/")}`);
  }
  if (report.written.length) {
    out.push("A new paper is marked approval: draft. Review it, then set approval: approved.");
  }
  if (report.pointAt !== null) {
    const file = assessmentFile(root, courseId, assessmentId);
    out.push("");
    // The Exams tab's `Paper` row, and the Assessments list's `open`, are both
    // this one field. Said even when the record already holds the document,
    // because a registered paper no assessment names is exactly the state that
    // reads as `no brief` on a piece of work whose paper exists.
    out.push("The pane opens the paper the assessment names. Record it, if it is not there yet:");
    out.push(`  instructions_document_id: ${report.pointAt}`);
    out.push(
      file === null
        ? `  on ${assessmentId}, in courses/${courseId}/`
        : `  on ${assessmentId}, in ${file}`,
    );
  }
  if (out.length > 1) process.stdout.write(out.join("\n") + "\n");
};

try {
  main();
} catch (error) {
  process.stderr.write(String((error as Error).message ?? error) + "\n");
  process.exit(1);
}
