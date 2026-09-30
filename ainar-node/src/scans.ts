/**
 * Scanned papers: from a pile of PDFs to pseudonymous records a grader can use.
 *
 * A handwritten exam comes back from the scanner as PDFs that carry names and
 * handwriting, so they never enter the repository (STORAGE.md §5, "Scanned
 * papers"). They live under the private submissions folder:
 *
 *     ~/.ainar/submissions/<RUN>/<ASSESSMENT>/
 *       _inbox/            the PDFs as uploaded, and plan.yaml — who is where
 *       _inbox/done/       a batch every page of which has been placed
 *       <STUDENT>/         scan.pdf, scan.json, transcript.yaml
 *
 * Four steps, and the split between them is the point. The machine does what
 * is deterministic — counting pages, splitting, looking a number up in the
 * roster, writing records. Reading a cover page or a handwritten answer is a
 * judgement, made by whoever reads the pages (the agent, or the professor),
 * and written down in a file this module then checks rather than trusts:
 *
 * 1. **plan** — list the PDFs in `_inbox/` and propose how they split. Three
 *    starting shapes: one paper per file; a fixed number of pages per paper
 *    (duplex is 2 per sheet); or nothing, for a batch whose papers vary in
 *    length, where the reader fills the ranges in from the cover pages.
 * 2. **apply** — check the plan (every page of every file used exactly once, a
 *    variant the assessment has), resolve each paper to a pseudonym through the
 *    private roster, split it out to `<STUDENT>/scan.pdf`, and write one
 *    Submission per student into the course. A paper that matches nobody, or
 *    two people, is left in the plan with the problem written beside it —
 *    never guessed.
 * 3. **transcript** — the reader fills `<STUDENT>/transcript.yaml`, one entry
 *    per question of that student's variant: the options marked, or the answer
 *    as written, the page, and how sure they are.
 * 4. **record** — a complete transcript becomes ItemResponses in the course,
 *    marked `approval: draft`: a model read that handwriting, and a misread is
 *    the kind of mistake a person catches. `ainar score-items` then scores the
 *    choice items; `/grade-batch` grades the written ones against the rubric,
 *    citing the scan by reference.
 *
 * Nothing here calls a model, and nothing here names a student outside the
 * private folder.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { degrees, PDFDocument } from "pdf-lib";
import { parse, stringify } from "yaml";
import { ItemResponse, Submission } from "./model/assessment.ts";
import { pseudonym, RosterStore } from "./roster.ts";

// --------------------------------------------------------------------------
// Where
// --------------------------------------------------------------------------

/** The private submissions folder. Never inside the repository. */
export const submissionsDir = (explicit?: string | null): string => {
  const expand = (value: string): string =>
    value.startsWith("~") ? resolve(homedir(), value.slice(1).replace(/^[\\/]/, "")) : resolve(value);
  if (explicit) return expand(explicit);
  const fromEnv = (process.env.AINAR_SUBMISSIONS_DIR ?? "").trim();
  if (fromEnv) return expand(fromEnv);
  return join(homedir(), ".ainar", "submissions");
};

export interface ScanPlace {
  /** `<submissions>/<RUN>/<ASSESSMENT>` */
  base: string;
  inbox: string;
  done: string;
  plan: string;
}

export const scanPlace = (submissions: string, courseVersionId: string, assessmentId: string): ScanPlace => {
  const base = join(submissions, courseVersionId, assessmentId);
  const inbox = join(base, "_inbox");
  return { base, inbox, done: join(inbox, "done"), plan: join(inbox, "plan.yaml") };
};

/** How a grader's evidence names a scan without copying it. */
export const scanRef = (courseVersionId: string, assessmentId: string, studentId: string): string =>
  `private://submissions/${courseVersionId}/${assessmentId}/${studentId}/scan.pdf`;

const short = (id: string, prefix: string): string => (id.startsWith(prefix) ? id.slice(prefix.length) : id);

/** `SUB-4F2A7Q-MIDTERM` — the same shape `lms import-submissions` writes. */
export const scanSubmissionId = (studentId: string, assessmentId: string): string =>
  `SUB-${short(studentId, "STUDENT-")}-${short(assessmentId, "ASSESSMENT-")}`;

/** `RESP-4F2A7Q-MID-03` — one student's answer to one item. */
export const scanResponseId = (studentId: string, itemId: string): string =>
  `RESP-${short(studentId, "STUDENT-")}-${short(itemId, "ITEM-")}`;

const digest = (bytes: Uint8Array): string => "sha256:" + createHash("sha256").update(bytes).digest("hex");

const PLAN_HEADER =
  "# PRIVATE — who is on which pages, read off the cover pages. It holds names,\n" +
  "# so it lives here, outside the repository, and nowhere else.\n" +
  "#\n" +
  "# One entry per paper. `pages` is a range in that file (1-5, or 1-3,7).\n" +
  "# Say who it is with `number` (the student number as written, in quotes so a\n" +
  "# leading zero survives: \"0012345\") or `name`, or\n" +
  "# `student` if you already know the pseudonym. `variant` when the exam has\n" +
  "# versions. A page that is nobody's — the question sheet, a blank — is its\n" +
  "# own entry with `skip: <why>`. Every page of every file is used exactly once.\n" +
  "# `ainar scans apply` writes `resolved` or `problem` beside each entry.\n\n";

const TRANSCRIPT_HEADER =
  "# PRIVATE — the answers as read off this student's pages. Outside the\n" +
  "# repository. Fill one entry per question:\n" +
  "#   choice items   chosen: [b]           the options marked\n" +
  "#   written items  text: ...             the answer as written, word for word\n" +
  "#   unanswered     blank: true\n" +
  "# and for each: page (1-based, in scan.pdf) and confidence: high | medium | low.\n" +
  "# `ainar scans record` refuses a transcript with an entry left unread.\n\n";

// --------------------------------------------------------------------------
// The plan
// --------------------------------------------------------------------------

export interface PlanPaper {
  pages: string;
  number?: string;
  name?: string;
  student?: string;
  variant?: string;
  skip?: string;
  confidence?: string;
  /** Degrees to turn a page by, keyed by its page number in the file. */
  rotate?: Record<string, number>;
  note?: string;
  resolved?: string;
  problem?: string;
}

export interface PlanSource {
  file: string;
  page_count: number;
  checksum: string;
  papers: PlanPaper[];
}

export interface ScanPlan {
  course_version_id: string;
  assessment_id: string;
  sources: PlanSource[];
}

/** `1-5`, `3`, `1-3,7` → 1-based page numbers, in the order written. */
export const parsePages = (spec: string | number): number[] => {
  const pages: number[] = [];
  for (const part of String(spec).split(",")) {
    const trimmed = part.trim();
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from) throw new Error(`page range ${trimmed} runs backwards`);
      for (let page = from; page <= to; page += 1) pages.push(page);
    } else if (/^\d+$/.test(trimmed)) {
      pages.push(Number(trimmed));
    } else {
      throw new Error(`cannot read page range "${trimmed}" — write 1-5, 3, or 1-3,7`);
    }
  }
  return pages;
};

const range = (from: number, to: number): string => (from === to ? `${from}` : `${from}-${to}`);

export type Shape = { kind: "per-file" } | { kind: "fixed"; pagesPerPaper: number } | { kind: "read" };

/** The papers a file is proposed to hold, before anybody has read it. */
export const proposePapers = (pageCount: number, shape: Shape): PlanPaper[] => {
  if (shape.kind === "per-file") return [{ pages: range(1, pageCount) }];
  if (shape.kind === "read") return [];
  const size = shape.pagesPerPaper;
  const papers: PlanPaper[] = [];
  for (let start = 1; start <= pageCount; start += size) {
    papers.push({ pages: range(start, Math.min(start + size - 1, pageCount)) });
  }
  const last = papers.at(-1);
  if (last && pageCount % size !== 0) {
    last.note = `only ${pageCount % size} page(s) where ${size} were expected — a missing page, or a split to fix`;
  }
  return papers;
};

const pdfFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /\.pdf$/i.test(name) && statSync(join(directory, name)).isFile())
    .sort();
};

export const readPlan = (place: ScanPlace): ScanPlan | null => {
  if (!existsSync(place.plan)) return null;
  const plan = parse(readFileSync(place.plan, "utf-8")) as ScanPlan | null;
  if (!plan || !Array.isArray(plan.sources)) throw new Error(`${place.plan} is not a scan plan`);
  for (const source of plan.sources) source.papers ??= [];
  return plan;
};

export const writePlan = (place: ScanPlace, plan: ScanPlan): void => {
  mkdirSync(place.inbox, { recursive: true });
  writeFileSync(place.plan, PLAN_HEADER + stringify(plan, { lineWidth: 0 }), "utf-8");
};

export interface PlanResult {
  plan: ScanPlan;
  added: string[];
  kept: string[];
  changed: string[];
}

/**
 * List the PDFs in `_inbox/` and propose how each splits.
 *
 * Additive: a file already in the plan keeps what somebody wrote for it, so a
 * late paper dropped in next week is added without undoing this week's reading.
 * A file whose bytes changed since it was planned is re-proposed and named, so
 * a rescan is never split by the old ranges.
 */
export const planScans = async (
  place: ScanPlace,
  ids: { courseVersionId: string; assessmentId: string },
  shape: Shape,
): Promise<PlanResult> => {
  const existing = readPlan(place);
  const plan: ScanPlan = existing ?? {
    course_version_id: ids.courseVersionId,
    assessment_id: ids.assessmentId,
    sources: [],
  };
  const result: PlanResult = { plan, added: [], kept: [], changed: [] };
  for (const file of pdfFiles(place.inbox)) {
    const bytes = readFileSync(join(place.inbox, file));
    const checksum = digest(bytes);
    const pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
    const known = plan.sources.find((source) => source.file === file);
    if (known && known.checksum === checksum) {
      result.kept.push(file);
      continue;
    }
    const fresh: PlanSource = { file, page_count: pageCount, checksum, papers: proposePapers(pageCount, shape) };
    if (known) {
      plan.sources[plan.sources.indexOf(known)] = fresh;
      result.changed.push(file);
    } else {
      plan.sources.push(fresh);
      result.added.push(file);
    }
  }
  writePlan(place, plan);
  return result;
};

// --------------------------------------------------------------------------
// Checking a plan
// --------------------------------------------------------------------------

/** Every variant label the assessment's items carry; empty when it has one version. */
export const variantsOf = (items: any[]): string[] =>
  [...new Set(items.map((item) => item.extensions?.variant).filter((v): v is string => typeof v === "string"))].sort();

/** The items one variant is made of: its own, plus those every variant shares. */
export const itemsForVariant = (items: any[], variant: string | undefined): any[] =>
  items.filter((item) => {
    const own = item.extensions?.variant;
    return own === undefined || own === null || own === variant;
  });

/** Problems with the shape of one file's papers: the pages, and the variant. */
export const checkSource = (source: PlanSource, variants: string[]): Map<PlanPaper | null, string> => {
  const problems = new Map<PlanPaper | null, string>();
  const used = new Map<number, number>();
  for (const paper of source.papers) {
    let pages: number[];
    try {
      pages = parsePages(paper.pages);
    } catch (error) {
      problems.set(paper, (error as Error).message);
      continue;
    }
    const outside = pages.filter((page) => page < 1 || page > source.page_count);
    if (outside.length) {
      problems.set(paper, `page(s) ${outside.join(", ")} are not in ${source.file} (${source.page_count} pages)`);
    }
    for (const page of pages) used.set(page, (used.get(page) ?? 0) + 1);
    if (paper.skip) continue;
    if (variants.length && !paper.variant) {
      problems.set(paper, `the exam has variants ${variants.join(", ")} — say which this paper is`);
    } else if (paper.variant && !variants.includes(paper.variant)) {
      problems.set(
        paper,
        variants.length
          ? `variant ${paper.variant} is not one of ${variants.join(", ")}`
          : `variant ${paper.variant} given, but no item of this assessment carries extensions.variant`,
      );
    }
    for (const [page, turn] of Object.entries(paper.rotate ?? {})) {
      if (![90, 180, 270, -90].includes(Number(turn))) problems.set(paper, `rotate ${page}: ${turn} — use 90, 180 or 270`);
      if (!pages.includes(Number(page))) problems.set(paper, `rotate names page ${page}, which is not this paper's`);
    }
  }
  const twice = [...used].filter(([, count]) => count > 1).map(([page]) => page);
  const missing: number[] = [];
  for (let page = 1; page <= source.page_count; page += 1) if (!used.has(page)) missing.push(page);
  if (twice.length) problems.set(null, `page(s) ${twice.join(", ")} of ${source.file} are in two entries`);
  else if (missing.length) {
    problems.set(null, `page(s) ${missing.join(", ")} of ${source.file} are in no entry — give them to a paper, or skip them`);
  }
  return problems;
};

// --------------------------------------------------------------------------
// Who a paper belongs to
// --------------------------------------------------------------------------

/** Lowercase, no punctuation, words sorted: "Surname Name" and "NAME, Surname" agree. */
export const nameKey = (name: string): string =>
  name
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

export type Identity = { student: string } | { problem: string };

/**
 * The pseudonym a paper belongs to, from what is written on it.
 *
 * A student number is exact: it is hashed with the roster's salt exactly as
 * `roster import` did, and must be someone the roster knows. A name must match
 * exactly one person enrolled in this run once case, punctuation and word order
 * are set aside; two matches is a problem to show, not a coin to toss.
 */
export const identify = (
  paper: PlanPaper,
  context: { store: RosterStore; salt: Uint8Array | null; enrolled: Set<string> },
): Identity => {
  const { store, salt, enrolled } = context;
  if (paper.student) {
    if (!/^STUDENT-[A-Z0-9]+$/.test(paper.student)) return { problem: `${paper.student} is not a pseudonym` };
    return enrolled.has(paper.student)
      ? { student: paper.student }
      : { problem: `${paper.student} is not enrolled in this run` };
  }
  if (paper.number) {
    if (!salt) return { problem: "a student number needs the roster's salt — run `ainar roster import` first" };
    const student = pseudonym(String(paper.number), salt);
    if (!store.people[student]) return { problem: "no student in the roster has that number" };
    return enrolled.has(student) ? { student } : { problem: `${student} is in the roster but not enrolled in this run` };
  }
  if (paper.name) {
    const key = nameKey(paper.name);
    const matches = Object.entries(store.people)
      .filter(([id, person]) => enrolled.has(id) && person.name && nameKey(person.name) === key)
      .map(([id]) => id);
    if (matches.length === 1) return { student: matches[0]! };
    return { problem: matches.length ? `the name matches ${matches.length} enrolled students` : "the name matches no enrolled student" };
  }
  return { problem: "no number, name or student given" };
};

// --------------------------------------------------------------------------
// Applying a plan
// --------------------------------------------------------------------------

interface ScanMeta {
  student_id: string;
  assessment_id: string;
  course_version_id: string;
  variant: string | null;
  page_count: number;
  /** The batch it came from, by content: its file name may carry a name. */
  source_checksum: string;
  source_pages: string;
  checksum: string;
  split_at: string;
}

export interface ApplyResult {
  placed: { student: string; pages: number; variant: string | null; replaced: boolean }[];
  unchanged: string[];
  problems: { file: string; pages: string | null; problem: string }[];
  skipped: number;
  finished: string[];
  submissions: Record<string, unknown>[];
  transcripts: string[];
}

export interface ApplyContext {
  place: ScanPlace;
  courseVersionId: string;
  assessmentId: string;
  items: any[];
  enrolled: Set<string>;
  store: RosterStore;
  salt: Uint8Array | null;
  /** A student who already has a different scan: replace it rather than refuse. */
  replace?: boolean;
  dryRun?: boolean;
  now: string;
}

const transcriptSkeleton = (meta: ScanMeta, items: any[]): string => {
  const answers = [...items]
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || String(a.item_id).localeCompare(String(b.item_id)))
    .map((item) => {
      const choice = (item.options ?? []).length > 0;
      return {
        item: item.item_id,
        number: item.number ?? null,
        type: item.type,
        ...(choice ? { options: item.options.map((option: any) => option.label), chosen: [] } : { text: null }),
        page: null,
        blank: false,
        confidence: null,
        note: null,
      };
    });
  return (
    TRANSCRIPT_HEADER +
    stringify(
      {
        student_id: meta.student_id,
        assessment_id: meta.assessment_id,
        variant: meta.variant,
        page_count: meta.page_count,
        read_by: null,
        answers,
      },
      { lineWidth: 0 },
    )
  );
};

/**
 * Check the plan, place every paper that resolves, and say what did not.
 *
 * Per file, not all-or-nothing across the pile: a batch whose pages do not add
 * up is held back whole (its ranges are wrong somewhere, and a paper split by a
 * wrong range is somebody else's pages), while in a batch that does add up each
 * paper that resolves is placed and each that does not waits in the plan with
 * its problem written beside it. Re-running is safe: a paper already placed
 * from the same pages is left alone.
 */
export const applyScans = async (plan: ScanPlan, context: ApplyContext): Promise<ApplyResult> => {
  const { place, courseVersionId, assessmentId, items } = context;
  const variants = variantsOf(items);
  const result: ApplyResult = {
    placed: [],
    unchanged: [],
    problems: [],
    skipped: 0,
    finished: [],
    submissions: [],
    transcripts: [],
  };

  // Resolve everyone first: a student on two papers is a problem on both,
  // wherever in the pile the second one is.
  const who = new Map<PlanPaper, Identity>();
  const owners = new Map<string, PlanPaper[]>();
  for (const source of plan.sources) {
    for (const paper of source.papers) {
      delete paper.resolved;
      delete paper.problem;
      if (paper.skip) continue;
      const identity = identify(paper, context);
      who.set(paper, identity);
      if ("student" in identity) owners.set(identity.student, [...(owners.get(identity.student) ?? []), paper]);
    }
  }
  for (const [student, papers] of owners) {
    if (papers.length < 2) continue;
    for (const paper of papers) who.set(paper, { problem: `${papers.length} papers resolve to ${student}` });
  }

  for (const source of plan.sources) {
    const path = existsSync(join(place.inbox, source.file))
      ? join(place.inbox, source.file)
      : join(place.done, source.file);
    if (!existsSync(path)) {
      result.problems.push({ file: source.file, pages: null, problem: "the file is gone from the inbox" });
      continue;
    }
    const bytes = readFileSync(path);
    if (digest(bytes) !== source.checksum) {
      result.problems.push({ file: source.file, pages: null, problem: "the file changed since it was planned — run `scans plan` again" });
      continue;
    }
    if (!source.papers.length) {
      result.problems.push({ file: source.file, pages: null, problem: "no papers listed yet — read the cover pages and fill in the ranges" });
      continue;
    }
    const shape = checkSource(source, variants);
    const whole = shape.get(null);
    if (whole) {
      result.problems.push({ file: source.file, pages: null, problem: whole });
      continue;
    }

    const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
    let open = 0;
    for (const paper of source.papers) {
      if (paper.skip) {
        result.skipped += 1;
        continue;
      }
      const problem = shape.get(paper) ?? ("problem" in who.get(paper)! ? (who.get(paper) as { problem: string }).problem : null);
      if (problem) {
        paper.problem = problem;
        result.problems.push({ file: source.file, pages: paper.pages, problem });
        open += 1;
        continue;
      }
      const student = (who.get(paper) as { student: string }).student;
      paper.resolved = student;
      const pages = parsePages(paper.pages);

      const out = await PDFDocument.create();
      const copied = await out.copyPages(document, pages.map((page) => page - 1));
      copied.forEach((page, index) => {
        const turn = Number(paper.rotate?.[String(pages[index])] ?? 0);
        if (turn) page.setRotation(degrees((page.getRotation().angle + turn + 360) % 360));
        out.addPage(page);
      });
      // A fixed date, so the same pages always split to the same bytes and a
      // re-run can tell "already placed" from "a different scan".
      out.setCreationDate(new Date(0));
      out.setModificationDate(new Date(0));
      const split = await out.save();
      const checksum = digest(split);

      const folder = join(place.base, student);
      const metaPath = join(folder, "scan.json");
      const previous: ScanMeta | null = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf-8")) : null;
      if (previous && previous.checksum === checksum) {
        result.unchanged.push(student);
      } else {
        if (previous && !context.replace) {
          paper.problem = `${student} already has a different scan — pass --replace to use this one`;
          delete paper.resolved;
          result.problems.push({ file: source.file, pages: paper.pages, problem: paper.problem });
          open += 1;
          continue;
        }
        const meta: ScanMeta = {
          student_id: student,
          assessment_id: assessmentId,
          course_version_id: courseVersionId,
          variant: paper.variant ?? null,
          page_count: pages.length,
          source_checksum: source.checksum,
          source_pages: paper.pages,
          checksum,
          split_at: context.now,
        };
        if (!context.dryRun) {
          mkdirSync(folder, { recursive: true });
          writeFileSync(join(folder, "scan.pdf"), split);
          writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
          const transcript = join(folder, "transcript.yaml");
          if (!existsSync(transcript) || previous) {
            writeFileSync(transcript, transcriptSkeleton(meta, itemsForVariant(items, paper.variant)));
            result.transcripts.push(student);
          }
        }
        result.placed.push({ student, pages: pages.length, variant: paper.variant ?? null, replaced: previous !== null });
      }

      const record = {
        submission_id: scanSubmissionId(student, assessmentId),
        assessment_id: assessmentId,
        student_id: student,
        status: "submitted",
        files: [],
        extensions: {
          scan: {
            pages: pages.length,
            ...(paper.variant ? { variant: paper.variant } : {}),
            checksum,
            ref: scanRef(courseVersionId, assessmentId, student),
          },
        },
      };
      const parsed = Submission.safeParse(record);
      if (!parsed.success) throw new Error(`a submission for ${student} would be invalid: ${parsed.error.message}`);
      result.submissions.push(record);
    }
    if (open === 0) {
      result.finished.push(source.file);
      if (!context.dryRun && path.startsWith(place.inbox) && !path.startsWith(place.done)) {
        mkdirSync(place.done, { recursive: true });
        renameSync(path, join(place.done, source.file));
      }
    }
  }
  if (!context.dryRun) writePlan(place, plan);
  return result;
};

// --------------------------------------------------------------------------
// Recording transcripts
// --------------------------------------------------------------------------

export interface RecordResult {
  responses: Record<string, unknown>[];
  recorded: string[];
  incomplete: { student: string; unread: string[] }[];
  invalid: { student: string; problem: string }[];
  low: { student: string; item: string; page: number | null }[];
  blank: number;
}

/**
 * Turn every complete transcript into ItemResponses, marked `approval: draft`.
 *
 * A transcript is taken whole or not at all: half a student's answers recorded
 * would score as a paper with the other half blank. An entry is read when it is
 * `blank: true`, or has what its item needs (`chosen` for a choice item, `text`
 * for a written one) together with a `confidence`.
 */
export const recordTranscripts = (context: {
  place: ScanPlace;
  assessmentId: string;
  items: any[];
  submitted: Set<string>;
  now: string;
}): RecordResult => {
  const result: RecordResult = { responses: [], recorded: [], incomplete: [], invalid: [], low: [], blank: 0 };
  const byId = new Map(context.items.map((item) => [item.item_id, item]));
  if (!existsSync(context.place.base)) return result;

  for (const student of readdirSync(context.place.base).filter((name) => name.startsWith("STUDENT-")).sort()) {
    const path = join(context.place.base, student, "transcript.yaml");
    if (!existsSync(path)) continue;
    let transcript: any;
    try {
      transcript = parse(readFileSync(path, "utf-8"));
    } catch (error) {
      result.invalid.push({ student, problem: `cannot parse transcript.yaml: ${(error as Error).message}` });
      continue;
    }
    if (transcript?.student_id !== student) {
      result.invalid.push({ student, problem: "the transcript names a different student than its folder" });
      continue;
    }
    if (!context.submitted.has(student)) {
      result.invalid.push({ student, problem: "no submission in the course — run `scans apply` first" });
      continue;
    }
    const expected = itemsForVariant(context.items, transcript.variant ?? undefined).map((item) => item.item_id);
    const answers: any[] = Array.isArray(transcript.answers) ? transcript.answers : [];
    const seen = new Set<string>();
    const unread: string[] = [];
    const drafted: Record<string, unknown>[] = [];
    let problem: string | null = null;

    for (const answer of answers) {
      const item = byId.get(answer?.item);
      if (!item || !expected.includes(answer.item)) {
        problem = `${answer?.item} is not a question of this paper's variant`;
        break;
      }
      if (seen.has(answer.item)) {
        problem = `${answer.item} is answered twice`;
        break;
      }
      seen.add(answer.item);
      const choice = (item.options ?? []).length > 0;
      const chosen: string[] = Array.isArray(answer.chosen) ? answer.chosen.map(String) : [];
      const text = typeof answer.text === "string" ? answer.text : null;
      const blank = answer.blank === true;
      const read = blank || ((choice ? chosen.length > 0 : text !== null && text.trim() !== "") && !!answer.confidence);
      if (!read) {
        unread.push(answer.item);
        continue;
      }
      if (choice) {
        const labels = new Set((item.options ?? []).map((option: any) => String(option.label)));
        const unknown = chosen.filter((label) => !labels.has(label));
        if (unknown.length) {
          problem = `${answer.item}: option(s) ${unknown.join(", ")} are not on the paper`;
          break;
        }
      }
      if (answer.confidence && !["high", "medium", "low"].includes(answer.confidence)) {
        problem = `${answer.item}: confidence is high, medium or low`;
        break;
      }
      if (blank) result.blank += 1;
      if (answer.confidence === "low") result.low.push({ student, item: answer.item, page: answer.page ?? null });
      drafted.push({
        response_id: scanResponseId(student, answer.item),
        approval: "draft",
        submission_id: scanSubmissionId(student, context.assessmentId),
        item_id: answer.item,
        student_id: student,
        chosen_options: blank ? [] : chosen,
        raw_response: blank ? "" : choice ? chosen.join(", ") : text,
        extensions: {
          scan: {
            page: answer.page ?? null,
            ...(blank ? { blank: true } : { confidence: answer.confidence }),
            ...(transcript.read_by ? { read_by: String(transcript.read_by) } : {}),
            ...(answer.note ? { note: String(answer.note) } : {}),
          },
        },
      });
    }
    if (problem) {
      result.invalid.push({ student, problem });
      continue;
    }
    for (const id of expected) if (!seen.has(id)) unread.push(id);
    if (unread.length) {
      result.incomplete.push({ student, unread: unread.sort() });
      continue;
    }
    for (const response of drafted) {
      const parsed = ItemResponse.safeParse(response);
      if (!parsed.success) {
        problem = `${response.item_id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`;
        break;
      }
    }
    if (problem) {
      result.invalid.push({ student, problem });
      continue;
    }
    result.responses.push(...drafted);
    result.recorded.push(student);
  }
  return result;
};

// --------------------------------------------------------------------------
// Where things stand
// --------------------------------------------------------------------------

export interface ScanStatus {
  inbox: string[];
  planned: number;
  problems: number;
  unplanned: string[];
  placed: string[];
  transcribed: string[];
  missing: string[];
}

/** What is waiting, per step, without changing anything. */
export const scanStatus = (place: ScanPlace, enrolled: Set<string>): ScanStatus => {
  const plan = readPlan(place);
  const inbox = pdfFiles(place.inbox);
  const planned = new Set((plan?.sources ?? []).map((source) => source.file));
  const placed = existsSync(place.base)
    ? readdirSync(place.base).filter((name) => name.startsWith("STUDENT-") && existsSync(join(place.base, name, "scan.pdf"))).sort()
    : [];
  const transcribed = placed.filter((student) => {
    try {
      const transcript = parse(readFileSync(join(place.base, student, "transcript.yaml"), "utf-8"));
      return (transcript?.answers ?? []).every((answer: any) => answer.blank === true || !!answer.confidence);
    } catch {
      return false;
    }
  });
  return {
    inbox,
    planned: (plan?.sources ?? []).reduce((count, source) => count + source.papers.filter((paper) => !paper.skip).length, 0),
    problems: (plan?.sources ?? []).reduce((count, source) => count + source.papers.filter((paper) => paper.problem).length, 0),
    unplanned: inbox.filter((file) => !planned.has(file)),
    placed,
    transcribed,
    missing: [...enrolled].filter((student) => !placed.includes(student)).sort(),
  };
};
