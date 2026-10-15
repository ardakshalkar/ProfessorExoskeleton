/**
 * Changing how a run's grade is divided, and knowing what the change does
 * before it is made.
 *
 * A grading policy is the run's `grading_scheme` plus the two fields each
 * assessment carries into it — `component` and `weight`. Changing it is not
 * like moving a date: a mark recorded out of 4 is sent to Canvas out of 13.33
 * because ВСК1 is out of 100, every student's block totals move, and a
 * component with no Canvas assignment group leaves its work with nowhere to
 * go. So the change comes in three steps, and this module is the first two:
 *
 * 1. **A proposal** — the whole policy as it should be (`Proposal`), built by
 *    hand in the pane or from a preset (`PRESETS`, `fromPreset`).
 * 2. **Its impact** (`policyImpact`) — the same course with the proposal in
 *    place of the policy, totalled by the same gradebook, scaled by the same
 *    `lmsScale`, checked by the same validator, and compared. Nothing here is
 *    judgement; what a change means for a brief that says "10% of the final
 *    grade" is the session's to read, not this module's.
 * 3. **The write** — the pane's (`grading-writes.js`), which refuses a
 *    proposal made against a policy that has changed since (`policyBase`) and
 *    keeps what it replaced in `grading_scheme.extensions.history`.
 *
 * WHY PRESETS ARE STRUCTURES, NOT NUMBERS
 * ---------------------------------------
 * Institutions divide a grade in a handful of shapes: by period (Narxoz's
 * ВСК1 / ВСК2 / Final), by kind of work (homework / quizzes / exams), both at
 * once (each ВСК holding its own homework and quiz blocks), or with a gate
 * (Kazakhstan's admission rating: РК1 and РК2 together are 60%, the exam
 * 40%). A preset is one of those shapes with typical weights, plus a rule for
 * which existing assessment goes where — so choosing one re-files the course
 * rather than leaving every assessment unassigned. The weights are a starting
 * point the professor edits; the impact says what they would do.
 */

import { createHash } from "node:crypto";

import { approvedView } from "./approval.ts";
import { assessmentsOf, runById, type CourseBundle } from "./bundle.ts";
import { gradebookPayload } from "./gradebook.ts";
import { roundHalfEven } from "./grading.ts";
import { IssueList } from "./issues.ts";
import { lmsScale } from "./lms-scale.ts";
import { activeProfile } from "./profile.ts";
import { gradingSchemeIssues } from "./validate.ts";

const COMPONENT_ID = /^[A-Z][A-Z0-9-]{0,31}$/;
const CLOSE = 0.001;

export interface PolicyComponent {
  component_id: string;
  title: string;
  weight: number;
  parent: string | null;
  points: number | null;
}

export interface Proposal {
  components: PolicyComponent[];
  points: number | null;
  /** Per assessment id: the block it counts in and its share of the whole grade. */
  assignments: Record<string, { component: string | null; weight: number | null }>;
}

// ---------------------------------------------------------------- presets

/**
 * Which assessments a preset's block takes. `same` names the blocks of other
 * structures it stands for — РК 1 is what ВСК 1 is called elsewhere — so work
 * the professor already filed keeps its place; `types`, `half` and `final` are
 * the rule for everything else.
 */
interface Takes {
  same?: string[];
  types?: string[];
  half?: 1 | 2;
  final?: boolean;
}

interface PresetComponent extends PolicyComponent {
  takes?: Takes;
}

export interface Preset {
  id: string;
  title: string;
  /** The shape: by period, by kind, both, a gated rating, or none. */
  family: "period" | "category" | "hybrid" | "admission" | "flat";
  summary: string;
  points: number | null;
  components: PresetComponent[];
}

/**
 * The structures on offer, from the profile (`grading.presets`): the system
 * layer ships the neutral ones, an institution pack adds its own (Narxoz's
 * ВСК and admission-rating shapes live in `profiles/narxoz.yaml`).
 */
export const presets = (): Preset[] => activeProfile().grading.presets as unknown as Preset[];

/** Compiled once per list of matchers, which is the profile's and rarely changes. */
const matcherCache = new WeakMap<string[], RegExp>();

/** Whether an assessment is the final, by the profile's `grading.final_matchers`. */
const isFinal = (assessment: any): boolean => {
  const sources = activeProfile().grading.final_matchers;
  let matcher = matcherCache.get(sources);
  if (!matcher) {
    matcher = new RegExp(sources.map((source) => `(?:${source})`).join("|") || "$^", "i");
    matcherCache.set(sources, matcher);
  }
  return matcher.test(`${assessment.assessment_id} ${assessment.title ?? ""}`);
};

/**
 * Where the first half of the term ends: at the first midterm, when the run
 * has one — ВСК 1 closes with Midterm 1, whatever the calendar's middle is —
 * and at the calendar's middle otherwise.
 */
const boundaryOf = (run: any, assessments: readonly any[]): number => {
  const midterm = activeProfile().grading.period_boundary !== "first_midterm" ? undefined : assessments
    .filter((entry) => entry.type === "exam" && !isFinal(entry) && entry.due_at)
    .map((entry) => Date.parse(String(entry.due_at)))
    .filter(Number.isFinite)
    .sort((a, c) => a - c)[0];
  if (midterm !== undefined) return midterm;
  const start = Date.parse(`${run.start_date}T00:00:00Z`);
  const end = Date.parse(`${run.end_date}T23:59:59Z`);
  return start + (end - start) / 2;
};

/** Which half an assessment falls in; null for undated work, which no date rule can place. */
const halfOf = (boundary: number, assessment: any): 1 | 2 | null => {
  const due = assessment.due_at ? Date.parse(String(assessment.due_at)) : NaN;
  if (!Number.isFinite(due) || !Number.isFinite(boundary)) return null;
  return due <= boundary ? 1 : 2;
};

const takes = (rule: Takes | undefined, boundary: number, assessment: any, { ignoreHalf = false } = {}): boolean => {
  if (!rule) return false;
  if (rule.final) return isFinal(assessment);
  if (!rule.types && !rule.half) return false;
  if (isFinal(assessment)) return false;
  if (rule.types && !rule.types.includes(assessment.type)) return false;
  if (rule.half && !ignoreHalf && halfOf(boundary, assessment) !== rule.half) return false;
  return true;
};

// ---------------------------------------------------------------- reading

const plainComponent = (component: any): PolicyComponent => ({
  component_id: String(component.component_id),
  title: String(component.title ?? component.component_id),
  weight: Number(component.weight ?? 0),
  parent: component.parent ? String(component.parent) : null,
  points: component.points == null ? null : Number(component.points),
});

/** The policy as it stands, in the shape a proposal takes. */
export const currentProposal = (bundle: CourseBundle, runId: string): Proposal => {
  const run = runById(bundle).get(runId) as any;
  const scheme = run?.grading_scheme ?? null;
  const assignments: Proposal["assignments"] = {};
  for (const assessment of assessmentsOf(bundle, runId)) {
    assignments[assessment.assessment_id] = {
      component: assessment.component ?? null,
      weight: assessment.weight ?? null,
    };
  }
  return {
    components: ((scheme?.components ?? []) as any[]).map(plainComponent),
    points: scheme?.points ?? null,
    assignments,
  };
};

/**
 * A fingerprint of the policy a proposal was made against. The write refuses
 * a proposal whose base is not the policy on disk — two windows, or the
 * session editing the YAML in between, and the later press would silently
 * undo the earlier change.
 */
export const policyBase = (bundle: CourseBundle, runId: string): string => {
  const current = currentProposal(bundle, runId);
  const ordered = Object.keys(current.assignments)
    .sort()
    .map((id) => [id, current.assignments[id]!.component, current.assignments[id]!.weight]);
  return createHash("sha256")
    .update(JSON.stringify([current.components, current.points, ordered]))
    .digest("hex")
    .slice(0, 16);
};

/** What the pane draws: the policy, every assessment in the run, the presets, the lock and the history. */
export const policyDocument = (bundle: CourseBundle, runId: string) => {
  const run = runById(bundle).get(runId) as any;
  if (!run) throw new Error(`no course run '${runId}'`);
  const scheme = run.grading_scheme ?? null;
  const boundary = boundaryOf(run, assessmentsOf(bundle, runId));
  const approvedIds = new Set(assessmentsOf(approvedView(bundle), runId).map((entry) => entry.assessment_id));
  const assessments = assessmentsOf(bundle, runId).map((entry) => ({
    assessment_id: entry.assessment_id,
    title: entry.title ?? entry.assessment_id,
    type: entry.type ?? null,
    due_at: entry.due_at ?? null,
    maximum_score: entry.maximum_score ?? null,
    draft: !approvedIds.has(entry.assessment_id),
    half: halfOf(boundary, entry),
  }));
  const groups = run.extensions?.lms?.canvas_assignment_groups ?? {};
  return {
    run: runId,
    start_date: run.start_date,
    end_date: run.end_date,
    has_scheme: Boolean(scheme),
    description: scheme?.description ?? null,
    locked: scheme?.locked === true,
    policy: currentProposal(bundle, runId),
    base: policyBase(bundle, runId),
    assessments: assessments.sort(
      (a, c) => String(a.due_at ?? "9999").localeCompare(String(c.due_at ?? "9999")) || a.assessment_id.localeCompare(c.assessment_id),
    ),
    canvas_groups: Object.keys(groups),
    presets: presets().map(({ components, ...rest }) => ({
      ...rest,
      components: components.map(({ takes: _rule, ...component }) => component),
    })),
    history: historyOf(scheme),
    issues: issuesOf(run, assessmentsOf(bundle, runId)),
  };
};

const historyOf = (scheme: any): any[] => {
  const list = scheme?.extensions?.history;
  return Array.isArray(list) ? [...list].reverse() : [];
};

const issuesOf = (run: any, assessments: any[]) => {
  const issues = new IssueList();
  gradingSchemeIssues(run, assessments, issues);
  return issues.items;
};

// ---------------------------------------------------------------- building

/**
 * A preset laid over the course: its blocks, and every assessment re-filed by
 * the preset's rule. Within each block that takes work, the members keep their
 * relative weights and are scaled to what the block leaves after its sub-blocks
 * — a 4% homework stays four times a 1% quiz — and a block whose members carry
 * no weight yet splits it evenly. Work no block takes stays unfiled, so the
 * impact names it rather than a guess hiding it.
 */
export const fromPreset = (bundle: CourseBundle, runId: string, presetId: string): Proposal => {
  const preset = presets().find((entry) => entry.id === presetId);
  if (!preset) throw new Error(`no preset '${presetId}'`);
  const run = runById(bundle).get(runId) as any;
  const current = currentProposal(bundle, runId);
  const assessments = assessmentsOf(bundle, runId);
  const assignments: Proposal["assignments"] = {};

  if (!preset.components.length) {
    for (const assessment of assessments) {
      assignments[assessment.assessment_id] = { component: null, weight: current.assignments[assessment.assessment_id]?.weight ?? null };
    }
    return { components: [], points: preset.points, assignments };
  }

  const boundary = boundaryOf(run, assessments);
  const parentNow = new Map(current.components.map((c) => [c.component_id, c.parent]));
  const presetIds = new Set(preset.components.map((c) => c.component_id));
  // The preset's block a current block id stands for: itself, or the one naming it in `same`.
  const counterpart = (id: string): string | null =>
    presetIds.has(id) ? id : (preset.components.find((c) => c.takes?.same?.includes(id))?.component_id ?? null);
  const within = (root: string) => {
    const out = new Set([root]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of preset.components) if (c.parent && out.has(c.parent) && !out.has(c.component_id)) out.add(c.component_id), (grew = true);
    }
    return preset.components.filter((c) => out.has(c.component_id));
  };
  const leaf = (c: PresetComponent) => !preset.components.some((child) => child.parent === c.component_id);
  const placeOf = (assessment: any): PresetComponent | undefined => {
    // Where the professor filed it, when this structure has that block or one standing for it:
    // the period is theirs, and only the kind is chosen inside it.
    const seen = new Set<string>();
    for (let at = current.assignments[assessment.assessment_id]?.component ?? null; at && !seen.has(at); at = parentNow.get(at) ?? null) {
      seen.add(at);
      const anchor = counterpart(at);
      if (!anchor) continue;
      const subtree = within(anchor);
      const byKind = subtree.find((c) => c.component_id !== anchor && leaf(c) && takes(c.takes, boundary, assessment, { ignoreHalf: true }));
      if (byKind) return byKind;
      const self = subtree.find((c) => c.component_id === anchor)!;
      return leaf(self) ? self : undefined;
    }
    return preset.components.find((component) => leaf(component) && takes(component.takes, boundary, assessment));
  };
  const into = new Map<string, any[]>();
  for (const assessment of assessments) {
    const home = placeOf(assessment);
    assignments[assessment.assessment_id] = {
      component: home?.component_id ?? null,
      weight: current.assignments[assessment.assessment_id]?.weight ?? null,
    };
    if (home) into.set(home.component_id, [...(into.get(home.component_id) ?? []), assessment]);
  }
  const components = preset.components.map(({ takes: _rule, ...component }) => component);
  spreadWeights(components, assignments, into);
  return { components, points: preset.points, assignments };
};

const spreadWeights = (
  components: PolicyComponent[],
  assignments: Proposal["assignments"],
  into: Map<string, any[]>,
): void => {
  for (const component of components) {
    const members = into.get(component.component_id) ?? [];
    if (!members.length) continue;
    const children = components.filter((child) => child.parent === component.component_id);
    const room = Math.max(0, component.weight - children.reduce((sum, child) => sum + child.weight, 0));
    const now = members.map((member) => Number(assignments[member.assessment_id]!.weight ?? 0));
    const sum = now.reduce((total, weight) => total + weight, 0);
    members.forEach((member, index) => {
      const share = sum > 0 ? (now[index]! / sum) * room : room / members.length;
      assignments[member.assessment_id]!.weight = roundHalfEven(share, 12);
    });
  }
};

/**
 * A proposal as it arrived from the page, checked field by field. Throws with
 * a sentence the professor can act on; everything the page did not send is
 * left as it is (an assessment not named keeps its block and weight).
 */
export const readProposal = (bundle: CourseBundle, runId: string, raw: any): Proposal => {
  if (!raw || typeof raw !== "object") throw new Error("No policy was sent.");
  const known = new Set(assessmentsOf(bundle, runId).map((entry) => entry.assessment_id as string));
  const components: PolicyComponent[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(raw.components) ? raw.components : []) {
    const id = String(entry?.component_id ?? "").trim().toUpperCase();
    if (!COMPONENT_ID.test(id)) throw new Error(`'${id || "(blank)"}' is not a block id: capitals, digits and dashes, starting with a letter.`);
    if (seen.has(id)) throw new Error(`${id} is named twice.`);
    seen.add(id);
    const weight = Number(entry.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error(`${id}'s weight must be between 0% and 100%.`);
    const points = entry.points === null || entry.points === undefined || entry.points === "" ? null : Number(entry.points);
    if (points !== null && !(points > 0)) throw new Error(`${id}'s points must be more than 0, or left empty.`);
    const title = String(entry.title ?? "").trim() || id;
    components.push({
      component_id: id,
      title,
      weight: roundHalfEven(weight, 12),
      parent: entry.parent ? String(entry.parent).trim().toUpperCase() : null,
      points,
    });
  }
  for (const component of components) {
    if (component.parent && !seen.has(component.parent)) throw new Error(`${component.component_id} sits inside ${component.parent}, which is not a block.`);
  }
  const current = currentProposal(bundle, runId);
  const assignments: Proposal["assignments"] = { ...current.assignments };
  for (const [id, value] of Object.entries((raw.assignments ?? {}) as Record<string, any>)) {
    if (!known.has(id)) throw new Error(`${id} is not an assessment of ${runId}.`);
    const component = value?.component ? String(value.component).trim().toUpperCase() : null;
    if (component && !seen.has(component)) throw new Error(`${id} is filed in ${component}, which is not a block.`);
    const weight = value?.weight === null || value?.weight === undefined || value?.weight === "" ? null : Number(value.weight);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1)) throw new Error(`${id}'s weight must be between 0% and 100%.`);
    assignments[id] = { component, weight: weight === null ? null : roundHalfEven(weight, 12) };
  }
  const points = raw.points === null || raw.points === undefined || raw.points === "" ? null : Number(raw.points);
  if (points !== null && !(points > 0)) throw new Error("The course's points must be more than 0, or left empty.");
  return { components, points, assignments };
};

/** The course with the proposal in place of its policy. A copy; the bundle given is not touched. */
export const withProposal = (bundle: CourseBundle, runId: string, proposal: Proposal): CourseBundle => {
  const copy = structuredClone(bundle) as any;
  const run = (copy.versions as any[]).find((entry) => entry.course_version_id === runId);
  const before = run.grading_scheme ?? {};
  run.grading_scheme =
    proposal.components.length || proposal.points != null || run.grading_scheme
      ? { ...before, components: proposal.components.map(stripped), points: proposal.points }
      : null;
  for (const assessment of copy.assessments as any[]) {
    if (assessment.course_version_id !== runId) continue;
    const next = proposal.assignments[assessment.assessment_id];
    if (!next) continue;
    assessment.component = next.component;
    assessment.weight = next.weight;
  }
  return copy;
};

/** A component as the record carries it: no nulls written for what is not stated. */
export const stripped = (component: PolicyComponent): Record<string, unknown> => {
  const out: Record<string, unknown> = { component_id: component.component_id, title: component.title, weight: component.weight };
  if (component.parent) out.parent = component.parent;
  if (component.points != null) out.points = component.points;
  return out;
};

// ---------------------------------------------------------------- impact

/** At most six, then how many more: a summary line is read, not searched. */
const few = (list: string[]): string => (list.length > 6 ? `${list.slice(0, 6).join(", ")} and ${list.length - 6} more` : list.join(", "));

const pct = (value: number | null | undefined): string => (value == null ? "—" : `${roundHalfEven(value * 100, 2)}%`);

export interface ImpactOptions {
  /** Per assessment, how many marks Canvas has confirmed receiving (the sync ledger, which only the pane reads). */
  sent?: Map<string, number>;
}

/**
 * Everything the proposal changes that can be counted. Three readers: the
 * pane, which draws it; the write, which refuses a proposal whose impact has
 * structural errors; and the session, which is handed `summary` and reads the
 * course's prose for what a count cannot see.
 */
export const policyImpact = (bundle: CourseBundle, runId: string, proposal: Proposal, options: ImpactOptions = {}) => {
  const run = runById(bundle).get(runId) as any;
  if (!run) throw new Error(`no course run '${runId}'`);
  const before = currentProposal(bundle, runId);
  const after = withProposal(bundle, runId, proposal);
  const afterRun = runById(after).get(runId) as any;
  const titles = new Map(assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id as string, String(entry.title ?? entry.assessment_id)]));

  // Blocks.
  const oldBlocks = new Map(before.components.map((c) => [c.component_id, c]));
  const newBlocks = new Map(proposal.components.map((c) => [c.component_id, c]));
  const added = proposal.components.filter((c) => !oldBlocks.has(c.component_id)).map((c) => c.component_id);
  const removed = before.components.filter((c) => !newBlocks.has(c.component_id)).map((c) => c.component_id);
  const changed = proposal.components
    .filter((c) => oldBlocks.has(c.component_id))
    .map((c) => {
      const was = oldBlocks.get(c.component_id)!;
      const fields: string[] = [];
      if (Math.abs(was.weight - c.weight) > 1e-9) fields.push(`weight ${pct(was.weight)} → ${pct(c.weight)}`);
      if ((was.parent ?? null) !== (c.parent ?? null)) fields.push(`inside ${was.parent ?? "nothing"} → ${c.parent ?? "nothing"}`);
      if ((was.points ?? null) !== (c.points ?? null)) fields.push(`out of ${was.points ?? "—"} → ${c.points ?? "—"}`);
      if (was.title !== c.title) fields.push(`renamed "${was.title}" → "${c.title}"`);
      return { component_id: c.component_id, fields };
    })
    .filter((entry) => entry.fields.length);

  // Assessments.
  const moved: any[] = [];
  const reweighted: any[] = [];
  for (const [id, next] of Object.entries(proposal.assignments)) {
    const was = before.assignments[id];
    if (!was) continue;
    if ((was.component ?? null) !== (next.component ?? null)) moved.push({ assessment_id: id, title: titles.get(id), from: was.component, to: next.component });
    if (Math.abs(Number(was.weight ?? -1) - Number(next.weight ?? -1)) > 1e-9) reweighted.push({ assessment_id: id, title: titles.get(id), from: was.weight, to: next.weight });
  }

  // Checks, before and after: what the validator says now, and what it would.
  const issuesBefore = issuesOf(run, assessmentsOf(bundle, runId));
  const issuesAfter = issuesOf(afterRun, assessmentsOf(after, runId));
  const sig = (issue: any) => `${issue.code}|${issue.location}|${issue.message}`;
  const beforeSigs = new Set(issuesBefore.map(sig));
  const afterSigs = new Set(issuesAfter.map(sig));

  // The LMS: what each assessment is out of there, now and after.
  const sent = options.sent ?? new Map<string, number>();
  const peersBefore = assessmentsOf(bundle, runId);
  const peersAfter = assessmentsOf(after, runId);
  const lms = peersAfter
    .map((assessment) => {
      const was = peersBefore.find((entry) => entry.assessment_id === assessment.assessment_id);
      const old = lmsScale(run, was, peersBefore);
      const now = lmsScale(afterRun, assessment, peersAfter);
      return {
        assessment_id: assessment.assessment_id,
        title: titles.get(assessment.assessment_id),
        from: old.problem ? null : old.maximum,
        to: now.problem ? null : now.maximum,
        problem: now.problem,
        sent: sent.get(assessment.assessment_id) ?? 0,
      };
    })
    .filter((entry) => entry.from !== entry.to && !(entry.from != null && entry.to != null && Math.abs(entry.from - entry.to) < 1e-6));

  // Canvas assignment groups: a block that work names directly needs one per Canvas course.
  const groups = run.extensions?.lms?.canvas_assignment_groups ?? {};
  const canvasCourses = Object.keys(run.extensions?.lms?.canvas_courses ?? {});
  const hasCanvas = canvasCourses.length > 0 || Boolean(run.extensions?.lms?.canvas_course_id);
  const named = new Set(Object.values(proposal.assignments).map((entry) => entry.component).filter(Boolean) as string[]);
  const needsGroup = hasCanvas ? [...named].filter((id) => !groups[id]) : [];
  const orphanGroups = Object.keys(groups).filter((id) => !newBlocks.has(id));

  // Students: the same gradebook on both courses, approved records only.
  const totalsOf = (b: CourseBundle) => {
    const book = gradebookPayload(approvedView(b), runId, {}) as any;
    return new Map(((book.totals ?? []) as any[]).map((entry) => [entry.student_id as string, entry]));
  };
  const oldTotals = totalsOf(bundle);
  const newTotals = totalsOf(after);
  const students: any[] = [];
  for (const [student, now] of newTotals) {
    const was = oldTotals.get(student);
    const delta = (now.earned_weighted ?? 0) - (was?.earned_weighted ?? 0);
    const blocks = ((now.components ?? []) as any[]).map((component) => {
      const old = ((was?.components ?? []) as any[]).find((entry) => entry.component_id === component.component_id);
      return {
        component_id: component.component_id,
        from: old?.score ?? (old ? roundHalfEven(old.earned_weighted * 100, 2) : null),
        to: component.score ?? roundHalfEven(component.earned_weighted * 100, 2),
        out_of: component.points ?? null,
      };
    });
    const blockMoved = blocks.some((entry) => entry.from !== null && Math.abs((entry.to ?? 0) - entry.from) >= 0.01);
    if (Math.abs(delta) < 0.00005 && !blockMoved) continue;
    students.push({
      student_id: student,
      from: was ? roundHalfEven(was.earned_weighted * 100, 2) : null,
      to: roundHalfEven(now.earned_weighted * 100, 2),
      delta: roundHalfEven(delta * 100, 2),
      blocks,
    });
  }
  students.sort((a, c) => Math.abs(c.delta) - Math.abs(a.delta) || a.student_id.localeCompare(c.student_id));

  // A block with no sub-blocks and no work holds a share of the grade nobody can earn.
  const empty = proposal.components
    .filter((c) => c.weight > 0 && !proposal.components.some((child) => child.parent === c.component_id) && !named.has(c.component_id))
    .map((c) => c.component_id);

  const sentAffected = lms.filter((entry) => entry.sent > 0);
  const errors = issuesAfter.filter((issue) => issue.level === "error");
  const topSum = proposal.components.filter((c) => !c.parent).reduce((sum, c) => sum + c.weight, 0);
  const flatSum = Object.values(proposal.assignments).reduce((sum, entry) => sum + Number(entry.weight ?? 0), 0);

  const summary: string[] = [];
  if (added.length) summary.push(`New blocks: ${added.join(", ")}.`);
  if (removed.length) summary.push(`Removed blocks: ${removed.join(", ")}.`);
  for (const entry of changed) summary.push(`${entry.component_id}: ${entry.fields.join("; ")}.`);
  if (moved.length) summary.push(`${moved.length} assessment(s) change block: ${few(moved.map((m) => `${m.assessment_id} ${m.from ?? "none"}→${m.to ?? "none"}`))}.`);
  if (reweighted.length) summary.push(`${reweighted.length} weight(s) change: ${few(reweighted.map((r) => `${r.assessment_id} ${pct(r.from)}→${pct(r.to)}`))}.`);
  if (lms.length) summary.push(`${lms.length} assessment(s) are out of a different number in the LMS${sentAffected.length ? `; ${sentAffected.length} already have marks in Canvas that would need sending again (${sentAffected.map((e) => e.assessment_id).join(", ")})` : ""}.`);
  if (empty.length) summary.push(`Blocks with no work in them, so their share cannot be earned: ${empty.join(", ")}.`);
  if (needsGroup.length) summary.push(`Needs a Canvas assignment group: ${needsGroup.join(", ")}.`);
  if (orphanGroups.length) summary.push(`Canvas groups left without a block: ${orphanGroups.join(", ")}.`);
  if (run.grading_scheme?.description && (added.length || removed.length || changed.length)) {
    summary.push("The policy's written description is kept as it is and may no longer match.");
  }
  if (students.length) summary.push(`${students.length} student(s)' running totals change; the largest move is ${students[0].delta > 0 ? "+" : ""}${students[0].delta} points of 100.`);
  if (!summary.length) summary.push("Nothing changes.");

  // What the write asks the professor to acknowledge: a total moves, Canvas has marks
  // on a changed scale, or the structure Canvas groups hang on changes.
  const weighty = students.length > 0 || sentAffected.length > 0 || removed.length > 0 || needsGroup.length > 0 || orphanGroups.length > 0;

  return {
    run: runId,
    base: policyBase(bundle, runId),
    weighty,
    nothing: !added.length && !removed.length && !changed.length && !moved.length && !reweighted.length && proposal.points === before.points,
    sums: { top: roundHalfEven(topSum, 6), flat: roundHalfEven(flatSum, 6), balanced: proposal.components.length ? Math.abs(topSum - 1) <= CLOSE : Math.abs(flatSum - 1) <= CLOSE },
    blocks: { added, removed, changed, empty },
    moved,
    reweighted,
    issues: {
      after: issuesAfter,
      fixed: issuesBefore.filter((issue) => !afterSigs.has(sig(issue))),
      introduced: issuesAfter.filter((issue) => !beforeSigs.has(sig(issue))),
    },
    errors,
    lms,
    canvas: { needs_group: needsGroup, orphan_groups: orphanGroups, resend: sentAffected.map((entry) => entry.assessment_id) },
    students: { changed: students.length, of: newTotals.size, rows: students.slice(0, 60) },
    summary,
  };
};

/** The state a write replaces, kept in the scheme's history so the change can be read back and undone. */
export const historyEntry = (
  bundle: CourseBundle,
  runId: string,
  {
    at,
    action,
    summary,
    by = null,
  }: { at: string; action: "change" | "lock" | "unlock"; summary: string[]; by?: string | null },
) => {
  const before = currentProposal(bundle, runId);
  const entry: Record<string, unknown> = { at, action, summary };
  if (by) entry.by = by;
  if (action === "change") {
    entry.before = {
      components: before.components.map(stripped),
      points: before.points,
      assignments: before.assignments,
    };
  }
  return entry;
};
