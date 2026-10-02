/**
 * Paper exams: what the Scans tab draws, and the one picture it shows.
 *
 * A scanned pile goes through six steps — identify, match, read, rubric, grade,
 * approve — and each one is already a command (`ainar scans …`, then the
 * grading skills). What was missing is a place that says where a pile stands
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

import { enrolledIn } from "@ainar/core/src/bundle.ts";
import { RosterStore } from "@ainar/core/src/roster.ts";
import {
  nameCandidates,
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

/** Which lane a planned paper sits in. */
const laneOf = (paper) => {
  if (paper.skip) return "skipped";
  if (paper.problem) return "held";
  if (paper.resolved && paper.match === "close") return "check";
  if (paper.resolved) return "placed";
  return "held"; // planned but never applied
};

/**
 * Six steps, each with how far it has got. `state` is done, current, waiting
 * (yours to decide) or todo; the first one not done is current.
 */
const stagesOf = ({ papers, status, assessment, rubric, items, responses, evaluations, low }) => {
  const placed = status.placed.length;
  const held = papers.filter((paper) => paper.lane === "held").length;
  const check = papers.filter((paper) => paper.lane === "check").length;
  const expected = placed * items;
  const graded = new Set(evaluations.map((entry) => entry.submission_id)).size;
  const decided = evaluations.filter((entry) => entry.professor_decision).length;
  const rubricState = rubric === null ? "none" : rubric.approval === "draft" ? "draft" : "accepted";

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
  ];
  const current = stages.findIndex((stage) => !stage.done);
  return stages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    detail: stage.detail,
    state: stage.done ? "done" : index === current ? (stage.waiting ? "yours" : "current") : stage.waiting ? "yours" : "todo",
  }));
};

/**
 * Everything the Scans tab draws for one run, as JSON.
 *
 * `loaded` is the run's course as the pane loads it (drafts included — a
 * placement is not a draft and neither is an answer read off paper, and the
 * professor is the reader here). `submissions` is the private folder.
 */
export const scansDocument = ({ loaded, runId, submissions, rosterDirectory, assessmentId, names }) => {
  const bundle = loaded.bundle;
  const assessments = bundle.assessments.filter((entry) => entry.course_version_id === runId);
  const piles = pilesOf(submissions, runId, assessments);
  const chosen = piles.find((pile) => pile.id === assessmentId) ?? piles[0] ?? null;
  const base = { run: runId, piles, names: names === true, crops: cropsAvailable() };
  if (!chosen) return { ...base, assessment: null };

  const assessment = assessments.find((entry) => entry.assessment_id === chosen.id);
  const place = scanPlace(submissions, runId, chosen.id);
  const enrolled = new Set(enrolledIn(bundle, runId).map((entry) => entry.student_id));
  const store = RosterStore.load(rosterDirectory);
  const nameOf = (student) => (names && store.people[student]?.name ? String(store.people[student].name).trim() : null);
  const plan = readPlan(place);
  const status = scanStatus(place, enrolled);

  const papers = [];
  for (const source of plan?.sources ?? []) {
    for (const paper of source.papers ?? []) {
      const lane = laneOf(paper);
      const entry = {
        file: source.file,
        pages: String(paper.pages),
        lane,
        written: names && paper.name ? String(paper.name) : null,
        has_name: Boolean(paper.name || paper.number),
        pinned: Boolean(paper.student),
        resolved: paper.resolved ?? null,
        resolved_name: paper.resolved ? nameOf(paper.resolved) : null,
        match: paper.match ?? null,
        problem: paper.problem ?? null,
        skip: paper.skip ?? null,
        note: names ? paper.note ?? null : null,
        candidates: [],
      };
      if ((lane === "held" || lane === "check") && paper.name) {
        entry.candidates = nameCandidates(String(paper.name), { store, enrolled })
          .filter((candidate) => candidate.student !== paper.resolved)
          .map((candidate) => ({ ...candidate, name: nameOf(candidate.student) }));
      }
      papers.push(entry);
    }
  }

  const items = bundle.items.filter((item) => item.assessment_id === chosen.id).length;
  const ids = new Set(status.placed.map((student) => scanSubmissionId(student, chosen.id)));
  const responses = bundle.item_responses.filter((entry) => ids.has(entry.submission_id)).length;
  const evaluations = bundle.evaluations.filter((entry) => ids.has(entry.submission_id));
  const rubricId = assessment.rubric_id ?? assessment.rubric?.rubric_id ?? null;
  const rubric = rubricId ? (bundle.rubrics ?? []).find((entry) => entry.rubric_id === rubricId) ?? assessment.rubric ?? null : null;
  const low = status.placed.reduce((sum, student) => sum + lowConfidence(place, student), 0);

  const placedSet = new Set(status.placed);
  const classList = [...enrolled]
    .sort()
    .map((student) => ({ student, name: nameOf(student), placed: placedSet.has(student) }));
  if (names) classList.sort((a, b) => (a.name ?? a.student).localeCompare(b.name ?? b.student));

  const count = (lane) => papers.filter((paper) => paper.lane === lane).length;
  return {
    ...base,
    assessment: { id: chosen.id, title: chosen.title, questions: items },
    stages: stagesOf({ papers, status, assessment, rubric, items, responses, evaluations, low }),
    lanes: { check: count("check"), held: count("held"), placed: count("placed"), skipped: count("skipped") },
    papers,
    class: classList,
    missing: status.missing.length,
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
export const paperCrop = ({ submissions, runId, assessmentId, file, pages }) => {
  if (!ID.test(runId) || !ID.test(assessmentId)) throw new Error("not a run or an assessment id");
  if (!/^[\w.-]+\.pdf$/i.test(file)) throw new Error("not a scan's file name");
  const first = Number(String(pages).split(/[-,]/)[0]);
  if (!Number.isInteger(first) || first < 1) throw new Error("not a page range");
  if (!cropsAvailable()) throw new Error("pdftoppm is not installed, so pages cannot be drawn");
  const place = scanPlace(submissions, runId, assessmentId);
  const pdf = [join(place.inbox, file), join(place.done, file)].find((path) => existsSync(path));
  if (!pdf) throw new Error(`${file} is not in this pile`);
  const cache = join(place.inbox, "_crops");
  // The geometry is in the name, so a change to it is not served a stale crop.
  const stem = `${file.replace(/\.pdf$/i, "")}-p${String(first).padStart(3, "0")}-h1`;
  const target = join(cache, `${stem}.png`);
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(pdf).mtimeMs) return readFileSync(target);
  mkdirSync(cache, { recursive: true });
  // 100 dpi, from half an inch down to about two: the title, the course line
  // and the Name / Group line under it — the printed context that says this is
  // the right paper, and the handwriting that says whose.
  const drawn = spawnSync(
    "pdftoppm",
    ["-png", "-r", "100", "-f", String(first), "-l", String(first), "-x", "0", "-y", "50", "-W", "830", "-H", "170", "-singlefile", pdf, join(cache, stem)],
    { timeout: 30000 },
  );
  if (drawn.error || !existsSync(target)) throw new Error("the page could not be drawn");
  return readFileSync(target);
};

/** For a test: forget whether pdftoppm was found. */
export const resetCropProbe = () => {
  pdftoppm = null;
};
