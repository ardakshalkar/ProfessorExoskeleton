/**
 * The defence desk: the end-of-answer detector, the listening dots, and the
 * desk itself.
 */

import { h, React, ReactDOM } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * When an answer has ended, from the microphone's level alone (AGT-1).
 *
 * Pure, one call per sample, so it can be tested without a microphone. It
 * waits for speech — the level above the room's noise floor for 0.4 s,
 * so a cough or a chair is not an answer — and then for silence: 2.5 s
 * below the floor after speech ends the take. Thinking pauses mid-answer
 * are shorter than that in practice; a student who needs longer presses
 * nothing and the professor presses Space when they are done instead.
 *
 * The floor is learnt, not configured: it follows the level while nobody
 * is speaking, and the threshold is three times it, never below a fixed
 * minimum so a silent room does not make breathing an answer. Three
 * minutes ends a take whatever happens, so a forgotten desk does not
 * record a lecture.
 *
 * The first 0.8 s of a take are not listened to. Without that, the tail of
 * the previous answer — the last word as the professor pressed Space —
 * became the start of the next one, and the next question "ended" on the
 * silence after it. What this cannot tell apart is a voice that is not the
 * student's: a professor who reads the question aloud is heard as the
 * answer. Hands-free therefore expects the question to be read off the
 * screen (AGT-4) until AGT-6 separates the two voices.
 */
const TURN = { settleMs: 800, minSpeechMs: 400, silenceMs: 2500, capMs: 180000, minThreshold: 0.012, ratio: 3 };
export function turnStep(state, level, now, options) {
  const o = Object.assign({}, TURN, options || {});
  const s = state || {
    phase: "waiting",
    floor: Math.min(level, o.minThreshold),
    voicedSince: null,
    silentSince: null,
    startedAt: now,
  };
  const threshold = Math.max(o.minThreshold, s.floor * o.ratio);
  const loud = level > threshold;
  const result = (next, end) => ({
    state: next,
    end: end,
    threshold: threshold,
    silentFor: next.silentSince === null ? 0 : now - next.silentSince,
  });
  if (now - s.startedAt >= o.capMs) return result(s, "cap");
  if (now - s.startedAt < o.settleMs) return result(s, null);
  if (s.phase === "waiting") {
    if (!loud) {
      // Only quiet samples teach the floor, so speech never raises it.
      return result(Object.assign({}, s, { voicedSince: null, floor: s.floor * 0.95 + level * 0.05 }), null);
    }
    const voicedSince = s.voicedSince === null ? now : s.voicedSince;
    return now - voicedSince >= o.minSpeechMs
      ? result(Object.assign({}, s, { phase: "speaking", voicedSince: voicedSince, silentSince: null }), null)
      : result(Object.assign({}, s, { voicedSince: voicedSince }), null);
  }
  if (loud) return result(Object.assign({}, s, { silentSince: null }), null);
  const silentSince = s.silentSince === null ? now : s.silentSince;
  const next = Object.assign({}, s, { silentSince: silentSince, floor: s.floor * 0.98 + level * 0.02 });
  return result(next, now - silentSince >= o.silenceMs ? "silence" : null);
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
/*
 * The desk's dots: `dots-swarm` (MIT, dotsui.dev), bundled into
 * vendor/dots-swarm.js by vendor/build-dots.mjs and loaded the first time a
 * desk opens. The bundle uses this pane's React — it must be the same
 * instance the harness renders with, or its hooks fail — handed over on a
 * global before the script runs. If it cannot load, the desk simply has no
 * animation; the level meter still says what the microphone hears.
 */
let dotsLoading = null;
const loadDots = () => {
  if (window.__professorPaneDots) return Promise.resolve(window.__professorPaneDots);
  if (dotsLoading) return dotsLoading;
  window.__professorPaneReact = React;
  dotsLoading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = BASE + "/vendor/dots-swarm.js";
    script.async = true;
    script.onload = () => resolve(window.__professorPaneDots || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return dotsLoading;
};

/** Which shape the dots take for what the desk is doing. */
const DOT_SHAPES = {
  idle: "microphone",
  waiting: "microphone",
  reading: "message",
  speaking: "equalizer",
  professor: "headphones",
  thinking: "thought-bubble",
  proposing: "thought-bubble",
  paused: "pause",
  done: "check",
};

/**
 * The dots: a microphone while the desk waits for the student, an
 * equalizer while they speak, a thought bubble while the next question is
 * chosen. Their colour follows the recording light, so the animation and
 * the light never disagree about whether the desk is listening.
 */
function ListeningDots(props) {
  const [dots, setDots] = React.useState(window.__professorPaneDots || null);
  React.useEffect(() => {
    if (dots) return undefined;
    let live = true;
    loadDots().then((loaded) => live && setDots(loaded));
    return () => {
      live = false;
    };
  }, []);
  if (!dots || !dots.DotSwarm) return null;
  const shape = DOT_SHAPES[props.phase] || "orb";
  const listening = props.phase === "waiting" || props.phase === "speaking";
  return h(
    "span",
    { className: props.className || "pp-ddots", "aria-hidden": "true" },
    h(dots.DotSwarm, {
      shape,
      count: props.size && props.size > 100 ? 260 : 140,
      dotSize: props.size && props.size > 100 ? 2.5 : 2,
      color: listening ? "#c43030" : props.phase === "professor" ? "#2f6fd6" : "#8d8f96",
      // The student's voice drives the swarm: louder is livelier.
      speed: props.phase === "speaking" ? 1 + Math.min(2, (props.level || 0) * 20) : 0.6,
      choreography: "flow",
      transitionDuration: 0.6,
      style: { width: props.size || 64, height: props.size || 64 },
      label: shape,
    }),
  );
}

/** Kept in step with `screenChannel` in server/student-screen.js by hand. */
const screenChannelName = (assessmentId, studentId) => "professor-pane-defence:" + assessmentId + ":" + studentId;

export function DefenceDesk(props) {
  const close = props.onClose;
  const [data, setData] = React.useState(null);
  const [recording, setRecording] = React.useState(null); // { question, started }
  const [sending, setSending] = React.useState(null);
  const [said, setSaid] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [manualLevel, setManualLevel] = React.useState(0);
  // AGT-5: live captions for the take in hand, and whether to make them.
  const [captions, setCaptions] = React.useState(null); // { question, pieces: [{ index, text }] }
  const [liveCaptions, setLiveCaptions] = React.useState(true);
  // The stage (big button, live transcript, everything else in a drawer)
  // or the list (every control and question in one column). Remembered in
  // this browser only; the list is one press away.
  const [view, setView] = React.useState(() => {
    try {
      return window.localStorage.getItem("professor-pane.defence-view") || "stage";
    } catch {
      return "stage";
    }
  });
  const chooseView = (next) => {
    setView(next);
    try {
      window.localStorage.setItem("professor-pane.defence-view", next);
    } catch {}
  };
  const [drawer, setDrawer] = React.useState(true);
  /*
   * AGT-11: how the defence is taken. `whole` (the default): one
   * recording of the whole conversation, transcribed live, with a press
   * for each new question as a hint; the session's model divides it into
   * its questions afterwards. `questions`: hands-free, one take per
   * question, the desk choosing what comes next. Remembered here only.
   */
  const [mode, setMode] = React.useState(() => {
    try {
      return window.localStorage.getItem("professor-pane.defence-mode") === "questions" ? "questions" : "whole";
    } catch {
      return "whole";
    }
  });
  const chooseMode = (next) => {
    setMode(next);
    try {
      window.localStorage.setItem("professor-pane.defence-mode", next);
    } catch {}
  };
  // The whole take in hand: when it started, the presses so far, and the
  // time spent paused — so every mark is in seconds of audio, not of clock.
  const whole = React.useRef({ started: null, marks: [], paused: null, pausedMs: 0 });
  const [wholeMarks, setWholeMarks] = React.useState([]);
  const [splitting, setSplitting] = React.useState(null); // { question, take }
  const liveCaptionsRef = React.useRef(true);
  liveCaptionsRef.current = liveCaptions;
  const captionLoop = React.useRef(null);
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
  // AGT-4: the student's screen, over a BroadcastChannel. `ready` once the
  // professor has clicked it (browsers speak only after a click), `last`
  // the state to repeat to a screen opened late, `said` a counter naming
  // each read-aloud so its "spoken" reply can be matched.
  const screen = React.useRef({ channel: null, open: false, ready: false, last: null, said: 0, waiting: null, onSpoken: null });
  const [screenState, setScreenState] = React.useState("closed"); // closed | open | ready
  const [readAloud, setReadAloud] = React.useState(false);
  const readAloudRef = React.useRef(false);
  readAloudRef.current = readAloud && screenState === "ready";
  const recorder = React.useRef(null);
  // The hands-free loop's own state, outside React: it runs ten times a
  // second and must see the latest of everything without re-subscribing.
  const loop = React.useRef(null);
  const dataRef = React.useRef(null);
  dataRef.current = data;

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

  /*
   * AGT-6: the professor's own words. Holding P — or the button — while
   * speaking marks the stretch as theirs, in seconds from the start of the
   * take in hand; the server then never counts it as the student's answer,
   * whatever the provider heard. `origin` is the take's start, `held` when
   * the key went down, `ranges` the closed stretches.
   */
  const marks = React.useRef({ origin: null, held: null, ranges: [] });
  const [professorTalking, setProfessorTalking] = React.useState(false);
  const openMarks = (origin) => {
    marks.current = { origin, held: marks.current.held !== null ? origin : null, ranges: [] };
  };
  const closeMarks = () => {
    const current = marks.current;
    const now = Date.now();
    if (current.origin !== null && current.held !== null) current.ranges.push([(current.held - current.origin) / 1000, (now - current.origin) / 1000]);
    const ranges = current.ranges;
    marks.current = { origin: null, held: current.held !== null ? now : null, ranges: [] };
    return ranges;
  };
  const speakDown = () => {
    if (marks.current.held !== null) return;
    marks.current.held = Date.now();
    setProfessorTalking(true);
  };
  const speakUp = () => {
    const current = marks.current;
    if (current.held === null) return;
    if (current.origin !== null) {
      current.ranges.push([Math.max(0, (current.held - current.origin) / 1000), (Date.now() - current.origin) / 1000]);
    }
    current.held = null;
    setProfessorTalking(false);
  };
  React.useEffect(() => {
    const typing = (event) => /^(INPUT|TEXTAREA)$/.test(String(event.target && event.target.tagName));
    const down = (event) => {
      if ((event.key === "p" || event.key === "P") && !event.repeat && !typing(event)) speakDown();
    };
    const up = (event) => {
      if (event.key === "p" || event.key === "P") speakUp();
    };
    // Letting go anywhere, or leaving the window, ends the stretch: a key
    // stuck "down" would hand the rest of the answer to the professor.
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", speakUp);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", speakUp);
    };
  }, []);

  /** The hold-to-speak button, for a professor without a free hand on the keyboard. */
  const speakButton = () =>
    h(
      "button",
      {
        type: "button",
        className: "pp-segbtn" + (professorTalking ? " pp-dspeaking" : ""),
        onPointerDown: (event) => {
          event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture(event.pointerId);
          speakDown();
        },
        onPointerUp: speakUp,
        onPointerCancel: speakUp,
        title: "Hold while you speak, so your words are not taken for the student's answer.",
      },
      professorTalking ? "You are speaking — not the answer" : "Hold to speak (P)",
    );
  const query =
    "?run=" + encodeURIComponent(props.runId) +
    "&assessment=" + encodeURIComponent(props.assessment) +
    "&student=" + encodeURIComponent(props.student);
  const endpoint = (path, extra) => scoped(BASE + path + query + (extra || ""), props.sessionId);

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

  /*
   * AGT-5, live captions. A second recorder on the same microphone,
   * restarted every few seconds so each piece is a whole little file any
   * provider can read; a piece in which somebody spoke is sent for a
   * caption, a silent one is not, and nothing is sent while the
   * professor holds P. Captions are provisional and kept nowhere: the
   * transcript that counts is the take's, when it ends.
   */
  const CAPTION_MS = 5000;
  const startCaptions = (stream, questionId, type) => {
    stopCaptions();
    setCaptions({ question: questionId, pieces: [], partial: "", mode: null });
    if (!liveCaptionsRef.current) return;
    const loop = { active: true, index: 0, loud: false, recorder: null, timer: null, cleanup: null };
    captionLoop.current = loop;
    // AGT-8: stream where the connection can (Scribe), word by word; else,
    // or if streaming fails, the five-second pieces below.
    fetch(endpoint("/api/defence/realtime"), { method: "POST" })
      .then((response) => response.json())
      .then((result) => {
        if (!loop.active) return;
        if (result.session) startStreaming(loop, stream, result.session, questionId, type);
        else startPieces(loop, stream, questionId, type);
      })
      .catch(() => loop.active && startPieces(loop, stream, questionId, type));
  };

  /** Float samples at the microphone's rate to 16-bit PCM at the stream's, as base64. */
  const pcmBase64 = (input, ratio, silent) => {
    const length = Math.floor(input.length / ratio);
    const pcm = new Int16Array(length);
    if (!silent) {
      for (let index = 0; index < length; index += 1) {
        // The mean of the samples this one stands for: a plain low-pass.
        const from = Math.floor(index * ratio);
        const to = Math.min(input.length, Math.floor((index + 1) * ratio));
        let sum = 0;
        for (let at = from; at < to; at += 1) sum += input[at];
        const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
        pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
      }
    }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000));
    return btoa(binary);
  };

  /*
   * Streaming captions (AGT-8): the microphone, brought down to 16 kHz
   * 16-bit PCM, straight to the provider's socket, with a single-use token
   * the server minted; the key stays on the server. While the professor
   * holds P, silence is sent instead, so their words are never captioned.
   * A socket that fails before it opens hands the take to the pieces.
   */
  const startStreaming = (loop, stream, session, questionId, type) => {
    let socket;
    try {
      socket = new WebSocket(session.url);
    } catch {
      startPieces(loop, stream, questionId, type);
      return;
    }
    let opened = false;
    let audio = null;
    let source = null;
    let node = null;
    const teardown = () => {
      try {
        if (node) node.disconnect();
        if (source) source.disconnect();
        if (audio && audio.state !== "closed") audio.close();
      } catch {}
      node = source = audio = null;
    };
    // A socket that fails before it opens fires both error and close: one
    // fallback, not two caption loops.
    const fallBack = () => {
      teardown();
      if (loop.fellBack || opened || !loop.active) return;
      loop.fellBack = true;
      startPieces(loop, stream, questionId, type);
    };
    socket.onopen = () => {
      opened = true;
      setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "streaming" }) : current));
      try {
        audio = new AudioContext();
        source = audio.createMediaStreamSource(stream);
        node = audio.createScriptProcessor(4096, 1, 1);
        const ratio = audio.sampleRate / session.sampleRate;
        node.onaudioprocess = (event) => {
          // A paused whole defence sends nothing: the gap is not in the recording either.
          if (socket.readyState !== 1 || whole.current.paused !== null) return;
          socket.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: pcmBase64(event.inputBuffer.getChannelData(0), ratio, marks.current.held !== null),
              commit: false,
              sample_rate: session.sampleRate,
            }),
          );
        };
        source.connect(node);
        // A script processor runs only while connected onwards; it writes
        // nothing, so the speakers hear silence.
        node.connect(audio.destination);
      } catch {
        socket.close();
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const kind = String(message.message_type || "");
      if (kind === "partial_transcript") {
        setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { partial: String(message.text || "") }) : current));
      } else if (kind === "committed_transcript") {
        const text = String(message.text || "").trim();
        const index = loop.index;
        loop.index += 1;
        setCaptions((current) =>
          current && current.question === questionId
            ? Object.assign({}, current, { partial: "", pieces: text ? current.pieces.concat([{ index, text }]) : current.pieces })
            : current,
        );
      } else if (/error|exceeded|limited|exhausted/.test(kind)) {
        setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "failed:" + (message.error || kind) }) : current));
        socket.close();
      }
    };
    socket.onerror = () => fallBack();
    socket.onclose = () => fallBack();
    loop.cleanup = () => {
      teardown();
      if (socket.readyState === 1) {
        // Ask for the last words before closing.
        try {
          socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: session.sampleRate }));
        } catch {}
        setTimeout(() => socket.close(), 1500);
      } else if (socket.readyState === 0) {
        socket.close();
      }
    };
  };

  /** The five-second pieces (AGT-5): any provider, a caption per piece in which someone spoke. */
  const startPieces = (loop, stream, questionId, type) => {
    setCaptions((current) => (current && current.question === questionId ? Object.assign({}, current, { mode: "pieces" }) : current));
    const cycle = () => {
      if (!loop.active) return;
      let piece;
      try {
        piece = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      } catch {
        return;
      }
      const chunks = [];
      piece.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      piece.onstop = () => {
        const index = loop.index;
        loop.index += 1;
        const spoke = loop.loud;
        loop.loud = false;
        const blob = new Blob(chunks, { type: (piece.mimeType || type || "audio/webm").split(";")[0] });
        if (spoke && blob.size) caption(questionId, index, blob);
        if (loop.active && stream.active) cycle();
      };
      loop.recorder = piece;
      piece.start();
      loop.timer = setTimeout(() => piece.state !== "inactive" && piece.stop(), CAPTION_MS);
    };
    cycle();
  };
  const stopCaptions = () => {
    const loop = captionLoop.current;
    if (!loop) return;
    loop.active = false;
    clearTimeout(loop.timer);
    if (loop.cleanup) loop.cleanup();
    // The last piece is still captioned: the answer's final words.
    if (loop.recorder && loop.recorder.state !== "inactive") loop.recorder.stop();
    captionLoop.current = null;
  };
  /** Someone is audibly speaking — not the professor holding P — so this piece is worth a caption. */
  const heard = (level, threshold) => {
    const loop = captionLoop.current;
    if (loop && level > threshold && marks.current.held === null && whole.current.paused === null) loop.loud = true;
  };
  const caption = (questionId, index, blob) =>
    fetch(endpoint("/api/defence/caption", "&question=" + encodeURIComponent(questionId)), {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.error || !String(result.text || "").trim()) return;
        setCaptions((current) =>
          current && current.question === questionId
            ? Object.assign({}, current, {
                pieces: current.pieces.concat([{ index, text: String(result.text).trim() }]).sort((a, b) => a.index - b.index),
              })
            : current,
        );
      })
      .catch(() => {});

  /** The captions, under whatever is recording. */
  const captionsView = (questionId) =>
    captions && captions.question === questionId && (captions.pieces.length || captions.partial)
      ? h(
          "div",
          { className: "pp-dcaption", "aria-live": "polite" },
          h("span", { className: "pp-dim" }, captions.mode === "streaming" ? "Live: " : "Live, every few seconds: "),
          captions.pieces.slice(captions.from || 0).map((piece) => piece.text).join(" "),
          captions.partial ? h("span", { className: "pp-dpartial" }, " " + captions.partial) : null,
        )
      : null;

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
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
          (candidate) => MediaRecorder.isTypeSupported(candidate),
        );
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

  /*
   * What the student's screen shows. Only the question being asked, by
   * number, and whether it is recording: never a reason, a criterion, a
   * proposal still waiting, or what comes next. Returns the text sent,
   * for the read-aloud timeout.
   */
  const showOnScreen = (questionId, phase, speak, picked) => {
    const questions = (dataRef.current && dataRef.current.questions) || [];
    // In a whole defence the take stays Q0, so the student's own words
    // still show under it; `picked` is the prepared question the
    // professor said they are asking, shown in its place.
    const entry = (picked && questions.find((q) => q.id === picked)) || (questionId ? questions.find((q) => q.id === questionId) : null);
    const prepared = questions.filter((q) => q.kind !== "follow_up" && q.kind !== "whole");
    const label = !entry
      ? ""
      : entry.kind === "follow_up"
        ? "Follow-up question"
        : entry.kind === "whole"
          ? "The defence"
          : "Question " + (prepared.findIndex((q) => q.id === entry.id) + 1) + " of " + prepared.length;
    const languages = (dataRef.current && dataRef.current.languages) || [];
    const state = {
      type: "state",
      question: questionId || null,
      title: (dataRef.current && dataRef.current.assessment && dataRef.current.assessment.title) || "",
      label,
      // The whole defence has no one question to show: the professor asks aloud.
      text: entry ? (entry.kind === "whole" ? "Answer the professor's questions as they come." : entry.text) : "",
      phase,
      lang: languages.length === 1 ? languages[0] : undefined,
    };
    if (speak) {
      screen.current.said += 1;
      state.speak = true;
      state.id = screen.current.said;
    }
    // A late screen is told where things stand, but never asked to speak again.
    screen.current.last = Object.assign({}, state, { speak: false });
    if (screen.current.channel) screen.current.channel.postMessage(state);
    return state.text;
  };

  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel(screenChannelName(props.assessment, props.student));
    screen.current.channel = channel;
    channel.onmessage = (event) => {
      const message = event.data || {};
      screen.current.seen = Date.now();
      if (message.type === "alive") {
        const ready = screen.current.ready || Boolean(message.ready);
        if (!screen.current.open || ready !== screen.current.ready) {
          screen.current.open = true;
          screen.current.ready = ready;
          setScreenState(ready ? "ready" : "open");
        }
      } else if (message.type === "hello") {
        screen.current.open = true;
        screen.current.ready = screen.current.ready || Boolean(message.ready);
        setScreenState(screen.current.ready ? "ready" : "open");
        channel.postMessage(screen.current.last || { type: "state", phase: "idle" });
      } else if (message.type === "bye") {
        screen.current.open = false;
        screen.current.ready = false;
        setScreenState("closed");
      } else if (message.type === "spoken" && screen.current.onSpoken) {
        screen.current.onSpoken(message.id);
      }
    };
    // A screen silent for five seconds has been closed, whatever it said.
    const watch = setInterval(() => {
      if (screen.current.open && Date.now() - (screen.current.seen || 0) > 5000) {
        screen.current.open = false;
        screen.current.ready = false;
        setScreenState("closed");
      }
    }, 1000);
    return () => {
      clearInterval(watch);
      channel.postMessage({ type: "state", phase: "idle" });
      channel.close();
      screen.current.channel = null;
    };
  }, [props.assessment, props.student]);

  const openScreen = () =>
    window.open(
      scoped(BASE + "/defence/screen?assessment=" + encodeURIComponent(props.assessment) + "&student=" + encodeURIComponent(props.student), props.sessionId),
      "defence-screen-" + props.student,
      "popup,width=1100,height=700",
    );

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
  const PROPOSE_MS = 5000;
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
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
          (candidate) => MediaRecorder.isTypeSupported(candidate),
        );
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

  // DEF-5: once answers are in, the session's model proposes the marks,
  // citing the moments in the recording; the professor decides them in
  // the grading view like any other suggestion.
  const proposeGrade = () =>
    props.ask("/defend-submission " + props.assessment + " " + props.runId + " " + props.student + " — propose the grade");
  const gradeRow = () => {
    const usable = ((data && data.answers) || []).filter((answer) => answer.transcript && !answer.withdrawn);
    if (!usable.length || handsFree || recording) return null;
    return h(
      "div",
      { className: "pp-approverow" },
      h("button", { type: "button", className: "pp-segbtn", onClick: proposeGrade }, "Propose the grade"),
      h(
        "span",
        { className: "pp-dim" },
        "the session's model reads what the student said and the code, and writes suggested marks citing the recording; you decide them",
      ),
    );
  };

  const clock = (seconds) => Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");

  const criteria = new Map(((data && data.criteria) || []).map((criterion) => [criterion.id, criterion.title]));
  const answers = (data && data.answers) || [];
  const where = data && data.transcription;

  const take = (answer) =>
    h(
      "div",
      { className: "pp-dtake", key: answer.audio },
      h(
        "div",
        { className: "pp-dtakehead" },
        "Take " + answer.take + (answer.seconds ? " · " + clock(answer.seconds) : ""),
        h("audio", {
          id: "pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"),
          controls: true,
          preload: "none",
          src: endpoint("/api/defence/audio", "&file=" + encodeURIComponent(answer.audio)),
        }),
      ),
      // Whose words: the professor's are marked and dimmed, another voice
      // likewise, and a take whose voices could not be told apart says so
      // above its words — it is kept, and never cited as the answer.
      answer.transcript && answer.transcript.speakers && answer.transcript.speakers.unclear
        ? h("div", { className: "pp-dwarn" }, "Voices unclear — not cited as the student's: " + (answer.transcript.speakers.note || ""))
        : null,
      voicePicker(answer),
      answer.transcript
        ? h(
            "div",
            { className: "pp-dtranscript" },
            answer.transcript.segments.map((segment, index) => {
              const other = segment.speaker === "professor" ? "You: " : segment.speaker === "unknown" ? "Other voice: " : "";
              return h(
                "span",
                {
                  key: index,
                  className: (other ? "pp-dother " : "") + (segment.confidence === "low" ? "pp-dlow" : ""),
                  title: clock(segment.start) + (segment.confidence === "low" ? " · low confidence — listen to it" : ""),
                },
                other ? h("b", null, other) : null,
                segment.text + " ",
              );
            }),
            answer.transcript.timed ? null : h("span", { className: "pp-dim" }, " (no timestamps from this model)"),
          )
        : h("div", { className: "pp-dim" }, answer.error ? "Not transcribed: " + answer.error : "Transcribing…"),
      answer.question_id === "Q0" ? splitView(answer) : null,
    );

  /*
   * AGT-11: the whole defence divided into its questions, under its
   * recording. Each part says when it starts — pressing the time plays
   * from there — what was asked and which criterion its answer counts
   * for. A draft until the professor says the parts are right.
   */
  const splitView = (answer) => {
    if (!answer.transcript || answer.withdrawn) return null;
    const found = ((data && data.splits) || []).find((entry) => entry.question_id === answer.question_id && entry.take === answer.take);
    const busyHere = splitting && splitting.question === answer.question_id && splitting.take === answer.take;
    const play = (seconds) => {
      const audio = document.getElementById("pp-daudio-" + answer.audio.replace(/[^\w-]/g, "_"));
      if (!audio) return;
      audio.currentTime = seconds;
      audio.play().catch(() => {});
    };
    return h(
      "div",
      { className: "pp-dsplit" },
      busyHere
        ? h("div", { className: "pp-dim" }, "Dividing the defence into its questions…")
        : found
          ? h(
              React.Fragment,
              null,
              h(
                "div",
                { className: "pp-dim" },
                found.parts.length + " question(s), divided by " + found.by + (found.approval === "approved" ? " · you checked them" : " · a draft: check the parts"),
              ),
              h(
                "ol",
                { className: "pp-dsplitlist" },
                found.parts.map((part, index) =>
                  h(
                    "li",
                    { key: index },
                    h("button", { type: "button", className: "pp-dsplitat", title: "Play from here", onClick: () => play(part.start) }, clock(part.start)),
                    " ",
                    part.question_id ? h("b", null, part.question_id + " ") : h("span", { className: "pp-dim" }, "not prepared · "),
                    part.asked,
                    part.criterion_id ? h("span", { className: "pp-dim" }, " · " + (criteria.get(part.criterion_id) || part.criterion_id)) : null,
                  ),
                ),
              ),
              found.notes && found.notes.length ? h("div", { className: "pp-dwarn" }, found.notes.join(" · ")) : null,
              h(
                "div",
                { className: "pp-approverow" },
                found.approval !== "approved"
                  ? h("button", { type: "button", className: "pp-segbtn", onClick: () => split(answer.question_id, answer.take, "approve") }, "These are right")
                  : null,
                h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => split(answer.question_id, answer.take) }, "Divide again"),
              ),
            )
          : h(
              "div",
              { className: "pp-approverow" },
              h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(splitting), onClick: () => split(answer.question_id, answer.take) }, "Divide into questions"),
              h("span", { className: "pp-dim" }, "the session's model reads the dialogue, your presses as hints; nothing is graded"),
            ),
    );
  };

  // The student's screen: open it, see that it is ready, and choose
  // whether it reads each question aloud.
  const screenRow = () =>
    h(
      "div",
      { className: "pp-approverow" },
      h("button", { type: "button", className: "pp-segbtn", onClick: openScreen }, screenState === "closed" ? "Open student screen" : "Show student screen"),
      h(
        "span",
        { className: screenState === "ready" ? "pp-dim" : "pp-dwarn" },
        screenState === "closed"
          ? typeof BroadcastChannel === "undefined"
            ? "this browser cannot drive a second window"
            : "not open — the question is then only on this screen"
          : screenState === "open"
            ? "open — click it once, then move it to the screen the student sees"
            : "ready: it shows the question being asked and nothing else",
      ),
      h(
        "label",
        { className: "pp-dim pp-dchooser" },
        h("input", {
          type: "checkbox",
          checked: readAloud,
          disabled: screenState !== "ready",
          onChange: (event) => setReadAloud(event.target.checked),
        }),
        " read each question aloud there",
      ),
    );

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

  const clockTime = (iso) => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? iso : String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0");
  };

  const consentPanel = () => {
    const previous = data.consent;
    if (consented) {
      return h(
        "div",
        { className: "pp-approverow" },
        h("span", { className: "pp-dim", title: previous.statement }, "The student agreed to be recorded at " + clockTime(previous.at) + "."),
        confirmWithdraw
          ? h(
              React.Fragment,
              null,
              h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: consentBusy, onClick: withdraw }, "Stop and record the withdrawal"),
              h("button", { type: "button", className: "pp-segbtn", onClick: () => setConfirmWithdraw(false) }, "Cancel"),
            )
          : h("button", { type: "button", className: "pp-segbtn", onClick: () => setConfirmWithdraw(true) }, "The student withdraws"),
      );
    }
    return h(
      "div",
      { className: "pp-dconsent" },
      h("b", null, previous && previous.withdrawn_at ? "The student withdrew at " + clockTime(previous.withdrawn_at) + "." : "Before anything is recorded"),
      previous && previous.withdrawn_at
        ? h("div", { className: "pp-dim" }, "Nothing more is recorded. The takes before it are kept and marked withdrawn, so nothing cites them; deleting them is your decision.")
        : h(
            React.Fragment,
            null,
            h("div", null, "Read this to the student, or let them read it on their screen:"),
            h("blockquote", { className: "pp-dstatement" }, data.statement),
            previous && !previous.agreed
              ? h("div", { className: "pp-dwarn" }, "At " + clockTime(previous.at) + " the student did not agree. Nothing is recorded unless they agree now.")
              : null,
            h(
              "div",
              { className: "pp-approverow" },
              h("button", { type: "button", className: "pp-segbtn pp-drec", disabled: consentBusy, onClick: () => answerConsent("agree") }, "The student agreed"),
              h("button", { type: "button", className: "pp-segbtn", disabled: consentBusy, onClick: () => answerConsent("decline") }, "The student did not agree"),
            ),
          ),
    );
  };

  /*
   * "This voice is me". Offered on a take whose voices were separated but
   * not settled — a whole defence always, an ordinary take when two voices
   * spoke about as much — and on one already settled, to correct it. Each
   * voice is shown by the first thing it said, which is how a professor
   * recognises their own question.
   */
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
  const voicePicker = (answer) => {
    const transcript = answer.transcript;
    if (!transcript) return null;
    const voices = [];
    for (const segment of transcript.segments) {
      if (!segment.speaker_id || voices.some((voice) => voice.id === segment.speaker_id)) continue;
      voices.push({ id: segment.speaker_id, first: segment.text });
    }
    const settled = transcript.speakers && transcript.speakers.professor_voices;
    if (voices.length < 2 || (!transcript.speakers.unclear && !settled)) return null;
    return h(
      "div",
      { className: "pp-approverow pp-dvoices" },
      h("span", { className: "pp-dim" }, settled ? "Your voice:" : "Which voice is yours?"),
      voices.map((voice) =>
        h(
          "button",
          {
            type: "button",
            key: voice.id,
            className: "pp-segbtn",
            "aria-pressed": !!settled && settled.includes(voice.id),
            title: voice.id,
            onClick: () => assignVoice(answer, voice.id),
          },
          "“" + (voice.first.length > 48 ? voice.first.slice(0, 46) + "…" : voice.first) + "” is me",
        ),
      ),
    );
  };

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

  // A manual take in progress — one question, or the whole defence — with
  // the same dots as hands-free, following the level of the voice.
  const recordingPanel = () => {
    const whole = recording.question === "Q0";
    const phase = professorTalking ? "professor" : manualLevel > 0.02 ? "speaking" : "waiting";
    return h(
      "div",
      { className: "pp-dhands pp-dhandsdots" },
      h(ListeningDots, { phase, level: manualLevel }),
      h(
        "div",
        { className: "pp-dhandsbody" },
        h(
          "div",
          { className: "pp-dhandsline" },
          h("b", null, whole ? "The whole defence" + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) : "") : recording.question),
          (recording.paused ? " · paused at " : " · recording ") + clock(elapsed) + (phase === "speaking" ? " · hearing a voice" : phase === "professor" ? " · you are speaking" : ""),
        ),
        captionsView(recording.question),
        h(
          "div",
          { className: "pp-approverow" },
          whole && !recording.paused ? h("button", { type: "button", className: "pp-segbtn", onClick: () => markQuestion(null) }, "Next question (Space)") : null,
          whole ? h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? resumeWhole : pauseWhole }, recording.paused ? "Resume" : "Pause") : null,
          h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: stop }, "■ Stop"),
          speakButton(),
        ),
        whole
          ? h(
              "div",
              { className: "pp-dim" },
              "Ask as you go. Press Space at each new question, or Asking this beside a prepared one — hints for dividing it afterwards. Hold P while you speak.",
            )
          : null,
      ),
    );
  };

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

  /*
   * The stage. The big button does the one thing the moment calls for:
   * start, mark the next question of a whole defence (as Space does),
   * resume it, end a hands-free answer, or ask a waiting proposal now.
   * The other controls of the moment sit in one row beside it — Pause,
   * Stop, Skip, hold to speak — and, at rest, the choice of mode.
   */
  const wholeRec = Boolean(recording && recording.question === "Q0");
  const stagePhase = proposal
    ? "proposing"
    : handsFree
      ? handsFree.phase
      : recording
        ? recording.paused
          ? "idle"
          : professorTalking
            ? "professor"
            : manualLevel > 0.02
              ? "speaking"
              : "waiting"
        : splitting
          ? "thinking"
          : "idle";
  const stageQuestionId = handsFree && handsFree.question ? handsFree.question : recording ? recording.question : null;
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
  const bigLabel =
    !consented
      ? "Consent first"
      : proposal
        ? "Ask now"
        : stagePhase === "thinking" && handsFree
          ? "Choosing…"
          : stagePhase === "reading"
            ? "Reading aloud"
            : wholeRec
              ? recording.paused
                ? "Resume"
                : "Next question"
              : handsFree || recording
                ? "End answer"
                : sending
                  ? "Transcribing…"
                  : splitting
                    ? "Dividing…"
                    : "Start";
  /** The row beside the big button: what else the moment allows. */
  const stageRow = () => {
    if (!consented) return null;
    if (wholeRec) {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: recording.paused ? resumeWhole : pauseWhole }, recording.paused ? "Resume" : "Pause"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: stop }, "■ Stop"),
        recording.paused ? null : speakButton(),
      );
    }
    if (handsFree && !proposal && handsFree.phase !== "thinking") {
      return h(
        React.Fragment,
        null,
        h("button", { type: "button", className: "pp-segbtn", onClick: () => endTake("skip") }, "Skip"),
        h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => endTake("pause") }, "Pause"),
        speakButton(),
      );
    }
    if (recording) return speakButton();
    if (handsFree || proposal || sending || splitting) return null;
    return h(
      "span",
      { className: "pp-approverow", role: "group", "aria-label": "Mode" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "whole",
          title: "One recording of the whole conversation, transcribed as it goes; divided into its questions afterwards.",
          onClick: () => chooseMode("whole"),
        },
        "Whole defence",
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": mode === "questions",
          title: "Hands-free, one take per question: an answer ends after a pause, and the next question comes up by itself.",
          onClick: () => chooseMode("questions"),
        },
        "Question by question",
      ),
    );
  };
  const stageView = () => {
    const questions = (data && data.questions) || [];
    const entry = stageQuestionId ? questions.find((q) => q.id === stageQuestionId) : null;
    const lastId = captions && captions.question;
    const last = lastId ? questions.find((q) => q.id === lastId) : null;
    // Once nothing records, the last words stay under a heading that says
    // whose they were, dimmed, until the next take begins.
    const shown = entry || last;
    const pickedMark = wholeRec && wholeMarks.length ? wholeMarks[wholeMarks.length - 1] : null;
    const picked = pickedMark && pickedMark.question_id ? questions.find((q) => q.id === pickedMark.question_id) : null;
    const latestSplit = ((data && data.splits) || []).filter((entry) => entry.question_id === "Q0").slice(-1)[0] || null;
    const heading = wholeRec
      ? "The whole defence" + (recording.paused ? " · paused" : "") + (wholeMarks.length ? " · question " + (wholeMarks.length + 1) + (picked ? " (" + picked.id + ")" : "") : "")
      : splitting
        ? "Dividing the defence into its questions…"
        : entry
          ? entry.id + (entry.follows ? " · follow-up on " + entry.follows : "") + (entry.criterion_id ? " · " + ((data.criteria || []).find((c) => c.id === entry.criterion_id) || {}).title : "")
          : shown
            ? shown.kind === "whole"
              ? "The whole defence, recorded"
              : shown.id + " answered"
            : consented
              ? "Ready"
              : "Before anything is recorded";
    const words = captions && (!stageQuestionId || captions.question === stageQuestionId) ? captions : null;
    // The stage shows the latest words, to glance at; all of them are in
    // the drawer and, once it ends, in the take's transcript.
    const heardWords = words ? words.pieces.slice(words.from || 0).map((piece) => piece.text).join(" ").split(/\s+/).filter(Boolean) : [];
    const spoken = heardWords.length > 80 ? ["…"].concat(heardWords.slice(-80)) : heardWords;
    const live = stagePhase === "waiting" || stagePhase === "speaking" || stagePhase === "professor";
    const stale = Boolean(words && !recording && !handsFree);
    return h(
      "div",
      { className: "pp-stage" },
      h(
        "div",
        { className: "pp-stagefg" },
        h(
          "div",
          { className: "pp-stageq" },
          h("b", null, heading.replace(/ · undefined$/, "")),
          picked
            ? h("div", null, picked.text)
            : entry && entry.kind !== "whole"
              ? h("div", null, entry.text)
              : !consented
                ? h("div", null, "Open the drawer: the student agrees first.")
                : !recording && !handsFree && !shown
                  ? h(
                      "div",
                      null,
                      mode === "whole"
                        ? "One recording of the whole defence, transcribed as you talk. Press Space at each new question; it is divided into its questions afterwards."
                        : "Hands-free, one question at a time: an answer ends after a pause, and the next question comes up.",
                    )
                  : null,
        ),
        h(
          "button",
          {
            type: "button",
            className: "pp-stagebtn" + (live ? " pp-stagelive" : ""),
            onClick: bigPress,
            "aria-label": bigLabel,
          },
          h(ListeningDots, { phase: stagePhase, level: handsFree ? handsFree.level : manualLevel, size: 130, className: "pp-stagedots" }),
          h("span", { className: "pp-stagebtnlabel" }, bigLabel + (recording ? " · " + clock(elapsed) : "")),
        ),
        h("div", { className: "pp-approverow pp-stagerow" }, stageRow()),
        h(
          "div",
          { className: "pp-stagetr" + (stale ? " pp-stagetrold" : ""), "aria-live": "polite" },
          words && (spoken.length || words.partial)
            ? h(
                React.Fragment,
                null,
                spoken.join(" "),
                words.partial ? h("span", { className: "pp-dpartial" }, " " + words.partial) : null,
              )
            : h(
                "span",
                { className: "pp-dpartial" },
                recording && recording.paused
                  ? "Paused — nothing is recorded or sent until you resume."
                  : live
                    ? liveCaptions
                      ? wholeRec
                        ? "Listening — what is said appears here as it is said."
                        : "Listening — the student's words appear here as they speak."
                      : "Live captions are off."
                    : "The transcript appears here as the student speaks.",
              ),
        ),
        h(
          "div",
          { className: "pp-dim" },
          stagePhase === "professor"
            ? "You are speaking — not the answer"
            : handsFree && handsFree.phase === "speaking" && handsFree.silent
              ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s — the answer ends at 2.5 s"
              : splitting
                ? "The session's model is reading the dialogue, your presses as hints."
                : stagePhase === "thinking"
                  ? "Transcribing and choosing what to ask next…"
                  : proposal
                    ? "The next question is waiting in the drawer"
                    : wholeRec && live
                      ? "Space: a new question · Hold P to speak · Asking this, in the drawer, names a prepared one"
                      : live
                        ? "Hold P to speak · Space ends the answer"
                        : sending
                          ? "Transcribing the recording…"
                          : !recording && !handsFree && latestSplit && mode === "whole"
                            ? "Divided into " + latestSplit.parts.length + " question(s)" + (latestSplit.approval === "approved" ? ", checked" : " — check them in the drawer")
                            : "",
        ),
      ),
      h(
        "div",
        { className: "pp-drawer" },
        h(
          "div",
          { className: "pp-drawerhead" },
          h(
            "button",
            { type: "button", className: "pp-segbtn", "aria-expanded": drawer, onClick: () => setDrawer(!drawer) },
            (drawer ? "▾ " : "▴ ") + "Questions and controls",
          ),
          pending > 0 ? h("span", { className: "pp-dim" }, pending + " recording(s) transcribing…") : null,
        ),
        drawer
          ? h(
              "div",
              { className: "pp-drawerbody" },
              proposal ? h("div", { className: "pp-dhands" }, proposalPanel()) : null,
              consentPanel(),
              screenRow(),
              consented && !handsFree && !recording ? startRow() : null,
              gradeRow(),
              said ? h("div", { className: said.error ? "pp-dwarn" : "pp-dim" }, said.text) : null,
              h("ol", { className: "pp-dlist" }, questions.map(question)),
            )
          : null,
      ),
    );
  };

  const startRow = () =>
    h(
      "div",
      { className: "pp-approverow" },
      // AGT-11: the two modes, each with its own start; the whole defence first.
      h(
        "span",
        { className: "pp-approverow", role: "group", "aria-label": "Mode" },
        h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "whole", onClick: () => chooseMode("whole") }, "Whole defence"),
        h("button", { type: "button", className: "pp-segbtn", "aria-pressed": mode === "questions", onClick: () => chooseMode("questions") }, "Question by question"),
      ),
      mode === "whole"
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-drec",
              disabled: Boolean(recording || sending),
              title: "One recording of the whole defence, transcribed as you talk. Press Space at each new question; the session's model divides it into its questions afterwards.",
              onClick: recordWhole,
            },
            "● Record the whole defence",
          )
        : h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-drec",
              disabled: Boolean(recording || sending),
              title: "Listens continuously: an answer ends after a pause of about two and a half seconds, and the next question comes up by itself.",
              onClick: startHandsFree,
            },
            "● Start hands-free",
          ),
      mode === "questions"
        ? h(
            "label",
            { className: "pp-dim pp-dchooser" },
            h("input", { type: "checkbox", checked: chooser, onChange: (event) => setChooser(event.target.checked) }),
            " the session's model chooses each next question — a follow-up, or the next prepared one",
          )
        : null,
      h(
        "label",
        {
          className: "pp-dim pp-dchooser",
          title: "Every few seconds of speech is transcribed as it is said, through the same provider. Each answer is then transcribed twice: the captions are not kept.",
        },
        h("input", { type: "checkbox", checked: liveCaptions, onChange: (event) => setLiveCaptions(event.target.checked) }),
        " live captions while the student answers",
      ),
      pending > 0 ? h("span", { className: "pp-dim" }, pending + " answer(s) transcribing…") : null,
    );

  const proposalPanel = () => {
    const current = proposal;
    const question = current.question;
    const left = Math.max(0, Math.ceil((current.deadline - now) / 1000));
    const done = current.decision.action === "done" || !question;
    const notes = current.decision.notes || [];
    return h(
      "div",
      { className: "pp-dproposal" },
      h(
        "div",
        { className: "pp-dhandsline" },
        done
          ? h("b", null, "Done?")
          : h("b", null, question.id + (question.follows ? " ↳ follow-up on " + question.follows : "")),
        current.editing === null ? h("span", { className: "pp-dcount" }, done ? "finishing in " + left + " s" : "asking in " + left + " s") : null,
      ),
      done
        ? h("div", null, current.decision.why || "Nothing left to ask.")
        : current.editing !== null
          ? h("textarea", {
              className: "pp-dedit",
              value: current.editing,
              rows: 2,
              autoFocus: true,
              onChange: (event) => setProposal(Object.assign({}, current, { editing: event.target.value })),
            })
          : h("div", { className: "pp-dqtext" }, question.text),
      !done && current.decision.why ? h("div", { className: "pp-dim" }, "Why: " + current.decision.why) : null,
      notes.length ? h("div", { className: "pp-dwarn" }, notes.join(" · ")) : null,
      h(
        "div",
        { className: "pp-dim" },
        "Chosen by " + current.decision.by + ".",
      ),
      h(
        "div",
        { className: "pp-approverow" },
        current.editing !== null
          ? h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => settle("edit", current.editing) }, "Save and ask")
          : h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => settle("ask_now") }, done ? "Finish now" : "Ask now"),
        !done && current.editing === null
          ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setProposal(Object.assign({}, current, { editing: question.text })) }, "Edit")
          : null,
        !done ? h("button", { type: "button", className: "pp-segbtn", onClick: () => settle("skip") }, "Skip — next prepared question") : null,
        h("button", { type: "button", className: "pp-segbtn", onClick: () => settle("pause") }, "Pause"),
      ),
    );
  };

  const handsPanel = () =>
    h(
      "div",
      { className: "pp-dhands pp-dhandsdots" },
      // One swarm for the whole defence, so it morphs between shapes
      // rather than starting over at each question.
      h(ListeningDots, { phase: proposal ? "proposing" : handsFree.phase, level: handsFree.level }),
      h("div", { className: "pp-dhandsbody" }, handsBody()),
    );

  const handsBody = () =>
      proposal
        ? proposalPanel()
        : handsFree.phase === "thinking" || handsFree.phase === "proposing"
          ? h(
              React.Fragment,
              null,
              h("div", { className: "pp-dhandsline" }, "Transcribing the answer and choosing what to ask next…"),
              captions ? captionsView(captions.question) : null,
            )
          : handsFree.phase === "reading"
          ? h("div", { className: "pp-dhandsline" }, h("b", null, handsFree.question), " · being read aloud on the student's screen — listening starts when it finishes")
          : h(
              React.Fragment,
              null,
              h(
                "div",
                { className: "pp-dhandsline" },
                h("b", null, handsFree.question),
                " · ",
                handsFree.phase === "professor"
                  ? "you are speaking — the answer waits"
                  : handsFree.phase === "speaking"
                  ? handsFree.silent
                    ? "pause " + (handsFree.silent / 1000).toFixed(1) + " s"
                    : "hearing the answer"
                  : "listening — waiting for the student to speak",
                h(
                  "span",
                  { className: "pp-dmeter", "aria-hidden": "true" },
                  h("span", {
                    className: "pp-dmeterfill" + (handsFree.level > handsFree.threshold ? " pp-dmeteron" : ""),
                    style: { width: Math.min(100, Math.round(handsFree.level * 400)) + "%" },
                  }),
                ),
              ),
              captionsView(handsFree.question),
              h(
                "div",
                { className: "pp-approverow" },
                h("button", { type: "button", className: "pp-segbtn", onClick: () => endTake("space") }, "End answer (Space)"),
                h("button", { type: "button", className: "pp-segbtn", onClick: () => endTake("skip") }, "Skip, no answer"),
                h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: () => endTake("pause") }, "Pause"),
                speakButton(),
              ),
              h(
                "div",
                { className: "pp-dim" },
                "Hold P (or the button) whenever you speak, so your words are not taken for the answer.",
              ),
            );

  const question = (entry) => {
    const takes = answers.filter((answer) => answer.question_id === entry.id);
    const live = (recording && recording.question === entry.id) || (handsFree && handsFree.question === entry.id);
    return h(
      "li",
      { className: "pp-dq" + (live ? " pp-dlive" : ""), key: entry.id },
      h(
        "div",
        { className: "pp-dqtext" },
        h("b", null, entry.id + (entry.follows ? " ↳ " + entry.follows : "") + " "),
        entry.text,
      ),
      h(
        "div",
        { className: "pp-dim" },
        [
          entry.kind === "opening" ? "opening" : entry.kind === "follow_up" ? "follow-up" : null,
          entry.criterion_id ? criteria.get(entry.criterion_id) || entry.criterion_id : null,
          (entry.evidence || []).map((cite) => cite.path + (cite.lines ? ":" + cite.lines : "")).join(", ") || null,
        ]
          .filter(Boolean)
          .join(" · "),
        entry.why ? h("div", null, entry.why) : null,
      ),
      h(
        "div",
        { className: "pp-approverow" },
        handsFree && handsFree.question === entry.id
          ? h("span", { className: "pp-drec pp-dlivemark" }, "● being asked — hands-free")
          : recording && recording.question === "Q0" && entry.kind !== "whole"
          ? // AGT-11: in a whole defence, say which prepared question you are asking.
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                "aria-pressed": wholeMarks.length > 0 && wholeMarks[wholeMarks.length - 1].question_id === entry.id,
                disabled: Boolean(recording.paused),
                onClick: () => markQuestion(entry.id),
              },
              wholeMarks.some((mark) => mark.question_id === entry.id) ? "Asking this again" : "Asking this",
            )
          : live
          ? h(React.Fragment, null, h("button", { type: "button", className: "pp-segbtn pp-drec", onClick: stop }, "■ Stop · " + clock(elapsed)), speakButton())
          : h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(recording || sending || handsFree || !consented),
                onClick: () => start(entry.id),
              },
              sending === entry.id ? "Transcribing…" : takes.length ? "● Record again" : "● Record answer",
            ),
        takes.length
          ? h(
              "button",
              { type: "button", className: "pp-segbtn", disabled: Boolean(recording || handsFree), onClick: () => followUp(entry.id) },
              "Follow-up question",
            )
          : null,
      ),
      takes.map(take),
    );
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
          ? h("div", { className: "pp-publishbody pp-stagebody" }, stageView())
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
          data && !data.error && data.questions.length ? screenRow() : null,
          data && !data.error && data.questions.length ? consentPanel() : null,
          data && !data.error && data.questions.length && consented ? (handsFree ? handsPanel() : recording ? recordingPanel() : startRow()) : null,
          data && !data.error ? gradeRow() : null,
          said ? h("div", { className: said.error ? "pp-dwarn" : "pp-dim" }, said.text) : null,
          data === null
            ? h("div", { className: "pp-dim" }, "Loading…")
            : data.error
              ? h("div", { className: "pp-dwarn" }, data.error)
              : !data.questions.length
                ? h("div", { className: "pp-dim" }, "No questions drafted yet — Start defence drafts them.")
                : h("ol", { className: "pp-dlist" }, data.questions.map(question)),
        ),
      ),
    ),
    document.body,
  );
}
