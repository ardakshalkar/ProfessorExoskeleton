/**
 * Named output templates, chosen by the professor rather than invented per run.
 * Ported from `ainar/templates.py`.
 *
 * Every surface in this workspace that produces something to look at — the
 * public page, the two dashboards, a brief, a report — decided its own
 * appearance each time it ran. For the commands that meant one hard-coded style
 * sheet; for the skills it meant a model writing fresh markup, so two runs a
 * week apart produced two documents that were the same course in different
 * clothes.
 *
 * A template fixes the shape so the shape is not a decision. It lives beside the
 * skill that uses it, listed in a `templates.yaml` the skill reads aloud, and the
 * professor picks one. That is the whole mechanism, and its limits are the point:
 *
 * **A template changes how output looks, never what it says.** It carries no
 * figure, no total, no outcome, no weight. The commands still decide the content
 * of what they render, which is why a style sheet is all this module will load
 * for them — a template that could add a block could add a block derived from
 * student work.
 *
 * **A style sheet has no markup in it.** `<` anywhere in one is refused rather
 * than escaped: the page embeds it inside `<style>`, so `</style>` in a template
 * is markup injection into a document written for a public URL, and the
 * professor would have written it by hand without meaning anything by it.
 * `@import` and any `url()` naming a host are refused for the neighbouring
 * reason — the pages here are self-contained by design, and one external request
 * is one too many.
 *
 * **A template declares which surface it is for.** The public page and the
 * private dashboards keep their templates in different directories because they
 * are different jobs, and `templates.yaml` says which. Pointing `ainar page` at a
 * dashboard template is a mistake worth stopping at the command rather than
 * discovering in the rendered page.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { parse } from "yaml";

/**
 * The file every templates directory carries. It is the menu the skill reads
 * out, and the only place a template's human name lives — the files themselves
 * stay plain CSS, HTML and markdown so they can be opened and edited as such.
 */
export const INDEX = "templates.yaml";

/**
 * Where a bare `--template plain` is looked for.
 *
 * `plugins/professor-course-skills/skills` is first and is where the skills
 * this command loads templates for actually live: it was added on 2026-09-17,
 * because cd68c12 ("One root for this host's skills") had moved them there the
 * day before and left every root in this list naming somewhere that no longer
 * existed — `ainar page --template plain` and `ainar dashboard --template
 * plain` both failed to resolve a template that was sitting in the checkout.
 * The two surfaces reached from here, `course-page` and `course-dashboard`,
 * are both under it.
 *
 * `skills` is next and was this project's own layout until that move.
 * `.agents/skills` is where those same skills lived until 2026-09-16; the two
 * after it are upstream's, kept for a workspace laid out that way. The older
 * four are kept rather than replaced so a checkout from before either move
 * still resolves. All five are tried and the failure names all five, because
 * "no such template" without a path sends someone reading source.
 */
export const SEARCH = [
  join("plugins", "professor-course-skills", "skills"),
  "skills",
  join(".agents", "skills"),
  join(".claude", "skills"),
  join("plugin", "ainar-exoskeleton", "skills"),
];

/**
 * Refused in a style sheet, with the reason said in the professor's terms. Not a
 * sanitiser: nothing here is stripped or escaped, because a template with any of
 * this in it was written under a misunderstanding of what a template is, and
 * quietly repairing it teaches the misunderstanding.
 */
const FORBIDDEN: [string, string][] = [
  ["<", "markup. A template is a style sheet; the command writes the HTML"],
  ["@import", "an @import. These pages must open from disk with no network"],
  ["javascript:", "a javascript: URL"],
  ["expression(", "an expression(), which is script by another name"],
];

/** `url()` may name a file beside the page and may not name a host. */
const REMOTE = ["url(http", "url('http", 'url("http', "url(//", "url('//", 'url("//'];

/**
 * Refused in a structure template — the markup file a view arranges its values
 * with. A structure cannot introduce a figure, because the model it is handed
 * comes from `outline.ts` and carries nothing about a student. What it could
 * introduce is a script or a request, and the page tests assert the rendered
 * page has neither. Refusing here is what keeps that a statement about every
 * page rather than about the shipped template only.
 */
const UNSAFE_MARKUP: [string, string][] = [
  ["{{{", "an unescaped-output construct. Every value is escaped; there is no raw"],
  ["<script", "a script element. The published page carries no script at all"],
  ["<iframe", "an iframe"],
  ["<object", "an object element"],
  ["<embed", "an embed element"],
  ["<link", "a link element, which would fetch something"],
  ["<img", "an img element, which would fetch something"],
  ["src=", "a src attribute. The page has to open from disk with no network"],
  ["javascript:", "a javascript: URL"],
];

/** One entry in a skill's menu. */
export interface Template {
  id: string;
  file: string;
  name: string;
  suits: string;
  path: string;
}

/** One skill's templates, and the surface they are for. */
export interface TemplateSet {
  surface: string;
  public: boolean;
  default: string;
  templates: Template[];
  directory: string;
  /**
   * Markup templates — which sections a page has and in what order — for the one
   * surface whose view arranges its values with a template file rather than a
   * function. Empty everywhere else.
   */
  structures: Template[];
  defaultStructure: string;
}

/**
 * A refusal a person is meant to read, as against a bug.
 *
 * Python raised `SystemExit`, which argparse's caller printed and exited on.
 * There is no equivalent here, so the CLI catches this by type and prints the
 * message without a stack — the distinction being that everything in this module
 * fails because of something the professor wrote, not something the code did.
 */
export class TemplateRefusal extends Error {}

const refuse = (message: string): never => {
  throw new TemplateRefusal(message);
};

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * One skill's `templates.yaml`, checked against the files actually there.
 *
 * An index naming a file that does not exist is the failure mode of a menu: the
 * professor picks the one that reads best and the command fails afterwards.
 */
export const readIndex = (directory: string): TemplateSet => {
  const index = join(directory, INDEX);
  if (!isFile(index)) {
    refuse(`${index} does not exist, so there is no menu to choose from`);
  }

  const document = (parse(readFileSync(index, "utf-8")) ?? {}) as Record<string, any>;

  const read = (key: string): Template[] => {
    const found: Template[] = [];
    for (const entry of (document[key] ?? []) as Record<string, string>[]) {
      const missing = ["file", "id", "name", "suits"].filter((field) => !(field in entry));
      if (missing.length) refuse(`${index}: an entry is missing ${missing.join(", ")}`);
      const path = join(directory, entry.file!);
      if (!isFile(path)) {
        refuse(`${index}: ${entry.id} names ${entry.file}, which is not there`);
      }
      found.push({ id: entry.id!, file: entry.file!, name: entry.name!, suits: entry.suits!, path });
    }
    return found;
  };

  const templates = read("templates");
  if (!templates.length) refuse(`${index} lists no templates`);
  const structures = read("structures");

  const chosen = (key: string, among: Template[], fallback = ""): string => {
    const value = (document[key] as string | undefined) || fallback;
    if (value && !among.some((template) => template.id === value)) {
      refuse(`${index}: ${key} '${value}' is not one of them`);
    }
    return value;
  };

  return {
    surface: (document.surface as string) ?? basename(dirname(directory)),
    public: Boolean(document.public),
    default: chosen("default", templates, templates[0]!.id),
    templates,
    directory,
    structures,
    // No fallback: an empty default means the template the command ships with,
    // which is the arrangement nobody has to choose.
    defaultStructure: chosen("default_structure", structures),
  };
};

/** The choice, as the skill puts it to the professor. */
export const menu = (set: TemplateSet): string => {
  const line = (template: Template, isDefault: boolean): string =>
    `  ${template.id}${isDefault ? "  (default)" : ""} — ${template.name}: ${template.suits}`;
  const lines = set.templates.map((template) => line(template, template.id === set.default));
  if (set.structures.length) {
    lines.push("  layout:");
    lines.push(
      ...set.structures.map((template) => line(template, template.id === set.defaultStructure)),
    );
  }
  return lines.join("\n");
};

/** One named template out of a set, or a refusal naming the ones there are. */
export const get = (set: TemplateSet, templateId: string): Template => {
  const found = set.templates.find((template) => template.id === templateId);
  if (found) return found;
  const known = set.templates.map((template) => template.id).join(", ");
  return refuse(`${join(set.directory, INDEX)} lists no template '${templateId}'. It has: ${known}`);
};

/** Every directory a bare template id is looked for in, in order. */
const lookedIn = (root: string, surface: string): string[] =>
  SEARCH.map((relative) => join(root, relative, surface, "templates"));

/**
 * A `--template` argument as a path, whether it arrived as one or as an id.
 *
 * `--template print` is what a professor types and `--template
 * skills/course-page/templates/print.css` is what a skill passes; both end up
 * here.
 */
export const resolveTemplate = (
  value: string,
  surface: string,
  root: string,
  suffix = ".css",
): string => {
  const expanded = value.startsWith("~") ? join(homedir(), value.slice(1)) : value;
  // A bare id has no extension and no directory; anything else is a path the
  // caller means literally.
  if (extname(expanded) || expanded.includes("/") || expanded.includes(sep)) {
    const path = isAbsolute(expanded) ? expanded : resolve(expanded);
    if (!isFile(path)) refuse(`no template at ${expanded}`);
    return path;
  }

  const looked = lookedIn(root, surface);
  for (const directory of looked) {
    const path = join(directory, `${value}${suffix}`);
    if (isFile(path)) return path;
  }
  return refuse(
    `no ${suffix.replace(/^\./, "")} template '${value}' for ${surface}. Looked in:\n` +
      looked.map((directory) => `  ${directory}`).join("\n"),
  );
};

/**
 * A template built for another surface, stopped before it renders anything.
 *
 * Only checked when the file sits in a directory that declares one. A style
 * sheet the professor wrote themselves and passed by path is theirs, and this is
 * not the place to have an opinion about it.
 */
const checkSurface = (path: string, surface: string): void => {
  const index = join(dirname(path), INDEX);
  if (!isFile(index)) return;
  const declared = ((parse(readFileSync(index, "utf-8")) ?? {}) as Record<string, unknown>)
    .surface as string | undefined;
  if (declared && declared !== surface) {
    refuse(
      `${basename(path)} is a template for ${declared}, and this command is ${surface}. ` +
        `The two draw different things — ${declared}'s templates style blocks this ` +
        "page does not have, and this page has blocks they do not style.",
    );
  }
};

/**
 * The markup template to arrange a view's values with, and its name.
 *
 * The counterpart to `loadStyle`, for the half of the appearance a style sheet
 * cannot reach: which sections a page has, and in what order. It is still not a
 * second renderer — the same view runs, handed the same model — which is why the
 * professor may hold this file and why nothing in it can produce a figure.
 *
 * What it is checked for is the two things markup can do that CSS cannot: run
 * something, and fetch something. Both are refused, because the page this
 * produces is written for a URL a student opens and is asserted to carry neither.
 */
export const loadStructure = (
  value: string | undefined,
  surface: string,
  root: string,
): [string, string] => {
  if (!value) return ["", ""];

  const path = resolveTemplate(value, surface, root, ".tmpl");
  checkSurface(path, surface);
  const markup = readFileSync(path, "utf-8");
  const squeezed = markup.replace(/ /g, "");

  for (const [needle, what] of UNSAFE_MARKUP) {
    if (squeezed.includes(needle)) {
      refuse(`${path} contains ${what}. Take it out; there is no flag for this.`);
    }
  }
  return [markup, basename(path, extname(path))];
};

/** The CSS to append, and the name to print. `["", ""]` when none was asked for. */
export const loadStyle = (
  value: string | undefined,
  surface: string,
  root: string,
): [string, string] => {
  if (!value) return ["", ""];

  const path = resolveTemplate(value, surface, root);
  checkSurface(path, surface);
  const css = readFileSync(path, "utf-8");

  for (const [needle, what] of FORBIDDEN) {
    if (css.includes(needle)) {
      refuse(`${path} contains ${what}. Take it out; there is no flag for this.`);
    }
  }
  const squeezed = css.replace(/ /g, "");
  for (const needle of REMOTE) {
    if (squeezed.includes(needle)) {
      refuse(
        `${path} loads something over the network. These pages have to open ` +
          "from disk with no connection; embed the asset or drop it.",
      );
    }
  }
  return [css, basename(path, extname(path))];
};

/** Whether a templates directory exists for a surface. Used by the CLI's help. */
export const templatesFor = (root: string, surface: string): string | null =>
  lookedIn(root, surface).find((directory) => existsSync(join(directory, INDEX))) ?? null;
