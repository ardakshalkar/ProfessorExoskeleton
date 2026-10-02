/**
 * Grading a written exam in the pane: what the Grade view draws, and the page
 * a card shows.
 *
 * The board is `gradeBoard` from the core (`ainar-node/src/grade-board.ts`) —
 * the same payload `ainar grade status --json` prints — so the pane computes
 * nothing of its own. What is added here is the two things the core does not
 * know about: the professor's names for the pseudonyms, only with `names=1`,
 * and a picture of the page an answer is on.
 *
 * Nothing here writes to the course. The buttons spawn `ainar grade …`, so a
 * mark pressed in the pane is written by the same code as a mark typed in a
 * terminal.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { gradeBoard, groupsPath } from "@ainar/core/src/grade-board.ts";
import { RosterStore } from "@ainar/core/src/roster.ts";
import { scanPlace } from "@ainar/core/src/scans.ts";

import { cropsAvailable } from "./scans.js";

const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const STUDENT = /^STUDENT-[A-Z0-9]+$/;

/** Everything the Grade view draws for one assessment, as JSON. */
export const gradeDocument = ({ loaded, runId, submissions, rosterDirectory, assessmentId, names }) => {
  const place = scanPlace(submissions, runId, assessmentId);
  const board = gradeBoard({ bundle: loaded.bundle, runId, assessmentId, place });
  let people = {};
  if (names) {
    const store = RosterStore.load(rosterDirectory);
    const wanted = new Set(board.items.flatMap((item) => item.answers.map((answer) => answer.student)));
    for (const student of wanted) {
      const name = store.people[student]?.name;
      if (name) people[student] = String(name).trim();
    }
  }
  return { ...board, names: names === true, people, pages: cropsAvailable() };
};

/** The grouping's modification time, or 0 when there is none — what the view polls. */
export const groupsStamp = ({ submissions, runId, assessmentId }) => {
  if (!ID.test(runId) || !ID.test(assessmentId)) throw new Error("not a run or an assessment id");
  const path = groupsPath(scanPlace(submissions, runId, assessmentId));
  return existsSync(path) ? statSync(path).mtimeMs : 0;
};

/**
 * One page of a student's scan, as a PNG wide enough to read handwriting.
 *
 * Drawn once and kept in that student's private folder (`_pages/`), beside the
 * scan it was drawn from, and redrawn if the scan is newer.
 *
 * Without `names`, the first page is drawn from below the name line: the
 * handwritten name *is* the name, and Pseudonyms is the setting a professor
 * picks for a projector. The band cut off is the one the Scans tab's name crop
 * shows (to two inches down), so the two views agree on where the name is.
 */
export const answerPage = ({ submissions, runId, assessmentId, student, page, names }) => {
  if (!ID.test(runId) || !ID.test(assessmentId)) throw new Error("not a run or an assessment id");
  if (!STUDENT.test(student)) throw new Error("not a pseudonym");
  const number = Number(page);
  if (!Number.isInteger(number) || number < 1 || number > 99) throw new Error("not a page number");
  if (!cropsAvailable()) throw new Error("pdftoppm is not installed, so pages cannot be drawn");
  const folder = join(scanPlace(submissions, runId, assessmentId).base, student);
  const pdf = join(folder, "scan.pdf");
  if (!existsSync(pdf)) throw new Error(`${student} has no scan`);
  const cache = join(folder, "_pages");
  const hide = !names && number === 1;
  const stem = `p${String(number).padStart(2, "0")}-r110${hide ? "-noname" : ""}`;
  const target = join(cache, `${stem}.png`);
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(pdf).mtimeMs) return readFileSync(target);
  mkdirSync(cache, { recursive: true });
  // 2.2 inches at 110 dpi; pdftoppm clamps the box to the page.
  const crop = hide ? ["-x", "0", "-y", "242", "-W", "4000", "-H", "8000"] : [];
  const drawn = spawnSync(
    "pdftoppm",
    ["-png", "-r", "110", "-f", String(number), "-l", String(number), ...crop, "-singlefile", pdf, join(cache, stem)],
    { timeout: 30000 },
  );
  if (drawn.error || !existsSync(target)) throw new Error("the page could not be drawn");
  return readFileSync(target);
};
