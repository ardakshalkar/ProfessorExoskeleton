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

/** Set `fields` on one item; resolves to the server's answer, an error included. */
export function saveRecord(edit, kind, id, fields) {
  return fetch(recordUrl(edit), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, id, fields }),
  })
    .then((response) => response.json())
    .catch((error) => ({ error: String(error.message || error) }))
    .then((result) => {
      if (result.written) wrote(edit.sessionId, []);
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
  const commit = () => {
    const next = value.trim();
    if (!next) return setError("A title cannot be empty.");
    if (next === (shown || "")) return cancel();
    setBusy(true);
    saveRecord(edit, kind, id, { title: next }).then((result) => {
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
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
        />
        <button type="button" className="chip primary" disabled={busy} onClick={commit}>
          {busy ? "Saving…" : "Save"}
        </button>
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
  const save = () => {
    if (!Object.keys(changed).length) return onClose();
    setBusy(true);
    saveRecord(edit, kind, id, changed).then((result) => {
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
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !missing) save();
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
          <button type="button" className="chip primary" disabled={!record || busy || Boolean(missing)} onClick={save}>
            {busy ? "Saving…" : Object.keys(changed).length ? "Save" : "Done"}
          </button>
          <button type="button" className="chip" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          {missing ? <small className="reerror">{missing.label} cannot be empty.</small> : null}
        </div>
        <div className="rdask">
          <Icon name="ask" />
          <input
            placeholder="Anything else about it — the weight, the rubric, the outcomes — ask Claude"
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
