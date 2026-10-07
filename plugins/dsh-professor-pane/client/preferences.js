/**
 * The Preferences tab: the layers and the form that writes one.
 */

import { Message, useJson } from "./common.js";
import { h, React } from "./react.js";
import { BASE, scoped } from "./tabs.js";

/**
 * One preference layer.
 *
 * The keys are flattened to dotted paths because that is how DataLayer's
 * own documentation names them (`presentation.audience`), and because the
 * nesting is two or three deep and an indented tree in a 360px column reads
 * worse than the path does. A value that is a list is joined; a value that
 * is `ask` is left as the word, which is the whole point of that value.
 */
function Layer(props) {
  const layer = props.layer;
  const rows = [];
  const walk = (value, prefix) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const key of Object.keys(value)) walk(value[key], prefix ? prefix + "." + key : key);
      return;
    }
    rows.push({
      key: prefix,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    });
  };
  if (layer.values) walk(layer.values, "");

  return h(
    "div",
    { className: "pp-layer" },
    h("p", { className: "pp-layername" }, layer.label + " · " + layer.scope),
    h("p", { className: "pp-layerpath" }, layer.path),
    layer.error
      ? h("p", { className: "pp-absent" }, "This file could not be parsed: " + layer.error)
      : !layer.present
        ? h("p", { className: "pp-absent" }, "No file here. Nothing at this layer.")
        : rows.length === 0
          ? h("p", { className: "pp-absent" }, "The file has no `values` block.")
          : rows.map((row) =>
              h(
                "div",
                { className: "pp-pref", key: row.key },
                h("span", { className: "pp-prefkey" }, row.key),
                h("span", { className: "pp-prefval" }, row.value),
              ),
            ),
  );
}

/** A layer's `values` tree as the dotted paths the schema speaks in. */
function flattenValues(values) {
  const out = {};
  const walk = (node, prefix) => {
    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
      for (const key of Object.keys(node)) walk(node[key], prefix ? prefix + "." + key : key);
      return;
    }
    out[prefix] = Array.isArray(node) ? node.join(", ") : node;
  };
  if (values) walk(values, "");
  return out;
}

/**
 * What a setting would be if this layer said nothing, and who said it.
 *
 * The layers arrive in resolution order, so everything BEFORE the selected
 * one is what it would inherit. This is the difference between a form that
 * can be filled in safely and one that cannot: a professor typing into an
 * empty box needs to know they are replacing `true` from the DataLayer
 * defaults, not filling a hole.
 */
function inheritedAt(flats, layers, scope, path) {
  let found = null;
  for (let index = 0; index < layers.length; index += 1) {
    if (layers[index].scope === scope) break;
    if (Object.prototype.hasOwnProperty.call(flats[index], path)) {
      found = { value: flats[index][path], label: layers[index].label };
    }
  }
  return found;
}

/**
 * The preference layers: which file says what, and a form for the three
 * that are the professor's.
 *
 * **The picker is the view.** Selecting a layer shows its path, its own
 * values as controls, and what each one would inherit if it said nothing —
 * so "which file said it", the question this tab exists for, is answered by
 * the row rather than by scrolling four stacked lists. `All layers` keeps
 * the stacked read-only form for when the whole resolution is the question.
 *
 * **A blank control means inherit, not empty.** A layer overrides only the
 * keys it names, so clearing a box removes the key rather than writing an
 * empty one. That is why every control offers `inherit` explicitly instead
 * of leaving the professor to guess what an empty box does.
 *
 * **The form is built from the schema the host derived from
 * `defaults.yaml`**, which is the list of what DataLayer actually reads. A
 * control here cannot write a setting nothing consults, and a setting the
 * defaults grow appears here without this file changing.
 *
 * The DataLayer defaults themselves are not editable: they ship with the
 * harness, they are the same for every professor, and a pane that let one
 * be edited would be editing the installation rather than the course.
 */
export function Preferences(props) {
  const url = scoped(
    BASE +
      "/api/preferences?course=" +
      encodeURIComponent(props.courseId || "") +
      "&term=" +
      encodeURIComponent(props.term || ""),
    props.sessionId,
  );
  const state = useJson(url);
  // What a Save handed back, which is the file as it now is. Preferred over
  // the fetch so the form redraws from disk rather than from its own memory
  // of what was typed.
  const [fresh, setFresh] = React.useState(null);
  const [scope, setScope] = React.useState("professor");
  const [edits, setEdits] = React.useState({});
  const [status, setStatus] = React.useState(null);

  const data =
    fresh || (state.phase === "ready" && !state.value.error ? state.value : null);

  // Reseed whenever the file changes under the form or the layer changes.
  // Keyed on `phase` and the save counter rather than on `data`, because a
  // fetch hook that returns a fresh object each render would make an effect
  // depending on the object itself run forever.
  React.useEffect(() => {
    if (!data) return;
    const layer = data.layers.filter((entry) => entry.scope === scope)[0];
    setEdits(flattenValues(layer && layer.values));
    setStatus(null);
  }, [state.phase, fresh, scope]);

  if (state.phase === "loading") return h(Message, null, "Reading the preference files…");
  if (state.value && state.value.error) return h(Message, { error: true }, state.value.error);
  if (!data) return h(Message, null, "No preferences to show.");

  const layers = data.layers;
  const flats = layers.map((layer) => flattenValues(layer.values));
  const editable = layers.filter((layer) => layer.scope !== "system");
  const chosen = layers.filter((entry) => entry.scope === scope)[0];

  const picker = h(
    "div",
    { className: "pp-seg" },
    editable
      .map((layer) =>
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            "aria-pressed": scope === layer.scope,
            title: layer.path,
            onClick: () => setScope(layer.scope),
            key: layer.scope,
          },
          layer.label,
        ),
      )
      .concat([
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            "aria-pressed": scope === "all",
            title: "Every layer as it stands, including the DataLayer defaults",
            onClick: () => setScope("all"),
            key: "all",
          },
          "All layers",
        ),
      ]),
  );

  if (scope === "all" || !chosen) {
    return h(
      "div",
      { className: "pp-prefwrap" },
      picker,
      h(
        "div",
        { className: "pp-scroll" },
        layers.map((layer) => h(Layer, { layer: layer, key: layer.scope })),
        h("p", { className: "pp-absent" }, data.note),
      ),
    );
  }

  const setField = (path, value) =>
    setEdits((previous) => Object.assign({}, previous, { [path]: value }));

  const control = (field) => {
    const has = Object.prototype.hasOwnProperty.call(edits, field.path);
    const raw = has && edits[field.path] !== null ? edits[field.path] : "";
    const current = String(raw);
    const inherited = inheritedAt(flats, layers, scope, field.path);
    const className = "pp-prefctl" + (current === "" ? "" : " pp-set");

    if (field.type === "boolean" || field.type === "enum") {
      const options = field.type === "boolean" ? ["true", "false"] : field.options;
      return h(
        "select",
        {
          className: className,
          value: current,
          onChange: (event) => setField(field.path, event.target.value),
        },
        [h("option", { value: "", key: "" }, "inherit")].concat(
          options.map((option) => h("option", { value: option, key: option }, option)),
        ),
      );
    }
    return h("input", {
      className: className,
      type: field.type === "number" ? "number" : "text",
      step: "any",
      value: current,
      // The inherited value, so an empty box shows what it is deferring to
      // rather than looking unset.
      placeholder: inherited === null ? "inherit" : String(inherited.value),
      onChange: (event) => setField(field.path, event.target.value),
    });
  };

  const rows = [];
  let group = null;
  for (const field of data.schema) {
    if (field.group !== group) {
      group = field.group;
      rows.push(h("p", { className: "pp-prefgroup", key: "g:" + group }, group));
    }
    const inherited = inheritedAt(flats, layers, scope, field.path);
    rows.push(
      h(
        "div",
        { className: "pp-prefrow", key: field.path },
        h(
          "span",
          { className: "pp-preflabel" },
          field.label,
          h(
            "span",
            { className: "pp-prefinherit" },
            inherited === null
              ? "nothing below sets this"
              : String(inherited.value) + " · " + inherited.label,
          ),
        ),
        control(field),
      ),
    );
  }

  const save = () => {
    setStatus("saving");
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: scope, values: edits }),
    })
      .then((response) => response.json())
      .then((body) => {
        if (body.error) {
          setStatus({ error: body.error });
          return;
        }
        setFresh(body);
        setStatus({ saved: body.saved });
      })
      .catch((error) => setStatus({ error: String((error && error.message) || error) }));
  };

  const saved = status && status.saved;
  return h(
    "div",
    { className: "pp-prefwrap" },
    picker,
    h(
      "div",
      { className: "pp-scroll" },
      h("p", { className: "pp-layername" }, chosen.label + " · " + chosen.scope),
      h("p", { className: "pp-layerpath" }, chosen.path),
      chosen.error
        ? h("p", { className: "pp-saveerr" }, "This file could not be parsed: " + chosen.error)
        : null,
      h(
        "p",
        { className: "pp-absent" },
        chosen.present
          ? "This file exists. It overrides only the settings it names."
          : "No file here yet. Saving a setting creates it; saving nothing does not.",
      ),
      rows,
      h(
        "div",
        { className: "pp-saverow" },
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            disabled: status === "saving",
            title: "Write these settings to " + chosen.path,
            onClick: save,
          },
          status === "saving" ? "Saving…" : "Save to this layer",
        ),
        h(
          "button",
          {
            type: "button",
            className: "pp-segbtn",
            onClick: () => {
              setEdits(flattenValues(chosen.values));
              setStatus(null);
            },
          },
          "Revert",
        ),
        status && status.error
          ? h("span", { className: "pp-saveerr" }, status.error)
          : saved
            ? h(
                "span",
                { className: "pp-savenote" },
                saved.written
                  ? "Wrote " + saved.count + " setting" + (saved.count === 1 ? "" : "s") + "."
                  : "Nothing set, so no file was created.",
              )
            : null,
      ),
    ),
  );
}
