/**
 * The Integrations tab: This course (each service the run uses, Canvas first),
 * and Credentials until Accounts replaces it.
 *
 * The tab used to be five sub-views cut along the code's lines — Status,
 * Syncs, Targets, Credentials, Links — so everything about Canvas was spread
 * over four of them and the definition push and the assignment links each
 * existed twice. It is being regrouped by service: one card per service, its
 * setup inside it while unfinished, its syncs on it, and the facts a broken
 * push needs folded into the card's Details. Canvas, Google Sheets and GitHub
 * have cards; Credentials goes when Accounts replaces it.
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
import { GithubCard, SheetsCard } from "./service-cards.js";
import { SyncCard } from "./syncs.js";
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
  // Bumped after a sync press, so its card's chips and the waiting rows are
  // read again even where nothing passes `onWrite`.
  const [tick, setTick] = React.useState(0);
  // The run's marks and syncs, for the cards and the strip above them. The
  // syncs in Names mode only when the pane shows names: a waiting row is a
  // person, and "→ STUDENT-B7K2QA" asks a professor to decide what they
  // cannot read.
  const unpublished = useUnpublished(props.runId, props.sessionId, props.revision || 0);
  const syncs = useJson(
    scoped(
      BASE +
        "/api/syncs?run=" +
        encodeURIComponent(props.runId || "") +
        (props.names ? "&names=1" : "") +
        "&r=" +
        encodeURIComponent(String(props.revision || 0) + "." + tick),
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
  // After a sync press: a run writes records, a confirm changes what waits.
  const onSynced = () => {
    setTick((value) => value + 1);
    if (props.onWrite) props.onWrite();
  };
  // A Google sign-in changes the registry and the credential store, not the
  // record, so nothing bumps the revision: read the document again by hand.
  const refresh = () =>
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((body) => {
        if (!body.error) setFresh(body);
        setTick((value) => value + 1);
      })
      .catch(() => null);

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
    focus: props.focus,
    revision: String(props.revision || 0) + "." + tick,
    onSaved,
    onSynced,
    onRefresh: refresh,
    onWrite: props.onWrite,
  });
}

/** The services that have a card of their own; the rest are drawn as Status drew them. */
const CARDED = new Set(["canvas", "sheets", "github"]);

/**
 * Integrations → This course: what needs the professor, then one card per
 * service.
 *
 * The strip names only what a person has to do — a name a sync could not
 * place, an assessment with no Canvas column, marks Canvas does not have — and
 * each item goes to the rows it is about. A course with nothing to do shows no
 * strip at all rather than a green "all clear" to read past.
 *
 * Canvas, Google Sheets and GitHub have cards. Telegram and Moodle are still
 * drawn as Status drew them, and only when the course uses them: a service
 * nobody has set up is one line at the bottom, not a red row each. Any sync of
 * a service with no card is drawn on its own under "Other syncs", so moving
 * the syncs onto cards cannot lose one.
 *
 * `focus` comes from outside — the sheet notice, Students' "Sync from sheet" —
 * and scrolls the named card into view; its `tick` makes the same jump work
 * twice.
 */
function CourseIntegrations(props) {
  const data = props.data;
  const [filter, setFilter] = React.useState({ id: null, tick: 0 });
  const [adding, setAdding] = React.useState(false);
  const [migrating, setMigrating] = React.useState(null);
  const canvasRow = (data.integrations || []).find((row) => row.id === "canvas");
  const reachable = Boolean(canvasRow) && canvasRow.steps.slice(0, 3).every((step) => step.done);
  const counts = canvasCounts(data, props.unpublished);
  const syncs = props.syncs ? props.syncs.syncs : [];
  const waiting = props.syncs ? props.syncs.waiting.length : 0;
  const others = (data.integrations || []).filter((row) => !CARDED.has(row.id));
  // A service with a sync on this run is used by it, set up or not.
  const synced = new Set(syncs.map((sync) => sync.service));
  const isUsed = (row) => row.state !== "absent" || synced.has(row.id);
  const used = others.filter(isUsed);
  const unused = others.filter((row) => !isUsed(row));
  const loose = syncs.filter((sync) => !CARDED.has(sync.service));
  const implied = syncs.filter((sync) => sync.implied).length;

  const scrollTo = (id) => {
    const card = document.getElementById(id);
    if (card) card.scrollIntoView({ block: "start" });
  };
  React.useEffect(() => {
    if (props.focus && props.focus.service) scrollTo("pp-card-" + props.focus.service);
  }, [props.focus && props.focus.tick]);

  const show = (id) => {
    setFilter((current) => ({ id, tick: current.tick + 1 }));
    scrollTo("pp-card-canvas");
  };
  const plural = (count, one, many) => count + " " + (count === 1 ? one : many);

  const migrate = () => {
    setMigrating("working");
    fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "migrate" }),
    })
      .then((response) => response.json())
      .catch((error) => ({ error: String((error && error.message) || error) }))
      .then((answer) => {
        setMigrating(answer);
        if (props.onSynced) props.onSynced();
      });
  };

  const needs = [
    waiting
      ? {
          key: "waiting",
          text: plural(waiting, "name", "names") + " from the grade sheet to confirm",
          go: () => scrollTo("pp-card-sheets"),
        }
      : null,
    reachable && counts.unlinked.length
      ? {
          key: "unlinked",
          text: plural(counts.unlinked.length, "assessment has", "assessments have") + " no Canvas column",
          go: () => show("unlinked"),
        }
      : null,
    counts.toSend.length
      ? {
          key: "marks",
          text: "Canvas is missing marks for " + plural(counts.toSend.length, "assessment", "assessments"),
          go: () => show("marks"),
        }
      : null,
  ].filter(Boolean);

  const card = {
    runId: props.runId,
    sessionId: props.sessionId,
    names: props.names,
    onSaved: props.onSaved,
  };

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
              h("button", { type: "button", className: "pp-segbtn", onClick: item.go }, "Show"),
            ),
          ),
        )
      : null,
    h(
      CanvasCard,
      Object.assign({}, card, {
        data,
        unpublished: props.unpublished,
        syncs: props.syncs,
        ask: props.ask,
        filter: filter.id,
        filterTick: filter.tick,
        onWrite: props.onWrite,
      }),
    ),
    h(
      SheetsCard,
      Object.assign({}, card, {
        data,
        syncs: props.syncs,
        revision: props.revision,
        onDone: props.onSynced,
        onRefresh: props.onRefresh,
      }),
    ),
    h(GithubCard, Object.assign({}, card, { data, syncs: props.syncs, onDone: props.onSynced })),
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
    loose.length
      ? h(
          "div",
          { className: "pp-syncsection" },
          h("p", { className: "pp-factgroup" }, "Other syncs"),
          loose.map((sync) =>
            h(SyncCard, {
              sync,
              key: sync.id,
              assessments: props.syncs.assessments,
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onDone: props.onSynced,
            }),
          ),
        )
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
    // The syncs this run still takes from older settings (lms.toml, the sheet
    // settings, the publishing profiles) rather than from its own `syncs:`.
    // They work as they are; this writes them down in one place.
    implied
      ? h(
          "div",
          { className: "pp-approverow" },
          h(
            "span",
            { className: "pp-as" },
            (implied === syncs.length ? "All " : implied + " of ") +
              plural(syncs.length, "sync is", "syncs are") +
              " read from older settings. Saving them writes syncs: into the run's settings.",
          ),
          h(
            "button",
            { type: "button", className: "pp-segbtn", disabled: migrating === "working", onClick: migrate },
            migrating === "working" ? "Writing…" : "Save in settings",
          ),
        )
      : null,
    migrating && migrating !== "working"
      ? h("pre", { className: "pp-approveout" + (migrating.error ? " pp-approveerr" : "") }, migrating.error || migrating.output)
      : null,
  );
}
