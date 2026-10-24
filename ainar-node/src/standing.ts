/**
 * Where each student stands in the class, assessment by assessment, and
 * whether that differs between work done under supervision and work done at
 * home: `ainar standing` (BACKLOG E38, STN-1 and STN-2).
 *
 * Raw marks are never compared. A hard midterm is hard for everyone, so each
 * graded paper becomes the student's percentile among the papers marked on the
 * same assessment, and those percentiles are what the two sides average. A tie
 * makes a percentile a range, and a gap is only what is left once both ranges
 * have had their room (`percentileIn`).
 *
 * The gap trusts the supervised side, and a student who copies on exams
 * inflates both. So each mark is also set against the same student's other
 * work on the concepts it shares with it, whatever the setting (STN-9): per
 * concept, their percentile among the class on the criteria tagged with it,
 * here against everywhere else. A mark far from that is *out of line*, above
 * or below, and says nothing about why.
 *
 * The profile is derived on every read and never stored, so it cannot go
 * stale; a signal is written only when the professor acts on what it shows.
 * It reads the gradebook's rows and keeps its refusals, and adds three of its
 * own, each because the alternative fakes a gap:
 *
 * 1. Only finished marks. A row the gradebook would not export — partial,
 *    blocked, held by an integrity case — has no standing.
 * 2. Work not handed in is left out, even when the policy makes it 0. It has
 *    its own signal, and as a 0 it would put every student who skips homework
 *    "stronger in class".
 * 3. A mark an integrity case touched, upheld or open, is left out: the case
 *    is the professor's account of that paper, not a measurement.
 *
 * Everything here is keyed by student id. Names never enter it.
 */

import type { z } from "zod";

import { allRubrics, assessmentsOf, itemsOf, runById, type CourseBundle } from "./bundle.ts";
import { exportable, gradeRows } from "./gradebook.ts";
import { roundHalfEven } from "./grading.ts";
import { COLLECTIONS } from "./loader.ts";
import { Setting } from "./model/common.ts";
import { editRecords } from "./record-edit.ts";

export const STANDING_VERSION = "standing/2026.10.2";
export type SettingName = z.infer<typeof Setting>;

/** Fewer marked papers than this, and a percentile says more about chance than the student. */
export const MIN_CLASS = 5;
/** Assessments needed on each side before the two are compared. */
export const MIN_SIDE = 2;

/**
 * Where the work arrives, when that alone says whether anyone watched it. An
 * upload or a fork was made at home; a paper or a defence was not. The rest —
 * `instructor_collected`, `other` — could be either, and fall through to type.
 */
const BY_DELIVERY: Record<string, SettingName> = {
  paper_exam: "supervised",
  oral_defense: "supervised",
  presentation: "supervised",
  canvas_upload: "unsupervised",
  github_repo: "unsupervised",
};

/**
 * What a type settles on its own. A quiz is absent on purpose: one professor
 * sets it on paper in class, the next in Canvas, and guessing either would put
 * half the courses on the wrong side.
 */
const BY_TYPE: Record<string, SettingName> = {
  exam: "supervised",
  oral_defense: "supervised",
  presentation: "supervised",
  assignment: "unsupervised",
  project: "unsupervised",
};

/** Not a measure of what was learned, so never on either side. */
const NOT_MEASURED = new Set(["participation"]);

export interface SettingFound {
  setting: SettingName | null;
  /** `recorded` is the professor's word; `inferred` is read off type or delivery. */
  source: "recorded" | "inferred" | null;
  reason: string;
}

/** The assessment's setting: recorded, else inferred where type or delivery settles it, else unknown. */
export const settingOf = (assessment: any): SettingFound => {
  if (assessment?.setting === "supervised" || assessment?.setting === "unsupervised") {
    return { setting: assessment.setting, source: "recorded", reason: "recorded" };
  }
  if (NOT_MEASURED.has(assessment?.type)) {
    return { setting: null, source: null, reason: `${assessment.type} is not counted in standing` };
  }
  const byDelivery = assessment?.delivery ? BY_DELIVERY[assessment.delivery] : undefined;
  if (byDelivery) return { setting: byDelivery, source: "inferred", reason: `delivered as ${assessment.delivery}` };
  const byType = BY_TYPE[assessment?.type];
  if (byType) return { setting: byType, source: "inferred", reason: `type ${assessment.type}` };
  return {
    setting: null,
    source: null,
    reason: `type ${assessment?.type ?? "unknown"}${assessment?.delivery ? `, delivered as ${assessment.delivery}` : ""}, could be either — record it`,
  };
};

/**
 * Record the setting on one or more assessments of a run: `ainar assessment
 * setting`. The professor's fact, like a due date, so it is not refused while
 * the grading policy is locked — it moves no mark. `null` clears it, back to
 * whatever type and delivery infer.
 */
export const setSetting = (options: {
  root: string;
  bundle: CourseBundle;
  runId: string;
  assessmentIds: readonly string[];
  setting: SettingName | null;
}): string[] => {
  const { root, bundle, runId, assessmentIds, setting } = options;
  if (setting !== null && !Setting.safeParse(setting).success) {
    throw new Error(`a setting is supervised or unsupervised, not '${setting}'`);
  }
  if (!runById(bundle).get(runId)) throw new Error(`no course run '${runId}'`);
  const own = new Map(assessmentsOf(bundle, runId).map((a: any) => [a.assessment_id, a]));
  const unknown = assessmentIds.filter((id) => !own.has(id));
  if (unknown.length) throw new Error(`not assessments of ${runId}: ${unknown.join(", ")}`);
  const changing = assessmentIds.filter((id) => ((own.get(id) as any).setting ?? null) !== setting);
  if (!changing.length) return [];
  return editRecords({
    root,
    courseId: String((bundle.course as any).course_id),
    patterns: COLLECTIONS.assessments,
    idField: "assessment_id",
    collection: "assessments",
    edits: new Map(
      changing.map((id) => [
        id,
        (node: any) => {
          if (setting) node.set("setting", setting);
          else if (node.has("setting")) node.delete("setting");
        },
      ]),
    ),
  }).written;
};

/** Every concept an assessment's items or rubric criteria name, sorted. */
const conceptsOf = (b: CourseBundle, assessment: any): string[] => {
  const found = new Set<string>();
  for (const item of itemsOf(b, assessment.assessment_id)) for (const c of item.concepts ?? []) found.add(c);
  const rubric = assessment.rubric_id ? allRubrics(b).get(assessment.rubric_id) : null;
  for (const criterion of rubric?.criteria ?? []) for (const c of criterion.concepts ?? []) found.add(c);
  return [...found].sort();
};

/**
 * Where a mark sits among the class's: the range from those below it to those
 * below or level with it, and its middle. Ties are the reason for the range.
 * When half the class has full marks on a homework, each of them sits anywhere
 * from the 50th to the 100th, and a single number would put a student who is
 * top in class "weaker at home" for a mark nobody could have beaten.
 */
const percentileIn = (scores: readonly number[], score: number): { low: number; mid: number; high: number } => {
  const below = scores.filter((s) => s < score).length;
  const level = scores.filter((s) => s === score).length;
  const at = (count: number) => roundHalfEven((count / scores.length) * 100, 1);
  return { low: at(below), mid: at(below + level / 2), high: at(below + level) };
};

const mean = (values: readonly number[]): number | null =>
  values.length ? roundHalfEven(values.reduce((sum, v) => sum + v, 0) / values.length, 1) : null;

interface Range {
  low: number;
  mid: number;
  high: number;
}

/** How far `a` sits above `b` once both ranges have had their room: 0 where they overlap, negative below. */
const apart = (a: { low: number; high: number }, b: { low: number; high: number }): number =>
  a.low > b.high ? roundHalfEven(a.low - b.high, 1) : b.low > a.high ? -roundHalfEven(b.low - a.high, 1) : 0;

const meanRange = (ranges: readonly Range[]): Range => ({
  low: mean(ranges.map((r) => r.low)) as number,
  mid: mean(ranges.map((r) => r.mid)) as number,
  high: mean(ranges.map((r) => r.high)) as number,
});

/**
 * A mark this far from the same student's other work on the same concepts,
 * in percentile points after ties, is *out of line* (STN-9).
 */
export const OUT_OF_LINE = 30;
/** Other assessments on the same concepts needed before a mark is held against them. */
export const MIN_AGAINST = 2;

/**
 * One assessment's mark set against the same student's other work on the
 * concepts it shares with them, whatever their setting — so a student copying
 * on exams, who has no in-class/at-home gap, still stands out where an exam
 * is strong on concepts every homework of theirs is weak on.
 */
export interface OutOfLine {
  assessment_id: string;
  setting: SettingName | null;
  /** The concepts this mark shares with the other work. */
  concepts: string[];
  /** The student's percentile on those concepts here, and on the other work. */
  here: Range;
  there: Range;
  /** Positive: this mark stands above their other work on the concepts; negative, below. */
  distance: number;
  /** The other assessments it was set against. */
  against: string[];
}

export interface StandingEntry {
  assessment_id: string;
  setting: SettingName | null;
  /** Among the papers marked on this assessment, 0–100: the middle of the range ties allow. */
  percentile: number;
  /** The range ties allow: those below, to those below or level. Equal to `percentile` with no tie. */
  low: number;
  high: number;
  /** The mark as a percentage of the maximum, for the reader; never compared. */
  percent: number;
  at: string | null;
}

export interface Side {
  /** The mean percentile over this side's assessments; null with none. */
  standing: number | null;
  /** The means of the ranges' ends: how far ties let the standing move. */
  low: number | null;
  high: number | null;
  count: number;
}

export interface StudentStanding {
  student_id: string;
  entries: StandingEntry[];
  supervised: Side;
  unsupervised: Side;
  /**
   * How far apart the two sides are once ties have had their room: the
   * distance between their ranges, 0 where they overlap. Positive is stronger
   * at home, negative stronger in class. Null until each side has `MIN_SIDE`.
   */
  gap: number | null;
  /** Rows with a mark that were not counted, and why — so a short profile explains itself. */
  left_out: { assessment_id: string; why: string }[];
  /** Marks with enough other work on their concepts to be set against it. */
  checked: number;
  /** Those of them at least `OUT_OF_LINE` from it, by date. */
  out_of_line: OutOfLine[];
}

export interface AssessmentStanding {
  assessment_id: string;
  title: string;
  type: string;
  setting: SettingName | null;
  setting_source: "recorded" | "inferred" | null;
  setting_reason: string;
  at: string | null;
  concepts: string[];
  /** Papers that counted; under `MIN_CLASS`, no percentile is given. */
  marked: number;
  counted: boolean;
}

export interface StandingProfile {
  version: string;
  course_version_id: string;
  min_class: number;
  min_side: number;
  out_of_line_at: number;
  min_against: number;
  assessments: AssessmentStanding[];
  students: StudentStanding[];
  /** Assessments with marks whose setting nobody has said, and nothing settles. */
  unknown_setting: string[];
  notes: string[];
}

const whyNot = (row: any): string | null => {
  if (!row.submission_id) return "not handed in";
  if (row.integrity && row.integrity.state !== "cleared") return `integrity case ${row.integrity.case_id}`;
  if (!exportable(row)) return row.status === "graded" ? "blocked" : row.status.replace("_", " ");
  return null;
};

export const standingProfile = (
  b: CourseBundle,
  courseVersionId: string,
  options: { groups?: readonly string[] | null; now?: number } = {},
): StandingProfile => {
  const rowsByAssessment = gradeRows(b, courseVersionId, { groups: options.groups ?? null, now: options.now });
  const byStudent = new Map<string, StudentStanding>();
  const student = (id: string): StudentStanding => {
    let found = byStudent.get(id);
    if (!found) {
      found = {
        student_id: id,
        entries: [],
        supervised: { standing: null, low: null, high: null, count: 0 },
        unsupervised: { standing: null, low: null, high: null, count: 0 },
        gap: null,
        left_out: [],
        checked: 0,
        out_of_line: [],
      };
      byStudent.set(id, found);
    }
    return found;
  };

  const assessments: AssessmentStanding[] = [];
  const unknown: string[] = [];
  const rubrics = allRubrics(b);
  /** student → assessment → concept → where they sit among the class on that concept there. */
  const onConcept = new Map<string, Map<string, Map<string, Range>>>();
  const settingById = new Map<string, SettingName | null>();
  const atById = new Map<string, string | null>();
  for (const assessment of assessmentsOf(b, courseVersionId)) {
    const rows = rowsByAssessment.get(assessment.assessment_id) ?? [];
    const found = settingOf(assessment);
    const at = assessment.due_at ?? assessment.opens_at ?? null;
    const counted = rows.filter((row) => whyNot(row) === null);
    const scores = counted.map((row) => row.score as number);
    const measured = !NOT_MEASURED.has(assessment.type);
    const enough = measured && scores.length >= MIN_CLASS;
    assessments.push({
      assessment_id: assessment.assessment_id,
      title: assessment.title,
      type: assessment.type,
      setting: found.setting,
      setting_source: found.source,
      setting_reason: found.reason,
      at,
      concepts: conceptsOf(b, assessment),
      marked: scores.length,
      counted: enough,
    });
    if (measured && scores.length && found.setting === null) unknown.push(assessment.assessment_id);
    settingById.set(assessment.assessment_id, found.setting);
    atById.set(assessment.assessment_id, at);
    for (const row of rows) student(row.student_id);
    if (!enough) continue;

    // Each concept's share of this paper: the criteria tagged with it, summed.
    // The criterion scores are the gradebook's own — a decision, or approved
    // items — so this reads nothing the total did not.
    const tags = new Map<string, string[]>(
      ((assessment.rubric_id ? rubrics.get(assessment.rubric_id)?.criteria : null) ?? []).map((c: any) => [c.criterion_id, c.concepts ?? []]),
    );
    const byConcept = new Map<string, Map<string, { score: number; maximum: number }>>();
    for (const row of counted) {
      for (const criterion of row.criteria) {
        if (criterion.score === null || !criterion.maximum) continue;
        for (const concept of tags.get(criterion.criterion_id) ?? []) {
          const students = byConcept.get(concept) ?? new Map();
          const sum = students.get(row.student_id) ?? { score: 0, maximum: 0 };
          students.set(row.student_id, { score: sum.score + criterion.score, maximum: sum.maximum + criterion.maximum });
          byConcept.set(concept, students);
        }
      }
    }
    for (const [concept, students] of byConcept) {
      if (students.size < MIN_CLASS) continue;
      const fractions = [...students.values()].map((s) => s.score / s.maximum);
      for (const [id, s] of students) {
        const mine = onConcept.get(id) ?? new Map<string, Map<string, Range>>();
        const here = mine.get(assessment.assessment_id) ?? new Map<string, Range>();
        here.set(concept, percentileIn(fractions, s.score / s.maximum));
        mine.set(assessment.assessment_id, here);
        onConcept.set(id, mine);
      }
    }
    for (const row of rows) {
      const why = whyNot(row);
      if (why !== null) {
        // A blank nobody handed in is not worth a line; a mark that exists and was set aside is.
        if (row.submission_id || row.score !== null) student(row.student_id).left_out.push({ assessment_id: assessment.assessment_id, why });
        continue;
      }
      const place = percentileIn(scores, row.score as number);
      student(row.student_id).entries.push({
        assessment_id: assessment.assessment_id,
        setting: found.setting,
        percentile: place.mid,
        low: place.low,
        high: place.high,
        percent: roundHalfEven(((row.score as number) / row.maximum) * 100, 1),
        at,
      });
    }
  }

  const byDate = (a: StandingEntry, c: StandingEntry) =>
    (a.at ?? "￿").localeCompare(c.at ?? "￿") || a.assessment_id.localeCompare(c.assessment_id);
  for (const s of byStudent.values()) {
    s.entries.sort(byDate);
    for (const side of ["supervised", "unsupervised"] as const) {
      const on = s.entries.filter((e) => e.setting === side);
      s[side] = {
        standing: mean(on.map((e) => e.percentile)),
        low: mean(on.map((e) => e.low)),
        high: mean(on.map((e) => e.high)),
        count: on.length,
      };
    }
    if (s.supervised.count >= MIN_SIDE && s.unsupervised.count >= MIN_SIDE) {
      s.gap = apart(s.unsupervised as { low: number; high: number }, s.supervised as { low: number; high: number });
    }

    // STN-9: each mark against the same student's other work on its concepts.
    const mine = onConcept.get(s.student_id) ?? new Map<string, Map<string, Range>>();
    for (const [assessmentId, concepts] of mine) {
      const here: Range[] = [];
      const there: Range[] = [];
      const shared: string[] = [];
      const against = new Set<string>();
      for (const [concept, range] of concepts) {
        const elsewhere = [...mine].filter(([other, on]) => other !== assessmentId && on.has(concept));
        if (!elsewhere.length) continue;
        shared.push(concept);
        here.push(range);
        there.push(meanRange(elsewhere.map(([, on]) => on.get(concept)!)));
        for (const [other] of elsewhere) against.add(other);
      }
      if (against.size < MIN_AGAINST) continue;
      s.checked += 1;
      const mark = meanRange(here);
      const rest = meanRange(there);
      const distance = apart(mark, rest);
      if (Math.abs(distance) < OUT_OF_LINE) continue;
      s.out_of_line.push({
        assessment_id: assessmentId,
        setting: settingById.get(assessmentId) ?? null,
        concepts: shared.sort(),
        here: mark,
        there: rest,
        distance,
        against: [...against].sort(),
      });
    }
    s.out_of_line.sort(
      (a, c) =>
        (atById.get(a.assessment_id) ?? "￿").localeCompare(atById.get(c.assessment_id) ?? "￿") ||
        a.assessment_id.localeCompare(c.assessment_id),
    );
  }

  const notes: string[] = [];
  if (unknown.length) {
    notes.push(
      `${unknown.length} assessment(s) with marks have no known setting and sit on neither side: ` +
        `${unknown.join(", ")}. Record it with \`ainar assessment setting ${courseVersionId} A… supervised|unsupervised\`.`,
    );
  }
  const thin = assessments.filter((a) => a.marked > 0 && a.marked < MIN_CLASS && !NOT_MEASURED.has(a.type));
  if (thin.length) notes.push(`fewer than ${MIN_CLASS} marked papers, so no percentile yet: ${thin.map((a) => a.assessment_id).join(", ")}`);

  return {
    version: STANDING_VERSION,
    course_version_id: courseVersionId,
    min_class: MIN_CLASS,
    min_side: MIN_SIDE,
    out_of_line_at: OUT_OF_LINE,
    min_against: MIN_AGAINST,
    assessments,
    students: [...byStudent.values()].sort((a, c) => a.student_id.localeCompare(c.student_id)),
    unknown_setting: unknown,
    notes,
  };
};
