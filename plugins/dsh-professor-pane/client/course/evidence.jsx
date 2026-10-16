/**
 * Evidence: how each week actually went. Per week, the work that fell due
 * with the gradebook's own figures for it, the concepts the week's module
 * teaches with their class mean, and the class-level signals about those
 * concepts. A run of two or more weeks with nothing due and nothing measured
 * is one band.
 *
 * Private, from approved evidence only, aggregates only. Every figure is the
 * host's; grouping under weeks is the only thing done here. The JSX of
 * `evidenceBody` (server/course-mode.js).
 */

import { h, Fragment } from "../react.js";
import { conceptsOf, pct, REVISIT_BELOW, shortDate, titleOf } from "../../shared/course-words.js";
import { AskButton, Dash, Icon, StatusLine, twoDigits, WorkChip } from "./parts.jsx";
import { rowsOf } from "./term.jsx";

function SignalLine(props) {
  const s = props.signal;
  return (
    <li className={s.severity === "high" ? "flagged" : ""}>
      <Icon name="concept" />
      <span>{s.description}</span>
      {s.severity ? <small>{s.severity}</small> : null}
    </li>
  );
}

/**
 * Work in a week still to come has nothing to report yet: the gradebook counts
 * every row with no hand-in as `not_submitted` whatever the date, and "81 not
 * handed in" for a quiz due next week is an accusation.
 */
function Figures(props) {
  const { a, w, work } = props;
  if (w.when === "upcoming") return <small className="none">not due yet</small>;
  const f = work[a.assessment_id];
  if (!f) return <small className="none">no approved marks yet</small>;
  const out = [];
  if (f.enrolled !== null && f.submitted !== null) out.push(f.submitted + " of " + f.enrolled + " handed in");
  if (f.not_submitted) out.push(f.not_submitted + " not handed in");
  if (f.graded !== null) out.push(f.graded + " graded" + (f.partially_graded ? " · " + f.partially_graded + " partly" : ""));
  if (f.mean !== null) out.push("mean " + f.mean + (f.maximum !== null ? " of " + f.maximum : ""));
  if (f.median !== null) out.push("median " + f.median);
  return <small>{out.join(" · ")}</small>;
}

export function Evidence(props) {
  const { data, evidence, status } = props;
  const run = data.run || {};
  const weeks = data.weeks || [];
  const current = data.current_week ?? null;
  const ev = evidence || {};
  const concepts = ev.concepts || {};
  const work = ev.work || {};
  const signals = ev.signals || [];
  const has = (c) => concepts[c.id] && concepts[c.id].class_mean !== null && concepts[c.id].class_mean !== undefined;

  // A signal belongs to the first week that teaches one of its concepts.
  const weekOfConcept = new Map();
  for (const w of weeks) for (const c of conceptsOf(w)) if (!weekOfConcept.has(c.id)) weekOfConcept.set(c.id, w.week);
  const signalWeek = (s) => (s.concepts || []).map((c) => weekOfConcept.get(c)).find((n) => n !== undefined) ?? null;
  const loose = signals.filter((s) => signalWeek(s) === null);
  const measured = (w) => (w.due || []).length > 0 || conceptsOf(w).some(has) || signals.some((s) => signalWeek(s) === w.week);

  const weekRow = (w) => {
    const here = signals.filter((s) => signalWeek(s) === w.week);
    const module = (w.modules || [])[0];
    const weak = conceptsOf(w).filter((c) => has(c) && concepts[c.id].class_mean < REVISIT_BELOW);
    return (
      <Fragment>
        <div className={"wkhead " + (w.when === "current" ? "now" : w.when === "past" ? "past" : "")} id={"week-" + w.week}>
          <b>{twoDigits(w.week)}</b>
          <span className="k mono">
            {shortDate(w.starts_on)} – {shortDate(w.ends_on)}
          </span>
          {titleOf(w) ? <h3>{titleOf(w)}</h3> : <h3 className="none">Unplanned</h3>}
          {w.when === "current" ? <span className="pill now">this week</span> : null}
          <span className="askw">
            {weak.length ? (
              <AskButton
                prompt={
                  "In week " + w.week + " of " + run.id + (module ? " (" + module.module_id + ")" : "") + ", the class is weakest on " +
                  weak.map((c) => c.id).join(", ") + ". Read the approved evidence for those concepts and tell me what went wrong " +
                  "and what to revisit. Change nothing."
                }
                label="Why did this week go wrong?"
              />
            ) : null}
          </span>
        </div>
        <div className="cell" data-col="Due that week">
          {(w.due || []).length ? (
            <ul className="facts">
              {w.due.map((a) => (
                <li key={a.assessment_id}>
                  <WorkChip work={a} when={"due " + shortDate(a.due_on)} />
                  <Figures a={a} w={w} work={work} />
                  <StatusLine work={a} status={status} />
                </li>
              ))}
            </ul>
          ) : (
            <Dash />
          )}
        </div>
        <div className="cell" data-col="Concepts taught">
          {conceptsOf(w).length ? (
            <ul className="facts">
              {conceptsOf(w).map((c) => {
                const x = concepts[c.id];
                const low = has(c) && x.class_mean < REVISIT_BELOW;
                return (
                  <li key={c.id} className={low ? "flagged" : ""}>
                    <Icon name="concept" />
                    <span>{c.title || c.id}</span>
                    <small>{has(c) ? "class " + pct(x.class_mean) + " · " + (x.coverage || "") + " observed" + (low ? " · revisit" : "") : "not assessed yet"}</small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Dash />
          )}
        </div>
        <div className="cell" data-col="Signals">
          {here.length ? (
            <ul className="facts">
              {here.map((s, i) => (
                <SignalLine key={i} signal={s} />
              ))}
            </ul>
          ) : (
            <Dash />
          )}
        </div>
      </Fragment>
    );
  };

  return (
    <div className="mode evidence">
      <div className="stepper">
        <b>{current ? "Week " + current + " of " + weeks.length : weeks.length + " weeks"}</b>
        <span className="private">Private — class figures from approved evidence only</span>
      </div>
      {loose.length ? (
        <div className="side">
          <small>Open signals not tied to a week</small>
          <ul className="facts">
            {loose.map((s, i) => (
              <SignalLine key={i} signal={s} />
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid">
        <div className="th">Due that week</div>
        <div className="th">Concepts taught</div>
        <div className="th">Signals</div>
        {rowsOf(weeks, (w) => !measured(w)).map((row) => {
          if (!row.band) return <Fragment key={row.week.week}>{weekRow(row.week)}</Fragment>;
          const a = row.band[0];
          const z = row.band[row.band.length - 1];
          const holds = current !== null && current >= a.week && current <= z.week;
          return (
            <div key={"band" + a.week} className={"band" + (holds ? " now" : "")} id={"week-" + a.week}>
              <b>
                <Icon name="calendar" /> Weeks {a.week}–{z.week}
              </b>
              <span className="k mono">
                {shortDate(a.starts_on)} – {shortDate(z.ends_on)}
              </span>
              <span className="none">nothing due, nothing measured yet</span>
            </div>
          );
        })}
      </div>
      <p className="foot">
        Hand-ins and marks are the gradebook's, from approved decisions; a concept's class mean is over approved evidence. A concept under{" "}
        {pct(REVISIT_BELOW)} is marked to revisit.
      </p>
    </div>
  );
}
