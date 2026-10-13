/**
 * The Integrations tab: This course (each service the run uses, Canvas first),
 * and Credentials until Accounts replaces it.
 *
 * The tab used to be five sub-views cut along the code's lines — Status,
 * Syncs, Targets, Credentials, Links — so everything about Canvas was spread
 * over four of them and the definition push and the assignment links each
 * existed twice. It is being regrouped by service: one card per service, its
 * setup inside it while unfinished, its syncs on it, and the facts a broken
 * push needs folded into the card's Details. Canvas is the first card.
 */

import { CanvasCard, canvasCounts } from "./canvas-card.js";
import { Message, useJson } from "./common.js";
import {
  Fact,
  GoogleConnect,
  IntegrationStatus,
  Presence,
  Secret,
} from "./integration-parts.js";
import { useUnpublished } from "./marks.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/** The last ready, error-free value of a `useJson`-shaped state, or null. */
function useSteady(state) {
  const last = React.useRef(null);
  if (state.phase === "ready" && state.value && !state.value.error) last.current = state.value;
  return last.current;
}

/**
 * What this run is wired to, and what it is not.
 *
 * Drawn here rather than served as a document for `WidgetFrame`'s reason:
 * the views post back, and a frame with no `allow-same-origin` cannot call
 * the routes they post to.
 *
 * One fetch of `/api/integrations` for every view. It reads five files and
 * five environment variables, and splitting it per view would be chances to
 * show a host from one read beside a token from another.
 */
export function Integrations(props) {
  const url = scoped(
    BASE +
      "/api/integrations?run=" +
      encodeURIComponent(props.runId || "") +
      // The revision counter, in the URL because `useJson` re-fetches when
      // its URL changes and on nothing else. The route does not read `r`;
      // its only job is to make an `ainar lms` run in a terminal, or a
      // hand-edited version.yaml, redraw this tab without a remount.
      "&r=" +
      encodeURIComponent(String(props.revision || 0)),
    props.sessionId,
  );
  const state = useJson(url);
  // What a Save handed back, which is the record as it now is. Preferred
  // over the fetch for the reason `Preferences` prefers it: the form should
  // redraw from disk rather than from its own memory of what was ticked.
  const [fresh, setFresh] = React.useState(null);
  // A refusal from the credential seam, tagged with the field that caused it.
  const [status, setStatus] = React.useState(null);
  // The run's marks and syncs, for the Canvas rows and the strip above them.
  const unpublished = useUnpublished(props.runId, props.sessionId, props.revision || 0);
  const syncs = useJson(
    scoped(
      BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + "&r=" + encodeURIComponent(String(props.revision || 0)),
      props.sessionId,
    ),
  );

  // A read that lands after a Save is at least as new as what the Save
  // handed back, so it takes over.
  React.useEffect(() => {
    if (state.phase !== "ready") return;
    setFresh(null);
    setStatus(null);
  }, [state]);

  // Every Save bumps the revision, and `useJson` goes back to loading on each
  // one. The last answer stays on screen meanwhile: blanking the tab would
  // unmount the Canvas card and close the row the professor was working in.
  const fetched = useSteady(state);
  const marks = useSteady(unpublished);
  const roads = useSteady(syncs);

  if (state.phase === "ready" && state.value && state.value.error && !fresh) {
    return h(Message, { error: true }, state.value.error);
  }
  const data = fresh || fetched;
  if (!data) return h(Message, null, "Reading what this run is wired to…");

  const sub = props.subView || "course";
  const onSaved = (body) => {
    setFresh(body);
    setStatus(null);
    // The run record changed, so every other view of it is stale — the same
    // counter an approval bumps.
    if (props.onWrite) props.onWrite();
  };

  // ---- Credentials ---------------------------------------------------

  if (sub === "credentials") {
    return h(
      "div",
      { className: "pp-scroll" },
      h(
        "p",
        { className: "pp-absent" },
        "Presence only. This pane never shows a credential's value — a Canvas " +
          "token can change a grade, and this screen gets projected.",
      ),
      h(GoogleConnect, {
        google: data.google,
        // Re-read the whole document: the sign-in changed the registry and
        // the store, and the Status checklist reads both.
        onChanged: () =>
          fetch(url, { headers: { accept: "application/json" } })
            .then((response) => response.json())
            .then((body) => {
              if (!body.error) setFresh(body);
            })
            .catch(() => null),
      }),
      h("p", { className: "pp-factgroup" }, "Credentials"),
      (() => {
        const refs = (data.credentials && data.credentials.refs) || {};
        // The Google sign-in is Connect's, above, and is never pasted.
        const google = data.google && data.google.tokenEnv;
        const names = Object.keys(refs)
          .filter((name) => name !== google)
          .sort();
        if (!names.length) {
          return h(
            "p",
            { className: "pp-absent" },
            "No connection in this run names a credential yet.",
          );
        }
        return [
          h(
            "p",
            { className: "pp-absent", key: "why" },
            data.credentials && data.credentials.available
              ? "Type a token here and it goes to the harness's credential store, " +
                  "not into any file in this repository. It is never shown again — " +
                  "there is no code path that reads one back."
              : "No credential provider is mounted, so these can only be set in the " +
                  "environment. The names are what to export.",
          ),
          ...names.map((name) =>
            h(Secret, {
              key: name,
              name,
              status: refs[name],
              runId: props.runId,
              sessionId: props.sessionId,
              onSaved: (body) => {
                setFresh(body);
                setStatus(null);
                // A token is not the record, so `onWrite` is deliberately
                // not called: nothing in courses/ changed and re-fetching
                // every other view would be work for no new fact.
              },
              onStatus: (next) => setStatus(next),
            }),
          ),
          ...names
            .filter((name) => refs[name] && refs[name].why)
            .map((name) =>
              h("p", { className: "pp-absent", key: name + ":why" }, name + ": " + refs[name].why),
            ),
          // A refusal from the seam belongs under the field that caused
          // it, and `status.from` carries the variable's name for exactly
          // that — the same tagging the Fetch and Save buttons use so one
          // button's failure is never printed beside the other's.
          status && status.error && names.includes(status.from)
            ? h("p", { className: "pp-saveerr", key: "err" }, status.error)
            : null,
        ];
      })(),
      h("p", { className: "pp-factgroup" }, "Environment"),
      data.environment.map((variable) =>
        h(
          Fact,
          { label: variable.name, note: variable.what, key: variable.name },
          h(Presence, { present: variable.present }),
        ),
      ),
      h("p", { className: "pp-factgroup" }, "Files"),
      h(
        Fact,
        {
          // First, because it is the file every tool now reads first.
          // The two below it are where the same answer used to live, and
          // they are still shown: during a migration the honest picture is
          // all three, and "the host you can see is in the file the pusher
          // does not read" is the diagnosis this tab exists to give.
          label: "connections.json",
          note:
            data.registry.error ||
            data.registry.path + " — the shared registry, `ainar connections`",
          missing: !data.registry.present || Boolean(data.registry.error),
        },
        data.registry.present
          ? data.registry.error
            ? "unreadable"
            : data.registry.connections.length +
              " connection" +
              (data.registry.connections.length === 1 ? "" : "s")
          : h(Presence, { present: false, no: "not migrated yet" }),
      ),
      h(
        Fact,
        {
          label: "lms.toml",
          note: data.canvas.configPath,
          missing: !data.canvas.host && !data.canvas.tokenInFile,
        },
        data.canvas.tokenInFile
          ? h(Presence, { present: true, yes: "host and token" })
          : data.canvas.host && data.canvas.hostFrom !== "AINAR_CANVAS_URL"
            ? h(Presence, { present: true, yes: "host only" })
            : h(Presence, { present: false, no: "nothing read" }),
      ),
      h(
        Fact,
        {
          label: "profiles (legacy)",
          note: data.connections.error || data.connections.path,
          missing: !data.connections.present || Boolean(data.connections.error),
        },
        data.connections.present
          ? data.connections.error
            ? "unreadable"
            : data.connections.profiles.length +
              " profile" +
              (data.connections.profiles.length === 1 ? "" : "s")
          : h(Presence, { present: false, no: "no file" }),
      ),
      h(
        Fact,
        {
          label: "people.json",
          note:
            data.roster.path +
            " — the identity store, outside the repository. The course record " +
            "holds pseudonyms; the real names are only here",
          missing: !data.roster.present,
        },
        data.roster.present
          ? data.roster.count === null
            ? "unreadable"
            : data.roster.count + " known"
          : h(Presence, { present: false, no: "no roster" }),
      ),
      data.registry.connections.some((connection) => connection.tokenInFile)
        ? h(
            "p",
            { className: "pp-saveerr" },
            "A connection in the registry holds a literal token, which that file is " +
              "not supposed to contain at all. Revoke it at the provider, export a " +
              "fresh one under the variable the connection names, and delete the line.",
          )
        : null,
      data.connections.profiles.some((profile) => profile.tokenInFile)
        ? h(
            "p",
            { className: "pp-saveerr" },
            "A legacy profile holds a literal token. It still works, but a token in a " +
              "file that gets backed up and synced should be treated as exposed: " +
              "`ainar connections migrate` says what to do about it, and does not " +
              "copy the token forward.",
          )
        : null,
    );
  }

  // ---- This course ---------------------------------------------------

  return h(CourseIntegrations, {
    data,
    unpublished: marks,
    syncs: roads,
    runId: props.runId,
    sessionId: props.sessionId,
    names: props.names,
    ask: props.ask,
    openSyncs: props.openSyncs,
    onSaved,
    onWrite: props.onWrite,
  });
}

/**
 * Integrations → This course: what needs the professor, then one card per
 * service.
 *
 * The strip names only what a person has to do — a name a sync could not
 * place, an assessment with no Canvas column, marks Canvas does not have — and
 * each item goes to the rows it is about. A course with nothing to do shows no
 * strip at all rather than a green "all clear" to read past.
 *
 * Canvas has its card. The others are still drawn as Status drew them, and
 * only the ones this course uses: a service nobody has set up is one line at
 * the bottom, not a red row each.
 */
function CourseIntegrations(props) {
  const data = props.data;
  const [filter, setFilter] = React.useState({ id: null, tick: 0 });
  const [adding, setAdding] = React.useState(false);
  const canvasRow = (data.integrations || []).find((row) => row.id === "canvas");
  const reachable = Boolean(canvasRow) && canvasRow.steps.slice(0, 3).every((step) => step.done);
  const counts = canvasCounts(data, props.unpublished);
  const waiting = props.syncs ? props.syncs.waiting.length : 0;
  const others = (data.integrations || []).filter((row) => row.id !== "canvas");
  // A service with a sync on this run is used by it, set up or not: the grade
  // sheet's sync names its spreadsheet itself, not on the run record the
  // checklist reads.
  const synced = new Set(props.syncs ? props.syncs.syncs.map((sync) => sync.service) : []);
  const isUsed = (row) => row.state !== "absent" || synced.has(row.id);
  const used = others.filter(isUsed);
  const unused = others.filter((row) => !isUsed(row));

  const show = (id) => setFilter((current) => ({ id, tick: current.tick + 1 }));
  const plural = (count, one, many) => count + " " + (count === 1 ? one : many);

  const needs = [
    waiting
      ? {
          key: "waiting",
          text: plural(waiting, "name", "names") + " from a sync to confirm",
          action: props.openSyncs ? "Review" : null,
          go: props.openSyncs,
        }
      : null,
    reachable && counts.unlinked.length
      ? {
          key: "unlinked",
          text: plural(counts.unlinked.length, "assessment has", "assessments have") + " no Canvas column",
          action: "Show",
          go: () => show("unlinked"),
        }
      : null,
    counts.toSend.length
      ? {
          key: "marks",
          text: "Canvas is missing marks for " + plural(counts.toSend.length, "assessment", "assessments"),
          action: "Show",
          go: () => show("marks"),
        }
      : null,
  ].filter(Boolean);

  return h(
    "div",
    { className: "pp-scroll pp-course" },
    needs.length
      ? h(
          "div",
          { className: "pp-needs", role: "status" },
          h("span", { className: "pp-needstitle" }, "Needs you"),
          needs.map((item) =>
            h(
              "div",
              { className: "pp-needsrow", key: item.key },
              h("span", null, item.text),
              item.action
                ? h("button", { type: "button", className: "pp-segbtn", onClick: item.go }, item.action)
                : null,
            ),
          ),
        )
      : null,
    h(CanvasCard, {
      data,
      unpublished: props.unpublished,
      syncs: props.syncs,
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      ask: props.ask,
      filter: filter.id,
      filterTick: filter.tick,
      onSaved: props.onSaved,
      onWrite: props.onWrite,
    }),
    used.length
      ? h(IntegrationStatus, {
          integrations: used,
          setup: data.setup,
          data,
          runId: props.runId,
          sessionId: props.sessionId,
          onSaved: props.onSaved,
        })
      : null,
    unused.length
      ? h(
          "div",
          { className: "pp-unused" },
          h(
            "div",
            { className: "pp-approverow" },
            h("span", { className: "pp-as" }, "Not used by this course: " + unused.map((row) => row.label).join(", ")),
            h(
              "button",
              { type: "button", className: "pp-segbtn", "aria-pressed": adding, onClick: () => setAdding(!adding) },
              adding ? "Close" : "Set one up",
            ),
          ),
          adding
            ? h(IntegrationStatus, {
                integrations: unused,
                setup: data.setup,
                data,
                runId: props.runId,
                sessionId: props.sessionId,
                onSaved: props.onSaved,
              })
            : null,
        )
      : null,
  );
}
