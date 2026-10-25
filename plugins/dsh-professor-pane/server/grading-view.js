/**
 * What the Gradebook's policy card says about each block beyond its weight.
 *
 * A flat list of twenty-one weights summing to 100% says nothing about how a
 * grade is built. An institution builds it in blocks — Narxoz: ВСК1 30, ВСК2 30,
 * final 40 — and each block out of kinds of work. So for each block this
 * gathers:
 *
 * - **the kinds of work inside it**, with count and per-item share, which the
 *   card's bar splits each segment by;
 * - **the dates it spans** and **how many of its assessments have marks**;
 * - **whether each Canvas course has its assignment group mapped**.
 *
 * Whether a block adds up is the validator's answer, which the card already
 * shows; this does not count it a second time.
 *
 * Until 2026-10-24 this was drawn as its own page, Materials · Grading
 * policy, beside the card in Gradebook · Policy that draws the same scheme
 * and edits it. One policy, one place: the page went and its facts joined the
 * card (`gradingPolicy` in grading-writes.js).
 *
 * Nothing here computes a grade. It reads the scheme, the assessments and
 * which of them have marks.
 */

import { assessmentKind } from "@ainar/core/src/assessment-kinds.ts";

/** The members of one block, grouped by kind, biggest share first. */
const kindsIn = (members) => {
  const groups = new Map();
  for (const assessment of members) {
    const kind = assessmentKind(assessment.type);
    if (!groups.has(kind.type)) groups.set(kind.type, { kind, items: [] });
    groups.get(kind.type).items.push(assessment);
  }
  return [...groups.values()]
    .map((group) => {
      const n = group.items.length;
      const weights = group.items.map((a) => a.weight ?? 0);
      const even = n > 1 && weights.every((w) => Math.abs(w - weights[0]) < 1e-6);
      return {
        type: group.kind.type,
        // "Exam", "Homework ×4", "Quizzes ×3": one item by its own title.
        label: n === 1 ? group.items[0].title ?? group.kind.one : `${group.kind.many} ×${n}`,
        many: group.kind.many,
        count: n,
        weight: weights.reduce((sum, w) => sum + w, 0),
        each: even ? weights[0] : null,
      };
    })
    .sort((a, b) => b.weight - a.weight);
};

/**
 * Whether a block has its Canvas assignment group: `{ courses, missing }`
 * over the run's Canvas courses, or null for a run that sends to no Canvas.
 */
const canvasOf = (run, componentId) => {
  const lms = run?.extensions?.lms ?? {};
  const mapped = (lms.canvas_assignment_groups ?? {})[componentId];
  const courses = lms.canvas_courses;
  if (courses && typeof courses === "object") {
    const all = Object.keys(courses).sort();
    return { courses: all, missing: all.filter((g) => !(mapped && typeof mapped === "object" && mapped[g])) };
  }
  if (lms.canvas_course_id) return { courses: [], missing: mapped ? [] : [""] };
  return null;
};

/**
 * Per block of the run's scheme: `kinds` (its own members), `parts` (every
 * member below it, for the bar), `from`/`to` (the due dates it spans),
 * `marked`/`total` and `canvas`. Null when the run has no scheme.
 *
 * `assessments` are the run's; `graded` the ids with at least one mark decided.
 */
export const schemeFacts = ({ run, assessments, graded = new Set() }) => {
  const components = run?.grading_scheme?.components ?? [];
  if (!components.length) return null;
  const childrenOf = (id) => components.filter((c) => c.parent === id);
  const membersOf = (id) => assessments.filter((a) => a.component === id);
  const deepMembers = (id) => [...membersOf(id), ...childrenOf(id).flatMap((child) => deepMembers(child.component_id))];
  const blocks = {};
  for (const component of components) {
    const id = component.component_id;
    const all = deepMembers(id);
    const dated = all.map((a) => a.due_at).filter(Boolean).sort();
    blocks[id] = {
      kinds: kindsIn(membersOf(id)),
      parts: kindsIn(all).map(({ type, many, weight }) => ({ type, many, weight })),
      from: dated[0] ?? null,
      to: dated[dated.length - 1] ?? null,
      marked: all.filter((a) => graded.has(a.assessment_id)).length,
      total: all.length,
      canvas: canvasOf(run, id),
    };
  }
  return blocks;
};
