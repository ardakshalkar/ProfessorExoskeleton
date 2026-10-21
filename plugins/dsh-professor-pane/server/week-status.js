/**
 * Where each piece of graded work stands, for course mode's chips.
 *
 * Course mode draws the term week by week; the pane's other windows â€” Grade,
 * Scans, the defence desk, Publish â€” each know one thing about an assessment
 * that belongs on its week. This gathers those facts, one entry per
 * assessment, from the same readers those windows use, so the chip and the
 * window it opens never disagree:
 *
 * * **grading** â€” the Grade view's own board (`gradeBoard`): answers with a
 *   suggestion, and answers the professor has decided.
 * * **canvas** â€” whether the Canvas courses this run sends to have an
 *   assignment for it, as Tasks Â· Unpublished reads it (`canvasBinding`).
 * * **repo** â€” starter-repository work with no repository recorded, as the
 *   Assessments tab reads it.
 * * **scans** â€” a paper pile's step in words, the Scans tab's pile list
 *   (`scanPiles`).
 * * **defences** â€” how many of the students who handed in a repository have
 *   been defended (a recorded answer not withdrawn), and whose desk to open.
 *
 * Private, like Teaching's figures: course mode asks for it only outside
 * Preview as student. Pseudonyms only â€” a page in this pane carries no name.
 * Every section is read on its own; one that cannot be read is left out
 * rather than failing the page.
 */

import { runById } from "@ainar/core/src/bundle.ts";
import { defencePlace, readDefence, readSession } from "@ainar/core/src/defence.ts";
import { gradeBoard } from "@ainar/core/src/grade-board.ts";
import { scanPlace } from "@ainar/core/src/scans.ts";

import { STEP_PROMPTS } from "../shared/course-words.js";

import { isRepoWork } from "./course-views.js";
import { scanPiles } from "./scans.js";
import { canvasBinding } from "./unpublished.js";

const attempt = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

/** Answers suggested and decided across the written questions, or null when grading has not begun. */
const gradingOf = (bundle, runId, assessmentId, submissions) => {
  if (!submissions) return null;
  const board = gradeBoard({ bundle, runId, assessmentId, place: scanPlace(submissions, runId, assessmentId) });
  if (!board.items.length) return null;
  const answers = board.items.flatMap((item) => item.answers);
  // A blank answer is suggested a zero before anybody grades: not a start.
  const begun = answers.some((answer) => answer.decision || (answer.suggestion && answer.suggestion.source !== "blank"));
  if (!begun) return null;
  return {
    suggested: board.items.reduce((sum, item) => sum + item.counts.suggested, 0),
    decided: board.totals.decided,
  };
};

/**
 * The defences of one assessment, or null when none has been prepared or marked.
 * The professor's word on a submission (`defence: defended | not_defended`)
 * wins; without it, a recorded answer that was not withdrawn counts as held.
 */
const defencesOf = (bundle, root, runId, assessmentId, submissions) => {
  if (!submissions) return null;
  const latest = new Map();
  for (const entry of bundle.submissions ?? []) {
    if (entry.assessment_id !== assessmentId || (!entry.url && !entry.defence)) continue;
    const before = latest.get(entry.student_id);
    if (!before || (entry.attempt ?? 1) > (before.attempt ?? 1)) latest.set(entry.student_id, entry);
  }
  let prepared = 0;
  let defended = 0;
  let marked = 0;
  let next = null;
  let first = null;
  for (const student of [...latest.keys()].sort()) {
    const place = defencePlace(submissions, root, runId, assessmentId, student);
    const questions = attempt(() => readDefence(place.questions));
    const session = attempt(() => readSession(place.session));
    const said = latest.get(student).defence;
    const done = said ? said === "defended" : Boolean(session && session.answers.some((answer) => !answer.withdrawn));
    if (done) defended += 1;
    if (said) marked += 1;
    if (!questions || !Array.isArray(questions.questions) || !questions.questions.length) continue;
    prepared += 1;
    first ??= student;
    // A "not defended" is settled too: the next one to hold is one with no word.
    if (!done && !said) next ??= student;
  }
  if (!prepared && !defended && !marked) return null;
  return { defended, of: latest.size, prepared, student: next ?? first };
};

/**
 * Work sat on paper: said so by `delivery`, or a quiz or an exam that says
 * nothing about how it arrives — the CSS-4007 quizzes record no delivery.
 */
const onPaper = (assessment) =>
  assessment.delivery ? assessment.delivery === "paper_exam" : assessment.type === "quiz" || assessment.type === "exam";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Whether its week has come, so a pile could exist. Undated work has. */
const weekCome = (assessment, now) => {
  const at = Date.parse(assessment.opens_at ?? assessment.due_at ?? "");
  return Number.isNaN(at) || at <= now + WEEK;
};

/**
 * The press that makes a pile's step, in words: where the Scans tab's step
 * would send the professor, or what it would ask the assistant. `scans`
 * opens the pile on its step, `grade` the Grade view, `ask` the chat.
 */
const actOf = (step, runId, id) => {
  if (step.whose === "assistant" && step.ask && STEP_PROMPTS[step.ask]) {
    return { kind: "ask", label: "Ask the assistant", prompt: STEP_PROMPTS[step.ask](runId, id) };
  }
  switch (step.action) {
    case "match":
      return { kind: "scans", label: "Place papers" };
    case "read":
      return { kind: "scans", label: "Read & record" };
    case "grade":
      return { kind: "grade", label: "Grade" };
    case "canvas":
      return { kind: "scans", label: "Send marks" };
    default:
      return null;
  }
};

/** A pile as its week shows it: the step strip, the phrase, and the press. */
const scansOf = (pile, standing, runId, id) => ({
  phrase: pile.now.phrase,
  whose: pile.now.whose,
  steps: standing ? standing.stages.map(({ label, detail, state }) => ({ label, detail, state })) : [],
  act: actOf(pile.now, runId, id),
});

/**
 * `{ [assessment_id]: { grading, canvas, repo, scans, defences } }` for the
 * run's assessments. `submissions` is the private folder, or null when it
 * cannot be resolved â€” then only the record's own facts are given.
 */
export const assessmentStatus = ({ bundle, runId, root, submissions, ledger, now = Date.now() }) => {
  const run = runById(bundle).get(runId) ?? {};
  const found = submissions ? attempt(() => scanPiles({ bundle, runId, submissions, ledger })) : null;
  const piles = found?.piles ?? [];
  const status = {};
  for (const assessment of bundle.assessments.filter((entry) => entry.course_version_id === runId)) {
    const id = assessment.assessment_id;
    const draft = assessment.approval === "draft";
    const binding = attempt(() => canvasBinding(run, assessment));
    const pile = piles.find((entry) => entry.id === id);
    status[id] = {
      grading: attempt(() => gradingOf(bundle, runId, id, submissions)),
      // Publishing leaves a draft out, so a draft is offered no publish.
      canvas: !draft && binding && (binding.state === "none" || binding.state === "some") ? binding.state : null,
      repo: !draft && isRepoWork(assessment) && !assessment.extensions?.github?.template_repo,
      scans:
        pile && pile.now
          ? scansOf(pile, found.standings.get(id), runId, id)
          : onPaper(assessment) && weekCome(assessment, now)
            ? { none: true }
            : null,
      defences: attempt(() => defencesOf(bundle, root, runId, id, submissions)),
    };
  }
  return status;
};
