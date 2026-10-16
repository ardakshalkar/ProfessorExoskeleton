/**
 * The right column as an inspector: context for whatever is in the centre.
 *
 * WHY THE COLUMN HAS NO TABS ANY MORE
 * -----------------------------------
 * Until 2026-10-16 the column was a second app — seven tabs, each with its
 * own sub-views — and with the course navigator in the left sidebar and
 * course mode in the centre, every place was reachable three ways and drawn
 * in two. The places now live in course mode, opened from the navigator; the
 * column says what the professor needs beside a chat:
 *
 * The week is not here. The navigator's *This week* already says it on the
 * left, and since 2026-10-16 an open place covers this column (the chat
 * comes in beside the place instead), so "the week Teaching is on" has no
 * column to be drawn in. What is left is what the left side does not say:
 *
 * * **Waiting** — the counts the navigator's places carry, plus how many
 *   records still say `approval: draft`, each a press into its place.
 * * **Recent changes** — the records that moved last, newest first, whoever
 *   wrote them (server/inspector.js says why not "this chat's"). A press puts
 *   the file's path into the composer, so a question about it needs no search.
 *
 * Every figure arrived in `/api/navigator` or `/api/recent`; this prints them.
 */

import { h, React } from "./react.js";
import { ago } from "./navigator.js";
import { BASE, scoped } from "./tabs.js";

/** A read whose last answer stays on screen while the next one loads. */
function useKept(url) {
  const [value, setValue] = React.useState(null);
  React.useEffect(() => {
    if (url === null) return undefined;
    let live = true;
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((answer) => {
        if (live) setValue(answer);
      })
      .catch((error) => {
        if (live) setValue({ error: String(error.message || error) });
      });
    return () => {
      live = false;
    };
  }, [url]);
  return value;
}

/** How long ago an ISO stamp was, in the navigator's own wording. */
const since = (iso, now) => ago(Date.parse(iso), now);

/**
 * Where a changed record is read in full, by its folder. Absent: no place
 * draws that kind on its own, and the line only offers the composer.
 */
const PLACE_OF = {
  assessments: { view: "materials", sub: "assessments" },
  modules: { mode: "planning" },
  activities: { mode: "planning" },
  evaluations: { view: "gradebook" },
  submissions: { view: "gradebook" },
  concepts: { view: "concepts" },
  documents: { view: "materials", sub: "slides" },
  resources: { view: "materials", sub: "slides" },
};

function Section(props) {
  return h(
    "section",
    { className: "pp-insp-section" },
    h("div", { className: "pp-insp-label" }, h("span", null, props.label), props.action || null),
    props.children,
  );
}

function Line(props) {
  return h(
    "button",
    { type: "button", className: "pp-insp-line", title: props.hint, onClick: props.onClick },
    h("span", { className: "pp-insp-text" }, props.text),
    props.badge ? h("span", { className: "pp-nav-badge" }, props.badge) : null,
    props.meta ? h("span", { className: "pp-insp-meta" }, props.meta) : null,
  );
}

export function Inspector(props) {
  const nav = useKept(
    scoped(BASE + "/api/navigator?run=" + encodeURIComponent(props.runId) + "&r=" + props.revision, props.sessionId),
  );
  const recent = useKept(scoped(BASE + "/api/recent?r=" + props.revision, props.sessionId));
  const mention = (text) => {
    if (props.mention) props.mention(text);
  };
  const now = Date.now();

  const pending = nav && nav.grading ? nav.grading.pending : 0;
  const signals = nav && nav.grading ? nav.grading.signals : 0;
  const gaps = nav && !nav.error ? nav.gaps || 0 : 0;
  const draftKinds = recent && !recent.error ? recent.drafts_by || [] : [];
  const waiting = [
    pending ? { text: pending + (pending === 1 ? " mark waits" : " marks wait") + " for your decision", place: { view: "tasks" } } : null,
    // Drafts by kind, the three largest: what is a draft matters more than how many.
    ...draftKinds.slice(0, 3).map((kind) => ({
      text: kind.count + " " + kind.collection.replace(/[-_]/g, " ") + " still " + (kind.count === 1 ? "a draft" : "drafts"),
      place: { view: "tasks", sub: "ready" },
    })),
    gaps ? { text: gaps + (gaps === 1 ? " week has" : " weeks have") + " something missing", place: { mode: "planning" } } : null,
    signals ? { text: signals + (signals === 1 ? " open signal" : " open signals"), place: { view: "tasks" } } : null,
  ].filter(Boolean);

  const changes = recent && !recent.error ? recent.recent : [];

  return h(
    "div",
    { className: "pp-insp" },
    h(
      Section,
      { label: "Waiting" },
      waiting.length
        ? waiting.map((entry, index) =>
            h(Line, { key: index, text: entry.text, onClick: () => props.openPlace(entry.place), hint: "Open it in the centre" }),
          )
        : h("div", { className: "pp-insp-quiet" }, nav ? "Nothing is waiting for you" : "Reading the course…"),
    ),
    h(
      Section,
      { label: "Recent changes" },
      changes.length
        ? changes.map((change) => {
            const place = PLACE_OF[change.collection];
            return h(
              "div",
              { className: "pp-insp-change", key: change.path },
              h(Line, {
                text: change.records
                  ? change.collection + " · " + change.records + " records"
                  : change.title || change.id || change.path.split("/").pop(),
                badge: change.draft ? "draft" : null,
                meta: since(change.changed_at, now),
                hint: change.path + " — put it into the message box",
                onClick: () => mention(change.path),
              }),
              place
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pp-insp-act",
                      title: "Open where it is drawn",
                      onClick: () => props.openPlace(place),
                    },
                    "Open",
                  )
                : null,
            );
          })
        : h("div", { className: "pp-insp-quiet" }, recent ? "No records yet" : "Reading the course…"),
    ),
  );
}
