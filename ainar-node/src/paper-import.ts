/**
 * An exam that already exists, read into the course: the paper as markdown,
 * the items derived from it.
 *
 * `/design-assessment` writes a new exam from a blueprint. This is the other
 * direction — the professor already set the paper and the students already sat
 * it, and what is missing is the record of its questions, without which a scan
 * has nothing to be transcribed against. The paper is kept the way it was
 * given, as markdown in the assessment's folder (STORAGE.md §5):
 *
 *     assessments/ASSESSMENT-MID-1/
 *       MID-1-student.md          the question paper, one per variant:
 *       MID-1-student-A.md        MID-1-student-B.md
 *       keys/MID-1-key.md         the answers, from the professor
 *       items.yaml                derived from the two above — never by hand
 *
 * The markdown is the source and `items.yaml` is a function of it, so the two
 * cannot drift: correcting a question is an edit to the paper and a re-import.
 *
 * ## The paper
 *
 *     ---
 *     variant: A                       # only when the exam has versions
 *     ---
 *     # Midterm 1                      # anything before the first question is the header
 *
 *     ## 1. (2 marks)
 *     Which of these is a supervised task?
 *     - (a) Clustering
 *     - (b) Classification
 *
 *     ## 2. (5 marks) {essay}
 *     Explain overfitting, with an example.
 *
 * A question is a `##` heading that starts with its number. The marks are the
 * number in parentheses or brackets on that heading — required, because a
 * question with no marks cannot be graded, and inventing them is a claim about
 * what the exam is worth. `{type}` names the item type when it is not the
 * obvious one. Option lines are `(a) …`, `a) …` or `a. …`, bulleted or not.
 *
 * ## The key
 *
 *     ## Variant A                     # a section per variant, when there are versions
 *     1. b
 *     3. a, c                          # more than one: a multiple-select item
 *     ## 2
 *     A model fits noise in the training data …   # a written answer, as long as it needs
 *
 * The key is the professor's. Nothing here guesses an answer from what most of
 * the class wrote, and a choice question with no key is refused, because
 * `score-items` would have nothing to score it against.
 */

import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { AssessmentItem } from "./model/assessment.ts";
import { CHOICE_ITEM_TYPES, ItemType } from "./model/common.ts";

export interface PaperOption {
  label: string;
  text: string;
}

export interface PaperQuestion {
  number: number;
  marks: number;
  type: string | null;
  prompt: string;
  options: PaperOption[];
}

export interface Paper {
  variant: string | null;
  header: string;
  questions: PaperQuestion[];
}

/**
 * `## 3. (4 marks) {essay}`, `## Question 3 [4]`, `## Задание 3 (2 балла)`.
 * The words allowed before the number are named, so `## Part 2` is a section
 * heading and not question 2.
 */
const QUESTION =
  /^##\s+(?:(?:question|q|problem|exercise|task|вопрос|задание|задача|сұрақ|тапсырма|есеп)\s*)?(\d+)\b[.):]?\s*(.*)$/iu;
const MARKS = /[([]\s*(\d+(?:[.,]\d+)?)\b[^)\]]*[)\]]/;
const TYPE_TAG = /\{\s*([a-z_]+)\s*\}/;
const OPTION = /^\s*(?:[-*+]\s+)?(?:\(([a-zA-Z])\)|([a-zA-Z])[.)])\s+(.+?)\s*$/;

const frontMatter = (text: string): { meta: Record<string, unknown>; body: string } => {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text.replace(/^﻿/, "") };
  const meta = (parse(match[1]!) ?? {}) as Record<string, unknown>;
  return { meta: typeof meta === "object" ? meta : {}, body: text.slice(match[0].length) };
};

const trimBlock = (lines: string[]): string => {
  const copy = [...lines];
  while (copy.length && !copy[0]!.trim()) copy.shift();
  while (copy.length && !copy.at(-1)!.trim()) copy.pop();
  return copy.join("\n");
};

/**
 * One question paper, read. Throws on what cannot be read rather than skipping
 * it: a question silently dropped is a question nobody's answer is recorded for.
 */
export const parsePaper = (text: string, where = "the paper"): Paper => {
  const { meta, body } = frontMatter(text);
  const variant = meta.variant === undefined || meta.variant === null ? null : String(meta.variant).trim();
  const header: string[] = [];
  const questions: PaperQuestion[] = [];
  let current: { question: PaperQuestion; lines: string[] } | null = null;
  const problems: string[] = [];

  const close = (): void => {
    if (!current) return;
    const prompt: string[] = [];
    for (const line of current.lines) {
      const option = OPTION.exec(line);
      if (option) {
        current.question.options.push({ label: (option[1] ?? option[2]!).toLowerCase(), text: option[3]! });
      } else if (current.question.options.length && line.trim() && /^\s{2,}/.test(line)) {
        // An indented line under an option continues it.
        const last = current.question.options.at(-1)!;
        last.text = `${last.text} ${line.trim()}`;
      } else {
        prompt.push(line);
      }
    }
    current.question.prompt = trimBlock(prompt);
    if (!current.question.prompt) problems.push(`question ${current.question.number} has no text`);
    questions.push(current.question);
    current = null;
  };

  for (const line of body.split(/\r?\n/)) {
    const heading = QUESTION.exec(line);
    if (heading) {
      close();
      const rest = heading[2] ?? "";
      const marks = MARKS.exec(rest);
      const tag = TYPE_TAG.exec(rest);
      const number = Number(heading[1]);
      if (!marks) problems.push(`question ${number} has no marks — write them on its heading, "## ${number}. (N marks)"`);
      current = {
        question: {
          number,
          marks: marks ? Number(marks[1]!.replace(",", ".")) : 0,
          type: tag ? tag[1]! : null,
          prompt: "",
          options: [],
        },
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
    else header.push(line);
  }
  close();

  if (!questions.length) problems.push('no questions found — each one is a heading like "## 1. (2 marks)"');
  const numbers = questions.map((question) => question.number);
  const twice = [...new Set(numbers.filter((number, index) => numbers.indexOf(number) !== index))];
  if (twice.length) problems.push(`question number(s) ${twice.join(", ")} appear twice`);
  for (const question of questions) {
    if (question.type && !ItemType.safeParse(question.type).success) {
      problems.push(`question ${question.number}: {${question.type}} is not an item type (${ItemType.options.join(", ")})`);
    }
    const labels = question.options.map((option) => option.label);
    const repeated = [...new Set(labels.filter((label, index) => labels.indexOf(label) !== index))];
    if (repeated.length) problems.push(`question ${question.number}: option ${repeated.join(", ")} is listed twice`);
  }
  if (problems.length) throw new Error(`${where}:\n  ${problems.join("\n  ")}`);
  return { variant, header: trimBlock(header), questions };
};

/** The key: per variant (`""` when there is one version), question number → answer as written. */
export type Key = Map<string, Map<number, string>>;

const KEY_SECTION = /^#{1,3}\s*(?:variant|version|вариант|нұсқа)\s+([A-Za-z0-9]+)\s*$/i;
const KEY_HEADING = /^#{2,3}\s*(\d+)[.):]?\s*$/;
const KEY_LINE = /^(\d+)[.):]\s+(.*)$/;

export const parseKey = (text: string): Key => {
  const { body } = frontMatter(text);
  const key: Key = new Map();
  let section = "";
  let open: { number: number; lines: string[] } | null = null;
  const put = (number: number, value: string): void => {
    if (!key.has(section)) key.set(section, new Map());
    const answers = key.get(section)!;
    if (answers.has(number)) throw new Error(`the key answers question ${number}${section ? ` of variant ${section}` : ""} twice`);
    answers.set(number, value);
  };
  const close = (): void => {
    if (open) put(open.number, trimBlock(open.lines));
    open = null;
  };
  for (const line of body.split(/\r?\n/)) {
    const variant = KEY_SECTION.exec(line);
    if (variant) {
      close();
      section = variant[1]!.toUpperCase();
      continue;
    }
    const heading = KEY_HEADING.exec(line);
    if (heading) {
      close();
      open = { number: Number(heading[1]), lines: [] };
      continue;
    }
    const entry = KEY_LINE.exec(line);
    if (entry) {
      close();
      // One line, unless more follows indented under it.
      open = { number: Number(entry[1]), lines: [entry[2]!] };
      continue;
    }
    if (open) open.lines.push(line.replace(/^ {2,4}/, ""));
  }
  close();
  return key;
};

const TRUE_FALSE = new Set(["true", "false", "верно", "неверно", "дұрыс", "бұрыс"]);

const typeOf = (question: PaperQuestion, keyed: string[] | null): string => {
  if (question.type) return question.type;
  if (!question.options.length) return "short_answer";
  const texts = question.options.map((option) => option.text.trim().toLowerCase());
  if (question.options.length === 2 && texts.every((text) => TRUE_FALSE.has(text))) return "true_false";
  return keyed && keyed.length > 1 ? "multiple_select" : "multiple_choice";
};

/** `ASSESSMENT-MID-1` → `MID-1`: the stem every file in the folder is named by. */
export const shortOf = (assessmentId: string): string =>
  assessmentId.startsWith("ASSESSMENT-") ? assessmentId.slice("ASSESSMENT-".length) : assessmentId;

export const itemIdFor = (assessmentId: string, variant: string | null, number: number): string =>
  `ITEM-${shortOf(assessmentId)}-${variant ? `${variant}-` : ""}${String(number).padStart(2, "0")}`;

/** Where each file of an imported exam lives, relative to the course directory. */
export const paperFiles = (assessmentId: string, variant: string | null) => {
  const stem = shortOf(assessmentId);
  return {
    paper: `assessments/${assessmentId}/${stem}-student${variant ? `-${variant}` : ""}.md`,
    key: `assessments/${assessmentId}/keys/${stem}-key.md`,
    documentId: `DOC-${stem}-PAPER${variant ? `-${variant}` : ""}-MD`,
  };
};

export interface ImportResult {
  items: Record<string, unknown>[];
  /** Per variant (`""` for one version): its total marks. */
  totals: Map<string, number>;
  /** Choice questions the key does not answer: nothing is written while any remain. */
  unkeyed: string[];
  /** Written questions with no model answer — allowed; the rubric step asks for one. */
  noModelAnswer: string[];
  problems: string[];
}

/**
 * Items from papers and a key. Pure: it writes nothing, and the caller writes
 * only when `problems` and `unkeyed` are both empty.
 */
export const importPaper = (options: {
  assessmentId: string;
  papers: Paper[];
  key: Key | null;
  now: string;
  provenance?: Record<string, unknown>;
}): ImportResult => {
  const { assessmentId, papers, key, now } = options;
  const result: ImportResult = { items: [], totals: new Map(), unkeyed: [], noModelAnswer: [], problems: [] };
  const variants = papers.map((paper) => paper.variant);
  if (papers.length > 1 && variants.some((variant) => !variant)) {
    result.problems.push("with more than one paper, every paper needs `variant:` in its front matter");
  }
  const seen = variants.filter(Boolean);
  const twice = [...new Set(seen.filter((variant, index) => seen.indexOf(variant) !== index))];
  if (twice.length) result.problems.push(`variant ${twice.join(", ")} is given by two papers`);
  if (key) {
    const sections = [...key.keys()];
    for (const section of sections) {
      if (section && !variants.includes(section)) result.problems.push(`the key has a section for variant ${section}, which no paper is`);
    }
  }

  for (const paper of papers) {
    const label = paper.variant ? ` of variant ${paper.variant}` : "";
    const answers = key?.get(paper.variant ?? "") ?? (variants.length === 1 ? key?.get("") : undefined) ?? new Map<number, string>();
    let total = 0;
    for (const question of paper.questions) {
      total += question.marks;
      const answer = answers.get(question.number)?.trim() || null;
      const choice = question.options.length > 0;
      const keyed = choice && answer ? answer.split(/[\s,;]+/).filter(Boolean).map((label_) => label_.replace(/[()]/g, "").toLowerCase()) : null;
      const type = typeOf(question, keyed);
      const id = itemIdFor(assessmentId, paper.variant, question.number);
      if (choice && !keyed) result.unkeyed.push(`question ${question.number}${label}`);
      if (!choice && !answer) result.noModelAnswer.push(`question ${question.number}${label}`);
      if (keyed) {
        const labels = new Set(question.options.map((option) => option.label));
        const unknown = keyed.filter((entry) => !labels.has(entry));
        if (unknown.length) result.problems.push(`question ${question.number}${label}: the key says ${unknown.join(", ")}, which is not an option on the paper`);
      }
      if (!choice && CHOICE_ITEM_TYPES.has(type)) {
        result.problems.push(`question ${question.number}${label} is {${type}} but the paper lists no options`);
      }
      const item: Record<string, unknown> = {
        item_id: id,
        approval: "draft",
        assessment_id: assessmentId,
        type,
        prompt: question.prompt,
        number: question.number,
        maximum_score: question.marks,
        options: question.options.map((option) => ({ label: option.label, text: option.text, correct: !!keyed?.includes(option.label) })),
        ...(!choice && answer ? { answer_key: answer } : {}),
        extensions: {
          ...(paper.variant ? { variant: paper.variant } : {}),
          provenance: { produced_by: "ainar import-paper", created_at: now, ...(options.provenance ?? {}) },
        },
      };
      if (choice && !keyed) {
        // Not validated: an unkeyed choice item is refused by the schema, and is
        // already listed in `unkeyed`, which stops the write.
        result.items.push(item);
        continue;
      }
      const parsed = AssessmentItem.safeParse(item);
      if (!parsed.success) {
        result.problems.push(`${id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
        continue;
      }
      result.items.push(item);
    }
    result.totals.set(paper.variant ?? "", total);
  }
  const totals = [...new Set(result.totals.values())];
  if (totals.length > 1) {
    result.problems.push(
      `the variants are worth different totals (${[...result.totals].map(([variant, total]) => `${variant}: ${total}`).join(", ")}) — ` +
        "a paper misread, or a question's marks missing",
    );
  }
  return result;
};

/** Read a paper or key file, refusing a path that is not there with the path in the message. */
export const readText = (path: string): string => {
  if (!existsSync(path)) throw new Error(`${path} does not exist`);
  return readFileSync(path, "utf-8");
};
