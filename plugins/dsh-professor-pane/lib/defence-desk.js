/**
 * The defence desk's host side: finding a submission's defence, asking the
 * session's model for the next question or a split, and the transcription
 * settings the consent statement names.
 */

import { existsSync } from "node:fs";

import { allRubrics } from "@ainar/core/src/bundle.ts";
import {
  briefText,
  checkSplit,
  codeDigest,
  collectCode,
  consentStatement,
  decideNext,
  defencePlace,
  NEXT_SYSTEM,
  nextPrompt,
  readDefence,
  readPin,
  readSession,
  recordDecision,
  recordSplit,
  SPLIT_SYSTEM,
  splitFromMarks,
  splitPrompt,
  writeDefence,
} from "@ainar/core/src/defence.ts";
import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { describeTranscription } from "@ainar/core/src/transcribe.ts";

import { loadedRun } from "./workspace.js";

/**
 * The class list, by subgroup.
 *
 * **Names by default; pseudonyms one press away.** The record holds pseudonyms
 * and always will — the mapping back to real people lives outside the
 * repository on purpose, and nothing this view does changes what is on disk.
 * What changed is which question this view answers first. A class list is a
 * list of people, the professor is the one person entitled to read it, and
 * sending them to `ainar roster whois` seventy-four times was friction dressed
 * up as a safeguard.
 *
 * The case for opening on pseudonyms was real but narrow: this pane gets
 * screen-shared and thrown at lecture-hall projectors. That is a minority of
 * the times it is opened, and paying for it on every other one was the wrong
 * trade. It is covered instead by two things — `Pseudonyms` is a single press
 * and sits in the segmented row where it can be found in a hurry, and a
 * coloured rule at the top says names are showing, so the state is never
 * something to remember.
 *
 * The names are resolved from `~/.ainar/roster/people.json` at render time and
 * exist only in the string this function returns. Nothing is written, nothing
 * is cached, and nothing is sent anywhere.
 *
 * Three states, and telling them apart is most of what this view is for:
 *
 * * **loaded** — read from `enrollments.yaml`, where
 *   `ainar roster import` writes the pseudonyms, or from
 *   `samples/enrollments*.yaml`. Fixtures are announced as
 *   fixtures; a real roster is not.
 * * **refused** — an enrollments file sits under `records/`,
 *   the location reserved for the rows Supabase owns, and the loader would not
 *   read it (`storage.forbidden`). Drawing an empty list here would describe a
 *   course nobody had enrolled in, which is a different and false thing.
 * * **absent** — nothing has been imported yet, and `ainar roster import` is
 *   the answer.
 *
 * Dropped students are drawn, dimmed, under a heading of their own. They are in
 * the record because an import marks a departure rather than deleting the row,
 * and a class list that silently omitted them would undo the point of that.
 */
/**
 * What has been prepared for one student's oral defence: the pin (is the fork
 * cloned) and the drafted questions, each null when there is none yet.
 *
 * A function rather than a value, so the class list reads these files only for
 * submissions that carry a link. A submissions folder that cannot be resolved
 * reads as nothing prepared — the class list must still draw.
 */
export const defenceReader = (root, runId) => {
  let submissions = null;
  try {
    submissions = submissionsDir(null);
    refuseInsideRepo(submissions, root);
  } catch {
    submissions = null;
  }
  return (assessmentId, studentId) => {
    if (submissions === null) return { pin: null, questions: null };
    const place = defencePlace(submissions, root, runId, assessmentId, studentId);
    try {
      return { pin: readPin(place.pin), questions: readDefence(place.questions) };
    } catch {
      return { pin: null, questions: null };
    }
  };
};

/**
 * One student's defence, from a request: checked ids, their submission, and
 * where the files are. Throws a sentence for anything that does not resolve.
 */
export const defenceTarget = (workspace, root, runId, params) => {
  const assessmentId = params.get("assessment") ?? "";
  const studentId = params.get("student") ?? "";
  if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
    throw new Error("An assessment and a student id, please.");
  }
  const { bundle } = loadedRun(workspace, runId);
  const submission = (bundle.submissions ?? [])
    .filter((entry) => entry.assessment_id === assessmentId && entry.student_id === studentId)
    .sort((a, b) => (b.attempt ?? 1) - (a.attempt ?? 1))[0];
  if (!submission) throw new Error(`${studentId} has no submission for ${assessmentId}`);
  const submissions = submissionsDir(null);
  refuseInsideRepo(submissions, root);
  return {
    bundle,
    assessmentId,
    studentId,
    assessment: (bundle.assessments ?? []).find((entry) => entry.assessment_id === assessmentId) ?? null,
    ids: { submission_id: submission.submission_id, assessment_id: assessmentId, student_id: studentId },
    place: defencePlace(submissions, root, runId, assessmentId, studentId),
  };
};

/**
 * The provider and model a session is talking to: the route its last request
 * was logged with, as `dsh-session-title-llm` reads it; else the deployment
 * default a new session would get. Null when neither is known.
 */
const modelRoute = (harness, sessionId) => {
  const session = harness.sessions && sessionId ? harness.sessions.get(sessionId) : null;
  const config = session && typeof session.requestHeader === "function" ? session.requestHeader()?.config : null;
  if (config && config.provider && config.model) {
    return { provider: config.provider, model: config.model, reasoningEffort: config.reasoningEffort, live: true };
  }
  const chosen = harness.defaults && typeof harness.defaults.currentSelection === "function" ? harness.defaults.currentSelection() : null;
  if (chosen && chosen.provider && chosen.model) return { ...chosen, live: false };
  return null;
};

/**
 * One call to that model, outside the conversation: no turn in the chat, and
 * logged by the harness against the session like any auxiliary call. The text
 * of the reply, or a thrown sentence.
 */
const askModel = async (harness, route, sessionId, system, text, timeoutMs = 60000) => {
  const { createUserMessage } = await import("@deepseek-ai/dsh-llm/message");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reply = "";
  try {
    for await (const chunk of harness.llm.stream({
      provider: route.provider,
      model: route.model,
      ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
      system,
      messages: [
        createUserMessage({
          content: [{ type: "text", text }],
          source: { kind: "plugin", plugin: "dsh-professor-pane" },
        }),
      ],
      maxTokens: 4000,
      ...(route.live ? { sessionId } : {}),
      signal: controller.signal,
    })) {
      if (chunk.type === "text-delta") reply += chunk.text;
      if (chunk.type === "finish" && (chunk.reason.kind === "error" || chunk.reason.kind === "aborted")) {
        throw new Error(chunk.reason.failure?.message ?? `the model call was ${chunk.reason.kind}`);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return reply;
};

/**
 * What to ask after `after`, chosen by the session's model and checked by
 * `decideNext`; recorded in the session either way. A follow-up the model
 * wrote is added to the questions before the decision is returned, so the
 * desk can put it up at once.
 */
export const chooseNext = async (harness, target, root, sessionId, after) => {
  const drafted = readDefence(target.place.questions);
  if (!drafted) throw new Error("no questions drafted yet");
  const answers = readSession(target.place.session)?.answers ?? [];
  const pin = readPin(target.place.pin);
  const code = pin && existsSync(target.place.repo) ? collectCode(target.place.repo) : { files: [], unread: [] };
  const rubric = allRubrics(target.bundle).get(target.assessment?.rubric_id ?? "") ?? target.assessment?.rubric;
  const criteria = rubric?.criteria ?? [];
  const at = new Date().toISOString();
  const context = { questions: drafted.questions, answers, criteria, files: code.files, after, at };

  const route = modelRoute(harness, sessionId);
  let reply = "";
  let by = "the desk, without a model";
  let failure = null;
  if (!harness.llm || !route) {
    failure = "no model to ask: " + (harness.llm ? "this session has no model route yet" : "the harness offers no llm service");
  } else {
    by = `${route.provider}/${route.model}`;
    try {
      const digest = pin
        ? codeDigest({
            title: target.assessment?.title ?? target.assessmentId,
            assessmentId: target.assessmentId,
            studentId: target.studentId,
            brief: briefText(root, target.bundle.documents ?? [], target.assessment ?? {}),
            criteria,
            pin,
            files: code.files,
            unread: code.unread,
          })
        : "(the code is not cloned)";
      reply = await askModel(harness, route, sessionId, NEXT_SYSTEM, nextPrompt({ digest, questions: drafted.questions, answers, after }));
    } catch (error) {
      failure = "the model call failed: " + String(error?.message ?? error);
    }
  }
  const { decision, followUp } = decideNext(reply, { ...context, by });
  if (failure) decision.notes = [failure, ...(decision.notes ?? [])];
  if (followUp) writeDefence(target.place.questions, { ...drafted, questions: [...drafted.questions, followUp] });
  const index = recordDecision(target.place, target.ids, decision);
  const questions = followUp ? [...drafted.questions, followUp] : drafted.questions;
  return { decision, index, question: questions.find((question) => question.id === decision.question_id) ?? null };
};

/**
 * Divide one whole-defence take into its questions (AGT-11): the session's
 * model reads the timed dialogue with the professor's presses as hints, and
 * `checkSplit` keeps what holds. With no model, or a reply that is no use,
 * the presses alone make the split. Kept as a draft; a split with no parts
 * at all is reported and not kept.
 */
export const splitWhole = async (harness, target, sessionId, questionId, take) => {
  const session = readSession(target.place.session);
  const answer = session?.answers.find((entry) => entry.question_id === questionId && entry.take === take);
  if (!answer) throw new Error(`no take ${take} of ${questionId}`);
  if (!answer.transcript) throw new Error(`take ${take} of ${questionId} has no transcript yet`);
  if (answer.withdrawn) throw new Error("this take was recorded before consent was withdrawn; it is not split");
  const questions = readDefence(target.place.questions)?.questions ?? [];
  const rubric = allRubrics(target.bundle).get(target.assessment?.rubric_id ?? "") ?? target.assessment?.rubric;
  const criteria = rubric?.criteria ?? [];
  const at = new Date().toISOString();
  const route = modelRoute(harness, sessionId);
  let split;
  if (!harness.llm || !route) {
    split = splitFromMarks({ answer, questions, at });
    split.notes = ["no model to ask: " + (harness.llm ? "this session has no model route yet" : "the harness offers no llm service"), ...(split.notes ?? [])];
  } else {
    try {
      const reply = await askModel(harness, route, sessionId, SPLIT_SYSTEM, splitPrompt({ answer, questions, criteria }), 120000);
      split = checkSplit(reply, { answer, questions, criteria, by: `${route.provider}/${route.model}`, at });
    } catch (error) {
      split = splitFromMarks({ answer, questions, at });
      split.notes = ["the model call failed: " + String(error?.message ?? error), ...(split.notes ?? [])];
    }
  }
  if (!split.parts.length) return { split: null, notes: split.notes ?? [] };
  return { split: recordSplit(target.place, split), notes: split.notes ?? [] };
};

/**
 * What the defence desk draws: the questions, every take with its transcript,
 * and which provider will hear the next one — or why none will. The provider is
 * named so the professor knows, before pressing record, where the student's
 * voice is about to be sent.
 */
/**
 * The transcription connection as configured, for the desk and the consent
 * statement. `error` when it cannot transcribe yet — no connection, or one
 * without its key — but a configured provider is still named, so the student
 * is never told their voice stays here when it would not.
 */
export const transcriptionInfo = () => {
  try {
    const described = describeTranscription(null);
    if (!described) return { error: "no transcription connection is set up", configured: null };
    const { problem, ...rest } = described;
    return problem ? { ...rest, error: problem, configured: rest } : rest;
  } catch (error) {
    return { error: String(error?.message ?? error), configured: null };
  }
};

/** What a consent statement names: the configured provider, usable or not. */
export const statementFor = (transcription) =>
  consentStatement(transcription.error ? transcription.configured ?? null : transcription);

export const defenceSessionPayload = (target) => {
  const transcription = transcriptionInfo();
  const session = readSession(target.place.session);
  const rubric = allRubrics(target.bundle).get(target.assessment?.rubric_id ?? "") ?? target.assessment?.rubric;
  return {
    assessment: { id: target.assessmentId, title: target.assessment?.title ?? target.assessmentId },
    student: target.studentId,
    // For reading a question aloud on the student's screen: the course's one
    // language when it has one; with several the browser's voice is left to it.
    languages: target.bundle.course?.language ?? [],
    criteria: (rubric?.criteria ?? []).map((criterion) => ({ id: criterion.criterion_id, title: criterion.title })),
    pin: readPin(target.place.pin),
    questions: readDefence(target.place.questions)?.questions ?? [],
    answers: session?.answers ?? [],
    splits: session?.splits ?? [],
    transcription,
    // AGT-7: what the student is asked to agree to — written here from the
    // provider in use, never by the browser — and what they answered.
    statement: statementFor(transcription),
    consent: session?.consent ?? null,
  };
};
