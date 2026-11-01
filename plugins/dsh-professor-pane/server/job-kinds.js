/**
 * The kinds of work the job runner (server/jobs.js) will start — the only
 * ones (JOB-10). A press names a kind and plain parameters; each kind checks
 * its parameters and builds its own command line, so nothing a page, a file
 * or the assistant writes can start an arbitrary process. Every route that
 * starts work goes through `startKind`, and so do Continue (JOB-5) and a
 * restart resuming the queue (JOB-9).
 *
 * Continue needs nothing of its own: it starts the same kind again with the
 * same parameters, and each command already skips what is done — `scans
 * read` leaves read papers alone, `defence batch transcribe` takes that have
 * a transcript — so only what is missing runs.
 *
 * A kind whose work depends on a plan the professor looked at says so with
 * `inputs`: what the plan was when it was pressed. A job that waited while
 * the plan was rewritten is held, with the reason, instead of being run on
 * what the professor never saw (JOB-9).
 *
 * Nothing that reaches students is a kind: a Canvas push, a publication, a
 * Telegram post stay the professor's own press in their views, answered
 * there and never queued (`SEND_KINDS`, as BGS-7 holds for background sync).
 */

import { createHash } from "node:crypto";
import { join } from "node:path";

import { assessmentsOf, runById } from "@ainar/core/src/bundle.ts";
import { readRecordingPlan, recordingsInbox } from "@ainar/core/src/recordings.ts";
import { decidedAt, writeRecords } from "@ainar/core/src/records-write.ts";
import { readPlan, scanPlace, submissionsDir } from "@ainar/core/src/scans.ts";

import { readSummary, runScans } from "./actions.js";
import { defenceKey, pileKey, recordingsKey, recordsKey, startJob } from "./jobs.js";
import { loadedRun } from "./workspace.js";

/** An assessment's title in a run, and the run's course: what jobs are named by and lock. */
export const assessmentOf = (workspace, runId, assessmentId) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId);
  const record = assessmentsOf(bundle, runId).find((entry) => entry.assessment_id === assessmentId);
  return { courseId: run?.course_id ?? runId, title: record?.title || assessmentId, timezone: run?.timezone };
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

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/**
 * A pile's plan as the professor placed papers on it: which files, and how
 * they are split. Placing a paper (`student:`) and applying (`resolved:`)
 * leave it alone; a rescan, a new file or a new split moves it.
 */
const pileLayout = (runId, assessmentId) => {
  try {
    const plan = readPlan(scanPlace(submissionsDir(null), runId, assessmentId));
    return fingerprint((plan?.sources ?? []).map((source) => [source.file, source.checksum, source.papers.map((paper) => paper.pages)]));
  } catch {
    return "unreadable";
  }
};

/** The run's recordings plan as it places recordings: which assessment, which file is whose. */
const recordingsLayout = (runId) => {
  try {
    const plan = readRecordingPlan(recordingsInbox(submissionsDir(null), runId));
    return fingerprint(plan ? [plan.assessment, plan.entries.map((entry) => [entry.file, entry.student ?? null, entry.skip ?? null])] : null);
  } catch {
    return "unreadable";
  }
};

const PILE_CHANGED =
  "The pile's plan was rewritten while this waited (papers were added or split again), so it was not run on a plan you had not seen. Look at the pile, then press again.";
const RECORDINGS_CHANGED =
  "The recordings plan was rewritten while this waited, so it was not run on a plan you had not seen. Look at the plan, then press again.";

// --------------------------------------------------------------------------
// Checking what a press sends
// --------------------------------------------------------------------------

// As the scans route has always taken it: an id, not necessarily `ASSESSMENT-…`.
const ASSESSMENT = /^[A-Z0-9][A-Z0-9-]*$/;
const STUDENT = /^STUDENT-[A-Z0-9][A-Z0-9-]*$/;

const assessmentParam = (params) => {
  const id = String(params.assessmentId ?? "");
  if (!ASSESSMENT.test(id)) throw new Error("No assessment given.");
  return id;
};

/** One answer, or the review's whole list, as `scans assign --assignments` takes it. */
const placementsParam = (papers) => {
  const answers = (Array.isArray(papers) ? papers : []).map((entry) => {
    const pages = String(entry?.pages ?? "");
    if (!/^[\d ,-]{1,40}$/.test(pages)) throw new Error("No paper given.");
    const answer = { pages };
    if (entry.file) {
      if (!/^[\w.-]+\.pdf$/i.test(String(entry.file))) throw new Error("Not a scan's file name.");
      answer.file = String(entry.file);
    }
    const pseudonym = (value) => {
      if (!STUDENT.test(String(value))) throw new Error("Not a pseudonym.");
      return String(value);
    };
    if (entry.student) answer.student = pseudonym(entry.student);
    else if (entry.reject) answer.reject = pseudonym(entry.reject);
    else if (entry.skip) answer.skip = String(entry.skip).slice(0, 200);
    else throw new Error("Say who the paper is, who it is not, or that it is nobody's.");
    return answer;
  });
  if (!answers.length || answers.length > 500) throw new Error("No papers given.");
  return answers;
};

// --------------------------------------------------------------------------
// The record of what ran
// --------------------------------------------------------------------------

/**
 * A job's start, finish or cancel, into the run's course's
 * `records/events.yaml`: what ran, with what, and who pressed it. A record
 * that cannot be written is said in the job's output; the work is not
 * stopped for it.
 */
export const logTo = (c, pile) => (type, job) => {
  try {
    const at = decidedAt(pile.timezone);
    const id = `EVENT-${job.id.toUpperCase()}-${type.toUpperCase()}`;
    writeRecords(join(c.root, "courses", pile.courseId), {
      events: [
        {
          event_id: id,
          event_type: `job_${type}`,
          course_version_id: job.runId,
          entity_type: "job",
          entity_id: job.id,
          occurred_at: at,
          payload: {
            kind: job.kind,
            label: job.label,
            params: job.params,
            pressed_by: job.pressedBy ?? "professor, in the pane",
            ...(type === "finished" ? { state: job.state } : {}),
            ...(job.heldBecause ? { held_because: job.heldBecause } : {}),
          },
        },
      ],
    });
  } catch (error) {
    job.say?.(`\n(the job's ${type} was not recorded in events.yaml: ${error?.message ?? error})\n`);
  }
};

// --------------------------------------------------------------------------
// The kinds
// --------------------------------------------------------------------------

/**
 * Each kind: `check(params)` — the parameters it accepts, cleaned, or a
 * throw — and `start(c, params, resume)`, which starts it. `resume` is the
 * saved job a restart brings back (its id, when it was pressed, the inputs
 * it saw), or null for a fresh press.
 */
export const KINDS = {
  // `scans read`, then `scans record`. The half hour holds only the pile;
  // the course's answers file is taken for the record at the end, so placing
  // papers on another pile is not held up. A cancelled read is not recorded:
  // Continue reads the rest and records the whole pile.
  "scans-read": {
    check: (params) => ({ assessmentId: assessmentParam(params) }),
    start: (c, params, resume) => {
      const { assessmentId } = params;
      const { runId, root } = c;
      const pile = assessmentOf(c.workspace, runId, assessmentId);
      const scope = ["--assessment", assessmentId];
      return startJob({
        root,
        runId,
        kind: "scans-read",
        label: `Reading ${pile.title}`,
        subject: assessmentId,
        params,
        resume,
        log: logTo(c, pile),
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
  },
  // Placing papers, and applying the pile's plan: short, so inline. Pressed
  // while the pile is read, either is queued behind the read (JOB-8).
  "scans-assign": {
    check: (params) => ({ assessmentId: assessmentParam(params), papers: placementsParam(params.papers) }),
    start: (c, params, resume) => placing(c, "scans-assign", params, resume),
  },
  "scans-apply": {
    check: (params) => ({ assessmentId: assessmentParam(params) }),
    start: (c, params, resume) => placing(c, "scans-apply", params, resume),
  },
  // Recorded defences uploaded afterwards (DEF-6). Plan and apply rewrite
  // the run's one recordings plan, and apply files into each placed
  // student's defence: seconds, inline.
  "defence-batch-plan": {
    check: (params) => ({ assessmentId: assessmentParam(params) }),
    start: (c, params, resume) => filing(c, "plan", params, resume),
  },
  "defence-batch-apply": {
    check: (params) => ({ assessmentId: assessmentParam(params), consent: params.consent === true }),
    start: (c, params, resume) => filing(c, "apply", params, resume),
  },
  // Sending a batch of recorded defences: each filed student's session for
  // up to half an hour, so the desk is refused only for those students.
  "defence-transcribe": {
    check: (params) => ({ assessmentId: assessmentParam(params) }),
    start: (c, params, resume) => {
      const { assessmentId } = params;
      const { runId, root } = c;
      const pile = assessmentOf(c.workspace, runId, assessmentId);
      return startJob({
        root,
        runId,
        kind: "defence-transcribe",
        label: `Transcribing the defences for ${pile.title}`,
        subject: assessmentId,
        params,
        resume,
        log: logTo(c, pile),
        // Its students are read off the plan when pressed: a plan rewritten
        // while it waited would send the wrong ones.
        inputs: { read: () => recordingsLayout(runId), changed: RECORDINGS_CHANGED },
        keys: recordedStudents(runId, assessmentId).map((student) => defenceKey(runId, assessmentId, student)),
        background: true,
        // Sending opens with "N recording(s), …" and says each student as it lands.
        progress: { unit: "transcribed", total: /^(\d+) recording\(s\),/, step: /^\s+STUDENT-[A-Z0-9-]+: / },
        work: (job) =>
          runScans(["defence", "batch", "transcribe", runId, "--assessment", assessmentId, "--confirm"], root, 1800000, null, job.say, job.adopt),
      });
    },
  },
};

const placing = (c, kind, params, resume) => {
  const { assessmentId } = params;
  const { runId, root } = c;
  const pile = assessmentOf(c.workspace, runId, assessmentId);
  const args = ["scans", kind === "scans-assign" ? "assign" : "apply", runId, "--assessment", assessmentId];
  if (kind === "scans-assign") args.push("--assignments", JSON.stringify(params.papers));
  return startJob({
    root,
    runId,
    kind,
    label: kind === "scans-assign" ? `Placing papers on ${pile.title}` : `Applying placements on ${pile.title}`,
    subject: assessmentId,
    params,
    resume,
    log: logTo(c, pile),
    inputs: { read: () => pileLayout(runId, assessmentId), changed: PILE_CHANGED },
    keys: [pileKey(runId, assessmentId), recordsKey(pile.courseId, "submissions"), recordsKey(pile.courseId, "item_responses")],
    work: () => runScans(args, root),
  });
};

const filing = (c, step, params, resume) => {
  const { assessmentId } = params;
  const { runId, root } = c;
  const pile = assessmentOf(c.workspace, runId, assessmentId);
  const extra = step === "apply" && params.consent ? ["--consent-confirmed"] : [];
  const defences = step === "apply" ? recordedStudents(runId, assessmentId).map((student) => defenceKey(runId, assessmentId, student)) : [];
  return startJob({
    root,
    runId,
    kind: `defence-batch-${step}`,
    label: `Filing recorded defences for ${pile.title}`,
    subject: assessmentId,
    params,
    resume,
    log: logTo(c, pile),
    // Planning writes the plan afresh; filing files what the plan said.
    inputs: step === "apply" ? { read: () => recordingsLayout(runId), changed: RECORDINGS_CHANGED } : null,
    keys: [recordingsKey(runId), ...defences],
    work: () => runScans(["defence", "batch", step, runId, "--assessment", assessmentId, ...extra], root),
  });
};

/**
 * Kinds that reach students. Never started here, whatever a request says:
 * each is the professor's own press in its view, answered there.
 */
export const SEND_KINDS = ["canvas-push", "grades-send", "publish", "telegram-post", "github-publish", "course-page-publish"];

/**
 * Start a kind of work: `{ job, done }` from the runner, or `{ error }` for
 * a kind that is not in the table, one that sends, or parameters it does
 * not accept. `resume` as for a kind's `start`.
 */
export const startKind = (c, kind, params, resume = null) => {
  if (SEND_KINDS.includes(kind)) return Promise.resolve({ error: `${kind} reaches students, so it is never queued: press it in its own view.` });
  const entry = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
  if (!entry) return Promise.resolve({ error: `No such kind of work: ${kind}.` });
  let checked;
  try {
    checked = entry.check(params && typeof params === "object" ? params : {});
  } catch (error) {
    return Promise.resolve({ error: String(error?.message ?? error) });
  }
  return Promise.resolve()
    .then(() => entry.start(c, checked, resume))
    .catch((error) => ({ error: String(error?.message ?? error) }));
};
