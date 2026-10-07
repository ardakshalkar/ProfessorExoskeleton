/**
 * The Integrations tab, and pushing an assessment's definition to Canvas.
 */

import { Message, useJson } from "./common.js";
import { Fact, IntegrationStatus, Presence, Secret, SubgroupCourses } from "./integration-parts.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * What this run is wired to, and what it is not.
 *
 * Drawn here rather than served as a document for `WidgetFrame`'s reason:
 * the Links view has a form, and a frame with no `allow-same-origin` cannot
 * call back to the routes it would post to.
 *
 * One fetch for three sub-views. `/api/integrations` reads five files and
 * five environment variables, and splitting it per view would be three
 * chances to show a host from one read beside a token from another.
 */
export function Integrations(props) {
  const url = scoped(
    BASE +
      "/api/integrations?run=" +
      encodeURIComponent(props.runId || "") +
      // The revision counter, in the URL because `useJson` re-fetches when
      // its URL changes and on nothing else. The route does not read `r`
      // and does not need to — its only job is to make an `ainar lms` run
      // in a terminal, or a hand-edited version.yaml, redraw this tab. See
      // the `revision` prop in the pane for why this is not a remount.
      "&r=" +
      encodeURIComponent(String(props.revision || 0)),
    props.sessionId,
  );
  const state = useJson(url);
  // What a Save handed back, which is the record as it now is. Preferred
  // over the fetch for the reason `Preferences` prefers it: the form should
  // redraw from disk rather than from its own memory of what was ticked.
  const [fresh, setFresh] = React.useState(null);
  // The live Canvas answer. Never fetched on render — only when the
  // professor presses for it, because the request spends their API quota
  // and sends their token. `null` means nobody has asked yet, which is a
  // different state from "asked and Canvas returned nothing".
  const [catalogue, setCatalogue] = React.useState(null);
  const [fetching, setFetching] = React.useState(false);
  // Ticked sections, keyed `<kind>:<id>`, with the subgroup each feeds.
  // Seeded from the record and reseeded after a Save, so Revert has
  // something true to go back to.
  const [picked, setPicked] = React.useState(null);
  // One slot for both buttons, and therefore tagged with `from`.
  //
  // Untagged, this printed every failure in both places: a Canvas
  // precondition error appeared under `Fetch from Canvas` AND again beside
  // `Save to the run record`, which reads as two separate faults and
  // blames the save for something the fetch said. A message belongs under
  // the button that produced it.
  const [status, setStatus] = React.useState(null);
  const failure = (from) =>
    status && status.error && status.from === from ? status.error : null;

  const data =
    fresh || (state.phase === "ready" && !state.value.error ? state.value : null);

  const seed = (rows) => {
    const out = {};
    for (const row of rows || []) {
      out[row.kind + ":" + row.id] = { id: row.id, kind: row.kind, name: row.name, group: row.group };
    }
    return out;
  };

  // Reseed when the record changes under the form.
  //
  // Nothing here has to clear the fetched catalogue when the run changes,
  // and that is worth stating because it looks like an omission: the pane
  // keys this component on the run id, so a run switch REMOUNTS it and
  // every piece of state above starts empty. Which is the behaviour the
  // catalogue needs — a list of sections belongs to the Canvas course it
  // came from, and one left on screen across a switch would be offering
  // another course's sections to map.
  React.useEffect(() => {
    if (data) setPicked(seed(data.selections));
    setStatus(null);
  }, [state.phase, fresh]);

  if (state.phase === "loading") return h(Message, null, "Reading what this run is wired to…");
  if (state.value && state.value.error) return h(Message, { error: true }, state.value.error);
  if (!data) return h(Message, null, "Nothing to show.");

  const chosen = picked || seed(data.selections);
  const sub = props.subView || "targets";

  // ---- Targets -------------------------------------------------------

  if (sub === "status") {
    return h(
      "div",
      null,
      h(
        "p",
        { className: "pp-absent" },
        "What this run is wired to, and how much of each is done. A push reaches " +
          "nothing until every line below it is ticked.",
      ),
      h(IntegrationStatus, {
        integrations: data.integrations,
        setup: data.setup,
        data,
        runId: props.runId,
        sessionId: props.sessionId,
        onSaved: (body) => {
          setFresh(body);
          setStatus(null);
          // A connection is machine configuration and changes nothing in
          // courses/; a spreadsheet id does. Cheaper to refresh always
          // than to reason about which provider just wrote where.
          if (props.onWrite) props.onWrite();
        },
      }),
    );
  }

  if (sub === "targets") {
    const target = data.target;
    return h(
      "div",
      { className: "pp-scroll" },
      h("p", { className: "pp-factgroup" }, "Where an approved grade would go"),
      h(
        Fact,
        {
          label: "Gradebook target",
          note:
            target.value === null
              ? "Set once at onboarding. Without it every push has to be told."
              : target.supported === false
                ? "Recorded, but this workspace cannot reach it. Supported: " +
                  target.options.join(", ")
                : target.live
                  ? "A live target: a push changes something students can see, and needs --confirm"
                  : "Produces a file. Inert until somebody uploads it",
          missing: target.value === null || target.supported === false,
        },
        target.value === null
          ? h(Presence, { present: false, no: "not recorded" })
          : target.value,
      ),
      h(
        Fact,
        {
          label: "Canvas course",
          note:
            data.canvasCourse.fromExtension === null && data.canvasCourse.fromColumn
              ? "In lms_course_id, which `ainar lms push` does not read. It reads " +
                "extensions.lms.canvas_course_id"
              : data.canvasCourse.fromExtension
                ? "extensions.lms.canvas_course_id, which is the field the push reads"
                : "extensions.lms.canvas_course_id on the run record. The number is in " +
                  "the Canvas course URL",
          missing: !data.canvasCourse.usable,
        },
        data.canvasCourse.fromExtension ||
          data.canvasCourse.fromColumn ||
          h(Presence, { present: false, no: "not recorded" }),
      ),
      h(
        Fact,
        {
          label: "Canvas host",
          note:
            data.canvas.hostFrom ||
            "A canvas connection in " +
              data.canvas.registryPath +
              " — `ainar connections migrate` builds one from what is already here",
          missing: !data.canvas.host,
        },
        data.canvas.host || h(Presence, { present: false, no: "not configured" }),
      ),
      // No setup form here. Status owns that, and a form offered in two
      // places is two places to keep true.
      data.canvas.host
        ? null
        : h(
            "p",
            { className: "pp-absent" },
            "No Canvas host yet. Status, above, is where it is set up.",
          ),
      h(
        Fact,
        {
          label: "Canvas token",
          // The variable's NAME, which is not a secret and is the thing a
          // professor needs when a push is refused. Guessing between
          // AINAR_CANVAS_TOKEN and the bare CANVAS_TOKEN the publishing
          // profiles used to fall back to is exactly the confusion the
          // merged registry exists to end.
          note: data.canvas.tokenEnv,
          missing: !data.canvas.tokenInEnv,
        },
        h(Presence, {
          present: data.canvas.tokenInEnv,
          yes: "set",
          no: "not set",
        }),
      ),
      h(
        Fact,
        {
          label: "Spreadsheet",
          note: data.sheet.id
            ? "Summary tab: " + data.sheet.summaryTab
            : "extensions.lms.sheet_id — the string between /d/ and /edit",
          missing: !data.sheet.id,
        },
        data.sheet.id || h(Presence, { present: false, no: "not recorded" }),
      ),
      h(SubgroupCourses, {
        runId: props.runId,
        sessionId: props.sessionId,
        subgroups: data.subgroups || [],
        state: data.subgroupCourses || { map: {}, perSubgroup: false, conflict: false },
        onSaved: (body) => {
          setFresh(body);
          setStatus(null);
          // The run record changed, so every other view of it is stale —
          // the same counter an approval bumps.
          if (props.onWrite) props.onWrite();
        },
      }),
      h("p", { className: "pp-factgroup" }, "What students would be told"),
      data.connections.profiles.filter((profile) => profile.type !== "canvas").length === 0
        ? h(
            "p",
            { className: "pp-absent" },
            "No Moodle or Telegram profile in " +
              data.connections.path +
              ". Announcing to a channel is /publish-telegram, which reads that file.",
          )
        : data.connections.profiles
            .filter((profile) => profile.type !== "canvas")
            .map((profile) =>
              h(
                Fact,
                {
                  label: profile.name,
                  note:
                    profile.type +
                    (profile.chatId
                      ? " · chat " + profile.chatId
                      : profile.baseUrl
                        ? " · " + profile.baseUrl
                        : ""),
                  missing: !profile.supported,
                  key: profile.name,
                },
                profile.supported
                  ? h(Presence, {
                      present: profile.tokenInEnv || profile.tokenInFile,
                      yes: "ready",
                      no: "no token",
                    })
                  : "unsupported type",
              ),
            ),
      h(
        "p",
        { className: "pp-absent" },
        data.run.recordPath
          ? "The run's own linkages live in " + data.run.recordPath + "."
          : "This run's record could not be located.",
      ),
    );
  }

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
      h("p", { className: "pp-factgroup" }, "Credentials"),
      (() => {
        const refs = (data.credentials && data.credentials.refs) || {};
        const names = Object.keys(refs).sort();
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

  // ---- Links ---------------------------------------------------------

  const key = (option) => option.kind + ":" + option.id;

  const toggle = (option) =>
    setPicked((current) => {
      const next = Object.assign({}, current || chosen);
      if (Object.hasOwn(next, key(option))) delete next[key(option)];
      else {
        next[key(option)] = {
          id: option.id,
          kind: option.kind,
          name: option.name,
          // One subgroup and nothing to decide: bind it, rather than
          // making the professor pick from a list of one. A run with none
          // stays null, which means "the whole run".
          group: data.subgroups.length === 1 ? data.subgroups[0].group : null,
        };
      }
      return next;
    });

  const bind = (option, group) =>
    setPicked((current) => {
      const next = Object.assign({}, current || chosen);
      if (!next[key(option)]) return next;
      next[key(option)] = Object.assign({}, next[key(option)], { group: group || null });
      return next;
    });

  const load = () => {
    setFetching(true);
    setStatus(null);
    fetch(
      scoped(
        BASE + "/api/canvas/catalogue?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      { method: "POST" },
    )
      .then((response) => response.json())
      .then((body) => {
        setFetching(false);
        if (body.error) {
          setStatus({ error: body.error, from: "fetch" });
          return;
        }
        setCatalogue(body);
      })
      .catch((error) => {
        setFetching(false);
        setStatus({ error: String((error && error.message) || error), from: "fetch" });
      });
  };

  const save = () => {
    setStatus("saving");
    fetch(
      scoped(
        BASE + "/api/canvas/selection?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selections: Object.values(chosen) }),
      },
    )
      .then((response) => response.json())
      .then((body) => {
        if (body.error) {
          setStatus({ error: body.error, from: "save" });
          return;
        }
        setFresh(body);
        setStatus({ saved: body.saved });
        // The record changed, so every other view of it has to be
        // re-fetched — the same counter an approval bumps.
        if (props.onWrite) props.onWrite();
      })
      .catch((error) =>
        setStatus({ error: String((error && error.message) || error), from: "save" }),
      );
  };

  // What is offered to tick: the live catalogue once fetched, otherwise
  // whatever the RECORD holds — so a professor with no token still sees the
  // mapping they have and can still unmap one.
  //
  // From the record and deliberately not from `chosen`: an unticked row has
  // to stay on screen. Deriving the list from what is currently ticked would
  // make a row vanish the moment it was unticked, so changing your mind
  // would cost another Canvas request to get it back.
  const offered = catalogue
    ? catalogue.options
    : data.selections.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name || row.id,
        students: null,
        sisId: null,
      }));

  const saved = status && status.saved;
  // Order-insensitive, because `chosen` is keyed by insertion and a
  // professor who unticks a section and ticks it again has changed nothing.
  // Comparing the stringified objects directly reported that as unsaved
  // work and offered a Save that would write the file back as it already
  // was.
  //
  // Joined on NUL, written as an escape rather than as the byte — the
  // spelling `grading.js`'s `pair()` settled on, and for its reason. A
  // separator that can occur inside a value lets two different selections
  // canonicalise to one string, and a Canvas section name is free text that
  // may hold any punctuation a registrar typed. NUL cannot occur in any of
  // the three halves. The escape is what keeps this file readable as text:
  // a literal NUL makes git store the whole thing as binary, which is how
  // two files in this repo ended up with no reviewable diff at all.
  const canonical = (table) =>
    Object.keys(table)
      .sort()
      .map((entry) => {
        const row = table[entry];
        return `${entry}\u0000${row.group || ""}\u0000${row.name || ""}`;
      })
      .join("\u0000\u0000");
  const dirty = canonical(seed(data.selections)) !== canonical(chosen);

  return h(
    "div",
    { className: "pp-scroll" },
    h("p", { className: "pp-factgroup" }, "Canvas sections and groups"),
    h(
      "p",
      { className: "pp-absent" },
      data.subgroups.length
        ? "Which Canvas section or student group feeds which subgroup of this run. " +
          "Leave a selection on the whole run when it is not a subgroup's." +
          // Worth saying here rather than only on the class list: a run
          // where some students carry no subgroup is a run where a
          // per-subgroup mapping does not cover everybody, and this is the
          // screen where that matters.
          (data.ungrouped
            ? " " +
              data.ungrouped +
              " active student" +
              (data.ungrouped === 1 ? "" : "s") +
              " carry no subgroup, so no per-subgroup selection covers them."
            : "")
        : "This run has no subgroups, so a selection here says only that the section " +
          "belongs to this run.",
    ),
    h(
      "div",
      { className: "pp-saverow pp-saverow-top" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: fetching,
          title:
            "Ask Canvas for this course's sections and student groups. A read, " +
            "but it sends your token, so it happens only when you press this.",
          onClick: load,
        },
        fetching ? "Asking Canvas…" : catalogue ? "Fetch again" : "Fetch from Canvas",
      ),
      catalogue
        ? h(
            "span",
            { className: "pp-savenote" },
            catalogue.options.length +
              " from " +
              catalogue.host +
              " · course " +
              catalogue.courseId,
          )
        : null,
    ),
    failure("fetch") ? h("p", { className: "pp-saveerr" }, failure("fetch")) : null,
    offered.length === 0
      ? h(
          "p",
          { className: "pp-absent" },
          catalogue
            ? "Canvas returned no sections or groups for this course."
            : "Nothing is mapped yet. Fetching from Canvas is what fills this in.",
        )
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
                  (option.students === null ? "" : " · " + option.students + " students") +
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
                      h(
                        "option",
                        { value: entry.group, key: entry.group },
                        entry.group + " (" + entry.students + ")",
                      ),
                    ),
                  ),
                )
              : null,
          );
        }),
    h(
      "div",
      { className: "pp-saverow" },
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn" + (dirty ? " pp-danger" : ""),
          disabled: status === "saving" || !dirty,
          title: data.run.recordPath
            ? "Write extensions.lms.canvas_sections to " + data.run.recordPath
            : "This run's record could not be located",
          onClick: save,
        },
        status === "saving" ? "Saving…" : "Save to the run record",
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-segbtn",
          disabled: !dirty,
          onClick: () => {
            setPicked(seed(data.selections));
            setStatus(null);
          },
        },
        "Revert",
      ),
      failure("save")
        ? h("span", { className: "pp-saveerr" }, failure("save"))
        : saved
          ? h(
              "span",
              { className: "pp-savenote" },
              "Wrote " +
                saved.count +
                " selection" +
                (saved.count === 1 ? "" : "s") +
                " to " +
                saved.path +
                ".",
            )
          : null,
    ),

    h("p", { className: "pp-factgroup" }, "Assessments"),
    data.assessments.length === 0
      ? h(
          "p",
          { className: "pp-absent" },
          "This run has no assessments yet, so there is nothing to link. " +
            "Drafting one is /design-assessment.",
        )
      : data.assessments.map((assessment) =>
          h(
            Fact,
            {
              label: assessment.title || assessment.assessmentId,
              note:
                assessment.assessmentId +
                " · sheet tab " +
                (assessment.sheetTab || assessment.defaultSheetTab) +
                (assessment.sheetTab ? "" : " (derived)"),
              missing: assessment.canvasAssignmentId === null,
              key: assessment.assessmentId,
            },
            assessment.canvasAssignmentId ||
              h(Presence, { present: false, no: "no Canvas column" }),
          ),
        ),
    data.assessments.some((assessment) => assessment.canvasAssignmentId === null)
      ? h(
          "p",
          { className: "pp-absent" },
          "A Canvas column goes on the assessment as extensions.lms." +
            "canvas_assignment_id. Without one, a push has no column to write and " +
            "`ainar lms plan` says so — though sending the definition below " +
            "creates the assignment and writes its id here for you.",
        )
      : null,
    h(DefinitionPush, {
      runId: props.runId,
      sessionId: props.sessionId,
      assessments: data.assessments,
      subgroups: data.subgroups,
    }),
  );
}

/**
 * Sending an assessment's DEFINITION to Canvas — its title, points, dates,
 * what may be handed in, and the brief as the description.
 *
 * Everything else on this tab RECORDS a linkage: which Canvas assignment
 * is which. This is the one control that changes something a class can
 * see, so it is shaped like the approval strip rather than like its
 * neighbours:
 *
 * * **preview first, always.** The send button does not exist until a plan
 *   has come back, and the plan is the CLI's own words. A professor who has
 *   not read what would change cannot send it.
 * * **the send button is the only red thing here**, which is the pane's
 *   existing signal for a press that writes outside this machine.
 * * **drift needs its own press.** A field somebody edited in Canvas is
 *   left alone by default; replacing it is a second checkbox that only
 *   appears when the plan actually reported drift, and it is cleared again
 *   after every send so it cannot carry over to the next one.
 *
 * The subgroup selector defaults to "every subgroup", which is what the
 * command does and is the point of it: one definition serves the whole
 * class, and a send that reached CS-401 and not CS-402 is how two halves
 * end up being told different things.
 */
function DefinitionPush(props) {
  const assessments = props.assessments || [];
  const subgroups = (props.subgroups || []).map((entry) => entry.group);
  const [assessment, setAssessment] = React.useState(
    assessments.length ? assessments[0].assessmentId : "",
  );
  const [group, setGroup] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [result, setResult] = React.useState(null);
  const [overwrite, setOverwrite] = React.useState(false);

  // A plan belongs to the assessment and subgroup it was asked about.
  // Changing either throws it away, so the red button can never send
  // something other than what was read.
  const reset = () => {
    setResult(null);
    setOverwrite(false);
  };

  const call = (confirm) => {
    setPhase(confirm ? "sending" : "planning");
    fetch(
      scoped(
        BASE + "/api/canvas/assignment?run=" + encodeURIComponent(props.runId || ""),
        props.sessionId,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessment: assessment,
          group: group,
          confirm: confirm,
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
        if (confirm) setOverwrite(false);
      })
      .catch((error) => {
        setPhase("idle");
        setResult({ failed: true, text: String((error && error.message) || error), sent: false });
      });
  };

  if (!assessments.length) return null;

  // Only offered when the plan said somebody had edited Canvas by hand.
  const sawDrift = Boolean(result) && !result.failed && /edited in Canvas/.test(result.text);
  const previewed = Boolean(result) && !result.failed && !result.sent;

  return h(
    "div",
    null,
    h("p", { className: "pp-factgroup" }, "Send a definition to Canvas"),
    h(
      "p",
      { className: "pp-absent" },
      "Title, points, dates, what may be handed in, and the brief as the " +
        "assignment description. Not the marks — those are ainar lms push.",
    ),
    h(
      "div",
      { className: "pp-bind" },
      h("span", { className: "pp-bindname" }, "Assessment"),
      h(
        "select",
        {
          className: "pp-bindsel",
          value: assessment,
          onChange: (event) => {
            setAssessment(event.target.value);
            reset();
          },
        },
        assessments.map((entry) =>
          h(
            "option",
            { value: entry.assessmentId, key: entry.assessmentId },
            entry.title || entry.assessmentId,
          ),
        ),
      ),
    ),
    subgroups.length
      ? h(
          "div",
          { className: "pp-bind" },
          h("span", { className: "pp-bindname" }, "Subgroup"),
          h(
            "select",
            {
              className: "pp-bindsel",
              value: group,
              onChange: (event) => {
                setGroup(event.target.value);
                reset();
              },
            },
            [h("option", { value: "", key: "*" }, "Every subgroup")].concat(
              subgroups.map((name) => h("option", { value: name, key: name }, name)),
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
          onClick: () => call(false),
        },
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
      ? h(
          "pre",
          { className: "pp-approveout" + (result.failed ? " pp-approveerr" : "") },
          result.text,
        )
      : null,
  );
}
