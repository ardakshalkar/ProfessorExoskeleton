/**
 * The defence desk: the state of one student's defence, the recording and
 * hands-free logic that changes it, and the dialog around its views.
 *
 * What it is built from, each in its own module:
 *
 * * `defence-turn.js` — when an answer has ended, from the level alone
 * * `defence-marks.js` — the professor's own words, held on P
 * * `defence-captions.js` — live captions for the take in hand
 * * `defence-screen.js` — the student's screen, over a BroadcastChannel
 * * `defence-dots.js` — the swarm that follows what the desk is doing
 * * `defence-views.js` — what the desk draws, given `desk`
 * * `defence-stage.js` — the stage: the big button and the drawer
 */

import { useCaptions } from "./defence-captions.js";
import { useProfessorMarks } from "./defence-marks.js";
import { ScreenRow, useStudentScreen } from "./defence-screen.js";
import { DefenceStage } from "./defence-stage.js";
import { turnStep } from "./defence-turn.js";
import {
  ConsentPanel,
  GradeRow,
  HandsPanel,
  QuestionItem,
  RecordingPanel,
  StartRow,
} from "./defence-views.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/** The recording formats to try, best first. */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

/** How long a proposed next question waits for the professor before it is asked. */
const PROPOSE_MS = 5000;

/**
 * A choice remembered in this browser only, read once when the desk opens.
 * Storage can be unavailable (a private window, a blocked origin); then the
 * choice simply lasts until the desk closes.
 */
function useRememberedChoice(key, read) {
  const [value, setValue] = React.useState(() => {
    try {
      return read(window.localStorage.getItem(key));
    } catch {
      return read(null);
    }
  });
  const choose = (next) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {}
  };
  return [value, choose];
}

/**
 * The defence desk: one student's oral defence, question by question.
 *
 * Here and not in a frame, because a frame sandboxed without
 * `allow-same-origin` may not ask for the microphone. The professor presses
 * Record, the student answers, Stop sends the take to the server, which keeps
 * it in the private folder and transcribes it through the `transcription`
 * connection. Every take is kept; a second press is a second take, never an
 * overwrite.
 *
 * The header says where the voice goes before anyone presses record — the
 * provider by name, and whether it leaves this machine — because a
 * student's voice is the most personal thing this pane has handled.
 *
 * Follow-up asks the session (`/defend-submission … follow-up on Qn`): the
 * model the professor is talking to reads what was said and appends one
 * question, which arrives here on the next redraw.
 */
export function DefenceDesk(props) {
  const close = props.onClose;
  const [data, setData] = React.useState(null);
  const [recording, setRecording] = React.useState(null); // { question, started, paused }
  const [sending, setSending] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [manualLevel, setManualLevel] = React.useState(0);
  // The stage (big button, live transcript, everything else in a drawer)
  // or the list (every control and question in one column). The list is
  // one press away.
  const [view, chooseView] = useRememberedChoice("professor-pane.defence-view", (stored) => stored || "stage");
  const [drawer, setDrawer] = React.useState(true);
  /*
   * AGT-11: how the defence is taken. `whole` (the default): one
   * recording of the whole conversation, transcribed live, with a press
   * for each new question as a hint; the session's model divides it into
   * its questions afterwards. `questions`: hands-free, one take per
   * question, the desk choosing what comes next.
   */
  const [mode, chooseMode] = useRememberedChoice("professor-pane.defence-mode", (stored) => (stored === "questions" ? "questions" : "whole"));
  // The whole take in hand: when it started, the presses so far, and the
  // time spent paused — so every mark is in seconds of audio, not of clock.
  const whole = React.useRef({ started: null, marks: [], paused: null, pausedMs: 0 });
  const [wholeMarks, setWholeMarks] = React.useState([]);
  const [splitting, setSplitting] = React.useState(null); // { question, take }
  // Uploads still on the wire; the desk does not close while any are.
  const [pending, setPending] = React.useState(0);
  // Hands-free (AGT-1): { question, phase, level, threshold } while running.
  const [handsFree, setHandsFree] = React.useState(null);
  // AGT-2/3: the model's choice waiting out its five seconds, and whether
  // the model is asked at all (off: the desk walks the prepared questions).
  const [proposal, setProposal] = React.useState(null);
  const proposalRef = React.useRef(null);
  proposalRef.current = proposal;
  const [chooser, setChooser] = React.useState(true);
  const [now, setNow] = React.useState(Date.now());
  const recorder = React.useRef(null);
  // The hands-free loop's own state, outside React: it runs ten times a
  // second and must see the latest of everything without re-subscribing.
  const loop = React.useRef(null);
  const dataRef = React.useRef(null);
  dataRef.current = data;

  const query =
    "?run=" + encodeURIComponent(props.runId) +
    "&assessment=" + encodeURIComponent(props.assessment) +
    "&student=" + encodeURIComponent(props.student);
  const endpoint = (path, extra) => scoped(BASE + path + query + (extra || ""), props.sessionId);

  const { marks, professorTalking, openMarks, closeMarks, speakDown, speakUp } = useProfessorMarks();
  const { captions, setCaptions, liveCaptions, setLiveCaptions, startCaptions, stopCaptions, heard } = useCaptions(endpoint, marks, whole);
  const { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen } = useStudentScreen(props, dataRef);

  /*
   * AGT-7: consent. Nothing records until the professor confirms the
   * student agreed to the statement the server wrote from the provider in
   * use — the server refuses a take without it, so this is the visible
   * half of a rule that is enforced where the file is written. Withdrawal
   * stops everything at once and drops the take in hand unsent.
   */
  const consented = !!(data && data.consent && data.consent.agreed && !data.consent.withdrawn_at);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const [consentBusy, setConsentBusy] = React.useState(false);
  // A manual take in progress when consent is withdrawn is stopped and not sent.
  const discard = React.useRef(false);
  const answerConsent = (action) => {
    setConsentBusy(true);
    return fetch(endpoint("/api/defence/consent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) setSaid({ error: true, text: result.error });
      })
      .catch((error) => setSaid({ error: true, text: String(error) }))
      .then(() => {
        setConsentBusy(false);
        setTick((value) => value + 1);
      });
  };

  React.useEffect(() => {
    let live = true;
    fetch(endpoint("/api/defence/session"), { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => live && setData(value))
      .catch((error) => live && setData({ error: String(error) }));
    return () => {
      live = false;
    };
  }, [props.reload, tick, props.assessment, props.student]);

  /** Seconds of audio in the take in hand: the clock less any time paused. */
  const audioNow = () => {
    const current = whole.current;
    if (current.started === null) return 0;
    const now = Date.now();
    return (now - current.started - current.pausedMs - (current.paused !== null ? now - current.paused : 0)) / 1000;
  };

  // A running clock while recording, so the professor sees it is live.
  React.useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setElapsed(audioNow()), 250);
    return () => clearInterval(timer);
  }, [recording]);

  // Closing mid-answer would lose it, so Escape does nothing then.
  const busy = Boolean(recording || sending || handsFree || pending > 0);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, busy]);

  // Release the microphone if the desk goes away while it is held.
  React.useEffect(() => () => {
    const held = recorder.current;
    if (held && held.state !== "inactive") held.stop();
    const running = loop.current;
    if (running) {
      clearInterval(running.timer);
      running.stream.getTracks().forEach((track) => track.stop());
      if (running.audio.state !== "closed") running.audio.close();
      loop.current = null;
    }
  }, []);

  /**
   * Send one take; transcribed by the server. Resolves either way, having
   * said what went wrong, with the take as the server kept it, or null.
   */
  const upload = (questionId, blob, seconds, ranges, askedAt, pressed) => {
    const spoke = (ranges || []).map((range) => range[0].toFixed(1) + "-" + range[1].toFixed(1)).join(",");
    const marked = (pressed || []).map((mark) => mark.at.toFixed(1) + (mark.question_id ? ":" + mark.question_id : "")).join(",");
    setPending((count) => count + 1);
    let kept = null;
    return fetch(endpoint("/api/defence/answer", "&question=" + encodeURIComponent(questionId) + "&seconds=" + seconds.toFixed(1) + (spoke ? "&professor=" + spoke : "") + (marked ? "&marks=" + marked : "") + (askedAt ? "&asked=" + Math.round(askedAt) : "")), {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) setSaid({ error: true, text: questionId + ": " + result.error });
        else if (result.answer && result.answer.error) {
          setSaid({ error: true, text: questionId + " kept, not transcribed: " + result.answer.error });
        }
        kept = result.answer || null;
      })
      .catch((error) => setSaid({ error: true, text: questionId + ": " + String(error) }))
      .then(() => {
        setPending((count) => count - 1);
        setTick((value) => value + 1);
        return kept;
      });
  };

  /*
   * AGT-11: divide a whole-defence take into its questions. The server
   * asks the session's model, with the presses as hints, and falls back
   * to the presses alone; the split comes back as a draft to check.
   */
  const split = (questionId, takeNumber, action) => {
    if (action !== "approve") setSplitting({ question: questionId, take: takeNumber });
    return fetch(endpoint("/api/defence/split"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionId, take: takeNumber, action: action || "split" }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) setSaid({ error: true, text: "Could not divide the defence: " + result.error });
        else if (!result.split) setSaid({ error: true, text: "The defence stays one piece: " + (result.notes || []).join("; ") });
        else if (action !== "approve") {
          const notes = result.notes || [];
          setSaid({
            error: notes.length > 0,
            text: "Divided into " + result.split.parts.length + " question(s) by " + result.split.by + (notes.length ? ": " + notes.join("; ") : ". Check them under the recording."),
          });
        }
      })
      .catch((error) => setSaid({ error: true, text: String(error) }))
      .then(() => {
        setSplitting(null);
        setTick((value) => value + 1);
      });
  };

  /** A press in a whole defence: a new question starts now, a prepared one if named. */
  const markQuestion = (questionId) => {
    const current = whole.current;
    if (!recording || recording.question !== "Q0" || current.paused !== null) return;
    const mark = questionId ? { at: audioNow(), question_id: questionId } : { at: audioNow() };
    current.marks = current.marks.concat([mark]);
    setWholeMarks(current.marks);
    // The live transcript starts over under the new question; the words
    // before it are still in the recording and in the take's transcript.
    setCaptions((value) => (value ? Object.assign({}, value, { from: value.pieces.length }) : value));
    showOnScreen("Q0", "listening", false, questionId || null);
  };

  /** Pause a whole defence: one recording still, with the gap left out of it. */
  const pauseWhole = () => {
    const media = recorder.current;
    const current = whole.current;
    if (!media || media.state !== "recording" || current.paused !== null || typeof media.pause !== "function") return;
    speakUp();
    media.pause();
    current.paused = Date.now();
    setRecording((value) => (value ? Object.assign({}, value, { paused: true }) : value));
    showOnScreen("Q0", "paused", false, lastPicked());
  };
  const resumeWhole = () => {
    const media = recorder.current;
    const current = whole.current;
    if (!media || media.state !== "paused" || current.paused === null) return;
    const gap = Date.now() - current.paused;
    current.pausedMs += gap;
    current.paused = null;
    // The professor's stretches are measured from the take's start: move
    // it on by the gap, so they stay in seconds of audio too.
    if (marks.current.origin !== null) marks.current.origin += gap;
    media.resume();
    setRecording((value) => (value ? Object.assign({}, value, { paused: false }) : value));
    showOnScreen("Q0", "listening", false, lastPicked());
  };
  const lastPicked = () => {
    const last = whole.current.marks[whole.current.marks.length - 1];
    return last && last.question_id ? last.question_id : null;
  };

  const start = (questionId) => {
    if (recording || sending || handsFree || !consented) return;
    setSaid(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setSaid({ error: true, text: "This browser cannot record here: the page has to be served over https or from localhost." });
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
        const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        // The level, for the dots: a manual take has no detector, but the
        // swarm should still show whether someone is speaking.
        let meter = null;
        try {
          const audio = new AudioContext();
          const analyser = audio.createAnalyser();
          analyser.fftSize = 2048;
          audio.createMediaStreamSource(stream).connect(analyser);
          const samples = new Float32Array(analyser.fftSize);
          meter = {
            audio,
            timer: setInterval(() => {
              analyser.getFloatTimeDomainData(samples);
              let sum = 0;
              for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
              const level = Math.sqrt(sum / samples.length);
              setManualLevel(level);
              heard(level, 0.02);
            }, 150),
          };
        } catch {
          meter = null;
        }
        const chunks = [];
        const started = Date.now();
        media.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };
        media.onstop = () => {
          stopCaptions();
          stream.getTracks().forEach((track) => track.stop());
          if (meter) {
            clearInterval(meter.timer);
            if (meter.audio.state !== "closed") meter.audio.close();
          }
          setManualLevel(0);
          recorder.current = null;
          setRecording(null);
          showOnScreen(null, "idle");
          const blob = new Blob(chunks, { type: (media.mimeType || type || "audio/webm").split(";")[0] });
          if (discard.current) {
            discard.current = false;
            closeMarks();
            return;
          }
          const seconds = audioNow();
          const pressed = whole.current.marks;
          whole.current = { started: null, marks: [], paused: null, pausedMs: 0 };
          setWholeMarks([]);
          if (!blob.size) {
            setSaid({ error: true, text: "Nothing was recorded." });
            return;
          }
          setSending(questionId);
          upload(questionId, blob, seconds, closeMarks(), started, pressed).then((kept) => {
            setSending(null);
            // AGT-11: a whole defence, once transcribed, is divided into
            // its questions straight away; the professor checks the parts.
            if (kept && kept.question_id === "Q0" && kept.transcript && !kept.withdrawn) split(kept.question_id, kept.take);
          });
        };
        recorder.current = media;
        media.start(1000);
        setElapsed(0);
        whole.current = { started, marks: [], paused: null, pausedMs: 0 };
        setWholeMarks([]);
        setRecording({ question: questionId, started, paused: false });
        openMarks(started);
        showOnScreen(questionId, "listening");
        startCaptions(stream, questionId, type);
      })
      .catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
  };

  const stop = () => {
    const media = recorder.current;
    if (media && media.state !== "inactive") media.stop();
  };

  /*
   * Hands-free (AGT-1). The microphone is opened once and held; each
   * question gets its own recorder on that stream, and `turnStep` watches
   * the level ten times a second. When the student has spoken and then
   * stopped for long enough, the take is sent in the background and the
   * next unanswered question is put up at once — nobody presses anything.
   * Space ends an answer early; Skip moves on without keeping the take;
   * Pause keeps what was said and lets go of the microphone.
   */
  const nextUnanswered = (after) => {
    const questions = (dataRef.current && dataRef.current.questions) || [];
    const answered = new Set(((dataRef.current && dataRef.current.answers) || []).map((answer) => answer.question_id));
    const asked = loop.current ? loop.current.asked : new Set();
    const from = after ? questions.findIndex((entry) => entry.id === after) + 1 : 0;
    const ordered = questions.slice(from).concat(questions.slice(0, from));
    const found = ordered.find((entry) => entry.kind !== "whole" && !answered.has(entry.id) && !asked.has(entry.id));
    return found ? found.id : null;
  };

  const releaseMicrophone = (final) => {
    stopCaptions();
    showOnScreen(null, final === "done" ? "done" : "paused");
    const running = loop.current;
    if (!running) return;
    clearInterval(running.timer);
    running.stream.getTracks().forEach((track) => track.stop());
    if (running.audio && running.audio.state !== "closed") running.audio.close();
    loop.current = null;
    setHandsFree(null);
    setProposal(null);
  };

  const beginTake = (questionId) => {
    const running = loop.current;
    if (!running) return;
    if (!questionId) {
      releaseMicrophone("done");
      setSaid({ error: false, text: "Every question has an answer. Follow-up questions, if you ask for them, appear below." });
      return;
    }
    running.asked.add(questionId);
    const record = () => {
      // Paused, or moved on, while the question was being read.
      if (loop.current !== running || running.take) return;
      const media = new MediaRecorder(running.stream, running.type ? { mimeType: running.type } : undefined);
      const chunks = [];
      media.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      running.take = { question: questionId, media, chunks, started: Date.now(), turn: null, keep: true, spoke: false, shown: "listening" };
      startCaptions(running.stream, questionId, running.type);
      openMarks(running.take.started);
      media.start(1000);
      setHandsFree({ question: questionId, phase: "waiting", level: 0, threshold: 0 });
      showOnScreen(questionId, "listening");
    };
    // Read aloud first, and listen only once the screen says it has
    // finished: the microphone would take the synthetic voice for the
    // student's. A screen that never answers is given until a generous
    // reading time has passed.
    if (readAloudRef.current && screen.current.ready) {
      setHandsFree({ question: questionId, phase: "reading", level: 0, threshold: 0 });
      const text = showOnScreen(questionId, "reading", true);
      const id = screen.current.said;
      const timer = setTimeout(() => {
        if (screen.current.waiting === id) record();
      }, Math.max(4000, text.length * 90) + 2000);
      screen.current.waiting = id;
      screen.current.onSpoken = (spoken) => {
        if (spoken !== id) return;
        clearTimeout(timer);
        screen.current.waiting = null;
        record();
      };
      return;
    }
    record();
  };

  /** End the take in hand: keep it or not, then put up the next question or stop. */
  const endTake = (how) => {
    const running = loop.current;
    const take = running && running.take;
    if (!take || take.media.state === "inactive") return;
    running.take = null;
    stopCaptions();
    const ranges = closeMarks();
    const keep = how !== "skip" && how !== "withdraw" && (take.spoke || how === "space");
    take.media.onstop = () => {
      const blob = new Blob(take.chunks, { type: (take.media.mimeType || running.type || "audio/webm").split(";")[0] });
      const sent = keep && blob.size ? upload(take.question, blob, (Date.now() - take.started) / 1000, ranges, take.started) : Promise.resolve();
      if (how === "pause" || how === "withdraw") releaseMicrophone();
      // An answer was given and the model may choose what follows it: wait
      // for the transcript, then ask. A skipped question, or a desk told
      // not to ask the model, goes straight to the next prepared one.
      else if (running.chooser && keep) {
        showOnScreen(null, "between");
        setHandsFree({ question: null, phase: "thinking", level: 0, threshold: 0 });
        sent.then(() => propose(take.question));
      } else beginTake(nextUnanswered(take.question));
    };
    take.media.stop();
  };

  /*
   * AGT-2 and AGT-3: after each answer the session's model chooses what to
   * ask, and the professor has five seconds to step in before it is asked.
   * Ask now, Skip (the next prepared question instead), Edit (change the
   * words, then ask), Pause (stop; nothing is asked). Every choice and
   * every override is recorded in the session by the server.
   */
  const propose = (after) => {
    if (!loop.current) return;
    fetch(endpoint("/api/defence/next", "&after=" + encodeURIComponent(after)), { method: "POST" })
      .then((response) => response.json())
      .then((result) => {
        if (!loop.current) return;
        if (result.error) {
          setSaid({ error: true, text: "Could not choose the next question: " + result.error + " — moving to the next prepared one." });
          beginTake(nextUnanswered(after));
          return;
        }
        setTick((value) => value + 1);
        setHandsFree({ question: null, phase: "proposing", level: 0, threshold: 0 });
        // The clock the countdown reads, set with the deadline: left stale,
        // the first frame counted from whenever it last ticked.
        setNow(Date.now());
        setProposal({ ...result, after, deadline: Date.now() + PROPOSE_MS, editing: null });
      })
      .catch((error) => {
        setSaid({ error: true, text: String(error) });
        if (loop.current) beginTake(nextUnanswered(after));
      });
  };

  const override = (kind, extra) =>
    fetch(endpoint("/api/defence/override"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ index: proposalRef.current ? proposalRef.current.index : null, override: kind }, extra || {})),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) setSaid({ error: true, text: result.error });
        return result;
      });

  /** Act on the proposal in hand: `auto` when the countdown ran out. */
  const settle = (how, text) => {
    const current = proposalRef.current;
    if (!current) return;
    setProposal(null);
    const question = current.question;
    if (how === "pause") {
      override("pause");
      releaseMicrophone();
      return;
    }
    if (how === "skip") {
      override("skip");
      if (question && loop.current) loop.current.asked.add(question.id);
      beginTake(nextUnanswered(current.after));
      return;
    }
    if (current.decision.action === "done" || !question) {
      if (how === "ask_now") override("ask_now");
      releaseMicrophone("done");
      const reason = current.decision.why || "nothing left to ask";
      setSaid({ error: false, text: "The desk thinks the defence is complete: " + reason + (/[.!?]$/.test(reason) ? "" : ".") });
      return;
    }
    if (how === "edit") {
      override("edit", { question: question.id, text: text }).then(() => {
        setTick((value) => value + 1);
        beginTake(question.id);
      });
      return;
    }
    if (how === "ask_now") override("ask_now");
    beginTake(question.id);
  };

  // The countdown. Editing stops it: a professor rewording a question is
  // not going to be overtaken by the clock.
  React.useEffect(() => {
    if (!proposal || proposal.editing !== null) return undefined;
    const timer = setInterval(() => {
      const current = proposalRef.current;
      if (!current || current.editing !== null) return;
      if (Date.now() >= current.deadline) settle("auto");
      else setNow(Date.now());
    }, 200);
    return () => clearInterval(timer);
  }, [proposal && proposal.index, proposal && proposal.editing !== null]);

  const startHandsFree = () => {
    if (recording || sending || loop.current || !consented) return;
    setSaid(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      setSaid({ error: true, text: "This browser cannot record here: the page has to be served over https or from localhost." });
      return;
    }
    const first = nextUnanswered(null);
    if (!first) {
      setSaid({ error: false, text: "Every question already has an answer." });
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        const audio = new AudioContext();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const type = RECORDING_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
        loop.current = { stream, audio, analyser, samples, type, chooser, asked: new Set(), take: null, timer: null };
        loop.current.timer = setInterval(() => {
          const running = loop.current;
          const take = running && running.take;
          if (!take) return;
          running.analyser.getFloatTimeDomainData(running.samples);
          let sum = 0;
          for (let index = 0; index < running.samples.length; index += 1) sum += running.samples[index] * running.samples[index];
          const level = Math.sqrt(sum / running.samples.length);
          // The professor is speaking: not the answer, and not a silence
          // either. The detector waits, and the pause after it counts
          // from when they let go.
          if (marks.current.held !== null) {
            take.resumed = true;
            setHandsFree({ question: take.question, phase: "professor", level, threshold: 0 });
            return;
          }
          if (take.resumed && take.turn) {
            take.turn = Object.assign({}, take.turn, { silentSince: null, voicedSince: null });
            take.resumed = false;
          }
          const step = turnStep(take.turn, level, Date.now());
          take.turn = step.state;
          if (step.state.phase === "speaking") take.spoke = true;
          heard(level, step.threshold);
          if (take.spoke && take.shown !== "hearing") {
            take.shown = "hearing";
            showOnScreen(take.question, "hearing");
          }
          setHandsFree({ question: take.question, phase: step.state.phase, level, threshold: step.threshold, silent: step.silentFor });
          if (step.end) endTake(step.end);
        }, 100);
        beginTake(first);
      })
      .catch((error) => setSaid({ error: true, text: "No microphone: " + String(error && error.message ? error.message : error) }));
  };

  // Space ends the answer now — the student said "that's all", or the
  // room is too noisy for silence to be heard.
  React.useEffect(() => {
    if (!handsFree) return undefined;
    const onKey = (event) => {
      if (event.code !== "Space" || /^(INPUT|TEXTAREA|BUTTON)$/.test(String(event.target && event.target.tagName))) return;
      event.preventDefault();
      endTake("space");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [Boolean(handsFree)]);

  // In a whole defence, Space marks a new question, as the big button does.
  React.useEffect(() => {
    if (!recording || recording.question !== "Q0" || recording.paused) return undefined;
    const onKey = (event) => {
      if (event.code !== "Space" || event.repeat || /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(String(event.target && event.target.tagName))) return;
      event.preventDefault();
      markQuestion(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording && recording.question, recording && recording.paused]);

  const followUp = (questionId) =>
    props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — follow-up on " + questionId);

  // DEF-5: the session's model proposes the marks; see `GradeRow`.
  const proposeGrade = () =>
    props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — propose the grade");

  /** The student withdrew: stop everything now, send nothing more, and record it. */
  const withdraw = () => {
    setConfirmWithdraw(false);
    setProposal(null);
    const running = loop.current;
    if (running && running.take) endTake("withdraw");
    else if (running) releaseMicrophone();
    if (recorder.current && recorder.current.state !== "inactive") {
      discard.current = true;
      recorder.current.stop();
    }
    answerConsent("withdraw");
  };

  // The student reads what they are agreeing to on their own screen.
  React.useEffect(() => {
    if (!data || data.error || consented || !screen.current.channel) return;
    const state = {
      type: "state",
      phase: data.consent && data.consent.withdrawn_at ? "stopped" : "consent",
      title: (data.assessment && data.assessment.title) || "",
      label: data.consent && data.consent.withdrawn_at ? "Recording stopped" : "Before we begin",
      text: data.consent && data.consent.withdrawn_at ? "You withdrew your agreement. Nothing more is recorded." : data.statement || "",
    };
    screen.current.last = state;
    screen.current.channel.postMessage(state);
  }, [data && data.statement, consented, data && data.consent && data.consent.withdrawn_at, screenState]);

  /** "This voice is me", from `VoicePicker`. */
  const assignVoice = (answer, voice) =>
    fetch(endpoint("/api/defence/voices"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: answer.question_id, take: answer.take, voices: [voice] }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) setSaid({ error: true, text: result.error });
        setTick((value) => value + 1);
      });

  // The whole defence in one recording: Q0 is made if it is not there, and
  // recorded like any take — no cap, P still marks the professor, and the
  // voices are told apart afterwards.
  const recordWhole = () =>
    fetch(endpoint("/api/defence/whole"), { method: "POST" })
      .then((response) => response.json())
      .then((result) => {
        if (result.error) {
          setSaid({ error: true, text: result.error });
          return;
        }
        setTick((value) => value + 1);
        start(result.question);
      });

  // The student's screen shows their own words as they speak (asked for
  // 2026-10-06): the captions of the question being recorded, nothing else.
  React.useEffect(() => {
    const channel = screen.current.channel;
    if (!channel || !captions) return;
    channel.postMessage({
      type: "caption",
      question: captions.question,
      text: captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
      partial: captions.partial || "",
    });
  }, [captions]);

  // The stage keeps the window while an answer is being given: the drawer
  // folds to its strip when recording starts, and opens when the model
  // proposes the next question, so the proposal is never hunted for.
  const recordingNow = Boolean(recording || (handsFree && handsFree.phase !== "thinking" && handsFree.phase !== "proposing"));
  React.useEffect(() => {
    if (recordingNow) setDrawer(false);
  }, [recordingNow]);
  React.useEffect(() => {
    if (proposal) setDrawer(true);
  }, [proposal && proposal.index]);

  /** The stage's big button: the one thing the moment calls for. */
  const bigPress = () => {
    if (!data || data.error) return;
    if (!consented) {
      setDrawer(true);
      return;
    }
    if (proposal) return settle("ask_now");
    if (handsFree) {
      if (handsFree.phase === "waiting" || handsFree.phase === "speaking" || handsFree.phase === "professor") endTake("space");
      return;
    }
    if (recording) {
      if (recording.question !== "Q0") return stop();
      return recording.paused ? resumeWhole() : markQuestion(null);
    }
    if (sending || splitting) return;
    if (mode === "whole") return recordWhole();
    if (!data.questions.some((entry) => entry.kind !== "whole")) {
      setSaid({ error: true, text: "No prepared questions yet: Start defence drafts them, or take the defence whole." });
      setDrawer(true);
      return;
    }
    startHandsFree();
  };

  const where = data && data.transcription;

  /** What the views read and the presses they may make; see `defence-views.js`. */
  const desk = {
    data,
    answers: (data && data.answers) || [],
    criteria: new Map(((data && data.criteria) || []).map((criterion) => [criterion.id, criterion.title])),
    consented,
    confirmWithdraw,
    setConfirmWithdraw,
    consentBusy,
    answerConsent,
    withdraw,
    recording,
    sending,
    elapsed,
    manualLevel,
    handsFree,
    proposal,
    setProposal,
    now,
    settle,
    splitting,
    split,
    wholeMarks,
    captions,
    liveCaptions,
    setLiveCaptions,
    professorTalking,
    speakDown,
    speakUp,
    pending,
    said,
    mode,
    chooseMode,
    chooser,
    setChooser,
    drawer,
    setDrawer,
    screenProps: { screenState, readAloud, setReadAloud, onOpen: openScreen },
    endpoint,
    start,
    stop,
    markQuestion,
    pauseWhole,
    resumeWhole,
    recordWhole,
    startHandsFree,
    endTake,
    bigPress,
    followUp,
    proposeGrade,
    assignVoice,
  };

  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !busy) close();
        },
      },
      h(
        "div",
        {
          className: "pp-modal pp-deskmodal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Defence desk",
          onMouseDown: (event) => event.stopPropagation(),
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h(
            "div",
            { className: "pp-modaltitle" },
            "Defence · " + props.student + (data && data.assessment ? " · " + data.assessment.title : ""),
          ),
          h(
            "span",
            { className: "pp-approverow", role: "group", "aria-label": "View" },
            h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "stage", onClick: () => chooseView("stage") }, "Stage"),
            h("button", { type: "button", className: "pp-segbtn", "aria-pressed": view === "list", onClick: () => chooseView("list") }, "List"),
          ),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: busy, onClick: close }, "×"),
        ),
        view === "stage" && data && !data.error && (data.questions.length || mode === "whole")
          ? h("div", { className: "pp-publishbody pp-stagebody" }, h(DefenceStage, { desk }))
          : h(
          "div",
          { className: "pp-publishbody" },
          // Where the voice goes, said before anything is recorded.
          where
            ? h(
                "div",
                { className: where.error ? "pp-dwarn" : "pp-dim" },
                where.error
                  ? (where.configured
                      ? where.configured.name + " (" + where.configured.provider + " " + where.configured.model + ") cannot transcribe yet: "
                      : "No transcription provider: ") +
                    where.error + " Answers are still recorded and kept, and transcribed once it is fixed."
                  : "Transcribed by " + where.name + " (" + where.provider + " " + where.model + ")" +
                      (where.local ? ", on this machine." : ": the recording is sent to that provider.") +
                      (typeof where.pricePerMinute === "number" ? " $" + where.pricePerMinute + "/min." : ""),
              )
            : null,
          data && data.pin
            ? h("div", { className: "pp-dim" }, "Code at " + String(data.pin.commit).slice(0, 7) + (data.pin.pinned_by === "submitted_at" ? ", as handed in." : "."))
            : null,
          // Hands-free: one press starts it, and from then on the desk
          // listens, notices the end of each answer and moves on.
          data && !data.error && data.questions.length ? h(ScreenRow, desk.screenProps) : null,
          data && !data.error && data.questions.length ? h(ConsentPanel, { desk }) : null,
          data && !data.error && data.questions.length && consented
            ? handsFree
              ? h(HandsPanel, { desk })
              : recording
                ? h(RecordingPanel, { desk })
                : h(StartRow, { desk })
            : null,
          data && !data.error ? h(GradeRow, { desk }) : null,
          said ? h("div", { className: said.error ? "pp-dwarn" : "pp-dim" }, said.text) : null,
          data === null
            ? h("div", { className: "pp-dim" }, "Loading…")
            : data.error
              ? h("div", { className: "pp-dwarn" }, data.error)
              : !data.questions.length
                ? h("div", { className: "pp-dim" }, "No questions drafted yet — Start defence drafts them.")
                : h("ol", { className: "pp-dlist" }, data.questions.map((entry) => h(QuestionItem, { key: entry.id, desk, entry }))),
        ),
      ),
    ),
    document.body,
  );
}
