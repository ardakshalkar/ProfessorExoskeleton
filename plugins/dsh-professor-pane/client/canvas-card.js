/**
 * The Canvas card on Integrations → This course: whether this run can reach
 * Canvas, and, per assessment, where its Canvas column, its definition and
 * its marks stand.
 *
 * It replaces four places that each held a slice of the same answer —
 * Status's checklist, Targets' host and course, Links' sections, column list
 * and definition push, and the per-assessment Syncs cards, each with its own
 * picker of every assessment. A professor asking "is Quiz 4 in Canvas" had to
 * visit three of them. Now the assessment is the row and everything about it
 * opens under it.
 *
 * No new route. The card reads `/api/integrations` and `/api/unpublished`,
 * and each row's panel uses the presses those views already had: the marks
 * send from Scans, the definition push from Links, the link writer from the
 * binder. The rules that make those safe — preview before send, the red button
 * only for what leaves the machine, drift needing its own press — come with
 * them unchanged.
 */

import {
  AssignmentBinder,
  Fact,
  Presence,
  ProviderSetup,
  Secret,
  SubgroupCourses,
} from "./integration-parts.js";
import { CanvasMarks } from "./marks.js";
import { h, React } from "./react.js";
import { when } from "./syncs.js";
import { BASE, scoped } from "./tabs.js";

/** `https://canvas.example.edu/` → `canvas.example.edu`. */
const hostName = (url) =>
  String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

/** `7 Oct`, for a row that has room for a date and nothing else. */
const shortDate = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString([], { day: "numeric", month: "short" });
};

/**
 * The Canvas courses this run is taught in, keyed by subgroup — or by "" for
 * a run that is one Canvas course. Empty when none is recorded.
 */
const canvasCoursesOf = (data) => {
  const perSubgroup = data.subgroupCourses || { map: {}, perSubgroup: false };
  if (perSubgroup.perSubgroup) return perSubgroup.map;
  return data.canvasCourse && data.canvasCourse.id ? { "": data.canvasCourse.id } : {};
};

/** Which of the run's Canvas courses this assessment has a column in. */
const columnsOf = (assessment, courses) => {
  const groups = Object.keys(courses);
  if (groups.length === 1 && groups[0] === "") {
    return { "": assessment.canvasAssignmentId || null };
  }
  const out = {};
  for (const group of groups) out[group] = (assessment.canvasAssignments || {})[group] || null;
  return out;
};

const assignmentUrl = (host, courseId, assignmentId) =>
  host && courseId && assignmentId
    ? String(host).replace(/\/+$/, "") + "/courses/" + courseId + "/assignments/" + assignmentId
    : null;

/** Due date first, undated last, then by title: the order a term is taught in. */
const byDue = (left, right) =>
  String(left.a.dueAt || "9999").localeCompare(String(right.a.dueAt || "9999")) ||
  String(left.a.title || left.a.assessmentId).localeCompare(String(right.a.title || right.a.assessmentId));

/** A press to `/api/syncs/action`, answered with the CLI's own words. */
const postSync = (runId, sessionId, body) =>
  fetch(scoped(BASE + "/api/syncs/action?run=" + encodeURIComponent(runId || ""), sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String((error && error.message) || error) }));

/**
 * One sync that only reads from Canvas — the class list, or one assessment's
 * hand-ins — as a line with Preview and Run. Nothing it does reaches students,
 * so Run needs no preview first; a sync that does is not drawn here.
 */
function CanvasRead(props) {
  const [busy, setBusy] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const sync = props.sync;
  if (!sync) return null;

  const press = (action) => {
    setBusy(action);
    postSync(props.runId, props.sessionId, {
      action,
      sync: sync.id,
      assessment: props.assessmentId || "",
      confirm: false,
      names: Boolean(props.names),
    }).then((answer) => {
      setBusy(null);
      setResult(Object.assign({ action }, answer));
      if (action === "run" && props.onWrite) props.onWrite();
    });
  };

  return h(
    "div",
    { className: "pp-cread" },
    h(
      "div",
      { className: "pp-creadline" },
      h(
        "span",
        { className: "pp-creadname" },
        props.label,
        h(
          "span",
          { className: "pp-as" },
          // The last run is per sync, not per assessment, so a hand-ins line
          // under one assessment says nothing about when: it would be the date
          // some other assessment's hand-ins came in.
          props.assessmentId ? "" : sync.lastSynced ? " · " + when(sync.lastSynced) : " · never",
        ),
      ),
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: Boolean(busy), onClick: () => press("plan") },
        busy === "plan" ? "Looking…" : "Preview",
      ),
      sync.live
        ? null
        : h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: Boolean(busy) || !sync.enabled,
              onClick: () => press("run"),
            },
            busy === "run" ? "Running…" : "Run",
          ),
    ),
    result
      ? h(
          "pre",
          { className: "pp-approveout" + (result.error || !result.ok ? " pp-approveerr" : "") },
          (result.error ? "" : result.action === "run" ? "Done.\n" : "Preview — nothing was changed.\n") +
            (result.error || result.output || "(nothing printed)"),
        )
      : null,
  );
}

/**
 * Sending an assessment's DEFINITION to Canvas — its title, points, dates,
 * what may be handed in, and the brief as the description.
 *
 * Moved here from the Links view, where it chose the assessment from a list;
 * on the card it sits under the assessment's own row and that choice is made.
 * Everything else about it is as it was, and each rule is the reason for a
 * shape:
 *
 * * **preview first, always.** The send button does not exist until a plan
 *   has come back, and the plan is the CLI's own words.
 * * **the send button is the only red thing here**, the pane's signal for a
 *   press that writes outside this machine.
 * * **drift needs its own press.** A field somebody edited in Canvas is left
 *   alone; replacing it is a checkbox that appears only when the plan reported
 *   drift, cleared after every send so it cannot carry into the next one.
 * * **every subgroup by default**, which is what the command does: one
 *   definition serves the class, and a send that reached CS-401 and not CS-402
 *   is how two halves end up being told different things.
 */
function DefinitionPush(props) {
  const subgroups = (props.subgroups || []).map((entry) => entry.group);
  const [group, setGroup] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [result, setResult] = React.useState(null);
  const [overwrite, setOverwrite] = React.useState(false);

  // A plan belongs to the subgroup it was asked about. Changing it throws the
  // plan away, so the red button can never send something other than what
  // was read.
  const reset = () => {
    setResult(null);
    setOverwrite(false);
  };

  const call = (confirm) => {
    setPhase(confirm ? "sending" : "planning");
    fetch(
      scoped(BASE + "/api/canvas/assignment?run=" + encodeURIComponent(props.runId || ""), props.sessionId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessment: props.assessmentId,
          group,
          confirm,
          overwriteDrift: confirm && overwrite,
        }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        setPhase("idle");
        if (body.error) {
          setResult({ failed: true, text: body.error, sent: false });
          return;
        }
        setResult({
          failed: !body.ok,
          text: body.output || (body.ok ? "Canvas had nothing to change." : "No output."),
          sent: confirm && body.ok,
        });
        // A send consumes the preview: what is on screen now describes a
        // state that no longer exists.
        if (confirm) {
          setOverwrite(false);
          // A created assignment's id was written into the record.
          if (body.ok && props.onWrite) props.onWrite();
        }
      })
      .catch((error) => {
        setPhase("idle");
        setResult({ failed: true, text: String((error && error.message) || error), sent: false });
      });
  };

  const sawDrift = Boolean(result) && !result.failed && /edited in Canvas/.test(result.text);
  const previewed = Boolean(result) && !result.failed && !result.sent;

  return h(
    "div",
    null,
    h(
      "div",
      { className: "pp-approverow" },
      subgroups.length
        ? h(
            "select",
            {
              className: "pp-bindsel",
              value: group,
              "aria-label": "Which subgroup's Canvas course",
              onChange: (event) => {
                setGroup(event.target.value);
                reset();
              },
            },
            [h("option", { value: "", key: "*" }, "Every subgroup")].concat(
              subgroups.map((name) => h("option", { value: name, key: name }, name)),
            ),
          )
        : null,
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: phase !== "idle", onClick: () => call(false) },
        phase === "planning" ? "Asking Canvas…" : "Preview what Canvas would get",
      ),
      previewed
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn pp-danger",
              disabled: phase !== "idle",
              onClick: () => call(true),
            },
            phase === "sending" ? "Sending…" : "Send to Canvas",
          )
        : null,
    ),
    sawDrift
      ? h(
          "label",
          { className: "pp-savenote" },
          h("input", {
            type: "checkbox",
            checked: overwrite,
            onChange: (event) => setOverwrite(event.target.checked),
          }),
          " Also replace what was edited in Canvas",
        )
      : null,
    result
      ? h("pre", { className: "pp-approveout" + (result.failed ? " pp-approveerr" : "") }, result.text)
      : null,
  );
}

/**
 * Which Canvas assignment this assessment is, in each of the run's courses.
 *
 * One course at a time: each is asked for its own assignment list only when
 * the professor presses Choose, because the list costs a Canvas request with
 * their token. What is saved is the whole mapping for this assessment — the
 * writer replaces it wholesale, and sending only the course being edited
 * would unbind the others.
 */
function ColumnLinks(props) {
  const { assessment, courses, host } = props;
  const columns = columnsOf(assessment, courses);
  const single = Object.keys(courses).length === 1 && Object.keys(courses)[0] === "";
  const [lists, setLists] = React.useState({});
  const [picks, setPicks] = React.useState({});
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);

  const choose = (group) => {
    setLists((all) => Object.assign({}, all, { [group]: "loading" }));
    fetch(scoped(BASE + "/api/canvas/assignments?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: courses[group] }),
    })
      .then((response) => response.json())
      .then((body) =>
        setLists((all) => Object.assign({}, all, { [group]: body.error ? { error: body.error } : body.assignments || [] })),
      )
      .catch((error) => setLists((all) => Object.assign({}, all, { [group]: { error: String(error) } })));
  };

  const save = (group, value) => {
    setPhase("saving");
    setFailed(null);
    let link;
    if (single) link = value || null;
    else {
      const merged = Object.assign({}, assessment.canvasAssignments || {});
      if (value) merged[group] = value;
      else delete merged[group];
      link = Object.keys(merged).length ? merged : null;
    }
    fetch(scoped(BASE + "/api/canvas/assignment-map?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links: { [assessment.assessmentId]: link } }),
    })
      .then((response) => response.json())
      .then((body) => {
        setPhase("idle");
        if (body.error) return setFailed(body.error);
        setLists((all) => Object.assign({}, all, { [group]: undefined }));
        setPicks((all) => Object.assign({}, all, { [group]: undefined }));
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  return h(
    "div",
    null,
    Object.keys(columns).map((group) => {
      const id = columns[group];
      const list = lists[group];
      const url = assignmentUrl(host, courses[group], id);
      return h(
        "div",
        { className: "pp-bind", key: group || "run" },
        h("span", { className: "pp-bindname" }, group || "Canvas"),
        Array.isArray(list)
          ? h(
              React.Fragment,
              null,
              h(
                "select",
                {
                  className: "pp-bindsel",
                  value: picks[group] ?? id ?? "",
                  onChange: (event) => setPicks((all) => Object.assign({}, all, { [group]: event.target.value })),
                },
                h("option", { value: "" }, "— not linked —"),
                list.map((assignment) =>
                  h(
                    "option",
                    { value: assignment.id, key: assignment.id },
                    assignment.name + (assignment.points == null ? "" : " · " + assignment.points + " pts"),
                  ),
                ),
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  disabled: phase !== "idle" || (picks[group] ?? id ?? "") === (id ?? ""),
                  onClick: () => save(group, picks[group] ?? ""),
                },
                phase === "saving" ? "Saving…" : "Save",
              ),
            )
          : h(
              React.Fragment,
              null,
              h(
                "span",
                { className: "pp-ccol" + (id ? "" : " pp-no") },
                id
                  ? url
                    ? h("a", { href: url, target: "_blank", rel: "noreferrer", title: "Open it in Canvas" }, id + " ↗")
                    : id
                  : "not linked",
              ),
              list && list.error
                ? h("span", { className: "pp-saveerr" }, list.error)
                : h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      disabled: list === "loading",
                      title: "Ask Canvas for this course's assignments. A read; it sends your token.",
                      onClick: () => choose(group),
                    },
                    list === "loading" ? "Asking Canvas…" : id ? "Change…" : "Choose…",
                  ),
            ),
      );
    }),
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
  );
}

/**
 * Which Canvas section or student group feeds which subgroup of this run.
 *
 * Moved from the Links view unchanged in what it does. It lives in the card's
 * Details because it is set once, at the start of a term, and read by nobody
 * afterwards but the roster sync.
 */
function CanvasSections(props) {
  const data = props.data;
  const seed = (rows) => {
    const out = {};
    for (const row of rows || []) {
      out[row.kind + ":" + row.id] = { id: row.id, kind: row.kind, name: row.name, group: row.group };
    }
    return out;
  };
  const [catalogue, setCatalogue] = React.useState(null);
  const [fetching, setFetching] = React.useState(false);
  const [picked, setPicked] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const chosen = picked || seed(data.selections);
  const key = (option) => option.kind + ":" + option.id;

  // A Save hands back the record as it now is; start again from it.
  React.useEffect(() => setPicked(null), [data]);

  const load = () => {
    setFetching(true);
    setStatus(null);
    fetch(scoped(BASE + "/api/canvas/catalogue?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
    })
      .then((response) => response.json())
      .then((body) => {
        setFetching(false);
        if (body.error) return setStatus({ error: body.error });
        setCatalogue(body);
      })
      .catch((error) => {
        setFetching(false);
        setStatus({ error: String((error && error.message) || error) });
      });
  };

  const toggle = (option) =>
    setPicked(() => {
      const next = Object.assign({}, chosen);
      if (Object.hasOwn(next, key(option))) delete next[key(option)];
      else {
        next[key(option)] = {
          id: option.id,
          kind: option.kind,
          name: option.name,
          // One subgroup and nothing to decide: bind it.
          group: data.subgroups.length === 1 ? data.subgroups[0].group : null,
        };
      }
      return next;
    });

  const bind = (option, group) =>
    setPicked(() => {
      const next = Object.assign({}, chosen);
      if (!next[key(option)]) return next;
      next[key(option)] = Object.assign({}, next[key(option)], { group: group || null });
      return next;
    });

  const save = () => {
    setStatus("saving");
    fetch(scoped(BASE + "/api/canvas/selection?run=" + encodeURIComponent(props.runId || ""), props.sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selections: Object.values(chosen) }),
    })
      .then((response) => response.json())
      .then((body) => {
        if (body.error) return setStatus({ error: body.error });
        setStatus({ saved: body.saved });
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => setStatus({ error: String((error && error.message) || error) }));
  };

  // The live list once fetched, otherwise what the record holds, so a mapping
  // can be read and undone without spending a Canvas request.
  const offered = catalogue
    ? catalogue.options
    : data.selections.map((row) => ({ id: row.id, kind: row.kind, name: row.name || row.id, students: null, sisId: null }));

  // Order-insensitive, joined on NUL for `grading.js`'s reason: a section name
  // is free text and may hold any separator a registrar typed.
  const canonical = (table) =>
    Object.keys(table)
      .sort()
      .map((entry) => `${entry}\u0000${table[entry].group || ""}\u0000${table[entry].name || ""}`)
      .join("\u0000\u0000");
  const dirty = canonical(seed(data.selections)) !== canonical(chosen);

  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "Sections and groups"),
    h(
      "p",
      { className: "pp-as" },
      data.subgroups.length
        ? "Which Canvas section or student group feeds which subgroup. The class list sync reads this." +
            (data.ungrouped
              ? " " + data.ungrouped + " active student" + (data.ungrouped === 1 ? "" : "s") + " carry no subgroup."
              : "")
        : "This run has no subgroups, so a section ticked here only says it belongs to this run.",
    ),
    h(
      "div",
      { className: "pp-approverow" },
      h(
        "button",
        { type: "button", className: "pp-segbtn", disabled: fetching, onClick: load },
        fetching ? "Asking Canvas…" : catalogue ? "Fetch again" : "Fetch from Canvas",
      ),
      catalogue ? h("span", { className: "pp-savenote" }, catalogue.options.length + " in course " + catalogue.courseId) : null,
    ),
    offered.length === 0
      ? h("p", { className: "pp-as" }, catalogue ? "Canvas returned no sections or groups." : "Nothing is mapped yet.")
      : offered.map((option) => {
          const on = Object.hasOwn(chosen, key(option));
          return h(
            "div",
            { className: "pp-pick", key: key(option) },
            h("input", {
              type: "checkbox",
              className: "pp-pickbox",
              checked: on,
              onChange: () => toggle(option),
              "aria-label": option.name,
            }),
            h(
              "span",
              { className: "pp-picklabel" },
              option.name,
              h(
                "span",
                { className: "pp-factnote" },
                option.kind +
                  " " +
                  option.id +
                  (option.students == null ? "" : " · " + option.students + " students") +
                  (option.sisId ? " · SIS " + option.sisId : ""),
              ),
            ),
            on && data.subgroups.length
              ? h(
                  "select",
                  {
                    className: "pp-prefctl pp-picksel",
                    value: (chosen[key(option)] && chosen[key(option)].group) || "",
                    onChange: (event) => bind(option, event.target.value),
                    "aria-label": "Which subgroup " + option.name + " feeds",
                  },
                  [h("option", { value: "", key: "" }, "the whole run")].concat(
                    data.subgroups.map((entry) =>
                      h("option", { value: entry.group, key: entry.group }, entry.group + " (" + entry.students + ")"),
                    ),
                  ),
                )
              : null,
          );
        }),
    dirty || (status && (status.error || status.saved))
      ? h(
          "div",
          { className: "pp-approverow" },
          dirty
            ? h(
                "button",
                { type: "button", className: "pp-segbtn", disabled: status === "saving", onClick: save },
                status === "saving" ? "Saving…" : "Save",
              )
            : null,
          dirty
            ? h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  onClick: () => {
                    setPicked(null);
                    setStatus(null);
                  },
                },
                "Revert",
              )
            : null,
          status && status.error ? h("span", { className: "pp-saveerr" }, status.error) : null,
          status && status.saved && !dirty
            ? h("span", { className: "pp-savenote" }, "Saved to " + status.saved.path + ".")
            : null,
        )
      : null,
  );
}

/** One assessment's three states, as the pills its row has room for. */
const rowPills = (entry, reachable) => {
  const pills = [];
  const { linked, of } = entry.link;
  // Until Canvas can be reached there is no column to speak of either way.
  if (!reachable) {
    // nothing
  } else if (linked === of) {
    pills.push({ key: "col", text: "linked", tone: "ok" });
  } else {
    pills.push({ key: "col", text: linked ? linked + " of " + of + " linked" : "not linked", tone: "warn" });
  }
  pills.push(
    entry.a.definitionSent
      ? { key: "def", text: "brief sent " + shortDate(entry.a.definitionSent), tone: "" }
      : { key: "def", text: "brief not sent", tone: "quiet" },
  );
  const c = entry.u && entry.u.canvas;
  if (!c || c.ready === 0) pills.push({ key: "marks", text: "no marks yet", tone: "quiet" });
  else if (c.unsent + c.changed === 0) pills.push({ key: "marks", text: "all " + c.ready + " marks in", tone: "ok" });
  else pills.push({ key: "marks", text: c.unsent + c.changed + " marks to send", tone: "warn" });
  return pills;
};

/** What the card counts, for its own header and for the strip above it. */
export const canvasCounts = (data, unpublished) => {
  const courses = canvasCoursesOf(data);
  const usage = {};
  for (const entry of (unpublished && unpublished.assessments) || []) usage[entry.id] = entry;
  const rows = (data.assessments || []).map((a) => {
    const columns = columnsOf(a, courses);
    const ids = Object.values(columns);
    return {
      a,
      u: usage[a.assessmentId] || null,
      link: { linked: ids.filter(Boolean).length, of: Math.max(ids.length, 1) },
    };
  });
  rows.sort(byDue);
  const unlinked = rows.filter((entry) => entry.link.linked < entry.link.of);
  const toSend = rows.filter((entry) => entry.u && entry.u.canvas && entry.u.canvas.unsent + entry.u.canvas.changed > 0);
  return { courses, rows, unlinked, toSend };
};

/**
 * The card.
 *
 * `filter` comes from the strip above it, so "13 assessments have no Canvas
 * column → Show" lands on exactly those rows; `filterTick` makes the same
 * press work twice after the professor has changed the filter by hand.
 */
export function CanvasCard(props) {
  const data = props.data;
  const row = (data.integrations || []).find((entry) => entry.id === "canvas");
  const [filter, setFilter] = React.useState(props.filter || "all");
  const [open, setOpen] = React.useState(null);
  const [binding, setBinding] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [tokenError, setTokenError] = React.useState(null);
  React.useEffect(() => {
    if (props.filter) setFilter(props.filter);
  }, [props.filter, props.filterTick]);

  if (!row) return null;
  const [hostStep, tokenStep, courseStep] = row.steps;
  const reachable = hostStep.done && tokenStep.done && courseStep.done;
  const { courses, rows, unlinked, toSend } = canvasCounts(data, props.unpublished);
  const courseCount = Object.keys(courses).length;
  const subgroupCourses = data.subgroupCourses || { map: {}, perSubgroup: false, conflict: false };
  const rosterSync = props.syncs ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "roster") : null;
  const handInSync = props.syncs
    ? props.syncs.syncs.find((sync) => sync.service === "canvas" && sync.stream === "submissions")
    : null;

  const saved = (body) => {
    if (props.onSaved) props.onSaved(body);
  };

  const subtitle = [
    data.canvas.host ? hostName(data.canvas.host) : "no address",
    tokenStep.done ? "token saved" : "no token",
    subgroupCourses.perSubgroup
      ? courseCount + " course" + (courseCount === 1 ? "" : "s") + ", one per subgroup"
      : data.canvasCourse.id
        ? "course " + data.canvasCourse.id
        : "no course",
  ].join(" · ");

  const chip = !reachable
    ? { text: "setup needed", tone: "warn" }
    : unlinked.length
      ? { text: rows.length - unlinked.length + " of " + rows.length + " linked", tone: "warn" }
      : { text: "ready", tone: "ok" };

  const shown = rows.filter((entry) =>
    filter === "unlinked" ? unlinked.includes(entry) : filter === "marks" ? toSend.includes(entry) : true,
  );

  // ---- setup, while Canvas cannot be reached -----------------------------

  const setup = reachable
    ? null
    : h(
        "div",
        { className: "pp-csetup" },
        h(
          "ul",
          { className: "pp-steps" },
          [hostStep, tokenStep, courseStep].map((entry, index) =>
            h(
              "li",
              { className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"), key: index },
              h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
              h("span", null, entry.label),
            ),
          ),
        ),
        !hostStep.done
          ? h(ProviderSetup, { integration: row, runId: props.runId, sessionId: props.sessionId, onSaved: saved })
          : !tokenStep.done
            ? // The address is known, so only the token is asked for — the
              // setup form would make the professor type the address again.
              h(
                "div",
                null,
                h(Secret, {
                  name: data.canvas.tokenEnv,
                  status: ((data.credentials || {}).refs || {})[data.canvas.tokenEnv],
                  runId: props.runId,
                  sessionId: props.sessionId,
                  onSaved: saved,
                  onStatus: (next) => setTokenError(next && next.error ? next.error : null),
                }),
                h(
                  "p",
                  { className: "pp-as" },
                  "Canvas → Account → Settings → New Access Token. It goes to the credential store and is never shown again.",
                ),
                tokenError ? h("p", { className: "pp-saveerr" }, tokenError) : null,
              )
            : data.subgroups.length
            ? h(SubgroupCourses, {
                runId: props.runId,
                sessionId: props.sessionId,
                subgroups: data.subgroups,
                state: subgroupCourses,
                onSaved: saved,
              })
            : h(
                "p",
                { className: "pp-as" },
                "Record the Canvas course on the run as extensions.lms.canvas_course_id — the number in the " +
                  "course's Canvas address" +
                  (data.run.recordPath ? ", in " + data.run.recordPath : "") +
                  ".",
              ),
        data.setup && data.setup.provider === "canvas" && data.setup.checkFailed
          ? h("p", { className: "pp-saveerr" }, data.setup.checkFailed)
          : null,
      );

  // ---- one assessment ----------------------------------------------------

  const panel = (entry) =>
    h(
      "div",
      { className: "pp-cpanel" },
      h("p", { className: "pp-factgroup" }, "Canvas assignment"),
      h(ColumnLinks, {
        assessment: entry.a,
        courses,
        host: data.canvas.host,
        runId: props.runId,
        sessionId: props.sessionId,
        onSaved: saved,
      }),
      h("p", { className: "pp-factgroup" }, "Definition"),
      h(
        "p",
        { className: "pp-as" },
        "Title, points, dates, what may be handed in, and the brief as the description. " +
          (entry.a.definitionSent
            ? "Last sent from this computer " + when(entry.a.definitionSent) + "."
            : "Not sent from this computer. Where there is no assignment yet, sending creates it and links it."),
      ),
      h(DefinitionPush, {
        assessmentId: entry.a.assessmentId,
        subgroups: subgroupCourses.perSubgroup ? data.subgroups : [],
        runId: props.runId,
        sessionId: props.sessionId,
        onWrite: props.onWrite,
      }),
      h("p", { className: "pp-factgroup" }, "Marks"),
      h(CanvasMarks, {
        runId: props.runId,
        sessionId: props.sessionId,
        assessmentId: entry.a.assessmentId,
        title: entry.a.title || entry.a.assessmentId,
        canvas: entry.u ? entry.u.canvas : null,
        ask: props.ask,
        onSent: () => {
          if (props.onWrite) props.onWrite();
        },
      }),
      handInSync
        ? h(
            React.Fragment,
            null,
            h("p", { className: "pp-factgroup" }, "Hand-ins"),
            h(CanvasRead, {
              sync: handInSync,
              label: "What students handed in, from Canvas",
              assessmentId: entry.a.assessmentId,
              runId: props.runId,
              sessionId: props.sessionId,
              names: props.names,
              onWrite: props.onWrite,
            }),
          )
        : null,
    );

  const assessmentRow = (entry) => {
    const id = entry.a.assessmentId;
    const expanded = open === id;
    return h(
      "div",
      { className: "pp-crow" + (expanded ? " pp-crow-open" : ""), key: id },
      h(
        "button",
        {
          type: "button",
          className: "pp-crowhead",
          "aria-expanded": expanded,
          onClick: () => setOpen(expanded ? null : id),
        },
        h("span", { className: "pp-crowchev", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
        h(
          "span",
          { className: "pp-crowtitle" },
          entry.a.title || id,
          entry.a.dueAt ? h("span", { className: "pp-as" }, " · due " + shortDate(entry.a.dueAt)) : null,
        ),
        h(
          "span",
          { className: "pp-crowpills" },
          rowPills(entry, reachable).map((pill) =>
            h("span", { className: "pp-chip" + (pill.tone ? " pp-chip-" + pill.tone : ""), key: pill.key }, pill.text),
          ),
        ),
      ),
      expanded ? panel(entry) : null,
    );
  };

  // ---- details -----------------------------------------------------------

  const details = h(
    "details",
    { className: "pp-cdetails" },
    h("summary", null, "Details"),
    h(
      Fact,
      { label: "Address", note: data.canvas.hostFrom || "not configured", missing: !data.canvas.host },
      data.canvas.host || h(Presence, { present: false, no: "not set" }),
    ),
    h(
      Fact,
      { label: "Token", note: data.canvas.tokenEnv + " — never shown, only whether it is there", missing: !tokenStep.done },
      h(Presence, { present: tokenStep.done, yes: "saved", no: "not set" }),
    ),
    Object.keys(courses).map((group) =>
      h(
        Fact,
        { label: group ? "Course · " + group : "Course", key: "course:" + group },
        data.canvas.host
          ? h(
              "a",
              { href: String(data.canvas.host).replace(/\/+$/, "") + "/courses/" + courses[group], target: "_blank", rel: "noreferrer" },
              courses[group] + " ↗",
            )
          : courses[group],
      ),
    ),
    data.canvasCourse.fromColumn && !data.canvasCourse.fromExtension && !subgroupCourses.perSubgroup
      ? h(
          "p",
          { className: "pp-saveerr" },
          "The course id is in lms_course_id, which a push does not read. It reads extensions.lms.canvas_course_id.",
        )
      : null,
    subgroupCourses.conflict
      ? h(
          "p",
          { className: "pp-saveerr" },
          "The run also sets a single Canvas course (" + subgroupCourses.singleId + "). A record cannot hold both.",
        )
      : null,
    h(
      Fact,
      {
        label: "Grades go to",
        note: data.target.value === null ? "the run's gradebook target, not recorded yet" : "the run's gradebook target",
        missing: data.target.value === null || data.target.supported === false,
      },
      data.target.value || h(Presence, { present: false, no: "not recorded" }),
    ),
    data.run.recordPath ? h(Fact, { label: "Run record", note: "where the course ids and columns are written" }, data.run.recordPath) : null,
    h(
      "div",
      { className: "pp-approverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          "aria-pressed": editing === "access",
          onClick: () => setEditing(editing === "access" ? null : "access"),
        },
        "Change address or token",
      ),
      data.subgroups.length
        ? h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              "aria-pressed": editing === "courses",
              onClick: () => setEditing(editing === "courses" ? null : "courses"),
            },
            "Change courses",
          )
        : null,
    ),
    editing === "access"
      ? h(ProviderSetup, {
          integration: row,
          runId: props.runId,
          sessionId: props.sessionId,
          onCancel: () => setEditing(null),
          onSaved: (body) => {
            setEditing(null);
            saved(body);
          },
        })
      : null,
    editing === "courses"
      ? h(SubgroupCourses, {
          runId: props.runId,
          sessionId: props.sessionId,
          subgroups: data.subgroups,
          state: subgroupCourses,
          onSaved: (body) => {
            setEditing(null);
            saved(body);
          },
        })
      : null,
    reachable ? h(CanvasSections, { data, runId: props.runId, sessionId: props.sessionId, onSaved: saved }) : null,
  );

  // ---- the card ----------------------------------------------------------

  const filters = [
    { id: "all", label: "All " + rows.length },
    { id: "unlinked", label: "Not linked " + unlinked.length, hide: !reachable || !unlinked.length },
    { id: "marks", label: "Marks to send " + toSend.length, hide: !toSend.length },
  ].filter((entry) => !entry.hide);

  return h(
    "section",
    { className: "pp-ccard" },
    h(
      "div",
      { className: "pp-chead" },
      h("span", { className: "pp-svc pp-svc-canvas", "aria-hidden": "true" }, "Cv"),
      h("span", { className: "pp-cname" }, "Canvas", h("span", { className: "pp-intwhat" }, subtitle)),
      h("span", { className: "pp-chip pp-chip-" + chip.tone }, chip.text),
    ),
    setup,
    reachable && rosterSync
      ? h(CanvasRead, {
          sync: rosterSync,
          label: "Class list",
          runId: props.runId,
          sessionId: props.sessionId,
          names: props.names,
          onWrite: props.onWrite,
        })
      : null,
    rows.length
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            { className: "pp-ctools" },
            filters.length > 1
              ? filters.map((entry) =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pp-segbtn",
                      key: entry.id,
                      "aria-pressed": filter === entry.id,
                      onClick: () => setFilter(entry.id),
                    },
                    entry.label,
                  ),
                )
              : h("span", { className: "pp-as" }, rows.length + " assessments"),
            h("span", { className: "pp-segspacer" }),
            reachable && unlinked.length
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    "aria-pressed": binding,
                    title: "Fetch each course's assignments and pair them with the unlinked assessments by title and points",
                    onClick: () => setBinding(!binding),
                  },
                  "Suggest pairs",
                )
              : null,
          ),
          binding
            ? h(
                "div",
                { className: "pp-cpanel" },
                h(AssignmentBinder, {
                  runId: props.runId,
                  sessionId: props.sessionId,
                  subgroups: data.subgroups,
                  courseMap: subgroupCourses.perSubgroup ? subgroupCourses.map : null,
                  singleCourseId: data.canvasCourse.id,
                  assessments: data.assessments,
                  onSaved: (body) => {
                    setBinding(false);
                    saved(body);
                  },
                }),
              )
            : null,
          h(
            "div",
            { className: "pp-crows" },
            shown.length ? shown.map(assessmentRow) : h("p", { className: "pp-as" }, "Nothing here."),
          ),
        )
      : h("p", { className: "pp-as" }, "This run has no assessments yet. Drafting one is /design-assessment."),
    details,
  );
}
