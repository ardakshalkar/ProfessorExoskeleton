/**
 * Course mode's weeks, drawn by React from `/api/course` — the four readings
 * (All weeks, Planning, Teaching, Evidence) and the strip above them.
 *
 * WHY A SHADOW ROOT AND NOT AN IFRAME
 * -----------------------------------
 * Until 2026-10-16 this was a page the server rendered, in a sandboxed frame.
 * The frame had no origin, so nothing in it could fetch, and every refresh
 * was a new document: a drag could not move a bar until the server had drawn
 * it again. Now the page is components over JSON, so a drop moves the bar at
 * once (planning.jsx) and a refresh is a re-render that keeps the scroll.
 *
 * What the frame did that is worth keeping is isolation: the stylesheet
 * (shared/course-style.js) styles bare `table`, `.chip`, `.grid` and so on,
 * and the harness has its own. A shadow root keeps both apart with no
 * renaming, so the one stylesheet draws this view and the server page alike.
 * Two changes on the way in: what was `body` and `:root` is the `.cm` root
 * here, and the 900px breakpoint is a container query, since this view is no
 * longer its own viewport.
 *
 * Every figure arrives computed by the host; this view counts nothing.
 */

import { h, Fragment, React, ReactDOM } from "../react.js";
import { BASE, scoped } from "../tabs.js";
import { AREAS, useVersion } from "../data.js";
import { DARK, LIGHT, STYLE } from "../../shared/course-style.js";
import { Sprite } from "./parts.jsx";
import { EditScope } from "./edit.jsx";
import { Evidence } from "./evidence.jsx";
import { Planning } from "./planning.jsx";
import { Teaching } from "./teaching.jsx";
import { StructureFoot, Tally, Term } from "./term.jsx";

/** The stylesheet, scoped to the shadow root this view draws in. */
const SCOPED = STYLE.replace(/(^|\n)body\{/, "$1.cm{").replace(/@media \(max-width:900px\)/g, "@container cm (max-width:900px)");
const sheet = (dark) =>
  ":host{display:block;container:cm/inline-size}" + ".cm{" + (dark ? DARK : LIGHT) + "min-height:100%}" + SCOPED;

/** The course data for one reading, the last answer kept while the next loads. */
function useCourse(url, version) {
  const [state, setState] = React.useState({ url: null, value: null });
  React.useEffect(() => {
    let live = true;
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((value) => live && setState({ url, value }))
      .catch((error) => live && setState({ url, value: { error: String(error.message || error) } }));
    return () => {
      live = false;
    };
  }, [url, version]);
  return state;
}

const NOTES = {
  term: "press a hole to have the assistant fill it",
  planning: "does the term hold together",
  teaching: "this week, between the last and the next",
  evidence: "how each week went",
};

export function CourseView(props) {
  const { runId, sessionId, mode, dark, drafts, student, week } = props;
  const version = useVersion(AREAS.everything);
  const url = scoped(
    BASE + "/api/course?run=" + encodeURIComponent(runId) + "&mode=" + encodeURIComponent(mode) +
      (drafts ? "&drafts=1" : "") + (student ? "&student=1" : "") + (dark ? "&dark=1" : "") +
      (mode === "teaching" && week ? "&week=" + encodeURIComponent(week) : ""),
    sessionId,
  );
  const state = useCourse(url, version);
  const scroller = React.useRef(null);
  // The scroller as state too: its shadow root can only be made once it exists,
  // and a child's effect runs before the parent's ref is attached.
  const [host, setHost] = React.useState(null);
  const hostRef = React.useCallback((el) => {
    scroller.current = el;
    setHost(el);
  }, []);

  // Open on this week, once per reading: a refresh re-renders in place and
  // keeps wherever the professor scrolled to.
  const placed = React.useRef(null);
  const reading = runId + "|" + mode;
  React.useLayoutEffect(() => {
    if (!state.value || state.value.error || placed.current === reading) return;
    if (state.url !== url) return;
    placed.current = reading;
    const root = scroller.current && scroller.current.shadowRoot;
    const now = root && root.querySelector(".wkhead.now,.band.now,tr.now");
    if (now) now.scrollIntoView({ block: "start" });
    else if (scroller.current) scroller.current.scrollTop = 0;
  });

  // The sticky column heads sit under the strip by its measured height.
  React.useLayoutEffect(() => {
    const root = scroller.current && scroller.current.shadowRoot;
    const strip = root && root.querySelector(".strip");
    const cm = root && root.querySelector(".cm");
    if (!strip || !cm || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => cm.style.setProperty("--strip-h", strip.offsetHeight + "px");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  });

  const answer = state.value;
  const body = () => {
    if (!answer) return <p className="calm" style={{ margin: "14px 20px" }}>Reading the course model…</p>;
    if (answer.error) return <p className="calm" style={{ margin: "14px 20px", color: "var(--flag)" }}>{answer.error}</p>;
    // A reading still loading shows the last one only if it is the same one.
    const data = answer.data || {};
    const run = data.run || {};
    const weeks = data.weeks || [];
    const current = data.current_week ?? null;
    const shown = answer.mode || mode;
    const strip = (
      <div className="strip">
        <span className="note">
          {run.term || ""} · {current ? "week " + current + " of " + weeks.length : weeks.length + " weeks"} · {NOTES[shown]}
        </span>
        {shown === "term" && !answer.student ? <Tally data={data} current={current} /> : null}
      </div>
    );
    const banner =
      answer.student && (shown === "term" || shown === "planning") ? (
        <div className="banner">
          <b>Preview as student.</b> The record alone — no hole, no note about what has not been written yet.
        </div>
      ) : null;
    if (shown === "planning") {
      return (
        <Fragment>
          {strip}
          {banner}
          <Planning data={data} student={answer.student} locks={answer.locks} runId={runId} sessionId={sessionId} />
          {answer.student ? (
            <StructureFoot />
          ) : (
            <p className="foot">
              Structure only — nothing here is derived from student work. Moving a bar changes its <span className="mono">opens_at</span> and{" "}
              <span className="mono">due_at</span> and nothing else; accepting a draft is still changing <span className="mono">approval: draft</span> in its record.
            </p>
          )}
        </Fragment>
      );
    }
    if (shown === "teaching") {
      return (
        <Fragment>
          {strip}
          <Teaching
            key={runId}
            data={data}
            evidence={answer.evidence}
            status={answer.status}
            focus={answer.focus}
            onStep={props.onStep}
            onScrollTop={() => scroller.current && (scroller.current.scrollTop = 0)}
          />
        </Fragment>
      );
    }
    if (shown === "evidence") {
      return (
        <Fragment>
          {strip}
          <Evidence data={data} evidence={answer.evidence} status={answer.status} />
        </Fragment>
      );
    }
    return (
      <Fragment>
        {strip}
        {banner}
        <Term data={data} student={answer.student} status={answer.status} />
      </Fragment>
    );
  };

  return (
    <Fragment>
      {answer && !answer.error && answer.drafts ? (
        <div className="pp-banner">
          <b>Record + drafts. </b>
          Everything below includes records marked <code>approval: draft</code>, which nobody has accepted yet. Accepting one is changing that word to{" "}
          <code>approved</code> in its record, and that is yours to do.
        </div>
      ) : null}
      <div ref={hostRef} className="pp-courseview" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <ShadowContent host={host}>
          <style>{sheet(dark)}</style>
          <div className="cm">
            <Sprite />
            {/* Titles and items are changed here (edit.jsx), never under the student's preview. */}
            <EditScope runId={runId} sessionId={sessionId} enabled={Boolean(answer && !answer.error && !answer.student)}>
              {body()}
            </EditScope>
          </div>
        </ShadowContent>
      </div>
    </Fragment>
  );
}

/** React drawn into the scroller's own shadow root, so the scroller is the host. */
function ShadowContent(props) {
  const host = props.host;
  const root = React.useMemo(() => (host ? host.shadowRoot || host.attachShadow({ mode: "open" }) : null), [host]);
  return root ? ReactDOM.createPortal(props.children, root) : null;
}

