/**
 * Changing a course item from the page: a title in place, or the whole item
 * in a dialog.
 *
 * TWO SHAPES, ONE ROAD
 * --------------------
 * The pencil beside a title edits it where it stands — Enter saves, Escape
 * puts it back. *All fields…* in that editor opens the dialog, which asks the
 * server what this kind of item may change (`GET /api/record`) and draws a
 * field for each, so the dialog knows no kind and no field of its own. Both
 * save through `POST /api/record`, and `server/record-fields.js` is the one
 * place that says what may be written.
 *
 * Two saves. **Save** writes the change and that is all — a typo, a better
 * word. **Save + check ✦** writes it the same way and then hands the session
 * the old value, the new one and what points at the item (the server follows
 * the ids, `record-impact.ts`), through `/revise`: whichever model the session
 * runs decides whether this was a rename, a refocus or a different topic, and
 * asks about what that leaves behind. The write never waits for it — the new
 * title is the professor's decision, and only its consequences are a
 * judgement.
 *
 * What the table does not offer — a weight, the outcomes, a rubric — the
 * dialog's last line sends to the session with the item's ids in it, so the
 * professor never has to say which item they meant.
 *
 * A saved title is drawn at once and kept until the record, read again, says
 * the same thing; the redraw comes from the workspace watcher (`wrote`).
 */

// `h` and `Fragment` are what the JSX below compiles to.
import { h, Fragment, React } from "../react.js";
import { BASE, scoped } from "../tabs.js";
import { wrote } from "../data.js";
import { Icon, press } from "./parts.jsx";

/**
 * What every editor needs, given once by the view: the run, the session, and
 * whether editing is on at all (never under *Preview as student*).
 */
export const EditContext = React.createContext(null);

const recordUrl = (edit, query) =>
  scoped(BASE + "/api/record?run=" + encodeURIComponent(edit.runId) + (query || ""), edit.sessionId);

/**
 * The kinds whose change may leave other records behind, so Save + check is
 * offered on them — the ones `EDITABLE` in server/record-fields.js marks
 * `check`. The dialog reads it from the server; the inline editor, which has
 * no read of its own, from here.
 */
const CHECKED = new Set(["module", "assessment"]);
const WORD = { module: "topic", assessment: "graded work", activity: "meeting" };

const quoted = (value) => (value ? "“" + String(value).replace(/\s+/g, " ").slice(0, 300) + "”" : "(empty)");

/**
 * What Save + check sends: the change, already made, and what points at the
 * item, for `/revise` to weigh. The kind of change is the model's to decide;
 * the list is not, so it is handed over rather than searched for.
 */
export function checkPrompt(runId, result) {
  const changes = Object.keys(result.fields || {}).map(
    (name) => "  " + name + ": " + quoted(result.before && result.before[name]) + " → " + quoted(result.fields[name]),
  );
  return [
    "/revise I changed " + (WORD[result.kind] || result.kind) + " " + result.id + " in " + runId + " from the course page. It is already saved:",
    ...changes,
    "",
    "First decide what kind of change this is — a rename (same subject, new words), a refocus (same area, a different angle or scope) or a different topic — and say which in one line, with why.",
    "Then go through what points at it, below, and say for each group whether it still fits. Ask me about the groups that need changing, one at a time; propose each change as a draft (approval: draft) and wait for me. Change nothing else without asking.",
    "Places that print the title (the course page, Canvas) are behind until it is published again — name them; do not publish.",
    "",
    "What points at it (ainar impact " + result.id + "):",
    ...(result.impact && result.impact.length ? result.impact : ["  nothing else in the course points at it"]),
  ].join("\n");
}

/**
 * Set `fields` on one item; resolves to the server's answer, an error
 * included. With `check`, a saved change is then handed to the session.
 */
export function saveRecord(edit, kind, id, fields, check) {
  return fetch(recordUrl(edit), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, id, fields, check: Boolean(check) }),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String(error.message || error) }))
    .then((result) => {
      if (result.written) wrote(edit.sessionId, []);
      if (check && result.written && result.before) press.ask(checkPrompt(edit.runId, result));
      return result;
    });
}

/** Keep a key from reaching course mode's own Escape and the drag under it. */
const own = (event) => event.stopPropagation();

/**
 * A title the professor may change in place. Without editing on, the bare
 * title — or `children`, when the caller draws it as a link.
 */
export function EditableTitle(props) {
  const edit = React.useContext(EditContext);
  const { kind, id, title } = props;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title || "");
  const [saved, setSaved] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef(null);
  // The saved title until the record says it too.
  React.useEffect(() => {
    if (saved !== null && saved === title) setSaved(null);
  }, [title]);
  React.useEffect(() => {
    if (editing && input.current) {
      input.current.focus();
      input.current.select();
    }
  }, [editing]);

  const shown = saved !== null ? saved : title;
  const label = props.children && saved === null ? props.children : shown;
  if (!edit || !edit.enabled || !id) return <span className={props.className}>{label}</span>;

  const start = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setValue(shown || "");
    setError("");
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError("");
  };
  const commit = (check) => {
    const next = value.trim();
    if (!next) return setError("A title cannot be empty.");
    if (next === (shown || "")) return cancel();
    setBusy(true);
    saveRecord(edit, kind, id, { title: next }, check).then((result) => {
      setBusy(false);
      if (result.error) return setError(String(result.error));
      setSaved(next);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <span className="retitle" data-own-escape="" onMouseDown={own} onDragStart={(e) => e.preventDefault()} onClick={own}>
        <input
          ref={input}
          value={value}
          disabled={busy}
          draggable="false"
          aria-label="Title"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            // Enter saves; Ctrl+Enter saves and checks, where checking is offered.
            if (e.key === "Enter") commit((e.ctrlKey || e.metaKey) && CHECKED.has(kind));
            if (e.key === "Escape") cancel();
          }}
        />
        <button type="button" className="chip primary" disabled={busy} title="Save the new title, and nothing else (Enter)" onClick={() => commit(false)}>
          {busy ? "Saving…" : "Save"}
        </button>
        {CHECKED.has(kind) ? (
          <button
            type="button"
            className="chip ask"
            disabled={busy}
            title="Save, then have the assistant say whether the topic changed and ask about what that leaves behind (Ctrl+Enter)"
            onClick={() => commit(true)}
          >
            Save + check ✦
          </button>
        ) : null}
        <button type="button" className="chip" disabled={busy} onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          className="chip"
          disabled={busy}
          title="Every field this item has that the page may change"
          onClick={() => {
            cancel();
            edit.open(kind, id);
          }}
        >
          All fields…
        </button>
        {error ? <small className="reerror">{error}</small> : null}
      </span>
    );
  }
  return (
    <span className={"retitled " + (props.className || "")}>
      {label}
      <button
        type="button"
        className="repen"
        draggable="false"
        title={"Rename — or Shift-click for every field"}
        aria-label={"Rename " + (shown || id)}
        onMouseDown={own}
        onClick={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            edit.open(kind, id);
          } else start(event);
        }}
      >
        <Icon name="edit" />
      </button>
    </span>
  );
}

/**
 * The pencil alone, opening the dialog: for an item drawn as a chip, whose
 * title shares the chip with a date and a weight and cannot be edited in place.
 */
export function EditButton(props) {
  const edit = React.useContext(EditContext);
  if (!edit || !edit.enabled || !props.id) return null;
  return (
    <button
      type="button"
      className="repen solo"
      title={props.title || "Change it"}
      aria-label={"Edit " + props.id}
      onMouseDown={own}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        edit.open(props.kind, props.id);
      }}
    >
      <Icon name="edit" />
    </button>
  );
}

/** Each module's title, editable, joined as the week names them: "A · B". */
export function ModuleTitles(props) {
  return (props.modules || []).map((m, i) => (
    <Fragment key={m.module_id || i}>
      {i ? " · " : null}
      <EditableTitle kind="module" id={m.module_id} title={m.title} />
    </Fragment>
  ));
}

/**
 * The whole item: each field the server says this kind may change, Save, and
 * a line to ask the session for anything else about it.
 */
export function RecordDialog(props) {
  const edit = React.useContext(EditContext);
  const { kind, id, onClose } = props;
  const [record, setRecord] = React.useState(null);
  const [values, setValues] = React.useState({});
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ask, setAsk] = React.useState("");
  const box = React.useRef(null);

  React.useEffect(() => {
    let live = true;
    fetch(recordUrl(edit, "&kind=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id)), { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((value) => {
        if (!live) return;
        if (value.error) return setError(String(value.error));
        setRecord(value);
        setValues(Object.fromEntries(value.fields.map((f) => [f.name, String(f.value ?? "")])));
      })
      .catch((e) => live && setError(String(e.message || e)));
    return () => {
      live = false;
    };
  }, [kind, id]);
  React.useEffect(() => {
    const first = box.current && box.current.querySelector("input,textarea");
    if (first) first.focus();
  }, [record]);

  const changed = record
    ? Object.fromEntries(record.fields.filter((f) => (values[f.name] ?? "") !== String(f.value ?? "")).map((f) => [f.name, values[f.name] ?? ""]))
    : {};
  const missing = record ? record.fields.find((f) => f.required && !String(values[f.name] || "").trim()) : null;
  const save = (check) => {
    if (!Object.keys(changed).length) return onClose();
    setBusy(true);
    saveRecord(edit, kind, id, changed, check).then((result) => {
      setBusy(false);
      if (result.error) return setError(String(result.error));
      onClose();
    });
  };
  const title = record ? (record.fields.find((f) => f.name === "title") || {}).value : "";
  const sendAsk = () => {
    const text = ask.trim();
    if (!text) return;
    press.ask("About " + id + (title ? " (“" + title + "”)" : "") + " in " + edit.runId + ": " + text);
    onClose();
  };

  return (
    <div className="rdveil" data-own-escape="" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={box}
        className="rdialog"
        role="dialog"
        aria-label={"Edit " + id}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !missing) save(false);
        }}
      >
        <div className="rdhead">
          <span className="k">{record ? record.word : "Item"}</span>
          <span className="mono rdid">{id}</span>
          {record && record.draft ? <span className="k">draft</span> : null}
          <button type="button" className="rdclose" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {!record && !error ? <p className="calm">Reading the record…</p> : null}
        {record
          ? record.fields.map((f) => (
              <label key={f.name} className="rdfield">
                <span>
                  {f.label}
                  {f.required ? "" : <small> · may be empty</small>}
                </span>
                {f.shape === "text" ? (
                  <textarea
                    rows={5}
                    maxLength={f.max}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues(Object.assign({}, values, { [f.name]: e.target.value }))}
                  />
                ) : (
                  <input
                    maxLength={f.max}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues(Object.assign({}, values, { [f.name]: e.target.value }))}
                  />
                )}
              </label>
            ))
          : null}
        {record && record.draft ? (
          <p className="rdnote">Changing a draft does not accept it: it stays <span className="mono">approval: draft</span>.</p>
        ) : null}
        {error ? <p className="reerror">{error}</p> : null}
        <div className="pf-actions">
          <button type="button" className="chip primary" disabled={!record || busy || Boolean(missing)} title="Save these fields, and nothing else" onClick={() => save(false)}>
            {busy ? "Saving…" : Object.keys(changed).length ? "Save" : "Done"}
          </button>
          {record && record.check && Object.keys(changed).length ? (
            <button
              type="button"
              className="chip ask"
              disabled={busy || Boolean(missing)}
              title="Save, then have the assistant say whether the topic changed and ask about what that leaves behind"
              onClick={() => save(true)}
            >
              Save + check ✦
            </button>
          ) : null}
          <button type="button" className="chip" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          {missing ? <small className="reerror">{missing.label} cannot be empty.</small> : null}
        </div>
        <div className="rdask">
          <Icon name="ask" />
          <input
            placeholder="Anything else about it — the weight, the rubric, the outcomes — ask the assistant"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                sendAsk();
              }
            }}
          />
          <button type="button" className="chip ask" disabled={!ask.trim()} onClick={sendAsk}>
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

/** The provider the view wraps its readings in: the context, and the one dialog. */
export function EditScope(props) {
  const [open, setOpen] = React.useState(null);
  const value = React.useMemo(
    () => ({
      runId: props.runId,
      sessionId: props.sessionId,
      enabled: props.enabled,
      open: (kind, id) => setOpen({ kind, id }),
    }),
    [props.runId, props.sessionId, props.enabled],
  );
  return (
    <EditContext.Provider value={value}>
      {props.children}
      {open && props.enabled ? <RecordDialog key={open.kind + "|" + open.id} kind={open.kind} id={open.id} onClose={() => setOpen(null)} /> : null}
    </EditContext.Provider>
  );
}
