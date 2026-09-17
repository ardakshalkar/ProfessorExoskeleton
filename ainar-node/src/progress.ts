/**
 * What one student demonstrated, and where the class stands.
 * Ported from `ainar/progress.py`.
 *
 * The distinction the whole thing rests on: a **blank** is a concept nothing
 * assessed, and is not a zero. It stays `null` here and is counted separately
 * in `concepts_with_no_evidence`.
 */

import {
  capabilityById,
  conceptById,
  enrolledIn,
  modulesOf,
  outcomeById,
  runById,
  type CourseBundle,
} from "./bundle.ts";
import { roundHalfEven } from "./grading.ts";

const students = (
  b: CourseBundle,
  courseVersionId: string,
  groups?: readonly string[] | null,
): string[] =>
  enrolledIn(b, courseVersionId, { groups })
    .map((e) => e.student_id as string)
    .sort();

const proportion = (record: any): number | null => {
  const value = record.extensions?.proportion;
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
};

const mean = (values: number[]): number | null =>
  values.length ? roundHalfEven(values.reduce((a, b) => a + b, 0) / values.length, 2) : null;

const summarise = (records: any[]): Record<string, unknown> => {
  const proportions = records.map(proportion).filter((p): p is number => p !== null);
  const levels = records
    .map((r) => r.demonstrated_level)
    .filter((l): l is number => l !== null && l !== undefined);
  return {
    evidence_count: records.length,
    sources: [...new Set(records.map((r) => r.source_id as string))].sort(),
    mean_proportion: mean(proportions),
    highest_level: levels.length ? Math.max(...levels) : null,
    evidence_ids: records.map((r) => r.evidence_id as string).sort(),
  };
};

/** The workflow identifier stamped on every state this module derives. */
export const ROLL_UP_WORKFLOW = "progress/roll-up-1";

/**
 * A (student, capability) pair as one map key, and back again.
 *
 * JSON rather than a joined string. Python groups on a real tuple, which cannot
 * collide; a joined string can, as soon as an id contains whatever character
 * was chosen as the separator. Encoding through JSON keeps the pair recoverable
 * whatever the ids hold, and `JSON.stringify` of a two-string array is stable,
 * so the sort below is over a well-defined ordering.
 */
const pairKey = (studentId: string, capabilityId: string): string =>
  JSON.stringify([studentId, capabilityId]);

/**
 * The chronologically latest of a set of aware timestamps, as the original
 * string.
 *
 * Not `Math.max` over strings, and not a lexicographic `sort().pop()`. Both
 * agree with the clock only while every timestamp carries the same UTC offset,
 * and `awareDatetime()` accepts any offset — so `2026-09-04T09:00:00+06:00`
 * sorts after `2026-09-04T04:00:00Z` as text while being the earlier instant.
 * Python's `max()` over aware datetimes compares instants, so comparing
 * instants here is what keeps the two in step.
 *
 * The value RETURNED is the original string rather than a re-serialised Date:
 * re-formatting would silently rewrite the professor's recorded offset into Z,
 * which is a change to the record for no reason.
 */
const latest = (timestamps: string[]): string | null => {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const stamp of timestamps) {
    const ms = Date.parse(stamp);
    // An unparseable stamp cannot be compared as an instant. It is not dropped
    // — the loader accepted it, so it is in the record — but it can only lose,
    // which is the conservative half of the two available mistakes.
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = stamp;
    }
  }
  return best;
};

/**
 * Capability states derived from evidence that names a capability.
 * Ported from `roll_up_capabilities` in `ainar/progress.py`.
 *
 * The level claimed is the highest level actually demonstrated. There is no
 * invented confidence: `source_count` says how many independent pieces of
 * evidence stand behind it, and one is visibly different from four.
 *
 * A capability that already has a state is skipped rather than recomputed —
 * this derives what is missing, it does not overwrite what a person may have
 * edited.
 */
export const rollUpCapabilities = (
  b: CourseBundle,
  courseVersionId: string,
  now: string | null = null,
): Record<string, unknown>[] => {
  const grouped = new Map<string, any[]>();
  for (const record of b.evidence as any[]) {
    if (!record.capability_id) continue;
    if (record.course_version_id !== courseVersionId) continue;
    // The key is the pair as JSON, which is unambiguous whatever the ids
    // contain — a separator character has to be one no id may hold, and
    // asserting that about somebody else's identifiers is how two students
    // quietly become one group.
    const key = pairKey(record.student_id, record.capability_id);
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [record]);
    else bucket.push(record);
  }

  const existing = new Set(
    (b.capability_states as any[]).map((state) => pairKey(state.student_id, state.capability_id)),
  );

  const produced: Record<string, unknown>[] = [];
  // Sorted by the pair, which is what Python's `sorted(grouped.items())` does:
  // the output order is part of what the parity fixtures compare, and a Map's
  // insertion order is the order the evidence happened to load in.
  for (const key of [...grouped.keys()].sort()) {
    if (existing.has(key)) continue;
    const records = grouped.get(key)!;
    const [studentId, capabilityId] = JSON.parse(key) as [string, string];

    const levels = records
      .map((r) => r.demonstrated_level)
      .filter((l): l is number => typeof l === "number");
    const sources = [...new Set(records.map((r) => r.source_id as string))].sort();
    const timestamps = records.map((r) => r.recorded_at).filter((t): t is string => Boolean(t));
    const verified = records.map((r) => r.verified_by).filter((v): v is string => Boolean(v));
    const evidenceIds = records.map((r) => r.evidence_id as string).sort();

    produced.push({
      student_id: studentId,
      capability_id: capabilityId,
      course_version_id: courseVersionId,
      level: levels.length ? Math.max(...levels) : null,
      source_count: sources.length,
      evidence_ids: evidenceIds,
      verified_by: verified.length ? verified[0] : null,
      last_updated_at: latest(timestamps) ?? now,
      provenance: {
        produced_by: "capability-roll-up",
        workflow_version: ROLL_UP_WORKFLOW,
        input_refs: evidenceIds,
        created_at: now,
      },
      extensions: {
        levels_seen: [...new Set(levels)].sort((x, y) => x - y),
        sources,
      },
    });
  }
  return produced;
};

/** Everything the course knows about one student, with sources attached. */
export const studentRecord = (
  b: CourseBundle,
  courseVersionId: string,
  studentId: string,
): Record<string, unknown> => {
  const evidence = (b.evidence as any[]).filter(
    (e) => e.student_id === studentId && e.course_version_id === courseVersionId,
  );
  const outcomes = outcomeById(b);
  const concepts = conceptById(b);
  const capabilities = capabilityById(b);

  const byOutcome = new Map<string, any[]>();
  const byConcept = new Map<string, any[]>();
  for (const record of evidence) {
    if (record.outcome_id) {
      byOutcome.set(record.outcome_id, [...(byOutcome.get(record.outcome_id) ?? []), record]);
    }
    if (record.concept_id) {
      byConcept.set(record.concept_id, [...(byConcept.get(record.concept_id) ?? []), record]);
    }
  }

  const run = runById(b).get(courseVersionId) as any;
  const conceptStates = new Map(
    (b.concept_states as any[])
      .filter((state) => state.student_id === studentId && state.course_version_id === courseVersionId)
      .map((state) => [state.concept_id as string, state.state as string]),
  );

  // A gap is only explainable next to its prerequisites.
  const gaps: unknown[] = [];
  for (const conceptId of [...byConcept.keys()].sort()) {
    const summary = summarise(byConcept.get(conceptId)!);
    const value = summary.mean_proportion as number | null;
    if (value === null || value >= 0.6) continue;
    const concept = concepts.get(conceptId) as any;
    const prerequisites: string[] = concept?.prerequisites ?? [];
    gaps.push({
      concept_id: conceptId,
      title: concept?.title ?? null,
      mean_proportion: value,
      prerequisites,
      prerequisite_state: Object.fromEntries(
        prerequisites.map((p) => [p, conceptStates.get(p) ?? "no evidence"]),
      ),
      evidence_ids: summary.evidence_ids,
    });
  }

  return {
    student_id: studentId,
    course_run: { id: courseVersionId, title: b.course.title, term: run.term },
    outcomes: [...byOutcome.keys()].sort().map((outcomeId) => ({
      outcome_id: outcomeId,
      title: (outcomes.get(outcomeId) as any)?.title ?? null,
      ...summarise(byOutcome.get(outcomeId)!),
    })),
    concepts: [...byConcept.keys()].sort().map((conceptId) => ({
      concept_id: conceptId,
      title: (concepts.get(conceptId) as any)?.title ?? null,
      state: conceptStates.get(conceptId) ?? null,
      ...summarise(byConcept.get(conceptId)!),
    })),
    capabilities: (b.capability_states as any[])
      .filter((state) => state.student_id === studentId)
      .map((state) => ({
        capability_id: state.capability_id,
        title: (capabilities.get(state.capability_id) as any)?.title ?? null,
        level: state.level ?? null,
        source_count: state.source_count,
        evidence_ids: state.evidence_ids,
      })),
    gaps,
    signals: (b.signals as any[])
      .filter((signal) => signal.student_id === studentId && signal.course_version_id === courseVersionId)
      .map((signal) => ({
        signal_id: signal.signal_id,
        type: signal.type,
        severity: signal.severity,
        description: signal.description,
        status: signal.status,
        evidence_ids: signal.evidence_ids,
      })),
    note:
      "Derived from recorded evidence only. Absence of evidence is not " +
      "evidence of absence — a concept with no evidence was never assessed.",
  };
};

/** The class as a grid: concepts in teaching order against students. */
export const dashboardPayload = (
  b: CourseBundle,
  courseVersionId: string,
  options: { groups?: readonly string[] | null } = {},
): Record<string, unknown> => {
  const groups = (options.groups ?? []).map((group) => group.trim()).filter(Boolean);
  const roster = students(b, courseVersionId, groups);
  const run = runById(b).get(courseVersionId) as any;

  const ordered: string[] = [];
  for (const module of modulesOf(b, (b.course as any).course_id)) {
    for (const conceptId of module.concepts as string[]) {
      if (!ordered.includes(conceptId)) ordered.push(conceptId);
    }
  }

  const cells = new Map<string, Map<string, { proportions: number[]; evidence: number }>>();
  for (const record of b.evidence as any[]) {
    if (record.course_version_id !== courseVersionId || !record.concept_id) continue;
    let byStudent = cells.get(record.concept_id);
    if (!byStudent) {
      byStudent = new Map();
      cells.set(record.concept_id, byStudent);
    }
    let cell = byStudent.get(record.student_id);
    if (!cell) {
      cell = { proportions: [], evidence: 0 };
      byStudent.set(record.student_id, cell);
    }
    cell.evidence += 1;
    const value = proportion(record);
    if (value !== null) cell.proportions.push(value);
  }

  const states = new Map(
    (b.concept_states as any[])
      .filter((state) => state.course_version_id === courseVersionId)
      .map((state) => [`${state.student_id} ${state.concept_id}`, state.state as string]),
  );

  const grid = ordered.map((conceptId) => {
    const concept = conceptById(b).get(conceptId) as any;
    const rowCells = roster.map((studentId) => {
      const cell = cells.get(conceptId)?.get(studentId);
      return {
        student_id: studentId,
        proportion: mean(cell?.proportions ?? []),
        evidence: cell?.evidence ?? 0,
        state: states.get(`${studentId} ${conceptId}`) ?? null,
      };
    });
    const covered = rowCells.filter((cell) => cell.evidence);
    const scored = covered.filter((cell) => cell.proportion !== null);
    return {
      concept_id: conceptId,
      title: concept?.title ?? conceptId,
      prerequisites: concept?.prerequisites ?? [],
      cells: rowCells,
      coverage: `${covered.length}/${roster.length}`,
      class_mean: mean(scored.map((cell) => cell.proportion as number)),
    };
  });

  const capabilityRows: unknown[] = [];
  for (const capability of b.capabilities as any[]) {
    const levels = new Map(
      (b.capability_states as any[])
        .filter((state) => state.capability_id === capability.capability_id)
        .map((state) => [state.student_id as string, state.level ?? null]),
    );
    if (!levels.size) continue;
    const maxLevel = capability.levels.length
      ? Math.max(...capability.levels.map((l: any) => l.level))
      : null;
    capabilityRows.push({
      capability_id: capability.capability_id,
      title: capability.title,
      max_level: maxLevel,
      cells: roster.map((studentId) => ({
        student_id: studentId,
        level: levels.get(studentId) ?? null,
      })),
    });
  }

  return {
    run: { id: courseVersionId, title: b.course.title, course_id: b.course.course_id, term: run.term },
    /*
     * Present only when it is a real filter.
     *
     * A subgroup's numbers must not be readable as the class's, so a narrowed
     * payload says so. An unnarrowed one stays byte-identical to what
     * `progress.py` emits, which is what `workspace/golden/` compares — a key that is
     * always there, even as `[]`, is a parity break for every caller that
     * never asked about subgroups.
     */
    ...(groups.length ? { groups } : {}),
    students: roster,
    concepts: grid,
    capabilities: capabilityRows,
    totals: {
      students: roster.length,
      concepts: ordered.length,
      evidence: (b.evidence as any[]).filter((e) => e.course_version_id === courseVersionId).length,
      concepts_with_no_evidence: grid
        .filter((row) => row.coverage.startsWith("0/"))
        .map((row) => row.concept_id),
    },
  };
};
