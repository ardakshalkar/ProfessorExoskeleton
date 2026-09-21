/**
 * Changing one field of one record, in a file a person also edits by hand.
 *
 * This is the machinery `src/lms/link.ts` grew and a second caller now needs:
 * `ainar publish` re-stamps a document's checksum when the file behind it has
 * been edited. The rules are the same in both cases and are the whole of the
 * difficulty, so they live here once:
 *
 * * **Find the file by the identifier, never by guessing the filename.** A
 *   record sits wherever it was authored or approved into — `documents.yaml`
 *   or `documents/generated.yaml`, and the loader reads both. Guessing
 *   `generated.yaml` is right until somebody hand-authors one, and then it
 *   silently edits the wrong record.
 * * **Refuse a multi-document file** rather than half-rewriting it.
 * * **Edit through `yaml`'s document API**, not by re-dumping a parsed object.
 *   These files are full of comments explaining why a weight is what it is,
 *   and a round trip through `parse` and `dump` deletes every one of them.
 * * **Keep the line endings the file arrived with.** A record edited on
 *   Windows would otherwise come back with every line changed, and a one-field
 *   change would show up in `git diff` as a rewrite of the whole file.
 * * **Refuse before writing anything.** A half-written change is worse than
 *   none, because the half that landed looks like the whole.
 *
 * What is NOT here is whether a given edit is allowed at all. `link.ts` argues
 * that a Canvas assignment id is a pointer at another system and not a
 * judgement anybody should have to re-accept; `freshness.ts` argues that a
 * checksum describes the bytes rather than claiming anything about them. Each
 * caller makes its own case, because each case is different.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";

export interface EditResult {
  /** The files that were rewritten. */
  written: string[];
  /** How many records were touched. */
  count: number;
}

/**
 * Every file under a course that a collection's records could be in.
 *
 * `patterns` are the loader's own, from `COLLECTIONS` in `loader.ts`, so this
 * looks exactly where the record could have been read from. Two shapes are
 * supported because those are the two the loader uses: a plain name, and one
 * `*` inside a directory.
 */
export const candidateFiles = (root: string, courseId: string, patterns: string[]): string[] => {
  const base = join(root, "courses", courseId);
  const found: string[] = [];
  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      found.push(join(base, pattern));
      continue;
    }
    const slash = pattern.lastIndexOf("/");
    const directory = slash === -1 ? "" : pattern.slice(0, slash);
    const name = pattern.slice(slash + 1);
    const star = name.indexOf("*");
    const prefix = name.slice(0, star);
    const suffix = name.slice(star + 1);
    try {
      for (const entry of readdirSync(join(base, directory)).sort()) {
        if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
          found.push(join(base, directory, entry));
        }
      }
    } catch {
      // The directory does not exist, which is the single-file layout.
    }
  }
  return found;
};

/** The record nodes in a parsed file, in the three shapes the loader accepts. */
const recordNodes = (contents: any, collection: string): any[] => {
  if (contents && Array.isArray(contents.items) && contents.items[0]?.key === undefined) {
    return contents.items;
  }
  if (contents && typeof contents.get === "function" && contents.get(collection)) {
    const inner = contents.get(collection);
    return Array.isArray(inner?.items) ? inner.items : [];
  }
  return contents ? [contents] : [];
};

/**
 * Apply one edit per identifier, and say which files changed.
 *
 * `edits` maps an identifier to a function handed that record's YAML node —
 * `node.setIn([...], value)` and `node.deleteIn([...])` are the two things a
 * caller does with it. Throws rather than returning a partial result; every
 * refusal happens before any file is opened for writing, so a throw means
 * nothing was touched.
 */
export const editRecords = (options: {
  root: string;
  courseId: string;
  /** The loader's patterns for this collection, e.g. `["documents.yaml", "documents/*.yaml"]`. */
  patterns: string[];
  /** The key a record is identified by, e.g. `document_id`. */
  idField: string;
  /** The key a file's list of these records sits under, e.g. `documents`. */
  collection: string;
  edits: Map<string, (node: any) => void>;
}): EditResult => {
  const { root, courseId, patterns, idField, collection, edits } = options;
  if (!edits.size) return { written: [], count: 0 };

  const byFile = new Map<string, string[]>();
  const unplaced = new Set(edits.keys());
  for (const path of candidateFiles(root, courseId, patterns)) {
    if (!unplaced.size) break;
    let text: string;
    try {
      text = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    for (const id of [...unplaced]) {
      if (!new RegExp(`^\\s*-?\\s*${idField}:\\s*["']?${id}["']?\\s*$`, "m").test(text)) continue;
      if (!byFile.has(path)) byFile.set(path, []);
      byFile.get(path)!.push(id);
      unplaced.delete(id);
    }
  }
  if (unplaced.size) {
    throw new Error(
      `No record file under courses/${courseId}/ holds ` +
        `${[...unplaced].sort().join(", ")}. Nothing was written.`,
    );
  }

  const written: string[] = [];
  let count = 0;
  for (const [path, ids] of byFile) {
    const original = readFileSync(path, "utf-8");
    // Before parsing, so that this sentence is the one the reader gets. `yaml`
    // refuses a multi-document file too, and its advice — call
    // `parseAllDocuments()` — is addressed to whoever wrote this code rather
    // than to whoever has to fix the file.
    if (/^---\s*$/m.test(original.replace(/^---\s*\n/, ""))) {
      throw new Error(
        `${path} holds more than one YAML document, which this cannot rewrite ` +
          "safely. Change it there by hand.",
      );
    }
    const document = parseDocument(original);
    if (document.errors?.length) {
      throw new Error(`${path} will not parse: ${document.errors[0]!.message}`);
    }

    const nodes = recordNodes(document.contents, collection);
    for (const id of ids) {
      const node = nodes.find(
        (entry: any) => typeof entry?.get === "function" && String(entry.get(idField)) === id,
      );
      if (!node) {
        throw new Error(
          `${id} was found in ${path} but not as a record this can edit. ` +
            "Change it there by hand.",
        );
      }
      edits.get(id)!(node);
      count += 1;
    }

    // The padding comes from the file rather than from the library. `yaml`
    // re-pads every flow sequence by default — `[LO-02, LO-04]` comes back as
    // `[ LO-02, LO-04 ]` — so a one-field edit arrived as twenty changed lines
    // in a file nobody had touched. Unpadded unless the file is consistently
    // padded, because `yaml-out.ts`, the emitter `approve` writes with, is a
    // PyYAML transcription with `default_flow_style=False` and emits no flow
    // collections at all: the hand-authored files are the only ones with an
    // opinion here.
    //
    // Line wrapping is left at the default, which is the lesser of two evils
    // and the reason `setRecordFields` exists below. See its header.
    const padded = / \S/.test(original.match(/\[\s?\S/)?.[0] ?? "");
    const rendered = document.toString({ flowCollectionPadding: padded });
    const text = /\r\n/.test(original) ? rendered.replace(/\r?\n/g, "\r\n") : rendered;
    writeFileSync(path, text, "utf-8");
    written.push(path);
  }

  return { written, count };
};

// --------------------------------------------------------------------------
// Setting a scalar without reformatting anything
// --------------------------------------------------------------------------

/**
 * Set a few top-level scalar fields on one record, as a text edit.
 *
 * `editRecords` above goes through the YAML document API, which is the only
 * way to set a nested key or delete one, and it pays for that: re-emitting the
 * document re-wraps scalars the library would have wrapped differently. No
 * setting avoids it. A real course's `documents.yaml` mixes hand-written lines
 * of 105 characters with block scalars folded at 76, so the default width
 * re-wraps the long ones, `lineWidth: 0` joins the folded ones, and 88 — the
 * width `yaml-out.ts` emits at — does both somewhere. The first time this was
 * used to stamp two checksums, it rewrote twenty-four lines nobody had asked
 * it to touch.
 *
 * Setting a scalar needs none of that. The line is found, the line is
 * replaced, and every other byte of the file is the byte it was — including
 * the comments, the wrapping, the flow style and the line endings. The result
 * is then **parsed and checked** before it is written: if the edit did not
 * produce exactly the values asked for, nothing is written and the caller is
 * told, because a text edit that lands somewhere unexpected in a professor's
 * record is worse than a refusal.
 *
 * Only top-level fields of a record, and only scalars. Anything else is
 * `editRecords`.
 */
export const setRecordFields = (options: {
  root: string;
  courseId: string;
  patterns: string[];
  idField: string;
  collection: string;
  /** Per identifier, the fields to set. */
  edits: Map<string, Record<string, string | number>>;
}): EditResult => {
  const { root, courseId, patterns, idField, collection, edits } = options;
  if (!edits.size) return { written: [], count: 0 };

  const written: string[] = [];
  let count = 0;
  const unplaced = new Set(edits.keys());

  for (const path of candidateFiles(root, courseId, patterns)) {
    if (!unplaced.size) break;
    let original: string;
    try {
      original = readFileSync(path, "utf-8");
    } catch {
      continue;
    }

    const eol = /\r\n/.test(original) ? "\r\n" : "\n";
    let lines = original.split(/\r?\n/);
    let touched = 0;

    for (const id of [...unplaced]) {
      const marker = new RegExp(`^(\\s*)(-\\s+)?${idField}:\\s*["']?${id}["']?\\s*$`);
      const at = lines.findIndex((line) => marker.test(line));
      if (at === -1) continue;

      // The column the record's own keys start at — after the `- ` when the
      // identifier opens a list item, and its own indent when it does not.
      const found = marker.exec(lines[at]!)!;
      const indent = " ".repeat((found[1] ?? "").length + (found[2] ?? "").length);

      // The record runs until something outdents past its keys. A blank line
      // or a comment inside it is part of it; the next `- ` at a shallower
      // column is the next record.
      let end = at + 1;
      while (end < lines.length) {
        const line = lines[end]!;
        if (line.trim() === "" || line.trimStart().startsWith("#")) {
          end += 1;
          continue;
        }
        if (!line.startsWith(indent)) break;
        end += 1;
      }
      // Back off any trailing blanks or comments, so an inserted field lands
      // inside the record rather than after the comment that follows it.
      let insertAt = end;
      while (insertAt > at + 1) {
        const line = lines[insertAt - 1]!;
        if (line.trim() === "" || line.trimStart().startsWith("#")) insertAt -= 1;
        else break;
      }

      for (const [field, value] of Object.entries(edits.get(id)!)) {
        const rendered = `${indent}${field}: ${plainScalar(value)}`;
        const existing = lines.findIndex(
          (line, index) =>
            index > at && index < end && new RegExp(`^${indent}${field}:`).test(line),
        );
        if (existing === -1) {
          lines = [...lines.slice(0, insertAt), rendered, ...lines.slice(insertAt)];
          insertAt += 1;
          end += 1;
        } else {
          lines[existing] = rendered;
        }
      }
      touched += 1;
      unplaced.delete(id);
    }

    if (!touched) continue;

    // Checked before it is written. A text edit is only as good as its own
    // proof that it landed where it was aimed.
    const candidate = lines.join(eol);
    const reparsed = parseDocument(candidate);
    if (reparsed.errors?.length) {
      throw new Error(
        `setting those fields would not leave ${path} as valid YAML ` +
          `(${reparsed.errors[0]!.message}). Nothing was written.`,
      );
    }
    for (const node of recordNodes(reparsed.contents, collection)) {
      if (typeof node?.get !== "function") continue;
      const id = String(node.get(idField));
      const wanted = edits.get(id);
      if (!wanted) continue;
      for (const [field, value] of Object.entries(wanted)) {
        if (String(node.get(field)) !== String(value)) {
          throw new Error(
            `${id}.${field} did not come back as ${value} after the edit to ${path}. ` +
              "Nothing was written.",
          );
        }
      }
    }

    writeFileSync(path, candidate, "utf-8");
    written.push(path);
    count += touched;
  }

  if (unplaced.size) {
    throw new Error(
      `No record file under courses/${courseId}/ holds ` +
        `${[...unplaced].sort().join(", ")}. Nothing was written.`,
    );
  }

  return { written, count };
};

/**
 * A value as YAML, quoted only when it has to be.
 *
 * `sha256:abc…` is a plain scalar — the colon is only a key separator when a
 * space follows it — and writing it quoted would make a file this touched
 * distinguishable from one `approve` wrote.
 */
const plainScalar = (value: string | number): string => {
  if (typeof value === "number") return String(value);
  return /^[A-Za-z0-9][\w.:+/@-]*$/.test(value) ? value : JSON.stringify(value);
};
