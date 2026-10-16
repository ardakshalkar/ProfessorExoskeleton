/**
 * Routes: defence. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assessmentsOf } from "@ainar/core/src/bundle.ts";
import {
  approveSplit,
  assignVoices,
  captionAudio,
  consentGiven,
  editQuestion,
  ensureWholeDefence,
  overrideDecision,
  readDefence,
  readPin,
  readSession,
  recordConsent,
  saveAnswer,
  setTranscript,
  transcribeTake,
  WHOLE_DEFENCE,
  withdrawConsent,
} from "@ainar/core/src/defence.ts";
import { configFromRegistry, realtimeSession, transcriber } from "@ainar/core/src/transcribe.ts";
import { runScans } from "../actions.js";
import {
  chooseNext,
  defenceSessionPayload,
  defenceTarget,
  splitWhole,
  statementFor,
  transcriptionInfo,
} from "../defence-desk.js";
import { readBody, readBytes, send, sendJson } from "../http.js";
import { studentScreenPage } from "../student-screen.js";
import { loadedRun } from "../workspace.js";

export const routes = [
  // The defence desk: what was asked and answered, a recorded answer, and
  // its audio played back. Everything here reads or writes the private
  // folder, which is why it is the pane's and not the session's. The answer
  // is transcribed in this process too — no judgement in it, and the
  // provider is the professor's `transcription` connection.
  // The student's screen (AGT-4): a page with no data in it. Everything it
  // shows arrives from the desk over a BroadcastChannel; see
  // server/student-screen.js for why it fetches nothing.
  {
    paths: ["/defence/screen"],
    handle(c) {
      const { res, url } = c;
      const assessmentId = url.searchParams.get("assessment") ?? "";
      const studentId = url.searchParams.get("student") ?? "";
      if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
        return send(res, 400, "text/plain; charset=utf-8", "An assessment and a student id, please.");
      }
      return send(res, 200, "text/html; charset=utf-8", studentScreenPage({ assessmentId, studentId }));
    },
  },
  // DEF-6, recorded defences uploaded afterwards. The steps are `ainar
  // defence batch`, run here because they write the private folder: plan
  // (lengths and costs, nothing sent), apply (with the consent the
  // professor confirms), transcribe (a quote, and only with confirm a send).
  {
    paths: ["/api/defence/batch"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      let loaded;
      try {
        loaded = loadedRun(workspace, runId);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (req.method !== "POST") {
        return sendJson(res, 200, {
          assessments: assessmentsOf(loaded.bundle, runId).map((entry) => ({ id: entry.assessment_id, title: entry.title })),
        });
      }
      const step = url.searchParams.get("step") ?? "";
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (!["plan", "apply", "transcribe"].includes(step) || !/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: "A step (plan, apply, transcribe) and an assessment, please." });
      }
      const extra =
        step === "apply" && url.searchParams.get("consent") === "1"
          ? ["--consent-confirmed"]
          : step === "transcribe" && url.searchParams.get("confirm") === "1"
            ? ["--confirm"]
            : [];
      return runScans(["defence", "batch", step, runId, "--assessment", assessmentId, ...extra], root, step === "transcribe" ? 1800000 : 300000)
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // The whole defence in one recording: make sure Q0 exists, so the desk can
  // record into it; and "this voice is me", which labels a take's voices
  // again with no provider call.
  {
    paths: ["/api/defence/whole","/api/defence/voices"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return readBody(req)
        .then((text) => {
          const body = text ? JSON.parse(text) : {};
          if (path === "/api/defence/whole") {
            const submission = (target.bundle.submissions ?? []).find((entry) => entry.submission_id === target.ids.submission_id);
            const pin = readPin(target.place.pin);
            ensureWholeDefence(target.place.questions, target.ids, { url: submission?.url ?? "", commit: pin?.commit ?? "" });
            return sendJson(res, 200, { ok: true, question: WHOLE_DEFENCE });
          }
          const voices = Array.isArray(body.voices) ? body.voices.map(String).filter((voice) => /^[\w-]{1,40}$/.test(voice)) : [];
          if (!voices.length) throw new Error("name at least one voice");
          const answer = assignVoices(target.place, String(body.question ?? ""), Number(body.take), voices);
          return sendJson(res, 200, { answer });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // AGT-11: divide a whole-defence take into its questions, by the
  // session's model with the professor's presses as hints; or say the
  // split is right.
  {
    paths: ["/api/defence/split"],
    handle(c) {
      const { req, res, url, runId, workspace, root, harness } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return readBody(req)
        .then((text) => {
          const body = text ? JSON.parse(text) : {};
          const questionId = String(body.question ?? "");
          const take = Number(body.take);
          if (!/^Q\d+$/.test(questionId) || !Number.isInteger(take)) throw new Error("a question id and a take, please");
          if (body.action === "approve") return { split: approveSplit(target.place, questionId, take), notes: [] };
          return splitWhole(harness, target, url.searchParams.get("session") ?? "", questionId, take);
        })
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // AGT-7: the student's answer to the consent statement, as the professor
  // confirms it. The statement is written here, from the provider in use,
  // so what is recorded as agreed is what the student was actually told.
  {
    paths: ["/api/defence/consent"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return readBody(req)
        .then((text) => {
          const action = String((text ? JSON.parse(text) : {}).action ?? "");
          const at = new Date().toISOString();
          if (action === "withdraw") {
            withdrawConsent(target.place, at);
          } else if (action === "agree" || action === "decline") {
            const transcription = transcriptionInfo();
            recordConsent(target.place, target.ids, {
              agreed: action === "agree",
              at,
              statement: statementFor(transcription),
              provider: transcription.error ? transcription.configured?.name ?? null : transcription.name,
            });
          } else {
            throw new Error(`${action || "nothing"} is not an answer to the consent statement`);
          }
          return sendJson(res, 200, { consent: readSession(target.place.session)?.consent ?? null });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // The hands-free desk's two writes: what to ask next, chosen by the
  // session's model (AGT-2), and what the professor did instead (AGT-3).
  {
    paths: ["/api/defence/next","/api/defence/override"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root, harness } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/defence/next") {
        const after = url.searchParams.get("after") || null;
        if (after !== null && !/^Q\d+$/.test(after)) return sendJson(res, 200, { error: `${after} is not a question id` });
        return chooseNext(harness, target, root, url.searchParams.get("session") ?? "", after)
          .then((chosen) => sendJson(res, 200, chosen))
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return readBody(req)
        .then((text) => {
          const body = text ? JSON.parse(text) : {};
          const override = String(body.override ?? "");
          if (!["skip", "edit", "ask_now", "pause"].includes(override)) throw new Error(`${override} is not an override`);
          const question =
            override === "edit" ? editQuestion(target.place.questions, String(body.question ?? ""), String(body.text ?? "")) : null;
          if (Number.isInteger(body.index)) overrideDecision(target.place, body.index, override);
          return sendJson(res, 200, { ok: true, question });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // AGT-8: a streaming session for one take, where the connection can
  // stream (Scribe). The answer is a WebSocket URL holding a single-use
  // token, never the key; `unavailable` says why not, and the desk then
  // falls back to the five-second captions.
  {
    paths: ["/api/defence/realtime"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (!consentGiven(readSession(target.place.session))) {
        return sendJson(res, 200, { unavailable: "no recorded consent" });
      }
      let config;
      try {
        config = configFromRegistry(null).config;
      } catch (error) {
        return sendJson(res, 200, { unavailable: String(error?.message ?? error) });
      }
      const languages = target.bundle.course?.language ?? [];
      return realtimeSession(config, { language: languages.length === 1 ? languages[0] : null })
        .then((session) =>
          sendJson(res, 200, session ? { session } : { unavailable: `${config.provider} does not stream; the captions come every few seconds instead` }),
        )
        .catch((error) => sendJson(res, 200, { unavailable: String(error?.message ?? error) }));
    },
  },
  // AGT-5: a caption for a few seconds of an answer still being given. The
  // piece is transcribed through the same connection and forgotten; see
  // `captionAudio` for why nothing of it is kept.
  {
    paths: ["/api/defence/caption"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      const mime = String(req.headers["content-type"] ?? "");
      return readBytes(req, 8 * 1024 * 1024)
        .then(async (bytes) => {
          const transcribe = transcriber(configFromRegistry(null).config);
          const languages = target.bundle.course?.language ?? [];
          const questionId = url.searchParams.get("question") ?? "";
          const question = (readDefence(target.place.questions)?.questions ?? []).find((q) => q.id === questionId);
          const caption = await captionAudio({
            place: target.place,
            bytes,
            mime,
            transcribe,
            language: languages.length === 1 ? languages[0] : null,
            prompt: question && question.kind !== "whole" ? question.text : null,
          });
          return sendJson(res, 200, caption);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  {
    paths: ["/api/defence/session","/api/defence/answer","/api/defence/audio"],
    handle(c) {
      const { req, res, url, path, runId, workspace, root } = c;
      let target;
      try {
        target = defenceTarget(workspace, root, runId, url.searchParams);
      } catch (error) {
        return path === "/api/defence/audio"
          ? send(res, 404, "text/plain; charset=utf-8", String(error?.message ?? error))
          : sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/defence/session") return sendJson(res, 200, defenceSessionPayload(target));
      if (path === "/api/defence/audio") {
        const file = url.searchParams.get("file") ?? "";
        const entry = (readSession(target.place.session)?.answers ?? []).find((answer) => answer.audio === file);
        // Only a file the session names, so the query cannot walk the folder.
        if (!entry || !existsSync(join(target.place.dir, entry.audio))) {
          return send(res, 404, "text/plain; charset=utf-8", "no such recording");
        }
        return send(res, 200, entry.mime, readFileSync(join(target.place.dir, entry.audio)));
      }
      // The answer itself: POST, the audio as the body.
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      const questionId = url.searchParams.get("question") ?? "";
      const mime = String(req.headers["content-type"] ?? "");
      const seconds = Number(url.searchParams.get("seconds") ?? "");
      // Where the professor held the speak key, as `1.2-3.4,8-9.5` seconds
      // from the start of the take (AGT-6). Anything malformed is dropped,
      // not guessed at.
      const professorSpoke = String(url.searchParams.get("professor") ?? "")
        .split(",")
        .map((part) => /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(part.trim()))
        .filter(Boolean)
        .map((match) => [Number(match[1]), Number(match[2])])
        .filter(([from, to]) => to > from)
        .slice(0, 200);
      // AGT-11: in a whole defence, where the professor pressed for a new
      // question, as `12.3:Q2,40.1` — seconds, and the question picked if any.
      const marks = String(url.searchParams.get("marks") ?? "")
        .split(",")
        .map((part) => /^(\d+(?:\.\d+)?)(?::(Q\d+))?$/.exec(part.trim()))
        .filter(Boolean)
        .map((match) => (match[2] ? { at: Number(match[1]), question_id: match[2] } : { at: Number(match[1]) }))
        .slice(0, 200);
      return readBytes(req, 64 * 1024 * 1024)
        .then(async (bytes) => {
          const { answer } = saveAnswer({
            place: target.place,
            ids: target.ids,
            questionId,
            bytes,
            mime,
            seconds: Number.isFinite(seconds) ? seconds : null,
            professorSpoke,
            marks,
            // When listening began, for the replay; an epoch in milliseconds.
            askedAt: /^\d{10,14}$/.test(url.searchParams.get("asked") ?? "")
              ? new Date(Number(url.searchParams.get("asked"))).toISOString()
              : null,
          });
          let transcribe;
          try {
            transcribe = transcriber(configFromRegistry(null).config);
          } catch (error) {
            // Kept, and said: the recording is safe, and `defence transcribe`
            // reads it once a provider is configured.
            const kept = setTranscript(target.place, answer.question_id, answer.take, {
              error: String(error?.message ?? error),
            });
            return sendJson(res, 200, { answer: kept });
          }
          const languages = (target.bundle.course?.language ?? []);
          const question = (readDefence(target.place.questions)?.questions ?? []).find((q) => q.id === questionId);
          const done = await transcribeTake({
            place: target.place,
            answer,
            transcribe,
            question,
            language: languages.length === 1 ? languages[0] : null,
          });
          return sendJson(res, 200, { answer: done });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // *Start defence*: clone the fork a student handed in, pinned to the hand-in
  // (`ainar defence prepare`). No judgement, and it writes the private
  // folder, so it runs here in the harness's process, as `scans read` does;
  // the questions are the session's to draft afterwards. POST, for
  // `/api/publish`'s reason: it reaches out to GitHub.
  {
    paths: ["/api/defence/prepare"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      const assessmentId = url.searchParams.get("assessment") ?? "";
      const studentId = url.searchParams.get("student") ?? "";
      if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
        return sendJson(res, 200, { error: "An assessment and a student id, please." });
      }
      try {
        loadedRun(workspace, runId); // the run has to be this workspace's
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return runScans(["defence", "prepare", runId, "--assessment", assessmentId, "--student", studentId], root)
        .then((result) =>
          sendJson(res, 200, {
            ...result,
            // What the session is asked next, decided here so the browser half
            // carries no vocabulary of its own.
            ask: result.ok ? `/defend-submission ${assessmentId} ${runId} ${studentId}` : null,
          }),
        )
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // *Defended* / *Not defended* in the Students view: the professor's word,
  // set on the submission by `ainar defence mark`. A press is the decision,
  // so nothing is drafted and nothing waits for approval.
  // A fork the student brought in person, pasted in the Students view:
  // `ainar defence fork` puts the link on their submission, or makes one.
  {
    paths: ["/api/defence/fork"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      const assessmentId = url.searchParams.get("assessment") ?? "";
      const studentId = url.searchParams.get("student") ?? "";
      const link = (url.searchParams.get("url") ?? "").trim();
      // Audio defence on a homework with nothing handed in: a submission with no link.
      const inPerson = url.searchParams.get("inperson") === "1";
      if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
        return sendJson(res, 200, { error: "An assessment and a student id, please." });
      }
      if (!inPerson && !/^https:\/\/\S{3,300}$/.test(link)) return sendJson(res, 200, { error: "A fork link starts with https://" });
      try {
        loadedRun(workspace, runId); // the run has to be this workspace's
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return runScans(
        ["defence", "fork", runId, "--assessment", assessmentId, "--student", studentId, ...(inPerson ? ["--in-person"] : ["--url", link])],
        root,
      )
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  // *Find forks* in the Students view: the starter's public forks, looked up
  // on GitHub (`ainar homework forks`) and kept beside the submissions, so
  // the professor picks a student's fork rather than pasting its link.
  // POST, for `/api/defence/prepare`'s reason: it reaches out to GitHub.
  {
    paths: ["/api/homework/forks"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (assessmentId && !/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: "An assessment id, please." });
      }
      try {
        loadedRun(workspace, runId); // the run has to be this workspace's
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return runScans(["homework", "forks", runId, ...(assessmentId ? ["--assessment", assessmentId] : [])], root)
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  {
    paths: ["/api/defence/mark"],
    handle(c) {
      const { req, res, url, runId, workspace, root } = c;
      if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
      const assessmentId = url.searchParams.get("assessment") ?? "";
      const studentId = url.searchParams.get("student") ?? "";
      const outcome = url.searchParams.get("outcome") ?? "";
      // With a criterion, one line of the rubric checked at the defence.
      const criterionId = url.searchParams.get("criterion") ?? "";
      const score = url.searchParams.get("score") ?? "";
      if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
        return sendJson(res, 200, { error: "An assessment and a student id, please." });
      }
      if (criterionId && !/^CRIT-[A-Z0-9][A-Z0-9-]*$/.test(criterionId)) {
        return sendJson(res, 200, { error: "A criterion id, please." });
      }
      if (score && !/^\d+(\.\d+)?$/.test(score)) return sendJson(res, 200, { error: "A score is a number." });
      const outcomes = criterionId ? ["confirmed", "partly", "not_confirmed", "clear"] : ["defended", "not_defended", "clear"];
      if (!outcomes.includes(outcome)) return sendJson(res, 200, { error: outcomes.join(", ") + "." });
      try {
        loadedRun(workspace, runId); // the run has to be this workspace's
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return runScans(
        [
          "defence", "mark", runId, "--assessment", assessmentId, "--student", studentId, "--outcome", outcome,
          ...(criterionId ? ["--criterion", criterionId] : []),
          ...(score ? ["--score", score] : []),
        ],
        root,
      )
        .then((result) => sendJson(res, 200, result))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
