/**
 * The defence desk's dots: a swarm that follows what the desk is doing.
 */

import { h, React } from "./react.js";
import { BASE } from "./tabs.js";

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
export function ListeningDots(props) {
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
