/**
 * Today: course mode's landing — Now, Waiting and Pulse, from `/api/today`
 * (server/today.js). docs/PROFESSOR-JOURNEY.md §10 is why it looks like this.
 *
 * Nothing here acts. Every row is a link into the place that resolves it,
 * through `props.onOpen`, which takes the same requests the navigator sends
 * plus `{ grade }` and `{ scans }`. The figures are the payload's; this file
 * prints them.
 */

import { Message } from "./common.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

/** "2026-10-23T13:02:41+05:00" → "23 Oct", the date as it was given. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => {
  const found = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return found ? Number(found[3]) + " " + MONTHS[Number(found[2]) - 1] : null;
};

/** How each urgency is said beside its item. */
const URGENCY_WORD = {
  overdue: "overdue",
  this_week: "this week",
  blocks_students: "students wait",
  blocks_assistant: "the assistant waits",
  later: null,
};

const PHASE_WORD = { before: "Before the term", teaching: "Teaching", after: "After the term" };

/** `/api/today` for one run, re-read whenever the course or a sync moves. */
function useToday(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/today?run=" + encodeURIComponent(runId || "") + "&r=" + revision, sessionId), {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision]);
  return state;
}

/** A band: a small heading, a count beside it, and its body. */
function Band(props) {
  return h(
    "section",
    { className: "pp-tband" },
    h("h3", null, props.title, props.count != null ? h("span", { className: "pp-tcount" }, props.count) : null),
    props.children,
  );
}

/** A row that opens a place: what, why, and the arrow. */
function Row(props) {
  return h(
    "button",
    { type: "button", className: "pp-trow" + (props.tone ? " pp-trow-" + props.tone : ""), onClick: props.onClick, title: props.tip },
    h("span", { className: "pp-trowtext" }, h("b", null, props.title), props.detail ? h("span", null, props.detail) : null),
    props.tag ? h("span", { className: "pp-ttag" }, props.tag) : null,
    h("span", { className: "pp-tgo", "aria-hidden": "true" }, "›"),
  );
}

function Now(props) {
  const now = props.now;
  const week = now.week;
  return h(
    Band,
    { title: "Now" },
    h(
      "div",
      { className: "pp-tnow" },
      h(
        "div",
        { className: "pp-tnowhead" },
        h("b", null, week ? "Week " + week.week + (props.run.weeks ? " of " + props.run.weeks : "") : PHASE_WORD[now.phase] || "—"),
        week ? h("span", null, [day(week.starts_on), day(week.ends_on)].filter(Boolean).join(" – ")) : null,
        week && week.modules.length ? h("span", { className: "pp-tmods" }, week.modules.join(" · ")) : null,
      ),
      week && week.meetings.length
        ? h(
            "ul",
            { className: "pp-tlist" },
            week.meetings.map((meeting, i) =>
              h(
                "li",
                { key: i },
                h("span", null, meeting.title),
                h("span", { className: "pp-as" }, [meeting.type, day(meeting.on), meeting.location].filter(Boolean).join(" · ")),
                meeting.deck ? null : h("span", { className: "pp-ttag pp-ttag-warn" }, "no slides"),
              ),
            ),
          )
        : null,
      week && week.due.length
        ? h(
            "ul",
            { className: "pp-tlist" },
            week.due.map((work) =>
              h("li", { key: work.assessment_id }, h("span", null, "Due " + (day(work.due_on) || "—")), h("span", { className: "pp-as" }, work.title)),
            ),
          )
        : null,
      now.next_due
        ? h(
            "p",
            { className: "pp-as" },
            "Next due, week " + now.next_due.week + ": " + now.next_due.due.map((work) => work.title).join(" · "),
          )
        : null,
      h(
        "div",
        { className: "pp-tnowacts" },
        h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpen({ mode: "teaching" }) }, "Open this week"),
        now.gaps
          ? h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpen({ mode: "planning" }) }, plural(now.gaps, "week has gaps", "weeks have gaps"))
          : null,
      ),
    ),
  );
}

function Waiting(props) {
  const items = props.items;
  return h(
    Band,
    { title: "Waiting on you", count: items.length || null },
    items.length
      ? h(
          "div",
          { className: "pp-trows" },
          items.map((item) =>
            h(Row, {
              key: item.id,
              title: item.title,
              detail: item.detail,
              tag: URGENCY_WORD[item.urgency],
              tone: item.urgency === "overdue" || item.urgency === "this_week" || item.urgency === "blocks_students" ? "hot" : null,
              onClick: () => props.onOpen(item.open),
            }),
          ),
        )
      : h("p", { className: "pp-as" }, "Nothing is waiting on you."),
  );
}

function Pulse(props) {
  const pulse = props.pulse;
  const concepts = pulse.concepts;
  const handIn = pulse.hand_in;
  const tile = (key, head, value, sub, onClick, warn) =>
    h(
      "button",
      { type: "button", key: key, className: "pp-ttile" + (warn ? " pp-ttile-warn" : ""), onClick: onClick },
      h("span", { className: "pp-ttilehead" }, head),
      h("b", null, value),
      sub ? h("span", { className: "pp-as" }, sub) : null,
    );
  return h(
    Band,
    { title: "Pulse" },
    h(
      "div",
      { className: "pp-ttiles" },
      concepts
        ? tile(
            "below",
            "Concepts to revisit",
            String(concepts.below.length),
            "class mean under " + Math.round(concepts.threshold * 100) + "% · of " + concepts.total,
            () => props.onOpen({ view: "concepts" }),
            concepts.below.length > 0,
          )
        : null,
      concepts
        ? tile("none", "Not assessed yet", String(concepts.no_evidence), "concepts with no evidence", () => props.onOpen({ view: "concepts" }), false)
        : null,
      handIn
        ? tile(
            "handin",
            "Last hand-in",
            handIn.received != null && handIn.enrolled != null ? handIn.received + " / " + handIn.enrolled : "—",
            handIn.title,
            () => props.onOpen({ view: "gradebook" }),
            handIn.missing > 0,
          )
        : null,
    ),
    pulse.syncs.length
      ? h(
          "div",
          { className: "pp-tsyncs" },
          h("span", { className: "pp-ttilehead" }, "In step"),
          h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onOpen({ view: "syncs" }) }, "Sync all…"),
          pulse.syncs.map((chip) =>
            h(
              "button",
              {
                type: "button",
                key: chip.service,
                className: "pp-tsync" + (chip.waiting || chip.reconnect ? " pp-tsync-wait" : ""),
                title: plural(chip.roads, "road", "roads") + (chip.last ? " · last ran " + day(chip.last) : " · never run"),
                // A refused sign-in is fixed in settings; everything else is syncing.
                onClick: () => props.onOpen(chip.reconnect ? { view: "settings", sub: "integrations" } : { view: "syncs" }),
              },
              h("i", { "aria-hidden": "true" }),
              chip.label,
              h(
                "span",
                { className: "pp-as" },
                chip.reconnect ? "reconnect" : chip.waiting ? chip.waiting + " waiting" : chip.last ? day(chip.last) : "never",
              ),
            ),
          ),
        )
      : null,
  );
}

/** Course mode · Today. */
export function Today(props) {
  const state = useToday(props.runId, props.sessionId, props.revision);
  // The last answer stays on screen while the next one loads.
  const shown = React.useRef(null);
  if (state.phase === "ready") shown.current = state.value;
  const doc = shown.current;
  if (doc === null) return h(Message, null, "Reading where the course stands…");
  if (doc.error) return h(Message, { error: true }, doc.error);
  if (!doc.run) return h(Message, null, "This workspace has no course run yet.");
  return h(
    "div",
    { className: "pp-today" },
    h(Now, { now: doc.now, run: doc.run, onOpen: props.onOpen }),
    h(Waiting, { items: doc.waiting, onOpen: props.onOpen }),
    h(Pulse, { pulse: doc.pulse, onOpen: props.onOpen }),
  );
}
