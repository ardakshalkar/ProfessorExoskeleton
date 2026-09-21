/**
 * Producing a material and registering it, as one act.
 *
 * The problem this exists to end: in a real course the two drifted apart. Seven
 * decks were built by seven hand-written Python scripts; the PDFs beside them
 * were converted once, by a person, by something that left no trace; and the
 * `Document` records were written by an eighth script that formatted YAML as
 * strings and knew nothing of the schema. That last one is not a style
 * complaint — it is how `source_url`, a field `Document` does not define, got
 * into a record and made the loader drop it silently. Thirty-nine documents in
 * the file, thirty-eight in the model, for a month.
 *
 * So: one command runs the producer, converts what needs converting, reads the
 * result to describe it, and writes ONE draft through the same schema and the
 * same emitter `ainar approve` uses. Nothing here writes to `courses/`.
 * Approval stays the only way in, and this narrows what reaches it to records
 * that were valid before they were written.
 *
 * **The runner orchestrates; it does not author.** The producers stay whatever
 * they are — today Python and python-pptx, tomorrow possibly a Marp deck
 * through `pres`. `materials.yaml` in the course names them, because the
 * mechanism belongs to the exoskeleton and the list of decks belongs to the
 * course; guessing which script builds which file from their names is the same
 * stem-matching convention that `extensions.rendered_from` exists to replace.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { z } from "zod";
import { Document } from "./model/content.ts";
import { dump } from "./yaml-out.ts";

/** Where a course declares what produces what. */
export const MANIFEST = "materials.yaml";

/**
 * One producer, as the course declares it.
 *
 * `run` is resolved against the manifest's own directory and may not climb out
 * of it: a manifest is a list of this course's build scripts, and a `run` of
 * `../../../something.py` would make it a way to execute an arbitrary file on
 * the professor's machine through a file an agent may write.
 */
const Producer = z
  .object({
    id: z.string().min(1),
    // Exactly one of `run` and `render`, checked below rather than in the type:
    // a producer is either a script this course wrote or a markdown deck the
    // project's own renderer turns into slides, and "neither" and "both" are
    // both a manifest saying something it does not mean.
    run: z.string().min(1).nullish(),
    render: z.string().min(1).nullish(),
    produces: z.string().min(1),
    title: z.string().min(1),
    document_id: z.string().min(1),
    source_document_id: z.string().min(1).nullish(),
    module_id: z.string().nullish(),
    concepts: z.array(z.string()).default([]),
    pdf: z.boolean().default(false),
    pdf_document_id: z.string().nullish(),
    pdf_title: z.string().nullish(),
  })
  .strict()
  .refine((p) => (p.run === null || p.run === undefined) !== (p.render === null || p.render === undefined), {
    message: "a producer declares exactly one of `run` (a script) or `render` (a markdown deck)",
  });

const Manifest = z.object({ producers: z.array(Producer).default([]) }).strict();

/**
 * The project's own markdown-to-slides renderer.
 *
 * `pres render` turns an approved Marp deck into a `.pptx` of real editable
 * shapes with speaker notes, and a PDF from that same deck — and refuses first
 * if a slide overflows the page, if the plan no longer matches the markdown, or
 * if a figure needs an attribution it does not have. Those refusals are the
 * reason to prefer it over a hand-written builder: a slide that runs past the
 * bottom margin is invisible in the source and obvious in the room.
 *
 * Found by layout, because it is a sibling plugin rather than a dependency —
 * `ainar-node` does not import it, and should not. `PRES_BIN` overrides for a
 * checkout arranged differently, and a miss is reported as itself rather than
 * as a producer that failed.
 */
const presAt = (): string | null => {
  const named = process.env.PRES_BIN;
  const candidates = [
    named ?? "",
    resolve(
      import.meta.dirname,
      "../../plugins/professor-skills/professor-slides-skills/node/bin/pres.mjs",
    ),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not here; try the next
    }
  }
  return null;
};

export type Producer = z.infer<typeof Producer>;

/** A path that stays inside its directory, or an error naming why not. */
const inside = (dir: string, candidate: string): string => {
  const full = resolve(dir, candidate);
  const rel = relative(dir, full);
  if (rel === "" || rel.startsWith("..") || /^[A-Za-z]:/.test(rel)) {
    throw new Error(
      `${candidate} resolves outside ${dir}. A producer is a script in this course's ` +
        "materials directory, and a path that climbs out is how a manifest becomes a " +
        "way to run anything on this machine.",
    );
  }
  return full;
};

/**
 * LibreOffice, by known location when it is not on PATH.
 *
 * Windows installs it where this looks and does not add it to PATH, so probing
 * `soffice` alone reports "no converter" on a machine that has one. A miss is
 * reported and the build continues without the PDF: a deck that built is worth
 * having, and refusing the whole run over a format nobody asked for would be
 * the tool deciding the professor's priorities.
 *
 * Exported because `dsh-professor-pane` asks the same question for a different
 * reason — whether it may offer to open a `.pptx` in the overlay, which it can
 * only do by converting one first. Two probes with two lists of install paths
 * would disagree about whether this machine has a converter, and the pane would
 * offer a control that then failed.
 */
export const officeAt = (): string | null => {
  const candidates = [
    process.env.SOFFICE ?? "",
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not here; try the next
    }
  }
  return null;
};

/**
 * How many slides a `.pptx` has. Counted, not guessed.
 *
 * **Deliberately not their titles.** The first version of this read the title
 * out of each slide's first shape, which for these decks is a decorative
 * rectangle with no text at all; the titles came back as sixteen empty strings.
 * Getting them right would mean a rule like "the first run that is not
 * all-caps and not a number" — true of this course's chrome, where a slide
 * opens with a DRAFT banner, a capitalised week strip and a page number, and
 * true of nothing else. That is a convention about one professor's deck
 * template, and encoding it here would make the harness quietly wrong for the
 * next course while looking right for this one.
 *
 * `presentation_plan` therefore stays unwritten by this command. The honest
 * place for it is the producer, which knows its own titles because it wrote
 * them: a sidecar it emits beside the artefact would be a declared contract
 * rather than a parser's guess. That is the next thing to build here, and it is
 * better absent than filled with sixteen empty strings.
 */
export const slideCount = (pptx: string): number => {
  // A producer may make something that is not a deck — a handout, a dataset, a
  // notes file — and `unzip -Z1` on one prints a paragraph about not finding a
  // central directory, on a channel this does not control, before returning
  // the zero it would have returned anyway. The extension is the cheap check
  // that keeps that noise out of a build report where it reads as a failure.
  if (!/\.pptx$/i.test(pptx)) return 0;
  try {
    return execFileSync("unzip", ["-Z1", pptx], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
  } catch {
    return 0;
  }
};

/** One document record, valid before it is written or not written at all. */
export const documentRecord = (fields: Record<string, unknown>): Record<string, unknown> => {
  const parsed = Document.safeParse(fields);
  if (!parsed.success) {
    const where = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(record)"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `${fields.document_id} is not a valid Document and was not written — ${where}. ` +
        "This is the check that a hand-written YAML emitter does not have.",
    );
  }
  return fields;
};

/**
 * The producers a course declares, or null when it declares none.
 *
 * Null rather than an empty list, and rather than a throw: a course with no
 * manifest is the ordinary case for one whose decks were written by hand, and
 * the caller's answer to "which producer rebuilds this" is then *none of them*
 * rather than "the manifest is broken".
 */
export const readProducers = (materialsDir: string): Producer[] | null => {
  const manifestPath = join(materialsDir, MANIFEST);
  if (!existsSync(manifestPath)) return null;
  return Manifest.parse(parse(readFileSync(manifestPath, "utf-8"))).producers;
};

/**
 * Which producer makes a given document, if the course declares one.
 *
 * The lookup a rebuild needs and the one `buildMaterials` cannot do for
 * itself: freshness knows `DOC-4499` is a picture of old text, the manifest is
 * keyed by producer id, and nothing joined the two. Both halves of a producer
 * are matched — a deck and the PDF beside it are one producer, and it is the
 * PDF that usually goes stale.
 */
export const producerFor = (producers: Producer[], documentId: string): Producer | null =>
  producers.find(
    (producer) =>
      producer.document_id === documentId ||
      (producer.pdf_document_id ?? `${producer.document_id}-PDF`) === documentId,
  ) ?? null;

export type BuildOptions = {
  readonly root: string;
  readonly courseVersionId: string;
  readonly materialsDir: string;
  readonly only: string | null;
  readonly pdf: boolean;
  readonly dryRun: boolean;
  readonly draftsDir: string;
};

export type BuildReport = {
  readonly lines: string[];
  readonly draft: string | null;
  readonly failed: number;
};

/**
 * Run the producers a course declares, and write one draft for what they made.
 *
 * Failures are per producer and do not stop the rest: a course with one broken
 * build script should still get the other six decks and a draft naming them.
 * The count comes back so the caller can exit non-zero without this function
 * deciding to end the process.
 */
export const buildMaterials = (options: BuildOptions): BuildReport => {
  const manifestPath = join(options.materialsDir, MANIFEST);
  if (!existsSync(manifestPath)) {
    throw new Error(
      `no ${MANIFEST} in ${options.materialsDir}. It declares what produces what; ` +
        "without it this command would have to guess a producer from a filename.",
    );
  }
  const manifest = Manifest.parse(parse(readFileSync(manifestPath, "utf-8")));
  const wanted = options.only
    ? manifest.producers.filter((p) => p.id === options.only)
    : manifest.producers;
  if (wanted.length === 0) {
    throw new Error(
      options.only
        ? `${MANIFEST} declares no producer '${options.only}'`
        : `${MANIFEST} declares no producers`,
    );
  }

  const office = options.pdf ? officeAt() : null;
  const lines: string[] = [];
  const documents: Record<string, unknown>[] = [];
  let failed = 0;

  if (options.pdf && office === null) {
    lines.push(
      "  no LibreOffice found (looked on PATH and the usual install paths); " +
        "building decks without PDFs. Set SOFFICE to override.",
    );
  }

  for (const producer of wanted) {
    const from = producer.run ?? producer.render!;
    const source = inside(options.materialsDir, from);
    const artefact = inside(options.materialsDir, producer.produces);
    if (!existsSync(source)) {
      lines.push(`  ${producer.id}: ${from} is missing — skipped`);
      failed += 1;
      continue;
    }

    if (options.dryRun) {
      lines.push(
        `  ${producer.id}: would ${producer.render ? "render" : "run"} ${from}`,
      );
      continue;
    }

    if (producer.render) {
      // The renderer writes its own PDF from the same deck, so the LibreOffice
      // step below is skipped for these: converting the .pptx a second time
      // would produce a PDF of a deck rather than the deck's own.
      const pres = presAt();
      if (pres === null) {
        lines.push(
          `  ${producer.id}: no slide renderer found. Expected the ` +
            "professor-slides-skills plugin beside this checkout, or PRES_BIN set.",
        );
        failed += 1;
        continue;
      }
      // `spawnSync`, not `execFileSync`, for one reason that cost a run to
      // notice: the renderer's GATES print to stderr, and on a SUCCESSFUL
      // `execFileSync` stderr is not returned at all. The deck built, the
      // overflow warnings vanished, and the output looked clean while four
      // slides ran past the bottom of the page. Both streams are read here,
      // whichever way it ends, because the warnings are the reason to use this
      // renderer rather than a hand-written builder.
      const ran = spawnSync(
        process.execPath,
        [pres, "render", source, "--pdf", "--out", dirname(artefact)],
        { encoding: "utf-8" },
      );
      const said = `${ran.stdout ?? ""}\n${ran.stderr ?? ""}`;
      for (const line of said.split("\n")) {
        const text = line.trim();
        // "wrote <path>" is this command's own report to make, below, with the
        // size and the slide count. Everything else the renderer says is a
        // judgement about the deck and is carried through verbatim.
        if (text && !text.startsWith("wrote ")) lines.push(`    ${text}`);
      }
      if (ran.status !== 0) {
        lines.push(`  ${producer.id}: render refused ${from}`);
        failed += 1;
        continue;
      }
    } else {
      try {
        execFileSync("python", [source], { cwd: options.materialsDir, stdio: "pipe" });
      } catch (error) {
        const detail = (error as { stderr?: Buffer }).stderr?.toString().trim().split("\n").pop();
        lines.push(`  ${producer.id}: ${from} failed — ${detail ?? "no output"}`);
        failed += 1;
        continue;
      }
    }

    if (!existsSync(artefact)) {
      lines.push(`  ${producer.id}: ${from} ran but did not write ${producer.produces}`);
      failed += 1;
      continue;
    }

    const bytes = readFileSync(artefact);
    const slides = slideCount(artefact);
    lines.push(
      `  ${producer.id}: ${basename(artefact)} (${bytes.length} bytes, ${slides} slides)`,
    );

    documents.push(
      documentRecord({
        document_id: producer.document_id,
        title: producer.title,
        storage_key: relative(options.root, artefact).split(sep).join("/"),
        mime_type:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        original_filename: basename(artefact),
        size_bytes: bytes.length,
        checksum: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
        course_version_id: options.courseVersionId,
        module_id: producer.module_id ?? null,
        concepts: producer.concepts,
        version: 1,
        extensions: {
          // Where this came from, said rather than implied.
          //
          // A course may legitimately hold two decks for one week — one built
          // here and one brought in finished — and the fault in the case that
          // prompted this was never the count. It was that neither said what it
          // was, so no reader and no surface could tell them apart. `origin` is
          // what the pane badges; an artefact without one should look
          // unfinished rather than normal.
          origin: "generated",
          // The edge, written by the thing that made the file rather than
          // reconstructed later by reading seven scripts to find out.
          rendered_from: producer.source_document_id ?? null,
          slides,
        },
      }),
    );

    // A rendered deck already has its PDF, from the renderer and from the same
    // markdown. Converting the .pptx again would make a PDF of a rendering.
    if (producer.render) {
      const own = artefact.replace(/\.pptx$/i, ".pdf");
      if (existsSync(own)) {
        const ownBytes = readFileSync(own);
        lines.push(`  ${producer.id}: ${basename(own)} (${ownBytes.length} bytes, from the deck)`);
        documents.push(
          documentRecord({
            document_id: producer.pdf_document_id ?? `${producer.document_id}-PDF`,
            title: producer.pdf_title ?? `${producer.title} (PDF)`,
            storage_key: relative(options.root, own).split(sep).join("/"),
            mime_type: "application/pdf",
            original_filename: basename(own),
            size_bytes: ownBytes.length,
            checksum: "sha256:" + createHash("sha256").update(ownBytes).digest("hex"),
            course_version_id: options.courseVersionId,
            module_id: producer.module_id ?? null,
            concepts: producer.concepts,
            version: 1,
            extensions: { origin: "generated", rendered_from: producer.document_id },
          }),
        );
      }
      continue;
    }
    if (!producer.pdf || office === null) continue;
    const pdf = artefact.replace(/\.pptx$/i, ".pdf");
    try {
      execFileSync(
        office,
        ["--headless", "--convert-to", "pdf", "--outdir", dirname(artefact), artefact],
        { stdio: "pipe" },
      );
    } catch (error) {
      lines.push(`  ${producer.id}: PDF conversion failed — ${String(error).split("\n")[0]}`);
      failed += 1;
      continue;
    }
    if (!existsSync(pdf)) {
      lines.push(`  ${producer.id}: PDF conversion produced nothing`);
      failed += 1;
      continue;
    }
    const pdfBytes = readFileSync(pdf);
    lines.push(`  ${producer.id}: ${basename(pdf)} (${pdfBytes.length} bytes)`);
    documents.push(
      documentRecord({
        document_id: producer.pdf_document_id ?? `${producer.document_id}-PDF`,
        title: producer.pdf_title ?? `${producer.title} (PDF)`,
        storage_key: relative(options.root, pdf).split(sep).join("/"),
        mime_type: "application/pdf",
        original_filename: basename(pdf),
        size_bytes: pdfBytes.length,
        checksum: "sha256:" + createHash("sha256").update(pdfBytes).digest("hex"),
        course_version_id: options.courseVersionId,
        module_id: producer.module_id ?? null,
        // A PDF teaches what its deck teaches. Carried rather than left empty,
        // which is the state seven of these were registered in.
        concepts: producer.concepts,
        version: 1,
        extensions: { origin: "generated", rendered_from: producer.document_id },
      }),
    );
  }

  if (options.dryRun || documents.length === 0) {
    return { lines, draft: null, failed };
  }

  // One draft for the whole run, through the emitter `ainar approve` writes
  // with — so a draft and the record it becomes are formatted by one function.
  mkdirSync(options.draftsDir, { recursive: true });
  const draft = join(options.draftsDir, "documents-materials.yaml");
  writeFileSync(
    draft,
    "# Written by `ainar materials build`. Every entry was produced by a script\n" +
      "# this course declares, validated against the Document schema before it was\n" +
      "# written, and is a proposal until `ainar approve` promotes it.\n\n" +
      dump({ documents }),
    "utf-8",
  );
  return { lines, draft, failed };
};
