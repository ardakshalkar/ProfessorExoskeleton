/**
 * Course mode · Concepts: concept × student, from `/api/concepts-grid`
 * (server/concepts-grid.js). BACKLOG E37 HOME-8 and HOME-9;
 * docs/PROFESSOR-JOURNEY.md §7.
 *
 * Concepts down, in the order the term teaches them; students across, by
 * subgroup. A cell is the student's mean on the evidence for that concept,
 * in the dashboard's five bands; pale when it rests on one piece of
 * evidence; empty when there is none; a dot when a state has been recorded.
 * The figures are the payload's — this file sorts and colours, it adds up
 * nothing.
 *
 * Three ways in (`focus`): a student, from the class list; a concept, from a
 * week's concept chip; a week, from Evidence. Each opens the same grid with
 * that student's column, that concept's row, or that week's concepts.
 *
 * What the professor can do from here is look, and ask: why a concept is not
 * landing (`/find-gaps`), how to revisit it (`/prepare-lesson`), or a report
 * on a student (`/student-report`) — each a prompt into the session. Nothing
 * here writes.
 */

import { Message, useJson } from "./common.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

const pct = (value) => (value === null || value === undefined ? "—" : Math.round(value * 100) + "%");
const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
const STATE_WORDS = {
  not_observed: "not observed",
  introduced: "introduced",
  developing: "developing",
  demonstrated: "demonstrated",
  consistently_demonstrated: "consistently demonstrated",
  needs_review: "needs review",
};

/** The band index (0 = strongest) and name for a proportion, from the payload's bands. */
const bandOf = (bands, value) => {
  if (value === null || value === undefined) return null;
  const index = bands.findIndex((band) => value >= band[0]);
  return index < 0 ? bands.length - 1 : index;
};

/** What a student is called on screen: their name in Names mode, else the code. */
const who = (student) => student.name || student.id;
/** A column's few letters: initials, or the code's last four. */
const shortOf = (student) =>
  student.name
    ? student.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : student.id.slice(-4);

function Cell(props) {
  const cell = props.cell;
  const band = bandOf(props.bands, cell[0]);
  const thin = cell[1] === 1;
  return h(
    "button",
    {
      type: "button",
      className:
        "pp-cg-cell" +
        (band === null ? " pp-cg-none" : " pp-cg-b" + band) +
        (thin ? " pp-cg-thin" : "") +
        (props.selected ? " pp-cg-sel" : "") +
        (props.lit ? " pp-cg-lit" : ""),
      title:
        who(props.student) +
        " · " +
        props.concept.title +
        "\n" +
        (cell[1] ? pct(cell[0]) + " on " + plural(cell[1], "piece") + " of evidence" : "no evidence") +
        (cell[2] ? "\nrecorded: " + (STATE_WORDS[cell[2]] || cell[2]) : ""),
      onClick: props.onClick,
    },
    cell[2] ? h("i", { className: "pp-cg-state", "aria-hidden": "true" }) : null,
  );
}

/** The side panel for one cell: the evidence behind it. */
function CellPanel(props) {
  const url = scoped(
    BASE +
      "/api/concepts-grid/cell?run=" +
      encodeURIComponent(props.runId || "") +
      "&student=" +
      encodeURIComponent(props.student.id) +
      "&concept=" +
      encodeURIComponent(props.concept.id) +
      (props.drafts ? "&drafts=1" : ""),
    props.sessionId,
  );
  const state = useJson(url);
  const answer = state.phase === "ready" ? state.value : null;
  return h(
    React.Fragment,
    null,
    h("p", { className: "pp-cg-ptitle" }, h("b", null, who(props.student)), h("span", null, props.concept.title)),
    h(
      "p",
      { className: "pp-as" },
      props.cell[1] ? pct(props.cell[0]) + " on " + plural(props.cell[1], "piece") + " of evidence" : "No evidence for this concept yet.",
      props.cell[2] ? " · recorded: " + (STATE_WORDS[props.cell[2]] || props.cell[2]) : "",
    ),
    !answer
      ? h("p", { className: "pp-as" }, "Reading the evidence…")
      : answer.error
        ? h("p", { className: "pp-saveerr" }, answer.error)
        : answer.items.length
          ? h(
              "ul",
              { className: "pp-cg-ev" },
              answer.items.map((item) =>
                h(
                  "li",
                  { key: item.id },
                  h("span", null, item.assessment || item.source || "—"),
                  item.criterion ? h("small", null, item.criterion) : null,
                  h(
                    "b",
                    null,
                    item.score !== null && item.maximum !== null ? item.score + " / " + item.maximum : pct(item.proportion),
                  ),
                ),
              ),
            )
          : null,
    h(
      "div",
      { className: "pp-dacts" },
      h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onStudent() }, "All of " + (props.student.name ? props.student.name.split(/\s+/)[0] : "this student") + "'s concepts"),
      h("button", { type: "button", className: "pp-segbtn", onClick: () => props.onConcept() }, "The class on this concept"),
    ),
  );
}

/** The side panel for one concept: how the class is spread, and who is under the line. */
function ConceptPanel(props) {
  const concept = props.concept;
  const students = props.students;
  const counts = props.bands.map(() => 0);
  let none = 0;
  const under = [];
  concept.cells.forEach((cell, i) => {
    if (!props.shown[i]) return;
    const band = bandOf(props.bands, cell[0]);
    if (band === null) none += 1;
    else counts[band] += 1;
    if (cell[0] !== null && cell[0] < props.threshold) under.push({ student: students[i], value: cell[0], evidence: cell[1] });
  });
  under.sort((a, b) => a.value - b.value);
  const run = props.runId;
  return h(
    React.Fragment,
    null,
    h("p", { className: "pp-cg-ptitle" }, h("b", null, concept.title), h("span", null, concept.week ? "Week " + concept.week : "Not on a week")),
    h("p", { className: "pp-as" }, "Class " + pct(concept.class_mean) + " · " + concept.covered + " of " + concept.cells.length + " observed"),
    h(
      "div",
      { className: "pp-cg-spread" },
      props.bands.map((band, i) =>
        h("span", { key: band[1], className: "pp-cg-spreadrow" }, h("i", { className: "pp-cg-cell pp-cg-b" + i }), band[1], h("b", null, String(counts[i]))),
      ),
      h("span", { className: "pp-cg-spreadrow" }, h("i", { className: "pp-cg-cell pp-cg-none" }), "no evidence", h("b", null, String(none))),
    ),
    under.length
      ? h(
          React.Fragment,
          null,
          h("p", { className: "pp-cg-sub" }, plural(under.length, "student") + " under " + pct(props.threshold)),
          h(
            "ul",
            { className: "pp-cg-list" },
            under.slice(0, 40).map((row) =>
              h(
                "li",
                { key: row.student.id },
                h("button", { type: "button", className: "pp-linkbtn", onClick: () => props.onStudent(row.student.id) }, who(row.student)),
                h("small", null, pct(row.value) + " · " + plural(row.evidence, "piece")),
              ),
            ),
          ),
        )
      : null,
    props.ask
      ? h(
          "div",
          { className: "pp-dacts" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              title: "Ask the assistant to read the evidence and the prerequisites",
              onClick: () =>
                props.ask(
                  "/find-gaps " + run + " — why is " + concept.title + " (" + concept.id + ") not landing? Class mean " + pct(concept.class_mean) +
                    ", " + concept.covered + " of " + concept.cells.length + " students observed, " + under.length + " under " + pct(props.threshold) + ".",
                ),
            },
            "Ask why",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              title: "Ask the assistant how to revisit it in the next lesson",
              onClick: () => props.ask("/prepare-lesson " + run + " — plan how to revisit " + concept.title + " (" + concept.id + ") in the next session."),
            },
            "Plan a revisit",
          ),
        )
      : null,
  );
}

/** The side panel for one student: every concept, weakest first. */
function StudentPanel(props) {
  const index = props.index;
  const student = props.students[index];
  const rows = props.concepts
    .map((concept) => ({ concept, cell: concept.cells[index] }))
    .sort((a, b) => (a.cell[0] === null ? 2 : a.cell[0]) - (b.cell[0] === null ? 2 : b.cell[0]));
  const seen = rows.filter((row) => row.cell[1]).length;
  return h(
    React.Fragment,
    null,
    h("p", { className: "pp-cg-ptitle" }, h("b", null, who(student)), h("span", null, student.group || "")),
    student.name ? h("p", { className: "pp-as" }, h("code", null, student.id)) : null,
    h("p", { className: "pp-as" }, seen + " of " + rows.length + " concepts with evidence"),
    h(
      "ul",
      { className: "pp-cg-list" },
      rows.map((row) =>
        h(
          "li",
          { key: row.concept.id },
          h("i", { className: "pp-cg-cell " + (bandOf(props.bands, row.cell[0]) === null ? "pp-cg-none" : "pp-cg-b" + bandOf(props.bands, row.cell[0])) + (row.cell[1] === 1 ? " pp-cg-thin" : "") }),
          h("button", { type: "button", className: "pp-linkbtn", onClick: () => props.onConcept(row.concept.id) }, row.concept.title),
          h("small", null, row.cell[1] ? pct(row.cell[0]) + " · " + row.cell[1] : "—"),
        ),
      ),
    ),
    props.ask
      ? h(
          "div",
          { className: "pp-dacts" },
          h(
            "button",
            {
              type: "button",
              className: "pp-segbtn",
              title: "Ask the assistant for an evidence-based report on this student",
              onClick: () => props.ask("/student-report " + props.runId + " " + student.id),
            },
            "Write a report",
          ),
        )
      : null,
  );
}

/** Course mode · Concepts. */
export function ConceptsGrid(props) {
  const url = scoped(
    BASE +
      "/api/concepts-grid?run=" +
      encodeURIComponent(props.runId || "") +
      (props.names ? "&names=1" : "") +
      (props.drafts ? "&drafts=1" : "") +
      "&r=" +
      encodeURIComponent(String(props.revision || 0)),
    props.sessionId,
  );
  const state = useJson(url);
  const kept = React.useRef(null);
  if (state.phase === "ready" && state.value && !state.value.error) kept.current = state.value;

  const [group, setGroup] = React.useState("");
  const [week, setWeek] = React.useState("");
  const [show, setShow] = React.useState("all");
  const [find, setFind] = React.useState("");
  // What the side panel is about: { cell: [conceptId, studentId] } | { concept } | { student } | null.
  const [picked, setPicked] = React.useState(null);
  const rowRefs = React.useRef(new Map());

  // A door: a student, a concept or a week, sent with the place request.
  const focus = props.focus || null;
  React.useEffect(() => {
    if (!focus) return;
    if (focus.week) {
      setWeek(String(focus.week));
      setShow("all");
    }
    if (focus.concept) setPicked({ concept: focus.concept });
    else if (focus.student) setPicked({ student: focus.student });
  }, [focus ? focus.n : null]);
  // The row of a concept that was asked for, in view.
  React.useEffect(() => {
    const id = picked && (picked.concept || (picked.cell && picked.cell[0]));
    const row = id ? rowRefs.current.get(id) : null;
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [picked, kept.current]);

  const doc = kept.current;
  if (state.phase === "ready" && state.value && state.value.error && !doc) return h(Message, { error: true }, state.value.error);
  if (!doc) return h(Message, null, "Reading the evidence for every concept and student…");

  const needle = find.trim().toLowerCase();
  const shownStudent = doc.students.map(
    (student) => (!group || student.group === group) && (!needle || (who(student) + " " + student.id).toLowerCase().includes(needle)),
  );
  // Columns in subgroup order, then by what is on screen.
  const order = doc.students
    .map((student, index) => ({ student, index }))
    .filter((entry) => shownStudent[entry.index])
    .sort((a, b) => a.student.group.localeCompare(b.student.group) || who(a.student).localeCompare(who(b.student)));
  const rows = doc.concepts.filter(
    (concept) =>
      (!week || String(concept.week) === week) &&
      (show === "all" ||
        (show === "revisit" && concept.class_mean !== null && concept.class_mean < doc.threshold) ||
        (show === "untested" && !concept.covered)),
  );
  const revisitCount = doc.concepts.filter((concept) => concept.class_mean !== null && concept.class_mean < doc.threshold).length;
  const studentIndex = picked && picked.student ? doc.students.findIndex((student) => student.id === picked.student) : -1;
  const pickedConcept = picked && picked.concept ? doc.concepts.find((concept) => concept.id === picked.concept) : null;
  const pickedCell = picked && picked.cell ? { concept: doc.concepts.find((c) => c.id === picked.cell[0]), index: doc.students.findIndex((s) => s.id === picked.cell[1]) } : null;
  const litStudent = studentIndex >= 0 ? studentIndex : pickedCell ? pickedCell.index : -1;
  const litConcept = pickedConcept ? pickedConcept.id : pickedCell && pickedCell.concept ? pickedCell.concept.id : null;

  const panel = () => {
    if (pickedCell && pickedCell.concept && pickedCell.index >= 0) {
      return h(CellPanel, {
        key: picked.cell.join("|"),
        runId: props.runId,
        sessionId: props.sessionId,
        drafts: props.drafts,
        student: doc.students[pickedCell.index],
        concept: pickedCell.concept,
        cell: pickedCell.concept.cells[pickedCell.index],
        onStudent: () => setPicked({ student: picked.cell[1] }),
        onConcept: () => setPicked({ concept: picked.cell[0] }),
      });
    }
    if (pickedConcept) {
      return h(ConceptPanel, {
        concept: pickedConcept,
        students: doc.students,
        shown: shownStudent,
        bands: doc.bands,
        threshold: doc.threshold,
        runId: props.runId,
        ask: props.ask,
        onStudent: (id) => setPicked({ student: id }),
      });
    }
    if (studentIndex >= 0) {
      return h(StudentPanel, {
        index: studentIndex,
        students: doc.students,
        concepts: rows,
        bands: doc.bands,
        runId: props.runId,
        ask: props.ask,
        onConcept: (id) => setPicked({ concept: id }),
      });
    }
    return null;
  };
  const side = panel();

  return h(
    "div",
    { className: "pp-cg" },
    h(
      "div",
      { className: "pp-cg-tools" },
      h(
        "span",
        { className: "pp-cg-shows" },
        [
          ["all", "All " + doc.concepts.length],
          ["revisit", "To revisit " + revisitCount],
          ["untested", "Not assessed " + doc.totals.no_evidence],
        ].map((entry) =>
          h("button", { key: entry[0], type: "button", className: "pp-segbtn", "aria-pressed": show === entry[0], onClick: () => setShow(entry[0]) }, entry[1]),
        ),
      ),
      h(
        "select",
        { className: "pp-runs pp-cg-select", value: week, "aria-label": "Week", onChange: (event) => setWeek(event.target.value) },
        h("option", { value: "" }, "Every week"),
        doc.weeks.map((entry) => h("option", { key: entry.week, value: String(entry.week) }, "Week " + entry.week + " · " + entry.title)),
      ),
      doc.groups.length > 1
        ? h(
            "select",
            { className: "pp-runs pp-cg-select", value: group, "aria-label": "Subgroup", onChange: (event) => setGroup(event.target.value) },
            h("option", { value: "" }, "Every subgroup"),
            doc.groups.map((entry) => h("option", { key: entry, value: entry }, entry)),
          )
        : null,
      h("input", {
        type: "search",
        className: "pp-cg-find",
        placeholder: "Find a student",
        "aria-label": "Find a student",
        value: find,
        onChange: (event) => setFind(event.target.value),
      }),
    ),
    h(
      "div",
      { className: "pp-cg-legend" },
      doc.bands.map((band, i) => h("span", { key: band[1] }, h("i", { className: "pp-cg-cell pp-cg-b" + i }), band[1] + " ≥" + pct(band[0]))),
      h("span", null, h("i", { className: "pp-cg-cell pp-cg-b2 pp-cg-thin" }), "pale: one piece of evidence"),
      h("span", null, h("i", { className: "pp-cg-cell pp-cg-none" }), "no evidence"),
      h("span", null, h("i", { className: "pp-cg-cell pp-cg-b1" }, h("i", { className: "pp-cg-state" })), "a state is recorded"),
      doc.totals.recorded_states
        ? null
        : h("span", { className: "pp-as" }, "No concept states are recorded yet — the colours are the evidence's means."),
    ),
    h(
      "div",
      { className: "pp-cg-body" + (side ? " pp-cg-withpanel" : "") },
      h(
        "div",
        { className: "pp-cg-scroll" },
        rows.length && order.length
          ? h(
              "table",
              { className: "pp-cg-table" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  h("th", { className: "pp-cg-corner" }, plural(rows.length, "concept") + " · " + plural(order.length, "student")),
                  order.map((entry) =>
                    h(
                      "th",
                      { key: entry.student.id, className: "pp-cg-colhead" + (entry.index === litStudent ? " pp-cg-lit" : "") },
                      h(
                        "button",
                        {
                          type: "button",
                          title: who(entry.student) + (entry.student.group ? " · " + entry.student.group : ""),
                          onClick: () => setPicked({ student: entry.student.id }),
                        },
                        shortOf(entry.student),
                      ),
                    ),
                  ),
                ),
              ),
              h(
                "tbody",
                null,
                rows.map((concept) =>
                  h(
                    "tr",
                    {
                      key: concept.id,
                      className: concept.id === litConcept ? "pp-cg-litrow" : "",
                      ref: (node) => {
                        if (node) rowRefs.current.set(concept.id, node);
                        else rowRefs.current.delete(concept.id);
                      },
                    },
                    h(
                      "th",
                      { className: "pp-cg-rowhead" },
                      h(
                        "button",
                        { type: "button", title: concept.id, onClick: () => setPicked({ concept: concept.id }) },
                        h("span", { className: "pp-cg-ctitle" }, concept.title),
                        h(
                          "small",
                          { className: concept.class_mean !== null && concept.class_mean < doc.threshold ? "pp-cg-low" : "" },
                          (concept.week ? "W" + concept.week + " · " : "") + (concept.covered ? pct(concept.class_mean) : "not assessed"),
                        ),
                      ),
                    ),
                    order.map((entry) =>
                      h(
                        "td",
                        { key: entry.student.id, className: entry.index === litStudent ? "pp-cg-lit" : "" },
                        h(Cell, {
                          cell: concept.cells[entry.index],
                          student: entry.student,
                          concept,
                          bands: doc.bands,
                          selected: Boolean(picked && picked.cell && picked.cell[0] === concept.id && picked.cell[1] === entry.student.id),
                          onClick: () => setPicked({ cell: [concept.id, entry.student.id] }),
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : h(Message, null, order.length ? "No concept matches these filters." : "No student matches these filters."),
      ),
      side
        ? h(
            "aside",
            { className: "pp-cg-panel" },
            h("button", { type: "button", className: "pp-close pp-cg-panelclose", "aria-label": "Close", onClick: () => setPicked(null) }, "×"),
            side,
          )
        : null,
    ),
  );
}
