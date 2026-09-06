/**
 * What one student demonstrated, and where the class stands.
 * Ported from `ainar/progress.py`.
 *
 * The distinction the whole thing rests on: a **blank** is a concept nothing
 * assessed, and is not a zero. It stays `null` here and is counted separately
 * in `concepts_with_no_evidence`.
 */
import { capabilityById, conceptById, enrollmentsOf, modulesOf, outcomeById, runById, } from "./bundle.js";
import { roundHalfEven } from "./grading.js";
const students = (b, courseVersionId) => enrollmentsOf(b, courseVersionId)
    .filter((e) => ["student", "auditor"].includes(e.role) && e.status === "active")
    .map((e) => e.student_id)
    .sort();
const proportion = (record) => {
    const value = record.extensions?.proportion;
    return typeof value === "number" && !Number.isNaN(value) ? value : null;
};
const mean = (values) => values.length ? roundHalfEven(values.reduce((a, b) => a + b, 0) / values.length, 2) : null;
const summarise = (records) => {
    const proportions = records.map(proportion).filter((p) => p !== null);
    const levels = records
        .map((r) => r.demonstrated_level)
        .filter((l) => l !== null && l !== undefined);
    return {
        evidence_count: records.length,
        sources: [...new Set(records.map((r) => r.source_id))].sort(),
        mean_proportion: mean(proportions),
        highest_level: levels.length ? Math.max(...levels) : null,
        evidence_ids: records.map((r) => r.evidence_id).sort(),
    };
};
/** Everything the course knows about one student, with sources attached. */
export const studentRecord = (b, courseVersionId, studentId) => {
    const evidence = b.evidence.filter((e) => e.student_id === studentId && e.course_version_id === courseVersionId);
    const outcomes = outcomeById(b);
    const concepts = conceptById(b);
    const capabilities = capabilityById(b);
    const byOutcome = new Map();
    const byConcept = new Map();
    for (const record of evidence) {
        if (record.outcome_id) {
            byOutcome.set(record.outcome_id, [...(byOutcome.get(record.outcome_id) ?? []), record]);
        }
        if (record.concept_id) {
            byConcept.set(record.concept_id, [...(byConcept.get(record.concept_id) ?? []), record]);
        }
    }
    const run = runById(b).get(courseVersionId);
    const conceptStates = new Map(b.concept_states
        .filter((state) => state.student_id === studentId && state.course_version_id === courseVersionId)
        .map((state) => [state.concept_id, state.state]));
    // A gap is only explainable next to its prerequisites.
    const gaps = [];
    for (const conceptId of [...byConcept.keys()].sort()) {
        const summary = summarise(byConcept.get(conceptId));
        const value = summary.mean_proportion;
        if (value === null || value >= 0.6)
            continue;
        const concept = concepts.get(conceptId);
        const prerequisites = concept?.prerequisites ?? [];
        gaps.push({
            concept_id: conceptId,
            title: concept?.title ?? null,
            mean_proportion: value,
            prerequisites,
            prerequisite_state: Object.fromEntries(prerequisites.map((p) => [p, conceptStates.get(p) ?? "no evidence"])),
            evidence_ids: summary.evidence_ids,
        });
    }
    return {
        student_id: studentId,
        course_run: { id: courseVersionId, title: b.course.title, term: run.term },
        outcomes: [...byOutcome.keys()].sort().map((outcomeId) => ({
            outcome_id: outcomeId,
            title: outcomes.get(outcomeId)?.title ?? null,
            ...summarise(byOutcome.get(outcomeId)),
        })),
        concepts: [...byConcept.keys()].sort().map((conceptId) => ({
            concept_id: conceptId,
            title: concepts.get(conceptId)?.title ?? null,
            state: conceptStates.get(conceptId) ?? null,
            ...summarise(byConcept.get(conceptId)),
        })),
        capabilities: b.capability_states
            .filter((state) => state.student_id === studentId)
            .map((state) => ({
            capability_id: state.capability_id,
            title: capabilities.get(state.capability_id)?.title ?? null,
            level: state.level ?? null,
            source_count: state.source_count,
            evidence_ids: state.evidence_ids,
        })),
        gaps,
        signals: b.signals
            .filter((signal) => signal.student_id === studentId && signal.course_version_id === courseVersionId)
            .map((signal) => ({
            signal_id: signal.signal_id,
            type: signal.type,
            severity: signal.severity,
            description: signal.description,
            status: signal.status,
            evidence_ids: signal.evidence_ids,
        })),
        note: "Derived from recorded evidence only. Absence of evidence is not " +
            "evidence of absence — a concept with no evidence was never assessed.",
    };
};
/** The class as a grid: concepts in teaching order against students. */
export const dashboardPayload = (b, courseVersionId) => {
    const roster = students(b, courseVersionId);
    const run = runById(b).get(courseVersionId);
    const ordered = [];
    for (const module of modulesOf(b, b.course.course_id)) {
        for (const conceptId of module.concepts) {
            if (!ordered.includes(conceptId))
                ordered.push(conceptId);
        }
    }
    const cells = new Map();
    for (const record of b.evidence) {
        if (record.course_version_id !== courseVersionId || !record.concept_id)
            continue;
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
        if (value !== null)
            cell.proportions.push(value);
    }
    const states = new Map(b.concept_states
        .filter((state) => state.course_version_id === courseVersionId)
        .map((state) => [`${state.student_id} ${state.concept_id}`, state.state]));
    const grid = ordered.map((conceptId) => {
        const concept = conceptById(b).get(conceptId);
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
            class_mean: mean(scored.map((cell) => cell.proportion)),
        };
    });
    const capabilityRows = [];
    for (const capability of b.capabilities) {
        const levels = new Map(b.capability_states
            .filter((state) => state.capability_id === capability.capability_id)
            .map((state) => [state.student_id, state.level ?? null]));
        if (!levels.size)
            continue;
        const maxLevel = capability.levels.length
            ? Math.max(...capability.levels.map((l) => l.level))
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
        students: roster,
        concepts: grid,
        capabilities: capabilityRows,
        totals: {
            students: roster.length,
            concepts: ordered.length,
            evidence: b.evidence.filter((e) => e.course_version_id === courseVersionId).length,
            concepts_with_no_evidence: grid
                .filter((row) => row.coverage.startsWith("0/"))
                .map((row) => row.concept_id),
        },
    };
};
