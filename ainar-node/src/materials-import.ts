/**
 * Registering a deck this course did not write, with what it appears to teach.
 *
 * The other half of `materials.ts`. That one RUNS a producer this course owns
 * and records what it made; this one READS a finished file somebody else made
 * and proposes what is in it. Both end the same way — one draft, validated
 * against the `Document` schema before it is written, promoted by
 * `ainar approve` and by nothing else.
 *
 * Separate module because the failure modes have nothing in common. A build
 * fails when a script errors or a slide overflows the page. An import is never
 * wrong in that sense: it is approximate by construction, and the interesting
 * question is which parts of it are a reading and which are a guess. Those are
 * marked rather than smoothed over — see `importMaterial`.
 *
 * The safety property is not in this file and is worth naming anyway: concepts
 * are matched against the course's OWN set, so an import cannot introduce one.
 * `validate.ts` makes an unknown concept on a document an error, and `approve`
 * writes nothing when validation fails. A reader that invented a plausible
 * concept would be stopped at the gate rather than believed.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { documentRecord } from "./materials.ts";
import { dump } from "./yaml-out.ts";

/** What `ainar approve` strips from an identifier when it promotes it. */
export const DRAFT_MARKER = "-DRAFT-";

/** One slide, as read out of a `.pptx`. */
type ReadSlide = { readonly number: number; readonly runs: string[]; readonly notes: string };

/**
 * The text of each slide, and its speaker notes.
 *
 * A `.pptx` is a zip of XML: `<a:t>` holds every text run in document order,
 * and `ppt/notesSlides/notesSlideN.xml` holds slide N's notes when it has any.
 * Both come back raw. Deciding which run is a title is the caller's problem and
 * an approximate one, and resolving it here would bury the guess where nobody
 * reading the output could see it.
 */
export const readSlides = (pptx: string): ReadSlide[] => {
  const members = (() => {
    try {
      return execFileSync("unzip", ["-Z1", pptx], { encoding: "utf-8" })
        .split("\n")
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
    } catch {
      return [];
    }
  })();

  const textOf = (member: string): string[] => {
    try {
      const xml = execFileSync("unzip", ["-p", pptx, member], { encoding: "utf-8" });
      return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((match) =>
          (match[1] ?? "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  return members.map((member, index) => {
    const number = index + 1;
    return {
      number,
      runs: textOf(member),
      notes: textOf(`ppt/notesSlides/notesSlide${number}.xml`)
        // The slide number is a run of its own on the notes master. A bare
        // number is not a note, and keeping it would give every slide one.
        .filter((text) => !/^\d+$/.test(text))
        .join(" ")
        .trim(),
    };
  });
};

/**
 * Which of this course's concepts a piece of text appears to carry.
 *
 * A CLOSED vocabulary — every concept's title and aliases — matched against the
 * words on the slide. It cannot propose a concept the course does not already
 * have, and that is the property that makes importing safe to automate: the
 * worst case is a concept matched where it should not have been, which a
 * professor can see and strike, rather than a concept invented, which reads as
 * authoritative and is not.
 *
 * Whole words only. Without the boundaries, "attention" matches "attentional",
 * and a short alias matches inside half the deck.
 */
export const conceptsIn = (text: string, vocabulary: Map<string, string[]>): string[] => {
  const flatten = (value: string): string =>
    " " + value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim() + " ";
  const haystack = flatten(text);
  const found: string[] = [];
  for (const [conceptId, terms] of vocabulary) {
    for (const term of terms) {
      const needle = flatten(term);
      if (needle.trim().length > 2 && haystack.includes(needle)) {
        found.push(conceptId);
        break;
      }
    }
  }
  return found;
};

export type ImportOptions = {
  readonly root: string;
  readonly courseVersionId: string;
  readonly file: string;
  readonly documentId: string;
  readonly title: string | null;
  readonly moduleId: string | null;
  readonly vocabulary: Map<string, string[]>;
  readonly draftsDir: string;
  readonly dryRun: boolean;
};

export type ImportReport = { readonly lines: string[]; readonly draft: string | null };

/**
 * Read a finished deck and propose a record for it.
 *
 * The output is a PROPOSAL and says so twice: the identifier carries the draft
 * marker, and the record carries `origin: imported` with `read_by: text`. A
 * professor looking at an outline that seems wrong can then tell it was
 * obtained mechanically rather than written — a different kind of wrong, which
 * wants a different response.
 *
 * What is approximate, said here rather than discovered later:
 *
 * - **Each slide's title is the first line of text on it.** For a deck with a
 *   title placeholder that is exactly right; for one that opens with a banner
 *   or a running header, the banner is what you get. There is no better answer
 *   from text alone, and the alternative — a rule tuned to one deck's chrome —
 *   is how a harness becomes quietly wrong for every other course. This project
 *   already made that mistake once, reading a title out of a shape that turned
 *   out to be a decorative rectangle, and got sixteen empty strings.
 * - **`type` stays `unclassified`.** The archetypes a plan uses — roadmap,
 *   question, annotated object — are claims about teaching intent, and a text
 *   scan cannot make one. A vision pass can; that is the next step and not this
 *   one. An honest blank beats a plausible label nobody checked.
 */
export const importMaterial = (options: ImportOptions): ImportReport => {
  const file = resolve(options.file);
  if (!existsSync(file)) throw new Error(`${options.file} does not exist`);
  if (!/\.pptx$/i.test(file)) {
    throw new Error(
      `${basename(file)} is not a .pptx. This reads slide text out of a PowerPoint ` +
        "package; a PDF carries its text a different way and needs a different reader.",
    );
  }

  const slides = readSlides(file);
  if (slides.length === 0) {
    throw new Error(
      `${basename(file)} has no slides this reader can see. A deck saved as images ` +
        "carries no text runs at all, and wants the vision pass rather than this one.",
    );
  }

  // Running chrome: text that appears on nearly every slide.
  //
  // A banner, a week strip, a footer. It is first in document order on each
  // slide, so "the first run" would make every title read "DRAFT · NOT
  // APPROVED" — which is what the first version of this did to a real deck.
  //
  // The rule is structural rather than template-specific, and that is the whole
  // point: text repeated across a deck is chrome by definition, whatever the
  // deck. A title is what distinguishes one slide from the next, so anything
  // that does not distinguish is not one. The threshold sits below 1.0 because
  // a banner is often dropped on the cover slide.
  const appearances = new Map<string, number>();
  for (const slide of slides) {
    for (const run of new Set(slide.runs)) {
      appearances.set(run, (appearances.get(run) ?? 0) + 1);
    }
  }
  const chrome = new Set(
    [...appearances]
      .filter(([, count]) => slides.length >= 4 && count >= slides.length * 0.8)
      .map(([run]) => run),
  );

  const titleOf = (slide: ReadSlide): string => {
    // A pure number is a page marker, not a title.
    const candidate = slide.runs.find((run) => !chrome.has(run) && !/^\d+$/.test(run));
    return candidate ?? slide.runs[0] ?? `Slide ${slide.number}`;
  };

  const spec = slides.map((slide) => ({
    number: slide.number,
    type: "unclassified",
    title: titleOf(slide),
    // The notes are part of the reading. A slide whose picture carries the idea
    // often names it only in what the lecturer was going to say out loud.
    concepts: conceptsIn([...slide.runs, slide.notes].join(" "), options.vocabulary),
    outcomes: [] as string[],
  }));

  const union = [...new Set(spec.flatMap((slide) => slide.concepts))];
  const withNotes = slides.filter((slide) => slide.notes !== "").length;
  const silent = spec.filter((slide) => slide.concepts.length === 0).length;

  const lines = [
    `  ${basename(file)}: ${slides.length} slides, ${withNotes} with speaker notes`,
    `  concepts proposed: ${union.length === 0 ? "none" : union.join(", ")}`,
  ];
  if (silent > 0) {
    lines.push(
      `  ${silent} slide(s) matched nothing — a text scan finds what is NAMED, and a ` +
        "slide that shows rather than names carries nothing it can see",
    );
  }

  if (options.dryRun) return { lines, draft: null };

  const bytes = readFileSync(file);
  const draftId = options.documentId.includes(DRAFT_MARKER)
    ? options.documentId
    : options.documentId.replace(/^DOC-/, `DOC${DRAFT_MARKER}`);

  const fields = documentRecord({
    document_id: draftId,
    title: options.title ?? basename(file, ".pptx"),
    storage_key: relative(options.root, file).split(sep).join("/"),
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    original_filename: basename(file),
    size_bytes: bytes.length,
    checksum: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
    course_version_id: options.courseVersionId,
    module_id: options.moduleId ?? null,
    concepts: union,
    version: 1,
    presentation_plan: {
      audience: `students of ${options.courseVersionId}`,
      // Not a judgement about how the deck teaches — a statement about how this
      // record was obtained, so the plan cannot be mistaken for an authored one.
      style: "imported; outline read from slide text",
      outcomes: [],
      concepts: union,
      slides: spec,
    },
    extensions: { origin: "imported", read_by: "text" },
  });

  mkdirSync(options.draftsDir, { recursive: true });
  const draft = join(options.draftsDir, `documents-imported-${draftId}.yaml`);
  writeFileSync(
    draft,
    "# Written by `ainar materials import`. The outline and the concepts were READ\n" +
      "# from the file, not authored: each title is that slide's first line of text\n" +
      "# and every `type` is unclassified. Review before approving.\n\n" +
      dump({ documents: [fields] }),
    "utf-8",
  );
  return { lines, draft };
};
