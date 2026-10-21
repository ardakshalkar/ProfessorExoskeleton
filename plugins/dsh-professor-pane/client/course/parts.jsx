/**
 * The pieces every reading of course mode is built from: icons, the chips for
 * a material, a piece of graded work and a hole, the status line under work,
 * and the presses.
 *
 * Each is the JSX of what server/course-mode.js writes as a string, with the
 * same classes, so the one stylesheet (shared/course-style.js) draws both.
 *
 * A press sends the message the page in the frame used to send — `ask`,
 * `view`, `grade`, `scans`, `upload`, `defence-desk`, `publish` — on the same channel,
 * `window.postMessage`, so the pane's handler for them is the one it was.
 */

// `h` and `Fragment` are what the JSX below compiles to.
import { h, Fragment } from "../react.js";
import {
  GAP,
  ICONS,
  RESOURCE_ICON,
  RESOURCE_WORD,
  WORK_ICON,
  WORK_WORD,
  weightPct,
} from "../../shared/course-words.js";

// ---------------------------------------------------------------- presses

const send = (message) => window.postMessage(Object.assign({ source: "professor-pane" }, message), "*");

export const press = {
  ask: (prompt) => send({ kind: "ask", prompt }),
  grade: (assessment, label) => send({ kind: "grade", assessment, label }),
  scans: (assessment) => send({ kind: "scans", assessment }),
  upload: (assessment, label) => send({ kind: "upload", assessment, label }),
  desk: (assessment, student) => send({ kind: "defence-desk", assessment, student }),
  publish: (assessment, label, target) => send({ kind: "publish", assessment, label, target }),
};

/**
 * A link the harness opens over itself when it can paint it. A plain click is
 * the pane's; a modified one (a new tab, a download) is the browser's, as a
 * link always was.
 */
export function ViewLink(props) {
  const { view, format, papers, children, ...rest } = props;
  const onClick = (event) => {
    if (!view) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    send({ kind: "view", url: props.href, label: view, format: format, papers: papers ? JSON.stringify(papers) : null });
  };
  return (
    <a target="_blank" rel="noopener" {...rest} onClick={onClick}>
      {children}
    </a>
  );
}

// ------------------------------------------------------------------ icons

/** The symbols, once per shadow root; `Icon` refers to them by id. */
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {Object.entries(ICONS).map(([name, inner]) => (
          <symbol key={name} id={"i-" + name} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: inner }} />
        ))}
      </defs>
    </svg>
  );
}

export function Icon(props) {
  return (
    <svg className="i" aria-hidden="true">
      <use href={"#i-" + props.name} />
    </svg>
  );
}

// ------------------------------------------------------------------ chips

/** A press that asks the session something, with the record's ids in it. */
export function AskButton(props) {
  return (
    <button type="button" className={props.className || "chip ask"} data-ask="" title={props.title} onClick={() => press.ask(props.prompt)}>
      <Icon name="ask" />
      {props.label}
    </button>
  );
}

/** A hole: the verb that fills it, coloured by when it bites. */
export function GapChip(props) {
  const gap = GAP[props.kind];
  return (
    <button type="button" className={"chip gap " + props.tier} data-ask="" title={props.title} onClick={() => press.ask(props.prompt)}>
      <Icon name={gap.icon} />
      {props.label || gap.verb}
    </button>
  );
}

/** A material, and its other formats beside it. */
export function MaterialChips(props) {
  const r = props.resource;
  const deck = r.kind === "slides";
  const cls = "chip" + (deck ? " deck" : "") + (r.draft ? " draft" : "");
  const label = deck ? "Slides" : r.title;
  const what = RESOURCE_WORD[r.kind] || r.kind;
  const body = (
    <Fragment>
      <Icon name={RESOURCE_ICON[r.kind] || "file"} />
      {label}
      {r.draft ? <Fragment> <span className="k">draft</span></Fragment> : null}
    </Fragment>
  );
  return (
    <Fragment>
      {r.url ? (
        <ViewLink
          className={cls}
          href={r.url}
          title={what + " · " + r.title}
          view={r.viewable ? r.title : null}
          format={r.format}
        >
          {body}
        </ViewLink>
      ) : (
        <span className={cls} title={what}>
          {body}
        </span>
      )}
      {(r.formats || []).slice(1).map((f) =>
        f.url ? (
          <ViewLink
            key={f.label}
            className="chip fmt"
            href={f.url}
            view={f.viewable ? r.title + " · " + f.label : null}
            format={f.format}
          >
            {f.label}
          </ViewLink>
        ) : null,
      )}
    </Fragment>
  );
}

/** A piece of graded work: when, what kind, what, and what it is worth. */
export function WorkChip(props) {
  const a = props.work;
  const kind = WORK_WORD[a.type] || a.type || "work";
  const cls = "chip" + (a.draft ? " draft" : "");
  const body = (
    <Fragment>
      <span className="k mono">{props.when}</span>
      <span className="tag">
        <Icon name={WORK_ICON[a.type] || "file"} />
        {kind}
      </span>
      {a.title}
      {a.draft ? <Fragment> <span className="k">draft</span></Fragment> : null}
      <span className="wt">{weightPct(a.weight)}</span>
    </Fragment>
  );
  // An exam with versions opens all of them in one overlay.
  const papers = Array.isArray(a.papers) && a.papers.length > 1 ? a.papers : null;
  if (papers) {
    return (
      <ViewLink className={cls} href={papers[0].url} view={a.title} format={papers[0].format} papers={papers} title={"open the " + papers.length + " versions"}>
        {body}
      </ViewLink>
    );
  }
  const href = a.viewable && a.url ? a.url : a.brief_url;
  if (href) {
    return (
      <ViewLink className={cls} href={href} view={a.title} format={a.viewable && a.url ? a.format : "html"} title="open the brief">
        {body}
      </ViewLink>
    );
  }
  return <span className={cls}>{body}</span>;
}

/**
 * Where a piece of graded work stands, under its chip: the host's figures
 * (server/week-status.js) as words, each with the press that goes with it.
 */
export function StatusLine(props) {
  const a = props.work;
  const st = props.status ? props.status[a.assessment_id] : null;
  if (!st) return null;
  const id = a.assessment_id;
  const label = a.title || id;
  const parts = [];
  if (st.grading) {
    parts.push(
      <Fragment key="grading">
        <span className="stat">
          {st.grading.suggested} suggested · {st.grading.decided} decided
        </span>
        <button type="button" className="chip act" title="Open the Grade view" onClick={() => press.grade(id, label)}>
          Grade
        </button>
      </Fragment>,
    );
  }
  if (st.scans && st.scans.none) {
    parts.push(
      <Fragment key="scans">
        <span className="stat">no scans yet</span>
        <button type="button" className="chip act" title={"Upload the scanned papers of " + label} onClick={() => press.upload(id, label)}>
          Upload scans…
        </button>
      </Fragment>,
    );
  } else if (st.scans) {
    parts.push(<ScanSteps key="scans" id={id} label={label} scans={st.scans} graded={Boolean(st.grading)} />);
  }
  if (st.defences) {
    parts.push(
      <Fragment key="defences">
        <span className="stat">
          {st.defences.defended} of {st.defences.of} defended
        </span>
        {st.defences.student ? (
          <button
            type="button"
            className="chip act"
            title={"The defence desk, on " + st.defences.student}
            onClick={() => press.desk(id, st.defences.student)}
          >
            Open defence desk
          </button>
        ) : null}
      </Fragment>,
    );
  }
  if (st.canvas) {
    parts.push(
      <Fragment key="canvas">
        <span className="badge">{st.canvas === "some" ? "not in every Canvas course yet" : "not in Canvas yet"}</span>
        <button
          type="button"
          className="chip act"
          title="Send its definition to Canvas — reads a plan first"
          onClick={() => press.publish(id, label, "canvas")}
        >
          publish…
        </button>
      </Fragment>,
    );
  }
  if (st.repo) {
    parts.push(
      <Fragment key="repo">
        <span className="badge">no starter repository yet</span>
        <button
          type="button"
          className="chip act"
          title="Create the starter repository on GitHub — reads a plan first"
          onClick={() => press.publish(id, label, "homework")}
        >
          publish…
        </button>
      </Fragment>,
    );
  }
  return parts.length ? <span className="status">{parts}</span> : null;
}

/**
 * A pile's steps under its work: a dot for each (done, yours, the one under
 * way, to come), what the step is waiting for, and the one press that makes
 * it — every word the host's (server/week-status.js). Scans stays beside
 * the press unless the press already opens it; Grade is not said twice.
 */
function ScanSteps(props) {
  const { id, label, scans } = props;
  const act = scans.act;
  const opensScans = act && act.kind === "scans";
  const steps = scans.steps || [];
  const strip = steps.map((step) => step.label + ": " + step.detail).join("\n");
  let action = null;
  if (act && act.kind === "ask") {
    action = <AskButton className="chip act" label={act.label} prompt={act.prompt} title={act.prompt} />;
  } else if (act && act.kind === "grade" && !props.graded) {
    action = (
      <button type="button" className="chip act" title="Open the Grade view" onClick={() => press.grade(id, label)}>
        {act.label}
      </button>
    );
  } else if (opensScans) {
    action = (
      <button type="button" className="chip act" title="Open the pile in Scans, on this step" onClick={() => press.scans(id)}>
        {act.label}
      </button>
    );
  }
  return (
    <Fragment>
      {steps.length ? (
        <span className="steps" role="img" aria-label={strip} title={strip}>
          {steps.map((step) => (
            <i key={step.label} className={step.state} />
          ))}
        </span>
      ) : null}
      <span className={"stat" + (scans.whose === "you" ? " yours" : "")}>
        {scans.phrase}
        {scans.whose === "assistant" ? " · the assistant's" : ""}
      </span>
      {action}
      {opensScans ? null : (
        <button type="button" className="chip act" title="Open the pile in Scans" onClick={() => press.scans(id)}>
          Scans
        </button>
      )}
    </Fragment>
  );
}

/** "—" where a cell has nothing. */
export const Dash = () => <span className="dash">—</span>;

/** A week number as the page prints it: two digits. */
export const twoDigits = (n) => (n < 10 ? "0" + n : String(n));
