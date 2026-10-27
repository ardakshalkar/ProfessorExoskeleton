/**
 * Course mode · Sync: bringing the run and the services outside it into step,
 * as an operation rather than a setting. BACKLOG E37 HOME-6 and HOME-7;
 * docs/PROFESSOR-JOURNEY.md §8.
 *
 * One check of Canvas, and the page is what it found — there is no separate
 * preview to open. Until 2026-10-25 the same three things were drawn up to
 * three times (Sync all's preview, Marks for Canvas, Canvas · what differs),
 * each with its own check and its own time. Now, by which way data runs:
 *
 *   To Canvas            every mark and definition the check would send,
 *                        per assessment, whose and from what to what; Send…
 *                        on each, Send all at the foot. Students see these.
 *   Into your records    the class list Canvas has, and each grade sheet with
 *                        its own card (`SyncCard`) and the names it could not
 *                        place (`WaitingList`). Only the professor sees these.
 *   Needs your decision  what the check will not send by itself: conflicts,
 *                        what Canvas changed (`DiffRow`, with Keep AINAR and
 *                        Keep Canvas), people Canvas and the class list do
 *                        not agree on, and assessments with no Canvas
 *                        assignment to send to (`CanvasMarks` links or
 *                        creates one).
 *
 * The check is the pane's running one (client/canvas-check.js); the page's
 * plan is `/api/roads` for the Canvas road, which reuses a check under
 * fifteen minutes old (server/canvas-sync.js). Every Send goes from that plan
 * and only the rows it showed, each row once, so one homework can go and the
 * rest still wait on the same check (server/previews.js).
 *
 * Course settings keeps what is set up twice a term: the address, the token,
 * which course, which sheet, the Google sign-in.
 */

import { noteCanvasCheck, useCanvasCheck } from "./canvas-check.js";
import { DiffRow } from "./canvas-diff.js";
import { Message, useJson } from "./common.js";
import { CanvasMarks, PublishedChanges, useSheetCheck, useUnpublished } from "./marks.js";
import { h, React } from "./react.js";
import { postRoads, roadIn } from "./road-flow.js";
import { SyncCard, WaitingList, when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

const plural = (count, one, many) => count + " " + (count === 1 ? one : many || one + "s");

/** "HW2 - A grant office that answers in JSON" reads as "HW2"; a title with no short head stays whole. */
const shortTitle = (title) => {
  const head = String(title).split(/\s+[-–—:]\s+/)[0];
  return head.length <= 16 ? head : String(title);
};

/** Rows grouped by assessment, in the order the course names them: HW1 before HW2, Quiz 1 before Quiz 2. */
const byAssessment = (rows) => {
  const groups = new Map();
  for (const entry of rows) {
    const title = entry.title || entry.assessment_id || (entry.kind === "roster" ? "Class list" : "Other");
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(entry);
  }
  return [...groups]
    .map(([title, entries]) => ({ title, short: shortTitle(title), entries }))
    .sort((a, b) => a.short.localeCompare(b.short, undefined, { numeric: true }));
};

/** "(5 new in Canvas, 17 replace what Canvas shows)" for an assessment's marks going out. */
const sendSplit = (entries) => {
  const fresh = entries.filter((entry) => entry.theirs === null || entry.theirs === "").length;
  const replace = entries.length - fresh;
  return fresh && replace ? " (" + fresh + " new in Canvas, " + replace + " replace what Canvas shows)" : replace ? " (each replaces what Canvas shows)" : "";
};

/** "141 marks", "3 settings", or "141 marks and 3 settings". */
const sendNoun = (send) => {
  const marks = send.filter((entry) => entry.kind === "grades").length;
  const fields = send.length - marks;
  return [marks ? plural(marks, "mark") : null, fields ? plural(fields, "setting") : null].filter(Boolean).join(" and ");
};

/** Why the check left a difference for the professor, in their words; one line per kind. */
const HELD_WHY = {
  conflict: "changed on both sides — you choose which to keep",
  pull: "changed in Canvas since the last sync — a send never copies Canvas's changes over yours",
  held: "with nothing ready here to send yet (not accepted, or taken back)",
  unplaced: "on the class list, not matched between here and Canvas",
};

/** Which line of "Needs your decision" a held row is on: a class-list row that matches nobody is its own. */
const heldKind = (entry) => (entry.kind === "roster" && entry.direction === "held" ? "unplaced" : entry.direction);

/** The noun for rows of one kind: marks, people on the class list, or both mixed. */
const rowNoun = (entries) =>
  entries.every((entry) => entry.kind === "grades") ? ["mark"] : entries.every((entry) => entry.kind === "roster") ? ["person", "people"] : ["item"];

/** How many students an assessment shows before "Show N more", as on Canvas · what differs. */
const ROWS_AT_FIRST = 12;

/** Under this many rows a section opens at once; past it, the professor opens what they want to see. */
const OPEN_UNDER = 15;

/** Who one row is about: the student's name when names are on, the definition's field, or the class-list entry. */
const rowWho = (entry) =>
  entry.kind === "assignments" ? "Setting: " + String(entry.field || "").replace(/_/g, " ") : entry.name || entry.student_id || entry.theirs || "—";

/** A value as the row shows it: a Canvas date in the reader's own time. */
const valueText = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(text) && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return text;
};

/** A row going to Canvas: whose, and "Canvas 5 → 7". */
const SendRow = (props) =>
  h(
    "div",
    { className: "pp-drow" },
    h(
      "div",
      { className: "pp-drowline" },
      h("span", { className: "pp-drowwho" }, rowWho(props.entry)),
      h("span", { className: "pp-dvals" }, "Canvas " + (props.entry.theirs === null || props.entry.theirs === "" ? "empty" : valueText(props.entry.theirs)) + " → " + valueText(props.entry.ours)),
    ),
    props.entry.reason ? h("span", { className: "pp-dwhy" }, props.entry.reason) : null,
  );

/** A class-list row: who, and why the two lists do not agree. Settled by the class list, not row by row. */
const PersonRow = (props) =>
  h(
    "div",
    { className: "pp-drow" },
    h("div", { className: "pp-drowline" }, h("span", { className: "pp-drowwho" }, rowWho(props.entry))),
    props.entry.reason ? h("span", { className: "pp-dwhy" }, props.entry.reason) : null,
  );

/**
 * One assessment's rows behind a line that opens: the first dozen, then
 * "Show N more". `row(entry)` draws each; `extra` follows the count in the
 * line; `action` sits at its end; `under` sits just under it, open or not.
 */
function RowGroup(props) {
  const [all, setAll] = React.useState(false);
  const entries = props.group.entries;
  const rows = all ? entries : entries.slice(0, ROWS_AT_FIRST);
  const more = entries.length - rows.length;
  const noun = entries.every((entry) => entry.kind !== "assignments" && entry.student_id) ? ["student"] : rowNoun(entries);
  return h(
    "div",
    { className: "pp-sxgroupline", "data-sx-a": props.assessment || undefined },
    h(
      "details",
      { className: "pp-sxheld", open: props.open },
      h(
        "summary",
        { title: props.group.title },
        h("b", null, props.group.short),
        " — " + plural(entries.length, noun[0], noun[1]) + (props.extra || ""),
        props.action || null,
      ),
      rows.map((entry) => h(React.Fragment, { key: entry.key }, props.row(entry))),
      more ? h("button", { type: "button", className: "pp-linkbtn", onClick: () => setAll(true) }, "Show " + more + " more") : null,
    ),
    props.under || null,
  );
}

/**
 * A send behind a confirm: the first press says exactly what goes, the second
 * sends it. `label` is the button ("Send…"), `what` the sentence.
 */
function SendConfirm(props) {
  const open = props.open;
  if (!open) {
    return h(
      "button",
      {
        type: "button",
        className: "pp-segbtn " + (props.primary ? "pp-danger" : "pp-sxsendone"),
        disabled: props.busy,
        onClick: (event) => {
          // Inside a line's <summary>: the press asks, it does not open the list.
          event.preventDefault();
          props.onOpen();
        },
      },
      props.label,
    );
  }
  return null;
}

const ConfirmBar = (props) =>
  h(
    "div",
    { className: "pp-sxconfirm" },
    h("span", null, props.what),
    h(
      "button",
      { type: "button", className: "pp-segbtn pp-danger", disabled: props.busy, onClick: props.onSend },
      props.busy ? "Sending…" : props.go,
    ),
    h("button", { type: "button", className: "pp-segbtn", disabled: props.busy, onClick: props.onCancel }, "Cancel"),
  );

/** Student id → name, from the check's rows, when the pane shows names. */
const namesIn = (preview) => {
  const found = new Map();
  if (!preview) return found;
  for (const entry of [].concat(preview.send || [], preview.take || [], preview.held || [], preview.absent || [])) {
    if (entry.student_id && entry.name) found.set(entry.student_id, entry.name);
  }
  return found;
};

/**
 * A command's output with each student id it prints given the name beside
 * it, as the rows above show them: `ainar` itself only knows ids. The command
 * line keeps the ids it ran with.
 */
const withNamesIn = (text, names) =>
  names.size ? String(text).replace(/STUDENT-[A-Z0-9]+/g, (id) => (names.has(id) ? names.get(id) + " (" + id + ")" : id)) : String(text);

/** What a send came to, in a line, with each command's own words a press away. */
function SendOutcome(props) {
  const body = props.body;
  const names = props.names || new Map();
  const results = body.results || [];
  const failed = body.error || results.some((entry) => !entry.ok);
  const lines = body.error
    ? [body.error]
    : results.map((entry) => (entry.ok ? "✓ " : "✗ ") + (entry.command || entry.road) + (entry.output ? "\n" + withNamesIn(entry.output, names) : ""));
  return h(
    "div",
    { className: failed ? "pp-sxfailed" : "pp-sxsent" },
    h("span", null, failed ? "Not everything went: " + (body.again ? "the check is gone or old — Check again, then send." : "see below.") : "✓ Sent " + props.label + "."),
    lines.length
      ? h("details", { open: failed }, h("summary", null, "What ran"), h("pre", { className: "pp-approveout" + (failed ? " pp-approveerr" : "") }, lines.join("\n\n")))
      : null,
    h("button", { type: "button", className: "pp-linkbtn", onClick: props.onClose }, "Dismiss"),
  );
}

/** One reason the check left rows for the professor, opening into the assessments and the rows under it. */
function HeldKind(props) {
  const noun = rowNoun(props.entries);
  const groups = byAssessment(props.entries);
  return h(
    "details",
    { className: "pp-sxheld", open: props.open },
    h(
      "summary",
      null,
      h("b", null, plural(props.entries.length, noun[0], noun[1])),
      " " + HELD_WHY[props.kind],
      groups.length > 1 ? h("span", { className: "pp-as" }, " · " + groups.map((group) => group.short + " " + group.entries.length).join(", ")) : null,
    ),
    h(
      "div",
      { className: "pp-sxheldbody" },
      groups.map((group) => h(RowGroup, { key: group.title, group, row: props.row, open: props.open || groups.length === 1 })),
    ),
  );
}

/**
 * The page's plan of the Canvas road, kept up with the pane's check: asked
 * when the page opens and whenever a check lands. `send(keys)` sends from it;
 * the plan is asked again after, from the check the send made.
 */
function useCanvasPlan(props, check) {
  const [plan, setPlan] = React.useState(null);
  const [asking, setAsking] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const live = React.useRef(true);
  React.useEffect(() => () => (live.current = false), []);
  const ask = React.useCallback(() => {
    if (!props.enabled) return Promise.resolve(null);
    setAsking(true);
    return postRoads(props.runId, props.sessionId, { confirm: false, roads: ["canvas"], names: Boolean(props.names) }).then((body) => {
      if (!live.current) return null;
      setAsking(false);
      setPlan(body);
      return body;
    });
  }, [props.runId, props.sessionId, props.names, props.enabled]);
  const landed = check.value && check.value.at;
  React.useEffect(() => {
    ask();
  }, [ask, landed]);
  const send = (keys) => {
    setSending(true);
    return postRoads(props.runId, props.sessionId, { confirm: true, keys: { canvas: keys }, names: Boolean(props.names) }).then((body) => {
      if (!live.current) return body;
      setSending(false);
      // The send asked Canvas again; the pane's check takes that answer, and the plan follows it.
      if (body.after && body.after.canvas) noteCanvasCheck(props.runId, body.after.canvas, props.sessionId);
      else ask();
      return body;
    });
  };
  return { plan, asking, sending, ask, send };
}

/** The Canvas part of the page: To Canvas, the class list, and what needs a decision. */
function CanvasPart(props) {
  const [check, recheck] = useCanvasCheck(props.runId, props.sessionId);
  const flow = useCanvasPlan({ runId: props.runId, sessionId: props.sessionId, names: props.names, enabled: true }, check);
  // Which send is waiting on its confirm: an assessment's title, "all", or "class".
  const [confirming, setConfirming] = React.useState(null);
  const [outcome, setOutcome] = React.useState(null);
  const unpublished = useUnpublished(props.runId, props.sessionId, props.marksRevision);
  // An assessment whose Canvas link or creation is open under its line.
  const [linking, setLinking] = React.useState(null);
  // The assessment a column's menu on the Students page asked for: its line
  // opened, its link or creation opened where it has no assignment, and
  // brought into view once the check has drawn the page.
  const aimed = props.focus && props.focus.assessment ? props.focus.assessment : null;

  const road = roadIn(flow.plan, "canvas");
  const preview = road && road.ok ? road.preview : null;
  React.useEffect(() => {
    if (!aimed || !preview) return;
    setLinking((current) => current || aimed);
    const line = document.querySelector('[data-sx-a="' + aimed + '"]');
    if (line) line.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [aimed, props.focus ? props.focus.n : null, Boolean(preview)]);
  const checking = check.phase === "running" || (flow.asking && !preview);
  const busy = flow.sending || checking;

  const sendNow = (keys, label, tags) => {
    setConfirming(null);
    // Taken now: once sent, these rows leave the check the page shows next.
    const names = namesIn(preview);
    flow.send(keys).then((body) => {
      setOutcome({ body, label, names });
      props.onWrite(tags);
    });
  };

  const send = preview ? preview.send : [];
  const take = preview ? preview.take : [];
  const absent = preview ? preview.absent || [] : [];
  const left = preview ? preview.held.filter((entry) => !absent.some((gone) => gone.key === entry.key)) : [];
  const leftBy = ["conflict", "pull", "held", "unplaced"].map((kind) => ({ kind, entries: left.filter((entry) => heldKind(entry) === kind) }));
  const sendGroups = byAssessment(send);
  // Assessments with marks ready and no Canvas assignment in some course: the check cannot send them anywhere.
  const unlinked =
    unpublished.value && Array.isArray(unpublished.value.assessments)
      ? unpublished.value.assessments.filter(
          (entry) => entry.binding && (entry.binding.state === "none" || entry.binding.state === "some") && entry.canvas && entry.canvas.ready > 0,
        )
      : [];

  const head = h(
    "div",
    { className: "pp-sxhead" },
    h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"),
    h(
      "span",
      { className: "pp-sxcheck" },
      checking ? "Checking Canvas…" : preview ? "Canvas checked " + when(preview.checkedAt) : road && !road.ok ? "Canvas could not be checked" : "Canvas not checked yet",
      preview ? h("span", { className: "pp-as" }, " · nothing is sent until you press Send") : null,
    ),
    h("span", { className: "pp-segspacer" }),
    h("button", { type: "button", className: "pp-segbtn", disabled: busy, onClick: recheck }, checking ? "Checking…" : "Check again"),
  );

  if (!preview) {
    return h(
      React.Fragment,
      null,
      h("section", { className: "pp-ccard" }, head, road && !road.ok ? h("p", { className: "pp-saveerr" }, road.error) : flow.plan && flow.plan.error ? h("p", { className: "pp-saveerr" }, flow.plan.error) : null),
    );
  }

  const confirmFor = (id, keys, what, go, label, tags) =>
    confirming === id
      ? h(ConfirmBar, { what, go, busy: flow.sending, onCancel: () => setConfirming(null), onSend: () => sendNow(keys, label, tags) })
      : null;

  return h(
    React.Fragment,
    null,
    h("section", { className: "pp-ccard pp-sxtop" }, head, outcome ? h(SendOutcome, { body: outcome.body, label: outcome.label, names: outcome.names, onClose: () => setOutcome(null) }) : null),

    // To Canvas: students see these.
    h(
      "section",
      { className: "pp-ccard" + (send.length ? " pp-sxout" : ""), ref: props.marksRef },
      h(
        "div",
        { className: "pp-sxtitle" },
        h("b", null, send.length ? "To Canvas: " + sendNoun(send) : "To Canvas"),
        h("span", { className: "pp-as" }, send.length ? " — students will see these. Open a line to see whose." : " — nothing waiting; Canvas has every mark that is ready."),
      ),
      sendGroups.map((group) => {
        const keys = group.entries.map((entry) => entry.key);
        const count = sendNoun(group.entries);
        const id = (group.entries.find((entry) => entry.assessment_id) || {}).assessment_id || null;
        return h(RowGroup, {
          key: group.title,
          group,
          assessment: id,
          row: (entry) => h(SendRow, { entry }),
          extra: sendSplit(group.entries.filter((entry) => entry.kind === "grades")),
          action: h(SendConfirm, { label: "Send…", busy: busy || Boolean(confirming), open: confirming === group.title, onOpen: () => setConfirming(group.title) }),
          under: confirmFor(group.title, keys, "Send " + count + " for " + group.short + " to Canvas? Students will see them.", "Send " + count, group.short + " (" + count + ")", ["canvas", "marks"]),
          open: send.length < OPEN_UNDER || (aimed !== null && id === aimed),
        });
      }),
      sendGroups.length > 1
        ? h(
            "div",
            { className: "pp-dacts pp-sxfoot" },
            confirming === "all"
              ? h(ConfirmBar, {
                  what: "Send all " + sendNoun(send) + " to Canvas, " + plural(sendGroups.length, "assessment") + "? Students will see them.",
                  go: "Send all " + send.length,
                  busy: flow.sending,
                  onCancel: () => setConfirming(null),
                  onSend: () => sendNow(send.map((entry) => entry.key), "all " + sendNoun(send), ["canvas", "marks"]),
                })
              : h(SendConfirm, { primary: true, label: "Send all " + send.length + " to Canvas…", busy: busy || Boolean(confirming), open: false, onOpen: () => setConfirming("all") }),
          )
        : null,
    ),

    // Into your records: only the professor sees these.
    take.length || absent.length || props.roster
      ? h(
          "section",
          { className: "pp-ccard" },
          h("div", { className: "pp-sxtitle" }, h("b", null, "Into your records: the class list"), h("span", { className: "pp-as" }, " — only you see these")),
          take.length || absent.length
            ? h(
                React.Fragment,
                null,
                take.length
                  ? h(RowGroup, {
                      group: { title: "In Canvas, not in this run", short: "In Canvas, not in this run", entries: take },
                      row: (entry) => h(PersonRow, { entry }),
                      open: take.length < OPEN_UNDER,
                    })
                  : null,
                absent.length
                  ? h(RowGroup, {
                      group: { title: "In this run, no longer in Canvas", short: "In this run, no longer in Canvas", entries: absent },
                      row: (entry) => h(PersonRow, { entry }),
                      extra: " — each gets a dated note; nobody is dropped",
                      open: absent.length < OPEN_UNDER,
                    })
                  : null,
                h(
                  "div",
                  { className: "pp-dacts" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      disabled: busy,
                      onClick: () =>
                        sendNow(
                          take.map((entry) => entry.key).concat(absent.length && preview.absentKey ? [preview.absentKey] : []),
                          "the class list",
                          ["syncs", "records", "canvas"],
                        ),
                    },
                    "Bring in the class list",
                  ),
                ),
              )
            : h(
                "span",
                { className: "pp-as" },
                "The class list matches Canvas" + (props.roster && props.roster.lastSynced ? " · last brought in " + when(props.roster.lastSynced) : "") + ".",
              ),
        )
      : null,

    // Needs your decision: what no send does by itself.
    left.length || unlinked.length
      ? h(
          "section",
          { className: "pp-ccard" },
          h("div", { className: "pp-sxtitle" }, h("b", null, "Needs your decision"), h("span", { className: "pp-as" }, " — not sent by any Send above; open a line to settle each")),
          leftBy.map((kind) =>
            kind.entries.length
              ? h(HeldKind, {
                  key: kind.kind,
                  kind: kind.kind,
                  entries: kind.entries,
                  open: left.length < OPEN_UNDER,
                  row: (entry) =>
                    entry.kind === "roster"
                      ? h(PersonRow, { entry })
                      : h(DiffRow, {
                          entry,
                          runId: props.runId,
                          sessionId: props.sessionId,
                          names: props.names,
                          onSettled: () => {
                            flow.ask();
                            props.onWrite(["canvas", "marks"]);
                          },
                        }),
                })
              : null,
          ),
          unlinked.length
            ? h(
                "details",
                { className: "pp-sxheld", open: unlinked.length < 4 || unlinked.some((entry) => entry.id === aimed) },
                h("summary", null, h("b", null, plural(unlinked.length, "assessment")), " with marks ready and no Canvas assignment to send them to"),
                h(
                  "div",
                  { className: "pp-sxheldbody" },
                  unlinked.map((entry) =>
                    h(
                      "div",
                      { className: "pp-sxgroupline", key: entry.id, "data-sx-a": entry.id },
                      h(
                        "div",
                        { className: "pp-drowline" },
                        h("span", { className: "pp-drowwho", title: entry.title }, h("b", null, shortTitle(entry.title))),
                        h(
                          "span",
                          { className: "pp-dwhy" },
                          entry.binding.state === "none" ? "no Canvas assignment yet" : "none in " + (entry.binding.missing || []).join(", "),
                        ),
                        h(
                          "button",
                          { type: "button", className: "pp-segbtn", onClick: () => setLinking(linking === entry.id ? null : entry.id) },
                          linking === entry.id ? "Close" : "Link or create…",
                        ),
                      ),
                      linking === entry.id
                        ? h(
                            "div",
                            { className: "pp-bookdrawer" },
                            h(CanvasMarks, {
                              runId: props.runId,
                              sessionId: props.sessionId,
                              assessmentId: entry.id,
                              title: entry.title,
                              ask: props.ask,
                              names: props.names,
                              canvas: entry.canvas,
                              autoPreview: true,
                              onSent: () => props.onWrite(["grading", "canvas", "marks"]),
                            }),
                          )
                        : null,
                    ),
                  ),
                ),
              )
            : null,
        )
      : null,
  );
}

/**
 * Course mode · Sync: what goes to Canvas, what comes in, what needs a
 * decision, and the materials changed since publishing. `focus: "marks"` (a
 * link that used to open Gradebook · To Canvas or Waiting · Unpublished)
 * brings To Canvas into view.
 */
export function SyncView(props) {
  const [tick, setTick] = React.useState(0);
  const revision = String(props.revision || 0) + "." + tick;
  const syncs = useJson(
    scoped(
      BASE + "/api/syncs?run=" + encodeURIComponent(props.runId || "") + (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(revision),
      props.sessionId,
    ),
  );
  const checks = useSheetCheck(props.runId, props.sessionId, revision);
  const kept = React.useRef(null);
  if (syncs.phase === "ready" && syncs.value && !syncs.value.error) kept.current = syncs.value;
  // Scrolled to once the page is drawn, and again when the same link is
  // followed twice (the focus is numbered like the request it came with).
  const marksRef = React.useRef(null);
  React.useEffect(() => {
    if (props.focus && props.focus.section === "marks" && marksRef.current) marksRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [props.focus ? props.focus.n : null, Boolean(kept.current)]);

  const done = (tags) => {
    setTick((value) => value + 1);
    if (props.onWrite) props.onWrite(tags);
  };

  const doc = kept.current;
  if (syncs.phase === "ready" && syncs.value && syncs.value.error && !doc) return h(Message, { error: true }, syncs.value.error);
  if (!doc) return h(Message, null, "Reading this run's roads…");

  const canvasOn = doc.syncs.some((sync) => sync.service === "canvas" && sync.enabled);
  const roster = doc.syncs.find((sync) => sync.service === "canvas" && sync.stream === "roster" && sync.enabled) || null;
  const sheets = doc.syncs.filter((sync) => sync.service === "sheets" && sync.stream === "marks" && sync.enabled);
  const sheetIds = new Set(sheets.map((sync) => sync.id));
  const waiting = doc.waiting.filter((row) => sheetIds.has(row.sync));
  const checkOf = (sync) => (checks && checks.checks ? checks.checks.find((entry) => entry.sync === sync.id) : null);

  return h(
    "div",
    { className: "pp-syncview" },
    canvasOn
      ? h(CanvasPart, {
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          marksRevision: props.marksRevision,
          roster,
          ask: props.ask,
          focus: props.focus,
          marksRef,
          onWrite: done,
        })
      : h("p", { className: "pp-as" }, "This run sends nothing to Canvas. Set Canvas up in Course settings to see what it lacks here."),
    // Into your records: each grade sheet, with the names it could not place under it.
    sheets.map((sync) =>
      h(
        "section",
        { className: "pp-ccard", key: sync.id },
        h(
          "div",
          { className: "pp-chead" },
          h("span", { className: "pp-svc pp-svc-sheets", "aria-hidden": "true" }, "GS"),
          h("span", { className: "pp-cname" }, "Into your records: " + sync.label, h("span", { className: "pp-intwhat" }, sync.id)),
        ),
        h(SyncCard, { sync, bare: true, check: checkOf(sync), runId: props.runId, sessionId: props.sessionId, names: props.names, onDone: () => done(["syncs", "marks"]) }),
        h(WaitingList, {
          rows: waiting.filter((row) => row.sync === sync.id),
          students: doc.students,
          names: doc.names,
          runId: props.runId,
          sessionId: props.sessionId,
          onDone: () => done(["syncs", "marks"]),
        }),
      ),
    ),
    h(PublishedChanges, { runId: props.runId, sessionId: props.sessionId, revision: props.marksRevision, openPublish: props.openPublish }),
    h(
      "p",
      { className: "pp-as" },
      "Addresses, tokens, which course and which sheet are in Course settings. ",
      props.onOpenSettings ? h("button", { type: "button", className: "pp-linkbtn", onClick: props.onOpenSettings }, "Open Course settings") : null,
    ),
  );
}
