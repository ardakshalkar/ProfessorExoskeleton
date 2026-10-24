/**
 * Pairs of students whose answers on the same exam agree more than the rest
 * of the class's do: `ainar shared-answers` (BACKLOG E38, STN-10).
 *
 * Agreement is weighted by how unusual it is. Two right answers in common say
 * little — the class mostly gives them — and a rare wrong one in common says a
 * great deal. So:
 *
 * - A choice item counts when both chose the same thing, by `log(N / chose)`
 *   as two phrases: in full when it is wrong, a tenth of that when it is
 *   right, half when no key says which.
 * - A written answer counts by the wording two students share and few others
 *   wrote: each 4-word phrase both used, weighted `log(N / used)`, among those
 *   no more than a few of the class used. Phrases from the question, the key
 *   and the marking guidance never count — everyone may copy those honestly.
 *   Where both answers are known to have lost marks, the weight doubles.
 *
 * Phrases that are mostly numbers and single letters never count: two correct
 * workings of one calculation look alike for an honest reason.
 *
 * A pair is *unusual* on an exam when its total is a far outlier among the
 * pairs who share anything on it (above the third quartile by three
 * interquartile ranges), and at least as much as one shared run of ten words
 * nobody else wrote. A pair unusual on two or more exams *recurs*. Wording
 * from the slides or a handout both learned by heart looks the same; the pair
 * is where to look, not what happened.
 *
 * Responses are read whatever their `approval`: an answer read off the page
 * is what the student wrote, and a draft only marks its score as unaccepted.
 * Homework is left out — handed-in forks are ITG-1's. Nothing is written: the
 * pair is evidence beside the two papers for the professor, never a case.
 */

import { assessmentsOf, itemsOf, type CourseBundle } from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";
import { settingOf, type SettingName } from "./standing.ts";

export const SHARED_ANSWERS_VERSION = "shared-answers/2026.10.1";
/** Words per phrase. */
export const PHRASE = 4;
/** Fewer students answering an item than this, and nothing on it is unusual. */
export const MIN_ANSWERED = 5;
/** Tukey's far-out fence: Q3 + 3 × IQR. */
const FENCE = 3;
/** The least a pair must share to be unusual: a run this many words long that nobody else wrote. */
export const FLOOR_RUN = 10;
/**
 * A chosen option is a whole answer, where a phrase is a fragment of one, so
 * it weighs two phrases: four rare wrong choices in common reach the floor
 * that a ten-word run does, and three do not.
 */
const CHOICE_WEIGHT = 2;

const CHOICE = new Set(["multiple_choice", "multiple_select", "true_false"]);

const words = (text: string | null | undefined): string[] =>
  (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);

const phrases = (tokens: readonly string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i + PHRASE <= tokens.length; i += 1) out.push(tokens.slice(i, i + PHRASE).join(" "));
  return out;
};

/**
 * A phrase that is mostly numbers and single letters — `2 2 0 2`, `q b 0` —
 * is what two students working the same calculation correctly both write.
 * It is not wording, and never counts.
 */
const wording = (phrase: string): boolean =>
  phrase.split(" ").filter((word) => word.length > 1 && !/^\p{N}+$/u.test(word)).length > PHRASE / 2;

/** At most this many of the class may share a phrase for it to count: 5%, and never fewer than two. */
const rareUpTo = (answered: number): number => Math.max(2, Math.floor(answered * 0.05));

export interface SharedItem {
  item_id: string;
  kind: "choice" | "written";
  weight: number;
  /** The shared choice, or the shared runs of rare wording. */
  shared: string[];
  /** Both answers are known to have lost marks on it. */
  both_wrong: boolean;
}

export interface Pair {
  students: [string, string];
  score: number;
  /** Items both answered, and the ones that counted. */
  common: number;
  items: SharedItem[];
}

export interface ExamPairs {
  assessment_id: string;
  title: string;
  setting: SettingName | null;
  answered: number;
  /** Pairs who answered at least one item in common. */
  pairs_compared: number;
  /** The score at which a pair is unusual on this exam. */
  fence: number;
  unusual: Pair[];
}

export interface SharedAnswers {
  version: string;
  course_version_id: string;
  exams: ExamPairs[];
  /** Pairs unusual on two or more exams. */
  recurring: { students: [string, string]; exams: string[] }[];
  notes: string[];
}

const quantile = (sorted: readonly number[], q: number): number => {
  if (!sorted.length) return 0;
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
};

/** Was this answer marked down? `null` when nothing says. */
const lostMarks = (response: any, item: any): boolean | null => {
  if (response.correct === true || response.correct === false) return !response.correct;
  if (typeof response.score === "number" && item.maximum_score > 0) return response.score < item.maximum_score;
  return null;
};

/**
 * The runs of `tokens` covered by phrases in `shared`, as text: a shared run of
 * seven words is one excerpt, not four overlapping phrases.
 */
const runs = (tokens: readonly string[], shared: ReadonlySet<string>): string[] => {
  const covered = new Array(tokens.length).fill(false);
  phrases(tokens).forEach((phrase, i) => {
    if (shared.has(phrase)) for (let j = i; j < i + PHRASE; j += 1) covered[j] = true;
  });
  const out: string[] = [];
  let current: string[] = [];
  covered.forEach((on, i) => {
    if (on) current.push(tokens[i]!);
    else if (current.length) {
      out.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) out.push(current.join(" "));
  return out;
};

const pairKey = (a: string, c: string): string => (a < c ? `${a}|${c}` : `${c}|${a}`);

const examPairs = (b: CourseBundle, assessment: any): ExamPairs | null => {
  const items = new Map(itemsOf(b, assessment.assessment_id).map((item: any) => [item.item_id, item]));
  const submissions = new Map(
    (b.submissions as any[]).filter((s) => s.assessment_id === assessment.assessment_id).map((s) => [s.submission_id, s]),
  );
  /** item → student → response; the latest attempt's when there are two. */
  const byItem = new Map<string, Map<string, any>>();
  for (const response of b.item_responses as any[]) {
    const submission = submissions.get(response.submission_id);
    if (!submission || !items.has(response.item_id)) continue;
    const answered = response.chosen_options?.length || words(response.raw_response).length;
    if (!answered) continue;
    const students = byItem.get(response.item_id) ?? new Map();
    const held = students.get(response.student_id);
    if (!held || (submissions.get(held.submission_id)?.attempt ?? 1) <= (submission.attempt ?? 1)) {
      students.set(response.student_id, response);
    }
    byItem.set(response.item_id, students);
  }
  if (!byItem.size) return null;

  const scores = new Map<string, Pair>();
  const commonCount = new Map<string, number>();
  const everyone = new Set<string>();
  const add = (a: string, c: string, shared: SharedItem) => {
    const key = pairKey(a, c);
    const pair = scores.get(key) ?? { students: (a < c ? [a, c] : [c, a]) as [string, string], score: 0, common: 0, items: [] };
    pair.score += shared.weight;
    pair.items.push(shared);
    scores.set(key, pair);
  };

  for (const [itemId, students] of byItem) {
    const item = items.get(itemId);
    const ids = [...students.keys()].sort();
    for (const id of ids) everyone.add(id);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = pairKey(ids[i]!, ids[j]!);
        commonCount.set(key, (commonCount.get(key) ?? 0) + 1);
      }
    }
    const answered = ids.length;
    if (answered < MIN_ANSWERED) continue;

    const choices = item.options?.length > 0 || CHOICE.has(item.type);
    if (choices) {
      const key = new Set((item.options ?? []).filter((o: any) => o.correct).map((o: any) => o.label));
      const chose = new Map<string, string[]>();
      for (const id of ids) {
        const picked = [...(students.get(id).chosen_options ?? [])].sort().join(",");
        if (!picked) continue;
        chose.set(picked, [...(chose.get(picked) ?? []), id]);
      }
      for (const [picked, who] of chose) {
        if (who.length < 2) continue;
        const right = key.size ? picked === [...key].sort().join(",") : null;
        const weight = Math.log(answered / who.length) * CHOICE_WEIGHT * (right === true ? 0.1 : right === null ? 0.5 : 1);
        if (weight <= 0) continue;
        for (let i = 0; i < who.length; i += 1) {
          for (let j = i + 1; j < who.length; j += 1) {
            add(who[i]!, who[j]!, { item_id: itemId, kind: "choice", weight, shared: [picked], both_wrong: right === false });
          }
        }
      }
      continue;
    }

    // Written: phrases from the paper itself are anyone's to repeat.
    const given = new Set(
      phrases(words([item.prompt, item.answer_key, item.marking_guidance, ...(item.options ?? []).map((o: any) => o.text)].join(" "))),
    );
    const tokens = new Map<string, string[]>();
    const used = new Map<string, Set<string>>();
    for (const id of ids) {
      const mine = words(students.get(id).raw_response);
      tokens.set(id, mine);
      for (const phrase of new Set(phrases(mine))) {
        if (given.has(phrase) || !wording(phrase)) continue;
        used.set(phrase, (used.get(phrase) ?? new Set()).add(id));
      }
    }
    const limit = rareUpTo(answered);
    /** pair → the rare phrases both used on this item. */
    const between = new Map<string, Set<string>>();
    for (const [phrase, who] of used) {
      if (who.size < 2 || who.size > limit) continue;
      const list = [...who].sort();
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const key = pairKey(list[i]!, list[j]!);
          between.set(key, (between.get(key) ?? new Set<string>()).add(phrase));
        }
      }
    }
    for (const [key, shared] of between) {
      const [a, c] = key.split("|") as [string, string];
      const lostA = lostMarks(students.get(a), item);
      const lostC = lostMarks(students.get(c), item);
      const bothWrong = lostA === true && lostC === true;
      const weight = [...shared].reduce((sum, phrase) => sum + Math.log(answered / used.get(phrase)!.size), 0) * (bothWrong ? 2 : 1);
      add(a, c, { item_id: itemId, kind: "written", weight, shared: runs(tokens.get(a)!, shared), both_wrong: bothWrong });
    }
  }

  for (const [key, common] of commonCount) {
    const pair = scores.get(key);
    if (pair) pair.common = common;
  }
  // The fence is drawn over the pairs who share anything at all. Most share
  // nothing, and over every pair the quartiles sit at 0 and fence nothing off.
  const sorted = [...scores.values()].map((pair) => pair.score).sort((a, c) => a - c);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const answeredMost = Math.max(...[...byItem.values()].map((s) => s.size));
  // And never below one run of ten words only these two wrote: seven phrases, each at log(N / 2).
  const floor = (FLOOR_RUN - PHRASE + 1) * Math.log(answeredMost / 2);
  const fence = Math.max(q3 + FENCE * (q3 - q1), floor);
  const unusual = [...scores.values()]
    .filter((pair) => pair.score >= fence)
    .map((pair) => ({
      ...pair,
      score: roundHalfEven(pair.score, 2),
      items: pair.items.map((s) => ({ ...s, weight: roundHalfEven(s.weight, 2) })).sort((a, c) => c.weight - a.weight),
    }))
    .sort((a, c) => c.score - a.score);
  return {
    assessment_id: assessment.assessment_id,
    title: assessment.title,
    setting: settingOf(assessment).setting,
    answered: everyone.size,
    pairs_compared: commonCount.size,
    fence: roundHalfEven(fence, 2),
    unusual,
  };
};

export const sharedAnswers = (
  b: CourseBundle,
  courseVersionId: string,
  options: { assessmentId?: string | null } = {},
): SharedAnswers => {
  const exams: ExamPairs[] = [];
  const notes: string[] = [];
  for (const assessment of assessmentsOf(b, courseVersionId)) {
    if (options.assessmentId && assessment.assessment_id !== options.assessmentId) continue;
    if (settingOf(assessment).setting === "unsupervised") continue;
    const found = examPairs(b, assessment);
    if (found) exams.push(found);
  }
  const seen = new Map<string, { students: [string, string]; exams: string[] }>();
  for (const exam of exams) {
    for (const pair of exam.unusual) {
      const key = pair.students.join("|");
      const entry = seen.get(key) ?? { students: pair.students, exams: [] };
      entry.exams.push(exam.assessment_id);
      seen.set(key, entry);
    }
  }
  if (!exams.length) notes.push("no exam or quiz of this run has recorded answers; `ainar scans record` writes them from read scans");
  return {
    version: SHARED_ANSWERS_VERSION,
    course_version_id: courseVersionId,
    exams,
    recurring: [...seen.values()].filter((entry) => entry.exams.length >= 2).sort((a, c) => c.exams.length - a.exams.length),
    notes,
  };
};
