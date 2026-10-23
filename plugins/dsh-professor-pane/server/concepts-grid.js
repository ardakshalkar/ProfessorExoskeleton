/**
 * The Concepts place: concept × student, the class's evidence laid out as a
 * grid. BACKLOG E37 HOME-8; docs/PROFESSOR-JOURNEY.md §7.
 *
 * Read, not computed: the grid is `class_progress` as the course model builds
 * it (`dashboardPayload` — per student and concept, the mean proportion of
 * the evidence, how many pieces of evidence, and a recorded `concept_state`
 * when somebody has recorded one). This adds what a grid needs to be
 * filtered and read and nothing else: the week that teaches each concept
 * (from the outline), each student's subgroup (from the enrollment), and —
 * in Names mode only — their name.
 *
 * The cells go out as `[proportion, evidence, state]` triples in the
 * students' order: eighty students by seventy concepts is five thousand
 * cells, and objects would be most of the payload.
 *
 * A cell opens on the evidence behind it (`cellEvidence`): each piece, with
 * the assessment, the criterion, the score and when it was recorded.
 *
 * Private. It carries every student's standing, so it is drawn only in
 * course mode and never reaches a page a student sees.
 */

import { approvedView } from "@ainar/core/src/approval.ts";
import { assessmentsOf, enrolledIn } from "@ainar/core/src/bundle.ts";

import { loadedRun, rosterPeople, viewPayload } from "./workspace.js";

/** Evidence's line for "revisit", which Today and Evidence use too. */
const REVISIT_BELOW = 0.6;

/** The dashboard's five bands (ainar-node/src/dashboard.ts BANDS), top first. */
const BANDS = [
  [0.85, "strong"],
  [0.7, "secure"],
  [0.55, "mixed"],
  [0.35, "weak"],
  [0, "very weak"],
];

/** The six recorded states, in the model's order (`concept_state`). */
const STATES = ["not_observed", "introduced", "developing", "demonstrated", "consistently_demonstrated", "needs_review"];

const nameOf = (people, id) => {
  const person = people && people[id];
  return person && typeof person.name === "string" && person.name.trim() ? person.name.trim() : null;
};

/**
 * @param names - put names in, read from this machine's class list.
 * @param drafts - over the whole course, drafts included; otherwise the record.
 */
export const conceptsGrid = (workspace, runId, { names = false, drafts = false } = {}) => {
  const progress = viewPayload(workspace, "class_progress", runId, undefined, drafts).payload;
  const outline = viewPayload(workspace, "course_outline", runId, undefined, false).payload;
  const { bundle } = loadedRun(workspace, runId);
  const people = names ? rosterPeople() : null;

  // The first week whose topic lists the concept: where it is taught.
  const weekOf = new Map();
  const weeks = [];
  for (const week of outline.weeks || []) {
    const concepts = (week.modules || []).flatMap((module) => module.concepts || []);
    if (!concepts.length) continue;
    weeks.push({ week: week.week, title: (week.modules || []).map((module) => module.title).join(" · ") });
    for (const concept of concepts) if (!weekOf.has(concept.id)) weekOf.set(concept.id, week.week);
  }

  const groupOf = new Map(enrolledIn(bundle, runId).map((entry) => [entry.student_id, entry.group || ""]));
  const students = (progress.students || []).map((id) => ({ id, name: nameOf(people, id), group: groupOf.get(id) || "" }));

  const concepts = (progress.concepts || []).map((concept) => {
    const covered = concept.cells.filter((cell) => cell.evidence).length;
    return {
      id: concept.concept_id,
      title: concept.title,
      week: weekOf.get(concept.concept_id) ?? null,
      prerequisites: concept.prerequisites || [],
      class_mean: concept.class_mean ?? null,
      covered,
      cells: concept.cells.map((cell) => [cell.proportion ?? null, cell.evidence || 0, cell.state || null]),
    };
  });

  return {
    run: progress.run,
    names: Boolean(people),
    drafts,
    threshold: REVISIT_BELOW,
    bands: BANDS,
    states: STATES,
    students,
    groups: [...new Set(students.map((student) => student.group).filter(Boolean))].sort(),
    weeks,
    concepts,
    totals: {
      students: students.length,
      concepts: concepts.length,
      evidence: progress.totals ? progress.totals.evidence : null,
      no_evidence: concepts.filter((concept) => !concept.covered).length,
      recorded_states: concepts.reduce((sum, concept) => sum + concept.cells.filter((cell) => cell[2]).length, 0),
    },
  };
};

/** A criterion's words, from the rubric each assessment carries; its id when there are none. */
const criterionTitles = (bundle, runId) => {
  const titles = new Map();
  const rubrics = assessmentsOf(bundle, runId).map((entry) => entry.rubric).filter(Boolean).concat(bundle.rubrics || []);
  for (const rubric of rubrics) {
    for (const criterion of rubric.criteria || []) {
      const id = criterion.criterion_id || criterion.id;
      const words = criterion.title || criterion.name || criterion.description;
      if (id && words) titles.set(id, String(words));
    }
  }
  return titles;
};

/** The evidence behind one cell, newest first. */
export const cellEvidence = (workspace, runId, studentId, conceptId, { drafts = false } = {}) => {
  const { bundle: whole } = loadedRun(workspace, runId);
  const bundle = drafts ? whole : approvedView(whole);
  const titles = new Map(assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id, entry.title || entry.assessment_id]));
  const criteria = criterionTitles(bundle, runId);
  const items = (bundle.evidence || [])
    .filter((record) => record.course_version_id === runId && record.student_id === studentId && record.concept_id === conceptId)
    .map((record) => {
      const x = record.extensions || {};
      return {
        id: record.evidence_id,
        assessment: x.assessment_id ? titles.get(x.assessment_id) || x.assessment_id : null,
        assessment_id: x.assessment_id || null,
        criterion: x.criterion_id ? criteria.get(x.criterion_id) || x.criterion_id : null,
        score: x.score ?? null,
        maximum: x.maximum_score ?? null,
        proportion: x.proportion ?? null,
        source: record.source_type || null,
        at: record.recorded_at || null,
      };
    })
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const state = (bundle.concept_states || []).find(
    (entry) => entry.course_version_id === runId && entry.student_id === studentId && entry.concept_id === conceptId,
  );
  return { student: studentId, concept: conceptId, state: state ? state.state : null, items };
};
