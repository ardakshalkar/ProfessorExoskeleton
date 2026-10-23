/**
 * Where this run and Canvas differ, on the Canvas card: how many, of what
 * kind, which side moved, each one in detail, and Sync all.
 *
 * Read from `/api/canvas/differences`, which is the pane's running Canvas
 * check (canvas-check.js) with names put in when the pane shows names; a
 * finished check bumps the `canvas` tag, and this reads again. Each
 * difference has a direction (`ainar-node/src/lms/canvas-diff.ts`):
 *
 *   to Canvas      only AINAR changed since the last sync
 *   from Canvas    only Canvas changed
 *   conflict       both changed
 *   held           neither can say — a person Canvas lists that matches
 *                  nobody surely, a mark not ready to send
 *
 * Sync all applies the one-sided ones it can — marks and definitions to
 * Canvas, newcomers to the class list — after a preview, behind the red
 * button. A mark or definition Canvas changed is not written over a decision
 * here, so it waits with the conflicts, each with Keep AINAR (a send,
 * previewed) and Keep Canvas (a note on this computer; nothing is sent).
 */

import { noteCanvasCheck, useCanvasCheck } from "./canvas-check.js";
import { DIRECTIONS, KINDS, diffSummary } from "./canvas-diff-count.js";
import { useVersion } from "./data.js";
import { h, React } from "./react.js";
import { when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

export { diffSummary };

const post = (path, runId, sessionId, body) =>
  fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId || ""), sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String((error && error.message) || error) }));

const plural = (count, one, many) => count + " " + (count === 1 ? one : many || one + "s");

/** Who or what one difference is about, in the words of the row. */
const subject = (entry) =>
  entry.kind === "assignments"
    ? entry.field.replace(/_/g, " ")
    : entry.name || entry.student_id || entry.theirs || "—";

/** A value as the row shows it: a Canvas date in the reader's own time. */
const valueText = (value) => {
  if (value === null || value === undefined) return "—";
  const text = String(value);
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(text) && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return text;
};

/** A heading per assessment (or the class list), in the order differences came. */
const grouped = (rows) => {
  const out = [];
  const index = new Map();
  for (const entry of rows) {
    const id = entry.kind === "roster" ? "roster" : entry.kind + "|" + entry.assessment_id + "|" + (entry.group || "");
    if (!index.has(id)) {
      const kind = KINDS.find((item) => item.id === entry.kind);
      const title =
        entry.kind === "roster"
          ? "Class list"
          : (entry.title || entry.assessment_id) + (entry.kind === "assignments" ? " · definition" : "");
      index.set(id, out.length);
      out.push({ id, title: title + (entry.group && entry.kind !== "roster" ? " · " + entry.group : ""), kind, rows: [] });
    }
    out[index.get(id)].rows.push(entry);
  }
  return out;
};

/** How many rows a group shows before "Show N more". */
const ROWS_AT_FIRST = 12;

/** One difference: the two values, which side moved, and — when it is the professor's — the two choices. */
function DiffRow(props) {
  const entry = props.entry;
  const [phase, setPhase] = React.useState("idle");
  const [preview, setPreview] = React.useState(null);
  const [answer, setAnswer] = React.useState(null);
  const direction = DIRECTIONS.find((item) => item.id === entry.direction);
  const choosable = entry.kind !== "roster" && (entry.direction === "conflict" || entry.direction === "pull");

  const settle = (keep, confirm) => {
    setPhase(keep + (confirm ? ":send" : ""));
    post("/api/canvas/resolve", props.runId, props.sessionId, { key: entry.key, keep, confirm, names: Boolean(props.names) }).then((body) => {
      setPhase("idle");
      if (body.preview) return setPreview(body.preview);
      setPreview(null);
      setAnswer(body);
      if (!body.error && body.ok && props.onSettled) props.onSettled();
    });
  };

  return h(
    "div",
    { className: "pp-drow" },
    h(
      "div",
      { className: "pp-drowline" },
      h("span", { className: "pp-drowwho" }, subject(entry)),
      h(
        "span",
        { className: "pp-dvals", title: entry.base !== null && entry.base !== undefined ? "Last synced: " + entry.base : "Never synced" },
        entry.kind === "roster" ? null : "AINAR " + valueText(entry.ours) + " · Canvas " + valueText(entry.theirs),
      ),
      h("span", { className: "pp-dtag pp-dtag-" + entry.direction }, direction ? direction.tag : entry.direction),
    ),
    entry.reason ? h("span", { className: "pp-dwhy" }, entry.reason) : null,
    choosable && !answer
      ? h(
          "div",
          { className: "pp-dacts" },
          preview
            ? h(
                React.Fragment,
                null,
                h("span", { className: "pp-dwhy" }, preview),
                h(
                  "button",
                  { type: "button", className: "pp-segbtn pp-danger", disabled: phase !== "idle", onClick: () => settle("ainar", true) },
                  phase === "ainar:send" ? "Sending…" : "Send to Canvas",
                ),
                h("button", { type: "button", className: "pp-segbtn", disabled: phase !== "idle", onClick: () => setPreview(null) }, "Cancel"),
              )
            : h(
                React.Fragment,
                null,
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: phase !== "idle" || entry.ours === null,
                    title: "Send AINAR's value to Canvas, over what Canvas holds. Previewed first.",
                    onClick: () => settle("ainar", false),
                  },
                  phase === "ainar" ? "Looking…" : "Keep AINAR",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: phase !== "idle",
                    title:
                      entry.kind === "grades"
                        ? "Leave Canvas's mark. Nothing is sent; the decision here stays as it is until you change it in the Grade view."
                        : "Leave Canvas's value. Nothing is sent; the record stays as it is.",
                    onClick: () => settle("canvas", false),
                  },
                  phase === "canvas" ? "Keeping…" : "Keep Canvas",
                ),
              ),
        )
      : null,
    answer
      ? h(
          "pre",
          { className: "pp-approveout" + (answer.error || !answer.ok ? " pp-approveerr" : "") },
          answer.error || answer.output || (answer.kept === "canvas" ? "Kept Canvas's." : "Sent."),
        )
      : null,
  );
}

/** The preview Sync all shows before it sends, and its outcome after. */
function SyncAll(props) {
  const preview = props.preview;
  const [phase, setPhase] = React.useState("idle");
  const [result, setResult] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const send = preview.send;
  const take = preview.take;
  const held = preview.held;
  // In this run, gone from Canvas, not noted yet. Sync all notes them and
  // drops nobody. Older harnesses send no list.
  const absent = preview.absent || [];
  const marks = send.filter((entry) => entry.kind === "grades");
  const fields = send.filter((entry) => entry.kind === "assignments");
  const nothing = !send.length && !take.length && !absent.length;

  const go = () => {
    setPhase("sending");
    post("/api/canvas/sync-all", props.runId, props.sessionId, {
      confirm: true,
      keys: send.concat(take).map((entry) => entry.key),
    }).then((body) => {
      setPhase("idle");
      setResult(body);
      if (body.check && props.onChecked) props.onChecked(body.check);
    });
  };

  if (result) {
    return h(
      "div",
      { className: "pp-syncall" },
      result.error
        ? h("pre", { className: "pp-approveout pp-approveerr" }, result.error)
        : result.results.map((entry, index) =>
            h(
              "pre",
              { className: "pp-approveout" + (entry.ok ? "" : " pp-approveerr"), key: index },
              (entry.ok ? "✓ " : "✗ ") + entry.command + "\n" + entry.output,
            ),
          ),
      h("div", { className: "pp-dacts" }, h("button", { type: "button", className: "pp-segbtn", onClick: props.onClose }, "Close")),
    );
  }

  // One line per assessment: how many in all, and per Canvas course.
  const byAssessment = (rows) => {
    const counts = new Map();
    for (const entry of rows) {
      const title = entry.title || entry.assessment_id;
      const line = counts.get(title) || { total: 0, groups: new Map() };
      line.total += 1;
      if (entry.group) line.groups.set(entry.group, (line.groups.get(entry.group) || 0) + 1);
      counts.set(title, line);
    }
    return [...counts].map(([title, line]) =>
      h(
        "li",
        { key: title },
        title + ": " + line.total,
        line.groups.size > 1
          ? h("span", { className: "pp-as" }, " (" + [...line.groups].sort().map(([group, count]) => group + " " + count).join(", ") + ")")
          : null,
      ),
    );
  };

  return h(
    "div",
    { className: "pp-syncall" },
    h("span", { className: "pp-as" }, "Asked Canvas " + when(props.checkedAt) + ". Nothing has been sent yet."),
    nothing ? h("span", null, "Nothing one-sided to apply.") : null,
    marks.length ? h(React.Fragment, null, h("b", null, "To Canvas: " + plural(marks.length, "mark")), h("ul", null, byAssessment(marks))) : null,
    fields.length
      ? h(React.Fragment, null, h("b", null, "To Canvas: " + plural(fields.length, "definition field")), h("ul", null, byAssessment(fields)))
      : null,
    take.length ? h("b", null, "Into the class list: " + plural(take.length, "student") + " Canvas has and this run does not") : null,
    absent.length
      ? h(
          "span",
          null,
          h("b", null, "Not in Canvas any more: " + plural(absent.length, "student")),
          " — each is noted with today's date and stays in the class until you drop them.",
          absent.length <= 8 ? h("ul", null, absent.map((entry) => h("li", { key: entry.key }, subject(entry)))) : null,
        )
      : null,
    send.length
      ? h(
          "button",
          { type: "button", className: "pp-morebtn", style: { marginLeft: 0 }, onClick: () => setOpen(!open) },
          open ? "Hide what goes" : "Show what goes, row by row",
        )
      : null,
    open
      ? h(
          "div",
          { className: "pp-dlist" },
          send.map((entry) =>
            h(
              "div",
              { className: "pp-drowline", key: entry.key },
              h("span", { className: "pp-drowwho" }, (entry.title || entry.assessment_id) + " · " + subject(entry)),
              h("span", { className: "pp-dvals" }, h("s", null, valueText(entry.theirs)), " → " + valueText(entry.ours)),
            ),
          ),
        )
      : null,
    held.length
      ? h(
          "span",
          { className: "pp-as" },
          "Left for you: " +
            plural(held.length, "difference") +
            " — conflicts, what Canvas changed, and what is held. Each is in Details, with Keep AINAR and Keep Canvas.",
        )
      : null,
    h(
      "div",
      { className: "pp-dacts" },
      nothing
        ? null
        : h(
            "button",
            { type: "button", className: "pp-segbtn pp-danger", disabled: phase !== "idle", onClick: go },
            phase === "sending"
              ? "Syncing…"
              : [
                  send.length ? "Send " + send.length + " to Canvas" : null,
                  take.length ? "bring in " + take.length : null,
                  absent.length ? "note " + absent.length + " not in Canvas" : null,
                ]
                  .filter(Boolean)
                  .join(" and "),
          ),
      h("button", { type: "button", className: "pp-segbtn", disabled: phase !== "idle", onClick: props.onClose }, "Cancel"),
    ),
  );
}

/** The Canvas card's differences box. */
export function CanvasDifferences(props) {
  const [check, again] = useCanvasCheck(props.runId, props.sessionId);
  const version = useVersion(["canvas"]);
  const [tick, setTick] = React.useState(0);
  const [answer, setAnswer] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState(null);
  const [way, setWay] = React.useState("all");
  const [more, setMore] = React.useState({});
  const [syncing, setSyncing] = React.useState(null);

  const url = scoped(
    BASE +
      "/api/canvas/differences?run=" +
      encodeURIComponent(props.runId || "") +
      (props.names ? "&names=1" : "") +
      // Read again when a check lands — this pane's, or one the server
      // already had — and after a press here.
      "&v=" +
      encodeURIComponent(String(version) + "." + tick + "." + ((check.value && check.value.at) || "")),
    props.sessionId,
  );
  React.useEffect(() => {
    let live = true;
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((body) => live && setAnswer(body))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [url]);

  const running = check.phase === "running";
  const summary = diffSummary(answer);
  const reread = () => setTick((value) => value + 1);

  const preview = () => {
    setSyncing("asking");
    post("/api/canvas/sync-all", props.runId, props.sessionId, { confirm: false, names: Boolean(props.names) }).then((body) => {
      if (body.error) return setSyncing({ error: body.error });
      setSyncing(body);
      reread();
    });
  };

  const head = h(
    "div",
    { className: "pp-cdiffhead" },
    h("span", { className: "pp-cdifftitle" }, "Differences with Canvas"),
    summary
      ? h("span", { className: "pp-chip " + (summary.total ? "pp-chip-warn" : "pp-chip-ok") }, summary.total ? String(summary.total) : "none")
      : null,
    h("span", { className: "pp-segspacer" }),
    h("button", { type: "button", className: "pp-segbtn", disabled: running, onClick: again }, running ? "Checking…" : "Check again"),
  );
  const checked = running ? "checking…" : answer && answer.at ? "checked " + when(answer.at) : "";

  if (!summary) {
    return h(
      "div",
      { className: "pp-cdiff" },
      head,
      h(
        "span",
        { className: "pp-as" },
        answer && answer.error
          ? answer.error
          : answer && answer.outdated
            ? "The last check was made before differences were counted. Check again."
            : running
              ? "Asking Canvas what it holds…"
              : answer && answer.state === "none"
                ? "Not checked yet."
                : "Not compared yet.",
      ),
    );
  }

  // A filter whose last row was just settled falls back to everything.
  const shownWay = way !== "all" && !summary.directions[way] ? "all" : way;
  const rows = answer.differences.filter((entry) => (!kind || entry.kind === kind) && (shownWay === "all" || entry.direction === shownWay));
  const ways = [{ id: "all", label: "All " + summary.total }].concat(
    DIRECTIONS.filter((item) => summary.directions[item.id]).map((item) => ({
      id: item.id,
      label: summary.directions[item.id] + " " + (summary.directions[item.id] === 1 && item.id === "conflict" ? "conflict" : item.label),
    })),
  );

  return h(
    "div",
    { className: "pp-cdiff", id: "pp-canvas-diff" },
    head,
    h(
      "div",
      { className: "pp-cdiffkinds" },
      KINDS.map((item) =>
        h(
          "button",
          {
            type: "button",
            className: "pp-cdiffkind",
            key: item.id,
            "aria-pressed": kind === item.id,
            title: "Show only " + item.label.toLowerCase(),
            onClick: () => {
              setKind(kind === item.id ? null : item.id);
              setOpen(true);
            },
          },
          item.label,
          h("b", null, String(summary.kinds[item.id].total)),
        ),
      ),
    ),
    h(
      "span",
      { className: "pp-cdiffways" },
      summary.directions.push + " to Canvas · " + summary.directions.pull + " from Canvas · ",
      h("span", { className: summary.directions.conflict ? "pp-way-conflict" : null }, plural(summary.directions.conflict, "conflict")),
      " · " + summary.directions.held + " held" + (summary.kept ? " · " + summary.kept + " kept as Canvas has them" : ""),
      checked ? h("span", { className: "pp-as" }, " — " + checked) : null,
    ),
    answer.roster && answer.roster.error ? h("span", { className: "pp-saveerr" }, "Class list: " + answer.roster.error) : null,
    h(
      "div",
      { className: "pp-dacts" },
      h(
        "button",
        { type: "button", className: "pp-segbtn", "aria-expanded": open, disabled: !summary.total, onClick: () => setOpen(!open) },
        open ? "Hide details" : "Details",
      ),
      // In the Sync view, Sync all is the one above every road.
      props.noSyncAll
        ? null
        : h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: running || syncing === "asking" || Boolean(syncing && syncing.preview),
              title: "Ask Canvas again and show what Sync all would send and bring in. Nothing is sent until you press Send.",
              onClick: preview,
            },
            syncing === "asking" ? "Asking Canvas…" : "Sync all…",
          ),
    ),
    syncing && syncing.error ? h("p", { className: "pp-saveerr" }, syncing.error) : null,
    syncing && syncing.preview
      ? h(SyncAll, {
          preview: syncing.preview,
          checkedAt: syncing.checkedAt,
          runId: props.runId,
          sessionId: props.sessionId,
          onChecked: (state) => noteCanvasCheck(props.runId, state, props.sessionId),
          onClose: () => {
            setSyncing(null);
            reread();
            if (props.onWrite) props.onWrite();
          },
        })
      : null,
    open
      ? h(
          "div",
          { className: "pp-dlist" },
          h(
            "div",
            { className: "pp-dacts" },
            ways.map((item) =>
              h(
                "button",
                { type: "button", className: "pp-segbtn", key: item.id, "aria-pressed": shownWay === item.id, onClick: () => setWay(item.id) },
                item.label,
              ),
            ),
          ),
          rows.length
            ? grouped(rows).map((group) => {
                const shown = more[group.id] ? group.rows : group.rows.slice(0, ROWS_AT_FIRST);
                return h(
                  React.Fragment,
                  { key: group.id },
                  h("p", { className: "pp-dgroup" }, group.title + " · " + group.rows.length),
                  shown.map((entry) =>
                    h(DiffRow, {
                      entry,
                      key: entry.key,
                      runId: props.runId,
                      sessionId: props.sessionId,
                      names: props.names,
                      onSettled: reread,
                    }),
                  ),
                  group.rows.length > shown.length
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "pp-morebtn",
                          onClick: () => setMore(Object.assign({}, more, { [group.id]: true })),
                        },
                        "Show " + (group.rows.length - shown.length) + " more",
                      )
                    : null,
                );
              })
            : h("p", { className: "pp-as" }, "Nothing here."),
        )
      : null,
  );
}
