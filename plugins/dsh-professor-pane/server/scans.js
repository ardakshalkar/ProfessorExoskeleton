/**
 * Paper exams: what the Scans tab draws, and the one picture it shows.
 *
 * A scanned pile goes through seven steps — identify, match, read, rubric,
 * grade, approve, canvas — and each one is already a command (`ainar scans …`,
 * then the grading skills, then `ainar lms push`). What was missing is a place that says where a pile stands
 * and whose move it is, and a way to answer the one question only the
 * professor can: who is this paper. This module answers the first as a
 * document the browser half prints, and serves the evidence for the second —
 * the top of the paper's first page, where the name is written.
 *
 * Every figure is computed here, none in the browser half, which is the rule
 * the whole pane is held to. Nothing here writes: the routes that do spawn the
 * CLI (`scans assign`, `scans apply`), so a paper placed from the pane is
 * placed by exactly the rules a paper placed from a terminal is.
 *
 * Names: the written name and the roster name are only in the document when
 * the pane asks with `names=1`, exactly as the class list does. Without it a
 * card carries pseudonyms and no crop — the crop is the handwritten name.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { approvedView } from "@ainar/core/src/approval.ts";
import { enrolledIn } from "@ainar/core/src/bundle.ts";
import { exportable, gradeRows } from "@ainar/core/src/gradebook.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { RosterStore } from "@ainar/core/src/roster.ts";
import {
  nameCandidates,
  parsePages,
  readPlan,
  scanPlace,
  scanStatus,
  scanSubmissionId,
} from "@ainar/core/src/scans.ts";

const ID = /^[A-Z0-9][A-Z0-9-]*$/;

/** The assessments of a run that have a pile in the private folder. */
const pilesOf = (submissions, runId, assessments) => {
  const runDir = join(submissions, runId);
  if (!existsSync(runDir)) return [];
  return assessments
    .filter((entry) => existsSync(scanPlace(submissions, runId, entry.assessment_id).plan))
    .map((entry) => ({ id: entry.assessment_id, title: entry.title ?? entry.assessment_id }));
};

/** How many answers in this student's transcript were read with low confidence. */
const lowConfidence = (place, student) => {
  const path = join(place.base, student, "transcript.yaml");
  if (!existsSync(path)) return 0;
  try {
    const transcript = parseYaml(readFileSync(path, "utf-8")) ?? {};
    return (transcript.answers ?? []).filter((answer) => answer && answer.confidence === "low").length;
  } catch {
    return 0;
  }
};

/** A paper's page numbers, or none when the range cannot be read. */
const safePages = (pages) => {
  try {
    return parsePages(String(pages));
  } catch {
    return [];
  }
};

/** Which lane a planned paper sits in. */
const laneOf = (paper) => {
  if (paper.skip) return "skipped";
  if (paper.problem) return "held";
  if (paper.resolved && (paper.match === "close" || paper.match === "partial")) return "check";
  if (paper.resolved) return "placed";
  return "held"; // planned but never applied
};

/**
 * Where the marks stand against Canvas: how many are ready to send (a whole
 * score from approved decisions, as the gradebook exports it), and how many of
 * those Canvas has confirmed at the same value.
 *
 * Read from the sync ledger in `~/.ainar/sync/`, which `lms push --target
 * canvas-api` writes only after Canvas reports the job done — so drawing the
 * tab never asks Canvas anything, and "sent" means landed, not attempted.
 */
export const canvasMarks = ({ bundle, runId, assessmentId, ledger }) => {
  const rows = gradeRows(approvedView(bundle), runId, { assessmentId }).get(assessmentId) ?? [];
  const ready = rows.filter(exportable);
  const sent = ledger.prepared("canvas-api", assessmentId);
  let unsent = 0;
  let changed = 0;
  for (const row of ready) {
    const value = sent[row.student_id];
    if (value === undefined) unsent += 1;
    else if (Math.abs(value - row.score) > 1e-9) changed += 1;
  }
  return { ready: ready.length, sent: ready.length - unsent - changed, unsent, changed };
};

/**
 * Seven steps, each with how far it has got. `state` is done, current, waiting
 * (yours to decide) or todo; the first one not done is current.
 */
const stagesOf = ({ papers, status, assessment, rubric, items, responses, evaluations, low, canvas }) => {
  const placed = status.placed.length;
  const held = papers.filter((paper) => paper.lane === "held").length;
  const check = papers.filter((paper) => paper.lane === "check").length;
  const expected = placed * items;
  const graded = new Set(evaluations.map((entry) => entry.submission_id)).size;
  const decided = evaluations.filter((entry) => entry.professor_decision).length;
  // An inline rubric is accepted with its assessment: the word is on the assessment.
  const rubricState =
    rubric === null ? "none" : rubric.approval === "draft" || assessment.approval === "draft" ? "draft" : "accepted";

  const stages = [
    { id: "identify", label: "Identify", done: true, detail: assessment.title ?? assessment.assessment_id },
    {
      id: "match",
      label: "Match",
      done: held === 0 && check === 0 && papers.length > 0,
      waiting: held > 0 || check > 0,
      detail: `${placed} of ${papers.filter((paper) => paper.lane !== "skipped").length} placed` +
        (check ? ` · ${check} to check` : "") + (held ? ` · ${held} held` : ""),
    },
    {
      id: "read",
      label: "Read",
      done: placed > 0 && status.transcribed.length === placed && responses >= expected,
      detail: placed === 0
        ? "nothing placed yet"
        : `${status.transcribed.length} of ${placed} read · ${responses} of ${expected} answers recorded` +
          (low ? ` · ${low} low confidence` : ""),
    },
    {
      id: "rubric",
      label: "Rubric",
      done: rubricState === "accepted",
      waiting: rubricState === "draft",
      detail: rubricState === "accepted" ? "accepted" : rubricState === "draft" ? "proposed — your decision" : "not proposed",
    },
    {
      id: "grade",
      label: "Grade",
      done: placed > 0 && graded >= placed,
      detail: graded ? `${graded} of ${placed} papers` : "not started",
    },
    {
      id: "approve",
      label: "Approve",
      done: evaluations.length > 0 && decided === evaluations.length,
      waiting: evaluations.length > decided && evaluations.length > 0,
      detail: `${decided} of ${evaluations.length} decided`,
    },
    {
      id: "canvas",
      label: "Canvas",
      done: canvas.ready > 0 && canvas.unsent === 0 && canvas.changed === 0,
      waiting: canvas.unsent > 0 || canvas.changed > 0,
      detail:
        canvas.ready === 0
          ? "nothing to send yet"
          : canvas.unsent === 0 && canvas.changed === 0
            ? `${canvas.sent} of ${canvas.ready} sent`
            : [
                canvas.sent ? `${canvas.sent} sent` : null,
                canvas.unsent ? `${canvas.unsent} not sent` : null,
                canvas.changed ? `${canvas.changed} changed since sent` : null,
              ]
                .filter(Boolean)
                .join(" · "),
    },
  ];
  // A held paper waits for the professor, not the pile: once anything is
  // placed, the step after Match is the one to work on, and Match stays
  // marked as theirs. Quiz 2 of CSS-4007 sat with 49 papers placed and none
  // read because one clash kept Match current.
  const current = stages.findIndex((stage) => !stage.done && !(stage.id === "match" && placed > 0));
  return {
    stages: stages.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      detail: stage.detail,
      state: stage.done ? "done" : index === current ? (stage.waiting ? "yours" : "current") : stage.waiting ? "yours" : "todo",
    })),
    next: current === -1 ? null : stages[current].id,
    counts: {
      placed,
      held,
      check,
      read: status.transcribed.length,
      graded,
      decided,
      evaluations: evaluations.length,
      rubric: rubricState,
    },
  };
};

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * Where a pile stands, in words: the step to work on, a headline, one sentence
 * on why, whose move it is, and which action the tab offers for it. `phrase`
 * is the same thing in a few words, for the pile list. Every word is decided
 * here, so the browser half only places them.
 *
 * `whose` is `you`, `assistant` or `done`; `action` is `match` (the papers to
 * place), `read` (the Read & record button), `ask` (a one-line skill request,
 * `ask` naming which), `grade` (the Grade view), `canvas` (the send) or null.
 */
const nowOf = (next, counts, canvas) => {
  const index = STEP_IDS.indexOf(next);
  const step = (fields) => ({ step: next, index, total: STEP_IDS.length, ...fields });
  switch (next) {
    case "match": {
      const waiting = counts.held + counts.check;
      return step({
        title: counts.held ? `Say who ${plural(counts.held, "paper")} ${counts.held === 1 ? "is" : "are"}` : `Confirm ${plural(counts.check, "name match", "name matches")}`,
        body:
          counts.placed === 0
            ? "Nothing is placed yet. Each paper needs a student before it can be read."
            : `${plural(counts.placed, "paper")} placed. ` +
              [counts.held ? `${counts.held} held` : null, counts.check ? `${counts.check} placed on a weak match, to check` : null].filter(Boolean).join(", ") +
              ".",
        phrase: `${plural(waiting, "paper")} to place`,
        whose: "you",
        action: "match",
      });
    }
    case "read": {
      const unread = counts.placed - counts.read;
      return step({
        title: "Read and record the answers",
        body:
          `${plural(counts.placed, "paper")} placed, ${counts.read} read. One press reads the rest and records every answer as a draft.` +
          (counts.held + counts.check ? ` ${plural(counts.held + counts.check, "paper")} still ${counts.held + counts.check === 1 ? "waits" : "wait"} at Match.` : ""),
        phrase: unread > 0 ? `${plural(unread, "paper")} to read` : "Answers to record",
        whose: "you",
        action: "read",
      });
    }
    case "rubric":
      return counts.rubric === "draft"
        ? step({
            title: "Choose the rubric",
            body: "Proposals are ready. Compare them question by question in the Grade view, and accept one.",
            phrase: "Rubric to choose",
            whose: "you",
            action: "grade",
          })
        : step({
            title: "Propose a rubric",
            body: "The answers are recorded. The assistant groups what the class wrote and proposes rubrics for you to choose between.",
            phrase: "Rubric to propose",
            whose: "assistant",
            action: "ask",
            ask: "rubric",
          });
    case "grade":
      return step({
        title: "Grade the answers",
        body: `${counts.graded} of ${plural(counts.placed, "paper")} graded. Mark the groups in the Grade view; the assistant can suggest marks for the long answers.`,
        phrase: `${plural(counts.placed - counts.graded, "paper")} to grade`,
        whose: "you",
        action: "grade",
        ask: "grade",
      });
    case "approve":
      return step({
        title: "Decide the remaining answers",
        body: `${counts.decided} of ${plural(counts.evaluations, "answer")} decided. A mark reaches Canvas only once you have decided it.`,
        phrase: `${plural(counts.evaluations - counts.decided, "answer")} to decide`,
        whose: "you",
        action: "grade",
      });
    case "canvas": {
      const waiting = canvas.unsent + canvas.changed;
      return step({
        title: "Send the marks to Canvas",
        body:
          canvas.ready === 0
            ? "No mark is ready to send yet."
            : `Every answer is decided. ${plural(canvas.ready, "mark")} ready` +
              (canvas.sent ? `, ${canvas.sent} already in Canvas` : ", none sent yet") +
              (canvas.changed ? `, ${canvas.changed} changed since sent` : "") +
              ". Preview what Canvas would receive before anything leaves.",
        phrase: waiting ? `${plural(waiting, "mark")} not sent` : "Marks to send",
        whose: "you",
        action: "canvas",
      });
    }
    default:
      return {
        step: null,
        index: STEP_IDS.length,
        total: STEP_IDS.length,
        title: "Every step is done",
        body: `${plural(canvas.sent, "mark")} in Canvas, matching what the course records.`,
        phrase: "Marks in Canvas",
        whose: "done",
        action: null,
      };
  }
};

const STEP_IDS = ["identify", "match", "read", "rubric", "grade", "approve", "canvas"];

/**
 * Everything about one pile that its row and its steps need, without the
 * per-paper detail only the chosen pile shows.
 */
const standingOf = ({ bundle, runId, submissions, assessment, enrolled, ledger }) => {
  const id = assessment.assessment_id;
  const place = scanPlace(submissions, runId, id);
  const plan = readPlan(place);
  const status = scanStatus(place, enrolled);
  const lanes = (plan?.sources ?? []).flatMap((source) => (source.papers ?? []).map((paper) => ({ lane: laneOf(paper) })));
  const items = bundle.items.filter((item) => item.assessment_id === id).length;
  const ids = new Set(status.placed.map((student) => scanSubmissionId(student, id)));
  const responses = bundle.item_responses.filter((entry) => ids.has(entry.submission_id)).length;
  const evaluations = bundle.evaluations.filter((entry) => ids.has(entry.submission_id));
  const rubricId = assessment.rubric_id ?? assessment.rubric?.rubric_id ?? null;
  const rubric = rubricId ? (bundle.rubrics ?? []).find((entry) => entry.rubric_id === rubricId) ?? assessment.rubric ?? null : null;
  const low = status.placed.reduce((sum, student) => sum + lowConfidence(place, student), 0);
  const canvas = canvasMarks({ bundle, runId, assessmentId: id, ledger });
  const { stages, next, counts } = stagesOf({ papers: lanes, status, assessment, rubric, items, responses, evaluations, low, canvas });
  return { place, plan, status, items, responses, canvas, stages, next, now: nowOf(next, counts, canvas) };
};

/**
 * Everything the Scans tab draws for one run, as JSON.
 *
 * `loaded` is the run's course as the pane loads it (drafts included — a
 * placement is not a draft and neither is an answer read off paper, and the
 * professor is the reader here). `submissions` is the private folder.
 */
/**
 * Every pile of a run with where it stands, without any paper's detail: what
 * the Scans tab's pile list draws, and what course mode puts on an exam chip.
 */
export const scanPiles = ({ bundle, runId, submissions, ledger }) => {
  const assessments = bundle.assessments.filter((entry) => entry.course_version_id === runId);
  const enrolled = new Set(enrolledIn(bundle, runId).map((entry) => entry.student_id));
  // Every pile's standing, so the list says where each one is without opening
  // it: the dropdown this replaced hid that Quiz 1 had 61 marks unsent while
  // Quiz 2 was on screen.
  const found = pilesOf(submissions, runId, assessments);
  const standings = new Map(
    found.map((pile) => [
      pile.id,
      standingOf({ bundle, runId, submissions, assessment: assessments.find((entry) => entry.assessment_id === pile.id), enrolled, ledger }),
    ]),
  );
  const piles = found.map((pile) => {
    const standing = standings.get(pile.id);
    return { ...pile, now: standing.now, progress: standing.stages.map((stage) => stage.state) };
  });
  return { piles, standings, enrolled };
};

export const scansDocument = ({ loaded, runId, submissions, rosterDirectory, assessmentId, names, syncDirectory = null }) => {
  const bundle = loaded.bundle;
  const ledger = Ledger.load(runId, syncDirectory);
  const { piles, standings, enrolled } = scanPiles({ bundle, runId, submissions, ledger });
  const chosen = piles.find((pile) => pile.id === assessmentId) ?? piles[0] ?? null;
  const base = { run: runId, piles, names: names === true, crops: cropsAvailable() };
  if (!chosen) return { ...base, assessment: null };

  const standing = standings.get(chosen.id);
  const { plan, status, items, responses, canvas, stages } = standing;
  const store = RosterStore.load(rosterDirectory);
  const nameOf = (student) => (names && store.people[student]?.name ? String(store.people[student].name).trim() : null);

  const papers = [];
  for (const source of plan?.sources ?? []) {
    for (const paper of source.papers ?? []) {
      const lane = laneOf(paper);
      const entry = {
        file: source.file,
        pages: String(paper.pages),
        lane,
        written: names && paper.name ? String(paper.name) : null,
        also: names ? (paper.also ?? []).map(String) : [],
        has_name: Boolean(paper.name || paper.also?.length || paper.number),
        pinned: Boolean(paper.student),
        resolved: paper.resolved ?? null,
        resolved_name: paper.resolved ? nameOf(paper.resolved) : null,
        match: paper.match ?? null,
        problem: paper.problem ?? null,
        skip: paper.skip ?? null,
        note: names ? paper.note ?? null : null,
        not: paper.not ?? [],
        // Another paper resolves to the same student: each, with its pages, so
        // the two can be drawn side by side. Its own pages too, for the same.
        clash: (paper.clash ?? []).map((ref) => {
          const [clashFile, clashPages] = String(ref).split("#");
          return { file: clashFile, pages: clashPages, page_list: safePages(clashPages) };
        }),
        page_list: paper.clash?.length ? safePages(paper.pages) : [],
        candidates: [],
      };
      // Every name on the cover suggests; a clash does not — the name already
      // found its student, and the question is which paper is theirs.
      const written = [paper.name, ...(paper.also ?? [])].filter(Boolean).map(String);
      if ((lane === "held" || lane === "check") && written.length && !entry.clash.length) {
        const nearest = new Map();
        for (const text of written) {
          for (const candidate of nameCandidates(text, { store, enrolled, not: paper.not ?? [] })) {
            const before = nearest.get(candidate.student);
            if (!before || candidate.distance < before.distance) nearest.set(candidate.student, candidate);
          }
        }
        entry.candidates = [...nearest.values()]
          .filter((candidate) => candidate.student !== paper.resolved)
          .sort((a, b) => a.distance - b.distance || a.student.localeCompare(b.student))
          .slice(0, 3)
          .map((candidate) => ({ ...candidate, name: nameOf(candidate.student) }));
      }
      papers.push(entry);
    }
  }

  const placedSet = new Set(status.placed);
  const classList = [...enrolled]
    .sort()
    .map((student) => ({ student, name: nameOf(student), placed: placedSet.has(student) }));
  if (names) classList.sort((a, b) => (a.name ?? a.student).localeCompare(b.name ?? b.student));

  const count = (lane) => papers.filter((paper) => paper.lane === lane).length;
  return {
    ...base,
    assessment: { id: chosen.id, title: chosen.title, questions: items },
    stages,
    // The step to work on now: the first not done, past a Match that only
    // waits on held papers. Null when every step is done.
    next: standing.next,
    now: standing.now,
    canvas,
    lanes: { check: count("check"), held: count("held"), placed: count("placed"), skipped: count("skipped") },
    papers,
    class: classList,
    missing: status.missing.length,
    // How many answers are recorded: grading opens at the first one.
    answers: responses,
  };
};

// ---------------------------------------------------------------- the crop

let pdftoppm = null;
/** Whether this machine can draw a page: Poppler's `pdftoppm` on PATH. */
export const cropsAvailable = () => {
  if (pdftoppm === null) {
    const probe = spawnSync("pdftoppm", ["-v"], { encoding: "utf-8", timeout: 10000 });
    pdftoppm = !probe.error;
  }
  return pdftoppm;
};

/**
 * The top of a paper's first page — where the name is written — as a PNG.
 *
 * Drawn once and kept beside the plan, in the private folder (`_inbox/_crops`):
 * it is a picture of a student's handwritten name, so it lives where the scan
 * does and nowhere else. The file is looked for in the inbox and in `done/`,
 * because a batch every page of which is placed has moved there.
 */
export const paperCrop = ({ submissions, runId, assessmentId, file, pages, whole = null }) => {
  if (!ID.test(runId) || !ID.test(assessmentId)) throw new Error("not a run or an assessment id");
  if (!/^[\w.-]+\.pdf$/i.test(file)) throw new Error("not a scan's file name");
  const first = Number(String(pages).split(/[-,]/)[0]);
  if (!Number.isInteger(first) || first < 1) throw new Error("not a page range");
  if (whole !== null) return paperPage({ submissions, runId, assessmentId, file, pages, page: whole });
  if (!cropsAvailable()) throw new Error("pdftoppm is not installed, so pages cannot be drawn");
  const place = scanPlace(submissions, runId, assessmentId);
  const pdf = [join(place.inbox, file), join(place.done, file)].find((path) => existsSync(path));
  if (!pdf) throw new Error(`${file} is not in this pile`);
  const cache = join(place.inbox, "_crops");
  // The geometry is in the name, so a change to it is not served a stale crop.
  const stem = `${file.replace(/\.pdf$/i, "")}-p${String(first).padStart(3, "0")}-h2`;
  const target = join(cache, `${stem}.png`);
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(pdf).mtimeMs) return readFileSync(target);
  mkdirSync(cache, { recursive: true });
  // 100 dpi, from the top edge down to 2.2 inches: the title, the course line
  // and the Name / Group line under it — the printed context that says this is
  // the right paper, and the handwriting that says whose. From the very top,
  // because a student who misses the Name line writes above the title (two
  // did on Quiz 2 of CSS-4007). The same band the Grade view hides on
  // Pseudonyms, so the two agree on where a name can be.
  const drawn = spawnSync(
    "pdftoppm",
    ["-png", "-r", "100", "-f", String(first), "-l", String(first), "-x", "0", "-y", "0", "-W", "830", "-H", "220", "-singlefile", pdf, join(cache, stem)],
    { timeout: 30000 },
  );
  if (drawn.error || !existsSync(target)) throw new Error("the page could not be drawn");
  return readFileSync(target);
};

/**
 * One whole page of a paper, small: what two papers that resolve to one
 * student are compared by. A spoiled copy is nearly blank and the paper is
 * not, which a glance at both settles where a name cannot. `page` is a page
 * number in the file, and must be one of the paper's.
 */
const paperPage = ({ submissions, runId, assessmentId, file, pages, page }) => {
  const own = parsePages(String(pages));
  if (!own.includes(Number(page))) throw new Error(`page ${page} is not one of pages ${pages}`);
  if (!cropsAvailable()) throw new Error("pdftoppm is not installed, so pages cannot be drawn");
  const place = scanPlace(submissions, runId, assessmentId);
  const pdf = [join(place.inbox, file), join(place.done, file)].find((path) => existsSync(path));
  if (!pdf) throw new Error(`${file} is not in this pile`);
  const cache = join(place.inbox, "_crops");
  const stem = `${file.replace(/\.pdf$/i, "")}-p${String(page).padStart(3, "0")}-whole1`;
  const target = join(cache, `${stem}.png`);
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(pdf).mtimeMs) return readFileSync(target);
  mkdirSync(cache, { recursive: true });
  // 45 dpi: an A4 page about 370 pixels wide — enough to see how much is
  // written, not enough to read it, which the paper itself is for.
  const drawn = spawnSync(
    "pdftoppm",
    ["-png", "-r", "45", "-f", String(page), "-l", String(page), "-singlefile", pdf, join(cache, stem)],
    { timeout: 30000 },
  );
  if (drawn.error || !existsSync(target)) throw new Error("the page could not be drawn");
  return readFileSync(target);
};

/** For a test: forget whether pdftoppm was found. */
export const resetCropProbe = () => {
  pdftoppm = null;
};
