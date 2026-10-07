/**
 * The preference layers: the schema of what may be set, read from the vendored
 * DataLayer defaults, and the one write `/api/preferences` makes.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dump as dumpYaml } from "@ainar/core/src/yaml-out.ts";
import { parse as parseYaml } from "yaml";

/**
 * The vendored DataLayer defaults, found relative to this file.
 *
 * Deliberately not `process.cwd()`: dsh's working directory is whatever
 * folder the professor opened as a workspace, and the system preference layer
 * lives in this checkout beside the plugin. Resolving from `import.meta.url`
 * means the path is right whether the harness was started from the repo, from
 * a course folder, or from anywhere else.
 */
const DEFAULTS_YAML = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "vendor",
  "datalayer",
  "preferences",
  "defaults.yaml",
);

/**
 * The preference layers, each read where it lives and none of them merged.
 *
 * DataLayer resolves four layers, each beating the one before it, and the
 * useful thing to show a professor is not the winner — it is which file said
 * it. So this returns the layers in resolution order with their own values, and
 * the browser half does the last step in front of them: a value's row names the
 * layer it came from. A merged blob would print a number with no author.
 *
 * The task layer — flags on the invoking command — is not a file and cannot be
 * read here, so it is absent rather than empty.
 */
/**
 * Every option a professor may set, and what a control for it should be.
 *
 * Derived from `defaults.yaml` rather than declared here, because that file is
 * already the list of what DataLayer reads. A second copy would be a list of
 * what the pane BELIEVES DataLayer reads, and the first setting either one grew
 * without the other would be a control writing a key nothing consults.
 *
 * The choices come out of the file's own trailing comments — `style: lecture
 * # lecture | seminar | workshop`. That comment is not decoration; it is the
 * only place the alternatives are written down, and reading it is cheaper and
 * truer than restating them here. A key whose comment says something else, or
 * nothing at all, gets a plain field.
 *
 * A key appearing twice under different groups with DIFFERENT choices is
 * dropped from the option table rather than guessed at: the comment is matched
 * on the key alone, and two answers mean the match is not a match.
 */
const OPTION_COMMENT = /^\s*([A-Za-z0-9_]+):\s*[^#\s][^#]*#\s*([^|#]+(?:\|[^|#]+)+?)\s*$/;

const preferenceSchema = () => {
  let text;
  let parsed;
  try {
    text = readFileSync(DEFAULTS_YAML, "utf8");
    parsed = parseYaml(text) ?? {};
  } catch {
    // No defaults file, so nothing is known to be settable. The view reports
    // the system layer absent for the same reason and by the same route.
    return [];
  }

  const choices = new Map();
  const ambiguous = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = OPTION_COMMENT.exec(line);
    if (!match) continue;
    const words = match[2].split("|").map((word) => word.trim()).filter(Boolean);
    const seen = choices.get(match[1]);
    if (seen && seen.join("|") !== words.join("|")) ambiguous.add(match[1]);
    choices.set(match[1], words);
  }

  const fields = [];
  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node ?? {})) {
      const here = [...path, key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        walk(value, here);
        continue;
      }
      const options = ambiguous.has(key) ? null : choices.get(key) ?? null;
      fields.push({
        path: here.join("."),
        group: path.join(".") || "general",
        label: key.replace(/_/g, " "),
        type: options
          ? "enum"
          : typeof value === "boolean"
            ? "boolean"
            : typeof value === "number"
              ? "number"
              : "text",
        options,
        // `2.5` must not come back as `2` when a professor rounds it: PyYAML
        // writes a float differently from an integer, and `yaml-out` takes
        // float-ness from the caller because JavaScript has one number type.
        float: typeof value === "number" && !Number.isInteger(value),
        fallback: value,
      });
    }
  };
  walk(parsed.values ?? {}, []);
  return fields;
};

/**
 * The layers and where each one lives, named once.
 *
 * Read and write both need this list and must not disagree about it: a Save
 * that wrote somewhere the view does not read would look like a Save that did
 * nothing at all.
 */
const preferenceLayerPaths = (root, courseId, term) => {
  const candidates = [
    {
      scope: "system",
      label: "DataLayer defaults",
      path: DEFAULTS_YAML,
    },
    {
      scope: "professor",
      label: "This professor",
      path: join(process.env.PROFESSOR_HOME || root, "preferences.yaml"),
    },
  ];
  if (courseId) {
    candidates.push({
      scope: "course",
      label: `Course ${courseId}`,
      path: join(root, "courses", courseId, "preferences.yaml"),
    });
    if (term) {
      candidates.push({
        scope: "run",
        label: `${courseId} ${term}`,
        path: join(root, "courses", courseId, "preferences.yaml"),
      });
    }
  }

  return candidates;
};

export const preferencesDocument = (root, courseId, term) => {
  const candidates = preferenceLayerPaths(root, courseId, term);
  const layers = candidates.map((candidate) => {
    let text;
    try {
      text = readFileSync(candidate.path, "utf8");
    } catch {
      // A layer nobody wrote is absent, and absent is a fact: three of these
      // four files not existing is the normal state of a workspace, and drawing
      // it as an empty set of preferences would say something different.
      return { ...candidate, present: false, values: null, error: null };
    }
    try {
      const parsed = parseYaml(text) ?? {};
      return {
        ...candidate,
        present: true,
        profile_id: parsed.profile_id ?? null,
        values: parsed.values ?? {},
        error: null,
      };
    } catch (error) {
      return { ...candidate, present: true, values: null, error: String(error.message ?? error) };
    }
  });

  return {
    layers,
    schema: preferenceSchema(),
    note:
      "Four layers resolve on top of each other, each beating the one before " +
      "it, and the last — flags on the invoking command — is not a file, so it " +
      "is not shown. The DataLayer defaults ship with the harness and are not " +
      "editable here; the other three are yours, and a layer overrides only " +
      "the keys it names.",
  };
};

/**
 * Write one preference layer, and only keys the schema knows.
 *
 * The second write verb in this pane, and unlike the first it is not an
 * approval. A preference is how the professor wants the skills to behave, not a
 * claim about a student, so there is nothing here to accept and no approval
 * path is created by allowing it.
 *
 * What it shares with the first is that it writes a file a person also edits by
 * hand, so it goes through `yaml-out`'s `dump` — the emitter every record writer uses,
 * held to PyYAML byte for byte — and a file this saves is indistinguishable in
 * style from one written beside it.
 *
 * Unknown keys are refused rather than dropped quietly. The form is built FROM
 * the schema, so a key outside it did not come from the form, and writing it
 * would put a setting in the file that nothing ever reads.
 *
 * An empty result does not create a file. "No file here" and "a file that sets
 * nothing" are different facts about a layer — the view says so in those words
 * — and pressing Save on a form nobody filled in must not turn one into the
 * other.
 */
export const writePreferences = (root, scope, courseId, term, values) => {
  if (scope === "system") {
    return { error: "The DataLayer defaults ship with the harness. They are not yours to edit here." };
  }
  const layer = preferenceLayerPaths(root, courseId, term).find((entry) => entry.scope === scope);
  if (!layer) {
    return { error: "No " + scope + " layer for this selection. A course layer needs a course, and a run layer needs a run." };
  }
  if (!existsSync(dirname(layer.path))) {
    return { error: "Nowhere to write: " + dirname(layer.path) + " does not exist." };
  }

  const schema = new Map(preferenceSchema().map((field) => [field.path, field]));
  const floats = new Set();
  const tree = {};
  let count = 0;

  for (const [path, raw] of Object.entries(values ?? {})) {
    const field = schema.get(path);
    if (!field) return { error: path + " is not a preference DataLayer reads." };
    // An empty control means "inherit", which is the ABSENCE of the key rather
    // than a value of its own. That is the whole grammar of a layer.
    if (raw === null || raw === undefined || raw === "") continue;

    let value = raw;
    if (field.type === "boolean") {
      if (raw !== true && raw !== false && raw !== "true" && raw !== "false") {
        return { error: path + " takes true or false." };
      }
      value = raw === true || raw === "true";
    } else if (field.type === "number") {
      value = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) return { error: path + " takes a number." };
      if (field.float || !Number.isInteger(value)) floats.add("values." + path);
    } else if (field.type === "enum" && !field.options.includes(String(raw))) {
      return { error: path + " takes one of: " + field.options.join(", ") + "." };
    } else {
      value = String(raw);
    }

    const parts = path.split(".");
    let node = tree;
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
    count += 1;
  }

  if (count === 0 && !existsSync(layer.path)) {
    return { written: false, path: layer.path, count: 0 };
  }

  // Whatever the file already called itself, it goes on calling itself. The id
  // is how a professor recognises their own layer in a log, and a Save is not
  // a reason to rename it.
  let profileId = null;
  try {
    profileId = (parseYaml(readFileSync(layer.path, "utf8")) ?? {}).profile_id ?? null;
  } catch {
    profileId = null;
  }
  if (!profileId) {
    profileId =
      scope === "professor"
        ? "professor-local"
        : scope === "course"
          ? "course-" + courseId
          : "run-" + courseId + "-" + term;
  }

  const document = { version: 1, profile_id: profileId, scope, values: tree };
  writeFileSync(layer.path, dumpYaml(document, (path) => floats.has(path.join("."))), "utf8");
  return { written: true, path: layer.path, count };
};
