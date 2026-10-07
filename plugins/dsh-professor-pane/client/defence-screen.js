/**
 * AGT-4: the student's screen, a second window driven over a
 * BroadcastChannel. It shows the question being asked and nothing else, and
 * can read it aloud.
 */

import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/** Kept in step with `screenChannel` in server/student-screen.js by hand. */
const screenChannelName = (assessmentId, studentId) => "professor-pane-defence:" + assessmentId + ":" + studentId;

/**
 * The channel to the student's screen, and what the desk says over it.
 *
 * `screen.current` holds the channel; `ready` once the professor has clicked
 * the screen (browsers speak only after a click); `last`, the state to repeat
 * to a screen opened late; `said`, a counter naming each read-aloud so its
 * "spoken" reply can be matched; `waiting` and `onSpoken`, the read-aloud in
 * flight. `dataRef` is the desk's latest session payload.
 */
export function useStudentScreen(props, dataRef) {
  const screen = React.useRef({ channel: null, open: false, ready: false, last: null, said: 0, waiting: null, onSpoken: null });
  const [screenState, setScreenState] = React.useState("closed"); // closed | open | ready
  const [readAloud, setReadAloud] = React.useState(false);
  const readAloudRef = React.useRef(false);
  readAloudRef.current = readAloud && screenState === "ready";

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

  return { screen, screenState, readAloud, setReadAloud, readAloudRef, showOnScreen, openScreen };
}

/**
 * The student's screen: open it, see that it is ready, and choose whether it
 * reads each question aloud.
 */
export function ScreenRow(props) {
  const screenState = props.screenState;
  return h(
    "div",
    { className: "pp-approverow" },
    h("button", { type: "button", className: "pp-segbtn", onClick: props.onOpen }, screenState === "closed" ? "Open student screen" : "Show student screen"),
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
        checked: props.readAloud,
        disabled: screenState !== "ready",
        onChange: (event) => props.setReadAloud(event.target.checked),
      }),
      " read each question aloud there",
    ),
  );
}
