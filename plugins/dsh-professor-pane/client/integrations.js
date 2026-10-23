/**
 * The Integrations tab: This course (each service the run uses, Canvas first),
 * and Accounts (what this computer is signed in to).
 *
 * The tab used to be five sub-views cut along the code's lines — Status,
 * Syncs, Targets, Credentials, Links — so everything about Canvas was spread
 * over four of them and the definition push and the assignment links each
 * existed twice. It is being regrouped by service: one card per service, its
 * setup inside it while unfinished, its syncs on it, and the facts a broken
 * push needs folded into the card's Details. Canvas, Google Sheets and GitHub
 * have cards. Accounts replaced Credentials: one row per service saying who it
 * is connected as, rather than a list of variables.
 */

import { CanvasCard, canvasCounts } from "./canvas-card.js";
import { Message, useJson } from "./common.js";
import { Accounts } from "./accounts.js";
import { IntegrationStatus } from "./integration-parts.js";
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
  // Accounts, in place of This course. Opened by its button in the header.
  const [accounts, setAccounts] = React.useState(props.subView === "accounts");
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
  }, [state]);
  // A jump to a card (the sheet notice) is a jump to This course.
  React.useEffect(() => {
    if (props.focus && props.focus.service) setAccounts(false);
  }, [props.focus && props.focus.tick]);

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

  const onSaved = (body) => {
    setFresh(body);
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

  // ---- the two views -------------------------------------------------
  //
  // This course, and Accounts behind a button in the same header: Accounts
  // is the machine's and is opened twice a term, so it does not get a
  // segment of its own beside the course it is not about.

  const head = h(
    "div",
    { className: "pp-ihead" },
    accounts
      ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setAccounts(false) }, "← This course")
      : h("span", { className: "pp-ihtitle" }, "This course"),
    h("span", { className: "pp-segspacer" }),
    accounts
      ? h("span", { className: "pp-ihtitle" }, "Accounts")
      : h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            title: "Canvas, Google, GitHub and the rest, as this computer is signed in to them",
            onClick: () => setAccounts(true),
          },
          "Accounts",
        ),
  );

  if (accounts) {
    return h(
      "div",
      null,
      head,
      h(Accounts, {
        data,
        runId: props.runId,
        sessionId: props.sessionId,
        // A token or a connection is machine configuration, not the record,
        // so nothing else needs to redraw; `onWrite` is not called.
        onSaved: (body) => setFresh(body),
        onRefresh: refresh,
      }),
    );
  }

  return h(
    "div",
    null,
    head,
    h(CourseIntegrations, {
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
      onOpenSync: props.onOpenSync,
    }),
  );
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
          service: "sheets",
          mark: "GS",
          text: plural(waiting, "name", "names") + " from the grade sheet to confirm",
          go: props.onOpenSync || (() => scrollTo("pp-card-sheets")),
        }
      : null,
    reachable && counts.unlinked.length
      ? {
          key: "unlinked",
          service: "canvas",
          mark: "Cv",
          text: plural(counts.unlinked.length, "assessment has", "assessments have") + " no Canvas column",
          go: () => show("unlinked"),
        }
      : null,
    counts.toSend.length
      ? {
          key: "marks",
          service: "canvas",
          mark: "Cv",
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
    // Where syncing lives when course mode has a Sync view; without it the
    // cards keep their syncs, as before.
    onOpenSync: props.onOpenSync,
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
              h("span", { className: "pp-svc pp-svc-small pp-svc-" + item.service, "aria-hidden": "true" }, item.mark),
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
