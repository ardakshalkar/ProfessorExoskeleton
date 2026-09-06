/**
 * Reading agent proposals out of `work/`. Ported from `ainar/loader.py`.
 *
 * `DRAFTABLE` is the whole list of what an agent may propose, and the omissions
 * are the point: no `outcomes`, no `capabilities`, no `enrollments`. A learning
 * outcome is what student evidence attaches to, so an invented one is the
 * mistake that costs most to find late — the loader refuses it in a draft file
 * rather than trusting a skill to decline.
 *
 * **`concepts` and `modules` were removed from that list on 2026-09-05**, which
 * is a change of policy rather than a port of Python's. The professor's ruling:
 * the structure of a course — what it teaches and in which week — is their own
 * authoring, written straight into `courses/`, while what reaches a student
 * through a grade waits for approval. Lectures, assessments and items therefore
 * stay draftable; the shape of the course no longer is.
 *
 * Enforced here rather than left to the skills, because a rule that lives only
 * in prose is a rule some future skill will not have read. A draft file
 * carrying `concepts:` now fails with `draft.collection`, naming the collection
 * and the file — see `loadDrafts` below.
 *
 * This is a DIVERGENCE from `ainar/loader.py`. Python still accepts both, so a
 * draft file written by the Python side and read here will be refused. That is
 * the intended direction — this project does not run Python — but it means the
 * two loaders no longer agree, and `tests/test_*_parity.py` upstream would say
 * so if it were run against this tree.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
import { z } from "zod";
import type { CourseBundle } from "./bundle.ts";
import { IssueList } from "./issues.ts";
import { MERGE_KEYS } from "./loader.ts";
import {
  Assessment,
  AssessmentItem,
  Evaluation,
  ItemModel,
  ItemResponse,
  Submission,
} from "./model/assessment.ts";
import { Document } from "./model/content.ts";
import { LearningActivity, Resource } from "./model/delivery.ts";
import { ActionItem, CourseEvent } from "./model/harness.ts";
import {
  Intervention,
  LearningEvidence,
  StudentCapabilityState,
  StudentConceptState,
  StudentSignal,
} from "./model/learning.ts";

/** What may appear in a draft file, keyed by its top-level YAML key. */
export const DRAFTABLE = {
  // `concepts` and `modules` are deliberately absent — the professor authors the
  // course's structure directly. See this file's header.
  activities: LearningActivity,
  documents: Document,
  resources: Resource,
  assessments: Assessment,
  items: AssessmentItem,
  item_models: ItemModel,
  submissions: Submission,
  item_responses: ItemResponse,
  evaluations: Evaluation,
  evidence: LearningEvidence,
  concept_states: StudentConceptState,
  capability_states: StudentCapabilityState,
  signals: StudentSignal,
  interventions: Intervention,
  events: CourseEvent,
  action_items: ActionItem,
} as const;

export type DraftCollection = keyof typeof DRAFTABLE;

export type Drafted = Record<DraftCollection, Record<string, unknown>[]>;

const empty = (): Drafted =>
  Object.fromEntries(Object.keys(DRAFTABLE).map((key) => [key, []])) as unknown as Drafted;

/**
 * `_SIDECARS` in `loader.py`: the files `pres` writes beside a deck's markdown.
 *
 * `plan.ts` resolves each as `dirname(deck) + basename + suffix`, so they cannot
 * be moved out of a drafts directory without the presentation tooling losing
 * them — which is why the rule is the suffix rather than the path.
 */
const SIDECARS = [".plan.yaml", ".outline.yaml"];

/**
 * Every `.yaml`/`.yml` under `directory`, recursively, in sorted order —
 * skipping what a tool left behind rather than what somebody proposed.
 *
 * `_machinery` in `loader.py` is the rule, and this had none of it: a
 * dot-directory, a `node_modules`, and a deck sidecar were all read as drafts
 * and reported as undraftable collections. Python skipped them and this did
 * not, so `ainar validate` said a workspace was clean while the pane serving
 * the same files listed a hundred and sixteen errors against it.
 */
const draftFiles = (directory: string): string[] => {
  const found: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path).sort()) {
      const full = join(path, entry);
      if (statSync(full).isDirectory()) {
        // `relative.parts[:-1]` in Python: a directory on the way down, never
        // the drafts root itself, which `walk` is only ever handed.
        if (entry !== "node_modules" && !entry.startsWith(".")) walk(full);
      } else if (/\.ya?ml$/.test(entry) && !SIDECARS.some((s) => entry.endsWith(s))) {
        found.push(full);
      }
    }
  };
  walk(directory);
  // Python sorts the union of two rglob results, which orders by full path.
  return found.sort();
};

/**
 * The first zod error, rendered the way `_format_validation_error` renders it:
 * the record's index, the field path, and what was wrong with it.
 */
const formatError = (
  error: z.ZodError,
  path: string,
  index: number,
  collection: string,
  issues: IssueList,
): void => {
  for (const problem of error.issues) {
    const where = problem.path.length ? problem.path.join(".") : "(record)";
    issues.error(
      "draft.invalid",
      `${collection}[${index}].${where}: ${problem.message}`,
      path,
    );
  }
};

/**
 * Load every draft file in a directory, dispatched by top-level key.
 *
 * One file may hold several collections, which is why a draft is keyed rather
 * than named by its filename.
 */
export const loadDrafts = (directory: string, issues: IssueList): Drafted => {
  const drafted = empty();

  let stat;
  try {
    stat = statSync(directory);
  } catch {
    issues.error("draft.missing", "drafts directory not found", directory);
    return drafted;
  }
  if (!stat.isDirectory()) {
    issues.error("draft.missing", "drafts directory not found", directory);
    return drafted;
  }

  const paths = draftFiles(directory);
  if (!paths.length) issues.warn("draft.empty", "no draft files found", directory);

  for (const path of paths) {
    let documents;
    try {
      documents = parseAllDocuments(readFileSync(path, "utf-8"), MERGE_KEYS);
    } catch (error) {
      issues.error("draft.unreadable", String((error as Error).message), path);
      continue;
    }

    for (const document of documents) {
      const value = document.toJS({ mapAsMap: false });
      if (value === null || value === undefined) continue;
      if (typeof value !== "object" || Array.isArray(value)) {
        issues.error(
          "draft.shape",
          "a draft file must be a mapping of collection name to records",
          path,
        );
        continue;
      }

      for (const [key, entries] of Object.entries(value as Record<string, unknown>)) {
        const model = (DRAFTABLE as Record<string, z.ZodTypeAny>)[key];
        if (model === undefined) {
          issues.error(
            "draft.collection",
            `'${key}' is not a draftable collection; expected one of ` +
              Object.keys(DRAFTABLE).sort().join(", "),
            path,
          );
          continue;
        }
        if (!Array.isArray(entries)) {
          issues.error("draft.shape", `${key} must be a list of records`, path);
          continue;
        }
        entries.forEach((entry, index) => {
          const parsed = model.safeParse(entry);
          if (parsed.success) {
            drafted[key as DraftCollection].push(parsed.data as Record<string, unknown>);
          } else {
            formatError(parsed.error, path, index, key, issues);
          }
        });
      }
    }
  }

  return drafted;
};

/** A copy of the bundle with drafted records appended, for validation. */
export const mergeDrafts = (
  bundle: CourseBundle,
  drafted: Partial<Record<DraftCollection, Record<string, unknown>[]>>,
): CourseBundle => {
  const merged = structuredClone(bundle) as unknown as Record<string, unknown[]>;
  for (const [name, records] of Object.entries(drafted)) {
    if (!records?.length) continue;
    merged[name] = [...((merged[name] as unknown[]) ?? []), ...records];
  }
  return merged as unknown as CourseBundle;
};
