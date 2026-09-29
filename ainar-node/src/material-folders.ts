/**
 * Turning a flat `materials/` into one folder per material.
 *
 * A course that grew before folders existed holds a deck as a dozen siblings —
 * `MODULE-06-slides.md`, its plan and outline, thirty `…-fig-NN-….svg`, the
 * `.pptx` and `.pdf` it renders to, the scripts that measured its numbers — and
 * finding the deck means reading past all of them. This regroups them:
 *
 *     materials/MODULE-06-slides/
 *       MODULE-06-slides.md  .plan.yaml  .outline.yaml  .pptx  .pdf   the result
 *       figures/fig-01-….svg  .png                                     pictures
 *       build/     scripts named for the same module
 *       sources/   notes and measured data named for the same module
 *
 * What it will not do is guess. A file is regrouped only when its name says
 * which material it belongs to (a deck's stem, or a module prefix that one deck
 * owns); anything else is named in `left` and stays where it is, because a
 * hand-written builder that resolves paths against `__file__` breaks silently if
 * it is moved, and reporting it is cheaper than that.
 *
 * Every record that spells a moved path is rewritten, the deck's figure links
 * become deck-relative, and the checksum of any document whose bytes changed is
 * restamped — the link rewrite is the only edit, and a record that disagreed
 * with its file would read as tampering.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

export interface OrganizeResult {
  moved: { from: string; to: string }[];
  left: { path: string; why: string }[];
  /** Files whose text was rewritten, and how many spots in each. */
  rewritten: { path: string; references: number }[];
  /** Documents whose recorded size and checksum were recomputed. */
  restamped: string[];
}

const FIGURE = /\.(svg|png|jpe?g|gif|webp|py)$/i;
const BUILD = /\.(py|ts|js|mjs)$/i;
const SOURCE = /\.(md|json|ndjson|txt|csv)$/i;
const DOCUMENT = /\.(pptx|pdf|docx|md|html)$/i;
const isLeftover = (name: string): boolean =>
  name.startsWith(".") || name.startsWith("__") || /\.bak(-|\.|$)|~$|\.orig$/i.test(name);

const posix = (path: string): string => path.split(/[\\/]/).join("/");

const yamlFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...yamlFiles(full));
    else if (/\.ya?ml$/i.test(name) && !isLeftover(name)) found.push(full);
  }
  return found;
};

/** Which folder each loose file belongs in, by what its name says. */
export const planFolders = (names: string[]): { to: Map<string, string>; left: Map<string, string> } => {
  const to = new Map<string, string>();
  const left = new Map<string, string>();
  const loose = names.filter((name) => !isLeftover(name) && name !== "materials.yaml");
  const claimed = new Set<string>();
  const claim = (name: string, target: string): void => {
    to.set(name, target);
    claimed.add(name);
  };

  // A deck is whatever has a plan: `pres` writes `<stem>.plan.yaml` beside it.
  const stems = loose.filter((n) => n.endsWith(".plan.yaml")).map((n) => n.slice(0, -".plan.yaml".length));

  for (const stem of stems) {
    for (const suffix of [".md", ".pptx", ".pdf", ".plan.yaml", ".outline.yaml"]) {
      const name = stem + suffix;
      if (loose.includes(name)) claim(name, `${stem}/${name}`);
    }
    for (const name of loose) {
      if (claimed.has(name) || !name.startsWith(`${stem}-fig-`) || !FIGURE.test(name)) continue;
      claim(name, `${stem}/figures/${name.slice(stem.length + 1)}`);
    }
  }
  // A module prefix belongs to a deck only when exactly one deck owns it.
  for (const stem of stems) {
    const prefix = stem.replace(/-slides$/, "") + "-";
    const owners = stems.filter((s) => s.replace(/-slides$/, "") + "-" === prefix);
    if (owners.length !== 1) continue;
    for (const name of loose) {
      if (claimed.has(name) || !name.startsWith(prefix)) continue;
      if (BUILD.test(name)) claim(name, `${stem}/build/${name}`);
      else if (SOURCE.test(name)) claim(name, `${stem}/sources/${name}`);
    }
  }
  // Everything else that is a finished document is its own material: a paper
  // and its PDF, an imported deck and its PDF, share a stem and so a folder.
  for (const name of loose) {
    if (claimed.has(name) || !DOCUMENT.test(name)) continue;
    const stem = basename(name, extname(name));
    claim(name, `${stem}/${name}`);
  }
  for (const name of loose) {
    if (!claimed.has(name)) left.set(name, "not named for any one material, so it is not guessed at");
  }
  return { to, left };
};

const digest = (bytes: Buffer): string => "sha256:" + createHash("sha256").update(bytes).digest("hex");

/**
 * Regroup `<courseDir>/materials/` into folders and rewrite what pointed at it.
 *
 * `courseKey` is the prefix records use for these files, e.g.
 * `courses/CSS-4007/materials/`.
 */
export const organizeMaterials = (options: {
  root: string;
  courseDir: string;
  courseKey: string;
  dryRun?: boolean;
}): OrganizeResult => {
  const { root, courseDir, courseKey, dryRun = false } = options;
  const dir = join(courseDir, "materials");
  const result: OrganizeResult = { moved: [], left: [], rewritten: [], restamped: [] };
  if (!existsSync(dir)) return result;

  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const { to, left } = planFolders(names);

  for (const [name, target] of to) {
    if (existsSync(join(dir, target))) {
      throw new Error(`${join(dir, target)} already exists, so ${name} has nowhere to land. Nothing was moved.`);
    }
    result.moved.push({ from: join(dir, name), to: join(dir, target) });
  }
  for (const [name, why] of left) result.left.push({ path: join(dir, name), why });
  for (const name of names) {
    if (!to.has(name) && !left.has(name)) result.left.push({ path: join(dir, name), why: "a backup, cache or the manifest" });
  }

  // Deck-relative figure links: `<stem>-fig-01-x.svg` becomes `figures/fig-01-x.svg`.
  const figureStems = [...new Set([...to.values()].filter((t) => t.includes("/figures/")).map((t) => t.split("/")[0]!))];
  const relink = (text: string): { text: string; count: number } => {
    let count = 0;
    let out = text;
    for (const stem of figureStems) {
      out = out.replace(new RegExp(`(?<![\\w/-])${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-fig-`, "g"), () => {
        count += 1;
        return "figures/fig-";
      });
    }
    return { text: out, count };
  };

  // Old name -> new relative path, longest first so a name is never a prefix of
  // a longer one that is also being rewritten.
  const renames = [...to.entries()].sort((a, b) => b[0].length - a[0].length);
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const respell = (text: string): { text: string; count: number } => {
    let count = 0;
    let out = text;
    for (const [name, target] of renames) {
      out = out.replace(
        new RegExp(`(${escape(courseKey)})${escape(name)}(?![\\w-]|\\.[\\w])`, "g"),
        (_, prefix: string) => {
          count += 1;
          return prefix + target;
        },
      );
    }
    return { text: out, count };
  };
  /** The manifest names files relative to itself, not by the full key. */
  const respellManifest = (text: string): { text: string; count: number } => {
    let count = 0;
    let out = text;
    for (const [name, target] of renames) {
      out = out.replace(
        new RegExp(`^(\\s*(?:render|produces|run):\\s*)${escape(name)}\\s*$`, "gm"),
        (_, head: string) => {
          count += 1;
          return head + target;
        },
      );
    }
    return { text: out, count };
  };

  // Text to rewrite, computed before anything is moved so a failure leaves
  // the course as it was.
  const writes = new Map<string, string>();
  for (const file of yamlFiles(courseDir)) {
    const before = readFileSync(file, "utf-8");
    const inMaterials = file.startsWith(dir);
    const a = respell(before);
    const b = basename(file) === "materials.yaml" ? respellManifest(a.text) : { text: a.text, count: 0 };
    if (a.count + b.count === 0 || inMaterials && to.has(basename(file))) {
      if (a.count + b.count) writes.set(file, b.text);
      continue;
    }
    writes.set(file, b.text);
    result.rewritten.push({ path: file, references: a.count + b.count });
  }

  // The moved files' own text: links inside a deck, and paths inside a sidecar.
  const movedText = new Map<string, string>();
  for (const [name, target] of to) {
    if (!/\.(md|ya?ml)$/i.test(name)) continue;
    const from = join(dir, name);
    const original = writes.get(from) ?? readFileSync(from, "utf-8");
    const linked = relink(respell(original).text);
    if (linked.text !== readFileSync(from, "utf-8")) {
      movedText.set(target, linked.text);
      result.rewritten.push({ path: from, references: Math.max(linked.count, 1) });
    }
  }

  // What each edited file hashed to BEFORE the edit. Restamping is only honest
  // for a record that matched its file to begin with: one that was already out
  // of step (the professor edited the deck since it was recorded) carries a
  // signal — "this rendering may be a picture of old text" — that a restamp
  // would quietly erase.
  const before = new Map<string, string>();
  for (const target of movedText.keys()) {
    const name = [...to.entries()].find(([, t]) => t === target)![0];
    before.set(target, digest(readFileSync(join(dir, name))));
  }

  if (dryRun) return result;

  for (const { from, to: destination } of result.moved) {
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(from, destination);
  }
  for (const [target, text] of movedText) writeFileSync(join(dir, target), text, "utf-8");
  for (const [file, text] of writes) {
    if (existsSync(file)) writeFileSync(file, text, "utf-8");
  }

  // Restamp: a document whose file now differs from its record.
  for (const file of yamlFiles(courseDir)) {
    const lines = readFileSync(file, "utf-8").split("\n");
    let changed = false;
    let block = -1;
    let key: string | null = null;
    let id = "";
    const settle = (end: number): void => {
      if (block < 0 || key === null) return;
      // Only a document whose own text was edited here: a record that was
      // already out of step with its file is not this command's to tidy.
      if (!key.startsWith(courseKey) || !movedText.has(key.slice(courseKey.length))) return;
      const path = join(root, key);
      if (!existsSync(path) || !statSync(path).isFile()) return;
      const bytes = readFileSync(path);
      const stamp = digest(bytes);
      // Decide before touching a line: the size comes before the checksum in a
      // record, so checking as we go would rewrite one and then refuse the other.
      const recorded = lines
        .slice(block, end)
        .map((line) => /^\s*checksum:\s*(\S+)\s*$/.exec(line)?.[1])
        .find(Boolean);
      if (recorded !== before.get(key.slice(courseKey.length))) {
        result.left.push({ path, why: "its record already disagreed with the file; not restamped" });
        return;
      }
      for (let i = block; i < end; i++) {
        const line = lines[i]!;
        const checksum = /^(\s*checksum:\s*)(\S+)\s*$/.exec(line);
        const size = /^(\s*size_bytes:\s*)(\d+)\s*$/.exec(line);
        if (checksum && checksum[2] !== stamp) {
          lines[i] = checksum[1] + stamp;
          changed = true;
          result.restamped.push(id);
        }
        if (size && Number(size[2]) !== bytes.length) {
          lines[i] = size[1] + String(bytes.length);
          changed = true;
        }
      }
    };
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s+document_id:/.test(lines[i]!)) {
        settle(i);
        block = i;
        key = null;
        id = lines[i]!.replace(/^\s*-\s+document_id:\s*/, "").trim();
      }
      const found = /^\s*storage_key:\s*(\S+)\s*$/.exec(lines[i]!);
      if (found && block >= 0) key = found[1]!;
    }
    settle(lines.length);
    if (changed) writeFileSync(file, lines.join("\n"), "utf-8");
  }
  result.restamped = [...new Set(result.restamped)];
  return result;
};

export const relativeTo = (base: string, path: string): string => posix(relative(base, path));
