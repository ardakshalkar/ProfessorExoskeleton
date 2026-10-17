/**
 * All weeks: the whole term in three columns — Lecture, Graded work,
 * Outcomes — with every hole drawn where its subject is, as the verb that
 * fills it. A run of two or more empty weeks is one band. The student preview
 * is the record alone: no hole, no card for undated work.
 *
 * The JSX of `courseModeDocument`'s term reading (server/course-mode.js).
 */

import { h, Fragment } from "../react.js";
import { datesPrompt, hasBrief, MEETING_ICON, promptFor, shortDate, tierOf } from "../../shared/course-words.js";
import { AskButton, Dash, GapChip, Icon, MaterialChips, press, StatusLine, twoDigits, WorkChip } from "./parts.jsx";
import { EditButton, ModuleTitles } from "./edit.jsx";

/** A week nobody has planned and nothing meets in: a candidate for a band. */
const isEmpty = (w) => !(w.modules || []).length && !(w.meetings || []).length;

/** One row per week, a band per run of two or more empty ones. */
export const rowsOf = (weeks, empty = isEmpty) => {
  const rows = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j < weeks.length && empty(weeks[j])) j += 1;
    if (j - i >= 2) {
      rows.push({ band: weeks.slice(i, j) });
      i = j;
    } else {
      rows.push({ week: weeks[i] });
      i += 1;
    }
  }
  return rows;
};

const undatedOf = (data) => {
  const out = [];
  for (const w of data.weeks || []) for (const a of w.undated || []) out.push({ a, w });
  for (const a of (data.unplaced && data.unplaced.assessments) || []) out.push({ a, w: null });
  return out;
};

/**
 * The holes, counted by when they bite — the strip's tally. The same holes the
 * rows below draw, in the same places.
 */
const tallyOf = (data, rows, current) => {
  const tally = { soon: 0, later: 0, past: 0 };
  for (const { w } of undatedOf(data)) tally[w ? tierOf(w, current) : "soon"] += 1;
  for (const row of rows) {
    if (row.band) {
      const tier = tierOf(row.band[0], current);
      for (const w of row.band) if ((w.gaps || []).some((g) => g.kind === "module")) tally[tier] += 1;
      continue;
    }
    const w = row.week;
    const tier = tierOf(w, current);
    const gaps = w.gaps || [];
    const has = (kind) => gaps.find((g) => g.kind === kind);
    tally[tier] += gaps.filter((g) => g.kind === "module" || g.kind === "weight").length;
    const misdated = new Set((has("misdated") && has("misdated").ids) || []);
    tally[tier] += (w.meetings || []).filter((m) => misdated.has(m.activity_id)).length;
    if (has("deck")) tally[tier] += 1;
    const seen = new Set();
    for (const a of [...(w.opens || []), ...(w.due || [])]) {
      if (!hasBrief(a) && !seen.has(a.assessment_id)) {
        seen.add(a.assessment_id);
        tally[tier] += 1;
      }
    }
  }
  return tally;
};

export function Tally(props) {
  const { data, current } = props;
  const tally = tallyOf(data, rowsOf(data.weeks || []), current);
  const title = Object.entries((data.totals && data.totals.gaps) || {})
    .map(([k, v]) => k + ": " + v)
    .join(" · ");
  return (
    <div className="tally" title={title}>
      <span className={tally.soon ? "soon" : "zero"}>{tally.soon} this week or next</span>
      <span className={tally.later ? "" : "zero"}>{tally.later} later</span>
      <span className="past">{tally.past} in weeks taught</span>
    </div>
  );
}

function WeekRow(props) {
  const { w, data, run, current, student, status } = props;
  const showGaps = !student;
  const tier = tierOf(w, current);
  const gaps = showGaps ? w.gaps || [] : [];
  const has = (kind) => gaps.find((g) => g.kind === kind);
  const misdated = new Set((has("misdated") && has("misdated").ids) || []);
  const module = (w.modules || [])[0];
  const title = (w.modules || []).map((m) => m.title).join(" · ");

  const concepts = (w.modules || []).flatMap((m) => (m.concepts || []).map((c) => c.title || c.id));

  // Lecture: each meeting with its own materials, the deck first.
  const lecture = (w.meetings || []).map((m) => {
    const resources = [...(m.resources || [])].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
    return (
      <div className="meeting" key={m.activity_id}>
        <span className={"chip meet" + (m.draft ? " draft" : "")} title={m.title || ""}>
          <span className="k mono">{shortDate(m.on) || "no date"}</span>
          <Icon name={MEETING_ICON[m.type] || "lecture"} />
          {[m.type, m.location].filter(Boolean).join(" · ")}
        </span>
        <EditButton kind="activity" id={m.activity_id} title="Change this meeting: its title, room, description" />
        {misdated.has(m.activity_id) ? (
          <GapChip kind="misdated" tier={tier} prompt={promptFor("misdated", w, run, m.activity_id)} title={has("misdated").note} />
        ) : null}
        {resources.map((r, i) => (
          <MaterialChips key={(r.resource_id || r.title) + i} resource={r} />
        ))}
      </div>
    );
  });
  const deckGap = has("deck");

  // Graded work, one column, the type said on the chip.
  const seen = new Set();
  const graded = [];
  for (const [list, verb, field] of [[w.opens, "opens", "opens_on"], [w.due, "due", "due_on"]]) {
    for (const a of list || []) {
      const last = verb === "due" || !(w.due || []).some((d) => d.assessment_id === a.assessment_id);
      graded.push(
        <Fragment key={verb + a.assessment_id}>
          <WorkChip work={a} when={verb + " " + shortDate(a[field])} />
          <EditButton kind="assessment" id={a.assessment_id} title="Change its title or description" />
          {student || !last ? null : <StatusLine work={a} status={status} />}
        </Fragment>,
      );
      if (showGaps && !hasBrief(a) && !seen.has(a.assessment_id)) {
        seen.add(a.assessment_id);
        graded.push(
          <GapChip
            key={"brief" + a.assessment_id}
            kind="brief"
            tier={tier}
            prompt={promptFor("brief", w, run, a.assessment_id)}
            title={a.assessment_id + " has no brief and no description."}
          />,
        );
      }
    }
  }
  // In the student preview there is no card for undated work, so it stays on
  // the week the record places it in.
  if (!showGaps) for (const a of w.undated || []) graded.push(<WorkChip key={"undated" + a.assessment_id} work={a} when="no date" />);

  // Outcomes: taught by the week's module, assessed by work falling due in it.
  const taught = new Map();
  for (const m of w.modules || []) for (const o of m.outcomes || []) taught.set(o.id, o.title || o.id);
  const assessed = new Set((w.due || []).flatMap((a) => a.outcomes || []));
  const outcomeIds = [...new Set([...taught.keys(), ...assessed])].sort();
  const titles = new Map((data.outcomes || []).map((o) => [o.outcome_id, o.title]));

  return (
    <Fragment>
      <div className={"wkhead " + (w.when === "current" ? "now" : w.when === "past" ? "past" : "")} id={"week-" + w.week}>
        <b>{twoDigits(w.week)}</b>
        <span className="k mono">
          {shortDate(w.starts_on)} – {shortDate(w.ends_on)}
        </span>
        {title ? <h3><ModuleTitles modules={w.modules} /></h3> : <h3 className="none">Unplanned</h3>}
        {w.when === "current" ? <span className="pill now">this week</span> : null}
        {(w.modules || []).some((m) => m.draft) ? <span className="pill draft">draft</span> : null}
        {gaps
          .filter((g) => g.kind === "module" || g.kind === "weight")
          .map((g) => (
            <GapChip key={g.kind} kind={g.kind} tier={tier} prompt={promptFor(g.kind, w, run)} title={g.note} />
          ))}
        {module ? (
          <AskButton
            className="chip ask askw"
            title="Ask the assistant to prepare this week"
            prompt={"For week " + w.week + " of " + run.id + " (" + module.module_id + "), what should I teach and what should I revisit first?"}
            label="Prepare"
          />
        ) : null}
      </div>
      {concepts.length ? (
        <div className="concepts">
          <Icon name="concept" />
          {concepts.map((c, i) => (
            <span className="chip concept" key={c + i}>
              {c}
            </span>
          ))}
        </div>
      ) : null}
      <div className="cell" data-col="Lecture">
        {lecture}
        {deckGap ? <GapChip kind="deck" tier={tier} prompt={promptFor("deck", w, run)} title={deckGap.note} /> : null}
        {lecture.length ? null : <Dash />}
      </div>
      <div className="cell" data-col="Graded work">
        {graded.length ? graded : <Dash />}
      </div>
      <div className="cell" data-col="Outcomes">
        {outcomeIds.length ? (
          outcomeIds.map((id) => {
            const how = taught.has(id) && assessed.has(id) ? "taught · assessed" : assessed.has(id) ? "assessed" : "taught";
            return (
              <span key={id} className={"chip lo" + (assessed.has(id) ? " hit" : "")} title={(taught.get(id) || titles.get(id) || id) + " — " + how}>
                <Icon name="outcome" />
                {id}
                <span className="k">{how}</span>
              </span>
            );
          })
        ) : (
          <Dash />
        )}
      </div>
    </Fragment>
  );
}

function BandRow(props) {
  const { band, run, current, student, status } = props;
  const a = band[0];
  const z = band[band.length - 1];
  const span = "Weeks " + a.week + "–" + z.week;
  const holds = current !== null && current >= a.week && current <= z.week;
  return (
    <div className={"band" + (holds ? " now" : "")} id={"week-" + a.week}>
      <b>
        <Icon name="calendar" /> {span}
      </b>
      <span className="k mono">
        {shortDate(a.starts_on)} – {shortDate(z.ends_on)}
      </span>
      <span className="none">{student ? "no sessions scheduled" : "unplanned · " + band.length + " weeks"}</span>
      {band.flatMap((w) => [
        ...(w.opens || []).map((x) => (
          <Fragment key={"o" + w.week + x.assessment_id}>
            <WorkChip work={x} when={"opens " + shortDate(x.opens_on)} />
            {student ? null : <StatusLine work={x} status={status} />}
          </Fragment>
        )),
        ...(w.due || []).map((x) => (
          <Fragment key={"d" + w.week + x.assessment_id}>
            <WorkChip work={x} when={"due " + shortDate(x.due_on)} />
            {student ? null : <StatusLine work={x} status={status} />}
          </Fragment>
        )),
      ])}
      {student ? null : (
        <button
          type="button"
          className={"chip gap " + tierOf(a, current)}
          data-ask=""
          onClick={() =>
            press.ask(
              span + " of " + run.id + " have no module. Propose what they should teach, given what comes before them " +
                "and what falls due in them, as draft modules for me to read.",
            )
          }
        >
          <Icon name="module" />
          Plan {span.toLowerCase()}
        </button>
      )}
    </div>
  );
}

export function Term(props) {
  const { data, student, status } = props;
  const run = data.run || {};
  const current = data.current_week ?? null;
  const undated = undatedOf(data);
  return (
    <Fragment>
      {!student && undated.length ? (
        <div className="lead">
          <b>
            <Icon name="misdated" /> {undated.length} {undated.length === 1 ? "thing is" : "things are"} not on the calendar yet
          </b>
          {undated.map(({ a, w }) => (
            <Fragment key={a.assessment_id}>
              <WorkChip work={a} when="no date" />
              <StatusLine work={a} status={status} />
              <GapChip
                kind="deadline"
                tier={w ? tierOf(w, current) : "soon"}
                prompt={datesPrompt(a, run)}
                title={a.assessment_id + " has no dates" + (w ? "; its module is week " + w.week : "") + "."}
              />
            </Fragment>
          ))}
        </div>
      ) : null}
      <div className="grid">
        <div className="th">Lecture</div>
        <div className="th">Graded work</div>
        <div className="th">Outcomes</div>
        {rowsOf(data.weeks || []).map((row) =>
          row.band ? (
            <BandRow key={"band" + row.band[0].week} band={row.band} run={run} current={current} student={student} status={status} />
          ) : (
            <WeekRow key={row.week.week} w={row.week} data={data} run={run} current={current} student={student} status={status} />
          ),
        )}
      </div>
      <StructureFoot />
    </Fragment>
  );
}

export function StructureFoot() {
  return (
    <p className="foot">
      Structure only — nothing here is derived from student work. Accepting a draft is changing{" "}
      <span className="mono">approval: draft</span> in its record; this page points at records and changes none.
    </p>
  );
}
