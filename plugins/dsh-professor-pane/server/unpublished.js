/**
 * What the course holds that the people outside this machine do not have yet.
 *
 * Two places in the pane ask it. **Progress · Gradebook** draws one line per
 * assessment — how far the marking has got and how much of it Canvas has — and
 * **Tasks · Unpublished** draws the list of everything still to send: marks not
 * in Canvas, marks with nowhere to go because no Canvas assignment is bound,
 * drafts a publication would leave out, and materials changed since they were
 * last published.
 *
 * Everything here is read off this machine. The gradebook from approved
 * decisions; "in Canvas" from the sync ledger, which `lms push --target
 * canvas-api` writes only once Canvas reports the job done; "changed since
 * published" from the checksums `ainar publish` kept of what it sent. Drawing
 * either view asks Canvas nothing, so it is honest about what was confirmed and
 * silent about anything somebody changed in Canvas by hand — `lms diff` is the
 * question for that.
 */

import { approvedView } from "@ainar/core/src/approval.ts";
import { runById } from "@ainar/core/src/bundle.ts";
import { fingerprints } from "@ainar/core/src/freshness.ts";
import { gradebookPayload } from "@ainar/core/src/gradebook.ts";
import { unpublishedDrafts } from "@ainar/core/src/publish.ts";

import { canvasMarks } from "./scans.js";

const lms = (record) => {
  const found = record?.extensions?.lms;
  return found && typeof found === "object" && !Array.isArray(found) ? found : {};
};

/**
 * Whether each Canvas course this run sends to has an assignment for the
 * assessment: `all`, `some` (with the subgroups missing), `none`, or null
 * for a run with no Canvas course at all, where the question does not arise.
 */
const canvasBinding = (run, assessment) => {
  const courses = lms(run).canvas_courses;
  const groups = courses && typeof courses === "object" && !Array.isArray(courses) ? Object.keys(courses).sort() : [];
  if (groups.length) {
    const bound = lms(assessment).canvas_assignments ?? {};
    const missing = groups.filter((group) => !String(bound[group] ?? "").trim());
    return { state: missing.length === 0 ? "all" : missing.length === groups.length ? "none" : "some", missing };
  }
  if (!String(lms(run).canvas_course_id ?? run?.canvas_course_id ?? "").trim()) return { state: null, missing: [] };
  return String(lms(assessment).canvas_assignment_id ?? "").trim() ? { state: "all", missing: [] } : { state: "none", missing: [] };
};

/**
 * Materials whose file has moved since a publication sent it: one entry per
 * material per destination, oldest publication first.
 */
const movedSincePublished = (bundle, runId, root, ledger) => {
  const publications = Object.entries(ledger.publications ?? {}).filter(([, entry]) => Object.keys(entry.materials ?? {}).length);
  if (!publications.length) return [];
  const now = new Map(fingerprints(bundle, runId, root).map((print) => [print.documentId, print]));
  const moved = [];
  for (const [key, entry] of publications.sort(([, a], [, b]) => String(a.at).localeCompare(String(b.at)))) {
    const [target, scope] = key.split("|");
    for (const [documentId, checksum] of Object.entries(entry.materials)) {
      const print = now.get(documentId);
      if (!print || print.actual === checksum) continue;
      moved.push({ documentId, title: print.title, target, scope, where: entry.where, at: entry.at });
    }
  }
  return moved;
};

/**
 * The document both views draw. `bundle` is the whole course, drafts included:
 * the gradebook and the marks read its approved view, and the drafts list is
 * the half that is not.
 */
export const unpublishedDocument = ({ bundle, runId, root, ledger }) => {
  const run = runById(bundle).get(runId) ?? {};
  const book = gradebookPayload(approvedView(bundle), runId, {});
  const records = new Map(bundle.assessments.map((entry) => [entry.assessment_id, entry]));

  const assessments = (book.assessments ?? []).map((entry) => {
    const summary = entry.summary ?? {};
    const canvas = canvasMarks({ bundle, runId, assessmentId: entry.assessment_id, ledger });
    return {
      id: entry.assessment_id,
      title: entry.title ?? entry.assessment_id,
      type: entry.type ?? null,
      weight: entry.weight ?? null,
      due_at: entry.due_at ?? null,
      enrolled: summary.enrolled ?? 0,
      submitted: summary.submitted ?? 0,
      graded: summary.graded ?? 0,
      partial: summary.partially_graded ?? 0,
      canvas,
      binding: canvasBinding(run, records.get(entry.assessment_id)),
    };
  });

  const marks = assessments.filter((entry) => entry.canvas.unsent > 0 || entry.canvas.changed > 0);
  return {
    run: runId,
    assessments,
    marks,
    // Marks that cannot be sent at all yet: whole marks, and a Canvas course
    // with no assignment to put them in.
    unbound: marks.filter((entry) => entry.binding.state === "none" || entry.binding.state === "some").map((entry) => entry.id),
    drafts: unpublishedDrafts(bundle, runId),
    moved: movedSincePublished(bundle, runId, root, ledger),
  };
};
