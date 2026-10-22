/**
 * The Google Sheets and GitHub cards on Integrations → This course.
 *
 * With the Canvas card they replace the Syncs view, which listed every sync of
 * every service in one grid and put the names waiting to be confirmed above
 * all of them. Here each sync sits on its service's card, and the waiting rows
 * sit on the card of the sheet that queued them — which is where a professor
 * goes to fix "who is line 23".
 *
 * The presses are the Syncs view's, moved rather than rewritten: `SyncCard`
 * and `WaitingList` in syncs.js, so preview-before-send, the downloaded-sheet
 * drop and the confirm rules are the same code they were.
 */

import { Fact, GoogleConnect, Presence, ProviderSetup } from "./integration-parts.js";
import { useSheetCheck } from "./marks.js";
import { h, React } from "./react.js";
import { SyncCard, WaitingList, when } from "./syncs.js";

/** `7 Oct`, for a row that has room for a date and nothing else. */
const dayOf = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
};

/** A card's header: the service's mark, its name and one line under it, and a chip. */
function CardHead(props) {
  return h(
    "div",
    { className: "pp-chead" },
    h("span", { className: "pp-svc pp-svc-" + props.service, "aria-hidden": "true" }, props.mark),
    h("span", { className: "pp-cname" }, props.name, h("span", { className: "pp-intwhat" }, props.subtitle)),
    props.chip ? h("span", { className: "pp-chip pp-chip-" + props.chip.tone }, props.chip.text) : null,
  );
}

/**
 * Google Sheets: the grade sheets this run reads and writes, and the Google
 * sign-in that lets it do so without a download.
 *
 * Connect Google is on the card while nobody is signed in, because it is the
 * one thing that turns "download the sheet, drop it here" into a Run press —
 * and in Details once somebody is, where Disconnect and Switch account belong.
 */
export function SheetsCard(props) {
  const data = props.data;
  const syncs = props.syncs ? props.syncs.syncs.filter((sync) => sync.service === "sheets") : [];
  const row = (data.integrations || []).find((entry) => entry.id === "sheets");
  const google = data.google || {};
  const checks = useSheetCheck(props.runId, props.sessionId, String(props.revision || 0));
  const [editing, setEditing] = React.useState(false);

  // The gradebook copy (`extensions.lms.sheet_id`) is the other use of Sheets:
  // a card is drawn for either.
  if (!syncs.length && !(row && row.state !== "absent")) return null;

  const ids = new Set(syncs.map((sync) => sync.id));
  const waiting = props.syncs ? props.syncs.waiting.filter((entry) => ids.has(entry.sync)) : [];
  const checkOf = (sync) => (checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) : null);
  const changed = syncs.filter((sync) => {
    const check = checkOf(sync);
    return check && check.state === "changed";
  });

  // Saved but refused: known from the status, or from a check that just met it.
  const expired = google.connected && Boolean(google.expired || (checks && checks.checks && checks.checks.some((entry) => entry.reconnect)));
  const subtitle = [
    expired
      ? "Google stopped accepting the sign-in" + (google.account ? " for " + google.account : "")
      : google.connected
        ? "connected as " + (google.account || "your Google account")
        : "Google not connected · sheets come in as downloads",
    syncs.length ? syncs.length + " sheet" + (syncs.length === 1 ? "" : "s") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const chip = expired
    ? { text: "reconnect", tone: "warn" }
    : waiting.length
    ? { text: waiting.length + " waiting", tone: "warn" }
    : changed.length
      ? { text: "changed in Google", tone: "warn" }
      : google.connected
        ? { text: "ready", tone: "ok" }
        : null;

  return h(
    "section",
    { className: "pp-ccard", id: "pp-card-sheets" },
    h(CardHead, { service: "sheets", mark: "GS", name: "Google Sheets", subtitle, chip }),
    syncs.map((sync) =>
      h(
        "div",
        { className: "pp-csub", key: sync.id },
        h("div", { className: "pp-csubtitle" }, sync.label, h("span", { className: "pp-syncid" }, sync.id)),
        h(SyncCard, {
          sync,
          bare: true,
          check: checkOf(sync),
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          onDone: props.onDone,
        }),
      ),
    ),
    h(WaitingList, {
      rows: waiting,
      students: props.syncs ? props.syncs.students : [],
      names: props.syncs ? props.syncs.names : false,
      runId: props.runId,
      sessionId: props.sessionId,
      onDone: props.onDone,
    }),
    google.connected
      ? null
      : h(
          "div",
          { className: "pp-cnudge" },
          h("span", null, "Connect Google and this card reads the sheet itself — no download."),
          h(GoogleConnect, { google, bare: true, compact: true, onChanged: props.onRefresh }),
        ),
    h(
      "details",
      { className: "pp-cdetails" },
      h("summary", null, "Details"),
      google.connected ? h(GoogleConnect, { google, bare: true, compact: true, onChanged: props.onRefresh }) : null,
      h(
        Fact,
        {
          label: "Gradebook copy",
          note: data.sheet.id
            ? "The spreadsheet the gradebook is written to · summary tab " + data.sheet.summaryTab
            : "A spreadsheet the gradebook is written to, if you keep one — extensions.lms.sheet_id on the run",
        },
        data.sheet.id || h(Presence, { present: false, no: "none" }),
      ),
      row
        ? h(
            Fact,
            { label: "Credential", note: "a Google sign-in, AINAR_SHEETS_TOKEN, or a service-account key" },
            h(Presence, { present: row.steps[1] && row.steps[1].done, yes: "available", no: "none" }),
          )
        : null,
      row
        ? h(
            "div",
            { className: "pp-approverow" },
            h(
              "button",
              { type: "button", className: "pp-segbtn", "aria-pressed": editing, onClick: () => setEditing(!editing) },
              data.sheet.id ? "Change the gradebook copy" : "Keep a gradebook copy",
            ),
          )
        : null,
      editing && row
        ? h(ProviderSetup, {
            integration: Object.assign({}, row, { fields: ["sheetId"] }),
            runId: props.runId,
            sessionId: props.sessionId,
            onCancel: () => setEditing(false),
            onSaved: (body) => {
              setEditing(false);
              if (props.onSaved) props.onSaved(body);
            },
          })
        : null,
    ),
  );
}

/**
 * GitHub: each homework's starter repository, which students fork.
 *
 * A row per assessment that names one, by due date, with where it is and when
 * this machine last pushed to it. A row opens to Preview and Send — a starter
 * repository is public and forked, so a push is something students see, and it
 * waits for a preview like every other press that leaves the machine.
 */
export function GithubCard(props) {
  const data = props.data;
  const sync = props.syncs ? props.syncs.syncs.find((entry) => entry.service === "github") : null;
  const rows = (data.assessments || [])
    .filter((assessment) => assessment.github)
    .sort((left, right) => String(left.dueAt || "9999").localeCompare(String(right.dueAt || "9999")));
  const [open, setOpen] = React.useState(null);

  if (!sync && !rows.length) return null;
  const unpublished = rows.filter((assessment) => !assessment.github.published);
  const chip = !rows.length
    ? null
    : unpublished.length
      ? { text: unpublished.length + " not published", tone: "warn" }
      : { text: "all published", tone: "ok" };

  return h(
    "section",
    { className: "pp-ccard", id: "pp-card-github" },
    h(CardHead, {
      service: "github",
      mark: "GH",
      name: "GitHub",
      subtitle:
        rows.length + " homework repositor" + (rows.length === 1 ? "y" : "ies") + " · students fork them" +
        (sync && sync.lastSynced ? " · last pushed " + when(sync.lastSynced) : ""),
      chip,
    }),
    rows.length
      ? h(
          "div",
          { className: "pp-crows" },
          rows.map((assessment) => {
            const id = assessment.assessmentId;
            const repo = assessment.github.repo;
            const published = assessment.github.published;
            const expanded = open === id;
            return h(
              "div",
              { className: "pp-crow" + (expanded ? " pp-crow-open" : ""), key: id },
              h(
                "button",
                { type: "button", className: "pp-crowhead", "aria-expanded": expanded, onClick: () => setOpen(expanded ? null : id) },
                h("span", { className: "pp-crowchev", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
                h(
                  "span",
                  { className: "pp-crowtitle" },
                  assessment.title || id,
                  assessment.dueAt ? h("span", { className: "pp-as" }, " · due " + dayOf(assessment.dueAt)) : null,
                ),
                h(
                  "span",
                  { className: "pp-crowstate" },
                  repo ? h("span", { className: "pp-st-quiet" }, repo) : h("span", { className: "pp-st-warn" }, "no repository named"),
                  h("span", { className: "pp-crowsep", "aria-hidden": "true" }, " · "),
                  published
                    ? h("span", { className: "pp-st-ok" }, "published " + dayOf(published.at))
                    : h("span", { className: "pp-st-warn" }, "not published"),
                ),
              ),
              expanded
                ? h(
                    "div",
                    { className: "pp-cpanel" },
                    repo
                      ? h(
                          "p",
                          { className: "pp-as" },
                          h("a", { href: "https://github.com/" + repo, target: "_blank", rel: "noreferrer" }, repo + " ↗"),
                          assessment.github.folder ? " · from " + assessment.github.folder : "",
                          published ? " · last pushed from here " + when(published.at) : " · never pushed from here",
                        )
                      : h(
                          "p",
                          { className: "pp-as" },
                          "No repository is named yet. Record one as extensions.github.template_repo on the assessment — /design-assessment writes it when it scaffolds the starter.",
                        ),
                    sync
                      ? h(SyncCard, {
                          sync,
                          bare: true,
                          assessment: id,
                          runId: props.runId,
                          sessionId: props.sessionId,
                          names: props.names,
                          onDone: props.onDone,
                        })
                      : h("p", { className: "pp-as" }, "This run has no homework-repos sync, so there is nothing to push with."),
                  )
                : null,
            );
          }),
        )
      : h("p", { className: "pp-as" }, "No assessment names a starter repository yet. /design-assessment writes one when it scaffolds the homework."),
  );
}
