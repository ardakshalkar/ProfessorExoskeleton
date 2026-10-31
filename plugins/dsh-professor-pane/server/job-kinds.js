/**
 * The kinds of work that run in the background (server/jobs.js), each
 * started from here — by the press that asks for it, and by Continue on one
 * a restart or a Cancel cut short (JOB-5).
 *
 * Continue needs nothing of its own: it starts the same kind again with the
 * same few parameters, and each command already skips what is done —
 * `scans read` leaves read papers alone, `defence batch transcribe` takes
 * that have a transcript — so only what is missing runs.
 *
 * A kind is started with `c` (the request's workspace, root and run, or the
 * same rebuilt for a Continue) and plain parameters, never a command line.
 */

import { assessmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { readRecordingPlan, recordingsInbox } from "@ainar/core/src/recordings.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";

import { readSummary, runScans } from "./actions.js";
import { defenceKey, pileKey, recordsKey, startJob } from "./jobs.js";
import { loadedRun } from "./workspace.js";

/** An assessment's title in a run, and the run's course: what jobs are named by and lock. */
export const assessmentOf = (workspace, runId, assessmentId) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  const record = assessmentsOf(bundle, runId).find((entry) => entry.assessment_id === assessmentId);
  return { courseId: run?.course_id ?? runId, title: record?.title || assessmentId };
};

/** The students the run's recordings plan places for this assessment, for their defence locks. */
export const recordedStudents = (runId, assessmentId) => {
  try {
    const plan = readRecordingPlan(recordingsInbox(submissionsDir(null), runId));
    if (!plan || plan.assessment !== assessmentId) return [];
    return [...new Set(plan.entries.filter((entry) => entry.student && !entry.skip).map((entry) => entry.student))];
  } catch {
    // No plan, or one that does not read: the CLI says so in its own words.
    return [];
  }
};

export const KINDS = {
  // `scans read`, then `scans record`. The half hour holds only the pile;
  // the course's answers file is taken for the record at the end, so placing
  // papers on another pile is not held up. A cancelled read is not recorded:
  // Continue reads the rest and records the whole pile.
  "scans-read": ({ workspace, root, runId }, { assessmentId }) => {
    const pile = assessmentOf(workspace, runId, assessmentId);
    const scope = ["--assessment", assessmentId];
    return startJob({
      root,
      runId,
      kind: "scans-read",
      label: `Reading ${pile.title}`,
      subject: assessmentId,
      params: { assessmentId },
      keys: [pileKey(runId, assessmentId)],
      background: true,
      // `scans read` opens with the count and prints a line per paper.
      progress: { unit: "read", total: /^reading (\d+) /, step: /^\s+(read|partly read|unparsed|failed)\s+STUDENT-/ },
      work: async (job) => {
        const read = await runScans(["scans", "read", runId, ...scope], root, 1800000, null, job.say, job.adopt);
        if (!read.ok || job.cancelled) return read;
        await job.take([recordsKey(pile.courseId, "item_responses")]);
        const record = await runScans(["scans", "record", runId, ...scope], root, 300000, null, job.say, job.adopt);
        return {
          ok: record.ok,
          exitCode: record.exitCode,
          command: `${read.command} && ${record.command}`,
          output: [readSummary(read.output), record.output].filter(Boolean).join("\n\n"),
        };
      },
    });
  },
  // Sending a batch of recorded defences: each filed student's session for
  // up to half an hour, so the desk is refused only for those students.
  "defence-transcribe": ({ workspace, root, runId }, { assessmentId }) => {
    const { title } = assessmentOf(workspace, runId, assessmentId);
    return startJob({
      root,
      runId,
      kind: "defence-transcribe",
      label: `Transcribing the defences for ${title}`,
      subject: assessmentId,
      params: { assessmentId },
      keys: recordedStudents(runId, assessmentId).map((student) => defenceKey(runId, assessmentId, student)),
      background: true,
      // Sending opens with "N recording(s), …" and says each student as it lands.
      progress: { unit: "transcribed", total: /^(\d+) recording\(s\),/, step: /^\s+STUDENT-[A-Z0-9-]+: / },
      work: (job) =>
        runScans(["defence", "batch", "transcribe", runId, "--assessment", assessmentId, "--confirm"], root, 1800000, null, job.say, job.adopt),
    });
  },
};
