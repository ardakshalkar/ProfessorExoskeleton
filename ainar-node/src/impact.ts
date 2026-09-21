/**
 * What one material is, and what changing it would drag behind it.
 *
 * This is the question a small change asks and nothing could answer. *Fix this
 * word on slide 4* is a one-line edit, but before this the only thing an agent
 * could reliably do with it was re-run `make-materials` and regenerate the
 * whole deck — thirty slides rewritten, new figures chosen, and whatever the
 * professor had edited by hand quietly gone. Not because regenerating is
 * anybody's preference, but because the alternative needs four facts that were
 * scattered across the record, the filesystem and a ledger:
 *
 * * **which file** the thing actually is, and whether it is a draft nobody has
 *   accepted or a record the course stands behind;
 * * **whether the file still matches** what the record says about it;
 * * **what was rendered from it** — a `.pptx` and a `.pdf` are the same deck in
 *   three formats and a changed `.md` makes both of them pictures of old text;
 * * **where it has already been sent**, because a page published on Tuesday is
 *   the version students are reading right now.
 *
 * `freshness.ts` computes the second and third, the publish ledger holds the
 * fourth, and this puts them beside the first so that one read answers *what
 * do I do next*. It writes nothing, reaches nothing, and decides nothing: the
 * choice between editing a draft, editing a record and regenerating is the
 * caller's, and `/revise` is the decision procedure that makes it.
 *
 * ## Why the answer names commands
 *
 * Because "what depends on this" is only half a useful answer. A professor who
 * learns that a PDF is stale still has to know that `materials build` is what
 * fixes it, and an agent that learns the page is behind still has to know that
 * `publish update` is what catches it up. The `next` lines are assembled from
 * the same facts as the report above them, so they cannot recommend a step the
 * report does not justify.
 */

import type { CourseBundle } from "./bundle.ts";
import { type Fingerprint, fingerprints } from "./freshness.ts";
import type { Publication } from "./lms/ledger.ts";

export interface Impact {
  documentId: string;
  title: string;
  storageKey: string;
  /** `draft` while the file is under `work/`, `record` once approval moved it. */
  state: "draft" | "record" | "elsewhere";
  version: number;
  /**
   * How the file and the record stand to one another.
   *
   * `unstamped` is not a fault: a hand-authored document carries no checksum
   * until something publishes it, and until then a change cannot be seen.
   */
  fileState: "matches" | "changed" | "unstamped" | "missing" | "object-storage";
  /** Other formats of the same material, by the storage-key stem convention. */
  renderings: { documentId: string; storageKey: string; stale: boolean }[];
  /** Set when this document is itself a rendering of another. */
  renderedFrom: string | null;
  /** Records that point at this document, in words. */
  usedBy: string[];
  /** Where it has gone, and whether that copy is behind what is on disk. */
  publishedTo: { where: string; at: string; behind: boolean }[];
  /** What to do, in the order to do it. */
  next: string[];
}

const SOURCE_FORMATS = new Set(["md", "markdown", "txt", "py", "ipynb"]);
const DERIVED_FORMATS = new Set(["pptx", "pdf", "docx", "html"]);

const extensionOf = (key: string): string => {
  const name = key.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
};

const stemOf = (key: string): string => {
  const name = key.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
};

/** Everything in the run that points at this document, said in words. */
const references = (bundle: CourseBundle, courseVersionId: string, documentId: string): string[] => {
  const found: string[] = [];

  const byResource = new Map<string, string>();
  for (const resource of (bundle.resources ?? []) as any[]) {
    if (resource.document_id !== documentId) continue;
    byResource.set(resource.resource_id, resource.title ?? resource.resource_id);
    found.push(`${resource.resource_id} — ${resource.title ?? "a resource"} (${resource.kind ?? "resource"})`);
  }

  // A meeting reaches a document through a resource, which is the chain the
  // week-by-week view walks. Naming the meeting rather than only the resource
  // is the difference between "RES-442" and "week 6's lecture".
  for (const activity of (bundle.activities ?? []) as any[]) {
    if (activity.course_version_id !== courseVersionId) continue;
    for (const resourceId of activity.resources ?? []) {
      if (!byResource.has(resourceId)) continue;
      const when = activity.scheduled_at ? ` on ${String(activity.scheduled_at).slice(0, 10)}` : "";
      found.push(`${activity.activity_id} — ${activity.title}${when}, through ${resourceId}`);
    }
  }

  for (const assessment of (bundle.assessments ?? []) as any[]) {
    if (assessment.instructions_document_id !== documentId) continue;
    found.push(`${assessment.assessment_id} — ${assessment.title}, as the brief students read`);
  }

  for (const version of (bundle.versions ?? []) as any[]) {
    if (version.syllabus_document_id !== documentId) continue;
    found.push(`${version.course_version_id} — as the syllabus of the run itself`);
  }

  return found;
};

export const impact = (options: {
  bundle: CourseBundle;
  courseVersionId: string;
  root: string;
  documentId: string;
  publications: Record<string, Publication>;
}): Impact | null => {
  const { bundle, courseVersionId, root, documentId, publications } = options;
  const document = (bundle.documents as any[]).find((entry) => entry.document_id === documentId);
  if (!document) return null;

  const prints = fingerprints(bundle, courseVersionId, root);
  const byId = new Map(prints.map((print) => [print.documentId, print]));
  const print: Fingerprint | undefined = byId.get(documentId);

  const storageKey = (document.storage_key as string) ?? "";
  const state = storageKey.includes("://")
    ? "elsewhere"
    : storageKey.startsWith("work/")
      ? "draft"
      : "record";

  const fileState: Impact["fileState"] = storageKey.includes("://")
    ? "object-storage"
    : print === undefined
      ? "missing"
      : print.recorded === null
        ? "unstamped"
        : print.recorded === print.actual
          ? "matches"
          : "changed";

  // Everything sharing this file's stem is the same material in another
  // format. Which of them is the source is decided by extension, not by
  // guessing: nobody hand-writes a .pdf.
  const stem = stemOf(storageKey);
  const siblings = prints.filter(
    (entry) => entry.documentId !== documentId && stemOf(entry.storageKey) === stem,
  );
  const thisIsSource = SOURCE_FORMATS.has(extensionOf(storageKey));
  const renderings = thisIsSource
    ? siblings
        .filter((entry) => DERIVED_FORMATS.has(extensionOf(entry.storageKey)))
        .map((entry) => ({
          documentId: entry.documentId,
          storageKey: entry.storageKey,
          // Stale exactly when this source has moved and the rendering has
          // not — the rule `freshness.ts` arrived at and for its reasons.
          stale: fileState === "changed" && entry.recorded === entry.actual,
        }))
    : [];
  const renderedFrom = DERIVED_FORMATS.has(extensionOf(storageKey))
    ? (siblings.find((entry) => SOURCE_FORMATS.has(extensionOf(entry.storageKey)))?.documentId ?? null)
    : null;

  const publishedTo: Impact["publishedTo"] = [];
  for (const entry of Object.values(publications)) {
    const went = entry.materials[documentId];
    if (went === undefined) continue;
    publishedTo.push({
      where: entry.where,
      at: entry.at,
      behind: print !== undefined && went !== print.actual,
    });
  }

  const next: string[] = [];
  if (state === "draft") {
    next.push(`edit ${storageKey} — it is a draft, so nothing has to be promoted first`);
    next.push("publishing it is what promotes it, and the plan says so before it does");
  } else if (state === "record") {
    if (fileState === "matches" || fileState === "unstamped") {
      next.push(`edit ${storageKey} in place — a new identifier is not needed, and neither is \`supersedes\``);
    }
    if (fileState === "changed") {
      next.push(`${storageKey} has already been edited; the record catches up on the next publication`);
    }
    if (fileState === "missing") {
      next.push(`${storageKey} is not a file in this repository — that is a modelling error, not an edit`);
    }
  }
  for (const rendering of renderings) {
    if (!rendering.stale) continue;
    next.push(
      `rebuild ${rendering.storageKey} (${rendering.documentId}) — it is a picture of the old text, ` +
        "and publishing holds it back until it is rebuilt",
    );
  }
  if (publishedTo.some((entry) => entry.behind)) {
    next.push(`\`ainar publish update ${courseVersionId}\` — ${publishedTo.filter((entry) => entry.behind).length} place(s) have the old version`);
  } else if (publishedTo.length) {
    next.push("every place this went has the current version");
  }
  if (!next.length) next.push("nothing follows from this one; it is a record nobody has published yet");

  return {
    documentId,
    title: (document.title as string) ?? "(untitled)",
    storageKey,
    state,
    version: print?.version ?? Number(document.version ?? 1),
    fileState,
    renderings,
    renderedFrom,
    usedBy: references(bundle, courseVersionId, documentId),
    publishedTo,
    next,
  };
};

const FILE_STATE: Record<Impact["fileState"], string> = {
  matches: "matches the record",
  changed: "CHANGED since the record was written",
  unstamped: "no checksum recorded yet, so a change cannot be seen until something publishes it",
  missing: "not a file in this repository",
  "object-storage": "held in object storage, not here",
};

export const describeImpact = (found: Impact): string[] => {
  const lines = [`${found.documentId}  ${found.title}`];
  lines.push(
    `  state       a ${found.state === "record" ? "record" : found.state}, version ${found.version}`,
  );
  lines.push(`  file        ${found.storageKey || "(none)"} — ${FILE_STATE[found.fileState]}`);

  if (found.renderedFrom) {
    lines.push(`  rendered    from ${found.renderedFrom}. Edit that, not this one`);
  }
  for (const rendering of found.renderings) {
    lines.push(
      `  rendered    ${rendering.storageKey} (${rendering.documentId})` +
        (rendering.stale ? " — STALE, rendered from the old text" : " — up to date"),
    );
  }

  if (found.usedBy.length) {
    lines.push(`  used by     ${found.usedBy[0]}`);
    for (const entry of found.usedBy.slice(1)) lines.push(`              ${entry}`);
  } else {
    lines.push("  used by     nothing points at it — no meeting, no assessment, no resource");
  }

  if (found.publishedTo.length) {
    for (const entry of found.publishedTo) {
      lines.push(
        `  published   ${entry.where}, ${entry.at}${entry.behind ? " — BEHIND what is on disk" : ""}`,
      );
    }
  } else {
    lines.push("  published   nowhere yet");
  }

  lines.push("");
  lines.push("What follows:");
  for (const line of found.next) lines.push(`  ${line}`);
  return lines;
};
