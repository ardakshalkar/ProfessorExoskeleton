/**
 * Planning: does the term hold together. The weights against a whole, one row
 * per week with its topic and the graded work running through it as lanes,
 * and the faults said as sentences with one press each.
 *
 * And the one reading that writes — dates only. Drag a bar to another week, or
 * one of its ends, or a topic with its meetings, and it MOVES THERE AT ONCE:
 * the drop is an override on the data being drawn, and a small form asks Save
 * or Cancel. Cancel, or a refusal from the server, takes the override away and
 * the bar goes back. Save writes the record (`/api/plan/dates`,
 * `/api/plan/topic`) and keeps the override until the course, read again,
 * agrees with it — so nothing jumps back while the write lands.
 *
 * A drop moves by whole weeks, seven days per week crossed, so a quiz due
 * Friday 23:59 is still due Friday 23:59. "Change dates" opens the inputs when
 * the week is not the whole story. Each date keeps its own offset: what an
 * input shows is the record's wall time, and what goes back is that wall time
 * with the same offset, so there is no time-zone arithmetic here.
 *
 * The guardrails are drawn here and enforced again by the writes
 * (`planLocks`, server/plan-writes.js): work with results has no handle and no
 * date button, a week already taught takes no drop, and work that opened in
 * one moves only by its due end.
 *
 * The JSX of `planningBody` and `PLAN_SCRIPT` (server/course-mode.js).
 */

import { h, Fragment, React } from "../react.js";
import { BASE, scoped } from "../tabs.js";
import { wrote } from "../data.js";
import {
  kindOf,
  laneOf,
  LANES,
  runOffset,
  shortDate,
  weightPct,
  WORK_ICON,
} from "../../shared/course-words.js";
import { AskButton, Icon, ViewLink } from "./parts.jsx";

// ------------------------------------------------------------------ dates

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const nice = (d) => {
  const p = d.split("-");
  return MON[+p[1] - 1] + " " + +p[2];
};
const addDays = (d, n) => {
  const p = d.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
};
/** A record's timestamp as an input's wall time: `2026-10-05T23:59`. */
const local = (s) => (s ? String(s).slice(0, 16) : "");
const offOf = (s, fallback) => {
  const m = /(Z|[+-][0-9][0-9]:[0-9][0-9])$/.exec(s || "");
  return m ? (m[1] === "Z" ? "+00:00" : m[1]) : fallback;
};
const shift = (v, n) => (v ? addDays(v.slice(0, 10), n) + v.slice(10) : v);
const dayName = (d) => DAY[new Date(d + "T12:00:00Z").getUTCDay()];
const when = (v) => (v ? dayName(v.slice(0, 10)) + " " + nice(v.slice(0, 10)) + ", " + v.slice(11, 16) : "");
const sameInstant = (a, b) => (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);

// ------------------------------------------------------------------ model

/**
 * The data as drawn: the record, with every override on it — a drop not yet
 * saved, or one saved and not yet read back.
 */
const withOverrides = (data, dates, topics) => {
  const fix = (a) => {
    const o = dates[a.assessment_id];
    if (!o) return a;
    return Object.assign({}, a, {
      opens_at: o.opens_at || null,
      due_at: o.due_at || null,
      opens_on: o.opens_at ? o.opens_at.slice(0, 10) : null,
      due_on: o.due_at ? o.due_at.slice(0, 10) : null,
    });
  };
  const undated = [...(data.weeks || []).flatMap((w) => w.undated || []), ...((data.unplaced && data.unplaced.assessments) || [])];
  const known = new Set((data.assessments || []).map((a) => a.assessment_id));
  const assessments = [...(data.assessments || []), ...undated.filter((a) => !known.has(a.assessment_id))].map(fix);
  // Each module on the week it is drawn in, or the one it was dropped on.
  const modules = [];
  for (const w of data.weeks || []) {
    for (const m of w.modules || []) {
      modules.push({ module: m, week: topics[m.module_id] ? topics[m.module_id].week : w.week, meetings: (w.meetings || []).filter((x) => x.module_id === m.module_id) });
    }
  }
  return { assessments, modules };
};

// ------------------------------------------------------------------ parts

function Toast(props) {
  if (!props.text) return null;
  return (
    <div className="plantoast" role="status">
      {props.text}
    </div>
  );
}

/** A press anywhere outside the form cancels it, as Escape does. */
const useOutside = (ref, onOutside) => {
  const latest = React.useRef(onOutside);
  latest.current = onOutside;
  React.useEffect(() => {
    const root = ref.current && ref.current.getRootNode();
    if (!root) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) latest.current();
    };
    root.addEventListener("mousedown", onDown, true);
    return () => root.removeEventListener("mousedown", onDown, true);
  }, []);
};

/** Where a form opens: beside the drop, kept on the screen. */
const placed = (x, y, width, height) => ({
  left: Math.max(12, Math.min(x + 14, window.innerWidth - width - 12)) + "px",
  top: Math.max(12, Math.min(y + 14, window.innerHeight - height - 12)) + "px",
});

const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

/**
 * One date as a professor plans it: a week of the term, a day in it and a
 * time. The value is the same wall time the date input would give, so the
 * form and the record never know which way it was set. A new week keeps the
 * weekday it had; a first one falls on the week's first day for an opening
 * and its last for a due date, at the hour such dates usually carry.
 */
function WeekWhen(props) {
  const { value, rows, weekOf, isOpens, className, onChange } = props;
  const day = value ? value.slice(0, 10) : "";
  const row = day ? rows.find((r) => r.n === weekOf(day)) : null;
  const time = value ? value.slice(11, 16) : isOpens ? "09:00" : "23:59";
  const days = (r) => Array.from({ length: daysBetween(r.from, r.to) + 1 }, (_, i) => addDays(r.from, i));
  const toWeek = (n) => {
    const r = rows.find((x) => x.n === n);
    if (!r) return onChange("");
    const len = daysBetween(r.from, r.to);
    const at = row ? Math.min(daysBetween(row.from, day), len) : isOpens ? 0 : len;
    onChange(addDays(r.from, at) + "T" + time);
  };
  return (
    <span className={"pf-week-pick " + className}>
      <select value={row ? row.n : ""} onChange={(e) => toWeek(Number(e.target.value))} aria-label="Week">
        <option value="">{isOpens ? "No opening" : "Week…"}</option>
        {rows.map((r) => (
          <option key={r.n} value={r.n}>
            {"Week " + r.n + " · " + nice(r.from)}
          </option>
        ))}
      </select>
      {row ? (
        <Fragment>
          <select value={day} onChange={(e) => onChange(e.target.value + "T" + time)} aria-label="Day">
            {days(row).map((d) => (
              <option key={d} value={d}>
                {dayName(d) + " " + nice(d)}
              </option>
            ))}
          </select>
          <input type="time" value={time} onChange={(e) => e.target.value && onChange(day + "T" + e.target.value)} aria-label="Time" />
        </Fragment>
      ) : null}
    </span>
  );
}

function DatesForm(props) {
  const { pending, item, rows, rowOf, weekOf, taughtBefore, onChange, onSave, onCancel } = props;
  const [brief, setBrief] = React.useState(pending.brief);
  // By week unless a date already lies outside the term, where no week holds it.
  const outside = [pending.opens, pending.due].some((v) => v && !weekOf(v.slice(0, 10)));
  const [byDate, setByDate] = React.useState(outside);
  const ref = React.useRef(null);
  useOutside(ref, () => !pending.saving && onCancel());
  const [size, setSize] = React.useState({ w: 290, h: 200 });
  React.useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, [brief, byDate, Boolean(pending.opens), Boolean(pending.due)]);
  React.useEffect(() => {
    const first = ref.current && ref.current.querySelector(brief ? ".pf-save" : byDate ? ".pf-due" : ".pf-due select");
    if (first) first.focus();
  }, [brief, byDate]);
  const wasTaught = (v) => Boolean(taughtBefore && v && v.slice(0, 10) < taughtBefore);
  const frozen = (was, now) => was !== now && (wasTaught(was) || wasTaught(now));
  const orig = { opens: local(item.opens_at), due: local(item.due_at) };
  const bad = !pending.due
    ? "It needs a due date."
    : pending.opens && pending.opens > pending.due
      ? "It would open after it is due."
      : frozen(orig.opens, pending.opens)
        ? "Its opening would move into or out of a week already taught."
        : frozen(orig.due, pending.due)
          ? "Its due date would move into or out of a week already taught."
          : "";
  const hint = (v, isOpens) => {
    if (!v) return { text: isOpens ? "no opening date" : "", off: false };
    const w = weekOf(v.slice(0, 10));
    return { text: w ? "week " + w + " · " + dayName(v.slice(0, 10)) : "outside the term", off: !w };
  };
  const r = pending.to ? rowOf(pending.to) : null;
  const opensHint = hint(pending.opens, true);
  const dueHint = hint(pending.due, false);
  return (
    <div
      ref={ref}
      className={"planform" + (brief ? " brief" : "")}
      role="dialog"
      aria-label="Dates"
      style={placed(pending.x, pending.y, size.w, size.h)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <b className="pf-title">{item.title || pending.id}</b>
      <small className="pf-week">
        {r ? (brief && pending.from ? "Week " + pending.from + " → week " + r.n : "Week " + r.n) + " · " + nice(r.from) + " – " + nice(r.to) : ""}
      </small>
      <p className="pf-sum">{(pending.opens ? "Opens " + when(pending.opens) + " · " : "") + "due " + when(pending.due)}</p>
      <div className="pf-fields">
        {byDate ? (
          <Fragment>
            <label>
              <span>Opens</span>
              <input type="datetime-local" className="pf-opens" value={pending.opens} onChange={(e) => onChange({ opens: e.target.value })} />
              <small className={"pf-opens-wk" + (opensHint.off ? " off" : "")}>{opensHint.text}</small>
            </label>
            <label>
              <span>Due</span>
              <input type="datetime-local" className="pf-due" required value={pending.due} onChange={(e) => onChange({ due: e.target.value })} />
              <small className={"pf-due-wk" + (dueHint.off ? " off" : "")}>{dueHint.text}</small>
            </label>
          </Fragment>
        ) : (
          <Fragment>
            <div className="pf-row">
              <span>Opens</span>
              <WeekWhen value={pending.opens} rows={rows} weekOf={weekOf} isOpens className="pf-opens" onChange={(v) => onChange({ opens: v })} />
            </div>
            <div className="pf-row">
              <span>Due</span>
              <WeekWhen value={pending.due} rows={rows} weekOf={weekOf} className="pf-due" onChange={(v) => onChange({ due: v })} />
            </div>
          </Fragment>
        )}
        <button type="button" className="pf-mode" onClick={() => setByDate(!byDate)}>
          {byDate ? "Pick by week instead" : "Pick a calendar date instead"}
        </button>
      </div>
      {bad ? <p className="pf-error">{bad}</p> : null}
      <div className="pf-actions">
        <button type="button" className="primary pf-save" disabled={Boolean(bad) || pending.saving} onClick={onSave}>
          {pending.saving ? "Saving…" : brief ? "Save" : "Save dates"}
        </button>
        <button type="button" className="chip pf-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <button type="button" className="pf-more" onClick={() => setBrief(false)}>
        Change dates
      </button>
      <small className="pf-note">Writes opens_at and due_at into its record. Canvas keeps its own copy until the definition is sent again.</small>
    </div>
  );
}

function TopicForm(props) {
  const { pending, topics, rowOf, weekOf, onChange, onSave, onCancel } = props;
  const [brief, setBrief] = React.useState(true);
  const ref = React.useRef(null);
  useOutside(ref, () => !pending.saving && onCancel());
  const [size, setSize] = React.useState({ w: 330, h: 200 });
  React.useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, [brief, pending.swap]);
  React.useEffect(() => {
    const save = ref.current && ref.current.querySelector(".tf-save");
    if (save) save.focus();
  }, []);
  const t = topics[pending.id];
  const r = rowOf(pending.to);
  const other = pending.other ? topics[pending.other] : null;
  const cap = (s) => {
    s = String(s || "meeting").replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  let bad = "";
  const list = (mid, values, want, key) =>
    topics[mid].meetings.length ? (
      topics[mid].meetings.map((x) => {
        const v = values[x.activity] || "";
        const w = v ? weekOf(v.slice(0, 10)) : null;
        const off = Boolean(v) && w !== want;
        if (off) bad = "A meeting would fall outside its topic’s week, and show as misdated.";
        return (
          <label key={x.activity}>
            <span title={x.activity}>{cap(x.type) + (x.group ? " · " + x.group : "")}</span>
            <input type="datetime-local" value={v} onChange={(e) => onChange(key, x.activity, e.target.value)} />
            <small className={off ? "off" : ""}>
              {!v ? "no date" : w ? "week " + w + " · " + dayName(v.slice(0, 10)) + (w !== want ? " — not this topic’s week" : "") : "outside the term"}
            </small>
          </label>
        );
      })
    ) : (
      <small>No meetings to move.</small>
    );
  const k = t.meetings.length;
  const there = pending.there;
  return (
    <div
      ref={ref}
      className={"planform topicform" + (brief ? " brief" : "")}
      role="dialog"
      aria-label="Move topic"
      style={placed(pending.x, pending.y, size.w, size.h)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <b className="tf-title">{t.title}</b>
      <small className="tf-week">
        Week {pending.from} → week {pending.to} · {nice(r.from)} – {nice(r.to)}
      </small>
      <p className="pf-sum tf-sum">{k ? "Its " + (k === 1 ? "meeting moves" : k + " meetings move") + " with it, same days and times." : "It has no meetings to move."}</p>
      <div className="tf-meetings">{list(pending.id, pending.meetings, pending.to, "meetings")}</div>
      {there === 1 && other ? (
        <label className="tf-swap">
          <input type="checkbox" className="tf-swap-on" checked={pending.swap} onChange={(e) => onChange("swap", null, e.target.checked)} />
          <span>Swap with “{other.title}” — it moves to week {pending.from} with its meetings</span>
        </label>
      ) : there > 1 ? (
        <label className="tf-swap">
          <input type="checkbox" className="tf-swap-on" disabled />
          <span>Week {pending.to} already has {there} topics; this one joins them.</span>
        </label>
      ) : null}
      {other && pending.swap ? <div className="tf-other">{list(pending.other, pending.otherMeetings, pending.from, "otherMeetings")}</div> : null}
      {bad ? <p className="pf-error tf-error">{bad}</p> : null}
      <div className="pf-actions">
        <button type="button" className="primary tf-save" disabled={pending.saving} onClick={onSave}>
          {pending.saving ? "Moving…" : "Save"}
        </button>
        <button type="button" className="chip tf-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {k ? (
        <button type="button" className="pf-more tf-more" onClick={() => setBrief(false)}>
          Change meeting times
        </button>
      ) : null}
      <small className="pf-note">Writes the module's week and its meetings' dates. Slides and graded work keep theirs.</small>
    </div>
  );
}

// ---------------------------------------------------------------- reading

export function Planning(props) {
  const { data, student, locks, runId, sessionId } = props;
  const run = data.run || {};
  const weeks = data.weeks || [];
  const editable = !student;
  const OFF = runOffset(data);
  const rows = weeks.map((w) => ({ n: w.week, from: w.starts_on, to: w.ends_on, taught: w.when === "past" }));
  const rowOf = (n) => rows.find((r) => r.n === n) || null;
  const weekOf = (d) => (d ? (rows.find((r) => d >= r.from && d <= r.to) || {}).n || null : null);
  const taught = (n) => n !== null && Boolean((rowOf(n) || {}).taught);
  let taughtBefore = null;
  for (const r of rows) {
    if (r.taught) taughtBefore = "9999";
    else {
      if (taughtBefore) taughtBefore = r.from;
      break;
    }
  }
  const withResults = new Set((locks && locks.results) || []);

  // Overrides: drops not yet saved, and saves not yet read back.
  const [dates, setDates] = React.useState({});
  const [topicWeeks, setTopicWeeks] = React.useState({});
  const [pending, setPending] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const toastTimer = React.useRef(null);
  const say = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };

  // A save's override goes once the record, read again, says the same thing.
  React.useEffect(() => {
    setDates((current) => {
      const next = {};
      for (const [id, o] of Object.entries(current)) {
        const a = (data.assessments || []).find((x) => x.assessment_id === id);
        const settled = o.saved && a && sameInstant(a.due_at, o.due_at) && sameInstant(a.opens_at, o.opens_at);
        if (!settled) next[id] = o;
      }
      return next;
    });
    setTopicWeeks((current) => {
      const next = {};
      for (const [id, o] of Object.entries(current)) {
        const w = weeks.find((x) => (x.modules || []).some((m) => m.module_id === id));
        if (!(o.saved && w && w.week === o.week)) next[id] = o;
      }
      return next;
    });
  }, [data]);

  const drawn = withOverrides(data, dates, topicWeeks);
  const byId = new Map(drawn.assessments.map((a) => [a.assessment_id, a]));
  const recordOf = (id) => {
    const all = [...(data.assessments || []), ...(data.weeks || []).flatMap((w) => w.undated || []), ...((data.unplaced && data.unplaced.assessments) || [])];
    return all.find((a) => a.assessment_id === id) || null;
  };
  const topics = {};
  for (const w of weeks) {
    for (const m of w.modules || []) {
      topics[m.module_id] = {
        title: m.title,
        week: w.week,
        meetings: (w.meetings || [])
          .filter((x) => x.module_id === m.module_id)
          .map((x) => ({ activity: x.activity_id, type: x.type, group: x.group || null, scheduled_at: x.scheduled_at || null })),
      };
    }
  }

  // Weights by kind of work, against the model's own total and verdict.
  const groups = [];
  for (const a of data.assessments || []) {
    const name = kindOf(a.type)[0];
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, weight: 0, count: 0, unweighted: 0 }));
    g.count += 1;
    if (a.weight === null || a.weight === undefined) g.unweighted += 1;
    else g.weight += a.weight;
  }
  const grading = data.grading || {};

  // A span per piece of graded work, the week it opens to the week it is due.
  const spans = drawn.assessments
    .filter((a) => a.due_on)
    .map((a) => {
      const end = weekOf(a.due_on);
      return { a, lane: laneOf(a.type), start: weekOf(a.opens_on) ?? end, end };
    });
  const lanes = LANES.concat([["other", "Other", "ot"]]).filter((l) => spans.some((s) => s.lane[1] === l[1]));

  // Work with no due date waits in a tray above the table.
  const undated = drawn.assessments.filter((a) => !a.due_on);

  // Faults, as sentences.
  const faults = [];
  if (!student) {
    const runsOf = (list) =>
      list.reduce((all, n) => {
        const last = all[all.length - 1];
        if (last && last[last.length - 1] === n - 1) last.push(n);
        else all.push([n]);
        return all;
      }, []);
    const unplanned = weeks.filter((w) => (w.gaps || []).some((g) => g.kind === "module")).map((w) => w.week);
    for (const r of runsOf(unplanned)) {
      const span = r.length === 1 ? "Week " + r[0] : "Weeks " + r[0] + "–" + r[r.length - 1];
      faults.push({
        tone: "flag",
        icon: "module",
        text: span + " " + (r.length === 1 ? "has" : "have") + " no topic",
        prompt:
          span + " of " + run.id + " " + (r.length === 1 ? "has" : "have") + " no module. Propose what " + (r.length === 1 ? "it" : "they") + " should teach, " +
          "given what comes before and what falls due, as draft modules for me to read.",
        verb: r.length === 1 ? "Plan week " + r[0] : "Plan these weeks",
      });
    }
    const graded = new Set();
    for (const s of spans) if (s.start !== null && s.end !== null) for (let n = s.start; n <= s.end; n += 1) graded.add(n);
    for (const r of runsOf(weeks.map((w) => w.week).filter((n) => !graded.has(n))).filter((r) => r.length >= 2)) {
      const span = "Weeks " + r[0] + "–" + r[r.length - 1];
      faults.push({
        tone: "warn",
        icon: "quiz",
        text: span + ": nothing graded opens, runs or falls due",
        prompt:
          span + " of " + run.id + " have no graded work opening, running or falling due. Should something be assessed " +
          "there, given what those weeks teach? Propose it as a draft; change nothing else.",
        verb: "Suggest an assessment",
      });
    }
    for (const a of undated) faults.push({ tone: "flag", icon: "calendar", text: a.title + " has no dates", verb: "Set dates", dated: a.assessment_id });
    if (!grading.complete) {
      faults.push({
        tone: "flag",
        icon: "weight",
        text: grading.note || "The weights do not add up to 100%",
        prompt: "The weights in " + run.id + " do not settle the grading policy: " + (grading.note || "they do not add up") + " Propose a correction and wait.",
        verb: "Fix the weights",
      });
    }
  }

  // ---- forms
  const openDates = (id, opens, due, to, from, x, y, brief) => {
    const item = recordOf(id);
    if (!item) return;
    setPending({ kind: "dates", id, opens: opens || "", due: due || "", to, from, x, y, brief });
    // The override is the drop: the bar is drawn where it was dropped.
    setDates((d) => Object.assign({}, d, { [id]: { opens_at: opens ? opens + ":00" + offOf(item.opens_at || item.due_at, OFF) : null, due_at: due ? due + ":00" + offOf(item.due_at, OFF) : null } }));
  };
  const cancel = () => {
    if (!pending) return;
    if (pending.kind === "dates") {
      setDates((d) => {
        const next = Object.assign({}, d);
        if (!(next[pending.id] && next[pending.id].saved)) delete next[pending.id];
        return next;
      });
    } else {
      setTopicWeeks((t) => {
        const next = Object.assign({}, t);
        for (const id of [pending.id, pending.other]) if (id && !(next[id] && next[id].saved)) delete next[id];
        return next;
      });
    }
    setPending(null);
  };
  const changeDates = (change) => {
    const next = Object.assign({}, pending, change);
    setPending(next);
    const item = recordOf(next.id);
    setDates((d) =>
      Object.assign({}, d, {
        [next.id]: {
          opens_at: next.opens ? next.opens + ":00" + offOf(item.opens_at || item.due_at, OFF) : null,
          due_at: next.due ? next.due + ":00" + offOf(item.due_at, OFF) : null,
        },
      }),
    );
  };
  const post = (path, body) =>
    fetch(scoped(BASE + path + "?run=" + encodeURIComponent(runId), sessionId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((response) => response.json())
      .catch((error) => ({ error: String(error.message || error) }));
  const saveDates = () => {
    const p = pending;
    const o = dates[p.id];
    setPending(Object.assign({}, p, { saving: true }));
    post("/api/plan/dates", { assessment: p.id, opens_at: o.opens_at || "", due_at: o.due_at }).then((result) => {
      if (result.error) {
        setDates((d) => {
          const next = Object.assign({}, d);
          delete next[p.id];
          return next;
        });
        say(String(result.error));
      } else {
        setDates((d) => Object.assign({}, d, { [p.id]: Object.assign({}, d[p.id], { saved: true }) }));
        wrote(sessionId, []);
      }
      setPending(null);
    });
  };

  const openTopic = (mid, to, x, y) => {
    const t = topics[mid];
    if (!t) return;
    const there = Object.keys(topics).filter((k) => k !== mid && topics[k].week === to);
    const n = (to - t.week) * 7;
    const meetings = {};
    for (const m of t.meetings) meetings[m.activity] = m.scheduled_at ? shift(local(m.scheduled_at), n) : "";
    const other = there.length === 1 ? there[0] : null;
    const otherMeetings = {};
    if (other) for (const m of topics[other].meetings) otherMeetings[m.activity] = m.scheduled_at ? shift(local(m.scheduled_at), -n) : "";
    setPending({ kind: "topic", id: mid, from: t.week, to, there: there.length, other, swap: Boolean(other), meetings, otherMeetings, x, y });
    setTopicWeeks((tw) => Object.assign({}, tw, { [mid]: { week: to } }, other ? { [other]: { week: t.week } } : {}));
  };
  const changeTopic = (key, activity, value) => {
    if (key === "swap") {
      setPending(Object.assign({}, pending, { swap: value }));
      setTopicWeeks((tw) => {
        const next = Object.assign({}, tw);
        if (value) next[pending.other] = { week: pending.from };
        else delete next[pending.other];
        return next;
      });
      return;
    }
    setPending(Object.assign({}, pending, { [key]: Object.assign({}, pending[key], { [activity]: value }) }));
  };
  const stamps = (mid, values) =>
    topics[mid].meetings
      .filter((m) => values[m.activity])
      .map((m) => ({ activity: m.activity, scheduled_at: values[m.activity] + ":00" + offOf(m.scheduled_at, OFF) }));
  const saveTopic = () => {
    const p = pending;
    const moves = [{ module: p.id, week: p.to, meetings: stamps(p.id, p.meetings) }];
    if (p.other && p.swap) moves.push({ module: p.other, week: p.from, meetings: stamps(p.other, p.otherMeetings) });
    setPending(Object.assign({}, p, { saving: true }));
    post("/api/plan/topic", { moves }).then((result) => {
      const ids = [p.id, p.other].filter(Boolean);
      if (result.error) {
        setTopicWeeks((tw) => {
          const next = Object.assign({}, tw);
          for (const id of ids) delete next[id];
          return next;
        });
        say(String(result.error));
      } else {
        setTopicWeeks((tw) => {
          const next = Object.assign({}, tw);
          for (const id of ids) if (next[id]) next[id] = Object.assign({}, next[id], { saved: true });
          return next;
        });
        wrote(sessionId, []);
      }
      setPending(null);
    });
  };

  // ---- drag
  const drag = React.useRef(null);
  const grip = React.useRef(null);
  const [over, setOver] = React.useState(null);
  const [lifted, setLifted] = React.useState(null);
  const refused = React.useRef(false);
  const end = () => {
    setOver(null);
    setLifted(null);
    drag.current = null;
  };
  const startBar = (e, a, fromWeek) => {
    const edge = grip.current && e.currentTarget.contains(grip.current) ? grip.current.getAttribute("data-edge") : "both";
    const item = recordOf(a.assessment_id);
    if (item && taught(weekOf(item.opens_on)) && edge !== "due") {
      e.preventDefault();
      say("It opened in a week already taught — drag its due end instead.");
      return;
    }
    if (pending) cancel();
    drag.current = { id: a.assessment_id, edge, from: fromWeek };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", a.assessment_id);
    } catch {
      // Some browsers refuse data on a drag from a shadow root; the ref is what counts.
    }
    setTimeout(() => setLifted(a.assessment_id), 0);
  };
  const startTopic = (e, mid, fromWeek) => {
    if (pending) cancel();
    drag.current = { topic: true, id: mid, from: fromWeek };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", mid);
    } catch {
      // As above.
    }
    setTimeout(() => setLifted(mid), 0);
  };
  const rowHandlers = (r) => ({
    onDragOver: (e) => {
      if (!drag.current) return;
      refused.current = r.taught;
      if (r.taught) {
        if (over !== null) setOver(null);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== r.n) setOver(r.n);
    },
    onDrop: (e) => {
      if (!drag.current || r.taught) return;
      e.preventDefault();
      const d = drag.current;
      const to = r.n;
      end();
      if (d.topic) {
        if (to !== d.from) openTopic(d.id, to, e.clientX, e.clientY);
        return;
      }
      const item = recordOf(d.id);
      let opens = local(item.opens_at);
      let due = local(item.due_at);
      if (!item.due_at) {
        opens = "";
        due = r.to + "T23:59";
      } else if (d.from !== null) {
        if (to === d.from) return;
        const n = (to - d.from) * 7;
        if (d.edge !== "due") opens = shift(opens, n);
        if (d.edge !== "opens") due = shift(due, n);
      }
      openDates(d.id, opens, due, to, d.from, e.clientX, e.clientY, true);
    },
  });
  const onDragEnd = () => {
    if (drag.current && refused.current) say("That week is already taught; nothing moves into it.");
    refused.current = false;
    end();
  };

  // ---- draw
  const target = pending ? pending.to : null;
  return (
    <div className="mode" onDragEnd={onDragEnd}>
      <div className="weights">
        {groups.map((g) => (
          <div className="wcard" key={g.name}>
            <small>{g.name}</small>
            <b>{weightPct(g.weight) || "—"}</b>
            <small>
              {g.count} {g.count === 1 ? "item" : "items"}
              {g.unweighted ? " · " + g.unweighted + " with no weight" : ""}
            </small>
          </div>
        ))}
        <div className={"wcard " + (grading.complete ? "ok" : "bad")}>
          <small>Total</small>
          <b>{weightPct(grading.total_weight) || "—"}</b>
          <small>{grading.complete ? "weights add up" : "does not add up"}</small>
        </div>
      </div>
      {student ? null : faults.length ? (
        <ul className="faults">
          {faults.map((f, i) => (
            <li className={f.tone} key={i}>
              <Icon name={f.icon} />
              <span>{f.text}</span>
              {f.dated ? (
                <button
                  type="button"
                  className="chip ask strong"
                  onClick={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    const item = recordOf(f.dated);
                    openDates(f.dated, local(item.opens_at), local(item.due_at), item.due_at ? weekOf(item.due_at.slice(0, 10)) : null, null, box.left, box.bottom, false);
                  }}
                >
                  <Icon name="calendar" />
                  {f.verb}
                </button>
              ) : (
                <AskButton prompt={f.prompt} label={f.verb} className="chip ask strong" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="calm">Every week has a topic, the graded work is spread, and the weights add up.</p>
      )}
      {editable && undated.length ? (
        <div className="tray">
          <b>
            <Icon name="calendar" />
            Not on the calendar
          </b>
          {undated.map((a) => (
            <span
              key={a.assessment_id}
              className={"chip traychip" + (lifted === a.assessment_id ? " lifted" : "")}
              draggable="true"
              title="Drag onto a week"
              onDragStart={(e) => startBar(e, a, null)}
            >
              <Icon name={WORK_ICON[a.type] || "file"} />
              {a.title}
            </span>
          ))}
          <small>Drag one onto a week, then settle the day.</small>
        </div>
      ) : null}
      <table className="plan">
        <thead>
          <tr>
            <th>Week</th>
            <th>Topic</th>
            {lanes.map((l) => (
              <th key={l[0]} className={"lanehead " + l[2]}>
                {l[1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const r = rowOf(w.week);
            const here = drawn.modules.filter((x) => x.week === w.week);
            const title = here.map((x) => x.module.title).join(" · ");
            const n = here.flatMap((x) => x.module.concepts || []).length;
            const draft = here.some((x) => x.module.draft);
            const cls = [w.when === "current" ? "now" : "", over === w.week ? "drop" : "", target === w.week ? "target" : ""].filter(Boolean).join(" ");
            return (
              <tr
                key={w.week}
                className={cls}
                data-week={w.week}
                data-taught={r.taught ? "1" : undefined}
                title={r.taught ? "Already taught: nothing moves into or out of this week" : undefined}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget) && over === w.week) setOver(null);
                }}
                {...(editable ? rowHandlers(r) : {})}
              >
                <td className="wkn">
                  <b>{w.week}</b>
                  <small>{shortDate(w.starts_on)}</small>
                </td>
                <td className="topic">
                  {!title ? (
                    <span className="notopic">No topic yet</span>
                  ) : editable && !taught(w.week) ? (
                    <Fragment>
                      {here.map((x, i) => (
                        <Fragment key={x.module.module_id}>
                          {i ? <span className="dash"> · </span> : null}
                          <span
                            className={"tchip" + (x.module.draft ? " draftword" : "") + (lifted === x.module.module_id ? " lifted" : "")}
                            draggable="true"
                            title="Drag to another week — its meetings move with it"
                            onDragStart={(e) => startTopic(e, x.module.module_id, w.week)}
                          >
                            {x.module.title}
                          </span>
                        </Fragment>
                      ))}
                      {n ? <small>{n + " " + (n === 1 ? "concept" : "concepts")}</small> : null}
                      {draft ? <small>draft</small> : null}
                    </Fragment>
                  ) : (
                    <Fragment>
                      <span className={draft ? "draftword" : ""}>{title}</span>
                      {n ? <small>{n + " " + (n === 1 ? "concept" : "concepts")}</small> : null}
                      {draft ? <small>draft</small> : null}
                    </Fragment>
                  )}
                </td>
                {lanes.map((l) => (
                  <td className="lane" key={l[0]}>
                    {spans
                      .filter((s) => s.lane[1] === l[1] && s.start !== null && w.week >= s.start && w.week <= s.end)
                      .map((s) => {
                        const first = w.week === s.start;
                        const last = w.week === s.end;
                        const a = s.a;
                        const href = a.viewable && a.url ? a.url : a.brief_url;
                        // Locked: results recorded, or due in a week already taught.
                        const record = recordOf(a.assessment_id) || a;
                        const locked = withResults.has(a.assessment_id) || taught(weekOf(record.due_on));
                        const why = withResults.has(a.assessment_id) ? "has results — its dates stay" : "due in a week already taught";
                        const movable = editable && !locked;
                        const dueWords = "due " + shortDate(a.due_on) + " · " + (weightPct(a.weight) || "no weight");
                        const tip =
                          a.title + (a.opens_on ? " · opens " + shortDate(a.opens_on) : "") + " · due " + shortDate(a.due_on) +
                          (!editable ? "" : locked ? " — " + why : taught(s.start) ? " — opened in a week already taught; drag its due end" : " — drag to another week");
                        const segCls =
                          "lseg " + kindOf(a.type)[1] + (first ? " first" : "") + (last ? " last" : "") + (a.draft ? " draft" : "") + (editable && locked ? " locked" : "") +
                          (lifted === a.assessment_id ? " lifted" : "");
                        return (
                          <div
                            key={a.assessment_id}
                            className={segCls}
                            draggable={movable ? "true" : undefined}
                            title={tip}
                            onDragStart={movable ? (e) => startBar(e, a, w.week) : undefined}
                          >
                            {movable && first && a.opens_on && weekOf(a.opens_on) === s.start && !taught(s.start) ? (
                              <span className="grip top" data-edge="opens" title="Drag to move when it opens" onMouseDown={(e) => (grip.current = e.currentTarget)} />
                            ) : null}
                            {movable && last ? (
                              <span className="grip bottom" data-edge="due" title="Drag to move when it is due" onMouseDown={(e) => (grip.current = e.currentTarget)} />
                            ) : null}
                            {!first ? null : href ? (
                              <ViewLink className="segt" draggable="false" href={href} view={a.title} format={a.viewable && a.url ? a.format : "html"}>
                                {a.title}
                              </ViewLink>
                            ) : (
                              <span className="segt">{a.title}</span>
                            )}
                            {!last ? null : movable ? (
                              <button
                                type="button"
                                className="segd"
                                title="Change the dates"
                                onMouseDown={() => (grip.current = null)}
                                onClick={(e) => {
                                  const box = e.currentTarget.getBoundingClientRect();
                                  const item = recordOf(a.assessment_id);
                                  openDates(a.assessment_id, local(item.opens_at), local(item.due_at), weekOf(item.due_on), null, box.left, box.bottom, false);
                                }}
                              >
                                {dueWords}
                              </button>
                            ) : (
                              <span className="segd">{dueWords}</span>
                            )}
                          </div>
                        );
                      })}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="foot">
        Each bar runs from the week a piece of work opens to the week it is due.
        {editable
          ? " Drag a bar to another week to move both dates — the weekday and the time come with it. Drag its top edge to move" +
            " only the opening, its bottom edge to move only the due date, and press the due line to set the day by hand." +
            " Drag a topic to another week and its meetings move with it, or trade places with the topic already there."
          : ""}{" "}
        Rooms, times and decks are in Teaching.
      </p>
      {pending && pending.kind === "dates" ? (
        <DatesForm
          key={pending.id}
          pending={pending}
          item={recordOf(pending.id)}
          rows={rows}
          rowOf={rowOf}
          weekOf={weekOf}
          taughtBefore={taughtBefore}
          onChange={changeDates}
          onSave={saveDates}
          onCancel={cancel}
        />
      ) : null}
      {pending && pending.kind === "topic" ? (
        <TopicForm
          key={pending.id}
          pending={pending}
          topics={topics}
          rowOf={rowOf}
          weekOf={weekOf}
          onChange={changeTopic}
          onSave={saveTopic}
          onCancel={cancel}
        />
      ) : null}
      <Toast text={toast} />
    </div>
  );
}
