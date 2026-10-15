/**
 * The profile: what this workspace assumes about the institution and the
 * professor, resolved once and read by everyone — the CLI, the pane and (through
 * `ainar profile`) the skills.
 *
 * Before this, Kazakhstan was a handful of literals scattered through the code
 * (`Asia/Almaty`, the ВСК presets, T/LT/LLT, "partly is half"). A professor at
 * another university should change a file, not the harness.
 *
 * Six layers, each beating the one before, a layer overriding only the keys it
 * names:
 *
 *   system       vendor/datalayer/preferences/defaults.yaml   neutral
 *   institution  profiles/<id>.yaml                            a shipped pack
 *   professor    $PROFESSOR_HOME/preferences.yaml (else the workspace root)
 *   course       courses/<COURSE>/preferences.yaml
 *   run          courses/<COURSE>/versions/<TERM>/preferences.yaml
 *   task         what the invoking command passes
 *
 * Which institution pack applies is itself a value: `institution: narxoz` in the
 * professor, course, run or task layer (the highest wins).
 *
 * **Transition.** A workspace that names no institution gets `LEGACY_INSTITUTION`
 * — the pack that reproduces what the harness did before profiles existed — and
 * `Resolved.institutionSource` says `"legacy-default"`, so the course is not
 * silently changed under anyone. Delete the constant once the workspaces that
 * relied on it say `institution:` themselves.
 *
 * Merging: objects merge key by key; a list of `{id: …}` objects merges by id (the
 * later layer's order wins, ids it does not mention follow); any other list is
 * replaced whole.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
export const SYSTEM_DEFAULTS = join(REPO, "vendor", "datalayer", "preferences", "defaults.yaml");
export const PROFILES_DIR = join(REPO, "profiles");
export const LEGACY_INSTITUTION = "narxoz";

export type Scope = "system" | "institution" | "professor" | "course" | "run" | "task";

export interface PresetDef {
  id: string;
  title: string;
  family: string;
  summary: string;
  points?: number | null;
  components: any[];
}

export interface LateMark {
  word: string;
  factor: number;
  status: string;
  label: string;
}

/** The keys the code reads. Anything else a layer says is kept and passed through. */
export interface Profile {
  institution: string;
  locale: { language: string; timezone: string; reply_language?: string };
  credits: { system?: string; default?: number; hours_per_credit?: number };
  grading: {
    scale: { maximum: number };
    /** Regex sources; an assessment whose id or title matches one is the final. */
    final_matchers: string[];
    /** `first_midterm` — the first half closes with the first midterm — or `midpoint`. */
    period_boundary: string;
    default_preset?: string;
    presets: PresetDef[];
  };
  marking: { late_marks: LateMark[]; defence: { partial_factor: number } };
  print: { page_size?: string };
  lms: { canvas?: { base_url?: string } };
  [key: string]: any;
}

export interface Resolved {
  profile: Profile;
  institutionSource: Scope | "legacy-default" | "none";
  layers: { scope: Scope; path: string | null; present: boolean }[];
}

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const byId = (list: unknown[]): boolean => list.length > 0 && list.every((entry) => isObject(entry) && "id" in entry);

/** `over` on top of `under`; neither is changed. */
export const mergeLayers = (under: any, over: any): any => {
  if (under === undefined) return over;
  if (over === undefined || over === null || over === "") return under;
  if (isObject(under) && isObject(over)) {
    const result: Record<string, any> = { ...under };
    for (const [key, value] of Object.entries(over)) result[key] = mergeLayers(under[key], value);
    return result;
  }
  if (Array.isArray(under) && Array.isArray(over) && byId(under) && byId(over)) {
    const lower = new Map((under as any[]).map((entry) => [entry.id, entry]));
    const named = new Set((over as any[]).map((entry) => entry.id));
    return [
      ...(over as any[]).map((entry) => mergeLayers(lower.get(entry.id), entry)),
      ...(under as any[]).filter((entry) => !named.has(entry.id)),
    ];
  }
  return over;
};

const readValues = (path: string): Record<string, any> | null => {
  if (!existsSync(path)) return null;
  const parsed = parse(readFileSync(path, "utf8")) ?? {};
  return isObject(parsed.values) ? parsed.values : {};
};

export interface ResolveOptions {
  /** The workspace root; without one only the system and institution layers apply. */
  root?: string;
  courseId?: string;
  term?: string;
  professorHome?: string;
  /** Overrides what the layers say about which pack applies. */
  institution?: string;
  /** The task layer: values from the invoking command. */
  task?: Record<string, any>;
}

export const resolveProfile = (options: ResolveOptions = {}): Resolved => {
  const { root, courseId, term, task } = options;
  const layers: Resolved["layers"] = [];
  const read = (scope: Scope, path: string | null): Record<string, any> | null => {
    const values = path ? readValues(path) : null;
    layers.push({ scope, path, present: values !== null });
    return values;
  };

  const system = read("system", SYSTEM_DEFAULTS) ?? {};
  const upper: [Scope, Record<string, any> | null][] = [];
  if (root) {
    upper.push(["professor", read("professor", join(options.professorHome ?? process.env.PROFESSOR_HOME ?? root, "preferences.yaml"))]);
    if (courseId) {
      upper.push(["course", read("course", join(root, "courses", courseId, "preferences.yaml"))]);
      if (term) upper.push(["run", read("run", join(root, "courses", courseId, "versions", term, "preferences.yaml"))]);
    }
  }
  if (task) upper.push(["task", task]);

  let institution = "";
  let institutionSource: Resolved["institutionSource"] = "none";
  for (const [scope, values] of upper) {
    const named = values?.institution;
    if (typeof named === "string" && named.trim()) {
      institution = named.trim();
      institutionSource = scope;
    }
  }
  if (options.institution) {
    institution = options.institution;
    institutionSource = "task";
  }
  if (!institution && system.institution) {
    institution = String(system.institution);
    institutionSource = "system";
  }
  if (!institution) {
    institution = LEGACY_INSTITUTION;
    institutionSource = "legacy-default";
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(institution)) throw new Error(`institution ${JSON.stringify(institution)} is not a pack name`);

  const packPath = join(PROFILES_DIR, `${institution}.yaml`);
  const pack = read("institution", packPath);
  if (pack === null) throw new Error(`No institution pack ${institution}: expected ${packPath}`);

  // Layer order is system → institution → the rest, whatever order they were read in.
  let merged: any = mergeLayers(system, pack);
  for (const [, values] of upper) merged = mergeLayers(merged, values);
  merged.institution = institution;
  return { profile: merged as Profile, institutionSource, layers };
};

// ------------------------------------------------------------------ ambient

let active: Resolved | null = null;

/**
 * Make this workspace's profile the one the rest of the code reads without being
 * handed it. The CLI calls it once at start; a long-running host (the pane) calls
 * it again when the professor changes a layer.
 */
export const useWorkspaceProfile = (options: ResolveOptions = {}): Resolved => {
  active = resolveProfile(options);
  return active;
};

/** The profile in force; before anyone chose a workspace, the system + institution layers. */
export const activeProfile = (): Profile => (active ??= resolveProfile()).profile;

/** For tests: forget the ambient profile. */
export const resetActiveProfile = (): void => {
  active = null;
};
