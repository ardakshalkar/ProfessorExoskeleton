/**
 * The Syncs view of the Integrations tab: every road to a service outside the
 * run, with Preview and Run beside it, and the matches waiting for a person.
 *
 * Drawn here rather than served as a document for Integrations' reason: it
 * posts back. Every press is `ainar sync …` on the host half (server/syncs.js),
 * and the CLI's own words are shown under the row that asked for them.
 *
 * Preview, then send. A sync that changes what other people see — Canvas, a
 * sheet written back into — has no send button until a preview of it is on
 * screen, the same two presses the marks push has.
 */

import { Message } from "./common.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * Why a row is waiting, in two or three words for the badge. The matcher's
 * own sentence is the title, for the professor who wants all of it.
 */
const shortWhy = (why) => {
  const text = String(why || "");
  if (/close spelling/.test(text)) return "close spelling";
  if (/only one word/.test(text)) return "only one word";
  const several = /matches (\d+) enrolled/.exec(text);
  if (several) return "fits " + several[1] + " students";
  if (/not enrolled/.test(text)) return "not enrolled";
  if (/closely enough|matches no enrolled/.test(text)) return "no close match";
  if (/no name/.test(text)) return "no name";
  return text.split(/[—;:]/)[0].trim();
};

const DIRECTION = {
  source: { text: "in", hint: "feeds the course" },
  target: { text: "out", hint: "the course feeds it" },
  both: { text: "both ways", hint: "whichever side changed wins; both changed waits for you" },
};

export function SyncsView(props) {
  const url = (path) => scoped(BASE + path + "?run=" + encodeURIComponent(props.runId || ""), props.sessionId);
  const [tick, setTick] = React.useState(0);
  const [state, setState] = React.useState({ phase: "loading", value: null });
  // Per sync: the last press's answer, which assessment is chosen, where the
  // sheet is read from, and whether a preview is on screen (which is what
  // makes a send available).
  const [results, setResults] = React.useState({});
  const [chosen, setChosen] = React.useState({});
  const [reading, setReading] = React.useState({});
  const [previewed, setPreviewed] = React.useState({});
  const [busy, setBusy] = React.useState(null);
  const [others, setOthers] = React.useState({});

  React.useEffect(() => {
    let live = true;
    fetch(url("/api/syncs") + (props.names ? "&names=1" : "") + "&r=" + (props.revision || 0) + "." + tick, {
      headers: { accept: "application/json" },
    })
      .then((response) => response.json())
      .then((value) => live && setState({ phase: "ready", value }))
      .catch((error) => live && setState({ phase: "ready", value: { error: String(error.message || error) } }));
    return () => {
      live = false;
    };
  }, [props.runId, props.names, props.revision, tick]);

  if (state.phase === "loading") return h(Message, null, "Reading this run's syncs…");
  const doc = state.value;
  if (doc.error) return h(Message, { error: true }, doc.error);

  const post = (body, key) => {
    setBusy(key);
    return fetch(url("/api/syncs/action"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((response) => response.json())
      .catch((error) => ({ error: String(error.message || error) }))
      .then((answer) => {
        setBusy(null);
        return answer;
      });
  };

  const press = (sync, action, confirm) => {
    const body = {
      action,
      sync: sync.id,
      assessment: chosen[sync.id] || "",
      from: sync.exported && (reading[sync.id] || (sync.exported ? "export" : "live")) === "export" ? "export" : "live",
      confirm: Boolean(confirm),
    };
    post(body, sync.id + ":" + action).then((answer) => {
      setResults((all) => Object.assign({}, all, { [sync.id]: answer }));
      setPreviewed((all) => Object.assign({}, all, { [sync.id]: action === "plan" && !answer.error && answer.ok }));
      if (action === "run") {
        setTick((value) => value + 1);
        if (props.onWrite) props.onWrite();
      }
    });
  };

  const confirmRow = (row, to) => {
    post({ action: "confirm", sync: row.sync, line: row.line, key: row.key, to: to || null }, "confirm:" + row.key).then(
      (answer) => {
        if (answer.error || !answer.ok) {
          setResults((all) => Object.assign({}, all, { [row.sync]: answer }));
          return;
        }
        setTick((value) => value + 1);
      },
    );
  };

  const migrate = () =>
    post({ action: "migrate" }, "migrate").then((answer) => {
      setResults((all) => Object.assign({}, all, { _migrate: answer }));
      setTick((value) => value + 1);
      if (props.onWrite) props.onWrite();
    });

  const person = (candidate) => candidate.name || candidate.student;
  const implied = doc.syncs.filter((sync) => sync.implied).length;

  const syncRow = (sync) => {
    const result = results[sync.id];
    const direction = DIRECTION[sync.role] || { text: sync.role, hint: "" };
    const needsAssessment = sync.needs === "assessment";
    const ready = !needsAssessment || chosen[sync.id];
    const from = reading[sync.id] || (sync.exported ? "export" : "live");
    return h(
      "div",
      { className: "pp-syncrow", key: sync.id },
      h(
        "div",
        { className: "pp-synchead" },
        h(
          "div",
          { className: "pp-syncname" },
          h("span", null, sync.label),
          h("span", { className: "pp-as" }, " " + sync.id),
        ),
        h("span", { className: "pp-syncdir pp-syncdir-" + sync.role, title: direction.hint }, direction.text),
      ),
      h(
        "div",
        { className: "pp-as" },
        [
          sync.implied ? "from older settings" : "in the run's settings",
          sync.remembered ? sync.remembered + " students remembered" : null,
          sync.waiting ? sync.waiting + " waiting for you" : null,
          sync.live ? "other people see what it sends" : null,
          sync.enabled ? null : "switched off",
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      sync.needs === "message"
        ? h("p", { className: "pp-as" }, "Announcements are written and sent from Publish.")
        : h(
            "div",
            { className: "pp-approverow" },
            needsAssessment
              ? h(
                  "select",
                  {
                    className: "pp-bindsel",
                    value: chosen[sync.id] || "",
                    onChange: (event) => {
                      const value = event.target.value;
                      setChosen((all) => Object.assign({}, all, { [sync.id]: value }));
                      setPreviewed((all) => Object.assign({}, all, { [sync.id]: false }));
                    },
                  },
                  h("option", { value: "" }, "Choose the assessment…"),
                  doc.assessments.map((entry) => h("option", { value: entry.id, key: entry.id }, entry.title)),
                )
              : null,
            sync.exported !== null && sync.exported !== undefined
              ? h(
                  "select",
                  {
                    className: "pp-bindsel",
                    value: from,
                    onChange: (event) => {
                      const value = event.target.value;
                      setReading((all) => Object.assign({}, all, { [sync.id]: value }));
                      setPreviewed((all) => Object.assign({}, all, { [sync.id]: false }));
                    },
                  },
                  sync.hasSheet ? h("option", { value: "live" }, "Read the sheet in Google") : null,
                  sync.exported
                    ? h("option", { value: "export" }, "Read the export of " + new Date(sync.exported).toLocaleDateString())
                    : null,
                )
              : null,
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: Boolean(busy) || !ready,
                onClick: () => press(sync, "plan"),
              },
              busy === sync.id + ":plan" ? "Looking…" : "Preview",
            ),
            sync.live
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn pp-danger",
                    disabled: Boolean(busy) || !ready || !previewed[sync.id],
                    title: previewed[sync.id] ? "Do what the preview shows" : "Preview first",
                    onClick: () => press(sync, "run", true),
                  },
                  busy === sync.id + ":run" ? "Sending…" : "Send",
                )
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    disabled: Boolean(busy) || !ready || !sync.enabled,
                    onClick: () => press(sync, "run"),
                  },
                  busy === sync.id + ":run" ? "Running…" : "Run",
                ),
          ),
      result
        ? h(
            "pre",
            { className: "pp-approveout" + (result.error || !result.ok ? " pp-approveerr" : "") },
            result.error || result.output || "(nothing printed)",
          )
        : null,
    );
  };

  const waitingRow = (row) => {
    const [best] = row.candidates;
    const picking = others[row.key];
    return h(
      "div",
      { className: "pp-heldrow", key: row.sync + row.key },
      h("span", { className: "pp-as pp-heldline" }, row.line ? "line " + row.line : ""),
      h(
        "div",
        { className: "pp-heldbody" },
        h(
          "div",
          { className: "pp-heldpair" },
          h("span", { className: "pp-heldwritten" }, row.written !== null ? row.written : "(name hidden)"),
          h("span", { "aria-hidden": "true" }, "→"),
          h("span", { className: "pp-heldname" }, best ? person(best) : "nobody close"),
          h("span", { className: "pp-rbadge pp-rbadge-close", title: row.why.replace(/ of STUDENT-[A-Z0-9]+/, "") }, shortWhy(row.why)),
        ),
        row.candidates.length > 1 ? h("div", { className: "pp-as" }, "also near: " + row.candidates.slice(1).map(person).join(", ")) : null,
        picking
          ? h(
              "div",
              { className: "pp-approverow" },
              h(
                "select",
                {
                  className: "pp-bindsel",
                  value: picking.to || "",
                  onChange: (event) => {
                    const to = event.target.value;
                    setOthers((all) => Object.assign({}, all, { [row.key]: { to } }));
                  },
                },
                h("option", { value: "" }, "Who is it?"),
                doc.students.map((student) => h("option", { value: student.student, key: student.student }, student.name || student.student)),
              ),
              h(
                "button",
                { type: "button", className: "pp-segbtn", disabled: Boolean(busy) || !picking.to, onClick: () => confirmRow(row, picking.to) },
                "Confirm",
              ),
              h(
                "button",
                { type: "button", className: "pp-segbtn", onClick: () => setOthers((all) => Object.assign({}, all, { [row.key]: null })) },
                "Cancel",
              ),
            )
          : null,
      ),
      picking
        ? null
        : h(
            "div",
            { className: "pp-approverow" },
            best
              ? h("button", { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => confirmRow(row, null) }, "Confirm")
              : null,
            h(
              "button",
              { type: "button", className: "pp-segbtn", onClick: () => setOthers((all) => Object.assign({}, all, { [row.key]: { to: "" } })) },
              "Someone else",
            ),
          ),
    );
  };

  return h(
    "div",
    null,
    h(
      "p",
      { className: "pp-absent" },
      "Every road between this run and a service outside it. Preview never changes anything; " +
        "a sync other people see has Send only after a preview of it is on screen.",
    ),
    implied
      ? h(
          "div",
          { className: "pp-approverow" },
          h("span", { className: "pp-as" }, implied + " of these come from older settings."),
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: migrate, title: "Writes syncs: into the run's version.yaml" },
            busy === "migrate" ? "Writing…" : "Save them in the run's settings",
          ),
        )
      : null,
    results._migrate ? h("pre", { className: "pp-approveout" }, results._migrate.error || results._migrate.output) : null,
    doc.syncs.length ? h("div", { className: "pp-synclist" }, doc.syncs.map(syncRow)) : h(Message, null, "This run has no syncs yet."),
    h(
      "p",
      { className: "pp-factgroup" },
      "Waiting for you" + (doc.waiting.length ? " · " + doc.waiting.length : ""),
    ),
    doc.waiting.length
      ? h(
          "div",
          null,
          doc.names
            ? null
            : h("p", { className: "pp-as" }, "Names are hidden. Press Names above to see who each row is."),
          h("div", { className: "pp-heldlist" }, doc.waiting.map(waitingRow)),
          h(
            "p",
            { className: "pp-as" },
            "A confirmed row is remembered on this computer and applied the next time its sync runs. " +
              "Until then it writes nothing, and the grades it already had stay where they are.",
          ),
        )
      : h("p", { className: "pp-as" }, "Nothing is waiting. Rows a sync is not sure of appear here after it runs."),
  );
}
