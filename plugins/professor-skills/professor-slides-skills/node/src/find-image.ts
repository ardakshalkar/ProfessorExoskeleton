/**
 * Find an openly-licensed image for a slide, and record where it came from.
 *
 * Ported from `ProfessorHarness/node/bin/find-image.ts`. Two decisions are
 * built in and are the point of having this rather than a browser tab:
 *
 *   - **Only reusable licences.** The default filter is
 *     `commercial,modification` — a university lecture is a commercial context
 *     in most licence readings, and a slide crops and annotates. `anyLicence`
 *     widens it and prints what each result actually permits, but nothing here
 *     will pretend a NoDerivatives photograph is safe to annotate; picking one
 *     is refused at download rather than warned about.
 *   - **Attribution travels with the file or the file does not travel.** A pick
 *     writes the image *and* prints the `figures:` entry that records its
 *     source, licence and attribution line. `pres render` refuses to place an
 *     image whose plan entry claims a source without one, so a missed credit
 *     fails loudly here rather than quietly in a lecture theatre.
 *
 * What this cannot do is judge whether the picture is *true*. A photograph of a
 * server room illustrates; a plotted curve asserts. Search decorative and
 * illustrative images freely, and draw anything that makes a claim — see
 * `references/presentation-graphics.md`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface ImageResult {
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
}

const ENDPOINT = "https://api.openverse.org/v1/images/";
const AGENT = "pres-find-image/0.1";

/** What each licence code lets a lecture actually do. */
export const LICENCES: Record<string, string> = {
  cc0: "public domain dedication — no conditions",
  pdm: "public domain — no conditions",
  by: "credit the creator",
  "by-sa": "credit, and share adaptations under the same licence",
  "by-nc": "credit; non-commercial use only — check your institution's reading",
  "by-nd": "credit; NO derivatives — do not crop, annotate or overlay",
  "by-nc-sa": "credit, non-commercial, share alike",
  "by-nc-nd": "credit, non-commercial, NO derivatives",
};

/** A slide always crops, so these are refused rather than flagged. */
export const RESTRICTED = new Set(["by-nd", "by-nc-nd"]);

export function attributionLine(result: ImageResult): string {
  if (result.attribution) return result.attribution.replace(/\s+/g, " ").trim();
  const creator = result.creator ?? "unknown creator";
  const licence = `CC ${result.license.toUpperCase()} ${result.license_version}`.trim();
  return `"${result.title}" by ${creator}, ${licence} — ${result.foreign_landing_url}`;
}

export async function searchImages(
  query: string,
  limit = 8,
  anyLicence = false,
): Promise<ImageResult[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(Math.min(Math.max(limit, 1), 20)));
  if (!anyLicence) url.searchParams.set("license_type", "commercial,modification");
  const response = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!response.ok) throw new Error(`Openverse returned ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { results?: ImageResult[] };
  return payload.results ?? [];
}

export function describeResults(results: ImageResult[]): string {
  const lines: string[] = [];
  results.forEach((result, index) => {
    const code = result.license.toLowerCase();
    const meaning = LICENCES[code] ?? "licence terms unknown — read them before using this";
    const warn = RESTRICTED.has(code) ? "  [cannot be cropped or annotated]" : "";
    lines.push("");
    lines.push(`[${index + 1}] ${result.title}`);
    lines.push(`    ${result.width}x${result.height} · ${result.source} · CC ${code.toUpperCase()} ${result.license_version}`);
    lines.push(`    ${meaning}${warn}`);
    lines.push(`    ${result.foreign_landing_url}`);
    lines.push(`    credit: ${attributionLine(result)}`);
  });
  lines.push("");
  lines.push(
    `${results.length} result(s). Re-run with --pick N to download one, and read the licence ` +
    "line before you do — a picture on a slide is published the moment the class sees it.",
  );
  return lines.join("\n");
}

export async function downloadImage(
  result: ImageResult,
  options: { directory: string; name: string },
): Promise<string> {
  const code = result.license.toLowerCase();
  if (RESTRICTED.has(code)) {
    throw new Error(
      `that image is CC ${code.toUpperCase()} — no derivatives, so it cannot go on a slide that ` +
      "crops, scales or annotates it. Pick another.",
    );
  }
  const directory = resolve(options.directory);
  await mkdir(directory, { recursive: true });

  const response = await fetch(result.url, { headers: { "User-Agent": AGENT } });
  if (!response.ok) throw new Error(`downloading the image: ${response.status}`);
  const extension = (result.filetype ?? result.url.split(".").pop() ?? "jpg").replace(/\W/g, "");
  const file = join(directory, `${options.name}.${extension}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/**
 * The plan entry that keeps the credit attached to the bytes.
 *
 * Printed rather than written into the plan file: clobbering a plan someone is
 * editing is a poor trade for saving one paste.
 */
export function figureEntry(result: ImageResult, filename: string): string {
  return `figures:
  ${filename}:
    title: ${JSON.stringify(result.title)}
    alt: "TODO — say what a student who cannot see it would need to know"
    image_source:
      provider: openverse
      source_url: ${result.foreign_landing_url}
      license: CC-${result.license.toUpperCase()}-${result.license_version}
      attribution: ${JSON.stringify(attributionLine(result))}`;
}
