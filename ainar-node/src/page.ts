/**
 * The course outline as a small site, for hosting where students can read it.
 * Ported from `ainar/commands/page.py`.
 *
 * There are two visualisation surfaces in this workspace and they are opposites.
 * `ainar dashboard` draws marks by pseudonym and is for the professor; **this**
 * one draws the plan — weeks, modules, meetings with their dates and rooms,
 * assessments with their declared weights, and the materials students are meant
 * to have — and is the only output here written for a public URL. Keeping them
 * apart is the whole design: the tests assert the private figures cannot appear
 * on this page.
 *
 * **It is the widget, not a second renderer.** `ainar/mcp/widget-assets/` holds
 * one copy of the view, `bin/prerender-widget.mjs` executes it against the
 * payload and hands back finished markup, and so what a professor hosts and what
 * a model draws beside its own answer cannot become two different renderings of
 * one course.
 *
 * **Material files are copied, never transformed, and never without the scan.**
 * `safety.ts` is the refusal that has no override, and it is reused here rather
 * than reimplemented: publishing a brief to Notion and publishing one to a static
 * site are the same act.
 *
 * Only files this repository actually holds are published. A `storage_key` with a
 * scheme means the application owns the bytes and there is nothing here to copy;
 * a key under `work/` is a proposal, and a proposal published looks exactly like
 * an approved handout. Anything that cannot be read as text is held back rather
 * than published unscanned, and said so in the report.
 *
 * ## What the port changed
 *
 * Python shelled out to `node bin/prerender-widget.mjs` and treated "Node is not
 * on PATH" as a reported condition, with `--static` there to turn it into an
 * error. That whole branch is gone: this *is* Node, so the prerenderer is
 * imported and run in process. A page that needs JavaScript is no longer a thing
 * that can happen by accident, which is why `--static` is accepted and ignored
 * rather than removed — a skill still passing it should not fail.
 */

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { type CourseBundle } from "./bundle.ts";
import { BY_TOOL, stylesheet } from "./tools/widgets.ts";
import { refusal, scan } from "./safety.ts";

/**
 * Where published material lands, relative to the site root. The same directory
 * name approval uses inside a course, so a link written between two materials
 * resolves the same in both places.
 */
export const MATERIALS = "materials";

/**
 * Wrapper around the widget's own style sheet: the ground the page is painted
 * on, and the width it is read at. In a chat client the host decides both; on a
 * page there is nobody else to.
 */
const PAGE_CSS = `:root { color-scheme: light dark; }
body {
  margin: 0;
  padding: 24px 16px 48px;
  background: #fff;
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
#root { max-width: 1080px; margin: 0 auto; }
footer {
  max-width: 1080px;
  margin: 32px auto 0;
  padding-top: 12px;
  border-top: 1px solid #e5e5e5;
  color: #6b6b6b;
  font-size: 12px;
}
@media (prefers-color-scheme: dark) {
  body { background: #16161a; }
  footer { border-color: #2c2c31; color: #9a9aa2; }
}
`;

/** One document copied into the site, and the name it is published under. */
export interface Material {
  documentId: string;
  title: string;
  filename: string;
  source: string;
}

export const href = (material: Material): string => `${MATERIALS}/${material.filename}`;

const head = (title: string, style: string): string =>
  "<!doctype html>\n" +
  '<html lang="en">\n' +
  "<head>\n" +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  `<title>${title}</title>\n` +
  `<style>\n${style}</style>\n` +
  "</head>\n" +
  "<body>\n";

const foot = (asOf: string): string =>
  `<footer>Generated from the course model on ${asOf}. ` +
  "Nothing here is derived from student work.</footer>\n" +
  "</body>\n</html>\n";

/**
 * The finished page: markup the prerenderer produced, and the style for it.
 *
 * No script of any kind, which is the point — it renders with JavaScript
 * disabled, it prints, and it survives being saved to a phone.
 *
 * `style` is the professor's chosen template, appended last so it can restate
 * what the two style sheets above it declared. It is CSS and nothing else —
 * `templates.ts` refuses a template carrying markup — so what appears on this
 * page is still decided entirely by the view and the payload.
 */
export const renderStatic = (
  markup: string,
  payload: Record<string, any>,
  title: string,
  style = "",
): string =>
  head(title, PAGE_CSS + stylesheet() + style) +
  `<div id="root">${markup}</div>\n` +
  foot(payload.as_of ?? "");

/**
 * The widget document, handed its own payload to render in the browser.
 *
 * This is what goes *into* the prerenderer. Python also wrote it out as the
 * fallback page when Node could not be found; nothing here does that any more,
 * because there is no arrangement in which this code runs and Node does not.
 *
 * Every `<` in the JSON becomes `<`, which JSON decodes back to `<` and the
 * HTML parser never sees. Escaping only `</script>` is the familiar version of
 * this and it is not enough: `</` ends the element before any name character,
 * and a `<!--` earlier in the data puts the tokeniser in a state where the
 * element's own closing tag stops closing it. One escape covers all of it.
 */
export const renderPage = (
  payload: Record<string, any>,
  title: string,
  style = "",
  structure?: string,
): string => {
  const sortKeys = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(sortKeys);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(node as Record<string, unknown>).sort()) {
        out[key] = sortKeys((node as Record<string, unknown>)[key]);
      }
      return out;
    }
    return node;
  };
  const data = JSON.stringify(sortKeys(payload)).replace(/</g, "\\u003c");
  const widget = BY_TOOL.get("course_outline")!;
  return (
    head(title, PAGE_CSS + style) +
    // Before the widget: its runtime reads `window.openai` as it loads.
    `<script>window.openai = { toolOutput: ${data} };</script>\n` +
    `${widget.html(structure)}\n` +
    foot(payload.as_of ?? "")
  );
};

/**
 * Documents that are a student's own work, by what points at them.
 *
 * Structural rather than incidental. Every submission attachment in the example
 * course happens to live in object storage, so nothing would have been copied
 * today — and "nothing would have been copied today" is exactly the kind of
 * safety a repository path added next term quietly removes. A document a
 * submission names is not publishable material at any storage key.
 */
export const studentWork = (bundle: CourseBundle): Set<string> =>
  new Set(
    (bundle.submissions as any[]).flatMap((submission) =>
      (submission.files as any[]).map((attachment) => attachment.document_id as string),
    ),
  );

export interface Publishable {
  published: Material[];
  heldBack: string[];
  tally: Record<string, number>;
}

/**
 * The documents this repository holds and may hand to a student, and the rest.
 *
 * Three returns: what to publish, what was held back for a reason worth acting
 * on, and a tally of the reasons that are simply how the model works. A brief in
 * object storage is not a problem to report every build.
 */
export const publishable = (
  bundle: CourseBundle,
  courseVersionId: string,
  root: string,
): Publishable => {
  const published: Material[] = [];
  const heldBack: string[] = [];
  const tally: Record<string, number> = { "in object storage": 0, "student work": 0 };
  const claimed = new Map<string, string>();
  const theirs = studentWork(bundle);

  for (const document of bundle.documents as any[]) {
    if (document.course_version_id !== courseVersionId) continue;
    if (theirs.has(document.document_id)) {
      tally["student work"] += 1;
      continue;
    }
    const key = document.storage_key as string;
    if (key.includes("://")) {
      tally["in object storage"] += 1;
      continue;
    }
    if (key.startsWith("work/")) {
      heldBack.push(`${document.document_id}: a draft under work/, not approved material`);
      continue;
    }

    const source = join(root, key);
    let readable = false;
    try {
      readable = statSync(source).isFile();
    } catch {
      readable = false;
    }
    if (!readable) {
      heldBack.push(`${document.document_id}: ${key} is not a file in this repository`);
      continue;
    }

    const filename = (document.original_filename as string) || basename(source);
    if (claimed.has(filename)) {
      heldBack.push(
        `${document.document_id}: publishes as ${filename}, which ` +
          `${claimed.get(filename)} already claims — one of them needs a different name`,
      );
      continue;
    }

    claimed.set(filename, document.document_id);
    published.push({
      documentId: document.document_id,
      title: document.title,
      filename,
      source,
    });
  }

  return { published, heldBack, tally };
};

/**
 * Every publishable file checked against the recorded answers.
 *
 * Returns what may be published, what was held back, and which items the scan
 * could not cover — the last of these reported rather than swallowed, exactly as
 * `safety.ts` describes. A leak throws, and nothing catches it: that is the
 * refusal with no override.
 */
export const scanOrRefuse = (
  materials: Material[],
  bundle: CourseBundle,
): { safe: Material[]; heldBack: string[]; unchecked: string[] } => {
  const safe: Material[] = [];
  const heldBack: string[] = [];
  const unchecked: string[] = [];

  for (const material of materials) {
    let text: string;
    try {
      // `utf8` with `fatal` semantics: `readFileSync` will happily hand back
      // replacement characters for a PDF, and a scan of mojibake is a scan that
      // finds nothing and says it looked.
      text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(material.source));
    } catch {
      heldBack.push(
        `${material.documentId}: ${material.filename} is not readable as text, ` +
          "so the answer-key scan cannot cover it",
      );
      continue;
    }

    const result = scan(text, bundle.items as any[]);
    if (result.leaks.length) throw new Error(refusal(result, material.documentId));
    unchecked.push(...result.unchecked);
    safe.push(material);
  }

  return { safe, heldBack, unchecked };
};

/**
 * Point each required material at the copy published beside the page.
 *
 * The payload keeps whatever `url` the model recorded; this only fills one in
 * where the repository now serves the file itself. It is a location, not a
 * figure — nothing about what the course claims changes here.
 */
export const linkMaterials = (payload: Record<string, any>, materials: Material[]): void => {
  const byDocument = new Map(materials.map((material) => [material.documentId, material]));
  for (const entry of (payload.required_materials ?? []) as Record<string, any>[]) {
    const material = byDocument.get(entry.document_id);
    if (material) entry.url = href(material);
  }
};

/** Copy the approved materials into the site, bytes unchanged. */
export const copyMaterials = (site: string, materials: Material[]): void => {
  mkdirSync(join(site, MATERIALS), { recursive: true });
  for (const material of materials) {
    copyFileSync(material.source, join(site, MATERIALS, material.filename));
  }
};
