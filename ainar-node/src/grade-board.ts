/**
 * Grading a written exam question by question: what the pane's Grade view
 * draws, and the writes behind its buttons (BACKLOG E28).
 *
 * Three things, kept apart:
 *
 * * **The grouping** — `groups.yaml` beside the scans, in the private folder.
 *   Which answers to a question say the same thing is a judgement, so the
 *   assistant proposes it (`/import-assessment` §7) and the professor moves it.
 *   Each group carries a proposed score, which is the suggestion for every
 *   answer in it. Pseudonyms only, but it lives with the scans because it is a
 *   working note about them and not a record of the course.
 * * **The board** — one payload per assessment: each question with its
 *   criterion and levels, its groups, and every answer with what was read off
 *   the page, the suggestion and the decision. Computed here, drawn by the pane,
 *   printed by `ainar grade status`.
 * * **The decisions** — `decideGrades` writes `professor_decision` onto an
 *   Evaluation. It is only ever called because a person said so: from
 *   `ainar grade decide`, which the pane spawns when the professor presses.
 *   The suggestion it was made against is kept beside it as `ai_suggestion`,
 *   and an earlier decision is never overwritten — it moves onto
 *   `extensions.history`, with whether it was made one answer at a time or by
 *   an Accept all.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { CourseBundle } from "./bundle.ts";
import { criterionById, itemsOf } from "./bundle.ts";
import { COLLECTIONS } from "./loader.ts";
import { editRecords, setRecordFields } from "./record-edit.ts";
import { recordFile, writeRecords } from "./records-write.ts";
import { scanRef, scanSubmissionId, type ScanPlace } from "./scans.ts";

// --------------------------------------------------------------------------
// The grouping
// --------------------------------------------------------------------------

export interface AnswerGroupEntry {
  /** What the answers in it do, in words a second marker could apply. */
  label: string;
  /** The proposed score for every answer in the group; null until placed. */
  score: number | null;
  students: string[];
  /** The proposer was not sure where this group belongs. */
  unsure?: boolean;
  reason?: string;
}

export interface ItemGroups {
  item_id: string;
  groups: AnswerGroupEntry[];
}

export interface ProposedLevel {
  score: number;
  label?: string | null;
  description: string;
}

/** One proposed rubric for one question: its levels, and where each group sits. */
export interface ProposalItem {
  item_id: string;
  title?: string;
  levels: ProposedLevel[];
  /** One score per group of that question, in the groups' order; null = not placed. */
  scores: (number | null)[];
  /** Indexes (0-based) of the groups the proposer was unsure where to put. */
  unsure?: number[];
}

/**
 * One rubric among several the assistant proposes over the same grouping —
 * "from your marking key", "from what the class wrote", a stricter one. The
 * grouping is what the answers say; a proposal is what each is worth.
 */
export interface RubricProposal {
  id: string;
  title: string;
  /** How this one differs from the others, in a sentence or two. */
  summary?: string;
  items: ProposalItem[];
}

export interface GroupsFile {
  assessment_id: string;
  proposed_by?: string;
  model_id?: string;
  created_at?: string;
  items: ItemGroups[];
  proposals?: RubricProposal[];
  /** Which proposal each question's rubric was taken from, by item id. */
  chosen?: Record<string, string>;
}

const GROUPS_HEADER =
  "# PRIVATE — the answers to each written question, grouped by what they say,\n" +
  "# each group with the score proposed for it. Proposed by the assistant\n" +
  "# (/import-assessment §7); the professor moves groups in the pane's Grade view.\n" +
  "# A group's score is a suggestion for every answer in it, never a grade:\n" +
  "# a grade is a professor_decision on the Evaluation, written by `ainar grade decide`.\n\n";

export const groupsPath = (place: ScanPlace): string => join(place.base, "groups.yaml");

/** What a suggestion taken from a group says produced it. */
export const GROUPS_PRODUCER = "answer groups (groups.yaml)";

export const readGroups = (place: ScanPlace): GroupsFile | null => {
  const path = groupsPath(place);
  if (!existsSync(path)) return null;
  const parsed = parseYaml(readFileSync(path, "utf-8")) ?? {};
  return { assessment_id: String(parsed.assessment_id ?? ""), ...parsed, items: parsed.items ?? [] };
};

export const writeGroups = (place: ScanPlace, file: GroupsFile): void => {
  writeFileSync(groupsPath(place), GROUPS_HEADER + stringifyYaml(file, { lineWidth: 100 }), "utf-8");
};

/** What is wrong with a grouping, against the questions it groups. Empty when nothing is. */
export const checkGroups = (file: GroupsFile, items: any[]): string[] => {
  const problems: string[] = [];
  const byId = new Map(items.map((item) => [String(item.item_id), item]));
  for (const entry of file.items ?? []) {
    const item = byId.get(entry.item_id);
    if (!item) {
      problems.push(`${entry.item_id} is not a question of ${file.assessment_id}`);
      continue;
    }
    const seen = new Map<string, number>();
    (entry.groups ?? []).forEach((group, index) => {
      if (group.score != null && (typeof group.score !== "number" || group.score < 0 || group.score > Number(item.maximum_score))) {
        problems.push(`${entry.item_id} group ${index + 1}: score ${group.score} is outside 0–${item.maximum_score}`);
      }
      for (const student of group.students ?? []) {
        if (seen.has(student)) {
          problems.push(`${entry.item_id}: ${student} is in group ${seen.get(student)! + 1} and group ${index + 1}`);
        }
        seen.set(student, index);
      }
    });
  }
  const ids = new Set<string>();
  for (const proposal of file.proposals ?? []) {
    if (!/^[A-Za-z0-9][\w-]{0,30}$/.test(String(proposal.id ?? ""))) {
      problems.push(`proposal ${JSON.stringify(proposal.id)}: an id is a short word (A, B, key, class)`);
      continue;
    }
    if (ids.has(proposal.id)) problems.push(`proposal ${proposal.id} appears twice`);
    ids.add(proposal.id);
    for (const entry of proposal.items ?? []) {
      const item = byId.get(entry.item_id);
      const where = `proposal ${proposal.id} ${entry.item_id}`;
      if (!item) {
        problems.push(`${where}: not a question of ${file.assessment_id}`);
        continue;
      }
      const maximum = Number(item.maximum_score);
      const levels = (entry.levels ?? []).map((level) => Number(level.score));
      if (!levels.length) problems.push(`${where}: no levels`);
      for (const score of levels) {
        if (!(score >= 0 && score <= maximum)) problems.push(`${where}: a level of ${score} is outside 0–${maximum}`);
      }
      if (levels.length && !levels.includes(maximum)) problems.push(`${where}: no level reaches the full ${maximum}`);
      const groups = file.items.find((candidate) => candidate.item_id === entry.item_id)?.groups ?? [];
      if ((entry.scores ?? []).length !== groups.length) {
        problems.push(`${where}: ${(entry.scores ?? []).length} score(s) for ${groups.length} group(s)`);
      }
      (entry.scores ?? []).forEach((score, index) => {
        if (score !== null && !levels.includes(Number(score))) problems.push(`${where}: group ${index + 1} at ${score}, which is not one of its levels`);
      });
    }
  }
  return problems;
};

/** How many answers a proposal puts at each level of one question, and the mean it gives the answered. */
export const proposalSpread = (
  entry: ProposalItem,
  counts: number[],
): { at: Record<string, number>; placed: number; mean: number | null } => {
  const at: Record<string, number> = {};
  for (const level of entry.levels) at[String(Number(level.score))] = 0;
  let placed = 0;
  let total = 0;
  (entry.scores ?? []).forEach((score, index) => {
    if (score === null || score === undefined) return;
    const count = counts[index] ?? 0;
    at[String(Number(score))] = (at[String(Number(score))] ?? 0) + count;
    placed += count;
    total += Number(score) * count;
  });
  return { at, placed, mean: placed ? Math.round((total / placed) * 100) / 100 : null };
};

/** Set a group's proposed score — the Rubric step's "this group belongs at this level". */
export const moveGroup = (file: GroupsFile, itemId: string, group: number, score: number | null): void => {
  const entry = file.items.find((candidate) => candidate.item_id === itemId);
  const target = entry?.groups?.[group];
  if (!target) throw new Error(`${itemId} has no group ${group + 1}`);
  target.score = score;
};

/** Move one answer to another group of the same question, or out of every group (`to` null). */
export const moveAnswer = (file: GroupsFile, itemId: string, student: string, to: number | null): void => {
  const entry = file.items.find((candidate) => candidate.item_id === itemId);
  if (!entry) throw new Error(`${itemId} has no groups`);
  if (to !== null && !entry.groups[to]) throw new Error(`${itemId} has no group ${to + 1}`);
  for (const group of entry.groups) group.students = (group.students ?? []).filter((id) => id !== student);
  if (to !== null) entry.groups[to]!.students.push(student);
};

// --------------------------------------------------------------------------
// The board
// --------------------------------------------------------------------------

export type RubricState = "none" | "draft" | "accepted";

export interface ItemMarks {
  at: Record<string, { decided: number; suggested: number }>;
  mean: number | null;
  counted: number;
}

/** What taking a proposal would do to a question as it stands. */
export interface ProposalEffect {
  /** Undecided answers whose suggestion would change. */
  changes: number;
  /** Decided marks the proposal would suggest differently — kept, but worth a look. */
  disagree: number;
  /** Per group, the score now and under the proposal, where they differ. */
  moves: { group: number; from: number | null; to: number | null; count: number }[];
}

/**
 * Against the board's answers (which carry their group, suggestion and
 * decision), what a proposal for that question would change.
 */
export const proposalEffect = (
  entry: ProposalItem,
  answers: { group: number | null; blank: boolean; unread: boolean; suggestion: { score: number } | null; decision: { score: number } | null }[],
): ProposalEffect => {
  let changes = 0;
  let disagree = 0;
  const moves = new Map<number, { group: number; from: number | null; to: number | null; count: number }>();
  for (const answer of answers) {
    if (answer.group === null || answer.blank || answer.unread) continue;
    const next = entry.scores?.[answer.group] ?? null;
    const now = answer.suggestion?.score ?? null;
    if (answer.decision) {
      if (next !== null && answer.decision.score !== next) disagree += 1;
    } else if (now !== next) {
      changes += 1;
    }
    if (now !== next) {
      const move = moves.get(answer.group) ?? { group: answer.group, from: now, to: next, count: 0 };
      move.count += 1;
      moves.set(answer.group, move);
    }
  }
  return { changes, disagree, moves: [...moves.values()].sort((a, b) => a.group - b.group) };
};

export interface Suggestion {
  score: number;
  comment: string | null;
  /** `grader` — an Evaluation's ai_suggestion; `group` — its group's score; `blank` — nothing written. */
  source: "grader" | "group" | "blank";
  confidence: number | null;
}

export interface BoardAnswer {
  student: string;
  submission_id: string;
  text: string;
  /** No answer recorded and nothing read off the page yet. */
  unread: boolean;
  blank: boolean;
  confidence: string | null;
  note: string | null;
  page: number | null;
  group: number | null;
  suggestion: Suggestion | null;
  decision: { score: number; comment: string | null; decided_at: string | null } | null;
  status: string | null;
  /** How many earlier decisions this one replaced. */
  history: number;
  /** What the rubric suggests for this answer now — its group's score — which a decided mark may no longer match. */
  now: number | null;
}

export interface BoardItem {
  item_id: string;
  number: number | null;
  prompt: string;
  maximum_score: number;
  marking_guidance: string | null;
  criterion: { criterion_id: string; title: string; maximum_score: number; levels: { score: number; label: string | null; description: string }[] } | null;
  groups: (AnswerGroupEntry & { index: number; count: number })[];
  /** Every rubric proposed for this question, with where it puts the class. */
  proposals: {
    id: string;
    title: string;
    summary: string | null;
    levels: ProposedLevel[];
    scores: (number | null)[];
    unsure: number[];
    spread: { at: Record<string, number>; placed: number; mean: number | null };
    effect: ProposalEffect;
  }[];
  /** The proposal the current rubric for this question was taken from. */
  chosen: string | null;
  /** Each answer's decided mark, or its suggestion until then, counted per mark. */
  marks: ItemMarks;
  answers: BoardAnswer[];
  counts: { answers: number; unread: number; blank: number; ungrouped: number; suggested: number; decided: number; changed: number };
}

export interface Board {
  run: string;
  assessment: { id: string; title: string; maximum_score: number; approval: string | null };
  rubric: RubricState;
  /** Who a press in the pane decides as: the run's first instructor. */
  decided_by: string | null;
  grouped: boolean;
  group_problems: string[];
  /** The rubrics proposed over the grouping, for the comparison. */
  proposals: { id: string; title: string; summary: string | null }[];
  items: BoardItem[];
  totals: { answers: number; decided: number; changed: number; papers: number };
}

const CONFIDENCE_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

const readTranscript = (place: ScanPlace, student: string): Map<string, any> => {
  const path = join(place.base, student, "transcript.yaml");
  const found = new Map<string, any>();
  if (!existsSync(path)) return found;
  try {
    const transcript = parseYaml(readFileSync(path, "utf-8")) ?? {};
    for (const answer of transcript.answers ?? []) if (answer?.item) found.set(String(answer.item), answer);
  } catch {
    // An unreadable transcript costs the card its confidence and note, not the board.
  }
  return found;
};

/** Whether the questions of an assessment have a rubric, and whether it is accepted. */
export const rubricState = (assessment: any, items: any[], criteria: Map<string, any>): RubricState => {
  const written = items.filter((item) => !(item.options ?? []).length);
  if (!written.length || written.some((item) => !item.criterion_id || !criteria.has(item.criterion_id))) return "none";
  return assessment.approval === "draft" ? "draft" : "accepted";
};

/**
 * Everything the Grade view draws for one assessment.
 *
 * `bundle` is the course with drafts included: the answers read off paper are
 * `approval: draft`, and the professor grading them is exactly the person who
 * should see them.
 */
export const gradeBoard = (options: {
  bundle: CourseBundle;
  runId: string;
  assessmentId: string;
  place: ScanPlace;
}): Board => {
  const { bundle, runId, assessmentId, place } = options;
  const assessment = (bundle.assessments as any[]).find(
    (entry) => entry.assessment_id === assessmentId && entry.course_version_id === runId,
  );
  if (!assessment) throw new Error(`${runId} has no assessment ${assessmentId}`);
  const run = (bundle.versions as any[]).find((entry) => entry.course_version_id === runId);
  const items = itemsOf(bundle, assessmentId).filter((item) => !(item.options ?? []).length);
  const criteria = criterionById(bundle);
  const groups = readGroups(place);
  const submissions = (bundle.submissions as any[]).filter((entry) => entry.assessment_id === assessmentId);
  const transcripts = new Map(submissions.map((entry) => [String(entry.student_id), readTranscript(place, String(entry.student_id))]));
  const responses = new Map(
    (bundle.item_responses as any[])
      .filter((entry) => submissions.some((submission) => submission.submission_id === entry.submission_id))
      .map((entry) => [`${entry.student_id}|${entry.item_id}`, entry]),
  );
  const evaluations = new Map(
    (bundle.evaluations as any[]).map((entry) => [`${entry.submission_id}|${entry.criterion_id}`, entry]),
  );

  const boardItems: BoardItem[] = items.map((item) => {
    const criterion = item.criterion_id ? criteria.get(item.criterion_id) ?? null : null;
    const itemGroups = groups?.items.find((entry) => entry.item_id === item.item_id)?.groups ?? [];
    const groupOf = new Map<string, number>();
    itemGroups.forEach((group, index) => (group.students ?? []).forEach((student) => groupOf.set(student, index)));

    const answers: BoardAnswer[] = submissions.map((submission) => {
      const student = String(submission.student_id);
      const response = responses.get(`${student}|${item.item_id}`);
      const read = transcripts.get(student)?.get(item.item_id);
      const text = String(response?.raw_response ?? read?.text ?? "");
      // Not read yet is not blank: a paper nobody has transcribed would
      // otherwise be suggested a zero for every question.
      const unread = !response && !read?.blank && !String(read?.text ?? "").trim();
      const blank = !unread && (Boolean(read?.blank || response?.extensions?.scan?.blank) || !text.trim());
      const evaluation = criterion ? evaluations.get(`${submission.submission_id}|${criterion.criterion_id}`) : undefined;
      const group = groupOf.has(student) ? groupOf.get(student)! : null;
      const placed = group === null ? null : itemGroups[group]!;
      // A suggestion kept on the evaluation is a grader's own, unless it is
      // the group's, written there when the professor decided against it.
      const stored = evaluation?.ai_suggestion;
      const fromGroups = String(stored?.provenance?.produced_by ?? "").startsWith(GROUPS_PRODUCER);
      const suggestion: Suggestion | null = stored
        ? {
            score: Number(stored.score),
            comment: stored.comment ?? null,
            source: fromGroups ? "group" : "grader",
            confidence: stored.confidence ?? null,
          }
        : placed && placed.score != null
          ? { score: Number(placed.score), comment: placed.label, source: "group", confidence: placed.unsure ? 0.5 : null }
          : blank
            ? { score: 0, comment: "nothing written", source: "blank", confidence: null }
            : null;
      const decided = evaluation && ["approved", "overridden"].includes(evaluation.status) ? evaluation.professor_decision : null;
      return {
        student,
        submission_id: String(submission.submission_id),
        text,
        unread,
        blank,
        confidence: read?.confidence ?? response?.extensions?.scan?.confidence ?? null,
        note: read?.note ?? null,
        page: read?.page ?? null,
        group,
        suggestion,
        decision: decided
          ? { score: Number(decided.score), comment: decided.comment ?? null, decided_at: decided.decided_at ?? null }
          : null,
        status: evaluation?.status ?? null,
        history: Array.isArray(evaluation?.extensions?.history) ? evaluation.extensions.history.length : 0,
        now: placed && placed.score != null ? Number(placed.score) : blank ? 0 : null,
      };
    });

    // Groups first in their order, ungrouped next, then blanks, unread last; low-confidence
    // readings first inside each, because those are the ones worth reading.
    const rank = (answer: BoardAnswer) => (answer.unread ? 1e7 : answer.blank ? 1e6 : answer.group === null ? 1e5 : answer.group);
    answers.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (CONFIDENCE_ORDER[a.confidence ?? "high"] ?? 2) - (CONFIDENCE_ORDER[b.confidence ?? "high"] ?? 2) ||
        a.student.localeCompare(b.student),
    );

    const groupCounts = itemGroups.map(
      (_group, index) => answers.filter((answer) => answer.group === index && !answer.blank && !answer.unread).length,
    );
    const proposals = (groups?.proposals ?? []).flatMap((proposal) => {
      const entry = (proposal.items ?? []).find((candidate) => candidate.item_id === item.item_id);
      if (!entry) return [];
      return [
        {
          id: String(proposal.id),
          title: String(proposal.title ?? proposal.id),
          summary: proposal.summary ?? null,
          levels: [...(entry.levels ?? [])]
            .map((level) => ({ score: Number(level.score), label: level.label ?? null, description: String(level.description ?? "") }))
            .sort((a, b) => b.score - a.score),
          scores: (entry.scores ?? []).map((score) => (score === null || score === undefined ? null : Number(score))),
          unsure: entry.unsure ?? [],
          spread: proposalSpread(entry, groupCounts),
          effect: proposalEffect(entry, answers),
        },
      ];
    });

    // Where the class stands on this question now: each answer's decided
    // mark, or its suggestion until there is one.
    const marks: ItemMarks = { at: {}, mean: null, counted: 0 };
    let total = 0;
    for (const answer of answers) {
      const decided = answer.decision?.score;
      const score = decided ?? answer.suggestion?.score;
      if (score === undefined || score === null) continue;
      const slot = (marks.at[String(score)] ??= { decided: 0, suggested: 0 });
      if (decided !== undefined) slot.decided += 1;
      else slot.suggested += 1;
      marks.counted += 1;
      total += score;
    }
    marks.mean = marks.counted ? Math.round((total / marks.counted) * 100) / 100 : null;

    return {
      item_id: String(item.item_id),
      number: item.number ?? null,
      prompt: String(item.prompt ?? ""),
      maximum_score: Number(item.maximum_score ?? 1),
      marking_guidance: item.marking_guidance ?? null,
      criterion: criterion
        ? {
            criterion_id: criterion.criterion_id,
            title: criterion.title,
            maximum_score: Number(criterion.maximum_score),
            levels: [...(criterion.levels ?? [])]
              .map((level: any) => ({ score: Number(level.score), label: level.label ?? null, description: String(level.description) }))
              .sort((a, b) => b.score - a.score),
          }
        : null,
      groups: itemGroups.map((group, index) => ({ ...group, index, count: groupCounts[index]! })),
      proposals,
      chosen: groups?.chosen?.[item.item_id] ?? null,
      marks,
      answers,
      counts: {
        answers: answers.length,
        unread: answers.filter((answer) => answer.unread).length,
        blank: answers.filter((answer) => answer.blank).length,
        ungrouped: answers.filter((answer) => !answer.blank && !answer.unread && answer.group === null).length,
        suggested: answers.filter((answer) => answer.suggestion).length,
        decided: answers.filter((answer) => answer.decision).length,
        changed: answers.filter((answer) => answer.decision && answer.suggestion && answer.decision.score !== answer.suggestion.score).length,
      },
    };
  });

  return {
    run: runId,
    assessment: {
      id: assessmentId,
      title: String(assessment.title),
      maximum_score: Number(assessment.maximum_score),
      approval: assessment.approval ?? null,
    },
    rubric: rubricState(assessment, items, criteria),
    decided_by: (run?.instructors ?? [])[0] ?? null,
    grouped: Boolean(groups),
    proposals: (groups?.proposals ?? []).map((proposal) => ({ id: String(proposal.id), title: String(proposal.title ?? proposal.id), summary: proposal.summary ?? null })),
    group_problems: groups ? checkGroups(groups, items) : [],
    items: boardItems,
    totals: {
      answers: boardItems.reduce((sum, item) => sum + item.counts.answers, 0),
      decided: boardItems.reduce((sum, item) => sum + item.counts.decided, 0),
      changed: boardItems.reduce((sum, item) => sum + item.counts.changed, 0),
      papers: submissions.length,
    },
  };
};

// --------------------------------------------------------------------------
// Decisions
// --------------------------------------------------------------------------

const short = (id: string, prefix: string): string => (id.startsWith(prefix) ? id.slice(prefix.length) : id);

/** `EVAL-4F2A7Q-Q1-01` — one student's mark on one criterion. */
export const evaluationId = (studentId: string, criterionId: string): string =>
  `EVAL-${short(studentId, "STUDENT-")}-${short(criterionId, "CRIT-")}`;

export interface Decision {
  student: string;
  item: string;
  score: number;
  comment?: string | null;
}

export type DecidedVia = "one" | "group" | "all";

export interface DecideResult {
  evaluations: any[];
  written: number;
  unchanged: number;
  replaced: number;
}

/**
 * The professor's marks, as Evaluations ready for `writeRecords`.
 *
 * Refuses the whole list before returning anything: a question with no
 * accepted criterion, a score outside it, a student with no paper. `via` says
 * how the press was made — one card, a group's Accept, or Accept all — and is
 * kept with the decision so that bulk acceptance can be told apart later.
 */
export const decideGrades = (options: {
  board: Board;
  bundle: CourseBundle;
  decisions: Decision[];
  by: string;
  at: string;
  via: DecidedVia;
}): DecideResult => {
  const { board, bundle, decisions, by, at, via } = options;
  if (!/^USER-[A-Z0-9][A-Z0-9-]*$/.test(by)) {
    throw new Error(`a decision says who made it: ${by || "nobody"} is not a USER- id (the run lists no instructor?)`);
  }
  if (board.rubric !== "accepted") {
    throw new Error(
      board.rubric === "draft"
        ? `the rubric of ${board.assessment.id} is still a draft — accept it first (\`ainar grade accept-rubric\`)`
        : `${board.assessment.id} has no rubric — propose one, or grade by points only (\`ainar grade points-only\`)`,
    );
  }
  const items = new Map(board.items.map((item) => [item.item_id, item]));
  const shared = new Map<string, number>();
  for (const item of board.items) if (item.criterion) shared.set(item.criterion.criterion_id, (shared.get(item.criterion.criterion_id) ?? 0) + 1);
  const existing = new Map((bundle.evaluations as any[]).map((entry) => [String(entry.evaluation_id), entry]));

  const written: any[] = [];
  let unchanged = 0;
  let replaced = 0;
  const seen = new Set<string>();
  for (const decision of decisions) {
    const item = items.get(decision.item);
    if (!item) throw new Error(`${decision.item} is not a written question of ${board.assessment.id}`);
    const criterion = item.criterion!;
    if ((shared.get(criterion.criterion_id) ?? 0) > 1) {
      throw new Error(`${criterion.criterion_id} marks more than one question, so a mark per question cannot be written to it`);
    }
    const answer = item.answers.find((entry) => entry.student === decision.student);
    if (!answer) throw new Error(`${decision.student} has no paper for ${board.assessment.id}`);
    const score = Number(decision.score);
    if (!Number.isFinite(score) || score < 0 || score > criterion.maximum_score) {
      throw new Error(`${decision.student} ${decision.item}: ${decision.score} is outside 0–${criterion.maximum_score}`);
    }
    const id = evaluationId(answer.student, criterion.criterion_id);
    if (seen.has(id)) throw new Error(`${decision.student} ${decision.item} is decided twice in one list`);
    seen.add(id);

    const comment = decision.comment?.trim() || null;
    const before = existing.get(id);
    const previous = before && ["approved", "overridden"].includes(before.status) ? before.professor_decision : null;
    if (previous && Number(previous.score) === score && (previous.comment ?? null) === comment) {
      unchanged += 1;
      continue;
    }

    const extensions: Record<string, unknown> = { ...(before?.extensions ?? {}) };
    if (previous) {
      extensions.history = [
        ...(Array.isArray(extensions.history) ? extensions.history : []),
        {
          score: previous.score,
          comment: previous.comment ?? null,
          decided_by: previous.decided_by ?? null,
          decided_at: previous.decided_at ?? null,
          via: (before?.extensions?.decided_via as string | undefined) ?? null,
        },
      ];
      replaced += 1;
    }
    extensions.decided_via = via;

    // The suggestion the professor was looking at, kept beside the decision.
    // A grader's own stays as it was; a group's becomes the record of what was
    // proposed, so agreement with it can be measured (GRD-1).
    let suggestion = before?.ai_suggestion ?? null;
    if (!suggestion && answer.suggestion?.source === "group") {
      suggestion = {
        score: answer.suggestion.score,
        ...(answer.suggestion.confidence != null ? { confidence: answer.suggestion.confidence } : {}),
        comment: answer.suggestion.comment,
        evidence: [
          {
            source_ref: scanRef(board.run, board.assessment.id, answer.student),
            location: `${answer.page ? `p.${answer.page}, ` : ""}question ${item.number ?? item.item_id}`,
          },
        ],
        provenance: { produced_by: GROUPS_PRODUCER, input_refs: [item.item_id] },
      };
    }

    written.push({
      evaluation_id: id,
      submission_id: answer.submission_id,
      criterion_id: criterion.criterion_id,
      ...(suggestion ? { ai_suggestion: suggestion } : {}),
      professor_decision: { score, ...(comment ? { comment } : {}), decided_by: by, decided_at: at },
      status: suggestion && Number(suggestion.score) !== score ? "overridden" : "approved",
      extensions,
    });
  }
  return { evaluations: written, written: written.length, unchanged, replaced };
};

// --------------------------------------------------------------------------
// The rubric
// --------------------------------------------------------------------------

/**
 * Accept the rubric: the assessment's `approval: draft` becomes `approved`.
 *
 * A text edit of one line, so every comment in the professor's file stays.
 * Refused when there is nothing to accept — no criterion on a written question —
 * and a no-op when the assessment is already accepted.
 */
export const acceptRubric = (options: { root: string; bundle: CourseBundle; board: Board }): boolean => {
  const { root, bundle, board } = options;
  if (board.rubric === "none") throw new Error(`${board.assessment.id} has no rubric on every written question yet`);
  if (board.rubric === "accepted") return false;
  setRecordFields({
    root,
    courseId: String((bundle.course as any).course_id),
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
    edits: new Map([[board.assessment.id, { approval: "approved" }]]),
  });
  return true;
};

/** The rubric already on an assessment, as written in its file when it can be read raw. */
const rawAssessment = (courseDir: string, assessmentId: string): any | null => {
  const own = join(courseDir, recordFile("assessments", { assessment_id: assessmentId }));
  if (!existsSync(own)) return null;
  return ((parseYaml(readFileSync(own, "utf-8")) ?? {}).assessments ?? []).find((entry: any) => entry?.assessment_id === assessmentId) ?? null;
};

/**
 * Write an inline rubric onto an assessment, and each question's criterion.
 *
 * An assessment in its own folder was written by ainar's emitter, so it is
 * written back by the same one and the diff is the rubric alone. Anywhere else
 * it is a hand-authored file, edited through the document API. `approval` is
 * set when given: a rubric the professor chose to change is a proposal again.
 */
const writeRubric = (options: {
  root: string;
  bundle: CourseBundle;
  assessmentId: string;
  rubric: any;
  approval?: "draft" | "approved";
  criterionOf: Map<string, string>;
}): string[] => {
  const { root, bundle, assessmentId, rubric, approval, criterionOf } = options;
  const courseId = String((bundle.course as any).course_id);
  const courseDir = join(root, "courses", courseId);
  const touched = new Set<string>();
  const raw = rawAssessment(courseDir, assessmentId);
  if (raw) {
    const record = { ...raw, ...(approval ? { approval } : {}), rubric_id: rubric.rubric_id, rubric };
    writeRecords(courseDir, { assessments: [record] }).forEach((path) => touched.add(path));
  } else {
    editRecords({
      root,
      courseId,
      patterns: COLLECTIONS.assessments,
      idField: "assessment_id",
      collection: "assessments",
      edits: new Map([
        [
          assessmentId,
          (node: any) => {
            if (approval) node.set("approval", approval);
            node.set("rubric_id", rubric.rubric_id);
            node.set("rubric", rubric);
          },
        ],
      ]),
    }).written.forEach((path) => touched.add(path));
  }
  const items = new Map((bundle.items as any[]).map((item) => [String(item.item_id), item]));
  const missing = [...criterionOf].filter(([itemId, criterionId]) => items.get(itemId)?.criterion_id !== criterionId);
  if (missing.length) {
    setRecordFields({
      root,
      courseId,
      patterns: COLLECTIONS.items,
      idField: "item_id",
      collection: "items",
      edits: new Map(missing.map(([itemId, criterionId]) => [itemId, { criterion_id: criterionId }])),
    }).written.forEach((path) => touched.add(path));
  }
  return [...touched];
};

/** The criterion a question is marked on: the one it names, or one named after it. */
const criterionIdFor = (item: any): string => item.criterion_id ?? `CRIT-${short(String(item.item_id), "ITEM-")}`;

const criterionFor = (item: any, rubricId: string, levels: ProposedLevel[], title?: string) => ({
  criterion_id: criterionIdFor(item),
  rubric_id: rubricId,
  title: title || `Question ${item.number ?? item.item_id}`,
  maximum_score: Number(item.maximum_score),
  // The question's own outcome, so its marks are evidence for it.
  ...(item.outcome_id ? { outcome_id: item.outcome_id } : {}),
  ...((item.concepts ?? []).length ? { concepts: [...item.concepts] } : {}),
  levels: levels.map((level) => ({ score: Number(level.score), ...(level.label ? { label: level.label } : {}), description: level.description })),
});

/**
 * Grade without a written rubric: one criterion per question, worth its marks,
 * with no levels. The professor chose this, so it is written accepted.
 *
 * Only for an assessment with no rubric at all — one that has some is a
 * rubric to finish, not to replace.
 */
export const pointsOnlyRubric = (options: { root: string; bundle: CourseBundle; board: Board; items: any[] }): string[] => {
  const { root, bundle, board, items } = options;
  const assessment = (bundle.assessments as any[]).find((entry) => entry.assessment_id === board.assessment.id);
  if (assessment.rubric || assessment.rubric_id) {
    throw new Error(`${board.assessment.id} already has a rubric — finish that one rather than replacing it`);
  }
  const written = items.filter((item) => !(item.options ?? []).length);
  if (!written.length) throw new Error(`${board.assessment.id} has no written questions to mark`);
  const rubricId = `RUBRIC-${short(board.assessment.id, "ASSESSMENT-")}`;
  return writeRubric({
    root,
    bundle,
    assessmentId: board.assessment.id,
    rubric: {
      rubric_id: rubricId,
      title: `${board.assessment.title}, by points`,
      description: "One criterion per question, worth its marks; chosen in the pane instead of a written rubric.",
      criteria: written.map((item) => criterionFor(item, rubricId, [])),
    },
    criterionOf: new Map(written.map((item) => [String(item.item_id), criterionIdFor(item)])),
  });
};

/**
 * Take one of the proposed rubrics, for some questions or all of them.
 *
 * The chosen proposal's levels become those questions' criteria in the
 * assessment's rubric — other questions keep theirs, so Q1 can come from the
 * marking key and Q4 from what the class wrote — and its placement becomes
 * each group's score. The assessment goes to `approval: draft`: choosing is
 * picking what to review, and Accept rubric is still its own press.
 *
 * Refused for a question that already has marks decided against its current
 * rubric: those are grades to reconsider, not a rubric to swap under them.
 */
export const chooseProposal = (options: {
  root: string;
  bundle: CourseBundle;
  board: Board;
  groups: GroupsFile;
  proposalId: string;
  itemIds?: string[];
  /** Saves the grouping. Called before the course is written, so a run cut short leaves no rubric without its placement. */
  saveGroups?: (groups: GroupsFile) => void;
  /**
   * Revise a rubric that already has marks against it. The marks stay — they
   * are the professor's — and the board shows each one the new rubric would
   * suggest differently.
   */
  keepMarks?: boolean;
  /** The professor chose and accepted in one press: write it approved, not draft. */
  accept?: boolean;
}): { written: string[]; items: string[] } => {
  const { root, bundle, board, groups, proposalId } = options;
  const proposal = (groups.proposals ?? []).find((entry) => entry.id === proposalId);
  if (!proposal) throw new Error(`no proposal ${proposalId} — the proposals are ${(groups.proposals ?? []).map((entry) => entry.id).join(", ") || "none"}`);
  const wanted = options.itemIds?.length ? options.itemIds : proposal.items.map((entry) => entry.item_id);
  const entries = wanted.map((itemId) => {
    const entry = proposal.items.find((candidate) => candidate.item_id === itemId);
    if (!entry) throw new Error(`proposal ${proposalId} has nothing for ${itemId}`);
    const onBoard = board.items.find((candidate) => candidate.item_id === itemId);
    if (!onBoard) throw new Error(`${itemId} is not a written question of ${board.assessment.id}`);
    if (onBoard.counts.decided && !options.keepMarks) {
      throw new Error(
        `${itemId} already has ${onBoard.counts.decided} mark(s) decided against its rubric — ` +
          "pass --keep-marks to keep them and see which now disagree",
      );
    }
    return entry;
  });
  const items = new Map((bundle.items as any[]).map((item) => [String(item.item_id), item]));
  const assessment = (bundle.assessments as any[]).find((entry) => entry.assessment_id === board.assessment.id);
  const courseDir = join(root, "courses", String((bundle.course as any).course_id));
  const current = rawAssessment(courseDir, board.assessment.id)?.rubric ?? assessment.rubric ?? null;
  const rubricId = current?.rubric_id ?? assessment.rubric_id ?? `RUBRIC-${short(board.assessment.id, "ASSESSMENT-")}`;
  const criteria: any[] = [...(current?.criteria ?? [])];
  for (const entry of entries) {
    const criterion = criterionFor(items.get(entry.item_id), rubricId, entry.levels, entry.title);
    const at = criteria.findIndex((existing) => existing.criterion_id === criterion.criterion_id);
    if (at >= 0) criteria[at] = criterion;
    else criteria.push(criterion);
  }
  const order = new Map(board.items.map((item, index) => [criterionIdFor(items.get(item.item_id)), index]));
  criteria.sort((a, b) => (order.get(a.criterion_id) ?? 1e9) - (order.get(b.criterion_id) ?? 1e9));
  // The placement first, then the course: a rubric in the record whose groups
  // are unscored is a question graded with no suggestions, and that is what an
  // interrupted run in the other order left behind (Quiz 1, 2026-10-02).
  for (const entry of entries) {
    const itemGroups = groups.items.find((candidate) => candidate.item_id === entry.item_id)?.groups ?? [];
    itemGroups.forEach((group, index) => {
      const score = entry.scores?.[index];
      group.score = score === undefined ? null : score;
      group.unsure = (entry.unsure ?? []).includes(index) || undefined;
    });
  }
  groups.chosen = { ...(groups.chosen ?? {}), ...Object.fromEntries(entries.map((entry) => [entry.item_id, proposalId])) };
  options.saveGroups?.(groups);
  const written = writeRubric({
    root,
    bundle,
    assessmentId: board.assessment.id,
    rubric: {
      ...(current ?? {}),
      rubric_id: rubricId,
      title: current?.title ?? board.assessment.title,
      criteria,
    },
    approval: options.accept ? "approved" : "draft",
    criterionOf: new Map(entries.map((entry) => [entry.item_id, criterionIdFor(items.get(entry.item_id))])),
  });
  return { written, items: entries.map((entry) => entry.item_id) };
};