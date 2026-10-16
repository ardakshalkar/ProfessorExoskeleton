/**
 * Progress · Gradebook, top half: two panes. Left, everything that changed a
 * grade or the policy, newest first. Right, the grading policy — how the grade
 * is divided, what each block holds, whether it adds up — locked against
 * accidental edits, and changed only through an editor that shows what the
 * change would do before it is made.
 *
 * The editor is a sheet over the page rather than a form in the pane: a policy
 * is a tree, a list of twenty assessments and an impact report at once, and
 * none of that fits a 320-pixel column. Its right half is the impact, asked of
 * the server on every pause in typing — the same gradebook, scale and
 * validator the course runs on, applied to the course as it would be. What a
 * count cannot see (a brief that says "10% of the final grade", a syllabus
 * students were given) is the session's: one press hands it the proposal and
 * the counted impact, and asks it to read the course before anything is
 * written.
 */

import { Message } from "./common.js";
import { h, React, ReactDOM } from "./react.js";
import { initials, when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

// ---------------------------------------------------------------- plumbing

const gpPct = (weight) => (weight === null || weight === undefined || weight === "" ? "—" : Math.round(Number(weight) * 10000) / 100 + "%");
const gpRound = (value, digits) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};
const gpUrl = (path, runId, sessionId, extra) => scoped(BASE + path + "?run=" + encodeURIComponent(runId || "") + (extra || ""), sessionId);
/**
 * Every read and write here gives up after twenty seconds and says so. A
 * request the browser never sends — its six connections to this host held by
 * other tabs — or a harness that went away mid-answer would otherwise leave
 * "Reading the policy…" on screen for good, which reads as slowness, not as
 * the failure it is.
 */
const GP_TIMEOUT_MS = 20000;
const gpFetch = (url, init) => {
  const abort = typeof AbortController === "function" ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), GP_TIMEOUT_MS) : null;
  return fetch(url, Object.assign({}, init, abort ? { signal: abort.signal } : {}))
    .then((response) => response.json())
    .catch((error) => ({
      error:
        error && error.name === "AbortError"
          ? "No answer from the pane's server in " + GP_TIMEOUT_MS / 1000 + " seconds. If several tabs of the harness are open, close the extras and press Retry; otherwise the harness may need a restart."
          : String((error && error.message) || error),
    }))
    .finally(() => timer && clearTimeout(timer));
};
const gpGet = (path, runId, sessionId, extra) => gpFetch(gpUrl(path, runId, sessionId, extra), { headers: { accept: "application/json" } });
const gpPost = (path, runId, sessionId, body) =>
  gpFetch(gpUrl(path, runId, sessionId), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

const FAMILY_WORDS = {
  period: "by period",
  category: "by kind of work",
  hybrid: "period × kind",
  admission: "admission gate",
  flat: "no blocks",
};

/** Blocks in tree order: each parent followed by what is inside it, with its depth. */
const gpTree = (components) => {
  const out = [];
  const visit = (parent, depth, seen) => {
    for (const component of components) {
      if ((component.parent || null) !== parent || seen.has(component.component_id)) continue;
      seen.add(component.component_id);
      out.push({ component: component, depth: depth });
      visit(component.component_id, depth + 1, seen);
    }
  };
  const seen = new Set();
  visit(null, 0, seen);
  // A block whose parent is missing still shows, at the top, so it can be fixed.
  for (const component of components) if (!seen.has(component.component_id)) out.push({ component: component, depth: 0 });
  return out;
};

/** What is in a block: its sub-blocks' weights and its own assessments' weights, added. */
const gpFilled = (policy, componentId) => {
  const children = policy.components.filter((c) => c.parent === componentId);
  const members = Object.entries(policy.assignments).filter((entry) => entry[1].component === componentId);
  return (
    children.reduce((sum, c) => sum + Number(c.weight || 0), 0) +
    members.reduce((sum, entry) => sum + Number(entry[1].weight || 0), 0)
  );
};

const gpClose = (a, b) => Math.abs(a - b) <= 0.001;

// ---------------------------------------------------------------- the two panes

export function GradebookPanes(props) {
  const [revision, setRevision] = React.useState(0);
  const [editing, setEditing] = React.useState(null); // null, or { start: proposal | null, label }
  const bump = () => {
    setRevision((value) => value + 1);
    if (props.onWrite) props.onWrite();
  };
  const key = props.revision + "|" + revision;
  return h(
    "div",
    { className: "pp-gbwrap" },
    h(
    "div",
    { className: "pp-gbpanes" },
    h(LastChanges, {
      runId: props.runId,
      sessionId: props.sessionId,
      names: props.names,
      revision: key,
      onRestore: (proposal, at) => setEditing({ start: proposal, label: "Restoring the policy as it was before " + (when(at) || "that change") }),
    }),
    h(PolicyCard, {
      runId: props.runId,
      sessionId: props.sessionId,
      revision: key,
      onEdit: () => setEditing({ start: null, label: null }),
      onWrite: bump,
    }),
    ),
    editing
      ? h(PolicyEditor, {
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          ask: props.ask,
          start: editing.start,
          label: editing.label,
          onClose: () => setEditing(null),
          onWritten: () => {
            setEditing(null);
            bump();
          },
        })
      : null,
  );
}

// ---------------------------------------------------------------- left: last changes

const CHANGE_FILTERS = [
  ["all", "All"],
  ["grade", "Grades"],
  ["sheet", "Sheet"],
  ["policy", "Policy"],
];

function LastChanges(props) {
  const [state, setState] = React.useState({ phase: "loading" });
  const [filter, setFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    gpGet("/api/gradebook/changes", props.runId, props.sessionId, (props.names ? "&names=1" : "") + "&r=" + encodeURIComponent(props.revision) + "&a=" + attempt).then(
      (value) => live && setState({ phase: "ready", value: value }),
    );
    return () => {
      live = false;
    };
  }, [props.runId, props.sessionId, props.names, props.revision, attempt]);

  const body = () => {
    if (state.phase === "loading") return h("div", { className: "pp-as pp-gbpad" }, "Reading what changed…");
    if (state.value.error) return h(GpFailed, { error: state.value.error, retry: () => setAttempt((n) => n + 1) });
    const events = state.value.events.filter((event) => filter === "all" || event.kind === filter);
    if (!events.length) {
      return h(
        "div",
        { className: "pp-as pp-gbpad" },
        filter === "all" ? "No grade has been decided and the policy has not been changed here yet." : "Nothing of this kind yet.",
      );
    }
    const shown = open ? events : events.slice(0, 14);
    return h(
      React.Fragment,
      null,
      h(
        "ul",
        { className: "pp-gblog" },
        shown.map((event, index) => h(ChangeLine, { key: event.kind + index + (event.at || ""), event: event, runId: props.runId, sessionId: props.sessionId, onRestore: props.onRestore })),
      ),
      events.length > shown.length
        ? h("button", { type: "button", className: "pp-linkbtn pp-gbmore", onClick: () => setOpen(true) }, "Show " + (events.length - shown.length) + " more")
        : null,
    );
  };

  return h(
    "section",
    { className: "pp-bookcard pp-gbpane", "aria-label": "Last changes" },
    h(
      "div",
      { className: "pp-cardhead" },
      h("b", null, "Last changes"),
      h(
        "span",
        { className: "pp-gbfilters" },
        CHANGE_FILTERS.map((entry) =>
          h(
            "button",
            { key: entry[0], type: "button", className: "pp-segbtn pp-gbfilter", "aria-pressed": filter === entry[0], onClick: () => setFilter(entry[0]) },
            entry[1],
          ),
        ),
      ),
    ),
    h("div", { className: "pp-gbpanebody" }, body()),
  );
}

const scoreWords = (value, of) => (value === null || value === undefined ? "—" : String(gpRound(Number(value), 2)) + (of ? "/" + of : ""));

function ChangeLine(props) {
  const event = props.event;
  const [busy, setBusy] = React.useState(false);
  const stamp = h("span", { className: "pp-gbwhen", title: event.at ? new Date(event.at).toLocaleString() : "no time recorded" }, when(event.at) || "undated");

  if (event.kind === "policy") {
    const restore = () => {
      setBusy(true);
      gpGet("/api/grading/history", props.runId, props.sessionId, "&index=" + event.index).then((answer) => {
        setBusy(false);
        if (answer.error) window.alert(answer.error);
        else props.onRestore(answer.proposal, answer.at);
      });
    };
    return h(
      "li",
      { className: "pp-gbline pp-gbline-policy" },
      h("span", { className: "pp-gbicon", "aria-hidden": "true" }, event.action === "lock" ? "🔒" : event.action === "unlock" ? "🔓" : "§"),
      h(
        "div",
        { className: "pp-gbwhat" },
        h("div", null, h("b", null, event.action === "lock" ? "Policy locked" : event.action === "unlock" ? "Policy unlocked" : "Grading policy changed"), stamp),
        event.action === "change" ? h("ul", { className: "pp-gbsummary" }, event.summary.slice(0, 4).map((line, i) => h("li", { key: i }, line))) : null,
        event.note ? h("div", { className: "pp-as" }, "“" + event.note + "”") : null,
        event.restorable
          ? h("button", { type: "button", className: "pp-linkbtn", disabled: busy, onClick: restore }, busy ? "Opening…" : "Open the policy as it was before…")
          : null,
      ),
    );
  }

  if (event.kind === "sheet") {
    const counts = [event.added ? event.added + " new" : null, event.changed ? event.changed + " changed" : null, event.removed ? event.removed + " taken back" : null]
      .filter(Boolean)
      .join(" · ");
    return h(
      "li",
      { className: "pp-gbline" },
      h("span", { className: "pp-svc pp-svc-sheets pp-svc-small", "aria-hidden": "true" }, "GS"),
      h(
        "div",
        { className: "pp-gbwhat" },
        h("div", null, h("b", null, "Grade sheet synced"), stamp),
        h("div", { className: "pp-as" }, counts || "nothing changed"),
        event.changes.length
          ? h(
              "div",
              { className: "pp-gbmarks" },
              event.changes.map((change, i) =>
                h(
                  "span",
                  { key: i, className: "pp-gbmark" },
                  (change.name || change.student) + " · " + change.title + " " + (change.to === null && change.score_to === null ? "taken back" : scoreWords(change.score_to)),
                ),
              ),
              event.more ? h("span", { className: "pp-as" }, "+" + event.more + " more") : null,
            )
          : null,
      ),
    );
  }

  // A decided mark: per paper, the criteria that moved.
  const who = event.name || event.student;
  return h(
    "li",
    { className: "pp-gbline" },
    h("span", { className: "pp-avatar", "aria-hidden": "true" }, initials(who)),
    h(
      "div",
      { className: "pp-gbwhat" },
      h("div", null, h("b", null, who), " · " + event.title, stamp),
      h(
        "div",
        { className: "pp-as" },
        (event.first ? "graded" : "changed") +
          " via " +
          event.how +
          (event.by ? " by " + event.by : "") +
          " — " +
          event.criteria
            .slice(0, 4)
            .map((c) => c.criterion + " " + (c.from === null ? "" : scoreWords(c.from) + " → ") + scoreWords(c.to, c.of))
            .join("; ") +
          (event.criteria.length > 4 ? "; +" + (event.criteria.length - 4) : ""),
      ),
    ),
  );
}

// ---------------------------------------------------------------- right: the policy

function usePolicy(runId, sessionId, revision) {
  const [state, setState] = React.useState({ phase: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    gpGet("/api/grading/policy", runId, sessionId, "&r=" + encodeURIComponent(revision) + "&a=" + attempt).then((value) => live && setState({ phase: "ready", value: value }));
    return () => {
      live = false;
    };
  }, [runId, sessionId, revision, attempt]);
  return Object.assign({ retry: () => setAttempt((n) => n + 1) }, state);
}

/** A failure with the one press that tries again. */
function GpFailed(props) {
  return h(
    "div",
    null,
    h(Message, { error: true }, props.error),
    props.retry ? h("button", { type: "button", className: "pp-segbtn", style: { margin: "0 14px 10px" }, onClick: props.retry }, "Retry") : null,
  );
}

function PolicyCard(props) {
  const state = usePolicy(props.runId, props.sessionId, props.revision);
  const [unlocking, setUnlocking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);

  const head = (doc) =>
    h(
      "div",
      { className: "pp-cardhead" },
      h("b", null, "Grading policy"),
      doc
        ? h(
            "span",
            { className: "pp-chip " + (doc.locked ? "pp-chip-ok" : "pp-chip-warn"), title: doc.locked ? "Nothing can change the policy until it is unlocked." : "Anyone with the pane or the session can change it." },
            doc.locked ? "🔒 Locked" : "Unlocked",
          )
        : null,
      doc && !doc.locked
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: busy,
              title: "Freeze the policy: no block, weight or filing can change until it is unlocked.",
              onClick: () => {
                setBusy(true);
                gpPost("/api/grading/lock", props.runId, props.sessionId, { locked: true }).then((answer) => {
                  setBusy(false);
                  if (answer.error) setFailed(answer.error);
                  else props.onWrite();
                });
              },
            },
            "Lock",
          )
        : null,
      doc
        ? doc.locked
          ? h("button", { type: "button", className: "pp-segbtn", onClick: () => setUnlocking(true) }, "Unlock…")
          : h("button", { type: "button", className: "pp-primary", onClick: props.onEdit }, "Change…")
        : null,
    );

  if (state.phase === "loading") return h("section", { className: "pp-bookcard pp-gbpane" }, head(null), h("div", { className: "pp-as pp-gbpad" }, "Reading the policy…"));
  const doc = state.value;
  if (doc.error) return h("section", { className: "pp-bookcard pp-gbpane" }, head(null), h(GpFailed, { error: doc.error, retry: state.retry }));

  return h(
    "section",
    { className: "pp-bookcard pp-gbpane", "aria-label": "Grading policy" },
    head(doc),
    h(
      "div",
      { className: "pp-gbpanebody" },
      failed ? h(Message, { error: true }, failed) : null,
      unlocking
        ? h(UnlockForm, {
            runId: props.runId,
            sessionId: props.sessionId,
            onCancel: () => setUnlocking(false),
            onDone: () => {
              setUnlocking(false);
              props.onWrite();
            },
          })
        : null,
      h(PolicyTree, { policy: doc.policy, assessments: doc.assessments, groups: doc.canvas_groups }),
      doc.description ? h("p", { className: "pp-as pp-gbdesc" }, doc.description) : null,
      doc.issues.length
        ? h(
            "ul",
            { className: "pp-gbissues" },
            doc.issues.map((issue, i) => h("li", { key: i, className: issue.level === "error" ? "pp-gbissue-err" : "" }, (issue.location ? issue.location + ": " : "") + issue.message)),
          )
        : h("div", { className: "pp-as pp-gbok" }, "✓ Adds up: the validator has nothing to say about the policy."),
    ),
  );
}

function UnlockForm(props) {
  const [typed, setTyped] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  return h(
    "div",
    { className: "pp-gbunlock" },
    h("b", null, "Unlock the grading policy"),
    h("p", { className: "pp-as" }, "Marks may already be in Canvas on this policy's scale. Unlocking is recorded in the policy's history, with your reason."),
    h("input", { className: "pp-gbinput", placeholder: "Why (optional)", value: note, onChange: (e) => setNote(e.target.value) }),
    h("input", { className: "pp-gbinput", placeholder: "Type UNLOCK", value: typed, onChange: (e) => setTyped(e.target.value), "aria-label": "Type UNLOCK to confirm" }),
    failed ? h(Message, { error: true }, failed) : null,
    h(
      "div",
      { className: "pp-gbrow" },
      h("button", { type: "button", className: "pp-segbtn", onClick: props.onCancel }, "Cancel"),
      h(
        "button",
        {
          type: "button",
          className: "pp-danger",
          disabled: typed.trim().toUpperCase() !== "UNLOCK" || busy,
          "aria-busy": busy,
          onClick: () => {
            setBusy(true);
            gpPost("/api/grading/lock", props.runId, props.sessionId, { locked: false, confirm: typed, note: note }).then((answer) => {
              setBusy(false);
              if (answer.error) setFailed(answer.error);
              else props.onDone();
            });
          },
        },
        "Unlock",
      ),
    ),
  );
}

/** The policy as a tree of blocks with a bar each, and the assessments inside them. */
function PolicyTree(props) {
  const policy = props.policy;
  const titles = new Map((props.assessments || []).map((a) => [a.assessment_id, a]));
  const members = (componentId) =>
    Object.entries(policy.assignments)
      .filter((entry) => (entry[1].component || null) === componentId)
      .map((entry) => ({ id: entry[0], weight: entry[1].weight, record: titles.get(entry[0]) }));
  const top = policy.components.filter((c) => !c.parent);
  const topSum = top.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const loose = members(null).filter((m) => m.weight !== null && m.weight !== undefined);

  if (!policy.components.length) {
    const total = Object.values(policy.assignments).reduce((sum, a) => sum + Number(a.weight || 0), 0);
    return h(
      "div",
      null,
      h("div", { className: "pp-as" }, "No blocks: every assessment counts by its own weight. Together they are " + gpPct(total) + (gpClose(total, 1) ? "." : ", not 100%.")),
      h(MemberList, { members: loose }),
    );
  }

  return h(
    "div",
    { className: "pp-gbtree" },
    h(
      "div",
      { className: "pp-gbbar", role: "img", "aria-label": top.map((c) => c.title + " " + gpPct(c.weight)).join(", ") },
      top.map((c, i) =>
        h("span", { key: c.component_id, className: "pp-gbseg pp-gbseg" + (i % 6), style: { flexGrow: Math.max(Number(c.weight) || 0, 0.0001) }, title: c.title + " " + gpPct(c.weight) }, c.title + " " + gpPct(c.weight)),
      ),
    ),
    gpClose(topSum, 1) ? null : h("div", { className: "pp-behind" }, "The top-level blocks add up to " + gpPct(topSum) + ", not 100%."),
    gpTree(policy.components).map((entry) => {
      const c = entry.component;
      const filled = gpFilled(policy, c.component_id);
      const list = members(c.component_id);
      const hasChildren = policy.components.some((x) => x.parent === c.component_id);
      const ok = gpClose(filled, Number(c.weight));
      return h(
        "details",
        { key: c.component_id, className: "pp-gbblock", style: { marginLeft: entry.depth * 14 + "px" }, open: entry.depth === 0 && list.length <= 6 },
        h(
          "summary",
          null,
          h("span", { className: "pp-tag" }, c.component_id),
          h("span", { className: "pp-gbbtitle" }, c.title),
          h("span", { className: "pp-gbbw" }, gpPct(c.weight)),
          c.points ? h("span", { className: "pp-chip" }, "out of " + c.points) : null,
          props.groups && props.groups.indexOf(c.component_id) !== -1 ? h("span", { className: "pp-chip pp-chip-quiet", title: "Has a Canvas assignment group" }, "Canvas ✓") : null,
          list.length || hasChildren
            ? h("span", { className: ok ? "pp-gbsum pp-gbsum-ok" : "pp-gbsum pp-gbsum-off", title: "What is inside adds up to " + gpPct(filled) }, ok ? "✓" : gpPct(filled) + " inside")
            : h("span", { className: "pp-gbsum pp-gbsum-off" }, "empty"),
        ),
        h(MemberList, { members: list }),
      );
    }),
    loose.length ? h("div", { className: "pp-gbloose" }, h("b", null, "In no block"), h(MemberList, { members: loose })) : null,
  );
}

function MemberList(props) {
  if (!props.members.length) return null;
  return h(
    "ul",
    { className: "pp-gbmembers" },
    props.members.map((m) =>
      h(
        "li",
        { key: m.id },
        h("span", { className: "pp-titletext" }, m.record ? m.record.title : m.id),
        m.record && m.record.draft ? h("span", { className: "pp-chip pp-chip-warn" }, "draft") : null,
        m.record && m.record.sent ? h("span", { className: "pp-chip pp-chip-quiet", title: m.record.sent + " marks in Canvas" }, "Canvas " + m.record.sent) : null,
        h("span", { className: "pp-gbmw" }, gpPct(m.weight)),
      ),
    ),
  );
}

// ---------------------------------------------------------------- the editor

/** A proposal deep-copied, so an edit never reaches the document it started from. */
const gpCopy = (proposal) => JSON.parse(JSON.stringify(proposal));

function PolicyEditor(props) {
  const state = usePolicy(props.runId, props.sessionId, "editor");
  const [draft, setDraft] = React.useState(null);
  const [origin, setOrigin] = React.useState(props.label);
  const [impact, setImpact] = React.useState({ phase: "idle" });
  const [ack, setAck] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [writing, setWriting] = React.useState(false);
  const [failed, setFailed] = React.useState(null);
  const [asked, setAsked] = React.useState(false);
  const [proposals, setProposals] = React.useState([]);
  const [loaded, setLoaded] = React.useState(null); // the proposal id now in the editor
  const [showAssistant, setShowAssistant] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 1100);
  const doc = state.phase === "ready" && !state.value.error ? state.value : null;

  React.useEffect(() => {
    if (doc && draft === null) setDraft(gpCopy(props.start || doc.policy));
    if (doc) setProposals(doc.proposals || []);
  }, [doc]);

  /** Read the proposals again, without redrawing the editor: the policy read, proposals only. */
  const refreshProposals = () =>
    gpGet("/api/grading/policy", props.runId, props.sessionId, "&p=" + Date.now()).then((value) => {
      if (value && !value.error) setProposals(value.proposals || []);
      return value;
    });

  const loadProposal = (entry) => {
    setDraft(gpCopy(entry.proposal));
    setLoaded(entry.id);
    setOrigin("Proposal " + entry.id + " from the assistant" + (entry.request ? " — for “" + entry.request + "”" : "") + ". Edit it here like any draft; nothing is written until you apply.");
  };
  const discardProposal = (entry) =>
    gpPost("/api/grading/discard", props.runId, props.sessionId, { id: entry.id }).then((answer) => {
      if (answer.error) setFailed(answer.error);
      if (loaded === entry.id) setLoaded(null);
      return refreshProposals();
    });

  // The impact, asked again on every pause: 450ms after the last keystroke.
  React.useEffect(() => {
    if (!draft) return undefined;
    let live = true;
    setImpact((current) => ({ phase: "checking", value: current.value }));
    const timer = setTimeout(() => {
      gpPost("/api/grading/impact", props.runId, props.sessionId, { proposal: draft, names: Boolean(props.names) }).then((answer) => {
        if (!live) return;
        setImpact({ phase: "ready", value: answer });
        setAck(false);
      });
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [draft]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !writing) {
        event.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [writing]);

  const update = (change) => setDraft((current) => change(gpCopy(current)));

  const choosePreset = (preset) => {
    setFailed(null);
    gpPost("/api/grading/impact", props.runId, props.sessionId, { preset: preset.id, names: Boolean(props.names) }).then((answer) => {
      if (answer.error) return setFailed(answer.error);
      setOrigin("From the preset “" + preset.title + "” — work is filed where you had it when the preset has that block, by kind and date otherwise.");
      setDraft(answer.proposal);
    });
  };

  const result = impact.value && !impact.value.error ? impact.value.impact : null;
  const weighty = result && result.weighty;
  const blocked = !result || result.nothing || result.errors.length > 0 || (weighty && !ack) || impact.phase !== "ready";

  const apply = () => {
    setWriting(true);
    setFailed(null);
    gpPost("/api/grading/apply", props.runId, props.sessionId, { proposal: draft, base: doc.base, acknowledged: ack, note: note }).then((answer) => {
      setWriting(false);
      if (answer.error) return setFailed(answer.error);
      props.onWritten();
    });
  };

  const askSession = () => {
    if (!props.ask || !result) return;
    props.ask(reviewPrompt(props.runId, draft, result, doc));
    setAsked(true);
  };

  const content = () => {
    if (state.phase === "ready" && state.value.error) return h("div", { className: "pp-review" }, h(GpFailed, { error: state.value.error, retry: state.retry }));
    if (state.phase === "loading" || !draft) return h("div", { className: "pp-review" }, h("div", { className: "pp-as" }, "Reading the policy…"));
    if (doc.locked) return h("div", { className: "pp-review" }, h(Message, { error: true }, "The policy is locked. Close this and unlock it first."));
    return h(
      "div",
      { className: "pp-modalbody" },
      h(
        "div",
        { className: "pp-modalpane" },
        h("div", { className: "pp-modalpanelabel" }, "The policy as it would be"),
        h(
          "div",
          { className: "pp-review" },
          h(PresetStrip, { presets: doc.presets, onChoose: choosePreset }),
          origin ? h("div", { className: "pp-gborigin" }, origin) : null,
          h(BlockEditor, { draft: draft, update: update }),
          h(FilingEditor, { draft: draft, update: update, assessments: doc.assessments }),
        ),
      ),
      // Nothing to compare yet — the current policy, untouched — so no column
      // for it: it appears with the first edit, preset or loaded proposal.
      gpDiff(doc.policy, draft).empty
        ? null
        : h(
        "div",
        { className: "pp-modalpane pp-gbimpactpane" },
        h("div", { className: "pp-modalpanelabel" }, "What it changes", impact.phase === "checking" ? h("span", { className: "pp-checkspin", style: { marginLeft: "6px", display: "inline-block" } }) : null),
        h(
          "div",
          { className: "pp-review" },
          impact.value && impact.value.error ? h(Message, { error: true }, impact.value.error) : null,
          result
            ? h(ImpactReport, { impact: result, names: props.names, before: doc.policy, after: draft, assessments: doc.assessments })
            : h("div", { className: "pp-as" }, "Counting…"),
        ),
      ),
      showAssistant
        ? h(AssistantPanel, {
            runId: props.runId,
            ask: props.ask,
            doc: doc,
            draft: draft,
            proposals: proposals,
            loaded: loaded,
            refresh: refreshProposals,
            onLoad: loadProposal,
            onDiscard: discardProposal,
          })
        : null,
    );
  };

  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil pp-gbveil" },
      h(
        "div",
        { className: "pp-modal", role: "dialog", "aria-modal": "true", "aria-label": "Change the grading policy" },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Change the grading policy · " + props.runId),
          h(
            "button",
            { type: "button", className: "pp-segbtn", "aria-pressed": showAssistant, onClick: () => setShowAssistant(!showAssistant), title: "Ask for a change in words; the assistant proposes, you load and apply" },
            "✦ Assistant" + (proposals.length ? " · " + proposals.length : ""),
          ),
          draft && doc
            ? h("button", { type: "button", className: "pp-modallink", onClick: () => (setDraft(gpCopy(doc.policy)), setOrigin(null), setLoaded(null)) }, "Start again from the current policy")
            : null,
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", disabled: writing, onClick: props.onClose }, "×"),
        ),
        content(),
        doc && !doc.locked && draft
          ? h(
              "div",
              { className: "pp-reviewfoot" },
              h(
                "span",
                { className: "pp-as" },
                result && result.errors.length
                  ? h("span", { className: "pp-gbissue-err" }, "Cannot be written: " + result.errors[0].message)
                  : weighty
                    ? h(
                        "label",
                        { className: "pp-gback" },
                        h("input", { type: "checkbox", checked: ack, onChange: (e) => setAck(e.target.checked) }),
                        " I have read what this changes" + (result.canvas.resend.length ? ", including marks Canvas already has" : result.blocks.removed.length || result.canvas.needs_group.length ? ", including the Canvas groups" : "") + ".",
                      )
                    : result && result.nothing
                      ? "Nothing changes yet."
                      : "Nobody's total moves, Canvas has no marks on what changes, and no Canvas group loses its block.",
              ),
              h("input", { className: "pp-gbinput pp-gbnote", placeholder: "Why (kept in the history)", value: note, onChange: (e) => setNote(e.target.value) }),
              props.ask
                ? h(
                    "button",
                    { type: "button", className: "pp-segbtn", disabled: !result || result.nothing, onClick: askSession, title: "The session reads briefs, keys, the syllabus and Canvas for what this would affect. It edits nothing." },
                    asked ? "Asked ✓" : "Ask the assistant to check",
                  )
                : null,
              failed ? h("span", { className: "pp-gbissue-err" }, failed) : null,
              h("button", { type: "button", className: "pp-segbtn", disabled: writing, onClick: props.onClose }, "Cancel"),
              h("button", { type: "button", className: "pp-primary", disabled: blocked || writing, "aria-busy": writing, onClick: apply }, "Apply change"),
            )
          : null,
      ),
    ),
    document.body,
  );
}

/**
 * What the session is asked. The counted impact and the proposal, in ids and
 * percentages only — no names — and the questions a count cannot answer. It
 * is told not to edit: the professor's press in the editor is the write.
 */
const reviewPrompt = (runId, draft, impact, doc) => {
  const blocks = gpTree(draft.components)
    .map((entry) => {
      const c = entry.component;
      return "  ".repeat(entry.depth) + "- " + c.component_id + " " + c.title + " " + gpPct(c.weight) + (c.points ? " (out of " + c.points + ")" : "");
    })
    .join("\n");
  const filing = Object.entries(draft.assignments)
    .map((entry) => entry[0] + " → " + (entry[1].component || "none") + " " + gpPct(entry[1].weight))
    .join("; ");
  return (
    "I am about to change the grading policy of " +
    runId +
    " in the pane. Do not edit anything — review it and tell me what it affects.\n\n" +
    "Proposed blocks:\n" +
    (blocks || "(none — every assessment counts by its own weight)") +
    "\nFiling: " +
    filing +
    "\n\nCounted impact (the pane's, exact):\n- " +
    impact.summary.join("\n- ") +
    "\n\nCheck what the counts cannot: briefs, answer keys, the syllabus, the course page and announcements that state a percentage or a block name " +
    "(e.g. \"10% of the final grade (VSK1)\"); whether students were already told the current policy; Canvas assignment groups and marks already sent " +
    (impact.canvas.resend.length ? "(" + impact.canvas.resend.join(", ") + " have marks in Canvas)" : "") +
    "; and whether the institution's rule still holds" +
    (doc && doc.description ? " — the run's own description says: " + doc.description.replace(/\s+/g, " ").slice(0, 400) : "") +
    ". List each place and what would need to change, then say whether you would apply it."
  );
};

function PresetStrip(props) {
  return h(
    "div",
    { className: "pp-gbpresets" },
    h("div", { className: "pp-reviewsec" }, "Start from a structure", h("span", null, "replaces the blocks below; you adjust from there")),
    h(
      "div",
      { className: "pp-gbpresetgrid" },
      props.presets.map((preset) => {
        const top = preset.components.filter((c) => !c.parent);
        return h(
          "button",
          { key: preset.id, type: "button", className: "pp-gbpreset", onClick: () => props.onChoose(preset), title: preset.summary },
          h("span", { className: "pp-gbpresethead" }, h("b", null, preset.title), h("span", { className: "pp-chip" }, FAMILY_WORDS[preset.family] || preset.family)),
          top.length
            ? h(
                "span",
                { className: "pp-gbbar pp-gbbar-mini" },
                top.map((c, i) => h("span", { key: c.component_id, className: "pp-gbseg pp-gbseg" + (i % 6), style: { flexGrow: c.weight } }, gpPct(c.weight))),
              )
            : h("span", { className: "pp-gbbar pp-gbbar-mini pp-gbbar-flat" }, "Σ weights"),
          h(
            "span",
            { className: "pp-as" },
            preset.components.length
              ? preset.components.map((c) => (c.parent ? "  " : "") + c.title).slice(0, 5).join(" · ") + (preset.components.length > 5 ? " …" : "")
              : preset.summary,
          ),
        );
      }),
    ),
  );
}

/** A percentage field over a 0..1 weight. Kept as text while typed, so "12." is not eaten. */
function WeightInput(props) {
  const shown = props.value === null || props.value === undefined ? "" : String(gpRound(Number(props.value) * 100, 4));
  const [text, setText] = React.useState(shown);
  React.useEffect(() => {
    if (Number(text) !== Number(shown) || (text === "") !== (shown === "")) setText(shown);
  }, [shown]);
  return h(
    "span",
    { className: "pp-gbpctfield" },
    h("input", {
      className: "pp-gbinput pp-gbnum",
      inputMode: "decimal",
      value: text,
      "aria-label": props.label,
      onChange: (event) => {
        const raw = event.target.value.replace(",", ".");
        setText(raw);
        if (raw.trim() === "") return props.onChange(null);
        const value = Number(raw);
        if (Number.isFinite(value)) props.onChange(gpRound(value / 100, 12));
      },
    }),
    "%",
  );
}

function BlockEditor(props) {
  const draft = props.draft;
  const ids = draft.components.map((c) => c.component_id);
  const set = (index, field, value) =>
    props.update((next) => {
      const was = next.components[index].component_id;
      next.components[index][field] = value;
      if (field === "component_id") {
        // A renamed id carries its sub-blocks and its work with it.
        for (const c of next.components) if (c.parent === was) c.parent = value;
        for (const key of Object.keys(next.assignments)) if (next.assignments[key].component === was) next.assignments[key].component = value;
      }
      return next;
    });
  const remove = (id) =>
    props.update((next) => {
      const gone = next.components.find((c) => c.component_id === id);
      next.components = next.components.filter((c) => c.component_id !== id);
      // What was inside moves up to the removed block's parent rather than vanishing.
      for (const c of next.components) if (c.parent === id) c.parent = gone.parent || null;
      for (const key of Object.keys(next.assignments)) if (next.assignments[key].component === id) next.assignments[key].component = gone.parent || null;
      return next;
    });
  const add = (parent) =>
    props.update((next) => {
      let n = next.components.length + 1;
      while (next.components.some((c) => c.component_id === "BLOCK" + n)) n += 1;
      next.components.push({ component_id: "BLOCK" + n, title: "New block", weight: 0, parent: parent || null, points: null });
      return next;
    });
  /** Scale what is inside a block, keeping its proportions, so it fills the block exactly. */
  const fit = (id) =>
    props.update((next) => {
      const block = next.components.find((c) => c.component_id === id);
      const children = next.components.filter((c) => c.parent === id);
      const room = Math.max(0, Number(block.weight) - children.reduce((sum, c) => sum + Number(c.weight || 0), 0));
      const members = Object.keys(next.assignments).filter((key) => next.assignments[key].component === id);
      const sum = members.reduce((total, key) => total + Number(next.assignments[key].weight || 0), 0);
      for (const key of members) next.assignments[key].weight = gpRound(sum > 0 ? (Number(next.assignments[key].weight || 0) / sum) * room : room / members.length, 12);
      return next;
    });
  const topSum = draft.components.filter((c) => !c.parent).reduce((sum, c) => sum + Number(c.weight || 0), 0);

  return h(
    "div",
    { className: "pp-gbeditsec" },
    h(
      "div",
      { className: "pp-reviewsec" },
      "Blocks",
      h("span", { className: draft.components.length && !gpClose(topSum, 1) ? "pp-behind" : "" }, draft.components.length ? "top level adds up to " + gpPct(topSum) : "none — the grade is the sum of the assessments' weights"),
      h("button", { type: "button", className: "pp-segbtn", onClick: () => add(null) }, "+ Block"),
    ),
    draft.components.length
      ? h(
          "div",
          { className: "pp-gbblocks" },
          h("div", { className: "pp-gbblockrow pp-gbblockhead" }, h("span", null, "Id"), h("span", null, "Title"), h("span", null, "Weight"), h("span", null, "Inside"), h("span", null, "Out of"), h("span", null, "Inside it"), h("span", null)),
          gpTree(draft.components).map((entry) => {
            const c = entry.component;
            const index = draft.components.indexOf(c);
            const filled = gpFilled(draft, c.component_id);
            const used = draft.components.some((x) => x.parent === c.component_id) || Object.values(draft.assignments).some((a) => a.component === c.component_id);
            return h(
              "div",
              { key: index, className: "pp-gbblockrow", style: { paddingLeft: entry.depth * 16 + "px" } },
              h("input", { className: "pp-gbinput pp-gbid", value: c.component_id, "aria-label": "Block id", onChange: (e) => set(index, "component_id", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")) }),
              h("input", { className: "pp-gbinput", value: c.title, "aria-label": "Block title", onChange: (e) => set(index, "title", e.target.value) }),
              h(WeightInput, { value: c.weight, label: c.component_id + " weight", onChange: (v) => set(index, "weight", v === null ? 0 : v) }),
              h(
                "select",
                { className: "pp-gbinput", value: c.parent || "", "aria-label": "Inside", onChange: (e) => set(index, "parent", e.target.value || null) },
                h("option", { value: "" }, "— top —"),
                ids.filter((id) => id !== c.component_id).map((id) => h("option", { key: id, value: id }, id)),
              ),
              h("input", {
                className: "pp-gbinput pp-gbnum",
                value: c.points === null || c.points === undefined ? "" : String(c.points),
                placeholder: "—",
                inputMode: "decimal",
                "aria-label": "Out of, in the LMS",
                title: "What this block is out of in the LMS journal — ВСК is out of 100. Empty: no scale of its own.",
                onChange: (e) => set(index, "points", e.target.value.trim() === "" ? null : Number(e.target.value)),
              }),
              h(
                "span",
                { className: "pp-gbfill" },
                used
                  ? gpClose(filled, Number(c.weight))
                    ? h("span", { className: "pp-gbsum pp-gbsum-ok" }, "✓ " + gpPct(filled))
                    : h(
                        React.Fragment,
                        null,
                        h("span", { className: "pp-gbsum pp-gbsum-off" }, gpPct(filled)),
                        Object.values(draft.assignments).some((a) => a.component === c.component_id)
                          ? h("button", { type: "button", className: "pp-linkbtn", title: "Scale this block's assessments, keeping their proportions, so they fill it exactly", onClick: () => fit(c.component_id) }, "fit")
                          : null,
                      )
                  : h("span", { className: "pp-as" }, "empty"),
              ),
              h(
                "span",
                { className: "pp-gbrowbtns" },
                h("button", { type: "button", className: "pp-linkbtn", title: "Add a block inside " + c.component_id, onClick: () => add(c.component_id) }, "+ inside"),
                h("button", { type: "button", className: "pp-close", "aria-label": "Remove " + c.component_id, title: "Remove — what is inside moves up a level", onClick: () => remove(c.component_id) }, "×"),
              ),
            );
          }),
        )
      : null,
    h(
      "label",
      { className: "pp-gbcoursepoints" },
      "The whole course is out of ",
      h("input", {
        className: "pp-gbinput pp-gbnum",
        value: draft.points === null || draft.points === undefined ? "" : String(draft.points),
        placeholder: "—",
        inputMode: "decimal",
        onChange: (e) => props.update((next) => ((next.points = e.target.value.trim() === "" ? null : Number(e.target.value)), next)),
      }),
      h("span", { className: "pp-as" }, " in the LMS (empty: each assessment out of its own maximum unless a block sets a scale)"),
    ),
  );
}

function FilingEditor(props) {
  const draft = props.draft;
  const options = gpTree(draft.components).map((entry) => ({ id: entry.component.component_id, label: "  ".repeat(entry.depth) + entry.component.component_id + " · " + entry.component.title }));
  const total = Object.values(draft.assignments).reduce((sum, a) => sum + Number(a.weight || 0), 0);
  const set = (id, field, value) => props.update((next) => ((next.assignments[id][field] = value), next));
  return h(
    "div",
    { className: "pp-gbeditsec" },
    h("div", { className: "pp-reviewsec" }, "Assessments", h("span", { className: gpClose(total, 1) ? "" : "pp-behind" }, "weights add up to " + gpPct(total))),
    h(
      "div",
      { className: "pp-gbfiling" },
      props.assessments.map((a) => {
        const now = draft.assignments[a.assessment_id] || { component: null, weight: null };
        return h(
          "div",
          { key: a.assessment_id, className: "pp-gbfilerow" },
          h(
            "span",
            { className: "pp-gbfiletitle" },
            h("span", { className: "pp-titletext", title: a.assessment_id }, a.title),
            h("span", { className: "pp-as" }, (a.type || "") + (a.due_at ? " · due " + String(a.due_at).slice(0, 10) : " · undated")),
            a.draft ? h("span", { className: "pp-chip pp-chip-warn" }, "draft") : null,
            a.sent ? h("span", { className: "pp-chip pp-chip-live", title: a.sent + " marks already in Canvas" }, "Canvas " + a.sent) : null,
          ),
          draft.components.length
            ? h(
                "select",
                { className: "pp-gbinput", value: now.component || "", "aria-label": a.title + " block", onChange: (e) => set(a.assessment_id, "component", e.target.value || null) },
                h("option", { value: "" }, "— none —"),
                options.map((o) => h("option", { key: o.id, value: o.id }, o.label)),
              )
            : null,
          h(WeightInput, { value: now.weight, label: a.title + " weight", onChange: (v) => set(a.assessment_id, "weight", v) }),
        );
      }),
    ),
  );
}

function ImpactReport(props) {
  const impact = props.impact;
  if (impact.nothing) return h("div", { className: "pp-as" }, "Nothing changes yet. Pick a structure or edit a block.");
  const section = (title, body) => h("div", { className: "pp-gbimpactsec" }, h("div", { className: "pp-reviewsec" }, title), body);
  return h(
    "div",
    null,
    props.before && props.after ? h(PolicyDiff, { before: props.before, after: props.after, assessments: props.assessments }) : null,
    h(
      "details",
      { className: "pp-gbwords", open: !(props.before && props.after) },
      h("summary", null, "In words"),
      h("ul", { className: "pp-gbsummary pp-gbsummary-big" }, impact.summary.map((line, i) => h("li", { key: i }, line))),
    ),
    impact.errors.length
      ? section("Would not hold together", h("ul", { className: "pp-gbissues" }, impact.errors.map((e, i) => h("li", { key: i, className: "pp-gbissue-err" }, (e.location ? e.location + ": " : "") + e.message))))
      : null,
    impact.issues.introduced.length
      ? section("New warnings", h("ul", { className: "pp-gbissues" }, impact.issues.introduced.filter((e) => e.level !== "error").map((e, i) => h("li", { key: i }, (e.location ? e.location + ": " : "") + e.message))))
      : null,
    impact.issues.fixed.length ? section("Fixed", h("ul", { className: "pp-gbissues pp-gbissues-fixed" }, impact.issues.fixed.map((e, i) => h("li", { key: i }, "✓ " + e.message)))) : null,
    impact.lms.length
      ? section(
          "Out of in Canvas",
          h(
            "table",
            { className: "pp-sheet pp-gbtable" },
            h("thead", null, h("tr", null, h("th", null, "Assessment"), h("th", null, "Now"), h("th", null, "After"), h("th", null, "Marks in Canvas"))),
            h(
              "tbody",
              null,
              impact.lms.map((row) =>
                h(
                  "tr",
                  { key: row.assessment_id, className: row.sent ? "pp-gbhot" : "" },
                  h("td", null, row.title),
                  h("td", null, row.from === null ? "—" : gpRound(row.from, 2)),
                  h(
                    "td",
                    null,
                    row.dropped
                      ? h("span", { className: "pp-as" }, "not counted")
                      : row.to === null
                        ? h("span", { className: "pp-behind", title: row.problem || "" }, "cannot scale")
                        : gpRound(row.to, 2),
                  ),
                  h("td", null, row.sent ? h("span", { className: "pp-chip pp-chip-live" }, row.sent + " to resend") : "—"),
                ),
              ),
            ),
          ),
        )
      : null,
    impact.canvas.needs_group.length || impact.canvas.orphan_groups.length
      ? section(
          "Canvas assignment groups",
          h(
            "div",
            { className: "pp-as" },
            impact.canvas.needs_group.length ? h("div", null, "Need a group before work can be pushed: " + impact.canvas.needs_group.join(", ") + " — Integrations · Canvas, or `ainar lms groups`.") : null,
            impact.canvas.orphan_groups.length ? h("div", null, "Linked groups no block uses any more: " + impact.canvas.orphan_groups.join(", ") + ".") : null,
          ),
        )
      : null,
    impact.students.changed
      ? section(
          "Students' running totals (" + impact.students.changed + " of " + impact.students.of + " move)",
          h(
            React.Fragment,
            null,
            h(
            "table",
            { className: "pp-sheet pp-gbtable" },
            h("thead", null, h("tr", null, h("th", null, "Student"), h("th", null, "Now"), h("th", null, "After"), h("th", null, "Δ"), h("th", null, "Blocks after"))),
            h(
              "tbody",
              null,
              impact.students.rows.slice(0, 25).map((row) =>
                h(
                  "tr",
                  { key: row.student_id },
                  h("td", null, row.name || row.student_id),
                  h("td", null, row.from === null ? "—" : row.from),
                  h("td", null, row.to),
                  h("td", { className: row.delta < 0 ? "pp-gbdown" : row.delta > 0 ? "pp-gbup" : "" }, (row.delta > 0 ? "+" : "") + row.delta),
                  h("td", { className: "pp-as" }, row.blocks.map((b) => b.component_id + " " + (b.to === null ? "—" : gpRound(b.to, 2)) + (b.out_of ? "/" + b.out_of : "")).join(" · ")),
                ),
              ),
            ),
          ),
          impact.students.changed > 25 ? h("div", { className: "pp-as" }, "… and " + (impact.students.changed - 25) + " more. Totals are what has been graded so far, out of 100.") : h("div", { className: "pp-as" }, "Totals are what has been graded so far, out of 100."),
          ),
        )
      : null,
  );
}

// ---------------------------------------------------------------- the diff

/**
 * Two policies compared, for people. Blocks in the tree order of the new
 * policy, with every removed block shown where it was; each block marked new,
 * removed, changed or the same, and what changed on it. Assessments that move
 * are grouped by where they go from and to, because "four quizzes ВСК2 →
 * Quizzes" is one decision; a weight change is its own list, largest first.
 */
const gpDiff = (before, after) => {
  const was = new Map(before.components.map((c) => [c.component_id, c]));
  const now = new Map(after.components.map((c) => [c.component_id, c]));
  const blocks = [];
  const oldDepth = new Map(gpTree(before.components).map((entry) => [entry.component.component_id, entry.depth]));
  for (const entry of gpTree(after.components)) {
    const c = entry.component;
    const old = was.get(c.component_id);
    const changes = [];
    if (old) {
      if (Math.abs(Number(old.weight) - Number(c.weight)) > 1e-9) changes.push({ what: "weight", from: gpPct(old.weight), to: gpPct(c.weight) });
      if ((old.points || null) !== (c.points || null)) changes.push({ what: "out of", from: old.points || "—", to: c.points || "—" });
      if ((old.parent || null) !== (c.parent || null)) changes.push({ what: "inside", from: old.parent || "top", to: c.parent || "top" });
      if (old.title !== c.title) changes.push({ what: "title", from: old.title, to: c.title });
    }
    blocks.push({ id: c.component_id, title: c.title, weight: c.weight, depth: entry.depth, status: !old ? "added" : changes.length ? "changed" : "same", changes: changes });
  }
  for (const c of before.components) {
    if (now.has(c.component_id)) continue;
    blocks.push({ id: c.component_id, title: c.title, weight: c.weight, depth: oldDepth.get(c.component_id) || 0, status: "removed", changes: [] });
  }
  const moves = new Map();
  const weights = [];
  for (const id of Object.keys(after.assignments)) {
    const from = before.assignments[id] || { component: null, weight: null };
    const to = after.assignments[id];
    if ((from.component || null) !== (to.component || null)) {
      const key = (from.component || "") + "→" + (to.component || "");
      if (!moves.has(key)) moves.set(key, { from: from.component || null, to: to.component || null, ids: [] });
      moves.get(key).ids.push(id);
    }
    const a = from.weight === null || from.weight === undefined ? null : Number(from.weight);
    const b = to.weight === null || to.weight === undefined ? null : Number(to.weight);
    if (a !== b && !(a !== null && b !== null && Math.abs(a - b) < 1e-9)) weights.push({ id: id, from: a, to: b, dropped: !b });
  }
  weights.sort((x, y) => Math.abs((y.to || 0) - (y.from || 0)) - Math.abs((x.to || 0) - (x.from || 0)));
  const pointsChanged = (before.points || null) !== (after.points || null);
  return {
    blocks: blocks,
    moves: [...moves.values()],
    weights: weights,
    points: pointsChanged ? { from: before.points || "—", to: after.points || "—" } : null,
    empty: !blocks.some((b) => b.status !== "same") && !moves.size && !weights.length && !pointsChanged,
  };
};

const DIFF_MARK = { added: "+", removed: "−", changed: "~", same: "" };

/** The top-level split as one bar, the blocks that changed outlined. */
function DiffBar(props) {
  const top = props.components.filter((c) => !c.parent);
  if (!top.length) return h("span", { className: "pp-gbbar pp-gbbar-mini pp-gbbar-flat" }, "no blocks — Σ weights");
  return h(
    "span",
    { className: "pp-gbbar pp-gbbar-mini" },
    top.map((c, i) =>
      h(
        "span",
        {
          key: c.component_id,
          className: "pp-gbseg pp-gbseg" + (i % 6) + (props.marked && props.marked.has(c.component_id) ? " pp-gbseg-marked" : ""),
          style: { flexGrow: Math.max(Number(c.weight) || 0, 0.0001) },
          title: c.title + " " + gpPct(c.weight),
        },
        c.component_id + " " + gpPct(c.weight),
      ),
    ),
  );
}

function PolicyDiff(props) {
  const diff = gpDiff(props.before, props.after);
  const titles = new Map((props.assessments || []).map((a) => [a.assessment_id, a.title]));
  const name = (id) => titles.get(id) || id;
  const blockName = (id) => (id ? id : "no block");
  if (diff.empty) return h("div", { className: "pp-as" }, "Same as the current policy.");
  const marked = new Set(diff.blocks.filter((b) => b.status !== "same").map((b) => b.id));
  const shownBlocks = props.compact ? diff.blocks.filter((b) => b.status !== "same") : diff.blocks;
  const weights = props.compact ? diff.weights.slice(0, 6) : diff.weights;
  const maxWeight = Math.max(0.0001, ...diff.weights.map((w) => Math.max(w.from || 0, w.to || 0)));

  return h(
    "div",
    { className: "pp-gbdiff" + (props.compact ? " pp-gbdiff-compact" : "") },
    h(
      "div",
      { className: "pp-gbdiffbars" },
      h("span", { className: "pp-gbdifflabel" }, "Now"),
      h(DiffBar, { components: props.before.components }),
      h("span", { className: "pp-gbdifflabel" }, "After"),
      h(DiffBar, { components: props.after.components, marked: marked }),
    ),
    diff.points ? h("div", { className: "pp-gbdiffline pp-gbd-changed" }, h("b", null, "~"), " The course is out of " + diff.points.from + " → " + diff.points.to + " in the LMS") : null,
    shownBlocks.length
      ? h(
          "div",
          { className: "pp-gbdiffsec" },
          props.compact ? null : h("div", { className: "pp-gbdiffhead" }, "Blocks"),
          shownBlocks.map((b) =>
            h(
              "div",
              { key: b.status + b.id, className: "pp-gbdiffline pp-gbd-" + b.status, style: { paddingLeft: 6 + b.depth * 14 + "px" } },
              h("b", { className: "pp-gbdmark", "aria-label": b.status }, DIFF_MARK[b.status]),
              h("span", { className: "pp-tag" }, b.id),
              h("span", { className: "pp-gbdtitle" }, b.title),
              b.status === "same" || b.status === "removed" || b.status === "added"
                ? h("span", { className: "pp-gbdval" }, gpPct(b.weight))
                : null,
              b.changes.map((c, i) =>
                h("span", { key: i, className: "pp-gbdchange" }, c.what + " ", h("s", null, String(c.from)), " → ", h("b", null, String(c.to))),
              ),
              b.status === "removed" ? h("span", { className: "pp-as" }, "removed") : b.status === "added" ? h("span", { className: "pp-as" }, "new") : null,
            ),
          ),
        )
      : null,
    diff.moves.length
      ? h(
          "div",
          { className: "pp-gbdiffsec" },
          h("div", { className: "pp-gbdiffhead" }, "Moves between blocks"),
          diff.moves.map((m) =>
            h(
              "div",
              { key: (m.from || "") + (m.to || ""), className: "pp-gbmove" },
              h("span", { className: "pp-gbmoveroute" }, h("span", { className: m.from ? "pp-tag" : "pp-as" }, blockName(m.from)), " → ", h("span", { className: m.to ? "pp-tag" : "pp-gbissue-err" }, blockName(m.to))),
              h(
                "span",
                { className: "pp-gbmoveitems" },
                (props.compact ? m.ids.slice(0, 5) : m.ids).map((id) => h("span", { key: id, className: "pp-gbmark" }, name(id))),
                props.compact && m.ids.length > 5 ? h("span", { className: "pp-as" }, "+" + (m.ids.length - 5)) : null,
              ),
            ),
          ),
        )
      : null,
    weights.length
      ? h(
          "div",
          { className: "pp-gbdiffsec" },
          h("div", { className: "pp-gbdiffhead" }, "Weights" + (props.compact && diff.weights.length > weights.length ? " (" + weights.length + " of " + diff.weights.length + ")" : "")),
          weights.map((w) =>
            h(
              "div",
              { key: w.id, className: "pp-gbwrow" + (w.dropped ? " pp-gbwrow-dropped" : "") },
              h("span", { className: "pp-titletext", title: w.id }, name(w.id)),
              h(
                "span",
                { className: "pp-gbwbars", "aria-hidden": "true" },
                h("span", { className: "pp-gbwbar pp-gbwbar-was", style: { width: ((w.from || 0) / maxWeight) * 100 + "%" } }),
                h("span", { className: "pp-gbwbar pp-gbwbar-now", style: { width: ((w.to || 0) / maxWeight) * 100 + "%" } }),
              ),
              h("span", { className: "pp-gbwnums" }, h("s", null, gpPct(w.from)), " → ", w.dropped ? h("b", { className: "pp-gbissue-err" }, "not counted") : h("b", null, gpPct(w.to))),
            ),
          ),
        )
      : null,
  );
}

// ---------------------------------------------------------------- the assistant

const ASSISTANT_EXAMPLES = [
  "Drop HW8 and spread its weight over the other ВСК 2 homework",
  "Make the quizzes 10% of each ВСК, taken from homework",
  "Switch to the admission rating (РК 1, РК 2, exam 40) and keep my filing",
  "Put both midterms in one Midterms block worth 20%",
];

/** How long the panel watches for the assistant's proposal after a request. */
const ASSISTANT_WAIT_MS = 8 * 60 * 1000;

/**
 * What the session is sent for a request: the skill, the run, the professor's
 * words, and the policy as it stands in the editor — unsaved edits included —
 * so "make it 25% instead" means 25% of what is on screen. Ids and weights only.
 */
const assistantPrompt = (runId, request, draft, doc) => {
  // Titles, so "quiz 4" maps to an id without opening a record.
  const titles = {};
  for (const a of (doc && doc.assessments) || []) titles[a.assessment_id] = a.title + (a.due_at ? " (due " + String(a.due_at).slice(0, 10) + ")" : "");
  return (
    "/grading-proposal " +
    runId +
    " — " +
    request.trim() +
    "\n\nFast path — everything you need is below. Unless the request names something that is not here, do not run help or validate and do not open records: " +
    "write the whole policy to a temp file and record it" +
    (doc && doc.propose_command
      ? " with exactly:\n" + doc.propose_command
      : " with bin/ainar grading propose " + runId + " --file FILE --request WORDS --note WHY") +
    "\nIts output is the check; do not verify again. Then answer in one sentence." +
    "\nChange only what was asked: every assessment keeps its block unless the request moves it; dropping one is weight 0 in the same block." +
    "\n\nAssessment titles: " +
    JSON.stringify(titles) +
    "\n\nThe policy as it stands in the Gradebook editor (unsaved edits included) — propose against this, as a whole policy:\n```json\n" +
    JSON.stringify({ components: draft.components, points: draft.points, assignments: draft.assignments }) +
    "\n```"
  );
};

function AssistantPanel(props) {
  const [text, setText] = React.useState("");
  const [waiting, setWaiting] = React.useState(null); // { since, known: Set, request }
  const [sent, setSent] = React.useState([]); // this editor's requests, newest last
  const known = (props.proposals || []).map((p) => p.id);
  // A clock while waiting: a long silence reads as broken, a counting one as work.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [waiting]);
  const elapsed = waiting ? Math.floor((Date.now() - waiting.since) / 1000) : 0;
  const clock = Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0");

  // While a request is out, ask every three seconds whether a proposal arrived.
  React.useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => {
      if (Date.now() - waiting.since > ASSISTANT_WAIT_MS) {
        setWaiting(null);
        return;
      }
      props.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting]);
  React.useEffect(() => {
    if (waiting && known.some((id) => !waiting.known.has(id))) {
      setWaiting(null);
      const fresh = props.proposals.filter((p) => !waiting.known.has(p.id)).pop();
      // The answer to what was just asked goes straight into the editor; the
      // diff and the impact are what the professor reads next.
      if (fresh && !fresh.stale) props.onLoad(fresh);
    }
  }, [known.join(",")]);

  const send = () => {
    const request = text.trim();
    if (!request || !props.ask) return;
    props.ask(assistantPrompt(props.runId, request, props.draft, props.doc));
    setSent((list) => list.concat([{ at: new Date().toISOString(), request: request }]));
    setWaiting({ since: Date.now(), known: new Set(known), request: request });
    setText("");
  };

  const cards = [...(props.proposals || [])].reverse();
  return h(
    "div",
    { className: "pp-modalpane pp-gbassist" },
    h("div", { className: "pp-modalpanelabel" }, "✦ Assistant — ask for a change in words"),
    h(
      "div",
      { className: "pp-review pp-gbthread" },
      !props.ask ? h(Message, { error: true }, "No session is open beside the pane, so there is nobody to ask. Open one and come back.") : null,
      !cards.length && !waiting
        ? h(
            "div",
            { className: "pp-as pp-gbassisthint" },
            "Say what you want; the assistant reads the course and proposes a whole policy. It never writes the policy — you load a proposal, read the diff and the impact, and apply it yourself.",
            h(
              "div",
              { className: "pp-gbexamples" },
              ASSISTANT_EXAMPLES.map((example) => h("button", { key: example, type: "button", className: "pp-gbexample", onClick: () => setText(example) }, example)),
            ),
          )
        : null,
      waiting
        ? h(
            "div",
            { className: "pp-gbwaiting", role: "status" },
            h("span", { className: "pp-checkspin" }),
            h("span", null, h("b", null, "Asked: "), "“" + waiting.request + "” — the assistant is working on it (" + clock + "). Its proposal appears here and opens in the editor; the conversation shows each step."),
            h("button", { type: "button", className: "pp-linkbtn", onClick: () => setWaiting(null) }, "stop waiting"),
          )
        : null,
      cards.map((entry) =>
        h(
          "div",
          { key: entry.id, className: "pp-gbcard" + (props.loaded === entry.id ? " pp-gbcard-loaded" : "") + (entry.stale ? " pp-gbcard-stale" : "") },
          h(
            "div",
            { className: "pp-gbcardhead" },
            h("b", null, "Proposal " + entry.id),
            h("span", { className: "pp-gbwhen" }, when(entry.at) || ""),
            props.loaded === entry.id ? h("span", { className: "pp-chip pp-chip-ok" }, "in the editor") : null,
            entry.stale ? h("span", { className: "pp-chip pp-chip-warn", title: "The policy changed after this was proposed" }, "made for an older policy") : null,
          ),
          entry.request ? h("div", { className: "pp-gbyou" }, h("span", { className: "pp-as" }, "You: "), entry.request) : null,
          entry.note ? h("div", { className: "pp-gbwhy" }, h("span", { className: "pp-as" }, "Why: "), entry.note) : null,
          h(PolicyDiff, { before: props.doc.policy, after: entry.proposal, assessments: props.doc.assessments, compact: true }),
          h(
            "div",
            { className: "pp-gbrow" },
            h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onDiscard(entry) }, "Discard"),
            h("button", { type: "button", className: "pp-primary", disabled: props.loaded === entry.id, onClick: () => props.onLoad(entry) }, props.loaded === entry.id ? "Loaded" : "Load into editor"),
          ),
        ),
      ),
      sent.length && !waiting && cards.length === 0
        ? h("div", { className: "pp-as" }, "No proposal came back. The session may have asked you something — look at the conversation.")
        : null,
    ),
    h(
      "div",
      { className: "pp-gbcompose" },
      h("textarea", {
        className: "pp-gbinput pp-gbask",
        rows: 3,
        placeholder: "e.g. drop HW8 and give its weight to the final project",
        value: text,
        disabled: !props.ask,
        onChange: (e) => setText(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        },
      }),
      h(
        "div",
        { className: "pp-gbrow" },
        h("span", { className: "pp-as", style: { flex: 1 } }, "Ctrl+Enter sends. Ids and weights only — no names."),
        h("button", { type: "button", className: "pp-primary", disabled: !props.ask || !text.trim() || Boolean(waiting), onClick: send }, waiting ? "Waiting…" : "Ask"),
      ),
    ),
  );
}
