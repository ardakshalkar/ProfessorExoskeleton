/**
 * AGT-6: the professor's own words. Holding P — or the button — while
 * speaking marks the stretch as theirs, in seconds from the start of the take
 * in hand; the server then never counts it as the student's answer, whatever
 * the provider heard.
 */

import { h, React } from "./react.js";

/**
 * The stretches, and the key that marks them.
 *
 * `marks.current` is `{ origin, held, ranges }`: `origin` the take's start,
 * `held` when the key went down, `ranges` the closed stretches. A ref, not
 * state, because the hands-free loop and the caption stream read it ten times
 * a second and must see the latest without re-subscribing.
 */
export function useProfessorMarks() {
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
  return { marks, professorTalking, openMarks, closeMarks, speakDown, speakUp };
}

/** The hold-to-speak button, for a professor without a free hand on the keyboard. */
export function SpeakButton(props) {
  return h(
    "button",
    {
      type: "button",
      className: "pp-segbtn" + (props.talking ? " pp-dspeaking" : ""),
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture(event.pointerId);
        props.onDown();
      },
      onPointerUp: props.onUp,
      onPointerCancel: props.onUp,
      title: "Hold while you speak, so your words are not taken for the student's answer.",
    },
    props.talking ? "You are speaking — not the answer" : "Hold to speak (P)",
  );
}
