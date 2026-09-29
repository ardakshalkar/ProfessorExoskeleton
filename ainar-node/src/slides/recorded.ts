/**
 * What the course record knows about a deck, for the renderer.
 *
 * The slide engine reads a deck and the `.plan.yaml` beside it and nothing
 * else — it was written for a plugin with no course to read. Two things only
 * the record holds, and `render-deck` used both before it was merged away:
 *
 * - **figure credits on Document records.** `ainar find-image` registers a
 *   downloaded picture as a Document with `extensions.image_source`, which is
 *   the same shape as a plan's figure entry. A deck whose credit lives there
 *   and not in its plan would otherwise render the picture uncredited.
 * - **the Document's `presentation_plan`,** the contract that was approved.
 */

import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { type CourseBundle, documentById } from "../bundle.ts";
import type { DeckPlan, FigureRecord } from "./plan.ts";

export interface RecordedDeck {
  deckPath: string;
  documentId: string | null;
  recordPlan: DeckPlan | null;
  figures: Record<string, FigureRecord>;
}

const posix = (path: string): string => path.split(sep).join("/");

/**
 * Credits for every recorded picture inside the deck's folder, keyed by the
 * path a slide links it by.
 */
export function recordedFigures(bundle: CourseBundle, root: string, deckPath: string): Record<string, FigureRecord> {
  const deckDir = dirname(resolve(deckPath));
  const figures: Record<string, FigureRecord> = {};
  for (const [, document] of documentById(bundle) as Map<string, any>) {
    const key = String(document.storage_key ?? "");
    if (!key || key.includes("://")) continue;
    const extensions = document.extensions ?? {};
    if (!extensions.image_source && !extensions.image_prompt) continue;
    const rel = relative(deckDir, resolve(root, key));
    if (rel.startsWith("..") || /^[A-Za-z]:/.test(rel)) continue;
    figures[posix(rel)] = {
      ...(extensions.image_source ? { image_source: extensions.image_source } : {}),
      ...(extensions.image_prompt ? { image_prompt: extensions.image_prompt } : {}),
    } as FigureRecord;
  }
  return figures;
}

/**
 * A recorded Document, resolved to the deck it points at — or a refusal.
 *
 * The refusals are render-deck's, and each is a mistake that was made: a
 * Document whose `storage_key` is the built `.pptx` was once read as a megabyte
 * of text and "rendered" as one slide 724 inches tall.
 */
export function deckForDocument(bundle: CourseBundle, root: string, documentId: string): RecordedDeck {
  const document = documentById(bundle).get(documentId) as any;
  if (!document) throw new Error(`no document '${documentId}' in ${bundle.course.course_id}`);
  const storageKey: string = document.storage_key;
  if (storageKey.includes("://")) {
    throw new Error(`${documentId} lives in object storage (${storageKey}); there is no file here to render`);
  }
  // A document marked `approval: draft` renders like any other: it lives in the
  // course now, and what keeps a draft from students is its record, which
  // `publish` and the page both read, rather than which folder it sits in.
  if (!/\.(md|markdown)$/i.test(storageKey)) {
    throw new Error(
      `${documentId} points at ${storageKey}, which is not markdown.\n` +
        "This renders a deck FROM its markdown source; a document whose storage_key is the\n" +
        "built .pptx is the output of that. Name the markdown's document instead.",
    );
  }
  const deckPath = resolve(root, storageKey);
  if (!existsSync(deckPath)) throw new Error(`${storageKey} does not exist`);
  return {
    deckPath,
    documentId,
    recordPlan: (document.presentation_plan as DeckPlan | undefined) ?? null,
    figures: recordedFigures(bundle, root, deckPath),
  };
}

/**
 * The same, found from the file: the Document whose `storage_key` is this deck,
 * if the course records one. A deck the record does not mention still renders;
 * it simply has no second contract and no Document credits.
 */
export function recordFor(bundle: CourseBundle, root: string, deckPath: string): RecordedDeck {
  const key = posix(relative(root, resolve(deckPath)));
  for (const [id, document] of documentById(bundle) as Map<string, any>) {
    if (document.storage_key === key) {
      return {
        deckPath: resolve(deckPath),
        documentId: id,
        recordPlan: (document.presentation_plan as DeckPlan | undefined) ?? null,
        figures: recordedFigures(bundle, root, deckPath),
      };
    }
  }
  return { deckPath: resolve(deckPath), documentId: null, recordPlan: null, figures: recordedFigures(bundle, root, deckPath) };
}
