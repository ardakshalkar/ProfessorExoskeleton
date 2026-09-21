/**
 * Whether the record still describes the file, and what to do when it does not.
 *
 * A `Document` carries a `checksum` and a `size_bytes` of the bytes as they
 * were when it was approved. Nothing enforced that afterwards — `validate`
 * checks the *format* of a checksum and never compares it to the file — so
 * editing an approved material in place has always been allowed and has always
 * been silent. Silent is the problem: the professor fixes a word in the
 * markdown, the record still describes the old bytes, the PDF rendered from the
 * old text is still sitting beside it, and the page publishes all of it without
 * a word.
 *
 * So this answers three questions about a run's materials, all of them from
 * content rather than from timestamps — a fresh `git clone` rewrites every
 * mtime, and a rule keyed on mtime would call a whole course stale:
 *
 * * **changed** — the record has a checksum and the bytes no longer match.
 * * **stale** — a rendered sibling of something changed. `week-07-slides.pdf`
 *   beside a `week-07-slides.md` that changed was rendered from the old text,
 *   whatever its own checksum says about itself.
 * * **unstamped** — no checksum was ever recorded, so nothing can be compared.
 *   Hand-authored `documents.yaml` entries are all like this. Publishing stamps
 *   them, which is what makes the *next* edit visible.
 *
 * ## Why re-stamping is allowed to write to `courses/`
 *
 * It is the same argument `lms/link.ts` makes for a Canvas assignment id, and
 * it is if anything easier. A checksum is not a claim: it does not say the deck
 * is good, or approved, or fit to teach. It says *these are the bytes*. When
 * the bytes change, a checksum describing the old ones is simply false, and
 * correcting it re-decides nothing. Every other field — the title, the module,
 * the concepts, who uploaded it — is left exactly as it was.
 *
 * `version` is the one other field touched, and only for a file that actually
 * changed. The old bytes are not lost by this: materials under `courses/` are
 * tracked in git, so version 1 is `git show`. What the field buys is a record
 * that says how many times this material has been through the professor's
 * hands, which is the thing nobody could see before.
 *
 * ## What this deliberately does not do
 *
 * It does not re-render. A changed `.md` makes its `.pptx` and `.pdf` stale and
 * this says so and names the command, but it will not run one: the two
 * renderers in this project write to different places — `render-deck` to
 * `output/<RUN>/` and `materials build` to the course's own `materials/` — and
 * only the second lands where the record points. Rebuilding automatically means
 * choosing between them per document, which is a decision this file does not
 * have the information to make. Until it can, a stale rendering is **held back
 * from publication** rather than published as though it matched.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { CourseBundle } from "./bundle.ts";
import { type EditResult, setRecordFields } from "./record-edit.ts";

/** Formats a material is authored in. */
const SOURCE_FORMATS = new Set(["md", "markdown", "txt", "yaml", "yml", "py", "ipynb"]);

/** Formats a material is rendered into, which nobody authors by hand. */
const DERIVED_FORMATS = new Set(["pptx", "pdf", "docx", "html"]);

export interface Fingerprint {
  documentId: string;
  title: string;
  storageKey: string;
  /** The checksum on the record, or null when it carries none. */
  recorded: string | null;
  /** The checksum of the bytes on disk now. */
  actual: string;
  size: number;
  /** True when this is a rendering rather than something anybody authored. */
  derived: boolean;
  /** The version the record currently claims, so a bump is from the right number. */
  version: number;
}

export interface Stale {
  documentId: string;
  title: string;
  storageKey: string;
  /** The document whose change made this one stale. */
  from: string;
}

export interface Freshness {
  /** A source edited since it was recorded. */
  changed: Fingerprint[];
  /** A RENDERING edited since it was recorded while its source did not move. */
  drifted: Fingerprint[];
  /** A rendering regenerated since its source changed — the two now agree. */
  rebuilt: Fingerprint[];
  /** A rendering of something in `changed`, so it is a picture of the old text. */
  stale: Stale[];
  /** Never had a checksum, so this run is the first that could record one. */
  unstamped: Fingerprint[];
}

export const nothingChanged = (found: Freshness): boolean =>
  !found.changed.length &&
  !found.drifted.length &&
  !found.rebuilt.length &&
  !found.stale.length &&
  !found.unstamped.length;

const extensionOf = (key: string): string => {
  const name = basename(key);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
};

const stemOf = (key: string): string => {
  const name = basename(key);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
};

const digest = (contents: Buffer): string => "sha256:" + createHash("sha256").update(contents).digest("hex");

/**
 * Compare every repository-held material of a run against its record.
 *
 * A `storage_key` with a scheme is in object storage and there is nothing here
 * to read; a key pointing at a file that is not there is already reported by
 * whoever is about to publish it, and is skipped rather than reported twice.
 */
export const freshness = (
  bundle: CourseBundle,
  courseVersionId: string,
  root: string,
): Freshness => {
  const found: Freshness = { changed: [], drifted: [], rebuilt: [], stale: [], unstamped: [] };
  const prints: Fingerprint[] = [];
  /** Renderings whose own bytes moved. Which of two things that means is decided below. */
  const edited: Fingerprint[] = [];

  for (const document of bundle.documents as any[]) {
    if (document.course_version_id !== courseVersionId) continue;
    const key = document.storage_key as string;
    if (!key || key.includes("://")) continue;

    const path = join(root, key);
    let contents: Buffer;
    try {
      if (!statSync(path).isFile()) continue;
      contents = readFileSync(path);
    } catch {
      continue;
    }

    const recorded = typeof document.checksum === "string" ? document.checksum : null;
    const print: Fingerprint = {
      documentId: document.document_id as string,
      title: (document.title as string) ?? "(untitled)",
      storageKey: key,
      recorded,
      actual: digest(contents),
      size: contents.length,
      derived: DERIVED_FORMATS.has(extensionOf(key)),
      version: Number.isFinite(Number(document.version)) ? Number(document.version) : 1,
    };
    prints.push(print);

    if (recorded === null) found.unstamped.push(print);
    else if (recorded !== print.actual) (print.derived ? edited : found.changed).push(print);
  }

  // A rendering is stale when the thing it was rendered FROM changed, whatever
  // its own bytes say. The pairing is the stem of the storage key —
  // `week-07-slides.md`, `.pptx` and `.pdf` are one deck in three formats —
  // which is the convention the pane already uses to put a PDF chip on a deck.
  const changedStems = new Map<string, string>();
  for (const print of found.changed) {
    if (SOURCE_FORMATS.has(extensionOf(print.storageKey))) {
      changedStems.set(stemOf(print.storageKey), print.documentId);
    }
  }
  // Whether a rendering's own bytes moved is what separates the two cases, and
  // getting this wrong deadlocks the whole thing — which is how it was found.
  // A source with a stale rendering is not re-stamped (see `deferredSources`),
  // so if staleness depended only on the source, a rebuild would never clear
  // it: the source stays unrecorded, the rendering stays stale, and the same
  // warning comes back forever.
  //
  // So, for a rendering whose source changed:
  //
  // * its bytes are unchanged  -> **stale**. Nobody rebuilt it, and it is a
  //   picture of the old text.
  // * its bytes changed too    -> **rebuilt**. It was regenerated after the
  //   edit, and both are recorded together.
  //
  // A rendering whose bytes moved while its source did not is **drift**: the
  // professor opened the .pptx itself, which `make-materials` says to report
  // and leave alone.
  const editedIds = new Set(edited.map((print) => print.documentId));
  for (const print of prints) {
    if (!print.derived) continue;
    const from = changedStems.get(stemOf(print.storageKey));
    if (!from) continue;
    if (editedIds.has(print.documentId)) continue;
    found.stale.push({
      documentId: print.documentId,
      title: print.title,
      storageKey: print.storageKey,
      from,
    });
  }
  for (const print of edited) {
    const from = changedStems.get(stemOf(print.storageKey));
    (from ? found.rebuilt : found.drifted).push(print);
  }

  return found;
};

/**
 * Sources whose change is deliberately NOT recorded yet.
 *
 * The trap this closes, found by running it: re-stamping a changed `.md` makes
 * it match its record again, which makes its `.pdf` stop looking stale — so the
 * publication after this one would quietly copy a PDF of the old text, having
 * warned about it exactly once.
 *
 * So a source with a stale rendering keeps its old checksum until the rendering
 * is rebuilt, and the warning keeps coming back. What a recorded checksum means
 * is therefore slightly stronger than "these are the bytes": it means *this is
 * the state in which the source and everything rendered from it agreed*. That is
 * the more useful claim, and it is the one a professor is really asking for when
 * they ask whether the course is up to date.
 */
export const deferredSources = (found: Freshness): Set<string> =>
  new Set(found.stale.map((entry) => entry.from));

/** What a publication would say about it, in the order a professor reads it. */
export const describeFreshness = (found: Freshness): string[] => {
  const lines: string[] = [];
  for (const print of found.changed) {
    lines.push(`${print.documentId} changed since it was recorded — ${print.storageKey}`);
  }
  for (const print of found.rebuilt) {
    lines.push(
      `${print.documentId} was rebuilt since its source changed — ${print.storageKey}`,
    );
  }
  for (const print of found.drifted) {
    lines.push(
      `${print.documentId} is a rendering somebody edited directly — ${print.storageKey}. ` +
        "Re-rendering it from its source would overwrite that edit",
    );
  }
  for (const entry of found.stale) {
    lines.push(
      `${entry.documentId} was rendered from ${entry.from}, which changed — ` +
        `held back rather than published as though it matched`,
    );
  }
  if (found.unstamped.length) {
    lines.push(
      `${found.unstamped.length} material(s) carry no checksum; this records one, so the ` +
        "next edit is visible",
    );
  }
  return lines;
};

/** Stale renderings, as the `documentId -> reason` map `publishable` holds back. */
export const heldBackForStaleness = (found: Freshness): Map<string, string> =>
  new Map(
    found.stale.map((entry) => [
      entry.documentId,
      `rendered from ${entry.from}, which has changed since — rebuild it before publishing it`,
    ]),
  );

/**
 * Write the current bytes' checksum and size back onto the records.
 *
 * `version` goes up for a file that changed and stays where it is for one that
 * merely had no checksum: the first is a new version of the material, the
 * second is the same material finally described.
 */
export const restamp = (
  root: string,
  courseId: string,
  found: Freshness,
): EditResult & { deferred: string[] } => {
  const edits = new Map<string, Record<string, string | number>>();
  const defer = deferredSources(found);

  for (const print of found.unstamped) {
    edits.set(print.documentId, { checksum: print.actual, size_bytes: print.size });
  }
  for (const print of [...found.changed, ...found.drifted, ...found.rebuilt]) {
    if (defer.has(print.documentId)) continue;
    edits.set(print.documentId, {
      checksum: print.actual,
      size_bytes: print.size,
      version: print.version + 1,
    });
  }

  // `setRecordFields`, not `editRecords`: these are three top-level scalars,
  // and the line-level writer leaves every other byte of the professor's file
  // exactly as it was. Its header has the measurement that settled it.
  const written = setRecordFields({
    root,
    courseId,
    // The loader's own patterns for documents, so this looks exactly where the
    // record could have been read from.
    patterns: ["documents.yaml", "documents/*.yaml", "samples/documents*.yaml"],
    idField: "document_id",
    collection: "documents",
    edits,
  });
  return { ...written, deferred: [...defer].sort() };
};
