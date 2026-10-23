/**
 * Teaching: one week between its neighbours. The week in focus is the large
 * card; the one before says what was taught and handed in and how its
 * concepts landed, the one after what has to be ready. ‹ › steps without a
 * round trip, and the step is reported up (`onStep`) so course mode returns to
 * it after visiting another reading.
 *
 * Private: it carries class figures — a concept's class mean over approved
 * evidence, how much has been handed in, the open signals — computed on the
 * host. The JSX of `teachingBody` (server/course-mode.js).
 */

import { h, Fragment, React } from "../react.js";
import { conceptsOf, MEETING_ICON, pct, promptFor, REVISIT_BELOW, shortDate, titleOf } from "../../shared/course-words.js";
import { AskButton, ConceptChip, Icon, MaterialChips, StatusLine, WorkChip } from "./parts.jsx";
import { EditButton, ModuleTitles } from "./edit.jsx";

function WorkLine(props) {
  const { a, verb, date, withHanded, week, handed, status } = props;
  const got = handed[a.assessment_id];
  const showStatus = withHanded || !((week && week.due) || []).some((d) => d.assessment_id === a.assessment_id);
  return (
    <li>
      <WorkChip work={a} when={verb + " " + shortDate(date)} />
      <EditButton kind="assessment" id={a.assessment_id} title="Change its title or description" />
      {withHanded && got && got.enrolled ? (
        <small>
          {got.received} of {got.enrolled} handed in
        </small>
      ) : null}
      {showStatus ? <StatusLine work={a} status={status} /> : null}
    </li>
  );
}

function DeckNeed(props) {
  const { w, run } = props;
  const meets = w.meetings || [];
  if (!meets.length || meets.some((m) => (m.resources || []).some((r) => r.kind === "slides"))) return null;
  return (
    <div className="need">
      <Icon name="slides" />
      <span>No slides yet</span>
      <AskButton prompt={promptFor("deck", w, run)} label="Draft slides" className="chip ask strong" />
    </div>
  );
}

function Side(props) {
  const { w, label, current, concepts, handed, status, run, onGo } = props;
  if (!w) {
    return (
      <div className="side empty">
        <small>{label}</small>
        <p>Outside the run.</p>
      </div>
    );
  }
  const taught = current !== null && w.week < current;
  return (
    <div className="side">
      <small>
        {label} · week {w.week}
      </small>
      <b>{titleOf(w) ? <ModuleTitles modules={w.modules} /> : "No topic yet"}</b>
      <ul className="facts">
        {(w.meetings || []).map((m) => (
          <li key={m.activity_id}>
            <Icon name={MEETING_ICON[m.type] || "lecture"} />
            <span>
              {shortDate(m.on) || "no date"} · {m.type}
            </span>
            <small>{m.location || ""}</small>
          </li>
        ))}
        {(w.opens || []).map((a) => (
          <WorkLine key={"o" + a.assessment_id} a={a} verb="opens" date={a.opens_on} withHanded={false} week={w} handed={handed} status={status} />
        ))}
        {(w.due || []).map((a) => (
          <WorkLine key={"d" + a.assessment_id} a={a} verb="due" date={a.due_on} withHanded={true} handed={handed} status={status} />
        ))}
        {taught
          ? conceptsOf(w).map((c) => {
              const x = concepts[c.id];
              return (
                <li key={c.id}>
                  <Icon name="concept" />
                  <span>{c.title || c.id}</span>
                  <small>
                    {x && x.class_mean !== null && x.class_mean !== undefined ? "class " + pct(x.class_mean) + " · " + (x.coverage || "") : "not assessed yet"}
                  </small>
                </li>
              );
            })
          : null}
      </ul>
      <DeckNeed w={w} run={run} />
      <button type="button" className="link" onClick={() => onGo(w.week)}>
        Make this the focus ›
      </button>
    </div>
  );
}

function Focus(props) {
  const { w, run, current, at, concepts, handed, signals, status } = props;
  const misdated = (w.gaps || []).find((g) => g.kind === "misdated");
  const meetings = w.meetings || [];
  const work = [
    ...(w.opens || []).map((a) => (
      <WorkLine key={"o" + a.assessment_id} a={a} verb="opens" date={a.opens_on} withHanded={false} week={w} handed={handed} status={status} />
    )),
    ...(w.due || []).map((a) => (
      <WorkLine key={"d" + a.assessment_id} a={a} verb="due" date={a.due_on} withHanded={true} handed={handed} status={status} />
    )),
  ];
  // What to repair before building on it: concepts taught in the two weeks
  // before the focus whose class mean sits under the line.
  const revisit = [w.week - 1, w.week - 2]
    .map(at)
    .filter(Boolean)
    .flatMap((p) =>
      conceptsOf(p)
        .map((c) => ({ c, x: concepts[c.id], week: p.week }))
        .filter(({ x }) => x && x.class_mean !== null && x.class_mean !== undefined && x.class_mean < REVISIT_BELOW),
    );
  const module = (w.modules || [])[0];
  const prepare =
    "For week " + w.week + " of " + run.id + (module ? " (" + module.module_id + ")" : "") + ", what should I teach and what should I revisit first?" +
    (revisit.length ? " The class is weakest on " + revisit.map((r) => r.c.title || r.c.id).join(" and ") + "." : "");
  return (
    <div className="focus">
      <small>
        {w.week === current ? "This week" : "Week " + w.week} · {shortDate(w.starts_on)} – {shortDate(w.ends_on)}
      </small>
      <h2>{titleOf(w) ? <ModuleTitles modules={w.modules} /> : "No topic yet"}</h2>
      {conceptsOf(w).length ? (
        <div className="concepts">
          <Icon name="concept" />
          {conceptsOf(w).map((c) => (
            <ConceptChip key={c.id} concept={c} />
          ))}
        </div>
      ) : null}
      {meetings.length ? (
        <ul className="facts big">
          {meetings.map((m) => {
            const resources = [...(m.resources || [])].sort((a, b) => (a.kind === "slides" ? 0 : 1) - (b.kind === "slides" ? 0 : 1));
            return (
              <li key={m.activity_id}>
                <Icon name={MEETING_ICON[m.type] || "lecture"} />
                <span>
                  {shortDate(m.on) || "no date"} · {[m.type, m.location].filter(Boolean).join(" · ")}
                </span>
                <EditButton kind="activity" id={m.activity_id} title="Change this meeting: its title, room, description" />
                {resources.map((r, i) => (
                  <MaterialChips key={(r.resource_id || r.title) + i} resource={r} />
                ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="calm">No meeting this week.</p>
      )}
      {misdated
        ? misdated.ids.map((id) => {
            const m = meetings.find((x) => x.activity_id === id) || {};
            const word = m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "A meeting";
            return (
              <div className="need warn" title={misdated.note} key={id}>
                <Icon name="misdated" />
                <span>
                  {word} dated {shortDate(m.on)},{" "}
                  {m.on < w.starts_on ? "before this week starts (" + shortDate(w.starts_on) + ")" : "after this week ends (" + shortDate(w.ends_on) + ")"}
                </span>
                <AskButton prompt={promptFor("misdated", w, run, id)} label="Check date" className="chip ask strong" />
              </div>
            );
          })
        : null}
      <DeckNeed w={w} run={run} />
      {work.length ? <ul className="facts">{work}</ul> : <p className="calm">Nothing graded opens or falls due this week.</p>}
      {revisit.length || signals.length ? (
        <div className="revisit">
          <b>Revisit first</b>
          {revisit.map((r) => (
            <p key={r.c.id + r.week}>
              {r.c.title || r.c.id} — class {pct(r.x.class_mean)} on {r.x.coverage || ""} observed, taught in week {r.week}
            </p>
          ))}
          {signals.length ? (
            <p>
              {signals.length} open signal{signals.length === 1 ? "" : "s"}: {signals[0].description || ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <AskButton prompt={prepare} label="Prepare this week" className="primary" />
    </div>
  );
}

export function Teaching(props) {
  const { data, evidence, status } = props;
  const run = data.run || {};
  const weeks = data.weeks || [];
  const current = data.current_week ?? null;
  const at = (n) => weeks.find((w) => w.week === n) || null;
  const ev = evidence || {};
  const concepts = ev.concepts || {};
  const handed = ev.handed_in || {};
  const signals = ev.signals || [];

  // The week the professor last stepped to, when course mode kept one;
  // otherwise this week.
  const [focus, setFocus] = React.useState(() => (props.focus && weeks.some((w) => w.week === props.focus) ? props.focus : current || 1));
  const go = (n) => {
    setFocus(n);
    if (props.onStep) props.onStep(n);
    if (props.onScrollTop) props.onScrollTop();
  };
  const w = at(focus) || weeks[0];
  if (!w) return <div className="mode" />;
  const prev = at(w.week - 1);
  const next = at(w.week + 1);
  const shared = { current, concepts, handed, status, run, onGo: go };
  return (
    <div className="mode">
      <section className="trio-wrap">
        <div className="stepper">
          {prev ? (
            <button type="button" className="chip" onClick={() => go(prev.week)}>
              ‹ Week {prev.week}
            </button>
          ) : null}
          <b>
            Week {w.week} of {weeks.length}
          </b>
          {current !== null && w.week !== current ? (
            <button type="button" className="chip" onClick={() => go(current)}>
              Back to this week
            </button>
          ) : null}
          {next ? (
            <button type="button" className="chip" onClick={() => go(next.week)}>
              Week {next.week} ›
            </button>
          ) : null}
          <span className="private">Private — class figures from approved evidence only</span>
        </div>
        <div className="trio">
          <Side w={prev} label="Before" {...shared} />
          <Focus w={w} run={run} current={current} at={at} concepts={concepts} handed={handed} signals={signals} status={status} />
          <Side w={next} label="After" {...shared} />
        </div>
      </section>
    </div>
  );
}
