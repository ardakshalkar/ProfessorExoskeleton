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
function useToday(runId, sessionId, revision, phase) {
  const [state, setState] = React.useState({ phase: "loading", value: null });
  React.useEffect(() => {
    let live = true;
    fetch(scoped(BASE + "/api/today?run=" + encodeURIComponent(runId || "") + "&r=" + revision + (phase ? "&phase=" + phase : ""), sessionId), {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error) } }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision, phase]);
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

/**
 * Now before and after the term (BACKLOG E37 HOME-3): the phase's own list,
 * each line done (✓), still open (with where it is fixed), or the
 * professor's to do and never ticked by the pane (·).
 */
function PhaseList(props) {
  const now = props.now;
  const list = now.checklist;
  const open = list.filter((item) => item.done === false).length;
  const go = (item) => {
    if (!item.do) return;
    if (item.do.fill) props.onFill(item.do.fill.replace("{run}", props.run.run_id));
    else if (item.do.open) props.onOpen(item.do.open);
  };
  return h(
    Band,
    { title: "Now" },
    h(
      "div",
      { className: "pp-tnow" },
      h(
        "div",
        { className: "pp-tnowhead" },
        h("b", null, now.phase === "before" ? "Before the term" : "After the term"),
        h(
          "span",
          null,
          now.phase === "before"
            ? (props.run.start_date ? "starts " + day(props.run.start_date) + " · " : "") + (open ? plural(open, "thing", "things") + " missing" : "ready to start")
            : (props.run.end_date ? "ended " + day(props.run.end_date) + " · " : "") + (open ? plural(open, "thing", "things") + " before it can be closed" : "ready to close"),
        ),
        now.previewing ? h("span", { className: "pp-ttag" }, "preview — the term is under way") : null,
      ),
      h(
        "ul",
        { className: "pp-tcheck" },
        list.map((item) =>
          h(
            "li",
            { key: item.id, className: item.done === true ? "pp-tdone" : item.done === false ? "pp-topen" : "pp-tyours" },
            h("span", { className: "pp-tmark", "aria-label": item.done === true ? "done" : item.done === false ? "not done" : "yours to do" }, item.done === true ? "✓" : item.done === false ? "○" : "·"),
            h("span", { className: "pp-tchecktext" }, h("span", null, item.label), item.detail ? h("small", null, item.detail) : null),
            item.outward && item.done === false ? h("span", { className: "pp-cmdout", title: "Students see the result" }, "↗") : null,
            item.do && item.done !== true
              ? h(
                  "button",
                  { type: "button", className: "pp-segbtn", onClick: () => go(item) },
                  item.do.fill ? "Ask the assistant…" : "Open",
                )
              : null,
          ),
        ),
      ),
    ),
  );
}

function Now(props) {
  const now = props.now;
  if (now.checklist && now.checklist.length) return h(PhaseList, props);
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
    // Snoozed items are set aside, never lost: said here, listed in Waiting.
    props.snoozed && props.snoozed.length
      ? h(
          "p",
          { className: "pp-as pp-tsnoozed" },
          plural(props.snoozed.length, "item", "items") + " snoozed",
          props.onOpenWaiting ? h("button", { type: "button", className: "pp-linkbtn", onClick: props.onOpenWaiting }, "See them in Waiting") : null,
        )
      : null,
  );
}

// ------------------------------------------------------------- Waiting

/** An ISO day `n` days from today, in the machine's calendar. */
const daysAhead = (n) => {
  const at = new Date();
  at.setDate(at.getDate() + n);
  return at.getFullYear() + "-" + String(at.getMonth() + 1).padStart(2, "0") + "-" + String(at.getDate()).padStart(2, "0");
};
/** The coming Monday, or the one after if today is Monday. */
const nextMonday = () => {
  const today = new Date().getDay();
  return daysAhead(((8 - today) % 7) || 7);
};

const KIND_WORD = {
  week: "Weeks",
  marks: "Marks",
  held: "Scans",
  sync: "Sync",
  reconnect: "Sync",
  drafts: "Drafts",
  integrity: "Integrity",
  canvas: "Canvas",
  action: "Dated work",
  review: "Concepts",
  signals: "Concepts",
};

/** Snooze, with the three days a professor actually picks, and any other. */
function SnoozeControl(props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const pick = (until) => {
    setBusy(true);
    props.onSnooze(until).then(() => {
      setBusy(false);
      setOpen(false);
    });
  };
  if (props.until) {
    return h(
      "span",
      { className: "pp-wsnooze" },
      h("span", { className: "pp-ttag" }, "until " + day(props.until)),
      h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => pick(null) }, busy ? "…" : "Wake now"),
    );
  }
  return h(
    "span",
    { className: "pp-wsnooze" },
    open
      ? h(
          React.Fragment,
          null,
          h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => pick(daysAhead(1)) }, "Tomorrow"),
          h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: () => pick(nextMonday()) }, "Next week"),
          h("input", {
            type: "date",
            className: "pp-wdate",
            min: daysAhead(1),
            "aria-label": "Snooze until",
            disabled: busy,
            onChange: (event) => event.target.value && pick(event.target.value),
          }),
          h("button", { type: "button", className: "pp-close", "aria-label": "Cancel", onClick: () => setOpen(false) }, "×"),
        )
      : h(
          "button",
          { type: "button", className: "pp-segbtn", title: "Not now: set it aside until a day you choose. It comes back by itself.", onClick: () => setOpen(true) },
          "Snooze",
        ),
  );
}

/** One row of Waiting: what, why, how urgent; a press opens its place. */
function WaitingRow(props) {
  const item = props.item;
  return h(
    "div",
    { className: "pp-wrow" + (props.hot ? " pp-trow-hot" : "") },
    h(
      "button",
      { type: "button", className: "pp-wmain", onClick: () => props.onOpen(item.open) },
      h("span", { className: "pp-trowtext" }, h("b", null, item.title), item.detail ? h("span", null, item.detail) : null),
      URGENCY_WORD[item.urgency] && !item.until ? h("span", { className: "pp-ttag" }, URGENCY_WORD[item.urgency]) : null,
      h("span", { className: "pp-tgo", "aria-hidden": "true" }, "›"),
    ),
    h(SnoozeControl, { until: item.until || null, onSnooze: props.onSnooze }),
  );
}

/**
 * Course mode · Waiting · Everything: every item waiting on the professor,
 * one list in one urgency order (BACKLOG E37 HOME-4), each snoozable until a
 * day (HOME-5). The same document as Today's band — `/api/today` — so the
 * two cannot disagree; here it is whole, filterable by kind, and the snoozed
 * are listed with the day each comes back.
 */
export function WaitingPlace(props) {
  const [tick, setTick] = React.useState(0);
  const state = useToday(props.runId, props.sessionId, String(props.revision) + "." + tick);
  const shown = React.useRef(null);
  if (state.phase === "ready") shown.current = state.value;
  const [kind, setKind] = React.useState(null);
  const [failed, setFailed] = React.useState(null);
  const doc = shown.current;
  if (doc === null) return h(Message, null, "Reading what is waiting…");
  if (doc.error) return h(Message, { error: true }, doc.error);
  if (!doc.run) return h(Message, null, "This workspace has no course run yet.");

  const snooze = (item, until) =>
    fetch(scoped(BASE + "/api/today/snooze?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item: item.id, until }),
    })
      .then((response) => response.json())
      .catch((error) => ({ error: String((error && error.message) || error) }))
      .then((answer) => {
        setFailed(answer.error || null);
        setTick((value) => value + 1);
      });

  const kinds = [...new Set(doc.waiting.concat(doc.snoozed || []).map((item) => KIND_WORD[item.kind] || item.kind))];
  const match = (item) => !kind || (KIND_WORD[item.kind] || item.kind) === kind;
  const items = doc.waiting.filter(match);
  const later = (doc.snoozed || []).filter(match);
  const hot = (item) => item.urgency === "overdue" || item.urgency === "this_week" || item.urgency === "blocks_students";

  return h(
    "div",
    { className: "pp-today pp-waiting" },
    kinds.length > 1
      ? h(
          "div",
          { className: "pp-dacts" },
          h("button", { type: "button", className: "pp-segbtn", "aria-pressed": !kind, onClick: () => setKind(null) }, "All " + doc.waiting.length),
          kinds.map((word) =>
            h(
              "button",
              { key: word, type: "button", className: "pp-segbtn", "aria-pressed": kind === word, onClick: () => setKind(kind === word ? null : word) },
              word,
            ),
          ),
        )
      : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
    h(
      Band,
      { title: "Waiting on you", count: items.length || null },
      items.length
        ? h(
            "div",
            { className: "pp-trows" },
            items.map((item) => h(WaitingRow, { key: item.id, item, hot: hot(item), onOpen: props.onOpen, onSnooze: (until) => snooze(item, until) })),
          )
        : h("p", { className: "pp-as" }, kind ? "Nothing of this kind is waiting." : "Nothing is waiting on you."),
    ),
    later.length
      ? h(
          Band,
          { title: "Snoozed" },
          h(
            "div",
            { className: "pp-trows pp-wlater" },
            later.map((item) => h(WaitingRow, { key: item.id, item, onOpen: props.onOpen, onSnooze: (until) => snooze(item, until) })),
          ),
        )
      : null,
    h(
      "p",
      { className: "pp-as" },
      "An item leaves this list when what it is about is done — a mark decided, a paper placed, a draft accepted — not when it is ticked. A snooze is kept on this computer and changes nothing in the course.",
    ),
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
  // `?today-phase=before` (or `after`) on the page's address shows that
  // phase's Now before it comes, marked as a preview.
  const asked = /[?&]today-phase=(before|after|teaching)\b/.exec(window.location.search || "");
  const state = useToday(props.runId, props.sessionId, props.revision, asked ? asked[1] : null);
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
    h(Now, { now: doc.now, run: doc.run, onOpen: props.onOpen, onFill: props.onFill || (() => {}) }),
    h(Waiting, { items: doc.waiting, snoozed: doc.snoozed || [], onOpen: props.onOpen, onOpenWaiting: () => props.onOpen({ view: "tasks", sub: "waiting" }) }),
    h(Pulse, { pulse: doc.pulse, onOpen: props.onOpen }),
  );
}
