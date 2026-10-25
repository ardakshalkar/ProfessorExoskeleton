/**
 * The one flow every road takes in the pane: Preview → Send → what happened
 * → Preview again. Sync all, the Canvas card's Sync all and a grade sheet's
 * card draw it from here, so the presses, their words and the retry are the
 * same wherever a road is. The rules behind it are server/roads.js's: a Send
 * goes from the preview the professor read, only what it offered, within
 * fifteen minutes, once; when it cannot, its answer carries `again`, and
 * here that is a Preview again button.
 *
 * `useRoad` is the state and the two requests, for a card that lays out its
 * own buttons (the sheet's). `RoadFlow` is the whole thing for the rest:
 * the caller says what a preview means (`describe`), what Send sends
 * (`choose`) and what its button says (`sendLabel`).
 */

import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

export const postRoads = (runId, sessionId, body) =>
  fetch(scoped(BASE + "/api/roads?run=" + encodeURIComponent(runId || ""), sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String((error && error.message) || error) }));

/** One road's answer out of a preview, by id. */
export const roadIn = (preview, id) => (preview && Array.isArray(preview.roads) ? preview.roads.find((road) => road.id === id) || null : null);

/**
 * `{ phase, preview, results, ask, send, adopt, close }` for `roads` (ids, or
 * null for every road Sync all moves). `phase` is idle, asking or sending.
 */
export function useRoad(props) {
  const [phase, setPhase] = React.useState("idle");
  const [preview, setPreview] = React.useState(null);
  const [results, setResults] = React.useState(null);
  const base = { names: Boolean(props.names) };

  const ask = (extra) => {
    setPhase("asking");
    setResults(null);
    return postRoads(props.runId, props.sessionId, Object.assign({ confirm: false, roads: props.roads || undefined }, base, extra)).then((body) => {
      setPhase("idle");
      setPreview(body);
      return body;
    });
  };
  const send = (keys, extra) => {
    setPhase("sending");
    return postRoads(props.runId, props.sessionId, Object.assign({ confirm: true, keys }, base, extra)).then((body) => {
      setPhase("idle");
      setPreview(null);
      setResults(body);
      return body;
    });
  };
  // A preview another press brought back (a dropped sheet is previewed as it is kept).
  const adopt = (body) => {
    setResults(null);
    setPreview(body);
  };
  const close = () => {
    setPreview(null);
    setResults(null);
  };
  return { phase, preview, results, ask, send, adopt, close };
}

/** What a send came to, command by command, with Preview again where a road could not go. */
export function RoadResults(props) {
  const results = props.results;
  return h(
    "div",
    { className: props.className || "pp-syncallx" },
    results.error
      ? h("pre", { className: "pp-approveout pp-approveerr" }, results.error)
      : (results.results || []).map((entry, index) =>
          h(
            "pre",
            { className: "pp-approveout" + (entry.ok ? "" : " pp-approveerr"), key: index },
            (entry.ok ? "✓ " : "✗ ") + (entry.command || entry.road) + "\n" + entry.output,
          ),
        ),
    h(
      "div",
      { className: "pp-dacts" },
      results.again && props.onAgain
        ? h("button", { type: "button", className: "pp-segbtn", disabled: props.busy, onClick: props.onAgain }, props.busy ? "Asking…" : "Preview again")
        : null,
      props.onClose ? h("button", { type: "button", className: "pp-segbtn", onClick: props.onClose }, "Close") : null,
    ),
  );
}

/**
 * The whole flow. Props: `runId`, `sessionId`, `names`, `roads`; the Preview
 * button's `label`, `asking` and `title`, and `disabled`; `describe(preview)`,
 * `choose(preview)` → `{ roadId: [keys] }` or null when nothing would go,
 * `sendLabel(preview)`; `nothing` for the line shown when nothing would;
 * `frame(button, body)` to place the button (default: above the body);
 * `onPreviewed(body)` and `onSent(body)` after each answer.
 */
export function RoadFlow(props) {
  const road = useRoad(props);
  const asking = road.phase === "asking";
  const sending = road.phase === "sending";
  const ask = () =>
    road.ask().then((body) => {
      if (props.onPreviewed) props.onPreviewed(body);
    });
  const send = (keys) =>
    road.send(keys).then((body) => {
      if (props.onSent) props.onSent(body);
    });

  const button = h(
    "button",
    {
      type: "button",
      className: "pp-segbtn",
      disabled: props.disabled || road.phase !== "idle" || Boolean(road.preview && !road.preview.error),
      title: props.title,
      onClick: ask,
    },
    asking ? props.asking || "Asking…" : props.label || "Preview…",
  );

  const preview = road.preview;
  const keys = preview && !preview.error ? props.choose(preview) : null;
  const body = preview
    ? preview.error
      ? h("p", { className: "pp-saveerr" }, preview.error)
      : h(
          "div",
          { className: props.className || "pp-syncallx" },
          props.describe(preview),
          h(
            "div",
            { className: "pp-dacts" },
            keys
              ? h("button", { type: "button", className: "pp-segbtn pp-danger", disabled: sending, onClick: () => send(keys) }, sending ? "Syncing…" : props.sendLabel(preview))
              : h("span", { className: "pp-as" }, props.nothing || "Nothing to send."),
            h("button", { type: "button", className: "pp-segbtn", disabled: sending, onClick: road.close }, keys ? "Cancel" : "Close"),
          ),
        )
    : road.results
      ? h(RoadResults, { results: road.results, className: props.className, busy: asking, onAgain: ask, onClose: road.close })
      : null;

  return props.frame ? props.frame(button, body) : h(React.Fragment, null, button, body);
}
