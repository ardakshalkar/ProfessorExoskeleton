/**
 * The host half of the professor's visualization pane.
 *
 * It registers one prefix route and nothing else. Everything the pane draws
 * comes back through `/professor-pane/...`, and nearly everything behind that
 * route is a read: `callTool` from `dsh-ainar-course-model`, which is read-only
 * by construction, plus the preference and record files, read with
 * `readFileSync`.
 *
 * Four exceptions, and each one's own header argues for itself:
 *
 * * `/api/publish` spawns `ainar publish`. It publishes what the professor has
 *   accepted and names every record still marked `approval: draft` as left
 *   out; it accepts nothing on anybody's behalf. See `runPublish`.
 * * `/api/preferences` writes a preference layer. A preference is how the
 *   professor wants the skills to behave, not a claim about a student, so there
 *   is nothing in it for `approve` to gate.
 * * `/api/canvas/selection` writes `extensions.lms.canvas_sections` on the run
 *   record — which Canvas section feeds which subgroup. A fact about the
 *   professor's own LMS that no skill drafts and no agent can propose, and
 *   therefore one with no drafted half for `approve` to promote.
 * * `/api/canvas/catalogue` is the only outbound request in this plugin: two
 *   read-only Canvas endpoints, POST so that no link, prefetch or refresh can
 *   spend the professor's token.
 *
 * What is still true, and is the line worth keeping: **nothing here can accept
 * a draft, and nothing here can push a grade.** Accepting a record is changing
 * `approval: draft` in the file it lives in — or, for a grade, recording the
 * decision beside the AI suggestion — and the professor does that, not a route.
 *
 * Why HTTP rather than a service the browser half calls: four of the views this
 * pane switches between are already written. `dsh-ainar-course-model` ships
 * four widget documents — `course-outline`, `class-progress`, `gradebook`,
 * `action-inbox` — assembled from `widget-assets/`, and DSH renders none of
 * them. They are, in that plugin's own words, "inert, not broken".
 *
 * Not because DSH cannot render a tool's own view. It can: `dsh-client-ui-tool`
 * exposes a `tool.call.toolview` slot where the package owning a tool registers
 * a view for it by wire name. What DSH has no place for is the *metadata* —
 * `presentationMeta` is the MCP-app contract, and the render intents a tool may
 * return are a closed set (`generic`, `terminal`, `diff`, `search`, `read`,
 * `web`), none of which carries a document.
 *
 * So the native route exists and is the wrong shape for what we have. It wants
 * a component in the client runtime; we have four hundred lines of view code
 * already written against a plain HTML document, which the MCP hosts still
 * read. Serving each one as a document at a URL and pointing an iframe at it
 * keeps that copy the only one — the alternative is a second, in React, that a
 * professor would eventually see disagree with itself.
 *
 * This file is the route table — `handler` and `apply`. What each route
 * assembles lives in `server/`, one module per concern; the processes the write
 * routes spawn are in `server/actions.js`.
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
import { Ledger } from "@ainar/core/src/lms/ledger.ts";
import { refuseInsideRepo } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";
import { BY_TOOL } from "@ainar/core/src/tools/widgets.ts";
import {
  configFromRegistry,
  realtimeSession,
  transcriber,
} from "@ainar/core/src/transcribe.ts";
import { ToolError } from "@ainar/core/src/workspace.ts";

import {
  DOTS_BUNDLE,
  readSummary,
  runAssignmentPush,
  runMarksPush,
  runPublish,
  runScans,
} from "./server/actions.js";
import { checklistDocument, readyDocument } from "./server/checklist.js";
import {
  addConnection,
  canvasAssignmentList,
  canvasCourseList,
  canvasWhoAmI,
  connectionNameFor,
  moodleWhoAmI,
  spreadsheetIdFrom,
  telegramWhoAmI,
} from "./server/connections.js";
import { courseModeDocument } from "./server/course-mode.js";
import {
  assessmentsDocument,
  examsDocument,
  gradingDocument,
  slidesDocument,
} from "./server/course-views.js";
import {
  chooseNext,
  defenceReader,
  defenceSessionPayload,
  defenceTarget,
  splitWhole,
  statementFor,
  transcriptionInfo,
} from "./server/defence-desk.js";
import { answerPage, gradeDocument, groupsStamp } from "./server/grade.js";
import { BASE, readBody, readBytes, send, sendErrorPage, sendJson } from "./server/http.js";
import {
  canvasSettings,
  CREDENTIAL_REF,
  credentialRefsIn,
  integrationsAnswer,
  integrationsDocument,
  resolveCredential,
} from "./server/integrations.js";
import {
  canvasCatalogue,
  recordAssessmentLinks,
  writeCanvasCourses,
  writeCanvasSelection,
  writeRunLmsValue,
} from "./server/lms-writes.js";
import { withMaterialLinks } from "./server/materials.js";
import { widgetDocument } from "./server/page.js";
import { preferencesDocument, writePreferences } from "./server/preferences.js";
import { paperCrop, scansDocument } from "./server/scans.js";
import { sendBrief, sendMaterial, sendOutline, sendStarter } from "./server/serve-file.js";
import { studentScreenPage } from "./server/student-screen.js";
import { studentsDocument } from "./server/students.js";
import { runSyncAction, syncsDocument } from "./server/syncs.js";
import { unpublishedDocument } from "./server/unpublished.js";
import { checkUpload, receiveFile, storeUpload, uploadFolder } from "./server/upload.js";
import { assessmentStatus } from "./server/week-status.js";
import {
  loadedRun,
  payload,
  resolveWorkspace,
  revisionDocument,
  rosterDir,
  runsDocument,
  viewPayload,
  VIEWS,
  withRecordPaths,
  withStudentNames,
} from "./server/workspace.js";

export const name = "professor-pane";

/**
 * The route registry, and the workspace registry.
 *
 * `workspaceRegistry` is how a request naming a session turns into a directory
 * on disk WITHOUT a path ever crossing from the browser: the pane sends the
 * session id it already has, and this side asks dsh which workspace accounts
 * for it. A `workspace=<path>` parameter would have been fewer lines and a
 * standing invitation to read any directory on the machine by crafting one
 * request — the routes here open YAML and print it, so the parameter would be
 * the read primitive. A session id resolves only to a folder the professor
 * registered in the sidebar, and to nothing else.
 */
export const inject = ["webServer", "workspaceRegistry"];

/**
 * The one route. A prefix rather than five exact ones because the paths under
 * it are this file's own vocabulary and a collision inside it is a typo, not
 * the composition-level contract `webServer.register` is protecting.
 */
const handler = (registry, credentials = { service: null }, harness = { llm: null, sessions: null, defaults: null }) => (req, res) => {
  let url;
  try {
    url = new URL(req.url ?? "/", "http://localhost");
  } catch {
    return sendJson(res, 400, { error: "unreadable request URL" });
  }
  const path = url.pathname.slice(BASE.length) || "/";
  const runId = url.searchParams.get("run") ?? "";
  // Which shape a failure takes on this path, decided once: a `/view/` request
  // is an iframe's and gets a page, everything else is a `fetch` and gets JSON.
  const view = path.startsWith("/view/") ? path.slice("/view/".length) : null;
  const fail = (text) =>
    view === null ? sendJson(res, 200, { error: text }) : sendErrorPage(res, text);

  let resolved;
  try {
    // The session the pane is mounted in. `details` is a session-scoped slot, so
    // the browser half always has one; a request without it is still answered,
    // from AINAR_WORKSPACE, because the route is reachable outside the pane.
    resolved = resolveWorkspace(registry, url.searchParams.get("session") ?? "");
  } catch (error) {
    // 200 with the sentence, not 4xx: this is the answer to the pane's
    // question and the pane draws it as prose. A status code would make the
    // browser half decide between "the harness is misconfigured" and "the
    // route is gone", which it cannot tell apart and should not have to.
    return fail(String(error.message ?? error));
  }
  const { workspace, root } = resolved;

  try {
    if (path === "/api/runs") {
      return sendJson(res, 200, runsDocument(workspace, root));
    }

    if (path === "/api/revision") {
      return sendJson(res, 200, revisionDocument(root));
    }

    /**
     * One file, as the raw request body: `?run=&kind=scans|paper&name=`.
     *
     * Raw rather than multipart, one file a request, because the browser half
     * sends a `File` as it is and a multipart parser is a dependency this
     * plugin would otherwise not have. The destination is never the caller's:
     * `kind` picks one of two folders under the private submissions directory,
     * and `name` is only ever the original filename, reduced to a safe one (a
     * scan's is replaced outright — see server/upload.js for why).
     *
     * The run has to be one this workspace has, so a request cannot make a
     * folder for a course run nobody opened. The answer is where the file is,
     * which the browser half then puts in a message to the agent.
     */
    if (path === "/api/upload") {
      if (req.method !== "POST") return sendJson(res, 200, { error: "An upload is a POST." });
      const kind = url.searchParams.get("kind") ?? "";
      const original = url.searchParams.get("name") ?? "";
      const refused = checkUpload(kind, original);
      if (refused) return sendJson(res, 200, { error: refused });
      const known = (runsDocument(workspace, root).courses ?? []).some((course) =>
        (course.runs ?? []).some((run) => run.run_id === runId),
      );
      if (!known) return sendJson(res, 200, { error: `This workspace has no course run ${runId || "(none given)"}.` });
      let folder;
      try {
        const submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
        folder = uploadFolder(submissions, runId, kind);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      return receiveFile(req, folder)
        .then((received) =>
          sendJson(res, 200, {
            ok: true,
            kind,
            run: runId,
            folder,
            ...storeUpload({ kind, folder, original, received, now: new Date().toISOString() }),
          }),
        )
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Paper exams — see server/scans.js. One read, one picture, two writes.
     *
     * The writes spawn the CLI, as Publish does: `scans assign` says who one
     * paper is (taking back a wrong placement first), then places it by the
     * same rules `scans apply` places every paper. None of them is an approval
     * path — a paper handed in is a fact, its answers stay `approval: draft`,
     * and a placement with an evaluation on it is refused, not undone.
     */
    /**
     * What is not out yet — see server/unpublished.js. A read of local files
     * only: the gradebook, the sync ledger, the record's drafts and the
     * checksums of what was last published. Canvas is not asked.
     */
    if (path === "/api/unpublished") {
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      try {
        return sendJson(
          res,
          200,
          unpublishedDocument({ bundle: loadedRun(workspace, runId).bundle, runId, root, ledger: Ledger.load(runId) }),
        );
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
    }

    // The defence desk: what was asked and answered, a recorded answer, and
    // its audio played back. Everything here reads or writes the private
    // folder, which is why it is the pane's and not the session's. The answer
    // is transcribed in this process too — no judgement in it, and the
    // provider is the professor's `transcription` connection.
    // The dots animation on the defence desk: `dots-swarm` (MIT), bundled once
    // into vendor/ by vendor/build-dots.mjs. A script with no data in it.
    if (path === "/vendor/dots-swarm.js") {
      try {
        return send(res, 200, "text/javascript; charset=utf-8", readFileSync(DOTS_BUNDLE));
      } catch {
        return send(res, 404, "text/plain; charset=utf-8", "the dots bundle is not built");
      }
    }

    // The student's screen (AGT-4): a page with no data in it. Everything it
    // shows arrives from the desk over a BroadcastChannel; see
    // server/student-screen.js for why it fetches nothing.
    if (path === "/defence/screen") {
      const assessmentId = url.searchParams.get("assessment") ?? "";
      const studentId = url.searchParams.get("student") ?? "";
      if (!/^ASSESSMENT-[A-Z0-9][A-Z0-9-]*$/.test(assessmentId) || !/^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(studentId)) {
        return send(res, 400, "text/plain; charset=utf-8", "An assessment and a student id, please.");
      }
      return send(res, 200, "text/html; charset=utf-8", studentScreenPage({ assessmentId, studentId }));
    }

    // DEF-6, recorded defences uploaded afterwards. The steps are `ainar
    // defence batch`, run here because they write the private folder: plan
    // (lengths and costs, nothing sent), apply (with the consent the
    // professor confirms), transcribe (a quote, and only with confirm a send).
    if (path === "/api/defence/batch") {
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
    }

    // The whole defence in one recording: make sure Q0 exists, so the desk can
    // record into it; and "this voice is me", which labels a take's voices
    // again with no provider call.
    if (path === "/api/defence/whole" || path === "/api/defence/voices") {
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
    }

    // AGT-11: divide a whole-defence take into its questions, by the
    // session's model with the professor's presses as hints; or say the
    // split is right.
    if (path === "/api/defence/split") {
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
    }

    // AGT-7: the student's answer to the consent statement, as the professor
    // confirms it. The statement is written here, from the provider in use,
    // so what is recorded as agreed is what the student was actually told.
    if (path === "/api/defence/consent") {
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
    }

    // The hands-free desk's two writes: what to ask next, chosen by the
    // session's model (AGT-2), and what the professor did instead (AGT-3).
    if (path === "/api/defence/next" || path === "/api/defence/override") {
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
    }

    // AGT-8: a streaming session for one take, where the connection can
    // stream (Scribe). The answer is a WebSocket URL holding a single-use
    // token, never the key; `unavailable` says why not, and the desk then
    // falls back to the five-second captions.
    if (path === "/api/defence/realtime") {
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
    }

    // AGT-5: a caption for a few seconds of an answer still being given. The
    // piece is transcribed through the same connection and forgotten; see
    // `captionAudio` for why nothing of it is kept.
    if (path === "/api/defence/caption") {
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
    }

    if (path === "/api/defence/session" || path === "/api/defence/answer" || path === "/api/defence/audio") {
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
    }

    // *Start defence*: clone the fork a student handed in, pinned to the hand-in
    // (`ainar defence prepare`). No judgement, and it writes the private
    // folder, so it runs here in the harness's process, as `scans read` does;
    // the questions are the session's to draft afterwards. POST, for
    // `/api/publish`'s reason: it reaches out to GitHub.
    if (path === "/api/defence/prepare") {
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
    }

    if (path === "/api/scans" || path.startsWith("/api/scans/")) {
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (assessmentId && !/^[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: `${assessmentId} is not an assessment id.` });
      }
      let submissions;
      try {
        submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/scans") {
        return sendJson(
          res,
          200,
          scansDocument({
            loaded: loadedRun(workspace, runId),
            runId,
            submissions,
            rosterDirectory: rosterDir(),
            assessmentId,
            names: url.searchParams.get("names") === "1",
          }),
        );
      }
      if (path === "/api/scans/crop") {
        try {
          const png = paperCrop({
            submissions,
            runId,
            assessmentId,
            file: url.searchParams.get("file") ?? "",
            pages: url.searchParams.get("pages") ?? "",
            whole: url.searchParams.has("whole") ? Number(url.searchParams.get("whole")) : null,
          });
          return send(res, 200, "image/png", png);
        } catch (error) {
          return send(res, 404, "text/plain; charset=utf-8", String(error?.message ?? error));
        }
      }
      // Reading and recording the answers involve no judgement: `scans read`
      // then `scans record`, run here rather than asked of the assistant. Here
      // they run in the harness's process, which can write the private
      // folder; the assistant's sandbox cannot, and would ask for each call.
      // A pile takes minutes, hence the long timeout.
      if (path === "/api/scans/read") {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        if (!assessmentId) return sendJson(res, 200, { error: "No assessment given." });
        loadedRun(workspace, runId);
        const scope = ["--assessment", assessmentId];
        return runScans(["scans", "read", runId, ...scope], root, 1800000)
          .then((read) =>
            read.ok
              ? runScans(["scans", "record", runId, ...scope], root).then((record) => ({
                  ok: record.ok,
                  exitCode: record.exitCode,
                  command: `${read.command} && ${record.command}`,
                  output: [readSummary(read.output), record.output].filter(Boolean).join("\n\n"),
                }))
              : read,
          )
          .then((result) => sendJson(res, 200, result))
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      if (path === "/api/scans/assign" || path === "/api/scans/apply") {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        if (!assessmentId) return sendJson(res, 200, { error: "No assessment given." });
        loadedRun(workspace, runId); // the run has to be this workspace's
        return readBody(req)
          .then((text) => {
            const body = text ? JSON.parse(text) : {};
            const args = ["scans", path.endsWith("assign") ? "assign" : "apply", runId, "--assessment", assessmentId];
            if (path.endsWith("assign")) {
              // One answer, or `papers: [...]` from the review's Confirm — sent
              // to the CLI as one list, so it is checked whole and applied once.
              const answers = (Array.isArray(body.papers) ? body.papers : [body]).map((entry) => {
                const pages = String(entry.pages ?? "");
                if (!/^[\d ,-]{1,40}$/.test(pages)) throw new Error("No paper given.");
                const answer = { pages };
                if (entry.file) {
                  if (!/^[\w.-]+\.pdf$/i.test(String(entry.file))) throw new Error("Not a scan's file name.");
                  answer.file = String(entry.file);
                }
                const pseudonym = (value) => {
                  if (!/^STUDENT-[A-Z0-9]+$/.test(String(value))) throw new Error("Not a pseudonym.");
                  return String(value);
                };
                if (entry.student) answer.student = pseudonym(entry.student);
                else if (entry.reject) answer.reject = pseudonym(entry.reject);
                else if (entry.skip) answer.skip = String(entry.skip).slice(0, 200);
                else throw new Error("Say who the paper is, who it is not, or that it is nobody's.");
                return answer;
              });
              if (!answers.length || answers.length > 500) throw new Error("No papers given.");
              args.push("--assignments", JSON.stringify(answers));
            }
            return runScans(args, root).then((result) => sendJson(res, 200, result));
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return sendJson(res, 200, { error: `no route ${path}` });
    }

    /**
     * Grading a written exam, question by question — see server/grade.js. One
     * read, one picture, four writes.
     *
     * The writes spawn `ainar grade …`, as Scans spawns `ainar scans …`. One of
     * them, `decide`, writes a professor_decision: this is the pane's one
     * route that records a grade, and it does so only because the professor
     * pressed — a card, a group's Accept, or Accept all, which the CLI keeps
     * beside the decision as `decided_via`. A decision it replaces is kept in
     * the evaluation's history. Nothing here pushes a grade anywhere.
     */
    if (path === "/api/grade" || path.startsWith("/api/grade/")) {
      const assessmentId = url.searchParams.get("assessment") ?? "";
      if (!/^[A-Z0-9][A-Z0-9-]*$/.test(assessmentId)) {
        return sendJson(res, 200, { error: assessmentId ? `${assessmentId} is not an assessment id.` : "No assessment given." });
      }
      let submissions;
      try {
        submissions = submissionsDir(null);
        refuseInsideRepo(submissions, root);
      } catch (error) {
        return sendJson(res, 200, { error: String(error?.message ?? error) });
      }
      if (path === "/api/grade") {
        try {
          return sendJson(
            res,
            200,
            gradeDocument({
              loaded: loadedRun(workspace, runId),
              runId,
              submissions,
              rosterDirectory: rosterDir(),
              assessmentId,
              names: url.searchParams.get("names") === "1",
            }),
          );
        } catch (error) {
          return sendJson(res, 200, { error: String(error?.message ?? error) });
        }
      }
      // When the grouping last changed. groups.yaml is private, so the course's
      // revision poll never sees the assistant rewrite it; the Grade view asks
      // this instead, and reloads when it moves.
      if (path === "/api/grade/stamp") {
        try {
          return sendJson(res, 200, { groups: groupsStamp({ submissions, runId, assessmentId }) });
        } catch (error) {
          return sendJson(res, 200, { error: String(error?.message ?? error) });
        }
      }
      if (path === "/api/grade/page") {
        try {
          const png = answerPage({
            submissions,
            runId,
            assessmentId,
            student: url.searchParams.get("student") ?? "",
            page: url.searchParams.get("page") ?? "1",
            names: url.searchParams.get("names") === "1",
          });
          return send(res, 200, "image/png", png);
        } catch (error) {
          return send(res, 404, "text/plain; charset=utf-8", String(error?.message ?? error));
        }
      }
      const WRITES = ["/api/grade/decide", "/api/grade/move", "/api/grade/choose", "/api/grade/accept-rubric", "/api/grade/points-only"];
      if (WRITES.includes(path)) {
        if (req.method !== "POST") return sendJson(res, 200, { error: "This is a POST." });
        loadedRun(workspace, runId); // the run has to be this workspace's
        return readBody(req)
          .then((text) => {
            const body = text ? JSON.parse(text) : {};
            const sub = path.slice("/api/grade/".length);
            const args = ["grade", sub, runId, "--assessment", assessmentId];
            const itemId = (value) => {
              if (!/^ITEM-[A-Z0-9][A-Z0-9-]*$/.test(String(value))) throw new Error("Not a question id.");
              return String(value);
            };
            const pseudonym = (value) => {
              if (!/^STUDENT-[A-Z0-9]+$/.test(String(value))) throw new Error("Not a pseudonym.");
              return String(value);
            };
            const score = (value) => {
              const number = Number(value);
              if (!Number.isFinite(number) || number < 0 || number > 1000) throw new Error("Not a score.");
              return number;
            };
            if (sub === "decide") {
              const list = Array.isArray(body.decisions) ? body.decisions : [];
              if (!list.length || list.length > 2000) throw new Error("No marks given.");
              const decisions = list.map((entry) => ({
                student: pseudonym(entry.student),
                item: itemId(entry.item),
                score: score(entry.score),
                ...(entry.comment ? { comment: String(entry.comment).slice(0, 2000) } : {}),
              }));
              const via = ["one", "group", "all"].includes(body.via) ? body.via : "one";
              args.push("--decisions", JSON.stringify(decisions), "--via", via);
            } else if (sub === "choose") {
              if (!/^[A-Za-z0-9][\w-]{0,30}$/.test(String(body.proposal ?? ""))) throw new Error("Not a proposal id.");
              args.push("--proposal", String(body.proposal));
              if (Array.isArray(body.items) && body.items.length) args.push("--item", body.items.map(itemId).join(","));
              else if (body.item) args.push("--item", itemId(body.item));
              if (body.keepMarks === true) args.push("--keep-marks");
              if (body.accept === true) args.push("--accept");
            } else if (sub === "move") {
              args.push("--item", itemId(body.item));
              if (body.student) {
                args.push("--student", pseudonym(body.student));
                if (body.to === null || body.to === undefined) args.push("--ungroup");
                else args.push("--to", String(Math.trunc(score(body.to)) + 1));
              } else {
                args.push("--group", String(Math.trunc(score(body.group)) + 1));
                if (body.score === null || body.score === undefined) args.push("--unscored");
                else args.push("--score", String(score(body.score)));
              }
            }
            return runScans(args, root).then((result) => sendJson(res, 200, result));
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }
      return sendJson(res, 200, { error: `no route ${path}` });
    }

    if (path === "/api/preferences") {
      const course = url.searchParams.get("course") ?? "";
      const term = url.searchParams.get("term") ?? "";

      // A write, and therefore POST only, for `/api/publish`'s reason: a GET
      // that changes a file is one a link, a prefetch or a refresh can fire
      // without anybody having decided to.
      if (req.method === "POST") {
        return readBody(req)
          .then((text) => {
            let body;
            try {
              body = JSON.parse(text || "{}");
            } catch {
              return sendJson(res, 200, { error: "The preferences body is not JSON." });
            }
            const result = writePreferences(
              root,
              String(body.scope ?? ""),
              course,
              term,
              body.values ?? {},
            );
            if (result.error) return sendJson(res, 200, result);
            // The layers as they now are, in the same response. The form is
            // drawn from them, so re-reading here is what makes a Save show
            // the file rather than the browser's memory of it.
            return sendJson(res, 200, {
              ...preferencesDocument(root, course, term),
              saved: result,
            });
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }

      return sendJson(res, 200, preferencesDocument(root, course, term));
    }

    // The Syncs view: every road to a service outside the run, and the
    // matches waiting for the professor. Read here; every press is
    // `ainar sync …` — see server/syncs.js.
    if (path === "/api/syncs") {
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return sendJson(res, 200, syncsDocument(workspace, runId, { names: url.searchParams.get("names") === "1" }));
    }

    // POST only, for `/api/publish`'s reason: a run can reach Canvas or a
    // sheet, and a confirm writes the private link table.
    if (path === "/api/syncs/action") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "a sync action is POST only" });
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await runSyncAction(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/api/integrations") {
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return integrationsAnswer(workspace, root, runId, credentials)
        .then((answer) => sendJson(res, 200, answer))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The credential write. POST only, and the only route in this plugin that
     * accepts a secret.
     *
     * Three properties it has to keep, and each is a line below:
     *
     * **It only ever writes.** No GET returns a value, the response is the
     * redrawn document with presence in it, and nothing is logged. A pane that
     * could read a token back would be a pane that shows one on a screen that
     * gets shared.
     *
     * **It writes only variables the registry names.** Anything else would
     * make this a general-purpose secret writer for any environment variable
     * on the machine, reachable from a browser. The registry's `tokenEnv`
     * values are the whole allowed set.
     *
     * **It refuses rather than pretends.** The seam rejects a write under a
     * shadowing read-only layer, and that rejection is passed through with its
     * reason instead of being turned into a success the professor would
     * discover was a lie the next time a push failed.
     */
    if (path === "/api/credentials") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting a credential is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      if (!credentials.service) {
        return sendJson(res, 200, {
          error:
            "No credential provider is mounted in this composition, so there is nowhere " +
            "to save a token. Export it in the environment instead — `ainar connections " +
            "show NAME` prints which variable.",
        });
      }

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The credential body is not JSON." });
          }

          const ref = String(body.ref ?? "").trim();
          const document = integrationsDocument(workspace, root, runId);
          if (!CREDENTIAL_REF.test(ref) || !credentialRefsIn(document).includes(ref)) {
            return sendJson(res, 200, {
              error:
                `'${ref}' is not a variable any connection in this run names. This route ` +
                "writes only those, so that it cannot be used to set anything else on the machine.",
            });
          }

          // A value that is only whitespace is a clearing, not a credential.
          // The seam treats an empty stored value as absent everywhere, so
          // writing one would leave a record that reads as unconfigured —
          // removing it says the same thing without the litter.
          const value = String(body.value ?? "");
          try {
            if (value.trim()) await credentials.service.set(ref, value.trim());
            else await credentials.service.unset(ref);
          } catch (error) {
            return sendJson(res, 200, { error: String(error?.message ?? error) });
          }

          // Presence only, never the value.
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              saved: { ref, cleared: !value.trim() },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Set an integration up from nothing, or fill in the half that is missing.
     *
     * One route for every provider rather than one each, because the shape is
     * the same for all of them and the differences are three lines apiece:
     * what identifies the destination, where that fact belongs, and what
     * question proves the credential works.
     *
     * The two halves always go to two different places, which is the point of
     * the registry. What identifies the destination is configuration — a host,
     * a channel, a spreadsheet — and lands in the connections registry or the
     * run record. The token is a credential and goes through the seam into the
     * harness's store. Neither lands in this repository.
     *
     * Ordered destination-then-token-then-check, and the order matters. The
     * destination first means a professor who mistypes the token still has the
     * rest recorded and only retries the half that failed. The check last is
     * what lets the answer say "Telegram answered as @course_bot" rather than
     * "saved" — a host with a typo and a token that is fine look identical in
     * a config file and differ the moment something asks.
     */
    if (path === "/api/integrations/setup") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting an integration up is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The setup body is not JSON." });
          }

          const provider = String(body.provider ?? "").trim();
          const token = String(body.token ?? "").trim();
          const baseUrl = String(body.baseUrl ?? "").trim();
          const chatId = String(body.chatId ?? "").trim();
          const sheetId = spreadsheetIdFrom(body.sheetId);

          if (!["canvas", "telegram", "moodle", "sheets"].includes(provider)) {
            return sendJson(res, 200, { error: `'${provider}' is not an integration this pane sets up.` });
          }

          // ---- the destination ------------------------------------------
          let connectionName = null;
          if (provider === "sheets") {
            if (sheetId) {
              const written = writeRunLmsValue(workspace, root, runId, "sheet_id", sheetId);
              if (written.error) return sendJson(res, 200, written);
            }
          } else {
            const identifier = provider === "telegram" ? chatId : baseUrl;
            if (!identifier) {
              return sendJson(res, 200, {
                error:
                  provider === "telegram"
                    ? "A channel is needed — the @name the bot posts to, or its numeric id."
                    : `A ${provider} address is needed — the one you open it at.`,
              });
            }
            connectionName =
              provider === "telegram"
                ? `telegram-${chatId.replace(/^@/, "").toLowerCase()}`
                : connectionNameFor(provider, baseUrl);
            const added = await addConnection(root, {
              name: connectionName,
              type: provider,
              baseUrl: provider === "telegram" ? null : baseUrl,
              chatId: provider === "telegram" ? chatId : null,
              // The first of a type is the one every command should reach
              // without being told. A second one has to be named.
              makeDefault: true,
            });
            if (added.error) return sendJson(res, 200, { error: added.error });
          }

          // ---- the credential -------------------------------------------
          const variable = {
            canvas: "AINAR_CANVAS_TOKEN",
            telegram: "AINAR_TELEGRAM_BOT_TOKEN",
            moodle: "AINAR_MOODLE_TOKEN",
            sheets: "AINAR_SHEETS_TOKEN",
          }[provider];

          if (token) {
            if (!credentials.service) {
              return sendJson(res, 200, {
                error:
                  "The rest was saved, but no credential provider is mounted, so the " +
                  `token could not be. Export ${variable} instead.`,
              });
            }
            try {
              await credentials.service.set(variable, token);
            } catch (error) {
              return sendJson(res, 200, {
                error: `The rest was saved, but the token was not: ${String(error?.message ?? error)}`,
              });
            }
          }

          // ---- the check ------------------------------------------------
          let answered = null;
          let checkFailed = null;
          const live = await resolveCredential(credentials.service, variable);
          const fresh = canvasSettings();
          if (live) {
            try {
              if (provider === "canvas" && fresh.host) {
                answered = await canvasWhoAmI(fresh.host, live);
              } else if (provider === "telegram") {
                answered = await telegramWhoAmI(live);
              } else if (provider === "moodle" && baseUrl) {
                answered = await moodleWhoAmI(baseUrl, live);
              }
              // Sheets is not checked here, deliberately: proving a Google
              // token means reading a spreadsheet, and a green tick that
              // stands for nothing is worse than an honest silence.
            } catch (error) {
              checkFailed = String(error?.message ?? error);
            }
          }

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              setup: {
                provider,
                connection: connectionName,
                answered,
                checkFailed,
                tokenSaved: Boolean(token),
                checked: provider !== "sheets",
              },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The professor's own Canvas courses, so a subgroup is bound by name.
     *
     * POST for `canvasCatalogue`'s reason: it spends the professor's API quota
     * and sends their token, so it happens when they press for it and never
     * because a URL was visited.
     */
    if (path === "/api/canvas/courses") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas courses is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, {
          error: "No Canvas host is configured yet. Set one up above first.",
        });
      }
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then(async (token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Paste one into the ${settings.tokenEnv} field first.`,
            });
          }
          return sendJson(res, 200, { courses: await canvasCourseList(settings.host, usable) });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * The assignments of one Canvas course, for the binder below.
     *
     * Takes the course id rather than deriving it: with a Canvas course per
     * subgroup there are several, and the caller is binding one subgroup at a
     * time. POST for `canvasCatalogue`'s reason — it spends the professor's
     * quota and sends their token.
     */
    if (path === "/api/canvas/assignments") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "listing Canvas assignments is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const settings = canvasSettings();
      if (!settings.host) {
        return sendJson(res, 200, { error: "No Canvas host is configured yet." });
      }
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          const courseId = String(body.courseId ?? "").trim();
          if (!/^[0-9]+$/.test(courseId)) {
            return sendJson(res, 200, { error: "A numeric Canvas course id is needed." });
          }
          const token = await resolveCredential(credentials.service, settings.tokenEnv);
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error: `No Canvas token. Set ${settings.tokenEnv} first.`,
            });
          }
          return sendJson(res, 200, {
            courseId,
            assignments: await canvasAssignmentList(settings.host, usable, courseId),
          });
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Bind assessments to Canvas assignments.
     *
     * The body is `{links: {ASSESSMENT-01: "90218" | {CS-401: "90218"}}}` —
     * a string for a run that is one Canvas course, a mapping for one that is
     * several. An entry set to null clears the linkage.
     *
     * Writes into the assessment records, which is the one place in this pane
     * that edits a machine-managed record file. `recordAssessmentLinks` states
     * why that is defensible; the short version is that a Canvas id is a
     * pointer, not a decision.
     */
    if (path === "/api/canvas/assignment-map") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the assignment mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = recordAssessmentLinks(workspace, root, runId, body.links);
          if (result.error) return sendJson(res, 200, result);
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    /**
     * Bind each subgroup to its Canvas course.
     *
     * Writes `extensions.lms.canvas_courses` into the run record, which is
     * what `ainar lms push --group` reads. Unlike `canvas_sections` beside it,
     * this mapping is not decorative: with it set, a push refuses to run
     * without `--group` and carries only that subgroup's students.
     */
    if (path === "/api/canvas/course-map") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the subgroup mapping is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The mapping body is not JSON." });
          }
          const result = writeCanvasCourses(workspace, root, runId, body.mapping);
          if (result.error) return sendJson(res, 200, result);

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, { saved: result }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    // The live Canvas read, and the one outbound request in this plugin. POST
    // for `canvasCatalogue`'s reason: it spends the professor's API quota and
    // sends their token, so it happens when they press for it and never
    // because a URL was visited.
    if (path === "/api/canvas/catalogue") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas catalogue is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      const document = integrationsDocument(workspace, root, runId);
      const settings = canvasSettings();
      // Every precondition named separately, because "it did not work" is the
      // one answer this tab must never give: each of these is a different file
      // to go and edit.
      if (!document.canvasCourse.usable) {
        return sendJson(res, 200, {
          error: document.canvasCourse.fromColumn
            ? `This run's Canvas course is recorded as ${document.canvasCourse.fromColumn}, ` +
              "which is a handle rather than the numeric id the API takes. The number is in " +
              "the Canvas course URL; record it as `extensions.lms.canvas_course_id`."
            : "This run has no Canvas course id. It goes on the run record as " +
              "`extensions.lms.canvas_course_id`, and the number is in the Canvas course URL.",
        });
      }
      if (!settings.host) {
        return sendJson(res, 200, {
          error:
            "No Canvas host is configured. Either export AINAR_CANVAS_URL, or write " +
            `${settings.configPath} with a [canvas] table naming base_url.`,
        });
      }
      // Through the seam first, then what this process can see for itself.
      // `canvasSettings` reads `process.env`, which is only one of the two
      // layers a token can now live in — without this, a token the professor
      // had just saved in the field below would be reported missing by the
      // button beside it.
      return resolveCredential(credentials.service, settings.tokenEnv)
        .then((token) => {
          const usable = token || settings.token;
          if (!usable) {
            return sendJson(res, 200, {
              error:
                `No Canvas token. Paste one into the ${settings.tokenEnv} field above, or ` +
                `export ${settings.tokenEnv} in your shell. Canvas → Account → Settings → ` +
                "New Access Token. It can change grades, so keep it out of the repository.",
            });
          }
          return canvasCatalogue(document.canvasCourse.id, settings.host, usable).then((result) =>
            sendJson(res, 200, result),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    // The save. POST for `/api/publish`'s reason and one more of its own: this
    // is the only route in the pane that writes to `courses/`.
    if (path === "/api/canvas/assignment") {
      // POST only, for `/api/publish`'s reason: this one reaches outside the
      // machine, and with `--confirm` it changes what a class can see.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "assignment is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(res, 200, { error: "The request body must be an object." });
          }
          return runAssignmentPush(res, root, runId, body);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    // The marks. POST only: a plan makes Canvas answer, and a push changes what
    // every student in the class sees.
    if (path === "/api/canvas/marks") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "marks are POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then(async (raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          return sendJson(res, 200, await runMarksPush(workspace, root, runId, body ?? {}));
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/api/canvas/selection") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "the Canvas selection is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The selection body is not JSON." });
          }
          const result = writeCanvasSelection(workspace, root, runId, body.selections);
          if (result.error) return sendJson(res, 200, result);
          // The record as it now is, in the same response, for
          // `/api/preferences`' reason: the form is drawn from this, so
          // re-reading here is what makes a Save show the file rather than the
          // browser's memory of what was ticked.
          // The whole answer travels with every redraw, or saving a selection
          // would blank the credential and status blocks the browser half
          // draws from it.
          return integrationsAnswer(workspace, root, runId, credentials, { saved: result }).then(
            (answer) => sendJson(res, 200, answer),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/file") {
      return sendMaterial(
        res,
        workspace,
        root,
        url.searchParams.get("doc") ?? "",
        url.searchParams.get("dark") === "1",
        // Affirmative only, like `names=1` on the inbox: a URL replayed without
        // it serves the file itself, which is what every caller got before.
        url.searchParams.get("as") === "pdf",
      );
    }

    // What was read out of a deck, for a deck this course did not write.
    if (path === "/outline") {
      return sendOutline(
        res,
        workspace,
        root,
        url.searchParams.get("doc") ?? "",
        url.searchParams.get("dark") === "1",
      );
    }

    // The brief a piece of graded work carries as text rather than as a file.
    // Beside `/file` because it ends in the same overlay and obeys the same
    // rule: addressed by an identifier the course record already names.
    if (path === "/brief") {
      return sendBrief(
        res,
        workspace,
        root,
        runId,
        url.searchParams.get("assessment") ?? "",
        url.searchParams.get("drafts") === "1",
        url.searchParams.get("dark") === "1",
      );
    }

    // A homework's starter README, for work that names no brief document.
    if (path === "/starter") {
      return sendStarter(
        res,
        workspace,
        root,
        runId,
        url.searchParams.get("assessment") ?? "",
        url.searchParams.get("drafts") === "1",
        url.searchParams.get("dark") === "1",
      );
    }

    // `/api/homework/publish` was here and is gone. It spawned
    // `ainar homework publish`, which `/api/publish` with `target: homework`
    // now does — plus the promotion of the brief, which is the half that used
    // to send the professor to a terminal. Two publishing routes in one web
    // server, one of them narrower, is how a button ends up doing less than
    // the button beside it for reasons nobody can see. `git log -S` has it.
    if (path === "/api/publish") {
      // POST only, for `/api/publish`'s reason and one of its own: with
      // `confirm` this both writes to `courses/` and puts something in front of
      // students, and neither is a thing a prefetch should be able to start.
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "publish is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return readBody(req)
        .then((raw) => {
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return sendJson(res, 200, { error: "The request body is not JSON." });
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return sendJson(res, 200, { error: "The request body must be an object." });
          }
          return runPublish(res, root, runId, String(body.target ?? ""), body);
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    }

    if (path === "/api/approve") {
      // Removed on 2026-09-29, with `ainar approve`. Answered rather than
      // left to fall through, so an older client says why its button is gone.
      return sendJson(res, 410, {
        error:
          "Approval is no longer a command. Drafts live in the course marked " +
          "`approval: draft`; accept one by changing that word in its record.",
      });
    }

    // The two views with no widget behind them. Checked before the widget
    // lookup because `BY_TOOL` has nothing to give them: their content is
    // assembled here, from the run record and from the work directory.
    if (view === "assessments" || view === "slides" || view === "exams") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      const withDrafts = url.searchParams.get("drafts") === "1";
      const on = url.searchParams.get("date");
      const host = req.headers.host;
      const session = url.searchParams.get("session") ?? "";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "assessments"
          ? assessmentsDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              on,
              host ? `http://${host}` : "",
              session,
            )
          : view === "slides"
            ? slidesDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              )
            : examsDocument(
                workspace,
                root,
                runId,
                dark,
                withDrafts,
                on,
                host ? `http://${host}` : "",
                session,
              ),
      );
    }

    // The class list. No drafts toggle: enrollments are not agent-writable
    // and carry no approval, so there is never a drafted half of this view, and a
    // toggle that changed nothing would suggest otherwise.
    if (view === "students") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        studentsDocument(
          workspace,
          runId,
          url.searchParams.get("dark") === "1",
          // Opt-in per request. The pane asks for names only when the professor
          // has pressed for them, so a route replayed from a log or a history
          // entry without the parameter renders pseudonyms.
          url.searchParams.get("names") === "1",
          req.headers.host ? `http://${req.headers.host}` : "",
          url.searchParams.get("session") ?? "",
          defenceReader(root, runId),
        ),
      );
    }

    // The Checklist. No drafts toggle, for `ready`'s reason and one more of its
    // own: this view IS the record-against-drafts comparison — every row says
    // which half a thing is in — so a setting that removed one half would
    // remove the answer rather than narrow it.
    if (view === "checklist") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        checklistDocument(workspace, root, runId, url.searchParams.get("dark") === "1"),
      );
    }

    if (view === "grading" || view === "ready") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const dark = url.searchParams.get("dark") === "1";
      // `grading` honours the drafts toggle, because a drafted assessment
      // carries a weight and changes the scheme. `ready` does not take it:
      // it lists the drafts whatever the toggle says — that IS the drafted
      // half, and a "Record" setting that emptied it would be answering a
      // question nobody asked.
      const withDrafts = url.searchParams.get("drafts") === "1";
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        view === "grading"
          ? gradingDocument(
              workspace,
              root,
              runId,
              dark,
              withDrafts,
              url.searchParams.get("date"),
            )
          : readyDocument(workspace, root, runId, dark),
      );
    }

    // Course mode: the term plan as a page, over the harness. The outline
    // payload exactly as the Weeks tab gets it — same drafts rule, same
    // material links, same record paths — drawn by the pane in three columns
    // rather than by the one-column widget. See `server/course-mode.js`.
    if (view === "course") {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const withDrafts = url.searchParams.get("drafts") === "1";
      const dark = url.searchParams.get("dark") === "1";
      let data = viewPayload(workspace, "course_outline", runId, url.searchParams.get("date"), withDrafts).payload;
      const host = req.headers.host;
      data = withMaterialLinks(
        data,
        host ? `http://${host}` : "",
        url.searchParams.get("session") ?? "",
        workspace,
        dark,
        withDrafts,
      );
      const run = data?.run ?? {};
      if (run.course_id && run.term) {
        data = withRecordPaths(
          data,
          root,
          run.course_id,
          run.term,
          [
            ...(data.weeks ?? []).flatMap((week) => week.undated ?? []),
            ...(data.unplaced?.assessments ?? []),
          ],
        );
      }
      // Four readings of the same term. `planning` and `term` are structure
      // only. `teaching` adds class figures — a concept's class mean, what has
      // been handed in, the open signals — and `evidence` gives them for every
      // week, so those two alone read the private payloads, and only when
      // asked for by name.
      const mode = ["planning", "teaching", "evidence"].includes(url.searchParams.get("mode"))
        ? url.searchParams.get("mode")
        : "term";
      let evidence = null;
      if (mode === "teaching") {
        const on = url.searchParams.get("date");
        const progress = viewPayload(workspace, "class_progress", runId, on, withDrafts).payload;
        const inbox = viewPayload(workspace, "action_inbox", runId, on, withDrafts).payload;
        const concepts = {};
        for (const c of progress.concepts ?? []) {
          concepts[c.concept_id] = { class_mean: c.class_mean ?? null, coverage: c.coverage ?? null };
        }
        const handedIn = {};
        for (const a of inbox.assessments ?? []) {
          handedIn[a.assessment_id] = { enrolled: a.enrolled ?? null, received: a.submissions_received ?? null };
        }
        // The signal's sentence and nothing that names a student: this text is
        // drawn, and a pseudonym is the most a page in this pane carries.
        const signals = (inbox.open_signals ?? []).map((s) => ({ description: s.description ?? "" }));
        evidence = { concepts, handed_in: handedIn, signals };
      }
      // How each week went, from approved evidence only — drafts are never
      // asked for here, whatever the toggle says. Figures are the payloads'
      // own, copied by id; grouping them under weeks is the page's, and no
      // mean, sum or share is made here. Class-level signals only: one about
      // a single student is not an aggregate, and this page names nobody.
      if (mode === "evidence") {
        const on = url.searchParams.get("date");
        const progress = viewPayload(workspace, "class_progress", runId, on, false).payload;
        const book = viewPayload(workspace, "gradebook", runId, on, false).payload;
        const inbox = viewPayload(workspace, "action_inbox", runId, on, false).payload;
        const concepts = {};
        for (const c of progress.concepts ?? []) {
          concepts[c.concept_id] = { class_mean: c.class_mean ?? null, coverage: c.coverage ?? null };
        }
        const work = {};
        for (const a of book.assessments ?? []) {
          const s = a.summary ?? {};
          work[a.assessment_id] = {
            maximum: a.maximum ?? null,
            enrolled: s.enrolled ?? null,
            submitted: s.submitted ?? null,
            not_submitted: s.not_submitted ?? null,
            graded: s.graded ?? null,
            partially_graded: s.partially_graded ?? null,
            mean: s.mean ?? null,
            median: s.median ?? null,
          };
        }
        const signals = (inbox.open_signals ?? [])
          .filter((s) => !s.student_id)
          .map((s) => ({ description: s.description ?? "", severity: s.severity ?? null, concepts: s.concepts ?? [] }));
        evidence = { concepts, work, signals };
      }
      // Where each piece of graded work stands — grading, Canvas, a pile, the
      // defences — for its chip: Teaching and All weeks, never the student
      // preview. Read with drafts included, as the windows it opens read it.
      const student = mode !== "teaching" && mode !== "evidence" && url.searchParams.get("student") === "1";
      let status = null;
      if (mode !== "planning" && !student) {
        try {
          let submissions = null;
          try {
            submissions = submissionsDir(null);
            refuseInsideRepo(submissions, root);
          } catch {
            submissions = null;
          }
          status = assessmentStatus({
            bundle: loadedRun(workspace, runId).bundle,
            runId,
            root,
            submissions,
            ledger: Ledger.load(runId),
          });
        } catch {
          status = null;
        }
      }
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        courseModeDocument(data, {
          dark,
          student,
          mode,
          evidence,
          status,
          // The week Teaching was last stepped to, kept by course mode.
          focus: /^\d{1,2}$/.test(url.searchParams.get("week") ?? "") ? Number(url.searchParams.get("week")) : null,
        }),
      );
    }

    if (view !== null && Object.hasOwn(VIEWS, view)) {
      if (!runId) return sendErrorPage(res, "No run chosen.");
      const tool = VIEWS[view].tool;
      const widget = BY_TOOL.get(tool);
      if (!widget) return sendErrorPage(res, `no widget is bound to ${tool}`);
      // `drafts=1` is the whole course, drafts included; without it the view
      // is what has been accepted. The header says which, because the document
      // is a widget shared with two other hosts and has no place to print it;
      // the pane reads the header and says so in its own chrome.
      const withDrafts = url.searchParams.get("drafts") === "1";
      // The four views with an accepted-only form go through `viewPayload`; any
      // other tool has only the one answer, over the whole course.
      const filtered = ["course_outline", "class_progress", "gradebook", "action_inbox"].includes(tool);
      let data = filtered
        ? viewPayload(workspace, tool, runId, url.searchParams.get("date"), withDrafts).payload
        : payload(workspace, tool, { course_version_id: runId });
      const noted = [];
      // Only the outline carries resources; the other views have none to link.
      if (view === "outline") {
        const host = req.headers.host;
        data = withMaterialLinks(
          data,
          host ? `http://${host}` : "",
          url.searchParams.get("session") ?? "",
          workspace,
          url.searchParams.get("dark") === "1",
          withDrafts,
        );
        const run = data?.run ?? {};
        if (run.course_id && run.term) {
          data = withRecordPaths(
            data,
            root,
            run.course_id,
            run.term,
            (data.weeks ?? []).flatMap((week) => week.undated ?? []),
          );
        }
        // The week view is the weeks. Assessments and the grading policy are
        // two tabs of their own now, and rendering them here as well put a
        // table and a policy note between the professor and what they opened
        // this tab for. The widget keeps both by default — a chat client has no
        // tabs to move them to — so the pane has to ask.
        //
        // `gaps` is the one asked for rather than kept, and the asymmetry is
        // deliberate: every other section defaults to shown, while the gaps
        // default to hidden because the surface that says nothing is `ainar
        // page`. This is a professor's view, so it asks.
        data = {
          ...data,
          sections: { assessments: false, grading: false, header: false, gaps: true },
        };
      }
      if (view === "tasks") {
        // Where each dateless assessment lives, so the widget's "set dates"
        // button can name the record instead of a directory. The inbox payload
        // carries no `course_id` — only the run's own id and term — so the
        // course is read off the bundle rather than parsed out of the run id,
        // which is a convention and not a guarantee.
        let courseId = null;
        try {
          courseId = workspace.findRun(runId)?.course?.course_id ?? null;
        } catch {
          // The payload built, so the run is real; without the bundle the
          // prompt falls back to telling the model to grep for the id.
          courseId = null;
        }
        const term = data?.run?.term ?? null;
        if (courseId && term) {
          data = withRecordPaths(
            data,
            root,
            courseId,
            term,
            (data.assessments ?? []).filter((row) => !row.due_at),
          );
        }
        // Names on the inbox, and nowhere else a widget is served. Opt-in per
        // request exactly as the class list is, so a URL replayed without the
        // parameter renders pseudonyms.
        if (url.searchParams.get("names") === "1") data = withStudentNames(data);
      }
      const dark = url.searchParams.get("dark") === "1";
      res.setHeader("x-professor-pane-drafts", withDrafts ? "merged" : "record-only");
      if (noted.length) {
        res.setHeader(
          "x-professor-pane-draft-issues",
          // One header line, so it survives a header value's own rules: no
          // newlines, and nothing outside Latin-1. A code and a location are
          // both identifiers, and the message is dropped rather than mangled.
          encodeURIComponent(
            noted
              .map((issue) => `${issue.level}:${issue.code}${issue.location ? " " + issue.location : ""}`)
              .join(" | "),
          ),
        );
      }
      return send(res, 200, "text/html; charset=utf-8", widgetDocument(widget, data, dark));
    }

    return sendJson(res, 404, { error: `no route ${path} under ${BASE}` });
  } catch (error) {
    if (error instanceof ToolError) return fail(error.message);
    // An unexpected throw is a bug in this file or in the loader, and the
    // message is the only thing that will get it fixed. It reaches one
    // professor's own browser on one loopback port; there is nobody to leak to.
    return fail(String((error && error.message) || error));
  }
};

/**
 * Cordis waits for `webServer` before calling this, so the route is live from
 * the moment the fiber activates and the disposer the registry returns is what
 * makes an unload actually unload.
 */
export function apply(ctx) {
  /**
   * The credential seam, if this composition has one.
   *
   * A holder rather than a direct `ctx.credentials`, because reading a service
   * that is not in `inject` throws — and putting `credentials` in `inject`
   * would make the WHOLE pane fail to activate wherever no provider is
   * mounted. Losing the outline, the inbox and the class list because nobody
   * can type a Canvas token is the wrong trade, so the dependency is a nested
   * fiber: it fills the holder while a provider is live and empties it when
   * one goes away, and the routes check.
   *
   * This cordis has no `inject: { optional }` form — every key in the object
   * shape is required — which is why the nested fiber is the idiom here rather
   * than a declaration.
   */
  const credentials = { service: null };
  ctx.inject(["credentials"], (scoped) => {
    credentials.service = scoped.credentials;
    scoped.on("dispose", () => {
      credentials.service = null;
    });
  });

  /*
   * The session's own model, for the hands-free desk (AGT-2): `llm` to call
   * it, `sessions` to read which provider and model a session is talking to,
   * and `agentDefaultModel` for a session that has not made a request yet.
   * Optional by the same nested-fiber idiom as `credentials`, one each, so a
   * composition without one loses only the choosing — the desk then falls
   * back to the next prepared question — never the pane.
   */
  const harness = { llm: null, sessions: null, defaults: null };
  for (const [key, service] of [["llm", "llm"], ["sessions", "sessions"], ["defaults", "agentDefaultModel"]]) {
    ctx.inject([service], (scoped) => {
      harness[key] = scoped[service];
      scoped.on("dispose", () => {
        harness[key] = null;
      });
    });
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: BASE,
        handler: handler(ctx.workspaceRegistry, credentials, harness),
      }),
    "professor-pane: the /professor-pane route",
  );
}
