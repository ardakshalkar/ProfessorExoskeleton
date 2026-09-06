#!/usr/bin/env node

/**
 * Find an openly-licensed image for a slide, and record where it came from.
 *
 *     node --experimental-strip-types bin/find-image.ts --search "confusion matrix"
 *     node --experimental-strip-types bin/find-image.ts --search "confusion matrix" \
 *       --pick 2 --course-version CSS-4008-2026-FALL --name MODULE-06-slides-fig-02-matrix
 *
 * Searches Openverse, which indexes Creative Commons and public-domain works
 * across Flickr, Wikimedia and others. Two decisions are built in and are the
 * point of having this rather than a browser tab:
 *
 *   - **Only reusable licences.** The default filter is `commercial,modification`
 *     — a university lecture is a commercial context in most licence readings,
 *     and a slide crops and annotates. `--any-licence` widens it and prints what
 *     each result actually permits, but nothing here will pretend a NoDerivatives
 *     photograph is safe to annotate.
 *   - **Attribution travels with the file or the file does not travel.** `--pick`
 *     writes the image *and* prints the `Document` draft that records its source,
 *     licence and the attribution line. `render-deck` refuses to place an image
 *     whose document claims a source without one, so a missed credit fails loudly
 *     here rather than quietly in a lecture theatre.
 *
 * The download goes to `work/<COURSE_VERSION_ID>/materials/`, never to
 * `courses/` — a found image is a proposal like anything else, and approval is
 * what moves it. Nothing is written into any draft file: the YAML is printed for
 * a person to paste, because clobbering a draft someone is editing is a poor
 * trade for saving one copy.
 *
 * What this tool cannot do is judge whether the picture is *true*. A photograph
 * of a server room illustrates; a plotted curve asserts. Search decorative and
 * illustrative images freely, and draw anything that makes a claim — see
 * `references/presentation-graphics.md`.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

type Result = {
  id: string;
  title: string;
  creator: string | null;
  creator_url: string | null;
  url: string;
  foreign_landing_url: string;
  license: string;
  license_version: string;
  license_url: string | null;
  source: string;
  width: number;
  height: number;
  attribution: string | null;
  filetype: string | null;
};

const ENDPOINT = "https://api.openverse.org/v1/images/";

/** What each licence code lets a lecture actually do. */
const LICENCES: Record<string, string> = {
  cc0: "public domain dedication — no conditions",
  pdm: "public domain — no conditions",
  by: "credit the creator",
  "by-sa": "credit, and share adaptations under the same licence",
  "by-nc": "credit; non-commercial use only — check your institution's reading",
  "by-nd": "credit; NO derivatives — do not crop, annotate or overlay",
  "by-nc-sa": "credit, non-commercial, share alike",
  "by-nc-nd": "credit, non-commercial, NO derivatives",
};

const RESTRICTED = new Set(["by-nd", "by-nc-nd"]);

function attributionLine(result: Result): string {
  if (result.attribution) return result.attribution.replace(/\s+/g, " ").trim();
  const creator = result.creator ?? "unknown creator";
  const licence = `CC ${result.license.toUpperCase()} ${result.license_version}`.trim();
  return `"${result.title}" by ${creator}, ${licence} — ${result.foreign_landing_url}`;
}

async function search(query: string, limit: number, anyLicence: boolean): Promise<Result[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(Math.min(limit, 20)));
  if (!anyLicence) url.searchParams.set("license_type", "commercial,modification");
  const response = await fetch(url, { headers: { "User-Agent": "ainar-find-image/0.1" } });
  if (!response.ok) {
    throw new Error(`Openverse returned ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { results?: Result[] };
  return payload.results ?? [];
}

function report(results: Result[]): void {
  results.forEach((result, index) => {
    const code = result.license.toLowerCase();
    const meaning = LICENCES[code] ?? "licence terms unknown — read them before using this";
    const warn = RESTRICTED.has(code) ? "  ⚠ cannot be cropped or annotated" : "";
    console.log(`\n[${index + 1}] ${result.title}`);
    console.log(`    ${result.width}×${result.height} · ${result.source} · CC ${code.toUpperCase()} ${result.license_version}`);
    console.log(`    ${meaning}${warn}`);
    console.log(`    ${result.foreign_landing_url}`);
    console.log(`    credit: ${attributionLine(result)}`);
  });
  console.log(
    `\n${results.length} result(s). Re-run with --pick N to download one, and read the licence` +
    "\ncolumn before you do — a picture on a slide is published the moment the class sees it.",
  );
}

async function download(
  result: Result,
  options: { root: string; courseVersionId: string; name: string; into?: string },
): Promise<string> {
  const code = result.license.toLowerCase();
  if (RESTRICTED.has(code)) {
    throw new Error(
      `that image is CC ${code.toUpperCase()} — no derivatives, so it cannot go on a slide that ` +
      "crops, scales or annotates it. Pick another.",
    );
  }
  const directory =
    options.into ?? join(options.root, "work", options.courseVersionId, "materials");
  if (resolve(directory).startsWith(resolve(options.root, "courses"))) {
    throw new Error("refusing to download into courses/ — a found image is a draft");
  }
  await mkdir(directory, { recursive: true });

  const response = await fetch(result.url, { headers: { "User-Agent": "ainar-find-image/0.1" } });
  if (!response.ok) throw new Error(`downloading the image: ${response.status}`);
  const extension = (result.filetype ?? result.url.split(".").pop() ?? "jpg").replace(/\W/g, "");
  const file = join(directory, `${options.name}.${extension}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/** The record that keeps the credit attached to the bytes. */
function documentDraft(
  result: Result,
  file: string,
  options: { root: string; courseVersionId: string; name: string },
): string {
  const relative = file.replace(`${options.root}\\`, "").replace(`${options.root}/`, "").replace(/\\/g, "/");
  const extension = relative.split(".").pop() ?? "jpg";
  const mime = extension === "svg" ? "image/svg+xml" : extension === "png" ? "image/png" : "image/jpeg";
  return `documents:
  - document_id: DOC-DRAFT-XXXX
    title: ${JSON.stringify(result.title)}
    storage_key: ${relative}
    mime_type: ${mime}
    course_version_id: ${options.courseVersionId}
    module_id: TODO
    concepts: [TODO]
    extensions:
      image_source:
        provider: openverse
        source_url: ${result.foreign_landing_url}
        license: CC-${result.license.toUpperCase()}-${result.license_version}
        attribution: ${JSON.stringify(attributionLine(result))}`;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const USAGE = `find-image — an openly-licensed picture, with its credit attached

  --search QUERY           what to look for (required)
  --limit N                how many results (default 8, max 20)
  --any-licence            include non-commercial and no-derivatives results
  --pick N                 download result N as a draft
  --course-version RUN     the run it is for (required with --pick)
  --name STEM              the filename stem, e.g. MODULE-06-slides-fig-02-matrix
  --into DIR               override the download directory
  --root DIR               the workspace (default: the current directory)

Downloads land in work/<RUN>/materials/. The Document draft is printed, not
written — paste it into documents-draft.yaml so nothing you are editing is lost.`;

async function main(): Promise<void> {
  const query = flag("search");
  if (has("help") || !query) {
    console.log(USAGE);
    process.exit(has("help") ? 0 : 1);
  }

  const results = await search(query, Number(flag("limit") ?? 8), has("any-licence"));
  if (!results.length) {
    console.log(`nothing for "${query}". Try fewer words, or draw it instead.`);
    return;
  }

  const pick = flag("pick");
  if (!pick) {
    report(results);
    return;
  }

  const chosen = results[Number(pick) - 1];
  if (!chosen) throw new Error(`--pick ${pick} but there are ${results.length} results`);

  const courseVersionId = flag("course-version");
  if (!courseVersionId) throw new Error("--pick needs --course-version, to know whose draft this is");
  const root = resolve(flag("root") ?? process.cwd());
  const name = flag("name") ?? `figure-${chosen.id.slice(0, 8)}`;

  const file = await download(chosen, { root, courseVersionId, name, into: flag("into") });
  console.log(`wrote ${file}`);
  console.log(`\nRegister it — the credit is part of the record, not a note to self:\n`);
  console.log(documentDraft(chosen, file, { root, courseVersionId, name }));
  console.log(
    `\nOn the slide, link it as a sibling of the deck:\n\n` +
    `    ![DESCRIBE WHAT IT SHOWS](${name}.${file.split(".").pop()})\n\n` +
    "The alt text is not the title. Say what a student who cannot see it would need.",
  );
}

main().catch((error) => {
  console.error(String((error as Error).message ?? error));
  process.exitCode = 1;
});
