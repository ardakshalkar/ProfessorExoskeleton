/**
 * The pieces the Integrations tab is built from: facts and credential rows,
 * connection setup, the assignment binder, the status block and the subgroup
 * courses.
 */

import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

// ------------------------------------------------------------ integrations

/** A row: what it is called, what it is set to, and a note underneath. */
export function Fact(props) {
  return h(
    "div",
    { className: "pp-fact" },
    h(
      "span",
      { className: "pp-factkey" },
      props.label,
      props.note ? h("span", { className: "pp-factnote" }, props.note) : null,
    ),
    h(
      "span",
      { className: "pp-factval" + (props.missing ? " pp-factmissing" : "") },
      props.children,
    ),
  );
}

/**
 * Present or not, as the same two words everywhere.
 *
 * Never the value, and there is no parameter here that could carry one —
 * the host half sends a boolean. A token rendered into this pane would be a
 * grade-changing credential on a screen that gets projected.
 */
export function Presence(props) {
  return props.present
    ? h("span", { className: "pp-yes" }, props.yes || "set")
    : h("span", { className: "pp-no" }, props.no || "not set");
}

/**
 * One credential field: type it in, press Save, never see it again.
 *
 * The input is uncontrolled after a save — `setValue("")` clears it — and
 * there is no code path that puts a stored value back into it. That is
 * deliberate and is the difference between a field and a display: a box
 * pre-filled with the current token would put the token on the screen,
 * which is the one thing this whole tab is built not to do.
 *
 * `writable: false` disables it rather than hiding it. Hiding would leave
 * a professor wondering where the field went; disabling with the reason
 * beside it says "you already set this, in your shell, and that is where
 * to change it".
 */
export function Secret(props) {
  const [value, setValue] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const status = props.status || {};
  const writable = status.writable !== false;

  const submit = () => {
    setPhase("saving");
    fetch(
      scoped(
        BASE + "/api/credentials?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: props.name, value }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        // Cleared whether or not the write succeeded. A rejected token
        // left sitting in the box is a token on the screen, and the
        // professor has it in their clipboard either way.
        setValue("");
        if (body.error) {
          setPhase("idle");
          if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
          return;
        }
        setPhase("idle");
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => {
        setValue("");
        setPhase("idle");
        if (props.onStatus) {
          props.onStatus({ error: String((error && error.message) || error), from: props.name });
        }
      });
  };

  return h(
    "div",
    { className: "pp-secret" },
    h("span", { className: "pp-secretname" }, props.name),
    h("input", {
      className: "pp-secretbox",
      type: "password",
      // Browsers offer to remember anything they think is a login. This is
      // a machine credential and belongs in the harness's store, not in a
      // password manager keyed to a localhost URL.
      autoComplete: "off",
      spellCheck: false,
      disabled: !writable || phase === "saving",
      placeholder: status.configured ? "replace the stored value" : "paste the token",
      value,
      onChange: (event) => setValue(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter" && value.trim()) submit();
      },
    }),
    h(
      "button",
      {
        type: "button",
        className: "pp-segbtn",
        disabled: !writable || phase === "saving" || !value.trim(),
        onClick: submit,
      },
      phase === "saving" ? "Saving…" : "Save",
    ),
    status.configured && writable
      ? h(
          "button",
          {
            type: "button",
        className: "pp-segbtn",
            disabled: phase === "saving",
            onClick: () => {
              setValue("");
              setPhase("saving");
              fetch(
                scoped(
                  BASE + "/api/credentials?run=" + encodeURIComponent(props.runId || ""),
                  props.sessionId,
                ),
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ref: props.name, value: "" }),
                },
              )
                .then((response) => response.json())
                .then((body) => {
                  setPhase("idle");
                  if (body.error) {
                    if (props.onStatus) props.onStatus({ error: body.error, from: props.name });
                    return;
                  }
                  if (props.onSaved) props.onSaved(body);
                })
                .catch(() => setPhase("idle"));
            },
          },
          "Clear",
        )
      : null,
  );
}

/**
 * What each provider's setup form asks for.
 *
 * A table rather than a component per provider, because the four forms
 * differ only in which of these rows they draw and what the placeholder
 * says. A fifth provider is an entry in `integrationsFor` on the host
 * side and nothing at all here.
 */
const SETUP_FIELDS = {
  baseUrl: {
    label: "Address",
    type: "url",
    placeholder: "https://canvas.your-university.edu",
  },
  chatId: {
    label: "Channel",
    type: "text",
    placeholder: "@course_channel, or the numeric id",
  },
  sheetId: {
    label: "Spreadsheet",
    type: "text",
    placeholder: "the URL, or the id between /d/ and /edit",
  },
  token: {
    label: "Access token",
    type: "password",
    placeholder: "paste the token",
  },
};

/** What each provider calls its token, and where it comes from. */
const TOKEN_HINT = {
  canvas: "Canvas → Account → Settings → New Access Token",
  telegram: "the token @BotFather gave you when the bot was created",
  moodle: "Moodle → Preferences → Security keys",
  sheets: "an access token, or leave empty and use a service-account key",
};

/**
 * Set one integration up, or fill in the half that is missing.
 *
 * The token box is cleared on every outcome, success or refusal: a
 * rejected token left in the box is a token on a screen that gets
 * projected, and the professor has it in their clipboard either way.
 *
 * Nothing is ever pre-filled from what is stored. The address could be
 * shown safely and the token could not, and a form where one field
 * remembers and the other does not is a form that invites somebody to
 * press Save with an empty token and wonder why it stopped working.
 */
function ProviderSetup(props) {
  const spec = props.integration;
  const [values, setValues] = React.useState({});
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);

  const set = (key, value) => setValues(Object.assign({}, values, { [key]: value }));
  // Every provider needs its destination; the token can be supplied later
  // or through the environment, so it never gates Save.
  const required = (spec.fields || []).filter((field) => field !== "token");
  const ready = required.every((field) => String(values[field] || "").trim());

  const submit = () => {
    setPhase("saving");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/integrations/setup?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign({ provider: spec.id }, values)),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        setValues(Object.assign({}, values, { token: "" }));
        setPhase("idle");
        if (body.error) {
          setFailed(body.error);
          return;
        }
        setValues({});
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => {
        setValues(Object.assign({}, values, { token: "" }));
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  return h(
    "div",
    { className: "pp-setup" },
    (spec.fields || []).map((field) => {
      const meta = SETUP_FIELDS[field];
      if (!meta) return null;
      return h(
        "div",
        { className: "pp-field", key: field },
        h(
          "span",
          { className: "pp-fieldlabel" },
          field === "token" ? meta.label + " — " + (TOKEN_HINT[spec.id] || "") : meta.label,
        ),
        h("input", {
          className: "pp-fieldbox",
          type: meta.type,
          autoComplete: "off",
          spellCheck: false,
          placeholder: meta.placeholder,
          value: values[field] || "",
          disabled: phase === "saving",
          onChange: (event) => set(field, event.target.value),
        }),
      );
    }),
    h(
      "p",
      { className: "pp-absent" },
      "Everything but the token is saved outside this repository, in the connections " +
        "registry or the run record. The token goes to the harness's credential store " +
        "and is never shown again.",
    ),
    h(
      "div",
      { className: "pp-saverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving" || !ready,
          onClick: submit,
        },
        phase === "saving" ? "Saving and checking…" : "Save and check",
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase === "saving",
          onClick: () => {
            setValues({});
            setFailed(null);
            if (props.onCancel) props.onCancel();
          },
        },
        "Cancel",
      ),
    ),
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
  );
}

/**
 * A title reduced to what two systems are likely to agree on.
 *
 * Case, punctuation and runs of space go; the words stay. It is enough to
 * pair "Model Evaluation Assignment" with "Model evaluation assignment"
 * and honest about being a suggestion rather than a fact — nothing here
 * saves on its own.
 */
const normaliseTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, " ")
    .trim();

/**
 * Pair each assessment with the Canvas assignment it most likely is.
 *
 * Three passes, weakest last: an exact normalised title, then one title
 * containing the other, then a unique match on what it is out of. A
 * Canvas assignment is claimed by at most one assessment, so a second
 * assessment with the same name gets nothing rather than a duplicate —
 * two assessments pointing at one column is the mistake the validator
 * calls `lms.duplicate_link`, and suggesting it would be rude.
 */
const suggestPairs = (assessments, assignments) => {
  const taken = new Set();
  const picks = {};
  const claim = (assessmentId, assignment) => {
    if (!assignment || taken.has(assignment.id)) return false;
    picks[assessmentId] = assignment.id;
    taken.add(assignment.id);
    return true;
  };

  const left = assessments.filter((entry) => {
    const wanted = normaliseTitle(entry.title);
    return !claim(
      entry.assessmentId,
      assignments.find((a) => !taken.has(a.id) && normaliseTitle(a.name) === wanted),
    );
  });

  const stillLeft = left.filter((entry) => {
    const wanted = normaliseTitle(entry.title);
    if (!wanted) return true;
    return !claim(
      entry.assessmentId,
      assignments.find((a) => {
        if (taken.has(a.id)) return false;
        const other = normaliseTitle(a.name);
        return other && (other.includes(wanted) || wanted.includes(other));
      }),
    );
  });

  for (const entry of stillLeft) {
    if (entry.maximumScore === null || entry.maximumScore === undefined) continue;
    const sameScore = assignments.filter(
      (a) => !taken.has(a.id) && a.points !== null && Math.abs(a.points - entry.maximumScore) < 0.01,
    );
    // Only when it is unambiguous. "One of the four things worth 20" is
    // not a suggestion, it is a coin toss with a professor's gradebook.
    if (sameScore.length === 1) claim(entry.assessmentId, sameScore[0]);
  }

  return picks;
};

/**
 * Bind each assessment to its Canvas assignment, one subgroup at a time.
 *
 * One subgroup at a time because that is how a push runs: each subgroup
 * has its own Canvas course, each course numbers its assignments
 * independently, and the two lists have nothing to do with each other.
 * Twenty-one assessments across three courses is sixty-three bindings,
 * which is why the pairing is suggested and not asked for — but nothing
 * is written until Save, and every row is a dropdown the professor can
 * disagree with.
 *
 * What is sent back on Save is the WHOLE mapping for each assessment,
 * this subgroup merged into the ones already bound. The writer replaces
 * the mapping wholesale, so sending only what is on screen would unbind
 * every other subgroup silently.
 */
function AssignmentBinder(props) {
  const subgroups = (props.subgroups || []).map((entry) => entry.group);
  const perSubgroup = subgroups.length > 0 && props.courseMap;
  const [group, setGroup] = React.useState(perSubgroup ? subgroups[0] : null);
  const [assignments, setAssignments] = React.useState(null);
  const [picks, setPicks] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);

  const assessments = props.assessments || [];
  const courseId = perSubgroup ? (props.courseMap || {})[group] : props.singleCourseId;

  // What is already recorded for the subgroup on screen.
  const recorded = {};
  for (const entry of assessments) {
    const existing = perSubgroup
      ? (entry.canvasAssignments || {})[group]
      : entry.canvasAssignmentId;
    if (existing) recorded[entry.assessmentId] = existing;
  }
  const chosen = picks || recorded;

  const load = () => {
    if (!courseId) {
      setFailed(
        perSubgroup
          ? `${group} has no Canvas course bound yet — bind it above first.`
          : "This run has no Canvas course recorded yet.",
      );
      return;
    }
    setPhase("fetching");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/assignments?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        setPhase("idle");
        if (body.error) {
          setFailed(body.error);
          return;
        }
        setAssignments(body.assignments || []);
        // Suggest only where nothing is recorded, so a fetch never
        // overwrites a pairing the professor has already accepted.
        const suggested = suggestPairs(
          assessments.filter((entry) => !recorded[entry.assessmentId]),
          (body.assignments || []).filter((a) => !Object.values(recorded).includes(a.id)),
        );
        setPicks(Object.assign({}, recorded, suggested));
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  const save = () => {
    setPhase("saving");
    setFailed(null);
    const links = {};
    for (const entry of assessments) {
      const picked = chosen[entry.assessmentId];
      if (perSubgroup) {
        const merged = Object.assign({}, entry.canvasAssignments || {});
        if (picked) merged[group] = picked;
        else delete merged[group];
        links[entry.assessmentId] = Object.keys(merged).length ? merged : null;
      } else {
        links[entry.assessmentId] = picked || null;
      }
    }
    fetch(
      scoped(
        BASE + "/api/canvas/assignment-map?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ links }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        setPhase("idle");
        if (body.error) {
          setFailed(body.error);
          return;
        }
        setPicks(null);
        setAssignments(null);
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  const options = assignments || [];
  const bound = assessments.filter((entry) => chosen[entry.assessmentId]).length;

  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "Assessments and their Canvas assignments"),
    perSubgroup
      ? h(
          "div",
          { className: "pp-bind" },
          h("span", { className: "pp-bindname" }, "Subgroup"),
          h(
            "select",
            {
              className: "pp-bindsel",
              value: group || "",
              onChange: (event) => {
                setGroup(event.target.value);
                setAssignments(null);
                setPicks(null);
                setFailed(null);
              },
            },
            subgroups.map((name) =>
              h(
                "option",
                { value: name, key: name },
                name + ((props.courseMap || {})[name] ? "" : " — no Canvas course"),
              ),
            ),
          ),
        )
      : null,
    h(
      "div",
      { className: "pp-saverow-top" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: phase !== "idle",
          onClick: load,
        },
        phase === "fetching" ? "Asking Canvas…" : "Fetch assignments and suggest pairs",
      ),
      options.length
        ? h(
            "span",
            { className: "pp-savenote" },
            " " + bound + " of " + assessments.length + " paired",
          )
        : null,
    ),
    options.length
      ? assessments.map((entry) =>
          h(
            "div",
            { className: "pp-bind", key: entry.assessmentId },
            h(
              "span",
              { className: "pp-bindname" },
              entry.title || entry.assessmentId,
              h(
                "span",
                { className: "pp-intwhat" },
                entry.assessmentId +
                  (entry.maximumScore === null || entry.maximumScore === undefined
                    ? ""
                    : " · out of " + entry.maximumScore),
              ),
            ),
            h(
              "select",
              {
                className: "pp-bindsel",
                value: chosen[entry.assessmentId] || "",
                onChange: (event) =>
                  setPicks(
                    Object.assign({}, chosen, {
                      [entry.assessmentId]: event.target.value,
                    }),
                  ),
              },
              h("option", { value: "" }, "— not linked —"),
              options.map((assignment) =>
                h(
                  "option",
                  { value: assignment.id, key: assignment.id },
                  assignment.name +
                    (assignment.points === null ? "" : " · " + assignment.points) +
                    " (" + assignment.id + ")",
                ),
              ),
            ),
          ),
        )
      : null,
    options.length
      ? h(
          "div",
          { className: "pp-saverow" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase !== "idle",
              onClick: save,
            },
            phase === "saving" ? "Saving…" : "Save these pairings",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase !== "idle",
              onClick: () => setPicks(null),
            },
            "Revert",
          ),
          h(
            "span",
            { className: "pp-savenote" },
            " Suggestions are a guess from the titles and the marks. Check them.",
          ),
        )
      : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
  );
}

/**
 * Every integration, its state, and the way to fix the ones that are not
 * finished.
 *
 * The whole reason this view exists: the facts were all on the tab and
 * none of them added up to an answer. A professor asking "will a push
 * reach Canvas" had to know that the host is in one file, the token in a
 * variable, the course id on the run record and the assignment ids on
 * four assessments — and then do the arithmetic themselves.
 *
 * A finished integration collapses to one line. An unfinished one shows
 * its checklist, because "partly configured" without saying which part is
 * a worse answer than nothing.
 */
export function IntegrationStatus(props) {
  const [opened, setOpened] = React.useState(null);
  const rows = props.integrations || [];

  if (!rows.length) {
    return h("p", { className: "pp-absent" }, "Nothing to report about this run yet.");
  }

  const label = { ready: "ready", partial: "partly set up", absent: "not set up" };

  return h(
    "div",
    null,
    rows.map((row) =>
      h(
        "div",
        { className: "pp-int", key: row.id },
        h(
          "div",
          { className: "pp-inthead" },
          h(
            "span",
            { className: "pp-intname" },
            row.label,
            h("span", { className: "pp-intwhat" }, row.what),
          ),
          h("span", { className: "pp-state pp-state-" + row.state }, label[row.state]),
        ),
        // A finished one says so and stops. Its steps are all ticks, and
        // four ticks is a wall to read past on the way to the one row
        // that still needs something.
        row.state === "ready"
          ? null
          : h(
              "ul",
              { className: "pp-steps" },
              row.steps.map((entry, index) =>
                h(
                  "li",
                  {
                    className: "pp-step " + (entry.done ? "pp-step-done" : "pp-step-todo"),
                    key: index,
                  },
                  h("span", { className: "pp-stepmark" }, entry.done ? "✓" : "·"),
                  h(
                    "span",
                    null,
                    entry.label,
                    entry.done
                      ? null
                      : h("span", { className: "pp-stephint" }, " — " + entry.hint),
                  ),
                ),
              ),
            ),
        row.canPushGrades === false && row.state !== "absent"
          ? h(
              "p",
              { className: "pp-absent" },
              "Grades cannot be pushed here — nothing in this workspace has a " +
                row.label +
                " gradebook target. It publishes content.",
            )
          : null,
        opened === row.id
          ? h(
              "div",
              null,
              // The steps still to do, in order, and only those. A
              // professor who has already saved a host and a token should
              // not have to scroll past the form asking for them again to
              // reach the pairing that is actually missing.
              row.steps[0].done && row.steps[1].done
                ? null
                : h(ProviderSetup, {
                    integration: row,
                    runId: props.runId,
                    sessionId: props.sessionId,
                    onCancel: () => setOpened(null),
                    onSaved: (body) => {
                      if (props.onSaved) props.onSaved(body);
                    },
                  }),
              row.id === "canvas" && row.steps[1].done && !row.steps[2].done
                ? h(SubgroupCourses, {
                    runId: props.runId,
                    sessionId: props.sessionId,
                    subgroups: props.data.subgroups || [],
                    state:
                      props.data.subgroupCourses || {
                        map: {},
                        perSubgroup: false,
                        conflict: false,
                      },
                    onSaved: (body) => {
                      if (props.onSaved) props.onSaved(body);
                    },
                  })
                : null,
              // Only once there is a course to ask about. Fetching a
              // course's assignments needs the course, and offering the
              // binder before that is offering a button that can only
              // fail.
              row.id === "canvas" && row.steps[1].done && row.steps[2].done && !row.steps[3].done
                ? h(AssignmentBinder, {
                    runId: props.runId,
                    sessionId: props.sessionId,
                    subgroups: props.data.subgroups || [],
                    courseMap: (props.data.subgroupCourses || {}).perSubgroup
                      ? (props.data.subgroupCourses || {}).map
                      : null,
                    singleCourseId: (props.data.canvasCourse || {}).id,
                    assessments: props.data.assessments || [],
                    onSaved: (body) => {
                      if (props.onSaved) props.onSaved(body);
                    },
                  })
                : null,
              h(
                "div",
                { className: "pp-saverow" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    onClick: () => setOpened(null),
                  },
                  "Done for now",
                ),
              ),
            )
          : row.state === "ready"
            ? null
            : h(
                "div",
                { className: "pp-saverow-top" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn",
                    onClick: () => setOpened(row.id),
                  },
                  // Named by what is left rather than by the provider, so
                  // a half-finished Canvas offers "Continue" and does not
                  // look like it is asking to start over.
                  (row.state === "absent" ? "Configure " : "Continue setting up ") +
                    row.label,
                ),
              ),
      ),
    ),
    props.setup && props.setup.answered
      ? h(
          "p",
          { className: "pp-ok" },
          props.setup.provider +
            " answered as " +
            props.setup.answered +
            (props.setup.tokenSaved ? ". The token is stored." : "."),
        )
      : null,
    props.setup && props.setup.checkFailed
      ? h("p", { className: "pp-saveerr" }, props.setup.checkFailed)
      : null,
  );
}

/**
 * Which Canvas course each subgroup is taught in.
 *
 * Only drawn when the run has subgroups, because a run with one cohort has
 * one Canvas course and the field above already holds it.
 *
 * The picker is filled from Canvas rather than typed. A Canvas course id
 * is a number nobody remembers and everybody copies out of a URL, and a
 * digit dropped there binds a cohort to somebody else's course — which is
 * a mistake that looks like nothing until marks arrive in it.
 */
export function SubgroupCourses(props) {
  const [catalogue, setCatalogue] = React.useState(null);
  const [fetching, setFetching] = React.useState(false);
  const [picked, setPicked] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [failed, setFailed] = React.useState(null);

  const subgroups = props.subgroups || [];
  const current = props.state.map || {};
  const chosen = picked || current;

  if (!subgroups.length) return null;

  const load = () => {
    setFetching(true);
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/courses?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      { method: "POST" },
    )
      .then((response) => response.json())
      .then((body) => {
        setFetching(false);
        if (body.error) {
          setFailed(body.error);
          return;
        }
        setCatalogue(body.courses || []);
      })
      .catch((error) => {
        setFetching(false);
        setFailed(String((error && error.message) || error));
      });
  };

  const save = () => {
    setPhase("saving");
    setFailed(null);
    fetch(
      scoped(
        BASE + "/api/canvas/course-map?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapping: chosen }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        setPhase("idle");
        if (body.error) {
          setFailed(body.error);
          return;
        }
        setPicked(null);
        if (props.onSaved) props.onSaved(body);
      })
      .catch((error) => {
        setPhase("idle");
        setFailed(String((error && error.message) || error));
      });
  };

  const options = catalogue || [];

  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "A Canvas course per subgroup"),
    props.state.conflict
      ? h(
          "p",
          { className: "pp-saveerr" },
          "This run also sets a single Canvas course id (" +
            props.state.singleId +
            "). A record cannot hold both — clear that one before binding subgroups.",
        )
      : null,
    h(
      "p",
      { className: "pp-absent" },
      options.length
        ? "Bind each subgroup to the Canvas course it is taught in. A push then " +
            "runs once per subgroup and carries only that subgroup's students."
        : "If each subgroup has its own Canvas course, fetch your courses and bind " +
            "them here. Leave this alone when the whole run is one Canvas course.",
    ),
    h(
      "div",
      { className: "pp-saverow-top" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: fetching,
          onClick: load,
        },
        fetching ? "Asking Canvas…" : "Fetch my Canvas courses",
      ),
    ),
    subgroups.map((entry) =>
      h(
        "div",
        { className: "pp-bind", key: entry.group },
        h("span", { className: "pp-bindname" }, entry.group),
        options.length
          ? h(
              "select",
              {
                className: "pp-bindsel",
                value: chosen[entry.group] || "",
                onChange: (event) =>
                  setPicked(
                    Object.assign({}, chosen, { [entry.group]: event.target.value }),
                  ),
              },
              h("option", { value: "" }, "— not bound —"),
              options.map((course) =>
                h(
                  "option",
                  { value: course.id, key: course.id },
                  course.name + " (" + course.id + ")",
                ),
              ),
            )
          : h(
              "span",
              { className: chosen[entry.group] ? null : "pp-absent" },
              chosen[entry.group] || "not bound",
            ),
      ),
    ),
    options.length
      ? h(
          "div",
          { className: "pp-saverow" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase === "saving",
              onClick: save,
            },
            phase === "saving" ? "Saving…" : "Save to the run record",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              disabled: phase === "saving",
              onClick: () => setPicked(null),
            },
            "Revert",
          ),
        )
      : null,
    failed ? h("p", { className: "pp-saveerr" }, failed) : null,
  );
}
