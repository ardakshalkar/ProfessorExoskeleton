/**
 * Files: the private material a run holds — scanned papers and recorded
 * answers — where it lives, how much there is, and how far each pile has got.
 *
 * None of it is in the workspace. It lives under the submissions root
 * (`submissionsDir`: `AINAR_SUBMISSIONS_DIR`, else `~/.ainar/submissions`),
 * one folder per run:
 *
 *     <RUN>/_inbox/                 scans uploaded, not yet filed to an assessment
 *     <RUN>/_recordings/            recordings uploaded in a batch (DEF-6)
 *     <RUN>/_papers/                question papers and answer keys
 *     <RUN>/<ASSESSMENT>/_inbox/    a pile: the scans as uploaded, plan.yaml, done/
 *     <RUN>/<ASSESSMENT>/<STUDENT>/scan.pdf                 one student's paper
 *     <RUN>/<ASSESSMENT>/<STUDENT>/defence/answers/*.webm   their recorded answers
 *
 * Read here by walking the folders — the only true account of what is on the
 * disk, sizes included — and never written. A defence's cloned repository
 * (`defence/repo/`) and the crops cache are not the professor's files and are
 * left out of every figure.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { parse as parseYaml } from "yaml";

import { assessmentsOf } from "@ainar/core/src/bundle.ts";
import { Ledger } from "@ainar/core/src/lms/ledger.ts";

import { scanPiles } from "./scans.js";

const AUDIO = new Set([".m4a", ".mp4", ".mp3", ".wav", ".webm", ".ogg"]);
const STUDENT = /^STUDENT-/;
const SKIP = new Set(["repo", "_crops", ".git"]);

const dirs = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** Files under `path` with these extensions, recursively but never into SKIP: count and bytes. */
const tally = (path, test) => {
  let count = 0;
  let bytes = 0;
  const walk = (at) => {
    for (const entry of dirs(at)) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(join(at, entry.name));
      } else if (test(extname(entry.name).toLowerCase())) {
        count += 1;
        try {
          bytes += statSync(join(at, entry.name)).size;
        } catch {
          // Gone between listing and stat; not counted.
        }
      }
    }
  };
  walk(path);
  return { count, bytes };
};

const isPdf = (ext) => ext === ".pdf";
const isAudio = (ext) => AUDIO.has(ext);

/** Seconds recorded in one student's defence, from its session.yaml; withdrawn takes left out. */
const secondsOf = (sessionFile) => {
  try {
    const session = parseYaml(readFileSync(sessionFile, "utf8")) || {};
    return (session.answers || []).reduce((n, answer) => n + (answer && !answer.withdrawn ? Number(answer.seconds) || 0 : 0), 0);
  } catch {
    return 0;
  }
};

/** One assessment's folder: its scan pile and its recordings. */
const assessmentFiles = (folder) => {
  const inbox = join(folder, "_inbox");
  const waiting = tally(inbox, isPdf); // includes done/: everything uploaded to the pile
  const students = dirs(folder).filter((entry) => entry.isDirectory() && STUDENT.test(entry.name));
  let papers = 0;
  let paperBytes = 0;
  let recorded = 0;
  let takes = 0;
  let audioBytes = 0;
  let seconds = 0;
  for (const student of students) {
    const at = join(folder, student.name);
    const scan = join(at, "scan.pdf");
    if (existsSync(scan)) {
      papers += 1;
      try {
        paperBytes += statSync(scan).size;
      } catch {
        // Not counted.
      }
    }
    const answers = tally(join(at, "defence", "answers"), isAudio);
    if (answers.count) {
      recorded += 1;
      takes += answers.count;
      audioBytes += answers.bytes;
      seconds += secondsOf(join(at, "defence", "session.yaml"));
    }
  }
  return {
    scans: {
      pile: existsSync(join(inbox, "plan.yaml")),
      uploaded: waiting.count,
      papers,
      bytes: waiting.bytes + paperBytes,
    },
    audio: { students: recorded, takes, seconds: Math.round(seconds), bytes: audioBytes },
  };
};

/** Recordings uploaded in a batch and not yet all filed: how many, and how many are matched to a student. */
const batchRecordings = (folder) => {
  const all = tally(folder, isAudio);
  let matched = 0;
  let entries = 0;
  try {
    const plan = parseYaml(readFileSync(join(folder, "plan.yaml"), "utf8")) || {};
    entries = (plan.entries || []).length;
    matched = (plan.entries || []).filter((entry) => entry && (entry.student || entry.filed)).length;
  } catch {
    // No plan yet: nothing matched.
  }
  return { count: all.count, bytes: all.bytes, planned: entries, matched };
};

/**
 * Everything the Files view draws for one run. `submissions` is the root the
 * caller resolved and checked is outside the repository.
 */
export const filesDocument = ({ bundle, runId, submissions }) => {
  const folder = join(submissions, runId);
  const titles = new Map(assessmentsOf(bundle, runId).map((entry) => [entry.assessment_id, entry.title || entry.assessment_id]));
  // How far each scan pile has got — identify, match, read, rubric, grade,
  // approve, Canvas — exactly as the Scans window reckons it, so the two never
  // disagree. A pile the standings cannot read still lists its files.
  let piles = new Map();
  try {
    const found = scanPiles({ bundle, runId, submissions, ledger: Ledger.load(runId) });
    piles = new Map(
      found.piles.map((pile) => [pile.id, { now: pile.now, progress: pile.progress, stages: found.standings.get(pile.id)?.stages ?? null }]),
    );
  } catch {
    // Files without standings, rather than no Files at all.
  }
  const assessments = [];
  for (const entry of dirs(folder)) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const found = assessmentFiles(join(folder, entry.name));
    if (!found.scans.uploaded && !found.scans.papers && !found.audio.takes) continue;
    const pile = piles.get(entry.name);
    if (pile) found.scans.standing = pile;
    assessments.push({ id: entry.name, title: titles.get(entry.name) || entry.name, known: titles.has(entry.name), ...found });
  }
  // In the course's own order, unknown folders last.
  const order = [...titles.keys()];
  assessments.sort((a, b) => (order.indexOf(a.id) + 1 || 1e9) - (order.indexOf(b.id) + 1 || 1e9) || a.id.localeCompare(b.id));

  const unfiled = tally(join(folder, "_inbox"), isPdf);
  const recordings = batchRecordings(join(folder, "_recordings"));
  const papers = tally(join(folder, "_papers"), (ext) => ext === ".pdf" || ext === ".png" || ext === ".jpg" || ext === ".jpeg");

  const sum = (pick) => assessments.reduce((n, a) => n + pick(a), 0);
  return {
    runId,
    folder,
    exists: existsSync(folder),
    unfiled: { count: unfiled.count, bytes: unfiled.bytes },
    recordings,
    papers,
    assessments,
    totals: {
      scans: { files: sum((a) => a.scans.uploaded + a.scans.papers) + unfiled.count, bytes: sum((a) => a.scans.bytes) + unfiled.bytes },
      audio: { takes: sum((a) => a.audio.takes) + recordings.count, seconds: sum((a) => a.audio.seconds), bytes: sum((a) => a.audio.bytes) + recordings.bytes },
    },
  };
};

/**
 * The run's folder, or one assessment's inside it, as a path the OS file
 * manager can open. Built here from the run and an id the caller checked —
 * never a path from the request.
 */
export const filesFolder = (submissions, runId, assessmentId) =>
  assessmentId ? join(submissions, runId, assessmentId) : join(submissions, runId);
